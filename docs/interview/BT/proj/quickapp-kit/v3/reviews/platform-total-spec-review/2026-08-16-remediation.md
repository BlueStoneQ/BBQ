# 平台总 Spec 校审意见闭环

## 目录

- [1. 结论](#1-结论)
- [2. 问题闭环](#2-问题闭环)
- [3. 架构不变量](#3-架构不变量)
- [4. 验证](#4-验证)
- [5. 当前门禁](#5-当前门禁)

## 1. 结论

首轮校审提出的 6 个 P1 和 2 个 P2 已按最小改动闭环；未改变单一 C++ Runtime Tree、无完整树 Diff、typed Bridge、Core 路由所有权和 `LVGL/SDL -> Android -> iOS` 实施顺序。

当前状态：修正已完成并通过本地自动验证，等待独立复核；八个项目只处于 `DESIGN_ALLOWED`，产品代码仍为 `CODE_BLOCKED`。

## 2. 问题闭环

| ID | 修正结论 | 唯一事实源 |
|---|---|---|
| P1-001 | CapabilityRequest/Result 封闭集合补齐 NavigationClose；Runtime ABI 明确 `closeRoute`；现有 Navigation Schema 正常/失败分支纳入自动测试 | `spec/contracts/capability-module-contract.md`、`runtime-abi.md`、`navigation.schema.json` |
| P1-002 | QK-R01..R18 全部映射到唯一 Accountable owner、Contributors、平台任务和验收证据；QK-R18 由总架构负责公共合同治理 | `spec/requirements.md` |
| P1-003 | Observation Contract 与 Schema 提升为公共合同唯一事实源；BM-S02 只验证、消费和提议变更 | `spec/contracts/observation-contract.md`、`schemas/observation.schema.json` |
| P1-004 | Case 001 移除不存在的 device 断言；新增独立 `CAP-DEVICE-001` 并贯穿 Examples、Toolkit、JS、Core、三平台和 Benchmark | `spec/acceptance.md`、`v1-scope-and-acceptance.md`、各项目总 Spec |
| P1-005 | Toolkit Application Service 是唯一能力内核；CLI 是 V1 第一薄入口 | `spec/requirements.md` |
| P1-006 | 总方向更新为 Core 从第一天独立、唯一 Runtime Tree、LVGL/SDL 首闭环、Android 第二、iOS 第三 | 能力建设版本规划、`AGENT-WORK-BOARD.md` |
| P2-001 | Page IR 的确定性增加“同一合法 Block instance plan”限定 | `spec/contracts/artifact-contract.md` |
| P2-002 | 状态统一为 `DESIGN_ALLOWED -> 分 Spec PASS -> CODE_ALLOWED`；当前产品代码 `CODE_BLOCKED` | `README.md`、`AGENT-WORK-BOARD.md`、各项目 Handoff |

## 3. 架构不变量

1. Toolkit 定义静态事实，JS 执行动态语义，C++ Core 维护唯一 Runtime Tree，Platform 执行 Host 操作。
2. JS 只提交 Dirty Binding/Block 增量意图；Core 不比较两棵完整新旧运行树。
3. JS/Core/Platform 只通过 typed message 通信；JNI 和 Objective-C++ Gateway 只属于各自平台项目。
4. Core 拥有 Navigation 栈和页面事务；Platform 成功后 Core 才提交权威状态。
5. Observation 不改变 Runtime 状态机；Benchmark 不拥有公共 Runtime 协议。

## 4. 验证

```text
Schema tests:
Validated 21 schemas, 81 union branches, 8 supplemental positives,
8 Page IR graph negatives, 10 InstantiateTemplate semantic negatives,
10 Render addressing negatives, 6 RegisterHandler addressing negatives,
8 Artifact relation negatives, and 10 signature cases.
```

补充验证结果：

1. 检查 `162` 个 v3 本地 Markdown 链接，无断链。
2. 正式事实源中无 Android-first、Core 事后抽取或 Shadow Tree 残留。
3. Observation Contract 唯一归属为总架构；BM-S02 只验证、消费和提议变更。
4. 四个基线和 `DESIGN_ALLOWED -> PASS -> CODE_ALLOWED` 状态在入口、任务、项目总 Spec 与 Handoff 中一致。

## 5. 当前门禁

| 工作 | 状态 |
|---|---|
| 项目分 Spec 设计 | `DESIGN_ALLOWED` |
| 分 Spec 独立复核 | 完成后逐项标记 `PASS` |
| 产品代码 | `CODE_BLOCKED`，仅对应分 Spec `PASS` 后转为 `CODE_ALLOWED` |
| 平台总 Spec | 本轮修正完成，等待独立复核 |
