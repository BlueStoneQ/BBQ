# TK-S03 Acceptance

## 目录

- [1. 结论](#1-结论)
- [2. Case 正例](#2-case-正例)
- [3. 语法与边界负例](#3-语法与边界负例)
- [4. 位置、确定性与资源](#4-位置确定性与资源)
- [5. 需求覆盖](#5-需求覆盖)
- [6. 证据与通过条件](#6-证据与通过条件)

## 1. 结论

TK-S03 通过的本质是：Case 001/002 的每个 UX/JS/style 语法都被结构化 parser 正确识别并定位；任何矩阵外语义都明确失败，同时输出中不存在引用 target、Lowering 或 Artifact 事实。

## 2. Case 正例

### 2.1 Case 001

| Case | 必须结果 |
|---|---|
| `S03-P01` App UX | script-only App 合法；唯一 default export；两个 local require；global 注入被解析 |
| `S03-P02` Demo UX | 单根 div；title interpolation；input button/value/onclick；router Capability import |
| `S03-P03` Detail UX | 多个 text child、中文 text、interpolation、onclick；不丢失源码顺序 |
| `S03-P04` Shared JS | ESM、CommonJS、arrow/default param/template literal/Promise/for-in 均可解析 |
| `S03-P05` require.context | 精确得到 directory `.`、recursive `true`、RegExp `\.js` 与 SourceRange，不枚举文件 |
| `S03-P06` Capability refs | router、prompt、fetch 只输出原 specifier reference，不标 required/deferred |
| `S03-P07` Less | 三层 local import、variable、mixin 声明/调用、arithmetic、nested/descendant selector 和 shorthand 全部在 AST/matrix 中 |
| `S03-P08` Widget source | 单独请求时语法可解析；正常 S02 V1 图不会请求它，排除责任仍在 S02 |

### 2.2 Case 002

| Case | 必须结果 |
|---|---|
| `S03-P09` Contract template | 单根；count interpolation；if expression；for aliases/iterable/tid；onclick spelling |
| `S03-P10` Contract script | private 初值、onUpdate method、assignment/update/array/member expression 均保留 AST |
| `S03-P11` Contract style | CSS class rule、declaration、color 与 px value 可解析，未 Host normalize |

### 2.3 Feature Matrix

`S03-P12` 必须逐项执行 design §7 的 supported feature；每项至少关联一个 Case source/range。`supported` 只证明 Frontend 解析，不冒充 Lowering/Emitter 成功。

## 3. 语法与边界负例

| Case | 预期 |
|---|---|
| `S03-N01` duplicate/unknown/malformed UX fragment | `TK_UX_FRAGMENT_DUPLICATE` / `TK_UX_FRAGMENT_INVALID`；无 ParsedUxSource |
| `S03-N02` App 无 script/含 template、Page 无 template/script | required/fragment Diagnostic：`TK_UX_SCRIPT_REQUIRED`、`TK_UX_TEMPLATE_REQUIRED` 或 `TK_UX_FRAGMENT_INVALID` |
| `S03-N03` Page 空根/多根/错误闭合 | `TK_TEMPLATE_MULTIPLE_ROOTS` 或 `TK_TEMPLATE_SYNTAX_ERROR` + 原 UX range |
| `S03-N04` 未闭合/空 interpolation | `TK_TEMPLATE_SYNTAX_ERROR` |
| `S03-N05` malformed if/for 或重复 aliases | `TK_TEMPLATE_FOR_INVALID` 或 `TK_TEMPLATE_SYNTAX_ERROR` |
| `S03-N06` unknown tag/attr/event/dynamic class | `TK_TEMPLATE_FEATURE_UNSUPPORTED_V1` |
| `S03-N07` App/Page 无或重复 default export | `TK_SCRIPT_DEFAULT_EXPORT_REQUIRED` |
| `S03-N08` dynamic import、非 literal require/context | `TK_SCRIPT_MODULE_REFERENCE_UNSUPPORTED` |
| `S03-N09` bare package/URL module | unsupported Diagnostic；S02 未调用 |
| `S03-N10` malformed JS/expression | `TK_SCRIPT_SYNTAX_ERROR` / `TK_TEMPLATE_SYNTAX_ERROR` |
| `S03-N11` malformed Less/CSS | `TK_STYLE_SYNTAX_ERROR` |
| `S03-N12` remote/dynamic style path、animation/media/custom property | `TK_STYLE_FEATURE_UNSUPPORTED_V1` |
| `S03-N13` 任一 bytes/node/depth/token/reference limit | `TK_FRONTEND_LIMIT_EXCEEDED`；无截断 AST |
| `S03-N14` Fake S02 注入 route/moduleId/capability declaration | S03 输出不变化，证明无反向依赖 |
| `S03-N15` AST/Reference 字段扫描 | 不存在 resolved target、Host Component、Template/Runtime ID 或 Artifact 字段 |

## 4. 位置、确定性与资源

1. 中文 text、emoji、ASCII、CRLF/LF、UX fragment 内 script/style error 的 byte span 与 line/column Golden 正确。
2. 同一 SourceUnit 连续解析两次，规范 AST snapshot、reference、feature usage 与 Diagnostic 字节一致。
3. parser adapter 返回顺序或并发完成顺序变化，不改变按 sourcePath 合并后的 ParsedSourceSet。
4. 取消后不再发布 ParsedSource；late parser callback 被丢弃。
5. 连续 100 次解析后 AST、token、coordinate map 和 parser handle 回到基线。
6. 产品依赖锁文件固定 parser 版本；升级 parser 必须重跑全部 Golden。

## 5. 需求覆盖

| 需求 | 证据 |
|---|---|
| R01-R05 | S03-P01/P02/P09、S03-N01/N02 |
| R06-R11 | S03-P02/P03/P09、S03-N03..N06 |
| R12-R17 | S03-P01/P04..P06/P10、S03-N07..N10 |
| R18-R20 | S03-P07/P11/P12、S03-N11/N12 |
| R21-R24 | 位置、确定性、限制、取消与资源测试 |
| R25 | S03-N14/N15、boundary scan |

## 6. 证据与通过条件

必须提交：

- Case 001/002 每个 source 的 fragment/AST/reference/feature 摘要 Golden。
- Feature Matrix 全项执行结果。
- 中文与 CRLF 位置 Golden。
- parser syntax、unsupported、limit 和取消结构化负例。
- Fake S02/Fake S04 隔离测试及真实 S02 联调结果。
- typecheck、lint、unit、integration、determinism、resource、dependency 与禁止范围扫描。

全部需求通过、无公共合同冲突并经总架构校审后，才可获得编码许可；TK-S04 仍由下一波次门禁控制。
