# ANR 治理（Android）& Watchdog（iOS）

> ANR = Application Not Responding，主线程被阻塞超过阈值（输入事件 5s / BroadcastReceiver 10s / Service 20s）

## 目录

- [一、核心指标](#一核心指标)
- [二、Android ANR 分类](#二android-anr-分类)
- [三、探针方案](#三探针方案)
- [四、常见原因 & 治理](#四常见原因--治理)
- [五、监控 & 告警](#五监控--告警)
- [六、与 Crash 的区别](#六与-crash-的区别)

---

## 一、核心指标

| 平台 | 指标 | 阈值 | 检测机制 |
|------|------|------|---------|
| Android | ANR 率 | < 0.47%（Google Play 要求） | 系统 Watchdog → 弹框 / 后台 kill |
| iOS | Watchdog Kill | 主线程卡死 > 几秒 | 系统 Watchdog 直接 kill（无弹框） |
| RN | JS 线程长任务 | 单帧 > 16ms | InteractionManager / Hermes Profiler |

---

## 二、Android ANR 分类

| 类型 | 触发条件 | 常见场景 |
|------|---------|---------|
| **Input ANR** | 输入事件 5s 内未响应 | 主线程 I/O / 大量计算 / 死锁 |
| **Broadcast ANR** | 前台广播 10s / 后台 60s 未完成 | onReceive 中做网络请求 |
| **Service ANR** | 前台 Service 20s / 后台 200s | Service 中同步阻塞 |
| **ContentProvider ANR** | publish 超时 10s | ContentProvider.onCreate 阻塞 |

---

## 三、探针方案

### SDK

| 平台 | SDK | 检测方式 | 上报类型 | 默认开启 |
|------|-----|---------|---------|---------|
| Android | `sentry-android` | Watchdog 线程 ping 主线程 | ANR 事件 | ✅ `anrEnabled = true` |
| iOS | `sentry-cocoa` | 同上（子线程 ping 主线程） | App Hang 事件 | ✅ |

不需要自己写探针，Sentry 内置。

### Android

```kotlin
// 方案 1：Looper Printer 监控（线上轻量）
Looper.getMainLooper().setMessageLogging { log ->
    if (log.startsWith(">>>>> Dispatching")) {
        // 记录消息开始时间
        startTime = SystemClock.elapsedRealtime()
        // 开启子线程延迟采集堆栈（如 3s 后）
        watchdog.postDelayed(dumpRunnable, ANR_THRESHOLD)
    }
    if (log.startsWith("<<<<< Finished")) {
        // 消息处理完成，取消采集
        watchdog.removeCallbacks(dumpRunnable)
        val cost = SystemClock.elapsedRealtime() - startTime
        if (cost > WARN_THRESHOLD) {
            reportSlowMessage(cost)
        }
    }
}

// 方案 2：子线程 Watchdog（更精确）
class ANRWatchdog : Thread() {
    private val tick = AtomicLong(0)
    private val reported = AtomicBoolean(false)

    override fun run() {
        while (!isInterrupted) {
            tick.incrementAndGet()
            val currentTick = tick.get()
            
            // 在主线程 post 一个任务更新 tick
            mainHandler.post { tick.set(0) }
            
            Thread.sleep(ANR_THRESHOLD) // 5000ms
            
            // 如果 tick 没被重置，说明主线程卡了
            if (tick.get() == currentTick && !reported.get()) {
                reported.set(true)
                val stackTrace = Looper.getMainLooper().thread.stackTrace
                reportANR(stackTrace)
            }
        }
    }
}
```

### iOS Watchdog 检测

```swift
// iOS 没有系统 ANR 弹框，但可以自检主线程卡顿
class MainThreadWatchdog {
    private let queue = DispatchQueue(label: "watchdog")
    private var lastPing: TimeInterval = 0
    private let threshold: TimeInterval = 3.0  // 3s 阈值
    
    func start() {
        queue.async { [weak self] in
            while true {
                var responded = false
                
                DispatchQueue.main.async {
                    responded = true
                }
                
                Thread.sleep(forTimeInterval: self?.threshold ?? 3.0)
                
                if !responded {
                    // 主线程卡死，采集堆栈
                    let callStack = Thread.callStackSymbols
                    self?.reportWatchdogTimeout(callStack)
                }
            }
        }
    }
}
```

### RN JS 线程监控

```typescript
// JS 线程长任务检测
const FRAME_BUDGET = 16; // 16ms per frame

let lastFrameTime = Date.now();
const frameCallback = () => {
  const now = Date.now();
  const frameDuration = now - lastFrameTime;
  
  if (frameDuration > FRAME_BUDGET * 3) { // 超过 3 帧
    reportLongTask(frameDuration);
  }
  
  lastFrameTime = now;
  requestAnimationFrame(frameCallback);
};
requestAnimationFrame(frameCallback);
```

---

## 四、常见原因 & 治理

| 原因分类 | 具体场景 | 治理方案 |
|---------|---------|---------|
| **主线程 I/O** | SharedPreferences commit / 文件读写 / 数据库查询 | 异步化：apply 替代 commit / Room + 协程 / WorkManager |
| **主线程计算** | JSON 解析大数据 / 图片解码 / 列表排序 | 移到子线程 / 分片处理 / 延迟加载 |
| **锁竞争/死锁** | synchronized 嵌套 / 跨线程锁等待 | 减少锁粒度 / tryLock + 超时 / 无锁数据结构 |
| **Binder 阻塞** | 跨进程调用超时（如 AMS/PMS） | 异步 Binder / 超时兜底 / 缓存结果 |
| **WebView 初始化** | 首次创建 WebView 阻塞主线程 | 预创建 WebView 池（子线程初始化） |
| **RN Bridge 阻塞** | 旧架构 JSON 序列化大对象 | 升级 JSI / 拆分大消息 / 异步化 |

---

## 五、监控 & 告警

```
线上监控链路：
  ANR Watchdog 检测 → 采集主线程堆栈 + 系统状态
  → 上报 Sentry（tag: ANR）
  → Sentry 按堆栈聚合 → 告警
  → 版本对比（新版本 ANR 率是否上升, 上一版作为基准）

Google Play Console：
  - Android Vitals → ANR 率（目标 < 0.47%）
  - 按设备/版本/页面 维度分析
```

---

## 六、与 Crash 的区别

| | ANR | Crash |
|--|-----|-------|
| 表现 | 卡住不动 / 弹框 | 闪退 |
| 原因 | 主线程阻塞 | 空指针 / OOM / Native Crash |
| 用户感知 | 差（等待焦虑） | 差（直接退出） |
| 检测 | Watchdog / Looper 监控 | UncaughtExceptionHandler / Signal Handler |
| 恢复 | 用户可选等待/关闭 | 不可恢复 |
| 治理优先级 | 高（影响 Google Play 评分） | 高（同样影响评分） |
