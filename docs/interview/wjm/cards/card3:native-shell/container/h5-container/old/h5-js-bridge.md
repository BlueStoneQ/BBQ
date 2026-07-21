# H5 WebView JS Bridge 设计

## 目录

- [JD 拆解](#拆解)
- [一、本质结论](#一本质结论)
- [二、三种通信方案与最佳实践](#h5-js-bridge-三种通信方案与最佳实践)
- [三、架构概览](#41-webview-中-h5-到-native-的-js-bridge-实现)
- [四、核心设计要素](#42-核心设计要素)
  - [通信协议设计](#421-通信协议设计)
  - [核心数据结构设计](#4211-核心数据结构设计)
  - [任务队列设计](#422-任务队列设计优化层非必须但推荐)
  - [异步动作处理](#423-异步动作处理)
- [五、Android 平台实现](#43-android-平台实现)
- [六、iOS 平台实现](#44-ios-平台实现)
- [七、性能优化策略](#45-性能优化策略)
- [八、安全设计](#46-安全设计)
- [九、调试与监控](#47-调试与监控)
- [十、总结：设计要点](#48-总结webview-js-bridge-设计要点)
- [QA](#qa)
  - [Q: 为什么不像 RN 那样逐个注入 external function？](#q-为什么-h5-webview-不像-rn-那样每个-native-api-直接注入成-external-function)
  - [Q: iOS 的 messageHandlers 具体做不到什么？](#q-ios-的-messagehandlers-具体做不到什么)

---

## 拆解

> **命中 JD 第5条**：深入理解 App 宿主环境与 Web 运行时的底层通信机制；精通高性能 JSBridge 协议设计与通道优化，能够通过构建高内聚、低延迟的跨端通信底座，抹平 Native 与 Web 的体验与开发差异。

| JD 关键词 | 实际要做的事 | 对应章节 |
|-----------|------------|---------|
| 底层通信机制 | 知道 `@JavascriptInterface` / `messageHandlers` / URL Scheme 的原理和限制 | [三种通信方案](#h5-js-bridge-三种通信方案与最佳实践) |
| 高性能 JSBridge | 注入 API 直调 + 批处理 + 同步优先 + 协议精简 | [性能优化策略](#45-性能优化策略) |
| 跨端通信底座 | 统一 Bridge SDK（RN 和 H5 共享同一套 Native 实现） | [架构概览](#41-webview-中-h5-到-native-的-js-bridge-实现) |
| 抹平体验差异 | WebView 容器定制（池化 + 离线包 + 预加载 + Cookie 同步） | → [h5-performance.md](./h5-performance.md) / [qa-webview.md](./qa-webview.md) |

---

"深入理解 App 宿主环境与 Web 运行时的底层通信机制"

- 你知道 WebView 里的 JS 引擎和 Native 之间怎么通信的（不是只会用，要懂底层原理）

"精通高性能 JSBridge 协议设计与通道优化"

- 你能设计 Bridge 协议（不是用现成的），并且能做到高性能（批处理/同步优先/精简协议/缓存）

"构建高内聚、低延迟的跨端通信底座"

- 封装一套统一的 Bridge SDK，所有 H5 页面用同一套 API 调 Native，不是每个业务各自搞一套

"抹平 Native 与 Web 的体验与开发差异"

- H5 页面在 App 内用起来像 Native 一样流畅——离线包秒开、Bridge 能力齐全、登录态同步、导航一致

---

## 一、本质结论

**JS → Native 方向**：JS 调用 Native 时，Bridge:JS 侧用任务队列保证调用的有序性和并发控制，然后通过 Native 注入的 external function（`callNative`）把调用信息（module + method + params + callbackId）发送到 Native 侧。任务队列**只保证调用顺序，不保证返回顺序**。

**Native → JS 方向**：Native 异步处理完成后，通过 `evaluateJavascript` 把结果 + callbackId 发回 JS。Bridge:JS 侧根据 callbackId 在 `Map<callbackId, callback>` 中查找对应的回调函数并执行。返回顺序由 Native 处理速度决定，与调用顺序无关。

**为什么不像 RN 那样每个 Native API 都注入成 external function？** 因为 WebView 不暴露 JS 引擎实例，`addJavascriptInterface` 只能注入一个对象（不是任意函数），iOS `messageHandlers` 更是只提供消息通道。所以只能注入一个统一入口 + 协议分发。

---

**直接回答核心问题：**

### Q: webview中H5到Native的js-bridge怎么设计的？

#### 核心设计三要素：
1. **通信通道**：JS ↔ Native 的通信机制
2. **数据结构**：管理调用和回调的映射表  
3. **异步处理**：Native 异步操作的结果回调

#### 详细设计：

**1. 通信通道设计**
- **Android**：`@JavascriptInterface` + `evaluateJavascript()`
- **iOS**：`WKScriptMessageHandler` + `evaluateJavaScript()`
- **通用**：URL Scheme 拦截

**2. 核心数据结构（必需）**
```javascript
// JS 侧核心数据结构：Map（映射表）
class JSBridgeCore {
  constructor() {
    this.callbackMap = new Map();     // {callbackId: callbackFunction}
    this.moduleMap = new Map();       // {moduleName: moduleInstance}
    this.requestMap = new Map();      // {requestId: requestInfo}
  }
}
```

**3. JS 侧设计**
- **入口**：Native 注入的 External Function
- **API 层**：业务友好的封装（`jsBridge.device.getLocation()`）
- **回调管理**：Map 映射 + 可选的任务队列
- **协议**：JSON 序列化请求/响应

**4. Native 侧设计**  
- **桥梁对象**：围绕 JS 引擎的封装（如 `JavascriptInterface`）
- **模块注册**：`{moduleName: moduleImplementation}`
- **请求处理**：解析 → 分发 → 执行 → 回调
- **回调执行**：`evaluateJavascript()` 回调到 JS

**5. 异步处理**
- **Callback ID 映射**：`{callbackId: callbackFunction}`
- **Native 回调**：异步完成后通过 ID 找到并执行对应 JS 函数
- **超时清理**：防止回调泄漏

**6. 任务队列（可选优化）**
- **作用**：控制并发、保证顺序、超时管理
- **实现**：JS 侧队列 + Native 侧队列

### 简单总结：
1. **JS 侧核心**：Map 管理回调映射
2. **Native 侧核心**：引擎封装对象处理通信
3. **异步核心**：Callback ID 映射表
4. **队列**：可选的性能优化层

---

### H5 JS Bridge 三种通信方案与最佳实践

#### 1. 注入 API（External Function）(优先)

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

```javascript
// ─── iOS ───
// iOS 的 messageHandlers 不是注入函数，是注册一个消息通道
// JS 调用 postMessage 后，消息通过 IPC 发给 App 主进程的 WKScriptMessageHandler
// 没有返回值，Native 处理完后通过 evaluateJavaScript 回调
window.webkit.messageHandlers.bridge.postMessage({
    module: 'device', method: 'getLocation'
});
```

> **iOS 通信模型**：JS（WebContent 进程）→ postMessage → IPC → App 主进程 → WKScriptMessageHandler 处理 → evaluateJavaScript 回调 → IPC → JS 收到结果。全程异步，两次跨进程。

```javascript
// ─── bridge:js侧 SDK 实现（抹平双端差异）───
// 业务代码统一调用这一个函数，不感知底层是 Android 还是 iOS
function callNative(module, method, params) {
  return new Promise((resolve) => {
    const callbackId = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    callbackMap.set(callbackId, resolve);

    const message = JSON.stringify({ m: module, f: method, p: params, id: callbackId });

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

#### 2. URL Scheme 拦截(兜底方案)

```javascript
// JS 侧：构造特殊 URL，通过隐藏 iframe 触发
const iframe = document.createElement('iframe');
iframe.src = 'jsbridge://device/getLocation?params=xxx&callback=cb_001';
document.body.appendChild(iframe);
setTimeout(() => iframe.remove(), 0);
```

```java
// Native 侧：拦截 shouldOverrideUrlLoading
@Override
public boolean shouldOverrideUrlLoading(WebView view, String url) {
    if (url.startsWith("jsbridge://")) {
        // 解析 jsbridge://module/method?params=...
        handleBridgeUrl(url);
        return true; // 拦截，不跳转
    }
    return super.shouldOverrideUrlLoading(view, url);
}
```

#### 3. prompt / alert 拦截(废弃)

```javascript
// JS 侧：借用 prompt 通道（可同步返回）
const result = prompt(JSON.stringify({module: 'device', method: 'getToken'}));
const data = JSON.parse(result);
```

```java
// Native 侧：拦截 onJsPrompt
@Override
public boolean onJsPrompt(WebView view, String url, String message,
                           String defaultValue, JsPromptResult result) {
    if (message.startsWith("JSBridge:")) {
        String response = handleRequest(message.substring(9));
        result.confirm(response); // 同步返回给 JS
        return true;
    }
    return super.onJsPrompt(view, url, message, defaultValue, result);
}
```

#### 三种方案对比

| 方案 | 同步能力 | 性能 | 兼容性 | 安全性 | 缺点 |
|------|---------|------|--------|--------|------|
| **URL Scheme** | ❌ 异步 | 差 | ✅ 全平台 | 中 | URL 长度限制，连续调用丢失 |
| **注入 API** | ✅ Android 同步 / iOS 异步 | **好** | Android 4.2+ | **高** | iOS 只能异步 |
| **prompt 拦截** | ✅ 同步 | 中 | ✅ 全平台 | 低 | 侵入性强，占用 prompt |

#### 最佳实践

**注入 API 为主 + URL Scheme 做降级兜底 + evaluateJavascript 回调**

理由：
1. **注入 API 是 external object + external function**：注入一个对象到 JS global，上面挂的 `@JavascriptInterface` 方法就是 external function。性能最好，安全可控，Android 同步返回
2. **URL Scheme 做兜底**：兼容低版本 / 特殊场景（如跨域 iframe）
3. **prompt 方案基本废弃**：侵入性强，debug 时干扰，现代项目不推荐

> 业界方案（微信/支付宝 JSBridge）基本都是：注入 API + URL Scheme 兜底 + evaluateJavascript 回调。

---

### 4.1 WebView 中 H5 到 Native 的 JS Bridge 实现

#### 4.1.1 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│ WebView 中 H5 ↔ Native JS Bridge 架构                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  H5 层 (WebView)                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  JS Bridge API (JS SDK)                              │   │
│  │  - window.jsBridge.callNative(...)                   │   │
│  │  - 封装调用、参数序列化、回调管理                     │   │
│  └──────────────────────────────────────────────────────┘   │
│            │                                                  │
│            ▼ URL Scheme / JavaScript Interface / 拦截器       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WebView 通信通道                                    │   │
│  │  Android: @JavascriptInterface                       │   │
│  │  iOS: window.webkit.messageHandlers                  │   │
│  │  兜底: URL Scheme（特殊场景降级）                │   │
│  └──────────────────────────────────────────────────────┘   │
│            │                                                  │
│            ▼ 消息解析与分发                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Native Bridge Core (核心调度)                       │   │
│  │  - 协议解析 (JSON / 特定格式)                         │   │
│  │  - 任务队列管理                                        │   │
│  │  - 异步回调映射 (Callback ID ↔ Native 回调)           │   │
│  └──────────────────────────────────────────────────────┘   │
│            │                                                  │
│            ▼ 分发给 Native Module                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Native Module 层                                     │   │
│  │  - 各业务模块实现 (相册、定位、支付等)                │   │
│  │  - 返回结果 / 异步回调                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│            │                                                  │
│            ▼ 结果返回到 H5                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  H5 回调执行                                          │   │
│  │  - 通过 evaluateJavascript() 注入回调                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 核心设计要素

#### 4.2.1 通信协议设计

> 实际最佳实践为了性能用极简协议（短 key + 固定结构），详见 → [高性能协议设计](../h5-js-bridge.md#q3-bridge-协议怎么设计业界最佳实践--举例)

**请求协议格式**：
```javascript
// JS 发起调用
{
  "id": "callback_123456",      // 唯一回调 ID
  "module": "device",           // Native 模块名
  "method": "getLocation",      // 方法名
  "params": {                   // 参数
    "enableHighAccuracy": true
  },
  "callbackId": "cb_789"        // 回调函数 ID（用于异步）
}
```

**响应协议格式**：
```javascript
// Native 返回结果
{
  "id": "callback_123456",      // 对应请求 ID
  "code": 0,                    // 状态码 (0=成功)
  "data": {                     // 返回数据
    "latitude": 39.9042,
    "longitude": 116.4074
  },
  "message": "success"          // 提示信息
}
```

#### 4.2.1.1 核心数据结构设计

**JS 侧核心数据结构是 Map（映射表），不是任务队列。**

#### 为什么是 Map？
1. **回调映射必需**：`{callbackId: callbackFunction}` - 用于管理异步回调
2. **模块注册必需**：`{moduleName: moduleObject}` - 用于模块发现
3. **请求映射可选**：`{requestId: requestInfo}` - 用于超时清理

#### Map 与任务队列的关系
- **Map 是核心必需**：管理 JS ↔ Native 的对应关系
- **任务队列是优化层**：解决并发、顺序、超时等性能问题
- **任务队列内部也依赖 Map**：管理任务状态和回调

#### 示例实现
```javascript
class JSBridgeCore {
  constructor() {
    // 核心 Map
    this.callbackMap = new Map();     // {callbackId: callbackFunction}
    this.moduleMap = new Map();       // {moduleName: moduleInstance}
    this.requestMap = new Map();      // {requestId: {timeout, cleanup}}
    
    // 可选：任务队列（基于 Map 的优化）
    this.taskQueue = [];
    this.pendingTasks = new Map();    // {taskId: taskInfo}
  }
}
```

#### 4.2.2 任务队列设计（优化层，非必须但推荐）

**为什么需要任务队列？**
1. **并发控制**：WebView 中 JS 调用是单线程的，但 Native 操作可能是异步的
2. **顺序保证**：保证回调的顺序与调用顺序一致
3. **生命周期管理**：处理页面跳转、WebView 销毁等情况

**任务队列实现**：

```javascript
// JS 侧任务队列
class JSBridgeQueue {
  constructor() {
    this.queue = [];              // 待处理任务队列
    this.pendingCallbacks = {};   // 回调映射 {callbackId: callback}
    this.maxConcurrent = 3;       // 最大并发数
    this.currentConcurrent = 0;   // 当前并发数
  }
  
  // 添加任务
  addTask(module, method, params, callback) {
    const taskId = this.generateId();
    const task = {
      id: taskId,
      module,
      method,
      params,
      callback
    };
    
    this.queue.push(task);
    this.processQueue();
    return taskId;
  }
  
  // 处理队列
  processQueue() {
    while (this.currentConcurrent < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.executeTask(task);
      this.currentConcurrent++;
    }
  }
  
  // 执行任务（实际调用 Native）
  executeTask(task) {
    // 1. 生成回调 ID
    const callbackId = `cb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 2. 注册回调
    this.pendingCallbacks[callbackId] = (result) => {
      task.callback(result);
      this.currentConcurrent--;
      this.processQueue(); // 继续处理下一个任务
    };
    
    // 3. 调用 Native
    this.callNative(task.module, task.method, task.params, callbackId);
  }
}
```

#### 4.2.3 异步动作处理

**三种异步处理模式**：

1. **Callback 模式**（最常用）：
```javascript
// JS 调用
jsBridge.callNative('device', 'getLocation', {
  enableHighAccuracy: true
}, (result) => {
  console.log('位置:', result);
});

// Native 异步执行后通过 evaluateJavascript 回调, js端bridge会有一个Map<callbackId, callback>
// callbackId 创建：JS 调用 callNative() 时立即生成（时间戳+随机数），存入 Map
// callbackId 销毁：回调执行后立即 delete | 超时(30s)后 delete | 页面销毁时 clear 全部
webView.evaluateJavascript(`
  window.jsBridge.callback('${callbackId}', ${JSON.stringify(result)});
`, null);
```

2. **Promise 模式**：
```javascript
// 封装为 Promise
// 本质上还是 将callback 模式在js层 封装为 promise
// module = bridge:native侧的功能模块名（命名空间），如 "device"/"auth"/"storage"
//   → native 收到后按 module 找到对应模块实例，再按 method 调具体方法
jsBridge.callNativePromise = function(module, method, params) {
  return new Promise((resolve, reject) => {
    jsBridge.callNative(module, method, params, (result) => {
      if (result.code === 0) {
        resolve(result.data);
      } else {
        reject(new Error(result.message));
      }
    });
  });
};

// 使用
try {
  const location = await jsBridge.callNativePromise('device', 'getLocation', {});
  console.log(location);
} catch (error) {
  console.error('获取位置失败:', error);
}
```

3. **Event 模式**（用于持续监听）：
```javascript
// 注册事件监听
jsBridge.addEventListener('locationChange', (data) => {
  console.log('位置变化:', data);
});

// Native 主动推送
webView.evaluateJavascript(`
  window.jsBridge.triggerEvent('locationChange', ${JSON.stringify(data)});
`, null);
```

### 4.3 Android 平台实现

#### 4.3.1 主要通信方式

**1. @JavascriptInterface（Android 4.4+，推荐）**：
```kotlin
class JSBridge(private val context: Context) {
    
    @JavascriptInterface
    fun callNative(jsonStr: String): String {
        // 解析 JSON
        val request = parseRequest(jsonStr)
        
        // 处理请求
        return when (request.module) {
            "device" -> handleDeviceRequest(request)
            "storage" -> handleStorageRequest(request)
            else -> createErrorResponse("Module not found")
        }
    }
    
    // 注册到 WebView
    webView.addJavascriptInterface(jsBridge, "jsBridge")
}
```

**2. URL Scheme 拦截**：
```kotlin
webView.webViewClient = object : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        if (url?.startsWith("jsbridge://") == true) {
            // 解析 jsbridge://module/method?params=...
            handleJSBridgeUrl(url)
            return true // 拦截，不跳转
        }
        return super.shouldOverrideUrlLoading(view, url)
    }
}
```

**3. prompt() 拦截**：
```kotlin
webView.webChromeClient = object : WebChromeClient() {
    override fun onJsPrompt(view: WebView?, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?): Boolean {
        if (message?.startsWith("JSBridge:") == true) {
            val jsonStr = message.substring(9) // 去掉 "JSBridge:"
            val response = handleJSBridgeRequest(jsonStr)
            result?.confirm(response)
            return true
        }
        return super.onJsPrompt(view, url, message, defaultValue, result)
    }
}
```

#### 4.3.2 Native 侧任务队列

```kotlin
class NativeTaskQueue {
    private val executor = Executors.newFixedThreadPool(4)
    private val pendingCallbacks = ConcurrentHashMap<String, (String) -> Unit>()
    
    fun handleRequest(request: JSRequest): String {
        return when (request.type) {
            RequestType.SYNC -> handleSyncRequest(request)
            RequestType.ASYNC -> {
                val callbackId = generateCallbackId()
                // 提交异步任务
                executor.submit {
                    val result = handleAsyncRequest(request)
                    // 任务完成，回调 JS
                    callbackToJS(callbackId, result)
                }
                // 立即返回，告诉 JS 回调 ID
                createPendingResponse(callbackId)
            }
        }
    }
    
    private fun callbackToJS(callbackId: String, result: String) {
        // 通过 evaluateJavascript 回调到 JS
        webView.evaluateJavascript("""
            window.jsBridge.invokeCallback('$callbackId', $result);
        """.trimIndent(), null)
    }
}
```

### 4.4 iOS 平台实现

#### 4.4.1 主要通信方式

**1. JavaScriptCore + messageHandlers**：
```swift
// 创建 WKWebView 配置
let config = WKWebViewConfiguration()
let userContentController = WKUserContentController()

// 注册消息处理器
userContentController.add(self, name: "jsBridge")

// JS 调用
window.webkit.messageHandlers.jsBridge.postMessage({
    module: 'device',
    method: 'getLocation',
    params: {enableHighAccuracy: true}
});

// Native 处理
extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "jsBridge",
              let body = message.body as? [String: Any] else { return }
        
        // 处理请求
        handleJSBridgeRequest(body)
    }
}
```

**2. URL Scheme 拦截**：
```swift
func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if let url = navigationAction.request.url,
       url.scheme == "jsbridge" {
        // 解析 jsbridge://module/method?params=...
        handleJSBridgeUrl(url)
        decisionHandler(.cancel) // 拦截
        return
    }
    decisionHandler(.allow)
}
```

**3. evaluateJavaScript 回调**：
```swift
// Native 异步处理完成后回调到 JS
func callbackToJS(callbackId: String, result: [String: Any]) {
    let jsonString = // 转换为 JSON 字符串
    let js = "window.jsBridge.invokeCallback('\(callbackId)', \(jsonString));"
    
    webView.evaluateJavaScript(js) { (result, error) in
        if let error = error {
            print("JS 回调失败: \(error)")
        }
    }
}
```

### 4.5 性能优化策略

#### 4.5.1 通信优化

1. **协议精简**：
   - 使用简短的字段名（如 "m" 代替 "module"）
   - Base64 编码二进制数据
   - 压缩大体积参数

2. **批处理机制**：
```javascript
// JS 侧批量调用
jsBridge.batchCall([
  {module: 'device', method: 'getInfo'},
  {module: 'storage', method: 'getItem', params: {key: 'token'}}
], (results) => {
  // results 是数组，包含所有结果
});

// Native 批量处理
class BatchHandler {
    fun handleBatch(requests: List<JSRequest>): List<JSResponse> {
        return requests.parallelStream()
            .map { handleSingleRequest(it) }
            .collect(Collectors.toList())
    }
}
```

3. **连接复用**：
   - 长连接通道（WebSocket/WebRTC）
   - 心跳保持
   - 连接池管理

#### 4.5.2 内存管理

1. **回调清理**：
   - 设置回调超时（默认 30s）
   - 页面卸载时清理所有回调
   - WeakReference 持有回调避免内存泄漏

2. **资源释放**：
```kotlin
// Android
class JSBridge : JavaScriptInterface {
    private val callbackMap = WeakHashMap<String, WeakReference<JSBridgeCallback>>()
    
    override fun onDestroy() {
        callbackMap.clear()
        executor.shutdown()
    }
}
```

### 4.6 安全设计

#### 4.6.1 安全策略

1. **域名白名单**：
```kotlin
fun isAllowedDomain(url: String): Boolean {
    val allowedDomains = listOf("trusted.com", "company.com")
    return allowedDomains.any { url.contains(it) }
}
```

2. **方法权限控制**：
```kotlin
data class MethodPermission(
    val module: String,
    val method: String,
    val minAppVersion: Int,    // 最低版本要求
    val requireLogin: Boolean, // 需要登录
    val requirePermission: String? // 需要系统权限
)

fun checkPermission(module: String, method: String): Boolean {
    val permission = permissionMap["$module.$method"]
    return permission?.let {
        appVersion >= it.minAppVersion &&
        (!it.requireLogin || isUserLoggedIn()) &&
        (it.requirePermission == null || hasPermission(it.requirePermission))
    } ?: false
}
```

3. **请求签名校验**：
```javascript
// JS 侧生成签名
function generateSignature(params, timestamp, secret) {
    const str = Object.keys(params).sort()
        .map(key => `${key}=${params[key]}`)
        .join('&') + `&timestamp=${timestamp}&secret=${secret}`;
    return md5(str);
}

// Native 侧验证
fun verifySignature(request: JSRequest): Boolean {
    val expected = generateSignature(request.params, request.timestamp, SECRET_KEY)
    return expected == request.signature
}
```

### 4.7 调试与监控

#### 4.7.1 调试工具

1. **Bridge 调试面板**：
   - 实时显示 Bridge 调用记录
   - 模拟 Native 返回
   - 性能统计

2. **Chrome DevTools 插件**：
   - 拦截 Bridge 调用
   - 查看调用栈
   - 性能分析

#### 4.7.2 监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| **调用成功率** | 成功调用数 / 总调用数 | < 95% |
| **平均响应时间** | 从调用到返回的时间 | > 500ms |
| **并发数** | 同时处理的请求数 | > 20 |
| **错误类型分布** | 各错误��出现频率 | - |
| **回调泄漏数** | 未清理的回调数 | > 10 |

### 4.8 总结：WebView JS Bridge 设计要点

1. **通信通道选择**：
   - Android：@JavascriptInterface（主推）+ URL Scheme（兼容）
   - iOS：messageHandlers（主推）+ URL Scheme

2. **任务队列必要性**：
   - **必须设计**：处理并发、保证顺序、管理生命周期
   - 典型实现：JS 侧队列 + Native 侧队列

3. **异步处理模式**：
   - Callback：最基础，兼容性好
   - Promise：现代，链式调用
   - Event：持续监听场景

4. **性能关键**：
   - 协议精简，减少序列化开销
   - 批处理减少通信次数
   - 及时清理回调，避免内存泄漏

5. **安全不可忽视**：
   - 域名白名单
   - 方法权限控制
   - 请求签名校验

6. **完备性设计**：
   - 错误处理（超时、异常、网络错误）
   - 调试工具（开发阶段必备）
   - 监控体系（线上监控）

---

## QA

### Q: 为什么 H5 WebView 不像 RN 那样，每个 Native API 直接注入成 external function？

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

### Q: iOS 的 messageHandlers 具体做不到什么？

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
