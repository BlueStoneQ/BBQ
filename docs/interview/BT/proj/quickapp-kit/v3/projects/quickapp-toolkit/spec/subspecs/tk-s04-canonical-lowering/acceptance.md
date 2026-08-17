# TK-S04 Acceptance

## 目录

- [1. 结论](#1-结论)
- [2. 输入合同验收](#2-输入合同验收)
- [3. Case 正例](#3-case-正例)
- [4. 语义与结构负例](#4-语义与结构负例)
- [5. 确定性、不可变与资源](#5-确定性不可变与资源)
- [6. 下游边界验收](#6-下游边界验收)
- [7. 需求覆盖](#7-需求覆盖)
- [8. 证据与通过条件](#8-证据与通过条件)

## 1. 结论

TK-S04 通过的本质是：同一份 S02/S03 事实只产生一份确定的 Runtime 语义；S05/S06 对它做不同投影时，Template ID、结构与目标不会分叉。

## 2. 输入合同验收

| Case | 输入 | 必须结果 |
|---|---|---|
| `S04-I01` 完整快照 | Verified S02/S03 Case 001/002 | 成功进入 Page Lowering |
| `S04-I02` hash 漂移 | relation path 相同但 source hash 不同 | `TK_LOWER_INPUT_INVALID`；无 Page model |
| `S04-I03` source 缺失 | 缺 page UX/script/可达 Style | `TK_LOWER_INPUT_INVALID`；最小 owner/path Diagnostic |
| `S04-I04` owner 漂移 | shared Style relation 漏一个 Page owner | `TK_LOWER_INPUT_INVALID`，不从路径重新猜 owner |
| `S04-I05` mutable input | nested object/array/Map 可修改 | `TK_LOWER_INPUT_INVALID`，不进入 semantic traversal |
| `S04-I06` Widget 注入 | S02 excluded Widget 被放入 Page 集 | `TK_LOWER_INPUT_INVALID` |
| `S04-I07` SourceAccess spy | Lowering 成功和失败 | spy 调用次数恒为 0 |

## 3. Case 正例

### 3.1 Case 001

| Case | 必须结果 |
|---|---|
| `S04-P01` Demo Host tree | `div/text/input` 唯一变为 `View/Text/Button`；root Node ID=1；child order 不变 |
| `S04-P02` Demo Binding | `{{ title }}` 只产生一个 `text:string` Binding；target 为 Text.text |
| `S04-P03` Demo Button | value 变为 Button.text，enabled=true；onclick 变为 click Handler |
| `S04-P04` Detail text | 中文 static text 与 interpolation 顺序保持；不产生额外 structural Text Node |
| `S04-P05` Less import | variables -> mixins -> page style 的 resolved closure 正确展开；不重新解析 path |
| `S04-P06` Less arithmetic | `8 * @size-factor`、`90 * @size-factor` 等变为确定 logical-px 值 |
| `S04-P07` nesting/cascade | `.wrapper .title`、`.wrapper .btn` 精确匹配；specificity/source order 稳定 |
| `S04-P08` Host Style | width/height/margin/colors/fontSize/borderRadius 等只使用公共 canonical shape |
| `S04-P09` method resolution | `onDetailBtnClick`、`onWelcomeBtnClick` 静态解析到唯一 callable method |
| `S04-P10` 多 Page IDs | 每个 Page 的四类 ID 各自从 1 连续递增，互不借用命名空间 |

### 3.2 Case 002

| Case | 必须结果 |
|---|---|
| `S04-P11` count Binding | count=0 evaluator 语义得到字符串 `"0"`，不是 number 0 |
| `S04-P12` if Block | visible 形成 if Block、BlockSlot、controller、root Node 和最近 Block scope |
| `S04-P13` keyed for | items/index/item/tid=id 形成 keyed-for controller 与 `item.id` key expression |
| `S04-P14` for subtree | for 内 Node/Binding/Handler scope 为该 TemplateBlockId；嵌套时使用最近 Block |
| `S04-P15` click Handler | onUpdate 形成 click Handler；methodName 与 static target 分属同一 definition 的两种投影 |
| `S04-P16` 单一模型 | Fake S05/Fake S06 消费同一 model，Binding/Handler ID 与 templateId 集合完全相等 |

### 3.3 最小组合正例

| Case | 必须结果 |
|---|---|
| `S04-P17` 多插值 | `A{{x}}B{{y}}` 只产生一个 text Binding 和一个 concat evaluator |
| `S04-P18` 同 method 多 target | 两个 Button onclick 指向同一 method，得到两个 TemplateHandlerId |
| `S04-P19` nested Block | 外 for 内 if：内 if subtree 归内 Block，外层 alias 仍可 lexical resolve |
| `S04-P20` shared Style 多 owner | 两 Page 共享 Style 时分别匹配各自 tree，parsed style 不复制、不串 owner 结果 |
| `S04-P21` module facts | App/Shared/Page Program、dependencies、require.context members 与 Capability reference 全部来自 S02/S03 配对；S05 无需回读上游 |

## 4. 语义与结构负例

| Case | 预期 |
|---|---|
| `S04-N01` unknown tag/非法 input type | `TK_LOWER_COMPONENT_UNSUPPORTED_V1` |
| `S04-N02` Text element child/重复 Host prop | `TK_LOWER_HOST_PROP_INVALID` |
| `S04-N03` unsupported CSS property/unit/named color | `TK_LOWER_STYLE_UNSUPPORTED_V1`，不得忽略 |
| `S04-N04` unresolved/recursive variable 或 mixin、除零 | `TK_LOWER_STYLE_EVALUATION_FAILED` |
| `S04-N05` unsupported selector 被伪装成未匹配 | 必须 `TK_LOWER_STYLE_UNSUPPORTED_V1` |
| `S04-N06` 动态 View prop/非 string-boolean Binding | `TK_LOWER_BINDING_INVALID` |
| `S04-N07` root directive | `TK_LOWER_BLOCK_INVALID` |
| `S04-N08` 同 element if+for | `TK_LOWER_BLOCK_INVALID` |
| `S04-N09` for 无 tid/空 tid/computed tid | `TK_LOWER_BLOCK_INVALID` |
| `S04-N10` missing/non-callable/computed/spread-only method | `TK_LOWER_HANDLER_INVALID` |
| `S04-N11` 同 Node 重复 click | `TK_LOWER_HANDLER_INVALID` |
| `S04-N12` 人工多父/环/孤立 Node 或 Block | `TK_LOWER_INTERNAL_INVARIANT`；无成功 model |
| `S04-N13` Binding/Handler scope 与派生 scope 不同 | `TK_LOWER_INTERNAL_INVARIANT` |
| `S04-N14` ID 0/重复/断号/超过 safe integer | allocator 拒绝或 `TK_LOWER_INTERNAL_INVARIANT` |
| `S04-N15` 任一累计预算超限 | `TK_LOWER_LIMIT_EXCEEDED`；无截断输出 |
| `S04-N16` 取消发生在任一规定阶段 | `TK_LOWER_CANCELLED`；无 late publish |

## 5. 确定性、不可变与资源

### 5.1 确定性

1. 同一请求连续执行 100 次，canonical snapshot 与四类 ID map 字节一致。
2. S02 internal Map 插入顺序、S03 ParsedSourceSet 枚举顺序和 Page 完成顺序变化，输出不变。
3. 绝对 workspace 位置变化但 workspace-relative sourcePath 与内容相同，输出不变。
4. locale、时区和并行调度变化不影响 route order、颜色、数值或 ID。
5. 在较早 traversal 位置插入 Node 后允许后续 ID 变化；删除该改动后恢复原 snapshot，证明无隐藏持久状态。

### 5.2 深不可变

以下修改均必须失败且不能改变 snapshot：

- pages/nodes/bindings/blocks/handlers 数组增删改。
- Host nested props/style/Length 修改。
- Binding expression/segment/scope/target 修改。
- Block controller/aliases/key/source 修改。
- Handler methodName/event/source 修改。
- lookup view 的 set/delete/clear 或迭代值间接修改。

### 5.3 预算与资源

1. 大量不匹配 selector、空 rule、无输出 mixin 仍消耗累计预算，不能零成本绕过。
2. 深 import/mixin/nesting/expression/template 分别触发对应 limit，但统一返回稳定 limit code。
3. 一个 Page 消耗的预算影响同一请求后续 Page，不能每页重置。
4. 取消后停止新 work 入队，late callback 不发布模型。
5. 连续 100 次成功、失败、取消混合执行后，scratch graph、Less environment、selector/method index 与临时 AST projection 回到基线。

## 6. 下游边界验收

### 6.1 Fake S05

只允许读取：

- moduleId/templateId；
- App/Shared/Page canonical JS Program、dependencies 与已解析 module reference；
- Binding ID/evaluator/resultType；
- Block ID/controller/aliases/key；
- Handler ID/methodName；
- Source provenance。

断言它不读取 static target 来生成 JS target descriptor，不回读 S02/S03，不分配 Template ID。

### 6.2 Fake S06

只允许读取：

- templateId/root/nodes/Host/children；
- Binding ID/scope/target；
- Block ID/kind/parent/root；
- Handler ID/scope/target/event。

断言它不读取/evaluate expression，不匹配 Style，不解析 method，不分配 Template ID。

### 6.3 联合不变量

```text
bindingEvaluatorIds == pageIrBindingIds
handlerMethodIds == pageIrHandlerIds
jsBootstrapTemplateId == pageIrTemplateId
```

禁止范围扫描必须证明 S04 产品目录不存在 Bundle emitter、Page IR serializer、Artifact path、ZIP/RPK 和 Runtime Tree 实现。

## 7. 需求覆盖

| 需求 | 证据 |
|---|---|
| R01-R05 | S04-I01..I07、顺序扰动测试 |
| R06-R10 | S04-P01/P03/P05..P08、S04-N01..N05 |
| R11-R13 | S04-P02/P11/P17、S04-N06、Fake S05/S06 |
| R14-R16 | S04-P12..P14/P19、S04-N07..N09/N12/N13 |
| R17-R19 | S04-P03/P09/P15/P18/P21、S04-N10/N11 |
| R20-R23 | S04-P01/P10、确定性 1..5、S04-N14 |
| R24-R27 | S04-P16、深不可变、Fake S05/S06 与联合不变量 |
| R28-R30 | 全部负例 Diagnostic Golden、取消与 partial-result 断言 |
| R31-R33 | S04-N15/N16、预算与资源 1..5 |

## 8. 证据与通过条件

实现阶段必须提交：

- Case 001/002 canonical model、ID、Host Style 与 provenance Golden。
- 输入漂移、Host/Style/Binding/Block/Event/结构错误的 Diagnostic Golden。
- 100 次 determinism、深不可变 mutation、累计预算、取消与资源测试。
- Fake S05/Fake S06 及联合 ID/templateId 合同测试。
- typecheck、lint、unit、integration、Case、determinism、mutation、limit、cancellation、resource 与禁止范围扫描结果。

全部需求通过、无公共合同冲突并经总架构校审后，才可授予 TK-S04 编码许可。TK-S05/TK-S06 仍须由后续工作看板单独放行。
