### app.js

`rpk` 本质是 ZIP。实际样例 `Helloworld.rpk` 解压后只有：

```text
app.js
Hello/hello.js
manifest.json
icon.png
```

`app.js` 不是业务页面，而是应用入口：webpack 包装业务模块，调用 `$app_define$` 注册应用，再调用 `$app_bootstrap$` 启动应用。它把 `manifest` 放进应用导出对象，供框架读取。

最小化后，核心可以理解成：

```js
// app.js
const manifest = {
  router: { entry: 'Hello', pages: { Hello: { component: 'hello' } } }
}

$app_define$('@app-application/app', [], (_, exports, module) => {
  module.exports = { manifest }
})
$app_bootstrap$('@app-application/app')
```

### page.js

真实文件路径是 `Hello/hello.js`。它也有 webpack 外壳，但业务核心只有三块：`template`、`style`、`script`。模板和样式在打包时已经变成 JS 对象，运行时不再解析原始标签和 CSS 文本。

```js
// Hello/hello.js
const template = {
  type: 'div',
  children: [{ type: 'text', attr: { value() { return this.title } } }]
}
const style = { '.root': { flex: 1 } }
const script = {
    data: () => ({ title: 'Hello' }),
    onInit() {
        this.title = 'Hi'
    }
}

// 本质上 是注册在一个js侧的map
// define：把组件的模板、样式、状态和方法登记成一份可复用的组件定义
$app_define$('@app-component/hello', [], (_, exports, module) => {
  module.exports = { ...script, template, style }
})
// 根据path来找到对应的页面/组件定义（就是上面app_define的）
// bootstrap：找到入口组件定义，创建根 VM，进而实例化整棵页面 DOM。
$app_bootstrap$('@app-component/hello')
```

运行时链路只有一条：

```text
app.js → 创建 App
Hello/hello.js → 创建 Page/Component
template 对象 → 实例化 JS DOM
data.title 被读取 → 建立 watcher 依赖
data.title 修改 → 修改 DOM 属性 → 批量通知 Native
```

### pageVM
```js
class PageVM {
  static target = null
  static queue = new Set()
  static pending = false

  static enqueue(watcher) {
    this.queue.add(watcher)
    if (!this.pending) {
      this.pending = true
      queueMicrotask(() => {
        for (const job of this.queue) job()
        this.queue.clear()
        this.pending = false
        $jsBridge.sendRenderIntentTransaction()
      })
    }
  }

  constructor(definition, document) {
    this.$def = definition
    this.document = document
    this.deps = new Map()
    this._observe(definition.data?.() || {})
    this._rootElement = this._render(definition.template)
    definition.onInit?.call(this)
  }

  // 状态劫持，依赖收集
  _observe(data) {
    for (const [key, initial] of Object.entries(data)) {
      let value = initial
      const dep = new Set()
      this.deps.set(key, dep)

      Object.defineProperty(this, key, {
        get: () => {
          if (PageVM.target) dep.add(PageVM.target)
          return value
        },
        set: next => {
          if (Object.is(value, next)) return
          value = next
          for (const watcher of dep) PageVM.enqueue(watcher)
        }
      })
    }
  }

  // 创建js侧的runtime tree
  _render(template) {
    const node = this.document.createElement(template.type)

    for (const [name, expression] of Object.entries(template.attr || {})) {
      const update = () => {
        PageVM.target = update
        const value = typeof expression === 'function'
          ? expression.call(this)
          : expression
        node.setAttribute(name, value)
        transaction.push({ node, name, value })
        PageVM.target = null
      }
      update()
    }

    for (const child of template.children || []) {
      node.appendChild(this._render(child))
    }
    return node
  }
}

function sendRenderIntentTransaction() {
  // 把本轮 JS DOM 变化提交给 Native。
}
```

## me-design
### page info
```js
<import name="header" src="./header.ux"></import>

<template>
  <div class="page">
    <text>{{ title }}</text>
    <button onclick="onClick">btn</button>
  </div>
</template>

<style>
.page {
  flex-direction: column;
}
</style>

<script>
import router from '@app-module/system.router'

export default {
  data: {
    title: 'hi'
  },

  onInit() {},

  onClick() {
    this.title = '123'
  }
}
</script>
```
### rpk page.js
```js
// hap 会处理XML为json tree，nyrax会处理为 基于ID寻址的IR.json文件
// HAP：模板编译为 JS 对象树；state 由 Proxy 代理，变化后更新 JS DOM tree
const templateJsonTree = {
  type: 'div',
  children: [{ type: 'text', attr: { value() { return this.title } } }]
}
// <style> 编译后变成 style JS 对象。
const style = { '.root': { flex: 1 } }
// <script> 导出的是页面定义对象
const script = {
  data: { title: 'Hello' },
  onInit() {},
  onClick() {
    this.title = '123'
  }
}
```
### 内置函数定义
```js
// 定义

/**
 * moduleid: 是编译阶段从路径映射出来的moduleId， 唯一标识， @app-component/index，所以它不是页面路径
 * - 只登记到map，不启动
 */
const $app_define$ = function(moduleId, deps, factory) {
  const pageInfo = factory()
  // 示意用伪代码
  global.componentMap.set(moduleId, {
    deps,
    pageInfo
  })
}

// 启动那一下
//  一个应用/页面有很多 define（自己 + 所有依赖），但入口只有一个，bootstrap 就是点名"从这个 id 开始跑"。
/**
 * bootstrap 做的事，一句话级：
    核心：按 moduleId 从注册表取出入口模块，触发它的 factory 执行（连带把 deps 先求值）——从"登记"进入"运行"的扳机。
    外围：吃 config（页面/应用的元信息、参数），告诉运行时这次以什么身份、什么配置启动。
    外围：把 factory 跑出来的导出（页面/应用定义）交给框架，进入建 VM、起页面的后续流程。


    实质动作：校验页面名 → new 一个 XVm 页面实例

    每次路由到页面都会执行吗？—— 是，每次进这个页面都 new 一个新页面 VM。 
    页面 VM 是"每屏一个实例"，不是单例。路由进来 → 起一个 page → bootstrap → new XVm。离开销毁，再进来再 new
*/
const $app_bootstrap$ = function(moduleId, config) {
  const pageInfo = global.componentMap.get(moduleId)
  new PageVM()
}

// 调用
$app_define$('@app-component/index',
[
  '@app-module/system.router',
  '@app-component/header'
],
function ($app_require$, $app_exports$, $app_module$) {
    $app_module$.exports = {
      data: { title: 'hi' },
      onInit() {},
      onClick() {
        this.title = '123'
      },
      template: templateJsonTree,
      style: styleObject
    }
  }
)

$app_bootstrap$('@app-component/index', { packagerVersion: '1.0.0' })
```
### pageVM
- 范例：
```js
// ========== 1. 依赖收集：Dependency + Proxy ==========
class Dependency {
  constructor() {
    this.subscribers = new Set()   // 订阅了这个字段的 watcher 集合
  }
  depend() {
    if (Dependency.activeWatcher) {
      this.subscribers.add(Dependency.activeWatcher)
    }
  }
  notify() {
    this.subscribers.forEach(watcher => watcher.update())
  }
}
Dependency.activeWatcher = null   // 当前正在收集依赖的 watcher

function reactive(rawObject) {
  const fieldDependencies = new Map()   // 字段名 → 该字段的 Dependency
  const getDependency = (field) => {
    if (!fieldDependencies.has(field)) {
      fieldDependencies.set(field, new Dependency())
    }
    return fieldDependencies.get(field)
  }
  return new Proxy(rawObject, {
    get(target, field) {
      getDependency(field).depend()      // 读时：收集当前 watcher
      return target[field]
    },
    set(target, field, value) {
      target[field] = value
      getDependency(field).notify()      // 写时：通知订阅者
      return true
    },
  })
}

// ========== 2. microtask 批调度 ==========
const pendingWatchers = new Set()   // 本轮待执行的 watcher，Set 天然去重
let flushScheduled = false

function scheduleWatcher(watcher) {
  pendingWatchers.add(watcher)
  if (!flushScheduled) {
    flushScheduled = true
    Promise.resolve().then(flushWatchers)   // 排一个 microtask
  }
}

function flushWatchers() {
  const operations = []
  pendingWatchers.forEach(watcher => watcher.run(operations))
  pendingWatchers.clear()
  flushScheduled = false
  if (operations.length > 0) {
    NativeBridge.send(operations)   // 一批指令一次过桥,发送给core/platform侧
  }
}

// ========== 3. Watcher：依赖收集 + 延迟批处理 ==========
class Watcher {
  constructor(state, evaluate, onValueChanged) {
    this.state = state
    this.evaluate = evaluate               // 怎么算这个绑定的值
    this.onValueChanged = onValueChanged   // 值变了做什么
    this.value = this.getValue()           // 首次求值，触发依赖收集
  }
  getValue() {
    Dependency.activeWatcher = this        // 标记"我在收集依赖"
    const value = this.evaluate.call(this.state)
    Dependency.activeWatcher = null
    return value
  }
  update() {
    scheduleWatcher(this)                  // 被通知：只入队，不立即求值
  }
  run(operations) {
    const newValue = this.getValue()       // microtask 里才重新求值 → 最新值
    if (newValue !== this.value) {
      this.value = newValue
      this.onValueChanged(newValue, operations)
    }
  }
}

// 让数据和页面真正在活起来, 一个页面只有一个 PageVM 实例,也就是只有在app_bootstrap的时候创建一次
class PageVM {
  // 每次创建页面都分配独立状态，再把模板实例化为节点树。
  constructor(pageDefinition) {
    // 1. data数据响应式化(状态劫持+依赖收集)
    this.state = reactive(pageDefinition.data())
    // 2. 递归创建当前页面子树
    this.root = this.buildSubRuntimeTree(pageDefinition.template)
  }

  // 将模板定义变成当前节点；动态属性通过 Watcher 跟随状态更新。
  buildSubRuntimeTree(template) {
    const node = {
      type: template.type,
      attributes: {},
      children: []
    }

    for (const [name, expression] of Object.entries(template.attr || {})) {
      if (typeof expression !== 'function') {
        node.attributes[name] = expression
        continue
      }

      // 首次求值收集依赖，把“哪些状态变化”与“更新哪个属性”连起来。
      const watcher = new Watcher(
        this.state,
        expression,

        // 同步 JS 节点的当前值，并记录增量，供调度器批量提交。
        (value, operations) => {
          node.attributes[name] = value
          operations.push({ node, name, value })
        }
      )

      node.attributes[name] = watcher.value
    }

    // 递归构建子树
    node.children = (template.children || []).map(childTemplate => this.buildSubRuntimeTree(childTemplate))
    return node
  }
}

// ========== 用法 ==========
const pageDefinition = {
  // 返回新对象，让各个页面实例拥有独立状态。
  data: () => ({ title: 'hi' }),

  template: {
    type: 'text',
    attr: {
      // 求值时读取 title，Watcher 因而订阅 title 的变化。
      value() {
        return this.title
      }
    }
  }
}

const pageVM = new PageVM(pageDefinition)
NativeBridge.mount(pageVM.root)

pageVM.state.title = 'hello'
```
- me：
```js
// ========== 1. 依赖收集：Dep + Proxy ==========
// ========== 2. microtask 批调度 ==========
// ========== 3. Watcher：收集 + 延迟批处理 ==========
// ========== 用法 ==========
class PageVM {
  pageObj
  data
  metods
  /**
   * XVm 构造函数 = 取定义 → 拆成 data/methods → initState 把 data 响应式化 → build 递归建子树，中间穿插 onCreate/onInit 生命周期 
   * 第一性：把一份"组件定义"变成一个"活的、响应式的、挂在 VM 树上的组件实例，并建出它的子树"。
   * 
   * 1. 当前组件挂载到合适位置（确立在 VM 树的位置）
   * 2. initState：数据响应式化 + 方法上身（让它"活"起来）
   * 3. build：递归建子树（从一个 VM 长成一棵树）
  */
  constructor(pageObj, pageName, parentObj) {
    const { templateJsonTree, style, script } = pageObj

    new Proxy(script.data, () => {
      set(target, value) {
        microTaskRegister(this.flush)
      }
    })
  }

  flush() {
    // 1. 计算获取最新的状态值 如何获取？
    // 2. 生成最新的渲染意图事务
    const renderIntentTransaction = genRenderIntentTransaction()
    // 3. 通过NativeBridge发送这组渲染意图事务
    NativeBridge.sendRenderIntentTransaction()
  }
}
```

## 外围部件
- 事件回传（native 事件 → 找到 handler → 执行方法）
- 生命周期钩子（onInit/onReady 等的触发时机）。

## 多子组件页面
- me:
  - 页面入口和它依赖的子组件分别通过 $app_define$ 注册定义。
  - 只有页面根组件执行一次 $app_bootstrap$；子组件不执行 bootstrap。
  - 页面 VM 构建模板时，按组件定义创建各自的子组件 VM。
- 一个页面有多个子组件时，page.js 会把它们都注册到同一个 moduleRegistry，然后只对页面根组件执行一次 $app_bootstrap$；页面 VM 构建模板时，遇到子组件节点再按 moduleId 取定义、创建子组件 VM。
最小产物大致是：
```js
// page.js

$app_define$('@app-component/header', [], function (
  requireModule, exports, module
) {
  module.exports = {
    data: { title: 'Header' },
    template: {
      type: 'text',
      attr: { value() { return this.title } }
    },
    style: {}
  }
})

$app_define$('@app-component/button', [], function (
  requireModule, exports, module
) {
  module.exports = {
    data: { label: 'OK' },
    template: {
      type: 'button',
      attr: { value() { return this.label } }
    },
    style: {}
  }
})

$app_define$('@app-component/home', [], function (
  requireModule, exports, module
) {
  module.exports = {
    data: { title: 'Home' },
    template: {
      type: 'div',
      children: [
        { type: 'component', moduleId: '@app-component/header' },
        { type: 'component', moduleId: '@app-component/button' }
      ]
    },
    style: {}
  }
})

$app_bootstrap$('@app-component/home', {
  pageId: 'page-1'
})
```

运行时内存关系：
```
moduleRegistry
  ├─ header definition
  ├─ button definition
  └─ home definition

pageVM(home)
  ├─ childVM(header)
  └─ childVM(button)
```
定义只注册一次；每次页面使用组件时，框架从注册表取定义，创建一个新的子组件 VM。

---

## QA
### Q: 如果是一个组件
- 组件可能会被多个地方使用，也就是会有多个实例
- 那么 每个实例加载的时候 都会执行一次 define + bootstrap吗

A:
不会。
- `$app_define$`：组件代码加载时执行一次，把组件定义注册到表里；多个实例共享这份定义。
- `$app_bootstrap$`：页面入口执行一次，用来创建页面根 VM；普通子组件不会为每个实例执行。
- 每次使用组件时，框架直接从注册表取定义，执行 `new PageVM(...)` 创建独立实例；每个实例各自拥有状态和生命周期。

本质：**定义只登记一次，实例可以创建多次。**

### pageVM 执行是在bootstrp吗 执行时机是每次路由到这个页面吗？如果是组件呢？
1. 页面 VM 在 bootstrap 里 new。 对，$bootstrap 里 page.vm = new XVm(...)，页面实例化就在这。

2. 每次路由到页面都会执行吗？—— 是，每次进这个页面都 new 一个新页面 VM。 页面 VM 是"每屏一个实例"，不是单例。路由进来 → 起一个 page → bootstrap → new XVm。离开销毁，再进来再 new。（前面 nyrax 那边 surfaceId 每屏一个，是同一个道理——页面实例跟着"这一次打开"走。）

### Q: 自定义组件会有bootstrap吗
组件的 XVm 不在 bootstrap，在建树过程中 new。 这是关键区别：

自定义组件没有独立的 bootstrap。它是在页面 VM build（递归 compile 模板）时，遇到一个自定义组件节点，就地 new XVm(options=组件定义, ..., parentObj=父vm) 创建。
也就是说：页面 VM 是 bootstrap 触发的根；组件 VM 是页面 build 时递归衍生的子。同一个 XVm 类，页面是"被 bootstrap 起的根实例"，组件是"建树时被父 VM 创建的子实例"。
所以 new XVm 的两个入口：

页面：bootstrap 触发，options=null（自己查定义），无父。每次路由进来执行一次。
组件：父 VM build 时触发，options=组件定义，有父（parentObj）。父树建到它时执行，用几个建几个（for 循环里 N 个就 new N 个）。
一句收束：bootstrap 只负责起页面根 VM，每次路由进页面执行一次；自定义组件没有 bootstrap，它们在页面建树递归时由父 VM 就地 new 出来。页面 VM 是根、bootstrap 起；组件 VM 是子、建树时衍生。同一个 XVm 类，区别在"谁触发、有没有 options 和父"。


