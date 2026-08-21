# M1 共享交接记录

## 当前状态

`S3.5_CODE_ALLOWED / S2_VERIFIED / ALPHA_S1_VERIFIED`

## 已冻结事实

- Alpha S1 已通过：真实 Case 001 Runtime RPK 经 JS/Core/LVGL/SDL 完成首屏。
- Alpha 运行使用真实 `InstantiateTemplate` 和一个 initial binding。
- Core 维护唯一权威 Runtime Tree；Platform 只消费 MountTransaction。
- Alpha 使用的 Runtime RPK SHA-256：`95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4`。
- Alpha 不是完整 M1；事件、路由、Capability、增量更新、返回和完整恢复仍需验证。

## 当前放行

- `M1-S2`：`VERIFIED`，范围为 Spine。
- `M1-S3.5`：`CODE_ALLOWED`。
- `M1-S4`、`M1-S5`：`BLOCKED`，等待前置切片通过。
- `M1-S3`：`BLOCKED`，等待 M1-Spine 架构检查点通过。
- 执行所有权：一个长期 M1 集成 Agent；禁止为后续切片并行启动其他 Agent。

## 交接记录

### 2026-08-19 / 总架构 / Alpha S1 通过

- 状态：`VERIFIED`。
- 事实：真实 RPK Loader、QuickJS App/Page Module、VM 初始化、initial binding、Core Initial Render、Yoga/Layout、唯一 RuntimeTreeStore、LVGL/SDL Mount/Present 均通过。
- 事实：Case 001 中文标题可见；Surface、Node、Handler、Module、Engine、Host 对象和队列资源回到基线。
- 约束：本结论只关闭 M1-Alpha S1，不关闭完整 M1，也不代表 Android、iOS 或 Benchmark 通过。
- 下一步：启动 M1-S2。
- 公共合同影响：无。

## Agent 追加区

M1 集成 Agent 只能在本节末尾追加，不得改写已验证事实。

### 2026-08-19 / M1 集成 Agent / S2 公共实现阻塞

- 切片：`M1-S2`
- 状态：`BLOCKED`
- 已完成：读取 M1、Event/Navigation/Render 公共合同和 JS/Core/LVGL/Examples 当前实现；确认 Alpha Composition Root 可复用真实 RPK 首屏。
- 已验证事实：JS ABI 已有 `RegisterHandler`、`JsEventDispatch`、`NavigationPush` 类型；Page IR 已解析 `TemplateHandlerId`；Core 已有 Runtime Tree 的 Handler ownership 数据结构和 SurfaceController 的 Navigation Push 状态机。
- 公共缺口：当前 Core/Platform 代码没有冻结合同要求的标准 `PlatformInputMessage` C++ Port、Core Event Router 或 Input -> Core ingress；LVGL SDL backend 仍只输出 raw input sample；`MountCoordinator` 的 Alpha EventBinding participant 对非空 Handler delta 明确返回 `kHostFeatureUnsupported`。
- 公共缺口：当前 Examples Composition Root 没有把真实 LVGL Button 的 input、Core Handler registration、JS `JsEventDispatch`、typed `router.push` 和 `SurfaceController` 组合起来的现有入口。
- 禁止动作：不能在 `quickapp-examples` 创建本地 Event Router、Navigation Stack 或直接调用 Core Navigation 来冒充 S2；这会违反单一权威和禁止第二套协议的冻结约束。
- `[待决策]`：需要总架构确认 S2 的最小实现归属和公共入口，至少包括 Core Event Router/Input Port、RuntimeTree HandlerBinding commit participant 的正式实现，以及 Platform Surface/Navigation Composition Root 的连接方式；确认前不修改公共合同或实现旁路。
- 当前阻塞：`M1-S2`；S3、S3.5、S4、S5 继续保持阻塞。
- 下一步：总架构处理上述公共实现边界后，M1 集成 Agent 在同一对话继续 S2。
- 公共合同影响：候选新增/补齐 Core 内部 Port 与实现，不应改变现有 wire 字段；若需要改变 wire/schema，必须另行记录决策。

### 2026-08-20 / 总架构 / 页面栈策略延期

- 切片：`M1-S2`。
- 状态：`DEFERRED / S2_CONTINUES`。
- 决策：页面栈公开上限、专用错误码、Profile 容量配平和专项验收全部延期，不作为 M1-S2 门禁。
- Agent 动作：不为页面栈策略返工；继续完成真实点击到新页面显示的 S2 主链。
- 公共合同影响：无。

### 2026-08-20 / M1 集成 Agent / S2 实现完成

- 切片：`M1-S2`。
- 状态：`READY_FOR_REVIEW`。
- 结论：真实 Case 001 Runtime RPK 已跑通 `LVGL Button -> PlatformInputMessage -> Core Event Router -> JS Handler -> typed router.push -> Core Navigation Push -> Detail Surface -> real Page Module/VM/Page IR -> Mount/Present`；未创建第二套 Event Router、Navigation Stack、Runtime Tree 或切片专用 Runtime。
- Runtime RPK：`quickapp-toolkit/evidence/tk-s07-case001.rpk`；SHA-256 为 `95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4`。
- 可见结果：Root `srf:1` 首先可见；成功 Push 后 Detail `srf:3` 可见，标题为 `快应用是什么？`，正文存在，按钮文案为 `欢迎使用`，Core 页面栈长度为 2。
- 事件事实：Case 001 的真实 LVGL Button 对象对应 `NodeId=node:3`、`HandlerId=hdl:1`；SDL pointer device 已绑定到 display。自动验收通过该真实 Button 的 `LV_EVENT_CLICKED` 触发其正式回调，不直接调用 Core Navigation。
- 成功路径关联：`request=req:p-3 / surface=srf:1 / node=node:3 / handler=hdl:1 -> navigation request=req:j-100003 -> target=srf:3 -> InstantiateTemplate request=req:j-103 -> Mount source=req:j-103 / attempt=mnt:2 / revision=0 -> presented`。
- ID 规则：首次页面构建按冻结 Render Contract 使用 `InstantiateTemplate.requestId -> MountTransaction.sourceId` 和 `MountAttemptId`；首次 full Mount 不产生 `RenderTransaction`，因此不伪造 `TransactionId`。`TransactionId` 从 M1-S3.5 增量更新开始出现。
- 正常路径结果：一次独立 Button click 只增加一次 Input dispatch、一次 JS Handler 执行和一次 typed Navigation Push；Detail 只在 full Mount 成功后 Present，Core 是唯一权威页面栈。
- 负例结果：同一 Button 连续两次 click 时只允许一个在途 Push，注入首个异步 Create 失败后 Core 栈仍为 1；未知 Node/Handler 返回 `HANDLER_NOT_FOUND`；不存在 route 不改变栈；Platform Create 失败不留下半完成 Surface；Surface 销毁后的 late Event 返回 `HANDLER_NOT_FOUND`。
- 销毁前资源：`surfaces=2 nodes=8 handlers=2 live_surface=2 mount_objects=8 roots=2`。
- 销毁后资源：Core `surfaces=0 nodes=0 handlers=0 live_surface=0`；LVGL `mount_objects=0 roots=0`；JS Handler、Module entry/lease/load/bytes/outbox、App/Page VM、Surface scope、ABI entry/correlation/consumer/callback、Page native entry/factory、JS queue depth 全部为 0。
- Core 验证：`cmake --build build-m1-s2 -j4 && ctest --test-dir build-m1-s2 --output-on-failure`，`15/15` 通过。
- JS 验证：同一命令在 `quickapp-runtime-js` 执行，`11/11` 通过。
- LVGL 定向验证：`ctest --test-dir build-m1-s2 --output-on-failure -R 'lv_s03|lv_s04|lv_s06'`，`8/8` 通过。
- 主链验证：在 `quickapp-examples` 执行 `cmake --build build-m1-s2 -j4 && SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl`，退出码为 0。
- 已知非 S2 门禁：LVGL 全量 `14` 项中旧 `lv_s02_contract_tests` 在当前无窗口环境的 SDL3 display open 仍失败，其余 `13` 项通过；S2 涉及的 S03/S04/S06 均通过。人工鼠标点击可经已绑定 SDL pointer 进入同一 Button 回调，但本轮自动证据使用真实 Button 事件注入，不把它表述为物理外设采集证据。
- 修改项目：`quickapp-runtime-core`、`quickapp-runtime-js`、`quickapp-runtime-lvgl`、`quickapp-examples`。
- Core 主要文件：`include/quickapp/core/event/event_router.h`、`src/event_router.cpp`、Runtime Tree Handler ownership、Initial Render/Mount source correlation、`tests/core_event_router_tests.cpp`、Surface 并发 Push/Create 失败测试及 CMake 接线。
- JS 主要文件：Handler Registry、Module Handler metadata、Initial Handler transaction、Page VM retention、typed `system.router.push` facade 及 CMake 接线。
- LVGL 主要文件：Input Adapter、MountHost click/Surface release、CoreMountBridge Present ownership、真实 Detail 文本/字体边界及相关测试。
- Examples 主要文件：`composition/case001_lvgl.cpp` 和 CMake Composition Root 接线；Examples 只负责编排真实服务与验收，不持有权威 Event/Navigation 状态。
- 公共合同影响：无 wire/schema 变更；新增的 C++ `InitialRenderIntent.source_id` 只是落实冻结合同中 `MountTransaction.sourceId = InstantiateTemplate.requestId` 的既有语义。
- 当前阻塞：无 S2 公共合同阻塞；`M1-S3`、`M1-S3.5`、`M1-S4`、`M1-S5` 继续保持 `BLOCKED`，等待总架构校审 S2。
- 下一步：总架构校审本记录和真实命令；通过后标记 S2 `VERIFIED`，再由同一长期 M1 Agent 启动 S3。

### 2026-08-20 / 总架构 / M1 Fast Track 与 S2 Spine 通过

- 切片：`M1-S2`。
- 状态：`VERIFIED`，范围为 `Spine`。
- 已验证事实：真实 Runtime RPK 已完成 LVGL click -> Core Event Router -> JS Handler -> typed router.push -> Core Navigation -> Detail Surface 可见。
- 已验证事实：一次成功点击只产生一次 Push；Core 权威栈为 2；Detail 真实内容可见；销毁后 Surface、Node、Handler、JS VM/Module/ABI、Mount 与 Host 资源归零。
- focused tests：Core `15/15 PASS`，JS `11/11 PASS`，S2 端到端程序退出码为 0。
- `[HARDENING]`：`build-m1-s2` 的 `lv_s02_contract_tests` 在 Display Backend 初始化处失败；LV-S02/LV-S04 已有历史全配置 `14/14 PASS`，该临时构建失败不属于 S2 Event/Navigation focused path，不阻塞 Spine，后续统一定位。
- 执行调整：以 `M1-FAST-TRACK-GUIDE.md` 为当前优先指导；S2 后直接进入 S3，S3 后直接进入 S3.5，S3.5 完成后暂停执行架构检查点 A。
- 当前放行：`M1-S3 CODE_ALLOWED`。
- 公共合同影响：无。

### 2026-08-20 / 总架构 / Capability 后移与增量主链优先

- 状态：`M1-S3.5 CODE_ALLOWED`。
- 决策：S3 Capability/Toast 是 typed Bridge 扩展能力，不是三大系统骨架；S2 typed router 已证明扩展路径，S3 后移到 Spine 检查点 B 之后。
- 当前主链：`S3.5 Incremental -> 检查点 A -> S4 Back -> S5 Minimal Stability -> 检查点 B -> S3 Capability -> Hardening`。
- Agent 动作：停止进入 S3；按 `M1-FAST-TRACK-GUIDE.md` 直接执行 S3.5。若 CORE-S06/S07/S08、JS-S05/S07 尚无详细分 Spec，先追加不超过 10 行 Slice Contract，不等待完整文档。
- 公共合同影响：无；只调整实施顺序。

### 2026-08-20 / 总架构 / S2 Agent 结束，放行新 S3.5 Agent

- 事实：上一 Agent 已完成并交付 S2；最新可运行证据仍是 S2 Event/Navigation 主链，未开始 S3.5 增量实现。
- 当前状态：`M1-S3.5 CODE_ALLOWED`；S3 Capability 继续后移，S4/S5 继续等待。
- 下一 Agent：使用干净上下文，只执行 `M1-FAST-TRACK-GUIDE.md` 的 S3.5。
- 第一目标：在 Examples 建立最小联盟 DSL focused fixture `BINDING-001`（计数文本、更新按钮、`count += 1`），并用 Toolkit 构建真实 Runtime RPK；禁止手写 Bundle、Page IR 或运行时中间产物。
- 最小闭环：一次真实 state write -> 一个 dirty binding -> 一个 typed `RenderTransaction` -> Core Runtime Tree revision +1 -> 一个 `MountTransaction` -> LVGL 文本真实变化。
- 依赖范围：JS Binding/Render Client、Core Render/Style/Layout/Commit、LVGL Mount 接线和 Examples Composition Root；只补闭环所需最小正式实现。
- 交付：追加不超过 20 行的 Slice Contract/实现交接，包含 RPK 身份、运行命令、focused/依赖锥测试、Revision、可见结果、资源结果和 `[HARDENING]` 遗留项。
- 门禁：S3.5 完成后暂停，等待总架构检查点 A；不实现 Capability、Block 全量语义、keyed list、完整失败矩阵或性能系统。
- Case 边界：不得修改 Case 002 现有 `count/visible/items` 同步更新语义；完整 Case 002 作为 Hardening 验收保留。

### 2026-08-21 / M1-S3.5 / READY_FOR_REVIEW

- Fixture：`quickapp-examples/binding-001`，真实联盟 DSL：`count`、计数文本、更新按钮、`count += 1`。
- RPK：`quickapp-toolkit/evidence/tk-s08-binding001.rpk`；SHA-256：`4f702eb66b543ff03fdafbfc6480cdb2dde0e0ee2cccbe24b65d426487537c0c`。
- 构建命令：`cd quickapp-toolkit && npm test`；结果 `77/77 PASS`，RPK 由 Toolkit 生成，未手写 RPK/Page IR/RenderTransaction。
- 运行命令：`cd quickapp-examples && SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --binding-001`；退出码 `0`。
- 链路证据：state write -> dirty binding -> microtask flush -> typed RenderTransaction -> Core staged mutation -> Style/Layout -> MountTransaction -> LVGL。
- 事务证据：`txn:srf:1-1`；Core Revision `0 -> 1`；增量 Mount `mnt:2` 成功；LVGL 计数文本真实从 `0` 变为 `1`。
- focused 依赖锥：Core `2/2`、JS ABI `2/2`、LVGL Mount/Integration `3/3` PASS。
- 资源证据：销毁后 `surfaces=0 nodes=0 handlers=0 live_surface=0 mount_objects=0 roots=0`；JS handlers/modules/page-vm/ABI correlations/queues 均为 `0`。
- 交付状态：`READY_FOR_REVIEW`；等待架构检查点 A；本 Agent 不进入 S4/S5。

### 2026-08-21 / 总架构 / S3.5 检查点 A 通过

- 状态：`VERIFIED`，范围为 `Spine`。
- 独立复核：Toolkit `77/77 PASS`；Core render/boundary `2/2 PASS`；JS `11/11 PASS`；LVGL Mount/Integration `3/3 PASS`。
- 独立端到端结果：真实 `tk-s08-binding001.rpk` 经 `--binding-001` 运行成功，输出 `state_write=1 -> dirty_binding=1 -> microtask_flush=1 -> render_transaction=1 -> revision=0->1 -> mount_transaction=1 -> lvgl.text=1`。
- RPK SHA-256 与交接记录一致：`4f702eb66b543ff03fdafbfc6480cdb2dde0e0ee2cccbe24b65d426487537c0c`。
- 架构结论：JS 只提交 typed incremental intent；Core 维护唯一 Runtime Tree 并完成 staged mutation/commit；LVGL 只消费 MountTransaction；未发现第二棵权威 Tree 或平台业务 diff。
- 资源结果：销毁后 `surfaces=0 nodes=0 handlers=0 live_surface=0 mount_objects=0 roots=0`，JS handlers/modules/page-vm/ABI correlations/queues 均为 `0`。
- 当前放行：`M1-S4 CODE_ALLOWED`；`M1-S5` 继续等待 S4；`M1-S3` Capability 继续等待检查点 B。
- `[HARDENING]`：完整 Case 002、失败/过期/乱序事务矩阵、完整观测和性能验证不属于本检查点。

### 2026-08-21 / M1-S4/S5 / READY_FOR_REVIEW

- RPK：`quickapp-toolkit/evidence/tk-s07-case001.rpk`；SHA-256：`6bab1eb0899e4871fca68fe83205de971efcbdcca8c2629eed6cb8e682f5797c`。
- 命令：`cd quickapp-examples && cmake --build build-m1-s2 -j2 && SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --s4-back`；退出码 `0`。
- S4 链路：真实 LVGL Case 001 Push Detail -> typed Platform Back/`NavigationCloseRequest` -> Core close -> Platform `CloseSurfaceHost` -> Detail `onDestroy` -> Demo `onShow`；Core stack `2 -> 1`。
- S4 资源：Detail Surface/Host/Runtime Nodes/Handler 释放，Demo Host 恢复可见；Platform 未维护导航镜像，未直接删除 Host 绕过 Core。
- S5 线程：JS Executor 与 Core/LVGL owner thread 可观察；Core 与 LVGL 使用同一 owner，JS executor 不同。
- S5 稳定性：容量为 `1` 的 typed close ingress 拒绝第二请求并返回 `QUEUE_OVERFLOW`；Platform create 中途失败后 Core stack/Runtime Tree 不变。
- S5 生命周期：正式 `destroy-all` 后 Core `surfaces=0 nodes=0 handlers=0 live_surface=0`、LVGL `mount_objects=0 roots=0`、JS 资源与队列均为 `0`；late callback 未复活对象。
- focused 依赖锥：Core `3/3`、LVGL `4/4`、JS `3/3` PASS；未修改公共合同、冻结架构或 S3.5。
- `[HARDENING]`：完整线程池/EventLoop、全量错误/超时矩阵、lock-free queue、压力/Benchmark、Noop/Recording 观测、页面栈策略和容量策略不阻塞 M1 Spine。
- 交付状态：`READY_FOR_REVIEW`；停止，不进入 Capability 或 Hardening。

### 2026-08-21 / 总架构 / M1 Spine 检查点 B 通过

- 状态：`VERIFIED`，范围为 `M1-Spine`。
- 独立端到端复核：真实 `tk-s07-case001.rpk` 经 `--s4-back` 运行成功；`platform_back -> NavigationClose -> CloseSurfaceHost -> Detail onDestroy -> Demo onShow` 完成，Core 栈 `2 -> 1`。
- 独立稳定性复核：容量为 `1` 的 typed `NavigationCloseRequest` 第二次提交返回 `QUEUE_OVERFLOW`；平台中途 Create 失败后 Core 栈和 Runtime Tree 保持不变；late callback 未复活对象。
- 线程事实：JS Executor 与 Core/LVGL owner 可区分，Core 与 LVGL 使用同一 owner；本检查点验证边界，不要求完整线程池或并行调度系统。
- 独立测试：Core `15/15 PASS`；JS `11/11 PASS`；LVGL S03/S04/S06 定向 `8/8 PASS`；真实端到端退出码 `0`。
- 资源结果：销毁后 `surfaces=0 nodes=0 handlers=0 live_surface=0 mount_objects=0 roots=0`，JS 资源和队列均为 `0`。
- M1-Spine 结论：`S1/S2/S3.5/S4/S5` 全部 `VERIFIED`；Bridge、Render、Event、Navigation、Incremental、Lifecycle 的主骨架已形成可运行闭环。
- 当前放行：`M1-S3 Capability CODE_ALLOWED`；Capability 完成后进入 M1 Hardening。
- `[HARDENING]`：完整线程池/EventLoop、全量错误/超时矩阵、lock-free queue、压力/Benchmark、Noop/Recording 观测、页面栈策略和容量策略不属于本检查点。
