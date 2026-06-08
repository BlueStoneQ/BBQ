# LSP（Language Server Protocol）

> 解决什么问题：每种编程语言需要"语法分析/补全/跳转/诊断"能力，如果每个编辑器各自实现 = M 个编辑器 × N 种语言 = M×N 个实现。LSP 让语言能力和编辑器解耦——语言服务写一次，所有编辑器都能用。
>
> 本质：LSP = 编辑器和语言服务之间的标准通信协议（JSON-RPC）。语言服务跑在独立进程，编辑器通过协议调用。

---

## 目录

- [为什么需要 LSP](#为什么需要-lsp)
- [架构](#架构)
- [通信协议](#通信协议)
- [为什么不跑在 Extension Host 里](#为什么不跑在-extension-host-里)

---

## 为什么需要 LSP

```
没有 LSP：
  VS Code 要支持 TypeScript → 自己实现 TS 语法分析
  Vim 要支持 TypeScript → 自己再实现一遍
  = 每个编辑器重复造轮子

有 LSP：
  TypeScript 团队写一个 Language Server（tsserver）
  所有编辑器（VS Code / Vim / Emacs / Sublime）通过 LSP 协议调用它
  = 语言能力写一次，N 个编辑器复用
```

---

## 架构

```
┌──────────────┐         LSP 协议          ┌──────────────────┐
│  编辑器       │ ◄──── JSON-RPC ────────► │  Language Server  │
│ （VS Code）  │    （stdin/stdout）        │  （独立进程）      │
│              │                           │                  │
│  发送：       │                           │  处理：           │
│  - 打开文件   │                           │  - 解析 AST      │
│  - 输入字符   │                           │  - 计算补全      │
│  - 请求补全   │                           │  - 检查类型错误   │
│  - 请求跳转   │                           │  - 查找引用      │
└──────────────┘                           └──────────────────┘

通信方式：
  通常通过 stdin/stdout（子进程管道）
  也可以通过 socket（远程 Language Server）

Language Server 可以用任何语言写：
  TypeScript → tsserver（Node.js）
  Rust → rust-analyzer（Rust 二进制）
  Python → pylsp（Python）
  Go → gopls（Go 二进制）
```

---

## 通信协议

```json
// 编辑器 → Language Server：请求补全
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "textDocument/completion",
  "params": {
    "textDocument": { "uri": "file:///src/app.ts" },
    "position": { "line": 10, "character": 5 }
  }
}

// Language Server → 编辑器：返回补全项
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "items": [
      { "label": "console", "kind": 6 },
      { "label": "constructor", "kind": 4 }
    ]
  }
}

// Language Server → 编辑器：推送诊断（不是请求，是通知）
{
  "jsonrpc": "2.0",
  "method": "textDocument/publishDiagnostics",
  "params": {
    "uri": "file:///src/app.ts",
    "diagnostics": [
      { "range": {...}, "message": "Type error", "severity": 1 }
    ]
  }
}
```

---

## 为什么不跑在 Extension Host 里

```
问题：Language Server 做语法分析可能很慢（大项目 TypeScript 分析 5-10s）

如果跑在 Extension Host：
  TypeScript 分析卡住 → Extension Host 事件循环阻塞
  → 所有其他插件也卡住（补全/格式化/其他语言全停）
  
跑在独立进程：
  TypeScript 分析卡住 → 只影响 TS 语言功能
  → 其他插件正常、其他语言正常、UI 正常

= 和 Extension Host 隔离插件的思路一样：
  "可能卡住的东西" → 独立进程
  "可能崩溃的东西" → 独立进程
```
