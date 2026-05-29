# Electron

## 第一性原理

**问题**：Web 技术（HTML/CSS/JS）只能在浏览器沙箱里跑，不能访问文件系统、进程、硬件。

**解决**：把浏览器（Chromium）和系统运行时（Node.js）打包在一起，变成一个桌面应用。

**本质**：Electron = 一个自带浏览器的 Node.js 应用。渲染用 Chromium，系统能力用 Node.js。

```
浏览器 Web App：  Chromium 渲染 UI → 沙箱隔离 → 不能访问系统
Electron App：   Chromium 渲染 UI + Node.js 访问系统 → 打包成桌面应用
```

---

## 文档索引

- [架构与进程模型](./architecture.md)
- [IPC 通信](./ipc.md)
- [项目结构与构建](./project-structure.md)
- [核心大件（路由/网络/存储/更新）](./core-modules.md)

---

## 一句话总结

| 概念 | 本质 |
|------|------|
| 主进程 | 一个 Node.js 进程，管窗口和系统 API |
| 渲染进程 | 一个 Chromium Tab，渲染你的 React App |
| preload | 安全桥接层，白名单暴露 Node 能力给渲染进程 |
| IPC | 进程间通信（和 RN 的 Bridge / Android 的 Binder 同一类问题） |
| BrowserWindow | 一个窗口实例（= Android Activity） |
| electron-builder | 打包工具，产出 .dmg/.exe/.AppImage |

---

## 你的经验

快应用 IDE = 基于 VS Code（Electron）二次开发：
- 主进程：构建编译（child_process）、设备通信（adb/CDP）、依赖分析引擎
- 渲染进程：Monaco Editor、UI 面板
- 插件系统：Extension Host（独立 Node.js 进程）
