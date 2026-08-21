# M1 Fast Track 指导

## 目录

- [1. 结论](#1-结论)
- [2. 第一性目标](#2-第一性目标)
- [3. 当前问题](#3-当前问题)
- [4. 三阶段执行](#4-三阶段执行)
- [5. Spine 门禁](#5-spine-门禁)
- [6. 切片范围](#6-切片范围)
- [7. 测试与校审](#7-测试与校审)
- [8. Agent 执行规则](#8-agent-执行规则)
- [9. 当前指令](#9-当前指令)
- [10. 时间盒](#10-时间盒)

## 1. 结论

M1 立即改为三阶段：

```text
M1-Spine：最快跑通并验证完整架构骨架
-> 架构检查点
-> M1-Feature：补最小 Capability
-> M1-Hardening：按风险补齐完整设计、负例和工程质量
```

本调整不修改架构、公共合同、项目边界和最终 V1 目标，只改变实现顺序与阶段门禁。

M1-Spine 只回答一个问题：**真实 Runtime RPK 能否通过同一套 JS Runtime、C++ Core 和 LVGL Platform 完成渲染、事件、路由、增量更新、返回与销毁闭环。**

在 Spine 通过前，任何不直接回答这个问题的工作都不得阻塞主线。

## 2. 第一性目标

### 2.1 快速但不临时

**Fast Track 只能缩小能力覆盖，不能降低架构正确性。Spine 是正式架构的最窄可运行切面，不是一次性原型。**

Fast Track 只指导实施顺序，不重新定义架构。`v3/spec/**`、`v3/projects/*/spec/**` 中已冻结的架构、公共合同和项目 Spec 默认只读；Agent 不得为方便编码直接修改。若代码与冻结设计冲突，只能在 `M1-HANDOFF.md` 记录 `[待决策]`、最小复现和影响范围，暂停受影响路径，由总架构知会用户并取得明确同意后再处理。

允许缩减：

- 一个 Binding，而不是完整 Block/keyed list。
- 一条成功链，而不是完整失败组合矩阵。
- focused/依赖锥测试，而不是每次全配置回归。

禁止妥协：

- 在 Runtime 中硬编码 Case、route、NodeId、HandlerId 或 BindingId。
- 手写 Bundle、Page IR、RenderTransaction、MountTransaction 等中间产物冒充真实链路。
- 绕过 typed Port/Message，直接跨层调用实现对象。
- 创建第二棵权威 Tree、第二套路由、事件或生命周期状态。
- 新增 `alpha`、`spine`、`temporary`、切片编号专用的公共 API 或正式实现分支。
- 以 TODO、空实现或进程退出掩盖已接受请求的资源与所有权问题。

不满足上述边界时，即使界面可见也不能判定 Spine 通过。

每个 Spine 切片只保留五个不可删除的事实：

1. **真实输入**：必须消费 Toolkit 生成的真实 Runtime RPK。
2. **真实边界**：JS、Core、Platform 之间只走冻结的 typed Port/Message。
3. **单一权威**：Runtime Tree、Navigation、Lifecycle 仍由 Core 维护唯一事实。
4. **真实结果**：必须在 LVGL/SDL 中产生可观察的页面、文本更新或返回结果。
5. **可结束**：本切片新增的对象能够释放，不能靠进程退出掩盖生命周期错误。

这五项成立即证明架构骨架；完整错误矩阵、所有 Profile、全部分 Spec 和性能调优属于后续加固。

## 3. 当前问题

当前速度异常不是主架构复杂，而是执行门禁把 Spine 与 Hardening 混在了一起：

| 当前工作 | 评估 | 新处理方式 |
|---|---|---|
| 真实 RPK 端到端运行 | 核心 | Spine 阻塞门禁 |
| typed Bridge 与单一 Core 权威 | 核心 | Spine 阻塞门禁 |
| 每个切片完整负例矩阵 | 过早 | Hardening |
| 每个切片跑所有项目全量测试 | 过重 | 关键检查点统一执行 |
| 每个切片都暂停等待校审 | 过慢 | 改为两个架构检查点 |
| 每个切片重复通读全部总 Spec、分 Spec 和历史交接 | 过重 | 只读当前合同、短 Handoff 与代码 |
| 每个切片同步所有项目证据、索引和总看板 | 过重 | Spine 只更新一份 M1 Handoff |
| 所有关联 ID 和 Trace 字段一次完备 | 过早 | Spine 只保留链路定位所需最小字段 |
| 所有队列满、超时、late callback 组合 | 过早 | S5/Hardening |
| `system.prompt` Capability/Toast | 扩展能力，不是三大系统骨架 | Spine 后实现 |
| 页面栈上限、完整 Profile 容量配平 | 非当前主链 | TODO |
| 全量 Benchmark、Android、iOS、AI、Skill/MCP | 非 M1-Spine | 后续里程碑 |

## 4. 三阶段执行

### 4.1 M1-Spine

目标是连续跑通：

```text
S1 首屏
-> S2 事件与路由
-> S3.5 单 Binding 增量更新
-> S4 Platform Back
-> S5 最小线程与销毁
```

Spine 不要求每个相关分 Spec 完整实现，只允许实现闭环必需的正式组件路径；不得建立临时第二套 Runtime、Tree、Router 或 Bridge。

### 4.2 M1-Feature

Spine 架构检查点通过后实现 S3 typed Capability。S2 的 typed router 已经证明 Bridge 扩展路径成立，因此 `system.prompt` 不再阻塞增量渲染、返回和线程骨架验证。

### 4.3 M1-Hardening

Spine 通过后，再按真实风险补齐：

- 重复、过期、乱序、超时、队列满和 late callback 矩阵。
- Case 002 的 Block remove/instantiate/keyed move/reuse。
- Capability unsupported/failure/timeout 与 Provider 关闭。
- Navigation close failure、Root 边界和更多生命周期组合。
- Debug、Release、ASan/UBSan、TSan 与双 LVGL Profile 全量回归。
- Trace 完整关联、内存基线、裁剪证据和基础性能指标。

现有总 Spec 和分 Spec 继续作为 Hardening 的完整目标，不删除、不推翻。

## 5. Spine 门禁

一个 Spine 切片只有以下情况可以阻塞：

1. 真实端到端主链失败。
2. 当前切片新增或修改模块的 focused tests 失败。
3. 出现第二套权威状态、跨层旁路或非 typed 通信。
4. 必须修改公共 wire、所有权或线程模型才能继续。
5. 本切片对象无法正常释放，导致下一切片不能继续运行。
6. 修改共享 ABI、Runtime Tree 或 Mount 路径后，其直接依赖锥回归失败。

以下情况只记录，不阻塞当前切片：

- 未被本切片触及、且已有历史通过证据的测试在临时构建目录失败。
- 非当前主链的完整负例、性能、裁剪或 Profile 证据缺失。
- 文档索引、看板、分 Spec 完成比例尚未同步。
- 后续平台和后续产品能力未实现。
- 与当前修改没有依赖关系、且有历史通过证据的旧构建配置失败。

非阻塞不等于删除：统一在 `M1-HANDOFF.md` 标记 `[HARDENING]`，并在 Spine 结束后处理。

## 6. 切片范围

### 6.1 S2 事件与路由

Spine 成功条件：

```text
真实 LVGL click
-> Core Event Router
-> JS Handler
-> typed router.push
-> Core Navigation
-> Detail Surface 可见
```

只要求一次点击、一次 Handler、一次 Push、Core 栈为 2、Detail 真实可见、切片对象可释放。已有 focused Event Router 测试必须通过。

重复点击、missing route、Platform create failure 和 late event 已经存在，可作为附加证据，但不得继续扩展负例。

### 6.2 S3 Capability（Spine 后）

Spine 成功条件：

```text
Detail 真实 click
-> JS Handler
-> typed ShowToast request
-> Core ModuleRegistry/Invoker
-> LVGL Provider
-> Toast 可见
-> typed result 返回 JS
```

只要求一次成功请求、一次可见 Toast、一次结果回调、Navigation 栈不变。unsupported、timeout、Provider close 和完整错误矩阵进入 Hardening。

S3 不阻塞 M1-Spine；在检查点 B 通过后执行。

### 6.3 S3.5 增量更新

S3.5 Spine 使用最小联盟 DSL focused fixture `BINDING-001`，只包含一个计数文本、一个按钮和一次 `count += 1`。不得使用手写 Bundle/Page IR，也不得修改 Case 002 的既有交互来掩盖 Block/keyed 语义。完整 Case 002 保留给 Hardening。

Spine 成功条件：

```text
一次 state write
-> 一个 dirty binding
-> 一个 RenderTransaction
-> Core 唯一 Runtime Tree revision +1
-> 一个 MountTransaction
-> LVGL 文本真实变化
```

必须证明不是全量重建、Platform 不做业务 diff。Block、keyed list、重复事务、过期事务和完整原子失败矩阵进入 Hardening。

S3.5 完成后必须暂停，执行第一次架构检查点；它是验证增量架构的关键切片。

### 6.4 S4 Platform Back

Spine 成功条件：

```text
真实 Platform Back
-> Core NavigationClose
-> Detail Surface 关闭
-> Demo Surface 恢复可见
```

只要求 Core 栈从 2 变为 1、Detail 资源释放、Demo 恢复。关闭失败、Root pop 和更多栈语义进入 Hardening。

### 6.5 S5 最小稳定性

Spine 成功条件：

- JS Executor、Core Runtime、LVGL owner 的线程归属可观察。
- 选择一个跨层队列验证有界拒绝，不做所有队列组合。
- 选择一个中途失败验证 Core 权威状态不被污染。
- 完整 Runtime teardown 后核心资源计数归零。

Noop/Recording 全矩阵、完整错误组合、压力与长期运行进入 Hardening。

## 7. 测试与校审

### 7.1 每个切片

只执行：

1. 当前切片端到端程序。
2. 当前新增/修改模块的 focused tests。
3. 当前修改共享模块的直接依赖锥测试。
4. 一个已有首屏 smoke test，防止基本回归。

不要求每个切片重复运行所有项目、所有配置和所有 sanitizer。

依赖锥按真实调用关系确定。例如修改 JS Runtime ABI，需要运行 JS ABI focused tests 和当前端到端程序；修改 Core Runtime Tree/Mount，需要运行 Core Tree/Mount focused tests、LVGL Mount focused tests和当前端到端程序。不得因为“不是全量测试”而跳过直接消费者。

### 7.2 两个检查点

```text
检查点 A：S3.5 完成
  验证 Bridge + Render + Event + Incremental 的骨架一致性

检查点 B：S5 完成
  验证 M1-Spine 全链路、线程边界和资源释放
  通过后放行 S3 Capability
```

只有以下变化需要额外独立校审：

- 公共 wire Schema 改变。
- Core 权威所有权改变。
- 线程模型改变。
- 出现现有合同无法表达的新跨层消息。

普通实现缺陷和 Composition Root 接线不启动额外校审。

## 8. Agent 执行规则

1. 当前长期 M1 Agent 直接完成 S3.5；检查点 A 前不实现 S3 Capability。
2. 每个切片先写最短闭环，不预先建设完整通用系统。
3. 代码暴露真实缺口时，只补当前闭环所需的正式最小实现。
4. 不因潜在未来需求修改公共合同；在 `M1-HANDOFF.md` 标记 `[HARDENING]`。
5. 同一问题连续定位 30 分钟仍未推进时，写明事实、最小复现和建议，不继续扩散搜索。
6. 每个切片结束只追加不超过 20 行的交接：主链结果、focused tests、资源结果、遗留项。
7. S2 完成后直接进入 S3.5，不实现 S3 Capability。
8. S3.5 必须暂停等待检查点 A；S5 必须暂停等待检查点 B。
9. Spine 期间不更新各项目 Evidence、分 Spec 完成比例和总看板；只更新 `M1-HANDOFF.md`。
10. 当前 Agent 已经读取过的总 Spec 和项目历史不重复通读；进入新切片只读本文件、`M1-HANDOFF.md` 末尾、当前合同和相关源码。
11. 检查点 A 通过后，新建一个干净上下文的 M1 Agent 执行 S4/S5；它只继承文档和代码事实，不继承冗长聊天历史。
12. 不新增带 `alpha`、`spine`、`temporary` 或切片编号的公共 Runtime API、状态机或实现分支。现有 Alpha 实现可以复用，但被 S3.5 触及时必须向通用正式实现演进，不得继续扩张。
13. 当前切片涉及尚无详细分 Spec 的正式模块时，不等待完整分 Spec；先在 `M1-HANDOFF.md` 写不超过 10 行的 Slice Contract，冻结 input、output、owner、thread、success、failure，再实现最小正式路径。

## 9. 当前指令

当前 S2 主链已经满足 Spine 成功条件：真实点击、Event Router、JS Handler、typed router.push、Core 权威栈、Detail 可见和资源归零均已运行通过。

当前 Agent 立即执行：

1. 停止扩展 S2 负例与外围能力。
2. 将 `build-m1-s2` 中 `lv_s02_contract_tests` 的 Display 初始化失败在 `M1-HANDOFF.md` 标记为 `[HARDENING]`；该模块已有历史全配置通过证据，且失败不在 S2 事件/路由 focused path。
3. 在 `M1-HANDOFF.md` 追加 S2 Spine 运行结果，状态标记为 `VERIFIED`，范围注明 `Spine`。
4. 跳过 S3 Capability，直接进入本文件 6.3 节 S3.5。
5. S3.5 开始前先写最小 Slice Contract；完成后暂停并请求架构检查点 A。

## 10. 时间盒

| 工作 | 正常时间盒 | 超时动作 |
|---|---:|---|
| S3.5 Slice Contract 与 BINDING-001 Runtime RPK | 1 小时 | 记录缺失合同或 Toolkit 缺口，不扩文档 |
| S3.5 JS dirty binding 与单 UpdateBinding | 2 小时 | 缩到一个 state path、一个 Binding |
| S3.5 Core incremental commit 与 LVGL 可见更新 | 3 小时 | 提交最小复现并请求架构决策 |
| 检查点 A | 1 小时 | 只检查权威树、事务、Revision 和 Mount 边界 |
| S4 Platform Back | 2 小时 | 只保留成功 close/reveal 主链 |
| S5 最小稳定性 | 2 小时 | 只保留一个队列、一个失败和 teardown |
| 检查点 B | 1 小时 | 只检查线程、状态与资源 |
| S3 Capability | 4 小时 | 只保留 showToast 成功链 |

时间盒是范围控制，不是跳过正确性。单项超过时间盒时必须停止横向扩展，只记录：当前事实、最小失败点、是否涉及公共合同、下一项最小动作。
