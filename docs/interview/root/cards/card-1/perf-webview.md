# WebView 加载性能

> 问题：WebView 加载慢、进度条重复、和 App 体验割裂
> 本质：WebView = 内嵌浏览器，加载网页有网络延迟 + 渲染延迟
> 目标：减少 WebView 使用 + 用了就优化体验

---

## 如何分析

| 工具 | 看什么 |
|------|--------|
| WebView `onLoadStart/onLoadEnd` | 加载耗时 |
| `onNavigationStateChange` | 是否有重定向（进度条重复的原因） |
| Network 面板 | 网页资源加载时间 |

---

## 如何优化

### 策略 1：减少 WebView 使用（最优）

| 场景 | 替代方案 |
|------|---------|
| 用户指导/FAQ | 内置到 App（RN 页面或本地 HTML）→ 秒开 + 离线可用 |
| 跳转淘宝/商城 | Deep Link 跳转原生 App → 用户已登录，体验好 |
| 协议/隐私政策 | 本地 HTML 或 RN 页面 |

### 策略 2：WebView 体验优化（必须用时）

| 手段 | 做什么 | 效果 |
|------|--------|------|
| 自定义进度条 | 隐藏 WebView 自带进度条，用自定义的（只显示一次） | 不重复闪烁 |
| 拦截重定向 | `onNavigationStateChange` 只在最终 URL 显示进度 | 进度条不重复 |
| 预加载 | 提前创建 WebView 实例 + 预加载 URL | 打开时秒出 |
| 骨架屏 | WebView 加载中显示骨架/loading | 不白屏 |
| 离线缓存 | 对自有 H5 做 Service Worker 缓存 | 二次打开秒出 |

### Deep Link 跳转外部 App

```typescript
import { Linking } from 'react-native';

async function openInExternalApp(deepLink: string, fallbackUrl: string) {
  const canOpen = await Linking.canOpenURL(deepLink);
  if (canOpen) {
    await Linking.openURL(deepLink);  // 跳转到目标 App
  } else {
    await Linking.openURL(fallbackUrl);  // 没装 → 跳浏览器
  }
}
```

```typescript
// WebView 自定义进度条
<WebView
  source={{ uri: url }}
  onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
  renderLoading={() => <ProgressBar progress={progress} />}
/>
```
