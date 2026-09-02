# Runtime Core Spec Agent Handoff

> 状态：Core Alpha 组件与 Package dependency handoff `VERIFIED`；M1-Alpha 由单一集成 Agent 接管；Core 项目 Agent 停止。

## 目录

- [目标](#目标)
- [交接记录](#交接记录)

## 目标

代码目录：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-core/`

只读：v3 公共 Spec、Toolkit Artifact 和 Cases；可写：本项目 `AGENT-HANDOFF.md`；项目总 Spec gate 通过后可写本项目 `spec/subspecs/<name>/`；对应分 Spec 通过后才可写上述代码目录。

平台总 Spec 必读：`../../../spec/requirements.md`、`../../../spec/design.md`、`../../../spec/tasks.md`、`../../../spec/acceptance.md`。

启动阅读：本文件、`./README.md`、`../../../README.md`、`../../../AGENT-WORK-BOARD.md`、`../../../spec/v1-scope-and-acceptance.md`、`../../../spec/architecture.md`、`../../../spec/contracts/`、`../../../spec/contracts/schemas/README.md`。Core Agent 必须读取全部公共合同。

当前总 Spec 只交付：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。

Core 是共享实现的唯一归属，不再从 Android 事后抽取。覆盖 PackageSource、RPK/Manifest/Runtime Metadata/Page IR Loader、Runtime Controller、App/Page Lifecycle、Surface/Navigation、Runtime Tree、NodeId、Style/Yoga、Measure cache、`InstantiateTemplate`、`RenderTransaction`、Platform Input/Event Router、ModuleRegistry/CapabilityInvoker、typed Page Control 路由、线程和所有权。

## 交接记录

### 2026-08-18 / Runtime Core Agent / CORE-S03 证据修复与 CORE-S04 实现

- 状态：CORE-S03 `VERIFIED`；CORE-S04 `READY_FOR_REVIEW`；CORE-S06 未启动。
- CORE-S03：重新生成完整 `evidence/source-manifest.sha256`，包含当前
  `CMakeLists.txt`、CORE-S03 源码、测试和边界扫描；`shasum -a 256 -c`
  全部通过。未修改 CORE-S03 产品行为或公共合同。
- CORE-S04：完成唯一 Surface record table、Navigation stack、Root/Push/Close、
  Revision/status gate、Platform command/result correlation、生命周期协作者、
  destroyAll、失败恢复、tombstone、OOM/overflow/teardown 路径。
- 验收证据：`evidence/core-s04-verification.md`；Release、ASan/UBSan、TSan
  和 TSan 重复运行均通过，完整 CTest 为 12/12。
- 边界：未实现 CORE-S06、Render、Layout 或 Mount；Platform 不拥有路由，未建立第二
  Navigation 栈或第二 Runtime Tree。
- 下一步：等待定向校审；不得启动 CORE-S06。

### 2026-08-15 / 总架构 Agent

- 历史事件：建立 Runtime Core 项目入口；当时尚未启动项目总 Spec。
- 历史门禁：现已解除；当前以最新总 Spec 门禁为准。
- 历史意图：实现阶段 Core 与 JS Runtime 并行；该阶段的平台先后顺序已被最新冻结事件取代。

### 2026-08-15 / 总架构 Agent / 六审修订（签名部分已被需求回归校准取代）

- 事件：Core 成为公共 Ed25519 签名验证和 PackageOpenPolicy 执行的唯一归属。
- 首屏：Root/Push 都必须在 Platform Present 成功后才返回 `InstantiateTemplateResult(status=presented)`。
- Page IR：Loader 必须拒绝环、多父、共享 Block Root 和 Binding/Handler scope 错配。

### 2026-08-15 / 总架构 Agent / 需求回归校准

- 新增：Core 拥有 App/Page Context 与逻辑页面状态，并向 JS 串行派发可见性/销毁 Hook。
- 新增：实现 ModuleRegistry、CapabilityInvoker 和 `system.router` CoreProvider；PlatformProvider 由各平台手动注册、按 AppRuntime 懒加载；CapabilityGuard 后经范围校准移至第二期。
- 新增：Core 拥有 Yoga 与 Measure cache，通过只读 PlatformMeasureAdapter 获取字体 metrics。
- 校正：签名/PackageOpenPolicy 降为后续 Release profile，V1 Loader 只阻塞于路径、版本、结构和 Artifact SHA-256。
- 历史门禁：该阶段已完成；当前以最新校审门禁为准。

### 2026-08-15 / 总架构 Agent / 项目总 Spec 初稿

- 已完成：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。
- 核心边界：Core 是独立共享 C++ 内核和唯一 Runtime Tree 所有者，不从 Android 事后抽取。
- 下一步：独立校审状态机、线程/所有权、失败恢复、分 Spec 唯一归属和平台无关性。
- 门禁：校审通过前不得编写分 Spec，不得初始化产品代码。
- `[已冻结] P0-ADDR-001`：Core 以 Owner + TemplateBindingId/TemplateHandlerId 从 Page IR 解析 target、property 和 eventType。

### 2026-08-16 / 总架构 Agent / 首轮项目总 Spec 校审修订

- 新增公共 Port：Verified Module Load、typed Lifecycle/Host Control、同步 Measure measured/failed 与字体 generation。
- Navigation close：只允许非 Root 栈顶；Platform `CloseSurfaceHost` 成功后 Core 才 pop、恢复前驱并释放资源。
- EventBinding 与 Handler retirement 以 Runtime Tree commit 为分界，Render 回滚不得造成 Core/JS 分叉。
- 当前门禁：Core `DESIGN_ALLOWED`；产品代码等待对应分 Spec 独立校审 PASS。

### 2026-08-16 / 总架构 Agent / V1 范围校准

- `[已冻结]`：Core V1 只围绕 Package Load、唯一 Runtime Tree、Render/Layout/Mount、Event、Navigation 和 Case 最小 Capability。
- 完整权限、插件治理、高级容灾和 Release 安全后置；公共扩展点可保留，但不得阻塞分 Spec。

### 2026-08-16 / 总架构 Agent / 平台实施顺序调整

- `[已冻结]`：Core/JS 与 Toolkit 并行设计；首个真实 Platform 闭环是 LVGL/SDL，Android 第二，iOS 第三。
- Core 从第一天独立实现；LVGL/SDL 首接入不得把 `lv_*`、SDL、EventLoop Backend 或 owner-thread 假设带入 Core。
- Android 必须复用同一 Core/JS，作为平台无关性和联盟语义的第二次证明。

### 2026-08-16 / 总架构 Agent / 平台总 Spec 修正同步

- `[已冻结]`：Capability 封闭集合包含 NavigationPush、NavigationClose、ShowToast、DeviceGetInfo；不得遗漏 `closeRoute`。
- Observation Contract/Schema 由总架构维护；Core 只按合同产出 marker，缺口通过 Handoff 提议。
- `CAP-DEVICE-001` 进入 Core Capability 验证；当前只允许设计分 Spec。

### 2026-08-16 / 总架构 Agent / 第二次复核修正

- CORE-S11 只依赖公共 Observation Contract/Schema，不再依赖 BM-S02；Case 001 已移除 device。
- `CAP-DEVICE-001` 拥有独立 success/failure/cleanup 验收。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 定向复核 PASS

- 平台总 Spec 定向复核结果：P0/P1/P2 为 0。
- 当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`；启动 CORE-S01 分 Spec 设计，禁止产品编码。

### 2026-08-16 / 总架构 Agent / P0-CUT-001 同步

- `[已冻结]`：Bridge/Render/Event 与 Lifecycle/Runtime Tree/Transaction 是固定 Kernel；Core 只依赖公共 Port。
- 新增：CORE-S02 在执行 JS 前用 Runtime Composition Manifest 完成 Artifact/Profile 兼容性预检；CORE-S11 验证反向依赖与负例。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待可裁剪组成定向校审。

### 2026-08-16 / 总架构 Agent / JS Engine 边界校准

- `[已冻结]`：Core 只依赖 JS Runtime Contract，不依赖 `JsEnginePort` 的具体 Provider，更不得出现 QuickJS 类型。
- Engine ABI 与 Provider 生命周期由 JS Runtime Service/Composition Root 闭合；当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`。

### 2026-08-16 / 总架构 Agent / 第四次复核修正

- CORE-S02 消费的 Runtime Composition Manifest 必须包含一次 `runtime.js-framework` 和一个选定 Engine；Core 仍不拥有 Provider 选择。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 第五次定向复核 PASS

- P0/P1/P2 均为 0；当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`。
- 允许设计 CORE-S01；禁止产品编码。

### 2026-08-16 / 总架构 Agent / 最小可观测合同

- `[已冻结]`：CORE-S01 拥有 `MonotonicClock + TraceSink/NoopTraceSink + RuntimeCounters`；只发结构化事实，不存储、不分析。
- 必测 Noop/Recording 行为等价、OOM、队列溢出和 full rebuild；当前授权不变：`DESIGN_ALLOWED + CODE_BLOCKED`。

### 2026-08-16 / Runtime Core Agent / CORE-S01 分 Spec 启动

- 状态：IN_PROGRESS
- 已完成：确认 `CORE-S01 Core Foundation` 的写入边界、固定交付物与当前门禁。
- 新增事实：无。
- 本项目设计决定：无；全部语义先对齐 v3 公共合同与 Core 项目总 Spec。
- 待验证项：typed value/error、公共 ID、基础 Port、队列、线程/所有权和最小观测合同能否形成无平台泄漏的可编码闭环。
- 阻塞项：无。
- 下一步：读取全部公共合同并编写 CORE-S01 五份分 Spec 文档。
- 公共合同影响：无。

### 2026-08-18 / 总架构 Agent / Core Alpha 实现校审

- 状态：`ALPHA_COMPONENT_PASS + INTEGRATION_ALLOWED`。
- 已验证：Alpha Core 14/14 CTest、ASan/UBSan、TSan、连续 TSan 3 轮、边界扫描和 source manifest 全部通过；唯一 RuntimeTree、PageIrHandle、Yoga/Measure、full Mount、Trace、teardown 成立。
- 证据边界：当前仍是 Core PageIrHandle fixture，不是真实 Toolkit Runtime RPK，也不包含真实 LVGL Present；不得宣称 Case 001 S1 已通过。
- 后续门禁：完整 Mount 失败恢复和二次失败销毁属于完整 M1 Render/容灾范围；Alpha 本轮不扩张实现。
- 下一步：停止扩展 Core，等待 TK-S07 真实 RPK 后参与跨项目联调；详细指令见 [`2026-08-18-core-alpha-review.md`](../../../reviews/subspec-review/2026-08-18-core-alpha-review.md)。

### 2026-08-16 / Runtime Core Agent / [待决策] CORE-S01-ID-001

- 问题本质：公共 Observation Schema 使用 `appRuntimeId` 且编码为 `app:`，但公共 ID Contract 未定义 `AppRuntimeId` 的唯一 producer、作用域和复用规则。
- 冲突的现有合同：`observation.schema.json`/Observation Contract 要求该关联 ID；ID Contract 的 producer/scope 表中没有 `AppRuntimeId`。
- 为什么当前合同无法直接实现：Foundation 可以实现 `app:` 强类型 wrapper，但不能自行决定由 Runtime Host 还是 Core 分配，以及在哪个生命周期内不复用。
- 方案 A 与代价：由 Core AppRuntimeController 分配，作用域为一个 Runtime Host 实例；与 `SurfaceId` 的 Core 所有权一致，但需要公共 ID Contract 增补 Host scope。
- 方案 B 与代价：由 Runtime Host 分配并随创建请求传入；便于宿主关联，但扩大 Host -> Core 创建合同。
- Agent 建议：方案 A；Core 是 AppRuntime 逻辑状态所有者，Host 不应承担 Runtime 内部对象身份分配。
- 影响项目：Runtime Core、Android、LVGL、iOS、Benchmark。
- 阻塞范围：仅暂停 `AppRuntimeId` allocator 的最终实现决定；其他 ID wrapper、队列、Port 与观测基础设计可继续。

### 2026-08-16 / Runtime Core Agent / CORE-S01 分 Spec 完成

- 状态：READY_FOR_REVIEW
- 已完成：新增 `core-s01-foundation` 的 README、requirements、design、tasks、acceptance 五份文档；冻结 typed value/error、强类型 ID、有界 mailbox、Core ingress、JS/Surface/Mount/Measure Port、线程/所有权、关闭、最小观测、Fake 和故障注入设计。
- 新增事实：底层 mailbox 的 `closed` 不能直接映射为不存在的公共错误码；由持有业务语义的 Gateway 映射为现有 terminal error。
- 本项目设计决定：Foundation 使用 move-only immutable message、MPSC 有界入口与单消费者 Core owner；Measure 是唯一同步只读 Port；Trace 是 fixed-shape event view，Noop/Recording 不影响业务行为。
- 待验证项：独立校审需确认 mailbox 线性化语义、Port 关闭顺序和 Trace hot-path 约束是否足以直接指导实现。
- 阻塞项：`CORE-S01-ID-001` 只阻塞 `AppRuntimeId` allocator 最终归属；不阻塞其余 CORE-S01 校审。
- 下一步：提交 CORE-S01 独立校审；校审 PASS 且工作看板 `CODE_ALLOWED` 后才执行 `tasks.md`。
- 公共合同影响：建议在 ID Contract 增补 `AppRuntimeId(app:)` 的 producer、scope 与不复用规则；未修改公共合同。

### 2026-08-16 / 总架构 Agent / [已冻结] P0-EVENT-002

- 状态：READY_FOR_REVIEW
- 已完成：冻结输入事件因果关联；公共 Event/ID/Observation 合同与 Schema 已更新并通过合同测试。
- 新增事实：PlatformInputMessage 必带 `RequestId`；CORE-S09 必须原样复制到同一次输入的全部 JsEventDispatch。
- 本项目设计决定：Core 不为目标或冒泡 Handler 重新分配输入 ID。
- 待验证项：CORE-S09 正负例覆盖连续输入、冒泡、缺 ID 与错 ID。
- 阻塞项：无；不改变 CORE-S01 当前边界。
- 下一步：CORE-S09 启动时读取最新公共合同。
- 公共合同影响：已冻结，无需项目 Agent 修改公共文件。

### 2026-08-16 / 总架构 Agent / [已冻结] P0-ID-001

- 状态：公共决策已完成，CORE-S01 等待对齐后复核。
- 已完成：公共 ID Contract 已补充 `AppRuntimeId(app:)` 的 producer、作用域与不复用规则。
- 本项目设计决定：`AppRuntimeId` 由 Core `AppRuntimeFactory` 唯一生成；作用域是一个 Runtime Host 实例；allocator 晚于该 Factory 创建的全部 AppRuntime 销毁。
- 阻塞项：`CORE-S01-ID-001` 已解除；Core Agent 只需同步 design/acceptance，不得把 ID 生成移到 Platform Host。
- 下一步：按第一批分 Spec 检查报告修订 CORE-S01，再提交定向复核；产品代码保持 `CODE_BLOCKED`。
- 公共合同影响：已冻结，不再待决策。

### 2026-08-16 / Runtime Core Agent / [已关闭] CORE-S01-ID-001

- 状态：READY_FOR_REVIEW
- 已完成：消费 `[已冻结] P0-ID-001` 与 `S1-CORE-001`；CORE-S01 五份文档已同步 `AppRuntimeFactory/AppRuntimeIdAllocator` 所有权、Host scope、不复用和释放顺序。
- 新增事实：`AppRuntimeId` 由 Core AppRuntimeFactory 唯一生成；Platform Host 不生成、不传入；Host 级 allocator 晚于全部 AppRuntime 销毁。
- 本项目设计决定：CORE-S01 实现 allocator 原语并冻结 Factory ownership 接口；CORE-S03 负责 AppRuntime 生命周期编排。RequestId 多 producer 默认共享 AppRuntime 级 allocator，或使用由 AppRuntime 统一配置的互斥命名分区。
- 待验证项：定向复核 `S1-CORE-001` 是否完整关闭。
- 阻塞项：无；原 `CORE-S01-ID-001` 已由公共 `P0-ID-001` 关闭。
- 下一步：停止修改，等待定向复核；产品代码保持 `CODE_BLOCKED`。
- 公共合同影响：无；只消费最新 ID Contract，未修改公共文件。

### 2026-08-16 / 总架构 Agent / CORE-S01 定向复核 PASS

- 状态：`PASS + CODE_ALLOWED`。
- 已完成：S1-CORE-001 已关闭；Factory/allocator ownership、Host scope、A/B/C 不复用、多 producer RequestId 和 teardown 证据完整。
- 新增决策：实现必须消费 `P0-OBS-002`，内部时钟为 uint64，Observation wire 为 run-relative safe integer。
- 阻塞项：无；CORE-S02 仍不得提前实现。
- 下一步：严格按 CORE-S01 tasks 实现并提交证据。
- 公共合同影响：无。

### 2026-08-16 / Runtime Core Agent / CORE-S01 实现完成

- 状态：READY_FOR_REVIEW
- 已完成：在 `quickapp-runtime-core` 实现 typed RuntimeValue/RuntimeError/Result、强类型 ID、Core-only AppRuntimeIdAllocator/AppRuntimeFactory、AppRuntime-owned RequestIdAllocator、有界 MPSC ingress、基础异步 Port/同步 Measure Port、停止与资源所有权、uint64 MonotonicClock、run-relative safe-integer Observation、TraceSink/NoopTraceSink、RuntimeCounters、Fake 与故障注入。
- 新增事实：`AppRuntimeIdAllocator` 与 `RequestIdAllocator` 均不能由 Platform producer 默认构造；Factory 是前者唯一构造者，每个 AppRuntimeIdentity 独占并向多 producer 共享后者。Mailbox 真实 OOM/overflow 路径会一次性尝试发出 `runtime.oom/queue.overflow`。
- 本项目设计决定：Observation 关联 ID 使用强类型 view；Recording Fake 跨调用保留时复制到固定容量自有槽位；内部时钟保持 `uint64_t`，wire 只输出 `now-origin` 且拒绝超过 `9007199254740991` 的整数。
- 验证：Release、ASan/UBSan、TSan 的 `core_s01_contract_tests` 与依赖扫描全部通过；最终 TSan 并发合同连续 10 次通过；覆盖 A/B/C AppRuntimeId 不复用、四 producer RequestId 唯一、post/close 竞争、OOM/overflow、Noop/Recording/Recording-full 等价和 teardown 资源归零。
- 证据：`quickapp-runtime-core/evidence/core-s01-verification.md`。
- 待验证项：独立实现复核确认 API 边界和证据；本机未提供 `clang-format`，编译已使用 `-Wall -Wextra -Wpedantic -Werror`。
- 阻塞项：无；CORE-S02 未实现且继续保持门禁阻塞。
- 下一步：停止修改，等待 CORE-S01 实现复核。
- 公共合同影响：无；只消费 P0-ID-001、P0-OBS-001 与 P0-OBS-002。

### 2026-08-16 / 总架构 Agent / CORE-S01 实现复核 PASS

- 状态：`VERIFIED`。
- 已完成：Release、ASan/UBSan、TSan、依赖扫描及 Foundation 合同通过；未发现平台或 Engine 反向依赖。
- 下一步：按 W1 并行设计 CORE-S02 与 CORE-S05，只写分 Spec，不编码；共同提交校审。
- 公共合同影响：无。

### 2026-08-16 / Runtime Core Agent / W1 CORE-S02 + CORE-S05 分 Spec 启动

- 状态：IN_PROGRESS
- 已完成：确认 W1 门禁、CORE-S01 `VERIFIED` 基线、S02/S05 依赖关系和公共 Artifact/Page IR/Runtime Tree 合同。
- 新增事实：S02 与 S05 可并行设计；实现时 S05 依赖 S02 的 immutable verified Page IR，不反向依赖 Loader。
- 本项目设计决定：S02 不拥有 Runtime Tree；S05 不读取 ZIP、JSON 或 Bundle。两者只通过 `VerifiedPackage/PageIrHandle` 和公共 ID/Schema 连接。
- 待验证项：Package 资源上限、Page IR cache pin/evict、Tree mutation overlay 与 Handler ownership 边界能否形成可编码闭环。
- 阻塞项：无。
- 下一步：编写两个分 Spec 的各五份文档并执行联合边界自检。
- 公共合同影响：无；发现冲突时另行追加 `[待决策]`。

### 2026-08-17 / Runtime Core Agent / W1 CORE-S02 + CORE-S05 分 Spec 完成

- 状态：READY_FOR_REVIEW；CORE-S02/CORE-S05 继续 `CODE_BLOCKED`。
- 已完成：CORE-S02 与 CORE-S05 各交付 `README/requirements/design/tasks/acceptance`，并完成 Artifact、Page IR、Runtime Tree、Block、ID、Error、Observation 合同联合自检。
- S02 冻结：异步 `PackageSource`、单在途随机读、ZIP/Schema/关系/完整性/组合预检顺序、V1 固定资源上限、immutable `VerifiedPackage/PageIrHandle/VerifiedModule`、8 MiB Page IR pinned LRU cache；S02 不拥有 Runtime Tree，也不复制 JS Module Cache。
- S05 冻结：每 Surface 唯一 `RuntimeTreeStore`、`LogicalNodeRef <-> NodeId`、静态实例化、Block keyed reuse/remove/move/tombstone、sparse `TreeMutation`、Node/Block/Handler 结构 ownership 和资源上限；不建立第二棵权威树。
- 联合提交决定：S05 长期只保存 owner <-> HandlerId；S09 独占 EventBinding dispatch tuple，并实现 `EventBindingCommitParticipant`。S08 通过抽象参与者执行预检后不可失败的 Tree/EventBinding 联合提交，不依赖 S09 具体类型。
- 边界自检：S02 与 S05 只通过 immutable `PageIrHandle` 和公共 ID/Schema 连接；S05 不读取 ZIP/JSON/Bundle；两者均不包含平台或具体执行引擎类型。
- 错误与资源：公共错误码逐类映射；失败/回滚不部分发布；late completion 不复活状态；Package cache/read/module 与 Tree/Block/Handler/mutation 均有资源归零验收。
- 待验证项：独立分 Spec 校审确认 V1 数值上限和 `EventBindingCommitParticipant` 是否可直接编码；没有公共合同冲突或 `[待决策]`。
- 阻塞项：无设计阻塞；实现仍由门禁阻塞。
- 下一步：共同提交 CORE-S02/CORE-S05 定向校审；不得编码，不得启动 CORE-S03/CORE-S06。

### 2026-08-17 / 总架构 Agent / W1 CORE-S02 与 CORE-S05 校审 PASS

- 状态：`PASS + CODE_ALLOWED`；CORE-S03/CORE-S06 继续阻塞。
- 已完成：S02 fail-closed Loader、immutable verified handles、Page IR cache 与 Module handoff 边界通过；S05 单一 committed Store、sparse mutation、Block/Handler ownership 与原子提交边界通过。
- 必须先同步的文档澄清：InstantiateBlock 使用已 live/tombstoned ID 返回 `ABI_INVALID_ARGUMENT`；RemoveBlock/MoveBlock 引用不存在或 stale ID 返回 `BLOCK_NOT_FOUND`。该修订不改变公共合同，不需要再次架构校审。
- 实现边界：S02/S05 可并行；S05 使用通过校审的 PageIrHandle 合同和 Fake，真实联调等待 S02 verified。
- 下一步：完成澄清后严格按各自 tasks 实现并分别提交证据；不得启动 CORE-S03/CORE-S06。
- 公共合同影响：无。
- 公共合同影响：无。

### 2026-08-17 / Runtime Core Agent / CORE-S02 + CORE-S05 实现完成

- 状态：`READY_FOR_REVIEW`；CORE-S03/CORE-S06 未启动。
- 文档同步：已冻结唯一错误规则；`InstantiateBlock` 使用 live/tombstoned BlockInstanceId 返回 `ABI_INVALID_ARGUMENT`，`RemoveBlock/MoveBlock` 使用不存在或 stale ID 返回 `BLOCK_NOT_FOUND`。
- CORE-S02：实现异步单在途 PackageSource Gateway、ZIP/Manifest/Runtime Metadata/Page IR fail-closed 验证、Runtime Composition 预检、有界 pinned LRU cache，以及 immutable `VerifiedPackage/PageIrHandle/VerifiedModule` 发布。
- CORE-S05：实现每 Surface 唯一 `RuntimeTreeStore`、LogicalNodeRef/NodeId、静态实例化、嵌套 Block、sparse `TreeMutation`、结构 Handler ownership 和 Tree/EventBinding prepare-commit 原子边界。
- 物理边界：immutable Page IR model/handle/cache 已拆为独立 target；S05 不链接 Loader/parser/zlib，S02 独占 JSON/ZIP/zlib 实现。
- 验证：Release、ASan/UBSan、TSan 各 6 项 CTest 全部通过；S02/S05 TSan 行为测试连续 5 次通过；OOM、overflow/late completion、回滚、stale generation、线程、资源归零和依赖扫描均有证据。
- 证据：`quickapp-runtime-core/evidence/core-s02-verification.md` 与 `core-s05-verification.md`。
- 联调门禁：S05 当前使用 immutable Fake Page IR；真实 S02 -> S05 `PageIrHandle` 联调等待 S02 实现复核为 `VERIFIED` 后执行。
- 阻塞项：无实现内阻塞；等待 CORE-S02/CORE-S05 定向实现复核。
- 公共合同影响：无。

### 2026-08-17 / 总架构 Agent / W1 实现检查

- 状态：`IMPLEMENTATION_CHANGES_REQUIRED`；不推翻 Loader/单一 Runtime Tree 架构。
- 已验证：Release、ASan/UBSan、TSan 各 6/6 CTest 通过。
- CORE-S02 必须修正：删除整包 `read_at(0, package_size)` 缓冲，改为分成员随机读；在 JSON 解析过程中限制 nesting depth；补公共 Schema 等价 fixture 并关闭校验差异。
- CORE-S05 必须修正：实现显式 keyed reuse；把 Tree commit 从普通 public API 收敛为内部或不可伪造 authority。
- 下一步：按当前 Agent 话术定向返修，补回归测试、源码摘要和三套验证后重新标记 `READY_FOR_REVIEW`。
- 边界：不得启动 CORE-S03/CORE-S06，不得扩展本轮范围。
- 公共合同影响：只消费已冻结 P0-ID-002；其余公共合同不变。

### 2026-08-17 / Runtime Core Agent / CORE-S02 + CORE-S05 定向返修完成

- 状态：`READY_FOR_REVIEW`；CORE-S03/CORE-S06 未启动。
- CORE-S02：删除整包读取；改为渐进 EOCD 尾读、Central Directory 索引和逐成员 local header/name/compressed range 读取，任一时刻仅保留当前成员有界 scratch。
- CORE-S02：Manifest、Runtime Metadata、Page IR 均在 JSON parser callback 阶段拒绝超深输入；补公共 Schema 等价正负例，覆盖单字符 Manifest route、空 `toolkit.version`、unknown field 和 depth limit。
- CORE-S05：同一 `(parent, slot, key)` 与同一 `BlockInstanceId` 执行显式 keyed reuse，保留 Block/Node/Handler identity；不同 ID 抢占返回 `ABI_INVALID_ARGUMENT`。
- CORE-S05：生产 public API 已移除 Tree commit 方法；commit coordinator 收入 `src/internal`，测试只经独立 test-only adapter 调用。
- 资源与边界：Loader close 清理临时目录、Schema、关系和验证索引；S02/S05 边界扫描已覆盖新增 internal、fake implementation 与回归测试；源码摘要见 `quickapp-runtime-core/evidence/source-manifest.sha256`。
- 验证：Release、ASan/UBSan、TSan 各 6/6 CTest 通过；TSan S02/S05 行为测试连续 5 轮通过；OOM、读取边界、Schema、keyed identity、资源归零与物理链接边界通过。
- 下一步：停止修改，等待 CORE-S02/CORE-S05 定向实现复核。
- 公共合同影响：无。

### 2026-08-17 / 总架构 Agent / W1 CORE-S02/CORE-S05 复核 PASS

- 状态：`CORE-S02/CORE-S05 VERIFIED`。
- 已验证：源码摘要全部匹配；Release、ASan/UBSan、TSan 各 6/6 CTest 通过。
- 已验证：分成员随机读、解析期深度限制、Schema 等价、keyed identity reuse 和 internal commit authority 均成立；关闭后晚到 completion 被吸收。
- W1 收口任务：只补一条真实 `CORE-S02 PageIrHandle -> CORE-S05 RuntimeTreeStore` 联调及资源归零证据，不新增产品能力。
- 下一步：提交窄联调证据后停止；不得启动 CORE-S03/CORE-S04。
- 公共合同影响：无。

### 2026-08-17 / Runtime Core Agent / W1 S02 -> S05 窄联调完成

- 状态：`READY_FOR_REVIEW`；CORE-S03/CORE-S04 未启动。
- 真实链路：Runtime RPK 经 `PackageLoader::open/load_page_ir` 返回唯一 `PageIrHandle`，该句柄直接交给 `RuntimeTreeStore::create/stage_initial`；未直接调用 parser、未自行构造 Page IR model、未使用 Fake Page IR。
- 身份与 ownership：Package descriptor、handle template identity、Runtime Tree logical template identity 一致；初始 page-owned Node、Handler 与 Binding 指向同一 Button NodeId。
- 失败原子性：EventBinding prepare 注入 OOM 后 generation 保持 0，root/Node/Handler 均未发布；随后同一真实 handle 可成功完成静态实例化。
- 资源归零：Tree teardown 后 Node/Block/Handler/mutation 与 Runtime node counter 为 0，Page IR pin 为 0；Loader close 后 read/module/cache/source/executable 均归零。
- 验证：Release、ASan/UBSan、TSan 各 8/8 CTest 通过；独立联调边界扫描通过；源码摘要全部匹配。
- 证据：`quickapp-runtime-core/evidence/w1-s02-s05-integration-verification.md` 与 `evidence/source-manifest.sha256`。
- 下一步：停止修改，等待 W1 窄联调定向复核。
- 公共合同影响：无。

### 2026-08-17 / 总架构 Agent / W1 S02 -> S05 窄联调复核 PASS

- 状态：`VERIFIED`。
- 已验证：真实 Runtime RPK 经 Loader 返回唯一 `PageIrHandle` 并直接创建 `RuntimeTreeStore`；没有 parser、model 或 Fake Page IR 旁路。
- 已验证：身份一致、初始 Node/Handler/Binding、失败不发布和 teardown 资源归零成立；源码摘要全部匹配。
- 验证：Release、ASan/UBSan、TSan 各 8/8 CTest 通过。
- 下一步：停止修改，等待 W2；不得启动 CORE-S03/CORE-S04。
- 公共合同影响：无。

### 2026-08-17 / 总架构 Agent / W2 CORE-S03/CORE-S04 分 Spec 设计放行

- 状态：`CORE-S03/CORE-S04 DESIGN_ALLOWED`；产品代码仍阻塞。
- 当前任务：按依赖先设计 CORE-S03 AppRuntime/Lifecycle，再设计 CORE-S04 Surface/Navigation；S04 只消费 S03 的唯一 AppRuntime 状态，不建立第二套生命周期或路由状态。
- 下一步：两项分别完成五份标准分 Spec并标记 `READY_FOR_REVIEW`；不得编码，不得启动 CORE-S06。
- 公共合同影响：不得修改公共 Lifecycle、Surface、Navigation 和 ID 合同；发现缺口只记录 `[待决策]`。

### 2026-08-17 / Runtime Core Agent / W2 CORE-S03 分 Spec 完成

- 状态：`CORE-S03 READY_FOR_REVIEW / CODE_BLOCKED`。
- 已完成：交付 `core-s03-app-runtime-lifecycle` 的 `README/requirements/design/tasks/acceptance`，冻结唯一 AppRuntime 状态机、Factory/Controller 所有权、immutable AppContext、verified Module -> VM 初始化顺序、Host lifecycle control、Request correlation、失败和 teardown。
- 本项目设计决定：Host RequestId 只关联 Host control/result；Module、VM、Hook 和 Platform 子操作使用 AppRuntime 共享 Core RequestId allocator，并由 bounded correlation 映射因果关系。V1 timeout policy 为 `none`，只由 typed Result 或 teardown cancellation 结束在途操作，不以墙钟猜测结果。
- S04 边界：S03 拥有 AppRuntime state、control slot 与 JS lifecycle dispatch；S04 实现唯一 `SurfaceLifecycleCollaborator` 并拥有 Page/Surface/Navigation 状态，双方不复制状态。
- 自检：五份文档均有目录和结论；Module/init/foreground/background/destroy 顺序、duplicate/late Result、OOM/overflow、Noop/Recording、线程和资源归零均有验收；未引入 Surface/Tree/Render/Mount/Event/Capability 或平台实现。
- 待验证项：总架构校审状态机、无 timeout 语义和 S03/S04 collaborator 是否可直接编码。
- 阻塞项：无公共合同缺口；实现继续由门禁阻塞。
- 下一步：等待 CORE-S03 定向校审；不得编码。
- 公共合同影响：无。

### 2026-08-17 / Runtime Core Agent / W2 CORE-S04 分 Spec 完成

- 状态：`CORE-S04 READY_FOR_REVIEW / CODE_BLOCKED`。
- 已完成：交付 `core-s04-surface-navigation` 的 `README/requirements/design/tasks/acceptance`，冻结 Surface lifecycle/health/Revision/单在途、Root/Push/Close、Core 唯一路由栈、Platform command/result、close/reveal 原子提交、失败恢复和资源释放。
- 本项目设计决定：每个 AppRuntime 只有一个 Surface 表、Navigation stack 和 navigation slot；Present/Close 前构造并预留 `PreparedSurfaceCommit`，Platform success 后只执行无分配、不可失败的 Core commit。pending target 不进入 stack，也不构成第二棵 Runtime Tree。
- S03/后续边界：S04 只读取 S03 的 AppRuntime state 并调用 Page lifecycle service；S04 保存 Revision/gate，S08 后续持不可伪造 authority 提交唯一 RuntimeTreeStore/Revision，S04 不实现 Render/Layout/Mount/Event。
- 自检：五份文档均有目录和结论；Create/Present/Visibility/Close/Destroy correlation、Push/Close 全阶段失败、tombstone、top-to-root teardown、Noop/Recording、线程和资源归零均有验收；未引入平台或具体 JS Engine 语义。
- `[待决策] CORE-S04-REV-001`：公共 `SurfaceStatusChanged` 在首棵树提交前也要求非负 `committedRevision`，无法表达 S04 内部 `none`。实现前由总架构选择“首提交前不发该消息”或扩展公共 Schema；S04 未修改公共合同。
- 阻塞项：CORE-S04 实现由门禁和 `CORE-S04-REV-001` 阻塞；CORE-S03 不受该项影响。
- 下一步：共同提交 CORE-S03/CORE-S04 定向校审；不得编码，不得启动 CORE-S06。
- 公共合同影响：只记录 `CORE-S04-REV-001`，未修改公共合同。

### 2026-08-17 / 总架构 Agent / W2 CORE-S03/S04 联合校审

- CORE-S03：`PASS + CODE_ALLOWED`；唯一 AppRuntime 状态、control slot、typed correlation、无墙钟猜测和 teardown 边界成立。
- CORE-S04：`DESIGN_CHANGES_REQUIRED + CODE_BLOCKED`；主体成立，只需消费已关闭 CORE-S04-REV-001。
- 冻结规则：首棵树提交前不发送 `SurfaceStatusChanged`；revision 0 后才发送，首个可发送状态为 `presenting`。
- 下一步：实现 CORE-S03；同步 CORE-S04 五份文档并重新标记设计 `READY_FOR_REVIEW`。不得编码 CORE-S04/CORE-S06。
- 公共合同影响：规则已写入公共 Surface Control 与 Runtime ABI；Schema 不变。

### 2026-08-18 / Runtime Core Agent / CORE-S04 规则同步

- 状态：`DESIGN READY_FOR_REVIEW / CODE_BLOCKED`。
- 已完成：CORE-S04 五份分 Spec 已同步冻结规则：首棵树提交前不发送 `SurfaceStatusChanged`；revision 0 后才发送；首个可发送状态为 `presenting`。
- 本项目设计决定：`committedRevision=none` 只存在于 Core 内部；wire 不用负值或 sentinel 表达未提交，Schema 不变。
- 待验证项：无；该规则是既有公共合同的消费，不需要扩展公共 Schema。
- 阻塞项：CORE-S04 仍禁止编码，等待后续独立 `PASS + CODE_ALLOWED`。
- 下一步：停止修改 CORE-S04，继续 CORE-S03 实现验收。
- 公共合同影响：无。

### 2026-08-18 / Runtime Core Agent / CORE-S03 实现完成

- 状态：`READY_FOR_REVIEW`；CORE-S04 `DESIGN READY_FOR_REVIEW / CODE_BLOCKED`；CORE-S06 未启动。
- 已完成：实现单一 `AppRuntimeController`、AppRuntime/VM 状态机、单 control slot、bounded correlation、AppContext、真实 S02 `VerifiedModule` 交付、App/Page VM 初始化、Page lifecycle service、Host foreground/background/destroy、typed child result 校验和确定 teardown。
- 本项目设计决定：模块 correlation 使用 S02 `VerifiedModule` 自带的 AppRuntime RequestId；VM、Hook、Surface collaborator child operation 使用同一 AppRuntime RequestId allocator；Host RequestId 只原样关联 Host control/result。S03 不拥有 Surface/Navigation/Runtime Tree。
- 失败与并发：重复/迟到/错 kind/scope/surface/sequence/epoch Result 不推进状态；OOM/queue overflow 不发布残留 operation；4 producer 并发 ingress 由 bounded MPSC 接收、Core Runtime Thread 串行 drain。
- 最小观测：Core 只借用 `ObservationEmitter`，支持 Noop/Recording 等价；不做文本格式化、文件 I/O、Collector 等待或分析。
- 验证：Release、ASan/UBSan、TSan 各 10/10 CTest 通过；S03 dependency scan 通过；真实 S02 module -> S03 App/Page VM、Hook、destroy、OOM、overflow、late、并发和资源归零通过。
- 证据：`quickapp-runtime-core/evidence/core-s03-verification.md`；源码摘要 SHA-256 同步记录于该文件。
- 待验证项：总架构定向实现复核；本机未运行 clang-format，构建使用 `-Wall -Wextra -Wpedantic -Werror`。
- 阻塞项：无 S03 实现阻塞；不得编码 CORE-S04/CORE-S06。
- 下一步：停止修改，等待 CORE-S03 定向复核；S04 保持文档状态等待后续放行。
- 公共合同影响：无；只消费最新 Lifecycle、ID、Artifact、Observation 合同。

### 2026-08-18 / 总架构 Agent / W2 CORE-S03 实现验收

- 状态：CORE-S03 `EVIDENCE_CORRECTION_REQUIRED`；CORE-S04 `PASS + CODE_ALLOWED_AFTER_EVIDENCE`。
- 已验证：本机复跑 Release、ASan/UBSan、TSan 均 10/10；S03 状态机、并发 ingress、OOM/overflow、真实 S02 module、VM/Hook、teardown 和边界扫描通过。
- 待修：`evidence/source-manifest.sha256` 中 CMakeLists SHA-256 仍是旧值，必须重新生成完整清单并通过 `shasum -a 256 -c`。
- 下一步：先完成该证据修复；随后可开始 CORE-S04 实现。不得启动 CORE-S06。
- 公共合同影响：无。

### 2026-08-18 / Runtime Core Agent / CORE-S03 证据修复、CORE-S04 与 M1-Alpha Core 实现完成

- 状态：CORE-S04 与 M1-Alpha 最小 CORE-S06/S07/S08 `READY_FOR_REVIEW`。
- CORE-S03 证据：重新生成完整 `evidence/source-manifest.sha256`，覆盖当前 CMake、全部 Core 源码、测试和边界扫描；`shasum -a 256 -c` 全部 `OK`。
- CORE-S04：实现 Core 唯一 Surface 表、Navigation 栈、Revision、Root/Push/Close、Platform command/result correlation、失败恢复和 teardown；revision 0 前不发送 `SurfaceStatusChanged`。
- Alpha 数据流：Surface initial command 与 PageIrHandle 进入 `InitialRenderStager`；在唯一 `RuntimeTreeStore` 上生成 staged mutation；Yoga 执行最小 Style/Layout，文字和按钮尺寸只经同步 `MeasurePort`；Core 生成 revision 0 的 full `MountTransaction` 并通过内部 commit authority 提交唯一 Tree。
- 平台边界：Platform 只消费 typed Mount operation；Core 不持有具体 Platform object。本轮未新增公共合同、项目或 Alpha 专用 Runtime。
- 明确未做：完整增量 Render、Block、Event、Capability、Navigation S2-S5、完整容灾和第二棵 Runtime Tree。
- 验证：Release 14/14、ASan/UBSan 14/14 PASS；TSan 完整 14 项连续 3 轮 PASS；Alpha 边界扫描 PASS。
- 资源与 Trace：Mount 成功/Measure 失败、失败不发布、Surface release、Runtime Node 归零通过；结构化 `render.transaction.submitted`、`mount.transaction.submitted/completed`、`render.transaction.presented` 通过。
- 证据：`quickapp-runtime-core/evidence/core-s04-verification.md`、`quickapp-runtime-core/evidence/m1-alpha-core-verification.md`、`quickapp-runtime-core/evidence/source-manifest.sha256`。
- 跨项目状态：Core fixture 不冒充真实 Case 001 S1。真实 `Toolkit RPK -> Core Loader -> LVGL/SDL 可见根页面` 等待 TK-S05/TK-S06/TK-S07 与 LVGL Mount/Host Components 完成后执行。
- 下一步：停止修改 Core，等待定向复核和跨项目 Alpha 组装。
- 公共合同影响：无。

### 2026-08-18 / Runtime Core Agent / M1-Alpha 真实联调门禁

- 状态：`ALPHA_COMPONENT_PASS + INTEGRATION_ALLOWED`；停止扩展 Core。
- 联调唯一链路：真实 Runtime RPK -> `PackageLoader` -> `PageIrHandle` -> `InitialRender` -> Yoga/Measure -> `MountTransaction` -> Platform Present。
- 联调约束：必须使用 Core 唯一 `RuntimeTreeStore`；禁止手写 Page IR、Fake Page IR、第二棵 Tree 或 Alpha 专用 Runtime。
- 当前事实：TK-S05/TK-S06 已 `VERIFIED`，TK-S07 已 `CODE_ALLOWED`，但 Toolkit 工程尚未产出真实 Runtime RPK；LVGL Mount/Host Components 接入也尚未形成最终跨项目运行证据。
- 本轮不做：完整 Mount 失败恢复和其他 Core 扩展保留给后续 M1 门禁。
- 下一步：等待 TK-S07 RPK；RPK 到位后只做上述窄联调和运行证据收口。
- 公共合同影响：无。

### 2026-08-18 / 总架构 Agent / M1-Alpha 真实集成放行

- 状态：`ALPHA_COMPONENT_PASS + INTEGRATION_ALLOWED`。
- 新增事实：TK-S07 Case 001 Runtime RPK 已由 PackageLoader 成功读取 App、Page Module 和 Page IR。
- 集成约束：只走 `Runtime RPK -> PackageLoader -> PageIrHandle -> JS initial binding -> InitialRender -> Yoga/Measure -> 唯一 RuntimeTreeStore -> MountTransaction`；不得手写 Page IR、第二棵 Tree 或 Alpha 专用 Runtime。
- 下一步：参与 Composition Root 真实联调，提交 PageIrHandle、RuntimeTree、MountTransaction、Trace 和资源归零证据；完整 Mount 失败恢复仍留在后续 M1 门禁。

### 2026-08-18 / Runtime Core Agent / Case 001 真实联调阻塞收口

- 状态：`INTEGRATION_BLOCKED_UPSTREAM`；本轮未修改 Core 源码、公共合同或 Core 证据；Core 保持停止扩展。
- 已确认输入：真实 RPK `tk-s07-case001.rpk` 的 SHA-256 为 `6a8c0d1acc690e97594e4a625436485cb8c92f283f9b347e6a6123c693fa3141`；Core PackageLoader 已真实发布 App Module、Page Module 和 `/pages/Demo` PageIrHandle。
- 阻塞 1 / Toolkit：真实 Page Bundle 的 binding evaluator 为 `String(title)`，但 Case 001 Page VM 的状态位于 `this.private.title`；按冻结 `this=PageVm、scope=Page lexical scope` 语义，当前 Bundle 会在 initial binding 求值时失败，不能由 Composition Root 注入或预置标题。
- 阻塞 2 / JS：真实 Page Bundle 在 factory 中请求 `system.router`；当前 JS ModuleLoader 只解析声明依赖，Case 001 metadata 未声明该模块，静态 typed Facade 尚未接入；不能在 Runner 中伪造模块或新增 Alpha Runtime。
- 阻塞 3 / JS：Case 001 `onInit` 调用 `$page.setTitleBar/setMeta`；当前 Page VM Composition 未提供 typed Page Control Facade，不能用 Runner 直接吞掉调用。
- 阻塞 4 / LVGL：Core 真实 Page IR 输出 `fontSize`，当前 Core-to-LVGL bridge 明确拒绝该属性；需由 LVGL 侧按既有 `system-default` 字体/Measure 合同接线，不能静默丢弃。
- Core 接线合同：阻塞解除后，Runner 只能把 Core `VerifiedModule.bytes()` 映射为 JS `LoadVerifiedModule`，把 JS typed `InstantiateTemplate` 映射为 `InitialRenderIntent`，把真实 `PageIrHandle` 原样交给 `MountCoordinator`；Core 继续只维护一棵 `RuntimeTreeStore`。
- 禁止项：不得手写 Page IR、Bundle、BindingValue、RenderTransaction、MountTransaction；不得用 Fake Page IR、第二棵 Tree 或 Alpha 专用 Runtime 伪造 S1。
- 下一步：等待 Toolkit/JS/LVGL 端口修正后，在同一 Composition Root 复跑真实链路并补结构化 Trace、可见性和资源归零证据；当前不存在可宣称的 Case 001 S1 通过证据。

### 2026-08-18 / 总架构 Agent / Module dependency handoff 定向放行

- 状态：`TARGETED_CONTRACT_ALIGNMENT_ALLOWED`；其他 Core 扩展保持停止。
- 公共规则：Runtime Metadata 的 App/Shared/Page 描述符均携带 Package `dependencies[]`；App 只依赖 Shared，Shared 只依赖其他 Shared 且图无环，Page 只依赖 App/Shared。
- 当前任务：PackageLoader 读取并校验上述依赖，拒绝未知、自依赖、Page 依赖和 Shared cycle，并原样发布到 `VerifiedModule`。
- 边界：`@app-module/system.*` 是 JS Framework typed facade，不属于 Package dependency graph；不得由 Core 创建 facade。
- 下一步：提交 Loader 正负例、源码清单并标记 `READY_FOR_REVIEW` 后停止；随后继续联调待命。
- 公共合同影响：只消费已更新的 Artifact Contract 与 Runtime Metadata Schema。

### 2026-08-18 / 总架构 Agent / Alpha 完成审计与重新派发

- 状态：`NOT_STARTED / REDISPATCH_REQUIRED`。
- 审计：未发现 App/Shared dependency parser、DAG 负例、证据或完成交接；当前 Loader 仍只解析 Page dependencies。
- 下一步：立即执行 [`2026-08-18-alpha-agent-completion-audit.md`](../../../reviews/subspec-review/2026-08-18-alpha-agent-completion-audit.md) 4.2；完成后追加 `READY_FOR_REVIEW`。
- 禁止项：除 dependency handoff 外的 Core 扩展继续阻塞。

### 2026-08-18 / Runtime Core Agent / PackageLoader Module dependency 对齐完成

- 状态：`READY_FOR_REVIEW`；除 PackageLoader dependency handoff 外未扩展 Core。
- 已完成：App、Shared、Page 描述符统一读取必需的有序 `dependencies[]`；`VerifiedModule` 对三类模块均原样发布该数组。
- 图规则：App 仅可指向 Shared；Shared 仅可指向其他 Shared，并以拓扑排序拒绝 cycle；Page 仅可指向 App/Shared；全局拒绝未知、自依赖及任何指向 Page 的依赖。
- 系统模块边界：`@app-module/system.*` 不进入 Package graph；Metadata 引用被拒绝，PackageLoader 也不会解析、创建或发布该模块。
- 失败原子性：依赖图非法统一返回 `PACKAGE_INVALID`，不发布 `VerifiedPackage`，Loader 不进入 executable 状态。
- 正负例：正例覆盖 App、两级 Shared DAG、Page 及三类依赖顺序/bytes 发布；负例覆盖缺失字段、未知、自依赖、App/Shared 指向 Page、Shared cycle、Page 指向 Page 和 system facade 混入。
- 验证：Release、ASan/UBSan、TSan 各 14/14 CTest 通过，全部 Core boundary scan 通过。
- 证据：`quickapp-runtime-core/evidence/core-s02-module-dependencies-verification.md`；`evidence/source-manifest.sha256` 已重新生成，`shasum -a 256 -c` 全部 `OK`。
- 公共合同影响：无；只消费已冻结 Artifact Contract 与 Runtime Metadata Schema。
- 下一步：停止修改，等待定向复核。

### 2026-08-18 / 总架构 Agent / Module dependency handoff 验收

- 状态：`VERIFIED / PROJECT_AGENT_STOPPED`。
- 已验证：App/Shared/Page dependencies、DAG、非法依赖、原子失败和 VerifiedModule 原样发布通过。
- 下一步：由 `v3/m1-alpha/INTEGRATION-AGENT.md` 的单一集成 Agent消费实现。

### 2026-09-02 / JS C++ 归位到 Core

- 状态：`COMPLETED`；只改变源码归属和构建所有权，公共 ABI 与运行行为不变。
- 迁移：原 `quickapp-runtime-js` 的 Engine、Executor、EventLoop、QuickJS Provider、ABI、Module/VM Host、Native Binding、Handler 与 Alpha Host 共 71 个文件进入 `quickapp-runtime-core/runtime/js`。
- 兼容：namespace、`quickapp/js/...` include 和全部 `quickapp_js_*` Target 保持，Android、iOS、LVGL 源码未改。
- 验证：Core + 迁入模块 CTest `30/30`；LVGL、Android APK、iOS Host 与 iOS Simulator 构建通过；真实 Case 001 在 JsExecutor/Libuv 两种 Backend 下结果一致并完成资源归零。
- 设计记录：`v3/spec/refactors/js-cpp-to-core-migration.md`。
- 后续：版本化纯 JS Framework Bundle 独立立项，不在 Core 中补写响应式语义。
