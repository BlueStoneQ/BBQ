# Benchmark 总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 通过条件](#2-总-spec-通过条件)
- [3. Harness 验收](#3-harness-验收)
- [4. V1 报告验收](#4-v1-报告验收)
- [5. 公平性验收](#5-公平性验收)
- [6. 证据](#6-证据)

## 1. 结论

V1 Benchmark 只需证明：**同一 Case 在三端产生可关联的关键 Trace、事务大小和基础内存结果。**

## 2. 总 Spec 通过条件

- 每个指标有唯一开始、结束和单位定义。
- startup 结束于 Core 已提交的上层 presented result；input/state/flush 三种 update 起点分别报告。
- Runtime marker 与平台采集职责分离。
- 失败样本和时钟限制有明确处理。
- LVGL/Android/iOS Target 使用同一场景模型和报告模型。
- 外部框架比较受单独公平性门禁约束。
- 每个样本绑定 `profileId`、JS Engine identity、Composition Manifest hash 和 linked module inventory；不同 Profile 或 Engine 不混合统计。
- BM-S02 证明 Noop/Recording Sink 不改变 Runtime 行为，时间为单调整数纳秒，热路径无文本格式化、文件 I/O 或 Collector 等待。
- Bridge、OOM、队列溢出、full rebuild 和 Node/Handler/Surface/Queue 计数具有可校验的结构化样本。

## 3. Harness 验收

- 同一配置重复执行能生成结构一致的 raw dataset。
- 任一步断言失败被保存并计入失败率。
- 缺失 marker、时钟逆序、环境变化和 Artifact 哈希变化会使样本无效。
- Trace 丢样或 Collector 失败只使样本无效，不改变被测 Runtime 的成功、失败或降级结果。
- 基础摘要能回链到原始样本。

## 4. V1 报告验收

Case 001 必须报告：

- Build、Package load、App/Page Hook、first presented。
- Event、Navigation、Capability、Destroy。
- 峰值/steady/destroyed memory。

Case 002 必须报告：

- Dirty flush、Render/Mount operation 数量和大小。
- update 与 keyed move 延迟。
- Measure count/cache hit。
- 重复更新与导航的资源趋势。

`BLOCK-001` 必须单独报告 keyed add/remove 的 Render/Mount operation、Handler/Node/Host object 释放计数和已有 key 身份保持；不得合并进 Case 002 名称。

`CAP-DEVICE-001` 必须单独报告：

- 三个平台使用相同 scenario ID 和 fixture identity。
- `capability.requested/completed/failed` marker 与 requestId 可关联。
- typed Result 的 required fields、物理像素/density 和禁止设备唯一标识断言。
- unsupported/failed 与销毁取消样本必须保留，不得并入 Case 001 的泛化 Capability 数据。

LVGL/SDL 先形成首闭环报告，Android 随复用闭环加入；V1 最终交付在 iOS 闭环后追加同格式结果。

`lvgl-simulator-dev` 与 `lvgl-embedded-min` 必须单独报告 binary bytes、基线/峰值/销毁回落内存和对象数量，并回链各自 Runtime Composition Manifest。

## 5. 第二期公平性验收

本节不参与 V1 门禁。任何 RN/Lynx/Flutter/原生对比发布前必须附带：

- 框架与工具版本。
- 完整等价场景源码。
- 同设备、同模式、同采样规则证明。
- 无法等价的指标和限制。
- 原始数据与统计脚本版本。

不满足时只能标为探索性数据，不得形成性能优劣结论。

## 6. 证据

- 可执行 Benchmark 命令和固定配置。
- raw dataset、环境清单和 Artifact 哈希。
- LVGL/Android 基础报告与原始数据回链，iOS 完成后追加。
- 双 LVGL Profile 的 Composition Manifest、link map、binary bytes 和内存原始样本。
