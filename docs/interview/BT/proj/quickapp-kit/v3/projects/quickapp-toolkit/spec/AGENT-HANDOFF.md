# Toolkit v3 Agent Handoff

> 状态：TK-S01 `VERIFIED`；TK-S02 与 TK-S03 `DESIGN_ALLOWED`。
> Spec：`/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-toolkit/spec`  
> 代码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit`  
> Case 001：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/quickapp-code-test1`
> Case 002：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/quickapp-code-test2`
> 只读：v3 公共 Spec、Case 与 upstream；可写：本项目 `AGENT-HANDOFF.md`；项目总 Spec gate 通过后可写本项目 `spec/subspecs/<name>/`；对应分 Spec 通过后才可写 `quickapp-toolkit/` 代码目录。
> 启动合同：`../../../spec/contracts/runtime-launch-profile.md`；Toolkit 只产生该合同，平台 Runtime Host 只消费。
> 平台总 Spec 必读：`../../../spec/requirements.md`、`../../../spec/design.md`、`../../../spec/tasks.md`、`../../../spec/acceptance.md`。

## 目录

- [1. 工作目标](#1-工作目标)
- [2. 不可修改的边界](#2-不可修改的边界)
- [3. 研究输入](#3-研究输入)
- [4. 工作顺序](#4-工作顺序)
- [5. 验收](#5-验收)
- [6. 通信](#6-通信)

## 1. 工作目标

从零设计并实现联盟 DSL 到 QuickApp Kit Runtime 输入的 CLI-first Toolkit。V1 只实现 CLI；Skill/MCP 与 VS Code 插件在第二期复用同一 Toolkit Application Service。

V1 用 Case 001 建立真实联盟样例闭环，用 Case 002 补足 state update、if 和 keyed for，不追求一次覆盖全部联盟语义。

当前总 Spec 只交付：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。

## 2. 不可修改的边界

```text
JS 不维护完整 VNode Tree
C++ Core 维护唯一 Runtime Tree
Toolkit 只生成静态 IR、JS Bundle、Runtime Metadata 和 RPK
Toolkit 不生成 Runtime NodeId / SurfaceId / HandlerId
BlockInstanceId 成为块内节点 Owner
```

公共协议必须直接引用 v3 `spec/contracts/schemas/`：

```text
InstantiateTemplate
RenderTransaction / RenderTransactionResult
MountTransaction / MountTransactionResult
PlatformInputMessage / JsEventDispatch
NavigationPush / NavigationPushResult
ShowToast / SetTitleBar / SetMeta 及各自 Result
Runtime Artifact / Manifest / Runtime Metadata / Page IR / JS Bootstrap
App/Page Lifecycle / Capability Module / Measure input requirements
RuntimeError
```

不得在 Toolkit 项目内建立第二套同名 Schema。

## 3. 研究输入

启动必读：`../../../spec/v1-scope-and-acceptance.md`、`../../../spec/contracts/artifact-contract.md`、`../../../spec/contracts/host-component-contract.md`、`../../../spec/contracts/application-lifecycle-contract.md`、`../../../spec/contracts/capability-module-contract.md`、`../../../spec/contracts/runtime-composition-contract.md`、`../../../spec/contracts/observation-contract.md`、`../../../spec/contracts/schemas/runtime-composition.schema.json`、`../../../spec/contracts/schemas/README.md`。研究资料不能覆盖这些执行合同。

已验证事实优先来自：

```text
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/quickapp-code-test1
/Users/qy/code/my-github/quickapp-kit-ai/source/upstream/hap-toolkit
/Users/qy/code/my-github/quickapp-kit-ai/source/upstream/hapjs
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v2/research/alliance-toolkit-rpk-pipeline.md
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v2/research/alliance-android-runtime-toolkit.md
```

v2 Toolkit Spec 不是实现依据，不复制其目录和字段。

## 4. 工作顺序

```text
G0 v3 总架构与公共合同校验通过
T0 重新研究 Case 001/002 与联盟产物
T1 冻结 Toolkit requirements.md
T2 冻结 Toolkit architecture.md
T3 用 subspec-index.md 拆分分 Spec、依赖和顺序
T4 用 acceptance.md 冻结项目验收
T5 Toolkit 总 Spec 独立校审
D0 总 Spec 通过后，逐个设计并校审分 Spec
I0 对应分 Spec 通过后初始化代码
I1 Case 001/002 纵向实现
I2 Runtime 联调和 Benchmark
```

## 5. 验收

```text
联盟 DSL Case 001 / Case 002
  -> quickapp build
  -> JS Bundle + IR + Runtime Metadata + RPK
  -> 公共 Schema 全部通过
  -> Runtime 可加载
  -> Case 001: lifecycle / 首屏 / click / navigation / Capability / Page Control / 页面销毁
  -> Case 002: 状态更新 / if / keyed Block
```

必须输出：构建阶段耗时、产物清单和大小、Schema 校验、确定性哈希、Source Map、诊断、Bundle/IR/RPK Golden。

## 6. 通信

每次阶段完成后追加：

```text
日期
事件
已验证事实
关键决策
待验证项
公共合同影响
下一步
```

任何公共合同冲突标记 `[待决策]`，不得由 Toolkit Agent 单方面修改。

### 2026-08-15 / 总架构 Agent

- 事件：删除早期 Toolkit Spec 和代码，启动 v3 clean restart。
- 原因：旧实现仅为 T0/T1 骨架，旧 Spec 形成双重事实源，继续兼容的成本高于重建。
- 保留：v3 公共合同、联盟研究、Case 001、hap-toolkit、hapjs。
- 历史后续动作：总架构门禁现已完成；当前状态以最新“需求回归校准”记录为准。

### 2026-08-15 / 总架构 Agent / 四审修订

- 事件：收紧门禁；拆分 Navigation 与 typed Host Feature；统一 Case 001/002 验收。
- Widget：V1 排除 Case 001 CardDemo，必须输出 `TK_WIDGET_EXCLUDED_V1`，不得静默忽略。
- 历史门禁：现已解除；当前立即开始 Toolkit Spec。

### 2026-08-15 / 总架构 Agent / 六审修订（历史，已被需求回归校准取代）

- 事件：冻结公共 RPK 签名格式与包外 PackageOpenPolicy。
- Toolkit 边界：只按公共二进制格式生产 `META-INF/QUICKAPP-KIT.SIG`；不得自定算法、证书链或降级策略。
- 验收：必须复用公共 Ed25519 Golden，并与 Core 验证结果一致。

### 2026-08-15 / 总架构 Agent / 需求回归校准

- V1 主线：签名与 PackageOpenPolicy 降为后续 Release profile，不得阻塞 Toolkit Spec。
- 新增合同：按公共 App/Page 生命周期生成 App/Page bootstrap；保留 `system.router/prompt/device` typed Module 引用。
- Manifest：校验 Capability 声明与保留 namespace；V1 不生成 ServiceContext 或权限实现。
- 验收：以 V1 Scope 中 Case 001/002 的真实 Runtime 闭环为最高门禁，不以 Schema 或签名 Golden 替代运行结果。
- 历史门禁：该阶段已完成；当前以最新校审门禁为准。

### 2026-08-15 / 总架构 Agent / 项目总 Spec 初稿

- 已完成：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。
- 核心边界：联盟 DSL 编译为 JS Bundle、Page IR、Runtime Metadata 和确定性 Runtime RPK；不实现 Runtime，不复制公共 Schema。
- 下一步：独立校审输入输出、Lowering/Emitter 边界、Case 001/002 和分 Spec 依赖。
- 门禁：校审通过前不得编写分 Spec，不得初始化产品代码。
- `[已冻结] P0-ADDR-001`：Bundle 不复制 Binding/Handler target；Toolkit 只保证 Template ID 与 Page IR 一一对应。

### 2026-08-16 / 总架构 Agent / Agent 调用面

- 事件：新增 Toolkit Skill/MCP Agent 调用面，不改变 Runtime 主架构。
- `[已冻结]`：Toolkit Application Service 是唯一能力内核；CLI 与 MCP 复用相同请求、结果、Diagnostic 和 Artifact。
- V1：Skill 提供 DSL/工作流/样例知识；MCP 只暴露 typed `build/inspect/run`。
- 后置：`create/validate/debug/bench`、能力发现、自动应用生成和 Agent 评测。
- 禁止：Skill/MCP 复制编译规则、解析人类日志作为成功合同或直接调用平台内部模块。

### 2026-08-16 / 总架构 Agent / 首轮项目总 Spec 校审修订

- 已同步：Case-derived DSL/module/style matrix、target typed evaluator、`system.fetch` deferred facade、launch profile 和 `BLOCK-001` 证据边界。
- Agent 调用面仍是 Toolkit Application Service 的薄适配，不改变 Artifact、JS/Core ABI 或 Runtime 分层。
- 当前门禁：Toolkit `DESIGN_ALLOWED`；Skill/MCP 不参与 V1，产品代码等待对应分 Spec 独立校审 PASS。

### 2026-08-16 / 总架构 Agent / V1 范围校准

- `[已冻结]`：V1 只交付联盟 DSL -> JS Bundle/Page IR/Metadata/RPK -> `build/inspect/run`。
- Skill/MCP、签名、AI 能力和完整 Benchmark 全部后置，不得进入 Toolkit V1 分 Spec。

### 2026-08-16 / 总架构 Agent / 平台总 Spec 修正同步

- `[已冻结]`：Toolkit Application Service 是唯一能力内核；CLI 只是 V1 第一入口。
- Toolkit 必须构建 `CAP-DEVICE-001`，但不得修改 Case 001 补 device。
- Observation Contract/Schema 由总架构维护；Toolkit 只按合同产出 marker。当前只允许设计分 Spec。

### 2026-08-16 / 总架构 Agent / 第二次复核修正

- Observation 条件 Schema 与跨项目消费语义已修正；Toolkit 边界不变。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 定向复核 PASS

- 平台总 Spec 定向复核结果：P0/P1/P2 为 0。
- 当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`；启动 TK-S01 分 Spec 设计，禁止产品编码。

### 2026-08-16 / 总架构 Agent / P0-CUT-001 同步

- 新增：TK-S08 消费 Runtime Composition Manifest，展示 Profile/链接模块并报告可静态确定的 Artifact/Profile 不兼容；Core 仍是加载期最终预检者。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待可裁剪组成定向校审。

### 2026-08-16 / 总架构 Agent / JS Engine 边界校准

- TK-S08 展示 Runtime Composition Manifest 中的 Engine identity 和 module；Toolkit 不选择 Engine，也不解释 Engine 私有配置。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`。

### 2026-08-16 / 总架构 Agent / 第四次复核修正

- Runtime Composition Manifest 现在必须记录一次 `runtime.js-framework` 和一个选定 Engine；TK-S08 按公共合同展示并核对，不推断链接事实。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 第五次定向复核 PASS

- P0/P1/P2 均为 0；当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`。
- 允许设计 TK-S01；禁止产品编码。

### 2026-08-16 / 总架构 Agent / 最小可观测合同

- Toolkit 只按公共合同产生 Build Marker；不实现 Runtime TraceSink、平台 Collector、存储或分析。
- 当前授权不变：`DESIGN_ALLOWED + CODE_BLOCKED`。

### 2026-08-16 / Toolkit Agent / TK-S01 分 Spec 启动

- 状态：`IN_PROGRESS`
- 已完成：确认 TK-S01 设计门禁、写入边界和公共合同优先级。
- 新增事实：无。
- 本项目设计决定：无；待完成 Case 与研究事实核对后冻结。
- 待验证项：CLI/Workspace 的联盟输入形态、现有 Case 目录结构与 Toolkit Application Service 最小边界。
- 阻塞项：无。
- 下一步：设计 `tk-s01-cli-workspace` 五份分 Spec，并执行需求覆盖、链接和边界自检。
- 公共合同影响：无。

### 2026-08-16 / Toolkit Agent / TK-S01 分 Spec 完成

- 状态：`READY_FOR_REVIEW`
- 已完成：新增 `subspecs/tk-s01-cli-workspace/` 下 `README.md`、`requirements.md`、`design.md`、`tasks.md`、`acceptance.md`。
- 新增事实：Case 001/002 均可由默认 `<workspace>/src/manifest.json` 结构发现；Case 001 的联盟 CLI/产物仅作为 Workspace 输入事实，不作为 v3 实现结构。
- 本项目设计决定：采用 `CLI Adapter -> Toolkit Application Service -> Workspace/typed UseCase Port -> ToolkitResult`；Workspace 只提供规范路径和不可变 SourceUnit，不解释 DSL；配置优先级为 explicit override > workspace config > default；CLI 是唯一进程 I/O 和退出码 owner。
- 本项目设计决定：V1 Toolkit 基线为 Node.js 22、TypeScript strict、ESM；顶层只注册 `build/inspect/run`，TK-S08 独占 `inspect/run` 业务语义。
- 本项目设计决定：Toolkit 通过独立 `ToolkitObservationPort` 只产生公共 `build.*` marker，不实现 Runtime TraceSink、Collector 或存储。
- 待验证项：真实 Compiler options/BuildResult 由 TK-S02..S07 冻结；InspectRequest/RunRequest 及其业务结果由 TK-S08 冻结。
- 阻塞项：无。
- 下一步：提交 TK-S01 独立校审；校审 PASS 后等待工作看板显式设置 `CODE_ALLOWED`，当前不得编码。
- 公共合同影响：无；未提出 `[待决策]`。
- 自检：5 个固定文件、25 条需求、12 个相对链接；断链为 0，边界扫描无越权实现。

### 2026-08-16 / Toolkit Agent / TK-S01 实现启动

- 状态：`IN_PROGRESS`
- 已完成：读取工作看板、Toolkit Handoff 和第一批分 Spec 校审；确认 TK-S01 为 `PASS + CODE_ALLOWED`。
- 新增事实：TK-S01 无附加修订项；产品工程仍为空基线。
- 本项目设计决定：严格按已通过的 TK-S01 tasks 实现，所有 operation 使用 Fake UseCase 完成当前合同测试。
- 待验证项：Node.js 22/TypeScript 工程、Case 001/002 Workspace 兼容、CLI JSON/Human/exit、SourceAccess 一致性与 Build Marker Schema 形态。
- 阻塞项：无。
- 下一步：只在 `quickapp-toolkit/` 初始化并实现 TK-S01，完成后提交机器可读测试证据。
- 公共合同影响：无。

### 2026-08-16 / Toolkit Agent / TK-S01 实现完成

- 状态：`VERIFIED`
- 已完成：Node.js/TypeScript ESM 工程、CLI/Workspace/config/SourceAccess、Toolkit Application Service、typed UseCase Port、Result/Diagnostic、退出码、取消和 Toolkit Build Marker。
- 已完成：`build/inspect/run` 顶层命令均已注册；`inspect/run` 可由 TK-S08 静态 contribution 替换；真实 Compiler 未安装时 `build` 明确返回 `TK_OPERATION_UNAVAILABLE`。
- 已验证事实：Case 001/002 均通过默认 Workspace 发现并生成 Manifest SourceUnit；对应 SHA-256 已记录在 `quickapp-toolkit/evidence/tk-s01.json`。
- 已验证事实：`npm run typecheck`、`npm run lint`、`npm run build` 全部 PASS；`npm test` 为 43/43 PASS；CLI 专测为 12/12 PASS；产品依赖为空。
- 已验证事实：连续 100 次 build session 全部 dispose；并发 invocation 的 Workspace/InvocationId/RunId 不串扰；路径越界、symlink escape、配置错误、文件变化、取消、marker 失败和 renderer 失败均有负例。
- 本项目实现澄清：无法归属到合法顶层 operation 的 CLI parse failure 使用 renderer-only `operation=cli` envelope；它不进入 Toolkit Application Service，service 结果仍只包含 `build/inspect/run`。
- 待验证项：真实 BuildUseCase 与 Artifact 结果由 TK-S02..S07 提供；Inspect/Run request 与业务语义由 TK-S08 提供。
- 阻塞项：无。
- 下一步：提交 TK-S01 实现校审；TK-S02/TK-S03 仍按各自设计门禁推进，不在本实现中提前创建。
- 公共合同影响：无；未修改公共 Schema，Build Marker 已直接通过公共 Observation Schema 校验。
- 写入边界：产品实现和证据仅位于 `quickapp-toolkit/`；文档只追加本 Handoff。

### 2026-08-16 / 总架构 Agent / 第二批实现检查

- 状态：`IMPLEMENTATION_CHANGES_REQUIRED`。
- 已完成：typecheck/lint/build、43 项测试和 12 项 CLI 测试通过；Application Service 分层成立。
- 新增事实：CLI 分派前失败使用 `operation=cli`，不属于已冻结的 ToolkitResult，且会被 assertToolkitResult 拒绝。
- 阻塞项：冻结独立 `kind=cliDiagnostic` envelope 并同步 Spec/实现前，TK-S02 不得启动。
- 下一步：按第二批 Agent 话术定向返修并重新标记 `READY_FOR_REVIEW`。
- 公共合同影响：无；CLI Diagnostic 是 Toolkit Adapter 私有合同，不进入 Runtime 或 MCP Application Service。

### 2026-08-16 / Toolkit Agent / TK-S01 CLI Diagnostic 定向返修启动

- 状态：`IN_PROGRESS`
- 已完成：读取工作看板、第二批实现检查、TK-S01 五份分 Spec 与当前 CLI/Application 实现；确认只修复分派前失败信封。
- 本项目设计决定：Application Service 继续只返回 `operation=build|inspect|run` 的 `ToolkitResult`；CLI Adapter 私有失败改为版本化 `kind=cliDiagnostic` 且不携带 `operation`。
- 隔离约束：`CliDiagnosticResult` 只存在于 CLI Adapter，不进入 Application Service、UseCase Port、公共包入口或未来 MCP 调用面。
- 阻塞项：TK-S02 继续阻塞，直至本次返修通过独立检查。
- 下一步：同步 TK-S01 Spec，修改实现与测试，重跑全部门禁并提交证据。
- 公共合同影响：无。

### 2026-08-16 / Toolkit Agent / TK-S01 CLI Diagnostic 定向返修完成

- 状态：`READY_FOR_REVIEW`
- 已完成：TK-S01 五份分 Spec 已冻结 CLI Adapter 私有 `CliDiagnosticResult`；JSON renderer 输入固定为 `ToolkitResult | CliDiagnosticResult` 并分别校验。
- 已完成：删除产品实现中的 `operation=cli`；新增独立 type guard/validator，未知命令和非法公共参数输出 `kind=cliDiagnostic` 且不携带 `operation`。
- 隔离证据：Application Service 仍只返回 `operation=build|inspect|run` 的 `ToolkitResult`；架构门禁禁止 Application 层依赖 CLI，并禁止公共包入口导出 CLI 私有结果合同。
- 测试证据：`npm run typecheck`、`npm run lint`、`npm run build` 全部 PASS；`npm test` 为 49/49 PASS；`npm run test:cli` 为 17/17 PASS。
- 覆盖：未知命令、非法公共参数、JSON 单文档、Application Service 隔离、错误信封拒绝均已通过。
- 阻塞项：TK-S02 继续阻塞，等待本次 TK-S01 定向返修检查通过并由工作看板重新放行。
- 公共合同影响：无；未修改 Runtime、Artifact、Observation 或 MCP 合同。

### 2026-08-16 / 总架构 Agent / TK-S01 定向复核 PASS

- 状态：`VERIFIED`。
- 已完成：CLI Diagnostic 私有边界成立；typecheck/lint/build、49/49 和 CLI 17/17 通过。
- 下一步：按 W1 并行设计 TK-S02 与 TK-S03，只写分 Spec，不编码；共同提交校审。
- 公共合同影响：无。
