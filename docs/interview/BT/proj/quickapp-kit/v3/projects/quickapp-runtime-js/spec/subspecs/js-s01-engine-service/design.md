# JS-S01 JS Engine Service：设计

## 目录

- [1. 结论](#1-结论)
- [2. 架构与边界](#2-架构与边界)
- [3. 公共接口](#3-公共接口)
- [4. Engine Port 语义](#4-engine-port-语义)
- [5. Executor 与线程](#5-executor-与线程)
- [6. 所有权与生命周期](#6-所有权与生命周期)
- [7. QuickJS Provider](#7-quickjs-provider)
- [8. Fake Engine 与合同测试](#8-fake-engine-与合同测试)
- [9. 异常与错误](#9-异常与错误)
- [10. 观测](#10-观测)
- [11. 资源与背压](#11-资源与背压)
- [12. 依赖与可裁剪性](#12-依赖与可裁剪性)
- [13. 冻结决定](#13-冻结决定)

## 1. 结论

JS-S01 采用：**`JsEngineService = Serial JsExecutor + JsEnginePort + one selected Provider + local ObservationEmitter`。**

每个 `AppRuntime` 创建一个 Service。Service 在唯一 JS Executor 上创建一个 Engine instance 和一个主 Context；App/Shared/Page 的逻辑隔离由后续 VM/Module 分 Spec完成，不通过创建多套引擎实现。全部 Value 绑定该 Context，并在 Context 前释放。

公共 Port 描述能力，不描述 QuickJS：External Function 只是 QuickJS Provider 对 `NativeFunctionBinding` 的私有实现。JS-S02 以后可以在该 Binding 上建立 typed Runtime ABI，但不能绕过 Port，也不能接触 External Function。

## 2. 架构与边界

```text
Platform Composition Root
  -> select exactly one JsEngineProvider
  -> JsEngineService(AppRuntime scope)
       -> JsExecutor
            -> bounded task queue
            -> serial execution domain
       -> JsEnginePort
            -> Context / Value / eval / call / property
            -> NativeFunctionBinding
            -> microtask / GC / memory snapshot
       -> ObservationEmitter
            -> MonotonicClock
            -> TraceSink | NoopTraceSink

V1 Provider:
  JsEnginePort <- QuickJsEngineProvider
                    -> JSRuntime / JSContext / JSValue
                    -> ExternalFunctionAdapter

Test Provider:
  JsEnginePort <- FakeJsEngineProvider
```

依赖方向固定为：

```text
JS Framework -> JsEnginePort <- QuickJS Provider
                         ^---- Fake Engine

QuickJS Provider -X-> JS Framework business modules
JS Framework     -X-> QuickJS headers/types
JS Engine Service -X-> Core/Platform concrete types
```

## 3. 公共接口

以下为语义接口；具体 C++ 命名可按项目编码规范机械调整，但职责和边界不得改变。

### 3.1 Provider 与配置

```cpp
struct JsEngineDescriptor {
  string engineId;
  string engineVersion;
  string engineAbi;
  string moduleId;
};

struct JsEngineLimits {
  uint64 maxHeapBytes;
  uint64 maxStackBytes;
  uint32 maxPendingTasks;
  uint32 maxMicrotasksPerTurn;
  uint32 maxRuntimeValueDepth;
  uint32 maxRuntimeValueNodes;
};

struct JsEngineConfig {
  JsEngineDescriptor expectedEngine;
  JsEngineLimits limits;
};

class JsEngineProvider {
 public:
  virtual JsEngineDescriptor describe() const noexcept = 0;
  virtual unique_ptr<JsEnginePort> create(const JsEngineConfig&) noexcept = 0;
};
```

规则：

1. `Provider` 是不可变工厂，不拥有 App/Surface 状态。
2. `create` 只在 JS Executor 调用，并返回一个 AppRuntime-scoped Engine instance。
3. `describe()` 必须与 Runtime Composition Manifest 的 `jsEngine` 完全一致。
4. `expectedEngine.engineAbi != quickapp-kit-js-engine-v1` 或 descriptor 的 id/version/ABI/module 与 Manifest 期望不匹配时，不创建 Context，不执行 source。

### 3.2 Engine 结果与引用

```cpp
enum class EngineExceptionKind {
  Syntax,
  Runtime,
  Terminated,
  OutOfMemory,
  NativeBinding
};

struct EngineException {
  EngineExceptionKind kind;
  string message;
  optional<string> stack;
  optional<string> sourceUrl;
  optional<uint32> line;
  optional<uint32> column;
};

template <typename T>
using EngineResult = Result<T, EngineException>;

class JsContextRef;  // opaque, executor-bound, service-owned
class JsValueRef;    // opaque, context-bound, owning reference
class JsValueView;   // opaque, context-bound, call-scoped borrowed view
```

`JsValueRef` 默认 move-only；需要第二个拥有者时必须显式调用 `retain()`。该规则让 Handler/evaluator 等长期引用的所有权在后续分 Spec 中可见。引用内部可以使用 type erasure，但不得暴露 `void*`、QuickJS tag 或 raw handle。

### 3.3 Engine primitive

```cpp
class JsEnginePort {
 public:
  virtual JsEngineDescriptor describe() const noexcept = 0;

  virtual EngineResult<JsContextRef> createContext() noexcept = 0;
  virtual EngineResult<void> destroyContext(JsContextRef&) noexcept = 0;

  virtual EngineResult<JsValueRef> evaluate(
      const JsContextRef&, const SourceUnit&) noexcept = 0;
  virtual EngineResult<JsValueRef> call(
      const JsContextRef&, const JsValueRef& function,
      const JsValueRef& thisValue, span<const JsValueRef> args) noexcept = 0;

  virtual EngineResult<JsValueRef> globalObject(const JsContextRef&) noexcept = 0;
  virtual EngineResult<JsValueRef> getProperty(
      const JsContextRef&, const JsValueRef&, string_view name) noexcept = 0;
  virtual EngineResult<void> setProperty(
      const JsContextRef&, JsValueRef&, string_view name,
      const JsValueRef&) noexcept = 0;
  virtual EngineResult<bool> isCallable(
      const JsContextRef&, const JsValueRef&) noexcept = 0;

  virtual EngineResult<JsValueRef> fromRuntimeValue(
      const JsContextRef&, const RuntimeValue&) noexcept = 0;
  virtual EngineResult<RuntimeValue> toRuntimeValue(
      const JsContextRef&, const JsValueRef&, const ValueLimits&) noexcept = 0;
  virtual EngineResult<JsValueRef> retain(
      const JsContextRef&, const JsValueRef&) noexcept = 0;
  virtual EngineResult<JsValueRef> retain(
      const JsContextRef&, const JsValueView&) noexcept = 0;

  virtual EngineResult<NativeBindingToken> bindNativeFunction(
      const JsContextRef&, const NativeFunctionSpec&) noexcept = 0;
  virtual EngineResult<void> unbindNativeFunction(
      const JsContextRef&, NativeBindingToken&) noexcept = 0;

  virtual EngineResult<MicrotaskDrain> drainMicrotasks(
      const JsContextRef&, uint32 maxJobs) noexcept = 0;
  virtual EngineResult<void> requestGarbageCollection(
      const JsContextRef&) noexcept = 0;
  virtual EngineResult<EngineMemorySnapshot> snapshotMemory(
      const JsContextRef&) noexcept = 0;
};
```

`SourceUnit` 只包含 immutable UTF-8 bytes、稳定 `sourceId/sourceUrl` 和 `script|module` mode。`module` 只选择引擎 parse/evaluate mode，S01 不解析依赖或解析 module specifier；S01 不读取 Bundle，也不解释 `$app_*`。

### 3.4 Native Function Binding

```cpp
struct NativeCallView {
  const JsContextRef& context;
  JsValueView thisValue;
  span<const JsValueView> args;
};

using NativeFunctionResult = Result<JsValueRef, RuntimeError>;
using NativeFunction = function<NativeFunctionResult(const NativeCallView&)>;

struct NativeFunctionSpec {
  string globalName;
  uint32 minArgs;
  optional<uint32> maxArgs;
  NativeFunction invoke;
};
```

该合同只回答“如何把一个 C++ 函数绑定为 JS global function”。函数名称和 typed decode 属于调用方；JS-S01 不预注册 Runtime ABI 名称。

回调规则：

1. 只在 JS Executor、当前 Context 内同步进入。
2. `NativeCallView` 是调用期借用视图；不得跨调用保存。
3. 需要保存的值必须 `retain()`，需要跨 ABI 的值必须转换为 `RuntimeValue`。
4. 回调必须 `noexcept`；实现仍须 catch 所有 C++ 异常并转换为失败。
5. 回调不得同步等待 Core/Platform；JS-S02 只做 Core enqueue 并立即返回接收结果。
6. `RuntimeError` 由 Provider 转换为 JS Error/rejection 所需值，不改写错误码。

## 4. Engine Port 语义

### 4.1 RuntimeValue 转换

`fromRuntimeValue/toRuntimeValue` 是 JS/C++ 数据复制边界，不是共享内存：

```text
JS primitive/array/plain object
  -> depth/node/cycle/type validation
  -> immutable RuntimeValue
```

允许值严格遵循公共 Runtime Value Contract。对象转换只接受普通可枚举字符串键；访问器、Proxy 或 getter 不得在“纯数据解码”中被隐式执行。Provider 应使用引擎的 own-data-property API；无法保证时拒绝为 `ABI_INVALID_ARGUMENT`，不得退化为 JSON stringify/parse。

### 4.2 Context 与 Value

- `JsContextRef` 含 service identity 与 generation，用于检测错 Service、旧 Context 和销毁后访问。
- `JsValueRef` 含同一 identity/generation；Port 每次操作先做 O(1) owner/thread/liveness 检查。
- 不同 Context 的 Value 不能作为参数混用。
- Context 关闭后所有未释放 Value 都是合同违例；release 构建仍必须安全失败，不能访问已释放引擎内存。
- Value 不进入 Core queue、Platform queue 或 Observation event。

### 4.3 microtask

S01 只提供执行原语：

```text
higher layer reaches explicit checkpoint
  -> drainMicrotasks(maxMicrotasksPerTurn)
       -> completed: no pending job
       -> yielded: pending jobs remain
            -> enqueue exactly one MicrotaskContinuation at queue tail
       -> failed: EngineException
```

`MicrotaskContinuation` 使用去重标志，任何时刻最多一个。Reactive flush 在哪个 checkpoint 注册、何时形成 RenderTransaction，属于 JS-S05/JS-S07。

## 5. Executor 与线程

### 5.1 逻辑执行域

`JsExecutor` 是串行执行域，不等同于 libuv 或平台 UI loop。它拥有有界 MPSC admission queue 和单消费者 drain：

```text
producer threads
  -> post immutable task
  -> assign acceptanceSequence
  -> bounded FIFO queue
  -> single JS execution domain
```

V1 提供 `OwnedThreadDriver`；测试提供 `ManualPumpDriver`。未来嵌入式 EventLoop Backend 只能实现通用 driver，不得进入 Engine Port 或改变队列语义。无论物理线程如何映射，`isOnExecutor()`、FIFO、禁止重入和销毁顺序必须一致。

### 5.2 任务分类

| 类型 | 含义 | Quiescing 行为 |
|---|---|---|
| `normal` | eval/call/Framework callback 等普通任务 | 不再接收；队列中尚未执行者调用 cancellation completion |
| `microtask-continuation` | 继续有预算的 pending jobs | 取消，不再执行应用逻辑 |
| `teardown-barrier` | 唯一清理任务 | 必须执行且只能执行一次 |

每个任务拥有 immutable payload、acceptance sequence、执行函数和 `onCancelled`。队列只存任务，不存 JS/C++ 外部可变引用。

### 5.3 admission 结果

```text
accepted(sequence)
rejected(queueOverflow)
rejected(stopping)
```

`queueOverflow` 映射公共 `QUEUE_OVERFLOW` 并发出 `queue.overflow`；`stopping` 是 Engine Service 内部终止原因，由拥有该任务的后续模块按 Surface/App 生命周期完成对应 typed cancellation，不在 S01 发明公共错误码。

### 5.4 禁止同步环

- Core/Platform thread 只 `post`，不等待 JS task 完成。
- Native Function 在 JS thread 内只向 Core enqueue，不等待 Core result。
- 注入的 Observation Sink 必须遵守 no-reentry 前置合同，不得回调 Runtime；Executor 不为违约 Sink 建立隔离线程或重入兜底。
- Executor driver 的 wakeup 只唤醒 drain，不执行业务回调。

## 6. 所有权与生命周期

### 6.1 所有权表

| 对象 | 唯一所有者 | 使用线程 | 释放点 |
|---|---|---|---|
| `JsEngineProvider` | Composition Root | 创建前只读 | Runtime Host 结束 |
| `JsEngineService` | AppRuntime | 控制面可跨线程；内部仅 Executor | AppRuntime teardown |
| `JsExecutor` | Service | 单消费者 | Engine 销毁后 |
| `JsEnginePort`/Engine | Service | Executor | Context 销毁后 |
| 主 `JsContextRef` | Service | Executor | 所有 Value 释放后 |
| `JsValueRef` | 创建它的 Framework registry/stack | Executor | registry 清理或调用结束 |
| `NativeBindingToken` | 注册它的上层模块 | Executor | Context 销毁前解绑 |
| `ObservationEmitter` | Service | Executor | Executor 停止前 |
| Clock/Sink | Composition Root 的共享 immutable service；注入前已满足 `noexcept/nonblocking/no-reentry` | `emit/nowNs` 合同允许的线程 | 晚于 Service |

### 6.2 Service 状态机

```text
new
  -> starting
       -> running
       -> failed -> stopped
running
  -> quiescing
       -> stopped
```

- `start`：启动 Executor，在 Executor 内校验 descriptor/ABI，创建 Engine，再创建主 Context；任一步失败都反向清理已创建资源。
- `running`：仅此状态接受 normal task。
- `quiescing`：原子关闭 admission；取消普通任务；由上层 teardown callback 释放 VM/module/registry 持有的 Value 和 Binding token。
- teardown barrier：验证外部 Value/Binding 计数为 0，销毁 Context、Engine、Emitter，最后停止 driver。
- `failed`：Provider 不可恢复错误；执行与 quiescing 相同的确定清理，不自动换 Engine。

### 6.3 销毁顺序

```text
stop admission
  -> cancel queued normal tasks and microtask continuation
  -> upper-layer teardown callback on JS Executor
       -> release Page/App VM values (future specs)
       -> unbind Native Function
  -> assert/reconcile live Value count == 0
  -> destroy Context
  -> destroy Engine
  -> release ObservationEmitter
  -> stop Executor driver
```

若 teardown barrier 发现仍有 Value，debug 构建必须报告持有者；release 构建必须在 Context 仍存活时由 Service 的 value registry 确定释放，再记录诊断失败。不得直接销毁 Context 后留下悬空析构。

## 7. QuickJS Provider

### 7.1 Identity

```text
engineId      = quickjs
moduleId      = engine.quickjs
engineAbi     = quickapp-kit-js-engine-v1
engineVersion = actual linked QuickJS version
```

Provider 私有实现映射：

| Port | QuickJS 私有实现 |
|---|---|
| Engine | `JSRuntime*` |
| Context | `JSContext*` |
| Value | owned `JSValue`，retain=`JS_DupValue`，release=`JS_FreeValue` |
| evaluate | QuickJS compile/eval API；source mode 保持 |
| call | `JS_Call` |
| Native Function | provider-owned binding record + C trampoline/External Function Adapter |
| microtask | `JS_ExecutePendingJob`，受 job budget 限制 |
| exception | `JS_IsException` 后立即 `JS_GetException` 并清除 pending state |
| GC | `JS_RunGC` |
| memory | `JS_ComputeMemoryUsage` 的稳定字段投影 |

### 7.2 External Function Adapter

```text
QuickJS C callback(raw JSContext/JSValue)
  -> lookup provider-owned NativeBindingToken
  -> construct borrowed NativeCallView
  -> invoke engine-neutral NativeFunctionBinding
  -> success: unwrap returned JsValueRef to QuickJS value
  -> RuntimeError: create JS Error preserving errorCode
  -> C++ exception: convert to JS_EXCEPTION
```

raw pointer、binding record 和 trampoline 只在 `providers/quickjs/**`。公共 `NativeFunctionBinding` 不知道 External Function 的存在。

### 7.3 资源限制

- `maxHeapBytes/maxStackBytes` 在执行 source 前设置。
- allocator failure 转为 `OutOfMemory`，只尝试预分配最小 `runtime.oom` marker。
- V1 不定义执行超时或任意脚本抢占；若后续增加 interrupt policy，必须独立决策，不能把 wall clock timeout 混入 S01。
- Provider 不启动自己的线程或 EventLoop。

## 8. Fake Engine 与合同测试

Fake Engine 不是 JS 解释器，而是可编程的 Port test double：

- 以 `SourceUnit.sourceId` 注册 evaluate outcome、global/property 和 microtask plan。
- 生成 opaque fake Context/Value，并执行与生产 Provider 相同的 owner/generation/thread 检查。
- 可注入 syntax/runtime/OOM、native callback failure、pending jobs、资源泄漏和创建失败。
- 记录 operation sequence，供 Framework 单元测试断言。
- 只进入 test target，不出现在生产 Manifest/link map。

公共 `EngineContractSuite` 参数化运行 Fake 与 QuickJS：同一组 Port 调用、同一预期结果和错误分类；source bytes 可以是 QuickJS 可执行的最小脚本，Fake 以相同 `sourceId` 返回预置等价结果。Provider-specific 测试只补充 QuickJS handle/allocator/trampoline 细节，不改变 Port 预期。

## 9. 异常与错误

### 9.1 映射

| 来源 | Engine Service 分类 | 公共边界映射 |
|---|---|---|
| syntax/runtime throw | `EngineException(Syntax/Runtime)` | `JS_EXCEPTION` |
| QuickJS allocator failure | `EngineException(OutOfMemory)` | `OUT_OF_MEMORY` |
| Native Binding 返回 `RuntimeError` | `NativeBinding` 保留原 error | 不改写 error code |
| Native Binding 抛 C++ 异常 | `EngineException(NativeBinding)` | `JS_EXCEPTION` |
| RuntimeValue 非法 | invalid conversion | `ABI_INVALID_ARGUMENT` |
| queue full | admission overflow | `QUEUE_OVERFLOW` |
| engine ABI 不匹配 | start failure | `MODULE_ABI_UNSUPPORTED` |
| wrong thread/context/released value | Engine Service contract violation | operation 失败；debug assert，禁止触碰引擎内存 |

`message/stack/source` 只用于诊断，不参与错误分支判断；跨层逻辑只依赖稳定 code/kind。

### 9.2 异常隔离

每次 Provider 调用都必须在返回前清理 pending exception。一次 operation 失败后，下一个独立 operation 要么正常执行，要么 Service 已明确进入 failed；不得保留“半失败”隐式状态。

## 10. 观测

`ObservationEmitter` 是进程内轻量适配，不是 Runtime ABI：

`TraceSink` 的注入前置合同固定为：

```text
emit(immutable TraceEvent) noexcept
  + nonblocking
  + no reentry into Runtime
```

Composition Root 只允许注入满足该合同的 Noop 或 Recording Sink。`noexcept` 由接口签名和构建检查约束；`nonblocking/no-reentry` 由受控合同替身和平台集成检查证明。Emitter 不使用 `try/catch`、超时、隔离线程或 watchdog 掩盖 Sink 违约：实现若真实抛异常，违反 C++ `noexcept` 并可能终止进程；实现若真实阻塞或重入，调用方无法可靠恢复。

```text
JS producer
  -> typed ObservationEvent draft
  -> emitter adds producer=js, timestampNs, clockDomain, sequence
  -> TraceSink.emit(noexcept)
```

S01 自身只拥有基础设施和三类直接事实：

| 事实 | Marker | 必需字段 |
|---|---|---|
| 稳定边界采样 JS 队列深度 | `runtime.counter.sampled` | `counterName=queue.depth`、`counterValue` |
| 业务任务队列满 | `queue.overflow` | `errorCode=QUEUE_OVERFLOW`、`counterName=queue.depth`、`counterValue` |
| Engine 必要分配失败 | `runtime.oom` | `errorCode=OUT_OF_MEMORY`，可用时带 App/Surface 关联 ID |

`module.load.*`、`bridge.request.*`、`lifecycle.hook.*`、`event.handler.*`、`state.mutated` 和 `render.*` 由 JS-S02..S08 在对应事实发生处调用同一 Emitter；S01 不提前产生伪 marker。

Noop 模式允许完全跳过 clock 与 event 构造。合规 Recording Sink 在容量满时可以拒绝保留或丢弃事件，也可以进入关闭状态；这些 Sink 内部结果不返回 Runtime，不能改变返回值、任务顺序、microtask 次数或 Service 状态。受控替身可以报告“重入意图”并被集成门禁拒绝，但不得真的回调 Runtime。

真实 throw、真实阻塞和真实重入不是 Runtime 故障注入项，也不是 Engine 可恢复场景。Emitter 不格式化文本、不执行 I/O、不等待 Collector。

## 11. 资源与背压

### 11.1 计数

S01 内部至少维护以下测试计数，不新增公共 `counterName`：

```text
liveEngine / liveContext / liveValue / liveNativeBinding
pendingTask / pendingMicrotaskContinuation
```

公共 `runtime.counter.sampled(counterName=queue.depth)` 只投影 `pendingTask`；其他内部计数进入测试证据或 `memory.sampled` 的合法投影，不伪造公共 marker。

### 11.2 限制来源

所有 limit 由 Build Profile/Runtime Host 配置注入，必须为正值并在启动时验证。S01 不冻结设备无关的绝对数字；各平台分 Spec 冻结其 Profile 数值，Benchmark 记录实际值。

### 11.3 OOM

OOM 路径不得动态构造长字符串、递归 Trace 或尝试自动切换 Engine。当前 operation 失败；若 Provider 无法保证后续一致性，Service 进入 failed 并确定销毁。

## 12. 依赖与可裁剪性

建议目标边界：

```text
quickapp_js_engine_api        Port/types only
quickapp_js_executor          queue/service/observation adapter
quickapp_js_engine_quickjs    selected V1 provider
quickapp_js_engine_fake       test only
```

生产目标必须满足：

1. `quickapp_js_engine_api` 和 Framework 不链接 QuickJS。
2. 每个 Runtime target 只链接 Manifest 指定的一个 Engine target。
3. Fake、Manual test driver、fault injection 不进入生产 link map。
4. Engine target 不依赖 Platform Backend；Composition Root 只负责选择和注入。
5. QuickJS 版本与 Provider descriptor/Manifest 使用同一构建事实生成，禁止手写两份版本。

## 13. 冻结决定

| ID | 决定 |
|---|---|
| JS-S01-D01 | 一个 `AppRuntime` 一个 Service、一个 Engine instance、一个主 Context；Page 不独占 Engine。 |
| JS-S01-D02 | Engine/Context/Value 只归 JS Executor；Value 在 Context 前释放。 |
| JS-S01-D03 | `JsValueRef` 为 opaque move-only owning ref，复制必须显式 retain。 |
| JS-S01-D04 | Native Function Binding 属于 Port；External Function Adapter 只属于 QuickJS Provider。 |
| JS-S01-D05 | Executor 是有界串行执行域，不绑定 libuv 或 Platform EventLoop。 |
| JS-S01-D06 | microtask 使用显式有预算 drain 和唯一 continuation；Reactive flush 时机不属于 S01。 |
| JS-S01-D07 | Queue overflow 只拒绝当前任务；shutdown 取消未执行普通任务并执行唯一 teardown barrier。 |
| JS-S01-D08 | JS exception 不穿透 Port；稳定公共映射只使用 `JS_EXCEPTION/OUT_OF_MEMORY/QUEUE_OVERFLOW/MODULE_ABI_UNSUPPORTED/ABI_INVALID_ARGUMENT`。 |
| JS-S01-D09 | S01 复用公共 ObservationEmitter；TraceSink 的 `noexcept/nonblocking/no-reentry` 是注入前置合同。S01 只直接产生 queue depth、queue overflow 与 OOM 事实，不创建私有 marker，也不承诺隔离真实 throw/block/reentry。 |
| JS-S01-D10 | Fake 与 QuickJS 运行同一 Engine Contract Suite；Fake 只进入测试目标。 |
