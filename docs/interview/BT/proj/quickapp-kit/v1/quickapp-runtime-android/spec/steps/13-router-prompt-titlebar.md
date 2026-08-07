# Step 13：Router 页面导航 + Toast + TitleBar

## 目录

- [目标](#目标)
- [Step 13.1：C++ Router 实现](#step-131c-router-实现)
- [Step 13.2：页面切换流程](#step-132页面切换流程)
- [Step 13.3：Prompt showToast 实现](#step-133prompt-showtoast-实现)
- [Step 13.4：TitleBar 跟随页面更新](#step-134titlebar-跟随页面更新)
- [Step 13.5：验证](#step-135验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**实现真正的页面导航、Toast 和 TitleBar 联动。**

| 层 | 职责 | 文件 |
|---|---|---|
| Router | C++ Page Stack 管理 | `core/src/router.cpp` |
| PlatformBridge | 新增 showToast/clearView/updateTitleBar | `platform_bridge.h` 更新 |
| Kotlin | Toast 显示、容器清空、TitleBar 更新 | `ViewRenderer.kt` / `QuickAppRuntime.kt` |

**验收标准：**
- 点击 Demo 按钮 → router.push → 导航到 DemoDetail
- DemoDetail 页面正确渲染（新 TitleBar + 新内容）
- DemoDetail 按钮 → showToast → Android Toast 显示
- router.back → 返回 Demo 页面
- Android Activity 栈不参与页面路由（单 Activity）

**本步不包含：**
- 页面转场动画
- 页面缓存/恢复
- 深度链接

---

## Step 13.1：C++ Router 实现

@add `app/src/main/cpp/core/include/router.h`（新建文件）

```cpp
#ifndef QUICKAPP_ROUTER_H
#define QUICKAPP_ROUTER_H

#include <string>
#include <vector>
#include <functional>

namespace quickapp {

struct Page {
    std::string uri;        // "pages/Demo"
    std::string bundlePath; // "pages/Demo/index.js"
};

/**
 * C++ Router —— 管理页面栈。
 *
 * 单 Activity 模型：Android 只有一个 Activity，页面切换由 Router 控制。
 * push 加载新页面 bundle，back 弹出栈顶回到上一页。
 */
class Router {
public:
    using NavigateCallback = std::function<void(const std::string& uri)>;

    void setNavigateCallback(NavigateCallback cb) { navigateCb_ = std::move(cb); }

    void push(const std::string& uri);
    void back();

    const Page& current() const;
    size_t stackSize() const { return pageStack_.size(); }

private:
    std::vector<Page> pageStack_;
    NavigateCallback navigateCb_;
};

} // namespace quickapp

#endif
```

@add `app/src/main/cpp/core/src/router.cpp`（新建文件）

```cpp
#include "router.h"
#include <android/log.h>

#define LOG_TAG "quickapp-router"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace quickapp {

void Router::push(const std::string& uri) {
    // uri 格式: "/pages/DemoDetail" → 去掉前导 /
    std::string cleanUri = uri;
    if (!cleanUri.empty() && cleanUri[0] == '/') cleanUri = cleanUri.substr(1);

    Page page;
    page.uri = cleanUri;
    page.bundlePath = cleanUri + "/index.js";

    pageStack_.push_back(page);
    LOGI("push: %s (stack size=%zu)", cleanUri.c_str(), pageStack_.size());

    // 通知外部执行页面加载和渲染
    if (navigateCb_) navigateCb_(cleanUri);
}

void Router::back() {
    if (pageStack_.size() <= 1) {
        LOGI("back: already at root, cannot go back");
        return;
    }

    pageStack_.pop_back();
    const auto& current = pageStack_.back();
    LOGI("back: returning to %s (stack size=%zu)", current.uri.c_str(), pageStack_.size());

    if (navigateCb_) navigateCb_(current.uri);
}

const Page& Router::current() const {
    static Page empty{};
    return pageStack_.empty() ? empty : pageStack_.back();
}

} // namespace quickapp
```

---

## Step 13.2：页面切换流程

当 router.push 被调用时，NavigateCallback 触发以下序列：

```text
router.push("/pages/DemoDetail")
    → Router.push() → 入栈
    → NavigateCallback(uri)
    → RuntimeThread 中执行：
        1. PlatformBridge.clearView()     → Kotlin 清空容器
        2. RPKLoader.readText(bundlePath)  → 读取新 bundle
        3. engine->eval(pageBundle)        → 执行新 bundle
        4. framework.js $app_bootstrap$    → 新 VM + onInit + __native_render__
        5. 新页面渲染到屏幕
        6. PlatformBridge.updateTitleBar() → 更新 TitleBar
```

@update `platform_bridge.h` — 新增命令：

```cpp
    /** 清空渲染容器（页面切换前调用） */
    using ClearViewFn = void (*)();
    ClearViewFn clearView = nullptr;

    /** 显示 Toast */
    using ShowToastFn = void (*)(const char* message);
    ShowToastFn showToast = nullptr;

    /** 更新 TitleBar */
    using UpdateTitleBarFn = void (*)(const char* text, const char* bgColor, const char* textColor);
    UpdateTitleBarFn updateTitleBar = nullptr;
```

---

## Step 13.3：Prompt showToast 实现

@update `core/src/prompt_module.cpp` — 完善 showToast：

```cpp
static JSValue prompt_showToast(JSContext* ctx, JSValueConst this_val,
                                 int argc, JSValueConst* argv) {
    if (argc < 1) return JS_UNDEFINED;

    JSValue msgVal = JS_GetPropertyStr(ctx, argv[0], "message");
    const char* message = JS_ToCString(ctx, msgVal);

    // 通过 PlatformBridge 调用平台 Toast
    const auto& bridge = quickapp::getPlatformBridge();
    if (bridge.showToast && message) {
        bridge.showToast(message);
    }

    if (message) JS_FreeCString(ctx, message);
    JS_FreeValue(ctx, msgVal);
    return JS_UNDEFINED;
}
```

JNI 侧 showToast 实现：

```cpp
static void jniShowToast(const char* message) {
    JNIEnv* env = getJNIEnv();
    if (!env || !g_runtimeObject || !g_runtimeClass) return;

    jstring jMsg = env->NewStringUTF(message);
    jmethodID methodID = env->GetMethodID(g_runtimeClass, "showToast", "(Ljava/lang/String;)V");
    if (methodID) {
        env->CallVoidMethod(g_runtimeObject, methodID, jMsg);
    }
    env->DeleteLocalRef(jMsg);
}
```

Kotlin 侧：

```kotlin
fun showToast(message: String) {
    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
}
```

---

## Step 13.4：TitleBar 跟随页面更新

页面切换后，从 Manifest 的 display.pages 配置读取新页面的 TitleBar 信息：

```cpp
// 页面加载完成后更新 TitleBar
std::string pageUri = router.current().uri;
auto displayIt = manifest.pageDisplays.find(pageUri);
if (displayIt != manifest.pageDisplays.end()) {
    bridge.updateTitleBar(
        displayIt->second.titleBarText.c_str(),
        manifest.titleBarBgColor.c_str(),
        manifest.titleBarTextColor.c_str());
}
```

---

## Step 13.5：验证

```text
1. 启动 App → Demo 页面显示
   - TitleBar: "快应用示例模版"
   - 文本 + 按钮可见

2. 点击"跳转到详情页"
   - router.push 被调用
   - 容器清空
   - DemoDetail bundle 加载执行
   - 新页面渲染
   - TitleBar: "详情页"

3. 点击 Toast 按钮
   - Android Toast 显示

4. 返回（如果有 back 按钮或 Android back 键）
   - router.back
   - Demo 页面重新渲染
   - TitleBar 恢复
```

---

## 技术决策

1. **单 Activity + C++ Page Stack** — Activity 不参与路由，所有页面切换在 Runtime 内部管理
2. **clearView + re-render** — V1 页面切换时完全清空重渲染，不做增量/缓存
3. **NavigateCallback 解耦** — Router 只管栈逻辑，实际的 bundle 加载和渲染由回调处理

---

## QA

### 1. Android 返回键怎么处理？
拦截 `onBackPressed`，如果 Router stack > 1 调用 router.back()，否则退出 Activity。

### 2. 页面间怎么传参？
V1 不传参。V2 可以在 push 时携带 params，通过 VM.$page.params 访问。

### 3. 为什么不用 Fragment？
快应用的页面模型是 JS 驱动的，不是 Android UI 框架驱动的。Fragment 的生命周期和快应用的不匹配，反而增加复杂度。

---

## 下一步

Step 13 完成后，quickapp-runtime-android 的核心功能链路全部跑通。进入 Phase 4 做端到端验证（Task 4.1-4.4）。
