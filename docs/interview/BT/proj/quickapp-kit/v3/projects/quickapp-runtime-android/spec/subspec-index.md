# Android Runtime 总 Spec：分 Spec 索引

## 目录

- [1. 结论](#1-结论)
- [2. 分 Spec 清单](#2-分-spec-清单)
- [3. 依赖关系](#3-依赖关系)
- [4. 集成顺序](#4-集成顺序)
- [5. 启动门禁](#5-启动门禁)

## 1. 结论

Android 按 Host、JNI、Surface/Mount、平台服务和集成验收拆分；所有分 Spec 都只实现公共 Port，不拥有共享 Runtime 逻辑。

## 2. 分 Spec 清单

| ID | 分 Spec | 责任 | 主要输出 | 依赖 |
|---|---|---|---|---|
| AND-S01 | Runtime Host 与 PackageSource | Composition Root、单 JS Engine Provider 选择、Runtime Composition Manifest、TraceSink 选择、Runtime Launch Profile、AppRuntime 装配、Root 启动、包读取、RuntimeLifecycleControl | Android Host | 公共 Host/Core Port/Composition/Observation Contract |
| AND-S02 | JNI Gateway | typed message、线程投递、结果关联、资源引用 | JNI Adapter | AND-S01、Core/JS ABI |
| AND-S03 | Surface Host | create/present/visibility/close/destroy 与容器状态 | Surface Adapter | AND-S02 |
| AND-S04 | Mount 与 Host Components | View/Text/Button、prop/layout/child/move/remove/full rebuild | Mount Adapter | AND-S02、AND-S03 |
| AND-S05 | Input | click Listener、NodeId 映射和 PlatformInputMessage | Input Adapter | AND-S04 |
| AND-S06 | Font Measure | MeasureRequest、measured/failed Result、字体 generation | Measure Adapter | AND-S01 |
| AND-S07 | Capability 与 Page Control | prompt/device/title/meta | Platform Providers | AND-S02、AND-S03 |
| AND-S08 | Android Runtime Integration | 共享 Core/JS 组合、lifecycle、错误和资源回收 | 可运行 Runtime | AND-S01 至 AND-S07 |
| AND-S09 | Case 与观测 | Android Collector、Case 001/002、`BLOCK-001`、`CAP-DEVICE-001`、链接清单、故障注入、Observation Contract hooks | Android 验收证据 | AND-S08、公共 Observation/Composition Contract |

## 3. 依赖关系

```text
AND-S01 -> AND-S02 -> AND-S03 -> AND-S04 -> AND-S05
    |          |          |
    -> AND-S06 |          -> AND-S08 -> AND-S09
               -> AND-S07 -> AND-S08
```

## 4. 集成顺序

1. 先用 Fake Core 校验 Surface/Mount/Input Adapter。
2. 再链接共享 Core/JS，跑通 Case 001 Root 首屏。
3. 接通事件、导航、Capability 和销毁。
4. 最后跑 Case 002 与失败恢复。

## 5. 启动门禁

总 Spec 通过后才写分 Spec；分 Spec 必须明确 Android 主线程、JNI ownership、错误转换和资源销毁，通过后才允许编码。
