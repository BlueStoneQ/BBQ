# Step 01: 项目初始化

## 目录

- [背景](#背景)
- [目标](#目标)
- [分步实现](#分步实现)
  - [Step 1.1: 创建 Flutter Package](#step-11-创建-flutter-package)
  - [Step 1.2: 调整 pubspec.yaml](#step-12-调整-pubspecyaml)
  - [Step 1.3: 建立源码目录结构](#step-13-建立源码目录结构)
  - [Step 1.4: 写入口文件](#step-14-写入口文件)
  - [Step 1.5: 创建 example App](#step-15-创建-example-app)
  - [Step 1.6: 验证](#step-16-验证)
- [关键知识点](#关键知识点)
- [下一步](#下一步)

---

## 背景

LiteCard 是一个 **Flutter Package**（不是 App），用于将 JSON DSL 渲染为 Flutter Widget。

- Package = 可复用的库，被其他项目依赖（类似 npm 包）
- App = 可运行的应用

我们创建 Package，附带 `example/` 目录放示例 App 用于调试。

---

## 目标

- 创建 Flutter Package 脚手架
- 配置 pubspec.yaml
- 建立标准目录结构
- 写入口文件（空壳）
- 创建 example App（用于后续调试）

---

## 分步实现

### Step 1.1: 创建 Flutter Package

```bash
cd /Users/qiaoyang/code/my-github/cardflow

flutter create --template=package lite_card_flutter
```

> Flutter 包名用下划线（`lite_card_flutter`），不能用横线。

生成结构：

```
lite_card_flutter/
├── lib/
│   └── lite_card_flutter.dart
├── test/
│   └── lite_card_flutter_test.dart
├── CHANGELOG.md
├── LICENSE
├── README.md
├── pubspec.yaml
└── analysis_options.yaml
```

---

### Step 1.2: 调整 pubspec.yaml

打开 `lite_card_flutter/pubspec.yaml`，只需要改动两处（其余保留 flutter create 生成的默认内容和注释）：

```yaml
# 1. 修改 description（第 2 行左右）
description: A lightweight Server-Driven UI card rendering engine for Flutter.

# 2. 添加 homepage
homepage: https://github.com/cardflow-dev/lite-card-flutter
```

`environment.sdk` 不需要改，`flutter create` 已经自动写好了匹配你本地 Flutter 版本的约束。

其余字段（name、version、dependencies 等）保持 `flutter create` 生成的默认值即可，不需要删除注释。

---

### Step 1.3: 建立源码目录结构

```bash
cd lite_card_flutter

mkdir -p lib/src/engine
mkdir -p lib/src/parser
mkdir -p lib/src/model
mkdir -p lib/src/components
mkdir -p lib/src/styles
mkdir -p lib/src/actions
mkdir -p lib/widgets
```

| 目录 | 职责 |
|------|------|
| `lib/src/engine/` | 渲染引擎核心 |
| `lib/src/parser/` | JSON 解析 |
| `lib/src/model/` | 数据模型 |
| `lib/src/components/` | 组件实现 |
| `lib/src/styles/` | 样式处理 |
| `lib/src/actions/` | 交互事件 |
| `lib/widgets/` | 对外 Widget |

---

### Step 1.4: 写入口文件

编辑 `lib/lite_card_flutter.dart`：

```dart
/// LiteCard Flutter - A lightweight Server-Driven UI card rendering engine.
///
/// 这个文件是整个 Package 的入口。外部使用者只需要：
/// import 'package:lite_card_flutter/lite_card_flutter.dart';
/// 就能访问所有公开 API。
///
/// 现代 Dart 不需要显式写 library name（会触发 lint 警告），
/// 文件路径本身就隐含了 library 标识。
/// export 语句控制哪些内部文件对外暴露。
/// 当前先注释掉，后续每实现一个模块就取消注释对应的 export。

// --- 公开 API（随实现进度逐步取消注释） ---

// 渲染引擎：接收 DSL JSON → 输出 Widget
// export 'src/engine/lite_card_engine.dart';

// 数据模型：CardModel / NodeModel 等，外部可能需要直接操作
// export 'src/model/card_model.dart';

// 顶层 Widget：外部直接使用的组件
// export 'widgets/lite_card_widget.dart';
```

**为什么需要这个文件**：

Dart Package 的规则是外部只能 import `lib/` 下的直接文件，不能 import `lib/src/` 下的。所以这个入口文件通过 `export` 把内部实现有选择地暴露出去。类似 Node.js 的 `index.js` 统一导出。

---

### Step 1.5: 创建 example App

```bash
cd /Users/qiaoyang/code/my-github/cardflow/lite_card_flutter
flutter create example
```

编辑 `example/pubspec.yaml`，只需要改两处：

**1. 在 dependencies 里加对父级 Package 的引用：**

```yaml
dependencies:
  flutter:
    sdk: flutter
  # 加这两行，让 example app 能使用我们的 Package
  lite_card_flutter:
    path: ../   # 指向上级目录的 Package
```

**2. 在 flutter 下加 assets 声明（后续放示例 JSON 用）：**

```yaml
flutter:
  uses-material-design: true
  # 加这两行
  assets:
    - assets/
```

创建 assets 目录：

```bash
mkdir -p example/assets
```

**3. 主入口**
- 编辑 `example/lib/main.dart`，把默认计数器 demo 替换为 LiteCard 的占位页面：

```dart
import 'package:flutter/material.dart';
// @add: 后续 Step 实现完成后取消注释，引入 LiteCard Package
// import 'package:lite_card_flutter/lite_card_flutter.dart';

void main() {
  runApp(const ExampleApp());
}

// @update: 把默认的 MyApp 改名为 ExampleApp，明确这是示例应用
class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LiteCard Example',
      theme: ThemeData(
        // @update: 换个颜色和默认 demo 区分
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
      ),
      // @update: 指向我们自己的 HomePage
      home: const HomePage(),
    );
  }
}

// @update: 把默认的 StatefulWidget 计数器替换为简单的 StatelessWidget 占位
// 后续 Step 10/11 会在这里放 LiteCardWidget
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LiteCard Flutter Demo')),
      // @add: 后续这里会替换为 LiteCardWidget 渲染区域
      body: const Center(
        child: Text(
          'LiteCard 渲染区域\n(Step 02 后开始填充)',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 16, color: Colors.grey),
        ),
      ),
    );
  }
}
```

**改动说明**：
- 删除整个默认计数器代码（MyApp + MyHomePage + _MyHomePageState）
- 换成简单的 StatelessWidget 占位页面
- 预留 `import lite_card_flutter` 注释，后续取消注释即可

---

### Step 1.6: 验证

```bash
cd /Users/qiaoyang/code/my-github/cardflow/lite_card_flutter
flutter pub get
flutter analyze

cd example
flutter pub get
flutter run
```

---

## 关键知识点

| 类型 | 命令 | 含原生代码 | 用途 |
|------|------|-----------|------|
| Package | `flutter create --template=package` | 否 | 纯 Dart 库 |
| Plugin | `flutter create --template=plugin` | 是 | 调原生能力 |
| App | `flutter create` | 是 | 可运行应用 |

- `lib/src/` = 内部实现，外部不应直接 import
- `lib/lite_card_flutter.dart` = 公开 API 入口
- `path: ../` = 本地路径依赖，改代码即时生效

---

## 下一步

完成后告诉我，我出 Step 02: DSL Model 定义。
