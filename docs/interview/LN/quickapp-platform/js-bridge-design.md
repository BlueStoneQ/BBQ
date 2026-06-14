# JS Bridge 设计 — 快应用的具体实现 + 业界对比

> 本文聚焦：快应用的 Bridge 是怎么设计的？和业界其他方案有什么区别？最佳实践是什么？

---

## 目录

- [1. 快应用 Bridge 的设计模式](#1-快应用-bridge-的设计模式)
- [2. 具体设计：两个方向的 Bridge](#2-具体设计两个方向的-bridge)
- [3. 快应用 Bridge 的设计特点](#3-快应用-bridge-的设计特点)
- [4. 业界 Bridge 设计演进](#4-业界-bridge-设计演进)
- [5. 快应用 vs RN vs Flutter 的 Bridge 设计对比](#5-快应用-vs-rn-vs-flutter-的-bridge-设计对比)
- [6. 业界最佳实践（2026）](#6-业界最佳实践2026)

---

## 1. 快应用 Bridge 的设计模式

快应用的 Bridge 本质是：

> **一个"全局入口函数" + JSON 协议 + 模块名路由 + 回调 ID 表**

```
┌─────────────────────────────────────────────────────────────┐
│                   快应用 Bridge 设计                          │
│                                                              │
│  JS → Native:                                               │
│    所有调用走同一个入口: global.JsBridge.invoke(              │
│      moduleName,    // "system.device"                       │
│      methodName,    // "getInfo"                             │
│      paramsJSON,    // '{"key":"brand"}'                     │
│      callbackId     // "42"                                  │
│    )                                                         │
│    → Java 侧根据 moduleName 路由到对应 Feature 类            │
│                                                              │
│  渲染指令走另一个入口: global.callNative(                     │
│      pageId,        // 页面 ID                               │
│      actionsJSON    // '[{method:"addElement",...}]'          │
│    )                                                         │
│    → Java 侧分发到 RenderActionManager                       │
│                                                              │
│  Native → JS:                                               │
│    事件: v8.executeVoidFunction("processCallbacks", [...])    │
│    回调: v8.executeVoidFunction("execInvokeCallback", {...})  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 具体设计：两个方向的 Bridge

### 2.1 JS → Native：两条通道

快应用把 JS→Native 分成了**两条独立通道**，职责分离：

| 通道 | External Function 名 | 用途 | 数据格式 |
|------|---------------------|------|---------|
| **渲染通道** | `callNative(pageId, actionsJSON)` | DOM 操作（创建/更新/删除 View） | Action 数组的 JSON |
| **能力通道** | `JsBridge.invoke(module, method, params, cbId)` | 调用 Native 能力（网络/存储/设备） | 参数的 JSON + 回调 ID |

**渲染通道的设计**（源码语义化）：

```javascript
// JS 侧 — Listener 生成 Action，Streamer 缓冲后发送
class RenderStreamer {
  send(pageId, actions) {
    // actions = [{module:"dom", method:"addElement", args:[...]}]
    global.callNative(pageId, JSON.stringify(actions))
  }
}
```

```java
// Java 侧 — 注册 callNative 为 External Function
v8.registerJavaMethod((receiver, params) -> {
    int pageId = params.getInteger(0);
    String actionsJson = params.getString(1);
    renderManager.dispatch(pageId, actionsJson);
}, "callNative");
```

**能力通道的设计**（源码语义化）：

```javascript
// JS 侧 — 所有 Feature 调用最终汇聚到这里
function invokeNativeFeature(moduleName, methodName, args, callbackId) {
    // 分离数据参数和回调函数
    let dataParams = extractData(args)
    let cbId = registerCallback(args.success, args.fail)

    // 通过同一个入口调用 Native
    global.JsBridge.invoke(
        moduleName,                    // "system.device"
        methodName,                    // "getInfo"  
        JSON.stringify(dataParams),    // 数据参数序列化
        cbId.toString()                // 回调 ID（不传函数，只传数字）
    )
}
```

```java
// Java 侧 — JsBridge.invoke 的实现
// 根据 moduleName 查找对应的 Feature Java 类
Extension ext = extensionManager.getExtension(moduleName);
// 调用对应方法
ext.invoke(methodName, params, callbackId);
// 异步执行完后回调 JS
jsThread.post(() -> {
    v8.executeVoidFunction("execInvokeCallback", 
        new Object[]{callbackId, resultJson});
});
```

### 2.2 Native → JS：两种触发方式

| 方式 | 函数名 | 触发场景 | 数据 |
|------|--------|---------|------|
| **事件批量推送** | `processCallbacks(pageId, events[])` | 触摸/滚动/手势 | `[{action:1, args:[ref, type, data]}]` |
| **Feature 回调** | `execInvokeCallback({callback, data})` | 异步 API 执行完毕 | `{callback: 42, data: {brand:"Xiaomi"}}` |

```java
// 事件推送（批量）
V8Array events = new V8Array(v8);
events.push(touchEvent);
events.push(scrollEvent);
v8.executeVoidFunction("processCallbacks", new Object[]{pageId, events});

// Feature 回调（单条）
V8Object result = new V8Object(v8);
result.add("callback", 42);
result.add("data", "{\"brand\":\"Xiaomi\"}");
v8.executeVoidFunction("execInvokeCallback", new Object[]{result});
```

---

## 3. 快应用 Bridge 的设计特点

| 特点 | 说明 | 利弊 |
|------|------|------|
| **单入口路由** | 所有 Feature 走同一个 `JsBridge.invoke`，靠 moduleName 字符串路由 | ✅ 简单，注册一次搞定；❌ 字符串匹配有开销 |
| **渲染和能力分离** | callNative 只管渲染，JsBridge.invoke 只管能力 | ✅ 职责清晰 |
| **JSON 协议** | 参数统一用 JSON 字符串 | ✅ 通用，调试友好（可读）；❌ 序列化开销 |
| **回调 ID 表** | 函数不跨层，只传数字 ID | ✅ 避免 GC 问题；❌ 异步，无法同步拿结果 |
| **同步 JNI 调用** | callNative/invoke 是同步的 | ✅ 可以同步返回简单结果；❌ Native 耗时会卡 JS 线程 |
| **批量 Action** | Streamer 缓冲 50 条渲染指令后一次性发送 | ✅ 减少跨层次数；❌ 首帧可能有延迟 |

---

## 4. 业界 Bridge 设计演进

```
2012  WebView Hybrid:
      → URL scheme 拦截（jsbridge://module/method?params=xxx）
      → 异步，无法返回值，有长度限制

2015  RN Old Architecture (BatchedBridge):
      → 异步消息队列，每 5ms flush 一批
      → JSON 序列化，全异步回调
      → 和快应用类似的"模块名路由"

2017  快应用 (J2V8):
      → 同步 JNI 直调（比 RN 快，可以同步 return）
      → 但仍然走 JSON 序列化
      → 单入口 + 模块名路由

2018  Flutter (Platform Channel):
      → 异步二进制消息（StandardMessageCodec）
      → 不是 JS 引擎方案，无 External Function 概念
      → Channel 名字路由

2022  RN New Architecture (JSI + TurboModules):
      → 每个 Native 模块是一个独立的 HostObject
      → JS 直接 nativeModule.method()，不走统一入口
      → 零序列化，同步返回
      → 类型安全（Codegen 生成绑定）
```

---

## 5. 快应用 vs RN vs Flutter 的 Bridge 设计对比

| 设计维度 | 快应用 | RN Old | RN New (JSI) | Flutter |
|---------|--------|--------|-------------|---------|
| **调用模式** | 单入口函数 + 模块名路由 | 单入口 + 模块名路由 | 每个模块独立 JS 对象 | Channel 名字路由 |
| **寻址方式** | `JsBridge.invoke("system.device", "getInfo")` | `NativeModules.Device.getInfo()` | `Device.getInfo()` (HostObject) | `MethodChannel("device").invokeMethod("getInfo")` |
| **参数格式** | JSON 字符串 | JSON 字符串 | jsi::Value（引擎内部类型） | 二进制 Codec |
| **同步/异步** | 同步（可 return） | 异步（必须 callback） | 同步（可 return） | 异步（必须 await） |
| **批量优化** | Streamer 50 条合并 | BatchedBridge 5ms 合并 | 不需要（单条够快） | 无 |
| **类型安全** | 无（全靠 JSON 字符串） | 无 | Codegen 生成类型 | Codec 有类型 |
| **回调方式** | 回调 ID 表 | 回调 ID 表 | 直接同步 return | Future/回调 |

---

## 6. 业界最佳实践（2026）

### 6.1 设计原则

| 原则 | 说明 | 快应用是否遵循 |
|------|------|--------------|
| **每个模块独立暴露** | 不走"大一统入口"，每个 Native 模块是独立 JS 对象 | ❌ 走的单入口路由 |
| **类型安全** | 参数有类型约束，编译期检查 | ❌ 全是 JSON 字符串 |
| **零序列化** | 跨层不做 JSON 序列化 | ❌ 必须 stringify |
| **同步优先** | 能同步返回就不走异步 | ✅ JNI 是同步的 |
| **渲染和逻辑分离** | 渲染指令和 Feature 调用走不同通道 | ✅ callNative vs JsBridge.invoke |

### 6.2 如果从零设计 Bridge（2026 最佳实践）

```
推荐设计:

1. 每个 Native 模块注册为独立的 JS 全局对象（External Object）
   → JS: Device.getInfo()  而不是  Bridge.invoke("device", "getInfo")
   → 好处: 无字符串路由、IDE 可以自动补全、类型安全

2. 参数传递:
   → 基本类型: 值拷贝（引擎直接支持）
   → 对象: Handle 共享（JSI）或 JSON（JNI 方案的 fallback）

3. 结果回传:
   → 同步方法: 直接 return
   → 异步方法: 返回 Promise（而不是 callback ID）
   → 订阅型: 注册 listener 对象

4. 渲染通道:
   → 如果用 JSI: 直接操作 Shadow Tree（C++ 共享内存）
   → 如果用 JNI: 保持 JSON 批量（快应用的方案仍然合理）

5. 类型安全:
   → Codegen 从 IDL/Schema 自动生成 JS 侧类型声明 + Native 侧绑定代码
```

### 6.3 快应用方案在什么场景下仍然合理

虽然不是"最佳实践"，但快应用的设计在以下场景仍然适用：

- **团队 Java/Kotlin 为主**，不想写 C++
- **Android only**，不需要跨 iOS
- **稳定性优先**，不追求极致性能
- **快速验证 MVP**，2-3 周出原型
- **JS 引擎用 QuickJS**（QuickJS 没有 JSI，只能走 JNI + JSON 方案）
