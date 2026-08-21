# TK-S06 Page IR Emitter

## 目录

- [1. 结论](#1-结论)
- [2. 本质](#2-本质)
- [3. 输入与输出](#3-输入与输出)
- [4. 负责与不负责](#4-负责与不负责)
- [5. 核心冻结](#5-核心冻结)
- [6. 上下游边界](#6-上下游边界)
- [7. 交付物与状态](#7-交付物与状态)

## 1. 结论

TK-S06 的唯一职责是：**把同一份 `CanonicalLoweredAppModel` 中每个 Page 的静态结构与寻址定义，确定性投影为公共 Page IR。**

```text
CanonicalLoweredAppModel.pages[]
  -> schemaVersion/templateId/root
  -> nodes + canonical Host + child slots
  -> bindings + blocks + handlers
  -> public Page IR validation
  -> deterministic UTF-8 JSON bytes
```

S06 不重新解析 DSL、不重新 Lower、不重新分配 Template ID，不生成 evaluator、method body、Bundle、Metadata 或 RPK。

## 2. 本质

Page IR 是 Core 创建 Runtime Tree 和解析静态目标的唯一模板事实，不是另一棵运行时树。

1. `nodes` 定义静态 Host 结构和 child slots。
2. `bindings` 定义 `TemplateBindingId -> scope + target`。
3. `blocks` 定义 `TemplateBlockId -> kind + parent + template root`。
4. `handlers` 定义 `TemplateHandlerId -> scope + target + eventType`。
5. JS evaluator、method、module dependency、source provenance 和运行时 ID 不进入 Page IR。

## 3. 输入与输出

### 3.1 输入

- 已验证、深不可变的 `CanonicalLoweredAppModel`。
- 公共 `page-ir.schema.json` 与 `host-component.schema.json` validator port。
- `PageIrEmissionLimits` 和 `CancellationToken`。

S06 不接受 ParsedSource、ResolvedAppModel、Bundle 或 S05 私有数据。

### 3.2 输出

- 每个 canonical Page 一个严格符合公共 Schema 的 `PageIr` value。
- 每个 Page 一个确定性 UTF-8 JSON byte sequence。
- 逻辑 path：`quickapp-kit/pages/<manifestRoute>/index.ir.json`。
- 结构化 `PageIrEmissionResult`；失败/取消时无部分 Page IR 集合。

S06 不生成 Artifact Descriptor；byteLength/hash/path 只作为 TK-S07 后续输入事实。

## 4. 负责与不负责

### 4.1 负责

- `schemaVersion=1`、templateId、root 和四类 definition table 的精确投影。
- canonical Host Component/props/style 的无损投影。
- Node/Block 有序静态图和 scope 派生关系校验。
- Binding/Handler target、Block parent/root 和 ID 集校验。
- 公共 Schema validator 调用与跨字段语义校验。
- 确定性 JSON key/array/number/string 编码。
- 输出大小、结构深度、成员数量、取消和原子发布。

### 4.2 不负责

- DSL、JavaScript、CSS/Less、Manifest、route 或 module graph 解析。
- Host/Style/Binding/Block/Event 语义 Lowering和 Template ID 分配。
- Binding evaluator、Block controller expression、Handler methodName 或 JS Bundle。
- Runtime Metadata、Artifact Descriptor、ZIP/RPK、签名或 Loader。
- Runtime NodeId、BlockInstanceId、HandlerId、NativeHandle、Layout 或 RenderTransaction。

## 5. 核心冻结

1. **直接投影**：S06 字段只来自 S04 canonical Page；不增加私有 Page IR 字段。
2. **ID 不变**：四类 Template ID 原值透传；不排序重编号、不压缩、不散列。
3. **语义分离**：Binding/Handler 的 target 只在 Page IR；evaluator/method 只在 S05 Bundle。
4. **结构唯一**：Node 与 Block 共同组成一棵单根、可达、无环、无多父的有序模板图。
5. **Schema 唯一**：直接消费公共 Schema，不复制或扩展同名 Schema。
6. **字节确定**：数组按 Template ID，object key 按固定字段序，数值和字符串使用唯一 JSON 编码。
7. **原子结果**：任何关系错误、Schema 错误、预算超限或取消都不发布部分 Page IR。

## 6. 上下游边界

| 阶段 | S06 读取/产生 | 禁止事项 |
|---|---|---|
| TK-S04 | 读取 canonical Page static facts 和四类 ID | 不回读 S02/S03，不改输入 |
| TK-S05 | 独立读取同一 model | S06 不读取 Bundle，不复制 evaluator/method |
| TK-S06 | 产生公共 Page IR value/bytes | 不产生 Metadata、Descriptor、RPK |
| TK-S07 | 后续索引 Page IR path/hash | 由 S07 做 Artifact 关系和打包 |
| Core Loader | 运行时验证/索引 Page IR | Core 不解释联盟 DSL |

## 7. 交付物与状态

1. [Requirements](./requirements.md)
2. [Design](./design.md)
3. [Tasks](./tasks.md)
4. [Acceptance](./acceptance.md)

`VERIFIED`：TK-S06 实现、测试和证据已通过总架构校审；TK-S07 已放行消费其 Page IR。
