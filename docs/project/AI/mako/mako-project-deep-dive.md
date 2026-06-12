# Mako Project Deep Dive — Agent Engineer Prep

## 目录

- [一句话本质](#一句话本质)
- [第一性原理：AI Agent 到底在做什么？](#第一性原理ai-agent-到底在做什么)
- [核心架构：四层分离](#核心架构四层分离)
- [核心机制 1：ReAct 循环](#核心机制-1react-循环)
- [核心机制 2：5 层上下文管道（ContextPipeline）](#核心机制-25-层上下文管道contextpipeline)
- [核心机制 3：工具系统（Tool Use）](#核心机制-3工具系统tool-use)
- [核心机制 4：Steering + Skills](#核心机制-4steering--skills)
- [核心机制 5：流式传输（Streaming）](#核心机制-5流式传输streaming)
- [设计决策：为什么不用 LangChain / LangGraph？](#设计决策为什么不用-langchain--langgraph)
- [工程实践](#工程实践)
- [可观测性（Trace）](#可观测性trace)
- [Harness：AI Agent 的运行时容器](#harnessai-agent-的运行时容器)
- [Q&A 高频问题预判](#qa-高频问题预判)
- [一句话总结各模块](#一句话总结各模块)
- [讲述模板（30 秒版）](#讲述模板30-秒版)
- [讲述模板（2 分钟版）](#讲述模板2-分钟版)

---

## 一句话本质

**Mako 是一个从零实现的 AI Coding Agent 框架，核心是一个 ReAct 循环引擎 + 5 层上下文管理管道 + 微内核插件架构，能让任意 LLM 通过工具调用自主完成编码任务。**

---

## 第一性原理：AI Agent 到底在做什么？

```
Agent = LLM + 感知（工具读取环境） + 行动（工具修改环境） + 循环（直到任务完成）
```

**本质**：Agent 不是一个更好的 ChatBot。ChatBot 是 `输入 → 输出`（一次性）。Agent 是 `输入 → 思考 → 行动 → 观察 → 思考 → 行动 → ... → 输出`（循环直到完成）。

**类比**：
- ChatBot = 考试（一次性答题）
- Agent = 工作（持续观察环境、做决策、执行、验证结果）

---

## 核心架构：四层分离

```
┌─────────────────────────────────────────┐
│  CLI 交互层（终端 UI、流式输出、确认）    │  ← 可替换为 Web/移动端/桌面端
├─────────────────────────────────────────┤
│  Agent 核心层（ReAct 循环、上下文管道）   │  ← 引擎，与 IO 无关
├─────────────────────────────────────────┤
│  能力层（Tools、Skills、MCP、Steering）  │  ← 万物皆插件
├─────────────────────────────────────────┤
│  LLM 适配层（OpenAI 兼容接口）           │  ← 模型无关
└─────────────────────────────────────────┘
```

**设计哲学**：万物皆插件（Everything is a Plugin）。微内核只做调度，所有能力通过插件注入。

---

## 核心机制 1：ReAct 循环

### 什么是 ReAct？

ReAct = Reasoning + Acting。来自 2022 年论文《ReAct: Synergizing Reasoning and Acting in Language Models》。

**核心思想**：让 LLM 交替进行"推理"和"行动"，而不是一次性给出答案。

```
传统 LLM：  问题 → 答案（一步到位，容易幻觉）
ReAct Agent：问题 → 思考 → 行动 → 观察 → 思考 → 行动 → ... → 答案
```

### 第一性原理：ReAct 的本质

**ReAct 不是 LLM 的能力，是 Agent 框架层的设计范式。**

LLM 本身只做一件事：输入文本 → 输出文本。它不知道什么是"循环"，不知道什么是"工具调用"。所谓 ReAct，本质就是 **while 循环 + 提示词工程**，让 Agent 框架和 LLM 进行多次交流，得到一个经过复杂过程的结果。

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent 框架（你写的代码）                    │
│                                                             │
│   ┌─────────┐     ┌──────────┐     ┌─────────────┐        │
│   │ 组装     │────→│ 调用 LLM │────→│ 解析输出     │        │
│   │ Prompt   │     │(一次API) │     │ text/tool?  │        │
│   └─────────┘     └──────────┘     └──────┬──────┘        │
│        ↑                                    │               │
│        │         ┌──────────────┐           │               │
│        │         │              │           ↓               │
│        │    text │              │ tool_call                  │
│        │    退出  │              │           │               │
│        │         │              │     ┌─────▼─────┐        │
│        │         │              │     │ 执行工具   │        │
│        │         │              │     │(read/write │        │
│        │         │              │     │ /bash...)  │        │
│        │         │              │     └─────┬─────┘        │
│        │         │              │           │               │
│        └─────────┼──────────────┼───────────┘               │
│                  │   结果塞回上下文，继续循环                   │
│                  │                                           │
└──────────────────┼───────────────────────────────────────────┘
                   ↓
              最终回答给用户
```

**每一轮里 LLM 做的事情完全一样**——接收一段文本，预测下一段文本。它不知道自己在"循环"里，不知道上一轮发生了什么（除非框架把上一轮的结果塞进 prompt 告诉它）。

**"智能"的来源分工**：

| 能力 | 谁提供的 |
|------|---------|
| 循环（while） | 框架代码 |
| 工具执行（副作用） | 框架代码 |
| 上下文累积（记忆） | 框架代码（每轮追加 messages） |
| 决策（用什么工具、什么时候结束） | LLM 通过 prompt 里的指令和上下文"推理"出来 |

**一句话**：ReAct = 框架提供循环和手脚，LLM 提供大脑决策。框架不断问 LLM "下一步做什么"，LLM 不断回答，直到说"我做完了"。

### Mako 的 ReAct 实现

```typescript
// 简化版核心循环（实际代码在 packages/core/src/agent.ts）
async *chatStream(userMessage) {
  context.addMessage({ role: 'user', content: userMessage });

  while (iterations < maxIterations) {
    // 1. 组装上下文（System Prompt + 历史 + 工具定义）
    const messages = context.assemble();
    
    // 2. 调用 LLM（带工具定义）
    const response = await llm.chat(messages, { tools });
    
    // 3. 判断：文本回答 or 工具调用？
    if (response.type === 'text') {
      return response;  // 任务完成，退出循环
    }
    
    if (response.type === 'tool_calls') {
      // 4. 执行工具，结果放回上下文
      for (const toolCall of response.toolCalls) {
        const result = await toolRegistry.execute(toolCall);
        context.addMessage({ role: 'tool', content: result });
      }
      // 5. 继续循环（LLM 看到工具结果后再决策）
    }
  }
}
```

### 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 循环终止 | LLM 返回纯文本时退出 | LLM 自己判断任务是否完成 |
| 最大轮次 | 可配置（默认 20） | 防止无限循环 |
| 工具调用格式 | OpenAI Function Calling | 业界标准，所有主流模型都支持 |
| 流式输出 | AsyncGenerator 双向通信 | 支持流式文本 + 工具确认交互 |

### Key Points

> **Q: 为什么用 ReAct 而不是 Plan-and-Execute？**
> 
> A: ReAct 更适合编码场景。编码任务的信息是逐步暴露的（读了文件才知道结构，跑了测试才知道哪里错），不适合一开始就做完整规划。ReAct 的"观察-思考-行动"循环天然适配这种渐进式信息获取。
>
> Plan-and-Execute 适合任务边界清晰、信息充分的场景（如"按步骤部署"）。

---

## 核心机制 2：5 层上下文管道（ContextPipeline）

### 问题本质

LLM 有 token 上限（128K/200K），但真实编码会话可能产生数百万 token（100+ 轮对话，每轮读写多个文件）。

**核心矛盾**：信息量无限增长 vs 窗口有限。

### 解决思路：分层防御

不是一种方案解决所有问题，而是**多层递进**，每层解决一类问题：

```
L1 源头截断    → 大结果不进入上下文（落盘 + 预览）
L2 去重        → 重复内容不重复占用 token
L3 微压缩      → 旧的只读结果自动清理
L4 自动压缩    → 接近上限时 AI 生成结构化摘要
L5 兜底 + 检索 → 最旧消息归档，BM25 可检索恢复
```

### 每层的第一性原理

| 层 | 解决什么问题 | 原理 | 触发条件 |
|----|-------------|------|---------|
| L1 截断 | 单个工具结果太大（如 cat 一个 10MB 文件） | 超过阈值的内容保存到磁盘，上下文只保留前 N 字符预览 | 单条消息 > 50K 字符 |
| L2 去重 | 重复读取同一文件 | SHA-256 哈希检测，内容未变则返回存根 `[unchanged: hash=xxx]` | 同一文件被读取 2+ 次 |
| L3 微压缩 | 旧的只读工具结果占空间 | 只读工具的旧结果标记为可清理，写入操作的变更历史永远保留 | 每次 assemble 时 |
| L4 自动压缩 | 上下文接近 80% 上限 | LLM 生成 9 维结构化摘要（用户意图、关键决策、代码变更...） | tokenCount > 80% maxTokens |
| L5 兜底 | 上下文达到 95%，必须腾空间 | 最旧消息归档到磁盘 JSON，建立 BM25 索引可检索恢复 | tokenCount > 95% maxTokens |

### 架构模式：管道（Pipeline）

```typescript
// Ingress Pipeline（消息进入时）
addMessage(msg) → L1 Truncation → L2 Deduplication → 存储

// Egress Pipeline（组装上下文时）
assemble() → L3 MicroCompression → 输出给 LLM

// Compression Pipeline（压缩时）
compressIfNeeded() → L4 AutoCompression → L5 Fallback
```

**为什么用管道模式？**
- 每层职责单一，可独立开关/配置
- 新增层只需实现接口，不改已有代码
- 层之间解耦，可独立测试

### Key Points

> **Q: 为什么不直接用 RAG？**
> 
> A: 纯 RAG（向量检索）有两个问题：1）编码上下文的时序性很重要（"我刚才改了什么"），向量检索丢失时序；2）需要额外的 embedding 模型和向量数据库，增加部署复杂度。
>
> 我的方案是**渐进式**：先用轻量方案（截断、去重、压缩）解决 80% 的问题，只在最后兜底层用 BM25 关键词检索（无需向量数据库）。未来可以在 L5 层替换为向量检索，架构不用改。

> **Q: 9 维结构化摘要是什么？**
>
> A: L4 压缩时，不是简单地"总结对话"，而是让 LLM 按 9 个维度提取信息：用户意图、当前进度、关键决策、代码变更记录、文件结构、错误历史、待办事项、重要约束、原文引用。这样压缩后信息损失最小。

---

## 核心机制 3：工具系统（Tool Use）

### 第一性原理：Function Calling 的本质

**Function Calling 不是 LLM 在"调用函数"，LLM 只是输出了一段格式化的文本。**

本质就是：Agent 在上下文中带上 tools 的 JSON Schema 定义（"菜单"），LLM 用 structured output（JSON）"点菜"（告诉 Agent 调什么工具、传什么参数），Agent 负责"上菜"（解析 JSON → 执行工具 → 结果塞回上下文）。

```
Agent 发给 LLM 的请求：
  messages: [用户消息, 历史...]
  tools: [                          ← "菜单"：告诉 LLM 有哪些工具可用
    { name: "read_file", description: "读取文件", parameters: { path: string } },
    { name: "bash", description: "执行命令", parameters: { command: string } },
  ]

LLM 返回的响应（不是执行，只是"点菜"）：
  { tool_calls: [{ name: "read_file", arguments: { path: "src/index.ts" } }] }

Agent 解析 JSON → 执行 read_file("src/index.ts") → 结果塞回 messages → 下一轮
```

**LLM 自己不执行任何东西**——它只是被训练成"看到 tools 定义后，能输出符合 JSON Schema 的结构化文本"。这段文本恰好能被 Agent 解析成函数调用指令。

### 工具定义

工具 = Agent 的"手脚"。LLM 只能思考，工具让它能感知和改变环境。

```typescript
interface Tool {
  name: string;           // 工具名（LLM 通过名字选择）
  description: string;    // 描述（LLM 通过描述理解用途）
  parameters: JSONSchema; // 参数定义（LLM 按 schema 生成参数）
  execute(args): string;  // 执行逻辑（返回结果给 LLM）
}
```

### 工具调用流程

```
LLM 看到工具定义 → 决定用哪个工具 → 生成参数 JSON → Agent 执行 → 结果返回给 LLM
```

这里 LLM 做的是**决策**（用什么工具、传什么参数），Agent 做的是**执行**。

### 安全确认机制

```
工具分类：
- 安全工具（read_file, list_directory, search）→ 直接执行
- 危险工具（write_file, bash, replace_in_file）→ 需要用户确认

确认选项：
- y（yes）：执行这一次
- n（no）：拒绝这一次
- a（always）：本次会话内全部信任
```

**实现**：通过 AsyncGenerator 的双向通信（`yield` 发出确认请求，`next()` 接收用户回复）。

### MCP（Model Context Protocol）

MCP 是 Anthropic 提出的工具扩展标准协议。

**本质**：让 Agent 能连接外部工具服务器，动态发现和使用工具。

```
Agent ←→ MCP Client ←→ MCP Server（外部进程）
                              ↓
                        提供工具定义 + 执行能力
```

**Mako 的实现**：
- `MCPClient`：管理单个 MCP Server 连接（stdio 通信）
- `MCPServerManager`：管理多个 Server 的生命周期
- 工具命名：`mcp_{serverName}_{toolName}`（避免冲突）
- 启动时自动连接，退出时自动清理

---

## 核心机制 4：Steering + Skills

### Steering（行为规则）

**本质**：项目级的 System Prompt 扩展。

```
.mako/steering.md → 启动时读取 → 注入 System Prompt
```

类似 Claude Code 的 `CLAUDE.md`。让 Agent 了解项目规范（用什么包管理器、什么测试框架、什么代码风格）。

### Skills（技能包）

**本质**：可插拔的专家角色 + 工具白名单。

```yaml
# .mako/skills/code-review.md
---
name: code-review
triggers:
  keywords: [review, CR, 审查]
tools: [read_file, search]
---
你是代码审查专家，关注正确性、性能、可读性...
```

**自动激活**：用户消息中出现 trigger keyword → 自动注入该 Skill 的指令到 System Prompt。

---

## 核心机制 5：流式传输（Streaming）

### 本质

**一句话**：LLM 生成是逐 token 的，流式传输就是把这个逐 token 的过程实时暴露给用户，而不是等全部生成完再一次性返回。

### 为什么需要流式？

- LLM 生成一段 500 字的回答可能需要 3-5 秒
- 不流式 = 用户盯着空白等 5 秒 → 体验差
- 流式 = 第一个字 200ms 就出来，逐字打印 → 感知延迟极低

### 全链路实现

```
┌──────────────┐     SSE      ┌──────────────┐   AsyncIterator   ┌──────────┐
│  LLM API     │─────────────→│  LLM Adapter │──────────────────→│  Agent   │
│  (OpenAI等)  │  HTTP 长连接  │  (stream())  │   yield chunk     │  Core    │
└──────────────┘              └──────────────┘                    └────┬─────┘
                                                                       │
                                                          AsyncGenerator│yield event
                                                                       ↓
                                                                 ┌──────────┐
                                                                 │   CLI    │
                                                                 │ stdout   │
                                                                 └──────────┘
```

### 第一层：HTTP 协议层（SSE）

LLM API 使用 **Server-Sent Events** 协议：HTTP 响应不关闭连接，持续推送数据块。

```
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"choices":[{"delta":{"content":"你"}}]}

data: {"choices":[{"delta":{"content":"好"}}]}

data: {"choices":[{"delta":{"content":"！"}}]}

data: [DONE]
```

关键点：
- `stream: true` 参数开启流式
- 响应是 chunked transfer encoding
- 每个 chunk 是一个 delta（增量），不是完整内容
  > 注意"chunk"在不同层含义不同：HTTP 传输层的 chunk 是原始字节（Uint8Array）；SSE/SDK 层的 chunk 是解析好的 JSON 对象（`{delta:{content:"你"}}`）。这里说的是后者。
- 客户端需要自己拼接所有 delta 得到完整文本

### 第二层：LLM Adapter（AsyncIterable 封装）

```typescript
// OpenAI SDK 返回 AsyncIterable，逐 chunk 消费
async *stream(messages, options): AsyncIterable<LLMChunk> {
  const response = await this.client.chat.completions.create({
    model: this.model,
    messages,
    tools: options.tools,
    stream: true,  // ← 开启流式
  });

  for await (const chunk of response) {
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) {
      yield { type: 'text_delta', content: delta.content };
    }
    if (delta?.tool_calls) {
      yield { type: 'tool_call_delta' };
    }
    if (chunk.choices[0]?.finish_reason) {
      yield { type: 'done' };
    }
  }
}
```

### 第三层：Agent Core（AsyncGenerator 双向通信）

Agent 不只是转发文本流，还需要处理工具调用确认。用 **AsyncGenerator** 实现双向通信：

```typescript
async *chatStream(msg): AsyncGenerator<AgentEvent, void, AgentStreamInput> {
  // 向外 yield 事件（文本片段、工具开始、确认请求）
  yield { type: 'text_delta', content: '你好' };
  
  // 遇到危险工具 → yield 确认请求 → 通过 generator.next(value) 接收用户回复
  const confirmed: boolean = yield { type: 'tool_confirm', name: 'bash', arguments: {...} };
  // confirmed 是 CLI 层通过 generator.next(true/false) 传回来的
}
```

### 第四层：CLI 终端输出

```typescript
const gen = agent.chatStream(userMessage);
let result = await gen.next();

while (!result.done) {
  const event = result.value;
  
  if (event.type === 'text_delta') {
    process.stdout.write(event.content);  // 逐字追加，不换行
  }
  if (event.type === 'tool_confirm') {
    const answer = await askUser('执行? [y/n/a]');
    result = await gen.next(answer === 'y');  // 把用户回复传回 Agent
    continue;
  }
  result = await gen.next();
}
```

### 如果是 Web 前后端？

```
浏览器 ──fetch(POST)──→ Node.js BFF ──SDK(stream:true)──→ LLM API（OpenAI/阶跃等）
                              │                                    │
                              │← for await 逐块收 ←────── SSE ────┘
                              │
                              │── res.write() 逐块转发 ──→ 浏览器（SSE）
                              │
                           关闭连接 ──→ done: true
```

#### 为什么需要 BFF 中间层（不让前端直连 LLM API）？

1. **安全**：API Key 不能暴露在前端代码里
2. **业务逻辑**：鉴权、限流、计费、日志、Prompt 拼接、敏感词过滤
3. **灵活性**：可以聚合多个模型、做 fallback、A/B 测试

#### 后端（Node.js BFF）完整方案：

```typescript
import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/chat', async (req, res) => {
  // 1. 设置 SSE 响应头
  //    Content-Type: text/event-stream → 告诉浏览器这是 SSE 流
  //    Cache-Control: no-cache → 禁止缓存（流数据不能缓存）
  //    Connection: keep-alive → 保持长连接不断开
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 2. 调 LLM API（stream: true）
  //    返回的是 AsyncIterable，不是一次性响应
  //    BFF 此时作为 LLM 的"客户端"，消费 LLM 的 SSE 流
  const llmStream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: req.body.messages,
    stream: true,  // ← 开启流式，LLM API 也是 SSE 返回给 BFF
  });

  // 3. 逐块转发：LLM 吐一块，BFF 就往前端写一块
  //    BFF 同时是 LLM 流的消费者，也是前端流的生产者
  for await (const chunk of llmStream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      // res.write() 不会关闭连接，只是往 HTTP 响应体里追加数据
      // 格式必须是 SSE 规范：`data: ...\n\n`（两个换行表示一个事件结束）
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  // 4. 流结束：LLM 生成完毕，关闭连接
  res.write('data: [DONE]\n\n');
  res.end();  // ← 关闭 HTTP 连接，前端 reader.read() 会收到 done: true
});

app.listen(3000);
```

#### 后端关键点总结

| 问题 | 答案 |
|------|------|
| BFF 和 LLM 之间是什么协议？ | 也是 SSE（HTTP 长连接），OpenAI SDK 内部封装了 |
| BFF 会把整个响应缓存在内存里吗？ | 不会。`for await` 逐块消费 + `res.write()` 逐块转发，内存占用恒定 |
| 如果前端断开了怎么办？ | 监听 `req.on('close')` 事件，主动中断 LLM 请求（`controller.abort()`） |
| 并发怎么处理？ | Node.js 事件驱动，每个请求是一个异步流，不阻塞线程。1000 并发 = 1000 个异步流，不需要 1000 个线程 |
| 为什么 Node.js 特别适合？ | 事件驱动 + 非阻塞 IO，天然适合"收一块转一块"的流式代理 |

#### 错误处理（生产级）

```typescript
app.post('/api/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  // 前端断开时中止 LLM 请求
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const llmStream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: req.body.messages,
      stream: true,
    }, { signal: controller.signal });  // ← 传入 abort signal

    for await (const chunk of llmStream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (err.name === 'AbortError') return; // 前端主动断开，正常情况
    // LLM API 报错，通知前端
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});
```

前端：
```javascript
const response = await fetch('/api/chat', { method: 'GET' });
// response.body 是 ReadableStream（Web Streams API），getReader() 获取一个读取器，可以逐块拉取数据
const reader = response.body.getReader();
// TextDecoder 将 Uint8Array 字节流解码为 UTF-8 字符串（因为 reader.read() 返回的 value 是原始字节）
const decoder = new TextDecoder();

while (true) {
  // read() 不是逐字节读。每次返回一个 chunk（Uint8Array），大小不固定，取决于当前 TCP 到达了多少数据
  // 可能一次拿到多个 SSE 事件（多个 token），也可能拿到半个事件（需要外部拼接）
  // 本质是"有多少给多少"——浏览器收到一个 TCP segment 就作为一个 chunk 交出来
  const { done, value } = await reader.read();
  // done=true 表示流结束（服务端关闭连接，所有数据发完了）
  if (done) break;
  // Q: value 可能不完整，不会乱码吗？
  // A: TextDecoder 内部会暂存不完整的多字节字符尾部，等下次 decode 时拼接，所以不会乱码
  //    严格写法：decoder.decode(value, { stream: true })，显式告知"后续还有数据"
  // Q: SSE 事件被切成两半怎么办？
  // A: parseSSE 内部维护缓冲区，按 \n\n 分割完整事件，不完整的留到下次拼接
  const text = decoder.decode(value);
  document.getElementById('output').textContent += parseSSE(text);
}
```

### 关键概念总结

| 概念 | 说明 |
|------|------|
| SSE (Server-Sent Events) | HTTP 长连接，服务端单向推送事件流 |
| AsyncIterator / AsyncGenerator | JS 异步迭代协议，`for await...of` 消费 |
| Delta vs Full | 流式返回增量（delta），客户端拼接完整内容 |
| 背压（Backpressure） | 消费者慢 → 生产者自动暂停（AsyncIterator 天然支持） |
| 双向通信 | AsyncGenerator 的 `yield` 出 + `next(value)` 入 |

### SSE + Streaming 全链路本质总结

#### 0. 前端发起请求

```javascript
fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',  // 告诉服务端：我能接收 SSE 流（非必须，取决于服务端实现）
  },
  body: JSON.stringify({ messages: [...] })
})
```

#### 1. 服务端响应：设置什么 header、怎么保持连接

```javascript
res.setHeader('Content-Type', 'text/event-stream');  // ← 核心：告诉浏览器这是 SSE 流
res.setHeader('Cache-Control', 'no-cache');           // ← 不缓存流数据
res.setHeader('Connection', 'keep-alive');            // ← 保持 TCP 连接不断开
```

**`Connection: keep-alive` 保持的是什么？**

| 层 | 什么在保持 | 谁控制 |
|----|-----------|--------|
| TCP 层 | TCP 连接不断开（不发 FIN 包） | `Connection: keep-alive`（HTTP/1.1 默认就是） |
| HTTP 层 | 这一次 HTTP 响应不结束 | 服务端不调 `res.end()`，一直 `res.write()` |

**本质**：`keep-alive` 在 SSE 场景下其实是冗余的——HTTP/1.1 默认就保持连接。加上它是为了防止中间代理（Nginx/CDN）提前断开。真正让 SSE 工作的是：
- `Content-Type: text/event-stream` → 告诉浏览器用 SSE 协议解析
- 服务端不调 `res.end()` → HTTP 响应一直开着
- 底层 TCP 连接自然也就一直开着

**一句话**：TCP 连接是载体，HTTP 响应不关闭是手段，SSE 数据格式是协议约定。

#### 2. 前端怎么接收和渲染

```
response.body（ReadableStream）
  → getReader() 建立拉取式读取器
  → read() 逐块拿数据（有多少给多少）
  → TextDecoder 解码字节为字符串
  → parseSSE 按 \n\n 分割完整事件
  → 更新 DOM
```

**浏览器怎么知道要建立 ReadableStream？** — 看到 `Content-Type: text/event-stream`，浏览器就知道这个响应是流式的，`response.body` 自动是一个 `ReadableStream`，不会等响应结束才给你数据。

#### 3. 前端渲染优化

直接每个 token 更新一次 DOM 会导致高频 DOM 操作（可能 1 秒 30+ 次），生产中常见优化：

| 手段 | 做法 | 原因 |
|------|------|------|
| **rAF 合并渲染** | 多个 token 攒到下一帧再一次性更新 DOM | 减少 DOM 操作次数，和浏览器刷新率同步 |
| **字符串缓冲区** | 先拼字符串，rAF 回调里再写入 DOM | 避免每个 token 都触发重绘 |
| **Markdown 渲染节流** | throttle 控制 Markdown 解析 + 高亮的频率 | MD 解析是 CPU 密集操作，不需要每个 token 都跑一遍 |
| **React/Vue 自动批量** | setState 本身是异步批量的 | 框架帮你合并，不需要手动优化 |

**rAF 合并渲染示例**：

```javascript
let buffer = '';
let rafId = null;

function scheduleRender() {
  if (rafId) return;  // 已经安排了，不重复
  rafId = requestAnimationFrame(() => {
    outputEl.textContent += buffer;  // 一次性更新
    buffer = '';
    rafId = null;
  });
}

// 在 read 循环里
const tokens = parseSSE(text);
buffer += tokens.join('');
scheduleRender();  // 攒着，下一帧再渲染
```

### 底层本质：一个 token 一个 TCP 包吗？

**不是。** 应用层逐 token 写入，但 TCP 层会自动合并，实际网络 IO 频率远低于 token 生成频率。

#### 分层视角

```
应用层：LLM 生成 1 个 token → write() 一次 SSE 事件（data: {...}\n\n）
         ↓
内核 TCP 栈：Nagle 算法 + 发送缓冲区 → 攒多次 write，合并发送
         ↓
网络层：一个 TCP segment（MSS ~1460 bytes）里装了好几个 token 的数据
```

#### 关键机制

| 层 | 机制 | 效果 |
|----|------|------|
| 应用层 | 每生成一个 token 就 `write()` | 频繁小写入 |
| 内核 TCP 栈 | **Nagle 算法**：小包攒着，等前一个 ACK 回来或缓冲区满了再发 | 多次 write 合并为一个 TCP segment |
| 网络层 | TCP segment 最大 MSS ~1460 bytes | 一个包里可能装 5-10 个 token 的数据 |

#### 实际抓包

```
一个 TCP segment 里通常包含多个 SSE 事件：
data: {"choices":[{"delta":{"content":"你"}}]}\n\n
data: {"choices":[{"delta":{"content":"好"}}]}\n\n
data: {"choices":[{"delta":{"content":"，"}}]}\n\n

→ 3 个 token 合并在一个 TCP 包里发出
```

#### 延迟 vs 吞吐的平衡

- **禁用 Nagle**（`TCP_NODELAY`）：很多 SSE 服务会设置，让数据尽快发出，牺牲一点带宽换低延迟
- **HTTP chunked transfer**：应用层用 chunk 分帧，每个 chunk 可包含 1 个或多个 SSE 事件
- 实际策略取决于场景：对话场景优先低延迟（NODELAY），批量场景优先吞吐

#### 为什么体感是"逐字"的？

- LLM 生成速度本身不均匀（采样有快有慢）
- 即使多个 token 合并在一个 TCP 包到达，前端 `reader.read()` 拿到后逐个解析 SSE 事件，逐个渲染到 DOM
- 用户感知的"逐字"是**前端渲染层**的效果，不是网络层一个字一个包

#### 一句话总结

> **应用层逐 token 写入，TCP 层自动合并（Nagle + 缓冲区），实际一个 TCP 包携带多个 token。体感的"逐字输出"是前端解析渲染的效果，不是每个字一个网络包。**

---

## 设计决策：为什么不用 LangChain / LangGraph？

### 一句话

**Coding Agent 的核心逻辑本身很简单（while 循环 + LLM + 工具），真正的难点在上下文管理和工具设计——这些通用框架帮不了你。引入框架反而增加了理解成本、调试难度和依赖负担。**

### 深度对比

| 维度 | LangChain / LangGraph | Mako 自实现 |
|------|----------------------|-------------|
| 核心抽象 | Chain → Agent → Memory → Retriever → Tool → Callback → ... 概念多 | Agent → Tool → Context，三个核心概念 |
| 依赖体量 | 几十个包，`node_modules` 膨胀 | 生产依赖仅 openai + gpt-tokenizer + minisearch |
| 语言生态 | Python 为主力，TypeScript 版本功能滞后、社区小 | 原生 TypeScript，类型完善 |
| 抽象层级 | 多层 wrapper，调用链深 | 直接调 OpenAI SDK，一层到底 |
| 调试体验 | 出错要翻框架源码，堆栈深 | 每一行都是自己的代码，断点直达 |
| 定制性 | 要 override 框架的类/方法，受框架约束 | 完全自由，想改哪改哪 |
| Coding 场景适配 | 通用框架，不专注 Coding | 专为 Coding 设计（文件操作、命令行安全确认、上下文管理） |

### 本质原因

1. **Agent 循环本身不复杂**：ReAct 循环就是一个 while + if/else，不需要框架来"帮你写循环"
2. **真正的难点框架解决不了**：
   - 上下文管理（5 层管道）→ 业务强相关，框架只提供最基础的 BufferMemory
   - 工具安全确认（y/n/a）→ 需要和 UI 层深度集成
   - 流式双向通信 → 框架的 callback 模式不够灵活
3. **框架的价值在于"快速原型"**：如果只是做个 demo，LangChain 很快。但做生产级产品，框架的抽象反而是负担
4. **可解释性**：自己实现的每一个设计决策都能讲清楚为什么这么做

### LangGraph 的 Graph 模式 vs Mako 的 ReAct 循环

LangGraph 用有向图（DAG）编排 Agent 流程：节点是步骤，边是条件跳转。

```python
# LangGraph 风格
graph.add_node("think", think_fn)
graph.add_node("act", act_fn)
graph.add_edge("think", "act", condition=has_tool_call)
graph.add_edge("act", "think")
```

Mako 用简单的 while 循环：

```typescript
// Mako 风格
while (iterations < max) {
  const response = await llm.chat(messages, { tools });
  if (response.type === 'text') return response;
  if (response.type === 'tool_calls') { execute(); continue; }
}
```

**为什么不用 Graph？**
- Coding Agent 的流程是线性的（思考 → 行动 → 观察 → 循环），不需要复杂的分支跳转
- Graph 模式适合多步骤、多分支的复杂工作流（如客服系统、审批流程）
- 简单场景用 Graph 是过度设计，增加认知负担

---

## 工程实践

### 项目结构（pnpm monorepo）

```
packages/
├── core/   → Agent 引擎（零 IO 依赖，纯逻辑）
├── tools/  → 内置工具（文件、命令行、搜索）
├── mcp/    → MCP 客户端（外部工具协议）
└── cli/    → 终端交互（readline、chalk、ora）
```

**为什么 monorepo？**
- `core` 可以独立作为 SDK 嵌入其他应用
- `tools` 可以按需引入
- `cli` 只是一种交互形态，可以替换为 Web/移动端

### 技术选型

| 技术 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 类型安全 + AI Agent 领域主流 |
| 运行时 | Node.js 22+ | ESM 原生、fetch 内置 |
| 构建 | tsup (esbuild) | 快，ESM 输出 |
| 测试 | vitest | 快，ESM 原生支持 |
| LLM SDK | openai | 官方 SDK，类型完善 |
| Token 计数 | gpt-tokenizer | 本地计算，不依赖 API |
| 检索 | minisearch | 轻量 BM25，零依赖 |

### 流式输出 + 双向通信

```typescript
// AsyncGenerator 实现流式 + 确认
async *chatStream(msg): AsyncGenerator<AgentEvent, void, AgentStreamInput> {
  // yield 发出事件（文本片段、工具开始、确认请求）
  yield { type: 'text_delta', content: '...' };
  
  // 危险工具：yield 确认请求，通过 next() 接收用户回复
  const confirmed = yield { type: 'tool_confirm', name: 'bash' };
  if (confirmed === false) { /* 跳过 */ }
}
```

**为什么用 AsyncGenerator 而不是 EventEmitter？**
- AsyncGenerator 天然支持双向通信（yield 出 + next 入）
- 类型安全（TypeScript 泛型约束输入输出类型）
- 背压控制（消费者不 next，生产者自动暂停）

---

## 可观测性（Trace）

### 本质

Agent 是黑盒 → 需要白盒化。每次交互记录完整执行轨迹。

```json
{
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-01-01T00:00:05Z",
  "iterations": 3,
  "toolCalls": [
    { "name": "read_file", "args": {"path": "src/index.ts"}, "duration": 12 },
    { "name": "write_file", "args": {"path": "src/index.ts"}, "duration": 8 }
  ],
  "tokenUsage": { "prompt": 2000, "completion": 500 }
}
```

`mako trace` 命令：加载所有 trace 文件 → 统计分析 → 让 LLM 给出优化建议。

---

## Harness：AI Agent 的运行时容器

> 第一性原理：LLM 是概率模型，会幻觉、会失控。Harness = 用确定性工程机制约束概率输出。
>
> 本质：Harness 对 AI Agent 的关系 = 操作系统对应用程序的关系 = Docker 对进程的关系。

### 类比理解

```
操作系统对应用程序做什么：          Harness 对 AI Agent 做什么：
  - 分配资源（内存/CPU/文件权限）     - 提供工具接口（Tool）
  - 拦截危险操作（权限检查）           - 拦截危险操作（确认门）
  - 提供标准接口（系统调用）           - 提供标准协议（MCP）
  - 监控运行状态（进程管理）           - 监控执行过程（Trace 审计）
  - 强制终止失控进程                  - 强制终止失控循环（超时/次数上限）
```

### Harness 包含什么

| 能力 | 对应实现 | 作用 |
|------|---------|------|
| **工具注册** | MCP 协议定义 Tool（read/write/bash 等） | 限定 AI 能做什么 |
| **确认门** | preToolUse Hook — 高风险操作暂停等用户确认 | 防止 AI 执行危险操作 |
| **质量卡控** | postToolUse Hook — 写完自动跑 lint/test | 保证输出质量 |
| **循环检测** | 连续失败 N 次 → 终止并报告 | 防止无限循环 |
| **上下文约束** | Spec + Steering 文件 → 限定工作范围 | 防止 AI 偏离需求 |
| **结果验证** | TDD — 代码必须通过测试才算完成 | 形式化验证正确性 |
| **资源限制** | Token 上限 / 时间上限 / 调用次数 | 防止无限消耗 |

### 没有 Harness vs 有 Harness

```
没有 Harness：
  LLM 想做啥做啥 → rm -rf / → 完了
  LLM 幻觉 → 生成不存在的 API → 代码报错 → 没人发现

有 Harness：
  LLM 想删文件 → 确认门拦截 → 用户确认/拒绝
  LLM 写代码 → 自动跑 lint + test → 不过则 Agent 自修复
  LLM 偏离需求 → Spec 约束 + TDD 验证 → 发现偏移自动纠正
```

### 在 Mako 中的实际体现

```
┌─────────────────────────────────────────────────┐
│                  Harness 层                       │
│                                                   │
│  ┌─── preToolUse ────┐  ┌─── postToolUse ───┐   │
│  │ 危险操作确认       │  │ 自动 lint/test    │   │
│  │ 权限白名单         │  │ 结果验证          │   │
│  └───────────────────┘  └───────────────────┘   │
│                                                   │
│  ┌─── 循环控制 ──────┐  ┌─── 上下文约束 ────┐   │
│  │ maxIterations      │  │ Spec（做什么）    │   │
│  │ 失败计数器         │  │ Steering（怎么做）│   │
│  │ 超时检测           │  │ TDD（怎么算对）   │   │
│  └───────────────────┘  └───────────────────┘   │
│                                                   │
│              ┌──────────────┐                    │
│              │  AI Agent    │                    │
│              │  (ReAct Loop)│                    │
│              └──────────────┘                    │
└─────────────────────────────────────────────────┘
```

### 面试一句话

> "Harness 就是 AI Agent 的操作系统层——限定 AI 能做什么（工具白名单）、不能做什么（确认门拦截）、做完怎么验证（TDD + lint）。像 Docker 限制进程权限一样，用工程机制把 AI 的概率输出框在确定性范围内。"

---

## Q&A 高频问题预判

### Q1: Agent 和 RAG 的区别？

**RAG**：检索增强生成。`查询 → 检索相关文档 → 拼接到 prompt → LLM 生成`。本质是**一次性**的信息补充。

**Agent**：自主循环。`任务 → 思考 → 行动 → 观察 → 思考 → ...`。本质是**持续交互**的任务执行。

Agent 可以内部使用 RAG（比如 Mako 的 L5 层用 BM25 检索历史），但 Agent 的核心是循环决策，不是检索。

### Q2: 如何处理 LLM 幻觉？

1. **工具验证**：LLM 说"文件已修改" → 实际通过工具执行，结果是真实的
2. **观察反馈**：工具执行失败 → 错误信息返回给 LLM → LLM 修正策略
3. **最大轮次限制**：防止 LLM 陷入无效循环
4. **Steering 约束**：通过规则限制 LLM 的行为边界

### Q3: 上下文窗口不够怎么办？

5 层防御（见上文）。核心思想：**不是一种方案解决所有问题，而是分层递进，每层解决一类问题**。

### Q4: 为什么自己实现而不是用 LangChain？

详见上文 [设计决策](#设计决策为什么不用-langchain--langgraph) 章节。核心论点：

1. **Agent 循环本身不复杂** — 就是 while + LLM + 工具，不需要框架帮你写循环
2. **真正的难点框架解决不了** — 上下文管理、安全确认、流式双向通信都是业务强相关
3. **TypeScript 生态** — LangChain 主力是 Python，TS 版功能滞后
4. **生产级可控性** — 框架出问题要翻源码 debug，自己实现断点直达
5. **轻量** — Mako 核心 < 40KB vs LangChain 几十个依赖包

### Q5: 和 Claude Code / Cursor 的区别？

| 维度 | Claude Code | Cursor | Mako |
|------|------------|--------|------|
| 开源 | ❌ | ❌ | ✅ |
| 模型绑定 | Claude only | 多模型 | 任意模型 |
| 形态 | CLI | IDE 插件 | CLI + SDK（可嵌入） |
| 可观测 | ❌ | ❌ | ✅ Trace + AI 分析 |
| 可扩展 | MCP only | ❌ | MCP + Skills + 插件 |
| 上下文管理 | 闭源实现 | 闭源实现 | 开源 5 层管道 |

### Q6: 这个项目体现了什么能力？

1. **系统设计**：微内核 + 管道 + 插件化，分层清晰、边界明确
2. **工程实践**：monorepo、TypeScript、ESM、完整的构建/测试/发布流程
3. **AI 工程**：ReAct 循环、Prompt Engineering、Token 管理、流式处理
4. **产品思维**：不只是技术实现，有差异化定位（可观测 + 评测 + 插件生态）

---

## 一句话总结各模块

| 模块 | 一句话 |
|------|--------|
| Agent Core | ReAct 循环引擎：LLM 思考 → 工具行动 → 观察结果 → 循环直到完成 |
| ContextPipeline | 5 层防御管道：让有限窗口支撑无限对话 |
| ToolRegistry | 工具注册中心：统一接口，动态注册，LLM 通过 JSON Schema 调用 |
| LLM Adapter | 模型适配层：一套接口适配所有 OpenAI 兼容模型 |
| MCP Client | 外部工具协议：连接任意 MCP Server，动态发现工具 |
| Skills | 可插拔专家角色：关键词触发，指令注入，工具白名单 |
| Steering | 项目级规则：`.mako/steering.md` 自动注入 System Prompt |
| Trace | 执行追踪：每步记录，AI 分析，白盒化 Agent 行为 |

---

## 讲述模板（30 秒版）

> "我从零实现了一个开源 AI Coding Agent 框架 Mako。核心是 ReAct 循环引擎——让 LLM 通过工具调用自主完成编码任务。
>
> 技术亮点：5 层上下文管道支持无限对话、微内核插件架构、MCP 协议集成、完整的执行追踪。
>
> 架构设计上采用'万物皆插件'理念，核心引擎可作为 SDK 嵌入任意宿主环境。"

## 讲述模板（2 分钟版）

> "我做了一个开源的 AI Coding Agent 框架叫 Mako。
>
> **它解决什么问题？** 让任意 LLM 能自主完成编码任务——读代码、写代码、执行命令、调试 bug，不需要人一步步指导。
>
> **核心原理是 ReAct 循环**：LLM 思考要做什么 → 调用工具执行 → 观察结果 → 再思考 → 循环直到任务完成。关键是 LLM 自己决定用什么工具、传什么参数、什么时候结束。
>
> **最大的技术挑战是上下文管理**。真实编码会话可能 100+ 轮，产生的 token 远超模型窗口。我设计了 5 层防御管道：源头截断、SHA-256 去重、微压缩、AI 结构化摘要、BM25 检索恢复。每层解决一类问题，渐进式降级。
>
> **架构上采用微内核 + 万物皆插件**。核心引擎只做 ReAct 调度，工具、技能、MCP 协议、行为规则都是插件。这样核心稳定，能力可无限扩展。
>
> **差异化**：相比 Claude Code（闭源绑定模型）和 LangChain（通用框架太重），Mako 是专注 Coding 场景的轻量开源方案，内置可观测性和评测框架。"
