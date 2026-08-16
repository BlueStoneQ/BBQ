# Benchmark 总 Spec：总体架构

## 目录

- [1. 结论](#1-结论)
- [2. 组件架构](#2-组件架构)
- [3. 时间与关联模型](#3-时间与关联模型)
- [4. 运行流程](#4-运行流程)
- [5. 数据与统计](#5-数据与统计)
- [6. 跨项目边界](#6-跨项目边界)

## 1. 结论

V1 Benchmark 采用**场景控制、目标适配、原始采集、基础摘要**分层架构。Runtime 只发事实 marker；完整离线聚合与对比进入第二期。

公共 [Observation Contract](../../../spec/contracts/observation-contract.md) 及其 Schema 由总架构维护，是唯一事实源。Benchmark `BM-S02` 验证 marker 覆盖、指标边界、测量可行性和观测开销，定义 Collector 消费方式；发现缺口时通过 Handoff 提议变更，不建立第二套协议。

Runtime Kernel 只通过 `TraceSink` 发出结构化事实并维护轻量计数器；Platform Collector 负责接收、缓冲和导出。Benchmark 位于 Collector 之后，不向 Kernel 注入存储、聚合、文本格式化或报告逻辑。

## 2. 组件架构

```text
Benchmark CLI
  -> Scenario Catalog
  -> Experiment Controller
      -> Target Adapter(Android/LVGL/iOS/external)
      -> Input Driver
      -> Artifact/Environment Resolver
  -> Runtime Trace Collector
  -> Platform Metric Collector
  -> Raw Sample Store
  -> Basic Reporter
  -> Aggregator / Comparator (second phase)
  -> Report Renderer
```

| 组件 | 责任 |
|---|---|
| Scenario Catalog | 步骤、成功断言、预热和采样规则 |
| Target Adapter | build/install/start/input/stop，不解释 Runtime 内部语义 |
| Trace Collector | 收集公共 ID 关联的结构化 marker，记录丢样并保持 Runtime 非侵入 |
| Platform Collector | 采集 RSS/heap/CPU/frame 等平台数据 |
| Raw Store | 保存不可变样本和环境元数据 |
| Basic Reporter | 保存原始样本并输出基础摘要 |
| Aggregator（第二期） | 校验样本、计算完整统计、标记异常与失败 |
| Report | 表格、趋势和差异说明，可回链原始数据 |

## 3. 时间与关联模型

单次运行使用一个 `runId`；Runtime 原有 `surfaceId/requestId/transactionId/mountAttemptId` 保持原语义。Collector 将它们与 runId 关联，不要求 Runtime 修改公共业务消息。时间只接受生产者单调时钟产生的整数纳秒；`off` 样本不进入 V1 Benchmark，`baseline/diagnostic` 必须分组。

V1 指标名称、起止 marker 和成功语义只引用公共 Observation Contract 第 6 节，Benchmark 不在项目内维护第二份指标字典。BM-S02 必须按公共 marker 对匹配样本；缺少边界或失败 marker 的样本保留为 invalid/failed，不得改用调用发送、回调接收或日志时间代替。

跨进程或跨时钟域时必须记录校准方式；无法可靠校准的分段不拼成伪精确总值。

事务大小分为 `logicalPayloadBytes` 与 `actualTransportBytes`：前者严格按公共合同冻结的 RFC 8785 JCS 序列化结果计算 UTF-8 字节数，后者只在真实 transport 可准确采集时记录；不得用日志文本长度代替。内存数值统一使用 bytes，并携带 collector、metric kind 和 sampling phase；对象数量使用 count，不能与 RSS/heap 相加。

## 4. 运行流程

```text
resolve artifact and environment
  -> validate scenario preconditions
  -> optional warmup
  -> reset target to declared state
  -> start collectors
  -> execute steps and assertions
  -> stop collectors
  -> persist raw sample including failures
  -> repeat N times
  -> aggregate and render report
```

场景断言失败时该样本标记 failed，不进入成功延迟分布，但必须进入失败率和原始数据。

## 5. 数据与统计

Raw Sample 至少包含：

- run/scenario/target/build/artifact identity。
- environment 和配置。
- ordered markers。
- platform time-series 与内存 snapshot。
- assertions、status 和 failure reason。

Basic Reporter 不覆盖原始数据。报告必须区分测量值、推导值和无法采集项；第二期 Aggregator 同样不得覆盖原始数据，不同硬件的指标不自动标准化成排名。

## 6. 跨项目边界

| 项目 | Benchmark 依赖 |
|---|---|
| Toolkit | 构建阶段 marker、Artifact manifest、大小和哈希 |
| JS | Hook、Handler、Dirty、ABI marker |
| Core | Package、Render、Mount、Event、Navigation、Measure marker |
| Platform | Present、input、memory、frame 和平台错误 marker |
| Examples | 冻结场景输入和行为断言 |

若需要新增跨项目 marker 字段，先记录 `[待决策]`，不得让各平台私自定义不可对照日志。
