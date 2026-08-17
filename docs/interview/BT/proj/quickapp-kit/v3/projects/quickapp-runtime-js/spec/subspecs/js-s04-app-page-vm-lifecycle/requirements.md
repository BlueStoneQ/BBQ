# JS-S04 App/Page VM 与 Lifecycle：需求

## 目录

- [1. 结论](#1-结论)
- [2. 问题本质](#2-问题本质)
- [3. 输入与输出](#3-输入与输出)
- [4. 功能需求](#4-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 需求映射](#6-需求映射)
- [7. 非目标](#7-非目标)

## 1. 结论

VM Lifecycle 必须把 Core 的 typed 意图转换为确定的本地 Hook 序列：**Context 与 Module Definition 都就绪后才能初始化；Core 已提交生命周期边界后才执行 show/hide；destroy 无论 Hook 成败都必须最终释放。**

## 2. 问题本质

S04 只解决：

1. 哪个对象唯一拥有 App/Page VM。
2. 初始化和可见性 Hook 以什么顺序、次数和线程执行。
3. 异常、重复、迟到和 teardown 如何不重入、不复活、不泄漏。

## 3. 输入与输出

| 方向 | 合同 |
|---|---|
| 输入 | AppContext、SurfaceContext、S03 module handle、VmInitializationDispatch、LifecycleDispatch |
| 输出 | typed initialization/lifecycle Result、VM handle、Observation |
| 禁止 | 第二 Bridge、Core Surface 栈、Mount/Present 决策、Binding/Render/Handler 实现 |

## 4. 功能需求

| ID | 需求 |
|---|---|
| JS-S04-R01 | S04 必须通过 JS-S02 固定 typed callback slot 接收 Context/Dispatch；不得注册另一套 Core callback、JSON RPC 或 External Function。 |
| JS-S04-R02 | 一个 AppRuntime 只允许一个 immutable AppContext；每个 Surface generation 只允许一个 immutable SurfaceContext。Context 不是 mutable state store，不包含完整 Manifest、Page IR 或平台对象。 |
| JS-S04-R03 | identical duplicate Context 必须幂等；同 owner/generation 的 conflicting Context 必须记录 local context fault，后续 initialization 返回 typed failure，不覆盖首个 Context。 |
| JS-S04-R04 | 一个 AppRuntime 只拥有一个 `AppVmController/App VM`；每个 live `SurfaceId + generation` 只拥有一个 `PageVmController/Page VM`，不同 Surface 即使使用同一 Page definition 也不得共享 VM/state。 |
| JS-S04-R05 | VM 创建必须 acquire JS-S03 generation-checked definition/lease；S04 不读取 Bundle/cache 容器，不执行 `$app_define$/$app_bootstrap$/$app_require$`。 |
| JS-S04-R06 | App initialization 前置条件固定为 AppContext + loaded App definition + absent App VM；Page 固定为 SurfaceContext + loaded Page lease + absent Page VM。缺失/错代际不得部分创建 VM。 |
| JS-S04-R07 | App initialization 顺序固定为 create/install App VM -> `onCreate` -> bounded microtask checkpoint -> completed Result；`onCreate` 每 AppRuntime 最多一次。 |
| JS-S04-R08 | Page initialization 顺序固定为 create/install state+methods -> `onInit` -> `initialEvaluation` -> `onReady` -> bounded final checkpoint -> completed Result；每阶段最多一次。 |
| JS-S04-R09 | `initialEvaluation` 只通过 typed `PageInitializationStagePort` 调度后续 Binding/Block/Handler 模块；S04 不实现 evaluator、HandlerId 或 Render，并且初始化期间不得发送普通 RenderTransaction。 |
| JS-S04-R10 | App failure 的 `failedPhase` 只能是 `onCreate`；Page failure 只能是 `onInit/initialEvaluation/onReady`。失败不得执行后续阶段、不得发送 Instantiate，并必须释放未提交 VM 资源。 |
| JS-S04-R11 | `onReady`/initialization completed 只表示 VM 与初始动态数据准备完成；S04 不标记 Core Surface visible，不触发 `onShow`，不返回 Create/Navigation success。 |
| JS-S04-R12 | `LifecycleDispatch` 只接受 `onShow/onHide/onDestroy`，App 不携带 surfaceId，Page 必须携带 live SurfaceId；RequestId、scope、hook、sequence 必须原样回显。 |
| JS-S04-R13 | 每个 App VM/Page VM 的 accepted lifecycle sequence 必须严格单调增加；duplicate、out-of-order、同 RequestId collision 或 Hook 重入不得再次调用 Hook。允许 sequence 有间隔，不要求连续。 |
| JS-S04-R14 | `onShow/onHide` 只有在本地 VM delivery state 允许时调用；该 state 只用于 Hook 防重，不是 Core lifecycle/health 权威，也不得推导或维护 Navigation 栈。 |
| JS-S04-R15 | `onShow/onHide` 抛异常时返回 `JS_EXCEPTION`，但本地 delivery state 仍推进以镜像 Core 已提交边界；不得回滚 Core/Platform 状态或自动重调 Hook。 |
| JS-S04-R16 | `onDestroy` 每 VM 最多一次；调用前关闭该 VM 的新 Hook/后续模块 admission，调用失败仍强制释放 VM、Context 引用和 S03 handle/lease。 |
| JS-S04-R17 | 每个 accepted initialization/lifecycle Dispatch 只能产生一个 immutable terminal business Result；S02 只负责投递，S04 独立拥有 request ledger、Hook 终态和 completion outbox。 |
| JS-S04-R18 | Core ingress 暂时 `QUEUE_OVERFLOW` 时不得重跑 Hook；S04 必须保留有界 completion record 并公平重投。Port terminal close 仅在 owner teardown 后取消。 |
| JS-S04-R19 | Surface teardown 必须先关闭 Context/Dispatch admission，再取消 pending initialization/completion、停止后续模块访问、释放 Page VM 和 S03 lease；late message 不得复活 Surface。 |
| JS-S04-R20 | AppRuntime teardown 必须拒绝新 Context/Dispatch，释放所有残余 Page VM，再释放 App VM/module handle/request ledger/outbox，最后返回 JS-S01 teardown barrier。S04 不决定 Page 栈销毁顺序。 |
| JS-S04-R21 | VM、Surface controller、Context RuntimeValue nodes、request ledger、completion records、Hook/microtask budget 必须由 immutable config 限制；容量满时不部分初始化、不静默丢 accepted Hook。 |
| JS-S04-R22 | 全部 VM/Hook 操作只在 JS Executor 执行；Core callback 只入队。Observation 只使用公共 `lifecycle.hook.started/completed/failed` 和结构化字段，Noop/Recording 不改变行为。 |

## 5. 质量需求

- 唯一所有权：App VM 1 个，Page VM 每 Surface 1 个。
- 串行：无 Core Thread -> JS 同步调用，无并行 Page JS Thread。
- 幂等：重复 Context/Dispatch 不重建 VM、不重跑 Hook。
- 失败可收敛：init fail 不留 VM；destroy fail 仍释放。
- 分层：本地 delivery state 不升级为 Core 状态或 Surface 栈。
- 可验证：Fake Engine/QuickJS 共用 VM/Lifecycle suite。

## 6. 需求映射

| 需求范围 | 设计章节 | 任务 | 验收 |
|---|---|---|---|
| R01-R05 | 2-4 | T01-T03 | A01-A10 |
| R06-R11 | 5 | T04-T05 | A11-A23 |
| R12-R18 | 6-7 | T06-T07 | A24-A39 |
| R19-R22 | 8-9 | T08-T09 | A40-A50 |

## 7. 非目标

- 不实现 Module Loader、Bundle cache 或 Module ABI。
- 不实现 Proxy/Binding/Block/Handler/Render/Capability facade。
- 不创建 Runtime Tree、Host Tree、Surface Host 或 Navigation 栈。
- 不决定 Core foreground/background/visible/hidden/health 状态。
- 不实现多 JS Thread、ServiceContext 或跨页面 mutable Context Store。
- 不启动 JS-S05 产品设计或编码。
