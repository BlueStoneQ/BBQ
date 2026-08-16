# QuickApp Kit v2 文档总索引

## 目录

- [1. 使用方式](#1-使用方式)
- [2. 当前阶段与阅读优先级](#2-当前阶段与阅读优先级)
- [3. 总体设计](#3-总体设计)
- [4. 核心概念](#4-核心概念)
- [5. 架构决策](#5-架构决策)
- [6. Contracts](#6-contracts)
- [7. 总 Spec](#7-总-spec)
- [8. 分项目设计](#8-分项目设计)
- [9. 研究与背景资料](#9-研究与背景资料)
- [10. 工程与协作](#10-工程与协作)
- [11. 文档状态规则](#11-文档状态规则)

## 1. 使用方式

本文是 QuickApp Kit v2 的唯一总体文档入口。阅读和实施顺序统一为：

```text
总需求/总架构
    -> 核心概念
    -> 架构决策
    -> Contracts
    -> 总 Spec
    -> 分项目 Spec
    -> tasks / code / benchmark
```

文档职责：

| 分类 | 回答的问题 |
|---|---|
| 核心概念 | 一个术语本质是什么，和相邻概念如何区分 |
| 架构决策 | 为什么选择某个方案，代价和约束是什么 |
| Contract | 项目之间必须共同遵守什么接口和行为 |
| Spec | 一个产品或模块具体要实现什么 |
| Tech Design | 代码结构、数据结构和算法如何落地 |
| Tasks | 按什么顺序实施和验收 |

## 2. 当前阶段与阅读优先级

当前处于总架构、核心机制、关键决策和 Contract 收敛阶段。编码前必须先明确渲染树、线程、跨层通道、节点身份和事务模型。

| 优先级 | 必读文档 | 目的 |
|---|---|---|
| P0 | [总需求](REQUIREMENTS.md) | 明确平台目标、范围和成功标准 |
| P0 | [总架构设计](ARCHITECTURE.md) | 建立完整系统边界和产品矩阵 |
| P0 | [统一概念表](core-concepts/glossary.md) | 对齐标准、树、变化、事务、线程和事件术语 |
| P0 | [Dirty 核心概念](core-concepts/dirty-marking.md) | 对齐状态失效、重算和真实变化 |
| P0 | [Fabric + Lynx 渲染模型决策](decisions/rn-fabric-lynx-rendering-model.md) | 固定树、事务、线程和跨层通道原则 |
| P0 | [Runtime Contract](contracts/runtime-contract.md) | 固定 Runtime 与 Host 的公共边界 |
| P1 | [总 Spec](spec/README.md) | 进入分项目设计和开发 |
| P1 | [Runtime Core 项目设计](projects/quickapp-runtime-core/README.md) | 落地共享 C++ Core |
| P1 | [Android 项目设计](projects/quickapp-runtime-android/README.md) | 跑通首个完整平台链路 |
| P2 | [运行时架构研究](research/runtime-architecture-research.md) | 查看证据、备选方案和历史推导 |

## 3. 总体设计

| 文档 | 定位 |
|---|---|
| [README](README.md) | v2 文档入口说明与项目概览 |
| [总需求](REQUIREMENTS.md) | 总目标、范围、约束和验收 |
| [总架构设计](ARCHITECTURE.md) | One Runtime Core、Multiple Backends、Capability System |
| [能力对齐](spec/capability-alignment.md) | 平台能力和阶段版本映射 |

## 4. 核心概念

核心概念文档只定义稳定语义，不承载具体项目排期。

| 文档 | 核心结论 | 状态 |
|---|---|---|
| [统一概念表](core-concepts/glossary.md) | 一句话定义每个核心概念，并区分标准、已确定和候选术语 | 持续维护，术语唯一入口 |
| [Dirty 标记](core-concepts/dirty-marking.md) | Dirty 是可能变化的重算候选集，Diff 才是真实变化集 | 已确定 |
| [三类渲染树](core-concepts/render-tree-model.md) | Render Intent 表达意图，Shadow 表达 Core 状态，Host 表达平台事实 | 已确定 |

术语采用以下最短主链：

```text
Dirty 找候选
-> Reconcile/Diff 算变化
-> 变化合并消除中间噪音
-> Transaction 批量提交
-> Commit 确认版本
-> Mount 更新平台 UI
```

## 5. 架构决策

架构决策文档具有约束力；如果后续推翻，需要新增决策记录并说明替代关系。

| 文档 | 决策 | 状态 |
|---|---|---|
| [V1 架构决策](decisions/decision-v1.md) | 固定联盟标准、自有 RPK ABI、JS Framework、无全量 VNode Diff、C++ Core、Toolkit 与 LVGL 首闭环 | 已确定，V1 冲突覆盖基线 |
| [Fabric 树与事务 + Lynx 非 UI 线程准备](decisions/rn-fabric-lynx-rendering-model.md) | Core 管理 Shadow/revision/transaction；非 UI 线程准备；热路径非必要不序列化 | 已确定，算法分期 |
| [待决策清单](decisions/toDecision.md) | Bridge、渲染、事件、构建和 JS Framework 的决策队列 | 持续收敛 |

## 6. Contracts

| 文档 | 合同边界 | 状态 |
|---|---|---|
| [Runtime Contract](contracts/runtime-contract.md) | Runtime Host、Core、Backend 的基础边界 | 草案 |

待补充的 P0 Contracts：

```text
Render Backend Contract
Render Input / Tree Snapshot Contract
MountTransaction Contract
Event Contract
Capability Module Contract
```

## 7. 总 Spec

| 文档 | 定位 |
|---|---|
| [Spec 首页](spec/README.md) | 总 Spec 导航和开发入口 |
| [总需求 Spec](spec/requirements.md) | 总产品需求 |
| [总架构 Spec](spec/arch-design.md) | 总体架构约束 |
| [总体设计](spec/overall-design.md) | 全链路模块和流程 |
| [子 Spec 划分](spec/sub-specs.md) | 各独立项目边界 |
| [总任务](spec/tasks.md) | 阶段实施顺序 |

## 8. 分项目设计

每个项目统一包含：

```text
README.md
requirements.md
arch-design.md
tech-design.md
tasks.md
```

| 项目 | 职责 | 文档入口 |
|---|---|---|
| quickapp-runtime-core | 平台无关 Runtime、树、布局、事务、路由 | [Core](projects/quickapp-runtime-core/README.md) |
| quickapp-runtime-js | QuickJS Adapter、JS Framework、状态与 Dirty | [JS Runtime](projects/quickapp-runtime-js/README.md) |
| quickapp-runtime-android | Android Host、JNI、View Backend | [Android](projects/quickapp-runtime-android/README.md) |
| quickapp-runtime-lvgl | LVGL Backend 与 SDL Simulator | [LVGL](projects/quickapp-runtime-lvgl/README.md) |
| quickapp-runtime-ios | iOS Host 与 UIKit Backend | [iOS](projects/quickapp-runtime-ios/README.md) |
| quickapp-toolkit | CLI 构建、校验、运行、调试内核 | [Toolkit](projects/quickapp-toolkit/README.md) |
| quickapp-examples | 跨平台示例和兼容样例 | [Examples](projects/quickapp-examples/README.md) |
| quickapp-benchmark | 性能指标、场景和对照结果 | [Benchmark](projects/quickapp-benchmark/README.md) |

## 9. 研究与背景资料

| 文档 | 用途 | 约束力 |
|---|---|---|
| [Diff 结果与渲染事务](research/diff-result-and-render-transactions.md) | 明确 Tree Revision、Diff、Mutation List、RenderTransaction 与 MountTransaction 的边界 | 研究结论；正式数据结构需进入 contracts/spec |
| [联盟 Toolkit 与 RPK 管线](research/alliance-toolkit-rpk-pipeline.md) | 基于真实源码、build、RPK 和 Toolkit 研究编译产物 | 事实基线；正式约束需进入 decisions/contracts |
| [联盟 Android Runtime 与 Toolkit](research/alliance-android-runtime-toolkit.md) | 对照联盟 Android Runtime、Framework 和工具链实现 | 研究参考 |
| [五框架渲染与事件管线对比](research/framework-render-update-event-pipeline-comparison.md) | 对比快应用、小程序、RN Fabric、ReactLynx、Flutter 的首次渲染、状态更新与事件闭环 | 参考；核心结论需在 decisions/contracts 中固化 |
| [运行时架构研究](research/runtime-architecture-research.md) | 行业实现、证据、备选方案和历史推导 | 参考；与正式决策冲突时以 decisions 为准 |
| [架构阶段交接 2026-08-14](ARCHITECTURE-HANDOFF-2026-08-14.md) | 当前 RPK、JS Framework、无全量 VNode Diff、C++ Core、Toolkit 与实施基线 | 最新阶段基线；冲突时替代 2026-08-09 交接 |
| [架构讨论交接](ARCHITECTURE-HANDOFF-2026-08-09.md) | 阶段背景和上下文衔接 | 历史记录 |

研究文档用于保留推导过程，不直接等价于当前实施决策。

## 10. 工程与协作

| 文档 | 用途 |
|---|---|
| [文档写作规则](DOC-WRITING-RULES.md) | 第一性、金字塔结构、结论先行 |
| [环境说明](ENVIRONMENT.md) | Android、iOS、LVGL 开发环境 |
| [质量要求](QA.md) | 测试和验收要求 |
| [TODO](TODO.md) | 跨项目后续事项 |
| [项目目录](projects/README.md) | 项目文档结构约定 |

索引维护规则：新增文档时必须同时加入本文对应分类；研究结论只有进入 `decisions/` 或 `contracts/` 后，才具有实施约束力。

## 11. 文档状态规则

| 状态 | 含义 | 是否可以直接编码 |
|---|---|---|
| 研究中 | 仍在收集证据和比较方案 | 否 |
| 草案 | 已有方案，但合同或验收未收敛 | 仅允许 PoC |
| 已确定 | 核心边界和取舍已经确认 | 可以进入 Spec |
| Spec Ready | 接口、异常、线程和验收已明确 | 可以正式开发 |
| 已实现 | Code 与测试已经落地 | 可以集成 |
| 已验证 | Benchmark 和多端结果通过 | 可以作为稳定基线 |

优先级定义：

```text
P0：不明确就不能安全进入主链路编码
P1：首个平台闭环必须完成
P2：跨平台扩展或性能演进时完成
```
