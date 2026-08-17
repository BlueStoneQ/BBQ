# CORE-S03 设计

## 目录

- [1. 结论](#1-结论)
- [2. 组件与所有权](#2-组件与所有权)
- [3. 唯一状态机](#3-唯一状态机)
- [4. App 启动](#4-app-启动)
- [5. Verified Module 与 VM](#5-verified-module-与-vm)
- [6. Host Lifecycle Control](#6-host-lifecycle-control)
- [7. Page 生命周期服务](#7-page-生命周期服务)
- [8. RequestId 与完成语义](#8-requestid-与完成语义)
- [9. 失败与 teardown](#9-失败与-teardown)
- [10. 线程、内存与 Port](#10-线程内存与-port)
- [11. 观测与测试接口](#11-观测与测试接口)
- [12. 边界不变量](#12-边界不变量)

## 1. 结论

采用一个 `AppRuntimeController` 聚合 App 级状态，状态只在 Core Runtime Thread 上推进；JS 与 Platform 都是异步执行者，不拥有 Core 生命周期。S04 通过窄 collaborator 接口参与 Surface 操作，但 AppRuntime 状态、Host control slot 和最终 teardown 仍只有 S03 一份。

## 2. 组件与所有权

```text
AppRuntimeFactory
  owns AppRuntimeIdAllocator
  -> AppRuntimeController(AppRuntimeId)
       owns AppRuntimeState
       owns immutable AppContext
       owns verified Package pin
       owns AppVmRecord
       owns LifecycleControlSlot
       owns Core RequestId allocator/correlations
       owns ModuleLifecycleCoordinator
       owns one SurfaceLifecycleCollaborator (implemented by S04)
       borrows JsRuntimePort / HostResultPort / Clock / TraceSink
```

`SurfaceLifecycleCollaborator` 是 Core 内部窄边界：S03 调用 top visibility 与 destroy-all，S04 返回 typed completion；它不向 S03 暴露 Navigation 栈容器、SurfaceRecord 或 Runtime Tree。

```text
queryTop() -> none | SurfaceId
setTopVisibility(parentOperation, visible|hidden, completion)
destroyAll(parentOperation, completion)
```

AppRuntimeController 独占 collaborator 的生命周期，先销毁全部 Surface，再释放 Package 与 AppRuntime identity。S04 不能反向拥有 AppRuntimeController。

## 3. 唯一状态机

```text
absent
  -> creating
  -> ready
  -> foreground <-> background
  -> destroying
  -> destroyed
```

| 当前状态 | 合法输入 | 下一状态/结果 |
|---|---|---|
| creating | app module/init completed | ready |
| ready | enterForeground | foreground |
| ready | enterBackground | background |
| foreground | enterBackground | background |
| background | enterForeground | foreground |
| ready/foreground/background | destroyAppRuntime | destroying -> destroyed |
| 任意非 destroyed | 创建关键阶段失败 | destroying -> destroyed |

`ready` 的语义是 App VM 已初始化、尚未由 Host 提交前后台状态。重复目标状态不是隐式成功：它不满足状态转换前置条件，返回 `ABI_INVALID_ARGUMENT`；已有 control 在途时优先返回 `LIFECYCLE_BUSY`。

App VM 使用独立执行阶段，不作为第二个 AppRuntime 状态源：

```text
absent -> loadingModule -> moduleLoaded -> initializing -> live
       -> destroying -> destroyed
       \-> failed -> destroying
```

## 4. App 启动

```text
Factory create
  -> allocate AppRuntimeId + AppRuntime RequestId allocator
  -> bind verified Package
  -> build immutable AppContext
  -> enqueue AppContext
  -> obtain verified app Module from S02
  -> LoadVerifiedModule(core requestId)
  -> LoadVerifiedModuleResult(loaded)
  -> VmInitializationDispatch(app, new core requestId)
  -> VmInitializationResult(completed)
  -> commit AppRuntime=ready, AppVm=live
  -> publish create completed
```

只有每一步入队成功后才建立对应 correlation。任何失败进入 teardown；未完成创建的 AppRuntime 不对 Host 暴露为可用。Host 随后用显式 lifecycle control 把 `ready` 推进到 foreground 或 background。

`AppContext` 只投递一次；其字段来自 S02 已验证的 Manifest/Metadata 投影。JS 接收的是 immutable value，不接收 Manifest、PackageSource 或可变 Core 对象。

## 5. Verified Module 与 VM

### 5.1 模块顺序

- app：AppContext 之后加载，AppRuntime cache scope，恰好一次 bootstrap。
- shared：只按 app/page verified dependencies 加载；AppRuntime cache scope，不 bootstrap。
- page：SurfaceContext 之后加载，定义可按 bundle identity 复用，Page VM/bootstrap 必须按 Surface 隔离。

`loaded` 只提交模块定义/cache，不推进 AppRuntime/Page lifecycle；只有匹配的 `VmInitializationResult(completed)` 才完成 VM 初始化。

### 5.2 操作记录

```text
ModuleOperation
  requestId
  kind/appRuntimeId/surfaceId?
  immutable VerifiedModule handle
  stage: dispatching | awaitingResult
  epoch

VmOperation
  requestId
  scope/appRuntimeId/surfaceId?
  stage: dispatching | awaitingResult
  epoch
```

Result 先验证 producer 分区、kind、scope、SurfaceId 和 epoch，再删除 correlation 并推进状态。错误或 teardown 后 Result 只记 late/stale Trace。

## 6. Host Lifecycle Control

`LifecycleControlSlot` 最多保存一个 operation：

```text
hostRequestId
action
phase
childRequestId?
topSurfaceId?
pendingHooks
```

### 6.1 Enter background

```text
accept ready|foreground + idle
  -> if ready: commit AppRuntime=background, emit no Hide Hook, return completed
  -> if foreground: S04 setTopVisibility(hidden), if top exists
  -> success: atomically commit AppRuntime=background and top=hidden
  -> dispatch Page onHide, if top was visible
  -> dispatch App onHide
  -> wait each typed LifecycleResult
  -> RuntimeLifecycleControlResult(completed, background)
```

`ready -> background` 表示初始 Host 状态选择，不是离开 foreground，因此不产生无配对的 `onHide`。foreground 路径的 Platform visibility 失败时不提交状态、不发 Hook，并返回 failed。状态提交后的 Hook failure 只记录，不回滚，待全部 Hook 终态后仍返回 completed。

### 6.2 Enter foreground

```text
accept ready|background + idle
  -> S04 setTopVisibility(visible), if top exists
  -> success: atomically commit AppRuntime=foreground and top=visible
  -> dispatch App onShow
  -> dispatch Page onShow, if top exists
  -> wait each typed LifecycleResult
  -> RuntimeLifecycleControlResult(completed, foreground)
```

从 `ready` 进入 foreground 与 background 后进入 foreground 使用同一路径；App `onShow` 都只在状态提交后执行。

### 6.3 Destroy

destroy 抢占“接收新工作”的资格，但不伪造已有子操作的 Result：先关闭 ingress/gate 并 tombstone correlation，再由清理流程接管资源。若另一个 Host control 已在途，destroy 返回 `LIFECYCLE_BUSY`；Host 可在前一 Result 后重试。

## 7. Page 生命周期服务

S03 提供 S04 使用的内部服务，不拥有 Page 状态：

```text
loadAndInitializePage(surfaceId, SurfaceContextReadyToken, VerifiedPageModule, completion)
dispatchPageHook(surfaceId, hook, sequence, completion)
destroyPageVm(surfaceId, sequence, completion)
cancelPageOperations(surfaceId)
```

- S04 决定何时允许创建、显示、隐藏和销毁；S03 只执行 module/init/hook typed 闭环。
- S04 是 Page lifecycle 的唯一状态 owner；S03 correlation 只回答“哪个异步执行还在等待结果”。
- `onInit/onReady` 在 Page VM 初始化内部执行；`onShow/onHide/onDestroy` 通过 `LifecycleDispatch` 执行。
- Page init failure 回调 S04 typed error；S03 不自行创建或销毁 Surface。
- Hook `sequence` 由 S03 为 app/page scope 分别单调分配，并由 S04 保存已提交语义状态，防止重复触发。

## 8. RequestId 与完成语义

三种 ID 不混用：

| ID | producer | 用途 |
|---|---|---|
| Host control RequestId | Runtime Host | 原样关联 Host request/result |
| Core child RequestId | S03 共享 allocator | module、VM、Hook、Platform collaborator 子操作 |
| JS/Platform 原始 RequestId | 对应边界 producer | 只用于它发起的请求/输入 |

内部 correlation 把 child RequestId 映射到 Host control 或 Page operation；wire 不增加 parent 字段。一个 Result 只完成一个 child；Host Result 只在其全部 child 终态后排队。

V1 timeout 策略固定为 `none`：不启动墙钟 deadline，不合成 timeout error。可终止在途等待的唯一非 Result 路径是 AppRuntime/Surface teardown；teardown 删除 correlation、递增 epoch，并使后续 Result 成为 late message。由 Fake Port 的确定性 completion 和停机测试验证 liveness，不用时间等待测试。

## 9. 失败与 teardown

| 失败点 | 处理 |
|---|---|
| AppContext/Module dispatch enqueue | 创建失败，进入 teardown |
| app module/init failed | 不进入 ready，销毁 AppRuntime |
| page module/init failed | 通知 S04 销毁未提交 Surface |
| visibility child failed | 状态不变、无 Hook、Host Result failed |
| show/hide Hook failed | 状态已提交，不回滚，等待其余 Hook 后 Host completed |
| destroy Hook/Host cleanup failed | 记录错误，继续强制释放 |
| OOM/queue overflow before accept | typed error，不建立 operation |

AppRuntime teardown 顺序固定：

```text
close external ingress and lifecycle gate
-> mark AppRuntime=destroying
-> cancel/tombstone non-teardown correlations
-> if foreground: complete logical hide sequence best-effort
-> S04 destroyAll(top to root)
-> dispatch App onDestroy once, best-effort
-> release App/shared module cache and JS App VM
-> release verified Package pins
-> drain/close AppRuntime mailboxes
-> clear correlations/sequence state/Surface tombstones
-> release RequestId allocator and collaborator
-> mark destroyed, publish Host Result, release AppRuntimeController
```

逻辑 `destroyed` 不等待失败的 Platform 残留恢复；平台容器 reset 属于外围。Factory 只有在全部 AppRuntimeController 销毁后才释放 Host 级 allocator。

## 10. 线程、内存与 Port

| 边界 | 规则 |
|---|---|
| Host/JS/Platform -> Core | 校验并复制/转移 immutable message 到有界 Core queue |
| Core -> JS/Platform | 异步 Port enqueue；不在回调栈修改状态 |
| Module bytes | 只读共享存储或所有权转移；Result 后释放接收方 pin |
| Context/Result | 小型 immutable value copy |
| 状态与 correlation | 仅 Core Runtime Thread 可变，其他线程无引用 |

Port 必须支持 Fake completion、拒绝 enqueue、OOM 和乱序/重复 Result 注入。停止顺序是先拒绝新 enqueue，再使回调失效，最后销毁 Port 引用。

## 11. 观测与测试接口

- lifecycle control accepted/committed/completed/failed。
- module load 与 VM initialization dispatch/result。
- Hook dispatch/result，携带 scope、SurfaceId（Page）、sequence、RequestId。
- late/stale result、OOM、queue overflow、teardown phase。
- 测试 snapshot：AppRuntime state、AppVm stage、control slot、pending correlation 数、live page operation 数、mailbox depth。

Noop/Recording Sink 下状态、Result 与 Hook 次数必须相同。

## 12. 边界不变量

1. 一个 `AppRuntimeId` 只有一个 AppRuntimeController 和一个 App state。
2. AppContext 先于 app Module，SurfaceContext 先于 page Module；loaded 先于 VM init。
3. Host、Core child 与 JS/Platform RequestId 不冒充彼此。
4. S03 不拥有 Surface lifecycle、Navigation 栈或 Runtime Tree。
5. S04 不复制 AppRuntime state 或 lifecycle control slot。
6. accepted async operation 不靠墙钟猜结果；teardown 后 late result 不复活状态。
7. destroy 最终释放不受 Hook 或 Platform cleanup failure 阻塞。
