# iOS 线程与并发（GCD）

> 本质：iOS 用 **GCD（Grand Central Dispatch）** 做并发——你提交任务到队列，系统决定用哪个线程执行。
> 类比：Android 的 `Handler + Looper + HandlerThread`，或前端的 `Web Worker + postMessage`。
> 结论：不直接操作线程（Thread），而是操作**队列（Queue）**。队列分串行/并行，任务分同步/异步。

---

## 目录

- [一句话本质](#一句话本质)
- [核心概念对照](#核心概念对照)
- [GCD 的四个核心概念](#gcd-的四个核心概念)
- [队列类型](#队列类型)
- [同步 vs 异步](#同步-vs-异步)
- [实际场景](#实际场景)
- [Main Queue（主队列）](#main-queue主队列)
- [Swift Concurrency（async/await）](#swift-concurrencyasyncawait)
- [在 RN/跨端中的体现](#在-rn跨端中的体现)
- [Q&A](#qa)

---

## 一句话本质

```
iOS (GCD)：把任务丢到队列里，系统从线程池取线程执行。你不管线程，只管队列。
Android：Handler.post(runnable) 到 Looper 线程 / Executor.execute(runnable) 到线程池
前端：queueMicrotask() / setTimeout() / Web Worker.postMessage()
C++：std::async / thread pool / submit task to queue
```

**GCD = Grand Central Dispatch**。Apple 的并发框架，底层维护线程池，你只需要"把任务提交到队列"。

---

## 核心概念对照

| 概念 | iOS (GCD) | Android | 前端 | C++ |
|------|-----------|---------|------|-----|
| 主线程 | Main Queue | Main Thread (Handler) | UI 线程（唯一） | — |
| 后台线程 | Global Queue | HandlerThread / Executor | Web Worker | std::thread |
| 任务提交 | `DispatchQueue.async {}` | `handler.post { }` | `setTimeout()` | `pool.submit()` |
| 串行队列 | Serial Queue | 单线程 Handler | — | 单线程 executor |
| 并行队列 | Concurrent Queue | ThreadPoolExecutor | 多个 Worker | thread pool |
| 线程切回主线程 | `DispatchQueue.main.async {}` | `runOnUiThread {}` | — | — |

---

## GCD 的四个核心概念

```
1. Queue（队列）：任务排队的容器
2. Task（任务）：一个闭包/代码块
3. sync / async：同步提交 / 异步提交
4. serial / concurrent：队列是串行的还是并行的

组合：queue类型 × 提交方式 = 4 种行为
```

---

## 队列类型

### Serial Queue（串行队列）

```swift
// 任务一个接一个执行，不会并发
let serialQueue = DispatchQueue(label: "com.app.serial")
// 类比 Android：单线程的 HandlerThread — 任务排队，一个做完再做下一个

serialQueue.async { print("1") }
serialQueue.async { print("2") }
serialQueue.async { print("3") }
// 输出一定是：1, 2, 3（保证顺序）
```

### Concurrent Queue（并行队列）

```swift
// 多个任务可以同时执行
let concurrentQueue = DispatchQueue(label: "com.app.concurrent", attributes: .concurrent)
// 类比 Android：ThreadPoolExecutor — 多个线程同时执行任务

concurrentQueue.async { print("1") }
concurrentQueue.async { print("2") }
concurrentQueue.async { print("3") }
// 输出顺序不确定（并发执行）
```

### 系统预置队列

```swift
// Main Queue：主队列（串行），所有 UI 操作必须在这里
DispatchQueue.main.async {
    // 更新 UI（类比 Android runOnUiThread / 前端的 DOM 操作必须在主线程）
    label.text = "Done"
}

// Global Queue：系统全局并发队列（按优先级分）
DispatchQueue.global(qos: .userInitiated).async {
    // 后台任务（类比 Android Executors.newCachedThreadPool()）
    let data = loadFromNetwork()
}
```

### QoS（Quality of Service）— 优先级

```swift
// 类比 Android 的线程优先级 THREAD_PRIORITY_*
.userInteractive   // 最高：动画、触摸响应（类比 Android THREAD_PRIORITY_DISPLAY）
.userInitiated     // 高：用户触发的操作（加载数据）
.default           // 默认
.utility           // 中：长时间任务（下载、计算）
.background        // 最低：用户不可见（预加载、备份）
```

---

## 同步 vs 异步

```swift
// async：异步提交 — 不等任务完成，立即返回（最常用）
queue.async {
    // 这段代码在 queue 的线程上执行
    // 调用方不阻塞
}

// sync：同步提交 — 等任务完成才返回（阻塞当前线程）
queue.sync {
    // 这段代码在 queue 的线程上执行
    // 调用方阻塞直到这里执行完
}
```

**⚠️ 死锁陷阱**：

```swift
// ❌ 死锁！在 Main Queue 上同步提交到 Main Queue
DispatchQueue.main.sync {
    // 永远执行不到这里 → App 卡死
}
// 原因：main queue 是串行的，当前任务在等自己完成 → 死锁
// 类比 Android：在主线程调 handler.postAndWait → 同样死锁
```

---

## 实际场景

### 后台加载 → 回主线程更新 UI

```swift
// 类比 Android：子线程加载数据 → runOnUiThread 更新 UI
DispatchQueue.global(qos: .userInitiated).async {
    let data = self.fetchFromNetwork()  // 后台线程执行
    
    DispatchQueue.main.async {
        self.tableView.reloadData()     // 必须回主线程更新 UI
    }
}
```

### 串行队列保护共享资源

```swift
// 类比 Android 的 synchronized / C++ 的 mutex
// 但用串行队列更优雅：任务排队执行 → 天然互斥
let dbQueue = DispatchQueue(label: "com.app.db")

func write(data: Data) {
    dbQueue.async { database.write(data) }
}
func read() -> Data {
    return dbQueue.sync { database.read() }  // sync 等结果
}
```

### DispatchGroup — 等多个异步任务全部完成

```swift
// 类比 JS：Promise.all([task1, task2, task3])
// 类比 Android：CountDownLatch
let group = DispatchGroup()

group.enter()
loadImageA { group.leave() }

group.enter()
loadImageB { group.leave() }

group.notify(queue: .main) {
    // 所有任务完成后执行（类比 Promise.all().then()）
    print("All done")
}
```

---

## Main Queue（主队列）

**和 Android/前端的对应**：

| | iOS | Android | 前端 |
|---|-----|---------|------|
| 主线程 | Main Thread | Main Thread | UI Thread（唯一） |
| 主队列 | `DispatchQueue.main` | Main Looper | 事件循环 |
| UI 更新 | 必须在 Main Queue | 必须在 Main Thread | 必须在主线程 |
| 阻塞后果 | UI 卡顿 → watchdog kill | ANR（5s） | 页面冻结 |

**iOS 的 RunLoop**（类比 Android 的 Looper）：

```
Main Thread 的 RunLoop 不断循环：
  1. 处理触摸事件
  2. 处理 Timer
  3. 处理 GCD 提交到 main queue 的任务
  4. UI 渲染（CADisplayLink 回调）
  5. drain autorelease pool
  → 回到 1

类比 Android Main Looper：
  loop() → 不断从 MessageQueue 取 Message → 执行 Handler.handleMessage()
```

---

## Swift Concurrency（async/await）

Swift 5.5+ 引入了 async/await（类比 JS 的 async/await，类比 Kotlin 协程）：

```swift
// 旧写法（回调地狱）
func loadData(completion: @escaping (Data) -> Void) {
    URLSession.shared.dataTask(with: url) { data, _, _ in
        completion(data!)
    }.resume()
}

// 新写法（async/await，和 JS 一样）
func loadData() async -> Data {
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}

// 使用
Task {
    let data = await loadData()       // 等待，但不阻塞线程
    await MainActor.run {             // 切回主线程（类似 runOnUiThread）
        self.label.text = String(data: data, encoding: .utf8)
    }
}
```

| 概念 | Swift | Kotlin | JS |
|------|-------|--------|-----|
| async 函数 | `async` | `suspend` | `async` |
| 等待 | `await` | 直接调用 suspend 函数 | `await` |
| 切主线程 | `MainActor.run {}` | `withContext(Dispatchers.Main)` | 不需要（单线程） |
| 结构化并发 | `TaskGroup` | `coroutineScope` | `Promise.all` |

---

## 在 RN/跨端中的体现

| 场景 | GCD 在 RN iOS 侧的使用 |
|------|------------------------|
| RCTBridge 初始化 | 在后台 queue 加载 Bundle → 完成后回 main queue 渲染 |
| TurboModule 异步方法 | Native 实现里 dispatch 到后台 queue 执行 → resolve 回 JS |
| Native 事件推送 | Native 层事件发生 → dispatch 到 RN 的 JS queue 传递 |
| UI 更新 | 所有 `setNativeProps` 最终必须在 Main Queue 执行 |

**RN 在 iOS 侧的线程模型**：

```
Main Queue（主线程）：UI 渲染、触摸事件、Native UI 操作
JS Queue（后台串行队列）：Hermes 执行 JS 代码（类似 Android 的 mqt_js 线程）
Shadow Queue（后台串行队列）：Yoga 布局计算（新架构下合并到 JS Queue）
Native Modules Queue：TurboModule 异步方法执行
```

---

## Q&A

### GCD 和 NSOperationQueue 的区别？

| | GCD | NSOperationQueue |
|---|-----|------------------|
| 层级 | C 层 API（底层） | ObjC 封装（更高级） |
| 能力 | 简单：提交任务到队列 | 丰富：取消、依赖、优先级、并发数控制 |
| 选择 | 简单并发用 GCD | 复杂任务编排用 NSOperationQueue |

类比 Android：GCD ≈ Executor.execute()，NSOperationQueue ≈ WorkManager（可取消/可依赖链）。

### 为什么不直接用 Thread？

和 Android 一样的道理——直接创建线程开销大（~1MB 栈空间 + 内核资源），且手动管理生命周期容易出错。GCD 底层维护线程池，复用线程，系统根据 CPU 核数智能调度。

### iOS 怎么做线程安全？

| 方式 | 说明 | 类比 |
|------|------|------|
| Serial Queue | 任务排队执行 → 天然互斥 | 最推荐 |
| `os_unfair_lock` | 自旋锁（极轻量） | C++ `std::atomic_flag` |
| `NSLock` | 互斥锁 | C++ `std::mutex` |
| `DispatchSemaphore` | 信号量 | C++ `std::counting_semaphore` |
| `@MainActor` | 保证在主线程执行（Swift 5.5+） | 编译器检查 |

最佳实践：能用串行队列就用串行队列（Apple 推荐），不要动不动加锁。
