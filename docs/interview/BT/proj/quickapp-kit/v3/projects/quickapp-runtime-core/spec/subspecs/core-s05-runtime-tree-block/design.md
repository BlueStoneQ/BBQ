# CORE-S05 设计

## 目录

- [1. 结论](#1-结论)
- [2. 数据模型](#2-数据模型)
- [3. 唯一树与 Page IR](#3-唯一树与-page-ir)
- [4. 静态实例化](#4-静态实例化)
- [5. Block 生命周期](#5-block-生命周期)
- [6. TreeMutation staging](#6-treemutation-staging)
- [7. Handler ownership](#7-handler-ownership)
- [8. 提交边界](#8-提交边界)
- [9. 线程与所有权](#9-线程与所有权)
- [10. 错误与限制](#10-错误与限制)
- [11. 销毁与计数](#11-销毁与计数)
- [12. 边界不变量](#12-边界不变量)

## 1. 结论

采用“单一 committed Store + immutable Page IR + sparse mutation overlay”。Store 是唯一权威；mutation 只记录本次变更，成功后由 S08 原子 apply，失败直接销毁，因此不需要第二棵树和完整 Tree Diff。

## 2. 数据模型

概念模型：

```cpp
struct LogicalNodeRef final {
  OwnerInstanceId owner;       // ComponentInstanceId | BlockInstanceId
  TemplateNodeId templateNodeId;
};

struct RuntimeNode final {
  NodeId nodeId;
  LogicalNodeRef logicalRef;
  TemplateNodeId templateNodeId;
  HostComponentType component;
  Optional<NodeId> parent;
  OrderedNodeIds children;
  ImmutableStaticValues staticValues;
  DynamicValues dynamicValues;
  Optional<BlockInstanceId> owningBlock;
};

struct RuntimeTreeStore final {
  SurfaceId surfaceId;
  ComponentInstanceId pageOwner;
  PageIrHandle pageIr;
  NodeId root;
  NodeTable nodes;
  LogicalToNodeIndex logicalToNode;
  NodeToLogicalIndex nodeToLogical;
  BlockIndex blocks;
  HandlerOwnershipLedger handlers;
  BlockTombstones tombstones;
  StoreGeneration generation;
};
```

`StoreGeneration` 是 Core 内部 stale-mutation 防护，不是公共 `Revision`。Layout 结果不在 S05 计算；未来只可通过冻结扩展字段附着，不能让 Layout 建立第二个结构权威。

## 3. 唯一树与 Page IR

- Page IR 是 immutable 静态定义表，提供 TemplateNode/Block/Binding/Handler 查询。
- Runtime Tree 是动态实例结构，记录真实 NodeId、父子关系、owner 和动态值。
- Host Tree 由 Mount 结果维护，只是 Runtime Tree 的下游副本。
- S05 不复制完整 Page IR 到每个节点；节点保存必要 ID 和 runtime value，静态大对象通过 `PageIrHandle` 只读引用。
- 查询只能读取 committed Store。mutation 内临时节点不得通过普通 lookup 暴露。

## 4. 静态实例化

输入 `PageIrHandle + SurfaceId + pageOwner + InitialInstancePlan`，步骤固定：

1. 验证 Page IR root、page owner、初始 Block/Handler/Binding 引用和资源预算。
2. 创建空 `TreeMutation`，预留所需容量；不修改 Store。
3. 从 root 深度优先实例化 page scope 的静态节点；遇到 inactive Block slot 不展开其 subtree。
4. 按 parent-before-child 顺序实例化 initial active Blocks。
5. 建立 LogicalRef 双向索引和结构 Handler delta。
6. 校验 root 唯一、所有 parent/children、owner、slot、key 和目标存在。
7. 交给 S08 授权 apply；任一步失败销毁 mutation。

NodeId 按确定遍历顺序分配。allocator 只前进，rollback 不回退，以保证 Surface 生命周期内不复用。

## 5. Block 生命周期

```cpp
struct RuntimeBlock final {
  BlockInstanceId blockId;
  TemplateBlockId templateBlockId;
  OwnerInstanceId parentOwner;
  BlockSlotRef slot; // parent TemplateNodeId + TemplateBlockId
  BlockKey key;
  NodeId rootNodeId;
  OrderedBlockIds childBlocks;
};
```

### 5.1 Instantiate

- 验证 `BlockInstanceId` 未 live、未 tombstoned，parent owner live，TemplateBlock 和 slot 匹配。
- 相同 `(parentOwner, slot, key)` 已 live 时，只允许显式 keyed reuse，返回既有实例，不重新分配 NodeId。
- 新实例以自身 `BlockInstanceId` 作为内部节点 owner，递归创建静态后代。
- 嵌套动态 Block 只有在输入计划显式包含时才创建。

### 5.2 Remove

- 先在 mutation 中解析全部 descendant Blocks、Handlers、LogicalRefs 和 Runtime Nodes。
- handler remove delta 排在 node root remove 语义之前。
- apply 时原子删除索引与对象，并把每个 removed BlockInstanceId 加入 tombstone。
- Host 侧由后续 Mount 只删除该 Block 根；后代随根销毁。

### 5.3 Move

- 从原 children/slot 顺序移除后，再按 `final index` 插入。
- 同 parent reorder 保留所有 NodeId、BlockInstanceId 和 HandlerId。
- cross-parent 仅在同 Surface 且 Page IR 声明为同一合法 slot/ownership 关系时允许；否则拒绝。
- move 不改变 Block 内部 LogicalNodeRef owner。

## 6. TreeMutation staging

```cpp
class TreeMutation final {
  SurfaceId surfaceId;
  StoreGeneration baseGeneration;
  BoundedNewNodeArena newNodes;
  BoundedNodeRemovalSet removedNodes;
  BoundedParentChildEdits childEdits;
  BoundedValueEdits valueEdits;
  BoundedBlockEdits blockEdits;
  BoundedLogicalIndexOverlay logicalOverlay;
  BoundedHandlerDeltas handlerDeltas;
};
```

- mutation 是 move-only、单事务对象，不可复制，不可跨事务缓存。
- 读取遵循 overlay-first/base-second；只允许内部 stage validator 使用。
- 只保存变更项和新节点 arena，不复制未变节点或完整索引。
- 每个 stage API 先做参数、scope、预算和冲突校验，再追加 operation；失败后 mutation 进入 invalid，只能 discard。
- apply 前必须验证 `baseGeneration == store.generation`；不一致返回 Core 内部 `MutationApplyError::baseChanged`，不做 rebase，也不把 generation 伪装成公共 Revision。
- discard 释放新节点和值；已消耗 NodeId/BlockInstanceId 不复用，但 committed counters 不变。

S05 提供以下结构 primitive：

```text
stageInitialTree
stageInstantiateBlock
stageRemoveBlock
stageMoveBlock
resolveBindingTarget
resolveHandlerTarget
lookupCommittedNode/Block/LogicalRef
```

`updateBinding` 的事务编排属于 S06；S05 只提供目标解析和 value edit staging primitive。

## 7. Handler ownership

S05 长期只维护结构事实：

```text
OwnerInstanceId -> set<HandlerId>
HandlerId -> OwnerInstanceId
```

- Page IR 定义 handler target；实例 owner 解析出唯一 NodeId。
- add delta 临时携带 `(HandlerId, Owner, TemplateHandlerId, LogicalNodeRef, NodeId, EventType)`；remove delta 只需 `(HandlerId, Owner)`。完整目标不写入 S05 的长期 ledger。
- S09 实现 S05 冻结的内部 `EventBindingCommitParticipant`，建立并独占可分发 EventBinding、callback/module epoch 等状态；S08 只依赖该抽象接口。
- S05 不保存 JS function，不调用 callback，不处理捕获/冒泡。
- remove Block 时先产生所有 descendant handler remove deltas；S08 必须保证这些 delta 与结构 apply 属于同一提交结果。

内部参与者合同：

```cpp
class EventBindingCommitParticipant {
 public:
  virtual Result<PreparedHandlerCommit> prepare(
      const BoundedHandlerDeltas&) noexcept = 0;
  virtual void commit(PreparedHandlerCommit&&) noexcept = 0;
  virtual void abort(PreparedHandlerCommit&&) noexcept = 0;
};
```

- `prepare` 只验证冲突并预留容量，不修改 EventBinding 权威状态。
- `commit` 已经预留完成，必须无分配、无外部调用且不可失败。
- S08 在同一 Core Runtime Thread turn 内执行 handler removals、tree apply、handler additions 和 Revision commit；中间不处理输入事件，因此对外是一个原子提交。
- 任一 preflight/Layout/Measure 失败时调用 `abort` 并丢弃 TreeMutation，两套 committed 状态均不变。

因此不存在两套 Handler 权威：S05 权威回答“结构上谁拥有谁”，S09 权威回答“事件如何分发”。

## 8. 提交边界

- 普通调用方拿不到 Store 的 public commit API。
- S08 通过 Core 内部 `TreeCommitAuthority` 调用 `apply(TreeMutation&&)`。
- S08 先把 `TreeMutation + PreparedHandlerCommit` 组成 `PreparedTreeCommit`。apply 在 Core Runtime Thread 内执行，并且在开始前已完成两侧容量预留；不得执行外部 Port、I/O 或回调。
- apply 顺序：验证 generation -> 应用 removals/index -> moves/child edits -> additions/index -> values -> ownership ledger -> counters -> generation + 1。
- 实现必须提供内部 rollback guard；即使容器操作意外失败也恢复 base Store。正常路径通过预留保证 apply 无分配。
- S05 不产生公共 Revision；S08 在完整事务提交成功后按公共合同推进 Revision 和 Mount。

## 9. 线程与所有权

| 对象 | 所有者/写者 | 规则 |
|---|---|---|
| RuntimeTreeStore | Surface；Core Runtime Thread 唯一写 | 不跨线程共享可变引用 |
| PageIrHandle | Store 持有 immutable pin | teardown 最后释放 |
| TreeMutation | 当前 Core transaction | 单线程、move-only、短生命周期 |
| NodeId allocator | Surface Store | 单调、不回退 |
| Block tombstones | Surface Store | teardown 前不清除 |
| Handler ownership ledger | Surface Store | 只随 authorized apply 修改 |

平台线程和 JS 线程不能直接查询或修改 Store；需要结果时通过公共消息获得不可变 snapshot/ID，不暴露节点地址。

## 10. 错误与限制

| 场景 | 错误 | Store 结果 |
|---|---|---|
| TemplateNode/Binding/Handler/Block 定义不存在 | `TEMPLATE_NOT_FOUND` | 不变 |
| page owner 不存在 | `TARGET_NOT_FOUND` | 不变 |
| Block owner 缺失、已删除或 tombstoned | `BLOCK_NOT_FOUND` | 不变 |
| 新 BlockInstanceId 已 live 或已 tombstoned | `ABI_INVALID_ARGUMENT` | 不变 |
| HandlerId 重复注册或生命周期内复用 | participant 返回 `HANDLER_ALREADY_EXISTS` | 不变 |
| owner/scope/slot/cross-parent 非法 | `ABI_INVALID_ARGUMENT` | 不变 |
| Node/Block/Handler/operation 超限或分配失败 | `OUT_OF_MEMORY` | 不变 |
| base generation 已变化 | 内部 `MutationApplyError::baseChanged`；由 S08 按当前公共事务上下文处理 | 不变 |

错误解析必须基于 committed Store + 当前 mutation overlay，不能通过 Host Tree 猜测。任何失败都不发送 Mount，不更新公共 counter。

## 11. 销毁与计数

```text
stop accepting new tree intents
-> discard active TreeMutation / abort prepared handler commit
-> use EventBindingCommitParticipant to clear dispatch bindings
-> clear structural handler ledger
-> clear Blocks/tombstones/logical indexes/nodes
-> release PageIrHandle
-> destroy Store and allocators
```

- `runtimeNodeLive` 仅在 authorized apply 成功后按净变化更新。
- `handlerLive` 由 S09 的可分发绑定更新；S05 不重复更新公共 Handler counter。
- S05 提供 `liveNodes/liveBlocks/ownedHandlers/tombstones/mutationOps` 的测试快照。
- teardown 后上述值和 active mutations 均为零；Surface 总计数由 Surface owner 模块负责。

## 12. 边界不变量

1. 每个 Surface 只有一个 committed Runtime Tree。
2. Page IR 是静态定义，TreeMutation 是短期 delta，二者都不是第二棵权威树。
3. S05 不读取 ZIP、JSON、Bundle，不调用 Loader parser。
4. S05 不执行 JS，不持有 callback，不访问 Host Tree。
5. S05 不生成 Revision、Layout、MountTransaction 或 EventResult。
6. S02 与 S05 只通过 immutable `PageIrHandle` 和公共 ID/Schema 连接。
