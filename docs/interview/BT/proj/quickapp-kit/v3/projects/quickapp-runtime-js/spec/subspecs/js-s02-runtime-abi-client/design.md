# JS-S02 Runtime ABI Client：设计

## 目录

- [1. 结论](#1-结论)
- [2. 组件与边界](#2-组件与边界)
- [3. ABI 版本](#3-abi-版本)
- [4. 消息与字段](#4-消息与字段)
- [5. Native Function Catalog](#5-native-function-catalog)
- [6. 双向准入流程](#6-双向准入流程)
- [7. Result 关联](#7-result-关联)
- [8. 状态机](#8-状态机)
- [9. 线程与所有权](#9-线程与所有权)
- [10. 销毁](#10-销毁)
- [11. 错误与观测](#11-错误与观测)
- [12. 非本任务设计](#12-非本任务设计)

## 1. 结论

JS-S02 采用 **双 Gateway + closed typed union + bounded correlation registry**：

```text
JS Framework
  -> AppRuntime JsRequestIdAllocator.next() for JS-origin request
  -> request module builds complete typed message
  -> per-operation Native Function Binding
  -> RuntimeAbiClient: decode + validate + correlate
  -> CoreIngressPort.post(typed message)

Core Runtime Thread
  -> RuntimeAbiCallbacks.post(typed callback)
  -> JS Executor queue
  -> validate correlation + typed consumer
```

External Function trampoline、raw engine arguments 和 raw engine return 仍完全封装在 JS-S01 QuickJS Provider；JS-S02 只看到 `NativeCallView`、`RuntimeValue` 和 `JsEnginePort`。

## 2. 组件与边界

| 组件 | 拥有 | 不拥有 |
|---|---|---|
| `RuntimeAbiService` | ABI state、binding tokens、client/callback gateway、bridge correlation registry、immutable capability support snapshot | Engine/Context、Core 状态、业务 VM、RequestId allocator、业务 completion |
| `JsRequestIdAllocator`（S02 外部依赖） | JS Framework bootstrap 为每个 AppRuntime 创建的唯一 JS-origin 序列；所有请求模块在 JS Executor 共享 | RuntimeAbiService/S02、C++ 服务、Native Function、bridge correlation、业务 completion |
| `RuntimeAbiClient` | JS -> Core typed decode、admission、EnqueueResult encode | Core queue、业务结果、Promise |
| `RuntimeAbiCallbacks` | Core -> JS typed admission、Executor post、result correlation | Core producer thread、业务 handler |
| `NativeEntryCatalog` | 固定 binding name、argc、message type、result policy | QuickJS trampoline、动态方法发现 |
| `PendingRegistry` | correlation key、expected result kind、owner scope/generation | completionToken、Promise/callback、Render snapshot、业务对象或 JS Value |
| `CallbackSlots` | 编译期固定的 typed consumer registration；接收完整 typed Result/dispatch | Module/VM/Render/Event 的业务状态与完成动作 |

跨项目 Port 使用 Core Foundation 冻结的异步语义：成功 `post` 转移消息所有权；失败时调用方保留；Port 不在调用栈内执行对端业务。

## 3. ABI 版本

V1 同时冻结两级版本：

| 层级 | 值 | 作用 |
|---|---|---|
| Runtime composition identity | `quickapp-kit-runtime-v1` | 判断 JS Framework 与 Core 是否属于同一 ABI 世代 |
| Message schema version | integer `1` | 判断单条消息字段布局与语义 |

启动过程：

```text
RuntimeAbiService.start(composition.runtimeAbi)
  -> exact match quickapp-kit-runtime-v1
  -> validate Core ports open and limits > 0
  -> bind all NativeEntryCatalog entries
  -> any failure: unbind already-bound entries in reverse order
  -> running
```

identity 不匹配返回 `ABI_UNSUPPORTED_VERSION`；不允许按消息猜测兼容、不允许降级版本、不允许部分注册。单条消息 `schemaVersion != 1` 同样返回 `ABI_UNSUPPORTED_VERSION`，但不终止已运行 ABI Service。

## 4. 消息与字段

### 4.1 字段规则

每个 typed message 必须满足：

1. `schemaVersion` 精确为 `1`。
2. `kind` 精确匹配入口或 callback slot，调用者不能覆盖。
3. 必填字段完整；未知字段拒绝；optional 缺失与 `null` 不混同。
4. ID 前缀、正整数、枚举、safe integer、RuntimeValue 与跨字段关系符合对应公共 Schema。
5. message 在成功 post 前已脱离借用的 `JsValueView`；跨线程只传 immutable typed value。

### 4.2 JS -> Core closed union

| Native operation | typed message | 关联键 | 字段唯一来源 |
|---|---|---|---|
| instantiate | `InstantiateTemplate` | `RequestId` | Runtime ABI + Surface Control Schema |
| module completion | `LoadVerifiedModuleResult` | echo `RequestId` | Module Load Schema |
| VM init completion | `VmInitializationResult` | echo `RequestId` | Lifecycle Schema |
| render | `RenderTransaction` | `TransactionId` | Render Transaction Schema |
| handler register/unregister | `RegisterHandler` / `UnregisterHandler` | `RequestId` | Runtime ABI Schema |
| navigation push/close | `NavigationPush` / `NavigationClose` | `RequestId` | Navigation Schema |
| prompt/device | `ShowToast` / `DeviceGetInfo` | `RequestId` | Feature Schema |
| page control | `SetTitleBar` / `SetMeta` | `RequestId` | Feature Schema |
| lifecycle completion | `LifecycleResult` | echo `RequestId` | Lifecycle Schema |

`CoreInboundMessage` 是上述具体 C++ struct 的 `std::variant` 等价物；它不是一个带动态 `payload` 的消息对象。消息构造权属于后续业务模块，JS-S02 只校验、编码与投递。

JS Framework bootstrap 为每个 AppRuntime 创建且只创建一个本地 `JsRequestIdAllocator`。allocator 只在 JS Executor 上运行，由所有请求发起模块共享，按调用顺序产生单调且不复用的 `req:j-<positive-decimal>`。请求模块先取号，再把含该 ID 的完整 typed message 交给 S02。allocator 不是 C++ 服务，不通过 Native Function 暴露，也不归 RuntimeAbiService/S02 所有；S02 只校验分区，不生成、借用或回传 ID。Core-origin completion 入口只接受并原样回显 Core 已给出的 `req:<positive-decimal>`，不进入 JS-origin 分配规则。14 个 Native Function 不增加 ID 分配入口。

```text
JS Framework bootstrap(AppRuntime)
  -> create exactly one JsRequestIdAllocator
  -> share it with RequestModuleA / RequestModuleB / ...

RequestModule on JS Executor
  -> requestId = allocator.next()
  -> build complete typed message(requestId, ...)
  -> RuntimeAbiClient.call(message)
```

来源校验按语义执行：

| 语义 | 合法 wire | S02 行为 |
|---|---|---|
| JS 新发起 request | `^req:j-[1-9][0-9]*$` | 校验后建立 bridge correlation |
| Core-origin dispatch 的 completion | `^req:[1-9][0-9]*$` | 原样回显，不建立 correlation |
| Core 返回 JS-origin request Result | `^req:j-[1-9][0-9]*$` | 匹配 correlation 后投递 typed slot |
| Platform input/`JsEventDispatch` 因果 ID | `^req:p-[1-9][0-9]*$` | 原样交付，不建立 correlation |
| Render 可选因果 `requestId` | 原始输入来源分区 | 只透传因果；Render 仍按 `TransactionId` 关联 |

### 4.3 Core -> JS closed union

| 类别 | typed callback |
|---|---|
| Verified Module | `LoadVerifiedModule` |
| Context | `AppContext`、`SurfaceContext` |
| VM/Lifecycle | `VmInitializationDispatch`、`LifecycleDispatch` |
| Event | `JsEventDispatch` |
| Initial/Handler/Render Result | `InstantiateTemplateResult`、`HandlerRegistrationResult`、`RenderTransactionResult` |
| Navigation Result | `NavigationPushResult`、`NavigationCloseResult` |
| Capability/Page Result | `ShowToastResult`、`DeviceGetInfoResult`、`SetTitleBarResult`、`SetMetaResult` |
| Surface status | `SurfaceStatusChanged` |

`JsInboundMessage` 同样是具体类型的 closed union。成功/失败 Result 使用同一 type/kind，由 `status` 判别；JS 不接收 `MountTransactionResult`。

### 4.4 RuntimeError

JS 可见错误严格编码为：

```text
code: public RuntimeError code
message: UTF-8 string
retryable: boolean
surfaceId?: SurfaceId
requestId?: RequestId
transactionId?: TransactionId
mountAttemptId?: MountAttemptId
```

未声明字段、未知 code 或错误 ID 前缀拒绝。C++ 异常不能跨 Native Function、Port 或 callback 边界。

## 5. Native Function Catalog

每个消息入口只接受一个 plain object 参数，`minArgs=maxArgs=1`，返回 `EnqueueResult` 对象；唯一例外是公共合同已冻结的只读查询 `supportsCapability(moduleName, methodName) -> boolean`。固定 binding 名只供 JS Framework 内部使用：

| Binding name | argc | typed decoder/result |
|---|---:|---|
| `$quickapp_runtime_v1_instantiateTemplate$` | 1 | `InstantiateTemplate -> EnqueueResult` |
| `$quickapp_runtime_v1_completeVerifiedModuleLoad$` | 1 | `LoadVerifiedModuleResult -> EnqueueResult` |
| `$quickapp_runtime_v1_completeVmInitialization$` | 1 | `VmInitializationResult -> EnqueueResult` |
| `$quickapp_runtime_v1_submitRenderTransaction$` | 1 | `RenderTransaction -> EnqueueResult` |
| `$quickapp_runtime_v1_registerHandler$` | 1 | `RegisterHandler -> EnqueueResult` |
| `$quickapp_runtime_v1_unregisterHandler$` | 1 | `UnregisterHandler -> EnqueueResult` |
| `$quickapp_runtime_v1_pushRoute$` | 1 | `NavigationPush -> EnqueueResult` |
| `$quickapp_runtime_v1_closeRoute$` | 1 | `NavigationClose -> EnqueueResult` |
| `$quickapp_runtime_v1_showToast$` | 1 | `ShowToast -> EnqueueResult` |
| `$quickapp_runtime_v1_getDeviceInfo$` | 1 | `DeviceGetInfo -> EnqueueResult` |
| `$quickapp_runtime_v1_setTitleBar$` | 1 | `SetTitleBar -> EnqueueResult` |
| `$quickapp_runtime_v1_setMeta$` | 1 | `SetMeta -> EnqueueResult` |
| `$quickapp_runtime_v1_supportsCapability$` | 2 | `string moduleName + string methodName -> boolean` |
| `$quickapp_runtime_v1_completeLifecycle$` | 1 | `LifecycleResult -> EnqueueResult` |

Catalog 不提供 `call(kind,payload)`、`invoke(module,method,args)` 或未知入口 fallback。

`supportsCapability` 不创建业务 request、不进入 Core queue、不登记 correlation。Composition Root 在 App JS 执行前把“Manifest declaration AND Core Registry descriptor”的 immutable typed snapshot 注入 S02；binding 只在 JS Executor 读取该快照并返回布尔值，不同步跨线程、不创建 Provider。JS-S09 只把这个冻结查询包装为联盟 Facade。

## 6. 双向准入流程

### 6.1 JS -> Core

```text
NativeCallView
  -> verify ABI Service running and exactly one arg
  -> JsEnginePort.toRuntimeValue(no side effects, bounded)
  -> entry-specific decoder
  -> schemaVersion/kind/required/unknown/cross-field validation
  -> verify Surface/AppRuntime admission and bridge correlation capacity
  -> create provisional bridge correlation record when a later Result is required
  -> CoreIngressPort.post(typed message)
       accepted: commit correlation, return {ok:true}
       rejected: erase provisional correlation, return {ok:false,error}
```

completion 消息只 echo Core-origin RequestId，不创建 correlation record；它们只完成 Core 已发起的异步闭环。Render 使用发起模块生成的 `TransactionId`；其他 JS-origin 异步请求先从本 AppRuntime 唯一 `JsRequestIdAllocator` 取得 `req:j-<positive-decimal>`，再提交完整 typed message。

### 6.2 Core -> JS

```text
Core producer calls RuntimeAbiCallbacks.post(typed callback)
  -> pure version/field validation
  -> reject if AppRuntime/Surface admission closed
  -> JsEngineService.post(move immutable callback)
  -> accepted means callback is queued, not consumed
  -> on JS Executor: recheck generation
       result: match and erase correlation, then post typed slot exactly once
       dispatch/context/status: invoke matching typed slot
       mismatch/late/duplicate: drop + observe
```

producer-thread admission 不读取或修改 JS VM。所有 consumer 注册、bridge correlation mutation 和业务 callback invocation 只在 JS Executor。

## 7. Result 关联

```text
CorrelationKey = Request(RequestId) | Transaction(TransactionId)

PendingRecord:
  key
  expectedResultKind
  owner = AppRuntime | SurfaceId
  ownerGeneration
```

规则：

1. key 在 AppRuntime 对应作用域内唯一，登记时重复即 `ABI_INVALID_ARGUMENT`。
2. accepted 后恰好接受一个匹配终态 Result；消费时先移除 correlation record，再把完整 typed Result 投递到编译期固定 consumer slot，避免 consumer 重入造成重复完成。
3. Result 的 key 正确但 kind、Surface 或 generation 不匹配，按非法/late Result 丢弃，不能消费另一条 correlation。
4. bridge correlation 到达容量上限时新请求返回 `QUEUE_OVERFLOW`，不调用 Core。
5. S02 不实现 timeout。Core/JS 销毁通过明确 cancel/late 规则完成，不用时间猜测结果。
6. PendingRecord 只含 `key + expectedResultKind + owner/generation`。JS-S07 自己持有 Render snapshot，JS-S09 自己持有 Promise/callback，其他模块同样自行持有业务 completion；S02 不建立第二套业务 pending 权威。

权威边界固定为：

| 记录 | 唯一回答的问题 | 不回答的问题 |
|---|---|---|
| S02 `PendingRecord` | 该 Result 是否来自一个已接受、未完成且 owner/generation 匹配的跨层请求 | Promise 如何 resolve、Render snapshot 如何提交/回滚 |
| JS-S07/JS-S09 等业务 pending | 合法 typed Result 到达后如何更新业务状态 | Result 是否具备跨层合法性、是否重复或 late |

因此两者可以使用同一关联 ID，但字段和权威不重叠：S02 先删除 bridge correlation 并投递 typed Result，业务模块随后只处理自己的状态。

## 8. 状态机

### 8.1 RuntimeAbiService

```text
new -> starting -> running -> quiescing -> stopped
          |                        ^
          +------ failed ----------+
```

- `starting` 只做版本/limit/Port 校验和 binding 注册。
- `running` 接受双向消息。
- `quiescing` 关闭新 admission，只执行取消与解绑。
- 任一 partial bind 失败进入 failed cleanup，最终 stopped。
- start/stop 幂等，不创建第二套 bindings 或 correlation registry。

### 8.2 Surface scope

```text
unknown -> open(generation) -> closing -> closed
```

SurfaceId 不复用；generation 仍用于拒绝已排队但晚于 close 的 callback。close 幂等，closed 不可重新 open。

## 9. 线程与所有权

| 对象/动作 | 所有者 | 规则 |
|---|---|---|
| Native binding token | RuntimeAbiService / JS Executor | reverse-order unbind，早于 Context destroy |
| borrowed JS args | JS-S01 Provider / native call stack | decoder 返回前转为独立 RuntimeValue，不保存 view |
| `CoreInboundMessage` | S02 -> Core | accepted 时 move；rejected 时 S02 释放 |
| `JsInboundMessage` | Core -> S02 | callback post accepted 时 move；rejected 时 Core producer 保留/释放 |
| `ModuleBundle.bytes` | Core Loader -> S02 -> S03 consumer | 进程内为 `shared_ptr<const vector<uint8_t>>`；accepted 后各持有者只能读，最后一个 owner 在 terminal delivery、拒绝或取消路径结束时释放；base64 只在 Schema/fixture wire 边界 |
| bridge correlation registry | RuntimeAbiService / JS Executor | 只保留关联字段，不从 Core thread访问，不持有业务 completion |
| JS-origin RequestId sequence | JS Framework bootstrap 创建的 AppRuntime 唯一 `JsRequestIdAllocator` / JS Executor | 所有请求模块共享取号；S02 只接收完整 typed message 并校验，不拥有 allocator，不同步请求 C++ 分配 |
| typed callback slot | 后续 JS 模块 | S02 只投递完整 typed Result；registration token 注销后不能再调用，业务 pending 仍由模块持有 |
| ABI observation | 当前 producer 的 JS Executor | 结构化、非阻塞，不参与业务成功条件 |

物理上单线程实现仍必须经过 Port/post；禁止因线程重合直接调用 Core handler 或 JS consumer。

## 10. 销毁

### 10.1 Surface

```text
mark Surface closing
-> reject new Surface-scoped outbound admission
-> invalidate Surface callback generation
-> remove Surface bridge correlation records
-> drain queued callback tasks; generation mismatch only releases message
-> mark closed
```

新 Surface 请求返回 `SURFACE_NOT_FOUND`。late Result/Event 不调用 consumer、不重建 correlation。

排队中的 Surface-scoped `LoadVerifiedModule` 在 generation 失效后只销毁 callback，从而释放其 immutable bytes；S02 不把 bytes 复制进 correlation 或 tombstone。

### 10.2 AppRuntime

```text
RuntimeAbiService.stop
-> state quiescing; close inbound/outbound admission
-> unbind every NativeFunction token in reverse registration order
-> clear all bridge correlation records and invalidate all consumer registration tokens
-> close/release Core ingress and callback Ports
-> clear scope records and callback tasks
-> state stopped
-> JS-S01 upperLayerTeardown returns
-> JS-S01 destroys Context then Engine
```

S02 teardown 作为 JS-S01 `upperLayerTeardown` 在 JS Executor 上执行。销毁完成必须满足：

```text
liveNativeEntry = 0
liveBridgeCorrelation = 0
liveConsumerRegistration = 0
openSurfaceScope = 0
queuedAbiCallback = 0
```

## 11. 错误与观测

| 场景 | typed error/行为 |
|---|---|
| Runtime ABI identity 或 message version 不支持 | `ABI_UNSUPPORTED_VERSION` |
| 字段、类型、kind、ID、关联关系非法 | `ABI_INVALID_ARGUMENT` |
| RuntimeValue 无法转换 | `ABI_INVALID_ARGUMENT`；OOM 保留 `OUT_OF_MEMORY` |
| bridge correlation 或 Core/JS queue 满 | `QUEUE_OVERFLOW` |
| Surface 已关闭 | `SURFACE_NOT_FOUND` |
| Native callback 抛 C++ 异常 | JS-S01 边界转 `JS_EXCEPTION`；不得穿透 |
| duplicate/late/mismatched callback | 丢弃并记录；不返回给已销毁对象 |

S02 只对携带 `RequestId` 的 ABI 边界复用公共 `bridge.request.enqueued/completed/failed`，并复用 `queue.overflow`、`runtime.counter.sampled` 等已存在 marker。Render 的 `TransactionId` 观测归 JS-S07 `render.transaction.*`，S02 不重复制造 Bridge marker。不得新增 marker、格式化文本或执行 I/O。Noop/Recording 必须保持 EnqueueResult、bridge correlation、callback 顺序和销毁结果一致。

## 12. 非本任务设计

本分 Spec 不定义后续 typed consumer 的业务行为：

- JS-S03：Module callback 与 completion 内容。
- JS-S04：Context、VM initialization 和 Lifecycle Hook。
- JS-S07：Instantiate/Render 的构造、Revision、Render snapshot 和业务 completion。
- JS-S08：Handler/Event 执行与 retirement。
- JS-S09：Navigation/Capability/Page Facade、Promise/callback pending 和 supports 语义。

这些模块只能消费 S02 typed client/callback，不能新增 Native Binding 或跨层队列。
