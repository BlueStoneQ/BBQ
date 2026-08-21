# TK-S06 Tasks

## 目录

- [1. 结论](#1-结论)
- [2. 设计门禁](#2-设计门禁)
- [3. 实现任务](#3-实现任务)
- [4. 依赖与并行](#4-依赖与并行)
- [5. 完成定义](#5-完成定义)

## 1. 结论

S06 只实现“Canonical Lowered Page -> 公共 Page IR value/bytes”投影，不实现 JS 或 Runtime Artifact。

## 2. 设计门禁

1. TK-S04 保持 `VERIFIED`，canonical Page 和 ID 合同未被未校审修改。
2. S06 五份分 Spec 经总架构校审 `PASS`。
3. 工作看板明确 `TK-S06 CODE_ALLOWED`。
4. 公共 Page IR、Host Component 和 Artifact Contract 无未决冲突。

## 3. 实现任务

### TK-S06-T01 输入与 closed PageIr type

- 定义 immutable request/result/limits/diagnostics。
- 定义与公共 Schema 同构的 closed PageIr value type，不允许 additional fields。
- 校验 model version、Page identity、ID 集、path 和深不可变输入。

完成定义：不读取 S02/S03/S05，不修改 S04 model。

### TK-S06-T02 Node/Host projection

- 直接投影 root、Node、canonical Host 和 child slots。
- 实现 Host closed value clone 与字段/数值边界校验。
- 固定 nodes 与 Host/style key ordering。

完成定义：IR 中无联盟 tag/class/source/parser node/platform type。

### TK-S06-T03 Binding/Block/Handler projection

- Binding 只保留 id/scope/target。
- Block 只保留 id/kind/parent/root。
- Handler 只保留 id/scope/target/eventType。
- 剥离 evaluator/controller/method/source，保持四类 ID 原值。

完成定义：与 S05 可执行一侧无语义复制。

### TK-S06-T04 图、scope 与 target validator

- 实现 root/reachability/acyclic/indegree/Block slot-parent-root 校验。
- 派生最近 Block scope并校验 Binding/Handler scope。
- 校验 Host property/event target、重复 target 和四类 ID。

完成定义：所有公共 Page IR 语义不变量在序列化前关闭。

### TK-S06-T05 Schema 与 canonical JSON

- 注入并调用公共 Page IR/Host Schema validator。
- 实现 closed type canonical JSON writer、UTF-8、固定换行/field/array order。
- 生成每 Page logical path，拒绝碰撞和非法路径。

完成定义：相同输入字节一致；不得复制公共 Schema。

### TK-S06-T06 预算、取消与原子发布

- 实现累计 page/member/edge/validation/JSON/diagnostic limits。
- 在 projection、DFS、Schema、serialization、finalize 检查取消。
- staging 全成功后发布，失败/取消无 partial Page IR。

完成定义：连续 Build Session 不保留 mutable index/graph/bytes。

### TK-S06-T07 Case 与联合验收

- Case 001/002、BLOCK-001 Page IR Golden 和 Host/graph/target negatives。
- 公共 Schema positive/negative、determinism、resource、cancellation、mutation tests。
- Fake S05 联合比较 templateId、Binding/Handler ID 集。
- 禁止范围扫描、源码摘要、需求映射和 Handoff。

完成定义：不得启动或实现 TK-S07。

## 4. 依赖与并行

S06 可与 S05 并行，但它们不能直接依赖彼此的产品代码或输出。联合测试以同一 S04 canonical model 为输入，比较两个投影的共享 ID，不建立第三套语义模型。

## 5. 完成定义

- 五份分 Spec 经总架构 `PASS`。
- 代码只修改 Toolkit S06 范围。
- Typecheck/lint/build/unit/integration/Schema/Case/determinism/resource/cancellation/boundary 全通过。
- 证据证明无 JS emitter、Metadata、Artifact、RPK 或 Runtime 实现。
- Handoff 标记 `READY_FOR_REVIEW` 后停止。
