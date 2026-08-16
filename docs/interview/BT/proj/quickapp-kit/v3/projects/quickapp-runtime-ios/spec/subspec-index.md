# iOS Runtime 总 Spec：分 Spec 索引

## 目录

- [1. 结论](#1-结论)
- [2. 分 Spec 清单](#2-分-spec-清单)
- [3. 依赖关系](#3-依赖关系)
- [4. 集成顺序](#4-集成顺序)
- [5. 启动门禁](#5-启动门禁)

## 1. 结论

iOS 按 Runtime Host、跨语言 Gateway、Surface/Mount、平台服务和集成验收拆分；平台代码只实现公共 Port。

## 2. 分 Spec 清单

| ID | 分 Spec | 责任 | 主要输出 | 依赖 |
|---|---|---|---|---|
| IOS-S01 | Runtime Host 与 PackageSource | Composition Root、单 JS Engine Provider 选择、Runtime Composition Manifest、TraceSink 选择、Runtime Launch Profile、AppRuntime 装配、RuntimeLifecycleControl、包读取 | iOS Host | 公共 Core/JS Port/Composition/Observation Contract |
| IOS-S02 | Platform Gateway | typed conversion、主线程投递、结果关联、引用管理 | Objective-C++ Gateway | IOS-S01 |
| IOS-S03 | Surface Host | hidden/present/visibility/close/destroy 与容器 | Surface Adapter | IOS-S02 |
| IOS-S04 | Mount 与 Host Components | UIView/UILabel/UIButton、prop/layout/tree/move/remove/full | Mount Adapter | IOS-S03 |
| IOS-S05 | Input | target/action 到 click message | Input Adapter | IOS-S04 |
| IOS-S06 | Font Measure | MeasureRequest、measured/failed Result、font generation | Measure Adapter | IOS-S01 |
| IOS-S07 | Capability 与 Page Control | prompt/device/title/meta | Providers | IOS-S02、IOS-S03 |
| IOS-S08 | iOS Runtime Integration | 共享 Core/JS、lifecycle、错误和销毁 | 可运行 Runtime | IOS-S01 至 IOS-S07 |
| IOS-S09 | Case 与观测 | iOS Collector、Case 001/002、`BLOCK-001`、`CAP-DEVICE-001`、链接清单、故障注入、Observation Contract hooks | iOS 验收证据 | IOS-S08、公共 Observation/Composition Contract |

## 3. 依赖关系

```text
IOS-S01 -> IOS-S02 -> IOS-S03 -> IOS-S04 -> IOS-S05
    |          |          |
    -> IOS-S06 |          -> IOS-S08 -> IOS-S09
               -> IOS-S07 -> IOS-S08
```

## 4. 集成顺序

1. 用 Fake Core 校验 Gateway、Surface、Mount 和 Input。
2. 在 Android/LVGL 公共合同稳定后组合共享 Core/JS。
3. 跑 Case 001，再补 Case 002 和失败恢复。
4. 接入统一 Benchmark 并做跨平台差异记录。

## 5. 启动门禁

总 Spec 通过后才写分 Spec；分 Spec 必须明确主线程、跨语言 ownership、销毁和 late callback 规则，通过后才编码。
