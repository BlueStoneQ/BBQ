# Event Contract

## 目录

- [1. 结论](#1-结论)
- [2. PlatformInputMessage](#2-platforminputmessage)
- [3. 注册与解绑](#3-注册与解绑)
- [4. Handler 映射](#4-handler-映射)

## 1. 结论

Platform 只产生标准输入消息，C++ 负责路由，JS 负责执行 Handler。

```text
PlatformInputMessage -> C++ Event Router -> JsEventDispatch -> HandlerId -> JS Function
```

## 2. PlatformInputMessage

最小字段：

```text
kind = platformInput
requestId / surfaceId / nodeId / eventType / timestamp / payload
```

`payload` 必须是可序列化 typed 数据，不携带 JNI、UIKit、LVGL 指针。

`requestId` 标识一次 Platform 输入，由捕获该输入的 Platform Adapter 生成，在同一 AppRuntime 生命周期内不复用。Core 必须把它原样复制到该输入产生的每个 `JsEventDispatch`；目标 Handler 与冒泡 Handler 共享同一个 `requestId`，不得为每个 Handler 重新分配。

Platform 不产生 `phase`。C++ 从目标 `NodeId` 沿 Runtime Tree 建立冒泡路径，并在 Core 内把每个 Runtime Node 反向解析为 `LogicalNodeRef`。发给 JS 的 `JsEventDispatch.target` 固定为原始逻辑目标，`currentTarget` 表示当前 Handler 的逻辑节点，`phase` 由 Core 标记为 `target` 或 `bubble`。Runtime `NodeId` 不跨越 Core -> JS 边界。

JS 执行 Handler 时保留该 `requestId` 作为当前同步事件因果上下文。V1 Handler 返回后触发的状态 flush、RenderTransaction 和对应 Trace 必须继续携带该 `requestId`；Handler 未触发更新时不得伪造 Render 链路。异步任务不自动继承该上下文。

## 3. 注册与解绑

```ts
type RegisterHandler = {
  requestId: string
  surfaceId: string
  ownerInstanceId: ComponentInstanceId | BlockInstanceId
  templateHandlerId: TemplateHandlerId
  handlerId: string
}

type UnregisterHandler = {
  requestId: string
  surfaceId: string
  handlerId: string
}
```

HandlerId 是一次 EventBinding 的身份，在 Surface 生命周期内唯一且不复用。同一 JS 函数绑定到多个节点时，JS 为每条绑定生成不同 HandlerId，并在 JS Handler Registry 中让它们指向同一函数对象。

Core 根据 `ownerInstanceId + templateHandlerId` 从 Page IR 解析 `LogicalNodeRef + eventType`，再解析 `NodeId`。JS 不复制或提交 Handler target descriptor；Owner 与 Page IR scope 不匹配时返回 `ABI_INVALID_ARGUMENT`。

注册成功后 Core 同时保存：

```text
(NodeId, EventType) -> HandlerId
HandlerId -> (NodeId, EventType)
```

`UnregisterHandler(surfaceId, handlerId)` 只删除该 HandlerId 对应的一条绑定；不存在时返回 `HANDLER_NOT_FOUND`。重复注册同一 HandlerId 返回 `HANDLER_ALREADY_EXISTS`，不得覆盖旧绑定。C++ 不保存 JS 函数。

JS Handler Registry 的绑定状态固定为：

```text
live -> retiring -> released
          \-> live   # 对应 Core 操作未提交
```

页面实例创建后 Handler 为 live。JS 提交显式 Unregister 或包含 `RemoveBlock` 的 RenderTransaction 时，受影响 Handler 只进入 retiring，仍保留函数引用；不得提前永久删除。HandlerId 即使最终释放也不得在同一 Surface 复用。

提交结果决定状态：

| Core 结果 | JS Handler 状态 |
|---|---|
| Unregister `unregistered` | retiring -> released |
| Unregister `failed` | retiring -> live |
| Render `presented` | 被删除 Block 的 retiring -> released |
| Render `presentationFailed` | Core 已提交删除，retiring -> released |
| Render `rejected/cancelled` | Core 未提交删除，retiring -> live |

retiring 期间收到的 `JsEventDispatch` 是 Core 在删除提交前已合法路由的旧输入，仍执行一次；released 后到达的消息丢弃并记录 late-event Trace。这样 JS Registry 与 Core EventBinding 在成功、拒绝和提交后展示失败三条路径上都保持一致。

`removeBlock` 在 Core 队列中原子执行：先删除块内全部 EventBinding，再销毁节点。Event 在真正分发前重新检查 NodeId 和 HandlerId；删除后仍在途的 Event 直接丢弃并记录，不调用旧 Handler。

Surface teardown 是不可回滚路径：Core 先拒绝该 Surface 新输入并发送 `onDestroy`，JS 随后强制释放全部 Handler；它不经过 retiring 回滚。HandlerRegistrationResult 和 RenderTransactionResult 是状态迁移的唯一确认，不增加私有确认消息。

## 4. Handler 映射

```text
OwnerInstanceId + TemplateHandlerId
  -> Core Page IR 解析 TemplateNodeId + EventType
  -> LogicalNodeRef -> NodeId
  -> JS 为该绑定分配的 HandlerId
  -> C++ EventBinding(NodeId, EventType, HandlerId)
```

V1 先实现 `click`、目标节点校验和基础冒泡；捕获、默认行为和手势属于后续扩展。Handler 执行通过 JS 队列异步进入 JS Executor；Handler 抛异常只生成错误结果，不得使 Runtime 崩溃。Handler 内触发的状态更新在本次 Handler 返回后统一 flush，形成新的 `RenderTransaction`。
