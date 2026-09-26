## update：state变化引起渲染的链路

用一个例子讲，你会发现就一条直线。

**例子**：`<text>{{count}}</text>`，编译期给这个插值点编号 = 2。用户点按钮，`count` 从 0 变 1。

**一条链路：**

1. **JS 改 count** → Proxy 拦截 → 查反向索引得知“2 号 binding 依赖 count” → 标脏 2 号 → 算出新值 `"1"`。
2. **JS 发给 Core**：

```ts
{
  ownerInstanceId: "page:home", // 哪个页面/组件实例
  templateBindingId: 2,          // 编译期分配的 binding ID
  value: "1",                    // JS 重新求值后的最新结果
}
```

3. **Core 收到** → 用 `ownerInstanceId + templateBindingId` 查 Page IR 和 Runtime Tree → 找到对应运行时节点及属性。
4. **Core 发给平台**：

```ts
{
  nodeId: 7,        // 当前实例中的真实运行时节点 ID
  property: "text", // 要更新的节点属性
  value: "1",       // 要写入原生 View 的值
}
```

5. **平台** → 修改对应 Android View。

**binding 是什么**：

> binding 是编译期分配的“模板绑定位置 ID”，记录某个表达式最终更新哪个模板节点的哪个属性。

它不是 stateId，也不是运行时 NodeId：

```text
state.count
    → templateBindingId = 2
    → 模板节点 t7 的 text 属性
    → 运行时节点 node7
```

**为什么需要 binding**：

JS 不直接持有 Core 的 Runtime Node，Core 也不理解 JS 的 state。双方只通过：

```text
ownerInstanceId + templateBindingId + value
```

传递更新意图。

一句话：

> binding 是编译期确定的“状态表达式 → 模板属性”的中间编号；JS 提交 binding 更新，Core 再把它解析成运行时节点属性更新。

---

### 例子叙述

**源码**

```html
<text>{{count}}</text>
<text>{{count}} - {{name}}</text>
```

```ts
count: 0
name: "a"
```

---

### 编译期产物

```ts
type StateKey = string
type BindingId = number
type TemplateNodeId = number
type OwnerInstanceId = string

interface State {
  count: number
  name: string
}

interface Binding {
  depStateKeys: StateKey[]
  targetTemplateNodeId: TemplateNodeId
  targetProp: string
  evaluate: (state: State) => string
}

// bindingId → binding 定义
const bindingId2BindingMap: Map<BindingId, Binding> = new Map([
  [1, {
    depStateKeys: ["count"],
    targetTemplateNodeId: 7,
    targetProp: "text",
    evaluate: (state) => `${state.count}`,
  }],
  [2, {
    depStateKeys: ["count", "name"],
    targetTemplateNodeId: 8,
    targetProp: "text",
    evaluate: (state) => `${state.count} - ${state.name}`,
  }],
])

// 编译期生成的反向索引：stateKey → 受影响的 binding
// 注：反向索引是我的设计（查表 O(1) 命中）。nyrax 现状是正向遍历
// 全部 binding、逐个匹配 deps（O(N)），未建反向索引——见债务记录。
const stateKey2BindingIdsMap: Map<StateKey, BindingId[]> = new Map([
  ["count", [1, 2]],
  ["name", [2]],
])
```

模板结构：

```ts
const template = {
  nodes: [
    { templateNodeId: 7, type: "text" },
    { templateNodeId: 8, type: "text" },
  ],
}
```

运行时实例化模板后：

```text
templateNodeId 7 → runtimeNodeId 7
templateNodeId 8 → runtimeNodeId 8
```

模板节点 ID 是静态的；运行时节点 ID 属于当前组件实例。

---

### 运行时：Proxy 查表标脏，冲刷求值

```ts
const dirtyBindingIdSet = new Set<BindingId>()

const state: State = new Proxy(
  { count: 0, name: "a" },
  {
    set(target, key: StateKey, value: unknown): boolean {
      target[key] = value

      const affectedBindingIds =
        stateKey2BindingIdsMap.get(key) ?? []

      for (const bindingId of affectedBindingIds) {
        dirtyBindingIdSet.add(bindingId)
      }

      scheduleFlush()
      return true
    },
  },
)

interface BindingUpdate {
  ownerInstanceId: OwnerInstanceId
  templateBindingId: BindingId
  value: string
}

function flush(ownerInstanceId: OwnerInstanceId): void {
  const updates: BindingUpdate[] = []

  for (const bindingId of dirtyBindingIdSet) {
    const binding = bindingId2BindingMap.get(bindingId)!

    updates.push({
      ownerInstanceId,
      templateBindingId: bindingId,
      value: binding.evaluate(state),
    })
  }

  dirtyBindingIdSet.clear()
  sendToCore(updates)
}
```

---

### 跑一次 `state.count = 1`

```text
stateKey2BindingIdsMap.get("count") → [1, 2]
dirtyBindingIdSet → {1, 2}
```

冲刷后：

```ts
[
  {
    ownerInstanceId: "page:home",
    templateBindingId: 1,
    value: "1",
  },
  {
    ownerInstanceId: "page:home",
    templateBindingId: 2,
    value: "1 - a",
  },
]
```

---

### Core 侧

```ts
function applyBindingUpdate(update: BindingUpdate): void {
  const binding = pageIr.findBinding(update.templateBindingId)

  const runtimeNode = runtimeTree.resolve(
    update.ownerInstanceId,
    binding.targetTemplateNodeId,
  )

  runtimeNode.props[binding.targetProp] = update.value

  mountPort.setHostProp(
    runtimeNode.nodeId,
    binding.targetProp,
    update.value,
  )
}
```

Core 不查 state，也不重新计算表达式，只负责：

```text
templateBindingId
→ 模板节点属性
→ 当前 owner 的运行时节点
→ 平台属性更新
```

一句话：

> 编译产物提前确定依赖和绑定关系，运行时 Proxy 通过反向索引找到受影响 binding，JS 只提交 `ownerInstanceId + templateBindingId + value`，Core 再解析并更新 Runtime Tree。



## 编译生成的binding相关

用同一个例子，把编译产物具体写出来。

**源码**

```html
<text>{{count}}</text>          <!-- 模板节点 t7 -->
<text>{{count}} - {{name}}</text> <!-- 模板节点 t8 -->
```

**编译器扫完，产出静态编译信息**

```ts
type TemplateNodeId = number
type BindingId = number
type StateKey = string

// 产物一：模板结构
const template = {
  nodes: [
    { templateNodeId: 7, type: "text" },
    { templateNodeId: 8, type: "text" },
  ],
  // 父子关系、节点顺序也在这里
}

// 产物二：JS 侧 binding 定义
// 负责：依赖哪些 state，以及如何重新求值
const bindingId2BindingMap: Map<BindingId, Binding> = new Map([
  [1, {
    depStateKeys: ["count"],
    evaluate: (state) => `${state.count}`,
  }],
  [2, {
    depStateKeys: ["count", "name"],
    evaluate: (state) => `${state.count} - ${state.name}`,
  }],
])

// 产物三：编译期生成的反向索引
// stateKey → 受影响的 binding
// 注：反向索引是我的设计（查表 O(1)）。nyrax 现状为正向遍历全部 binding
// 匹配 deps（O(N)），未建反向索引——见债务记录。
const stateKey2BindingIdsMap: Map<StateKey, BindingId[]> = new Map([
  ["count", [1, 2]],
  ["name", [2]],
])
```

**Core 侧的 binding 目标定义**

```ts
// Core 侧 Page IR 中保存
const bindingTargetMap: Map<BindingId, BindingTarget> = new Map([
  [1, {
    targetTemplateNodeId: 7,
    targetProp: "text",
  }],
  [2, {
    targetTemplateNodeId: 8,
    targetProp: "text",
  }],
])
```

**所以编译产物主要包含四类信息：**

1. **模板结构** `template`  
   有哪些节点、节点类型、父子关系和顺序。

2. **JS 侧 binding 定义** `bindingId2BindingMap`  
   每个 binding 依赖哪些 state，以及如何重新求值。

3. **state 反向索引** `stateKey2BindingIdsMap`  
   某个 state 变化时，直接找到受影响的 binding。

4. **Core 侧 binding 目标定义** `bindingTargetMap`  
   每个 binding 最终更新哪个模板节点的哪个属性。

**关键的一点：**

`targetTemplateNodeId` 是编译期的模板节点编号，不是运行时真实节点编号。

运行时提交：

```ts
{
  ownerInstanceId: "page:home",
  templateBindingId: 1,
  value: "1",
}
```

Core 根据：

```text
ownerInstanceId + templateBindingId
```

找到当前实例，再解析出对应的 Runtime Node 和目标属性。

不是 JS 自己直接维护：

```text
templateNodeId → runtimeNodeId
```

而是 Core 的 Runtime Tree 负责完成模板节点到运行时节点的解析。

一句话：

> 编译产物 = 模板结构 + JS 侧 binding 求值定义 + Core 侧 binding 目标定义 + state 反向索引 + 事件表；编译期确定依赖和目标，运行时只补齐 owner 实例与 Runtime Node 的对应关系。

## 关于 绑定 binding
- me：binding承载的方案本质：就是把hap中的运行时 依赖收集 在静态编译的时候 通过分配id + 建表 确定了
