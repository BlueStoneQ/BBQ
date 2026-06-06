# Node.js 知识体系

> 定位：前端 Leader 视角的 Node.js——不是后端工程师深度，是"能用 Node 解决前端工程化 + BFF + 工具链问题"的水平。
> 场景：DD（Node.js 微前端/BFF）、KS（后端语言加分项）、负载分析平台（全栈）。

---

## 目录

### 一、运行时原理

- [事件循环与异步模型](./event-loop.md) — Event Loop / 宏微任务 / libuv / 和浏览器的区别

### 二、核心模块

- [Stream 与 Buffer](./stream-buffer.md) — 流式处理 / 背压 / SSR 流式渲染的底层

### 三、工程实践

- [BFF 与中间层](./bff.md) — 为什么前端要 BFF / GraphQL / API 聚合 / 鉴权
- [进程管理与部署](./process-deploy.md) — cluster / PM2 / Docker / 优雅重启
