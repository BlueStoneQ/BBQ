# 05 — LLM 适配层

> 源码：`packages/core/src/llm/`

---

## 目录

- [一句话](#一句话)
- [接口定义](#接口定义)
- [为什么这样设计](#为什么这样设计)
- [设计模式](#设计模式)
- [面试话术](#面试话术)

---

## 一句话

LLM Adapter = 适配器模式。定义统一接口，不同模型实现各自的 Adapter，Agent 核心不关心用的是哪个模型。

---

## 接口定义

```typescript
interface LLMAdapter {
  chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse>;
  stream(messages: Message[], options?: ChatOptions): AsyncIterable<LLMStreamChunk>;
}

interface ChatOptions {
  tools?: ToolDefinitionForLLM[];
  temperature?: number;
  maxTokens?: number;
}
```

就两个方法：
- `chat()` — 非流式，等全部返回
- `stream()` — 流式，逐 chunk 返回

---

## 为什么这样设计

**1. 模型无关**

Agent 核心只依赖 `LLMAdapter` 接口，不依赖具体模型：

```typescript
class Agent {
  private llm: LLMAdapter; // 接口，不是具体实现

  // 运行时可切换
  switchLLM(newLlm: LLMAdapter): void {
    this.llm = newLlm;
  }
}
```

**2. 所有 OpenAI 兼容模型用同一个 Adapter**

OpenAI 的 API 格式已经成为事实标准。Claude、DeepSeek、MiMo、本地模型（Ollama）都兼容 OpenAI 格式，所以一个 `OpenAIAdapter` 就能适配所有：

```typescript
// 切换模型只需改 baseURL 和 apiKey
const claude = new OpenAIAdapter({
  baseURL: 'https://api.anthropic.com/v1',
  apiKey: process.env.CLAUDE_KEY,
  model: 'claude-sonnet-4-20250514',
});

const deepseek = new OpenAIAdapter({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_KEY,
  model: 'deepseek-chat',
});

const local = new OpenAIAdapter({
  baseURL: 'http://localhost:11434/v1', // Ollama
  model: 'qwen2.5-coder',
});
```

**3. 统一响应格式**

不管底层模型返回什么格式，Adapter 统一转为：

```typescript
type LLMResponse =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }

type LLMStreamChunk =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call_delta'; ... }
  | { type: 'done' }
```

Agent 核心只处理这几种类型，不关心底层 API 的差异。

---

## 设计模式

这是经典的**适配器模式（Adapter Pattern）**：

```
Agent（客户端）
  → LLMAdapter（目标接口）
    → OpenAIAdapter（适配器，把 OpenAI API 转为统一接口）
    → 未来：AnthropicAdapter、OllamaAdapter...
```

也可以看作**策略模式（Strategy Pattern）**——运行时切换 LLM 策略。

---

## 面试话术

> "LLM 适配层用适配器模式——定义 LLMAdapter 接口（chat + stream 两个方法），Agent 核心只依赖接口不依赖具体模型。当前用 OpenAIAdapter 适配所有 OpenAI 兼容模型（Claude/DeepSeek/本地模型），切换模型只需改 baseURL 和 model 参数。运行时还能通过 switchLLM() 热切换。"
