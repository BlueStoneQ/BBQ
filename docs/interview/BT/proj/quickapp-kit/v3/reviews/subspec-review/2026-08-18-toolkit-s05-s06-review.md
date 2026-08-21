# Toolkit TK-S05/TK-S06 定向校审

## 目录

- [1. 结论](#1-结论)
- [2. 已通过部分](#2-已通过部分)
- [3. 必须修正](#3-必须修正)
- [4. 放行条件](#4-放行条件)
- [5. Agent 指令](#5-agent-指令)

## 1. 结论

**TK-S05/TK-S06 的设计主线成立，但当前结论是 `DESIGN_REMEDIATION_REQUIRED`，尚未授予 `CODE_ALLOWED`。**

原因不是架构方向错误，而是公共 JS Module ABI 在两个边界上仍存在可执行歧义。修正后不需要重写两份分 Spec，也不需要重新设计 S04。

当前准确状态：

```text
TK-S05/TK-S06 分 Spec：READY_FOR_REVIEW
TK-S05/TK-S06 代码：CODE_BLOCKED
TK-S07：未启动
Toolkit 产品代码：仅 TK-S01..TK-S04 已验证
```

## 2. 已通过部分

以下设计与总架构一致：

1. S04 是唯一语义 Lowering 和四类 Template ID 的生产者。
2. S05 只投影 App/Shared/Page 的 JS Bundle、Definition、Binding evaluator、Handler method map 和 Source Map。
3. S06 只投影静态 Page IR，不输出 evaluator、method body、Runtime Node、Platform object 或 Runtime Artifact。
4. S05/S06 不互读产物，联合一致性只比较同一 S04 model 的 template、Binding、Handler ID 集。
5. Page IR 的根、可达、无环、无多父、Block scope、target 和 Host 校验边界清楚。
6. 两项均保留确定性、深不可变、预算、取消、原子发布和禁止范围。
7. 与 M1-Alpha 的真实 RPK 入口没有架构冲突：TK-S05/TK-S06 完成后由 TK-S07 组装 Metadata、Descriptor 和 Runtime RPK。

## 3. 必须修正

### P1-TK-ABI-001：明确 Definition 的导出动作

TK-S05 的示例定义了 App/Page Definition，但没有把它明确赋值给 `module.exports`；同时公共合同要求 Runtime 消费 `module.exports` Definition。必须在 TK-S05 design、requirements、tasks、acceptance 中统一写成可执行语义：

```js
$app_define$("<moduleId>", ["<dependencyId>"], function ($app_require$, module, exports) {
  const definition = {
    schemaVersion: 1,
    kind: "page",
    createPageVm,
    bindingEvaluators,
    handlerMethods
  };
  module.exports = definition;
});
```

App 使用 `createAppVm`，Page 使用 `createPageVm`、`bindingEvaluators`、`handlerMethods`。Definition 必须是 factory 执行后的 `module.exports` 值，不能只作为 bootstrap metadata 或未导出的局部变量。

验收必须增加：`$app_require$(pageModuleId)` 返回的值直接通过 `P0-JS-EXPORT-001`，并验证 `module.exports` 未被替换成未知字段、Accessor、Proxy 或原型对象。

### P1-TK-ABI-002：Shared Module 不得 Bootstrap

TK-S05 design 第 54 行写成“每个 Bundle”都使用 `$app_bootstrap$`，但公共 Artifact Contract 明确 Shared Module 不执行 bootstrap，只有 App/Page 需要 bootstrap。必须统一为：

```text
App Bundle：$app_define$ + 一次 $app_bootstrap$(kind=app)
Page Bundle：$app_define$ + 一次 $app_bootstrap$(kind=page, templateId)
Shared Bundle：只 $app_define$，不调用 $app_bootstrap$
```

Shared Module 的导出按普通 Module ABI 处理，并由 AppRuntime cache scope 缓存一次；不得伪造 App/Page Definition，也不得产生 templateId。

验收必须增加 Shared 正例和负例：Shared 有 bootstrap 时返回 `TK_EMIT_ABI_INVALID`；Shared 无 bootstrap 且 `$app_require$` 可加载时通过。

### P2-TK-ABI-003：删除“每个 Bundle”与公共合同冲突的表述

同步修正 TK-S05 README、design、requirements、tasks、acceptance 中的“每个 Bundle bootstrap”“App/Page/Shared Definition”表述，避免后续实现 Agent 按错误示例编码。

## 4. 放行条件

修正完成后只需重新提交 TK-S05/TK-S06 设计校审，不需要重做总架构校审。放行标准：

1. 两处 ABI 修正同步出现在 S05 五份文档和 S06 联合验收引用中。
2. S05 的 App/Page/Shared 三种 module 形态可由一张表完全区分。
3. `module.exports`、bootstrap 次数、bootstrap kind、templateId 和 Shared cache scope 均可被测试直接断言。
4. S06 不产生任何新增职责。
5. Handoff 标记 `READY_FOR_REVIEW`，然后总架构授予 `TK-S05/TK-S06 CODE_ALLOWED`。

TK-S07 仍然必须等待 S05/S06 代码验证通过后再启动；Alpha 不提前绕过这两个投影器。

## 5. Agent 指令

```text
继续当前 Toolkit 对话。

总架构已完成 TK-S05/TK-S06 定向校审。结论：DESIGN_REMEDIATION_REQUIRED；暂不编码。

只做以下文档修正，不改 S04，不改公共 Schema，不创建产品代码：
1. 明确 App/Page Definition 必须通过 module.exports 导出，并补充 $app_require$ 返回 Definition 的验收。
2. 明确 Shared Bundle 只调用 $app_define$，不得调用 $app_bootstrap$；App/Page 各自 bootstrap 恰好一次。
3. 同步修改 TK-S05 五份文档中的示例、需求、任务和验收，删除“每个 Bundle 都 bootstrap”的歧义。
4. 在 Handoff 追加本次修正，标记 READY_FOR_REVIEW。

禁止：
- 不编码 TK-S05/TK-S06。
- 不启动 TK-S07。
- 不修改 P0-JS-EXPORT-001、Page IR Schema、Artifact Contract。
- 不把 Page IR target 放入 Bundle，不把 evaluator/method 放入 Page IR。
```
