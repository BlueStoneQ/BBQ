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
| `<image>` | `Image` | `src` 必须引用 RPK 内 `assets/` 路径；网络 URL 不属于 V1；资源缺失由 Mount 失败语义报告 |
| `<input type="text">` | `Input` | `value` Lowering 为 `value`，缺失 `enabled` 时固定补 `true`；`input/change/focus` 分别映射为同名 Handler 事件 |
| `<slider>` | `Slider` | `min/max/step/value` 为有限数值，缺失时使用 V1 默认值；`onchange` 映射为 change Handler |
| `<picker mode="text">` | `Picker` | `range` 为本地 `|` 分隔字符串，`selected` 为零基整数索引；`onchange` 映射为 change Handler |
| `<tabs>` | `Tabs` | `items` 为本地 `|` 分隔字符串，`selected` 为零基整数索引；`onchange` 映射为 change Handler。Tabs 是可裁剪组件，不属于固定内核 |
| `<video>` | `Video` | `src` 为非空媒体 URI；`poster` 为可选包内 `assets/` 路径；`autoplay/controls/muted` 为布尔属性；控制意图为 `play`、`pause`、`seek` |

未知组件在 strict 模式下报错，不得把原始字符串直接透传给 Platform。

## 3. 组件

| Component | Props | Events |
|---|---|---|
| `View` | 无 V1 业务 prop | 无必选事件 |
| `Text` | `text: string` | 无必选事件 |
| `Button` | `text: string`、`enabled: boolean` | `click` |
| `Image` | `src: string`（包内 `assets/` 路径） | 无必选事件 |
| `Input` | `value: string`、`enabled: boolean` | `input`、`change`、`focus` |
| `Switch` | `checked: boolean`、`enabled: boolean` | `change`，payload 至少包含 `checked` |
| `Slider` | `min: number`、`max: number`、`step: number`、`value: number`、`enabled: boolean` | `change`，payload 至少包含 `value`、`isFromUser` |
| `Picker` | `mode: "text"`、`range: string`、`selected: number` | `change`，payload 至少包含 `selected`、`value` |
| `Tabs` | `items: string`、`selected: number` | `change`，payload 至少包含 `index`、`value` |
| `List` | 无 V1 业务 prop | `scroll`、`scrollend`、`scrolltop`、`scrollbottom` |
| `Scroll` | 无 V1 业务 prop | `scroll`、`scrollend`、`scrolltop`、`scrollbottom` |
| `Video` | `src: string`、`poster: string`、`autoplay: boolean`、`controls: boolean`、`muted: boolean` | `prepared`、`start`、`pause`、`finish`、`error`、`timeupdate` |

`undefined` 不进入协议；缺失字段表示未设置，`null` 表示显式空值且仅在该 prop Schema 允许时合法。V1 的 `text`、`src` 和 `value` 不允许 null。`Image.src` 只能是包内 `assets/` 路径；资源不存在、格式不可解码或平台无法加载时，Platform 返回既有 Mount 失败结果，Core 不提交部分 Mount，不新增专用错误码。`Input` 的 `input/change` payload 至少携带当前字符串 `value`，`focus` payload 至少携带布尔 `focused=true`；具体 Platform NativeHandle 不跨边界。

Video 的 `src` 是不可解释的非空 URI，Core 只保存并在 Mount 中传递它，不下载、不解码、不创建播放器线程。`poster` 为空表示无海报，否则必须是包内 `assets/` 路径。Platform Adapter 可接收 `play`、`pause` 和 `seek` 控制意图；`seek` 的参数是有限的非负秒数。`prepared` 表示媒体可开始播放，`start`/`pause`/`finish` 表示播放状态迁移，`timeupdate` payload 至少包含有限非负 `currentTime`，`error` 必须包含结构化错误。V1 只冻结这些消息语义，不要求 LVGL Profile 声明或实现 Video。

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

动态 `UpdateBinding` V1 允许 Page IR target 为 `text:string`、`enabled:boolean`、`value:string` 或 `selected:number`。Core 先按 TemplateBindingId 解析 target，再结合 Runtime Node 类型校验：`Text` 只允许 `text`，`Button` 允许 `text/enabled`，`Input` 允许 `value/enabled`，`Picker` 和 `Tabs` 允许 `selected`，`View` 不允许动态业务 prop。类型、scope 或目标不匹配时整笔 RenderTransaction 返回 `ABI_INVALID_ARGUMENT`，不得提交 Runtime Tree。

## 5. Platform 输出

Core 不把 margin、flex 或百分比交给 Platform 重新布局；Platform 接收最终 `SetHostLayout`。Visual Style 转为受控 Host Prop：

```text
text / enabled / backgroundColor / color / borderRadius / fontSize / textAlign
```

Android、LVGL、iOS 必须为同一规范属性提供语义等价映射；不支持时返回 `PLATFORM_REJECTED`，不得静默解释为其他语义。

## 6. Intrinsic Measure

`Text` 和 auto-size `Button` 的字体固有尺寸遵循 [Measure Adapter Contract](./measure-adapter-contract.md)。Core 仍拥有 Yoga 和最终 Layout；Platform 只返回字体 metrics，不使用本地控件尺寸覆盖 `SetHostLayout`。
