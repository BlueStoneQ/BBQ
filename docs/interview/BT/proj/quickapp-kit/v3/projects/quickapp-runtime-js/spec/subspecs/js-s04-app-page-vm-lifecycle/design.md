# JS-S04 App/Page VM 与 Lifecycle：设计

## 目录

- [1. 结论](#1-结论)
- [2. 组件与所有权](#2-组件与所有权)
- [3. Context](#3-context)
- [4. VM 模型](#4-vm-模型)
- [5. 初始化管线](#5-初始化管线)
- [6. Lifecycle 管线](#6-lifecycle-管线)
- [7. Request、重复与完成](#7-request重复与完成)
- [8. Teardown 与资源](#8-teardown-与资源)
- [9. 线程、异常与观测](#9-线程异常与观测)
- [10. 已冻结合同](#10-已冻结合同)

## 1. 结论

S04 采用 **一个 AppVmController + 每 Surface 一个 PageVmController + typed Dispatch ledger**。Controller 是 VM 与 Hook 的唯一所有者；Core 仍是 AppRuntime/PageContext/Surface/Navigation 的唯一状态权威。

```text
Context + loaded Module Handle
  -> VmInitializationDispatch
  -> create isolated VM
  -> fixed initialization stages
  -> typed Result

Core committed lifecycle boundary
  -> LifecycleDispatch
  -> exactly-once Hook
  -> typed Result
```

## 2. 组件与所有权

```text
RuntimeAbiCallbacks(JS-S02)
  -> ContextRegistry
  -> VmLifecycleService
      -> AppVmController(0..1)
      -> PageVmController[SurfaceId]
      -> HookRunner
      -> InitializationStagePort
      -> DispatchLedger
      -> LifecycleCompletionOutbox
  -> RuntimeAbiClient.completeVmInitialization/completeLifecycle(JS-S02)
```

| 组件 | 唯一拥有 | 不拥有 |
|---|---|---|
| `ContextRegistry` | AppContext、SurfaceContext、context fault/tombstone | mutable business state、Manifest/Page IR |
| `AppVmController` | App VM ref、init state、Hook ledger、visibility projection | Core AppRuntime state |
| `PageVmController` | Page VM ref、Surface context、S03 lease、Hook ledger | Core PageContext/Host/stack |
| `HookRunner` | callable lookup、`this`、异常、microtask checkpoint | Hook 触发时机的 Core 决策 |
| `PageInitializationStagePort` | S04 与后续初始化参与者的 typed 本地边界 | Runtime ABI/Bridge |
| `DispatchLedger/Outbox` | business completion 与防重 | S02 bridge correlation |

App/Page VM 与所有 Context-bound `JsValueRef` 只在 JS Executor 创建、访问、销毁。

## 3. Context

### 3.1 AppContext

`AppContextRecord`：

```text
packageId, versionName, versionCode, runtimeVersion
declaredCapabilities[]
fingerprint
state: absent | present | faulted | released
```

- 第一个合法 AppContext 深复制/转移为 immutable record。
- packageId 必须等于 AppRuntime identity；能力无重复且受 config node limit。
- identical duplicate no-op；conflicting duplicate 保留首值并置 `faulted`。
- `faulted` 不创建 App VM；下一 App initialization 返回 failed(onCreate)。
- AppRuntime 生命周期内只接受一次，不存在替换 Context。

### 3.2 SurfaceContext

每个不复用的 SurfaceId 一个 record：

```text
surfaceId, packageId, route, templateId
params, hostCapabilities, viewport
surfaceGeneration, fingerprint
state: absent | present | faulted | closing | released
```

params 是 immutable RuntimeValue tree，不是 Page state。identical duplicate no-op；冲突置 faulted。closing/released 后的 Context 直接丢弃，不新建 generation，也不复活 Surface。

### 3.3 Context 消费顺序

Context callback 不产生独立 Result。Core 固定先发 Context，再交付 verified module，再发 initialization dispatch。S04 不靠超时猜测缺失 Context；若 Core 违反顺序，initialization 立即返回 typed failure。

## 4. VM 模型

### 4.1 App VM

```text
absent -> initializing -> created -> destroying -> destroyed
                    \-> failed -> destroyed
```

独立 `visibilityProjection`：`unknown | foreground | background`。它只防止重复 Hook，不作为 Core AppRuntime state，也不触发 Platform 操作。

`AppVmRecord` 保存：App definition generation、App Context ref、VM object ref、init stage、visibility projection、last lifecycle sequence、Hook/request ledger。一个 AppRuntime 不存在第二条 App VM 创建路径。

### 4.2 Page VM

```text
absent -> initializing -> ready -> destroying -> destroyed
                    \-> failed -> destroyed
```

独立 `visibilityProjection`：`unknown | visible | hidden`。

`PageVmRecord` 保存：SurfaceId、Surface generation、Page definition/lease generation、Context ref、VM object ref、init stage、visibility projection、last lifecycle sequence、Hook/request ledger。Page module definition 可以共享，VM object/state 永不共享。

### 4.3 Handle

后续模块只获得 generation-checked `AppVmHandle/PageVmHandle`：

- 只能在 JS Executor 解引用。
- 只在 controller state 允许时借用。
- 不暴露 Controller 容器、S03 cache、QuickJS handle 或 Core 状态。
- teardown 开始即失效；晚到任务只能得到 stopped/surface-not-found。

### 4.4 Definition 调用合同

S04 直接消费 S03 已校验的公共 Artifact Definition：

- App VM 只由 `createAppVm(appContext)` 创建一次；Page VM 只由 `createPageVm(surfaceContext)` 为每个 Surface 创建一次。
- 两个 callable 只接收各自 Context view，并必须返回普通 VM object；S04 不接受 VM Definition 作为 VM 实例，也不共享返回 object。
- `bindingEvaluators` 由后续 Binding 模块以对应 Page VM 作为 `this`、以只读 lexical `scope` 作为唯一参数调用；S04 不执行 evaluator。
- `handlerMethods` 只作为已校验的 `TemplateHandlerId -> non-empty methodName` 映射交给后续 Handler 模块；S04 不调用 handler。
- Definition 只属于 S03 cache；Context、VM object、state 和 lifecycle ledger 只属于当前 S04 controller。

## 5. 初始化管线

### 5.1 Admission

`VmInitializationDispatch` 进入 JS Executor 后：

1. 校验 Core-origin RequestId、scope/surface 交叉字段和 owner live。
2. 在 ledger 预留 terminal completion slot。
3. 检查 Context 无 fault、VM absent、S03 definition/lease loaded 且 generation 匹配。
4. VM/Value/Stage 任一资源预算不足时不创建 VM，直接生成 typed failure。

### 5.2 App

```text
acquire App definition
  -> construct App VM with immutable AppContext
  -> install state/methods
  -> invoke optional onCreate exactly once
  -> drain bounded microtask checkpoint
  -> state=created
  -> completeVmInitialization(completed)
  -> publish AppVmHandle only after completion accepted
```

缺失 `onCreate` 视为成功 no-op。Hook `this` 固定为 App VM；参数只包含 Framework 冻结的 App Context view，不传 Core/Platform 对象。

### 5.3 Page

```text
acquire Page definition lease
  -> construct isolated Page VM with SurfaceContext.params
  -> install state + methods
  -> onInit
  -> PageInitializationStagePort.evaluateInitial
  -> onReady
  -> drain bounded microtasks
  -> PageInitializationStagePort.finalizeCheckpoint
  -> state=ready
  -> completeVmInitialization(completed)
  -> publish PageVmHandle only after completion accepted
```

`PageInitializationStagePort` 是同一 JS Runtime 内的 typed extension point：

```text
evaluateInitial(PageVmHandle) -> Result<void>
finalizeCheckpoint(PageVmHandle) -> Result<void>
cancel(PageVmHandle)
```

JS-S05/S06/S08 后续组合实现它；S04 合同测试使用 Fake Stage。它不得发 Runtime ABI、不得提交 Render、不得保留超出调用期的未代际化 VM 引用。S04 只负责编排，不解释 Binding/Block/Handler。

### 5.4 初始化失败

| 失败点 | failedPhase | 行为 |
|---|---|---|
| App precondition/create/onCreate/checkpoint | `onCreate` | 不发布 handle，释放 App VM，后续 App Hook 禁止 |
| Page precondition/create/onInit | `onInit` | cancel stage，释放 Page VM；不执行后续阶段 |
| evaluateInitial | `initialEvaluation` | cancel stage；不执行 onReady |
| onReady/final checkpoint | `onReady` | cancel stage；不发布 ready handle |

失败 Result accepted 后 Controller 保留最小 failed tombstone，等待 Core teardown；不调用 `onDestroy` 补偿未完成初始化，不发送 Instantiate/Render。

## 6. Lifecycle 管线

### 6.1 Admission

S04 只处理 Core 已提交边界后发送的 `onShow/onHide/onDestroy`。校验：

- owner VM 已成功初始化且非 destroyed。
- App 无 surfaceId；Page 有匹配 SurfaceId。
- sequence 大于该 owner 的 last accepted sequence。
- requestId 未被其他 payload 使用，当前 owner 无 Hook executing。
- Hook 与 visibility projection 合法。

允许 sequence 跳号；S04 不推导缺失 Core 状态。

### 6.2 Show/Hide

| Scope | Hook | 允许 projection | terminal projection |
|---|---|---|---|
| App | onShow | unknown/background | foreground |
| App | onHide | foreground | background |
| Page | onShow | unknown/hidden | visible |
| Page | onHide | visible | hidden |

流程：先将 request 标记 executing，再调用 optional Hook，捕获结果后无论 completed/failed 都提交 terminal projection 与 last sequence，然后发送 typed Result。因为 Core/Platform 状态已提交，Hook 失败不能回滚或自动重试。

### 6.3 Destroy

```text
close owner admission
  -> invalidate downstream VM handles
  -> invoke onDestroy at most once
  -> capture completed/failed Result
  -> cancel PageInitializationStage/downstream work
  -> release VM values/context refs
  -> release S03 definition handle/Page lease
  -> state=destroyed
  -> enqueue immutable LifecycleResult
```

`onDestroy` 异常不阻塞释放。S04 不自行补发 `onHide`；Core 必须按公共顺序显式 dispatch。未成功初始化的 failed tombstone teardown 直接释放，不调用 lifecycle Hook。

### 6.4 App 与页面顺序

App foreground/background、Navigation push/close、整栈 teardown 的跨页面顺序完全由 Core dispatch sequence 决定。S04 按 JS Executor FIFO 消费，不保存 predecessor/top/root，不自行排序 Page controller。

## 7. Request、重复与完成

### 7.1 Ledger

```text
DispatchRecord
  requestId
  kind: initialization | lifecycle
  payloadFingerprint
  owner: app | surfaceId
  ownerGeneration
  state: admitted | executing | awaitingPost | completed | cancelled
  terminalResult?
```

- identical duplicate pending：不增加执行，不创建第二 completion。
- identical duplicate completed：只记录 duplicate，不重发 Result。
- 同 RequestId 不同 payload：不触碰原 record/VM，记录 ABI violation。
- late owner generation：drop 或 `SURFACE_NOT_FOUND`，不创建 controller。
- 生命周期 out-of-order/reentry：生成一次 failed `LIFECYCLE_BUSY`，Hook=0。

Ledger 有固定容量；completed record 可在安全窗口后保留 bounded tombstone，AppRuntime teardown 全清。

### 7.2 Completion Outbox

Initialization/Lifecycle 各自构造公共 concrete Result，原样回显 RequestId/scope/surface/hook/sequence。业务终态归 S04；S02 只执行 typed encode/post。

每个 admitted dispatch 预留一个 outbox slot。S02 返回：

- accepted：标记 completed、删除 payload，发布 ready handle或结束 Hook。
- `QUEUE_OVERFLOW`：保留同一 immutable Result，排一个去重公平 continuation；不重跑 Hook。
- terminal closed：仅 owner/app teardown 后取消；正常运行时视为 Runtime failure并停止该 owner 新 admission。
- OOM：使用预留最小 failure storage；不构造无界诊断文本。

Page initialization completed 被 Core ingress accepted 后，S04 才发布本地 ready notification；未来 JS-S07 因此只能在该 Result 之后向同一 JS -> Core 队列提交 `InstantiateTemplate`。

## 8. Teardown 与资源

### 8.1 Surface

```text
mark Context/controller closing
  -> reject Context/Dispatch/downstream handle
  -> cancel not-started initialization
  -> normal path consumes Core onDestroy dispatch
  -> forced upper teardown releases residual VM without fabricating Result
  -> release Context RuntimeValue + S03 Page lease
  -> clear ledger/outbox/tombstone
```

正常 Surface 销毁由 Core 发出 onDestroy；forced upper teardown只在 Core/Runtime 已停止时保证释放，不伪造新的 Core completion，不维护 Surface 栈。

### 8.2 AppRuntime

Core 负责按栈顶到 Root dispatch Page destroy。S04 不保存该顺序。进入 JS-S01 upper-layer teardown 后：

1. 关闭全部新 callback consumer/admission。
2. 强制释放残余 Page controller。
3. 释放 App VM/controller。
4. 释放 Context、ledger、outbox。
5. 通知 S03 释放 module handle/cache。
6. 返回 JS-S01，让 Value -> Context -> Engine 销毁。

### 8.3 Limits

`VmLifecycleLimits` 至少包含：max Surface controllers、Context RuntimeValue depth/nodes、dispatch ledger、completion outbox、Hook calls per turn、microtasks per checkpoint、VM retained values。容量检查发生在创建 VM/调用 Hook 前。

## 9. 线程、异常与观测

Core callback 只经 JS-S02 入有界 JS Executor queue；即使物理单线程也不 inline 调用 consumer。Hook、Stage、microtask、Result 构造和 teardown 都在 JS Executor。

异常映射：

| 场景 | 错误 |
|---|---|
| Context/Dispatch shape/precondition | `ABI_INVALID_ARGUMENT` |
| Surface absent/closed | `SURFACE_NOT_FOUND` |
| Hook 并发、非法顺序、重复初始化 | `LIFECYCLE_BUSY` |
| Hook/VM/Stage JS exception | `JS_EXCEPTION` |
| 资源分配 | `OUT_OF_MEMORY` |
| ledger/outbox/queue capacity | `QUEUE_OVERFLOW` |

S04 只发公共 `lifecycle.hook.started/completed/failed`。Initialization 没有独立公共 marker 时不创建私有同义 marker，只通过 Bridge marker、Hook marker和 VM/queue 计数表达。Trace 使用 run-relative integer ns、RequestId、scope、hook、sequence，App Hook 不带 SurfaceId。Noop/Recording 行为等价。

## 10. 已冻结合同

S04 无新增公共合同缺口。公共 Artifact Contract 已冻结 `P0-JS-EXPORT-001`：S04 只消费 S03 产出的 typed App/Page Definition，调用 `createAppVm/createPageVm`，并按每个 AppRuntime/Surface 的唯一所有权创建 VM；不重复解释导出对象。
