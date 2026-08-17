# JS-S04 App/Page VM 与 Lifecycle：任务

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. 任务清单](#3-任务清单)
- [4. 完成定义](#4-完成定义)

## 1. 结论

未来实现按“Context -> VM controller -> initialization -> lifecycle -> completion -> teardown/证据”推进。当前只冻结任务，不创建产品代码。

## 2. 门禁

- JS-S01/JS-S02 保持 `VERIFIED`。
- JS-S03 设计校审通过；真实连接前关闭 `P0-JS-EXPORT-001`。
- 本分 Spec 独立校审 `PASS` 且工作看板显式 `CODE_ALLOWED`。
- 不启动 JS-S05，不修改公共合同或 Schema。

## 3. 任务清单

### JS-S04-T01：定义 VM/Lifecycle 边界

1. 定义 Context records、VM handles/controllers、limits/resources。
2. 定义 `PageInitializationStagePort` 与 Fake Stage。
3. 定义 Dispatch ledger/outbox closed types。

**完成定义**：public header 无 QuickJS、Core state、Platform、Binding/Render/Handler 类型。

### JS-S04-T02：实现 Context Registry

1. AppContext/SurfaceContext typed consumer。
2. immutable ownership、fingerprint、duplicate/conflict/fault。
3. RuntimeValue limits、closing/tombstone。

**完成定义**：Context 不可替换、不成为 mutable state store，teardown 后归零。

### JS-S04-T03：实现唯一 VM Controller

1. 一个 AppVmController 与 SurfaceId map。
2. S03 handle/lease acquire、generation 和 release。
3. Executor-bound VM Value、状态机和 downstream handle。

**完成定义**：同 Surface 不创建第二 VM，不同 Surface 不共享 VM/state。

### JS-S04-T04：实现 App initialization

1. admission/completion slot/preconditions。
2. create/install/onCreate/microtask checkpoint。
3. success/failure phase、回滚和 ready publish gate。

**完成定义**：onCreate 最多一次；failed 无 VM/handle；Result accepted 后才发布。

### JS-S04-T05：实现 Page initialization

1. create/install/onInit。
2. Fake/real `PageInitializationStagePort` 调度点。
3. initialEvaluation/onReady/final checkpoint。
4. phase-specific failure 与 no Render/Instantiate gate。

**完成定义**：固定顺序可由 Trace/spy 证明；失败不执行后续阶段。

### JS-S04-T06：实现 lifecycle Hook

1. scope/surface/sequence/visibility projection admission。
2. show/hide Hook 与失败后 projection commit。
3. destroy Hook、强制释放和 S03 lease release。
4. 不维护 Core stack/state。

**完成定义**：Hook 恰好一次；destroy failure 资源仍归零。

### JS-S04-T07：实现 Ledger 与 Completion Outbox

1. initialization/lifecycle payload fingerprint。
2. duplicate/collision/out-of-order/reentry/late generation。
3. immutable Result、overflow retry、terminal Port close。
4. Page init Result 与未来 Instantiate 的 publish 顺序门禁。

**完成定义**：背压不重跑 Hook；每个 accepted dispatch 最多一个 terminal completion。

### JS-S04-T08：实现 Surface/App teardown 与 limits

1. normal/failed-init/forced Surface teardown。
2. residual Page -> App -> S03 -> JS-S01 顺序。
3. capacity/OOM/queued callback race。
4. Context/VM/ledger/outbox/Value 计数归零。

**完成定义**：晚到消息不复活 Surface；S04 无栈排序逻辑。

### JS-S04-T09：合同测试与证据

1. Fake Engine/QuickJS 共用 VM/Lifecycle suite。
2. Debug、Release、ASan/UBSan、TSan、API-only。
3. boundary scan、Noop/Recording、资源快照、源码摘要。
4. R01-R22/A01-A50 映射和 Handoff。

**完成定义**：全部证据可复现；未实现 JS-S05 或任何 Core/Platform 逻辑。

## 4. 完成定义

- 22 条需求和 50 个验收项全部关闭。
- App/Page VM 数量、Hook 次数、sequence、Result 与资源可观测。
- Fake/QuickJS 的顺序、异常、重复和销毁语义一致。
- 没有第二 Bridge、Core Surface 栈、Binding/Render/Handler 或平台代码。
