# 微前端

> 深入阅读：
> - [乾坤（qiankun）原理](./qiankun.md)
> - [模块联邦（Module Federation）原理](./module-federation.md)
> - [无界（Wujie）方案](./wujie.md)
> - [Web Components 方案](./web-components.md)
> - [iframe 优缺点与选型](./iframe.md)

---

## 目录

- [本质问题](#本质问题)
- [为什么需要微前端](#为什么需要微前端)
- [核心概念](#核心概念)
- [三大方案对比](#三大方案对比)
- [怎么选](#怎么选)
- [通用知识点](#通用知识点)
  - [子应用通信](#子应用通信)
  - [样式隔离](#样式隔离)
  - [JS 沙箱](#js-沙箱)
  - [路由设计](#路由设计)
  - [部署方案](#部署方案)
- [和 Monorepo 的关系](#和-monorepo-的关系)
- [和 RN 多 Bundle 的类比](#和-rn-多-bundle-的类比)
- [什么时候不该用微前端](#什么时候不该用微前端)
- [高频面试问题](#高频面试问题)

---

## 本质问题

> 一个大型后台系统，多个团队开发不同模块，怎么做到独立开发/独立部署/独立运行，又能聚合成一个统一的应用？

**微前端 = 把巨石应用拆成多个独立子应用，每个子应用独立仓库、独立构建、独立部署，通过主应用（基座）聚合在一起。**

场景：DD 运营平台（多团队/多业务模块聚合）、MT 打车后台。

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

## 三大方案对比

| 维度 | qiankun | Module Federation | Web Components |
|------|---------|-------------------|----------------|
| **抽象层级** | 应用级 | 模块级 | 组件级 |
| **隔离由谁提供** | JS 沙箱（Proxy 模拟） | 无隔离，靠约定 | 浏览器原生（Shadow DOM） |
| **加载单位** | 整个 HTML/JS 应用 | 单个 JS 模块 | 自定义元素 |
| **技术栈依赖** | 框架无关 | 依赖构建器（Webpack/Rspack） | 零依赖，W3C 标准 |
| **运行时成本** | 高（沙箱、DOM 隔离） | 低（纯模块加载） | 中（Shadow DOM） |
| **适用场景** | 异构技术栈、独立部署 | 同构技术栈、模块复用 | 组件级嵌入、强样式隔离 |
| **成熟度** | 高（蚂蚁/阿里大量使用） | 高（Webpack 5 内置） | 中（生态还在发展） |

**一句话**：
- **qiankun** = "多个应用拼成一个页面"（像操作系统多窗口）
- **Module Federation** = "一个应用拆成多个构建"（像分布式链接器）
- **Web Components** = "用浏览器原生能力封装隔离组件"（像标准化的积木块）

---

## 怎么选

### 选型决策树

```
技术栈统一？
  ├── 是 → Module Federation（最轻，构建时集成，无运行时额外成本）
  └── 否 → 隔离要求高？
              ├── 高（金融/多租户/不信任子应用）→ Wujie（iframe 级隔离）
              └── 一般 → qiankun（生态最成熟，踩坑成本最低）
```

### 对比选型表

| 决策维度 | qiankun | Wujie | Module Federation |
|---------|---------|-------|-------------------|
| **隔离** | Proxy 沙箱（够用，有逃逸风险） | iframe 级（彻底） | 无隔离（同框架信任） |
| **技术栈** | 混合（Vue2 + React 等） | 混合 + 极端差异 | 统一（都用 React/Vue） |
| **接入成本** | 中（子应用改造少） | 中（近乎零改造） | 高（构建配置 + DevOps） |
| **性能** | 好 | 一般（iframe 有开销） | 最好（无运行时 overhead） |
| **生态/社区** | ⭐⭐⭐⭐⭐ 国内主流 | ⭐⭐⭐ 腾讯验证 | ⭐⭐⭐⭐ 海外主流 |
| **适用** | 老项目渐进拆分 | 新项目 / 隔离敏感 | 新项目 + 统一框架 |

### 场景速查

| 场景 | 推荐 |
|------|------|
| 已有巨石应用拆分、多团队 | qiankun |
| 新项目 + 同构技术栈 + 模块复用 | Module Federation |
| 隔离要求极高（子应用不可信） | Wujie |
| 只是想跨项目复用组件 | Module Federation 或 npm 包 |

### MF 怎么做微前端

Module Federation 做微前端不是"运行时加载子应用"，是**构建时声明远程模块，运行时按需加载**：

```js
// 应用 A（Host）— webpack.config.js
new ModuleFederationPlugin({
  remotes: {
    appB: 'appB@https://cdn.example.com/appB/remoteEntry.js'
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } }
})

// 应用 A 代码里直接 import 远程模块：
const AppBPage = React.lazy(() => import('appB/Page'))
```

```js
// 应用 B（Remote）— webpack.config.js
new ModuleFederationPlugin({
  name: 'appB',
  filename: 'remoteEntry.js',
  exposes: {
    './Page': './src/pages/HomePage'  // 暴露这个模块给其他应用
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } }
})
```

**本质**：每个应用独立构建部署，运行时通过 `remoteEntry.js`（manifest）动态加载对方暴露的模块。`shared` 配置避免 React 等重复加载。

**和 qiankun 的核心区别**：

| | qiankun | Module Federation |
|--|---------|-------------------|
| 粒度 | 应用级（整个子应用） | 模块级（一个组件/页面） |
| 加载方式 | fetch HTML → 解析执行 | import() 动态加载 JS chunk |
| 隔离 | Proxy 沙箱 | 无（共享同一个 runtime） |
| 部署 | 子应用独立域名 | 各应用独立部署，共享 CDN 入口 |
| 适合 | "多个独立应用拼在一起" | "多个应用共享组件/页面" |

---

## 通用知识点

### 子应用通信

| 方式 | 适合 | 原理 |
|------|------|------|
| Props 传递 | 父传子（主→子） | 主应用 mount 时传 props |
| 全局状态（qiankun initGlobalState） | 双向通信 | 发布订阅模式 |
| CustomEvent | 松耦合通信 | 浏览器原生事件 |
| URL 参数 | 简单数据 | 路由 query/hash |
| 共享状态库 | 深度共享 | 同一个 Pinia/Redux 实例（Module Federation） |

### 样式隔离

| 方案 | 原理 | 适用 |
|------|------|------|
| 动态 stylesheet | mount 加载 CSS，unmount 移除 | 单实例（基本够用） |
| Shadow DOM | 子应用挂在 Shadow Root 内，样式天然隔离 | 多实例并存 |
| CSS Scoped 前缀 | 动态给选择器加 `div[data-qiankun="app1"]` 前缀 | 多实例 |
| CSS Modules / BEM | 约定命名规范 | 任何情况（靠纪律） |

### JS 沙箱

| 方案 | 原理 | 适用 |
|------|------|------|
| 快照沙箱 | mount 前快照 window，unmount 后恢复 | 单实例 |
| Proxy 沙箱 | Proxy 代理 window，每个子应用独立 fakeWindow | 多实例 |
| iframe 沙箱 | 子应用 JS 跑在 iframe 的 contentWindow 里 | Wujie 方案 |

### 路由设计

```
主应用路由（一级）：
  /activity/*   → 加载 activity-app
  /strategy/*   → 加载 strategy-app
  /dashboard/*  → 加载 dashboard-app

子应用路由（二级）：
  /activity/list    → 活动列表
  /activity/create  → 创建活动
  /activity/:id     → 活动详情

子应用路由 base：
  router = createRouter({ history: createWebHistory('/activity') })
```

### 部署方案

```
各子应用独立部署（独立域名或独立路径）：
  主应用：https://ops.dd.com/
  activity-app：https://ops.dd.com/micro/activity/
  strategy-app：https://ops.dd.com/micro/strategy/

Nginx：
  location /micro/activity/ { proxy_pass http://activity-server/; }
  location /micro/strategy/ { proxy_pass http://strategy-server/; }

发布互不影响：activity-app 发版不需要动主应用或其他子应用
```

---

## 和 Monorepo 的关系

```
微前端的拆分边界 = DDD 的限界上下文（Bounded Context）

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

Monorepo 好处：共享代码直接引用、统一配置、原子提交，但子应用仍然独立构建/独立部署。

---

## 和 RN 多 Bundle 的类比

| | Web 微前端 | RN 多 Bundle |
|---|---|---|
| 基座 | 主应用（路由分发 + 公共 UI） | Native 壳（原生路由 + 容器） |
| 子应用 | 独立 SPA（独立构建/部署） | 独立 Bundle（独立打包/热更新） |
| 加载 | fetch HTML → 解析 → 执行 JS | 下载 .hbc → 创建 ReactInstance → 执行 |
| 隔离 | JS 沙箱 + 样式隔离 | 独立 ReactInstance（天然隔离） |
| 通信 | GlobalState / CustomEvent | Native EventEmitter / 原生路由参数 |

本质是同一个问题：大型应用拆分为独立模块，独立开发/部署，通过统一基座聚合。

---

## 什么时候不该用微前端

| 场景 | 结论 |
|------|------|
| 团队就 2-3 人 | ❌ 复杂度大于收益 |
| 项目刚开始 | ❌ 先做好模块拆分就行 |
| 只是想复用组件 | ❌ 用 npm 包 / Module Federation |
| 多团队 + 多模块 + 独立发版需求 | ✅ |
| 遗留系统改造（Vue 2 → Vue 3 渐进升级） | ✅ |

---

## 高频面试问题

| 问题 | 答案要点 |
|------|---------|
| 微前端解决什么问题？ | 多团队独立开发/部署/技术栈混用，互不阻塞 |
| qiankun 原理？ | fetch HTML → 解析 JS/CSS → Proxy 沙箱执行 → mount 到容器 |
| JS 沙箱怎么实现？ | Proxy 代理 window，读写走 fakeWindow，unmount 时丢弃 |
| 样式怎么隔离？ | Shadow DOM / scoped 前缀 / CSS Modules |

---

## 生产实际问题（经验向）

### qiankun 常见坑

| 问题 | 原因 | 解法 |
|------|------|------|
| **样式污染** | 子应用 CSS 泄漏到主应用或其他子应用 | CSS Modules + PostCSS 自动加 namespace 前缀；或 `strictStyleIsolation: true`（Shadow DOM） |
| **JS 沙箱逃逸** | `document.title`/`document.body` 等仍共享 | 感知风险点，关键属性用主应用统一管理 |
| **子应用路由冲突** | `history.pushState` 和主应用冲突 | 子应用加 `base` 路径（如 `/sub-app/`），主应用按前缀分发 |
| **子应用白屏** | publicPath 配错 / CORS | 动态 `__webpack_public_path__` + 服务端配 CORS |
| **首次加载慢** | 子应用资源全量下载 | `prefetchApps` 预加载 + 资源缓存 |
| **子应用间通信** | 直接改全局变量不可控 | `initGlobalState` 或自定义 EventBus |

### Module Federation 常见坑

| 问题 | 原因 | 解法 |
|------|------|------|
| **共享依赖版本不一致** | A 用 React 17，B 用 React 18 | `shared: { react: { singleton: true, requiredVersion: '^18' } }` |
| **运行时加载失败** | 远程模块 CDN 挂了 | try-catch + fallback UI 降级 |
| **类型丢失** | 远程模块没有 TS 类型 | `@module-federation/typescript` 自动生成 |

### 话术（样式污染故事）

> "用 qiankun 遇到的最典型问题是样式污染 — 子应用 A 的全局 `.btn` 覆盖了子应用 B 的按钮。排查后发现默认 CSS 隔离（动态 style 标签移除）对全局 link 标签无效。最终方案：子应用全部用 CSS Modules + 打包时 PostCSS 插件自动加 namespace 前缀，从根本上消除全局样式。"
| 子应用间怎么通信？ | GlobalState（发布订阅）/ CustomEvent / URL 参数 |
| 和 iframe 的区别？ | iframe 天然隔离但体验差；微前端隔离可控 + 体验好 |
| Module Federation 和 qiankun 区别？ | MF 是模块级共享（运行时链接），qiankun 是应用级聚合（运行时容器） |
| Web Components 的优势？ | 浏览器原生隔离，零框架依赖，标准化 |
| 什么时候不该用？ | 团队小/项目小/只想复用组件 → 过度工程化 |
