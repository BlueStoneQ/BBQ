# Android 进阶认知（快应用框架深度追问准备）

> 聚焦快应用框架项目中会被深追问的硬核知识点。
> 不讲基础概念，直接讲原理、机制、trade-off。

## 目录

- [一、V8 在 Android 中的集成架构](#一v8-在-android-中的集成架构)
- [二、JNI 的性能开销与优化](#二jni-的性能开销与优化)
- [三、Android ClassLoader 机制与模块隔离](#三android-classloader-机制与模块隔离)
- [四、R8 深度：全程序分析 vs 模块独立混淆](#四r8-深度全程序分析-vs-模块独立混淆)
- [五、DEX Layout Optimization 原理](#五dex-layout-optimization-原理)
- [六、Android 进程模型与内存管理](#六android-进程模型与内存管理)
- [七、Gradle 构建深度：Task DAG 与增量编译](#七gradle-构建深度task-dag-与增量编译)
- [八、consumerProguardFiles 传递机制详解](#八consumerproguardfiles-传递机制详解)
- [九、跨端框架渲染管线对比](#九跨端框架渲染管线对比)
- [十、预装应用的特殊约束](#十预装应用的特殊约束)

---

## 一、V8 在 Android 中的集成架构

### V8 的嵌入模式

V8 不是一个独立进程，而是作为 .so 库嵌入到 App 进程中。快应用框架的 V8 集成：

```
App 进程
├── UI Thread（Android 主线程）
│   └── Android View 树
├── JS Thread（独立线程）
│   └── V8 Isolate（V8 实例）
│       ├── V8 Context（执行上下文）
│       ├── V8 Heap（JS 对象堆）
│       └── JNI 注册的 Native 方法
└── IO Thread Pool
    └── 异步 Feature 执行
```

### V8 Isolate vs Context

| 概念 | 说明 | 类比 |
|------|------|------|
| Isolate | V8 的独立实例，有自己的堆和 GC | 一个独立的 Node.js 进程 |
| Context | 执行上下文，全局对象和内置函数 | 一个 iframe 的 window |

一个 Isolate 可以有多个 Context（多页面隔离），但同一时刻只有一个线程能进入一个 Isolate（V8 不是线程安全的）。

### J2V8 的实现原理

```
Java 层                    JNI 层                    C++ 层（V8）
─────────                  ─────────                 ─────────
V8 runtime = V8.create()   → JNI_CreateRuntime()     → v8::Isolate::New()
runtime.executeScript(js)  → JNI_ExecuteScript()     → v8::Script::Compile() + Run()
runtime.registerJavaMethod → JNI_RegisterCallback()  → v8::FunctionTemplate::New()
```

J2V8 的"同步"指的是：JS 调用注册的 Java 方法时，V8 通过 JNI 直接调用 Java 代码，**不切换线程**，调用栈是连续的：

```
JS 调用 nativeMethod()
  → V8 内部查找 FunctionTemplate
  → 通过 JNI 调用 Java 的 JavaCallback.invoke()
  → Java 方法执行完毕，返回值通过 JNI 传回 V8
  → JS 拿到返回值，继续执行
```

整个过程在 JS Thread 上同步完成，没有线程切换、没有消息队列、没有序列化。

### 内存管理的挑战

V8 有自己的 GC（Orinoco），Java 有自己的 GC（ART GC）。两个 GC 互不知道对方的存在：

- V8 GC 不知道 Java 对象还在引用某个 V8 对象 → 可能误回收
- Java GC 不知道 V8 还在引用某个 Java 对象 → 可能误回收

解决方案：J2V8 用引用计数 + release() 手动管理跨语言引用。忘记 release() = 内存泄漏。

---

## 二、JNI 的性能开销与优化

### JNI 调用的开销来源

每次 JNI 调用不是简单的函数调用，有额外开销：

1. **线程状态切换**：从 Java 代码进入 Native 代码，ART 需要切换线程状态（GC 安全点）
2. **参数转换**：Java 对象 → JNI 引用（jobject），基本类型直接传
3. **异常检查**：每次 JNI 调用后需要检查是否有 Java 异常
4. **引用管理**：Local Reference 有数量限制（默认 512），需要手动 DeleteLocalRef

### 优化策略

| 策略 | 说明 |
|------|------|
| 批量调用 | 不要频繁跨 JNI 边界，攒一批数据一次传 |
| 缓存 FieldID/MethodID | FindClass/GetMethodID 很慢，缓存起来复用 |
| 直接 ByteBuffer | 大数据用 DirectByteBuffer 共享内存，避免拷贝 |
| Critical Native | 简单方法用 @CriticalNative 注解，跳过部分检查 |

### 快应用框架的 Bridge 优化

快应用框架选 J2V8 同步 Bridge 而不是消息队列异步 Bridge，就是为了避免：
- 消息序列化/反序列化开销（JSON.stringify/parse）
- 跨线程消息传递延迟
- 消息队列排队等待

代价是：JS Thread 和 Native 代码耦合在同一个线程，Native 方法如果阻塞会卡住 JS 执行。所以耗时操作必须走 IO Thread Pool 异步执行。

---

## 三、Android ClassLoader 机制与模块隔离

### 类加载链

```
BootClassLoader（系统核心类：java.lang.*）
    ↓
PathClassLoader（App 自己的类：从 APK 的 dex 加载）
    ↓
DexClassLoader（动态加载：从外部 dex/apk 加载）
```

### 为什么理解 ClassLoader 很重要

1. **R8 裁剪的本质**：R8 分析哪些类会被 ClassLoader 加载到，没被引用的就删掉
2. **反射的风险**：`Class.forName("xxx")` 绕过了编译时检查，R8 不知道这个类会被用到，可能误删
3. **插件化的原理**：自定义 ClassLoader 加载外部 APK 里的类
4. **你的模块裁剪方案**：用反射加载凡泰模块，buildForRom=true 时模块不存在，反射返回 null，走降级逻辑

### consumerProguardFiles 和 ClassLoader 的关系

R8 在做全程序分析时，从入口点（Activity/Service/BroadcastReceiver）开始，沿着引用链标记所有可达的类。`-keep` 规则相当于额外的入口点——告诉 R8 "这些类虽然没有被直接引用，但运行时会被 ClassLoader 加载（通过反射/序列化等）"。

宽泛的 keep 规则（`-keep class * { *; }`）= 告诉 R8 所有类都是入口点 = 什么都不能删。

---

## 四、R8 深度：全程序分析 vs 模块独立混淆

### 为什么 minifyEnabled 只在 app 模块开启

```
方案 A：每个 module 独立开启 minifyEnabled
  module-a 混淆 → 产出 AAR（已混淆）
  module-b 混淆 → 产出 AAR（已混淆）
  app 混淆 → 但看不到 module 内部的引用关系 → 无法跨模块优化

方案 B：只在 app 模块开启 minifyEnabled（你的方案）
  module-a 不混淆 → 产出 AAR（原始代码）
  module-b 不混淆 → 产出 AAR（原始代码）
  app 混淆 → R8 看到所有代码 → 全程序分析 → 跨模块优化
```

方案 B 效果更好，因为 R8 能做：
- 跨模块的死代码消除（module-a 里的方法只被 module-b 调用，但 module-b 的调用者被删了 → 这个方法也能删）
- 跨模块的方法内联
- 全局的类合并（多个只有一个方法的类合并成一个）

### R8 的分析流程

```
1. 确定入口点（Entry Points）
   - AndroidManifest.xml 里声明的组件（Activity/Service/Receiver/Provider）
   - -keep 规则指定的类
   - consumerProguardFiles 传递的规则

2. 从入口点开始，构建引用图（Reference Graph）
   - 方法调用 → 标记被调用的方法
   - 字段访问 → 标记被访问的字段
   - 类实例化 → 标记被实例化的类
   - 反射调用 → 如果能静态分析出来就标记，否则需要 -keep

3. 未被标记的 = 死代码 → 删除（Shrinking）

4. 剩余代码 → 重命名（Obfuscation）→ 优化（Optimization）

5. 输出 dex
```

### seeds.txt / usage.txt / mapping.txt

| 文件 | 内容 | 用途 |
|------|------|------|
| seeds.txt | 所有被 keep 的类/方法 | 排查"为什么没被删" |
| usage.txt | 所有被删除的类/方法 | 确认删了什么 |
| mapping.txt | 混淆前后的名称映射 | 线上 crash 堆栈还原 |

你排查 consumerProguardFiles 问题时，就是看 seeds.txt 发现 56 万+ keep 条目才定位到问题的。

---

## 五、DEX Layout Optimization 原理

### 问题

App 启动时，ART 需要加载 dex 文件。dex 通过 mmap 映射到内存，但不是全部加载——按页（4KB）按需加载。

启动时访问的代码分散在 dex 的各个位置 → 触发大量 page fault → 磁盘 IO → 启动慢 + 内存占用高。

### 解决方案：Baseline Profile + DEX Layout

```
1. 收集启动时实际执行的方法列表（Baseline Profile）
   - 通过 Perfetto trace / ART profiling 采集
   - 产出：哪些类/方法在启动阶段被调用

2. 重排 dex 布局
   - 把启动阶段用到的方法集中排列在 dex 文件的前几页
   - 冷代码（启动后才用到的）排到后面

3. 效果
   - 启动时只需要加载前几页 → page fault 减少
   - 冷代码的页不会被加载到内存 → PSS 降低
```

### 类比前端

类似前端的 Code Splitting + Preload：
- 把首屏需要的代码放在第一个 chunk（优先加载）
- 非首屏代码懒加载

DEX Layout Optimization 做的是同一件事，只是粒度是"内存页"而不是"JS chunk"。

### 你的项目里怎么做的

```
1. 使用 ART Profile（或手动指定热方法列表）
2. 在 R8 编译阶段传入 profile 文件
3. R8 根据 profile 重排 dex 中方法的物理位置
4. 产出的 dex 启动相关代码集中在前几页
```

PSS MAX 41MB → 35.8MB 的收益主要来自：冷代码页不再被 mmap 加载到物理内存。

---

## 六、Android 进程模型与内存管理

### 进程优先级

Android 按进程重要性分级，内存不足时从低优先级开始杀：

```
前台进程（用户正在交互）→ 几乎不会被杀
可见进程（可见但不在前台）→ 很少被杀
服务进程（后台 Service）→ 可能被杀
缓存进程（后台 Activity）→ 随时可能被杀
空进程 → 最先被杀
```

快应用框架作为系统预装应用，通常运行在独立进程中，优先级取决于是否有前台页面。

### PSS / RSS / USS

| 指标 | 含义 | 特点 |
|------|------|------|
| VSS | 虚拟内存（包含未分配的） | 最大，参考价值低 |
| RSS | 常驻内存（包含共享库） | 偏大（共享库被多个进程共享但各自计入） |
| **PSS** | 按比例分摊共享内存 | **最常用**，公平反映进程真实占用 |
| USS | 独占内存（不含共享） | 最小，进程被杀后能释放的量 |

你的优化目标是 PSS MAX < 37.3MB，因为 PSS 是系统合规审查的标准指标。

### mmap 与 dex 内存

dex 文件通过 mmap 映射到进程地址空间：
- 文件内容不会全部加载到物理内存
- 访问到哪一页，才触发 page fault 把那一页从磁盘加载到内存
- 长时间不访问的页可能被系统回收（page out）

所以 dex 越大 ≠ 内存占用越大，但 dex 越大 → 启动时需要访问的页越分散 → page fault 越多 → 加载到内存的页越多 → PSS 越高。

DEX Layout Optimization 的本质：减少启动时的 page fault 数量。

---

## 七、Gradle 构建深度：Task DAG 与增量编译

### Task DAG

Gradle 构建不是线性执行的，而是构建一个有向无环图（DAG），按依赖关系并行执行：

```
:app:preBuild
    ↓
:module-a:compileJava  ←→  :module-b:compileJava  （并行）
    ↓                          ↓
:app:mergeClasses
    ↓
:app:minifyReleaseWithR8
    ↓
:app:packageRelease
    ↓
:app:assembleRelease
```

### 增量编译

Gradle 通过 input/output 标记实现增量：
- 如果 Task 的 input 没变，output 直接复用缓存（UP-TO-DATE）
- 只有 input 变了的 Task 才重新执行

这就是为什么第二次构建比第一次快很多。

### 你的 CI/CD 构建修复可能涉及的问题

- 缓存失效：CI 环境每次是干净的，没有增量缓存 → 构建慢
- 依赖下载：CI 网络环境不同，Maven 仓库可能不通
- NDK 版本：CI 机器的 NDK 版本和本地不一致 → so 编译失败
- Node.js 版本：快应用框架可能有 Node.js 相关的构建步骤

---

## 八、consumerProguardFiles 传递机制详解

### 传递链路

```
library module 的 build.gradle:
  consumerProguardFiles 'proguard-rules.pro'
      ↓
library 打包成 AAR 时，proguard-rules.pro 被打包进 AAR
      ↓
app module 依赖这个 AAR
      ↓
app 的 R8 编译时，自动合并所有依赖 AAR 里的 proguard 规则
      ↓
合并后的规则 = app 自己的规则 + 所有依赖的 consumer 规则
```

### 为什么这个机制存在

库的作者比使用者更清楚哪些类不能被混淆（比如通过反射调用的类、JNI 方法、序列化类）。通过 consumerProguardFiles，库可以"自带"自己的 keep 规则，使用者不需要手动配置。

### 为什么会出问题

如果库的 proguard-rules.pro 写了宽泛规则：
```
-keep public class * { *; }
```

这条规则会通过 consumer 机制传递给 app，导致 app 的 R8 保留所有 public 类 → 几乎不裁剪。

### 排查方法

```bash
# 1. 查看最终合并的规则
# 构建后在 app/build/intermediates/proguard-files/ 下

# 2. 查看 seeds.txt（被 keep 的类）
# app/build/outputs/mapping/release/seeds.txt

# 3. 定位哪个模块贡献了宽泛规则
# 逐个检查依赖模块的 build.gradle 里的 consumerProguardFiles
# 再看对应的 proguard-rules.pro 内容
```

---

## 九、跨端框架渲染管线对比

### 三种主流方案

| | WebView | 原生渲染（RN/快应用） | 自绘引擎（Flutter） |
|---|---|---|---|
| 渲染层 | WebKit/Blink | 平台原生 View | Skia 自绘 |
| 布局 | CSS Box Model | Yoga (Flexbox) / 平台布局 | 自己的布局引擎 |
| JS 引擎 | WebView 内置 | V8/Hermes/JSC | Dart VM |
| Bridge | JS → WebView API | JS → Native（JNI/JSI） | 无（Dart 直接调 Skia） |
| 性能 | 最差（双重渲染） | 中等（Bridge 开销） | 最好（无 Bridge） |
| 一致性 | 最好（Web 标准） | 中等（平台差异） | 最好（自绘一致） |
| 生态 | Web 生态 | 部分 Web 生态 | Dart 生态（较小） |
| 包体 | 小（系统自带 WebView） | 中（需要 JS 引擎 + Bridge） | 大（Skia 引擎 ~4MB） |

### 快应用框架的选择：原生渲染

```
JS 业务代码
    ↓ V8 执行
虚拟 DOM diff → 生成渲染指令（JSON）
    ↓ J2V8 Bridge
IO Thread 解析渲染指令
    ↓
UI Thread 创建/更新 Android View
```

**为什么不用 WebView**：性能差，系统预装应用对性能要求高。
**为什么不用 Flutter**：Dart 生态小，快应用标准要求 JS 开发，且 Skia 引擎增加包体。
**为什么选原生渲染**：性能好（原生 View），开发者用 JS（生态大），包体可控。

### 和 RN 新架构的对比

| | 快应用框架 | RN 新架构（Fabric + JSI） |
|---|---|---|
| JS 引擎 | V8（通过 J2V8） | Hermes（通过 JSI） |
| Bridge 方式 | J2V8 同步调用 | JSI 同步调用 |
| 渲染 | Android View | Android View |
| 布局 | 自定义（非 Yoga） | Yoga (Flexbox) |
| 线程模型 | 三线程 | 三线程（JS/UI/Background） |

本质上是同一代架构——都是"同步 Bridge + 原生渲染"。

---

## 十、预装应用的特殊约束

### 和普通 App 的区别

| 约束 | 普通 App | 预装应用 |
|------|---------|---------|
| 包体限制 | 相对宽松（100MB+） | 极严格（影响 ROM 大小，每 MB 都要审批） |
| 签名 | 开发者 keystore | 系统 platform key |
| 权限 | 需要用户授权 | 可以拥有系统级权限 |
| 卸载 | 用户可卸载 | 不可卸载（/system/app/） |
| 更新 | 商店推送 | OTA / 自升级 |
| 稳定性 | crash 影响单个 App | crash 可能影响系统稳定性 |
| 内存 | 被杀就被杀 | 合规审查有 PSS 上限 |
| 启动 | 用户主动打开 | 可能开机自启 |

### 这些约束如何影响你的技术决策

1. **包体严格** → 必须做 R8 + 模块裁剪 + 资源裁剪（153MB→60MB）
2. **不可卸载** → 裁剪掉的功能必须有降级方案（自升级兜底）
3. **PSS 上限** → 必须做 DEX Layout Optimization + 内存优化
4. **系统稳定性** → 不能用插件化（Hook 系统 API 有风险）
5. **OTA 更新慢** → 自升级机制让用户不等 OTA 也能恢复完整功能
