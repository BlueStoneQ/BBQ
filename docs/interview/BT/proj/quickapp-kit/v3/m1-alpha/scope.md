# M1-Alpha 范围

## 目录

- [1. 范围结论](#1-范围结论)
- [2. 必须实现](#2-必须实现)
- [3. 明确排除](#3-明确排除)
- [4. 代码归属](#4-代码归属)

## 1. 范围结论

Alpha 的边界是“真实 RPK 到 LVGL 根页面可见”，不是 Mock 演示，也不是完整 M1。

## 2. 必须实现

| 层 | Alpha 最小能力 |
|---|---|
| Toolkit | TK-S05 Bundle 投影、TK-S06 Page IR 投影、TK-S07 最小 Runtime RPK |
| JS | JS-S03 Module Loader、JS-S04 App/Page VM、JS-S05 initial-only Binding |
| Core | CORE-S04 Surface/Revision、CORE-S06 Render staging、CORE-S07 最小 Style/Layout、CORE-S08 Mount commit |
| LVGL | LV-S04 View/Text/Button Host Mount |
| Examples | Case 001 Source snapshot、Alpha runner 和运行证据 |
| Observation | package、module、lifecycle、render、mount、surface presented 关键事件 |

## 3. 明确排除

- S2 Navigation 和完整 Surface 栈行为。
- S3 Capability、Toast 和 PlatformProvider。
- 完整 Reactive state、Block、Handler Event 和增量更新。
- 完整 `inspect/run`、签名、Benchmark 分析和 Android/iOS Host。
- LV-S05/LV-S07 及 Core-S09/Core-S10。

## 4. 代码归属

Alpha 不创建新的 Runtime 工程：

| 代码 | 归属 |
|---|---|
| Bundle、Page IR、RPK | `quickapp-toolkit` |
| Module、VM、initial Binding | `quickapp-runtime-js` |
| Surface、Render、Layout、Mount commit | `quickapp-runtime-core` |
| LVGL Host object | `quickapp-runtime-lvgl` |
| Fixture、runner、结果快照 | `quickapp-examples` |
