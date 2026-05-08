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

### Handler + Looper + MessageQueue

Android 线程间通信的核心机制：

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
