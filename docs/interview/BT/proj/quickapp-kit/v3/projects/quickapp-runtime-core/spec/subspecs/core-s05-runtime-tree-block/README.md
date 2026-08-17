# CORE-S05 Runtime Tree / Block

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 边界](#3-边界)
- [4. 交付物](#4-交付物)
- [5. 状态](#5-状态)

## 1. 结论

CORE-S05 冻结每个 Surface 唯一的 C++ Runtime Tree：它是运行时结构和逻辑节点映射的唯一权威。JS 只提交增量意图，Host Tree 只是提交结果的副本，任何 staging 数据都只是单次事务内的临时变更集。

S05 只消费 CORE-S02 交付的 immutable `PageIrHandle`。它不读取 ZIP、JSON 或 Bundle，不执行 JS，不做完整 Tree Diff，也不负责 Layout、Mount 和事件分发。

## 2. 范围

本分 Spec 包含：

- `RuntimeTreeStore`、`RuntimeNode` 与 `LogicalNodeRef <-> NodeId` 索引。
- Page IR 静态实例化。
- Block 创建、移除、移动、key 稳定复用和 tombstone。
- Node、Block 与 Handler 的结构所有权。
- transient `TreeMutation` staging、原子 apply/rollback 基础。
- 单写者线程、资源限制、teardown 和 Fake Page IR。

本分 Spec 不包含：

- Package 读取、ZIP/JSON/Page IR 解析和 Bundle 加载。
- App/Surface 生命周期编排、事务调度、Binding 求值、Layout、Mount、事件分发和路由。
- 第二棵 Runtime Tree、全量新旧树 Diff。
- 平台或具体执行引擎类型。

## 3. 边界

```text
CORE-S02 PageIrHandle
  -> CORE-S05 RuntimeTreeStore + TreeMutation
       -> CORE-S06 staged render orchestration
       -> CORE-S08 authorized commit/mount coordination
       -> CORE-S09 handler dispatch index
```

- S05 拥有结构权威；S06 组织变更但不能另建树。
- S08 是 staged mutation 提交入口；S05 不发送 MountTransaction。
- S05 记录 Handler 结构所有权并产生 delta；S09 通过 S05 冻结的 commit-participant 接口独占可分发 EventBinding，S08 不依赖 S09 具体类型。

## 4. 交付物

| 文件 | 作用 |
|---|---|
| [requirements.md](./requirements.md) | 冻结唯一树、实例化和所有权需求 |
| [design.md](./design.md) | 冻结数据结构、staging、Block 和边界接口 |
| [tasks.md](./tasks.md) | 实现顺序与完成定义 |
| [acceptance.md](./acceptance.md) | 结构、回滚、线程和资源验收 |

## 5. 状态

`READY_FOR_REVIEW + CODE_BLOCKED`。必须通过独立分 Spec 校审并由工作看板显式放行后才能实现。
