# CORE-S03 实现任务

## 目录

- [1. 结论](#1-结论)
- [2. 前置门禁](#2-前置门禁)
- [3. 任务](#3-任务)
- [4. 完成定义](#4-完成定义)

## 1. 结论

实现必须先建立唯一 AppRuntime 状态和 correlation，再接 Module/VM/Hook/Host control；不得先用平台生命周期回调拼出流程。

## 2. 前置门禁

- CORE-S03 分 Spec 校审为 `PASS`，工作看板标记 `CODE_ALLOWED`。
- CORE-S01、CORE-S02 实现保持 `VERIFIED`。
- JS Module/Lifecycle Port 与公共 Schema 无未关闭冲突。
- CORE-S04 未实现时使用 Fake `SurfaceLifecycleCollaborator`。

## 3. 任务

| ID | 任务 | 依赖 | 主要证据 |
|---|---|---|---|
| CORE-S03-T01 | 建立模块目录、依赖扫描、limits 和 AppRuntime 状态枚举 | 门禁 | Core-only build/scan |
| CORE-S03-T02 | 实现 Factory -> AppRuntimeController 所有权与 AppContext 构造 | T01 | identity/context tests |
| CORE-S03-T03 | 实现 bounded correlation、operation epoch、Hook sequence 和 typed Result 校验 | T02 | duplicate/late tests |
| CORE-S03-T04 | 接入 S02 verified app/shared/page Module 交付 | T03 | module ordering tests |
| CORE-S03-T05 | 实现 App/Page VmInitialization 调度与失败闭环 | T04 | initialization tests |
| CORE-S03-T06 | 实现 Page lifecycle 内部服务和 Fake collaborator | T05 | S04-boundary tests |
| CORE-S03-T07 | 实现 foreground/background control 与 Hook sequencing | T06 | control state-machine tests |
| CORE-S03-T08 | 实现 destroy gate、整栈 collaborator 调用、强制 teardown 和 late result 丢弃 | T07 | teardown/failure tests |
| CORE-S03-T09 | 接入 Trace、Counter snapshot、Noop/Recording 等价 | T08 | observation tests |
| CORE-S03-T10 | 完成并发、OOM、overflow、乱序、重复和资源归零测试 | T09 | Release/sanitizer evidence |
| CORE-S03-T11 | 生成源码摘要与 requirement-test 证据，更新 Handoff | T10 | review package |

## 4. 完成定义

- [ ] AppRuntime 状态、App VM stage、control slot 和 correlation 各有唯一 owner。
- [ ] AppContext/module/init/hook 顺序与公共合同一致。
- [ ] foreground/background/destroy 的成功、失败和 Hook exception 均有确定结果。
- [ ] 无墙钟 timeout 分支；teardown 可以确定取消全部在途项。
- [ ] 重复、晚到、乱序和来源错误 Result 不能推进状态。
- [ ] S03 不包含 Surface/Navigation/Tree/Render/Layout/Mount/Event/Capability 实现。
- [ ] Release、ASan/UBSan、TSan、OOM、overflow、依赖扫描和资源归零通过。
