# Step 02: DSL Model 定义

## 目录

- [背景](#背景)
- [目标](#目标)
- [技术方案](#技术方案)
- [分步实现](#分步实现)
  - [Step 2.1: CardModel — 卡片顶层模型](#step-21-cardmodel--卡片顶层模型)
  - [Step 2.2: NodeModel — 节点模型](#step-22-nodemodel--节点模型)
  - [Step 2.3: LayoutModel — 布局属性](#step-23-layoutmodel--布局属性)
  - [Step 2.4: StyleModel — 样式属性](#step-24-stylemodel--样式属性)
  - [Step 2.5: ActionModel — 交互事件](#step-25-actionmodel--交互事件)
  - [Step 2.6: MetaModel — 卡片元信息](#step-26-metamodel--卡片元信息)
  - [Step 2.7: 创建 model 桶文件](#step-27-创建-model-桶文件barrel-file)
  - [Step 2.8: 更新入口文件 export](#step-28-更新入口文件-export)
  - [Step 2.9: 验证](#step-29-验证)
- [关键知识点](#关键知识点)
- [下一步](#下一步)

---

## 背景

Model 层是 DSL JSON 在 Dart 中的内存表示。JSON 解析后变成 Model 对象，渲染引擎读 Model 来构建 Widget。

```
JSON string → (Step 03: Parser) → Model 对象 → (Step 04+: Engine) → Widget
```

本步先定义 Model，下一步再写 Parser。

---

## 目标

- 定义 CardModel（卡片顶层）
- 定义 NodeModel（节点）
- 定义 LayoutModel（布局属性）
- 定义 StyleModel（视觉样式）
- 定义 ActionModel（交互事件）
- 定义 MetaModel（元信息）

---

## 技术方案

Model 是纯数据类（data class），不包含任何业务逻辑。Dart 中用 class + final 字段 + 构造函数来定义。

对照 DSL Spec 中的结构：

```json
{
  "version": "1.0.0",       → CardModel.version
  "meta": {...},            → MetaModel
  "root": {...},            → NodeModel（递归树）
  "data": {...},            → Map<String, dynamic>
  "styles": {...}           → Map<String, StyleModel>
}
```

---

## 分步实现

### Step 2.1: CardModel — 卡片顶层模型(元数据)

创建文件 `lib/src/model/card_model.dart`：

```dart
/// CardModel — DSL 卡片的顶层数据结构
///
/// 对应 JSON 的最外层：
/// {
///   "version": "1.0.0",
///   "meta": {...},
///   "root": {...},       ← 组件树根节点
///   "data": {...},       ← 默认数据（数据绑定 fallback）
///   "styles": {...}      ← 命名样式表
/// }
class CardModel {
  /// DSL 协议版本号（如 "1.0.0"），用于兼容性判断
  final String dslVersion;

  /// 卡片元信息（id、名称、权限等），可选
  final MetaModel? meta;

  /// 组件树根节点
  final NodeModel root;

  /// 默认数据，作为 {{key}} 绑定的 fallback
  final Map<String, dynamic> data;

  /// 命名样式表，供 styleRef 引用
  final Map<String, StyleModel> styles;

  const CardModel({
    required this.dslVersion,
    this.meta,
    required this.root,
    this.data = const {},
    this.styles = const {},
  });
}
```

---

### Step 2.2: NodeModel — 节点模型

创建文件 `lib/src/model/node_model.dart`：

```dart
/// NodeModel — 组件树中的单个节点
///
/// 对应 JSON 中的每个节点对象：
/// {
///   "type": "view",          ← 组件类型
///   "layout": {...},         ← 布局属性（Flexbox）
///   "style": {...},          ← 内联视觉样式
///   "styleRef": "title",     ← 引用 styles 表中的命名样式
///   "children": [...],       ← 子节点（仅容器类型有）
///   "actions": {...},        ← 交互事件
///   ...其他组件特有属性
/// }
class NodeModel {
  /// 组件类型：view, text, image, button, spacer, divider
  final String type;

  /// 布局属性（Flexbox），控制位置和尺寸
  final LayoutModel? layout;

  /// 内联视觉样式
  final StyleModel? style;

  /// 引用 styles 表中的命名样式
  final String? styleRef;

  /// 子节点列表（仅 view 等容器类型有）
  final List<NodeModel> children;

  /// 交互事件绑定
  final Map<String, ActionModel>? actions;

  /// 组件特有属性（text 的 content、image 的 src 等）
  /// 用 Map 存储，不同组件类型有不同的属性
  final Map<String, dynamic> props;

  const NodeModel({
    required this.type,
    this.layout,
    this.style,
    this.styleRef,
    this.children = const [],
    this.actions,
    this.props = const {},
  });

  /// 快捷访问：获取 text 组件的 content
  String? get content => props['content'] as String?;

  /// 快捷访问：获取 image 组件的 src
  String? get src => props['src'] as String?;

  /// 快捷访问：获取 text 组件的 maxLines
  int? get maxLines => props['maxLines'] as int?;

  /// 快捷访问：获取 image 组件的 fit
  String? get fit => props['fit'] as String?;

  /// 快捷访问：获取 button 组件的 label
  String? get label => props['label'] as String?;
}
```

---

### Step 2.3: LayoutModel — 布局属性

创建文件 `lib/src/model/layout_model.dart`：

```dart
/// LayoutModel — 节点的布局属性
///
/// 对齐 Yoga/Flexbox 模型。每个节点天然是 flex 节点。
///
/// 容器属性（控制子节点排列）：
///   direction, justifyContent, alignItems, flexWrap, gap, padding
///
/// 自身属性（自己在父容器中的表现）：
///   flex, alignSelf, margin, width, height, ...
class LayoutModel {
  // --- 容器属性（有 children 时生效） ---

  /// 主轴方向：row | column
  final String? direction;

  /// 主轴对齐：start | center | end | spaceBetween | spaceAround | spaceEvenly
  final String? justifyContent;

  /// 交叉轴对齐：start | center | end | stretch | baseline
  final String? alignItems;

  /// 是否换行：nowrap | wrap
  final String? flexWrap;

  /// 子节点间距
  final double? gap;

  /// 内边距 [top, right, bottom, left]
  final List<double>? padding;

  // --- 自身属性（在父容器中的表现） ---

  /// flex grow 值
  final double? flex;

  /// 覆盖父容器的 alignItems：auto | start | center | end | stretch
  final String? alignSelf;

  /// 外边距 [top, right, bottom, left]
  final List<double>? margin;

  // --- 尺寸属性 ---

  /// 宽度：数值(px) 或 "match_parent" 或 "wrap_content"
  final dynamic width;

  /// 高度：数值(px) 或 "match_parent" 或 "wrap_content"
  final dynamic height;

  /// 最小宽度
  final double? minWidth;

  /// 最大宽度
  final double? maxWidth;

  /// 最小高度
  final double? minHeight;

  /// 最大高度
  final double? maxHeight;

  /// 宽高比
  final double? aspectRatio;

  const LayoutModel({
    this.direction,
    this.justifyContent,
    this.alignItems,
    this.flexWrap,
    this.gap,
    this.padding,
    this.flex,
    this.alignSelf,
    this.margin,
    this.width,
    this.height,
    this.minWidth,
    this.maxWidth,
    this.minHeight,
    this.maxHeight,
    this.aspectRatio,
  });
}
```

---

### Step 2.4: StyleModel — 样式属性

创建文件 `lib/src/model/style_model.dart`：

```dart
/// StyleModel — 节点的视觉样式
///
/// 控制外观（颜色、字体、圆角、边框等），不控制位置尺寸。
/// 位置尺寸由 LayoutModel 负责。
class StyleModel {
  // --- 通用视觉属性 ---

  /// 背景色：#RRGGBB 或 #AARRGGBB
  final String? backgroundColor;

  /// 圆角：单值或 [topLeft, topRight, bottomRight, bottomLeft]
  final dynamic borderRadius;

  /// 边框宽度
  final double? borderWidth;

  /// 边框颜色
  final String? borderColor;

  /// 透明度 0~1
  final double? opacity;

  // --- 文本样式属性 ---

  /// 字号
  final double? fontSize;

  /// 文字颜色
  final String? color;

  /// 字重：normal | bold | 100~900
  final String? fontWeight;

  /// 字体
  final String? fontFamily;

  /// 文本对齐：start | center | end
  final String? textAlign;

  /// 行高（倍数）
  final double? lineHeight;

  /// 字间距
  final double? letterSpacing;

  const StyleModel({
    this.backgroundColor,
    this.borderRadius,
    this.borderWidth,
    this.borderColor,
    this.opacity,
    this.fontSize,
    this.color,
    this.fontWeight,
    this.fontFamily,
    this.textAlign,
    this.lineHeight,
    this.letterSpacing,
  });
}
```

---

### Step 2.5: ActionModel — 交互事件

创建文件 `lib/src/model/action_model.dart`：

```dart
/// ActionModel — 交互事件定义
///
/// 对应 JSON 中的 actions:
/// {
///   "onTap": {
///     "type": "navigate",
///     "params": {"target": "detail_page", "id": "123"}
///   }
/// }
///
/// 不同 action type 的 params 约定：
/// - navigate: {"target": "page_name", ...extraParams}
/// - openUrl: {"url": "https://..."}
/// - refresh: {} (无参数)
/// - showMenu: {"items": [...]}
/// - custom: {"name": "eventName", ...extraParams}
/// - callSkill: {"skillId": "xxx", ...extraParams}
class ActionModel {
  /// 动作类型：navigate | openUrl | refresh | showMenu | custom | callSkill
  final String type;

  /// 参数，不同 type 有不同的 key 约定
  /// 用 Map 统一存储，保持扩展性
  final Map<String, dynamic> params;

  const ActionModel({
    required this.type,
    this.params = const {},
  });
}
``` this.items,
    this.name,
  });
}
```

---

### Step 2.6: MetaModel — 卡片元信息

创建文件 `lib/src/model/meta_model.dart`：

```dart
/// MetaModel — 卡片元信息
///
/// 渲染引擎不直接使用这些信息，但透传给宿主 App。
/// 用于卡片管理、缓存、分发等平台层功能。
class MetaModel {
  /// 卡片唯一标识，推荐反向域名格式（如 "com.cardkit.weather"）
  final String? id;

  /// 人类可读名称
  final String? name;

  /// 卡片版本
  final String? version;

  /// 作者
  final String? author;

  /// 最低渲染引擎版本
  final String? minEngineVersion;

  /// 能力声明
  final List<String>? permissions;

  /// 目标平台
  final List<String>? platform;

  const MetaModel({
    this.id,
    this.name,
    this.version,
    this.author,
    this.minEngineVersion,
    this.permissions,
    this.platform,
  });
}
```

---

### Step 2.7: 创建 model 桶文件（barrel file）

创建文件 `lib/src/model/models.dart`：

```dart
/// Model 层统一导出
/// 其他模块 import 这一个文件即可使用所有 Model
export 'card_model.dart';
export 'node_model.dart';
export 'layout_model.dart';
export 'style_model.dart';
export 'action_model.dart';
export 'meta_model.dart';
```

---

### Step 2.8: 更新入口文件 export

编辑 `lib/lite_card_flutter.dart`：

```dart
/// LiteCard Flutter - A lightweight Server-Driven UI card rendering engine.

// @add: 通过桶文件统一导出所有 Model
export 'src/model/models.dart';
```

---

### Step 2.9: 验证

```bash
cd /Users/qiaoyang/code/my-github/cardflow/lite_card_flutter
flutter analyze
```

应该无 error。如果有 import 路径问题，检查文件名和目录是否对应。

验证 Model 可以被 example 引用：

在 `example/lib/main.dart` 顶部临时加一行测试：

```dart
// @add: 临时测试 import 是否正常（验证完可删）
import 'package:lite_card_flutter/lite_card_flutter.dart';
```

`flutter analyze` 无报错即可。

---

## 关键知识点

### 为什么用 class 而不用 Map

虽然 JSON 解析后天然就是 `Map<String, dynamic>`，但定义 Model class 的好处：

| | Map | Model class |
|--|-----|-------------|
| 类型安全 | ❌ 取值全是 dynamic | ✅ 编译期检查字段类型 |
| IDE 补全 | ❌ 无提示 | ✅ `.` 后自动提示所有字段 |
| 重构友好 | ❌ 改字段名全局搜字符串 | ✅ rename 自动全局替换 |
| 文档 | ❌ 看不出结构 | ✅ 注释即文档 |

### const 构造函数

所有 Model 都用 `const` 构造函数，因为它们是不可变对象（immutable）。好处：
- Flutter 可以在 Widget 树对比时跳过没变的部分
- 符合"数据驱动"的设计：新数据来了就创建新 Model，不修改旧的

### props 字段的设计

NodeModel 中用 `Map<String, dynamic> props` 存储组件特有属性（text 的 content、image 的 src），而不是为每个组件类型定义子类。原因：
- DSL 是动态的，未来可能新增组件类型
- 避免类爆炸（TextNodeModel、ImageNodeModel、ButtonNodeModel...）
- 用 getter 提供快捷类型安全访问（`node.content`）

### Model 之间的关系

```
CardModel
├── meta: MetaModel?
├── root: NodeModel            ← 递归树结构
│   ├── layout: LayoutModel?
│   ├── style: StyleModel?
│   ├── actions: Map<String, ActionModel>?
│   └── children: List<NodeModel>   ← 递归
├── data: Map<String, dynamic>
└── styles: Map<String, StyleModel>
```

### 关于递归嵌套深度

Model 层本身不限制深度（`children: List<NodeModel>` 天然支持无限递归），深度限制在 **Parser 层**（Step 03）做。

| 层 | 职责 | 做法 |
|----|------|------|
| Model | 数据结构 | 不限制，树状递归 |
| Parser | 解析 JSON → Model | 加 `maxDepth` 参数（默认 32），超过报错/截断 |
| Engine | Model → Widget | Flutter 无硬限制，但太深影响性能 |
| DSL Spec | 协议约束 | meta 中可声明最大嵌套深度 |

Parser 里的防御逻辑（Step 03 会写）：

```dart
NodeModel _parseNode(Map<String, dynamic> json, {int depth = 0}) {
  if (depth > maxDepth) {
    throw DslParseException('Node nesting exceeds max depth: $maxDepth');
  }
  // ...
  children: (json['children'] as List?)
    ?.map((c) => _parseNode(c, depth: depth + 1))
    .toList() ?? [],
}
```

Model 层不需要改，这是 Parser 的职责。

---

## 下一步

完成后告诉我，我出 **Step 03: JSON Parser**，将 JSON 字符串解析为这些 Model 对象。
