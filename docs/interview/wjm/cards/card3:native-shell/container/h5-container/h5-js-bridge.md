# 高性能 H5 JS Bridge 设计

> 基础设计详见 → [H5 WebView JS Bridge 基础设计](./old/h5-js-bridge.md)

## 目录

- [高性能设计总览](#高性能设计总览)
- [基础设计](#本质前言)
  - [本质前言](#本质前言)
  - [Js call Native](#js-call-native)
    - [Android侧](#android侧)
    - [iOS侧](#ios侧)
    - [JS侧](#js侧)
  - [Native call Js(event)](#native-call-jsevent)
    - [Android侧](#android侧-1)
    - [iOS侧](#ios侧-1)
    - [JS侧](#js侧-1)
- [QA](#qa)
  - [Q1: iOS 限制 → 为什么都走消息分发？](#q1)
  - [Q2: Android 和 iOS 怎么给 WebView 注入 Bridge？](#q2)
  - [Q3: Bridge 协议怎么设计？](#q3)
  - [Q4: SDK 层缓存是什么？怎么做？](#q4)
  - [Q5: 为什么不像 RN 那样逐个注入 external function？](#q5)
  - [Q6: iOS 的 messageHandlers 具体做不到什么？](#q6)
  - [Q7: bridge:native侧的线程模型？](#q7)
  - [Q8: Bridge 通道本身必须在主线程吗？](#q8)

---

## 高性能设计总览

| # | 优化点 | 具体做法 | 收益 |
|---|--------|---------|------|
| 1 | **通道选型** | [Android: `@JavascriptInterface` / iOS: `messageHandlers`](#q2-android-和-ios-侧怎么给-webview-注入-bridge) | 避免 iframe 创建开销 |
| 2 | **协议设计** | [短字段名 + 固定结构 + 大文件只传路径](#q3-bridge-协议怎么设计业界最佳实践--举例) | 减少序列化体积 |
| 3 | **批处理** | [微任务内多次调用合并一次发送](#q1-由于-ios-的限制两个平台都走协议消息分发模式js-侧会比较重吗ios-限制的底层逻辑是什么) | 减少跨层通信次数 |
| 4 | **SDK 层缓存** | [高频只读数据缓存在 bridge:js侧内存](#q4) | 减少不必要的 Bridge 调用 |
| 5 | **Native 线程模型** | [耗时操作派子线程，回调 JS 回主线程](#q7) | 避免阻塞 UI |

---


<a id="q1"></a>
### Q1: 由于 iOS 的限制，两个平台都走协议(消息)分发模式，bridge:js侧会比较重吗？iOS 限制的底层逻辑是什么？
```
me: 由于IOS的限制, 其实两个平台都走的是协议(消息)分发的模式, 这个模式js侧会比较重吗? IOS限制的底层逻辑是因为: IOS中web view 是在一个单独的进程(沙箱)中?
```

**iOS 限制的底层逻辑：是的，WKWebView 的 JS 跑在独立进程（WebContent Process）, 所以无法注册external function。(内存是独立的, 也就是所谓的沙箱, 所以拿不到func的引用注入到js内存)**

```
iOS WKWebView 架构：

App 主进程                     WebContent 进程（独立沙箱）
┌──────────────┐              ┌──────────────┐
│ Native 代码   │ ← Mach IPC → │ JS (JSCore)  │
│ WKWebView API │  （异步）     │ H5 页面渲染   │
└──────────────┘              └──────────────┘
```

- **跨进程** → 天然异步，无法同步返回值
- **跨进程** → 无法传递函数引用（只能传序列化数据）
- **跨进程** → 每次通信都有 IPC 开销（微秒级，但累积可感知）

所以即使 Android 技术上可以 `@JavascriptInterface` 同步直调(通过external Function)，为了**双端统一**，实际工程都走消息分发模式。

**bridge:js侧重不重？**

不算重。bridge:js侧的 Bridge SDK 核心就三样东西：

```
1. 一个 Map<callbackId, callback>（回调映射）
2. 一个调用消息队列 + 微任务注册器（批处理）
3. 一个 callNative 函数（序列化 + 发送）
4. 一个 invokeCallback 函数（Native 回调入口）
```

"重"的部分是可选的优化层（批处理/队列/缓存），不加也能跑，加了更快。核心 Bridge 本身非常轻量（< 1KB gzip）。

真正的性能瓶颈不在 bridge:js侧代码量，而在：
1. **序列化开销**：大对象 JSON.stringify 耗时
2. **IPC 延迟**：iOS 跨进程通信的固有延迟（~0.1-1ms/次）
3. **通信频次**：高频调用累积（所以需要批处理）

---
---


<a id="q2"></a>
### Q2: Android 和 iOS 侧怎么给 WebView 注入 Bridge？

**核心思路**：
- **Android**：注入一个 Java 对象到 JS 全局，对象上挂一个 `callNative(json)` 方法作为统一消息入口
- **iOS**：注册一个消息处理器，JS 通过 `postMessage` 发消息给 Native

> 本质上两端做的是同一件事：提供一个消息接收入口，接收序列化的调用信息后分发。区别只是 Android 底层能同步返回，iOS 不能（跨进程）。工程设计上统一走消息分发模式。

---

#### Android：`addJavascriptInterface`

```kotlin
// ─── Android (Kotlin) ───
// 1. 定义 Bridge 对象
class NativeBridge {
    @JavascriptInterface
    fun callNative(json: String): String {
        // 解析 json → 分发到对应模块 → 返回结果
        return handleRequest(json)
    }
}

// 2. 注入到 WebView（一行代码）
webView.addJavascriptInterface(NativeBridge(), "nativeBridge")

// 3. bridge:js侧直接调用（同步）
// const result = nativeBridge.callNative('{"module":"device","method":"getToken"}')
```

Native 回调 JS（异步结果）：
```kotlin
// ─── Android (Kotlin) ───
webView.evaluateJavascript(
    "window.bridge.invokeCallback('cb_123', {\"token\":\"abc\"})", //  bridge:js侧会维护一个Map<callbackId, result>
    null
)
```

---

#### iOS：`WKScriptMessageHandler`

```swift
// ─── iOS (Swift) ───
// 1. 注册消息处理器
let config = WKWebViewConfiguration()
config.userContentController.add(self, name: "nativeBridge")
let webView = WKWebView(frame: .zero, configuration: config)

// 2. 接收 JS 消息
extension ViewController: WKScriptMessageHandler {
    func userContentController(_ uc: WKUserContentController, didReceive msg: WKScriptMessage) {
        // msg.body = JS 传过来的数据（字典/字符串）
        let request = msg.body as! [String: Any]
        handleRequest(request)
    }
}

// 3. bridge:js侧调用（异步，无返回值）
// window.webkit.messageHandlers.nativeBridge.postMessage({module:"device", method:"getToken", callbackId:"cb_123"})
```

Native 回调 JS（异步结果）：
```swift
// ─── iOS (Swift) ───
webView.evaluateJavaScript(
    "window.bridge.invokeCallback('cb_123', {\"token\":\"abc\"})"
)
```

---

#### 对比

| | Android | iOS |
|--|---------|-----|
| 注入方式 | `addJavascriptInterface(obj, name)` | `userContentController.add(handler, name)` |
| JS 调用方式 | `nativeBridge.callNative(json)` | `messageHandlers.nativeBridge.postMessage(obj)` |
| 同步返回 | ✅ 方法直接 return | ❌ 只能通过 evaluateJavaScript 回调 |
| 底层原因 | 同一进程，V8 直调 Java | 跨进程 IPC，天然异步 |

**补充 1：双端统一抹平 → bridge:js侧封装为 Promise**

Android 虽然能同步 return，但实际工程中不用返回值——统一走 `evaluateJavascript` 回调 + callbackId，这样双端逻辑一致，bridge:js侧只维护一套 Promise 封装：

js侧:

```javascript
// Bridge SDK 内部（双端一致）
function callNative(module, method, params) {
  return new Promise((resolve) => {
    const callbackId = genId();
    callbackMap.set(callbackId, resolve);
    nativeBridge.callNative(JSON.stringify({ module, method, params, callbackId }));
  });
}

// 业务代码
const token = await callNative('auth', 'getToken', {});
```

**补充 2：Swift `extension` 语法说明**

```swift
extension ViewController: WKScriptMessageHandler { ... }
```

= 让 ViewController 实现 WKScriptMessageHandler 协议（接口）。等价于 Kotlin 的 `class ViewController : WKScriptMessageHandler`。纯代码组织方式，不是特殊机制。


---

<a id="q3"></a>
### Q3: Bridge 协议怎么设计？业界最佳实践 + 举例

**最佳实践 = JSON + 精简字段 + 固定结构**。没有人在 H5 WebView Bridge 里用 Protobuf/MessagePack（引入成本远大于收益）。

**设计原则**：
1. 固定结构（bridge:native侧解析零犹豫）
2. 字段最少化（只有必须的）
3. JSON 格式（双端原生支持，无额外依赖）

> **"固定结构"的含义**：每次调用的 JSON 字段名和嵌套层级都是固定的，bridge:native侧可以硬编码解析逻辑（直接取 `json["id"]`、`json["m"]`），不需要动态判断"这次有没有某个字段"。固定结构 = 解析代码零分支、零容错，性能最好。

**协议举例**：（微信/支付宝 JS-SDK 的通用模式）

```javascript
// ─── 请求（bridge:js侧 → bridge:native侧）───
{
  "id": "cb_1719000001_a3f",  // callbackId
  "m": "device",              // module
  "f": "getLocation",        // function
  "p": { "accuracy": "high" } // params
}

// ─── 响应（bridge:native侧 → bridge:js侧）───
{
  "id": "cb_1719000001_a3f",  // 对应请求的 callbackId
  "c": 0,                    // code（0=成功）
  "d": { "lat": 39.9, "lng": 116.4 },  // data
  "e": ""                    // error（失败时有值）
}
```

**协议层能做的优化（不只是精简）**：

| 方向 | 做法 | 适用场景 |
|------|------|---------|
| 精简字段 | 短 key（m/f/p/c/d） | 所有场景（默认做） |
| 大文件不走 Bridge | Bridge 只传文件路径/URI，Native 侧直接读取上传 | 图片/文件/音视频 |
| 增量传输 | 只传 diff（需双方各持有上一次状态作基准） | 高频状态同步（极少用） |

> **大文件为什么不走 Bridge**：`@JavascriptInterface` 和 `postMessage` 只支持字符串/JSON，不能直传 ArrayBuffer。大文件走 Base64 会膨胀 33%。所以实际做法是 Bridge 只传一个路径字符串，Native 端自己去读文件处理。
>
> **增量传输**：H5 Bridge 大部分调用是独立的请求/响应，不存在"上一次状态"。只有高频持续同步（实时位置流、Canvas 绘制指令）才需要 diff，这在 H5 Bridge 里极少见。
>
> **压缩不适用**：Bridge 调用的 JSON payload 通常只有几十~几百字节，gzip 头部开销本身就有十几字节，压缩没有收益。

> Protobuf/MessagePack 在 H5 Bridge 场景 ROI 不高：双端都要额外引解析库，JSON 在 WebView 里已经是原生支持零成本。

---

<a id="q4"></a>
### Q4: SDK 层缓存是什么？怎么做？

**不是协议层的事，是 bridge:js侧 SDK 的封装策略——减少不必要的 Bridge 调用。**

```javascript
// bridge:js侧 SDK 内部
const cache = new Map();

async function getToken() {
  if (cache.has('token')) return cache.get('token'); // 命中 → 不走 Bridge
  const token = await callNative('auth', 'getToken', {});
  cache.set('token', token);
  return token;
}
```

**适用场景**：页面生命周期内不会变的数据

| 数据 | 为什么能缓存 |
|------|------------|
| token / userId | 登录态在页面内不变 |
| deviceInfo（机型/OS） | 设备信息永远不变 |
| App 版本号 | 不变 |
| 用户权限/配置 | 页面内不变 |

**不适用**：每次结果不同的（getLocation、网络请求、时间戳）。

**缓存失效策略**：TTL 过期 / 页面卸载清空 / 登录态变化时清空。

**缓存位置**：JS 堆内存（Map），不是 localStorage。页面关闭 → JS 上下文销毁 → 缓存自动没了。生命周期 = WebView 页面存活期间，不是整个 App 存活期间。

---
---

## 本质前言

**JS → Native 方向**：JS 调用 Native 时，Bridge:JS 侧用任务队列保证调用的有序性和并发控制，然后通过 Native 注入的 external function（`callNative`）把调用信息（module + method + params + callbackId）发送到 Native 侧。任务队列**只保证调用顺序，不保证返回顺序**。

**Native → JS 方向**：Native 异步处理完成后，通过 `evaluateJavascript` 把结果 + callbackId 发回 JS。Bridge:JS 侧根据 callbackId 在 `Map<callbackId, callback>` 中查找对应的回调函数并执行。返回顺序由 Native 处理速度决定，与调用顺序无关。

**为什么不像 RN 那样每个 Native API 都注入成 external function？** 因为 WebView 不暴露 JS 引擎实例，`addJavascriptInterface` 只能注入一个对象（不是任意函数），iOS `messageHandlers` 更是只提供消息通道。所以只能注入一个统一入口 + 协议分发。

```
    - Js call Native
        - android侧
        - IOS侧
        - JS侧
    - Native call Js(event)
        - android侧
        - IOS侧
        - JS侧
```

## Js call Native

### Android侧

```java
// ─── Android ───
// addJavascriptInterface 的本质：
// 把 Java 对象 bridge 挂载到 WebView 内 JS 引擎的 global 对象上
// 即 JS 全局空间出现了 window.nativeBridge，上面的 @JavascriptInterface 方法变成 JS 可调用的函数
// 效果等同于：global.nativeBridge = { getToken: () => "abc123" }

// 1. 定义要挂载到JS内存空间中gloabal上的 external object(js引擎寻址会找到java这边的JsBridge引用, 底层webview通过反射来调用JAVA/IOS)
class JsBridge {
    @JavascriptInterface  // 注解标记哪些方法暴露给 JS（安全控制，未标记的不暴露）
    public String getToken() { return "abc123"; } // JS 调用时同步返回
}

JsBridge bridge = new JsBridge();  // 创建 bridge 实例

// 2. 挂载JsBridge 到 js内存空间(global上)
webView.addJavascriptInterface(bridge, "nativeBridge");  
```

### iOS侧
- 核心部件: window.webkit.messageHanlers.postMessage

> iOS WKWebView 天然注入 `window.webkit` 到 JS 全局。开发者通过 `userContentController.add(handler, name)` 注册自定义消息处理器后，JS 就能用 `window.webkit.messageHandlers.<name>.postMessage(...)` 发消息。

**1. 注册消息处理器 + 接收消息**：
```swift
// ─── iOS (Swift) ───
// 创建 WKWebView 时注册 handler
// WebView 的配置对象（创建 WebView 前设置好各种选项）
let config = WKWebViewConfiguration() 
// 管理 JS↔Native 消息通道的控制器（注册 handler、注入脚本）
let userContentController = WKUserContentController() 

// 注册消息处理器：
// - self = 当前 ViewController（实现了 WKScriptMessageHandler 协议，即消息接收者）
// - "nativeBridge" = 注册名。注册后 JS 中才出现 window.webkit.messageHandlers.nativeBridge
//   （window.webkit.messageHandlers 是 WKWebView 天然注入的，但 .nativeBridge 需要这行注册才有）
// 效果：告诉 WKWebView「当 JS 调 postMessage 时，把消息发给 self 的 didReceive 方法处理」
userContentController.add(self, name: "nativeBridge")
config.userContentController = userContentController

let webView = WKWebView(frame: .zero, configuration: config)

// 接收 JS 发来的消息
extension ViewController: WKScriptMessageHandler {
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeBridge",
              let body = message.body as? [String: Any] else { return }
        // body = JS postMessage 传过来的数据
        handleJSBridgeRequest(body)
        // ↑ 内部做的事：
        // 1. 解析协议包（module + method + params + callbackId）
        // 2. 根据 module 从注册表找到对应 handler
        // 3. handler 自行决定线程策略（轻量直接做，耗时派发共享线程池）
        // 4. 处理完后调 callbackToJS(callbackId, result)
    }
}
```

**2. URL Scheme 拦截（兜底）**：
```swift
// ─── iOS (Swift) ───
func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if let url = navigationAction.request.url,
       url.scheme == "jsbridge" {
        handleJSBridgeUrl(url)
        decisionHandler(.cancel)
        return
    }
    decisionHandler(.allow)
}
```

**3. Native 回调 JS（evaluateJavaScript）**：
```swift
// ─── iOS (Swift) ───
func callbackToJS(callbackId: String, result: [String: Any]) {
    let jsonString = // 转换为 JSON 字符串
    let js = "window.bridge.invokeCallback('\(callbackId)', \(jsonString));"
    webView.evaluateJavaScript(js) { (_, error) in
        if let error = error { print("JS 回调失败: \(error)") }
    }
}
```

### JS侧
```javascript
// ─── bridge:js侧 SDK 实现（抹平双端差异）───
// 业务代码统一调用这一个函数，不感知底层是 Android 还是 iOS
function callNative(module, method, params) {
  return new Promise((resolve) => {
    const callbackId = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    callbackMap.set(callbackId, resolve);

    const message = JSON.stringify({ m: module, f: method, p: params, id: callbackId });

    // 这里用的特征判断
    if (window.nativeBridge) {
      // Android: 走 @JavascriptInterface 注入的对象
      window.nativeBridge.callNative(message);
    } else if (window.webkit?.messageHandlers?.nativeBridge) {
      // iOS: 走 messageHandlers 消息通道
      window.webkit.messageHandlers.nativeBridge.postMessage(message);
    }
    // 两端最终都通过 evaluateJavascript 回调：
    // window.bridge.invokeCallback(callbackId, result)
  });
}

// Native 回调入口（双端统一，由 Native 通过 evaluateJavascript 调用）
window.bridge = {
  invokeCallback(callbackId, result) {
    const resolve = callbackMap.get(callbackId);
    if (resolve) {
      resolve(result);
      callbackMap.delete(callbackId);
    }
  }
};

// ─── 业务代码调用（双端一致）───
const token = await callNative('auth', 'getToken', {});
```

## Native call Js(event)

Native 主动通知 JS：通过 `evaluateJavascript` 执行一段 JS 代码，调用 bridge:js侧预先注册的事件监听回调。

```
Native 有事发生（网络变化/推送到达/前后台切换）
  → evaluateJavascript("bridge.emit('eventName', data)")
  → bridge:js侧 发布订阅分发给对应监听函数
```

### Android侧

```kotlin
// ─── Android (Kotlin) ───
// Native 主动推送事件给 JS
fun emitEvent(eventName: String, data: String) {
    mainHandler.post {  // 必须主线程
        webView.evaluateJavascript(
            "window.bridge.emit('$eventName', $data)", null
        )
    }
}

// 使用：网络状态变化时通知 H5
emitEvent("networkChange", """{"type":"wifi"}""")
```

### iOS侧

```swift
// ─── iOS (Swift) ───
func emitEvent(_ eventName: String, data: String) {
    DispatchQueue.main.async {  // 必须主线程
        self.webView.evaluateJavaScript(
            "window.bridge.emit('\(eventName)', \(data))"
        )
    }
}
```

### JS侧

```javascript
// ─── bridge:js侧 发布订阅 ───
const listeners = new Map(); // { eventName: [cb1, cb2, ...] }

window.bridge.on = (event, callback) => {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(callback);
};

window.bridge.emit = (event, data) => {
  listeners.get(event)?.forEach(cb => cb(data));
};

// 业务使用
bridge.on('networkChange', (data) => {
  console.log('网络变化:', data.type);
});
```

## QA

<a id="q5"></a>
### Q5: 为什么 H5 WebView 不像 RN 那样，每个 Native API 直接注入成 external function？

**根本原因：WebView 不暴露 JS 引擎实例，无法逐个注入函数。**

| | RN (JSI) / 快应用 (J2V8) | H5 WebView |
|--|--------------------------|------------|
| 引擎访问权 | **直接持有** V8/Hermes 实例 | 引擎被 WebView 封装，**不暴露** |
| 注入方式 | 逐个注入任意函数到 global | 只能注入**一个 Java 对象**（`addJavascriptInterface(obj, name)`） |
| 注入粒度 | 函数级（HostFunction / registerJavaMethod） | 对象级（对象上所有 `@JavascriptInterface` 方法） |
| 动态性 | 运行时随时注入新函数 | 注入时机受限，编译时确定 |
| iOS 能力 | — | `messageHandlers` 只提供异步消息通道，连同步返回都没有 |

**设计妥协**：只注入一个 `callNative` 入口（桥梁），JS 通过这一个入口传 module + method + params，Native 侧再分发。

**如果硬要每个 API 都注入的后果**：
1. 每加一个能力就要改 Java/Swift 代码 + 重编译 App
2. 全局命名空间污染
3. 无法做统一的权限管控/日志/限流
4. iOS 根本做不到（见下一个 Q）

---

<a id="q6"></a>
### Q6: iOS 的 messageHandlers 具体做不到什么？

**iOS WKWebView 的 `messageHandlers` 本质只是一个单向异步消息通道，不是函数注入。**

| 能力 | Android `@JavascriptInterface` | iOS `messageHandlers` |
|------|-------------------------------|----------------------|
| 同步返回值 | ✅ JS 调用直接拿到 return 值 | ❌ 只能异步回调 |
| 注入多个方法 | ✅ 对象上多个 `@JavascriptInterface` 方法 | ❌ 只注册一个 name，只有 `postMessage` 一个入口 |
| JS 侧调用方式 | `nativeBridge.getToken()` → 直接返回 | `window.webkit.messageHandlers.bridge.postMessage(msg)` → 无返回值 |
| 传递函数引用 | ❌（但方法可同步返回） | ❌（跨进程，无法传引用） |
| 底层原因 | 同一进程，V8 直接调 Java | **WKWebView JS 跑在独立进程**（WebContent Process），跨进程只能异步 IPC |

**iOS 跨进程架构**：
```
App 主进程                    WebContent 进程（独立）
┌──────────┐                 ┌──────────┐
│ Native   │ ← IPC(异步) → │ JS (JSC) │
│ WKWebView│                 │ H5 页面   │
└──────────┘                 └──────────┘
```

所以 iOS 的限制更本质：不是 API 设计问题，是**进程隔离**导致的物理限制。跨进程通信天然异步，无法同步返回，无法传递函数引用。

**结论**：iOS H5 Bridge 只能走 `postMessage`（JS→Native）+ `evaluateJavaScript`（Native→JS）+ callbackId 映射，没有其他选择。

---

---

<a id="q7"></a>
### Q7: bridge:native侧的线程模型？耗时操作怎么处理？

**原则：收到消息后耗时操作派发子线程，回调 JS 必须回主线程。**

| | 收到 JS 消息在哪个线程 | 耗时操作 | 回调 JS（evaluateJavascript） |
|--|---------------------|---------|-------------------------------|
| Android | WebView 内部线程（非主线程） | 可直接做 | 必须切主线程 |
| iOS | **主线程** | 必须派发子线程 | 必须在主线程 |

**iOS 示例**：

```swift
// ─── iOS (Swift) ───
func userContentController(_ uc: WKUserContentController, didReceive msg: WKScriptMessage) {
    // ← 这里是主线程（iOS WKScriptMessageHandler 回调固定在主线程）
    let request = msg.body as! [String: Any]
    
    // 耗时操作派发到子线程（避免阻塞 UI）
    DispatchQueue.global().async {
        let result = self.handleHeavyRequest(request)
        
        // 回调 JS 必须回主线程（evaluateJavaScript 要求）
        DispatchQueue.main.async {
            self.callbackToJS(callbackId, result)
        }
    }
}
```

**Android 示例**：

```kotlin
// ─── Android (Kotlin) ───
@JavascriptInterface
fun callNative(json: String): String {
    // ← 这里不在主线程（WebView 内部线程）
    // 轻量操作可以直接做并同步返回
    // 耗时操作用线程池
    executor.submit {
        val result = handleHeavyRequest(json)
        // 回调 JS 必须切主线程
        mainHandler.post {
            webView.evaluateJavascript("bridge.invokeCallback(...)", null)
        }
    }
    return ""  // 异步场景同步返回空，结果走回调
}
```

**为什么回调 JS 必须在主线程？** 因为 `evaluateJavascript` / `evaluateJavaScript` 内部要操作 WebView 的 JS 引擎，WebView 的 UI 和引擎访问都绑定在主线程。

---

<a id="q8"></a>
### Q8: Bridge 通道本身必须在主线程吗？

**不是。只有"回调 JS"这一步必须在主线程。**

| 环节 | Android | iOS | 是否必须主线程 |
|------|---------|-----|--------------|
| **消息接收** | WebView 内部线程 | 主线程 | Android ❌ / iOS ✅（系统决定的） |
| **业务处理** | 当前线程或线程池 | 必须派发子线程 | ❌ 不要求主线程 |
| **回调 JS**（evaluateJavascript） | 主线程 | 主线程 | ✅ 双端都必须 |

**结论**：
- "Bridge 必须在主线程"这个说法**只对回调 JS 那一步成立**
- Android 的 `@JavascriptInterface` 方法本身就不在主线程（在 WebView 的 JavaBridge 线程），可以直接做事
- iOS 的 `didReceive` 碰巧在主线程，所以耗时操作必须派发出去
- 双端共同点：`evaluateJavascript` 都要求主线程，因为要操作 WebView 的 JS 引擎
