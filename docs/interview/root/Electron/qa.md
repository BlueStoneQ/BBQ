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
- [Main 是一个进程吗？支持多进程/多线程吗？Renderer 呢？](#main-是一个进程吗支持多进程多线程吗renderer-呢)
- [BrowserView vs WebContentsView？都要掌握吗？](#browserview-vs-webcontentsview都要掌握吗)
- [安全怎么做？](#安全怎么做)
- [稳定性：核心是内存问题吗？](#稳定性核心是内存问题吗)
- [应用图标/名称/Splash 在哪定义？](#应用图标名称splash-在哪定义)
- [网络请求模型：Renderer 的请求经过 Main 转发吗？](#网络请求模型renderer-的请求经过-main-转发吗)
- [autoUpdater 主要用来做什么？](#autoupdater-主要用来做什么)
- [protocol 模块有什么用？三种场景](#protocol-模块有什么用三种场景)
- [Electron 有路由系统吗？](#electron-有路由系统吗)
- [nativeTheme 使用范式](#nativetheme-使用范式)

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


---

## BrowserView vs WebContentsView？都要掌握吗？

**Q：代码中有用 BrowserView（如嵌入调试器面板），升级时需要迁移到 WebContentsView。这两个都要掌握吗？有什么区别？使用上呢？**

A：了解 BrowserView 概念就行，重点掌握 WebContentsView（新的）。

```
BrowserView（旧，Electron 30 开始废弃）：
  - 附加到 BrowserWindow 上的一个子视图
  - 有独立的 webContents（独立渲染进程）
  - 定位方式：setBounds({ x, y, width, height })（绝对像素定位）
  - 问题：和 BrowserWindow 的 DOM 内容叠加时层级管理麻烦（不在 DOM 流里）
  - 不能嵌套、不能用 CSS 布局

WebContentsView（新，Electron 30+）：
  - 也是一个有独立 webContents 的子视图
  - 配合 BaseWindow（不带内置 webContents 的窗口）使用
  - 一个 BaseWindow 里可以放多个 WebContentsView
  - 定位方式也是 setBounds（仍然是绝对定位，不是 CSS flex）

本质区别不大——都是"在一个窗口里嵌入多个独立 webContents"
WebContentsView 更灵活：
  - BrowserView 必须附加到 BrowserWindow（窗口自身已占一个 webContents）
  - WebContentsView 配合 BaseWindow（窗口本身没有 webContents）→ 所有内容都是 View 拼接
```

```typescript
// BrowserView（旧写法）
const view = new BrowserView();
mainWindow.addBrowserView(view);
view.setBounds({ x: 0, y: 40, width: 800, height: 560 });
view.webContents.loadURL('https://devtools.example.com');

// WebContentsView（新写法）
const { BaseWindow, WebContentsView } = require('electron');

const win = new BaseWindow({ width: 800, height: 600 });  // 空窗口，没有自己的页面

const mainView = new WebContentsView();
mainView.webContents.loadFile('index.html');
mainView.setBounds({ x: 0, y: 0, width: 800, height: 400 });

const devtoolsView = new WebContentsView();
devtoolsView.webContents.loadURL('https://devtools.example.com');
devtoolsView.setBounds({ x: 0, y: 400, width: 800, height: 200 });

win.contentView.addChildView(mainView);
win.contentView.addChildView(devtoolsView);
```

使用场景：VS Code 那种分栏布局（编辑器 + 终端 + 预览面板各自独立 webContents）。快应用 IDE 如果有嵌入的调试面板/预览器，也是这个场景。


---

## 安全怎么做？

**Q：Electron 安全怎么做？**

A：核心 = 控制"渲染进程能做什么"。渲染进程不信任（可能加载外部内容）。

```
三道防线：
  ① contextIsolation: true
     → preload 和页面 JS 在不同作用域（页面 JS 不能直接访问 ipcRenderer）

  ② nodeIntegration: false
     → 渲染进程不能 require('fs')（纯浏览器环境）

  ③ sandbox: true
     → 渲染进程跑在 Chromium 沙箱中（即使有漏洞也逃不出）

  + preload 白名单：
     → 只暴露精确的方法（不暴露整个 ipcRenderer）
     → 每个方法验证参数合法性

其他：webSecurity: true / 不加载不可信 URL / CSP 设置
```

---

## 稳定性：核心是内存问题吗？

**Q：Electron 稳定性核心是内存问题吗？**

A：不只是内存。核心是"崩溃恢复"——Electron 桌面应用不能崩，崩了要能恢复。

```
稳定性 = 崩溃防护 + 崩溃恢复 + 慢性泄漏防护

  ① Main 进程崩溃 = 全部完蛋（最严重）
     原因：uncaughtException / unhandledRejection
     解法：process.on('uncaughtException', handler) 兜底 + 所有异步 try-catch

  ② 渲染进程崩溃 = 一个窗口白屏
     原因：页面 JS 错误 / 内存超限 / GPU 进程挂
     解法：webContents.on('crashed') → 自动 reload / 展示恢复页面

  ③ 子进程崩溃 = 部分功能丢失（可恢复）
     原因：Language Server / Extension Host 挂了
     解法：检测 exit → 自动重启

  ④ 内存泄漏 = 慢性死亡（越来越卡）
     原因：缓存无限增长 / 事件监听器未移除 / 闭包引用大对象
     解法：heapdump 分析 / LRU 缓存 / max_memory_restart

内存只是其中一个维度。核心是"挂了能恢复"。
```


---

## 应用图标/名称/Splash 在哪定义？

**Q：应用图标 + 应用名称 + 应用 Splash 是在 package.json 中定义吗？**

A：分散在不同地方：

```
应用名称：
  package.json → "productName": "MyApp"（不是 "name"）
  electron-builder.yml → productName: MyApp

应用图标（分平台）：
  electron-builder.yml:
    mac:   icon: assets/icon.icns    (1024x1024)
    win:   icon: assets/icon.ico     (256x256)
    linux: icon: assets/icon.png     (512x512)

Splash Screen：
  Electron 没有内置 splash 机制，需要自己实现：
  → 先创建一个小窗口（无边框）显示 logo
  → 主窗口加载完成后关掉 splash 窗口
```

```typescript
// Splash 实现
const splash = new BrowserWindow({ width: 300, height: 300, frame: false, alwaysOnTop: true });
splash.loadFile('splash.html');  // 纯静态 logo 页面

const mainWindow = new BrowserWindow({ show: false, ... });
mainWindow.loadFile('dist/index.html');
mainWindow.once('ready-to-show', () => {
  splash.close();
  mainWindow.show();
});
```


---

## 网络请求模型：Renderer 的请求经过 Main 转发吗？

**Q：Electron 的网络请求是怎么个模型？Renderer 中请求发出，经过后端（Main）转发出去吗？**

A：不一定。两种方式都可以，看场景选择：

```
方式 1：Renderer 直接发（和浏览器一样）
  渲染进程就是一个 Chromium 页面，可以直接 fetch / XMLHttpRequest
  → 请求经过 Chromium 的网络栈（不经过 Main 进程）
  → 和你在 Chrome 浏览器里发请求完全一样
  → 受同源策略限制（除非服务端配了 CORS）

  适用：简单场景、公共 API、不需要特殊处理的请求

方式 2：通过 Main 进程代理
  Renderer → IPC → Main → Node.js fetch/axios → 服务端
  → 不受 CORS 限制（Node.js 没有同源策略）
  → 可以统一注入 token / 签名 / 加密
  → 可以做请求拦截、日志、重试

  适用：需要绕 CORS / 需要带客户端证书 / 需要统一网关逻辑
```

```
实际大型应用的选择：

  VS Code / 快应用 IDE：
    大部分走 Main 代理
    原因：统一身份认证 + 需要访问内部 API + 请求需要签名

  简单工具类应用：
    Renderer 直接 fetch
    原因：没有复杂的认证逻辑，直接请求更简单

  混合模式：
    公开 API（CDN 资源、公共接口）→ Renderer 直接请求
    内部 API（需要 token/签名/证书）→ 走 Main 代理
```

```
类比：
  Renderer 直接 fetch = H5 页面直接请求后端
  Main 代理 = H5 通过 Native 的网络层发请求（如 App 内统一网关）
  
  和 RN 对比：
    RN 的 fetch 是通过 Native 网络层实现的（必须经过 Native）
    Electron 的 Renderer fetch 是 Chromium 原生网络栈（不经过 Main）
    → Electron 渲染进程的网络能力比 RN JS 线程更独立
```

---

## autoUpdater 主要用来做什么？

**Q：autoUpdater 主要用来做什么？**

A：做应用的**静默自动更新**——替代"用户手动去官网下载新版本安装包"。

```
核心流程：
  1. 应用启动时检查远程服务器是否有新版本（checkForUpdates）
  2. 有新版 → 后台下载新安装包
  3. 下载完成 → 提示用户 or 退出时自动安装（quitAndInstall）

实际开发中用 electron-updater（electron-builder 配套）：
  - 支持 GitHub Releases / S3 / 自建服务器 作为更新源
  - 支持差量更新（delta update）
  - 支持 Windows NSIS / macOS DMG / Linux AppImage
```

关键事件：

| 事件 | 时机 |
|------|------|
| `checking-for-update` | 开始检查 |
| `update-available` | 发现新版 |
| `update-not-available` | 已是最新 |
| `download-progress` | 下载进度（可用于进度条） |
| `update-downloaded` | 下载完成，可以安装 |
| `error` | 更新失败 |

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = true;
autoUpdater.checkForUpdatesAndNotify();  // 启动时检查

autoUpdater.on('update-downloaded', () => {
  // 方式1：提示用户重启
  dialog.showMessageBox({ message: '新版本已下载，重启更新？' })
    .then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  // 方式2：下次退出时静默安装（默认行为）
});
```

和 build-config 的关系：`electron-builder.yml` 里配的 `publish: { provider: github }` 就是给 autoUpdater 指定更新源——构建时自动上传安装包到 GitHub Releases，autoUpdater 去那里检查新版本。


---

## protocol 模块有什么用？三种场景

**Q：protocol 模块有什么作用？给个范例说下三种用法。**

A：注册自定义 URL 协议，让应用能拦截特定 scheme 的请求。本质 = 让 Electron 拥有自己的 URL scheme（类似 Android intent-filter / iOS URL Types）。

三种核心场景：

```
场景 1：加载本地资源（替代 file:// 协议）
  问题：file:// 有 CSP / 同源策略限制，且路径暴露本地目录结构
  解法：注册 app:// → 拦截请求 → 返回本地文件

场景 2：深度链接（Deep Link）
  用户在浏览器点 myapp://settings/account → OS 唤起 Electron 应用并传路径
  配合 app.setAsDefaultProtocolClient('myapp')

场景 3：拦截/代理 Web 请求
  拦截 https:// 请求 → 做本地缓存 / mock / 离线化
```

```typescript
// ===== 场景 1：自定义协议加载本地资源 =====
import { protocol } from 'electron';

// 注册 app:// 协议
protocol.registerFileProtocol('app', (request, callback) => {
  // app://assets/logo.png → /path/to/resources/assets/logo.png
  const relativePath = request.url.replace('app://', '');
  callback({ path: path.join(__dirname, '../resources', relativePath) });
});

// 页面中使用（不暴露本地路径，更安全）
// <img src="app://assets/logo.png" />
// <link href="app://styles/theme.css" />


// ===== 场景 2：深度链接 =====
// 注册为系统默认处理程序（安装时生效）
app.setAsDefaultProtocolClient('myapp');

// macOS：通过 open-url 事件接收
app.on('open-url', (event, url) => {
  // url = 'myapp://settings/account'
  handleDeepLink(url);
});

// Windows/Linux：通过 second-instance 事件接收（进程已存在时）
app.on('second-instance', (event, argv) => {
  const url = argv.find(arg => arg.startsWith('myapp://'));
  if (url) handleDeepLink(url);
});

function handleDeepLink(url: string) {
  // myapp://settings/account → 导航到设置页面
  const route = new URL(url).pathname;  // '/settings/account'
  mainWindow.webContents.send('navigate', route);
}


// ===== 场景 3：拦截 HTTPS 请求（本地缓存/离线化）=====
protocol.interceptBufferProtocol('https', (request, callback) => {
  const cached = localCache.get(request.url);
  if (cached) {
    // 有本地缓存 → 直接返回
    callback({ mimeType: 'text/html', data: Buffer.from(cached) });
  } else {
    // 无缓存 → 放行原始请求（不拦截）
    callback({ url: request.url });  // 透传
  }
});
```

快应用 IDE 里的实际用途：如果有 `hap://` 协议拦截加载本地预览资源，就是场景 1 的用法。


---

## Electron 有路由系统吗？

**Q：Electron 有没有路由系统？**

A：**没有。** Electron 不提供任何路由机制。

```
路由完全由渲染进程的前端框架处理：
  React → React Router
  Vue → Vue Router
  和开发 SPA 完全一样

Electron 只做一件事：加载一个 HTML 入口
  mainWindow.loadFile('dist/index.html')
  → 后面的页面内跳转、路由切换 = 前端框架的事

多窗口场景：
  不同窗口加载不同 HTML（或同一 HTML 不同 hash）
  每个窗口内部各自有自己的路由实例
  窗口之间没有"路由跳转"概念——要通信走 IPC

类比：
  Electron 窗口 = Android Activity
  窗口内路由 = Activity 内的 Fragment 切换
  窗口间切换 = Activity 跳转（通过 Intent = IPC）
```


---

## nativeTheme 使用范式

**Q：nativeTheme 的使用范式是什么？**

A：核心模式 = **监听系统主题变化 + 同步到渲染进程 + 允许用户手动覆盖**。

三个关键 API：
- `nativeTheme.shouldUseDarkColors` — 读当前是暗还是亮
- `nativeTheme.on('updated')` — 系统主题切换时触发
- `nativeTheme.themeSource` — 强制设置 `'dark'` / `'light'` / `'system'`

```typescript
// ===== Main 进程 =====
import { nativeTheme, ipcMain } from 'electron';

// 1. 读取当前主题
const isDark = nativeTheme.shouldUseDarkColors;  // true = 暗色

// 2. 监听系统主题切换（用户在系统设置里切了暗色/亮色）
nativeTheme.on('updated', () => {
  mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
});

// 3. 允许渲染进程主动切换（覆盖系统设置）
ipcMain.handle('set-theme', (_, mode: 'dark' | 'light' | 'system') => {
  nativeTheme.themeSource = mode;  // 'system' = 跟随系统
});


// ===== Preload =====
contextBridge.exposeInMainWorld('api', {
  onThemeChanged: (cb: (isDark: boolean) => void) => {
    ipcRenderer.on('theme-changed', (_, isDark) => cb(isDark));
  },
  setTheme: (mode: 'dark' | 'light' | 'system') => ipcRenderer.invoke('set-theme', mode),
});


// ===== Renderer（React）=====
useEffect(() => {
  window.api.onThemeChanged((isDark) => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  });
}, []);

// 用户手动切换
<button onClick={() => window.api.setTheme('dark')}>暗色</button>
<button onClick={() => window.api.setTheme('system')}>跟随系统</button>
```

这是一个典型的"主进程主动推送"模式的应用——系统事件在 Main 进程触发，通过 `webContents.send` 推给渲染进程。
