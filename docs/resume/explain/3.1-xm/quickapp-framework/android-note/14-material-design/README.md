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
