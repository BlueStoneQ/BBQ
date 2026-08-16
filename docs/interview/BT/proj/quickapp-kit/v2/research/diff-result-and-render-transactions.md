# Diff 结果与渲染事务

## 目录

- [1. 结论](#1-结论)
- [2. 概念边界](#2-概念边界)
- [3. QuickApp Kit 管线](#3-quickapp-kit-管线)
- [4. 最小示例](#4-最小示例)

## 1. 结论

**Diff 的结果是一组变化指令，不是一棵树。**

```text
Diff(旧树, 新树) -> Mutation List
```

树表示某个时刻的完整状态；Diff 是比较过程；Mutation List 是把旧状态变成新状态所需的操作集合。

## 2. 概念边界

| 概念 | 形态 | 本质 |
|---|---|---|
| 旧树 / 新树 | `Tree Revision` | Diff 的输入，分别表示更新前后的完整状态 |
| Diff / Reconcile | 计算过程 | 找出两个 Revision 之间的真实变化 |
| Diff Result | `Mutation List` | Diff 产生的结构化变化指令 |
| `RenderTransaction` | JS -> C++ | 同一轮 JS 更新产生的 Render Intent 集合 |
| `MountTransaction` | C++ -> Platform | C++ 根据新旧树差异生成的平台操作集合 |

## 3. QuickApp Kit 管线

```text
JS Framework
  -> RenderTransaction
  -> C++ Core 应用渲染意图
  -> 生成新的 Runtime Tree Revision
  -> Diff(旧 Revision, 新 Revision)
  -> MountMutation List
  -> MountTransaction
  -> Platform Backend
```

统一术语：

- `RenderTransaction`：应用希望界面如何变化。
- `Runtime Tree Revision`：C++ Core 应用意图后形成的完整状态。
- `Diff/Reconcile`：比较新旧 Revision 的过程。
- `MountTransaction`：Platform 必须执行的变化指令集合。

## 4. 最小示例

```text
旧树                       新树
View(1)                    View(1)
└── Text(2, "A")           ├── Text(2, "B")
                           └── Image(3)
```

Diff 结果：

```text
UpdateProps(nodeId=2, { text: "B" })
CreateNode(nodeId=3, type=Image, props={...})
InsertNode(parentId=1, nodeId=3, index=1)
```

最终原则：

> 树表示状态，Diff 表示计算，指令集合表示计算结果。
