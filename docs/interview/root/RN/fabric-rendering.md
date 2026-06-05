# Fabric 渲染模型深度解析

## 目录

- [Fabric 是什么](#fabric-是什么)
- [React 渲染器对接原理（HostConfig）](#react-渲染器对接原理hostconfig)
- [新旧架构对比](#新旧架构对比)
- [JSI / Fabric / TurboModules 关系](#jsi--fabric--turbomodules-关系)
- [为什么有"两次 diff"](#为什么有两次-diff)
- [完整渲染流程](#完整渲染流程)
- [各阶段数据结构详解](#各阶段数据结构详解)

---

## Fabric 是什么

Fabric 是 **RN 的渲染引擎**（一套 C++ 系统），地位相当于浏览器中的 Blink/WebKit。

它不是单个对象或算法，而是一组 C++ 类 + 算法 + 平台对接层：

```
Fabric 渲染系统
  ├── Shadow Tree 管理（ShadowNode 树，C++ 不可变对象）
  ├── Yoga 布局引擎（flexbox → 绝对坐标）
  ├── Tree Diffing（对比新旧 Shadow Tree）
  ├── Mounting 层（mutation 提交到 Native View）
  └── 平台对接（iOS: UIView / Android: android.view.View）
```

核心 C++ 类：

| 类 | 职责 |
|---|---|
| `ShadowNode` | Shadow Tree 节点，持有 props + 布局结果 |
| `ComponentDescriptor` | 描述每种组件怎么创建/更新 |
| `MountingCoordinator` | 协调 diff → 生成 mutation 指令 |
| `Scheduler` | 调度更新，决定在哪个线程执行 |
| `UIManager`（新版） | 对 JS 暴露接口（通过 JSI） |

---

## React 渲染器对接原理（HostConfig）

**核心问题：React 内部不知道 Native 的存在，它怎么最终渲染到 Native View 的？**

React 架构是核心与渲染器分离的：

```
react（核心，平台无关）
  → Reconciler diff → 产出 effect list（创建/更新/删除指令）
  → commit 阶段调用 HostConfig 方法

渲染器（实现 HostConfig 接口）：
  react-dom       → 操作浏览器 DOM
  react-native    → 通过 JSI 操作 C++ Fabric → Native View
  react-three-fiber → 操作 Three.js 场景
```

**React 核心只认 HostConfig 这组 JS 函数**，不关心背后连的是什么：

```
React 核心视角：
  "我 diff 完了，要创建一个节点"
  → 调 hostConfig.createInstance('View', props)
  → 返回了一个 instance 对象
  → 完事了

实际发生的（React 不知道）：
  react-native 的 createInstance 实现里：
    → 通过 JSI 调了 C++ Fabric
    → Fabric 创建了 ShadowNode
    → 最终映射到 UIView / android.view.View
```

### HostConfig 接口（渲染器必须实现）

```ts
interface HostConfig {
  createInstance(type, props): Instance;       // 创建节点
  createTextInstance(text): TextInstance;      // 创建文本节点
  appendChild(parent, child): void;           // 插入子节点
  removeChild(parent, child): void;           // 删除子节点
  insertBefore(parent, child, before): void;  // 插入到指定位置
  commitUpdate(instance, oldProps, newProps): void;  // 更新属性
}
```

### 不同渲染器的实现

```
react-dom：
  createInstance('div', props)  → document.createElement('div')
  appendChild(parent, child)   → parent.appendChild(child)
  commitUpdate(el, ...)        → el.style.xxx = ...; el.setAttribute(...)

react-native（Fabric）：
  createInstance('View', props) → JSI → C++ ShadowNode::create()
  appendChild(parent, child)   → JSI → Shadow Tree 插入子节点
  commitUpdate(node, ...)      → JSI → 更新 ShadowNode props → 最终 commit 到 Native View
```

### 完整通信链路

```
react 核心  ←→  react-native（JS 层，实现 HostConfig）←→  JSI / C++ / Native
     ↑                        ↑                              ↑
  平台无关              "胶水层"渲染器                    真正干活的
  不碰 Native          负责对接两头                    Fabric + Native View
```

**关键认知**：React 和 Native 之间隔了 react-native 这个渲染器包。不是 React 直接和 Native 通信，和 react-dom 不直接操作 DOM 是同一个道理。

---

## 新旧架构对比

```
旧架构（Bridge）：
  JS diff → 攒一批 JSON 指令 → Bridge 异步 → UIManager 逐条执行
  特点：异步、有序列化开销、批量但延迟高

新架构（Fabric + JSI）：
  JS diff → JSI 直接操作 C++ Shadow Tree → Fabric diff 新旧 Tree
          → 生成最小化 mutation list → 一次性 commit 到 Native View
  特点：同步（JSI）、零序列化、C++ 层统一管理

关键区别：
  - 旧：JS 告诉 Native "创建 A、更新 B、删除 C"（指令式）
  - 新：JS 描述"最终状态应该长什么样"，C++ 层计算差异后批量提交（声明式）
```

---

## JSI / Fabric / TurboModules 关系

```
JSI = 底层通信接口（JS 直接调 C++，替代旧 Bridge 的 JSON 序列化）
  ├── Fabric = 新渲染系统（通过 JSI 操作 C++ Shadow Tree → Native View）
  └── TurboModules = 新原生模块系统（通过 JSI 调用 Native 功能）

JSI 是管道，Fabric 和 TurboModules 是建在管道上的系统。
```

---

## 为什么有"两次 diff"

React 在 JS 层和 Fabric 在 C++ 层各做了一次对比，职责不同：

| | React JS 层 | Fabric C++ 层 |
|---|---|---|
| 对比什么 | 组件树（Fiber Tree） | Shadow Tree（布局树） |
| 确定什么 | 哪些组件的 props/state 变了 | Native View 最终需要哪些最小化操作 |
| 涉及布局 | ❌（不知道布局结果） | ✅（Yoga 计算布局后才知道影响范围） |
| 输出 | "Text 内容从 A 变成 B" | "更新第 3 个 Native View 的 frame + text" |

**为什么不能只在 JS 层 diff 一次就直接操作 Native View？**

1. **布局计算在 C++ 层**（Yoga）— 一个节点 style 变了可能导致兄弟节点位置变化，JS 层不知道
2. **View Flattening** — React 组件树和 Native View 树不是一一对应的，Fabric 会优化掉中间层
3. **跨线程安全** — Shadow Tree 是 immutable 的，可以在不同线程安全对比

---

## 完整渲染流程

```
1. setState 触发更新
   （同一 tick 内多个 setState 被 React 18 automatic batching 合并为一次渲染）

2. React Reconciler（JS 线程）：
   Fiber Tree diff → 遍历完整棵树，收集所有变更节点（Effect 链表）
   → 一次性通过 JSI 提交给 C++ 层，构建新 Shadow Tree

3. Fabric Renderer（C++ 层）：
   → 克隆受影响的 Shadow Node，生成新 Shadow Tree（immutable）
   → Yoga 一次性重新计算布局（flexbox → 绝对坐标 + 尺寸）
   → 对比新旧 Shadow Tree → 生成一个 mutation list

4. Commit（UI 线程，一次性批量提交）：
   → 遍历 mutation list → 批量操作真实 Native View
   → 用户看到更新
```

**关键：全程是批量的，不是发现一个变更就 commit 一次**——React batching 保证一次渲染周期只产生一次 commit。

---

## 各阶段数据结构详解

> 场景：TaskList 中 TaskCard#1 标题变了，新增了 TaskCard#3。

### 阶段 1：React Reconciler — Effect 链表

React 在 Fiber 树上给有变化的节点打 flag，通过 effect 链表串联：

```
Fiber Tree：
  App (无变化)
   └── TaskList (无变化)
        ├── TaskCard#1 (flag: Update)   ──→ effect 链表节点 1
        ├── TaskCard#2 (无变化)
        └── TaskCard#3 (flag: Placement) ──→ effect 链表节点 2（新增）

Effect List（链表，不是数组）：
  TaskCard#1 (Update, newProps: {title: "新标题"})
  → TaskCard#3 (Placement, 新节点)
  → null
```

### 阶段 2：Shadow Tree — 不可变树（克隆路径 + 共享未变化节点）

```cpp
// Shadow Node 结构（伪代码）
struct ShadowNode {
  Tag tag;                      // 唯一 ID，对应 Native View
  string componentName;         // "View" | "Text" | "Image"
  Props props;                  // {style: {...}, title: "hello"}
  LayoutMetrics layout;         // Yoga 计算后填入：{x, y, width, height}
  vector<shared_ptr<ShadowNode>> children;
};

// 旧 Shadow Tree
Root → View#100 → [Card#101(title:"旧"), Card#102]

// 新 Shadow Tree（克隆变化路径，未变化的共享引用）
Root' → View#100' → [Card#101'(title:"新"), Card#102(共享), Card#103(新建)]
```

### 阶段 3：Yoga 布局 — 就地填充 layout 字段（不产生 list）

```
输入（每个 Shadow Node 的 style）：
  View#100: { flexDirection: 'column', padding: 16 }
    Card#101: { height: 60, marginBottom: 8 }
    Card#102: { height: 60, marginBottom: 8 }
    Card#103: { height: 60 }

输出（填入 layout 字段）：
  View#100: { x: 0,  y: 0,   width: 375, height: 220 }
  Card#101: { x: 16, y: 16,  width: 343, height: 60 }
  Card#102: { x: 16, y: 84,  width: 343, height: 60 }
  Card#103: { x: 16, y: 152, width: 343, height: 60 }
```

### 阶段 4：Fabric Tree Diff — 生成 Mutation List

```cpp
// Mutation 结构
struct Mutation {
  enum Type { Create, Delete, Insert, Remove, Update };
  Type type;
  Tag tag;           // 目标 Native View ID
  Tag parentTag;     // 父 View ID
  int index;         // 在父 View 中的位置
  Props newProps;
  LayoutMetrics layout;
};

// 本次产生的 Mutation List：
vector<Mutation> mutations = [
  { type: Update, tag: 101, newProps: {title: "新标题"}, layout: {x:16, y:16, w:343, h:60} },
  { type: Create, tag: 103, componentName: "View", props: {title: "新任务"}, layout: {x:16, y:152, w:343, h:60} },
  { type: Insert, tag: 103, parentTag: 100, index: 2 },
];
```

### 阶段 5：Commit — UI 线程遍历执行

```
Update(101) → nativeView101.setTitle("新标题")
Create(103) → new NativeView(props, layout)
Insert(103, parent:100, index:2) → parentView.insertSubview(view103, at: 2)
→ 一帧完成
```

### 总结表

| 阶段 | 数据结构 | 说明 |
|---|---|---|
| React Reconciler | Effect 链表（Fiber 上的 flag + 指针） | 哪些组件变了 |
| Shadow Tree | 不可变树（shared_ptr 共享未变化节点） | UI 树完整描述 |
| Yoga | 就地填充 LayoutMetrics | 每个节点绝对坐标和尺寸 |
| Fabric Diff | `vector<Mutation>` | 对 Native View 的最小操作序列 |
| Commit | 遍历 vector 逐条执行 | UI 线程操作真实 View |
