# AI Agent 核心概念与架构

> 面向全栈/大前端工程师的 AI Agent 知识体系，从概念到开发能力。

## 目录

- [零、第一性原理：Agent 的本质](#零第一性原理agent-的本质)
- [一、基础概念层](#一基础概念层)
  - [1.1 LLM 基础](#11-llm-基础)
  - [1.2 Prompt Engineering](#12-prompt-engineering)
  - [1.3 Structured Output](#13-structured-output)
- [二、核心能力层](#二核心能力层)
  - [2.1 RAG（检索增强生成）](#21-rag检索增强生成)
  - [2.2 Function Calling / Tool Use](#22-function-calling--tool-use)
  - [2.3 多轮对话管理](#23-多轮对话管理)
  - [2.4 Memory（记忆系统）](#24-memory记忆系统)
- [三、Agent 架构层](#三agent-架构层)
  - [3.1 什么是 AI Agent](#31-什么是-ai-agent)
  - [3.2 Agent 核心循环](#32-agent-核心循环)
  - [3.3 ReAct 模式](#33-react-模式)
  - [3.4 Planning（规划）](#34-planning规划)
  - [3.5 Multi-Agent（多智能体）](#35-multi-agent多智能体)
- [四、协议与标准层](#四协议与标准层)
  - [4.1 MCP（Model Context Protocol）](#41-mcpmodel-context-protocol)
  - [4.2 A2A（Agent-to-Agent Protocol）](#42-a2aagent-to-agent-protocol)
  - [4.3 OpenAI Function Calling Schema](#43-openai-function-calling-schema)
- [五、工程化层](#五工程化层)
  - [5.1 Agent 运行时概念（Skills / Steering / Hooks / Session）](#51-agent-运行时概念skills--steering--hooks--session)
  - [5.2 Embedding 与向量数据库](#52-embedding-与向量数据库)
  - [5.3 Guardrails（护栏）](#53-guardrails护栏)
  - [5.4 Evaluation（评估）](#54-evaluation评估)
  - [5.5 Observability（可观测性）](#55-observability可观测性)
  - [5.6 Fine-tuning vs Prompt Engineering vs RAG](#56-fine-tuning-vs-prompt-engineering-vs-rag)
- [六、业界产品与生态](#六业界产品与生态)
- [七、架构全景图](#七架构全景图)

---

## 零、第一性原理：Agent 的本质

### 0.1 从最底层理解

LLM 的本质是一个**函数**：`f(text) → text`。输入一段文字，输出一段文字。仅此而已。

它不会"思考"，不会"记忆"，不会"行动"。它只是在做一件事：**基于输入的文本，预测最可能的下一段文本**。

> **多模态补充**：以上说的是文本，但图片、音频、视频本质一样。LLM 内部只认一种东西：**向量**（一组数字）。不管喂进去什么模态，都要先经过 Encoder 编码成向量，模型在向量空间里做运算，再经过 Decoder 解码回目标格式。文本用 Tokenizer 切词编码，图片切成 16×16 小块编码，音频切成短时帧编码——不同模态共享同一个向量空间，一张猫的图片和"猫"这个字在向量空间里距离很近。所以 LLM 的本质是**向量到向量的映射**，文本只是最早被接入的一种模态，图片/音频/视频只是换了编码器和解码器。

那 Agent 是什么？Agent 是在这个函数外面包了一层**循环和副作用**：

```
while (任务未完成) {
  输入 = 组装(系统指令 + 记忆 + 用户输入 + 工具结果)
  输出 = LLM(输入)                    // 纯函数，无副作用
  解析输出 → 是工具调用？是最终回答？
  if (工具调用) {
    结果 = 执行工具(输出.参数)          // 副作用：读写外部世界
    记忆.追加(工具调用 + 结果)
  } else {
    return 输出                        // 任务完成
  }
}
```

**所以 Agent 的本质就是三件事**：

1. **循环**（Loop）— 不是一次调用，而是反复调用 LLM 直到任务完成
2. **上下文组装**（Context Assembly）— 每次调用前，把记忆、工具结果、指令拼成输入
3. **副作用执行**（Side Effects）— 把 LLM 的文本输出转化为真实世界的操作

所有的 Agent 概念——RAG、Memory、Tool Use、Planning、Multi-Agent——都是在优化这三件事中的某一件。

### 0.2 概念映射

| Agent 概念 | 本质上在优化什么 | 怎么优化的 |
|-----------|----------------|-----------|
| Prompt Engineering | 上下文组装 | 更好地告诉 LLM 该做什么 |
| RAG | 上下文组装 | 动态检索相关信息塞进输入 |
| Memory | 上下文组装 | 跨轮次保留关键信息 |
| Tool Use / MCP | 副作用执行 | 让 LLM 的输出能操作外部世界 |
| Planning | 循环控制 | 把大任务拆成小步骤，控制循环节奏 |
| ReAct | 循环控制 | 每步先推理再行动，提高循环质量 |
| Multi-Agent | 循环控制 | 多个循环并行/串行协作 |
| Guardrails | 循环控制 | 在循环中加入校验和拦截 |
| Skills | 上下文组装 + 副作用 | 预定义的能力包（指令 + 工具 + 约束） |
| Steering | 上下文组装 | 持久化的行为指导规则 |
| Hooks | 循环控制 | 在循环的特定节点插入自定义逻辑 |

### 0.3 为什么理解本质很重要

当你理解了 Agent = Loop + Context + Side Effects，你就能：

- 看到任何新概念时，立刻知道它在优化哪一层
- 设计 Agent 时，知道瓶颈在哪——是上下文不够好？是工具不够用？还是循环策略有问题？
- 评估框架时，知道它的抽象是否合理——是在简化复杂度，还是在增加不必要的复杂度？

---

## 一、基础概念层

### 1.1 LLM 基础

**LLM（Large Language Model）**：大语言模型，本质是一个超大规模的文本预测模型。给它一段文字，它预测接下来最可能的文字。因为训练数据和参数规模足够大，涌现出了推理、编码、翻译等能力。

**核心参数**：

| 概念 | 说明 | 开发者需要关注的 |
|------|------|----------------|
| Token | LLM 处理文本的最小单位，中文 1 字 ≈ 1-2 token，英文 1 词 ≈ 1 token | API 费用和速度都跟 token 数量直接相关 |

> **Token vs 向量的关系**：Token 是人能理解的最小语义单位（"猫"、"the"、"func"），向量是机器能处理的最小单位（`[0.12, -0.34, ...]` 一组有序数字，就是线性代数里的向量）。Embedding 层是 Token 到向量的映射表。Transformer 内部全是向量之间的矩阵乘法、点积、softmax——本质就是一个超大规模的矩阵运算机器，"智能"是从这些数学运算中涌现出来的。
| Context Window | 模型一次能"看到"的 token 上限（Claude 200K，GPT-4o 128K） | AI 应用设计中最核心的约束，超出窗口的内容模型就"忘了" |
| Temperature | 控制输出随机性。0 = 确定性最高，1 = 创造性最高 | 代码/数据提取用低温，创意/头脑风暴用高温 |
| Top-P | 控制采样范围，和 Temperature 配合使用 | 通常保持默认 |
| Max Tokens | 单次回复的最大 token 数 | 限制输出长度，控制成本 |

**模型能力边界**：
- ✅ 擅长：文本生成、代码编写、翻译、摘要、推理、格式转换
- ❌ 不擅长：精确数学计算、实时信息、长期记忆、确定性输出
- ⚠️ 核心问题：Hallucination（幻觉）— 一本正经地胡说八道

### 1.2 Prompt Engineering

让模型按你的意图输出的技术。不是"会说话"，而是一种工程化的输入设计。

**核心模式**：

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| System Prompt | 给模型设定角色和行为规则，用户看不到 | 所有 Agent 应用的基础 |
| Zero-shot | 直接问，不给例子 | 简单任务 |
| Few-shot | 给几个输入输出的例子，让模型学会模式 | 格式化输出、分类任务 |
| Chain of Thought (CoT) | 让模型"一步步思考"再给答案 | 推理类任务，准确率显著提升 |
| ReAct | 推理 + 行动交替进行 | Agent 的核心模式 |

**Prompt 工程的本质**：把你的意图、约束、上下文、示例，用结构化的方式喂给模型，让它在你划定的范围内输出。

### 1.3 Structured Output

让模型输出 JSON、XML 等结构化格式，方便程序解析。

```json
// 告诉模型输出 JSON
{
  "name": "张三",
  "age": 25,
  "skills": ["JavaScript", "Python"]
}
```

- OpenAI 和 Claude 都支持 JSON Mode
- 可以用 JSON Schema 约束输出格式
- 是 Function Calling 的基础——模型需要输出结构化的函数调用参数

---

## 二、核心能力层

### 2.1 RAG（检索增强生成）

**问题**：模型知识有截止日期，也不知道你的私有数据。

**方案**：先从你的知识库里检索相关内容，塞进 prompt 里，再让模型基于这些内容回答。

```
用户提问
  ↓
Query → Embedding 向量化
  ↓
向量数据库检索 → 取回 Top-K 相关文档片段
  ↓
拼入 System Prompt / User Prompt
  ↓
LLM 生成回答（基于检索到的内容）
```

**RAG 的关键环节**：

| 环节 | 说明 | 影响 |
|------|------|------|
| 文档切分（Chunking） | 把长文档切成小段 | 切太大检索不精确，切太小丢失上下文 |
| Embedding | 把文本转成向量 | 模型选择影响检索质量 |
| 检索策略 | 向量相似度 / 关键词 / 混合检索 | 直接决定回答质量 |
| Reranking | 对检索结果重新排序 | 提升相关性 |
| Prompt 组装 | 把检索结果塞进 prompt | 格式和位置影响模型理解 |

**RAG vs Fine-tuning**：
- RAG：不改模型，改输入。适合知识库问答、文档检索。成本低，实时更新。
- Fine-tuning：改模型权重。适合风格/格式/领域适配。成本高，更新慢。
- 大部分场景 RAG 就够了，Fine-tuning 是最后手段。

### 2.2 Function Calling / Tool Use

**问题**：LLM 只能生成文字，不能执行操作（查数据库、调 API、发邮件）。

**方案**：告诉模型有哪些工具可用，模型判断什么时候该调什么工具，返回结构化的调用参数，你的代码执行后把结果喂回模型。

```
你定义工具 → 模型决定调用哪个 → 返回参数 JSON → 你执行 → 结果喂回模型 → 模型生成最终回答
```

```typescript
// 定义工具
const tools = [{
  name: "get_weather",
  description: "获取指定城市的天气",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "城市名" }
    },
    required: ["city"]
  }
}];

// 模型返回
{ "tool_call": { "name": "get_weather", "arguments": { "city": "深圳" } } }

// 你执行 get_weather("深圳") → { temp: 28, weather: "晴" }
// 把结果喂回模型 → 模型生成 "深圳今天28度，晴天"
```

**这是 Agent 的基础能力**——没有 Tool Use，Agent 就只是一个聊天机器人。

### 2.3 多轮对话管理

**问题**：LLM 本身是无状态的，每次调用都是独立的。

**方案**：把历史对话拼进 prompt，让模型"记住"之前聊了什么。

```
messages = [
  { role: "system", content: "你是一个助手" },
  { role: "user", content: "我叫张三" },           // 第1轮
  { role: "assistant", content: "你好张三" },       // 第1轮回复
  { role: "user", content: "我叫什么？" },          // 第2轮
  // 模型能回答"你叫张三"，因为历史在 prompt 里
]
```

**核心挑战**：Context Window 有限，对话越长，历史越多，最终会超出窗口。

**解决方案**：

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| 滑动窗口 | 只保留最近 N 轮对话 | 简单场景 |
| 摘要压缩 | 用 LLM 把历史对话压缩成摘要 | 长对话 |
| RAG 检索 | 把历史存入向量数据库，按相关性检索 | 超长期记忆 |
| Token 计数 + 截断 | 按 token 数量动态截断 | 精确控制 |

### 2.4 Memory（记忆系统）

Agent 的记忆分三层，类比人类记忆：

| 类型 | 类比 | 实现方式 | 生命周期 |
|------|------|---------|---------|
| 短期记忆 | 工作记忆 | 当前对话的 messages 数组 | 单次会话 |
| 中期记忆 | 笔记本 | 会话摘要、关键信息提取 | 跨会话 |
| 长期记忆 | 知识库 | 向量数据库 + RAG | 永久 |

```
用户说"我喜欢用 TypeScript"
  ↓
短期记忆：当前对话记住
中期记忆：提取偏好 → 存入用户画像
长期记忆：写入向量数据库 → 未来检索
```

---

## 三、Agent 架构层

### 3.1 什么是 AI Agent

不只是一问一答，而是能**自主规划、执行多步任务**的 AI 系统。

**Agent = LLM + Memory + Tools + Planning**

| 组件 | 作用 |
|------|------|
| LLM | 大脑，负责推理和决策 |
| Memory | 记忆，短期/长期信息存储 |
| Tools | 手脚，执行外部操作（API、数据库、文件系统） |
| Planning | 规划，把复杂任务拆解成步骤 |

**Agent vs Chatbot**：
- Chatbot：你问一句，它答一句
- Agent：你给一个目标，它自己规划步骤、调用工具、观察结果、调整策略，直到完成

### 3.2 Agent 核心循环

```
         ┌──────────────┐
         │   感知 Perceive │ ← 接收用户输入 / 工具返回结果
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │   思考 Think   │ ← LLM 推理：该做什么？
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │   行动 Act     │ ← 调用工具 / 生成回复
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │   观察 Observe │ ← 看工具返回了什么
         └──────┬───────┘
                │
                └──→ 回到"思考"，直到任务完成
```

### 3.3 ReAct 模式

**Reasoning + Acting**，目前最主流的 Agent 模式。

模型交替进行推理和行动：

```
Thought: 用户想知道深圳天气，我需要调用天气 API
Action: get_weather(city="深圳")
Observation: { temp: 28, weather: "晴" }
Thought: 拿到结果了，可以回答用户
Answer: 深圳今天28度，晴天，适合出门。
```

**为什么有效**：让模型先"想"再"做"，比直接行动准确率高很多。类似 Chain of Thought，但加了行动步骤。

### 3.4 Planning（规划）

复杂任务需要拆解成多个步骤：

| 策略 | 说明 | 示例 |
|------|------|------|
| 顺序规划 | 一步步执行 | 1.搜索 → 2.分析 → 3.生成报告 |
| DAG 规划 | 有依赖关系的并行执行 | 搜索A和搜索B并行 → 合并结果 → 生成报告 |
| 动态规划 | 根据中间结果调整计划 | 搜索结果不够 → 追加搜索 → 重新分析 |
| 反思规划 | 执行后自我评估，失败则重试 | 生成代码 → 运行测试 → 失败 → 修改 → 重试 |

Kiro 的 Spec 驱动开发就是一种规划模式：需求 → 设计 → 任务列表 → 逐个执行。

### 3.5 Multi-Agent（多智能体）

多个 Agent 协作完成复杂任务，每个 Agent 有不同的角色和能力。

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Planner Agent│────→│ Coder Agent │────→│ Reviewer Agent│
│ 规划任务     │     │ 写代码      │     │ Review 代码   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                                         ┌──────▼──────┐
                                         │ Tester Agent │
                                         │ 跑测试       │
                                         └─────────────┘
```

**协作模式**：

| 模式 | 说明 | 代表框架 |
|------|------|---------|
| 层级式 | 一个 Orchestrator 分配任务给子 Agent | CrewAI |
| 对话式 | Agent 之间互相对话协商 | AutoGen |
| 流水线式 | 按顺序传递，每个 Agent 处理一个环节 | LangGraph |

---

## 四、协议与标准层

### 4.1 MCP（Model Context Protocol）

Anthropic 提出的标准协议，让 AI 模型以统一的方式连接外部工具和数据源。

```
AI 模型 ←→ MCP Client ←→ MCP Server（工具/数据源）
```

**类比**：MCP 之于 AI 工具，就像 USB 之于外设。有了统一接口，任何工具只要实现 MCP Server，任何 AI 客户端都能调用。

**你已经在用了**：Kiro 里的飞书 MCP、Gerrit MCP 就是 MCP Server。

**MCP 的三种能力**：
- Tools：让模型调用工具（函数）
- Resources：让模型读取数据源（文件、数据库）
- Prompts：预定义的 prompt 模板

### 4.2 A2A（Agent-to-Agent Protocol）

Google 提出的 Agent 间通信协议，让不同厂商的 Agent 能互相发现、协商、协作。

```
Agent A（你的 Agent）←→ A2A Protocol ←→ Agent B（第三方 Agent）
```

MCP 解决的是"Agent 怎么用工具"，A2A 解决的是"Agent 之间怎么协作"。

### 4.3 OpenAI Function Calling Schema

事实上的行业标准，定义了工具描述的 JSON Schema 格式。大部分框架和模型都兼容这个格式。

---

## 五、工程化层

### 5.1 Agent 运行时概念（Skills / Steering / Hooks / Session）

这些概念来自 OpenClaw、Kiro、Claude Code 等 Agent 平台的实战抽象，是把 Agent 从"能跑"变成"好用"的关键。

#### Skills（技能）

**本质**：预定义的"能力包"，把 System Prompt + 工具集 + 约束条件打包成一个可复用的单元。

```
Skill = {
  name: "code-review",
  instructions: "你是一个代码审查专家，关注安全性和性能...",  // 指令
  tools: ["read_file", "grep_search", "gerrit_review"],      // 可用工具
  constraints: "不要修改代码，只提建议",                       // 约束
  knowledge: ["./docs/coding-standards.md"]                   // 知识文件
}
```

**为什么需要 Skills**：
- 一个通用 Agent 什么都能做但什么都不精。Skills 让 Agent 在特定场景下表现更好。
- 类比：一个人会很多技能，但做手术时切换到"外科医生"模式，写代码时切换到"程序员"模式。
- 小象 Ellie 装载了 80+ Skills（vela-build、crash-analysis、gerrit-review 等），就是这个思路。

**Skills 的组成**：

> **Skill 的文件结构**：核心就是一个 Markdown 说明书（SKILL.md）喂给 LLM，加一个 JSON 元信息（skill.json）给框架注册用。skill.json 定义 name、description、triggers（关键词/文件模式触发）、tools（可用工具白名单）、model 等元信息。SKILL.md 定义角色、行为规则、约束、输出格式——这才是真正注入 System Prompt 的内容。运行时流程：用户输入 → 框架按 triggers 匹配 Skill → 读取 SKILL.md 注入 System Prompt → 限制可用工具 → LLM 在这个"人设 + 工具集 + 约束"下工作。

> **自举现象**：Agent 系统已经进入自举时代——Agent 可以创建新的 Skill（小象的 skill-creator），AI Coding 工具用来开发 AI Coding 工具本身，LLM 辅助训练下一代 LLM。这意味着 AI 能力的增长不再是线性的，而是复利式的——每一代 AI 工具都在加速下一代的开发。

| 组件 | 作用 | 对应 Agent 本质 |
|------|------|----------------|
| Instructions | 告诉 Agent 在这个技能下怎么行为 | 上下文组装 |
| Tools | 这个技能可以用哪些工具 | 副作用执行 |
| Knowledge | 这个技能需要的背景知识 | 上下文组装（RAG） |
| Constraints | 这个技能的边界和限制 | 循环控制（Guardrails） |
| Triggers | 什么条件下自动激活这个技能 | 循环控制 |

#### Steering（导航/指导）

**本质**：持久化的行为规则，始终注入到 Agent 的上下文中，不管当前在做什么任务。

```markdown
# .kiro/steering/coding-standards.md
- 使用 TypeScript strict 模式
- 组件命名用 PascalCase
- 提交信息用英文
- 不要引入新的依赖，除非必要
```

**Skills vs Steering 的区别**：
- Skills 是按需激活的（做 code review 时用 review skill）
- Steering 是始终生效的（不管做什么都要遵守编码规范）
- 类比：Skills 是"你现在要做手术"，Steering 是"你永远要洗手"

**Steering 的类型**：

| 类型 | 触发方式 | 场景 |
|------|---------|------|
| Always | 每次对话都注入 | 编码规范、团队约定 |
| File Match | 读取特定文件时注入 | 读 .vue 文件时注入 Vue 规范 |
| Manual | 用户手动引用 | 特定任务的指导文档 |

#### Hooks（钩子）

**本质**：在 Agent 循环的特定节点插入自定义逻辑，类似前端框架的生命周期钩子。

```
Agent 循环:
  用户输入 ──→ [promptSubmit Hook] ──→ LLM 推理
    ──→ [preToolUse Hook] ──→ 执行工具 ──→ [postToolUse Hook]
    ──→ 生成回复 ──→ [agentStop Hook]
```

**Hook 的类型**：

| Hook | 触发时机 | 典型用途 |
|------|---------|---------|
| promptSubmit | 用户发送消息时 | 输入预处理、权限检查 |
| preToolUse | 工具执行前 | 安全审查、参数校验 |
| postToolUse | 工具执行后 | 结果校验、日志记录 |
| fileEdited | 文件被修改时 | 自动 lint、自动测试 |
| agentStop | Agent 完成任务时 | 自动提交、通知 |

**Hook 的两种动作**：
- `askAgent`：给 Agent 发一条提示（"检查一下这个写操作是否安全"）
- `runCommand`：执行一个 shell 命令（`npm run lint`）

**为什么 Hooks 重要**：它让 Agent 的行为可以被外部控制和审计，不是完全黑盒。这是 Agent 从"玩具"变成"生产工具"的关键。

#### Session（会话）

**本质**：Agent 循环的一次完整生命周期，包含所有的对话历史、工具调用记录、中间状态。

```
Session = {
  id: "session_123",
  messages: [...],           // 对话历史
  tool_calls: [...],         // 工具调用记录
  memory: {...},             // 会话级记忆
  active_skills: [...],      // 当前激活的技能
  status: "active" | "closed"
}
```

**Session 管理的挑战**：
- 上下文窗口有限，长会话需要压缩（`/compact`）
- 多会话并行需要隔离（小象的话题机制）
- 会话恢复需要持久化

#### Workspace（工作区）

**本质**：Agent 可以操作的文件系统范围。Agent 不是对整台电脑有权限，而是被限制在一个目录里。

```
VVCB_WORKSPACE=/home/xxx/workspace  # 小象只能操作这个目录
```

这是安全边界——Agent 再聪明，也不能删你的系统文件。

### 5.2 Embedding 与向量数据库

**Embedding**：把文本转成一组数字（向量），语义相近的文本向量距离近。RAG 的检索就靠这个。

```
"JavaScript 是一种编程语言" → [0.12, -0.34, 0.56, ...]  (1536维向量)
"JS 是一门编程语言"         → [0.11, -0.33, 0.55, ...]  (距离很近)
"今天天气不错"              → [0.89, 0.12, -0.67, ...]  (距离很远)
```

**常用 Embedding 模型**：OpenAI text-embedding-3、BGE、Cohere Embed

**向量数据库**：专门存储和检索向量的数据库。

| 数据库 | 特点 |
|--------|------|
| Pinecone | 全托管，开箱即用 |
| Milvus | 开源，适合大规模 |
| Chroma | 轻量，适合原型 |
| pgvector | PostgreSQL 插件，已有 PG 的直接用 |
| Weaviate | 开源，支持混合检索 |

### 5.2 Guardrails（护栏）

防止模型输出有害、不合规、或格式错误的内容。

| 类型 | 说明 |
|------|------|
| 输入过滤 | 检测恶意 prompt、注入攻击 |
| 输出校验 | 检查格式是否正确、内容是否合规 |
| 内容审核 | 过滤有害/敏感内容 |
| 事实核查 | 检测幻觉，验证输出的事实性 |

### 5.3 Evaluation（评估）

怎么衡量 AI 应用的质量？

| 维度 | 指标 |
|------|------|
| 准确性 | 回答是否正确 |
| 相关性 | 回答是否切题 |
| 忠实度 | 是否基于提供的上下文（不编造） |
| 延迟 | 响应时间 |
| 成本 | Token 消耗 |

常用评估框架：Ragas（RAG 评估）、DeepEval、LangSmith

### 5.4 Observability（可观测性）

AI 应用的调试比传统应用难——你不知道模型"在想什么"。

需要追踪：
- 每次 LLM 调用的输入/输出/token 数/延迟
- Tool 调用链路
- RAG 检索结果
- Agent 的推理过程

常用工具：LangSmith、Langfuse、Phoenix

### 5.5 Fine-tuning vs Prompt Engineering vs RAG

| 方案 | 改什么 | 成本 | 适用场景 |
|------|--------|------|---------|
| Prompt Engineering | 改输入 | 低 | 大部分场景的首选 |
| RAG | 改输入（加检索内容） | 中 | 知识库问答、私有数据 |
| Fine-tuning | 改模型权重 | 高 | 风格适配、领域专精 |
| LoRA | 轻量改模型 | 中 | Fine-tuning 的轻量替代 |

**决策顺序**：先试 Prompt Engineering → 不够用加 RAG → 还不够再 Fine-tuning。

---

## 六、业界产品与生态

### 6.1 模型层

| 模型 | 厂商 | 特点 |
|------|------|------|
| Claude (Opus/Sonnet) | Anthropic | 代码和长文本最强，200K 上下文 |
| GPT-4o / o1 / o3 | OpenAI | 生态最完善，多模态 |
| Gemini | Google | 多模态，长上下文（1M token） |
| DeepSeek | DeepSeek | 开源，性价比高 |
| Llama | Meta | 开源，本地部署 |
| Qwen | 阿里 | 开源，中文优秀 |

### 6.2 Agent 框架

| 框架 | 语言 | 特点 |
|------|------|------|
| LangChain | Python/JS | 最流行，生态最大，但抽象层多 |
| LangGraph | Python/JS | LangChain 团队出品，专注 Agent 工作流 |
| CrewAI | Python | Multi-Agent，角色扮演模式 |
| AutoGen | Python | 微软出品，对话式 Multi-Agent |
| Vercel AI SDK | TypeScript | 前端友好，流式 UI |
| Mastra | TypeScript | TypeScript 原生 Agent 框架 |
| Semantic Kernel | C#/Python | 微软出品，企业级 |

### 6.3 开发工具

| 工具 | 用途 |
|------|------|
| Kiro | AI IDE，Spec 驱动开发 |
| Cursor | AI 代码编辑器 |
| Claude Code | 终端 AI 编程 |
| Codex | OpenAI 终端 AI 编程 |
| OpenCode | 开源终端 AI 编程 |
| Multica | AI Agent 团队管理平台 |

### 6.4 向量数据库

| 数据库 | 部署方式 | 适用场景 |
|--------|---------|---------|
| Pinecone | 云托管 | 快速上手，不想运维 |
| Milvus | 自部署/云 | 大规模生产环境 |
| Chroma | 本地/嵌入式 | 原型开发、小规模 |
| pgvector | PostgreSQL 插件 | 已有 PG 基础设施 |
| Qdrant | 自部署/云 | Rust 实现，性能好 |

### 6.5 Agent 产品

| 产品 | 定位 |
|------|------|
| ChatGPT | 通用对话 Agent |
| Claude | 通用对话 + 编程 Agent |
| Perplexity | 搜索 Agent |
| Devin | 软件工程 Agent |
| Replit Agent | 全栈开发 Agent |
| 小象 Ellie (VVCB) | 团队专属 AI 数字人 |

---

## 七、架构全景图

一个完整的 AI Agent 应用的技术架构：

```
┌─────────────────────────────────────────────────────────┐
│                      用户交互层                          │
│  Web UI / CLI / 飞书 / Slack / API                      │
├─────────────────────────────────────────────────────────┤
│                      Agent 编排层                        │
│  Planning → ReAct Loop → Multi-Agent 协调               │
│  框架: LangGraph / CrewAI / AutoGen / Mastra            │
├─────────────────────────────────────────────────────────┤
│                      能力层                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Tool Use │ │   RAG    │ │ Memory   │ │ Planning │  │
│  │ MCP/API  │ │ 检索增强  │ │ 短/长期  │ │ 任务拆解  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│                      模型层                              │
│  Claude / GPT-4o / Gemini / DeepSeek / 本地模型          │
│  Embedding 模型: text-embedding-3 / BGE                  │
├─────────────────────────────────────────────────────────┤
│                      基础设施层                           │
│  向量数据库 / 传统数据库 / 消息队列 / 文件存储            │
│  可观测性: LangSmith / Langfuse                          │
│  护栏: 输入过滤 / 输出校验 / 内容审核                     │
├─────────────────────────────────────────────────────────┤
│                      协议层                              │
│  MCP (工具连接) / A2A (Agent 协作) / OpenAI Schema       │
└─────────────────────────────────────────────────────────┘
```

---

> 这是骨架文档，后续按需深入每个模块。下一步建议：从 Tool Use + MCP 入手实战，因为你已经在 Kiro 里用过 MCP 了，最容易从"会用"过渡到"会开发"。
