# CORE-S05 实现任务

## 目录

- [1. 结论](#1-结论)
- [2. 前置门禁](#2-前置门禁)
- [3. 任务](#3-任务)
- [4. 完成定义](#4-完成定义)

## 1. 结论

实现顺序必须先建立唯一 Store 和 ID/LogicalRef 不变量，再做静态实例化、Block、mutation 和 Handler delta；不能先用另一棵临时树跑通流程后再收敛。

## 2. 前置门禁

- CORE-S05 分 Spec 独立校审为 PASS。
- 工作看板将 CORE-S05 标记为 CODE_ALLOWED。
- CORE-S01 实现保持 VERIFIED，CORE-S02 至少提供已通过校审的 `PageIrHandle` 合同；联调前 S02 实现必须 VERIFIED。
- 公共 Runtime Tree/Block/ID 合同没有未关闭 P0 冲突。

## 3. 任务

| ID | 任务 | 依赖 | 主要证据 |
|---|---|---|---|
| CORE-S05-T01 | 建立 Runtime Tree 模块、资源 limits 和依赖扫描 | 门禁 | Core-only build/scan |
| CORE-S05-T02 | 实现 RuntimeNode、LogicalNodeRef、双向索引和 Surface-scoped NodeId allocator | T01 | uniqueness/lookup tests |
| CORE-S05-T03 | 实现 RuntimeTreeStore、immutable PageIrHandle 持有和结构快照 | T02 | single-store tests |
| CORE-S05-T04 | 实现 sparse TreeMutation、overlay lookup、预算预留和 discard | T03 | no-full-clone/rollback tests |
| CORE-S05-T05 | 实现 page scope 静态实例化和初始 active Block plan | T04 | static fixture tests |
| CORE-S05-T06 | 实现 InstantiateBlock、keyed reuse、nested block 和 tombstone | T05 | block lifecycle tests |
| CORE-S05-T07 | 实现 RemoveBlock、MoveBlock、slot/scope/final-index 校验 | T06 | remove/reorder tests |
| CORE-S05-T08 | 实现结构 Handler ownership ledger、add/remove delta 和 EventBindingCommitParticipant 合同/Fake | T06-T07 | ownership boundary tests |
| CORE-S05-T09 | 实现 PreparedTreeCommit、内部 commit authority、generation guard、两侧预留后的无失败 apply 和回滚防护 | T08 | atomic apply tests |
| CORE-S05-T10 | 接入 Runtime Node counter、Fake Page IR、OOM/超限/冲突故障注入 | T09 | counter/equivalence tests |
| CORE-S05-T11 | 完成 teardown、资源归零、Release 与 sanitizer 验证 | T10 | teardown + ASan/TSan |
| CORE-S05-T12 | 生成实现证据并更新 Handoff，等待实现复核 | T11 | evidence 文档 |

## 4. 完成定义

- [ ] 静态页面和嵌套 Block 可在一个 Store 中确定实例化。
- [ ] keyed reuse 保持 ID，remove 后 ID 永不复用，move 使用 final-index 语义。
- [ ] 所有失败和 rollback 后 committed Store、索引、ownership、counter 不变。
- [ ] mutation 内存与变更量相关，不复制完整 Runtime Tree。
- [ ] S05 代码不读取 ZIP/JSON/Bundle，不出现平台或具体执行引擎依赖。
- [ ] Handler callback/dispatch 状态不进入 S05。
- [ ] Release、ASan/UBSan、TSan、依赖扫描和资源归零全部通过。
