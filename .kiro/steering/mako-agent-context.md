---
inclusion: manual
---

# Mako Agent 项目上下文

## 项目位置

- **Mako 源码**：`d:\my-files\code\github-build\mako`（pnpm monorepo）
- **复习拆解文档**：`d:\my-files\code\github-build\BBQ\docs\project\AI\mako\`

## 项目定位

Mako 是一个从零实现的开源 AI Coding Agent 框架：
- 核心：ReAct 循环引擎 + 5 层上下文管道 + 微内核插件架构
- 差异化：可观测性（Trace）+ 评测框架（Benchmark）+ 万物皆插件
- 技术栈：TypeScript / pnpm monorepo / vitest / tsup / OpenAI SDK

## 项目结构

```
packages/
├── core/   → Agent 引擎（ReAct 循环、上下文管理、LLM 适配、工具注册）
├── tools/  → 内置工具（read_file / write_file / bash / search 等）
├── mcp/    → MCP 客户端（外部工具协议）
└── cli/    → 终端交互（流式输出、用户确认、配置）
```

## 当前工作重点

- Agent 核心部分的复习和拆解
- 重点理解：ReAct 循环、上下文管道、工具系统、流式传输、MCP 集成

## 沟通规范

- 使用中文交流
- 文档遵循 BBQ 的 doc-style.md 规范（第一性原理、直击本质、场景驱动）
- Git 提交信息用英文
