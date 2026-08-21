# TK-S05 Acceptance

## 目录

- [1. 结论](#1-结论)
- [2. 输入与 ABI](#2-输入与-abi)
- [3. Case 验收](#3-case-验收)
- [4. Source Map 与确定性](#4-source-map-与确定性)
- [5. 失败与资源](#5-失败与资源)
- [6. 联合边界](#6-联合边界)
- [7. 需求映射](#7-需求映射)

## 1. 结论

S05 通过的本质是：同一份 canonical executable fact 只生成一套可验证 JS Definition；JS Bundle 不携带静态树和 target 第二份事实。

## 2. 输入与 ABI

| Case | 必须结果 |
|---|---|
| S05-I01 immutable model | 成功；输入和 nested values 未改变 |
| S05-I02 mutable model/map | `TK_EMIT_INPUT_INVALID`；无 Bundle/Map |
| S05-I03 missing module/dependency/ID | `TK_EMIT_INPUT_INVALID`；不猜测修复 |
| S05-I04 App Definition | `$app_define$` factory 通过 `module.exports` 导出 `schemaVersion=1`、`kind=app`、唯一 callable `createAppVm`；`$app_require$(appModuleId)` 返回同一 Definition |
| S05-I05 Page Definition | `$app_define$` factory 通过 `module.exports` 导出 `kind=page`、templateId 匹配、callable factory、完整 evaluator/handler key 集；`$app_require$(pageModuleId)` 返回同一 Definition |
| S05-I06 bootstrap | App/Page 的 moduleId/kind/templateId 与 canonical 输入一致，各自恰好一次；Shared Bundle 只调用 `$app_define$`，调用 `$app_bootstrap$` 必须失败 |
| S05-I07 require result | `$app_require$` 对已注册 App/Page 返回 `module.exports` Definition，对 Shared 返回普通 export；不得创建 VM 或隐式 bootstrap |
| S05-I08 unknown export field/prototype/accessor | `TK_EMIT_ABI_INVALID` |

## 3. Case 验收

### 3.1 Case 001

必须 Golden 验证：

1. App/Page/Shared `$app_define$` dependencies 与 Canonical package graph 稳定、无自依赖，并与 Runtime Metadata 完全一致。
2. 联盟 `@system.*` 发射为 `@app-module/system.*` typed reference，且不进入 Package dependencies。
3. ES import、CommonJS require 和静态 `require.context` 不重新扫描源码；context 只产生确定性直接依赖和 `$app_require$`，Bundle 不含 `$app_require$.context`。
4. Page `onDetailBtnClick`、`onWelcomeBtnClick` 的 method body 和 handler map 正确。
5. Page Bundle 通过 `module.exports` 导出 Definition；不含 View/Text/Button 静态树、Style、target 或 runtime Node。
6. Demo `createPageVm()` 返回根状态 `title`，Binding evaluator 通过 `this.title` 读取同一状态。

### 3.2 Case 002

必须 Golden 验证：

1. `count` evaluator 的 `displayString` 结果类型是 string，0 不被错误保留为 number。
2. if/for controller 所需 expression 和 lexical alias 进入合法 evaluator。
3. `TemplateBindingId`、`TemplateHandlerId` map 完整且无重复、无多余 key。
4. keyed `item.id` 只作为 canonical key expression，不输出 BlockInstanceId。

### 3.3 组合案例

`BLOCK-001` 验证 keyed add/remove 所需 evaluator/handler export；`CAP-DEVICE-001` 验证 capability reference。超出 S03 feature matrix 的语法必须明确失败而不是静默降级。

## 4. Source Map 与确定性

1. App/Shared/Page Bundle 的 Source Map v3 通过标准结构校验；Shared Map 对 define/module body 有映射，不要求 bootstrap 映射。
2. `sources` 全是 workspace-relative POSIX path，无绝对路径、反斜线和 `..`。
3. Bundle、Map 连续 100 次 clean emission 字节和 SHA-256 完全一致。
4. module input Map 顺序、Page 完成顺序、locale/timezone 和 Workspace 根路径变化不改变结果。
5. 生成代码的 module、definition、evaluator、handler、bootstrap 关键段都有可定位 SourceSpan。

## 5. 失败与资源

1. unsupported AST、缺失 method、错误 coercion、ABI mismatch、非法 SourceSpan 返回稳定 Diagnostic。
2. 输出、AST、dependency、Map segment 或 diagnostics 任一累计预算超限返回 `TK_EMIT_LIMIT_EXCEEDED`。
3. 取消发生在任一 module/statement/expression/map/finalize 阶段时无 partial result。
4. 连续成功、失败、取消混合执行 100 次后无跨 Session Bundle、Map、AST projection 或 definition cache。
5. Source Map 失败不得回退为“无 map 成功”。

## 6. 联合边界

Fake S06 读取同一 canonical model 后，必须证明：

```text
S05 page bootstrap.templateId == S06 pageIr.templateId
S05 bindingEvaluatorIds == S06 pageIr.bindingIds
S05 handlerMethodIds == S06 pageIr.handlerIds
```

S05 不读取 S06；S06 不读取 S05。任何 target/property/eventType 只在 S06 Page IR 中出现，任何 evaluator/method body 只在 S05 Bundle 中出现。

禁止范围扫描必须证明 S05 目录不存在 Page IR serializer、Runtime Metadata、Artifact、ZIP/RPK、Runtime Tree、QuickJS 执行实现。

## 7. 需求映射

| 需求 | 证据 |
|---|---|
| R01-R04 | input immutability、closure、atomic result、session isolation |
| R05-R08 | App/Shared/Page Bundle、Definition、bootstrap Golden |
| R09-R10 | module/require/context/global/capability tests |
| R11-R13 | evaluator/handler ID、coercion、Case 002 Golden |
| R14-R16 | syntax diagnostics、Source Map、canonical bytes |
| R17-R20 | 100 次 determinism、path/privacy、limits、ABI validator |
| R21-R24 | S06 boundary、forbidden scan、runtime non-implementation evidence |
