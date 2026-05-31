# LangChain 第一性原理理解

> 不是教程，是从 Mako 的视角理解 LangChain 在做什么、为什么这么做、和我们的对应关系。

---

## 一句话本质

**LangChain 是一个服务端的"AI 应用胶水框架"——把 LLM 调用、RAG 检索、Agent 循环、记忆管理这些零件用统一的接口串起来，让你能快速搭建 AI 应用的后端。**

类比：LangChain 之于 AI 应用 ≈ Express 之于 Web 应用。Express 帮你把路由、中间件、请求响应串起来；LangChain 帮你把 LLM、检索、工具、记忆串起来。

---

## 定位对比

| 维度 | LangChain | Mako |
|------|-----------|------|
| 定位 | 通用 AI 应用开发框架 | 专注 Coding 的 Agent 框架 |
| 跑在哪 | 服务端（Python/Node.js 后端） | 客户端（CLI / 本地） |
| 典型产品 | 智能客服、知识库问答、AI 搜索 | AI 写代码、自动修 bug |
| 核心场景 | RAG + 对话 + 工具调用 | ReAct + 文件操作 + 命令行 |
| 语言 | Python 为主，JS 版功能滞后 | TypeScript 原生 |

---

## 核心概念映射（LangChain → Mako）

| LangChain 概念 | 本质 | Mako 对应 | 解决什么问题 |
|---------------|------|-----------|-------------|
| **LLM / ChatModel** | LLM 调用的封装 | LLM Adapter | 统一不同模型的调用接口 |
| **Chain** | 多步调用的串联（A→B→C） | ReAct 循环中的单轮 | 把多个操作组合成流水线 |
| **Agent** | ReAct 循环（while + LLM + 工具） | Agent Core | 自主决策循环 |
| **Tool** | 工具定义（name + description + execute） | Tool Registry | 让 LLM 能调用外部能力 |
| **Memory** | 对话历史管理 | ContextPipeline | 跨轮次保留信息 |
| **Retriever** | 检索器（从知识库找相关内容） | `search` / `read_file` 工具 | 帮 LLM 获取它不知道的信息 |
| **VectorStore** | 向量数据库封装 | 无（用文件系统代替） | 存储和检索向量化的文档 |
| **Prompt Template** | Prompt 模板 | System Prompt + Steering | 结构化组装 LLM 输入 |
| **Output Parser** | 解析 LLM 输出为结构化数据 | tool_calls JSON 解析 | 把 LLM 的文本输出变成可执行指令 |
| **Callback** | 生命周期钩子 | AsyncGenerator yield 事件 | 可观测性、流式输出 |

---

## 核心部件深入

### 1. Chain（调用链）

**本质**：函数组合。把多个步骤串成一条流水线，上一步的输出是下一步的输入。

```python
# LangChain 的 Chain
chain = prompt_template | llm | output_parser
result = chain.invoke({"question": "什么是RAG？"})

# 等价于：
prompt = prompt_template.format(question="什么是RAG？")
llm_output = llm.invoke(prompt)
result = output_parser.parse(llm_output)
```

**底层原理**：就是函数式编程的 `compose` / `pipe`。没有魔法。

**Mako 为什么不需要 Chain？** — Mako 的场景是 ReAct 循环，每一步做什么由 LLM 动态决定，不是预定义的流水线。Chain 适合确定性流程（如 RAG：检索→拼接→生成），Agent 适合不确定性流程（如 Coding：读文件→改代码→跑测试→修bug）。

---

### 2. Agent（智能体）

**本质**：ReAct 循环。和 Mako 的 Agent Core 完全一样。

```python
# LangChain 的 Agent
agent = create_react_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)
result = agent_executor.invoke({"input": "帮我查天气"})

# 内部做的事情：
# while True:
#   response = llm(messages + tools)
#   if response.is_text: return response
#   if response.is_tool_call: execute(tool) → 结果塞回 messages
```

**和 Mako 的区别**：LangChain 用类继承 + 配置来组装 Agent；Mako 直接写 while 循环。本质逻辑完全一样。

---

### 3. Memory（记忆）

**本质**：管理对话历史，决定哪些信息保留在上下文里。

| LangChain Memory 类型 | 做什么 | Mako 对应 |
|----------------------|--------|-----------|
| BufferMemory | 保留所有历史 | messages 数组 |
| BufferWindowMemory | 只保留最近 N 轮 | 滑动窗口 |
| SummaryMemory | 用 LLM 压缩历史为摘要 | L4 自动压缩（9维结构化摘要） |
| VectorStoreMemory | 历史存入向量库，按相关性检索 | L5 BM25 检索 |

**Mako 的优势**：5 层管道比 LangChain 的单一 Memory 策略更精细——LangChain 你只能选一种 Memory，Mako 是分层递进、每层解决一类问题。

---

### 4. Retriever（检索器）

**本质**：给定一个 query，从知识库里找到最相关的 K 段文本。

```python
# LangChain 的 Retriever
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
docs = retriever.get_relevant_documents("退款政策是什么？")
# → 返回 3 段最相关的文档片段
```

**底层原理**：
1. query → Embedding API → 向量
2. 向量 → 向量数据库 → 余弦相似度 Top-K
3. 返回对应的文本片段

**Mako 为什么不用 Retriever？** — Coding Agent 用 `grep_search` / `read_file` 工具代替。代码是结构化的，关键词搜索比语义检索更精确；且代码变化太快，向量索引维护成本高。

---

### 5. VectorStore（向量数据库封装）

**本质**：对各种向量数据库的统一接口封装。

```python
# LangChain 统一接口，底层可以换不同的向量数据库
from langchain.vectorstores import Chroma  # 或 Pinecone / Milvus / pgvector

# 存入
vectorstore = Chroma.from_documents(documents, embedding_model)

# 检索
results = vectorstore.similarity_search("退款政策", k=3)
```

**支持的向量数据库**：Pinecone、Milvus、Chroma、pgvector、Weaviate、FAISS...

LangChain 的价值在于：你换向量数据库时不需要改业务代码，只换一行 import。

---

### 6. Prompt Template（提示词模板）

**本质**：字符串模板 + 变量填充。

```python
from langchain.prompts import ChatPromptTemplate

template = ChatPromptTemplate.from_messages([
    ("system", "你是一个{role}，基于以下资料回答：\n{context}"),
    ("human", "{question}")
])

prompt = template.format(role="客服", context="退款政策...", question="怎么退款？")
```

**Mako 对应**：System Prompt + Steering 文件。Mako 的 Steering 更灵活——它是 Markdown 文件，自动注入，不需要每次手动拼。

---

## LangChain 的 RAG 全流程

```python
from langchain.document_loaders import PDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain.chat_models import ChatOpenAI

# 1. 加载文档
docs = PDFLoader("company_policy.pdf").load()

# 2. 切分（Chunking）
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(docs)

# 3. 向量化 + 存储
vectorstore = Chroma.from_documents(chunks, OpenAIEmbeddings())

# 4. 创建 RAG 链
qa = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="gpt-4"),
    retriever=vectorstore.as_retriever(search_kwargs={"k": 3})
)

# 5. 用户提问
answer = qa.run("退款政策是什么？")
# 内部：问题→向量→检索3段→拼进prompt→LLM生成回答
```

**拆开看每一步在做什么**：

```
PDFLoader → 读取 PDF 文本
TextSplitter → 按 1000 token 切段（重叠 200 防止切断语义）
OpenAIEmbeddings → 每段文本调 Embedding API 转成向量
Chroma → 向量存入本地向量数据库
RetrievalQA → 串联：检索 + 拼 prompt + 调 LLM
```

---

## LangGraph（LangChain 的 Agent 升级版）

**本质**：用有向图（DAG）编排 Agent 流程。节点是步骤，边是条件跳转。

```python
# LangGraph 风格
graph = StateGraph(AgentState)
graph.add_node("think", think_fn)
graph.add_node("act", act_fn)
graph.add_node("observe", observe_fn)
graph.add_edge("think", "act", condition=has_tool_call)
graph.add_edge("act", "observe")
graph.add_edge("observe", "think")
```

**vs Mako 的 while 循环**：

| LangGraph | Mako |
|-----------|------|
| 图编排，适合复杂分支流程 | while 循环，适合线性 ReAct |
| 可视化好，流程清晰 | 代码简单，调试直接 |
| 适合多 Agent 协作、审批流 | 适合单 Agent 编码任务 |

**Mako 为什么不用 Graph？** — Coding Agent 的流程是线性的（思考→行动→观察→循环），不需要复杂分支。Graph 是过度设计。

---

## 面试话术

### Q: "你了解 LangChain 吗？"

> "了解它的架构和核心抽象。LangChain 本质是一个服务端的 AI 应用胶水框架，核心概念是 Chain（调用链）、Agent（ReAct 循环）、Tool（工具）、Memory（记忆）、Retriever（检索器）。
>
> 我在 Mako 里从零实现了这些概念的等价物——LLM Adapter 对应 ChatModel，Agent Core 对应 AgentExecutor，ContextPipeline 对应 Memory，Tool Registry 对应 Tool。
>
> 选择自己实现而不是用 LangChain 的原因：Coding Agent 场景下框架太重、TS 版功能滞后、核心逻辑本身很简单（while 循环 + 工具调用），自己实现更可控、更轻量、调试更直接。"

### Q: "LangChain 和你的 Mako 有什么区别？"

> "定位不同。LangChain 是通用 AI 应用框架，强项在 RAG 和多步 Chain 编排，适合知识库问答、智能客服这类产品。Mako 是专注 Coding 的 Agent 框架，强项在上下文管理和工具安全确认，适合 AI 写代码场景。
>
> 技术上，LangChain 用类继承 + 配置组装，抽象层多；Mako 直接写循环，一层到底。LangChain 的 Memory 是单一策略选择，Mako 是 5 层管道分层递进。"

### Q: "如果让你做一个知识库问答产品，你会怎么做？"

> "用 LangChain（或 LlamaIndex）+ 向量数据库的标准 RAG 方案：文档切分 → Embedding → 存入 Chroma/Pinecone → 用户提问时检索 Top-K → 拼进 prompt → LLM 生成回答。前端用 SSE 流式渲染。这是成熟方案，不需要重新造轮子。"

---

## 📎 关联文档

- [Mako Deep Dive - 设计决策：为什么不用 LangChain](./mako/mako-project-deep-dive.md#设计决策为什么不用-langchain--langgraph)
- [AI Agent 核心概念 - RAG](./ai-agent-core-concepts.md#21-rag检索增强生成)
