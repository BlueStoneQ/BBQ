# 07 - Language Server Protocol (LSP)

> 核心问题: LSP 如何统一了语言智能？为什么选择 C/S 架构？

## 目录

- [第一性原理](#第一性原理)
- [协议本质](#协议本质)
- [核心能力矩阵](#核心能力矩阵)
- [VSCode 中的实现](#vscode-中的实现)
  - [客户端侧](#客户端侧)
  - [通信链路](#通信链路)
- [LSP 生命周期](#lsp-生命周期)
  - [初始化握手](#初始化握手)
  - [文档同步](#文档同步)
- [DAP: Debug Adapter Protocol](#dap-debug-adapter-protocol)
- [LSP 的局限性](#lsp-的局限性)
- [Tree-sitter: 新趋势](#tree-sitter-新趋势)
- [小结](#小结)

---

## 第一性原理

**M×N 问题**：
- M 个 IDE (VSCode, Vim, Emacs, Sublime...)
- N 种语言 (TypeScript, Python, Go, Rust...)
- 传统方案: 每个 IDE 为每种语言写一套 → M×N 个实现

**LSP 的答案**：
- 定义统一协议 → 每种语言只写一个 Server
- 每个 IDE 只实现一个 Client
- 复杂度从 M×N → M+N

```
Before LSP:                      After LSP:
IDE₁ ─── Lang₁                  IDE₁ ──┐
IDE₁ ─── Lang₂                  IDE₂ ──┤── LSP Protocol ──┬── LangServer₁
IDE₂ ─── Lang₁                  IDE₃ ──┘                  ├── LangServer₂
IDE₂ ─── Lang₂                                            └── LangServer₃
IDE₃ ─── Lang₁
IDE₃ ─── Lang₂
= 9 implementations             = 3 + 3 implementations
```

## 协议本质

LSP 本质是一个 **JSON-RPC 2.0** 协议，定义了：
- 客户端 → 服务器的请求 (如 `textDocument/completion`)
- 服务器 → 客户端的请求 (如 `window/showMessage`)
- 双向通知 (如 `textDocument/didChange`)

### 传输层

```
stdio (默认): Client spawn Server 进程，通过 stdin/stdout 通信
socket: TCP 连接
pipe: Named Pipe / Unix Domain Socket
```

### 消息格式

```
Content-Length: 52\r\n
\r\n
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

## 核心能力矩阵

| 能力 | 方法名 | 说明 |
|------|--------|------|
| 自动补全 | `textDocument/completion` | 触发补全列表 |
| 悬停 | `textDocument/hover` | 显示类型信息 |
| 跳转定义 | `textDocument/definition` | Go to Definition |
| 查找引用 | `textDocument/references` | Find All References |
| 重命名 | `textDocument/rename` | 跨文件重命名 |
| 代码格式化 | `textDocument/formatting` | Format Document |
| 诊断 | `textDocument/publishDiagnostics` | 错误/警告 |
| 签名帮助 | `textDocument/signatureHelp` | 参数提示 |
| 代码动作 | `textDocument/codeAction` | Quick Fix / Refactor |
| 符号 | `textDocument/documentSymbol` | 大纲视图 |
| 语义高亮 | `textDocument/semanticTokens` | 精确着色 |

## VSCode 中的实现

### 客户端侧

```
vs/workbench/api/common/extHostLanguageFeatures.ts  ← Extension Host 侧 API
vs/editor/common/languages/                         ← 语言服务接口
```

插件通过 `vscode.languages.*` API 注册语言功能：

```typescript
// 插件代码 (运行在 Extension Host)
vscode.languages.registerCompletionItemProvider('python', {
  provideCompletionItems(document, position) {
    // 直接实现 (内置式)
    return [new vscode.CompletionItem('print')];
  }
});
```

或使用 Language Client 库连接外部 LSP Server：

```typescript
// 使用 vscode-languageclient 库
import { LanguageClient } from 'vscode-languageclient/node';

const client = new LanguageClient(
  'pythonLSP',
  'Python Language Server',
  { command: 'pylsp' },              // 启动 LSP Server
  { documentSelector: ['python'] }   // 关注 Python 文件
);

client.start();
```

### 通信链路

```
[编辑器输入]
    │
    ▼
[Monaco Editor] → 触发补全
    │
    ▼
[Language Feature Registry] → 找到注册的 Provider
    │
    ▼
[RPC] → 跨进程调到 Extension Host
    │
    ▼
[Extension Host] → 调用插件的 provideCompletionItems
    │
    ▼
[Language Client] → JSON-RPC 发给外部 LSP Server
    │
    ▼
[LSP Server (Python/Go/Rust)] → 分析代码，返回结果
    │
    ▼ (原路返回)
[Monaco Editor] → 显示补全列表
```

## LSP 生命周期

### 初始化握手

```
Client → Server: initialize
  params: {
    capabilities: { ... },     // 客户端支持哪些功能
    rootUri: "file:///project", // 工作区路径
    workspaceFolders: [...]
  }

Server → Client: initialize response
  result: {
    capabilities: {
      completionProvider: { triggerCharacters: ['.'] },
      hoverProvider: true,
      definitionProvider: true,
      ...
    }
  }

Client → Server: initialized (通知)
```

### 文档同步

```
打开文件:    textDocument/didOpen   → Server 获取文件全文
编辑文件:    textDocument/didChange → 增量更新 (只发差异)
保存文件:    textDocument/didSave   → 触发诊断
关闭文件:    textDocument/didClose  → Server 释放资源
```

增量同步 vs 全量同步：
```json
// 增量同步 (推荐，性能好)
{
  "contentChanges": [{
    "range": {"start": {"line": 5, "character": 0}, "end": {"line": 5, "character": 4}},
    "text": "hello"
  }]
}

// 全量同步 (简单但浪费)
{
  "contentChanges": [{
    "text": "整个文件内容..."
  }]
}
```

## DAP: Debug Adapter Protocol

同样的哲学，应用于调试领域：

```
IDE ←→ DAP ←→ Debug Adapter ←→ Runtime/Debugger

VSCode ←→ DAP ←→ node-debug ←→ Node.js
VSCode ←→ DAP ←→ debugpy ←→ Python
VSCode ←→ DAP ←→ codelldb ←→ LLDB → C/C++
```

核心请求：
- `launch` / `attach` — 启动/附加调试
- `setBreakpoints` — 设置断点
- `continue` / `next` / `stepIn` — 执行控制
- `stackTrace` — 获取调用栈
- `variables` — 获取变量值
- `evaluate` — 表达式求值

## 在 VSCode 源码中的位置

```
vs/workbench/contrib/debug/           ← 调试功能 UI + 逻辑
vs/workbench/contrib/debug/common/
  ├── debug.ts                        ← 核心接口
  ├── debugProtocol.ts                ← DAP 协议定义
  └── abstractDebugAdapter.ts         ← Debug Adapter 抽象
```

## LSP 的局限性

| 局限 | 说明 | 解决方案 |
|------|------|---------|
| 启动慢 | Server 需要分析整个项目 | 渐进式加载、索引缓存 |
| 内存高 | Server 维护 AST/类型信息 | 按需加载、释放策略 |
| 通信开销 | 每次补全都要跨进程 | 缓存、取消机制 |
| 功能有限 | 协议定义的能力有边界 | 自定义请求扩展 |
| 不支持多工作区 | 一个 Server 对应一个工作区 | 多实例模式 |

## Tree-sitter: 新趋势

VSCode 正在探索 Tree-sitter 作为补充：

```
源码: vs/workbench/services/treeSitter/
依赖: @vscode/tree-sitter-wasm
```

Tree-sitter 的优势：
- 增量解析 — 编辑后只重解析变化部分
- 生成完整 AST — 比正则 Token 化更结构化
- 错误恢复 — 语法错误不影响其他部分的解析

## 小结

| 设计决策 | 第一性原理 |
|---------|-----------|
| C/S 分离 | 语言智能和编辑器解耦 — 复用最大化 |
| JSON-RPC | 协议简单 — 任何语言都能实现 Server |
| stdio 传输 | 跨平台 — 不依赖特定 IPC 机制 |
| 能力协商 | 渐进式 — Server 不必实现所有功能 |
| 增量同步 | 性能 — 大文件只传差异 |
| DAP 同理 | 同一哲学 — M+N 解决 M×N |
