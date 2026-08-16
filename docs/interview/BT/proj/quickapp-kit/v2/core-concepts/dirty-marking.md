# Dirty 标记：从状态变化到最小重算范围

## 目录

- [1. 结论](#1-结论)
- [2. 第一性问题](#2-第一性问题)
- [3. Dirty 的本质](#3-dirty-的本质)
- [4. Dirty、Render、Reconcile 与 Diff](#4-dirtyrenderreconcile-与-diff)
- [5. 所属层与执行线程](#5-所属层与执行线程)
- [6. 基本流程](#6-基本流程)
- [7. 标记粒度](#7-标记粒度)
- [8. V1 决策](#8-v1-决策)
- [9. 风险与约束](#9-风险与约束)
- [10. 重点吸收点](#10-重点吸收点)

## 1. 结论

Dirty 是对“可能受某次状态变化影响、需要重新计算”的组件、绑定或子树所做的候选标记。

```text
Dirty = 可能变化，需要重算
Diff  = 比较重算结果，确认真实变化
```

Dirty 不是 Diff，也不是平台渲染指令。它的价值是缩小重算范围，避免每次状态更新都重新执行整个页面。

QuickApp Kit v2 的 V1 采用 Page/Component 级 Dirty。JS Framework 在 Runtime Thread 中维护业务状态、依赖关系和 Dirty 集合；C++ Core 不管理业务 Dirty，它接收 JS 生成的渲染输入并负责平台无关的 Reconcile、Shadow Tree、Layout 与 Commit。

## 2. 第一性问题

声明式 UI 的输入是状态，输出是界面：

```text
UI = Render(State)
```

状态发生变化后，最直接的方法是重新计算整个应用：

```text
任意状态变化 -> 全应用 Render -> 全树比较
```

这种方法语义正确，但浪费计算。真正需要解决的问题是：

> 一次状态变化最小可能影响哪些计算单元？

Dirty 机制先找出候选重算范围，再由后续 Render 和 Reconcile/Diff 判断结果是否真的改变。

## 3. Dirty 的本质

Dirty 是依赖失效标记，不是变化事实。

例如状态 `count` 同时影响文本和样式：

```text
TextBinding  = String(count)
ClassBinding = count > 0 ? "active" : "inactive"
```

当 `count` 从 `1` 变为 `2`：

```text
TextBinding  -> Dirty -> "1" 变为 "2"       -> 有真实变化
ClassBinding -> Dirty -> "active" 仍为 "active" -> 无真实变化
```

Dirty 只说明两个绑定都必须重新计算，不能提前断言两者都会产生 UI 更新。

## 4. Dirty、Render、Reconcile 与 Diff

| 概念 | 回答的问题 | 结果 |
|---|---|---|
| State Change | 哪些业务数据被修改 | 新业务状态 |
| Dirty Mark | 哪些计算单元可能受影响 | Dirty 候选集合 |
| Render | 当前状态期望生成什么 UI | RenderElement / 子树描述 |
| Reconcile | 新旧元素是否代表同一个节点 | 节点复用、创建、删除、移动关系 |
| Diff | 对应节点具体改变了什么 | ChangeSet / Mutations |
| Commit | 是否接受本次完整计算结果 | 新 Shadow revision |
| Mount | 如何更新真实平台控件 | Host Tree 更新 |

统一记忆：

```text
Dirty 是候选集，Diff 是真实变化集。
Reconcile 决定“是不是原来的节点”，Diff 决定“节点变了什么”。
```

工程实现中 Reconcile 和 Diff 可以在同一次遍历中完成，但文档和接口必须保留语义区分。

## 5. 所属层与执行线程

| 层.部件/线程 | 职责 |
|---|---|
| `JS层.State/Runtime Thread` | 保存 App、Page、Component 业务状态 |
| `JS层.Dependency Tracker/Runtime Thread` | 记录状态与组件或绑定的依赖关系 |
| `JS层.Dirty Scheduler/Runtime Thread` | 合并 Dirty 标记并安排一次 Render |
| `JS层.Renderer/Runtime Thread` | 重新执行 Dirty 组件，生成渲染输入 |
| `C++层.Reconciler/Runtime Thread` | 匹配新渲染输入和 Current Shadow Tree |
| `C++层.Commit/Runtime Thread` | 生成新 revision 和 MountTransaction |
| `Platform层.Render Backend/UI Thread` | 执行 MountTransaction，更新 Host Tree |

线程是执行载体，层是职责边界。V1 中 JS Framework 和 C++ Core 可以顺序运行在同一条 Runtime Thread 上。

## 6. 基本流程

```text
JS State 更新
    -> Dependency Tracker 查找受影响组件
    -> Dirty Scheduler 去重并合并 Dirty 组件
    -> 在当前 tick 末尾执行一次批量 Render
    -> 生成 RenderElement Tree / Dirty Subtree
    -> C++ Reconciler 计算节点复用和真实差异
    -> Shadow Tree Layout / Commit
    -> MountTransaction
    -> Platform UI Thread Mount
```

同一 tick 内连续更新同一组件时，应合并为一次 Render：

```text
setState A
setState B
setState C
    -> Component X 只进入 Dirty Set 一次
    -> 使用最终状态执行一次 Render
```

## 7. 标记粒度

| 粒度 | 优点 | 缺点 | 适用阶段 |
|---|---|---|---|
| App | 实现最简单 | 重算范围最大 | 原型验证 |
| Page | 边界清楚 | 大页面成本较高 | V1 兜底 |
| Component | 性能与复杂度平衡 | 需要组件实例和依赖记录 | V1 主路径 |
| Binding | 重算最精细 | 依赖图和更新语义复杂 | 后续优化 |
| Subtree | 降低 JS 到 C++ 输入量 | 需要稳定子树锚点和版本校验 | 后续优化 |

Dirty 粒度越细，调度和依赖维护成本越高。粒度不是越细越先进，应由 Benchmark 证明收益。

## 8. V1 决策

**关键决策 CC-DIRTY-01：V1 支持 Page/Component 级 Dirty，不以 Binding 级依赖图作为首期前置条件。**

**关键决策 CC-DIRTY-02：Dirty 属于 JS Framework 的响应式调度，不进入 Platform Render Backend。**

**关键决策 CC-DIRTY-03：同一 Runtime tick 内重复 Dirty 标记必须去重和批量执行。**

**关键决策 CC-DIRTY-04：Dirty 只决定重算范围，不直接生成平台 Mutation；真实变化由 C++ Core 的渲染管线确认。**

建议的最小抽象：

```text
ComponentInstanceId -> DependencySet
DirtySet<ComponentInstanceId>
ScheduleRender(ComponentInstanceId)
FlushDirtyComponents()
```

## 9. 风险与约束

1. 依赖漏记会导致应更新的 UI 不刷新，必须提供 Page 级强制重算兜底。
2. Render 过程中再次更新状态时，不能递归无限刷新，应进入下一轮调度或受最大迭代次数保护。
3. 已销毁 Page/Component 的 Dirty 任务必须在执行前丢弃。
4. Dirty 组件生成的结果必须携带 Surface、组件身份和基准 revision，避免过期结果提交。
5. Dirty 优化必须通过 Render 次数、重算节点数和耗时指标验证，不能只凭实现复杂度判断价值。

## 10. 重点吸收点

> Dirty 的第一性价值不是“找出变化”，而是“用低成本找出值得重新计算的候选范围”。

重点区分三件事：

```text
JS Dirty：谁可能需要重新计算
C++ Reconcile/Diff：界面实际上如何变化
Platform Mount：把确定的变化执行到真实控件
```
