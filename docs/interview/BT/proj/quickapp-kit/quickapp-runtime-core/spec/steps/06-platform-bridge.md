# Step 6：PlatformBridge 与 PlatformEventSink

## 目录

- [目标](#目标)
- [Step 6.1：区分两条通道](#step-61区分两条通道)
- [Step 6.2：实现 PlatformBridge](#step-62实现-platformbridge)
- [Step 6.3：实现 PlatformEventSink](#step-63实现-platformeventsink)
- [Step 6.4：接入 CMake](#step-64接入-cmake)
- [Step 6.5：编写测试](#step-65编写测试)
- [Step 6.6：逐层验证](#step-66逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**建立 Core 与平台层的双向通信通道，且两个方向严格独立。**

| 通道 | 方向 | 内容 | 文件 |
|---|---|---|---|
| PlatformBridge | C++ → Platform | 渲染命令（createElement/setAttr/setStyle/setEvent/removeElement） | `platform_bridge.h/.cpp` |
| PlatformEventSink | Platform → C++ | 用户事件（click/input/lifecycle） | `platform_event_sink.h/.cpp` |

**验收标准：**
- 注册 mock bridge 后 `isReady()` 返回 true，命令能到达 mock 实现
- 未注册时 Core 不调用任何函数指针（不崩溃）
- `dispatchEvent()` 可从任意线程调用，事件在 Runtime Thread 处理
- Runtime 停止后事件被丢弃，不访问已释放对象
- 事件按投递顺序串行处理

**本步不包含：**
- 具体平台实现（Android JNI / iOS UIKit / LVGL，Step 11）
- 渲染命令批量提交（V1.5 的 RenderCommandBatch）
- 事件到 JS 回调的分发（Step 07 的 JS Bridge）

---

## Step 6.1：区分两条通道

这是整个架构里最容易写错的地方。三条通道必须严格分开。

### 6.1.1：三条通道对照

```text
JS Bridge          JS ↔ C++            QuickJS C API 直调，零序列化    Step 07
PlatformBridge     C++ → Platform      渲染命令，函数指针              本步
PlatformEventSink  Platform → C++      用户事件，线程安全投递          本步
```

### 6.1.2：为什么事件不复用 PlatformBridge

一个直觉的想法是把事件回调也放进 `PlatformBridge`：

```cpp
// 错误设计
struct PlatformBridge {
    void (*createElement)(...);      // C++ → Platform
    void (*onClick)(int nodeId);     // Platform → C++  ← 方向相反
};
```

四个问题：

```text
1. 方向混乱
   同一个结构体里一半是"Core 调用平台"，一半是"平台调用 Core"，
   阅读者无法快速判断某个函数指针该由谁实现。

2. 线程语义冲突
   渲染命令：Core 在 Runtime Thread 调用，平台负责投递到 UI 线程
   事件：平台在 UI 线程产生，需要投递到 Runtime Thread
   两者的线程规则完全相反，混在一起容易搞错。

3. 生命周期不同
   渲染命令在 Runtime 销毁时应立即停止
   事件在 Runtime 销毁后可能还会到达（用户手速快），需要安全丢弃

4. 平台实现方式不同
   Android：渲染命令是 C++ → JNI → Kotlin
             事件是 Kotlin → JNI → C++（反向 JNI 调用）
   这是两套完全不同的 JNI 代码。
```

所以分成两个独立的组件，各自有清晰的方向和线程规则。

### 6.1.3：完整数据流

```text
┌──────────────────────────────────────────────────────────┐
│ Runtime Thread                                            │
│                                                          │
│  JS: this.$element('btn').text = 'clicked'               │
│      ↓ JS Bridge (Step 07)                               │
│  C++ Core: VNode 更新 → 生成渲染命令                       │
│      ↓ PlatformBridge.setAttr(id, "text", "clicked")     │
└──────────────────────┬───────────────────────────────────┘
                       │ 函数指针调用
┌──────────────────────▼───────────────────────────────────┐
│ Platform 层                                               │
│  JNI/ObjC++/LVGL 实现                                     │
│      ↓ 投递到自己的 UI 线程                                │
│  TextView.setText("clicked")                             │
│                                                          │
│  用户点击 Button                                          │
│      ↓ UI 线程回调                                        │
│  PlatformEventSink.dispatchClick(nodeId)                 │
└──────────────────────┬───────────────────────────────────┘
                       │ EventLoop.post()（线程安全）
┌──────────────────────▼───────────────────────────────────┐
│ Runtime Thread                                            │
│  事件处理器 → 查找 VNode → 调用 JS 方法                     │
└──────────────────────────────────────────────────────────┘
```

---

## Step 6.2：实现 PlatformBridge

### 6.2.1：创建头文件

**@add `include/platform_bridge.h`（新建文件）**

```cpp
#ifndef QUICKAPP_PLATFORM_BRIDGE_H
#define QUICKAPP_PLATFORM_BRIDGE_H

namespace quickapp {

// C++ Core → 平台层的渲染命令通道。
//
// 职责：
//   Core 通过这组函数指针把渲染指令发给平台，
//   不直接依赖 Android View、UIKit 或 LVGL 的任何类型。
//
// 方向：
//   单向，只有 C++ → Platform。
//   平台 → C++ 的事件走 PlatformEventSink，是独立的通道。
//
// 线程约束：
//   Core 在 Runtime Thread 调用这些函数指针。
//   平台实现负责把操作投递到自己的 UI 线程
//   （Android: runOnUiThread / iOS: dispatch_get_main_queue / LVGL: lv_timer）。
//   Core 不参与 UI 线程调度。
//
// 参数类型约定：
//   只用基本类型（int / float / const char*），不用 std::string 或自定义类型。
//   原因：函数指针可能被 C 代码（LVGL）或 Objective-C 实现，
//        C++ 类型无法跨语言边界传递。
//
// 字符串生命周期：
//   所有 const char* 参数在函数返回前有效，指向 Core 内部的临时存储。
//   平台实现如需保存，必须自行拷贝。
struct PlatformBridge {
    /**
     * 创建一个平台元素。
     *
     * @param id     节点 ID，由 Core 分配的全局唯一自增整数，
     *               后续 setAttr/setStyle/removeElement 用它定位元素
     * @param type   节点类型："div"、"text"、"input" 等。
     *               平台负责映射到自己的控件（Android: FrameLayout/TextView/Button）
     * @param x      布局计算得出的左上角 X 坐标，单位物理像素
     * @param y      布局计算得出的左上角 Y 坐标，单位物理像素
     * @param width  布局计算得出的宽度，单位物理像素
     * @param height 布局计算得出的高度，单位物理像素
     *
     * 平台实现要求：
     *   建立 id → 原生控件 的映射表，供后续命令查找。
     *   未知 type 应记录警告并跳过，不能崩溃。
     */
    using CreateElementFn = void (*)(int id,
                                     const char* type,
                                     float x,
                                     float y,
                                     float width,
                                     float height);

    /**
     * 设置元素属性（内容语义，非视觉样式）。
     *
     * @param id    目标节点 ID。id 不存在时平台应记录警告并忽略
     * @param key   属性名："text"（文本内容）、"value"（输入值）、
     *              "placeholder"、"src"（图片地址）等
     * @param value 属性值，UTF-8 字符串。数字和布尔也以字符串形式传递
     *              （如 "42"、"true"），平台按 key 决定如何解析
     */
    using SetAttrFn = void (*)(int id, const char* key, const char* value);

    /**
     * 设置元素样式（视觉表现）。
     *
     * @param id    目标节点 ID
     * @param key   样式名："color"、"backgroundColor"、"fontSize"、
     *              "textAlign"、"borderRadius" 等
     * @param value 样式值。格式遵循 CSS 约定：
     *              颜色 "#RRGGBB" 或 "#AARRGGBB"，
     *              尺寸 "16px"，
     *              枚举 "center" / "left"
     *              平台负责解析，无法解析时记录警告并忽略该条样式
     */
    using SetStyleFn = void (*)(int id, const char* key, const char* value);

    /**
     * 为元素绑定事件监听。
     *
     * @param id         目标节点 ID
     * @param eventType  事件类型："click"、"input"、"change" 等
     * @param methodName VM 方法名，如 "onButtonClick"。
     *                   平台不需要理解它的含义，只需在事件发生时
     *                   通过 PlatformEventSink 把 (id, eventType) 传回，
     *                   Core 自己查表找到方法名并调用 JS
     *
     * 设计说明：
     *   methodName 传给平台只是为了调试可见性（如日志、accessibility label）。
     *   事件回传时平台不需要携带它，Core 侧有完整的映射。
     */
    using SetEventFn = void (*)(int id, const char* eventType, const char* methodName);

    /**
     * 删除元素及其所有子元素。
     *
     * @param id 目标节点 ID。id 不存在时应忽略（可能已被父节点级联删除）
     *
     * 平台实现要求：
     *   从父容器移除控件，清理 id → 控件 映射，
     *   移除事件监听器避免野回调。
     */
    using RemoveElementFn = void (*)(int id);

    /**
     * 显示平台原生的轻量提示。
     *
     * @param message 提示文本，UTF-8
     *
     * 平台映射：Android Toast / iOS 自定义浮层 / LVGL 消息框。
     *
     * 归类说明：
     *   这是"平台能力"而非"渲染命令"。V1 为了简化放在同一个结构体里，
     *   V2 能力变多时（vibrate/clipboard/share）应拆为独立的
     *   PlatformServiceBridge。
     */
    using ShowToastFn = void (*)(const char* message);

    // 全部初始化为 nullptr。
    // 不显式初始化的话，栈上创建的 PlatformBridge 会包含随机地址，
    // isReady() 可能误判为已就绪，调用时直接崩溃。
    CreateElementFn createElement = nullptr;
    SetAttrFn setAttr = nullptr;
    SetStyleFn setStyle = nullptr;
    SetEventFn setEvent = nullptr;
    RemoveElementFn removeElement = nullptr;
    ShowToastFn showToast = nullptr;

    /**
     * 判断最小渲染能力是否已注册。
     *
     * 只检查渲染必需的三个函数。setEvent/removeElement/showToast
     * 是可选能力，平台可以不实现（如只读展示场景）。
     *
     * @return true 表示可以开始发送渲染命令
     */
    bool isReady() const noexcept {
        return createElement != nullptr &&
               setAttr != nullptr &&
               setStyle != nullptr;
    }
};

/**
 * 注册平台实现。由平台层在初始化时调用一次。
 *
 * @param bridge 填好函数指针的结构体。按值传递，Core 内部保存副本，
 *               调用方不需要保证 bridge 对象的生命周期
 *
 * 线程约束：应在 Runtime 启动前调用。
 */
void registerPlatformBridge(PlatformBridge bridge);

/**
 * 获取当前注册的平台实现。
 *
 * @return 当前实现的常量引用。未注册时返回全 nullptr 的结构体，
 *         调用方应先检查 isReady()
 */
const PlatformBridge& getPlatformBridge();

/**
 * 清空所有函数指针。Runtime 销毁时调用。
 *
 * 目的：平台对象（Kotlin QuickAppRuntime / UIViewController）销毁后，
 *      残留的函数指针会指向已失效的对象，继续调用导致崩溃。
 */
void clearPlatformBridge();

} // namespace quickapp

#endif // QUICKAPP_PLATFORM_BRIDGE_H
```


### 6.2.2：创建实现文件

**@add `src/platform_bridge.cpp`（新建文件）**

```cpp
#include "platform_bridge.h"

#include "qa_log.h"

namespace quickapp {   // 第一层：项目命名空间，对外可见
namespace {            // 第二层：匿名命名空间，仅本文件可见

// 当前进程使用的平台实现。
//
// 用全局变量的原因：V1 只支持单个 Runtime 实例。
// 多 Runtime 场景（一个进程同时跑多个快应用）需要把它移到
// Runtime 对象内部，并让 Core 各模块通过 Runtime 上下文访问。
//
// 线程安全：
//   注册发生在启动阶段（单线程），读取发生在 Runtime Thread。
//   两者不并发，所以不需要锁。
PlatformBridge g_platformBridge{};

} // namespace

void registerPlatformBridge(PlatformBridge bridge) {
    g_platformBridge = bridge;

    // 记录哪些能力可用，便于排查"为什么点击没反应"这类问题
    QA_LOGI("[PlatformBridge] registered: "
            "createElement=%s setAttr=%s setStyle=%s "
            "setEvent=%s removeElement=%s showToast=%s",
            bridge.createElement ? "yes" : "no",
            bridge.setAttr       ? "yes" : "no",
            bridge.setStyle      ? "yes" : "no",
            bridge.setEvent      ? "yes" : "no",
            bridge.removeElement ? "yes" : "no",
            bridge.showToast     ? "yes" : "no");

    if (!g_platformBridge.isReady()) {
        QA_LOGW("[PlatformBridge] not ready: "
                "createElement/setAttr/setStyle are all required");
    }
}

const PlatformBridge& getPlatformBridge() {
    return g_platformBridge;
}

void clearPlatformBridge() {
    // 用空结构体赋值，所有成员回到 nullptr 的默认值
    g_platformBridge = PlatformBridge{};
    QA_LOGI("[PlatformBridge] cleared");
}

} // namespace quickapp
```

**为什么全局变量定义在 .cpp 而不是 .h：**

```text
定义在头文件：
    每个 #include "platform_bridge.h" 的 .cpp 都生成一份变量
    → 链接期报 "multiple definition of g_platformBridge"
    → 或者用 inline/static 规避，但会导致每个编译单元有独立副本，
      平台注册的实现在其他文件里看不到

定义在 .cpp：
    整个程序只有一份实例，所有文件通过函数访问同一个状态
```

### 6.2.3：Core 侧的调用约定

Core 各模块发送渲染命令时的标准写法（Step 09/10 会用到）：

```cpp
#include "platform_bridge.h"

void renderNode(const VNode& node) {
    const auto& bridge = getPlatformBridge();

    // 每次调用前检查就绪状态。
    // 平台可能还没注册，或者 Runtime 正在销毁中已经 clear 过。
    if (!bridge.isReady()) {
        QA_LOGW("[Render] bridge not ready, skipping node %d", node.id);
        return;
    }

    bridge.createElement(node.id, node.type.c_str(),
                        node.layout.x, node.layout.y,
                        node.layout.width, node.layout.height);

    for (const auto& [key, value] : node.attrs) {
        bridge.setAttr(node.id, key.c_str(), value.c_str());
    }
    for (const auto& [key, value] : node.styles) {
        bridge.setStyle(node.id, key.c_str(), value.c_str());
    }

    // 可选能力单独检查
    if (bridge.setEvent != nullptr) {
        for (const auto& [eventType, methodName] : node.events) {
            bridge.setEvent(node.id, eventType.c_str(), methodName.c_str());
        }
    }
}
```

---

## Step 6.3：实现 PlatformEventSink

### 6.3.1：设计要点

事件通道比渲染通道复杂，因为它跨线程：

```text
渲染命令：Runtime Thread 调用 → 平台自己处理线程切换
事件：任意线程调用 → Core 必须自己切到 Runtime Thread
```

三个必须解决的问题：

```text
1. 线程安全
   平台在 UI 线程调 dispatchClick，必须投递到 Runtime Thread
   → 通过 RuntimeEventLoop.post()

2. 生命周期安全
   Runtime 销毁后事件可能还在到达（用户手速）
   → 需要状态检查，停止后丢弃

3. 顺序保证
   同一节点的多次点击必须按顺序处理
   → EventLoop 的 FIFO 队列天然保证
```

### 6.3.2：创建头文件

**@add `include/platform_event_sink.h`（新建文件）**

```cpp
#ifndef QUICKAPP_PLATFORM_EVENT_SINK_H
#define QUICKAPP_PLATFORM_EVENT_SINK_H

#include <functional>
#include <string>

namespace quickapp {

class RuntimeEventLoop;

// 平台事件类型。
enum class PlatformEventType {
    Click,      // 点击
    Input,      // 输入框内容变化
    Change,     // 值变更（如 switch、slider）
    Lifecycle,  // 生命周期（onShow/onHide/onDestroy）
};

// 平台事件数据。
struct PlatformEvent {
    PlatformEventType type;

    // 触发事件的节点 ID。
    // Lifecycle 事件与具体节点无关，此字段为 -1。
    int nodeId = -1;

    // 事件携带的数据，语义按 type 决定：
    //   Click     空字符串
    //   Input     输入框的当前文本
    //   Change    新的值
    //   Lifecycle 生命周期名称，如 "onShow"、"onHide"
    std::string payload;
};

// 平台层 → C++ Core 的事件入口。
//
// 职责：
//   接收平台的用户交互事件，安全地投递到 Runtime Thread 处理。
//
// 方向：
//   单向，只有 Platform → C++。
//   C++ → Platform 的渲染命令走 PlatformBridge，是独立通道。
//
// 线程约束：
//   dispatch* 方法可从任意线程调用（通常是平台 UI 线程）。
//   注册的处理器在 Runtime Thread 执行。
//
// 生命周期：
//   initialize(loop, handler) → [dispatch...] → shutdown()
//   shutdown() 后到达的事件被丢弃，不会访问已失效对象。
//
// 与其他组件的关系：
//   RuntimeEventLoop  用它做线程切换
//   JS Bridge         事件处理器最终调用 JS 方法（Step 07 接线）
class PlatformEventSink {
public:
    // 事件处理器类型。在 Runtime Thread 被调用。
    using EventHandler = std::function<void(const PlatformEvent&)>;

    /**
     * 初始化事件通道。
     *
     * @param loop    用于线程切换的 EventLoop。必须非空，
     *                且其生命周期必须长于本 sink 的使用期
     * @param handler 事件处理器，在 Runtime Thread 被调用。
     *                通常由 RuntimeBootstrap 提供，内部调用 JS 方法
     *
     * 线程约束：应在 Runtime 启动阶段调用，不并发。
     */
    static void initialize(RuntimeEventLoop* loop, EventHandler handler);

    /**
     * 关闭事件通道。
     *
     * 之后所有 dispatch 调用都被丢弃并记录 debug 日志。
     * 必须在 EventLoop 和 handler 捕获的对象销毁前调用。
     *
     * 幂等：多次调用安全。
     */
    static void shutdown();

    /**
     * 投递点击事件。
     *
     * @param nodeId 被点击节点的 ID，来自 PlatformBridge.createElement 时分配的 ID
     *
     * 线程安全：可从任意线程调用。
     */
    static void dispatchClick(int nodeId);

    /**
     * 投递输入事件。
     *
     * @param nodeId 输入框节点 ID
     * @param text   当前完整文本内容，UTF-8。
     *               函数内部会拷贝，调用方不需要保持指针有效
     */
    static void dispatchInput(int nodeId, const char* text);

    /**
     * 投递值变更事件。
     *
     * @param nodeId 节点 ID
     * @param value  新值的字符串表示
     */
    static void dispatchChange(int nodeId, const char* value);

    /**
     * 投递生命周期事件。
     *
     * @param name 生命周期名称："onShow"、"onHide"、"onDestroy" 等。
     *             不能为 nullptr
     *
     * 线程安全：可从任意线程调用。
     */
    static void dispatchLifecycle(const char* name);

    /**
     * 查询事件通道是否可用。
     * @return true 表示已 initialize 且未 shutdown
     */
    static bool isActive();
};

} // namespace quickapp

#endif // QUICKAPP_PLATFORM_EVENT_SINK_H
```


### 6.3.3：创建实现文件

**@add `src/platform_event_sink.cpp`（新建文件）**

```cpp
#include "platform_event_sink.h"

#include <atomic>
#include <mutex>

#include "qa_log.h"
#include "runtime_event_loop.h"

namespace quickapp {
namespace {

// 事件通道的全局状态。
//
// 为什么需要锁：
//   dispatch* 可能从多个线程并发调用（UI 线程 + 后台线程），
//   同时 shutdown() 可能在另一个线程执行。
//   必须保证"读取 loop/handler"和"清空 loop/handler"不会交错。
std::mutex g_mutex;
RuntimeEventLoop* g_loop = nullptr;
PlatformEventSink::EventHandler g_handler;

// 快速路径标志。
//
// 为什么在有锁的情况下还需要这个 atomic：
//   dispatch 是高频调用（滚动时每秒几十次）。
//   通道未激活时（Runtime 已销毁）用 atomic 先判断，
//   避免每次都去抢锁。这是常见的 double-checked 优化。
std::atomic<bool> g_active{false};

/**
 * 事件投递的统一实现。
 *
 * @param event 要投递的事件，按值传入以便安全地移动进 lambda
 * @return true 已成功投递到 EventLoop；false 通道未激活，事件被丢弃
 */
bool postEvent(PlatformEvent event) {
    // 快速路径：未激活直接返回，不抢锁
    if (!g_active.load(std::memory_order_acquire)) {
        QA_LOGD("[EventSink] inactive, event dropped (type=%d, node=%d)",
                static_cast<int>(event.type), event.nodeId);
        return false;
    }

    RuntimeEventLoop* loop = nullptr;
    PlatformEventSink::EventHandler handler;

    {
        std::lock_guard<std::mutex> lock(g_mutex);
        // 拿锁后再确认一次：可能在快速路径检查后被 shutdown
        if (!g_active.load(std::memory_order_acquire) ||
            g_loop == nullptr || !g_handler) {
            return false;
        }
        // 拷贝出来，在锁外使用。
        // handler 是 std::function，拷贝会复制捕获的对象，
        // 保证即使 shutdown 清空了 g_handler，本次调用仍然安全。
        loop = g_loop;
        handler = g_handler;
    }

    // 锁外投递：EventLoop.post 内部有自己的锁，
    // 持我们的锁调用它会增加锁竞争，且有嵌套锁的死锁风险。
    loop->post([handler = std::move(handler), event = std::move(event)]() {
        // 这个 lambda 在 Runtime Thread 执行
        handler(event);
    });

    return true;
}

} // namespace

void PlatformEventSink::initialize(RuntimeEventLoop* loop, EventHandler handler) {
    if (loop == nullptr) {
        QA_LOGE("[EventSink] initialize: loop is null");
        return;
    }
    if (!handler) {
        QA_LOGE("[EventSink] initialize: handler is empty");
        return;
    }

    {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_loop = loop;
        g_handler = std::move(handler);
    }
    // 最后置位 active，保证 dispatch 看到 active=true 时
    // loop 和 handler 一定已经设置好
    g_active.store(true, std::memory_order_release);

    QA_LOGI("[EventSink] initialized");
}

void PlatformEventSink::shutdown() {
    // 先置位 false，让新到达的事件走快速路径直接丢弃
    g_active.store(false, std::memory_order_release);

    {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_loop = nullptr;
        // 清空 handler 释放它捕获的对象（可能持有 JSEngine 引用等）
        g_handler = nullptr;
    }

    QA_LOGI("[EventSink] shutdown");
}

void PlatformEventSink::dispatchClick(int nodeId) {
    postEvent(PlatformEvent{PlatformEventType::Click, nodeId, ""});
}

void PlatformEventSink::dispatchInput(int nodeId, const char* text) {
    postEvent(PlatformEvent{
        PlatformEventType::Input,
        nodeId,
        text != nullptr ? text : "",   // nullptr 转空串，避免 std::string 构造崩溃
    });
}

void PlatformEventSink::dispatchChange(int nodeId, const char* value) {
    postEvent(PlatformEvent{
        PlatformEventType::Change,
        nodeId,
        value != nullptr ? value : "",
    });
}

void PlatformEventSink::dispatchLifecycle(const char* name) {
    if (name == nullptr) {
        QA_LOGW("[EventSink] dispatchLifecycle: name is null");
        return;
    }
    // Lifecycle 事件不关联具体节点，nodeId 用 -1
    postEvent(PlatformEvent{PlatformEventType::Lifecycle, -1, name});
}

bool PlatformEventSink::isActive() {
    return g_active.load(std::memory_order_acquire);
}

} // namespace quickapp
```

**为什么用静态方法而不是实例：**

```text
平台侧的调用点通常在 C 回调或 JNI 函数里：
    JNIEXPORT void JNICALL
    Java_..._nativeDispatchClick(JNIEnv*, jobject, jint nodeId) {
        quickapp::PlatformEventSink::dispatchClick(nodeId);   // 直接调用
    }

如果是实例方法，JNI 层需要额外保存 sink 实例指针，
增加平台侧的样板代码。静态方法让平台集成最简单。

代价：无法同时有多个 Runtime。这和 PlatformBridge 的全局变量是同一个约束，
V1 明确只支持单 Runtime。
```

---

## Step 6.4：接入 CMake

**@update `CMakeLists.txt` — 替换 `add_library(quickapp-core STATIC ...)` 块**

```cmake
add_library(quickapp-core STATIC
    src/core_version.cpp
    src/qa_log.cpp
    src/quickjs_engine.cpp
    src/runtime_thread.cpp
    src/platform_bridge.cpp                     # ← Step 06 新增
    src/platform_event_sink.cpp                 # ← Step 06 新增
    platform/common/posix_event_loop.cpp
)
```

---

## Step 6.5：编写测试

**@add `tests/test_platform_bridge.cpp`（新建文件）**

```cpp
// PlatformBridge 与 PlatformEventSink 测试。
//
// 验证点：
//   1. 未注册时 isReady() 为 false，Core 不调用函数指针
//   2. 注册后命令到达 mock 实现，参数正确
//   3. 部分注册（只有必需能力）时 isReady() 仍为 true
//   4. clearPlatformBridge 后回到未就绪状态
//   5. 事件从其他线程投递，在 Runtime Thread 处理
//   6. 事件按投递顺序处理
//   7. shutdown 后事件被丢弃
//   8. 多线程并发投递不崩溃、不丢事件

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "platform_bridge.h"
#include "platform_event_sink.h"
#include "runtime_thread.h"

#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

namespace {

template <typename Pred>
bool waitFor(Pred pred, int timeoutMs = 2000) {
    const auto deadline = std::chrono::steady_clock::now() +
                          std::chrono::milliseconds(timeoutMs);
    while (std::chrono::steady_clock::now() < deadline) {
        if (pred()) return true;
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }
    return false;
}

// ============================================================
// Mock PlatformBridge：记录收到的所有命令
// ============================================================

struct RecordedCommand {
    std::string kind;    // "create" / "attr" / "style" / "event" / "remove" / "toast"
    int id;
    std::string a;       // type / key / eventType
    std::string b;       // value / methodName
    float x, y, w, h;
};

std::vector<RecordedCommand> g_commands;

void mockCreateElement(int id, const char* type,
                       float x, float y, float w, float h) {
    g_commands.push_back({"create", id, type ? type : "", "", x, y, w, h});
}
void mockSetAttr(int id, const char* key, const char* value) {
    g_commands.push_back({"attr", id, key ? key : "", value ? value : "", 0,0,0,0});
}
void mockSetStyle(int id, const char* key, const char* value) {
    g_commands.push_back({"style", id, key ? key : "", value ? value : "", 0,0,0,0});
}
void mockSetEvent(int id, const char* eventType, const char* methodName) {
    g_commands.push_back({"event", id, eventType ? eventType : "",
                          methodName ? methodName : "", 0,0,0,0});
}
void mockRemoveElement(int id) {
    g_commands.push_back({"remove", id, "", "", 0,0,0,0});
}
void mockShowToast(const char* message) {
    g_commands.push_back({"toast", -1, message ? message : "", "", 0,0,0,0});
}

int testPlatformBridge() {
    // ---- 场景 1：未注册状态 ----
    quickapp::clearPlatformBridge();
    CHECK(!quickapp::getPlatformBridge().isReady(),
          "bridge should not be ready before registration");
    CHECK(quickapp::getPlatformBridge().createElement == nullptr,
          "unregistered function pointer must be nullptr");

    // ---- 场景 2：完整注册 ----
    quickapp::PlatformBridge bridge{};
    bridge.createElement = mockCreateElement;
    bridge.setAttr = mockSetAttr;
    bridge.setStyle = mockSetStyle;
    bridge.setEvent = mockSetEvent;
    bridge.removeElement = mockRemoveElement;
    bridge.showToast = mockShowToast;
    quickapp::registerPlatformBridge(bridge);

    CHECK(quickapp::getPlatformBridge().isReady(), "bridge should be ready");

    // ---- 场景 3：命令到达且参数正确 ----
    g_commands.clear();
    const auto& b = quickapp::getPlatformBridge();

    b.createElement(1, "div", 0, 0, 1080, 1920);
    b.createElement(2, "text", 20, 40, 300, 60);
    b.setAttr(2, "text", "Hello QuickApp");
    b.setStyle(2, "color", "#333333");
    b.setStyle(2, "fontSize", "16px");
    b.setEvent(2, "click", "onTitleClick");
    b.showToast("saved");
    b.removeElement(2);

    CHECK(g_commands.size() == 8, "expected 8 recorded commands");

    CHECK(g_commands[0].kind == "create" && g_commands[0].id == 1 &&
          g_commands[0].a == "div" && g_commands[0].w == 1080.0f,
          "createElement(div) params wrong");

    CHECK(g_commands[1].kind == "create" && g_commands[1].id == 2 &&
          g_commands[1].a == "text" && g_commands[1].x == 20.0f &&
          g_commands[1].y == 40.0f,
          "createElement(text) params wrong");

    CHECK(g_commands[2].kind == "attr" && g_commands[2].a == "text" &&
          g_commands[2].b == "Hello QuickApp",
          "setAttr params wrong");

    CHECK(g_commands[3].kind == "style" && g_commands[3].b == "#333333",
          "setStyle color wrong");

    CHECK(g_commands[5].kind == "event" && g_commands[5].a == "click" &&
          g_commands[5].b == "onTitleClick",
          "setEvent params wrong");

    CHECK(g_commands[6].kind == "toast" && g_commands[6].a == "saved",
          "showToast params wrong");

    CHECK(g_commands[7].kind == "remove" && g_commands[7].id == 2,
          "removeElement params wrong");

    // ---- 场景 4：只注册必需能力 ----
    quickapp::PlatformBridge minimal{};
    minimal.createElement = mockCreateElement;
    minimal.setAttr = mockSetAttr;
    minimal.setStyle = mockSetStyle;
    quickapp::registerPlatformBridge(minimal);

    CHECK(quickapp::getPlatformBridge().isReady(),
          "minimal bridge (3 required fns) should be ready");
    CHECK(quickapp::getPlatformBridge().setEvent == nullptr,
          "optional setEvent should remain nullptr");
    CHECK(quickapp::getPlatformBridge().showToast == nullptr,
          "optional showToast should remain nullptr");

    // ---- 场景 5：缺少必需能力 ----
    quickapp::PlatformBridge incomplete{};
    incomplete.createElement = mockCreateElement;
    // 故意不设 setAttr / setStyle
    quickapp::registerPlatformBridge(incomplete);
    CHECK(!quickapp::getPlatformBridge().isReady(),
          "bridge missing setAttr/setStyle should not be ready");

    // ---- 场景 6：清空 ----
    quickapp::clearPlatformBridge();
    CHECK(!quickapp::getPlatformBridge().isReady(),
          "bridge should not be ready after clear");
    CHECK(quickapp::getPlatformBridge().createElement == nullptr,
          "all pointers should be nullptr after clear");

    return 0;
}

// ============================================================
// PlatformEventSink 测试
// ============================================================

std::mutex g_eventMutex;
std::vector<quickapp::PlatformEvent> g_events;
std::atomic<std::thread::id> g_handlerThreadId{};

void recordEvent(const quickapp::PlatformEvent& e) {
    g_handlerThreadId = std::this_thread::get_id();
    std::lock_guard<std::mutex> lk(g_eventMutex);
    g_events.push_back(e);
}

size_t eventCount() {
    std::lock_guard<std::mutex> lk(g_eventMutex);
    return g_events.size();
}

int testPlatformEventSink() {
    quickapp::RuntimeThread thread;
    CHECK(thread.start(), "RuntimeThread start failed");

    // 需要拿到 loop 指针。RuntimeThread 没直接暴露 loop，
    // 这里通过 post 一个任务间接验证事件确实走了 Runtime Thread。
    // 实际集成时 RuntimeBootstrap 持有 loop 并完成 initialize（Step 10）。
    //
    // 为了测试，直接用一个独立的 loop + 线程模拟。
    auto loop = quickapp::createEventLoop();
    std::atomic<bool> loopExited{false};
    std::thread runner([&] {
        loop->run();
        loopExited = true;
    });

    const auto mainThreadId = std::this_thread::get_id();

    // ---- 场景 1：未初始化时投递被丢弃 ----
    CHECK(!quickapp::PlatformEventSink::isActive(),
          "sink should be inactive initially");
    quickapp::PlatformEventSink::dispatchClick(1);
    CHECK(eventCount() == 0, "event before initialize should be dropped");

    // ---- 场景 2：初始化后事件到达 Runtime Thread ----
    quickapp::PlatformEventSink::initialize(loop.get(), recordEvent);
    CHECK(quickapp::PlatformEventSink::isActive(), "sink should be active");

    {
        std::lock_guard<std::mutex> lk(g_eventMutex);
        g_events.clear();
    }

    quickapp::PlatformEventSink::dispatchClick(42);
    CHECK(waitFor([&] { return eventCount() == 1; }), "click event should arrive");

    {
        std::lock_guard<std::mutex> lk(g_eventMutex);
        CHECK(g_events[0].type == quickapp::PlatformEventType::Click,
              "event type should be Click");
        CHECK(g_events[0].nodeId == 42, "nodeId should be 42");
    }
    CHECK(g_handlerThreadId.load() != mainThreadId,
          "handler must run on loop thread, not caller thread");

    // ---- 场景 3：各类事件的 payload ----
    {
        std::lock_guard<std::mutex> lk(g_eventMutex);
        g_events.clear();
    }

    quickapp::PlatformEventSink::dispatchInput(7, "typed text");
    quickapp::PlatformEventSink::dispatchChange(8, "new value");
    quickapp::PlatformEventSink::dispatchLifecycle("onShow");

    CHECK(waitFor([&] { return eventCount() == 3; }), "3 events should arrive");
    {
        std::lock_guard<std::mutex> lk(g_eventMutex);
        CHECK(g_events[0].type == quickapp::PlatformEventType::Input &&
              g_events[0].nodeId == 7 && g_events[0].payload == "typed text",
              "input event wrong");
        CHECK(g_events[1].type == quickapp::PlatformEventType::Change &&
              g_events[1].payload == "new value",
              "change event wrong");
        CHECK(g_events[2].type == quickapp::PlatformEventType::Lifecycle &&
              g_events[2].nodeId == -1 && g_events[2].payload == "onShow",
              "lifecycle event wrong");
    }

    // ---- 场景 4：nullptr payload 安全 ----
    quickapp::PlatformEventSink::dispatchInput(9, nullptr);
    quickapp::PlatformEventSink::dispatchLifecycle(nullptr);   // 应被拒绝
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    // 不崩溃即通过

    // ---- 场景 5：顺序保证 ----
    {
        std::lock_guard<std::mutex> lk(g_eventMutex);
        g_events.clear();
    }
    for (int i = 0; i < 20; ++i) {
        quickapp::PlatformEventSink::dispatchClick(i);
    }
    CHECK(waitFor([&] { return eventCount() == 20; }), "all 20 events should arrive");
    {
        std::lock_guard<std::mutex> lk(g_eventMutex);
        for (int i = 0; i < 20; ++i) {
            CHECK(g_events[i].nodeId == i, "events must be processed in order");
        }
    }

    // ---- 场景 6：多线程并发投递 ----
    {
        std::lock_guard<std::mutex> lk(g_eventMutex);
        g_events.clear();
    }
    std::vector<std::thread> producers;
    for (int t = 0; t < 4; ++t) {
        producers.emplace_back([t] {
            for (int i = 0; i < 25; ++i) {
                quickapp::PlatformEventSink::dispatchClick(t * 100 + i);
            }
        });
    }
    for (auto& p : producers) p.join();

    CHECK(waitFor([&] { return eventCount() == 100; }),
          "all 100 concurrent events should arrive");

    // ---- 场景 7：shutdown 后丢弃 ----
    quickapp::PlatformEventSink::shutdown();
    CHECK(!quickapp::PlatformEventSink::isActive(), "sink should be inactive");

    const size_t countBefore = eventCount();
    quickapp::PlatformEventSink::dispatchClick(999);
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    CHECK(eventCount() == countBefore, "events after shutdown should be dropped");

    // 清理
    loop->stop();
    CHECK(waitFor([&] { return loopExited.load(); }), "loop should exit");
    runner.join();

    thread.stop();
    thread.join();
    return 0;
}

} // namespace

int main() {
    if (testPlatformBridge() != 0) return 1;
    if (testPlatformEventSink() != 0) return 1;

    std::printf("PASS: all PlatformBridge / PlatformEventSink tests\n");
    return 0;
}
```

**@update `tests/CMakeLists.txt` — 在 `test_event_loop` 之后插入**

```cmake
# test_platform_bridge：双向通信通道
add_executable(test_platform_bridge test_platform_bridge.cpp)
target_link_libraries(test_platform_bridge PRIVATE quickapp-core)
add_test(NAME test_platform_bridge COMMAND test_platform_bridge)
```

---

## Step 6.6：逐层验证

### 6.6.1：编译验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build -j4
```

预期：

```text
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/platform_bridge.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/platform_event_sink.cpp.o
[100%] Linking CXX executable test_platform_bridge
```

**常见错误：**

```text
"multiple definition of g_platformBridge"
    → 全局变量定义写在了头文件里，必须放 .cpp 的匿名 namespace

"invalid conversion from 'void (*)(int, const char*)' to 'SetAttrFn'"
    → mock 函数签名和 using 声明不一致，逐个参数对照检查

"incomplete type 'quickapp::RuntimeEventLoop' used in nested name specifier"
    → platform_event_sink.cpp 忘了 #include "runtime_event_loop.h"
      （头文件里只有前向声明 class RuntimeEventLoop;）
```

### 6.6.2：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
1/5 Test #1: test_version .....................   Passed
2/5 Test #2: test_log .........................   Passed
3/5 Test #3: test_js_engine ...................   Passed
4/5 Test #4: test_event_loop ..................   Passed
5/5 Test #5: test_platform_bridge .............   Passed

100% tests passed, 0 tests failed out of 5
```

直接运行看日志：

```bash
./build/tests/test_platform_bridge
```

预期（节选）：

```text
[I/quickapp-core] [PlatformBridge] cleared
[I/quickapp-core] [PlatformBridge] registered: createElement=yes setAttr=yes
                  setStyle=yes setEvent=yes removeElement=yes showToast=yes
[I/quickapp-core] [PlatformBridge] registered: createElement=yes setAttr=yes
                  setStyle=yes setEvent=no removeElement=no showToast=no
[W/quickapp-core] [PlatformBridge] not ready: createElement/setAttr/setStyle are all required
[D/quickapp-core] [EventSink] inactive, event dropped (type=0, node=1)
[I/quickapp-core] [EventSink] initialized
[W/quickapp-core] [EventSink] dispatchLifecycle: name is null
[I/quickapp-core] [EventSink] shutdown
[D/quickapp-core] [EventSink] inactive, event dropped (type=0, node=999)
PASS: all PlatformBridge / PlatformEventSink tests
```

日志清楚显示了注册状态、能力缺失警告、事件丢弃行为。

### 6.6.3：数据竞争验证

事件通道是多线程的，必须过 TSan：

```bash
cmake -B build-tsan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=thread -fno-omit-frame-pointer" \
  -DCMAKE_C_FLAGS="-fsanitize=thread -fno-omit-frame-pointer" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=thread"
cmake --build build-tsan -j4
./build-tsan/tests/test_platform_bridge
```

预期：`PASS`，无 TSan 报告。

场景 6（4 个线程并发投递 100 个事件）是这个验证的核心。如果 `g_mutex` 保护不当，TSan 会报：

```text
WARNING: ThreadSanitizer: data race
  Write of size 8 at 0x... by thread T5:
    #0 quickapp::PlatformEventSink::shutdown()
  Previous read of size 8 at 0x... by thread T2:
    #0 quickapp::(anonymous namespace)::postEvent(...)
```

```bash
rm -rf build-tsan
```

### 6.6.4：生命周期安全验证

验证 shutdown 后不会 use-after-free：

```bash
cat > /tmp/test_sink_lifetime.cpp << 'EOF'
// 模拟真实场景：Runtime 销毁时平台还在发事件
#include <atomic>
#include <chrono>
#include <cstdio>
#include <thread>
#include "platform_event_sink.h"
#include "runtime_event_loop.h"

int main() {
    std::atomic<int> handled{0};
    std::atomic<bool> stopProducing{false};

    // 后台线程持续投递事件（模拟用户快速点击）
    std::thread producer([&] {
        int i = 0;
        while (!stopProducing.load()) {
            quickapp::PlatformEventSink::dispatchClick(i++);
            std::this_thread::sleep_for(std::chrono::microseconds(100));
        }
    });

    // 反复创建销毁 Runtime，每次都在事件流中间 shutdown
    for (int round = 0; round < 20; ++round) {
        auto loop = quickapp::createEventLoop();
        std::thread runner([&] { loop->run(); });

        quickapp::PlatformEventSink::initialize(loop.get(), [&](const auto&) {
            handled.fetch_add(1);
        });

        std::this_thread::sleep_for(std::chrono::milliseconds(10));

        // 关键顺序：先 shutdown 断开事件通道，再停 loop，再销毁 loop
        quickapp::PlatformEventSink::shutdown();
        loop->stop();
        runner.join();
        // loop 在这里析构。如果 shutdown 没生效，
        // producer 线程会向已销毁的 loop 投递 → use-after-free
    }

    stopProducing = true;
    producer.join();

    std::printf("survived 20 rounds, handled %d events\n", handled.load());
    return 0;
}
EOF

c++ -std=c++17 -fsanitize=address -g -I include -I platform/common \
    /tmp/test_sink_lifetime.cpp build/libquickapp-core.a \
    -o /tmp/test_sink_lifetime 2>/dev/null && /tmp/test_sink_lifetime
```

预期：

```text
survived 20 rounds, handled NNN events
```

没有 ASan 的 `heap-use-after-free` 报告。这验证了 `shutdown()` 先置 `g_active=false` 的顺序是正确的。

```bash
rm -f /tmp/test_sink_lifetime.cpp /tmp/test_sink_lifetime
```

### 6.6.5：通道独立性验证

确认两个通道在代码层面真的独立：

```bash
# PlatformBridge 不应该知道 EventLoop 或 EventSink
grep -E "runtime_event_loop|platform_event_sink" src/platform_bridge.cpp
# 预期：无输出

# PlatformEventSink 不应该知道 PlatformBridge
grep "platform_bridge" src/platform_event_sink.cpp
# 预期：无输出

# 头文件也要独立
grep "platform_event_sink" include/platform_bridge.h
grep "platform_bridge" include/platform_event_sink.h
# 预期：都无输出
```

四条命令全部无输出，说明两个通道零耦合，可以独立演进和替换。

### 6.6.6：平台无关性回归

```bash
nm build/libquickapp-core.a | grep -E "__android_log_print|objc_msgSend|lv_obj_create"
```

预期：无输出。

---

## 技术决策

### 1. PlatformBridge 用函数指针而不是虚接口

```cpp
// 选择：函数指针结构体
struct PlatformBridge {
    void (*createElement)(int, const char*, float, float, float, float);
};

// 未选择：虚接口
class PlatformBridge {
    virtual void createElement(int, const char*, float, float, float, float) = 0;
};
```

| 维度 | 函数指针 | 虚接口 |
|---|---|---|
| C 语言实现（LVGL） | ✓ 直接赋值 | ✗ 需要 C++ 包装类 |
| Objective-C 实现 | ✓ 静态函数 | ✗ 需要 ObjC++ 桥接类 |
| 部分实现能力 | ✓ 留 nullptr | ✗ 必须实现所有纯虚函数或写空实现 |
| 运行时替换单个函数 | ✓ 直接改字段 | ✗ 要换整个对象 |
| 类型安全 | 弱（签名靠约定） | 强（编译器检查） |

LVGL 场景是决定性因素：嵌入式端可能是纯 C 项目，无法实现 C++ 虚接口。

### 2. 事件通道用静态方法而不是实例

平台侧的调用点在 C 回调和 JNI 函数里，那里拿不到实例指针：

```cpp
// Android JNI —— 静态方法直接调用
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeDispatchClick(
        JNIEnv*, jobject, jint nodeId) {
    quickapp::PlatformEventSink::dispatchClick(nodeId);
}

// 如果是实例方法，需要额外保存指针：
static quickapp::PlatformEventSink* g_sink;   // 平台侧多一个全局变量
g_sink->dispatchClick(nodeId);
```

静态方法把这个负担从平台侧转移到 Core 内部，让三端集成代码更少。

### 3. 事件用 double-checked 优化

```cpp
bool postEvent(PlatformEvent event) {
    if (!g_active.load(std::memory_order_acquire)) return false;   // 快速路径
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        if (!g_active.load(...)) return false;                      // 二次确认
        // ...
    }
}
```

滚动场景下事件频率可达每秒几十次。Runtime 销毁后（`g_active=false`）如果每次都抢锁，会和其他线程产生无意义的竞争。

`atomic` 的快速路径让"已停止"的判断不需要锁。锁内的二次检查处理"快速路径通过后被 shutdown"的竞态。

### 4. shutdown 先置标志后清指针

```cpp
void shutdown() {
    g_active.store(false, std::memory_order_release);   // 1. 先断开入口
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_loop = nullptr;                                // 2. 再清资源
        g_handler = nullptr;
    }
}
```

顺序反过来的后果：

```text
清 g_loop 后、置标志前，另一个线程的 postEvent 拿到锁，
g_active 还是 true，但 g_loop 已经是 nullptr → 空指针解引用
```

`release` 语义保证 `g_active=false` 对其他线程立即可见。

### 5. handler 拷贝到锁外调用

```cpp
PlatformEventSink::EventHandler handler;
{
    std::lock_guard<std::mutex> lock(g_mutex);
    handler = g_handler;     // 拷贝
}
loop->post([handler = std::move(handler), ...]{ ... });   // 锁外使用
```

两个原因：

```text
1. 避免嵌套锁
   loop->post() 内部有自己的 mutex。持我们的锁调用它 →
   锁获取顺序：g_mutex → loop.mutex_
   如果有另一条路径是反向顺序 → 死锁。锁外调用彻底避免。

2. 生命周期安全
   std::function 拷贝会复制捕获的对象。即使 shutdown 清空了 g_handler，
   本次调用持有的副本仍然有效。
```

### 6. 字符串参数用 const char* 而不是 std::string

```cpp
using SetAttrFn = void (*)(int id, const char* key, const char* value);
```

`std::string` 无法跨语言边界：C 代码（LVGL）和 Objective-C 无法构造 C++ 对象。而且 `std::string` 的 ABI 在不同编译器/标准库版本间不兼容，静态库和平台代码用不同工具链编译时会出问题。

代价是平台侧需要自己拷贝（如果要保存）。这个约定写在了头文件注释里。

### 7. isReady() 只检查必需能力

```cpp
bool isReady() const noexcept {
    return createElement && setAttr && setStyle;   // 不检查 setEvent 等
}
```

场景：只读展示的快应用（如资讯页）不需要事件处理，平台可以不实现 `setEvent`。如果 `isReady()` 要求全部实现，这类场景就得写空函数。

Core 侧对可选能力单独检查：

```cpp
if (bridge.setEvent != nullptr) { bridge.setEvent(...); }
```

### 8. showToast 暂时放在 PlatformBridge

严格说 `showToast` 不是渲染命令，它是平台服务。V1 放在一起是为了避免过早引入第三个结构体。

V2 当能力增多（vibrate/clipboard/share/geolocation）时应拆分：

```cpp
struct PlatformServiceBridge {
    void (*showToast)(const char* message);
    void (*vibrate)(int durationMs);
    void (*setClipboard)(const char* text);
};
```

拆分成本很低（改 `prompt_module.cpp` 一处调用），所以不需要现在就做。

---

## QA

### 1. 为什么 Core 不负责 UI 线程调度

因为三端的 UI 线程模型完全不同：

```text
Android  runOnUiThread / Handler.post / View.post
iOS      dispatch_async(dispatch_get_main_queue(), ...)
LVGL     lv_timer_create 或直接在主循环调用（可能根本没有多线程）
```

Core 如果要统一处理，就得抽象出"UI Dispatcher"接口，然后每个平台实现它。但平台实现 `PlatformBridge` 时顺手做线程切换的成本更低：

```cpp
// Android 侧实现
static void jniCreateElement(int id, const char* type, float x, float y,
                            float w, float h) {
    // 直接在这里切线程，Core 不需要知道
    postToUiThread([=] {
        callKotlinCreateElement(id, type, x, y, w, h);
    });
}
```

而且某些平台可能不需要切线程（LVGL 单线程），强制走 Dispatcher 反而是浪费。

### 2. 渲染命令会不会因为跨线程而乱序

不会，前提是平台实现正确。

```text
Core 侧：在 Runtime Thread 顺序调用
    createElement(1) → createElement(2) → setAttr(2) → setStyle(2)

平台侧：如果用 FIFO 队列投递到 UI 线程
    Android: Handler.post 保证 FIFO
    iOS: dispatch_async 到 serial queue 保证 FIFO
    → 顺序保持
```

平台实现如果用了并发队列（`dispatch_async` 到 concurrent queue），顺序就乱了。这个要求写在 `PlatformBridge` 的注释里，Step 11 的各平台实现会遵循。

### 3. 事件里的 nodeId 从哪来

`PlatformBridge.createElement(id, ...)` 时 Core 分配的 ID。平台建立 `id → 原生控件` 映射，事件发生时反查出 ID 传回：

```kotlin
// Android 侧
fun createElement(id: Int, type: String, ...) {
    val view = TextView(context)
    viewMap[id] = view                  // 正向映射
    view.tag = id                       // 反向：控件上记住自己的 id
}

fun setEvent(id: Int, eventType: String, methodName: String) {
    viewMap[id]?.setOnClickListener { v ->
        nativeDispatchClick(v.tag as Int)   // 用 tag 取回 id
    }
}
```

Core 侧收到 `nodeId` 后查 VNode 树找到 `events["click"]` 的方法名，再调 JS。

### 4. 为什么 setEvent 要传 methodName 给平台

平台确实不需要它来完成功能。传过去的用途：

```text
1. 调试可见性
   日志里能看到 "node 5 bound click → onSubmit"，
   排查"点击没反应"时能确认绑定是否发生

2. 无障碍支持
   平台可以用它生成 accessibility label

3. 平台侧优化
   某些平台可能想根据方法名做特殊处理（如识别 "onLongPress"）
```

如果确认完全不需要，可以简化为 `setEvent(id, eventType)`。V1 保留是因为成本几乎为零（一个字符串指针）。

### 5. PlatformEventSink 为什么不直接调 JS

因为它不该知道 JS 的存在。职责划分：

```text
PlatformEventSink  负责线程切换和生命周期安全
EventHandler       由 RuntimeBootstrap 提供（Step 10），内部：
                       查 VNode 树 → 找到方法名 → 通过 JS Bridge 调用 JS
```

这样 `PlatformEventSink` 可以在没有 JS 的场景复用（比如纯 C++ 的测试、或者将来的 native-only 页面）。

Step 10 的接线代码大致是：

```cpp
PlatformEventSink::initialize(loop, [this](const PlatformEvent& e) {
    switch (e.type) {
        case PlatformEventType::Click:
            invokeVMMethod(findEventHandler(e.nodeId, "click"));
            break;
        // ...
    }
});
```

### 6. 多个 Runtime 实例会冲突吗

会。当前设计明确只支持单 Runtime：

```cpp
PlatformBridge g_platformBridge{};     // 全局单例
std::mutex g_mutex;                     // EventSink 也是全局
RuntimeEventLoop* g_loop = nullptr;
```

第二个 Runtime 注册 bridge 会覆盖第一个的。

支持多 Runtime 需要的改动：

```text
1. PlatformBridge 从全局变量移到 Runtime 对象内部
2. Core 各模块通过 Runtime 上下文访问 bridge（而不是全局函数）
3. PlatformEventSink 改为实例，平台侧需要区分事件属于哪个 Runtime
4. 事件里增加 runtimeId 字段
```

快应用场景下单 Runtime 够用（一次只运行一个快应用）。多 Runtime 是 V2 考虑的事情。

### 7. 未注册 bridge 时 Core 会崩溃吗

不会，前提是调用方遵守约定：

```cpp
const auto& bridge = getPlatformBridge();
if (!bridge.isReady()) return;      // 必须检查
bridge.createElement(...);
```

`clearPlatformBridge()` 把所有指针设为 `nullptr`，`isReady()` 返回 false。如果调用方忘记检查直接调用 `nullptr` 函数指针，会立即崩溃（这是好事，比静默错误容易发现）。

Step 09/10 的渲染代码统一走 6.2.3 的模式，保证每次都检查。

### 8. Step 06 完成后得到了什么

Core 和平台之间的完整契约：

```text
✓ include/platform_bridge.h        6 个渲染命令 + isReady 检查
✓ src/platform_bridge.cpp          注册/获取/清空 + 能力日志
✓ include/platform_event_sink.h    4 类事件 + 线程安全投递
✓ src/platform_event_sink.cpp      double-checked + 生命周期安全
✓ tests/test_platform_bridge.cpp   2 组共 13 个场景全部通过
✓ TSan 验证：4 线程并发 100 事件无数据竞争
✓ ASan 验证：20 轮创建销毁无 use-after-free
✓ 通道独立性验证：两个文件零交叉引用
```

到这里 Core 的"骨架"完成了：能执行 JS（Step 04）、能调度任务（Step 05）、能和平台双向通信（Step 06）。

接下来三步填充业务逻辑：Step 07 给 JS 注入快应用 API，Step 08 加载 RPK，Step 09 构建渲染管线。

---

## 下一步

按 `tasks.md` 进入 Step 07：实现 `NativeModule` 基类、`ModuleRegistry` 注册表和 JS Bridge 注入，让 JS 能调用 `$app_require$("@app-module/system.router")` 这类快应用 API。
