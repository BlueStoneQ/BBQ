# LiteCard Flutter — Overview

> [← 返回 card-kit 索引](../../README.md) · [GitHub Repo](https://github.com/card-kit/lite-card-flutter)

## 快速导航

- [DSL Spec](./design/dsl-spec.md)
- [实现步骤索引](./steps/step-index.md)

## 目录

- [项目定位](#项目定位)
- [核心概念](#核心概念)
- [技术方案](#技术方案)
  - [整体架构](#整体架构)
  - [DSL 协议（JSON）](#dsl-协议json)
  - [渲染引擎](#渲染引擎)
  - [组件体系](#组件体系)
  - [数据绑定](#数据绑定)
  - [样式系统](#样式系统)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [与后续项目的关系](#与后续项目的关系)
- [开发方式](#开发方式)

---

## 项目定位

LiteCard 是 CardFlow 生态的 **Flutter 渲染端**，以 Flutter Package 形式提供。

核心能力：接收一段 JSON DSL 描述 → 解析 → 渲染为 Flutter Widget 树。

```
JSON DSL (卡片描述)
    ↓
LiteCard Engine (解析 + 布局 + 渲染)
    ↓
Flutter Widget Tree (可视化卡片)
```

这是一个 **Server-Driven UI 渲染引擎**：
- 服务端/编排端下发 JSON 描述
- 客户端按照协议解析并渲染
- 无需发版即可动态更新 UI

后续还会有一个 **C++ / LVGL / Yoga 实现的渲染端**，用于 Android Wear / AR 眼镜等受限设备。两端共享同一套 DSL 协议。

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **Card DSL** | JSON 格式的卡片描述，定义布局、样式、数据、交互 |
| **Component** | DSL 中的组件节点（flex、text、image、button 等） |
| **RenderEngine** | 负责将 DSL 解析为 Widget 树 |
| **DataBinding** | 数据绑定层，将外部数据注入卡片模板 |
| **StyleSheet** | 样式表，支持 ref 引用和内联覆盖 |
| **Action** | 交互事件（tap、longPress），触发导航、刷新等行为 |

---

## 技术方案

### 整体架构

```
┌─────────────────────────────────────────────┐
│                LiteCard Package               │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐    ┌──────────────────┐   │
│  │  DSL Parser  │    │  Style Resolver   │   │
│  │  JSON → Model│    │  styleRef → Style │   │
│  └──────┬──────┘    └────────┬─────────┘   │
│         │                    │              │
│         ▼                    ▼              │
│  ┌─────────────────────────────────────┐   │
│  │         Component Registry           │   │
│  │  type → WidgetBuilder mapping        │   │
│  └──────────────────┬──────────────────┘   │
│                     │                       │
│                     ▼                       │
│  ┌─────────────────────────────────────┐   │
│  │         Render Engine                │   │
│  │  遍历 DSL 树 → 构建 Widget 树        │   │
│  └──────────────────┬──────────────────┘   │
│                     │                       │
│                     ▼                       │
│  ┌─────────────────────────────────────┐   │
│  │         Data Binding Layer           │   │
│  │  {{key}} → 实际值替换                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
          │
          ▼
    Flutter Widget Tree
```

### DSL 协议（JSON）

> 完整协议文档见 [design/dsl-spec.md](./design/dsl-spec.md)

核心设计决策：

1. **每个节点天然是 flex 节点** — 对齐 Yoga，不存在 `"type": "flex"` 组件
2. **layout 和 style 分离** — layout 管位置尺寸（Yoga 职责），style 管视觉外观（渲染层职责）
3. **通用容器类型为 `view`** — 有 children 就是容器，不需要区分 flex/container

节点通用结构：

```json
{
  "type": "view",
  "layout": {
    "direction": "column",
    "justifyContent": "center",
    "alignItems": "stretch",
    "padding": [16, 16, 16, 16],
    "gap": 8
  },
  "style": {
    "backgroundColor": "#FFFFFF",
    "borderRadius": 12
  },
  "children": [
    {
      "type": "text",
      "content": "{{title}}",
      "layout": {"flex": 0, "alignSelf": "start"},
      "style": {"fontSize": 20, "color": "#333333"}
    }
  ]
}
```

**为什么这样设计**：
- `layout` → Yoga/Flexbox 属性，C++ 端直接映射到 YGNode
- `style` → 视觉属性，Flutter 用 Container/TextStyle，C++ 端用 LVGL 样式
- 叶子节点也能有 `layout`（flex grow、alignSelf、margin），因为 Yoga 里每个节点都参与布局计算

### 渲染引擎

引擎的职责：DSL Model → Widget Tree

```dart
/// 对外暴露的核心 API
class LiteCardEngine {
  /// 从 JSON 字符串渲染卡片
  Widget renderFromJson(String json, {Map<String, dynamic>? data});
  
  /// 从 DSL Model 渲染卡片
  Widget renderFromModel(CardModel card, {Map<String, dynamic>? data});
  
  /// 注册自定义组件
  void registerComponent(String type, ComponentBuilder builder);
  
  /// 注册 Action 处理器
  void registerActionHandler(String actionType, ActionHandler handler);
}
```

Flutter 端每个节点的渲染逻辑：

```dart
Widget buildNode(NodeModel node) {
  // 1. 构建内容（text/image 等）
  Widget child = buildContent(node);
  
  // 2. 应用视觉样式（backgroundColor, borderRadius 等）
  child = applyStyle(child, node.style);
  
  // 3. 如果有 children → 作为 Flex 容器
  //    layout.direction → Axis
  //    layout.justifyContent → MainAxisAlignment
  //    layout.alignItems → CrossAxisAlignment
  
  return child;
}
```

### 组件体系

Lite 版本先支持最小必要组件集：

| 组件 type | 对应 Flutter Widget | 说明 |
|-----------|-------------------|------|
| `view` | `Container` + `Flex` | 通用容器（有 children 时自动作为 Flex 布局） |
| `text` | `Text` | 文本 |
| `image` | `Image.network` / `Image.asset` | 图片 |
| `button` | `ElevatedButton` / `TextButton` | 按钮 |
| `spacer` | `Spacer` / `SizedBox` | 占位 |
| `divider` | `Divider` | 分割线 |

后续可扩展：`list`、`grid`、`scroll`、`input`、`switch` 等。

### 数据绑定

```
模板: "你好，{{userName}}"
数据: {"userName": "小明"}
输出: "你好，小明"
```

实现方式：
- 渲染前遍历 DSL 树，找到所有 `{{key}}` 占位符
- 用传入的 data Map 做字符串替换
- 支持嵌套访问：`{{user.name}}`
- 支持默认值：DSL 中 `data` 字段提供 fallback

### 样式系统

两种使用方式：

**1. 内联样式**
```json
{
  "type": "text",
  "content": "Hello",
  "style": {
    "fontSize": 16,
    "color": "#FF0000"
  }
}
```

**2. 引用样式**
```json
{
  "type": "text",
  "content": "Hello",
  "styleRef": "title"
}
```

样式表定义在 DSL 顶层的 `styles` 字段中：
```json
{
  "styles": {
    "title": {
      "fontSize": 24,
      "color": "#333333",
      "fontWeight": "bold"
    }
  }
}
```

合并优先级：内联 style > styleRef

---

## 项目结构

```
cardflow/lite-card-flutter/
├── lib/
│   ├── lite_card.dart              # 包入口，导出公共 API
│   ├── src/
│   │   ├── engine/
│   │   │   ├── lite_card_engine.dart    # 渲染引擎核心
│   │   │   └── component_registry.dart  # 组件注册表
│   │   ├── parser/
│   │   │   ├── dsl_parser.dart          # JSON → CardModel
│   │   │   └── data_resolver.dart       # 数据绑定解析
│   │   ├── model/
│   │   │   ├── card_model.dart          # 卡片模型
│   │   │   ├── node_model.dart          # 节点模型
│   │   │   ├── style_model.dart         # 样式模型
│   │   │   └── action_model.dart        # 交互模型
│   │   ├── components/
│   │   │   ├── flex_component.dart      # Flex 布局
│   │   │   ├── text_component.dart      # 文本
│   │   │   ├── image_component.dart     # 图片
│   │   │   ├── button_component.dart    # 按钮
│   │   │   ├── spacer_component.dart    # 占位
│   │   │   ├── divider_component.dart   # 分割线
│   │   │   └── container_component.dart # 容器
│   │   ├── styles/
│   │   │   └── style_resolver.dart      # 样式解析与合并
│   │   └── actions/
│   │       └── action_handler.dart      # 交互事件处理
│   └── widgets/
│       └── lite_card_widget.dart        # 对外的 Widget 封装
├── test/
│   ├── parser_test.dart
│   ├── engine_test.dart
│   └── components/
├── example/
│   ├── lib/
│   │   └── main.dart                   # 示例 App
│   └── assets/
│       └── sample_card.json            # 示例 DSL
├── dev-docs/
│   ├── overview.md                     # 本文件
│   ├── design/
│   │   └── dsl-spec.md                 # DSL 协议完整规范
│   └── steps/                          # 分步实现指南
│       ├── 01-project-init.md
│       ├── 02-dsl-model.md
│       ├── ...
├── pubspec.yaml
├── analysis_options.yaml
└── README.md
```

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 语言 | Dart | Flutter Package 纯 Dart 实现 |
| 框架 | Flutter | Widget 体系 |
| 状态管理 | 暂不引入 | Package 内部用 StatefulWidget 即可 |
| 测试 | flutter_test | 单元测试 + Widget 测试 |
| DSL 格式 | JSON | 轻量、通用、易于跨端共享 |

---

## 与后续项目的关系

```
CardFlow 生态
├── lite-card-flutter     ← 当前项目（Flutter 渲染端 Package）
├── lite-card-cpp         ← 后续项目（C++ LVGL + Yoga 渲染端，给 Android Wear / AR 眼镜）
├── lify                  ← DAG 搭建端（Flutter App，依赖 lite-card-flutter 做预览）
└── ai-chat               ← AI Agent Chat（Flutter Package，接入 Qwen，生成 DSL）
```

**lite-card-flutter** 是基础，其他项目依赖它：
- Lify 编排端通过 `LiteCardWidget` 做实时预览
- AI Chat 生成的 DSL 通过 `LiteCardEngine.renderFromJson()` 渲染
- C++ 渲染端共享同一份 DSL 协议（JSON Schema 一致）

---

## 开发方式

本项目采用**教学式分步实现**：

- 所有编码由你手动完成
- 每个 task 对应一个 `dev-docs/steps/XX-step-name.md`
- 每个 step 文档包含：
  - 背景与目标
  - 技术方案说明
  - 分步骤实现（含完整代码 + 注释）
  - 关键知识点解析
  - 验证方式

步骤规划（预览）：

| # | Step | 产出 |
|---|------|------|
| 01 | 项目初始化 | Flutter Package 脚手架 + pubspec + 目录结构 |
| 02 | DSL Model 定义 | CardModel、NodeModel、StyleModel 数据类 |
| 03 | JSON Parser | JSON → CardModel 解析器 |
| 04 | 基础组件（text、container） | 最简 Widget 渲染 |
| 05 | Flex 布局组件 | Row/Column 容器渲染 |
| 06 | 数据绑定 | `{{key}}` 模板解析与替换 |
| 07 | 样式系统 | styleRef + inline style 合并 |
| 08 | 图片组件 | Image 渲染 + placeholder |
| 09 | 交互事件 | onTap、Action 分发 |
| 10 | LiteCardWidget 封装 | 对外暴露的顶层 Widget |
| 11 | 示例 App | 完整 Demo 演示 |
| 12 | 测试 | Parser 测试 + Widget 测试 |

每完成一个 step，项目就多一层能力，逐步从"能解析 JSON"到"能渲染完整卡片"。
