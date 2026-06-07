# 微前端

> 深入阅读：
> - [乾坤（qiankun）原理](./qiankun.md)
> - [模块联邦（Module Federation）原理](./module-federation.md)
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

| 场景 | 推荐方案 |
|------|---------|
| 已有巨石应用拆分、多团队 | qiankun |
| 新项目 + 同构技术栈 + 模块复用 | Module Federation |
| 对隔离要求极高（子应用不可信） | Wujie（iframe + Web Components） |
| 追求接入简单、组件级嵌入 | micro-app / Web Components |
| 只是想复用组件 | npm 包 / Module Federation |

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
| 子应用间怎么通信？ | GlobalState（发布订阅）/ CustomEvent / URL 参数 |
| 和 iframe 的区别？ | iframe 天然隔离但体验差；微前端隔离可控 + 体验好 |
| Module Federation 和 qiankun 区别？ | MF 是模块级共享（运行时链接），qiankun 是应用级聚合（运行时容器） |
| Web Components 的优势？ | 浏览器原生隔离，零框架依赖，标准化 |
| 什么时候不该用？ | 团队小/项目小/只想复用组件 → 过度工程化 |
