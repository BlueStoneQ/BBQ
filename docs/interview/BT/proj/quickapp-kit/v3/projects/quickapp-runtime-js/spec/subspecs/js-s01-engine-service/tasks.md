# JS-S01 JS Engine Service：任务

## 目录

- [1. 结论](#1-结论)
- [2. 执行规则](#2-执行规则)
- [3. 任务清单](#3-任务清单)
- [4. 依赖顺序](#4-依赖顺序)
- [5. 完成定义](#5-完成定义)
- [6. 非本任务工作](#6-非本任务工作)

## 1. 结论

JS-S01 实现必须先建立 Port 与可替换合同，再实现 Executor/Service，最后接入 Fake 和 QuickJS。**任何 QuickJS 代码进入公共目标、任何业务 ABI 进入 S01，均视为任务失败。**

当前仅冻结任务，不授权编码。只有本分 Spec 独立校审 PASS 且工作看板设置 `CODE_ALLOWED` 后，以下任务才能执行。

## 2. 执行规则

建议代码根：

```text
quickapp-kit-ai/quickapp-runtime-js/
├── CMakeLists.txt
├── include/quickapp/js/engine/
├── src/engine/
├── providers/quickjs/
└── tests/engine/
```

文件名可按仓库最终规范调整，但 target 边界必须保持：

```text
quickapp_js_engine_api
quickapp_js_executor
quickapp_js_engine_quickjs
quickapp_js_engine_fake       # test only
```

每个任务必须同时提交实现、单元测试和对应证据；不得先建立无法验证的空接口。

## 3. 任务清单

### JS-S01-T01：建立构建目标和依赖守卫

**目标**：创建四个目标，冻结依赖方向。

**工作**：

1. 创建 engine API、executor/service、QuickJS Provider 和 Fake test target。
2. QuickJS include/link 只对 provider target 可见。
3. 增加依赖扫描或编译负例，阻止 API/Framework 引用 QuickJS 和平台头文件。
4. Fake、Manual driver、fault injection 标记为 test-only。

**完成定义**：公共目标可在没有 QuickJS SDK 的配置下独立编译；生产 link target 不包含 Fake。

### JS-S01-T02：实现 Engine 公共类型与 Port

**目标**：实现 `JsEngineDescriptor/Config/Limits`、`EngineResult/Exception`、opaque Context/Value 和 `JsEngineProvider/Port`。

**工作**：

1. 实现 move-only `JsValueRef` 与显式 `retain()`。
2. 实现 service/context identity、generation、thread/liveness O(1) 校验。
3. 定义 `SourceUnit`、`MicrotaskDrain`、`EngineMemorySnapshot`。
4. 定义 Native Function Spec/Token/CallView/Result。
5. 保证公共头无 raw engine handle、`void*` 和平台类型。

**完成定义**：API 编译测试覆盖 move/copy 约束；wrong service/context/thread 的行为可测试。

### JS-S01-T03：实现有界 JsExecutor

**目标**：实现可被多生产者投递、单执行域消费的有界 FIFO。

**工作**：

1. 实现 acceptance sequence、normal/control task 和 cancellation completion。
2. 实现 `new/running/quiescing/stopped` admission 状态。
3. 实现 queue overflow 只拒绝当前任务，不丢已接受任务。
4. 实现唯一 microtask continuation 去重。
5. 实现 OwnedThreadDriver 和 test-only ManualPumpDriver。

**完成定义**：并发 producer 顺序、容量边界、停止竞态、取消和禁止重入测试全部通过；无无界容器。

### JS-S01-T04：实现 JsEngineService 生命周期

**目标**：组合 Executor、Provider、Engine、主 Context 与 Emitter。

**工作**：

1. 在 Executor 内校验 descriptor/Manifest expectation 并创建 Engine/Context。
2. 实现 `new/starting/running/quiescing/failed/stopped`。
3. start 任一步失败时反向释放资源。
4. shutdown 时关闭 admission、取消普通任务并执行唯一 teardown barrier。
5. 记录 Engine/Context/Value/Binding/Task 内部 live count。

**完成定义**：每个状态转换和重复 start/stop 均有测试；stop completion 只发生一次，资源计数归零。

### JS-S01-T05：实现 RuntimeValue 与 Value primitive

**目标**：提供引擎无关属性和数据转换能力。

**工作**：

1. 实现 global/property/get/set/isCallable/evaluate/call primitive 的 Port 语义测试桩。
2. 实现 RuntimeValue 双向转换的深度、节点数、循环和类型校验。
3. 禁止通过 JSON stringify/parse 实现转换。
4. 对 getter/Proxy/非 plain object 使用无副作用拒绝策略。

**完成定义**：公共 Runtime Value 全值域 round-trip；undefined/function/Symbol/BigInt/NaN/Infinity/cycle/unsafe integer/超限输入稳定拒绝。

### JS-S01-T06：实现 Native Function Binding 基础设施

**目标**：让后续 JS-S02 只依赖 engine-neutral binding。

**工作**：

1. 实现 bind/unbind token 生命周期与重名处理。
2. 实现 borrowed argument view、显式 retain 和 RuntimeError 返回。
3. catch native callback 的全部 C++ 异常。
4. 阻止 callback 同步重入 evaluate/call 或同步等待其他执行域。

**完成定义**：参数、this、返回值、typed error、native throw、unbind 和 Context destroy 测试通过。

### JS-S01-T07：实现 ObservationEmitter 接入

**目标**：提供 JS 项目共用的轻量观测出口。

**工作**：

1. 注入 `MonotonicClock/TraceSink/runId/clockDomain`，生成严格递增 sequence。
2. 将 `TraceSink.emit noexcept + nonblocking + no reentry` 固定为 Composition Root 注入前置合同；实现 Noop 快路径和 typed event builder。
3. 稳定边界可发 `runtime.counter.sampled(queue.depth)`；Executor overflow 发 `queue.overflow`；Provider OOM 尝试发最小 `runtime.oom`。
4. 用受控 Recording 替身覆盖正常接收、容量满、拒绝保留、丢样和关闭；用受控替身记录重入意图，并证明 Sink 注入不获得 Runtime callback/reentry capability。
5. 通过接口签名、静态检查和平台集成清单拒绝可能抛异常、阻塞或重入的 Sink 实现；不得在 Emitter 增加 catch、超时、隔离线程或 watchdog。
6. 不创建公共目录以外的 marker。

**完成定义**：Observation Schema 校验通过；Noop、正常 Recording、容量满/拒绝/丢样/关闭的等价测试通过；重入意图在受控门禁中被拒绝。真实 throw/block/reentry 不作为 Runtime 可恢复测试。

### JS-S01-T08：实现 Fake Engine

**目标**：提供后续 JS Framework 测试所需的确定性 test double。

**工作**：

1. 按 sourceId 注册 evaluate/call/property/microtask outcome。
2. 实现 fake Context/Value owner、generation、retain/release 和资源计数。
3. 支持 syntax/runtime/OOM/native failure/创建失败/泄漏注入。
4. 记录 operation sequence。

**完成定义**：Fake 通过公共 Engine Contract Suite；生产 target/link map 不含 Fake symbol。

### JS-S01-T09：实现 QuickJS Provider

**目标**：完成 V1 生产 Engine Provider。

**工作**：

1. 接入确定版本的 QuickJS，并从构建事实产生 descriptor version。
2. 映射 Runtime/Context/Value、eval/call/property/retain/release。
3. 实现 External Function Adapter 和 provider-owned binding record。
4. 实现 pending exception 提取、OOM、GC、memory snapshot。
5. 实现 `JS_ExecutePendingJob` 有预算 drain。
6. 设置 heap/stack limit，保证所有 QuickJS API 只在 Executor。

**完成定义**：QuickJS 通过公共 Engine Contract Suite；ASAN/LSAN 或等价工具下完整 start/eval/call/stop 无泄漏和 UAF。

### JS-S01-T10：建立参数化 Engine Contract Suite

**目标**：用同一测试合同证明 Provider 可替换。

**工作**：

1. 参数化运行 Fake/QuickJS。
2. 覆盖 descriptor/ABI、Context、Value、eval/call/property、Native Binding、RuntimeValue、microtask、GC、异常、wrong owner/thread 和 destroy。
3. common case 使用相同 SourceUnit ID、Port 调用和断言。
4. Provider-specific case 只验证实现封装，不改公共语义。

**完成定义**：两个 Provider 的 common suite 结果一致；差异仅限 engineVersion、实现内存数值和诊断文本。

### JS-S01-T11：完成组成与资源证据

**目标**：证明单 Engine 链接和确定释放。

**工作**：

1. 生成/校验含 `engine.quickjs` 的测试 Runtime Composition Manifest。
2. 检查 Manifest、link map、descriptor 三方一致且仅一个 Engine module。
3. 运行多轮 create/stop、异常、overflow、microtask continuation 和 Native Binding 生命周期测试。
4. 保存资源基线、峰值、destroyed 回落和测试版本信息。

**完成定义**：满足 [验收](./acceptance.md) 全部门禁，形成可回链证据。

## 4. 依赖顺序

```text
T01 -> T02 -> T03 -> T04
        |      |      |-> T07
        |      |      |-> T08
        |      |      -> T09
        |      -> T06 ----^
        -> T05 ----------^

T08 + T09 -> T10 -> T11
```

允许并行：

- T03 与 T05 在 T02 后并行。
- T07、T08 与 T09 在 T04 的 Service contract 稳定后并行。
- T06 公共 binding 完成后，Fake 与 QuickJS 可分别实现适配。

## 5. 完成定义

JS-S01 只有同时满足以下条件才算实现完成：

1. Fake 与 QuickJS 通过同一 Engine Contract Suite。
2. 公共头和 Framework target 无 QuickJS/Platform 类型或依赖。
3. 一个生产 target 只链接一个 Manifest 指定 Engine；Fake 不进入产物。
4. Engine/Context/Value/Binding/Task 在 shutdown 后归零。
5. queue overflow、OOM、异常和 ABI mismatch 均为稳定 typed failure。
6. 只注入满足 `noexcept/nonblocking/no-reentry` 的 Sink；Noop 与 Recording 的正常、容量满、拒绝保留、丢样和关闭行为等价，marker 通过公共 Schema。
7. 所有验收证据包含代码版本、QuickJS 版本、构建配置和运行环境。

## 6. 非本任务工作

以下内容即使实现方便也不得加入：Module Loader、`$app_*`、Runtime ABI codec、Core callback、VM、Proxy、Binding、Render、Handler、Capability、Platform Host、Collector 和报告。
