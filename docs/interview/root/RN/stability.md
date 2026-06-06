# RN 线上稳定性保障体系

> 解决什么问题：App 上架后出了白屏/崩溃，如何检测、恢复、预防？
>
> 本质：检测 → 恢复 → 预防，三层防线。
>
> 场景：Expo + iOS + 北美市场（XZ），以及 Bare RN 大厂方案对比。

---

## 目录

- [本质模型：三层防线](#本质模型三层防线)
- [白屏检测](#白屏检测)
- [白屏恢复（分级策略）](#白屏恢复分级策略)
- [热更新回滚机制](#热更新回滚机制)
- [Expo 生态方案](#expo-生态方案)
- [Bare RN 大厂方案](#bare-rn-大厂方案)
- [落地节奏（小团队）](#落地节奏小团队)
- [Expo vs Bare RN 对比](#expo-vs-bare-rn-对比)

---

## 本质模型：三层防线

```
上线前（预防）：CI 测试 + 灰度发布 + 性能基线卡控
上线后（检测）：Sentry 异常上报 + 白屏检测 + 崩溃率监控
异常后（恢复）：ErrorBoundary 兜底 → 重载 Bundle → 热更新回滚 → 降级原生页
```

---

## 白屏检测

**RN App 白屏本质 = JS 崩溃了，页面没渲染出来。**

**没有统一的白屏检测现成库**——需要根据业务定制检测策略。原因：
- 不同 App 对"白屏"的定义不同（有 Splash Screen 的 App 5 秒白是正常的）
- 首屏可能是 Skeleton 而不是空白
- 检测后的恢复策略因 App 而异

业界做法：自己写检测逻辑（很轻量） + 通用监控平台（Sentry/Crashlytics）做上报和告警。

### 检测手段

| 方案 | 原理 | 现成？ | 适用 |
|------|------|--------|------|
| ErrorBoundary | React 捕获渲染异常，展示兜底 UI | ✅ React 内置 | JS 层组件 crash |
| Sentry 自动捕获 | unhandled rejection / JS crash 自动上报 | ✅ 现成 | 覆盖 90%+ 白屏原因 |
| 启动超时检测 | 首屏渲染后标记，超时未标记 = 白屏 | ❌ 自己写（10 行） | Bundle 加载失败 |
| Native 定时检测 | N 秒后检查 RootView 是否有子 View | ❌ 自己写 | Bare RN |
| 心跳机制 | JS 定时向 Native 发心跳，超时 = 线程挂了 | ❌ 自己写 | JS 线程卡死 |
| expo-updates 内置 | 新 update 加载后立即 crash → 自动回退 | ✅ Expo 内置 | 热更新后白屏 |

### 自封装启动超时检测（Expo/RN 通用，10 行代码）

```tsx
function useWhiteScreenDetection(timeoutMs = 5000) {
  const rendered = useRef(false);

  useEffect(() => { rendered.current = true; }, []);  // 正常渲染后标记

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!rendered.current) {
        Sentry.captureMessage('White screen detected', { level: 'fatal' });
        // 触发恢复：Updates.reloadAsync() 或展示兜底页
      }
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, []);
}
```

**实际覆盖策略**：ErrorBoundary + Sentry 已覆盖 90%+ 白屏场景（白屏 ≈ JS 报错），加一个超时检测 hook 兜底最后 10%。

---

## 白屏恢复（分级策略）

```
白屏发生
  │
  ├── Level 1: ErrorBoundary → 展示兜底页 + 用户点"重试" → 重新 mount
  │
  ├── Level 2: 重新加载 Bundle
  │   Native 销毁 ReactInstance → 重新创建 → 加载 Bundle
  │   Expo: Updates.reloadAsync()
  │
  ├── Level 3: 回滚到上一个版本（热更新场景）
  │   热更新后白屏 → 自动/手动回退到上一个稳定 Bundle
  │
  └── Level 4: 降级到原生兜底页 / 强制用户更新 App
```

---

## 热更新回滚机制

**为什么需要回滚？** 热更新跳过了 App Store 审核，直接推 JS Bundle 到用户设备。如果新 Bundle 有问题，必须能秒级回退。

### 自动回滚原理

**设备本地同时保留多个 Bundle 版本**，回滚 = 切换加载哪个，不需要重新下载：

```
设备本地存储：
├── embedded bundle（打包进 App 的原始版本，永远在，删不掉）
├── 上一次热更新的 bundle（旧版本）
└── 最新热更新的 bundle（当前加载的）

回滚 = 指向旧文件，瞬间完成，不联网
```

| 方案 | 保留策略 |
|---|---|
| expo-updates | embedded + 最近 1 个成功的 update；回滚时加载上一个成功的或 embedded |
| CodePush | embedded + 上一个成功安装的版本 |
| 自建热更新 | 自己控制保留几个版本（通常 2-3 个） |

**启动检测流程**：

```
热更新包推送 → 用户下载 → 下次启动加载新 Bundle
  │
  启动后检测：
  ├── JS 正常启动 → 调 notifyAppReady() → 标记"安装成功"
  └── 启动后 N 秒崩溃/白屏 → 未标记成功 → 下次启动自动回退旧 Bundle（本地已有）
```

### EAS Update（Expo）

```bash
# 发布热更新
eas update --branch production --message "fix: white screen"

# 回滚
eas update:rollback --branch production

# 灰度：先推给部分用户
eas update --branch production --rollout-percentage 10
```

### CodePush（Bare RN）

```tsx
codePush.sync({
  installMode: codePush.InstallMode.ON_NEXT_RESTART,
  rollbackRetryOptions: { maxRetryAttempts: 2 }
});

// 启动后标记成功（不调 → 下次自动回滚）
codePush.notifyAppReady();
```

---

## Expo 生态方案

> Expo 托管了 Native 层，白屏原因比 Bare RN 少。主要就是 JS 层异常。

### Expo 下白屏原因收窄

| 原因 | Bare RN | Expo |
|---|---|---|
| Native 配置错误 | 常见 | ❌ Expo 托管不会出 |
| Bundle 加载失败 | 需自己处理 | Expo 有内置 fallback |
| JS 异常 | 一样 | 一样 |
| EAS Update 包损坏 | — | 内置校验 + 自动回退 |

### 完整方案（Expo + iOS）

```tsx
// 1. 根级 ErrorBoundary
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

class RootErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleRetry = async () => {
    try {
      await Updates.reloadAsync();  // 重新加载 Bundle
    } catch {
      this.setState({ hasError: false });  // fallback: 重新 mount
    }
  };

  render() {
    if (this.state.hasError) {
      return <CrashFallbackScreen onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
```

```json
// app.json — expo-updates 配置
{
  "expo": {
    "updates": {
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 5000
    }
  }
}
```

### Expo 核心工具链

| 工具 | 作用 |
|------|------|
| @sentry/react-native | 异常上报 + 告警 |
| expo-updates | 热更新 + 自动回滚 |
| EAS Update | 发布/灰度/回滚 dashboard |
| Firebase Crashlytics | iOS native crash 监控 |

---

## Bare RN 大厂方案

> 大厂没有 Expo 托管，Native 层需要自己写检测逻辑。

### Native 白屏检测（Android）

```java
// 加载超时检测
reactRootView.postDelayed(() -> {
  if (reactRootView.getChildCount() == 0) {
    reportWhiteScreen();
    showNativeFallback();
    tryRecover();
  }
}, 5000);
```

### Native 白屏检测（iOS）

```objc
dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
  if (self.rootView.subviews.count == 0) {
    [self reportWhiteScreen];
    [self showNativeFallback];
  }
});
```

### 大厂完整体系

```
上线前：
  ├── CI 自动化测试（单测 + E2E / Detox）
  ├── 灰度发布（先 10% → 观察崩溃率 → 全量）
  └── 性能基线卡控（启动 > 阈值 → 阻断发布）

上线后：
  ├── Sentry（JS 异常实时上报）
  ├── Native 白屏检测（定时器 + 心跳）
  ├── ANR 检测（Android 主线程卡顿 > 5s）
  ├── Firebase Crashlytics（Native crash）
  └── 自定义指标告警（首屏 > 3s → 告警）

异常后：
  ├── ErrorBoundary 兜底 UI
  ├── 重载 Bundle（销毁 ReactInstance → 重建）
  ├── 热更新自动回滚（CodePush / 自建）
  ├── 服务端熔断：推送回滚指令
  └── 极端：App Store 强制更新
```

---

## 落地节奏（小团队）

| 阶段 | 做什么 | 工具 |
|------|--------|------|
| Day 1 | ErrorBoundary 包根组件 + Sentry 接入 | @sentry/react-native |
| Week 1 | EAS Update 灰度发布流程 | eas update + branch |
| Week 2 | 验证自动回滚（故意发有 bug 的 update 测试） | expo-updates |
| 持续 | 崩溃率 < 0.1% 目标 + 告警规则 | Sentry alerts |

---

## Expo vs Bare RN 对比

| | Expo | Bare RN |
|---|---|---|
| 白屏原因 | 主要 JS 异常 | JS + Native 都可能 |
| Native 检测 | 不需要（Expo 托管） | 需要自己写 |
| 热更新 | EAS Update（官方） | CodePush / 自建 |
| 回滚 | 一键 + 自动回滚 | 需要配置 notifyAppReady |
| 灰度 | EAS 内置百分比推送 | 自建灰度系统 |
| 监控 | Sentry + Crashlytics | 同 |
| 复杂度 | 低（开箱即用） | 高（自己搭建） |

**结论**：Expo 下稳定性保障比 Bare RN 简单很多，三板斧够用：**ErrorBoundary + Sentry + EAS Update 灰度/回滚**。
