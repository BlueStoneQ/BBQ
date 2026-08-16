# JS Runtime 总 Spec：总体架构

## 目录

- [1. 结论](#1-结论)
- [2. 组件架构](#2-组件架构)
- [3. 状态与依赖模型](#3-状态与依赖模型)
- [4. 关键主流程](#4-关键主流程)
- [5. Runtime ABI](#5-runtime-abi)
- [6. 线程、生命周期与清理](#6-线程生命周期与清理)
- [7. 跨项目边界](#7-跨项目边界)

## 1. 结论

JS Runtime 采用**JS Framework + 可替换 Engine Service + Page VM + 依赖索引 + 增量事务构造器**架构。JS 层保留动态语义所需的最小状态，不复制 C++ Runtime Tree。

## 2. 组件架构

```text
JsExecutor
  -> JsEnginePort
       -> QuickJsEngineProvider(V1)
  -> ModuleRegistry/Loader/Cache
  -> AppVmController
  -> PageVmController(surfaceId)
      -> ReactiveState
      -> BindingRegistry
      -> BlockRegistry
      -> HandlerRegistry
      -> RenderTransactionBuilder
  -> TypedModuleFacade
  -> RuntimeAbiClient
  -> ObservationEmitter(shared TraceSink + MonotonicClock)
  <- RuntimeAbiCallbacks
```

| 组件 | 拥有 | 不拥有 |
|---|---|---|
| JsEnginePort | eval/module/call/microtask/value/exception/GC 的引擎无关合同 | 任一引擎 handle 或平台对象 |
| QuickJS Provider | QuickJS runtime/context/value 生命周期与 Port 实现 | JS Framework/Core/Platform 状态 |
| Module Loader | VerifiedModulePort、define/bootstrap/require、expected export 校验与 module cache | Package 文件读取、Page IR |
| App VM | App state、methods、Hook | 页面状态 |
| Page VM | 页面 state、props、methods、Hook | Runtime NodeId |
| Binding Registry | StatePath -> evaluator/target 依赖 | Runtime Tree |
| Block Registry | 条件/list 当前实例与 key -> BlockInstanceId | Block 内 Runtime nodes |
| Handler Registry | HandlerId -> JS function/method、live/retiring/released | Core EventBinding |
| ABI Client | typed encode/decode、request/result 关联 | 业务反射路由 |
| ObservationEmitter | Module/Hook/Handler/Dirty/ABI 的结构化事实 | 文件 I/O、文本日志、Collector、Core 状态 |

## 3. 状态与依赖模型

```text
state Proxy.set(path, value)
  -> update Page VM state
  -> lookup dependent Binding/Block
  -> mark dirty
  -> schedule one microtask checkpoint
```

Binding Registry 按 `TemplateBindingId` 保存 evaluator；evaluator 执行时由 `state Proxy.get` 收集 StatePath 依赖。运行期保存 Owner、依赖和最后已提交值，相等值可在 JS 侧消除无效更新。JS 生成 `UpdateBinding(ownerInstanceId, templateBindingId, value)`，不持有 target descriptor。

Block Registry 保存条件实例或 keyed 列表实例顺序，用于计算 create/remove/move，不构建节点树。块内真实节点只存在 Core Runtime Tree。

## 4. 关键主流程

### 4.1 App 与页面启动

```text
AppContext -> Core LoadVerifiedModule(app/shared) -> define/bootstrap/export verify -> loaded Result
  -> VmInitializationDispatch(app) -> App VM/onCreate -> InitializationResult
SurfaceContext + Core LoadVerifiedModule(page, expected IDs)
  -> define/bootstrap/export verify -> loaded Result
  -> VmInitializationDispatch(page) -> create Page VM/state/methods
  -> onInit
  -> evaluate initial Binding/Block/Handler
  -> onReady
  -> one microtask checkpoint
  -> InitializationResult(completed) -> InstantiateTemplate
  -> any init failure: InitializationResult(failed), no InstantiateTemplate
```

### 4.2 更新

```text
dirty checkpoint
  -> evaluate dirty Binding/Block only
  -> compare last committed semantic value/order
  -> build ordered Render operations
  -> submit revision n+1
  -> wait Result
  -> presented/presentationFailed: advance committed snapshots; release retiring Handler
  -> rejected/cancelled: restore retiring Handler to live; never guess Core state
```

### 4.3 事件

```text
JsEventDispatch
  -> verify Surface live and HandlerId live|retiring; released drops
  -> invoke mapped method with typed event
  -> capture JS exception
  -> microtask checkpoint
  -> optional Render/Capability/Navigation request
```

## 5. Runtime ABI

V1 QuickJS Provider 的 External Function 只承担绑定入口；其他 Engine Provider 必须映射到同一 Runtime ABI：

```text
JS value
  -> strict typed decoder
  -> immutable public message
  -> Core enqueue
```

同步 `EnqueueResult(ok)` 只表示入队；Promise/callback 必须等待同 request/transaction 的异步 Result。所有 pending 请求按 Surface 或 AppRuntime 归属，销毁时统一取消。

## 6. 线程、生命周期与清理

所有 Engine、VM、state、Binding 和 Handler 操作串行归属 JS Executor Thread。Core 回调只入 JS 队列，不直接从 Core Runtime Thread 调用 JS。JS Framework 不接触 QuickJS handle；只有选中的 Provider 实现 `JsEnginePort`。

ObservationEmitter 在 JS Executor Thread 记录事实，并复用 Composition Root 注入的单调时钟与 TraceSink。它不是 Runtime ABI request，不参与 EnqueueResult、Revision 或业务成功条件。

销毁顺序：

```text
Core has stopped new input
  -> stop accepting event/result
  -> onHide(if needed) / onDestroy
  -> cancel pending requests and dirty flush
  -> clear Handler/Binding/Block registry
  -> release Page VM and page module instance
```

AppRuntime 销毁时再释放 Shared/App module cache、App VM 和 Engine。

## 7. 跨项目边界

| 项目 | JS Runtime 依赖/交付 |
|---|---|
| Toolkit | 执行冻结 Module ABI 与 evaluator/handler export，不解释 `.ux` |
| Core | 只从 VerifiedModulePort 接收 immutable bytes；Module、VM initialization 和 Lifecycle 各自使用 typed 异步闭环，不共享对象 |
| Platform | 无直接依赖；平台能力必须经 Core 路由 |
| Benchmark | 输出 Hook、Handler、Dirty、ABI 和 GC/内存观测点 |
