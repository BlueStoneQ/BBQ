# Step 4：Runtime EventLoop 与线程模型

## 目录

- [目标](#目标)
- [Step 4.1：定义 RuntimeEventLoop 接口](#step-41定义-runtimeeventloop-接口)
- [Step 4.2：集成 libuv 到 CMake](#step-42集成-libuv-到-cmake)
- [Step 4.3：实现 LibuvEventLoop](#step-43实现-libuveventloop)
- [Step 4.4：建立 RuntimeThread 封装](#step-44建立-runtimethread-封装)
- [Step 4.5：QuickJS Microtask 调度集成](#step-45quickjs-microtask-调度集成)
- [Step 4.6：JNI 层新增线程测试入口](#step-46jni-层新增线程测试入口)
- [Step 4.7：逐层验证](#step-47逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**建立 Runtime 的独立线程和任务调度，确保 QuickJS 线程隔离。**

| 层 | 职责 | 文件 |
|---|---|---|
| EventLoop 接口 | 抽象任务投递/Timer/停止（平台无关） | `core/include/runtime_event_loop.h` |
| libuv 实现 | 具体的事件循环 backend | `platform/common/libuv_event_loop.h/cpp` |
| RuntimeThread | 管理线程生命周期，持有 EventLoop + JSEngine | `core/include/runtime_thread.h` / `core/src/runtime_thread.cpp` |

**验收标准：**
- RuntimeThread 启动后 Logcat 打印 "Runtime thread started"
- 从 Android UI Thread post 一个任务，Runtime Thread 执行并打印
- Timer 延迟 500ms 触发，Logcat 打印时间戳
- stop() 后新 post 的任务不再执行
- QuickJS eval 只在 Runtime Thread 中执行

**本步不包含：**
- JS Bridge 完整实现
- 渲染命令批量提交
- Android → C++ 事件通道的完整实现
- 完整生命周期状态机

---

## Step 4.1：定义 RuntimeEventLoop 接口

@add `app/src/main/cpp/core/include/runtime_event_loop.h`（新建文件）

```cpp
#ifndef QUICKAPP_RUNTIME_EVENT_LOOP_H
#define QUICKAPP_RUNTIME_EVENT_LOOP_H

#include <cstdint>
#include <functional>
#include <memory>

namespace quickapp {

using Task = std::function<void()>;
using TimerId = uint64_t;

/**
 * Runtime 事件循环抽象接口。
 *
 * 本质：一个单线程任务队列 + 定时器。
 * 所有 JS 执行和 Core 状态变更都通过 post() 投递到这个循环中串行执行。
 * 这保证了 QuickJS 的线程安全（QuickJS 不是线程安全的）。
 *
 * Core 只依赖这个接口。第一个实现用 libuv，后续可替换为
 * Android Looper、iOS CFRunLoop 或自定义实现。
 */
class RuntimeEventLoop {
public:
    virtual ~RuntimeEventLoop() = default;

    /**
     * 投递任务到事件循环所在线程执行。
     * 可以从任意线程调用（线程安全）。
     * @param task 要执行的任务
     */
    virtual void post(Task task) = 0;

    /**
     * 投递延迟任务。
     * @param task 要执行的任务
     * @param delayMs 延迟毫秒数
     * @return TimerId，可用于取消
     */
    virtual TimerId postDelayed(Task task, uint64_t delayMs) = 0;

    /**
     * 取消尚未执行的定时任务。
     * @param id postDelayed 返回的 TimerId
     */
    virtual void cancelTimer(TimerId id) = 0;

    /**
     * 启动事件循环（阻塞当前线程，直到 stop() 被调用）。
     * 通常在 RuntimeThread 的线程函数中调用。
     */
    virtual void run() = 0;

    /**
     * 停止事件循环。
     * 可以从任意线程调用。调用后 run() 会返回。
     * 停止后 post() 的任务不再执行。
     */
    virtual void stop() = 0;

    /** 事件循环是否正在运行 */
    virtual bool isRunning() const = 0;
};

/** 工厂函数：创建 libuv 实现的 EventLoop */
std::unique_ptr<RuntimeEventLoop> createEventLoop();

} // namespace quickapp

#endif // QUICKAPP_RUNTIME_EVENT_LOOP_H
```

---

## Step 4.2：集成 libuv 到 CMake

### 4.2.1：下载 libuv 源码

从 https://github.com/libuv/libuv 下载 release（推荐 v1.48+），解压到：

```text
app/src/main/cpp/third_party/libuv/
```

libuv 自带 `CMakeLists.txt`，可以直接作为子项目引入。

### 4.2.2：更新 CMakeLists.txt

@update `app/src/main/cpp/CMakeLists.txt` — 在 QuickJS 静态库之后、主库 add_library 之前插入：

```cmake
# ============================================================
# libuv 静态库（用其自带的 CMakeLists.txt）
# ============================================================
set(LIBUV_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/libuv)

# 关闭 libuv 的测试和 benchmark，只编译库本身
set(LIBUV_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LIBUV_BUILD_BENCH OFF CACHE BOOL "" FORCE)

add_subdirectory(${LIBUV_DIR} libuv_build)
```

@update `app/src/main/cpp/CMakeLists.txt` — 主库 add_library 的源文件列表新增：

```cmake
    platform/common/libuv_event_loop.cpp
    core/src/runtime_thread.cpp
```

@update `app/src/main/cpp/CMakeLists.txt` — target_include_directories 新增：

```cmake
    ${LIBUV_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/platform/common
```

@update `app/src/main/cpp/CMakeLists.txt` — target_link_libraries 新增：

```cmake
    uv_a    # libuv 静态库目标名
```

---

## Step 4.3：实现 LibuvEventLoop

@add `app/src/main/cpp/platform/common/libuv_event_loop.h`（新建文件）
@add `app/src/main/cpp/platform/common/libuv_event_loop.cpp`（新建文件）

**libuv_event_loop.h：**

```cpp
#ifndef QUICKAPP_LIBUV_EVENT_LOOP_H
#define QUICKAPP_LIBUV_EVENT_LOOP_H

#include "runtime_event_loop.h"
#include <uv.h>
#include <mutex>
#include <queue>
#include <atomic>
#include <unordered_map>

namespace quickapp {

class LibuvEventLoop : public RuntimeEventLoop {
public:
    LibuvEventLoop();
    ~LibuvEventLoop() override;

    void post(Task task) override;
    TimerId postDelayed(Task task, uint64_t delayMs) override;
    void cancelTimer(TimerId id) override;
    void run() override;
    void stop() override;
    bool isRunning() const override;

private:
    uv_loop_t loop_;
    uv_async_t async_;              // 跨线程唤醒：其他线程 post() 时唤醒 loop

    std::mutex mutex_;              // 保护 pendingTasks_
    std::queue<Task> pendingTasks_; // 待执行的任务队列

    std::atomic<bool> running_{false};
    std::atomic<bool> stopped_{false};

    // Timer 管理
    TimerId nextTimerId_{1};
    std::unordered_map<TimerId, uv_timer_t*> timers_;

    // async 回调：从队列中取出所有任务并执行
    static void onAsync(uv_async_t* handle);

    // timer 回调
    static void onTimer(uv_timer_t* handle);

    // 清理所有 timer
    void cleanupTimers();
};

} // namespace quickapp

#endif
```

**libuv_event_loop.cpp：**

```cpp
#include "libuv_event_loop.h"
#include <android/log.h>

#define LOG_TAG "quickapp-loop"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace quickapp {

LibuvEventLoop::LibuvEventLoop() {
    uv_loop_init(&loop_);

    // async handle：用于跨线程唤醒 loop
    // 当其他线程调用 uv_async_send(&async_) 时，loop 会在下一轮迭代中调用 onAsync
    uv_async_init(&loop_, &async_, onAsync);
    async_.data = this;
}

LibuvEventLoop::~LibuvEventLoop() {
    stop();
    cleanupTimers();
    uv_close(reinterpret_cast<uv_handle_t*>(&async_), nullptr);
    uv_loop_close(&loop_);
}

void LibuvEventLoop::post(Task task) {
    if (stopped_) return; // 已停止，丢弃任务

    {
        std::lock_guard<std::mutex> lock(mutex_);
        pendingTasks_.push(std::move(task));
    }

    // 唤醒 loop 线程来执行任务
    uv_async_send(&async_);
}

TimerId LibuvEventLoop::postDelayed(Task task, uint64_t delayMs) {
    if (stopped_) return 0;

    TimerId id = nextTimerId_++;

    // Timer 必须在 loop 线程创建，所以通过 post 投递
    post([this, id, task = std::move(task), delayMs]() mutable {
        auto* timer = new uv_timer_t;
        uv_timer_init(&loop_, timer);

        // data 指向一个结构体，携带回调和 id
        struct TimerData { Task task; TimerId id; LibuvEventLoop* self; };
        timer->data = new TimerData{std::move(task), id, this};

        uv_timer_start(timer, onTimer, delayMs, 0); // 一次性，不重复
        timers_[id] = timer;
    });

    return id;
}

void LibuvEventLoop::cancelTimer(TimerId id) {
    post([this, id]() {
        auto it = timers_.find(id);
        if (it != timers_.end()) {
            uv_timer_stop(it->second);
            delete static_cast<struct { Task task; TimerId id; LibuvEventLoop* self; }*>(it->second->data);
            uv_close(reinterpret_cast<uv_handle_t*>(it->second), [](uv_handle_t* h) { delete (uv_timer_t*)h; });
            timers_.erase(it);
        }
    });
}

void LibuvEventLoop::run() {
    running_ = true;
    LOGI("EventLoop started");

    // UV_RUN_DEFAULT：阻塞直到没有活跃 handle 或 stop 被调用
    uv_run(&loop_, UV_RUN_DEFAULT);

    running_ = false;
    LOGI("EventLoop stopped");
}

void LibuvEventLoop::stop() {
    stopped_ = true;
    uv_stop(&loop_);
    uv_async_send(&async_); // 确保 loop 能醒来并退出
}

bool LibuvEventLoop::isRunning() const {
    return running_;
}

// 从任务队列取出所有任务并执行
void LibuvEventLoop::onAsync(uv_async_t* handle) {
    auto* self = static_cast<LibuvEventLoop*>(handle->data);
    std::queue<Task> tasks;

    {
        std::lock_guard<std::mutex> lock(self->mutex_);
        std::swap(tasks, self->pendingTasks_);
    }

    while (!tasks.empty()) {
        tasks.front()();
        tasks.pop();
    }
}

void LibuvEventLoop::onTimer(uv_timer_t* handle) {
    struct TimerData { Task task; TimerId id; LibuvEventLoop* self; };
    auto* data = static_cast<TimerData*>(handle->data);

    // 执行回调
    data->task();

    // 清理
    data->self->timers_.erase(data->id);
    delete data;
    uv_close(reinterpret_cast<uv_handle_t*>(handle), [](uv_handle_t* h) { delete (uv_timer_t*)h; });
}

void LibuvEventLoop::cleanupTimers() {
    for (auto& [id, timer] : timers_) {
        uv_timer_stop(timer);
        uv_close(reinterpret_cast<uv_handle_t*>(timer), nullptr);
    }
    timers_.clear();
}

// 工厂函数
std::unique_ptr<RuntimeEventLoop> createEventLoop() {
    return std::make_unique<LibuvEventLoop>();
}

} // namespace quickapp
```

**核心机制：**

```text
线程 A（Android UI Thread）           线程 B（Runtime Thread）
    │                                    │
    │ post(task)                          │ uv_run() 阻塞等待
    │   → mutex lock                     │
    │   → pendingTasks_.push(task)       │
    │   → uv_async_send()               │
    │                                    │ ← 被唤醒
    │                                    │ onAsync() → 取出 task → 执行
```

---

## Step 4.4：建立 RuntimeThread 封装

@add `app/src/main/cpp/core/include/runtime_thread.h`（新建文件）
@add `app/src/main/cpp/core/src/runtime_thread.cpp`（新建文件）

**runtime_thread.h：**

```cpp
#ifndef QUICKAPP_RUNTIME_THREAD_H
#define QUICKAPP_RUNTIME_THREAD_H

#include "runtime_event_loop.h"
#include "js_engine.h"
#include <thread>
#include <memory>

namespace quickapp {

/**
 * RuntimeThread 管理 Runtime 的独立线程。
 *
 * 规则：
 * - QuickJS 只在这个线程中操作
 * - Core 状态（VNode、Router 等）只在这个线程中修改
 * - 外部通过 post() 投递任务到这个线程
 * - Android View 操作不在这个线程（需要投递到 UI Thread）
 */
class RuntimeThread {
public:
    RuntimeThread();
    ~RuntimeThread();

    /** 启动线程和 EventLoop */
    void start();

    /** 停止线程（等待线程退出） */
    void stop();

    /** 投递任务到 Runtime Thread 执行 */
    void post(Task task);

    /** 投递延迟任务 */
    TimerId postDelayed(Task task, uint64_t delayMs);

    /** 获取 JSEngine（只能在 Runtime Thread 内使用） */
    JSEngine* getEngine() { return engine_.get(); }

    /** 是否正在运行 */
    bool isRunning() const;

private:
    std::unique_ptr<RuntimeEventLoop> eventLoop_;
    std::unique_ptr<JSEngine> engine_;
    std::thread thread_;

    void threadMain(); // 线程入口函数
};

} // namespace quickapp

#endif
```

**runtime_thread.cpp：**

```cpp
#include "runtime_thread.h"
#include <android/log.h>

#define LOG_TAG "quickapp-thread"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace quickapp {

RuntimeThread::RuntimeThread() = default;

RuntimeThread::~RuntimeThread() {
    stop();
}

void RuntimeThread::start() {
    // 线程入口
    thread_ = std::thread(&RuntimeThread::threadMain, this);
}

void RuntimeThread::stop() {
    if (eventLoop_) {
        eventLoop_->stop();
    }
    if (thread_.joinable()) {
        thread_.join(); // 等待线程退出
    }
}

void RuntimeThread::post(Task task) {
    if (eventLoop_) {
        eventLoop_->post(std::move(task));
    }
}

TimerId RuntimeThread::postDelayed(Task task, uint64_t delayMs) {
    if (eventLoop_) {
        return eventLoop_->postDelayed(std::move(task), delayMs);
    }
    return 0;
}

bool RuntimeThread::isRunning() const {
    return eventLoop_ && eventLoop_->isRunning();
}

void RuntimeThread::threadMain() {
    LOGI("Runtime thread started");

    // 1. 创建 EventLoop（必须在 Runtime Thread 中创建，libuv loop 绑定线程）
    eventLoop_ = createEventLoop();

    // 2. 创建 JSEngine（QuickJS 的 Runtime 和 Context 属于当前线程）
    engine_ = createJSEngine();
    if (!engine_->initialize()) {
        LOGE("JSEngine initialize failed on runtime thread");
        return;
    }

    LOGI("Runtime thread: EventLoop + JSEngine ready");

    // 3. 运行事件循环（阻塞，直到 stop() 被调用）
    eventLoop_->run();

    // 4. 清理（EventLoop 退出后）
    engine_->destroy();
    engine_.reset();
    eventLoop_.reset();

    LOGI("Runtime thread exited");
}

} // namespace quickapp
```

**线程生命周期：**

```text
start()
    → std::thread(&threadMain)
    → threadMain():
        1. 创建 EventLoop
        2. 创建 JSEngine
        3. eventLoop_->run()  ← 阻塞在这里
    ...
stop()
    → eventLoop_->stop()
    → thread_.join()  ← 等 threadMain 退出
    → threadMain() 继续：
        4. engine_->destroy()
        5. return
```

---

## Step 4.5：QuickJS Microtask 调度集成

QuickJS 的 Promise 使用 Job Queue（微任务队列）。每次执行完一个宏任务后，需要调用 `JS_ExecutePendingJob` 清空微任务。

在 `RuntimeThread::post` 投递的每个任务执行完后自动 drain 微任务：

@update `core/src/runtime_thread.cpp` — 修改 `post` 方法，包裹任务执行后的微任务处理：

```cpp
void RuntimeThread::post(Task task) {
    if (!eventLoop_) return;

    eventLoop_->post([this, task = std::move(task)]() {
        // 执行宏任务
        task();

        // 清空 QuickJS Promise 微任务队列
        if (engine_) {
            // QuickJSEngine 需要暴露 drainMicrotasks 方法
            // 内部调用 JS_ExecutePendingJob 直到返回 0
            auto* qjsEngine = static_cast<QuickJSEngine*>(engine_.get());
            JSContext* ctx = nullptr;
            while (JS_ExecutePendingJob(qjsEngine->getRuntime(), &ctx) > 0) {}
        }
    });
}
```

> 注意：这要求 `js_engine.h` 或 QuickJSEngine 暴露 `getRuntime()`。Step 3 已经在 QuickJSEngine 中提供了这个方法。

---

## Step 4.6：JNI 层新增线程测试入口

@update `app/src/main/cpp/platform/android/jni_bridge.cpp` — 新增 include 和全局变量：

```cpp
#include "runtime_thread.h"

namespace {
    // Step 4 新增：全局 RuntimeThread 实例
    static std::unique_ptr<quickapp::RuntimeThread> g_runtimeThread;
}
```

@update `app/src/main/cpp/platform/android/jni_bridge.cpp` — 在 `extern "C"` 块中新增：

```cpp
// Step 4 测试入口：验证 RuntimeThread + EventLoop
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeTestThread(
        JNIEnv* env, jobject thiz) {
    LOGI("nativeTestThread: starting RuntimeThread");

    // 1. 创建并启动 RuntimeThread
    g_runtimeThread = std::make_unique<quickapp::RuntimeThread>();
    g_runtimeThread->start();

    // 2. 从 Android UI Thread 投递任务到 Runtime Thread
    g_runtimeThread->post([]() {
        LOGI("Task executed on Runtime Thread!");
    });

    // 3. 投递一个 JS 执行任务
    g_runtimeThread->post([&]() {
        auto* engine = g_runtimeThread->getEngine();
        if (engine) {
            engine->eval("nativeLog('JS running on Runtime Thread!')", "thread_test.js");
        }
    });

    // 4. 测试 Timer
    g_runtimeThread->postDelayed([]() {
        LOGI("Timer fired after 500ms on Runtime Thread!");
    }, 500);

    // 5. 2 秒后停止（模拟 Runtime 销毁）
    g_runtimeThread->postDelayed([&]() {
        LOGI("Stopping RuntimeThread...");
        g_runtimeThread->stop();
    }, 2000);
}
```

@update `QuickAppRuntime.kt` — 新增：

```kotlin
    private external fun nativeTestThread()
    fun testThread() { nativeTestThread() }
```

@update `MainActivity.kt` — 在 `it.testJS()` 之后新增：

```kotlin
                                it.testThread()
```

---

## Step 4.7：逐层验证

### 4.7.1：编译验证

```bash
./gradlew :app:assembleDebug
```

常见错误：
- `uv.h not found` → 检查 `target_include_directories` 包含 `${LIBUV_DIR}/include`
- `undefined reference to uv_loop_init` → 检查 `target_link_libraries` 包含 `uv_a`
- libuv CMake 报错 → 确认 libuv 目录下有完整的 `CMakeLists.txt`

### 4.7.2：Logcat 验证

```bash
adb logcat | grep -E "quickapp-thread|quickapp-loop|quickapp-js"
```

预期输出（按时间顺序）：

```text
I/quickapp-thread: Runtime thread started
I/quickapp-loop: EventLoop started
I/quickapp-js: QuickJS engine initialized
I/quickapp-thread: Runtime thread: EventLoop + JSEngine ready
I/quickapp-thread: Task executed on Runtime Thread!
I/quickapp-js: [JS] JS running on Runtime Thread!
I/quickapp-thread: Timer fired after 500ms on Runtime Thread!
I/quickapp-thread: Stopping RuntimeThread...
I/quickapp-loop: EventLoop stopped
I/quickapp-js: QuickJS engine destroyed
I/quickapp-thread: Runtime thread exited
```

---

## 技术决策

### 1. libuv 作为 EventLoop backend

跨平台、成熟、支持 async/timer/IO。Android/iOS/LVGL 都能用。比自己写 eventfd + epoll 可靠得多。

### 2. RuntimeThread 独占 QuickJS

QuickJS 不是线程安全的。所有 `JSRuntime`/`JSContext`/`JSValue` 操作必须在同一线程。RuntimeThread 保证了这一点。

### 3. post() 是唯一的跨线程入口

Android UI Thread、JNI 回调线程都不能直接调 QuickJS API。必须通过 `post()` 投递到 Runtime Thread。

### 4. 先不实现 UI Dispatcher

渲染指令从 Runtime Thread 发送到 Android UI Thread 的投递机制（Handler.post）留到 Step 12 完整渲染管线时实现。Step 4 只验证 Runtime Thread 自身的调度能力。

---

## QA

### 1. 为什么不直接用 Android Looper？

Android Looper 是平台专属的。iOS 是 CFRunLoop，LVGL 是自己的 timer backend。libuv 提供统一抽象，Core 不依赖具体平台。

### 2. uv_async_t 怎么实现跨线程唤醒？

底层用 eventfd（Linux/Android）或 pipe。`uv_async_send()` 写入一个字节唤醒阻塞在 `epoll_wait` 上的 loop 线程。

### 3. EventLoop 停止后 Timer 怎么处理？

`stop()` 设置 `stopped_ = true`，`uv_stop()` 让 `uv_run()` 返回。`threadMain` 退出前 `cleanupTimers()` 关闭所有 timer handle。

### 4. 为什么 JSEngine 在 threadMain 中创建而不是构造函数？

QuickJS 的 Runtime 和 Context 绑定到创建它们的线程。如果在主线程创建，后续在 Runtime Thread 中使用就违反了线程所有权。

---

## 下一步

Step 4 完成后得到：独立 Runtime Thread + EventLoop + QuickJS 线程隔离。下一步 Step 5 在这个线程模型上建立完整的 JS Bridge（$app_define$、$app_require$、System Module）。
