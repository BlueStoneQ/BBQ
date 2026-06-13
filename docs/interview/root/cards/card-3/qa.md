# Card-3 Q&A：RN 工程化 / 分 Bundle / 热更新 / Native 深度

> Root 二面准备。对方可能很懂 Android/iOS，会追问 Native 层细节。
>
> 策略：问点答面答体系。每个问题都是展示"我能建完整大前端工程化体系"的入口。

---

## 目录

- [Q1: 分 Bundle 加载时序](#q1-分-bundle-加载时序)
- [Q2: Common 和 Business Bundle 怎么拆的](#q2-common-和-business-bundle-怎么拆的)
- [Q3: 热更新全流程](#q3-热更新全流程)
- [Q4: 差量更新原理（bsdiff）](#q4-差量更新原理bsdiff)
- [Q5: 灰度 + 回滚机制](#q5-灰度--回滚机制)
- [Q6: Native 壳怎么管理多 Bundle 文件](#q6-native-壳怎么管理多-bundle-文件)
- [Q7: Hermes 是什么 为什么用](#q7-hermes-是什么-为什么用)
- [Q8: RN New Architecture 你了解多少](#q8-rn-new-architecture-你了解多少)
- [Q9: 性能监控怎么做（Native 侧）](#q9-性能监控怎么做native-侧)
- [Q10: 和 CodePush 的区别](#q10-和-codepush-的区别)

---

## Q1: 分 Bundle 加载时序

**Q：Native 壳启动时，Common Bundle 和 Business Bundle 的加载时序是怎样的？**

```
App 启动时序：

1. Native 壳启动（Application.onCreate / AppDelegate）
2. 创建 ReactInstanceManager（RN 引擎）
3. 同步加载 Common Bundle（common.hbc）
   → 包含：React / React Native / 公共组件 / 公共工具
   → 必须先加载（Business 依赖它）
   → 加载方式：ReactInstanceManager.loadBundle(commonPath)
4. Common 加载完成 → RN Bridge 就绪
5. 按策略加载 Business Bundle：
   → preload 模块：立即异步加载（首页/搜索）
   → idle 模块：主线程空闲时加载
   → onDemand 模块：用户触发时才加载
6. Business Bundle 加载 = 注册新的 RN 组件到 AppRegistry
   → Native 路由跳转时，通过 AppRegistry 找到对应组件渲染

关键点：
  - Common 必须同步先加载（是其他 Bundle 的运行时基础）
  - Business 是增量注册（不创建新 ReactInstance，共享同一个）
  - 多 Bundle 共享同一个 JS 线程和 Bridge
```

**Android 侧具体实现**：

```kotlin
// 简化版：Android 多 Bundle 加载
class XRNApplication : Application() {
  lateinit var reactHost: ReactHost

  override fun onCreate() {
    // 1. 创建 RN Host（New Architecture）
    reactHost = ReactHost.create(this, reactConfig)
    
    // 2. 加载 Common Bundle（同步，阻塞直到完成）
    reactHost.loadBundle("common.hbc", synchronous = true)
    
    // 3. 预加载高频 Business Bundle（异步）
    XRNBundleManager.preload(listOf("home", "search"))
  }
}

// Bundle 管理器
object XRNBundleManager {
  fun preload(modules: List<String>) {
    modules.forEach { module ->
      // 异步加载：不阻塞主线程
      thread { reactHost.loadBundle("${module}.hbc") }
    }
  }
  
  fun loadOnDemand(module: String, callback: () -> Unit) {
    if (isLoaded(module)) { callback(); return }
    reactHost.loadBundle("${module}.hbc") { callback() }
  }
}
```

---

## Q2: Common 和 Business Bundle 怎么拆的

**Q：Metro 怎么把一个 RN 项目拆成多个 Bundle？依赖怎么不重复打入？**

```
核心原理：Metro 的 createModuleIdFactory + processModuleFilter

1. 先构建 Common Bundle：
   → entry: './common-entry.js'（import React/RN/公共库）
   → 正常 bundle → 产出 common.hbc
   → 同时产出模块 ID 清单（moduleIds.json）

2. 再构建 Business Bundle：
   → entry: './modules/home/index.js'
   → 配置 processModuleFilter：跳过 common 已包含的模块
   → Metro resolve 到 react 时 → 查 moduleIds.json → 已在 common 里 → 不打入
   → 只打入 home 自己的业务代码

结果：
  common.hbc = React + RN + 公共依赖（~2MB）
  home.hbc = 首页业务代码（~200KB）
  search.hbc = 搜索业务代码（~150KB）
```

```js
// metro.config.js 关键配置（简化）
const commonModuleIds = require('./commonModuleIds.json')

module.exports = {
  serializer: {
    createModuleIdFactory: () => {
      // 自定义模块 ID 生成：确保 common 和 business 用同一套 ID
      return (path) => hash(path)
    },
    processModuleFilter: (module) => {
      // Business Bundle 构建时：排除 common 已有的模块
      if (buildingBusiness && commonModuleIds.includes(module.id)) {
        return false  // 不打入
      }
      return true
    }
  }
}
```

**为什么能共享？**

```
Common 加载后，模块已注册到 JS 引擎的全局模块表（__r 和 __d）
Business Bundle 里引用 React 时：
  __r(moduleId) → 从全局模块表里找 → 找到 Common 已注册的 → 直接用
  不需要自己再包含一份 React
```

---

## Q3: 热更新全流程

**Q：从开发者发布到用户生效，完整流程是怎样的？**

```
发布侧：
  开发者 → xrn publish home
    → Metro build home.hbc（增量构建）
    → 上传到 OSS/S3
    → Server 计算和上一版本的 bsdiff 差量包
    → 注册新版本 + 配置灰度策略

客户端侧：
  App 启动 / 进入前台 → Updater SDK 调 /check-update API
    → 传参：当前各 Bundle 版本号 + 设备信息 + 用户标识
    → Server 判断：该用户是否在灰度范围内？有新版本吗？
    → 返回：需要更新的 Bundle 列表 + 下载 URL（差量或全量）

  下载 → bspatch 合并（Native 层 C 库）→ hash 校验
    → 写入本地 Bundle 目录（不覆盖旧版本，保留回退能力）
    → 标记"下次启动生效"

  下次启动 / 当次热重载：
    → Native 壳读取最新 Bundle 路径 → 加载新版本
    → 如果加载失败 / 连续 crash → 自动回退到上一版本

生效策略：
  静默更新：下次启动生效（用户无感知）
  强制更新：当次重载生效（弹窗提示）
```

---

## Q4: 差量更新原理（bsdiff）

**Q：差量包是怎么算的？客户端怎么合并？**

```
bsdiff 算法：
  输入：old.hbc（旧版本）+ new.hbc（新版本）
  输出：patch.diff（差量包，通常只有新版本的 10-30% 大小）
  原理：找到两个二进制文件的差异区域，只记录"哪里变了"

bspatch 合并（客户端 Native 层）：
  输入：本地 old.hbc + 下载的 patch.diff
  输出：new.hbc
  过程：按 patch 指令，在 old 基础上插入/替换差异区域

为什么在 Native 层做：
  bsdiff/bspatch 是 C 库，通过 JNI（Android）/ C Bridge（iOS）调用
  性能好（纯内存操作），且 JS 线程做不了二进制处理

安全校验：
  合并后算 SHA-256 → 和 Server 下发的 hash 比对 → 不一致则丢弃用全量
```

---

## Q5: 灰度 + 回滚机制

**Q：灰度怎么控制？什么时候触发回滚？**

```
灰度维度：
  - 按比例（5% → 30% → 100%）
  - 按用户 ID（白名单内测）
  - 按设备类型（只推 Android / 只推高端机）
  - 按地区
  - 按 App 版本（只推 >= 5.0 的用户）

Server 判断逻辑：
  /check-update 时带上设备信息
  → Server 根据灰度配置判断"该用户是否命中灰度"
  → 命中 → 返回新版本下载地址
  → 未命中 → 返回"无更新"

回滚机制（两层）：
  客户端自动回滚：
    → Updater SDK 记录加载结果
    → 连续 crash 2 次（新版本 Bundle 加载后）→ 自动标记为坏版本 → 回退旧版本
    → 上报 crash 事件给 Server

  服务端人工/自动回滚：
    → 监控 crash 率：新版本 crash 率 > 阈值 → 自动停止灰度 → 全量回退
    → 或运维手动 xrn rollback home
```

---

## Q6: Native 壳怎么管理多 Bundle 文件

**Q：本地有多个版本的 Bundle 文件，怎么管理？启动时怎么决定加载哪个？**

```
文件目录结构：
  /data/data/com.app/files/xrn/
  ├── common/
  │   ├── v1.0.0/common.hbc     ← 当前使用
  │   └── v1.0.1/common.hbc     ← 已下载待生效
  ├── home/
  │   ├── v2.3.0/home.hbc       ← 当前使用
  │   └── v2.3.1/home.hbc       ← 已下载待生效
  └── manifest.json             ← 版本状态表

manifest.json：
  {
    "common": { "current": "v1.0.0", "pending": "v1.0.1", "fallback": "builtin" },
    "home": { "current": "v2.3.0", "pending": "v2.3.1", "fallback": "v2.3.0" }
  }

启动时加载决策：
  1. 读 manifest.json
  2. 有 pending 版本？→ 尝试加载 pending
  3. 加载成功 → pending 变成 current，删除旧版本
  4. 加载失败 / crash → 回退到 fallback 版本
  5. fallback 也失败 → 加载 APK 内置的 builtin 版本（兜底）
```

---

## Q7: Hermes 是什么 为什么用

**Q：为什么用 Hermes 而不是直接用 JSC？.hbc 文件是什么？**

```
Hermes = Meta 专为 RN 开发的 JS 引擎（替代 JavaScriptCore）

.hbc = Hermes Bytecode（预编译的字节码文件）

为什么用：
  - 启动快：.hbc 是 AOT 编译产物，加载时不需要 parse + compile
    JSC：加载 JS 文本 → parse AST → compile → 执行（慢）
    Hermes：加载 .hbc → 直接执行字节码（跳过 parse/compile）
  - 内存占用低：~30% less（针对移动端优化）
  - 包体小：Hermes 引擎本身比 JSC 小

性能对比（冷启动）：
  JSC：JS 加载 + parse + compile ≈ 1-3s（大 Bundle）
  Hermes：.hbc 加载 + 直接执行 ≈ 200-500ms

构建流程：
  Metro bundle → .js 文件 → hermes compile → .hbc 文件
  = AOT（Ahead-Of-Time）编译，把运行时开销移到构建时
```

---

## Q8: RN New Architecture 你了解多少

**Q：XRN 基于 New Architecture（0.85），和旧架构的区别？对分 Bundle 有什么影响？**

```
旧架构（Bridge）：
  JS ←→ Bridge（JSON 序列化）←→ Native
  问题：所有通信走 Bridge，异步序列化，有延迟

新架构（3 个核心改变）：
  1. JSI（JavaScript Interface）：
     JS 直接调用 Native 方法（C++ 层，无序列化）
     = 同步调用，零开销通信

  2. TurboModules：
     Native Module 按需加载（懒初始化）
     旧架构所有 NativeModule 启动时全部初始化 → 慢
     TurboModules 第一次调用时才初始化 → 启动快

  3. Fabric（新渲染器）：
     JS 直接操作 Shadow Tree（C++ 层）
     不再通过 Bridge 传 UI 操作 → 渲染更快、支持同步布局

对分 Bundle 的影响：
  - 利好：TurboModules 按需加载 = 和分 Bundle 理念一致
  - 注意：JSI 是 C++ 层，多 Bundle 共享同一个 JSI Runtime（不冲突）
  - Fabric 渲染：Business Bundle 注册的组件通过同一个 Fabric 渲染管线渲染
  - 本质上新架构让多 Bundle 更自然（共享 Runtime，按需注册）
```

---

## Q9: 性能监控怎么做（Native 侧）

**Q：RN App 的性能监控，Native 侧采集什么？怎么采集？**

```
Android 侧：
  | 指标 | 采集方式 |
  |------|---------|
  | FPS/帧率 | Choreographer.FrameCallback（每帧回调，算掉帧率） |
  | ANR | 主线程 Watchdog（post 延迟消息，超时 = ANR） |
  | Crash | Thread.setUncaughtExceptionHandler（Java 层）+ Signal Handler（Native 层） |
  | 内存 | Debug.getMemoryInfo()（PSS/Java Heap/Native Heap） |
  | 启动时间 | ContentProvider.onCreate → 首帧渲染完成的时间差 |

iOS 侧：
  | 指标 | 采集方式 |
  |------|---------|
  | FPS/帧率 | CADisplayLink（每帧回调，统计掉帧） |
  | 卡顿 | RunLoop Observer（主线程卡顿检测） |
  | Crash | PLCrashReporter / NSSetUncaughtExceptionHandler |
  | 内存 | task_info (MACH_TASK_BASIC_INFO)（resident size） |
  | 启动时间 | main() → viewDidAppear 的时间差 |

RN 特有：
  | 指标 | 采集方式 |
  |------|---------|
  | JS Error | global.ErrorUtils.setGlobalHandler |
  | Bridge 通信耗时 | MessageQueue spy（hook 每次 Bridge 调用） |
  | Bundle 加载时间 | loadBundle 前后打点 |
  | 首屏渲染时间 | Native 侧 ReactMarker（CONTENT_APPEARED 事件） |
```

---

## Q10: 和 CodePush 的区别

**Q：为什么不直接用 CodePush？XRN 的价值在哪？**

| | CodePush | XRN |
|--|---------|-----|
| 分 Bundle | ❌ 只能整包更新 | ✅ 每个模块独立更新 |
| 灰度维度 | 只有按比例 | 多维度（用户/设备/地区/版本） |
| 差量更新 | ✅ 有 | ✅ 有（bsdiff） |
| 自动回滚 | ❌ 手动 | ✅ crash 率触发自动回滚 |
| 自建可控 | ❌ 微软云服务 | ✅ 自部署，数据不出境 |
| CLI 全链路 | ❌ | ✅ create/build/publish/status |
| 多团队协作 | ❌ 单 Bundle 耦合 | ✅ 各模块独立开发/发版 |

**一句话**：CodePush 是"单 Bundle 热更新工具"，XRN 是"分 Bundle + 热更新 + 灰度 + 回滚 + CLI 的完整工程化方案"。CodePush 解决不了多团队独立发版的问题。

---
