# VSCode 架构 Q&A

> 面试/学习过程中的高频追问，原汁原味的问答式记录。

---

## Q: 进程那么多不会爆炸吗？

**实际运行时进程数没有想的那么多。** 典型场景下一个 VSCode 窗口大约 5~7 个进程：

```
1. Main Process           ← 1 个，永远只有 1 个
2. Renderer (窗口)         ← 每个窗口 1 个（大多数人就开 1~2 个窗口）
3. Extension Host         ← 通常 1 个（除非有 Remote）
4. Shared Process         ← 1 个（多窗口共享）
5. PTY Host              ← 1 个（管理所有终端）
6. File Watcher          ← 1 个
7. GPU Process           ← Chromium 自带的
```

**为什么不会爆炸：**

| 控制策略 | 做法 |
|---------|------|
| 进程数固定 | 不是每个插件一个进程，而是所有插件共享一个 Extension Host |
| 按需创建 | PTY Host / File Watcher 只在用到时才 fork |
| Utility Process 轻量 | 不是 BrowserWindow（无 GPU/渲染开销），只是纯 Node 进程 |
| 共享进程 | 多窗口共用 Shared Process，不是每窗口一套 |
| LSP Server 由插件控制 | Language Server 是插件自己 spawn 的子进程，不属于 VSCode 核心进程模型 |

**内存开销对比：**

```
Main Process:        ~50MB
Renderer:            ~200-400MB (取决于编辑器内容)
Extension Host:      ~100-300MB (取决于插件数)
Shared Process:      ~50MB
PTY Host:            ~30MB
File Watcher:        ~20MB
─────────────────────────────
总计: ~500MB - 1GB (正常范围)
```

相比之下，如果把插件放在渲染进程里跑（单进程方案），一个插件死循环就卡死整个 UI。多进程是**用内存换稳定性**的经典 trade-off——和 Chrome 的多进程架构是同一个思路。

---

## Q: 插件是所有插件都在一个 Extension Host 进程里吗？

是的，**同类型的所有插件共享一个 Extension Host 进程**。

```
Extension Host Process (1 个 Node.js 进程)
├── 插件 A (Python)        ← 共享同一个 V8 isolate
├── 插件 B (Git)           ← 同一个事件循环
├── 插件 C (ESLint)        ← 同一个内存空间
├── 插件 D (Prettier)
└── ... (你装的所有插件)
```

**这意味着**：
- 一个插件写了死循环 → 整个 Extension Host 卡死 → 所有插件都不响应
- 但 UI 不受影响（因为在另一个进程）
- VSCode 检测到 Extension Host 无响应后会提示"重启 Extension Host"

**为什么不是每个插件一个进程？**

| 如果每插件一进程 | 问题 |
|----------------|------|
| 100 个插件 = 100 个进程 | 内存爆炸 (每个 Node 进程 ~50MB 起) |
| 插件间 API 调用 | 变成跨进程 IPC，性能差 |
| `vscode.extensions.getExtension()` | 需要跨进程序列化 |

**但有例外** — 有几种 Extension Host 类型可以并存：

```
┌─ Local Extension Host (Node.js 进程) ──── 本地桌面插件 (大多数)
│
├─ Web Extension Host (Web Worker) ──────── 轻量/Web 兼容插件
│
└─ Remote Extension Host (远程进程) ──────── SSH/Container 场景的插件
```

所以更准确地说：同一种 Kind 的插件在同一个 Host 进程中。典型桌面场景就是 1 个 Local Extension Host 跑所有本地插件。

**插件自己 spawn 的子进程不算在内**：比如 LSP Server 是插件自己 fork 出来的独立进程，那个不受 Extension Host 管辖——所以一个 Python 插件可能额外带一个 pylsp 进程，但那是插件的事，不是 VSCode 架构的事。

---

## Q: LSP 是一种语言一个进程？那么多语言不会爆炸？

好问题。不会爆炸，因为有两道防线：

### 1. 懒激活 — 不用的语言根本不启动

```
你装了 20 个语言插件:
  Python, Go, Rust, Java, C++, Ruby, PHP, ...

你打开了一个 TypeScript 项目:
  → 只有 TypeScript Server 启动
  → 其他 19 个语言的 LSP Server 进程数 = 0
```

LSP Server 只在**打开对应语言文件时**才 spawn。没打开 `.py` 文件 → pylsp 进程根本不存在。

### 2. 实际场景 — 同时跑的通常就 1~3 个

一个项目通常就涉及 1~3 种语言：

| 项目类型 | 实际跑的 LSP Server |
|---------|-------------------|
| 前端项目 | TypeScript Server (1 个，覆盖 TS/JS/JSX) |
| Python 项目 | Pylance (1 个) |
| 全栈项目 | TypeScript + Python = 2 个 |
| 最极端 | TS + Python + Go + CSS = 4 个 |

而且像 TypeScript Server 很聪明，一个进程覆盖 `.ts/.js/.jsx/.tsx` 所有 JS 系语言，不是每种一个。

### 3. 内存占用其实可控

| Language Server | 典型内存 | 说明 |
|----------------|---------|------|
| TypeScript (tsserver) | 200-500MB | 最重的，因为要维护类型信息 |
| Pylance | 100-300MB | 也不轻，做类型推断 |
| Go (gopls) | 50-150MB | 相对轻 |
| CSS/HTML | 20-50MB | 很轻 |
| JSON | 10-20MB | 极轻 |

所以实际就是 1 个大的 (TS/Python) + 1~2 个小的，总共多占 300MB~800MB，对现代机器完全可接受。

### 4. 关闭文件 → Server 可以退出

部分 LSP Server 在对应文件全部关闭后会自动退出或进入休眠。这取决于插件实现，但协议支持 `shutdown` → `exit` 生命周期。

**总结**：理论上一种语言一个进程，但实际同时活跃的就 1~3 个，因为懒激活 + 你不可能同时编辑 20 种语言。这和 Chrome 的 tab 进程一样——你开 100 个 tab 确实会卡，但正常人活跃的就那几个。

---

## Q: LSP 的激活和销毁生命周期是怎样的？打开文件才激活？关闭就销毁？

分两层来看——**插件的激活**和 **LSP Server 进程的生命周期**是两件事：

### 插件激活 (Extension activation)

这是 VSCode 控制的，由 `activationEvents` 决定：

```json
// 典型 Python 插件的 package.json
{
  "activationEvents": [
    "onLanguage:python"    // ← 打开 .py 文件时激活
  ]
}
```

**触发条件是"打开了该语言的文件"，不是"工作区存在该文件"。**

```
工作区里有 100 个 .py 文件但你没打开任何一个 → 插件不激活 → Server 不启动
打开第一个 .py 文件 → 触发 onLanguage:python → 插件 activate() → 启动 LSP Server
```

### LSP Server 生命周期

```
[打开第一个 .py 文件]
    │
    ▼
插件 activate() → new LanguageClient(...) → client.start()
    │
    ▼
fork 子进程 → LSP Server 启动
    │
    ▼
Client → Server: initialize (握手)
Client → Server: textDocument/didOpen (第一个文件)
    │
    ▼
[持续运行...] ← 无论你打开/关闭多少个 .py 文件，Server 一直活着
    │
    ▼
[关闭所有 .py 文件] → 通常 Server 还是活着的（看插件实现）
    │
    ▼
[窗口关闭 / 插件停用] → Client → Server: shutdown → exit → 进程退出
```

### 关键答案

| 问题 | 答案 |
|------|------|
| 什么时候启动？ | **打开**对应语言的文件时（不是检测到存在） |
| 关闭文件会销毁吗？ | **通常不会**。关闭文件只是发 `didClose`，Server 进程继续跑 |
| 什么时候真正退出？ | 窗口关闭、插件禁用/卸载、或插件主动调 `client.stop()` |
| 重新打开文件呢？ | Server 还在就直接发 `didOpen`，不用重新启动 |

### 为什么关闭文件不销毁 Server？

因为 **重启 Server 代价很大**：
- TypeScript Server 启动要扫描整个项目建索引 (几秒~几十秒)
- Pylance 要分析依赖图
- 用户随时可能再打开同语言文件

所以实际策略是 **启动一次，保持到窗口关闭**。少数插件会做优化：空闲 N 分钟后自动停止，再需要时重启——但这是插件自己的逻辑，LSP 协议本身不强制。

### 完整时序图

```
用户行为                    插件/LSP 状态
──────────────────────────────────────────
打开 VSCode                 插件未激活，Server 未启动
打开 app.ts                 → TypeScript 插件激活 → tsserver 启动
打开 utils.ts               → didOpen (Server 已在跑，无需重启)
关闭 app.ts                 → didClose (Server 继续跑)
关闭 utils.ts               → didClose (Server 继续跑，0 个文件打开)
打开 main.py                → Python 插件激活 → pylsp 启动
关闭 main.py                → didClose (pylsp 继续跑)
...5 分钟啥都没干...          → Server 仍然在后台
关闭 VSCode 窗口            → shutdown + exit → 所有 Server 进程退出
```

---

## Q: VSCode 的 Electron 版本 (37) 落后最新 (42) 会少什么重大特性？

### 对 IDE 开发影响较大的

| 版本 | 特性 | 影响 |
|------|------|------|
| 38+ | Wayland 原生支持改进 | Linux 桌面迁移到 Wayland，37 的支持较弱 |
| 39+ | Node.js 24 (从 22 升级) | `require(ESM)` 原生支持、性能提升 |
| 40+ | `BrowserView` 正式废弃 → 应迁移到 `WebContentsView` | 未来升级被迫改 |
| 41 | ASAR Integrity digest | macOS 应用完整性校验 |
| 41 | MSIX auto-updater | Windows 新分发/更新机制 |
| 41 | Frameless window 在 Wayland 上有阴影和调整边界 | Linux UI 体验改善 |
| 42 | Chromium 148 | 大量新 CSS/DOM API |

### Chromium 层面 (134 → 148，跨 14 个版本)

| 特性 | Chrome 版本 | 说明 |
|------|------------|------|
| CSS `@starting-style` | 135+ | 入场动画更简洁 |
| CSS `anchor()` 定位 | 136+ | 弹出层定位方案革新 |
| `Popover` API 增强 | 137+ | 原生弹窗管理 |
| `scheduler.yield()` | 138+ | 长任务拆分，UI 不卡 |
| **安全补丁** | 134-148 | **14 个版本的 CVE 修复** |

### V8 引擎

| 特性 | 说明 |
|------|------|
| `Iterator.prototype` 新方法 | `.map()/.filter()/.reduce()` 等 |
| `Set` 新方法 | `.union()/.intersection()/.difference()` |
| `Promise.try()` | 同步异步统一错误处理 |
| WASM Trap Handler | 更好的 WASM 性能 |

### 结论

不影响核心功能使用，但**安全补丁**和 **Linux Wayland** 是两个需要关注的升级动力。如果用户主要在 Linux 上用 IDE，建议尽早升到 40+。
