# QuickApp Kit v3 平台总 Spec：任务

## 目录

- [1. 结论](#1-结论)
- [2. 任务粒度](#2-任务粒度)
- [3. 平台级工作包](#3-平台级工作包)
- [4. 依赖关系](#4-依赖关系)
- [5. 当前启动批次](#5-当前启动批次)
- [6. 平台闭环顺序](#6-平台闭环顺序)
- [7. 状态与升级规则](#7-状态与升级规则)

## 1. 结论

平台总 Spec 的 Task 是**组织八个项目和阶段门禁**，不是替子 Agent编写模块级代码任务。每个项目分 Spec 自己拥有 `tasks.md`；本文件只定义项目间依赖、启动顺序、集成里程碑和放行条件。

第五次定向复核 `PASS`，P0/P1/P2 均为 0；第一批工作包当前为 `DESIGN_ALLOWED + CODE_BLOCKED`。只有具体分 Spec 独立校审 PASS 且工作看板显式设置 `CODE_ALLOWED`，才产生编码授权。

## 2. 任务粒度

```text
平台总 tasks.md
  -> 哪些项目、先后关系、里程碑和门禁

项目 subspec-index.md
  -> 一个项目拆成哪些分 Spec

分 Spec tasks.md
  -> 具体实现文件、接口、测试和完成定义
```

总架构 Agent 只维护第一层。项目 Agent 维护本项目分 Spec；通过后，编码 Agent 严格执行对应 `tasks.md`。

## 3. 平台级工作包

| ID | 工作包 | 所有者 | 输出 | 状态 |
|---|---|---|---|---|
| QK-T01 | 平台需求与 V1 范围 | 总架构 Agent | `requirements.md`、V1 Scope | DONE |
| QK-T02 | 平台总设计与公共合同 | 总架构 Agent | `design.md`、`architecture.md`、`contracts/**` | DONE |
| QK-T03 | 项目拆分与项目总 Spec | 总架构 Agent + 项目总 Spec Agent | 八项目 requirements/architecture/subspec-index/acceptance | DONE |
| QK-T04 | 分 Spec 启动与通信机制 | 总架构 Agent | 启动文档、工作看板、Handoff 协议 | DONE |
| QK-T05 | Observation Contract | 总架构 Agent | 公共合同、最小 Runtime 机制与 Schema | DONE |
| QK-T05A | Observation Contract 验证 | Benchmark Agent | `BM-S02` 分 Spec、覆盖/开销验证与变更提议 | READY |
| QK-T06 | Conformance Case 定义 | Examples Agent | `EX-S01/EX-S02` 分 Spec | READY |
| QK-T07 | Toolkit 分 Spec | Toolkit Agent | `TK-S01..S09` | READY |
| QK-T08 | JS Runtime 分 Spec | JS Agent | `JS-S01..S10` | READY |
| QK-T09 | Core 分 Spec | Core Agent | `CORE-S01..S11` | READY |
| QK-T10 | LVGL Runtime 分 Spec | LVGL Agent | `LV-S01..S10` | READY |
| QK-T11 | Android Runtime 分 Spec | Android Agent | `AND-S01..S09` | READY |
| QK-T12 | iOS Runtime 分 Spec | iOS Agent | `IOS-S01..S09` | READY |
| QK-T13 | 分 Spec 独立校审 | 独立校审 Agent | 每个分 Spec PASS/问题清单 | WAITING |
| QK-T14 | 分 Spec 实现与单项目验证 | 对应项目 Agent | 代码、测试、分 Spec证据 | WAITING |
| QK-T15 | LVGL/SDL 首闭环 | 总架构 + Toolkit/JS/Core/LVGL/Examples/Benchmark | 可见、可点击、可导航和 Trace | WAITING |
| QK-T16 | LVGL 设备验证 | LVGL Agent | 真实设备或目标环境证据 | WAITING |
| QK-T17 | Android 复用闭环 | Android Agent | 同 Artifact/Core/JS 和联盟语义差异记录 | WAITING |
| QK-T18 | iOS 复用闭环 | iOS Agent | 同 Artifact/Core/JS 的 iOS 证据 | WAITING |
| QK-T19 | V1 总验收与基础报告 | 总架构 + Benchmark Agent | 三端 Case、资源、Trace 和基础报告 | WAITING |
| QK-T20 | 可裁剪 Runtime 组成验证 | Core + Toolkit/LVGL/Benchmark；Android/iOS 随各自闭环追加 | Composition Manifest、LVGL 双 Profile、链接清单、体积与内存证据 | READY |

第二期的 Skill/MCP、AI Feature、完整权限/插件、安全发行、完整 Benchmark 和高级恢复不在本任务表中创建 V1 工作包。

## 4. 依赖关系

```text
QK-T01 + QK-T02
  -> QK-T03
  -> QK-T04
  -> QK-T05A + QK-T06 + QK-T07 + QK-T08 + QK-T09 + QK-T10 + QK-T11 + QK-T12

每个项目分 Spec
  -> QK-T13 对应分 Spec 校审
  -> QK-T14 对应分 Spec 实现

Toolkit + JS + Core + Examples + BM-S02 + LVGL
  -> QK-T15
  -> QK-T20(LVGL dual-profile proof)
  -> QK-T16
  -> QK-T17
  -> QK-T18
  -> QK-T19
```

项目分 Spec 设计可以跨项目并行；产品集成必须遵守平台闭环顺序。一个项目不得因其他项目尚未完成而跳过自己的 Fake Port、负例和单元验收。

## 5. 当前启动批次

第一批固定为：

| 项目 | 第一分 Spec | 推进规则 |
|---|---|---|
| Benchmark | `BM-S02 Marker 与 Trace` | 验证公共 Observation Contract，并定义采集实现和变更提议 |
| Examples | `EX-S01 Case 001 Baseline` | 随后推进 EX-S02；BM-S01 等待 EX-S01 稳定 |
| Toolkit | `TK-S01 CLI 与 Workspace` | 通过后按项目依赖图推进 |
| JS Runtime | `JS-S01 JS Engine Service` | 通过后启动 ABI/Module 链 |
| Runtime Core | `CORE-S01 Core Foundation` | 通过后启动 Loader 与 Runtime Tree 分支 |
| LVGL Runtime | `LV-S01 Foundation 与 Backend Ports` | 首个平台闭环优先 |
| Android Runtime | `AND-S01 Runtime Host 与 PackageSource` | 分 Spec可并行，产品接入第二 |
| iOS Runtime | `IOS-S01 Runtime Host 与 PackageSource` | 分 Spec可并行，产品接入第三 |

启动提示词、标准分 Spec 结构和通信格式见 [Subspec Agent Launch](../SUBSPEC-AGENT-LAUNCH.md)。

## 6. 平台闭环顺序

### 6.1 LVGL/SDL 首闭环

```text
Case source
  -> Toolkit Runtime RPK
  -> shared JS/Core
  -> LVGL Adapter
  -> SDL interactive window
  -> Case assertions + Trace
```

先跑 Case 001，再跑 Case 002、`BLOCK-001` 和 `CAP-DEVICE-001`；随后补真实 LVGL 设备或目标环境证据。

### 6.2 Android 复用闭环

Android 使用同一 Artifact/Core/JS，验证平台 Port 未被 LVGL 特性绑定，并记录与联盟 Android 行为基线的差异。

### 6.3 iOS 复用闭环

iOS 使用同一合同和 Case 完成第三平台证明，并追加同格式基础报告。

## 7. 状态与升级规则

任务执行状态与授权状态分离：

```text
设计任务状态：READY -> IN_PROGRESS -> READY_FOR_REVIEW -> PASS
                                             \-> CHANGES_REQUIRED
实现任务状态：CODE_ALLOWED -> IMPLEMENTING -> VERIFIED
设计授权：DESIGN_BLOCKED -> DESIGN_ALLOWED
编码授权：CODE_BLOCKED -> CODE_ALLOWED

完整门禁：DESIGN_ALLOWED -> 分 Spec 设计/校审 -> PASS
          -> 工作看板 CODE_ALLOWED -> IMPLEMENTING -> VERIFIED
```

`READY`、`PASS` 都不是授权状态；只有工作看板可以设置 `DESIGN_ALLOWED` 或 `CODE_ALLOWED`。

1. 子 Agent 只更新本项目 Handoff，不修改本任务表。
2. 总架构 Agent 根据 Handoff 更新本文件和工作看板的全局状态。
3. 公共冲突使用 `[待决策]` 升级；总架构 Agent 冻结后在所有受影响 Handoff 回写。
4. 未获得 `DESIGN_ALLOWED` 不得创建分 Spec；分 Spec PASS 但未获得 `CODE_ALLOWED`，仍不得初始化产品实现。
5. 项目实现通过不等于平台闭环；只有 [平台总验收](./acceptance.md) 的证据齐全才完成 V1。
