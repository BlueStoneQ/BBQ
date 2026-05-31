# LangGraph 第一性原理理解

> 从 Mako 的视角理解 LangGraph：它在 LangChain 之上解决了什么问题、核心模型是什么、和我们的 while 循环有什么本质区别。

---

## 目录

- [一句话本质](#一句话本质)
- [和 LangChain 的关系](#和-langchain-的关系)
- [核心模型：有向图（Graph）](#核心模型有向图graph)
- [核心概念](#核心概念)
- [典型流程图示](#典型流程图示)
- [代码示例](#代码示例)
- [vs Mako 的 while 循环](#vs-mako-的-while-循环)
- [什么时候需要 LangGraph](#什么时候需要-langgraph)
- [面试话术](#面试话术)
- [📎 关联文档](#-关联文档)

---

## 一句话本质

**LangGraph 是一个用有向图（DAG/有环图）来编排 Agent 执行流程的框架——节点是步骤，边是条件跳转，状态在节点间流转。**

类比：
- LangChain Chain = 流水线（A → B → C，线性，不能回头）
- LangGraph = 状态机 / 流程图（可以分支、循环、并行、回退）
- Mako = while 循环（最简单的"图"——只有一个环）

---

## 和 LangChain 的关系

```
┌─────────────────────────────────────┐
│         LangGraph（编排层）           │  ← 决定"按什么顺序执行"
│  Graph / Node / Edge / State         │
├─────────────────────────────────────┤
│         LangChain（零件层）           │  ← 提供"每一步怎么执行"
│  LLM / Tool / Memory / Retriever    │
└─────────────────────────────────────┘
```

| 维度 | LangChain | LangGraph |
|------|-----------|-----------|
| 层次 | 底层零件库 | 上层编排引擎 |
| 核心抽象 | Chain（线性流水线） | Graph（有向图） |
| 控制流 | 只能顺序执行 | 支持分支、循环、并行、条件跳转 |
| 状态管理 | 简单（Memory） | 显式状态对象，节点间传递 |
| 依赖关系 | 独立 | 依赖 LangChain 的零件 |
| 适合场景 | 简单 RAG、线性 Chain | 复杂 Agent、多步骤、人工介入 |

**不是替代关系**：LangGraph 底层还是用 LangChain 的 LLM/Tool/Memory，只是用图来编排它们。

---

## 核心模型：有向图（Graph）

**第一性原理**：任何复杂流程都可以用图来描述——节点是"做什么"，边是"什么条件下去哪"。

```
传统编程的 if/else/while → 本质就是控制流图
LangGraph → 把 Agent 的控制流显式地用图来表达
```

**为什么用图而不是代码里的 if/else？**
1. **可视化**：图可以直接画出来，流程一目了然
2. **可配置**：改流程不需要改代码逻辑，改图的连接方式就行
3. **可持久化**：图的状态可以存下来，中断后恢复（长时间任务、人工审批）
4. **可观测**：每个节点的输入输出都可以追踪

---

## 核心概念

### 1. State（状态）

**本质**：在节点间流转的数据对象。每个节点读取状态、修改状态、传给下一个节点。

```python
from typing import TypedDict, Annotated

class AgentState(TypedDict):
    messages: list          # 对话历史
    current_plan: str       # 当前计划
    tool_results: list      # 工具执行结果
    iteration: int          # 当前轮次
```

**类比 Mako**：就是 Mako 的 `context`（messages 数组 + 各种中间状态），只是 LangGraph 把它显式定义成一个类型。

### 2. Node（节点）

**本质**：一个函数，接收 State，返回修改后的 State。

```python
def think_node(state: AgentState) -> AgentState:
    """思考节点：调用 LLM 决定下一步"""
    response = llm.invoke(state["messages"])
    return {"messages": state["messages"] + [response]}

def act_node(state: AgentState) -> AgentState:
    """行动节点：执行工具"""
    tool_call = state["messages"][-1].tool_calls[0]
    result = execute_tool(tool_call)
    return {"tool_results": [result]}
```

**类比 Mako**：Mako 的 while 循环里的每一个 `if` 分支就是一个"节点"——只是没有显式拆出来。

### 3. Edge（边）

**本质**：节点之间的连接，决定"从 A 执行完后去哪"。

```python
# 无条件边：A 执行完一定去 B
graph.add_edge("think", "act")

# 条件边：根据状态决定去哪
graph.add_conditional_edges(
    "act",
    should_continue,  # 判断函数
    {
        "continue": "think",  # 继续循环
        "end": END            # 结束
    }
)
```

**类比 Mako**：Mako 的 `if (response.type === 'text') return` 就是一条"条件边"——只是写在 while 循环里。

### 4. Graph（图）

**本质**：把 Node + Edge 组装起来的完整流程。

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(AgentState)

# 添加节点
graph.add_node("think", think_node)
graph.add_node("act", act_node)

# 添加边
graph.set_entry_point("think")
graph.add_conditional_edges("think", route_decision, {
    "use_tool": "act",
    "final_answer": END
})
graph.add_edge("act", "think")  # 执行完工具回到思考

# 编译
app = graph.compile()
```

---

## 典型流程图示

### 简单 ReAct（和 Mako 等价）

```
        ┌──────────┐
        │  think   │ ← LLM 决策
        └────┬─────┘
             │
     ┌───────┴───────┐
     │ tool_call?    │
     ├── Yes ────────┤
     │               ↓
     │         ┌──────────┐
     │         │   act    │ ← 执行工具
     │         └────┬─────┘
     │              │
     │              └──→ 回到 think
     │
     └── No（纯文本）──→ END
```

### 复杂流程（LangGraph 的优势场景）

```
        ┌──────────┐
        │   plan   │ ← 规划任务
        └────┬─────┘
             │
        ┌────▼─────┐
        │ execute  │ ← 执行
        └────┬─────┘
             │
     ┌───────┴───────┐
     │  成功？        │
     ├── No ─────────┤
     │    (重试<3次)  │──→ 回到 execute
     │    (重试≥3次)  │──→ 回到 plan（重新规划）
     │               │
     └── Yes ────────┤
                     ↓
        ┌──────────┐
        │  review  │ ← 人工审批（可以暂停等待）
        └────┬─────┘
             │
     ┌───────┴───────┐
     │  通过？        │
     ├── No ─────────→ 回到 plan
     └── Yes ────────→ END
```

这种"重试 + 回退 + 人工介入"的流程，用 while 循环写会很丑，用图表达很自然。

---

## 代码示例

### 完整的 ReAct Agent（LangGraph 版）

```python
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# 1. 定义状态
class AgentState(TypedDict):
    messages: list

# 2. 定义节点
llm = ChatOpenAI(model="gpt-4", tools=tools)

def call_model(state: AgentState):
    response = llm.invoke(state["messages"])
    return {"messages": state["messages"] + [response]}

def call_tool(state: AgentState):
    last_message = state["messages"][-1]
    tool_call = last_message.tool_calls[0]
    result = execute_tool(tool_call)
    return {"messages": state["messages"] + [result]}

# 3. 定义路由（条件边）
def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "use_tool"
    return "end"

# 4. 组装图
graph = StateGraph(AgentState)
graph.add_node("agent", call_model)
graph.add_node("tool", call_tool)
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_continue, {
    "use_tool": "tool",
    "end": END
})
graph.add_edge("tool", "agent")  # 工具执行完回到 agent

# 5. 编译并运行
app = graph.compile()
result = app.invoke({"messages": [HumanMessage(content="帮我查天气")]})
```

---

## vs Mako 的 while 循环

| 维度 | LangGraph（图） | Mako（while 循环） |
|------|----------------|-------------------|
| 表达方式 | 显式图结构（节点+边） | 隐式控制流（if/else in while） |
| 复杂分支 | 天然支持（条件边） | 需要嵌套 if/else，复杂时难维护 |
| 可视化 | 图可以直接渲染成流程图 | 需要额外画图 |
| 状态持久化 | 内置（checkpoint），支持中断恢复 | 需要自己实现 |
| 人工介入 | 内置（interrupt_before/after） | 需要 AsyncGenerator yield 确认 |
| 并行执行 | 内置（多个节点并行） | 需要 Promise.all |
| 调试 | 每个节点输入输出可追踪 | 需要自己加日志 |
| 代码量 | 多（定义图结构的样板代码） | 少（就是一个 while） |
| 认知负担 | 高（需要理解图的概念） | 低（谁都看得懂 while） |
| 适合场景 | 多 Agent 协作、审批流、复杂分支 | 单 Agent 线性任务（Coding） |

### 本质区别

```
Mako 的 while 循环 = 最简单的图（只有一个环：think → act → think → ...）
LangGraph = 通用图（任意拓扑：分支、并行、多环、子图）
```

**Mako 不需要 LangGraph 的原因**：Coding Agent 的流程就是一个简单的环——思考→行动→观察→循环。不需要复杂分支、不需要人工审批节点、不需要多 Agent 并行。用 while 循环表达最直接、最轻量。

---

## 什么时候需要 LangGraph

| 场景 | 用 while 循环够吗 | 需要 LangGraph 吗 |
|------|-----------------|------------------|
| 单 Agent 写代码 | ✅ 够 | ❌ 过度设计 |
| RAG 问答（检索→生成） | ✅ 够（甚至不需要循环） | ❌ |
| 多步骤 + 条件重试 | 勉强 | ✅ 更清晰 |
| 人工审批介入 | 需要额外机制 | ✅ 内置 |
| 多 Agent 协作 | 很难 | ✅ 天然支持 |
| 长时间任务（跨天） | 需要自己做持久化 | ✅ 内置 checkpoint |

---

## 面试话术

### Q: "LangGraph 和 LangChain 什么关系？"

> "LangChain 是零件层——提供 LLM 封装、Tool、Memory、Retriever 这些基础能力。LangGraph 是编排层——用有向图来组织这些零件的执行顺序，支持分支、循环、并行、人工介入。LangGraph 依赖 LangChain 的零件，不是替代关系，是上下层关系。"

### Q: "为什么 Mako 不用 LangGraph？"

> "Coding Agent 的流程本质就是一个简单的环——思考→行动→观察→循环。这用一个 while 循环就能完美表达，代码量少、认知负担低、调试直接。LangGraph 的图编排适合复杂场景——多 Agent 协作、条件重试、人工审批、长时间任务。对单 Agent 线性任务来说是过度设计。"

### Q: "什么场景下你会选 LangGraph？"

> "如果我要做一个多步骤的工作流产品——比如 AI 辅助代码审查系统：Agent A 分析代码 → Agent B 写 review 意见 → 人工确认 → 通过则提交，不通过则回到 Agent A 重新分析。这种有分支、有人工介入、有回退的流程，用 LangGraph 表达最自然。"

---

## 📎 关联文档

- [LangChain 第一性原理理解](./langchain-understanding.md)
- [Mako Deep Dive - 设计决策](./mako/mako-project-deep-dive.md#设计决策为什么不用-langchain--langgraph)
- [AI Agent 核心概念](./ai-agent-core-concepts.md)
