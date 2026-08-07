# Step 3：日志抽象层

## 目录

- [目标](#目标)
- [Step 3.1：分析当前 Android 日志实现](#step-31分析当前-android-日志实现)
- [Step 3.2：设计日志抽象方案](#step-32设计日志抽象方案)
- [Step 3.3：实现 qa_log.h](#step-33实现-qa_logh)
- [Step 3.4：实现运行时回调后端](#step-34实现运行时回调后端)
- [Step 3.5：接入 CMake](#step-35接入-cmake)
- [Step 3.6：编写测试](#step-36编写测试)
- [Step 3.7：逐层验证](#step-37逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**切断 Core 对 `__android_log_print` 的依赖，建立三端可用的统一日志接口。**

这是抽取过程中第一个真正的解耦动作。Core 的每个 `.cpp` 都要输出日志，如果日志层不先解决，后面每迁移一个文件都会撞上同一个编译错误。

| 层 | 职责 | 文件 |
|---|---|---|
| 日志接口 | 提供 `QA_LOGI/W/E`，屏蔽平台差异 | `include/qa_log.h` |
| 编译期后端 | 桌面 stderr / Android logcat / 自定义 | `qa_log.h` 内条件编译 |
| 运行期后端 | 平台注册回调函数，动态接管输出 | `src/qa_log.cpp` |

**验收标准：**
- Core 源码中无 `__android_log_print`、`<android/log.h>`、裸 `printf`
- `nm libquickapp-core.a | grep __android_log_print` 无输出
- 桌面运行测试程序能看到格式化日志
- 平台层能通过 `setLogHandler()` 接管日志输出

**本步不包含：**
- 日志分级过滤的运行时配置（V1 用编译期 `QA_LOG_MIN_LEVEL`）
- 日志落盘、上报、环形缓冲
- 结构化日志（JSON 格式）

---

## Step 3.1：分析当前 Android 日志实现

抽取前先看清源头的问题。

### 3.1.1：扫描现状

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android

# 有多少文件定义了日志宏
grep -rln "define LOGI" app/src/main/cpp/core/

# 有多少处调用
grep -rc "LOGI\|LOGE\|LOGW" app/src/main/cpp/core/src/*.cpp
```

### 3.1.2：当前代码模式

Core 的每个 `.cpp` 顶部都重复这一段：

```cpp
// app/src/main/cpp/core/src/quickjs_engine.cpp（抽取前）
#include <android/log.h>

#define LOG_TAG "quickapp-core"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
```

```cpp
// app/src/main/cpp/core/src/rpk_loader.cpp（抽取前）
#include <android/log.h>

#define LOG_TAG "quickapp-core"      // 又一份
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
```

### 3.1.3：三个具体问题

```text
问题 1：平台耦合
    #include <android/log.h> 在 macOS/Linux/iOS 上不存在
    → 编译直接失败，Core 无法在桌面验证

问题 2：重复定义
    13 个 .cpp 各自定义一遍 LOG_TAG 和宏
    → 改日志行为要改 13 个文件

问题 3：宏名冲突风险
    LOGI/LOGE 是极常见的宏名
    → LVGL、Android NDK 示例、第三方 SDK 都可能定义
    → 集成时出现宏重定义警告，或更糟：静默使用了错误的实现
```

三个问题都指向同一个解法：**一个统一的、平台无关的、带命名空间前缀的日志头文件。**

---

## Step 3.2：设计日志抽象方案

### 3.2.1：两种后端切换方式

需要同时支持编译期和运行期两种切换：

```text
编译期后端（零开销）
    用途：桌面开发、单元测试、简单集成
    机制：#if defined(QA_LOG_BACKEND_XXX) 条件编译
    优点：直接调用目标函数，无间接跳转
    缺点：切换需要重新编译

运行期后端（灵活）
    用途：平台层需要接管日志（写文件、上报、加 traceId）
    机制：函数指针，平台调 setLogHandler() 注册
    优点：不重编译 Core 就能改变行为
    缺点：一次间接调用（可忽略）
```

V1 同时提供，默认用编译期后端，平台需要时注册回调覆盖。

### 3.2.2：接口形态选择

```text
方案 A：宏 + 可变参数
    QA_LOGI("count=%d", n);
    ✓ 零开销（可编译期裁剪）
    ✓ 能自动带 __FILE__ / __LINE__
    ✗ 无类型检查（除非用 __attribute__((format))）

方案 B：函数 + std::string
    qaLogI("count=" + std::to_string(n));
    ✓ 类型安全
    ✗ 每次调用都构造 std::string，热路径有开销
    ✗ 无法编译期裁剪

方案 C：C++20 std::format
    ✓ 类型安全 + 高性能
    ✗ 需要 C++20，Android NDK 支持不完整
```

选方案 A。理由：Core 是嵌入式友好的库，LVGL 场景下可能跑在 MCU 上，需要能完全编译期裁剪日志。用 `__attribute__((format(printf, ...)))` 补上类型检查。

### 3.2.3：日志级别

```text
QA_LOG_LEVEL_VERBOSE = 0   详细跟踪（默认不编译进 Release）
QA_LOG_LEVEL_DEBUG   = 1   调试信息
QA_LOG_LEVEL_INFO    = 2   关键流程节点
QA_LOG_LEVEL_WARN    = 3   异常但可继续
QA_LOG_LEVEL_ERROR   = 4   错误，功能受影响
QA_LOG_LEVEL_NONE    = 5   全部关闭
```

`QA_LOG_MIN_LEVEL` 控制编译进产物的最低级别，低于它的调用被编译器完全移除。

---

## Step 3.3：实现 qa_log.h

**@add `include/qa_log.h`（新建文件）**

```cpp
#ifndef QUICKAPP_QA_LOG_H
#define QUICKAPP_QA_LOG_H

// Core 的统一日志接口。
//
// 设计目标：
//   1. Core 源码不出现任何平台专有日志 API
//   2. 支持编译期裁剪（嵌入式场景可完全移除日志代码）
//   3. 支持运行期接管（平台层可注册回调，写文件/上报/加 traceId）
//   4. 宏名带 QA_ 前缀，避免与平台 SDK 的 LOGI/LOGE 冲突
//
// 用法：
//   #include "qa_log.h"
//   QA_LOGI("engine initialized, heap=%zu", heapSize);
//   QA_LOGE("eval failed: %s", err.c_str());
//
// 后端选择（编译期，二选一）：
//   -DQA_LOG_BACKEND_STDERR   默认，输出到 stderr
//   -DQA_LOG_BACKEND_CALLBACK 只走运行期回调，不带默认输出
//
// 级别裁剪：
//   -DQA_LOG_MIN_LEVEL=3      只保留 WARN 和 ERROR

#include <cstdarg>
#include <cstddef>

namespace quickapp {

// ============================================================
// 日志级别
// ============================================================

enum class LogLevel : int {
    Verbose = 0,
    Debug   = 1,
    Info    = 2,
    Warn    = 3,
    Error   = 4,
    None    = 5,   // 仅用于 QA_LOG_MIN_LEVEL，表示全部关闭
};

// ============================================================
// 运行期日志回调
// ============================================================

/**
 * 日志回调函数类型。平台层实现它来接管 Core 的日志输出。
 *
 * @param level   日志级别，平台可据此映射到自己的日志系统
 *                （如 Android 的 ANDROID_LOG_INFO）
 * @param tag     日志标签，固定为 "quickapp-core"，
 *                平台可用于 logcat 过滤
 * @param message 已格式化完成的日志文本，不含换行符，
 *                以 '\0' 结尾。指针在回调返回后失效，
 *                需要保存请自行拷贝
 *
 * 线程约束：可能从任意线程调用（Runtime Thread、平台 UI 线程等）。
 *          实现方必须自己保证线程安全。
 */
using LogHandler = void (*)(LogLevel level, const char* tag, const char* message);

/**
 * 注册日志回调，接管 Core 的日志输出。
 *
 * 注册后，编译期后端（stderr）不再被调用，所有日志走这个回调。
 * 传入 nullptr 可以取消注册，恢复编译期后端。
 *
 * @param handler 平台实现的回调函数，传 nullptr 表示取消
 *
 * 线程约束：应在 Runtime 启动前调用（通常是平台初始化时）。
 *          运行中切换是安全的，但可能丢失切换瞬间的日志。
 */
void setLogHandler(LogHandler handler);

/**
 * 获取当前注册的日志回调。
 * @return 当前回调，未注册时返回 nullptr
 */
LogHandler getLogHandler();

// ============================================================
// 内部实现（不要直接调用，用下面的 QA_LOG* 宏）
// ============================================================

namespace detail {

/**
 * 日志输出的实际入口。宏展开后调用这里。
 *
 * 行为：
 *   1. 若已注册 LogHandler → 格式化后传给回调
 *   2. 否则 → 走编译期后端（stderr 或空实现）
 *
 * @param level 日志级别
 * @param fmt   printf 风格格式串，不能为 nullptr
 * @param ...   格式串对应的可变参数
 */
void logPrint(LogLevel level, const char* fmt, ...)
    // 让编译器按 printf 规则检查参数类型。
    // 参数索引从 1 开始，fmt 是第 2 个参数，可变参数从第 3 个开始。
    // 写错格式（如 QA_LOGI("%d", "str")）会在编译期报警告。
    __attribute__((format(printf, 2, 3)));

} // namespace detail

} // namespace quickapp

// ============================================================
// 编译期级别裁剪
// ============================================================

// 未指定时的默认最低级别。
// Debug 构建保留全部，Release 构建从 Info 开始。
#ifndef QA_LOG_MIN_LEVEL
#  ifdef NDEBUG
#    define QA_LOG_MIN_LEVEL 2   /* Info */
#  else
#    define QA_LOG_MIN_LEVEL 0   /* Verbose */
#  endif
#endif

// ============================================================
// 日志宏
// ============================================================
//
// 每个宏都被 #if 包裹。当级别低于 QA_LOG_MIN_LEVEL 时，
// 宏展开为 ((void)0)，编译器完全移除调用，包括参数求值。
//
// 这意味着 QA_LOGV("%s", expensiveToString()) 在 Release 下
// 连 expensiveToString() 都不会执行。

#if QA_LOG_MIN_LEVEL <= 0
#  define QA_LOGV(...) ::quickapp::detail::logPrint(::quickapp::LogLevel::Verbose, __VA_ARGS__)
#else
#  define QA_LOGV(...) ((void)0)
#endif

#if QA_LOG_MIN_LEVEL <= 1
#  define QA_LOGD(...) ::quickapp::detail::logPrint(::quickapp::LogLevel::Debug, __VA_ARGS__)
#else
#  define QA_LOGD(...) ((void)0)
#endif

#if QA_LOG_MIN_LEVEL <= 2
#  define QA_LOGI(...) ::quickapp::detail::logPrint(::quickapp::LogLevel::Info, __VA_ARGS__)
#else
#  define QA_LOGI(...) ((void)0)
#endif

#if QA_LOG_MIN_LEVEL <= 3
#  define QA_LOGW(...) ::quickapp::detail::logPrint(::quickapp::LogLevel::Warn, __VA_ARGS__)
#else
#  define QA_LOGW(...) ((void)0)
#endif

#if QA_LOG_MIN_LEVEL <= 4
#  define QA_LOGE(...) ::quickapp::detail::logPrint(::quickapp::LogLevel::Error, __VA_ARGS__)
#else
#  define QA_LOGE(...) ((void)0)
#endif

#endif // QUICKAPP_QA_LOG_H
```

**几个语法点说明（对 C++ 初学者）：**

```text
::quickapp::detail::logPrint
    开头的 :: 表示从全局命名空间开始查找。
    如果写成 quickapp::detail::logPrint，在某个嵌套 namespace 里
    调用宏时可能解析到错误的符号。加 :: 保证绝对路径。

__attribute__((format(printf, 2, 3)))
    GCC/Clang 扩展，告诉编译器"这个函数的第 2 个参数是 printf 格式串，
    可变参数从第 3 个开始"。编译器会检查类型匹配。
    MSVC 不支持这个语法，移植到 Windows 时需要用 _Printf_format_string_。

((void)0)
    一个什么都不做的表达式语句。
    用它而不是空白，是为了让 QA_LOGV(...); 后面的分号仍然合法，
    并且能用在 if (x) QA_LOGV("y"); 这种没有大括号的地方。

__VA_ARGS__
    可变参数宏的占位符，展开为调用时传入的所有参数。
```

---

## Step 3.4：实现运行时回调后端

**@add `src/qa_log.cpp`（新建文件）**

```cpp
#include "qa_log.h"

#include <cstdio>

// 后端选择：未显式指定时默认用 stderr。
// 桌面开发和单元测试直接可用，无需任何配置。
#if !defined(QA_LOG_BACKEND_STDERR) && !defined(QA_LOG_BACKEND_CALLBACK)
#  define QA_LOG_BACKEND_STDERR 1
#endif

namespace quickapp {
namespace {

// 日志标签，三端统一。
// Android 侧可以用 `adb logcat -s quickapp-core` 过滤。
constexpr const char* kLogTag = "quickapp-core";

// 单条日志的最大长度。
// 超出部分被截断，不会崩溃。
// 1024 的依据：Android logcat 单条上限约 4KB，
// 但绝大多数日志在 200 字节以内，1KB 足够且栈开销可接受。
constexpr size_t kLogBufferSize = 1024;

// 当前注册的平台回调。
//
// 为什么用普通指针而不是 std::atomic：
//   函数指针的读写在所有目标平台上都是原子的（对齐的指针宽度访问）。
//   最坏情况是切换瞬间某条日志走了旧后端，不会崩溃也不会数据竞争。
//   用 atomic 会给每条日志加一次内存屏障，对日志这种高频路径不值得。
LogHandler g_logHandler = nullptr;

/**
 * 把级别枚举转为单字符标识，用于 stderr 输出。
 * @param level 日志级别
 * @return 单字符：V/D/I/W/E，未知级别返回 '?'
 */
const char* levelChar(LogLevel level) {
    switch (level) {
        case LogLevel::Verbose: return "V";
        case LogLevel::Debug:   return "D";
        case LogLevel::Info:    return "I";
        case LogLevel::Warn:    return "W";
        case LogLevel::Error:   return "E";
        default:                return "?";
    }
}

} // namespace

void setLogHandler(LogHandler handler) {
    g_logHandler = handler;
}

LogHandler getLogHandler() {
    return g_logHandler;
}

namespace detail {

void logPrint(LogLevel level, const char* fmt, ...) {
    // 防御：格式串为空时直接返回，避免 vsnprintf 未定义行为
    if (fmt == nullptr) {
        return;
    }

    // 在栈上格式化。不用 std::string 是为了避免每条日志一次堆分配，
    // 也让这段代码能在没有完整 C++ 运行时的嵌入式环境工作。
    char buffer[kLogBufferSize];

    va_list args;
    va_start(args, fmt);
    // vsnprintf 保证不溢出，且总是写入 '\0' 结尾。
    // 返回值是"如果缓冲区足够大本应写入的长度"，可能大于 kLogBufferSize，
    // 这里不需要这个信息，截断是可接受行为。
    std::vsnprintf(buffer, sizeof(buffer), fmt, args);
    va_end(args);

    // 优先走平台注册的回调
    if (g_logHandler != nullptr) {
        g_logHandler(level, kLogTag, buffer);
        return;
    }

    // 回退到编译期后端
#if defined(QA_LOG_BACKEND_STDERR)
    std::fprintf(stderr, "[%s/%s] %s\n", levelChar(level), kLogTag, buffer);
    // 不调用 fflush：stderr 默认无缓冲，直接可见。
    // 显式 flush 会在高频日志时明显拖慢速度。
#endif
    // QA_LOG_BACKEND_CALLBACK 模式下没注册回调 → 日志被丢弃，这是预期行为
}

} // namespace detail
} // namespace quickapp
```

**Android 平台侧的回调实现示例**（这段代码属于 Android 工程，不在 Core 里，Step 11 会用到）：

```cpp
// platform/android/jni_bridge.cpp 中
#include <android/log.h>
#include "qa_log.h"

// 把 Core 的日志级别映射到 Android logcat 级别
static void androidLogHandler(quickapp::LogLevel level,
                              const char* tag,
                              const char* message) {
    int androidPriority;
    switch (level) {
        case quickapp::LogLevel::Verbose: androidPriority = ANDROID_LOG_VERBOSE; break;
        case quickapp::LogLevel::Debug:   androidPriority = ANDROID_LOG_DEBUG;   break;
        case quickapp::LogLevel::Info:    androidPriority = ANDROID_LOG_INFO;    break;
        case quickapp::LogLevel::Warn:    androidPriority = ANDROID_LOG_WARN;    break;
        case quickapp::LogLevel::Error:   androidPriority = ANDROID_LOG_ERROR;   break;
        default:                          androidPriority = ANDROID_LOG_INFO;    break;
    }
    // 用 "%s" 而不是直接传 message，防止 message 中的 % 被当作格式符
    __android_log_print(androidPriority, tag, "%s", message);
}

// JNI_OnLoad 中注册
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    g_vm = vm;
    quickapp::setLogHandler(androidLogHandler);   // ← 接管 Core 日志
    return JNI_VERSION_1_6;
}
```

这样 `__android_log_print` 只出现在 Android 工程里，Core 完全不知道它的存在。

---

## Step 3.5：接入 CMake

**@update `CMakeLists.txt` — 替换 `add_library(quickapp-core STATIC ...)` 块**

```cmake
add_library(quickapp-core STATIC
    src/core_version.cpp
    src/qa_log.cpp              # ← Step 03 新增
)
```

**@add `CMakeLists.txt` — 在 `target_compile_options` 之后插入**

```cmake
# ============================================================
# 日志配置
# ============================================================

# 日志后端选择：
#   STDERR   桌面/测试用，默认
#   CALLBACK 只走 setLogHandler 注册的回调，不带默认输出
#            （嵌入式场景下避免链接 stdio）
set(QUICKAPP_LOG_BACKEND "STDERR" CACHE STRING "Log backend: STDERR or CALLBACK")
set_property(CACHE QUICKAPP_LOG_BACKEND PROPERTY STRINGS "STDERR" "CALLBACK")

target_compile_definitions(quickapp-core PRIVATE
    QA_LOG_BACKEND_${QUICKAPP_LOG_BACKEND}=1
)

# 编译期最低日志级别：0=Verbose 1=Debug 2=Info 3=Warn 4=Error 5=None
# 留空则由 qa_log.h 根据 NDEBUG 自动决定（Debug=0, Release=2）
set(QUICKAPP_LOG_MIN_LEVEL "" CACHE STRING "Minimum log level compiled in (0-5)")

if(NOT QUICKAPP_LOG_MIN_LEVEL STREQUAL "")
    target_compile_definitions(quickapp-core PRIVATE
        QA_LOG_MIN_LEVEL=${QUICKAPP_LOG_MIN_LEVEL}
    )
endif()

message(STATUS "  Log backend:  ${QUICKAPP_LOG_BACKEND}")
message(STATUS "  Log level:    ${QUICKAPP_LOG_MIN_LEVEL} (empty = auto by NDEBUG)")
```

**注意 `target_compile_definitions` 用 PRIVATE 的原因：**

```text
PRIVATE → 只影响 Core 自己的编译单元
PUBLIC  → 会传染给所有链接 Core 的平台工程
```

日志后端是 Core 的内部实现选择。平台工程有自己的日志系统，不应该被 Core 的宏定义污染。

---

## Step 3.6：编写测试

**@add `tests/test_log.cpp`（新建文件）**

```cpp
// 日志抽象层测试。
//
// 验证点：
//   1. 未注册回调时不崩溃（走 stderr 后端）
//   2. 注册回调后日志走回调，级别和内容正确
//   3. 格式化参数正确展开
//   4. 取消注册后回退到默认后端
//   5. 超长日志被安全截断，不溢出

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "qa_log.h"

#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

namespace {

// 捕获日志的测试回调用到的全局状态。
// 测试是单线程的，用全局变量最简单。
struct CapturedLog {
    quickapp::LogLevel level;
    std::string tag;
    std::string message;
};

std::vector<CapturedLog> g_captured;

void testHandler(quickapp::LogLevel level, const char* tag, const char* message) {
    g_captured.push_back({level, tag ? tag : "", message ? message : ""});
}

} // namespace

int main() {
    // ---- 场景 1：未注册回调，只验证不崩溃 ----
    QA_LOGI("no handler registered, this goes to stderr");
    QA_LOGE("error line with arg: %d", 42);

    // ---- 场景 2：注册回调，验证内容 ----
    quickapp::setLogHandler(testHandler);
    CHECK(quickapp::getLogHandler() == testHandler, "getLogHandler mismatch");

    g_captured.clear();
    QA_LOGI("hello %s, count=%d", "world", 7);

    CHECK(g_captured.size() == 1, "expected exactly 1 captured log");
    CHECK(g_captured[0].level == quickapp::LogLevel::Info, "level should be Info");
    CHECK(g_captured[0].tag == "quickapp-core", "tag should be quickapp-core");
    CHECK(g_captured[0].message == "hello world, count=7", "message formatting wrong");

    // ---- 场景 3：各级别都能正确传递 ----
    g_captured.clear();
    QA_LOGW("warn");
    QA_LOGE("error");

    CHECK(g_captured.size() == 2, "expected 2 logs (warn + error)");
    CHECK(g_captured[0].level == quickapp::LogLevel::Warn, "first should be Warn");
    CHECK(g_captured[1].level == quickapp::LogLevel::Error, "second should be Error");

    // ---- 场景 4：超长日志安全截断 ----
    g_captured.clear();
    std::string longStr(4096, 'x');   // 远超 1024 的缓冲区
    QA_LOGI("%s", longStr.c_str());

    CHECK(g_captured.size() == 1, "long log should still produce 1 entry");
    CHECK(g_captured[0].message.size() < 1024, "long log should be truncated");
    CHECK(g_captured[0].message[0] == 'x', "truncated content should start correctly");

    // ---- 场景 5：取消注册 ----
    quickapp::setLogHandler(nullptr);
    CHECK(quickapp::getLogHandler() == nullptr, "handler should be cleared");

    g_captured.clear();
    QA_LOGI("back to stderr backend");
    CHECK(g_captured.empty(), "no callback should be invoked after clearing");

    std::printf("PASS: all log abstraction tests\n");
    return 0;
}
```

**@update `tests/CMakeLists.txt` — 在 `test_version` 之后插入**

```cmake
# test_log：日志抽象层
add_executable(test_log test_log.cpp)
target_link_libraries(test_log PRIVATE quickapp-core)
add_test(NAME test_log COMMAND test_log)
```

---

## Step 3.7：逐层验证

### 3.7.1：编译验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build -j4
```

预期输出包含：

```text
--   Log backend:  STDERR
--   Log level:     (empty = auto by NDEBUG)
...
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/qa_log.cpp.o
[ xx%] Linking CXX static library libquickapp-core.a
[100%] Built target test_log
```

**常见错误：**

```text
"error: format string is not a string literal"
    → 代码里写了 QA_LOGI(someVariable)。
      必须写 QA_LOGI("%s", someVariable)，
      这正是 __attribute__((format)) 要拦住的问题。

"undefined reference to quickapp::detail::logPrint"
    → CMakeLists.txt 的 add_library 忘了加 src/qa_log.cpp

"qa_log.h: No such file or directory"
    → 文件放错位置，必须在 include/ 下
```

### 3.7.2：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
    Start 1: test_version
1/2 Test #1: test_version .....................   Passed
    Start 2: test_log
2/2 Test #2: test_log .........................   Passed

100% tests passed, 0 tests failed out of 2
```

直接运行能看到 stderr 后端的实际输出：

```bash
./build/tests/test_log
```

预期：

```text
[I/quickapp-core] no handler registered, this goes to stderr
[E/quickapp-core] error line with arg: 42
[I/quickapp-core] back to stderr backend
PASS: all log abstraction tests
```

前两行和最后一行是走 stderr 后端的日志，中间的都被 `testHandler` 捕获了所以看不到。

### 3.7.3：平台无关性验证

这是 Step 03 的核心验收点：

```bash
nm build/libquickapp-core.a | grep __android_log_print
```

预期：**无输出**。

对比一下 Android 工程抽取前的状态：

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android
nm app/build/intermediates/cxx/Debug/*/obj/arm64-v8a/libquickapp-runtime-core.so \
   | grep __android_log_print
# 有输出：U __android_log_print
```

Core 独立后这个符号消失了，说明日志依赖真正被切断。

### 3.7.4：级别裁剪验证

验证编译期裁剪真的生效：

```bash
# 只保留 ERROR 级别
cmake -B build-quiet -DQUICKAPP_LOG_MIN_LEVEL=4
cmake --build build-quiet -j4
./build-quiet/tests/test_log
```

预期：`QA_LOGI` 和 `QA_LOGW` 的调用被编译器移除，测试会失败：

```text
FAIL: expected exactly 1 captured log
```

这个失败是正确的——它证明了裁剪生效。测试本身假设所有级别都启用，属于测试的前置条件。

用符号表确认代码真的被移除：

```bash
# Verbose/Debug/Info 级别的字符串常量应该不在产物里
strings build-quiet/libquickapp-core.a | grep "no handler registered"
# 无输出 → 说明整个调用包括字符串都被移除了
```

清理这个验证目录：

```bash
rm -rf build-quiet
```

### 3.7.5：CALLBACK 后端验证

嵌入式场景需要完全不链接 stdio：

```bash
cmake -B build-cb -DQUICKAPP_LOG_BACKEND=CALLBACK
cmake --build build-cb -j4
./build-cb/tests/test_log
```

预期：场景 1 和场景 5 的日志不再输出到 stderr（因为没有默认后端），但测试仍然通过：

```text
PASS: all log abstraction tests
```

```bash
rm -rf build-cb
```

### 3.7.6：格式检查生效验证

故意写一个类型不匹配的调用，确认编译器能拦住：

```cpp
// 临时加到 tests/test_log.cpp 中
QA_LOGI("%d", "this is a string not an int");
```

编译时预期：

```text
warning: format specifies type 'int' but the argument has type 'const char *'
         [-Wformat]
```

有这个警告说明 `__attribute__((format(printf, 2, 3)))` 生效了。验证完记得删掉这行。

---

## 技术决策

### 1. 宏名带 QA_ 前缀

`LOGI`/`LOGE` 冲突的实际场景：

```text
Android NDK 示例代码      → 定义 LOGI
LVGL 的 lv_log.h          → 定义 LV_LOG_INFO，但很多项目再包一层叫 LOGI
第三方 SDK（推送、统计）   → 常见定义 LOGI/LOGE
```

一旦重定义，编译器只报 warning 不报 error，最终链接到哪个实现取决于 include 顺序。这类问题排查极其费时。`QA_` 前缀从源头避免。

### 2. 同时提供编译期和运行期后端

单靠一种都不够：

```text
只有编译期后端 → Android 想加 traceId 或写文件就得改 Core 源码
只有运行期后端 → 嵌入式场景无法完全裁剪日志代码，且必须链接 stdio
```

两者组合后，三端各取所需：

| 平台 | 配置 |
|---|---|
| 桌面开发/测试 | STDERR 后端，不注册回调 |
| Android | 注册 `androidLogHandler`，走 logcat |
| iOS | 注册 handler 走 `os_log` |
| LVGL/MCU | CALLBACK 后端 + `QA_LOG_MIN_LEVEL=3`，只保留 WARN/ERROR |

### 3. 函数指针不用 std::atomic

```cpp
LogHandler g_logHandler = nullptr;   // 普通指针
```

严格来说这是数据竞争。但实际影响可以接受：

```text
最坏情况：切换 handler 的瞬间，另一个线程的某条日志走了旧后端
后果：一条日志去错了地方，不崩溃、不损坏数据
代价（如果用 atomic）：每条日志一次内存屏障
```

日志是高频路径（首屏启动会有几百条），加屏障不值得。且 `setLogHandler` 的正确用法是启动前调用一次，运行中不切换。

### 4. 栈缓冲区不用 std::string

```cpp
char buffer[1024];                    // 栈上，零分配
std::vsnprintf(buffer, sizeof(buffer), fmt, args);
```

用 `std::string` 的话每条日志一次堆分配。首屏几百条日志就是几百次 malloc/free，在低端机上是可测量的开销。1KB 栈空间在所有目标平台都安全（默认线程栈 512KB+）。

代价是超长日志被截断。实际场景中超过 1KB 的日志本身就是设计问题（应该分多条或摘要）。

### 5. 级别裁剪用 #if 而不是 if

```cpp
// 不这样：运行期判断
if (level >= g_minLevel) { logPrint(...); }
// 参数仍然被求值，字符串常量仍然在产物里

// 而是：编译期判断
#if QA_LOG_MIN_LEVEL <= 0
#  define QA_LOGV(...) logPrint(...)
#else
#  define QA_LOGV(...) ((void)0)
#endif
// 整个调用连字符串常量一起消失
```

差别在嵌入式场景很关键：MCU 的 Flash 可能只有几百 KB，几百条日志字符串就是几十 KB。编译期裁剪能真正省下这部分空间。

### 6. 日志 tag 固定不可配置

```cpp
constexpr const char* kLogTag = "quickapp-core";
```

不做成可配置项的原因：Core 是单一库，所有日志来自同一个组件。需要区分子模块时，在格式串里写明即可：

```cpp
QA_LOGI("[JSEngine] initialized");
QA_LOGI("[RPKLoader] opened, %zu entries", count);
```

这样 logcat 过滤仍然用一个 tag，模块信息在消息里，比多 tag 更简单。

---

## QA

### 1. 为什么日志抽象要放在 Step 03 而不是更晚

因为它是所有 Core 源文件的共同依赖。Step 04 迁移 `quickjs_engine.cpp` 时，那个文件里就有十几处 `LOGI` 调用。如果日志层没先做好，Step 04 要么编译不过，要么得临时注释掉所有日志——两种都会打断验证节奏。

依赖关系决定顺序：`qa_log.h` 无依赖，所以它最先。

### 2. `__attribute__((format))` 在 MSVC 上不支持怎么办

当前三个目标平台（Android NDK、iOS clang、桌面 gcc/clang）都支持这个语法，V1 不需要处理 MSVC。

如果将来要支持 Windows，加条件编译：

```cpp
#if defined(__GNUC__) || defined(__clang__)
#  define QA_PRINTF_FORMAT(fmtIdx, argIdx) __attribute__((format(printf, fmtIdx, argIdx)))
#else
#  define QA_PRINTF_FORMAT(fmtIdx, argIdx)
#endif

void logPrint(LogLevel level, const char* fmt, ...) QA_PRINTF_FORMAT(2, 3);
```

### 3. 平台注册回调后，Core 内部的 stderr 输出还会执行吗

不会。`logPrint` 里回调优先且直接 return：

```cpp
if (g_logHandler != nullptr) {
    g_logHandler(level, kLogTag, buffer);
    return;              // ← 不再走 stderr
}
```

这样 Android 上不会出现日志既进 logcat 又进 stderr 的重复输出。

### 4. 回调里能调用 Core 的其他函数吗

技术上可以，但要注意两点：

```text
1. 不要在回调里再打日志 → 无限递归
2. 回调可能在任意线程被调用 → 不要访问 Runtime Thread 独占的状态
```

安全的回调实现应该只做格式转换和转发，不含业务逻辑。上面的 `androidLogHandler` 就是这个模式。

### 5. 为什么不用 spdlog / fmt 这类成熟日志库

三个原因：

```text
1. 网络限制：当前环境无法从 GitHub 拉依赖
2. 体积：spdlog + fmt 编译产物约 200KB+，对嵌入式场景过重
3. 依赖传染：Core 是要被三端集成的库，
   引入第三方日志库会让平台工程也背上这个依赖
```

Core 的日志需求很简单（格式化 + 分级 + 转发），90 行代码够了。平台层想用 spdlog 完全可以，通过 `setLogHandler` 桥接进去。

### 6. `((void)0)` 为什么不能写成空

```cpp
#define QA_LOGV(...)          // 空定义
if (cond) QA_LOGV("x");       // 展开为 if (cond) ;  ← 能编译但语义诡异
else doSomething();           // 某些写法下会导致 else 悬空错误
```

`((void)0)` 是一个合法的表达式语句，保证宏在任何语法位置都能安全替换。这是 C 宏的标准做法（`assert` 在 NDEBUG 下也是这么定义的）。

### 7. Step 03 完成后得到了什么

Core 的第一个真正解耦点：

```text
✓ include/qa_log.h + src/qa_log.cpp（约 90 行代码）
✓ 5 个日志级别 + 编译期裁剪
✓ 编译期后端（STDERR/CALLBACK）+ 运行期回调，两种切换方式
✓ nm 验证：无 __android_log_print 符号
✓ 格式串类型检查生效
✓ Android 侧回调实现方案确定（Step 11 使用）
```

从 Step 04 开始，每个迁移的文件只需把 `LOGI` 改成 `QA_LOGI`、把 `#include <android/log.h>` 改成 `#include "qa_log.h"`，不会再撞上平台依赖问题。

---

## 下一步

按 `tasks.md` 进入 Step 04：迁移 `js_engine.h` 和 `quickjs_engine.cpp`，建立 JS 引擎抽象层，并在桌面验证 eval 能力。
