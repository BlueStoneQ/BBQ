# TK-S06 Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 输入合同](#2-输入合同)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 边界需求](#5-边界需求)

## 1. 结论

S06 必须把 S04 已裁决的静态事实无损投影为公共 Page IR；它是 serializer + validator，不是第二个语义编译器。

## 2. 输入合同

| ID | 需求 |
|---|---|
| TK-S06-R01 | 只接受深不可变、版本匹配的 `CanonicalLoweredAppModel`；不接受 DSL AST、Module Graph 或 Bundle。 |
| TK-S06-R02 | 每个 Page 必须有唯一 route/moduleId/templateId、root 和连续独立的四类 Template ID。 |
| TK-S06-R03 | S06 必须直接调用公共 Page IR/Host Schema validator，不复制 Schema。 |
| TK-S06-R04 | 输入不被修改，不建立跨 Build Session mutable cache；失败/取消无部分结果。 |

## 3. 功能需求

| ID | 需求 |
|---|---|
| TK-S06-R05 | 每页输出 `schemaVersion=1`、templateId、rootTemplateNodeId、nodes、bindings、blocks、handlers。 |
| TK-S06-R06 | Node 原样保留 TemplateNodeId、canonical Host 和有序 Node/Block child slot。 |
| TK-S06-R07 | Binding 原样保留 TemplateBindingId、scope 和 target；不得输出 evaluator、resultType 或 source。 |
| TK-S06-R08 | Block 原样保留 TemplateBlockId、kind、parentTemplateNodeId、templateRootNodeId；不得输出 controller/expression/aliases。 |
| TK-S06-R09 | Handler 原样保留 TemplateHandlerId、scope、templateNodeId、eventType；不得输出 methodName。 |
| TK-S06-R10 | 校验 Node/Block 联合图单根、全可达、无环、无多父、Block slot/parent/root 唯一。 |
| TK-S06-R11 | 校验 Binding/Handler target 存在、scope 等于目标派生 scope、Host prop/event 合法且 target 不重复。 |
| TK-S06-R12 | 四类 ID 在各自 Page 命名空间内唯一、正整数、safe integer 且保持 S04 原值。 |
| TK-S06-R13 | 按公共 Schema 的精确字段生成 Page IR；additional property、运行时 ID、平台类型和 source provenance 均禁止。 |
| TK-S06-R14 | 输出确定性 UTF-8 JSON bytes；key order、array order、换行、number 和 string escaping 唯一。 |
| TK-S06-R15 | 为每页生成无碰撞逻辑 path，供 TK-S07 建立 Artifact Descriptor。 |

## 4. 质量需求

| ID | 需求 |
|---|---|
| TK-S06-R16 | 相同 canonical model 连续 100 次得到字节一致 Page IR 和 hash；Workspace 根、locale 和并发顺序无影响。 |
| TK-S06-R17 | 结构错误和 Schema 错误返回稳定 phase/file/range/code/hint；Diagnostic 使用 S04 provenance，但 provenance 不进入 IR。 |
| TK-S06-R18 | 累计预算覆盖 pages、nodes、children、bindings、blocks、handlers、JSON bytes、校验 work 和 diagnostics。 |
| TK-S06-R19 | 取消可发生在 projection、graph validation、Schema validation 和 serialization；均不得发布部分结果。 |

## 5. 边界需求

| ID | 需求 |
|---|---|
| TK-S06-R20 | S06 不读取 S05 Bundle/Map，也不生成 evaluator、handler method、bootstrap 或 module ABI。 |
| TK-S06-R21 | S06 不生成 Runtime Metadata、Artifact Descriptor、RPK、签名或 Loader。 |
| TK-S06-R22 | Page IR 不含 JS callable、dependency path、Runtime NodeId/HandlerId/BlockInstanceId/NativeHandle 或平台对象。 |
| TK-S06-R23 | S05/S06 联合验收只比较同一 S04 definition 的 templateId 和 Binding/Handler ID 集，不互相复制语义。 |
