# CORE-S01 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 非目标](#5-非目标)
- [6. 需求追踪](#6-需求追踪)

## 1. 结论

Foundation 必须让后续 Core 模块只关注业务语义：跨线程投递、所有权、背压、错误、ID 和观测都只有一套实现规则，并且不泄漏 JS 引擎或平台类型。

## 2. 输入与输出

### 2.1 输入

- v3 公共 typed message 与 Schema。
- Composition Root 注入的 Port、时钟、TraceSink 和固定队列容量。
- JS/Platform/Host 向 Core 回流的不可变 typed message。
- 测试注入的时钟、Fake Port、分配失败和队列饱和条件。

### 2.2 输出

- 后续 Core 分 Spec可复用的 C++ 基础类型和接口合同。
- 明确的线程、消息所有权、关闭和错误规则。
- 可确定驱动的 Fake Port、Recording Sink 与故障注入点。
- 固定 Kernel 反向依赖检查规则。

## 3. 功能需求

| ID | 需求 |
|---|---|
| CORE-S01-R01 | `RuntimeValue` 必须精确表达公共值域；进入队列前完成深拷贝或不可变所有权转移，拒绝公共合同禁止的值。 |
| CORE-S01-R02 | `RuntimeError` 必须使用公共错误码、`message/retryable` 和限定关联 ID；跨边界不得传播语言异常。 |
| CORE-S01-R03 | 每类公共运行时 ID 必须是独立强类型；解析时校验前缀和非空载荷，禁止平台指针编码与不同 ID 隐式转换。 |
| CORE-S01-R04 | Foundation 必须提供作用域明确、单调且生命周期内不复用的 ID allocator 基础；producer 与作用域遵循公共 ID Contract。`AppRuntimeId` 只由 Core `AppRuntimeFactory` 生成，其 allocator 属于一个 Runtime Host 实例并晚于该 Factory 创建的全部 AppRuntime 销毁；Platform Host 不生成或传入该 ID。 |
| CORE-S01-R04A | 同一 AppRuntime 内存在多个 `RequestId` producer 时，必须共享一个 AppRuntime 级 allocator，或使用由 AppRuntime 统一配置且值域互斥的命名分区；禁止各 producer 从相同局部序列直接生成 `req:` 值。 |
| CORE-S01-R05 | Core ingress 必须使用构造期固定容量的有界 mailbox；多个 producer 可投递，只有 Core Runtime Thread 消费。 |
| CORE-S01-R06 | 入队 API 必须同步返回 accepted 或 typed error；accepted 只表示消息所有权已转移并进入队列，不表示业务执行成功。 |
| CORE-S01-R07 | 队列满固定拒绝新消息并返回 `QUEUE_OVERFLOW`；已接受消息不得被静默覆盖或丢弃。 |
| CORE-S01-R08 | 必须定义 `CoreIngressPort`、`JsRuntimePort`、`PlatformSurfacePort` 和 `PlatformMountPort` 的异步投递基础，业务消息闭集由对应后续分 Spec和公共 Schema决定。 |
| CORE-S01-R09 | `PlatformMeasurePort` 必须是在 Core Runtime Thread 内执行的同步、只读、无异常调用；它不等待 UI Thread，也不访问 Host Tree。 |
| CORE-S01-R10 | 所有异步 Port 必须定义“构造成功即 open”与幂等 close、关闭后的拒绝、在途消息处理和销毁次序；不得通过裸回调捕获已销毁 Runtime。 |
| CORE-S01-R11 | 必须提供可替换 `MonotonicClock`，返回同一 clock domain 内非递减的 `uint64` 整数纳秒。 |
| CORE-S01-R12 | 必须提供 `TraceSink::emit(const TraceEvent&) noexcept` 与 `NoopTraceSink`；调用不得阻塞、抛异常、重入 Runtime、格式化文本或执行 I/O。 |
| CORE-S01-R13 | `TraceEvent` 必须是调用期间不可变的结构化值，只包含公共 Observation Schema 允许的 marker、ID、整数和枚举字段。 |
| CORE-S01-R14 | 必须提供 O(1) 更新的 `RuntimeCounters`，至少覆盖 live Node、Handler、Surface 和队列深度，并在稳定边界生成不可变 snapshot。 |
| CORE-S01-R15 | OOM 和业务队列溢出必须分别返回 `OUT_OF_MEMORY`、`QUEUE_OVERFLOW`，并尽力发出 `runtime.oom`、`queue.overflow`；Trace 失败不得替换业务错误。 |
| CORE-S01-R16 | 必须提供 Fake Clock、Fake/Recording Ports、Recording Sink、受控 allocator failure 和可配置小容量 mailbox，支持无真实平台的确定性测试。 |
| CORE-S01-R17 | Kernel 只能依赖标准库、公共 value/contract 层和抽象 Port；不得依赖 JS Engine Provider、平台 SDK、Backend、Collector 或可选 Feature。 |

## 4. 质量需求

| 维度 | 要求 |
|---|---|
| 确定性 | 相同消息顺序、时钟输入和 Fake 结果必须得到相同接受结果、出队顺序、错误与计数。 |
| 内存 | 业务队列容量固定；失败不部分转移所有权；不得建立无界重试队列。 |
| 线程 | 只有 Core Runtime Thread 消费 Core mailbox 和修改 Core-owned state；异步 Port 不同步执行对端业务。 |
| 关闭 | teardown 先停止 producer 接受，再关闭入口、取消或消费既有消息，最后释放 Port 与 ID/tombstone 所有者。 |
| 可移植 | 公共头文件不出现 JNI、Android、UIKit、LVGL、SDL、QuickJS 或操作系统句柄。 |
| 可观测 | Noop 与 Recording 配置除 Trace 证据外行为完全等价；热路径无 Collector 等待。 |
| 可测试 | 所有失败分支无需真实 JS 引擎或 UI 即可注入和断言。 |

## 5. 非目标

- 不定义任一后续业务消息的处理算法或状态机。
- 不实现通用动态 Bridge、反射调用或通用 JSON envelope。
- 不定义线程创建方式或 EventLoop Backend；平台可以把逻辑归属映射到同一线程。
- 不提供 lock-free 性能承诺；V1 先保证有界、非阻塞式接受语义和正确所有权。
- 不在 Core 中实现观测采集、丢样统计、存储或分析。

## 6. 需求追踪

| 上级需求 | 本分 Spec |
|---|---|
| CORE-R04、CORE-R19 | R01-R10（含 R04A） |
| CORE-R20、CORE-R22 | R11-R16 |
| CORE-R21 与平台无关质量要求 | R17 |
