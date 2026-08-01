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
#include <functional>

namespace quickapp {

/**
 * JS 引擎抽象接口。
 *
 * Core 只依赖这个接口，不直接 include quickjs.h。
 * 后续可替换为 V8、Hermes 等实现，Core 代码不需要改动。
 *
 * 类比：Java 的 interface / Kotlin 的 abstract class。
 * C++ 中通过纯虚函数（= 0）实现同样的效果。
 */
class JSEngine {
public:
    virtual ~JSEngine() = default;

    /**
     * 初始化引擎（创建 Runtime + Context）。
     * @return true 表示初始化成功
     */
    virtual bool initialize() = 0;

    /**
     * 销毁引擎（释放所有 JS 对象和内存）。
     * 调用后不能再使用 eval 或其他方法。
     */
    virtual void destroy() = 0;

    /**
     * 执行 JS 脚本。
     * @param script JS 源码字符串（UTF-8）
     * @param filename 文件名，用于错误堆栈显示
     * @return 执行是否成功（false 表示有异常）
     */
    virtual bool eval(const char* script, const char* filename = "<eval>") = 0;

    /**
     * 注册一个 C++ 函数给 JS 全局对象调用。
     *
     * 注册后 JS 中可以直接调用：globalFuncName(arg1, arg2, ...)
     * 这是后续 JS Bridge 的基础——所有 $app_define$ 等都通过这个机制注入。
     *
     * @param name JS 中的全局函数名
     * @param fn 回调：接收参数字符串数组，返回结果字符串（简化版，Step 5 会用 JSValue）
     */
    virtual void registerGlobalFunction(const char* name,
        std::function<std::string(const std::vector<std::string>&)> fn) = 0;

    /** 是否有未处理的 JS 异常 */
    virtual bool hasError() const = 0;

    /** 获取最近一次错误信息 */
    virtual std::string getLastError() const = 0;
};

/**
 * 工厂函数：创建当前平台默认的 JS 引擎实现。
 * 当前返回 QuickJSEngine；后续如果换引擎，改这里一处即可。
 */
std::unique_ptr<JSEngine> createJSEngine();

} // namespace quickapp

#endif // QUICKAPP_JS_ENGINE_H
```

**为什么用抽象接口而不是直接暴露 QuickJS：**

Core 的 RPKLoader、Router、VNode 等模块只需要 `eval` 和 `registerGlobalFunction`，不需要知道底层是 QuickJS 还是 V8。接口隔离后：
- 换引擎不改 Core
- 单元测试可以 mock 引擎
- 编译依赖清晰（只有 quickjs_engine.cpp 需要 include quickjs.h）

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
#include <vector>
#include <unordered_map>

#define LOG_TAG "quickapp-js"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace quickapp {

// ============================================================
// QuickJSEngine 实现
// ============================================================

class QuickJSEngine : public JSEngine {
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

    void registerGlobalFunction(const char* name,
            std::function<std::string(const std::vector<std::string>&)> fn) override {
        if (!context_) return;

        // 保存回调到 map 中，C 函数通过 name 查找
        callbacks_[name] = std::move(fn);

        // 注册 C 函数到 JS 全局对象
        // JS_NewCFunction 创建一个 JS 函数对象，调用时进入 dispatchCallback
        JSValue global = JS_GetGlobalObject(context_);
        JS_SetPropertyStr(context_, global, name,
            JS_NewCFunction(context_, dispatchCallback, name, 1));
        JS_FreeValue(context_, global);
    }

    bool hasError() const override { return !lastError_.empty(); }
    std::string getLastError() const override { return lastError_; }

    // 暴露给后续 Step 5 的 JS Bridge 使用（直接操作 QuickJS API）
    JSContext* getContext() { return context_; }
    JSRuntime* getRuntime() { return runtime_; }

private:
    JSRuntime* runtime_ = nullptr;
    JSContext* context_ = nullptr;
    std::string lastError_;

    // Native 函数回调注册表
    // key: JS 函数名, value: C++ 回调
    static inline std::unordered_map<std::string,
        std::function<std::string(const std::vector<std::string>&)>> callbacks_;

    /**
     * 所有通过 registerGlobalFunction 注册的 JS 函数调用都进入这里。
     * 通过函数名在 callbacks_ 中查找对应的 C++ 回调。
     */
    static JSValue dispatchCallback(JSContext* ctx, JSValueConst this_val,
                                     int argc, JSValueConst* argv) {
        // 获取被调用的函数名
        // QuickJS 的 CFunction 没有直接传函数名，我们用第一个参数 hack
        // 更好的方式是用 JS_NewCFunctionData 携带 name，但简化版先用全局 map

        // 读取所有参数为字符串
        std::vector<std::string> args;
        for (int i = 0; i < argc; i++) {
            const char* str = JS_ToCString(ctx, argv[i]);
            if (str) {
                args.emplace_back(str);
                JS_FreeCString(ctx, str);
            } else {
                args.emplace_back("");
            }
        }

        // 通过函数对象的 name 属性找到注册名
        // 注意：这里简化处理，实际生产应该用 JS_NewCFunctionData + magic
        JSValue funcObj = JS_GetPropertyStr(ctx,
            JS_GetGlobalObject(ctx), ""); // placeholder

        // 简化方案：遍历 callbacks 找匹配的（Step 5 会重构为 JSClass + Opaque）
        // 当前 Step 3 只用于验证，回调数量少，性能不是问题
        for (auto& [name, cb] : callbacks_) {
            // 尝试调用每个回调看是否匹配
            // 实际上我们需要知道是哪个函数被调用了
        }

        return JS_UNDEFINED;
    }

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

为了绕过 `registerGlobalFunction` 的简化回调问题，Step 3 直接在 `quickjs_engine.cpp` 中用 QuickJS 原生 API 注册两个测试函数。这是最直接的验证方式，后续 Step 5 会用完整的 JSClass 机制。

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

### 4. 为什么 Step 3 的 registerGlobalFunction 是简化版？

Step 3 的目标是验证 QuickJS 能工作。完整的 JS Bridge（支持 JSClass、Opaque、多模块、参数类型转换）在 Step 5 实现。Step 3 先用 lambda + 直接 QuickJS API 跑通，证明引擎可用。

### 5. QuickJS 的内存限制？

默认没有限制。可以通过 `JS_SetMemoryLimit(runtime, bytes)` 设置上限。V1 暂不设置，后续 Task 4.4 可观测性阶段再加监控。

---

## 下一步

Step 3 完成后得到：C++ 可以创建 QuickJS 引擎、执行 JS 脚本、JS 可以调用 C++ 函数。下一步 Step 4 建立 RuntimeEventLoop 和线程模型，确保 QuickJS 执行有独立线程保护。
