# Design Document

## 目录

- [Overview](#overview)
- [Architecture](#architecture)
- [Two Primary Pipelines](#two-primary-pipelines)
- [Components and Interfaces](#components-and-interfaces)
- [Data Models](#data-models)
- [Threading Model](#threading-model)
- [Module Design](#module-design)
- [Interface Design](#interface-design)
- [Data Flow](#data-flow)
- [Directory Structure](#directory-structure)
- [Correctness Properties](#correctness-properties)
- [Error Handling](#error-handling)
- [Testing Strategy](#testing-strategy)
- [Key Decisions](#key-decisions)

---

## Overview

quickapp-runtime-core 是从 quickapp-runtime-android 验证后抽取的跨平台 C++ 核心库。它实现快应用 Runtime 中所有平台无关的逻辑：JS 引擎管理、RPK 加载、VNode 树构建、布局计算、样式解析、路由管理、模块扩展和启动编排。

三端（Android / iOS / LVGL）通过各自的 PlatformBridge 实现对接，共享同一套 Core。

核心特征：
- 纯 C++17，不依赖任何平台 API
- QuickJS 作为嵌入式 JS 引擎，JS Bridge 零序列化直调
- PlatformBridge 函数指针实现跨平台渲染命令分发
- 单线程 RuntimeThread 保证 JS 和 Core 状态的线程安全
- NativeModule + Registry 模式支持能力扩展

**已验证的替代方案：**

| 组件 | 原计划 | V1 实现 | 接口兼容 |
|---|---|---|---|
| EventLoop | libuv | PosixEventLoop（mutex + condvar + min-heap） | ✓ RuntimeEventLoop 接口不变 |
| Layout | Yoga | 手写垂直 Flex（column + width/height/margin/padding） | ✓ calculateLayout 签名不变 |
| ZIP | minizip | 手写 Central Directory 解析 + zlib inflate | ✓ RPKLoader 接口不变 |
| JSON | cJSON | QuickJS JS_ParseJSON | ✓ ManifestParser 接口不变 |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  quickapp-runtime-core（纯 C++17，平台无关）                  │
│                                                             │
│  ┌─ 启动层 ─────────────────────────────────────────────┐   │
│  │  RuntimeHost        对外顶层 API                      │   │
│  │  RuntimeBootstrap   启动序列编排                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ JS 引擎层 ─────────────────────────────────────────┐   │
│  │  JSEngine (抽象)    引擎生命周期 + eval + error       │   │
│  │  QuickJSEngine      QuickJS 实现                     │   │
│  │  JS Bridge          全局函数注入 + 模块分发            │   │
│  │  ModuleRegistry     NativeModule 注册表               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 调度层 ─────────────────────────────────────────────┐   │
│  │  RuntimeEventLoop   任务调度抽象                      │   │
│  │  PosixEventLoop     默认实现                         │   │
│  │  RuntimeThread      线程所有权管理                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 数据加载层 ─────────────────────────────────────────┐   │
│  │  RPKLoader          ZIP 解压 + 文件寻址               │   │
│  │  ManifestParser     JSON → Manifest 模型              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 渲染管线层 ─────────────────────────────────────────┐   │
│  │  VNode              虚拟节点树                        │   │
│  │  StyleResolver      classList → style 合并            │   │
│  │  LayoutEngine       Flex 布局计算                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 平台通信层 ─────────────────────────────────────────┐   │
│  │  PlatformBridge     渲染命令出口（C++ → Platform）    │   │
│  │  PlatformEventSink  事件入口（Platform → C++）        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  依赖：QuickJS（源码编译）、zlib（系统库）                    │
└───────────────────────┬─────────────────────────────────────┘
                        │ PlatformBridge 函数指针
┌───────────────────────┴─────────────────────────────────────┐
│  平台层（各自实现，不属于 Core）                              │
│  ├─ Android: JNI + Kotlin ViewRenderer                      │
│  ├─ iOS: ObjC++ + UIKit ViewRenderer                        │
│  └─ LVGL: C++ + LVGL Widget Renderer                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Two Primary Pipelines

Core 的核心是打通两条稳定主线，并用调度基础设施连接它们。

### 主线一：JS Runtime / JS Bridge

```text
RPK (bytes)
  → RPKLoader / ManifestParser
  → QuickJS Engine
  → framework.js / VM Model
  → JS Bridge ($app_define$ / $app_bootstrap$ / $app_require$)
  → C++ Core（Router / Prompt / Render）
```

解决的问题：
- 如何加载和执行 RPK 中的 JS 代码
- 如何通过 QuickJS C API 将 JS API 零序列化映射到 C++
- 如何支持 system.router / system.prompt / 生命周期
- 如何让新模块只注册不改内核

### 主线二：Render Pipeline

```text
JS __native_render__(template, style)
  → C++ buildVNode(template)
  → StyleResolver.resolve(root, sheet)
  → LayoutEngine.calculateLayout(root, w, h)
  → PlatformBridge.createElement / setAttr / setStyle
  → 平台层创建原生 View
```

解决的问题：
- 如何将 JS 模板描述转换为像素级渲染命令
- 如何让 Core 不依赖具体平台 UI 框架
- 如何保证三端渲染结果一致

### 连接两条主线的基础设施

```text
Runtime Infrastructure
├── RuntimeEventLoop      任务调度 + Timer + Promise 微任务
├── RuntimeThread         线程所有权 + 生命周期
├── PlatformEventSink     平台事件投递（反向通道）
├── Log Abstraction       跨平台日志
└── Error Model           分层错误处理
```

---

## Components and Interfaces

### Core Components

| Component | Responsibility | Thread Ownership |
|---|---|---|
| `RuntimeHost` | 对外顶层 API：create/start/dispatchEvent/destroy | 任意线程调用，内部转发 |
| `RuntimeBootstrap` | 启动序列编排（模块注册→Bridge注入→RPK→JS执行→渲染） | Runtime Thread |
| `JSEngine` | QuickJS Runtime/Context 生命周期、脚本执行 | Runtime Thread |
| `RuntimeEventLoop` | Task/Timer/Promise Microtask 调度 | Runtime Thread |
| `RuntimeThread` | 线程所有权：创建 EventLoop + Engine，驱动 run() | 自有线程 |
| `RPKLoader` | ZIP 解压、文件路径映射、资源读取 | Runtime Thread |
| `ManifestParser` | JSON → Manifest 结构体 | Runtime Thread |
| `JS Bridge` | 全局函数注入 + $app_require$ 模块分发 | Runtime Thread |
| `ModuleRegistry` | NativeModule 注册表 | Runtime Thread |
| `VNode` | 虚拟节点树（type/attrs/styles/events/children/layout） | Runtime Thread |
| `StyleResolver` | classList 匹配 StyleSheet 并合并 | Runtime Thread |
| `LayoutEngine` | Flex 布局计算 | Runtime Thread |
| `PlatformBridge` | C++ → Platform 渲染命令出口 | Runtime Thread 调用 |
| `PlatformEventSink` | Platform → C++ 事件入口 | 任意线程→post 到 Runtime Thread |

### 关键接口边界

```text
RuntimeHost API    ← 平台层唯一入口
JS Bridge          ← JS ↔ C++（QuickJS C API 直调，零序列化）
PlatformBridge     ← C++ → Platform（渲染命令，函数指针）
PlatformEventSink  ← Platform → C++（事件投递，线程安全）
RuntimeEventLoop   ← 内部任务调度
```

任何组件不应绕过这些边界直接访问另一层私有状态。

---

## Data Models

### Runtime 状态机

```text
Created → Initializing → Running → Paused → Stopping → Destroyed
```

- Created：RuntimeHost 构造完成，资源未分配
- Initializing：创建 EventLoop/JSEngine，加载 RPK
- Running：接受 JS 执行、事件、Timer
- Paused：平台进入后台，暂停非必要 Timer
- Stopping：拒绝新任务，清空队列，释放资源
- Destroyed：所有引用无效，不可再使用

### VNode

```cpp
struct VNode {
    int id;                              // 全局唯一自增 ID
    std::string type;                    // "div" / "text" / "input"
    std::map<std::string, std::string> attrs;    // key → value
    std::map<std::string, std::string> styles;   // 合并后的样式
    std::map<std::string, std::string> events;   // eventType → methodName
    std::vector<std::string> classList;           // 样式类名列表
    std::vector<std::unique_ptr<VNode>> children;
    LayoutBox layout;                    // 布局计算结果
};
```

### LayoutBox

```cpp
struct LayoutBox {
    float x = 0;
    float y = 0;
    float width = 0;
    float height = 0;
};
```

### Manifest

```cpp
struct Manifest {
    std::string package;
    std::string name;
    std::string versionName;
    int versionCode = 0;
    std::string entry;              // 从 router.entry + router.pages 解析
    std::vector<std::string> pages; // 所有页面路径
    DisplayConfig display;          // titleBar 配置
    std::vector<std::string> features;
};

struct DisplayConfig {
    std::string titleBarText;
    std::string titleBarBackgroundColor;
    std::string titleBarTextColor;
    std::map<std::string, PageDisplayConfig> pageConfigs;
};
```

### PlatformEvent

```cpp
struct PlatformEvent {
    enum class Type { Click, Input, Lifecycle };
    Type type;
    int nodeId;
    std::string payload;   // JSON 或简单值
};
```

---

## Threading Model

```text
┌─────────────────────────────────────────────────────────────┐
│ Runtime Thread（Core 拥有）                                   │
│                                                             │
│  RuntimeEventLoop                                            │
│  ├─ PosixEventLoop（mutex + condvar + timer heap）           │
│  ├─ JSEngine（QuickJS JSRuntime / JSContext）                 │
│  ├─ 所有 Core 状态：VNode / Router / ModuleRegistry         │
│  └─ PlatformBridge 调用点                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ 函数指针调用 / 事件 post
┌──────────────────────────┴──────────────────────────────────┐
│ Platform UI Thread（不属于 Core）                             │
│  ├─ 接收 PlatformBridge 命令 → 创建原生 View                 │
│  ├─ 用户交互事件源                                           │
│  └─ 通过 PlatformEventSink.post() 投递事件到 Runtime Thread  │
└─────────────────────────────────────────────────────────────┘
```

**线程所有权规则：**
1. QuickJS 的 JSRuntime/JSContext/JSValue 只属于 Runtime Thread
2. Core 所有状态（VNode/Router/Registry）由 Runtime Thread 串行访问
3. PlatformBridge 函数指针由 Runtime Thread 调用；平台实现负责将命令投递到自己的 UI 线程
4. PlatformEventSink 可从任意线程调用，内部 post 到 RuntimeEventLoop
5. RuntimeHost 的公开方法线程安全（内部加锁或 post 转发）

---

## Module Design

| 模块 | 头文件 | 源文件 | 职责 |
|---|---|---|---|
| Log | `qa_log.h` | — (宏) | 跨平台日志抽象 |
| JSEngine | `js_engine.h` | `quickjs_engine.cpp` | 引擎抽象 + QuickJS 实现 |
| EventLoop | `runtime_event_loop.h` | — (抽象) | 调度接口 |
| PosixEventLoop | `posix_event_loop.h` | `posix_event_loop.cpp` | 默认实现 |
| RuntimeThread | `runtime_thread.h` | `runtime_thread.cpp` | 线程管理 |
| PlatformBridge | `platform_bridge.h` | `platform_bridge.cpp` | 渲染命令出口 |
| PlatformEventSink | `platform_event_sink.h` | `platform_event_sink.cpp` | 事件入口 |
| NativeModule | `native_module.h` | — (基类) | 模块接口 |
| ModuleRegistry | `module_registry.h` | `module_registry.cpp` | 注册表 |
| JSBridge | `js_bridge.h` | `js_bridge.cpp` | 全局函数注入 |
| RouterModule | — | `router_module.cpp` | system.router |
| PromptModule | — | `prompt_module.cpp` | system.prompt |
| RPKLoader | `rpk_loader.h` | `rpk_loader.cpp` | ZIP 读取 |
| ManifestParser | `manifest_parser.h` | `manifest_parser.cpp` | JSON 解析 |
| VNode | `vnode.h` | `vnode.cpp` | 虚拟节点 |
| StyleResolver | `style_resolver.h` | `style_resolver.cpp` | 样式匹配 |
| LayoutEngine | `layout_engine.h` | `layout_engine.cpp` | 布局计算 |
| RuntimeBootstrap | `runtime_bootstrap.h` | `runtime_bootstrap.cpp` | 启动序列 |
| RuntimeHost | `runtime_host.h` | `runtime_host.cpp` | 对外 API |

---

## Interface Design

### RuntimeHost（对外顶层 API）

```cpp
// include/runtime_host.h

struct RuntimeHostConfig {
    PlatformBridge bridge;           // 平台实现的渲染命令
    const uint8_t* rpkData;          // RPK 字节数据
    size_t rpkSize;                  // RPK 数据长度
};

class RuntimeHost {
public:
    /**
     * 创建 Runtime 实例。
     * @param config 包含 PlatformBridge 实现和 RPK 数据
     * @return 成功返回 true
     */
    bool create(const RuntimeHostConfig& config);

    /**
     * 启动 RuntimeThread，执行完整启动序列。
     * 非阻塞：内部启动线程后立即返回。
     * @return 线程启动成功返回 true
     */
    bool start();

    /**
     * 线程安全地投递平台事件到 Runtime。
     * @param event 平台事件（click/input/lifecycle）
     */
    void dispatchEvent(const PlatformEvent& event);

    /**
     * 停止 Runtime：stop EventLoop → join thread → 释放引擎 → 清空 Bridge。
     */
    void destroy();
};
```

### JSEngine（抽象接口）

```cpp
// include/js_engine.h

class JSEngine {
public:
    virtual ~JSEngine() = default;
    virtual bool initialize() = 0;
    virtual void destroy() = 0;
    virtual bool eval(const char* script, const char* filename = "<eval>") = 0;
    virtual bool hasError() const = 0;
    virtual std::string getLastError() const = 0;
};

std::unique_ptr<JSEngine> createJSEngine();
```

### RuntimeEventLoop（调度抽象）

```cpp
// include/runtime_event_loop.h

using Task = std::function<void()>;
using TimerId = uint64_t;

class RuntimeEventLoop {
public:
    virtual ~RuntimeEventLoop() = default;
    virtual void post(Task task) = 0;
    virtual TimerId postDelayed(Task task, uint64_t delayMs) = 0;
    virtual void cancelTimer(TimerId id) = 0;
    virtual void run() = 0;
    virtual void stop() = 0;
    virtual bool isRunning() const = 0;
};
```

### PlatformBridge

```cpp
// include/platform_bridge.h

struct PlatformBridge {
    using CreateElementFn = void (*)(int id, const char* type,
                                     float x, float y, float width, float height);
    using SetAttrFn = void (*)(int id, const char* key, const char* value);
    using SetStyleFn = void (*)(int id, const char* key, const char* value);
    using SetEventFn = void (*)(int id, const char* eventType, const char* methodName);
    using RemoveElementFn = void (*)(int id);
    using ShowToastFn = void (*)(const char* message);

    CreateElementFn createElement = nullptr;
    SetAttrFn setAttr = nullptr;
    SetStyleFn setStyle = nullptr;
    SetEventFn setEvent = nullptr;
    RemoveElementFn removeElement = nullptr;
    ShowToastFn showToast = nullptr;

    bool isReady() const noexcept {
        return createElement != nullptr && setAttr != nullptr && setStyle != nullptr;
    }
};

void registerPlatformBridge(PlatformBridge bridge);
const PlatformBridge& getPlatformBridge();
void clearPlatformBridge();
```

### NativeModule

```cpp
// include/native_module.h

struct MethodDef {
    const char* name;
    JSCFunction* func;   // QuickJS 函数签名
    int minArgs;
};

class NativeModule {
public:
    virtual ~NativeModule() = default;
    virtual const char* getName() const = 0;
    virtual std::vector<MethodDef> getMethods() const = 0;
};
```

---

## Data Flow

```text
Platform 层
    │ rpkData (bytes)
    ▼
RuntimeHost.create(config)
    │ 保存 bridge + rpkData
    ▼
RuntimeHost.start()
    │ 启动 RuntimeThread
    ▼
RuntimeThread::run()
    │ 创建 EventLoop + JSEngine
    │ 调用 bootstrapRuntime()
    ▼
bootstrapRuntime()
    ├─ ModuleRegistry 注册 RouterModule / PromptModule
    ├─ installJSBridge(ctx, registry)
    ├─ RPKLoader.open(rpkData, rpkSize)
    ├─ ManifestParser.parse(loader.readText("manifest.json"))
    ├─ engine.eval(framework.js)
    ├─ engine.eval(loader.readText("app.js"))
    ├─ engine.eval(loader.readText(entryPagePath))
    │       → $app_define$ + $app_bootstrap$
    │       → framework.js 创建 VM → onInit / onShow
    │       → __native_render__(template, style)
    ├─ buildVNode(ctx, templateObj)
    ├─ StyleResolver.resolve(root, styleSheet)
    ├─ LayoutEngine.calculateLayout(root, screenW, screenH)
    └─ 遍历 VNode 树 → PlatformBridge.createElement/setAttr/setStyle/setEvent
            │
            ▼
    Platform ViewRenderer 创建原生 UI
```

---

## Directory Structure

```text
quickapp-runtime-core/
├── CMakeLists.txt                 顶层构建
├── include/
│   ├── qa_log.h                   日志宏
│   ├── js_engine.h                引擎抽象
│   ├── runtime_event_loop.h       调度抽象
│   ├── runtime_thread.h           线程管理
│   ├── platform_bridge.h          渲染命令出口
│   ├── platform_event_sink.h      事件入口
│   ├── native_module.h            模块基类
│   ├── module_registry.h          注册表
│   ├── js_bridge.h                全局注入
│   ├── rpk_loader.h               ZIP 读取
│   ├── manifest_parser.h          JSON 解析
│   ├── vnode.h                    虚拟节点
│   ├── style_resolver.h           样式匹配
│   ├── layout_engine.h            布局计算
│   ├── runtime_bootstrap.h        启动序列
│   └── runtime_host.h             对外 API
├── src/
│   ├── quickjs_engine.cpp
│   ├── runtime_thread.cpp
│   ├── platform_bridge.cpp
│   ├── platform_event_sink.cpp
│   ├── module_registry.cpp
│   ├── js_bridge.cpp
│   ├── router_module.cpp
│   ├── prompt_module.cpp
│   ├── rpk_loader.cpp
│   ├── manifest_parser.cpp
│   ├── vnode.cpp
│   ├── style_resolver.cpp
│   ├── layout_engine.cpp
│   ├── runtime_bootstrap.cpp
│   └── runtime_host.cpp
├── platform/
│   └── common/
│       ├── posix_event_loop.h
│       └── posix_event_loop.cpp
├── js/
│   └── framework.js
└── third_party/
    └── quickjs/                   QuickJS 2024-01-13 源码
```

---

## Correctness Properties

### Property 1：QuickJS 线程隔离

任何 JSRuntime / JSContext / JSValue 操作只能在 Runtime Thread 中执行。其他线程通过 EventLoop.post() 间接触发 JS 操作。

**验证需求：** 3, 4, 8, 12

### Property 2：PlatformBridge 调用安全

PlatformBridge 函数指针只在 Runtime Thread 调用。平台实现负责将命令投递到自己的 UI 线程（如 Android runOnUiThread）。

**验证需求：** 5, 12, 13

### Property 3：事件顺序保持

同一节点的 PlatformEvent 按投递顺序在 Runtime Thread 串行处理，不会被并行执行或乱序处理。

**验证需求：** 6

### Property 4：销毁后不可执行

Runtime 进入 Stopping 后，新事件、Timer、PlatformBridge 调用都不能继续执行。destroy() 保证所有资源释放后状态变为 Destroyed。

**验证需求：** 4, 6, 13

### Property 5：引用生命周期闭合

JSEngine destroy 前所有 JSValue 引用已释放；RuntimeThread join 前 EventLoop 已 stop；PlatformBridge clear 前所有渲染命令已完成。

**验证需求：** 3, 4, 5

### Property 6：模块注册幂等

同名模块重复注册 SHALL 覆盖旧实例，不产生内存泄漏或状态异常。ModuleRegistry 在 destroy 时释放所有模块。

**验证需求：** 7

### Property 7：启动失败原子性

bootstrapRuntime 中任一步骤失败，已初始化的资源 SHALL 按逆序清理。不会留下半初始化的 JSEngine 或未关闭的 RPKLoader。

**验证需求：** 12

### Property 8：Core 平台无关

Core 编译产物中不包含任何平台符号（__android_log_print / objc_msgSend / lv_obj_create）。可通过 `nm libquickapp-core.a | grep` 验证。

**验证需求：** 1, 2

---

## Error Handling

错误按边界分类，每个错误携带阶段标识和人可读描述：

| 错误类别 | 示例 | 处理策略 |
|---|---|---|
| Build | CMake 配置失败、编译器不支持 C++17 | CMake 报错终止 |
| Package | RPK 数据为空、ZIP magic 错误、CRC 校验失败 | 返回 false + 错误描述，终止启动 |
| Manifest | JSON 无效、entry 字段缺失、pages 为空 | 返回 false + 字段级错误信息 |
| JavaScript | framework.js 异常、bundle eval 失败、Promise rejection | hasError() = true，getLastError() 返回脚本位置和堆栈 |
| EventLoop | post 到已 stop 的 loop、Timer ID 无效 | 静默丢弃任务，记录 debug 日志 |
| Bridge | 平台未注册（isReady() = false）、函数指针为空 | 跳过渲染命令，记录 warning |
| Module | 未知模块名、方法参数数量不匹配 | 返回 JS undefined / 抛 JS Error |
| Lifecycle | destroy 后调用 dispatchEvent | 丢弃事件，记录 debug 日志 |

**错误传播链：**

```text
bootstrapRuntime() 内部错误
    → 设置 lastError 字符串
    → 返回 false
    → RuntimeHost.start() 返回 false
    → 平台层读取错误信息并展示/上报
```

---

## Testing Strategy

### 单元测试（桌面编译，不依赖 Android）

| 模块 | 测试要点 |
|---|---|
| PosixEventLoop | post 顺序执行、postDelayed 精度、cancelTimer、stop 退出、重复 stop |
| QuickJSEngine | eval 成功/失败、Native 函数注册和调用、destroy 后 hasError |
| RPKLoader | 有效 ZIP 解压、readText 返回内容、无效数据返回 false |
| ManifestParser | 完整 JSON 解析、字段缺失报错、entry 路径拼接 |
| ModuleRegistry | 注册/查找/覆盖/destroy 释放 |
| VNode + StyleResolver | buildVNode 递归、classList 匹配、样式合并顺序 |
| LayoutEngine | 3 节点垂直堆叠、margin/padding 计算、未指定宽度继承 |
| RuntimeBootstrap | mock RPK + mock bridge → 完整启动链路验证 |

### 集成测试

```text
JSEngine + JS Bridge + ModuleRegistry
    → eval 脚本调用 $app_require$ → 返回模块对象 → 调用方法 → C++ 收到调用

RuntimeThread + EventLoop + JSEngine
    → post 任务 eval JS → Promise 微任务执行 → Timer 回调

完整链路：bootstrapRuntime
    → RPK 加载 → JS 执行 → VNode → Layout → PlatformBridge mock 收到命令
```

### 跨平台编译验证

```text
- Linux x86_64：gcc/clang + cmake → libquickapp-core.a ✓
- macOS arm64：clang + cmake → libquickapp-core.a ✓
- Android arm64-v8a：NDK r25+ + cmake → libquickapp-core.a ✓
- iOS arm64：Xcode clang + cmake → libquickapp-core.a ✓
```

### 性能基准（桌面环境）

| 指标 | 基准 |
|---|---|
| QuickJS 初始化 | < 5ms |
| framework.js eval | < 10ms |
| RPK 解压（100KB） | < 5ms |
| VNode 构建（50 节点） | < 1ms |
| Layout 计算（50 节点） | < 1ms |
| 完整 bootstrapRuntime | < 30ms |

---

## Key Decisions

1. **Core 不依赖平台 API** — 不 include jni.h / UIKit / LVGL，通过函数指针 + 回调实现跨平台
2. **PlatformBridge 用函数指针** — 最简跨平台通信，Core 只定义签名，平台各自实现
3. **JS Bridge 和 PlatformBridge 独立** — JS ↔ C++ 和 C++ → Platform 是两条不同方向的通道
4. **PlatformEventSink 独立于 PlatformBridge** — 事件通道（Platform → C++）不混入渲染指令（C++ → Platform）
5. **日志通过宏抽象** — QA_LOGI/LOGW/LOGE，平台编译期替换实现
6. **JSON 解析用 QuickJS** — 不引入额外 JSON 库，复用已有的 JS_ParseJSON
7. **布局引擎可插拔** — 内置简化版（column + width/height/margin/padding），接口不变可替换 Yoga
8. **EventLoop 可插拔** — 内置 PosixEventLoop，接口不变可替换 libuv
9. **NativeModule + Registry 模式** — 新增系统能力只注册不改内核
10. **RuntimeHost 封装所有细节** — 平台层只需 create/start/dispatchEvent/destroy 四个调用
11. **Core 编译为静态库** — 各平台通过 CMake add_subdirectory 引入，不生成动态库
12. **framework.js 可内嵌** — 可作为 C++ 编译期字符串常量，也可从 RPK 或外部文件加载
