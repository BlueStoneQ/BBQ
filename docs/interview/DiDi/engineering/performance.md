# 性能工程化

> 解决什么问题：页面加载慢、交互卡顿、用户流失。性能不是"优化一次"，是持续度量 + 持续治理的工程体系。
>
> 本质：性能优化 = 建立指标 → 度量现状 → 定位瓶颈 → 优化手段 → 防劣化。不是零散的 trick，是可持续的治理体系。
>
> 场景：DD 运营 H5 页面（WebView 内加载）、MT 搭建系统产出的活动页、秒开率探针 SDK。

---

## 目录

- [核心指标](#核心指标)
- [度量体系（怎么采集）](#度量体系怎么采集)
- [优化手段（按加载阶段）](#优化手段按加载阶段)
- [WebView 场景优化](#webview-场景优化)
- [性能预算与防劣化](#性能预算与防劣化)
- [Q&A](#qa)

---

## 核心指标

| 指标 | 含义 | 好的标准 | 采集 API |
|------|------|---------|---------|
| **FCP** (First Contentful Paint) | 首次有内容渲染 | < 1.8s | PerformanceObserver |
| **LCP** (Largest Contentful Paint) | 最大内容渲染完成 | < 2.5s | PerformanceObserver |
| **FID** (First Input Delay) | 首次交互延迟 | < 100ms | PerformanceObserver |
| **INP** (Interaction to Next Paint) | 交互到下一帧渲染 | < 200ms | PerformanceObserver |
| **CLS** (Cumulative Layout Shift) | 累计布局偏移 | < 0.1 | PerformanceObserver |
| **TTI** (Time to Interactive) | 页面可交互时间 | < 3.8s | Lighthouse |
| **秒开率** | 页面 1s 内可见 | > 90% | 自研探针 |

**本质**：Core Web Vitals（LCP + INP + CLS）是 Google 定义的三个核心体验指标，覆盖"加载快 + 交互快 + 视觉稳"。

### PerformanceObserver 是什么

> 浏览器原生 API（W3C 标准），用来异步监听各类性能事件。不是自研的，是浏览器内置的。

```javascript
// 本质：注册一个回调，浏览器在性能事件发生时主动通知你
const observer = new PerformanceObserver((list) => {
  const entries = list.getEntries();  // 拿到性能数据
});
observer.observe({ type: '事件类型', buffered: true });
//                                    ↑ buffered: 拿到页面加载前已发生的事件
```

**能监听的事件类型（对应上面的指标）**：

| type 值 | 拿到什么 | 对应指标 |
|---------|---------|---------|
| `paint` | FP / FCP 时间 | FCP |
| `largest-contentful-paint` | LCP 元素 + 时间 | LCP |
| `first-input` | 首次交互延迟 | FID |
| `event` | 每次交互的延迟 | INP |
| `layout-shift` | 布局偏移分数 | CLS |
| `resource` | 每个资源的加载耗时 | 资源瀑布 |
| `longtask` | 超过 50ms 的长任务 | 卡顿检测 |

```javascript
// 采集 LCP 示例
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lcp = entries[entries.length - 1];  // 最后一个 = 最终 LCP
  console.log('LCP:', lcp.startTime, 'ms');
  console.log('LCP 元素:', lcp.element);    // 哪个 DOM 元素触发的
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

**大厂怎么用**：PerformanceObserver 采集原始数据 → 自研探针 SDK 封装（聚合 + 采样 + 上报 + 看板 + 告警）。浏览器提供数据源，自研的是"收集、传输、展示、告警"这套体系。

---

## 度量体系（怎么采集）

```
性能数据采集三种方式：

  1. 合成监控（Lab Data）
     - Lighthouse / WebPageTest
     - 固定环境跑分，可复现
     - 用于：开发阶段自测、CI 卡控

  2. 真实用户监控 RUM（Field Data）
     - 性能探针 SDK 嵌入页面
     - 真实用户设备/网络数据
     - 用于：线上指标大盘、告警

  3. 自定义打点
     - 业务关键节点手动打点（如"列表渲染完成"）
     - 用于：业务级秒开率

探针 SDK 核心逻辑：
  PerformanceObserver 监听 paint/lcp/fid/cls
  → 聚合为结构化数据
  → navigator.sendBeacon 上报（页面卸载时不丢）
  → 后端存储 + 看板展示 + 告警
```

---

## 优化手段（按加载阶段）

```
页面加载的生命周期：

  DNS → TCP → TLS → 请求 HTML → 解析 HTML → 加载 CSS/JS → 渲染 → 可交互
  │                              │                            │
  网络阶段                        资源加载阶段                  渲染阶段
```

### 网络阶段

| 手段 | 效果 | 原理 |
|------|------|------|
| CDN | 减少网络延迟 | 就近节点分发 |
| HTTP/2 | 多路复用，减少连接开销 | 一个连接并行请求 |
| 预连接 `preconnect` | 提前建立连接 | DNS + TCP + TLS 提前完成 |
| 预加载 `preload` | 提前加载关键资源 | 浏览器优先级提升 |

### 资源加载阶段

| 手段 | 效果 | 原理 |
|------|------|------|
| Code Splitting | 首屏只加载需要的 JS | 路由级 / 组件级拆分 |
| Tree Shaking | 删除未使用代码 | ES Module 静态分析 |
| 图片优化 | 减小图片体积 | WebP/AVIF + 响应式 + 懒加载 |
| 字体优化 | 避免 FOIT/FOUT | font-display: swap + 子集化 |
| 缓存策略 | 避免重复下载 | 强缓存（hash 文件名）+ 协商缓存 |

### 渲染阶段

| 手段 | 效果 | 原理 |
|------|------|------|
| SSR/SSG | 首屏 HTML 直出 | 服务端渲染，不等 JS 执行 |
| 骨架屏 | 感知速度提升 | 先展示结构占位 |
| 虚拟列表 | 长列表不卡 | 只渲染可视区域 DOM |
| 减少重排 | 渲染不抖动 | 批量 DOM 操作、will-change |
| React memo/useMemo | 减少无效渲染 | 跳过未变更组件的 re-render |

---

## WebView 场景优化

> DD 的 H5 页面大概率跑在 App 内的 WebView 中，有特殊优化空间。

```
WebView 加载链路（比浏览器多了几步）：

  用户点击 → 创建 WebView 实例（冷启动慢！）→ 初始化内核
  → DNS/TCP → 请求 HTML → 解析渲染 → 页面可见

优化空间：
  WebView 冷启动阶段（Native 侧）：
    1. WebView 预创建/复用池（App 启动时预热 WebView）
    2. 内核预加载（提前初始化渲染引擎）

  网络请求阶段：
    3. 离线包（HTML/JS/CSS 提前下载到本地，不走网络）
    4. 接口预请求（Native 拦截 URL → 提前发请求 → WebView 加载时直接用缓存）

  渲染阶段：
    5. SSR 直出（HTML 有内容，不等 JS 执行就能看到首屏）
    6. NSR（Native Side Rendering，Native 预渲染 HTML）

效果对比：
  无优化：白屏 2-3s
  WebView 预创建 + 离线包 + 接口预请求：秒开（< 1s）
```

### JSBridge（WebView 与 Native 通信）

```
H5 ↔ Native 通信方式：

  H5 → Native：
    URL Scheme 拦截（location.href = 'jsbridge://method?params'）
    注入全局对象（window.NativeBridge.call('method', params)）

  Native → H5：
    evaluateJavaScript('callback(data)')

  现代方案：
    WebView.postMessage / onMessage（双向通道）
```

---

## 性能预算与防劣化

```
问题：优化完了，下次迭代又变慢了（性能劣化）

解法：性能预算（Performance Budget）

  设定阈值：
    - JS bundle 总体积 < 200KB（gzip）
    - LCP < 2.5s
    - 首屏请求数 < 10

  CI 卡控：
    - 构建产物超标 → 阻断发布 / 需审批
    - Lighthouse 分数低于阈值 → 告警

  持续监控：
    - RUM 数据看板（每日 P50/P90/P99）
    - 性能劣化自动告警（指标连续 3 天恶化 → 通知 owner）

本质：性能不是一次性的事，是需要"预算 + 卡控 + 监控"持续守住的。
```

---

## Q&A

**Q：秒开率怎么定义和采集的？**

A：定义为"从页面开始加载到首屏可见内容渲染完成 ≤ 1s 的比例"。采集用 PerformanceObserver 监听 LCP 或自定义打点（业务关键元素出现时间），通过 sendBeacon 上报。

**Q：首屏优化你做了哪些？效果？**

A：（结合你的秒开率探针经验）探针采集 → 发现瓶颈（JS 体积大 / 接口串行 / 图片未优化）→ Code Splitting + 接口并行 + 图片 WebP + 骨架屏 → 秒开率从 10% 提升到 78%。

**Q：WebView 里白屏怎么排查？**

A：先区分阶段：是 WebView 初始化慢（Native 侧），还是资源加载慢（网络侧），还是 JS 执行报错（前端侧）。用 performance.timing 拆分各阶段耗时定位瓶颈。

**Q：性能优化和稳定性的关系？**

A：性能差到极端就是稳定性问题——白屏 5s 对用户来说等于"挂了"。共用监控体系，但优化目标不同：性能追求"快"，稳定性追求"不挂"。
