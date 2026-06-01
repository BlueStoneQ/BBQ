# Mako 项目拆解 — 面试深度理解

> 紧紧围绕源码理解本质，万变不离其宗。
> 总入口：[mako-project-deep-dive.md](../mako-project-deep-dive.md)

---

## 子主题

| # | 主题 | 文件 | 对应源码 |
|---|------|------|---------|
| 1 | [ReAct 循环](./01-react-loop.md) | Agent 核心循环 | `packages/core/src/agent.ts` |
| 2 | [5 层上下文管道](./02-context-pipeline.md) | 上下文管理 | `packages/core/src/context/` |
| 3 | [工具系统 & MCP](./03-tool-system.md) | Tool Use + MCP | `packages/tools/` + `packages/mcp/` |
| 4 | [流式传输](./04-streaming.md) | SSE + AsyncGenerator | `agent.ts chatStream()` |
| 5 | [LLM 适配层](./05-llm-adapter.md) | 多模型支持 | `packages/core/src/llm/` |
| 6 | [架构设计决策](./06-design-decisions.md) | 为什么这样设计 | — |
| 7 | [提示词工程与模板设计](./07-prompt-engineering.md) | System Prompt + Steering + Skills | `packages/cli/src/system-prompt.ts` + `steering.ts` + `spec-prompts.ts` |

---

## 第一性原理

```
Agent = while(true) { LLM决策 + 工具执行 + 上下文管理 }
```

三个核心问题：
1. **循环怎么转**：ReAct — LLM 返回 tool_calls 就继续，返回 text 就停
2. **信息怎么管**：5 层管道 — 截断/去重/微压缩/AI摘要/归档检索
3. **能力怎么扩**：Tool Use + MCP — JSON Schema 定义工具，LLM 自动发现和调用
