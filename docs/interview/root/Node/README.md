# Node.js 知识体系

> 定位：前端 Leader 视角的 Node.js——不是后端工程师深度，是"能用 Node 解决前端工程化 + BFF + 工具链问题"的水平。
>
> 场景：DD（Node.js 微前端/BFF）、KS（后端语言加分项）、负载分析平台（全栈）。

---

## 目录

### 一、运行时原理

- [事件循环与异步模型](./event-loop.md) — Event Loop / 宏微任务 / libuv / 和浏览器的区别

### 二、核心模块

- [Stream 与 Buffer](./stream-buffer.md) — 流式处理 / 背压 / SSR 流式渲染的底层

### 三、工程实践

- [BFF 与中间层](./bff.md) — 为什么前端要 BFF / API 聚合 / 鉴权 / 架构模式
- [GraphQL](./graphql.md) — 查询语言本质 / Schema + Resolver / N+1 问题 / 与 REST 对比 / 在 BFF 中的定位
- [NestJS](./nestjs.md) — 企业级 Node 框架 / DI + 模块 + 装饰器 / 做 BFF 中间层 / GraphQL 集成
- [进程管理与部署](./process-deploy.md) — cluster / PM2 / Docker / 优雅重启
- [Node 服务稳定性与可用性](./node-service-reliability.md) — 并发能力 / 事件循环不阻塞 / 容错降级 / 监控体系
- [可观测体系](./observability.md) — 指标详解 / 探针原理 / 选型 / 后端分析平台
- [场景实战](./scenarios.md) — 文件上传 / 具体业务场景核心代码
