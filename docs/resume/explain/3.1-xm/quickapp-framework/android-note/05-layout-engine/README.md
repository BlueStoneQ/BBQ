# 05. 布局引擎

> Android 布局系统 + 快应用框架的布局方案。

## 目录

- [一、Android 原生布局系统](#一android-原生布局系统)
- [二、布局的本质：约束求解](#二布局的本质约束求解)
- [三、跨端框架的布局方案对比](#三跨端框架的布局方案对比)
- [四、快应用框架的布局方案](#四快应用框架的布局方案)
- [五、布局性能优化](#五布局性能优化)

---

## 一、Android 原生布局系统

### 核心流程：Measure → Layout → Draw

```
View 树
  ↓ Measure（测量：每个 View 多大）
  ↓ Layout（布局：每个 View 放在哪）
  ↓ Draw（绘制：画到屏幕上）
```

类比前端：
- Measure = CSS 计算（确定每个元素的 width/height）
- Layout = Reflow（确定每个元素的 x/y 位置）
- Draw = Repaint（渲染像素）

### 常用布局容器

| 布局 | 说明 | 类比前端 |
|------|------|---------|
| LinearLayout | 线性排列（水平/垂直） | `flex-direction: row/column` |
| FrameLayout | 层叠（后面的盖在前面上） | `position: absolute` 堆叠 |
| RelativeLayout | 相对定位（相对于兄弟/父容器） | `position: relative` + 各种 margin |
| ConstraintLayout | 约束布局（声明式约束关系） | CSS Grid + Flexbox 的结合体 |
| RecyclerView | 可回收列表（虚拟滚动） | 虚拟列表（react-window） |

### View 的测量规格（MeasureSpec）

父容器告诉子 View "你可以多大"：

| 模式 | 含义 | 类比 |
|------|------|------|
| EXACTLY | 精确尺寸（match_parent 或固定 dp） | `width: 100px` |
| AT_MOST | 最大不超过（wrap_content） | `max-width: 100px` |
| UNSPECIFIED | 随便多大（ScrollView 内） | 无约束 |

---

## 二、布局的本质：约束求解

不管是 CSS Flexbox、Android ConstraintLayout、还是 Yoga，布局的本质都是同一件事：

**给定一组约束条件（父容器大小、子元素的 flex/weight/margin/padding），求解每个元素的最终位置和尺寸。**

区别只在于：
- 约束的表达方式不同（CSS 属性 vs XML 属性 vs Yoga API）
- 求解算法不同（浏览器布局引擎 vs Android 布局引擎 vs Yoga）
- 执行环境不同（浏览器 C++ vs Android Java/C++ vs JS/Native）

---

## 三、跨端框架的布局方案对比

| 框架 | 布局引擎 | 执行位置 | 布局语言 | 渲染层 |
|------|---------|---------|---------|--------|
| Web | 浏览器内置（Blink） | C++（浏览器进程） | CSS | HTML DOM |
| RN | Yoga（Facebook） | C++（Native 侧） | Flexbox 子集 | 原生 View |
| Flutter | 自研（Dart） | Dart VM | Widget 约束 | Skia 自绘 |
| 快应用框架 | Android 原生布局 | Java（UI Thread） | CSS 子集 → 映射到 Android 属性 | 原生 View |
| 小程序 | WebView 内置 | C++（WebView） | CSS | WebView DOM |

### 快应用框架 vs RN 的布局差异

| | RN | 快应用框架 |
|---|---|---|
| 布局引擎 | Yoga（独立 C++ 库） | Android 原生布局系统 |
| 布局计算位置 | Native 侧（C++） | UI Thread（Java） |
| 布局语言 | Flexbox（JS 对象描述） | CSS 子集（编译时转换为 Android 属性） |
| 优点 | 跨平台一致（iOS/Android 同一个 Yoga） | 无额外引擎开销，直接用系统能力 |
| 缺点 | 需要集成 Yoga 库（增加包体） | 平台差异需要适配 |

---

## 四、快应用框架的布局方案

### 从 CSS 到 Android View 的映射

开发者写 CSS 子集 → 编译时/运行时转换为 Android View 属性：

```
开发者写的：
<div style="display: flex; flex-direction: row; justify-content: center;">
  <text style="font-size: 16px; color: #333;">Hello</text>
</div>

转换为 Android：
LinearLayout (orientation=HORIZONTAL, gravity=CENTER)
  └── TextView (textSize=16sp, textColor=#333333)
```

### CSS 属性到 Android 属性的映射表

| CSS | Android | 说明 |
|-----|---------|------|
| `display: flex` | LinearLayout / FlexboxLayout | 容器类型 |
| `flex-direction: row` | `orientation=HORIZONTAL` | 排列方向 |
| `flex-direction: column` | `orientation=VERTICAL` | 排列方向 |
| `justify-content: center` | `gravity=CENTER` | 主轴对齐 |
| `align-items: center` | `gravity=CENTER_VERTICAL` | 交叉轴对齐 |
| `width: 100px` | `width=100dp` | 宽度（px→dp 转换） |
| `margin: 10px` | `marginStart/End/Top/Bottom=10dp` | 外边距 |
| `padding: 10px` | `paddingStart/End/Top/Bottom=10dp` | 内边距 |
| `position: absolute` | FrameLayout + margin 定位 | 绝对定位 |
| `overflow: scroll` | ScrollView / RecyclerView | 滚动 |
| `border-radius` | GradientDrawable + clipToOutline | 圆角 |

### 渲染指令格式

JS 侧 diff 后产出的渲染指令（JSON）：

```json
{
  "action": "createView",
  "viewType": "LinearLayout",
  "id": 1,
  "parentId": 0,
  "props": {
    "orientation": "horizontal",
    "gravity": "center",
    "width": "match_parent",
    "height": "wrap_content"
  }
}
```

IO Thread 解析这个 JSON → UI Thread 执行：
```java
LinearLayout layout = new LinearLayout(context);
layout.setOrientation(LinearLayout.HORIZONTAL);
layout.setGravity(Gravity.CENTER);
layout.setLayoutParams(new LayoutParams(MATCH_PARENT, WRAP_CONTENT));
parentView.addView(layout);
```

---

## 五、布局性能优化

### 减少布局层级

```
差：嵌套 5 层 LinearLayout
  LinearLayout
    LinearLayout
      LinearLayout
        LinearLayout
          TextView

好：用 ConstraintLayout 扁平化
  ConstraintLayout
    TextView（通过约束定位）
```

层级越深，Measure/Layout 递归越深，性能越差。

### 避免 requestLayout 风暴

每次修改 View 属性（宽高/margin/visibility）都会触发 requestLayout → 整棵子树重新 Measure + Layout。

优化：批量修改属性后统一触发一次布局，不要逐个修改逐个触发。

快应用框架的做法：JS 侧攒一批渲染指令，一次性发给 UI Thread 执行，而不是每个属性变更都跨一次 Bridge。

### RecyclerView = 虚拟滚动

长列表不创建所有 View，只创建可见区域的 View，滚动时回收复用：

```
屏幕可见 5 个 item → 只创建 7 个 View（5 + 上下各 1 个缓冲）
滚动时：顶部滑出的 View 被回收 → 底部新出现的 View 复用回收的 View
```

和前端虚拟列表（react-window / vue-virtual-scroller）完全一样的思路。
