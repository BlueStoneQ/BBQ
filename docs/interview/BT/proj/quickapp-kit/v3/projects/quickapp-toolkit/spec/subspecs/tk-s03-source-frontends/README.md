# TK-S03 UX/Script/Style Frontend

## 目录

- [1. 结论](#1-结论)
- [2. 本质](#2-本质)
- [3. 范围](#3-范围)
- [4. 输入与输出](#4-输入与输出)
- [5. 与 S02/S04 的边界](#5-与-s02s04-的边界)
- [6. 已验证事实与决策](#6-已验证事实与决策)
- [7. 交付物](#7-交付物)
- [8. 状态](#8-状态)

## 1. 结论

TK-S03 的唯一职责是：**把联盟 UX、JavaScript 和 CSS/Less 源码解析成保留精确位置的不可变语法事实，并把其中的外部引用交给 S02。**

```text
SourceAccess + requested logical path
  -> UX fragment parser
  -> Template / Script / Style parser
  -> feature gate
  -> ParsedSource + UnresolvedReference + Diagnostic
```

S03 不决定引用最终指向谁，不把联盟语义改写成 Runtime 语义，也不生成任何编译期或运行期 ID。

## 2. 本质

Frontend 只消除“源码文本如何被理解”的歧义。它必须保留：

1. 语法结构。
2. 原始 spelling。
3. byte offset 与 line/column。
4. Case-derived V1 支持边界。

关系解析属于 S02，规范语义与稳定 ID 属于 S04。

## 3. 范围

### 3.1 负责

- 分解 `.ux` 顶层 template/script/style fragment。
- 解析 Template element、text、attribute、event、interpolation、`if`、`for`、`tid`。
- 解析 App/Page/Shared JavaScript 与模板内 JavaScript expression。
- 发现 ESM import、CommonJS require、`require.context` 和 `@system.*` 引用。
- 解析 CSS/Less rule、selector、declaration、import、variable、mixin、arithmetic 和 nesting。
- 保留所有节点与引用的精确 SourceRange。
- 冻结并执行 Case-derived Feature Matrix，给出稳定 syntax/unsupported Diagnostic。
- 输出不可变 `ParsedSourceSet` 与 `UnresolvedReference`。

### 3.2 不负责

- Manifest、route、moduleId、引用 target、可达图、asset ownership 或 Capability 声明关系。
- `div/text/input` 到 `View/Text/Button` 的映射。
- Style 值求值、单位规范化、selector 匹配或 Host Style。
- VM 语义、响应式依赖、Binding/Block/Event target 或 handler method 存在性。
- Template/Binding/Block/Handler/Runtime ID。
- JS transform/bundle、Source Map emission、Page IR、Metadata 或 RPK。

## 4. 输入与输出

### 4.1 输入

- TK-S01 `SourceAccess`。
- S02 请求的 workspace-relative source path 与 source kind。
- Parser limits、取消令牌和 V1 Feature Matrix。

### 4.2 输出

- `ParsedUxSource`、`ParsedJavaScriptSource` 或 `ParsedStyleSource`。
- 统一 `SourceSpan` 与 `SourceLineMap`。
- `UnresolvedReference[]`：仅含原 specifier、reference kind、owner path 和 range。
- `FrontendFeatureUsage[]` 与 Diagnostic。

AST 与 parser handle 只活在一次 Build Session，不属于公共 Artifact，不得序列化进 RPK。

## 5. 与 S02/S04 的边界

| 阶段 | 消费 S03 什么 | 不得做什么 |
|---|---|---|
| S02 | `UnresolvedReference` | 重新 tokenize/parse 源码 |
| S04 | Template/Script/Style AST 与 feature usage | 根据原始字符串再猜联盟语法 |
| S05 | S04 Lowered Model | 直接依赖 S03 parser AST |

S03 不读取 Manifest 来决定 route/module；同一 parser 可对 S02 请求的 App、Page、Shared 和 Style source 工作。

## 6. 已验证事实与决策

### 6.1 已验证事实

- Case 001 `.ux` 包含 template/script/style，`app.ux` 只有 script。
- Case 001 使用 ESM、CommonJS、`require.context`、global 注入与 Less import/mixin/arithmetic/nested selector/shorthand。
- Case 002 使用插值、`if`、`for="{{ (index, item) in items }}"` 和 `tid="id"`。
- 联盟 Toolkit 实际按 fragment/template/script/style loader 拆分处理源码。

### 6.2 冻结决策

- UX 使用带位置的 HTML fragment parser并拒绝 recovery error；JavaScript/表达式使用同一 ESTree-compatible parser；Style 使用保留 Less 节点与位置的 PostCSS-compatible parser。
- S03 不使用正则拆 UX，不使用字符串搜索发现 import，不执行 JavaScript 或 Less。
- V1 source feature 必须在 Feature Matrix 中是 `supported`；未知但语法合法的联盟 feature 也必须明确诊断，不能透传给 S04 猜测。
- Feature Matrix 是 Toolkit 测试合同，不是 Runtime Artifact 字段。

## 7. 交付物

1. [Requirements](./requirements.md)
2. [Design](./design.md)
3. [Tasks](./tasks.md)
4. [Acceptance](./acceptance.md)

## 8. 状态

`READY_FOR_REVIEW`：只完成分 Spec；产品代码仍为 `CODE_BLOCKED`，TK-S04 未启动。
