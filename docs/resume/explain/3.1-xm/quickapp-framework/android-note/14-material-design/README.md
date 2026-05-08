# 14. Material Design

> Google 的设计规范、组件体系、主题系统。

## 目录

- [一、Material Design 是什么](#一material-design-是什么)
- [二、核心组件](#二核心组件)
- [三、主题与样式系统](#三主题与样式系统)
- [四、和前端 Design System 的对比](#四和前端-design-system-的对比)

---

## 一、Material Design 是什么

Google 的设计语言规范，定义了 UI 组件的外观、交互、动画标准。类比前端的 Ant Design / Material UI，但它是"规范"不是"库"——规范定义了按钮应该长什么样、怎么交互，具体实现由各平台的组件库完成。

| 版本 | 时间 | 特点 |
|------|------|------|
| Material Design 1 | 2014 | 卡片、阴影、涟漪动画 |
| Material Design 2 | 2018 | 更圆润、底部导航、FAB |
| **Material Design 3 (Material You)** | 2021 | 动态取色（壁纸颜色）、更大圆角 |

---

## 二、核心组件

| 组件 | 说明 | 类比前端 |
|------|------|---------|
| TopAppBar | 顶部导航栏 | Header / Navbar |
| BottomNavigation | 底部 Tab 栏 | TabBar |
| FloatingActionButton (FAB) | 悬浮操作按钮 | 固定位置的 Action Button |
| Card | 卡片容器 | Card 组件 |
| Snackbar | 底部临时提示 | Toast / Message |
| Dialog | 对话框 | Modal / Dialog |
| BottomSheet | 底部弹出面板 | Drawer（从底部） |
| Chip | 标签/筛选器 | Tag |
| NavigationDrawer | 侧边抽屉导航 | Sidebar |
| TextField | 输入框（带浮动标签） | Input |

### 实现库

- **MDC (Material Components for Android)**：官方实现库
- **Jetpack Compose Material3**：Compose 版本的 Material 组件

---

## 三、主题与样式系统

### Theme（主题）

全局样式配置，定义颜色、字体、形状等：

```xml
<!-- res/values/themes.xml -->
<style name="AppTheme" parent="Theme.Material3.DayNight">
    <item name="colorPrimary">@color/purple_500</item>
    <item name="colorSecondary">@color/teal_200</item>
    <item name="android:fontFamily">@font/roboto</item>
</style>
```

类比前端：CSS 变量 / Design Token

```css
:root {
    --color-primary: #6200EE;
    --color-secondary: #03DAC6;
    --font-family: 'Roboto', sans-serif;
}
```

### Style（样式）

单个 View 的样式复用：

```xml
<style name="ButtonPrimary">
    <item name="android:background">@color/primary</item>
    <item name="android:textColor">@color/white</item>
    <item name="android:padding">16dp</item>
</style>

<Button style="@style/ButtonPrimary" />
```

类比前端：CSS class。

### Material You 动态取色

Android 12+ 从用户壁纸提取主色调，自动应用到 App 的 Material 组件上。App 不需要做任何事，系统自动处理。

---

## 四、和前端 Design System 的对比

| 维度 | Material Design (Android) | Ant Design (前端) |
|------|--------------------------|-------------------|
| 定位 | 设计规范 + 官方组件库 | 设计规范 + 组件库 |
| 主题 | Theme XML / Compose Theme | ConfigProvider / CSS 变量 |
| 组件 | MDC / Compose Material | antd 组件 |
| 响应式 | 无（Android 不需要响应式布局） | 栅格系统 |
| 暗色模式 | DayNight 主题自动切换 | CSS prefers-color-scheme |
| 动画 | MotionLayout / Transition | CSS Transition / Framer Motion |

### 快应用框架和 Material Design 的关系

快应用框架的 UI 是开发者自己写的（CSS 子集 → 原生 View），不强制使用 Material Design。但框架底层渲染出来的是 Android 原生 View，所以可以使用 Material 组件。

实际上快应用更接近 Web 的设计体系——开发者用 CSS 控制样式，不依赖 Material 规范。


---

## 五、Dark Theme 适配（混合应用视角）

### 为什么 Dark Theme 在混合应用里是个难题

混合应用有多个渲染层，每层的暗色适配方式不同，需要统一协调：

```
┌─────────────────────────────────────────┐
│ Native 层（Android View）                │ → Theme.DayNight + 资源限定符
├─────────────────────────────────────────┤
│ WebView 层（H5 页面）                    │ → CSS prefers-color-scheme + meta
├─────────────────────────────────────────┤
│ RN / Flutter 层（跨端 UI）               │ → 各自的 Theme 系统
├─────────────────────────────────────────┤
│ 快应用框架层（CSS → Native View）        │ → 框架需要桥接系统主题到 JS 层
└─────────────────────────────────────────┘
```

### Native 层适配

#### 1. 使用 DayNight 主题

```xml
<!-- res/values/themes.xml（亮色） -->
<style name="AppTheme" parent="Theme.Material3.DayNight">
    <item name="colorPrimary">@color/primary_light</item>
    <item name="colorSurface">@color/surface_light</item>
    <item name="android:windowBackground">@color/background_light</item>
</style>

<!-- res/values-night/themes.xml（暗色，系统自动切换） -->
<style name="AppTheme" parent="Theme.Material3.DayNight">
    <item name="colorPrimary">@color/primary_dark</item>
    <item name="colorSurface">@color/surface_dark</item>
    <item name="android:windowBackground">@color/background_dark</item>
</style>
```

#### 2. 资源限定符

```
res/
├── values/colors.xml          ← 亮色颜色
├── values-night/colors.xml    ← 暗色颜色
├── drawable/icon.png          ← 亮色图标
└── drawable-night/icon.png    ← 暗色图标
```

系统根据当前模式自动选择对应资源，不需要代码判断。

#### 3. 代码中判断当前模式

```kotlin
val isDarkMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
```

#### 4. 强制指定模式

```kotlin
// 跟随系统（默认）
AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
// 强制亮色
AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
// 强制暗色
AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
```

### WebView 层适配

#### 1. CSS 媒体查询

```css
/* 亮色（默认） */
body { background: #ffffff; color: #333333; }

/* 暗色 */
@media (prefers-color-scheme: dark) {
    body { background: #1a1a1a; color: #e0e0e0; }
}
```

#### 2. Android WebView 强制暗色（Android 13+）

```kotlin
// 让 WebView 自动反转颜色（不需要 H5 适配）
if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
    WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, true)
}
```

#### 3. 通过 JS Bridge 通知 H5 当前主题

```kotlin
// Native 侧检测主题变化 → 通知 WebView
webView.evaluateJavascript("window.setTheme('${if (isDark) "dark" else "light"}')", null)
```

### RN 层适配

```javascript
// React Native
import { useColorScheme } from 'react-native';

function App() {
    const colorScheme = useColorScheme(); // 'light' | 'dark'
    const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
    return <ThemeProvider theme={theme}>...</ThemeProvider>;
}
```

RN 的 `useColorScheme()` 底层读的就是 Android 系统的 UI_MODE_NIGHT 配置。

### Flutter 层适配

```dart
MaterialApp(
    theme: ThemeData.light(),      // 亮色主题
    darkTheme: ThemeData.dark(),   // 暗色主题
    themeMode: ThemeMode.system,   // 跟随系统
)
```

Flutter 自绘引擎，不依赖 Android View 系统，但通过 Platform Channel 读取系统主题设置。

### 快应用框架层适配

快应用框架需要把系统主题状态桥接到 JS 层：

```
系统主题变化（Configuration.uiMode）
  ↓ Native 监听 onConfigurationChanged
  ↓ 通过 Bridge 通知 JS 层
  ↓ JS 层更新 CSS 变量 / 触发重渲染
  ↓ 渲染指令 → Native View 更新
```

开发者在 JS 侧可以通过 `@media (prefers-color-scheme: dark)` 或框架提供的 API 获取当前主题。

### 统一适配策略（混合应用最佳实践）

```
1. 定义统一的 Design Token（颜色/间距/圆角）
   - 亮色 Token 集
   - 暗色 Token 集

2. 各层消费同一套 Token
   - Native：通过 Theme 属性引用
   - WebView：通过 CSS 变量
   - RN/Flutter：通过 Theme Provider
   - 快应用：通过 CSS 变量 / JS API

3. 主题切换时统一通知
   - 系统主题变化 → Native 层感知
   - Native 通知 WebView（evaluateJavascript）
   - Native 通知 RN（Appearance API 自动感知）
   - Native 通知快应用 JS 层（Bridge）

4. 过渡动画
   - 切换时避免闪白/闪黑
   - 可以用 Activity 级别的 transition 或 View 级别的 alpha 动画
```

### 常见坑

| 坑 | 原因 | 解决 |
|---|------|------|
| WebView 闪白 | WebView 默认白色背景，暗色页面加载前会闪白 | 设置 WebView 背景色为暗色 |
| 启动页闪白 | windowBackground 没适配暗色 | values-night 里设置暗色 windowBackground |
| 图片不适配 | 亮色图标在暗色背景上看不清 | 提供 drawable-night 版本或用 tint 着色 |
| 第三方 SDK 不适配 | SDK 内部 View 硬编码了颜色 | 只能等 SDK 更新或用 Force Dark |
| 状态栏/导航栏颜色 | 暗色模式下状态栏图标要变白 | `WindowInsetsController.setAppearanceLightStatusBars(false)` |
