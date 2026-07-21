# Flutter 项目结构详解 - case1

## 目录

- [一、根目录配置文件](#一根目录配置文件)
  - [1.1 核心配置文件](#11-核心配置文件)
  - [1.2 pubspec.yaml 核心字段解析](#12-pubspecyaml-核心字段解析)
- [二、核心代码目录](#二核心代码目录)
  - [2.1 lib/ - Dart 源码目录（核心）](#21-lib---dart-源码目录核心)
  - [2.2 test/ - 测试目录](#22-test---测试目录)
- [三、平台原生工程目录](#三平台原生工程目录)
  - [3.1 android/ - Android 平台工程](#31-android---android-平台工程)
  - [3.2 ios/ - iOS 平台工程](#32-ios---ios-平台工程)
  - [3.3 web/ - Web 平台](#33-web---web-平台)
  - [3.4 windows/ - Windows 平台](#34-windows---windows-平台)
  - [3.5 macos/ - macOS 平台](#35-macos---macos-平台)
  - [3.6 linux/ - Linux 平台](#36-linux---linux-平台)
- [四、工具与 IDE 配置目录](#四工具与-ide-配置目录)
  - [4.1 .dart_tool/ - Dart 工具目录](#41-dart_tool---dart-工具目录)
  - [4.2 .idea/ - IntelliJ/Android Studio 配置](#42-idea---intellijandroid-studio-配置)
- [五、项目结构速查表](#五项目结构速查表)
- [六、核心文件详解（待展开）](#六核心文件详解待展开)
- [七、典型开发流程中的文件使用](#七典型开发流程中的文件使用)
- [附录：关键文件快速定位](#附录关键文件快速定位)

---

## 项目概览

这是一个标准的 Flutter 应用项目（case1），采用 Flutter 3.12.2+ SDK 创建，支持多平台部署（Android、iOS、Web、Windows、macOS、Linux）。

---

## 一、根目录配置文件

### 1.1 核心配置文件

| 文件名 | 类型 | 作用说明 |
|--------|------|----------|
| `pubspec.yaml` | 配置 | **项目清单文件**，定义项目名称、版本、依赖、资源配置等核心信息 |
| `pubspec.lock` | 自动生成 | 锁定依赖版本，确保团队成员使用相同版本的依赖包 |
| `analysis_options.yaml` | 配置 | **Dart 代码分析配置**，定义 lint 规则、代码风格检查规则 |
| `.metadata` | 自动生成 | 记录项目元数据（Flutter 版本、项目类型等），用于 IDE 识别 |
| `.gitignore` | 配置 | Git 忽略规则，排除构建产物、IDE 配置等文件 |
| `README.md` | 文档 | 项目说明文档 |
| `case1.iml` | 自动生成 | IntelliJ/Android Studio 项目配置文件 |

### 1.2 pubspec.yaml 核心字段解析

```yaml
name: case1                          # 项目包名
description: "A new Flutter project." # 项目描述
publish_to: 'none'                   # 发布配置（none 表示私有项目）
version: 1.0.0+1                     # 版本号（1.0.0）+ 构建号（1）
environment:
  sdk: ^3.12.2                       # Dart SDK 版本约束

dependencies:                        # 运行时依赖
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8            # iOS 风格图标库

dev_dependencies:                    # 开发依赖
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0              # 代码风格检查规则

flutter:
  uses-material-design: true         # 使用 Material Design 图标
```

---

## 二、核心代码目录

### 2.1 lib/ - Dart 源码目录（核心）

```
lib/
└── main.dart          # 应用入口文件
```

| 文件/目录 | 作用说明 |
|-----------|----------|
| `main.dart` | **应用入口**，包含 `main()` 函数、根 Widget 定义（MyApp、MyHomePage） |

#### main.dart 核心结构

```dart
void main() {
  runApp(const MyApp());  // 启动应用
}

class MyApp extends StatelessWidget {
  // 应用级配置（主题、路由、首页）
}

class MyHomePage extends StatefulWidget {
  // 状态fulWidget 示例（计数器页面）
}
```

### 2.2 test/ - 测试目录

```
test/
└── widget_test.dart    # Widget 测试示例
```

---

## 三、平台原生工程目录

### 3.1 android/ - Android 平台工程

```
android/
├── app/
│   ├── build.gradle.kts       # 应用级构建配置（应用ID、版本、签名）
│   └── src/                   # Android 源码（MainActivity.kt）
├── gradle/
│   └── wrapper/               # Gradle Wrapper
├── build.gradle.kts           # 项目级构建配置
├── settings.gradle.kts        # 项目设置（模块包含）
├── gradle.properties          # Gradle 属性配置
├── local.properties           # 本地配置（SDK 路径，不提交）
├── gradlew                    # Gradle Wrapper 脚本（Unix）
└── gradlew.bat                # Gradle Wrapper 脚本（Windows）
```

| 核心文件 | 作用说明 |
|----------|----------|
| `app/build.gradle.kts` | **关键配置**：应用ID、版本号、最低SDK、签名配置、ProGuard规则 |
| `build.gradle.kts` (项目级) | 仓库配置、插件版本、依赖版本管理 |
| `settings.gradle.kts` | 模块包含配置 |

### 3.2 ios/ - iOS 平台工程

```
ios/
├── Runner/                    # 主应用 Target
│   ├── AppDelegate.swift      # 应用委托（Flutter 入口）
│   ├── Info.plist            # 应用配置（权限、URL Scheme）
│   ├── SceneDelegate.swift   # 场景委托（iOS 13+）
│   ├── Assets.xcassets/      # 资源目录（图标、启动图）
│   └── Base.lproj/           # 界面文件（LaunchScreen）
├── Runner.xcodeproj/         # Xcode 工程配置
│   └── project.pbxproj       # 工程配置文件
├── Runner.xcworkspace/       # Xcode 工作空间
├── RunnerTests/              # 单元测试
└── Flutter/
    ├── AppFrameworkInfo.plist    # Flutter 框架信息
    ├── Debug.xcconfig            # Debug 配置
    ├── Release.xcconfig          # Release 配置
    └── Generated.xcconfig        # 自动生成的配置
```

| 核心文件 | 作用说明 |
|----------|----------|
| `Runner/AppDelegate.swift` | **Flutter 引擎入口**，配置 FlutterViewController |
| `Runner/Info.plist` | **关键配置**：Bundle ID、权限声明、URL Scheme、后台模式 |
| `project.pbxproj` | Xcode 工程文件（Target、Build Settings） |

### 3.3 web/ - Web 平台

```
web/
├── index.html           # HTML 入口文件
├── manifest.json        # PWA 清单（应用名称、图标、主题色）
├── favicon.png          # 网站图标
└── icons/
    ├── Icon-192.png     # PWA 图标 192x192
    ├── Icon-512.png     # PWA 图标 512x512
    ├── Icon-maskable-192.png  # 可遮罩图标
    └── Icon-maskable-512.png
```

| 核心文件 | 作用说明 |
|----------|----------|
| `index.html` | **Web 入口**，加载 main.dart.js，配置 meta 标签 |
| `manifest.json` | PWA 配置（应用名称、启动图、显示模式） |

### 3.4 windows/ - Windows 平台

```
windows/
├── runner/
│   ├── main.cpp              # 应用入口
│   ├── flutter_window.cpp/h  # Flutter 窗口封装
│   ├── win32_window.cpp/h    # Win32 窗口封装
│   └── resources/            # Windows 资源（图标、清单）
├── flutter/
│   ├── generated_plugin_registrant.cc  # 插件注册（自动生成）
│   └── CMakeLists.txt
└── CMakeLists.txt            # CMake 构建配置
```

### 3.5 macos/ - macOS 平台

```
macos/
├── Runner/
│   ├── AppDelegate.swift        # 应用委托
│   ├── MainFlutterWindow.swift  # Flutter 窗口
│   ├── Info.plist              # 应用配置
│   ├── DebugProfile.entitlements  # Debug 权限
│   └── Release.entitlements       # Release 权限
├── Runner.xcodeproj/
├── Runner.xcworkspace/
└── RunnerTests/
```

### 3.6 linux/ - Linux 平台

```
linux/
├── runner/
│   ├── main.cc              # 应用入口
│   └── my_application.cc/h  # GTK 应用封装
├── flutter/
│   └── generated_plugin_registrant.cc
└── CMakeLists.txt
```

---

## 四、工具与 IDE 配置目录

### 4.1 .dart_tool/ - Dart 工具目录

```
.dart_tool/
├── package_config.json      # 包配置（依赖解析结果）
├── package_graph.json       # 包依赖图
├── version                  # Dart 工具版本
└── dartpad/
    └── web_plugin_registrant.dart  # Web 插件注册
```

**说明**：自动生成，记录依赖解析结果，加快后续编译速度。

### 4.2 .idea/ - IntelliJ/Android Studio 配置

```
.idea/
├── modules.xml              # 模块配置
├── workspace.xml            # 工作空间配置（窗口布局、运行配置）
├── libraries/
│   ├── Dart_SDK.xml         # Dart SDK 配置
│   └── KotlinJavaRuntime.xml
└── runConfigurations/
    └── main_dart.xml        # 运行配置
```

**说明**：IDE 配置，通常不提交到版本控制（团队协作场景）。

---

## 五、项目结构速查表

### 按功能分类

| 功能类别 | 目录/文件 | 核心职责 |
|----------|-----------|----------|
| **项目配置** | `pubspec.yaml` | 依赖管理、资源配置 |
| **代码分析** | `analysis_options.yaml` | Lint 规则、代码风格 |
| **Dart 源码** | `lib/` | Flutter 业务代码 |
| **测试代码** | `test/` | 单元测试、Widget 测试 |
| **Android** | `android/` | Android 原生工程 |
| **iOS** | `ios/` | iOS 原生工程 |
| **Web** | `web/` | Web 平台配置 |
| **Desktop** | `windows/`, `macos/`, `linux/` | 桌面平台原生工程 |
| **工具缓存** | `.dart_tool/` | Dart 编译缓存 |
| **IDE 配置** | `.idea/` | IntelliJ/Android Studio 配置 |

### 按开发频率分类

| 频率 | 目录/文件 | 说明 |
|------|-----------|------|
| **高频修改** | `lib/` | 日常业务开发 |
| **中频修改** | `pubspec.yaml`, `test/` | 添加依赖、编写测试 |
| **低频修改** | `android/app/build.gradle.kts`, `ios/Runner/Info.plist` | 平台配置、权限声明 |
| **几乎不修改** | `.dart_tool/`, `ios/Flutter/` | 自动生成文件 |
| **按需修改** | `web/`, `windows/`, `macos/`, `linux/` | 特定平台配置 |

---

## 六、核心文件详解（待展开）

以下文件是 Flutter 开发中需要重点理解的核心文件，后续可逐一展开：

1. **pubspec.yaml** - 项目清单文件详解
2. **lib/main.dart** - 应用入口与 Widget 树结构
3. **android/app/build.gradle.kts** - Android 构建配置详解
4. **ios/Runner/Info.plist** - iOS 应用配置详解
5. **analysis_options.yaml** - Dart 代码分析与 Lint 规则

---

## 七、典型开发流程中的文件使用

### 新建项目
```
flutter create case1
```
→ 生成上述完整目录结构

### 添加依赖
```yaml
# 编辑 pubspec.yaml
dependencies:
  http: ^1.0.0
```
```bash
flutter pub get
```
→ 更新 `pubspec.lock`、`.dart_tool/package_config.json`

### 运行应用
```bash
flutter run
```
→ 读取 `lib/main.dart`，调用平台工程编译

### 构建发布
```bash
flutter build apk      # Android
flutter build ios      # iOS
flutter build web      # Web
```
→ 产物输出到 `build/` 目录（未在当前结构中展示）

---

## 附录：关键文件快速定位

| 需求 | 文件路径 |
|------|----------|
| 修改应用名称 | `android/app/src/main/AndroidManifest.xml` → `android:label`<br>`ios/Runner/Info.plist` → `CFBundleName` |
| 修改应用ID/包名 | `android/app/build.gradle.kts` → `applicationId`<br>`ios/Runner.xcodeproj/project.pbxproj` → `PRODUCT_BUNDLE_IDENTIFIER` |
| 修改版本号 | `pubspec.yaml` → `version` |
| 添加第三方库 | `pubspec.yaml` → `dependencies` |
| 配置应用权限 | `android/app/src/main/AndroidManifest.xml`<br>`ios/Runner/Info.plist` |
| 添加资源文件 | `pubspec.yaml` → `flutter.assets` |
| 配置签名 | `android/app/build.gradle.kts` → `signingConfigs`<br>`ios/Runner.xcodeproj` → Signing & Capabilities |

---

> 文档版本：v1.0  
> 更新时间：2026-07-11  
> 适用项目：flutter-case/case1
