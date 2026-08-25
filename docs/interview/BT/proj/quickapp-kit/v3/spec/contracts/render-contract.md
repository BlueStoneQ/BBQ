# Render Contract

## 目录

- [结论](#结论)
- [RenderTransaction](#rendertransaction)
- [V1 最小操作集合](#v1-最小操作集合)
- [Binding 与 Handler 寻址](#binding-与-handler-寻址)
- [MountTransaction](#mounttransaction)
- [V1 规则](#v1-规则)
- [Revision 状态机](#revision-状态机)

## 结论

JS 向 C++ 提交增量 `RenderTransaction`；C++ 应用到唯一 Runtime Tree，再向 Platform 提交 `MountTransaction`。

## RenderTransaction

## V1 最小操作集合

```text
InstantiateTemplate
InstantiateBlock
RemoveBlock
MoveBlock
UpdateBinding(OwnerInstanceId, TemplateBindingId, value)
```

`InstantiateTemplate` 是首屏调用，不作为普通更新操作混入页面更新事务。Toolkit V1 ABI 与本合同统一使用 `updateBinding`、`instantiateBlock`、`removeBlock`、`moveBlock` 四个增量操作。

```ts
type UpdateBinding = {
  kind: 'updateBinding'
  ownerInstanceId: ComponentInstanceId | BlockInstanceId
  templateBindingId: TemplateBindingId
  value: string | boolean | number
}
```

动态块操作字段：

```ts
type InstantiateBlock = {
  kind: 'instantiateBlock'
  templateBlockId: number
  blockInstanceId: string
  parent: LogicalNodeRef
  index: number
  key?: string | number
  initialBindings: Record<TemplateBindingId, string | boolean | number>
  handlers: Array<HandlerBinding>
}

type RemoveBlock = {
  kind: 'removeBlock'
  blockInstanceId: string
}

type MoveBlock = {
  kind: 'moveBlock'
  blockInstanceId: string
  parent: LogicalNodeRef
  index: number
}
```

`templateBlockId` 指向静态 Block IR；`blockInstanceId` 标识一次运行时 Block 实例。C++ 根据 Block IR 的 `templateRoot` 创建块内 Runtime 节点，不要求 JS 逐节点提交创建操作。`initialBindings` 给出该实例的初始动态 prop，`handlers` 给出块内绑定级 HandlerId；二者与节点创建在 Core 中原子提交，避免可见但数据或事件尚未就绪的 Block。

## Binding 与 Handler 寻址

JS 不提交 Binding 的 `LogicalNodeRef/property`，也不提交 Handler 的 `LogicalNodeRef/eventType`。JS 只提交运行时 Owner 与 Toolkit 定义 ID：

```ts
type HandlerBinding = {
  ownerInstanceId: ComponentInstanceId | BlockInstanceId
  templateHandlerId: TemplateHandlerId
  handlerId: HandlerId
}
```

Core 使用已验证 Page IR 解析：

```text
OwnerInstanceId + TemplateBindingId
  -> validate binding scope against owner
  -> Page IR binding target(templateNodeId, property)
  -> LogicalNodeRef(owner, templateNodeId)
  -> NodeId + Runtime prop

OwnerInstanceId + TemplateHandlerId
  -> validate handler scope against owner
  -> Page IR handler target(templateNodeId, eventType)
  -> LogicalNodeRef(owner, templateNodeId)
  -> NodeId + EventBinding
```

Page scope 只接受该 Surface 的 `ComponentInstanceId`；Block scope 只接受仍存活且对应同一 `TemplateBlockId` 的 `BlockInstanceId`。定义不存在、scope 不匹配或 Owner 已失效时拒绝整笔事务。Toolkit 不在 JS Bundle 中复制 target descriptor。

初始载荷规则固定如下：

1. `InstantiateTemplate.ownerInstanceId` 是该 Surface 唯一 Page `ComponentInstanceId`；顶层 initial Binding key 只允许 Page-scope 定义。
2. 顶层 `initialHandlers[].ownerInstanceId` 必须等于 Page owner，且 TemplateHandlerId 必须是 Page scope。
3. 每个 `InstantiateBlock.handlers[].ownerInstanceId` 必须等于该操作的 `blockInstanceId`；initial Binding/Handler 必须属于该 `templateBlockId` scope。
4. initial Block 按父先子顺序处理；父 Owner 尚未创建时拒绝整笔首屏。
5. V1 Binding value 只允许 string/boolean。Toolkit 按 Host target 在 evaluator 中完成类型 Lowering，JS 与 Core 不二次猜测。

错误映射只有一套：缺少 template/template Binding/template Handler/template Block 定义返回 `TEMPLATE_NOT_FOUND`；Page Owner 不存在返回 `TARGET_NOT_FOUND`；Block Owner 不存在或已失效返回 `BLOCK_NOT_FOUND`；Owner 存活但 scope/templateBlock 不匹配返回 `ABI_INVALID_ARGUMENT`。

消息必须包含：`surfaceId`、`revision`、`transactionId`、有序 operations。事务允许包含不同 Owner 的目标，因此顶层不重复携带 `ownerInstanceId`。

`requestId` 是可选因果字段：V1 Handler 同步状态 flush 产生的 `RenderTransaction` 必须携带触发该 Handler 的输入 `RequestId`；普通非事件更新和 Handler 返回后的异步 continuation 必须省略。Core 原样复制该值到相关 Render Observation marker，并使用 `transactionId` 继续关联 Mount；Platform Mount 不解释输入因果。

## MountTransaction

由 C++ 根据 Runtime Tree 的新状态生成：

```text
CreateHost(NodeId, type)
SetHostProp(NodeId, property, value)
SetHostLayout(NodeId, rect)
InsertHostChild(NodeId, parentNodeId, index)
MoveHost(NodeId, newParentNodeId, index)
RemoveHost(NodeId)
```

Platform 不解释 JS Binding、Template IR 或业务状态。

Host 树操作使用唯一语义：

1. `InsertHostChild` 只挂接本事务中尚未挂载的新节点；目标已挂载时返回 `PLATFORM_REJECTED`，不得隐式移动。
2. `MoveHost` 移动已有节点及其完整子树，允许同父或跨父移动；`NodeId -> NativeHandle` 和全部后代 NativeHandle 保持不变。
3. `MoveHost.index` 是先从旧父节点移除后，在目标父节点最终 children 序列中的索引。例如 `[A,B,C]` 执行 `MoveHost(A,parent,2)` 后为 `[B,C,A]`。
4. `MoveHost` 不允许形成环，目标 parent 和 index 必须在事务应用时有效。
5. `RemoveHost` 从父节点解绑并递归销毁整棵子树，清理每个后代的 `NodeId -> NativeHandle`；同一事务不得再单独删除或操作其后代。
6. full Mount 只允许 Create/Set/Insert；Move/Remove 只出现在 incremental Mount。

任一 Host 操作失败都使整笔 Mount 失败并进入既有 degraded 恢复流程；Platform 不得跳过单个失败操作后继续返回 mounted。

`MountTransaction.mode` 为 `incremental` 或 `full`。`full` 只用于首次挂载或 degraded 恢复；Platform 必须先清空该 Surface 的 Host Tree 和 `NodeId -> NativeHandle` 映射，再按有序 operations 重建。Layout 统一使用数值型 `logical-px`，由 Platform 映射到本地坐标。

## V1 规则

不做完整新旧树 Diff；C++ 做定义/Owner/目标解析、顺序校验、父子关系校验和 Revision 校验。

同一 `SurfaceId` 内，Transaction 按 `revision` 严格递增处理。过期事务拒绝且不修改 Runtime Tree；目标不存在、父节点不匹配或 Block 已失效时拒绝整笔事务并返回结构化错误。

## Revision 状态机

```text
InstantiateTemplate 成功 -> committedRevision = 0
JS 提交 revision = committedRevision + 1
Core 校验失败 -> rejected，Revision 不消耗
Core 原子应用成功 -> 内部 commit，committedRevision 前进
Platform Mount 成功 -> mounted
Platform Mount 失败 -> Core Revision 不回滚，Surface 进入 degraded
```

V1 同一 Surface 只允许一个在途渲染周期。JS 在收到 `RenderTransactionResult(status=presented)` 前继续合并 Dirty Binding，但不提交下一 Revision，从而避免 Core/Mount 失败后的分叉。

```ts
type RenderTransactionResult = {
  kind: 'renderTransactionResult'
  surfaceId: string
  transactionId: string
  submittedRevision: number
  committedRevision: number
  status: 'presented' | 'rejected' | 'cancelled' | 'presentationFailed'
  error?: RuntimeError
}

type MountTransactionResult = {
  kind: 'mountTransactionResult'
  surfaceId: string
  mountAttemptId: string
  sourceId: string
  revision: number
  status: 'mounted' | 'failed'
  recovery: 'none' | 'rebuildSurface' | 'recreateSurface'
  error?: RuntimeError
}
```

`presented`/`mounted` 不携带 error；其他状态必须携带 error。首次 Mount 失败返回 `recovery=rebuildSurface`；自动 full rebuild 再失败返回终态 `recovery=recreateSurface`。

Core 先在事务暂存区应用操作并完成 Style/Layout/Measure；校验或测量失败时丢弃暂存区，已提交 Runtime Tree 和 Revision 不变。Layout 成功后，Core 才原子提交 Runtime Tree 和 Revision，并产生 MountTransaction。该暂存区是操作日志或 copy-on-write 变更集，不是第二棵长期权威树。JS 只有在该 Mount 成功并收到 `RenderTransactionResult(status=presented)` 后才能提交下一 Revision。

包含 `RemoveBlock` 的事务还控制 JS Handler retirement：`presented/presentationFailed` 表示 Core 删除已提交，JS 永久释放 retiring Handler；`rejected/cancelled` 表示删除未提交，JS 恢复 live。不得把“Render 已入队”当成 EventBinding 已删除。

每次 Mount 尝试使用新的 `mountAttemptId`，并用 `sourceId` 关联原 `RenderTransaction.transactionId` 或 `InstantiateTemplate.requestId`。Mount 失败时不回滚 Runtime Tree；Core 标记 Surface degraded，拒绝新 Render，并从权威 Runtime Tree 生成一次 `mode: full` 的 MountTransaction。Platform 收到 full 模式后先清空该 Surface 的 Host Tree，再按操作重建。

V1 每个失败周期最多自动 full rebuild 一次。更新重建成功后返回 presented，并恢复 `healthState=normal`；首屏 Mount 或重建成功后还必须完成首次 Platform Present，才能返回 `InstantiateTemplateResult(status=presented)`。再次 Mount 失败则 Surface 进入 `healthState=failed`，销毁 Host Tree，必须由 Runtime Host 创建新 Surface。终态失败若源自普通更新，Core 返回 `RenderTransactionResult(status=presentationFailed, error=SURFACE_FAILED)`；若源自首屏，返回 `InstantiateTemplateResult(status=failed, error=SURFACE_FAILED)`。Runtime Tree 的 committed Revision 不回滚，但 failed Surface 不再接受消息。

由于 V1 同一 Surface 只有一个在途渲染周期，不会存在更新 Revision 的 incremental Mount 排在失败 Mount 之后。
