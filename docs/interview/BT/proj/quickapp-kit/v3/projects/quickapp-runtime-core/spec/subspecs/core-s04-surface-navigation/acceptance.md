# CORE-S04 验收

## 目录

- [1. 结论](#1-结论)
- [2. Surface 与 Revision](#2-surface-与-revision)
- [3. Root 与 Push](#3-root-与-push)
- [4. Close 与 Lifecycle](#4-close-与-lifecycle)
- [5. 失败、线程与资源](#5-失败线程与资源)
- [6. 边界扫描](#6-边界扫描)
- [7. 证据](#7-证据)

## 1. 结论

验收通过的含义是：Fake Platform 停在任一命令前后时，Core 的 Surface 表和 Navigation 栈都保持可解释且唯一；不存在“平台已成功但 Core 因分配失败无法提交”的正常路径。

## 2. Surface 与 Revision

| ID | 场景 | 预期 |
|---|---|---|
| S04-S01 | 连续创建/销毁多个 Surface | SurfaceId 单调不复用，销毁后 tombstone 保留到 AppRuntime teardown |
| S04-S02 | 完整 lifecycle | 只走合法状态边，health 与 lifecycle 正交 |
| S04-S03 | 首树提交前/后 | internal Revision 为 none/0；后续只由 authority 单调推进 |
| S04-S04 | 两个并发 render | 第二个在下游执行前拒绝，只有一个 render slot |
| S04-S05 | Surface command 在途再发 command | 第二个不投递 Platform，状态不变 |
| S04-S06 | 错误/重复/晚到 Result | 不推进 lifecycle/stack/revision，产生 stale/late Trace |

## 3. Root 与 Push

| ID | 场景 | 预期 |
|---|---|---|
| S04-R01 | foreground + empty stack 创建 Root | hidden create -> Page init -> revision 0/full Mount -> Present -> stack/root visible -> success |
| S04-R02 | 非 foreground 或 stack 非空创建 Root | typed failure；不分配 live target 或不发 Platform command |
| S04-R03 | Root 任一阶段失败 | stack empty；target failure/Hook/Host cleanup 顺序正确；资源归零 |
| S04-P01 | visible top 正常 Push | target 在 Present 前不入栈；成功后 source hidden/target visible/stack push 同时可见 |
| S04-P02 | route 不存在 | `ROUTE_NOT_FOUND`，不创建 target Host，source 不变 |
| S04-P03 | Create/Page init/Instantiate/Mount/Present 分别失败 | source/stack/Hook 次数不变；target 最终 tombstone |
| S04-P04 | 并发 Push/Close | `NAVIGATION_BUSY`，只有一个 NavigationOperation |
| S04-P05 | 非 top、hidden、degraded/failed source | 请求失败，不发 target Platform command |
| S04-P06 | Present success 后注入普通 allocator failure | prepared commit 仍完成；不存在 Platform/Core 分叉 |

## 4. Close 与 Lifecycle

| ID | 场景 | 预期 |
|---|---|---|
| S04-C01 | visible 非 Root top Close | Platform atomic close/reveal -> Core pop/visible -> Hooks -> source release -> closed Result |
| S04-C02 | Root Close | 请求失败，Root/stack 不变 |
| S04-C03 | 非 top 或 reveal 非直接前驱 | 请求失败，不发 Platform Close |
| S04-C04 | Platform Close failed | stack/lifecycle/Hook 不变，source 恢复 acceptingInput |
| S04-C05 | Close 后 Hook failed | stack不回滚；source 仍释放；错误可观测 |
| S04-C06 | AppRuntime destroy 三层栈 | top-to-root 销毁，不 reveal 中间 Surface，最终 stack empty |
| S04-C07 | S03 foreground/background collaborator | 只操作当前 top；S04 不改 AppRuntime state；matching completion 返回 S03 |

## 5. 失败、线程与资源

1. 每个 Platform command 的 enqueue failure、typed failure、字段不匹配、重复和 teardown late Result 都有测试。
2. 在 prepared commit 每个预留点注入 OOM/overflow：命令尚未发出、状态不变；命令发出后成功路径无分配。
3. 非 Core Runtime Thread 写 Surface/stack/slot 必须被 API 结构禁止或 debug assertion 捕获。
4. destroy Host failed 后逻辑 Surface 仍 destroyed/tombstoned，晚到消息不能寻址；reset requirement 可观测。
5. teardown 后 `liveSurfaces=0`、`stackDepth=0`、`pendingNavigation=0`、`pendingSurfaceCommands=0`、`activeRenderSlots=0`、全部 PageIr/Tree/PageVM handles 释放。
6. Noop/Recording TraceSink 下 stack、状态、Result、Hook 顺序和错误完全一致。
7. Release、ASan/UBSan、TSan 下反复 Root/Push/Close/destroy 无 UAF、race、deadlock 或 leak。

## 6. 边界扫描

- 生产代码只消费 verified handle 和公共 typed message，不读 ZIP/JSON/source DSL。
- 只有一个 committed Navigation stack，不存在 Platform mirror stack 或 recovery stack。
- 每个 Surface 只持有一个 S05 RuntimeTreeStore；pending target 不复制 source tree。
- S04 不包含 Render mutation、Layout、Measure、Mount operation 或 Event dispatch 实现。
- S04 不包含具体平台容器、具体 JS Engine或原生 handle 类型。
- S04 不修改 AppRuntime state，不建立第二个 lifecycle control slot。

## 7. 证据

实现复核必须提交：

- Surface lifecycle/health/Revision 状态与 requirement-test 对照。
- Root、Push、Close 每阶段的 stack/record snapshot 和 typed message trace。
- Present/Close 前预留与 success 后 no-fail commit 的故障注入证据。
- late Result、destroy failure、tombstone 和 top-to-root teardown 证据。
- Release、ASan/UBSan、TSan、依赖扫描、Noop/Recording 等价及资源归零结果。
