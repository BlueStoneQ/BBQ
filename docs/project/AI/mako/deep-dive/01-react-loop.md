# 01 — ReAct 循环

> 源码：`packages/core/src/agent.ts`

---

## 目录

- [一句话](#一句话)
- [源码核心（chat 方法）](#源码核心chat-方法)
- [关键设计决策](#关键设计决策)
- [流式版本（chatStream）的额外设计](#流式版本chatstream的额外设计)
- [面试话术](#面试话术)

---

## 一句话

ReAct 循环 = while 循环 + LLM 调用 + 分支判断（text → 结束 / tool_calls → 执行工具继续循环）

---

## 源码核心（chat 方法）

```typescript
async chat(userMessage: string): Promise<AgentResponse> {
  this.context.addMessage({ role: 'user', content: userMessage });
  let iterations = 0;

  while (iterations < this.maxIterations) {
    iterations++;

    // 1. 每轮开头检查上下文是否需要压缩
    await this.context.compressIfNeeded();

    // 2. 组装 messages（system + history）
    const messages = this.context.assemble();

    // 3. 获取可用工具列表（JSON Schema 格式）
    const tools = this.toolRegistry.listForLLM();

    // 4. 发给 LLM
    const response = await this.llm.chat(messages, { tools });

    // 5. 判断返回类型
    if (response.type === 'text') {
      // LLM 认为任务完成 → 返回结果
      this.context.addMessage({ role: 'assistant', content: response.content });
      return { content: response.content, iterations };
    }

    if (response.type === 'tool_calls') {
      // LLM 要调工具 → 执行 → 结果加入上下文 → 继续循环
      this.context.addMessage({ role: 'assistant', content: null, toolCalls: response.toolCalls });

      for (const toolCall of response.toolCalls) {
        const result = await this.toolRegistry.execute(toolCall);
        this.context.addMessage({ role: 'tool', content: result, toolCallId: toolCall.id });
      }
    }
  }

  throw new Error(`Agent exceeded maximum iterations (${this.maxIterations})`);
}
```

---

## 关键设计决策

| 决策 | 为什么 |
|------|--------|
| `compressIfNeeded()` 在循环开头 | 每轮检查，不等爆了才处理 |
| `maxIterations` 兜底 | 防止 LLM 死循环（幻觉导致无限调工具） |
| 工具结果直接 `addMessage` | LLM 下一轮能看到结果，决定下一步 |
| `response.type` 分支 | 不是解析 JSON，是 LLM API 原生返回的 finish_reason |

---

## 流式版本（chatStream）的额外设计

```typescript
async *chatStream(userMessage: string): AsyncGenerator<AgentEvent, void, AgentStreamInput> {
  // ...同样的 while 循环，但：
  // 1. 用 yield 逐步推送事件给调用方（CLI/Web）
  // 2. 危险工具用 yield { type: 'tool_confirm' } 暂停，等用户确认
  // 3. 用户通过 generator.next(true/false) 传回确认结果（双向通信）
}
```

**AsyncGenerator 双向通信**：
- `yield event` → 推送事件给外部（CLI 显示）
- `const input = yield event` → 暂停等待外部传值（用户确认 y/n）
- 外部调 `generator.next(true)` 传回确认

**为什么用 AsyncGenerator 而不是 EventEmitter**：
- Generator 天然支持暂停/恢复（yield 就是暂停点）
- 双向通信不需要额外的回调注册
- 流程控制更清晰（代码是线性的，不是回调嵌套）

---

## 面试话术

> "ReAct 在 Mako 里就是 agent.ts 的 chat 方法——一个 while 循环。每轮：先检查上下文是否需要压缩，然后组装 messages 发给 LLM，看返回类型：text 就结束，tool_calls 就执行工具、把结果加入上下文、继续循环。maxIterations 防死循环。流式版本用 AsyncGenerator 实现双向通信——yield 推事件给 CLI，yield 还能接收用户的确认输入。"
