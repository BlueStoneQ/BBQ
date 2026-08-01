# Design Document

## 目录

- [Overview](#overview)
- [Two Primary Pipelines](#two-primary-pipelines)
- [Components and Interfaces](#components-and-interfaces)
- [Data Models](#data-models)
- [Correctness Properties](#correctness-properties)
- [Error Handling](#error-handling)
- [Testing Strategy](#testing-strategy)
- [Architecture](#architecture)
  - [整体架构](#整体架构)
  - [渲染管线](#渲染管线)
  - [数据流](#数据流)
  - [通信机制](#通信机制)
  - [Runtime EventLoop 与线程模型](#runtime-eventloop-与线程模型)
- [Module Design](#module-design)
  - [C++ Core 模块](#c-core-模块)
  - [JS Framework](#js-framework)
  - [Android Platform Layer](#android-platform-layer)
- [Interface Design](#interface-design)
  - [JSEngine 抽象接口](#jsengine-抽象接口)
  - [PlatformBridge 接口](#platformbridge-接口)
  - [JS Bridge 注入函数](#js-bridge-注入函数)
- [JS Bridge Design](#js-bridge-design)
  - [本质模型](#本质模型)
  - [QuickJS 提供的注入能力](#quickjs-提供的注入能力)
  - [我们的选择：External Object + CFunction](#我们的选择external-object--cfunction)
  - [注入架构](#注入架构)
  - [Native 函数签名规范](#native-函数签名规范)
  - [完整注入表](#完整注入表)
  - [模块注册机制（app-require）](#模块注册机制app-require)
  - [C++ 到 JS 事件回调](#c-到-js-事件回调)
  - [数据流总览](#数据流总览)
  - [与 RN JSI 的对比](#与-rn-jsi-的对比)
- [Router Design](#router-design)
- [Directory Structure](#directory-structure)
- [Key Decisions](#key-decisions)
- [Architecture Review and Gaps](#architecture-review-and-gaps)
- [Cross-Platform Core Design](#cross-platform-core-design)
  - [三端共享与条件编译](#三端共享与条件编译)
  - [Interface 层设计策略](#interface-层设计策略)

---

## Overview

Android 快应用 Runtime — 一个三层架构的跨平台运行时，加载标准快应用 RPK 包并渲染为原生 UI。

核心特征：
- C++ Core 跨平台共享（Android / LVGL / iOS）
- QuickJS 统一 JS 引擎，JS Bridge 零序列化直调
- 独立路由（单 Activity + C++ Page_Stack）
- Android View 系统渲染，不自绘

---

## Two Primary Pipelines

本项目的核心不是堆叠 JNI、QuickJS、Yoga 和 Android View，而是打通两条稳定主线，并用 Runtime 基础设施连接它们。

### 主线一：JS Runtime / JS Bridge

```text
RPK
  → RPKLoader / ManifestParser
  → QuickJS Engine
  → framework.js / VM Model
  → JS Bridge
  → C++ Core
```

这条主线解决：

- 如何加载和执行现有快应用 RPK；
- 如何保持现有 `system.router`、`system.prompt`、生命周期和事件语义；
- 如何通过 QuickJS C API 将 JS API 映射到 C++；
- 如何让 JS 调用 Router、Prompt、Render 等 Runtime 能力；
- 后续如何增加同步 Native API、Promise、EventEmitter 和能力发现。

### 主线二：Render Pipeline

```text
JS Framework / C++ Core
  → VNode Tree
  → StyleResolver
  → YogaLayout
  → RenderCommand
  → PlatformBridge
  → JNI / UI Dispatcher
  → Kotlin ViewRenderer
  → Android View
```

`PlatformBridge` 明确属于 **Render Pipeline**，主要职责是把 C++ Core 生成的渲染命令发送到平台层：

```text
createElement
setAttr
setStyle
setEvent
removeElement
```

它不是 JS Bridge，也不是 Android → C++ 的事件回调接口。Android 的 click/input/lifecycle 事件通过独立的 `PlatformEventSink` 进入 Runtime。

### 连接两条主线的基础设施

```text
Runtime Infrastructure
├── RuntimeEventLoop / libuv Backend
├── Runtime Thread / QuickJS Thread Affinity
├── Android UI Dispatcher
├── RenderCommandQueue / Batch Commit
├── PlatformEventQueue
├── Lifecycle State Machine
├── Capability / Permission Registry
├── Error Model
└── Trace / Metrics / Debugging
```

EventLoop 不是第三条业务主线，而是两条主线共同依赖的调度基础设施：

```text
JS Async / Platform Event / Timer
  → RuntimeEventLoop
  → JS Bridge 或 Render Pipeline
```

### 框架规格定位

最终要做成的不是“能从 JNI 创建一个 TextView”的 Demo，而是一个：

```text
兼容现有快应用 RPK/API
+ QuickJS 驱动的嵌入式 Runtime
+ C++ Core 跨平台运行时
+ 独立渲染命令管线
+ Android 原生 View Renderer
+ 可演进的系统能力开放层
+ 可观测、可兼容、可扩展的应用容器
```

V1 先保证兼容和首屏渲染；V1.5/V2 再引入批量提交、增量更新、Promise Native API、EventEmitter、能力发现、版本协商和权限模型。

## Components and Interfaces

### Core components

| Component | Responsibility | Thread ownership |
|---|---|---|
| `JSEngine` | QuickJS Runtime/Context 生命周期、脚本执行和 Native 函数注册 | Runtime Thread |
| `RuntimeEventLoop` | Task、Timer、Promise Microtask、异步完成和平台事件调度 | Runtime Thread |
| `RPKLoader` | RPK 读取、ZIP 条目访问和资源寻址 | Runtime Thread；I/O 可由 EventLoop 调度 |
| `ManifestParser` | Manifest 模型解析、路由、能力和显示配置 | Runtime Thread |
| `VNodeTree` | 页面虚拟节点树和节点 ID 管理 | Runtime Thread |
| `StyleResolver` | classList 与样式规则匹配和合并 | Runtime Thread |
| `YogaLayout` | 计算节点布局边界 | Runtime Thread |
| `Router` | C++ Page_Stack、页面切换和生命周期调度 | Runtime Thread |
| `PlatformBridge` | C++ → 平台层的渲染/平台能力命令 | 由 Runtime Thread 调用，平台适配负责投递 |
| `PlatformEventSink` | 平台 → C++ 的 click、input、lifecycle 事件入口 | 事件先投递到 Runtime Thread |
| `ViewRenderer` | Android View 的创建、更新、删除和 UI Commit | Android Main/UI Thread |

### 关键接口边界

```text
JS Bridge：JS ↔ C++ Core
RuntimeEventLoop：Runtime 内部任务调度
PlatformBridge：C++ Core → Platform 命令
PlatformEventSink：Platform → C++ Core 事件
UI Dispatcher：Runtime Thread → Android UI Thread
```

任何组件都不应绕过这些边界直接访问另一层的私有状态。例如 QuickJS 不能直接持有 Android View，ViewRenderer 不能直接调用 QuickJS，Android 点击事件不能在 UI Thread 直接执行 JS。

## Data Models

### Runtime 状态

```text
Created → Initializing → Running → Paused → Stopping → Destroyed
```

### RenderCommand

```cpp
struct RenderCommand {
    enum class Type {
        CreateElement,
        SetAttr,
        SetStyle,
        SetEvent,
        RemoveElement,
    };

    Type type;
    int nodeId;
    std::string name;
    std::string value;
    LayoutBox layout;
};
```

该结构是概念模型。V1 可以通过 PlatformBridge 直接发送单条命令，V1.5/V2 使用 `RenderCommandBatch` 进行顺序提交、合并和背压控制。

### PlatformEvent

```cpp
struct PlatformEvent {
    enum class Type {
        Click,
        Input,
        Lifecycle,
    };

    Type type;
    int nodeId;
    std::string payload;
    uint64_t timestamp;
};
```

PlatformEvent 只能通过 RuntimeEventLoop 进入 C++ Core；事件处理完成后才允许调用 QuickJS。

### AsyncRequest

后续 Promise/Native Async 能力必须携带可追踪和可取消信息：

```cpp
struct AsyncRequest {
    uint64_t requestId;
    uint64_t runtimeId;
    uint64_t pageId;
    uint64_t deadlineMs;
    bool cancellable;
};
```

### CapabilityDescriptor

```text
name
version
requiredPermission
executionMode: sync | async | event
supportedPlatforms
```

它用于把 Manifest 的 features/permissions 与 Native Capability 注册表连接起来，避免 JS 直接调用没有声明的系统能力。

## Correctness Properties

### Property 1: QuickJS 线程隔离

任何 `JSRuntime`、`JSContext`、`JSValue` 操作都必须发生在所属 Runtime Thread。

**Validates: Requirements 2.1, 2.2, 9.1**

### Property 2: UI 线程隔离

任何 Android View 创建、属性更新、删除和监听器修改都必须发生在 Android Main/UI Thread。

**Validates: Requirements 3.7, 3.8, 3.9, 3.10**

### Property 3: 事件顺序保持

同一个 Runtime、页面和节点的 PlatformEvent 按投递顺序处理，不能跨线程无序执行。

**Validates: Requirements 5.1, 5.2, 7.1, 7.2**

### Property 4: 命令顺序保持

同一个 RenderCommandBatch 内的创建、属性和删除命令按提交顺序执行。

**Validates: Requirements 3.7, 3.8, 3.9, 3.10**

### Property 5: 销毁后不可执行

Runtime 进入 Stopping 后，新事件、Timer、Promise continuation 和 RenderCommand 都不能继续影响 JS 或 UI。

**Validates: Requirements 2.5, 2.6, 7.4**

### Property 6: 引用生命周期闭合

每一个 JNI Global Reference、JSValue、异步请求和 View 节点映射都有明确的创建与释放路径。

**Validates: Requirements 2.1, 2.2, 9.2**

### Property 7: 能力边界有效

未在 Manifest 声明、未通过权限检查或版本不兼容的 Native Capability 必须拒绝执行。

**Validates: Requirements 1.2, 6.1, 6.3**

### Property 8: 兼容语义稳定

V1 的 `system.router`、`system.prompt`、生命周期和事件语义不能因加入 EventLoop 或后续 TurboModule-like 能力而改变。

**Validates: Requirements 5.3, 5.4, 6.1, 7.1, 7.2**

### Property 9: 最终 UI 一致

在命令队列成功提交且没有新命令时，Android View 树的节点、属性和布局应与 C++ 最后一次 committed 状态一致。

**Validates: Requirements 3.7, 3.8, 3.9, 3.10**

## Error Handling

错误按边界分类，并附带 Runtime ID、页面 ID、请求 ID、阶段和原始原因：

| 错误类别 | 示例 | 处理策略 |
|---|---|---|
| Package | RPK 不存在、ZIP 损坏 | 终止当前 Runtime 初始化，返回描述性错误 |
| Manifest | JSON 无效、入口缺失 | 终止启动，保留文件和字段上下文 |
| JavaScript | Bundle 异常、Promise rejection | 记录脚本位置和堆栈，按页面/应用策略隔离 |
| EventLoop | Timer、任务投递或 loop 停止失败 | 取消关联请求，禁止继续提交结果 |
| JNI | 方法签名不匹配、Global Reference 失效 | 记录 JNI 阶段和方法名，阻止危险调用 |
| Render | 未知节点、非法布局或颜色 | 单节点降级/跳过，不能拖垮整个 Runtime |
| Capability | 未声明、无权限、版本不支持 | 返回稳定错误码，记录审计信息 |
| Lifecycle | 已销毁 Runtime 收到事件 | 丢弃事件并记录 debug 日志，不访问已释放对象 |

错误处理不能只依赖 Logcat。JS Bridge 的同步错误、Promise rejection、Native Async timeout 和 Runtime destroy cancellation 都要有明确的 JS 可见语义。

## Testing Strategy

### 单元测试

- `RuntimeEventLoop`：任务顺序、Timer、取消、停止和重复停止。
- QuickJS Adapter：Native 函数注册、Promise Microtask、异常和 JSValue 释放。
- `RenderCommandBatch`：命令顺序、合并、删除和重复提交。
- `PlatformEventSink`：事件投递、节点映射和 Runtime 销毁后的丢弃。
- Manifest、VNode、StyleResolver、Router 和 Capability Registry。

### 集成测试

```text
QuickJS → JS Bridge → C++ Core → PlatformBridge
C++ Core → RenderCommandBatch → JNI → Android UI Dispatcher → ViewRenderer
Android View Event → JNI → PlatformEventSink → RuntimeEventLoop → QuickJS
```

### 端到端测试

- Debug/Release RPK 首屏和更新渲染。
- `system.router.push/back` 和页面生命周期。
- `system.prompt.showToast`。
- Android API 24+ 和 arm64-v8a。
- Runtime 后台、恢复、旋转/宿主销毁和重复启动。
- 未知节点、非法样式、JS 异常、RPK 损坏和 Native 能力拒绝。

### 性能与稳定性测试

- 首屏时间：RPK 读取、JS 初始化、Bundle 执行、VNode、Yoga、首批 UI Commit 分阶段统计。
- 更新性能：RenderCommandBatch 大小、JNI 往返、UI Commit 和帧耗时。
- 资源指标：Runtime 内存峰值、JS 堆、View 数量、Timer 数量和未完成请求数。
- 压力场景：高频事件、连续路由、快速创建/销毁 Runtime、异步请求超时和取消。

## Architecture

### 整体架构

```text
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: JS Runtime（QuickJS 引擎内）                       │
│                                                             │
│  framework.js                                               │
│  ├─ $app_define$(name, deps, factory)  ← C++ 注入           │
│  ├─ $app_bootstrap$(name, options)     ← C++ 注入           │
│  ├─ $app_require$(module)              ← C++ 注入           │
│  └─ VM 模型：data 初始化、method 绑定、生命周期调度           │
│                                                             │
│  app.js / pages/*/index.js（RPK 产物）                       │
└───────────────────────┬─────────────────────────────────────┘
                        │ QuickJS C API（JS_NewCFunction）
                        │ 零序列化，类似 RN JSI
┌───────────────────────┴─────────────────────────────────────┐
│  Layer 2: C++ Core（跨平台共享）                             │
│                                                             │
│  ├─ JSEngine        QuickJS 封装 + 抽象接口                  │
│  ├─ RPKLoader       ZIP 解压、文件寻址                       │
│  ├─ ManifestParser  JSON → Manifest 模型                    │
│  ├─ VNodeTree       Template → VNode 结构                   │
│  ├─ StyleResolver   classList → style 合并                  │
│  ├─ YogaLayout      Flex 布局计算                           │
│  ├─ Router          Page_Stack + push/back                  │
│  ├─ SystemAPI       router / prompt 分发                    │
│  └─ PlatformBridge  渲染命令出口（createElement 等）       │
└───────────────────────┬─────────────────────────────────────┘
                        │ PlatformBridge 命令调用（函数指针 / JNI）
┌───────────────────────┴─────────────────────────────────────┐
│  Layer 3: Android Platform Layer                            │
│                                                             │
│  ├─ JNI Bridge      C++ ↔ Kotlin 桥接                       │
│  ├─ ViewRenderer    createElement → Android View            │
│  ├─ SystemAPIImpl   router → C++ Router, prompt → Toast     │
│  └─ TitleBar        manifest display 配置渲染               │
└─────────────────────────────────────────────────────────────┘
```

### 渲染管线

```text
UX 源码（.ux + manifest.json）
    ↓ 联盟工具链编译（hap build）
RPK（ZIP 包）
    ├─ manifest.json
    ├─ app.js
    └─ pages/Demo/index.js

========== Runtime 渲染管线 ==========

Stage 1: RPK 加载
    RPKLoader.unzip(rpk_path) → 内存文件结构

Stage 2: Manifest 解析
    ManifestParser.parse("manifest.json") → Manifest 模型
    提取 router.entry、display、features

Stage 3: JS 引擎初始化
    QuickJS.init()
    QuickJS.eval(framework.js) → 注入 $app_define$ / $app_bootstrap$ / $app_require$
    QuickJS.eval(app.js) → 应用 onCreate

Stage 4: 页面加载
    根据 router.entry 加载 pages/Demo/index.js
    QuickJS.eval(page_bundle)
    $app_define$ 注册组件
    $app_bootstrap$ 启动组件 → 创建 VM 实例

Stage 5: VNode 构建
    framework.js 遍历 template 树
    递归创建 VNode 对象（type, attr, classList, children, events）

Stage 6: 样式解析
    StyleResolver.resolve(vnode.classList, page_style_map)
    合并样式到 VNode

Stage 7: 布局计算
    YogaLayout.calculate(vnode_tree, screen_width, screen_height)
    为每个 VNode 计算 x, y, width, height

Stage 8: 渲染指令生成
    遍历 VNode 树
    PlatformBridge.createElement(id, type, x, y, w, h, style)
    PlatformBridge.setAttr(id, key, value)
    PlatformBridge.setEvent(id, event_type, method_name)

Stage 9: 平台渲染
    Kotlin ViewRenderer 收到 createElement
    创建对应 Android View（FrameLayout / TextView / Button）
    设置 LayoutParams、属性、样式
    addView 到容器

Stage 10: 系统渲染
    Android View 系统 measure → layout → draw
    SurfaceFlinger 合成 → 屏幕显示
```

### Runtime EventLoop 与线程模型

完整 Runtime 不能只依赖同步函数调用。QuickJS Promise、定时器、异步系统能力、平台事件和页面生命周期都需要统一的任务调度模型。本项目将 EventLoop 作为 Runtime 的长期基础设施，但不把 Android UI Looper 和 C++ Runtime EventLoop 混为一谈。

#### 线程职责

```text
┌─────────────────────────────────────────────────────────────┐
│ Runtime Thread                                               │
│                                                             │
│  RuntimeEventLoop                                            │
│  ├─ libuv loop backend                                       │
│  ├─ QuickJS JSRuntime / JSContext                            │
│  ├─ QuickJS Promise Job                                      │
│  ├─ C++ Core：Router / VNode / Yoga / System API             │
│  └─ RenderCommandBuffer                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ UI Dispatcher / JNI
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Android Main/UI Thread                                      │
│  ├─ Android ViewRenderer                                    │
│  ├─ FrameLayout / TextView / Button                         │
│  └─ View event source                                       │
└─────────────────────────────────────────────────────────────┘
```

线程所有权规则：

- QuickJS 的 `JSRuntime`、`JSContext` 和 JS 对象只属于 Runtime Thread；其他线程不能直接调用 QuickJS C API。
- C++ Core 的 Runtime 状态、Page_Stack、VNode Tree 和 JS VM 状态由 Runtime Thread 串行访问。
- Android View 只能由 Android Main/UI Thread 创建、更新和销毁。
- Android 事件先通过 JNI 投递到 Runtime Thread，再由 C++ Core 调用 JS。
- Runtime Thread 不能直接调用 `TextView`、`ViewGroup` 等 Android View API。

#### RuntimeEventLoop 抽象

Core 依赖抽象接口，不直接依赖 libuv：

```cpp
class RuntimeEventLoop {
public:
    virtual ~RuntimeEventLoop() = default;

    // 将任务投递到 Runtime Thread 执行。
    virtual void post(Task task) = 0;

    // 投递延迟任务，对应 setTimeout 等能力。
    virtual TimerId postDelayed(Task task, uint64_t delayMs) = 0;

    // 取消尚未执行的定时任务。
    virtual void cancelTimer(TimerId timerId) = 0;

    // 执行当前 JS Job Queue 中的 Promise 微任务。
    virtual void drainMicrotasks() = 0;

    // 停止接收新任务并等待 Runtime 资源释放。
    virtual void stop() = 0;
};
```

`Task`、`TimerId` 等类型是示意接口，真正实现时需要补充 Runtime 生命周期、错误传播和取消状态。接口的目标是隔离 Core 与具体事件循环实现。

#### libuv 的定位

本项目规划使用 `libuv` 作为 C++ Runtime EventLoop 的第一种实现：

```text
RuntimeEventLoop
    └── LibuvEventLoop
        ├── uv_loop_t
        ├── uv_async_t：跨线程唤醒 Runtime Thread
        ├── uv_timer_t：Timer / 延迟任务
        └── I/O watcher：后续 fetch / 文件 / Socket 能力
```

libuv 只负责 Runtime 线程上的任务、定时器和 I/O，不负责 Android View 绘制。Android UI 仍然使用系统 Main Looper；iOS 和 LVGL 也可以提供自己的 UI Dispatcher。

这样设计的原因是：

- QuickJS 需要宿主驱动 Promise Job，而不是自带完整 I/O 事件循环。
- Android `Looper` 只解决 Android 平台线程调度，不能直接成为跨平台 Core 的抽象。
- libuv 能为 Android、iOS、桌面和后续嵌入式适配提供统一的 Runtime 事件基础。
- `RuntimeEventLoop` 保留替换空间，未来可以增加 Android Looper、iOS RunLoop 或 LVGL Timer Backend，而不让 Core 依赖 libuv 类型。

#### QuickJS Job 与宏任务调度

Runtime 每次从 EventLoop 取出一个任务后，按照以下顺序执行：

```text
1. 执行一个 Runtime Task
2. 执行 JS 业务代码
3. 调用 JS_ExecutePendingJob，清空本轮 Promise Microtask
4. 生成或合并 RenderCommand
5. 将渲染批次投递到 Android UI Dispatcher
6. 返回 EventLoop，等待下一轮任务
```

Promise 微任务必须在拥有 `JSContext` 的 Runtime Thread 执行。不能在 libuv worker、Android UI Thread 或任意 JNI 临时线程中直接执行 JS。

#### 渲染命令与事件队列

渲染和事件是两个相反方向的队列：

```text
Runtime Thread
    → RenderCommandBuffer
    → UI Dispatcher
    → Android ViewRenderer

Android View
    → PlatformEventQueue
    → RuntimeEventLoop
    → C++ Core / QuickJS
```

`PlatformBridge` 负责发送渲染命令：

```text
createElement / setAttr / setStyle / removeElement
```

它不是 Android → C++ 的事件回调接口。点击、输入和生命周期事件通过独立的 `PlatformEventSink` 投递到 Runtime。

V1 可以先直接发送单条命令，V1.5/V2 应升级为：

```text
VNode Diff
    → Mutation List
    → RenderCommandBatch
    → UI Dispatcher
    → ViewRenderer Commit
```

这样可以减少 JNI 往返、避免中间状态暴露，并为背压、帧预算和增量更新提供边界。

#### Runtime 生命周期与停止规则

Runtime 必须显式管理以下状态：

```text
Created → Initializing → Running → Paused → Stopping → Destroyed
```

- `Initializing`：创建 EventLoop、QuickJS 和平台命令出口。
- `Running`：接受 JS、平台事件和异步任务。
- `Paused`：页面或宿主进入后台，可以暂停非必要 Timer 和渲染提交。
- `Stopping`：拒绝新任务，取消未完成异步操作，清空 RenderCommand，释放 JS 全局引用。
- `Destroyed`：EventLoop、QuickJS、PlatformBridge 和 Android View 引用全部不可再使用。

销毁顺序必须保证：

```text
停止接收事件
    → 停止 EventLoop
    → 等待 Runtime Thread 退出
    → 释放 QuickJS
    → 清理 PlatformBridge / JNI Global Reference
    → 清理 Android ViewRenderer
```

#### V1 与后续实现边界

```text
Step 2：同步渲染命令链路，不实现完整 EventLoop
Step 3：建立 QuickJS 所有权和最小 Microtask 调度
Step 4：接入 RuntimeEventLoop / libuv Backend
V1.5：RenderCommandBatch、UI Dispatcher、事件队列
V2：Promise Native API、Timer、fetch、EventEmitter 和取消/超时
```

### 数据流

```text
RPK 文件
    │
    ▼
┌─────────────┐
│ RPKLoader   │ 解压 ZIP
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Manifest    │ router.entry = "pages/Demo"
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ QuickJS     │ eval(framework.js) → 注入全局函数
│ Engine      │ eval(app.js) → 应用初始化
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Page Loader │ eval(pages/Demo/index.js)
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ VM Model    │ private: { title: "..." }
│             │ onInit() { ... }
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ VNode Tree  │ type: "div"
│             │ children: [{ type: "text", ... }, ...]
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Style       │ classList: ["wrapper"] → style map 查找
│ Resolver    │ 合并到 VNode
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Yoga Layout │ 计算每个节点的 x, y, w, h
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Platform    │ createElement(1, "div", 0, 0, 1080, 1920)
│ Bridge      │ createElement(2, "text", ...)
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Kotlin      │ FrameLayout + TextView + Button
│ Renderer    │
└─────────────┘
```

### 通信机制

Runtime 有两条核心通信链路，详见 [JS Bridge Design](#js-bridge-design) 章节。

| 名称 | 连接的两端 | 方向 | 通信方式 | 序列化 |
|---|---|---|---|---|
| **JS Bridge** | JS ↔ C++ | 双向 | QuickJS C API 直调 | ❌ 零序列化 |
| **PlatformBridge** | C++ → Platform | 单向 | 渲染命令函数指针 / JNI | ❌ 零序列化 |
| **PlatformEventSink** | Platform → C++ | 单向 | JNI / 平台事件投递 | 按事件类型决定 |

---

## Module Design

### C++ Core 模块

| 模块 | 文件 | 职责 |
|---|---|---|
| **JSEngine** | `js_engine.h/cpp` | QuickJS 封装，提供 eval、callFunction、registerNativeFunction 接口 |
| **RPKLoader** | `rpk_loader.h/cpp` | ZIP 解压、文件路径映射、资源读取 |
| **ManifestParser** | `manifest_parser.h/cpp` | JSON → Manifest 结构体，提取 router/display/features |
| **VNode** | `vnode.h/cpp` | 虚拟节点数据结构（type, attr, style, children, events） |
| **StyleResolver** | `style_resolver.h/cpp` | classList 匹配样式对象并合并 |
| **YogaLayout** | `yoga_layout.h/cpp` | 封装 Yoga，计算 Flex 布局 |
| **Router** | `router.h/cpp` | Page_Stack 管理、push/back 导航 |
| **SystemAPI** | `system_api.h/cpp` | 注册 @app-module/system.* 模块 |
| **PlatformBridge** | `platform_bridge.h` | C++ → 平台层的渲染和平台能力命令接口 |

### JS Framework

**文件：** `core/js/framework.js`（~400 行）

**职责：**
- 实现 `$app_define$`：注册应用/页面/组件
- 实现 `$app_bootstrap$`：启动组件，创建 VM 实例
- 实现 `$app_require$`：加载系统模块（@app-module/system.*）
- VM 模型：初始化 private 数据、绑定方法、调用生命周期

**核心逻辑：**

```javascript
// 全局注册表
const __components__ = {};

// $app_define$ 实现
globalThis.$app_define$ = function(name, deps, factory) {
    const exports = {};
    const module = { exports };
    factory(exports, module, $app_require$);
    __components__[name] = module.exports;
};

// $app_bootstrap$ 实现
globalThis.$app_bootstrap$ = function(name, options) {
    const comp = __components__[name];
    if (!comp) throw new Error(`Component ${name} not found`);
    
    // 创建 VM 实例
    const vm = {
        data: comp.private || {},
        ...comp
    };
    
    // 调用生命周期
    if (vm.onInit) vm.onInit.call(vm);
    
    // 构建 VNode 树（遍历 template）
    const vnode = buildVNode(comp.template, vm);
    
    // 通知 C++ 开始渲染
    __native_render__(vnode, comp.style);
};
```

### Android Platform Layer

| 模块 | 文件 | 职责 |
|---|---|---|
| **JNI Bridge** | `jni_bridge.cpp` | C++ 渲染命令到 Kotlin 的 JNI 适配、平台事件投递和生命周期连接 |
| **ViewRenderer** | `ViewRenderer.kt` | createElement → 创建 View，setAttr → 设置属性，setEvent → 设置监听器 |
| **QuickAppRuntime** | `QuickAppRuntime.kt` | 对外入口：`launch(context, rpkPath)` |
| **SystemAPIImpl** | `SystemAPIImpl.kt` | router → 调 C++ Router，prompt → Android Toast |

---

## Interface Design

### JSEngine 抽象接口

```cpp
// core/include/js_engine.h

class JSEngine {
public:
    virtual ~JSEngine() = default;
    
    // 生命周期
    virtual bool initialize() = 0;
    virtual void destroy() = 0;
    
    // 脚本执行
    virtual bool eval(const char* script, const char* filename = nullptr) = 0;
    virtual bool evalFile(const char* path) = 0;
    
    // 函数调用
    virtual bool callGlobalFunction(const char* name, int argc, JSValue* args) = 0;
    
    // Native 函数注册
    virtual void registerGlobalFunction(const char* name, 
                                        JSValue (*fn)(JSContext*, JSValueConst, int, JSValueConst*),
                                        int minArgs) = 0;
    
    // 错误处理
    virtual bool hasError() const = 0;
    virtual const char* getLastError() const = 0;
    virtual void clearError() = 0;
};
```

### PlatformBridge 接口

```cpp
// core/include/platform_bridge.h

// C++ → 平台层的命令出口。
// Core 只描述要做什么，不持有 Android View 类型。
struct PlatformBridge {
    // 渲染命令
    void (*createElement)(int id, const char* type,
                          float x, float y, float w, float h);
    void (*setAttr)(int id, const char* key, const char* value);
    void (*setStyle)(int id, const char* key, const char* value);
    void (*setEvent)(int id, const char* eventType, const char* methodName);
    void (*removeElement)(int id);

    // 平台能力命令。V1 暂时与渲染命令共用出口，后续可拆为 PlatformServiceBridge。
    void (*showToast)(const char* message);
};

// 平台 → C++ 的事件入口，与 PlatformBridge 的渲染命令方向相反。
// 事件必须投递到 RuntimeEventLoop 所属线程后再调用 QuickJS。
struct PlatformEventSink {
    void (*dispatchClick)(int id);
};
```

### JS Bridge 注入函数

| 全局函数 | C++ 实现 | 用途 |
|---|---|---|
| `$app_define$(name, deps, factory)` | `native_app_define` | 注册组件 |
| `$app_bootstrap$(name, options)` | `native_app_bootstrap` | 启动组件 |
| `$app_require$(module)` | `native_app_require` | 加载系统模块 |
| `__native_render__(vnode, style)` | `native_render` | 通知 C++ 开始渲染 |
| `$app_require$("@app-module/system.router").push` | `native_router_push` | 页面导航 |
| `$app_require$("@app-module/system.prompt").showToast` | `native_prompt_showToast` | Toast 显示 |

---

## JS Bridge Design

### 问题：JS 层如何调用 C++ 能力？

快应用 JS 代码需要调用 native 能力（路由跳转、Toast、渲染通知等），核心问题是：**如何让 JS 函数调用直接到达 C++ 函数，且零序列化开销？**

### 本质模型

```text
JS 全局对象
├── $app_define$     ──→ C++ native_app_define()
├── $app_bootstrap$  ──→ C++ native_app_bootstrap()
├── $app_require$    ──→ C++ native_app_require()    ──→ 返回 native module 对象
│   └── 返回值示例：{ push: native_fn, back: native_fn }
└── __native_render__──→ C++ native_render()

每个"──→"都是 QuickJS 的 External Function（JS_NewCFunction），
不经过 JSON 序列化、不走消息队列、不跨线程，直接函数调用。
```

**类比 RN JSI：** RN 的 JSI 也是通过 C++ 向 JS 注入 HostObject / HostFunction 实现零序列化直调。我们的方案本质相同，只是基于 QuickJS C API 而非 V8/Hermes。

### QuickJS 提供的注入能力

| API | 作用 | 类比 |
|---|---|---|
| `JS_NewCFunction(ctx, fn, name, argc)` | 创建一个 JS 函数，调用时直接进入 C 函数 `fn` | RN JSI `HostFunction` |
| `JS_NewCFunctionData(ctx, fn, argc, magic, data)` | 同上，但可以携带附加数据（闭包） | 带 capture 的 lambda |
| `JS_NewObjectClass(ctx, class_id)` + `JS_SetOpaque` | 创建 JS 对象，内部持有 C++ 指针 | RN JSI `HostObject` |
| `JS_SetPropertyStr(ctx, obj, key, val)` | 设置对象属性 | — |
| `JS_GetPropertyStr(ctx, obj, key)` | 读取对象属性 | — |

### 我们的选择：External Object + CFunction

**方案：** 每个 system module 注册为 JSClass，方法挂在 prototype 上，通过 Opaque 绑定 C++ 实例。

**为什么选 External Object 而不是 plain object：**

| 维度 | plain object + CFunction | External Object（JSClass） |
|---|---|---|
| 架构风格 | 临时拼装，每次 require 构建新 obj | 正规 OOP：class + prototype + instance |
| 方法复用 | 每次 require 都创建新函数对象 | 方法在 prototype 上共享 |
| 可扩展性 | 模块多了就变成 if-else 堆砌 | 统一注册模式，加模块只需新增 ClassDef |
| 实例寻址 | native 函数用全局单例 | 从 `this` 取 Opaque 指针，支持多实例 |
| 额外成本 | 无 | ~20 行一次性注册代码 |

**实现代码：**

```cpp
// ============================================================
// 一次性注册（引擎初始化时）
// ============================================================

static JSClassID router_class_id;
static JSClassID prompt_class_id;

static void empty_finalizer(JSRuntime* rt, JSValue val) {
    // 单例模块不需要释放
}

static JSClassDef router_class_def = { "Router", .finalizer = empty_finalizer };
static JSClassDef prompt_class_def = { "Prompt", .finalizer = empty_finalizer };

void registerSystemModules(JSContext* ctx) {
    JSRuntime* rt = JS_GetRuntime(ctx);
    
    // Router
    JS_NewClassID(&router_class_id);
    JS_NewClass(rt, router_class_id, &router_class_def);
    JSValue router_proto = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, router_proto, "push",
        JS_NewCFunction(ctx, native_router_push, "push", 1));
    JS_SetPropertyStr(ctx, router_proto, "back",
        JS_NewCFunction(ctx, native_router_back, "back", 0));
    JS_SetClassProto(ctx, router_class_id, router_proto);
    
    // Prompt
    JS_NewClassID(&prompt_class_id);
    JS_NewClass(rt, prompt_class_id, &prompt_class_def);
    JSValue prompt_proto = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, prompt_proto, "showToast",
        JS_NewCFunction(ctx, native_prompt_showToast, "showToast", 1));
    JS_SetClassProto(ctx, prompt_class_id, prompt_proto);
}

// ============================================================
// $app_require$ 返回模块实例
// ============================================================

static JSValue native_app_require(JSContext* ctx, JSValueConst this_val,
                                  int argc, JSValueConst* argv) {
    const char* name = JS_ToCString(ctx, argv[0]);
    JSValue module_obj = JS_UNDEFINED;
    
    if (strcmp(name, "@app-module/system.router") == 0) {
        module_obj = JS_NewObjectClass(ctx, router_class_id);
        JS_SetOpaque(module_obj, Router::instance());
    }
    else if (strcmp(name, "@app-module/system.prompt") == 0) {
        module_obj = JS_NewObjectClass(ctx, prompt_class_id);
        JS_SetOpaque(module_obj, PromptModule::instance());
    }
    
    JS_FreeCString(ctx, name);
    return module_obj;
}

// ============================================================
// Native 方法实现（从 this 取 Opaque）
// ============================================================

static JSValue native_router_push(JSContext* ctx, JSValueConst this_val,
                                  int argc, JSValueConst* argv) {
    Router* router = (Router*)JS_GetOpaque(this_val, router_class_id);
    
    JSValue uri_val = JS_GetPropertyStr(ctx, argv[0], "uri");
    const char* uri = JS_ToCString(ctx, uri_val);
    
    router->push(std::string(uri));
    
    JS_FreeCString(ctx, uri);
    JS_FreeValue(ctx, uri_val);
    return JS_UNDEFINED;
}
```

**模式总结：**

```text
新增一个 system module 的步骤：
1. 定义 JSClassID + JSClassDef
2. 创建 prototype，挂载方法（JS_NewCFunction）
3. 在 $app_require$ 中添加一行 JS_NewObjectClass + JS_SetOpaque
4. Native 方法中通过 JS_GetOpaque(this_val, class_id) 取出 C++ 实例

统一模式，可批量扩展。
```

### 注入架构

```text
C++ 初始化阶段（eval framework.js 之前）
│
├── 1. 注入宿主函数（Runtime ABI）
│   ├── global.$app_define$      = JS_NewCFunction(native_app_define, 3)
│   ├── global.$app_bootstrap$   = JS_NewCFunction(native_app_bootstrap, 2)
│   └── global.$app_require$     = JS_NewCFunction(native_app_require, 1)
│
├── 2. 注入 console（日志）
│   └── global.console.log/warn/error = JS_NewCFunction(native_console_*, 1)
│
└── 3. System Module 延迟注册
    └── $app_require$("@app-module/system.router") 时动态构建 module 对象

eval(framework.js)   ← framework.js 使用 $app_define$ 等全局函数
eval(app.js)         ← app.js 调用 $app_require$("@app-module/system.router")
eval(page_bundle)    ← page bundle 调用 $app_define$ + $app_bootstrap$
```

### Native 函数签名规范

所有 bridge 函数遵循 QuickJS 的 `JSCFunction` 签名：

```c
typedef JSValue (*JSCFunction)(JSContext* ctx, 
                               JSValueConst this_val,
                               int argc, 
                               JSValueConst* argv);
```

参数解析方式（零序列化）：

```c
// 读 string
const char* str = JS_ToCString(ctx, argv[0]);
// 用完必须释放
JS_FreeCString(ctx, str);

// 读 int
int32_t num;
JS_ToInt32(ctx, &num, argv[0]);

// 读 object 属性
JSValue uri_val = JS_GetPropertyStr(ctx, argv[0], "uri");
const char* uri = JS_ToCString(ctx, uri_val);
JS_FreeCString(ctx, uri);
JS_FreeValue(ctx, uri_val);

// 返回 object 给 JS
JSValue obj = JS_NewObject(ctx);
JS_SetPropertyStr(ctx, obj, "code", JS_NewInt32(ctx, 200));
return obj;
```

### 完整注入表

| 注入时机 | JS 全局标识 | C++ 实现 | 参数 | 返回值 |
|---|---|---|---|---|
| 引擎初始化 | `$app_define$(name, deps, factory)` | `native_app_define` | string, array, function | undefined |
| 引擎初始化 | `$app_bootstrap$(name, options)` | `native_app_bootstrap` | string, object | undefined |
| 引擎初始化 | `$app_require$(module)` | `native_app_require` | string | module object |
| 引擎初始化 | `__native_render__(vnode, style)` | `native_render` | object, object | undefined |
| 引擎初始化 | `console.log/warn/error(msg)` | `native_console_*` | any... | undefined |
| 按需创建 | `system.router.push(opts)` | `native_router_push` | {uri: string} | undefined |
| 按需创建 | `system.router.back()` | `native_router_back` | - | undefined |
| 按需创建 | `system.prompt.showToast(opts)` | `native_prompt_showToast` | {message: string} | undefined |

### 模块注册机制（app-require）

`$app_require$` 是连接 JS 代码与 system 能力的入口。bundle 中的 `require("@app-module/system.router")` 会被编译为 `$app_require$("@app-module/system.router")`。

当前采用 **External Object + CFunction**：模块本身是 QuickJS Class 实例，C++ 对象通过 Opaque 绑定；模块方法挂在 prototype 上，方法执行时从 `this_val` 取回对应的 C++ 实例。

```c
static JSValue native_app_require(JSContext* ctx, JSValueConst this_val,
                                  int argc, JSValueConst* argv) {
    const char* module_name = JS_ToCString(ctx, argv[0]);
    JSValue module_obj = JS_UNDEFINED;

    if (strcmp(module_name, "@app-module/system.router") == 0) {
        module_obj = JS_NewObjectClass(ctx, router_class_id);
        JS_SetOpaque(module_obj, Router::instance());
    } else if (strcmp(module_name, "@app-module/system.prompt") == 0) {
        module_obj = JS_NewObjectClass(ctx, prompt_class_id);
        JS_SetOpaque(module_obj, PromptModule::instance());
    }

    JS_FreeCString(ctx, module_name);
    return module_obj;
}

static JSValue native_router_push(JSContext* ctx, JSValueConst this_val,
                                  int argc, JSValueConst* argv) {
    Router* router = static_cast<Router*>(
        JS_GetOpaque(this_val, router_class_id));
    if (router == nullptr) {
        return JS_ThrowInternalError(ctx, "invalid Router object");
    }

    JSValue uri_val = JS_GetPropertyStr(ctx, argv[0], "uri");
    const char* uri = JS_ToCString(ctx, uri_val);
    if (uri == nullptr) {
        JS_FreeValue(ctx, uri_val);
        return JS_EXCEPTION;
    }

    router->push(std::string(uri));

    JS_FreeCString(ctx, uri);
    JS_FreeValue(ctx, uri_val);
    return JS_UNDEFINED;
}
```

**关键设计点：**
- `$app_require$` 返回带有 C++ Opaque 指针的 External Object
- `push`、`back`、`showToast` 仍然是 prototype 上的 `JS_NewCFunction`
- Router 的 `Page_Stack` 由 C++ Runtime 持有和管理，不由 JS GC 释放
- system module 可以按需创建；后续可以增加 module cache 保证同一 Runtime 返回同一实例
- 未知模块返回异常或明确的空模块，不能静默调用不存在的能力

### C++ 到 JS 事件回调

事件回调方向相反：用户点击 View → Platform 回调 C++ → C++ 调用 JS VM 方法。

```c
// C++ 端：收到平台的点击事件
void onPlatformClick(int node_id) {
    // 1. 查找 node_id 对应的方法名
    const char* method_name = findEventHandler(node_id, "click");
    
    // 2. 在 VM 实例上调用该方法
    JSValue vm_obj = getCurrentVM();
    JSValue method = JS_GetPropertyStr(ctx, vm_obj, method_name);
    
    // 3. 执行（this 绑定到 vm）
    JS_Call(ctx, method, vm_obj, 0, NULL);
    
    JS_FreeValue(ctx, method);
}
```

### 数据流总览

```text
┌──────────────────────────────────────────────────────────────┐
│  JS → C++（通过 JS Bridge）                                  │
│                                                              │
│  bundle 调用 $app_require$("@app-module/system.router")      │
│       │                                                      │
│       ▼ QuickJS 查找全局 → 找到 CFunction 指针               │
│       │                                                      │
│       ▼ native_app_require() 被调用                          │
│       │                                                      │
│       ▼ 返回 Router External Object（prototype 上有 push/back）│
│       │                                                      │
│       ▼ JS 调用 router.push({uri: "/pages/Detail"})          │
│       │                                                      │
│       ▼ native_router_push() 被调用                          │
│       │                                                      │
│       ▼ C++ Router::push("/pages/Detail")                    │
│       │                                                      │
│       ▼ C++ 加载新页面 → 渲染 → PlatformBridge 发指令         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  C++ → JS（事件回调）                                         │
│                                                              │
│  用户点击 Android Button                                     │
│       │                                                      │
│       ▼ Kotlin onClick → JNI → C++ dispatchClick(node_id)    │
│       │                                                      │
│       ▼ C++ 查找 events map: node_id → "onDetailBtnClick"    │
│       │                                                      │
│       ▼ JS_Call(ctx, method, vm_obj, 0, NULL)                │
│       │                                                      │
│       ▼ JS VM 方法执行（可能触发 router.push）                │
└──────────────────────────────────────────────────────────────┘
```

### 与 RN JSI 的对比

| 维度 | RN JSI (Hermes/V8) | 我们的 JS Bridge (QuickJS) |
|---|---|---|
| 注入方式 | `runtime.global().setProperty("fn", HostFunction)` | `JS_SetPropertyStr(ctx, global, "fn", JS_NewCFunction(...))` |
| 对象暴露 | `HostObject` + `get/set` 拦截 | `JS_NewObjectClass` + `JS_SetOpaque` |
| 参数读取 | `args[0].asString(rt)` | `JS_ToCString(ctx, argv[0])` |
| GC 交互 | weak/strong ref | `JS_FreeValue` 手动管理 |
| 序列化 | ❌ 零 | ❌ 零 |
| 线程模型 | 可跨线程（需锁） | 单线程（QuickJS 非线程安全） |
| 性能 | 高 | 高（QuickJS 本身较慢但 bridge 开销为零） |

**核心相似点：** 都是在 JS 全局注入 native 函数/对象，调用时直接进入 C/C++ 代码，不走序列化通道。

---

## Router Design

**独立路由方案：单 Activity + C++ Page_Stack**

```text
┌─────────────────────────────────────────┐
│  MainActivity (单个 Activity)            │
│  └── FrameLayout (容器)                 │
│      └── 当前页面的 View 树              │
└─────────────────────────────────────────┘
                    ▲
                    │ PlatformEventSink / JNI 事件投递
                    │
┌─────────────────────────────────────────┐
│  C++ Router                             │
│  ┌─────────────────────────────────┐    │
│  │ Page_Stack                      │    │
│  │ [0] Demo (当前)                  │    │
│  │ [1] DemoDetail (待恢复)          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  push(uri):                             │
│    1. 保存当前页面状态到栈               │
│    2. 加载目标页面 JS                   │
│    3. 构建 VNode → 布局 → 渲染指令       │
│    4. 通知 Kotlin 清空容器 + 创建新 View │
│                                         │
│  back():                                │
│    1. 弹出栈顶                          │
│    2. 恢复上一个页面的 VNode             │
│    3. 重新渲染                          │
└─────────────────────────────────────────┘
```

**不依赖 Android Activity 栈的原因：**
- LVGL / iOS 没有 Activity 概念，路由逻辑必须平台无关
- C++ Core 的 Page_Stack 三端共享
- 平台层只负责"清空容器 + 渲染新 View"

---

## Directory Structure

### Android NDK 开发阶段

第一阶段不单独维护纯 C++ 工程，Core 直接在 Android NDK 工程中开发和验证：

```text
/Users/qiaoyang/code/my-github/quickapp-kit/
│
├── quickapp-runtime-android/           ← 第一阶段真实宿主
│   ├── app/
│   │   ├── src/main/cpp/
│   │   │   ├── core/               ← 未来抽取为 quickapp-runtime-core
│   │   │   │   ├── include/
│   │   │   │   │   ├── runtime_event_loop.h
│   │   │   │   │   ├── render_command_queue.h
│   │   │   │   │   └── platform_event_sink.h
│   │   │   │   └── src/
│   │   │   ├── platform/common/    ← 跨平台调度与 libuv 适配
│   │   │   │   ├── libuv_event_loop.cpp
│   │   │   │   └── runtime_thread.cpp
│   │   │   ├── platform/android/   ← Android JNI/File/Log/UI 调度适配
│   │   │   │   ├── jni_bridge.cpp
│   │   │   │   └── CMakeLists.txt
│   │   │   ├── third_party/
│   │   │   │   ├── quickjs/
│   │   │   │   ├── libuv/
│   │   │   │   └── yoga/
│   │   │   └── CMakeLists.txt
│   │   ├── src/main/java/
│   │   │   ├── QuickAppRuntime.kt  ← Runtime 入口
│   │   │   └── ViewRenderer.kt      ← Android View 渲染
│   │   ├── src/main/assets/
│   │   │   ├── framework.js
│   │   │   └── com.example.case1.debug.1.0.0.rpk
│   │   └── build.gradle
│   ├── build.gradle
│   └── settings.gradle
│
├── quickapp-examples/              ← RPK 示例（已有）
│
└── quickapp-runtime-core/          ← Phase 4 抽取后的独立 Core
    ├── CMakeLists.txt
    ├── include/
    ├── src/
    ├── js/
    └── platform/
        ├── android/
        ├── ios/
        └── lvgl/
```

`core/` 在 Android 工程内是开发期目录；抽取完成后才形成独立的 `quickapp-runtime-core`。Android 继续通过 NDK 构建并加载 `libquickapp-runtime-core.so`，iOS/LVGL 后续再消费同一套 Core。

---

## Key Decisions

| 决策 | 选择 | 理由 |
|---|---|---|
| JS 引擎 | QuickJS（统一） | 嵌入式友好、内存占用小、C API 简洁、三端共享 |
| JS Bridge | QuickJS C API 直调 | 零序列化，类似 RN JSI，性能最优 |
| 渲染方式 | Android View System（程序化 View 树，不使用 XML 作为 Runtime 模板） | C++ Core 输出 VNode/布局结果，Android 通过 FrameLayout、TextView、Button 等原生 View 执行；宿主是否使用 Compose 不影响 Runtime |
| 路由方案 | 单 Activity + C++ Page_Stack | 三端共享路由逻辑，不依赖平台特定导航 |
| 线程模型 | Runtime Thread + Android UI Thread；QuickJS 单线程所有权 | Runtime 事件、JS 执行和 Core 状态在 Runtime Thread 串行化；View 只在 UI Thread 更新 |
| EventLoop | `RuntimeEventLoop` 抽象 + libuv backend | 统一承载 Promise Job、Timer、异步能力和平台事件；不让 Core 直接依赖平台 Looper |
| 渲染提交 | PlatformBridge 命令 + RenderCommandBatch | V1 允许直接命令调用，后续通过批量提交、UI Dispatcher 和背压优化 JNI/UI 更新 |
| 事件通道 | 独立 PlatformEventSink | Android → C++ 的 click/input/lifecycle 事件不与 C++ → Android 的渲染命令混用 |
| 产物形态 | 第一阶段单 APK | 快速验证，后续拆 AAR |
| framework.js | 单文件 ~400 行 | 边界清晰，C++ 只需 eval 一次 |
| JSEngine 接口 | 预留抽象 | 支持未来引擎替换（V8 / JSC） |

---

## Architecture Review and Gaps

本节用现有快应用模型、React Native 新架构和 Lynx 的公开架构作为对照，检查本项目是否只停留在“JNI 能调用”的 Demo 层，而没有定义可演进的 Runtime 边界。参考资料：

- [React Native Threading Model](https://reactnative.dev/architecture/threading-model)
- [React Native Fabric Renderer](https://reactnative.dev/architecture/fabric-renderer)
- [React Native Cross-Platform Implementation](https://reactnative.dev/architecture/xplat-implementation)
- [Lynx Rendering Process and Lifecycle](https://lynxjs.org/react/lifecycle)
- [Lynx Best Practices and Dual-Thread Architecture](https://lynxjs.org/react/best-practices)
- [Lynx JavaScript Runtime](https://lynxjs.org/guide/scripting-runtime/)
- [Quick App Lifecycle](https://miniapp-initiative.ow2.io/developers/guide/lifecycle)
- [Quick App APIs and Services](https://miniapp-initiative.ow2.io/developers/guide/api-basics.html)

### 对照结论

| 对照维度 | RN / Lynx / Quick App 暴露的问题 | 本项目当前决策 |
|---|---|---|
| JS 执行线程 | JS 执行、原生 UI 和异步任务不能无边界地互相调用 | QuickJS 由 Runtime Thread 独占；Android View 由 UI Thread 独占 |
| 事件循环 | Promise、Timer、Native Async 和生命周期需要统一调度 | `RuntimeEventLoop` 抽象，第一种实现规划为 libuv backend |
| 渲染提交 | 逐条跨语言调用会产生 JNI 往返和中间状态 | V1 允许直接命令；V1.5/V2 使用 RenderCommandBatch 和 UI Dispatcher |
| 事件方向 | 用户事件与渲染命令是相反方向，不能都叫 callback | `PlatformBridge` 发送命令；`PlatformEventSink` 投递事件 |
| 渲染模型 | RN Fabric/Lynx 都强调树、提交和原生挂载边界 | VNode → Layout → Mutation/Command → ViewRenderer Commit |
| 首屏与更新 | 首屏渲染和后续更新的性能目标不同 | 单独记录 First Render 和 Update Render 指标 |
| 生命周期 | 宿主后台、暂停、恢复和销毁会影响 JS、Timer、View 和请求 | Runtime 状态机统一管理 pause/resume/stop/cancel |
| 系统能力 | 原生能力需要模块化、版本、权限和异步错误语义 | V1 兼容现有 API；V2 增加能力发现、版本协商和权限模型 |
| 可观测性 | 没有分阶段耗时和错误上下文时无法定位卡顿或兼容问题 | 增加 Runtime Trace、阶段耗时、命令批次和 JS 异常上下文 |

### 当前设计需要避免的误区

1. **不声称已经实现 Fabric 或 Lynx。** 我们借鉴的是线程、提交、生命周期和平台边界，不复制它们的 React Reconciliation、双 JS 引擎或完整 Renderer 实现。
2. **不把 EventLoop 等同于 Android Looper。** EventLoop 驱动 QuickJS 和 C++ Runtime；Android Looper 只负责 Android UI。
3. **不把 PlatformBridge 写成 Android 回调 C++。** PlatformBridge 是 C++ → Platform 的命令出口；Android → C++ 使用独立事件入口。
4. **不在 V1 引入完整 VNode Diff。** V1 先完成初始渲染和兼容现有快应用；V1.5/V2 再引入 old tree/new tree、Mutation List 和批量提交。
5. **不让异步 API 只有“返回 Promise”而没有取消和超时。** V2 的 Native Async API 必须定义 requestId、timeout、cancel、错误码和 Runtime 销毁时的统一取消行为。
6. **不让平台能力直接散落在 JNI 函数中。** System API 应通过模块注册、能力声明、版本协商和权限检查进入 Runtime。
7. **不把性能只归因于 JNI。** 首屏耗时还包括 RPK 读取、Manifest 解析、QuickJS 初始化、Bundle 执行、VNode、Style、Yoga、命令提交和 View 首次布局。

### 需要补齐的非功能规格

后续设计和任务必须明确以下指标，而不是只验证“屏幕显示文字”：

- **线程安全**：QuickJS、Core 状态、PlatformBridge、UI View 的线程所有权。
- **生命周期**：创建、初始化、运行、后台、恢复、停止、销毁状态及状态转移合法性。
- **内存所有权**：JNI Local/Global Reference、JSValue、C++ 字符串、RenderCommand 和异步请求的释放责任。
- **错误模型**：RPK、JS、JNI、渲染、系统能力和异步请求的错误分类、日志级别和错误上下文。
- **性能指标**：首屏时间、JS 执行时间、布局时间、命令批次大小、UI 提交时间、帧耗时和内存峰值。
- **背压策略**：Runtime 产生渲染命令过快时的合并、丢弃、限流和生命周期取消策略。
- **兼容性矩阵**：RPK Debug/Release、平台版本、Runtime ABI、System API 版本和降级策略。
- **安全边界**：Manifest features/permissions 到 Native Capability 的映射、拒绝行为和审计日志。
- **可观测性**：Runtime 实例 ID、页面 ID、请求 ID、命令批次 ID 和跨线程 trace 信息。

### 与本项目 V1/V2 路线的关系

```text
V1：兼容现有快应用 RPK/API，单 Runtime Thread，初始渲染命令链路
  ↓
V1.5：RuntimeEventLoop + libuv、事件队列、RenderCommandBatch、UI Dispatcher
  ↓
V2：Promise/Timer/Async Native API、EventEmitter、能力发现、版本协商、权限和扩展模块
  ↓
后续：VNode Diff、增量 Commit、跨端 Renderer、性能治理和开发者诊断工具
```

这条路线保证：V1 不为了追求 RN/Lynx 的形式而破坏现有快应用兼容性，同时保留向高性能、可扩展 Runtime 演进的架构接口。

## Cross-Platform Core Design

### 三端共享与条件编译

Core 编译为平台动态/静态库，三端通过链接使用：

| 平台 | Core 产物 | 加载方式 | PlatformBridge 实现 |
|---|---|---|---|
| **Android** | `libquickapp-runtime-core.so` | `System.loadLibrary` via JNI | PlatformBridge 渲染命令 → Kotlin ViewRenderer；PlatformEventSink 接收 Android 事件 |
| **iOS** | `libquickapp-runtime-core.a` | 静态链接到 App 二进制 | ObjC block / Swift closure |
| **LVGL** | `libquickapp-runtime-core.a` | 静态链接进固件 | LVGL widget API 直调 |

**条件编译边界（仅以下 3 处）：**

| 隔离点 | 差异内容 | 编译宏 |
|---|---|---|
| PlatformBridge 注册入口 | 谁来填充函数指针 | `PLATFORM_ANDROID` / `PLATFORM_IOS` / `PLATFORM_LVGL` |
| 文件 I/O | Android AssetManager / iOS Bundle / POSIX fopen | 同上 |
| 日志输出 | `__android_log_print` / `NSLog` / `printf` | 同上 |

Core 其余代码（JS 引擎管理、VNode、布局、路由）100% 平台无关。

**目录演进：**

```text
开发阶段：
quickapp-runtime-android/app/src/main/cpp/core/
    ├── include/
    └── src/

抽取阶段：
quickapp-runtime-core/
    ├── include/
    ├── src/
    ├── js/
    └── platform/
        ├── android/
        ├── ios/
        └── lvgl/
```

抽取不是重新实现 Core，而是把 Android NDK 中已经跑通并验证过的平台无关代码移动到独立模块，再由 Android 通过 `.so` 消费。

### Interface 层设计策略

**问题：哪些第三方依赖需要抽象接口？哪些直接使用？**

| 依赖 | 是否需要 Interface | 理由 |
|---|---|---|
| **JS 引擎** | ✅ 需要 | 三端可能用不同引擎（QuickJS / V8 / JSC），API 差异巨大 |
| **Yoga 布局** | ❌ 不需要 | 唯一成熟的跨平台 Flex 引擎，无竞品可替换 |
| **ZIP 解压** | ❌ 不需要 | minizip / zlib 是事实标准，API 稳定 |
| **JSON 解析** | ❌ 不需要 | 用 QuickJS 内置的 JSON.parse 或 cJSON，不值得抽象 |

**JS 引擎 Interface：**

```cpp
// core/include/js_engine.h — 抽象接口

class JSEngine {
public:
    virtual ~JSEngine() = default;
    
    virtual bool initialize() = 0;
    virtual void destroy() = 0;
    virtual bool eval(const char* script, const char* filename = nullptr) = 0;
    virtual bool callFunction(const char* name, int argc, void** args) = 0;
    
    // 注册 native 函数到 JS 全局
    // 不同引擎的函数签名不同，这里用 void* 擦除
    virtual void registerGlobalFunction(const char* name, void* fn, int minArgs) = 0;
    
    virtual bool hasError() const = 0;
    virtual const char* getLastError() const = 0;
};

// 工厂函数：编译时决定实现
std::unique_ptr<JSEngine> createJSEngine();
```

```cpp
// core/src/quickjs_engine.cpp — QuickJS 实现
// core/src/v8_engine.cpp      — V8 实现（后续）
// core/src/jsc_engine.cpp     — JSC 实现（后续）
```

**Yoga 不加 Interface 的原因：**
- Yoga 是唯一成熟的跨平台 Flex 布局引擎
- 没有 Yoga → V8-Layout 或 Yoga → X 这种替换场景
- 用薄封装 `yoga_layout.h` 包一层 Yoga API 调用即可，不需要纯虚接口
- 过度抽象只增加复杂度，不带来实际价值

**薄封装 vs Interface 的区别：**

```cpp
// 薄封装（我们对 Yoga 的做法）：隐藏 Yoga 头文件细节，但不可替换
class YogaLayout {
public:
    static bool calculate(VNode* root, float width, float height);
    // 内部直接调用 YGNodeCalculateLayout
};

// Interface（我们对 JS 引擎的做法）：可替换实现
class JSEngine {
    virtual bool eval(...) = 0;  // 纯虚，编译时选不同 .cpp
};
```
