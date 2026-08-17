# TK-S03 Design

## 目录

- [1. 结论](#1-结论)
- [2. 分层与流程](#2-分层与流程)
- [3. 公共前端模型](#3-公共前端模型)
- [4. UX 与 Template Frontend](#4-ux-与-template-frontend)
- [5. JavaScript Frontend](#5-javascript-frontend)
- [6. Style Frontend](#6-style-frontend)
- [7. Feature Matrix](#7-feature-matrix)
- [8. Source Position 与诊断](#8-source-position-与诊断)
- [9. 与 S02/S04 的合同](#9-与-s02s04-的合同)
- [10. 限制、生命周期与实现结构](#10-限制生命周期与实现结构)

## 1. 结论

采用**三类 parser adapter + 一套 compiler-owned syntax model**：成熟 parser 负责正确识别语法，S03 将结果规范为不可变、带统一 SourceSpan 的前端模型；第三方 parser AST 不成为跨阶段合同。

```text
SourceAccess
  -> UxFragmentParser
       -> TemplateParser
       -> JavaScriptParser
       -> StyleParser
  -> SyntaxNormalizer
  -> FeatureGate
  -> ParsedSource + UnresolvedReference + Diagnostic
```

Parser 只回答“源码写了什么”；S02 回答“引用指向谁”；S04 回答“这些语法对应什么规范 Runtime 语义”。

## 2. 分层与流程

| 部件 | 负责 | 不负责 |
|---|---|---|
| SourceFrontend | source kind 分派、限制、取消、结果原子性 | 路径解析、Lowering |
| UxFragmentParser | template/script/style section 与原文件 offset | section 内容语义 |
| TemplateParser | element/text/attribute/interpolation/directive AST | Host Component、Binding/Block/Event |
| JavaScriptParser | Program/expression AST、module reference discovery | transform、bundle、执行 |
| StyleParser | CSS/Less syntax、import/url discovery | Less 求值、Host Style |
| SyntaxNormalizer | parser AST -> compiler-owned syntax model | 规范组件或 Artifact |
| FeatureGate | V1 matrix 与稳定 unsupported Diagnostic | 猜测未来语义 |

每个 source 的流程：

1. 通过 `SourceAccess` 读取 strict UTF-8 SourceUnit。
2. 建立 `SourceCoordinateMap`。
3. 按 source kind 调用对应 parser adapter。
4. 把 parser location 统一映射到原 SourceUnit 的 `SourceSpan`。
5. 从 AST 提取但不解析 target 的 `UnresolvedReference`。
6. 执行 FeatureGate；有 error 时不返回 ParsedSource。
7. 冻结 AST、reference、feature usage 和 Diagnostic。

## 3. 公共前端模型

模型是 Toolkit 内部跨阶段合同，不是公共 wire Schema：

```text
ParsedSource = ParsedUxSource | ParsedJavaScriptSource | ParsedStyleSource

ParsedSourceBase {
  sourcePath: workspace-relative POSIX path
  sourceKind: appUx | pageUx | sharedJs | style
  sourceSha256: lowercase hex
  references: UnresolvedReference[]
  featureUsage: FrontendFeatureUsage[]
}

SourceSpan {
  startByte: non-negative integer
  endByte: non-negative integer, exclusive
  start: { line, column }
  end: { line, column }
}

UnresolvedReference {
  kind: scriptImport | scriptRequire | scriptContext | capability | styleImport | styleUrl
  ownerSourcePath: string
  specifier: string
  span: SourceSpan
  context?: { recursive, regexpSource, regexpFlags }
}
```

`ParsedUxSource` 保存 fragment、Template syntax、Script syntax 与 Style syntax；Shared JS/外部 Style 分别使用同一 Script/Style syntax。所有 list 保持源码顺序；用于比较或诊断的派生列表另行确定排序。

Compiler-owned model 不携带 parser class instance、mutable parent pointer、absolute path、route、moduleId 或 Artifact 字段。

## 4. UX 与 Template Frontend

### 4.1 UX fragment

使用带 source location 和 parse-error callback 的 HTML fragment parser。任何 recovery error 都转换为 Diagnostic，不能依赖 parser 修复后的树继续编译。

顶层规则：

- fragment 名只允许 `template`、`script`、`style`。
- 每类最多一次。
- fragment 之间只允许空白 text/comment。
- App：script 必需，style 可选，template 禁止。
- Page：template/script 必需；style 可选。
- `style` 只允许无 `lang` 或 `lang="less"`。

Fragment content span 必须指向原 `.ux` 内容，不新建坐标原点。

### 4.2 Template syntax

```text
TemplateSyntax {
  root: ElementSyntax
}

TemplateChild = ElementSyntax | TextSyntax | InterpolationSyntax

ElementSyntax {
  tagName
  attributes: AttributeSyntax[]
  children: TemplateChild[]
  selfClosing
  span
}

AttributeSyntax {
  name
  rawValue
  valueKind: static | interpolation | ifDirective | forDirective
  span
}
```

Comment 不进入 semantic child；空白 text 保留源码位置但标记 `ignorableWhitespace`，单根校验忽略它。

文本中的 `{{ ... }}` 被拆成有序 static/interpolation segment。空表达式、未闭合 delimiter 和嵌套 delimiter 失败；expression 交给 JavaScript expression parser。

### 4.3 Directive syntax

`if="{{ expression }}"` 只记录 expression AST。

V1 `for` 语法固定为：

```text
"{{ (indexAlias, itemAlias) in iterableExpression }}"
```

S03 校验 aliases 是不同 identifier，并保存 iterable AST；`tid` 保存静态 spelling。是否能成为稳定 key、如何生成 Block，由 S04 决定。

`onclick` 只接受 identifier spelling。S03 不检查 export default 中是否存在同名方法。

## 5. JavaScript Frontend

### 5.1 Parser profile

使用固定版本、固定 plugin 集的 ESTree-compatible JavaScript parser：

- `sourceType=module`，同时允许顶层 CommonJS call。
- 保留 comment、token 和 range。
- App/Page/Shared 使用同一 ECMAScript target profile。
- Template expression 使用同一 expression parser 与 plugin 集。

不得执行 Babel transform、constant folding、module resolution 或源码。

### 5.2 Program 约束

App/Page script 必须且只能有一个 `export default`；该要求只验证导出形态，不解释 VM data、lifecycle 或 method。

Shared JS 可有 ESM/default export，也可出现 CommonJS `require`。S03 保留 AST，S05 才负责 module transform 与 bundle。

### 5.3 Reference discovery

AST visitor 只识别：

```text
import ... from "specifier"
require("specifier")
require.context("directory", boolean, /regexp/flags)
```

- `@system.<name>` 产生 `capability` reference，保留原 specifier。
- 相对 import/require 产生 script reference。
- bare package、URL、dynamic import 和非 literal call 产生 unsupported Diagnostic。
- `require.context` 只保存 literal 参数；S03 不枚举目录、不应用 RegExp。
- `global`、`global.__proto__` 与 `$page` 只是 AST identifier/member，不在 S03 改写。

相同 specifier 的多次出现保留各自 SourceSpan；S02 再合并 graph edge evidence。

## 6. Style Frontend

### 6.1 Parser profile

使用 PostCSS-compatible parser；CSS fragment 使用标准 grammar，Less fragment 使用固定 Less syntax adapter。Parser 必须保留 rule、at-rule、declaration、comment、raw spelling 和位置。

S03 只建语法树，不调用 Less renderer。因此：

- `@import` 不在 S03 读取 target。
- variable 不替换。
- mixin 不展开。
- arithmetic 不计算。
- nested selector 不展开。
- shorthand 不拆分。
- property 不 camelCase。

上述求值与 Host 规范化由 S04 统一完成。

### 6.2 Style reference

只从 parser node 识别 literal local `@import` 和 local `url(...)`，产生 `styleImport` 或 `styleUrl`。remote URL、data URI、带动态 interpolation 的 path 和 parser 未理解的 import option 在 V1 失败。

S02 决定 target path、可达性和 cycle；S03 不访问 imported file，除非 S02 随后单独请求解析该 source。

## 7. Feature Matrix

Feature Matrix 是版本化测试合同：

```text
FrontendFeature {
  featureId
  sourceKind
  status: supported | rejectedV1
  evidence: case001 | case002 | focused | negative
  ownerPhase: frontend | lowering | emitter
}
```

### 7.1 Template matrix

| featureId | V1 | evidence | S03 产物 |
|---|---|---|---|
| `ux.fragment.app-script-optional-style` | supported | Case 001/002 | Script/Style syntax |
| `ux.fragment.page-template-script-style` | supported | Case 001/002 | 三类 fragment |
| `template.tag.div/text/input` | supported | Case 001/002 | 原联盟 tag |
| `template.attr.class/type/value` | supported | Case 001/002 | static/interpolated attr |
| `template.event.onclick` | supported | Case 001/002 | method spelling |
| `template.directive.if` | supported | Case 002 | expression syntax |
| `template.directive.for-tid` | supported | Case 002 | aliases/iterable/tid |
| `template.dynamic-class/style` | rejectedV1 | negative | Diagnostic |
| `template.custom-component/slot` | rejectedV1 | negative | Diagnostic |
| `template.event.capture/bubble-control` | rejectedV1 | negative | Diagnostic |

### 7.2 Script matrix

| featureId | V1 | evidence |
|---|---|---|
| `script.es-import-export-default` | supported | Case 001/002 |
| `script.commonjs-require-literal` | supported | Case 001 |
| `script.require-context-literal` | supported | Case 001 |
| `script.global-injection` | supported | Case 001 |
| `script.object-method/arrow/default-param/template-literal` | supported | Case 001/002 |
| `script.promise/prototype-member/for-in` | supported | Case 001 |
| `script.dynamic-import/nonliteral-require` | rejectedV1 | negative |
| `script.package/url-module` | rejectedV1 | negative |

### 7.3 Style matrix

| featureId | V1 | evidence |
|---|---|---|
| `style.css-class/descendant-rule` | supported | Case 001/002 |
| `style.less-local-import` | supported | Case 001 |
| `style.less-variable` | supported | Case 001 |
| `style.less-mixin-declare-call` | supported | Case 001 |
| `style.less-arithmetic` | supported | Case 001 |
| `style.less-nested-selector` | supported | Case 001 |
| `style.css-shorthand` | supported | Case 001 |
| `style.remote-import/dynamic-path` | rejectedV1 | negative |
| `style.animation/media/custom-property` | rejectedV1 | negative |

`supported` 在 S03 只表示可被正确解析并送往 owner phase；不表示 S03 已完成 Lowering 或 Emitter。

## 8. Source Position 与诊断

### 8.1 Coordinate map

SourceUnit bytes 是唯一坐标事实。`SourceCoordinateMap` 一次建立：

- parser 的 UTF-16/code-unit offset 映射为 UTF-8 byte offset。
- line/column 都为 1-based，end-exclusive。
- column 按 Unicode scalar value 计数，tab 计一个 column。
- CRLF 与 LF 都映射到一致逻辑行；byte span 仍保留原 bytes。
- fragment-local offset 加回原 `.ux` content start 后再映射。

多字节文本 Golden 必须覆盖中文、ASCII 与 CRLF。

### 8.2 Diagnostic

| code | 语义 |
|---|---|
| `TK_UX_FRAGMENT_INVALID` | UX 顶层 fragment 结构错误 |
| `TK_UX_FRAGMENT_DUPLICATE` | fragment 重复 |
| `TK_UX_TEMPLATE_REQUIRED` | Page 缺 template |
| `TK_UX_SCRIPT_REQUIRED` | App/Page 缺 script |
| `TK_TEMPLATE_SYNTAX_ERROR` | Template 结构或 interpolation 错误 |
| `TK_TEMPLATE_MULTIPLE_ROOTS` | Page 多根 |
| `TK_TEMPLATE_FEATURE_UNSUPPORTED_V1` | tag/attr/event/directive 不在矩阵 |
| `TK_TEMPLATE_FOR_INVALID` | for aliases/expression 形态错误 |
| `TK_SCRIPT_SYNTAX_ERROR` | JavaScript parser 失败 |
| `TK_SCRIPT_DEFAULT_EXPORT_REQUIRED` | App/Page default export 错误 |
| `TK_SCRIPT_MODULE_REFERENCE_UNSUPPORTED` | dynamic/bare/非 literal 引用 |
| `TK_STYLE_SYNTAX_ERROR` | CSS/Less parser 失败 |
| `TK_STYLE_FEATURE_UNSUPPORTED_V1` | style feature 不在矩阵 |
| `TK_FRONTEND_LIMIT_EXCEEDED` | bytes/nodes/depth/token/reference 超限 |

第三方 parser message 可放开发 detail，但自动化只依赖稳定 code、phase、file 和 range。

## 9. 与 S02/S04 的合同

### 9.1 SourceFrontendPort

```text
parse({
  sourcePath,
  sourceKind,
  sourceAccess,
  limits,
  cancellation
}) -> success {
  parsedSource
  references
  diagnostics
} | failure {
  diagnostics
}
```

S02 只读取 `references` 与 source hash；不得遍历 AST。S03 不读取 Manifest 或解析 target。

### 9.2 ParsedSourceSet

Graph closure 成功后，Build Session 以 sourcePath 唯一索引全部 ParsedSource。S04 同时接收：

```text
ResolvedAppModel from S02
ParsedSourceSet from S03
```

S04 必须按 S02 module/source relation 取得 AST，不得自行扫描 Workspace；S03 不预建 Semantic/Lowered Model。

## 10. 限制、生命周期与实现结构

建议实现边界：

```text
src/compiler/frontend/
  source-frontend.ts
  source-coordinate-map.ts
  ux/
  script/
  style/
  feature-matrix.ts
```

每次 parse 都检查 cancellation；parser adapter 不拥有线程或全局 cache。可受控并行解析不同 SourceUnit，但结果由 Build Session 按 sourcePath 合并。ParsedSource 使用只读结构并共享 SourceUnit text，不复制 bytes；S04 完成后统一释放 AST、tokens、comments 和 coordinate map。

限制至少包含：`maxSourceBytes`、`maxAstNodes`、`maxDepth`、`maxTokens`、`maxReferences`、`maxSelectorLength`、`maxExpressionLength`。超限是确定失败，不截断 AST 后继续。
