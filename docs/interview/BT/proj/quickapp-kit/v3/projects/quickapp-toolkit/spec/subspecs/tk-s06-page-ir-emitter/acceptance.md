# TK-S06 Acceptance

## 目录

- [1. 结论](#1-结论)
- [2. 输入与投影](#2-输入与投影)
- [3. Case 验收](#3-case-验收)
- [4. 图、Schema 与确定性](#4-图schema-与确定性)
- [5. 失败与资源](#5-失败与资源)
- [6. 联合边界](#6-联合边界)
- [7. 需求映射](#7-需求映射)

## 1. 结论

S06 通过的本质是：S04 的静态定义可以无损、确定、唯一地进入公共 Page IR，Core 无需读取 Bundle或解释联盟 DSL。

## 2. 输入与投影

| Case | 必须结果 |
|---|---|
| S06-I01 immutable model | 全部 Page 成功，输入未修改 |
| S06-I02 mutable/unknown model version | `TK_EMIT_IR_INPUT_INVALID`；无部分结果 |
| S06-I03 duplicate/gap/unsafe ID | input invalid；不重编号 |
| S06-I04 path collision/traversal | input invalid；不 normalize 猜测 |
| S06-P01 Node | id/Host/child order 与 canonical page 一致 |
| S06-P02 Binding | 只含 id/scope/target，无 evaluator/source |
| S06-P03 Block | 只含 id/kind/parent/root，无 controller/aliases |
| S06-P04 Handler | 只含 id/scope/target/eventType，无 methodName |
| S06-P05 public Schema | Page IR 与 Host Schema validator 均 PASS，无 additional property |

## 3. Case 验收

### 3.1 Case 001

1. Demo/Detail 各有唯一 templateId、root 和稳定 Node/Binding/Handler 表。
2. View/Text/Button、props/style 和 child order 与 S04 Golden 一致。
3. Text/Button target 与 click Handler target/scope 正确。
4. Page IR 不含 JS method、evaluator、module dependencies、source path 或 Runtime ID。

### 3.2 Case 002

1. if/for 各有稳定 TemplateBlockId、parent/root 和 Block child slot。
2. Block root 不被普通 Node child 重复引用。
3. for 子树 Binding/Handler scope 是最近 TemplateBlockId；Page scope定义保持 Page scope。
4. count Binding target 只描述 Text.text，不携带 evaluator 值或 state path。

### 3.3 BLOCK-001

Page IR 必须包含 keyed add/remove 所需完整静态 Block graph、Block-local Binding/Handler target；不包含具体 key、BlockInstanceId 或运行期列表内容。

## 4. 图、Schema 与确定性

### 4.1 负例

- root 缺失/入度非零。
- Node 或 Block 不可达、成环、多父或共享 root。
- Block slot 与 parentTemplateNodeId 不一致。
- Binding/Handler target 不存在、scope 错配、Host prop/event非法或重复。
- Schema additional field、错误 Host shape、非法 number/string。

全部必须失败，无 JSON bytes 发布。

### 4.2 确定性

1. 同一 model 连续 100 次 Page IR value、bytes 和 SHA-256 一致。
2. Page input order、内部 Map order、locale/timezone、Workspace 根和并行完成顺序不影响结果。
3. JSON 使用固定 field/array order、UTF-8、无 BOM、固定终止换行。
4. 公共 Schema 直接从 v3 合同目录加载；项目内没有复制件。

## 5. 失败与资源

1. pages/nodes/children/bindings/blocks/handlers/edges/JSON bytes 任一累计预算超限返回 `TK_EMIT_IR_LIMIT_EXCEEDED`。
2. 取消发生在 projection、DFS、Schema 或 serialization 时返回 `TK_EMIT_IR_CANCELLED`，不发布较早完成的 Page。
3. Schema validator 抛异常映射为稳定 Diagnostic，不输出裸异常或跳过验证。
4. 连续成功、失败、取消混合执行 100 次后，ID index、DFS state、Page value 和 byte buffer 均无跨 Session retained mutable state。
5. 对成功结果尝试修改 nested Host/style/children/definitions 必须失败且 bytes 不变。

## 6. 联合边界

Fake S05 从同一 model 生成 projection facts 后，必须满足：

```text
bootstrap.templateId == pageIr.templateId
bindingEvaluatorIds == pageIr.bindings[*].templateBindingId
handlerMethodIds == pageIr.handlers[*].templateHandlerId
```

S06 不读取 Bundle/Source Map；S05 不读取 Page IR。Bundle 中不存在 target，Page IR 中不存在 evaluator/method。禁止范围扫描必须证明 S06 无 JS emitter、Runtime Metadata、Artifact、ZIP/RPK、Runtime Tree 或 Platform 代码。

## 7. 需求映射

| 需求 | 证据 |
|---|---|
| R01-R04 | immutable/version/schema-port/atomic input tests |
| R05-R09 | exact Page/Node/Binding/Block/Handler projection Golden |
| R10-R13 | graph/scope/target/ID/closed-field negatives |
| R14-R15 | canonical JSON/path Golden |
| R16-R19 | 100 次 determinism、diagnostic、budget、cancellation |
| R20-R23 | S05 boundary、joint ID tests、forbidden scan |
