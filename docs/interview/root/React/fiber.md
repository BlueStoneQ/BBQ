# Fiber 架构与调度

## 目录

- [Fiber 是什么](#fiber-是什么)
- [为什么需要 Fiber](#为什么需要-fiber)
- [Fiber 节点结构](#fiber-节点结构)
- [双缓冲（Double Buffering）](#双缓冲double-buffering)
- [调度机制](#调度机制)
- [渲染两阶段](#渲染两阶段)
- [优先级](#优先级)

---

## Fiber 是什么

**一句话**：Fiber 是 React 的工作单元数据结构，每个组件对应一个 Fiber 节点，组成一棵 Fiber 树。

```
旧架构（Stack Reconciler）：递归遍历组件树，不可中断
新架构（Fiber Reconciler）：链表遍历，可中断、可恢复、可设优先级
```

**类比**：
- Stack = 一口气读完一本书（中间不能停）
- Fiber = 按章节读，每章读完可以停下来处理更紧急的事，再回来继续

---

## 为什么需要 Fiber

**问题**：旧架构递归渲染时，JS 主线程被占满（同步执行），无法响应用户输入、动画等高优任务。

```
旧架构：
  [====== 递归渲染 100 个组件 ======]  ← 50ms 主线程被占满
  用户点击 → 等着... → 卡顿

Fiber：
  [== 渲染 10 个 ==][处理点击][== 渲染 10 个 ==][动画帧][== 继续 ==]
  ← 每个时间片 ~5ms，中间让出主线程
```

**核心能力**：
1. **可中断**：渲染到一半可以暂停
2. **可恢复**：暂停后可以从断点继续
3. **可丢弃**：高优任务来了，低优任务可以丢弃重做
4. **有优先级**：用户输入 > 动画 > 数据请求 > 离屏渲染

---

## Fiber 节点结构

```typescript
interface FiberNode {
  // 组件信息
  type: ComponentType;       // 组件类型（函数/类/原生标签）
  key: string | null;
  props: any;

  // 树结构（链表，不是递归树）
  return: Fiber | null;      // 父节点
  child: Fiber | null;       // 第一个子节点
  sibling: Fiber | null;     // 下一个兄弟节点

  // 状态
  memoizedState: any;        // Hooks 链表（函数组件）/ state（类组件）
  memoizedProps: any;

  // 副作用
  flags: Flags;              // 标记：需要插入/更新/删除
  subtreeFlags: Flags;       // 子树中有副作用的标记（冒泡优化）

  // 双缓冲
  alternate: Fiber | null;   // 指向另一棵树中对应的节点
}
```

**为什么用链表不用树？** 链表可以用 while 循环遍历（可中断），树只能用递归（不可中断）。

### 时间切片的本质

**解决什么问题？** React 需要 diff 整棵组件树（可能 1000+ 节点），如果一口气跑完会阻塞主线程 → 用户交互无响应 → 卡顿。

**本质：把 reconciliation（diff）这个纯计算过程，拆成多个宏任务，分散注册到一轮轮的 event loop 中执行。**

```
时间切片 = break workLoop + MessageChannel 注册下一轮宏任务

时间线：
  宏任务1: workLoop() 处理 fiber 1~10 → 时间到 → break → return
  ── 浏览器：处理用户输入、跑动画、layout、paint ──
  宏任务2: workLoop() 继续处理 fiber 11~20 → 时间到 → break → return
  ── 浏览器：处理用户输入、跑动画、layout、paint ──
  宏任务3: workLoop() 处理 fiber 21~30 → 全部完成 → 进入 commit
```

**"让出线程"怎么实现？没有黑魔法，就是函数 return 了：**

```js
// React Scheduler 核心逻辑（伪代码）
function workLoop() {
  while (有下一个 fiber 要处理) {
    处理当前 fiber（执行组件函数、diff children）;

    if (当前时间切片用完了) {  // performance.now() 检查是否超过 5ms
      break;  // ← 就这么简单，break 出去
    }
  }

  if (还有剩余工作) {
    port.postMessage(null);  // ← 用 MessageChannel 安排下一个宏任务
  }
}

// MessageChannel 回调（下一轮宏任务触发）
channel.port1.onmessage = () => {
  workLoop();  // 继续从上次 break 的位置干活
};
```

**为什么 break 了还能继续？** 因为 Fiber 是链表，"当前处理到哪个节点"保存在变量里（`workInProgress`），break 只是暂停循环，下次进来从这个变量继续。递归做不到这一点——调用栈是引擎管的，你没法"暂停一半的递归"。

**为什么用 MessageChannel 不用 setTimeout / requestIdleCallback？**
- `setTimeout(fn, 0)` — 最少延迟 4ms，太慢
- `requestIdleCallback` — 触发不稳定，低优先级，一帧可能不触发
- `MessageChannel` — 宏任务，事件处理完后尽快执行，延迟最小

**注意：只有 reconciliation 可切片，commit 不切片：**

```
Reconciliation（可切片，纯计算，不操作 DOM）：
  多个宏任务分批完成 diff

Commit（不可切片，同步执行）：
  一口气把所有 mutation 提交到 DOM
  原因：DOM 操作必须原子化，不能"改了一半"让用户看到撕裂的界面
```

遍历顺序：深度优先
```
      A
     / \
    B   C
   / \
  D   E

遍历：A → B → D → E → C（child → child → sibling → return → sibling）
```

---

## 双缓冲（Double Buffering）

React 同时维护两棵 Fiber 树：

```
current 树（当前屏幕上显示的）
workInProgress 树（正在构建的新树）

渲染完成后：workInProgress 变成 current（指针切换，O(1)）
```

**为什么？** 构建新树的过程中如果出错或被中断，current 树不受影响，屏幕不会闪烁。类似显卡的双缓冲——后台画好再一次性切换。

---

## 调度机制

### Scheduler（调度器）

React 自己实现了一个调度器（不用 requestIdleCallback，因为兼容性和精度不够）。

```
核心 API：
  scheduleCallback(priority, callback)  → 按优先级排队
  shouldYield()                         → 当前时间片用完了吗？

工作循环：
  while (有工作 && !shouldYield()) {
    执行一个 Fiber 节点的工作
  }
  if (还有工作) {
    用 MessageChannel 调度下一个时间片
  }
```

### 时间片（Time Slice）

每个时间片 ~5ms。在一个时间片内尽可能多处理 Fiber 节点，时间到了就让出主线程。

```
一帧 16.6ms（60fps）：
  [浏览器任务 + React 时间片 5ms + 浏览器绘制]
  [浏览器任务 + React 时间片 5ms + 浏览器绘制]
  ...
```

---

## 渲染两阶段

### Render 阶段（可中断）

- 遍历 Fiber 树，对比新旧 props/state
- 标记需要变更的节点（flags）
- **纯计算，不操作 DOM**
- 可以被高优任务打断

### Commit 阶段（不可中断）

- 一次性把所有变更应用到真实 DOM
- 执行 useLayoutEffect
- **同步执行，不可中断**（保证 DOM 一致性）

```
Render 阶段：[计算 Diff]...[可中断]...[计算完成]
                                          │
Commit 阶段：                             ▼ [一次性更新 DOM]（同步）
```

---

## 优先级

React 18 的 Lane 模型（取代旧的 expirationTime）：

| 优先级 | 场景 | Lane |
|--------|------|------|
| 同步（最高） | useLayoutEffect、flushSync | SyncLane |
| 用户输入 | 点击、键盘 | InputContinuousLane |
| 普通 | setState | DefaultLane |
| Transition | useTransition / startTransition | TransitionLane |
| 空闲（最低） | offscreen、预渲染 | IdleLane |

**高优打断低优**：用户正在输入时，后台数据更新（Transition）会被暂停，等输入处理完再继续。

```tsx
// 标记为低优先级
startTransition(() => {
  setSearchResults(filterHugeList(query));  // 可被用户输入打断
});
```
