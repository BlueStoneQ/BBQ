# H5 运营页面

> 本质：在 App WebView 内运行的轻量页面——活动页、落地页、运营配置页。核心关注：秒开、稳定、可度量。
>
> 场景：DD 网约车运营方向的 H5 活动页（优惠券、红包、增长活动），跑在 App WebView 中。

> 相关文档：
> - [H5 移动端常见问题](./common-issues.md)（1px / 适配 / 键盘 / 安全区域）
> - [性能工程化（通用）](../engineering/performance.md)
> - [稳定性建设（通用）](../engineering/stability.md)

---

## 目录

- [H5 在 WebView 中的加载链路](#h5-在-webview-中的加载链路)
- [性能优化（秒开）](#性能优化秒开)
- [WebView 通信（JSBridge）](#webview-通信jsbridge)
- [稳定性（白屏检测 + 降级）](#稳定性白屏检测--降级)
- [监控与度量](#监控与度量)
- [低代码搭建（活动页生产方式）](#低代码搭建活动页生产方式)
- [Q&A](#qa)

---

## H5 在 WebView 中的加载链路

> 相关：[H5 移动端常见问题](./common-issues.md)（1px / 适配 / 键盘 / 安全区域等 WebView 特有坑）

```
用户点击入口（App 内）
  → Native 创建 WebView 实例（冷启动耗时！）
  → WebView 内核初始化
  → DNS 解析 → TCP 连接 → TLS 握手
  → 请求 HTML → 解析 HTML
  → 加载 CSS/JS 资源
  → JS 执行 → 框架渲染
  → 页面可见（FCP）
  → 页面可交互（TTI）

每一步都是优化空间。
```

---

## 性能优化（秒开）

> 深入阅读：[性能工程化（通用体系）](../engineering/performance.md)

### Native 侧优化（WebView 容器）

| 手段 | 原理 | 效果 |
|------|------|------|
| WebView 预创建/复用池 | App 启动时预热 WebView 实例 | 省去冷启动 300-500ms |
| 内核预加载 | 提前初始化渲染引擎 | 省去内核初始化时间 |
| 离线包 | HTML/JS/CSS 提前下载到本地 | 省去网络请求（秒开核心） |
| 接口预请求 | Native 拦截 URL，提前并行发数据请求 | 页面加载和数据请求并行 |

### 前端侧优化

| 手段 | 原理 | 效果 |
|------|------|------|
| SSR/SSG 直出 | HTML 带首屏内容，不等 JS 执行 | FCP 提前 |
| 骨架屏 | 先展示结构占位 | 感知速度提升 |
| Code Splitting | 首屏只加载需要的 JS | 减小首屏资源体积 |
| 图片优化 | WebP + 懒加载 + CDN 裁剪 | 减少图片加载时间 |
| 关键 CSS 内联 | 首屏 CSS 放在 HTML `<head>` 内 | 避免 CSS 阻塞渲染 |
| preconnect/preload | 提前建立连接、加载关键资源 | 缩短等待时间 |

### 效果公式

```
无优化：白屏 2-3s
WebView 预创建 + 离线包 + 接口预请求 + 骨架屏：秒开（< 1s）
```

---

## WebView 通信（JSBridge）

```
H5 ↔ Native 通信方式：

  H5 → Native：
    1. URL Scheme 拦截：location.href = 'jsbridge://method?params=xxx'
       → Native WebView 拦截 URL → 解析 method + params → 执行
    2. 注入全局对象：window.NativeBridge.call('method', params, callback)
       → Native 注入 JS 对象到 window → H5 直接调用

  Native → H5：
    evaluateJavaScript('callbackFn(data)')
    → Native 直接在 WebView 中执行 JS 代码

  现代方案：
    WebView.postMessage / onMessage（双向消息通道）

典型使用场景：
  - 获取用户登录态（token）
  - 调用 Native 能力（定位、相机、分享）
  - 页面跳转（打开新页面、返回上一页）
  - 设置导航栏标题/按钮
```

---

## 稳定性（白屏检测 + 降级）

> 深入阅读：[稳定性建设（通用体系）](../engineering/stability.md) | [白屏检测（专题）](../engineering/blank-screen-detection.md)

```
H5 页面常见稳定性问题：
  - JS 报错 → 页面白屏
  - 资源加载失败（CDN 挂了）→ 样式丢失或功能异常
  - 接口超时 → 数据空白
  - WebView 容器崩溃 → 整个页面没了

保障手段：
  1. 白屏检测：页面加载后检测 #root 子节点数，为 0 → 上报 + 自动刷新（最多 1 次）
  2. 资源降级：CDN 主域名失败 → 备份域名
  3. 接口降级：超时 → 展示缓存数据 / 兜底 UI
  4. ErrorBoundary：组件级错误隔离，局部挂不影响全页
  5. 离线包兜底：即使网络断了，离线包内的页面仍可展示
```

---

## 监控与度量

| 指标 | 含义 | 采集方式 |
|------|------|---------|
| 秒开率 | 1s 内可见的 PV 占比 | 自研探针 SDK（PerformanceObserver + 自定义打点） |
| 白屏率 | 白屏 PV / 总 PV | DOM 检测 + 上报 |
| JS 错误率 | 有错误的 PV / 总 PV | window.onerror + unhandledrejection |
| 接口成功率 | 成功请求 / 总请求 | fetch/XHR 拦截 |
| 资源加载失败率 | 加载失败的资源数 / 总资源数 | error 事件监听 |

```
上报方式：
  正常打点：new Image().src = url（简单不跨域）
  页面卸载时：navigator.sendBeacon（保证不丢）
  大数据量：fetch POST（批量上报）
```

---

## 低代码搭建（活动页生产方式）

```
运营活动页的生产方式演进：

  阶段 1：开发手写 → 效率低，排期等开发
  阶段 2：模板化 → 选模板填内容，覆盖面有限
  阶段 3：低代码搭建 → 拖拽组件 + 配置属性 → 运营自助发布
  阶段 4：AI 生成 → 描述需求 → AI Agent 自动搭建

搭建系统核心架构：
  编辑器（拖拽画布 + 属性面板）
    → 产出 DSL（JSON 描述页面结构）
    → 渲染引擎（将 DSL 渲染为真实页面）
    → 发布系统（CDN 部署 + 版本管理）

关键能力：
  - 组件物料库（按钮、轮播、表单、弹窗...）
  - 数据源配置（接口绑定）
  - 事件交互（点击跳转、条件显隐）
  - 预览 → 审批 → 一键发布
```

---

## Q&A

**Q：H5 秒开怎么做到的？**

A：核心是离线包 + WebView 预创建 + 接口预请求。离线包让 HTML/JS/CSS 本地加载（不走网络），WebView 预创建省去容器冷启动，接口预请求让数据和页面并行加载。三者组合可以做到 < 1s 可见。

**Q：离线包怎么更新？**

A：App 启动时后台静默检查版本 → 增量下载新包 → 下次打开 H5 用新版。紧急更新可推送强制更新。离线包本质是"把 CDN 搬到本地"。

**Q：JSBridge 的原理？**

A：H5 调 Native 通过 URL Scheme 拦截或 Native 注入到 window 的全局对象；Native 调 H5 通过 evaluateJavaScript 执行回调函数。本质是约定通信协议。

**Q：白屏怎么检测和处理？**

A：页面加载完成后检测根节点子元素数量，为 0 判定白屏 → 上报监控 + 尝试自动刷新一次（防死循环只刷一次）。同时 ErrorBoundary 做组件级兜底。

**Q：搭建系统你怎么做的？**

A：（对应你 MT 的经验）编辑器 + 物料库 + DSL + 渲染引擎 + CLI + CI/CD。核心提效数据：活动创建从 0.5 人天降到 15 秒，物料调试从 1min47s 降到 10s。
