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

### 输入与输出

```
输入：
  - current Fiber 树（当前屏幕上显示的）
  - 新的 JSX（本次 render 返回的虚拟 DOM）

输出：
  - workInProgress Fiber 树上每个节点的 flags（副作用标记）
    - Placement（新增/移动）
    - Update（属性变了）
    - Deletion（要删除）

后续：Commit 阶段根据 flags 一次性操作真实 DOM
```

**一句话**：Diff 的本质是对比"旧 Fiber 树"和"新 JSX"，算出最小变更集（哪些节点要增/删/改/移），标记在 Fiber 节点上，最后统一提交到真实 DOM。

### flags 不是指令队列，是节点上的标记

```
不是：[指令1: 删除A, 指令2: 更新B, 指令3: 插入C]  ← 不是队列

而是：Fiber 树上每个节点自带标记
      FiberA.flags = Deletion
      FiberB.flags = Update
      FiberC.flags = Placement
```

Commit 阶段遍历 Fiber 树，看到有 flags 的节点就执行对应 DOM 操作。`subtreeFlags` 冒泡优化——子树内没有任何 flags 就直接跳过。

### Diff 后的动作（flags 类型 → 真实 DOM 操作）

| flags | 含义 | Commit 阶段做什么 |
|-------|------|------------------|
| **Placement** | 新增或移动 | `parentNode.appendChild(dom)` 或 `insertBefore` |
| **Update** | 属性/文本变了 | `dom.setAttribute()`、`dom.textContent = `、更新 style |
| **Deletion** | 要删除 | `parentNode.removeChild(dom)` + 执行 cleanup（useEffect 返回函数） |
| **ChildDeletion** | 子节点要删除 | 递归删除子树 |

### Commit 阶段本质做了什么

```
遍历 Fiber 树（有 subtreeFlags 的才进入）：

1. Before Mutation 阶段
   - getSnapshotBeforeUpdate（类组件）
   - useLayoutEffect 的清理函数

2. Mutation 阶段（真正操作 DOM）
   - Deletion → removeChild
   - Placement → appendChild / insertBefore
   - Update → 更新属性/文本

3. Layout 阶段
   - useLayoutEffect 执行
   - componentDidMount / componentDidUpdate
   - ref 赋值（ref.current = dom）

4. 异步调度
   - useEffect 放入微任务队列，浏览器绘制后执行
```

**本质**：Render 阶段（Diff）只做计算和标记，不碰 DOM；Commit 阶段一次性把所有标记转化为真实 DOM 操作，保证 UI 一致性。

---

## Renderer 可替换架构

React 架构分三层，Renderer 是纯管道式可替换的（非侵入式）：

```
┌─────────────────────────────┐
│  Reconciler（协调器）         │  ← 通用：Fiber、Diff、调度
│  Render 阶段：计算变更        │     React 和 RN 共用同一套
├─────────────────────────────┤
│  Renderer（渲染器）           │  ← 可替换：不同平台不同实现
│  Commit 阶段：执行变更        │     通过 HostConfig 接口对接
├─────────────────────────────┤
│  宿主环境                    │
└─────────────────────────────┘
```

**是管道式的，不是侵入式的。** Reconciler 通过一套 `HostConfig` 接口调用 Renderer，Renderer 只需实现这套接口：

```typescript
// HostConfig 接口（Renderer 需要实现的）
interface HostConfig {
  createInstance(type, props)        // 创建节点
  appendChild(parent, child)         // 插入子节点
  removeChild(parent, child)         // 删除子节点
  commitUpdate(instance, newProps)   // 更新属性
  // ...
}
```

| 平台 | Renderer 实现 | HostConfig 里调什么 |
|------|--------------|-------------------|
| Web | react-dom | `document.createElement`、`appendChild` |
| RN (Fabric) | react-native-renderer | JSI → C++ Shadow Tree → Native View |
| 测试 | react-test-renderer | 生成 JS 对象树（不操作任何 UI） |
| Canvas | react-three-fiber | Three.js API |

**管道式的意义**：Reconciler 完全不知道最终渲染到哪里，它只产出 flags 标记。Renderer 拿到标记后按自己的方式操作宿主环境。新增一个平台只需实现 HostConfig，不用改 React 核心代码。

---

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
