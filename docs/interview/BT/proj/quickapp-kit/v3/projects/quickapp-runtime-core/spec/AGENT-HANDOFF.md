# Runtime Core Spec Agent Handoff

> 状态：CORE-S01 `VERIFIED`；CORE-S02 与 CORE-S05 `DESIGN_ALLOWED`。

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
