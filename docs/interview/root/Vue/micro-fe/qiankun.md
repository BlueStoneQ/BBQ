我来用第一性原理拆解微前端和乾坤（qiankun）的底层本质。

## 目录

- [第一性原理：我们在解决什么问题？](#第一性原理我们在解决什么问题)
- [拆解到原子层面：浏览器只认什么？](#拆解到原子层面浏览器只认什么)
- [使用范式（快速上手）](#使用范式快速上手)
  - [安装](#1-安装)
  - [主应用（基座）配置](#2-主应用基座配置)
  - [子应用改造（Vue 3 示例）](#3-子应用改造vue-3-示例)
  - [子应用构建配置（Vite 示例）](#4-子应用构建配置vite-示例)
  - [部署](#5-部署)
  - [生命周期与缓存机制](#6-生命周期与缓存机制)
- [乾坤的核心机制（第一性视角）](#乾坤的核心机制第一性视角)
  - [加载机制](#1-加载机制不是路由跳转是动态注入子应用)
  - [沙箱隔离](#2-沙箱隔离不是安全隔离是变量隔离)
  - [样式隔离](#3-样式隔离不是css-模块化是作用域欺骗)
  - [通信机制](#4-通信机制不是eventbus是共享内存的约定)
- [乾坤的架构全景](#乾坤的架构全景第一性总结)
- [为什么不用 iframe？第一性对比](#为什么不用-iframe第一性对比)
- [附录：关键概念补充](#附录关键概念补充)
  - [`with` 语句](#with-语句)
- [Q&A](#qa)
  - [原理类](#原理类)
  - [场景类](#场景类)
  - [对比类](#对比类)

---

## 第一性原理：我们在解决什么问题？

微前端不是"技术潮流"，而是**解决一个根本矛盾**：

> **业务需要独立迭代（团队自治） vs. 用户需要统一体验（页面聚合）**

乾坤（qiankun）就是这个矛盾的工程化解法。

---

## 拆解到原子层面：浏览器只认什么？

浏览器不认识"微前端"，它只认识三个原子操作：

1. **HTML 解析** → 构建 DOM 树
2. **JS 执行** → 操作 DOM + 全局状态（`window`）
3. **CSS 应用** → 样式计算与渲染

**乾坤的本质 = 在浏览器原子能力之上，做"应用级别的进程隔离"**

---

## 使用范式（快速上手）

### 1. 安装

```bash
# 主应用
pnpm add qiankun

# 子应用不需要安装 qiankun，只需导出生命周期
```

### 2. 主应用（基座）配置

```ts
// main.ts
import { registerMicroApps, start } from 'qiankun';

// 注册子应用
registerMicroApps([
  {
    name: 'activity-app',
    entry: '//localhost:8081',        // 子应用的独立运行地址(从这里拉取子应用html)
    container: '#subapp-container',   // 挂载到主应用的哪个 DOM
    activeRule: '/activity',          // URL 匹配规则
  },
  {
    name: 'strategy-app',
    entry: '//localhost:8082',
    container: '#subapp-container',
    activeRule: '/strategy',
  },
]);

// 启动
start();
```

> **关于 entry 和跨域**：
> - `entry` 是子应用 HTML 的完整 URL，qiankun 用 `fetch(entry)` 拉取内容，因此受同源策略限制。
> - 子应用**不需要**和主应用部署在同一域名下，但不同域时子应用必须配置 CORS（`Access-Control-Allow-Origin`）。
> - 生产环境推荐用 Nginx 反代统一到同一域名不同路径（如 `ops.com/micro/activity/`），彻底避免跨域。
> - `//localhost:8081` 是开发环境简写，生产环境应为完整 URL 如 `https://ops.com/micro/activity/`。
>
> **关于 activeRule**：
> - 这不是主应用 vue-router 的路由，而是 qiankun 自己监听 `popstate`/`hashchange` 做的 URL 前缀匹配。
> - 当浏览器 URL 匹配 `/activity` 前缀时 → qiankun 去 fetch entry → 加载并 mount 子应用。
> - 主应用的 vue-router 不需要配这段路由（避免路由冲突）。

```html
<!-- 主应用模板 -->
<div id="app">
  <header>公共导航</header>
  <aside>侧边栏</aside>
  <!-- 子应用挂载点 -->
  <div id="subapp-container"></div>
</div>
```

### 3. 子应用改造（Vue 3 示例）

```ts
// src/main.ts
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import routes from './routes';

let app: ReturnType<typeof createApp>;
let router: ReturnType<typeof createRouter>;

// 导出三个生命周期钩子（qiankun 约定）
export async function bootstrap() {
  // 首次加载时调用，只调用一次
  // 一般做：全局配置初始化（如 axios 默认配置、全局错误监听、埋点 SDK 初始化）
  // 不要在这里做 DOM 操作（此时还没 mount）
}

export async function mount(props: any) {
  // 每次进入子应用时调用
  router = createRouter({
    history: createWebHistory('/activity'),  // 路由 base = activeRule
    routes,
  });
  app = createApp(App);
  app.use(router);
  // 挂载到 qiankun 给的容器，或独立运行时的 #app
  // props.container = 主应用的 #subapp-container（qiankun 传入）
  // 子应用的 HTML 模板已被塞入其中，里面有 <div id="app">
  // 所以这里是：在 qiankun 容器内找子应用自己的 #app 挂载点
  app.mount(props.container?.querySelector('#app') || '#app');
}

export async function unmount() {
  // 离开子应用时调用
  app.unmount();
}

// 独立运行（非 qiankun 环境直接跑）
if (!(window as any).__POWERED_BY_QIANKUN__) {
  mount({});
}
```

### 4. 子应用构建配置（Vite 示例）

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import qiankun from 'vite-plugin-qiankun';

export default defineConfig({
  plugins: [
    qiankun('activity-app', { useDevMode: true }),
  ],
  server: {
    port: 8081,
    cors: true,  // 跨域：主应用 fetch 子应用资源必须允许
    origin: 'http://localhost:8081',
  },
});
```

> Webpack 场景需要配置 `output.library` + `output.libraryTarget = 'umd'`，让子应用导出的生命周期能被主应用获取。

### 5. 部署

```
各子应用独立部署（独立域名或路径）：
  主应用：https://ops.example.com/
  activity-app：https://ops.example.com/micro/activity/
  strategy-app：https://ops.example.com/micro/strategy/

Nginx 示例：
  location /micro/activity/ {
    proxy_pass http://activity-server/;
    add_header Access-Control-Allow-Origin *;
  }

关键点：
  - 子应用资源需要允许跨域（CORS）
  - 子应用的 publicPath 需要设置为绝对路径（避免资源 404）
  - 发布互不影响：activity-app 发版不需要动主应用
```

**线上跨域处理**（Vite 的 `cors: true` 只管开发环境，线上由 Nginx/CDN 处理）：

| 方案 | 做法 | 跨域？ |
|------|------|--------|
| **方案 1（推荐）：Nginx 反代统一域名** | 所有子应用通过同域不同路径访问 | ❌ 不跨域，零配置 |
| **方案 2：子应用独立域名/CDN** | 子应用服务端配 CORS 响应头 | ✅ 跨域 |

```nginx
# 方案 1：反向代理统一域名（推荐，彻底避免跨域）
# 主应用和子应用对浏览器来说是同一个域名
server {
  listen 443;
  server_name ops.example.com;

  # 主应用
  location / {
    root /var/www/main-app/;
  }

  # 子应用 A（反代到子应用的实际部署地址）
  location /micro/activity/ {
    proxy_pass http://内网-activity-server/;
  }

  # 子应用 B
  location /micro/strategy/ {
    proxy_pass http://内网-strategy-server/;
  }
}
# entry 填同域路径：entry: '/micro/activity/'
```

```nginx
# 方案 2：子应用独立域名，在子应用 Nginx 配 CORS
# CORS 配在子应用服务端（因为是主应用 fetch 子应用，浏览器检查子应用的响应头）
server {
  listen 443;
  server_name activity.ops.example.com;

  location / {
    root /var/www/activity-app/;
    add_header Access-Control-Allow-Origin https://ops.example.com;
    add_header Access-Control-Allow-Methods GET;
    add_header Access-Control-Allow-Headers *;
  }
}
# entry 填完整 URL：entry: 'https://activity.ops.example.com/'
```

### 6. 生命周期与缓存机制

**qiankun 内部数据结构（本质）**：

```javascript
// qiankun 维护一个注册表，每个子应用是一个对象，首次 load 后所有资源缓存在上面
const apps = [
  {
    name: 'activity-app',
    activeRule: '/activity',          // 路由匹配规则
    entry: 'https://ops.com/micro/activity/',
    container: '#subapp-container',
    status: 'NOT_MOUNTED',            // 状态机状态

    // ↓ 首次 load 后缓存，后续切换不再请求网络
    bootstrap: fn,                    // 生命周期
    mount: fn,
    unmount: fn,
    cssText: ['.btn{color:red}...'],  // CSS 文本缓存
    sandbox: ProxySandbox,            // 沙箱实例（含 fakeWindow，unmount 时失活但不销毁）
  },
  { name: 'strategy-app', ... },
];

// URL 变化时：
// 1. 遍历 apps，找 activeRule 匹配当前 URL 的应用
// 2. 看 status → NOT_LOADED 走完整加载流程，NOT_MOUNTED 直接 mount
```

**子应用切换流程（连贯链路）**：

```
第一次进入 A（status: NOT_LOADED）：
  URL 匹配 → 找到 apps[0]
  → fetch HTML → 解析 JS/CSS
  → fetch JS + CSS → 缓存到 apps[0] 上
  → 创建沙箱 → 执行 JS → 拿到 bootstrap/mount/unmount 挂到 apps[0]
  → 调用 bootstrap()（只一次）→ status 变为 NOT_MOUNTED
  → 插入 <style>（从 cssText 缓存）
  → 调用 mount() → status 变为 MOUNTED

切走到 B：
  → 调用 apps[0].unmount() → Vue 销毁组件树
  → 移除 <style> 标签
  → status 变回 NOT_MOUNTED
  → apps[0] 对象还在内存里（JS/CSS/沙箱/生命周期全部保留）
  → B 走完整加载流程...

再切回 A（status: NOT_MOUNTED）：
  URL 匹配 → 找到 apps[0] → 看 status 是 NOT_MOUNTED
  → 跳过 fetch/执行 JS/bootstrap（全部不需要）
  → 直接从 cssText 缓存创建 <style> 插入
  → 直接调用 apps[0].mount() → Vue 重新渲染
  → status 变为 MOUNTED
```

**状态机**：

```
NOT_LOADED → LOADING → NOT_BOOTSTRAPPED → NOT_MOUNTED ⇄ MOUNTED
                                               ↑
                                    第二次进入从这里开始
```

**内存影响**：

```
保留在内存中的（量级小，可忽略）：
  - JS 代码 + CSS 文本 + 沙箱 + 生命周期函数 → 每个子应用几 MB

unmount 时释放的（量级大，真正占内存的）：
  - DOM 节点树、组件实例、响应式数据、Store 状态

10 个子应用全缓存 ≈ 几十 MB，换来再次进入秒开（无网络请求）
真正导致内存爆炸的是 unmount 没清干净（定时器/事件监听/大对象）
```

---

## 乾坤的核心机制（第一性视角）

### 1. 加载机制：不是"路由跳转"，是"动态注入子应用"

```javascript
// 伪代码：乾坤在做什么
async function loadMicroApp(entry, container) {
  // 第一步：获取子应用的 HTML（像浏览器一样）
  const html = await fetch(entry).then(r => r.text());
  
  // 第二步：解析 HTML，提取 JS/CSS（模拟浏览器解析）
  const { scripts, styles } = parseHTML(html);
  
  // 第三步：创建隔离的"执行上下文"（关键！）
  const sandbox = createSandbox();
  
  // 第四步：先把 HTML 模板（去掉 script 后的纯 DOM）挂载到容器
  // 因为子应用 JS 需要找到挂载点（如 #app）
  container.innerHTML = htmlTemplate;
  
  // 第五步：在沙箱里执行 JS → 子应用导出 mount() → 渲染到容器
  scripts.forEach(script => sandbox.exec(script));
}
```

**本质**：乾坤不是"iframe 的替代品"，它是**用 JS 模拟浏览器的标签页切换**——但所有应用跑在同一个浏览器的 JS 引擎里。

---

### 2. 沙箱隔离：不是"安全隔离"，是"变量隔离"

浏览器没有"子应用进程"的概念，所有 JS 共享同一个 `window`。乾坤要解决：

> **子应用 A 修改了 `window.jQuery`，不能影响子应用 B**

乾坤的两种沙箱实现：

| 方案 | 原理 | 本质 |
|------|------|------|
| **Snapshot 沙箱** | 切换时 `Object.keys(window)` 做 Diff，记录变更，切换时恢复 | 像 Git 的 stash/pop，**状态快照** |
| **Proxy 沙箱** | 用 `new Proxy(fakeWindow, {...})` 拦截所有读写 | 给每个子应用一个**虚拟的 `window` 替身** |

> **两者是降级关系，同一时刻只用一种**：浏览器支持 Proxy → 用 Proxy 沙箱（默认，支持多实例）；不支持 Proxy（IE11）→ 降级为 Snapshot 沙箱（只支持单实例）。2026 年实际生产中几乎都是 Proxy 沙箱。

```javascript
// Proxy 沙箱的核心逻辑
const fakeWindow = {}; // 假的 window
const sandbox = new Proxy(window, {
  get(target, key) {
    // 优先从 fakeWindow 读，读不到再去真实 window
    return key in fakeWindow ? fakeWindow[key] : target[key];
  },
  set(target, key, value) {
    // 只写到 fakeWindow，绝不污染真实 window
    fakeWindow[key] = value;
    return true;
  }
});

// 子应用在这个 sandbox 里运行，以为自己在操作 window
// 实际上所有修改都被困在 fakeWindow 里
```

**子应用怎么"跑在"沙箱里？—— 用 `with` + `new Function` 绑定作用域**：

```javascript
// qiankun 实际做法：用 new Function 创建一个接收 sandbox 参数的函数
const render = new Function('window', 'self', 'globalThis', `
  with(window) {
    ${子应用JS代码字符串}
  }
`);

// 调用时把 sandbox（Proxy）作为参数传入
// 子应用代码里的 window/self/globalThis 全部指向 sandbox
render.call(sandbox, sandbox, sandbox, sandbox);

// 为什么用 new Function 而不是 eval？
// new Function 创建的函数不访问外层闭包变量，更安全、性能更好
// 且函数体内 this 可以通过 .call 绑定为 sandbox
```

**一句话**：Proxy 负责拦截读写，`with` 负责让子应用代码的变量查找走 Proxy，两者配合才构成完整沙箱。

**本质**：不是"防止恶意代码"（那是 Web Worker/Sandbox 的事），而是**防止子应用之间的变量污染**。

---

### 3. 样式隔离：不是"CSS 模块化"，是"作用域欺骗"

CSS 没有原生作用域，乾坤提供三种策略（通过配置选择）：

```javascript
// 默认行为（不配置）：动态加卸载
// mount 时插入 <style>，unmount 时移除
// 只防残留，不防并存冲突
```

**方案 1（推荐）：选择器前缀**

```javascript
// 开启方式
start({ sandbox: { experimentalStyleIsolation: true } });
```

```
原理：qiankun 在插入子应用 CSS 时，解析每条规则并自动加前缀

  原始 CSS：
    .header { color: red; }
    .btn { font-size: 14px; }

  处理后：
    div[data-qiankun="activity-app"] .header { color: red; }
    div[data-qiankun="activity-app"] .btn { font-size: 14px; }

怎么处理的：
  1. 拿到子应用 CSS 文本
  2. 用 CSSStyleSheet API 解析为 cssRules（浏览器引擎解析，非正则）
  3. 遍历每条 rule，给 selectorText 前面拼上 div[data-qiankun="appName"]
  4. 重新生成 CSS 文本 → 创建 <style> 插入容器

效果：
  - 子应用的 .btn 只匹配容器内的元素 → 不影响主应用
  - 主应用的 .btn 没有这个前缀 → 不匹配子应用容器内的元素
  - 单向隔离（防子应用泄漏），但外部样式仍可能侵入子应用
```

**方案 2：Shadow DOM（严格隔离）**

```javascript
// 开启方式
import { start } from 'qiankun';
start({
  sandbox: {
    strictStyleIsolation: true,  // 开启 Shadow DOM 隔离
  },
});
```

```
原理：qiankun 在挂载子应用时，不直接把 DOM 插入容器，而是：
  1. 在容器上创建 Shadow Root：container.attachShadow({ mode: 'open' })
  2. 子应用的 HTML 模板 + <style> 全部插入 Shadow Root 内
  3. Shadow Boundary 天然隔离 → 内部样式出不去，外部样式进不来

结构：
  <div id="subapp-container">
    #shadow-root (open)
    ├── <style>.btn { color: red }</style>   ← 困在里面
    └── <div id="app">                       ← 子应用 DOM
          <button class="btn">按钮</button>
        </div>
  </div>

隔离效果：
  - 子应用的 .btn { color: red } 不会影响主应用的 .btn
  - 主应用的全局 CSS 也不会影响子应用（双向隔离）
  - 比选择器前缀更彻底（前缀方案只防子应用泄漏，不防外部侵入）
```

**为什么实际项目很少用 Shadow DOM**：

| 问题 | 说明 |
|------|------|
| UI 库弹窗失效 | Ant Design / Element Plus 的 Modal、Dropdown 用 Teleport 渲染到 `document.body`，脱离了 Shadow Root → 样式丢失 |
| 全局样式无法穿透 | 主应用想给子应用传递主题变量（CSS Variables）需要额外处理 |
| `document.querySelector` 失效 | 外部查不到 Shadow DOM 内的元素，某些库依赖全局查询会出问题 |
| 事件冒泡 retarget | 事件冒泡到 Shadow Boundary 时 `event.target` 被重置为宿主元素 |

**实际选型**：大多数项目用方案 1（前缀），因为 Shadow DOM 和 Ant Design/Element Plus 等 UI 库有兼容问题。

**本质**：用技术手段**伪造 CSS 的作用域**，让全局样式变成局部样式。

---

### 4. 通信机制：不是"EventBus"，是"共享内存的约定"

乾坤提供 `initGlobalState`：
本质还是基于发布订阅的 广播机制:

```javascript
// 主应用
const actions = initGlobalState({ user: null });
actions.onGlobalStateChange((state, prev) => {
  // 监听全局状态变化（广播机制：任何一方 setGlobalState，所有订阅者都收到）
});

// 子应用
export function mount(props) {
  props.onGlobalStateChange((state) => {
    // 消费全局状态
  });
  props.setGlobalState({ user: { name: 'Tom' } }); // 修改
}
```

**本质**：就是发布订阅（和 EventBus 一样），区别在于 qiankun 把它包装成了"状态驱动"而非"事件驱动"——订阅的是全局状态对象的变更，而不是具名事件。类似一个极简版的跨应用 Redux。

---

## 乾坤的架构全景（第一性总结）

```
┌─────────────────────────────────────────┐
│              浏览器（单进程）              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  子应用A  │ │  子应用B  │ │  子应用C  │  │
│  │ (React) │ │ (Vue)   │ │ (Angular)│  │
│  │         │ │         │ │         │  │
│  │ Proxy   │ │ Proxy   │ │ Proxy   │  │
│  │ Window  │ │ Window  │ │ Window  │  │
│  │  [隔离]  │ │  [隔离]  │ │  [隔离]  │  │
│  └────┬────┘ └────┬────┘ └────┬────┘  │
│       └───────────┼───────────┘        │
│                   │                    │
│              共享的 DOM 树              │
│         （通过容器节点挂载）              │
└─────────────────────────────────────────┘
```

**乾坤 = 在单页浏览器环境里，用 JS 模拟"多进程"的假象**

---

## 为什么不用 iframe？第一性对比

| 维度 | iframe | 乾坤（qiankun） |
|------|--------|----------------|
| **隔离级别** | 浏览器原生进程级（强） | JS 模拟（弱，但够用） |
| **通信成本** | 高（`postMessage` + 序列化） | 低（直接函数调用） |
| **DOM 共享** | 不可行（跨文档） | 可行（同一文档流） |
| **弹窗/遮罩** | 被裁剪（视觉边界） | 正常（无边界） |
| **路由同步** | 复杂（需手动同步） | 天然（同一 `history`） |

**本质选择**：iframe 是"真隔离"，代价是"真割裂"；乾坤是"假隔离"，换取"真融合"。业务需要融合，所以用乾坤。

---

## 一句话总结

> **乾坤的底层原理 = 在浏览器单线程、单全局环境的约束下，用 Proxy 沙箱模拟应用隔离、用样式重写伪造作用域、用动态加载模拟应用切换，从而在"必须共享运行环境"和"必须避免相互污染"之间取得平衡。**

它不是魔法，是对浏览器原子能力的精巧组合。


---

## 附录：关键概念补充

### `with` 语句

**本质**：修改 JS 变量查找的作用域链，把指定对象插入到作用域链最前面。

```javascript
// JS 引擎查找裸变量的顺序（正常情况）：
// 局部作用域 → 闭包 → ... → 全局作用域（window）

var x = 1;
function foo() {
  console.log(x);  // 局部没有 → 往外找 → window.x = 1
}

// with(obj) 的效果：把 obj 插入作用域链最前面
var obj = { x: 100 };
with(obj) {
  console.log(x);  // 先从 obj 上找 → obj.x = 100 ✓（不再往外找了）
  console.log(y);  // obj 上没有 → 继续往外找 → 全局
}
```

**在 qiankun 沙箱中的作用**：

```javascript
// 没有 with：裸变量绕过沙箱
function run(window) {  // 参数名覆盖了 window
  window.location;  // ✅ 走参数（Proxy）
  location;         // ❌ 裸变量！直接走全局作用域 → 真实 window.location
}

// 有 with：裸变量也走沙箱
function run(window) {
  with(window) {    // 把 Proxy 插入作用域链最前面
    location;       // 先从 window(Proxy) 上找 → 触发 get trap → 被拦截 ✅
    setTimeout;     // 同理，走 Proxy ✅
    document;       // 同理 ✅
  }
}
```

**一句话**：`with` 让子应用代码里所有裸变量（`location`、`document`、`setTimeout` 等不带 `window.` 前缀的）也能被 Proxy 拦截。没有 `with`，沙箱只能拦截显式 `window.xxx` 的写法。

> 注：`with` 在严格模式下被禁用，但 qiankun 通过 `new Function` 构造的代码默认运行在非严格模式中，所以可以使用。


---

## Q&A

### 原理类

**Q：qiankun 的核心原理是什么？**

A：fetch 子应用 HTML → 解析出 JS/CSS → 用 `new Function` + `with` 在 Proxy 沙箱中执行 JS → mount 到容器。本质是在同一个页面里模拟多进程隔离。

**Q：JS 沙箱是怎么实现的？**

A：`Proxy` 代理一个 fakeWindow 对象，拦截所有读写；配合 `with(sandbox)` 让裸变量也走 Proxy。子应用以为操作的是 window，实际写入都被困在 fakeWindow 里。unmount 时沙箱失活（停止拦截），但 fakeWindow 保留在 apps 注册表中；再次 mount 时沙箱重新激活，之前的全局变量状态还在。

**Q：为什么需要 `with`？光有 Proxy 不够吗？**

A：不够。Proxy 只能拦截对象属性访问（`sandbox.xxx`），但子应用代码里大量裸变量（`location`、`document`、`setTimeout`）不带 `window.` 前缀。`with(sandbox)` 把 Proxy 插入作用域链最前面，让裸变量查找也走 Proxy 的 get trap。

**Q：CSS 隔离是怎么做的？**

A：默认动态加卸载（mount 插入、unmount 移除）。推荐开启 `experimentalStyleIsolation`，给所有选择器自动加 `div[data-qiankun="appName"]` 前缀限定作用域。也可选 Shadow DOM（`strictStyleIsolation`），但和 UI 库兼容性差。

**Q：子应用间怎么通信？**

A：`initGlobalState` — 本质是发布订阅，维护一个全局状态对象，任何一方 `setGlobalState`，所有订阅者广播收到最新状态。类似极简版跨应用 Redux。

---

### 场景类

**Q：子应用切换时白屏怎么优化？**

A：
- 首次加载：预加载（`prefetchApps`）在空闲时提前 fetch 子应用资源
- 再次进入：qiankun 默认缓存 JS/CSS 在内存中，第二次 mount 无网络请求，秒开
- 加载中：主应用显示 loading 骨架屏（`loader` 回调）

**Q：子应用之间有公共依赖（Vue/React），会重复加载吗？**

A：qiankun 本身不解决依赖去重。解法：
- 方案 1：externals + CDN（把 Vue/React 抽到 CDN，所有子应用共用全局变量）
- 方案 2：配合 Module Federation 做运行时共享
- 方案 3：主应用加载后挂到 window 上，子应用判断存在就不再加载

**Q：子应用的路由和主应用冲突怎么办？**

A：不冲突。qiankun 的 `activeRule` 独立于主应用 vue-router，直接监听 `popstate`。子应用路由需要配置 `base`（= activeRule 的值），在自己的路由空间内工作。主应用只需保证不拦截子应用路径段。

**Q：子应用能独立运行吗？怎么做到？**

A：可以。子应用入口判断 `window.__POWERED_BY_QIANKUN__`：
- true → 在 qiankun 环境，等主应用调用 mount
- false → 独立运行，直接自己 mount

开发时直接 `npm run dev` 跑子应用，不依赖主应用。

**Q：多个子应用同时显示（非切换，如左右分栏）怎么做？**

A：用 `loadMicroApp` 手动加载（而非 `registerMicroApps` 路由匹配）。每个子应用独立容器、独立 Proxy 沙箱，同时 mount。CSS 需要开 scoped 前缀或 Shadow DOM 隔离。

**Q：子应用 unmount 后内存泄漏怎么排查？**

A：常见泄漏点：
- 没清理 `setInterval` / `setTimeout`
- 没移除全局事件监听（`window.addEventListener`）
- 没断开 WebSocket 连接
- 闭包引用了大对象

排查：Chrome DevTools → Memory → 对比 mount 前后的 Heap Snapshot，看 Detached DOM 和未释放的闭包。

---

### 对比类

**Q：qiankun 和 iframe 的区别？**

A：iframe 是浏览器原生进程级隔离（强），但体验差（弹窗裁剪、路由不同步、通信靠 postMessage）。qiankun 是 JS 模拟隔离（弱但够用），换取体验好（同文档流、共享路由、直接函数调用）。

**Q：qiankun 和 Module Federation 什么时候用哪个？**

A：
- qiankun：异构技术栈（Vue + React 混合）、存量巨石应用拆分、需要强隔离
- Module Federation：同构技术栈、模块级复用、追求轻量和高性能

两者可以组合：qiankun 管应用边界和隔离，MF 管同构子应用间的模块共享。

**Q：qiankun 的沙箱有什么绕不过去的问题？**

A：
- `document.body.appendChild` 逃逸（子应用动态插入到 body 的 DOM 不在容器内）
- `eval`/`new Function` 内的代码不走 `with` 作用域
- 某些库直接操作原生 DOM API（如 `document.createElement('style')`）绕过沙箱
- 本质问题：JS 没有原生沙箱，所有 Proxy 方案都是"尽力而为"的模拟
