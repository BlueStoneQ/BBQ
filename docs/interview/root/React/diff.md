# 虚拟 DOM 与 Diff 算法

## 目录

- [虚拟 DOM 是什么](#虚拟-dom-是什么)
- [为什么需要虚拟 DOM](#为什么需要虚拟-dom)
- [Diff 算法](#diff-算法)
- [key 的作用](#key-的作用)

---

## 虚拟 DOM 是什么

**一句话**：用 JS 对象描述 DOM 结构，对比新旧对象找出差异，最小化真实 DOM 操作。

```tsx
// JSX
<div className="box">
  <span>hello</span>
</div>

// 虚拟 DOM（JS 对象）
{
  type: 'div',
  props: { className: 'box' },
  children: [
    { type: 'span', props: {}, children: ['hello'] }
  ]
}
```

---

## 为什么需要虚拟 DOM

**不是因为"操作 DOM 慢"**（单次 DOM 操作很快），而是：

1. **批量计算最小更新**：状态变了 → 生成新虚拟 DOM → Diff 找出最小差异 → 一次性更新真实 DOM
2. **跨平台**：虚拟 DOM 是抽象层，可以渲染到 DOM / Native（RN）/ Canvas
3. **声明式编程**：开发者描述"UI 应该是什么样"，框架负责"怎么从当前状态变过去"

---

## Diff 算法

React 的 Diff 基于三个假设（将 O(n³) 降为 O(n)）：

### 三个策略

| 策略 | 说明 |
|------|------|
| **同层比较** | 只比较同一层级的节点，不跨层移动 |
| **类型判断** | 类型不同直接销毁重建（`<div>` → `<span>` = 删旧建新） |
| **key 标识** | 同类型同层级的列表，用 key 识别哪些节点是同一个 |

### 单节点 Diff

```
旧：<div className="a" />
新：<div className="b" />
→ 类型相同（div），复用节点，只更新 className

旧：<div />
新：<span />
→ 类型不同，销毁 div 及其子树，创建 span
```

### 多节点 Diff（列表）

React 对列表 Diff 分两轮遍历：

**第一轮**：从左到右逐个对比（处理更新）
```
旧：A B C D
新：A B C D E
→ A B C D 都匹配，E 是新增 → 插入 E
```

**第二轮**：处理移动/删除/新增
```
旧：A B C D
新：A C D B
→ A 不动，C D 不动（相对顺序没变），B 移动到末尾
```

React 用 **lastPlacedIndex** 判断是否需要移动：如果旧节点的 index < lastPlacedIndex，说明它需要右移。

---

## key 的作用

**key 告诉 React "这个节点是谁"**，让 Diff 能正确识别列表中的节点。

### 没有 key / 用 index 做 key

```
旧：[A, B, C]  → key=[0, 1, 2]
新：[X, A, B, C]  → key=[0, 1, 2, 3]

React 认为：
  key=0: A → X（更新内容）
  key=1: B → A（更新内容）
  key=2: C → B（更新内容）
  key=3: 新增 C
→ 4 次更新（全错！实际只需要在头部插入 X）
```

### 用唯一 ID 做 key

```
旧：[A(id:1), B(id:2), C(id:3)]
新：[X(id:0), A(id:1), B(id:2), C(id:3)]

React 认为：
  id:1 A → 不变
  id:2 B → 不变
  id:3 C → 不变
  id:0 X → 新增，插入到头部
→ 1 次插入（正确！）
```

### 什么时候可以用 index

- 列表**永远不会**重排序、增删（纯静态展示）
- 列表项没有自己的状态（无 input、无动画）

其他情况一律用唯一 ID。
