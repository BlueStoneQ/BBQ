# JS Runtime Spec Agent Handoff

> 状态：JS-S01 `PASS + CODE_ALLOWED`；允许实现，JS-S02 暂停。

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
