# EX-S02 验收

## 目录

- [1. 结论](#1-结论)
- [2. Spec 通过条件](#2-spec-通过条件)
- [3. CASE-002](#3-case-002)
- [4. BLOCK-001](#4-block-001)
- [5. CAP-DEVICE-001](#5-cap-device-001)
- [6. EVENT-REQUEST-001](#6-event-request-001)
- [7. 跨平台与负向门禁](#7-跨平台与负向门禁)
- [8. 最终证据](#8-最终证据)

## 1. 结论

EX-S02 的判定原则是：可见结果证明“发生了什么”，结构化 transaction/ID/Result/资源证据证明“是否按公共合同发生”。只看到最终 UI 正确不能证明增量复用、事件因果或清理正确。

## 2. Spec 通过条件

- 五份文档齐全、有目录、结论先行，需求映射到任务和验收。
- 四个 Fixture 的职责、输入状态、操作、终点和非目标无重叠。
- 所有 operation、ID、错误和 marker 均来自公共合同。
- 待创建/待验证内容没有写成已完成事实。
- 当前没有修改 Fixture 源码或生成产品产物。

## 3. CASE-002

### 3.1 初始状态

启动 `/pages/Contract` 后必须显示：count `0`、button `更新状态`、`条件节点`、keyed 顺序 `[A,B]`。记录 A/B 的 BlockInstanceId、全部 NodeId 与 NativeHandle。

### 3.2 一次点击

1. 对 `更新状态` 发出一次 click，记录输入 RequestId R1。
2. 只执行一次 `onUpdate`，等待一个 RenderTransaction `presented`。
3. 断言 count 为 `1`、`条件节点` 不存在、顺序为 `[B,A]`。
4. 断言一轮 dirty flush、一个递增 Revision、一个 incremental Mount。
5. 断言 Render 包含 count UpdateBinding、conditional RemoveBlock、一个 MoveBlock。
6. 断言 A/B 没有 Remove/Instantiate，BlockInstanceId/NodeId/NativeHandle 保持。
7. 断言 input、Handler、state.mutated、render.flush、render.transaction 使用 R1 关联；transactionId 闭合 Render/Mount。`RenderTransaction` 字段级断言等待 `[待决策] EX-S02-REQ-001` 统一公共合同。

出现完整 InstantiateTemplate、A/B 重建、多个普通 RenderTransaction 或最终顺序错误，均失败。

## 4. BLOCK-001

| Step | 操作 | 通过条件 |
|---|---|---|
| B1 | launch `[A,B]` | 记录 A/B Block/Handler/Node/NativeHandle，item click 可路由 |
| B2 | 添加 C | 仅 C InstantiateBlock；A/B identity 保持；`[A,B,C]` |
| B3 | 删除 B | B RemoveBlock；A/C identity 保持；`[A,C]` |
| B4 | 释放删除前已捕获、删除后才到达分发点的 B 在途输入 | 旧 Handler 不执行；state/Render 不变化 |
| B5 | 重新添加 B | 新 B 四类 identity 均不等于旧 B；`[A,C,B]` |

B3 还必须证明：Core EventBinding 先删除、Runtime subtree 全部删除、Platform 只以 Block root RemoveHost 递归清理、全部后代 NativeHandle 映射消失。`handler.live`、`runtime.node.live` 与 Host object count 按预期下降。

故障分支：注入 Core 提交前 reject/cancel，B 仍可见且旧 Handler 恢复 live；注入提交后 presentation failure，B 逻辑删除和 Handler release 不回滚，按 Render recovery 合同处理。

## 5. CAP-DEVICE-001

### 5.1 Success

1. 确认 Manifest 声明 `system.device`，点击 `获取设备信息` 一次。
2. 断言一个 DeviceGetInfo request 和一个 completed result，requestId/surfaceId 相同。
3. 校验九个 required fields 全部存在且符合类型/正值约束。
4. 校验 screen dimensions 不小于 window dimensions；window physical pixels、density 与启动 logical viewport 在声明容差内一致。
5. 校验无唯一标识和 Schema 外字段；optional fields 可缺失。
6. 校验页面显示 success 与冻结字段投影，不读取平台对象。

### 5.2 Failure

| 注入 | 必须错误 | UI/Trace |
|---|---|---|
| module 预检通过，但 `getInfo` method 未注册 | `CAPABILITY_UNSUPPORTED` | failed 状态；`capability.failed` 同 requestId/errorCode |
| Provider 构造/执行失败 | `CAPABILITY_FAILED` | 不出现 success 字段 |
| 执行前 Surface destroy | `SURFACE_NOT_FOUND` | 不更新已销毁页面 |

### 5.3 Cleanup

在 request 在途时销毁 AppRuntime：请求被取消，已创建 Provider 逆注册顺序销毁，late result 不调用 Promise/callback、不产生 UI Render；在途 request、Provider 和页面引用释放。只隐藏页面不算 cleanup 通过。

若 Composition 缺少整个 `system.device` 模块，应由 EX-S03 在 JS 前断言 `RUNTIME_PROFILE_INCOMPATIBLE`，不属于本节调用期失败。

## 6. EVENT-REQUEST-001

### 6.1 连续输入与冒泡

1. 连续捕获两次 child click，分别记录 R1、R2，断言 `R1 != R2` 且同 AppRuntime 不复用。
2. 每次输入恰有一个 target dispatch 和一个 bubble dispatch，二者共享该次 RequestId。
3. target 是 child；currentTarget 依次 child/parent；phase 依次 target/bubble。
4. child/parent HandlerId 不同；R1/R2 不能通过 timestamp 推断或合并。
5. 两个 click 不写 state，因此不得出现相关 state/render marker。

### 6.2 同步继承

单击 `同步更新` 得到 R3；同步 state write、flush、Render submitted/presented 都以 R3 形成因果链，并以 transactionId 关联 Mount。Handler 不更新时不得伪造该链。公共合同统一前，不以私有 `RenderTransaction` 字段作为通过手段。

### 6.3 异步不继承

1. `开始异步` 输入为 R4，创建 deferred Promise 并返回。
2. `完成异步` 输入为 R5，只 resolve deferred 并返回。
3. continuation 随后更新可见文本并产生 Render。
4. continuation 的 state/flush/Render 不携带 R4 或 R5；R4/R5 仍只属于各自 input/Handler 链。

若异步 Render 自动携带 R4/R5，或 target/bubble 分配不同 RequestId，直接失败。

## 7. 跨平台与负向门禁

三平台必须使用每个 Fixture 的同一 Artifact SHA-256，并匹配操作、最终文本/顺序、ID 关系、Result/error 和清理语义。NativeHandle 的具体值、字体、viewport、时间和性能可不同。

以下任一情况失败：

- 修改 Case 001 补 device。
- 用 CASE-002 声称覆盖 add/remove。
- keyed reorder 删除重建 A/B，或重新添加 B 复用旧身份。
- device failure 返回空 success、包含唯一标识或 late result 更新已销毁页面。
- 用时间戳替代 RequestId 关联，或让异步任务自动继承输入 ID。
- 为通过当前实现删除公共合同断言、增加私有 marker/消息。

## 8. 最终证据

1. 四个 Source inventory/provenance/usage/scenario 和只读校验结果。
2. Toolkit 对每个 Fixture 的 build/inspect/Golden 与 Artifact SHA-256。
3. 三平台可见结果、Render/Mount operation、ID 前后快照和 typed Capability result。
4. Event RequestId/HandlerId/transactionId 因果图，不使用时间邻近推断。
5. Block/device 销毁前后资源计数与 late message 结果。

所有正例、失败分支、清理和跨平台断言同时成立，EX-S02 才能最终标记通过。
