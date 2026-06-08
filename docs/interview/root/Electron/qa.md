# Electron Q&A

> 问题驱动，忠实记录学习过程中的追问和完整回答。

---

## 目录

- [主进程是 Node.js 进程吗？](#主进程是-nodejs-进程吗)
- [Node.js 为什么能用 Chromium 的 Mojo IPC？它们是什么关系？](#nodejs-为什么能用-chromium-的-mojo-ipc它们是什么关系)
- [Mojo 是什么？为什么能让 HTML 和 Node.js 通信？](#mojo-是什么为什么能让-html-和-nodejs-通信)
- [进程通信的底层逻辑和本质是什么？原语是什么？](#进程通信的底层逻辑和本质是什么原语是什么)
- [Chromium 和 Node.js 在 Electron 中的角色、分工、配合？](#chromium-和-nodejs-在-electron-中的角色分工配合)
- [暴露给 Renderer 的 API 有哪几种模式？](#暴露给-renderer-的-api-有哪几种模式)

---

## 主进程是 Node.js 进程吗？

不完全是。主进程是 **Chromium Browser Process + Node.js 合体**：

```
普通 Chrome 浏览器：
  Browser Process = Chromium C++ 代码（管窗口/网络/进程调度）

普通 Node.js：
  Node Process = V8 + libuv + Node C++ 绑定

Electron 主进程 = 把这两个东西编译到同一个二进制里：
  一个进程里同时跑：
    - Chromium 的 Browser Process 逻辑（窗口管理/进程调度/Mojo 通道）
    - Node.js 的事件循环 + API（fs/child_process/net）
  两个事件循环被合并（Electron 用 libuv 和 Chromium message loop 整合）
```

---

## Node.js 为什么能用 Chromium 的 Mojo IPC？它们是什么关系？

```
不是"Node.js 用了 Mojo"
是"Electron 主进程本身就是 Chromium Browser Process"——它天然有 Mojo

Electron 做的事：
  把 Chromium 源码 和 Node.js 源码 一起编译成一个可执行文件
  → 主进程 = Chromium Browser Process（有 Mojo）+ Node.js（有 fs/net）
  → 渲染进程 = Chromium Renderer Process（有 Mojo 的另一端）

所以不是"Node.js 调了 Mojo"
是"主进程本来就是 Chromium 的一部分，它天然有 Mojo 通道连着渲染进程"
Node.js 只是额外被嵌入到这个进程里，提供系统 API 能力

它们不是 C/S 关系，不是包含关系：
  是"编译到同一个二进制里的两套代码"
  共享同一个进程、同一个事件循环
```

---

## Mojo 是什么？为什么能让 HTML 和 Node.js 通信？

```
Mojo = Chromium 自己实现的跨进程通信框架。

Chrome 浏览器本身就是多进程架构：
  Browser Process ←→ Renderer Process（每个 Tab）
  它们之间用 Mojo 通信——这是 Chromium 自带的基础设施。

在 Electron 里：
  Main Process（= Chromium Browser Process + Node.js）
    ←→ Renderer Process（= Chromium Renderer）
  复用 Chromium 已有的 Mojo 通道。

关键理解：不是"HTML 和 Node.js 通信"
是"Chromium 渲染进程 和 Electron 主进程 通信"——Mojo 通道本来就连着这两个进程。

链路：
  渲染进程 JS 调 ipcRenderer.invoke('xxx', data)
    → ipcRenderer 内部把 data 序列化（Structured Clone）
    → 通过 Mojo 管道发到主进程
    → 主进程的 ipcMain 收到消息
    → 触发对应 handler（handler 里可以用 Node.js API）
    → 返回值再通过 Mojo 传回渲染进程
    → ipcRenderer.invoke 的 Promise resolve

类比：
  Mojo 之于 Electron = TCP 之于 HTTP
  TCP 是传输层（你不直接用）
  HTTP 是应用层（你用 fetch/axios）
  Mojo 是传输层（Chromium 内部用）
  ipcMain/ipcRenderer 是应用层（你用这个）
```

---

## 进程通信的底层逻辑和本质是什么？原语是什么？

### 什么是原语（Primitive）

```
原语 = 操作系统内核提供的最基础的、不可再分的操作/机制。

类比：
  编程语言的原语 = 基本数据类型（int/string/boolean）——不能用更基础的东西组合出来
  操作系统的原语 = 内核提供的最底层能力（进程创建/内存分配/IPC 通道）——应用程序不能自己实现

"进程间通信原语" = 操作系统内核提供的让两个进程交换数据的最基础机制
  你不能绕过它——两个进程要通信，必须经过内核
  所有上层通信方案（Mojo/gRPC/WebSocket）最终都落到这些原语上
```

### 进程通信的本质

```
进程 = 独立的内存空间（操作系统隔离）
进程 A 的内存，进程 B 看不到
→ 要通信，必须通过操作系统内核提供的"管道"

操作系统提供的 IPC 原语：

  ┌─────────────────────────────────────────────────────┐
  │  方式           │  本质                              │
  ├─────────────────┼────────────────────────────────────┤
  │  管道 (Pipe)    │  内核维护一块缓冲区，一端写一端读    │
  │  Socket         │  内核维护连接，支持双向              │
  │  共享内存       │  两个进程映射同一块物理内存           │
  │  消息队列       │  内核维护队列，生产者/消费者          │
  │  信号 (Signal)  │  内核发中断通知（只能传数字）         │
  └─────────────────┴────────────────────────────────────┘

  所有 IPC 最终都落到这些原语上。

Mojo 在各平台选择的底层原语：
  Linux:   Unix Domain Socket（本机 socket，不走网络栈）
  macOS:   Mach Port（macOS 内核原生 IPC 机制）
  Windows: Named Pipe（Windows 的管道）

  Mojo 的价值 = 跨平台统一封装 + 结构化消息 + 异步机制
  开发者用 Mojo 接口 → Mojo 内部根据平台选用不同底层原语
```

---

## Chromium 和 Node.js 在 Electron 中的角色、分工、配合？

```
┌─────────────────────────────────────────────────────┐
│                  Electron App                         │
│                                                     │
│  ┌───────────────────┐    ┌───────────────────────┐ │
│  │     Chromium       │    │       Node.js          │ │
│  │                   │    │                       │ │
│  │  负责：            │    │  负责：                │ │
│  │  • 渲染 HTML/CSS  │    │  • 文件系统（fs）      │ │
│  │  • 执行页面 JS    │    │  • 子进程管理          │ │
│  │  • DOM / Canvas   │    │  • 网络（原生 http）   │ │
│  │  • DevTools       │    │  • OS 交互            │ │
│  │  • Web API        │    │  • C++ addon          │ │
│  │  （和浏览器一样）   │    │  （和服务端一样）      │ │
│  └────────┬──────────┘    └──────────┬────────────┘ │
│           │                          │              │
│           │    Electron 做的事：      │              │
│           │    把两者编译到同一个二进制  │              │
│           │    + 合并事件循环         │              │
│           │    + 提供 IPC 通道        │              │
│           │    + 提供窗口管理 API     │              │
│           └──────────┬───────────────┘              │
│                      │                              │
│              Electron API 层                        │
│        （BrowserWindow / dialog / Tray /            │
│         Menu / autoUpdater / ipcMain）              │
└─────────────────────────────────────────────────────┘
```

| | Chromium | Node.js | Electron 自身 |
|---|---|---|---|
| **角色** | UI 渲染引擎 | 系统能力运行时 | 胶水层 + 窗口管理 |
| **跑在哪** | 渲染进程 | 主进程 | 主进程 |
| **提供什么** | DOM / Web API / V8 / DevTools | fs / child_process / net / crypto | BrowserWindow / IPC / dialog / Tray |
| **对开发者** | 写前端代码就是在用它 | 写主进程代码就是在用它 | 连接前后端 + 桌面原生能力 |

**配合方式**：

```
1. 共享 V8 引擎（但在不同进程里各一份）
   Chromium 渲染进程有自己的 V8（跑页面 JS）
   Node.js 主进程也有 V8（跑 Node 代码）
   两个 V8 实例互不相关 → 通过 IPC（Mojo）通信

2. Electron 的核心工作 = 把两者粘在一起
   - 在主进程里同时跑 Node 事件循环 + Chromium 消息循环（合并 event loop）
   - 提供 Mojo IPC 通道让两个进程互通
   - 提供 BrowserWindow 让 Node 进程能创建 Chromium 窗口

3. 类比其他跨端方案：
   RN = JS 引擎（Hermes）+ Native UI → JSI 连接
   Electron = V8（Chromium）+ Node.js → Mojo IPC 连接
   快应用 = V8（J2V8）+ Android UI → 同进程直接调用
```

**一句话**：Chromium 管"看到什么"，Node.js 管"能做什么"，Electron 管"怎么把两者连起来"。


---

## 暴露给 Renderer 的 API 有哪几种模式？

**Q：一般暴露给 render 的 api 有哪几种？同步/异步/主进程推送？**

A：对，基本就三种模式：

| 模式 | 方向 | API | 用途 |
|------|------|-----|------|
| **异步请求/响应** | Renderer → Main → Renderer | `ipcRenderer.invoke` + `ipcMain.handle` | 最常用。选文件、读数据、调接口 |
| **单向发送（不等回复）** | Renderer → Main | `ipcRenderer.send` + `ipcMain.on` | 日志上报、埋点、不关心结果的操作 |
| **主进程主动推送** | Main → Renderer | `win.webContents.send` + `ipcRenderer.on` | 更新通知、状态变化、实时数据 |

```typescript
// ===== 1. 异步请求/响应（最常用）=====
// preload
contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),  // 返回 Promise
});
// main
ipcMain.handle('select-file', async () => { ... return result; });
// renderer
const result = await window.api.selectFile();  // 等到结果


// ===== 2. 单向发送（不等回复）=====
// preload
contextBridge.exposeInMainWorld('api', {
  log: (msg: string) => ipcRenderer.send('log', msg),  // 发了就完，不等返回
});
// main
ipcMain.on('log', (event, msg) => { writeLog(msg); });  // 收到就处理
// renderer
window.api.log('user clicked button');  // 不返回 Promise


// ===== 3. 主进程主动推送到 Renderer =====
// main（主动推）
mainWindow.webContents.send('update-available', { version: '2.0.0' });
// preload（注册监听）
contextBridge.exposeInMainWorld('api', {
  onUpdateAvailable: (callback: (data: any) => void) => {
    ipcRenderer.on('update-available', (_, data) => callback(data));
  },
});
// renderer（消费）
window.api.onUpdateAvailable((data) => {
  showToast(`新版本 ${data.version} 可用`);
});
```

**关于"同步 API"**：Electron 有 `ipcRenderer.sendSync`（同步阻塞等主进程返回），但**几乎不应该用**——它会阻塞渲染进程的整个事件循环（页面卡死），官方明确不推荐。实际开发中所有通信都用异步。


---

## Main 是一个进程吗？支持多进程/多线程吗？Renderer 呢？

**Q：Electron 三层架构（Main/Preload/Renderer），Main 是一个进程吗？后端支持多进程或者多线程吗？Renderer 呢？**

A：

```
Main 进程：
  是的，Main 是一个 OS 进程（Chromium Browser Process + Node.js）
  只有一个（单例）

Main 进程支持的并发手段：
  多进程：child_process.fork() / spawn() → 创建子进程
  多线程：Worker Threads（Node.js 的 worker_threads 模块）
  用途：CPU 密集任务（编译、加密、大文件处理）放到子进程/线程，不阻塞 Main

Renderer 进程：
  每个 BrowserWindow 一个独立的 Renderer 进程
  Renderer 内部也可以用 Web Worker（浏览器标准的多线程）
  但不能用 Node.js 的 worker_threads（Renderer 没有 Node 权限）
```

**Q：VS Code 是怎么设计的？**

A：VS Code 不是普通三层架构，是 Main + Renderer + N 个功能进程：
- Extension Host：独立 Node.js 进程，所有插件跑这里（崩溃不影响 UI）
- Language Server：每种语言一个独立进程（卡住不影响其他语言/插件）
- Terminal：每个终端 tab 一个 pty 子进程
- File Watcher / Search：独立进程

核心设计原则："可能卡住/崩溃的东西"都隔离到独立进程。详见 [vscode/](./vscode/README.md)。
