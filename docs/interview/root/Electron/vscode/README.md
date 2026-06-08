# VS Code 架构

> VS Code 不是普通的 Electron 三层架构（Main/Preload/Renderer），而是"Main + Renderer + N 个功能进程"的多进程架构。核心创新是 Extension Host——让第三方插件在隔离进程中运行。
>
> 场景：快应用 IDE 基于 VS Code 二次开发，这是你的直接经验。

---

## 目录

- [多进程架构总览](./process-model.md) — 进程全景图 / 各进程职责 / 为什么这么设计
- [Extension Host（插件宿主）](./extension-host.md) — 独立进程 / 插件加载 / API 暴露 / 隔离与通信
- [LSP（Language Server Protocol）](./lsp.md) — 语言服务独立进程 / 协议设计 / 为什么不跑在 Extension Host 里

---

## 一句话

```
普通 Electron 应用：Main + Renderer（两三个进程）
VS Code：Main + Renderer + Extension Host + N 个 Language Server + Terminal + FileWatcher + Search
= 每种"可能卡住"或"可能崩溃"的能力都隔离到独立进程
= 任何子进程崩溃都可以重启，不影响编辑器 UI
```
