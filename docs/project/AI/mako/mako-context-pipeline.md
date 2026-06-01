# Mako 5 层上下文管理设计

> Agent 最核心的工程挑战：信息量无限增长 vs 模型窗口有限。这份文档从第一性原理出发，讲清楚每一层在做什么、为什么这么做。

---

## 目录

- [核心矛盾](#核心矛盾)
- [设计哲学：分层递进](#设计哲学分层递进)
- [架构总览](#架构总览)
- [L1：源头截断（Truncation）](#l1源头截断truncation)
- [L2：去重（Deduplication）](#l2去重deduplication)
- [L3：微压缩（Micro Compression）](#l3微压缩micro-compression)
- [L4：自动压缩（Auto Compression）](#l4自动压缩auto-compression)
- [L5：兜底 + 检索（Fallback + Retrieval）](#l5兜底--检索fallback--retrieval)
- [三条管道的执行时机](#三条管道的执行时机)
- [为什么不直接用 RAG？](#为什么不直接用-rag)
- [面试话术](#面试话术)
- [📎 关联文档](#-关联文档)

---

## 核心矛盾

```
真实编码会话：100+ 轮对话，每轮读写多个文件 → 可能产生数百万 token
模型窗口：128K token（GPT-4o）/ 200K（Claude）

矛盾：信息量无限增长 vs 窗口有限
```

**如果不管理**：超出窗口的内容直接被截断 → LLM 丢失关键上下文 → 做出错误决策 → Agent 失败。

**目标**：在有限窗口内，保留最有价值的信息，丢弃冗余信息，让 Agent 能持续工作。

---

## 设计哲学：分层递进

**不是一种方案解决所有问题，而是多层递进，每层解决一类问题。**

类比：网络安全的纵深防御（Defense in Depth）——防火墙挡不住的，IDS 挡；IDS 挡不住的，WAF 挡；WAF 挡不住的，应用层挡。

```
L1 解决：单条消息太大（一个文件 10MB）
L2 解决：重复内容浪费空间（同一文件读了 5 次）
L3 解决：旧的只读结果占空间（早期读的文件现在不需要了）
L4 解决：整体接近上限（需要压缩历史）
L5 解决：已经到极限了（必须腾空间，但还要能找回来）
```

每层独立、可开关、可配置。加新层不改已有代码。

---

## 架构总览

```
消息进入时（Ingress Pipeline）：
  用户/工具消息 → [L1 截断] → [L2 去重] → 存入 messages 数组

组装上下文时（Egress Pipeline）：
  messages 数组 → [L3 微压缩] → 输出给 LLM

压缩时（Compression Pipeline，按需触发）：
  tokenCount > 80% → [L4 自动压缩]
  tokenCount > 95% → [L5 兜底归档 + BM25 索引]
```

```
┌─────────────────────────────────────────────────────┐
│                    消息流入                           │
│  user msg / tool result / assistant msg              │
└──────────────────────┬──────────────────────────────┘
                       ↓
              ┌────────────────┐
              │  L1 源头截断    │  单条 > 50K？落盘 + 预览
              └────────┬───────┘
                       ↓
              ┌────────────────┐
              │  L2 去重       │  SHA-256 hash，内容没变？返回存根
              └────────┬───────┘
                       ↓
              ┌────────────────┐
              │  messages 存储  │  ← 消息在这里积累
              └────────┬───────┘
                       ↓ （组装时）
              ┌────────────────┐
              │  L3 微压缩     │  旧只读结果清理，写操作保留
              └────────┬───────┘
                       ↓
              ┌────────────────┐
              │  输出给 LLM    │
              └────────────────┘

              ┌────────────────┐
              │  L4 自动压缩   │  80% 触发，9 维结构化摘要
              └────────────────┘
              ┌────────────────┐
              │  L5 兜底归档   │  95% 触发，归档 + BM25 可检索
              └────────────────┘
```

---

## L1：源头截断（Truncation）

### 解决什么问题？

单个工具结果太大。比如用户让 Agent 读一个 10MB 的日志文件，这一条消息就能撑爆窗口。

### 怎么做？

```
工具返回结果
  ↓ 检查字符数
  > 50K 字符？
    ├── Yes → 完整内容保存到磁盘（.mako/overflow/xxx.txt）
    │         上下文只保留前 N 字符 + 提示："[内容已截断，完整内容在 xxx.txt]"
    └── No  → 正常存入上下文
```

### 关键设计

- **阈值**：50K 字符（约 25K-50K token，取决于语言）
- **落盘路径**：`.mako/overflow/` 目录
- **预览策略**：保留前 2000 字符 + 文件元信息（大小、行数）
- **可恢复**：LLM 如果需要完整内容，可以用 `read_file` 工具重新读取

### 本质

**源头控制**——问题在入口就解决，不让大数据进入上下文。类比：水坝在上游拦洪，不让洪水进入下游。

---

## L2：去重（Deduplication）

### 解决什么问题？

重复读取同一文件。Agent 在 ReAct 循环中可能多次读同一个文件（比如改了代码后再读一遍确认），如果文件内容没变，重复存储浪费空间。

### 怎么做？

```
工具返回文件内容
  ↓ 计算 SHA-256 hash
  ↓ 和上下文中已有的同路径文件 hash 对比
  相同？
    ├── Yes → 不存完整内容，只存存根：[unchanged: path=src/index.ts, hash=abc123]
    └── No  → 正常存入（内容变了，需要更新）
```

### 关键设计

- **hash 算法**：SHA-256（碰撞概率可忽略）
- **粒度**：按文件路径 + 内容 hash 去重
- **存根大小**：约 50 字符（vs 原文件可能几千字符）
- **LLM 能理解**：存根格式让 LLM 知道"这个文件我之前读过，内容没变"

### 本质

**信息论**——重复信息的信息量为零。去掉重复不丢失任何信息，只节省空间。

---

## L3：微压缩（Micro Compression）

### 解决什么问题？

旧的只读工具结果占空间。Agent 在第 3 轮读了一个文件，到了第 50 轮这个文件的内容可能已经不重要了（LLM 已经基于它做了决策）。但写操作的变更历史必须保留（LLM 需要知道"我改了什么"）。

### 怎么做？

```
组装上下文时（每次调 LLM 前）：
  遍历 messages
    ↓ 这条消息是工具结果？
    ↓ 是只读工具（read_file / list_directory / search）？
    ↓ 距离现在超过 N 轮？
      ├── Yes → 清理内容，只保留摘要：[read_file: src/index.ts, 150 lines]
      └── No  → 保留完整内容

  写操作（write_file / replace_in_file / bash）的结果 → 永远保留
```

### 关键设计

- **只读 vs 写入**：只读结果可清理，写入结果永远保留
- **时间窗口**：超过 N 轮（可配置，默认 10 轮）的只读结果才清理
- **保留摘要**：不是完全删除，保留元信息让 LLM 知道"我之前读过这个文件"
- **写操作为什么不清理**：LLM 需要知道完整的变更历史来做正确决策（"我之前把这个函数改成了什么"）

### 本质

**时间衰减**——越旧的只读信息价值越低（LLM 已经基于它做了决策），越新的信息价值越高。写操作是"状态变更记录"，永远有价值。

---

## L4：自动压缩（Auto Compression）

### 解决什么问题？

上下文接近 80% 窗口上限。前面的层只是"小修小补"，到了 80% 必须做一次"大手术"——把早期对话压缩成摘要。

### 怎么做？

```
每次组装上下文后检查 token 数
  tokenCount > 80% maxTokens？
    ├── Yes → 触发压缩
    │         1. 取出早期消息（保留最近 N 轮完整）
    │         2. 调用 LLM 生成 9 维结构化摘要
    │         3. 用摘要替换早期消息
    └── No  → 不压缩
```

### 9 维结构化摘要

不是简单地"总结对话"，而是让 LLM 按 9 个维度提取信息：

| 维度 | 提取什么 | 为什么重要 |
|------|---------|-----------|
| 1. 用户意图 | 用户最终想要什么 | Agent 不能偏离目标 |
| 2. 当前进度 | 做到哪一步了 | 避免重复工作 |
| 3. 关键决策 | 做了哪些重要选择 | 保持一致性 |
| 4. 代码变更记录 | 改了哪些文件的什么 | 最核心的状态 |
| 5. 文件结构 | 项目的目录结构 | 导航需要 |
| 6. 错误历史 | 遇到过什么错误 | 避免重蹈覆辙 |
| 7. 待办事项 | 还有什么没做 | 继续推进 |
| 8. 重要约束 | 用户提出的限制条件 | 不能违反 |
| 9. 原文引用 | 关键代码片段原文 | 精确信息不能丢 |

### 关键设计

- **触发阈值**：80%（留 20% 余量给后续对话）
- **保留最近 N 轮**：最近的对话不压缩（信息最新最重要）
- **压缩本身消耗 token**：需要调一次 LLM 来生成摘要，这是成本
- **摘要质量**：9 维结构化比"请总结以上对话"效果好得多（信息损失最小）

### 本质

**有损压缩**——用 LLM 的理解能力把冗长的对话压缩成结构化的关键信息。类似 JPEG 压缩图片——丢掉人眼不敏感的细节，保留关键特征。

---

## L5：兜底 + 检索（Fallback + Retrieval）

### 解决什么问题？

上下文达到 95%，L4 压缩后还是不够。必须强制腾空间，但归档的信息后续可能还需要。

### 怎么做？

```
tokenCount > 95% maxTokens？
  ├── Yes → 强制归档
  │         1. 最旧的消息移出上下文
  │         2. 保存到磁盘（.mako/archive/session_xxx.json）
  │         3. 对归档内容建立 BM25 索引（minisearch）
  │         4. 上下文中留一条提示：[N 条早期消息已归档，可通过关键词检索恢复]
  └── No  → 不归档
```

### 检索恢复

```
后续 LLM 需要回忆早期信息时：
  1. LLM 输出类似 "我需要查看之前关于 xxx 的讨论"
  2. Agent 用关键词查询 BM25 索引
  3. 找到相关的归档消息
  4. 恢复到当前上下文中
  5. 继续对话
```

### 关键设计

- **触发阈值**：95%（最后的防线）
- **归档策略**：最旧的先归档（FIFO）
- **索引工具**：minisearch（BM25 算法，零依赖，本地运行）
- **可恢复**：归档不是删除，是"移到仓库"，需要时能找回来
- **索引持久化**：索引随归档文件一起保存，下次会话可复用

### 本质

**冷热分离**——热数据（最近的对话）留在上下文，冷数据（早期的对话）移到磁盘。需要时通过检索"加热"回来。类比：内存 vs 磁盘，L1 Cache vs 主存。

---

## 三条管道的执行时机

| 管道 | 触发时机 | 包含哪些层 |
|------|---------|-----------|
| **Ingress**（入口） | 每条消息进入时 | L1 截断 → L2 去重 |
| **Egress**（出口） | 每次组装上下文给 LLM 时 | L3 微压缩 |
| **Compression**（压缩） | token 超阈值时 | L4 自动压缩 / L5 兜底归档 |

```typescript
// 伪代码
class ContextPipeline {
  // Ingress：消息进入
  addMessage(msg: Message) {
    msg = this.L1_truncate(msg);      // 大消息截断
    msg = this.L2_deduplicate(msg);   // 重复内容去重
    this.messages.push(msg);
  }

  // Egress：组装输出
  assemble(): Message[] {
    const msgs = this.L3_microCompress(this.messages);  // 旧只读结果清理
    return [this.systemPrompt, ...msgs];
  }

  // Compression：按需压缩
  async compressIfNeeded() {
    const tokenCount = this.countTokens();
    if (tokenCount > this.maxTokens * 0.95) {
      await this.L5_archive();        // 兜底归档
    } else if (tokenCount > this.maxTokens * 0.80) {
      await this.L4_summarize();      // 自动压缩
    }
  }
}
```

---

## 为什么不直接用 RAG？

| 维度 | 传统 RAG | Mako 5 层管道 |
|------|---------|--------------|
| 适合场景 | 静态知识库（文档不常变） | 动态对话（每轮都在变） |
| 时序性 | 向量检索丢失时序 | 管道保留时序（"我先做了A再做了B"） |
| 部署复杂度 | 需要 Embedding API + 向量数据库 | 纯本地，零外部依赖 |
| 检索精度 | 语义检索（可能不精确） | L5 用 BM25 关键词检索（代码场景更精确） |
| 实时性 | 需要预先向量化 | 实时处理，无预处理 |

**核心区别**：RAG 解决的是"LLM 不知道的外部知识"，上下文管理解决的是"LLM 对话过程中产生的信息太多装不下"。问题不同，方案不同。

---

## 面试话术

### 30 秒版

> "Mako 的上下文管理是一个 5 层防御管道。L1 源头截断大消息，L2 SHA-256 去重，L3 清理旧的只读结果，L4 在 80% 时用 LLM 生成 9 维结构化摘要，L5 在 95% 时归档到磁盘并建 BM25 索引可检索恢复。每层解决一类问题，分层递进，类似网络安全的纵深防御。"

### 追问：为什么不用 RAG？

> "两个原因：1）编码上下文的时序性很重要——'我先改了A再改了B'这个顺序不能丢，向量检索丢失时序；2）Client 端运行，不能依赖外部 Embedding API 和向量数据库。所以我用渐进式方案——轻量手段（截断、去重、压缩）解决 80% 的问题，只在最后兜底层用 BM25 关键词检索。"

### 追问：9 维摘要是什么？

> "L4 压缩时，不是简单地'总结对话'，而是让 LLM 按 9 个维度提取信息：用户意图、当前进度、关键决策、代码变更记录、文件结构、错误历史、待办事项、重要约束、原文引用。这样压缩后信息损失最小——每个维度都是 Agent 继续工作必需的信息。"

---

## 📎 关联文档

- [Mako Deep Dive - 上下文管道章节](./mako-project-deep-dive.md#核心机制-25-层上下文管道contextpipeline)
- [Mako 速查手册](./mako-cheatsheet.md)
- [AI Agent 概念 - Memory](../ai-agent-core-concepts.md#24-memory记忆系统)
- [LangChain 理解 - Memory 对比](../langchain-understanding.md#3-memory记忆)


---

## 业界方案对比

| 方案 | 代表产品 | 做法 | 优点 | 缺点 |
|------|---------|------|------|------|
| 滑动窗口 | 早期 ChatGPT | 只保留最近 N 轮，超出丢弃 | 简单零成本 | 丢失早期关键信息 |
| 摘要压缩 | LangChain SummaryMemory | LLM 把历史压缩成摘要 | 保留核心信息 | 有损、消耗 token、质量不稳定 |
| RAG 检索 | LangChain VectorStoreMemory | 历史存入向量库，按相关性检索 | 理论无限记忆 | 丢失时序、需外部服务 |
| 全量塞入 | Gemini（1M 窗口） | 窗口够大全塞进去 | 零信息损失 | 有上限、费用高、推理慢 |
| 工具化检索 | Claude Code、Cursor | 需要时用工具重新读文件 | 信息永远最新 | 依赖 LLM 判断"该读什么" |
| **分层管道** | **Mako** | 多层递进，每层解决一类问题 | 精细可控、渐进降级 | 实现复杂度高 |

---

## 为什么采用 5 层？

### 推导逻辑：每一层都是被具体问题"逼"出来的

```
问题1：单条消息就能撑爆窗口（读 10MB 文件）→ L1 截断
问题2：同一文件读 5 次内容没变，白占 5 份空间 → L2 去重
问题3：第 3 轮读的文件到第 50 轮已不重要 → L3 微压缩
问题4：对话太长整体接近上限 → L4 摘要压缩
问题5：压缩后还不够但归档信息后续可能还要 → L5 归档+检索
```

### 为什么不用单一方案？

| 如果只用一种 | 会怎样 |
|------------|--------|
| 只用滑动窗口 | 早期关键决策丢了，Agent 重复犯错 |
| 只用摘要压缩 | 每次都调 LLM（贵+慢），很多情况 L1-L3 就解决了 |
| 只用 RAG | 丢失时序、需外部服务、Client 端跑不了向量库 |
| 只用全量塞入 | 128K 窗口 100 轮就满，越满推理越慢 |

### 5 层的核心价值

**80% 的情况被 L1-L3（零成本/低成本）解决，只有 20% 极端情况才需要 L4-L5（高成本）。成本最优。**

### 设计原则

1. **渐进式降级** — 先用便宜手段，不够再用贵的
2. **每层职责单一** — 一层只解决一个问题，可独立开关
3. **管道模式** — 层之间解耦，新增层不改已有代码
4. **Client 端约束** — 不能依赖外部服务，所以 L5 用本地 BM25
5. **保留时序** — 编码场景时序重要，不能用丢失时序的方案

---

## Q&A

### Q: L1-L3 是内存层面的，不是本地存储？能有多大上下文？

**A**：L1-L3 操作的 `messages` 数组确实在内存里（Node.js 堆内存）。但瓶颈不是内存大小，是**模型窗口（token 上限）**。

```
内存能装多少？→ 几个 GB，不是瓶颈
模型窗口能装多少？→ 128K token（约 50-100K 中文字），这才是瓶颈
```

L1 截断不是因为"内存装不下"，而是因为"塞给 LLM 的 prompt 装不下"。10MB 文件内存里放着没问题，但不能把 10MB 全塞进 128K 窗口。

### Q: L1 截断落盘——截断了什么？落盘是什么意思？

**A**：
- **截断了什么**：工具返回的超大结果。比如 `read_file` 读了一个 10MB 日志文件，返回几百万字符。截断 = 只保留前 2000 字符作为预览，剩下的不放进上下文。
- **落盘**：把完整内容写到磁盘文件里（`.mako/overflow/xxx.txt`）。"落盘"= 写入磁盘。后续 LLM 如果需要完整内容，可以用 `read_file` 工具重新读取。

### Q: L3 也是内存中压缩？

**A**：对。L3 不涉及磁盘 IO。原始 messages 数组还在内存里没删，只是**给 LLM 看的版本**被精简了——旧的只读工具结果缩短为摘要，最近 N 轮保留完整。

### Q: tokenCount 是什么？如何得到的？

**A**：tokenCount = 当前上下文所有 messages 拼起来的 token 总数。

用 `gpt-tokenizer` 库在本地计算（和 OpenAI 用的 tiktoken 算法一致）：

```typescript
import { encode } from 'gpt-tokenizer';

const allText = messages.map(m => m.content).join('');
const tokenCount = encode(allText).length;  // 比如 102400

const maxTokens = 128000;
const ratio = tokenCount / maxTokens;  // 0.80 → 触发 L4
```

为什么本地算？调 API 算太慢太贵，本地用相同算法，结果一致，零网络开销。

### Q: 归档就是明文存储文件吗？BM25 就是用 minisearch 查找归档内容？

**A**：对，就这么简单。

```
归档：messages[0..20] → JSON.stringify → 写入 .mako/archive/session_xxx.json（明文 JSON）
检索：minisearch 对归档消息的 content 建 BM25 索引 → search("关键词") → 返回最相关的消息 → 恢复到上下文
```

没有加密、没有压缩、没有二进制格式。明文 JSON + 内存索引，简单粗暴但够用。

### Q: 数据存储位置总结

| 层 | 数据在哪 | 格式 |
|----|---------|------|
| L1-L3 | 内存（messages 数组） | JS 对象 |
| L1 溢出 | 磁盘 `.mako/overflow/` | 明文原始内容 |
| L4 摘要 | 内存（替换原消息） | 压缩后的文本 |
| L5 归档 | 磁盘 `.mako/archive/` | 明文 JSON |
| L5 索引 | 内存（minisearch 实例） | BM25 倒排索引 |

---

### Q: messages 数据结构长什么样？

**A**：messages 是一个数组，每条消息有 `role` 和 `content`：

```typescript
const messages = [
  // System Prompt（Agent 的"人设"+ 规则）
  { role: "system", content: "你是一个 AI Coding Agent..." },

  // 用户消息
  { role: "user", content: "帮我修复 src/index.ts 里的 bug" },

  // Agent 决定调工具（content 为 null，有 tool_calls）
  { role: "assistant", content: null, tool_calls: [
    { id: "call_1", name: "read_file", arguments: { path: "src/index.ts" } }
  ]},

  // 工具执行结果
  { role: "tool", tool_call_id: "call_1", content: "export function add(a, b) {\n  return a - b;\n}" },

  // Agent 修复
  { role: "assistant", content: null, tool_calls: [
    { id: "call_2", name: "write_file", arguments: { path: "src/index.ts", content: "..." } }
  ]},

  // 工具结果
  { role: "tool", tool_call_id: "call_2", content: "文件已写入: src/index.ts" },

  // Agent 最终回答（纯文本 → 退出 ReAct 循环）
  { role: "assistant", content: "已修复 bug：add 函数的减号改为加号。" }
]
```

**4 种 role**：
- `system`：系统指令（Agent 人设 + Steering + Skills）
- `user`：用户输入
- `assistant`：LLM 输出（可能是文本，也可能是 tool_calls）
- `tool`：工具执行结果（通过 tool_call_id 关联到对应的调用）

---

### Q: 整个 Agent 组装的上下文是怎样的？

**A**：每次调 LLM 前，`context.assemble()` 组装出完整的请求：

```typescript
// 发给 LLM API 的请求
{
  model: "gpt-4o",
  messages: [
    // ① System Prompt（固定部分 + Steering + Skills）
    {
      role: "system",
      content: `你是 Mako，一个 AI Coding Agent。
你可以使用工具完成编码任务。
规则：修改文件前先读取确认...
[.mako/steering.md 的内容注入在这里]
[当前激活的 Skill 指令注入在这里]`
    },

    // ② L4 摘要（如果有压缩历史）
    { role: "system", content: "[会话摘要] 用户意图：修复bug。已完成：读取文件..." },

    // ③ 对话历史（经 L3 微压缩）
    { role: "user", content: "帮我修复 src/index.ts 里的 bug" },
    { role: "assistant", tool_calls: [...] },
    { role: "tool", content: "[read_file: src/index.ts, 150 lines]" },  // ← 旧的只读结果被 L3 缩短
    // ... 更多历史 ...
    { role: "tool", content: "export function add(a, b) {...}" },  // ← 最近的保留完整
  ],

  // ④ 工具定义（单独参数，不在 messages 里）
  tools: [
    { name: "read_file", description: "读取文件", parameters: { path: { type: "string" } } },
    { name: "write_file", description: "写入文件", parameters: {...} },
    { name: "bash", description: "执行命令", parameters: {...} },
    { name: "mcp_gerrit_get_diff", description: "获取CR差异", parameters: {...} },
    // ... MCP 动态发现的工具也在这里
  ],

  stream: true  // 流式返回
}
```

**组装公式**：

```
发给 LLM 的 = System Prompt（含 Steering + Skills）
            + [L4 摘要（如果有）]
            + 对话历史（经 L3 微压缩）
            + tools 定义（JSON Schema）
            + stream: true
```
