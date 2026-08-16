# Benchmark 总 Spec：分 Spec 索引

## 目录

- [1. 结论](#1-结论)
- [2. 分 Spec 清单](#2-分-spec-清单)
- [3. 依赖关系](#3-依赖关系)
- [4. 实施顺序](#4-实施顺序)
- [5. 启动门禁](#5-启动门禁)

## 1. 结论

V1 只拆分场景、观测合同、三端采集和基础报告；完整统计与外部对比进入第二期。

## 2. 分 Spec 清单

| ID | 分 Spec | 责任 | 主要输出 | 依赖 |
|---|---|---|---|---|
| BM-S01 | Scenario Model | Case 步骤、断言、预热、采样规则 | Scenario Catalog | Examples |
| BM-S02 | Marker 与 Trace | 验证公共 marker taxonomy、Noop/Recording 等价、单调整数纳秒、观测级别、结构化计数、payload bytes、内存单位和开销；定义 Collector 消费合同与变更提议 | Observation Contract 验证报告/Collector Contract | 公共 Observation Contract/Schema |
| BM-S03 | Evidence Collector | run lifecycle、Runtime Composition Manifest identity、基础迭代、失败保留、原始 JSON 与摘要 | Benchmark Runner | BM-S01、BM-S02 |
| BM-S04 | Android Target | build/install/start/input/platform metrics | Android Adapter | BM-S03 |
| BM-S05 | LVGL/SDL Target | 双 Profile build/start/input/screenshot/memory/object/binary metrics | LVGL Adapter | BM-S03 |
| BM-S06 | iOS Target | build/install/start/input/platform metrics | iOS Adapter | BM-S03 |
| BM-S07 | V1 Basic Report | LVGL 双 Profile 可裁剪证据、LVGL/Android 基础表格、原始数据链接；iOS 完成后追加同格式结果 | V1 Report | BM-S05、BM-S04；iOS 追加依赖 BM-S06 |
| BM-S08 | Statistics And Raw Store（第二期） | sample schema、完整 validation、percentile 和统计模型 | Dataset/Aggregator | V1 完成后 |
| BM-S09 | External Framework Profiles（第二期） | 等价场景与 RN/Lynx/Flutter/原生 Target | Comparison Profiles | BM-S08 与公平性校审 |

## 3. 依赖关系

```text
BM-S01 + BM-S02 -> BM-S03
BM-S03 -> BM-S04 + BM-S05 + BM-S06
BM-S04 + BM-S05 -> BM-S07
BM-S06 -> BM-S07(iOS append)
V1 baseline -> BM-S08(second phase)
BM-S08 + fairness review -> BM-S09(second phase)
```

## 4. 实施顺序

1. 先冻结场景；并行验证公共 marker 合同，不等待全部 Runtime 完成。
2. LVGL/SDL Target 随首个可运行闭环接入；Android Target 随第二个平台复用闭环接入。
3. LVGL/Android 先形成基础报告，iOS 完成后追加同格式结果。
4. 完整统计和外部框架对比进入第二期，必须单独通过公平性校审。

## 5. 启动门禁

总 Spec 通过后才写分 Spec；任何对比 Profile 在场景等价性和测量方法通过独立校审前，不得发布排名结论。
