# LVGL Runtime 总 Spec：分 Spec 索引

## 目录

- [1. 结论](#1-结论)
- [2. 分 Spec 清单](#2-分-spec-清单)
- [3. 依赖关系](#3-依赖关系)
- [4. 集成顺序](#4-集成顺序)
- [5. 启动门禁](#5-启动门禁)

## 1. 结论

LVGL 按 Host/Backend、Surface/Mount、输入/Measure、平台能力和嵌入式观测拆分；SDL 与设备端复用同一 Platform Adapter。

## 2. 分 Spec 清单

| ID | 分 Spec | 责任 | 主要输出 | 依赖 |
|---|---|---|---|---|
| LV-S01 | Foundation 与 Backend Ports | owner-thread task/time/wakeup、Display/Input Backend interface；不含 SDL/libuv 实现 | Backend Port 合同与 Fake | 公共 Platform Port |
| LV-S02 | Runtime Host 与 Backends | Composition Root、单 JS Engine Provider 选择、TraceSink 选择、`lvgl-simulator-dev`/`lvgl-embedded-min`、Runtime Composition Manifest、Runtime Launch Profile、Core/JS 装配、PackageSource、RuntimeLifecycleControl、SDL/libuv/内建 Backend | LVGL Runtime Host/Backends | LV-S01、公共 Core/JS Port/Composition/Observation Contract |
| LV-S03 | Surface Host | page root、hidden/present/push/close/visibility/destroy | Surface Adapter | LV-S01、LV-S02 |
| LV-S04 | Mount 与 Host Components | View/Text/Button、prop/layout/tree/move/remove/full | Mount Adapter | LV-S03 |
| LV-S05 | Input | LVGL event 到标准 click、NodeId 关联 | Input Adapter | LV-S04 |
| LV-S06 | Font Measure | MeasureRequest、measured/failed Result、font generation | Measure Adapter | LV-S01、LV-S02 |
| LV-S07 | Capability 与 Page Control | prompt/device/title/meta/fallback | Providers | LV-S02、LV-S03 |
| LV-S08 | SDL Full Runtime | 可点击窗口、run target、截图和调试 | Simulator | LV-S01 至 LV-S07 |
| LV-S09 | Embedded Observability | 实现有界 Collector，按 Observation Contract 输出内存、对象、计数器、队列、事务、帧和故障注入；验证双 Profile 链接清单、体积与资源差异 | 嵌入式与可裁剪证据 | LV-S08、公共 Observation/Composition Contract |
| LV-S10 | Case Integration | Case 001/002、`BLOCK-001`、`CAP-DEVICE-001` 与 Android 语义对照 | LVGL 验收证据 | LV-S08、LV-S09 |

## 3. 依赖关系

```text
LV-S01 -> LV-S02 -> LV-S03 -> LV-S04 -> LV-S05
    |         |         |
    +--------> LV-S06   -> LV-S08 -> LV-S09 -> LV-S10
              -> LV-S07 -> LV-S08
```

## 4. 集成顺序

1. Fake Core 驱动 LVGL Surface/Mount/Input。
2. SDL window 跑通静态 full Mount 和 click。
3. 组合共享 Core/JS，跑通 Case 001。
4. 跑通 Case 002、失败恢复和资源基线。
5. 替换 Backend 验证不改变 Runtime/Adapter 语义。

## 5. 启动门禁

总 Spec 通过后才写分 Spec；分 Spec 必须明确 owner thread、内存上限、Backend 边界和销毁顺序，通过后才编码。
