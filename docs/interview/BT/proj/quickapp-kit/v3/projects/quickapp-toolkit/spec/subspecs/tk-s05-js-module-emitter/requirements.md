# TK-S05 Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 输入合同](#2-输入合同)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 边界需求](#5-边界需求)

## 1. 结论

S05 必须把 S04 已裁决的可执行事实变成 Runtime 可以验证和执行的 JS Module ABI，不承担第二次语义裁决。

## 2. 输入合同

| ID | 需求 |
|---|---|
| TK-S05-R01 | 只接受深不可变、版本匹配的 `CanonicalLoweredAppModel`；不接受 Workspace、ParsedSource 或 ResolvedAppModel。 |
| TK-S05-R02 | 输入 App/Shared/Page moduleId、dependencies、program、references、Page templateId 和四类 ID 必须完整且内部一致。 |
| TK-S05-R03 | 取消、预算和错误发生在发射前后均不得发布部分 Bundle。 |
| TK-S05-R04 | 输入模型不被修改，不建立跨 Build Session 可变缓存。 |

## 3. 功能需求

| ID | 需求 |
|---|---|
| TK-S05-R05 | 生成 App Bundle；其 `$app_define$` factory 必须通过 `module.exports` 导出公共 ABI 的 App Definition，`$app_require$(appModuleId)` 必须返回该 Definition。 |
| TK-S05-R06 | 生成每个 Shared Module Bundle/定义，依赖和执行范围来自 canonical module entry；Shared Bundle 只调用 `$app_define$`，不得调用 `$app_bootstrap$`。 |
| TK-S05-R07 | 生成每个 Page Bundle；其 `$app_define$` factory 必须通过 `module.exports` 导出 `createPageVm(surfaceContext)`、`bindingEvaluators`、`handlerMethods`，`$app_require$(pageModuleId)` 必须返回该 Definition。 |
| TK-S05-R08 | 生成 `$app_define$`、`$app_bootstrap$`、`$app_require$` 兼容 wrapper；App Bundle 和每个 Page Bundle 各自恰好调用一次 `$app_bootstrap$`，Shared Bundle 不得调用。 |
| TK-S05-R09 | import、CommonJS require 和静态 `require.context` 按 S04 已验证 reference 生成确定性 module access；context 必须展开为直接依赖和 `$app_require$(moduleId)`，不得发射运行期 context API。 |
| TK-S05-R10 | 联盟 `@system.*` 必须规范化为 `@app-module/system.*` typed facade reference；typed facade 不进入 Package dependencies，也不生成 generic bridge/request。 |
| TK-S05-R11 | Binding evaluator key 使用十进制 `TemplateBindingId`；callable 的 `this` 为 Page VM，唯一参数为对应只读 lexical scope。 |
| TK-S05-R11A | Page `private` 静态字段必须成为 `createPageVm` 返回对象的根状态；state binding 必须发射为 `this.<state>`，不得读取嵌套 `private` 或自由变量。 |
| TK-S05-R12 | Handler map key 使用十进制 `TemplateHandlerId`，value 只保存 S04 已解析的非空 methodName；target/event 不进入 Bundle。 |
| TK-S05-R13 | Binding evaluator 的 coercion 与 S04 一致：`displayString` 输出 string，`boolean` 输出 boolean；Case 002 的 `0` 保持为字符串 `"0"`。 |
| TK-S05-R14 | 只生成公共 V1 JS AST 子集；未知、动态无法证明或超出矩阵的 AST 返回带 SourceSpan 的稳定诊断。 |
| TK-S05-R15 | 为每个 Bundle 生成 Source Map v3，映射到 workspace-relative sourcePath 和最窄可用 SourceSpan。 |
| TK-S05-R16 | Bundle、Source Map、module 和 diagnostic 的排序、换行、编码和 JSON key 顺序固定。 |

## 4. 质量需求

| ID | 需求 |
|---|---|
| TK-S05-R17 | 相同输入和工具版本的 Bundle/Map 字节与哈希一致；绝对 Workspace 路径不影响结果。 |
| TK-S05-R18 | Source Map 不携带平台对象、运行时 ID、源码绝对路径或无界 source content。 |
| TK-S05-R19 | 输出使用 UTF-8、有限大小和累计生成预算；错误包含 phase/file/range/code/hint。 |
| TK-S05-R20 | 通过 `$app_require$` 取得的 App/Page Definition，其 own properties、ABI discriminator、ID map 和 bootstrap 字段满足公共 Schema/Artifact Contract。 |

## 5. 边界需求

| ID | 需求 |
|---|---|
| TK-S05-R21 | S05 不生成 Page IR、Runtime Metadata、Artifact Descriptor、ZIP/RPK 或签名。 |
| TK-S05-R22 | S05 不读取或修改 S06 输出；S06 不读取 S05 输出。 |
| TK-S05-R23 | Bundle 不含完整 VNode/Host tree，不含 Binding/Handler target descriptor，不含 Template ID 之外的 Runtime identity。 |
| TK-S05-R24 | S05 不实现 QuickJS、VM Controller、Capability Provider 或 Runtime Bridge；只生成可被它们消费的 ABI 字节。 |
