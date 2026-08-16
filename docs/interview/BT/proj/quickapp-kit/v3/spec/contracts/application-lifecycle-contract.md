# App And Page Lifecycle Contract

## 目录

- [1. 结论](#1-结论)
- [2. 已验证联盟事实](#2-已验证联盟事实)
- [3. V1 冻结语义](#3-v1-冻结语义)
- [4. 首屏顺序](#4-首屏顺序)
- [5. 显示、隐藏与销毁](#5-显示隐藏与销毁)
- [6. 线程与失败](#6-线程与失败)
- [7. V1 Context](#7-v1-context)
- [8. 机器合同](#8-机器合同)

## 1. 结论

App/Page 生命周期的本质是：**JS Framework 拥有 VM 初始化阶段，Core 拥有逻辑页面状态，Platform 拥有 Host 可见状态；三者只在冻结的同步点推进。**

`onReady` 表示 Page VM 与初始渲染数据已准备好，不表示平台已显示；只有 Present 成功后才触发 `onShow`。

## 2. 已验证联盟事实

以下事实来自本地联盟 `hapjs` 源码，不是推断：

1. `app.js` 由 `$app_define$` 注册定义，`$app_bootstrap$` 创建 App 后触发 `onCreate`。
2. 页面 Bundle 由 `$app_define$` 注册，`$app_bootstrap$` 创建 Page VM。
3. Page VM 初始化顺序是：建立 state/method -> `onInit` -> 编译 template -> `onReady`。
4. `onReady` 发生在 JS 发出 `createFinish` 之前；因此它早于 Android 侧消费完整首屏操作。
5. Android 侧消费 `createFinish` 后才把 Page 标记 initialized，再由可见性切换触发 `onShow`；隐藏触发 `onHide`。
6. 销毁 Page 时，JS Framework 先触发 VM `onDestroy`，再释放 VM、回调和页面文档。

证据入口：

```text
quickapp-kit-ai/source/upstream/hapjs/core/framework/src/dsls/xvm/app/bundle.js
quickapp-kit-ai/source/upstream/hapjs/core/framework/src/dsls/xvm/vm/index.js
quickapp-kit-ai/source/upstream/hapjs/core/framework/src/dsls/xvm/vm/compiler.js
quickapp-kit-ai/source/upstream/hapjs/core/framework/src/dsls/xvm/page/interface.js
quickapp-kit-ai/source/upstream/hapjs/core/runtime/android/runtime/.../JsThread.java
quickapp-kit-ai/source/upstream/hapjs/core/runtime/android/runtime/.../VDomActionApplier.java
```

## 3. V1 冻结语义

一个 AppRuntime 只拥有一个 App VM；每个 Surface 拥有一个独立 Core PageContext、JS Page VM 和 Platform Surface Host。V1 直接使用 `SurfaceId` 作为跨层页面身份，不新增 PageId。

```text
Core AppRuntime:
absent -> creating -> ready -> foreground | background -> destroying -> destroyed

JS App VM:
absent -> created(onCreate complete) -> destroyed

JS Page VM:
absent -> initializing(onInit) -> ready(onReady) -> destroying(onDestroy) -> destroyed

Core PageContext lifecycle:
absent -> creating -> awaitingTemplate -> mounting -> presenting
       -> visible <-> hidden -> destroying -> destroyed

Core PageContext health:
normal -> degraded -> failed

Platform Surface Host:
absent -> hidden-empty -> hidden-mounted -> visible <-> hidden -> destroyed
```

关键跨层推进点只有一套：`AppContext -> verified App Module -> VmInitializationDispatch/Result` 完成 App VM 初始化；`SurfaceContext -> verified Page Module -> VmInitializationDispatch/Result` 完成 Page VM 初始化；Page 初始化成功后才允许 `InstantiateTemplate`；`PresentSurfaceHostResult` 允许 Core 提交 visible；`CloseSurfaceHostResult/DestroySurfaceHostResult` 允许 Core 提交关闭或完成资源回收。

Hook 与状态边界：

| Hook | 所在层 | 触发边界 | V1 次数 |
|---|---|---|---|
| App `onCreate` | JS | App 定义和全局 state 已安装 | 每个 AppRuntime 恰好一次 |
| App `onShow` | Core -> JS | Runtime Host 进入前台 | 每次 background -> foreground |
| App `onHide` | Core -> JS | Runtime Host 离开前台 | 每次 foreground -> background |
| App `onDestroy` | Core -> JS | 停止新任务后、释放 App VM 前 | 恰好一次 |
| Page `onInit` | JS | Page state/method/Handler 已安装，初始 Binding 求值前 | 每个 Page VM 恰好一次 |
| Page `onReady` | JS | 初始 Binding/Block/Handler 已求值，首个 Instantiate 提交前 | 每个 Page VM 恰好一次 |
| Page `onShow` | Core -> JS | Platform Present 成功且 Core 提交 visible 后 | 每次进入 visible |
| Page `onHide` | Core -> JS | Core 提交 hidden 后 | 每次离开 visible |
| Page `onDestroy` | Core -> JS | 停止新事件后、释放 Handler/Page VM 前 | 恰好一次 |

## 4. 首屏顺序

```text
load app.js
  -> $app_define$
  -> $app_bootstrap$
  -> App onCreate
  -> create hidden Surface Host
  -> create PageContext + load page bundle
  -> install Page state / methods / handlers
  -> Page onInit
  -> evaluate initial Binding / Block / Handler
  -> Page onReady
  -> drain onInit/onReady synchronous mutations and one microtask flush
  -> InstantiateTemplate
  -> Core Runtime Tree + Layout/Measure
  -> full Mount(hidden)
  -> Platform Present
  -> Core commit visible
  -> Page onShow
```

完整跨层入口实际先由 Core 发送 `AppContext` 再交付 verified `app.js`，模块 loaded 后发出 App `VmInitializationDispatch`；创建 Surface 后先发送 `SurfaceContext` 再交付 verified page Bundle，loaded 后发出 Page `VmInitializationDispatch`。Page 初始化 `completed` 与随后的 `InstantiateTemplate` 必须按同一 JS -> Core 队列顺序到达；初始化 `failed` 时不得发送 Instantiate，Core 直接失败并清理对应 AppRuntime 或 Surface。

`onInit`/`onReady` 中产生的同步状态写入并入首个 `InstantiateTemplate`，不得在 Runtime Tree 尚未创建时发送普通 `RenderTransaction`。

若 Runtime Host 已在前台，App `onShow` 在入口 Page `onShow` 前触发；App 前后台切换不重建 App VM。

## 5. 显示、隐藏与销毁

Runtime Host 前后台控制按一个 AppRuntime 串行，重复或并发控制返回 `LIFECYCLE_BUSY`。`enterBackground` 唯一顺序：

```text
validate AppRuntime=foreground and no lifecycle control in flight
  -> if current top Surface exists: Platform SetSurfaceVisibility(hidden)
  -> Platform success: Core commit top hidden + AppRuntime background
  -> Page onHide(current top, if it was visible)
  -> App onHide
  -> RuntimeLifecycleControlResult(completed, background)
```

`enterForeground` 唯一顺序：

```text
validate AppRuntime=background and no lifecycle control in flight
  -> if current top Surface exists: Platform SetSurfaceVisibility(visible)
  -> Platform success: Core commit AppRuntime foreground + top visible
  -> App onShow
  -> Page onShow(current top)
  -> RuntimeLifecycleControlResult(completed, foreground)
```

没有 Surface 时跳过 Platform/Page 步骤，只转换 AppRuntime 并执行 App Hook。Platform visibility 失败时 Core 状态不变、不发送 Hook，Host Control 返回 failed；Hook failure 在状态提交后只记录 `JS_EXCEPTION`，不回滚 Platform/Core 状态，Host Control 仍返回 completed。Host Control Result 必须等待相关 Hook Result 全部完成后发出。

Navigation Push 只有在 target Present 成功后才提交状态：

```text
target Present success
  -> Core atomic commit: source hidden + target visible + stack
  -> source Page onHide
  -> target Page onShow
```

Push 失败时 source 不触发 `onHide`，target 不触发 `onShow`；target 直接进入销毁流程。

Navigation Close 只关闭当前非 Root 栈顶，并恢复它的直接前驱：

```text
validate visible top + predecessor
  -> mark closing / reject new input
  -> Platform atomically close target and reveal predecessor
  -> Core commit: pop target + predecessor visible
  -> target Page onHide / onDestroy
  -> predecessor Page onShow
  -> release target JS/Core resources
```

Platform Close 失败时不提交页面栈、不发送 Hook，target 恢复接收输入。Root 不执行 Navigation Close；关闭整个应用必须使用 `RuntimeLifecycleControl(destroyAppRuntime)`。

`destroyAppRuntime` 先拒绝新控制/导航/输入；若当前 foreground，则按 Page onHide -> App onHide 结束可见性，再按栈顶到 Root 执行 Page onDestroy 和强制资源清理，最后执行 App onDestroy、释放 Provider/Engine/Package 并返回 `completed(destroyed)`。Hook/Host 清理失败均记录但不阻塞最终释放；重复 destroy 返回 `LIFECYCLE_BUSY` 或已销毁错误，不得重复 Hook。

未提交 Surface、Present 失败或 AppRuntime teardown 的普通销毁顺序固定为：

```text
mark closing / reject new input
  -> Page onHide, only if currently visible
  -> Page onDestroy
  -> unregister Handler and cancel page requests
  -> release Page VM
  -> destroy Host Tree / Surface Host
  -> release Runtime Tree / Core PageContext
```

Navigation Close 为原子视觉事务，按本节前述顺序先完成 Platform close/reveal，再发送 target Hook 并释放已经移除的页面资源；它不重复执行普通 `DestroySurfaceHost` 路径。

同一 Hook 不得重入；已销毁 Page 的排队 Event、Render、Navigation 和 Capability result 统一取消或返回 `SURFACE_NOT_FOUND`。

## 6. 线程与失败

JS Framework 在同一 JS Executor Thread 内直接串行执行 `onCreate/onInit/onReady`。Core Runtime Thread 对前后台、可见性和销毁状态发出 immutable `LifecycleDispatch(requestId, scope, surfaceId?, hook, sequence)`；JS 执行 `onShow/onHide/onDestroy` 并返回同 requestId/scope/hook/sequence 的 `LifecycleResult(completed | failed)`。App Dispatch 不携带 `surfaceId`，Page Dispatch 必须携带。每个 Dispatch 只完成一次。

本地初始化也由 Core 通过 immutable `VmInitializationDispatch(requestId, scope, surfaceId?)` 启动。JS 返回同 requestId/scope/surfaceId 的 `VmInitializationResult(completed | failed)`；App failure 的 `failedPhase` 只能是 `onCreate`，Page failure 只能是 `onInit/initialEvaluation/onReady`。Core 对 App failure 终止 AppRuntime，对 Page failure 销毁未提交 Surface；两者都不得等待超时猜测结果。

Runtime Host 只通过 `RuntimeLifecycleControl(requestId, enterForeground | enterBackground | destroyAppRuntime)` 驱动 AppRuntime。Core 完成或拒绝后返回同 requestId/action 的 `RuntimeLifecycleControlResult`；三个 Platform Host 不得自行定义私有前后台入口。Core 不在 Runtime Thread 同步等待 Platform UI Thread。

Hook 抛异常时返回 `JS_EXCEPTION` 并记录 Trace：

- `onCreate`、`onInit`、`onReady` 失败：首屏失败，不执行后续 Hook。
- `onShow`、`onHide` 失败：状态转换不回滚，Runtime 继续运行。
- `onDestroy` 失败：继续强制释放资源，禁止阻塞销毁。

每条 Trace 至少包含 `surfaceId`、Hook、sequence、start/end、status；App Hook 不携带 `surfaceId`。

## 7. V1 Context

Context 是 Runtime 提供给 JS Framework 和 CapabilityInvoker 的 immutable 运行环境，不是业务 state store。

```text
AppContext
  packageId
  versionName / versionCode
  runtimeVersion
  declaredCapabilities[]

PageContext = SurfaceContext
```

`declaredCapabilities` 是已校验 Manifest features 的不可变投影，不再重复传递完整 Manifest。AppContext 在 AppRuntime 创建时生成，在 App Bundle 交付前通过 `onAppContext` 发送，并保持到销毁。V1 不定义第二个 PageContext 消息；Capability 调用所需 PageContext 就是 [SurfaceContext](./surface-control.md#2-surfacecontext)。`params` 受 RuntimeValue 约束，所有字段跨线程时复制或共享不可变存储。

JS App/Page 的 mutable data 与 Binding state 不属于 Context。`ServiceContext` 只保留名称和扩展位置，V1 不创建实例、不提供跨页面 Context Store。

## 8. 机器合同

`AppContext`、`VmInitializationDispatch/Result`、`LifecycleDispatch/Result` 和 Runtime Host Control 统一见 [lifecycle.schema.json](./schemas/lifecycle.schema.json)。`SurfaceContext` 见 [surface-control.schema.json](./schemas/surface-control.schema.json)。
