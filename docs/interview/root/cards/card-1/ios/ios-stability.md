# iOS 稳定性

## Android → iOS 概念映射

| Android | iOS | 说明 |
|---------|-----|------|
| Crash（Java 异常 / Native Crash） | Crash（NSException / Mach Exception / Signal） | 崩溃 |
| ANR（Application Not Responding） | Watchdog Kill（主线程阻塞 > 几秒） | 无响应 |
| Bugly / Firebase Crashlytics | Firebase Crashlytics / Sentry | Crash 上报 |
| Breakpad（Native Crash 捕获） | PLCrashReporter | Native Crash 捕获 |
| ProGuard 符号化 | dSYM 符号化 | 堆栈还原 |
| logcat | Console.app / os_log | 日志 |
| StrictMode | Thread Sanitizer / Main Thread Checker | 线程问题检测 |

---

## iOS Crash 类型

| 类型 | 原因 | 捕获方式 |
|------|------|---------|
| **NSException**（ObjC 异常） | 数组越界、nil 调用、KVO 未移除 | `NSSetUncaughtExceptionHandler` |
| **Mach Exception**（内核异常） | 野指针、内存越界、栈溢出 | Mach port 监听 |
| **Signal**（Unix 信号） | SIGSEGV/SIGABRT/SIGBUS | `signal()` / `sigaction()` |
| **Watchdog Kill** | 主线程阻塞超时（启动 > 20s，前台 > 几秒） | 无法捕获，只能预防 |
| **Jetsam**（内存超限） | 内存占用过高被系统杀 | MetricKit 事后分析 |
| **JS Error**（RN 层） | JS 未捕获异常 | ErrorBoundary + 全局 handler |

---

## 和 Android 的关键区别

| 维度 | Android | iOS |
|------|---------|-----|
| 内存超限 | OOM 异常可捕获 | Jetsam 直接杀，无法捕获 |
| 主线程阻塞 | ANR 弹窗，用户可等待 | Watchdog 直接杀，用户看到闪退 |
| 符号化 | mapping.txt（ProGuard） | dSYM 文件（Xcode 构建产出） |
| 热修复 | 可以（热更新 JS Bundle） | 可以（同，只更新 JS Bundle） |
| 动态加载代码 | 可以（DexClassLoader） | 不可以（App Store 禁止 dlopen） |

---

## 防治手段

| 手段 | 说明 |
|------|------|
| **dSYM 上传** | 每次发版把 dSYM 上传到 Crashlytics/Sentry，否则堆栈无法符号化 |
| **ErrorBoundary** | RN 层兜底，JS 崩了显示降级 UI 而不是白屏 |
| **Watchdog 预防** | 主线程不做 IO/网络/大计算，用 `DispatchQueue.global()` |
| **内存监控** | `os_proc_available_memory()` 定时检查，低于阈值主动释放 |
| **热更新回滚** | 新 Bundle crash → 自动删除 → 回退内置版本（和 Android 方案一样） |
| **Main Thread Checker** | Xcode 开启，检测非主线程操作 UI |

---

## 监控

| 工具 | 用途 |
|------|------|
| Firebase Crashlytics | Crash 上报 + 符号化 + 趋势 |
| Sentry | Crash + JS Error + 性能 |
| MetricKit | 系统级指标（启动/内存/Jetsam/Hang） |
| Xcode Organizer | 查看线上 Crash 报告（Apple 收集） |
| PLCrashReporter | 自建 Crash 捕获（开源） |
