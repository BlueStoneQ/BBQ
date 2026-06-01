# 04 — 流式传输

> 源码：`packages/core/src/agent.ts` 的 `chatStream()` 方法

---

## 目录

- [一句话](#一句话)
- [全链路](#全链路)
- [三层流式](#三层流式)
- [AsyncGenerator 双向通信](#asyncgenerator-双向通信)
- [AgentEvent 类型](#agentevent-类型)
- [面试话术](#面试话术)

---

## 一句话

流式传输 = LLM 逐 token 输出 + Agent 逐事件推送给 UI。用 AsyncGenerator 实现双向通信（推事件 + 接收确认）。

---

## 全链路

```
LLM API（SSE 流）
  → LLM Adapter（stream 方法，AsyncIterable<LLMStreamChunk>）
  → Agent chatStream（AsyncGenerator<AgentEvent>）
  → CLI / Web（消费 AgentEvent，逐字显示）
```

---

## 三层流式

### 第 1 层：LLM API → LLM Adapter

```typescript
// LLMAdapter 接口
interface LLMAdapter {
  chat(messages, options): Promise<LLMResponse>;       // 非流式
  stream(messages, options): AsyncIterable<LLMStreamChunk>; // 流式
}

// OpenAI Adapter 实现
async *stream(messages, options): AsyncIterable<LLMStreamChunk> {
  const response = await this.client.chat.completions.create({
    messages, tools, stream: true  // 开启流式
  });

  for await (const chunk of response) {
    // OpenAI 返回的每个 chunk 包含 delta
    if (chunk.choices[0].delta.content) {
      yield { type: 'text_delta', content: chunk.choices[0].delta.content };
    }
    if (chunk.choices[0].delta.tool_calls) {
      yield { type: 'tool_call_delta', ... };
    }
    if (chunk.choices[0].finish_reason) {
      yield { type: 'done' };
    }
  }
}
```

### 第 2 层：LLM Adapter → Agent chatStream

```typescript
async *chatStream(userMessage): AsyncGenerator<AgentEvent, void, AgentStreamInput> {
  // 消费 LLM 流，转换为 AgentEvent
  for await (const chunk of this.llm.stream(messages, { tools })) {
    if (chunk.type === 'text_delta') {
      yield { type: 'text_delta', content: chunk.content }; // 推给 CLI
    }
  }

  // 工具调用时推送事件
  yield { type: 'tool_start', name: 'read_file', arguments: {...} };
  // 危险工具暂停等确认
  const confirmed = yield { type: 'tool_confirm', name: 'bash', arguments: {...} };
  // 工具执行完推送结果
  yield { type: 'tool_end', name: 'read_file', result: '...' };
}
```

### 第 3 层：Agent → CLI/Web

```typescript
// CLI 消费 AgentEvent
const generator = agent.chatStream(userMessage);
let result = await generator.next();

while (!result.done) {
  const event = result.value;

  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.content); // 逐字输出
      result = await generator.next();
      break;

    case 'tool_confirm':
      const answer = await askUser(`执行 ${event.name}? (y/n/a)`);
      result = await generator.next(answer === 'y' || answer === 'a');
      // ↑ 通过 next() 传回确认结果（双向通信）
      break;

    case 'tool_start':
      showSpinner(`执行 ${event.name}...`);
      result = await generator.next();
      break;

    case 'tool_end':
      stopSpinner();
      result = await generator.next();
      break;

    case 'done':
      break;
  }
}
```

---

## AsyncGenerator 双向通信

**为什么用 AsyncGenerator？**

| 方案 | 推送事件 | 接收输入 | 暂停/恢复 | 背压 |
|------|---------|---------|----------|------|
| EventEmitter | ✅ emit | ❌ 需要额外机制 | ❌ | ❌ |
| Callback | ✅ 调回调 | ❌ | ❌ | ❌ |
| Stream | ✅ push | ❌ | ✅ | ✅ |
| **AsyncGenerator** | ✅ yield | ✅ next(value) | ✅ yield 就是暂停 | ✅ 天然 |

**核心优势**：
1. `yield event` = 推送事件给外部
2. `const input = yield event` = 暂停 + 等待外部传值
3. 代码是线性的（不是回调嵌套）
4. 天然背压（消费者不 next()，生产者就暂停）

---

## AgentEvent 类型

```typescript
type AgentEvent =
  | { type: 'text_delta'; content: string }      // LLM 输出的一小块文本
  | { type: 'tool_start'; name: string; arguments: any }  // 开始执行工具
  | { type: 'tool_confirm'; name: string; arguments: any } // 危险工具等确认
  | { type: 'tool_end'; name: string; result: string; error?: boolean } // 工具执行完
  | { type: 'done'; content: string; iterations: number }  // 任务完成
  | { type: 'error'; message: string }           // 错误

type AgentStreamInput = boolean | undefined; // 确认结果：true=执行，false=跳过
```

---

## 面试话术

> "Mako 的流式传输分三层：LLM API 返回 SSE 流 → LLM Adapter 转为 AsyncIterable → Agent chatStream 用 AsyncGenerator 推送 AgentEvent 给 CLI/Web。选 AsyncGenerator 是因为它天然支持双向通信——yield 推事件，next(value) 接收用户确认。危险工具执行前 yield 一个 tool_confirm 事件暂停，CLI 问用户 y/n，通过 next(true/false) 传回结果。代码是线性的，不需要回调嵌套。"
