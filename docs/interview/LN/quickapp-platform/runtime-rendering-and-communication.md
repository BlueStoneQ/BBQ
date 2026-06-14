# QuickApp Runtime — 渲染流程与通信机制

> 本文聚焦运行时：一个快应用页面从 JS 执行到屏幕像素，中间经历了哪些步骤？各层如何通信？

---

## 1. 全景流程：从用户点击到页面渲染

```
用户点击入口
  → Android 启动 Activity
  → 创建 JS 线程，加载 V8/QuickJS 引擎
  → 执行 infras.js（调用 global.initInfras()）
  → Native 调用 registerModules()（注册 Feature 能力表）
  → Native 调用 registerManifest()（注册 App 清单）
  → Native 调用 locateDsl()（加载 dsl-xvm.js）
  → Native 调用 createApplication(appId, appCode)
  → Native 调用 createPage(pageId, appId, pageCode, query, intent, meta)
  → DSL 解析模板 → 构建 VDom → Listener 收集 Action → Streamer 批量发送
  → Native 接收 Action[] → 创建 Native View → 布局 → 绘制
```

---

## 2. 初始化阶段详解

### 2.1 initInfras() — 框架启动

```javascript
// src/infras/entry/main/index.js
function initInfras() {
  // 1. Platform 层初始化（console/profiler/timer/router 注入）
  platform.init()
  exposeToNative(platform.exposure)  // registerModules, registerManifest...

  // 2. Runtime 层初始化（冻结 DOM 原型，防止运行时篡改）
  runtime.init()
  exposeToNative(runtime.exposure)   // registerComponents

  // 3. Dock 层初始化（连接 platform + runtime + dock）
  dock.init(glue)
  exposeToNative(dock.exposure)      // createApplication, createPage, processCallbacks...

  // 4. 注册延迟加载的 Bundle
  platform.defineBundle('parser')    // HTML 解析器
  platform.defineBundle('canvas')    // Canvas 支持
  platform.defineBundle('animation') // Animation API
}
```

核心设计：**initInfras 把各层的关键函数挂到 `global` 上**，Native 就能直接通过 JNI 调用这些全局函数。

### 2.2 Bootstrap — Native 调用路由

`bootstrap.js` 将所有 Native 可调用的函数注册到一个 `methodMap` 中：

```
Native 调用 global.createApplication(id, code)
  → methodMap['createApplication'](id, code)
  → 查找 _appMap[id]，如不存在则创建
  → 转发到 _frameworks['xFramework'].createApplication(id, code)
  → 即 dock.createApplication()
```

**设计意图**：bootstrap 是一个路由层，让 Native 无需知道具体的 DSL 框架是什么，只调用统一的 API。

---

## 3. 渲染流程详解

### 3.1 页面创建 — createPage

```
dock.createPage(pageId, appId, pageCode, query, intent, meta)
  │
  ├─ new XPage(id, app, intent, meta, query)  // 创建页面实例
  │    └─ 页面拥有 doc（Document 对象），doc 拥有 listener
  │
  ├─ makeTimer(page, callback, normalize)  // 创建 setTimeout/setInterval
  │
  └─ config.publish(APP_KEYS.initPage, [page, code, query, globals])
       │
       └─ DSL 层订阅了 initPage 事件
            └─ xvm/page/interface.js → initPage()
                 ├─ 解析 pageCode（$app_define$ 注册组件定义）
                 ├─ 执行 $app_bootstrap$（实例化根组件 VM）
                 ├─ VM 的 template 通过 compiler 编译为 DOM 操作
                 └─ DOM 操作触发 Listener → 生成 Action
```

### 3.2 VDom → Action — Listener 的工作

Listener 是 DOM 和 Native 之间的桥梁。每当 VDom 发生变更，Listener 生成一条 Action：

```javascript
// 一条 Action 的结构
{
  module: 'dom',
  method: 'addElement',    // 或 removeElement / updateAttrs / updateStyle
  args: [parentRef, nodeJSON, index]
}
```

**Listener 支持的操作**：

| 方法 | 含义 | 对应 Native 操作 |
|------|------|-----------------|
| `createBody(node)` | 创建页面 body | 初始化 View 树根节点 |
| `addNode(node, parent, index)` | 添加子节点 | ViewGroup.addView() |
| `removeNode(node)` | 删除节点 | ViewGroup.removeView() |
| `moveNode(node, parent, index)` | 移动节点 | remove + add |
| `setAttr(ref, key, value)` | 更新属性 | Widget.setAttr() |
| `setStyle(ref, key, value)` | 更新样式 | Widget.setStyle() → Yoga 重新布局 |
| `addEvent(ref, type)` | 注册事件监听 | 设置 touch/click listener |
| `createFinish()` | 页面首次渲染完成 | 触发 onShow 生命周期 |
| `updateFinish()` | 一轮更新完成 | 触发 nextTick 回调 |

### 3.3 批量发送 — Streamer 的缓冲策略

```javascript
class Streamer {
  constructor(call, batchThreshold = 50) {
    this.call = call           // 最终调用 callNative 的函数
    this.batchThreshold = 50   // 每满 50 条发送一批
    this.list = []             // 缓冲区
  }

  push(id, actions) {
    this.list.push(...actions)
    // 超过阈值，分批发送
    while (this.list.length >= this.batchThreshold) {
      const batch = this.list.splice(0, this.batchThreshold)
      this.call(id, batch)  // → callNative(pageId, actions)
    }
  }

  over(id, finalActions) {
    // 发送剩余 + 结束标记（createFinish / updateFinish）
    if (this.list.length) {
      this.call(id, this.list)
      this.list.splice(0)
    }
    this.call(id, finalActions)
  }
}
```

**为什么要批量？**
- 每次 callNative 都是一次 JNI 跨线程调用
- 一个复杂页面首次渲染可能产生数百条 Action
- 逐条发送 = 数百次 JNI 调用，开销巨大
- 批量 50 条一次 = 只需几次 JNI 调用

**结束信号**：每轮 DOM 操作完毕后，Listener 发送 `createFinish` 或 `updateFinish`，Native 收到后知道本轮渲染完成，可以做一次完整的布局和绘制。

---

## 4. 通信机制详解

### 4.1 JS → Native（渲染指令 + Feature 调用）

```
┌─────────────────────────────────────────────────────┐
│                    JS 线程                           │
│                                                     │
│  DOM 操作 → Listener.addNode() → Streamer.push()    │
│                                    │                │
│  Feature调用 → invokeNative(module, method, args)   │
│                       │                             │
└───────────────────────┼─────────────────────────────┘
                        │ JNI: callNative(pageId, actions[])
                        ▼
┌─────────────────────────────────────────────────────┐
│                  Native (Java)                       │
│                                                     │
│  渲染指令 → RenderActionManager → IO线程解析         │
│          → VDomActionApplier → Widget 创建/更新      │
│                                                     │
│  Feature → ExtensionManager.invoke()                 │
│         → 查找对应 Feature Java 类 → 执行            │
└─────────────────────────────────────────────────────┘
```

### 4.2 Native → JS（事件回调 + 生命周期）

```
用户触摸屏幕
  → Android onTouchEvent
  → Native 封装事件: {action: 1, args: [ref, eventType, eventData]}
  → JNI 调用 global.processCallbacks(pageId, events[])
  → dock.processCallbacks() 根据 action 类型分发:
       action=1 → fireEvent(page, ref, type, data) → 触发 VM 事件处理函数
       action=2 → callback(page, callbackId, data) → 触发 Feature 回调

Feature 回调示例：
  → Native: Device.getInfo() 执行完毕
  → Native: jsThread.post("execInvokeCallback", {cbId: 42, data: {brand:"Xiaomi"}})
  → JS: execInvokeCallback → 从 _callbacks[42] 取出回调函数执行
```

### 4.3 回调 ID 映射机制

这是跨端通信的核心模式：**函数引用不能跨 V8 边界传递，所以用数字 ID 替代**。

```
JS 侧：
  let callbackId = 0
  const _callbacks = {}

  function invokeNative(module, method, args, success, fail) {
    const cbId = callbackId++
    _callbacks[cbId] = { success, fail }
    // 只传 cbId 给 Native，不传函数引用
    callNative(module, method, args, cbId)
  }

Native 侧执行完毕后：
  callJs("execInvokeCallback", { cbId: cbId, data: result })

JS 侧收到回调：
  function execInvokeCallback({ cbId, data }) {
    const cb = _callbacks[cbId]
    cb.success(data)
    delete _callbacks[cbId]  // 释放引用
  }
```

---

## 5. 生命周期通信

### 5.1 App 生命周期

```
Native                          JS (dock)                    JS (DSL/xvm)
  │                               │                            │
  │── createApplication(id,code)─→│                            │
  │                               │── new XApp(id) ──────────→ │
  │                               │── publish(initApp) ──────→ │── 执行 app.js
  │                               │                            │
  │── onShowApplication(id) ────→ │                            │
  │                               │── app._emit('applc:onShow')│
  │                               │                            │
  │── onHideApplication(id) ────→ │                            │
  │                               │── app._emit('applc:onHide')│
  │                               │                            │
  │── destroyApplication(id) ───→ │                            │
  │                               │── destroyApp(app) ────────→│── 清理资源
```

### 5.2 Page 生命周期

```
Native                          JS (dock)                    JS (DSL/xvm)
  │                               │                            │
  │── createPage(id,...) ────────→│                            │
  │                               │── new XPage(id,...) ─────→ │
  │                               │── publish(initPage) ─────→ │── 编译模板
  │                               │                            │── 构建 VDom
  │                               │                            │── Listener 生成 Actions
  │←── callNative(actions[]) ─────│                            │
  │                               │                            │
  │── changeVisiblePage(id,true)─→│                            │
  │                               │── publish(onShow) ───────→ │── 开发者 onShow()
  │                               │                            │
  │── processCallbacks(id,evts)──→│                            │
  │                               │── fireEvent(page,...) ───→ │── 开发者事件处理
  │                               │                            │── 数据变更
  │                               │                            │── Watcher 触发
  │                               │                            │── VDom diff
  │                               │                            │── Listener 生成新 Actions
  │←── callNative(actions[]) ─────│                            │
  │                               │                            │
  │── destroyPage(id) ──────────→ │                            │
  │                               │── publish(destroyPage) ──→ │── 清理 VM
```

---

## 6. Pubsub 事件总线 — 层间解耦

dock 和 DSL 之间通过 `config`（基于 Pubsub）进行通信，而非直接函数调用：

```javascript
// dock 层发布事件
config.publish(APP_KEYS.initPage, [page, code, query, globals])

// DSL 层订阅事件
quickapp.subscribe(APP_KEYS.initPage, args => {
  return initPage(...args)
})
```

**好处**：
- dock 层不 import 任何 DSL 代码
- DSL 可以替换（xvm 或 vue），dock 层无需修改
- 事件名统一定义在 `src/shared/events.js`

---

## 7. 数据更新流（响应式渲染）

当用户交互触发数据变更时：

```
1. Native 触摸事件 → processCallbacks → fireEvent
2. DSL 层触发开发者的事件处理函数（如 onClick）
3. 开发者修改 this.xxx = newValue
4. Observer 拦截 set → 通知关联的 Watcher
5. Watcher 触发组件 re-render
6. compiler 重新执行模板函数，产生新 VDom
7. diff 旧 VDom，产生最小 DOM 操作
8. Listener 将 DOM 操作转为 Action（updateAttrs / updateStyle）
9. Streamer 批量发送给 Native
10. Native updateFinish → 重新布局 + 绘制
```

---

## 8. 关键文件速查

| 你想看... | 文件位置 |
|-----------|---------|
| 初始化入口 | `core/framework/src/infras/entry/main/index.js` |
| Native ↔ JS 的函数注册 | `core/framework/src/infras/dock/bootstrap.js` |
| App/Page 全生命周期管理 | `core/framework/src/infras/dock/interface.js` |
| 渲染 Action 生成 | `core/framework/src/infras/runtime/listener.js` |
| Action 批量缓冲 | `core/framework/src/infras/runtime/streamer.js` |
| DSL 层事件订阅 | `core/framework/src/dsls/xvm/interface.js` |
| 响应式数据劫持 | `core/framework/src/dsls/xvm/vm/observer.js` |
| 依赖收集与更新 | `core/framework/src/dsls/xvm/vm/watcher.js` |
| 模板编译 | `core/framework/src/dsls/xvm/vm/compiler.js` |
| Platform 能力注册 | `core/framework/src/infras/platform/interface.js` |

---

## 9. 对动态渲染框架设计的启示

从这套架构中可以提取的核心设计模式：

1. **Listener/Streamer 模式**：DOM 变更收集 + 批量传输，适用于任何"逻辑层和渲染层分离"的场景
2. **回调 ID 映射**：跨进程/跨引擎通信时，函数不可序列化，用 ID 表替代
3. **Pubsub 解耦**：框架核心（dock）与上层 DSL 通过事件总线解耦，支持多 DSL 共存
4. **Bootstrap 路由表**：将 API 集中注册为全局函数，Native 无需知道内部分层
5. **Platform 抽象层**：资源加载、模块注册、BroadcastChannel 等对 Native 的依赖集中封装，方便移植到不同宿主
