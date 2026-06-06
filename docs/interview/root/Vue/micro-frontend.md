# 微前端

> 解决什么问题：一个大型后台系统，多个团队开发不同模块，怎么做到独立开发/独立部署/独立运行，又能聚合成一个统一的应用？
>
> 本质：把一个巨石应用拆成多个独立子应用，每个子应用独立仓库、独立构建、独立部署，通过主应用（基座）聚合在一起。
>
> 场景：DD 运营平台（多团队/多业务模块聚合）、MT 打车后台。

---

## 目录

- [为什么需要微前端](#为什么需要微前端)
- [核心概念](#核心概念)
- [主流方案对比](#主流方案对比)
- [qiankun 方案详解](#qiankun-方案详解)
- [Module Federation 方案](#module-federation-方案)
- [子应用通信](#子应用通信)
- [样式隔离](#样式隔离)
- [JS 沙箱](#js-沙箱)
- [路由设计](#路由设计)
- [部署方案](#部署方案)
- [什么时候不该用微前端](#什么时候不该用微前端)
- [和 RN 多 Bundle 的类比](#和-rn-多-bundle-的类比)
- [高频问题](#高频问题)

---

## 为什么需要微前端

```
巨石应用的问题（运营平台越做越大）：
  - 多团队协作困难（代码冲突/发布互相阻塞）
  - 构建慢（10 分钟+）
  - 技术栈锁定（想升级 Vue 3 但老模块全是 Vue 2）
  - 一个模块出 bug 全站挂
  - 新人上手成本高（整个代码库太大）

微前端解决：
  每个业务模块 = 独立子应用
  → 独立仓库、独立构建（30s）、独立部署
  → 不同技术栈可以共存（Vue 2 / Vue 3 / React）
  → 一个子应用挂了不影响其他
  → 团队边界清晰
```

### 和 DDD + Monorepo 的关系

```
微前端的拆分边界 = DDD 的限界上下文（Bounded Context）

运营平台按业务域拆子应用：
  活动域 → activity-app
  策略域 → strategy-app
  数据域 → dashboard-app
  用户域 → user-app

每个子应用 = 一个业务域 = DDD 中的一个限界上下文
```

**推荐用 Monorepo 管理**（pnpm workspace / Turborepo）：

```
monorepo/
├── apps/
│   ├── main-app/       # 主应用（基座）
│   ├── activity-app/   # 子应用：活动域
│   ├── strategy-app/   # 子应用：策略域
│   └── dashboard-app/  # 子应用：数据域
├── packages/
│   ├── shared-ui/      # 共享组件库
│   ├── shared-utils/   # 共享工具
│   └── shared-types/   # 共享类型定义
├── pnpm-workspace.yaml
└── turbo.json
```

**Monorepo 的好处**：
- 共享代码方便（shared-ui/shared-types 直接引用，不用发 npm 包）
- 统一 lint/build/test 配置
- 原子提交（跨子应用的改动一次 commit）
- 但子应用仍然独立构建/独立部署（Turborepo 增量构建）

**和 RN 多 Bundle 的 Monorepo 一样**——你在 XRN 中也是这个结构（apps/ + packages/），方法论直接复用。

---

## 核心概念

```
主应用（基座）：
  - 负责：路由分发、子应用加载/卸载、全局状态、公共 UI（Header/Sidebar/Auth）
  - 不含业务逻辑

子应用：
  - 独立的 SPA（有自己的路由、状态、构建）
  - 可以独立运行（开发时直接跑）
  - 也可以被主应用加载运行

生命周期：
  bootstrap → mount → unmount
  主应用在路由切换时调用子应用的生命周期钩子
```

---

## 主流方案对比

| 方案 | 原理 | 适合 | 缺点 |
|------|------|------|------|
| **qiankun**（蚂蚁） | 基于 single-spa + JS 沙箱 + 样式隔离 | 已有巨石应用拆分 | 有一定接入成本 |
| **Module Federation**（Webpack 5） | 运行时共享模块（远程加载 JS） | 模块级别共享（不是整个 App） | 强依赖 Webpack 5 |
| **iframe** | 天然隔离 | 隔离要求极高/遗留系统 | 体验差（通信难/UI 割裂） |
| **Web Components** | 自定义元素 + Shadow DOM | 组件级嵌入 | 生态不成熟 |
| **Wujie**（腾讯） | iframe + Web Components 混合 | 极致隔离 + 好体验 | 较新，社区小 |

**2026 年推荐**：
- 已有巨石拆分 → qiankun（生态最成熟）
- 新项目/模块共享 → Module Federation
- 极端隔离需求 → Wujie

---

## qiankun 方案详解

### 第一性原理

**本质：在同一个页面中，安全地加载并运行另一个独立应用的代码。**

```
qiankun = 加载器 + 沙箱 + 生命周期

  ① 加载器 — "怎么把子应用代码拿过来"
  ② 沙箱   — "怎么让子应用以为自己独占环境"
  ③ 生命周期 — "什么时候启动/销毁子应用"

类比操作系统：
  加载器 ≈ 进程加载器
  沙箱   ≈ 虚拟内存（进程隔离）
  生命周期 ≈ 进程调度（启动/退出）
```

### 核心原理（源码级）

**Step 1：加载 — fetch HTML 字符串 + 解析**

```js
// fetch 子应用 index.html（当文本处理，不是页面跳转）
const html = await fetch('http://sub-app.com/index.html').then(r => r.text());

// 正则/DOM Parser 解析出：
// - <link> → CSS URL → 再 fetch CSS 内容 → 动态插入 <style>
// - <script src="app.js"> → JS URL → 再 fetch JS 内容
// - <script>inline code</script> → 直接拿 inline 代码
// - HTML template → 子应用的 DOM 结构

// CSS 处理：fetch → 加前缀 → 创建 <style> 插入 → unmount 时移除
const cssText = await fetch(cssUrl).then(r => r.text());

// 如果开了 scoped 隔离：用 CSSStyleSheet API 给每个选择器加前缀
// 不是正则（正则处理不了嵌套/@keyframes 等），是浏览器 CSS 引擎解析
const sheet = new CSSStyleSheet();
sheet.replaceSync(cssText);
for (const rule of sheet.cssRules) {
  // ".btn" → "div[data-qiankun='activity-app'] .btn"
  rule.selectorText = `div[data-qiankun="${appName}"] ${rule.selectorText}`;
}

// 插入处理后的 CSS
const style = document.createElement('style');
style.textContent = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
container.appendChild(style);  // mount 时插入
// unmount 时 style.remove()
```

**为什么 Vue 动态渲染的 DOM 也能匹配？**

```
关键认知：CSS 和 DOM 是两个独立的东西。

Vue 子应用构建产物：
  sub-app.css → 包含所有组件的样式规则（.btn / .card / .modal 全在里面）
  sub-app.js  → 包含所有组件的渲染逻辑（动态创建 DOM）

= CSS 是"构建时全量打包"的，不管对应的 DOM 是静态还是动态渲染

qiankun 加载时：
  1. fetch sub-app.css → 全量 CSS 文本
  2. 加前缀 → div[data-qiankun="app1"] .btn { color: red }
  3. 插入 <style> → 规则已经在页面上了（此时 DOM 可能还没渲染）

Vue 运行时：
  4. JS 执行 → Vue 动态创建 <button class="btn"> → 插入到容器内
  5. CSS 自动匹配（CSS 选择器是实时匹配的，不是"只在插入时匹配一次"）

= CSS 规则先就位，DOM 后出现也能匹配
= 加前缀只需要处理 CSS 规则（一次性），不需要处理每个 DOM 元素
```

```
子应用的 DOM 渲染在主应用的"容器"里，容器就是一个带标识的普通 div：

主应用 HTML：
┌─────────────────────────────────────────────────────────┐
│ <div id="app">                                          │  ← 主应用
│   <header>...</header>                                  │
│   <aside>侧边栏</aside>                                 │
│                                                         │
│   <div id="subapp-container"                            │  ← 容器（注册时指定）
│        data-qiankun="activity-app">                     │     qiankun 自动加 data 属性
│     ┌─────────────────────────────────┐                 │
│     │  子应用的 DOM 渲染在这里面        │                 │
│     │  <div id="app">                 │                 │
│     │    <button class="btn">点击</button>│              │
│     │  </div>                          │                 │
│     └─────────────────────────────────┘                 │
│   </div>                                                │
│ </div>                                                  │
└─────────────────────────────────────────────────────────┘

CSS 加前缀后：
  原始：.btn { color: red }
  处理后：div[data-qiankun="activity-app"] .btn { color: red }
  
  选择器从外往内匹配：
    找到 div[data-qiankun="activity-app"] ✓（容器）
    → 找它内部的 .btn ✓（子应用的按钮）
    → 命中！样式生效

  而主应用的 .btn 不在这个容器内 → 不命中 → 不受影响

= 子应用无需改任何代码，qiankun 运行时自动加前缀 + 限制作用范围
```
```

**Step 2：执行 — new Function + with + Proxy**

```js
// qiankun 怎么在沙箱中执行子应用 JS：

// 1. 创建 fakeWindow（Proxy 代理）
const fakeWindow = new Proxy(rawWindow, {
  get(target, key) {
    if (key in overrides) return overrides[key];  // 子应用写过的变量
    return rawWindow[key];  // 兜底到真 window
  },
  set(target, key, value) {
    overrides[key] = value;  // 写入隔离空间，不污染真 window
    return true;
  }
});

// 2. 用 with + new Function 执行子应用代码
// with 的作用：让代码中的"裸变量"（不带 window. 前缀）也走 Proxy 拦截
const executableCode = `
  ;(function(window, self, globalThis) {
    with(window) {
      ${scriptText}
    }
  }).bind(fakeWindow)(fakeWindow, fakeWindow, fakeWindow)
`;
eval(executableCode);  // 或 new Function 执行
```

**为什么需要 with？**

```js
// 没有 with：
location.href;  // 直接访问真 window.location，绕过了沙箱！

// 有 with(fakeWindow)：
with(fakeWindow) {
  location.href;  // JS 先从 fakeWindow 上找 location → 走 Proxy get → 被拦截
}
```

**为什么用 new Function 不用 eval？** `new Function` 不访问外层闭包变量，更安全且性能更好。

**Step 3：生命周期调度**

```js
// 子应用 JS 执行后，导出了生命周期钩子
const { bootstrap, mount, unmount } = fakeWindow.__MICRO_APP_EXPORTS__;

// 路由匹配时 → mount
await mount({ container: document.querySelector('#subapp-container') });

// 路由离开时 → unmount
await unmount();
```

### 执行链路总结

```
路由变化 → 匹配子应用
  → fetch index.html（字符串）
  → 解析出 JS/CSS URL → fetch JS 内容
  → 创建 Proxy fakeWindow
  → with(fakeWindow) { 子应用 JS } → 执行
  → 子应用导出 mount() → 调用 mount → 渲染到容器
  → 路由离开 → unmount → 清理 fakeWindow
```

### 主应用配置

```
主应用：
  1. 注册子应用（名称 + 匹配路由 + 入口 URL）
  2. 路由变化时 → 匹配到子应用 → fetch 子应用 HTML
  3. 解析 HTML → 提取 JS/CSS
  4. 创建 JS 沙箱 → 执行子应用 JS
  5. 调用子应用 mount() → 渲染到指定 DOM 容器

子应用：
  1. 导出生命周期钩子（bootstrap/mount/unmount）
  2. mount 时渲染到主应用给的容器里
  3. unmount 时清理
```

### 主应用配置

```ts
// 主应用 main.ts
import { registerMicroApps, start } from 'qiankun';

registerMicroApps([
  {
    name: 'activity-app',        // 子应用名
    entry: '//localhost:8081',   // 子应用入口（独立部署的 URL）
    container: '#subapp-container',  // 挂载到哪个 DOM
    activeRule: '/activity',    // 路由匹配规则
  },
  {
    name: 'strategy-app',
    entry: '//localhost:8082',
    container: '#subapp-container',
    activeRule: '/strategy',
  },
]);

start();
```

### 子应用改造（Vue 3）

```ts
// 子应用 main.ts
import { createApp } from 'vue';
import App from './App.vue';

let app: ReturnType<typeof createApp>;

// 导出生命周期
export async function bootstrap() { /* 初始化 */ }

export async function mount(props: any) {
  app = createApp(App);
  app.mount(props.container?.querySelector('#app') || '#app');
}

export async function unmount() {
  app.unmount();
}

// 独立运行时（不在主应用内）
if (!(window as any).__POWERED_BY_QIANKUN__) {
  mount({});
}
```

---

## Module Federation 方案

```
原理：Webpack 5 内置，让多个独立构建的应用在运行时共享模块。

不是"加载整个子应用"，而是"从远程应用中加载某个模块/组件"。
```

```ts
// 应用 A 暴露组件
// webpack.config.js
new ModuleFederationPlugin({
  name: 'activityApp',
  filename: 'remoteEntry.js',
  exposes: {
    './ActivityList': './src/components/ActivityList.vue',
  },
  shared: ['vue', 'pinia'],  // 共享依赖（不重复加载）
});

// 应用 B 使用远程组件
new ModuleFederationPlugin({
  name: 'mainApp',
  remotes: {
    activityApp: 'activityApp@http://cdn.com/activityApp/remoteEntry.js',
  },
  shared: ['vue', 'pinia'],
});

// 应用 B 中使用
const ActivityList = defineAsyncComponent(() => import('activityApp/ActivityList'));
```

### qiankun vs Module Federation

| | qiankun | Module Federation |
|---|---|---|
| 粒度 | 整个子应用 | 模块/组件级别 |
| 隔离 | JS 沙箱 + 样式隔离 | 无隔离（共享运行时） |
| 独立部署 | 子应用完全独立 | 模块可独立部署 |
| 适合 | 多团队/多应用聚合 | 组件/模块共享 |
| 技术栈混用 | 支持（Vue/React 混合） | 需要共享框架 |

---

## 子应用通信

| 方式 | 适合 | 原理 |
|------|------|------|
| Props 传递 | 父传子（主→子） | 主应用 mount 时传 props |
| 全局状态（qiankun initGlobalState） | 双向通信 | 发布订阅模式 |
| CustomEvent | 松耦合通信 | 浏览器原生事件 |
| URL 参数 | 简单数据 | 路由 query/hash |
| 共享状态库 | 深度共享 | 同一个 Pinia/Redux 实例（Module Federation） |

```ts
// qiankun 全局状态
// 主应用
import { initGlobalState } from 'qiankun';
const actions = initGlobalState({ user: null, token: '' });
actions.onGlobalStateChange((state) => { console.log(state); });
actions.setGlobalState({ user: { name: 'Tom' } });

// 子应用（通过 props 接收）
export async function mount(props) {
  props.onGlobalStateChange((state) => { store.user = state.user; });
  props.setGlobalState({ token: 'xxx' });
}
```

---

## 样式隔离

**CSS 隔离的核心问题不是"卸载后残留"（qiankun unmount 时会移除样式），而是多个子应用/主应用同时存在时互相影响。**

```
什么时候需要隔离：
  单实例（同时只显示一个子应用）→ mount 加载 CSS，unmount 移除 → 问题不大
  多实例/并存（侧边栏 + 主内容同时渲染不同子应用）→ 需要真正隔离

冲突场景：
  子应用 A：.btn { color: red }  → 主应用的 .btn 也变红了
  子应用 B：* { box-sizing: border-box }  → 影响整个页面
  两个子应用同时有 h1 样式 → 后加载的覆盖前面的
```

| 方案 | 原理 | 效果 | 适用 |
|------|------|------|------|
| **动态 stylesheet** | mount 时加载 CSS，unmount 时移除 | 防止卸载后残留 | 单实例（基本够用） |
| **Shadow DOM** | 子应用挂在 Shadow Root 内，样式天然隔离 | 完全隔离 | 多实例并存（但部分 UI 库不兼容） |
| **CSS Scoped**（qiankun experimentalStyleIsolation） | 动态给子应用所有 CSS 选择器加前缀 `div[data-qiankun="app1"] .btn` | 基本隔离 | 多实例 |
| **CSS Modules / BEM** | 约定命名规范避免冲突 | 软隔离（靠纪律） | 任何情况 |

**结论**：单实例模式下动态加卸载就够了；多实例并存才需要 Shadow DOM 或 scoped 前缀。

---

## JS 沙箱

**问题**：子应用可能修改全局变量（window.xxx），切换子应用后不清理 → 污染。

| 方案 | 原理 | qiankun 支持 |
|------|------|-------------|
| **快照沙箱** | mount 前快照 window，unmount 后恢复 | ✅（单实例） |
| **Proxy 沙箱** | 用 Proxy 代理 window，每个子应用独立 fakeWindow | ✅（多实例） |

```
Proxy 沙箱原理：
  子应用读 window.xxx → 先看 fakeWindow 有没有 → 没有再去真 window 取
  子应用写 window.xxx → 写到 fakeWindow（不影响真 window）
  unmount 时丢弃 fakeWindow → 干净了
```

---

## 路由设计

```
主应用路由（一级）：
  /activity/*   → 加载 activity-app
  /strategy/*   → 加载 strategy-app
  /dashboard/*  → 加载 dashboard-app

子应用路由（二级）：
  /activity/list    → 活动列表
  /activity/create  → 创建活动
  /activity/:id     → 活动详情

子应用路由 base 配置：
  router = createRouter({ history: createWebHistory('/activity') })
```

---

## 部署方案

```
各子应用独立部署（独立域名或独立路径）：
  主应用：https://ops.dd.com/
  activity-app：https://ops.dd.com/micro/activity/ （或 CDN）
  strategy-app：https://ops.dd.com/micro/strategy/

Nginx 配置：
  location /micro/activity/ { proxy_pass http://activity-server/; }
  location /micro/strategy/ { proxy_pass http://strategy-server/; }

发布互不影响：activity-app 发版不需要动主应用或其他子应用
```

---

---

## Web Components + Shadow DOM 方案

> 第三种微前端思路：不用 JS 沙箱模拟隔离，直接用浏览器原生隔离能力。

### 原理

```
Web Components 三件套：
  Custom Elements — 自定义 HTML 标签（<activity-app>）
  Shadow DOM — 封装的 DOM 子树，样式天然隔离
  HTML Templates — 可复用的 DOM 模板

用于微前端：
  每个子应用包装成一个 Custom Element
  子应用 DOM 渲染到 Shadow DOM 内
  → 样式天然隔离（Shadow DOM 内外互不影响）
  → JS 隔离靠 iframe 的 contentWindow（Wujie 方案）
```

### Wujie（腾讯）实现

```
Wujie = iframe（JS 隔离）+ Web Components（DOM 渲染 + 样式隔离）

巧妙之处：
  - 子应用的 JS 跑在 iframe 里（天然 JS 隔离，有独立 window）
  - 但 DOM 不渲染到 iframe 里（避免 iframe 体验差的问题）
  - 而是把 DOM 渲染到主应用的 Shadow DOM 中（体验好 + 样式隔离）

= 取 iframe 的隔离优势 + 取 Shadow DOM 的体验优势
```

```
对比：
  iframe 直接用 → 隔离好但体验差（高度不自适应/通信难/URL 割裂）
  qiankun → 体验好但隔离是"模拟的"（Proxy 沙箱不完美）
  Wujie → iframe 做隔离 + Shadow DOM 做渲染 → 两者优点兼得
```

### micro-app（京东）

```
micro-app = 纯 Web Components 方案（不用 iframe）

原理：
  <micro-app name="activity" url="http://activity.com"></micro-app>
  → 自定义元素内部 fetch 子应用 HTML
  → 渲染到 Shadow DOM 内
  → 样式天然隔离

比 qiankun 简单：接入只需一行 HTML 标签
比 qiankun 弱：JS 隔离没有 Proxy 沙箱那么强
```

### 三种方案本质对比

| | qiankun | Wujie | micro-app |
|---|---|---|---|
| JS 隔离 | Proxy 沙箱（模拟） | iframe（浏览器原生） | 较弱 |
| CSS 隔离 | 动态 scoped / Shadow DOM | Shadow DOM | Shadow DOM |
| 体验 | 好（同文档） | 好（DOM 在主文档） | 好 |
| 接入成本 | 中（需改子应用生命周期） | 中 | 低（一行标签） |
| 成熟度 | 高（蚂蚁/阿里大量使用） | 中 | 中 |

### 什么时候选 Web Components 方案

```
选 qiankun：已有项目拆分、生态成熟、社区支持好
选 Wujie：对隔离要求极高（子应用不可信）、新项目
选 micro-app：追求接入简单、不需要极致隔离
```

---

## 什么时候不该用微前端

| 场景 | 用不用 |
|------|--------|
| 团队就 2-3 人 | ❌ 复杂度大于收益 |
| 项目刚开始 | ❌ 先做好模块拆分就行 |
| 只是想复用组件 | ❌ 用 npm 包/Module Federation |
| 多团队 + 多模块 + 独立发版需求 | ✅ |
| 遗留系统改造（Vue 2 → Vue 3 渐进升级） | ✅ |

---

## 和 RN 多 Bundle 的类比

**微前端和 RN 多 Bundle 本质是同一个设计思路**——大型应用按业务域拆分为独立模块，独立开发/部署，通过统一基座聚合。

| | Web 微前端 | RN 多 Bundle |
|---|---|---|
| 基座 | 主应用（路由分发 + 公共 UI） | Native 壳（原生路由 + 容器） |
| 子应用 | 独立 SPA（独立构建/部署） | 独立 Bundle（独立打包/热更新） |
| 加载 | fetch HTML → 解析 → 执行 JS | 下载 .hbc → 创建 ReactInstance → 执行 |
| 隔离 | JS 沙箱 + 样式隔离 | 独立 ReactInstance（天然隔离） |
| 通信 | GlobalState / CustomEvent | Native EventEmitter / 原生路由参数 |
| 独立发版 | 子应用独立部署 | 单 Bundle 独立热更新 |

**本质是同一个问题**：大型应用拆分为独立模块，独立开发/部署，通过统一基座聚合。

---

## 高频问题

| 问题 | 一句话 |
|------|--------|
| 微前端解决什么问题？ | 多团队独立开发/部署/技术栈混用，互不阻塞 |
| qiankun 原理？ | fetch 子应用 HTML → 解析 JS/CSS → Proxy 沙箱执行 → mount 到容器 |
| JS 沙箱怎么实现？ | Proxy 代理 window，子应用读写都走 fakeWindow，unmount 时丢弃 |
| 样式怎么隔离？ | Shadow DOM / 动态 scoped 前缀 / CSS Modules |
| 子应用间怎么通信？ | qiankun GlobalState（发布订阅）/ CustomEvent / URL 参数 |
| 和 iframe 的区别？ | iframe 天然隔离但体验差（通信难/UI 割裂）；微前端隔离可控+体验好 |
| 什么时候不该用？ | 团队小/项目小/只想复用组件 → 不用，过度工程化 |
| Module Federation 和 qiankun 区别？ | MF 是模块级共享，qiankun 是应用级聚合 |
