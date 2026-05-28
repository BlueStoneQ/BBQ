# 快应用框架项目讲解

> 一句话本质：**在 Android 系统层实现了一个跨端应用运行时——让前端代码（HTML/CSS/JS）直接渲染成 Native View，绕过 WebView，达到接近原生的性能。**

---

## 目录

- [一、项目是什么](#一项目是什么)
- [二、为什么要做这个](#二为什么要做这个)
- [三、架构全局观](#三架构全局观)
- [四、核心技术栈](#四核心技术栈)
- [五、我做了什么](#五我做了什么)
- [六、关键技术深度](#六关键技术深度)
- [七、面试表达建议](#七面试表达建议)

---

## 一、项目是什么

> 本质：一个嵌入 Android 系统的**轻量级跨端应用引擎**，类似微信小程序的系统级实现。

快应用框架（com.miui.hybrid）是小米手机系统内置的应用运行时引擎。它让开发者用前端技术栈（类 Vue 语法）开发应用，框架负责将前端代码编译、分发、渲染成 Native UI。

**类比理解**：
| 概念 | 微信小程序 | 快应用 |
|------|-----------|--------|
| 宿主 | 微信 App | 手机系统（Launcher/负一屏/搜索） |
| 运行时 | 微信内核 | 快应用引擎（系统内置） |
| 渲染方式 | WebView + 部分 Native | 纯 Native View |
| 分发方式 | 微信内搜索/分享 | 系统级入口（桌面/负一屏/全局搜索） |
| 包格式 | .wxapkg | .rpk |

**和 React Native 的关系**：
- 思路一致：JS 逻辑层 + Native 渲染层，通过 Bridge 通信
- 区别：快应用是系统级预装，不需要用户安装宿主 App；DSL 是类 Vue 而非 React

---

## 二、为什么要做这个

> 本质：手机厂商需要一个**不依赖第三方 App 的轻量应用生态**，抢占用户触达入口。

1. **用户侧**：免安装、秒开、体积小（rpk 包通常 < 1MB）
2. **厂商侧**：掌握应用分发入口（不依赖应用商店），提升系统服务能力
3. **开发者侧**：一次开发多厂商运行（快应用联盟：小米/华为/OPPO/vivo）

---

## 三、架构全局观

> 本质：经典的**三层架构**——JS 逻辑层 / Bridge 通信层 / Native 渲染层，外加包管理和分发系统。

```
┌─────────────────────────────────────────────────────┐
│                   系统入口层                          │
│  桌面 | 负一屏 | 全局搜索 | 通知栏 | 智能助理        │
└──────────────────────┬──────────────────────────────┘
                       │ Intent/ContentProvider
┌──────────────────────▼──────────────────────────────┐
│              分发与生命周期管理层                      │
│  VendorDispatcherActivity | EntranceController      │
│  包管理(CacheStorage) | 云控策略 | 权限管理           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                 JS 运行时层                           │
│  QuickJS/V8 引擎 | JS Framework | MVVM 数据绑定     │
│  模块系统(Feature/Module) | 事件系统                  │
└──────────────────────┬──────────────────────────────┘
                       │ JsBridge (JNI)
┌──────────────────────▼──────────────────────────────┐
│                Native 渲染层                         │
│  VDom → RenderAction → Native View Tree             │
│  自定义组件(Text/Image/List/Tabs/...)               │
│  布局引擎(Yoga/Flexbox) | 样式系统                   │
└─────────────────────────────────────────────────────┘
```

### 关键数据流

```
开发者写 .ux 文件（类 Vue 单文件组件）
  → hap-toolkit 编译成 JS Bundle（打包为 .rpk）
  → 用户触发（点击/搜索/推送）
  → 引擎加载 rpk，启动 JS 运行时
  → JS 执行，生成 VDom
  → VDom diff → RenderAction 指令
  → Bridge 传递到 Native 层
  → Native 创建/更新 Android View
  → 屏幕渲染
```

---

## 四、核心技术栈

> 本质：**JS 引擎 + JNI Bridge + 自定义 Native View 体系**，这三块构成了跨端渲染的核心。

### 4.1 JS 引擎（逻辑层）

| 引擎 | 说明 |
|------|------|
| QuickJS | 轻量级 JS 引擎，启动快，内存小，当前默认 |
| V8 | 高性能，可选配置 |

JS 引擎运行在独立线程，通过 JNI 和 Native 层通信。

### 4.2 Bridge 通信（连接层）

```
JS 层                    Native 层
  │                        │
  │  callNative(action)    │
  │ ──────────────────→    │  处理渲染指令/Feature调用
  │                        │
  │  callJs(callback)      │
  │ ←──────────────────    │  回调结果
  │                        │
```

- 通信方式：JNI 直调（同进程）
- 数据格式：J2V8 直接对象传递（V8Object/V8Array），无需 JSON 序列化，比 RN 早期的 JSON Bridge 更高效
- 性能关键：批量合并渲染指令，减少 Bridge 调用次数

### 4.3 Native 渲染（渲染层）

- **布局**：Yoga（Facebook 的 Flexbox 实现），C++ 计算布局
- **组件**：自定义 Android View（Text、Image、List、Tabs、Video 等 50+ 组件）
- **样式**：CSS 子集，运行时解析应用到 View 属性
- **列表**：RecyclerView 复用机制，支持无限滚动

### 4.4 包管理与分发

- **rpk 格式**：zip 压缩包，含 JS Bundle + 资源 + manifest.json + 签名
- **安装**：通过 RemoteInstallService（Bound Service）安装到引擎数据目录
- **更新**：支持增量更新、子包加载
- **签名验证**：RSA 签名，防篡改

---

## 五、我做了什么

> 本质：**系统级应用的性能优化 + 预装合规 + 工具链建设**。

### 5.1 预装合规优化

手机厂商预装应用有严格的体积和内存限制。我负责让快应用框架达到预装标准：

| 维度 | 合规线 | 优化前 | 优化后 | 手段 |
|------|--------|--------|--------|------|
| 包体 | 62MB | 163MB | 58MB | 条件编译排除模块、资源精简、proguard、DEX Layout |
| 内存 | 37.3MB | 43MB | 41MB（进行中） | Baseline Profile、延迟初始化 |

### 5.2 内存优化（深度排查）

**问题**：冷启动 PSS 峰值超标，dex mmap 占 50%。

**排查过程**：
1. 通过 dumpsys meminfo 定位到 dex mmap 是主要开销
2. 通过 smaps 分析确认是 DEX 文件页面加载过多
3. 通过 profman 采集运行时 Profile，发现 Baseline Profile 覆盖率不足（5088 vs 73000 方法）
4. 重新采集 Profile 并更新，预期通过 DEX Layout Optimization 降低冷启动页面加载

**技术深度**：
- 理解 ART 的 DEX 加载机制（mmap + page fault）
- 理解 Baseline Profile → DEX Layout Optimization 的链路
- 理解 AOT/JIT/Interpret 三种执行模式对内存的影响

### 5.3 包体优化

从 163MB 优化到 58MB（-64%），核心手段：
- **条件编译**（buildForRom）：排除非必要模块（游戏引擎 61MB、声网 25MB、凡泰 15MB）
- **资源精简**：resConfigs 限制 16 种语言 + shrinkResources
- **代码精简**：proguard 严格混淆 + 删除冗余依赖
- **DEX 优化**：DEX Layout Optimization 重排热方法

### 5.4 智慧卡片调试器（工具链）

设计了卡片调试器的技术方案：
- 调试器与宿主融合（AAR module 化）
- 卡片发布到真实场景（桌面/负一屏）的跨进程通信方案
- 涉及 ContentProvider、Broadcast、AppWidget、Card SDK 等 Android 组件间通信

---

## 六、关键技术深度

> 这部分是高价值区域——展示对跨端框架核心设计的理解深度。

### 6.1 渲染流：从 .ux 模板到 Native View

> 本质：**编译时模板 → 运行时 VDom → Native View** 的三级管线。

```
.ux 文件 → hap-compiler(parse5) → JSON 模板树($app_template$)
  → webpack 打包为 JS Bundle → rpk

运行时：
V8 执行 JS → DSL 解析 template → 构建 VDom
  → Listener 将 DOM 操作封装为 Action（addElement/updateAttrs/...）
  → Streamer 批量缓冲（阈值 50 条）
  → callNative(JSON) 跨 V8 边界
  → RenderActionManager → IO 线程 JSON 解析
  → RenderActionParser 解析为 VDomChangeAction
  → VDomActionApplier 应用到真实 View 树
  → ComponentFactory 查 Widget 注册表 → new Text/Image/List...
  → Android ViewGroup.addView() → 屏幕渲染
```

**关键设计决策**：
1. **Action 批量发送**：Streamer 以 50 条为阈值，减少 V8↔Java 跨 Bridge 调用
2. **异步渲染管线**：JSON 解析在 IO 线程，不阻塞 UI 线程
3. **组件注册表**：`@WidgetAnnotation` 注解 + 编译时代码生成，tagName → Widget 类映射

### 6.2 Bridge 通信：Feature 调用全链路

> 本质：**回调 ID 映射机制**——函数引用不跨 V8 边界，只传 JSON 数据 + 数字 ID。

```
JS: device.getInfo({ success, fail })
  → invokeNative() 提取回调存入 _callbacks[cbId]
  → JsBridge.invoke("system.device", "getInfo", params, cbId)
  → V8 JNI 直调 Java（J2V8，零序列化）

Native: ExtensionManager.invoke()
  → FeatureBridge.getExtension("system.device") → Device.java
  → Device.getInfo() 收集 Build.BRAND/MODEL/...
  → request.getCallback().callback(response)
  → JsThread.postExecuteFunction("execInvokeCallback", {cbId, data})

JS: execInvokeCallback(event)
  → _callbacks[cbId](data) → success({brand:"Xiaomi",...})
```

**与 RN JSI 的对比**：
- 快应用用 J2V8（V8 的 Java 绑定），RN 用 C++ JSI
- 都是直接函数调用，不走 URL Schema 或 JSON 序列化
- 快应用多一层 JNI（Java↔C++），RN 的 JSI 是纯 C++↔JS

**线程模型**：
- JS 线程：V8 单线程执行所有 JS
- UI 线程：View 创建和渲染
- IO 线程池：JSON 解析、异步 Feature 执行
- JS→Native 同步调用；Native→JS 通过 Handler 异步投递

### 6.3 包管理：RPK 加载流程

> 本质：rpk = 带签名的 zip（JS Bundle + manifest + 资源），加载流程类似浏览器加载网页。

```
用户触发 → CacheStorage 检查本地缓存
  → 无缓存则下载/安装（RemoteInstallService）
  → 签名校验（RSA）
  → zip 解压到私有目录
  → 解析 manifest.json → AppInfo
  → 创建 JS 线程 + 加载 infras.js
  → 执行 app.js（$app_bootstrap$）
  → 加载页面 JS（$app_define$）
  → 渲染流启动
```

### 6.4 内存优化方法论（实战）

> 本质：系统预装应用的冷启动 PSS 优化 = 减少 DEX 页面加载量。

**Android 进程内存组成**：
```
TOTAL PSS = Java Heap + Native Heap + Code(.dex/.so/.oat) + Stack + System
```

**DEX mmap 优化原理**：
- DEX 通过 mmap 映射，按 4KB 页按需加载
- 冷启动时方法分散 → page fault 多 → PSS 高
- Baseline Profile 标记启动热方法 → DEX Layout Optimization 物理重排
- 冷启动只加载前几页 → PSS 降低

**实际数据**：
- 原 Profile 5088 条方法，覆盖率不足
- 运行时采集 32189 条方法（Fresco/Glide/render/widgets 全覆盖）
- 预期降低 dex mmap 1-3MB（从 19.9MB 降到 17-18MB）

### 6.5 系统级应用的特殊性

| 维度 | 普通 App | 系统预装应用 |
|------|---------|------------|
| 安装位置 | /data/app/ | /product/app/（只读） |
| 签名 | 开发者签名 | platform key |
| 进程启动 | 用户主动打开 | ContentProvider 查询触发 |
| 更新方式 | 应用商店 | 刷 ROM |
| 内存要求 | 无硬性限制 | 合规线 37.3MB |
| 测试方式 | 手动测试 | 6 小时老化测试（1000+ 用例） |

---

## 七、核心问答

### Q: 项目一句话描述？

Android 系统内置的跨端应用引擎，前端代码直接渲染成 Native View，免安装秒开。

### Q: 和 RN 的区别？

系统级预装，不需要宿主 App；DSL 是类 Vue；有系统级分发入口（桌面/负一屏/搜索）。通信层用 J2V8 直接对象传递，不走 JSON 序列化。

### Q: 你做的优化本质是什么？

包体：条件编译排除非必要模块（163MB → 58MB）。内存：通过 Baseline Profile 优化 DEX 物理布局，减少冷启动时的 page fault（dex mmap 占 PSS 50%）。

### Q: Bridge 通信怎么优化的？

批量合并渲染指令，多个 DOM 操作不逐个过 Bridge，而是合并成一批一次性传递。类似 React batch update。
