# 响应式系统 — Observer / XLinker(Dep) / Watcher

> 本质：数据变了，框架怎么知道该更新哪个组件的哪个节点？答案是依赖收集 + 发布订阅。

---

## 1. 核心三角关系

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Observer   │────────→│   XLinker    │←────────│   Watcher    │
│  (数据劫持)   │         │   (Dep/依赖)  │         │  (订阅者)    │
└──────────────┘         └──────────────┘         └──────────────┘
  劫持 data 的             每个属性一个               每个绑定表达式
  getter/setter           Dep 实例                  一个 Watcher

  getter 触发时:           dep.depend()             被加入 dep.subs
  setter 触发时:           dep.notify()             watcher.update()
```

快应用的命名对应 Vue2：
- `XObserver` = Vue 的 `Observer`
- `XLinker` = Vue 的 `Dep`
- `XWatcher` = Vue 的 `Watcher`

---

## 2. Observer — 数据劫持

```javascript
// observer.js
class XObserver {
  constructor(value) {
    this.dep = new XLinker()
    $def(value, '__ob__', this)  // 在对象上打标记

    if (Array.isArray(value)) {
      // 数组：替换 push/pop/splice 等方法
      value.__proto__ = arrayMethods  // 拦截变异方法
      this.observeArray(value)
    } else {
      // 对象：遍历属性，逐个 defineProperty
      this.walk(value)
    }
  }
}

// 核心：defineReactive — 把普通属性变成响应式
function defineReactive(obj, key, val) {
  const dep = new XLinker()       // 每个属性独立的依赖管理器
  let childOb = XObserver.$ob(val) // 递归观察子对象

  Object.defineProperty(obj, key, {
    get() {
      if (XLinker.target) {        // 当前有 Watcher 在收集依赖
        dep.depend()               // 建立 dep ↔ watcher 关系
        if (childOb) childOb.dep.depend()
      }
      return val
    },
    set(newVal) {
      if (newVal === val) return
      val = newVal
      childOb = XObserver.$ob(newVal)  // 新值也要观察
      dep.notify()                      // 通知所有订阅者
    }
  })
}
```

**设计要点**：
- 每个响应式属性都有自己的 `dep`（XLinker 实例）
- getter 里收集依赖，setter 里触发通知
- 数组通过替换原型方法拦截（push/pop/splice 等）

---

## 3. XLinker (Dep) — 依赖管理

```javascript
// linker.js
class XLinker {
  constructor() {
    this.id = _uid++
    this.subs = []   // 订阅者列表（Watcher 数组）
  }

  addSub(sub)    { this.subs.push(sub) }
  removeSub(sub) { $remove(this.subs, sub) }

  // 收集依赖：让当前 Watcher 知道"我依赖了这个属性"
  depend() {
    if (XLinker.target) {
      XLinker.target.addLink(this)
    }
  }

  // 通知更新：属性变了，告诉所有 Watcher
  notify() {
    this.subs.slice().forEach(watcher => watcher.update())
  }
}

// 全局唯一的"当前 Watcher"栈
XLinker.target = null
XLinker.pushTarget = (watcher) => { _targetStack.push(watcher); XLinker.target = watcher }
XLinker.popTarget = () => { _targetStack.pop(); XLinker.target = _targetStack[last] }
```

**为什么要用栈**：组件嵌套时，父组件的 Watcher 在执行过程中会触发子组件的 Watcher 创建，栈保证弹出后恢复父 Watcher。

---

## 4. Watcher — 订阅者

```javascript
// watcher.js
class XWatcher {
  constructor(vm, getter, cb, options) {
    this.vm = vm
    this.getter = getter     // 渲染函数 or computed 函数
    this.cb = cb             // 变更回调
    this.id = ++_uid         // 唯一 ID（用于排序和去重）
    this.links = []          // 依赖的 dep 列表
    this.value = this.get()  // 首次求值 → 触发依赖收集
  }

  // 求值 + 收集依赖
  get() {
    XLinker.pushTarget(this)           // 设置当前 Watcher 为"收集目标"
    const value = this.getter.call(vm) // 执行渲染函数 → 触发各属性的 getter → dep.depend()
    XLinker.popTarget()                // 恢复
    this.clearLink()                   // 清除旧依赖（处理条件渲染导致的依赖变化）
    return value
  }

  // 被 dep.notify() 调用
  update() {
    if (this.lazy) {
      this.dirty = true  // computed 属性：标记脏，下次访问时重新计算
    } else {
      // 加入 Executor 任务队列（异步批量执行）
      this.vm._page.executor.join(this)
    }
  }

  // 执行更新
  run() {
    const newValue = this.get()       // 重新求值 → 重新收集依赖 → 产生 DOM 更新
    if (newValue !== this.value) {
      this.cb(newValue, this.value)   // 触发 watch 回调
      this.value = newValue
    }
  }
}
```

---

## 5. 完整数据流

```
开发者: this.name = 'World'
  │
  ▼ Observer setter 拦截
dep.notify()
  │
  ▼ 遍历 dep.subs
watcher.update()
  │
  ▼ 加入 Executor 队列（微任务合并）
executor.join(watcher)
  │
  ▼ Promise.resolve().then → executor.exec()
watcher.run() → watcher.get()
  │
  ▼ 重新执行渲染函数
模板编译函数执行 → 对比新旧 VDom → 产生 DOM 操作
  │
  ▼ Listener 生成 Action
listener.setAttr(ref, 'value', 'Hello World')
  │
  ▼ Streamer → callNative → Native 更新 View
```

---

## 6. 和 Vue2 的差异

| 维度 | 快应用 xvm | Vue2 |
|------|-----------|------|
| Dep 类名 | XLinker | Dep |
| Watcher 调度 | Executor（自研任务队列） | nextTick + queueWatcher |
| 渲染 Watcher | 每个页面一个（整页级） | 每个组件一个 |
| 数组处理 | 替换 `__proto__` | 同 |
| computed | lazy Watcher | 同 |
| 深度监听 | 需要手动 deep: true | 同 |

---

## 7. 落地启示

- **如果用 Vue3 的 Proxy 替代**：不需要递归 defineProperty，性能更好，也能检测新增属性
- **如果走 SDUI（服务端驱动）**：不需要响应式系统，因为数据变更由服务端推送，客户端直接替换 JSON 重新渲染
- **如果用 React 模型**：用 setState + reconciler 替代 Observer/Watcher，本质相同但编程模型不同
