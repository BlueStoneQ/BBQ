# CORE-S01 设计

## 目录

- [1. 结论](#1-结论)
- [2. 模块边界](#2-模块边界)
- [3. Typed Value、Error 与 Result](#3-typed-valueerror-与-result)
- [4. 公共 ID](#4-公共-id)
- [5. 有界 Mailbox](#5-有界-mailbox)
- [6. Port](#6-port)
- [7. 线程与所有权](#7-线程与所有权)
- [8. 生命周期与销毁](#8-生命周期与销毁)
- [9. 最小观测](#9-最小观测)
- [10. 错误与降级](#10-错误与降级)
- [11. Fake 与故障注入](#11-fake-与故障注入)
- [12. Kernel 依赖边界](#12-kernel-依赖边界)

## 1. 结论

Foundation 采用：**强类型值 + move-only 消息 + MPSC 有界入口/SPSC 逻辑消费 + 单写者 Core + 单向异步 Port + 同步只读 Measure Port + 旁路观测。**

核心不变量只有三个：

1. 成功入队才转移消息所有权，入队成功不代表业务成功。
2. Core 状态只有 Core Runtime Thread 可以修改，对端只能返回不可变消息。
3. Trace 是否启用、是否保留成功，都不能改变业务结果和执行顺序。

## 2. 模块边界

建议实现目标按职责拆分，不要求目录名与此完全一致：

```text
core-contracts     RuntimeValue / RuntimeError / ID / public message declarations
core-foundation    Result / allocator / BoundedMailbox / counters
core-ports         CoreIngress / JS / Surface / Mount / Measure interfaces
core-observation   Clock / TraceEvent / TraceSink / Noop
core-testing       Fake Clock / Fake Ports / Recording Sink / fault injection
```

`core-contracts` 与 `core-foundation` 不引用业务模块；后续 Core 模块依赖它们，平台实现只实现 `core-ports` 抽象。

## 3. Typed Value、Error 与 Result

### 3.1 RuntimeValue

概念模型固定为：

```cpp
using RuntimeValue = variant<
    Null, bool, SafeInteger, FiniteNumber, Utf8String,
    RuntimeArray, RuntimeObject>;
```

- `SafeInteger` 范围是 `[-9007199254740991, 9007199254740991]`。
- `FiniteNumber` 构造时拒绝 NaN 和 Infinity。
- `RuntimeObject` 的 key 是 UTF-8 string；missing 与 `null` 不合并。
- 容器构造必须检测循环输入；内部值一旦进入消息即不可变。
- 序列化只属于具体 transport/测试，不属于 Foundation 热路径。

### 3.2 RuntimeError

```cpp
struct RuntimeError final {
  RuntimeErrorCode code;
  Utf8String message;
  bool retryable;
  optional<SurfaceId> surfaceId;
  optional<RequestId> requestId;
  optional<TransactionId> transactionId;
  optional<MountAttemptId> mountAttemptId;
};
```

错误码必须与公共 Error Contract 闭集一致。`message` 用于诊断，不参与分支判断；任何跨边界异常都在所属边界转换为 `RuntimeError`。

### 3.3 结果类型

```cpp
template<class T>
using Result = expected<T, RuntimeError>;

using EnqueueResult = Result<Accepted>;
```

实现可以使用等价的无异常 `Expected`，但不得使用 `bool + out-param`。`Accepted` 没有业务 payload，只表达队列取得所有权。

## 4. 公共 ID

### 4.1 强类型

每类 ID 使用不同 wrapper，底层 wire value 是 opaque UTF-8 string：

```text
AppRuntimeId app:    SurfaceId srf:       NodeId node:
ComponentId cmp:     BlockId blk:         HandlerId hdl:
TransactionId txn:   MountAttemptId mnt:  RequestId req:
```

Toolkit 的 `TemplateNodeId/TemplateBindingId/TemplateBlockId/TemplateHandlerId` 使用独立的正整数 wrapper。`OwnerInstanceId` 是 `ComponentInstanceId | BlockInstanceId` 的显式联合。

### 4.2 构造与分配

- wire parse 返回 `Result<Id>`，校验正确前缀、非空 payload 和 UTF-8；不接受裸字符串隐式构造。
- allocator 由公共合同指定的 producer 持有，使用单调 `uint64` 序列生成 opaque payload。
- 序列耗尽返回 `OUT_OF_MEMORY` 等价的无法继续创建错误，不回绕、不复用；实现不得编码地址。
- `AppRuntimeFactory` 是 Runtime Host 实例内创建 AppRuntime 的唯一 Core 入口，并独占一个 Host 级 `AppRuntimeIdAllocator`。Factory 先生成 `AppRuntimeId`，再把该 ID 注入新 AppRuntime；Platform Host 只调用 Factory，不得生成、传入或覆盖该 ID。
- 销毁一个 AppRuntime 只释放该实例资源，不释放、不重置 Factory 的 `AppRuntimeIdAllocator`。同一 Host 内按 `create A -> destroy A -> create B` 连续操作时，B 必须获得未曾使用的新 ID。
- Host teardown 必须先停止新建 AppRuntime，销毁 Factory 创建的全部 AppRuntime，再销毁 `AppRuntimeFactory` 及其 allocator。allocator 晚于全部 AppRuntime 销毁，最终不保留 live AppRuntime、pending creation 或 ID-owned resource。
- `RequestId` 的作用域是一个 AppRuntime。多个 Host/Core/JS/Platform 请求 producer 若位于同一 AppRuntime，默认共享该 AppRuntime 的一个并发安全 allocator；若实现选择命名分区，每个分区必须由 AppRuntime 在启动时统一分配互斥 namespace，最终 wire value 仍为合法且全局不重复的 `req:` opaque string。
- 禁止每个 `RequestId` producer 独立从相同局部序列（例如都从 `req:1`）开始；producer 销毁或重建也不得导致 AppRuntime 生命周期内复用。
- 其他 allocator 生命周期等于其公共 ID scope；Surface/AppRuntime 的具体 tombstone teardown 由后续模块持有，Foundation 只提供 allocator primitive。

CORE-S01 实现 `AppRuntimeIdAllocator` 原语并冻结上述 Factory 所有权接口；AppRuntime 创建、状态和 teardown 编排由 CORE-S03 实现，不在 Foundation 建立第二套生命周期状态机。

## 5. 有界 Mailbox

### 5.1 语义

```cpp
template<class Message>
class BoundedMailbox final {
 public:
  MailboxPostStatus tryPost(Message&& message) noexcept;
  optional<Message> tryPop() noexcept; // 仅 owner consumer
  void close() noexcept;
  MailboxSnapshot snapshot() const noexcept;
};
```

状态：

```text
open --close()--> closed
```

- `open + depth < capacity`：接受并转移所有权，depth 加一。
- `open + full`：返回内部状态 `full`，调用方保留消息所有权。
- `closed`：返回内部状态 `closed`，调用方保留消息所有权。
- `tryPop` 只由 Core Runtime Thread 调用，保持成功入队的全局线性化顺序。
- `close` 幂等；关闭后可由 owner drain/cancel 已接受消息，但不得再接受新消息。

`MailboxPostStatus = accepted | full | closed` 是 Core 内部基础状态，不跨公共 ABI。持有请求语义的 Gateway 把 `full` 映射为 `QUEUE_OVERFLOW`，把 `closed` 映射为该请求合同已有的 terminal error，例如已销毁 Surface 使用 `SURFACE_NOT_FOUND`；Foundation 不新增或猜测业务错误码。

`capacity > 0` 是构造前置条件，由 Composition Root/Profile 固定。存储槽位在构造期预留，不能在满载时扩容。V1 不把具体互斥/原子算法写入公共 ABI；实现必须通过多 producer 压测证明线性化、无覆盖和无重复消费。

### 5.2 OOM

构造期无法分配固定槽位时，Runtime 创建失败并返回 `OUT_OF_MEMORY`。消息深拷贝或所有权封装在入队前失败时，不改变队列；错误仍为 `OUT_OF_MEMORY`。成功入队后，队列不得以 OOM 为理由丢弃消息。

## 6. Port

### 6.1 异步边界

```cpp
class CoreIngressPort {
 public:
  virtual EnqueueResult post(CoreInboundMessage&&) noexcept = 0;
  virtual void close() noexcept = 0;
};

class JsRuntimePort {
 public:
  virtual EnqueueResult post(JsOutboundMessage&&) noexcept = 0;
  virtual void close() noexcept = 0;
};

class PlatformSurfacePort {
 public:
  virtual EnqueueResult post(SurfaceCommand&&) noexcept = 0;
  virtual void close() noexcept = 0;
};

class PlatformMountPort {
 public:
  virtual EnqueueResult post(MountTransaction&&) noexcept = 0;
  virtual void close() noexcept = 0;
};
```

这里的 `*Message` 是公共消息判别联合的 C++ typed representation，不是 `{kind,payload}` 通用 envelope。每个联合的闭集由对应公共合同和后续分 Spec声明；CORE-S01 只冻结传输语义。

命令 Port 的实现把消息投递到对端 owner queue，不得在 `post` 调用栈内执行 JS、UI 或回调 Core。对端执行完成后，通过 `CoreIngressPort` 投递公共 typed Result。`post` 返回 accepted 后，恰好产生一个终态 Result；teardown 取消也必须产生合同允许的失败结果或由明确 tombstone 规则吸收晚到结果。

### 6.2 Measure

```cpp
class PlatformMeasurePort {
 public:
  virtual MeasureResult measure(const MeasureRequest&) noexcept = 0;
};
```

- 只能由 Core Runtime Thread 在 Layout 阶段调用。
- 实现必须是同线程可调用的只读字体服务，不投递 UI queue、不等待 UI Thread、不访问 Host Tree。
- 返回值拥有自己的数据，不返回平台对象、引用或 out-param。
- 任何异常、非法 metrics 或不可用均转换为 `MEASURE_FAILED`；具体 metrics 校验属于 CORE-S07。

### 6.3 生命周期句柄

Composition Root 在 AppRuntime 启动前构造 Ports，构造成功即为 open，并保证其生命周期覆盖所有可能的请求和 Result 回流。`close()` 幂等。异步实现不得捕获 Runtime 裸指针；回流只持有可关闭的 `CoreIngressPort` 句柄。入口关闭后，late Result 被拒绝并由外围释放自身资源。

## 7. 线程与所有权

| 对象 | 写者/所有者 | 跨边界规则 |
|---|---|---|
| Core mailbox | 多 producer 投递；Core Runtime Thread 唯一消费 | 成功 post 时 move 所有权 |
| JS outbound message | JsRuntimePort 成功后由 JS 侧队列拥有 | 不共享 JS/C++ 可变对象 |
| Platform command | 对应 Platform Port 成功后由平台队列拥有 | 不携带 NativeHandle |
| Measure request/result | Core Runtime Thread 调用栈内按值/const view | 只读且不保留引用 |
| TraceEvent | producer 调用期间只读 | Sink 如需保留必须复制到外围有界存储 |
| RuntimeCounters | 计数所属 owner path 更新 | snapshot 是独立不可变值 |

平台可以让多个逻辑归属落在同一物理线程，但仍必须经过 Port 和队列，不能利用线程重合建立重入调用或共享可变状态。

## 8. 生命周期与销毁

统一顺序：

```text
mark runtime stopping
-> AppRuntimeFactory stop accepting create
-> producer gateways reject new business requests
-> close CoreIngressPort
-> stop/cancel JS and Platform producers
-> Core owner drains or cancels already accepted messages in order
-> release outbound Ports
-> release mailbox
-> release AppRuntime-owned RequestId/SurfaceId allocators and tombstones
-> after all AppRuntime instances are destroyed, release Host-owned AppRuntimeFactory/AppRuntimeIdAllocator
```

- `start/close` 必须幂等，析构前必须完成 `close`。
- Port 实现销毁前必须保证不会再调用已关闭入口；late completion 只能被拒绝和释放，不能复活 Runtime。
- Factory teardown 后 `liveAppRuntime=0`、`pendingCreate=0`，且 allocator 不再被任何 AppRuntime 或回调持有；单个 AppRuntime teardown 不要求 `AppRuntimeId` 序列归零。
- Foundation 不规定每类业务消息的取消结果；后续分 Spec必须按公共合同补齐。

## 9. 最小观测

### 9.1 Clock 与事件

```cpp
class MonotonicClock {
 public:
  virtual uint64_t nowNs() const noexcept = 0;
};

class TraceSink {
 public:
  virtual void emit(const TraceEvent&) noexcept = 0;
};

class NoopTraceSink final : public TraceSink {
 public:
  void emit(const TraceEvent&) noexcept override {}
};
```

`TraceEvent` 是 Observation Schema 的 fixed-shape typed C++ event view：固定 `schemaVersion/kind/producer/markerName`，必需 `runId/timestampNs/clockDomain/sequence`，其余字段用 typed optional 表示。它只读引用生命周期覆盖 `emit` 调用的预校验 Runtime context/ID，避免热路径复制 string 或构造动态 map；Sink 如需跨调用保留，必须复制到外围自有的有界槽位。构造器按 marker 规则校验必需关联字段；未知 marker 和任意 JSON payload 不可构造。

每个 producer/clockDomain 持有严格递增的 sequence allocator。时钟必须非递减；测试发现回退时样本失败，但 Runtime 业务不得失败。

### 9.2 emit 规则

- producer 在业务状态已确定的合同边界构造事件并调用 `emit`。
- `emit` 返回 `void` 且 `noexcept`，业务代码不能读取“Trace 是否成功”。
- Sink 不得回调任何 Runtime Port；不得等待 Collector、格式化文本、文件 I/O 或使用无界容器。
- OOM 路径使用预分配或栈上最小 `runtime.oom` 事件和静态错误消息，最多尝试一次；失败后直接继续业务错误路径。
- Collector 自身丢样不是 `QUEUE_OVERFLOW`，不得写入业务队列错误。

### 9.3 RuntimeCounters

```cpp
struct RuntimeCounterSnapshot final {
  uint64_t runtimeNodeLive;
  uint64_t handlerLive;
  uint64_t queueDepth;
  uint64_t surfaceLive;
};
```

- Node/Handler/Surface 由各自 Core owner path 做 O(1) 增减。
- queue depth 随成功 post/pop 做 O(1) 更新；不得扫描队列或 Runtime Tree。
- 下溢是实现错误，debug fail-fast；release 保持零并记录诊断失败，不允许整数回绕。
- `snapshot() noexcept` 返回稳定数值副本；是否生成 `runtime.counter.sampled` marker 由调用方在稳定边界决定。

## 10. 错误与降级

| 场景 | 同步结果 | Trace 尝试 | 业务状态 |
|---|---|---|---|
| 参数/ID 无效 | `ABI_INVALID_ARGUMENT` | 对应 failed marker 仅在公共合同要求时 | 不入队 |
| 队列已满 | `QUEUE_OVERFLOW` | `queue.overflow`，包含 depth | 已接受消息不变 |
| 消息准备分配失败 | `OUT_OF_MEMORY` | `runtime.oom` | 不入队、不部分转移 |
| Port 已关闭 | 上下文对应 terminal error | 可选对应 failed marker | 不入队 |
| Measure 失败/异常 | `MEASURE_FAILED` | 后续 Layout 模块负责关联 | 候选事务由 S07 丢弃 |
| TraceSink 丢样/内部失败 | 无业务错误 | 无递归 Trace | 业务行为不变 |

`retryable` 由具体业务合同确定；Foundation 不根据错误码自动重试。队列溢出不得在 Kernel 内建立隐藏重试或无界溢出区。

## 11. Fake 与故障注入

| 测试件 | 能力 |
|---|---|
| `ManualClock` | 显式推进整数纳秒；可注入回退以验证样本校验不影响业务 |
| `RecordingTraceSink` | 复制到测试拥有的固定容量数组；满后只标记测试样本丢失 |
| `FakeCoreIngress` | 小容量 mailbox、显式 pop/drain/close |
| `FakeJsRuntimePort` | 记录命令，按测试指令回流 success/failure/late Result |
| `FakeSurfacePort` | 控制 accepted、queue full、平台失败、关闭和晚到结果 |
| `FakeMountPort` | 控制 Mount accepted/result 顺序；不实现恢复策略 |
| `FakeMeasurePort` | 返回 measured/failed/非法 metrics，断言调用线程和无 Host 访问 |
| `FailingAllocator` | 在指定分配序号失败，验证 OOM 原子性 |

Fake 只模拟边界，不复制后续业务状态机。

## 12. Kernel 依赖边界

允许依赖：

```text
fixed Kernel module -> core-contracts/core-foundation/core-ports/core-observation
Platform/JS implementation -> core-ports
testing -> all abstract interfaces
```

禁止依赖：

```text
Core -X-> QuickJS/JNI/UIKit/LVGL/SDL
Core -X-> Platform Collector/Benchmark/logging/filesystem
Core -X-> optional Provider/Feature concrete implementation
```

固定 Kernel 的 `kernel.bridge/render/event/lifecycle/runtime-tree/transaction` 由后续分 Spec实现，但必须只朝 Foundation 和公共 Port 依赖。条件构建只能发生在 Composition Root、模块目标和依赖选择处，不能进入 Kernel 业务路径。
