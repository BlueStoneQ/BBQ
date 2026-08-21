# M1-Alpha 任务

## 目录

- [1. 原则](#1-原则)
- [2. 执行顺序](#2-执行顺序)
- [3. 任务清单](#3-任务清单)
- [4. 完成定义](#4-完成定义)

## 1. 原则

任务按首屏依赖执行，不按完整分 Spec 编号执行。任何任务只能实现 Alpha 范围，不得顺手扩张为完整 W3/W4。

## 2. 执行顺序

```text
TK-S05/TK-S06 设计通过
  -> TK-S05/TK-S06 编码并验证
  -> TK-S07 Alpha RPK
  -> JS-S03 -> JS-S04 -> JS-S05 initial binding
  -> CORE-S04 -> CORE-S06 -> CORE-S07 -> CORE-S08
  -> LV-S04 Mount
  -> Examples Alpha runner
  -> Case 001 S1 验收
```

Toolkit S05/S06 可以并行编码；JS、Core 和 LVGL 按各自依赖顺序推进。TK-S07 必须等待 S05/S06 代码验证通过。Core-S03 的 source manifest 修复属于前置收口任务。

## 3. 任务清单

| ID | 责任 | Alpha 交付 |
|---|---|---|
| A-TK | Toolkit | 从唯一 Lowered Model 投影 App/Page Bundle、Page IR，并产出最小 RPK |
| A-JS | JS Runtime | 加载 App/Page Bundle，创建 VM，完成 title/titleBar 的 initial-only binding |
| A-CORE | Runtime Core | 创建 Surface，接收初始 Render，完成最小 Style/Layout，提交 Mount |
| A-LV | LVGL Runtime | 创建 page root，映射 View/Text/Button，执行 owner-thread mount/present |
| A-EX | Examples | 固定 Case 001 S1 输入、运行命令、结果快照和资源归零检查 |
| A-OBS | 共同 | 输出结构化 package/module/lifecycle/render/mount/present 事件 |

## 4. 完成定义

每个任务完成必须有：代码、最小合同测试、运行证据、资源释放证据和项目 Handoff。Alpha 总完成不要求 41 个分 Spec 全部 `VERIFIED`，但不得绕过正式公共合同。
