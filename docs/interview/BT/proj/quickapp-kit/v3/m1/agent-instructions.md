# M1 切片 Agent 指令

> 当前执行优先遵循 [`M1-FAST-TRACK-GUIDE.md`](./M1-FAST-TRACK-GUIDE.md)。本文件中的完整负例和逐切片暂停要求转入 M1-Hardening；Spine 阶段只在 S3.5 与 S5 后暂停。

> 本文件的 S2-S5 指令全部由**同一个长期 M1 集成 Agent**顺序执行，不为每个切片新建 Agent。
> Spine 阶段每完成一节必须写入 `M1-HANDOFF.md`；S2 后直接进入 S3.5，S3.5、S5 后暂停等待架构检查点。S3 Capability 在 Spine 后执行。

## 目录

- [1. 通用启动要求](#1-通用启动要求)
- [2. S2 提示词](#2-s2-提示词)
- [3. S3 提示词](#3-s3-提示词)
- [4. S3.5 提示词](#4-s35-提示词)
- [5. S4 提示词](#5-s4-提示词)
- [6. S5 提示词](#6-s5-提示词)

## 1. 通用启动要求

M1 集成 Agent 必须读取：

```text
v3/m1/README.md
v3/m1/M1-HANDOFF.md
v3/V1-EXECUTION-PLAN.md
v3/spec/v1-scope-and-acceptance.md
v3/spec/contracts/render-contract.md
v3/spec/contracts/event-contract.md
v3/spec/contracts/navigation-contract.md
v3/spec/contracts/capability-module-contract.md
v3/spec/contracts/observation-contract.md
```

首次进入 M1 时读取相关项目入口；后续切片不重复通读历史。只读取 Fast Track、本 Handoff 末尾、当前能力合同和相关源码。代码只能修改当前切片涉及的项目；不得顺手扩展其他能力。

通用约束：

- 使用真实 Case 001 Runtime RPK；不直接执行源码，不使用手写中间产物。
- 保持 Core 唯一权威 Runtime Tree；不创建第二棵 Tree、Platform mirror tree 或切片专用 Runtime。
- 跨层只使用已冻结 typed contract 和关联 ID；不新增通用 JSON Bridge。
- 观测只发结构化事实，不在热路径格式化文本或写文件。
- Spine 必须有真实结果、focused tests 和本切片资源释放；完整失败、降级与 late callback 矩阵转入 Hardening。
- 公共合同不由切片 Agent 私改；发现矛盾时在 `v3/m1/M1-HANDOFF.md` 记录 `[待决策]` 并停止受影响部分。
- 完成后只追加 `v3/m1/M1-HANDOFF.md`，不更新项目 Evidence、分 Spec比例和总看板；状态使用既有枚举，并注明 `Spine` 或 `Hardening` 范围。

## 2. S2 提示词

```text
你是 QuickApp Kit 的 M1-S2 垂直切片 Agent。

先读取 v3/m1/README.md、v3/m1/M1-HANDOFF.md、v3/m1/agent-instructions.md，
再读取 Event、Navigation、Render、Observation 公共合同和 JS/Core/LVGL/Examples
相关项目交接文档。

唯一目标：在 Alpha S1 已通过的真实 Case 001 主链上，完成并验证：

LVGL/SDL Input
-> Core Event Router
-> JS Handler
-> typed router.push
-> Core Navigation Push
-> 新 Detail Surface 创建、挂载和可见

必须使用 Case 001 中“跳转到详情页”的真实按钮和真实 RPK。Spine 必须证明：
1. 一次物理 click 只产生一个 input captured 和一个 Handler dispatch。
2. HandlerId、SurfaceId、RequestId、TransactionId 关联正确。
3. JS 只通过 typed ABI 调用 router.push，Core 维护唯一权威路由栈。
4. 新 Surface 在 Mount/Present 成功后才可见，旧页面按合同隐藏。
5. Detail 标题和正文真实可见。
6. S2 结束后能执行 teardown，资源回到 Alpha 基线。

重复 click、目标不存在、平台创建失败和 late callback 属于 Hardening；已有证据保留，但不得继续扩展。

可修改范围：quickapp-examples、quickapp-runtime-lvgl、quickapp-runtime-core、
quickapp-runtime-js；默认先改 Composition Root/切片接线，只有真实链路暴露
明确缺口才改组件实现。不得修改 Toolkit，不得启动 S3、S3.5、S4、S5。

不得手写 Page IR、Bundle、RenderTransaction、MountTransaction；不得伪造点击、
直接调用 Core Navigation 绕过 JS Handler、直接调用 Platform Toast 或创建第二套
Event/Navigation 状态机。

完成后在 v3/m1/M1-HANDOFF.md 追加主链、focused tests、资源结果和遗留项，然后直接进入 S3.5。
```

## 3. S3 提示词

```text
你是 QuickApp Kit 的 M1-S3 垂直切片 Agent。

只有 M1-Spine 已 VERIFIED 才能启动。先读取 v3/m1/README.md、v3/m1/M1-HANDOFF.md、
本文件，以及 Capability、Event、Observation 公共合同和 JS/Core/LVGL/Examples
相关交接文档。

唯一目标：在真实 Case 001 Detail 页面上完成：

LVGL/SDL Input
-> Core Event Router
-> JS Handler
-> typed system.prompt Capability request
-> Core ModuleRegistry/Invoker
-> LVGL PlatformProvider
-> typed result
-> Toast 可见

必须证明 Toast 内容正确、只出现一次、路由栈不变、没有导航旁路。失败、不支持能力、
超时和关闭后的 late result 转入 Hardening。不得使用通用 JSON Bridge、
直接调用平台 Toast、修改公共 Capability Schema 或启动 S3.5 以上能力。

完成后追加 v3/m1/M1-HANDOFF.md，提交真实运行、typed request/result 和资源证据，然后进入 Hardening。
```

## 4. S3.5 提示词

```text
你是 QuickApp Kit 的 M1-S3.5 垂直切片 Agent，负责增量更新验证。

只有 M1-S2 已 VERIFIED 才能启动。先读取 v3/m1/README.md、v3/m1/M1-HANDOFF.md、
Render、Block、Observation 公共合同和 JS/Core/LVGL/Examples 相关交接文档。

唯一目标：使用最小联盟 DSL focused fixture `BINDING-001` 验证：

JS state write
-> dependency/dirty binding
-> microtask flush
-> RenderTransaction
-> Core staged mutation
-> Style/Layout
-> MountTransaction
-> LVGL visible update

必须证明：
1. State 只通知实际依赖 Binding，不传递无关噪音。
2. JS 只提交 typed incremental intent；Core 仍维护唯一权威 Runtime Tree。
3. Core 先 prepare/layout，再原子 commit。
4. 不构造第二棵完整 VNode/Shadow Tree，不在 Platform 做业务 diff。
5. 事务按 Revision/TransactionId 关联。

失败原子性、重复/过期提交、完整 Block、复杂调度和性能系统转入 Hardening。完成后追加
v3/m1/M1-HANDOFF.md，标记 `READY_FOR_REVIEW` 并暂停执行架构检查点 A。

`BINDING-001` 只包含计数文本、更新按钮和 `count += 1`。必须由 Toolkit 生成真实 Runtime RPK。不得修改 Case 002 现有一次点击同时更新 count/visible/items 的语义；完整 Case 002 转入 Hardening。
```

## 5. S4 提示词

```text
你是 QuickApp Kit 的 M1-S4 垂直切片 Agent，负责平台返回和页面栈恢复。

只有 M1-S3.5 已 VERIFIED 才能启动。先读取 v3/m1/README.md、v3/m1/M1-HANDOFF.md、
Navigation、Lifecycle、Surface、Observation 公共合同和 Core/LVGL/Examples 交接文档。

唯一目标：在 Detail 已 Push 的真实 Case 001 状态上完成：

Platform Back
-> Core NavigationClose
-> Platform Close Surface
-> Detail lifecycle destroy
-> Demo Surface reveal/present

必须证明 Core 是唯一权威路由栈；Platform 不维护镜像栈；Detail 的 Node、Handler、
Surface 和 Host 映射释放；Demo 恢复可见。

关闭失败、Root pop 和 late callback 转入 Hardening。不得从 JS 伪造平台 back，不得
直接删除 Host 对象绕过 Core。完成后追加 v3/m1/M1-HANDOFF.md，然后直接进入 S5。
```

## 6. S5 提示词

```text
你是 QuickApp Kit 的 M1-S5 垂直切片 Agent，负责失败恢复、线程边界和完整销毁。

只有 M1-S4 已 VERIFIED 才能启动。先读取 v3/m1/README.md、
v3/m1/M1-HANDOFF.md、Error、Lifecycle/Threading、Observation、Surface 和 Render
公共合同，以及 JS/Core/LVGL/Examples 交接文档。

唯一目标：在真实 Case 001 S1-S4 已通过的基础上，验证：
1. JS Executor、Core Runtime、LVGL owner thread 的归属明确。
2. 跨边界只通过有界 typed queue/port，并选择一个队列验证容量拒绝。
3. 选择一个中途失败验证 Core 唯一权威状态不被污染。
4. destroyAppRuntime 后 App/Page/Surface/Node/Handler/Module/Engine/Host/queue
   资源回到基线；late callback 不复活对象。
5. 主链关联 ID 能定位跨层执行顺序。

完整队列、Noop/Recording、错误组合、压力测试、Benchmark 和其他平台实现转入
Hardening 或后续里程碑。完成后追加 v3/m1/M1-HANDOFF.md，标记
`READY_FOR_REVIEW` 并暂停执行架构检查点 B。
```
