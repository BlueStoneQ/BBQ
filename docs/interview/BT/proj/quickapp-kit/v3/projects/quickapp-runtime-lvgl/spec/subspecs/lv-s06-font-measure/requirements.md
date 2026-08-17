# LV-S06 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 固定资源上限](#4-固定资源上限)
- [5. 质量需求](#5-质量需求)
- [6. 非目标](#6-非目标)
- [7. 总需求映射](#7-总需求映射)

## 1. 结论

LV-S06 必须证明：**在不访问 UI 和不接管 Layout 的前提下，同一字体资产与请求在 simulator/embedded 得到确定、合法且可失效的 intrinsic metrics。**

## 2. 输入与输出

### 2.1 输入

- 公共 `MeasureRequest`：关联 ID、contentRevision、font generation、role/text/font 与双轴 constraint。
- Build Profile 冻结的 font catalog、字体资产摘要、度量上限和初始 generation。
- owner thread 产生的 viewport/density/system-font 变化信号。
- 可关闭的 `CoreIngressPort`，用于异步投递 generation changed。

### 2.2 输出

- 同步、按值返回并精确回显关联字段的 `MeasureResult(measured|failed)`。
- 严格递增的 `PlatformFontGenerationChanged` invalidation signal。
- measure calls/failures、active snapshot readers、generation 与通知 backlog 计数。

## 3. 功能需求

| ID | 需求 |
|---|---|
| LV-S06-R01 | `PlatformMeasurePort.measure` 必须在 Core Runtime Thread 同步完成；每次调用只返回一个按值 Result，不保留 Request 引用、不抛异常。 |
| LV-S06-R02 | success/failure 必须回显 `requestId/surfaceId/nodeId/contentRevision/platformFontGeneration`；success 只返回有限、非负、满足 constraint 的 logical-px metrics。 |
| LV-S06-R03 | Adapter 只测量 `text/buttonLabel` 的 label；`View` 不测量，Button padding/min-size 和最终 Rect 仍由 Core 计算。 |
| LV-S06-R04 | V1 两个 Profile 必须注册同一摘要的 scalable mandatory family：`system-default, weight 400`；font token/weight 必须 exact match，fontSize 以 Q26.6 对字体设计单位缩放并限制在 Profile 范围内，不得静默 fallback。默认字号为 16 logical-px。 |
| LV-S06-R05 | `measure()` 只能读取调用开始时获取的 immutable `FontMetricsSnapshot`；不得访问 Host Tree、NativeHandle、LVGL object、SDL API 或可变 font registry。 |
| LV-S06-R06 | Adapter 必须以有界 UTF-8 流式算法计算 glyph advance、kerning、hard break 与 soft wrap；不得在热路径创建与文本长度成比例的无界容器。 |
| LV-S06-R07 | width constraint 必须先参与 soft wrap，再归一化结果；`exactly` 等于指定值，`atMost` 不超过指定值，`unconstrained` 使用 intrinsic value。height constraint 对自然高度执行同样的 exactly/atMost 归一化。 |
| LV-S06-R08 | 空文本 intrinsic 为 `0x0`；LF 是 hard break，CRLF 视为一个 hard break；space/tab 与 CJK 字符边界是 V1 soft-break opportunity，超长不可分 token 在 code-point 边界回退换行。 |
| LV-S06-R09 | 非法 UTF-8、非法/非有限数值、unsupported font、generation mismatch、资源超限、glyph 缺失或计算溢出统一返回 `failed(MEASURE_FAILED)`，不得返回 `0x0` 兜底。 |
| LV-S06-R10 | 初始 `platformFontGeneration=1`；字体/viewport/density 变化由 owner thread 构造完整新 snapshot，发布成功后 generation 严格递增，旧 snapshot 在读者退出前保持有效。 |
| LV-S06-R11 | generation changed 只作为 Core Measure cache 失效信号投递 Core queue；不得在 `measure()` 调用栈重入 Core、触发 Layout 或直接修改 Core cache。 |
| LV-S06-R12 | 每个已发布 generation 必须恰好投递一次 changed 通知。前一通知 pending 时不得发布下一 generation；新的平台变化只标记 source dirty，待通知 accepted 后按最新平台事实准备下一代。每个 owner turn 最多重试一次。 |
| LV-S06-R13 | 请求 generation 与调用时 snapshot generation 不一致时返回 retryable `MEASURE_FAILED`；若发布发生在 snapshot 获取之后，本次用旧 immutable snapshot 完成，后续通知使 Core 失效重算。 |
| LV-S06-R14 | Platform 不建立 MeasureResult cache；公共 cache key、contentRevision 判断、候选事务丢弃和重新 Layout 均属于 Core。 |
| LV-S06-R15 | metrics 使用 signed Q26.6 logical-px 内部计算，输出精确到 `1/64 logical-px`；每次加法、乘法和约束转换都必须检查溢出。 |
| LV-S06-R16 | simulator 与 embedded 必须使用同一 mandatory font bytes、catalog identity、UTF-8/wrap 算法和 Q26.6 rounding；同 fixture 输出必须逐值一致。 |
| LV-S06-R17 | snapshot slots、faces、输入 bytes/code points/lines 和 pending notification 全部固定上限；超限失败，不动态扩容、不阻塞、不 spin。 |
| LV-S06-R18 | 关闭必须幂等且非阻塞：先停止新 generation 和 measure admission；已有同步 reader 自然退出前 `tryFinalizeClose` 返回 busy，由外层后续 turn 有界重试；reader 归零后释放 snapshots。析构不得隐藏等待或执行 owner task。 |
| LV-S06-R19 | Trace 只记录结构化关联 ID、generation、耗时、尺寸、错误与计数；TraceSink 行为不得改变 metrics/result。 |
| LV-S06-R20 | 字体 face 可以由后续 Profile 增加，但不得运行期下载、fallback 或替换 mandatory face；catalog 变化只能通过新 generation 发布。 |

## 4. 固定资源上限

| Limit | `lvgl-simulator-dev` | `lvgl-embedded-min` | 超限行为 |
|---|---:|---:|---|
| immutable snapshot slots | 2 | 2 | 延后发布，不覆盖活跃 snapshot |
| faces per snapshot | 16 | 4 | Profile build/prepare 失败 |
| fontSize range | (0, 256] logical-px | (0, 256] logical-px | `MEASURE_FAILED` |
| UTF-8 bytes per request | 65,536 | 4,096 | `MEASURE_FAILED` |
| decoded code points per request | 32,768 | 2,048 | `MEASURE_FAILED` |
| logical lines per request | 4,096 | 256 | `MEASURE_FAILED` |
| pending generation notifications | 1 | 1 | 延后下一 generation 发布 |

所有算法使用常量大小的 decoder/line workspace；不复制整段 text。limits 属于 Build Profile，不允许运行期放大。

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 分层 | Platform 仅输出字体 intrinsic metrics；无 Yoga、Style、Button padding、Rect 或 Host placement。 |
| 线程 | measure 在 Core Runtime Thread；snapshot prepare/publish 在 LVGL owner；两者只共享 immutable snapshot。 |
| 确定性 | 同 font asset/generation/request 得到相同 Result；不依赖系统 locale、SDL window 或设备 UI 状态。 |
| 内存 | snapshot 双槽与流式 workspace 有上限；无按文本长度增长的持久对象。 |
| 失败 | 所有无法可信测量的情况明确 `MEASURE_FAILED`；不静默 fallback。 |
| 可测试 | Fake font catalog、generation publish、CoreIngress full、invalid glyph/UTF-8/overflow 均可注入。 |

## 6. 非目标

- 不实现 Yoga、Core Measure cache、Layout Rect、Mount 或 native placement。
- 不测量 View 或整个 Button，不添加 padding/min-size。
- 不访问 LVGL object/Host Tree，不调用 UI-only 字体 API。
- 不实现复杂脚本 shaping、BiDi、字体下载、系统 fallback 或动态 font plugin。
- 不修改公共 Measure Contract/Schema，不启动 LV-S07，不写产品代码。

## 7. 总需求映射

| LVGL 总需求 | LV-S06 覆盖 |
|---|---|
| `LV-R09` | R01-R20 |
| `LV-R12` | R01、R05、R10-R13、R18 |
| `LV-R13` | R04、R16-R17、R20 |
| `LV-R18` | R19 |
