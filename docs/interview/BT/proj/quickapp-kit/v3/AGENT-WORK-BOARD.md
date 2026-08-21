# v3 Agent Work Board

## 目录

- [1. 总规则](#1-总规则)
- [2. 产品版本看板](#2-产品版本看板)
- [3. 项目入口](#3-项目入口)
- [4. 分工](#4-分工)
- [5. 通信](#5-通信)
- [6. 当前门禁](#6-当前门禁)
- [7. 冻结决策](#7-冻结决策)

## 1. 总规则

v3 是当前唯一执行基线。正式 Spec 只能写在：

```text
v3/spec/                                      # 总架构与公共合同
v3/projects/<project>/spec/                   # 项目总 Spec
v3/projects/<project>/spec/subspecs/<name>/   # 项目分 Spec
```

分 Spec Agent 的统一启动提示词、并行策略、标准目录和通信模板见 [`SUBSPEC-AGENT-LAUNCH.md`](./SUBSPEC-AGENT-LAUNCH.md)。
V1 端到端里程碑、执行波次和 Case 001 验收主线见 [`V1-EXECUTION-PLAN.md`](./V1-EXECUTION-PLAN.md)。

代码只能写在：

```text
/Users/qy/code/my-github/quickapp-kit-ai/<project>
```

公共协议：

```text
Surface Control / SurfaceContext
Runtime Artifact / PackageSource
Runtime Launch Profile
Runtime Composition Manifest
Verified Module Load / LoadVerifiedModuleResult
Platform Surface Adapter
App/Page Lifecycle / AppContext / VmInitializationDispatch/Result / LifecycleDispatch/Result / RuntimeLifecycleControl
Capability Module / ModuleRegistry / Provider / Invoker
AppContext / PageContext
Platform Measure Adapter / MeasureRequest / MeasureResult
InstantiateTemplate
RenderTransaction / MountTransaction
PlatformInputMessage / JsEventDispatch
NavigationPush / NavigationClose / typed Result
CloseSurfaceHost / typed Result
ShowToast / DeviceGetInfo / SetTitleBar / SetMeta
LogicalNodeRef / OwnerInstanceId
TemplateBindingId / TemplateHandlerId / HandlerId
Runtime NodeId
RuntimeValue / RuntimeError
Observation Marker / Metric Boundary / Trace Correlation
```

平台 Agent 可以提出变更，但不得自行修改公共协议。

阶段定义：

| 阶段 | 回答的问题 | 最小交付物 |
|---|---|---|
| 平台总 Spec | 产品要什么、如何成立、怎样推进和验收 | `spec/requirements.md`、`design.md`、`tasks.md`、`acceptance.md`，已完成 |
| 详细架构与公共合同 | 三大系统和跨项目消息如何精确定义 | `spec/architecture.md`、`v1-scope-and-acceptance.md`、`contracts/**`，已完成 |
| 项目总 Spec | 单个项目做什么、怎么分解、如何验收 | `requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md` |
| 项目分 Spec | 一个具体模块如何实现和测试 | `subspecs/<name>/` 下的设计、接口、任务和测试 |
| 分 Spec 开发 | 严格按已通过的分 Spec 编码 | 代码、测试、运行证据 |

## 2. 产品版本看板

### 2.1 结论

当前处于 **`Product V1 / M1-Alpha / S1 VERTICAL SLICE`**。`Product V1/V2/V3` 表示产品演进版本，本文档目录名 `v3` 表示第三版架构设计基线，二者没有版本对应关系。

M1-Alpha 是执行覆盖层，不是新项目或第二套架构。当前主路径是：Case 001 冻结 Source -> Toolkit 生成真实 Runtime RPK -> 共享 JS/Core 完成首屏 -> LVGL/SDL 根页面可见。Alpha 通过后，继续在同一代码和同一分 Spec 上推进完整 M1 S1-S5。

勾选规则：只有具备实现、测试、证据和完成交接，且状态为 `VERIFIED` 的分 Spec 才标记 `[x]`；`PASS`、`CODE_ALLOWED`、`IN_PROGRESS` 和 `EVIDENCE_REQUIRED` 均标记 `[ ]`。

### 2.2 产品版本总览

| 产品版本 | 核心目标 | 已冻结 Spec | 已完成 | 状态 |
|---|---|---:|---:|---|
| Product V1 | 联盟 DSL 经 Toolkit 构建为 Runtime RPK，由共享 JS/Core 在 LVGL、Android、iOS 运行，并形成基础 Benchmark | 69 | 17 | `M1.W2 IMPLEMENTATION + EVIDENCE CORRECTION` |
| Product V2 | 扩展 Agent 接口与完整 Benchmark；其他能力待 V1 验证后再冻结 | 3 | 0 | `PLANNED` |
| Product V3 | 生产化、生态化和更多平台能力 | 0 | 0 | `NOT_FROZEN` |

V2 当前只冻结 `TK-S10`、`BM-S08`、`BM-S09` 三个后移项。AI Feature、Chat 组件、应用卡片及其他后续能力仍是 TODO，不计入 Spec 总数。V3 尚未进入需求冻结和 Spec 拆分阶段。

### 2.3 Product V1 里程碑

| 里程碑 | 目标 | Spec 数 | 已完成 | 进度 |
|---|---|---:|---:|---|
| M1 | Toolkit + JS + Core + LVGL/SDL 跑通 Case 001 | 41 | 14 | `W1 VERIFIED + W2 IMPLEMENTATION + EVIDENCE CORRECTION` |
| M2 | Android 复用同一 Runtime RPK、JS Framework 和 C++ Core | 9 | 1 | `WAIT_M1` |
| M3 | iOS 复用同一主链，证明第三平台成立 | 9 | 1 | `WAIT_M2` |
| M4 | 三平台基础 Benchmark 与扩展验收案例 | 10 | 1 | `WAIT_M1_M3` |
| **V1 合计** |  | **69** | **17** | **IN_PROGRESS** |

里程碑归属表示该 Spec 的最终验收位置，不表示必须完全串行。M2/M3/M4 的 Foundation 可以提前验证，但不能据此宣告对应里程碑完成。

### 2.4 Product V1 Spec 进度

| 里程碑 | 项目 | Spec 范围 | 完成状态 |
|---|---|---|---|
| M1 | Toolkit | `TK-S01..TK-S09`（9） | [x] `TK-S01..TK-S04`；[ ] `TK-S05..TK-S09` |
| M1 | JS Runtime | `JS-S01..JS-S10`（10） | [x] `JS-S01`、`JS-S02`；[ ] `JS-S03..JS-S10` |
| M1 | Runtime Core | `CORE-S01..CORE-S11`（11） | [x] `CORE-S01`、`CORE-S02`、`CORE-S05`；[ ] `CORE-S03` evidence 修复、`CORE-S04`、`CORE-S06..CORE-S11`；Alpha 当前聚焦 `CORE-S04/S06/S07/S08` |
| M1 | LVGL Runtime | `LV-S01..LV-S10`（10） | [x] `LV-S01`、`LV-S02`、`LV-S03`、`LV-S06`；[ ] `LV-S04/LV-S05/LV-S07..LV-S10`；Alpha 当前聚焦 `LV-S04` |
| M1 | Examples | `EX-S01`（1） | [x] `EX-S01` |
| M2 | Android Runtime | `AND-S01..AND-S09`（9） | [x] `AND-S01`；[ ] `AND-S02..AND-S09` |
| M3 | iOS Runtime | `IOS-S01..IOS-S09`（9） | [x] `IOS-S01`；[ ] `IOS-S02..IOS-S09` |
| M4 | Benchmark | `BM-S01..BM-S07`（7） | [x] `BM-S02`；[ ] `BM-S01`、`BM-S03..BM-S07` |
| M4 | Examples | `EX-S02..EX-S04`（3） | [ ] `EX-S02..EX-S04` |

### 2.5 Product V2/V3 Spec 进度

| 产品版本 | 里程碑 | Spec | 目标 | 状态 |
|---|---|---|---|---|
| V2 | 待冻结 | [ ] `TK-S10` | Agent Skill + MCP Adapter | `PLANNED` |
| V2 | 待冻结 | [ ] `BM-S08` | 完整统计与原始数据存储 | `PLANNED` |
| V2 | 待冻结 | [ ] `BM-S09` | 外部框架 Profile 与对比 | `PLANNED` |
| V3 | 待冻结 | 暂无 | 生产化、生态化及更多平台能力 | `NOT_FROZEN` |

V2/V3 的里程碑编号必须在对应版本需求冻结后创建，不能沿用 V1 的 M1-M4，也不能为了填满路线图提前制造分 Spec。

## 3. 项目入口

| Agent | Spec 入口 | 代码工程 |
|---|---|---|
| Toolkit | `/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-toolkit/spec/README.md` | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit/` |
| Android Runtime | `/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-runtime-android/spec/README.md` | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/` |
| Runtime Core | `/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-runtime-core/spec/README.md` | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-core/` |
| JS Runtime | `/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-runtime-js/spec/README.md` | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/` |
| LVGL Runtime | `/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-runtime-lvgl/spec/README.md` | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl/` |
| iOS Runtime | `/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-runtime-ios/spec/README.md` | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/` |
| Benchmark | `/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-benchmark/spec/README.md` | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-benchmark/` |
| Examples | `/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-examples/spec/README.md` | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/` |

## 4. 分工

- Toolkit：DSL -> JS Bundle + IR + Runtime RPK；生命周期导出、Capability 引用；CLI `build/inspect/run`；Case 001 联盟闭环 Golden、Case 002 update/reorder Golden、`BLOCK-001` add/remove Golden、`CAP-DEVICE-001` 能力 Golden。
- Android：联盟 Android 行为基线、Runtime Host、PackageSource、JNI Adapter、Host Component、PlatformProvider、Measure Adapter 和输入；组合共享 Core/JS Runtime。
- Core：共享 Artifact Loader、Runtime Controller、App/Page Context 与状态、Runtime Tree、Style/Layout、Measure cache、Transaction、Navigation、ModuleRegistry/Invoker 和公共实现。
- JS：共享 JS Framework、`JsEnginePort`、QuickJS V1 Provider、JS Executor、App/Shared/Page、生命周期 Hook、Module Facade、Handler、Binding flush 和 Runtime ABI。
- LVGL：LVGL/SDL Adapter、Host 映射、PlatformProvider、Measure Adapter、输入、内存和线程验证。
- iOS：UIKit Runtime Host、Platform Adapter、PlatformProvider、Measure Adapter、生命周期和输入；组合共享 Core/JS Runtime。
- Benchmark：V1 只定义基础 Trace、指标边界和三平台结果；完整统计与外部框架对比后置。
- Examples：维护联盟 DSL Case 001、运行时合同 Case 002、`BLOCK-001` 和 `CAP-DEVICE-001` focused fixture。

代码修改边界：

| Agent | 允许修改 | 不允许修改 |
|---|---|---|
| Toolkit | `quickapp-toolkit/`，必要时读取 `quickapp-examples/` | Runtime Core、任一平台工程 |
| Android | `quickapp-runtime-android/` | Core 公共实现、LVGL/iOS/Toolkit |
| Core | `quickapp-runtime-core/` | Android/JNI、UIKit、LVGL、Toolkit |
| JS | `quickapp-runtime-js/` | Platform Host、Core 公共合同 |
| LVGL | `quickapp-runtime-lvgl/` | Core、Android、iOS、Toolkit |
| iOS | `quickapp-runtime-ios/` | Core、Android、LVGL、Toolkit |
| Benchmark | `quickapp-benchmark/`，可读取各工程产物 | 各 Runtime 实现和公共协议 |
| Examples | `quickapp-examples/` | Toolkit 和各 Runtime 实现 |

公共合同需要变更时，只修改 v3 总 Spec 对应文件并记录 `[待决策]`，不得直接在项目总 Spec、项目分 Spec 或代码中私改协议。Artifact/Package/Page IR/JS Bootstrap 同样属于公共合同，不归 Toolkit 私有。

共享实现所有权：

| 部件 | 唯一代码归属 | 平台如何使用 |
|---|---|---|
| RPK/Manifest/Metadata/Page IR Loader | `quickapp-runtime-core` | 平台 Host 提供 PackageSource，调用共享 Loader |
| Runtime Launch Profile | v3 公共进程合同 | Toolkit Application Service 产生，Android/LVGL/iOS Runtime Host 消费 |
| Observation Contract/Schema | v3 总架构公共合同 | CORE-S01 实现最小机制；BM-S02 验证并提议变更；Platform 实现 Collector；各生产者只发结构化事实 |
| Runtime Composition Contract/Schema | v3 总架构公共合同 | Core 执行兼容性预检；Platform Composition Root 生成清单；Toolkit/Benchmark 消费 |
| Runtime Controller / App/Page / Surface / Navigation | `quickapp-runtime-core` | 平台 Host 调用控制面，JS 执行 Hook |
| Runtime Tree / Layout / Measure Cache / Event Router | `quickapp-runtime-core` | Platform 提供 Measure service、消费 Mount、回传 Input |
| ModuleRegistry / CapabilityInvoker / CoreProvider | `quickapp-runtime-core` | Platform 手动注册 PlatformProvider Factory；CapabilityGuard 第二期加入 |
| Platform Surface Host | 各平台 Runtime | 消费 Create/Present/Visibility/Close/Destroy Surface Host command |
| JsEnginePort / QuickJS Provider | `quickapp-runtime-js` | Platform Composition Root 选择一个 Engine Provider；V1 三平台默认复用 QuickJS |
| JS Executor / JS Framework | `quickapp-runtime-js` | 三平台通过 Runtime ABI 组合 |
| JNI / Android View | `quickapp-runtime-android` | 只实现 Android Host 和 Adapter |
| LVGL / SDL | `quickapp-runtime-lvgl` | 只实现 LVGL Host 和 Adapter |
| UIKit | `quickapp-runtime-ios` | 只实现 iOS Host 和 Adapter |

后续 Release profile 的 PackageOpenPolicy/签名草案保留在 Artifact Contract，但不进入 V1 项目总 Spec、项目分 Spec 与编码门禁。

执行主线：

```text
F0 Foundation
  -> W1-W4 端到端能力波次
  -> M1 LVGL/SDL Case 001 S1-S5
  -> M2 Android 同 RPK
  -> M3 iOS 同 RPK
  -> M4 基础 Benchmark
```

72 个分 Spec 是完整责任地图，不是 72 道串行门。每个分 Spec 仍须 `PASS` 后编码；执行按波次并行，单项通过即可先实现。签名、Skill/MCP、完整 Benchmark、AI 能力和高级容灾不参与 V1。

## 5. 通信

每个项目的通信文件为：

```text
projects/<project>/spec/AGENT-HANDOFF.md
```

交接记录必须包含：日期、事件、已完成、新增事实、新增决策、待验证项、阻塞项、下一步、影响的公共合同。

标签统一使用：`[已冻结]`、`[已验证事实]`、`[合理推断]`、`[待验证]`、`[待决策]`。

通信所有权：子 Agent 只写本项目 Handoff；总架构 Agent 读取八份 Handoff，处理公共问题并更新本工作看板。完整事件格式和公共决策升级模板见 [`SUBSPEC-AGENT-LAUNCH.md`](./SUBSPEC-AGENT-LAUNCH.md)。

## 6. 当前门禁

| 阶段 | 状态 |
|---|---|
| 平台总 Spec 标准结构 | `PASS`；定向复核 P0/P1/P2 为 0 |
| 总架构与公共合同 | `PASS`；第五次定向复核 P0/P1/P2 为 0 |
| Toolkit/Core/JS/Android/LVGL/iOS/Benchmark/Examples 项目总 Spec | `PASS`；组成边界闭环 |
| 当前里程碑 | `F0 VERIFIED + M1-Alpha S1_VERIFIED + M1-S2 READY_TO_START`；完整 M1 尚未完成 |
| 已验证 | `BM-S02/TK-S01..S06/JS-S01,S02/CORE-S01,S02,S03,S05/LV-S01,S02,S03,S06/AND-S01/IOS-S01/EX-S01 VERIFIED`；TK-S07 打包机制和详细 Spec 已验证；JS Alpha initial-only 分层已通过 |
| 当前执行 | Alpha S1 已完成；按 [`m1/README.md`](./m1/README.md) 和 [`m1/agent-instructions.md`](./m1/agent-instructions.md) 逐段推进 M1-S2-S5 |

项目总 Spec 或分 Spec 若发现公共合同无法实现，只在各自 `AGENT-HANDOFF.md` 记录 `[待决策]` 并暂停受影响部分；不得自行改变公共协议。

W2 实现验收见 [`2026-08-18-w2-implementation-review.md`](./reviews/subspec-review/2026-08-18-w2-implementation-review.md)；Alpha 统一派发指令见 [`m1-alpha/agent-instructions.md`](./m1-alpha/agent-instructions.md)；历史 W2 指令见 [`2026-08-18-current-agent-instructions.md`](./reviews/subspec-review/2026-08-18-current-agent-instructions.md)。

| 分 Spec | 检查状态 | 编码门禁 |
|---|---|---|
| BM-S02 | `VERIFIED` | `BM-S03 HOLD_M4` |
| Toolkit W2 | `TK-S01..TK-S06 VERIFIED`；TK-S07 打包机制、详细 Spec 与 Loader probe 已验证 | 定向修正 Page VM/evaluator、Package dependencies 与 typed facade ID 后重建 Alpha RPK；`TK-S08/TK-S09 CODE_BLOCKED` |
| JS Runtime | `JS-S01/JS-S02 VERIFIED`；S03 与 Alpha initial-only 分层已通过 | 只实现 Case 001 所需 Router 与 `$page` typed facade；完整 Reactive/Event/Navigation `CODE_BLOCKED` |
| Runtime Core W2 | `CORE-S01/CORE-S02/CORE-S03/CORE-S05 VERIFIED` | Alpha 组件已通过；定向对齐 App/Shared/Page dependencies 后参与集成；完整容灾后续验收 |
| LVGL Runtime W2 | `LV-S01/LV-S02/LV-S03/LV-S06 VERIFIED` | `LV-S04 ALPHA_COMPONENT_VERIFIED`；定向完成 `fontSize`/CJK 字体接线 |
| AND-S01 | `VERIFIED` | `AND-S02 HOLD_M2` |
| IOS-S01 | `VERIFIED` | `IOS-S02 HOLD_M3` |
| EX-S01 / EX-S02 | `EX-S01 VERIFIED`；`EX-S02 PASS` | Alpha Runner `INTEGRATION_BLOCKED_UPSTREAM`；不启动 EX-S02 产品代码 |

### 6.1 里程碑门禁

| 里程碑 | 状态 | 当前阻塞条件 |
|---|---|---|
| F0 Foundation | `VERIFIED` | 无 |
| M1 LVGL/SDL | `M1-Alpha S1_VERIFIED / M1-S2 READY_TO_START` | S2-S5 事件、Capability、增量更新、返回、恢复和销毁 |
| M2 Android | `WAIT_M1` | 必须先证明同一 Runtime 在 LVGL/SDL 完整成立 |
| M3 iOS | `WAIT_M2` | 必须复用已验证 Artifact/Core/JS 主链路 |
| M4 基础 Benchmark | `WAIT_M1_M3` | 三平台可运行证据尚未形成 |

下一波次只由总架构统一发布；项目 Agent 不因当前任务完成而自行跨入后续分 Spec。

## 7. 冻结决策

### P0-ADDR-001：Binding 与 Handler 的跨层寻址

`[已冻结]` JS 不复制 Page IR target，也不直接提交 `LogicalNodeRef + property/eventType`。

```text
Binding:
  JS -> OwnerInstanceId + TemplateBindingId + value
  Core -> Page IR resolve target -> LogicalNodeRef -> NodeId + property

Handler:
  JS -> OwnerInstanceId + TemplateHandlerId + HandlerId
  Core -> Page IR resolve target/eventType -> LogicalNodeRef -> NodeId + EventBinding
```

理由：Page IR 已是静态 target 的唯一事实源；ID 寻址消除 Bundle 重复，降低内存，并与首屏 `initialBindings` 的 `TemplateBindingId` 语义统一。Owner 必须通过 Page/Block scope 校验，失效或错配时拒绝整笔事务。

### P0-MODULE-001：Verified Module 交付顺序

`[已冻结]` Core 先完成 Package 校验，再按 `AppContext -> App Module -> VmInitialization`、`SurfaceContext -> Page Module -> VmInitialization` 顺序推进；JS 不读取 PackageSource、文件路径或 Page IR，初始化失败通过 typed Result 立即闭环。

### P0-NAV-001：页面关闭是 Core 栈事务

`[已冻结]` 非 Root 栈顶只能通过 `NavigationClose -> CloseSurfaceHost` 关闭；Platform 原子 close/reveal 成功后，Core 才 pop 权威栈、派发 Hook 并释放页面资源。

### P0-EVENT-001：Handler 删除可回滚

`[已冻结]` 可回滚删除使用 `live -> retiring -> released`；Core 未提交 Runtime Tree 删除则恢复 live，提交后才永久释放，Surface teardown 才允许强制清理。

### P0-EVENT-002：输入因果关联

`[已冻结]` 一次 Platform 输入使用一个 `RequestId`：由捕获输入的 Platform Adapter 从 AppRuntime 全局唯一空间生成，Core 原样复制到该输入产生的全部 `JsEventDispatch`，目标与冒泡 Handler 不重新分配。V1 Handler 同步 flush 产生的状态和 Render Trace 继续携带该 ID；异步任务不自动继承。

理由：`surfaceId/nodeId/handlerId/timestamp` 不能在连续输入和冒泡时唯一关联 Event 与 Render；复用现有 `RequestId` 可以形成确定证据链，无需增加 `EventId`。

### P0-EVENT-003：同步 Render 的输入因果字段

`[已冻结]` `RenderTransaction.requestId` 是可选字段。Handler 返回前的同步状态 flush 产生事务时必须携带触发输入的 `RequestId`；普通非事件更新和 Handler 返回后的异步 continuation 必须省略。

Core 原样复制该值到相关 Render Observation；Render 与 Mount 继续通过 `transactionId` 关联，Platform Mount 不解释输入因果。该决定关闭 `EX-S02-REQ-001`，不引入 `EventId`，也不让 Trace 反向补造消息语义。

### P0-MEASURE-001：Layout 与字体度量边界

`[已冻结]` Core 拥有 Yoga、Measure cache 和最终 Rect；Platform 只同步返回 `measured(width,height)` 或 `failed(RuntimeError)`，不得用 Host Tree 或本地 Layout 覆盖 Core 几何结果。

### P0-EXEC-001：平台实施顺序

`[已冻结]` 联盟 Android 实现从第一天作为行为语义参考；产品实现按 `LVGL/SDL -> Android -> iOS` 闭环。LVGL/SDL 先证明完整 Runtime 可见、可点击和嵌入式可行性；Android 再用同一 Artifact/Core/JS 证明平台无关性与联盟行为兼容；iOS 最后接入。

该调整只改变验证顺序，不改变公共合同、代码所有权和项目总 Spec PASS 状态。Core 不得出现 LVGL、SDL、Android 或 iOS 类型及线程假设。

### P0-CUT-001：固定内核与可裁剪外围

`[已冻结，已通过第五次定向复核]` Runtime 采用固定 C++ Kernel、必选 JS Runtime Service 与编译期可组合外围。Bridge、Render、Event 及 Lifecycle、Runtime Tree、Transaction 的架构骨架不可裁剪；具体 JS Engine、Platform Backend、Provider、扩展 Host Component、诊断和后续 Feature 通过 Platform Composition Root 选择。

外围只依赖内核公共 Port；未选模块的源文件、对象文件和依赖不得进入最终链接产物。每个 Runtime 产物生成公共 Runtime Composition Manifest，Core 在执行 JS 前完成 Artifact/Profile 兼容性预检。V1 以 `lvgl-simulator-dev` 与 `lvgl-embedded-min` 的链接清单、体积和内存作为主要证据。

JS Framework 只依赖 `JsEnginePort`；Build Profile 必须且只能选择一个 Engine Provider。V1 实现 QuickJS Provider，不做多 Engine 并存、运行时热切换或失败后自动换引擎。

### P0-OBS-001：最小可观测机制

`[已冻结]` Runtime 只产生结构化运行事实，外围负责采集、存储、分析和展示。

Core Foundation 提供 `MonotonicClock + TraceSink/NoopTraceSink + RuntimeCounters`；JS Runtime Service 通过本地 ObservationEmitter 复用公共 Sink，不把观测伪装成业务 ABI。Android、LVGL、iOS Composition Root 选择 Sink，平台项目实现 Collector。

观测关闭、Sink 失败或 Collector 丢样不得改变 Runtime 状态机、事务结果、错误和线程顺序。热路径不得格式化文本、执行文件 I/O、等待 Collector 或分配无界内存。完整 Benchmark、存储、报告、可视化和外部框架对比不进入 Kernel。

### P0-OBS-002：Observation wire 整数与时间原点

`[已冻结]` Runtime 内部 `MonotonicClock` 保持 `uint64 ns`；跨项目 JSON Observation 的全部整数必须位于 `0..9007199254740991`，保证 JavaScript、C++ 和平台 Collector 无损读取。

`timestampNs` 是 `nowNs - runOriginNs` 的同一 run 单调相对时间；同一 `(runId, clockDomain)` 只能有一个共享原点，无法共享时必须声明不同 clockDomain 并校准。producer 必须在任一 wire 整数溢出前结束并轮换 run，不得截断、回绕、改用浮点近似或文本数字。

### P0-ID-001：AppRuntime 身份归属

`[已冻结]` `AppRuntimeId` 由 Core `AppRuntimeFactory` 唯一生成，作用域为一个 Runtime Host 实例，并在该 Host 生命周期内不复用。allocator 必须晚于其创建的全部 AppRuntime 销毁；Platform Host 只请求创建 Runtime，不生成、传入或解释该 ID。

理由：AppRuntime 是 Core 逻辑对象；让平台生成其身份会把同一内部对象的唯一性规则复制到三个 Host，并扩大 Platform -> Core 创建合同。

### P0-ID-002：RequestId 跨语言唯一性

`[已冻结]` RequestId 由请求或输入发起侧生成；V1 使用互斥 wire 命名分区：Core 为 `req:<positive-decimal>`，JS 为 `req:j-<positive-decimal>`，Platform/Runtime Host 为 `req:p-<positive-decimal>`。

理由：唯一性只需要 producer 分区和 AppRuntime 内单调不复用，不需要为了分配 ID 增加一次同步跨语言调用。Core 内部多个 producer 仍共享同一 allocator。
