# TK-S06 Design

## 目录

- [1. 结论](#1-结论)
- [2. 发射管线](#2-发射管线)
- [3. Page IR 投影](#3-page-ir-投影)
- [4. 图与 scope 校验](#4-图与-scope-校验)
- [5. 确定性序列化](#5-确定性序列化)
- [6. Schema、错误与资源](#6-schema错误与资源)
- [7. 联合一致性](#7-联合一致性)
- [8. 边界](#8-边界)

## 1. 结论

S06 是严格的静态投影后端：

```text
CanonicalLoweredPageModel
  -> field projection
  -> graph/scope/target invariant validation
  -> public Schema validation
  -> canonical JSON serialization
  -> immutable PageIrEmission
```

S06 不产生新 ID、不计算 Style、不解释 expression。它只证明 S04 静态事实能够无损进入公共 Page IR。

## 2. 发射管线

1. 校验 model version、深不可变、Page identity 和公共 validator 可用。
2. Page 按 `manifestRoute` UTF-8 排序；为每页建立 session-owned projection staging。
3. 按四类 Template ID 升序直接投影 node/binding/block/handler。
4. 建立只读 ID index，验证联合静态图、scope、target 和 Host 合同。
5. 调用公共 `page-ir.schema.json`，其 `$ref` 解析到公共 `host-component.schema.json`。
6. 使用固定 JSON writer 生成 UTF-8 bytes；全部 Page 成功后原子发布 immutable result。

S06 不允许从 Schema 错误修补字段，也不允许忽略未知 canonical field 后继续成功。

## 3. Page IR 投影

### 3.1 顶层

```text
schemaVersion          <- constant 1
templateId             <- canonicalPage.templateId
rootTemplateNodeId     <- canonicalPage.rootTemplateNodeId
nodes[]                <- canonicalPage.nodes
bindings[]             <- canonicalPage.bindings static projection
blocks[]               <- canonicalPage.blocks static projection
handlers[]             <- canonicalPage.handlers static projection
```

Page route/moduleId 用于 emission identity/path/diagnostic，不进入当前公共 Page IR Schema。

### 3.2 Node

```text
templateNodeId
host { type, props, style }
children[] { kind=node + templateNodeId | kind=block + templateBlockId }
```

Host value必须逐字段复制到 schema-owned plain JSON value；不能直接序列化 parser node、class、联盟 tag、source location 或自定义对象原型。

### 3.3 Binding/Block/Handler

| definition | Page IR 保留 | 必须剥离 |
|---|---|---|
| Binding | id、scope、target node/property | evaluator、coercion、resultType、source |
| Block | id、kind、parent node、template root | controller、iterable/key expression、aliases、source |
| Handler | id、scope、target node、eventType | methodName、method body、source |

剥离不是丢失语义：S05 从同一 canonical definition 投影可执行一侧；S06 只持有 Core 所需静态一侧。

### 3.4 逻辑路径

V1 默认 path：

```text
quickapp-kit/pages/<manifestRoute>/index.ir.json
```

`manifestRoute` 必须是 S02/S04 已验证的相对规范路径。S06 仍检查 path traversal、反斜线、空段和碰撞，但不重新 normalize route。

## 4. 图与 scope 校验

### 4.1 结构边

静态图边只有：

```text
Node -> Node child
Node -> Block child
Block -> templateRootNode
```

验收不变量：

1. root Node 入度 0，其余 Node/Block 结构入度 1。
2. 全部 Node/Block 从 root 可达；DFS 不遇到 visiting 节点。
3. 每个 Block 的 parentTemplateNodeId 等于唯一引用它的 Node。
4. Block root 不得被普通 Node child 或另一 Block 复用。
5. child slot 顺序原样保留；S06 不重排结构。

### 4.2 scope

DFS 维护 `derivedScopeByNode`：Page root 从 Page scope 开始；穿过 Block slot 后，该 Block root 及普通后代属于最近 Block scope；进入嵌套 Block 时切换为内层 Block。

Binding/Handler 的显式 scope 必须等于目标 Node 的 derived scope。Block scope 的 TemplateBlockId 必须存在。

### 4.3 target

- `Text.text`、`Button.text`、`Button.enabled` 是合法 Binding target；`View` 无动态 prop。
- `click` 只允许目标为 Button。
- 同一 `(scope,node,property)` Binding 不重复；同一 `(scope,node,eventType)` Handler 不重复。
- 四类 ID 各自连续与否由 S04 contract 冻结；S06至少要求唯一、正整数、safe integer并保持原值，发现断号也按输入不变量失败。

## 5. 确定性序列化

### 5.1 排序

- pages：manifestRoute UTF-8。
- nodes/bindings/blocks/handlers：各自 Template ID 升序。
- children：保留 canonical structural order。
- style properties：按公共 Host Schema 固定字段顺序。
- object key：按本文定义的 schema field order，不使用运行时 object insertion 偶然性。

### 5.2 JSON 编码

- UTF-8，无 BOM；固定终止换行。
- 禁止 NaN、Infinity、negative zero 和超出 Schema 的 number。
- string 使用标准 JSON escaping；不执行 Unicode locale normalization。
- 空数组/对象显式输出；不省略 required field，不输出 undefined/null 占位。
- serializer 只接受 S06 的 closed PageIr value type，不能序列化任意 object。

## 6. Schema、错误与资源

### 6.1 Schema port

S06 接受注入的公共 Schema validator port。产品代码不得复制 `page-ir.schema.json` 或手写一个同名兼容 Schema；graph/scope 校验补充 JSON Schema无法表达的语义不变量。

### 6.2 Diagnostic

| code | 语义 |
|---|---|
| `TK_EMIT_IR_INPUT_INVALID` | canonical Page/version/ID/path 不一致 |
| `TK_EMIT_IR_GRAPH_INVALID` | root/reachability/cycle/indegree/Block 关系错误 |
| `TK_EMIT_IR_TARGET_INVALID` | Binding/Handler scope/target/Host 合同错误 |
| `TK_EMIT_IR_SCHEMA_INVALID` | 公共 Schema validation 失败 |
| `TK_EMIT_IR_LIMIT_EXCEEDED` | projection/validation/JSON 预算超限 |
| `TK_EMIT_IR_CANCELLED` | 取消且无输出发布 |

Diagnostic 使用 canonical source provenance 定位，但 `source` 不进入 Page IR。

### 6.3 资源和原子性

一个请求共享累计预算：pages、nodes、children、bindings、blocks、handlers、graph edges、validation steps、JSON bytes、diagnostics。每个 Page projection、DFS、Schema callback、serialization chunk 和 finalize 检查取消。所有 bytes/value 存在 session staging；全部成功后一次发布，失败不返回已完成 Page 的部分集合。

## 7. 联合一致性

S06 单独不读取 S05，但公开以下 projection facts 供 TK-S07/联合测试比较：

```text
page.templateId
bindingIds[]
handlerIds[]
```

联合合同：

```text
S05.bootstrap.templateId == S06.pageIr.templateId
S05.bindingEvaluatorIds == S06.bindingIds
S05.handlerMethodIds == S06.handlerIds
```

Block controller 只由 S05/后续 JS Framework执行，Block static parent/root 只由 S06/Core 消费；双方共同的 TemplateBlockId 来自 S04，不重新分配。

## 8. 边界

S06 输出的只是 Page IR value/bytes。Runtime Metadata、Artifact Descriptor、hash index、RPK layout、签名、Loader cache 和 Runtime Tree 均不属于本分 Spec。
