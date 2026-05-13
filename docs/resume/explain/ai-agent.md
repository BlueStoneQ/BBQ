# AI Agent 能力线 — 面试追问预备

> 简历能力线 4 和 Mako 开源项目相关的概念解释。

---

## Q: Mako 是什么？为什么要做这个？

### 本质

AI Coding Agent = 能自主读代码、写代码、跑命令的 AI 程序。不是聊天机器人，是有"手"的 AI。

### 解决的问题

现有方案的局限：
- Claude Code：闭源、绑定 Claude、不可扩展、无评测
- Aider：无插件系统、无评测
- LangChain：Python、不专注 Coding

Mako 的定位：开源 + 模型无关 + 可观测 + 可评测 + 可扩展。

### 核心架构

微内核设计：核心只做 ReAct 循环 + 上下文管理，所有能力通过插件扩展。

---

## Q: ReAct 循环是什么？和多轮对话的区别？

### 本质

ReAct = Reason + Act。Agent 在一次用户请求内自主完成多步推理，不需要用户反复指导。

| | 多轮对话 | ReAct 循环 |
|---|---|---|
| 驱动者 | 用户每次发消息 | Agent 自己驱动 |
| 用户参与 | 每轮都参与 | 只说一次，Agent 自主完成 |

### 示例

```
用户："修复这个 bug"（只说一次）
Agent 内部：
  思考 → read_file → 观察代码
  思考 → write_file → 修复
  思考 → bash("npm test") → 验证通过
  输出最终回答
```

---

## Q: Tool Use 是什么？

让 LLM 能调用外部工具（函数），而不只是生成文本。LLM 输出结构化指令（"调用 read_file，参数 src/index.ts"），Agent 框架执行后把结果返回给 LLM。

Mako 内置 7 个工具：read_file / write_file / replace_in_file / list_directory / bash / search / fetch_url。

---

## Q: MCP 是什么？

Model Context Protocol — AI Agent 调用外部工具的**标准协议**。

类比：MCP 之于 AI Agent = USB 之于电脑外设。有了标准，任何工具实现 MCP Server 就能被 Agent 调用，不需要每个工具单独写适配。

---

## Q: Steering 是什么？

项目级行为规则（`.mako/steering.md`），自动注入 System Prompt。让 Agent 遵守项目规范（用 pnpm 不用 npm、代码风格等），不需要每次提醒。

---

## Q: 上下文管理（Context Management）是什么？

管理 LLM 能"看到"的信息量。LLM 有 token 上限（128K），超了就要压缩。

Mako 的做法：超出阈值时对早期对话做摘要压缩，保留最近 N 轮完整内容。

---

## Q: Agent 可观测性（Trace）是什么？

记录 Agent 每一步决策过程，事后回放分析"为什么失败"。

Mako 自动记录到 `.mako/traces/`，`mako trace` 命令用 AI 分析执行历史，给出改进建议。

---

## Q: Benchmark/评测框架是什么？

用标准化任务集量化评估模型 Coding 能力。

- 任务分级：函数级 → 文件级 → 项目级
- 评分维度：正确性 + 代码质量 + 效率 + 最小修改
- 多模型对比：同一任务跑 N 个模型，生成对比报告
- 插件化：验证器/评分器/报告器都可扩展

---

## Q: 微内核架构是什么？

核心极小（只做 ReAct 循环 + 上下文 + LLM 调用），所有功能通过插件扩展（Tool/Skill/Eval/Reporter）。

类比：操作系统微内核——内核只管调度，文件系统/网络/驱动都是插件。

好处：核心稳定，能力可无限扩展。加新工具不改核心代码。

---

## Q: 为什么不用 RAG/向量数据库？

2026 年模型上下文窗口已经 128K-1M tokens，很多场景直接塞进去不需要 RAG。Agent 的核心价值是"能做事"（Tool Use），不是"知道更多"（RAG）。上下文管理（压缩/摘要）是简化版 RAG，已内置在 Agent 框架中。


---

## Q: 基于 MCP 打通研发全链路是什么意思？

### 本质

把研发流程中每个系统（飞书/Figma/Chrome/Gerrit/Jira）都通过 MCP 协议连接到 AI Agent，Agent 作为中枢自动驱动整个流程。

### 全链路

```
飞书 MCP（读需求文档）
  → Figma MCP（读设计稿节点/样式）
  → Agent（生成代码）
  → DevTools MCP（打开浏览器验证渲染）
  → Gerrit MCP（提交 Code Review）
  → Jira MCP（更新 Bug 状态）
```

### 每个 MCP 做什么

| MCP Server | 能力 | 场景 |
|-----------|------|------|
| Figma MCP | 读取设计稿节点/样式/布局 | AI 根据设计稿生成代码 |
| DevTools MCP | 打开浏览器/截图/查看 DOM/网络/性能 | AI 验证代码渲染结果 |
| Gerrit MCP | 读取 CR 评论/提交 review/查看 diff | AI 理解 review 意见并修复 |
| Jira MCP | 读取 bug 描述/更新状态 | AI 根据 bug 描述定位修复 |
| 飞书 MCP | 读取文档/表格 | AI 理解需求 |

### "一人 Team 级规格全栈全链路交付"

架构师定义做什么 + 怎么做，AI Agent 通过 MCP 连接各系统高速执行。一个人 + AI = 以前一个小团队的产出。

前提：全栈视野（能 review AI 产出的任何端代码）+ 系统设计能力（定义正确架构让 AI 在上面跑）。
