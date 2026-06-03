# 闪退（Crash）治理

> 问题：App 突然退出，用户丢失操作上下文
>
> 本质：未捕获的异常导致进程终止（JS 层 or Native 层）
>
> 目标：Crash-free rate > 99.5%

---

## 目录

- [如何分析](#如何分析)
- [如何优化](#如何优化)
  - [RN/JS 层（总览）](#rnjs-层)
  - [Native 层（总览）](#native-层)
  - [详解：LeakCanary（开发阶段内存泄漏检测）](#详解leakcanary开发阶段内存泄漏检测)
  - [详解：ANR（Application Not Responding）](#详解anrapplication-not-responding)
  - [监控体系](#监控体系)

---

## 如何分析

| 工具 | 看什么 | 平台 |
|------|--------|------|
| **Sentry** | JS Crash 堆栈 + Source Map 还原 | 跨平台 |
| **Firebase Crashlytics** | Native Crash 堆栈 | 跨平台 |
| `adb logcat` | 实时 Crash 日志 | Android |
| Tombstone 文件 | Native Crash 详细信息 | Android |
| Xcode Console | Crash 日志 | iOS |

**分类**：
- **JS Crash**：未捕获的 JS 异常（TypeError/ReferenceError/Promise rejection）
- **Native Crash**：OOM / 空指针 / ANR / Native 代码 bug
- **混合 Crash**：JS 调 Native 时参数错误 → Native 崩溃

---

## 如何优化

### RN/JS 层

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **ErrorBoundary** | 包裹组件树，捕获渲染错误 → 显示兜底 UI | JS 渲染错误不白屏 |

> **ErrorBoundary 用法说明**：
> - 是一个 React class component，用来捕获**子组件树渲染阶段**的 JS 错误
> - 没有它：一个子组件报错 → 整棵 React 树卸载 → 白屏
> - 有了它：错误被拦截 → 显示降级 UI（如"出错了，点击重试"）→ App 不崩
> - 使用：包裹在 App 根组件或关键模块外面 `<ErrorBoundary><App /></ErrorBoundary>`
> - 限制：只能捕获渲染/生命周期错误，不能捕获事件处理函数/异步代码的错误（那些用 try-catch 或 `ErrorUtils.setGlobalHandler`）
| **全局异常捕获** | `ErrorUtils.setGlobalHandler` | 捕获未处理的 JS 异常 |
| **Promise rejection 处理** | 全局监听 unhandled rejection | Promise 错误不闪退 |
| **Sentry 集成** | 自动上报 + Source Map + 用户上下文 | 线上问题可追溯 |
| **防御性编码** | 可选链 `?.` + 空值兜底 + 类型校验 | 减少 TypeError |

```typescript
// ErrorBoundary：组件级错误兜底
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { Sentry.captureException(error); }
  render() {
    if (this.state.hasError) return <ErrorFallback onRetry={() => this.setState({ hasError: false })} />;
    return this.props.children;
  }
}

// 全局异常捕获
ErrorUtils.setGlobalHandler((error, isFatal) => {
  Sentry.captureException(error);
  if (isFatal) showCrashReport();  // 显示崩溃报告页
});
```

### Native 层

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **LeakCanary** | 检测内存泄漏（OOM 预防） | 避免内存不足闪退 |
| **ANR 监控** | 主线程阻塞 > 5s 检测 | 提前发现卡死 |
| **Native Crash 上报** | Firebase Crashlytics / Sentry Native | 线上 Native 崩溃可追溯 |
| **防御性编码** | 空指针检查 / try-catch 关键路径 | 减少 Native 崩溃 |
| **BLE 异常处理** | BLE 操作全部 try-catch + 状态校验 | BLE 异常不导致闪退 |

#### 详解：LeakCanary（开发阶段内存泄漏检测）

Square 开源的 Android 内存泄漏自动检测库。只加一行 `debugImplementation` 依赖，零代码侵入。监控 Activity/Fragment 销毁后是否被 GC 回收，泄漏时弹通知 + 显示完整引用链。**只用于开发阶段**（debug 包），release 不打入。

**线上怎么监控内存泄漏？**
- 监控 OOM Crash 率（Sentry/Crashlytics 自动上报 OOM 类型的 Crash）
- 监控内存趋势（自建埋点定时上报 PSS，后端看趋势图是否持续增长）
- Firebase Performance 的内存指标（自动采集）
- 线上不能像 LeakCanary 那样精确到引用链——只能通过 Crash 堆栈 + 内存趋势间接判断，然后在开发环境复现排查

#### 详解：ANR（Application Not Responding）

**概念**：Android 系统检测到主线程（UI 线程）被阻塞超过 5 秒（或 BroadcastReceiver 10 秒未完成），弹出"应用无响应"对话框让用户选择等待或关闭。

**监测**：
- 线上：Google Play Console ANR 率 + Sentry/Firebase 自动上报 ANR 堆栈
- 开发：`adb bugreport` 导出 traces.txt（系统记录的 ANR 时各线程堆栈）
- Perfetto：录制时看 UI Thread 哪段时间被长时间占用

**常见根因（RN 场景）**：
- 主线程做了同步 IO（读大文件/数据库操作）
- 主线程做了网络请求（误用同步请求）
- 旧 Bridge 消息队列积压（大量 JS→Native 调用排队）
- Native Module 在主线程执行耗时逻辑
- BLE 操作阻塞主线程（connectGatt 同步等待）

**治理**：
- 耗时操作移到子线程（IO/网络/BLE 操作不放主线程）
- TurboModule 异步方法用 Promise（不阻塞 JS Thread 和 UI Thread）
- 用 `StrictMode` 开发时检测主线程 IO/网络
- BLE 操作全部异步化 + 超时保护

### 监控体系

```
Sentry 配置：
  - JS 层：@sentry/react-native（自动捕获 + Source Map）
  - Native 层：Sentry Native SDK（自动捕获 Native Crash）
  - 告警：Crash-free rate < 99.5% → 告警
  - 分析：按版本/设备/页面维度聚合
```
