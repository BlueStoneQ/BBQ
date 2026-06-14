# 组件注册表 — Widget 体系

> 本质：当 JS 说"创建一个 `<text>` 节点"时，Native 怎么知道该 new 哪个 Java 类？答案是 Widget 注册表 — tagName 到 Java Component 类的映射。

---

## 1. 组件注册表在架构中的位置

```
JS 侧:
  template JSON: { type: "text", attr: { value: "Hello" } }
  → Listener: addElement(parentRef, { type: "text", ... }, index)
  → callNative(actions)

Native 侧:
  RenderActionManager 解析 Action
  → action.tagName = "text"
  → ComponentFactory.createComponent("text", ...)
      → Widget widget = ComponentManager.getWidgetMap().get("text")
      → widget.createComponent(...)  // 创建真正的 Java Component
      → Component 创建 Android View（TextView）
      → parent.addView(textView)
```

---

## 2. 核心类关系

```
ComponentManager          — 管理全局 Widget 注册表（Map<String, Widget>）
  │
  ├── Widget              — tagName 的元数据（名称、类引用、方法列表）
  │     │
  │     └── Component     — 真正的组件实例（持有 Android View）
  │           │
  │           ├── Text    — <text> 标签的实现
  │           ├── Image   — <image> 标签的实现
  │           ├── Div     — <div> 标签的实现（Container）
  │           └── List    — <list> 标签的实现（RecyclerView）
  │
  └── ComponentFactory    — 根据 tagName 查表创建 Component 实例
```

---

## 3. ComponentFactory — 查表创建

```java
// ComponentFactory.java
public class ComponentFactory {

    public static Component createComponent(
        HapEngine hapEngine, Context context,
        String element,        // tagName，如 "text" / "image" / "div"
        Container parent,
        int ref,               // 节点引用 ID
        RenderEventCallback callback,
        Map<String, Object> componentInfo,
        Map<String, Object> savedState
    ) {
        // 特殊处理 body 节点
        if ("body".equals(element)) {
            return new Scroller(hapEngine, context, parent, ref, callback, savedState);
        }

        // 从注册表查找对应的 Widget
        Widget widget = getWidget(element, componentInfo);

        if (widget != null) {
            // 用 Widget 创建 Component 实例
            return widget.createComponent(hapEngine, context, parent, ref, callback, componentInfo, savedState);
        } else {
            // 未知标签 → 创建占位 Unsupported 组件
            callback.onJsException(new IllegalArgumentException("Unsupported element:" + element));
            return new Unsupported(hapEngine, context, parent, ref, callback, savedState);
        }
    }

    private static Widget getWidget(String tagName, Map<String, Object> componentInfo) {
        // 从 ComponentManager 的全局 Map 中查找
        String type = componentInfo.get("type");  // 如 type="date" 区分同 tagName 的不同类型
        Widget widget = ComponentManager.getWidgetMap().get(Widget.getComponentKey(tagName, type));
        return widget;
    }
}
```

---

## 4. Widget 注册机制

### 4.1 注册到 JS 侧

Android 启动时，将所有可用组件列表注册到 JS 引擎：

```java
// ComponentRegistry.java
String components = ComponentManager.getWidgetListJSONString();
// components = '[{"name":"text","methods":["focus","animate"]}, {"name":"image","methods":[...]}, ...]'
engine.registerComponents(components);
```

JS 侧收到后存入 runtime 的组件注册表，用于模板编译时校验 tagName 是否合法。

### 4.2 内置组件列表（50+ 个）

| 类型 | 组件 |
|------|------|
| 基础 | text, span, a, image, progress, rating |
| 容器 | div, list, list-item, swiper, tabs, tab-bar, tab-content, stack, popup, refresh |
| 表单 | input, textarea, picker, slider, switch, label, select, option |
| 媒体 | video, audio, canvas, web, map |
| 其他 | marquee, richtext, lottie |

### 4.3 组件方法注册

每个 Widget 不仅注册 tagName，还声明支持的方法：

```json
{
  "name": "input",
  "methods": ["focus", "blur", "select"],
  "types": ["text", "password", "number", "date"]
}
```

JS 侧调用 `element.focus()` 时，通过 `invokeComponentMethod` Action 传到 Native，找到对应的 Java 方法执行。

---

## 5. Component 的生命周期

```
ComponentFactory.createComponent("text", ...)
  │
  ├── new Text(hapEngine, context, parent, ref, callback)
  │     │
  │     ├── createView()    → new TextView(context)   // 创建 Android View
  │     ├── bindAttrs()     → setText("Hello")        // 设置属性
  │     ├── bindStyles()    → setTextColor(0xFF000000) // 设置样式
  │     └── bindEvents()    → setOnClickListener(...) // 注册事件
  │
  ├── parent.addView(textView, index)   // 加入 View 树
  │
  └── yogaNode 配置 → 布局计算 → 屏幕渲染
```

### 更新阶段

```
Action: updateAttrs(ref, { attr: { value: "World" } })
  → 找到 ref 对应的 Component
  → component.setAttr("value", "World")
  → textView.setText("World")

Action: updateStyle(ref, { style: { color: "#f00" } })
  → component.setStyle("color", "#f00")
  → textView.setTextColor(Color.RED)
  → yogaNode.dirty() → requestLayout()
```

---

## 6. 扩展机制 — 自定义原生组件

快应用支持通过 Feature 插件机制注册第三方原生组件：

```
1. 开发者写一个 Java Component 子类
2. 通过 @WidgetAnnotation 或 ComponentManager.register() 注册
3. JS 侧就可以用 <my-component> 标签
4. 编译时会自动校验（因为 registerComponents 已经告诉了 JS 有哪些合法标签）
```

---

## 7. 和其他框架的对比

| 框架 | 组件注册方式 | 组件实现 |
|------|------------|---------|
| 快应用 | `ComponentManager.getWidgetMap()` Java Map | Java Component 子类 |
| React Native | `UIManagerModule.registerViewManager()` | Java ViewManager 子类 |
| Flutter | Widget 类继承（编译时确定） | Dart Widget + RenderObject |
| 微信小程序 | 内置组件表（不可扩展） | C++ 渲染内核 |

---

## 8. 落地启示

- **注册表模式是必须的**：不管你用什么技术栈，都需要一个 tagName → NativeView 的映射表
- **方法注册**：组件不只是 View，还有可被 JS 调用的方法（focus/blur/scrollTo 等）
- **可扩展性**：设计时就要考虑第三方组件的注册入口，否则后期很难加
- **如果走 Flutter**：不需要注册表，因为 Widget 是 Dart 类，直接用工厂模式 `switch(tagName)` 即可
- **类型系统**：同一个 tagName 可能有多种 type（如 `<input type="text">` vs `<input type="date">`），注册表要支持复合 key
