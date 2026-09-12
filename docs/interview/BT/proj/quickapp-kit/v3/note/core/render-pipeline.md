# Core 渲染管线

## 管线本身：无分支的纯数据流水线

`intent + IR → 建树 → 布局 → 出 mount → 下发平台`。每步"数据进、数据出"，无状态、无时序、无回头。
管线本身"没什么好讲"恰是它设计成功的标志——聪明都在两端的决策（id 驱动 / 单一权威 / 事务），
管线只是这些决策的自然产物。有肉的是线上几个"点"：建树、布局、mount 顺序约束。

## 建树（stage_initial）第一性：把"模板"实例化成"这一屏的活节点树"

三件事：
1. **IR + intent 合流**：IR 是共享模板（类），intent 补"这屏有哪些实例、初值多少"（实例）。建树 = 实例化。
2. **NodeId 分配**：模板 id 是"哪种"，NodeId 是"哪个"。给每个实例节点发运行时唯一身份，逻辑身份 = owner + '#' + templateNodeId。后续增量/mount/平台映射全靠它寻址。
3. **暂存原子提交**：在 staged 草稿上建，全成功才 commit；失败丢草稿，活 tree 不动。不改真身、无需回滚。

## 原子性的边界：只在 Core 内成立，不跨平台

**Core 内**：暂存 + 提交，真原子——失败不改真身，无需回滚，保证权威 tree 自洽。

**跨到平台：没有原子性，无法回滚。** 因为发出去的是**序列化的单向指令**，出门即不可撤回：
- Core 把事务序列化成一批 mount 操作发给平台，这个动作本身即"已提交"。
- 平台消费到一半失败，Core 无法自动撤回——指令已跨边界，Core 手里没有平台的 undo 句柄。
- 平台失败时两边状态会不一致：Core 以为新状态，平台停在半截。

这是**序列化换解耦付的代价**：换来了解耦/异步/平台自定节奏，丢掉了跨边界回滚能力。函数直调能同步回滚，序列化指令流不能。

收敛靠"对账 + 重放"，不是回滚：事务带 revision，平台回传结果；失败不撤回，而是基于权威 tree 重新生成正确状态让平台重建。**用"重放到正确态"代替"回滚到旧态"。**

## 平台失败反馈机制（基于 mount_coordinator.cpp 实测）

**平台怎么通知 Core** —— 回一个 `MountTransactionResult`，6 字段：
`surface_id, revision, mount_attempt_id, source_id, mounted(bool), error?`。
`mounted=true` 成功；`false` + error 失败。前四个是**关联字段**——`accept()` 校验它们必须和 pending 对上（revision/mount_attempt_id/source_id 对不上直接判无效结果），Core 据此确认"你回的是我发的哪一批"。

**Core 收到失败怎么处理**（`if (!result.mounted)` 分支实测）：
1. 发失败 marker（MountTransactionFailed / RenderTransactionFailed，观测用）。
2. 增量：`render_results->complete(..., false, failure)` —— 把失败**如实上报给提交方**（最终到 JS）。
3. `state.pending.reset()`，且 **committed_revision 不推进**（版本停在上一个成功版）。
4. 首帧失败则 `complete(state, false, failure)`。

**关键（诚实边界）**：当前 MountCoordinator **不自动重发事务**。它止于"标记失败 + 版本不推进 + 上报失败"，重试决策交给上层——上层要重试就**重新发起一次渲染意图**（重走管线），重发不是 MountCoordinator 的职责。

**为什么版本不推进很重要**：没推进 → Core 的"已确认状态"还停在上一个成功 revision → 和平台实际状态（也停在失败前那版）保持一致。失败不会让两边错位，只是"这次更新没生效"。

> 注：文档别处提过的"Core 基于权威 tree 重放重建"是架构上合理、可做的方向，但当前实现没有自动重放；MountCoordinator 只做上报 + 不推进，重试由上层触发。别把"应该能做"讲成"已经做了"。
