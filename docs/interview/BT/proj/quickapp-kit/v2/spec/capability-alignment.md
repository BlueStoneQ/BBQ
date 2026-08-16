# QuickApp Kit v2 能力大纲对齐

## 目录

- [1. 结论](#1-结论)
- [2. 本质校准](#2-本质校准)
- [3. 能力大纲映射](#3-能力大纲映射)
- [4. v2 范围补强](#4-v2-范围补强)
- [5. 关键决策](#5-关键决策)
- [6. 重点吸收点](#6-重点吸收点)

## 1. 结论

QuickApp Kit v2 不能只建设成 `runtime + toolkit`。它的正确定位是：

```text
面向移动 OS 与嵌入式设备的轻应用平台解决方案
```

Runtime 和 toolkit 是平台落地的核心工程抓手，但完整平台还必须覆盖：

- 应用模型
- 应用容器
- 能力接入体系
- 插件机制
- 服务协同机制
- 系统能力开放
- 权限与账号入口
- 数据与上下文协同
- 应用接入标准
- 生态规则
- 兼容性策略
- 分发与治理机制
- 调试与开发者工具链
- 多端设备差异适配

## 2. 本质校准

大纲要求的不是一个跨端 UI 框架，而是一套应用平台架构。

本质差异：

| 方向 | 只做框架 | 做应用平台 |
|---|---|---|
| 核心对象 | UI 与运行时 | 应用、能力、开发者、设备、生态 |
| 关注范围 | 渲染、Bridge、工具链 | 标准、容器、能力、权限、治理、分发、兼容 |
| 成功标准 | Demo 可跑 | 平台可接入、可扩展、可治理、可演进 |
| 多端价值 | 控件适配 | 设备能力差异治理 |

因此 v2 的设计必须是：

```text
Runtime Framework as Core
Application Platform as Goal
```

## 3. 能力大纲映射

| 大纲能力 | QuickApp Kit v2 对应设计 |
|---|---|
| 下一代嵌入式应用生态 | QuickApp 轻应用平台 + 多端 Runtime + 生态规则 |
| 多端场景 | Android / iOS / LVGL / SDL Simulator / 后续穿戴、车载、大屏 |
| 应用运行机制 | Runtime Contract、JS Framework、PageStack、Lifecycle、Render Pipeline |
| 能力接入体系 | Capability Module、Capability Provider、Permission Hook、Versioning |
| 应用模型 | RPK Contract、Manifest Model、App/Page/Surface/Component |
| 插件机制 | TurboModule-like Capability Module、ModuleSpec、Registry、Invoker |
| 服务协同机制 | system.*、service.*、agent.tool、context service 后续扩展 |
| 应用容器 | Android/iOS/LVGL Runtime Host 与 Render Backend |
| 系统能力开放 | Capability Module + Platform Capability Provider |
| 账号权限 | Permission Model、Account Capability、Manifest permissions |
| 数据与上下文协同 | Context Store、Page/App Context、Service Context 后续设计 |
| 调试与开发工具链 | CLI-first toolkit、inspect、run、bench、后续 VSCode 插件 |
| 应用接入标准 | RPK Contract、Manifest validation、Compatibility Matrix |
| 生态规则 | 能力声明、权限声明、包校验、兼容等级、治理规则 |
| 兼容性策略 | Runtime version、API version、feature discovery、fallback |
| 演进机制 | V1/V2 contracts、ModuleSpec/codegen、backend extension |

## 4. v2 范围补强

### 4.1 已有核心

当前 v2 已经较强覆盖：

- Runtime Core
- JS Framework
- Render Backend
- Capability Module 雏形
- Toolkit CLI
- Benchmark
- 多端环境

### 4.2 需要显式补强

后续总 spec 和 contracts 需要新增或强化：

```text
contracts/rpk-contract.md
contracts/capability-module-contract.md
contracts/permission-contract.md
contracts/compatibility-contract.md
contracts/ecosystem-governance-contract.md
contracts/context-service-contract.md
contracts/developer-tooling-contract.md
```

项目矩阵可保留当前 8 个项目，但文档视角要扩展：

```text
Runtime 层
  -> 应用平台层
  -> 生态治理层
  -> 开发者体系层
```

### 4.3 第一阶段仍然聚焦

第一阶段不需要把所有平台能力做完，但必须把位置留出来：

- 先实现 `system.router`、`system.prompt`、`system.device`
- 权限模型先做 manifest 声明和调用前 hook
- 兼容性先做 feature discovery 和 unsupported fallback
- 生态治理先做 RPK/manifest validate
- 上下文协同先定义 App/Page context，后续扩展 service context

## 5. 关键决策

### KD-ALIGN-001：Runtime 是核心抓手，不是最终边界

结论：QuickApp Kit v2 以 Runtime 为工程核心，但以应用平台为架构目标。

原因：大纲要求的是应用生态和平台能力，不只是跨端渲染框架。

### KD-ALIGN-002：Capability Module 上升为平台能力开放体系

结论：Capability Module 不只是 JS 调 Native API，而是系统能力、服务能力、Agent 工具能力的统一接入机制。

原因：插件机制和服务协同机制是平台架构重点。

### KD-ALIGN-003：Toolkit 上升为开发者体系入口

结论：Toolkit 不只是 build 工具，而是应用接入、校验、调试、benchmark 和后续 IDE 的 CLI 内核。

原因：开发者体系和应用接入标准需要工具链承载。

### KD-ALIGN-004：Benchmark 上升为平台质量度量

结论：Benchmark 不只是性能展示，而是兼容性、可观测性、跨端差异治理的一部分。

原因：平台能力需要可验证、可比较、可演进。

## 6. 重点吸收点

1. **平台视角大于框架视角**
   框架负责跑起来，平台负责接入、扩展、治理和演进。

2. **能力开放是平台主干**
   `system.*`、`service.*`、`agent.tool` 应该进入同一套能力接入体系。

3. **生态建设需要标准和治理**
   RPK、manifest、权限、兼容矩阵、校验工具共同构成生态规则。

4. **多端不是控件适配这么简单**
   多端还包括设备能力差异、资源约束、输入方式、权限模型和体验降级。

5. **第一阶段聚焦，架构上留位**
   不一次性实现全部生态能力，但总架构必须能自然长出这些能力。
