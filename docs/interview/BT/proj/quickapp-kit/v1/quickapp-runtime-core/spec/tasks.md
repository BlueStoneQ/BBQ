# Tasks Document

## 目录

- [Overview](#overview)
- [Phase 1：项目骨架与基础设施](#phase-1项目骨架与基础设施)
- [Phase 2：核心引擎与调度](#phase-2核心引擎与调度)
- [Phase 3：模块系统与数据加载](#phase-3模块系统与数据加载)
- [Phase 4：渲染管线与启动序列](#phase-4渲染管线与启动序列)
- [Phase 5：三端集成](#phase-5三端集成)
- [任务依赖关系](#任务依赖关系)
- [需求覆盖矩阵](#需求覆盖矩阵)
- [Step 文档索引](#step-文档索引)

---

## Overview

将 quickapp-runtime-android 中 `app/src/main/cpp/core/` 已验证的代码抽取为独立跨平台库。分 5 个 Phase，共 11 个 Step。

**前提：**
- quickapp-runtime-android 全部 13 个 Step 已完成
- C++ Core 代码在 Android 上端到端验证通过（`./gradlew clean :app:assembleDebug` → BUILD SUCCESSFUL）
- 所有核心模块已在 Android 平台上验证：JSEngine、EventLoop、JSBridge、RPKLoader、VNode、Layout、PlatformBridge

**产出：**
- 独立的 `quickapp-runtime-core/` 目录
- `libquickapp-core.a` 静态库
- 可被 Android / iOS / LVGL 作为 CMake 子项目引入
- 桌面端（Linux/macOS）可独立编译验证

---

## Phase 1：项目骨架与基础设施

### Step 01：抽取策略与边界划分

**目标：** 确定从 Android 工程抽取的文件清单、平台依赖剥离点、目标目录结构。

**产出：**
- 抽取清单表（哪些文件移入 Core，哪些留在平台层）
- 平台依赖识别（`__android_log_print`、`<jni.h>`、Android AssetManager）
- 日志抽象层设计方案
- 目标目录结构图

**验收：** 清单中所有文件与 Android 工程当前文件一一对应，无遗漏

**Step 文档：** `steps/01-extract-strategy.md`

---

### Step 02：独立 CMake 与 QuickJS 编译

**目标：** 建立独立 CMake 项目，将 QuickJS 源码编译为 Core 的一部分，生成 `libquickapp-core.a`。

**产出：**
- `CMakeLists.txt`（顶层）
- `third_party/quickjs/` 源码放置
- 编译为 `libquickapp-core.a`
- Linux/macOS 本机 `cmake --build .` 验证

**验收：** `cmake -B build && cmake --build build` 成功生成 `libquickapp-core.a`

**Step 文档：** `steps/02-cmake-third-party.md`

---

### Step 03：日志抽象层

**目标：** 实现 `qa_log.h` 宏，替换 Android 工程中所有 `__android_log_print` 调用。

**产出：**
- `include/qa_log.h`
- 默认 `fprintf(stderr, ...)` 实现
- 编译宏 `QA_LOG_IMPL_ANDROID` / `QA_LOG_IMPL_CUSTOM` 切换机制

**验收：** Core 编译后 `nm libquickapp-core.a | grep __android_log_print` 无结果

**Step 文档：** `steps/03-log-abstraction.md`

---

## Phase 2：核心引擎与调度

### Step 04：JSEngine 抽象与 QuickJS 实现

**目标：** 从 Android 工程迁移 `js_engine.h` + `quickjs_engine.cpp`，建立引擎抽象层。

**产出：**
- `include/js_engine.h`（纯虚接口）
- `src/quickjs_engine.cpp`（QuickJS 实现）
- `createJSEngine()` 工厂函数
- 测试：eval 脚本 + Native 函数注册 + 错误捕获

**验收：** 桌面编译运行测试程序：eval `"1+1"` 返回 2；eval 非法语法 hasError() = true

**Step 文档：** `steps/04-jsengine.md`

---

### Step 05：EventLoop 与 RuntimeThread

**目标：** 迁移任务调度和线程管理，建立 RuntimeThread 所有权模型。

**产出：**
- `include/runtime_event_loop.h`（抽象接口）
- `include/runtime_thread.h`
- `src/runtime_thread.cpp`
- `platform/common/posix_event_loop.h` + `posix_event_loop.cpp`

**验收：** 测试程序：post 任务在 RuntimeThread 执行、postDelayed 延迟触发、stop 后线程退出

**Step 文档：** `steps/05-eventloop-thread.md`

---

### Step 06：PlatformBridge 与 PlatformEventSink

**目标：** 迁移渲染命令接口和事件入口，建立双向通信通道。

**产出：**
- `include/platform_bridge.h`
- `src/platform_bridge.cpp`
- `include/platform_event_sink.h`
- `src/platform_event_sink.cpp`

**验收：** 注册 mock bridge → isReady() = true → createElement 调用 mock 函数计数 +1；dispatchEvent 从外部线程投递 → RuntimeThread 收到

**Step 文档：** `steps/06-platform-bridge.md`

---

## Phase 3：模块系统与数据加载

### Step 07：NativeModule + ModuleRegistry + JS Bridge

**目标：** 迁移模块系统和 JS Bridge 注入机制。

**产出：**
- `include/native_module.h`（基类）
- `include/module_registry.h`
- `include/js_bridge.h`
- `src/module_registry.cpp`
- `src/js_bridge.cpp`
- `src/router_module.cpp`
- `src/prompt_module.cpp`

**验收：** installJSBridge 后 eval `$app_require$("@app-module/system.router").push({uri:"/test"})` → C++ RouterModule 收到 push 调用

**Step 文档：** `steps/07-module-jsbridge.md`

---

### Step 08：RPKLoader 与 ManifestParser

**目标：** 迁移 ZIP 读取和 Manifest 解析，不依赖平台文件系统。

**产出：**
- `include/rpk_loader.h`
- `include/manifest_parser.h`
- `src/rpk_loader.cpp`
- `src/manifest_parser.cpp`

**验收：** 从测试 RPK 字节数组加载 → readText("manifest.json") 返回内容 → parseManifest 提取 entry 路径正确

**Step 文档：** `steps/08-rpk-manifest.md`

---

## Phase 4：渲染管线与启动序列

### Step 09：VNode + StyleResolver + LayoutEngine

**目标：** 迁移虚拟节点树、样式匹配和布局计算。

**产出：**
- `include/vnode.h`
- `include/style_resolver.h`
- `include/layout_engine.h`
- `src/vnode.cpp`
- `src/style_resolver.cpp`
- `src/layout_engine.cpp`

**验收：** 构建 3 节点 VNode 树 → resolveStyles 后 styles 非空 → calculateLayout 后每个节点 width/height > 0

**Step 文档：** `steps/09-vnode-style-layout.md`

---

### Step 10：RuntimeBootstrap + RuntimeHost

**目标：** 实现完整启动序列编排和对外顶层 API。

**产出：**
- `include/runtime_bootstrap.h`
- `include/runtime_host.h`
- `src/runtime_bootstrap.cpp`
- `src/runtime_host.cpp`
- `js/framework.js`（内嵌或外部文件）

**验收：** RuntimeHost.create + start，使用 mock RPK + mock bridge → framework 执行 → __native_render__ 被调用 → PlatformBridge mock 收到 createElement

**Step 文档：** `steps/10-runtime-bootstrap.md`

---

## Phase 5：三端集成

### Step 11：平台集成指引

**目标：** 提供 Android / iOS / LVGL 三端替换消费 Core 的完整操作步骤。

**产出：**
- Android：改 CMakeLists 用 `add_subdirectory`，删原 core 目录，验证 build
- iOS：Xcode 项目配置 + ObjC++ PlatformBridge 桩实现
- LVGL：CMake 子项目 + LVGL Widget PlatformBridge 桩实现
- 各平台需实现的函数清单

**验收：** Android `./gradlew :app:assembleDebug` 使用外部 Core 仍然 BUILD SUCCESSFUL

**Step 文档：** `steps/11-platform-integration.md`

---

## 任务依赖关系

```text
Phase 1：项目骨架与基础设施
  Step 01 抽取策略
      ↓
  Step 02 CMake + QuickJS
      ↓
  Step 03 日志抽象
      ↓
Phase 2：核心引擎与调度
  Step 04 JSEngine
      ↓
  Step 05 EventLoop + RuntimeThread
      ↓
  Step 06 PlatformBridge + EventSink
      ↓
Phase 3：模块系统与数据加载
  Step 07 NativeModule + JSBridge
      ↓
  Step 08 RPKLoader + ManifestParser
      ↓
Phase 4：渲染管线与启动序列
  Step 09 VNode + Style + Layout
      ↓
  Step 10 RuntimeBootstrap + RuntimeHost
      ↓
Phase 5：三端集成
  Step 11 平台集成指引
```

每个 Step 依赖前一个 Step 的产出。Step 11 额外依赖 quickapp-runtime-android 现有代码作为集成验证目标。

---

## 需求覆盖矩阵

| 需求 | 覆盖 Step |
|---|---|
| 需求 1：跨平台编译与项目结构 | Step 01, 02 |
| 需求 2：日志抽象 | Step 03 |
| 需求 3：JS 引擎抽象与生命周期 | Step 04 |
| 需求 4：任务调度与线程模型 | Step 05 |
| 需求 5：PlatformBridge 渲染命令 | Step 06 |
| 需求 6：PlatformEventSink 事件入口 | Step 06 |
| 需求 7：NativeModule 与模块注册 | Step 07 |
| 需求 8：JS Bridge 注入 | Step 07 |
| 需求 9：RPK 加载与 Manifest 解析 | Step 08 |
| 需求 10：VNode 构建与样式解析 | Step 09 |
| 需求 11：布局计算 | Step 09 |
| 需求 12：Runtime 启动序列 | Step 10 |
| 需求 13：三端集成接口 | Step 10, 11 |

---

## Step 文档索引

| Step | 文件 | 主题 |
|---|---|---|
| 01 | `steps/01-extract-strategy.md` | 抽取清单、边界划分、日志抽象设计 |
| 02 | `steps/02-cmake-third-party.md` | 独立 CMake + QuickJS 编译 |
| 03 | `steps/03-log-abstraction.md` | 日志抽象层实现 |
| 04 | `steps/04-jsengine.md` | JSEngine 接口 + QuickJSEngine |
| 05 | `steps/05-eventloop-thread.md` | RuntimeEventLoop + RuntimeThread |
| 06 | `steps/06-platform-bridge.md` | PlatformBridge + PlatformEventSink |
| 07 | `steps/07-module-jsbridge.md` | NativeModule + ModuleRegistry + JS Bridge |
| 08 | `steps/08-rpk-manifest.md` | RPKLoader + ManifestParser |
| 09 | `steps/09-vnode-style-layout.md` | VNode + StyleResolver + LayoutEngine |
| 10 | `steps/10-runtime-bootstrap.md` | 启动序列 + RuntimeHost API |
| 11 | `steps/11-platform-integration.md` | 三端替换消费指引（Android/iOS/LVGL） |
