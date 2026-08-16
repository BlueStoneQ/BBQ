# 当前 Agent 话术

## 目录

- [1. 结论](#1-结论)
- [2. 使用方式](#2-使用方式)
- [3. Toolkit](#3-toolkit)
- [4. JS Runtime](#4-js-runtime)
- [5. Runtime Core](#5-runtime-core)
- [6. LVGL Runtime](#6-lvgl-runtime)
- [7. Examples](#7-examples)
- [8. 平台顺序](#8-平台顺序)
- [9. Benchmark](#9-benchmark)

## 1. 结论

**当前主线启动 Toolkit、JS、Core、LVGL 和 Examples；平台产品顺序始终是 LVGL/SDL -> Android -> iOS。**

iOS 只允许完成已经启动的 IOS-S01 Foundation，不代表进入 iOS 平台实施；Android 从 M2 开始，iOS 从 M3 开始。

## 2. 使用方式

继续使用原来的八个项目 Agent 对话。把下列对应代码块发给 Agent；未列为设计或编码任务的项目保持等待。

## 3. Toolkit

```text
你继续负责 quickapp-toolkit。TK-S01 已由总架构复核为 VERIFIED。

先读取 v3/V1-EXECUTION-PLAN.md、v3/AGENT-WORK-BOARD.md、最新 Foundation 复核、本项目 subspec-index.md 与 AGENT-HANDOFF.md。

当前任务：并行设计 TK-S02 Manifest 与 Module Graph、TK-S03 UX/Script/Style Frontend。只写两个分 Spec，不写产品代码。

分别建立：
- spec/subspecs/tk-s02-manifest-module-graph/
- spec/subspecs/tk-s03-source-frontends/

每个目录固定交付 README.md、requirements.md、design.md、tasks.md、acceptance.md。两者共享输入 SourceAccess，但职责必须分开：S02 只拥有 manifest/route/module/asset/capability 关系；S03 只拥有联盟 UX/JS/style 解析、源码位置、语法矩阵和诊断。不得提前 Lowering，不得预设非公共 Artifact 字段。

在 Handoff 追加启动和完成记录。完成自检后一起标记 READY_FOR_REVIEW，等待总架构校审；不得编码 TK-S02/TK-S03，不得启动 TK-S04。
```

## 4. JS Runtime

```text
你继续负责 quickapp-runtime-js。

先读取 v3/V1-EXECUTION-PLAN.md、v3/AGENT-WORK-BOARD.md、Foundation 复核、本项目 JS-S01 五份已通过分 Spec与 AGENT-HANDOFF.md。

当前任务不变：严格按 JS-S01 tasks 实现 JS Engine Service，并完成 Fake/QuickJS common suite、所有权、队列、microtask budget、Observation、sanitizer、单 Engine 与资源归零证据。

只实现 JS-S01；不得实现 Runtime ABI、Binding flush、VNode、Platform Host 或 JS-S02。完成后在 Handoff 标记 READY_FOR_REVIEW，由总架构复核。
```

## 5. Runtime Core

```text
你继续负责 quickapp-runtime-core。CORE-S01 实现已由总架构复核为 VERIFIED。

先读取 v3/V1-EXECUTION-PLAN.md、v3/AGENT-WORK-BOARD.md、最新 Foundation 复核、公共 Artifact/Package/Page IR/Runtime Tree 合同、本项目 subspec-index.md 与 AGENT-HANDOFF.md。

当前任务：并行设计 CORE-S02 Package Loader 与 CORE-S05 Runtime Tree/Block。只写两个分 Spec，不写产品代码。

分别建立：
- spec/subspecs/core-s02-package-loader/
- spec/subspecs/core-s05-runtime-tree-block/

每个目录固定交付 README.md、requirements.md、design.md、tasks.md、acceptance.md。S02 冻结 PackageSource、ZIP、Manifest/Metadata/Page IR 校验、缓存和 Verified Module 交付；S05 冻结唯一 Runtime Tree、Node/LogicalRef、静态实例化、Block 生命周期和 Handler ownership。两者只通过公共合同连接，不得形成第二棵权威树，不得出现平台或 JS Engine 类型。

在 Handoff 追加启动和完成记录。完成自检后一起标记 READY_FOR_REVIEW；不得编码 CORE-S02/CORE-S05，不得启动 CORE-S03/S06。
```

## 6. LVGL Runtime

```text
你继续负责 quickapp-runtime-lvgl。LV-S01 已由总架构复核为 VERIFIED。

先读取 v3/V1-EXECUTION-PLAN.md、v3/AGENT-WORK-BOARD.md、最新 Foundation 复核、公共 Composition/Launch/Lifecycle/Observation 合同、本项目 subspec-index.md 与 AGENT-HANDOFF.md。

当前任务：设计 LV-S02 Runtime Host 与 Backends。只写分 Spec，不写产品代码。

建立 spec/subspecs/lv-s02-runtime-host-backends/，固定交付 README.md、requirements.md、design.md、tasks.md、acceptance.md。必须精确定义 Composition Root、PackageSource、Core/JS 装配、单 Engine Provider、TraceSink、RuntimeLifecycleControl，以及 lvgl-simulator-dev 和 lvgl-embedded-min 的 SDL/libuv/内建 Backend 选择与裁剪边界。

不得实现 Surface/Mount/Input，不得把 libuv 写成 Core 必选依赖。在 Handoff 追加启动和完成记录，标记 READY_FOR_REVIEW 后等待总架构校审；不得编码 LV-S02 或启动 LV-S03。
```

## 7. Examples

```text
你继续负责 quickapp-examples。EX-S02 已完成设计，总架构已用 P0-EVENT-003 关闭 EX-S02-REQ-001。

只做一次定向同步：把 EX-S02 五份文档中的待决策表述改为冻结语义：RenderTransaction.requestId 可选；Handler 返回前的同步状态 flush 必须携带输入 RequestId；普通非事件更新和异步 continuation 必须省略。

同步 requirements、design、acceptance 和待验证清单，在 Handoff 记录已消费 P0-EVENT-003，并保持 READY_FOR_REVIEW。不得修改 Fixture 源码、生成产品产物或启动 EX-S03。
```

## 8. 平台顺序

```text
LVGL/SDL M1 -> Android M2 -> iOS M3
```

### Android Agent

```text
AND-S01 已 VERIFIED。当前停止扩展，不启动 AND-S02；等待 M1 完成后由总架构发布 M2 Android 任务。
```

### iOS Agent

```text
你只完成已经启动的 IOS-S01 Foundation 实现和验收，这是并行基础准备，不是 iOS 平台实施提前。

完成 Foundation/Dispatch Swift Package、Fake Core、PackageSource、Scene/control、Observation、sanitizer 和资源归零验证后，在 Handoff 标记 READY_FOR_REVIEW。

IOS-S02 及 UIKit Surface/Mount/Input 全部等待 M3；M2 Android 完成前不得启动。
```

## 9. Benchmark

Benchmark：BM-S02 已 `VERIFIED`，BM-S03 等待 M4；当前停止扩展。
