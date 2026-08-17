# TK-S03 Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 功能需求](#2-功能需求)
- [3. 质量需求](#3-质量需求)
- [4. 非目标](#4-非目标)
- [5. 上游映射](#5-上游映射)

## 1. 结论

TK-S03 必须把每个受支持源码结构解析为不可歧义、可定位、可供 S02/S04 消费的语法事实；Parser 不得偷偷承担路径解析、Lowering 或代码生成。

## 2. 功能需求

| ID | 需求 |
|---|---|
| TK-S03-R01 | 所有源码必须通过 `SourceAccess.read(..., strictUtf8)` 获取；Parser 不得直接读取文件系统或缓存可变文件。 |
| TK-S03-R02 | `.ux` 必须用结构化 fragment parser 分解，保留 fragment 和 content 的 byte offset/range；不得用正则或字符串切片猜 section。 |
| TK-S03-R03 | `.ux` 顶层只允许最多一个 template、一个 script、一个 style；未知 fragment、重复 fragment、嵌套顶层 fragment 和 parser recovery error 必须失败。 |
| TK-S03-R04 | App UX V1 必须有 script、可有 style、不得有 template；Page UX V1 必须恰有一个 template 和一个 script，style 可选。 |
| TK-S03-R05 | style fragment 只允许无 lang 或 `lang="less"`；script/template fragment 的 V1 未知配置属性必须诊断。 |
| TK-S03-R06 | Template parser 必须保留有序 element/text child、tag、attribute、原始 value、self-closing 事实和 SourceRange，并忽略 comment 对语义 child 数量的影响。 |
| TK-S03-R07 | Page template 忽略空白 text/comment 后必须恰有一个根 element；多根、无根、错误闭合和非法 attribute 必须失败。 |
| TK-S03-R08 | V1 Template feature matrix 必须支持 Case 001/002 的 `div`、`text`、`input`、class、type、value、onclick、interpolation、if、for、tid；矩阵外 tag/attribute/event/directive 必须稳定诊断。 |
| TK-S03-R09 | interpolation 与 directive expression 必须由 JavaScript expression parser 解析并保留 expression AST/range；不得通过字符串分割计算 Binding。 |
| TK-S03-R10 | `if` 必须解析一个 expression；`for` 必须解析 Case 002 形态 `(index, item) in expression`，并保留 aliases、iterable expression 与 `tid` spelling；S03 不生成 Block 或 key evaluator。 |
| TK-S03-R11 | `onclick` 必须解析为静态 VM method name spelling；事件 target、TemplateHandlerId 和方法存在性由 S04 处理。 |
| TK-S03-R12 | JavaScript parser 必须支持 Case 001/002 实际使用的 module/object/function/class-free language syntax，并保留完整 AST、comments、tokens 与 range。 |
| TK-S03-R13 | App/Page script 必须存在唯一 `export default`；Shared JS 可使用 ESM/default export 或 CommonJS 语法；S03 不评估导出对象。 |
| TK-S03-R14 | 必须从 AST 发现 static ESM import、literal `require()`、literal `require.context()` 和 `@system.*` specifier，输出 `UnresolvedReference`；不得用文本搜索。 |
| TK-S03-R15 | dynamic import、非 literal require、非 literal context directory/recursive/RegExp、unsupported bare module syntax 必须在 Frontend 阶段失败。 |
| TK-S03-R16 | `require.context` 必须保留 directory string、recursive boolean、RegExp source/flags 和 range；文件枚举与 target 解析只属于 S02。 |
| TK-S03-R17 | `global`、`global.__proto__`、ES import/CommonJS require 共存必须被 Case 001 parser 接受；S03 不改写 global 或 module ABI。 |
| TK-S03-R18 | Style parser 必须支持 CSS 与 Case 001 Less：local `@import`、variable、mixin declaration/call、arithmetic、nested selector、descendant selector 与 shorthand，并保留 AST/range。 |
| TK-S03-R19 | Style parser 只输出原 selector/value/at-rule 结构与 unresolved import/url reference；不得执行 Less、展开 mixin、计算 arithmetic、camelCase property 或规范化 Host Style。 |
| TK-S03-R20 | Feature Matrix 必须逐项记录 featureId、source kind、status、Case evidence 和 owner phase；Case 001/002 必需项只能是 `supported`，不能降级为 warning。 |
| TK-S03-R21 | 每个 AST node、reference 和 Diagnostic 必须使用统一 0-based byte offset 内部表示，并公开 1-based、end-exclusive line/column；UX fragment 内部位置必须映射回原 `.ux` 文件。 |
| TK-S03-R22 | 语法 error 不得返回可供 S04 使用的 ParsedSource；warning 不得丢失 AST 或引用。Diagnostic 必须有稳定 code、phase、file、range 和 hint。 |
| TK-S03-R23 | 输出必须不可变、确定排序；同一 SourceUnit 与 parser/version/options 必须产生等价 AST snapshot、reference 和 Diagnostic。 |
| TK-S03-R24 | Parser 必须有 source bytes、AST nodes、nesting depth、tokens、references、selector 和 expression 长度上限，并响应取消。 |
| TK-S03-R25 | S03 输出不得包含 route、moduleId、resolved path target、Capability 声明状态、Host Component/Style、Template/Binding/Block/Handler/Runtime ID 或 Artifact 字段。 |

## 3. 质量需求

| 维度 | 要求 |
|---|---|
| 位置正确性 | 所有 fragment 内 Diagnostic 可精确回映原 `.ux`，支持多字节 UTF-8。 |
| 确定性 | Parser option、语言版本、plugin 集和 AST snapshot 规范固定。 |
| 安全 | 不执行 JS/Less，不加载网络资源，不调用 package resolution，不容忍 parser recovery 继续编译。 |
| 单一所有权 | S03 发现 specifier；S02 唯一解析 target；S04 唯一 Lowering。 |
| 内存 | AST 只活在 Build Session，禁止把 SourceUnit bytes 在多个 parser model 中复制。 |
| 可诊断 | Parser 原始异常必须映射稳定 code，不把第三方错误文本作为自动化合同。 |

## 4. 非目标

- Manifest、route、module graph、asset/capability relation。
- JavaScript transform、module bundling、VM 执行或 ABI emission。
- Less evaluation、CSS cascade、Host Style normalization。
- Binding dependency、Block semantics、event target 或 ID allocation。
- Source Map、Page IR、Runtime Metadata、RPK。

## 5. 上游映射

| 上游 | 覆盖 |
|---|---|
| `TK-R03` | R02-R11、R20-R25 |
| `TK-R18` | R12-R20 与 Feature Matrix Golden |
| `TK-R11` | R09-R11 只解析 if/for/tid，Lowering 后置 |
| TK-S01 | SourceAccess、SourceUnit、Diagnostic、取消与 Build Session |
| TK-S02 | 消费 UnresolvedReference，S03 不解析 target |
