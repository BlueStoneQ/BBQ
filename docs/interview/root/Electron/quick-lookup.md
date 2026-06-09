# Electron 速查（JY prep）

> 面试前快速过一遍。每行 = 一句话本质 + 关键词 + 跳转链接。

---

## 一、你做了什么（IDE 项目）

| 问题 | 一句话回答 | 关键词 | 详情 |
|------|-----------|--------|------|
| IDE 本体改了什么？ | 4 点：元信息 / 内置插件列表 / 暴露新 API / 自定义 CLI | product.json / ViewContainerLocation / setAsDefaultProtocolClient | [→ overview](./ide/overview.md#二ide-本体核心改动4-点) |
| 暴露 API 怎么做的？ | 复用 ViewContainer 体系加 Header 位置，3 处源码改动，插件侧零变化 | ViewContainerLocation.Header / layout.ts / PaneCompositePart | [→ custom-api](./ide/custom-api-header-webview.md#方案-a-复用-viewcontainer-体系-推荐) |
| 内置插件怎么装的？ | 首次启动时从商店拉取，Workbench Contribution 注册启动任务 | registerWorkbenchContribution2 / LifecyclePhase.Eventually | [→ builtin-install](./ide/builtin-extension-install.md) |
| 语言支持怎么做的？ | TextMate Grammar（词法快）+ LSP Semantic Tokens（语义精）双层 | Language Server / 独立进程 / JSON-RPC | [→ lsp](./ide/lsp.md) |

---

## 二、VS Code 源码认知

| 问题 | 一句话回答 | 关键词 | 详情 |
|------|-----------|--------|------|
| 源码分层？ | base（工具）→ platform（服务）→ workbench（UI）→ code（入口） | 四层 / DI 贯穿 | [→ 分层](./vscode/01-源码分层与模块化.md) |
| DI 怎么做的？ | 装饰器 @IXxxService + createDecorator + instantiationService | 服务定位器模式 / 构造函数注入 | [→ DI](./vscode/02-依赖注入与服务化.md) |
| 多进程模型？ | Main + Renderer + Extension Host + Language Server + 子进程 | 崩溃隔离 / 可能卡的东西独立进程 | [→ 进程模型](./vscode/03-进程模型与启动流程.md) |
| IPC 通信？ | MessagePort / RPC 协议 / $前缀标记跨进程方法 | MainThread ↔ ExtHost / protocol.ts | [→ IPC](./vscode/04-IPC通信机制.md) |
| 插件系统？ | Extension Host 独立进程 + contributes 声明 + activation events 懒加载 | 沙箱隔离 / Extension API / proposed API | [→ 插件](./vscode/05-插件系统架构.md) |
| Monaco 编辑器？ | VS Code 的编辑器内核，可独立使用，Model-View 分离 | TextModel / ViewLines / Decorations | [→ Monaco](./vscode/06-Monaco编辑器内核.md) |
| LSP 协议？ | 编辑器 ↔ 语言服务器 的标准协议，JSON-RPC，独立进程 | textDocument/completion / textDocument/definition | [→ LSP](./vscode/07-Language-Server-Protocol.md) |

---

## 三、Electron 核心问题

| 问题 | 一句话回答 | 关键词 | 详情 |
|------|-----------|--------|------|
| Electron 本质？ | Chromium（渲染 UI）+ Node.js（系统 API）编译到同一个二进制 | 合并事件循环 / Mojo IPC | [→ overview](./overview.md#第一性原理) |
| IPC 底层？ | Chromium Mojo（跨平台封装 Unix Socket/Named Pipe/Mach Port）| Structured Clone / 异步 / ~0.1ms | [→ ipc](./ipc.md) / [→ qa](./qa.md#mojo-是什么为什么能让-html-和-nodejs-通信) |
| Preload 是什么？ | 不是通信机制，是"白名单注册端"——定义 Renderer 能调哪些 IPC 方法 | contextBridge / exposeInMainWorld / 安全隔离 | [→ walkthrough](./walkthrough.md#三个文件各自的角色) |
| 安全三道防线？ | contextIsolation + nodeIntegration:false + sandbox:true + preload 白名单 | 渲染进程不信任 / 最小权限 | [→ qa 安全](./qa.md#安全怎么做) |
| 稳定性核心？ | 崩溃恢复（Main 兜底 / Renderer crashed 自动 reload / 子进程重启） | uncaughtException / webContents.on('crashed') | [→ qa 稳定性](./qa.md#稳定性核心是内存问题吗) |
| 网络请求模型？ | Renderer 可直接 fetch（受 CORS）或走 Main 代理（不受 CORS + 统一认证） | 两种方式按场景选 | [→ qa 网络](./qa.md#网络请求模型renderer-的请求经过-main-转发吗) |
| 性能优化？ | 包体（asar/裁剪 node_modules）/ 启动（preload 延迟/show:false）/ 内存（heapdump） | electron-builder / ready-to-show / getAppMetrics | [→ performance](./performance.md) |
| 自动更新？ | electron-updater + CDN，checkForUpdates → 下载 → quitAndInstall | publish provider / 差量更新 | [→ qa autoUpdater](./qa.md#autoupdater-主要用来做什么) |
| UtilityProcess？ | Electron 官方轻量子进程，替代 child_process.fork，MessagePort 通信 | Electron 22+ / 崩溃隔离 / 低开销 | [→ qa2](./qa2.md#31-utilityprocess工具进程是什么) |

---

## 四、AI 桌面客户端（Doubao 对标）

| 问题 | 一句话回答 | 关键词 | 详情 |
|------|-----------|--------|------|
| 架构？ | Electron 多窗口（主窗口 + 悬浮窗 + Tray 常驻） | Main 管系统能力 / Renderer 管 UI | [→ doubao](./doubao/README.md#三架构拆解) |
| 流式渲染？ | SSE 推流 + 增量 Markdown patch + shiki 代码高亮 + 虚拟滚动 | token by token / 未闭合代码块处理 | [→ doubao 流式](./doubao/README.md#对话流式渲染) |
| 全局唤起？ | globalShortcut 系统级快捷键 + 悬浮 BrowserWindow（无边框+置顶） | RegisterHotKey / alwaysOnTop / skipTaskbar | [→ doubao 唤起](./doubao/README.md#全局唤起悬浮窗全局快捷键) |
| 截图？ | native 截图工具 child_process 或自研全屏透明窗口 + canvas 裁剪 | desktopCapturer / screencapture -i | [→ doubao 截图](./doubao/README.md#截图--ocr) |
| 常驻后台？ | Tray 托盘 + 关闭窗口 preventDefault + hide（不真正退出） | mainWindow.on('close') / app.on('before-quit') | [→ doubao Tray](./doubao/README.md#常驻后台tray) |
| Agent 本地执行？ | Main 进程调 fs API 操作文件系统，IPC 传指令 | 权限白名单 / 沙箱控制 / 超时兜底 | [→ doubao 文件](./doubao/README.md#文件分析) |
| 和 IDE 的共通点？ | 同构架构：Electron 多窗口 + 系统能力 + 长连接数据流 + 本地持久化 | 业务不同，架构相同 | [→ doubao 对比](./doubao/README.md#六与快应用-ide-的共通点) |
