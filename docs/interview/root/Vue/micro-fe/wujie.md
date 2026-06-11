# 无界（Wujie）微前端

> 腾讯开源，基于 Web Components + iframe 的微前端方案。核心思路：用 iframe 做 JS 隔离，用 Web Components（Shadow DOM）做 CSS 隔离 + DOM 渲染。

---

## 本质

**解决什么**：qiankun 的 JS 沙箱（Proxy）不够彻底 + 样式隔离不够干净。Wujie 用 iframe 做天然 JS 隔离（独立 window），用 Shadow DOM 做天然样式隔离。

**一句话**：iframe 的隔离性 + SPA 的用户体验 = Wujie。

---

## 架构

```
主应用
├── <wujie-app> (Web Component，Shadow DOM)
│   └── 子应用的 DOM 渲染在这里（样式天然隔离）
│
└── 隐藏 iframe（子应用的 JS 执行环境）
    └── 子应用的 JS 在 iframe 里跑（window 天然隔离）
    └── DOM 操作通过 Proxy 劫持 → 映射到 Shadow DOM 里
```

**核心技巧**：子应用 JS 在 iframe 里执行，但 DOM 操作被代理到主应用的 Shadow DOM 里渲染。用户看到的是 SPA（无 iframe 白屏/闪烁），实际隔离是 iframe 级别。

**Proxy 代理实现原理**：

在 iframe 创建后、子应用代码执行前，**主应用（父层）**把 iframe 的 `document` 替换成 Proxy：

```
主应用创建同域空 iframe（about:blank）
  → 主应用通过 iframe.contentWindow 拿到 iframe 的 document
  → 用 Proxy 替换 document（重定向到 Shadow DOM）
  → 往 iframe 里注入子应用 JS
  → 子应用执行时读到的 document 已经是 Proxy 了
```

前提：iframe 必须**同域**（用 `about:blank` 或同域空页面），否则跨域拿不到 `contentWindow`。

```js
// 简化原理
// 主应用 HTML 里有个容器
// <div id="sub-app-container"></div> // 挂在dom, 下面创建一个shadowDom用来和主应用隔离样式
const hostElement = document.getElementById('sub-app-container')
const shadowRoot = hostElement.attachShadow({ mode: 'open' })
const iframeWindow = iframe.contentWindow

// 劫持 iframe 的 document → 所有 DOM 操作重定向到 shadowRoot
iframeWindow.document = new Proxy(iframeDocument, {
  get(target, prop) {
    if (prop === 'body') return shadowRoot
    if (prop === 'head') return shadowRoot
    if (prop === 'getElementById') {
      return (id) => shadowRoot.getElementById(id)
    }
    if (prop === 'querySelector') {
      return (sel) => shadowRoot.querySelector(sel)
    }
    return target[prop]
  }
})
```

**本质**：子应用 `document.xxx` 的所有调用被 Proxy 拦截后转到 `shadowRoot.xxx`。子应用完全不知道自己的 DOM 实际在 Shadow DOM 里。和 qiankun 劫持 `window` 是同一套路（Proxy），只不过 Wujie 劫持的是 `document`，JS 执行环境本身在 iframe 里（不需要再模拟 window 隔离）。

---

## 和 qiankun 对比

| 维度 | qiankun | Wujie |
|------|---------|-------|
| JS 隔离 | Proxy 沙箱（模拟，有逃逸风险） | iframe（天然独立 window，彻底） |
| CSS 隔离 | 动态 style 移除 / Shadow DOM（可选） | Shadow DOM（默认，天然） |
| 子应用加载 | fetch HTML → 解析执行 | iframe 加载 → DOM 代理到 Shadow DOM |
| 路由同步 | 劫持 history | iframe 路由 ↔ 主应用路由同步 |
| 性能 | 较好 | iframe 有额外开销（但可预加载） |
| 兼容性 | 好 | 需要 Web Components 支持（现代浏览器都支持） |
| 多实例 | 支持 | 支持（每个子应用一个 iframe） |
| 预加载 | `prefetchApps` | 预创建 iframe（更快） |

---

## 适用场景

| 选 Wujie | 选 qiankun |
|---------|-----------|
| 对隔离性要求极高（金融/支付） | 老项目迁移（qiankun 生态更成熟） |
| 子应用技术栈差异大（Vue2/React/Angular 混合） | 对 iframe 有顾虑（SEO/性能） |
| 需要多个子应用同时共存（非单例） | 子应用数量少、技术栈统一 |

---

## 常见问题

| 问题 | 原因 | 解法 |
|------|------|------|
| iframe 通信 | 跨 iframe 需要 postMessage | Wujie 内置了 props 传递 + EventBus |
| 路由不同步 | iframe 有自己的 history | Wujie 内部做了双向路由同步 |
| SEO 不友好 | iframe 内容搜索引擎不爬 | 微前端场景（内部系统）一般不需要 SEO |
| 首次加载慢 | iframe 创建有开销 | 预加载（`preload` 配置） |

---
