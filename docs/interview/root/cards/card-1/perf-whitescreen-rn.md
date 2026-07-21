# RN 白屏检测与治理

> 旧文档参考 → [perf-whitescreen.md](./perf-whitescreen.md)
> 白屏需要自定义, 通用的可观测方案: 例如 sentry 等都不支持监测

## 目录

- [1. 白屏定义](#1-白屏定义)
- [2. 白屏分类](#2-白屏分类)
- [3. 根因与优化](#3-根因与优化)
- [4. 白屏检测 SDK 设计](#4-白屏检测-sdk-设计)
  - [SDK:JS 侧](#sdkjs-侧)
  - [SDK:Native 侧](#sdknative-侧)
- [QA](#qa)
  - [Q1: 白屏检测业界怎么做？能从 Native 容器层检测吗？](#q1)
  - [Q2: 白屏的归因和治理？](#q2)

---

## 1. 白屏定义

**白屏 = 超过阈值时间后（通常 3-5s），页面仍然没有有意义内容（FMP 未达成）**

| 指标 | 含义 | 算白屏消失？ |
|------|------|------------|
| FP（First Paint） | 第一个像素绘制（可能只是背景色） | ❌ |
| FCP（First Contentful Paint） | 第一个文本/图片出现 | ⚠️ 骨架屏也算 FCP |
| **FMP（First Meaningful Paint）** | 主要内容可见（列表/文章/核心 UI） | ✅ 这才算白屏消失 |


> 检测逻辑：页面加载 N 秒后，检查是否有有意义的 View 内容 → 没有 = 白屏。


| 等级 | 白屏率 | 说明 |
|------|--------|------|
| 优秀 | < 0.1% | 基本无白屏 |
| 正常 | 0.1% - 0.5% | 偶发，主要弱网/接口超时 |
| 差 | > 1% | 需紧急治理 |

> 无业界统一标准，白屏率是自定义指标。一般设基线后按版本对比，spike 就告警。

## 2. 白屏分类

| 场景 | 表现 | 常见原因 |
|------|------|---------|
| RN启动白屏(主要观测这个) | App 打开后长时间空白 | Bundle 加载慢 / JS 初始化重 |
| 页面跳转白屏 | 跳转新页面时闪白 | 目标页渲染重 / 无骨架屏过渡 |
| 列表滚动白屏 | 快速滑动出现空白区域 | 列表项渲染不及时 / JS 线程阻塞 |
| JS Crash 白屏 | 页面突然全白 | 未捕获异常 / ErrorBoundary 缺失 |
| 数据加载白屏 | 接口返回前页面空 | 无 loading/骨架屏 / 接口超时 |

> 我们这里聚焦讨论: RN启动白屏
## 3. 根因与优化

### 总览表格

本质都是不让用户看到纯白——要么给个过渡态（骨架屏），要么给个兜底（ErrorBoundary 降级 UI），要么换个能用的版本（回滚）

| 根因 | 层级 | 怎么确认 | 治理 |
|------|------|---------|------|
| ① JS Error 导致组件崩溃 | JS | [ErrorBoundary 捕获](#注释errorboundary) + Sentry 堆栈 | ErrorBoundary 兜底 + 热更新修复 |
| ② 接口超时/失败 → 无数据渲染 | JS | 网络监控 + 空数据兜底缺失 | 骨架屏 + 空态 UI + 重试 |
| ③ Bundle 加载失败 | Native Shell | [加载回调 status != success](#注释bundle-加载状态回调) | 回滚上一版本 |
| ④ JS 线程卡死（长任务. js阻塞） | JS | Native 超时检测到白屏但无 JS Error | 分片处理（宏任务） |

## 4. 白屏检测 SDK 设计

### SDK:JS 侧(一级)
> JS 侧是主力：能精确知道哪个页面白屏 + 拿到 ErrorBoundary 错误堆栈。
> 业界主流做法: 3s 不是标准，是经验值——来自 Google 的 Web 性能研究：超过 3s 用户会认为页面"挂了"。业界一般 3-5s 都有人用，根据自己 App 的正常加载时间来定（如果正常加载 P95 是 2s，那阈值设 3-5s 合理；如果正常加载就要 4s，阈值就得更高）

```typescript
// 页面挂载后超时检测：N 秒后检查是否有有效内容
function useWhiteScreenDetection(screenName: string) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasVisibleContent()) {
        Sentry.captureMessage(`whitescreen:${screenName}`);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);
}

// hasVisibleContent 判断逻辑：检查组件树是否有子节点渲染出来
function hasVisibleContent(): boolean {
  // 方案1：检查 root 下是否有非空子组件（通过 ref）
  // 方案2：检查业务数据是否已渲染（首屏数据 state 非空）≈ RN 版 FMP 判定
  return rootRef.current?.children.length > 0;
}
```

### SDK:Native 侧(二级)

> 兜底：JS 崩了也能检测到。

#### Android 侧
> 5s 怎么来的：Native 侧比 JS 侧设得更长（5s vs 3s），因为 Native 是兜底——只有 JS 侧 3s 没检测到（JS 已经崩了），才轮到 Native 5s 这层。如果 JS 正常工作，3s 就已经上报了，Native 的 5s 永远不会触发。两个阈值不同是故意的，避免重复上报。

```kotlin
// 页面加载后 5s 检查 RN 根 View 子节点
fun startWhiteScreenWatch(rootView: ReactRootView) {
    Handler(Looper.getMainLooper()).postDelayed({
        if (rootView.childCount == 0) {
            Sentry.captureMessage("whitescreen:native_detected")
        }
    }, 5000)
}
// 在 Activity 创建 RN 容器时调用：
// rootView 就是你自己 new 出来的 ReactRootView，你一直持有引用
val rootView = ReactRootView(this)
rootView.startReactApplication(reactInstanceManager, "AppName")
setContentView(rootView)
startWhiteScreenWatch(rootView)  // ← 这里调用
```

#### iOS 侧

```swift
// 同理：检查 RCTRootView 的 subviews
// rootView = 你在 ViewController 中创建的 RCTRootView，self.view = rootView

// DispatchQueue.main.asyncAfter — GCD 主线程延迟调度
//   DispatchQueue.main = 主线程队列（UI 操作必须在主线程）
//   asyncAfter = 延迟 N 秒后执行闭包
// rootView.subviews — UIView 的子视图数组
//   RN 渲染成功后会往 RCTRootView 里添加子 view；空 = 没渲染出任何东西
// SentrySDK.capture — Sentry iOS SDK 上报接口（内部自动走后台线程发送）
DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
    if rootView.subviews.isEmpty {
        SentrySDK.capture(message: "whitescreen:native_detected")
    }
}
```

---

## QA

<a id="q1"></a>
### Q1: 白屏检测业界怎么做？能从 Native 容器层检测吗？

**能。业界双层检测：JS 主力 + Native 兜底。**

| 方案 | 原理 | 层级 |
|------|------|------|
| ErrorBoundary | 捕获渲染异常 → 降级 UI + 上报 | JS |
| 超时检测 | 页面挂载后 N 秒检查是否有有效子节点 | JS |
| View 树检查 | N 秒后检查根 View 的 childCount | Native |
| 截图检测 | 对根 View 截图 → 采样像素是否全白 | Native |

为什么 JS 是主力：绝大多数白屏是 JS 层问题（组件报错/数据为空/接口失败），ErrorBoundary 能精确定位。Native 只覆盖 JS 完全崩了的极端场景。

| | JS 层 | Native 层 |
|--|------|-----------|
| 检测什么 | ErrorBoundary 捕获 + 超时检查组件树有无内容 | 超时检查 rootView.childCount 或截图像素 |
| 能拿到什么 | 具体错误堆栈 + 哪个组件崩了 | 只知道"白屏了"，不知道为什么 |
| 什么时候失效 | JS 线程完全卡死/崩溃 | 不会失效（独立于 JS） |

---

<a id="q2"></a>
### Q2: 白屏的归因和治理？

**归因：**

| 原因 | 层级 | 怎么确认 |
|------|------|---------|
| JS Error 导致组件崩溃 | JS | ErrorBoundary 捕获 + Sentry 堆栈 |
| Bundle 加载失败 | Native Shell | 加载回调 status != success |
| 接口超时/失败 → 无数据渲染 | JS | 网络监控 + 空数据兜底缺失 |
| JS 线程卡死（长任务） | JS | Native 超时检测到白屏但无 JS Error |

**治理：**

| 阶段 | 手段 |
|------|------|
| **预防** | ErrorBoundary 每个路由页包一层 + 接口空值兜底 + 热更新 minNativeVersion 卡控 |
| **检测** | JS 层超时检查 + Native 层 View 树兜底 |
| **恢复** | 当次：reload / 降级 UI；下次启动：回滚到上一稳定 Bundle |
| **上报** | Bridge → Sentry SDK（内置离线缓存 + 专门上报线程） |
| **防退化** | CI E2E 检测核心页面白屏 + 灰度监控白屏率 |

---

# 注释

<a id="注释bundle-加载状态回调"></a>
### Bundle 加载状态回调

```kotlin
// ─── Android ───
reactInstanceManager.addReactInstanceEventListener { context ->
    // 加载成功
}
```

```swift
// ─── iOS ───
NotificationCenter.default.addObserver(forName: .RCTJavaScriptDidLoad, ...)       // 成功
NotificationCenter.default.addObserver(forName: .RCTJavaScriptDidFailToLoad, ...) // 失败
```

→ 详见 [XRN Bundle 加载运行](../../XRN/bundle-runtime.md)

---

<a id="注释errorboundary"></a>
### ErrorBoundary

React 的错误边界组件：子组件 render 抛异常时，捕获错误并显示降级 UI（不白屏）。

```tsx
// 最简范式
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    Sentry.captureException(error);  // 上报
  }

  render() {
    if (this.state.hasError) {
      return <FallbackUI error={this.state.error} />;  // 降级 UI
    }
    return this.props.children;
  }
}

// 使用：每个路由页包一层
<ErrorBoundary>
  <HomeScreen />
</ErrorBoundary>
```

能做到：子组件崩了 → 不白屏 → 显示降级页面（重试按钮）+ 自动上报 Sentry。
