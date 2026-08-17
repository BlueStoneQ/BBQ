# LV-S03 设计

## 目录

- [1. 结论](#1-结论)
- [2. 架构与所有权](#2-架构与所有权)
- [3. 内部对象](#3-内部对象)
- [4. Admission 与结果](#4-admission-与结果)
- [5. 本地资源阶段](#5-本地资源阶段)
- [6. 五类命令](#6-五类命令)
- [7. LV-S04 协作边界](#7-lv-s04-协作边界)
- [8. 线程与原子可见性](#8-线程与原子可见性)
- [9. 失败、幂等与销毁](#9-失败幂等与销毁)
- [10. 资源与观测](#10-资源与观测)

## 1. 结论

LV-S03 采用：**bounded Surface command gateway + owner-thread SurfaceHostTable + 独立隐藏 page root + preflight/commit 原子操作。**

```text
Core owns intent and truth
LV-S03 validates local resources and executes
LVGL owns pixels, not navigation meaning
```

## 2. 架构与所有权

```text
Core Runtime Thread
  -> PlatformSurfacePort.post(move SurfaceCommand)
     -> fixed SurfaceOperationSlot
     -> LV-S01 OwnerTaskQueue

LVGL owner thread
  -> SurfaceHostTable
  -> PageRootFactory
  -> SurfaceContentLifecyclePort (由 LV-S04 后续实现)
  -> result stored in same operation slot
  -> CoreIngressPort.post(move SurfaceResult)
```

| 对象 | owner | 责任 | 不拥有 |
|---|---|---|---|
| Surface command gateway | producer-safe admission | 所有权转移、容量、close 线性化 | Surface 业务状态 |
| SurfaceOperationSlot | accepted command 生命周期 | command、一次 result、涉及 Surface 集合 | 第二条 result queue |
| SurfaceHostTable | LVGL owner thread | 映射、本地资源阶段、busy bit | route/Navigation/Page lifecycle |
| PageRootFactory | LVGL owner thread | hidden root create/delete/reset | Host Tree 语义 |
| SurfaceContentLifecyclePort | LVGL owner thread | Mount readiness、content preflight/commit release | Surface 展示决策 |
| CoreIngressPort | Core queue | immutable Result 回流 | UI 执行 |

## 3. 内部对象

### 3.1 SurfaceHostRecord

```text
SurfaceHostRecord
  SurfaceId
  PageRootHandle          // 仅 LVGL Platform 内部
  viewport
  LocalResourcePhase
  controlBusy
  lastRequestId
  lastTerminalResult
```

`lastRequestId/lastTerminalResult` 只识别紧邻 replay，不形成业务历史。`PageRootHandle` 只能在 owner thread 的同步 lease 内使用。

### 3.2 OperationSlot

```text
free
  -> admitted(command, affectedSurfaceIds)
  -> queued
  -> executing
  -> resultPending
  -> free
```

- accepted 后 slot 在 Result 成功进入 Core queue 前不可复用。
- push/close 的 `affectedSurfaceIds` 包含两个 ID，并按稳定 ID 顺序 reservation。
- slot 不持有 Runtime 裸指针，只持有可关闭的 `CoreIngressPort` 句柄。

## 4. Admission 与结果

`PlatformSurfacePort.post`：

1. 校验 command typed union 与字段，但不调用 LVGL。
2. 以有界、producer-safe 操作保留一个 operation slot。
3. 验证同一 RequestId 不是冲突 payload，并保留涉及 Surface 的 control admission。
4. 把 owner task 投递 LV-S01 queue。
5. 只有 2-4 全部成功才 move 所有权并返回 accepted；否则回滚 reservation，返回 typed Enqueue error。

accepted 后规则：

- owner task 必须生成一个公共 success/failed Result。
- Result 先写回原 slot，再尝试 `CoreIngressPort.post`。
- Core queue full 时每个 owner turn最多重试一次；不复制 Result、不占用新 slot。
- CoreIngress 已关闭时释放 Result 并把 operation 记为 tombstoned；这只适用于 Runtime teardown 后的晚到结果。

## 5. 本地资源阶段

```text
absent
  -> create -> hidden-empty
  -> full Mount committed by LV-S04 -> hidden-mounted
  -> present -> visible

visible <-> hidden

hidden-empty | hidden-mounted | visible | hidden
  -> destroying -> absent
```

该阶段只回答“本地 root 是否存在、是否已有完整 content、当前是否带 hidden flag、能否安全删除”。Core 的 lifecycle/health/Navigation 仍是唯一权威。

## 6. 五类命令

### 6.1 Create

```text
validate viewport + capacity + SurfaceId absent
  -> allocate root
  -> disable LVGL layout
  -> set hidden before publication
  -> publish record(hidden-empty)
  -> created
```

任何一步失败都删除临时 root，映射保持 absent。窗口或 DisplayBackend 不由本命令创建。

### 6.2 Present root

preflight 要求 target=`hidden-mounted`、root 有效且无 content release。commit 只清除 root hidden flag；该操作不分配内存且在 owner task 内不可失败。preflight 失败返回 `SURFACE_PRESENTATION_FAILED`，target 不变。

### 6.3 Present push

preflight 同时验证：

- source 与 target 不同。
- source=`visible`，target=`hidden-mounted`。
- 两个 root 有效且已被本 operation reservation。
- 从 commit 到下次 display flush 之间不会运行其他 owner task。

commit 顺序固定为 target visible、source hidden，然后同时更新两个本地阶段。两次 LVGL flag 写入均是 preflight 后的 no-fail mutation；display 只观察提交后的整体状态。Platform 不保存二者的栈关系。

### 6.4 Visibility

- `visible -> visible`、`hidden -> hidden` 是成功 no-op。
- `visible <-> hidden` 只切换 root flag。
- `hidden-empty/hidden-mounted` 不得被 visibility 命令越级展示。
- 不触发 JS Hook，不改变 route 或 predecessor。

### 6.5 Close 与 Destroy

close preflight：closing=`visible`、reveal=`hidden`、两个 root 有效、content release token 可获得。commit 在同一 owner task 中：

1. no-fail 释放 closing 的 listener/mapping/content。
2. 删除 closing root 与 record。
3. 清除 reveal hidden flag并更新为 visible。
4. 返回 completed。

Destroy 只处理一个 Surface；content preflight 失败时返回 failed 并进入 container reset。reset 丢弃可寻址 mapping、递归删除能够访问的 root，并保留结构化错误，禁止残留恢复。

## 7. LV-S04 协作边界

LV-S03 只冻结项目内部语义，不实现 LV-S04：

```text
SurfacePageRootAccess.withRoot(surfaceId, owner-thread callback)
SurfaceContentLifecyclePort.markFullMountCommitted(surfaceId)
SurfaceContentLifecyclePort.prepareRelease(surfaceId) -> ReleaseToken | failed
ReleaseToken.commitNoFail()
```

- `withRoot` 只在 owner task 当前栈有效，不能缓存 handle。
- full Mount 失败不改变 `hidden-empty`；成功后才变 `hidden-mounted`。
- `prepareRelease` 不修改 root、mapping 或 listener；成功 token 的 commit 不分配且不得失败。
- incremental Mount、full rebuild 和 Node mapping 全由 LV-S04 定义。

## 8. 线程与原子可见性

| 路径 | 线程 | 数据 |
|---|---|---|
| command post | Core producer | move-only immutable typed command |
| command execute | LVGL owner | page root、本地 mapping 与阶段 |
| content hook | LVGL owner | 短生命周期内部 lease/token |
| Result post | owner -> Core queue | immutable typed Result |

push/close 的“原子”是可观察帧原子：preflight 不修改对象，commit 在一个 owner task 内完成，DisplayBackend 只能在该 task 结束后 flush。

## 9. 失败、幂等与销毁

| 情况 | 处理 |
|---|---|
| duplicate create | `SURFACE_HOST_ALREADY_EXISTS`，旧 root 不变 |
| missing host | `SURFACE_HOST_NOT_FOUND` |
| root allocation/capacity | `OUT_OF_MEMORY` |
| present preflight | `SURFACE_PRESENTATION_FAILED` |
| queue capacity | post 未 accepted，`QUEUE_OVERFLOW` |
| owner/Port stopped | post 未 accepted，typed closed/rejected |
| 相同 RequestId replay | 不重复 side effect；pending 复用同一 operation，最近完成 replay 匹配同一 Result |
| visibility 已是目标值 | completed no-op |
| destroy 中的新命令 | rejected，不复活 record |

关闭顺序：

```text
close admission
  -> owner drain accepted operations
  -> resolve/tombstone pending Results
  -> preflight + release all content
  -> delete all page roots
  -> close CoreIngress handle
  -> assert table/slots/live roots == 0
```

## 10. 资源与观测

所有表和 slot 按 Build Profile 固定容量构造，不运行期扩容。至少维护：

- live page roots。
- pending Surface operations。
- pending Results。
- reset/destroy failures。
- queue overflow 与 rejected command。

Trace 使用 `SurfaceId/RequestId/status/error/timestampNs`；不得在热路径格式化文本或执行 I/O。
