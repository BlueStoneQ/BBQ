# LV-S06 设计

## 目录

- [1. 结论](#1-结论)
- [2. 架构与所有权](#2-架构与所有权)
- [3. Font Catalog 与选择](#3-font-catalog-与选择)
- [4. Snapshot 与 generation](#4-snapshot-与-generation)
- [5. Measure 算法](#5-measure-算法)
- [6. Constraint 规则](#6-constraint-规则)
- [7. 线程与并发](#7-线程与并发)
- [8. 失败与销毁](#8-失败与销毁)
- [9. 一致性与观测](#9-一致性与观测)

## 1. 结论

LV-S06 采用：**构建期 scalable 字体目录 + owner-thread 双槽 immutable snapshot 发布 + Core-thread 流式同步度量。**

```text
Platform owns font facts
Core owns layout meaning
generation connects facts to Core cache validity
```

## 2. 架构与所有权

```text
Lvgl Composition Root
  -> immutable FontCatalogDescriptor
  -> FontMetricsSnapshot[2]

LVGL owner thread
  -> prepare next snapshot
  -> atomically publish generation N+1
  -> bounded PlatformFontGenerationChanged -> CoreIngressPort

Core Runtime Thread
  -> LvglFontMeasureAdapter.measure(request)
  -> SnapshotReadGuard(current)
  -> Utf8TextMeasurer
  -> MeasureResult by value
```

| 对象 | owner | 责任 | 不拥有 |
|---|---|---|---|
| FontCatalogDescriptor | Composition Root | face identity、asset digest、limits | 运行时状态 |
| FontMetricsSnapshot | 发布前 owner；发布后 immutable readers | generation 与 glyph metrics | Host Tree/LVGL object |
| SnapshotPublisher | LVGL owner | 双槽 prepare/publish/retire | Core cache |
| FontMeasureAdapter | Core Runtime Thread call | validate、select、stream measure、Result | Yoga/Layout/Rect |
| GenerationNotifier | LVGL owner -> Core queue | one published generation invalidation | 立即 relayout |

## 3. Font Catalog 与选择

family key 固定为：

```text
fontToken + fontWeight
```

每个 face 至少包含：

```text
assetDigest
unitsPerEm
lineHeight / baseline / defaultSpaceAdvance in design units
codePoint -> glyphId
glyphId -> advance in design units
(leftGlyphId, rightGlyphId) -> kerning in design units
missingGlyph policy = fail
```

V1 mandatory family 是 `system-default/400`，默认字号 16 logical-px。请求 fontSize 先转换为 Q26.6，再以 `fontSize/unitsPerEm` 缩放全部 design-unit metrics；有效范围是 `(0, 256]` logical-px。`text` 与 `buttonLabel` 使用同一 family selection 和 label metrics；role 只用于合同关联、Core cache 和观测。找不到 exact token/weight 或字号越界时返回 `MEASURE_FAILED`，不使用相邻 weight 或系统字体 fallback。

## 4. Snapshot 与 generation

### 4.1 双槽发布

两个 snapshot slot 状态：

```text
free -> preparing -> published -> retired -> free
```

- initial snapshot 在 Runtime 开放 measure 前完成，generation=1。
- owner 在非 published slot 中完整构建并验证所有 face，再执行一次原子发布。
- reader 通过有界 `SnapshotReadGuard` 固定当前 slot；publish 后旧 slot 只有 reader count=0 才可复用。
- 两槽都不可用时延后变更处理，不覆盖活跃数据、不等待 Core thread。
- `uint64` generation 达最大值时拒绝新发布并报告 typed platform failure，禁止 wrap。

### 4.2 失效通知

viewport、density 或系统字体事实变化后：

```text
owner prepares snapshot N+1
  -> publish succeeds
  -> pendingGeneration = max(pendingGeneration, N+1)
  -> CoreIngressPort.post(PlatformFontGenerationChanged)
```

Core queue full 时保留当前 pending generation，每个 owner turn 重试一次；在它 accepted 前禁止发布下一 generation。期间到达的平台变化只设置 `sourceDirty=true`，通知 accepted 后再按最新平台事实准备并发布下一代。这样每个实际发布的 generation 恰好对应一次通知，且 pending 存储始终只有一个。

## 5. Measure 算法

固定流程：

```text
validate IDs / role / units / finite values / profile limits
  -> acquire current immutable snapshot
  -> require request.generation == snapshot.generation
  -> exact family lookup + fontSize scaling
  -> streaming UTF-8 decode
  -> glyph lookup + kerning + line breaking
  -> intrinsic maxLineWidth / naturalLineCount * lineHeight
  -> apply width/height constraint
  -> validate finite/non-negative/constraint
  -> echo correlation fields and return
```

V1 文本规则：

1. 空 text 的 intrinsic 是 `0x0`。
2. CRLF 归一为一个 hard break，单独 LF 也是 hard break。
3. tab 使用四个 space advance；其他 Unicode whitespace 是 soft-break opportunity。
4. 相邻 CJK code point 之间可 soft break。
5. 有界宽度下优先在最近 soft-break opportunity 换行；一个 token 自身超宽时在 code-point 边界换行。
6. trailing hard break 产生一个空行；非空文本至少一行。
7. 每个 glyph 使用 face advance，并在相邻 glyph 间使用 snapshot kerning；换行清除前一 glyph。
8. invalid UTF-8、missing glyph 或超过 code-point/line 上限立即失败。

全程使用 Q26.6 checked arithmetic；不调用 `lv_text_get_size` 或任何 `lv_*` API。

## 6. Constraint 规则

width 先决定换行：

| widthConstraint | wrap width | result width |
|---|---|---|
| unconstrained | 无 soft wrap | intrinsic max line width |
| atMost(W) | W | `min(intrinsic wrapped width, W)` |
| exactly(W) | W | `W` |

height 在自然行高计算后归一：

| heightConstraint | result height |
|---|---|
| unconstrained | natural height |
| atMost(H) | `min(natural height, H)` |
| exactly(H) | `H` |

`W/H=0` 合法；结果必须严格满足 exactly/atMost。Platform 不判断显式 style width/height 是否应跳过测量，这由 Core 决定是否发起 Request。

## 7. 线程与并发

| 路径 | 执行域 | 规则 |
|---|---|---|
| snapshot prepare/publish | LVGL owner | 可读取平台字体配置；不重入 Core |
| `measure()` | Core Runtime Thread | 同步、只读、无 UI queue/wait |
| generation notify | owner -> Core queue | immutable、异步、单 pending |
| snapshot retire | owner | reader count=0 后回收 |

`measure()` 开始后即使 owner 发布新 snapshot，当前调用仍在旧 guard 上完成并回显旧 generation；Core 随后收到 generation changed，清除旧 cache 并在安全点重新 Layout。

## 8. 失败与销毁

所有测量失败都形成公共 `MeasureResult(failed, MEASURE_FAILED)`：

| 原因 | retryable |
|---|---|
| request generation 与 current snapshot 不一致 | true |
| snapshot 暂不可用或正在停止 | true |
| invalid UTF-8/constraint/number | false |
| exact family/glyph 不存在 | false |
| bytes/code points/lines 超限 | false |
| checked arithmetic 溢出或非法 metrics | false |

关闭顺序：

```text
stop generation admission
  -> reject new measure calls
  -> deliver or tombstone pending generation notification
  -> tryFinalizeClose: readers > 0 时返回 busy
  -> outer lifecycle 在后续 turn 有界重试
  -> readers == 0 时 owner retires snapshots
  -> assert readers/snapshots/pending notification == 0
```

析构只断言显式 close 已完成，不启动等待或 owner 工作。

## 9. 一致性与观测

simulator/embedded mandatory font 的 asset digest、catalog identity、算法版本、design-unit scaling 和 Q26.6 规则必须相同，因此合同 fixtures 逐值一致。其他 Profile family 只有显式注册后可选择。

最小观测：

- requestId/surfaceId/nodeId/contentRevision/generation。
- measure durationNs、width/height、text byte count。
- measure failed reason category。
- live snapshot readers、generation、pending notification、limit exceeded。

TraceSink off/drop 时，Result bits、线程和顺序必须完全相同。
