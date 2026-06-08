# Extension Host（插件宿主进程）

> 解决什么问题：第三方插件代码不可控（可能有 bug、死循环、内存泄漏），不能让它们跑在 UI 进程里——否则一个插件挂了整个编辑器白屏。
>
> 本质：Extension Host = 一个独立的 Node.js 进程，所有插件在这里执行，通过 RPC 和 Renderer 通信。

---

## 目录

- [为什么需要 Extension Host](#为什么需要-extension-host)
- [运行机制](#运行机制)
- [插件加载流程](#插件加载流程)
- [API 暴露方式](#api-暴露方式)
- [隔离与安全](#隔离与安全)
- [崩溃恢复](#崩溃恢复)

---

## 为什么需要 Extension Host

```
如果插件跑在 Renderer 进程里：
  插件死循环 → Renderer 事件循环阻塞 → UI 卡死
  插件内存泄漏 → Renderer 内存爆 → 编辑器崩溃
  插件调用 Node API → Renderer 需要开启 nodeIntegration → 安全风险

Extension Host 的解法：
  插件跑在独立 Node.js 进程 → 崩溃/卡顿不影响 UI
  通过 RPC 通信 → 插件不能直接操作 DOM（只能通过 API）
  可以杀死重启 → 插件全部重新加载，用户只感觉"插件重启了"
```

---

## 运行机制

```
Renderer（UI）                Extension Host（插件进程）
    │                              │
    │  ← RPC 通道 →               │
    │                              │
    │  插件请求：                    │
    │  "给第 5 行加个红色波浪线"      │
    │  ←──────────────────────     │  diagnostics.set(...)
    │                              │
    │  UI 事件：                    │
    │  "用户输入了字符 a"            │
    │  ──────────────────────→     │  onDidChangeTextDocument
    │                              │
    │  插件响应：                    │
    │  "补全建议：['apple','app']"   │
    │  ←──────────────────────     │  provideCompletionItems
    │                              │

= Renderer 管 UI 渲染
= Extension Host 管逻辑计算
= 两者通过 RPC 协议通信（不共享内存）
```

---

## 插件加载流程

```
1. VS Code 启动 → 读取所有已安装插件的 package.json
2. 根据 activationEvents 决定"什么时候激活这个插件"
   - onLanguage:typescript → 打开 .ts 文件时激活
   - onCommand:myPlugin.run → 用户执行命令时激活
   - * → 启动时立即激活（不推荐）
3. 触发条件满足 → Extension Host 加载该插件的 JS 入口
4. 调用插件导出的 activate() 函数
5. 插件注册各种 Provider（补全/诊断/格式化/...）
6. 插件通过 vscode.* API 和编辑器交互
```

---

## API 暴露方式

```typescript
// 插件代码（跑在 Extension Host 中）
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // 注册一个命令
  const cmd = vscode.commands.registerCommand('myPlugin.hello', () => {
    vscode.window.showInformationMessage('Hello!');
  });

  // 注册补全 Provider
  const provider = vscode.languages.registerCompletionItemProvider('typescript', {
    provideCompletionItems(document, position) {
      return [new vscode.CompletionItem('hello')];
    }
  });

  context.subscriptions.push(cmd, provider);
}

// vscode.* API 的本质：
// 不是直接操作 DOM（Extension Host 没有 DOM）
// 而是通过 RPC 发消息给 Renderer，Renderer 执行 UI 操作
// vscode.window.showInformationMessage('Hello')
//   → RPC → Renderer 显示通知
```

---

## 隔离与安全

```
Extension Host 的隔离程度：

  ✅ 进程隔离：插件不能直接操作 Renderer DOM
  ✅ 崩溃隔离：插件崩溃 → Extension Host 重启 → UI 不受影响
  ✅ API 约束：插件只能通过 vscode.* API 操作编辑器（白名单）
  
  ❌ 插件之间不隔离：所有插件跑在同一个 Extension Host 进程
     一个插件死循环 → 所有插件都卡
     解法：VS Code 检测 Extension Host 无响应 → 提示用户重启

  ❌ 插件有完整 Node.js 权限：
     可以读写文件、发网络请求、执行子进程
     安全全靠"插件市场审核" + 用户信任
     （和 npm 包一样——安装即信任）
```

---

## 崩溃恢复

```
Extension Host 崩溃时：
  1. Main Process 检测到 Extension Host 进程退出
  2. Renderer UI 弹出提示："Extension Host 已终止，是否重启？"
  3. 用户点击重启 → 重新 fork Extension Host 进程
  4. 重新加载所有插件（activate 重新调用）
  5. 编辑器 UI 全程正常（文件内容不丢、编辑状态不丢）

= 插件崩溃的最坏情况 = "插件功能暂时不可用"
≠ "编辑器崩溃/数据丢失"
```
