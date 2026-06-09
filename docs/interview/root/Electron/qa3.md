# Electron Q&A (2)

> 问题驱动，忠实记录学习过程中的追问和完整回答。
>
> ⚡ 面试前速查 → [quick-lookup.md](./quick-lookup.md)

---

## 目录

### 1. IDE + Doubao

- [1.1 IDE 本体做了哪四点核心改动？](#11-ide-本体做了哪四点核心改动)

### 2. VS Code

- [2.1 VS Code 架构对 AI 桌面端的借鉴](#21-vs-code-架构对-ai-桌面端的借鉴)
- [2.2 VS Code Tab 不是独立进程 + 怎么实现 Tab](#22-vs-code-tab-不是独立进程--怎么实现-tab)
- [2.3 VS Code 插件机制](#23-vs-code-插件机制)

### 3. Electron

- [3.1 UtilityProcess（工具进程）是什么？](#31-utilityprocess工具进程是什么)
- [3.2 耗时任务用线程还是进程？Trade-off](#32-耗时任务用线程还是进程trade-off)
- [3.3 通信模型：三种模式 + 数据流向 + 核心 API](#33-通信模型三种模式--数据流向--核心-api)
- [3.4 Electron 核心能力 vs Node.js 业务](#34-electron-核心能力-vs-nodejs-业务)
- [3.5 Electron 工程化](#35-electron-工程化)
- [3.6 Electron 典型平台差异](#36-electron-典型平台差异面试讲-2-3-个)
- [3.7 Electron 性能优化 + 检测](#37-electron-性能优化--检测分两侧)
- [3.8 Chromium 在 Electron 中的角色](#38-chromium-在-electron-中的角色)
- [3.9 Electron 调试](#39-electron-调试)
- [3.10 Electron 启动流程 + 生命周期](#310-electron-启动流程--生命周期--各阶段做什么)
- [3.11 Electron 开发全链路最佳实践](#311-electron-开发全链路最佳实践)

### 4. RN

- [4.1 RN 键盘遮挡问题](#41-rn-键盘遮挡问题)
- [4.2 Chat UI 常见 CSS/布局问题（跨端）](#42-chat-ui-常见-css布局问题跨端)
- [4.3 RN 核心组件与常见问题](#43-rn-核心组件与常见问题)
- [4.4 RN 典型平台差异（面试讲 2-3 个）](#44-rn-典型平台差异面试讲-2-3-个)
- [4.5 Safe Area / 刘海屏适配详解](#45-safe-area--刘海屏适配详解)

### 5. React

### 6. Agent

- [6.1 文件上传方案（跨端对比）](#61-文件上传方案跨端对比)
- [6.2 Chat Stream 全链路](#62-chat-stream-全链路)
- [6.3 Mako 五层上下文管道](#63-mako-五层上下文管道)
- [6.4 MCP 协议](#64-mcp-协议)
- [6.5 LangChain 核心概念](#65-langchain-核心概念)
- [6.6 提示词工程核心原则](#66-提示词工程核心原则)
- [6.7 RAG + 向量数据库](#67-rag--向量数据库)

### 7. Basic

- [7.1 Flex 布局速记](#71-flex-布局速记)
- [7.2 HTTP 缓存速记](#72-http-缓存速记)

### 7. 待分类-others

---



## 1. IDE + Doubao


---

### 1.1 IDE 本体做了哪四点核心改动？

**Q：快应用 IDE 基于 VS Code 二开，IDE 本体（源码层）核心改了什么？**

A：只改了 4 点（< 10 个文件），其余全部通过 Extension 实现。

→ 详见 [IDE 项目总览 · 二、IDE 本体核心改动（4 点）](./ide/overview.md#二ide-本体核心改动4-点)

| # | 改动 | 实现 |
|---|------|------|
| 1 | 元信息定制（名称/图标/数据目录/协议名） | product.json |
| 2 | 首次启动自动安装内置插件列表 | [详见](./ide/builtin-extension-install.md) |
| 3 | 暴露 VS Code 不支持的 API（Header WebView） | [详见](./ide/custom-api-header-webview.md) |
| 4 | 注册 IDE 自己的命令行（`quickapp-ide` 替代 `code`） | CLI 入口改名 + `setAsDefaultProtocolClient` |

---



## 2. VS Code
- 进程隔离(崩溃隔离) + 增加插件host进程

（待补充）


### 2.1 VS Code 架构对 AI 桌面端的借鉴

**Q：VS Code 的设计有什么值得 AI 桌面端借鉴的？**

不只是"加了一个插件进程"。核心设计思想：

- **Main 不跑业务** → 只做窗口管理 + 进程调度
- **可能崩/卡的东西独立进程** → Extension Host / Language Server / Terminal 各自隔离
- **DI + 服务化** → 所有功能注册为 Service，可替换/可测试
- **Workbench Contribution** → 插拔式启动任务注册（import 副作用 + 全局注册表）
- **最小侵入定制** → 能配置不硬编码，能插件不改源码
- 独立插件进程设计, 微内核+plugin的设计

**对 AI 桌面端的映射**：

| VS Code | AI 桌面端 |
|---------|----------|
| Extension Host（独立进程跑插件） | Agent Worker（独立进程跑 ReAct） |
| Language Server（独立进程跑语言分析） | Tool Executor（独立进程跑本地工具） |
| Main 只做调度 | Main 只做窗口 + IPC 路由 + 子进程管理 |
| Contribution 注册机制 | Tool 注册机制（Agent 的工具注册表） |

---

---


---

### 2.2 VS Code Tab 不是独立进程 + 怎么实现 Tab

**Q：VS Code 的 Tab 是不是一个进程？怎么实现一个 Tab？**

A：**不是独立进程。** Tab 只是同一个 Renderer 进程内的 UI/数据切换。

```
VS Code 窗口 = 一个 BrowserWindow = 一个 Renderer 进程
  里面的多个 Tab = 同一进程内的数据切换
  切 Tab = 切换当前激活的 TextModel + 重新渲染编辑器内容
  不创建新进程，不创建新 WebContents
```

和 Chrome 浏览器不同：Chrome 每个 Tab 一个进程（隔离不同网站）。VS Code 不需要——所有 Tab 都是"同一个用户打开的文件"，无隔离需求。

**怎么实现一个 Tab 系统**：

```typescript
// 纯前端实现（React）
const [tabs, setTabs] = useState<Tab[]>([]);
const [activeId, setActiveId] = useState<string>();

// Tab 栏
{tabs.map(tab => (
  <div onClick={() => setActiveId(tab.id)} className={tab.id === activeId ? 'active' : ''}>
    {tab.title}
    <button onClick={() => closeTab(tab.id)}>×</button>
  </div>
))}

// 内容区：用 display:none 保持非活跃 Tab 的 DOM 存活（保留滚动位置/状态）
{tabs.map(tab => (
  <div style={{ display: tab.id === activeId ? 'block' : 'none' }}>
    <TabContent data={tab.data} />
  </div>
))}
```

**关键点**：
- Tab 不是进程/窗口，是 React state + CSS display 切换
- 用 `display: none` 保持 DOM 存活（保留状态），不用 `if/else` 销毁重建
- VS Code 用更复杂的实现（TextModel 缓存 + EditorGroup），但本质一样


---


---

### 2.3 VS Code 插件机制

本质：Extension Host（独立 Node.js 进程）跑所有插件 → 通过 RPC 和 Renderer 通信 → 崩溃不影响编辑器。所有插件共享一个 Extension Host 进程——一个插件崩了整个 Host 挂，但 VS Code 会自动重启 Host（编辑器 UI 不受影响，插件短暂失效几秒）。隔离的是"插件整体"和"编辑器 UI"，不是"插件之间"。

范式：`package.json contributes` 声明能力 + `activate()` 入口 + Extension API 白名单调用（进程隔离：插件跑在独立进程，只能通过 `vscode.*` API 跨进程访问 VS Code 能力，不能直接碰 DOM / Renderer 内存）。

运行时原理：
1. 插件声明 `activationEvents`（什么时候激活）
2. 条件满足 → Extension Host 加载插件 JS → 调 `activate(context)`
3. 插件通过 `vscode.*` API 注册命令/视图/provider
4. API 调用 → RPC → Renderer/Main 执行

通信：Extension Host ↔ Renderer 走 MessagePort RPC（`$` 前缀方法标记跨进程）。

→ 详见 [VS Code 插件系统架构](./vscode/05-插件系统架构.md)

---


---

## 3. Electron


---

### 3.1 UtilityProcess（工具进程）是什么？

**Q：Electron 官方文档里的 Utility Process Modules 是什么？**

A：`UtilityProcess` = Electron 官方提供的**轻量子进程**方案（Electron 22+ 引入），用来替代 `child_process.fork()` 跑 CPU 密集任务。

**解决的问题**：之前要在 Main 进程外跑耗时任务，只能用 `child_process.fork()`。但它创建的是完整 Node.js 进程，开销大，且和 Electron 的 IPC 体系不互通。

**对比**：

| | child_process.fork() | UtilityProcess |
|---|---|---|
| 本质 | 完整的 Node.js 子进程 | Chromium Utility Process（轻量） |
| 通信 | Node IPC（`process.send`） | MessagePort（和 Renderer 通信方式一致） |
| 开销 | 大（完整 Node 运行时） | 小（共享 Chromium 基础设施） |
| 能用 Node API | ✅ | ✅ |
| 崩溃隔离 | ✅ | ✅ |
| 适合 | 跑独立脚本/CLI 工具 | CPU 密集计算、后台服务、Native addon |

**用法**：

```typescript
import { utilityProcess } from 'electron';

// Main 进程中创建工具进程, 指定入口文件
const child = utilityProcess.fork('heavy-task.js');

// 通信（MessagePort 风格，和 Web Worker 类似）
child.postMessage({ type: 'start', data: largeBuffer });
child.on('message', (msg) => { /* 收到结果 */ });

// 崩溃恢复（父子关系：Main 挂了子进程也会被杀）
child.on('exit', (code) => { /* 检测退出码，可以重启 */ });
```

**子进程内部怎么写**（heavy-task.js）：

```typescript
// process.parentPort = 和父进程（Main）通信的端口
process.parentPort.on('message', (e) => {
  const { type, data } = e.data;
  if (type === 'start') {
    const result = doHeavyWork(data);  // 执行耗时任务
    process.parentPort.postMessage({ type: 'done', result });  // 发回父进程
  }
});
```

和 Web Worker 的 `self.onmessage` / `self.postMessage` 完全一个模式。

**VS Code 中的对应**：Extension Host / Language Server 本质上就是这种"隔离子进程"模式。UtilityProcess 是 Electron 对这种模式的官方标准化封装。

**一句话**：`UtilityProcess` = Electron 版的 Web Worker，独立进程 + MessagePort 通信 + 崩溃隔离。


---


---

### 3.2 耗时任务用线程还是进程？Trade-off

**Q：耗时任务用线程（Worker Threads）不行吗？为什么用进程这么重？**

A：线程可以用，但进程多了一个核心优势：**崩溃隔离**。

| | Worker Threads（线程） | UtilityProcess / child_process（进程） |
|---|---|---|
| 崩溃影响 | 线程崩 = 整个进程崩（所有线程都死） | 子进程崩 = 只死它自己，Main 不受影响 |
| 内存隔离 | 共享内存（SharedArrayBuffer） | 完全隔离 |
| 开销 | 轻（~几 MB） | 重（~30-50 MB） |
| 通信 | postMessage（快，可 transfer） | IPC / MessagePort（有序列化开销） |
| 适合 | 纯计算 + 自己写的可控代码 | 不信任的代码 / 可能崩的场景 |

**决策标准**：

- 纯计算 + 代码可控 → **Worker Threads**（轻，够用）。例：Markdown 渲染、数据处理
- 可能崩 / 第三方代码 / 长时间运行 → **进程**（安全）。例：Agent 任务执行、插件系统、Language Server

**为什么桌面应用偏向用进程**：

桌面应用"不能崩"是硬约束。线程崩 = 整个 Main 进程崩 = 应用闪退 = 用户数据丢失。进程崩 = 弹个提示"任务失败" + 自动重启子进程 = 用户无感知。

VS Code 的 Extension Host / Language Server 都是独立进程而不是线程，就是这个原因。

**一句话**：线程轻但不隔离崩溃，进程重但崩了不连坐。


---


---

### 3.3 通信模型：三种模式 + 数据流向 + 核心 API

**Q：Renderer - Preload - Main 之间如何通信？**

→ 完整贯穿示例见 [walkthrough.md](./walkthrough.md)

**三种通信模式**：

**模式 A：异步请求/响应（最常用，90% 场景）**

方向：Renderer → Main → Renderer（请求-等-回）

核心 API：
- preload：`ipcRenderer.invoke('channel', data)` → 返回 Promise
- main：`ipcMain.handle('channel', handler)` → return 结果

数据流：

```
页面 JS 调 window.api.selectFile()
  → preload 里 ipcRenderer.invoke('select-file')
  → [Mojo IPC 跨进程]
  → Main 的 ipcMain.handle('select-file') 收到
  → 执行逻辑（dialog.showOpenDialog + fs.readFile）
  → return 结果
  → [Mojo 返回]
  → preload 里 Promise resolve
  → 页面 JS 拿到结果
```

**模式 B：单向发送（不等回复，埋点/日志）**

方向：Renderer → Main（发了就完）

核心 API：
- preload：`ipcRenderer.send('channel', data)`
- main：`ipcMain.on('channel', listener)`

数据流：和 A 一样，但 Main 不 return，Renderer 不等。

**模式 C：主动推送（Main → Renderer，状态变化/stream）**

方向：Main → Renderer

核心 API：
- main：`win.webContents.send('channel', data)`
- preload：`ipcRenderer.on('channel', callback)`

数据流：

```
Main 发起（系统事件/定时器/子进程完成/stream token）
  → webContents.send('channel', data)
  → [Mojo 跨进程]
  → preload 里 ipcRenderer.on 回调触发
  → 页面 JS 的 callback 执行 → 更新 UI
```

**Preload 的角色**：不是通信管道，是"安全白名单层"。`contextBridge.exposeInMainWorld('api', {...})` 把方法挂到 `window.api`。页面 JS 只能调 `window.api.xxx`，碰不到 `ipcRenderer` 本身。

---


---

### 3.4 Electron 核心能力 vs Node.js 业务

**Q：Electron 本身提供了哪些核心能力？大部分业务都是 Node.js 写的后端去做的吗？**

A：对。业务逻辑用 Node.js API 写（fs/net/child_process），Electron 只提供"桌面应用特有的、浏览器+Node.js 都做不到的能力"。

**Electron 独有能力**：

| 对象/API | 能做什么 |
|---------|---------|
| `BrowserWindow` | 创建 OS 级窗口 |
| `app` | 应用生命周期（启动/退出/单实例/开机自启） |
| `Tray` | 系统托盘图标 |
| `Menu` | 原生菜单（菜单栏/右键菜单） |
| `dialog` | 原生弹窗（文件选择/确认框/保存） |
| `globalShortcut` | 系统级全局快捷键（应用不在前台也触发） |
| `Notification` | 系统通知 |
| `autoUpdater` | 自动更新（检测/下载/安装） |
| `protocol` | 自定义 URL 协议（myapp://） |
| `desktopCapturer` | 截屏/录屏 |
| `nativeTheme` | 系统暗色/亮色主题监听 |
| `powerMonitor` | 系统休眠/唤醒监听 |
| `session` | Cookie/代理/缓存控制 |
| `clipboard` | 系统剪贴板读写 |
| `shell` | 打开外部链接/文件（用系统默认应用） |

**Node.js 提供的（不是 Electron 独有）**：fs / child_process / net / crypto / worker_threads — Electron 里能用，但在普通 Node.js 里也能用。

**一句话**：Electron = "把浏览器 + Node.js 粘在一起" + "提供桌面原生能力 API"。

---


---

### 3.5 Electron 工程化

**Q：Electron 的工程化怎么做？**

| 维度 | 方案 | 工具 |
|------|------|------|
| 项目模板 | electron-vite / electron-forge | 统一 main + preload + renderer 构建 |
| 构建 | Vite 构建三端（main/preload/renderer 各一份 bundle） | vite.config.ts × 3 |
| 打包 | electron-builder / electron-forge | 产出 .dmg/.exe/.AppImage |
| 签名 | codesign(mac) / signtool(win) | electron-builder 自动调用 |
| 自动更新 | electron-updater | CDN + autoUpdater |
| CI/CD | GitHub Actions matrix 三平台并行 | tag 触发 → 构建 → 签名 → 发布 |
| HMR | electron-vite 内置（main + renderer 都支持热更） | 开发体验 |
| 调试 | Renderer: DevTools / Main: `--inspect` + chrome://inspect | — |

分平台发布简化流程：
- macOS：证书($99/年) → codesign → Notarization 公证 → .dmg → CDN
- Windows：证书($200-400/年) → signtool → .exe(NSIS) → CDN
- Linux：无需证书 → .AppImage/.deb → CDN

**VS Code 的构建工具链（和普通 Electron 应用不同）**：

VS Code **不用 electron-builder / electron-forge**，有自己的构建体系：

| 阶段 | VS Code 用什么 | 普通 Electron 应用用什么 |
|------|--------------|----------------------|
| TS 编译 | tsc | tsc |
| JS 打包 | esbuild + 自定义 gulp 脚本 | Vite / Webpack |
| 平台打包 | 自研 gulp 任务（`gulp vscode-linux-x64`） | electron-builder 一键 |
| 安装包 | 各平台独立（Inno Setup / dmg / deb） | electron-builder 统一生成 |

为什么不用 electron-builder：VS Code 体量太大（几百个模块 + 内置插件 + 多语言），通用工具满足不了定制需求。

**对你的 IDE 项目**：用 electron-builder 够了。面试时可以说"VS Code 用自研脚本，因为定制需求超出通用工具能力范围，我们的 IDE 复杂度没到那个程度，electron-builder 足够"。

---


---

### 3.6 Electron 典型平台差异（面试讲 2-3 个）

| 差异 | 问题 | 抹平方式 |
|------|------|---------|
| macOS 关窗口不退出 | macOS 规范：关窗口 app 还活着（Dock 里），Windows/Linux 关窗口 = 退出 | `app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); })` |
| 标题栏 / 窗口控制按钮 | macOS 红绿灯在左，Windows 在右，自定义标题栏两端都要处理 | `titleBarStyle: 'hiddenInset'`(mac) + 自绘标题栏 + `process.platform` 判断按钮位置 |
| 签名和分发 | macOS 要 codesign + Notarization（否则打不开），Windows 要 signtool（否则 SmartScreen 警告），Linux 不需要 | electron-builder 配置分平台证书，CI 环境变量注入 |

抹平手段：`process.platform`（`'darwin'` / `'win32'` / `'linux'`）条件判断。


---


---

### 3.7 Electron 性能优化 + 检测（分两侧）

**Q：Electron 性能优化分哪两部分？怎么检测？**

确实分两部分：Main 侧 = Node.js 优化，Renderer 侧 = Web 前端优化。两个进程独立，互不影响。

**Main 进程（Node.js 侧）**：

| 问题 | 优化 | 检测工具 |
|------|------|---------|
| 启动慢 | 延迟加载模块（用到再 require） | --inspect + CPU Profile |
| 阻塞事件循环 | 异步 IO / CPU 密集放 UtilityProcess | `app.getAppMetrics()` |
| 内存泄漏 | LRU 缓存 / 移除事件监听 / heapdump 分析 | `process.memoryUsage()` / Chrome Heap Snapshot |

**Renderer 进程（Chromium 侧）**：

| 问题 | 优化 | 检测工具 |
|------|------|---------|
| 渲染卡顿 | 虚拟滚动 / 减少 DOM 节点 | DevTools Performance 面板 |
| JS 长任务 | requestIdleCallback / Web Worker | Performance Long Tasks |
| 内存 | 组件卸载时清理 / 大对象及时释放 | DevTools Memory 面板 |

→ 详见 [performance.md](./performance.md)（官方 8 条 checklist）

---


---

### 3.8 Chromium 在 Electron 中的角色

**Q：Renderer 的本质是什么？Chromium 提供了什么能力？**

Chromium = Chrome 浏览器的开源内核。不是一个应用，是一个引擎。

**它提供的能力**：

- V8 引擎（执行 JS）
- Blink 排版引擎（HTML/CSS → 计算布局 → 绘制像素）
- GPU 加速渲染（合成层 / Canvas / WebGL）
- 完整 Web API（DOM / Fetch / WebSocket / IndexedDB / Web Worker / Canvas / WebRTC）
- DevTools（调试工具）
- 网络栈（HTTP/HTTPS/WebSocket）
- 多进程架构 + 沙箱安全模型

**在 Electron 中**：

Renderer 进程 = 一个 Chromium 渲染进程。你写的 React/Vue 页面跑在 Chromium 里，和浏览器打开完全一样。DevTools 也是 Chromium 自带的。

**一句话**：Chromium 管"看到什么"（渲染 UI + 执行页面 JS + Web API），Node.js 管"能做什么"（系统 API），Electron 管"怎么把两者连起来"。

---


---

### 3.9 Electron 调试

**Q：Electron 怎么调试？**

**最佳实践：用 electron-vite，`pnpm dev` 一条命令全搞定。**

electron-vite 启动后自动：Main 进程带 source map（VS Code 可断点）+ Renderer 自动开 DevTools + HMR 热更。不需要手动配置。

**底层原理（如果被追问）**：

- Renderer 调试 = 窗口里按 `Ctrl+Shift+I` 打开 DevTools（和浏览器 F12 一样）
- Main 调试 = 启动时加 `--inspect=5858` → Chrome 打开 `chrome://inspect` 连接
- Electron 本身不提供集成调试命令，调试能力靠外部工具（VS Code debugger / DevTools / electron-vite 封装）


---


---

### 3.10 Electron 启动流程 + 生命周期 + 各阶段做什么

**Q：Electron 的启动流程和生命周期是怎样的？各阶段一般做什么？**

**全流程**：

```
启动阶段：
  will-finish-launching  → 极早期（macOS open-file/open-url 要在这注册）
  ready                  → 初始化完成，可以创建窗口

运行阶段：
  activate (macOS)       → 点 Dock 图标时没有窗口 → 重新创建
  window-all-closed      → 所有窗口关闭
                           macOS：不退出 / Windows+Linux：app.quit()

退出阶段：
  before-quit            → 即将退出（最后机会）
  will-quit              → 窗口已关，即将退出进程
  quit                   → 进程退出
```

**各阶段典型动作**：

| 阶段 | 做什么 |
|------|--------|
| `ready` | 创建窗口 / 注册 IPC handler / Tray / globalShortcut / 检查更新 / 启动子进程 |
| `activate` | macOS 重新创建窗口（Dock 点击） |
| `before-quit` | 保存用户配置 / 关闭 DB 连接 / 注销全局快捷键 / 杀子进程 / 清理临时文件 |
| `ready-to-show`（Window） | `win.show()`（先隐藏窗口，内容渲染完再显示，避免白闪） |
| `close`（Window） | 判断是隐藏到 Tray 还是真关（`e.preventDefault()` + `win.hide()`） |

→ 详见 [dev-cheatsheet.md#生命周期事件](./dev-cheatsheet.md#生命周期事件)


---


---

### 3.11 Electron 开发全链路最佳实践

**Q：从零开始做一个 Electron 应用，完整开发链路是什么？每个环节用什么工具？**

| 阶段 | 做什么 | 工具 |
|------|--------|------|
| 初始化 | 创建项目骨架（main/preload/renderer 三端目录） | `npm create @electron-vite` |
| 开发 | 三端同时构建 + HMR + 自动重启 + DevTools | `electron-vite`（`pnpm dev` 一条命令） |
| UI 框架 | Renderer 里写页面 | React / Vue（和普通 Web 开发一样） |
| 类型 | TypeScript 全栈 | `tsconfig.json` × 3（main/preload/renderer 各一份） |
| 调试 | Main 断点 + Renderer DevTools | electron-vite 内置（VS Code F5 / Ctrl+Shift+I） |
| 测试 | 单元测试 + E2E | vitest（单元）+ Playwright / Spectron（E2E） |
| 打包 | 构建三端产物 → 生成安装包 | `electron-builder`（产出 .dmg / .exe / .AppImage） |
| 签名 | 代码签名（防系统拦截） | electron-builder 自动调 codesign / signtool |
| 发布 | 上传到 CDN / GitHub Releases | electron-builder `--publish always` |
| 自动更新 | 用户无感升级 | `electron-updater`（autoUpdater） |
| CI/CD | 三平台并行构建 + 签名 + 发布 | GitHub Actions matrix |

**完整命令流**：

```bash
# 1. 创建项目
npm create @electron-vite

# 2. 开发
pnpm dev                          # 启动开发（三端 HMR + DevTools）

# 3. 构建
pnpm build                        # 构建三端产物

# 4. 打包（本地验证）
npx electron-builder --dir        # 只打目录，不生成安装包（快速验证）

# 5. 打包 + 发布
npx electron-builder --mac --win --linux --publish always
```

**electron-vite 是什么**：专门为 Electron 定制的 Vite 构建工具。解决"Electron 有三个入口（Main/Preload/Renderer），普通 Vite 只能构建一个"的问题。统一管理三端构建 + HMR + 调试，是目前 Electron 开发的标准脚手架。


---

## 4. RN


---

### 4.1 RN 键盘遮挡问题

**Q：RN 的 TextInput 弹出键盘时为什么会遮挡内容？必须手动处理吗？RN 没有自动处理？**

A：RN 不自动处理，必须手动用 `KeyboardAvoidingView`。

**为什么有这个问题**：
- iOS 原生 `UIScrollView` 会自动调整，但 RN 的 View 不是标准 UIScrollView
- Android 可以设 `windowSoftInputMode: adjustResize`，但 RN 布局不一定正确响应
- 结果：键盘弹起后遮住 TextInput 或底部按钮

**为什么 RN 不自动处理**：因为"什么内容该被顶上去"是业务决定的（可能只想顶输入框，不想整个页面动），RN 不敢自作主张。

**解决方案**：

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView 
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  {/* 页面内容 */}
  <TextInput placeholder="输入消息..." />
</KeyboardAvoidingView>
```

`behavior` 分平台：iOS 用 `'padding'`（底部加 padding），Android 用 `'height'`（缩小容器高度）。

**KeyboardAvoidingView 原理**：

监听键盘弹出事件 → 获取键盘高度 → 动态调整自身布局。本质 = "监听事件 + 改 style"的容器组件。

1. 监听系统键盘事件（iOS: `keyboardWillShow` / Android: `keyboardDidShow`）
2. 从事件中拿到键盘高度（如 300px）
3. 根据 `behavior` 属性调整自身容器：
   - `'padding'`：容器底部加 `paddingBottom = 键盘高度`（内容被顶上去）
   - `'height'`：容器高度缩小 = 原高度 - 键盘高度（容器变矮）
   - `'position'`：容器整体往上平移 `translateY = -键盘高度`
4. 键盘收起时恢复原状

**为什么分平台用不同 behavior**：
- iOS 用 `'padding'`：iOS 键盘弹出时窗口不会自动缩小，加 padding 最自然
- Android 用 `'height'`：Android 的 `adjustResize` 已经会缩小窗口，用 height 配合效果更好

---


---

### 4.2 Chat UI 常见 CSS/布局问题（跨端）

**Q：Chat 场景中，Electron / RN 会遇到什么常见 CSS/布局问题？**

**Electron（Web）**：

- 消息气泡自适应宽度：`max-width: 70%` + `word-break: break-word`
- 代码块横向滚动：`overflow-x: auto` + `white-space: pre`
- 流式渲染时滚动条自动到底：`scrollIntoView({ behavior: 'smooth' })`，但要判断用户是否手动滚上去了（如果手动滚了就不强制到底）
- Markdown 表格溢出：外层加 `overflow-x: auto` 容器

**RN**：

- 键盘遮挡：`KeyboardAvoidingView`（[4.1 已记录](#41-rn-键盘遮挡问题)）
- 消息列表从底部开始：`FlatList` 的 `inverted` 属性（翻转列表，新消息在底部）
- 长消息性能：`React.memo` + `getItemLayout` 提供固定高度估算避免重复测量
- 代码块不能横向滚动：RN 的 `Text` 不支持 `overflow-x`，需要用 `ScrollView` 包裹代码块

---


---

### 4.3 RN 核心组件与常见问题

**核心组件**（= Native View 的 JS 映射）：

| 组件 | 作用 | 对应 Web |
|------|------|---------|
| `View` | 容器 | `<div>` |
| `Text` | 文本（必须用，不能裸写文字） | `<span>` |
| `Image` | 图片 | `<img>` |
| `ScrollView` | 滚动容器 | `overflow: auto` |
| `FlatList` | 长列表（虚拟化） | 虚拟滚动列表 |
| `TextInput` | 输入框 | `<input>` |
| `TouchableOpacity` | 点击反馈 | `<button>` |

**核心部件**：Navigation（路由）/ 状态管理（Zustand）/ 网络（fetch）/ 存储（AsyncStorage）/ 动画（Reanimated）

**常见问题**：
- 键盘遮挡 → `KeyboardAvoidingView`（[4.1](#41-rn-键盘遮挡问题)）
- FlatList 性能 → `React.memo` + `getItemLayout` + FlashList
- 平台差异 → `Platform.OS` 条件判断 + 平台文件后缀（.ios.ts / .android.ts）
- Bridge 瓶颈 → 新架构 JSI 零拷贝（旧 Bridge JSON 序列化慢）

→ RN 更多内容见 [RN 文档目录](../RN/README.md)


---


---

### 4.4 RN 典型平台差异（面试讲 2-3 个）

| 差异 | 问题 | 抹平方式 |
|------|------|---------|
| Android 物理返回键 | iOS 没有，Android 按返回键要处理（退出/返回上页/关弹窗） | `BackHandler.addEventListener('hardwareBackPress', handler)` |
| 安全区 / 刘海屏 | iOS 有 Safe Area（状态栏/Home Indicator），Android 异形屏 | `react-native-safe-area-context` 的 `SafeAreaView` + `useSafeAreaInsets()` |
| 权限申请 | iOS 在 Info.plist 声明即可，Android 需要运行时动态申请 | `react-native-permissions` 统一 API，内部按平台走不同逻辑 |

抹平手段：`Platform.OS` 条件 / 平台文件后缀（`.ios.ts` / `.android.ts`）/ `Platform.select()`。

---


---

### 4.5 Safe Area / 刘海屏适配详解

**Q：刘海屏 / Safe Area 是什么问题？怎么处理？**

**问题本质**：现代手机屏幕不是完整矩形——顶部有刘海/挖孔（状态栏区域），底部有 Home Indicator（iOS）或导航栏。如果你的内容画到这些区域，会被遮挡或被系统 UI 覆盖。

**iOS 的 Safe Area**：

```
┌───────────────────────────────┐
│ ████ 状态栏 / 刘海 ████       │ ← 不安全区域（内容会被遮挡）
├───────────────────────────────┤
│                               │
│     Safe Area（安全区域）       │ ← 你的内容应该在这里面
│                               │
├───────────────────────────────┤
│      Home Indicator            │ ← 不安全区域
└───────────────────────────────┘
```

**RN 处理方式**：

```tsx
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// 方式 1：SafeAreaView 包裹（简单，自动加 padding）
<SafeAreaProvider>
  <SafeAreaView style={{ flex: 1 }}>
    {/* 内容自动避开刘海和 Home Indicator */}
  </SafeAreaView>
</SafeAreaProvider>

// 方式 2：useSafeAreaInsets()（精细控制，需要自己用 insets 值）
function MyScreen() {
  const insets = useSafeAreaInsets();
  // insets = { top: 47, bottom: 34, left: 0, right: 0 }（iPhone 14 Pro 的值）
  return (
    <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* 精确控制哪些区域需要避让 */}
    </View>
  );
}
```

**为什么用 `react-native-safe-area-context` 而不是 RN 内置的 `SafeAreaView`**：RN 内置的只支持 iOS，不支持 Android。第三方库统一了双平台 + 提供 hooks API + 支持自定义边距。

---


---

## 5. React

（待补充）

---


---

## 6. Agent


---

### 6.1 文件上传方案（跨端对比）

**Q：文件上传一般怎么做？后端用什么接口/方法？前端怎么传？浏览器/Electron/RN 分别怎么做？**

A：

**后端**：`POST /upload`，`Content-Type: multipart/form-data`。Node 用 `multer` 中间件接收。

**各端实现对比**：

| 端 | 选择文件 | 构造请求体 | 发送 |
|---|---|---|---|
| 浏览器 | `<input type="file">` → `File` 对象 | `new FormData()` + `append('file', file)` | `fetch(url, { method: 'POST', body: formData })` |
| Electron | `dialog.showOpenDialog()` → 文件路径 | Main 进程 `fs.createReadStream` + `form-data` 库 | Main 进程 `fetch` / `axios`（不受 CORS） |
| RN | `react-native-document-picker` → `uri` | `new FormData()` + `append('file', { uri, type, name })` | `fetch(url, { method: 'POST', body: formData })` |

**关键区别**：

```
浏览器：
  File 对象 = 浏览器沙箱里的引用，不能拿到真实路径
  FormData + fetch 就行，浏览器自动设 Content-Type boundary

Electron：
  两种方式：
    ① Renderer 直接 <input type="file">（和浏览器一样）
    ② Main 进程 dialog.showOpenDialog() → 拿到完整路径 → fs.readFile → 构造请求
  走 Main 的好处：不受 CORS + 可以读文件内容做本地处理再上传

RN：
  不能用 <input type="file">（没有 DOM）
  用 document-picker / image-picker 获取文件 uri
  FormData 里传 { uri, type, name } 对象（RN 的 fetch 会自动读 uri 对应的文件）
```

**大文件优化**：分片上传（S3 MPU / 自研分片接口）—— 你的负载分析平台项目里 4.4G 文件就是这个方案。

**Node 后端怎么接收**：

```typescript
// Express + multer
import multer from 'multer';
const upload = multer({ dest: '/tmp/uploads/' });  // 存到临时目录

app.post('/upload', upload.single('file'), (req, res) => {
  // multer 已经帮你把文件从 HTTP chunked stream 完整接收并写到磁盘
  console.log(req.file);
  // {
  //   fieldname: 'file',
  //   originalname: 'report.pdf',
  //   mimetype: 'application/pdf',
  //   size: 102400,
  //   path: '/tmp/uploads/abc123',  ← 临时文件路径
  // }

  // 存储：移动到永久位置 或 上传到 S3/OSS
  fs.renameSync(req.file.path, `/data/files/${req.file.originalname}`);
  res.json({ ok: true });
});
```

HTTP 传输层是流式（chunked），但 multer 默认等文件完整接收后才交给你。如果要边收边处理（真正流式），用 `busboy` 直接操作 ReadableStream。

// 文件上传 node端怎么做的, 收到什么, 如何存储, 是流式的吗 


---


---

### 6.2 Chat Stream 全链路

**Q：Chat 的流式输出全链路是怎样的？核心 API 和 HTTP Header 是什么？**

→ Mako 流式传输源码拆解：[04-streaming.md](../../../project/AI/mako/deep-dive/04-streaming.md)

**全链路**：

**① 前端发起请求**：

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Accept': 'text/event-stream',            // 告诉后端我要 SSE 流
  },
  body: JSON.stringify({ messages: [...] }),
});
```

**② 后端返回响应头 + Node 实现**：

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Transfer-Encoding: chunked
```

> **`text/event-stream` 的作用**：告诉浏览器和中间层（Nginx/CDN/网关）"这是持续推送的流，不要缓冲整个响应再转发，要逐块立即透传"。如果不设这个，代理可能攒满 buffer 才一次性转发（用户就看到"等半天突然全出来"而不是逐字出来）。

Node 后端最小实现（Express）：

```typescript
app.post('/api/chat', (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 核心：用 res.write() 逐条推送，不调 res.end()（保持连接）
  res.write(`data: {"type":"token","content":"你"}\n\n`);  // 每条事件以 \n\n 结尾
  res.write(`data: {"type":"token","content":"好"}\n\n`);

  // 实际场景：调 LLM API 拿到 stream → 逐 token 转发
  const llmStream = await openai.chat.completions.create({ stream: true, ... });
  for await (const chunk of llmStream) {
    const token = chunk.choices[0]?.delta?.content || '';
    res.write(`data: {"type":"token","content":"${token}"}\n\n`);
  }

  res.write(`data: {"type":"done"}\n\n`);
  res.end();  // stream 结束，关闭连接
});
```

关键：`res.write()` = 往 TCP 连接写一块数据但不关闭。每写一次前端就收到一次。`res.end()` = 流结束。

**③ 后端持续推送**（每个 token 一条事件，以 `\n\n` 分隔）：

```
data: {"type":"token","content":"你"}

data: {"type":"token","content":"好"}

data: {"type":"tool_call","name":"search","input":"..."}

data: {"type":"token","content":"根据搜索结果..."}

data: {"type":"done"}
```

**④ 前端逐行解析 + 增量渲染**：

```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();  // 核心 API：逐块读取
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  // 按 \n\n 分割出完整的 SSE 事件
  const events = buffer.split('\n\n');
  buffer = events.pop()!;  // 最后一个可能不完整，留着继续拼

  for (const event of events) {
    if (!event.startsWith('data: ')) continue;
    const data = JSON.parse(event.slice(6));  // 去掉 "data: " 前缀

    if (data.type === 'token') {
      setContent(prev => prev + data.content);  // 增量拼接到 UI
    }
    if (data.type === 'done') return;
  }
}
```

**前端收到的 value 是什么**：

`reader.read()` 返回 `Uint8Array`（原始字节），不是字符串。`TextDecoder` 把字节按 UTF-8 解码成字符串。`{ stream: true }` 防止多字节字符（如中文 3 字节）在 chunk 边界被截断。

例子：服务器发 "你好" → 网络传输 UTF-8 编码的 6 字节 `[0xE4, 0xBD, 0xA0, 0xE5, 0xA5, 0xBD]` → `reader.read()` 拿到 `Uint8Array([228, 189, 160, 229, 165, 189])` → `TextDecoder.decode()` → `"你好"`。

**核心记忆点**：

| 要素 | 值 |
|------|---|
| 请求头 | `Accept: text/event-stream` |
| 响应头 | `Content-Type: text/event-stream` + `Transfer-Encoding: chunked` |
| 前端核心 API | `response.body.getReader()` + `reader.read()` 循环 |
| 数据格式 | `data: {json}\n\n`（每条事件以双换行分隔） |
| 替代方案 | `EventSource` API（更简单但只支持 GET，不能带 POST body） |

---


---

### 6.3 Mako 五层上下文管道

本质：解决"信息无限增长 vs LLM 窗口有限"的矛盾。5 层递进防御，渐进式压缩。
主要是tools的执行结果, 例如读取了一个很大的文件:

- L1 截断（过大单条消息）→ L2 去重(hash对比) → L3 微压缩（规则替换旧工具结果, 旧工具素材占位淘汰）→ L4 AI 摘要（80% 触发）→ L5 归档 + BM25 索引（95% 触发）

面试话术："大部分情况前三层零成本就够了，只有超长对话才触发 L4/L5。"

→ 详见 [5 层上下文管道源码拆解](../../../project/AI/mako/deep-dive/02-context-pipeline.md)
→ 速查 [Mako 速查手册](../../../project/AI/mako/mako-cheatsheet.md)

---


---

### 6.4 MCP 协议

本质：标准化 Agent ↔ 外部工具的通信协议。让 Agent 不用为每个工具写适配代码。

核心交互：Agent 启动时调 `tools/list` 拿到工具列表（JSON Schema），运行时调 `tools/call` 执行工具。

→ 详见 [AI Agent 概念 - MCP](../../../project/AI/ai-agent-core-concepts.md#41-mcpmodel-context-protocol)
→ Mako MCP 实现 [工具系统 & MCP](../../../project/AI/mako/deep-dive/03-tool-system.md)

---


---

### 6.5 LangChain 核心概念

本质：服务端 AI 应用的胶水框架。核心抽象：Chain（调用链）/ Agent（ReAct 循环）/ Tool / Memory / Retriever。

Trade-off：Coding Agent 场景太重、TS 版滞后、核心逻辑本身很简单（while + 工具调用）→ 工业界（Claude Code/Cursor/Aider）全部自实现。

→ 详见 [LangChain 理解](../../../project/AI/langchain-understanding.md)
→ 为什么不用框架 [Mako 设计决策](../../../project/AI/mako/deep-dive/06-design-decisions.md)

---


---

### 6.6 提示词工程核心原则

6 条核心手法：

1. **角色定义**（"You are a senior frontend engineer..."）→ 框定行为边界
2. **结构化输出约束**（"Respond in JSON: {thought, action, input}"）→ 让输出可解析
3. **Few-shot 示例**（给 1-2 个正确调用例子）→ 教 LLM 正确格式
4. **负面约束**（"Do NOT..."）→ 防止常见错误
5. **分步思考**（"Think step by step"）→ 提升推理准确率
6. **温度控制**（代码用低 temperature 0-0.2，创意用高 0.7-1）

→ 详见 [AI Agent 概念 - Prompt Engineering](../../../project/AI/ai-agent-core-concepts.md#13-prompt-engineering)

---


---

### 6.7 RAG + 向量数据库

本质：LLM 不知道的信息 → 先检索相关内容 → 塞进 prompt → LLM 基于检索结果回答。

链路：Query → Embedding → 向量检索（余弦相似度）→ Top-K 结果（返回的是原始文本片段）→ 拼进 messages 上下文 → 调 LLM。

向量数据库怎么建：
1. 收集私域资料（文档/代码/FAQ）→ 切分成小段（chunk）。切分方式：按段落/按固定 token 数（如 500 token）+ 重叠（overlap 50-100 token 防止语义断裂）。工具：LangChain 的 `RecursiveCharacterTextSplitter` / 自己写按 `\n\n` 分段。本质就是"把长文档拆成 LLM 一次能消化的小块"。
2. 每段调 Embedding 模型（如 OpenAI text-embedding-3）→ 得到一个向量（1536 维数组）
3. 向量 + 原始文本 一起存入向量数据库（Pinecone / Chroma / pgvector）
4. 查询时：用户 query 也过 Embedding → 向量 → 和库中所有向量算余弦相似度 → Top-K 最近的 → 取出对应的原始文本 → 拼到 prompt 里

本质就是"把文本变成数字，用数学距离代替语义相似度"。

Mako 的简化版：不用向量数据库，用 BM25 关键词检索（minisearch），对代码场景够用。

→ 详见 [AI Agent 概念 - RAG](../../../project/AI/ai-agent-core-concepts.md#21-rag检索增强生成)
→ BM25 说明 [Mako 速查手册 - BM25](../../../project/AI/mako/mako-cheatsheet.md#bm25-是什么)

---


---

### 6.8 为什么不用 LangChain？jieyue桌面端该用吗？

**Q：Mako 为什么不用 LangChain？jieyue桌面端应该用吗？**

**核心结论**：没必要引入复杂度。核心问题靠 LangChain 解决不了。

**为什么不用**：
- Agent 核心循环本身很简单（while + 工具调用，30 行代码）
- 真正的难点（上下文管道 / 流式双向通信 / 安全确认 / 进程隔离）是业务强相关的工程问题，框架帮不了
- 工业界验证：Claude Code / Cursor / Aider / OpenHands 全部自实现，无一用 LangChain
- TS 端 LangChain.js 是二等公民，功能滞后

**收益 vs 代价**：

| 收益 | 代价 |
|------|------|
| 快速原型 / RAG 开箱即用 / 多 VectorStore 集成 | 抽象过重（5-6 层 wrapper）/ 调试困难 / 定制受限 / TS 版滞后 |

**什么时候适合用**：Python 后端 RAG 应用 + 快速验证 MVP + 团队没 Agent 经验。
**什么时候不该用**：产品级 Agent / TS 环境 / 需要深度定制。

**面试话术**："核心循环 30 行不需要框架，真正的难点（上下文管道、流式通信）框架帮不了。工业界全部自实现。LangChain 适合 Python RAG 原型，不适合 TS 桌面端 Agent。"

→ 详见 [LangChain 理解](../../../project/AI/langchain-understanding.md) / [为什么不用框架](../../../project/AI/mako/why-not-frameworks.md)


---


---

## 7. Basic


---

### 7.1 Flex 布局速记

**Q：Flex 布局核心属性？**

**容器属性**（加在父元素上）：

| 属性 | 作用 | 常用值 |
|------|------|--------|
| `display` | 开启 flex | `flex` |
| `flex-direction` | 主轴方向 | `row`（默认）/ `column` |
| `justify-content` | 主轴对齐 | `center` / `space-between` / `flex-start` |
| `align-items` | 交叉轴对齐 | `center` / `stretch` / `flex-start` |
| `flex-wrap` | 是否换行 | `nowrap`（默认）/ `wrap` |
| `gap` | 子项间距 | `8px` / `16px` |

**子项属性**（加在子元素上）：

| 属性 | 作用 | 常用值 |
|------|------|--------|
| `flex` | 占剩余空间 | `1`（= grow:1 shrink:1 basis:0） |
| `flex-shrink` | 是否缩小 | `0`（不缩小） |
| `align-self` | 单独覆盖交叉轴对齐 | `center` / `flex-end` |

**Chat 布局经典用法**：

```css
/* 整体：左侧列表 + 右侧对话 */
.app { display: flex; height: 100vh; }
.sidebar { width: 260px; flex-shrink: 0; }
.main { flex: 1; display: flex; flex-direction: column; }

/* 对话区：消息列表占满 + 输入框固定底部 */
.messages { flex: 1; overflow-y: auto; }
.input-area { flex-shrink: 0; padding: 16px; }
```

---


---

### 7.2 HTTP 缓存速记

**Q：HTTP 缓存机制？强缓存和协商缓存的区别？**

**强缓存**（不发请求，直接用本地）：

| Header | 作用 | 示例 |
|--------|------|------|
| `Cache-Control` | 控制缓存策略 | `max-age=31536000`（缓存1年） |
| `Expires` | 过期时间（旧方案） | `Thu, 01 Dec 2025 16:00:00 GMT` |

命中强缓存 → 状态码 `200 (from disk cache)`，不发请求。

**协商缓存**（发请求问服务器"变了吗？"）：

| 第一次响应带 | 第二次请求带 | 服务器判断 |
|-------------|-------------|-----------|
| `ETag: "abc123"` | `If-None-Match: "abc123"` | 比对 hash |
| `Last-Modified: 时间` | `If-Modified-Since: 时间` | 比对修改时间 |

没变 → `304 Not Modified`（不传 body，用本地缓存）。变了 → `200` + 新内容。

**优先级**：`Cache-Control` > `Expires`；`ETag` > `Last-Modified`。

**Chat 场景和缓存的关系**：SSE 流 `Cache-Control: no-cache`（不缓存）。但静态资源（头像/字体/图标）走强缓存。


---
