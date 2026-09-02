# JS/C++ 代码边界归位迁移 Spec

## 目录

- [1. 结论](#1-结论)
- [2. 已验证现状](#2-已验证现状)
- [3. 源码职责分类](#3-源码职责分类)
- [4. 目标边界](#4-目标边界)
- [5. 目录与 Target](#5-目录与-target)
- [6. 依赖方向](#6-依赖方向)
- [7. 迁移批次与回滚点](#7-迁移批次与回滚点)
- [8. 兼容入口](#8-兼容入口)
- [9. 验收](#9-验收)
- [10. 已知缺口](#10-已知缺口)
- [11. 实施结果](#11-实施结果)

## 1. 结论

本次只做代码所有权归位：`quickapp-runtime-core` 承载全部平台无关 C/C++ Runtime，`quickapp-runtime-js` 只承载纯 JS Framework、JS 测试和 Bundle 构建配置。

保持不变：`quickapp::js` namespace、`quickapp/js/...` include、现有 `quickapp_js_*` CMake Target、Runtime ABI、RPK、Runtime Tree、RenderTransaction、MountTransaction、Router 和三端运行行为。

当前没有完整独立的 JS Framework Bundle。Proxy、Dirty Binding、Block reconcile、RenderIntent 和 microtask flush 由 Toolkit 按页内联生成；本次不得通过删除 C++ 或把 JS 语义改写成 C++ 来伪造“独立 Bundle 已完成”。

## 2. 已验证现状

### 2.1 已验证事实

1. `quickapp-runtime-js` 当前生产源码全部是 C/C++，没有被 Runtime 加载的独立 `.js` Framework Bundle。
2. Toolkit 的 `js-module-emitter.ts` 将响应式页面运行逻辑直接写入每个页面 `index.js`。
3. Android、iOS、LVGL 均先加入 `quickapp-runtime-core`，再加入 `quickapp-runtime-js`，并链接旧 `quickapp_js_*` Target。
4. 三端源码只依赖公开 `quickapp/js/...` 头和旧 Target 名，因此可以由 Core 提供兼容 Target，不需要修改平台源码。
5. 现有 C++ `StaticFacadeCatalog` 是 typed Feature Facade 的兼容 Host 实现，不等价于纯 JS Facade。

### 2.2 本次合理决策

1. C++ 子系统迁入 Core 后继续保持独立 Target，不并入 Runtime Tree 或 Render Kernel 单体库。
2. 文件先迁移、Target 名暂不改；后续另行决定 `quickapp_js_* -> quickapp_core_js_*` 的公开命名迁移。
3. `quickapp-runtime-js` 的独立 CMake 工程改为 `LANGUAGES NONE`，不得间接编译 Core C/C++。

## 3. 源码职责分类

| 当前目录/Target | 当前职责 | 本次归属 | 说明 |
|---|---|---|---|
| `engine/engine_types`、`runtime_value`、`result`、`js_engine_port` | Provider 无关 JS Engine C++ Port 与值句柄 | Core `runtime/js` | 平台无关 C++ Runtime 基础设施 |
| `engine/JsEngineService` | JS Engine 生命周期、Job Drain、任务提交 | Core `runtime/js` | 必选 Runtime Service，不是 JS Framework 语义 |
| `JsExecutorBackend`、`LibuvEventLoopBackend` | JS owner thread、队列、wakeup、背压、teardown | Core `runtime/js` | 可替换平台无关 C++ Backend |
| `engine/observation` | JS Runtime 结构化观测 | Core `runtime/js` | 不做日志存储或平台采集 |
| `providers/quickjs`、QuickJS vendor Target | QuickJS Engine Adapter | Core `runtime/js/providers` | 具体 Engine Provider，仍可裁剪 |
| `abi/*` | typed Runtime ABI 编解码、Native Binding、关联和回调 | Core `runtime/js` | JS/C++ 唯一边界的 C++ Host |
| `module/module_loader` | Bundle definition、require、module VM value 生命周期 | Core `runtime/js` | 平台无关 C++ Module Host |
| `vm/*`、`page/page_host_control` | App/Page VM Host、生命周期、页面 Host API 绑定 | Core `runtime/js` | 不拥有业务状态和 Binding 语义 |
| `event/handler_registry` | JS Handler handle 注册、retire、释放 | Core `runtime/js` | C++ handle 生命周期，不是 JS handler 方法语义 |
| `framework/static_facade_catalog` | 现有 typed Feature native facade | Core `runtime/js` 兼容层 | 后续应由纯 JS Facade 替代，本次保持行为 |
| `binding/alpha_initial_binding_stage` | 调用 Bundle evaluator 取得首屏 Binding 值 | Core `runtime/js` 兼容编排 | 不新增 C++ 响应式状态系统 |
| `render/alpha_initial_transaction_builder` | 构造首屏 typed InstantiateTemplate | Core `runtime/js` 兼容编排 | 不拥有普通增量 RenderIntent 语义 |
| `alpha/alpha_page_initialization_stage` | 串联 initial binding 与首屏提交 | Core `runtime/js` 兼容编排 | 后续可由独立 JS Framework 简化 |
| `fakes/tests/tools/cmake/evidence` | 上述 C++ 子系统测试、边界扫描与证据 | Core `runtime/js` | 随被测代码迁移 |
| Toolkit 生成的 `__qak_reactive_page_vm__` | Proxy/Watcher、Dirty、Block、RenderIntent、microtask flush | 纯 JS Framework | 当前按页内联，尚未独立 Bundle |
| 页面 `handlerMethods` 和组件 VM | Handler 方法与组件运行语义 | 纯 JS Framework/应用 Bundle | 不迁入 Core |
| typed Feature Facade | JS API 到 typed Runtime ABI 的门面 | 纯 JS Framework | 当前由 C++ 兼容实现，独立 JS 版本待补 |

## 4. 目标边界

```text
quickapp-runtime-js
  src/*.js                 纯 JS Framework 源码
  test/*.mjs               纯 JS 行为测试
  package.json             Bundle/test 配置
  CMakeLists.txt           仅生成/校验 JS Bundle，不启用 C/CXX

quickapp-runtime-core
  runtime/js/include       原 quickapp/js 公共 C++ 头
  runtime/js/src           Engine/Executor/ABI/Module/VM/Binding Host
  runtime/js/providers     QuickJS Adapter
  runtime/js/fakes         C++ 测试替身
  runtime/js/tests         C++ 合同测试
  runtime/js/cmake         C++ 边界检查
  runtime/js/tools         C++ probe
  runtime/js/evidence      历史实现证据
```

## 5. 目录与 Target

### 5.1 旧新路径映射

| 旧路径 | 新路径 |
|---|---|
| `quickapp-runtime-js/include/quickapp/js` | `quickapp-runtime-core/runtime/js/include/quickapp/js` |
| `quickapp-runtime-js/src` | `quickapp-runtime-core/runtime/js/src` |
| `quickapp-runtime-js/providers` | `quickapp-runtime-core/runtime/js/providers` |
| `quickapp-runtime-js/fakes` | `quickapp-runtime-core/runtime/js/fakes` |
| `quickapp-runtime-js/tests/*.cpp` | `quickapp-runtime-core/runtime/js/tests/*.cpp` |
| `quickapp-runtime-js/tools/*.cpp` | `quickapp-runtime-core/runtime/js/tools/*.cpp` |
| `quickapp-runtime-js/cmake` | `quickapp-runtime-core/runtime/js/cmake` |
| `quickapp-runtime-js/evidence` | `quickapp-runtime-core/runtime/js/evidence` |

### 5.2 兼容 Target

本次继续由 Core 定义：

```text
quickapp_js_engine_api
quickapp_js_executor
quickapp_js_event_loop_libuv
quickapp_js_runtime_abi
quickapp_js_module_loader
quickapp_js_event
quickapp_js_static_facades
quickapp_js_page_host_control
quickapp_js_vm_lifecycle
quickapp_js_alpha_initial_binding
quickapp_js_alpha_initial_render
quickapp_js_alpha_page_stage
quickapp_quickjs_vendor
quickapp_js_engine_quickjs
```

旧 Target 名只表示 ABI/链接兼容，不表示代码仍属于 `quickapp-runtime-js` 仓库。

## 6. 依赖方向

```text
Platform Composition Root
  -> Core C++ Runtime modules
  -> Core runtime/js C++ Host modules
  -> selected QuickJS Provider
  -> pure JS Framework Bundle

pure JS Framework
  -> typed Runtime ABI
  -X-> Core C++ headers

Core runtime/js C++ Host
  -> Core public contracts/ports
  -X-> Android/UIKit/LVGL

Core fixed Runtime modules
  -X-> QuickJS Provider
  -X-> Platform Adapter
```

## 7. 迁移批次与回滚点

| 批次 | 动作 | 批次验收 | 回滚点 |
|---|---|---|---|
| M1 | 迁移 Engine API、Executor、EventLoop、Observation | Core 构建；EventLoop 双后端测试 | 恢复原文件和 JS CMake engine Target |
| M2 | 迁移 ABI、Module Loader、QuickJS Provider | JS-S01/S02/S03 C++ 测试 | 恢复 ABI/Module/Provider 路径 |
| M3 | 迁移 VM、Page、Handler、Facade、Alpha Binding/Render | JS-S04 和边界扫描 | 恢复 Host 编排路径 |
| M4 | 迁移 C++ tests/fakes/tools/evidence；Core 统一承载 Target | Core 全量 CTest | 恢复测试入口 |
| M5 | JS 仓库改为纯 JS 工程，增加来源与缺口检查 | JS test；仓库无 C/C++ 文件 | 恢复兼容 CMake 入口 |
| M6 | 三端兼容入口和同一真实 RPK 回归 | LVGL/Android/iOS 构建清单 | 只回滚 Composition/Target 接线 |

每批只允许路径和构建归属变化；出现 ABI、消息或运行结果变化立即回滚该批。

## 8. 兼容入口

1. Android、iOS、LVGL 仍按原顺序 `add_subdirectory(core)`、`add_subdirectory(js)`。
2. Core 首先定义全部旧 `quickapp_js_*` Target；JS CMake 不重复定义，也不编译 C/C++。
3. 平台现有 `target_link_libraries(... quickapp_js_*)` 无需修改。
4. `quickapp/js/...` 头由兼容 Target 的 PUBLIC include path 提供；平台源码无需改 include。
5. 原 JS 仓库独立 C++ 构建入口停止承担 C++ 测试；等价 C++ 测试迁入 Core。JS 仓库独立入口只构建和测试纯 JS Bundle。

## 9. 验收

1. Core 配置、全量构建和 Core + migrated JS C++ CTest 全部通过。
2. `quickapp-runtime-js` 的 CMake project 不启用 C/CXX，仓库中没有 `.c/.cc/.cpp/.h/.hpp`。
3. JS 仓库纯 JS 测试通过，并明确检查当前 Framework 来源与已知缺口。
4. Android、iOS、LVGL 的 CMake 源码不修改，旧 Target 可解析。
5. 同一真实 RPK 在迁移前后保持 JS、渲染、事件、路由、microtask 和 teardown 结果。
6. 输出完整旧新路径映射、迁移文件清单及三端待重建事项。

## 10. 已知缺口

1. **独立 Bundle 缺口**：响应式运行逻辑仍由 Toolkit 按页内联，尚未改为依赖 `quickapp-runtime-js` 的版本化 Framework Bundle。
2. **typed Feature Facade 缺口**：当前 `StaticFacadeCatalog` 仍是 C++ native facade；纯 JS facade 尚未覆盖现有模块。
3. **组件运行语义缺口**：部分语义仍由 Toolkit 生成页面代码和 C++ Alpha Host 共同完成，尚未完全收敛为纯 JS Framework。
4. **重复代码缺口**：每页内联 Proxy/Block runtime 增加 RPK 体积；本次因保持 RPK 不变不处理。
5. **下一阶段原则**：先定义版本化 JS Framework Bundle 和 Toolkit 引用合同，再删除 C++ 兼容 Host；不得反向把 Proxy、Watcher、Dirty 或 RenderIntent 计算下沉到 Core。

## 11. 实施结果

### 11.1 结论

代码所有权归位完成，Runtime 行为和公共合同未改变。`quickapp-runtime-core/runtime/js` 现承载 71 个迁移文件，其中 45 个是生产头文件或实现；`quickapp-runtime-js` 不再包含或编译 C/C++。

独立 JS Framework Bundle **未完成，也未伪装完成**。当前唯一真实来源仍是 Toolkit 的 `js-module-emitter.ts` 按页注入；JS 仓库通过 `framework/source.json` 声明该状态，并在测试中直接检查真实生成器包含 Proxy、Dirty、RenderIntent 和 microtask flush 主链。

### 11.2 验证结果

| 验证项 | 结果 |
|---|---|
| Core + 迁入 C++ Runtime 全量构建/CTest | `30/30 PASS` |
| JS 纯源码边界 npm/CMake/CTest | `PASS`，`independent_bundle=false` |
| Case 001 / JsExecutorBackend | `exit=0`，事件、路由、详情页、teardown 通过 |
| Case 001 / LibuvEventLoopBackend | 与 JsExecutor 输出一致，`resources_released=true` |
| LVGL 旧 Target 入口 | `quickapp_runtime` 构建通过 |
| Android 旧 Gradle/CMake 入口 | `:quickapp-host:assembleDebug` 构建通过 |
| iOS Host 入口 | `quickapp_ios_spine_probe` 构建通过 |
| iOS Simulator 入口 | arm64 Simulator App 构建通过 |

真实 RPK 未修改：`tk-s07-case001.rpk` SHA-256 为 `9812df4762e3821b26040f8b0b26ce7689d3dcd9ea9eef803510a9b05f6f79ca`。

### 11.3 三端后续事项

1. Android、iOS、LVGL 当前无需修改源码；Core 提供旧 `quickapp_js_*` Target 和 `quickapp/js/...` PUBLIC include。
2. 三端后续可删除对纯 JS 仓库的空 `add_subdirectory`，但这只是构建清理，不阻塞当前结果。
3. iOS Simulator 构建仍有平台仓库既有编译警告；本次不扩展范围处理。
4. 下一阶段单独设计版本化 JS Framework Bundle 及 Toolkit 引用合同；该阶段可能改变 RPK 产物，不能混入本次职责迁移。
