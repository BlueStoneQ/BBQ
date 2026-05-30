# Mako 🦈 — 开源 AI Coding Agent 框架

> 骨架 → 支干 → 血肉。第一性原理理解本质。

## 文档索引

- [Mako Deep Dive（项目讲解）](./mako-project-deep-dive.md)
- [为什么不用 LangChain](./why-not-frameworks.md)
- [安全路线图](./security-roadmap.md)

---

## 一、本质：解决什么问题

**怎么让 AI 不只是"聊天"，而是能真正"写代码"——读文件、改文件、跑命令、理解项目？**

现有方案的问题：
- Claude Code：闭源、绑定 Claude、不可扩展
- Aider：无插件系统、无评测框架
- LangChain/CrewAI：Python、不专注 Coding

Mako 的定位：**开源的、模型无关的、可观测的、可扩展的 AI Coding Agent 框架。**

---

## 二、核心概念

| 概念 | 解释 | 类比 |
|------|------|------|
| **Agent** | 能自主决策和行动的 AI 程序（不只是问答） | 有手有脚的 AI，不只是嘴 |
| **ReAct 循环** | 思考(Reason) → 行动(Act) → 观察(Observe) → 再思考。Agent 在一次用户请求内自主多步推理，用户不参与中间过程 | 人解决问题：想 → 做 → 看结果 → 调整 |
| **多轮对话** | 用户和 AI 之间的多次来回。和 ReAct 不同——ReAct 是 Agent 内部循环，多轮对话是用户驱动 | 微信聊天 |
| **Tool Use** | Agent 调用外部工具（读文件/写文件/跑命令） | 人用锤子/螺丝刀 |
| **Context Window** | LLM 一次能看到的信息量上限（128K tokens） | 人的工作记忆容量 |
| **上下文管理** | 在有限的 Context Window 内组装最有效的信息（System Prompt + Steering + History + 工具结果）。超出时做压缩/摘要 | 考试时选择带哪些参考资料 |
| **Prompt Engineering** | 设计 System Prompt 和指令，引导 LLM 产出高质量结果 | 给实习生写清楚的任务说明 |
| **Steering** | 项目级规则注入 System Prompt（`.mako/steering.md`） | 团队编码规范 |
| **Skill** | 可插拔的能力包（指令 + 工具白名单） | 专家角色（代码审查专家/重构专家） |
| **MCP** | Model Context Protocol，AI 调用外部工具的标准协议 | USB 接口标准 |
| **Trace** | Agent 执行过程的完整记录（每步决策/工具调用/token 消耗） | 程序的执行日志 |
| **Token** | LLM 处理文本的最小单位（约 3/4 个英文单词 = 1 token） | 计费单位 |

---

## 三、架构（骨架）

```
┌─────────────────────────────────────────────────────────┐
│                      CLI 交互层                          │
│  终端 UI / 流式输出 / 命令解析                           │
├─────────────────────────────────────────────────────────┤
│                      Agent 核心层                        │
│  ReAct 循环 / 上下文管理 / 对话历史                      │
├─────────────────────────────────────────────────────────┤
│                      能力层                              │
│  Tool Use / Skills / Steering / Memory                  │
├─────────────────────────────────────────────────────────┤
│                      LLM 适配层                          │
│  OpenAI 兼容接口（GPT/Claude/MiMo/DeepSeek/本地模型）    │
├─────────────────────────────────────────────────────────┤
│                      工具层                              │
│  read_file / write_file / bash / search / fetch_url     │
├─────────────────────────────────────────────────────────┤
│                      评测层（Benchmark）                  │
│  任务定义 / 自动执行 / 评分 / 多模型对比报告              │
└─────────────────────────────────────────────────────────┘
```

### 项目结构

```
packages/
├── core/    ← Agent 核心（ReAct 循环、LLM 适配、上下文、工具注册）
├── tools/   ← 7 个内置工具
└── cli/     ← 终端交互、配置、steering、trace
```

---

## 四、核心循环（ReAct）

```
用户："帮我修复这个 bug"
  ↓
Agent 思考：需要先看代码
  ↓ tool_call: read_file("src/index.ts")
观察：[文件内容]
  ↓
Agent 思考：发现问题在第 42 行
  ↓ tool_call: write_file("src/index.ts", 修复后的内容)
观察：文件已写入
  ↓
Agent 思考：需要验证修复
  ↓ tool_call: bash("npm test")
观察：测试通过
  ↓
Agent 回答："已修复，问题是..."
```

**本质：LLM 不直接输出最终答案，而是通过多轮"思考→行动→观察"逐步解决问题。**

---

## 五、差异化（为什么不用 Claude Code）

| 维度 | Claude Code | Mako |
|------|------------|------|
| 模型 | 绑定 Claude | 任意模型（OpenAI 兼容） |
| 开源 | ❌ | ✅ MIT |
| 可观测性 | 无 | 内置 Trace + AI 分析 |
| 评测 | 无 | 内置 Benchmark 框架 |
| 扩展 | MCP only | MCP + Skill + Plugin |
| 行为规则 | .claude/ | .mako/steering.md |

---

## 六、技术栈

| 层 | 技术 |
|---|------|
| 语言 | TypeScript |
| 包管理 | pnpm monorepo |
| 测试 | vitest |
| LLM 通信 | OpenAI SDK（兼容所有 OpenAI 格式的模型） |
| CLI | Node.js |
| 构建 | tsup / esbuild |

---

## 七、Prep 价值

| 维度 | 体现 |
|------|------|
| AI Agent 系统设计 | 微内核 + 插件架构、ReAct 循环、上下文管理 |
| 开源项目能力 | 从 0 到 1 设计 + 实现 + 文档 + 发布 |
| 模型评测能力 | Benchmark 框架设计、多模型对比 |
| 工程化 | monorepo、TypeScript、vitest、CI |
| AI 时代认知 | 不只是用 AI，而是造 AI 工具 |
