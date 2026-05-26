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
│  CLI 交互层（终端 UI、流式输出、确认）    │  ← 可替换为 Web/移动端
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

### 本质

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
浏览器 ──fetch──→ 后端 Server ──SDK──→ LLM API
                       │
                       │ SSE / ReadableStream
                       ↓
                    浏览器 JS
                       │
                       ↓ DOM 逐字渲染
```

后端（Node.js）：
```typescript
app.get('/api/chat', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  
  for await (const chunk of llm.stream(messages)) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  res.end();
});
```

前端：
```javascript
const response = await fetch('/api/chat', { method: 'GET' });
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
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
