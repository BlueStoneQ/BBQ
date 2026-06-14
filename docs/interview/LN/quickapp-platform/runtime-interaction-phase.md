# 运行交互阶段 — 事件响应、数据更新、Native API 调用

> 首次渲染完成后，应用进入交互阶段。本文解析：用户触摸 → 事件到达 JS → 数据变更 → 增量渲染更新，以及 JS 调用 Native API（Feature）的完整链路。

---

## 目录

- [1. 两个阶段的本质区别](#1-两个阶段的本质区别)
- [2. 事件响应链路（Native → JS）](#2-事件响应链路native--js)
- [3. 数据变更与增量渲染（JS → Native）](#3-数据变更与增量渲染js--native)
- [4. Native API 调用链路（Feature 调用）](#4-native-api-调用链路feature-调用)
- [5. Executor 任务队列机制](#5-executor-任务队列机制)
- [6. 回调 ID 映射机制详解](#6-回调-id-映射机制详解)
- [7. 完整交互循环时序图](#7-完整交互循环时序图)
- [8. 性能关键点](#8-性能关键点)

---

## 1. 两个阶段的本质区别

| | 加载首次渲染 | 运行交互 |
|--|-------------|---------|
| 方向 | 主要是 JS→Native（大量创建指令） | 双向频繁通信 |
| 数据量 | 大（整颗 DOM 树创建） | 小（增量 diff 更新） |
| 触发源 | Native 调用 createPage | 用户触摸/定时器/网络回调 |
| 结束标记 | createFinish | updateFinish |
| 频率 | 一次 | 持续不断 |

交互阶段的核心循环：

```
用户操作 → Native 捕获事件 → 传给 JS → JS 处理逻辑 → 数据变更
  → 响应式触发 Watcher → VDom diff → Listener 生成增量 Action
  → Streamer 批量发送 → Native 更新 View → 屏幕刷新
```

---

## 2. 事件响应链路（Native → JS）

### 2.1 触摸事件到达 JS 的完整路径

```
用户手指触摸屏幕
  → Android View.onTouchEvent()
  → Widget 内部处理（click/longpress/swipe 等手势识别）
  → Native 封装事件对象:
      {
        action: 1,              // 1=DOM事件, 2=Feature回调
        args: [
          "ref_12",             // 触发事件的节点 ref
          "click",              // 事件类型
          { x: 120, y: 300 }   // 事件数据
        ]
      }
  → JNI 调用 JS 线程
  → global.processCallbacks(pageId, [event1, event2, ...])
```

### 2.2 JS 侧事件处理

```javascript
// dock/interface.js
function processCallbacks(id, events) {
  const instance = _pageMap[id] || _appMap[id]

  events.forEach(evt => {
    switch (evt.action) {
      case 1:  // DOM 事件
        fireEvent(instance, ...evt.args)
        break
      case 2:  // Feature 回调
        callback(instance, ...evt.args)
        break
    }
  })
}
```

### 2.3 fireEvent — 从 ref 找到节点，触发开发者事件函数

```
fireEvent(page, ref, type, eventData, domChanges)
  → publish(APP_KEYS.fireEvent, [...])
  → DSL 层接收：xvm/page/misc.js → fireEvent()
      → getNodeByRef(page.doc, ref)        // 根据 ref 找到 VDom 节点
      → fireEventWrap(element, type, e)     // 在节点上触发事件
          → 找到节点绑定的事件处理函数名（如 "handleClick"）
          → 在 VM 的 methods 中找到对应函数
          → 执行 vm.handleClick(eventData)
  → updatePageActions(page)                  // 事件处理完后，检查是否有 DOM 更新
```

---

## 3. 数据变更与增量渲染（JS → Native）

### 3.1 响应式数据链路

当开发者在事件处理函数中修改数据：

```javascript
// 开发者代码
handleClick() {
  this.name = 'World'  // ← 触发响应式更新
}
```

内部发生了什么：

```
this.name = 'World'
  → Observer 的 setter 拦截
  → dep.notify()（通知所有依赖这个属性的 Watcher）
  → Watcher.update()
  → 将 Watcher 加入 Executor 的 taskList（去重）
  → Executor._defineNextTick()（微任务队列，合并同一轮的所有变更）
```

### 3.2 Executor 执行更新

```
Promise.resolve().then(() => {
  // 微任务触发
  updatePageActions(page)
})

updatePageActions(page):
  → execPageTasks(page)
      → executor.exec()
          → 遍历 taskList 中的所有 Watcher
          → 逐个执行 watcher.run()
              → 重新执行 getter（模板渲染函数）
              → 对比新旧值，如果变化则更新 DOM
              → DOM 操作触发 Listener：
                  listener.setAttr(ref, 'value', 'Hello World')
                  listener.setStyle(ref, 'color', '#f00')
  → page.doc.listener.hasActions()  // 检查是否有新 Action
  → 如果有：listener.updateFinish()  // 发送结束信号
```

### 3.3 增量 Action 示例

假设 `this.name = 'World'` 只影响一个 text 节点的 value 属性：

```javascript
// Listener 只生成了 1 条 Action（而非整颗树重建）
[
  {
    module: 'dom',
    method: 'updateAttrs',
    args: ['ref_5', { attr: { value: 'Hello World' } }]
  }
]
```

Streamer 收到后因为不满 50 条阈值，存入缓冲区。当 `updateFinish()` 调用时，`over()` 方法会把剩余的 + 结束标记一次性发出：

```javascript
// 实际发送给 Native 的
callNative(pageId, [
  { module: 'dom', method: 'updateAttrs', args: ['ref_5', {attr: {value: 'Hello World'}}] },
  { module: 'dom', method: 'updateFinish', args: [{ jsCallbacks: false }] }
])
```

### 3.4 Native 侧处理增量更新

```
收到 Action[]
  → RenderActionManager 在 IO 线程解析
  → updateAttrs → 找到 ref_5 对应的 Widget → widget.setAttr("value", "Hello World")
  → updateFinish → 触发 requestLayout() → Yoga 重新计算布局 → invalidate() → 屏幕刷新
```

---

## 4. Native API 调用链路（Feature 调用）

### 4.1 开发者视角

```javascript
// 开发者代码
import device from '@system.device'
device.getInfo({
  success(data) {
    this.brand = data.brand
  },
  fail(err) {
    console.error(err)
  }
})
```

### 4.2 JS 侧的 invokeNative 机制

```
device.getInfo({ success, fail })
  → invokeNative(inst, moduleDef, methodDef, args)
      │
      ├─ 1. 从 args 中分离"数据参数"和"回调函数"
      │     data = { /* 开发者传的业务参数 */ }
      │     callbacks = { success: fn, fail: fn, complete: fn }
      │
      ├─ 2. 为回调函数生成唯一 ID
      │     cbId = uniqueCallbackId()  // 例如: 42
      │     inst._callbacks[42] = wrapperFn  // 存储回调
      │     _callbackSourceMap[42] = { instance: pageId, preserved: false }
      │
      ├─ 3. 调用 Native Bridge
      │     JsBridge.invoke("system.device", "getInfo", dataJSON, "42", instId)
      │     // 注意：传的是字符串 "42"，不是函数引用
      │
      └─ 4. 对于异步方法，如果开发者没传回调 → 返回 Promise
```

### 4.3 Native 侧执行

```
JsBridge.invoke("system.device", "getInfo", params, cbId)
  → ExtensionManager.invoke()
  → 查找 Feature 注册表 → 找到 Device.java
  → Device.getInfo() 收集 Build.BRAND / Build.MODEL / ...
  → 封装结果: { code: 0, content: { brand: "Xiaomi", model: "14" } }
  → JS线程投递: executeVoidFunction("execInvokeCallback", [{ callback: 42, data: result }])
```

### 4.4 JS 侧处理回调

```
global.execInvokeCallback({ callback: 42, data: { code: 0, content: {...} } })
  → mapInvokeCallback(42)  // 找到 { instance: pageId, preserved: false }
  → 找到 page 实例
  → page._callbacks[42](result)
      → 判断 code:
          0   → 调用 success(data.content)
          100 → 调用 cancel()
          200+→ 调用 fail(data, code)
      → 最后调用 complete(data.content)
  → delete _callbackSourceMap[42]  // 单次回调，用完即删
  → publish(APP_KEYS.callbackDone, [page])
  → updatePageActions(page)  // 回调中可能修改了数据，检查更新
```

### 4.5 同步 vs 异步 Feature

| 模式 | 说明 | 例子 |
|------|------|------|
| SYNC (mode=0) | 立即返回结果 | `router.getState()` |
| CALLBACK (mode=1) | 异步执行，通过 cbId 回调 | `device.getInfo()` |
| SUBSCRIBE (mode=2) | 持续订阅，回调保留不删除 | `sensor.subscribeAccelerometer()` |

---

## 5. Executor 任务队列机制

Executor 是 DSL 层的核心调度器，负责合并和执行一轮内的所有 Watcher 更新：

```
┌─────────────────────────────────────────┐
│            XExecutor                     │
│                                         │
│  taskList: [watcher1, watcher2, ...]    │  ← Watcher.update() 加入
│  taskHash: Set {watcher1, watcher2}     │  ← 去重（同一个 watcher 只执行一次）
│                                         │
│  _defineNextTick():                     │
│    Promise.resolve().then(() => {       │
│      updatePageActions(page)            │  ← 微任务触发执行
│    })                                   │
│                                         │
│  exec():                                │
│    while (taskList.length > 0):         │
│      task = taskList.shift()            │
│      task.run()  // 执行 watcher        │  ← 可能产生新 task（嵌套更新）
│    return listener.hasActions()         │
│                                         │
└─────────────────────────────────────────┘
```

**关键设计**：
- **去重**：同一个 Watcher 在一轮内只会执行一次（避免重复渲染）
- **排序**：按 Watcher ID 排序，保证父组件先于子组件更新
- **微任务合并**：一轮同步代码中的多次数据修改，合并为一次 DOM 更新
- **循环检测**：超过 10000 次迭代会警告（防止无限循环更新）

---

## 6. 回调 ID 映射机制详解

这是跨端框架通信的核心模式。函数不能序列化跨 V8 边界，所以用 ID 表替代：

```
┌──────── JS 侧 ──────────────────────────────────────────┐
│                                                          │
│  inst._callbacks = {                                     │
│    42: function(result) { ... },     // Feature 回调     │
│    43: function(result) { ... },     // setTimeout       │
│    44: function(result) { ... },     // setInterval      │
│  }                                                       │
│                                                          │
│  _callbackSourceMap = {                                  │
│    42: { instance: "page_1", preserved: false },         │
│    43: { instance: "page_1", preserved: false },         │
│    44: { instance: "page_1", preserved: true },  // 订阅 │
│  }                                                       │
│                                                          │
└──────────────────────────────────────────────────────────┘

传给 Native 的只是: cbId = "42" （字符串）
Native 回调时传回: { callback: 42, data: {...} }
JS 根据 42 找到对应函数执行
```

**preserved 字段**：
- `false`：一次性回调，执行完就删除（success/fail）
- `true`：订阅型回调，保持不删除（sensor 监听、定时器）

---

## 7. 完整交互循环时序图

以"用户点击按钮 → 调用 Native API → 收到数据 → 更新界面"为例：

```
┌────────┐       ┌────────┐       ┌────────┐       ┌────────┐
│ Screen │       │ Native │       │  V8    │       │ JS Fwk │
└───┬────┘       └───┬────┘       └───┬────┘       └───┬────┘
    │                 │                │                 │
    │ 1.用户点击      │                │                 │
    │────────────────→│                │                 │
    │                 │ 2.processCallbacks(action=1)     │
    │                 │───────────────→│────────────────→│
    │                 │                │                 │
    │                 │                │  3.fireEvent    │
    │                 │                │  → vm.onClick()  │
    │                 │                │  → device.getInfo│
    │                 │                │                 │
    │                 │  4.JsBridge.invoke("device","getInfo",data,"42")
    │                 │←───────────────│←────────────────│
    │                 │                │                 │
    │                 │ 5.Device.java  │                 │
    │                 │  执行原生逻辑  │                 │
    │                 │                │                 │
    │                 │ 6.execInvokeCallback({cb:42,data:{brand:"Xiaomi"}})
    │                 │───────────────→│────────────────→│
    │                 │                │                 │
    │                 │                │  7.success回调   │
    │                 │                │  this.brand=... │
    │                 │                │                 │
    │                 │                │  8.Observer通知  │
    │                 │                │  → Watcher加入   │
    │                 │                │  → Executor队列  │
    │                 │                │                 │
    │                 │                │  9.微任务触发    │
    │                 │                │  → exec()执行    │
    │                 │                │  → listener生成  │
    │                 │                │    updateAttrs   │
    │                 │                │  → updateFinish  │
    │                 │                │                 │
    │                 │ 10.callNative(actions[])          │
    │                 │←───────────────│←────────────────│
    │                 │                │                 │
    │ 11.更新View     │                │                 │
    │←────────────────│                │                 │
    │                 │                │                 │
    │ 12.屏幕刷新 ✓   │                │                 │
    │                 │                │                 │
```

---

## 8. 性能关键点

### 8.1 事件传递优化

- **批量事件**：processCallbacks 接收事件数组，一次 JNI 调用可以传多个事件
- **事件节流**：高频事件（scroll/touchmove）在 Native 侧做节流，不是每帧都传

### 8.2 更新合并

- **微任务合并**：同一个事件处理函数中修改多个属性，只触发一次 DOM 更新
- **Watcher 去重**：同一个 Watcher 一轮内只执行一次
- **Action 批量**：Streamer 缓冲多条 Action 一次性发送

### 8.3 回调清理

- **单次回调即删**：Feature 回调执行后立即从 `_callbacks` 移除，避免内存泄漏
- **页面销毁清理**：destroyPage 时清除所有 callbacks 和 watchers

### 8.4 对自建框架的启示

如果你要做动态渲染框架的交互层：

1. **事件归一化**：Native 事件统一封装为 `{action, args}` 格式，JS 侧用路由表分发
2. **更新批处理**：不要每次 `setState` 就立即渲染，用微任务队列合并同一轮变更
3. **回调 ID 表**：跨进程/跨引擎通信的标准模式，必须实现
4. **updateFinish 信号**：Native 需要一个"本轮更新结束"的信号来触发布局和绘制
5. **Feature 抽象**：将 Native 能力封装为模块注册表（name → Java class），JS 侧按名字查找调用
