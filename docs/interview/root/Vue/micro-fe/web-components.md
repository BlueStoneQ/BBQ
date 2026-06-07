我来用第一性原理拆解 Web Components 作为微前端方案的底层本质。

---

## 第一性原理：我们在解决什么问题？

Web Components 微前端不是"发明新隔离机制"，而是**直接使用浏览器已有的原生隔离能力**：

> **浏览器本身就有组件封装标准（Custom Elements + Shadow DOM），为什么还要用 JS 模拟隔离？**

qiankun 用 Proxy 模拟沙箱、用 CSS 前缀模拟样式隔离——本质都是"在浏览器之上用 JS 补课"。Web Components 的思路是：**不补课，直接用浏览器的原生能力。**

---

## 拆解到原子层面：浏览器原生提供了什么？

Web Components 三件套（W3C 标准）：

| 能力 | 作用 | 对应微前端需求 |
|------|------|--------------|
| **Custom Elements** | 自定义 HTML 标签 | 子应用的入口（`<activity-app>`） |
| **Shadow DOM** | 封装的 DOM 子树，样式天然隔离 | CSS 隔离 |
| **HTML Templates** | 可复用的惰性 DOM 模板 | 子应用 DOM 结构 |

```javascript
// 浏览器原生能力，不需要任何框架
class ActivityApp extends HTMLElement {
  constructor() {
    super();
    // 创建 Shadow DOM — 样式天然隔离
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // 元素插入 DOM 时触发 — 相当于 mount
    this.shadowRoot.innerHTML = `
      <style>
        /* 这些样式只在 Shadow DOM 内生效，外部完全看不到 */
        .btn { color: red; }
        h1 { font-size: 24px; }
      </style>
      <div id="app">
        <h1>活动管理</h1>
        <button class="btn">创建活动</button>
      </div>
    `;
  }

  disconnectedCallback() {
    // 元素从 DOM 移除时触发 — 相当于 unmount
    this.shadowRoot.innerHTML = '';
  }
}

// 注册自定义元素
customElements.define('activity-app', ActivityApp);
```

```html
<!-- 使用：就像用普通 HTML 标签一样 -->
<activity-app></activity-app>
```

**本质**：Web Components = 浏览器原生的"组件容器"，Custom Elements 管生命周期，Shadow DOM 管隔离。

---

## Shadow DOM 隔离原理（第一性视角）

### 什么是 Shadow DOM？

```
普通 DOM 树：
┌────────────────────────────────────┐
│ <html>                             │
│   <body>                           │
│     <div id="app">                 │  ← 所有样式全局可见
│       <h1>主应用</h1>               │
│       <button class="btn">按钮</button>│
│     </div>                         │
│   </body>                          │
└────────────────────────────────────┘

带 Shadow DOM：
┌────────────────────────────────────┐
│ <html>                             │
│   <body>                           │
│     <div id="app">                 │
│       <h1>主应用</h1>               │
│       <activity-app>               │
│         #shadow-root (open)        │  ← Shadow Boundary
│         ┌──────────────────────┐   │
│         │ <style>.btn{red}</style>│  │  ← 样式被困在里面
│         │ <button class="btn"> │   │  ← DOM 被困在里面
│         └──────────────────────┘   │
│       </activity-app>              │
│     </div>                         │
│   </body>                          │
└────────────────────────────────────┘
```

**关键机制**：

```javascript
// Shadow DOM 的隔离是浏览器引擎级别的，不是 JS 模拟的

// 1. 样式隔离（双向）
//    外部 CSS 无法穿透进 Shadow DOM
//    Shadow DOM 内的 CSS 无法泄漏到外部
document.querySelector('.btn');  // 找不到 Shadow DOM 内的 .btn

// 2. DOM 隔离
//    document.querySelector 默认不会查询 Shadow DOM 内部
//    事件冒泡到 Shadow Boundary 时会被 retarget

// 3. 但不隔离 JS！
//    Shadow DOM 内的 JS 仍然和外部共享同一个 window
//    这是 Web Components 方案的"短板"
```

**本质**：Shadow DOM 提供**样式隔离 + DOM 隔离**，但**不提供 JS 隔离**。

---

## 用 Web Components 做微前端的两种路径

### 路径 1：纯 Web Components（micro-app 思路）

```javascript
// micro-app（京东）的简化原理
class MicroApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    const url = this.getAttribute('url');
    
    // 1. fetch 子应用 HTML
    const html = await fetch(url).then(r => r.text());
    
    // 2. 解析出 JS 和 CSS
    const { scripts, styles, template } = parseHTML(html);
    
    // 3. CSS 放入 Shadow DOM（天然隔离）
    const styleEl = document.createElement('style');
    styleEl.textContent = styles.join('\n');
    this.shadowRoot.appendChild(styleEl);
    
    // 4. DOM 放入 Shadow DOM
    this.shadowRoot.innerHTML += template;
    
    // 5. JS 执行（这里是难点——没有原生 JS 隔离）
    scripts.forEach(script => {
      // 直接 eval 或创建 script 标签执行
      // JS 仍然操作全局 window — 隔离弱
      const scriptEl = document.createElement('script');
      scriptEl.textContent = script;
      document.head.appendChild(scriptEl);
    });
  }

  disconnectedCallback() {
    this.shadowRoot.innerHTML = '';
  }
}

customElements.define('micro-app', MicroApp);
```

```html
<!-- 接入极其简单 -->
<micro-app name="activity" url="http://activity.example.com/"></micro-app>
```

**优点**：接入成本极低（一行标签）、样式天然隔离
**缺点**：JS 隔离弱（没有沙箱）

---

### 路径 2：iframe + Web Components（Wujie 思路）

这是最精妙的组合——取 iframe 的 JS 隔离 + 取 Shadow DOM 的样式隔离和体验：

```javascript
// Wujie（腾讯）的核心思路简化
class WujieApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    const url = this.getAttribute('url');
    
    // 1. 创建一个隐藏的 iframe（用于 JS 隔离）
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'about:blank';
    document.body.appendChild(iframe);
    
    // 2. 在 iframe 的 window 中执行子应用 JS
    //    子应用的 JS 以为自己在操作 window
    //    实际上操作的是 iframe.contentWindow（天然隔离）
    const iframeWindow = iframe.contentWindow;
    
    // 3. 但是！劫持 DOM 操作，让渲染发生在 Shadow DOM 里
    //    子应用调用 document.querySelector → 实际查询 Shadow DOM
    //    子应用调用 document.createElement → 创建的元素插入 Shadow DOM
    Object.defineProperty(iframeWindow, 'document', {
      get: () => this.shadowRoot  // 偷梁换柱！
    });
    
    // 4. 加载并执行子应用代码（在 iframe 环境中）
    const html = await fetch(url).then(r => r.text());
    const { scripts, styles } = parseHTML(html);
    
    // CSS 放入 Shadow DOM
    this.shadowRoot.innerHTML = `<style>${styles.join('\n')}</style>`;
    
    // JS 在 iframe 中执行，但 DOM 操作指向 Shadow DOM
    scripts.forEach(script => {
      iframeWindow.eval(script);
    });
  }
}
```

```
Wujie 的精妙之处：

┌─────────────────────────────────────────────┐
│  主文档                                      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  <wujie-app>                        │    │
│  │    #shadow-root                     │    │
│  │    ┌───────────────────────────┐    │    │
│  │    │  子应用的 DOM 渲染在这里    │    │    │  ← 用户看到的
│  │    │  样式隔离 ✅               │    │    │
│  │    │  体验好（在主文档流中）✅   │    │    │
│  │    └───────────────────────────┘    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌──────────────────────────┐               │
│  │  iframe (display:none)   │               │  ← 用户看不到
│  │  子应用 JS 在这里执行      │               │
│  │  独立 window ✅           │               │
│  │  JS 隔离 ✅              │               │
│  │  但 DOM 操作被劫持 →      │───────────►  Shadow DOM
│  └──────────────────────────┘               │
└─────────────────────────────────────────────┘

= JS 隔离用 iframe 的独立 window（浏览器原生）
= DOM 渲染用 Shadow DOM（浏览器原生）
= 两个原生能力的组合，不需要 Proxy 模拟
```

---

## 三种隔离策略的本质对比

| | qiankun | micro-app | Wujie |
|---|---|---|---|
| **JS 隔离** | Proxy 模拟（假 window） | 无 | iframe（真 window） |
| **CSS 隔离** | 选择器前缀（模拟） | Shadow DOM（原生） | Shadow DOM（原生） |
| **DOM 隔离** | 容器 div（弱） | Shadow DOM（原生） | Shadow DOM（原生） |
| **隔离强度** | 中（模拟有边界情况） | 弱（无 JS 隔离） | 强（双原生） |
| **体验** | 好 | 好 | 好 |
| **接入成本** | 中（改生命周期） | 低（一行标签） | 中 |

---

## Web Components 方案的局限性

### 1. Shadow DOM 的"围墙"问题

```javascript
// 问题：某些 UI 库（Ant Design、Element Plus）动态创建的 DOM 会挂到 document.body
// 比如：Modal、Dropdown、Tooltip 用 Teleport/Portal 渲染到 body

// 子应用内：
Modal.show();  // 实际创建的 DOM 在 document.body 上，不在 Shadow DOM 内
               // → 样式丢失（因为 Shadow DOM 内的 CSS 管不到外面）

// 解决方案：
// 1. 劫持 document.body.appendChild，重定向到 Shadow DOM
// 2. UI 库配置 getPopupContainer 指向 Shadow Root
// 3. 使用 CSS Custom Properties（可穿透 Shadow Boundary）
```

### 2. JS 隔离的缺失（纯 Web Components 方案）

```
Shadow DOM 只隔离样式和 DOM，不隔离 JS：
  子应用 A：window.axios = myAxios;  → 全局污染
  子应用 B：window.axios  → 拿到 A 的 axios

= 纯 Web Components 方案需要搭配其他 JS 隔离手段
= 这就是为什么 Wujie 要加 iframe
```

### 3. 事件冒泡的 retarget

```javascript
// Shadow DOM 内的事件冒泡到外部时，event.target 会被重置为宿主元素
// 而不是 Shadow DOM 内的实际元素

shadowRoot.querySelector('button').addEventListener('click', (e) => {
  console.log(e.target);  // <button>  ← 在 Shadow DOM 内部正常
});

document.addEventListener('click', (e) => {
  console.log(e.target);  // <activity-app>  ← 被 retarget 了！
  // 外部看不到 Shadow DOM 内部的元素
});

// 影响：某些依赖事件委托的库可能受影响
```

---

## 什么时候选 Web Components 方案

| 场景 | 选择 | 原因 |
|------|------|------|
| 追求接入简单、快速集成 | micro-app | 一行标签搞定 |
| 对隔离要求极高 + 子应用不可信 | Wujie | iframe + Shadow DOM 双原生隔离 |
| 组件级嵌入（不是整个应用） | 原生 Web Components | 最轻量 |
| 跨框架组件复用 | Web Components 封装 | 框架无关的标准 |
| 已有成熟项目、社区支持优先 | qiankun | 生态最大 |

---

## 一句话总结

> **Web Components 微前端的底层原理 = 利用浏览器原生的 Custom Elements 管理生命周期 + Shadow DOM 实现样式/DOM 隔离，避免了 JS 模拟隔离的复杂度和边界问题。其短板在 JS 隔离——纯 Shadow DOM 不隔离 JS，需要搭配 iframe（Wujie）或 Proxy（qiankun）补齐。**

它不是"更好的微前端方案"，而是**用浏览器标准能力替代 JS polyfill**的思路——能用原生的就不模拟。
