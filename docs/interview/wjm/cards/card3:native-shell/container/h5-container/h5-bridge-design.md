# H5 Bridge 高性能设计

→ [H5 容器总览](./README.md)

## 目录

- [1. 通信协议层优化](#1-通信协议层优化)
- [2. 序列化与数据格式](#2-序列化与数据格式)
- [3. 线程模型与异步设计](#3-线程模型与异步设计)
- [4. API 设计与类型安全](#4-api-设计与类型安全)
- [5. 性能监控与降级](#5-性能监控与降级)
- [6. 安全边界](#6-安全边界)

---

高性能 WebView Bridge 设计的核心在于**降低通信延迟、减少序列化开销、避免主线程阻塞**，同时保证**类型安全与双向通信的可靠性**。以下是关键设计要点：

## 1. 通信协议层优化

| 方案 | 原理 | 适用场景 |
|------|------|----------|
| **注入全局对象** (`window.xxx`) | 直接调用，无 URL 拦截开销 | 高频同步调用（如获取 UA、主题色） |
| **URL Scheme 拦截** | 通过 `shouldOverrideUrlLoading` 拦截 | 兼容性要求高的异步调用 |
| **JavaScriptInterface** (`@JavascriptInterface`) | 原生直接暴露方法给 JS | Android 现代方案，性能最优 |
| **MessageChannel / WKScriptMessageHandler** | iOS/macOS 原生管道 | iOS WKWebView 标准方案 |
| **Web Message API** | `window.postMessage` + 原生监听 | 跨平台、标准化趋势 |

**要点**：高频调用优先走注入对象或原生接口，避免 URL 解析的字符串开销。

## 2. 序列化与数据格式

- **避免反复 JSON.stringify/parse**：设计二进制协议（如 Protocol Buffers、FlatBuffers）或共享内存（WebAssembly Memory、SharedArrayBuffer）处理大数据（图片、点云、视频帧）。
- **批量队列（Batching）**：将多次小调用合并为一次批量请求，减少往返次数（类似 React Native 的 MessageQueue）。
- **零拷贝传输**：Android 可通过 `evaluateJavascript` 返回值直接取结果，避免通过 URL 传大字符串。

## 3. 线程模型与异步设计

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   JS 线程    │ ←→ │  Bridge 线程 │ ←→ │  Native 线程 │
│  (WebView)   │     │ (序列化/路由) │     │  (业务逻辑)   │
└─────────────┘     └─────────────┘     └─────────────┘
```
- **绝不阻塞 JS 线程**：Native→JS 的同步返回会卡住页面渲染，必须设计为异步 Promise/Callback 模式。
- **Native 端线程池**：Bridge 消息处理应在独立线程（Android HandlerThread / iOS dispatch_queue），避免主线程 ANR。
- **回调生命周期管理**：防止 JS 回调泄漏，设计超时机制与页面销毁时的自动清理。

## 4. API 设计与类型安全

- **IDL 定义接口**：用 TypeScript / Protocol Buffers 定义 Schema，自动生成两端类型代码，避免手动拼字符串。
- **Promise 化封装**：JS 侧统一返回 `Promise<T>`，支持 `async/await`，错误码标准化（网络错误、权限拒绝、超时）。
- **命名空间隔离**：按业务模块划分 `bridge.camera.scan()`、`bridge.device.getInfo()`，避免全局污染。

## 5. 性能监控与降级

- **埋点指标**：单次调用耗时、队列堆积长度、序列化耗时、失败率。
- **大负载降级**：超过阈值（如 1MB）自动切换为文件/流式传输，不走 Bridge 内存。
- **兼容性兜底**：旧版 WebView 无 `WebMessage` 时自动降级到 URL Scheme。

## 6. 安全边界

- **域名白名单**：限制 `JavascriptInterface` 仅对可信 Origin 暴露。
- **签名校验**：敏感操作（支付、文件读写）需带 Token 校验。
- **防止原型链污染**：注入对象使用 `Object.freeze` 或 Symbol 键，避免被恶意 JS 篡改。

---

**一句话总结**：高性能 Bridge = **原生直连通道** + **二进制/批量传输** + **异步非阻塞线程模型** + **强类型契约**。如果你们的场景涉及 AR 眼镜（如雷鸟创新）或 3D 打印（如 eufy）的实时数据流传输，建议重点考虑 **SharedArrayBuffer + WebWorker** 或自定义二进制协议来绕过 Bridge 瓶颈。

你的问题非常深入，说明对双端差异有实际体感。我逐一拆解，并给出**可落地的双端统一/差异方案**：

---

## 1. 注入全局对象：iOS 不支持？双端策略怎么定？

**事实澄清：**
- **iOS WKWebView**：**不支持**直接注入同步 JS 对象供 Native 调用（不像 Android 的 `@JavascriptInterface` 可以让 JS 直接 `window.bridge.call()`）。
- **iOS 的替代**：通过 `WKUserScript` 注入 JS 代码，在 JS 层封装一个**伪同步对象**，底层实际走 `window.webkit.messageHandlers.xxx.postMessage()`（异步）。

**双端策略建议：**

| 层级 | 统一方案 | 差异实现 |
|------|---------|---------|
| **JS 侧 API** | `window.bridge.call(method, params)` | 统一 |
| **JS 内部实现** | 封装平台判断 | iOS: `postMessage` 异步；Android: `JavascriptInterface` 同步/异步 |
| **Native 侧** | 统一路由分发层 | iOS: `WKScriptMessageHandler` 协议分发；Android: `WebView.addJavascriptInterface` + `evaluateJavascript` |

**结论**：JS 侧 API 统一，Native 层**必须分开实现**，不要强行抹平差异。

---

## 2. Web Message API 是什么？双端支持吗？

**定义**：`Web Message API` 是 HTML5 标准，核心是 `window.postMessage()` + `MessageChannel`，用于**跨文档/跨窗口通信**。

**在 WebView 语境下**：
- 它通常指 **WebView ↔ Native** 的通信通道，但**原生 WebView 并没有直接实现标准的 Web Message API**。
- 你实际用的是各平台自己的消息管道：
  - **iOS**: `WKScriptMessageHandler`（基于 `postMessage` 语义）
  - **Android**: `JavascriptInterface` 或 `WebMessagePort`（Android 5.0+ 有 `WebMessage` 和 `WebMessagePort`，但**兼容性极差**，几乎没人用）

**底层机制**：
- iOS: `WKWebView` 内部通过 **IPC（XPC）** 将 JS 的 `postMessage` 数据序列化为 `NSDictionary`，传到 Native 的 `didReceiveScriptMessage`。
- Android: `JavascriptInterface` 通过 **JNI 反射** 调用 Java 方法，参数自动从 JS 类型转为 Java 类型。

**结论**：不要指望"Web Message API"跨平台统一，它**不是标准方案**，iOS/Android 底层机制完全不同。

---

## 3. "不序列化"做不到？——降低序列化开销的策略

你说得对，**完全避免序列化在当前 WebView 架构下做不到**。但目标是**降低序列化频率和开销**：

| 场景 | 优化手段 |
|------|---------|
| 高频小数据（如传感器数据） | 批量队列（Batching），100ms 合并一次发送 |
| 大数据（图片/文件） | **不走 Bridge**，用 Base64 传 URL 或文件路径 |
| 结构化数据 | 用 FlatBuffers/Protobuf 替代 JSON，解析更快 |
| 双向大数组 | Android 用 `evaluateJavascript` 返回值直接取（减少一次 stringify） |

**双端 Bridge 的序列化现实**：
- JS → Native：必须序列化（JSON 字符串或 Protobuf bytes）
- Native → JS：Android 可用 `evaluateJavascript` 直接执行 JS 代码传对象；iOS 必须用 `evaluateJavaScript` 回调（也是字符串）

---

## 4. 零拷贝只有 Android 能做到？双端 Bridge 是否要在 JS 侧区分平台？

**零拷贝的现实**：
- **Android**：`evaluateJavascript` 返回值可以直接拿到字符串，但**也不是真正的零拷贝**（内核层仍有拷贝）。大对象通过 `JavascriptInterface` 直接传引用？**做不到**，JS 和 Java 是不同 VM。
- **iOS**：完全做不到零拷贝，WKWebView 跑在独立进程，所有通信都经过 IPC + 序列化。

**你的方案判断基本正确**：

```
JS 侧统一入口: bridge.call(method, params)
       ↓
    平台判断
       ↓
┌──────────────┬──────────────┐
│   Android    │     iOS      │
│ 直接调用优先  │  协议分发     │
│ (JSI-like)   │ (postMessage) │
└──────────────┴──────────────┘
```

**但注意**：即使 Android 走 `JavascriptInterface`，**复杂返回值仍建议走异步回调**，避免同步阻塞 JS 线程导致页面卡顿。

**推荐架构**：
- JS 侧：统一 Promise 封装，内部判断 `window._androidBridge` / `window.webkit.messageHandlers`
- Android Native：`JavascriptInterface` 暴露方法，内部路由到业务模块
- iOS Native：`WKScriptMessageHandler` 接收消息，统一路由分发器

---

## 5. "异步"主要借助 callback 设计？

**是的，但现代做法是用 Promise 封装 callback**。

**经典 callback 模式**：
```js
// JS 侧
bridge.call('getDeviceInfo', {}, function(result, error) {
  if (error) { ... }
});
```

**Promise 封装（推荐）**：
```js
bridge.call('getDeviceInfo', {})  // 返回 Promise
  .then(info => ...)
  .catch(err => ...);
```

**Native 侧实现**：
- 每个 call 带唯一 `callbackId`
- Native 处理完后，通过 `evaluateJavascript` 执行 `window.bridge._resolve(callbackId, result)`
- 超时自动 reject，防止内存泄漏

**关键点**：异步不是"可选项"，是**必须**——同步调用会阻塞 JS 事件循环，导致页面无响应。

---

## 6. 大负载降级（>1MB 不走 Bridge）——怎么做？可行吗？

**可行，但"不走 Bridge 内存" ≠ "不走 WebView"，而是换通道**：

| 方案 | Android | iOS | 说明 |
|------|---------|-----|------|
| **Base64 传文件路径** | ✅ | ✅ | Native 写文件到沙盒，Bridge 只传 `file://` 路径，JS 用 `fetch`/`XMLHttpRequest` 读取 |
| **自定义 URL Scheme 加载** | ✅ | ✅ | `myapp://data/xxx`，Native 拦截返回数据流 |
| **Blob URL / Object URL** | ✅ | ✅ | Native 通过 `evaluateJavascript` 注入 `URL.createObjectURL(blob)` |
| **WebSocket 本地代理** | ✅ | ✅ | 本地起 WebSocket server，JS 通过 ws://127.0.0.1 传输大数据 |

**最可行的推荐方案**：

```
大数据传输流程：
1. JS: bridge.call('uploadImage', { quality: 0.8 })
2. Native: 接收图片 → 压缩 → 写入沙盒 /tmp/bridge_xxx.jpg
3. Native: 通过 evaluateJavascript 回调 JS
   window.bridge._resolve(id, { 
     type: 'filePath', 
     path: 'file:///tmp/bridge_xxx.jpg' 
   })
4. JS: 用 fetch(filePath) 或 Image.src = filePath 读取
5. Native: 监听页面销毁或 5min 后清理临时文件
```

**iOS 特别注意**：`WKWebView` 无法直接访问 App 沙盒文件路径，需要：
- 通过 `WKURLSchemeHandler` 注册自定义 scheme（iOS 11+）
- 或把文件放到 `tmp/www/` 目录下，WKWebView 可以通过 `file://` 访问

**结论**：>1MB 的数据**绝不通过 Bridge 消息体传输**，只传元数据（路径/URL），数据走 HTTP/文件系统通道。

---

## 7. 域名白名单配置在哪里？怎么获得？

**配置位置**：

| 平台 | 配置方式 |
|------|---------|
| **Android** | `WebViewClient.shouldOverrideUrlLoading()` 中判断 `request.url.host`；`JavascriptInterface` 在 `onPageFinished` 中按域名注入 |
| **iOS** | `WKWebViewConfiguration` 的 `WKUserContentController` 中，按 `WKFrameInfo.request.url` 判断；或 JS 侧在 `postMessage` 时带 `origin` 字段 |

**具体实现**：

```kotlin
// Android: 在 shouldOverrideUrlLoading 中拦截
override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
    val host = request?.url?.host
    if (!ALLOWED_HOSTS.contains(host)) {
        // 拒绝加载或拒绝注入 Bridge
        return true
    }
    return false
}
```

```swift
// iOS: 在 didReceiveScriptMessage 中校验 origin
func userContentController(_ userContentController: WKUserContentController, 
                           didReceive message: WKScriptMessage) {
    guard let url = message.frameInfo.request.url,
          ALLOWED_HOSTS.contains(url.host) else {
        return // 忽略不可信域名的消息
    }
    // 处理消息
}
```

**白名单来源**：
- **硬编码**：App 内置配置文件（`assets/bridge_config.json`）
- **远程配置**：启动时从服务端拉取，但需**签名校验**防篡改
- **动态添加**：业务需要时通过安全通道下发（如 SDK 初始化时）

**安全增强**：
- 不仅校验域名，还要校验 **HTTPS + 证书 Pinning**
- 敏感操作（支付、个人信息）额外加 **Token 签名校验**（HMAC-SHA256）

---

## 总结：双端 Bridge 架构建议

```
┌─────────────────────────────────────────┐
│           JS 统一层 (TypeScript)         │
│    bridge.call(method, params) → Promise │
│    内部判断平台，走不同底层实现            │
└─────────────────────────────────────────┘
                   ↓
    ┌──────────────┴──────────────┐
    ↓                             ↓
┌─────────────┐           ┌─────────────┐
│   Android   │           │     iOS     │
│  Native层   │           │   Native层  │
├─────────────┤           ├─────────────┤
│Javascript   │           │WKScriptMessage│
│Interface    │           │Handler        │
│(直接调用)    │           │(协议分发)      │
├─────────────┤           ├─────────────┤
│ 统一路由层   │◄─────────►│  统一路由层   │
│ (按模块分发) │           │ (按模块分发)  │
├─────────────┤           ├─────────────┤
│ 业务模块     │           │  业务模块     │
│ (线程池处理) │           │ (GCD队列)    │
└─────────────┘           └─────────────┘
```

**核心原则**：
1. **JS 侧统一 API**，Native 层承认差异、分开实现
2. **所有调用异步化**，Promise 封装 callback
3. **大数据走文件/URL**，Bridge 只传元数据
4. **序列化用 Protobuf/FlatBuffers** 替代 JSON（如果高频）
5. **安全白名单 Native 层硬控**，JS 层不可绕过

如果你已经在做双端 Bridge，建议把**路由层和序列化层**抽象出来，业务模块只关心接口定义，平台差异在底层隔离。

你的追问非常精准，我逐一澄清，去掉噪音，只留可落地的：

---

## 1. Android 走注入对象，iOS 走协议分发——是这个意思吗？

**是的，但不完全是"多个 external func"的模式。**

| 平台 | 具体做法 | 原因 |
|------|---------|------|
| **Android** | 注入**一个**全局对象 `window._androidBridge`，暴露方法如 `callSync()` / `callAsync()` | `JavascriptInterface` 支持同步返回，但复杂业务仍建议异步回调防阻塞 |
| **iOS** | 无同步注入能力，JS 层封装 `window._iosBridge`，底层实际调用 `window.webkit.messageHandlers.bridge.postMessage()` | WKWebView 强制异步，协议分发是唯一通道 |

**关键区别**：
- Android 的 `JavascriptInterface` 可以让 JS **直接拿到 Java 方法的返回值**（同步），但**不要滥用**——同步调用会阻塞 JS 线程，页面卡顿。
- iOS 完全做不到同步，所有通信都是 `postMessage` → Native 处理 → `evaluateJavaScript` 回调。

**所以你的理解基本正确**：Android 可以走类似 JSI 的直接调用（但建议异步为主），iOS 只能走协议分发。

---

## 2. Web Message API 实际不可用——以后不说了

**确认：Web Message API（`WebMessagePort`）在双端原生 WebView 中实际不可用。**

- Android 的 `WebMessage` / `WebMessagePort` 需要 Chrome 特定版本，兼容性极差
- iOS 没有对应实现

**以后 Bridge 通信只谈两种实现**：
- Android: `JavascriptInterface` + `evaluateJavascript`
- iOS: `WKScriptMessageHandler` + `evaluateJavaScript`

---

## 3. JS 能访问沙盒文件吗？通过 fetch？

**Android：可以，但有条件**
- `file://` 协议默认被禁止（`setAllowFileAccess` 需开启）
- 推荐做法：Native 通过 `WebViewClient.shouldInterceptRequest` 拦截自定义 scheme（如 `myapp://data/`），返回 `WebResourceResponse`，JS 用 `fetch('myapp://data/xxx')` 读取

**iOS：WKWebView 不能直接访问沙盒**
- `file://` 访问受限，需用 `WKURLSchemeHandler`（iOS 11+）注册自定义 scheme
- 或把文件放到 `tmp/www/` 下，通过 `loadFileURL` 允许访问的目录

**可行方案**：
```
Native 写文件 → 生成自定义 URL → Bridge 传 URL 给 JS → JS fetch 该 URL
```

---

## 4. iOS 的 WebView 可以直接 eval JS 吗？

**可以，`WKWebView.evaluateJavaScript()`**

```swift
webView.evaluateJavaScript("window.bridge._resolve('\(callbackId)', \(resultJson))") { _, error in
    // 处理错误
}
```

**限制**：
- 异步 API，有回调
- 返回值只能是基本类型（String/Number/Boolean/Dictionary/Array），大对象仍需序列化
- 执行时机：页面加载完成后才能调用，否则抛异常

---

## 5. WebSocket 本地代理：真的这么用吗？性能如何？

**先说结论：实际 Bridge 设计中极少这么用，属于过度设计。**

| 维度 | 分析 |
|------|------|
| **是否免序列化** | 否。WS 传的是 Frame，payload 仍是 bytes，业务层仍需序列化（只是协议层帮你分包了） |
| **走系统 socket** | 是，但本地 loopback 也有开销（内核态切换、协议栈处理） |
| **适合传什么** | 持续流数据（如实时音视频、传感器流），但 WebView 里用 WS 传这些并不常见 |
| **实际开销** | 比 Bridge 直接通信**更高**：多了 TCP/IP 协议栈、WS 帧封装、端口管理 |
| **业界实践** | **没有主流 App 用 WS 做 WebView Bridge**。React Native 的 JSI、Flutter 的 Platform Channel 都不走 WS |

**如果非要本地 WS 的场景**：
- 第三方 SDK 已经提供了 WS 接口（如某些直播推流 SDK）
- 需要与外部 Web 服务共用同一套协议

**否则不要引入 WS 增加复杂度**。

---

## 总结：去掉噪音后的 Bridge 设计

```
JS 统一层: bridge.call(method, params) → Promise
    ↓
┌─────────────────┬─────────────────┐
│    Android      │      iOS        │
├─────────────────┼─────────────────┤
│ window._android │ window._iosBridge│
│   (注入对象)     │ (postMessage包装) │
├─────────────────┼─────────────────┤
│ JavascriptInterface │ WKScriptMessage │
│   同步/异步均可    │    强制异步      │
├─────────────────┼─────────────────┤
│ evaluateJavascript │ evaluateJavaScript│
│   回调 JS        │    回调 JS       │
├─────────────────┼─────────────────┤
│ 统一路由分发器    │   统一路由分发器   │
│ 业务线程池处理    │   GCD 队列处理    │
└─────────────────┴─────────────────┘
```

**大数据（>1MB）**：
- 不走 Bridge 消息体
- Native 写沙盒 → 生成自定义 URL → Bridge 传 URL → JS fetch/加载
- Android 用 `shouldInterceptRequest`，iOS 用 `WKURLSchemeHandler`

**序列化**：
- 无法避免，但可用 Protobuf/FlatBuffers 替代 JSON 降低开销
- 高频小数据批量合并（Batching）

**安全**：
- 白名单 Native 层硬控（`shouldOverrideUrlLoading` / `WKFrameInfo.request.url`）
- 敏感操作加签名校验

**WS 做 Bridge**：不推荐，没有实际收益，徒增复杂度。

你说得对，精简才是本事。

| # | 设计要点 | Android | iOS | 说明 |
|---|---------|---------|-----|------|
| 1 | **通道选择** | `JavascriptInterface` 注入对象 | `WKScriptMessageHandler` 协议分发 | JS 侧统一 Promise API，Native 层承认差异 |
| 2 | **全异步接口** | 即使支持同步，所有接口也封装为异步 Promise | 只能异步 | 防阻塞 JS 线程，统一回调生命周期管理 |
| 3 | **大数据降级** | `shouldInterceptRequest` 拦截自定义 scheme | `WKURLSchemeHandler` 注册自定义 scheme | >阈值（如 1MB）只传 URL，不走 Bridge 消息体 |
| 4 | **序列化优化** | Protobuf / FlatBuffers 替代 JSON；批量合并（Batching） | 同上 | 降低解析开销，减少往返次数 |
| 5 | **安全硬控** | `shouldOverrideUrlLoading` 域名白名单 + 签名校验 | `WKFrameInfo.request.url` 校验 + 签名 | Native 层控制，JS 不可绕过 |

**核心就一句**：JS 统一异步 Promise，Android 直接注入、iOS 协议分发，大数据走 URL 拦截，序列化用二进制，安全 Native 硬控。

不一定。分场景：

| 场景 | 二进制（Protobuf/FlatBuffers） | JSON |
|------|------------------------------|------|
| 高频小数据（传感器、埋点） | 收益有限，甚至负收益 | 直接用，简单 |
| 大数据量、复杂嵌套结构 | 解析快、体积小，有收益 | 字符串拼接/解析慢 |
| 双端已有 Protobuf 生态 | 有收益，复用 Schema | 维护两套模型 |
| 当前纯 WebView 项目 | 引入成本高，收益不明显 | 保持现状 |

**你的项目现状**：
- 10 年大前端，Android+iOS+RN+Flutter 背景
- 如果团队已有 Protobuf 基建（比如后端接口都用 pb），Bridge 顺手用 pb 有收益
- 如果从零引入，**JSON + 批量合并（Batching）** 足够，复杂度更低

**务实建议**：
- 先上 **Batching + 大数据降级**，这两块收益确定
- 二进制序列化作为**可选优化项**，压测后再决定要不要上

不为了技术炫技而增加复杂度。


这个 JD 的核心在**第5条**——"跨端容器与 Hybrid 架构能力"，要求你设计**高内聚、低延迟的 JSBridge**，并能把**App 端内开发模式向 Web 生态对齐**。

结合你的追问风格（务实、反感噪音、要可落地），以下是针对这个 JD 的**面试/技术方案核心要点**，控制在5点：

---

| # | 要点 | 针对 JD 的落地表达 |
|---|------|------------------|
| 1 | **双端通道差异化实现** | Android 注入 `JavascriptInterface` 对象，iOS 走 `WKScriptMessageHandler` 协议分发；JS 侧统一 Promise API，Native 层不强行抹平差异 |
| 2 | **全异步 + 回调生命周期管控** | 所有接口 Promise 化，Native 端线程池/GCD 处理，带超时机制与页面销毁自动清理，防内存泄漏与 ANR |
| 3 | **大数据降级（>1MB 走 URL）** | Native 写沙盒 → 自定义 scheme URL → JS `fetch` 读取；Android 用 `shouldInterceptRequest`，iOS 用 `WKURLSchemeHandler` |
| 4 | **"端内开发模式向 Web 对齐"** | Bridge 封装 Native 能力为 Web 标准 API（如 `bridge.storage` 对齐 `localStorage`，`bridge.navigator` 对齐 `window.navigator`），H5 页面零感知运行在 WebView 或浏览器 |
| 5 | **动态化研发体系** | Bridge 底座支持热更新（JSBundle 下发）、灰度路由、AB 实验；付费埋点（IAP/订阅）走 Bridge 统一收口，双端行为一致 |

---

**面试时一句话总结**：

> "JSBridge 不是通信工具，是**跨端抽象层**。Android 直接注入、iOS 协议分发，JS 统一异步 Promise；大数据走 URL 拦截不塞 Bridge；最终目标是让 H5 页面在 App WebView 里**感知不到自己在容器里**，开发体验与浏览器一致，同时享受 Native 能力。"

**关于 AI 第2条**：JD 强调"AI 驱动架构"，但你 10 年大前端背景，面试时把 AI 定位为**工具提效**（AI 生成 Bridge 接口定义、自动化测试、代码审查），而非替代架构设计——架构决策权在人。

你说得对，两点都切中要害：

---

## 1. 大文件上传/下载：JS 只触发，Native 执行

| 场景 | JS 职责 | Native 职责 |
|------|---------|-------------|
| **上传** | `bridge.upload({ url, filePath, headers })` 触发 | Native 读沙盒文件 → 直传服务端 → 回调进度/结果 |
| **下载** | `bridge.download({ url, savePath })` 触发 | Native 下载 → 写沙盒 → 回调本地路径给 JS |
| **断点续传** | 无 | Native 层管理，JS 只关心 `pause`/`resume` 指令 |

**JS 侧拿到的只是任务 ID 和最终状态**，进度通过 Bridge 回调（节流 100ms），二进制数据不过 Bridge。

---

## 2. WebView 定制 与 JS Bridge 必须一体设计

| 维度 | 一体考虑的原因 |
|------|---------------|
| **性能** | WebView 的缓存策略、资源拦截、预加载直接影响 Bridge 调用频率（如预加载后减少 `bridge.getConfig` 次数） |
| **安全** | WebView 的域名白名单、JS 执行限制决定 Bridge 暴露范围，不能分开配 |
| **体验** | WebView 的转场动画、进度条、错误页需要 Bridge 提供加载状态同步 |
| **调试** | WebView 的 DevTools 集成、日志通道需要 Bridge 打通 |
| **生命周期** | WebView 的 `onDestroy`/`dealloc` 必须与 Bridge 回调清理联动，防内存泄漏 |

**一体设计的具体耦合点**：

```
WebView 初始化
    ↓
注入 Bridge 对象（Android）/ 注册 MessageHandler（iOS）
    ↓
配置 WebView 缓存/拦截器（为大数据 URL scheme 做准备）
    ↓
加载 H5 URL
    ↓
Bridge ready 回调 → H5 开始调用 Native 能力
    ↓
页面销毁 → Bridge 清理未完成的 callbackId → WebView 释放
```

**面试表达**：

> "Bridge 不是独立模块，是 WebView 容器的一部分。设计时要一起考虑：WebView 的缓存策略减少 Bridge 调用，拦截器支撑大数据降级，生命周期绑定防止回调泄漏。分开设计会导致性能和安全断层。"

---

**针对这个 JD 的修正总结**（把 WebView 纳入）：

| # | 要点 |
|---|------|
| 1 | **双端通道差异化**：Android 注入对象，iOS 协议分发，JS 统一 Promise |
| 2 | **全异步 + 生命周期绑定**：WebView 销毁自动清理 Bridge 回调，防泄漏 |
| 3 | **大文件 Native 直传**：JS 只触发，上传/下载/断点续传在 Native 层完成，进度节流回调 |
| 4 | **WebView 与 Bridge 一体**：缓存、拦截器、安全白名单、DevTools 统一设计 |
| 5 | **Web 标准对齐**：Bridge API 封装成 Web 标准语义，H5 零感知容器差异 |

# QA
## 1. 大数据传递方案? 文件传递方案?

不走 Bridge 序列化。大数据（图片/文件）Native 写到本地临时文件 → 通过 Bridge 只传文件路径（字符串）→ JS 侧用 `file://` 路径读取或展示。反向同理：JS 选文件后 Native 拿到系统 URI 直接处理，不把二进制塞进 JSON。

IOS不行吧?

> iOS WKWebView 有沙盒隔离，JS 不能直接访问 `file://` 路径。iOS 方案：用 `WKURLSchemeHandler` 注册自定义 scheme（如 `localres://`），JS fetch 这个 URL → Native 拦截后返回本地文件数据。效果一样，路径不同。

## 2. 安全?

域名白名单：只对可信 Origin 暴露 `@JavascriptInterface` / `WKScriptMessageHandler`。未授权域名调 Bridge → 直接忽略不响应。敏感 API（支付/定位）额外加 token 校验。

## 3. 如何拦截 URL Scheme?

- Android：重写 `WebViewClient.shouldOverrideUrlLoading(view, url)` → 检查 `url.scheme == "myapp"` → 解析 path + params → 分发给对应 Native 处理器 → return true（阻止 WebView 加载）。
- iOS：`WKNavigationDelegate.decidePolicyFor` 同理。

- 也就是: H5 fetch url, 这个URL 会在native层, 用webview暴露的监听事件 来 拦截吗?

> 不是 fetch。是 JS 侧设置 `location.href = "myapp://api/getToken?callbackId=1"` 或创建一个隐藏 iframe。WebView 检测到导航请求（不是 XHR/fetch）→ 触发 Native 的 `shouldOverrideUrlLoading` / `decidePolicyFor` 回调 → Native 拦截处理。fetch 不会触发这个回调——只有页面导航/iframe 才会。

## 4. H5 传大数据/文件给 Native？

H5 不能直接通过 Bridge 传二进制（Bridge 只能传字符串/JSON）。

**方案**：H5 用 `<input type="file">` 选文件 → 触发 Native 的文件选择回调（Android `onShowFileChooser` / iOS `runOpenPanel`）→ Native 直接拿到文件 URI → 处理。文件根本不经过 Bridge 序列化。

如果是 JS 动态生成的数据（Blob）→ JS 用 `URL.createObjectURL` 或写入 IndexedDB → 通过 Bridge 只传一个 key/标识符 → Native 通过 `evaluateJavascript` 反调 JS 读取。

**核心原则**：大数据永远不塞 Bridge 通道，只传路径/标识符，实际数据走文件系统或 Native 回调。

## 5. `<input type="file">` 的 URI 哪儿来的？

- 其实 上传到本地, 就是把URI 传给NAtive吧
- URI: 就是文件在手机上本来的地址

文件从来没"传"——它一直在手机上。

流程：H5 `<input type="file">` 点击 → WebView 回调 Native（Android `onShowFileChooser` / iOS `runOpenPanel`）→ Native 弹系统文件选择器 → 用户选好 → 系统返回 URI 给 Native → Native 直接用 URI 读文件（`ContentResolver.openInputStream` / `URL.startAccessingSecurityScopedResource`）。

Bridge 里什么都没传，文件在 Native 侧直接处理。

> 补充：连 URI 都不用"传"——`onShowFileChooser` 是 WebView 自带机制，系统直接回调给 Native，不经过你的 Bridge。H5 只管写 `<input type="file">`，剩下的 WebView + 系统搞定。

## 6. 异步promise 回调 底层都是依靠 bridge:JS侧的 Map<callbackId, callback>
是的，JS 侧维护 `Map<callbackId, callback>` 是双端通用的最小必要设计。

核心就三点：

| 点 | 说明 |
|---|---|
| **callbackId** | 每次 `bridge.call()` 生成唯一 ID（时间戳 + 随机数），随请求带到 Native |
| **Map 存储** | JS 侧 `pendingCallbacks.set(id, { resolve, reject, timer })` |
| **Native 回传** | 通过 `evaluateJavascript` 执行 `bridge._resolve(id, result)` 或 `_reject(id, error)` |

**超时与清理**：

```js
// JS 侧简化示意
const pending = new Map();

bridge.call = (method, params, timeout = 5000) => {
  const id = `${Date.now()}_${Math.random()}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('timeout'));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    // 发送到 Native
    _sendToNative({ id, method, params });
  });
};

// Native 回调入口
bridge._resolve = (id, result) => {
  const cb = pending.get(id);
  if (cb) { clearTimeout(cb.timer); cb.resolve(result); pending.delete(id); }
};
bridge._reject = (id, error) => {
  const cb = pending.get(id);
  if (cb) { clearTimeout(cb.timer); cb.reject(error); pending.delete(id); }
};
```

**WebView 销毁时**：Native 通知 JS 或 JS 监听 `beforeunload`，批量 `reject` 未完成的 callback，防内存泄漏。

**Android/iOS 差异只体现在 `_sendToNative` 和 Native 回调 JS 的通道上**，JS 侧的 Map 机制完全复用。

这就是你讨论的"双端统一设计"——JS 侧一套，Native 通道分开。

## 7. 快应用 Bridge 设计：双向 External Function 注入
**本质**：同进程（JVM + V8）通过 JNI 共享对象引用，互相注入"外部函数"。

### External Function 对比

| | JS 侧看到的 | Java 侧看到的 | 底层实现 |
|--|------------|-------------|---------|
| **Java → JS 注入** | 全局函数（如 `connectDevice()`） | `registerJavaMethod(callback, name)` | V8 global 上挂一个 C++ 回调 → JNI → Java 方法 |
| **JS → Java 传函数** | 正常传参（`nativeCall(resolve, reject)`） | `V8Function` 对象（句柄） | Java 持有 V8 堆对象的 C++ 指针包装 |

不是"函数指针"——是 JNI 句柄（Java 对象持有 V8 C++ 指针）。效果类似，但有 GC 管理。

### Promise 异步怎么做

- JS 把 `resolve` / `reject` 函数作为参数传给 Java → Java 持有 `V8Function` 句柄 → 子线程执行完 → 回到 V8 线程调 `resolve.call(result)`。
    - 遇到JS 函数这种引用类型, J2V8传递的时候 会自动处理为external func 引用, 而不会序列化之类

## 8. 现在业界的webcview设计, IOS Android , bridge设计, 是否Android侧走类似JSI 的注入external的设计, 传递resolve等 引用, 而IOS走消息分发呢 

- 不是。Android `@JavascriptInterface` 虽然看起来像"注入"，但**它不能传 JS 函数引用**——只能传基础类型（String/int/boolean）和数组。

- 实际业界 WebView Bridge 设计：**双端都走消息分发（callbackId 模式）**，统一方案。

原因：
1. Android `@JavascriptInterface` 确实能同步返回，但**拿不到 JS 函数引用**（不是 JSI/J2V8 那种同进程直调）
2. iOS `WKScriptMessageHandler` 只能传可序列化数据
3. 为了双端统一 → 都用 callbackId + `evaluateJavascript` 回调

- 所以即使 Android 技术上能做到"注入对象同步调"，实际工程中还是选择和 iOS 统一走消息分发。

## 9. WebView Bridge 能做的优化有限，能做什么？

WebView Bridge 天花板被框架限死——不能传函数引用、不能共享内存、不能绕过序列化。

**能做的**：

| # | 优化 | 本质 |
|---|------|------|
| 1 | 通道选对（Android `@JavascriptInterface` / iOS `WKScriptMessageHandler`） | 最快通道 |
| 2 | JS 侧 Batching（微任务攒一批） | 减少跨边界次数 |
| 3 | 大数据不走 Bridge（走系统回调/URL 拦截） | 避免序列化大对象 |
| 4 | Native 侧线程池 | 防 ANR |
| 5 | SDK 结果缓存 | 减少不必要调用 |

**做不了的**：绕过 JSON 序列化、传 JS 函数引用、同步返回（iOS）。真要突破 → 升级到 RN（JSI）或 J2V8。

**业界实际方案**：双端都走消息分发（callbackId 模式）。即使 Android 能注入对象同步调，也不能传 JS 函数引用，所以还是统一走 callbackId + `evaluateJavascript` 回调。

