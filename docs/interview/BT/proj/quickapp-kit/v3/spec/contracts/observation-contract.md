# Observation Contract

## 目录

- [1. 结论](#1-结论)
- [2. 所有权](#2-所有权)
- [3. Runtime 最小机制](#3-runtime-最小机制)
- [4. Marker 结构](#4-marker-结构)
- [5. V1 Marker Catalog](#5-v1-marker-catalog)
- [6. 指标边界](#6-指标边界)
- [7. 字节、内存与计数器](#7-字节内存与计数器)
- [8. 时钟与顺序](#8-时钟与顺序)
- [9. 失败与演进](#9-失败与演进)

## 1. 结论

Observation Contract 是 Toolkit、JS、Core、Platform 和 Benchmark 之间唯一公共观测合同：生产者只记录已发生的事实，Benchmark 只采集和推导指标，任何观测都不得改变 Runtime 成功条件或状态机。

本质是：**Runtime 只产生结构化运行事实；外围负责采集、存储、分析和展示。**

机器合同：[observation.schema.json](./schemas/observation.schema.json)。

## 2. 所有权

| 角色 | 责任 |
|---|---|
| 总架构 Agent | 维护本公共合同、Schema、marker 名称和不兼容变更 |
| CORE-S01 | 实现 `TraceSink`、`MonotonicClock`、`RuntimeCounters` 与 Noop 合同，不实现采集和存储 |
| BM-S02 | 校验 marker 覆盖、指标边界、开销和采集可行性；定义 Collector 消费合同，通过 Handoff 提交公共合同变更建议 |
| Toolkit/JS/Core/Platform | 按冻结 Schema 产生 marker，不定义私有同义 marker |
| Platform Collector | 适配 Android、LVGL、iOS 的 Trace 接收、平台指标和导出通道，不进入 Kernel |
| Benchmark Collector | 采集、校验、保存 marker，并从成对边界推导指标和报告 |

BM-S02 的项目文档不是第二个公共事实源。任何新增字段或 marker 必须先以 `[待决策]` 提交，由总架构 Agent 更新本文件和 Schema 后才能被其他项目消费。

## 3. Runtime 最小机制

C++ Runtime Kernel 必须依赖以下平台无关 Port，不依赖日志库、文件系统或平台采集器：

```text
MonotonicClock.nowNs() noexcept -> uint64 integer nanoseconds
TraceSink.emit(immutable TraceEvent) noexcept
RuntimeCounters.snapshot() noexcept -> immutable numeric snapshot
```

冻结规则：

1. `TraceSink` 由 Platform Composition Root 注入，可替换为 `NoopTraceSink`；关闭观测前后 Runtime 的状态、事务结果、错误和线程顺序必须一致。
2. `emit` 必须非阻塞、不可重入 Runtime、不得抛异常；热路径不得格式化文本、执行文件 I/O、等待锁或分配无界内存。
3. `TraceEvent` 只携带冻结 marker、公共 ID、整数纳秒和数值字段；Sink 若需跨线程保留事件，必须复制到外围自有的有界缓冲区。
4. `RuntimeCounters` 在既有 owner thread 状态变化中做 O(1) 更新；只在稳定边界或外围采样请求时生成 immutable snapshot，不通过扫描 Runtime Tree 计算常规样本。
5. Runtime 队列溢出与 Trace Collector 丢样是两个事实：前者发 `queue.overflow` 并影响对应业务请求；后者只使观测样本无效，不得改变 Runtime 行为。

观测级别由 Runtime Composition Manifest 声明：

| Level | 语义 |
|---|---|
| `off` | 注入 Noop Sink，不产生 marker；只允许 `custom` Profile |
| `baseline` | 主链路、失败、降级和必要资源计数；`conformance=v1` 的最低级别 |
| `diagnostic` | 在 baseline 之上提高采样频率或增加实现诊断；不得改变业务语义 |

Release 可以关闭 `diagnostic` 而保留 `baseline`。完整日志、持久化、统计、报告、可视化和外部框架对比不属于 Kernel。

## 4. Marker 结构

每条 marker 必须包含：

```text
schemaVersion = 1
kind = observationMarker
runId
producer = toolkit | js | core | platform | benchmark
markerName
timestampNs
clockDomain
sequence
```

关联字段按事实存在时携带：`artifactSha256`、`appRuntimeId`、`surfaceId`、`requestId`、`transactionId`、`mountAttemptId`、`nodeId`、`handlerId`、`revision`。

事件链是强制关联事实：`event.input.captured` 与由该输入产生的全部 `event.handler.*` 必须携带同一个 `requestId`。若 V1 Handler 的同步状态 flush 产生更新，相关 `state.mutated`、`render.flush.started` 和 `render.transaction.*` 还必须携带该 `requestId`；无更新时不得伪造 Render marker，异步任务不自动继承输入关联。

度量字段只能用于对应事实：`operationCount`、`logicalPayloadBytes`、`actualTransportBytes`、`memoryBytes`、`objectCount`、`counterName`、`counterValue`、`metricKind`、`samplingPhase`、`errorCode`。禁止附加任意 JSON payload 形成日志旁路。

## 5. V1 Marker Catalog

| 生产域 | Marker |
|---|---|
| Toolkit | `build.started/completed/failed` |
| Core Loader | `package.open.started`、`package.verified`、`package.failed` |
| JS Module | `module.load.started/completed/failed` |
| Bridge | `bridge.request.enqueued/completed/failed` |
| JS Lifecycle | `lifecycle.hook.started/completed/failed` |
| Core Surface | `surface.create.accepted/presented/failed`、`surface.destroy.started/completed` |
| Event | `event.input.captured`、`event.handler.started/completed/failed` |
| Reactive | `state.mutated`、`render.flush.started` |
| Render | `render.transaction.submitted/presented/failed` |
| Mount | `mount.transaction.submitted/completed/failed` |
| Platform | `platform.present.requested/completed/failed` |
| Navigation | `navigation.push.accepted/presented/failed` |
| Capability | `capability.requested/completed/failed` |
| Resource | `memory.sampled`、`object.sampled`、`runtime.counter.sampled` |
| Failure/Degrade | `runtime.oom`、`queue.overflow`、`mount.full-rebuild.started/completed/failed` |

同一语义只能使用表中一个 marker 名称。`completed` 表示该边界成功完成；失败必须使用对应 `failed` 并携带 `errorCode`。

`runtime.counter.sampled` 的 `counterName` V1 封闭为：`runtime.node.live`、`handler.live`、`queue.depth`、`surface.live`。OOM、队列溢出和 full rebuild 失败必须携带 `errorCode`；full rebuild 全部阶段必须携带 `surfaceId` 与 `mountAttemptId`。

## 6. 指标边界

| 指标 | 起点 | 终点 |
|---|---|---|
| `startup.total` | Root create request accepted | `surface.create.presented` |
| `startup.platformPresent` | `platform.present.requested` | `platform.present.completed` |
| `event.toHandlerStart` | `event.input.captured` | `event.handler.started` |
| `event.handlerDuration` | `event.handler.started` | `event.handler.completed` |
| `update.inputToPresented` | `event.input.captured` | `render.transaction.presented` |
| `update.stateToPresented` | `state.mutated` | `render.transaction.presented` |
| `update.flushToPresented` | `render.flush.started` | `render.transaction.presented` |
| `navigation.push` | `navigation.push.accepted` | `navigation.push.presented` |

失败样本不生成成功延迟，但必须保留全部 marker 并计入失败率。不同起点的 update 指标分别报告，不混称一个数字。

事件指标按 `requestId` 匹配；`event.handlerDuration` 还按 `handlerId` 区分同一次输入中的目标与冒泡 Handler，`update.inputToPresented` 再通过 `transactionId` 闭合对应 Render 链路。禁止按到达顺序或相近时间戳猜测关联。

## 7. 字节、内存与计数器

1. `logicalPayloadBytes` 是公共 typed message 经 RFC 8785 JSON Canonicalization Scheme 序列化后的 UTF-8 字节数，只表示逻辑载荷，不表示真实传输。
2. `actualTransportBytes` 只在真实跨进程/跨语言 transport 可准确采集时记录；不得用日志文本长度代替。
3. 内存统一使用 `memoryBytes`，并同时记录 `metricKind` 与 `samplingPhase`。
4. Host 与 LVGL 对象使用 `objectCount`；count 不得与 RSS/heap bytes 相加。
5. Runtime Node、Handler、Surface 和队列深度使用 `counterName + counterValue`；`counterValue` 是非负整数，队列深度不得伪装成内存或对象字节。

## 8. 时钟与顺序

Runtime 内部 `MonotonicClock.nowNs()` 保持 `uint64` 纳秒。跨项目 JSON Observation wire 上的全部整数必须位于 `0..Number.MAX_SAFE_INTEGER`，保证 JavaScript、C++ 和平台 Collector 无损读取；不得用浮点近似或文本数字绕过合同。

`timestampNs` 必须是 `MonotonicClock.nowNs() - runOriginNs` 的同一 run 相对时间；`runOriginNs` 不进入 wire。同一 `(runId, clockDomain)` 只能有一个共享原点；无法共享原点的 producer 必须声明不同 `clockDomain` 并执行校准。同一生产者的 `sequence` 严格递增。producer 必须在任一 wire 整数溢出前结束并轮换 run，不能截断或回绕。跨时钟域只有在记录校准方法并验证误差后才能合成端到端指标；否则只报告各域分段。

Collector 不得按文件到达顺序覆盖 marker 自身的 `timestampNs/sequence`。重复 `(runId,producer,clockDomain,sequence)` 使样本无效。

## 9. 失败与演进

- Schema 不合法、未知 marker、缺少成对边界或时钟逆序时，样本标记 invalid，不删除原始记录。
- Runtime 功能成功不依赖 Trace 输出成功；Trace 失败只影响观测样本有效性。
- OOM 路径必须使用预分配或栈上最小事件尝试发出 `runtime.oom`；无法发出时仍按 Runtime 错误合同终止对应请求，不得递归分配或重试 Trace。
- Core/JS/Platform 的 `errorCode` 必须引用公共 Error Contract；Toolkit 自有构建错误使用其冻结诊断码。
- 新 marker 或字段必须更新本合同、Schema、正负例和受影响项目 Handoff。
- V1 不定义 percentile、跨设备归一化、外部框架排名或完整观测开销模型。
