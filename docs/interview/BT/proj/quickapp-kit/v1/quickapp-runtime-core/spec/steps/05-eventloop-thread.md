# Step 5：EventLoop 与 RuntimeThread

## 目录

- [目标](#目标)
- [Step 5.1：设计 RuntimeEventLoop 抽象](#step-51设计-runtimeeventloop-抽象)
- [Step 5.2：实现 PosixEventLoop](#step-52实现-posixeventloop)
- [Step 5.3：实现 RuntimeThread](#step-53实现-runtimethread)
- [Step 5.4：接入 CMake](#step-54接入-cmake)
- [Step 5.5：编写测试](#step-55编写测试)
- [Step 5.6：逐层验证](#step-56逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**让 JS 引擎跑在独立线程上，并提供任务调度和 Timer 能力。**

| 层 | 职责 | 文件 |
|---|---|---|
| 调度抽象 | 定义 post / postDelayed / run / stop 接口 | `include/runtime_event_loop.h` |
| POSIX 实现 | mutex + condition_variable + min-heap timer | `platform/common/posix_event_loop.h/.cpp` |
| 线程管理 | 拥有线程 + EventLoop + JSEngine，管理生命周期 | `include/runtime_thread.h` + `src/runtime_thread.cpp` |

**验收标准：**
- 从主线程 `post()` 的任务在 Runtime Thread 执行
- `postDelayed()` 按指定延迟触发，多个 Timer 按到期时间排序
- `cancelTimer()` 能取消未触发的 Timer
- 每轮任务后自动调用 `executePendingJobs()`，Promise 回调能执行
- `stop()` 唤醒等待中的线程并干净退出，`join()` 不挂死
- ThreadSanitizer 无数据竞争报告

**本步不包含：**
- 文件 IO / Socket（PosixEventLoop 无 IO 能力，需要时替换为 libuv）
- 平台事件通道（Step 06 的 PlatformEventSink）
- Runtime 状态机完整实现（Step 10 的 RuntimeHost）

---

## Step 5.1：设计 RuntimeEventLoop 抽象

### 5.1.1：为什么需要 EventLoop

QuickJS 是同步执行的：`eval()` 进去，执行完出来。但快应用需要三类异步能力：

```text
1. Promise 微任务
   Promise.resolve().then(f) → f 需要在当前同步代码结束后执行

2. Timer
   setTimeout(f, 1000) → f 需要在 1 秒后执行

3. 跨线程事件
   用户点击（UI 线程）→ 需要在 Runtime Thread 调用 JS 回调
```

三类需求指向同一个基础设施：一个能接收任务、按时间排序、串行执行的循环。

### 5.1.2：接口设计

```text
post(task)                    立即执行队列
postDelayed(task, delayMs)    延迟队列，返回 TimerId
cancelTimer(id)               取消未触发的延迟任务
run()                         阻塞运行循环（在 Runtime Thread 调用）
stop()                        请求退出（可从任意线程调用）
isRunning()                   状态查询
setIdleCallback(cb)           每轮任务后的钩子（用于驱动 Promise）
```

`setIdleCallback` 是关键设计：EventLoop 不该知道 JSEngine 的存在，但需要在每轮任务后驱动微任务。用回调把这个依赖反转过来。

### 5.1.3：创建 runtime_event_loop.h

**@add `include/runtime_event_loop.h`（新建文件）**

```cpp
#ifndef QUICKAPP_RUNTIME_EVENT_LOOP_H
#define QUICKAPP_RUNTIME_EVENT_LOOP_H

#include <cstdint>
#include <functional>
#include <memory>

namespace quickapp {

// 投递到 EventLoop 的任务。
// 用 std::function 而不是裸函数指针，是为了支持 lambda 捕获上下文
// （如捕获 nodeId、回调参数等）。代价是每个任务一次小的堆分配。
using Task = std::function<void()>;

// Timer 标识，用于取消。
// 0 是保留值，表示"无效 Timer"，postDelayed 永远不会返回 0。
using TimerId = uint64_t;

constexpr TimerId kInvalidTimerId = 0;

// Runtime 的任务调度抽象。
//
// 职责：
//   接收任务、按时间排序、在单一线程上串行执行。
//   为 JS Promise、Timer、跨线程事件提供统一的执行入口。
//
// 线程约束：
//   run() 只能在拥有本 loop 的线程（Runtime Thread）调用一次。
//   post / postDelayed / cancelTimer / stop 可从任意线程调用（线程安全）。
//   任务本体始终在 run() 所在的线程执行。
//
// 生命周期：
//   构造 → [其他线程 post] → run()（阻塞）→ stop() → run() 返回 → 析构
//
// 与其他组件的关系：
//   RuntimeThread  拥有 EventLoop 实例，在自己的线程里调 run()
//   JSEngine       通过 idleCallback 被驱动（executePendingJobs）
//   PlatformEventSink  把平台事件 post 进来（Step 06）
class RuntimeEventLoop {
public:
    virtual ~RuntimeEventLoop() = default;

    /**
     * 投递一个立即执行的任务。
     *
     * @param task 要执行的任务。不能为空（空 std::function 会被忽略并记警告）。
     *             任务在 run() 所在线程执行，执行顺序与投递顺序一致（FIFO）。
     *
     * 线程安全：可从任意线程调用。
     * 停止后行为：loop 已 stop 时任务被丢弃，不会执行。
     */
    virtual void post(Task task) = 0;

    /**
     * 投递一个延迟执行的任务。
     *
     * @param task    要执行的任务，约束同 post()
     * @param delayMs 延迟毫秒数。0 表示尽快执行（等价于 post，但仍走 Timer 路径）。
     *                实际触发时间受 loop 繁忙程度影响，不保证精确，
     *                典型误差 < 5ms。
     * @return Timer 标识，可用于 cancelTimer()。
     *         loop 已停止时返回 kInvalidTimerId。
     *
     * 线程安全：可从任意线程调用。
     */
    virtual TimerId postDelayed(Task task, uint64_t delayMs) = 0;

    /**
     * 取消一个尚未触发的延迟任务。
     *
     * @param id postDelayed 返回的标识。
     *           传入无效 id、已触发的 id 或已取消的 id 都是安全的空操作。
     *
     * 线程安全：可从任意线程调用。
     * 竞态说明：如果任务已经开始执行，取消不会中断它。
     */
    virtual void cancelTimer(TimerId id) = 0;

    /**
     * 运行事件循环，阻塞直到 stop() 被调用。
     *
     * 单轮流程：
     *   1. 取出所有到期的任务（立即任务优先，然后是到期 Timer）
     *   2. 逐个执行
     *   3. 调用 idleCallback（驱动 JS 微任务）
     *   4. 若无任务，等待新任务或最近 Timer 到期
     *
     * 线程约束：只能调用一次，且必须在拥有本 loop 的线程调用。
     *          重复调用会立即返回并记录错误。
     */
    virtual void run() = 0;

    /**
     * 请求停止事件循环。
     *
     * 行为：
     *   - 唤醒正在等待的 run()
     *   - 丢弃队列中未执行的任务和 Timer
     *   - 正在执行的任务会跑完，不会被中断
     *   - 之后的 post/postDelayed 全部被丢弃
     *
     * 线程安全：可从任意线程调用，包括在任务内部调用。
     * 幂等：多次调用安全。
     */
    virtual void stop() = 0;

    /**
     * 查询循环是否处于运行状态。
     * @return true 表示 run() 正在执行且未收到 stop 请求
     */
    virtual bool isRunning() const = 0;

    /**
     * 设置每轮任务执行后的回调。
     *
     * 用途：驱动 JS 引擎的 Promise 微任务队列。
     *      EventLoop 不直接依赖 JSEngine，通过这个回调反转依赖。
     *
     * @param callback 每轮任务后被调用。传空 std::function 表示取消。
     *                 在 run() 所在线程调用，不需要考虑线程安全。
     *
     * 调用时机：必须在 run() 之前设置。运行中设置的行为未定义。
     */
    virtual void setIdleCallback(Task callback) = 0;
};

/**
 * 创建当前平台的默认 EventLoop 实现。
 * @return PosixEventLoop 实例，不会返回 nullptr
 */
std::unique_ptr<RuntimeEventLoop> createEventLoop();

} // namespace quickapp

#endif // QUICKAPP_RUNTIME_EVENT_LOOP_H
```

---

## Step 5.2：实现 PosixEventLoop

### 5.2.1：数据结构选择

```text
立即任务队列   std::deque<Task>        FIFO，O(1) 入队出队
延迟任务队列   std::priority_queue     min-heap，O(log n) 插入，O(1) 取最早
取消集合       std::unordered_set      O(1) 查询是否已取消
```

Timer 取消用"惰性删除"：不从 heap 里真的移除，而是记进取消集合，取出时跳过。原因是 `std::priority_queue` 不支持随机删除。

### 5.2.2：创建头文件

**@add `platform/common/posix_event_loop.h`（新建文件）**

```cpp
#ifndef QUICKAPP_POSIX_EVENT_LOOP_H
#define QUICKAPP_POSIX_EVENT_LOOP_H

#include <atomic>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <queue>
#include <unordered_set>
#include <vector>

#include "runtime_event_loop.h"

namespace quickapp {

// RuntimeEventLoop 的 POSIX 实现。
//
// 实现方式：
//   std::mutex + std::condition_variable + min-heap timer。
//   不依赖 libuv，也不依赖平台特有的 Looper/RunLoop。
//
// 能力边界：
//   ✓ 立即任务、延迟任务、跨线程投递、精确唤醒
//   ✗ 文件 IO、Socket、信号处理
//   需要 IO 能力时（如实现 fetch）应替换为 LibuvEventLoop，
//   RuntimeEventLoop 接口不变，替换范围仅限本文件。
//
// 线程所有权：
//   run() 归属单一线程。其他方法可从任意线程调用。
//   内部所有共享状态由 mutex_ 保护。
//
// 生命周期：
//   构造 → setIdleCallback → run()（阻塞）→ stop() → run() 返回 → 析构
//   析构时如果 run() 仍在执行，行为未定义（调用方必须先 stop + join）。
class PosixEventLoop final : public RuntimeEventLoop {
public:
    PosixEventLoop() = default;
    ~PosixEventLoop() override = default;

    // 禁止拷贝：持有 mutex 和线程状态，拷贝无意义且危险
    PosixEventLoop(const PosixEventLoop&) = delete;
    PosixEventLoop& operator=(const PosixEventLoop&) = delete;

    void post(Task task) override;
    TimerId postDelayed(Task task, uint64_t delayMs) override;
    void cancelTimer(TimerId id) override;
    void run() override;
    void stop() override;
    bool isRunning() const override;
    void setIdleCallback(Task callback) override;

private:
    // 延迟任务条目。
    struct TimerEntry {
        uint64_t dueTimeMs;   // 绝对到期时间（steady_clock 毫秒数）
        TimerId id;           // 用于取消
        Task task;            // 到期时执行的任务

        // priority_queue 默认是最大堆，用 > 让它变成最小堆
        // （到期时间最早的排在 top）。
        bool operator>(const TimerEntry& other) const {
            return dueTimeMs > other.dueTimeMs;
        }
    };

    /**
     * 取当前单调时钟的毫秒数。
     *
     * 用 steady_clock 而不是 system_clock：
     *   system_clock 会因用户改系统时间、NTP 校时而跳变，
     *   导致 Timer 提前触发或永远不触发。
     *   steady_clock 保证单调递增。
     *
     * @return 自某个未指定起点以来的毫秒数，仅用于计算时间差
     */
    static uint64_t nowMs();

    // 所有共享状态的锁。
    // mutable 是为了让 const 方法 isRunning() 也能加锁。
    mutable std::mutex mutex_;

    // 用于在有新任务或 Timer 到期时唤醒 run()
    std::condition_variable cv_;

    // 立即执行队列（FIFO）
    std::deque<Task> taskQueue_;

    // 延迟执行队列（min-heap，按 dueTimeMs 排序）
    std::priority_queue<TimerEntry, std::vector<TimerEntry>,
                        std::greater<TimerEntry>> timerQueue_;

    // 已取消的 Timer ID。
    // 惰性删除：priority_queue 不支持随机删除，
    // 所以取消时只记录 ID，从堆顶取出时检查并跳过。
    std::unordered_set<TimerId> cancelledTimers_;

    // 下一个分配的 Timer ID。从 1 开始，0 保留为 kInvalidTimerId。
    TimerId nextTimerId_ = 1;

    // 停止标志。
    // 用 atomic 而不是普通 bool + mutex：
    // stop() 可能在任务执行中被调用，此时 run() 持有锁，
    // atomic 让 stop() 不需要等锁就能置位。
    std::atomic<bool> stopped_{false};

    // run() 是否正在执行
    std::atomic<bool> running_{false};

    // 每轮任务后的回调（驱动 JS 微任务）。
    // 只在 run() 所在线程访问，不需要锁保护。
    Task idleCallback_;
};

} // namespace quickapp

#endif // QUICKAPP_POSIX_EVENT_LOOP_H
```


### 5.2.3：实现投递与取消

**@add `platform/common/posix_event_loop.cpp`（新建文件）**

```cpp
#include "posix_event_loop.h"

#include <chrono>

#include "qa_log.h"

namespace quickapp {

uint64_t PosixEventLoop::nowMs() {
    using namespace std::chrono;
    return static_cast<uint64_t>(
        duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count());
}

void PosixEventLoop::post(Task task) {
    // 空任务直接拒绝，避免后续执行时崩溃
    if (!task) {
        QA_LOGW("[EventLoop] post: empty task ignored");
        return;
    }

    {
        std::lock_guard<std::mutex> lock(mutex_);
        // 已停止时丢弃任务。
        // 在锁内检查是为了和 stop() 的状态变更串行化，
        // 避免"检查时未停止、入队时已停止"导致任务永远不被执行也不被清理。
        if (stopped_.load(std::memory_order_acquire)) {
            QA_LOGD("[EventLoop] post: loop stopped, task dropped");
            return;
        }
        taskQueue_.push_back(std::move(task));
    }
    // 在锁外唤醒。
    // 持锁通知会让被唤醒的线程立刻又阻塞在锁上（"伤害等待"），
    // 锁外通知性能更好。
    cv_.notify_one();
}

TimerId PosixEventLoop::postDelayed(Task task, uint64_t delayMs) {
    if (!task) {
        QA_LOGW("[EventLoop] postDelayed: empty task ignored");
        return kInvalidTimerId;
    }

    TimerId id;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (stopped_.load(std::memory_order_acquire)) {
            QA_LOGD("[EventLoop] postDelayed: loop stopped, task dropped");
            return kInvalidTimerId;
        }

        id = nextTimerId_++;
        timerQueue_.push(TimerEntry{
            nowMs() + delayMs,
            id,
            std::move(task),
        });
    }
    // 必须唤醒：新 Timer 可能比当前等待的超时时间更早到期，
    // 不唤醒的话 run() 会睡过头
    cv_.notify_one();
    return id;
}

void PosixEventLoop::cancelTimer(TimerId id) {
    if (id == kInvalidTimerId) {
        return;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    // 惰性删除：只记录 ID，实际跳过发生在 run() 取出时。
    // 不检查 id 是否真实存在——取消一个不存在的 Timer 是无害的空操作。
    cancelledTimers_.insert(id);
}

void PosixEventLoop::stop() {
    // 先置标志再通知，保证被唤醒的 run() 一定能看到停止状态
    stopped_.store(true, std::memory_order_release);

    {
        std::lock_guard<std::mutex> lock(mutex_);
        // 清空队列，释放任务持有的资源（lambda 捕获的对象）。
        // 不清空的话这些资源要等到 loop 析构才释放。
        taskQueue_.clear();
        while (!timerQueue_.empty()) {
            timerQueue_.pop();
        }
        cancelledTimers_.clear();
    }

    // notify_all 而不是 notify_one：
    // 虽然设计上只有一个线程在 run()，但用 all 更保险
    cv_.notify_all();
    QA_LOGI("[EventLoop] stop requested");
}

bool PosixEventLoop::isRunning() const {
    return running_.load(std::memory_order_acquire) &&
           !stopped_.load(std::memory_order_acquire);
}

void PosixEventLoop::setIdleCallback(Task callback) {
    // 不加锁：约定必须在 run() 之前调用，此时没有并发访问
    idleCallback_ = std::move(callback);
}
```


### 5.2.4：实现主循环

这是整个 EventLoop 最核心的部分。

```cpp
void PosixEventLoop::run() {
    // 防重复调用
    bool expected = false;
    if (!running_.compare_exchange_strong(expected, true)) {
        QA_LOGE("[EventLoop] run() called twice, ignoring");
        return;
    }

    QA_LOGI("[EventLoop] loop started");

    // 本轮要执行的任务，在锁外执行，所以先搬到局部变量
    std::vector<Task> batch;

    while (!stopped_.load(std::memory_order_acquire)) {
        batch.clear();

        {
            std::unique_lock<std::mutex> lock(mutex_);

            // ---- 阶段 1：收集立即任务 ----
            // 全部搬走而不是一次一个，减少加锁次数
            while (!taskQueue_.empty()) {
                batch.push_back(std::move(taskQueue_.front()));
                taskQueue_.pop_front();
            }

            // ---- 阶段 2：收集到期的 Timer ----
            const uint64_t now = nowMs();
            while (!timerQueue_.empty()) {
                const TimerEntry& top = timerQueue_.top();

                // 堆顶未到期 → 后面的都没到期（min-heap 性质），停止收集
                if (top.dueTimeMs > now) {
                    break;
                }

                // 已取消的 Timer：取出丢弃，同时清理取消集合避免无限增长
                auto cancelIt = cancelledTimers_.find(top.id);
                if (cancelIt != cancelledTimers_.end()) {
                    cancelledTimers_.erase(cancelIt);
                    timerQueue_.pop();
                    continue;
                }

                // const_cast 的原因：
                // priority_queue::top() 返回 const 引用（防止破坏堆序），
                // 但我们需要 move 走 task（Task 是 std::function，拷贝有开销）。
                // 这里 move 后立即 pop，不会影响堆序，所以是安全的。
                batch.push_back(std::move(const_cast<TimerEntry&>(top).task));
                timerQueue_.pop();
            }

            // ---- 阶段 3：无任务时等待 ----
            if (batch.empty()) {
                if (timerQueue_.empty()) {
                    // 没有任何任务和 Timer → 无限等待，直到 post 或 stop
                    cv_.wait(lock, [this] {
                        return stopped_.load(std::memory_order_acquire) ||
                               !taskQueue_.empty() ||
                               !timerQueue_.empty();
                    });
                } else {
                    // 有 Timer 但未到期 → 等到最近的 Timer 到期
                    const uint64_t waitMs = timerQueue_.top().dueTimeMs - now;
                    cv_.wait_for(lock, std::chrono::milliseconds(waitMs), [this] {
                        // 谓词只检查"是否有更早的事件发生"，
                        // Timer 到期由 wait_for 的超时处理
                        return stopped_.load(std::memory_order_acquire) ||
                               !taskQueue_.empty();
                    });
                }
                // 被唤醒后回到循环顶部重新收集，不在这里执行任务
                continue;
            }
        } // 释放锁

        // ---- 阶段 4：锁外执行任务 ----
        // 必须在锁外执行：任务内部可能调用 post()（如 JS 里 setTimeout 套 setTimeout），
        // 持锁执行会死锁。
        for (auto& task : batch) {
            // 每个任务前检查停止状态：
            // 一个任务可能调用 stop()，后续任务就不该再执行
            if (stopped_.load(std::memory_order_acquire)) {
                QA_LOGD("[EventLoop] stopped mid-batch, %zu tasks skipped",
                        batch.size());
                break;
            }
            task();
        }

        // ---- 阶段 5：驱动 JS 微任务 ----
        // 在所有宏任务执行完后调用一次，符合 JS 事件循环语义：
        // 一轮宏任务 → 清空微任务队列 → 下一轮
        if (idleCallback_ && !stopped_.load(std::memory_order_acquire)) {
            idleCallback_();
        }
    }

    running_.store(false, std::memory_order_release);
    QA_LOGI("[EventLoop] loop exited");
}

std::unique_ptr<RuntimeEventLoop> createEventLoop() {
    // 当前只有 POSIX 实现。
    // 将来需要 IO 能力时：
    //   #if defined(QUICKAPP_USE_LIBUV)
    //       return std::make_unique<LibuvEventLoop>();
    //   #endif
    return std::make_unique<PosixEventLoop>();
}

} // namespace quickapp
```

**循环结构总结：**

```text
while (未停止) {
    加锁
        收集立即任务
        收集到期 Timer
        若无任务 → 等待（无限 或 直到最近 Timer 到期）→ continue
    解锁

    执行任务（锁外，任务可以再 post）
    调用 idleCallback（驱动 Promise）
}
```

**两个关键正确性点：**

```text
1. 任务必须在锁外执行
   任务内部可能 post 新任务、可能调 stop()、可能执行 JS（JS 里可能 setTimeout）。
   持锁执行 → 死锁。

2. wait 必须用谓词版本
   cv_.wait(lock, predicate) 等价于 while (!predicate()) cv_.wait(lock);
   这是防"虚假唤醒"（spurious wakeup）的标准做法。
   POSIX 允许 condition_variable 在没有 notify 的情况下被唤醒。
```

---

## Step 5.3：实现 RuntimeThread

### 5.3.1：职责定位

```text
EventLoop  只管调度，不知道 JS 的存在
JSEngine   只管执行 JS，不知道线程的存在
RuntimeThread  把两者组装起来，管理线程生命周期
```

### 5.3.2：创建头文件

**@add `include/runtime_thread.h`（新建文件）**

```cpp
#ifndef QUICKAPP_RUNTIME_THREAD_H
#define QUICKAPP_RUNTIME_THREAD_H

#include <atomic>
#include <memory>
#include <thread>

#include "js_engine.h"
#include "runtime_event_loop.h"

namespace quickapp {

// Runtime 的线程所有者。
//
// 职责：
//   创建并拥有一个独立线程，在该线程上运行 EventLoop 和 JSEngine。
//   对外提供线程安全的任务投递入口，隐藏线程管理细节。
//
// 线程模型：
//   ┌─────────────────────────────────────────┐
//   │ 调用方线程（平台 UI 线程 / 主线程）        │
//   │   start() / post() / stop() / join()     │
//   └──────────────────┬──────────────────────┘
//                      │ 投递
//   ┌──────────────────┴──────────────────────┐
//   │ Runtime Thread（本类创建）                │
//   │   EventLoop.run()                        │
//   │   JSEngine（QuickJS）                    │
//   │   所有 Core 状态                          │
//   └─────────────────────────────────────────┘
//
// 生命周期：
//   构造 → start() → [post 任务...] → stop() → join() → 析构
//
//   start()  创建线程，线程内初始化 JSEngine 并进入 EventLoop.run()
//   stop()   请求 EventLoop 退出（非阻塞）
//   join()   等待线程退出并销毁 JSEngine（阻塞）
//   析构     自动 stop + join，防止调用方漏掉
//
// 重要约束：
//   JSEngine 在 Runtime Thread 内创建和销毁，不在调用方线程。
//   原因：QuickJS 的 JSRuntime 有线程亲和性，跨线程操作会损坏内部状态。
class RuntimeThread {
public:
    RuntimeThread() = default;

    // 析构时兜底清理，避免调用方忘记 stop/join 导致线程泄漏或崩溃
    ~RuntimeThread();

    RuntimeThread(const RuntimeThread&) = delete;
    RuntimeThread& operator=(const RuntimeThread&) = delete;

    /**
     * 启动 Runtime Thread。
     *
     * 行为：
     *   1. 创建 EventLoop
     *   2. 创建线程
     *   3. 线程内：创建并初始化 JSEngine → 设置 idleCallback → EventLoop.run()
     *   4. 等待线程完成初始化后返回（保证返回后 post() 一定有效）
     *
     * @return true  线程启动且 JSEngine 初始化成功
     *         false 已启动过，或 JSEngine 初始化失败
     *
     * 线程约束：只能调用一次，且应从创建本对象的线程调用。
     */
    bool start();

    /**
     * 请求停止 Runtime Thread。
     *
     * 非阻塞：只是通知 EventLoop 退出，不等待线程结束。
     * 需要等待时随后调用 join()。
     *
     * 线程安全：可从任意线程调用，包括在 Runtime Thread 的任务内部调用。
     * 幂等：多次调用安全。
     */
    void stop();

    /**
     * 等待 Runtime Thread 退出，并销毁 JSEngine。
     *
     * 阻塞直到线程结束。调用前应先 stop()，否则会永久阻塞
     * （因为 EventLoop.run() 不会自己退出）。
     *
     * 线程约束：不能在 Runtime Thread 内部调用（自己 join 自己 → 死锁）。
     * 幂等：多次调用安全，第二次是空操作。
     */
    void join();

    /**
     * 投递任务到 Runtime Thread 执行。
     *
     * @param task 要执行的任务。在 Runtime Thread 上执行，
     *             可以安全访问 JSEngine 和所有 Core 状态。
     *
     * 线程安全：可从任意线程调用。
     * 未启动/已停止时：任务被丢弃并记录日志。
     */
    void post(Task task);

    /**
     * 投递延迟任务，对应 JS 的 setTimeout。
     *
     * @param task    要执行的任务
     * @param delayMs 延迟毫秒数
     * @return Timer 标识，可用于 cancelTimer；未启动时返回 kInvalidTimerId
     *
     * 线程安全：可从任意线程调用。
     */
    TimerId postDelayed(Task task, uint64_t delayMs);

    /**
     * 取消延迟任务。
     * @param id postDelayed 返回的标识
     * 线程安全：可从任意线程调用。
     */
    void cancelTimer(TimerId id);

    /**
     * 获取 JSEngine 指针。
     *
     * 【线程约束】返回的指针只能在 Runtime Thread 上使用。
     * 正确用法：
     *   thread.post([&thread] {
     *       thread.engine()->eval("...");   // 在 Runtime Thread 内，安全
     *   });
     * 错误用法：
     *   thread.engine()->eval("...");       // 在调用方线程，会损坏 QuickJS 状态
     *
     * @return JSEngine 指针。未启动或已 join 后返回 nullptr。
     */
    JSEngine* engine() { return engine_.get(); }

    /**
     * 查询线程是否正在运行。
     * @return true 表示已 start 且未 stop
     */
    bool isRunning() const;

private:
    /**
     * 线程主函数。在新建的线程上执行。
     *
     * 流程：
     *   创建 JSEngine → initialize → 设置 idleCallback →
     *   通知 start() 初始化完成 → EventLoop.run()（阻塞）→ 返回
     */
    void threadMain();

    std::unique_ptr<RuntimeEventLoop> loop_;
    std::unique_ptr<JSEngine> engine_;
    std::thread thread_;

    // start() 用它等待线程完成初始化
    std::mutex startMutex_;
    std::condition_variable startCv_;
    bool initDone_ = false;
    bool initSuccess_ = false;

    std::atomic<bool> started_{false};
    std::atomic<bool> joined_{false};
};

} // namespace quickapp

#endif // QUICKAPP_RUNTIME_THREAD_H
```


### 5.3.3：实现

**@add `src/runtime_thread.cpp`（新建文件）**

```cpp
#include "runtime_thread.h"

#include "qa_log.h"

namespace quickapp {

RuntimeThread::~RuntimeThread() {
    // 兜底清理：调用方忘记 stop/join 时，析构时补上。
    // 不这么做的话 std::thread 析构时若仍 joinable 会直接 std::terminate。
    stop();
    join();
}

bool RuntimeThread::start() {
    bool expected = false;
    if (!started_.compare_exchange_strong(expected, true)) {
        QA_LOGE("[RuntimeThread] already started");
        return false;
    }

    loop_ = createEventLoop();

    // 启动线程。threadMain 内部会创建 JSEngine。
    thread_ = std::thread(&RuntimeThread::threadMain, this);

    // 等待线程完成初始化。
    // 这一步是必要的：如果 start() 直接返回，调用方可能立刻 post 任务，
    // 而此时 JSEngine 可能还没创建好，任务执行时 engine() 返回 nullptr。
    {
        std::unique_lock<std::mutex> lock(startMutex_);
        startCv_.wait(lock, [this] { return initDone_; });
    }

    if (!initSuccess_) {
        QA_LOGE("[RuntimeThread] JSEngine initialization failed, cleaning up");
        // 初始化失败时线程会自行退出（不进入 run()），这里回收它
        stop();
        join();
        started_.store(false);
        return false;
    }

    QA_LOGI("[RuntimeThread] started");
    return true;
}

void RuntimeThread::threadMain() {
    // ---- 在 Runtime Thread 内创建 JSEngine ----
    // 必须在这里创建，不能在 start() 里创建。
    // QuickJS 的 JSRuntime 记录了创建它的线程，跨线程使用会导致
    // GC 状态损坏（表现为随机崩溃，极难排查）。
    engine_ = createJSEngine();
    bool ok = engine_->initialize();

    if (ok) {
        // 设置 idleCallback：每轮宏任务后驱动 Promise 微任务。
        //
        // 捕获 this 是安全的：RuntimeThread 的生命周期严格长于线程
        // （析构函数会 stop + join）。
        loop_->setIdleCallback([this] {
            engine_->executePendingJobs();
        });
    } else {
        QA_LOGE("[RuntimeThread] engine init failed: %s",
                engine_->getLastError().c_str());
    }

    // 通知 start() 初始化结果
    {
        std::lock_guard<std::mutex> lock(startMutex_);
        initDone_ = true;
        initSuccess_ = ok;
    }
    startCv_.notify_one();

    if (!ok) {
        // 初始化失败，不进入循环，直接退出线程
        engine_.reset();
        return;
    }

    QA_LOGI("[RuntimeThread] entering event loop");

    // 阻塞运行，直到 stop() 被调用
    loop_->run();

    QA_LOGI("[RuntimeThread] event loop returned, destroying engine");

    // ---- 在 Runtime Thread 内销毁 JSEngine ----
    // 和创建同理：JS_FreeRuntime 必须在创建它的线程调用。
    engine_->destroy();
    engine_.reset();
}

void RuntimeThread::stop() {
    if (loop_) {
        loop_->stop();
    }
}

void RuntimeThread::join() {
    bool expected = false;
    if (!joined_.compare_exchange_strong(expected, true)) {
        return;   // 已 join 过
    }
    if (thread_.joinable()) {
        thread_.join();
        QA_LOGI("[RuntimeThread] joined");
    }
}

void RuntimeThread::post(Task task) {
    if (!loop_) {
        QA_LOGW("[RuntimeThread] post before start, task dropped");
        return;
    }
    loop_->post(std::move(task));
}

TimerId RuntimeThread::postDelayed(Task task, uint64_t delayMs) {
    if (!loop_) {
        QA_LOGW("[RuntimeThread] postDelayed before start, task dropped");
        return kInvalidTimerId;
    }
    return loop_->postDelayed(std::move(task), delayMs);
}

void RuntimeThread::cancelTimer(TimerId id) {
    if (loop_) {
        loop_->cancelTimer(id);
    }
}

bool RuntimeThread::isRunning() const {
    return loop_ != nullptr && loop_->isRunning();
}

} // namespace quickapp
```

**为什么 start() 要等待初始化完成：**

```text
不等待的时序问题：
    主线程            Runtime Thread
    start() 返回
    post(task)  →     （engine_ 还是 nullptr）
                      threadMain 开始执行
                      engine_ = createJSEngine()
                      loop_->run()
                      执行 task → engine() 返回的是 nullptr → 崩溃

等待后的时序：
    主线程            Runtime Thread
    start()
      等待 initDone_  threadMain: engine_ 创建并初始化
                      initDone_ = true, notify
      被唤醒
    start() 返回
    post(task)  →     执行 task → engine() 有效
```

---

## Step 5.4：接入 CMake

**@update `CMakeLists.txt` — 替换 `add_library(quickapp-core STATIC ...)` 块**

```cmake
add_library(quickapp-core STATIC
    src/core_version.cpp
    src/qa_log.cpp
    src/quickjs_engine.cpp
    src/runtime_thread.cpp                      # ← Step 05 新增
    platform/common/posix_event_loop.cpp        # ← Step 05 新增
)
```

`platform/common` 的 include 路径在 Step 02 已配置为 PRIVATE，`runtime_thread.cpp` 不需要 include `posix_event_loop.h`（它只用抽象接口 + `createEventLoop()`），所以不需要额外改动。

---

## Step 5.5：编写测试

**@add `tests/test_event_loop.cpp`（新建文件）**

```cpp
// EventLoop 与 RuntimeThread 测试。
//
// 验证点：
//   1. post 任务执行顺序（FIFO）
//   2. postDelayed 延迟触发 + 多 Timer 排序
//   3. cancelTimer 生效
//   4. 任务内部 post 新任务（不死锁）
//   5. stop 唤醒等待中的循环
//   6. RuntimeThread 跨线程投递
//   7. JSEngine 在 Runtime Thread 可用
//   8. Promise 微任务被 idleCallback 驱动
//   9. 析构自动清理

#include <atomic>
#include <chrono>
#include <cstdio>
#include <string>
#include <thread>
#include <vector>

#include "runtime_thread.h"

#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

namespace {

// 等待条件成立，最多等 timeoutMs。
// 用轮询而不是条件变量，是为了让测试代码简单。
template <typename Pred>
bool waitFor(Pred pred, int timeoutMs = 2000) {
    const auto deadline = std::chrono::steady_clock::now() +
                          std::chrono::milliseconds(timeoutMs);
    while (std::chrono::steady_clock::now() < deadline) {
        if (pred()) {
            return true;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }
    return false;
}

int testEventLoopBasics() {
    auto loop = quickapp::createEventLoop();

    std::vector<int> order;
    std::mutex orderMutex;
    auto record = [&](int v) {
        std::lock_guard<std::mutex> lk(orderMutex);
        order.push_back(v);
    };

    // FIFO 顺序
    loop->post([&] { record(1); });
    loop->post([&] { record(2); });
    loop->post([&] { record(3); });

    // 任务内部 post 新任务 —— 验证不死锁
    loop->post([&] {
        record(4);
        loop->post([&] { record(5); });
    });

    // 延迟任务：故意乱序投递，验证按到期时间排序
    loop->postDelayed([&] { record(30); }, 30);
    loop->postDelayed([&] { record(10); }, 10);
    loop->postDelayed([&] { record(20); }, 20);

    // 取消一个
    auto cancelMe = loop->postDelayed([&] { record(999); }, 15);
    loop->cancelTimer(cancelMe);

    // 最后一个 Timer 触发时停止循环
    loop->postDelayed([&] { loop->stop(); }, 60);

    loop->run();   // 阻塞直到 stop

    {
        std::lock_guard<std::mutex> lk(orderMutex);
        // 立即任务先执行，且保持 FIFO
        CHECK(order.size() >= 7, "expected at least 7 recorded values");
        CHECK(order[0] == 1 && order[1] == 2 && order[2] == 3 && order[3] == 4,
              "immediate tasks should run in FIFO order");
        CHECK(order[4] == 5, "task posted from within a task should run next round");

        // Timer 按到期时间排序
        CHECK(order[5] == 10, "timer 10ms should fire first");
        CHECK(order[6] == 20, "timer 20ms should fire second");
        CHECK(order[7] == 30, "timer 30ms should fire third");

        // 被取消的没有执行
        for (int v : order) {
            CHECK(v != 999, "cancelled timer should not fire");
        }
    }

    CHECK(!loop->isRunning(), "loop should not be running after stop");
    return 0;
}

int testStopWakesUpWaitingLoop() {
    auto loop = quickapp::createEventLoop();

    std::atomic<bool> loopExited{false};

    // 在另一个线程运行循环（此时队列为空，会进入无限等待）
    std::thread runner([&] {
        loop->run();
        loopExited = true;
    });

    // 确认循环真的在等待
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    CHECK(!loopExited.load(), "loop should still be waiting");

    // stop 必须能唤醒无限等待的 cv_.wait
    loop->stop();

    CHECK(waitFor([&] { return loopExited.load(); }),
          "stop() should wake up a waiting loop");

    runner.join();
    return 0;
}

int testRuntimeThread() {
    quickapp::RuntimeThread thread;
    CHECK(thread.start(), "RuntimeThread start failed");
    CHECK(thread.isRunning(), "thread should be running");

    // ---- 跨线程投递 ----
    std::atomic<int> counter{0};
    std::atomic<std::thread::id> taskThreadId{};
    const auto mainThreadId = std::this_thread::get_id();

    for (int i = 0; i < 5; ++i) {
        thread.post([&] {
            taskThreadId = std::this_thread::get_id();
            counter.fetch_add(1);
        });
    }

    CHECK(waitFor([&] { return counter.load() == 5; }),
          "all 5 posted tasks should execute");
    CHECK(taskThreadId.load() != mainThreadId,
          "tasks must run on Runtime Thread, not caller thread");

    // ---- JSEngine 在 Runtime Thread 可用 ----
    std::atomic<bool> evalDone{false};
    std::string evalResult;

    thread.post([&] {
        auto* engine = thread.engine();
        if (engine != nullptr) {
            engine->evalWithResult("2 * 21", "<test>", evalResult);
        }
        evalDone = true;
    });

    CHECK(waitFor([&] { return evalDone.load(); }), "eval task should complete");
    CHECK(evalResult == "42", "eval result should be 42");

    // ---- Promise 微任务被 idleCallback 驱动 ----
    std::atomic<bool> promiseDone{false};
    std::string promiseResult;

    thread.post([&] {
        auto* engine = thread.engine();
        engine->eval("var pr = 'pending';"
                     "Promise.resolve('resolved').then(v => { pr = v; });",
                     "<promise>");
        // 这个任务返回后，EventLoop 会调用 idleCallback → executePendingJobs
    });

    // 下一轮任务读取结果，此时微任务应该已经执行
    thread.post([&] {
        thread.engine()->evalWithResult("pr", "<test>", promiseResult);
        promiseDone = true;
    });

    CHECK(waitFor([&] { return promiseDone.load(); }), "promise check should run");
    CHECK(promiseResult == "resolved",
          "Promise.then should have been driven by idleCallback");

    // ---- setTimeout 语义（postDelayed） ----
    std::atomic<bool> timerFired{false};
    const auto beforeTimer = std::chrono::steady_clock::now();
    thread.postDelayed([&] { timerFired = true; }, 50);

    CHECK(waitFor([&] { return timerFired.load(); }), "delayed task should fire");
    const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - beforeTimer).count();
    CHECK(elapsed >= 45, "delayed task fired too early");

    // ---- 停止与回收 ----
    thread.stop();
    thread.join();
    CHECK(!thread.isRunning(), "thread should not be running after stop");
    CHECK(thread.engine() == nullptr, "engine should be destroyed after join");

    // 停止后投递被丢弃，不崩溃
    thread.post([&] { counter.fetch_add(100); });
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    CHECK(counter.load() == 5, "tasks posted after stop should be dropped");

    return 0;
}

int testDestructorCleansUp() {
    // 不显式 stop/join，靠析构兜底。
    // 如果析构函数没处理好，std::thread 析构时会 std::terminate。
    std::atomic<int> ran{0};
    {
        quickapp::RuntimeThread thread;
        CHECK(thread.start(), "start failed");
        thread.post([&] { ran.fetch_add(1); });
        CHECK(waitFor([&] { return ran.load() == 1; }), "task should run");
        // 作用域结束 → 析构 → stop + join
    }
    // 能走到这里说明析构正常，没有 terminate
    return 0;
}

} // namespace

int main() {
    if (testEventLoopBasics() != 0) return 1;
    if (testStopWakesUpWaitingLoop() != 0) return 1;
    if (testRuntimeThread() != 0) return 1;
    if (testDestructorCleansUp() != 0) return 1;

    std::printf("PASS: all EventLoop / RuntimeThread tests\n");
    return 0;
}
```

**@update `tests/CMakeLists.txt` — 在 `test_js_engine` 之后插入**

```cmake
# test_event_loop：任务调度与线程管理
add_executable(test_event_loop test_event_loop.cpp)
target_link_libraries(test_event_loop PRIVATE quickapp-core)
add_test(NAME test_event_loop COMMAND test_event_loop)
```

---

## Step 5.6：逐层验证

### 5.6.1：编译验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build -j4
```

预期：

```text
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/runtime_thread.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/platform/common/posix_event_loop.cpp.o
[100%] Linking CXX executable test_event_loop
```

**常见错误：**

```text
"posix_event_loop.h: No such file or directory"
    → Step 02 的 target_include_directories 缺 platform/common

"undefined reference to pthread_create"
    → find_package(Threads) + Threads::Threads 链接丢了

"error: passing 'const TimerEntry' as 'this' argument discards qualifiers"
    → 忘了 const_cast，priority_queue::top() 返回 const 引用

"terminate called without an active exception"
    → std::thread 析构时仍 joinable。检查 RuntimeThread 析构是否调了 join()
```

### 5.6.2：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
1/4 Test #1: test_version .....................   Passed
2/4 Test #2: test_log .........................   Passed
3/4 Test #3: test_js_engine ...................   Passed
4/4 Test #4: test_event_loop ..................   Passed    0.35 sec

100% tests passed, 0 tests failed out of 4
```

直接运行看执行轨迹：

```bash
./build/tests/test_event_loop
```

预期（节选）：

```text
[I/quickapp-core] [EventLoop] loop started
[I/quickapp-core] [EventLoop] stop requested
[I/quickapp-core] [EventLoop] loop exited
[I/quickapp-core] [JSEngine] initialized (QuickJS, memLimit=64MB, stackLimit=1MB)
[I/quickapp-core] [RuntimeThread] entering event loop
[I/quickapp-core] [RuntimeThread] started
[D/quickapp-core] [JSEngine] executed 1 pending jobs
[I/quickapp-core] [EventLoop] stop requested
[I/quickapp-core] [RuntimeThread] event loop returned, destroying engine
[D/quickapp-core] [JSEngine] destroyed
[I/quickapp-core] [RuntimeThread] joined
[D/quickapp-core] [EventLoop] post: loop stopped, task dropped
PASS: all EventLoop / RuntimeThread tests
```

最后一行 `task dropped` 证明停止后的投递被正确丢弃。

### 5.6.3：数据竞争验证（关键）

多线程代码必须用 ThreadSanitizer 验证：

```bash
cmake -B build-tsan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=thread -fno-omit-frame-pointer" \
  -DCMAKE_C_FLAGS="-fsanitize=thread -fno-omit-frame-pointer" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=thread"
cmake --build build-tsan -j4
./build-tsan/tests/test_event_loop
```

预期：`PASS`，无 TSan 报告。

如果出现：

```text
WARNING: ThreadSanitizer: data race (pid=12345)
  Write of size 8 at 0x... by thread T1:
    #0 quickapp::PosixEventLoop::post(...)
  Previous read of size 8 at 0x... by main thread:
    #0 quickapp::PosixEventLoop::run(...)
```

说明某个共享状态没被 mutex 保护。检查清单：

```text
taskQueue_ / timerQueue_ / cancelledTimers_ / nextTimerId_
    → 必须全部在 mutex_ 保护下访问

stopped_ / running_
    → atomic，不需要锁，但要用正确的 memory_order

idleCallback_
    → 只在 run() 线程访问，约定 run() 前设置
```

清理：

```bash
rm -rf build-tsan
```

### 5.6.4：死锁验证

用超时机制确认没有死锁：

```bash
cd build
timeout 30 ctest --output-on-failure
echo "exit code: $?"
```

预期 `exit code: 0`。如果是 `124`，说明超时——存在死锁。

最容易出现死锁的地方是"任务内部调用 post"：

```cpp
loop->post([&] {
    loop->post([&] { /* ... */ });   // 如果 run() 持锁执行任务 → 死锁
});
```

实现里通过"锁外执行任务"避免了这个问题（5.2.4 阶段 4）。测试的 `record(4) → post(record(5))` 就是在验证这一点。

### 5.6.5：Timer 精度验证

```bash
cat > /tmp/test_timer_precision.cpp << 'EOF'
#include <chrono>
#include <cstdio>
#include "runtime_event_loop.h"

int main() {
    auto loop = quickapp::createEventLoop();
    using clock = std::chrono::steady_clock;

    const int delays[] = {10, 50, 100, 200};
    long actual[4] = {0};
    const auto start = clock::now();

    for (int i = 0; i < 4; ++i) {
        loop->postDelayed([&, i] {
            actual[i] = std::chrono::duration_cast<std::chrono::milliseconds>(
                clock::now() - start).count();
        }, delays[i]);
    }
    loop->postDelayed([&] { loop->stop(); }, 300);
    loop->run();

    for (int i = 0; i < 4; ++i) {
        std::printf("expected %3dms, actual %3ldms, drift %+ldms\n",
                    delays[i], actual[i], actual[i] - delays[i]);
    }
    return 0;
}
EOF

c++ -std=c++17 -I include -I platform/common /tmp/test_timer_precision.cpp \
    build/libquickapp-core.a -o /tmp/test_timer && /tmp/test_timer
```

预期：

```text
expected  10ms, actual  10ms, drift +0ms
expected  50ms, actual  50ms, drift +0ms
expected 100ms, actual 101ms, drift +1ms
expected 200ms, actual 200ms, drift +0ms
```

误差应在 5ms 以内。误差大说明 `cv_.wait_for` 的超时计算有问题。

```bash
rm -f /tmp/test_timer_precision.cpp /tmp/test_timer
```

### 5.6.6：平台无关性回归

```bash
nm build/libquickapp-core.a | grep -E "__android_log_print|objc_msgSend|ALooper"
```

预期：无输出。特别注意 `ALooper` —— 如果误用了 Android 的 Looper API 会在这里暴露。

---

## 技术决策

### 1. 用 PosixEventLoop 替代 libuv

原计划用 libuv，实际实现用 `std::mutex + condition_variable + min-heap`。

**原因：** 当前网络环境无法访问 GitHub（`Failed to connect to github.com port 443`），无法获取 libuv 源码。

**能力对比：**

| 能力 | PosixEventLoop | libuv | 当前是否需要 |
|---|---|---|---|
| 任务队列 | ✓ | ✓ | 需要 |
| Timer | ✓ | ✓ | 需要（setTimeout） |
| 跨线程唤醒 | ✓ | ✓ (uv_async_t) | 需要 |
| 文件 IO | ✗ | ✓ | V1 不需要（RPK 由平台读） |
| Socket | ✗ | ✓ | V1 不需要（无 fetch） |
| 进程/信号 | ✗ | ✓ | 不需要 |

V1 的需求 PosixEventLoop 完全覆盖。等到实现 `fetch`、WebSocket 时再替换。

**替换成本：** 只需新增 `libuv_event_loop.cpp` 并改 `createEventLoop()` 一行。`RuntimeEventLoop` 接口不变，`RuntimeThread` 和所有业务代码零改动。这是抽象接口的价值。

### 2. Timer 用惰性删除而不是真删除

```cpp
void cancelTimer(TimerId id) {
    cancelledTimers_.insert(id);   // 只记录，不从堆里删
}
```

`std::priority_queue` 不支持随机删除。要真删除得换成 `std::multimap` 或手写 heap + 索引表。

惰性删除的代价是被取消的 Timer 仍占堆空间，直到到期时才清理。极端场景（创建 10 万个 Timer 全部取消）会有内存浪费。实际场景中 Timer 数量在几十个量级，可以接受。

清理时机在 `run()` 的阶段 2：取出已取消的 Timer 时同步从 `cancelledTimers_` 移除，避免集合无限增长。

### 3. 任务必须在锁外执行

这是 EventLoop 实现里最容易出错的点：

```cpp
// 错误：持锁执行
{
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& t : batch) t();   // 任务内 post → 死锁
}

// 正确：搬出来再执行
std::vector<Task> batch;
{
    std::lock_guard<std::mutex> lock(mutex_);
    // 搬走任务
}
for (auto& t : batch) t();   // 锁外执行
```

必须锁外执行的三个理由：

```text
1. 任务可能 post 新任务（JS 里 setTimeout 套 setTimeout）
2. 任务可能调 stop()（JS 主动退出）
3. 任务执行 JS 可能耗时较长，持锁会阻塞其他线程的 post
```

### 4. stopped_ 和 running_ 用 atomic

```cpp
std::atomic<bool> stopped_{false};
```

不用 `bool + mutex` 的原因：`stop()` 可能在任务执行期间被调用（从任务内部或另一个线程）。如果 `stopped_` 需要加锁访问，而 `run()` 在执行任务时不持锁但要检查它，就会出现读到过期值的问题。

atomic 让检查和设置都不需要锁，且 `memory_order_acquire/release` 保证可见性。

### 5. JSEngine 在线程内创建和销毁

```cpp
void RuntimeThread::threadMain() {
    engine_ = createJSEngine();       // 在 Runtime Thread
    engine_->initialize();
    loop_->run();
    engine_->destroy();               // 也在 Runtime Thread
}
```

QuickJS 的 `JSRuntime` 有线程亲和性。跨线程操作的表现：

```text
- 不会立即崩溃（没有断言检查）
- GC 时访问其他线程的栈 → 随机段错误
- 引用计数竞争 → 对象提前释放或泄漏
- 症状：偶发崩溃，堆栈指向 QuickJS 内部，极难定位
```

所以必须严格保证创建、使用、销毁都在同一线程。`RuntimeThread` 的 `engine()` 注释里明确写了这个约束。

### 6. start() 同步等待初始化完成

`start()` 返回后调用方立刻 `post()` 是很自然的用法。如果不等待初始化，任务执行时 `engine()` 可能还是 nullptr。

用 `mutex + condition_variable + initDone_` 标志实现同步等待。代价是 `start()` 会阻塞几毫秒（QuickJS 初始化时间），换来的是调用方不需要关心时序。

### 7. idleCallback 反转依赖

```text
不这样：EventLoop 直接调用 JSEngine
    posix_event_loop.cpp 需要 #include "js_engine.h"
    → EventLoop 和 JS 引擎耦合
    → 无法在没有 JS 的场景复用 EventLoop

而是：EventLoop 提供回调钩子
    RuntimeThread 设置 loop_->setIdleCallback([this]{ engine_->executePendingJobs(); })
    → EventLoop 不知道 JS 的存在
    → 依赖方向：RuntimeThread → EventLoop，RuntimeThread → JSEngine
```

这也符合 JS 事件循环的语义：一轮宏任务执行完，清空微任务队列，进入下一轮。

### 8. 用 steady_clock 而不是 system_clock

```cpp
steady_clock::now()   // 单调递增，不受系统时间调整影响
system_clock::now()   // 墙上时钟，会因 NTP 校时、用户改时间而跳变
```

用 `system_clock` 的后果：用户把系统时间往前调 1 小时，所有 Timer 的 `dueTimeMs` 都变成"1 小时后"，setTimeout(f, 100) 要等一小时。往后调则所有 Timer 立即触发。

Timer 计算的是时间间隔，必须用单调时钟。

---

## QA

### 1. 为什么不直接用 Android 的 Looper

```text
Looper 是 Android 特有 API（android/looper.h）
    → Core 一旦依赖它，iOS 和 LVGL 就无法编译
    → 违反 Core 平台无关的核心约束
```

而且 Android 的 Looper 是给 UI 线程用的，Runtime Thread 需要的是一个纯粹的任务队列。用 `std::thread + condition_variable` 三端通用。

平台的 UI 线程调度是另一个问题：`PlatformBridge` 的实现（平台侧）负责把渲染命令投递到各自的 UI 线程，Core 不参与。

### 2. `cv_.wait` 为什么必须传谓词

```cpp
// 危险写法
cv_.wait(lock);

// 正确写法
cv_.wait(lock, [this] { return stopped_ || !taskQueue_.empty(); });
```

两个原因：

```text
1. 虚假唤醒（spurious wakeup）
   POSIX 允许 pthread_cond_wait 在没有 signal 的情况下返回。
   不检查条件就继续执行，会处理不存在的任务。

2. 唤醒丢失
   如果 post() 在 wait() 之前完成 notify，那次 notify 就丢了。
   带谓词的 wait 会先检查条件，条件已满足时根本不进入等待。
```

带谓词的版本等价于 `while (!pred()) cv_.wait(lock);`，两个问题都解决。

### 3. `const_cast<TimerEntry&>(top).task` 安全吗

安全，但需要说明：

```cpp
const TimerEntry& top = timerQueue_.top();   // const 引用
batch.push_back(std::move(const_cast<TimerEntry&>(top).task));
timerQueue_.pop();                            // 立即弹出
```

`priority_queue::top()` 返回 const 引用是为了防止修改排序键（`dueTimeMs`）破坏堆序。我们修改的是 `task` 字段，不影响排序，且 move 后立即 `pop()`，那个元素马上就不存在了。

替代方案是拷贝 `Task`（`std::function` 拷贝会复制捕获的对象，有堆分配开销）。move 更高效。

### 4. 一个任务抛异常会怎样

会导致 `run()` 抛出异常并终止循环，整个 Runtime Thread 退出。

V1 没有加 try-catch，原因是：

```text
Core 内部的任务不应该抛异常（用返回值传递错误）
JS 异常已经在 JSEngine 层被 QuickJS 捕获，不会变成 C++ 异常
```

如果将来要加健壮性保护，在阶段 4 包一层：

```cpp
for (auto& task : batch) {
    try {
        task();
    } catch (const std::exception& e) {
        QA_LOGE("[EventLoop] task threw: %s", e.what());
    } catch (...) {
        QA_LOGE("[EventLoop] task threw unknown exception");
    }
}
```

代价是 try-catch 会阻止编译器的一些优化，且掩盖了本该修复的 bug。

### 5. 在 Runtime Thread 内部调 join() 会怎样

死锁。线程 join 自己会永久阻塞。

`RuntimeThread::join()` 的注释里写明了这个约束。正确的做法是从任务内部只调 `stop()`：

```cpp
thread.post([&] {
    // 需要退出时
    thread.stop();        // ✓ 安全，只是设置标志
    // thread.join();     // ✗ 死锁
});
```

`join()` 由创建 `RuntimeThread` 的线程调用，或由析构函数自动调用。

### 6. postDelayed(task, 0) 和 post(task) 有区别吗

有细微区别：

```text
post(task)
    进 taskQueue_，本轮循环的阶段 1 就会被收集执行

postDelayed(task, 0)
    进 timerQueue_，dueTimeMs = now
    阶段 2 收集时 top.dueTimeMs > now 为 false，所以也会本轮执行
```

结果基本相同，但 `postDelayed(0)` 多了一次 heap 插入（O(log n)）和 TimerId 分配。需要立即执行时用 `post()`。

`postDelayed(0)` 的用途是"可取消的立即任务"——因为它返回 TimerId。

### 7. stop() 之后能重新 start() 吗

不能。`RuntimeThread` 是一次性的：

```cpp
std::atomic<bool> started_{false};
bool start() {
    bool expected = false;
    if (!started_.compare_exchange_strong(expected, true)) {
        return false;   // 已启动过，拒绝
    }
    // ...
}
```

需要重启时创建新的 `RuntimeThread` 对象。

这个设计简化了状态管理：不需要处理"停止中又收到 start"、"JSEngine 已销毁但线程对象复用"等复杂场景。快应用的生命周期本身也是一次性的（应用退出后重新打开是新的 Runtime）。

### 8. EventLoop 的性能够用吗

估算：

```text
单次 post 开销
    mutex lock/unlock       ~20ns（无竞争时）
    std::function 构造       ~50ns（有堆分配时）
    deque push_back         ~10ns
    cv notify               ~50ns
    合计                    ~130ns

单轮循环开销
    收集任务（批量搬移）      ~100ns
    执行任务                取决于任务本身
    executePendingJobs      ~200ns（队列空时）
```

首屏渲染场景约有几百次 post（每个 VNode 的渲染命令），总开销 < 0.1ms，相比 JS 执行（几十毫秒）和 UI 创建（几百毫秒）可以忽略。

高频场景（滚动、动画）如果出现瓶颈，优化方向是批量投递（一次 post 携带多个命令）而不是换 EventLoop 实现。

### 9. Step 05 完成后得到了什么

Runtime 有了完整的执行环境：

```text
✓ include/runtime_event_loop.h        7 个方法的调度抽象
✓ platform/common/posix_event_loop.*  约 200 行完整实现
✓ include/runtime_thread.h + src/runtime_thread.cpp  线程所有权管理
✓ Promise 微任务自动驱动（idleCallback）
✓ Timer 支持（setTimeout 的基础）
✓ 跨线程投递（平台事件的基础）
✓ tests/test_event_loop.cpp  4 组测试全部通过
✓ TSan 验证无数据竞争
✓ Timer 精度误差 < 5ms
```

到这里 Core 已经能"跑起来"了：一个独立线程，里面有 JS 引擎，能接收任务、能定时、能驱动 Promise。

Step 06 加上和平台通信的能力（PlatformBridge + PlatformEventSink），Step 07 给 JS 注入快应用 API。

---

## 下一步

按 `tasks.md` 进入 Step 06：实现 `PlatformBridge`（C++ → 平台渲染命令）和 `PlatformEventSink`（平台 → C++ 事件），建立双向通信通道。
