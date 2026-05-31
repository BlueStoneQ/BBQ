# Mako 速查手册

> 面试前 5 分钟快速回忆 Mako 的核心部件、依赖、设计决策。

---

## 目录

- [一句话定位](#一句话定位)
- [核心部件总览](#核心部件总览)
- [依赖（极简）](#依赖极简)
- [minisearch + BM25 详解](#minisearch--bm25-详解)
- [为什么不用 LangChain？（Client vs Server）](#为什么不用-langchainclient-vs-server)
- [Trace 模块](#trace-模块)
- [结合 JY JD 的考点映射](#结合-jy-jd-的考点映射)
- [📎 关联文档](#-关联文档)

---

## 一句话定位

**Mako 是一个从零实现的 Client 端 AI Coding Agent 框架。核心是 ReAct 循环引擎 + 5 层上下文管道 + 微内核插件架构，能让任意 LLM 通过工具调用自主完成编码任务。**

---

## 核心部件总览

```
packages/
├── core/    → Agent 引擎（零 IO 依赖，纯逻辑）
├── tools/   → 内置 7 个工具
├── mcp/     → MCP 客户端（外部工具协议）
└── cli/     → 终端交互（流式输出、确认）
```

| 部件 | 职责 | 一句话本质 |
|------|------|-----------|
| **Agent Core** | ReAct 循环 | while + LLM + 工具，直到任务完成 |
| **ContextPipeline** | 上下文管理 | 5 层防御管道，有限窗口支撑无限对话 |
| **LLM Adapter** | 模型适配 | 一套接口适配所有 OpenAI 兼容模型 |
| **Tool Registry** | 工具注册 | 统一接口 + JSON Schema，LLM "点菜" Agent "上菜" |
| **MCP Client** | 外部工具协议 | 连接任意 MCP Server，动态发现工具 |
| **Steering** | 项目级规则 | `.mako/steering.md` 自动注入 System Prompt |
| **Skills** | 可插拔专家角色 | 关键词触发 + 指令注入 + 工具白名单 |
| **Trace** | 执行追踪 | 每步记录，事后回放分析，白盒化 Agent |

**内置工具（7 个）**：`read_file` / `write_file` / `replace_in_file` / `list_directory` / `bash` / `search` / `fetch_url`

---

## 依赖（极简）

### 生产依赖（仅 3 个）

| 依赖 | 用途 | 为什么选它 |
|------|------|-----------|
| `openai` | LLM API 调用 | 官方 SDK，类型完善，所有 OpenAI 兼容模型都能用 |
| `gpt-tokenizer` | 本地 token 计数 | 不依赖 API，本地计算，判断上下文是否超限 |
| `minisearch` | BM25 关键词检索 | 轻量零依赖，用于 L5 兜底层历史消息检索 |

### 开发依赖

| 依赖 | 用途 |
|------|------|
| `tsup`（esbuild） | 构建，ESM 输出，快 |
| `vitest` | 测试，ESM 原生支持 |
| `typescript` | 类型系统 |
| `pnpm` | 包管理（monorepo workspace） |

### 为什么这么少？

刻意的设计决策：
- Agent 循环本身很简单（while + LLM + 工具），不需要框架帮你写循环
- 真正的难点（上下文管理、安全确认、流式双向通信）都是业务强相关的，通用框架帮不了
- 少依赖 = 轻量（核心 < 40KB）+ 可控 + 调试直接 + 无供应链风险

---

## minisearch + BM25 详解

### 解决什么问题？

**场景**：上下文达到 95% 窗口上限，必须腾空间。最旧的消息被归档到磁盘（JSON 文件）。但后续 LLM 可能需要回忆早期的信息（"我之前让你改的那个文件叫什么？"）。

**问题**：归档的消息不在上下文里了，LLM 看不到。怎么在需要时找回来？

### BM25 是什么？

**BM25（Best Matching 25）**：一种经典的关键词检索算法。给定一个查询词，在一堆文档里找出最相关的。

**本质**：TF-IDF 的改进版。核心思想——一个词在某篇文档里出现得越多（TF），同时在其他文档里出现得越少（IDF），这篇文档就越相关。

**类比**：Google 搜索的早期核心算法就是这个思路。

### 为什么用 BM25 而不是向量检索？

| 对比 | BM25（minisearch） | 向量检索（Embedding） |
|------|-------------------|---------------------|
| 依赖 | 零依赖，纯 JS，本地跑 | 需要 Embedding API + 向量数据库 |
| 部署 | 无需额外服务 | 需要向量数据库服务 |
| 适合场景 | 代码/技术文本（关键词明确） | 自然语言（语义模糊） |
| 精度 | 关键词匹配精确 | 语义理解更好 |
| 成本 | 免费，本地计算 | 每次检索要调 API |

**Mako 选 BM25 的原因**：
1. Client 端运行，不能依赖外部服务
2. 代码场景下关键词检索够用（"src/index.ts" 这种精确匹配）
3. 零依赖，minisearch 只有几 KB
4. 这只是 L5 兜底层，不是主力检索——大部分情况 L1-L4 就解决了

### minisearch 怎么用？

```typescript
import MiniSearch from 'minisearch';

// 建立索引（归档消息时）
const index = new MiniSearch({
  fields: ['content'],  // 对 content 字段建索引
  storeFields: ['content', 'role', 'timestamp']
});

// 归档的消息加入索引
index.addAll(archivedMessages.map((msg, id) => ({ id, ...msg })));

// 检索（LLM 需要回忆时）
const results = index.search('src/index.ts 修改');
// → 返回最相关的归档消息，恢复到上下文中
```

---

## 为什么不用 LangChain？（Client vs Server）

### 本质原因：运行环境不同

```
LangChain → 服务端框架（Python/Node.js 后端）
Mako → Client 端框架（跑在用户电脑上的 CLI）
```

| 维度 | LangChain（服务端） | Mako（Client 端） |
|------|-------------------|------------------|
| 运行位置 | 服务器 | 用户本地电脑 |
| 典型产品 | 智能客服、知识库问答 Web 应用 | AI 写代码的 CLI 工具 |
| 数据源 | 向量数据库、企业知识库 | 本地文件系统 |
| 检索方式 | Embedding + 向量检索 | `read_file` / `grep_search` 工具 |
| 用户交互 | Web UI（浏览器） | 终端（stdin/stdout） |
| 部署 | 服务器 + 数据库 + API | `npm install -g` 就能用 |

### 不是"用不了"，是"不适合"

技术上你可以在 CLI 里引入 LangChain，但：
1. **太重** — LangChain 几十个依赖包，Mako 只要 3 个
2. **抽象层多** — 调试时要翻框架源码，堆栈深
3. **不专注 Coding** — LangChain 的 Memory/Retriever 是为知识库问答设计的，不是为代码编辑设计的
4. **TS 版功能滞后** — LangChain 主力是 Python，JS/TS 版是二等公民
5. **核心逻辑太简单** — Agent 循环就是一个 while，不需要框架帮你写

### 一句话

> LangChain 解决的是"怎么快速搭一个 AI 应用后端"，Mako 解决的是"怎么让 AI 在本地自主写代码"。场景不同，技术选型自然不同。

---

## Trace 模块

### 解决什么问题？

Agent 是黑盒——你不知道它为什么做了某个决策、为什么失败了、哪一步出了问题。

### 本质

**执行追踪 = 白盒化 Agent 行为。** 记录每一步的决策过程，事后可回放分析。

### 记录什么？

```json
{
  "sessionId": "xxx",
  "startTime": "2026-01-01T00:00:00Z",
  "endTime": "2026-01-01T00:00:15Z",
  "iterations": 5,
  "messages": [...],           // 完整对话历史
  "toolCalls": [
    { "name": "read_file", "args": {"path": "src/index.ts"}, "duration": 12, "success": true },
    { "name": "write_file", "args": {"path": "src/index.ts"}, "duration": 8, "success": true },
    { "name": "bash", "args": {"command": "npm test"}, "duration": 3200, "success": false }
  ],
  "tokenUsage": { "prompt": 12000, "completion": 3500, "total": 15500 },
  "model": "gpt-4o",
  "result": "success" | "failure" | "timeout"
}
```

### 存在哪？

`.mako/traces/trace_2026-05-13T07-15-36-873Z.json` — 每次会话自动生成一个 trace 文件。

### 怎么用？

```bash
mako trace  # 加载所有 trace → 统计分析 → 让 LLM 给出优化建议
```

**`mako trace` 做的事**：
1. 读取所有 trace 文件
2. 统计：成功率、平均轮次、token 消耗、最慢工具
3. 把统计结果喂给 LLM
4. LLM 分析模式，给出优化建议（"你的 bash 工具调用失败率 30%，建议..."）

### 价值

| 场景 | Trace 怎么帮你 |
|------|--------------|
| Agent 失败了 | 回放 trace，看哪一步决策错了 |
| 性能优化 | 看哪个工具最慢、哪个环节 token 消耗最大 |
| 模型对比 | 同一任务跑不同模型，对比 trace 结果 |
| 团队协作 | 分享 trace 文件，复现问题 |

### 类比

Trace 之于 Agent ≈ Chrome DevTools Performance 面板之于前端页面。都是把"黑盒过程"变成"可观测的时间线"。

---

## 结合 JY JD 的考点映射

| Mako 能力 | JD 考点 | 面试怎么讲 |
|-----------|---------|-----------|
| 全链路流式（SSE + AsyncGenerator） | "保障用户体验" | 四层流式架构 + rAF 渲染优化 |
| ReAct 循环 | "LangChain 等 Agent 方案" | while + 提示词工程，不是 LLM 能力是框架范式 |
| Tool Use + MCP | "Agent 方案有深入理解" | JSON Schema 点菜 + MCP 标准协议 |
| 5 层上下文管道 | "大模型工程化应用" | 分层递进解决无限对话 vs 有限窗口 |
| 微内核插件架构 | "封装组件、沉淀文档、生产工具" | 万物皆插件，核心可嵌入 |
| Trace 可观测性 | "代码质量" | 白盒化 Agent，事后分析优化 |
| TypeScript + Monorepo | "代码质量" | 类型安全 + 分包 + 完整构建测试 |
| Electron（3d-editor） | "跨端容器（桌面）" | 主进程/渲染进程 + IPC |
| RN（XRN） | "跨端容器（移动）" | 多 Bundle + 热更新 |

---

## 📎 关联文档

- [Mako Deep Dive（技术蓝本）](./mako-project-deep-dive.md)
- [5 层上下文管理设计](./mako-context-pipeline.md)（待创建）
- [AI Agent 概念解释（面试追问）](../../resume/explain/ai-agent.md)
- [LangChain 理解](../langchain-understanding.md)
- [JY prep 清单](../../interview/jieyue/prep.md)
