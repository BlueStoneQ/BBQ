# CORE-S04 设计

## 目录

- [1. 结论](#1-结论)
- [2. 组件与所有权](#2-组件与所有权)
- [3. Surface 状态](#3-surface-状态)
- [4. Revision 与单在途](#4-revision-与单在途)
- [5. Root 创建](#5-root-创建)
- [6. Navigation Push](#6-navigation-push)
- [7. Navigation Close](#7-navigation-close)
- [8. Platform command/result](#8-platform-commandresult)
- [9. 原子提交](#9-原子提交)
- [10. 失败恢复与销毁](#10-失败恢复与销毁)
- [11. S03 与后续流水线边界](#11-s03-与后续流水线边界)
- [12. 线程、内存与观测](#12-线程内存与观测)
- [13. 边界不变量](#13-边界不变量)

## 1. 结论

采用一个 AppRuntime-scoped `SurfaceController` 聚合 Surface 表和 `NavigationController`。所有跨层流程都是 prepare -> Platform execute -> matching Result -> no-fail Core commit；未提交 target 从不进入权威栈，失败时可整体丢弃。

## 2. 组件与所有权

```text
AppRuntimeController (S03)
  owns SurfaceController (S04)
       owns SurfaceIdAllocator + tombstones
       owns SurfaceTable<SurfaceId, SurfaceRecord>
       owns NavigationController
            owns committed stack<SurfaceId>
            owns optional NavigationOperation
       borrows PlatformSurfacePort
       uses PageLifecycleService (S03)
       uses VerifiedPackage route/PageIr/Module handles (S02)
       uses RuntimeTreeStore per Surface (S05)
       reserves Initial/RenderPipeline boundary (S06-S08)
```

`SurfaceRecord` 是唯一 Surface 聚合：

```text
SurfaceRecord
  surfaceId / route / immutable params / viewport
  lifecycle / health / optional committedRevision
  hostState: absent | hiddenEmpty | hiddenMounted | visible | hidden | destroyed
  surfaceCommandSlot / renderSlot / operationEpoch
  PageIrHandle / pageVmToken / optional RuntimeTreeStore
  acceptingInput
```

`hostState` 只记录已确认的 Platform 执行事实，用于 command precondition；它不是权威 Navigation 栈，也不保存平台对象。

## 3. Surface 状态

### 3.1 Lifecycle

```text
creating
  -> awaitingTemplate
  -> mounting
  -> presenting
  -> visible <-> hidden
  -> destroying
  -> destroyed
```

| 状态 | 已成立事实 |
|---|---|
| creating | SurfaceId/record 已创建，Host create 可能在途 |
| awaitingTemplate | hidden Host、SurfaceContext、Page VM 已准备，等待首屏 intent |
| mounting | initial tree/layout/mount 流水线在途 |
| presenting | revision 0/full Mount 已提交到 hidden Host，Present 在途 |
| visible/hidden | 已进入权威栈，可接受合法运行消息 |
| destroying | gate 关闭，Hook/Host/resource cleanup 在途 |
| destroyed | record 不再 live，只保留 tombstone |

### 3.2 Health

```text
normal -> degraded -> normal
normal|degraded -> failed
```

health 与 lifecycle 正交。后续 Mount owner 通过不可伪造的内部 authority 报告 degraded/recovered/failed；S04 保存状态并执行 gate。`failed` 拒绝新 Render/Event/Navigation，并进入清理；S04 不执行 full rebuild。

## 4. Revision 与单在途

```text
committedRevision = none                 before initial tree commit
committedRevision = 0                    initial tree commit
committedRevision = n + 1                authorized incremental commit
```

S04 保存 Revision 与 gate；后续 S08 是唯一提交执行者。S04 发出 move-only `RenderPermit(surfaceId, baseRevision, operationEpoch)`，只有持有内部 `SurfaceCommitAuthority` 的 S08 可以在同一 Core turn 提交新 Revision 并清空 render slot。

wire 通知规则已冻结：`committedRevision=none` 期间不发送 `SurfaceStatusChanged`；首棵树提交 revision 0 且 lifecycle 进入 `presenting` 后，才允许发送第一条状态消息。Schema 保持非负整数，`0` 只表示真实首个 committed Revision，不表示“尚未提交”。

每个 Surface 有两个独立但互斥受控的槽：

- `surfaceCommandSlot`：最多一个 Create/Present/Visibility/Close/Destroy command。
- `renderSlot`：最多一个 Instantiate/Render -> Layout -> Mount cycle。

creating/destroying、Present/Close/Destroy 时禁止新 render；render/Mount 在途时 Close/Destroy 先关闭 ingress，再按 teardown 规则取消或等待到可销毁边界。每个 AppRuntime 另有一个 `navigationSlot`，保证栈事务串行。

## 5. Root 创建

Root 只在 AppRuntime=`foreground`、stack empty、无 root operation 时接受：

```text
CreateSurfaceRequest(host requestId)
  -> validate package/route/params/viewport and reserve operation
  -> allocate SurfaceId; insert creating record
  -> S02 resolve verified PageIrHandle + page Module
  -> Platform CreateSurfaceHost(core requestId, hidden)
  -> created: hostState=hiddenEmpty
  -> enqueue SurfaceContext
  -> S03 load/initialize Page VM
  -> completed: lifecycle=awaitingTemplate
  -> receive InstantiateTemplate
  -> acquire initial RenderPermit; lifecycle=mounting
  -> future pipeline commits unique RuntimeTreeStore + revision 0 + full Mount
  -> lifecycle=presenting; hostState=hiddenMounted
  -> prepare root commit and Page onShow dispatch
  -> Platform PresentSurfaceHost(mode=root)
  -> presented: no-fail commit stack=[root], root=visible
  -> enqueue Page onShow
  -> enqueue InstantiateTemplateResult(presented, 0)
  -> enqueue CreateSurfaceResult(presented)
```

Create Host、Page init、Instantiate、Mount 或 Present 任一步失败都关闭 gate并销毁未提交 Surface；权威 stack 保持 empty。上层 `CreateSurfaceResult` 复用 Host requestId，内部每个 command 使用独立 Core RequestId。

## 6. Navigation Push

只接受 AppRuntime foreground、`source == stack.top`、source visible/normal/idle：

```text
NavigationPush(JS requestId, source, uri, params)
  -> normalize/resolve verified route; reserve navigation operation
  -> allocate uncommitted target Surface
  -> run target Create Host + SurfaceContext + Page VM + initial pipeline
  -> target revision 0 mounted hidden
  -> prepare push commit + Hook/Result capacity
  -> Platform PresentSurfaceHost(mode=push, source, target)
  -> presented: no-fail commit source=hidden,target=visible,stack.push(target)
  -> enqueue source onHide, target onShow
  -> enqueue target InstantiateTemplateResult(presented, 0)
  -> enqueue NavigationPushResult(presented)
  -> release navigation slot
```

`NavigationOperation` 持有 source/target、origin RequestId、阶段、child correlation 和 prepared commit；target 不进入 stack，直到 Present Result 成功。Push 失败先交付 target Instantiate failure，再执行 target Page destroy/Host destroy，source 的 lifecycle、hostState、Hook 次数和 stack 全部不变。

## 7. Navigation Close

只接受 AppRuntime foreground、source 为 visible 非 Root top、存在直接 predecessor：

```text
NavigationClose(origin requestId, source)
  -> reserve navigation slot; source.acceptingInput=false
  -> predecessor = stack[-2], validate hidden
  -> prepare pop/reveal commit + Hook/Result capacity
  -> Platform CloseSurfaceHost(source, reveal=predecessor)
  -> completed: no-fail commit stack.pop, source=destroying, predecessor=visible
  -> enqueue source onHide
  -> enqueue source onDestroy
  -> enqueue predecessor onShow
  -> after source destroy Hook terminal: release Page VM/Tree/record to tombstone
  -> enqueue NavigationCloseResult(closed, predecessor)
  -> release navigation slot
```

Platform Close 已原子删除 source Host 并 reveal predecessor，成功后不得再发 `DestroySurfaceHost(source)`。Hook failure 不回滚栈；`onDestroy` failed 后仍释放。Close Result 发给 request origin 使用的 typed sink，RequestId 原样保留。

Close failure 清空 prepared commit 和 navigation slot，恢复 `source.acceptingInput=true`；stack、hostState、lifecycle 和 Hook 次数不变。

## 8. Platform command/result

| Command | 锁定对象 | matching 校验 |
|---|---|---|
| Create | target | RequestId、target、created/failed、epoch |
| Present root | target | RequestId、target、mode=root、epoch |
| Present push | source + target | RequestId、target、mode=push、source、两侧 epoch |
| Visibility | current top | RequestId、target visibility、epoch |
| Close | source + reveal | RequestId、两 Surface、reveal、epoch |
| Destroy | target | RequestId、target、epoch |

发命令前建立 correlation 和锁定槽；enqueue 失败立即撤销槽且不改变已提交状态。Result 入队到 Core Runtime Thread 后才能推进；重复、错误 kind/字段、旧 epoch 和 tombstoned target 都按 late/stale 丢弃并记录。

## 9. 原子提交

Platform Present/Close 的成功不可回滚，因此 Core 在发命令前构造：

```text
PreparedSurfaceCommit
  expected stack generation
  expected Surface epochs/states
  pre-reserved Hook dispatch records
  pre-reserved Result records
  no-throw state mutations
```

提交条件在 Result 到达时再次验证；由于相关 Surface/stack 已锁定，generation 不应变化。若内部不变量仍不匹配，视为 Core invariant failure：停止 AppRuntime 并进入确定性 teardown，不能假装 Platform 失败或建立第二栈修补。

正常 commit 在一个 Core Runtime Thread turn 内完成，不分配、不调用 Port：更新 stack、Surface lifecycle/hostState、input gate 和 operation generation。commit 后再把预留的 immutable Hook/Result 放入对应队列。

## 10. 失败恢复与销毁

### 10.1 未提交 Surface

```text
close input/render gate
-> deliver pending Instantiate failure while Page Context lives
-> S03 Page onDestroy, if Page VM initialized
-> cancel page correlations and release Page VM
-> clear Event/Tree resources if created
-> Platform DestroySurfaceHost, if Host exists
-> release PageIrHandle/record; retain SurfaceId tombstone
```

Destroy Host failed 也进入 logical destroyed；外围负责 reset，不允许旧 SurfaceId 恢复。

### 10.2 已提交 Surface

- 普通非 Root top 由 Navigation Close 销毁。
- AppRuntime teardown 由 S03 调用 `destroyAll`；S04 按 top-to-root 关闭 ingress、Page onDestroy、资源与 Host，不 reveal 中间页面。
- degraded/failed 的恢复策略由后续 Mount owner决定；failed 终态交给 S04 清理，Navigation 栈不能保留已 destroyed Surface。
- Surface 释放后 `surfaceLive` 减一；Node/Handler/Tree counter 由其唯一 owner 归零，S04 不重复记账。

### 10.3 错误映射

| 场景 | 对外错误 |
|---|---|
| message/状态/来源字段非法 | `ABI_INVALID_ARGUMENT` |
| Surface 未知、destroyed 或 tombstoned | `SURFACE_NOT_FOUND` |
| Surface degraded/failed | `SURFACE_DEGRADED` / `SURFACE_FAILED` |
| route 不存在 | `ROUTE_NOT_FOUND` |
| Navigation slot 在途 | `NAVIGATION_BUSY` |
| source 不是合法 visible top、Root Close 或栈关系非法 | `NAVIGATION_FAILED` |
| Root Present 失败 | `SURFACE_PRESENTATION_FAILED` |
| Push Present 或 target pipeline 失败 | `NAVIGATION_FAILED`，原始 typed cause 进入 Trace |
| Platform 非展示命令拒绝 | 命令 Result 携带的公共 typed error；缺省为 `PLATFORM_REJECTED` |
| 预留 OOM/queue overflow | `OUT_OF_MEMORY` / `QUEUE_OVERFLOW`，不发 Platform command |

## 11. S03 与后续流水线边界

### 11.1 S03

S04 读取 S03 的 immutable AppRuntime state snapshot，并调用：

```text
loadAndInitializePage
dispatchPageHook
destroyPageVm
cancelPageOperations
```

S04 决定 Page lifecycle 转换和 Hook 时机；S03 执行 typed JS dispatch。S04 实现 S03 的 `queryTop/setTopVisibility/destroyAll` collaborator，但不修改 AppRuntime state。

### 11.2 S05-S08

- S05 为每个 Surface 提供唯一 RuntimeTreeStore；S04 只持有其唯一 owner handle。
- S06 消费 RenderPermit 并 stage mutation；不改 Revision/lifecycle。
- S07 计算 Layout；不改 Surface/stack。
- S08 持有 commit authority，提交唯一 Tree/Revision 和 Mount outcome，再向 S04报告 mounted/degraded/failed。

候选 mutation、Layout result、MountTransaction 和未提交 target 都是短期事务数据，不是第二棵长期权威树。

## 12. 线程、内存与观测

- Surface/stack/slots/correlation 只在 Core Runtime Thread 修改。
- route、params、viewport、Page IR 和 command/result 跨线程时复制或共享 immutable 存储。
- Platform Adapter 只得到 ID 与 typed value，不得到 SurfaceRecord、stack、RuntimeTreeStore 或地址。
- 所有表、stack、pending operation、预留队列和 tombstone 有 AppRuntime limits；超限在 Platform command 前失败。
- Trace 覆盖 create/present/visibility/push/close/destroy accepted、command/result、commit、failure 和 late message。
- 测试 snapshot 提供 stack IDs、每个 Surface 的 lifecycle/health/revision/slots、pending navigation 和 live/tombstone counts。

## 13. 边界不变量

1. 一个 AppRuntime 只有一个 Surface 表、一个 Navigation 栈和一个 navigation slot。
2. stack 只包含已提交 Surface；pending target 不进入 stack。
3. Platform success 后只执行预留完成、不可失败的 Core state commit。
4. Revision 由 S04 保存，只能由授权 Tree/Mount 提交点推进。
5. S04 不复制 AppRuntime lifecycle，不执行 JS，不实现 Render/Layout/Mount/Event。
6. 每个 Surface 只有一个 S05 RuntimeTreeStore；Platform Host Tree 不是 Core 权威。
7. destroyed Surface 永不复活，SurfaceId 到 AppRuntime teardown 前不复用。
8. revision 0 前不发送 `SurfaceStatusChanged`；首个可发送 lifecycleState 只能是 `presenting`。
