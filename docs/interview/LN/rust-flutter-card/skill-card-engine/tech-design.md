# skill-card-engine — 技术设计文档

## 目录

- [一、架构总览](#一架构总览)
- [二、JSON 卡片协议设计](#二json-卡片协议设计)
  - [2.1 完整卡片示例](#21-完整卡片示例)
  - [2.2 组件类型](#22-组件类型)
  - [2.3 表达式语法](#23-表达式语法)
  - [2.4 指令系统](#24-指令系统)
  - [2.5 事件和 Action](#25-事件和-action)
- [三、引擎分层设计](#三引擎分层设计)
  - [3.1 Parser 层](#31-parser-层)
  - [3.2 Expression 层](#32-expression-层)
  - [3.3 Reactive 层](#33-reactive-层)
  - [3.4 Renderer 层](#34-renderer-层)
- [四、数据流](#四数据流)
  - [4.1 首次渲染](#41-首次渲染)
  - [4.2 数据推送刷新](#42-数据推送刷新)
  - [4.3 用户交互](#43-用户交互)
- [五、局部刷新机制](#五局部刷新机制)
- [六、目录结构](#六目录结构)
- [七、技术选型与 Trade-off](#七技术选型与-trade-off)
- [八、预留扩展点](#八预留扩展点)
  - [8.1 Native 下沉接口](#81-native-下沉接口)
  - [8.2 静态资源处理](#82-静态资源处理)
  - [8.3 外围工具链规划](#83-外围工具链规划不在-mvp-范围)

---

## 一、架构总览

```
┌─────────────────────────────────────────────────┐
│  数据源（后端 API / 本地 JSON / AI 生成）         │
└──────────────────────┬──────────────────────────┘
                       │ JSON String
┌──────────────────────▼──────────────────────────┐
│  Engine Layer (纯 Dart，无 UI 依赖)              │
│  ┌────────┐ ┌────────────┐ ┌──────────┐        │
│  │ Parser │→│ Expression │→│ Reactive │        │
│  └────────┘ └────────────┘ └──────────┘        │
└──────────────────────┬──────────────────────────┘
                       │ CardTree (描述树)
┌──────────────────────▼──────────────────────────┐
│  Renderer Layer (Flutter Widget)                 │
│  CardTree → Widget 树 → Flutter 渲染              │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  Flutter Engine → Skia/Impeller → 屏幕            │
└─────────────────────────────────────────────────┘
```

设计原则：
- **Engine 层纯 Dart，不依赖 Flutter**（可独立单元测试）
- **Renderer 层只负责 Widget 映射**（薄层，逻辑在 Engine）
- **数据单向流动**：JSON → Engine → Widget（不反向）

---

## 二、JSON 卡片协议设计

### 2.1 完整卡片示例

```json
{
  "version": "1.0",
  "data": {
    "title": "今日天气",
    "temp": "26°C",
    "city": "深圳",
    "showDetail": true,
    "forecast": [
      { "day": "周一", "weather": "晴", "high": "28°C" },
      { "day": "周二", "weather": "多云", "high": "25°C" },
      { "day": "周三", "weather": "雨", "high": "22°C" }
    ]
  },
  "template": {
    "type": "column",
    "style": { "padding": "16", "background": "#FFFFFF", "borderRadius": "12" },
    "children": [
      {
        "type": "text",
        "props": { "content": "{{city}} · {{title}}" },
        "style": { "fontSize": "18", "color": "#333333" }
      },
      {
        "type": "text",
        "props": { "content": "{{temp}}" },
        "style": { "fontSize": "48", "fontWeight": "bold", "color": "#FF6600" }
      },
      {
        "type": "column",
        "$if": "{{showDetail}}",
        "$for": { "source": "forecast", "item": "day" },
        "children": [
          {
            "type": "row",
            "style": { "justifyContent": "spaceBetween", "padding": "8 0" },
            "children": [
              { "type": "text", "props": { "content": "{{day.day}}" } },
              { "type": "text", "props": { "content": "{{day.weather}}" } },
              { "type": "text", "props": { "content": "{{day.high}}" } }
            ]
          }
        ]
      },
      {
        "type": "button",
        "props": { "text": "查看详情" },
        "style": { "marginTop": "12" },
        "events": {
          "tap": { "action": "navigate", "params": { "url": "/weather/detail" } }
        }
      }
    ]
  }
}
```

### 2.2 组件类型

| 类型 | 说明 | 关键属性 |
|------|------|---------|
| column | 垂直布局 | children, gap |
| row | 水平布局 | children, gap |
| stack | 层叠布局 | children |
| text | 文本 | content, maxLines |
| image | 图片 | src, fit |
| button | 按钮 | text, events |
| input | 输入框（P1） | placeholder, value |
| spacer | 弹性空白 | flex |

### 2.3 表达式语法

```
{{variable}}           → 简单变量引用
{{object.field}}       → 嵌套属性访问
{{array[0].name}}      → 数组下标 + 属性
{{item.price}}         → $for 循环内的 item 引用
{{count > 0}}          → 布尔表达式（用于 $if）
```

MVP 只支持简单路径解析 + 比较运算符，不做完整 JS 表达式求值。

### 2.4 指令系统

| 指令 | 作用 | 示例 |
|------|------|------|
| `$if` | 条件渲染 | `"$if": "{{showDetail}}"` |
| `$for` | 列表渲染 | `"$for": { "source": "items", "item": "item", "index": "idx" }` |
| `$show` | 显隐控制 | `"$show": "{{visible}}"` （渲染但隐藏 vs $if 不渲染） |

### 2.5 事件和 Action

```json
"events": {
  "tap": {
    "action": "navigate",
    "params": { "url": "/detail/{{item.id}}" }
  }
}
```

支持的 Action 类型：

| Action | 说明 | 参数 |
|--------|------|------|
| navigate | 页面跳转 | url |
| updateData | 修改当前卡片数据 | path, value |
| showDialog | 弹窗 | title, content |
| callback | 回调宿主 | eventName, params |

---

## 三、引擎分层设计

### 3.1 Parser 层

输入 JSON String，输出 `CardDefinition`：

```dart
class CardDefinition {
  final String version;
  final Map<String, dynamic> data;     // 初始数据
  final NodeDefinition template;       // 模板树
}

class NodeDefinition {
  final String type;                   // column / text / image ...
  final Map<String, dynamic> style;    // 样式属性
  final Map<String, PropValue> props;  // 组件属性（可能含表达式）
  final List<NodeDefinition> children;
  final Directive? directive;          // $if / $for / $show
  final Map<String, ActionDef>? events; // 事件绑定
}

enum PropValueType { static_, expression }
class PropValue {
  final PropValueType type;
  final String raw;           // "hello" 或 "{{title}}"
  final List<String> deps;    // 依赖的数据路径 ["title"]
}
```

### 3.2 Expression 层

求值表达式：

```dart
class ExpressionEngine {
  /// 求值 "{{city}} · {{title}}" + data → "深圳 · 今日天气"
  String evaluate(String template, Map<String, dynamic> data);

  /// 求值布尔 "{{count > 0}}" + data → true/false
  bool evaluateBool(String expr, Map<String, dynamic> data);

  /// 提取表达式依赖路径 "{{item.name}}" → ["item.name"]
  List<String> extractDeps(String template);
}
```

### 3.3 Reactive 层

数据变更 → 精确找到需要更新的节点：

```dart
class ReactiveEngine {
  /// 依赖表：数据路径 → 依赖它的 Widget ID 列表
  final Map<String, Set<String>> _depMap;

  /// 注册依赖：nodeId 依赖 paths
  void register(String nodeId, List<String> paths);

  /// 数据变更 → 返回需要更新的 nodeId 集合
  Set<String> onDataChanged(List<String> changedPaths);
}
```

核心算法：
```
pushData(newData):
  1. diff(oldData, newData) → changedPaths: ["temp", "forecast[0].weather"]
  2. depMap.lookup(changedPaths) → dirtyNodeIds: {"node_3", "node_7"}
  3. 对 dirtyNodeIds 重新求值表达式 → 更新 Widget
```

### 3.4 Renderer 层

Flutter Widget 映射：

```dart
class CardRenderer extends StatefulWidget {
  final CardDefinition card;
  final Map<String, dynamic> data;
  final void Function(ActionDef action)? onAction;
}

class _CardRendererState extends State<CardRenderer> {
  late ReactiveEngine _reactive;
  late Map<String, dynamic> _currentData;

  /// 外部推送新数据
  void pushData(Map<String, dynamic> newData) {
    final changedPaths = diff(_currentData, newData);
    final dirtyNodes = _reactive.onDataChanged(changedPaths);
    _currentData = newData;
    setState(() {});  // 只有 dirty 节点会 rebuild（通过 key + shouldUpdate）
  }

  @override
  Widget build(BuildContext context) {
    return _buildNode(widget.card.template);
  }

  Widget _buildNode(NodeDefinition node) {
    // $if 检查
    if (node.directive?.type == DirectiveType.if_) {
      if (!_evaluateBool(node.directive!.expr)) return SizedBox.shrink();
    }
    // $for 展开
    if (node.directive?.type == DirectiveType.for_) {
      return _buildForLoop(node);
    }
    // 按 type 映射 Widget
    switch (node.type) {
      case 'column': return Column(children: node.children.map(_buildNode).toList());
      case 'row': return Row(children: node.children.map(_buildNode).toList());
      case 'text': return Text(_evaluate(node.props['content']!));
      case 'image': return Image.network(_evaluate(node.props['src']!));
      case 'button': return _buildButton(node);
      default: return SizedBox.shrink();
    }
  }
}
```

---

## 四、数据流

### 4.1 首次渲染

```
CardRenderer(card: cardDef, data: initialData)
  → Parser 已在外部完成（CardDefinition 传入）
  → build() 遍历 template 树
    → 每个节点：求值表达式 → 映射 Widget
    → 注册依赖到 ReactiveEngine
  → Flutter 渲染 Widget 树
```

### 4.2 数据推送刷新

```
调用 pushData(newData)
  → diff(old, new) → changedPaths
  → ReactiveEngine.onDataChanged(changedPaths) → dirtyNodeIds
  → setState()
  → build() 中：dirty 节点重新求值，非 dirty 节点用缓存
  → Flutter 增量 rebuild
```

### 4.3 用户交互

```
用户点击 button
  → GestureDetector.onTap
  → 查找 node.events["tap"] → ActionDef
  → 根据 action 类型分发：
    ├── navigate → onAction 回调给宿主 → Navigator.push
    ├── updateData → 修改 _currentData → 触发 pushData 流程
    └── callback → onAction 回调给宿主
```

---

## 五、局部刷新机制

不全量重建 Widget 树的关键：

```dart
// 每个动态节点带唯一 key + 用 ValueListenableBuilder 或自定义 shouldUpdate
class _DynamicNodeWidget extends StatelessWidget {
  final String nodeId;
  final Set<String> dirtyNodes;  // 当前帧的 dirty 集合

  @override
  Widget build(BuildContext context) {
    // 只有 dirty 时才重新 build 子树
    // 非 dirty 节点 return cached widget
  }
}
```

或者更简单的方案（MVP）：

```dart
// 用 ValueKey + 数据快照做 Widget diff
// Flutter 自身的 Element diff 已经能避免大部分无效重建
// 只要 key 不变 + Widget 属性不变 → Flutter 不会 rebuild
```

---

## 六、目录结构

```
skill-card-engine/
├── lib/
│   ├── src/
│   │   ├── protocol/              # 协议定义
│   │   │   ├── card_definition.dart   # CardDefinition / NodeDefinition
│   │   │   ├── action_def.dart        # ActionDef
│   │   │   └── directive.dart         # Directive ($if/$for/$show)
│   │   ├── engine/                # 解析引擎（纯 Dart，无 Flutter 依赖）
│   │   │   ├── parser.dart            # JSON → CardDefinition
│   │   │   ├── expression.dart        # 表达式求值
│   │   │   ├── reactive.dart          # 依赖追踪 + diff
│   │   │   └── data_diff.dart         # JSON diff 算法
│   │   └── renderer/              # Flutter Widget 层
│   │       ├── card_renderer.dart     # 顶层 StatefulWidget
│   │       ├── node_builder.dart      # NodeDefinition → Widget
│   │       └── style_mapper.dart      # JSON style → Flutter style
│   └── skill_card_engine.dart     # 公开 API 入口
├── example/                       # Demo App
│   ├── assets/cards/              # 示例卡片 JSON
│   │   ├── weather.json
│   │   ├── navigation.json
│   │   ├── notification.json
│   │   ├── music_player.json
│   │   └── skill_list.json
│   └── lib/main.dart              # Demo 入口
├── test/                          # 单元测试
│   ├── parser_test.dart
│   ├── expression_test.dart
│   └── reactive_test.dart
├── README.md
└── pubspec.yaml
```

---

## 七、技术选型与 Trade-off

| 决策 | 选择 | 为什么 |
|------|------|--------|
| 实现语言 | 纯 Dart | 零额外依赖，一套代码跨平台，热重载体验好 |
| 布局 | Flutter 自带 Flex | 不需要自己算布局，直接用 Column/Row/Flex |
| 表达式引擎 | 自研轻量版 | 简单路径解析，不引入重型 JS 解释器 |
| 局部刷新 | depMap + Flutter 自身 diff | 不需要 Virtual DOM，Flutter 的 Element diff 足够好 |
| 序列化 | dart:convert (内置) | 无外部依赖 |
| 状态管理 | StatefulWidget + setState | MVP 不需要 Provider/Riverpod，保持简单 |

### 和 Rust 方案对比

| | skill-card-engine (Dart) | aria-render (Rust) |
|--|-------------------------|-------------------|
| 开发速度 | **1 周 MVP** | 3 周 |
| 性能 | 够用（<8ms/帧） | 更快（<2ms/帧） |
| 跨渲染端 | 仅 Flutter | Flutter + Android + Web |
| 调试体验 | **热重载 + DevTools** | 需要 lldb |
| 适合阶段 | **Demo + 早期产品** | 量产优化阶段 |

---

## 八、预留扩展点

### 8.1 Native 下沉接口

为未来 Native 下沉留好接口：

```dart
/// 引擎核心抽象（当前 Dart 实现，未来可替换为 FFI 调用）
abstract class CardEngine {
  CardDefinition parse(String json);
  Map<String, dynamic> evaluateAll(CardDefinition card, Map<String, dynamic> data);
  Set<String> onDataChanged(Map<String, dynamic> oldData, Map<String, dynamic> newData);
}

/// 默认 Dart 实现
class DartCardEngine implements CardEngine { ... }

/// 未来 Native 实现（通过 FFI 调用 Rust .so）
// class NativeCardEngine implements CardEngine { ... }
```

这样当性能成为瓶颈时，只需要实现 `NativeCardEngine`，上层 Renderer 代码不变。

### 8.2 静态资源处理

卡片 JSON 中引用的静态资源（图片/图标/字体）通过 `ResourceResolver` 接口统一处理：

```dart
/// 资源解析器 — 将卡片内的资源引用解析为 Flutter 可用的加载方式
abstract class ResourceResolver {
  /// 解析 src 字符串，返回 ImageProvider
  ImageProvider resolveImage(String src);
}

/// 默认实现：支持网络 URL + 本地 asset 路径
class DefaultResourceResolver implements ResourceResolver {
  final String? cardBasePath;  // 本地资源基础路径

  @override
  ImageProvider resolveImage(String src) {
    if (src.startsWith('http')) return NetworkImage(src);
    if (src.startsWith('data:')) return MemoryImage(base64Decode(src));
    return AssetImage('$cardBasePath/$src');  // 本地相对路径
  }
}
```

资源引用方式：

| 类型 | 格式 | 处理 |
|------|------|------|
| 网络 | `https://...` | Image.network |
| 本地 asset | `icons/sun.png` | cardBasePath 拼接 |
| Base64 内联 | `data:image/png;base64,...` | 解码后 Image.memory |
| 平台内置 | `builtin://icon_name` | 宿主注册的 icon 映射（P2） |

### 8.3 外围工具链规划（不在 MVP 范围）

完整 Server-Driven UI 生态的外围层：

```
┌── 开发者工具链（Future） ──────────────────────────────────┐
│                                                            │
│  1. DSL 编译器                                             │
│     YAML/HTML-like 语法 → 编译为 JSON 协议                 │
│     让开发者不用手写 JSON                                   │
│                                                            │
│  2. 可视化卡片编辑器                                       │
│     拖拽组件 → 实时预览 → 导出 JSON                        │
│     类似 Figma 但产出的是可运行的卡片协议                    │
│                                                            │
│  3. 卡片包管理                                             │
│     JSON + 静态资源打包为 .zip / .card 格式                │
│     版本管理 + 增量更新 + 签名校验                          │
│                                                            │
│  4. 资源 CDN + 预加载                                      │
│     图片/字体等静态资源走 CDN 分发                          │
│     客户端预加载 + LRU 缓存                                │
│                                                            │
│  5. DevTools                                               │
│     实时查看渲染树 + 数据流 + 性能分析                      │
│     类似 Flutter DevTools 但面向卡片协议层                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

这些属于完整生态建设，当前 MVP 聚焦运行时引擎。但在 README 的 Roadmap 中体现，表明对全链路的理解。
