# js-framework
- 渲染管线在js侧的绝对核心

### js侧
quickapp-kit-ai/quickapp-runtime-js
那个"统一 JS framework"的家——JS 侧轻运行时的源码与产物。

分层看它（本质就三样，其余是构建垃圾）：


create-reactive-page-vm.js
 —— 唯一的源。就是我们聊的那台 page 状态机：Proxy 劫持 state、建 bindings 表、算初始 block、microtask flush。owner 是 JS 侧。

 ### 关于js framework
 framework = 只提供一个函数createReactivePageVm，随 rpk 打一份、应用内所有 page 共享，内容随版本恒定

 入参：

 核心能力：

 - 最小实现：

```js
// 第一性：一台「状态变化 → 渲染意图」的翻译机。
// 骨架三件事：Proxy 收脏 → microtask 排期 → flush 翻译并 submit。
// 只有 ID 和值，没有树（树是 Core 的）。
function createReactivePageVm(target, context, bindings, blocks) {
  let scheduled = false
  const dirtySet = new Set()
  let proxy

  // Task 3：首帧——全量算一遍动态节点，交给 Core
  const initialBlocks = () => collectBlocks()

  // 动态节点(if/for)计算：当前状态 → 期望的实例列表。纯计算，不 submit。
  function collectBlocks() {
    const ops = []
    for (const id in blocks) {
      const b = blocks[id]
      if (b.kind === "if") {
        if (b.evaluate.call(proxy)) ops.push({ block: id, key: "if" })
      } else { // for
        b.evaluate.call(proxy).forEach((item, i) =>
          ops.push({ block: id, key: b.key.call(proxy, { item, i }), item }))
      }
    }
    return ops
  }

  // Task 2：flush —— 挂在 microtask 上，被 eventloop 执行。
  // 在这里合流两件事，打一个事务发给 Core。
  function flush() {
    scheduled = false
    if (dirtySet.size === 0) return
    const ops = []
    // (a) 脏 binding 求值 → ID+值
    dirtySet.forEach(id => ops.push({ id: Number(id), value: bindings[id].evaluate.call(proxy) }))
    // (b) 动态节点重算 → 结构变化
    ops.push(...collectBlocks())
    dirtySet.clear()
    // 唯一的下游出口：把意图事务送过 bridge 给 Core
    globalThis.$submitRenderTransaction$({ surfaceId: context.surfaceId, ops })
  }

  // Task 1：Proxy 劫持 —— 写 state 时，靠 deps 反查标脏，挂一次 microtask。
  proxy = new Proxy(target, {
    set(obj, prop, val) {
      obj[prop] = val
      // deps 是编译期算好的「谁依赖这个字段」，运行时只做查表标脏（就是加入dirtySet）
      for (const id in bindings)
        if (bindings[id].deps.includes(prop)) dirtySet.add(id)
      if (!scheduled) { scheduled = true; Promise.resolve().then(flush) } // 注册一次flush到microTask
      return true
    },
  })

  proxy.__initialBlocks__ = initialBlocks() // Core 首帧来取
  return proxy
}

```

### 入参最小例子：target, context, bindings, blocks
用一个最小页面举例。假设 DSL 写的是这么一页：

```
标题：{{title}}      ← 静态节点 + 一个绑定
如果 visible 为真，显示一行 "on"   ← if 动态块
遍历 items，每项显示 {{item.name}}  ← for 动态块
点按钮 → addItem()
```

编译期从这页 DSL 抽出来的四个入参，长这样：

```js
// target —— 页面状态 + 方法。就是应用作者写的数据和函数，原样。
const target = {
  title: "Hello",
  visible: true,
  items: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
  addItem() { this.items = [...this.items, { id: "c", name: "C" }] },
}

// context —— 这一屏的身份。
const context = { surfaceId: "srf:1" }

// bindings —— 绑定表。key=编译期分配的 bindingId，value={依赖哪些字段, 怎么求值}。
// deps 是编译期静态算出的：这个绑定读了 state 的哪些字段。
const bindings = {
  1: { deps: ["title"], evaluate() { return String(this.title) } }, // 1 就是 templateBindingId
}

// blocks —— 动态节点表。key=blockId，value 描述这是 if 还是 for、依赖什么、怎么算。
const blocks = {
  1: { kind: "if",  deps: ["visible"], evaluate() { return Boolean(this.visible) } },
  2: { kind: "for", deps: ["items"],
       evaluate() { return this.items },
       key(scope) { return scope.item.id } },   // 每项的稳定身份
}
```

对照着看四者的**分工和 owner**：

- **target**：应用的真实状态，唯一"活"的数据。写它才触发响应式。也是被proxy主要包裹的页面的js obj部分
- **context**：身份标签，只读，用来给事务打 surfaceId。
- **bindings**：静态绑定的求值规则。`this` 指向 proxy，所以 `this.title` 走的是被劫持的 state。deps 决定"改哪个字段会让这个绑定变脏"。
- **blocks**：动态结构的求值规则。比 bindings 多两样——`kind`（if/for）和 for 的 `key`（决定实例复用）。

关键点：**这里面全是"死数据 + 纯函数"，没有一行是通用机器逻辑**。机器（createReactivePageVm）是通用的，这四个入参才是 Home 区别于别页的全部。你把 title 改成别的、items 换一批，就是另一个页面——机器一个字节都不用动。

再串一下它们怎么被用：改 `this.visible = false` → Proxy 查 bindings/blocks 里谁的 deps 含 "visible" → 命中 block 1 → 标脏 → flush 里 block 1 的 evaluate 重算得 false → 产出一条 removeBlock。这就是从"料"到"意图"的完整一跳。


### 关于surface ID
pageId 是"哪个页面"（模板身份），surfaceId 是"哪一屏"（实例身份）。

pageId / templateId：编译期定，一个 page 一个，恒定。指向"Home 这个模板"。
surfaceId：运行时定，每次打开一屏就分配一个新的。指向"当前这块正在渲染的屏"。
为什么必须分开——因为同一个 page 可以同时存在多屏。你从 Home push 到 Detail 再 push 一个 Detail，两个 Detail 是同一个 pageId、不同 surfaceId。它们共享模板，但各有各的 state、各自的实例、各自的一批事务。
surfaceId 就是用来区分"这批渲染意图属于哪一屏"的。



### 加载时机
- appjs加载之前，manifest之后？