# CORE-S05 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. V1 资源上限](#4-v1-资源上限)
- [5. 质量需求](#5-质量需求)
- [6. 非目标](#6-非目标)
- [7. 需求追踪](#7-需求追踪)

## 1. 结论

Runtime Tree 的本质是把静态模板身份和动态实例身份统一到一个可提交、可回滚的结构权威中；它不复制 Page IR，也不镜像 Host Tree。

## 2. 输入与输出

### 2.1 输入

- CORE-S02 的 immutable `PageIrHandle`。
- 公共 `SurfaceId`、`ComponentInstanceId`、`BlockInstanceId`、`HandlerId`、Template ID 和 `LogicalNodeRef`。
- S06 提供的已校验增量结构意图和初始实例化计划。
- S08 提供的内部 commit 授权。

### 2.2 输出

- 每个 Surface 一个 `RuntimeTreeStore`。
- `LogicalNodeRef <-> NodeId`、Block 和结构 Handler ownership 的确定查询。
- transient `TreeMutation`：新增/删除/移动节点、Block 和 Handler delta，不含 Mount 或 Revision。
- `PreparedTreeCommit` 与 `EventBindingCommitParticipant` 内部合同，供 S08 无具体实现依赖地联合提交树和 EventBinding。
- typed error、资源快照和 teardown 结果。

## 3. 功能需求

| ID | 需求 |
|---|---|
| CORE-S05-R01 | 每个 live Surface 必须且只能有一个 `RuntimeTreeStore`；它是 Runtime Node 结构、父子顺序和逻辑映射的唯一权威。 |
| CORE-S05-R02 | Store 必须持有与 Surface 生命周期一致的 immutable `PageIrHandle`；不得读取、解析或保留 ZIP、JSON、Bundle 或 Source。 |
| CORE-S05-R03 | `RuntimeNode` 必须包含 `NodeId`、`LogicalNodeRef`、TemplateNodeId、host component identity、父子关系、静态/动态属性与所属 Block；不得包含平台对象。 |
| CORE-S05-R04 | `NodeId` 只由 Core 按 Surface 单调生成，Surface 生命周期内不复用；失败或回滚已消耗的 ID 也不得复用。 |
| CORE-S05-R05 | `LogicalNodeRef` 必须由 owner instance 与 TemplateNodeId 组成；同一 live owner scope 内双向映射唯一。 |
| CORE-S05-R06 | 初次实例化必须从 Page IR root 原子构建静态节点、初始 active Blocks、初始 binding targets 和 Handler ownership；失败时不发布半棵树。 |
| CORE-S05-R07 | Page 级 owner 是 `ComponentInstanceId`；Block 内节点 owner 是对应 `BlockInstanceId`；owner 与 Page IR scope 不匹配返回 `ABI_INVALID_ARGUMENT`。 |
| CORE-S05-R08 | 一个 Block 实例由 `TemplateBlockId + parent OwnerInstanceId + key` 定位，并由 JS 提供的 `BlockInstanceId` 唯一标识；该 ID 在 Surface 生命周期内不复用。`InstantiateBlock` 使用已 live 或 tombstoned ID 返回 `ABI_INVALID_ARGUMENT`。 |
| CORE-S05-R09 | keyed Block 在相同 slot 和 key 下稳定复用原 `BlockInstanceId`/NodeId；新 key 创建新实例，删除后旧 ID 进入 tombstone。 |
| CORE-S05-R10 | `InstantiateBlock` 必须原子创建 Block root 及静态后代；嵌套动态 Block 仅按显式初始计划实例化。 |
| CORE-S05-R11 | `RemoveBlock` 必须递归移除其子 Block、结构 Handler ownership、逻辑映射和 Runtime Nodes；对外删除语义只暴露根删除，不逐个要求 Host 删除后代。 |
| CORE-S05-R12 | `MoveBlock.index` 表示从原位置移除后的最终索引；只允许同 Surface 且 Page IR 声明允许的 slot，非法跨 parent 移动必须拒绝。 |
| CORE-S05-R13 | S05 必须只维护 owner <-> HandlerId 的结构 ownership ledger，并输出 resolved handler add/remove delta；add delta 的事件类型和目标 NodeId 必须由 Page IR 与 LogicalNodeRef 解析，长期 dispatch tuple 只由 S09 保存。 |
| CORE-S05-R14 | S05 不拥有事件回调、可分发 EventBinding 或 JS 调用；S09 是事件分发索引的唯一 owner。 |
| CORE-S05-R15 | 所有结构修改必须先进入 transient `TreeMutation`；它只能引用一个 base Store generation，不能独立成为可查询的完整树，也不能跨事务长期存在。 |
| CORE-S05-R16 | staging 失败或上游事务失败必须丢弃 mutation，Store、索引、ownership 和计数完全不变；只有 S08 授权路径可原子 apply。含 Handler delta 的 mutation 必须先让 `EventBindingCommitParticipant` 完成无副作用 prepare，再在同一 Core turn 执行不可失败的联合 commit。 |
| CORE-S05-R17 | S05 不分配 `Revision`，不生成 `RenderTransaction`/`MountTransaction`，不计算 Layout；这些职责分别属于后续模块。 |
| CORE-S05-R18 | 缺少静态定义返回 `TEMPLATE_NOT_FOUND`；缺少 page owner 返回 `TARGET_NOT_FOUND`；`RemoveBlock/MoveBlock` 引用不存在或 stale BlockInstanceId 返回 `BLOCK_NOT_FOUND`；scope 错误返回 `ABI_INVALID_ARGUMENT`。 |
| CORE-S05-R19 | 必须限制 live nodes/blocks/structural handlers、单节点 children 和 lifetime Block tombstones；超限时原子返回 `OUT_OF_MEMORY`。 |
| CORE-S05-R20 | Surface teardown 必须清空 Store、索引、Block tombstone、结构 Handler ledger 并释放 `PageIrHandle`；资源计数归零。 |
| CORE-S05-R21 | 只有 Core Runtime Thread 可以读取用于决策并修改 Store；跨线程输入必须先经过 CORE-S01 ingress。 |
| CORE-S05-R22 | 必须提供 immutable Fake Page IR、确定 ID allocator、失败注入和结构快照测试工具，且不依赖 Loader、JS 或平台实现。 |

## 4. V1 资源上限

以下是 V1 Conformance 按单个 Surface 计算的固定上限，不得按平台改变：

| 项目 | 上限 |
|---|---:|
| live Runtime Nodes | 8192 |
| live Block instances | 2048 |
| live structurally-owned Handlers | 8192 |
| 单节点 children | 4096 |
| Surface 生命周期内 BlockInstanceId tombstones | 32768 |
| 单次 TreeMutation 结构操作 | 8192 |

初始静态实例化同样受限。任何计数加法必须 checked；超限不允许部分 apply。

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 唯一性 | 任意时刻只有 committed `RuntimeTreeStore` 是权威；Page IR、mutation 和 Host replica 都不是第二棵权威树。 |
| 确定性 | 相同 Page IR、ID 和操作顺序产生相同 LogicalRef、父子顺序、delta 或错误。 |
| 原子性 | stage 全成或全败；apply 全成或全败；rollback 不留下节点、索引、ownership 或计数变化。 |
| 内存 | mutation 只保存变更节点/边/索引 overlay，不复制完整 Store；所有容器有上限。 |
| 线程 | Store 单写者；不得在 Port 回调栈或其他线程直接改树。 |
| 可移植 | 数据结构不出现平台或具体执行引擎类型。 |
| 可测试 | 结构、Block、回滚和 ownership 可在无 Package/JS/UI 环境下确定验证。 |

## 6. 非目标

- 不做 VNode/new-old Shadow Tree Diff。
- 不解析模板表达式或执行 Binding VM。
- 不创建 Surface、不调度 JS、不生成帧或 Revision。
- 不计算 style cascade、Layout 或 Host Mount 操作。
- 不调用 Handler；不决定事件冒泡、捕获或回调结果。

## 7. 需求追踪

| 上级合同 | 本分 Spec |
|---|---|
| Runtime ABI / ID Contract | R03-R09、R18 |
| Page IR Contract | R02、R05-R13 |
| Runtime Tree / Render Contract | R01、R15-R17、R21 |
| Block Lifecycle Contract | R08-R14、R20 |
| Error/Observation/Foundation | R18-R22 |
