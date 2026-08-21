# TK-S04 Design

## 目录

- [1. 结论](#1-结论)
- [2. 分层与流程](#2-分层与流程)
- [3. 输入不变量](#3-输入不变量)
- [4. Canonical Lowered Model](#4-canonical-lowered-model)
- [5. 结构遍历与稳定 ID](#5-结构遍历与稳定-id)
- [6. Host Component Lowering](#6-host-component-lowering)
- [7. Style Lowering](#7-style-lowering)
- [8. Binding Lowering](#8-binding-lowering)
- [9. Block Lowering](#9-block-lowering)
- [10. Event Lowering](#10-event-lowering)
- [11. 结构与 scope 校验](#11-结构与-scope-校验)
- [12. 诊断](#12-诊断)
- [13. 取消、预算与资源](#13-取消预算与资源)
- [14. S05/S06 消费合同](#14-s05s06-消费合同)
- [15. 实现边界](#15-实现边界)

## 1. 结论

采用**单次语义 Lowering + 双投影消费**：S04 产生唯一 `CanonicalLoweredAppModel`；S05 只把其中的可执行语义发射为 JS，S06 只把其中的静态语义投影为 Page IR。

```text
S02 ResolvedAppModel ─┐
                      ├─> CanonicalLoweringSession
S03 ParsedSourceModel ┘      ├─ validate snapshot
                              ├─ lower page semantics once
                              ├─ allocate Template* IDs once
                              └─ freeze CanonicalLoweredAppModel
                                      ├─> S05 JS projection
                                      └─> S06 Page IR projection
```

模型可以同时包含“JS 需要的 expression/method”和“Page IR 需要的 static target”，但两者必须属于同一 Binding/Block/Handler 定义，不能形成两套事实。

## 2. 分层与流程

| 部件 | 负责 | 不负责 |
|---|---|---|
| LoweringInputValidator | 校验 S02/S03 快照、闭包、不可变与限制 | 修补缺失 source、重新 resolve |
| PageSemanticLowerer | template 结构、scope 与 canonical traversal | Bundle/Page IR emission |
| HostLowerer | tag/attribute -> Host/props | 平台组件或 Layout |
| StyleLowerer | Less 子集、selector、cascade、Host style | CSS Runtime 或动态 style |
| BindingLowerer | Host prop evaluator 与 target | JS function emission、Runtime dependency tracking |
| BlockLowerer | if/keyed-for definition 与 controller | BlockInstanceId 或运行期增删移动 |
| EventLowerer | onclick -> click + method resolution | HandlerId 或事件派发 |
| TemplateIdAllocator | 四类 Template ID | Runtime ID |
| LoweredModelValidator | 静态树、scope、引用与一一对应 | 公共 Artifact serialization |
| ModelFreezer | 深冻结成功结果 | 跨 Session mutable cache |

单页固定流程：

1. 从 S02 取得 Page identity、page UX 与有序 Style 依赖闭包。
2. 从 S03 取得相同 sourcePath/hash 的 Template、Page Script 与 Style AST。
3. 建立仅用于本页的 Less environment、selector program 与 VM method index。
4. 按 canonical DFS Lower template；在同一次遍历中形成 Host、Binding、Block、Handler 和 ID。
5. 校验树、scope、target、ID 与下游一一对应不变量。
6. 释放 scratch，冻结 `CanonicalLoweredPageModel`。
7. 把 App/Shared/Page Program 与 S02 已解析 dependency/reference 配对为 canonical module entries。
8. 全部 Page 成功后按 manifest route 规范排序并冻结 App model。

任何一步失败都丢弃当前请求全部结果。

## 3. 输入不变量

### 3.1 输入形态

以下是语义形态，不预设产品代码类名：

```text
CanonicalLoweringRequest {
  resolvedAppModel
  parsedSourceModel
  limits
  cancellationToken
}
```

`ParsedSourceModel` 指 S03 已验证的不可变 `ParsedSourceSet` 及其 source identity，不是第三方 parser AST 容器。

### 3.2 必须同时成立

| 不变量 | 校验 |
|---|---|
| 同一快照 | S02 relation 指向的每个 sourcePath 在 S03 中存在，且 source hash 相同 |
| 闭包完整 | 每个 Page 的 UX、Script、全部可达 Style source 均可从 S02 owner relation 找到 |
| owner 正确 | 共享 Style 可被多个 Page owner 消费；S04 按 Page owner 独立形成 style program |
| 类型正确 | pageUx 对应 ParsedUxSource；shared/style path 对应声明的 source kind |
| 深不可变 | 输入 nested object、array 与 map view 均不能修改 |
| 无 error 输入 | S02/S03 error 结果不得进入 S04；warning 可保留但不能改变语义 |
| V1 page 集一致 | Manifest 普通 Page 与 S02 可构建 Page 一一对应；Widget 不进入 S04 |

S04 不接受“只有 AST、没有 ResolvedAppModel”或“只有路径、临时再读文件”的降级入口。

## 4. Canonical Lowered Model

### 4.1 模型原则

1. 它是 Toolkit 内部跨阶段合同，不是公共 JSON Schema。
2. 它保存规范语义，不保存联盟 tag/CSS token 作为待解释事实。
3. 它保存 SourceSpan 只用于诊断和 Source Map；S06 不把 SourceSpan 写进 Page IR。
4. 它不持有源码全文、parser handle、mutable parent pointer 或绝对路径。
5. 所有 list 有确定顺序，lookup 只是同一不可变对象的只读视图。

### 4.2 逻辑模型

```text
CanonicalLoweredAppModel {
  modelVersion: 1
  packageName
  appModule: CanonicalModuleEntry
  sharedModules: CanonicalModuleEntry[]
  pages: CanonicalLoweredPageModel[]
}

CanonicalModuleEntry {
  moduleId
  moduleKind: app | shared | page
  dependencies: moduleId[]
  program: CanonicalJsProgram
  references: CanonicalModuleReference[]
  source
}

CanonicalLoweredPageModel {
  manifestRoute
  route
  moduleId
  module: CanonicalModuleEntry
  templateId
  rootTemplateNodeId
  nodes: CanonicalNode[]
  bindings: CanonicalBinding[]
  blocks: CanonicalBlock[]
  handlers: CanonicalHandler[]
}

CanonicalNode {
  templateNodeId
  hostType: View | Text | Button
  props
  style
  children: NodeSlot | BlockSlot []
  source
}

CanonicalBinding {
  templateBindingId
  scope: page | TemplateBlockId
  target: { templateNodeId, propName }
  evaluator: CanonicalExpression
  resultType: string | boolean
  source
}

CanonicalBlock {
  templateBlockId
  kind: if | for
  parentTemplateNodeId
  templateRootNodeId
  controller: IfController | KeyedForController
  source
}

CanonicalHandler {
  templateHandlerId
  scope: page | TemplateBlockId
  templateNodeId
  eventType: click
  methodName
  source
}
```

`CanonicalJsProgram` 是 S03 compiler-owned JavaScript Program 的深不可变规范投影；每个 import/require/context/Capability reference 已按 S02 relation 绑定到 moduleId、context member 集或 typed capability identity。S04 只配对已解析事实，不重新解析 target，也不 transform JavaScript。

`CanonicalExpression` 是 S03 compiler-owned expression AST 的规范只读投影，包含 scope binding、组合/转换语义与 SourceSpan；不包含可执行 function。

### 4.3 templateId

V1 固定：

```text
templateId = "page:" + normalizedRuntimeRoute
```

例如 manifest route `pages/Demo` 的 runtime route 为 `/pages/Demo`，templateId 为 `page:/pages/Demo`。Manifest route 唯一性保证 package 内 templateId 唯一；S05/S06 直接消费该值。

## 5. 结构遍历与稳定 ID

### 5.1 稳定的含义

稳定表示：**同一份规范输入、同一合同版本与同一 limits，重复构建得到相同 ID。**

它不承诺插入一个更靠前的源码节点后，后续 ID 仍保持旧编号；V1 不维护跨构建增量 ID 数据库。

### 5.2 命名空间

每页独立维护四个计数器：

```text
nextNodeId = 1
nextBindingId = 1
nextBlockId = 1
nextHandlerId = 1
```

每个命名空间连续、无 0、无复用，且不超过 `Number.MAX_SAFE_INTEGER` 与配置预算的较小值。

### 5.3 Canonical traversal

遍历规则固定为：

1. Page root 先分配 Node ID，因此 `rootTemplateNodeId=1`。
2. Element 按 Template source child 顺序前序 DFS。
3. 忽略 comment 与 `ignorableWhitespace` structural child；Text element 内的文本 payload 另按 §6 处理。
4. 普通 child element 形成 Node slot，再递归该 Node。
5. 带 directive 的 child element先形成 Block slot并分配 Block ID，再把该 element 分配为 Block root Node，随后递归。
6. 同一 element 不允许同时出现 `if` 和 `for`；Page root 不允许 directive，因为公共 Block IR 要求 parent Node。
7. Binding 在其 target Node 建立时，按 canonical Host prop 顺序 `text`、`enabled` 分配。
8. Handler 在其 target Node 建立时，按 canonical event 顺序分配；V1 只有 `click`。

所有输出表最终按各自 ID 升序保存；不得依赖 Map insertion 或并发完成顺序。

## 6. Host Component Lowering

### 6.1 唯一映射

| 联盟源码 | Canonical Host | 规则 |
|---|---|---|
| `div` | `View` | 不产生业务 prop |
| `text` | `Text` | direct text/interpolation 合成 `text` prop |
| `input type="button"` | `Button` | `value -> text`，补 `enabled=true` |

`class` 只供 StyleLowerer 匹配，不进入 Host props。`type` 只决定 input 映射，不进入 Host props。`onclick` 只进入 Handler。

### 6.2 文本规则

- `Text` 只能包含 text/interpolation/comment；V1 不允许 element child。
- 有序 text/interpolation segment 原样组合；换行统一为 `LF`，其余非纯缩进 literal 不被猜测性改写。
- 只由 formatting whitespace 构成的 segment 不形成文本内容。
- 无 interpolation：直接得到静态 `props.text`。
- 有 interpolation：得到一个 `text:string` Binding，Page IR 静态 `props.text` 使用空字符串；初始 Binding 在首次提交中原子写入最终值。
- Button 静态 value 直接成为 `props.text`；动态 value 同样只形成一个 `text:string` Binding。

缺少 Button value 时使用空字符串；缺少 enabled 时固定 `true`。非法 Host prop 在 S04 失败，不透传。

## 7. Style Lowering

### 7.1 本质

Style Lowering 的输出不是 CSS，而是每个 Canonical Node 上已经决定的 Host Style record。

```text
Resolved style closure + Style AST
  -> ordered V1 Less program
  -> expanded selector/declaration stream
  -> match canonical template path
  -> cascade
  -> normalize Host Style
```

### 7.2 V1 Less program

S04 只实现 Case 001 所需确定性子集：

1. local import 在 import 位置按 S02 resolved target 深度优先展开；循环和重复递归失败。
2. variable 与 mixin 在展开后的 lexical environment 中解析；未解析、递归或参数数量不符失败。
3. 支持 number、px、percent、color、identifier、四则运算中 Case 所需的数值/长度组合；除零、非有限结果和非法单位组合失败。
4. mixin call 展开为 declaration；展开深度、步骤和生成 declaration 数计入同一累计预算。
5. nested rule 使用父 selector 与子 selector 的笛卡尔组合；V1 支持 class/descendant 结构，矩阵外 selector 明确失败。
6. `margin` 按 CSS 1/2/3/4 值规则展开为四个 canonical side。

S04 不执行完整通用 Less，不调用外部进程，也不从 import spelling 重新解析文件。

### 7.3 Selector 与 cascade

V1 selector 由一个或多个 class compound 经 descendant 关系组成；每个 compound 必须匹配同一 Node 的静态 class token，descendant 部分匹配 ancestor chain。

- specificity 为 class atom 数量。
- 同 property 先比较 specificity，再比较展开后的全局 source order。
- 无 style inheritance；规则只作用于直接匹配的 Node。
- class 必须为静态 token list；动态 class 已由 S03 拒绝。
- 未匹配规则可保留为无效果事实；unsupported selector 不能被当成未匹配而跳过。

### 7.4 Host Style 规范化

| Alliance/CSS | Canonical |
|---|---|
| `width/height` px | `{ value, unit: logical-px }`，非负 |
| `width/height` `%` | `{ value, unit: percent }`，非负 |
| `margin-*` | `marginTop/Right/Bottom/Left` Length，允许负值 |
| `flex-direction` | `flexDirection` 枚举 |
| `justify-content` | `justifyContent` 枚举 |
| `align-items` | `alignItems` 枚举 |
| `background-color/color` | `backgroundColor/color`，规范为大写 `#RRGGBB`/`#RRGGBBAA` |
| `border-radius/font-size` px | `borderRadius/fontSize` 非负 logical-px number |
| `text-align` | `textAlign` 枚举 |

每个 Node 的 style key 按公共 Host Contract 固定顺序保存。未知 property、named color、rgba、非 V1 unit 或非法枚举均返回 semantic Diagnostic；不能静默丢弃。

## 8. Binding Lowering

### 8.1 一条 Binding 的边界

Binding 的身份由一个动态 Host prop 决定：

```text
(scope, target TemplateNodeId, propName) -> one TemplateBindingId
```

例如：

```text
<text>Hello {{ name }}, {{ count }}</text>
```

只产生一个 `text` Binding，其 evaluator 是：

```text
concat("Hello ", toDisplayString(name), ", ", toDisplayString(count))
```

### 8.2 Canonical expression

S04 为 expression 做以下语义标注，不执行表达式：

- `private` 的静态字段被规范化为 Page VM 根状态符号；identifier 解析为根状态、Page method 或当前 `for` alias。
- lexical alias 优先于同名 Page state；Canonical expression 分别记录 `lexicalBindings` 与 `stateBindings`，S05 只能据此投影，不能重新猜测作用域。
- nested Block 可引用自身 alias 和外层 lexical alias；同名时最近 scope 优先。
- text/value 使用 `toDisplayString`：string 原值，有限 number/boolean 使用 ECMAScript 字符串语义，null 为空字符串；其他值在运行时求值失败。
- `if` controller 使用 JavaScript truthiness 语义并输出 boolean。
- `for` iterable 必须在运行时得到 array；key 必须为 string 或 finite safe number。
- expression node、member depth 与 composition segment 都计入预算。

S04 不在 JS 与 C++ 之间传输 target descriptor。S05 发射的 evaluator 只以 TemplateBindingId 建索引；target 由 S06 Page IR 表达。

## 9. Block Lowering

### 9.1 if

```text
if directive
  -> CanonicalBlock(kind=if)
  -> IfController(predicate expression)
  -> one BlockSlot in parent Node
  -> directive element becomes templateRootNodeId
```

Block root 及其不跨入嵌套 Block 的后代，scope 均为该 `TemplateBlockId`。

### 9.2 keyed for

```text
for="{{ (index, item) in items }}" tid="id"
  -> CanonicalBlock(kind=for)
  -> iterable expression: items
  -> aliases: index, item
  -> key expression: item.id
```

V1 `tid` 必须是一个或多个 identifier segment 构成的静态 property path。无 tid、空 path、computed/call path 均失败。重复 key、非法 key value 和 iterable 非 array 是未来 S05 发射的运行期 controller error，不由 S04 执行数据后猜测。

嵌套 Block 的最近 Block 成为 scope。S04 只形成静态 definition/controller；`BlockInstanceId`、增删移动与 Runtime Node 实例属于 JS Framework/Core。

## 10. Event Lowering

### 10.1 唯一事件映射

```text
onclick="onUpdate"
  -> eventType = click
  -> TemplateHandlerId
  -> target TemplateNodeId + scope
  -> methodName = onUpdate
```

### 10.2 Method index

S04 从当前 Page script 的唯一 `export default` object 建只读 method index。V1 method 必须是：

- object method；或
- identifier key 对应 function/arrow function value。

同名重复、computed key、spread 才引入、非函数值或不存在均失败。S04 不执行 method、不改变 `this`、不生成 `HandlerId`。

同一 Page 中多个 TemplateHandlerId 可以引用同一个 methodName；每个定义仍有独立 target。S05 的 `handlerMethods[TemplateHandlerId]` 只输出 methodName，S06 的 Handler 只输出 target/event/scope。

## 11. 结构与 scope 校验

冻结前必须从 root 独立校验一次，而不是相信构建过程：

1. root Node 存在、入度 0。
2. 其他 Node/Block 结构入度恰为 1。
3. 所有 Node/Block 从 root 可达且无环。
4. 每个 Block 恰好被 parent Node 的一个 BlockSlot 引用。
5. Block root 不作为普通 NodeSlot，也不被另一 Block 共享。
6. Binding target 存在、prop 类型合法且 `(scope,target,prop)` 唯一。
7. Handler target 存在、event 合法且 `(scope,target,event)` 唯一。
8. Binding/Handler scope 等于从结构派生的最近 Block scope。
9. 四类 ID 分别连续、唯一、正整数、安全。
10. S05 所需 evaluator/controller/method 与 S06 所需 Binding/Block/Handler 定义一一对应。

内部不变量失败使用 compiler internal Diagnostic，不发布模型。

## 12. 诊断

### 12.1 稳定 code

| Code | 含义 |
|---|---|
| `TK_LOWER_INPUT_INVALID` | S02/S03 快照、闭包、类型或不可变不成立 |
| `TK_LOWER_COMPONENT_UNSUPPORTED_V1` | tag/type/attribute 无 V1 Host 映射 |
| `TK_LOWER_HOST_PROP_INVALID` | Host prop 缺失、重复或类型非法 |
| `TK_LOWER_STYLE_UNSUPPORTED_V1` | selector/property/unit/value 超出 V1 |
| `TK_LOWER_STYLE_EVALUATION_FAILED` | variable/mixin/arithmetic/cascade 语义失败 |
| `TK_LOWER_BINDING_INVALID` | dynamic prop、expression、结果类型或 target 非法 |
| `TK_LOWER_BLOCK_INVALID` | directive、tid、scope 或静态 Block 结构非法 |
| `TK_LOWER_HANDLER_INVALID` | event 或 Page method 不可静态解析 |
| `TK_LOWER_LIMIT_EXCEEDED` | 任一累计预算超限 |
| `TK_LOWER_CANCELLED` | 请求取消 |
| `TK_LOWER_INTERNAL_INVARIANT` | 构造后的模型违反冻结不变量 |

### 12.2 定位规则

- Component/prop：tag 或 attribute 的最窄 SourceSpan。
- Style：最终决定失败的 selector、declaration、variable 或 mixin call span。
- Binding：目标 attribute 或 text interpolation span。
- Block：directive 或 tid span。
- Event：onclick attribute 或 method declaration span。
- 跨文件错误：primary 指向使用点，related locations 指向定义/import 点。

所有 path 为 workspace-relative POSIX path；不泄露绝对路径。

## 13. 取消、预算与资源

### 13.1 累计预算

`LoweringBudget` 是一次请求唯一的单调计数器集合：

| 预算 | 计数时机 |
|---|---|
| pages/nodes/bindings/blocks/handlers | 对象准备分配前 |
| templateDepth/expressionNodes | 进入节点前 |
| styleRules/declarations | import/mixin/nesting 展开时 |
| selectorMatches | 每次 selector-node 候选匹配前 |
| lessExpansionSteps | variable/mixin/arithmetic 每步前 |
| workQueue | 入队前，同时限制峰值 |
| provenance | 添加 source relation 前 |

预算不能在 Page、import、mixin 或 selector rule 内局部重置。超限返回单一 `TK_LOWER_LIMIT_EXCEEDED`，不返回截断模型。

### 13.2 取消点

至少在以下位置检查取消：Page 开始/结束、DFS 每批节点、import/mixin 展开、selector 候选批次、expression visitor 批次、结构校验和深冻结前。

### 13.3 生命周期

- 一个请求拥有一个 `CanonicalLoweringSession`，无 process-global mutable state。
- V1 可以串行按 route Lower Page；未来并行也必须先独立产生 Page model，再按 route 合并。
- 每页 scratch 包括 Less environment、selector index、method index、DFS stack 和临时 lookup；页完成即释放。
- 成功模型只持有 compiler-owned immutable values；失败/取消释放全部 scratch 和未发布 Page。

## 14. S05/S06 消费合同

| Canonical fact | TK-S05 | TK-S06 |
|---|---|---|
| App/Shared/Page module entry | module transform、dependency 与 Module ABI | 不消费 JS Program |
| page moduleId/templateId | bootstrap/Module ABI | Page IR templateId 及后续 Metadata 输入 |
| Node Host/props/style/children | 不消费静态树 | 原样投影 nodes/root |
| Binding ID/evaluator/resultType | 发射 `bindingEvaluators[id]` | 不消费 evaluator |
| Binding scope/target | 不输出 target descriptor | 原样投影 bindings |
| Block ID/controller/aliases/key | 发射 JS Block controller | 不消费表达式/key |
| Block kind/parent/root | 不重新计算结构 | 原样投影 blocks |
| Handler ID/methodName | 发射 `handlerMethods[id]` | 不消费 methodName |
| Handler scope/target/event | 不输出 target descriptor | 原样投影 handlers |
| Source provenance | 生成 Source Map/Diagnostic | 不进入公共 Page IR |

必须有联合合同测试证明：

```text
keys(S05.bindingEvaluators) == ids(S06.pageIr.bindings)
keys(S05.handlerMethods) == ids(S06.pageIr.handlers)
S05.bootstrap.templateId == S06.pageIr.templateId
```

S05/S06 只能消费 `CanonicalLoweredAppModel`，不得直接依赖 S02 relation model 或 S03 parser/Program AST。`CanonicalJsProgram` 是 S04 输出模型的一部分，不是对 S03 mutable object 的引用。

## 15. 实现边界

推荐代码边界仅在获得 `CODE_ALLOWED` 后建立：

```text
src/compiler/lowering/
  contracts
  input-validator
  host
  style
  binding
  block
  event
  id-allocator
  model-validator
  model-freezer
```

禁止在 S04 目录出现 bundler、emitter、Page IR serializer、Artifact path、ZIP 或 Runtime 代码。本文不授予编码权限，也不启动 TK-S05/TK-S06。
