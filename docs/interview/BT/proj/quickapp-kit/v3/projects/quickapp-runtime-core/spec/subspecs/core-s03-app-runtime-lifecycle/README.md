# CORE-S03 AppRuntime 与 Lifecycle

## 目录

- [1. 结论](#1-结论)
- [2. 责任](#2-责任)
- [3. 输入与输出](#3-输入与输出)
- [4. 依赖与边界](#4-依赖与边界)
- [5. 交付物](#5-交付物)
- [6. 当前状态](#6-当前状态)

## 1. 结论

CORE-S03 建立每个 `AppRuntimeId` 唯一的 `AppRuntimeController`：它拥有 App 级状态和资源，按 typed Result 串行推进模块加载、VM 初始化、前后台与销毁，并且从不通过超时猜测执行结果。

## 2. 责任

- 冻结 AppRuntime、App VM 与 Lifecycle control 的唯一状态机。
- 冻结 `AppContext` 的构造、不可变所有权和交付顺序。
- 串联 S02 verified app/shared/page Module 与 JS Runtime 的加载、初始化和 Hook 闭环。
- 把 Runtime Host control 转换为 Platform Surface control、Lifecycle dispatch 和 typed Host result。
- 管理 Request correlation、失败、停止、late result 与确定性 teardown。
- 为 S04 提供唯一 AppRuntime 状态和窄页面生命周期调度接口。

## 3. 输入与输出

| 方向 | typed 输入/输出 |
|---|---|
| Host -> Core | AppRuntime 创建参数、`RuntimeLifecycleControl` |
| S02 -> S03 | verified Package、immutable `VerifiedModule` |
| Core -> JS | `AppContext`、`LoadVerifiedModule`、`VmInitializationDispatch`、`LifecycleDispatch` |
| JS -> Core | `LoadVerifiedModuleResult`、`VmInitializationResult`、`LifecycleResult` |
| S04 <-> S03 | top Surface 查询、visibility/destroy 协调、Page VM 与 Page Hook 调度 |
| Core -> Host | `RuntimeLifecycleControlResult`、AppRuntime 创建终态 |

## 4. 依赖与边界

- 依赖 CORE-S01 的 Factory、强类型 ID、RequestId allocator、Port、队列、时钟、Trace 和 Counter。
- 依赖 CORE-S02 发布的 verified Package/Module；S03 不读 ZIP、JSON 或未经验证 bytes。
- S03 不拥有 Surface 状态、Navigation 栈、Runtime Tree、Render、Layout、Mount、Event 或 Capability。
- S03 不执行 JS，不持有 JS function，不同步等待 JS/Platform 线程。
- S04 只能读取 S03 的唯一 AppRuntime 状态；不得复制 AppRuntime 生命周期。

## 5. 交付物

- [requirements.md](./requirements.md)：可验证需求和边界。
- [design.md](./design.md)：状态机、所有权、顺序、失败与 teardown。
- [tasks.md](./tasks.md)：通过校审后才可执行的实现任务。
- [acceptance.md](./acceptance.md)：状态、故障、线程和资源验收。

## 6. 当前状态

`READY_FOR_REVIEW / CODE_BLOCKED`

本目录只完成设计；未获得 `PASS + CODE_ALLOWED` 前不得实现 CORE-S03。
