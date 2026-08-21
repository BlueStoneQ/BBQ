# JS-S04 App/Page VM 与 Lifecycle

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 输入与输出](#3-输入与输出)
- [4. 依赖](#4-依赖)
- [5. 交付物](#5-交付物)
- [6. 状态](#6-状态)
- [7. 阅读顺序](#7-阅读顺序)

## 1. 结论

JS-S04 冻结 App/Page VM 与 Hook 的唯一执行所有权：**一个 AppRuntime 只有一个 App VM，每个 live Surface 只有一个独立 Page VM；Context、初始化和生命周期消息全部串行进入 JS Executor，Hook 最多执行一次并返回原 typed RequestId。** VM 创建直接消费 Artifact Contract 已冻结的 `createAppVm(appContext)`/`createPageVm(surfaceContext)` Definition。

S04 只维护防重、Hook 顺序和本地 VM 可见性投影，不拥有 Core AppRuntime/PageContext 状态，不维护 Surface/Navigation 栈，不决定 Mount/Present。`onReady` 只表示 Page VM 和初始动态数据准备完毕，不表示页面可见。

## 2. 范围

### 2.1 本分 Spec 拥有

- immutable `AppContext` 与每 Surface `SurfaceContext` 的接收、校验、代际和销毁。
- `AppVmController` 唯一实例与 `PageVmController[SurfaceId]` 唯一映射。
- 从 JS-S03 acquire/release App/Page module definition/lease。
- `VmInitializationDispatch -> VmInitializationResult` 业务状态与完成所有权。
- App `onCreate`；Page `onInit/initialEvaluation/onReady` 的固定顺序。
- `LifecycleDispatch -> LifecycleResult`、`onShow/onHide/onDestroy`、sequence 与防重。
- Hook 调用中的 `this`、Context、异常转换、microtask checkpoint 和销毁。
- request ledger、bounded completion outbox、late/duplicate/collision 处理。
- VM/Context/Hook 的资源上限、Observation 和确定 teardown。

### 2.2 本分 Spec 不拥有

- Module ABI、cache 和 Bundle 执行：JS-S03。
- Runtime ABI codec、Native Function Catalog 和 callback queue：JS-S02。
- Reactive state/Binding、Block、Handler、Render、typed Facade：JS-S05..S09。
- Core AppRuntime/PageContext/Surface/Navigation 权威状态和栈。
- Platform Host、Mount、Present、visibility command 或平台线程。

## 3. 输入与输出

### 3.1 输入

- JS-S02 typed callbacks：`AppContext`、`SurfaceContext`、`VmInitializationDispatch`、`LifecycleDispatch`。
- JS-S03 generation-checked App definition / Page definition lease。
- JS-S01 `JsEnginePort`、唯一 Context、JS Executor、microtask budget。
- 后续 JS-S05/S06/S08 组合实现的 typed `PageInitializationStagePort`；合同测试使用 Fake Stage。

### 3.2 输出

- `VmInitializationResult(completed|failed)`。
- `LifecycleResult(completed|failed)`。
- generation-checked `AppVmHandle/PageVmHandle`，供后续 JS 模块在 JS Executor 内借用。
- Hook/VM/Context 的结构化 Observation 与资源计数。

## 4. 依赖

- [JS Runtime 总 Spec](../../README.md)
- [JS-S01 Engine Service](../js-s01-engine-service/README.md)
- [JS-S02 Runtime ABI Client](../js-s02-runtime-abi-client/README.md)
- [JS-S03 Module ABI 与 Loader](../js-s03-module-abi-loader/README.md)
- [Application Lifecycle Contract](../../../../../spec/contracts/application-lifecycle-contract.md)
- [Surface Control Contract](../../../../../spec/contracts/surface-control.md)
- [Runtime ABI Contract](../../../../../spec/contracts/runtime-abi.md)
- [Lifecycle And Threading Contract](../../../../../spec/contracts/lifecycle-and-threading.md)
- [Error Contract](../../../../../spec/contracts/error-contract.md)
- [Observation Contract](../../../../../spec/contracts/observation-contract.md)
- [公共 Schema 索引](../../../../../spec/contracts/schemas/README.md)

## 5. 交付物

- [需求](./requirements.md)
- [设计](./design.md)
- [任务](./tasks.md)
- [验收](./acceptance.md)

## 6. 状态

`IMPLEMENTATION_CORRECTION_REQUIRED`（仅针对 M1-Alpha initial-only 组件切片）；完整 JS-S04 仍为 `CODE_BLOCKED`。当前 Alpha 证据是合成组件证据，不代表真实 Case 001 或完整生命周期通过；不得启动 JS-S05。

独立校审与工作看板显式 `CODE_ALLOWED` 前不得实现 JS-S04；不得启动 JS-S05。

## 7. 阅读顺序

1. 本文件确认所有权。
2. [需求](./requirements.md)确认 Context、VM、Hook 和销毁行为。
3. [设计](./design.md)确认状态机、顺序、重复消息和线程。
4. [任务](./tasks.md)确认未来编码顺序。
5. [验收](./acceptance.md)确认完整正负证据。
