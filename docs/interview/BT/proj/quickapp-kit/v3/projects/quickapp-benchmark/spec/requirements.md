# Benchmark 总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 项目使命](#2-项目使命)
- [3. 测量对象](#3-测量对象)
- [4. V1 功能需求](#4-v1-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 对比边界](#6-对比边界)

## 1. 结论

V1 Benchmark 的本质是：**记录同一 RPK 在三端的关键边界时间、事务大小和内存，证明主链路可观察。**

没有原始数据、环境和统计方法的单个数字不构成结论。

## 2. 项目使命

```text
Case 001/002 + Runtime build
  -> Scenario Runner
  -> synchronized markers from Toolkit/JS/Core/Platform
  -> platform collectors
  -> normalized samples
  -> report and comparison
```

Benchmark 不修改被测 Runtime，也不把日志埋点旁路成成功条件。

## 3. 测量对象

| 类别 | V1 指标 |
|---|---|
| Build | clean/incremental 构建耗时、Bundle/IR/RPK 大小 |
| Load | open package、verify、load Bundle/IR 耗时 |
| Startup | Host request 到 first presented；分解 JS、Core、Mount、Present |
| Update | input/handler/state 到 Render presented；operations 数量和字节 |
| Event | Platform input 到 JS Handler start/end |
| Navigation | push request 到 target presented |
| Capability | request 到 typed result |
| Layout | Yoga、Measure 调用数、cache hit、Layout 耗时 |
| Memory | 启动峰值、steady-state、页面增量、销毁回落、重复导航趋势 |
| Reliability | Mount/Measure/Provider 失败恢复耗时和结果 |

## 4. V1 功能需求

| ID | 需求 |
|---|---|
| BM-R01 | 定义 Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 场景步骤、预热、迭代次数和成功断言。 |
| BM-R02 | 验证公共 Observation Contract 的 marker、时间边界、观测级别、关联字段和结构化计数覆盖 Toolkit、JS、Core、Platform；缺口只通过 Handoff 提议。 |
| BM-R03 | 每次运行记录代码版本、Artifact 哈希、构建模式、设备、OS、Runtime 版本、viewport 和配置。 |
| BM-R04 | 支持 Android、LVGL/SDL 和 iOS Target Adapter；Target 只负责启动、输入、采集和停止。 |
| BM-R05 | 区分 cold/warm、first run/steady-state 和 debug/release，不混合统计。 |
| BM-R06 | 输出机器可读原始样本、失败样本和基础摘要；复杂统计不阻塞 V1。 |
| BM-R08 | 事务指标包含 operation count、logicalPayloadBytes、可用时的 actualTransportBytes、Revision 和 recovery；禁止用日志文本长度代替 transport bytes。 |
| BM-R09 | 内存测量包含基线、峰值、页面销毁后回落和多轮导航趋势。 |
| BM-R11 | 先建立 LVGL/SDL 阶段基线，再加入 Android 复用基线；iOS 在实现闭环后进入同一 V1 报告模型。 |
| BM-R13 | 内存指标统一使用 bytes 并记录 collector/kind/sampling phase；Host/LVGL object 使用 count，不能与 heap/RSS 混算。 |
| BM-R14 | 每次运行必须记录 `profileId`、JS Engine identity、Runtime Composition Manifest 哈希、实际链接模块和 binary bytes；至少对比 `lvgl-simulator-dev` 与 `lvgl-embedded-min` 的基线/峰值/销毁回落内存，禁止跨 Profile 或 Engine 混合统计。 |
| BM-R15 | 验证 Noop/Recording Sink 行为等价、整数纳秒单调性、热路径开销，以及 Bridge/OOM/队列溢出/full rebuild Marker；Benchmark 不实现或替换 Runtime 状态机。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 可重复 | 固定 Artifact、场景、环境和迭代规则，可由命令重新生成。 |
| 可解释 | 总耗时可分解到边界 marker，不使用无法归因的单一黑盒数字。 |
| 公平 | 同设备、同构建模式、同视觉/交互语义、同启动定义才做横向排名。 |
| 完整 | 失败样本不删除；报告失败率和排除理由。 |
| 非侵入 | 只读取公开 Trace/观测接口；Collector 丢样、关闭或失败不得修改 Runtime 状态机。 |
| 可审计 | 原始数据、聚合配置和报告生成版本一起保存。 |

## 6. 对比边界

V1 首先证明 QuickApp Kit 自身跨平台闭环和性能基线。LVGL、Android、iOS 运行在不同硬件时只做结构和趋势对照，不直接排名。

完整统计、观测开销评估和外部框架对比属于第二期。外部对比必须满足：

- 等价 UI 和交互。
- 等价 release 构建与冷启动定义。
- 相同设备与系统状态。
- 公开场景源码、版本和采样方法。
- 明确哪些指标无法等价采集。
