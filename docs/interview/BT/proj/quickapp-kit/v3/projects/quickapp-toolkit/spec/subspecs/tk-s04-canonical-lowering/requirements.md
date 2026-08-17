# TK-S04 Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 输入合同](#2-输入合同)
- [3. 语义 Lowering](#3-语义-lowering)
- [4. ID 与输出合同](#4-id-与输出合同)
- [5. 诊断与资源](#5-诊断与资源)
- [6. 质量需求](#6-质量需求)
- [7. 非目标](#7-非目标)
- [8. 上游映射](#8-上游映射)

## 1. 结论

TK-S04 必须对 Host、Style、Binding、Block 与 Event 各做且只做一次语义归一，并发布一份可被 TK-S05/TK-S06 无歧义投影的深不可变模型。

## 2. 输入合同

| ID | 需求 |
|---|---|
| TK-S04-R01 | 输入只能是同一 Build Session 的 `ResolvedAppModel`、`ParsedSourceModel`、`LoweringLimits` 与 `CancellationToken`；S04 不得调用 SourceAccess、文件系统或 parser。 |
| TK-S04-R02 | S04 必须在开始 Lowering 前验证两个输入运行时深不可变，且 package、page、module、sourcePath、source hash 与 owner 关系形成同一闭包快照；不一致必须整体失败。 |
| TK-S04-R03 | 每个可构建 Page 必须恰有一个已解析 page UX、一个 Template root、一个 Page script，并能访问其全部可达 Style AST；缺失、多重或孤立事实必须失败。 |
| TK-S04-R04 | S04 只消费 S02 已解析的 route/module/style/asset/capability 关系；不得根据原 specifier、路径字符串或源码文本再次解析 target。 |
| TK-S04-R05 | 输入顺序不得成为隐式语义。Page 以 manifest route 的 UTF-8 byte order 规范排序；源码 child、attribute、declaration 与 import 只在其语言语义要求时保留源码顺序。 |

## 3. 语义 Lowering

| ID | 需求 |
|---|---|
| TK-S04-R06 | S04 必须是联盟 tag/attribute 到公共 Host Component/prop 的唯一映射点；V1 只允许 `div -> View`、`text -> Text`、`input[type=button] -> Button`，未知或非法组合必须失败。 |
| TK-S04-R07 | Host props 与 style 必须严格符合公共 Host Component Contract；不得保留联盟 tag、class、Less token、CSS property spelling 或平台类型。 |
| TK-S04-R08 | S04 必须求值 Case 001 所需 Less V1 子集，展开 local import、variable、mixin、arithmetic、nesting 与 shorthand；所有展开受累计预算和循环检测约束。 |
| TK-S04-R09 | S04 必须按受支持的 class/descendant selector、specificity 与源码顺序执行确定性匹配和 cascade；V1 不做 style inheritance，unsupported selector/property/unit/value 必须失败而非静默忽略。 |
| TK-S04-R10 | 所有 `px` 长度必须转为 `logical-px`；颜色、枚举、长度、数值和 shorthand 必须规范为公共 Host Style 的唯一值形态。 |
| TK-S04-R11 | 一个动态 Host prop 必须且只能产生一个 Binding；同一 text/value 中多个 literal/interpolation segment 形成一个有序 evaluator，不得为每个 interpolation 建立独立 target。 |
| TK-S04-R12 | Text 与 Button `text` Binding 的 evaluator 必须显式产生 string；Case 002 `count=0` 必须得到 `"0"`。V1 动态 Host value 只允许公共合同规定的 string/boolean。 |
| TK-S04-R13 | Binding 必须同时保存静态 target、scope、compiler-owned expression/composition、result type 与 SourceSpan；S05 只消费求值语义，S06 只投影静态 target。 |
| TK-S04-R14 | `if` 必须 Lower 为一个 Block definition 和 boolean controller；带 `if/for` 的 element 是该 Block 的 template root，并只通过父 Node 的 block child slot 进入静态结构。 |
| TK-S04-R15 | `for` 必须 Lower 为 keyed Block definition，保存 iterable、index alias、item alias 与由 `tid` 形成的稳定 key evaluator；无 `tid`、非法 key path、重复 directive 或同 element 同时 `if+for` 必须失败。 |
| TK-S04-R16 | Block scope 必须遵循最近祖先 Block：顶层 Node/Binding/Handler 属于 Page scope；Block template root 及其后代属于最近 Block scope；嵌套 Block 覆盖外层 scope。 |
| TK-S04-R17 | `onclick` 必须 Lower 为 `click` Handler definition，保存 target Node、scope、method name 与 SourceSpan；同一 Node/Event 只能有一个 Handler。 |
| TK-S04-R18 | Handler method 必须静态解析到当前 Page `export default` 对象中唯一可调用 method；computed name、spread 注入、动态 handler expression 或缺失 method 必须失败。 |
| TK-S04-R19 | S04 不执行 JavaScript、不生成 evaluator function、不建立 Runtime VNode/Tree；它必须把 App/Shared/Page 的 compiler-owned Program 与 S02 已解析 module reference 规范为不可变 module entry，表达式、Block controller 和 method 只保留为 canonical semantics，供 S05 独立消费。 |

## 4. ID 与输出合同

| ID | 需求 |
|---|---|
| TK-S04-R20 | 每个 Page 必须分别维护 `TemplateNodeId`、`TemplateBindingId`、`TemplateBlockId`、`TemplateHandlerId` 四个独立命名空间；每个命名空间从 1 开始连续递增，并保持 JSON safe integer。 |
| TK-S04-R21 | Node ID 按 canonical template 的前序深度优先、同级从左到右分配；Block ID 按 directive 在同一遍历中的出现顺序分配；Binding/Handler ID 按 target Node 顺序和 canonical prop/event 顺序分配。 |
| TK-S04-R22 | ID 分配不得依赖 Map/Set 枚举、绝对路径、对象地址、并发完成顺序、locale 或 parser 私有 node id；同一规范输入必须产生字节等价的规范模型快照。 |
| TK-S04-R23 | `templateId` 必须由 manifest route 确定性生成并在 package 内唯一；S05 与 S06 必须直接消费该值，不能再次派生。 |
| TK-S04-R24 | 输出必须是唯一版本化 `CanonicalLoweredAppModel`，同时覆盖 canonical module entries 与 lowered pages；S05/S06 不得绕回 S02/S03、获得两份私有 model 或重新进行 Host/Style/Binding/Block/Event Lowering。 |
| TK-S04-R25 | Lowered Model 必须满足公共 Page IR 的结构前置不变量：单根、可达、无环、非根结构入度为 1、Block 被父 Node 恰好引用一次、Block root 不同时作为普通 child。 |
| TK-S04-R26 | Lowered Model 必须保持 Binding/Handler target 与 scope 的单一事实；S05 输出不得携带 target descriptor，S06 必须把同一 target 投影到 Page IR。 |
| TK-S04-R27 | 输出必须运行时深不可变；nested arrays/records、SourceSpan、Host props/style、expression model 和所有 lookup view 都不可修改。不得泄露 parser mutable node、source bytes 或 Build Session scratch object。 |

## 5. 诊断与资源

| ID | 需求 |
|---|---|
| TK-S04-R28 | 每个 Lowered Node/Binding/Block/Handler 及所有 semantic Diagnostic 必须关联原始 workspace-relative sourcePath 与 end-exclusive SourceSpan；合成事实必须关联最窄的决定性源码位置。 |
| TK-S04-R29 | Diagnostic 必须有稳定 code、`phase=lowering`、severity、file、range 与可执行 hint；不得把第三方 parser/Less 异常文本当成机器合同。 |
| TK-S04-R30 | 任一输入无效、语义错误、取消、预算超限或内部不变量失败都不得发布部分 Page 或部分 App model；一次请求只返回完整成功或完整失败。 |
| TK-S04-R31 | 必须限制 pages、template depth、nodes、bindings、blocks、handlers、expression nodes、style rules/declarations、selector matches、Less expansion steps、work queue 与输出 provenance；预算为整个 Lowering 请求累计预算，不得按局部循环重置。 |
| TK-S04-R32 | 取消必须在 Page 边界、template traversal、Less expansion、selector matching、expression lowering 与冻结前检查；取消后不得继续发布结果。 |
| TK-S04-R33 | 实现不得持有跨 Build Session 的可变 cache；失败/取消后 scratch graph、selector index、Less environment 与临时 expression model 必须可释放。 |

## 6. 质量需求

| 维度 | 要求 |
|---|---|
| 单一语义 | Host、Style、Binding、Block、Event 均只有 S04 一个 owner。 |
| 确定性 | 相同规范输入、配置与版本得到相同 Lowered Model snapshot 和 ID。 |
| 可诊断 | 所有语义失败定位到联盟源码，不定位到生成物。 |
| 安全 | 不执行用户 JS，不访问网络/文件系统，不容忍无限 Less/selector/expression 展开。 |
| 内存 | 一页完成后释放其 scratch；成功结果只持有 canonical facts，不复制完整源码。 |
| 可投影 | S05/S06 对同一 model 的投影可一一校验，不需要补充猜测。 |

## 7. 非目标

- 源码发现、Manifest/route/module graph、parser 与 target resolution。
- JS runtime、状态管理、Dependency Graph 或事件派发。
- JS Bundle、Source Map、Page IR、Metadata、RPK、签名与发布。
- Runtime ID、Host handle、平台组件或 JNI。
- 非 Case 001/002 所需的完整 CSS/Less、联盟组件或事件集合。

## 8. 上游映射

| 上游 | 覆盖 |
|---|---|
| Toolkit `TK-R03/TK-R04/TK-R11/TK-R17/TK-R18` | R06-R19：联盟 Host/Style/Binding/Block/Event 与 module 语义 |
| Toolkit `TK-R05/TK-R06/TK-R07/TK-R09` | R20-R27：JS 与 Page IR 共享 model、ID 和 target |
| Toolkit 质量需求 | R28-R33：诊断、确定性、限制、取消和资源 |
| TK-S02 | R01-R05：ResolvedAppModel 和 owner/module 闭包 |
| TK-S03 | R01-R05、R28：ParsedSourceModel、AST 与 SourceSpan |
| 公共 Host/ID/Page IR 合同 | R06-R27 |
