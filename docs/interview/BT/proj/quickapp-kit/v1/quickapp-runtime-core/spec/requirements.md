# Requirements Document

## 目录

- [Introduction](#introduction)
- [Glossary](#glossary)
- [Requirements](#requirements)
  - [需求 1：跨平台编译与项目结构](#需求-1跨平台编译与项目结构)
  - [需求 2：日志抽象](#需求-2日志抽象)
  - [需求 3：JS 引擎抽象与生命周期](#需求-3js-引擎抽象与生命周期)
  - [需求 4：任务调度与线程模型](#需求-4任务调度与线程模型)
  - [需求 5：PlatformBridge 渲染命令](#需求-5platformbridge-渲染命令)
  - [需求 6：PlatformEventSink 事件入口](#需求-6platformeventsink-事件入口)
  - [需求 7：NativeModule 与模块注册](#需求-7nativemodule-与模块注册)
  - [需求 8：JS Bridge 注入](#需求-8js-bridge-注入)
  - [需求 9：RPK 加载与 Manifest 解析](#需求-9rpk-加载与-manifest-解析)
  - [需求 10：VNode 构建与样式解析](#需求-10vnode-构建与样式解析)
  - [需求 11：布局计算](#需求-11布局计算)
  - [需求 12：Runtime 启动序列](#需求-12runtime-启动序列)
  - [需求 13：三端集成接口](#需求-13三端集成接口)

---

## Introduction

quickapp-runtime-core — 从 quickapp-runtime-android 验证后抽取的跨平台 C++ 核心库。

**定位：** 实现快应用 Runtime 中所有平台无关的逻辑，三端（Android/iOS/LVGL）通过各自的 PlatformBridge 实现对接，共享同一套 Core。

**与 Android 项目的关系：**
- Android 项目 `app/src/main/cpp/core/` 目录中的代码经端到端验证后，抽取为本独立库
- 抽取后 Android 改为 `add_subdirectory` 引入 Core，删除原 core 目录副本
- iOS 和 LVGL 以相同方式消费 Core

**产物形态：**
- 静态库 `libquickapp-core.a`（各平台交叉编译）
- 公开头文件 `include/` 目录
- 内嵌 JS 资源（framework.js 可作为编译期常量或外部文件）
- 独立 `CMakeLists.txt`，可作为 CMake 子项目引入

**范围约束：**
- Core 不依赖任何平台 API（不 include jni.h / UIKit / lvgl.h）
- Core 不包含编译器，只消费 RPK 产物
- Core 不负责 UI 线程调度（由平台层实现）
- V1 使用简化布局引擎替代 Yoga，接口不变可替换
- V1 使用 posix_event_loop 替代 libuv，接口不变可替换

**已验证的替代方案（来自 Android 实现）：**

| 原计划 | 实际实现 | 影响 |
|---|---|---|
| libuv EventLoop | posix_event_loop（std::mutex + condition_variable + min-heap timer） | 功能等价；无 IO 能力，后续需 fetch/socket 时替换 |
| Yoga 布局引擎 | layout_engine（手写垂直堆叠 Flex） | 仅支持 column + width/height/margin/padding；接口不变可替换 |
| minizip | 手写 ZIP Central Directory 解析 + zlib inflate | 功能够用，零外部依赖 |
| cJSON | 复用 QuickJS 的 JS_ParseJSON | 零新增依赖 |

---

## Glossary

| 术语 | 定义 |
|---|---|
| Core | quickapp-runtime-core 库本身 |
| PlatformBridge | Core → 平台层的渲染命令接口（函数指针），负责 createElement/setAttr/setStyle/setEvent/removeElement |
| PlatformEventSink | 平台层 → Core 的事件入口（click/input/lifecycle），独立于 PlatformBridge |
| JSEngine | JS 引擎抽象接口，当前唯一实现为 QuickJS |
| QuickJSEngine | JSEngine 的 QuickJS 实现，封装 JSRuntime/JSContext |
| RuntimeEventLoop | 统一任务调度抽象（post/postDelayed/cancelTimer/run/stop） |
| PosixEventLoop | RuntimeEventLoop 的 POSIX 实现（condition_variable + min-heap timer） |
| RuntimeThread | 拥有 EventLoop + JSEngine 的独立线程，所有 JS 执行和 Core 状态访问在此线程 |
| NativeModule | 可扩展的系统模块基类（类 TurboModule），定义 getName() + getMethods() |
| ModuleRegistry | 模块注册表，支持动态注册和按名查找 |
| JS Bridge | 注入 JS 全局函数（$app_define$/$app_bootstrap$/$app_require$/__native_render__/console）的机制 |
| VNode | 虚拟节点数据结构，表示页面 UI 树 |
| StyleSheet | 选择器 → 样式属性映射，来自 page bundle 编译产物 |
| StyleResolver | 根据 classList 匹配 StyleSheet 并合并样式到 VNode |
| LayoutEngine | 布局计算抽象，V1 内置简化 Flex，可替换为 Yoga |
| RPKLoader | 从内存 buffer 打开 ZIP 格式 RPK，提供文件读取接口 |
| ManifestParser | 将 manifest.json 解析为结构化 Manifest 模型 |
| RuntimeBootstrap | 编排完整启动序列的入口函数 |
| RuntimeHost | 平台层与 Core 交互的顶层 API（初始化/启动/事件投递/销毁） |

---

## Requirements

### 需求 1：跨平台编译与项目结构

**用户故事：** 作为多端开发者，我希望同一套 Core 源码能在 Android NDK、iOS Xcode、Linux/macOS 桌面上编译为静态库，以便三端共享同一份代码。

#### 验收标准

1. Core SHALL 提供独立的 `CMakeLists.txt`，支持 `cmake --build .` 生成 `libquickapp-core.a`
2. Core SHALL 不 include 平台专有头文件（jni.h、UIKit/*.h、lvgl.h）
3. Core SHALL 在 Linux/macOS 上无 Android NDK 依赖即可编译验证
4. 第三方依赖（QuickJS 源码）SHALL 随 Core 一起编译，不需要外部包管理器
5. zlib SHALL 使用系统自带或条件编译内置，不依赖 apt/brew 安装
6. Core 编译 SHALL 使用 C++17 标准，`CMAKE_CXX_STANDARD_REQUIRED ON`
7. 编译产物 SHALL 为纯静态库，不生成 .so/.dylib

### 需求 2：日志抽象

**用户故事：** 作为平台集成者，我希望 Core 的日志输出通过可替换的宏/回调实现，以便 Android 用 `__android_log_print`、桌面用 `fprintf`、LVGL 用串口输出。

#### 验收标准

1. Core SHALL 定义 `QA_LOGI` / `QA_LOGW` / `QA_LOGE` 宏作为唯一日志输出方式
2. 日志宏 SHALL 支持 printf 风格格式化（`const char* fmt, ...`）
3. Core SHALL 提供默认实现（`fprintf(stderr, ...)`），桌面编译时可直接使用
4. 平台层 SHALL 可通过编译宏或链接期替换日志实现，不修改 Core 源码
5. Core 源码中 SHALL 不出现 `__android_log_print`、`NSLog`、`printf` 直接调用

### 需求 3：JS 引擎抽象与生命周期

**用户故事：** 作为平台集成者，我希望 Core 通过抽象接口访问 JS 引擎，以便未来替换引擎（如 Hermes）不影响上层逻辑。

#### 验收标准

1. Core SHALL 定义 `JSEngine` 纯虚接口：initialize、destroy、eval、hasError、getLastError
2. `QuickJSEngine` SHALL 作为唯一实现，封装 JSRuntime/JSContext 的创建与销毁
3. Core 其他模块 SHALL 只通过 `JSEngine*` 指针访问引擎，不 include `quickjs.h`（仅 QuickJSEngine 实现文件除外）
4. `createJSEngine()` 工厂函数 SHALL 返回当前平台默认引擎实例
5. 引擎初始化失败 SHALL 返回 false 并通过 `getLastError()` 提供错误描述
6. destroy() SHALL 释放所有 JSRuntime/JSContext 资源，多次调用 SHALL 安全（幂等）

### 需求 4：任务调度与线程模型

**用户故事：** 作为运行时开发者，我希望 QuickJS 有独立线程保护和统一任务调度，以便多线程环境下安全运行且能支持 Timer/异步回调。

#### 验收标准

1. `RuntimeEventLoop` SHALL 定义纯虚接口：post / postDelayed / cancelTimer / run / stop / isRunning
2. `PosixEventLoop` SHALL 作为默认实现，使用 std::mutex + std::condition_variable + min-heap timer
3. `RuntimeThread` SHALL 在独立线程中创建 EventLoop + JSEngine，线程启动后进入 EventLoop.run()
4. 外部 SHALL 只能通过 `RuntimeThread::post()` 投递任务到 Runtime Thread
5. QuickJS 所有操作（eval / callFunction / JS_GetProperty 等）SHALL 只在 Runtime Thread 中执行
6. `stop()` SHALL 终止循环、唤醒等待线程、清理所有待执行任务和 Timer
7. EventLoop SHALL 在每轮任务执行后调用 `JS_ExecutePendingJob` 清空 Promise 微任务

### 需求 5：PlatformBridge 渲染命令

**用户故事：** 作为平台集成者，我希望 Core 通过统一函数指针接口发送渲染指令，各平台各自实现。

#### 验收标准

1. `PlatformBridge` SHALL 定义以下函数指针：createElement / setAttr / setStyle / setEvent / removeElement
2. `registerPlatformBridge(PlatformBridge bridge)` SHALL 由平台启动时调用，注册实现
3. Core SHALL 只通过 `getPlatformBridge()` 获取当前实现并发送命令
4. 平台未注册时 `isReady()` SHALL 返回 false，Core 不调用任何函数指针
5. `clearPlatformBridge()` SHALL 在 Runtime 销毁时清空所有函数指针为 nullptr
6. 函数指针参数 SHALL 使用基本类型（int / float / const char*），不包含平台特有类型

### 需求 6：PlatformEventSink 事件入口

**用户故事：** 作为平台集成者，我希望平台层的用户交互事件（click/input/lifecycle）能安全投递到 Core 的 Runtime Thread。

#### 验收标准

1. Core SHALL 定义 `PlatformEventSink` 接口，包含 dispatchClick / dispatchInput / dispatchLifecycle
2. 事件投递 SHALL 线程安全 — 可从任意线程调用，内部通过 EventLoop.post() 转发到 Runtime Thread
3. 事件到达 Runtime Thread 后 SHALL 按投递顺序串行处理
4. Runtime 进入 Stopping/Destroyed 状态后 SHALL 丢弃新事件，不访问已释放对象
5. PlatformEventSink SHALL 与 PlatformBridge 方向相反且独立 — 事件通道不混入渲染指令通道


### 需求 7：NativeModule 与模块注册

**用户故事：** 作为模块开发者，我希望新增系统能力（如 geolocation、fetch）只需注册一个 NativeModule，不修改 JS Bridge 内核代码。

#### 验收标准

1. `NativeModule` 基类 SHALL 定义 `getName()` 返回模块标识（如 "system.router"）
2. `NativeModule` 基类 SHALL 定义 `getMethods()` 返回方法列表（名称 + 函数指针 + 参数数量）
3. `ModuleRegistry` SHALL 支持动态注册：`registerModule(std::unique_ptr<NativeModule>)`
4. `ModuleRegistry` SHALL 支持按名查找：`findModule(const char* name)` 返回指针或 nullptr
5. 新增模块 SHALL 不需要修改 js_bridge.cpp 或 module_registry.cpp 中的 if-else 分支
6. 内置模块（router / prompt）SHALL 在 RuntimeBootstrap 中通过 Registry 注册

### 需求 8：JS Bridge 注入

**用户故事：** 作为框架开发者，我希望 Core 在 JS 引擎初始化后注入所有全局函数和模块访问机制，以便 framework.js 和 page bundle 能调用 native 能力。

#### 验收标准

1. `installJSBridge()` SHALL 向 JS 全局注入以下函数：$app_define$ / $app_bootstrap$ / $app_require$ / __native_render__ / console.log / console.warn / console.error
2. `$app_require$(name)` SHALL 从 ModuleRegistry 查找模块并返回 JS 对象（QuickJS JSClass 实例）
3. 模块方法 SHALL 挂在 JSClass prototype 上，通过 JS_GetOpaque(this_val) 取回 C++ 实例
4. JS Bridge 注入 SHALL 在 eval(framework.js) 之前完成
5. 注入函数签名 SHALL 遵循 QuickJS `JSCFunction` 规范，参数通过 `JS_ToCString` / `JS_ToInt32` 零序列化解析
6. JS 到 C++ 的字符串 SHALL 在使用后调用 `JS_FreeCString` 释放

### 需求 9：RPK 加载与 Manifest 解析

**用户故事：** 作为 Core 使用者，我希望从内存 buffer 加载 RPK 并解析 manifest，以便不依赖平台文件 IO 接口。

#### 验收标准

1. `RPKLoader` SHALL 从 `const uint8_t* data, size_t size` 打开 ZIP 格式 RPK
2. `readText(const char* path)` SHALL 返回 ZIP 内指定文件的文本内容（UTF-8）
3. `fileExists(const char* path)` SHALL 判断 ZIP 内文件是否存在
4. `ManifestParser` SHALL 将 JSON 字符串解析为 Manifest 结构体
5. Manifest 结构体 SHALL 包含：package / name / versionName / versionCode / entry（从 router 解析） / pages 列表 / display 配置 / features 列表
6. 无效 ZIP（magic number 错误、CRC 校验失败）SHALL 返回 false 并设置错误信息
7. 无效 JSON 或缺少必填字段 SHALL 返回 false 并设置包含字段名的错误信息
8. RPKLoader SHALL 不调用平台文件系统 API（fopen/AssetManager），数据由平台层读取后传入

### 需求 10：VNode 构建与样式解析

**用户故事：** 作为渲染管线开发者，我希望 JS template 对象能递归转换为 C++ VNode 树，并完成 classList → style 的匹配合并。

#### 验收标准

1. VNode 结构体 SHALL 包含：id / type / attrs（map） / styles（map） / events（map） / classList（vector） / children（vector） / layout（LayoutBox）
2. 节点 ID SHALL 全局唯一自增（int），由 Core 分配
3. `buildVNode(JSContext* ctx, JSValue templateObj)` SHALL 递归遍历 JS template 对象，创建 VNode 树
4. `StyleResolver::resolve(VNode* root, const StyleSheet& sheet)` SHALL 遍历树，根据每个节点的 classList 查找 StyleSheet 并合并到 node->styles
5. 样式合并 SHALL 按 classList 顺序叠加，后者覆盖前者
6. 未匹配到样式的 classList 条目 SHALL 跳过，不报错

### 需求 11：布局计算

**用户故事：** 作为渲染管线开发者，我希望 VNode 树经过布局计算后，每个节点得到像素级的 x/y/width/height，供 PlatformBridge 使用。

#### 验收标准

1. `calculateLayout(VNode* root, float containerWidth, float containerHeight)` SHALL 为每个节点计算 LayoutBox（x/y/width/height）
2. SHALL 支持 flexDirection: column（垂直堆叠，V1 唯一方向）
3. SHALL 支持样式属性：width / height / margin（四边） / padding（四边）
4. 未指定 width 的子节点 SHALL 默认继承父节点内容区宽度
5. 未指定 height 的子节点 SHALL 默认使用固定值（如 40px）或由内容撑开
6. LayoutEngine 接口 SHALL 可替换 — 内置简化版和 Yoga 实现相同的 calculateLayout 签名

### 需求 12：Runtime 启动序列

**用户故事：** 作为平台集成者，我希望一次调用完成完整启动链路，不需要手动编排各模块初始化顺序。

#### 验收标准

1. `bootstrapRuntime(engine, rpkData, rpkSize, bridge)` SHALL 按以下顺序执行：注册模块 → 注入 JS Bridge → RPK 加载 → Manifest 解析 → eval(framework.js) → eval(app.js) → eval(entry page bundle) → VNode 构建 → 样式解析 → 布局计算 → PlatformBridge 渲染命令发送
2. 任一步骤失败 SHALL 立即返回 false 并通过错误接口提供失败阶段和原因
3. framework.js 执行后 JS 全局 SHALL 存在 $app_define$ / $app_bootstrap$ / $app_require$
4. page bundle 执行后 `__native_render__` SHALL 被调用，触发 VNode 构建和渲染
5. 启动序列 SHALL 在 RuntimeThread 上执行，不阻塞平台 UI 线程

### 需求 13：三端集成接口

**用户故事：** 作为 Android/iOS/LVGL 平台开发者，我希望有明确的集成 API 和步骤，以便将 Core 接入我的平台项目。

#### 验收标准

1. Core SHALL 提供 `RuntimeHost` 顶层接口：create / start / dispatchEvent / destroy
2. `RuntimeHost::create(config)` SHALL 接收 PlatformBridge 实现和 RPK 数据
3. `RuntimeHost::start()` SHALL 启动 RuntimeThread 并执行 bootstrapRuntime
4. `RuntimeHost::dispatchEvent(event)` SHALL 线程安全地将平台事件投递到 Runtime
5. `RuntimeHost::destroy()` SHALL 停止 EventLoop → 等待线程退出 → 释放引擎 → 清空 Bridge
6. Android 集成 SHALL 只需：CMake `add_subdirectory` + 实现 PlatformBridge 函数 + 调用 RuntimeHost
7. iOS 集成 SHALL 只需：Xcode 添加 Core 源码/静态库 + 实现 PlatformBridge + 调用 RuntimeHost
8. LVGL 集成 SHALL 只需：CMake `add_subdirectory` + 实现 PlatformBridge（LVGL Widget） + 调用 RuntimeHost
