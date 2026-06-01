# 07 — 提示词工程与模板设计

> 源码：`packages/cli/src/system-prompt.ts` + `steering.ts` + `spec-prompts.ts` + `skills.ts`

---

## 目录

- [一句话](#一句话)
- [提示词组装架构](#提示词组装架构)
- [第 1 层：DEFAULT_SYSTEM_PROMPT](#第-1-层default_system_prompt)
- [第 2 层：Steering（项目级规则）](#第-2-层steering项目级规则)
- [第 3 层：动态 Prompt（Skills / Spec）](#第-3-层动态-promptskills--spec)
- [提示词工程核心手法总结](#提示词工程核心手法总结)
- [和 Claude Code / Kiro 的对比](#和-claude-code--kiro-的对比)
- [面试话术](#面试话术)

---

## 一句话

Mako 的提示词是分层组装的：基础 System Prompt + 项目 Steering + 动态 Skills/Spec Prompt。不是一坨写死的文本，是可组合、可热更新的模块化设计。

---

## 提示词组装架构

```
最终发给 LLM 的 System Prompt =
  DEFAULT_SYSTEM_PROMPT（基础角色 + 能力 + 原则）
  + Steering（项目级规则，从 .mako/steering/*.md 加载）
  + Skills Prompt（按用户输入动态匹配的技能指令）
  或 Spec Prompt（Spec 模式下的阶段角色指令）
```

```
┌─────────────────────────────────────────┐
│  DEFAULT_SYSTEM_PROMPT（固定）           │  ← 角色定义 + 工具说明 + 工作原则
├─────────────────────────────────────────┤
│  Steering（项目级，启动时加载）          │  ← .mako/steering/*.md，团队规范
├─────────────────────────────────────────┤
│  Skills / Spec Prompt（每轮动态）        │  ← 按上下文动态注入
└─────────────────────────────────────────┘
```

---

## 第 1 层：DEFAULT_SYSTEM_PROMPT

> 源码：`packages/cli/src/system-prompt.ts`

```typescript
export const DEFAULT_SYSTEM_PROMPT = `你是 Mako，一个专业的 AI 编程助手。你运行在用户的终端中，可以直接操作用户的项目文件和执行命令。

## 核心能力
- read_file / write_file / replace_in_file / list_directory / bash / search / fetch_url

## 工作原则
1. 先理解再行动（先 read_file 了解项目）
2. 最小化修改（优先 replace_in_file）
3. 验证结果（修改后跑测试）
4. 解释清楚（说明做了什么、为什么）
5. 安全意识（危险操作先告知）

## 回答风格
- 简洁直接
- 代码修改说明改了什么
- 中文回答
`;
```

### 设计手法

| 手法 | 体现 | 为什么 |
|------|------|--------|
| **角色设定** | "你是 Mako，一个专业的 AI 编程助手" | 让 LLM 进入编程助手角色 |
| **能力边界** | 列出所有可用工具 | LLM 知道自己能做什么 |
| **行为约束** | 5 条工作原则 | 控制 LLM 行为（先读再改、最小修改） |
| **输出格式** | "简洁直接、中文回答" | 控制回答风格 |
| **安全意识** | "危险操作先告知" | 配合工具确认机制 |

---

## 第 2 层：Steering（项目级规则）

> 源码：`packages/cli/src/steering.ts`

### 机制

```typescript
export function loadSteering(projectDir): string {
  // 1. 读 .mako/steering.md（单文件模式）
  // 2. 读 .mako/steering/*.md（目录模式，按文件名排序）
  // 3. 拼接为一段文本，加标题 "## 项目规则（Steering）"
  return '\n\n## 项目规则（Steering）\n\n' + parts.join('\n\n---\n\n');
}
```

### 用途

Steering = 项目级的持久化规则，让 Agent 遵守团队规范而不需要每次提醒。

```markdown
<!-- .mako/steering/code-style.md -->
- 使用 TypeScript strict 模式
- 组件用函数式写法，不用 class
- 状态管理用 Zustand
- 测试用 vitest
- commit message 用英文 conventional commits
```

### 设计理念

- **不侵入 System Prompt**：Steering 是追加的，不修改基础 prompt
- **项目级而非全局**：每个项目可以有不同的规则
- **Markdown 格式**：人可读、可编辑、可版本控制
- **热加载**：修改 steering 文件后重启即生效

---

## 第 3 层：动态 Prompt（Skills / Spec）

### Skills 系统

> 源码：`packages/cli/src/skills.ts`

```typescript
// 加载 .mako/skills/*.md
function loadSkills(): Skill[]

// 根据用户输入自动匹配（关键词触发）
function matchSkills(message: string, skills: Skill[]): Skill[]

// 拼接为 prompt 片段
function buildSkillPrompt(activeSkills: Skill[]): string
```

**机制**：每轮对话前，用用户输入的关键词匹配 Skills，匹配到的 Skill 的 instructions 注入 System Prompt。

**类比**：Skills 就像"按需加载的专家知识"。用户问 React 问题 → 加载 React Skill；用户问部署问题 → 加载 DevOps Skill。

### Spec 模式（阶段角色切换）

> 源码：`packages/cli/src/spec-prompts.ts`

Spec 模式下，Agent 按阶段切换角色：

| 阶段 | 角色 | Prompt 核心指令 |
|------|------|----------------|
| requirements | 需求分析师 | 直接生成需求文档，不要反复确认 |
| design | 技术架构师 | 读需求文档 → 生成设计文档 |
| tasks | 项目经理 | 读需求+设计 → 生成任务列表 |
| execute | 执行者 | 按任务列表逐个编码 |

```typescript
// 每个阶段切换时更新 System Prompt
agent.getContext().updateConfig({
  systemPrompt: basePrompt + steering + specPrompt
});
```

**设计理念**：同一个 Agent，通过切换 System Prompt 变成不同角色。不需要多个 Agent 实例。

---

## 提示词工程核心手法总结

| 手法 | 在 Mako 中的体现 | 效果 |
|------|-----------------|------|
| **角色设定** | "你是 Mako，专业 AI 编程助手" | 限定行为边界 |
| **能力声明** | 列出所有工具 + 描述 | LLM 知道能做什么 |
| **行为约束** | 5 条工作原则 | 控制行为模式（先读再改） |
| **输出格式** | "简洁直接、中文回答" | 控制回答风格 |
| **分层注入** | base + steering + dynamic | 可组合、可热更新 |
| **角色切换** | Spec 模式 4 阶段 | 同一 Agent 多角色 |
| **关键词触发** | Skills 按 keywords 匹配 | 按需加载专家知识 |
| **规则强调** | "规则（必须遵守）" | 提高 LLM 遵守率 |
| **负面指令** | "不要反复确认、不要问澄清问题" | 避免不想要的行为 |
| **格式模板** | 需求文档格式、任务格式 | 结构化输出 |

---

## 和 Claude Code / Kiro 的对比

| 维度 | Mako | Claude Code | Kiro |
|------|------|-------------|------|
| System Prompt | ~800 字，简洁 | 极长（估计 5000+），详细到每个工具的使用规则 |  长，包含 identity/capabilities/rules |
| Steering | .mako/steering/*.md | 无（内置规则） | .kiro/steering/*.md |
| Skills | .mako/skills/*.md（关键词触发） | 无 | .kiro/skills/（手动/自动） |
| Spec 模式 | 4 阶段角色切换 | 无 | Spec session（requirements→design→tasks） |
| 动态注入 | 每轮 updateConfig | 不清楚 | 每轮根据上下文注入 |

---

## 面试话术

> "Mako 的提示词是分层组装的，不是一坨写死的文本。三层：基础 System Prompt 定义角色和原则；Steering 是项目级规则（从 .mako/steering/*.md 加载），让 Agent 遵守团队规范不需要每次提醒；Skills 是按用户输入动态匹配的专家知识。Spec 模式下还能按阶段切换角色——同一个 Agent 通过换 System Prompt 变成需求分析师、架构师、项目经理。核心设计理念是可组合、可热更新、不侵入。"

> "提示词工程的核心手法：角色设定限定边界、能力声明让 LLM 知道能做什么、行为约束控制模式（先读再改）、负面指令避免不想要的行为（不要反复确认）、格式模板保证结构化输出。"
