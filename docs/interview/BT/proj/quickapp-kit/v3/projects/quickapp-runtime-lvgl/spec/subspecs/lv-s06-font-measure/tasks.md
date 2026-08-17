# LV-S06 任务

## 目录

- [1. 结论](#1-结论)
- [2. 编码前门禁](#2-编码前门禁)
- [3. 实现任务](#3-实现任务)
- [4. 验证任务](#4-验证任务)
- [5. 完成条件](#5-完成条件)

## 1. 结论

LV-S06 的后续实现顺序固定为：**先冻结字体事实，再实现纯同步算法，最后接 generation 发布与失效通知。** 当前文件不授权编码。

## 2. 编码前门禁

- 本分 Spec 经总架构校审 `PASS`，工作看板明确 `CODE_ALLOWED`。
- LV-S01/LV-S02 保持 `VERIFIED`。
- 对齐 CORE-S01 `PlatformMeasurePort/CoreIngressPort` 的真实 C++ 名称，只允许机械适配。
- mandatory font asset、license、digest 与两 Profile 的实际链接方式必须在编码前确认；若公共合同不足，写 Handoff `[待决策]`。
- 不等待 LV-S07，也不创建 Host Tree、Yoga 或 Core cache substitute。

## 3. 实现任务

| ID | 任务 | 依赖 | 完成定义 |
|---|---|---|---|
| LV-S06-T01 | 建立 Font Measure target、Build Profile limits 和 immutable catalog descriptor | S01/S02 | 双 Profile mandatory face digest/identity 一致；未选 face 不链接。 |
| LV-S06-T02 | 实现 Q26.6 font metrics representation、design-unit scaling 与 Fake/bundled font loader | T01 | family/glyph/kerning/lineHeight 全部 immutable、checked、固定容量。 |
| LV-S06-T03 | 实现双槽 SnapshotPublisher 与 read guard | T02 | generation=1、owner publish、reader-safe retire、两槽 busy 延后、无动态扩容。 |
| LV-S06-T04 | 实现严格 MeasureRequest validation、exact family lookup 与 fontSize scaling | T02-T03 | 关联字段/单位/数值/generation/profile limits 全覆盖；无 fallback。 |
| LV-S06-T05 | 实现流式 UTF-8/glyph/kerning/line-break 算法 | T04 | hard/soft break、CJK、token fallback、empty/trailing newline、上限与溢出确定。 |
| LV-S06-T06 | 实现双轴 constraint 与 MeasureResult | T05 | measured 精确回显且满足约束；所有失败固定 MEASURE_FAILED。 |
| LV-S06-T07 | 实现 owner-thread generation change 与 single-pending notifier | T03、T06 | publish 后才通知；前一通知 accepted 前不发布下一代；Core queue full 有界重试；无 measure 重入。 |
| LV-S06-T08 | 实现显式 close、Trace 和 counters | T03-T07 | 新 admission 停止、reader 归零、snapshot 释放；Trace 行为无影响。 |

## 4. 验证任务

| ID | 任务 | 必须输出 |
|---|---|---|
| LV-S06-V01 | 公共 Schema/typed Port 合同测试 | measured/failed/generation changed 正反例，字段逐项回显。 |
| LV-S06-V02 | font selection/scaling 与 golden metrics | mandatory family、多字号、unsupported token/weight/out-of-range size/glyph；两 Profile bit-identical。 |
| LV-S06-V03 | UTF-8/wrap/constraint 测试 | ASCII/CJK/CRLF/tab/empty/trailing newline/long token/zero/exactly/atMost。 |
| LV-S06-V04 | generation concurrency 测试 | old reader + new publish、mismatch retry、双槽 busy、严格递增、overflow。 |
| LV-S06-V05 | 通知背压与 teardown | Core queue full single pending、下一代延后、每 turn 一次 retry、close/late notification。 |
| LV-S06-V06 | 边界与失败注入 | invalid UTF-8/NaN/Inf/overflow/bytes/codepoints/lines/snapshot unavailable。 |
| LV-S06-V07 | 线程与依赖扫描 | measure 只在 Core thread；无 `lv_*`/Host Tree/Yoga/SDL/libuv/UI wait。 |
| LV-S06-V08 | 压力、sanitizer 与资源证据 | 100,000 次 measure、10,000 次 generation publish；Debug/Release、ASan/UBSan/TSan；计数归零。 |
| LV-S06-V09 | 生成 S06 verification evidence | Case 到测试/扫描逐项映射、font digest、源码摘要与可复现命令。 |

## 5. 完成条件

1. T01-T08 与 V01-V09 全部完成。
2. [验收](./acceptance.md) 全部通过。
3. 没有 Yoga、Core cache、Host Tree、LVGL object、Button padding 或 LV-S07 代码。
4. 没有修改公共 Measure 合同；公共缺口已标记 `[待决策]`。
5. Handoff 标记实现 `READY_FOR_REVIEW`；不得自行启动 LV-S07。
