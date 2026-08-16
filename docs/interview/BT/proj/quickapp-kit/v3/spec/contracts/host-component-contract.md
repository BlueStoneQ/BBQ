# V1 Host Component Contract

## 目录

- [1. 结论](#1-结论)
- [2. DSL Lowering](#2-dsl-lowering)
- [3. 组件](#3-组件)
- [4. Style](#4-style)
- [5. Platform 输出](#5-platform-输出)
- [6. Intrinsic Measure](#6-intrinsic-measure)

## 1. 结论

V1 不允许各平台自行解释联盟标签和任意属性。Toolkit 将联盟 DSL Lowering 为规范化组件和 Style；Core 校验、Resolve 和 Layout；Platform 只实现固定 Host Component Contract。

## 2. DSL Lowering

| 联盟 DSL | V1 规范组件 | 规则 |
|---|---|---|
| `<div>` | `View` | 容器和 Flex Layout |
| `<text>` | `Text` | 文本内容进入 `text` prop |
| `<input type="button">` | `Button` | `value` Lowering 为 `text`，缺失 `enabled` 时固定补 `true`，`onclick` Lowering 为 click Handler |

未知组件在 strict 模式下报错，不得把原始字符串直接透传给 Platform。

## 3. 组件

| Component | Props | Events |
|---|---|---|
| `View` | 无 V1 业务 prop | 无必选事件 |
| `Text` | `text: string` | 无必选事件 |
| `Button` | `text: string`、`enabled: boolean` | `click` |

`undefined` 不进入协议；缺失字段表示未设置，`null` 表示显式空值且仅在该 prop Schema 允许时合法。V1 的 `text` 不允许 null。

## 4. Style

Toolkit/Core 支持的 V1 Style：

| 分类 | 属性 | 值 |
|---|---|---|
| Layout | `width`、`height` | Length |
| Layout | `marginTop/Right/Bottom/Left` | Length |
| Flex | `flexDirection` | `row/column` |
| Flex | `justifyContent` | `flex-start/center/flex-end/space-between` |
| Flex | `alignItems` | `flex-start/center/flex-end/stretch` |
| Visual | `backgroundColor`、`color` | `#RRGGBB` 或 `#RRGGBBAA` |
| Visual | `borderRadius`、`fontSize` | 非负 logical-px number |
| Visual | `textAlign` | `left/center/right` |

Length：`{ value: number, unit: "logical-px" | "percent" }`。`width/height` 必须非负；margin 允许负值。联盟 `px` 和 Less 求值结果在 Toolkit 阶段规范化为 `logical-px`；Core 使用 Surface viewport 完成 percent 和 Flex Layout。

动态 `UpdateBinding` V1 只允许 Page IR target 为 `text:string` 或 `enabled:boolean`。Core 先按 TemplateBindingId 解析 target，再结合 Runtime Node 类型校验：`Text` 只允许 `text`，`Button` 允许 `text/enabled`，`View` 不允许动态业务 prop。类型、scope 或目标不匹配时整笔 RenderTransaction 返回 `ABI_INVALID_ARGUMENT`，不得提交 Runtime Tree。

## 5. Platform 输出

Core 不把 margin、flex 或百分比交给 Platform 重新布局；Platform 接收最终 `SetHostLayout`。Visual Style 转为受控 Host Prop：

```text
text / enabled / backgroundColor / color / borderRadius / fontSize / textAlign
```

Android、LVGL、iOS 必须为同一规范属性提供语义等价映射；不支持时返回 `PLATFORM_REJECTED`，不得静默解释为其他语义。

## 6. Intrinsic Measure

`Text` 和 auto-size `Button` 的字体固有尺寸遵循 [Measure Adapter Contract](./measure-adapter-contract.md)。Core 仍拥有 Yoga 和最终 Layout；Platform 只返回字体 metrics，不使用本地控件尺寸覆盖 `SetHostLayout`。
