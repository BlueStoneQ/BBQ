# TK-S05 JS Module Emitter

## 目录

- [1. 结论](#1-结论)
- [2. 本质](#2-本质)
- [3. 输入与输出](#3-输入与输出)
- [4. 负责与不负责](#4-负责与不负责)
- [5. 核心冻结](#5-核心冻结)
- [6. 上下游边界](#6-上下游边界)
- [7. 交付物与状态](#7-交付物与状态)

## 1. 结论

TK-S05 的唯一职责是：**把同一份 `CanonicalLoweredAppModel` 中的 App/Shared/Page 可执行语义，确定性发射为符合公共 JS Module ABI 的 Bundle 和 Source Map。**

```text
CanonicalLoweredAppModel
  -> module/program projection
  -> JS expression/evaluator/method emission
  -> $app_define$ / $app_bootstrap$ / $app_require$ wrapper
  -> App/Shared/Page Bundle + Source Map
```

S05 不重新解析联盟 DSL，不重新 Lower，不生成 Page IR，不复制静态模板树或 Binding/Handler target。

## 2. 本质

S04 已经回答“源码语义是什么”；S05 只回答“这些可执行语义怎样交给 JS Runtime”。

1. Module Graph 事实变成 ABI dependencies 和 typed module reference。
2. Canonical expression 变成 Binding evaluator callable。
3. Canonical method 事实变成 Handler method body 和 `handlerMethods` 映射。
4. App/Page module entry 变成 define/bootstrap 一致的 Bundle；Shared module 只注册 definition，不执行 bootstrap。
5. 每个生成字节位置保留到联盟源码的 Source Map。

Bundle 是行为载体，不是模板事实载体。静态 Host、Style、Binding target、Block parent/root 和 Handler target 只由 S06 Page IR 持有。

## 3. 输入与输出

### 3.1 输入

- 已验证、深不可变的 `CanonicalLoweredAppModel`。
- Build Session 的 compiler/tool version、bundle path policy 和 `CancellationToken`。
- 只读 JS emission limits；不得从 Workspace、SourceAccess 或 S02/S03 再取数据。

### 3.2 输出

- App Bundle：`app.js`。
- Shared Bundle：每个 canonical shared module 一个确定性 Bundle。
- Page Bundle：每个 Page 一个确定性 Bundle，bootstrap 携带 `moduleId` 和 `templateId`。
- 每个 Bundle 的 Source Map JSON。
- 结构化 `JsEmissionResult`：成功时完整集合，失败/取消时无部分 Bundle 集合。

Bundle path 是 Artifact Descriptor 的输入事实，不在 S05 生成 Runtime Metadata、Artifact Descriptor 或 RPK。

## 4. 负责与不负责

### 4.1 负责

- `$app_define$`、`$app_bootstrap$`、`$app_require$` 的 V1 wrapper 生成；`$app_require$` 必须返回已注册 module 的 `module.exports`。
- App/Shared/Page moduleId 与 dependencies 一致性，以及 App/Page bootstrap kind/templateId 一致性；Shared 不产生 bootstrap。
- V1 受支持 JS AST 的确定性生成：语句、表达式、对象、函数、import/require/export。
- `bindingEvaluators`：十进制 `TemplateBindingId` 到 callable 的映射。
- `handlerMethods`：十进制 `TemplateHandlerId` 到非空 methodName 的映射。
- typed module reference、`require.context` 和 `system.fetch` deferred reference 的 Bundle 表达。
- Source Map v3 的确定性生成与源码位置诊断。
- 输出大小、生成节点、Map segment、取消和原子结果边界。

### 4.2 不负责

- Manifest、route、Module Graph、SourceAccess 或 DSL 解析。
- Host/Style/Binding/Block/Event 语义 Lowering 和任何 Template ID 分配。
- Page IR、Runtime Metadata、Artifact Descriptor、ZIP/RPK 或签名。
- Runtime VM、QuickJS、Capability provider、Bridge、Render、事件或生命周期执行。
- 完整 VNode Tree、Binding target、Handler target、Runtime NodeId、HandlerId 或 NativeHandle。

## 5. 核心冻结

1. **单一输入**：S05 只接受同一版本的深不可变 `CanonicalLoweredAppModel`。
2. **单一 Definition 形态**：App/Page Bundle 必须在 `$app_define$` factory 内通过 `module.exports` 导出符合公共 `P0-JS-EXPORT-001` 的 Definition；`$app_require$(moduleId)` 返回该 Definition。Shared Module 仍是普通 module export。
3. **单一寻址事实**：Bundle 只输出 `TemplateBindingId -> evaluator` 和 `TemplateHandlerId -> methodName`；target/property/eventType 不进入 Bundle。
4. **bootstrap 分层**：Shared Bundle 只调用 `$app_define$`，不得调用 `$app_bootstrap$`；App Bundle 和每个 Page Bundle 各自恰好调用一次 `$app_bootstrap$`，moduleId 与 Page templateId 必须匹配输入模型。
5. **单一依赖解析**：Bundle 中所有 module reference 只来自 S04 canonical references；S05 不根据字符串重新猜 target。
6. **确定性**：同一模型、工具版本和配置得到相同 Bundle/Map 字节；Map、object key、dependency、module 和 diagnostic 顺序固定。
7. **原子结果**：任一不支持语法、ABI 不一致、预算超限或取消都不发布部分 Bundle。

## 6. 上下游边界

| 阶段 | S05 读取/产生 | 禁止事项 |
|---|---|---|
| TK-S04 | 读取 canonical module、expression、method、Binding/Handler ID | 不读取 S02/S03 私有模型，不改输入 |
| TK-S05 | 产生 JS Bundle、Source Map、emission result | 不产生 Page IR、Metadata、Artifact |
| TK-S06 | 独立读取同一 model | 不依赖 S05 Bundle，不复制 JS 语义 |
| TK-S07 | 后续消费 Bundle 和 Map | 由 S07 生成 Metadata/Descriptor/RPK，不由 S05 越权 |
| JS Runtime | 运行时消费 Bundle | Runtime 不反向解释联盟 DSL |

## 7. 交付物与状态

1. [Requirements](./requirements.md)
2. [Design](./design.md)
3. [Tasks](./tasks.md)
4. [Acceptance](./acceptance.md)

`VERIFIED`：TK-S05 实现、测试和证据已通过总架构校审；TK-S07 已放行消费其 Bundle/Map。
