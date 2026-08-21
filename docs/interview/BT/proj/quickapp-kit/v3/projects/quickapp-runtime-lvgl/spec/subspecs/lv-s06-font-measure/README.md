# LV-S06 Font Measure

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 核心边界](#3-核心边界)
- [4. 依赖与交付](#4-依赖与交付)
- [5. 状态](#5-状态)

## 1. 结论

LV-S06 只做一件事：**在 Core Runtime Thread 上，用当前 generation 的不可变字体快照同步计算文本固有尺寸。**

Platform 选择字体并返回 metrics；Core 继续拥有 Measure cache、Yoga 约束求解、Button padding/min-size 和最终 Layout Rect。

## 2. 范围

包含：

- 公共 `MeasureRequest -> MeasureResult(measured|failed)` 同步 Port。
- `text/buttonLabel` 的 UTF-8 字体度量、换行与 constraint 归一化。
- exact font family/weight selection、fontSize 设计单位缩放、immutable metrics snapshot、严格递增 font generation。
- generation 变更的一代一通知、cache invalidation signal 和 teardown。
- simulator/embedded 共用字体资产、算法、定点精度与 golden fixtures。

不包含：Yoga、Core Measure cache、最终 Rect、Host Tree、LVGL object、Button padding、字体下载、复杂 shaping、输入法或 LV-S07 Input/Event。

## 3. 核心边界

```text
LVGL owner thread
  -> prepare/publish immutable FontMetricsSnapshot(generation)
  -> post PlatformFontGenerationChanged

Core Runtime Thread
  -> PlatformMeasurePort.measure(request)
  -> read immutable snapshot only
  -> measured(width,height) | failed(MEASURE_FAILED)
```

`measure()` 不投递 UI task、不等待 LVGL owner、不读 page root，也不调用 `lv_*`。

## 4. 依赖与交付

依赖：

- [LV-S01 Backend Ports](../lv-s01-backend-ports/README.md)
- [LV-S02 Runtime Host 与 Backends](../lv-s02-runtime-host-backends/README.md)
- [Measure Adapter Contract](../../../../../spec/contracts/measure-adapter-contract.md)
- [Lifecycle And Threading Contract](../../../../../spec/contracts/lifecycle-and-threading.md)
- [Runtime Error Contract](../../../../../spec/contracts/error-contract.md)
- [LVGL Runtime 总体架构](../../architecture.md)

交付：[需求](./requirements.md)、[设计](./design.md)、[任务](./tasks.md)、[验收](./acceptance.md)。

## 5. 状态

`VERIFIED`：LV-S06 实现、测试、证据和总架构验收已完成；LV-S07 仍等待后续统一设计安排。
