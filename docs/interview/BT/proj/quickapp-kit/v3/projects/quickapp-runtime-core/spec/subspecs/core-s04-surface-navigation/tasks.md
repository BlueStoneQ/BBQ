# CORE-S04 实现任务

## 目录

- [1. 结论](#1-结论)
- [2. 前置门禁](#2-前置门禁)
- [3. 任务](#3-任务)
- [4. 完成定义](#4-完成定义)

## 1. 结论

实现必须先建立 Surface 表、状态/槽和唯一 Navigation 栈，再接 Platform command；不得由平台容器回调反推或重建 Core 路由状态。

## 2. 前置门禁

- CORE-S04 分 Spec 校审为 `PASS`，工作看板标记 `CODE_ALLOWED`。
- CORE-S03 实现已 `VERIFIED`；CORE-S02/S05 保持 `VERIFIED`。
- 状态通知规则已冻结：revision 0 前不发送 `SurfaceStatusChanged`，首个可发送状态为 `presenting`。
- CORE-S06/S07/S08 未实现时使用 Fake initial/render pipeline 和 Fake commit authority。

## 3. 任务

| ID | 任务 | 依赖 | 主要证据 |
|---|---|---|---|
| CORE-S04-T01 | 建立 SurfaceController、limits、SurfaceId allocator/tombstone 和依赖扫描 | 门禁 | ID/limit tests |
| CORE-S04-T02 | 实现 SurfaceRecord lifecycle/health/revision/slots 与 revision 0 后状态通知门禁 | T01 | state-machine/status tests |
| CORE-S04-T03 | 实现唯一 Navigation stack、generation、pending operation 和 snapshot | T02 | stack authority tests |
| CORE-S04-T04 | 实现 Platform Surface Port correlation、multi-surface lock 与 Fake | T03 | command/result tests |
| CORE-S04-T05 | 接入 verified route/Page IR 与 S03 Page lifecycle service | T04 | route/page-init tests |
| CORE-S04-T06 | 实现 Root 创建状态机和失败清理 | T05 | root tests |
| CORE-S04-T07 | 实现 RenderPermit、commit authority 边界和 Fake initial pipeline | T06 | revision/gate tests |
| CORE-S04-T08 | 实现 Push pending target、prepared commit 和原子 stack push | T07 | push atomicity tests |
| CORE-S04-T09 | 实现 Close prepared commit、原子 pop/reveal、Hook/释放顺序 | T08 | close atomicity tests |
| CORE-S04-T10 | 实现 foreground collaborator、destroyAll、health gate 和 tombstone | T09 | lifecycle/teardown tests |
| CORE-S04-T11 | 接入 Trace、surface counter、OOM/overflow/late Result 故障注入 | T10 | observation/failure tests |
| CORE-S04-T12 | 完成 Release、sanitizer、资源归零和实现证据，更新 Handoff | T11 | review package |

## 4. 完成定义

- [ ] Surface/health/Revision/slots 只有一张权威记录表。
- [ ] Root/Push/Close 的 Platform success 后 Core commit 无分配、不可失败。
- [ ] Push 任一点失败不改变 source/stack；Close failure 恢复 source input。
- [ ] Platform command/result 全部按 RequestId、字段和 epoch 严格关联。
- [ ] destroyed/tombstoned Surface 不复活，全部 Page/Tree/Host 资源确定释放。
- [ ] 不存在第二 Navigation 栈、第二 Runtime Tree 或平台私有路由语义。
- [ ] Release、ASan/UBSan、TSan、OOM、overflow、依赖扫描和资源归零通过。
