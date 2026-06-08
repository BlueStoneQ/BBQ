# 快应用 IDE（VS Code 二次开发）

> 基于 VS Code（Electron）的集成开发环境，覆盖快应用开发全链路。

---

## 目录

### 总览

- [项目总览](./overview.md) — IDE 本体 4 点核心改动 / Extension 层业务功能 / 设计原则

### IDE 本体改动

- [二开全景与改造清单](./customization-checklist.md) — Level 1~3 改造分级 / product.json / 构建发布 / 上游同步策略
- [暴露 API：Header WebView 区域](./custom-api-header-webview.md) — 方案设计 / ViewContainer 复用 / 3 处源码改动 / 全链路 RPC
- [内置插件自动安装](./builtin-extension-install.md) — 首次启动从商店拉取 / Workbench Contribution 机制 / 容错

### Extension 层

- [LSP 语言服务器](./lsp.md) — 快应用语言支持实现
- [构建打包方案](./build-pipeline.md) — rpk 构建链路 / 编译工具链
