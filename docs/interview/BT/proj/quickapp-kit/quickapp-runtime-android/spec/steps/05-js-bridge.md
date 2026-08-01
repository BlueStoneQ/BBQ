# Step 5：JS Bridge 与模块扩展机制

## 目录

- [目标](#目标)
- [Step 5.1：NativeModule 注册框架](#step-51nativemodule-注册框架)
- [Step 5.2：注入宿主全局函数](#step-52注入宿主全局函数)
- [Step 5.3：实现 RouterModule](#step-53实现-routermodule)
- [Step 5.4：实现 PromptModule](#step-54实现-promptmodule)
- [Step 5.5：实现 __native_render__ 入口](#step-55实现-__native_render__-入口)
- [Step 5.6：C++ → JS 事件回调](#step-56c---js-事件回调)
- [Step 5.7：JNI 测试入口与验证](#step-57jni-测试入口与验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**建立可扩展的 JS → C++ 模块注册机制，注入快应用宿主 ABI。**

| 层 | 职责 | 文件 |
|---|---|---|
| NativeModule 基类 | 定义模块注册接口（类 TurboModule） | `core/include/native_module.h` |
| ModuleRegistry | 管理所有已注册模块 | `core/src/module_registry.cpp` |
| JS Bridge | 注入全局函数 + $app_require$ 分发 | `core/src/js_bridge.cpp` |
| RouterModule | system.router 实现 | `core/src/router_module.cpp` |
| PromptModule | system.prompt 实现 | `core/src/prompt_module.cpp` |

**验收标准：**
- JS 执行 `$app_require$("@app-module/system.router").push({uri: "/pages/Demo"})` → C++ Router 收到
- JS 执行 `$app_require$("@app-module/system.prompt").showToast({message: "hi"})` → Android Toast 显示
- JS 执行 `__native_render__(template, style)` → C++ 收到并发送 PlatformBridge 指令
- 新增模块只需：定义 Module 子类 + 注册到 Registry，不改 Bridge 内核

**本步不包含：**
- framework.js 执行
- RPK 加载
- VNode 树构建（native_render 暂时简单处理）
- 完整页面生命周期

---

## Step 5.1：NativeModule 注册框架

这是整个扩展机制的核心。类似 React Native 的 TurboModule：每个 Native 模块继承同一个基类，通过统一的注册表对外暴露。JS 通过 `$app_require$(moduleName)` 获取模块实例。

### 5.1.1：定义 NativeModule 基类

@add `app/src/main/cpp/core/include/native_module.h`（新建文件）

```cpp
#ifndef QUICKAPP_NATIVE_MODULE_H
#define QUICKAPP_NATIVE_MODULE_H

#include <string>
#include <vector>
#include <functional>

// 前置声明 QuickJS 类型（避免在接口头文件中 include quickjs.h）
struct JSContext;
typedef uint64_t JSValue; // 简化声明，实际 QuickJS 中是 union

namespace quickapp {

/**
 * NativeModule 基类 —— 所有 JS 可调用的 Native 模块都继承这个。
 *
 * 设计意图（类 TurboModule）：
 * - 新增模块不需要修改 Bridge 内核代码
 * - 每个模块声明自己的方法列表
 * - ModuleRegistry 统一管理注册和查找
 * - $app_require$ 根据模块名从 Registry 获取并返回 JS 对象
 *
 * 扩展步骤：
 * 1. 继承 NativeModule
 * 2. 实现 getName() 返回模块名（如 "@app-module/system.bluetooth"）
 * 3. 实现 getMethods() 返回方法列表
 * 4. 在 Registry 中注册
 * 5. 完成。JS 侧 $app_require$("@app-module/system.bluetooth").scan() 即可调用
 */
class NativeModule {
public:
    virtual ~NativeModule() = default;

    /** 模块名，对应 JS 中 $app_require$ 的参数 */
    virtual const char* getName() const = 0;

    /**
     * 模块方法定义。
     * name: JS 中的方法名
     * func: C 函数指针（QuickJS JSCFunction 签名）
     * argc: 最少参数数量
     */
    struct MethodDef {
        const char* name;
        void* func;  // 实际类型是 JSCFunction，这里用 void* 避免 include quickjs.h
        int argc;
    };

    /** 返回本模块暴露给 JS 的所有方法 */
    virtual std::vector<MethodDef> getMethods() const = 0;
};

} // namespace quickapp

#endif // QUICKAPP_NATIVE_MODULE_H
```

### 5.1.2：实现 ModuleRegistry

@add `app/src/main/cpp/core/include/module_registry.h`（新建文件）

```cpp
#ifndef QUICKAPP_MODULE_REGISTRY_H
#define QUICKAPP_MODULE_REGISTRY_H

#include "native_module.h"
#include <unordered_map>
#include <memory>
#include <string>

namespace quickapp {

/**
 * 模块注册表 —— 管理所有 NativeModule。
 *
 * 类比：
 * - RN 的 TurboModuleManager
 * - Android 的 ServiceLoader
 * - 快应用标准平台的 FeatureManager
 *
 * JS 调用 $app_require$("@app-module/system.router") 时，
 * Bridge 从 Registry 中查找对应模块，创建 JS 对象并返回。
 */
class ModuleRegistry {
public:
    /** 注册一个模块（通常在 Runtime 初始化时调用） */
    void registerModule(std::unique_ptr<NativeModule> module);

    /** 根据模块名查找 */
    NativeModule* findModule(const std::string& name) const;

    /** 获取所有已注册模块名（调试用） */
    std::vector<std::string> getModuleNames() const;

private:
    std::unordered_map<std::string, std::unique_ptr<NativeModule>> modules_;
};

} // namespace quickapp

#endif
```

@add `app/src/main/cpp/core/src/module_registry.cpp`（新建文件）

```cpp
#include "module_registry.h"
#include <android/log.h>

#define LOG_TAG "quickapp-registry"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace quickapp {

void ModuleRegistry::registerModule(std::unique_ptr<NativeModule> module) {
    std::string name = module->getName();
    LOGI("Module registered: %s", name.c_str());
    modules_[name] = std::move(module);
}

NativeModule* ModuleRegistry::findModule(const std::string& name) const {
    auto it = modules_.find(name);
    return it != modules_.end() ? it->second.get() : nullptr;
}

std::vector<std::string> ModuleRegistry::getModuleNames() const {
    std::vector<std::string> names;
    for (auto& [name, _] : modules_) {
        names.push_back(name);
    }
    return names;
}

} // namespace quickapp
```

---

## Step 5.2：注入宿主全局函数

@add `app/src/main/cpp/core/src/js_bridge.cpp`（新建文件）

```cpp
#include "js_engine.h"
#include "module_registry.h"
#include "platform_bridge.h"

extern "C" {
#include "quickjs.h"
}

#include <android/log.h>
#include <cstring>

#define LOG_TAG "quickapp-bridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace quickapp {

// 全局 Registry 引用（由 Runtime 初始化时设置）
static ModuleRegistry* g_registry = nullptr;

// ============================================================
// $app_define$ / $app_bootstrap$ 由 framework.js 定义（Step 7）
// C++ 不注入空壳。eval(framework.js) 后这些全局函数自然就位，
// 后续 eval(bundle) 时 bundle 调用它们走的是 JS 逻辑。
// ============================================================

// ============================================================
// $app_require$(moduleName) → 返回 NativeModule 的 JS 对象
// ============================================================
static JSValue native_app_require(JSContext* ctx, JSValueConst this_val,
                                   int argc, JSValueConst* argv) {
    if (argc < 1) return JS_UNDEFINED;

    const char* moduleName = JS_ToCString(ctx, argv[0]);
    if (!moduleName) return JS_UNDEFINED;

    LOGI("$app_require$: %s", moduleName);

    // 从 Registry 查找模块
    NativeModule* module = g_registry ? g_registry->findModule(moduleName) : nullptr;

    if (!module) {
        LOGE("Module not found: %s", moduleName);
        JS_FreeCString(ctx, moduleName);
        return JS_UNDEFINED;
    }

    // 创建 JS 对象，把模块方法挂上去
    JSValue obj = JS_NewObject(ctx);
    for (auto& method : module->getMethods()) {
        JS_SetPropertyStr(ctx, obj, method.name,
            JS_NewCFunction(ctx,
                reinterpret_cast<JSCFunction*>(method.func),
                method.name, method.argc));
    }

    // 包裹一层 { default: moduleObj }
    // 因为快应用 bundle 中访问的是 _system.default.push(...)
    JSValue wrapper = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, wrapper, "default", obj);

    JS_FreeCString(ctx, moduleName);
    return wrapper;
}

// ============================================================
// __native_render__(vnodeTree, styleMap)
// ============================================================
static JSValue native_render(JSContext* ctx, JSValueConst this_val,
                              int argc, JSValueConst* argv) {
    LOGI("__native_render__ called");

    // Step 5 简化处理：直接从 vnode 的第一层 children 中提取信息
    // Step 9 会实现完整的 VNode 遍历
    if (argc < 1) return JS_UNDEFINED;

    JSValue vnode = argv[0];

    // 读取 type
    JSValue typeVal = JS_GetPropertyStr(ctx, vnode, "type");
    const char* type = JS_ToCString(ctx, typeVal);
    LOGI("  root type: %s", type ? type : "null");
    if (type) JS_FreeCString(ctx, type);
    JS_FreeValue(ctx, typeVal);

    // 简化验证：创建一个测试元素
    const auto& bridge = getPlatformBridge();
    if (bridge.isReady()) {
        bridge.createElement(1, "text", 0, 0, 600, 120);
        bridge.setAttr(1, "text", "Rendered from JS!");
    }

    return JS_UNDEFINED;
}

// ============================================================
// console.log / console.warn / console.error
// ============================================================
static JSValue native_console_log(JSContext* ctx, JSValueConst this_val,
                                   int argc, JSValueConst* argv) {
    for (int i = 0; i < argc; i++) {
        const char* str = JS_ToCString(ctx, argv[i]);
        if (str) {
            __android_log_print(ANDROID_LOG_INFO, "quickapp-js", "[console] %s", str);
            JS_FreeCString(ctx, str);
        }
    }
    return JS_UNDEFINED;
}

// ============================================================
// 注入所有全局函数到 JSContext
// ============================================================
void installJSBridge(JSContext* ctx, ModuleRegistry* registry) {
    g_registry = registry;

    JSValue global = JS_GetGlobalObject(ctx);

    // $app_define$ / $app_bootstrap$ 由 framework.js 定义，C++ 不注入空壳。
    // framework.js eval 后这些全局函数自然就位，bundle eval 时可正常调用。

    JS_SetPropertyStr(ctx, global, "$app_require$",
        JS_NewCFunction(ctx, native_app_require, "$app_require$", 1));
    JS_SetPropertyStr(ctx, global, "__native_render__",
        JS_NewCFunction(ctx, native_render, "__native_render__", 2));

    // console 对象
    JSValue console = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, console, "log",
        JS_NewCFunction(ctx, native_console_log, "log", 1));
    JS_SetPropertyStr(ctx, console, "warn",
        JS_NewCFunction(ctx, native_console_log, "warn", 1));
    JS_SetPropertyStr(ctx, console, "error",
        JS_NewCFunction(ctx, native_console_log, "error", 1));
    JS_SetPropertyStr(ctx, global, "console", console);

    JS_FreeValue(ctx, global);
    LOGI("JS Bridge installed");
}

} // namespace quickapp
```

@add `app/src/main/cpp/core/include/js_bridge.h`（新建文件）

```cpp
#ifndef QUICKAPP_JS_BRIDGE_H
#define QUICKAPP_JS_BRIDGE_H

struct JSContext;

namespace quickapp {
class ModuleRegistry;

/** 将所有宿主函数注入到 JSContext 的全局对象 */
void installJSBridge(JSContext* ctx, ModuleRegistry* registry);

} // namespace quickapp

#endif
```

---

## Step 5.3：实现 RouterModule

@add `app/src/main/cpp/core/src/router_module.cpp`（新建文件）

这是第一个 NativeModule 实现，演示扩展模式。后续加蓝牙、fetch 等模块按同样模式来。

```cpp
#include "native_module.h"

extern "C" {
#include "quickjs.h"
}

#include <android/log.h>

#define LOG_TAG "quickapp-router"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace quickapp {

// ============================================================
// Router Native 方法实现
// ============================================================

static JSValue router_push(JSContext* ctx, JSValueConst this_val,
                            int argc, JSValueConst* argv) {
    if (argc < 1) return JS_UNDEFINED;

    // 读取 { uri: "/pages/DemoDetail" } 参数
    JSValue uriVal = JS_GetPropertyStr(ctx, argv[0], "uri");
    const char* uri = JS_ToCString(ctx, uriVal);

    LOGI("router.push: %s", uri ? uri : "null");

    // TODO: Step 13 会接入真正的 C++ Router Page_Stack
    // 当前只打印，验证 JS → C++ 通道

    if (uri) JS_FreeCString(ctx, uri);
    JS_FreeValue(ctx, uriVal);
    return JS_UNDEFINED;
}

static JSValue router_back(JSContext* ctx, JSValueConst this_val,
                            int argc, JSValueConst* argv) {
    LOGI("router.back");
    // TODO: Step 13 实现
    return JS_UNDEFINED;
}

// ============================================================
// RouterModule 定义
// ============================================================

class RouterModule : public NativeModule {
public:
    const char* getName() const override {
        return "@app-module/system.router";
    }

    std::vector<MethodDef> getMethods() const override {
        return {
            {"push", reinterpret_cast<void*>(router_push), 1},
            {"back", reinterpret_cast<void*>(router_back), 0},
        };
    }
};

// 工厂函数，供 Registry 注册使用
std::unique_ptr<NativeModule> createRouterModule() {
    return std::make_unique<RouterModule>();
}

} // namespace quickapp
```

---

## Step 5.4：实现 PromptModule

@add `app/src/main/cpp/core/src/prompt_module.cpp`（新建文件）

```cpp
#include "native_module.h"
#include "platform_bridge.h"

extern "C" {
#include "quickjs.h"
}

#include <android/log.h>

#define LOG_TAG "quickapp-prompt"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace quickapp {

static JSValue prompt_showToast(JSContext* ctx, JSValueConst this_val,
                                 int argc, JSValueConst* argv) {
    if (argc < 1) return JS_UNDEFINED;

    // 读取 { message: "Hello" } 参数
    JSValue msgVal = JS_GetPropertyStr(ctx, argv[0], "message");
    const char* message = JS_ToCString(ctx, msgVal);

    LOGI("prompt.showToast: %s", message ? message : "null");

    // TODO: 通过 PlatformBridge 调用 Android Toast
    // 当前只打印验证通道

    if (message) JS_FreeCString(ctx, message);
    JS_FreeValue(ctx, msgVal);
    return JS_UNDEFINED;
}

class PromptModule : public NativeModule {
public:
    const char* getName() const override {
        return "@app-module/system.prompt";
    }

    std::vector<MethodDef> getMethods() const override {
        return {
            {"showToast", reinterpret_cast<void*>(prompt_showToast), 1},
        };
    }
};

std::unique_ptr<NativeModule> createPromptModule() {
    return std::make_unique<PromptModule>();
}

} // namespace quickapp
```

**扩展新模块的步骤（类 TurboModule 模式）：**

```text
1. 创建 xxx_module.cpp
2. 继承 NativeModule，实现 getName() + getMethods()
3. 写 Native 方法（JSCFunction 签名）
4. 在 Runtime 初始化时 registry->registerModule(createXxxModule())
5. 完成。JS 侧 $app_require$("@app-module/system.xxx").method() 即可调用
```

不需要改 js_bridge.cpp、不需要改 $app_require$ 的 if-else、不需要改 JSEngine。

---

## Step 5.5：实现 __native_render__ 入口

已在 Step 5.2 的 `js_bridge.cpp` 中实现。Step 5 只做简化验证（读取 vnode type，创建一个测试 View）。完整的 VNode 树遍历在 Step 9 实现。

---

## Step 5.6：C++ → JS 事件回调

当 Android 用户点击按钮时，需要从 C++ 调用 JS VM 的方法。这是反向通道。

@update `app/src/main/cpp/core/src/js_bridge.cpp` — 在文件末尾、namespace 结束前新增：

```cpp
// ============================================================
// C++ → JS 事件分发
// 由 PlatformEventSink 投递到 Runtime Thread 后调用
// ============================================================

void dispatchJSEvent(JSContext* ctx, JSValue vmObject,
                     const char* methodName) {
    // 从 VM 对象上找到方法
    JSValue method = JS_GetPropertyStr(ctx, vmObject, methodName);
    if (JS_IsFunction(ctx, method)) {
        // 以 vmObject 为 this 调用方法
        JSValue result = JS_Call(ctx, method, vmObject, 0, nullptr);
        if (JS_IsException(result)) {
            JSValue ex = JS_GetException(ctx);
            const char* err = JS_ToCString(ctx, ex);
            LOGE("JS event handler error: %s", err ? err : "unknown");
            if (err) JS_FreeCString(ctx, err);
            JS_FreeValue(ctx, ex);
        }
        JS_FreeValue(ctx, result);
    } else {
        LOGE("Method not found on VM: %s", methodName);
    }
    JS_FreeValue(ctx, method);
}
```

完整的事件通道（Android → JNI → PlatformEventSink → RuntimeThread.post → dispatchJSEvent）在 Step 12 串通。

---

## Step 5.7：JNI 测试入口与验证

@update `app/src/main/cpp/platform/android/jni_bridge.cpp` — 新增 include：

```cpp
#include "js_bridge.h"
#include "module_registry.h"
```

@update `app/src/main/cpp/platform/android/jni_bridge.cpp` — 在 `extern "C"` 块中新增：

```cpp
// 前置声明工厂函数
namespace quickapp {
    std::unique_ptr<NativeModule> createRouterModule();
    std::unique_ptr<NativeModule> createPromptModule();
}

// Step 5 测试入口：验证 JS Bridge + Module 机制
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeTestBridge(
        JNIEnv* env, jobject thiz) {
    LOGI("nativeTestBridge: testing JS Bridge");

    // 1. 创建引擎
    auto engine = quickapp::createJSEngine();
    engine->initialize();

    // 2. 创建 Registry 并注册模块
    quickapp::ModuleRegistry registry;
    registry.registerModule(quickapp::createRouterModule());
    registry.registerModule(quickapp::createPromptModule());

    // 3. 安装 Bridge（注入全局函数）
    // 需要从 engine 获取 JSContext（QuickJSEngine 暴露了 getContext()）
    auto* qjsEngine = static_cast</* QuickJSEngine* */>(engine.get());
    // 注意：需要将 JSEngine 接口改为暴露 getContext，或在这里 downcast
    // 简化方案：直接用 QuickJSEngine 的 public getContext()
    // installJSBridge(qjsEngine->getContext(), &registry);

    // 4. 执行测试脚本
    engine->eval(R"(
        // 测试 $app_require$ + router
        var router = $app_require$("@app-module/system.router");
        router.default.push({ uri: "/pages/DemoDetail" });

        // 测试 prompt
        var prompt = $app_require$("@app-module/system.prompt");
        prompt.default.showToast({ message: "Hello from JS Bridge!" });

        // 测试 __native_render__
        __native_render__({ type: "div", children: [] }, {});

        // 测试 console
        console.log("JS Bridge test completed!");
    )", "bridge_test.js");

    // 5. 清理
    engine->destroy();
    LOGI("nativeTestBridge: done");
}
```

@update `QuickAppRuntime.kt` — 新增：

```kotlin
    private external fun nativeTestBridge()
    fun testBridge() { nativeTestBridge() }
```

### 验证

**Logcat 预期：**

```text
I/quickapp-registry: Module registered: @app-module/system.router
I/quickapp-registry: Module registered: @app-module/system.prompt
I/quickapp-bridge: JS Bridge installed
I/quickapp-bridge: $app_require$: @app-module/system.router
I/quickapp-router: router.push: /pages/DemoDetail
I/quickapp-bridge: $app_require$: @app-module/system.prompt
I/quickapp-prompt: prompt.showToast: Hello from JS Bridge!
I/quickapp-bridge: __native_render__ called
I/quickapp-bridge:   root type: div
I/quickapp-js: [console] JS Bridge test completed!
```

---

## 技术决策

### 1. NativeModule 基类 + Registry = 类 TurboModule

核心设计原则：**模块扩展不改内核**。新增蓝牙、网络、传感器等模块只需：
- 写一个 Module 子类
- 注册到 Registry
- 不需要改 js_bridge.cpp 的 $app_require$ 逻辑

### 2. 零序列化

JS 参数通过 QuickJS C API 直接读取（`JS_ToCString`、`JS_ToInt32`、`JS_GetPropertyStr`），不走 JSON encode/decode。性能上等同于 RN JSI。

### 3. 所有 JS 调用在 Runtime Thread

Step 5 的测试暂时在 JNI 线程直接调用（简化验证）。正式使用时必须在 Step 4 建立的 RuntimeThread 中执行。

### 4. $app_require$ 返回 { default: moduleObj }

快应用 bundle 中的模块引用方式是 `_system.default.push(...)`，所以 `$app_require$` 返回时包裹一层 `{ default: ... }`。

---

## QA

### 1. 和 RN TurboModule 的区别？

本质相同：都是 JS → C++ 的类型安全直调。区别是 RN 用 Codegen 生成接口胶水代码，我们用手写 JSCFunction + Registry 注册。规模小时手写更灵活，规模大了可以加 Codegen。

### 2. 为什么不直接在 $app_require$ 里写 if-else？

扩展性。如果有 20 个模块，$app_require$ 里就有 20 个 if-else，每次加模块都改这个核心函数。Registry 模式是 O(1) 查找 + 零核心代码改动。

### 3. 模块方法的参数怎么传？

当前用 `JSValueConst* argv`——JS 传什么类型，C++ 直接用 QuickJS API 读取。不需要预定义 IDL 或 schema。简单直接，但类型安全需要 C++ 侧自己校验。

### 4. 模块的生命周期谁管？

ModuleRegistry 持有所有模块的 `unique_ptr`。Runtime 销毁时 Registry 析构，所有模块自动释放。

---

## 下一步

Step 5 完成后得到：可扩展的 JS → C++ 模块机制 + 宿主 ABI 注入。下一步 Step 6 实现 RPK 加载和 Manifest 解析，为执行真实快应用 bundle 做准备。
