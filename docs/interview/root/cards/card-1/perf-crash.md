# 闪退（Crash）治理

> 问题：App 突然退出，用户丢失操作上下文
> 本质：未捕获的异常导致进程终止（JS 层 or Native 层）
> 目标：Crash-free rate > 99.5%

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

### 监控体系

```
Sentry 配置：
  - JS 层：@sentry/react-native（自动捕获 + Source Map）
  - Native 层：Sentry Native SDK（自动捕获 Native Crash）
  - 告警：Crash-free rate < 99.5% → 告警
  - 分析：按版本/设备/页面维度聚合
```
