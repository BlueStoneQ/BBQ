# TK-S04 Canonical Lowering

## 目录

- [1. 结论](#1-结论)
- [2. 本质](#2-本质)
- [3. 输入与输出](#3-输入与输出)
- [4. 负责与不负责](#4-负责与不负责)
- [5. 核心冻结](#5-核心冻结)
- [6. 上下游边界](#6-上下游边界)
- [7. 权威依据](#7-权威依据)
- [8. 交付物](#8-交付物)
- [9. 状态](#9-状态)

## 1. 结论

TK-S04 的唯一职责是：**把已解析、已解析引用的联盟应用模型一次性归一为唯一 Canonical Lowered Model。**

```text
ResolvedAppModel + ParsedSourceModel
  -> 输入不变量校验
  -> Host / Style / Binding / Block / Event 唯一语义 Lowering
  -> 稳定 Template* ID 分配
  -> 深不可变 Canonical Lowered Model
       -> TK-S05 JS Bundle 投影
       -> TK-S06 Page IR 投影
```

TK-S05 与 TK-S06 不得重新解释联盟 DSL，不得重新匹配样式，不得重新分配 ID。

## 2. 本质

Canonical Lowering 消除的是“同一份联盟源码究竟对应什么 Runtime 语义”的歧义。

Frontend AST 仍是源码语法；Page IR 已是 Runtime 静态结构。S04 是两者之间唯一的语义裁决点：

1. 联盟组件映射成哪个 Host Component。
2. 哪些样式最终作用于哪个 Host Node。
3. 哪个动态值形成一个 Binding。
4. 哪个 `if/for` 形成一个 Block，以及 Block 的控制表达式和 scope。
5. 哪个 `onclick` 形成一个 Event Handler。
6. 以上对象使用哪些稳定 Template ID。

## 3. 输入与输出

### 3.1 输入

- TK-S02 已验证的 `ResolvedAppModel`：Manifest、Page、Module、Asset、Capability 与引用闭包事实。
- TK-S03 已验证的 `ParsedSourceModel`：Template、Script、Style 的 compiler-owned AST、SourceSpan 与 feature usage。
- `LoweringLimits` 与 `CancellationToken`。

S04 不读取文件系统，不重新解析源码，不解析 import target。

### 3.2 输出

唯一输出是版本化、深不可变、确定排序的 `CanonicalLoweredAppModel`，其中每个 Page 只包含一份：

- App/Shared/Page 的 canonical JS Program、moduleId、dependency 与已解析 module reference；
- canonical Host Node 与静态 props/style；
- Binding 目标、求值语义与源码出处；
- Block 静态结构、scope 与控制语义；
- Event 目标、事件类型、method 语义与源码出处；
- `templateId` 与四类 `Template*Id`。

该模型是 Toolkit 内部跨阶段合同，不是 RPK 公共 Schema。

## 4. 负责与不负责

### 4.1 负责

- 校验 S02/S03 输入闭包与快照一致性。
- `div/text/input[type=button]` 到 `View/Text/Button` 的唯一映射。
- Less V1 子集求值、selector 匹配、cascade、shorthand 与 Host Style 规范化。
- text/value interpolation 到单一 Host prop Binding。
- `if` 与 keyed `for` 到 Block 和控制表达式。
- `onclick` 到 `click` Handler，并校验 VM method 静态存在。
- 每页四个独立正整数 ID 命名空间的确定性分配。
- 结构、scope、目标、诊断、预算、取消和深不可变。

### 4.2 不负责

- Manifest、route、module graph、引用解析或 SourceAccess。
- UX/JS/CSS/Less parser。
- JavaScript transform、module bundle、evaluator code emission 或 Source Map。
- Page IR、Runtime Metadata、Artifact、RPK 或签名生成。
- Runtime NodeId、ComponentInstanceId、BlockInstanceId、HandlerId。
- 运行期状态、Tree Diff、RenderTransaction、MountTransaction 或事件派发。

## 5. 核心冻结

1. **唯一模型**：S05/S06 必须消费同一个 `CanonicalLoweredAppModel` 实例语义，不能各建私有 Lowering。
2. **唯一所有权**：Host、Style、Binding、Block、Event 语义只由 S04 决定。
3. **稳定 ID**：同一规范化输入必得相同 ID；稳定不表示源码修改后旧编号永久不变。
4. **静态目标唯一**：Binding/Handler 的目标只在 Lowered Model 中形成一次；S05 不复制目标描述，S06 将目标投影到 Page IR。
5. **原子结果**：任一 error、取消或预算超限都不发布部分 Lowered Model。
6. **资源有界**：所有遍历、展开、匹配、求值和输出对象均受累计预算控制。

## 6. 上下游边界

| 阶段 | 消费/产生 | 禁止事项 |
|---|---|---|
| TK-S02 | 产生 `ResolvedAppModel` | 不做 Host/Style/Binding/Block/Event Lowering |
| TK-S03 | 产生 `ParsedSourceModel` | 不分配 Template ID，不解释 Runtime 语义 |
| TK-S04 | 产生唯一 Canonical Lowered Model | 不生成 JS、Page IR 或 Artifact |
| TK-S05 | 消费 canonical module program、evaluator、block controller、handler method 语义 | 不回读 S02/S03、分配 ID 或复制 target descriptor |
| TK-S06 | 消费 Host 结构、ID、target、scope | 不重新匹配样式或解释表达式 |

## 7. 权威依据

- [Toolkit 总 Spec](../../README.md)
- [TK-S02 Manifest 与 Module Graph](../tk-s02-manifest-module-graph/README.md)
- [TK-S03 Source Frontends](../tk-s03-source-frontends/README.md)
- [Artifact Contract](../../../../../spec/contracts/artifact-contract.md)
- [ID Contract](../../../../../spec/contracts/id-contract.md)
- [Host Component Contract](../../../../../spec/contracts/host-component-contract.md)
- [Block Lifecycle](../../../../../spec/contracts/block-lifecycle.md)
- [Render Contract](../../../../../spec/contracts/render-contract.md)
- [Page IR Schema](../../../../../spec/contracts/schemas/page-ir.schema.json)

## 8. 交付物

1. [Requirements](./requirements.md)
2. [Design](./design.md)
3. [Tasks](./tasks.md)
4. [Acceptance](./acceptance.md)

## 9. 状态

`READY_FOR_REVIEW`：只完成 TK-S04 分 Spec；产品代码仍为 `CODE_BLOCKED`，TK-S05/TK-S06 未启动。
