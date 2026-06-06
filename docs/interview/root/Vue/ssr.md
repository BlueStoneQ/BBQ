# Vue SSR

> 解决什么问题：SPA 首屏白屏久 + SEO 差。SSR 让用户第一眼看到完整 HTML，不用等 JS 加载执行完。
> 本质：同一套 Vue 组件，服务端渲染成 HTML 字符串发给浏览器，客户端再"接管"（hydrate）变成可交互 SPA。
> 场景：运营平台（DD）中面向 C 端的落地页 / 活动页需要 SEO + 首屏速度。

---

## 目录

- [本质模型](#本质模型)
  - [第一性原理](#第一性原理)
  - [同构模型](#同构模型)
- [为什么需要 SSR](#为什么需要-ssr)
- [SSR vs CSR vs SSG 对比](#ssr-vs-csr-vs-ssg-对比)
- [Vue SSR 核心流程](#vue-ssr-核心流程)
- [Hydration（注水）](#hydration注水)
- [数据预取](#数据预取)
- [SSR 性能与负载](#ssr-性能与负载)
- [Nuxt.js（Vue SSR 框架）](#nuxtjsvue-ssr-框架)
- [常见问题与陷阱](#常见问题与陷阱)
- [面试高频问题](#面试高频问题)
- [高阶场景：3D 平台 + SSR](#高阶场景3d-平台--ssrvast-场景)

---

## 本质模型

### 第一性原理

**浏览器渲染 HTML 是即时的（解析到哪儿就渲染到哪儿），但执行 JS 生成 DOM 是滞后的。**

```
SSR 的第一性原理：
  把"JS 生成 DOM"这件事从浏览器搬到服务端做完 → 浏览器直接渲染现成 HTML

为什么有效：
  HTML 解析是流式的（浏览器边收边渲染）→ 不依赖 JS 加载/解析/执行
  JS 执行是阻塞的（必须下载 → 解析 → 执行 → 才能操作 DOM）→ 慢

本质矛盾：
  SPA 把 UI 生成推迟到了客户端 JS 执行完 → 用户等白屏
  SSR 把 UI 生成提前到了服务端 → 用户立刻看到内容

= 把"生成 HTML"的成本从带宽受限的客户端转移到算力充足的服务端
```

### 同构模型

```
SSR = 同构渲染（Isomorphic / Universal Rendering）

同一套代码，两个环境跑：
  服务端：Vue 组件 → renderToString() → HTML 字符串 → 返回给浏览器
  客户端：Vue 组件 → hydrate → 绑定事件 → 变成可交互 SPA

= 服务端出"骨架"，客户端"注入灵魂"
```

---

## 为什么需要 SSR

| 问题 | CSR（纯客户端渲染） | SSR 怎么解决 |
|------|-------------------|-------------|
| 首屏白屏 | 用户看到空白 → 等 JS 下载+执行 → 才看到内容 | 服务端直接返回完整 HTML，首屏秒出 |
| SEO | 爬虫拿到空 HTML（`<div id="app"></div>`） | 爬虫拿到完整内容 |
| FCP 指标 | 慢（依赖 JS 解析） | 快（HTML 直出） |

**什么时候不需要 SSR？**
- 内部管理后台（不需要 SEO、不在乎首屏 200ms 差异）
- 登录后才能用的系统（爬虫看不到内容也无所谓）

---

## SSR vs CSR vs SSG 对比

| | CSR | SSR | SSG |
|---|---|---|---|
| 渲染时机 | 浏览器里 | 每次请求时在服务端 | 构建时生成静态 HTML |
| 首屏速度 | 慢 | 快 | 最快（CDN 直出） |
| SEO | 差 | 好 | 好 |
| 服务器压力 | 无（纯静态） | 有（每次请求都渲染） | 无（CDN） |
| 数据实时性 | 实时 | 实时 | 构建时快照（需 rebuild 更新） |
| 适合 | 后台系统 | 动态内容 + SEO | 博客 / 文档 / 营销页 |

**DD 运营平台场景**：
- 内部后台 → CSR 就行
- C 端活动页/落地页 → SSR 或 SSG
- 内容不频繁变的运营页 → SSG（ISR 增量再生成）

---

## Vue SSR 核心流程

```
1. 用户请求 → Nginx → Node.js 服务器

2. 服务端：
   创建 Vue App 实例（每个请求一个新实例！不能共享）
   → 匹配路由
   → 调用组件的数据预取（asyncData / serverPrefetch）
   → 等数据返回
   → renderToString(app) → 完整 HTML
   → 注入初始状态（window.__INITIAL_STATE__）
   → 返回 HTML

3. 浏览器：
   收到 HTML → 立即显示（FCP）
   → 下载 JS Bundle
   → Vue hydrate：对比现有 DOM + 绑定事件
   → 变成完整 SPA（可交互）
```

### 关键代码结构

```
src/
├── entry-client.ts   # 客户端入口：hydrate
├── entry-server.ts   # 服务端入口：renderToString
├── app.ts            # 通用：创建 App 实例
├── router.ts         # 通用：路由定义
└── store.ts          # 通用：状态管理
```

```ts
// entry-server.ts（服务端入口）
export async function render(url: string) {
  const app = createApp();        // 每次请求创建新实例
  const router = createRouter();
  app.use(router);
  
  await router.push(url);
  await router.isReady();
  
  // 数据预取
  const matchedComponents = router.currentRoute.value.matched;
  await Promise.all(
    matchedComponents.map(route => route.components?.default?.serverPrefetch?.())
  );
  
  const html = await renderToString(app);
  const state = JSON.stringify(store.state);  // 序列化状态
  return { html, state };
}

// entry-client.ts（客户端入口）
const app = createApp();
// 恢复服务端状态
if (window.__INITIAL_STATE__) {
  store.replaceState(JSON.parse(window.__INITIAL_STATE__));
}
app.mount('#app');  // hydrate：对比 DOM + 绑定事件
```

### SSR 产物详解：服务端到底返回了什么？

**renderToString 输出的 html**（纯静态 DOM 字符串，无事件/无响应式）：

```html
<div id="app" data-server-rendered="true">
  <header class="header">
    <h1>任务列表</h1>
    <span>共 3 个任务</span>
  </header>
  <ul class="task-list">
    <li class="task-item">买菜</li>
    <li class="task-item">写代码</li>
    <li class="task-item">跑步</li>
  </ul>
</div>
```

**序列化的 state**（服务端预取的数据，JSON 格式）：

```json
{
  "task": {
    "list": [
      { "id": 1, "title": "买菜", "done": false },
      { "id": 2, "title": "写代码", "done": true }
    ],
    "total": 2
  }
}
```

**最终返回给浏览器的完整 HTML**：

```html
<!DOCTYPE html>
<html>
<head>
  <title>任务列表</title>
  <link rel="stylesheet" href="/assets/app.css" />
</head>
<body>
  <!-- SSR 渲染的 HTML -->
  <div id="app" data-server-rendered="true">
    ...组件渲染结果...
  </div>
  
  <!-- 状态注入 -->
  <script>window.__INITIAL_STATE__ = {"task":{"list":[...],"total":2}}</script>
  
  <!-- 客户端 JS -->
  <script src="/assets/app.js"></script>
</body>
</html>
```

**客户端处理流程**：

```
浏览器收到 HTML
  → 立刻渲染（用户看到内容）← FCP
  → 下载 app.js
  → 执行 JS：
    1. 读 window.__INITIAL_STATE__ → store 灌入数据（不需要重新请求 API）
    2. app.mount('#app') → hydrate（复用 DOM + 绑事件 + 激活响应式）
  → 页面可交互 ← TTI

为什么要传 state？
  不传 → 客户端 store 为空 → 渲染结果和服务端不一致 → hydration mismatch
  传了 → 客户端"接手时"数据一致 → 无 mismatch，不重新请求
```

---

## Hydration（注水）

**为什么需要 Hydration？** 服务端返回的 HTML 是"死的"（没有事件绑定），客户端需要让它"活"过来。

```
Hydration 做了什么：
  1. 下载 JS Bundle
  2. 创建 Vue 实例（和服务端一样的组件树）
  3. 对比现有 DOM（不重新创建 DOM，复用服务端生成的）
  4. 绑定事件监听器
  5. 激活响应式系统
  → 页面变成可交互 SPA
```

**Hydration Mismatch**：服务端和客户端渲染结果不一致时会报警告。常见原因：
- 使用了 `Date.now()`、`Math.random()`（两端结果不同）
- 访问了 `window`/`document`（服务端没有）
- 组件依赖浏览器特定 API

### Hydrate 的"复用"具体是什么？

```
正常 CSR mount：Vue render → createElement 创建新 DOM → 插入页面
Hydrate mount：Vue render → 不创建 DOM → 直接"认领"页面上已有的 DOM 节点 + 绑事件

复用 = 不 createElement，直接用服务端已经生成的 DOM 节点
```

### 一致性怎么判断？

对比的两方是：**客户端 render 产生的虚拟 DOM** vs **页面上已有的真实 DOM**（不是 state vs DOM）。

```
Hydrate 流程：
  1. 客户端用 state 执行组件 render → 生成虚拟 DOM 树
  2. 遍历虚拟 DOM，同时遍历页面上已有的真实 DOM
  3. 逐节点对比：标签名？文本内容？属性？
  4. 一致 → 复用该 DOM 节点（绑事件 + 关联虚拟节点）
  5. 不一致 → mismatch

state 的作用：保证客户端 render 出的虚拟 DOM 和服务端 render 出的真实 DOM 一致
            （因为同样的 state + 同样的组件 → 必然 render 出同样的结果）
```

### Mismatch 时销毁重建的粒度

**Vue 2 vs Vue 3 行为不同**：

| | Vue 2 | Vue 3 |
|---|---|---|
| mismatch 行为 | 放弃整个 hydrate，销毁全部 DOM 重建 | 局部修正，只对不一致节点走 patch 更新 |
| 粒度 | 整棵 #app 树 | 从 mismatch 的节点开始局部修 |
| 严重程度 | 页面闪烁 | warning + 局部更新（用户几乎无感） |

### Vue 客户端怎么知道该 hydrate 而不是全新 mount？

**靠 API 选择，不是靠检测 DOM**：

```ts
// CSR：createApp → mount 时清空 DOM 重建
import { createApp } from 'vue';
createApp(App).mount('#app');

// SSR：createSSRApp → mount 时走 hydrate 逻辑（复用已有 DOM）
import { createSSRApp } from 'vue';
createSSRApp(App).mount('#app');
```

Nuxt 客户端 entry 自动用 `createSSRApp`。如果用了 `createSSRApp` 但 #app 是空的（SSR 挂了），Vue 3 会 gracefully 降级为正常 mount。

### SSR 的核心 trade-off：FCP 快但 TTI 可能更慢

```
CSR:  [--------下载 JS--------][执行 + 渲染]
      ← 白屏 →                 ← FCP = TTI（同时到达）

SSR:  [服务端渲染][传 HTML]    [下载 JS][hydrate]
      ← TTFB →   ← FCP →      ← 看得见点不动 →  ← TTI
```

| 指标 | CSR | SSR |
|---|---|---|
| FCP（首次内容绘制） | 慢 | **快** |
| TTI（可交互时间） | = FCP | **可能比 CSR 还慢** |
| 用户体感 | 白屏久但一出来就能用 | 秒出内容但有一段"看得见点不动"的 gap |

**为什么 TTI 可能更慢？**
1. 服务端渲染需要时间（TTFB 变长）
2. HTML 更大（含完整内容 + state JSON）
3. 客户端仍然要下载完整 JS + hydrate 才能交互
4. hydrate 本身要遍历整棵 DOM 树绑事件

**SSR 的真正价值不是"更快可交互"，而是：**
- 感知速度快（用户先看到内容）
- SEO（爬虫拿到完整 HTML）
- FCP/LCP 指标好（Google Core Web Vitals 排名）

### 缩短 FCP → TTI gap 的优化手段

| 手段 | 解决什么问题 | 原理 |
|------|-------------|------|
| **流式渲染** | TTFB 慢（等整页渲染完才返回） | `renderToWebStream` 边渲染边返回，浏览器边收边渲染 |
| **Selective Hydration** | hydrate 整棵树太慢 | 按优先级 hydrate：用户交互的区域先 hydrate，其他延后（React 18 有，Vue 暂无官方支持） |
| **Islands Architecture** | 大部分页面是静态内容，不需要 hydrate | 只对"交互岛屿"（按钮/表单）hydrate，静态内容不加载 JS（Astro/Nuxt Islands） |
| **Lazy Hydration** | 首屏可视区域外的组件不需要立即 hydrate | 组件进入视口时才 hydrate（`nuxt-lazy-hydrate`） |
| **Progressive Hydration** | 一次性 hydrate 阻塞主线程 | 分批 hydrate，类似 React 的时间切片思路 |
| **RSC（React Server Components）** | 组件 JS 不需要下载到客户端 | 纯服务端组件不发 JS 到浏览器，0 hydration 成本 |
| **Partial Prerendering** | SSR + 静态混合 | 静态部分直接 CDN 出（秒出），动态部分流式填入（Next.js 14） |

### Nuxt 可用的优化

```ts
// 1. 流式渲染（Nuxt 3 默认支持）
// nuxt.config.ts — 无需配置，Nuxt 3 默认 renderToWebStream

// 2. Lazy Hydration（延迟 hydrate 非关键组件）
<template>
  <LazyHydrate when-visible>   <!-- 进入视口时才 hydrate -->
    <HeavyChart />
  </LazyHydrate>
  <LazyHydrate when-idle>      <!-- 浏览器空闲时 hydrate -->
    <Footer />
  </LazyHydrate>
</template>

// 3. Islands 模式（Nuxt 3.x 实验性）
// 静态内容不发 JS，只对交互组件发 JS
<NuxtIsland name="ThreeViewer" :props="{ modelUrl }" />
```

### 一句话总结

**SSR 牺牲 TTI 换 FCP + SEO。** 所有 SSR 优化手段的本质 = 缩短 FCP 到 TTI 之间那段"看得见但点不动"的 gap。

---

## 数据预取

**问题：组件需要的数据从哪来？服务端渲染时要先拿到数据才能渲染完整 HTML。**

### Vue 3 方案：`onServerPrefetch`

```vue
<script setup>
import { onServerPrefetch, ref } from 'vue';

const data = ref(null);

// 只在服务端执行，客户端不跑
onServerPrefetch(async () => {
  data.value = await fetchData();
});

// 客户端 hydrate 后，从 window.__INITIAL_STATE__ 恢复
</script>
```

### 状态序列化与恢复

```
服务端：数据预取 → 存入 store → 渲染 HTML → 序列化 store 到 HTML 中
客户端：从 HTML 中读取序列化的 store → replaceState → hydrate

避免客户端重复请求（数据已经有了）
```

---

## SSR 性能与负载

**核心矛盾：SSR 把渲染压力从浏览器转移到了服务器。每个请求都要 renderToString → CPU 密集。**

### 为什么会有负载问题

```
CSR：服务器只返回静态 HTML 壳子 → Nginx 直接服务 → 无 CPU 压力
SSR：每个请求 → Node.js 执行 Vue 渲染 → CPU 密集型 → 并发高时 Node 扛不住
```

### 优化手段

| 手段 | 原理 | 效果 |
|------|------|------|
| **缓存** | 页面级/组件级缓存，相同请求不重复渲染 | 减少 90%+ 渲染次数 |
| **流式渲染** | `renderToNodeStream` 边渲染边发送 | TTFB 更快，不等整页渲染完 |
| **CDN 缓存** | 纯静态页走 CDN，不过 Node | 零服务器压力 |
| **ISR** | 增量静态再生成（构建时生成 + 过期刷新） | SSG 的速度 + SSR 的实时性 |
| **多进程/集群** | PM2 cluster / K8s 多 Pod | 水平扩容 |
| **降级** | 服务端超时/报错 → 降级为 CSR | 保证可用性 |

### 缓存策略

```
三级缓存：
  1. CDN 缓存（最外层）：纯静态/变化频率低的页面
  2. 页面级缓存（Redis）：同一 URL 在 TTL 内直接返回缓存 HTML
  3. 组件级缓存：高频不变的组件片段缓存（如 Header/Footer）
```

### 降级策略（核心！面试必问）

```
SSR 降级为 CSR：
  正常：请求 → Node SSR → 返回完整 HTML
  异常：请求 → Node 超时/报错 → 返回 SPA 壳子（CSR 兜底）→ 客户端自己渲染

实现：
  try {
    const html = await renderToString(app);  // SSR
    res.send(html);
  } catch (err) {
    res.send(csrFallbackHtml);  // 降级为 CSR
    reportError(err);
  }

保证：SSR 挂了页面还能用，只是首屏慢一点，不白屏。
```

---

## Nuxt.js（Vue SSR 框架）

**为什么用 Nuxt 不自己搭？** 自己搭 Vue SSR 要处理路由匹配、数据预取、状态序列化、构建配置、开发热更新……Nuxt 帮你全做了。

| 能力 | 自己搭 | Nuxt |
|------|--------|------|
| 路由 | 手动配置 | 文件系统路由（自动） |
| 数据预取 | 手动写 entry-server | `useAsyncData` / `useFetch` |
| 构建 | 配 Webpack/Vite 双端打包 | 内置 |
| 部署 | 自己搞 Node 服务 | `nuxt build` → 多种部署模式 |
| 渲染模式 | 固定 SSR | 按页面选择 SSR/SSG/CSR/ISR |

### Nuxt 3 渲染模式（按页面配置）

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },           // SSG：构建时生成
    '/dashboard/**': { ssr: false },    // CSR：后台不需要 SSR
    '/product/**': { isr: 3600 },       // ISR：缓存 1 小时后再生成
    '/api/**': { proxy: 'http://backend' }
  }
});
```

---

## 常见问题与陷阱

| 问题 | 原因 | 解决 |
|------|------|------|
| `window is not defined` | 服务端没有 window/document | 用 `onMounted` 或 `<ClientOnly>` 包裹 |
| Hydration mismatch | 两端渲染结果不一致 | 不用随机值/时间戳，用 `useId()` |
| 内存泄漏 | 服务端单例共享（store/router） | 每个请求创建新实例 |
| 首次加载 JS 大 | SSR + 客户端 Bundle 都要下载 | Code Splitting + 懒加载路由 |
| 服务器压力大 | 每个请求都渲染 | 缓存 + 降级 + CDN |

---

## 面试高频问题

| 问题 | 一句话答案 |
|------|-----------|
| SSR 本质是什么？ | 同一套代码服务端跑一遍出 HTML，客户端再 hydrate 变成 SPA |
| Hydration 做了什么？ | 复用服务端 DOM + 绑定事件 + 激活响应式，不重新创建 DOM |
| 为什么每个请求要新建实例？ | 防止请求间状态交叉污染（Node 是多用户共享进程） |
| SSR 服务器压力大怎么办？ | 缓存（CDN/Redis/组件级） + 流式渲染 + 降级为 CSR |
| SSR 和 SSG 怎么选？ | 数据实时性要求高 → SSR；内容不常变 → SSG/ISR |
| Vue SSR 和 React SSR 区别？ | 原理一样，API 不同（renderToString），Vue 有 Nuxt，React 有 Next.js |

---

## 高阶场景：3D 平台 + SSR（Vast 场景）

> 3D 模型生成平台 + SEO 获客 + Nuxt 4 SSR，会遇到的专家级问题。

### 1. 3D 内容不能 SSR，但页面需要 SSR

```
矛盾：Three.js/WebGL 依赖浏览器 API（canvas/GPU）→ 服务端跑不了
     但页面需要 SSR（SEO + 首屏速度）

解法：分区渲染
  服务端：SSR 出页面骨架（标题/描述/结构化数据/3D viewer 占位符）
  客户端：hydrate 后再加载 Three.js → 渲染 3D 模型
```

```vue
<template>
  <ModelMeta :model="model" />          <!-- SSR → 爬虫能索引 -->
  <ClientOnly>
    <ThreeViewer :modelUrl="model.url" />  <!-- 只在客户端渲染 -->
    <template #fallback>
      <ModelPreviewImage :src="model.thumbnail" />  <!-- SSR 时显示预览图 -->
    </template>
  </ClientOnly>
</template>
```

### 2. 动态 OG Meta（社交分享卡片）

每个用户生成的 3D 模型都有独立 URL，分享到 Twitter/Discord 时需要展示卡片：

```ts
// Nuxt 中动态生成 meta（服务端渲染时执行）
const { data: model } = await useFetch(`/api/models/${route.params.id}`);

useHead({
  title: model.value.name,
  meta: [
    { property: 'og:title', content: model.value.name },
    { property: 'og:image', content: model.value.thumbnailUrl },
    { property: 'og:description', content: model.value.description },
  ]
});
```

### 3. 流式 SSR + 3D 模型预加载

```
普通 SSR：等整页数据就绪 → renderToString → 一次性返回（TTFB 慢）
流式 SSR：renderToWebStream → 边渲染边返回（TTFB 快）

配合预加载：HTML <head> 中注入：
  <link rel="preload" href="/models/xxx.glb" as="fetch" crossorigin />
  → 浏览器在 hydrate 之前就开始下载 3D 模型文件
  → Three.js 初始化后模型已在缓存 → 秒出
```

### 4. ISR/SWR 缓存策略（热门模型高并发）

```ts
// nuxt.config.ts — 按页面类型选渲染/缓存策略
export default defineNuxtConfig({
  routeRules: {
    '/model/:id': { isr: 3600 },        // 模型详情：ISR 1 小时再生成
    '/explore': { swr: 60 },            // 发现页：SWR 60 秒缓存
    '/dashboard/**': { ssr: false },    // 后台：纯 CSR
    '/': { prerender: true },           // 首页：构建时静态生成
  }
});
```

### 5. Hydration Mismatch 在 3D 场景中的陷阱

```
常见坑：
  服务端渲染 <div class="viewer-placeholder">
  客户端 hydrate 后替换为 <canvas>
  → DOM 结构不一致 → mismatch warning

解法：
  - <ClientOnly> 隔离（服务端不渲染 3D 相关 DOM）
  - onMounted 延迟初始化 Three.js（hydrate 完成后再动 DOM）
  - useId() 保持动态 id 一致
```

### 6. 跨请求状态泄漏

```
问题：Node 单进程多用户共享 → 单例 store 会导致用户 A 数据泄漏给用户 B

Nuxt 默认处理了（每个请求创建新 Pinia 实例）
但自定义全局缓存、数据库连接池、第三方 SDK 初始化时仍需注意
```

### 7. SSR 降级 + 3D 加载失败兜底

```
三层降级：
  1. SSR 渲染失败 → 降级为 CSR（返回 SPA 壳子，页面能用只是首屏慢）
  2. 3D 模型加载失败 → 展示静态预览图 + "3D viewer 加载失败"提示
  3. 整页白屏 → Sentry 上报 + 用户友好错误页
```

### 专家级 SSR 能力分层

| 层级 | 能力 |
|------|------|
| 基础 | renderToString、hydrate、知道 SSR 是什么 |
| 中级 | 数据预取、状态序列化、Nuxt 使用、基本部署 |
| 高级 | 流式渲染、ISR/SWR 缓存策略、降级机制、性能调优 |
| 专家 | 3D+SSR 混合架构、OG meta 动态生成、跨请求隔离、CDN Edge 缓存、SEO 工程化 |
