# SSR（Server-Side Rendering）

## 目录

- [本质](#本质)
- [完整流程](#完整流程)
- [实操：Next.js](#实操nextjs)
- [什么数据在 Server 端请求](#什么数据在-server-端请求)
- [下发产物：HTML + JS](#下发产物html--js)
- [水合（Hydration）](#水合hydration)
- [构建端做了什么](#构建端做了什么)
- [script 标签在前端中的妙用](#script-标签在前端中的妙用)

---

## 本质

```
CSR（客户端渲染）：
  浏览器收到空 HTML → 下载 JS → 执行 JS → 渲染页面
  用户看到内容的时间 = 下载 JS + 执行 JS（慢）

SSR（服务端渲染）：
  服务器执行 React → 生成完整 HTML → 发给浏览器 → 用户立即看到内容
  → 同时下载 JS → 水合（绑定事件）→ 页面可交互
```

**解决两个问题**：
1. **首屏速度**：用户不用等 JS 下载执行就能看到内容
2. **SEO**：搜索引擎爬虫能直接读到 HTML 内容

---

## 完整流程

```
用户请求 → Server
              │
              ▼
  1. Server 执行 React 组件（调用 renderToString / renderToPipeableStream）
  2. 请求数据（DB / API）
  3. 生成完整 HTML 字符串（包含真实内容）
  4. 在 HTML 中注入：
     - <script> 标签加载客户端 JS bundle
     - <script> 标签注入序列化的数据（window.__INITIAL_DATA__）
              │
              ▼
  5. 发送 HTML 给浏览器
              │
              ▼
浏览器收到 HTML
  │
  ├─ 立即渲染页面（用户看到内容，但还不能交互）
  │
  ├─ 下载 <script> 中引用的 JS bundle
  │
  └─ JS 执行：hydrateRoot()
       │
       ▼
     水合：React 接管已有 DOM，绑定事件监听器
     → 页面可交互
```

---

## 实操：Next.js

### App Router（React Server Components，推荐）

```tsx
// app/users/page.tsx — 默认是 Server Component
async function UsersPage() {
  // 直接在组件里 await 请求数据（Server 端执行，不发到客户端）
  const users = await fetch('https://api.example.com/users').then(r => r.json());

  return (
    <div>
      <h1>用户列表</h1>
      <ul>
        {users.map(u => <li key={u.id}>{u.name}</li>)}
      </ul>
      <SearchBox />  {/* 客户端组件，有交互 */}
    </div>
  );
}
```

```tsx
// app/users/SearchBox.tsx — 需要交互的部分标记为客户端组件
'use client';

export function SearchBox() {
  const [query, setQuery] = useState('');
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### Pages Router（旧方式，getServerSideProps）

```tsx
// pages/users.tsx
export async function getServerSideProps() {
  const res = await fetch('https://api.example.com/users');
  const users = await res.json();

  return {
    props: { users },  // ← 序列化后注入到 HTML 中
  };
}

export default function UsersPage({ users }) {
  return (
    <ul>
      {users.map(u => <li key={u.id}>{u.name}</li>)}
    </ul>
  );
}
```

---

## 什么数据在 Server 端请求

| 适合 Server 端 | 适合 Client 端 |
|---------------|---------------|
| 首屏展示必需的数据（列表、详情） | 用户交互后才需要的数据（搜索结果、下拉加载） |
| 需要 SEO 的内容 | 个性化内容（登录后的推荐） |
| 需要访问内部 API / 数据库的 | 实时数据（WebSocket、轮询） |
| 不依赖浏览器 API 的 | 依赖 window/document/localStorage 的 |

**原则**：首屏内容 Server 端请求，交互后的数据 Client 端请求。

---

## 下发产物：HTML + JS

Server 最终返回的就是一个 **完整的 HTML 文档**：

```html
<!DOCTYPE html>
<html>
<head>
  <title>用户列表</title>
  <link rel="stylesheet" href="/static/css/main.abc123.css" />
</head>
<body>
  <!-- ① 服务端渲染的真实 HTML 内容（用户立即可见） -->
  <div id="root">
    <h1>用户列表</h1>
    <ul>
      <li>张三</li>
      <li>李四</li>
    </ul>
  </div>

  <!-- ② 序列化的数据（避免客户端重复请求） -->
  <script>
    window.__INITIAL_DATA__ = {"users":[{"id":1,"name":"张三"},{"id":2,"name":"李四"}]}
  </script>

  <!-- ③ 客户端 JS bundle（水合用） -->
  <script src="/static/js/main.def456.js" defer></script>
</body>
</html>
```

**三个部分**：
1. **HTML 内容**：Server 渲染的真实 DOM，用户立即看到
2. **序列化数据**：通过 `<script>` 注入到 `window.__INITIAL_DATA__`，客户端水合时直接用，不重复请求
3. **JS bundle**：客户端代码，负责水合（绑定事件）+ 后续交互

---

## 水合（Hydration）

```tsx
// 客户端入口（main.tsx）
import { hydrateRoot } from 'react-dom/client';

// 不是 createRoot（那会清空 DOM 重建）
// hydrateRoot 复用服务端已有的 DOM，只绑定事件
hydrateRoot(
  document.getElementById('root'),
  <App initialData={window.__INITIAL_DATA__} />
);
```

**hydrateRoot vs createRoot**：

| | createRoot | hydrateRoot |
|--|-----------|-------------|
| DOM | 清空容器，从零创建 | 复用已有 DOM，只绑定事件 |
| 适用 | CSR | SSR 水合 |
| 首屏 | 白屏等 JS 执行 | 立即可见（HTML 已有内容） |

**水合做了什么**：
1. React 在内存中重新执行组件树（生成虚拟 DOM）
2. 对比虚拟 DOM 和已有真实 DOM（应该一致）
3. 不操作 DOM（已经对了），只绑定事件监听器
4. 绑定完成 → 页面可交互

**水合不匹配（Hydration Mismatch）**：如果 Server 渲染的 HTML 和 Client 渲染的不一致，React 会报警告并强制用客户端结果覆盖（性能损失）。常见原因：用了 `Date.now()`、`Math.random()`、`window.innerWidth` 等在两端结果不同的值。

---

## 构建端做了什么

SSR 项目构建时需要产出**两份 bundle**：

```
构建输入：同一份源码

构建输出：
  ├── server/          ← Server bundle（Node.js 执行）
  │   └── server.js   // 包含 renderToString/renderToPipeableStream 逻辑
  │                    // 不包含浏览器 API（window/document）
  │
  └── client/          ← Client bundle（浏览器执行）
      ├── main.js      // hydrateRoot + 交互逻辑
      ├── main.css
      └── chunks/      // 按路由拆分的 chunk
```

**构建工具做的事**：

| 步骤 | 说明 |
|------|------|
| 1. 两次打包 | 同一份代码，分别以 `target: 'node'` 和 `target: 'web'` 打包 |
| 2. Server bundle | 排除浏览器 polyfill，保留 Node API，输出 CommonJS/ESM |
| 3. Client bundle | 正常前端打包（code splitting、tree shaking、压缩） |
| 4. HTML 模板 | 生成 HTML 壳，注入 CSS/JS 引用路径（带 hash） |
| 5. Manifest | 生成资源映射表，Server 渲染时知道该注入哪些 `<script>` 和 `<link>` |

**Next.js 帮你做了所有这些**，你不需要手动配置双打包。如果自己搭：

```javascript
// webpack.config.js（简化）
module.exports = [
  // Server bundle
  {
    target: 'node',
    entry: './src/server.tsx',
    output: { path: './dist/server', filename: 'server.js' },
    externals: [nodeExternals()],  // 不打包 node_modules
  },
  // Client bundle
  {
    target: 'web',
    entry: './src/client.tsx',
    output: { path: './dist/client', filename: '[name].[contenthash].js' },
    plugins: [new HtmlWebpackPlugin({ template: './src/index.html' })],
  },
];
```

---

## script 标签在前端中的妙用

### 1. 注入序列化数据（SSR 最常见）

```html
<!-- Server 端注入数据，Client 端直接读取，避免重复请求 -->
<script>
  window.__INITIAL_DATA__ = { users: [...] };
  window.__CONFIG__ = { apiBase: 'https://api.xxx.com', env: 'production' };
</script>
```

### 2. 动态加载第三方脚本

```tsx
// 按需加载（不阻塞首屏）
useEffect(() => {
  const script = document.createElement('script');
  script.src = 'https://maps.googleapis.com/maps/api/js?key=xxx';
  script.async = true;
  script.onload = () => setMapReady(true);
  document.head.appendChild(script);
}, []);
```

### 3. type="module" — ESM 原生加载

```html
<!-- 浏览器原生支持 ES Module -->
<script type="module" src="/src/main.ts"></script>
<!-- Vite 开发模式就是这样工作的 -->
```

### 4. defer vs async

```html
<!-- defer：HTML 解析完再执行，保证顺序 -->
<script src="a.js" defer></script>
<script src="b.js" defer></script>
<!-- 保证 a 先于 b 执行 -->

<!-- async：下载完立即执行，不保证顺序 -->
<script src="analytics.js" async></script>
<!-- 适合独立脚本（统计、广告），不依赖其他脚本 -->
```

| 属性 | 下载时机 | 执行时机 | 顺序 | 适用 |
|------|---------|---------|------|------|
| 无 | 阻塞 HTML 解析 | 立即 | 保证 | 几乎不用 |
| `defer` | 并行下载 | HTML 解析完后 | 保证 | 主 bundle |
| `async` | 并行下载 | 下载完立即 | 不保证 | 独立脚本（统计） |

### 5. type="application/json" — 数据容器

```html
<!-- 不会被执行，纯粹作为数据容器 -->
<script id="config" type="application/json">
  {"theme": "dark", "locale": "zh-CN"}
</script>

<script>
  const config = JSON.parse(document.getElementById('config').textContent);
</script>
```

### 6. Preload / Prefetch 配合

```html
<!-- 预加载关键资源（当前页面需要） -->
<link rel="preload" href="/static/js/dashboard.chunk.js" as="script" />

<!-- 预获取下一页资源（空闲时加载） -->
<link rel="prefetch" href="/static/js/settings.chunk.js" />
```
