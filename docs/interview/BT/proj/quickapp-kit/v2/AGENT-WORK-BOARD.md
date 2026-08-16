# Agent Work Board

> 定位：总架构 Agent 与各产品 Agent 的协作入口。
> 总架构负责人维护跨项目合同；产品 Agent 负责各自 Spec 和验证，不得自行改变跨平台协议。

## 目录

- [1. 总规则](#1-总规则)
- [2. 项目与启动文件](#2-项目与启动文件)
- [3. Agent 分工](#3-agent-分工)
- [4. 交付顺序](#4-交付顺序)
- [5. 通信规则](#5-通信规则)

## 1. 总规则

总架构的核心合同位于：

- `decisions/decision-v1.md`
- `decisions/v1-core-architecture-frozen.md`
- `contracts/runtime-contract.md`
- `spec/toolkit/AGENT-HANDOFF.md`

当前不可自行重定义的协议：

```text
InstantiateTemplate
RenderTransaction
EventMessage
FeatureRequest
LogicalNodeRef
TemplateHandlerId / HandlerId
Runtime NodeId
```

跨平台原则：

```text
Toolkit / JS Framework -> C++ Core Contract -> Platform Adapter -> Native Host
```

平台 Agent 可以提出协议变更，但必须记录为 `[待决策]`，由总架构统一裁决。

## 2. 项目与启动文件

| Agent | 项目 Spec 目录 | 启动文件 | 代码目录 | 主要职责 |
|---|---|---|---|---|
| Toolkit | `spec/toolkit/` | `spec/toolkit/README.md`、`spec/toolkit/AGENT-HANDOFF.md` | `quickapp-kit-ai/quickapp-toolkit/` | DSL 到 JS Bundle、IR、RPK |
| Android Runtime | `spec/quickapp-runtime-android/` | `spec/quickapp-runtime-android/AGENT-HANDOFF.md` | `quickapp-kit-ai/quickapp-runtime-android/` | 联盟 Android 行为基线、JS 引擎、JNI、Android Host |
| Runtime Core | `spec/quickapp-runtime-core/` | `spec/quickapp-runtime-core/AGENT-HANDOFF.md` | `quickapp-kit-ai/quickapp-runtime-core/` | C++ Runtime Tree、Transaction、Event Router、Layout、Router |
| JS Runtime | `spec/quickapp-runtime-js/` | `spec/quickapp-runtime-js/AGENT-HANDOFF.md` | `quickapp-kit-ai/quickapp-runtime-js/` | JS Executor、Runtime ABI、App/Shared/Page 生命周期 |
| LVGL Runtime | `spec/quickapp-runtime-lvgl/` | `spec/quickapp-runtime-lvgl/AGENT-HANDOFF.md` | `quickapp-kit-ai/quickapp-runtime-lvgl/` | LVGL/SDL Adapter、嵌入式输入和 Host 映射 |
| iOS Runtime | `spec/quickapp-runtime-ios/` | `spec/quickapp-runtime-ios/AGENT-HANDOFF.md` | `quickapp-kit-ai/quickapp-runtime-ios/` | JS 引擎、UIKit Adapter、iOS 生命周期和事件 |
| Benchmark | `spec/quickapp-benchmark/` | `spec/quickapp-benchmark/AGENT-HANDOFF.md` | `quickapp-kit-ai/quickapp-benchmark/` | 统一指标、日志、Case 001 对比和可观测性 |

`projects/quickapp-examples/` 是样例与 Golden 资产维护项目，不是 Runtime 实现项目。

`projects/<project>/` 保留产品级 README、需求概览和项目管理信息；正式 Spec、技术合同和 Agent 交接统一以 `spec/<project>/` 为准。

## 3. Agent 分工

### Toolkit Agent

先完成 Spec，再以 Case 001 验证：

```text
.ux + JS + style -> Normalized IR -> Template/Binding/Block/Handler/Style IR
-> JS Bundle -> RPK -> validate/inspect
```

必须交付：字段 Schema、版本、错误语义、确定性构建、Case 001 Golden、产物清单和可观测日志。

### Android Runtime Agent

以联盟 Android Runtime 为行为参考，完成：RPK Loader、app/page JS 加载、JS Bridge、Android Platform Adapter、Host Tree、事件和首屏/更新闭环。JNI 只能位于 Android Platform Adapter。

### Core Agent

当前先写 Core Contract Spec，不等待 Android 完成。具体实现 Spec 在 Android 闭环后根据真实实现抽取和校准。必须覆盖：Runtime Tree、NodeId 生命周期、InstantiateTemplate、RenderTransaction、EventMessage、FeatureRequest、线程/所有权/数据传递。

### JS Runtime Agent

定义 JS Executor 与 JS Framework 的边界，完成 app/shared/page 加载、Handler 注册、Binding flush 和 Runtime ABI 调用。不得创建平台对象或持有运行时 NodeId。

### LVGL Runtime Agent

定义 LVGL Platform Adapter 和 SDL 仿真链路：Host 映射、属性更新、布局结果消费、输入转 EventMessage、生命周期、内存和线程约束。不得把 LVGL 类型带入 Core。

### iOS Runtime Agent

定义 JS Executor、UIKit Platform Adapter、页面生命周期、事件转换和主线程提交。不得把 UIKit 类型带入 Core。

### Benchmark Agent

定义统一采集格式和 Case 001 场景，至少测量：RPK 体积、加载耗时、首屏耗时、状态更新延迟、事件延迟、Transaction 数量/大小、内存峰值。

## 4. 交付顺序

允许并行：Toolkit、Android、JS Runtime、LVGL、iOS、Benchmark 同时写 Spec。

Core 分两阶段：

1. 现在：完成跨平台 Contract Spec。
2. Android 首个闭环后：抽取平台无关实现并完成 Core Implementation Spec。

推荐验证顺序：

```text
Toolkit Case 001
-> Android 行为基线
-> C++ Core 抽取
-> LVGL SDL 闭环
-> iOS 闭环
-> Benchmark 对比
```

## 5. 通信规则

每个 Agent 的交接文件统一放在对应项目目录：

```text
projects/<project>/AGENT-HANDOFF.md
```

每次交接必须记录：

```text
日期
事件
已完成
新增事实
新增决策
待验证项
阻塞项
下一步
影响的跨平台合同
```

决策标签统一使用：

```text
[已冻结] [本 Agent 推荐，待确认] [已验证事实] [合理推断] [待验证]
```

Agent 不应修改其他项目的 Spec；涉及公共合同时，只在自己的交接文件提出变更，再由总架构 Agent 合并到总合同。
