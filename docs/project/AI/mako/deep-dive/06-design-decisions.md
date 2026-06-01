# 06 — 架构设计决策

> 为什么这样设计？每个决策的 why。

---

## 目录

- [一句话](#一句话)
- [核心决策一览](#核心决策一览)
- [为什么不用 LangChain？](#为什么不用-langchain)
- [为什么用 AsyncGenerator 而不是 EventEmitter？](#为什么用-asyncgenerator-而不是-eventemitter)
- [为什么 5 层而不是 1 层？](#为什么-5-层而不是-1-层)
- [为什么 Monorepo 分 4 个包？](#为什么-monorepo-分-4-个包)
- [为什么用 MCP 而不是硬编码工具？](#为什么用-mcp-而不是硬编码工具)
- [依赖选型原则](#依赖选型原则)
- [面试话术（30 秒版）](#面试话术30-秒版)

---

## 一句话

Mako 的设计哲学：**自实现核心逻辑 + 用库不用框架 + 极致轻量 + 完全可解释。**

---

## 核心决策一览

| 决策 | 选择 | 为什么 |
|------|------|--------|
| Agent 框架 | 不用 LangChain，自实现 | 循环本身 30 行代码，框架解决不了真正的难点（上下文管理） |
| 架构模式 | 微内核 + 插件 | 核心只做调度，能力通过插件注入，可扩展 |
| 流式通信 | AsyncGenerator | 双向通信 + 暂停/恢复 + 背压，代码线性 |
| 上下文管理 | 5 层管道 | 渐进式，每层职责单一，大部分情况前 3 层零成本解决 |
| 工具扩展 | MCP 协议 | 标准协议，动态发现，不需要硬编码工具 |
| 多模型 | Adapter 模式 | 接口统一，运行时可切换 |
| 依赖策略 | 核心 3 个依赖 | 少依赖 = 少 breaking change + 少安全漏洞 |
| 包管理 | pnpm monorepo | core/tools/mcp/cli 分包，职责清晰 |

---

## 为什么不用 LangChain？

**事实**：Claude Code、Cursor、Aider、OpenHands 全部自实现，无一用框架。

**三层理由**：

1. **循环本身不复杂**：ReAct 循环去掉注释不到 30 行，不需要框架帮你写
2. **真正的难点框架解决不了**：5 层上下文管道、安全确认、流式双向通信——都是业务强相关
3. **调试体验**：自实现出错直接定位源码；用框架出错要穿透 5-6 层 wrapper

**话术**：
> "Agent 循环本身就是一个 while 循环 + 分支判断，30 行代码。真正的难点是上下文精细管理、安全确认机制、流式双向通信——这些通用框架帮不了，因为它们是业务强相关的。所有工业级 Coding Agent（Claude Code、Cursor、Aider）都是自实现，没有一个用 LangChain。"

---

## 为什么用 AsyncGenerator 而不是 EventEmitter？

| 维度 | AsyncGenerator | EventEmitter |
|------|---------------|-------------|
| 双向通信 | ✅ yield + next(value) | ❌ 需要额外事件 |
| 暂停/恢复 | ✅ yield 就是暂停点 | ❌ 需要手动实现 |
| 背压 | ✅ 消费者不 next 就暂停 | ❌ 生产者不管消费者 |
| 代码风格 | 线性（像同步代码） | 回调嵌套 |
| 错误处理 | try/catch | error 事件 |

**核心**：危险工具确认需要"暂停等待用户输入"，AsyncGenerator 的 yield 天然就是暂停点。EventEmitter 做不到。

---

## 为什么 5 层而不是 1 层？

**如果只有 1 层（直接截断）**：
- 简单但粗暴，信息丢失严重
- 没有渐进式降级

**5 层的好处**：
- L1-L3 零成本（规则式），覆盖 80% 场景
- L4 有成本但信息保留率高（结构化摘要）
- L5 是最后兜底（落盘 + 可检索恢复）
- 每层可独立开关、独立测试
- 渐进式 = 能用最小代价解决问题

---

## 为什么 Monorepo 分 4 个包？

```
packages/
├── core   — Agent 引擎（不依赖 Node.js 特有 API，理论上可跑浏览器）
├── tools  — 内置工具（依赖 fs/child_process，Node.js only）
├── mcp    — MCP 协议（依赖 stdio 子进程，Node.js only）
└── cli    — 终端交互（依赖 readline/chalk，Node.js only）
```

**好处**：
1. core 可以被 Web 端复用（不绑定 Node.js）
2. 职责清晰，依赖方向单向（cli → core/tools/mcp → core）
3. 可以独立发布、独立版本
4. 测试隔离

---

## 为什么用 MCP 而不是硬编码工具？

**硬编码**：每加一个外部工具要改代码、重新发布
**MCP**：配置文件加一行，重启就能用新工具

```json
// .mako/config.json
{
  "mcpServers": {
    "feishu": { "command": "uvx", "args": ["feishu-mcp-server"] },
    "gerrit": { "command": "uvx", "args": ["gerrit-mcp-server"] }
  }
}
```

**本质**：MCP 把"工具能力"从编译时绑定变成运行时发现。Agent 不需要知道有哪些工具，启动时自动发现。

---

## 依赖选型原则

```
判断标准：这个东西是"核心业务逻辑"还是"基础设施"？

核心业务 → 自己实现（Agent 循环、上下文管道、安全确认）
协议层   → 用官方 SDK（openai、MCP SDK）
算法层   → 用成熟库（gpt-tokenizer、minisearch）
工具层   → 用轻量库（chalk、ora、fast-glob）
```

**核心 3 个生产依赖**：
- `openai` — LLM 通信（官方 SDK）
- `gpt-tokenizer` — 本地 token 计数（BPE 算法）
- `minisearch` — BM25 检索（L5 兜底层）

---

## 面试话术（30 秒版）

> "Mako 的设计哲学是'自实现核心 + 用库不用框架'。核心循环 30 行代码不需要框架；真正的难点（上下文管道、安全确认、流式双向通信）框架帮不了。依赖极致轻量——核心只有 3 个生产依赖。架构是微内核 + 插件——core 只做调度，工具/MCP/CLI 都是可插拔的包。每个设计决策都能讲清楚为什么。"
