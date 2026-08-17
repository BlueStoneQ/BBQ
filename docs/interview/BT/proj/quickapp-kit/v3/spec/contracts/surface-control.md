# Surface Control Contract

## 目录

- [1. 结论](#1-结论)
- [2. SurfaceContext](#2-surfacecontext)
- [3. 创建](#3-创建)
- [4. 首屏](#4-首屏)
- [5. 结果顺序](#5-结果顺序)
- [6. Handler](#6-handler)
- [7. 销毁](#7-销毁)

## 1. 结论

Root Surface 由 Runtime Host 发起，Navigation target 由 Core Navigation Controller 内部创建；C++ Core 分配 `SurfaceId`，JS Framework 只在收到 `SurfaceContext` 后创建页面组件并提交首屏。对上层而言，Surface 创建成功的唯一语义是“首屏已经展示”，不是“容器已经分配”。

每种操作的 Result 都是同一 `kind` 下的 success/failure 判别联合，不使用通用失败消息。

## 2. SurfaceContext

```ts
type SurfaceContext = {
  schemaVersion: 1
  kind: 'surfaceContext'
  surfaceId: SurfaceId
  packageId: string
  route: string
  templateId: string
  params: Record<string, RuntimeValue>
  hostCapabilities: Array<'setTitleBar' | 'setMeta'>
  viewport: { width: number; height: number; unit: 'logical-px' }
}
```

Core 完成 Manifest route 解析和 Page IR 定位后，通过 `onSurfaceContext` 将该消息交给 JS。`params` 是 Host 启动参数或 NavigationPush 参数；没有参数时固定为空对象。`hostCapabilities` 只表示当前 Surface 的 Page Host Control；Capability Module 由 ModuleRegistry 独立发现。`ComponentInstanceId` 仍由 JS 在创建页面组件实例时生成，不属于 SurfaceContext。

## 3. 创建

```text
Runtime Host
  -> CreateSurfaceRequest(requestId, packageId, route, params, viewport)
  -> C++ Runtime Controller 分配 SurfaceId
  -> 加载 Manifest / Page IR
  -> Platform CreateSurfaceHost(hidden-empty)
  -> CreateSurfaceHostResult(created)
  -> onSurfaceContext(SurfaceContext)
  -> 等待首屏完整链路
  -> CreateSurfaceResult(presented | failed)
```

公开 `CreateSurfaceRequest/Result` 只用于 Runtime Host 创建 Root Surface。Navigation target 复用内部创建状态机，但只向原调用方返回 `NavigationPushResult`。`SurfaceContext` 是驱动 JS 首屏的中间消息，不表示 Create 成功；route、Host 创建、首屏 Mount 或首次 Present 任一步失败，最终 Create 都必须失败。

## 4. 首屏

`InstantiateTemplate` 必须携带 `requestId`、`surfaceId`、`templateId`、`ownerInstanceId`、初始 Binding、初始 Block 和静态节点 Handler。Core 异步加载 Page IR，原子创建完整首屏 Runtime Tree 和 EventBinding，再产生 full Mount。

Root 首屏唯一状态机：

```text
creating
  -> Platform CreateSurfaceHost(hidden-empty)
awaitingTemplate
  -> SurfaceContext -> JS InstantiateTemplate
mounting
  -> Core 原子创建 Runtime Tree/EventBinding
  -> full Mount(hidden)
presenting
  -> Platform PresentSurfaceHost(mode=root)
visible
  -> InstantiateTemplateResult(status=presented, committedRevision=0)
  -> CreateSurfaceResult(status=presented)
```

full Mount 成功只进入 `presenting`，不得提前返回成功。Root Present 成功后，Core 原子提交 Root 栈和 visible 状态，再发布上层成功结果。

`SurfaceStatusChanged` 将两个正交维度分开：`lifecycleState=creating|awaitingTemplate|mounting|presenting|visible|hidden|destroying|destroyed`，`healthState=normal|degraded|failed`。`visible/hidden` 是可见性；`degraded/failed` 只描述健康度，不再使用含义混合的 `ready` 状态。

`[已冻结] CORE-S04-REV-001`：`SurfaceStatusChanged` 只在首棵 Runtime Tree 已提交、`committedRevision` 已存在后发送。`creating/awaitingTemplate/mounting` 阶段不发送该回调；首个可发送状态是 revision `0` 的 `presenting`，之后每条状态携带当前已提交 Revision。未完成首提交即失败或销毁的 Surface 不发送该回调。Schema 保持非 nullable，`0` 永远只表示已提交的首个 Revision。

Mount 终态失败或 Root Present 失败时，Surface 进入 `failed`，分别返回原 Mount error 或 `SURFACE_PRESENTATION_FAILED`；Core 向 JS 返回 `InstantiateTemplateResult(status=failed)`，销毁隐藏 Host 与 JS Page Context，再向 Runtime Host 返回 `CreateSurfaceResult(status=failed)`。失败 Surface 不允许停留为可复用的 hidden-mounted 状态。

## 5. 结果顺序

Root/Push 首屏都遵循：Platform Present 成功 -> Core 提交权威可见状态和 Navigation 栈 -> 才产生上层成功结果。`InstantiateTemplateResult(status=presented)` 因而同时表示 Runtime Tree 已提交、full Mount 已成功且目标 Surface 已展示。

Core 到 JS 与 Runtime Host 可以使用不同队列，不规定两个接收方之间的回调先后；但每条回调入队前，Core 状态必须已经提交。Present 失败时必须先向仍存活的 JS Context 交付 Instantiate failure，再释放该 Context。

## 6. Handler

Register/Unregister Handler 都携带 `requestId`。`HandlerRegistrationResult` 固定携带 `operation`，并以 `registered | unregistered | failed` 表达完整结果。注册目标不存在、Surface 已销毁或 Handler 重复时必须失败。

RenderTransaction 删除 Block 时不额外发送 Unregister；Core 在候选事务提交时原子删除块内 EventBinding。JS Handler 的 retiring/回滚规则遵循 Event Contract。

## 7. 销毁

```text
DestroySurfaceRequest
  -> stop accepting messages
  -> dispatch Page onHide(if visible) / onDestroy
  -> cancel pending operations and release JS Page VM
  -> remove EventBinding
  -> Platform DestroySurfaceHost
  -> release Runtime Tree / Core PageContext
  -> DestroySurfaceResult(destroyed | failed)
```

`DestroySurface` 用于未提交/失败 Surface 清理和 `destroyAppRuntime` 整栈 teardown；已经提交到 Navigation 栈的可见非 Root 栈顶必须走 `NavigationClose`，不得绕过 Navigation Controller 直接销毁。整栈 teardown 按栈顶到 Root 顺序销毁，不恢复中间页面可见性。

visible、hidden、degraded 或 failed Surface 均可进入 Destroy，不要求先 SetVisibility(hidden)。Platform 对 visible Host 的 Destroy 必须原子移出显示层并递归销毁。Destroy 完成后 lifecycleState 为 `destroyed`。Platform destroy 失败时 Core 仍 tombstone 逻辑 Surface，并向 Runtime Host 返回失败；所有晚到消息返回 `SURFACE_NOT_FOUND`，不得复活 Surface。

机器合同：[surface-control.schema.json](./schemas/surface-control.schema.json)。
