# 阶跃 — 前端开发（AI大模型方向）准备清单

> 2h 冲刺，按优先级排列。核心策略：**AI 应用开发拉开差距，前端基础不丢分，跨端经验锦上添花。**

---

## 目录

- [🔴 P0：AI 大模型应用开发（50min）](#-p0ai-大模型应用开发50min)
  - [1. Streaming 输出（必问）](#1-streaming-输出必问)
  - [2. Agent / ReAct 循环（核心亮点）](#2-agent--react-循环核心亮点)
  - [3. Function Calling / Tool Use（高频）](#3-function-calling--tool-use高频)
  - [4. MCP 协议（加分大项）](#4-mcp-协议加分大项)
  - [5. 上下文管理（体现深度）](#5-上下文管理体现深度)
  - [6. RAG 基本流程（了解即可）](#6-rag-基本流程了解即可)
  - [7. Prompt Engineering（基础认知）](#7-prompt-engineering基础认知)
- [🟡 P1：前端基础高频题（40min）](#-p1前端基础高频题40min)
  - [JS 核心（15min）](#js-核心15min)
  - [CSS 布局（10min）](#css-布局10min)
  - [框架原理（10min）](#框架原理10min)
  - [HTTP & 网络（5min）](#http--网络5min)
- [🟢 P2：跨端经验（20min）](#-p2跨端经验20min)
  - [RN（10min）](#rn10min)
  - [Electron（5min）](#electron5min)
  - [Hybrid Web（5min）](#hybrid-web5min)
- [🔵 P3：项目故事串联（10min）](#-p3项目故事串联10min)
- [⏱️ 时间分配建议](#️-时间分配建议)
- [📎 关联文档总览](#-关联文档总览)

---

## 🔴 P0：AI 大模型应用开发（50min）

> JD 核心定位。这是你和普通前端候选人的差异化武器。
> 📎 详细文档：[AI Agent 概念解释](../../resume/explain/ai-agent.md) | [Mako Deep Dive](../../project/AI/mako/mako-project-deep-dive.md)

### 1. Streaming 输出（必问）

- [ ] SSE 协议原理
  > **本质**：HTTP 长连接单向推送。`Content-Type: text/event-stream` + chunked transfer，服务端不关连接持续发 `data:` 行。
  > **关键词**：SSE、delta 增量拼接、背压控制
- [ ] 前端消费
  > **本质**：`fetch` → `response.body`(ReadableStream) → `getReader()` → `read()` 循环 → `TextDecoder` 解码 → DOM 追加。
  > **关键词**：ReadableStream、TextDecoder、逐字渲染
- [ ] 后端转发
  > **本质**：Node.js 中间层做 SSE 代理，`res.setHeader('Content-Type', 'text/event-stream')` + `res.write()` 逐块转发。
- [ ] **你的实践**：Mako 全链路流式
  > LLM API(SSE) → AsyncIterator(LLM Adapter) → AsyncGenerator(Agent Core，支持双向通信/确认) → CLI stdout / Web SSE
  > 📎 [Mako Deep Dive - 流式传输](../../project/AI/mako/mako-project-deep-dive.md#核心机制-5流式传输streaming)

### 2. Agent / ReAct 循环（核心亮点）

- [ ] Agent vs ChatBot
  > **本质**：ChatBot = 输入→输出（一次性）；Agent = 输入→思考→行动→观察→…→输出（自主循环）。驱动者不同：ChatBot 靠用户每轮推动，Agent 自己驱动直到完成。
  > **关键词**：自主决策、循环驱动、任务完成判断
- [ ] ReAct 循环
  > **本质**：ReAct 不是 LLM 的能力，是 Agent 框架层的设计范式。就是 while 循环 + 提示词工程，让框架和 LLM 多次交流得到复杂结果。LLM 每轮只做一件事（输入文本→输出文本），框架负责循环、工具执行、上下文累积，LLM 负责决策（用什么工具、什么时候结束）。
  > **关键词**：while 循环、tool_calls 判断、finish_reason、maxIterations 兜底、框架提供手脚 LLM 提供大脑
- [ ] **你的实践**
  > Mako 的 `chatStream()` — while 循环 + LLM 调用 + 工具执行 + 上下文累积。简单但够用，不需要 LangGraph 的 DAG 编排。
  > 📎 [Mako Deep Dive - ReAct](../../project/AI/mako/mako-project-deep-dive.md#核心机制-1react-循环)

### 3. Function Calling / Tool Use（高频）

- [ ] 原理
  > **本质**：LLM 不执行代码，只输出结构化指令（JSON）。框架解析 → 执行 → 结果返回给 LLM。LLM 做决策，框架做执行。
  > **关键词**：JSON Schema 定义、name/description/parameters 三要素、tool role message
- [ ] 安全确认
  > **本质**：读操作（read_file/search）自动执行；写操作（write_file/bash）yield 确认请求，AsyncGenerator 双向通信接收用户 y/n/a。
- [ ] **你的实践**
  > Mako 7 个内置工具 + MCP 动态扩展。工具注册中心统一接口，LLM 通过 JSON Schema 自动发现可用工具。
  > 📎 [Mako Deep Dive - 工具系统](../../project/AI/mako/mako-project-deep-dive.md#核心机制-3工具系统tool-use)

### 4. MCP 协议（加分大项）

- [ ] 原理
  > **本质**：AI Agent 调用外部工具的标准协议。类比 USB — 有了标准，任何工具实现 MCP Server 就能被 Agent 调用。
  > **关键词**：stdio/HTTP 传输、动态工具发现、`mcp_{server}_{tool}` 命名
- [ ] 全链路
  > 飞书(读需求) → Figma(读设计稿) → Agent(生成代码) → DevTools(验证渲染) → Gerrit(提交CR) → Jira(更新状态)
  > **一人 Team 级交付** = 架构师定义 what + how，Agent 通过 MCP 高速执行。
- [ ] **你的实践**
  > Mako 的 MCPClient（单连接管理）+ MCPServerManager（多 Server 生命周期）。启动自动连接，退出自动清理。
  > 📎 [AI Agent 概念 - MCP](../../resume/explain/ai-agent.md#q-mcp-是什么)

### 5. 上下文管理（体现深度）

- [ ] 核心矛盾
  > **本质**：信息量无限增长 vs 窗口有限。100+ 轮对话产生百万 token，模型只能看 128K。
- [ ] 5 层防御管道
  > L1 截断（单条>50K落盘）→ L2 去重（SHA-256 hash）→ L3 微压缩（旧只读结果清理）→ L4 AI摘要（9维结构化，80%触发）→ L5 BM25检索（95%触发，归档+可恢复）
  > **关键词**：分层递进、管道模式、每层职责单一可独立开关
- [ ] 为什么不用 RAG
  > 1）编码上下文时序性重要，向量检索丢时序；2）需额外 embedding 模型+向量库，部署复杂。渐进式方案解决 80% 问题。
- [ ] **你的实践**
  > Mako ContextPipeline：Ingress(进入时截断去重) → Egress(组装时微压缩) → Compression(压缩时摘要+兜底)
  > 📎 [Mako Deep Dive - 上下文管道](../../project/AI/mako/mako-project-deep-dive.md#核心机制-25-层上下文管道contextpipeline)

### 6. RAG 基本流程（了解即可）

- [ ] 流程
  > **本质**：检索增强生成。Query → Embedding → 向量库相似度检索 → Top-K 文档拼接到 Prompt → LLM 生成。
  > **关键词**：Embedding、向量数据库(Pinecone/Milvus)、相似度(余弦)、Top-K、Chunk 切分
- [ ] 你的观点
  > 2026 年模型窗口 128K-1M，很多场景直接塞进去。Agent 核心价值是"能做事"(Tool Use)，不是"知道更多"(RAG)。

### 7. Prompt Engineering（基础认知）

- [ ] 核心技巧
  > **本质**：通过结构化指令控制 LLM 行为。System Prompt = 角色 + 约束 + 输出格式。
  > **关键词**：Few-shot、Chain-of-Thought、角色设定、输出格式约束
- [ ] Steering 机制
  > 项目级 `.mako/steering.md` 自动注入 System Prompt，让 Agent 遵守项目规范不需每次提醒。

---

## 🟡 P1：前端基础高频题（40min）

> 硬性要求，不能丢分。快速过一遍高频点。
> 📎 详细文档：[速查手册](../root/cheatsheet.md) | [JS 手写题](../../writeByHand/js-coding/README.md)

### 框架原理（10min）

- [ ] 虚拟 DOM + Diff
  > **本质**：用 JS 对象描述 DOM 树，变更时对比新旧树找最小差异，批量更新真实 DOM。
  > **关键词**：O(n) 同层比较、key 的作用（复用节点）、React reconciliation
- [ ] React Hooks
  > **本质**：用链表存储状态，每次渲染按顺序读取。不能条件调用（破坏链表顺序）。
  > **关键词**：useState 链表、useEffect 依赖数组、闭包陷阱（stale closure）、useRef 逃逸
- [ ] 响应式系统
  > **本质**：Vue 用 Proxy 拦截 get/set 自动收集依赖+触发更新；React 用 setState 显式触发重渲染。
  > **关键词**：依赖收集、派发更新、脏检查 vs 精确更新
- [ ] Fiber 架构
  > **本质**：把递归渲染改为可中断的链表遍历。每个 Fiber 节点是一个工作单元，浏览器空闲时执行。
  > **关键词**：时间切片、优先级调度（Lane）、requestIdleCallback、concurrent mode

---

## 🟢 P2：跨端经验（20min）

> 加分项，你有实战经验，组织好语言即可。
> 📎 详细文档：[RN 总入口](../root/RN/README.md) | [Electron](../root/Electron/README.md)

### RN（10min）

- [ ] 新架构
  > **本质**：去掉 Bridge 瓶颈。JSI 让 JS 直接调用 C++ 对象 → TurboModule 按需加载 Native 模块 → Fabric 同步渲染。
  > **关键词**：JSI、TurboModule、Fabric、Codegen
  > 📎 [RN 通信](../root/RN/rn-native-communication.md)
- [ ] 性能优化
  > **关键词**：列表虚拟化(FlashList)、启动优化(Hermes预编译)、包体裁剪(条件编译)、内存泄漏排查
  > 📎 [RN 性能优化](../root/RN/performance.md)
- [ ] **你的实践**：XRN 多 Bundle
  > 多业务线拆分独立 Bundle → 按需加载 → 独立发版。路由设计支持跨 Bundle 导航。

### Electron（5min）

- [ ] 架构
  > **本质**：Chromium(渲染) + Node.js(系统能力)。主进程管窗口/系统，渲染进程跑页面。IPC 通信桥接两端。
  > **关键词**：ipcMain/ipcRenderer、contextBridge、preload 安全隔离
  > 📎 [Electron 核心概念](../root/Electron/README.md)
- [ ] **你的实践**：3d-editor 桌面端

### Hybrid Web（5min）

- [ ] JSBridge
  > **本质**：WebView 和 Native 的通信通道。Native→Web 注入全局方法；Web→Native URL Scheme 拦截或 postMessage。
  > **关键词**：URL Scheme、addJavascriptInterface、WKScriptMessageHandler

---

## 🔵 P3：项目故事串联（10min）

> 把项目经验串成一条有逻辑的线。

### 故事线

```
RN 跨端实战（XRN）
  → 桌面端探索（3d-editor / Electron）
  → AI 赋能开发效率（Mako Agent）
  → MCP 打通研发全链路
```

### 每个项目的 STAR

| 项目 | Situation | Task | Action | Result |
|------|-----------|------|--------|--------|
| Mako | 现有 AI Coding 工具闭源/不可扩展 | 做一个开源可观测的 Agent 框架 | ReAct引擎 + 5层上下文 + 微内核插件 | 开源，支持任意模型，可嵌入 |
| XRN | RN 多业务线代码耦合 | 多 Bundle 拆分 + 独立部署 | 路由设计 + 按需加载 + 构建优化 | 启动速度提升、独立发版 |
| 3d-editor | 需要桌面级 3D 编辑器 | Web + Electron 跨端方案 | Canvas 2D/3D + 组件库 + 桌面壳 | 可用的编辑器产品 |

### 30 秒自我介绍模板

> "我是一名大前端工程师，核心经验在 **跨端开发** 和 **AI 应用工程化**。
>
> 跨端方面，做过 RN 多 Bundle 架构、Electron 桌面应用、Hybrid 方案。
>
> AI 方面，从零实现了开源 AI Coding Agent 框架 Mako——核心是 ReAct 循环引擎 + 5 层上下文管道 + MCP 协议集成，能让任意 LLM 自主完成编码任务。
>
> 对阶跃这个岗位很感兴趣，因为它正好是我两条经验线的交汇点：用大前端能力做 AI 大模型应用。"

---

## ⏱️ 时间分配建议

| 时段 | 内容 | 方式 |
|------|------|------|
| 0-50min | P0 AI 部分 | 对着清单过，重点看关联文档 |
| 50-90min | P1 前端基础 | 快速扫关键词，不会的标记不深挖 |
| 90-110min | P2 跨端 | 回忆项目细节，准备 1-2 个技术难点故事 |
| 110-120min | P3 故事串联 | 对着 STAR 表格口述一遍，确保流畅 |

---

## 📎 关联文档总览

| 主题 | 文档 |
|------|------|
| AI Agent 概念 | [ai-agent.md](../../resume/explain/ai-agent.md) |
| Mako 技术深度 | [mako-project-deep-dive.md](../../project/AI/mako/mako-project-deep-dive.md) |
| RN 知识体系 | [RN 总入口](../root/RN/README.md) |
| Electron | [Electron 核心概念](../root/Electron/README.md) |
| 前端速查 | [cheatsheet.md](../root/cheatsheet.md) |
| 前端性能优化 | [interview.html5.wiki/performance](https://interview.html5.wiki/performance.html) |
| JS 手写题 | [writeByHand/js-coding](../../writeByHand/js-coding/README.md) |
