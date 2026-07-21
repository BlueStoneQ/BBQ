# H5 性能优化全景

> H5 在 App 内的性能 = JS Bridge 通信效率 + WebView 容器优化 + H5 本身优化 + 可观测闭环。
> 不是单点优化，是四个层面协同。

## 目录

- [一、JS Bridge 高性能设计](#一js-bridge-高性能设计)
- [二、WebView 容器定制](#二webview-容器定制)
- [三、H5 本身优化](#三h5-本身优化)
- [四、可观测（H5 层探针）](#四可观测h5-层探针)
- [五、关联文档](#五关联文档)

---

## 一、JS Bridge 高性能设计

> 详细实现 → [js-bridge-2.md](./js-bridge-2.md) / [qa-js-bridge.md](./qa-js-bridge.md)

### 核心原则

```
通道选型：注入 API > prompt 拦截 > URL Scheme
协议设计：精简字段 + 只传必要数据
调用模式：同步优先（Android）+ 批处理 + 缓存
```

### 五项优化

| # | 优化点 | 具体做法 | 收益 |
|---|--------|---------|------|
| 1 | **通道选型** | Android: `@JavascriptInterface`（同步直调）<br>iOS: `messageHandlers`（异步但最快） | 避免 iframe 创建开销 |
| 2 | **协议精简** | 短字段名 + 只传 diff 数据 + 二进制走 ArrayBuffer | 减少 JSON 序列化体积 |
| 3 | **批处理** | 16ms 内多次调用合并一次发送 | 减少跨层通信次数 |
| 4 | **同步方法** | 高频只读调用同步返回（getToken/getDeviceInfo） | 避免异步回调链 |
| 5 | **结果缓存** | JS 侧缓存不变数据，TTL 过期重新获取 | 减少重复通信 |

### 批处理实现

> **公式：批处理 = 任务队列（收集调用）+ 微任务注册器（触发 flush）**
>
> 和 Vue 响应式更新同一模式：Vue 数据变更入队 → nextTick 微任务触发 → 批量 DOM 更新；Bridge 调用入队 → nextTick 微任务触发 → 批量发送 Native。
>
> 兼容封装：`queueMicrotask` > `Promise.resolve().then` > `MutationObserver` > `setTimeout`（和 Vue nextTick 同一降级链）

- JS侧:

```javascript
// 微任务注册器（降级封装）
const nextTick = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

class BridgeBatcher {
  queue = [];
  scheduled = false;

  call(module, method, params) {
    return new Promise((resolve) => {
      this.queue.push({ module, method, params, resolve });
      if (!this.scheduled) {
        this.scheduled = true;
        nextTick(() => this.flush()); // 注册任务到微任务队列执行,避免阻塞当前tick和渲染
    });
  }

  flush() {
    const batch = this.queue.splice(0);
    this.scheduled = false;
    // 一次通信发送所有请求
    nativeBridge.batchInvoke(JSON.stringify(batch.map(b => ({
      m: b.module, f: b.method, p: b.params
    }))));
  }
}
```

---

## 二、WebView 容器定制

> 详细实现 → [qa-webview.md](./qa-webview.md)

### 核心手段（按收益排序）

| 优化 | 收益 | 实现 |
|------|------|------|
| **WebView 预创建（池化）** | 省 200-500ms | App 启动时闲时创建 2 个 WebView 实例 |
| **并行加载** | 省 200-400ms | WebView 初始化同时 Native 预请求数据 |
| **离线包** | 省 100-500ms | H5 资源打包本地，拦截请求返回本地文件 |
| **DNS 预解析 + 连接预建立** | 省 50-200ms | 预热常用域名 |
| **共享进程池（iOS）** | 省 Cookie 同步开销 | 所有 WKWebView 共享 WKProcessPool |

### 容器架构

```
┌─────────────────────────────────────────────────┐
│ 定制 WebView 容器                                │
├─────────────────────────────────────────────────┤
│ WebView 池 │ 离线包管理 │ 统一 Bridge │ 安全管控 │
│ 预创建复用 │ 资源拦截   │ 权限白名单 │ 域名校验 │
├─────────────────────────────────────────────────┤
│ 系统 WebView（Android Chromium / iOS WebKit）    │
└─────────────────────────────────────────────────┘
```

---

## 三、H5 本身优化

### 加载链路优化

| 阶段 | 优化手段 |
|------|---------|
| **HTML** | 骨架屏内联 + SSR/首屏直出 + 压缩 |
| **CSS** | 关键 CSS 内联 + 非首屏异步加载 |
| **JS** | 首屏必要 JS 内联 + 非首屏 defer + Code Splitting |
| **图片** | 懒加载 + WebP/AVIF + CDN 裁剪 + 预加载关键图 |
| **字体** | font-display: swap + 预加载 |
| **接口** | Native 预请求 + 接口聚合 + 缓存策略 |

### 运行时优化

| 问题 | 优化 |
|------|------|
| 长任务阻塞 | requestIdleCallback 分片 / Web Worker |
| 频繁 DOM 操作 | 虚拟列表 / DocumentFragment 批量更新 |
| 内存泄漏 | 页面卸载清理监听 / WeakRef |
| 动画卡顿 | CSS transform + will-change / requestAnimationFrame |

### 缓存策略

```
优先级：离线包 > Service Worker > HTTP 强缓存 > 协商缓存 > 网络请求

离线包：整包更新，版本号控制
Service Worker：细粒度缓存，支持离线
HTTP Cache：Cache-Control: max-age + ETag
```

---

## 四、可观测（H5 层探针）

> 关联 → [card1:observer](../card1:observer/README.md)

### 核心指标

| 指标 | 采集方式 | 目标 |
|------|---------|------|
| **FCP（首次内容绘制）** | Performance API | < 1s |
| **LCP（最大内容绘制）** | PerformanceObserver | < 2.5s |
| **CLS（布局偏移）** | PerformanceObserver | < 0.1 |
| **TTI（可交互时间）** | 自定义埋点 | < 3s |
| **JS Error 率** | window.onerror + unhandledrejection | < 0.1% |
| **白屏率** | MutationObserver + 定时检测 | < 0.5% |
| **Bridge 调用耗时** | 自定义埋点（调用前后打点） | P95 < 50ms |

### 上报通道

```
H5 探针采集
  → 通过 JS Bridge 传给 Native（借用 Native 的上报通道）
  → 好处：离线缓存 + 批量压缩 + 省电 + 统一后端

为什么不直接 HTTP 上报？
  - WebView 页面生命周期短，可能还没上报页面就关了
  - Native 通道有离线缓存，弱网不丢数据
  - 统一上报通道，后端一套解析逻辑
```

### 白屏检测

```javascript
// 页面加载后 3s 检测是否白屏
setTimeout(() => {
  const root = document.getElementById('app');
  if (!root || root.children.length === 0 || root.innerHTML.trim() === '') {
    // 白屏！上报 + 自动重试
    bridge.report('whitescreen', { url: location.href });
    location.reload(); // 或加载兜底页
  }
}, 3000);
```

---

## 五、关联文档

| 方向 | 文档 | 关联点 |
|------|------|--------|
| JS Bridge 三段式设计 | [js-bridge-2.md](./js-bridge-2.md) | 通信通道实现细节 |
| WebView 容器优化 | [qa-webview.md](./qa-webview.md) | 池化/离线包/预加载 |
| 可观测体系 | [card1:observer](../card1:observer/README.md) | H5 探针 + 上报 + 看板 |
| Native Shell | [XRN native-shell](../../../root/XRN/native-shell.md) | WebView 容器由 Shell 管理 |
| 热更新（H5 CDN 灰度） | [card2 HMR](../card2:engineering/HMR.md) | H5 发布走 CDN 灰度 |

---

## 面试叙述

> "H5 在 App 内的性能优化不是单点问题，我把它拆成四层：第一层 Bridge 通信效率——注入 API 直调 + 批处理 + 缓存；第二层 WebView 容器——池化预创建省 300ms + 离线包省网络耗时；第三层 H5 本身——SSR + 关键资源内联 + Code Splitting；第四层可观测——FCP/LCP 探针通过 Bridge 走 Native 通道上报，白屏检测 + 自动重试。四层协同，秒开率从 10% 做到 78%。"
