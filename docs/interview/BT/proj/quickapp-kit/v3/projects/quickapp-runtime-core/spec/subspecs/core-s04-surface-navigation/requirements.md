# CORE-S04 需求

## 目录

- [1. 结论](#1-结论)
- [2. Surface 需求](#2-surface-需求)
- [3. Navigation 需求](#3-navigation-需求)
- [4. 原子性与失败](#4-原子性与失败)
- [5. 质量需求](#5-质量需求)
- [6. 非目标](#6-非目标)
- [7. 需求追踪](#7-需求追踪)

## 1. 结论

Surface 和路由的本质是一套 Core 逻辑状态机加一组 Platform 执行命令：Platform 不维护权威路由，Core 不假定命令成功，成功同步点只有 matching typed Result。

## 2. Surface 需求

| ID | 需求 |
|---|---|
| S04-R01 | 每个 AppRuntime 只有一个 `SurfaceController`、一个 `SurfaceIdAllocator` 和一张 `SurfaceRecord` 表；SurfaceId 生命周期内不复用。 |
| S04-R02 | Surface lifecycle 固定为 `creating -> awaitingTemplate -> mounting -> presenting -> visible/hidden -> destroying -> destroyed`；health 固定为正交的 `normal -> degraded -> failed`。 |
| S04-R03 | 每个 Surface 只保存一个 optional committed Revision；首棵 Runtime Tree 成功提交时设为 `0`，以后只能由授权提交点单调加一。首提交前不发送 `SurfaceStatusChanged`；revision 0 后首个可发送状态固定为 `presenting`。 |
| S04-R04 | 每个 Surface 最多一个 render cycle、一个 Platform Surface command；冲突操作在发出下游命令前拒绝。 |
| S04-R05 | Core 分配 SurfaceId、解析 verified route/Page IR、创建 hidden Host、发送 SurfaceContext，再经 S03 完成 page Module/VM 初始化。 |
| S04-R06 | Root 创建只在 AppRuntime foreground 且权威栈为空时接受；成功语义固定为首屏已 Mount、Platform Present 成功且 Root 已提交栈。 |
| S04-R07 | lifecycle/health/Revision、in-flight slots、PageIrHandle、RuntimeTreeStore ownership 和 Platform host existence 只在同一 SurfaceRecord 聚合，不建立镜像状态表。 |
| S04-R08 | Surface destroy 后保留 SurfaceId tombstone 到 AppRuntime teardown；所有晚到消息返回/记录 `SURFACE_NOT_FOUND`，不得复活。 |

## 3. Navigation 需求

| ID | 需求 |
|---|---|
| S04-R09 | 每个 AppRuntime 只有一个 Core Navigation 栈；栈只保存已提交 SurfaceId，未提交 target 只属于一个 pending operation。 |
| S04-R10 | 同一 AppRuntime 最多一个 Navigation operation；并发 Push/Close 返回 `NAVIGATION_BUSY`。 |
| S04-R11 | Push 只接受当前 visible top 作为 source；Core 解析 route 并创建未提交 target，任何失败保持 source 和栈不变。 |
| S04-R12 | Push Present success 后，Core 原子提交 source hidden、target visible 和 stack push，再排队 source `onHide`、target `onShow` 与成功 Result。 |
| S04-R13 | Close 只接受 visible 非 Root 栈顶；reveal 固定为直接前驱，不允许调用方选择或跳层。 |
| S04-R14 | Close Platform success 后，Core 原子 pop source 并提交 predecessor visible，再执行 source `onHide/onDestroy`、predecessor `onShow` 和 source 资源释放。 |
| S04-R15 | Root 不执行 Navigation Close；AppRuntime destroy 通过 S03 调用 S04 自顶向下 teardown，不恢复中间页面可见性。 |

## 4. 原子性与失败

| ID | 需求 |
|---|---|
| S04-R16 | Present/Close 前必须预留 Core commit、Hook dispatch 和 Result 所需有界资源；Platform success 后的内存 commit 不分配、不可失败。 |
| S04-R17 | Platform Create/Present/Visibility/Close/Destroy 每个 command 使用新 Core RequestId，Result 必须匹配 RequestId、kind、SurfaceId、mode/source/reveal 和当前 epoch。 |
| S04-R18 | Present failure 销毁未提交 target，先向仍存活 Page Context 交付 Instantiate failure，再释放 Page VM/Tree/Host；source 不触发 Hook。 |
| S04-R19 | Close failure 不改栈、不发 Hook，恢复 source 接收输入；Platform destroy failure 仍提交逻辑 destroyed/tombstone 并要求外围 reset。 |
| S04-R20 | health/rebuild 由后续 Mount owner报告；S04 只保存权威 health、执行 gate 和 failed Surface 清理，不实现 rebuild。 |
| S04-R21 | Surface 创建、展示、可见性、导航、失败和销毁发出结构化 Trace；`surfaceLive` 只随 SurfaceRecord 真实生命周期变化。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 单一权威 | Surface 表、Navigation 栈、RuntimeTreeStore 各有唯一 owner；Platform 状态只是命令结果事实。 |
| 原子性 | Platform success 后的 Core route/visibility commit 不得因 OOM 或队列容量失败。 |
| 内存 | pending target 只持有该 target 的必要 handle/资源；不得复制完整树或 Page IR。 |
| 线程 | Core Runtime Thread 唯一修改 Surface/Navigation；Port callback 只提交 immutable Result。 |
| 可测试 | Fake S03、Fake initial pipeline 和 Fake Platform 可停在每个阶段、注入每个失败。 |
| 可移植 | 只使用公共 command/result 和 Port，不包含具体容器或 UI 对象语义。 |

## 6. 非目标

- 不实现 Runtime Tree mutation、Render validation、Style/Layout、Measure、Mount 或 Event。
- 不解析源码 DSL、ZIP、JSON 或未验证 Bundle。
- 不执行 JS Hook，不持有 JS function。
- 不提供任意 remove、历史跳转、页面缓存、多窗口或动画。
- 不维护 Platform Host Tree 或第二棵 Runtime Tree。

## 7. 需求追踪

| 上级合同 | 本分 Spec |
|---|---|
| Surface Control / Platform Surface | R01-R08、R16-R21 |
| Navigation | R09-R19 |
| Application Lifecycle | R05-R06、R12-R15、R18 |
| ID / Error / Observation | R01、R03-R04、R08、R10、R17、R19-R21 |
| CORE-S02/S03/S05 | R05-R07、R18、R20 |
