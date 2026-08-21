# M1-Alpha 集成 Agent

> **已完成并停止。** Alpha S1 已通过；后续 M1-S2-S5 的唯一执行入口是
> [`../m1/README.md`](../m1/README.md) 和 [`../m1/agent-instructions.md`](../m1/agent-instructions.md)。

## 目录

- [1. 结论](#1-结论)
- [2. 唯一目标](#2-唯一目标)
- [3. 授权边界](#3-授权边界)
- [4. 当前输入](#4-当前输入)
- [5. 执行顺序](#5-执行顺序)
- [6. 完成标准](#6-完成标准)
- [7. 禁止范围](#7-禁止范围)
- [8. 通信](#8-通信)
- [9. 启动提示词](#9-启动提示词)

## 1. 结论

M1-Alpha 改由一个集成 Agent 纵向负责。项目 Agent 全部停止，避免跨项目问题反复交接。

集成 Agent 的职责不是继续设计，而是用最小、干净、符合冻结架构的实现跑通 Case 001 S1。Toolkit、Core、JS、LVGL 组件门禁已经通过，当前只做最终组装。

## 2. 唯一目标

```text
Case 001 Alliance DSL Source
-> Toolkit build
-> corrected Runtime RPK
-> Core PackageLoader
-> JS App/Page Module + VM + onInit + initial binding
-> Core Initial Render + Yoga/Measure + RuntimeTreeStore
-> MountTransaction
-> LVGL/SDL Mount + Present
-> visible root page
-> deterministic teardown
```

成功标准是标准输入通过真实链路显示首屏，不是更多组件级测试或更多 Spec。

## 3. 授权边界

M1-Alpha 集成 Agent 在本切片内可以修改：

```text
quickapp-kit-ai/quickapp-toolkit
quickapp-kit-ai/quickapp-runtime-core
quickapp-kit-ai/quickapp-runtime-js
quickapp-kit-ai/quickapp-runtime-lvgl
quickapp-kit-ai/quickapp-examples
```

该授权只用于完成已冻结的 Alpha 真实链路。默认只修改 `quickapp-examples` 的 Composition Root；只有真实主链明确出现组件缺口时，才允许对其他四个工程做最小修复。公共合同仍由 `v3/spec/contracts` 唯一定义；发现合同矛盾时记录到集成 Handoff，不得私自创建第二套协议。

## 4. 当前输入

必须先读：

```text
v3/m1-alpha/status.md
v3/spec/contracts/artifact-contract.md
v3/spec/contracts/capability-module-contract.md
v3/reviews/subspec-review/2026-08-18-alpha-component-gate-review.md
五个项目的 spec/AGENT-HANDOFF.md
```

当前已通过：

- Case 001 基线与公共合同。
- Toolkit Canonical Lowering、Bundle/Page IR/RPK 打包机制。
- JS Module/VM 与 initial-only 分层。
- Core Loader、Initial Render、Yoga/Measure、唯一 RuntimeTreeStore、MountTransaction 组件。
- LVGL Surface、Measure、Mount/Present 组件。

四项 Alpha 定向修正已经由总架构验收为 `4/4 VERIFIED`；新 RPK SHA-256 为 `95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4`。

当前必须完成：

1. Examples 唯一 Composition Root。
2. 真实 RPK -> JS -> Core -> LVGL/SDL 主链。
3. 首屏 visible、结构化 Trace 和资源归零证据。

## 5. 执行顺序

```text
Step 1: 使用已验证的新 RPK
Step 2: 在 Examples 建立唯一 Composition Root
Step 3: 运行真实 Case 001 S1
Step 4: 只修复实际暴露的最小联调缺口
Step 5: 收口最小证据并提交总架构校审
```

不要等待其他 Agent，不要把跨项目问题重新拆回项目队列。

## 6. 完成标准

以下条件必须全部满足：

1. Toolkit 从冻结 Case 001 Source 生成新的 Runtime RPK。
2. RPK Metadata、Bundle define 和 Core `VerifiedModule` 的 Package dependencies 一致。
3. JS 执行真实 App/Page Bundle，完成 `onInit`、initial binding 和 `InstantiateTemplate`。
4. Core 只使用唯一 `RuntimeTreeStore` 生成真实 `MountTransaction`。
5. LVGL/SDL 显示真实 View/Text/Button，CJK 标题可见，`fontSize` 生效。
6. 形成最小结构化 Trace：load、module、VM、render、mount、present、teardown。
7. 关闭后 Surface、Node、Handler、Module、Engine 和平台对象回到基线。
8. 提供一条可复现构建运行命令和首屏证据。

Alpha 只要求相关 focused tests 和主链回归通过；完整 ASan/TSan/Release 矩阵不阻塞首屏，放到首屏通过后的收口阶段。

## 7. 禁止范围

- 不启动 Android、iOS、Benchmark。
- 不实现完整 Reactive、Block、Event、Navigation、Capability。
- 不启动 TK-S08/TK-S09、LV-S05/LV-S07..S10 或其他后续分 Spec。
- 不手写 Page IR、Bundle、BindingValue、RenderTransaction 或 MountTransaction。
- 不使用 Fake Host 冒充 LVGL/SDL。
- 不创建第二棵 Runtime Tree、Alpha 专用 Runtime 或通用 JSON Bridge。
- 不增加与首屏无关的文档、抽象、工具和证据矩阵。

## 8. 通信

集成 Agent 唯一通信文件：

```text
v3/m1-alpha/INTEGRATION-HANDOFF.md
```

每完成一个 Step 追加：

```text
状态
已完成
已验证事实
当前阻塞
修改项目
验证命令与结果
下一步
公共合同影响
```

只有最终标记 `READY_FOR_ARCH_REVIEW` 后，总架构 Agent 才进行 Alpha 完成校审。

## 9. 启动提示词

```text
你是 QuickApp Kit 的 M1-Alpha 集成 Agent，负责一个端到端结果，不是单项目 Agent。

先完整读取：
- v3/m1-alpha/INTEGRATION-AGENT.md
- v3/m1-alpha/status.md
- v3/spec/contracts/artifact-contract.md
- v3/spec/contracts/capability-module-contract.md
- v3/reviews/subspec-review/2026-08-18-alpha-component-gate-review.md
- Toolkit、Core、JS、LVGL、Examples 五个项目的 spec/AGENT-HANDOFF.md

你的唯一目标：冻结 Case 001 Source 经 Toolkit 生成真实 Runtime RPK，由 Core Loader 和 JS Runtime 加载执行，经 Core Initial Render/Yoga/唯一 RuntimeTreeStore 生成 MountTransaction，最后由真实 LVGL/SDL 显示 CJK 首屏并确定释放资源。

四个组件门禁已经 VERIFIED。你被授权在 M1-Alpha 范围内建立 quickapp-examples Composition Root；只有真实链路暴露明确缺口时，才允许最小修改其他工程。不要等待或重新拆给其他 Agent。

按 INTEGRATION-AGENT.md 第 5 节顺序持续实现、运行和修复，直到第 6 节全部满足。不要停在分析、计划、局部组件通过或上游阻塞报告；跨项目问题由你在同一任务中闭环。

保持冻结架构：单一 Runtime Tree、typed ABI、Package dependencies 与 typed facade 分离、真实 RPK、真实 LVGL/SDL。禁止 Fake、手写中间产物、第二套合同、Alpha 专用 Runtime和通用 JSON Bridge。

只把过程与结果追加到 v3/m1-alpha/INTEGRATION-HANDOFF.md。完成后标记 READY_FOR_ARCH_REVIEW，并给出运行命令、首屏证据、Trace、资源归零和各项目测试结果。
```
