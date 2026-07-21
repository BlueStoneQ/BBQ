# Step 03: JSON Parser

## 目录

- [背景](#背景)
- [目标](#目标)
- [技术方案](#技术方案)
- [分步实现](#分步实现)
  - [Step 3.1: DslParser 主类](#step-31-dslparser-主类)
  - [Step 3.2: 解析 NodeModel（递归）](#step-32-解析-nodemodel递归)
  - [Step 3.3: 解析 LayoutModel](#step-33-解析-layoutmodel)
  - [Step 3.4: 解析 StyleModel](#step-34-解析-stylemodel)
  - [Step 3.5: 解析 ActionModel](#step-35-解析-actionmodel)
  - [Step 3.6: 解析 MetaModel](#step-36-解析-metamodel)
  - [Step 3.7: 异常处理](#step-37-异常处理)
  - [Step 3.8: 创建 parser 桶文件](#step-38-创建-parser-桶文件)
  - [Step 3.9: 更新入口文件 export](#step-39-更新入口文件-export)
  - [Step 3.10: 验证](#step-310-验证)
- [关键知识点](#关键知识点)
- [下一步](#下一步)

---

## 背景

Step 02 定义了 Model，现在需要 Parser 把 JSON 字符串转成 Model 对象。

```
JSON string
    ↓ dart:convert jsonDecode
Map<String, dynamic>
    ↓ DslParser
CardModel (包含递归的 NodeModel 树)
```

Dart 内置 `dart:convert` 提供 JSON 解析（`jsonDecode`），把 JSON string 变成 `Map`/`List`。我们的 Parser 在此基础上做第二层转换：`Map` → 类型安全的 Model 对象。

---

## 目标

- 实现 DslParser：JSON string → CardModel
- 递归解析节点树（带深度限制）
- 解析 layout / style / actions / meta
- 定义解析异常类
- 处理缺失字段和类型错误

---

## 技术方案

```
DslParser.parse(String json)
    │
    ├── jsonDecode(json) → Map<String, dynamic>
    │
    ├── _parseMeta(map['meta']) → MetaModel?
    │
    ├── _parseNode(map['root'], depth: 0) → NodeModel  ← 递归
    │   ├── _parseLayout(node['layout']) → LayoutModel?
    │   ├── _parseStyle(node['style']) → StyleModel?
    │   ├── _parseActions(node['actions']) → Map<String, ActionModel>?
    │   └── _parseNode(child, depth+1) → NodeModel  ← 递归子节点
    │
    ├── _parseStyles(map['styles']) → Map<String, StyleModel>
    │
    └── return CardModel(...)
```

---

## 分步实现

### Step 3.1: DslParser 主类

创建文件 `lib/src/parser/dsl_parser.dart`：

```dart
import 'dart:convert';
import '../model/model.dart';

/// DslParser — 将 JSON DSL 字符串解析为 CardModel
///
/// 用法：
/// ```dart
/// final card = DslParser.parse(jsonString);
/// ```
class DslParser {
  /// 最大嵌套深度，防止恶意/错误 DSL 导致栈溢出
  static const int defaultMaxDepth = 32;

  /// 解析 JSON 字符串为 CardModel
  ///
  /// [json] — DSL JSON 字符串
  /// [maxDepth] — 最大节点嵌套深度，默认 32
  ///
  /// 抛出 [DslParseException] 当 JSON 格式错误或不符合 DSL 协议时
  static CardModel parse(String json, {int maxDepth = defaultMaxDepth}) {
    // 第一层：JSON string → Map
    final dynamic decoded;
    try {
      decoded = jsonDecode(json);
    } catch (e) {
      throw DslParseException('Invalid JSON: $e');
    }

    if (decoded is! Map<String, dynamic>) {
      throw DslParseException('Root must be a JSON object');
    }

    // 第二层：Map → CardModel
    return _parseCard(decoded, maxDepth: maxDepth);
  }

  /// 解析卡片顶层结构
  static CardModel _parseCard(Map<String, dynamic> map, {required int maxDepth}) {
    // dslVersion（必须）
    final dslVersion = map['version'] as String?;
    if (dslVersion == null) {
      throw DslParseException('Missing required field: "version"');
    }

    // root（必须）
    final rootMap = map['root'];
    if (rootMap == null || rootMap is! Map<String, dynamic>) {
      throw DslParseException('Missing or invalid required field: "root"');
    }

    // 解析各部分
    final meta = map['meta'] != null ? _parseMeta(map['meta']) : null;
    final root = _parseNode(rootMap, depth: 0, maxDepth: maxDepth);
    final data = (map['data'] as Map<String, dynamic>?) ?? {};
    final styles = _parseStyles(map['styles']);

    return CardModel(
      dslVersion: dslVersion,
      meta: meta,
      root: root,
      data: data,
      styles: styles,
    );
  }

  // ... 各子解析方法见下文
}
```

---

### Step 3.2: 解析 NodeModel（递归）

在 `DslParser` 类中添加：

```dart
  /// 递归解析节点
  ///
  /// [map] — 节点 JSON 对象
  /// [depth] — 当前深度（从 0 开始）
  /// [maxDepth] — 最大允许深度
  static NodeModel _parseNode(
    Map<String, dynamic> map, {
    required int depth,
    required int maxDepth,
  }) {
    // 深度检查
    if (depth > maxDepth) {
      throw DslParseException(
        'Node nesting exceeds max depth: $maxDepth',
      );
    }

    // type（必须）
    final type = map['type'] as String?;
    if (type == null) {
      throw DslParseException('Node missing required field: "type"');
    }

    // 解析 layout
    final layout = map['layout'] != null
        ? _parseLayout(map['layout'] as Map<String, dynamic>)
        : null;

    // 解析 style
    final style = map['style'] != null
        ? _parseStyle(map['style'] as Map<String, dynamic>)
        : null;

    // styleRef
    final styleRef = map['styleRef'] as String?;

    // 递归解析 children
    final childrenJson = map['children'] as List?;
    final children = childrenJson
        ?.map((c) => _parseNode(
              c as Map<String, dynamic>,
              depth: depth + 1,
              maxDepth: maxDepth,
            ))
        .toList() ?? [];

    // 解析 actions
    final actions = map['actions'] != null
        ? _parseActions(map['actions'] as Map<String, dynamic>)
        : null;

    // 提取组件特有属性（排除已解析的通用字段）
    final props = Map<String, dynamic>.from(map)
      ..remove('type')
      ..remove('layout')
      ..remove('style')
      ..remove('styleRef')
      ..remove('children')
      ..remove('actions');

    return NodeModel(
      type: type,
      layout: layout,
      style: style,
      styleRef: styleRef,
      children: children,
      actions: actions,
      props: props,
    );
  }
```

**注意 props 的提取方式**：把已解析的通用字段去掉，剩下的全部放进 `props`。这样 `content`、`src`、`label`、`maxLines` 等组件特有属性自动进入 props，不需要逐个枚举。

---

### Step 3.3: 解析 LayoutModel

```dart
  /// 解析布局属性
  static LayoutModel _parseLayout(Map<String, dynamic> map) {
    return LayoutModel(
      // 容器属性
      direction: map['direction'] as String?,
      justifyContent: map['justifyContent'] as String?,
      alignItems: map['alignItems'] as String?,
      flexWrap: map['flexWrap'] as String?,
      gap: (map['gap'] as num?)?.toDouble(),
      padding: _parseEdgeList(map['padding']),
      // 自身属性
      flex: (map['flex'] as num?)?.toDouble(),
      alignSelf: map['alignSelf'] as String?,
      margin: _parseEdgeList(map['margin']),
      // 尺寸属性
      width: map['width'],   // 可能是 num 或 String
      height: map['height'], // 可能是 num 或 String
      minWidth: (map['minWidth'] as num?)?.toDouble(),
      maxWidth: (map['maxWidth'] as num?)?.toDouble(),
      minHeight: (map['minHeight'] as num?)?.toDouble(),
      maxHeight: (map['maxHeight'] as num?)?.toDouble(),
      aspectRatio: (map['aspectRatio'] as num?)?.toDouble(),
    );
  }

  /// 解析边距数组 [top, right, bottom, left]
  /// 支持传入 List<num> 或 null
  static List<double>? _parseEdgeList(dynamic value) {
    if (value == null) return null;
    if (value is List) {
      return value.map((e) => (e as num).toDouble()).toList();
    }
    return null;
  }
```

---

### Step 3.4: 解析 StyleModel

```dart
  /// 解析视觉样式
  static StyleModel _parseStyle(Map<String, dynamic> map) {
    return StyleModel(
      backgroundColor: map['backgroundColor'] as String?,
      borderRadius: map['borderRadius'], // num 或 List<num>
      borderWidth: (map['borderWidth'] as num?)?.toDouble(),
      borderColor: map['borderColor'] as String?,
      opacity: (map['opacity'] as num?)?.toDouble(),
      fontSize: (map['fontSize'] as num?)?.toDouble(),
      color: map['color'] as String?,
      fontWeight: map['fontWeight'] as String?,
      fontFamily: map['fontFamily'] as String?,
      textAlign: map['textAlign'] as String?,
      lineHeight: (map['lineHeight'] as num?)?.toDouble(),
      letterSpacing: (map['letterSpacing'] as num?)?.toDouble(),
    );
  }

  /// 解析顶层 styles 样式表
  static Map<String, StyleModel> _parseStyles(dynamic value) {
    if (value == null || value is! Map<String, dynamic>) {
      return {};
    }
    return value.map(
      (key, v) => MapEntry(key, _parseStyle(v as Map<String, dynamic>)),
    );
  }
```

---

### Step 3.5: 解析 ActionModel

```dart
  /// 解析交互事件映射
  static Map<String, ActionModel> _parseActions(Map<String, dynamic> map) {
    return map.map(
      (key, v) => MapEntry(key, _parseAction(v as Map<String, dynamic>)),
    );
  }

  /// 解析单个 Action
  static ActionModel _parseAction(Map<String, dynamic> map) {
    final type = map['type'] as String?;
    if (type == null) {
      throw DslParseException('Action missing required field: "type"');
    }

    // type 之外的所有字段都作为 params
    final params = Map<String, dynamic>.from(map)..remove('type');

    return ActionModel(
      type: type,
      params: params,
    );
  }
```

---

### Step 3.6: 解析 MetaModel

```dart
  /// 解析卡片元信息
  static MetaModel _parseMeta(dynamic value) {
    if (value is! Map<String, dynamic>) {
      return const MetaModel();
    }
    final map = value;
    return MetaModel(
      id: map['id'] as String?,
      name: map['name'] as String?,
      version: map['version'] as String?,
      author: map['author'] as String?,
      minEngineVersion: map['minEngineVersion'] as String?,
      permissions: (map['permissions'] as List?)?.cast<String>(),
      platform: (map['platform'] as List?)?.cast<String>(),
    );
  }
```

---

### Step 3.7: 异常处理

创建文件 `lib/src/parser/dsl_parse_exception.dart`：

```dart
/// DSL 解析异常
///
/// 当 JSON 格式错误或不符合 DSL 协议时抛出
class DslParseException implements Exception {
  /// 错误描述
  final String message;

  const DslParseException(this.message);

  @override
  String toString() => 'DslParseException: $message';
}
```

然后在 `dsl_parser.dart` 顶部加 import：

```dart
// @add: 引入异常类
import 'dsl_parse_exception.dart';
```

---

### Step 3.8: 创建 parser 桶文件

创建文件 `lib/src/parser/parser.dart`：

```dart
/// Parser 层统一导出
export 'dsl_parser.dart';
export 'dsl_parse_exception.dart';
```

---

### Step 3.9: 更新入口文件 export

编辑 `lib/lite_card_flutter.dart`：

```dart
/// LiteCard Flutter - A lightweight Server-Driven UI card rendering engine.

// @add: 导出 parser 层
export 'src/model/model.dart';
export 'src/parser/parser.dart';
```

---

### Step 3.10: 验证

```bash
cd /Users/qiaoyang/code/my-github/cardflow/lite_card_flutter
flutter analyze
```

然后在 `example/lib/main.dart` 中临时测试解析：

```dart
import 'package:lite_card_flutter/lite_card_flutter.dart';

// 在某个地方临时调用测试：
void testParse() {
  const json = '''
  {
    "version": "1.0.0",
    "root": {
      "type": "view",
      "layout": {"direction": "column", "padding": [16, 16, 16, 16]},
      "children": [
        {
          "type": "text",
          "content": "Hello LiteCard!",
          "style": {"fontSize": 20, "color": "#333333"}
        }
      ]
    }
  }
  ''';

  final card = DslParser.parse(json);
  print('Parsed card version: ${card.dslVersion}');
  print('Root type: ${card.root.type}');
  print('Root children count: ${card.root.children.length}');
  print('First child content: ${card.root.children.first.content}');
}
```

运行后应输出：
```
Parsed card version: 1.0.0
Root type: view
Root children count: 1
First child content: Hello LiteCard!
```

---

## 关键知识点

### dart:convert jsonDecode

```dart
import 'dart:convert';

// jsonDecode 返回 dynamic（可能是 Map、List、String、num、bool、null）
final decoded = jsonDecode('{"key": "value"}');
// 需要手动 cast: decoded as Map<String, dynamic>
```

不需要第三方 JSON 库，Dart 内置够用。

### as num? 然后 .toDouble()

JSON 中的数字解析后可能是 `int` 或 `double`（取决于有没有小数点）。统一用 `(value as num?)?.toDouble()` 确保拿到 `double`。

### props 的巧妙提取

```dart
final props = Map<String, dynamic>.from(map)
  ..remove('type')
  ..remove('layout')
  ..remove('style')
  ..remove('styleRef')
  ..remove('children')
  ..remove('actions');
```

先复制整个 map，再删掉已解析的通用字段，剩下的自动变成组件特有属性。不需要为每种组件类型硬编码要取哪些字段。

### static 方法 vs 实例方法

Parser 全用 `static` 方法是因为它无状态 — 不需要 `new DslParser()` 创建实例。调用方式更简洁：`DslParser.parse(json)`。

---

## 下一步

完成后告诉我，我出 **Step 04: 基础组件（text、view）**，开始把 Model 渲染为 Flutter Widget。
