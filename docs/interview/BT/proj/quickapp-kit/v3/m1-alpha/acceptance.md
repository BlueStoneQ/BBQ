# M1-Alpha 验收

## 目录

- [1. 结论](#1-结论)
- [2. 输入](#2-输入)
- [3. S1 验收](#3-s1-验收)
- [4. 禁止通过方式](#4-禁止通过方式)
- [5. 退出条件](#5-退出条件)

## 1. 结论

Alpha 通过的唯一标准是：**真实 Case 001 Source 经 Toolkit 生成 RPK，由共享 JS/Core 驱动 LVGL/SDL，根页面完成 Present。**

## 2. 输入

- Case ID：`CASE-001@1`
- Route：`/pages/Demo`
- Source：Case 001 frozen Source snapshot
- 必须来自 Toolkit 输出：Bundle、Page IR、Manifest、Runtime Metadata、RPK

## 3. S1 验收

| 阶段 | 必须成立 |
|---|---|
| Package | RPK 打开、完整性验证、Manifest/Page IR 校验通过 |
| Module | App/Page Module 通过 JS-S03 加载，Definition shape 合法 |
| Lifecycle | `app.onCreate -> Demo.onInit -> Demo.initialEvaluation -> Demo.onReady` 顺序成立 |
| Render | 初始 Render transaction 使用 Template/Binding ID，不传完整 VNode Tree |
| Layout | 最小 Style/Layout 输出稳定 Rect，失败不提交部分结果 |
| Mount | LVGL owner thread 创建并挂载 View/Text/Button |
| Present | Root Surface 状态进入可呈现状态，输出 `surface.create.presented` |
| Visible | 可观察到 `欢迎体验快应用开发` 与 `跳转到详情页` |
| Resource | Alpha runner 销毁后 Node、Surface、Handler、Module、Engine 资源回到基线 |
| Observation | package、module、lifecycle、render、mount、present 事件带结构化关联 ID |

## 4. 禁止通过方式

- 手写或预置 Page IR、RenderTransaction、MountTransaction 或 RPK。
- 直接读取联盟源码运行，绕过 Toolkit。
- 使用 Fake Host 代替 LVGL/SDL 的真实 Mount 验收。
- 在 Core 中引入第二棵权威 Runtime Tree。
- 用截图文字替代 Runtime 状态、Transaction 和资源证据。

## 5. 退出条件

Alpha 通过后：

1. 固化 S1 运行快照和最小观测证据。
2. 继续在同一代码上补 S2-S5。
3. 完整 M1 分 Spec 继续作为长期能力地图，不因 Alpha 通过而删除或标记全部完成。
