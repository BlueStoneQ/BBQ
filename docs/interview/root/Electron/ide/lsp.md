# 基于 Vetur 二次开发的 Language Server 实践

> 核心问题: 如何为一种自定义单文件组件格式 (.ux) 实现完整的语言智能？

## 目录

- [方案概述](#方案概述)
- [为什么基于 Vetur 二次开发](#为什么基于-vetur-二次开发)
- [整体架构](#整体架构)
- [LSP 底层原理](#lsp-底层原理)
  - [协议本质](#协议本质)
  - [通信流程](#通信流程)
  - [能力协商](#能力协商)
- [核心技术: 嵌入式语言处理](#核心技术-嵌入式语言处理)
  - [文档区域切割](#文档区域切割)
  - [虚拟文档生成](#虚拟文档生成)
  - [语言模式路由](#语言模式路由)
- [核心功能全栈实现](#核心功能全栈实现)
  - [自动补全](#自动补全)
  - [悬停提示](#悬停提示)
  - [跳转定义](#跳转定义)
  - [诊断校验](#诊断校验)
  - [格式化](#格式化)
- [定制扩展点](#定制扩展点)
- [工程结构](#工程结构)
- [小结](#小结)

---

## 方案概述

**目标**: 为 `.ux` 单文件组件格式（类 Vue SFC）提供完整的 IDE 语言智能。

**方案选择**: Fork Vetur (Vue 官方 LSP 插件) 进行二次开发。

**.ux 文件结构**:
```html
<template>
  <div class="container">
    <text>{{ message }}</text>
  </div>
</template>

<style>
.container { flex-direction: column; }
</style>

<script>
export default {
  data: { message: 'Hello' }
}
</script>
```

一个文件内嵌了 3 种语言 (HTML-like / CSS / JavaScript)，需要对每种语言独立提供智能。

---

## 为什么基于 Vetur 二次开发

| 方案 | 工作量 | 风险 |
|------|--------|------|
| 从零写 LSP Server | 6 人月+ | 巨大，需实现所有语言的 parser/补全/诊断 |
| 基于 Vetur Fork | 1-2 人月 | 成熟稳定，Vue SFC 和 .ux 结构几乎相同 |
| 基于 Volar (Vue 3) | 中等 | 架构更新但改动大 |

**选择 Vetur 的原因**:
1. `.ux` 的 `<template>/<style>/<script>` 结构与 Vue SFC 本质相同
2. Vetur 已解决了核心难题: 嵌入式多语言切割 + 各语言 Service 集成
3. 只需定制: 标签补全数据、组件 API、校验规则

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│ VSCode / IDE                                                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Extension Host                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Language Client (client/client.ts)                   │  │  │
│  │  │  - 启动 Server 进程                                   │  │  │
│  │  │  - 监听 .ux 文件                                      │  │  │
│  │  │  - 同步配置到 Server                                   │  │  │
│  │  └────────────────────────┬────────────────────────────┘  │  │
│  └───────────────────────────┼────────────────────────────────┘  │
│                              │ IPC (JSON-RPC over stdio/pipe)     │
├──────────────────────────────┼───────────────────────────────────┤
│                              ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Language Server (server/src/vueServerMain.ts)              │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │  VLS (核心服务)                                      │   │  │
│  │  │  - DocumentService: 文档同步管理                     │   │  │
│  │  │  - LanguageModes: 多语言模式路由                     │   │  │
│  │  │  - 诊断调度 (防抖 200ms)                            │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │  │ template │ │  style   │ │  script  │ │   json   │    │  │
│  │  │ Mode     │ │  Mode    │ │  Mode    │ │  Mode    │    │  │
│  │  │          │ │          │ │          │ │          │    │  │
│  │  │ HTML解析 │ │ CSS/SCSS │ │ TS语言   │ │ JSON     │    │  │
│  │  │ 标签补全 │ │ 属性补全 │ │  服务    │ │ Schema   │    │  │
│  │  │ 组件识别 │ │ 颜色     │ │ 跳转定义 │ │ 校验     │    │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## LSP 底层原理

### 协议本质

LSP = **JSON-RPC 2.0** over **IPC/stdio**

```
IDE (Client)                    Language Server
    │                                │
    │── initialize ─────────────────►│  握手: 交换能力
    │◄─ initialize result ───────────│
    │── initialized ────────────────►│
    │                                │
    │── textDocument/didOpen ────────►│  文档同步
    │── textDocument/didChange ──────►│
    │                                │
    │── textDocument/completion ─────►│  功能请求
    │◄─ CompletionList ──────────────│
    │                                │
    │◄─ textDocument/publishDiagnostics──│  Server 主动推送
    │                                │
```

### 通信流程

本项目的传输层选择:

```typescript
// client/client.ts
const serverOptions: ServerOptions = {
  run: { module: serverModule, transport: TransportKind.ipc },  // ← IPC 管道
  debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
};
```

Server 作为 Node.js 子进程启动，通过 IPC（非 stdio）通信。IPC 比 stdio 性能好（无需文本解析 Content-Length 头）。

### 能力协商

Server 在 `onInitialize` 中声明自己支持的能力:

```typescript
// server/src/vueServerMain.ts
return {
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,    // 全量同步
    completionProvider: {
      resolveProvider: true,                        // 支持延迟解析
      triggerCharacters: ['.', ':', '<', '"', ...]  // 触发字符
    },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    renameProvider: true,
    documentFormattingProvider: true,
    documentSymbolProvider: true,
    colorProvider: true,
    signatureHelpProvider: { triggerCharacters: ['('] }
  }
};
```

Client 根据这些 capability 决定何时向 Server 发请求。

---

## 核心技术: 嵌入式语言处理

这是整个 Language Server 最核心的难题:

**一个 .ux 文件 = N 种语言混合，如何为光标所在位置选择正确的语言服务？**

### 文档区域切割

```typescript
// server/src/modes/embeddedSupport.ts
type EmbeddedType = 'template' | 'script' | 'style' | 'custom' | 'inline' | 'json';

// 扫描 .ux 文件，识别各区域边界
export function getDocumentRegions(document: TextDocument): VueDocumentRegions {
  // 使用 HTML Scanner 逐 token 扫描
  // 遇到 <template> → 记录 template 区域
  // 遇到 <script>  → 记录 script 区域
  // 遇到 <style>   → 记录 style 区域
  // 遇到 style="..." 属性 → 记录 inline style 区域
  // 遇到 <data>    → 记录 JSON 区域
}
```

结果:
```
.ux 文件 offset 0~500
├── [0, 50]    → languageId: 'ux' (根文档)
├── [51, 300]  → languageId: 'vue-html' (template 区域)
├── [301, 400] → languageId: 'css' (style 区域)
├── [401, 500] → languageId: 'javascript' (script 区域)
└── style="color:red" → languageId: 'inline' (内联样式)
```

### 虚拟文档生成

每种语言服务只能处理纯文本。解法: 为每种语言生成"虚拟文档"。

```
原始 .ux 文件:              虚拟 CSS 文档:
┌──────────────┐           ┌──────────────┐
│ <template>   │           │              │  (空白填充，保持行号对齐)
│   <div>...   │           │              │
│ </template>  │           │              │
│              │           │              │
│ <style>      │           │              │
│ .foo {       │    →      │ .foo {       │  ← 只保留 CSS 内容
│   color: red │           │   color: red │
│ }            │           │ }            │
│ </style>     │           │              │
│              │           │              │
│ <script>     │           │              │
│ ...          │           │              │
│ </script>    │           │              │
└──────────────┘           └──────────────┘
```

关键: 非目标语言的区域用**等长空白替换** (保持 offset 对齐)，这样 CSS 服务返回的位置可以直接映射回原文档。

### 语言模式路由

```typescript
// 收到 LSP 请求时的路由逻辑:
// 1. 确定光标位置属于哪个语言区域
const mode = languageModes.getModeAtPosition(document, position);

// 2. 委托给对应的语言模式处理
if (mode && mode.doComplete) {
  return mode.doComplete(document, position);
}
```

每个 Mode 实现统一接口:
```typescript
interface LanguageMode {
  doComplete?(document, position): CompletionList;
  doHover?(document, position): Hover;
  findDefinition?(document, position): Definition;
  doValidation?(document): Diagnostic[];
  format?(document, range, options): TextEdit[];
  // ...
}
```

---

## 核心功能全栈实现

### 自动补全

**全链路**:
```
用户输入 "<" 
  → Client 收到 triggerCharacter
  → 发送 textDocument/completion 请求
  → Server VLS 收到
  → embeddedSupport 判断光标在 template 区域
  → 路由到 template Mode
  → template Mode 查询组件/标签数据库
  → 返回 CompletionList [{label: 'div'}, {label: 'text'}, ...]
  → Client 渲染补全列表
```

**定制点**: `server/src/modes/template/tagProviders/` 中定义了自有组件的标签和属性数据。

### 悬停提示

```
光标悬停在 "flex-direction"
  → 判断在 style 区域
  → 路由到 CSS Mode
  → CSS Language Service 返回属性描述
  → 显示 Hover tooltip
```

### 跳转定义

```
Ctrl+Click "this.message"
  → 判断在 script 区域
  → 路由到 JavaScript/TypeScript Mode
  → TypeScript Language Service 解析符号引用
  → 返回 Definition (file.ux, line 15, char 4)
```

**特殊处理**: template 中引用 script 变量时需要跨区域跳转:
```typescript
// server/src/modes/embeddedSupport.ts → getPositionInScript()
// 在 template 中点击变量名 → 定位到 <script> 区域的定义位置
```

### 诊断校验

```typescript
// VLS 中的诊断调度 (防抖 200ms)
private validationDelayMs = 200;
private pendingValidationRequests: { [uri: string]: NodeJS.Timer } = {};

// 编辑后 200ms 无新输入才触发校验
// 避免用户快速输入时频繁计算诊断
```

各 Mode 独立校验:
- template → HTML 校验 + 自定义组件属性校验
- style → CSS 语法校验
- script → TypeScript 类型检查
- json (data 块) → JSON Schema 校验

### 格式化

```
textDocument/formatting 请求
  → 按区域分别格式化:
     template → HTML 格式化 (prettier/html)
     style   → CSS 格式化 (prettier/stylus)
     script  → JS 格式化 (prettier/typescript)
  → 合并所有 TextEdit 返回
```

---

## 定制扩展点

相比原始 Vetur，本项目的主要定制:

| 定制点 | 说明 |
|--------|------|
| 文件类型 | `.vue` → `.ux` (documentSelector) |
| 标签数据 | 自有组件的标签/属性/事件补全数据 |
| `<data>` 块支持 | 新增 JSON Mode 处理 SFC 中的 data 块 |
| inline style 解析 | `style="..."` 属性内的 CSS 智能 |
| 组件库 Schema | 自有 UI 组件的属性验证规则 |
| CSS 扫描 | 工作区 CSS 类名收集用于补全 |
| Emmet 扩展 | 自定义 Emmet 配置 |

---

## 工程结构

```
hap-language-features/
├── client/                  ← Language Client (VSCode Extension 侧)
│   ├── client.ts            ← 初始化 LanguageClient，连接 Server
│   ├── vueMain.ts           ← Extension activate() 入口
│   ├── languages.ts         ← 注册 .ux 语言配置
│   └── PathIntellisense.ts  ← 路径补全增强
├── server/                  ← Language Server (独立 Node.js 进程)
│   └── src/
│       ├── vueServerMain.ts ← LSP 入口，创建 Connection + 注册 Capabilities
│       ├── services/
│       │   └── vls.ts       ← 核心协调类: 文档管理 + 请求路由 + 诊断调度
│       └── modes/
│           ├── embeddedSupport.ts  ← 关键: 多语言区域切割
│           ├── languageModes.ts    ← 语言模式注册/路由
│           ├── template/           ← HTML/模板 Mode (标签/组件补全)
│           ├── style/              ← CSS/SCSS/Less Mode
│           ├── script/             ← JS/TS Mode (依赖 TypeScript Service)
│           └── jsonData/           ← JSON Mode (data 块校验)
├── syntaxes/                ← TextMate 语法文件 (.ux 高亮规则)
├── snippets/                ← 代码片段
├── languages/               ← 语言配置 (括号匹配、注释规则等)
└── emmet/                   ← Emmet 缩写配置
```

---

## 小结

| 设计决策 | 第一性原理 |
|---------|-----------|
| Fork Vetur 而非从零开始 | 复用 > 重写 — 核心难题已解决，只定制差异 |
| Client/Server 分进程 | 隔离 — Server 崩溃不影响 IDE |
| 区域切割 + 虚拟文档 | 分治 — 单文件多语言 → 每种语言独立处理 |
| 空白填充保持 offset | 映射零成本 — Server 返回的位置直接可用 |
| 语言模式接口统一 | 多态 — 新增语言只需实现 LanguageMode 接口 |
| 防抖诊断 | 性能 — 不在每次按键都跑校验 |
| IPC 传输 | 效率 — 比 stdio 少一层文本协议解析 |
| triggerCharacters 全覆盖 | 体验 — 几乎任何输入都能触发补全 |
