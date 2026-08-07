# Tasks Document

## 目录

- [Overview](#overview)
- [设计导向：两条主线与一层基础设施](#设计导向两条主线与一层基础设施)
- [开发原则：Android NDK 优先](#开发原则android-ndk-优先)
- [Phase 1：Android NDK 与通信主链路](#phase-1android-ndk-与通信主链路)
  - [Task 1.1：Android 宿主与 NDK 构建骨架](#task-11android-宿主与-ndk-构建骨架)
  - [Task 1.2：PlatformBridge 与 JNI 最小闭环](#task-12platformbridge-与-jni-最小闭环)
  - [Task 1.3：JSEngine Interface 与 QuickJS 实现](#task-13jsengine-interface-与-quickjs-实现)
  - [Task 1.4：Runtime EventLoop 与线程模型](#task-14runtime-eventloop-与线程模型)
  - [Task 1.5：JS Bridge 核心实现](#task-15js-bridge-核心实现)
- [Phase 2：RPK 加载与 JS 执行](#phase-2rpk-加载与-js-执行)
  - [Task 2.1：RPKLoader 与 ManifestParser](#task-21rpkloader-与-manifestparser)
  - [Task 2.2：JS Framework 与 VM 模型](#task-22js-framework-与-vm-模型)
  - [Task 2.3：页面 Bundle 加载与启动](#task-23页面-bundle-加载与启动)
- [Phase 3：渲染、交互与系统能力](#phase-3渲染交互与系统能力)
  - [Task 3.1：VNode 构建与样式解析](#task-31vnode-构建与样式解析)
  - [Task 3.2：YogaLayout 布局计算](#task-32yogalayout-布局计算)
  - [Task 3.3：Android ViewRenderer](#task-33android-viewrenderer)
  - [Task 3.4：完整渲染管线与事件回调](#task-34完整渲染管线与事件回调)
  - [Task 3.5：Router、Prompt 与 TitleBar](#task-35routerprompt-与-titlebar)
- [Phase 4：端到端验证与 Core 抽取](#phase-4端到端验证与-core-抽取)
  - [Task 4.1：Debug RPK 端到端验证](#task-41debug-rpk-端到端验证)
  - [Task 4.2：Release RPK 兼容性验证](#task-42release-rpk-兼容性验证)
  - [Task 4.3：抽取 quickapp-runtime-core](#task-43抽取-quickapp-runtime-core)
  - [Task 4.4：运行时质量与可观测性验收](#task-44运行时质量与可观测性验收)
- [任务依赖关系](#任务依赖关系)
- [需求覆盖矩阵](#需求覆盖矩阵)

---

## Overview

本文档将 requirements.md 中的 9 个需求分解为 4 个阶段。实现顺序不是“先做纯 C++、再接 Android”，而是先在 Android NDK 环境中打通真实运行链路，再将已经验证过的跨平台 C++ 代码抽取为 `quickapp-runtime-core`。

**当前推进状态：**

```text
Task 1.1：已完成 NDK 编译与 .so 打包验收
Task 1.2：Step 02 源码已实现；静态诊断和差异检查通过，但本机缺少完整 Gradle 9.5 分发且下载连接被拒绝，待联网完成 NDK/Kotlin 构建与设备验收
Task 1.3 及以后：实现待开始；现有 Step 03–13 文档仅为规划参考，不代表对应源码已完成
```

下面的“第一阶段验收目标”是 Phase 1 的最终目标，不代表当前已经完成。

**第一阶段最终验收目标：** 在 Android 模拟器或真机上加载目标 Debug RPK，并完成：

```text
JS Runtime / JS Bridge：
RPK → QuickJS → framework.js → JS Bridge → C++ Core

Render Pipeline：
C++ Core → VNode → Style → Yoga → PlatformBridge/JNI
    → Kotlin ViewRenderer → Android View
```

**工作量估算：**
- Android NDK / JNI / Kotlin：~800 行
- C++ Core：~1500 行
- JS Framework：~400 行
- 总计：~2700 行
- 预估工时：3-4 个工作日（24-32 小时）

签名校验、Widget/Card、热更新、调试协议和动态数据更新不在当前范围内。RPK 中的 `META-INF/CERT` 先不校验。

## 设计导向：两条主线与一层基础设施

### 主线一：JS Runtime / JS Bridge

```text
RPK
  → RPKLoader / ManifestParser
  → QuickJS Engine
  → framework.js / VM Model
  → JS Bridge
  → C++ Core
```

任务重点：加载现有快应用 RPK，执行既有 JS 语义，并通过 QuickJS C API 暴露 Router、Prompt、Render 和后续 Native Capability。

### 主线二：Render Pipeline

```text
JS Framework / C++ Core
  → VNode
  → StyleResolver
  → YogaLayout
  → RenderCommand
  → PlatformBridge
  → JNI / Android UI Dispatcher
  → Kotlin ViewRenderer
  → Android View
```

`PlatformBridge` 归属于渲染管线，负责 C++ → Android 的渲染命令；Android → C++ 的 click/input/lifecycle 通过独立事件通道处理。

### 共同基础设施

```text
RuntimeEventLoop / libuv
Runtime Thread 与 QuickJS 线程所有权
Android UI Dispatcher
RenderCommandQueue / Batch Commit
PlatformEventQueue
Lifecycle / Cancel / Timeout
Capability / Permission
Error / Trace / Metrics
```

EventLoop 不是第三条业务主线，而是 JS Bridge 和 Render Pipeline 的共同调度基础。

### 目标规格

```text
V1：兼容现有快应用 RPK/API，完成初始渲染和基础系统能力
V1.5：EventLoop、事件队列、批量渲染、UI Dispatcher、生命周期治理
V2：Promise Native API、EventEmitter、能力发现、版本协商、权限和扩展模块
```

---

## 开发原则：Android NDK 优先

### 为什么先在 Android NDK 中开发？

目标是尽快证明“标准 RPK 能在 Android 上运行”。Android Studio、Gradle、NDK、LLDB 和模拟器可以同时验证 C++、JNI、Kotlin View 以及真实设备行为，避免先维护一套与最终宿主脱节的纯 C++ Demo。

### 开发目录与产品目录的关系

```text
开发阶段：直接在 Android 工程中实现
quickapp-runtime-android/app/src/main/
├── cpp/
│   ├── core/              ← 先实现跨平台 C++ 逻辑
│   │   ├── include/       ← RuntimeEventLoop、RenderCommand、EventSink 接口
│   │   └── src/
│   ├── platform/common/   ← libuv EventLoop、Runtime Thread 等跨平台适配
│   ├── platform/android/  ← JNI、AssetManager、Android UI Dispatcher
│   └── third_party/       ← QuickJS、libuv、Yoga、ZIP 依赖
├── java/                  ← Runtime 入口、ViewRenderer、Toast
└── assets/                ← 目标 Debug RPK 和 framework.js

抽取阶段：将已验证的 core/ 独立出来
quickapp-runtime-core/
├── include/
├── src/
├── js/
├── platform/
│   ├── common/
│   ├── android/
│   ├── ios/
│   └── lvgl/
└── CMakeLists.txt
```

Android 不是临时 Demo，而是第一阶段的真实宿主；`quickapp-runtime-core` 是验证完成后的工程重组和库化，不是重新实现一套 Core。

---

## Phase 1：Runtime 基础与两条主链路

### Task 1.1：Android 宿主与 NDK 构建骨架

**状态：** 已完成构建验收；运行时加载和 JNI 调用不在本 Task 的已完成范围内。

**需求覆盖：** 需求 9

**目标：** 创建单 APK Android 宿主，在 `app/src/main/cpp` 内建立 Core、Android 平台适配和第三方依赖目录，确保 NDK 能编译并将 `.so` 打包进 APK。

**已完成产出：**
- `quickapp-runtime-android/` Android 工程
- `app/src/main/cpp/CMakeLists.txt`
- `app/src/main/cpp/core/`
- `app/src/main/cpp/platform/android/`
- `libquickapp-runtime-core.so`
- APK 中的 `lib/arm64-v8a/libquickapp-runtime-core.so`

**本 Task 验收：**
- `./gradlew clean build --no-daemon` 成功
- APK 包含 `lib/arm64-v8a/libquickapp-runtime-core.so`

**明确不提前宣称：** `System.loadLibrary`、`JNI_OnLoad` 的设备运行时验证，以及 Kotlin 调用最小 JNI 函数，留到 Step 2 实现并验收。

**工时：** 2 小时

**Step 文档：** `steps/01-android-ndk-skeleton.md`

---

### Task 1.2：PlatformBridge 与 JNI 最小闭环

**状态：** Step 02 源码已实现，静态诊断和差异检查通过；本机 Gradle Wrapper 缺少完整 9.5 分发，下载被拒绝，因此 NDK/Kotlin 构建及设备显示、Logcat 验收待联网环境完成。

**需求覆盖：** 需求 3

**目标：** 先不依赖完整页面，打通 `C++ → PlatformBridge → JNI → Kotlin`，能够由 C++ 发出 `createElement` / `setAttr` 指令并在 Android 容器中创建一个测试 View。

**产出：**
- `core/include/platform_bridge.h`
- `core/src/platform_bridge.cpp`
- `platform/android/jni_bridge.cpp`
- `QuickAppRuntime.kt`：Step 2 的临时 Runtime 宿主和命令处理入口
- `createElement`、`setAttr`、`setStyle` 的 JNI 通道
- Kotlin 容器清空和 View 创建能力

正式的 `ViewRenderer.kt` 将在 Phase 3 的 Task 3.3 中拆出；Step 2 先用 `QuickAppRuntime.kt` 承担最小闭环，避免提前引入完整渲染器抽象。

**验收：** C++ 主动发出一条创建 TextView 的指令，Android 屏幕显示测试文本。

**重要边界：** 这一段不是 JS Bridge；它是 `C++ → Android` 的 PlatformBridge/JNI 渲染命令链路。Android → C++ 的 click/input/lifecycle 使用独立事件通道，留到后续任务。

**工时：** 3 小时

**Step 文档：** `steps/02-platform-bridge-jni.md`

---

### Task 1.3：JSEngine Interface 与 QuickJS 实现

**状态：** 待开始；Step 3 文档将在 Step 2 完成后，按最新 Runtime Thread 设计重新创建。

**需求覆盖：** 需求 2、需求 9

**目标：** 在 Android NDK 中实现可替换的 `JSEngine` 接口，当前接入 QuickJS；完成 JSRuntime、JSContext 创建销毁和脚本执行。

**产出：**
- `core/include/js_engine.h`
- `core/src/quickjs_engine.cpp`
- `createJSEngine()` 工厂
- `eval`、错误读取、生命周期管理
- QuickJS CMake 集成

**验收：** C++ 执行一段 JS，JS 调用一个已注册的测试 Native 函数并返回结果。

**工时：** 3 小时

**Step 文档：** 待创建（Step 2 完成后按最新设计编写）

---

### Task 1.4：Runtime EventLoop 与线程模型

**状态：** 待开始；Step 4 文档将在 JSEngine 设计稳定后重新创建。

**需求覆盖：** 需求 2、需求 3、需求 4、需求 5、需求 6、需求 7、需求 9

**目标：** 建立 QuickJS/C++ Runtime 的统一任务调度模型，明确 Runtime Thread、Android UI Thread、QuickJS Job、平台事件和渲染命令之间的线程边界。使用 `RuntimeEventLoop` 抽象隔离 Core 与具体事件循环实现，第一种实现采用 libuv backend。

**产出：**
- `core/include/runtime_event_loop.h`
- `core/src/runtime_event_loop.cpp`
- `core/include/runtime_thread.h` / `core/src/runtime_thread.cpp`
- `core/include/platform_event_sink.h`
- `core/include/render_command_queue.h`
- `platform/common/libuv_event_loop.h` / `libuv_event_loop.cpp`
- QuickJS `JS_ExecutePendingJob` 的 Microtask 调度
- Runtime Thread 与 Android UI Dispatcher 的线程边界
- EventLoop 停止、取消、超时和 Runtime 销毁协议

**核心线程模型：**

```text
Runtime Thread
  ├─ libuv EventLoop
  ├─ QuickJS JSRuntime / JSContext
  ├─ C++ Core / Router / VNode / Yoga
  ├─ PlatformEventQueue 消费
  └─ RenderCommandBatch 生成
          ↓ UI Dispatcher
Android Main/UI Thread
  └─ ViewRenderer / Android View
```

**验收：**
- QuickJS 只在 Runtime Thread 执行，其他线程不能直接调用 JS API
- Runtime 可以投递一个任务并在 Runtime Thread 执行
- Promise Microtask 能通过 `JS_ExecutePendingJob` 执行
- Timer 能触发并支持取消、超时和 Runtime 销毁时清理
- Android 点击事件能投递到 Runtime Thread
- Runtime 生成的渲染命令能投递到 Android UI Thread
- Runtime 停止后不再接受新任务、不再发送渲染命令、不再调用已释放的 JNI 引用
- libuv loop 不直接操作 Android View

**工时：** 4 小时

**Step 文档：** 待创建（JSEngine 设计稳定后按最新设计编写）

---

### Task 1.5：JS Bridge 核心实现

**状态：** 待开始；Step 5 文档将在 EventLoop 和 JSEngine 完成后重新创建。

**需求覆盖：** 需求 2、需求 3、需求 5、需求 6、需求 9

**目标：** 打通第一条完整的 `JS → C++` 直调链路。使用 QuickJS `JS_NewCFunction` 注入宿主函数，使用 `JS_NewObjectClass` + `JS_SetOpaque` 暴露有状态的 Router、Prompt 模块。所有 JS 调用必须在 Runtime Thread 执行；异步 Native API 通过 RuntimeEventLoop 返回结果。

**产出：**
- `core/include/js_bridge.h`
- `core/src/js_bridge.cpp`
- `$app_define$`、`$app_bootstrap$`、`$app_require$`
- `__native_render__`
- Router JSClass：`push`、`back`
- Prompt JSClass：`showToast`
- C++ → JS 的 `JS_Call` 事件入口
- RuntimeEventLoop 投递和 Promise Job 协作
- 参数校验、QuickJS 异常转换和 Native 日志

**第一条主链路：**

```text
JS: __native_render__(vnode, style)
    ↓ JS_NewCFunction
C++: native_render()
    ↓ PlatformBridge 渲染命令
JNI: android_createElement()
    ↓ UI Dispatcher
Kotlin: ViewRenderer.createElement()
```

**验收：** QuickJS 中执行 `__native_render__`，Android ViewRenderer 能收到 JNI 渲染命令；执行 `router.push` / `showToast` 时能进入对应 C++ 对象；JS 事件和异步结果不会在错误线程执行。

**工时：** 3 小时

**Step 文档：** 待创建（EventLoop 和 JSEngine 完成后按最新设计编写）

---

## Phase 2：RPK 加载与 JS 执行

### Task 2.1：RPKLoader 与 ManifestParser

**需求覆盖：** 需求 1

**目标：** 在 NDK Core 中读取并解压 RPK，解析 `manifest.json`，提供页面路径、display 和 debug 配置。当前跳过 `META-INF/CERT` 签名校验。

**产出：**
- `core/include/rpk_loader.h` / `core/src/rpk_loader.cpp`
- `core/include/manifest_parser.h` / `core/src/manifest_parser.cpp`
- ZIP 条目读取和资源寻址
- Manifest 模型：package、router、display、features、config.debug
- 无效 RPK/Manifest 的错误处理

**验收：** 能读取 `com.example.case1.debug.1.0.0.rpk`，获得入口 `pages/Demo`，并能读取 `app.js` 和页面 bundle。

**工时：** 3 小时

**Step 文档：** 待创建（Phase 1 基础链路完成后编写）

---

### Task 2.2：JS Framework 与 VM 模型

**需求覆盖：** 需求 2、需求 4、需求 7

**目标：** 实现 `framework.js`，在已经打通的 JS Bridge 上完成组件注册、VM 创建、private 数据初始化、函数属性求值和生命周期调用。

**产出：**
- `app/src/main/assets/framework.js` 或 Core 内置 JS 资源
- `$app_define$`、`$app_bootstrap$`、`$app_require$` 协作逻辑
- private → VM 数据模型
- onInit / onShow
- `function() { return this.title }` 属性求值
- `__native_render__` 调用

**验收：** 用一个最小 JS bundle 创建 VM，调用 onInit，并把模板树传给 C++。

**工时：** 3 小时

**Step 文档：** 待创建（Framework/VM 设计完成后编写）

---

### Task 2.3：页面 Bundle 加载与启动

**需求覆盖：** 需求 2、需求 3

**目标：** 按 Manifest 入口加载并执行 `app.js` 和页面 bundle。Runtime 不解析 `.ux`、CSS 或 webpack 模块，而是直接 eval RPK 中已经编译好的 JS。

**产出：**
- `app.js` 执行流程
- `pages/Demo/index.js` 加载流程
- 页面路径到 bundle 文件的映射
- Debug/Release bundle 统一 eval 逻辑
- JavaScript 异常和文件缺失错误处理

**验收：** 页面 bundle 能触发 `$app_define$` 和 `$app_bootstrap$`，并得到页面的 template/style/VM。

**工时：** 2 小时

**Step 文档：** 待创建（页面 Bundle 加载设计完成后编写）

---

## Phase 3：渲染、交互与系统能力

### Task 3.1：VNode 构建与样式解析

**需求覆盖：** 需求 3、需求 4

**目标：** 将 JS template 对象转换为 C++ VNode 树，完成 classList 到样式的匹配合并。

**产出：**
- `core/include/vnode.h` / `core/src/vnode.cpp`
- `core/include/style_resolver.h` / `core/src/style_resolver.cpp`
- div、text、input(button)
- attr、classList、events、children
- 函数属性求值后的值接收

**验收：** Demo 模板能够生成完整 VNode 树，text 节点得到 title，button 节点得到 click 方法名。

**工时：** 3 小时

**Step 文档：** 待创建（Phase 2 页面执行链路完成后编写）

---

### Task 3.2：YogaLayout 布局计算

**需求覆盖：** 需求 3

**目标：** 用 Yoga 计算 VNode 树布局，不实现自绘；输出 Android View 所需的边界和样式数据。

**产出：**
- `core/include/yoga_layout.h` / `core/src/yoga_layout.cpp`
- flexDirection、justifyContent、alignItems
- width、height、margin、padding、borderRadius
- x、y、width、height 布局结果

**验收：** Demo 页面节点得到稳定的布局结果，单位转换策略明确（RPK px → Android px/dp）。

**工时：** 2 小时

**Step 文档：** 待创建（Yoga 设计完成后编写）

---

### Task 3.3：Android ViewRenderer

**需求覆盖：** 需求 3、需求 8

**目标：** 将 PlatformBridge 指令映射为 Android View，完成 div、text、input(button) 和 TitleBar 渲染。

**产出：**
- `ViewRenderer.kt`
- FrameLayout、TextView、Button 创建
- 布局边界、文本、颜色、背景、圆角
- `setEvent` 监听器注册
- TitleBar 文本、背景色、文字颜色

**验收：** C++ 发出的完整渲染指令能够在 Android 容器内生成对应 View 树。

**工时：** 3 小时

**Step 文档：** 待创建（正式 ViewRenderer 设计完成后编写）

---

### Task 3.4：完整渲染管线与事件回调

**需求覆盖：** 需求 3、需求 4、需求 5、需求 7

**目标：** 串通从页面 VM 到 Android 屏幕的完整管线，并实现反向点击链路。

**渲染链路：**

```text
framework.js
  → __native_render__（JS Bridge）
  → C++ native_render
  → VNode → StyleResolver → YogaLayout
  → PlatformBridge
  → JNI
  → Kotlin ViewRenderer
  → Android View measure/layout/draw
```

**事件链路：**

```text
Android Button.onClick
  → Kotlin
  → JNI
  → C++ dispatchClick(nodeId)
  → JS_Call(vm, method)
  → VM 方法
```

**验收：** Demo 页面可见，点击按钮能进入 VM 方法；先验证事件通道，再接 Router。

**工时：** 3 小时

**Step 文档：** 待创建（渲染和事件通道完成后编写）

---

### Task 3.5：Router、Prompt 与 TitleBar

**需求覆盖：** 需求 5、需求 6、需求 7、需求 8

**目标：** 在已验证的 JS Bridge 和渲染链路上接入真正的 Router Page_Stack、showToast 和页面级 TitleBar。

**产出：**
- `core/include/router.h` / `core/src/router.cpp`
- Page_Stack、push/back
- `@app-module/system.router` External Object
- `@app-module/system.prompt` External Object
- Android Toast PlatformBridge 实现
- 页面切换时清空容器、加载新 bundle、重新渲染

**验收：** 点击 Demo 按钮导航到 DemoDetail；DemoDetail 的按钮能显示 Toast；Android Activity 栈不参与页面路由。

**工时：** 3 小时

**Step 文档：** 待创建（渲染和事件通道完成后编写）

---

## Phase 4：端到端验证与 Core 抽取

### Task 4.1：Debug RPK 端到端验证

**需求覆盖：** 所有需求（签名校验除外）

**目标：** 优先使用 Debug RPK 完成第一条可演示链路。

**验收标准：**
- [ ] `manifest.json` 解析成功
- [ ] `app.js` 执行成功
- [ ] Demo 页面显示 TitleBar、文本和按钮
- [ ] data/function 属性绑定成功
- [ ] 点击事件进入 VM 方法
- [ ] router.push 导航到 DemoDetail
- [ ] showToast 显示 Toast
- [ ] 异常能在 debug 模式下输出详细日志
- [ ] `META-INF/CERT` 被忽略且不阻塞启动

**工时：** 2 小时

**Step 文档：** 待创建（功能链路完成后编写）

---

### Task 4.2：Release RPK 兼容性验证

**需求覆盖：** 需求 1、需求 2、需求 3、需求 5

**目标：** 在 Debug 版本跑通后，用 Release RPK 验证 Runtime 不依赖变量名、webpack 注释或 source map。

**验收标准：**
- [ ] Release bundle 能正常 eval
- [ ] `$app_define$` / `$app_bootstrap$` 调用成功
- [ ] 模板、样式、事件和路由行为与 Debug 版本一致
- [ ] `manifest.config.debug` 为 false 时降低日志级别

**工时：** 1 小时

**Step 文档：** 待创建（Debug E2E 完成后编写）

---

### Task 4.3：抽取 quickapp-runtime-core

**需求覆盖：** 需求 9及跨平台架构

**目标：** 将 Android NDK 中已经验证的跨平台 Core 代码抽取为独立 `quickapp-runtime-core`，Android 工程改为消费该 Core，而不是重新实现。

**抽取范围：**
- `JSEngine Interface` 和当前 QuickJS 实现
- RPKLoader、ManifestParser
- VNode、StyleResolver、YogaLayout
- Router、JS Bridge、System API 抽象
- framework.js

**Android 保留在平台层：**
- JNI Bridge
- AssetManager 文件读取适配
- Kotlin ViewRenderer
- Android Toast、TitleBar
- `.so` 构建和加载

**产出：**
- `quickapp-runtime-core/include/`
- `quickapp-runtime-core/src/`
- `quickapp-runtime-core/js/`
- `quickapp-runtime-core/platform/android/`
- 独立 CMake 配置
- Android 工程通过源码依赖或预编译 `.so` 使用 Core

**验收：** 抽取前后的 Android 行为一致；Core 可以被后续 iOS 和 LVGL 宿主复用。

**工时：** 3 小时

**Step 文档：** 待创建（Android 行为稳定后编写）

---

### Task 4.4：运行时质量与可观测性验收

**需求覆盖：** 所有需求的非功能验收

**目标：** 在功能链路跑通后，验证 Runtime 不只是“能显示”，还具备线程安全、生命周期安全、错误可定位、性能可量化和兼容性可治理的基础。

**验收维度：**
- **线程安全**：QuickJS 只在 Runtime Thread 执行；Android View 只在 UI Thread 更新；JNI 不跨线程复用 `JNIEnv*`。
- **生命周期安全**：Runtime stop/destroy 后，Timer、Promise、异步 Native 请求、RenderCommand 和 JNI Global Reference 均能取消或释放。
- **错误模型**：RPK、Manifest、JS、JNI、Render、Platform Capability 错误包含 Runtime ID、Page ID、Request ID 和阶段信息。
- **性能指标**：记录 RPK 加载、JS 初始化、Bundle 执行、VNode、Yoga、RenderCommandBatch、UI Commit 和首帧耗时。
- **背压策略**：命令生成速度超过 UI 提交能力时，验证合并、限流、丢弃策略不会破坏页面最终一致性。
- **兼容性矩阵**：至少验证 Debug/Release RPK、API 24+、arm64-v8a、现有 system.router/system.prompt 语义和未知能力降级。
- **能力安全**：Manifest features/permissions 与 Native Capability 注册表匹配，未声明能力调用必须拒绝并记录审计日志。
- **可观测性**：Logcat 和 Native trace 能关联 Runtime、页面、事件、异步请求和渲染批次。

**产出：**
- Runtime 性能和错误埋点定义
- 线程与生命周期检查清单
- Debug/Release 与 Android API 兼容性矩阵
- 首帧、更新帧、内存峰值和命令批次基线
- 异步请求取消、超时和 Runtime 销毁测试记录

**验收：** 任意一次页面启动、事件处理、异步调用或渲染提交都能被定位到对应 Runtime/页面/请求上下文；销毁 Runtime 后不存在继续执行 JS、更新 View 或访问 JNI 引用的路径。

**工时：** 3 小时

**Step 文档：** 待创建（功能与线程治理完成后编写）

---

## 任务依赖关系

```text
Phase 1：Runtime 基础与两条主链路

  Task 1.1 Android NDK 骨架 ✓ Step 01（构建与 .so 打包已验收）
      ↓
  Task 1.2 PlatformBridge/JNI 最小闭环 → Step 02（源码已实现；待联网构建与设备验收）
      ↓
  Task 1.3 JSEngine Interface + QuickJS → Step 03（文档待创建）
      ↓
  Task 1.4 Runtime EventLoop + libuv + 线程模型 → Step 04（文档待创建）
      ↓
  Task 1.5 JS Bridge 核心 → Step 05（文档待创建）
      ↓
Phase 2：RPK 与 JS 执行（对应 Step 文档均待创建）

  Task 2.1 RPK/Manifest
      ↓
  Task 2.2 framework.js/VM
      ↓
  Task 2.3 页面 Bundle 启动
      ↓
Phase 3：渲染与交互（对应 Step 文档均待创建）

  Task 3.1 VNode/Style
      ↓
  Task 3.2 Yoga
      ↓
  Task 3.3 ViewRenderer
      ↓
  Task 3.4 完整渲染与事件通道
      ↓
  Task 3.5 Router/Prompt/TitleBar
      ↓
Phase 4：验证与抽取（对应 Step 文档均待创建）

  Task 4.1 Debug E2E
      ↓
  Task 4.2 Release 兼容性
      ↓
  Task 4.3 抽取 quickapp-runtime-core
      ↓
  Task 4.4 Runtime 质量与可观测性
```

**关键原则：** Task 1.2 验证 C++ → PlatformBridge/JNI → Kotlin 的渲染命令链路；Task 1.4 验证 Runtime Thread、EventLoop 和 QuickJS Job；Task 1.5 验证 JS → C++；Task 3.4 验证 Android → C++ 的独立事件通道。不能把 JS Bridge、PlatformBridge/JNI、EventLoop 和事件入口混写成一个 Bridge。

---

## 需求覆盖矩阵

| 需求 | 任务 |
|---|---|
| 需求 1：RPK 加载与 Manifest 解析 | Task 2.1、Task 4.1 |
| 需求 2：JavaScript 引擎初始化 | Task 1.3、Task 1.4、Task 1.5、Task 2.2、Task 2.3 |
| 需求 3：页面加载与组件渲染 | Task 1.2、Task 1.4、Task 1.5、Task 2.3、Task 3.1、Task 3.2、Task 3.3、Task 3.4 |
| 需求 4：数据绑定 | Task 1.4、Task 2.2、Task 3.1、Task 3.4 |
| 需求 5：点击事件处理与路由导航 | Task 1.4、Task 1.5、Task 3.4、Task 3.5 |
| 需求 6：ShowToast 系统 API | Task 1.5、Task 3.5 |
| 需求 7：页面生命周期回调 | Task 1.4、Task 2.2、Task 3.4、Task 3.5 |
| 需求 8：TitleBar 显示 | Task 3.3、Task 3.5 |
| 需求 9：引擎抽象接口 | Task 1.1、Task 1.3、Task 4.3 |
| 签名校验（当前不实现） | 明确排除；Task 2.1 跳过 `META-INF/CERT` |
