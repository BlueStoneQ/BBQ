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

## 底层基础：TCP 连接与 SSE

### TCP 连接本质

TCP 是全双工的。**"连接"不是知道对方地址就行**，而是三次握手后双方内核各分配了 socket（缓冲区 + 会话状态）：

```
"连接" = 双方内核里各有一个 socket 对象
         记录：对方 IP:端口 + 序列号 + 发送/接收缓冲区
         没有连接时，对方收到数据包直接丢弃（RST）
```

**关闭的本质** = 通知对方"我不再发了"（FIN 包），四次挥手后双方释放 socket 资源。不通知就一直连着——这就是 Keep-Alive 长连接的原理。

**SSE 流式用到的就是这个**：HTTP 请求建立 TCP 连接后，服务端不发 FIN，连接一直在，持续往里写数据。

### SSE 在 HTTP 层的体现

```
普通 HTTP：
  客户端发请求 → 服务端处理完 → res.end() 一次性返回 → TCP 关闭

SSE 流式：
  客户端发请求 → 服务端设置 Content-Type: text/event-stream
             → res.write() 写一块（TCP 不关）
             → res.write() 又写一块（TCP 不关）
             → ...
             → res.end()（TCP 关闭）
```

**HTTP Header 的含义就清晰了**：
- `Content-Type: text/event-stream` — 告诉客户端"这是流，不要等全部收完再处理"
- `Transfer-Encoding: chunked` — "我不知道总长度，一块一块发"（不写 Content-Length）
- `Connection: keep-alive` — "别关 TCP"
- `Cache-Control: no-cache` — "别缓存，每个 chunk 都是实时的"

### 推送粒度

每个 SSE 事件通常包含 1-5 个 token（1-3 个字）：

```
data: {"choices":[{"delta":{"content":"你"}}]}\n\n
data: {"choices":[{"delta":{"content":"好"}}]}\n\n
data: {"choices":[{"delta":{"content":"，我是"}}]}\n\n
```

不是严格一字一推——取决于 LLM 生成速度和网络 TCP 包的合并。用户感知上就是逐字出现。

### 和 WebSocket 的区别

- **SSE**：单向（服务端→客户端），基于 HTTP，简单。LLM 场景够用
- **WebSocket**：双向，独立协议，需要额外握手。聊天室/游戏需要

---

## 一次流式 Chat 的完整链路（第一性原理）

**本质**：一次 HTTP 请求，服务端不关连接，LLM 每生成一个 token 就往 TCP 管道里写一次，前端每收到一块就渲染一次。

```
┌─ 前端（浏览器/CLI）─────────────────────────────────────────────────┐
│                                                                     │
│  1. 用户输入 "帮我改这个函数"                                        │
│  2. fetch POST /api/chat { messages: [...] }                        │
│  3. 拿到 response（但数据还没全到！）                                 │
│     → res.body 是 ReadableStream                                    │
│  4. reader = res.body.getReader()                                   │
│  5. while 循环：                                                     │
│     → { done, value } = await reader.read()                         │
│     → TextDecoder 解码 Uint8Array → 字符串                           │
│     → 解析 "data: {...}\n\n" 格式                                    │
│     → 提取 delta.content（一个 token）                               │
│     → 追加到页面 DOM（用户看到逐字出现）                              │
│  6. done === true → 流结束 → TCP 关闭                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
          │                    ↑
          │ HTTP POST          │ SSE 流（data: ...\n\n）
          ↓                    │
┌─ 后端（Node.js 中间层）─────────────────────────────────────────────┐
│                                                                     │
│  1. 收到请求，解析 messages                                          │
│  2. 设置响应头：                                                     │
│     Content-Type: text/event-stream                                 │
│     Cache-Control: no-cache                                         │
│     Connection: keep-alive                                          │
│  3. 调 LLM API（也是 SSE 流）：                                      │
│     fetch('https://api.openai.com/v1/chat/completions',             │
│       { body: { messages, stream: true } })                         │
│  4. 逐块转发：                                                       │
│     LLM 每返回一个 chunk → res.write(chunk) 转发给前端               │
│     （不 res.end()，TCP 保持连接）                                    │
│  5. LLM 返回 [DONE] → res.write('data: [DONE]\n\n') → res.end()    │
│     → TCP 关闭                                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
          │                    ↑
          │ HTTP POST          │ SSE 流
          ↓                    │
┌─ LLM API（OpenAI/Claude）───────────────────────────────────────────┐
│                                                                     │
│  1. 收到 messages + tools + stream:true                             │
│  2. 模型逐 token 生成：                                              │
│     生成 "你" → 写入响应流                                           │
│     生成 "好" → 写入响应流                                           │
│     生成 "，" → 写入响应流                                           │
│     ...                                                             │
│  3. 生成完毕 → 发 finish_reason: "stop" → 关闭                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**整条链路就是两段 SSE 流的接力**：
```
LLM → (SSE) → 后端 → (SSE 转发) → 前端
```

后端在流式传输层面是"SSE 代理"，但**除了 LLM 生成 token 之外的所有工作都在业务后端**：

| 职责 | 说明 |
|------|------|
| **API Key 保护** | 不暴露给前端（最基本的理由） |
| **鉴权/限流** | 验证用户身份、控制调用频次 |
| **messages 组装** | 加 system prompt、拼接历史消息、注入 RAG 检索结果 |
| **上下文管理** | 5 层管道压缩（Mako 的核心逻辑都在这里） |
| **工具执行** | Agent 的 Tool Use 执行（读文件/写文件/跑命令） |
| **计费** | 记录每次调用的 token 数 |
| **内容审核** | 过滤敏感输入/输出 |
| **多模型路由** | 根据用户等级或任务类型选不同模型 |
| **降级/重试** | LLM API 超时时自动切备用模型 |

**本质分工**：LLM 只做一件事——输入 tokens 输出 tokens。其他一切（鉴权、组装、工具执行、上下文管理、安全确认）都是业务后端/Agent 框架的职责。

**如果是 Mako CLI（无后端）**：
```
LLM → (SSE) → Mako CLI（Node.js 直接调 LLM API）→ 终端逐字输出
```
CLI 场景不需要后端中间层，因为 API Key 就在本地环境变量里。

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
