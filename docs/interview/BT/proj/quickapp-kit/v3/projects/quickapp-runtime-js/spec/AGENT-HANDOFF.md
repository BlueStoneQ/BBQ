# JS Runtime Spec Agent Handoff

> 状态：JS-S01 `VERIFIED`；JS-S02 `IMPLEMENTATION_CORRECTION_REQUIRED`；JS-S03/JS-S04 `DESIGN_CHANGES_REQUIRED`。

## 目录

- [目标](#目标)
- [交接记录](#交接记录)

## 目标

代码目录：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/`

只读：v3 公共 Spec、Toolkit Artifact 和 Cases；可写：本项目 `AGENT-HANDOFF.md`；项目总 Spec gate 通过后可写本项目 `spec/subspecs/<name>/`；对应分 Spec 通过后才可写上述代码目录。

平台总 Spec 必读：`../../../spec/requirements.md`、`../../../spec/design.md`、`../../../spec/tasks.md`、`../../../spec/acceptance.md`。

启动阅读：本文件、`./README.md`、`../../../README.md`、`../../../AGENT-WORK-BOARD.md`、`../../../spec/v1-scope-and-acceptance.md`、`../../../spec/contracts/artifact-contract.md`、`../../../spec/contracts/runtime-abi.md`、`../../../spec/contracts/application-lifecycle-contract.md`、`../../../spec/contracts/render-contract.md`、`../../../spec/contracts/event-contract.md`、`../../../spec/contracts/capability-module-contract.md`、`../../../spec/contracts/runtime-composition-contract.md`、`../../../spec/contracts/observation-contract.md`、`../../../spec/contracts/schemas/runtime-composition.schema.json`、`../../../spec/contracts/schemas/README.md`。

当前总 Spec 只交付：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。

目标：定义 JS Executor 与 JS Framework 的实现，覆盖公共 JS Module ABI、app/shared/page 加载、App/Page Hook、typed Module Facade、VM/evaluator/handler export 校验、Handler 注册、Binding flush 和 Runtime ABI。

JS 不创建平台对象、不持有运行时 NodeId；更新通过 `RenderTransaction`；`system.router/prompt/device` 通过 typed Capability；`$page.setTitleBar/setMeta` 通过 typed Page Control。

## 交接记录

### 2026-08-15 / 总架构 Agent

- 历史事件：建立 JS Runtime 项目入口；当时尚未启动项目总 Spec。
- 意图：把 JS 执行和平台渲染解耦，明确 JS 到 Core 的数据合同。
- 历史门禁：现已解除；当前以最新总 Spec 门禁为准。

### 2026-08-15 / 总架构 Agent / 需求回归校准

- Lifecycle：严格实现 App `onCreate/onShow/onHide/onDestroy` 与 Page `onInit/onReady/onShow/onHide/onDestroy` 的公共时序。
- Context：消费 immutable AppContext/PageContext；业务 state 不得写入 Context。
- Initial render：`onInit/onReady` 的同步写入和一轮 microtask flush 必须并入首个 `InstantiateTemplate`。
- Capability：提供固定 typed Facade 和 Promise/callback 适配，不实现通用 module/method JSON Bridge。
- 历史门禁：该阶段已完成；当前以最新校审门禁为准。

### 2026-08-15 / 总架构 Agent / 项目总 Spec 初稿

- 已完成：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。
- 核心边界：JS 维护 VM、Binding/Block 依赖和 Handler，不维护 VNode Tree，不持有 NodeId。
- 下一步：独立校审 Module ABI、Dirty/microtask、单在途 Render、事件和销毁语义。
- 门禁：校审通过前不得编写分 Spec，不得初始化产品代码。
- `[已冻结] P0-ADDR-001`：JS 只提交 Owner + TemplateBindingId/TemplateHandlerId，不持有或提交 target descriptor。

### 2026-08-16 / 总架构 Agent / 首轮项目总 Spec 校审修订

- 新增唯一模块入口：JS 只执行 Core `VerifiedModulePort` 交付的 immutable bytes，并返回 `LoadVerifiedModuleResult`；page export 对照 expected ID 集合，不读取 Page IR。
- 生命周期：`AppContext/SurfaceContext/LifecycleDispatch -> LifecycleResult` 是唯一闭环。
- Handler 删除：可回滚删除使用 `live -> retiring -> released`；`rejected/cancelled` 恢复，已提交结果后释放。
- 当前门禁：JS Runtime `DESIGN_ALLOWED`；产品代码等待对应分 Spec 独立校审 PASS。

### 2026-08-16 / 总架构 Agent / V1 范围校准

- `[已冻结]`：JS V1 只实现模块加载、VM/lifecycle、Binding/Block/Handler 与 typed Runtime ABI。
- 不增加 VNode Tree、通用 Bridge、Agent 能力或平台私有逻辑。

### 2026-08-16 / 总架构 Agent / 平台总 Spec 修正同步

- `[已冻结]`：Capability 封闭集合包含 NavigationPush、NavigationClose、ShowToast、DeviceGetInfo；JS Facade 必须覆盖 `router.back -> closeRoute`。
- Observation Contract/Schema 由总架构维护；JS 只按合同产出 marker，缺口通过 Handoff 提议。
- `CAP-DEVICE-001` 进入 typed device Facade 验证；当前只允许设计分 Spec。

### 2026-08-16 / 总架构 Agent / 第二次复核修正

- Case 001 已移除 device；`CAP-DEVICE-001` 拥有独立 success/failure/cleanup 验收。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 定向复核 PASS

- 平台总 Spec 定向复核结果：P0/P1/P2 为 0。
- 当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`；启动 JS-S01 分 Spec 设计，禁止产品编码。

### 2026-08-16 / 总架构 Agent / P0-CUT-001 同步

- `[已废弃，被后续 JS Engine 边界校准取代]`：原表述把 JS Runtime 写成固定 Runtime 部件；其中 typed ABI/Registry 与禁止第二条 Bridge 仍有效。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待可裁剪组成定向校审。

### 2026-08-16 / 总架构 Agent / JS Engine 边界校准

- `[已冻结]`：JS Framework 是必选 Runtime Service，但不属于 C++ Kernel；具体 JS Engine 是可替换 Provider。
- JS-S01 改为 `JsEnginePort + Fake Engine 合同测试 + QuickJS V1 Provider`；一个产品只能链接一个 Engine，不做运行时热切换。
- 本事件取代上一条不精确表述；当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`。

### 2026-08-16 / 总架构 Agent / 第四次复核修正

- `[已冻结]`：JS-S01 唯一拥有 QuickJS External Function Adapter；JS-S02 只依赖 `JsEnginePort` Native Function Binding 并处理 typed ABI。
- Runtime Composition Manifest 必须记录一次 `runtime.js-framework`；当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 第五次定向复核 PASS

- P0/P1/P2 均为 0；当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`。
- 允许设计 JS-S01；禁止产品编码。

### 2026-08-16 / 总架构 Agent / 最小可观测合同

- JS-S01 接入单调时钟与本地 ObservationEmitter；复用公共 Sink，不形成第二条业务 Bridge。
- Noop/Recording 观测必须行为等价；当前授权不变：`DESIGN_ALLOWED + CODE_BLOCKED`。

### 2026-08-16 / JS Runtime Agent / JS-S01 分 Spec 启动

- 状态：IN_PROGRESS
- 已完成：读取平台总 Spec、Runtime ABI、Observation、Runtime Composition、Lifecycle/Threading 公共合同和 JS Runtime 项目总 Spec。
- 新增事实：无；JS-S01 可在冻结公共合同内完成设计。
- 本项目设计决定：待 JS-S01 分 Spec 冻结。
- 待验证项：Engine Port 最小接口、JS Executor 队列背压、QuickJS 资源释放顺序、Noop/Recording 观测等价性。
- 阻塞项：无。
- 下一步：编写 `js-s01-engine-service` 的五份分 Spec 文档并完成一致性自检。
- 公共合同影响：无。

### 2026-08-16 / JS Runtime Agent / JS-S01 分 Spec 完成

- 状态：READY_FOR_REVIEW
- 已完成：新增 `subspecs/js-s01-engine-service/README.md`、`requirements.md`、`design.md`、`tasks.md`、`acceptance.md`。
- 新增事实：产品代码目录当前为空；本轮只交付分 Spec，未初始化代码。
- 本项目设计决定：`[已冻结]` 每个 AppRuntime 一个串行 Engine Service、一个 Engine instance 和一个主 Context；Engine/Context/Value 只归 JS Executor；公共层使用 opaque Context/Value 与 Native Function Binding；External Function 只在 QuickJS Provider；Executor 有界 FIFO；shutdown 按 Value/Binding -> Context -> Engine -> Executor 清理；Fake 与 QuickJS 共用 Engine Contract Suite；Noop/Recording 观测行为等价。
- 待验证项：`[待验证]` 编码阶段验证 QuickJS 真实版本 identity、External Function Adapter、microtask budget、OOM、并发 admission、sanitizer 资源回落和单 Engine link map。
- 阻塞项：无。
- 下一步：提交 JS-S01 独立校审；PASS 且工作看板显式设置 `CODE_ALLOWED` 后再实现。JS-S02 继续等待 JS-S01 门禁。
- 公共合同影响：无；未新增 Schema、marker、RuntimeError 或业务 ABI。
- 自检：5 份文档均有目录和结论；17 个相对链接无断链；公共 Schema 测试通过；需求 R01..R18 均映射到验收出口；未修改公共合同或产品代码。

### 2026-08-16 / 总架构 Agent / [已冻结] P0-EVENT-002

- 状态：READY_FOR_REVIEW
- 已完成：冻结输入事件因果关联；公共 Event/ID/Observation 合同与 Schema 已更新并通过合同测试。
- 新增事实：JsEventDispatch 必带输入 `RequestId`；JS-S08 执行 Handler 时保留该同步因果上下文，JS-S05/S07 产生的同步状态 flush 与 Render Trace 继续携带该 ID。
- 本项目设计决定：异步任务不自动继承输入 `RequestId`，观测仍不是第二条业务 Bridge。
- 待验证项：JS-S08/S07 覆盖目标与冒泡共享 ID、连续输入隔离和异步不继承。
- 阻塞项：无；不改变 JS-S01 当前边界。
- 下一步：相关后续分 Spec 启动时读取最新公共合同。
- 公共合同影响：已冻结，无需项目 Agent 修改公共文件。

### 2026-08-16 / JS Runtime Agent / S1-JS-001 定向修订完成

- 状态：READY_FOR_REVIEW
- 当前门禁：`CODE_BLOCKED`；本轮未编写产品代码。
- 已完成：重新读取首批分 Spec 校审的 `S1-JS-001` 与公共 Observation Contract，只修订 JS-S01 五份文档。
- 逐条关闭证据 1：`requirements.md` 的 R17 已将 `TraceSink.emit noexcept + nonblocking + no reentry` 改为 Composition Root 注入前置合同，并删除“真实 throw/block 可由 Engine 隔离”的承诺。
- 逐条关闭证据 2：`design.md` 明确 Emitter 不使用 catch、超时、隔离线程或 watchdog 兜底；真实 throw/block/reentry 属于非法实现，不是 Runtime 可恢复场景。
- 逐条关闭证据 3：`tasks.md` 保留 Noop、正常 Recording、容量满、拒绝保留、丢样、关闭和重入意图检查；新增接口签名、静态检查、受控替身和平台集成门禁。
- 逐条关闭证据 4：`acceptance.md` 的 A20 覆盖 Recording 容量满/拒绝/丢样/关闭等价性；A38 只验证受控重入意图在注入门禁被拒绝；真实 throw/block/reentry 明确不进入 Runtime 恢复测试。
- 逐条关闭证据 5：`README.md` 已同步注入前置合同与 `READY_FOR_REVIEW + CODE_BLOCKED` 状态。
- 架构不变：Engine Port、串行 Executor、Engine/Context/Value 所有权、QuickJS External Function Adapter、Fake/QuickJS 合同均未改变。
- 自检：五份文档均包含 Sink 前置合同；17 个相对链接无断链；公共 Schema 合同测试通过；无空白错误。
- 阻塞项：无。
- 下一步：停止设计修改，等待 `S1-JS-001` 定向复核；复核 PASS 前不编码、不启动 JS-S02。
- 公共合同影响：无；未修改公共合同、Schema、marker、RuntimeError 或 Runtime ABI。

### 2026-08-16 / 总架构 Agent / JS-S01 定向复核 PASS

- 状态：`PASS + CODE_ALLOWED`。
- 已完成：S1-JS-001 已关闭；Sink 的 noexcept/nonblocking/no-reentry 是注入前置合同，未承诺恢复真实 throw/block/reentry。
- 新增决策：实现必须消费 `P0-OBS-002`，Observation wire timestampNs 使用 run-relative safe integer。
- 阻塞项：无；JS-S02 仍不得提前实现。
- 下一步：严格按 JS-S01 tasks 实现并提交证据。
- 公共合同影响：无。

### 2026-08-17 / 总架构 Agent / JS-S01 实现预检查

- 状态：`EVIDENCE_REQUIRED`；代码不要求推翻，JS-S02 继续阻塞。
- 已验证：Debug、ASan/UBSan、TSan 各 3/3 CTest 通过；Fake/QuickJS 合同、Composition probe 与边界扫描均通过。
- 缺口：JS Agent 尚未提交实现完成 Handoff，也未提交包含代码版本、QuickJS 版本、构建配置、运行环境和资源回落的正式 evidence。
- 下一步：只补完成交接和 evidence，并确认 acceptance 全项映射；完成后重新标记 READY_FOR_REVIEW。
- 公共合同影响：无。

### 2026-08-17 / JS Runtime Agent / JS-S01 实现完成

- 状态：`READY_FOR_REVIEW`；JS-S02 未启动，继续阻塞。
- 实现范围：完成 `JsEnginePort`、串行有界 Executor、一个 AppRuntime 一个 `JsEngineService`、Engine/Context/Value 所有权、Native Function Binding、Fake Engine、QuickJS V1 Provider、External Function Adapter、microtask budget、最小 Observation 与确定性销毁。
- 验收覆盖：JS-S01 `A01..A43` 已逐项映射到正式 evidence；Fake/QuickJS common suite 与专项合同测试共 `17/17 PASS`。
- 三套验证：Debug、ASan/UBSan、TSan 均为 CTest `3/3 PASS`，覆盖合同测试、QuickJS Composition probe 与边界扫描。
- 依赖与环境：QuickJS 固定为 `2026-06-04`；正式 evidence 已记录源文件版本摘要、构建配置、macOS/arm64、Xcode、Apple Clang 与 CMake 版本。
- Composition/link 边界：Composition Manifest 已通过公共 Schema 与语义校验；API-only 构建不依赖 QuickJS；产品 Composition 只链接一个 Engine Provider；公共层未暴露 QuickJS、JNI、UIKit、LVGL 或 libuv 类型。
- 资源归零：重复创建/销毁、Context 泄漏回收、未释放 Value/Binding 失效、有界队列清空、失败态停止与 sanitizer 验证均通过，销毁后 Engine/Context/Value/Binding/任务队列归零。
- 正式证据：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/evidence/js-s01-implementation-evidence.md`、`source-manifest.sha256`、`runtime-composition.json`；源码摘要复核全部通过。
- 范围确认：未实现 JS-S02、Runtime ABI、Module Loader、Binding/Render 或平台 Host 代码。
- 公共合同影响：无；未修改公共 Schema、marker、RuntimeError 或业务 ABI。
- 下一步：等待 JS-S01 独立实现复核；复核结论前不启动 JS-S02。

### 2026-08-17 / 总架构 Agent / JS-S01 实现复核 PASS

- 状态：`VERIFIED`；F0 已完成。
- 已完成：源码摘要复核通过；Debug、ASan/UBSan、TSan 均重新构建并通过 3/3 CTest；API-only 构建通过。
- 已验证事实：正式 evidence 已覆盖 A01..A43、QuickJS 2026-06-04、单 Engine Composition、资源归零和边界扫描。
- 阻塞项：无；JS-S02 仅开放设计，产品代码继续阻塞。
- 下一步：设计 JS-S02 五份标准分 Spec，完成后标记 `READY_FOR_REVIEW`；不得编码 JS-S02，不得启动 JS-S03。
- 公共合同影响：无。

### 2026-08-17 / JS Runtime Agent / JS-S02 分 Spec 启动

- 状态：`IN_PROGRESS + CODE_BLOCKED`。
- 当前任务：只设计 JS-S02 Runtime ABI Client，交付五份标准分 Spec 文档。
- 固定边界：External Function Adapter 继续唯一归属 JS-S01 QuickJS Provider；JS-S02 只通过 `JsEnginePort` Native Function Binding 提供 typed ABI、`EnqueueResult`、callback admission、request/result 关联与销毁边界。
- 阻塞项：无。
- 下一步：冻结版本、字段、线程、所有权、准入、typed Result 和销毁合同；不编码、不启动 JS-S03。
- 公共合同影响：无。

### 2026-08-17 / JS Runtime Agent / JS-S02 分 Spec 完成

- 状态：`READY_FOR_REVIEW + CODE_BLOCKED`；JS-S03 未启动。
- 已完成：新增 `subspecs/js-s02-runtime-abi-client/README.md`、`requirements.md`、`design.md`、`tasks.md`、`acceptance.md`。
- 本项目设计决定：`[已冻结]` Runtime identity 为 `quickapp-kit-runtime-v1`，消息 `schemaVersion=1`；JS -> Core 与 Core -> JS 均使用 closed typed union，不存在通用 envelope。
- 本项目设计决定：`[已冻结]` 14 个 Native Function 全部通过 `JsEnginePort` 注册；13 个消息入口返回同步 typed `EnqueueResult`，`supportsCapability` 只读 App JS 执行前冻结的 immutable snapshot。External Function Adapter 仍唯一位于 JS-S01 QuickJS Provider。
- 本项目设计决定：`[已冻结]` JS-S02 消费 AppRuntime Identity 注入的共享 `RequestIdSource`，不自建局部序列；pending 按 RequestId/TransactionId、expected kind、Surface 和 generation 关联且容量固定。
- 本项目设计决定：`[已冻结]` Core callback 只做 typed admission 后异步进入 JS Executor；typed callback slot 属于 AppRuntime 模块级，Surface 销毁只取消其 pending completion 和 generation，不误删全局 slot。
- 本项目设计决定：`[已冻结]` teardown 顺序为关闭双向 admission -> 反向解绑 Native Function -> 取消 pending/consumer -> 关闭/release Port -> 返回 JS-S01 upperLayerTeardown -> 销毁 Context/Engine。
- 待验证项：编码阶段验证 14-entry Catalog、公共 Schema codec、Fake/QuickJS common suite、Core queue 背压、callback close race、共享 RequestId 唯一性、sanitizer 与资源归零。
- 阻塞项：无设计阻塞；编码仍等待独立校审 PASS 和工作看板显式 `CODE_ALLOWED`。
- 自检：五份文档均有目录且结论先行；18 条需求全部映射；9 个任务与 50 个验收项闭环；相对链接和 `git diff --check` 通过；未编写产品代码。
- 范围确认：未实现 Module Loader、VM、Binding、Render、Handler、平台逻辑或 JS-S03 内容。
- 下一步：提交 JS-S02 独立校审；结论返回前停止修改，不编码、不启动 JS-S03。
- 公共合同影响：无；未修改公共合同、Schema、marker、RuntimeError 或 Runtime ABI 入口集合。

### 2026-08-17 / 总架构 Agent / JS-S02 设计检查

- 状态：`DESIGN_CHANGES_REQUIRED + CODE_BLOCKED`。
- 问题本质：现设计要求 C++ shared RequestIdSource 生成 JS-origin ID，但没有 ID 分配入口，EnqueueResult 也不返回 ID，调用链不可实现；S02 的 completionToken 还侵入后续业务 completion ownership。
- `[已冻结] P0-ID-002`：JS-origin RequestId 由请求发起模块在 JS Executor 生成，使用 `req:j-<positive-decimal>`；不增加同步 ID Bridge。
- 修正边界：S02 只保留 bridge correlation record 和 typed consumer slot；Render snapshot、Promise/callback 分别归后续业务模块。
- 下一步：只同步五份分 Spec 后重新标记 `READY_FOR_REVIEW`；不得编码、不得启动 JS-S03。
- 公共合同影响：已由总架构更新 ID Contract；Runtime ABI 入口集合不变。

### 2026-08-17 / JS Runtime Agent / JS-S02 P0-ID-002 定向修订完成

- 状态：`READY_FOR_REVIEW + CODE_BLOCKED`；JS-S03 未启动。
- 修订范围：只同步 JS-S02 的 `README.md`、`requirements.md`、`design.md`、`tasks.md`、`acceptance.md`；未修改产品代码、公共合同或 Schema。
- 关闭证据 1：JS-origin RequestId 改由请求发起模块在 JS Executor 生成，wire 固定为 `req:j-<positive-decimal>`；删除共享 C++ `RequestIdSource` 依赖，不增加同步 ID Native Function。
- 关闭证据 2：S02 `PendingRecord` 仅保留 key、expectedResultKind、owner 和 generation，用于 Bridge correlation；不持有 completionToken、Promise/callback、Render snapshot 或业务 completion 状态。
- 关闭证据 3：匹配 Result 时，S02 先删除 correlation，再把完整 typed Result 投递到编译期固定 consumer slot；JS-S07、JS-S09 等业务模块各自拥有 Render snapshot、Promise/callback 和业务终态。
- 关闭证据 4：Core-origin completion 只回显原始 Core RequestId；14 个 Runtime ABI Native Function 和公共 Schema 保持不变。
- 权威性检查：S02 只拥有 Bridge 合法性、去重和路由状态；业务模块只拥有业务完成状态，同一关联 ID 不形成双重 pending 权威。
- 自检：18 条需求、9 个任务、50 个验收项闭环；14-entry Catalog 数量不变；相对链接与 `git diff --check` 通过。
- 历史说明：上一条“JS-S02 分 Spec 完成”中的共享 `RequestIdSource` 和 S02 completion ownership 已被本次记录替代。
- 下一步：等待 JS-S02 定向复核；复核 PASS 前不得编码，不得启动 JS-S03。

### 2026-08-17 / 总架构 Agent / JS-S02 定向复核

- 状态：`DESIGN_CHANGES_REQUIRED + CODE_BLOCKED`。
- 唯一缺口：公共 ID 合同要求 `req:j-*` 在一个 AppRuntime 内全局唯一；当前“各请求发起模块生成单调序列”会让多个模块产生相同 ID。
- 冻结修正：每个 AppRuntime 由 JS Framework bootstrap 创建且只创建一个本地 `JsRequestIdAllocator`；它只在 JS Executor 上运行，由所有请求模块共享，不是 C++ 服务，不经过 Native Function，也不归 S02 所有。
- S02 边界不变：只接收已带 ID 的 typed message，校验分区并维护 bridge correlation；不持有业务 completion。
- 下一步：只同步五份 JS-S02 文档和验收，重新标记 `READY_FOR_REVIEW`；不得编码、不得启动 JS-S03。
- 公共合同影响：ID Contract 已补充唯一 allocator 语义；wire 与 Runtime ABI 入口不变。

### 2026-08-17 / JS Runtime Agent / JS-S02 AppRuntime allocator 定向修订完成

- 状态：`READY_FOR_REVIEW + CODE_BLOCKED`；JS-S03 未启动。
- 修订范围：只同步 JS-S02 的 `README.md`、`requirements.md`、`design.md`、`tasks.md`、`acceptance.md`；未修改产品代码、公共合同或 Schema。
- 关闭证据 1：每个 AppRuntime 由 JS Framework bootstrap 创建且只创建一个本地 `JsRequestIdAllocator`，只在 JS Executor 上运行，由所有请求发起模块共享。
- 关闭证据 2：allocator 不是 C++ 服务，不通过 Native Function 暴露，也不归 RuntimeAbiService/S02 所有；S02 输入仍是已经带 ID 的完整 typed message。
- 关闭证据 3：请求模块先取号，再构造并提交完整 typed message；S02 只校验分区、登记 bridge correlation 和投递 typed Result，不持有业务 completion。
- 关闭证据 4：验收已冻结请求模块 A、B、A 交错取号必须依次得到 `req:j-1`、`req:j-2`、`req:j-3` 且无碰撞。
- 边界不变：14 个 Runtime ABI Native Function、公共 Schema、Core-origin completion 回显和 typed consumer slot 均未改变。
- 下一步：等待 JS-S02 定向复核；复核 PASS 前不得编码，不得启动 JS-S03。

### 2026-08-17 / JS Runtime Agent / JS-S02 实现完成

- 状态：`READY_FOR_REVIEW`；JS-S03 未启动且继续阻塞。
- 实现范围：完成 T01-T09，包括 closed typed unions、严格 RuntimeValue codec、14-entry Native Function Catalog、typed `EnqueueResult`、bounded bridge correlation、typed callback admission、Surface/AppRuntime teardown 和最小 Observation。
- 固定边界：S02 只校验已带 `req:j-*` 的完整 typed message；生产代码无 `JsRequestIdAllocator`、ID Native Function 或 C++ ID 服务。A/B/A allocator 只存在 test-only fixture。
- PendingRecord：只含 key、expectedResultKind、owner 和 ownerGeneration；边界扫描确认无 completionToken、Promise/callback、Render snapshot 或 JS Value。
- 合同测试：Fake Engine 与 QuickJS 运行同一 common ABI suite；覆盖 accepted、overflow、OOM、closed、late、duplicate、mismatch、callback FIFO/close race、Surface/AppRuntime teardown 和五项资源归零。
- 构建矩阵：Debug、Release、ASan/UBSan、TSan 均为 CTest `5/5 PASS`；API-only 构建通过；JS-S01/JS-S02 boundary scan 均通过。
- 正式证据：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/evidence/js-s02-implementation-evidence.md`；A01-A50 已逐项映射。
- 源码摘要：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/evidence/js-s02/source-manifest.sha256`，全项复核通过。
- 公共影响：未修改公共合同或公共 Schema；未实现 Module Loader、VM、Binding、Block、Render、Handler、typed API 或平台代码。
- 下一步：停止实现，等待 JS-S02 独立实现复核；复核结论前不得启动 JS-S03。

### 2026-08-17 / 总架构 Agent / JS-S02 定向复核 PASS

- 状态：`PASS + CODE_ALLOWED`。
- 已验证：五份文档统一冻结每 AppRuntime 一个 JS Framework 本地 `JsRequestIdAllocator`；所有请求模块共享，S02 不拥有 allocator，也不增加 ID Native Function。
- 已验证：A/B/A 交错取号、bridge correlation 与业务 completion 的单一所有权、14 个 typed Native Function 和 teardown 边界闭环。
- 实现边界：只实现 JS-S02 tasks；allocator 的生产实现不属于 S02，S02 只消费已带 ID 的 typed message，允许 test-only bootstrap fixture 验证共享取号合同。
- 下一步：实现 JS-S02，提交源码摘要、验收映射和 Debug/Release/ASan/UBSan/TSan 证据；不得启动 JS-S03。
- 公共合同影响：无。

### 2026-08-17 / JS Runtime Agent / JS-S02 实现最终提交

- 状态：`READY_FOR_REVIEW`；JS-S03 未启动且继续阻塞。
- 已完成：严格按最新 `PASS + CODE_ALLOWED` 实现 JS-S02 T01-T09；A01-A50 已逐项映射。
- 验证结果：Debug、Release、ASan/UBSan、TSan 均为 CTest `5/5 PASS`；API-only 构建、边界扫描和 source manifest 复核通过。
- 固定边界：生产代码无 `JsRequestIdAllocator`、ID Native Function、业务 completion 或后续 JS Framework 模块；allocator 仅存在 test-only A/B/A fixture。
- 正式证据：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/evidence/js-s02-implementation-evidence.md`。
- 源码摘要：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/evidence/js-s02/source-manifest.sha256`。
- 下一步：停止编码，等待 JS-S02 独立实现复核；不得启动 JS-S03。

### 2026-08-17 / 总架构 Agent / JS-S02 实现复核

- 状态：`IMPLEMENTATION_CHANGES_REQUIRED`；状态机与线程模型不推翻。
- 已验证：源码摘要全部匹配；Debug、Release、ASan/UBSan、TSan 均 5/5 CTest 通过；API-only 构建通过。
- 唯一阻塞：当前 `CoreMessage<Kind>` 与 `JsCallbackMessage<Kind>` 都只包装 `RuntimeValue::Object fields`，decoder 后仍需按字符串解释字段，不满足“具体 C++ struct closed union”的冻结合同。
- 定向修正：每种 outbound/inbound message 定义具名 C++ 字段；decoder 必须提取为具名成员，跨过 decoder 后不得再按字段名查表。只有公共合同明确声明为动态值的叶子字段可以使用 `RuntimeValue`。
- 验收补强：删除消息类型的通用 `fields` map；Fake Core 与 callback consumer 直接访问具名成员；边界扫描拒绝 generic message template/object payload；原 A01-A50 与五套构建继续通过。
- 下一步：只做 typed message model 定向返修并更新证据/源码摘要；不得启动 JS-S03。
- 公共合同影响：无；这是实现对齐既有 R03、A08 和 design 4.2/4.3。

### 2026-08-17 / JS Runtime Agent / JS-S02 typed message model 定向返修完成

- 状态：`READY_FOR_REVIEW`；JS-S03 未启动且继续阻塞。
- 已完成：删除 `CoreMessage<Kind>`、`JsCallbackMessage<Kind>` 和通用 `RuntimeValue::Object fields`；13 个 outbound、16 个 inbound 均为具名 C++ struct，并继续组成 closed `std::variant`。
- decoder 边界：JS `RuntimeValue` 在 decoder 内完成严格字段校验和类型提取；进入 `CoreIngressPort` 后不再按字符串查字段。`RuntimeValue` 仅保留在合同明确动态的 `params` 与事件 `payload` 叶子。
- callback 边界：validator 和 consumer slot 直接读取具名成员；Fake Core、16 类 callback slot 及非空 Binding/Block/Handler/Render Operation 测试均直接断言成员和值类型。
- 静态边界：扫描拒绝 generic message template、通用 fields/payload、`module/method/args`、JSON Bridge、allocator 和业务 completion 状态；14 个 Native Function 与 PendingRecord 四字段保持不变。
- 回归结果：Debug、Release、ASan/UBSan、TSan 均为 CTest `5/5 PASS`；API-only 与 JS-S01/JS-S02 boundary scan 通过。
- 正式证据：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/evidence/js-s02-implementation-evidence.md`；A01-A50 映射已更新。
- 源码摘要：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/evidence/js-s02/source-manifest.sha256` 已重新生成并待复核。
- 保持不变：状态机、Executor/队列、correlation、teardown、Observation、公共合同、公共 Schema 和 JS-S03 范围均未改动。
- 下一步：停止编码，等待 JS-S02 定向实现复核；不得启动 JS-S03。

### 2026-08-17 / 总架构 Agent / JS-S02 定向实现复核 PASS 与 W2 放行

- 状态：`JS-S02 VERIFIED`；`JS-S03/JS-S04 DESIGN_ALLOWED`；W2 代码仍阻塞。
- 已验证：13 个 outbound 与 16 个 inbound 均为具名 C++ struct 和 closed variant；decoder 后不再存在通用字符串字段解释。
- 验证：源码摘要全部匹配；Debug、Release、ASan/UBSan、TSan 各 5/5，通过 API-only 构建与 JS-S01/JS-S02 边界扫描。
- 下一步：按依赖先设计 JS-S03，再设计 JS-S04；分别完成五份标准分 Spec并标记 `READY_FOR_REVIEW`，不得编码或启动 JS-S05。
- 公共合同影响：无。

### 2026-08-17 / JS Runtime Agent / JS-S03 分 Spec 完成

- 状态：`READY_FOR_REVIEW + CODE_BLOCKED`；JS-S03 未编码。
- 已完成：新增 `subspecs/js-s03-module-abi-loader/` 下 README、requirements、design、tasks、acceptance 五份文档；22 条需求、9 个任务、50 个验收闭环。
- `[已冻结]`：S03 只消费 VerifiedModulePort immutable bytes；以 staging transaction 原子执行 define/bootstrap/require，完整校验后才提交 definition/instance cache。
- `[已冻结]`：App/Shared cache 绑定 AppRuntime；Page definition 可按 verified identity 复用，Surface 只持独立 lease；Page VM 不属于 S03。
- `[已冻结]`：Shared factory 单次求值，active stack 检测循环依赖且不暴露 partial exports；terminal failure 有界缓存，相同 identity 不自动重执行 Bundle。
- `[已冻结]`：Bundle bytes、cache、waiter、依赖深度、completion outbox 全部有界；Surface/App teardown 后 bytes、Value、lease、ledger 和 outbox 归零。
- `[待决策] P0-JS-EXPORT-001`：公共 Artifact Contract 尚未冻结 App/Page export 的精确 JS 属性名、VM definition 外形与 callable 签名；编码 T06 前需总架构与 Toolkit Bundle Emit Spec 冻结机器可测 shape，S03 不私改公共合同。
- 自检：五文件均结论先行并有目录；R01-R22/T01-T09/A01-A50 编号完整；公共 marker 名称、相对边界和 `git diff --check` 通过。
- 下一步：提交 JS-S03 独立校审；未获得 `PASS + CODE_ALLOWED` 前不得编码。
- 公共合同影响：仅提出 `P0-JS-EXPORT-001`，未修改公共合同或 Schema。

### 2026-08-17 / JS Runtime Agent / JS-S04 分 Spec 完成

- 状态：`READY_FOR_REVIEW + CODE_BLOCKED`；JS-S04 未编码，JS-S05 未启动。
- 已完成：新增 `subspecs/js-s04-app-page-vm-lifecycle/` 下 README、requirements、design、tasks、acceptance 五份文档；22 条需求、9 个任务、50 个验收闭环。
- `[已冻结]`：一个 AppRuntime 只有一个 App VM；每个 live Surface 只有一个独立 Page VM；Context、VM、Hook、Stage、microtask、Result 和 teardown 全部串行归属 JS Executor。
- `[已冻结]`：App 初始化为 create/install -> onCreate -> checkpoint；Page 为 create/install -> onInit -> initialEvaluation -> onReady -> final checkpoint；Result accepted 后才发布 ready handle。
- `[已冻结]`：Lifecycle 只消费 typed onShow/onHide/onDestroy dispatch；sequence 严格单调、防重且 Hook 不重入。show/hide failure 不回滚已提交 Core 状态，destroy failure 仍强制释放。
- `[已冻结]`：本地 visibility projection 只用于 Hook 防重，不是 Core lifecycle/health 权威；S04 不保存 top/predecessor/root，不维护 Surface/Navigation 栈。
- `[已冻结]`：S04 独立拥有 business dispatch ledger 与 bounded completion outbox；S02 仍只拥有 typed Bridge admission/correlation，不产生第二条 Bridge。
- 依赖项：真实 Bundle -> VM 连接继承 `P0-JS-EXPORT-001`；S04 无新增公共合同缺口。
- 自检：五文件均结论先行并有目录；R01-R22/T01-T09/A01-A50 编号完整；公共 lifecycle marker、禁区与 `git diff --check` 通过。
- 下一步：分别提交 JS-S03/JS-S04 独立校审；停止设计与编码，不启动 JS-S05。
- 公共合同影响：无新增；未修改公共合同或 Schema。

### 2026-08-17 / 总架构 Agent / W2 JS 联合校审

- 状态：JS-S02 `IMPLEMENTATION_CORRECTION_REQUIRED`；JS-S03/JS-S04 `DESIGN_CHANGES_REQUIRED`；后两项代码阻塞。
- S02：进程内 `ModuleBundle.bytesBase64` 违反既有 immutable byte storage 合同；只替换为共享/转移只读字节所有权，不改 ABI 状态机。
- S03：消费已冻结 P0-JS-EXPORT-001；只有确定性内容失败可进入 terminal failure cache，OOM/overflow/scope close/teardown cancellation 不得污染 module identity。
- S04：消费同一 Definition ABI，删除 Fake-only/待决策阻塞表述，继续保持每 Surface 独立 VM。
- 下一步：按 W2 校审话术完成 S02 实现返修与 S03/S04 文档修正，分别标记 `READY_FOR_REVIEW` 后停止。
- 公共合同影响：P0-JS-EXPORT-001 已在公共 Artifact Contract 冻结；无 Schema 变更。
