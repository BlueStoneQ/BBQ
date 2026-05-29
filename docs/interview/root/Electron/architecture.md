# Electron 架构与进程模型

## 本质问题

桌面应用需要两种能力：**渲染 UI** + **访问系统**。但这两种能力的安全等级不同——UI 层可能加载不可信内容（XSS），不能让它直接操作文件系统。

**解决**：分成两个进程，各司其职，通过 IPC 通信。

---

## 进程模型

```
┌─────────────────────────────────────────────┐
│  Main Process（主进程，1 个）                 │
│  ─────────────────────────────────────────── │
│  运行环境：Node.js                           │
│  能力：fs / net / child_process / 全部系统 API│
│  职责：创建窗口、菜单、托盘、IPC 调度         │
│  类比：Android Application + Service         │
├─────────────────────────────────────────────┤
│  Renderer Process（渲染进程，每窗口 1 个）     │
│  ─────────────────────────────────────────── │
│  运行环境：Chromium（和浏览器 Tab 一样）      │
│  能力：DOM / CSS / fetch / WebSocket         │
│  限制：默认不能访问 Node.js（安全隔离）       │
│  职责：渲染 UI（你的 React/Vue App）          │
│  类比：Android Activity                      │
├─────────────────────────────────────────────┤
│  Preload Script（每窗口 1 个）               │
│  ─────────────────────────────────────────── │
│  运行环境：受限 Node.js（有 require 但被隔离）│
│  职责：安全桥接，白名单暴露 API 给渲染进程    │
│  类比：RN 的 TurboModule / Android Bridge    │
└─────────────────────────────────────────────┘
```

## 为什么这样设计

```
如果渲染进程能直接用 Node.js：
  → 任何 XSS 漏洞 = 攻击者能读写你的文件系统 = 灾难

所以：
  渲染进程（不可信）→ 只能通过 preload 白名单 → 请求主进程代为执行
  主进程（可信）→ 有全部系统权限，但不渲染 UI

本质和 Android 的权限模型一样：Activity 不能直接操作硬件，要通过 System Service。
```

## 生命周期

```
app.on('ready')           → 主进程就绪，可以创建窗口
app.on('window-all-closed') → 所有窗口关闭（macOS 不退出，其他平台退出）
app.on('activate')        → macOS 点击 Dock 图标（重新创建窗口）
app.on('before-quit')     → 即将退出

BrowserWindow:
  new BrowserWindow()     → 创建窗口 + 渲染进程
  win.loadURL/loadFile    → 加载页面
  win.close()             → 关闭窗口（渲染进程销毁）
```

## 和 RN 的类比

| Electron | RN | 本质 |
|----------|-----|------|
| Main Process | Native 层（Java/ObjC） | 有系统权限的宿主 |
| Renderer Process | JS 线程 + UI 线程 | 渲染 UI |
| IPC (ipcMain/ipcRenderer) | JSI / TurboModule | 跨层通信 |
| preload + contextBridge | Codegen 生成的接口 | 安全暴露能力 |
| BrowserWindow | ReactInstanceManager | 容器实例 |
| 多窗口 | 多 Bundle 容器 | 多实例管理 |
