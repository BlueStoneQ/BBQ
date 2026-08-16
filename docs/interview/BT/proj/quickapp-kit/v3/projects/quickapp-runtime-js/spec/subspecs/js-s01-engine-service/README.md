# JS-S01 JS Engine Service

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 输入与输出](#3-输入与输出)
- [4. 依赖](#4-依赖)
- [5. 交付物](#5-交付物)
- [6. 状态](#6-状态)
- [7. 阅读顺序](#7-阅读顺序)

## 1. 结论

JS-S01 冻结一个平台无关、引擎可替换的 JS 执行底座：**一个 `AppRuntime` 拥有一个串行 `JsEngineService`，Framework 只依赖 `JsEnginePort`；V1 的 QuickJS Provider 是该 Port 的一个实现。**

`JsEnginePort` 暴露引擎无关的 Context、Value、求值、调用、属性访问、Native Function Binding、microtask 和 GC 能力；QuickJS 的 `JSRuntime/JSContext/JSValue` 与 External Function Adapter 只能存在于 Provider 内。JS Executor 是 Engine、Context 和 Value 的唯一执行线程。

本分 Spec 只建立执行基础设施，不加载应用模块、不建立 VM、不跟踪 Binding、不构造 RenderTransaction、不管理 Handler，也不定义业务 ABI codec。

## 2. 范围

### 2.1 本分 Spec 拥有

- `JsEngineProvider`、`JsEnginePort` 和 `quickapp-kit-js-engine-v1` 合同。
- 一个 `AppRuntime` 一套 Engine/Context 的创建、线程归属和确定销毁。
- 引擎无关 `JsContextRef`、`JsValueRef` 的所有权与失效规则。
- source 求值、函数调用、属性访问、RuntimeValue 转换、Native Function Binding、microtask drain、GC 与内存快照能力。
- 有界 JS Executor 任务队列、FIFO 顺序、背压、停止与取消。
- `EngineException` 到内部 Engine Service 错误及公共 `RuntimeError` 的确定映射规则。
- Fake Engine、QuickJS Provider 和公共 Engine Contract Suite。
- QuickJS External Function Adapter。
- 单调时钟与本地 `ObservationEmitter` 接入；只接受满足 `noexcept + nonblocking + no reentry` 前置合同的 Sink，并验证 Noop/Recording 行为等价。

### 2.2 本分 Spec 不拥有

- `$app_define$/$app_bootstrap$/$app_require$`、Module Loader 与 cache：JS-S03。
- Runtime ABI typed codec、`EnqueueResult` 和 request/result：JS-S02。
- App/Page VM 与 lifecycle Hook：JS-S04。
- state Proxy、Binding、Block、Render Builder：JS-S05/06/07。
- Handler、Event Dispatch：JS-S08。
- router、prompt、device、Page API：JS-S09。
- C++ Core、Platform Host、Collector、存储、报告和产品 Composition Root。

## 3. 输入与输出

### 3.1 输入

- Platform Composition Root 选中的一个 `JsEngineProvider`。
- `JsEngineConfig`：资源限制、队列上限、microtask 每轮预算和引擎 ABI 期望。
- `MonotonicClock`、满足 `emit noexcept + nonblocking + no reentry` 前置合同的 `TraceSink`、`runId`、`clockDomain`。
- 上层通过 JS Executor 投递的 immutable engine operation。
- 上层通过 `NativeFunctionBinding` 注册的引擎无关函数回调。

### 3.2 输出

- 运行中的 `JsEngineService` 与唯一 `JsEnginePort`。
- Context-bound、executor-bound 的 `JsContextRef/JsValueRef`。
- `EngineResult<T>`：成功值或结构化 `EngineException`。
- 任务接收、取消、队列溢出与 shutdown 结果。
- 符合公共 Observation Contract 的结构化 marker。
- Fake/QuickJS 共用的合同测试证据与 QuickJS 资源释放证据。

## 4. 依赖

- [JS Runtime 总 Spec](../../README.md)
- [Runtime ABI Contract](../../../../../spec/contracts/runtime-abi.md)
- [Runtime Value Contract](../../../../../spec/contracts/runtime-value.md)
- [Error Contract](../../../../../spec/contracts/error-contract.md)
- [Observation Contract](../../../../../spec/contracts/observation-contract.md)
- [Runtime Composition Contract](../../../../../spec/contracts/runtime-composition-contract.md)
- [Lifecycle And Threading Contract](../../../../../spec/contracts/lifecycle-and-threading.md)
- [公共 Schema 索引](../../../../../spec/contracts/schemas/README.md)

## 5. 交付物

- [需求](./requirements.md)
- [设计](./design.md)
- [任务](./tasks.md)
- [验收](./acceptance.md)

## 6. 状态

`READY_FOR_REVIEW + CODE_BLOCKED`；已定向修订 `S1-JS-001`，等待复核。

本文档通过独立校审且工作看板显式设置 `CODE_ALLOWED` 前，不得创建产品实现。

## 7. 阅读顺序

1. 本文件：确认边界和依赖。
2. [需求](./requirements.md)：确认必须成立的行为。
3. [设计](./design.md)：确认接口、线程、状态、所有权和失败语义。
4. [任务](./tasks.md)：获得编码顺序与完成定义。
5. [验收](./acceptance.md)：获得合同测试、故障注入和证据门禁。
