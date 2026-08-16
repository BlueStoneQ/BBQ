# JS Runtime 总 Spec：分 Spec 索引

## 目录

- [1. 结论](#1-结论)
- [2. 分 Spec 清单](#2-分-spec-清单)
- [3. 依赖关系](#3-依赖关系)
- [4. 并行策略](#4-并行策略)
- [5. 启动门禁](#5-启动门禁)

## 1. 结论

JS Runtime 按 Engine、Module、VM、Reactive、Event 和 typed API 分解；所有分 Spec 共享同一 JS Executor 所有权和 Runtime ABI，不得各自创建跨层通道。

## 2. 分 Spec 清单

| ID | 分 Spec | 责任 | 主要输出 | 依赖 |
|---|---|---|---|---|
| JS-S01 | JS Engine Service | `JsEnginePort`、Fake Engine 合同测试、QuickJS Provider 及其 External Function Adapter、Engine 生命周期、任务队列、value/exception 转换、单调时钟与本地 ObservationEmitter 接入 | Engine Port + QuickJS Provider | 公共 Observation Contract |
| JS-S02 | Runtime ABI Client | 基于 `JsEnginePort` Native Function Binding 的 typed codec、`EnqueueResult`、request/result 关联 | ABI Client/Callbacks | JS-S01 |
| JS-S03 | Module ABI 与 Loader | VerifiedModulePort、define/bootstrap/require、expected export 校验、App/Shared/Page cache | Module Loader | JS-S01、JS-S02 |
| JS-S04 | App/Page VM 与 Lifecycle | AppContext/SurfaceContext、VmInitializationDispatch/Result、LifecycleDispatch/Result、Hook、销毁 | VM Controllers | JS-S03 |
| JS-S05 | Reactive Binding | state proxy、依赖、Dirty、microtask flush | Binding Runtime | JS-S04 |
| JS-S06 | Block Runtime | if、keyed for、BlockInstanceId、ordered Block plan；不直接提交 Core | Block Registry/Plan | JS-S04、JS-S05 |
| JS-S07 | Render Transaction Builder | 合并 Binding/Block/Handler snapshot，唯一提交 initial/Render ABI，管理 Revision 与结果 | Render Client | JS-S02、JS-S05、JS-S06、JS-S08 |
| JS-S08 | Handler 与 Event | HandlerId、Binding snapshot、Registry retirement、Dispatch、异常和清理 | Event Runtime | JS-S02、JS-S04 |
| JS-S09 | Typed Module 与 Page API | router push/back、prompt/device、fetch deferred facade、supports、Page Control、Promise/callback | JS Facades | JS-S02、JS-S04 |
| JS-S10 | JS Runtime Verification | Fake Core、Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` Bundle fixtures、平台/外围反向依赖检查、Noop/Recording 观测等价、内存/异常负例、Observation marker | 集成证据 | JS-S03 至 JS-S09、公共 Observation Contract |

## 3. 依赖关系

```text
JS-S01 -> JS-S02 -> JS-S03 -> JS-S04
                         |      -> JS-S05 -> JS-S06 -> JS-S07
                         |      -> JS-S08 -----------> JS-S07
                         |      -> JS-S09
                         -> JS-S10 持续集成
```

## 4. 并行策略

- Module Loader 与 ABI codec 在 `JsEnginePort` 合同和 QuickJS Provider 通过同一合同测试后可并行。
- Reactive Binding、Handler、typed Facade 在 VM 生命周期稳定后可并行。
- Render Builder 是 Binding/Block 的唯一跨 Core 输出，不允许各模块直接调用 Core。
- JS-S08 先提供 immutable HandlerBinding snapshot；JS-S07 将它并入 InstantiateTemplate/InstantiateBlock，并根据 Handler/Render Result 提交或回滚 retirement。

## 5. 启动门禁

总 Spec 通过后才写分 Spec。每个分 Spec 必须冻结 JS 对象所有权、线程、销毁、异常和 typed message；通过后才允许编码。
