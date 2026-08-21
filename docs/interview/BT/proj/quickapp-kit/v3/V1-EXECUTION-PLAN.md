# QuickApp Kit V1 执行计划

> M1 当前采用 [`m1/M1-FAST-TRACK-GUIDE.md`](./m1/M1-FAST-TRACK-GUIDE.md) 的 `Spine -> Hardening` 顺序；最终 V1 范围不变。

## 目录

- [1. 结论](#1-结论)
- [1.1 M1-Alpha 执行覆盖层](#11-m1-alpha-执行覆盖层)
- [1.2 Alpha 之后的推进规则](#12-alpha-之后的推进规则)
- [2. V1 里程碑](#2-v1-里程碑)
- [3. M1 验收合同](#3-m1-验收合同)
- [4. 分-Spec-与执行波次](#4-分-spec-与执行波次)
- [5. M1 执行波次](#5-m1-执行波次)
- [6. 校审与编码门禁](#6-校审与编码门禁)
- [7. 当前动作](#7-当前动作)

## 1. 结论

**V1 不再按全部分 Spec 串行推进，而是以同一个 Runtime RPK 在三个平台完成 Case 001 为主线，按端到端能力组织执行波次。当前先执行 `M1-Alpha`，用一条最小纵向链路证明首屏闭环。**

72 个分 Spec 保留，继续定义模块归属、接口、任务和验收；它们是完整责任地图，不是 72 道串行启动门。每个分 Spec 仍须独立 `PASS` 后才能编码，但同一波次中先通过的项可以先实现，不等待整批结束。

平台闭环顺序固定为：

```text
M1 LVGL/SDL -> M2 Android -> M3 iOS -> M4 基础 Benchmark
```

Android 和 iOS 的 Foundation 可以提前并行，不阻塞 M1；后续高级能力不阻塞三个平台的 V1 主链路。

### 1.1 M1-Alpha 执行覆盖层

`M1-Alpha` 不是新的里程碑、项目或架构版本，而是 M1 的最小执行切片。它只验收 Case 001 的 S1 `launch-root`：冻结联盟 DSL Source 经 Toolkit 生成真实 Runtime RPK，由共享 JS/Core 加载、初始化、渲染和布局，再由 LVGL/SDL 挂载并呈现根页面。

Alpha 的范围、任务、验收和 Agent 指令见 [`m1-alpha/README.md`](./m1-alpha/README.md)。完整 M1 的 41 个分 Spec 责任地图不变；Alpha 通过后在同一代码和同一合同上继续 S2-S5。

### 1.2 Alpha 之后的推进规则

Alpha S1 通过后，立即冻结 S1 的 RPK 哈希、运行命令、结构化 Trace、可见结果和资源归零结果，然后继续 **Product V1 / M1**。此时不切换到 Product V2/V3；M2、M3、M4 也仍然是 V1 内部里程碑。

M1 后续采用“垂直验收切片”推进：

| 切片 | 端到端目标 | 主要参与项目 |
|---|---|---|
| S2 | 点击详情：Input -> Event -> JS Handler -> Core Navigation -> 新 Surface 可见 | Examples、JS、Core、LVGL |
| S3 | 点击欢迎：Event -> Capability -> Platform Toast -> typed result | Examples、JS、Core、LVGL |
| S3.5 | State -> Binding -> 增量 RenderTransaction -> Core commit -> Mount | Examples、JS、Core、LVGL |
| S4 | 平台返回：Platform control -> Core 路由栈 -> 关闭当前页并恢复前页 | Examples、Core、LVGL |
| S5 | 销毁 Runtime：页面、Surface、Handler、Node、Engine 资源回到基线 | Examples、JS、Core、LVGL |

Agent 组织规则：

1. Alpha S1 仍由一个集成 Agent 收口；在 S1 通过前，不再并行扩展其他能力。
2. S1 通过后，只保留一个长期 M1 集成 Agent，负责 S2、S3、S3.5、S4、S5 的顺序实现、依赖、运行证据和交接。
3. 每个切片结束后该 Agent 暂停，由总架构校审并放行下一切片；不为各切片重新创建 Agent。
4. Toolkit、JS、Core、LVGL 不再独立推进 M1；只有 M1 集成 Agent 提交的端到端证据可以关闭切片。
5. M1 S1-S5 全部通过后，才启动 M2 Android；M3 iOS 和 M4 Benchmark 按原路线推进。平台基础准备可以提前，但不能提前宣告里程碑完成。

这保证了架构仍按项目分层维护，交付却按用户可验证的完整链路推进；不把 72 个分 Spec 变成 72 个串行任务，也不创建大量彼此失去连续性的短期 Agent。

## 2. V1 里程碑

| 里程碑 | 结论性目标 | 退出条件 |
|---|---|---|
| F0 Foundation | 关闭首批基础模块和公共合同问题 | 当前首批分 Spec 实现或返修通过；无阻塞 M1 的公共合同冲突 |
| M1 LVGL/SDL | 联盟 DSL 经 Toolkit 构建后，由共享 JS/Core 在 LVGL/SDL 完整运行 | Case 001 S1-S5 全部通过，资源归零，具备结构化观测证据 |
| M2 Android | Android 复用同一 Artifact、JS Framework 和 C++ Core | 同一 Runtime RPK 完成 S1-S5；联盟语义差异有明确结论 |
| M3 iOS | iOS 复用同一 Artifact、JS Framework 和 C++ Core | 同一 Runtime RPK 完成 S1-S5；无平台私有业务语义 |
| M4 基础 Benchmark | 用统一 Observation Contract 给出三平台基础结果 | 启动、Bridge、Render、Mount、Event、Lifecycle 指标可复现 |

V1 完成的本质是：**同一份受约束 DSL 输入，经一条工具链生成同一 Runtime Artifact，由一套共享运行时语义驱动三个平台。**

## 3. M1 验收合同

M1 必须运行 `quickapp-examples` 的 Case 001 基线，不以手写 IR、手工拼包或绕过 Toolkit 的测试程序代替。

| 场景 | 操作 | 必须证明 |
|---|---|---|
| S1 | 启动根页面 | RPK 加载、App/Page 初始化、首笔 Render/Mount、根页面可见 |
| S2 | 点击“跳转到详情页” | Input -> Event -> JS Handler -> Core Navigation -> 新 Surface 可见 |
| S3 | 点击“欢迎使用” | Event -> Capability -> Platform Toast，typed request/result 闭环 |
| S4 | 执行平台返回 | Platform control -> Core 权威路由栈 -> 页面关闭与前页恢复 |
| S5 | 销毁 Runtime | Page/App/Surface/Handler/Node/Engine 等资源确定释放并归零 |

共同约束：

- 输入是 Toolkit 从冻结联盟 DSL Source 构建的 Runtime RPK。
- JS、Core、LVGL 不读取源码目录，也不各自解释 DSL。
- Core 维护唯一权威 Runtime Tree；Platform Host Tree 只是提交结果。
- 每个跨层操作使用冻结公共合同和关联 ID，不建立平台私有旁路。
- 观测关闭不改变行为；M1 只要求最小结构化证据，不要求完整分析系统。

## 4. 分 Spec 与执行波次

### 4.1 两种结构的职责

| 结构 | 回答的问题 |
|---|---|
| 分 Spec | 谁实现、输入输出是什么、状态和所有权如何成立、怎样独立验收 |
| 执行波次 | 为形成下一段端到端能力，本轮哪些分 Spec 同时推进 |

因此不删除、不合并现有分 Spec，也不要求按编号把一个项目全部做完后再进入下一个项目。

### 4.2 推进规则

1. 一个项目继续由一个长期 Agent 负责，保持内部设计连续性。
2. Agent 最多提前设计一个执行波次，避免远期设计脱离真实实现。
3. 当前分 Spec `PASS` 后立即允许编码，不等待同波次其他项目。
4. 项目内代码仍遵守 `subspec-index.md` 依赖；同波次只表示可并行设计，不取消实现依赖。
5. 波次末只做一次跨项目合同与端到端证据检查，不重复全面校审总架构。
6. 只有发现公共合同冲突时，受影响部分暂停并由总架构统一处理；其他部分继续。

## 5. M1 执行波次

| 波次 | Toolkit | JS Runtime | Runtime Core | LVGL Runtime | 形成的能力 |
|---|---|---|---|---|---|
| F0 | TK-S01 | JS-S01 | CORE-S01 | LV-S01 | CLI、Engine、Core Foundation、平台任务与 Backend 基础 |
| W1 | TK-S02、TK-S03 | JS-S02 | CORE-S02、CORE-S05 | LV-S02 | Module Graph、DSL 前端、Runtime ABI、包加载、Tree 与 Host Backend |
| W2 | TK-S04 | JS-S03、JS-S04 | CORE-S03、CORE-S04 | LV-S03、LV-S06 | Lowering、模块/VM、App/Page/Surface、字体度量 |
| W3 | TK-S05、TK-S06、TK-S07 | JS-S05、JS-S08、JS-S09 | CORE-S06、CORE-S09、CORE-S10 | LV-S04、LV-S05、LV-S07 | Bundle/IR/RPK、响应式/事件/API、Render/Event/Capability、Mount/Input |
| W4 | TK-S08 | JS-S06、JS-S07 | CORE-S07、CORE-S08 | LV-S08 | `inspect/run`、Block/Render Builder、Layout/Mount、SDL 完整运行 |
| W5 | TK-S09 | JS-S10 | CORE-S11 | LV-S09、LV-S10 | Case 001 S1-S5 验收、资源与观测证据 |

补充关系：

- Examples 的 EX-S01 是 M1 验收基线；EX-S02 是后续增量渲染、Block、Capability 和 Event 强化用例，不阻塞首次 Case 001 闭环。
- Benchmark 的 BM-S02 负责校验 Observation Contract；BM-S03 及以后不阻塞 M1。
- Android AND-S01、iOS IOS-S01 可在 F0 并行完成；后续平台分 Spec 分别在 M2、M3 波次推进。
- 同一单元格内的兄弟分 Spec 可并行设计；编码顺序仍以项目 `subspec-index.md` 为准。

## 6. 校审与编码门禁

```text
当前波次分 Spec 设计
  -> 项目 Agent 自检并写 READY_FOR_REVIEW
  -> 总架构按批次检查公共合同、依赖和端到端闭环
  -> 单项 PASS 后立即 CODE_ALLOWED
  -> Agent 实现、测试并提交证据
  -> 波次端到端检查
  -> 下一波次
```

每个分 Spec 都必须经过总架构校审；额外启动独立校审 Agent 的情况只有：

- 新增或改变公共 wire Schema、跨线程状态机、所有权或错误语义。
- 总架构与子项目对同一合同存在不同解释。
- 端到端证据与冻结合同冲突。

普通项目内部实现修正由总架构定向检查，不再启动全量架构复核。

## 7. 当前动作

### 7.1 总架构 Agent

1. M1-Alpha S1 已 `VERIFIED`；真实 RPK -> JS -> Core -> LVGL/SDL 首屏链路、可见结果和资源归零证据已经形成。
2. 当前唯一动作是按本计划 1.2 节启动 M1-S2 事件与路由垂直切片；S3、S3.5、S4、S5 依次等待前一切片通过。
3. 不提前进入 V2/V3，也不因切片实现问题重新设计已验证的 Alpha 公共架构。

### 7.2 项目 Agent

| Agent | 现在做什么 | 完成后 |
|---|---|---|
| Toolkit | Alpha 产物和合同已冻结 | M1-S2-S5 只消费已验证 RPK；不得扩展 TK-S08/TK-S09 |
| Runtime Core | Alpha 组件门禁和 Package dependency handoff 已通过 | 参与真实 Composition Root 和后续切片；不得私改公共合同 |
| LVGL Runtime | Alpha Mount/Present、`fontSize`、CJK 和 Measure 已通过组件验证 | 参与真实 S1 主链和后续切片；不得绕过 Core |
| JS Runtime | Alpha initial-only、typed facade、Router/Host Control 已通过组件验证 | 参与真实 S1 主链和后续切片；不得另建 JS 业务路径 |
| Android Runtime | AND-S01 已完成，当前停止扩展 | M1 完成后进入 M2 |
| iOS Runtime | IOS-S01 已完成，当前停止扩展 | IOS-S02 必须等到 M3 |
| Benchmark | 当前阶段停止扩展 | 等待 M4 |
| Examples | Alpha Composition Root 和 S1 证据已通过 | 作为 M1 切片的场景与运行证据 owner，按 S2-S5 参与验收 |

### 7.3 用户操作

1. 继续使用现有八个长期 Agent 对话，不为每个分 Spec 新开对话。
2. 把 `2026-08-18-current-agent-instructions.md` 中对应代码块发给 Agent。
3. 任一 Agent 标记 `READY_FOR_REVIEW` 后，只通知总架构 Agent；不要让项目 Agent 自行修改公共合同。
4. 等总架构在工作看板写出 `PASS + CODE_ALLOWED` 后，再让该 Agent 进入编码或下一波次。
