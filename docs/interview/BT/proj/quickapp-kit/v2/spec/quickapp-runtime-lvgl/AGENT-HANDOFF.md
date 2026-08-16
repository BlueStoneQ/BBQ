# LVGL Runtime Spec Agent Handoff

启动阅读：本文件、`../README.md`、`../../AGENT-WORK-BOARD.md`，以及 `projects/quickapp-runtime-lvgl/README.md`。

目标：定义 LVGL/SDL Platform Adapter，验证嵌入式 Host 映射、输入、生命周期、内存和线程约束。

LVGL 类型只存在 Platform 层；输入转换为 `EventMessage`；Core 只接收平台无关协议。

## 交接记录

### 2026-08-15 / 总架构 Agent

- 事件：启动 LVGL Runtime Spec 并行设计。
- 意图：LVGL 用来验证 Core 的轻量性、移植性和可观测性。
