# LV-S06 验收

## 目录

- [1. 结论](#1-结论)
- [2. 测量合同](#2-测量合同)
- [3. 字体与 generation](#3-字体与-generation)
- [4. 失败与资源边界](#4-失败与资源边界)
- [5. 线程、一致性与边界](#5-线程一致性与边界)
- [6. 需求追踪](#6-需求追踪)
- [7. 通过条件](#7-通过条件)

## 1. 结论

LV-S06 的通过标准是：**Core 线程对不可变字体快照做同步查询，所有可信输入得到确定 metrics，所有不可信输入明确失败，generation 能安全使 Core cache 失效。**

## 2. 测量合同

| Case | 输入 | 必须结果 |
|---|---|---|
| S06-A01 plain text | generation=1、mandatory face、unconstrained ASCII | measured；全部关联字段回显；golden width/height 精确。 |
| S06-A02 button label | 与 A01 相同 text、role=buttonLabel | label metrics 与 Text 相同；不包含 padding/min-size。 |
| S06-A03 empty | empty + unconstrained | measured `0x0`。 |
| S06-A04 hard breaks | LF、CRLF、trailing newline | CRLF 单 break、line count/height 与 golden 一致。 |
| S06-A05 wrap | spaces、CJK、超长 token + atMost width | 按固定 opportunity/code-point fallback 换行，width 不超 constraint。 |
| S06-A06 exactly | 双轴 exactly | Result width/height 精确等于输入值。 |
| S06-A07 atMost | intrinsic 超过双轴限制 | Result 两轴均不超过上限；wrap 先于 height 归一。 |
| S06-A08 unconstrained | 无 soft wrap 的多 token text | width 为最大 hard line intrinsic，height 为自然行数乘 lineHeight。 |

## 3. 字体与 generation

| Case | 输入 | 必须结果 |
|---|---|---|
| S06-F01 family/size | `system-default/400`，16/30/40 logical-px | 两 Profile 命中相同 asset digest，按 design units 得到一致 metrics。 |
| S06-F02 unsupported family | token/weight 未注册或 size 超出 `(0,256]` | failed `MEASURE_FAILED`；无 fallback。 |
| S06-F03 initial generation | Runtime open | current=1，measure 可立即读取完整 snapshot。 |
| S06-F04 publish | owner 准备有效 snapshot 2 | 完整发布后通知 generation=2；旧 reader 继续安全读 generation 1。 |
| S06-F05 mismatch | Request=1、current=2 | failed retryable `MEASURE_FAILED`，不读取错误 face。 |
| S06-F06 notify full | generation N 通知 pending，平台事实再次变化 | 保留 N 并每 owner turn最多一次 retry；N accepted 后才按最新事实发布并通知 N+1。 |
| S06-F07 double slot busy | 新旧 slots 均有 reader/published owner | 延后下一次 publish，不覆盖、不等待、不增加第三槽。 |

## 4. 失败与资源边界

| Case | 注入 | 必须结果 |
|---|---|---|
| S06-N01 invalid text | malformed/truncated/overlong UTF-8 | failed `MEASURE_FAILED`，无部分 metrics。 |
| S06-N02 invalid number | NaN/Inf/negative constraint/非法 unit | failed `MEASURE_FAILED`。 |
| S06-N03 missing glyph | catalog 无对应 code point | failed `MEASURE_FAILED`，不使用 replacement fallback。 |
| S06-N04 arithmetic overflow | 极端 advance/line/constraint | checked failure，无 wraparound。 |
| S06-N05 bytes limit | simulator 65,537 / embedded 4,097 bytes | failed；边界值可测量。 |
| S06-N06 codepoint/line limit | 超过 32,768/2,048 code points 或 4,096/256 lines | failed；不扩容。 |
| S06-N07 snapshot unavailable | init/publish failure 或 stopping | failed retryable `MEASURE_FAILED`。 |
| S06-N08 close race | active synchronous reader + explicit close | `tryFinalizeClose` 返回 busy，不阻塞；reader 正常返回后后续 turn 释放 snapshot；新调用失败。 |

## 5. 线程、一致性与边界

必须证明：

1. `measure()` 在 Core Runtime Thread 同步执行，不 post/wait owner、不调用 `lv_*`、不访问 Host Tree/NativeHandle。
2. snapshot prepare/publish 与 generation source 只在 LVGL owner；通知不在 measure 栈重入 Core。
3. simulator/embedded mandatory font asset digest、algorithm version 和所有 golden result 逐值一致。
4. snapshot slots/families/workspace/notification 符合 2、16/4、固定流式 workspace、1 pending 上限。
5. 100,000 次多样 measure 与 10,000 次 generation 变更无数据竞争、死锁、spin、资源增长或非确定输出。
6. Debug、Release、ASan/UBSan、TSan 全部通过；close 后 reader/snapshot/pending notification 计数归零。
7. TraceSink off/drop 与 on 的 MeasureResult bits 和 generation 顺序一致。
8. 源码/依赖扫描无 Yoga、Core cache、Layout Rect、Button chrome、Host Tree、LVGL object、SDL/libuv 或 LV-S07 Input/Event。

## 6. 需求追踪

| 需求 | 任务 | 验收 |
|---|---|---|
| R01-R03 | T04-T06 | A01-A03、资源 1/8 |
| R04-R05 | T01-T04 | F01-F03、F05、N03、资源 1/3 |
| R06-R08 | T05-T06 | A03-A08、N01/N05/N06 |
| R09 | T04-T06 | F02/F05、N01-N07 |
| R10-R13 | T03、T07 | F03-F07、N07-N08、资源 2/4-6 |
| R14-R16 | T01-T06 | A01-A08、F01、资源 3/8 |
| R17-R18 | T03-T08 | F06-F07、N05-N08、资源 4-6 |
| R19-R20 | T01、T08 | F01-F02、资源 7-8 |

## 7. 通过条件

- 全部 Case、golden、压力、sanitizer、资源和边界扫描通过。
- 公共 Measure request/result/generation 语义与 Schema 未被重定义。
- Platform 只提供字体 facts，不包含 Core Layout 或 cache 语义。
- 独立校审 `PASS + CODE_ALLOWED` 后才可编码；编码完成后仍不得自行启动 LV-S07。
