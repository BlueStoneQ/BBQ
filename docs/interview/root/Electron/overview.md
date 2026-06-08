# Electron 总览

> 解决什么问题：用 Web 技术（HTML/CSS/JS）开发桌面应用（Windows/macOS/Linux），一套代码三端跑。
>
> 本质：Electron = Chromium（渲染 UI）+ Node.js（访问系统 API）+ 原生窗口壳。把浏览器和 Node 打包成一个桌面应用。

## 目录

- [第一性原理](#第一性原理)
- [一句话速查](#一句话速查)
- [你的经验](#你的经验)

---

## 第一性原理

**问题**：Web 技术只能在浏览器沙箱里跑，不能访问文件系统、进程、硬件。

**解决**：把浏览器（Chromium）和系统运行时（Node.js）打包在一起，变成一个桌面应用。

```
浏览器 Web App：  Chromium 渲染 UI → 沙箱隔离 → 不能访问系统
Electron App：   Chromium 渲染 UI + Node.js 访问系统 → 打包成桌面应用
```

---

## 一句话速查

| 概念 | 本质 |
|------|------|
| 主进程 | 一个 Node.js 进程，管窗口和系统 API |
| 渲染进程 | 一个 BrowserWindow = 一个独立的 Chromium 渲染进程（OS 级进程隔离） |
| preload | 安全桥接层，白名单暴露 Node 能力给渲染进程 |
| IPC | 进程间通信（和 RN 的 Bridge / Android 的 Binder 同一类问题） |
| BrowserWindow | 一个窗口实例（= Android Activity） |
| electron-builder | 打包工具，产出 .dmg/.exe/.AppImage |

> **注意区分 Window vs Tab**：BrowserWindow（窗口）级别才是独立进程。应用内部的 Tab（如 VS Code 的编辑器标签页）不是独立进程——同一窗口内所有 Tab 共享同一个渲染进程，Tab 切换只是同一进程内的 UI/数据切换。和 Chrome 浏览器不同（Chrome 每个 Tab 一个进程）。

---

## 你的经验

快应用 IDE = 基于 VS Code（Electron）二次开发：
- 主进程：构建编译（child_process）、设备通信（adb/CDP）、依赖分析引擎
- 渲染进程：Monaco Editor、UI 面板
- 插件系统：Extension Host（独立 Node.js 进程）
