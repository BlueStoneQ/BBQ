# Block Lifecycle Contract

## 目录

- [结论](#结论)
- [实例规则](#实例规则)
- [V1 操作](#v1-操作)

## 结论

动态结构由 JS Framework 决定 Block 的实例变化，C++ 根据 Block IR 实例化块内 Runtime 节点；Block 内节点不单独由 JS 创建。

## 实例规则

```text
TemplateBlockId + parent OwnerInstanceId + key
  -> BlockInstanceId
  -> BlockInstanceId 成为块内节点 Owner
  -> LogicalNodeRef(BlockInstanceId, block-local TemplateNodeId)
  -> NodeId
```

同一 Owner 下，keyed `for` 的稳定 key 复用原 `BlockInstanceId`；新 key 创建新实例；消失的 key 先解绑事件，再级联销毁其 Runtime 节点。BlockInstanceId 在同一 Surface 生命周期内不得复用。

## V1 操作

```text
false -> true       InstantiateBlock(parent, index, key)
true -> false       RemoveBlock(blockInstanceId)
key A -> key B      RemoveBlock(A) + InstantiateBlock(B)
同 key 位置变化      保留 BlockInstanceId，更新父子顺序
```

V1 必须覆盖 `if`、基础 keyed `for` 的增、删、移动和销毁；未提供 key 的列表行为由 Toolkit 诊断为受限语义，不得静默承诺稳定复用。

`MoveBlock` 在 Core 中移动该 BlockInstance 的 Runtime 子树根，并生成显式 `MoveHost`。Block 的 `index` 与 Mount 的 `MoveHost.index` 都表示移除旧位置后的最终索引；跨父移动允许，但目标必须是同一 Surface 内 Page IR 声明的合法 Block slot。

`RemoveBlock` 先原子删除块内 EventBinding，再从 Runtime Tree 递归删除该实例的全部节点；Mount 只为 Block 根生成 `RemoveHost`，Platform 按 Render Contract 递归清理整棵 Host 子树和 NativeHandle 映射。
