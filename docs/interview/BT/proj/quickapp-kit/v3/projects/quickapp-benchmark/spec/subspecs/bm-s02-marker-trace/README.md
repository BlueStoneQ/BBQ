# BM-S02 Marker 与 Trace

## 目录

- [1. 结论](#1-结论)
- [2. 目标](#2-目标)
- [3. 边界](#3-边界)
- [4. 输入与输出](#4-输入与输出)
- [5. 依赖](#5-依赖)
- [6. 状态与阅读顺序](#6-状态与阅读顺序)

## 1. 结论

BM-S02 的本质是：**证明公共 Observation Contract 产生的 Trace 可信、可消费且不改变 Runtime 行为。**

本分 Spec 不定义第二套 marker，也不建设完整 Benchmark 系统；它只交付公共合同验证器、Collector 消费边界、Noop/Recording 等价验证和热路径开销验证的可编码设计。

## 2. 目标

BM-S02 必须回答四个问题：

1. 公共 marker 是否覆盖 V1 主链路、错误、降级与资源事实。
2. 一组 marker 是否满足 Schema、关联、顺序、run-relative 时钟和成对边界语义，因而可以成为有效样本。
3. `NoopTraceSink` 与 `RecordingTraceSink` 是否只改变观测证据，不改变 Runtime 结果。
4. Trace 生产路径是否保持有界、非阻塞、无文本格式化和无文件 I/O，并输出可复测的开销证据。

## 3. 边界

### 3.1 本分 Spec 负责

- 读取公共 Observation Contract、Schema 和 Runtime Composition Manifest。
- 定义 marker 覆盖矩阵及语义验证规则。
- 定义 Collector 接收、复制、缓冲、丢样、封口和交付边界。
- 定义 Noop/Recording 行为等价测试。
- 验证 JSON wire 整数边界、run-relative 整数纳秒、共享时钟原点、单调性、sequence 和关联 ID。
- 定义 Bridge、OOM、队列溢出、full rebuild 与结构化计数器验证。
- 定义热路径结构约束和定量开销实验。

### 3.2 本分 Spec 不负责

- 修改公共 Observation Contract、Schema、marker 名称或公共 ID 语义。
- 实现 Runtime 的 `TraceSink`、`MonotonicClock` 或 `RuntimeCounters`。
- 实现 Runtime 的 `runOriginNs` 管理、内部 `uint64 ns` 时钟或溢出前 run 轮换。
- 实现 Android、LVGL、iOS 平台指标采集器。
- 实现场景编排、完整 Raw Store、percentile、报告、可视化或外部框架对比。
- 将 Trace 成功作为 Runtime 成功条件。

## 4. 输入与输出

```text
输入
  = Observation Contract/Schema
  + Runtime Composition Manifest
  + Runtime 产生的 TraceEvent 流
  + 被测运行的业务结果与状态快照

BM-S02
  -> 合同形状校验
  -> Trace 语义校验
  -> 覆盖校验
  -> 非侵入等价校验
  -> 热路径开销校验

输出
  = ValidationResult
  + SealedTraceBatch
  + CoverageResult
  + EquivalenceResult
  + OverheadEvidence
```

这些输出是 Benchmark 项目内部验证结果，不是 Runtime 公共消息。

## 5. 依赖

- [平台总 Spec](../../../../../spec/README.md)
- [Observation Contract](../../../../../spec/contracts/observation-contract.md)
- [Runtime Composition Contract](../../../../../spec/contracts/runtime-composition-contract.md)
- [Observation Schema](../../../../../spec/contracts/schemas/observation.schema.json)
- [Runtime Composition Schema](../../../../../spec/contracts/schemas/runtime-composition.schema.json)
- [Benchmark 总体架构](../../architecture.md)
- [Benchmark 分 Spec 索引](../../subspec-index.md)

BM-S02 无项目内前置分 Spec；其结果是 BM-S03 Evidence Collector 的直接输入。

## 6. 状态与阅读顺序

- 当前状态：`READY_FOR_REVIEW`
- 编码状态：`CORRECTION_ALLOWED_ONLY`；P0-OBS-002 定向返修完成，BM-S03 保持阻塞

阅读顺序：

1. [需求](./requirements.md)
2. [设计](./design.md)
3. [任务](./tasks.md)
4. [验收](./acceptance.md)
