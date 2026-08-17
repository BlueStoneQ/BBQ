# JS-S04 App/Page VM 与 Lifecycle：验收

## 目录

- [1. 结论](#1-结论)
- [2. 验收环境](#2-验收环境)
- [3. Context 与所有权](#3-context-与所有权)
- [4. Initialization](#4-initialization)
- [5. Lifecycle](#5-lifecycle)
- [6. 重复、背压与销毁](#6-重复背压与销毁)
- [7. 范围与证据](#7-范围与证据)

## 1. 结论

JS-S04 通过标准是：同一 typed 输入序列在 Fake Engine 与 QuickJS 中产生相同 VM 数量、Hook 顺序、Result、异常和释放结果；任何重复、迟到或失败都不重建 VM、不重跑 Hook、不复制 Core 状态。

## 2. 验收环境

- Fake/QuickJS 共用 VM/Lifecycle Contract Suite。
- Fake S03 Module Catalog、Fake PageInitializationStagePort、Fake Core ingress。
- 可控制 Context/Dispatch 顺序、Hook 行为、microtask、背压、OOM 和 teardown。
- 每例检查 Hook log、VM/Context/ledger/outbox/lease/Value 计数。

## 3. Context 与所有权

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S04-A01 | 首个合法 AppContext | immutable 保存一次；App VM 尚未创建 |
| JS-S04-A02 | identical AppContext duplicate | no-op；record/能力/计数不增加 |
| JS-S04-A03 | conflicting AppContext | 首值不变、context fault；后续 init failed |
| JS-S04-A04 | 合法 SurfaceContext | 按 SurfaceId 保存；params 深不可变；Page VM=0 |
| JS-S04-A05 | identical/conflicting SurfaceContext | identical no-op；conflict fault 且不覆盖 |
| JS-S04-A06 | Surface close 后 Context | 丢弃；不创建新 generation/controller |
| JS-S04-A07 | AppContext 超 RuntimeValue/能力限制 | admission failed/fault；无 VM/泄漏 |
| JS-S04-A08 | 两 Surface 使用同 Page definition | Page VM 各一个，VM object/state 地址与写入互不影响 |
| JS-S04-A09 | 同 Surface 第二次创建 VM | rejected；原 VM/Hook ledger 不变 |
| JS-S04-A10 | handle 边界扫描 | 无 QuickJS handle、S03 cache 容器、Core/Platform state 暴露 |

## 4. Initialization

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S04-A11 | 合法 App initialization | create/install -> onCreate -> checkpoint -> Result；各一次 |
| JS-S04-A12 | App 无 onCreate | no-op success；VM 创建一次 |
| JS-S04-A13 | App 缺 Context/module 或 context fault | failedPhase=onCreate；VM/handle=0 |
| JS-S04-A14 | onCreate throw | `JS_EXCEPTION/onCreate`；后续阶段无执行；资源释放 |
| JS-S04-A15 | 合法 Page initialization | install -> onInit -> initialEvaluation -> onReady -> final checkpoint 顺序精确 |
| JS-S04-A16 | Page 无 onInit/onReady | 对应 no-op，Stage 顺序仍成立 |
| JS-S04-A17 | Page 缺 Context/lease/代际错 | failedPhase=onInit；Page VM/Stage=0 |
| JS-S04-A18 | onInit throw | failedPhase=onInit；Stage/onReady=0 |
| JS-S04-A19 | initial Stage failed | failedPhase=initialEvaluation；onReady=0；cancel 一次 |
| JS-S04-A20 | onReady throw | failedPhase=onReady；final publish/handle=0 |
| JS-S04-A21 | final checkpoint/microtask failed | failedPhase=onReady；无普通 Render/Instantiate |
| JS-S04-A22 | initialization completion 暂时 overflow | VM/Hook 不重建；同一 Result 重投直到 accepted |
| JS-S04-A23 | Page completed 时刻 | 本地 ready notification 在 Result accepted 后；visible/onShow/Mount/Present 均为 0 |

## 5. Lifecycle

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S04-A24 | App onShow | created/background -> foreground；Hook/Result 各一次，无 surfaceId |
| JS-S04-A25 | App onHide | foreground -> background；原 request/hook/sequence 回显 |
| JS-S04-A26 | Page onShow | ready/hidden -> visible；只影响目标 Page VM |
| JS-S04-A27 | Page onHide | visible -> hidden；不修改其他 Page controller |
| JS-S04-A28 | show/hide Hook throw | failed(JS_EXCEPTION)，projection 仍推进，不自动重试 |
| JS-S04-A29 | onDestroy success | admission 先关；Hook 一次；VM/handle/lease 释放 |
| JS-S04-A30 | onDestroy throw | failed Result；资源仍归零；不可再次调用 Hook |
| JS-S04-A31 | App lifecycle 携带 surfaceId | rejected；Hook=0 |
| JS-S04-A32 | Page lifecycle 缺失/错误 surfaceId | `SURFACE_NOT_FOUND` 或 invalid；Hook=0 |
| JS-S04-A33 | sequence 递增但有间隔 | 按 FIFO 接受，不推导缺失 Core 状态 |
| JS-S04-A34 | sequence 相等/倒退 | 不执行 Hook；原 ledger/VM 不变 |
| JS-S04-A35 | 非法 visibility transition | `LIFECYCLE_BUSY`；不伪造 show/hide |
| JS-S04-A36 | 多 Surface push/close Hook 序列 | 严格按 Core dispatch FIFO；S04 无 top/predecessor/root 数据结构 |

## 6. 重复、背压与销毁

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S04-A37 | identical duplicate pending/terminal dispatch | Hook/VM/Result 不重复；只记录 duplicate |
| JS-S04-A38 | 同 RequestId 不同 payload | ABI violation；不消费原 record、不调用错误 Hook |
| JS-S04-A39 | Hook reentry dispatch | 当前 Hook 完成前新 Hook failed(LIFECYCLE_BUSY)，无嵌套调用 |
| JS-S04-A40 | completion queue overflow | immutable Result 留在 bounded outbox；Hook 不重跑；accepted 后只删除一次 |
| JS-S04-A41 | Surface close during queued init | generation 关闭；init/Stage 不发布 handle；late task 无 UAF |
| JS-S04-A42 | Surface close during queued lifecycle | owner recheck 丢弃/失败；Surface 不复活 |
| JS-S04-A43 | failed-init Surface teardown | 不调用 onDestroy 补偿；Context/VM/lease/ledger 归零 |
| JS-S04-A44 | forced upper teardown | 不伪造 Core Result；残余 Page 后 App 顺序释放 |
| JS-S04-A45 | AppRuntime teardown with multiple Pages | S04 不自行排序栈；关闭 admission 后全部残余资源归零 |
| JS-S04-A46 | limits/OOM fault injection | Hook 前失败或已执行 Hook 后保留预留 Result；无部分 VM/无静默丢 completion |

## 7. 范围与证据

| ID | 检查 | 通过条件 |
|---|---|---|
| JS-S04-A47 | thread test | Context、VM、Hook、Stage、microtask、Result、teardown 全在唯一 JS Executor；Core callback 不 inline |
| JS-S04-A48 | authority/boundary scan | 无 Core Surface/AppRuntime state machine、Navigation stack、Mount/Present、Binding/Render/Handler/Capability 实现或第二 Bridge |
| JS-S04-A49 | Observation 等价 | 只发公共 lifecycle marker；Noop/Recording 的 VM/Hook/Result/error/teardown 完全等价 |
| JS-S04-A50 | 完整证据 | Debug/Release/ASan/UBSan/TSan/API-only、资源归零、源码摘要、R01-R22 与 A01-A50 映射齐全 |

真实 S03 Bundle -> VM 连接必须等待 `P0-JS-EXPORT-001` 关闭；此前 Fake definition 只验证 S04 自身合同。
