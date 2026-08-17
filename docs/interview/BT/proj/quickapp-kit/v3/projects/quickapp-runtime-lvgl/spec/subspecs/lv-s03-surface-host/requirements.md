# LV-S03 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 固定资源上限](#4-固定资源上限)
- [5. 质量需求](#5-质量需求)
- [6. 非目标](#6-非目标)
- [7. 总需求映射](#7-总需求映射)

## 1. 结论

LV-S03 必须证明：**同一组 Core Surface command 可以在 simulator 与 embedded Profile 上得到相同状态转换、原子可见性和确定销毁语义，差异只存在于底层显示 Backend。**

## 2. 输入与输出

### 2.1 输入

- 公共 Schema 定义的五类 immutable Surface command。
- LV-S01 `OwnerTaskQueue`、owner-thread identity 与 WakeupPort。
- LV-S02 Runtime Session、Build Profile limits 和可关闭的 `CoreIngressPort`。
- LVGL page-root factory 与后续 LV-S04 提供的 Surface content release/readiness hook。

### 2.2 输出

- 与输入 `kind/requestId/surfaceId/mode/sourceSurfaceId/revealSurfaceId/visibility` 精确关联的公共 Surface result。
- 仅平台内部可见的 page-root lease、full-mount readiness 和 content release 协作边界。
- live roots、pending operations、result backlog、destroy/reset 的轻量计数。

## 3. 功能需求

| ID | 需求 |
|---|---|
| LV-S03-R01 | `PlatformSurfacePort.post` 只有在固定 operation slot 与 owner task 所有权均成功转移后才能返回 accepted；未 accepted 不得产生副作用或业务 Result。 |
| LV-S03-R02 | 每个 accepted command 必须在 owner thread 恰好执行一次，并经 `CoreIngressPort` 产生恰好一个终态 Result；teardown 也不得静默丢弃 accepted command。 |
| LV-S03-R03 | `CreateSurfaceHost` 必须创建独立、默认隐藏、禁用 LVGL 自布局的 page root，并建立唯一 `SurfaceId -> PageRoot` 映射；不得创建 Runtime Node 或 Host Component。 |
| LV-S03-R04 | 重复 `SurfaceId` create 必须失败且不替换原 root；容量、分配或 viewport 失败不得发布半创建映射。 |
| LV-S03-R05 | root present 只允许已完成 full Mount 的 hidden target；成功后 target visible，失败后 target 仍 hidden-mounted。 |
| LV-S03-R06 | push present 必须由命令指定 source；owner task 在提交前同时验证 source visible、target hidden-mounted 和二者无其他控制操作，成功时在一次 display flush 前完成 source hidden + target visible，失败时二者不变。 |
| LV-S03-R07 | `SetSurfaceVisibility` 只改变指定 root 的本地可见性，不修改 Navigation；目标可见性与当前相同时返回 completed 且不重复操作。 |
| LV-S03-R08 | close 必须使用命令指定 reveal；提交前同时验证 closing visible、reveal hidden 及 content 可释放，成功时在同一 owner task 内无失败地释放 closing content/root 并 reveal predecessor，失败时二者不变。 |
| LV-S03-R09 | destroy 必须先阻止该 Surface 新命令和 Mount，再处理已接受 owner 工作，递归释放 content、listener、NativeHandle mapping 与 root，最后删除映射并返回 destroyed。 |
| LV-S03-R10 | destroy 失败时必须返回 failed、清除本地可寻址映射并执行 container-level reset；同一 SurfaceId 不得用残留 root 恢复。 |
| LV-S03-R11 | 同一 Surface 同时最多一个 accepted control command；push/close 同时占用其涉及的两个 Surface，释放前后不得插入针对任一方的控制操作。 |
| LV-S03-R12 | 相同 RequestId 的重复投递不得重复 side effect；pending 重复不得创建第二个 operation，最近完成结果可用于识别 replay。不同 RequestId 仍按当前本地资源阶段验证。 |
| LV-S03-R13 | 本地 `hidden-empty/hidden-mounted/visible/hidden/destroying` 只表示平台资源阶段；不得保存 route、栈顺序、前驱关系、Page lifecycle、Core revision 或权威 Surface 状态。 |
| LV-S03-R14 | LV-S04 只能在 owner thread 通过短生命周期 page-root lease 挂载内容，并在 full Mount 成功后标记 mount readiness；lease 和 LVGL 指针不得进入 Core、JS 或异步消息。 |
| LV-S03-R15 | 所有 `lv_*`、page-root mapping 和本地阶段写入只发生在唯一 LVGL owner thread；Core 线程只 move immutable command，不同步等待 owner thread。 |
| LV-S03-R16 | queue full 映射为未 accepted 的 `QUEUE_OVERFLOW`；closed/stopping 返回 typed Enqueue error。accepted 后的业务失败必须使用公共 Surface Result，不抛异常、不返回裸平台错误。 |
| LV-S03-R17 | Result 回流暂时 full 时必须由固定 operation slot 保留唯一 immutable Result，并由后续 owner turn 有界重试；不得 spin、阻塞、动态扩容或重复完成。 |
| LV-S03-R18 | `close()` 幂等：停止 admission，drain/cancel 已接受命令并形成 Result 或 tombstone，然后销毁全部 roots；析构不得隐式启动 stop、等待或执行任务。 |
| LV-S03-R19 | simulator 与 embedded 使用同一 Adapter、状态机、limits 类型和测试夹具；SDL、libuv、DisplayBackend 或设备 driver 不进入 Surface command 语义。 |
| LV-S03-R20 | Trace 只记录结构化 ID、阶段、结果、计数和降级；TraceSink 关闭或丢弃不得改变 Surface 行为。 |

## 4. 固定资源上限

| Limit | `lvgl-simulator-dev` | `lvgl-embedded-min` | 超限行为 |
|---|---:|---:|---|
| live page roots | 16 | 4 | create failed，`OUT_OF_MEMORY` |
| Surface control operation slots | 16 | 4 | post 未 accepted，`QUEUE_OVERFLOW` |
| in-flight command per Surface | 1 | 1 | post 未 accepted，typed busy/rejected |
| retained result per operation | 1 | 1 | 原 slot 重试，不新增 backlog |
| result retry per owner turn | 1 | 1 | 留待后续 turn，不 spin |

这些值属于 Build Profile，不允许运行期放大。LV-S01 owner task 总容量仍分别为 512/64；LV-S03 不再建立第二个无界任务队列。

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 分层 | Core/JS 不包含 `lv_obj_t`、SDL、libuv 或 page-root handle；Platform 不解析 route。 |
| 原子性 | push 与 close 的全部可见变化在一个 owner task、一次 display flush 前提交。 |
| 确定性 | accepted command 只有一个 owner、一个 operation slot 和一个终态 Result。 |
| 内存 | root、operation、result、mapping 全部固定上限；destroy 后资源计数归零。 |
| 线程 | LVGL owner 单写；跨线程仅 move immutable command/result。 |
| 可测试 | root factory、content hook、CoreIngress、queue、可见提交和 reset 均可故障注入。 |

## 6. 非目标

- 不维护 Core Navigation 栈、route、Page lifecycle 或第二套 Surface 状态机。
- 不实现 Host Component、Mount op、NodeId/NativeHandle table 或 Listener。
- 不实现输入、事件、Measure、字体、Capability 或 Page Control。
- 不修改公共 Surface Contract/Schema 或新增公共字段。
- 不启动 LV-S04，不编写产品代码。

## 7. 总需求映射

| LVGL 总需求 | LV-S03 覆盖 |
|---|---|
| `LV-R04` | R03-R14、R18 |
| `LV-R12` | R01-R02、R15-R19 |
| `LV-R17` | R19 |
| `LV-R18` | R20 |
