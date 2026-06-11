# DD Q&A

> 实际被问到的问题 + 准备记录。按方向分组，每个方向 top5 精选问题。

---

## 目录

- [1. 微前端 + Node.js](#1-微前端--nodejs)
  - [1.1 Node.js 服务指标体系](#11-nodejs-服务指标体系)
  - [1.2 微前端方案](#12-微前端方案)
  - [1.3 BFF 中间层](#13-bff-中间层)
  - [1.4 Node 进程管理与部署](#14-node-进程管理与部署)
  - [1.5 Node 服务稳定性](#15-node-服务稳定性)
  - [1.6 Nuxt 部署方式](#16-nuxt-部署方式)
  - [1.7 Node 探针原理](#17-node-探针原理)
- [2. 前端工程化: Vite / Webpack](#2-前端工程化-vite--webpack)
  - [2.1 ESM 的本质](#21-esm-的本质)
- [3. 体系: 优化/指标/稳定性](#3-体系-优化指标稳定性)
- [4. LowCode](#4-lowcode)
  - [4.1 布局方案对比选型](#41-布局方案对比选型)
  - [4.2 性能/可用性下限保障](#42-性能可用性下限保障)
- [5. 自动化测试](#5-自动化测试)
- [6. AI: SDD + Harness 工程](#6-ai-sdd--harness-工程)
  - [6.1 ReAct Loop 危险命令确认机制](#61-react-loop-危险命令确认机制)
  - [6.2 SDD（Spec-Driven Development）](#62-sddspec-driven-development)
  - [6.3 Harness 质量保障体系](#63-harness-质量保障体系)
- [7. React + TS](#7-react--ts)

---

## 1. 微前端 + Node.js

### 1.1 Node.js 服务指标体系

**Q：负载平台用 Nuxt，Node.js 部分建立了什么指标来衡量可用性、稳定性、性能异常？**

| 维度 | 指标 | 怎么采集 |
|------|------|---------|
| **可用性** | 服务存活率（uptime %）、错误率（5xx / total） | 健康检查 endpoint + Prometheus |
| **性能** | P50/P95/P99 响应时间、QPS、TTFB | APM 探针 / `perf_hooks` |
| **稳定性** | 内存/CPU 使用率、Event Loop Lag、GC 频率 | `process.memoryUsage()` + `perf_hooks.monitorEventLoopDelay()` |
| **异常** | 未捕获异常数、进程重启次数、OOM 次数 | PM2 监控 / K8s Pod restart count |
| **业务** | SSR 渲染成功率、Hydration 错误率、首屏时间 | 自定义埋点 |

**Node 特有关键指标**：

| 指标 | 含义 | 阈值 |
|------|------|------|
| Event Loop Lag | 主线程阻塞程度 | > 100ms 告警 |
| Active Handles / Requests | 未释放的连接/定时器 | 趋势上涨 = 内存泄漏前兆 |
| Heap Used / Heap Total | 堆内存使用 | 持续上涨不回落 = 内存泄漏 |

### 1.2 微前端方案

→ 详见 [微前端 README](../root/Vue/micro-fe/README.md) / [qiankun 详解](../root/Vue/micro-fe/qiankun.md)

### 1.3 BFF 中间层

→ 详见 [BFF 与中间层](../root/Node/bff.md)

### 1.4 Node 进程管理与部署

→ 详见 [进程管理与部署](../root/Node/process-deploy.md)

### 1.5 Node 服务稳定性

→ 详见 [Node 服务稳定性与可用性](../root/Node/node-service-reliability.md)

### 1.6 Nuxt 部署方式

**Q：Nuxt 这种前后端一体的怎么部署？**

`nuxt build` 产物是一个 Node HTTP 服务（不是静态文件），前端 SSR + API 路由跑在同一个进程里。

```bash
nuxt build                          # 产物在 .output/
node .output/server/index.mjs       # 启动 Node HTTP 服务
```

| 部署方式 | 怎么做 |
|---------|--------|
| PM2 | `pm2 start .output/server/index.mjs` |
| Docker | `CMD ["node", ".output/server/index.mjs"]` |
| K8s | Docker → Pod → Service → Ingress |
| Serverless | Vercel / Netlify / Cloudflare Workers（Nuxt 原生支持） |

本质 = 部署一个 Node 服务，和 Express/Koa 没区别。

### 1.7 Node 探针原理

**Q：Node 中的探针原理是什么？Node 提供了什么接口？**

**核心手段：Monkey Patching** — 在应用启动前 hook 原生模块，给关键方法包一层计时：

```js
const originalRequest = require('http').request

// 替换成带计时的版本
http.request = function(...args) {
  const start = Date.now()
  const req = originalRequest.apply(this, args)
  req.on('response', () => {
    report({ url: args[0], duration: Date.now() - start })  // 上报耗时
  })
  return req
}
// 同理 hook pg.query / redis.get / fetch 等
```

**Node 原生提供的 API**：

| API | 作用 |
|-----|------|
| `perf_hooks.monitorEventLoopDelay()` | 检测 Event Loop 延迟 |
| `process.memoryUsage()` | 堆内存 / RSS 使用量 |
| `process.cpuUsage()` | CPU 时间 |
| `async_hooks` | 追踪异步操作生命周期（用于链路追踪：还原"一个请求经过了哪些异步步骤"） |
| `diagnostics_channel` (Node 16+) | 内置诊断事件通道（官方推荐的替代 monkey patch 方案） |

**总结**：探针 = monkey patch 关键模块（计时上报）+ Node 原生 API（内存/CPU/Event Loop）+ async_hooks（链路追踪）。

---

## 2. 前端工程化: Vite / Webpack

→ 详见 [Vite 深度](./engineering/vite.md) / [构建流水线](./engineering/build-pipeline.md)

### 2.1 ESM 的本质

**Q：ESM 的本质是什么？和传统 script 标签有什么区别？**

**本质**：浏览器原生支持的模块系统 — `import` 时浏览器自动发请求加载对应的 JS 文件（按需、独立加载），而不是打成一个大 bundle 一次性下载。

```html
<!-- 传统：一个大 bundle，全量下载 -->
<script src="bundle.js"></script>

<!-- ESM：按 import 依赖图逐个请求 -->
<script type="module" src="main.js"></script>
<!-- main.js 里 import './utils.js' → 浏览器再发请求加载 utils.js -->
<!-- utils.js 里 import './math.js' → 浏览器再发请求加载 math.js -->
```

**和 Vite 的关系**：Vite 开发模式利用浏览器原生 ESM — 不打 bundle，每个文件是独立模块，浏览器按 import 依赖图逐个请求。所以启动快（不等打包）、热更新快（只更新改了的那个文件）。

**生产为什么还要打包**：ESM 按需加载 = 几百个模块 = 几百个 HTTP 请求 → 瀑布流延迟太高。所以生产用 Rollup 打成少量 bundle（兼顾模块化 + 加载性能）。

---

## 3. 体系: 优化/指标/稳定性

→ 详见 [性能优化](./engineering/performance.md) / [稳定性](./engineering/stability.md) / [白屏检测](./engineering/blank-screen-detection.md)

（待补充 top5 问题）

---

## 4. LowCode

### 4.1 布局方案对比选型

**Q：lowcode 的布局方案有哪些？对比选型？能实现 flex 布局吗？**

**本质**：低代码布局 = "如何用可视化操作描述组件的空间关系"。核心是 **编辑态操作方式** 和 **运行态 CSS** 之间的映射。

| 方案 | 编辑态操作 | 运行态 CSS | 适用场景 | Flex 支持 |
|------|-----------|-----------|---------|----------|
| **自由布局** | 拖拽到任意位置（x/y） | `position: absolute` | 海报、H5 活动页 | ❌ |
| **流式布局** | 从上到下排列、拖拽排序 | 正常文档流 block | 表单、文章 | ❌ |
| **栅格布局** | 拖入 N 列网格 | `display: grid` / 12 列 | 后台 Dashboard | 部分 |
| **Flex 容器** | 选方向 + 对齐 + 子项 flex 属性 | `display: flex` | 通用复杂布局 | ✅ |
| **嵌套容器** | 容器套容器，每个容器独立布局 | 嵌套 flex/grid | 最灵活 | ✅ |

**选型本质 — 用户群决定方案**：
- 运营用（H5 活动页）→ 自由布局（像 PPT，所见即所得）
- 开发者用（后台/Dashboard）→ 栅格 + Flex 容器（结构化、响应式）
- 通用搭建平台 → 嵌套容器（最灵活但最复杂）

**能实现 Flex 吗**：能。把 Flex 容器作为一个组件（方向/对齐/间距可配），子组件的 flex-grow/shrink/basis 暴露为属性面板。本质 = 把 CSS Flex 属性映射为 UI 控件。

### 4.2 性能/可用性下限保障

**Q：如何保证低代码页面的可用性和性能下限？兜底页？如何避免无限嵌套？**

**本质**：低代码 = 把写代码的自由度给非开发者。自由度越大出问题概率越大。保障下限 = **限制自由度的边界 + 前置拦截**。

| 问题 | 解法 | 原理 |
|------|------|------|
| 无限嵌套 | 嵌套层级上限（如 5 层） | schema 保存时递归计算深度，超过拒绝保存 |
| 组件过多 | 单页组件数上限（如 50 个） | count 校验，超过提示优化 |
| 大图/大资源 | 上传自动压缩 + 大小限制 | 上传中间件拦截 |
| 死循环/卡顿 | 渲染超时检测 + 错误边界 | ErrorBoundary 包裹每个组件 |
| 白屏兜底 | 全局 ErrorBoundary + 兜底页 | 整页渲染失败 → 兜底 UI + 上报 |
| 发布门禁 | 保存/发布前跑性能预检 | 类似 CI 门禁，不达标不让发布 |

**避免无限嵌套**：

```ts
function validateDepth(schema, maxDepth = 5, current = 0) {
  if (current > maxDepth) throw new Error('嵌套超过限制')
  for (const child of schema.children || []) {
    validateDepth(child, maxDepth, current + 1)
  }
}
```

**核心思路**：前置拦截（schema 校验 + 发布门禁）> 运行时兜底。兜底页是最后防线，不是主要手段。

---

## 5. 自动化测试

（待补充：方案设计）

---

## 6. AI: SDD + Harness 工程

- AI测评 推荐: **spec**模式(规划需求 - deign 技术方案 - 拆解tasks) + **TDD**

### 6.1 ReAct Loop 危险命令确认机制

**Q：ReAct Loop 遇到危险命令（rm -rf / git push / 数据库写入），怎么停下来让用户确认？**

**机制**：Harness 层的 Confirmation Gate（确认门）。

```
Agent ReAct 循环：
  Think → 决定执行危险操作
    ↓
  Harness 拦截器：这个 Tool Call 在"需确认"清单里吗？
    ├── 不在 → 直接执行，循环继续
    └── 在 → 暂停循环 → yield 给 UI → 展示确认弹窗
                            ↓
                   用户确认 → 继续执行
                   用户拒绝 → Agent 收到 rejection → 重新规划或停止
```

**实现本质**：ReAct Loop 是异步状态机，每一步 Tool Call 都是一个 await 点。在 await 点插入确认逻辑 = 暂停循环等待外部输入。

```ts
while (!done) {
  const action = await llm.think(context)

  if (needsConfirmation(action)) {
    const approved = await requestUserConfirmation(action)  // ← while 停在这里等用户
    if (!approved) {
      context.push({ role: 'system', content: 'User rejected this action' })
      continue  // 不执行，让 LLM 重新规划
    }
  }

  const result = await executeTool(action)
  context.push(result)
}
```

**分级策略**：

| 级别 | 操作类型 | 处理 |
|------|---------|------|
| 读操作 | 读文件、搜索、查询 | 自动执行 |
| 低风险写 | 创建文件、修改代码 | 自动执行 |
| 高风险写 | 删除文件、git push、数据库写入 | 确认门暂停 |
| 系统级 | rm -rf、格式化、env 修改 | 直接拒绝 |

### 6.2 SDD（Spec-Driven Development）

→ 详见 [Mako 深度](../../project/AI/mako/mako-project-deep-dive.md)

### 6.3 Harness 质量保障体系

→ 详见 [DD prep § AI 研发体系](./prep.md#1-ai-研发体系最重要)

---

## 7. React + TS

- [TS 类型模式](../root/TS/type-patterns.md) 
- [TS 目录](../root/TS/README.md)
- [React 基础](../../basic/react_interview_basic.md)

（待补充 top5 问题）

---
