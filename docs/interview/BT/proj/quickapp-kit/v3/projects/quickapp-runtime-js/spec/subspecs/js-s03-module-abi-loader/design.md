# JS-S03 Module ABI 与 Loader：设计

## 目录

- [1. 结论](#1-结论)
- [2. 边界与组件](#2-边界与组件)
- [3. VerifiedModulePort](#3-verifiedmoduleport)
- [4. Module ABI](#4-module-abi)
- [5. Cache 与所有权](#5-cache-与所有权)
- [6. 加载与依赖算法](#6-加载与依赖算法)
- [7. 状态、失败与重复](#7-状态失败与重复)
- [8. 销毁与资源上限](#8-销毁与资源上限)
- [9. 异常与观测](#9-异常与观测)
- [10. 已冻结合同](#10-已冻结合同)

## 1. 结论

S03 采用 **staging load transaction + committed definition/instance cache + Surface lease**：Bundle 求值期间产生的 define/bootstrap/export 全在 staging；只有完整校验成功才一次提交，失败只留下有界 terminal failure record。

```text
LoadVerifiedModule
  -> typed admission + completion slot reservation
  -> bytes length/SHA/UTF-8
  -> evaluate with Module ABI capture
  -> validate define/bootstrap/dependencies
  -> require/evaluate factory and validate exports
  -> atomic cache commit
  -> completeVerifiedModuleLoad
```

## 2. 边界与组件

```text
RuntimeAbiCallbacks(JS-S02)
  -> VerifiedModuleConsumer
      -> ModuleLoadCoordinator
          -> IntegrityGuard
          -> ModuleAbiHost
          -> ModuleDependencyResolver
          -> ModuleExportValidator
          -> ModuleCache
          -> LoadCompletionOutbox
  -> RuntimeAbiClient.completeVerifiedModuleLoad(JS-S02)
```

| 组件 | 唯一拥有 | 不拥有 |
|---|---|---|
| `VerifiedModuleConsumer` | typed callback slot 与 scope generation admission | Runtime ABI codec/queue |
| `ModuleLoadCoordinator` | load transaction、顺序和 terminal completion | Core Loader/Package |
| `ModuleAbiHost` | 当前 evaluation capture、Module ABI globals、factory invocation | VM/Hook/Capability 实现 |
| `ModuleCache` | definition、instance、failure、Page lease | Page VM/Runtime Tree |
| `ModuleExportValidator` | bootstrap/export 的语义校验与 immutable typed view | Page IR/target descriptor |
| `LoadCompletionOutbox` | 未被 Core ingress accepted 的唯一 completion record | S02 bridge correlation |

全部组件属于一个 AppRuntime，只在其 JS Executor 上访问。跨线程入口仍只有 JS-S02 callback queue。

## 3. VerifiedModulePort

### 3.1 输入不变量

S03 接收 JS-S02 已完成 wire/type 校验的 concrete `LoadVerifiedModule`：

```text
requestId, packageId
moduleKind, moduleId, dependencies
cacheScope, surfaceId?
bundle(path, byteLength, sha256, immutable bytes)
expectedBootstrap?
expectedBindingIds?, expectedHandlerIds?
```

S03 继续验证业务不变量：

- App/Shared 必须 `cacheScope=appRuntime` 且无 `surfaceId/expected IDs`。
- Page 必须 `cacheScope=surface` 且有 live Surface generation、Page bootstrap 和两个 expected ID 集合。
- App 必须有 App bootstrap；Shared 不得有 bootstrap。
- packageId 必须等于当前 AppRuntime packageId；moduleId 不得跨 package alias。
- bytes 实际长度与 SHA-256 必须匹配 message；logical path 只写入 source identity。

### 3.2 所有权

Core 与 JS 对 bytes 只共享 immutable storage，或在 callback admission 时一次转移所有权。S03 在 load terminal completion 被 S02 accepted 后释放 bytes；cache 只保存 identity、definition/factory/export handle 和校验摘要。

S03 不调用 `open/read/stat`，不根据 path 寻址任何外部资源。

### 3.3 Completion

每个 admitted load 在执行 Bundle 前预留一个 `LoadCompletionRecord`。Hook/Bundle 不因 Core ingress 暂时 `QUEUE_OVERFLOW` 重跑；Outbox 保留同一个 immutable Result，在 JS Executor 公平 continuation 中重投，accepted 后删除。Core Port terminal close 只在对应 scope teardown 后丢弃。Outbox 容量与 load transaction 容量相同，不动态扩容。

## 4. Module ABI

### 4.1 安装方式

`$app_define$/$app_bootstrap$/$app_require$` 是 trusted Framework Module Host 暴露给 Bundle 的 JS globals。实现可以由 Framework bootstrap JS 与 C++ `JsEnginePort` 协作，但必须满足：

- 不加入 JS-S02 的 14-entry Runtime ABI Catalog。
- 不使用 QuickJS 类型穿过 `JsEnginePort`。
- 不调用 Core/Platform，不产生 JSON 或 module/method/args Bridge。
- 每次 Bundle evaluation 都绑定一个不可伪造的 `LoadTransactionId`，ABI call 只能写当前 staging capture。

### 4.2 `$app_define$`

```text
$app_define$(moduleId, dependencies, factory) -> undefined
```

规则：

1. 当前 transaction 恰好一次。
2. moduleId 与 request 完全相等。
3. dependencies 是无重复 string array，顺序与 request 完全相等。
4. factory callable；其调用合同固定为 `factory($app_require$, $app_module$, $app_exports$)`。
5. `$app_module$.exports` 是最终 export 权威；`$app_exports$` 是初始 exports alias，factory return value不替代 `module.exports`。
6. load 外、重复或额外 module define 立即使当前 transaction 失败。

### 4.3 `$app_bootstrap$`

```text
$app_bootstrap$(moduleId, bootstrapMetadata) -> undefined
```

它只捕获 immutable bootstrap descriptor：

- App：`schemaVersion=1, kind=app, moduleId`。
- Page：再含 `templateId`。
- App/Page 恰好一次；Shared 零次。
- moduleId/templateId 必须与 expected bootstrap 完全一致。
- 不执行 factory、不创建 VM、不调用 `onCreate/onInit/onReady`。

### 4.4 `$app_require$`

解析顺序固定：

1. 当前 module 的 declared dependency，按精确 moduleId 查当前 AppRuntime cache。
2. closed Framework builtin specifier，交给 typed `FrameworkModuleResolverPort`。
3. 其他 specifier 返回 `MODULE_ABI_UNSUPPORTED`。

App/Shared/Page 业务模块不得通过 require 访问其他 Page definition。builtin resolver 只返回 JS facade，不直接调用 Core；JS-S09 将实现 router/prompt/device/fetch/page facade，S03 使用 Fake Resolver 验证解析边界。

### 4.5 Require 求值

Definition 与 Instance 分离。Shared definition load 成功可以保持 `defined`；第一次被 App/Page factory require 时进入 `evaluating`，成功后缓存 exports，后续返回同一 instance。App/Page factory 在自身 load transaction 中求值并验证 export。

active evaluation stack 命中同一 instance key 即为 cycle。V1 不支持 partial exports：参与中的 factory 不提交，当前顶层 load 失败，所有进入 failed 的 instance 保留 terminal failure。

## 5. Cache 与所有权

### 5.1 Identity

```text
BundleIdentity = packageId + moduleKind + moduleId
               + path + byteLength + sha256

ExpectationFingerprint(app)  = bootstrap
ExpectationFingerprint(shared) = none
ExpectationFingerprint(page) = bootstrap
                             + sorted expectedBindingIds
                             + sorted expectedHandlerIds
```

Cache key：

| 类型 | Key | Owner |
|---|---|---|
| App definition/instance | `AppRuntimeId + BundleIdentity + fingerprint` | AppRuntime |
| Shared definition/instance | `AppRuntimeId + BundleIdentity` | AppRuntime |
| Page definition/instance | `AppRuntimeId + BundleIdentity + fingerprint` | AppRuntime |
| Page lease | `SurfaceId + surfaceGeneration + moduleId + definitionGeneration` | Surface |
| Failure record | 对应完整 definition key | 对应 AppRuntime/Surface lease |

同 AppRuntime 中同一 `moduleId` 首次成功或确定性内容失败 identity 成为 canonical identity；后续不同 SHA/path/kind/fingerprint 视为冲突，不执行新 bytes。OOM、队列满、scope closed 和 teardown cancellation 不建立 canonical identity，恢复资源后允许重试。

### 5.2 Entry

```text
ModuleEntry
  key / generation / state
  moduleKind / orderedDependencies
  factoryRef
  exportsRef?
  bootstrapDescriptor?
  exportDescriptor?
  failure?
  surfaceLeases[]
```

`factoryRef/exportsRef` 是 Context-bound、Executor-bound `JsValueRef`。Page export 是创建独立 VM 所需的 immutable definition，不是 VM instance。S04 只能借用 generation-checked handle，不能直接访问 cache 容器。

### 5.3 Page 复用

第二个 Surface 请求相同 Page key 时：

1. 不重新求值 Bundle/factory。
2. 对当前 request 的 expected descriptor 与 committed fingerprint 再比较。
3. 创建新的 Surface lease。
4. 返回独立 load Result。

Surface teardown 只释放其 lease。V1 默认 Page definition 保留到 AppRuntime teardown；实现可在无 lease、无 VM handle 时 eviction，但 eviction 不改变语义，且再次 load 仍受 failed/conflict identity 规则约束。

## 6. 加载与依赖算法

### 6.1 Load 流程

```text
typed admission
  -> validate scope/package/cache key
  -> reserve transaction/completion/byte budget
  -> cache hit / loading join / identity conflict
  -> verify bytes
  -> create staging capture
  -> Engine evaluate
  -> validate exactly-one define/bootstrap rules
  -> commit definition to defined
  -> App/Page require own module
  -> validate exports/expected IDs
  -> atomically commit loaded entry + lease
  -> emit loaded Result
```

Shared load 在 definition 校验后可提交 `defined/loaded-definition`，factory 延迟到 require；App/Page 必须在 load Result 前获得并验证 exports。

### 6.2 Export 校验

Definition shape 直接消费公共 Artifact Contract `P0-JS-EXPORT-001`：

- App 只允许 own data property `schemaVersion`, `kind`, `createAppVm`；`kind="app"` 且 `createAppVm` callable。
- Page 只允许 own data property `schemaVersion`, `kind`, `createPageVm`, `bindingEvaluators`, `handlerMethods`；`kind="page"` 且 `createPageVm` callable。
- Definition、`bindingEvaluators` 和 `handlerMethods` 禁止 accessor、Proxy、原型继承注入和未知字段。
- evaluator callable，以对应 Page VM 为 `this`，唯一参数为只读 lexical `scope`；handler value 是非空 method name。实际求值/调用不属于 S03。
- evaluator/handler object 使用 canonical positive-decimal key；转换后比较数值 ID 集合。校验只消费 expected ID 集合，不读取 target/property/eventType/Page IR。

### 6.3 并发与顺序

所有 load 已串行进入 JS Executor，但多个 request 可逻辑同在途：

- 相同 key `loading`：后到 request 加入有界 waiter list，不重复 evaluate。
- 不同 key：按 callback admission sequence 处理。
- require 只同步访问已 committed definition；不发起 Core load、不等待 Core。
- unresolved declared dependency 使当前 App/Page factory 失败；Core 必须先交付依赖定义。

## 7. 状态、失败与重复

### 7.1 Entry 状态

```text
absent -> loading -> defined -> evaluating -> loaded
                   |            \-> deterministic failed
                   \-> transient rollback -> absent
loaded|deterministic failed -> releasing -> released
```

只有 `loading/evaluating` 的 staging 可回滚。`deterministic failed` 才是当前 identity 的 terminal cache state；transient failure 必须销毁 staging 并回到 `absent`。失败记录只保存结构化错误和 identity，不保存 bytes、临时 JS Value 或异常对象。

### 7.2 Request ledger

`requestId -> payload fingerprint + scope generation + terminal Result` 使用有界 ledger：

- 首次：创建 transaction 或加入相同 key waiter。
- duplicate identical pending：不增加第二个 waiter/求值。
- duplicate identical terminal：不重发 Result，只记录 duplicate。
- 同 RequestId 不同 payload：拒绝并记录 ABI violation。
- scope generation 已关闭：drop，不创建 cache/lease。

### 7.3 失败分类

| 失败 | RuntimeError |
|---|---|
| message/module/bootstrap/export/dependency/cycle 不匹配 | `MODULE_ABI_UNSUPPORTED`，确定性内容失败，可缓存 |
| bytes 长度/SHA 不匹配 | `PACKAGE_INTEGRITY_FAILED` |
| UTF-8/parse 或可证明由固定 Bundle/resolver 输入产生的 factory 异常 | `JS_EXCEPTION`，确定性时可缓存 |
| 无法证明内容确定性的 Engine/Factory 异常 | `JS_EXCEPTION`，transient，回滚后可重试 |
| 必要分配失败 | `OUT_OF_MEMORY`，transient，不缓存 |
| transaction/waiter/byte/outbox 容量满 | `QUEUE_OVERFLOW`，transient，不缓存 |
| Surface 已关闭或 teardown cancellation | `SURFACE_NOT_FOUND`/cancellation，transient，不缓存 |

失败 Result 使用原 requestId/moduleKind/moduleId/surfaceId，并在 staging 清理后才提交到 Outbox。

## 8. 销毁与资源上限

### 8.1 Surface

```text
close Surface module admission
  -> invalidate generation
  -> cancel/join pending page load waiter
  -> discard not-yet-accepted Surface completion on terminal Port close
  -> release Page lease
  -> release Page handle after S04 VM teardown
```

S03 不执行 Page Hook；S04 必须先释放 VM handle，再通知 S03 release lease。

### 8.2 AppRuntime

```text
stop module admission
  -> cancel load transactions/waiters
  -> S04 releases all VM handles
  -> release Page leases/entries
  -> release App/Shared exports then factories
  -> clear failure/request ledgers and outbox
  -> return to JS-S01 teardown barrier
```

### 8.3 Limits

`ModuleLoaderLimits` 至少冻结：

- max definitions / instances / Page leases。
- max active loads / waiters per key / request ledger entries。
- max dependencies per module / evaluation depth。
- max retained loading bytes / single Bundle bytes。
- max expected Binding/Handler IDs。
- max completion outbox records。

所有计数在 terminal/teardown 后归零；不依赖 GC 才释放 C++ ownership。

## 9. 异常与观测

Engine exception 在当前 transaction 内提取并清除，不污染下一模块。只有确定性内容失败保存 `RuntimeError`；transient failure 的 RuntimeError 只属于本次 request，不进入 canonical failure cache。

S03 只使用公共 `module.load.started/completed/failed`；cycle、cache hit、failure cache hit 和 release 若公共 Catalog 无专用 marker，只通过已有 terminal marker 与轻量计数表达，不创建私有同义 marker。所有事件使用 `producer=js`、run-relative integer `timestampNs`、RequestId/SurfaceId；Noop 与 Recording 行为等价。

## 10. 已冻结合同

公共 Artifact Contract 已冻结 `P0-JS-EXPORT-001` 的机器形态、`createAppVm/createPageVm` callable、binding evaluator 的 `this/scope` 和 `handlerMethods`。S03 直接按该合同校验并生成 immutable typed Definition view；S04 只消费 Definition，不重复解释导出对象。
