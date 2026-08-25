# M1 执行看板

> 当前执行优先遵循 [`M1-FAST-TRACK-GUIDE.md`](./M1-FAST-TRACK-GUIDE.md)。原有完整验收保留为 M1-Hardening 目标；与本文件逐切片暂停规则冲突时，以 Fast Track 指导为准。

## 目录

- [1. 结论](#1-结论)
- [2. 当前状态](#2-当前状态)
- [3. 执行顺序](#3-执行顺序)
- [4. Agent 组织](#4-agent-组织)
- [5. 统一通信](#5-统一通信)

## 1. 结论

M1 采用垂直切片快速验证，不按项目批量完成后再联调，也不同时启动多个会修改同一主链的 Agent。

```text
Alpha S1 通过
-> S2 事件与路由
-> S3.5 增量更新
-> S4 返回与页面栈
-> S5 失败恢复、线程边界与销毁
-> Spine 架构检查点
-> S3 Capability
-> M1-Hardening
-> M1 通过
```

S2-S5 由同一个长期 M1 集成 Agent 连续负责。Spine 阶段在每个切片后追加简洁交接，但只在 S3.5 和 S5 两个架构检查点暂停。

## 2. 当前状态

| 项目 | 状态 | 说明 |
|---|---|---|
| M1-Alpha S1 | `VERIFIED` | 真实 Case 001 RPK -> JS -> Core -> LVGL/SDL 首屏可见，资源归零 |
| M1-S2 | `VERIFIED` | Spine：真实输入、事件、Handler、路由 Push、Detail 可见、资源归零 |
| M1-S3.5 | `VERIFIED` | State -> Binding -> RenderTransaction -> Mount，BINDING-001 通过 |
| M1-S4 | `VERIFIED` | Platform Back -> Core Navigation Close -> 前页恢复 |
| M1-S5 | `VERIFIED` | 失败恢复、跨线程边界、完整销毁和资源归零 |
| M1-S3 | `CODE_ALLOWED` | typed Capability、Platform Provider、Toast；Spine 后执行 |
| M1 | `IN_PROGRESS` | M1-Spine 已通过，剩余 Capability 与 Hardening |

Alpha 的最终证据见 `../m1-alpha/INTEGRATION-HANDOFF.md`；该文件是历史交接与 S1 事实来源，本目录负责后续 M1 执行。

## 3. 执行顺序

| 切片 | 目标 | 主要项目 | 放行条件 |
|---|---|---|---|
| S2 | Click -> Event -> JS Handler -> Core Navigation -> Detail 可见 | Examples、LVGL、Core、JS | Case 001 Detail Surface 可见，事件和路由 Trace 完整 |
| S3.5 | State update -> dirty binding -> RenderTransaction -> Core commit -> Mount | Examples、JS、Core、LVGL | `BINDING-001` 单 Binding 增量更新成立，唯一 Runtime Tree，未全量重建 |
| S4 | Platform Back -> Core Navigation Close -> Detail destroy -> Demo reveal | Examples、LVGL、Core、JS | 页面栈、生命周期和 Host 映射一致 |
| S5 | 最小线程、一个失败、Runtime teardown | Examples、JS、Core、LVGL | 权威状态不污染，资源和计数回到基线 |
| S3 | Click -> typed Capability -> Platform Provider -> Toast/result | Examples、LVGL、Core、JS | Spine 后：Toast 正确、只发生一次、路由栈不变 |

`S3.5` 是 M1 的增量更新执行切片，不改变 Case 001 的 S1-S5 场景编号，也不新增产品里程碑。

S2-S5 都使用 Toolkit 生成的真实 Runtime Artifact。Focused fixture 只能补充负例，不能替代 Case 001 主链。

## 4. Agent 组织

- Alpha Agent 已完成 S1；优先直接将其延续为长期 M1 集成 Agent，保留真实主链上下文。
- S2、S3.5、S4、S5 已完成并通过对应检查点；当前启动 M1-S3 Capability。
- 当前 M1-Spine 已通过；S3 Capability 完成后进入 M1 Hardening，不重复修改已验证的主链。
- 每完成一个切片，M1 Agent 在共享 Handoff 追加主链、focused tests、资源和遗留项。
- S2 后直接进入 S3.5；S3.5 和 S5 完成后暂停等待总架构检查点；S3 在 Spine 后执行。
- M1 Agent 不得修改公共合同；发现合同缺口必须记录 `[待决策]` 并暂停受影响部分。

## 5. 统一通信

唯一 M1 集成 Agent 只追加：

```text
v3/m1/M1-HANDOFF.md
```

Spine 每次追加不超过 20 行，只包含：

```text
切片与状态
端到端命令与结果
focused/依赖锥测试
资源结果
阻塞或 [HARDENING] 遗留项
```

状态只使用：`IN_PROGRESS`、`READY_FOR_REVIEW`、`VERIFIED`、`BLOCKED`。
