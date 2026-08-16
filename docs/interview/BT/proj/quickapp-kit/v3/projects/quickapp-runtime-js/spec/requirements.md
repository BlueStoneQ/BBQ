# JS Runtime 总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 项目使命](#2-项目使命)
- [3. 输入与输出](#3-输入与输出)
- [4. V1 功能需求](#4-v1-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 边界与后置项](#6-边界与后置项)

## 1. 结论

JS Runtime 的本质是：**执行应用动态语义，把 state 变化转换为最小 Render 意图，把 Core 事件转换为 JS Handler 调用。**

它维护 VM、依赖和 Handler，不维护完整 VNode Tree，不接触 Runtime `NodeId` 或平台对象。

## 2. 项目使命

```text
Core Verified Module + Context/Dispatch
  -> JS Framework + selected Engine Provider + Module ABI
  -> App/Page VM + reactive Binding/Block + Handler
  -> typed Runtime ABI messages
```

JS Runtime 是联盟 JS 语义与平台无关 Core 合同之间的适配层。

## 3. 输入与输出

### 3.1 输入

- Core 通过 `VerifiedModulePort` 交付的 App、Shared、Page immutable Bundle bytes、bootstrap metadata、依赖和 page expected Binding/Handler ID。
- Core 提供的 `AppContext`、`SurfaceContext`、`LifecycleDispatch`、Event Dispatch 和异步 Result。
- 通过 `JsEnginePort` Native Function Binding 获得的同步 `EnqueueResult`；QuickJS External Function 不属于 Framework 输入。
- Runtime Host 注入的单调时钟与本地 `ObservationEmitter`；它复用公共 TraceSink，但不形成第二条业务 Bridge。

### 3.2 输出

- `LoadVerifiedModuleResult` 与 App/Page VM、`LifecycleResult`。
- `InstantiateTemplate` 与增量 `RenderTransaction`。
- Handler 注册/解绑消息。
- Navigation、Capability、Page Control typed request。
- JS 错误、阶段耗时、Dirty/Transaction/Handler Trace。

## 4. V1 功能需求

| ID | 需求 |
|---|---|
| JS-R01 | 定义平台无关 `JsEnginePort`，提供 QuickJS V1 Engine Provider，并把所有引擎对象限制在 Provider/JS Executor 所有权内。 |
| JS-R02 | 只接受 Core 在 Package verified 后通过 `onLoadVerifiedModule` 发出的请求；注入 `$app_define$/$app_bootstrap$/$app_require$`，按 bootstrap/dependencies 校验 moduleId，并以 `completeVerifiedModuleLoad` 返回 typed loaded/failed Result；双方不得同步等待。 |
| JS-R03 | App/Shared module 在一个 App JS Runtime 内缓存一次；每个 Surface 创建独立 Page VM。 |
| JS-R04 | 校验 Page bootstrap 的 moduleId/templateId，以及 evaluator/handler export 与 Core 交付 expected Binding/Handler ID 集合的一一对应关系；JS 不读取 Page IR。 |
| JS-R05 | 接收 `AppContext/SurfaceContext` 和 `VmInitializationDispatch`，串行执行 `onCreate` 或 `onInit/initialEvaluation/onReady` 并返回一次 typed initialization Result；接收 `LifecycleDispatch` 执行可见性/销毁 Hook 并返回一次 `LifecycleResult`。 |
| JS-R06 | 用 state 代理和依赖索引跟踪 Binding/Block Dirty；不通过重建完整 VNode Tree 发现变化。 |
| JS-R07 | 同一轮同步 state 写入在 Handler 或 lifecycle 返回后的 microtask checkpoint 合并 flush。 |
| JS-R08 | 初始 Binding/Block/Handler 与 `onInit/onReady` 写入合并为一个 `InstantiateTemplate`；Page initialization completed 后按同一队列顺序提交，failed 时禁止提交。 |
| JS-R09 | 增量更新只生成 `updateBinding/instantiateBlock/removeBlock/moveBlock`；Binding 只提交 OwnerInstanceId + TemplateBindingId + value。 |
| JS-R10 | keyed Block 复用原 `BlockInstanceId`；实例 ID 与 HandlerId 在 Surface 生命周期内唯一且不复用。 |
| JS-R11 | 同一 Surface 只提交一个在途 Render；等待 presented/rejected 后再决定下一 Revision。 |
| JS-R12 | 维护绑定级 Handler Registry；注册只提交 OwnerInstanceId + TemplateHandlerId + HandlerId。可回滚删除按 `live -> retiring -> released` 执行，Render/Handler 失败时恢复 live；Surface teardown 才允许强制清理。 |
| JS-R13 | 接收 `JsEventDispatch` 后检查 Surface 仍存活且 Handler 为 live 或 retiring；两者都执行已合法路由的事件，released 才丢弃；调用返回后 flush。 |
| JS-R14 | 提供 `system.router.push/back`、prompt/device 固定 typed Facade 与 Promise/callback 适配；`supports` 固定为 Manifest declaration AND Core Registry descriptor，查询不创建 Provider；`system.fetch.fetch` deferred facade 固定 false，调用直接 rejected `CAPABILITY_UNSUPPORTED` 且不进入 Core。 |
| JS-R15 | 提供 `$page.setTitleBar/setMeta` typed API，只在 SurfaceContext 声明能力时暴露。 |
| JS-R16 | Runtime ABI 使用 `JsEnginePort` Native Function Binding；QuickJS Provider 映射为 External Function，业务数据必须先解码为公共 typed message。 |
| JS-R17 | Surface 销毁后取消 pending Promise/callback、清理 VM/Handler/依赖和待提交 Dirty。 |
| JS-R18 | JS 异常转为 `JS_EXCEPTION` 与 Trace，不让异常穿透 C++ 或使 Runtime 崩溃。 |
| JS-R19 | JS Framework 不得依赖 QuickJS、Platform、Backend 或可选 Provider；Composition Root 必须且只能注入一个满足 `quickapp-kit-js-engine-v1` 的 Engine Provider，V1 默认 QuickJS，外围选择不得引入第二条 Bridge。 |
| JS-R20 | JS Runtime Service 必须按公共 Observation Contract 发出 Module、Lifecycle、Handler、Dirty/Flush 和 ABI request/result 结构化 Marker；使用整数纳秒，不格式化文本、不执行 I/O，Noop 观测不得改变 JS 执行结果。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 确定性 | 相同 VM 状态和输入顺序产生相同 Render operations 与 ID 顺序。 |
| 内存 | Page 销毁后无 JS 引用、Handler、evaluator、Promise 或 module page state 残留。 |
| 背压 | 单在途 Render；Dirty 在等待期间继续合并，不无限积累事务。 |
| 平台无关 | 不引用 JNI、Android、UIKit、LVGL、SDL 和 NativeHandle。 |
| 可组合 | JS Framework 是必选 Runtime Service；具体 Engine Provider 可替换且由 Platform Composition Root 编译期选择，一个产物只能链接一个 Engine。 |
| 合同唯一 | 不发明通用 Bridge，不接收 Runtime NodeId，不复制 Core 状态机。 |
| 可观测 | Hook、Handler、Dirty flush、ABI request/result 可通过 Surface 和请求 ID 关联；观测是本地 Runtime Service，不进入业务消息。 |

## 6. 边界与后置项

V1 不做：

- 完整 VNode Tree、完整树 Diff 或 Host Tree 镜像。
- C++ Runtime Tree、Layout、Navigation 栈或平台 UI。
- 任意 module/method/JSON args 反射 Bridge。
- 同一产物链接多个 JS Engine、运行时热切换、失败后自动换 Engine、并行 Page JS Thread。
- 完整 Promise 调度器替代或独立 EventLoop 基础设施。
