# 02 — 5 层上下文管道

> 源码：`packages/core/src/context/`

---

## 目录

- [前置理解：LLM 是无状态的](#前置理解llm-是无状态的)
- [一句话](#一句话)
- [架构总览（源码对应）](#架构总览源码对应)
- [三个时机](#三个时机)
- [逐层详解](#逐层详解)
  - [L1 截断](#l1-截断truncationlayer)
  - [L2 去重](#l2-去重deduplicationlayer)
  - [L3 微压缩](#l3-微压缩microcompressionlayer)
  - [L4 AI 摘要](#l4-ai-摘要autocompressionlayer)
  - [L5 归档 + 检索](#l5-归档--检索fallbacklayer--retrievallayer)
- [为什么分层？为什么不直接 RAG？](#为什么分层为什么不直接-rag)
- [面试话术](#面试话术)

---

## 前置理解：LLM 是无状态的

**LLM 本身是单轮的、无记忆的。** 每次调用都是独立的"输入 → 输出"。

所谓的"多轮对话"完全是框架层的工作——每次请求都把之前的所有 messages 重新发一遍：

```
第 1 轮：[system, user1]                                      → LLM → assistant1
第 2 轮：[system, user1, assistant1, user2]                    → LLM → assistant2
第 3 轮：[system, user1, assistant1, user2, assistant2, user3] → LLM → assistant3
```

LLM 每次都是"从头看一遍所有消息"然后生成回复。它不记得上一次调用。

**实际 messages 数组长什么样（Agent 第 2 轮时发给 LLM 的完整数据）**：

```json
[
  { "role": "system", "content": "你是 Mako，一个专业的 AI 编程助手..." },
  { "role": "user", "content": "帮我把 src/utils.ts 里的 getUserName 改成 getUsername" },
  { "role": "assistant", "content": null, "tool_calls": [
    { "id": "call_1", "name": "read_file", "arguments": { "path": "src/utils.ts" } }
  ]},
  { "role": "tool", "tool_call_id": "call_1", "content": "export function getUserName(id: string) {\n  return db.query(...);\n}\n// ...共 85 行" },
  { "role": "assistant", "content": null, "tool_calls": [
    { "id": "call_2", "name": "replace_in_file", "arguments": { "path": "src/utils.ts", "old": "getUserName", "new": "getUsername" } }
  ]},
  { "role": "tool", "tool_call_id": "call_2", "content": "已替换 3 处" },
  { "role": "assistant", "content": "已将 getUserName 改为 getUsername，共替换 3 处。要我跑一下测试验证吗？" },
  { "role": "user", "content": "跑下测试" }
]
```

这整个数组**每次都要全部发给 LLM**。随着对话进行，数组越来越长，token 越来越多，直到超出窗口限制。这就是为什么需要上下文管道来管理它。

**messages 是 Agent 的核心数据结构**，里面有 4 个 role：

| role | 谁产生的 | 含义 |
|------|---------|------|
| `system` | 开发者（你） | 给 LLM 的指令/规则（用户看不到） |
| `user` | 用户 | 用户说的话 |
| `assistant` | LLM | LLM 的回复（文本或 tool_calls 指令） |
| `tool` | Agent 框架 | 工具执行结果（框架执行后填入） |

**真正的参与者只有 2 个**：人（user）和 LLM（assistant）。`system` 是预设规则，`tool` 是框架代执行后填入的结果。

**Agent 不是 messages 里的角色**——Agent 是整个系统的编排者（导演），负责：组装 messages → 发给 LLM → 解析返回 → 执行工具 → 把结果加入 messages → 循环。messages 是"剧本"，LLM 和用户是"演员"。

**所以上下文管道的本质 = 管理这个 messages 数组。** 5 层管道的所有操作，都是在优化"每次发给 LLM 的 messages 数组"——让有限的窗口装下最有价值的信息。

---

## 一句话

上下文管道 = 解决"信息无限增长 vs 窗口有限"的矛盾。5 层递进防御，每层职责单一，渐进式压缩。

---

## 架构总览（源码对应）

```
ContextPipeline 类
├── ingressLayers（消息进入时处理）
│   ├── L1 TruncationLayer     — 截断过大的单条消息
│   └── L2 DeduplicationLayer  — 去重（SHA-256 hash）
├── egressLayers（组装发给 LLM 时处理）
│   └── L3 MicroCompressionLayer — 微压缩旧工具结果
└── compressionLayers（窗口快满时触发）
    ├── L4 AutoCompressionLayer — AI 摘要（80% 触发）
    └── L5 FallbackLayer        — 归档到磁盘 + BM25 索引（95% 触发）
        └── RetrievalLayer      — 从归档中检索回忆
```

---

## 三个时机

| 时机 | 触发什么 | 源码方法 |
|------|---------|---------|
| **消息进入时** | L1 截断 + L2 去重 | `addMessage()` → `runIngressAsync()` |
| **组装发 LLM 时** | L3 微压缩 | `assemble()` → egressLayers |
| **每轮循环开头** | L4 AI 摘要 + L5 归档 | `compressIfNeeded()` → compressionLayers |

---

## 逐层详解

### L1 截断（TruncationLayer）

**问题**：工具返回结果可能巨大（read_file 读了 5 万行）

**做法**：单条消息 token 数超过阈值 → 截断，保留前 N 行

**信息丢失怎么办**：LLM 后续可以再次调用工具读取特定行范围。用多次精确读取替代一次全量塞入。

**源码**：`layers/truncation-layer.ts`

---

### L2 去重（DeduplicationLayer）

**问题**：LLM 可能重复读同一个文件

**做法**：对工具结果算 SHA-256 hash，如果和之前某条相同 → 替换为存根（"[与消息 #12 相同，已去重]"）

**示例**：LLM 连续两次读同一个文件

```json
// 去重前的 messages（两份完整内容，浪费 token）：
[
  { "role": "tool", "tool_call_id": "call_1", "content": "export function add(a, b) {\n  return a + b;\n}\n// ...共 200 行" },
  // ...中间一些对话...
  { "role": "tool", "tool_call_id": "call_5", "content": "export function add(a, b) {\n  return a + b;\n}\n// ...共 200 行" }
]

// 去重后（第二条 hash 相同，替换为存根，省了 200 行的 token）：
[
  { "role": "tool", "tool_call_id": "call_1", "content": "export function add(a, b) {\n  return a + b;\n}\n// ...共 200 行" },
  // ...中间一些对话...
  { "role": "tool", "tool_call_id": "call_5", "content": "[与消息 #1 相同，已去重]" }
]
```

**确实优化窗口**：重复内容不再占 token

**源码**：`layers/deduplication-layer.ts`

---

### L3 微压缩（MicroCompressionLayer）

**问题**：旧的工具结果占空间，但 LLM 已经看过了、做过决策了

**做法**：把旧的（非当前轮的）工具结果从完整内容 → 替换为一行摘要

```
压缩前（500 token）：{ role: "tool", content: "import React from 'react';\n..." }
压缩后（30 token）：{ role: "tool", content: "[已读取 src/App.tsx，共 120 行]" }
```

**放在哪**：还在 messages 数组里（内存中），不落盘。只是替换 content。

**用什么工具**：纯规则式字符串替换，不调 LLM，零成本。

**源码**：`layers/micro-compression-layer.ts`

---

### L4 AI 摘要（AutoCompressionLayer）

**触发条件**：窗口使用率达到 80%

**做法**：调 LLM 对整段对话历史生成结构化摘要（9 维）

**9 维结构**：
1. 当前任务目标
2. 已完成步骤
3. 关键决策及理由
4. 待办事项
5. 重要文件路径
6. 遇到的问题
7. 用户偏好
8. 技术栈信息
9. 上下文关键变量

**和 L3 的区别**：

| | L3 微压缩 | L4 AI 摘要 |
|--|----------|-----------|
| 触发 | 每次 assemble | 窗口 80% |
| 方式 | 规则替换（不调 LLM） | 调 LLM 生成摘要 |
| 对象 | 只压旧工具结果 | 压缩整段对话 |
| 成本 | 零 | 一次 LLM 调用 |

**源码**：`layers/auto-compression-layer.ts`

---

### L5 归档 + 检索（FallbackLayer + RetrievalLayer）

**触发条件**：窗口使用率达到 95%（L4 压不动了）

**关于持久化**：在 L5 触发之前，messages 就是内存里的一个数组，进程退出就没了。只有 L5 触发时才会落盘。另外还有 Session save 机制（`context.save(sessionId)`）可以主动持久化整个 messages 到 `.mako/sessions/`，下次启动 `load()` 恢复。CLI 工具场景下大部分任务是一次性的，不需要跨 session 持久化，所以这是有意的简化设计。

**做法**：
1. 最旧的消息从 messages 数组中移除（内存释放）
2. 落盘到 JSON 文件（`.mako/sessions/` 目录，归档持久化）
3. 对归档内容建立 BM25 索引（用 MiniSearch 库）

**后续怎么检索**：
- `recall(query, topK)` 方法
- 用当前用户输入作为 query
- BM25 算法在归档中搜索相关消息
- 返回 topK 条最相关的历史消息
- 塞回 messages 让 LLM 能"回忆"

**keyword 是什么**：就是用户输入的自然语言，MiniSearch 会自动分词。比如用户说"之前改的那个文件"，分词后用 BM25 在归档中匹配。

**源码**：`layers/fallback-layer.ts` + `layers/retrieval-layer.ts`

---

## 为什么分层？为什么不直接 RAG？

**分层的好处**：
1. 每层职责单一，可独立开关
2. 渐进式——大部分情况 L1-L3 就够了（零成本），只有窗口快满才触发 L4-L5
3. 可测试——每层独立单测

**不用 RAG 的原因**：
1. 编码上下文时序性重要——第 3 轮的决策依赖第 2 轮的结果，向量检索丢时序
2. 需要额外 embedding 模型 + 向量库，Mako 是 client 端运行的，不能依赖外部服务
3. 代码场景下关键词检索够用（文件路径、函数名是精确匹配）
4. L5 的 BM25 只是兜底层，不是主力——大部分情况 L1-L4 就解决了

---

## 面试话术

> "Mako 的上下文管道分 5 层，按三个时机触发：消息进入时做截断和去重（L1-L2，零成本）；组装发 LLM 时做微压缩（L3，规则替换旧工具结果）；每轮循环开头检查窗口使用率——80% 触发 AI 摘要（L4，调 LLM 生成 9 维结构化摘要），95% 触发归档（L5，落盘 + BM25 索引，后续可检索回忆）。渐进式设计，大部分情况前三层就够了。"
