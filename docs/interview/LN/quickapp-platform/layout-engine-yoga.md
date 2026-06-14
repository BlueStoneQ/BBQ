# 布局引擎 — Yoga Flexbox

> 本质：CSS 的 `flex-direction: column; padding: 20px` 怎么变成屏幕上的 x=0, y=0, width=1080, height=200？答案是 Yoga — Facebook 开源的跨平台 Flexbox 布局引擎。

---

## 1. 布局引擎在架构中的位置

```
JS 侧:  style JSON → Listener → Action(updateStyle) → callNative
                                                          │
Native:  RenderActionManager → Widget.setStyle()          │
                                    │                     │
                                    ▼                     │
         YogaNode.setFlexDirection(ROW)  ←────────────────┘
         YogaNode.setPadding(20)
         YogaNode.setWidth(...)
                    │
                    ▼
         YogaNode.calculateLayout()   ← Yoga C++ 核心计算
                    │
                    ▼
         node.getLayoutX() / getLayoutY() / getLayoutWidth() / getLayoutHeight()
                    │
                    ▼
         Android View.layout(left, top, right, bottom)
                    │
                    ▼
         屏幕像素渲染
```

---

## 2. 什么是 Yoga

- **来源**：Facebook 开源（2016），C++ 实现
- **功能**：纯计算引擎，输入 CSS Flexbox 属性，输出 x/y/width/height
- **特点**：不依赖任何平台 API，跨 Android/iOS/Windows
- **性能**：C++ 实现 + JNI 调用，比 Java 手写布局快
- **快应用使用的版本**：`yoga-1.5.0-16kb-aligned.aar`（预编译的 AAR）

---

## 3. Yoga 在快应用中的使用方式

### 3.1 每个 View 对应一个 YogaNode

```java
// PercentFlexboxLayout.java（快应用的核心容器 View）
public class PercentFlexboxLayout extends YogaLayout implements ComponentHost {

    public PercentFlexboxLayout(Context context) {
        super(context);
        // 默认 flex-direction: row
        getYogaNode().setFlexDirection(YogaFlexDirection.ROW);
        getYogaNode().setFlexShrink(1f);
    }
}
```

### 3.2 样式属性 → YogaNode 属性

当 JS 侧发送 `updateStyle` Action 时：

```
Action: { method: "updateStyle", args: [ref, { style: { flexDirection: "column", padding: "20px" } }] }
    │
    ▼
Widget.setStyle("flexDirection", "column")
    → yogaNode.setFlexDirection(YogaFlexDirection.COLUMN)

Widget.setStyle("padding", "20px")
    → yogaNode.setPadding(YogaEdge.ALL, 20)
```

### 3.3 布局计算触发

```java
// 当 View 树变更后，Android 的 View 系统触发 onMeasure
@Override
protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
    // Yoga 计算整棵子树的布局
    getYogaNode().calculateLayout(width, height);
}

@Override
protected void onLayout(boolean changed, int l, int t, int r, int b) {
    // 递归应用 Yoga 计算结果到各子 View
    applyLayoutRecursive(getYogaNode(), 0, 0);
}

// applyLayoutRecursive: 遍历 YogaNode 树，将计算结果设置到对应 View
private void applyLayoutRecursive(YogaNode node, float xOffset, float yOffset) {
    View view = (View) node.getData();
    float left = node.getLayoutX() + xOffset;
    float top = node.getLayoutY() + yOffset;
    float right = left + node.getLayoutWidth();
    float bottom = top + node.getLayoutHeight();
    view.layout((int)left, (int)top, (int)right, (int)bottom);

    for (int i = 0; i < node.getChildCount(); i++) {
        applyLayoutRecursive(node.getChildAt(i), left, top);
    }
}
```

---

## 4. 支持的 CSS 子集

快应用不支持完整 CSS，只支持 Flexbox 子集：

| CSS 属性 | YogaNode API | 说明 |
|---------|-------------|------|
| `flex-direction` | `setFlexDirection()` | row / column |
| `justify-content` | `setJustifyContent()` | 主轴对齐 |
| `align-items` | `setAlignItems()` | 交叉轴对齐 |
| `flex` | `setFlex()` | 弹性比例 |
| `flex-wrap` | `setWrap()` | 换行 |
| `width / height` | `setWidth() / setHeight()` | 尺寸 |
| `min-width / max-width` | `setMinWidth() / setMaxWidth()` | 约束 |
| `margin` | `setMargin()` | 外边距 |
| `padding` | `setPadding()` | 内边距 |
| `position: absolute` | `setPositionType(ABSOLUTE)` | 绝对定位 |
| `left / top / right / bottom` | `setPosition()` | 定位偏移 |

**不支持的**：float、inline-block、grid、table 等传统 CSS 布局。

---

## 5. 性能特点

| 维度 | 说明 |
|------|------|
| 计算层 | C++ 实现（通过 JNI 调用），比纯 Java 快 |
| 增量计算 | `yogaNode.dirty()` 标记脏节点，只重算受影响的子树 |
| 内存 | 每个 View 一个 YogaNode（C++ 对象 + JNI wrapper） |
| 线程 | 布局计算在 UI 线程（onMeasure/onLayout 阶段） |

---

## 6. 和其他方案的对比

| 布局引擎 | 使用者 | 实现语言 | 特点 |
|---------|--------|---------|------|
| **Yoga** | 快应用 / RN / Litho | C++ | Flexbox only，跨平台，成熟 |
| **Taffy** | Dioxus / Bevy | Rust | Flexbox + Grid，新生代 |
| **Android ConstraintLayout** | 原生 Android | Java | 强大但不跨平台 |
| **Flutter RenderObject** | Flutter | Dart | 自研，支持任意布局协议 |
| **CSS 引擎 (Blink)** | WebView / Chrome | C++ | 完整 CSS，但太重 |

---

## 7. 落地启示

- **如果做 Native View 渲染**：直接用 Yoga（npm: `yoga-layout`，Android: yoga AAR），零开发成本
- **如果做 Flutter 渲染**：不需要 Yoga，Flutter 自带 RenderObject 布局系统
- **如果做自绘引擎**：可以用 Taffy (Rust) 或 Yoga (C)，只负责计算，渲染你自己画
- **约束**：选了 Yoga 就意味着只能支持 Flexbox，开发者不能用 Grid / float / table
