# WebView 加载性能

> 问题：WebView 加载慢、进度条重复、和 App 体验割裂
>
> 本质：WebView = 内嵌浏览器，加载网页有网络延迟 + 渲染延迟
>
> 目标：减少 WebView 使用 + 用了就优化体验

---

## 目录

- [如何分析](#如何分析)
- [如何优化](#如何优化)
  - [策略 1：减少 WebView 使用（最优）](#策略-1减少-webview-使用最优)
  - [策略 2：WebView 体验优化（必须用时）](#策略-2webview-体验优化必须用时)
  - [onNavigationStateChange 怎么用](#onnavigationstatechange-怎么用)
  - [Deep Link 跳转外部 App](#deep-link-跳转外部-app)

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

> 和 RN 容器预热是同一个思路：提前创建实例 + 复用 + 预加载资源。

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **预热（实例池）** | App 启动时后台创建 WebView 放池里，用时直接取 | 省内核初始化 ~500ms |
| **复用** | 页面关闭不销毁 WebView，清空内容后放回池 | 第二次打开秒开 |
| **预加载 URL** | 提前 loadUrl 或 Service Worker 缓存 | 用户点击时页面已加载完 |
| **离线包** | H5 资源打入 App 本地，WebView 拦截请求从本地读 | 不依赖网络 |

原始表格保留：

| 手段 | 做什么 | 层 | 效果 |
|------|--------|---|------|
| 自定义进度条 | 隐藏 WebView 自带进度条，用自定义的 | RN 层 | 不重复闪烁 |
| 拦截重定向 | `onNavigationStateChange` 判断是否最终 URL | RN 层 | 进度条不重复 |
| 预加载 | 提前创建 WebView 实例 + 预加载 URL | RN 层 | 打开时秒出 |
| 骨架屏 | WebView 加载中显示骨架/loading | RN 层 | 不白屏 |
| 离线缓存 | 对自有 H5 做 Service Worker 缓存 | H5 层 | 二次打开秒出 |

### onNavigationStateChange 怎么用

**RN 层的 WebView 组件 prop**——每次 WebView 内部 URL 变化时回调，拿到当前 URL 和加载状态。

```typescript
<WebView
  source={{ uri: 'https://example.com/redirect-page' }}
  onNavigationStateChange={(navState) => {
    // navState.url — 当前 URL
    // navState.loading — 是否在加载

    // 只在最终 URL 时显示进度条（跳过中间重定向页）
    if (navState.url.includes('final-target.com')) {
      setShowProgress(navState.loading);
    }
  }}
/>
```

**能做到什么**：
- 判断当前是中间跳转页还是最终页 → 控制进度条只显示一次
- 拦截特定 URL（如 Deep Link scheme）→ 跳转到原生页面
- 监听页面加载完成 → 隐藏 loading

### Deep Link 跳转外部 App

**Deep Link 能跳转到目标 App 的任意页面**（店铺/商品/搜索），只要对方 App 注册了对应 URL Scheme。

```typescript
import { Linking } from 'react-native';

async function openInExternalApp(deepLink: string, fallbackUrl: string) {
  const canOpen = await Linking.canOpenURL(deepLink);
  if (canOpen) {
    await Linking.openURL(deepLink);  // 跳转到目标 App 指定页面
  } else {
    await Linking.openURL(fallbackUrl);  // 没装 → 跳浏览器
  }
}

// 示例：跳转到淘宝指定店铺
openInExternalApp(
  'taobao://shop.taobao.com/shop/view_shop.htm?shop_id=123456',  // 淘宝店铺
  'https://shop.taobao.com/shop/view_shop.htm?shop_id=123456'    // 兜底网页
);

// 示例：跳转到淘宝指定商品
openInExternalApp(
  'taobao://item.taobao.com/item.htm?id=789',
  'https://item.taobao.com/item.htm?id=789'
);
```

**前提**：目标 App 必须注册了对应 URL Scheme。淘宝/京东/抖音等主流 App 都有完善的 Deep Link 支持。

**Universal Link（兜底方案）**：用 HTTPS 链接，App 已安装就跳 App，没安装就跳浏览器——不需要知道对方的 URL Scheme。

```typescript
// WebView 自定义进度条
<WebView
  source={{ uri: url }}
  onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
  renderLoading={() => <ProgressBar progress={progress} />}
/>
```
