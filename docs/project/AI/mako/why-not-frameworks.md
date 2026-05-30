# 技术选型：为什么不用主流 Agent 框架

## 目录

- [结论先行](#结论先行)
- [一、先看事实：工业级 Agent 用了什么？](#一先看事实工业级-agent-用了什么)
- [二、市面主流 Agent 框架全景](#二市面主流-agent-框架全景)
- [三、逐个击破：为什么不选](#三逐个击破为什么不选)
  - [LangChain / LangChain.js](#langchain--langchainjs)
  - [LangGraph](#langgraph)
  - [CrewAI](#crewai)
  - [AutoGen (Microsoft)](#autogen-microsoft)
  - [Vercel AI SDK](#vercel-ai-sdk)
  - [Mastra](#mastra)
  - [OpenAI Agents SDK](#openai-agents-sdk)
- [四、这些框架到底解决了什么问题？](#四这些框架到底解决了什么问题)
- [五、工业级 Agent 真正需要什么？（玩具 vs 生产级的鸿沟）](#五工业级-agent-真正需要什么玩具-vs-生产级的鸿沟)
- [六、自实现的真正理由（第一性原理）](#六自实现的真正理由第一性原理)
- [七、Mako 实际依赖盘点](#七mako-实际依赖盘点)
- [八、Mako 进化路线：从当前到工业级](#八mako-进化路线从当前到工业级)
- [九、Prep 话术](#九prep-话术)
- [概念速查表](#概念速查表)

---

## 结论先行

**一句话**：工业级 Coding Agent（Claude Code、Cursor、Aider、OpenHands）**没有一个用 LangChain/LangGraph**。它们全部自实现核心循环，只在 LLM 通信层用轻量 SDK。框架解决的是"快速原型"和"通用编排"问题，但 Coding Agent 需要的是"精细控制"——这两者矛盾。

**核心论点**：
1. **事实验证**：所有工业级 Coding Agent 都是自实现，无一使用通用 Agent 框架
2. **框架解决的问题**：快速原型、通用编排、多 Agent 协作——但这些不是 Coding Agent 的核心难点
3. **工业级真正需要的**：安全沙箱、权限分层、上下文精细管理、流式并发、可观测性——框架帮不了
4. **不用框架 ≠ 不用任何库**：LLM SDK（openai）、Token 计数（gpt-tokenizer）、协议 SDK（MCP SDK）该用就用
5. **自实现 = 企业更认可**：证明你理解底层原理，不是"调包侠"

---

## 一、先看事实：工业级 Agent 用了什么？

> 先看数据，再下结论。

### Claude Code（Anthropic，512K 行 TypeScript）

2026 年 3 月源码泄露（source map 事件），社区逆向分析后发现：

| 维度 | 实际选择 |
|------|---------|
| 语言 | TypeScript |
| UI 框架 | React + Ink（终端 React） |
| Agent 框架 | **无。完全自实现** |
| LLM 通信 | Anthropic 自有 SDK |
| 工具系统 | `buildTool()` 工厂 + Zod schema，40+ 工具，18+ feature flags |
| 安全 | 5 层防御（权限规则 → 模式 → 工具检查 → 路径安全 → macOS Seatbelt 沙箱） |
| 多 Agent | Coordinator 星型拓扑，fork prompt cache 共享 |
| 依赖数 | ~50 个（但核心逻辑零框架依赖） |

**关键发现**：512K 行代码，工具系统定义就占 29,000 行。这种精细度不可能用通用框架实现。

### OpenHands（原 OpenDevin，SWE-bench 榜首）

| 维度 | 实际选择 |
|------|---------|
| 语言 | Python |
| Agent 框架 | **无。自研 Software Agent SDK** |
| LLM 通信 | LiteLLM（轻量多模型适配层，不是 Agent 框架） |
| 执行环境 | Docker 沙箱 |
| 架构 | 模块化 SDK：Agent → Runtime → LLM → Tools |

### Aider（39K+ stars，Git-first Coding Agent）

| 维度 | 实际选择 |
|------|---------|
| 语言 | Python |
| Agent 框架 | **无。完全自实现** |
| LLM 通信 | LiteLLM |
| 核心特色 | repo-map 上下文生成、4 种 edit mode、Git auto-commit |

### Cursor（商业产品，IDE 集成）

| 维度 | 实际选择 |
|------|---------|
| 语言 | TypeScript |
| Agent 框架 | **无。完全自实现** |
| 形态 | VS Code fork + 自研 Agent 引擎 |

### 结论

> **所有工业级 Coding Agent 都是自实现核心循环，没有一个用 LangChain / LangGraph / CrewAI。**
>
> 它们用的是：LLM 通信 SDK（openai / litellm / anthropic SDK）+ 协议 SDK（MCP SDK）+ 基础工具库。

---

## 二、市面主流 Agent 框架全景

| 框架 | 语言 | 定位 | 核心抽象 | 星标 |
|------|------|------|---------|------|
| **LangChain** | Python / JS | 通用 LLM 应用框架 | Chain → Agent → Memory → Retriever | 95K+ |
| **LangGraph** | Python / JS | 有状态多步 Agent 编排 | 有向图（节点 + 边 + 状态） | 8K+ |
| **CrewAI** | Python | 多 Agent 角色协作 | Agent → Task → Crew | 25K+ |
| **AutoGen** | Python | 多 Agent 对话 | Agent → GroupChat → ConversableAgent | 35K+ |
| **Vercel AI SDK** | TypeScript | 前端 AI 集成 | useChat / streamText / generateText | 10K+ |
| **Mastra** | TypeScript | TS-first Agent 框架 | Agent → Tool → Workflow | 新兴 |
| **OpenAI Agents SDK** | Python | 轻量多 Agent | Agent → Runner → Handoff | 新兴 |

---

## 三、逐个击破：为什么不选

### LangChain / LangChain.js

**它是什么**：最早也最流行的 LLM 应用框架，提供 Chain（链式调用）、Agent（自主决策）、Memory（记忆）、Retriever（检索）等抽象。

**为什么不用**：

| 问题 | 具体表现 |
|------|---------|
| **抽象过重** | 概念太多：Chain / Agent / Memory / Retriever / Callback / OutputParser / PromptTemplate... 学习曲线陡 |
| **调用链深** | 一个简单的 LLM 调用要经过 5-6 层 wrapper，出错时堆栈看不懂 |
| **JS 版二等公民** | LangChain.js 功能滞后于 Python 版，社区小，文档不全 |
| **过度封装** | 把 `openai.chat.completions.create()` 包了 N 层，但没增加实质价值 |
| **依赖膨胀** | 几十个子包，`node_modules` 爆炸 |
| **Coding 场景不适配** | 通用框架，没有针对文件操作、命令行安全确认、代码上下文管理的设计 |

**本质问题**：LangChain 解决的是"快速原型"问题（10 分钟跑通一个 demo），但 Coding Agent 需要的是"精细控制"（上下文每一个 token 都要精打细算）。框架的抽象层反而挡在你和 LLM 之间。

---

### LangGraph

**它是什么**：LangChain 团队出的新框架，用有向图（DAG）编排 Agent 流程。节点是步骤，边是条件跳转，状态在图中流转。

```python
# LangGraph 风格
graph.add_node("think", think_fn)
graph.add_node("act", act_fn)
graph.add_edge("think", "act", condition=has_tool_call)
graph.add_edge("act", "think")
```

**为什么不用**：

| 问题 | 具体表现 |
|------|---------|
| **过度设计** | Coding Agent 的流程是线性的（思考→行动→观察→循环），不需要复杂的分支跳转 |
| **Graph 适合什么** | 多步骤、多分支的复杂工作流（客服系统、审批流程、多 Agent 协作） |
| **Coding 场景** | 一个 while 循环就够了，用 Graph 是杀鸡用牛刀 |
| **状态管理复杂** | Graph 的状态传递需要定义 State Schema，对简单场景是负担 |
| **Python 优先** | JS/TS 版本功能不全 |

**本质问题**：LangGraph 解决的是"复杂编排"问题，但 ReAct 循环本身就是最简单的编排——一个 while 循环。引入 Graph 抽象不是简化了问题，而是把简单问题复杂化了。

**什么时候该用 Graph？** 如果你的 Agent 有明确的多阶段流程（如：需求分析 → 设计 → 编码 → 测试 → 部署），每个阶段有不同的工具集和策略，且阶段之间有复杂的条件跳转——那 Graph 有价值。Mako 后续规划了类似 Kiro Spec 模式的多阶段流程（Requirements → Design → Tasks），但即便如此，也倾向于自实现轻量 Orchestrator 而非引入 LangGraph——因为掌握编排的核心原理本身就是构建 Agent 能力的一部分。

---

### CrewAI

**它是什么**：多 Agent 角色协作框架。定义多个 Agent（如"产品经理"、"开发者"、"测试员"），给它们分配 Task，组成 Crew 协作完成。

**为什么不用**：

| 问题 | 具体表现 |
|------|---------|
| **Python only** | 没有 TypeScript 版本 |
| **多 Agent 是远期** | Mako v0.x 是单 Agent，多 Agent 是 v2.0 的事 |
| **角色抽象太死** | 预定义角色模板，不够灵活 |
| **Coding 场景不适配** | 面向通用任务协作，不专注代码编写 |

**本质问题**：CrewAI 解决的是"多 Agent 协作编排"问题，但 Mako 当前阶段的核心挑战是"单 Agent 做好一件事"。先把单 Agent 做到极致，再考虑多 Agent。

---

### AutoGen (Microsoft)

**它是什么**：微软的多 Agent 对话框架。核心是 ConversableAgent（可对话的 Agent），多个 Agent 在 GroupChat 中对话协作。

**为什么不用**：

| 问题 | 具体表现 |
|------|---------|
| **Python only** | 没有 TypeScript 版本 |
| **对话驱动** | 核心模式是 Agent 之间"聊天"，不是工具调用循环 |
| **太重** | 依赖多，概念多（AssistantAgent / UserProxyAgent / GroupChat / ...） |
| **不适合 Coding** | 面向研究场景（论文实验），不是生产级 Coding Agent |

---

### Vercel AI SDK

**它是什么**：Vercel 出的 TypeScript AI SDK，主要面向前端/全栈应用集成 AI 能力。提供 `useChat`、`streamText`、`generateText` 等 API。

**为什么不用**：

| 问题 | 具体表现 |
|------|---------|
| **定位不同** | 面向 Web 应用集成 AI（聊天组件、流式渲染），不是 Agent 框架 |
| **无 Agent 循环** | 没有 ReAct 循环、工具注册、上下文管理等 Agent 核心能力 |
| **前端绑定** | 和 Next.js/React 深度绑定 |

**但值得借鉴**：Vercel AI SDK 的流式处理设计很优雅（`streamText` 返回 ReadableStream），Mako 的流式设计参考了这个思路。

---

### Mastra

**它是什么**：新兴的 TypeScript-first Agent 框架，提供 Agent、Tool、Workflow 等抽象。

**为什么不用**：

| 问题 | 具体表现 |
|------|---------|
| **太新** | 生态不成熟，API 不稳定 |
| **通用框架** | 不专注 Coding 场景 |
| **依赖多** | 引入了很多子包 |

**但值得关注**：Mastra 是 TS 生态里少有的认真做 Agent 框架的项目，设计理念和 Mako 有相似之处。

---

### OpenAI Agents SDK

**它是什么**：OpenAI 官方出的轻量多 Agent 框架（Python），提供 Agent、Runner、Handoff 等抽象，支持通过 LiteLLM 扩展接入 100+ 模型。

**为什么不用**：

| 问题 | 具体表现 |
|------|---------|
| **Python only** | 没有 TypeScript 版本 |
| **太新** | 2025 年初发布，API 还在快速变化 |
| **面向通用场景** | 不专注 Coding，没有文件操作/命令行安全等设计 |
| **轻量但不够轻** | 对于 Coding Agent 来说，它的 Handoff 机制是多余的抽象 |

**值得借鉴**：它的设计哲学（轻量、少抽象、直接）和 Mako 一致，说明业界在回归简单。

---

## 四、这些框架到底解决了什么问题？

> 框架不是没有价值，而是它们解决的问题和 Coding Agent 的核心问题不重合。

### 框架解决的问题

| 问题 | 哪个框架解决 | 具体怎么解决 |
|------|------------|-------------|
| **快速原型** | LangChain | 10 行代码跑通一个 Agent demo |
| **多模型切换** | LangChain / LiteLLM | 统一接口适配 100+ 模型 |
| **复杂编排** | LangGraph | 有向图定义多步骤流程 |
| **多 Agent 协作** | CrewAI / AutoGen | 角色分配、任务委派、对话管理 |
| **前端集成** | Vercel AI SDK | React hooks + 流式渲染 |
| **记忆管理** | LangChain Memory | BufferMemory / SummaryMemory / VectorMemory |
| **RAG 检索** | LangChain Retriever | 向量数据库 + 文档加载 + 分块 |

### Coding Agent 的核心问题（框架解决不了的）

| 问题 | 为什么框架帮不了 | Mako/Claude Code 怎么解决 |
|------|----------------|--------------------------|
| **上下文精细管理** | 框架只有粗粒度 Memory（Buffer/Summary），不够用 | 5 层管道：截断→去重→微压缩→AI 摘要→BM25 检索 |
| **工具安全确认** | 框架没有"危险工具需要用户确认"的概念 | AsyncGenerator 双向通信，y/n/a 三级确认 |
| **流式 + 工具交织** | 框架的 callback 模式处理不了"流式文本中间插入工具确认" | 统一的 AgentEvent 流，文本和工具事件混合 |
| **沙箱隔离** | 框架不管执行安全 | Docker 容器 / macOS Seatbelt / 路径白名单 |
| **权限分层** | 框架没有细粒度权限模型 | 5 层安全：规则→模式→工具→路径→OS 沙箱 |
| **Prompt Cache 优化** | 框架不关心 token 成本优化 | 静态/动态 prompt 分离，cache-friendly 设计 |
| **并发工具执行** | 框架通常串行执行工具 | StreamingToolExecutor + 读写锁并发 |
| **优雅降级** | 框架出错就崩 | 分层降级：重试→降级→摘要→归档 |

### 一句话总结

> **框架解决的是"从 0 到 1 快速跑通"的问题。工业级 Agent 面对的是"从 1 到 100 精细打磨"的问题。这两个阶段需要的东西完全不同。**

---

## 五、工业级 Agent 真正需要什么？（玩具 vs 生产级的鸿沟）

### 玩具 Agent 和工业级 Agent 的差距

| 维度 | 玩具（Demo 级） | 工业级（Claude Code 级） |
|------|----------------|------------------------|
| **循环** | while + LLM + 工具 | while + LLM + 工具 + 超时 + 重试 + 降级 + 取消 |
| **上下文** | 全部塞进去，超了就截断 | 5 层管道，每个 token 精打细算 |
| **安全** | 无 | 多层沙箱 + 权限模型 + 路径白名单 |
| **工具** | 5-7 个简单工具 | 40+ 工具，feature flags 控制，Zod schema 即文档 |
| **并发** | 串行执行 | 并发执行 + 读写锁 + 竞态处理 |
| **错误处理** | try-catch 打日志 | 分层恢复：乐观重试 → 降级 → 状态机回滚 |
| **可观测** | console.log | 结构化 Trace + 成本追踪 + 决策归因 |
| **多 Agent** | 无 | Coordinator 编排 + 隔离 + cache 共享 |
| **取消** | 无 | 3 层 AbortController 级联取消 |
| **测试** | 手动测 | 单元 + 集成 + Property-based + E2E + Benchmark |

### 工业级的 4 个核心支柱

从 Claude Code 源码泄露和 OpenHands SDK 论文中提炼：

```
┌─────────────────────────────────────────────────────────┐
│              工业级 Coding Agent 四大支柱                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 安全与隔离          2. 上下文工程                    │
│     - 沙箱执行              - Token 精细管理             │
│     - 权限分层              - Prompt Cache 优化          │
│     - 路径白名单            - 压缩与检索                 │
│     - 取消与超时            - 多 Agent 上下文隔离        │
│                                                         │
│  3. 可靠性              4. 可观测性                      │
│     - 重试与降级            - 执行 Trace                 │
│     - 状态机管理            - 成本追踪                   │
│     - 并发控制              - 决策归因                   │
│     - 优雅关闭              - 失败回放                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**这 4 个支柱，没有一个是通用 Agent 框架能帮你解决的。** 它们都是业务强相关的工程问题。

### 企业认可什么？

技术评审看的不是"你用了什么框架"，而是：

1. **你理解底层原理吗？** → 自实现 ReAct 循环 > 调用 LangChain Agent
2. **你能解决真实工程问题吗？** → 5 层上下文管道 > "我用了 BufferMemory"
3. **你有系统设计能力吗？** → 微内核 + 插件架构 > "我按框架文档配置了一下"
4. **你能做技术决策吗？** → "我评估了 X/Y/Z，选择自实现因为..." > "我用了最流行的"

---

## 六、自实现的真正理由（第一性原理）

### 选型哲学

> **核心理念：掌握本质原理，和 AI 一起进步。**

1. **默认自己实现** — 除非实现成本极高或属于非核心基础设施（如协议解析、编码算法），否则自己实现。只有当"自己实现的成本远大于收益"时才引入社区库。
2. **用库不用框架** — 引入的是解决特定问题的专项工具（openai SDK、gpt-tokenizer），不是替你做决策的通用框架（LangChain）。库是你调用它，框架是它调用你。
3. **第一性原理驱动** — 每个技术决策都能追溯到"它解决什么本质问题"。不因为"大家都用"就用，不因为"看起来高级"就引入。
4. **实现过程 = 能力构建** — 在实现过程中深度理解每个机制的原理，这些理解反过来让你更好地设计 Agent、更好地和 AI 协作。自己写过 ReAct 循环的人，和只调过 LangChain Agent 的人，对 Agent 的理解深度完全不同。

### AI Coding 时代的框架悖论

> **框架的本质交易：用"控制权"换"速度"。AI Coding 时代，这个交易不再划算。**

**传统时代**：

```
手写一切 → 慢但可控
用框架   → 快但受约束
→ 多数场景选框架（速度优先）
```

**AI Coding 时代**：

```
AI + 自实现 → 快且可控（AI 抹平了手写成本）
AI + 框架   → 快但受约束（框架的约束 AI 帮不了你绕过）
→ 自实现成为更优选择
```

**三层论证**：

| 层次 | 论点 | 展开 |
|------|------|------|
| **成本层** | AI 抹平了手写成本 | 以前自实现 ReAct 循环要 2 天，现在和 AI 一起写 2 小时。框架省时间的优势大幅缩水 |
| **约束层** | 框架的约束成本没变甚至更高 | 当你想做框架没预设的事（AsyncGenerator 双向通信、5 层上下文管道），要花大量时间"绕过"框架抽象。AI 帮不了你绕框架——因为约束是架构级的 |
| **能力层** | AI 时代核心竞争力是"理解力"不是"编码速度" | 框架帮你省的是编码时间，但剥夺的是理解深度。而理解深度恰恰是 AI 替代不了的东西 |

**一句话总结**：

> 框架是前 AI 时代的效率工具，AI 是后框架时代的效率工具。两者解决同一个问题（降低实现成本），但 AI 不剥夺你的控制权。

**类比**：
- 框架 = 跟团游（省心但路线固定，想去计划外的地方很难）
- AI + 自实现 = 自驾游 + 导航（同样省心，但随时可以改路线）

### 应对质疑：分层回应

> 技术评审一定会挑战"为什么不用框架"。以下是分层回应策略。

**质疑 1："不用框架是不是在重复造轮子？"**

> 回应层次：
> 1. **事实层**：Claude Code、Cursor、Aider、OpenHands 全部自实现，无一用框架。这不是我一个人的判断，是整个工业界的选择。
> 2. **区分层**：我用了库（openai SDK、MCP SDK），不用的是框架。库和框架的区别是——库是我调用它，框架是它调用我。我没有重复造 HTTP 客户端，我造的是 Agent 核心逻辑。
> 3. **价值层**：Agent 核心逻辑（上下文管道、安全确认、流式双向通信）恰恰是产品的核心竞争力，不应该交给通用框架。

**质疑 2："框架能加速开发，为什么不先用框架快速验证再替换？"**

> 回应层次：
> 1. **成本层**：AI Coding 时代，自实现的速度已经和用框架差不多。我和 AI 一起写核心循环只用了几小时，不比学 LangChain 的 API 慢。
> 2. **技术债层**：先用框架再替换 = 两次实现成本 + 迁移风险。框架的抽象会渗透到整个代码库，替换不是"换一个文件"而是"重写架构"。
> 3. **认知层**：用框架跑通 demo 不等于理解原理。我需要的不是"能跑"，而是"每个决策都能讲清楚为什么"。

**质疑 3："团队协作时，框架提供统一规范，自实现怎么保证一致性？"**

> 回应层次：
> 1. **架构层**：微内核 + 插件接口就是规范。Tool 接口、LLM Adapter 接口、Context Layer 接口——这些就是团队协作的契约。
> 2. **工程层**：TypeScript strict + ESLint + vitest + 完整的类型定义，比框架的"约定大于配置"更可靠。
> 3. **文档层**：每个模块有清晰的职责边界和接口文档，新人看接口定义就知道怎么扩展。

**质疑 4："如果 LangChain 未来变好了呢？"**

> 回应层次：
> 1. **当下判断**：技术选型基于当下的事实，不基于未来的假设。当下 LangChain.js 功能滞后、抽象过重、不适合 Coding 场景。
> 2. **架构兼容**：微内核架构的好处是——如果未来某个框架的某个模块真的做得好（比如 LangGraph 的状态管理），我可以只引入那个模块，不需要买整个全家桶。
> 3. **本质不变**：Coding Agent 的核心难点（上下文管理、安全、可观测性）是业务强相关的，通用框架永远解决不好。这个判断不会因为框架版本更新而改变。

### 理由 1：Agent 循环本身不复杂

```typescript
// Mako 的核心循环，去掉注释不到 30 行
while (iterations < maxIterations) {
  const messages = context.assemble();
  const response = await llm.chat(messages, { tools });
  if (response.type === 'text') return response;
  if (response.type === 'tool_calls') {
    for (const call of response.toolCalls) {
      const result = await toolRegistry.execute(call);
      context.addMessage({ role: 'tool', content: result });
    }
  }
  iterations++;
}
```

**你不需要一个框架来帮你写这 30 行代码。**

---

### 理由 2：真正的难点框架解决不了

| 难点 | 为什么框架帮不了 |
|------|----------------|
| **5 层上下文管道** | 业务强相关（截断阈值、去重策略、压缩时机都和 Coding 场景绑定） |
| **安全确认机制** | 需要和 UI 层深度集成（AsyncGenerator 双向通信） |
| **流式 + 工具确认交织** | 框架的 callback 模式不够灵活 |
| **Token 精细管理** | 每个 token 都要精打细算，框架的通用 Memory 太粗糙 |
| **Coding 专属工具设计** | 文件读写的 diff 展示、bash 的安全沙箱、搜索的结果裁剪 |

---

### 理由 3：调试体验天差地别

**用框架**：
```
Error: Something went wrong
  at LangChainAgent.invoke (node_modules/langchain/agent.js:142)
  at AgentExecutor.call (node_modules/langchain/executor.js:89)
  at Chain.run (node_modules/langchain/chain.js:56)
  at ... (还有 10 层)
```

**自实现**：
```
Error: Tool execution failed
  at ToolRegistry.execute (src/tool-registry.ts:45)  ← 直接定位
  at Agent.chatStream (src/agent.ts:78)
```

---

### 理由 4：依赖极致轻量

```
Mako core 生产依赖（3 个）：
├── openai        → LLM 通信（官方 SDK，必须）
├── gpt-tokenizer → 本地 token 计数（不依赖 API）
└── minisearch    → BM25 检索（L5 兜底层，零依赖）

vs LangChain.js 依赖（几十个）：
├── langchain
├── @langchain/core
├── @langchain/openai
├── @langchain/community
├── zod
├── ... (还有 20+)
```

**少一个依赖 = 少一个潜在的 breaking change、安全漏洞、版本冲突。**

---

### 理由 5：完全可解释

技术评审/答辩时，自己实现的每一个设计决策都能讲清楚：
- 为什么用 AsyncGenerator 而不是 EventEmitter？→ 双向通信 + 背压控制
- 为什么 L4 压缩用 9 维结构化摘要？→ 最小化信息损失
- 为什么工具确认分 y/n/a 三级？→ 平衡安全和效率

用框架的话，很多决策是框架替你做的，你说不清楚为什么。

---

## 七、Mako 核心库选型详解

> 每个依赖都能回答：解决什么问题？为什么选它？它的本质原理是什么？

### @mako-agent/core 的依赖

#### 1. openai（LLM 通信）

| 维度 | 内容 |
|------|------|
| **解决的问题** | 和 LLM API 通信（发送 prompt、接收响应、流式传输） |
| **为什么选它** | OpenAI 官方 TypeScript SDK，类型完善；所有 OpenAI 兼容模型（Claude/DeepSeek/MiMo/本地模型）都能用同一个 SDK |
| **本质原理** | 封装 HTTP 请求（POST /chat/completions），处理 SSE 流式响应解析、重试、错误处理。本质是一个类型安全的 HTTP 客户端 |
| **为什么不自己写** | HTTP 通信 + SSE 解析 + 重试逻辑 + 类型定义，实现成本高且非核心竞争力。这是"协议层"，不是"业务层" |
| **替代方案** | 直接用 fetch + 手动解析 SSE（可行但没必要，SDK 已经做得很好） |

#### 2. gpt-tokenizer（Token 计数）

| 维度 | 内容 |
|------|------|
| **解决的问题** | 本地计算文本的 token 数量，用于上下文管道的容量判断 |
| **为什么选它** | 纯 JS 实现，零外部依赖，支持 GPT-4/3.5 的 tokenizer（cl100k_base / o200k_base） |
| **本质原理** | BPE（Byte Pair Encoding）算法的 JS 实现。BPE 是一种子词分词算法：从字符级开始，反复合并最频繁的相邻 pair，直到达到词表大小。tokenizer 就是用训练好的合并规则把文本切成 token 序列 |
| **为什么不自己写** | BPE 算法本身不复杂，但需要加载 OpenAI 的词表文件（几 MB），且需要处理 Unicode、特殊 token 等边界情况。实现成本中等，但这是"算法层"不是"业务层" |
| **为什么不调 API** | 每次计数都调 API = 额外延迟 + 额外成本。上下文管道每轮循环都要计数，必须本地化 |

#### 3. minisearch（BM25 全文检索）

| 维度 | 内容 |
|------|------|
| **解决的问题** | L5 兜底层：当上下文溢出时，归档的历史消息需要能被检索恢复 |
| **为什么选它** | 纯 JS 实现，零外部依赖，轻量（< 20KB），支持 BM25 评分 |
| **本质原理** | BM25（Best Matching 25）是信息检索的经典算法。核心思想：词频（TF）× 逆文档频率（IDF）× 文档长度归一化。比简单的关键词匹配更准确，比向量检索更轻量（不需要 embedding 模型） |
| **为什么不用向量检索** | 向量检索需要 embedding 模型（额外 API 调用或本地模型），增加部署复杂度。BM25 对关键词检索场景够用，且零额外依赖。架构上 L5 层可替换，未来需要时换成向量检索不改上层代码 |
| **为什么不自己写** | BM25 算法本身简单（几十行），但 minisearch 还提供了倒排索引、模糊匹配、前缀搜索等能力，且经过性能优化。投入产出比不高 |

### @mako-agent/tools 的依赖

#### 4. fast-glob（文件搜索）

| 维度 | 内容 |
|------|------|
| **解决的问题** | search 工具需要在项目中快速搜索文件（glob 模式匹配） |
| **为什么选它** | 高性能 glob 实现，支持 ignore 模式、并发遍历、符号链接处理 |
| **本质原理** | 文件系统遍历 + glob 模式匹配（`*`/`**`/`?` 等通配符转正则）。性能关键：并发 readdir + 提前剪枝（不进入被 ignore 的目录） |
| **为什么不自己写** | Node.js 原生 `fs.glob`（Node 22+）已经可用，但 fast-glob 更成熟、跨平台兼容性更好、支持 .gitignore 模式。未来可能迁移到原生实现 |

### @mako-agent/mcp 的依赖

#### 5. @modelcontextprotocol/sdk（MCP 协议）

| 维度 | 内容 |
|------|------|
| **解决的问题** | 连接外部 MCP Server，动态发现和调用外部工具 |
| **为什么选它** | Anthropic 官方 SDK，MCP 协议的标准实现 |
| **本质原理** | MCP 是 Agent 和外部工具服务器之间的通信协议。底层是 JSON-RPC over stdio（标准输入输出）。SDK 封装了：进程管理（spawn/kill）、消息序列化/反序列化、工具发现（list_tools）、工具调用（call_tool） |
| **为什么不自己写** | MCP 协议规范复杂（JSON-RPC + 能力协商 + 生命周期管理），且协议还在演进中。用官方 SDK 能跟上协议更新，自己实现维护成本太高 |

### @mako-agent/cli 的依赖

#### 6. chalk（终端颜色）

| 维度 | 内容 |
|------|------|
| **解决的问题** | 终端输出着色（区分 Agent 回答、工具调用、错误信息） |
| **本质原理** | ANSI 转义序列。`\x1b[32m` = 绿色，`\x1b[0m` = 重置。chalk 封装了这些转义码，提供链式 API |
| **为什么不自己写** | 可以自己写（就是拼接 ANSI 码），但 chalk 还处理了终端能力检测（是否支持颜色、256 色 vs TrueColor）。几 KB 的库，不值得自己维护 |

#### 7. ora（加载动画）

| 维度 | 内容 |
|------|------|
| **解决的问题** | LLM 思考时显示 spinner 动画，提升用户体验 |
| **本质原理** | setInterval 定时刷新终端光标位置 + 循环显示动画帧字符（⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏）。用 `\r` 回到行首覆盖上一帧 |
| **为什么不自己写** | 可以自己写（20 行代码），但 ora 还处理了 CI 环境检测、Windows 兼容、流式输出冲突等边界情况 |

### 选型总结

```
核心原则：
├── 协议层（LLM 通信、MCP 协议）→ 用官方 SDK（实现成本高 + 协议会演进）
├── 算法层（BPE tokenizer、BM25 检索）→ 用成熟库（算法正确性 > 自己造轮子）
├── 工具层（glob、颜色、动画）→ 用轻量库（几 KB，不值得自己维护）
└── 业务层（Agent 循环、上下文管道、安全确认）→ 自己实现（核心竞争力）
```

> **判断标准：这个东西是"核心业务逻辑"还是"基础设施"？核心业务自己写，基础设施用库。**

---

## 八、Mako 进化路线：从当前到工业级

> 不用框架不代表永远不引入新依赖。随着复杂度增长，该引入的引入——但引入的是**专项工具**，不是**通用框架**。

### 当前状态（v0.1）→ 已具备

- [x] ReAct 循环引擎
- [x] 5 层上下文管道
- [x] 工具注册 + 安全确认
- [x] 流式输出 + AsyncGenerator 双向通信
- [x] MCP 协议集成
- [x] Steering + Skills

### 进化到工业级需要补什么？

| 能力 | 当前状态 | 工业级标准 | 需要引入什么 |
|------|---------|-----------|-------------|
| **沙箱执行** | 无隔离 | Docker / VM / OS 沙箱 | `dockerode`（Docker SDK）或 OS 级沙箱 |
| **并发工具执行** | 串行 | 并发 + 读写锁 | 自实现（不需要库） |
| **取消机制** | 基础 | 3 层 AbortController 级联 | 自实现（Node.js 原生 AbortController） |
| **权限模型** | y/n/a | 5 层分级权限 | 自实现（业务强相关），详见 [security-roadmap.md](./security-roadmap.md) |
| **Prompt Cache** | 无 | 静态/动态分离，cache-friendly | 自实现 + Anthropic API cache 参数 |
| **多 Agent** | 无 | Coordinator + 隔离 + cache 共享 | 自实现（不需要 CrewAI） |
| **可观测性** | 基础 Trace | 结构化 Trace + 成本 + 归因 | `pino`（日志）或自实现 |
| **终端 UI** | readline + chalk | React/Ink 组件化 | `ink`（React for CLI） |
| **测试** | vitest 单元测试 | + Property-based + E2E | `fast-check`（已有）+ E2E 框架 |

### 关键原则

> **引入专项工具（dockerode、ink、pino），不引入通用框架（LangChain、LangGraph）。**
>
> 类比：你需要一把螺丝刀，就买一把螺丝刀。不需要买一整套瑞士军刀然后只用其中的螺丝刀。

### 从 Claude Code 学到的 11 个可迁移设计模式

（来源：Claude Code 源码逆向分析）

**Query Loop 相关**：
1. **乐观恢复（Optimistic Recovery）**：工具失败时先重试，不立即报错
2. **分层降级（Layered Degradation）**：重试 → 降级 → 摘要 → 归档
3. **状态机 + 转换日志**：Agent 状态可追溯、可回放
4. **读写锁并发**：只读工具并发执行，写入工具串行
5. **不可变配置快照**：每轮循环冻结配置，避免中途变更
6. **层级取消（Hierarchical Cancellation）**：3 层 AbortController 级联

**Multi-Agent 相关**：
7. **基于能力的安全（Capability-based Security）**：子 Agent 只能访问被授权的工具
8. **Cache-Friendly Forking**：fork 子 Agent 时共享 prompt cache
9. **确定性清理（Deterministic Cleanup）**：10 步 finally 清理流程
10. **星型拓扑编排**：Coordinator 统一调度，子 Agent 不直接通信
11. **单调权限收窄（Monotonic Permission Narrowing）**：子 Agent 权限只能比父 Agent 少

**这些模式都不需要框架，但需要精心设计和实现。这就是工业级和玩具的区别。**

---

## 九、Prep 话术

### 30 秒版

> "我没有用 LangChain 这类框架——事实上 Claude Code、Cursor、Aider、OpenHands 这些工业级 Agent 也都没用。因为 Coding Agent 的核心循环本身很简单，真正的难点在上下文精细管理、安全沙箱、并发控制、可观测性——这些通用框架帮不了。自己实现的好处是：极致轻量（核心只有 3 个依赖）、完全可控（每行代码都能 debug）、每个设计决策都能讲清楚为什么。"

### 追问：那什么时候该用框架？

> "两种场景：一是快速原型验证（10 分钟跑通一个 demo），二是复杂编排（多 Agent、多阶段、复杂分支跳转）。但 Mako 是生产级项目，需要精细控制每一个 token；而且当前是单 Agent ReAct 循环，流程简单，不需要 Graph 编排。"

### 追问：如果项目变复杂了呢？

> "架构已经预留了扩展点。如果未来需要多 Agent 协作，我会在 core 层加一个轻量的 Orchestrator，而不是引入整个 LangGraph。因为我只需要'调度'能力，不需要框架的全部抽象。微内核架构的好处就是——需要什么加什么，不需要的不引入。Claude Code 的多 Agent 就是这么做的——自实现 Coordinator 星型拓扑，不依赖任何框架。"

### 追问：怎么证明这不是玩具？

> "三个维度：一是架构对标工业级（5 层上下文管道、安全确认机制、MCP 协议集成）；二是有完整的工程实践（monorepo、TypeScript strict、vitest + property-based testing）；三是有可量化的评测（Benchmark 框架，能产出多模型对比报告）。玩具是'能跑'，工业级是'能跑 + 安全 + 可观测 + 可扩展 + 有评测'。"

### 追问：不用框架会不会重复造轮子？

> "要区分'轮子'和'框架'。我用了 openai SDK（LLM 通信）、gpt-tokenizer（token 计数）、MCP SDK（协议实现）——这些是专项工具，该用就用。我不用的是 LangChain 这种'全家桶框架'，因为它的抽象层解决的问题和我的核心问题不重合。类比：我用 React 写 UI，但不用 Create React App 脚手架——因为我需要精细控制构建配置。"

---

## 概念速查表

| 概念 | 一句话解释 |
|------|-----------|
| LangChain | 最流行的 LLM 应用框架，抽象多但重 |
| LangGraph | 用有向图编排 Agent 流程，适合复杂工作流 |
| CrewAI | 多 Agent 角色协作框架（Python） |
| AutoGen | 微软的多 Agent 对话框架（Python） |
| Vercel AI SDK | 前端 AI 集成 SDK（流式、React hooks） |
| Mastra | 新兴 TS-first Agent 框架 |
| OpenAI Agents SDK | OpenAI 官方轻量多 Agent 框架（Python） |
| LiteLLM | 轻量多模型适配层（不是 Agent 框架，只做 LLM 通信） |
| ReAct | Reasoning + Acting，思考-行动交替循环 |
| DAG | 有向无环图，LangGraph 的核心数据结构 |
| 微内核 | 核心只做调度，能力通过插件注入 |
| 背压 | 消费者慢时生产者自动暂停（AsyncGenerator 天然支持） |
| AbortController | Web/Node.js 标准取消机制，支持级联取消 |
| Seatbelt | macOS 内核级沙箱机制，Claude Code 用它限制文件访问 |
| Prompt Cache | LLM API 缓存静态 prompt 部分，减少重复计算成本 |
| Property-based Testing | 用随机输入自动发现边界 case（fast-check） |
| Source Map | JS 构建产物到源码的映射文件，Claude Code 因此泄露源码 |
| Coordinator | 多 Agent 中的调度者角色，星型拓扑的中心节点 |
| Feature Flag | 运行时开关，控制功能启用/禁用，Claude Code 工具系统用 18+ 个 |
