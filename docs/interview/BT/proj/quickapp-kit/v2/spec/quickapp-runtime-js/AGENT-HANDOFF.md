# JS Runtime Spec Agent Handoff

启动阅读：本文件、`../README.md`、`../../AGENT-WORK-BOARD.md`，以及 `projects/quickapp-runtime-js/README.md`。

目标：定义 JS Executor 与 JS Framework 的边界，覆盖 app/shared/page 加载、Handler 注册、Binding flush 和 Runtime ABI。

JS 不创建平台对象、不持有运行时 NodeId；更新通过 `RenderTransaction`，能力调用通过 `FeatureRequest`。

## 交接记录

### 2026-08-15 / 总架构 Agent

- 事件：启动 JS Runtime Spec 并行设计。
- 意图：把 JS 执行和平台渲染解耦，明确 JS 到 Core 的数据合同。
