# 构建与研发流程工程化

> 解决什么问题：代码从开发者本地到用户浏览器，中间每一步怎么自动化、标准化、可控。
>
> 本质：把"人记住规范并手动执行"变成"机器自动执行并卡控"。
>
> 场景：DD 运营平台（微前端多子应用独立构建/发布）、MT 搭建系统（CLI + CI/CD 全套）。

---

## 目录

- [全链路视图](#全链路视图)
- [构建工具：Webpack vs Vite](#构建工具webpack-vs-vite)
  - [原生 ES Module（ESM）](#原生-es-moduleesm-vite-的底层依赖)
- [CI/CD 流水线设计](#cicd-流水线设计)
- [代码质量卡控](#代码质量卡控)
- [脚手架 & CLI](#脚手架--cli)
- [微前端场景的构建策略](#微前端场景的构建策略)
- [Q&A](#qa)

---

## 全链路视图

```
开发者写代码 → 提交代码 → 构建 → 检查 → 部署 → 线上

每一步的工程化手段：
  编码：ESLint + Prettier + TypeScript（实时反馈）
  提交：Git Hooks（husky + lint-staged，提交前自动检查）
  构建：Webpack/Vite（编译 + 打包 + 优化）
  检查：CI 流水线（单测 + 类型检查 + 构建产物分析）
  部署：灰度发布 + CDN 分发 + 版本管理
  线上：监控 + 告警 + 回滚能力
```

---

## 构建工具：Webpack vs Vite

| 维度 | Webpack | Vite |
|------|---------|------|
| **开发体验** | 冷启动慢（全量打包） | 秒启动（原生 ESM + 按需编译） |
| **HMR** | 全模块图更新（慢） | 精确到模块（快） |
| **生产构建** | 成熟稳定，生态最大 | Rollup 底层，产物一致 |
| **配置复杂度** | 高（loader/plugin 链） | 低（约定优于配置） |
| **适合** | 大型存量项目、需要深度定制 | 新项目、追求开发体验 |

**本质区别**：
- Webpack = 打包器思维（所有文件打成 bundle）
- Vite = 原生模块思维（开发时不打包，浏览器直接加载 ESM）

### 原生 ES Module（ESM）—— Vite 的底层依赖

```
第一性问题：浏览器能不能直接运行模块化代码，不需要打包工具？

答案：从 2018 年起可以了。浏览器原生支持 <script type="module">。

<script type="module">
  import { add } from './math.js';  // 浏览器自己发请求加载 math.js
  console.log(add(1, 2));
</script>

本质：
  import 语句 = 浏览器发一个 HTTP 请求去拿模块文件
  不需要 Webpack 预先把所有文件打成一个 bundle
  浏览器自己就是"模块加载器"

为什么之前需要 Webpack：
  - 浏览器不支持 import（2018 年之前）
  - HTTP/1.1 下大量小文件请求性能差（队头阻塞）
  - 需要编译 TS/JSX/SCSS 等非原生格式

为什么现在可以不打包（Vite 的前提）：
  - 浏览器都支持 ESM 了（Chrome 61+, 2017）
  - HTTP/2 多路复用（100 个小文件和 1 个大文件网络成本差不多）
  - 编译可以按需做（请求哪个文件才编译哪个，不全量编译）
```

```
Vite 开发时的工作方式：

  浏览器请求 main.tsx
    → Vite 开发服务器收到请求
    → 实时编译 main.tsx（TS → JS，几毫秒）
    → 返回编译后的 JS（里面的 import 保持原样）
    → 浏览器解析 import → 再发请求加载依赖模块
    → 按需加载，用到才编译

  vs Webpack：
    启动时扫描整个项目 → 构建完整模块依赖图 → 打包成 bundle → 才能访问
    改一行代码 → 重新构建受影响的 chunk → 推送到浏览器

  = Vite 把"全量编译"变成"按需编译"
  = 启动快（不需要全量构建）+ HMR 快（只更新一个模块）
```

**一句话**：ESM 让浏览器自己成为模块加载器，Vite 只做"请求时实时编译"这一件事，把 Webpack 的"全量打包"去掉了。但生产构建仍然需要打包（用 Rollup），因为线上不能让用户浏览器发几百个请求。

**DD 场景选择**：存量微前端子应用大概率还是 Webpack 5（Module Federation 需要），新子应用可以用 Vite。

### 核心概念速查

| 概念 | 是什么 | 为什么重要 |
|------|--------|-----------|
| Tree Shaking | 删除未使用的 export | 减小产物体积 |
| Code Splitting | 按路由/组件拆分 chunk | 首屏只加载需要的 |
| HMR | 模块热替换，不刷新页面更新代码 | 开发体验 |
| Source Map | 编译后代码映射回源码 | 线上错误定位 |
| Loader | 文件转换器（TS→JS、SCSS→CSS） | 处理非 JS 资源 |
| Plugin | 构建流程钩子扩展 | 自定义构建行为 |

---

## CI/CD 流水线设计

```
典型前端 CI/CD 流水线：

  Push/MR 触发
    → 安装依赖（pnpm install）
    → 类型检查（tsc --noEmit）
    → Lint 检查（eslint）
    → 单元测试（vitest run）
    → 构建（vite build / webpack）
    → 产物分析（bundle size check）
    → 部署到预发环境
    → E2E 测试（Playwright）
    → 灰度发布（1%）
    → 观察指标
    → 全量发布

关键卡点（任一失败则阻断）：
  ❌ 类型错误 → 不允许构建
  ❌ Lint 未通过 → 不允许合并
  ❌ 单测失败 → 不允许部署
  ❌ Bundle 体积超标 → 需审批
```

---

## 代码质量卡控

```
三层卡控（从近到远）：

  编码时（IDE 内）：
    ESLint 实时提示 + Prettier 自动格式化 + TS 类型提示

  提交时（Git Hooks）：
    husky + lint-staged → 只检查本次修改的文件
    commitlint → 规范 commit message

  CI 时（流水线）：
    全量 Lint + 类型检查 + 单测 + 构建
    Code Review 自动化（AI Review / 规则检查）

本质：越早发现问题，修复成本越低。
```

---

## 脚手架 & CLI

```
为什么需要 CLI：
  - 新项目初始化（模板 + 配置 + 依赖）→ 5min 搞定
  - 发布流程标准化（不靠人记步骤）
  - 开发工具集成（本地调试服务器、Mock、代理）

CLI 设计（plugin 机制）：
  ┌────────────────────────────────────┐
  │           CLI Core                 │
  │  （流程编排：init → dev → build → publish）│
  │                                    │
  │  每个阶段暴露 Hook：               │
  │    beforeInit / afterInit          │
  │    beforeBuild / afterBuild        │
  │    beforePublish / afterPublish    │
  └─────────────┬──────────────────────┘
                │
    ┌───────────┼───────────┐
    ↓           ↓           ↓
  plugin-A   plugin-B   plugin-C
  (审批卡控)  (CDN上传)  (通知群)

类比 Webpack 的 tapable 机制：核心只做流程编排，扩展靠插件。
```

---

## 微前端场景的构建策略

```
挑战：多个子应用独立构建，但共享依赖、统一部署

策略：
  1. 各子应用独立构建产物（独立 CI/CD）
  2. 共享依赖外置（externals + CDN 或 Module Federation shared）
  3. 主应用只构建自己，子应用产物部署到独立路径
  4. 构建产物 hash 命名（缓存友好）
  5. 增量构建（Turborepo，只构建变更的子应用）

发布策略：
  子应用独立发布 → 不需要重新构建主应用
  主应用发布 → 子应用不受影响
  → 发布解耦，团队独立迭代
```

---

## Q&A

**Q：Webpack 和 Vite 的 HMR 原理有什么区别？**

A：Webpack HMR 需要重新构建整个 module graph 中受影响的部分，通过 WebSocket 推送更新的 chunk。Vite 利用原生 ESM，只需要让浏览器重新请求变更的模块（URL 带时间戳），不需要打包过程，所以快。

**Q：Tree Shaking 的前提条件是什么？**

A：必须是 ES Module（静态 import/export），CommonJS 的 require 是动态的无法分析。另外 sideEffects: false 标记告诉打包器"这个包没有副作用，未使用的 export 可以安全删除"。

**Q：CI/CD 流水线太慢怎么优化？**

A：
- 缓存：依赖缓存（pnpm store）、构建缓存（Turborepo/nx）
- 并行：Lint/Test/Build 并行跑
- 增量：只跑受影响的包（Monorepo 场景）
- 分阶段：快检查先跑（Lint 10s），慢检查后跑（E2E 3min）

**Q：怎么保证多个子应用的构建配置统一？**

A：Monorepo + 共享配置包（@org/webpack-config、@org/eslint-config），子应用 extend 基础配置，不允许各自魔改。
