# 03 — 工具系统 & MCP

> 源码：`packages/tools/` + `packages/mcp/`

---

## 目录

- [一句话](#一句话)
- [核心架构](#核心架构)
- [ToolRegistry 核心接口](#toolregistry-核心接口)
- [Function Calling 流程](#function-calling-流程)
- [MCP 协议](#mcp-协议)
- [安全确认机制](#安全确认机制)
- [面试话术](#面试话术)

---

## 一句话

工具系统 = LLM 的手脚。LLM 只输出 JSON 指令，框架负责执行。内置工具 + MCP 动态扩展，统一注册到 ToolRegistry。

---

## 核心架构

```
ToolRegistry（统一注册中心）
├── 内置工具（packages/tools/）
│   ├── read-file      — 读文件
│   ├── write-file     — 写文件
│   ├── replace-in-file — 替换文件内容
│   ├── list-directory — 列目录
│   ├── search         — 搜索文件（fast-glob）
│   ├── bash           — 执行命令
│   └── fetch-url      — 抓取网页
└── MCP 工具（packages/mcp/，动态发现）
    ├── mcp_feishu_read_doc
    ├── mcp_figma_get_design
    ├── mcp_gerrit_submit
    └── ...（任意 MCP Server 的工具）
```

---

## ToolRegistry 核心接口

```typescript
class ToolRegistry {
  register(tool: Tool): void;           // 注册工具
  get(name: string): Tool | undefined;  // 按名获取
  list(): Tool[];                       // 列出所有
  listForLLM(): ToolDefinitionForLLM[]; // 转为 JSON Schema 格式给 LLM
  execute(toolCall: ToolCall): string;  // 执行工具调用
}
```

**关键**：`listForLLM()` 把工具转为 JSON Schema 格式，LLM 通过 schema 自动发现可用工具：

```json
{
  "name": "read_file",
  "description": "Read the contents of a file",
  "parameters": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "File path to read" }
    },
    "required": ["path"]
  }
}
```

LLM 看到这个 schema → 知道有 read_file 工具 → 需要时输出 `{ name: "read_file", arguments: { path: "src/app.ts" } }`

---

## Function Calling 流程

```
1. 请求时带 tools 数组（JSON Schema 定义）
   → LLM 知道有哪些工具可用

2. LLM 返回 tool_calls
   → { name: "read_file", arguments: { path: "..." } }
   → 这是 JSON 指令，不是执行！LLM 不执行任何代码

3. 框架解析 tool_calls → 调用 ToolRegistry.execute()
   → 真正执行工具（读文件/写文件/跑命令）

4. 执行结果作为 { role: "tool" } 消息加入上下文
   → LLM 下一轮能看到结果

5. LLM 根据结果决定下一步
   → 继续调工具 or 返回最终答案
```

**核心理解**：LLM 是大脑（做决策），框架是手脚（做执行）。LLM 永远不直接执行代码。

---

## MCP 协议

### 是什么

MCP（Model Context Protocol）= AI Agent 调用外部工具的标准协议。

**类比**：USB 标准。有了 USB，任何设备只要实现 USB 接口就能被电脑识别。有了 MCP，任何工具只要实现 MCP Server 就能被 Agent 调用。

### 架构

```
Agent（Mako）
  └── MCPServerManager（管理所有 MCP Server 生命周期）
       ├── MCPClient("feishu") → 子进程 → 飞书 MCP Server
       ├── MCPClient("figma") → 子进程 → Figma MCP Server
       └── MCPClient("gerrit") → 子进程 → Gerrit MCP Server
```

### MCPClient 核心流程（源码）

```typescript
class MCPClient {
  async connect(): Promise<MCPToolDefinition[]> {
    // 1. 启动子进程（stdio 传输）
    this.transport = new StdioClientTransport({
      command: config.command,  // e.g. "uvx"
      args: config.args,       // e.g. ["feishu-mcp-server"]
    });

    // 2. 协议握手
    await this.client.connect(this.transport);

    // 3. 发现工具（动态！）
    const response = await this.client.listTools();
    this._tools = response.tools;

    return this._tools;
  }

  async callTool(toolName: string, args: Record<string, unknown>) {
    // 调用远程工具
    return await this.client.callTool({ name: toolName, arguments: args });
  }
}
```

### MCPServerManager 核心职责

```typescript
class MCPServerManager {
  async initializeAll()    // 启动所有配置的 MCP Server
  async restartServer(name) // 重启单个 Server
  async shutdownAll()      // 关闭所有（SIGTERM + 5s 超时强杀）
  getDangerousTools()      // MCP 工具默认危险，除非在 alwaysAllow 中
}
```

### 工具命名规则

MCP 工具注册到 ToolRegistry 时，名称加前缀：`mcp_{serverName}_{toolName}`

```
飞书 Server 的 read_doc 工具 → mcp_feishu_read_doc
Gerrit Server 的 submit 工具 → mcp_gerrit_submit
```

LLM 看到的就是这个带前缀的名字，调用时框架根据前缀路由到对应的 MCPClient。

---

## 安全确认机制

```typescript
// 危险工具集合
const DANGEROUS_TOOLS = new Set(['bash', 'write_file', 'replace_in_file']);
// + 所有 MCP 工具默认危险（除非在 alwaysAllow 中）

// chatStream 中的确认流程
if (DANGEROUS_TOOLS.has(toolCall.name)) {
  const confirmed = yield { type: 'tool_confirm', name: toolCall.name, arguments: toolCall.arguments };
  if (confirmed === false) {
    // 用户拒绝 → 跳过该工具，告诉 LLM "用户拒绝了"
    continue;
  }
}
```

**三级确认**：
- **y**（yes）：执行这一次
- **n**（no）：跳过这一次
- **a**（always）：本次会话内该工具不再确认

---

## 面试话术

> "Mako 的工具系统分两部分：7 个内置工具（文件读写/搜索/命令行）+ MCP 动态扩展。统一注册到 ToolRegistry，通过 JSON Schema 让 LLM 自动发现。MCP 是标准协议——启动子进程、协议握手、动态发现工具，任何实现了 MCP Server 的外部服务都能被 Agent 调用。我用 MCP 串联了飞书、Figma、Gerrit、Jira，实现研发全链路自动化。"

> "LLM 不执行代码，只输出 JSON 指令。框架负责解析指令、执行工具、把结果返回给 LLM。危险工具（写文件/跑命令/MCP）需要用户确认，通过 AsyncGenerator 的 yield 暂停等待。"
