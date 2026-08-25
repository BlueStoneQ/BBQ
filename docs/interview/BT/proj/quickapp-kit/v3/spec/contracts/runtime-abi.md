# Runtime ABI Contract

## 目录

- [1. 结论](#1-结论)
- [2. V1 入口](#2-v1-入口)
- [3. 同步与异步结果](#3-同步与异步结果)
- [4. 回调](#4-回调)
- [5. 数据边界](#5-数据边界)
- [6. 机器合同](#6-机器合同)

## 1. 结论

Runtime ABI 是 JS Framework 与 C++ Core 的唯一调用边界；External Function 只是 QuickJS 的绑定方式，业务语义由强类型消息定义。

## 2. V1 入口

```text
instantiateTemplate(InstantiateTemplate)
completeVerifiedModuleLoad(LoadVerifiedModuleResult)
completeVmInitialization(VmInitializationResult)
submitRenderTransaction(RenderTransaction)
registerHandler(RegisterHandler)
unregisterHandler(UnregisterHandler)
pushRoute(NavigationPush)
closeRoute(NavigationClose)
showToast(ShowToast)
getDeviceInfo(DeviceGetInfo)
system.openUrl.open(FeatureRequest(url))
system.webview.open(FeatureRequest(url))
setTitleBar(SetTitleBar)
setMeta(SetMeta)
supportsCapability(moduleName, methodName) -> boolean
completeLifecycle(LifecycleResult)
```

`pushRoute/closeRoute/showToast/getDeviceInfo` 以及 `system.openUrl.open/system.webview.open` 是 [Capability Module Contract](./capability-module-contract.md) 的强类型方法入口。`supportsCapability` 固定计算“Manifest 已声明 AND Registry descriptor 已提供该方法”，查询不创建 Provider、不传递业务参数，也不构成通用 Bridge；`system.fetch.fetch` 在 V1 固定为 false。

`InstantiateTemplate` 首屏载荷包含：

```text
initialBindings   静态模板节点的初始 Binding 值
initialBlocks     按父先于子的顺序给出初始动态 Block 实例
initialHandlers   OwnerInstanceId + TemplateHandlerId + 绑定级 HandlerId
```

`initialBindings` 是以十进制字符串编码的 `TemplateBindingId -> evaluator 初始结果` 映射，不是组件完整 state；对象键必须匹配 `^[1-9][0-9]*$`。每个 initial Block 还携带自身 `initialBindings/handlers`。Handler 只携带 Owner、TemplateHandlerId 和 HandlerId。Core 通过 Page IR 解析 Binding/Handler target，并把静态树、初始 Block、初始值和 Handler 原子提交后再产生首个 full Mount。

V1 initial Binding value 只允许 string/boolean。顶层 initial Binding/Handler 隐式属于 `InstantiateTemplate.ownerInstanceId`；Handler owner 必须与它相等。Block 内 Handler owner 必须与所在 `blockInstanceId` 相等。完整 scope、顺序和错误映射遵循 Render Contract。

增量 `UpdateBinding` 同样只携带 `ownerInstanceId + templateBindingId + value`；`RegisterHandler` 只携带 `ownerInstanceId + templateHandlerId + handlerId`。JS ABI 不传递 property、eventType 或 target descriptor。

## 3. 同步与异步结果

```ts
type EnqueueResult =
  | { ok: true }
  | { ok: false; error: RuntimeError }
```

ABI 入口只同步完成版本、字段和队列接收校验。`ok: true` 仅表示 immutable message 已进入 Core 队列，不表示 Runtime Tree、Platform 或页面栈已经执行成功。

排队后的操作必须产生对应异步 Result；Surface 销毁后的关联消息返回 `SURFACE_NOT_FOUND`。

## 4. 回调

Core 向 JS Framework 注入：

```text
onLoadVerifiedModule(LoadVerifiedModule)
onAppContext(AppContext)
onSurfaceContext(SurfaceContext)
onVmInitializationDispatch(VmInitializationDispatch)
onLifecycleDispatch(LifecycleDispatch)
onJsEventDispatch(JsEventDispatch)
onInstantiateTemplateResult(InstantiateTemplateResult)
onHandlerRegistrationResult(HandlerRegistrationResult)
onRenderTransactionResult(RenderTransactionResult)
onNavigationPushResult(NavigationPushResult)
onNavigationCloseResult(NavigationCloseResult)
onShowToastResult(ShowToastResult)
onDeviceGetInfoResult(DeviceGetInfoResult)
onSetTitleBarResult(SetTitleBarResult)
onSetMetaResult(SetMetaResult)
onSurfaceStatusChanged(SurfaceStatusChanged)
```

`onLoadVerifiedModule -> completeVerifiedModuleLoad` 是 Module Loader 异步闭环；`onVmInitializationDispatch -> completeVmInitialization` 是本地 `onCreate/onInit/initialEvaluation/onReady` 异步闭环；`onLifecycleDispatch -> completeLifecycle` 是可见性与销毁 Hook 异步闭环。三者都只投递队列，Core Runtime Thread 不同步执行或等待 QuickJS。Runtime Host 前后台和销毁入口属于 Lifecycle Host Control，不得伪装成 JS External Function。

`onSurfaceStatusChanged` 只在首棵树已经提交后投递，`committedRevision=0` 表示首提交；首提交前不使用 `0` 伪造 Revision，也不投递 nullable Revision。

每个 Result 的成功和失败使用同一个 `kind` 和同一个回调，仅由 `status` 判别。`MountTransactionResult` 是 Platform -> Core 合同，JS 不直接控制 Mount。

## 5. 数据边界

JS 到 Core 的消息在入队时复制或转移；Core 到 JS 的回调同样交付 immutable value。ABI 禁止函数指针、`NativeHandle`、平台对象和可变共享内存。

Bundle 是唯一大块数据例外：Core 通过 VerifiedModulePort 转移或共享 immutable byte storage，JS 只读；它仍禁止可变共享，不经过 JSON 文本，也不经过 Platform Bridge。

`RuntimeError` 的可选关联字段统一为 `surfaceId`、`requestId`、`transactionId`、`mountAttemptId`；未在公共 Schema 声明的关联字段不得出现。

首屏 `InstantiateTemplateResult(status=presented)` 只在 full Mount 和首次 Platform Present 都成功、且 Core 已提交可见状态后回调。Mount 成功但 Present 未完成不产生成功 Result。

## 6. 机器合同

- JS -> Core Instantiate/Handler：[runtime-abi.schema.json](./schemas/runtime-abi.schema.json)。
- Core -> JS Verified Module：[module-load.schema.json](./schemas/module-load.schema.json)。
- Lifecycle 与 Host Control：[lifecycle.schema.json](./schemas/lifecycle.schema.json)。
- 其余 request/result 使用各自公共 Schema；不存在通用 ABI envelope。
