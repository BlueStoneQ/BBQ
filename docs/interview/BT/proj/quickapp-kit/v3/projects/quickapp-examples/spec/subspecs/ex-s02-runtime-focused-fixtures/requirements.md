# EX-S02 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 通用需求](#3-通用需求)
- [4. Case 002 需求](#4-case-002-需求)
- [5. BLOCK-001 需求](#5-block-001-需求)
- [6. CAP-DEVICE-001 需求](#6-cap-device-001-需求)
- [7. EVENT-REQUEST-001 需求](#7-event-request-001-需求)
- [8. 质量需求](#8-质量需求)
- [9. 非目标](#9-非目标)

## 1. 结论

每个 Fixture 必须以最少业务语义产生唯一、可观察的 Runtime 机制证据；不能用一个复杂样例同时声称覆盖多个未发生的行为。

## 2. 输入与输出

输入是联盟 DSL 源码及 EX-S02 引用的公共合同；输出是 Fixture identity、provenance、操作步骤、可见结果与结构化断言。Examples 不输出 Runtime Artifact 或运行结果。

## 3. 通用需求

| ID | 需求 |
|---|---|
| EX-S02-R01 | 每个 Fixture 必须有独立 ID/version、源码目录、Manifest package/entry、Source snapshot 和 provenance。 |
| EX-S02-R02 | 三平台必须使用同一 Fixture 源码和同一个 QuickApp Kit Runtime Artifact，不允许平台分叉源码。 |
| EX-S02-R03 | 正常操作使用 route、语义角色、稳定 key 和可见文本定位，不使用坐标、NodeId 或 NativeHandle 驱动；在途消息故障注入必须明确标记为 Runtime 合同测试。 |
| EX-S02-R04 | 期望必须区分 JS state、Render operation、Core Runtime identity、Mount operation 和 Platform Host identity。 |
| EX-S02-R05 | 截图只证明可见结果；ID 复用、因果关联与资源清理必须由结构化 Trace/快照证明。 |
| EX-S02-R06 | Fixture 不定义 Toolkit 或 Runtime 内部实现，不新增公共消息、ID、marker 或错误。 |
| EX-S02-R07 | 源码变更必须提升 Fixture version、重算 identity 并重跑受影响 Toolkit/Runtime/Benchmark 证据。 |

## 4. Case 002 需求

| ID | 需求 |
|---|---|
| EX-S02-R08 | 初始页面必须显示 count `0`、conditional 文本 `条件节点` 和 keyed 顺序 `[A,B]`。 |
| EX-S02-R09 | 点击 `更新状态` 一次必须在同一 Handler 中同步执行 count `0 -> 1`、visible `true -> false`、items `[A,B] -> [B,A]`。 |
| EX-S02-R10 | 同一轮写入必须在一个 microtask checkpoint 合并为一个 RenderTransaction；不得重建完整静态页面树。 |
| EX-S02-R11 | Render 语义必须包含 count `UpdateBinding`、conditional `RemoveBlock` 和 keyed `MoveBlock`；A/B 不得 Remove+Instantiate。 |
| EX-S02-R12 | A/B 的 BlockInstanceId、Runtime NodeId、HandlerId（若存在）和 NativeHandle 在 reorder 前后保持；最终可见顺序为 `[B,A]`。 |
| EX-S02-R13 | `RenderTransaction.requestId` 是可选字段；本次 Handler 返回前的同步状态 flush 产生的事务必须携带触发输入的 RequestId，并关联 input、Handler、state/flush、Render 与对应 Trace。 |
| EX-S02-R14 | Case 002 不声称覆盖 keyed add/remove；该职责只属于 BLOCK-001。 |

## 5. BLOCK-001 需求

| ID | 需求 |
|---|---|
| EX-S02-R15 | 初始 keyed 列表为 `[A,B]`，每项至少包含可见 key/label 和一条 item-scope click Handler。 |
| EX-S02-R16 | `add C` 必须产生 C 的 `InstantiateBlock`，A/B 全部 Runtime/Host identity 保持。 |
| EX-S02-R17 | `remove B` 必须产生 B 的 `RemoveBlock`；Core 先删除 B 内 EventBinding 再递归删除 Runtime Node，Platform 从 Block root 递归清理 Host 与 NativeHandle。 |
| EX-S02-R18 | B 删除提交后，旧 Handler 不可路由、旧 NodeId 不存在、旧 NativeHandle 无映射；A/C 保持原 identity。 |
| EX-S02-R19 | `re-add B` 必须分配新的 BlockInstanceId、HandlerId、NodeId 和 NativeHandle；同一 Surface 内不得复用旧 B 身份。 |
| EX-S02-R20 | 删除事务 rejected/cancelled 时 Handler `retiring -> live`；presented/presentationFailed 时 `retiring -> released`，与公共合同一致。 |

## 6. CAP-DEVICE-001 需求

| ID | 需求 |
|---|---|
| EX-S02-R21 | 独立 Manifest 必须声明 `system.device`，独立页面显式调用 `getInfo`；不得修改 Case 001。 |
| EX-S02-R22 | success 必须显示并记录全部 required fields；字段类型、正值和物理像素/density 与逻辑 viewport 关系成立。 |
| EX-S02-R23 | 返回结果不得包含设备唯一标识或 Schema 外字段；optional 字段缺失不得导致失败。 |
| EX-S02-R24 | `system.device` 已通过组成预检但 `getInfo` 方法未注册时返回 `CAPABILITY_UNSUPPORTED`；Provider 构造或执行失败返回 `CAPABILITY_FAILED`；不得伪造 success。 |
| EX-S02-R25 | Surface 在执行前销毁返回 `SURFACE_NOT_FOUND`；AppRuntime 销毁取消在途调用、逆注册顺序销毁 Provider，late result 不更新 JS/UI。 |
| EX-S02-R26 | request/result 必须保持同一 requestId/surfaceId，并由 `capability.requested/completed/failed` 记录。 |

## 7. EVENT-REQUEST-001 需求

| ID | 需求 |
|---|---|
| EX-S02-R27 | Fixture 必须提供嵌套 parent/child click Handler，使一次 child click 同时产生 target 和 bubble dispatch。 |
| EX-S02-R28 | 两次连续 child click 必须得到不同且不复用的 RequestId；每次 click 内 target/bubble dispatch 共享该次 RequestId。 |
| EX-S02-R29 | target 固定为原始 child LogicalNodeRef，currentTarget 分别为 child/parent，phase 分别为 target/bubble；两个 EventBinding 使用不同 HandlerId。 |
| EX-S02-R30 | 单独的同步更新 click 在 Handler 返回前产生的 state、flush、Render 和 Trace 必须继承该输入 RequestId，`RenderTransaction.requestId` 必须等于该值。 |
| EX-S02-R31 | 普通非事件更新以及由 Promise/deferred continuation 在 Handler 返回后产生的更新，其 `RenderTransaction` 必须省略 `requestId`。 |
| EX-S02-R32 | 无同步状态更新的 click 不得伪造 state/render marker；事件关联禁止按时间戳或到达顺序猜测。 |

## 8. 质量需求

| 维度 | 要求 |
|---|---|
| 最小性 | 一个操作只引入证明目标机制必需的 state 和 UI。 |
| 确定性 | 初始 state、操作次数、最终顺序、错误注入和终点明确。 |
| 可追溯 | 事实、待创建输入、待验证运行证据明确分层。 |
| 资源性 | 删除/销毁必须证明对象和映射回落，不只证明不可见。 |
| 平台无关 | 不把 JNI、UIKit、LVGL 类型或平台时序写入输入语义。 |

## 9. 非目标

- 不验证动画、无 key 列表、capture/default action/gesture。
- 不定义 device 权限 Guard、唯一标识、网络或账号。
- 不覆盖 Profile 缺失和 Artifact 非法负例。
- 不要求三个平台像素完全一致或性能数值一致。
