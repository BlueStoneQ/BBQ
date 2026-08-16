# BM-S02 Marker 与 Trace：设计

## 目录

- [1. 结论](#1-结论)
- [2. 系统边界](#2-系统边界)
- [3. 输入与输出模型](#3-输入与输出模型)
- [4. Collector 消费合同](#4-collector-消费合同)
- [5. 样本有效性](#5-样本有效性)
- [6. 时钟域与顺序](#6-时钟域与顺序)
- [7. Marker 覆盖与关联](#7-marker-覆盖与关联)
- [8. Noop 与 Recording 等价](#8-noop-与-recording-等价)
- [9. 热路径开销验证](#9-热路径开销验证)
- [10. 状态、线程与所有权](#10-状态线程与所有权)
- [11. 错误与降级](#11-错误与降级)
- [12. 与后续分 Spec 的边界](#12-与后续分-spec-的边界)

## 1. 结论

BM-S02 采用两段式边界：**Collector 只可靠接收并封存事实，Validator 只判定事实能否支撑结论。**

```text
Runtime producer
  -> TraceSink.emit(TraceEvent)        非阻塞、noexcept
  -> Platform-owned bounded transport 外围复制与丢样计数
  -> Collector                         原样接收、封口
  -> Validator                         Schema/顺序/关联/覆盖/时钟判断
  -> BM-S03                            保存运行身份、原始批次和基础摘要
```

Collector 不解释业务成功，Validator 不修改 Runtime，BM-S02 不拥有公共 TraceEvent 定义。

## 2. 系统边界

| 部件 | 所在层 | 所有权 | BM-S02 的动作 |
|---|---|---|---|
| `MonotonicClock` | Runtime Kernel Port | Core | 只验证输出性质 |
| `TraceSink/NoopTraceSink` | Runtime Kernel Port | Core | 定义合同测试，不实现 |
| JS ObservationEmitter | JS Runtime Service | JS | 只消费公共 marker |
| Platform Trace transport | Platform 外围 | 各平台 | 定义消费要求，不规定 SDK |
| Collector | Benchmark/Platform 外围 | 后续 BM-S03/平台项目 | 冻结逻辑消费合同 |
| Validator | Benchmark | BM-S02 后续实现 | 本分 Spec 的核心实现对象 |
| Raw Store/Reporter | Benchmark | BM-S03/BM-S07 | 不在本分 Spec 实现 |

## 3. 输入与输出模型

本节定义 Benchmark 内部模型语义；字段实现语言与序列化格式由后续编码阶段决定，不是公共 Schema。

### 3.1 `TraceBatchInput`

```text
TraceBatchInput
  runIdentity
    runId
    observationSchemaVersion
    observationContractRevision
    compositionManifestHash
    profileId / target / buildMode / observationLevel
    jsEngine identity
  collectorMetadata
    collectorId / collectorVersion
    capacityEvents
    receivedEvents
    droppedEvents
    firstReceiveOrdinal / lastReceiveOrdinal
    started / sealed / sealReason
  rawEvents[]
  optionalClockCalibrations[]
```

`rawEvents[]` 保持接收顺序和原始字段；验证器可以生成索引，但不得重排或覆写。`runOriginNs` 是生产者内部状态，不进入 `TraceBatchInput` 或公共 TraceEvent。

### 3.2 `ValidationResult`

```text
ValidationResult
  status = valid | invalid | unsupported
  issues[]
    code
    severity
    eventKey?
    metricName?
    affectedScope = event | interval | producer-stream | batch
  metricIntervals[]
    metricName
    startEventKey / endEventKey
    clockDomain
    durationNs
  coverage
  traceBatchDigest
```

`unsupported` 只表示合同明确允许但当前无法计算，例如无校准的跨时钟域区间；不得伪装为 `valid=0ns`。

### 3.3 问题码

V1 内部问题码至少包括：

```text
SCHEMA_INVALID
RUN_ID_MISMATCH
MANIFEST_OBSERVATION_LEVEL_INVALID
DUPLICATE_EVENT_KEY
SEQUENCE_NOT_INCREASING
TIMESTAMP_REVERSED
CLOCK_DOMAIN_UNCALIBRATED
BOUNDARY_START_MISSING
BOUNDARY_END_MISSING
BOUNDARY_TERMINAL_CONFLICT
CORRELATION_ID_MISSING
CORRELATION_ID_MISMATCH
MARKER_COVERAGE_MISSING
COUNTER_SEMANTICS_INVALID
COLLECTOR_DROPPED_EVENTS
COLLECTOR_NOT_SEALED
BUSINESS_EQUIVALENCE_MISMATCH
HOT_PATH_CONSTRAINT_VIOLATION
```

这些是 Benchmark 内部验证分类，不是公共 `RuntimeError.errorCode`。

## 4. Collector 消费合同

### 4.1 接收

1. Collector 通过 Platform Composition Root 选定的外围 Sink/transport 接收事件，不进入 Kernel。
2. transport 若跨线程保留事件，必须复制到 Collector 自有的固定容量或显式上限缓冲；Runtime 内存不得借给异步消费者。
3. `emit` 路径不得等待 Collector；满载策略只能是有计数的丢弃或平台预先冻结的有界策略，不能无界扩容。
4. Collector 记录自己丢弃的事件数量，但不得伪造公共 `queue.overflow`；后者只表示 Runtime 业务队列溢出。

### 4.2 原样性

Collector 不得修改：

- `timestampNs`、`clockDomain`、`sequence`。
- `runId`、生产者和 marker 名称。
- 任何关联 ID、Revision、计数、字节或错误码。

Collector 可以增加独立的接收元数据，但这些元数据不进入公共 TraceEvent，也不替代生产者时间。

### 4.3 封口

Trace batch 只在以下之一发生后封口：

- 场景正常结束且所有已启动 Collector 完成 drain。
- 目标异常结束，Collector 记录异常封口原因。
- Collector 自身失败，记录失败与已知丢样。

封口后 batch 不可追加。未封口 batch、`droppedEvents > 0`、接收序号出现缺口或 transport 报告丢样时，batch 为 `invalid`；原始数据仍必须交给 BM-S03 保存。

## 5. 样本有效性

### 5.1 三层判定

```text
Event valid
  = 单事件符合公共 Schema

Producer stream valid
  = Event valid
  + 唯一事件键
  + sequence 严格递增
  + timestampNs 非递减

Batch valid
  = 所有必需 stream valid
  + Manifest/level 一致
  + 无已知丢样
  + 必需覆盖成立
```

指标区间还必须满足起止 marker、成功终态、关联键和时钟可比。Batch 可以整体无效，但其中不受影响的原始事件仍可用于问题定位；不得用于发布成功性能数字。

### 5.2 终态规则

对具有 `completed/failed` 或 `presented/failed` 终态的操作：

1. 相同关联键只能出现一个终态。
2. `failed` 必须保留并进入失败计数，不产生成功延迟。
3. 缺少终态时区间无效，不能用场景结束时间补齐。
4. 失败后触发 full rebuild 是新的、由 `mountAttemptId` 关联的链路，不覆盖原失败。

### 5.3 观测级别

| Manifest level | 判定 |
|---|---|
| `off` | 只允许 `custom`；无 marker 是合法运行，但不构成 V1 Benchmark 样本 |
| `baseline` | 必须满足当前场景触发的主链路、失败/降级和必要计数覆盖 |
| `diagnostic` | 先满足 baseline；附加事件只能使用公共 Catalog，不允许私有字段 |

覆盖是“场景触发事实的必需 marker”而不是“每次运行出现 Catalog 全部 marker”。例如未发生 OOM 时不要求 `runtime.oom`；OOM 故障注入用例必须出现。

## 6. 时钟域与顺序

### 6.1 内部时钟与 wire 时间

```text
Runtime 内部
  nowNs / runOriginNs = uint64 纳秒

Observation JSON wire
  timestampNs = nowNs - runOriginNs
  所有整数 = 0..Number.MAX_SAFE_INTEGER
```

生产者负责选择 run 原点，并在任一 wire 整数越界前轮换 `runId`；不得截断、回绕、转浮点近似或改成文本。BM-S02 不实现该机制，只直接消费公共 Schema，并验证事件处于其整数范围。

同一 `(runId, clockDomain)` 的生产者必须共享同一原点，因此其时间可直接比较。若原点不同，必须使用不同 `clockDomain` 并提供校准证据。原点不在 wire 上，Validator 不猜测隐藏原点，只验证 Schema、域语义和各生产者流的单调性。

### 6.2 单生产者规则

事件键定义为：

```text
(runId, producer, clockDomain, sequence)
```

同一 `(runId, producer, clockDomain)` 流中：

- `sequence` 严格递增，不要求连续。
- `timestampNs` 必须是公共 Schema 范围内的 run-relative 非负整数纳秒且非递减。
- 相同时间戳允许存在，顺序由 sequence 决定。
- Collector 到达顺序不能替代生产者顺序。

sequence 跳号本身不证明丢样，因为生产者可能有合法过滤；只有 Collector/transport 丢样元数据、重复键或合同要求的边界缺失才能判无效。

### 6.3 跨时钟域

同一指标的起止事件只有满足以下之一才能计算：

1. 两者 `clockDomain` 相同，且该 `(runId, clockDomain)` 的生产者遵守共享原点合同。
2. 存在该次运行的校准记录，明确域映射、误差上界和有效区间，且误差满足使用方要求。

BM-S02 不定义新的公共校准 marker。没有校准时输出 `CLOCK_DOMAIN_UNCALIBRATED/unsupported`，只报告各域内分段，不合成端到端耗时。

## 7. Marker 覆盖与关联

### 7.1 覆盖矩阵

Validator 从公共 Catalog 构造只读规则表，至少验证：

| 域 | 关键验证 |
|---|---|
| Build/Load/Module | started 与 completed/failed 闭合；Artifact/运行身份一致 |
| Bridge | `requestId` 必需；enqueued 后只有 completed 或 failed 一个终态 |
| Lifecycle | hook started 与 completed/failed 闭合，失败保留 |
| Surface/Platform | create/present 链路可由 `surfaceId` 关联 |
| Event | input 与全部目标/冒泡 handler 使用同一 `requestId`；Handler 区间再按 `handlerId` 区分；同步更新继续携带该 request，Render 由 `transactionId` 闭合 |
| Reactive/Render/Mount | `transactionId/revision/mountAttemptId` 按存在事实关联；成功与失败终态互斥 |
| Navigation/Capability | `requestId/surfaceId` 按合同事实关联，失败独立保留 |
| Resource | memory bytes、object count、counter value 各自保持单位 |
| Failure/Degrade | OOM、Runtime queue overflow、full rebuild 的必需字段与终态完整 |

具体 marker 名称和字段必需性始终从公共合同与 Schema读取，不在实现中复制一份可独立演进的公共枚举。

连续输入必须使用不同 `requestId`；同一次输入的冒泡 Dispatch 必须复用该值。Validator 不按时间接近或接收顺序猜测关联。已知由 Handler 同步 flush 产生的状态与 Render marker 缺少或错用该 `requestId` 时，对应 Event/update 区间无效；异步任务不得沿用旧输入 ID。

### 7.2 结构化计数

- `runtime.counter.sampled` 必须携带公共 `counterName + counterValue`。
- 同一 owner domain 内计数可用于趋势和终态比较，但 Snapshot 不是业务状态的替代品。
- `queue.overflow` 必须携带 `queue.depth`、非负值和 `errorCode`。
- `memory.sampled` 使用 bytes；`object.sampled` 使用 count；两者不相加。
- Collector 自身队列深度和丢样计数属于 Collector 元数据，不冒充 Runtime counter。

## 8. Noop 与 Recording 等价

### 8.1 实验设计

对同一确定性 fixture、相同 Artifact、Profile、Engine、构建模式和输入序列执行两次：

```text
Run A: NoopTraceSink
Run B: RecordingTraceSink with bounded in-memory collector
```

随机源、外部时钟业务输入和异步平台响应必须由 Fake Port 固定。Trace 自身的 `timestampNs/sequence` 不进入业务投影。

### 8.2 业务投影

比较以下结果：

- typed results 与公共错误码。
- App/Page/Surface 最终状态。
- Runtime Tree 逻辑快照或其稳定摘要。
- committed Revision 与 Transaction 结果序列。
- Handler/Node/Surface live counter 终态。
- 对外 Platform command 和 JS dispatch 的业务顺序。
- full rebuild、失败和降级的业务结果。

允许差异只有 Trace 事件、Collector 元数据和实验耗时。任一业务投影差异均为 `BUSINESS_EQUIVALENCE_MISMATCH`。

### 8.3 Sink 故障注入

额外使用以下 Recording Sink：

- 容量耗尽后计数并丢弃。
- 每次 emit 都拒绝记录。
- Collector 已停止。

三种情况下 Runtime 业务投影必须仍与 Noop 一致，且不存在 Runtime -> Collector 等待或回调。

## 9. 热路径开销验证

### 9.1 结构门禁

通过代码检查、替身和系统调用/分配探针验证 emit 路径：

- 不格式化文本。
- 不执行文件或网络 I/O。
- 不等待 Collector，不获取可能由 Collector 持有的锁。
- 不发生无界扩容或递归重试。
- OOM marker 尝试路径不申请依赖成功的新堆内存。

任一违反直接失败，不依赖性能数字抵消。

### 9.2 定量实验

固定单一线程、固定事件形状、预热、构建模式和迭代数，分别测量：

```text
control: 构造等价业务输入但不调用 emit
noop:    调用 NoopTraceSink.emit
record:  调用有足够容量的 RecordingTraceSink.emit
full:    调用容量已满的 RecordingTraceSink.emit
```

每组保存总 `elapsedNs`、调用次数、每调用摊销 ns、分配次数/bytes、峰值缓冲 bytes 和 dropped count。至少重复多轮并保留全部原始轮次；BM-S02 只输出观测开销证据，不在 V1 冻结跨设备统一百分比阈值。

通过条件是：结构门禁全部成立；内存受配置容量约束；满载不阻塞、不扩容；Noop 不产生事件存储；Recording 的定量结果完整可复测。后续性能预算如需设定，必须由具体目标 Profile 基线单独冻结。

## 10. 状态、线程与所有权

### 10.1 Collector 状态机

```text
created -> accepting -> sealing -> sealed
                     \-> failed -> sealed
```

- `created`：尚未接收事件。
- `accepting`：接收并复制到有界缓冲。
- `sealing`：停止新接收并 drain 已接收事件。
- `failed`：记录 Collector 故障和丢样，不影响 Runtime。
- `sealed`：批次不可变，可交给 Validator/BM-S03。

### 10.2 线程边界

| 执行域 | 可做 | 不可做 |
|---|---|---|
| Runtime producer thread | 读取时钟、构造有界事件、调用非阻塞 emit | 文件 I/O、文本格式化、等待 Collector |
| Collector ingest thread | 消费外围缓冲、附加接收元数据 | 回调 Runtime、改写事件 |
| Validator worker | 校验 sealed batch、建立索引和结果 | 访问 Runtime 可变状态、改变原始批次 |

### 10.3 生命周期与所有权

- Runtime 只拥有 emit 调用期间的 immutable event view。
- transport/Collector 要保留事件就复制，复制后由 Collector 独占。
- sealed batch 交给 BM-S03 时使用不可变所有权或只读共享。
- Runtime teardown 不等待报告生成；Collector drain 的等待只发生在 Benchmark 控制面，不发生在 Runtime 热路径。

## 11. 错误与降级

| 条件 | Runtime 行为 | Benchmark 行为 |
|---|---|---|
| Schema 非法/未知 marker | 不由 Benchmark 反向影响 | 保留原始事件，batch invalid |
| JSON wire 整数越界 | 生产者应在越界前轮换 run | Schema 拒绝事件，禁止截断或回绕 |
| sequence/timestamp 逆序 | 不变 | producer stream invalid |
| 缺少边界/关联 ID | 不变 | 对应 interval invalid |
| 无跨域校准 | 不变 | 只保留分段，合成指标 unsupported |
| Collector 丢样/失败 | 不变 | batch invalid，记录丢样与封口原因 |
| Runtime queue overflow | 按 Runtime 错误合同失败 | 验证公共 marker，不与 Collector 丢样混淆 |
| Recording/Noop 结果不同 | 暂停发布样本 | 等价验证失败，回报对应 Runtime 项目 |
| 热路径结构违规 | Runtime 功能可继续调试 | BM-S02 验收失败 |

## 12. 与后续分 Spec 的边界

- BM-S03 实现 run lifecycle、运行身份、持久化和基础摘要，并消费本分 Spec 的 sealed batch/validation 语义。
- BM-S04/S05/S06 实现各平台 Target 与平台采集接入，但必须满足本 Collector 合同。
- BM-S07 只使用 `valid` 成功样本生成基础报告，同时保留 failed/invalid 数量和原始回链。
- BM-S08 第二期才冻结完整 Dataset Schema、统计与长期 Raw Store。
