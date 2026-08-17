# TK-S04 Tasks

## 目录

- [1. 结论](#1-结论)
- [2. 编码门禁](#2-编码门禁)
- [3. 实现任务](#3-实现任务)
- [4. 依赖顺序](#4-依赖顺序)
- [5. 完成定义](#5-完成定义)

## 1. 结论

未来实现顺序固定为“输入不变量与模型 -> Host/ID/结构 -> Style -> Binding/Block/Event -> 全局校验与资源 -> S05/S06 Fake Consumer”。本文仅指挥后续编码，不授予编码权限。

## 2. 编码门禁

开始任何产品实现前必须同时满足：

1. TK-S04 五份分 Spec 经总架构校审 `PASS`。
2. 工作看板明确写出 `TK-S04 CODE_ALLOWED`。
3. TK-S02/TK-S03 保持 `VERIFIED`，输入模型未被未校审修改。
4. 公共 Artifact、Page IR、Host、ID、Block 与 Render 合同无未决冲突。

未满足门禁时，禁止创建 `src/compiler/lowering` 或修改产品依赖。

## 3. 实现任务

### TK-S04-T01 输入合同与模型骨架

- 定义 `CanonicalLoweringRequest`、`LoweringLimits` 与唯一版本化 `CanonicalLoweredAppModel`。
- 实现 S02/S03 sourcePath/hash/owner/闭包/source kind/page 集一致性校验。
- 把 App/Shared/Page Program 与 S02 已解析 dependency/reference 配对为不可变 canonical module entry。
- 验证输入运行时深不可变，拒绝 mutable nested value/map view。
- 建立完整失败、不发布部分模型的 Result 边界。

完成定义：无 SourceAccess/parser/target resolution；不一致输入在遍历模板前失败。

### TK-S04-T02 Canonical traversal 与 ID allocator

- 实现单根、有序前序 DFS 与 Node/Block child slot。
- 实现每页四个独立、连续、positive safe-integer allocator。
- 实现 route -> templateId 规则和规范排序。
- 覆盖普通 child、if/for child、嵌套 Block、root directive 负例。

完成定义：相同输入得到相同 ID snapshot；无 parser 私有 ID、Map order 或绝对路径依赖。

### TK-S04-T03 Host Component Lowering

- 实现 `div/text/input[type=button]` 唯一映射。
- 实现 Text payload、Button value、默认 enabled 与 canonical prop order。
- 拒绝未知 tag、非法 input type、非法 child/attribute/重复 prop。
- 保留最窄 SourceSpan。

完成定义：输出只含 `View/Text/Button` 与公共 Host props，不含联盟 tag/class/type。

### TK-S04-T04 Style Lowering

- 复用 S02 resolved style relation，按 Page owner 建 V1 Less program。
- 实现 import、variable、mixin、arithmetic、nesting、margin shorthand 与循环/预算。
- 实现 class/descendant selector、specificity、source order cascade。
- 实现公共 Host Style property/value/unit/color 规范化。
- 覆盖 Case 001 三层 Style、共享 Style 多 owner、unsupported selector/property/value。

完成定义：每个 Node 得到已决定的 Host Style；无 CSS/Less token 留给 S06/Core/Platform 解释。

### TK-S04-T05 Binding Lowering

- 实现 static/interpolation segment 合成和“一动态 Host prop一 Binding”。
- 实现 compiler-owned canonical expression、lexical alias resolution 与 string/boolean result semantics。
- 实现 target/scope/resultType/source 一体化定义。
- 覆盖 count=0 -> `"0"`、多 interpolation 单 Binding、非法动态 prop/value。

完成定义：S05 只需发射 evaluator，S06 只需投影 target；两者 ID 一致。

### TK-S04-T06 Block Lowering

- 实现 if controller、keyed for iterable/aliases/tid key path。
- 实现 directive element 作为 Block root、BlockSlot、最近 Block scope 与嵌套覆盖。
- 拒绝无 tid、非法 tid、同 element if+for、root directive 与静态共享子树。
- 建立运行期 key/iterable error 所需的 canonical controller 语义，但不执行数据。

完成定义：Block 静态结构符合公共 Page IR 前置不变量；不生成 BlockInstanceId。

### TK-S04-T07 Event Lowering

- 建立 Page `export default` 静态 method index。
- 实现 onclick -> click、target/scope/method/source 定义。
- 拒绝 missing/duplicate/non-callable/computed/spread-only method 和重复 Node/Event。
- 覆盖多个 Handler 引用同一 method 的合法场景。

完成定义：S05 取得 methodName，S06 取得 target/event；不生成 HandlerId。

### TK-S04-T08 模型校验与深冻结

- 独立校验 root、reachability、acyclic、indegree、Block parent/root 与 slot。
- 校验四类 ID、Binding/Handler target/scope/唯一性和 S05/S06 一一对应。
- 递归冻结 nested list/record/expression/source/Host value，并提供不可变 lookup view。
- 确保不泄露 parser node、source bytes 或 scratch object。

完成定义：构造 bug 产生 `TK_LOWER_INTERNAL_INVARIANT`，而不是非法成功模型。

### TK-S04-T09 诊断、预算、取消与资源

- 实现 design §12 的稳定 Diagnostic adapter 与 related locations。
- 建立整个请求共享的累计 `LoweringBudget`，覆盖所有 work/expansion/output。
- 在规定的遍历、展开、匹配、表达式、校验和冻结位置检查取消。
- 验证失败/取消/成功后 scratch 释放与无跨 Session mutable cache。

完成定义：预算不能通过大量空规则、零匹配 selector 或深层展开绕过；无部分结果。

### TK-S04-T10 Case 与下游合同验收

- 对 Case 001/002 生成 canonical snapshot、ID map、style summary 与 Diagnostic Golden。
- 使用 Fake S05 只消费 canonical module entry/evaluator/controller/method；使用 Fake S06 只消费 static tree/target/scope。
- 校验 Binding/Handler ID 集与 templateId 一一对应。
- 添加禁止范围扫描：无 Bundle/Page IR/Artifact/RPK 产品实现，无 S03 parser AST 直接暴露。

完成定义：唯一 Lowered Model 足够驱动两个消费者，不需要消费者补语义。

## 4. 依赖顺序

```text
T01
  -> T02
       -> T03 + T04
            -> T05 + T06 + T07
                 -> T08
                      -> T09
                           -> T10
```

T03/T04 可并行；T05/T06/T07 可在 Host 与 Style 语义冻结后并行。全部任务共享 T01 模型与 T02 allocator，不得各建私有 ID 或 SourceSpan 类型。

## 5. 完成定义

1. `TK-S04-R01..R33` 全部有直接测试、Golden 或静态边界证据。
2. Case 001 的 Host、Less、Binding 与 click Handler 形成稳定 canonical snapshot。
3. Case 002 的 count、if、keyed for、state target 与 click Handler 形成稳定 canonical snapshot。
4. 相同输入重复/乱序/不同调度得到相同 model 与 ID。
5. error、取消、预算超限均无部分模型；深不可变与资源回收成立。
6. Fake S05/Fake S06 只消费唯一 model；S05 无需回读 S02/S03，ID/templateId 一一对应。
7. typecheck、lint、unit、integration、Case、determinism、mutation、limit、cancellation、resource、boundary scan 全部通过。
8. 更新机器证据与 Handoff 后提交实现校审；不得自行启动 TK-S05/TK-S06。
