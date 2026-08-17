# TK-S02 Design

## 目录

- [1. 结论](#1-结论)
- [2. 分层与流程](#2-分层与流程)
- [3. 核心模型](#3-核心模型)
- [4. Manifest 解析](#4-manifest-解析)
- [5. Module identity 与解析](#5-module-identity-与解析)
- [6. Capability 与资源](#6-capability-与资源)
- [7. 图不变量](#7-图不变量)
- [8. 与 S03/S04 的合同](#8-与-s03s04-的合同)
- [9. 错误与限制](#9-错误与限制)
- [10. 生命周期与实现结构](#10-生命周期与实现结构)

## 1. 结论

采用**声明驱动、入口可达、解析与语法分离**的图构建：Manifest 先建立 App/Page 入口，S03 只解析每个被请求源码并返回引用，S02 解析引用并继续扩展，直到得到闭包。

```text
ManifestResolver
  -> ManifestPlan
  -> GraphBuilder seeds App + Pages
  -> SourceFrontendPort.parse(path)
  -> UnresolvedReference[]
  -> ReferenceResolver
  -> next reachable source / asset / capability
  -> immutable ResolvedAppModel
```

## 2. 分层与流程

| 部件 | 负责 | 不负责 |
|---|---|---|
| ManifestParser | strict JSON、位置、重复 key | route/path 语义 |
| ManifestResolver | package/route/page/feature/widget/resource 声明 | UX/JS/Less 语法 |
| GraphBuilder | 入口、队列、node/edge、可达闭包 | 从源码文本找 import |
| ReferenceResolver | local/context/asset/capability target | AST 遍历 |
| ModuleIdentity | App/Page/Shared moduleId | Bundle path、templateId |
| GraphValidator | 唯一性、ownership、边合法性、限制 | Runtime 兼容性 |

阶段顺序固定：

1. 从 `WorkspaceContext.manifest` 解析并校验 Manifest。
2. 建立 App 与普通 Page seed；Widget 记录 warning 后排除。
3. 按 moduleId UTF-8 顺序取一个待解析源码，调用 S03。
4. S02 解析 S03 返回的引用；新 Shared module 入队，Asset/Capability 记边。
5. 队列清空后校验全图并冻结输出。
6. 任一 error 时丢弃模型，只返回排序后的 Diagnostic。

## 3. 核心模型

以下是 Build Session 私有 typed model，不是 Artifact 字段：

```text
ResolvedAppModel {
  manifest: ResolvedManifest
  entryRoute: RuntimeRoute
  appModule: ModuleNode
  pageModules: ModuleNode[]
  sharedModules: ModuleNode[]
  assets: AssetNode[]
  capabilities: CapabilityRelation[]
  graph: ModuleGraph
  excludedWidgets: ExcludedWidget[]
}

ModuleNode {
  moduleId: string
  kind: app | page | shared
  sourcePath: workspace-relative POSIX path
  manifestRoute?: string
  route?: string
  component?: string
}

GraphEdge {
  fromModuleId: string
  kind: script | style | asset | capability
  specifier: string
  target: moduleId | sourcePath | capabilityName
  references: SourceRangeEvidence[]
}
```

`ResolvedManifest` 保留公共 Manifest 所需字段和位置索引，但不提前创建 Runtime Metadata、Artifact Descriptor 或输出 member path。

## 4. Manifest 解析

### 4.1 Parser

实现必须使用结构化 JSON CST/parser 并保留 byte offset；不得用正则提取字段。Parser 配置为 strict JSON，并显式检测重复 key。offset 通过统一 `SourceLineMap` 转为 1-based、end-exclusive range。

公共 `manifest.schema.json` 是字段结构下限；S02 额外校验路径、唯一性、V1 排除语义和引用关系，但不复制 Schema 内容。

### 4.2 Route 与页面

```text
manifestRoute = router.pages 的原 key
runtimeRoute  = "/" + manifestRoute
sourcePath    = sourceRootLogical + "/" + manifestRoute + "/" + component + ".ux"
pageModuleId  = "@quickapp-kit/page/" + manifestRoute
```

不执行 trim、大小写折叠、Unicode normalization 或 percent decode。任何需要这些修复才合法的输入直接诊断。

页面按 manifestRoute 的 UTF-8 bytes 排序；对象字段书写顺序不改变输出。entry 只能引用普通 page，不能引用 Widget。

### 4.3 Widget

`router.widgets` 中每个声明形成：

```text
ExcludedWidget {
  manifestKey
  code: TK_WIDGET_EXCLUDED_V1
  range
}
```

它不成为 seed，其源码、私有 features 和资源不进入 V1 可达闭包。

## 5. Module identity 与解析

### 5.1 Identity

| kind | moduleId |
|---|---|
| App | `@quickapp-kit/app` |
| Page | `@quickapp-kit/page/<manifestRoute>` |
| Shared JS | `@quickapp-kit/shared/<path relative to sourceRoot without .js>` |

Shared path 必须保留目录和大小写；移除且只移除末尾 `.js`。两个源路径不得映射到同一 moduleId。

UX 文件只对应 App 或 Page module，不成为 Shared module。CSS/Less 是 style dependency，不成为 Runtime JS module。

### 5.2 Local JS resolution

对 S03 返回的 relative script specifier，基于 owner source directory 依次尝试：

1. exact logical path；
2. `<specifier>.js`；
3. `<specifier>/index.js`。

只允许一个 target。非相对 bare package、绝对文件路径、URL、反斜线、越界和多 target 均失败。V1 不读取 `node_modules` 或 package.json resolution。

JS dependency ownership：

- App -> Shared/Capability：允许。
- Page -> Shared/Capability：允许。
- Shared -> Shared/Capability：允许。
- App/Page/Shared -> Page 或 App source：禁止。
- Shared JS cycle：保留为强连通分量，由后续 Module Loader cache 语义处理；图构建不得递归爆栈。

### 5.3 `require.context`

S03 只返回 literal directory、recursive boolean、RegExp source/flags 和 range。S02：

1. 解析 context root 并验证 containment。
2. 使用 `SourceAccess.list` 有界遍历。
3. 只匹配普通 `.js` source；不执行源码。
4. 以相对 context key 匹配 RegExp。
5. 按 UTF-8 logical path 排序后建立 Shared module edges。

动态 directory/recursive/RegExp 在 S03 已失败；超出 graph limit 在 S02 失败。

### 5.4 Style resolution

Style import 使用 exact、`.less`、`.css` 顺序；只允许一个 target。Style 图独立检测 cycle。S02 记录路径关系，S03 解析每个 style source；S02 不读取 selector/value AST。

## 6. Capability 与资源

### 6.1 Capability

规范 source specifier：

```text
@system.router -> system.router / required
@system.prompt -> system.prompt / required
@system.device -> system.device / required
@system.fetch  -> system.fetch  / deferred
```

`required` 表示 Runtime Artifact 后续必须声明可用 typed module；`deferred` 表示 Bundle 必须可加载，但 V1 调用固定 unsupported。两者都不是通用 Bridge。

Feature 集合与源码引用做连接：

- referenced + declared + supported/deferred：成功。
- referenced + undeclared：`TK_CAPABILITY_NOT_DECLARED`。
- referenced + declared + unsupported：`TK_CAPABILITY_UNSUPPORTED_V1`。
- declared + unreferenced：`declaredOnly`，不成为 Runtime requirement。

permissions 只保留 Manifest 原事实；S02 不计算授权。

### 6.2 Asset

Manifest `/assets/...` 解释为 sourceRoot-relative logical path，不解释为文件系统绝对路径。S03 发现的相对资源引用以 owner source directory 为基准。

AssetNode 只包含 source path、media kind、byteLength、sha256 和引用证据。输出 member path、mediaType 最终值和 Descriptor 由 TK-S07 冻结。

## 7. 图不变量

冻结前必须同时满足：

1. 恰有一个 App node，至少一个 Page node，entry Page 存在。
2. moduleId 与 sourcePath 各自唯一。
3. 所有 module edge target 存在并从 App 或 Page seed 可达。
4. Page 不能依赖 Page；任何模块不能依赖 App source。
5. Asset/Capability edge 有 owner 和至少一个 source evidence。
6. Widget 不出现在 node、edge、asset 或 capability 集合。
7. graph/page/module/edge/context/asset 数量不超过显式限制。
8. 输出排序不依赖 parser 对象 identity 或文件系统顺序。

## 8. 与 S03/S04 的合同

### 8.1 S03 Port

```text
SourceFrontendPort.parse({
  sourcePath,
  sourceKind: appUx | pageUx | sharedJs | style,
  sourceAccess,
  limits,
  cancellation
}) -> ParsedSourceResult

ParsedSourceResult.success {
  parsedSourceHandle
  references: UnresolvedReference[]
  diagnostics
}
```

`parsedSourceHandle` 由 S03 拥有，S02 只关联到 module，不检查 AST。

### 8.2 S04 输入

S04 同时接收 `ResolvedAppModel` 与 S03 `ParsedSourceSet`。S02 保证“指向谁”，S03 保证“源码结构是什么”；S04 才建立 component/style/binding/block/event 规范语义和稳定 Template ID。

## 9. 错误与限制

| code | 语义 |
|---|---|
| `TK_MANIFEST_INVALID_JSON` | Manifest 不是 strict JSON |
| `TK_MANIFEST_DUPLICATE_KEY` | JSON object 重复 key |
| `TK_MANIFEST_SCHEMA_INVALID` | 公共字段结构失败 |
| `TK_ROUTE_INVALID` | route/component 不可规范定位 |
| `TK_ROUTE_ENTRY_NOT_FOUND` | entry 不在普通 pages |
| `TK_MODULE_NOT_FOUND` | 引用无 target |
| `TK_MODULE_AMBIGUOUS` | 多个候选 target |
| `TK_MODULE_DEPENDENCY_INVALID` | ownership 或依赖方向非法 |
| `TK_MODULE_ID_CONFLICT` | moduleId 冲突 |
| `TK_CONTEXT_LIMIT_EXCEEDED` | context 枚举越界 |
| `TK_STYLE_IMPORT_CYCLE` | style import cycle |
| `TK_ASSET_UNSUPPORTED` | 资源类型不在 V1 输入集合 |
| `TK_CAPABILITY_NOT_DECLARED` | 使用但未声明 |
| `TK_CAPABILITY_UNSUPPORTED_V1` | 使用了 V1 未支持能力 |
| `TK_WIDGET_EXCLUDED_V1` | Widget 被明确排除，warning |

Diagnostic 使用 TK-S01 公共结构，phase 固定为 `manifest`、`moduleGraph`、`asset` 或 `capability`。

## 10. 生命周期与实现结构

建议实现边界：

```text
src/compiler/manifest/
src/compiler/module-graph/
```

所有状态属于一次 Build Session。GraphBuilder 串行提交 node/edge，parser 调用可以受控并发，但结果必须按规范 key 合并。输出冻结后不再持有 SourceUnit bytes；Build Session 结束统一释放 graph、position index 和 S03 handle。
