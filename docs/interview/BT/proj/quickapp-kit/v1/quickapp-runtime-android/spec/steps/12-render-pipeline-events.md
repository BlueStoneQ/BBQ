# Step 12：完整渲染管线与事件回调

## 目录

- [目标](#目标)
- [Step 12.1：串通完整渲染链路](#step-121串通完整渲染链路)
- [Step 12.2：Android → C++ 点击事件通道](#step-122android--c-点击事件通道)
- [Step 12.3：事件投递到 Runtime Thread](#step-123事件投递到-runtime-thread)
- [Step 12.4：JS VM 方法调用](#step-124js-vm-方法调用)
- [Step 12.5：验证](#step-125验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**串通 RPK → JS → C++ → Android 的完整渲染，并实现反向点击事件链路。**

| 层 | 职责 | 文件 |
|---|---|---|
| 渲染管线 | VNode → Yoga → PlatformBridge 指令 | `js_bridge.cpp` 中 native_render 升级 |
| 事件通道 | Android click → JNI → RuntimeThread → JS | `jni_bridge.cpp` + `ViewRenderer.kt` |

**验收标准：**
- Demo 页面从 RPK 到屏幕完整显示
- 点击"跳转到详情页"按钮，Logcat 显示 JS 的 onDetailBtnClick 被调用
- 事件在 Runtime Thread 处理，不在 UI Thread 执行 JS

**本步不包含：**
- 真正的页面导航（Step 13）
- 数据变更触发重渲染

---

## Step 12.1：串通完整渲染链路

@update `core/src/js_bridge.cpp` 中 `native_render` — 完整实现：

```cpp
static JSValue native_render(JSContext* ctx, JSValueConst this_val,
                              int argc, JSValueConst* argv) {
    if (argc < 2) return JS_UNDEFINED;
    LOGI("__native_render__: building VNode tree");

    // 1. JS template → C++ VNode
    auto root = buildVNode(ctx, argv[0]);

    // 2. 解析样式表
    auto styleSheet = quickapp::parseStyleSheet(ctx, argv[1]);

    // 3. 应用样式到 VNode
    quickapp::resolveStyles(root.get(), styleSheet);

    // 4. Yoga 布局
    quickapp::calculateLayout(root.get(), 1080.0f, 1920.0f);

    // 5. 遍历 VNode 树，发送 PlatformBridge 渲染指令
    const auto& bridge = quickapp::getPlatformBridge();
    if (!bridge.isReady()) { LOGE("PlatformBridge not ready"); return JS_UNDEFINED; }

    // 递归发送指令
    std::function<void(quickapp::VNode*)> emitCommands = [&](quickapp::VNode* node) {
        bridge.createElement(node->id, node->type.c_str(),
                             node->x, node->y, node->width, node->height);

        for (auto& [key, value] : node->attrs) {
            bridge.setAttr(node->id, key.c_str(), value.c_str());
        }

        for (auto& [key, value] : node->styles) {
            bridge.setStyle(node->id, key.c_str(), value.c_str());
        }

        for (auto& [eventType, methodName] : node->events) {
            if (bridge.setEvent) {
                bridge.setEvent(node->id, eventType.c_str(), methodName.c_str());
            }
        }

        for (auto& child : node->children) {
            emitCommands(child.get());
        }
    };

    emitCommands(root.get());
    LOGI("Render commands emitted for %zu nodes", /* count */);

    return JS_UNDEFINED;
}
```

---

## Step 12.2：Android → C++ 点击事件通道

当 ViewRenderer 的 clickListener 触发时，通过 JNI 通知 C++。

@update `jni_bridge.cpp` — 在 `extern "C"` 块中新增：

```cpp
// Android → C++ 事件入口
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeDispatchClick(
        JNIEnv* env, jobject thiz, jint nodeId) {
    LOGI("Click event received: nodeId=%d", nodeId);

    // 必须投递到 Runtime Thread 执行，不能在 JNI 线程直接调 QuickJS
    if (g_runtimeThread) {
        g_runtimeThread->post([nodeId]() {
            // Step 12.4 中实现 JS 调用
            quickapp::dispatchClickToJS(nodeId);
        });
    }
}
```

@update `QuickAppRuntime.kt` — 新增：

```kotlin
    private external fun nativeDispatchClick(nodeId: Int)
```

@update `ViewRenderer.kt` — clickListener 中调用：

```kotlin
    fun setClickListener(listener: (Int) -> Unit) { clickListener = listener }
    // 在 QuickAppRuntime 初始化时：
    // viewRenderer.setClickListener { nodeId -> nativeDispatchClick(nodeId) }
```

---

## Step 12.3：事件投递到 Runtime Thread

事件链路保证线程安全：

```text
Android UI Thread                    Runtime Thread
    │                                    │
    │ Button.onClick(nodeId=2)           │
    │ → nativeDispatchClick(2)           │
    │ → g_runtimeThread->post(...)       │
    │                                    │ ← 任务被唤醒执行
    │                                    │ dispatchClickToJS(2)
    │                                    │ → 查找 VNode events
    │                                    │ → JS_Call(vm.onDetailBtnClick)
```

---

## Step 12.4：JS VM 方法调用

@add 或 @update `core/src/js_bridge.cpp` — 新增事件分发函数：

```cpp
// nodeId → event method name 的映射（由 native_render 时保存）
static std::unordered_map<int, std::unordered_map<std::string, std::string>> g_nodeEvents;

void dispatchClickToJS(int nodeId) {
    auto it = g_nodeEvents.find(nodeId);
    if (it == g_nodeEvents.end()) return;

    auto evIt = it->second.find("click");
    if (evIt == it->second.end()) return;

    const std::string& methodName = evIt->second;
    LOGI("Dispatching click to JS: nodeId=%d, method=%s", nodeId, methodName.c_str());

    // 调用 JS VM 的方法
    // 需要持有 VM 的 JSValue 引用（在 $app_bootstrap$ 时保存）
    // dispatchJSEvent(ctx, vmObject, methodName.c_str());
}
```

---

## Step 12.5：验证

```bash
adb logcat | grep -E "quickapp-"
```

**预期（点击按钮后）：**

```text
I/quickapp-core: Click event received: nodeId=2
I/quickapp-bridge: Dispatching click to JS: nodeId=2, method=onDetailBtnClick
I/quickapp-js: [console] Button clicked! (or router.push called)
```

---

## 技术决策

1. **事件必须走 RuntimeThread.post()** — QuickJS 不是线程安全的，不能在 JNI 线程直接调 JS
2. **nodeId 映射事件** — 渲染时保存 nodeId → events 映射，事件到来时查找
3. **独立事件通道** — 不和渲染指令混用同一个 PlatformBridge

---

## QA

### 1. 如果点击时页面已经切换了怎么办？
检查 nodeId 是否还在当前页面的映射中。不在就丢弃事件。

### 2. 事件顺序保证？
同一个 nodeId 的事件按 post 顺序在 Runtime Thread 串行执行。libuv 的 post 保证 FIFO。

---

## 下一步

Step 12 后页面可见且可交互。Step 13 实现真正的页面导航和 Toast。
