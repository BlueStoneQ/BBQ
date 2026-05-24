# 02. 进程、线程与通信

> Android 进程模型、线程方案、IPC/线程间通信。

## 目录

- [一、进程模型](#一进程模型)
- [二、线程方案](#二线程方案)
- [三、线程间通信](#三线程间通信)
- [四、进程间通信（IPC）](#四进程间通信ipc)
- [五、快应用框架的线程设计](#五快应用框架的线程设计)

---

## 一、进程模型

### 线程的本质

**线程 = CPU 执行的最小调度单位。**

```
进程 = 资源分配的单位（内存空间/文件句柄/网络连接）
线程 = CPU 执行的单位（一条独立的指令执行流）

一个进程里可以有多个线程，它们：
- 共享：同一块内存空间、文件句柄、全局变量
- 独立：各自有自己的调用栈（Stack）、程序计数器（PC）、寄存器
```

**为什么需要多线程？**
- 单线程做 IO 等待时 CPU 空闲（浪费）
- 单线程做重计算时 UI 卡死（阻塞）
- 多线程：一个线程等 IO，另一个继续算；一个画 UI，另一个跑 JS

### 多线程调度

```
CPU 核心数有限（如 8 核），线程可能有几十上百个。
操作系统调度器决定：哪个线程在哪个核上跑多久。

核心机制：时间片轮转（Time Slicing）
  → 每个线程分配一小段 CPU 时间（几 ms）
  → 时间到了 → 保存当前线程状态（寄存器/PC/栈指针）→ 切换到下一个线程
  → 切换非常快（μs 级）→ 人感觉"同时在跑"
```

**并行 vs 并发**：

```
8 核 CPU + 20 个线程：
  → 任意时刻最多 8 个线程真正并行执行（每个核跑一个）
  → 剩下 12 个在等待，靠时间片轮转"排队"上 CPU

并行（Parallelism）= 核数内，真正同时执行（物理层面）
并发（Concurrency）= 超出核数，时间片切换模拟"同时"（逻辑层面）
```

**RN 的 3 个核心线程（JS/UI/Background）在 8 核手机上是真正并行的**——这就是为什么 JS Thread 卡了不影响 UI Thread 画界面。

**上下文切换（Context Switch）的代价**：

```
线程 A → 线程 B 切换时：
  保存 A 的上下文（寄存器/栈指针/PC）→ 恢复 B 的上下文 → CPU 缓存失效
  → 线程太多 → 切换太频繁 → 开销大于收益 → 反而慢
```

**线程 vs 任务**：
- 线程 = 持续存在的执行环境（"工人"，一直在）
- 任务 = 一段要执行的代码（"工单"，不断来）
- 例：UI Thread 通过 Looper 不断从 MessageQueue 取任务执行

### 一个 App = 一个进程（默认）

每个 App 运行在独立的 Linux 进程中，有自己的：
- 虚拟地址空间（进程隔离）
- ART 虚拟机实例
- 文件描述符表
- UID（用户 ID，用于权限隔离）

### 多进程

App 可以声明多个进程（在 AndroidManifest 里给组件加 `android:process`）：

```xml
<service android:name=".PushService" android:process=":push" />
```

场景：
- 推送服务独立进程（主进程被杀不影响推送）
- WebView 独立进程（WebView crash 不影响主 App）
- 大内存操作独立进程（避免主进程 OOM）

### 进程优先级与回收

```
前台进程 > 可见进程 > 服务进程 > 缓存进程 > 空进程
```

系统内存不足时从低优先级开始杀。快应用框架作为系统预装应用，优先级通常较高。

---

## 二、线程方案

| 方案 | 说明 | 适用场景 |
|------|------|---------|
| **Thread** | 最基础的线程 | 简单异步任务 |
| **HandlerThread** | 带 Looper 的线程（可以接收消息） | 需要持续处理消息的后台线程 |
| **ThreadPoolExecutor** | 线程池 | 大量并发任务 |
| **AsyncTask**（已废弃） | 封装的异步任务 | 不要用了 |
| **Coroutine**（Kotlin） | 协程，轻量级线程 | 现代 Android 开发首选 |
| **RxJava** | 响应式编程 | 复杂异步流 |
| **WorkManager** | 系统调度的后台任务 | 需要保证执行的后台任务 |

### Kotlin Coroutine vs JS async/await

| | Kotlin Coroutine | JS async/await |
|---|---|---|
| 本质 | 编译器转换为状态机 | Generator + Promise |
| 线程 | 可以切换线程（Dispatchers） | 单线程（Event Loop） |
| 取消 | 支持结构化取消（Job.cancel） | AbortController |
| 作用域 | CoroutineScope 管理生命周期 | 无（需要手动管理） |

```kotlin
// Kotlin
lifecycleScope.launch(Dispatchers.IO) {
    val data = fetchData()          // IO 线程执行
    withContext(Dispatchers.Main) {
        updateUI(data)              // 切回主线程更新 UI
    }
}
```

```javascript
// JS（类比）
async function load() {
    const data = await fetchData(); // 异步等待
    updateUI(data);                 // 同一线程（Event Loop）
}
```

---

## 三、线程间通信

### 通信方案一览

**本质问题**：线程共享内存，但各自独立执行。怎么让线程 A 的数据/信号传给线程 B？

| 方案 | 本质 | 适用场景 | 类比前端 |
|------|------|---------|---------|
| **共享内存** | 两个线程直接读写同一块内存 | 高频/大数据量 | 无（JS 单线程没这个） |
| **消息队列** | A 往队列放消息，B 从队列取 | 异步通知/解耦 | Event Loop / postMessage |
| **回调/Promise** | A 执行完调 B 的回调函数 | 异步结果返回 | Promise / callback |
| **管道/Channel** | 一端写一端读的数据流 | 流式数据传输 | ReadableStream |
| **信号量/事件** | 一个线程通知另一个"可以继续了" | 同步等待/协调 | await |

### Android 里的具体实现

| 方案 | Android 实现 | 场景 |
|------|-------------|------|
| 消息队列 | **Handler + Looper + MessageQueue** | UI Thread 接收任务（最常用） |
| 共享内存 | 直接读写对象字段（需要加锁） | 高频数据共享 |
| 回调 | Callback / Listener / Coroutine | 异步操作结果返回 |
| 线程安全容器 | ConcurrentHashMap / BlockingQueue | 生产者-消费者模式 |

### 线程安全问题：锁与原子操作

#### 为什么需要？

**数据竞争（Race Condition）**：同一段代码被不同线程同时调用，操作同一块共享数据 → 结果不确定。

```kotlin
// 什么情况下一段代码会被两个线程执行？
// → 当同一个函数被不同线程调用时：

fun addDevice(device: Device) {
    devices.add(device)  // 这行代码可能被两个线程同时执行
}

// 线程 A（BLE 扫描回调，Background Thread）
onScanResult { device -> addDevice(device) }

// 线程 B（用户手动添加，UI Thread）
button.onClick { addDevice(manualDevice) }

// 两个线程同时调用 addDevice → 同时操作 devices 列表 → 崩溃或数据错乱
```

**JS 为什么没这个问题？** JS 是单线程——同一时刻只有一个执行流，不存在"两个线程同时调用同一个函数"。

#### 锁（synchronized）

**本质**：保证一段代码同一时刻只能被一个线程执行。多个线程调用到这里时排队。

```kotlin
val lock = Any()

fun addDevice(device: Device) {
    synchronized(lock) {       // 线程 A 正在执行时，线程 B 调用到这里会等待
        devices.add(device)
    }                          // A 执行完释放锁 → B 才能继续
}
```

#### 原子操作（Atomic）

**本质**：CPU 指令级保证"读-改-写"不可分割，不需要锁。

```kotlin
// 场景：多线程计数（BLE 连接数）
val connectedCount = AtomicInteger(0)

// Background Thread
fun onDeviceConnected() {
    connectedCount.incrementAndGet()  // 原子 +1，不会被打断
}

// UI Thread
fun showCount() {
    textView.text = "已连接: ${connectedCount.get()}"  // 原子读
}
```

#### 线程安全容器

```kotlin
// 最实用：用线程安全容器替代普通容器，不用手动加锁
val devices = ConcurrentLinkedQueue<Device>()  // 内部已处理并发

fun addDevice(device: Device) { devices.add(device) }  // 安全
fun renderList() { devices.forEach { showDevice(it) } }  // 安全
```

#### 对比选型

| | 锁（synchronized） | 原子操作（Atomic） | 线程安全容器 |
|---|---|---|---|
| 粒度 | 保护一段代码 | 保护一个变量 | 保护一个数据结构 |
| 性能 | 较慢（线程等待） | 快（CPU 指令级） | 中（内部分段锁） |
| 适用 | 复杂多步操作 | 简单计数器/标志位 | 集合类数据 |
| 死锁风险 | 有 | 无 | 无 |

### 核心 API 速查

| API / 关键字 | 作用 |
|---|---|
| `synchronized(lock) {}` | 互斥锁：同一时刻只有一个线程能执行这段代码 |
| `ReentrantLock` | 可重入锁（支持 tryLock/超时/公平锁） |
| `@Volatile` | 可见性保证：一个线程改了，其他线程立刻看到新值 |
| `AtomicInteger` / `AtomicBoolean` | 原子变量：incrementAndGet() / compareAndSet() 无需锁 |
| `ConcurrentHashMap` | 线程安全 Map（替代 HashMap） |
| `ConcurrentLinkedQueue` | 线程安全队列（无锁，CAS 实现） |
| `CountDownLatch` | 等 N 个线程都完成后再继续（如等所有初始化完成） |
| `Semaphore` | 控制同时访问资源的线程数（如最多 3 个并发 BLE 连接） |
| `Mutex`（Kotlin Coroutine） | 协程版互斥锁 |
| `Channel`（Kotlin Coroutine） | 协程间通信管道（类似 Go channel） |

### Handler + Looper + MessageQueue（Android 核心通信机制）

```
线程 A（发送方）                    线程 B（接收方，有 Looper）
─────────────                      ─────────────────────────
handler.sendMessage(msg)           Looper.loop() {
    ↓                                  msg = queue.next()  // 阻塞等待
MessageQueue.enqueue(msg)  ──→         handler.handleMessage(msg)
                                   }
```

类比前端：
- Looper = Event Loop
- MessageQueue = Task Queue
- Handler = postMessage 的发送/接收器
- Message = Event

### 主线程的 Looper

主线程（UI Thread）天生有一个 Looper，在 `ActivityThread.main()` 里启动：

```java
public static void main(String[] args) {
    Looper.prepareMainLooper();
    // ... 创建 ActivityThread
    Looper.loop(); // 永远不会返回，一直循环处理消息
}
```

所有 UI 操作（View 更新、Activity 生命周期回调）都是通过 Handler 发消息到主线程 Looper 执行的。

### runOnUiThread 的本质

```java
// 本质就是通过 Handler 把 Runnable 发到主线程的 MessageQueue
activity.runOnUiThread(() -> {
    textView.setText("updated");
});

// 等价于
mainHandler.post(() -> {
    textView.setText("updated");
});
```

---

## 四、进程间通信（IPC）

### Binder（Android 核心 IPC）

```
App 进程 ←→ Binder Driver（内核空间）←→ System Server 进程
```

所有系统服务调用都走 Binder：
- `startActivity()` → ActivityManagerService（Binder）
- `getSystemService()` → 各种 Manager（Binder）
- ContentProvider 跨进程访问（Binder）

### AIDL（Android Interface Definition Language）

定义跨进程接口的 IDL 语言（类似 Thrift/gRPC 的 .proto）：

```aidl
// IMyService.aidl
interface IMyService {
    String getData(int id);
    void sendMessage(String msg);
}
```

编译后自动生成 Stub（服务端）和 Proxy（客户端）代码。

### 其他 IPC 方式

| 方式 | 性能 | 适用 |
|------|------|------|
| Binder | 高（一次拷贝） | 系统服务、AIDL |
| ContentProvider | 中 | 结构化数据共享 |
| BroadcastReceiver | 低 | 一对多通知 |
| Socket | 中 | 跨设备通信 |
| 文件/SharedPreferences | 低 | 简单数据共享（有并发问题） |
| Messenger | 中 | 简单的跨进程消息 |

---

## 五、快应用框架的线程设计

### 三线程模型

```
┌─────────────────────────────────────────────┐
│ JS Thread                                    │
│ - V8 Isolate 运行                            │
│ - 执行 JS 业务逻辑                           │
│ - 虚拟 DOM diff                              │
│ - 产出渲染指令                               │
│ - 通过 J2V8 同步调用 Feature                  │
├─────────────────────────────────────────────┤
│ IO Thread Pool                               │
│ - 解析渲染指令 JSON                           │
│ - 异步 Feature 执行（网络/文件/数据库）        │
│ - 图片解码                                   │
│ - 数据预处理                                 │
├─────────────────────────────────────────────┤
│ UI Thread（主线程）                           │
│ - 创建/更新 Android View                     │
│ - 事件采集（点击/滑动）                       │
│ - 动画执行                                   │
│ - 系统回调（生命周期）                        │
└─────────────────────────────────────────────┘
```

### 线程间通信方式

| 通信方向 | 方式 | 说明 |
|---------|------|------|
| UI → JS | Handler post 到 JS Thread | 事件通知（用户点击） |
| JS → IO | 提交到线程池 | 异步 Feature 执行 |
| IO → UI | Handler post 到 UI Thread | 渲染指令执行 |
| IO → JS | Handler post 到 JS Thread | 异步回调 |
| JS → UI | 通过 IO 中转（或直接 Handler） | 渲染指令 |

### 为什么是三线程而不是两线程

```
两线程（JS + UI）：
  JS 产出渲染指令 → 直接在 UI Thread 解析和执行
  问题：JSON 解析是 CPU 密集操作，在 UI Thread 做会卡 UI

三线程（JS + IO + UI）：
  JS 产出渲染指令 → IO Thread 解析 JSON → UI Thread 只做 View 操作
  好处：UI Thread 只做最轻量的 View 创建/更新，不做解析
```

### 线程安全注意点

- V8 不是线程安全的：同一时刻只有一个线程能进入 Isolate
- Android View 不是线程安全的：只能在 UI Thread 操作
- 共享数据需要同步：JS Thread 和 IO Thread 共享的数据结构需要加锁或用线程安全容器


---

## 六、RN 的线程模型

### 3 个核心线程

| 线程 | 干什么 | 类比 |
|------|--------|------|
| **JS Thread** | 执行 Hermes（业务逻辑/React 渲染/事件处理） | 浏览器 JS 主线程 |
| **UI Thread**（Main Thread） | Android 主线程，画界面/手势识别/动画 | 浏览器渲染线程 |
| **Background Thread** | TurboModule 异步方法执行（网络/IO/BLE） | Web Worker |

**和浏览器的关键区别**：浏览器 JS 和渲染在同一个线程（互相阻塞），RN 的 JS 和 UI 是分开的（互不阻塞，但需要通信）。

### RN 线程间通信

**新架构（0.85）：JSI**

```
JS Thread ←── JSI（C++ 层）──→ UI Thread / Background Thread

JSI 本质：一个 C++ 中间层，JS 和 Native 共享同一块 C++ 内存
  → JS 直接调用 C++ 函数（同步/异步）
  → C++ 直接调用 Native（JNI → Java / ObjC）
  → 不需要序列化/反序列化
```

**旧架构（< 0.76）：Bridge**

```
JS Thread ←── Bridge（JSON 序列化队列）──→ Native Thread

Bridge 本质：异步消息队列
  → JS 调 Native：JSON.stringify → 放入队列 → Native 取出 → JSON.parse → 执行
  → 问题：序列化开销 + 异步排队 → 高频通信时卡
```

**对比**：

| | Bridge（旧） | JSI（新） |
|---|---|---|
| 通信方式 | JSON 序列化 + 异步队列 | C++ 直调，共享内存 |
| 延迟 | ms 级 | μs 级 |
| 同步调用 | 不支持 | 支持 |
| 类型安全 | 无 | Codegen 编译时检查 |

---

## 七、线程通信方案选型（第一性原理）

**本质问题**：两个线程要交换数据，怎么选方案？

**决策维度**：

| 维度 | 问题 | 影响选型 |
|------|------|---------|
| **频率** | 每秒通信几次？ | 高频 → 不能有序列化开销 |
| **延迟要求** | 能接受多少延迟？ | 实时 → 需要同步或极低延迟 |
| **数据量** | 每次传多少数据？ | 大数据 → 共享内存优于拷贝 |
| **方向** | 单向还是双向？ | 双向 → 需要回调机制 |
| **安全性** | 需要线程安全吗？ | 共享内存 → 需要锁/原子操作 |

**选型决策树（RN 场景）**：

```
需要同步返回？
  ├── 是 → JSI 同步方法（如 isConnected() 状态查询）
  └── 否 →
      频率高（每秒 10+ 次）？
        ├── 是 → JSI + Native 层事件聚合（如 BLE 数据流）
        └── 否 → JSI 异步方法 / TurboModule Promise（如 API 请求）
```

**一句话**：通信方案选型本质是在延迟、吞吐量、复杂度之间做 trade-off。RN 新架构用 JSI 统一解决——同步/异步都支持，无序列化开销。
