# Step 11：Android ViewRenderer 完整实现

## 目录

- [目标](#目标)
- [Step 11.1：拆出 ViewRenderer.kt](#step-111拆出-viewrendererkt)
- [Step 11.2：完整节点类型和样式映射](#step-112完整节点类型和样式映射)
- [Step 11.3：TitleBar 渲染](#step-113titlebar-渲染)
- [Step 11.4：setEvent 注册监听器](#step-114setevent-注册监听器)
- [Step 11.5：验证](#step-115验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**将 PlatformBridge 渲染指令映射为完整的 Android View 树。**

| 层 | 职责 | 文件 |
|---|---|---|
| ViewRenderer | 指令 → Android View | `ViewRenderer.kt`（从 QuickAppRuntime.kt 拆出） |
| TitleBar | 页面标题栏 | `TitleBarView.kt` |
| JNI Bridge | 新增 setEvent 命令 | `jni_bridge.cpp` 更新 |

**验收标准：**
- div → FrameLayout, text → TextView, input(button) → Button
- 文本内容、颜色、背景色、圆角正确
- TitleBar 显示"快应用示例模版"
- Button 注册了 click 监听器

**本步不包含：**
- 事件回调到 C++（Step 12）
- 页面切换（Step 13）

---

## Step 11.1：拆出 ViewRenderer.kt

@add `app/src/main/java/com/quickappkit/runtime/ViewRenderer.kt`（新建文件）

```kotlin
package com.quickappkit.runtime

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.*

class ViewRenderer(
    private val context: Context,
    private val container: FrameLayout,
) {
    private val viewMap = mutableMapOf<Int, View>()
    private var clickListener: ((Int) -> Unit)? = null

    companion object {
        private const val TAG = "ViewRenderer"
    }

    fun setClickListener(listener: (Int) -> Unit) { clickListener = listener }

    fun createElement(id: Int, type: String, x: Float, y: Float, width: Float, height: Float) {
        val view = when (type) {
            "div" -> FrameLayout(context)
            "text" -> TextView(context).apply { setTextColor(Color.BLACK); textSize = 16f }
            "input" -> Button(context)
            else -> { Log.e(TAG, "Unknown type: $type"); return }
        }

        view.layoutParams = FrameLayout.LayoutParams(width.toInt(), height.toInt(),
            Gravity.TOP or Gravity.START).apply {
            leftMargin = x.toInt()
            topMargin = y.toInt()
        }

        container.addView(view)
        viewMap[id] = view
        Log.i(TAG, "Created $type, id=$id, (${x},${y},${width},${height})")
    }

    fun setAttr(id: Int, key: String, value: String) {
        val view = viewMap[id] ?: return
        when {
            key == "text" && view is TextView -> view.text = value
            key == "value" && view is TextView -> view.text = value
            key == "type" -> {} // input type 已在 createElement 处理
            else -> Log.d(TAG, "Ignored attr: $key")
        }
    }

    fun setStyle(id: Int, key: String, value: String) {
        val view = viewMap[id] ?: return
        try {
            when (key) {
                "color" -> if (view is TextView) view.setTextColor(Color.parseColor(value))
                "backgroundColor" -> {
                    val bg = view.background
                    if (bg is GradientDrawable) bg.setColor(Color.parseColor(value))
                    else view.setBackgroundColor(Color.parseColor(value))
                }
                "fontSize" -> if (view is TextView) {
                    view.textSize = value.replace("px", "").toFloatOrNull() ?: 16f
                }
                "borderRadius" -> {
                    val radius = value.replace("px", "").toFloatOrNull() ?: 0f
                    val drawable = GradientDrawable().apply {
                        cornerRadius = radius
                        // 保留已有的背景色
                    }
                    view.background = drawable
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Style error: $key=$value", e)
        }
    }

    fun setEvent(id: Int, eventType: String, methodName: String) {
        val view = viewMap[id] ?: return
        if (eventType == "click") {
            view.setOnClickListener { clickListener?.invoke(id) }
            Log.i(TAG, "Event registered: id=$id, click→$methodName")
        }
    }

    fun clear() {
        container.removeAllViews()
        viewMap.clear()
    }
}
```

---

## Step 11.2：完整节点类型和样式映射

样式属性映射表：

| RPK 样式 | Android 实现 |
|---|---|
| fontSize | `textSize` (去掉 px 后直接作为 sp) |
| color | `setTextColor(Color.parseColor(...))` |
| backgroundColor | `setBackgroundColor` 或 GradientDrawable |
| borderRadius | `GradientDrawable.cornerRadius` |
| width/height | `LayoutParams` |
| marginTop | `LayoutParams.topMargin` |
| textAlign: center | `gravity = Gravity.CENTER` |

---

## Step 11.3：TitleBar 渲染

@add `app/src/main/java/com/quickappkit/runtime/TitleBarView.kt`（新建文件）

```kotlin
package com.quickappkit.runtime

import android.content.Context
import android.graphics.Color
import android.util.TypedValue
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView

class TitleBarView(context: Context) : FrameLayout(context) {
    private val titleText = TextView(context)

    init {
        // 高度 56dp
        val height = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 56f,
            context.resources.displayMetrics).toInt()
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, height)

        titleText.gravity = Gravity.CENTER
        titleText.textSize = 18f
        addView(titleText, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    fun setTitle(text: String) { titleText.text = text }
    fun setTitleColor(color: String) { titleText.setTextColor(Color.parseColor(color)) }
    fun setBarColor(color: String) { setBackgroundColor(Color.parseColor(color)) }
}
```

---

## Step 11.4：setEvent 注册监听器

PlatformBridge 新增 `setEvent` 命令：

@update `core/include/platform_bridge.h` — 在 SetStyleFn 之后新增：

```cpp
    /** 注册事件监听 */
    using SetEventFn = void (*)(int id, const char* eventType, const char* methodName);
    SetEventFn setEvent = nullptr;
```

对应 JNI 实现和 Kotlin 方法按 createElement 的模式添加。

---

## Step 11.5：验证

完整渲染指令序列后，Android 屏幕显示：
- TitleBar：快应用示例模版（灰色背景）
- 文本：欢迎体验快应用开发（黑色 40px）
- 按钮：跳转到详情页（绿色圆角白字）

---

## 技术决策

1. **ViewRenderer 独立类** — 从 QuickAppRuntime 拆出，职责单一
2. **GradientDrawable 实现圆角** — Android View System 的标准做法
3. **px 直传** — V1 不做 dp 转换，保持简单

---

## QA

### 1. 为什么不用 RecyclerView？
快应用页面节点少（通常 <50），直接 addView 到 FrameLayout 足够。RecyclerView 是列表优化方案，不适合这个场景。

### 2. 样式有冲突怎么办？
后设置的覆盖先设置的。和 CSS 的行为一致。

---

## 下一步

Step 11 后 Android 能显示完整页面。Step 12 串通反向事件通道。
