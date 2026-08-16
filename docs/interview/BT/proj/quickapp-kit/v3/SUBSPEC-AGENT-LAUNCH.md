# v3 分 Spec Agent 启动与通信

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 在哪里](#2-总-spec-在哪里)
- [3. 并行与串行方案](#3-并行与串行方案)
- [4. 当前波次](#4-当前波次)
- [5. 新对话启动提示词](#5-新对话启动提示词)
- [6. 分 Spec 标准结构](#6-分-spec-标准结构)
- [7. 通信机制](#7-通信机制)
- [8. 校审与编码门禁](#8-校审与编码门禁)

## 1. 结论

分 Spec 采用：**项目之间并行，项目内部按 `subspec-index.md` 依赖图推进；每个项目一个长期 Agent。**

可以从总架构对话拆出八个新对话。聊天上下文只用于提高启动速度，v3 文档才是唯一事实源；即使没有继承任何聊天上下文，Agent 也必须能仅凭本文件、工作看板、公共 Spec 和项目总 Spec 正确工作。

总架构和项目总 Spec 已通过。分 Spec 保留为完整责任地图，执行按 [`V1-EXECUTION-PLAN.md`](./V1-EXECUTION-PLAN.md) 的端到端波次推进；具体状态和编码门禁以工作看板第 5 节为准。

## 2. 总 Spec 在哪里

### 2.1 项目总 Spec

每个项目的完整总 Spec 位于：

```text
projects/<project>/spec/
├── README.md
├── requirements.md
├── architecture.md
├── subspec-index.md
├── acceptance.md
└── AGENT-HANDOFF.md
```

八个项目分别是：

```text
quickapp-toolkit
quickapp-runtime-js
quickapp-runtime-core
quickapp-runtime-lvgl
quickapp-runtime-android
quickapp-runtime-ios
quickapp-benchmark
quickapp-examples
```

### 2.2 总架构与公共合同

```text
spec/README.md
spec/requirements.md
spec/design.md
spec/tasks.md
spec/acceptance.md
spec/architecture.md
spec/v1-scope-and-acceptance.md
spec/contracts/**
AGENT-WORK-BOARD.md
../TODO.md
```

优先级固定为：平台总 Spec > 详细公共合同/Schema > 项目总 Spec > 项目分 Spec > 聊天上下文。低优先级内容发生冲突时，Agent 必须停止受影响部分并升级，不得自行覆盖高优先级合同。

## 3. 并行与串行方案

### 3.1 跨项目

八个项目可以并行。当前以 Case 001 S1-S5 为主线，Toolkit、JS、Core、LVGL/SDL 在同一波次汇合；Android 和 iOS Foundation 可提前推进，但不阻塞 M1。

平台产品集成顺序仍为：

```text
LVGL/SDL -> Android -> iOS
```

这不限制 Android 和 iOS 提前设计分 Spec；只限制真实产品闭环和验收顺序。

### 3.2 项目内部

同一项目由一个长期 Agent 按 `subspec-index.md` 的依赖图推进：

1. 先完成无依赖的 Foundation 分 Spec。
2. Foundation 校审通过后，再启动依赖它的分 Spec。
3. 只有索引明确允许的兄弟分支可以并行设计。
4. 汇聚节点必须等待所有直接依赖的分 Spec 通过。
5. 不为每个分 Spec 新开一个互不知情的 Agent。
6. 最多提前设计一个执行波次；分 Spec `PASS` 后可以立即编码，不等待同波次其他项目。

本质：跨项目靠冻结合同解耦；项目内部靠同一设计所有者保持状态机、线程、对象所有权和错误语义一致。

## 4. 当前波次

| 项目 Agent | 当前任务 | 当前门禁 |
|---|---|---|
| Benchmark | 当前停止扩展 | `BM-S02 VERIFIED`；`BM-S03 HOLD_M4` |
| Toolkit | 设计 `TK-S02 + TK-S03` | `DESIGN_ALLOWED + CODE_BLOCKED` |
| JS Runtime | 实现 `JS-S01 JS Engine Service` | `JS-S01 CODE_ALLOWED` |
| Runtime Core | 设计 `CORE-S02 + CORE-S05` | `DESIGN_ALLOWED + CODE_BLOCKED` |
| LVGL Runtime | 设计 `LV-S02 Runtime Host 与 Backends` | `DESIGN_ALLOWED + CODE_BLOCKED` |
| Android Runtime | 当前停止扩展 | `AND-S01 VERIFIED`；`AND-S02 HOLD_M2` |
| iOS Runtime | 实现 `IOS-S01 Runtime Host 与 PackageSource` | `IOS-S01 CODE_ALLOWED` |
| Examples | 同步 EX-S02 到冻结的 Render 输入因果合同 | `EX-S02 READY_FOR_REVIEW + CODE_BLOCKED` |

W1 已对通过 Foundation 的 Toolkit、Core、LVGL 开放设计；JS 完成 S01 后加入。其余推进顺序见 `V1-EXECUTION-PLAN.md`，项目内部依赖仍以各自 `subspec-index.md` 为准。

## 5. 新对话启动提示词

当前八个项目话术见 [`2026-08-16-current-agent-prompts.md`](./reviews/subspec-review/2026-08-16-current-agent-prompts.md)，可以直接逐段复制。以下模板用于后续分 Spec。

为每个项目新建一个对话，只替换 `<PROJECT>`、`<SUBSPEC-ID>` 和 `<SUBSPEC-NAME>`：

```text
你是 QuickApp Kit v3 的 <PROJECT> 分 Spec Agent，长期负责该项目全部分 Spec 的连续设计。

当前任务：设计 <SUBSPEC-ID> <SUBSPEC-NAME>。现在只写分 Spec，不写产品代码。

先用 rg --files 定位 quickapp-kit/v3，然后按顺序阅读：
1. v3/SUBSPEC-AGENT-LAUNCH.md
2. v3/AGENT-WORK-BOARD.md
3. v3/spec/README.md、requirements.md、design.md、tasks.md、acceptance.md
4. 与当前任务相关的 v3/spec/contracts/**
5. v3/projects/<PROJECT>/spec/ 下的 README、requirements、architecture、subspec-index、acceptance、AGENT-HANDOFF

规则：
- v3 文档是唯一事实源，聊天上下文只作辅助。
- 结论先行、每个文档有目录；按照第一性说明输入、输出、状态、线程、所有权、错误和验收。
- 只写 v3/projects/<PROJECT>/spec/subspecs/<name>/ 和本项目 AGENT-HANDOFF.md。
- 不修改公共合同、其他项目文档和产品代码。
- 发现公共合同冲突时，不自行解决；按 SUBSPEC-AGENT-LAUNCH.md 的 [待决策] 模板写入本项目 AGENT-HANDOFF.md，并暂停受影响部分。
- 开始前在 AGENT-HANDOFF.md 追加“分 Spec 启动”记录；完成后追加结果、待验证项、阻塞项、下一步和公共合同影响。
- 完成后自检文档链接、依赖、需求覆盖、任务可执行性和验收闭环，然后报告本分 Spec 是否可提交独立校审。

本分 Spec 固定交付 README.md、requirements.md、design.md、tasks.md、acceptance.md。接口、数据结构、状态机、线程和对象所有权写入 design.md；不得生成产品代码或占位实现。

先复述当前任务边界和依赖，再直接开始读取并编写文档，不停留在方案建议。
```

## 6. 分 Spec 标准结构

```text
subspecs/<lowercase-id>-<short-kebab-name>/
├── README.md          # 结论、范围、依赖、状态、阅读顺序
├── requirements.md    # 输入、输出、功能、质量、非目标
├── design.md          # 接口、数据、流程、状态机、线程、所有权、错误、观测
├── tasks.md           # 可直接编码的有序任务、依赖和完成定义
└── acceptance.md      # 正例、负例、故障注入、资源、证据和通过条件
```

目录名固定使用“小写分 Spec ID + 简短英文名”，例如 `core-s01-foundation`、`lv-s01-backend-ports`；同一 ID 不得建立第二个目录。

每个文件都必须有目录并结论先行。分 Spec 不复制公共 Schema；只引用公共合同并定义本项目如何实现。

## 7. 通信机制

### 7.1 文件职责

| 文件 | 写入者 | 作用 |
|---|---|---|
| `AGENT-WORK-BOARD.md` | 总架构 Agent | 全局状态、公共决策、项目放行和实施顺序 |
| `projects/<project>/spec/AGENT-HANDOFF.md` | 对应项目 Agent、总架构 Agent | 项目 Agent 与总架构 Agent 的双向信箱 |
| `spec/**` | 总架构 Agent | 公共合同唯一事实源 |
| `subspecs/<name>/**` | 对应项目 Agent | 当前分 Spec 设计结果 |

子 Agent 不直接写工作看板和公共合同，避免并发冲突。Handoff 是追加式日志，任何 Agent 不得重写或删除已有事件。总架构 Agent 定期读取八份 Handoff，将全局结果回写工作看板，并在受影响项目的 Handoff 中追加答复。

总架构 Agent 统一扫描入口：

```text
rg -n '\[待决策\]|READY_FOR_REVIEW|BLOCKED' projects/**/spec/AGENT-HANDOFF.md
```

### 7.2 普通交接模板

```text
### YYYY-MM-DD / <Agent> / <SUBSPEC-ID> <事件>

- 状态：IN_PROGRESS | READY_FOR_REVIEW | PASS | BLOCKED
- 已完成：
- 新增事实：
- 本项目设计决定：
- 待验证项：
- 阻塞项：无 | ...
- 下一步：
- 公共合同影响：无 | ...
```

### 7.3 公共决策升级模板

```text
### YYYY-MM-DD / <Agent> / [待决策] <DECISION-ID>

- 问题本质：
- 冲突的现有合同：
- 为什么当前合同无法直接实现：
- 方案 A 与代价：
- 方案 B 与代价：
- Agent 建议：
- 影响项目：
- 阻塞范围：仅暂停哪些任务；哪些任务仍可继续
```

总架构 Agent 的处理顺序：判断是否真是公共问题 -> 必要时修改公共 Spec -> 在工作看板记录冻结决定 -> 在所有受影响 Handoff 回写 `[已冻结]` -> 放行被暂停任务。

## 8. 校审与编码门禁

每个分 Spec 独立过编码门禁，每个执行波次统一做端到端对齐：

```text
分 Spec 初稿
  -> 项目内自检
  -> 独立校审
  -> PASS
  -> 工作看板放行该分 Spec 编码
  -> 实现与测试
  -> 按 acceptance.md 提交证据
  -> 波次末检查跨项目合同和端到端结果
```

校审只检查当前分 Spec及其直接公共合同，不重复全面校审总架构。任何第二期事项不得进入 V1 tasks 或阻塞当前主链路。
