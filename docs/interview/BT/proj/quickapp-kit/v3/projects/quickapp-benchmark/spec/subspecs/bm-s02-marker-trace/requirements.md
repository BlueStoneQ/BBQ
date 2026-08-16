# BM-S02 Marker 与 Trace：需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 非目标](#5-非目标)
- [6. 需求追踪](#6-需求追踪)

## 1. 结论

BM-S02 必须建立一条可自动执行的证据链：**公共事件合法 -> 单次 Trace 语义有效 -> V1 覆盖完整 -> Recording 与 Noop 行为等价 -> 热路径约束成立。**

任何缺失、重复、逆序、时钟不可比、wire 整数越界或 Collector 丢样都必须显式使受影响样本无效；不得修补、截断、回绕原始事实或改用日志时间代替。

## 2. 输入与输出

### 2.1 输入

| 输入 | 权威来源 | 使用方式 |
|---|---|---|
| Marker 字段、名称与指标边界 | 公共 Observation Contract/Schema | 只读并校验 |
| `observationLevel`、Profile 与 Engine identity | Runtime Composition Manifest | 决定允许的观测级别和样本分组 |
| TraceEvent 流 | Runtime/Toolkit/Platform 生产者 | Collector 消费并保留原值 |
| Runtime 业务结果 | 对应 Runtime 合同测试或 Case Harness | 与 Noop/Recording 运行结果比较 |
| 构建与运行身份 | 后续 BM-S03 | 为每批 Trace 提供封口上下文 |

### 2.2 输出

| 输出 | 语义 |
|---|---|
| `ValidationResult` | 单事件与整批 Trace 的有效性、问题码和受影响范围 |
| `CoverageResult` | 按生产域、观测级别和场景能力声明的 marker 覆盖结果 |
| `SealedTraceBatch` | 保留原始事件及 Collector 元数据的不可变批次 |
| `EquivalenceResult` | Noop/Recording 两次运行的业务投影是否一致 |
| `OverheadEvidence` | 被测版本、环境、负载、Sink 模式和原始计时/分配证据 |

以上均为 Benchmark 内部模型，不得反向成为 Runtime 成功依赖。

## 3. 功能需求

| ID | 需求 |
|---|---|
| BM-S02-R01 | 验证每个事件符合公共 Observation Schema，不接受未知字段、未知 marker、非法 ID 或超出 `0..Number.MAX_SAFE_INTEGER` 的 JSON wire 整数；上限只从公共 Schema 消费。 |
| BM-S02-R02 | 验证 `timestampNs` 是 `nowNs - runOriginNs` 的 run-relative 整数纳秒；同一 `(runId, clockDomain)` 共享原点，同一 `(runId, producer, clockDomain)` 内 `sequence` 严格递增且时间非递减；重复键、截断、回绕或越界使批次无效。 |
| BM-S02-R03 | 验证跨时钟域指标只有在存在明确校准证据时才可合成；否则只保留分段结果。 |
| BM-S02-R04 | 按公共指标边界匹配成功、失败和未闭合区间；失败或缺失边界不得产生成功延迟。 |
| BM-S02-R05 | 验证 `runId` 及各链路关联 ID：Event 必须以同一 `requestId` 贯穿 input 与目标/冒泡 Handler，Handler 区间再以 `handlerId` 区分；同步更新以该 `requestId` 关联，并由 `transactionId` 闭合 Render。不得按到达顺序、时间戳或推造 ID 匹配。 |
| BM-S02-R06 | 验证 `off/baseline/diagnostic` 与 Runtime Composition Manifest 一致；`conformance=v1` 的 `off` 样本无效，baseline 不要求 diagnostic-only 采样。 |
| BM-S02-R07 | 验证 V1 Catalog 覆盖 Build、Load、Bridge、Lifecycle、Surface、Event、Reactive、Render、Mount、Platform、Navigation、Capability、Resource、Failure/Degrade 域。 |
| BM-S02-R08 | 验证 Bridge 三态 marker 携带 `requestId`，失败携带 `errorCode`，且同一请求只有一个终态。 |
| BM-S02-R09 | 验证 `runtime.oom`、`queue.overflow` 和 `mount.full-rebuild.*` 的必需错误、计数与关联字段；Collector 不触发 Runtime 重试或降级。 |
| BM-S02-R10 | 验证 `runtime.counter.sampled` 只使用公共封闭名称，并保持非负整数；Node、Handler、Queue、Surface 不与 memory/object 单位混算。 |
| BM-S02-R11 | 验证 `logicalPayloadBytes` 与 `actualTransportBytes` 的语义分离；后者缺失是“不可用”，不得估算。 |
| BM-S02-R12 | Collector 必须原样保留事件字段，通过有界自有缓冲接收；不得覆盖生产者时间、sequence、ID 或错误。 |
| BM-S02-R13 | Collector 必须记录接收数、丢弃数、首末接收序号、封口原因和自身状态；任何已知或推断丢样均使受影响批次无效。 |
| BM-S02-R14 | `TraceSink` emit 失败、Collector 停止或缓冲溢出不得回调、阻塞或改变 Runtime；Benchmark 只能将样本标为无效。 |
| BM-S02-R15 | 对同一确定性输入分别注入 Noop 与 Recording Sink，比较 Runtime 状态、typed result、Revision、错误、业务事件顺序、输入 `RequestId` 传播和资源终态；除观测证据外必须一致。 |
| BM-S02-R16 | 热路径验证必须同时覆盖结构约束和定量证据：无文本格式化、无文件 I/O、无 Collector 等待、无无界分配，并记录 Noop/Recording 相对基线的调用成本与缓冲占用。 |
| BM-S02-R17 | 原始事件和失败原因必须保留；Validator 不得删除、重排、补写或就地修复输入。 |
| BM-S02-R18 | 发现公共合同无法表达必需事实时，只在 Benchmark Handoff 提交 `[待决策]`，暂停受影响验证，不修改公共合同。 |

## 4. 质量需求

| 维度 | 要求 |
|---|---|
| 确定性 | 相同输入事件序列产生相同问题码、有效性和覆盖结果。 |
| 非侵入 | 验证与采集失败只影响证据，不改变 Runtime 状态机。 |
| 有界 | Collector 容量和单事件大小有明确上限；无无限队列和自动重试。 |
| 可审计 | 每个结论可回链到原始事件、公共合同版本、Manifest identity 和验证器版本。 |
| 可移植 | 验证核心不依赖 Android、LVGL、iOS API；平台只提供 Collector 接入和平台事实。 |
| 可解释 | 问题码指出事件键、规则、影响范围和样本状态，不以自由文本代替机器分类。 |
| 可复测 | 等价与开销实验固定构建模式、负载、迭代、环境和原始结果。 |
| 无损整数 | JSON 证据只接受公共安全整数范围，不以浮点近似、字符串改写、截断或回绕保留越界值。 |

## 5. 非目标

- 不冻结完整 Raw Dataset Schema；由 BM-S03 负责。
- 不实现完整统计、percentile、异常值模型和报告系统。
- 不比较 Android、LVGL、iOS 或外部框架的性能优劣。
- 不设计 Runtime Trace 实现细节或平台 Collector 的 SDK 接口。
- 不实现 Runtime 内部 `uint64 ns` 时钟、`runOriginNs` 分配或溢出前 run 轮换。
- 不增加公共 marker、字段、counter 或错误码。
- 不承诺一个脱离目标硬件与编译器的统一纳秒开销阈值。

## 6. 需求追踪

| 上游需求 | 本分 Spec 覆盖 |
|---|---|
| `QK-R15`、`BM-R02` | R01-R14、R17-R18 |
| `QK-R21`、`BM-R15` | R02-R03、R06、R08-R10、R14-R16 |
| `BM-R08`、`BM-R13` | R10-R11 |
| `BM-R14` | R06、R17 |
