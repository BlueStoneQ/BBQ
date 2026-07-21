# CardFlow DSL Spec v1.0

## 目录

- [设计原则](#设计原则)
- [文件结构](#文件结构)
- [节点模型](#节点模型)
- [布局系统（layout）](#布局系统layout)
  - [容器布局属性](#容器布局属性)
  - [子节点布局属性](#子节点布局属性)
  - [尺寸属性](#尺寸属性)
- [组件类型（type）](#组件类型type)
- [样式系统（style）](#样式系统style)
- [数据绑定（data）](#数据绑定data)
- [交互事件（actions）](#交互事件actions)
- [条件渲染（预留 v2）](#条件渲染预留-v2)
- [动画系统（预留 v2）](#动画系统预留-v2)
- [插槽系统（预留 v2）](#插槽系统预留-v2)
- [完整示例](#完整示例)
- [实现分阶段规划](#实现分阶段规划)
- [设计决策记录](#设计决策记录)

---

## 设计原则

1. **每个节点都是 flex 节点** — 对齐 Yoga 布局引擎，不存在"非 flex 容器"
2. **layout 和 style 分离** — layout 管位置尺寸（Yoga 职责），style 管视觉外观（渲染层职责）
3. **JSON 声明式** — 结构即组件树，一个 JSON 对象 = 一个渲染节点
4. **跨端共享** — Flutter 和 C++ LVGL 读同一份 DSL，只是渲染实现不同
5. **数据驱动** — `{{key}}` 占位，运行时注入数据，支持局部刷新

---

## 文件结构

```json
{
  "version": "1.0.0",
  "meta": {
    "id": "com.cardflow.weather",
    "name": "天气卡片",
    "version": "1.2.0",
    "author": "cardflow",
    "minEngineVersion": "1.0.0",
    "permissions": ["network"],
    "size": {
      "width": 320,
      "height": "wrap_content"
    },
    "createdAt": "2026-07-19T10:00:00Z"
  },
  "root": { /* 根节点 */ },
  "data": { /* 默认数据 */ },
  "styles": { /* 样式表 */ },
  "animations": { /* 动画定义（预留） */ },
  "slots": { /* 插槽定义（预留，用于卡片组合） */ }
}
```

| 字段 | 类型 | 必须 | 阶段 | 说明 |
|------|------|------|------|------|
| `version` | string | ✅ | v1 | DSL 协议版本 |
| `meta` | Meta | ❌ | v1 | 卡片元信息（标识、版本、权限、尺寸） |
| `root` | Node | ✅ | v1 | 根节点，组件树入口 |
| `data` | object | ❌ | v1 | 默认数据，作为数据绑定的 fallback |
| `styles` | object | ❌ | v1 | 命名样式表，供 `styleRef` 引用 |
| `animations` | object | ❌ | v2 | 动画定义（入场/退场/状态切换） |
| `slots` | object | ❌ | v2 | 插槽，允许外部卡片嵌入子卡片 |

### meta 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `id` | string | ❌ | 卡片唯一标识（用于缓存、去重、分发） |
| `name` | string | ❌ | 人类可读名称 |
| `version` | string | ❌ | 卡片版本（semver） |
| `author` | string | ❌ | 作者 |
| `minEngineVersion` | string | ❌ | 最低渲染引擎版本要求 |
| `permissions` | string[] | ❌ | 能力声明（network、location、camera、bluetooth） |
| `size` | object | ❌ | 建议渲染尺寸 `{width, height}` |
| `createdAt` | string | ❌ | 创建时间（ISO 8601） |
| `tags` | string[] | ❌ | 标签（用于商店分类、搜索） |
| `platform` | string[] | ❌ | 目标平台 `["phone", "watch", "glasses"]` |

> 渲染引擎只关注 `root` + `data` + `styles`。`meta` 是透传信息，供平台层（商店、分发、缓存）使用。

---

## 节点模型

每个节点的通用结构：

```json
{
  "type": "view",
  "layout": { /* 布局属性 */ },
  "style": { /* 视觉样式 */ },
  "styleRef": "styleName",
  "children": [ /* 子节点 */ ],
  "actions": { /* 交互事件 */ },
  ...componentSpecificProps
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 组件类型（view, text, image, button...） |
| `layout` | Layout | 布局属性（位置、尺寸、flex） |
| `style` | Style | 内联视觉样式 |
| `styleRef` | string | 引用 styles 表中的命名样式 |
| `children` | Node[] | 子节点列表（仅容器类型） |
| `actions` | Actions | 交互事件绑定 |

---

## 布局系统（layout）

对齐 Yoga/Flexbox 模型。每个节点天然是 flex 节点。

### 容器布局属性

当节点有 `children` 时，这些属性控制子节点如何排列：

```json
{
  "layout": {
    "direction": "column",
    "justifyContent": "start",
    "alignItems": "stretch",
    "flexWrap": "nowrap",
    "gap": 8,
    "padding": [16, 16, 16, 16]
  }
}
```

| 属性 | 类型 | 默认值 | 可选值 | 说明 |
|------|------|--------|--------|------|
| `direction` | string | `"column"` | `row`, `column` | 主轴方向 |
| `justifyContent` | string | `"start"` | `start`, `center`, `end`, `spaceBetween`, `spaceAround`, `spaceEvenly` | 主轴对齐 |
| `alignItems` | string | `"stretch"` | `start`, `center`, `end`, `stretch`, `baseline` | 交叉轴对齐 |
| `flexWrap` | string | `"nowrap"` | `nowrap`, `wrap` | 是否换行 |
| `gap` | number | `0` | - | 子节点间距（px） |
| `padding` | number[] | `[0,0,0,0]` | - | 内边距 [top, right, bottom, left] |

### 子节点布局属性

每个节点自身在父容器中的表现：

```json
{
  "type": "text",
  "content": "hello",
  "layout": {
    "flex": 1,
    "alignSelf": "center",
    "margin": [0, 0, 8, 0]
  }
}
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `flex` | number | `0` | flex grow 值 |
| `alignSelf` | string | `"auto"` | 覆盖父容器的 alignItems |
| `margin` | number[] | `[0,0,0,0]` | 外边距 [top, right, bottom, left] |

### 尺寸属性

```json
{
  "layout": {
    "width": 200,
    "height": 100,
    "minWidth": 100,
    "maxWidth": 300,
    "aspectRatio": 1.5
  }
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `width` | number \| `"match_parent"` \| `"wrap_content"` | 宽度 |
| `height` | number \| `"match_parent"` \| `"wrap_content"` | 高度 |
| `minWidth` | number | 最小宽度 |
| `maxWidth` | number | 最大宽度 |
| `minHeight` | number | 最小高度 |
| `maxHeight` | number | 最大高度 |
| `aspectRatio` | number | 宽高比 |

---

## 组件类型（type）

### view — 通用容器

有 `children` 的节点，用于布局嵌套。

```json
{
  "type": "view",
  "layout": {"direction": "row", "gap": 8},
  "style": {"backgroundColor": "#F5F5F5", "borderRadius": 12},
  "children": [...]
}
```

### text — 文本

```json
{
  "type": "text",
  "content": "{{title}}",
  "style": {"fontSize": 16, "color": "#333333", "fontWeight": "bold"},
  "maxLines": 2,
  "overflow": "ellipsis"
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `content` | string | 文本内容，支持 `{{key}}` 绑定 |
| `maxLines` | number | 最大行数 |
| `overflow` | string | 溢出处理：`ellipsis`, `clip`, `visible` |

### image — 图片

```json
{
  "type": "image",
  "src": "{{coverUrl}}",
  "layout": {"width": 80, "height": 80},
  "style": {"borderRadius": 8},
  "fit": "cover",
  "placeholder": "https://example.com/placeholder.png"
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `src` | string | 图片 URL，支持 `{{key}}` 绑定 |
| `fit` | string | 缩放模式：`cover`, `contain`, `fill`, `fitWidth`, `fitHeight` |
| `placeholder` | string | 加载中占位图 URL |

### button — 按钮

```json
{
  "type": "button",
  "label": "点击查看",
  "style": {"backgroundColor": "#007AFF", "color": "#FFFFFF", "borderRadius": 8},
  "actions": {
    "onTap": {"type": "navigate", "target": "detail"}
  }
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `label` | string | 按钮文案 |
| `icon` | string | 图标 URL（可选） |

### spacer — 弹性占位

```json
{
  "type": "spacer",
  "layout": {"flex": 1}
}
```

### divider — 分割线

```json
{
  "type": "divider",
  "style": {"color": "#E0E0E0", "height": 1}
}
```

---

## 样式系统（style）

### 通用视觉属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `backgroundColor` | string | 背景色 `#RRGGBB` 或 `#AARRGGBB` |
| `borderRadius` | number \| number[] | 圆角（单值或 [tl, tr, br, bl]） |
| `borderWidth` | number | 边框宽度 |
| `borderColor` | string | 边框颜色 |
| `opacity` | number | 透明度 0~1 |
| `shadow` | object | 阴影 `{color, offsetX, offsetY, blur}` |

### 文本样式属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `fontSize` | number | 字号 |
| `color` | string | 文字颜色 |
| `fontWeight` | string | `normal`, `bold`, `100`~`900` |
| `fontFamily` | string | 字体 |
| `textAlign` | string | `start`, `center`, `end` |
| `lineHeight` | number | 行高（倍数） |
| `letterSpacing` | number | 字间距 |

### 样式合并规则

优先级：**内联 style > styleRef**

```json
{
  "styles": {
    "title": {"fontSize": 24, "color": "#333", "fontWeight": "bold"}
  }
}
```

使用：
```json
{
  "type": "text",
  "content": "Hello",
  "styleRef": "title",
  "style": {"color": "#FF0000"}
}
```

最终生效：`{fontSize: 24, color: "#FF0000", fontWeight: "bold"}`（内联 color 覆盖 styleRef 的 color）

---

## 数据绑定（data）

### 语法

```
{{key}}          — 顶层 key
{{user.name}}    — 嵌套访问
```

### 解析规则

1. 渲染前遍历节点树，找到所有 `{{key}}` 占位
2. 优先从运行时传入的 data 中取值
3. 取不到则 fallback 到 DSL 顶层 `data` 字段
4. 都没有则保留原始占位符（或渲染为空）

### 示例

DSL:
```json
{
  "data": {
    "title": "默认标题",
    "count": 0
  },
  "root": {
    "type": "text",
    "content": "{{title}} ({{count}})"
  }
}
```

运行时传入 `{"title": "天气", "count": 5}` → 渲染 "天气 (5)"

---

## 交互事件（actions）

```json
{
  "actions": {
    "onTap": {
      "type": "navigate",
      "target": "detail_page",
      "params": {"id": "{{itemId}}"}
    },
    "onLongPress": {
      "type": "showMenu",
      "items": [
        {"label": "刷新", "action": {"type": "refresh"}},
        {"label": "删除", "action": {"type": "custom", "name": "delete"}}
      ]
    }
  }
}
```

### Action 类型

| type | 说明 | 参数 | 阶段 |
|------|------|------|------|
| `navigate` | 页面跳转 | `target`, `params` | v1 |
| `openUrl` | 打开链接 | `url` | v1 |
| `refresh` | 刷新当前卡片 | - | v1 |
| `showMenu` | 弹出菜单 | `items` | v1 |
| `custom` | 自定义事件（由宿主处理） | `name`, `params` | v1 |
| `updateData` | 局部更新数据 | `key`, `value` | v2 |
| `playAnimation` | 触发动画 | `animationId` | v2 |
| `callSkill` | 调用 Skill（DAG 场景） | `skillId`, `params` | v2 |

---

## 条件渲染（预留 v2）

```json
{
  "type": "view",
  "$if": "{{isLoggedIn}}",
  "children": [
    {"type": "text", "content": "欢迎回来，{{userName}}"}
  ]
}
```

| 指令 | 说明 | 阶段 |
|------|------|------|
| `$if` | 条件渲染，表达式为 truthy 时渲染该节点 | v2 |
| `$show` | 条件显示（保留节点但 visibility hidden） | v2 |
| `$for` | 列表循环渲染 | v2 |

### 列表循环（预留 v2）

```json
{
  "type": "view",
  "layout": {"direction": "column", "gap": 8},
  "$for": {
    "source": "{{items}}",
    "item": "item",
    "index": "idx"
  },
  "children": [
    {
      "type": "text",
      "content": "{{idx}}. {{item.title}}"
    }
  ]
}
```

---

## 动画系统（预留 v2）

```json
{
  "animations": {
    "fadeIn": {
      "type": "opacity",
      "from": 0,
      "to": 1,
      "duration": 300,
      "curve": "easeOut"
    },
    "slideUp": {
      "type": "translate",
      "from": {"y": 20},
      "to": {"y": 0},
      "duration": 250,
      "curve": "easeOut"
    }
  }
}
```

节点引用动画：
```json
{
  "type": "view",
  "enterAnimation": "fadeIn",
  "children": [...]
}
```

---

## 插槽系统（预留 v2）

允许卡片定义插槽，宿主或父卡片可以向插槽注入子卡片：

```json
{
  "slots": {
    "header": {
      "description": "卡片顶部自定义区域",
      "defaultContent": {
        "type": "text",
        "content": "默认标题"
      }
    },
    "footer": {
      "description": "卡片底部操作区"
    }
  },
  "root": {
    "type": "view",
    "layout": {"direction": "column"},
    "children": [
      {"$slot": "header"},
      {"type": "text", "content": "{{mainContent}}"},
      {"$slot": "footer"}
    ]
  }
}
```

---

## 完整示例

### 天气卡片

```json
{
  "version": "1.0.0",
  "meta": {"name": "weather_card"},
  "root": {
    "type": "view",
    "layout": {
      "direction": "column",
      "padding": [16, 16, 16, 16],
      "gap": 12
    },
    "style": {
      "backgroundColor": "#1E88E5",
      "borderRadius": 16
    },
    "children": [
      {
        "type": "text",
        "content": "{{location}}",
        "style": {"fontSize": 14, "color": "#FFFFFFAA"}
      },
      {
        "type": "view",
        "layout": {"direction": "row", "alignItems": "center", "gap": 16},
        "children": [
          {
            "type": "image",
            "src": "{{iconUrl}}",
            "layout": {"width": 64, "height": 64}
          },
          {
            "type": "text",
            "content": "{{temperature}}°",
            "style": {"fontSize": 48, "color": "#FFFFFF", "fontWeight": "bold"}
          }
        ]
      },
      {
        "type": "text",
        "content": "{{description}}",
        "style": {"fontSize": 16, "color": "#FFFFFFDD"}
      }
    ]
  },
  "data": {
    "location": "杭州",
    "iconUrl": "https://example.com/sunny.png",
    "temperature": "26",
    "description": "晴，适宜出行"
  }
}
```

---

## 实现分阶段规划

| 能力 | v1（当前） | v2（后续） |
|------|-----------|-----------|
| 基础组件（view/text/image/button/spacer/divider） | ✅ | ✅ |
| Flex 布局（direction/justifyContent/alignItems/gap/padding） | ✅ | ✅ |
| 样式系统（inline + styleRef） | ✅ | ✅ |
| 数据绑定（`{{key}}` 替换） | ✅ | ✅ |
| 交互事件（onTap/onLongPress → action） | ✅ | ✅ |
| meta 元信息 | ✅（基础字段） | ✅（完整字段） |
| 条件渲染（$if/$show） | ❌ | ✅ |
| 列表循环（$for） | ❌ | ✅ |
| 动画系统 | ❌ | ✅ |
| 插槽系统（$slot） | ❌ | ✅ |
| 局部数据更新（updateData action） | ❌ | ✅ |
| Skill 调用（callSkill action） | ❌ | ✅ |
| 嵌套数据访问（`{{user.name}}`） | ✅ | ✅ |
| 数据 transform（round/dateFormat） | ❌ | ✅ |
| 响应式尺寸（百分比/vw/vh） | ❌ | v3 |
| 主题系统（dark/light） | ❌ | v3 |

**v1 目标**：能渲染一张完整的静态数据驱动卡片，支持交互回调。
**v2 目标**：支持条件/循环，具备动态列表能力，支持动画和 Skill 集成。

---

## 设计决策记录

### DR-001: 为什么不把 flex 做成独立组件类型？

**决策**：所有容器节点天然支持 flex 布局属性，不单独设一个 `"type": "flex"` 组件。

**原因**：
1. Yoga 布局引擎中每个节点都是 flex 节点，没有"非 flex 容器"概念
2. 避免 `flex` 和 `container`/`view` 语义重叠
3. 叶子节点（text/image）也需要 `flex`、`alignSelf` 等自身布局属性
4. C++ 端映射时 DSL 节点和 YGNode 可以 1:1 对应，无需额外转换

### DR-002: 为什么 layout 和 style 分离？

**决策**：`layout` 管位置尺寸，`style` 管视觉外观，两个独立字段。

**原因**：
1. 职责分离：Yoga 只计算布局（位置 + 尺寸），不关心颜色、圆角
2. C++ 端流程是：Yoga 算布局 → LVGL 画视觉，两步分别读不同字段
3. Flutter 端也对应：`layout` → Flex/Sized 系 Widget，`style` → Container decoration
4. 便于后续做增量更新：只改数据时可能只需刷 style，不用重新布局

### DR-003: 为什么用 JSON 而非 XML/YAML？

**决策**：DSL 格式为 JSON。

**原因**：
1. 跨端解析最通用（Dart、C++、JS 都有原生 JSON 支持）
2. 结构化程度高，嵌套清晰
3. 体积比 XML 小
4. AI 生成 JSON 的可靠性高于 XML
5. 后续可考虑 MessagePack 等二进制格式做传输优化，但存储/调试用 JSON


### DR-004: JSON vs XML — 分层设计

**决策**：渲染端核心只认 JSON。未来可扩展 XML/模板层作为开发者手写语法。

**分析**：

XML 对开发者手写更友好：

```xml
<view direction="column" padding="16">
  <text style="title">{{location}}</text>
  <view direction="row" gap="12">
    <image src="{{icon}}" width="48" height="48" />
    <text style="temp">{{temperature}}°</text>
  </view>
</view>
```

JSON 对机器更友好：

```json
{
  "type": "view",
  "layout": {"direction": "column", "padding": [16,16,16,16]},
  "children": [
    {"type": "text", "content": "{{location}}", "styleRef": "title"}
  ]
}
```

**各平台 XML 解析支持**：

| 平台 | JSON | XML |
|------|------|-----|
| Dart/Flutter | ✅ 内置 `dart:convert` | ❌ 需第三方包（`xml`） |
| C/C++ (ESP32) | cJSON ~4KB ROM | tinyxml2 ~30KB ROM |
| JavaScript | ✅ 内置 `JSON.parse()` | 内置 DOMParser（仅浏览器） |
| Kotlin/Android | ✅ 内置 | ✅ 内置 XmlPullParser |
| Swift/iOS | ✅ 内置 | ✅ 内置 XMLParser |

**结论**：XML 解析不是所有平台原生支持，且成本更高（体积冗余 30-50%、需处理属性/命名空间/转义等）。ESP32 内存紧张场景下差异尤为明显。

**未来分层架构**：

```
开发者手写层（DX 友好）
    XML / JSX / 模板语法
        ↓ CLI 编译 / 转换
传输 & 存储层（机器友好）
    JSON（体积小、解析快、跨端通用）
        ↓ 渲染端解析
渲染层
    Flutter Widget / C++ LVGL
```

业界参考：
- React：JSX → `createElement()` → JS 对象
- 快应用/小程序：模板 XML → JSON VDom → 渲染端消费
- SwiftUI：声明式语法 → ViewBuilder 结构

当前阶段只做 JSON 渲染端。后续如有 JS Card（开发者手写卡片）的场景，可在 CLI 层加一步 XML → JSON 编译，渲染端不需要任何改动。
