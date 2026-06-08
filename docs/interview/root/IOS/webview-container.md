# iOS WKWebView 容器定制

> 解决什么问题：和 Android 同理——系统 WKWebView 直接用冷启动慢、无离线能力、通信受限。定制容器 = 在 iOS Native 侧给 H5 加速。
>
> 本质：WKWebView 容器 = WKWebView + 预创建/复用 + 离线包 + 接口预请求 + WKScriptMessageHandler 通信 + Cookie 同步。
>
> iOS 特有问题：WKWebView 跑在独立进程（和 App 进程隔离）→ Cookie 不共享、白屏回收、进程间通信开销。

---

## 目录

- [WKWebView 的特殊性](#wkwebview-的特殊性)
- [容器架构](#容器架构)
- [预创建与复用池](#预创建与复用池)
- [离线包方案](#离线包方案)
- [接口预请求](#接口预请求)
- [通信机制（JSBridge）](#通信机制jsbridge)
- [Cookie 同步（iOS 特有问题）](#cookie-同步ios-特有问题)
- [WKWebView 白屏回收](#wkwebview-白屏回收)
- [Q&A](#qa)

---

## WKWebView 的特殊性

```
WKWebView vs 旧的 UIWebView：
  UIWebView：和 App 同进程，性能差但数据共享方便（已废弃）
  WKWebView：独立进程渲染，性能好但有隔离问题

WKWebView 独立进程带来的问题：
  1. Cookie 不共享：App 的 HTTPCookieStorage 和 WKWebView 的 Cookie 是分开的
  2. 白屏回收：系统内存紧张时杀掉 WKWebView 进程 → 页面变白（webViewWebContentProcessDidTerminate）
  3. POST body 丢失：WKWebView 拦截请求时拿不到 POST body（进程隔离限制）
  4. 本地文件加载限制：安全策略限制直接加载本地 file:// 文件

和 Android 的关键区别：
  Android WebView：和 App 同进程 → Cookie 共享、shouldInterceptRequest 能拿到 body
  iOS WKWebView：独立进程 → Cookie 不共享、拦截能力受限
```

---

## 容器架构

```
iOS 容器的分层（和 Android 对称）：

  ┌────────────────────────────────────┐
  │         H5 页面（JS/CSS/HTML）      │
  ├────────────────────────────────────┤
  │     WKScriptMessageHandler 通信层   │  ← 协议 + 鉴权 + 分发
  ├────────────────────────────────────┤
  │         容器服务层                   │  ← 离线包 / 预请求 / Cookie 同步
  ├────────────────────────────────────┤
  │         WKWebView 管理层            │  ← 预创建 / 复用池 / 白屏回收处理
  ├────────────────────────────────────┤
  │     WKWebView（WebKit 独立进程）    │  ← 底层渲染
  └────────────────────────────────────┘
```

---

## 预创建与复用池

```swift
// Swift 实现 WebView 池
class WebViewPool {
  static let shared = WebViewPool()
  private var pool: [WKWebView] = []
  
  // App 启动时预热
  func preload(count: Int = 2) {
    for _ in 0..<count {
      let config = WKWebViewConfiguration()
      config.userContentController = setupBridge()  // 预注入 JSBridge
      let webView = WKWebView(frame: .zero, configuration: config)
      // 预加载基础 bridge 页面
      webView.loadHTMLString(bridgeHTML, baseURL: nil)
      pool.append(webView)
    }
  }
  
  // 获取
  func obtain() -> WKWebView {
    return pool.isEmpty ? createNew() : pool.removeFirst()
  }
  
  // 归还
  func recycle(_ webView: WKWebView) {
    webView.loadHTMLString("", baseURL: nil)
    pool.append(webView)
  }
}

// 注意：WKWebView 的 configuration 在创建时确定，后续不能修改
// → 预创建时就要把 userContentController（JSBridge）配好
```

---

## 离线包方案

```
iOS 的离线包拦截比 Android 复杂：
  WKWebView 没有直接等价于 shouldInterceptRequest 的 API

两种实现方式：

方式 1：WKURLSchemeHandler（iOS 11+，推荐）
  注册自定义 URL Scheme → 拦截该 scheme 下的所有请求 → 返回本地文件

  let config = WKWebViewConfiguration()
  config.setURLSchemeHandler(OfflineSchemeHandler(), forURLScheme: "offline")
  // H5 加载地址变为：offline://page/index.html
  // 所有 offline:// 请求被 OfflineSchemeHandler 拦截 → 从本地读取

  class OfflineSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
      let path = urlSchemeTask.request.url?.path ?? ""
      if let data = loadFromLocalPackage(path) {
        let response = URLResponse(url: urlSchemeTask.request.url!,
                                    mimeType: getMimeType(path),
                                    expectedContentLength: data.count,
                                    textEncodingName: "utf-8")
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
      }
    }
  }

方式 2：NSURLProtocol（全局拦截，兼容性好但有坑）
  注册自定义 NSURLProtocol → 拦截 http/https 请求
  问题：WKWebView 默认不走 NSURLProtocol（独立进程）
  需要用私有 API 注册：WKBrowsingContextController.registerSchemeForCustomProtocol("https")
  → 有审核风险，不推荐正式项目使用
```

---

## 接口预请求

```
和 Android 逻辑一样：

  用户点击 → Native 同时做：
    ① 取 WebView → 加载 H5
    ② 根据页面 URL 规则 → 提前发数据接口 → 缓存结果
  → H5 JS 请求数据时 → 通过 JSBridge 问 Native "有没有预请求结果？"
  → 有 → 直接返回（不走网络）
  → 没有 → 正常走网络

iOS 实现要点：
  - 预请求用 URLSession（Native 网络层），不经过 WKWebView
  - 结果存在 Native 内存中（Dictionary 按 URL key 存）
  - H5 通过 JSBridge 调 Native 获取预请求结果
```

---

## 通信机制（JSBridge）

```
iOS WKWebView 的通信方式：

H5 → Native：
  // 1. WKScriptMessageHandler（推荐）
  window.webkit.messageHandlers.bridge.postMessage({ method: 'camera', params: {} })
  
  // Native 侧注册 handler：
  config.userContentController.add(self, name: "bridge")
  
  // 收到消息：
  func userContentController(_ controller: WKUserContentController, 
                             didReceive message: WKScriptMessage) {
    let body = message.body as? [String: Any]
    let method = body?["method"] as? String
    bridgeRouter.dispatch(method, params: body?["params"])
  }

Native → H5：
  webView.evaluateJavaScript("window.bridgeCallback('\(callbackId)', \(jsonData))") { result, error in
    // 执行完成
  }

和 Android 的区别：
  Android：addJavascriptInterface 直接注入对象到 JS window
  iOS：不能注入对象，只能通过 postMessage 发消息（更安全，但是异步的）
```

---

## Cookie 同步（iOS 特有问题）

```
问题：
  App 登录后 Cookie 存在 HTTPCookieStorage 里
  WKWebView 跑在独立进程 → 有自己的 Cookie 存储 → 不共享 App 的 Cookie
  → H5 页面拿不到登录态 → 请求 401

解法：手动同步 Cookie

  // 加载页面前：从 App Cookie → 注入到 WKWebView
  func syncCookies(to webView: WKWebView, for url: URL) {
    let cookies = HTTPCookieStorage.shared.cookies(for: url) ?? []
    let store = webView.configuration.websiteDataStore.httpCookieStore
    
    for cookie in cookies {
      store.setCookie(cookie)
    }
  }

  // 页面加载后：从 WKWebView Cookie → 同步回 App（H5 可能设了新 Cookie）
  func syncCookiesBack(from webView: WKWebView) {
    webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
      for cookie in cookies {
        HTTPCookieStorage.shared.setCookie(cookie)
      }
    }
  }

  // 首次加载还可以通过 JS 注入 document.cookie：
  let cookieScript = WKUserScript(
    source: "document.cookie = 'token=xxx; path=/;'",
    injectionTime: .atDocumentStart,
    forMainFrameOnly: false
  )
  config.userContentController.addUserScript(cookieScript)
```

---

## WKWebView 白屏回收

```
问题：
  iOS 内存紧张时，系统会终止 WKWebView 的渲染进程（Content Process）
  → 页面变白（还在，但内容没了）
  → 不会触发 didFailNavigation（不是加载失败）

检测：
  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    // 被系统回收了 → 自动 reload
    webView.reload()
  }

  // 补充检测：定时检查 webView.title 是否为空
  // 正常页面有 title → 回收后 title 变空

预防：
  - 不要同时开太多 WKWebView（每个都占独立进程内存）
  - 不可见的 WebView 及时释放
  - 复用池控制数量上限
```

---

## Q&A

**Q：iOS 离线包为什么比 Android 难做？**

A：WKWebView 跑在独立进程，没有 `shouldInterceptRequest` 这种直接拦截 HTTP 请求的 API。必须用 WKURLSchemeHandler（自定义 scheme）或 NSURLProtocol（私有 API）绕过。Android WebView 和 App 同进程，拦截能力强得多。

**Q：WKScriptMessageHandler 和 Android addJavascriptInterface 的区别？**

A：Android 直接在 JS 的 window 上注入一个对象（同步调用）；iOS 只能通过消息通道发消息（异步）。iOS 更安全（JS 不能直接调 Native 方法），但通信是异步的，需要 callbackId 机制做异步回调。

**Q：为什么不用 UIWebView？**

A：Apple 已废弃 UIWebView（2020 年起不允许新提交），且性能差（和 App 同进程，JS 执行阻塞 UI）。WKWebView 是唯一选择。

**Q：iOS 的 WebView 容器和 Android 的核心差异点？**

A：
- Cookie：Android 共享，iOS 不共享（需手动同步）
- 请求拦截：Android 有 shouldInterceptRequest 可拦截任何请求；iOS 只能用自定义 scheme 或私有 API
- 白屏回收：iOS 独有（独立进程被系统杀）
- POST body：iOS WKWebView 拦截时拿不到 POST body
- 安全性：iOS 更严格（不能注入全局对象，只能 postMessage）
