# 定制 WebView

## 目录

- [本质先行](#本质先行)
- [Android](#android)
  - [使用: 最小例子](#使用-最小使用例子)
  - [核心能力](#核心能力)
  - [定制优化](#定制优化)
- [iOS](#ios)
  - [使用: 最小例子](#ios-使用)
  - [核心能力](#ios-核心能力)
  - [定制优化](#ios-定制优化)
- [QA](#qa)
  - [Q1: 并行预请求怎么知道要预请求哪些接口？](#q1-并行预请求怎么知道要预请求哪些接口)
  - [Q2: InetAddress 是什么？](#q2-inetaddress-是什么)
  - [Q3: WebView 支持 HTTP 缓存和 Service Worker 吗？](#q3-webview-支持-http-缓存和-service-worker-吗)
  - [Q4: 加载 loading 动画怎么做？](#q4-加载-loading-动画怎么做)
  - [Q5: 加载失败兜底页面？](#q5-加载失败兜底页面)
  - [Q6: 多次进度条（重定向）怎么优化？](#q6-多次进度条重定向怎么优化)

---

## 本质先行: 定制 WebView 核心 5 件事

| # | 做什么 | 为什么 | 怎么做 |
|---|--------|--------|--------|
| 1 | **池化预创建** | WebView 初始化慢（200-500ms） | 闲时预创建 N 个放池中，用时取 |
| 2 | **离线包** | 省网络加载时间 | 拦截请求返回本地资源（`shouldInterceptRequest` / `WKURLSchemeHandler`） |
| 3 | **并行预请求** | WebView 初始化和数据请求串行 → 慢 | Native 启动时就发首屏接口，WebView 加载完直接用 |
| 4 | **JS Bridge** | H5 需要调 Native 能力 | 统一 callNative 入口 + callbackId 异步回调 |
| 5 | **安全** | 防恶意页面调 Bridge | [域名白名单](#注释域名白名单) + HTTPS 强制 + 敏感 API token 校验 |

## Android

### 使用: 最小使用例子

```kotlin
// ─── Android (Kotlin) ───
import android.webkit.WebView  // SDK 自带，无额外依赖

val webView = WebView(context)
webView.settings.javaScriptEnabled = true
webView.loadUrl("https://example.com")

// WebView 是一个 View，必须加到视图树才显示
// 在 Activity 的 onCreate() 里调用，把一个 View 设为这个页面的根视图
setContentView(webView)  // 作为整个 Activity 内容
// 或：container.addView(webView)  // 加到某个父容器
```

```xml
<!-- AndroidManifest.xml 需要网络权限 -->
<uses-permission android:name="android.permission.INTERNET" />
```

> webview不需要在XML中声明，代码创建即可。但需要 addView 到视图树才会渲染到屏幕：

### 核心能力

| 能力 | API | 说明 |
|------|-----|------|
| 注入 Bridge | `addJavascriptInterface(obj, name)` | 向 JS global 注入 Native 对象 |
| 执行 JS | `evaluateJavascript(code, callback)` | Native 调 JS |
| 拦截请求 | `shouldInterceptRequest(request)` | 拦截资源请求（离线包） |
| 拦截导航 | `shouldOverrideUrlLoading(url)` | 拦截跳转（URL Scheme） |
| 页面生命周期 | `onPageStarted` / `onPageFinished` | 监听加载状态 |


### 定制优化

| # | 优化项 | 做法 | 收益 |
|---|--------|------|------|
| 1 | **池化预创建** | 闲时预创建 WebView 实例放入池中，用时取 | 省 200-500ms 初始化 |
| 2 | **离线包** | 拦截 shouldInterceptRequest，优先返回本地资源 | 省网络耗时 |
| 3 | **并行预请求** | WebView 初始化同时 Native 发起数据请求 | 串行变并行 |
| 4 | **DNS 预解析** | 启动时预热常用域名 | 省 50-200ms |
| 5 | **安全管控** | 域名白名单 + Bridge 方法权限控制 | 防恶意页面调敏感 API |

统一封装类，覆盖上述 5 点：

```kotlin
// ─── Android (Kotlin) ───
object WebViewPool {
    private val pool = mutableListOf<WebView>()

    // ① 池化预创建（闲时）
    // WebView 必须在主线程创建（它是 View），用 IdleHandler 在主线程闲时创建，不阻塞启动
    fun preload(context: Context) {
        Looper.myQueue().addIdleHandler {
            pool.add(createWebView(context))
            false
        }
    }

    // 取 WebView（从池中取或新建）
    fun obtain(context: Context): WebView =
        if (pool.isNotEmpty()) pool.removeFirst() else createWebView(context)

    // 回收：清空页面内容但保留实例（省下次 200-500ms 创建开销）
    fun recycle(webView: WebView) {
        webView.loadUrl("about:blank")  // 释放页面 JS/DOM 内存
        pool.add(webView)
    }

    private fun createWebView(context: Context): WebView {
        return WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true

            // ② 离线包：拦截资源请求，优先返回本地文件
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                    OfflinePackage.getResource(request.url)
                        ?: super.shouldInterceptRequest(view, request)
            }

            // ⑤ 安全管控：注入 Bridge（内部做域名白名单 + 方法权限校验）
            addJavascriptInterface(NativeBridge(), "nativeBridge")
        }
    }
}

// ③ 并行预请求（使用时）
val preloadCache = mutableMapOf<String, String>()  // url → 预请求结果

fun loadPage(url: String) {
    val webView = WebViewPool.obtain(context)
    // Native 并行发起业务数据请求（不等 WebView 加载完 HTML）
    thread { preloadCache[url] = api.fetchPageData(url) }
    webView.loadUrl(url)
    // H5 加载完后通过 Bridge 调 getPreloadData() 直接取结果，省掉一次网络等待
}

// ④ DNS 预解析（App 启动时，跟 WebView 无关）
fun prewarmDns() {
    thread { InetAddress.getByName("cdn.example.com") }  // 仅 DNS 解析，不加载页面
}
```

--- 

## iOS

<a id="ios-使用"></a>
### 使用: 最小使用例子

```swift
// ─── iOS (Swift) ───
import WebKit  // 系统自带，无额外依赖

let webView = WKWebView(frame: view.bounds)
//  把 WebView 加到这个页面的视图树上
// view = UIViewController 的根视图（等同 Android 的 setContentView）, 每个 ViewController 都有一个 view 属性，相当于 Android 的 Activity 的根 ViewGroup
view.addSubview(webView)
webView.load(URLRequest(url: URL(string: "https://example.com")!))
```

<a id="ios-核心能力"></a>
### 核心能力

| 能力 | API | 说明 |
|------|-----|------|
| 注册 Bridge | `userContentController.add(handler, name)` | 注册消息处理器，JS 通过 postMessage 调 |
| 执行 JS | `evaluateJavaScript(code)` | Native 调 JS |
| 拦截请求 | `WKURLSchemeHandler`（iOS 11+） | 自定义 scheme 拦截（离线包） |
| 页面生命周期 | `WKNavigationDelegate` | didStartNavigation / didFinish / didFail |
| 进程恢复 | `webViewWebContentProcessDidTerminate` | WebContent 进程被 kill 后重新加载 |

<a id="ios-定制优化"></a>
### 定制优化

| # | 优化项 | 做法 | 收益 |
|---|--------|------|------|
| 1 | **池化预创建** | 闲时（CFRunLoopObserver beforeWaiting）预创建 WKWebView | 省 200-400ms |
| 2 | **共享 WKProcessPool** | 所有 WKWebView 共享一个进程池 | Cookie/Session 共享，免重复登录 |
| 3 | **离线包** | `WKURLSchemeHandler` 拦截自定义 scheme 返回本地资源 | 省网络耗时 |
| 4 | **进程被 kill 恢复** | `webViewWebContentProcessDidTerminate` 中 reload | 防白屏 |

// 写一个最佳实践封装吧 + 上面的核心能力+核心优化, 不要噪音

```swift
// ─── iOS (Swift) ───
import WebKit

class WebViewPool {
    static let shared = WebViewPool()
    private var pool: [WKWebView] = []
    private let sharedProcessPool = WKProcessPool()  // ② 共享进程池

    // ① 闲时预创建
    func preload() {
        let observer = CFRunLoopObserverCreateWithHandler(nil, CFRunLoopActivity.beforeWaiting.rawValue, false, 0) { [weak self] _, _ in
            self?.pool.append(self!.createWebView())
        }
        CFRunLoopAddObserver(CFRunLoopGetMain(), observer, .defaultMode)
    }

    func obtain() -> WKWebView {
        pool.isEmpty ? createWebView() : pool.removeLast()
    }

    func recycle(_ webView: WKWebView) {
        webView.load(URLRequest(url: URL(string: "about:blank")!))
        pool.append(webView)
    }

    private func createWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        config.processPool = sharedProcessPool  // ② Cookie/Session 共享
        // ③ 离线包：注册自定义 scheme handler
        config.setURLSchemeHandler(OfflineHandler(), forURLScheme: "hybrid")
        // Bridge 注册
        config.userContentController.add(BridgeHandler.shared, name: "nativeBridge")

        let webView = WKWebView(frame: .zero, configuration: config)
        // ④ 进程被 kill 恢复
        webView.navigationDelegate = self
        return webView
    }
}

extension WebViewPool: WKNavigationDelegate {
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()  // 防白屏
    }
}
```

## QA

### Q1: 并行预请求怎么知道要预请求哪些接口？

Native 不是自动分析 HTML 的（HTML 还没加载完呢）。靠**提前配置映射关系**：

| 方案 | 做法 |
|------|------|
| 配置表 | JSON：`{ "h5.com/home": ["/api/feed", "/api/user"] }`，Native 查表预请求 |
| URL 约定 | 页面 URL 带参数：`h5.com/home?prefetch=/api/feed` |
| 服务端下发 | App 启动拉取预请求规则，动态更新 |

本质 = 人工配置，不是智能发现。

---

### Q2: InetAddress 是什么？

`java.net.InetAddress` = Java 标准库的 DNS 解析类。`getByName(host)` 只做 DNS 查询（域名→IP），不建立连接、不发请求。结果会被系统 DNS 缓存，后续 WebView 加载同域名时直接命中缓存。

---

### Q3: WebView 支持 HTTP 缓存和 Service Worker 吗？

| 缓存类型 | Android WebView | 说明 |
|---------|----------------|------|
| HTTP 缓存（Cache-Control/ETag） | ✅ 支持 | 默认开启，遵循标准 HTTP 缓存语义 |
| Service Worker | ✅ 支持（Android 5.0+） | H5 可以注册 SW 做离线缓存 |
| DOM Storage（localStorage） | ✅ 需手动开启 | `settings.domStorageEnabled = true` |
| Application Cache | ❌ 已废弃 | 用 SW 替代 |

> 所以 WebView 里的 H5 可以像浏览器一样用 HTTP 缓存和 Service Worker。离线包方案（`shouldInterceptRequest`）是在这之上的**额外层**——优先级高于 HTTP 缓存，Native 完全控制。

---

### Q4: 加载 loading 动画怎么做？

WebView 本身不提供 loading UI，需要 Native 自己盖一层：

```kotlin
// 显示 loading（WebView 上面盖一个 Native View）
loadingView.visibility = View.VISIBLE

webView.webViewClient = object : WebViewClient() {
    override fun onPageFinished(view: WebView, url: String) {
        loadingView.visibility = View.GONE  // 页面加载完隐藏
    }
}
```

更好的体验：用骨架屏（Skeleton）替代转圈，内联在 HTML 里或 Native 侧盖一个骨架屏 View。

---

### Q5: 加载失败兜底页面？

是的，必须有。`onReceivedError` 回调里切换到本地兜底页：

```kotlin
override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
    if (request.isForMainFrame) {  // 只处理主文档失败（不管子资源）
        webView.visibility = View.GONE
        errorView.visibility = View.VISIBLE  // 显示兜底页（重试按钮 + 错误提示）
    }
}
```

---

### Q6: 多次进度条（重定向）怎么优化？

原因：每次 302 重定向都触发 `onPageStarted` → 进度条重新开始。

方案：**延迟防抖**（debounce）——进度条延迟 300ms 显示，重定向在 300ms 内完成就不会闪。

```kotlin
// WebViewClient 设置给 WebView 的回调监听器

webView.webViewClient = object : WebViewClient() {
  var showJob: Job? = null

  override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
      showJob?.cancel()
      showJob = lifecycleScope.launch {
          delay(300)  // 300ms 内再次触发会被 cancel（重定向被过滤）
          showProgressBar()
      }
  }

  override fun onPageFinished(view: WebView, url: String) {
      showJob?.cancel()
      hideProgressBar()
  }
}
```

---

# 注释

<a id="注释域名白名单"></a>
### 域名白名单

内置硬编码在 Native 层（配置文件或代码常量）。WebView 加载页面时，`shouldOverrideUrlLoading` / `decidePolicyFor` 中检查 URL 的 origin 是否在白名单内——不在的页面不注入 Bridge 对象（`@JavascriptInterface` 不挂 / `WKScriptMessageHandler` 不注册）。也可以做成可配置（从服务端下发白名单），但基础版硬编码就够。
