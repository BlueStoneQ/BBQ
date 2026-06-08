# Electron 知识体系

> 定位：基于 Electron 的桌面端架构（快应用 IDE / VS Code 二次开发）。

---

## 目录

### 总览

- [Electron 总览](./overview.md) — 第一性原理 / 概念速查 / 经验对应
- [实战演练：从例子理解全貌](./walkthrough.md) — 选择文件+上传完整例子 / 数据流向 / 视图类型 / IPC 底层

### 核心原理

- [架构与进程模型](./architecture.md) — Main/Renderer 进程 / 安全模型 / preload
- [IPC 通信](./ipc.md) — invoke/handle / send/on / 通信模式 / 性能
- [性能优化](./performance.md) — 包体 / 启动速度 / 内存 / 渲染 / 检测工具

### 工程实践

- [项目结构与构建](./project-structure.md) — 目录组织 / 打包 / 自动更新 / 生态库 / 环境搭建
- [构建链路与配置文件](./build-config.md) — 全链路（编译→打包→签名→发布）/ 每个配置文件范例
- [DDD + Monorepo 架构](./ddd-monorepo.md) — 多团队多视图 / WebContentsView 隔离 / 通信原则
- [核心模块](./core-modules.md) — 路由 / 网络 / 存储 / 更新 / 原生能力
- [开发速查](./dev-cheatsheet.md) — API 对象分类 / 常用命令 / 关键配置 / 生命周期 / 常见模式

### VS Code 架构（IDE 开发）

- [VS Code 架构（目录）](./vscode/README.md) — 多进程模型 / Extension Host / LSP
  - [多进程架构](./vscode/process-model.md)
  - [Extension Host](./vscode/extension-host.md)
  - [LSP 协议](./vscode/lsp.md)
- [VS Code 架构分析（旧）](./vscode-architecture.md)
- [IDE 插件系统（旧）](./ide-plugin-system.md)

### Q&A

- [Electron Q&A](./qa.md) — 架构本质 / IPC 底层 / Preload / 窗口进程 / 开发实践
