# Step 4：JSEngine 抽象与 QuickJS 实现

## 目录

- [目标](#目标)
- [Step 4.1：设计 JSEngine 抽象接口](#step-41设计-jsengine-抽象接口)
- [Step 4.2：实现 QuickJSEngine](#step-42实现-quickjsengine)
- [Step 4.3：实现工厂函数](#step-43实现工厂函数)
- [Step 4.4：接入 CMake](#step-44接入-cmake)
- [Step 4.5：编写测试](#step-45编写测试)
- [Step 4.6：逐层验证](#step-46逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**建立 JS 引擎抽象层，让 Core 其他模块不直接依赖 QuickJS。**

| 层 | 职责 | 文件 |
|---|---|---|
| 抽象接口 | 定义引擎能力：生命周期、eval、错误、函数注册 | `include/js_engine.h` |
| QuickJS 实现 | 封装 JSRuntime/JSContext，实现接口 | `src/quickjs_engine.cpp` |
| 工厂函数 | 返回当前平台默认引擎，隐藏具体类型 | `createJSEngine()` |

**验收标准：**
- 桌面测试程序能 `eval("1+1")` 并读回结果
- eval 非法语法时 `hasError()` 返回 true，`getLastError()` 有可读信息
- 能注册 native 函数并从 JS 调用
- `destroy()` 幂等，多次调用不崩溃
- Core 其他模块（Step 05+）只 include `js_engine.h`，不 include `quickjs.h`

**本步不包含：**
- JS Bridge 全局函数注入（`$app_define$` 等，Step 07）
- Promise 微任务驱动（Step 05 的 EventLoop 负责）
- 模块系统（Step 07）
- 线程封装（Step 05 的 RuntimeThread）

---

## Step 4.1：设计 JSEngine 抽象接口

### 4.1.1：接口边界的取舍

抽象层最难的问题是：**暴露多少 QuickJS 细节？**

```text
完全隐藏（理想）
    interface: eval(script) → bool
    问题：JS Bridge 需要 JSContext* 才能注册函数，
          ManifestParser 需要 JS_ParseJSON，
          VNode 构建需要遍历 JSValue。
    完全隐藏就要为每个需求包一层，工作量巨大且收益有限。

完全暴露（放弃抽象）
    interface: getContext() → JSContext*
    问题：所有模块直接用 QuickJS API，换引擎时全部要改。

分层暴露（V1 选择）
    通用能力 → 抽象接口（initialize/eval/error）
    引擎特有 → getRawContext() 显式标注，仅少数模块使用
```

V1 采用分层暴露，并在 `getRawContext()` 的注释中明确标注"这是引擎特有出口，使用它的代码在换引擎时需要适配"。

### 4.1.2：接口清单

| 方法 | 用途 | 使用方 |
|---|---|---|
| `initialize()` | 创建 JSRuntime/JSContext | RuntimeThread |
| `destroy()` | 释放引擎资源 | RuntimeThread |
| `eval()` | 执行脚本 | RuntimeBootstrap |
| `evalWithResult()` | 执行并返回字符串结果 | 测试、调试 |
| `hasError()` / `getLastError()` / `clearError()` | 错误查询 | 所有调用方 |
| `executePendingJobs()` | 驱动 Promise 微任务 | EventLoop |
| `registerGlobalFunction()` | 注册 native 函数 | JS Bridge |
| `getRawContext()` | 引擎特有出口 | JS Bridge、ManifestParser、VNode |

---

### 4.1.3：创建 js_engine.h

**@add `include/js_engine.h`（新建文件）**

```cpp
#ifndef QUICKAPP_JS_ENGINE_H
#define QUICKAPP_JS_ENGINE_H

#include <memory>
#include <string>

namespace quickapp {

// JS 引擎抽象接口。
//
// 职责：
//   管理 JS 运行时的生命周期，执行脚本，暴露错误状态。
//
// 线程所有权：
//   实例创建后归属单一线程（RuntimeThread）。
//   所有方法必须在该线程调用，包括 destroy()。
//   跨线程调用会导致 QuickJS 内部状态损坏（QuickJS 不是线程安全的）。
//
// 生命周期：
//   构造 → initialize() → [eval / registerGlobalFunction ...] → destroy() → 析构
//   destroy() 后不可再调用其他方法（除了再次 destroy()，它是幂等的）。
//   析构函数会自动调用 destroy()，所以忘记调用不会泄漏。
//
// 与其他组件的关系：
//   RuntimeThread    拥有 JSEngine 实例，负责创建和销毁
//   RuntimeEventLoop 每轮任务后调 executePendingJobs() 驱动 Promise
//   JS Bridge        通过 registerGlobalFunction / getRawContext 注入能力
class JSEngine {
public:
    virtual ~JSEngine() = default;

    /**
     * 初始化引擎，创建底层 Runtime 和 Context。
     *
     * @return true  初始化成功，可以开始 eval
     *         false 初始化失败（通常是内存不足），
     *               此时 getLastError() 返回失败原因
     *
     * 幂等性：已初始化时重复调用返回 true，不重复创建资源。
     */
    virtual bool initialize() = 0;

    /**
     * 销毁引擎，释放所有底层资源。
     *
     * 调用后所有从本引擎获得的 JSValue、JSContext 指针全部失效。
     * 幂等：多次调用安全，第二次及以后是空操作。
     */
    virtual void destroy() = 0;

    /**
     * 执行一段 JS 脚本。
     *
     * @param script   JS 源码，UTF-8 编码，以 '\0' 结尾，不能为 nullptr
     * @param filename 脚本名，仅用于错误堆栈显示，
     *                 传 RPK 内的真实路径（如 "pages/Demo/index.js"）
     *                 能让 JS 报错信息更容易定位
     * @return true  执行成功
     *         false 执行抛出异常或有语法错误，
     *               通过 getLastError() 取详细信息
     *
     * 注意：脚本中的 Promise 不会在这里被驱动，
     *       需要调用方随后调用 executePendingJobs()。
     */
    virtual bool eval(const char* script, const char* filename = "<eval>") = 0;

    /**
     * 执行脚本并把结果转为字符串返回。
     *
     * 主要用于测试和调试。生产代码用 eval() + getRawContext() 处理复杂返回值。
     *
     * @param script   JS 源码，同 eval()
     * @param filename 脚本名，同 eval()
     * @param result   输出参数，接收结果的字符串形式。
     *                 执行失败时不修改此参数。
     *                 undefined 转为 "undefined"，对象转为 "[object Object]"
     * @return true 执行成功且 result 已写入；false 执行失败
     */
    virtual bool evalWithResult(const char* script,
                               const char* filename,
                               std::string& result) = 0;

    /**
     * 驱动 JS 引擎的微任务队列（Promise 回调）。
     *
     * QuickJS 不自带事件循环，Promise 的 then/catch 回调
     * 需要宿主显式调用才会执行。EventLoop 在每轮任务后调用它。
     *
     * @return 实际执行的任务数量。
     *         0 表示队列已空，> 0 表示执行了若干微任务。
     *         调用方通常不关心具体数值，可用于调试观察。
     */
    virtual int executePendingJobs() = 0;

    /**
     * 是否处于错误状态。
     * @return true 上一次操作失败且错误未被清除
     */
    virtual bool hasError() const = 0;

    /**
     * 获取最近一次错误的描述。
     *
     * @return 错误信息，包含消息和 JS 堆栈（如果有）。
     *         无错误时返回空字符串。
     */
    virtual std::string getLastError() const = 0;

    /**
     * 清除错误状态，让 hasError() 恢复为 false。
     *
     * 用途：某个页面 bundle 执行失败后，清除错误继续加载下一个页面，
     *      不让单页错误影响整个 Runtime。
     */
    virtual void clearError() = 0;

    /**
     * 注册一个全局 native 函数，JS 可以直接调用。
     *
     * @param name    JS 侧的全局函数名，如 "__native_render__"
     * @param func    函数指针。类型是 void* 是为了让本头文件
     *                不依赖 QuickJS 类型；实现类内部转回真实签名。
     *                实际类型必须是 QuickJS 的 JSCFunction：
     *                JSValue (*)(JSContext*, JSValueConst, int, JSValueConst*)
     * @param argCount 函数期望的参数个数。QuickJS 用它设置 Function.length，
     *                 实际调用时参数可多可少，需在实现里自行校验
     * @return true 注册成功；false 引擎未初始化或名称非法
     *
     * 换引擎影响：func 的实际签名是引擎特有的，换引擎时调用方需要适配。
     */
    virtual bool registerGlobalFunction(const char* name,
                                        void* func,
                                        int argCount) = 0;

    /**
     * 获取底层引擎上下文的裸指针。
     *
     * 【引擎特有出口】
     * 这是抽象层故意开的一个洞。以下场景绕不开它：
     *   - JS Bridge 需要 JS_NewCFunction 创建函数对象
     *   - ManifestParser 需要 JS_ParseJSON 解析 JSON
     *   - VNode 构建需要遍历 JSValue 属性
     *
     * 为这些场景各包一层抽象的成本高于收益，V1 选择直接暴露。
     * 使用它的模块在换 JS 引擎时需要重写，这一点记录在 design.md 的
     * Key Decisions 中。
     *
     * @return QuickJS 的 JSContext*，需要调用方 static_cast。
     *         引擎未初始化或已销毁时返回 nullptr。
     */
    virtual void* getRawContext() = 0;
};

/**
 * 创建当前平台的默认 JS 引擎实例。
 *
 * 返回的引擎尚未初始化，调用方需要自己调 initialize()。
 * 这样设计是为了让调用方能处理初始化失败。
 *
 * @return 引擎实例。当前实现始终返回 QuickJSEngine，不会返回 nullptr。
 */
std::unique_ptr<JSEngine> createJSEngine();

} // namespace quickapp

#endif // QUICKAPP_JS_ENGINE_H
```

**几个设计点说明：**

```text
为什么 registerGlobalFunction 的 func 是 void*
    如果写成 JSCFunction*，js_engine.h 就必须 include quickjs.h，
    那么所有 include js_engine.h 的文件都会看到 QuickJS 类型，
    抽象层形同虚设。用 void* 把类型信息推到调用点。

为什么 getRawContext 返回 void* 而不是 JSContext*
    同上。调用方写 static_cast<JSContext*>(engine->getRawContext())，
    这个 cast 就是一个显式的"我在使用引擎特有能力"标记，
    grep 这个 cast 就能找出所有需要适配的位置。

为什么 createJSEngine 不自动 initialize
    初始化可能失败（内存不足）。如果在工厂里初始化，
    失败时只能返回 nullptr，调用方拿不到 getLastError()。
    分开后调用方能读到具体错误。
```

---

## Step 4.2：实现 QuickJSEngine

**@add `src/quickjs_engine.cpp`（新建文件）**

第一部分：头部和类定义。

```cpp
#include "js_engine.h"

#include <cstring>

#include "qa_log.h"
#include "quickjs.h"

namespace quickapp {
namespace {

// QuickJS 的 JSEngine 实现。
//
// 职责：
//   持有 JSRuntime（内存/GC 管理）和 JSContext（全局对象/内建类），
//   把抽象接口的调用翻译为 QuickJS C API。
//
// 线程所有权：
//   实例归属创建它的线程。QuickJS 的 JSRuntime 不是线程安全的，
//   跨线程调用会导致 GC 状态损坏和随机崩溃。
//
// 生命周期：
//   构造时不分配资源（rt_ 和 ctx_ 为 nullptr）
//   initialize() 分配 JSRuntime + JSContext
//   destroy() 按 ctx → rt 的逆序释放
//   析构时兜底调用 destroy()
//
// QuickJS 的两层结构：
//   JSRuntime  内存分配器、GC、原子表。一个进程可以有多个，互相隔离。
//   JSContext  全局对象、内建类（Object/Array/Promise）。
//              一个 JSRuntime 下可以有多个 Context 共享内存但隔离全局对象。
//   本实现是 1 Runtime : 1 Context，够用且最简单。
class QuickJSEngine final : public JSEngine {
public:
    QuickJSEngine() = default;

    // 析构时兜底释放，防止调用方忘记 destroy() 导致泄漏
    ~QuickJSEngine() override {
        destroy();
    }

    // 禁止拷贝：JSRuntime 是独占资源，拷贝会导致双重释放
    QuickJSEngine(const QuickJSEngine&) = delete;
    QuickJSEngine& operator=(const QuickJSEngine&) = delete;

    bool initialize() override;
    void destroy() override;
    bool eval(const char* script, const char* filename) override;
    bool evalWithResult(const char* script, const char* filename,
                        std::string& result) override;
    int executePendingJobs() override;
    bool hasError() const override { return hasError_; }
    std::string getLastError() const override { return lastError_; }
    void clearError() override;
    bool registerGlobalFunction(const char* name, void* func, int argCount) override;
    void* getRawContext() override { return ctx_; }

private:
    /**
     * 从 QuickJS 的异常对象提取错误信息，存入 lastError_ 并置位 hasError_。
     *
     * 必须在 QuickJS API 返回 exception 后立即调用，
     * 否则异常状态会被后续调用覆盖。
     *
     * @param stage 出错阶段的描述，如 "eval"、"json parse"，
     *              会作为错误信息的前缀，方便定位
     */
    void captureException(const char* stage);

    JSRuntime* rt_ = nullptr;
    JSContext* ctx_ = nullptr;
    bool hasError_ = false;
    std::string lastError_;
};
```

第二部分：初始化与销毁。

```cpp
bool QuickJSEngine::initialize() {
    // 幂等：已初始化则直接成功返回
    if (rt_ != nullptr && ctx_ != nullptr) {
        QA_LOGD("[JSEngine] already initialized");
        return true;
    }

    // 1. 创建 JSRuntime：内存分配器 + GC
    rt_ = JS_NewRuntime();
    if (rt_ == nullptr) {
        hasError_ = true;
        lastError_ = "JS_NewRuntime failed (out of memory)";
        QA_LOGE("[JSEngine] %s", lastError_.c_str());
        return false;
    }

    // 2. 设置内存上限。
    //    不设的话 JS 代码里的死循环 push 数组能吃掉全部系统内存。
    //    64MB 对快应用场景足够：一个页面的 VNode 树 + JS 对象通常 < 5MB。
    //    嵌入式场景可以调小到 8MB。
    JS_SetMemoryLimit(rt_, 64 * 1024 * 1024);

    // 3. 设置栈大小上限，防止 JS 无限递归打爆原生栈。
    //    QuickJS 检测到超限会抛 RangeError 而不是段错误。
    JS_SetMaxStackSize(rt_, 1024 * 1024);

    // 4. 创建 JSContext：全局对象 + 内建类
    ctx_ = JS_NewContext(rt_);
    if (ctx_ == nullptr) {
        // 部分失败时清理已分配的 Runtime，不留半初始化状态
        JS_FreeRuntime(rt_);
        rt_ = nullptr;
        hasError_ = true;
        lastError_ = "JS_NewContext failed (out of memory)";
        QA_LOGE("[JSEngine] %s", lastError_.c_str());
        return false;
    }

    QA_LOGI("[JSEngine] initialized (QuickJS, memLimit=64MB, stackLimit=1MB)");
    return true;
}

void QuickJSEngine::destroy() {
    // 释放顺序必须是 Context → Runtime。
    // 反过来会导致 Context 引用的已释放 Runtime 内存，触发 use-after-free。
    if (ctx_ != nullptr) {
        JS_FreeContext(ctx_);
        ctx_ = nullptr;
    }
    if (rt_ != nullptr) {
        JS_FreeRuntime(rt_);
        rt_ = nullptr;
    }
    // 不清空 lastError_：destroy 后调用方可能还想读最后的错误信息
    QA_LOGD("[JSEngine] destroyed");
}

void QuickJSEngine::clearError() {
    hasError_ = false;
    lastError_.clear();
}
```

第三部分：异常捕获。

```cpp
void QuickJSEngine::captureException(const char* stage) {
    hasError_ = true;

    // JS_GetException 取出当前异常并清除引擎的异常标记。
    // 返回的 JSValue 归调用方所有，必须 JS_FreeValue。
    JSValue exc = JS_GetException(ctx_);

    // 把异常对象转为字符串。
    // 如果异常是 Error 实例，得到 "TypeError: xxx is not a function"。
    const char* excStr = JS_ToCString(ctx_, exc);

    lastError_ = stage;
    lastError_ += ": ";
    lastError_ += (excStr != nullptr ? excStr : "<unknown exception>");

    if (excStr != nullptr) {
        JS_FreeCString(ctx_, excStr);
    }

    // 尝试附加 JS 堆栈。
    // 只有 Error 对象才有 stack 属性，其他类型（如 throw "string"）没有。
    if (JS_IsError(ctx_, exc)) {
        JSValue stackVal = JS_GetPropertyStr(ctx_, exc, "stack");
        if (!JS_IsUndefined(stackVal)) {
            const char* stackStr = JS_ToCString(ctx_, stackVal);
            if (stackStr != nullptr) {
                lastError_ += "\n";
                lastError_ += stackStr;
                JS_FreeCString(ctx_, stackStr);
            }
        }
        JS_FreeValue(ctx_, stackVal);
    }

    JS_FreeValue(ctx_, exc);
    QA_LOGE("[JSEngine] %s", lastError_.c_str());
}
```

第四部分：脚本执行。

```cpp
bool QuickJSEngine::eval(const char* script, const char* filename) {
    if (ctx_ == nullptr) {
        hasError_ = true;
        lastError_ = "eval: engine not initialized";
        QA_LOGE("[JSEngine] %s", lastError_.c_str());
        return false;
    }
    if (script == nullptr) {
        hasError_ = true;
        lastError_ = "eval: script is null";
        QA_LOGE("[JSEngine] %s", lastError_.c_str());
        return false;
    }

    // JS_Eval 的最后一个参数是 flags：
    //   JS_EVAL_TYPE_GLOBAL  按脚本执行（可以有全局变量）
    //   JS_EVAL_TYPE_MODULE  按 ES Module 执行（有 import/export）
    // RPK 的 bundle 是 webpack 打包后的 IIFE，不是 ES Module，所以用 GLOBAL。
    JSValue result = JS_Eval(ctx_, script, std::strlen(script),
                            filename != nullptr ? filename : "<eval>",
                            JS_EVAL_TYPE_GLOBAL);

    bool ok = true;
    if (JS_IsException(result)) {
        captureException("eval");
        ok = false;
    }

    // JS_Eval 返回的值归调用方所有，无论成功失败都要释放
    JS_FreeValue(ctx_, result);
    return ok;
}

bool QuickJSEngine::evalWithResult(const char* script, const char* filename,
                                  std::string& result) {
    if (ctx_ == nullptr) {
        hasError_ = true;
        lastError_ = "evalWithResult: engine not initialized";
        return false;
    }
    if (script == nullptr) {
        hasError_ = true;
        lastError_ = "evalWithResult: script is null";
        return false;
    }

    JSValue val = JS_Eval(ctx_, script, std::strlen(script),
                          filename != nullptr ? filename : "<eval>",
                          JS_EVAL_TYPE_GLOBAL);

    if (JS_IsException(val)) {
        captureException("evalWithResult");
        JS_FreeValue(ctx_, val);
        return false;
    }

    // JS_ToCString 对任意 JSValue 都能工作：
    //   数字 42        → "42"
    //   字符串 "hi"    → "hi"
    //   undefined      → "undefined"
    //   对象 {}        → "[object Object]"（调用了 toString）
    const char* str = JS_ToCString(ctx_, val);
    if (str == nullptr) {
        // toString 本身抛异常的极端情况（如 Symbol）
        captureException("evalWithResult: toString");
        JS_FreeValue(ctx_, val);
        return false;
    }

    result = str;
    JS_FreeCString(ctx_, str);
    JS_FreeValue(ctx_, val);
    return true;
}

int QuickJSEngine::executePendingJobs() {
    if (rt_ == nullptr) {
        return 0;
    }

    int executed = 0;
    // JS_ExecutePendingJob 每次执行一个微任务。
    // 返回值：> 0 执行了一个任务
    //         = 0 队列为空
    //         < 0 任务执行时抛出异常
    // 循环直到队列清空，因为一个 Promise 回调可能产生新的微任务。
    for (;;) {
        JSContext* jobCtx = nullptr;
        int ret = JS_ExecutePendingJob(rt_, &jobCtx);

        if (ret == 0) {
            break;   // 队列空了，正常退出
        }
        if (ret < 0) {
            // 微任务抛异常。记录但继续处理剩余任务，
            // 不让一个 Promise rejection 阻塞整个队列。
            if (jobCtx != nullptr) {
                JSValue exc = JS_GetException(jobCtx);
                const char* excStr = JS_ToCString(jobCtx, exc);
                QA_LOGE("[JSEngine] unhandled job exception: %s",
                        excStr != nullptr ? excStr : "<unknown>");
                if (excStr != nullptr) {
                    JS_FreeCString(jobCtx, excStr);
                }
                JS_FreeValue(jobCtx, exc);
            }
            // 不 break：继续执行队列里其他任务
        }
        ++executed;

        // 防御性上限：避免恶意 JS 用无限自我调度的 Promise 卡死 Runtime Thread。
        // 正常应用一轮微任务不会超过几十个。
        if (executed > 10000) {
            QA_LOGW("[JSEngine] pending job limit reached (10000), "
                    "possible infinite microtask loop");
            break;
        }
    }

    if (executed > 0) {
        QA_LOGD("[JSEngine] executed %d pending jobs", executed);
    }
    return executed;
}
```

第五部分：函数注册。

```cpp
bool QuickJSEngine::registerGlobalFunction(const char* name, void* func, int argCount) {
    if (ctx_ == nullptr) {
        hasError_ = true;
        lastError_ = "registerGlobalFunction: engine not initialized";
        QA_LOGE("[JSEngine] %s", lastError_.c_str());
        return false;
    }
    if (name == nullptr || func == nullptr) {
        hasError_ = true;
        lastError_ = "registerGlobalFunction: name or func is null";
        QA_LOGE("[JSEngine] %s", lastError_.c_str());
        return false;
    }

    // 把 void* 转回 QuickJS 的函数签名。
    // 这个 cast 是 registerGlobalFunction 用 void* 参数的代价：
    // 编译器无法检查调用方传的函数签名是否正确，传错会在 JS 调用时崩溃。
    // 约束由文档和 code review 保证。
    auto cfunc = reinterpret_cast<JSCFunction*>(func);

    // 取全局对象（JS 里的 globalThis）。
    // JS_GetGlobalObject 返回的引用归调用方所有，必须释放。
    JSValue global = JS_GetGlobalObject(ctx_);

    // 创建 JS 函数对象，绑定到 native 函数
    JSValue fn = JS_NewCFunction(ctx_, cfunc, name, argCount);

    // 挂到全局对象上。
    // JS_SetPropertyStr 会接管 fn 的所有权，所以后面不需要 JS_FreeValue(fn)。
    JS_SetPropertyStr(ctx_, global, name, fn);

    JS_FreeValue(ctx_, global);

    QA_LOGD("[JSEngine] registered global function: %s (argc=%d)", name, argCount);
    return true;
}

} // namespace（匿名 namespace 结束，QuickJSEngine 仅本文件可见）
```

第六部分：工厂函数。

```cpp
std::unique_ptr<JSEngine> createJSEngine() {
    // 当前只有一种实现。
    // 将来支持多引擎时，这里根据编译宏或配置选择：
    //   #if defined(QUICKAPP_JS_ENGINE_HERMES)
    //       return std::make_unique<HermesEngine>();
    //   #else
    //       return std::make_unique<QuickJSEngine>();
    //   #endif
    return std::make_unique<QuickJSEngine>();
}

} // namespace quickapp
```

**为什么 QuickJSEngine 放在匿名 namespace 里：**

```text
匿名 namespace 让 QuickJSEngine 这个符号只在本 .cpp 内可见。

好处：
    1. 外部代码无法 #include 后直接 new QuickJSEngine，
       只能通过 createJSEngine()，抽象边界更严格
    2. 链接期符号更少，不会和其他库的同名类冲突
    3. 编译器能做更激进的优化（知道这个类不会被外部继承）
```

---

## Step 4.3：实现工厂函数

工厂函数已在上一节 `quickjs_engine.cpp` 末尾实现。这里说明它在架构中的位置。

### 4.3.1：调用方视角

```cpp
// RuntimeThread 中的用法（Step 05 会实现）
auto engine = quickapp::createJSEngine();
if (!engine->initialize()) {
    QA_LOGE("engine init failed: %s", engine->getLastError().c_str());
    return false;
}

engine->eval(frameworkJs, "framework.js");
engine->executePendingJobs();

// engine 是 unique_ptr，作用域结束时自动析构 → 自动 destroy()
```

调用方只见到 `JSEngine` 接口和 `createJSEngine()` 一个函数，不知道 QuickJS 的存在。

### 4.3.2：换引擎时的改动范围

```text
需要改的：
    src/quickjs_engine.cpp        新增一个 hermes_engine.cpp
    createJSEngine()              加条件分支
    使用 getRawContext() 的模块    js_bridge.cpp / manifest_parser.cpp / vnode.cpp

不需要改的：
    include/js_engine.h           接口不变
    runtime_thread.cpp            只用抽象接口
    runtime_bootstrap.cpp         只用抽象接口
    rpk_loader / style_resolver / layout_engine   完全不涉及 JS
```

抽象层的价值就体现在这个清单上：约 10 个文件里只有 4 个需要动。

---

## Step 4.4：接入 CMake

**@update `CMakeLists.txt` — 替换 `add_library(quickapp-core STATIC ...)` 块**

```cmake
add_library(quickapp-core STATIC
    src/core_version.cpp
    src/qa_log.cpp
    src/quickjs_engine.cpp      # ← Step 04 新增
)
```

不需要改其他配置：`third_party/quickjs` 的 include 路径在 Step 02 已设为 PRIVATE，`quickjs_engine.cpp` 能 include 到 `quickjs.h`，而平台层不能。

---

## Step 4.5：编写测试

**@add `tests/test_js_engine.cpp`（新建文件）**

```cpp
// JSEngine 抽象层测试。
//
// 验证点：
//   1. 初始化和幂等性
//   2. eval 基本执行 + 返回值转换
//   3. 语法错误和运行时异常的捕获
//   4. 错误清除后能继续执行
//   5. native 函数注册和调用
//   6. Promise 微任务驱动
//   7. destroy 幂等
//   8. 未初始化时调用的防御

#include <cstdio>
#include <string>

#include "js_engine.h"
#include "quickjs.h"     // 测试需要构造 JSCFunction，属于测试代码的特权

#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

namespace {

// native 函数被调用的次数，用于验证 JS → C++ 调用真的发生了
int g_nativeCallCount = 0;
std::string g_nativeLastArg;

// 测试用 native 函数。
// 签名必须完全匹配 QuickJS 的 JSCFunction。
JSValue testNativeFn(JSContext* ctx, JSValueConst /*thisVal*/,
                     int argc, JSValueConst* argv) {
    ++g_nativeCallCount;

    if (argc > 0) {
        const char* s = JS_ToCString(ctx, argv[0]);
        if (s != nullptr) {
            g_nativeLastArg = s;
            JS_FreeCString(ctx, s);
        }
    }
    // 返回一个值给 JS，验证双向数据传递
    return JS_NewInt32(ctx, 99);
}

} // namespace

int main() {
    auto engine = quickapp::createJSEngine();
    CHECK(engine != nullptr, "createJSEngine returned nullptr");

    // ---- 场景 1：未初始化时的防御 ----
    CHECK(!engine->eval("1+1"), "eval should fail before initialize");
    CHECK(engine->hasError(), "hasError should be true after failed eval");
    CHECK(engine->getRawContext() == nullptr, "rawContext should be null");
    engine->clearError();

    // ---- 场景 2：初始化 ----
    CHECK(engine->initialize(), "initialize failed");
    CHECK(!engine->hasError(), "should have no error after init");
    CHECK(engine->getRawContext() != nullptr, "rawContext should be valid");

    // 幂等验证
    CHECK(engine->initialize(), "second initialize should succeed (idempotent)");

    // ---- 场景 3：基本 eval ----
    CHECK(engine->eval("var a = 1 + 1;"), "simple eval failed");
    CHECK(!engine->hasError(), "should have no error");

    std::string result;
    CHECK(engine->evalWithResult("a", "<test>", result), "evalWithResult failed");
    CHECK(result == "2", "expected a == 2");

    CHECK(engine->evalWithResult("'hello' + ' ' + 'world'", "<test>", result),
          "string concat failed");
    CHECK(result == "hello world", "string result wrong");

    CHECK(engine->evalWithResult("[1,2,3].map(x => x * 2).join(',')", "<test>", result),
          "arrow function / map failed");
    CHECK(result == "2,4,6", "ES6 features not working");

    // ---- 场景 4：语法错误捕获 ----
    CHECK(!engine->eval("var = = =", "<bad>"), "syntax error should return false");
    CHECK(engine->hasError(), "hasError should be true");
    std::string err = engine->getLastError();
    CHECK(!err.empty(), "error message should not be empty");
    CHECK(err.find("eval") != std::string::npos, "error should mention stage");

    // ---- 场景 5：清除错误后继续 ----
    engine->clearError();
    CHECK(!engine->hasError(), "error should be cleared");
    CHECK(engine->eval("var b = 42;"), "eval after clearError failed");

    // ---- 场景 6：运行时异常 + 堆栈 ----
    CHECK(!engine->eval("throw new Error('boom')", "<throw>"),
          "throw should return false");
    CHECK(engine->hasError(), "hasError after throw");
    err = engine->getLastError();
    CHECK(err.find("boom") != std::string::npos, "error should contain message");
    engine->clearError();

    // ---- 场景 7：注册 native 函数并调用 ----
    CHECK(engine->registerGlobalFunction(
              "__test_native__", reinterpret_cast<void*>(testNativeFn), 1),
          "registerGlobalFunction failed");

    g_nativeCallCount = 0;
    CHECK(engine->evalWithResult("__test_native__('from js')", "<test>", result),
          "calling native function failed");
    CHECK(g_nativeCallCount == 1, "native function should be called once");
    CHECK(g_nativeLastArg == "from js", "native function got wrong argument");
    CHECK(result == "99", "native function return value wrong");

    // ---- 场景 8：Promise 微任务 ----
    CHECK(engine->eval(
              "var promiseResult = 'pending';"
              "Promise.resolve('done').then(v => { promiseResult = v; });",
              "<promise>"),
          "promise setup failed");

    // then 回调此时还没执行
    CHECK(engine->evalWithResult("promiseResult", "<test>", result), "read failed");
    CHECK(result == "pending", "then callback should not run before executePendingJobs");

    // 驱动微任务
    int jobs = engine->executePendingJobs();
    CHECK(jobs > 0, "should have executed at least one job");

    CHECK(engine->evalWithResult("promiseResult", "<test>", result), "read failed");
    CHECK(result == "done", "then callback should have run");

    // 队列已空
    CHECK(engine->executePendingJobs() == 0, "job queue should be empty now");

    // ---- 场景 9：destroy 幂等 ----
    engine->destroy();
    engine->destroy();   // 不应崩溃
    CHECK(engine->getRawContext() == nullptr, "rawContext should be null after destroy");

    std::printf("PASS: all JSEngine tests\n");
    return 0;
}
```

**@update `tests/CMakeLists.txt` — 在 `test_log` 之后插入**

```cmake
# test_js_engine：JS 引擎抽象层
#
# 这个测试需要 include quickjs.h 来构造 JSCFunction，
# 所以显式加上 QuickJS 的 include 路径。
# 生产代码不应该这么做——只有测试和 Core 内部实现有这个特权。
add_executable(test_js_engine test_js_engine.cpp)
target_link_libraries(test_js_engine PRIVATE quickapp-core quickjs)
target_include_directories(test_js_engine PRIVATE
    ${CMAKE_SOURCE_DIR}/third_party/quickjs
)
add_test(NAME test_js_engine COMMAND test_js_engine)
```

---

## Step 4.6：逐层验证

### 4.6.1：编译验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build -j4
```

预期：

```text
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/quickjs_engine.cpp.o
[ xx%] Linking CXX static library libquickapp-core.a
[ xx%] Building CXX object tests/CMakeFiles/test_js_engine.dir/test_js_engine.cpp.o
[100%] Linking CXX executable test_js_engine
```

**常见错误：**

```text
"quickjs.h: No such file or directory"（编译 quickjs_engine.cpp 时）
    → Step 02 的 target_include_directories 里 third_party/quickjs 路径丢了

"undefined reference to JS_NewRuntime"
    → target_link_libraries 缺 quickjs

"invalid conversion from 'void*' to 'JSCFunction*'"
    → reinterpret_cast 写成了 static_cast。
      函数指针和 void* 之间必须用 reinterpret_cast。

"cannot declare variable 'engine' to be of abstract type"
    → QuickJSEngine 有虚函数没实现，检查 override 是否覆盖了全部 8 个纯虚函数
```

### 4.6.2：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
1/3 Test #1: test_version .....................   Passed
2/3 Test #2: test_log .........................   Passed
3/3 Test #3: test_js_engine ...................   Passed

100% tests passed, 0 tests failed out of 3
```

直接运行看日志输出：

```bash
./build/tests/test_js_engine
```

预期（Debug 构建会看到 QA_LOGD 输出）：

```text
[E/quickapp-core] [JSEngine] eval: engine not initialized
[I/quickapp-core] [JSEngine] initialized (QuickJS, memLimit=64MB, stackLimit=1MB)
[D/quickapp-core] [JSEngine] already initialized
[E/quickapp-core] [JSEngine] eval: SyntaxError: unexpected token in expression: '='
[E/quickapp-core] [JSEngine] eval: Error: boom
    at <throw>:1:1
[D/quickapp-core] [JSEngine] registered global function: __test_native__ (argc=1)
[D/quickapp-core] [JSEngine] executed 1 pending jobs
[D/quickapp-core] [JSEngine] destroyed
PASS: all JSEngine tests
```

日志里能看到完整的执行轨迹，包括预期的错误。

### 4.6.3：抽象边界验证

确认平台层无法看到 QuickJS 符号：

```bash
# 写一个模拟"平台层"的测试文件
cat > /tmp/fake_platform.cpp << 'EOF'
#include "js_engine.h"
// 故意尝试 include QuickJS —— 应该失败
#include "quickjs.h"
int main() { return 0; }
EOF

# 用 Core 的 PUBLIC include 路径编译（模拟平台层的可见范围）
c++ -std=c++17 -I include /tmp/fake_platform.cpp -o /tmp/fake_platform 2>&1 | head -3
```

预期：

```text
/tmp/fake_platform.cpp:3:10: fatal error: 'quickjs.h' file not found
```

这个错误是**期望的结果**。它证明 QuickJS 的 PRIVATE include 设置生效，平台层碰不到引擎细节。

```bash
rm -f /tmp/fake_platform.cpp /tmp/fake_platform
```

### 4.6.4：内存泄漏验证

QuickJS 的引用计数很容易写错，用 sanitizer 检查：

```bash
cmake -B build-asan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address,leak -fno-omit-frame-pointer" \
  -DCMAKE_C_FLAGS="-fsanitize=address,leak -fno-omit-frame-pointer" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address,leak"
cmake --build build-asan -j4
./build-asan/tests/test_js_engine
```

预期：正常输出 `PASS`，结尾**没有** LeakSanitizer 报告。

如果出现：

```text
=================================================================
==12345==ERROR: LeakSanitizer: detected memory leaks
Direct leak of 48 byte(s) in 1 object(s) allocated from:
    #0 ... in malloc
    #1 ... in js_malloc_rt
```

说明某处 `JSValue` 忘了 `JS_FreeValue`。常见漏点：

```text
- JS_Eval 的返回值（异常分支也要释放）
- JS_GetGlobalObject 的返回值
- JS_GetPropertyStr 的返回值
- JS_ToCString 的返回值（用 JS_FreeCString）
```

macOS 上 LeakSanitizer 支持有限，可以改用 `leaks` 命令：

```bash
MallocStackLogging=1 leaks --atExit -- ./build-asan/tests/test_js_engine
```

清理：

```bash
rm -rf build-asan
```

### 4.6.5：平台无关性回归

每个 Step 都要重复这个检查，确认没有引入新的平台依赖：

```bash
nm build/libquickapp-core.a | grep -E "__android_log_print|objc_msgSend|JNI_OnLoad"
```

预期：无输出。

### 4.6.6：内存上限生效验证

验证 `JS_SetMemoryLimit` 真的能拦住失控的 JS：

```bash
cat > /tmp/test_memlimit.cpp << 'EOF'
#include <cstdio>
#include "js_engine.h"

int main() {
    auto engine = quickapp::createJSEngine();
    engine->initialize();

    // 尝试分配远超 64MB 的数组
    bool ok = engine->eval(
        "var arr = [];"
        "for (var i = 0; i < 100000000; i++) { arr.push('xxxxxxxxxxxxxxxx'); }",
        "<oom>");

    std::printf("eval returned: %s\n", ok ? "true" : "false");
    std::printf("error: %s\n", engine->getLastError().c_str());
    return ok ? 1 : 0;   // 期望 eval 失败，所以返回 0
}
EOF

c++ -std=c++17 -I include -I third_party/quickjs /tmp/test_memlimit.cpp \
    build/libquickapp-core.a build/third_party/quickjs/libquickjs.a \
    -o /tmp/test_memlimit && /tmp/test_memlimit
echo "exit code: $?"
```

预期：

```text
[E/quickapp-core] [JSEngine] eval: InternalError: out of memory
eval returned: false
error: eval: InternalError: out of memory
exit code: 0
```

进程没有被系统 OOM killer 杀掉，而是 QuickJS 主动抛出可捕获的异常。这就是设内存上限的意义。

```bash
rm -f /tmp/test_memlimit.cpp /tmp/test_memlimit
```

---

## 技术决策

### 1. 抽象层保留 getRawContext() 逃生口

纯粹的抽象要求完全隐藏 QuickJS。但实际有三个绕不开的场景：

| 场景 | 需要的 QuickJS 能力 | 包一层抽象的成本 |
|---|---|---|
| JS Bridge 注入模块 | `JS_NewCFunction`、`JS_NewObjectClass`、`JS_SetOpaque` | 需要设计一整套模块描述 DSL |
| ManifestParser 解析 JSON | `JS_ParseJSON`、`JS_GetPropertyStr` | 需要自己写 JSON 解析器或引入 cJSON |
| VNode 构建 | 遍历 JSValue 对象树 | 需要设计中间数据结构 + 转换层 |

V1 选择开这个口子，代价是这三个模块在换引擎时要重写。收益是省下大量抽象层代码，且换引擎本身是低概率事件。

关键是**把代价显式化**：`getRawContext()` 的注释里明确写了这是引擎特有出口，`static_cast<JSContext*>` 可以 grep 出所有使用点。

### 2. registerGlobalFunction 用 void* 而不是模板

```cpp
// 不这样：模板会让 js_engine.h 依赖 QuickJS 类型
template <typename F>
bool registerGlobalFunction(const char* name, F func, int argc);

// 而是：void* 把类型信息推到调用点
bool registerGlobalFunction(const char* name, void* func, int argc);
```

模板方案无法用于虚函数（虚函数不能是模板），而抽象接口必须用虚函数。`void*` 是唯一能同时满足"虚函数"和"不暴露引擎类型"的方案。

代价是丢失编译期类型检查。缓解措施：函数签名要求写在文档注释里，且实际调用点集中在 `js_bridge.cpp` 一个文件，review 成本可控。

### 3. 设置内存和栈上限

```cpp
JS_SetMemoryLimit(rt_, 64 * 1024 * 1024);
JS_SetMaxStackSize(rt_, 1024 * 1024);
```

不设的后果：

```text
不设内存上限
    JS: for(;;) arr.push('x')
    → 吃掉全部系统内存 → Android LMK 杀进程 → 用户看到闪退

不设栈上限
    JS: function f() { f(); } f();
    → 原生栈溢出 → SIGSEGV → 无法捕获的崩溃

设了之后
    → QuickJS 抛出 InternalError: out of memory / RangeError
    → C++ 侧 eval() 返回 false，可以降级处理
```

RPK 里的 JS 是不可信代码，必须有资源边界。64MB 的依据：一个页面的 VNode 树 + JS 对象通常 < 5MB，留 10 倍余量。

### 4. executePendingJobs 加迭代上限

```cpp
if (executed > 10000) { QA_LOGW(...); break; }
```

防的是这种 JS：

```javascript
function spin() { Promise.resolve().then(spin); }
spin();
```

这会让微任务队列永远不空，`executePendingJobs()` 死循环，Runtime Thread 卡死，App 无响应。

加上限后最坏情况是一轮执行 10000 个微任务（约几十毫秒）然后返回，EventLoop 能继续处理其他任务（如平台事件、Runtime 停止请求）。

### 5. 微任务异常不中断队列

```cpp
if (ret < 0) {
    // 记录日志，但不 break
}
```

一个 Promise rejection 不应该阻塞其他无关的微任务。这和浏览器行为一致：未处理的 rejection 只是打印警告，不影响后续任务。

### 6. destroy() 不清空 lastError_

```cpp
void QuickJSEngine::destroy() {
    // ... 释放资源 ...
    // 不清空 lastError_
}
```

场景：启动失败后的错误上报。

```cpp
if (!engine->eval(appJs, "app.js")) {
    std::string err = engine->getLastError();
    engine->destroy();              // 先清理资源
    reportToServer(err);            // 再上报（err 已拷贝，其实无所谓）
    // 但如果有人写 engine->destroy(); reportToServer(engine->getLastError());
    // 保留 lastError_ 能让这种写法也正确
}
```

保留错误信息的成本是几十字节内存，收益是避免一类容易写错的用法。

### 7. QuickJSEngine 放匿名 namespace

外部代码无法直接 `new QuickJSEngine()`，只能通过 `createJSEngine()`。这让抽象边界从"约定"变成"编译期强制"。

副作用：无法给 QuickJSEngine 写单元测试（测不到内部细节）。但这个类的所有行为都能通过 `JSEngine` 接口测到，不影响覆盖率。

### 8. 用 JS_EVAL_TYPE_GLOBAL 而不是 MODULE

```text
RPK 里的 bundle 是 webpack/rollup 打包产物，形态是：
    (function(global) { ... })(this);

不是 ES Module：
    import x from 'y'; export default z;
```

用 MODULE 模式会导致 `this` 在顶层是 undefined（ES Module 的严格语义），bundle 拿不到全局对象，`$app_define$` 调用失败。

---

## QA

### 1. JSRuntime 和 JSContext 的区别

```text
JSRuntime
    内存分配器、垃圾回收器、原子字符串表
    一个进程可以有多个，完全隔离（不同 Runtime 的对象不能互相引用）
    对应"一个独立的 JS 世界"

JSContext
    全局对象（globalThis）、内建类（Object/Array/Promise/JSON）
    一个 Runtime 下可以有多个 Context，共享内存但全局对象隔离
    对应"一个 JS 执行环境"
```

浏览器类比：一个 Runtime 相当于一个渲染进程，一个 Context 相当于一个 iframe 的全局环境。

本实现用 1:1 结构。将来如果要支持多快应用实例，可以考虑：

```text
方案 A：每个应用一个 Runtime  → 完全隔离，内存开销大（每个 Runtime 约 200KB 基础开销）
方案 B：一个 Runtime 多个 Context → 内存共享，但一个应用的 OOM 会影响全部
```

### 2. 为什么必须先释放 Context 再释放 Runtime

```cpp
JS_FreeContext(ctx_);   // 先
JS_FreeRuntime(rt_);    // 后
```

`JSContext` 内部持有指向 `JSRuntime` 的指针，并且释放时需要通过 Runtime 的分配器归还内存。反序释放会导致 `JS_FreeContext` 访问已释放的 Runtime，触发 use-after-free。

ASan 下反序释放会报：

```text
ERROR: AddressSanitizer: heap-use-after-free
READ of size 8 at 0x... thread T0
    #0 JS_FreeContext
```

### 3. JS_ToCString 返回的字符串需要释放吗

需要，用 `JS_FreeCString`：

```cpp
const char* s = JS_ToCString(ctx, val);
// ... 使用 s ...
JS_FreeCString(ctx, s);   // 必须
```

QuickJS 为字符串转换分配了新内存（因为 JS 字符串内部可能是 UTF-16 或 rope 结构，需要转成连续的 UTF-8）。不释放就是泄漏。

注意 `JS_FreeCString` 和 `JS_FreeValue` 不能混用：前者释放 C 字符串缓冲，后者减少 JSValue 引用计数。

### 4. eval 返回 false 时还需要 JS_FreeValue 吗

需要。`JS_Eval` 在异常时返回的是一个特殊的 exception 标记值，它仍然是需要释放的 JSValue：

```cpp
JSValue result = JS_Eval(...);
if (JS_IsException(result)) {
    captureException("eval");
    // 不能直接 return，还要往下走到 JS_FreeValue
}
JS_FreeValue(ctx_, result);   // 无论成功失败都执行
```

漏掉这个释放是 QuickJS 使用中最常见的泄漏点。

### 5. registerGlobalFunction 之后 JS 函数会被 GC 掉吗

不会。`JS_SetPropertyStr(ctx, global, name, fn)` 把函数挂到了全局对象上，全局对象是 GC root，所以函数被持续引用，不会被回收。

反过来说，如果只 `JS_NewCFunction` 不挂到任何对象上，那个函数对象会在下次 GC 时被回收。

### 6. 为什么 evalWithResult 只返回字符串不返回结构化数据

因为返回结构化数据需要在抽象层定义一套 JS 值的表示（类似 `JSValueVariant`），这会引入：

```text
- 一个 variant 类型（number/string/bool/object/array）
- JSValue → variant 的递归转换
- variant 的内存管理
```

而实际需求只有两类：

```text
简单值 → evalWithResult 的字符串够用（测试、调试、读配置）
复杂值 → 需要遍历的场景（VNode 构建）直接用 getRawContext() 更高效
```

中间态的抽象反而两头不讨好。

### 7. Promise 为什么需要手动驱动

QuickJS 是嵌入式引擎，不自带事件循环。它把微任务放进队列，等宿主来取：

```text
浏览器：V8 + 浏览器的事件循环驱动
Node.js：V8 + libuv 驱动
我们：QuickJS + RuntimeEventLoop 驱动（Step 05）
```

如果不调 `executePendingJobs()`，`Promise.resolve().then(f)` 里的 `f` 永远不会执行。这是嵌入 JS 引擎时最容易踩的坑。

Step 05 的 EventLoop 会在每轮任务后自动调用它，业务代码不需要关心。

### 8. 测试为什么能 include quickjs.h

`tests/CMakeLists.txt` 里给 `test_js_engine` 显式加了 QuickJS 的 include 路径：

```cmake
target_include_directories(test_js_engine PRIVATE
    ${CMAKE_SOURCE_DIR}/third_party/quickjs
)
```

测试需要构造 `JSCFunction` 来验证函数注册，绕不开引擎类型。这是测试代码的特权——它验证的是实现细节，不是公开契约。

生产代码（平台层）没有这个 include 路径，所以碰不到 QuickJS。这个区别在 4.6.3 的验证里得到确认。

### 9. Step 04 完成后得到了什么

Core 第一个功能模块，也是后续所有 JS 相关能力的基础：

```text
✓ include/js_engine.h        8 个虚方法的抽象接口
✓ src/quickjs_engine.cpp     约 280 行完整实现
✓ createJSEngine() 工厂
✓ 资源边界：64MB 内存 + 1MB 栈 + 10000 微任务上限
✓ 错误模型：捕获异常 + 提取 JS 堆栈 + 可清除
✓ tests/test_js_engine.cpp   9 个场景全部通过
✓ ASan 验证无泄漏
✓ 抽象边界验证：平台层无法 include quickjs.h
```

从这里开始，Core 有了执行 JS 的能力。Step 05 给它加上线程和调度，Step 07 给它注入快应用的 API。

---

## 下一步

按 `tasks.md` 进入 Step 05：实现 `RuntimeEventLoop` 抽象 + `PosixEventLoop` 默认实现 + `RuntimeThread` 线程所有权管理，让 JS 引擎跑在独立线程上并支持 Timer。
