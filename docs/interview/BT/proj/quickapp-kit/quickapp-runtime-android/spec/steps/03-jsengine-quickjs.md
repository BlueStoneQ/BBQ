# Step 3：JSEngine Interface 与 QuickJS 实现

## 目录

- [目标](#目标)
- [Step 3.1：定义 JSEngine 抽象接口](#step-31定义-jsengine-抽象接口)
- [Step 3.2：集成 QuickJS 源码到 CMake](#step-32集成-quickjs-源码到-cmake)
- [Step 3.3：实现 QuickJSEngine](#step-33实现-quickjsengine)
- [Step 3.4：注册测试 Native 函数并验证](#step-34注册测试-native-函数并验证)
- [Step 3.5：在 MainActivity 中触发测试](#step-35在-mainactivity-中触发测试)
- [Step 3.6：逐层验证](#step-36逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**在 Android NDK 中接入 QuickJS，建立可替换的 JS 引擎抽象，验证 JS ↔ C++ 互调。**

| 层 | 职责 | 文件 |
|---|---|---|
| JSEngine 接口 | 定义引擎生命周期和执行能力（平台无关） | `core/include/js_engine.h` |
| QuickJS 实现 | 封装 QuickJS C API | `core/src/quickjs_engine.cpp` |
| CMake | 编译 QuickJS 源码 | `CMakeLists.txt` / `third_party/quickjs/` |
| JNI 测试入口 | 触发 JS 执行 | `jni_bridge.cpp` 新增方法 |

**验收标准：**
- C++ 调用 `engine->eval("nativeLog('Hello from JS')")` 后 Logcat 打印 `[JS] Hello from JS`
- JS 调用已注册的 Native 函数 `nativeAdd(1, 2)` 返回 3
- 编译通过，.so 正常生成

**本步不包含：**
- framework.js / RPK bundle 执行
- JS Bridge 的完整注入（$app_define$ 等）
- RuntimeEventLoop 和线程模型
- Promise / async

---

## Step 3.1：定义 JSEngine 抽象接口

@add `app/src/main/cpp/core/include/js_engine.h`（新建文件）

```cpp
#ifndef QUICKAPP_JS_ENGINE_H
#define QUICKAPP_JS_ENGINE_H

#include <memory>
#include <string>

// 只做前置声明，接口头文件不依赖 quickjs.h。
struct JSContext;
struct JSRuntime;

namespace quickapp {

/**
 * JS 引擎抽象接口。
 *
 * Core 通过这个接口管理引擎生命周期、执行脚本和读取错误；它不定义一个
 * 丢失 JS 类型、对象和异常语义的“字符串化 Native 函数”接口。
 */
class JSEngine {
public:
    virtual ~JSEngine() = default;

    /** 初始化引擎（创建 Runtime + Context）。 */
    virtual bool initialize() = 0;

    /** 销毁引擎。调用后不能再使用 eval 或其他方法。 */
    virtual void destroy() = 0;

    /**
     * 在全局作用域执行 UTF-8 JavaScript 源码。
     * filename 用于错误堆栈显示；返回 false 表示发生 JS 异常。
     */
    virtual bool eval(const char* script, const char* filename = "<eval>") = 0;

    virtual bool hasError() const = 0;
    virtual std::string getLastError() const = 0;
};

/**
 * QuickJS 专用的可选能力接口。
 *
 * 只有 QuickJS Adapter（Step 4 的 microtask 调度、Step 5 的 JS Bridge）依赖它；
 * Router、RPKLoader、VNode 等平台无关 Core 只依赖 JSEngine。调用方必须先
 * dynamic_cast 检查实现是否支持，不能假设所有 JS 引擎都有 QuickJS Context。
 */
class QuickJSContextProvider {
public:
    virtual ~QuickJSContextProvider() = default;
    virtual JSContext* getQuickJSContext() = 0;
    virtual JSRuntime* getQuickJSRuntime() = 0;
    virtual void drainMicrotasks() = 0;
};

/** 当前默认实现为 QuickJSEngine。 */
std::unique_ptr<JSEngine> createJSEngine();

} // namespace quickapp

#endif // QUICKAPP_JS_ENGINE_H
```

**为什么用分层接口而不是把 QuickJS 暴露给全部 Core：**

RPKLoader、Router、VNode 等平台无关模块只需 `eval`、销毁和错误信息，因此只依赖 `JSEngine`。直接操作 `JSContext`、注册 `JSCFunction` 与执行 Promise Job 是 QuickJS 专属能力，由 `QuickJSContextProvider` 隔离给 Step 4/5 的适配层使用。这样：
- 换引擎时，平台无关 Core 不改；
- 单元测试可 mock `JSEngine`；
- 需要 QuickJS ABI 的 Bridge 不能伪装成通用字符串回调；
- 接口头文件不 include `quickjs.h`。

---

## Step 3.2：集成 QuickJS 源码到 CMake

### 3.2.1：下载 QuickJS 源码

从 https://bellard.org/quickjs/ 下载最新源码，解压到：

```text
app/src/main/cpp/third_party/quickjs/
```

需要的文件（只保留这些，其他删除）：

```text
third_party/quickjs/
├── quickjs.c
├── quickjs.h
├── quickjs-libc.c
├── quickjs-libc.h
├── cutils.c
├── cutils.h
├── libbf.c
├── libregexp.c
├── libregexp.h
├── libregexp-opcode.h
├── libunicode.c
├── libunicode.h
├── libunicode-table.h
├── list.h
└── quickjs-atom.h
```

### 3.2.2：更新 CMakeLists.txt

@update `app/src/main/cpp/CMakeLists.txt`（整个替换）

```cmake
cmake_minimum_required(VERSION 3.22)
project(quickapp-runtime-core)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================
# QuickJS 静态库
# ============================================================
set(QUICKJS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/quickjs)

add_library(quickjs STATIC
    ${QUICKJS_DIR}/quickjs.c
    ${QUICKJS_DIR}/quickjs-libc.c
    ${QUICKJS_DIR}/cutils.c
    ${QUICKJS_DIR}/libbf.c
    ${QUICKJS_DIR}/libregexp.c
    ${QUICKJS_DIR}/libunicode.c
)

# QuickJS 编译需要的宏定义
target_compile_definitions(quickjs PRIVATE
    _GNU_SOURCE                    # POSIX 扩展
    CONFIG_BIGNUM                  # 启用 BigInt/BigFloat
    CONFIG_VERSION="2024-02-14"    # 版本标识
)

# QuickJS 头文件路径（PUBLIC 因为 quickjs_engine.cpp 需要 include quickjs.h）
target_include_directories(quickjs PUBLIC ${QUICKJS_DIR})

# QuickJS 是纯 C，关闭 C++ 的一些警告
target_compile_options(quickjs PRIVATE -Wno-sign-compare -Wno-unused-variable)

# ============================================================
# 主动态库：Core + Android JNI 适配
# ============================================================
add_library(quickapp-runtime-core SHARED
    core/src/platform_bridge.cpp
    core/src/quickjs_engine.cpp
    platform/android/jni_bridge.cpp
)

target_include_directories(quickapp-runtime-core PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/core/include
)

# 链接 QuickJS 静态库 + Android log 库
target_link_libraries(quickapp-runtime-core
    quickjs
    log
)
```

**关键变化（相对 Step 2）：**
- 新增 `quickjs` 静态库目标
- `add_library` 主库新增 `core/src/quickjs_engine.cpp`
- `target_link_libraries` 新增 `quickjs`

### 3.2.3：验证 QuickJS 编译

```bash
./gradlew :app:assembleDebug
```

如果出现 QuickJS 编译错误：
- `CONFIG_BIGNUM` 未定义 → 检查 `target_compile_definitions`
- `implicit declaration of function` → 确认 `_GNU_SOURCE` 已添加
- 路径找不到 → 检查 `QUICKJS_DIR` 是否正确

---

## Step 3.3：实现 QuickJSEngine

@add `app/src/main/cpp/core/src/quickjs_engine.cpp`（新建文件）

```cpp
#include "js_engine.h"

// 只有这个文件直接依赖 QuickJS 头文件
// Core 其他模块通过 JSEngine 接口访问，不 include quickjs.h
extern "C" {
#include "quickjs.h"
}

#include <android/log.h>
#include <cstring>

#define LOG_TAG "quickapp-js"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace quickapp {

// ============================================================
// QuickJSEngine 实现
// ============================================================

class QuickJSEngine : public JSEngine, public QuickJSContextProvider {
public:
    ~QuickJSEngine() override { destroy(); }

    bool initialize() override {
        // 1. 创建 JSRuntime：管理内存和 GC
        runtime_ = JS_NewRuntime();
        if (!runtime_) {
            LOGE("Failed to create JSRuntime");
            return false;
        }

        // 2. 创建 JSContext：管理执行环境（全局对象、作用域）
        //    一个 Runtime 可以有多个 Context（隔离），V1 只用一个
        context_ = JS_NewContext(runtime_);
        if (!context_) {
            LOGE("Failed to create JSContext");
            JS_FreeRuntime(runtime_);
            runtime_ = nullptr;
            return false;
        }

        LOGI("QuickJS engine initialized");
        return true;
    }

    void destroy() override {
        if (context_) {
            JS_FreeContext(context_);
            context_ = nullptr;
        }
        if (runtime_) {
            JS_FreeRuntime(runtime_);
            runtime_ = nullptr;
        }
        LOGI("QuickJS engine destroyed");
    }

    bool eval(const char* script, const char* filename) override {
        if (!context_) {
            lastError_ = "Engine not initialized";
            return false;
        }

        // JS_Eval 执行脚本，返回 JSValue
        // JS_EVAL_TYPE_GLOBAL：在全局作用域执行（不是模块）
        JSValue result = JS_Eval(
            context_,
            script,
            strlen(script),
            filename,
            JS_EVAL_TYPE_GLOBAL);

        if (JS_IsException(result)) {
            lastError_ = extractException();
            LOGE("JS error in %s: %s", filename, lastError_.c_str());
            JS_FreeValue(context_, result);
            return false;
        }

        // 执行成功，释放返回值（我们不需要 eval 的返回值）
        JS_FreeValue(context_, result);
        lastError_.clear();
        return true;
    }

    bool hasError() const override { return !lastError_.empty(); }
    std::string getLastError() const override { return lastError_; }

    JSContext* getQuickJSContext() override { return context_; }
    JSRuntime* getQuickJSRuntime() override { return runtime_; }

    void drainMicrotasks() override {
        if (!runtime_) return;

        JSContext* jobContext = nullptr;
        while (JS_ExecutePendingJob(runtime_, &jobContext) > 0) {
            // 每个 Job 都在创建 runtime_ 的同一 Runtime Thread 中执行。
        }
    }

private:
    JSRuntime* runtime_ = nullptr;
    JSContext* context_ = nullptr;
    std::string lastError_;

    /** 从 QuickJS 异常对象中提取错误信息 */
    std::string extractException() {
        JSValue exception = JS_GetException(context_);
        const char* str = JS_ToCString(context_, exception);
        std::string msg = str ? str : "Unknown JS error";
        if (str) JS_FreeCString(context_, str);

        // 尝试获取 stack trace
        JSValue stack = JS_GetPropertyStr(context_, exception, "stack");
        if (!JS_IsUndefined(stack)) {
            const char* stackStr = JS_ToCString(context_, stack);
            if (stackStr) {
                msg += "\n";
                msg += stackStr;
                JS_FreeCString(context_, stackStr);
            }
        }
        JS_FreeValue(context_, stack);
        JS_FreeValue(context_, exception);
        return msg;
    }
};

// ============================================================
// 工厂函数
// ============================================================

std::unique_ptr<JSEngine> createJSEngine() {
    return std::make_unique<QuickJSEngine>();
}

} // namespace quickapp
```

**为什么 `extern "C"` 包裹 quickjs.h：**

QuickJS 是纯 C 库，头文件没有 `extern "C"` 保护。C++ 文件 include 它时必须加上，否则 C++ 编译器会对 QuickJS 函数名做 Name Mangling，链接时找不到符号。

---

## Step 3.4：注册测试 Native 函数并验证

Step 3 的测试函数**不是** `JSEngine` 对外 API，也不尝试把任意 JS 值强行转换为字符串回调。它们只在 `QuickJSEngine::initialize()` 中用原生 QuickJS API 注册，用来证明：QuickJS 已正确创建、JS 能调用 C 函数、C 函数能向 JS 返回值。

正式的 `$app_require$`、`__native_render__`、Router/Prompt 对象和参数校验统一留在 Step 5 的 JS Bridge 中实现。

@update `app/src/main/cpp/core/src/quickjs_engine.cpp` — 在 `initialize()` 末尾、return true 之前插入：

```cpp
    // ---- 注册测试用 Native 函数 ----

    JSValue global = JS_GetGlobalObject(context_);

    // nativeLog(msg)：JS 打印到 Android Logcat
    JS_SetPropertyStr(context_, global, "nativeLog",
        JS_NewCFunction(context_, [](JSContext* ctx, JSValueConst this_val,
                int argc, JSValueConst* argv) -> JSValue {
            if (argc < 1) return JS_UNDEFINED;
            const char* msg = JS_ToCString(ctx, argv[0]);
            if (msg) {
                __android_log_print(ANDROID_LOG_INFO, "quickapp-js", "[JS] %s", msg);
                JS_FreeCString(ctx, msg);
            }
            return JS_UNDEFINED;
        }, "nativeLog", 1));

    // nativeAdd(a, b)：JS 调用 C++ 做加法，验证返回值
    JS_SetPropertyStr(context_, global, "nativeAdd",
        JS_NewCFunction(context_, [](JSContext* ctx, JSValueConst this_val,
                int argc, JSValueConst* argv) -> JSValue {
            if (argc < 2) return JS_UNDEFINED;
            int32_t a = 0, b = 0;
            JS_ToInt32(ctx, &a, argv[0]);
            JS_ToInt32(ctx, &b, argv[1]);
            __android_log_print(ANDROID_LOG_INFO, "quickapp-js",
                "[JS] nativeAdd(%d, %d) = %d", a, b, a + b);
            return JS_NewInt32(ctx, a + b);
        }, "nativeAdd", 2));

    JS_FreeValue(context_, global);

    // ---- 测试函数注册完毕 ----
```

**lambda 在 JS_NewCFunction 中的用法：**

`JS_NewCFunction` 接受的是 C 函数指针。C++ 的无捕获 lambda 可以隐式转换为函数指针，所以可以直接内联写。如果 lambda 需要捕获变量（闭包），就不能用这个方式，要用 `JS_NewCFunctionData`。

---

## Step 3.5：在 MainActivity 中触发测试

@update `app/src/main/cpp/platform/android/jni_bridge.cpp` — 在 `extern "C"` 块中，`nativeTestRender` 之后新增：

```cpp
// Step 3 测试入口：验证 QuickJS 引擎能正常执行 JS
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeTestJS(
        JNIEnv* env, jobject thiz) {
    // 创建引擎
    auto engine = quickapp::createJSEngine();
    if (!engine->initialize()) {
        LOGE("JSEngine init failed");
        return;
    }

    // 测试 1：执行简单脚本
    engine->eval("nativeLog('Hello from QuickJS!')", "test1.js");

    // 测试 2：调用 nativeAdd 并验证返回值
    engine->eval("var result = nativeAdd(1, 2); nativeLog('1 + 2 = ' + result)", "test2.js");

    // 测试 3：验证错误处理
    bool ok = engine->eval("this_will_throw()", "test3.js");
    if (!ok) {
        LOGI("Expected error caught: %s", engine->getLastError().c_str());
    }

    // 清理
    engine->destroy();
    LOGI("JSEngine test completed");
}
```

@update `app/src/main/cpp/platform/android/jni_bridge.cpp` — 在文件顶部 `#include` 区域新增：

```cpp
#include "js_engine.h"
```

@update `app/src/main/java/com/quickappkit/runtime/QuickAppRuntime.kt` — 在 `private external fun nativeRelease()` 之后新增：

```kotlin
    private external fun nativeTestJS()
```

@update `app/src/main/java/com/quickappkit/runtime/QuickAppRuntime.kt` — 在 `fun testRender()` 之后新增：

```kotlin
    fun testJS() { nativeTestJS() }
```

@update `app/src/main/java/com/quickappkit/runtime/MainActivity.kt` — 在 `it.testRender()` 之后新增：

```kotlin
                                it.testJS()
```

---

## Step 3.6：逐层验证

### 3.6.1：编译验证

```bash
./gradlew :app:assembleDebug
```

预期：`BUILD SUCCESSFUL`

常见错误：
- QuickJS `*.c` 编译报错 → 检查 `target_compile_definitions` 是否有 `_GNU_SOURCE` 和 `CONFIG_BIGNUM`
- `js_engine.h not found` → 检查 `target_include_directories` 包含 `core/include`
- `undefined reference to JS_NewRuntime` → 检查 `target_link_libraries` 包含 `quickjs`

### 3.6.2：运行验证

```bash
./gradlew installDebug
```

### 3.6.3：Logcat 验证

```bash
adb logcat | grep -E "quickapp-js|quickapp-core"
```

预期输出：

```text
I/quickapp-js: QuickJS engine initialized
I/quickapp-js: [JS] Hello from QuickJS!
I/quickapp-js: [JS] nativeAdd(1, 2) = 3
I/quickapp-js: [JS] 1 + 2 = 3
I/quickapp-js: Expected error caught: 'this_will_throw' is not defined
I/quickapp-core: JSEngine test completed
I/quickapp-js: QuickJS engine destroyed
```

---

## 技术决策

### 1. QuickJS 源码直接编译为静态库

不用预编译 .so，因为 Android NDK 交叉编译没有通用预编译 QuickJS。直接编译源码最可控、最小依赖。

### 2. 抽象接口 + 工厂函数

Core 不直接 include quickjs.h。只有 `quickjs_engine.cpp` 依赖 QuickJS 头文件。换引擎时只改工厂函数和实现文件，Core 其他模块零改动。

### 3. 单 Runtime 单 Context

V1 一个 QuickApp Runtime 对应一个 JSRuntime + 一个 JSContext。多页面共享同一个 Context（通过 Router 切换页面状态）。后续如果需要页面隔离，可以改为每个页面一个 Context。

### 4. Native 函数用 lambda 注册

无捕获 lambda 可以隐式转为函数指针，直接传给 `JS_NewCFunction`。比单独定义 static 函数更紧凑。后续正式 Bridge 会用 JSClass + Opaque 的完整模式。

---

## QA

### 1. JSRuntime 和 JSContext 的关系？

JSRuntime 管理内存分配和 GC。JSContext 管理执行环境（全局对象、作用域链）。一个 Runtime 可以有多个 Context（隔离），V1 只用一个。类比：Runtime 是 JVM，Context 是一个 ClassLoader + 全局环境。

### 2. JS_FreeValue 为什么必须调用？

QuickJS 使用引用计数内存管理。每个 `JS_Eval`、`JS_GetGlobalObject`、`JS_GetPropertyStr` 返回的 JSValue 都增加了引用计数。不 Free 就是泄漏。类比 JNI 的 `DeleteLocalRef`。

### 3. extern "C" 包裹 quickjs.h 的原因？

QuickJS 是 C 库。C++ 编译器默认会对函数名做 Name Mangling。`extern "C"` 告诉编译器按 C 的方式处理这些函数名，否则链接时找不到 QuickJS 的符号。

### 4. 为什么测试函数不放进 `JSEngine`？

`JSEngine` 若把 JS 参数全部降级为字符串，就无法正确保留对象、函数、异常、`this` 和引用生命周期；若直接暴露 `JSValue`，又会把 QuickJS ABI 泄漏给所有 Core。Step 3 因此只在 QuickJS 实现内注册 `nativeLog` / `nativeAdd` 测试函数。真实宿主 ABI 由 Step 5 的 QuickJS Bridge 负责，且通过 `QuickJSContextProvider` 显式声明其引擎依赖。

### 5. QuickJS 的内存限制？

默认没有限制。可以通过 `JS_SetMemoryLimit(runtime, bytes)` 设置上限。V1 暂不设置，后续 Task 4.4 可观测性阶段再加监控。

---

## 下一步

Step 3 完成后得到：C++ 可以创建 QuickJS 引擎、执行 JS 脚本、JS 可以调用 C++ 函数。下一步 Step 4 建立 RuntimeEventLoop 和线程模型，确保 QuickJS 执行有独立线程保护。
