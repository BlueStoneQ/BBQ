# WebView 专题

## 目录

- [1. WebView 加载 H5 页面性能优化](#1-webview-加载-h5-页面性能优化)
  - [核心指标](#核心指标)
  - [加载流程与耗时分布](#加载流程与耗时分布)
  - [Android 侧优化](#android-侧优化)
  - [iOS 侧优化](#ios-侧优化)
  - [通用优化（前端侧）](#通用优化前端侧)
- [2. 定制 WebView](#2-定制-webview)
  - [本质](#本质)
  - [解决的问题](#解决的问题)
  - [业界最佳实践](#业界最佳实践)
- [3. 定制 WebView 与 RN 的关系](#3-定制-webview-与-rn-的关系)
- [4. WebView 在 Android 和 iOS 中是什么](#4-webview-在-android-和-ios-中是什么)
- [5. Native 到 JS 回调机制：两类方式](#5-native-到-js-回调机制两类方式)

---

## 1. WebView 加载 H5 页面性能优化

### 本质

**WebView 加载慢的根因 = 串行链路太长**。从用户点击到页面可见，经历：WebView 初始化 → DNS → 连接 → 下载 HTML → 解析 → 下载 CSS/JS → 执行 → 渲染。优化的核心是**并行化 + 预加载 + 缓存**。

### 核心指标

| 指标 | 定义 | 目标值 | 检测方式 |
|------|------|--------|---------|
| **WebView 初始化耗时** | 创建 WebView 实例到 ready | < 200ms | Native 埋点 |
| **首屏白屏时间** | 用户点击 → 首屏内容可见 | < 1.5s | Navigation Timing API + Native 埋点 |
| **可交互时间（TTI）** | 页面可响应用户操作 | < 2s | PerformanceObserver |
| **页面完全加载** | 所有资源加载完成 | < 3s | window.onload |
| **JS Bridge 初始化** | Bridge 注入完成可调用 | < 100ms | Native 埋点 |

### 加载流程与耗时分布

```
用户点击（T0）
  │
  ├─ WebView 初始化（200-500ms）← 最大瓶颈
  │    - 创建 WebView 实例
  │    - 初始化渲染进程 / WebKit 引擎
  │    - 注入 JS Bridge
  │
  ├─ 网络请求（100-300ms）
  │    - DNS 解析
  │    - TCP/TLS 握手
  │    - HTTP 请求
  │
  ├─ 资源下载（100-500ms）
  │    - HTML 文档
  │    - CSS / JS / 图片
  │
  ├─ 解析 + 渲染（100-300ms）
  │    - HTML 解析 → DOM 树
  │    - CSS 解析 → CSSOM
  │    - JS 执行
  │    - Layout + Paint
  │
  └─ 首屏可见（T1）

总耗时 = T1 - T0 ≈ 1-3s（未优化）
```

---

### Android 侧优化

#### 1. WebView 预创建（WebView 池）

**问题**：WebView 首次创建耗时 200-500ms（Chromium 内核初始化）
**方案**：App 启动时**闲时**预创建 WebView 实例放入池中

> **闲时加载原理**：不在启动关键路径中创建 WebView，而是等主线程事件循环空闲时再做。
> - **Android**：`MessageQueue.IdleHandler` — 消息队列空了才触发
> - **iOS**：`CFRunLoopObserver(.beforeWaiting)` — RunLoop 即将休眠时触发
>
> 这样不会阻塞启动流程，用户无感知。

```kotlin
// Android：IdleHandler 闲时预创建
object WebViewPool {
    private val pool = mutableListOf<WebView>()
    private const val MAX_SIZE = 2
    
    fun preload(context: Context) {
        // IdleHandler：主线程消息队列空了才执行
        IdleHandler {
            if (pool.size < MAX_SIZE) {
                val webView = WebView(MutableContextWrapper(context.applicationContext))
                webView.settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    cacheMode = WebSettings.LOAD_DEFAULT
                }
                pool.add(webView)
            }
            false // 执行一次就移除
        }.also { Looper.myQueue().addIdleHandler(it) }
    }
    
    // 获取 WebView（从池中取或新建）
    fun obtain(context: Context): WebView {
        val webView = if (pool.isNotEmpty()) {
            pool.removeFirst().also {
                (it.context as MutableContextWrapper).baseContext = context
            }
        } else {
            WebView(context)
        }
        return webView
    }
    
    // 回收 WebView
    fun recycle(webView: WebView) {
        webView.loadUrl("about:blank")
        webView.clearHistory()
        if (pool.size < MAX_SIZE) {
            pool.add(webView)
        } else {
            webView.destroy()
        }
    }
}
```

**效果**：WebView 初始化从 300-500ms → 几乎 0ms

#### 2. 离线包 / 本地缓存

**问题**：每次都从网络下载 HTML/CSS/JS
**方案**：将 H5 资源打包到 App 中或预下载到本地

```kotlin
// 拦截 WebView 请求，优先返回本地资源
webView.webViewClient = object : WebViewClient() {
    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val url = request.url.toString()
        
        // 检查离线包是否有对应资源
        val localResource = OfflinePackageManager.getResource(url)
        if (localResource != null) {
            return WebResourceResponse(
                localResource.mimeType,
                "utf-8",
                localResource.inputStream
            )
        }
        
        return super.shouldInterceptRequest(view, request)
    }
}
```

#### 3. 并行加载（WebView 初始化 + 数据预取）

**问题**：WebView 初始化和数据请求是串行的
**方案**：在 WebView 初始化的同时，Native 并行发起数据请求

```kotlin
class HybridActivity : AppCompatActivity() {
    private var preloadData: String? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 并行：WebView 初始化 + 数据预取
        val webView = WebViewPool.obtain(this)
        
        // 同时发起数据请求
        lifecycleScope.launch {
            preloadData = api.fetchPageData(pageUrl)
        }
        
        webView.loadUrl(pageUrl)
    }
    
    // H5 通过 Bridge 获取预取数据（无需再次请求）
    @JavascriptInterface
    fun getPreloadData(): String? = preloadData
}
```

#### 4. DNS 预解析 + 连接预建立

```kotlin
// App 启动时预解析常用域名
WebView(context).apply {
    loadUrl("https://预解析域名")  // 触发 DNS + TLS
    destroy()
}

// 或使用 OkHttp DNS 预热
OkHttpClient.Builder()
    .dns(object : Dns {
        override fun lookup(hostname: String): List<InetAddress> {
            // 优先用缓存的 DNS 结果
            return DnsCache.get(hostname) ?: Dns.SYSTEM.lookup(hostname)
        }
    })
```

#### 5. WebView 配置优化

```kotlin
webView.settings.apply {
    // 渲染优化
    setRenderPriority(WebSettings.RenderPriority.HIGH)
    
    // 缓存策略
    cacheMode = WebSettings.LOAD_DEFAULT  // 优先用缓存
    domStorageEnabled = true
    databaseEnabled = true
    
    // 图片延迟加载（先渲染文字，图片异步加载）
    loadsImagesAutomatically = true
    blockNetworkImage = false  // 首屏完成后再加载图片
    
    // 硬件加速
    setLayerType(View.LAYER_TYPE_HARDWARE, null)
}
```

---

### iOS 侧优化

#### 1. WKWebView 复用池

```swift
class WebViewPool {
    static let shared = WebViewPool()
    private var pool: [WKWebView] = []
    private let maxSize = 2
    
    // iOS 闲时预创建：监听 RunLoop 即将休眠
    func preload() {
        let observer = CFRunLoopObserverCreateWithHandler(nil, CFRunLoopActivity.beforeWaiting.rawValue, false, 0) { [weak self] _, _ in
            guard let self = self else { return }
            while self.pool.count < self.maxSize {
                let config = WKWebViewConfiguration()
                config.processPool = WKProcessPool() // 共享进程池
                let webView = WKWebView(frame: .zero, configuration: config)
                self.pool.append(webView)
            }
        }
        CFRunLoopAddObserver(CFRunLoopGetMain(), observer, .defaultMode)
    }
    
    func obtain() -> WKWebView {
        if let webView = pool.popLast() {
            return webView
        }
        return WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
    }
    
    func recycle(_ webView: WKWebView) {
        webView.load(URLRequest(url: URL(string: "about:blank")!))
        if pool.count < maxSize {
            pool.append(webView)
        }
    }
}
```

#### 2. WKURLSchemeHandler（iOS 11+，本地资源拦截）

```swift
// 注册自定义 scheme
let config = WKWebViewConfiguration()
config.setURLSchemeHandler(LocalResourceHandler(), forURLScheme: "hybrid")

class LocalResourceHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        
        // 从离线包获取资源
        if let data = OfflinePackage.shared.getData(for: url) {
            let response = URLResponse(url: url, mimeType: mimeType(for: url),
                                       expectedContentLength: data.count, textEncodingName: "utf-8")
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}
```

#### 3. 共享 WKProcessPool（Cookie / Session 共享）

```swift
// 所有 WKWebView 共享同一个进程池 → 共享 Cookie、缓存、登录态
let sharedProcessPool = WKProcessPool()

func createWebView() -> WKWebView {
    let config = WKWebViewConfiguration()
    config.processPool = sharedProcessPool  // 关键：复用进程
    return WKWebView(frame: .zero, configuration: config)
}
```

#### 4. iOS 特有问题：WKWebView 内存回收

```swift
// WKWebView 在独立进程中运行，系统内存紧张时会 kill WebContent 进程
// 导致白屏 → 需要监听并重新加载
func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    webView.reload()  // 进程被杀后重新加载
}
```

---

### 通用优化（前端侧）

#### 1. 骨架屏 + 首屏直出（SSR）

```html
<!-- 内联骨架屏 CSS，不依赖外部资源 -->
<style>
  .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); }
</style>
<div class="skeleton" style="height:200px"></div>

<!-- 首屏数据直出到 HTML（SSR / 模板注入） -->
<script>
  window.__INITIAL_DATA__ = ${JSON.stringify(serverData)};
</script>
```

#### 2. 资源优化

| 优化项 | 方案 |
|--------|------|
| CSS 内联关键路径 | 首屏 CSS inline，非首屏 CSS 异步加载 |
| JS 拆包 | 首屏必要 JS 内联，非首屏 JS defer/async |
| 图片懒加载 | `loading="lazy"` + IntersectionObserver |
| 预加载关键资源 | `<link rel="preload" href="..." as="script">` |
| CDN + HTTP/2 | 多路复用，减少连接数 |

#### 3. 缓存策略

```
强缓存（Cache-Control）→ 304 协商缓存 → 离线包 → Service Worker
优先级：离线包 > 强缓存 > 协商缓存 > 网络请求
```

---

### 优化效果总结

| 优化手段 | 收益 | 优先级 |
|---------|------|--------|
| WebView 预创建（池化） | 省 200-500ms | P0 |
| 并行加载（初始化 + 数据预取） | 省 200-400ms | P0 |
| 离线包 / 本地资源 | 省 100-500ms | P0 |
| DNS 预解析 + 连接预建立 | 省 50-200ms | P1 |
| 首屏直出（SSR） | 省 200-500ms | P1 |
| 骨架屏 | 体感提升（非真实加速） | P1 |
| 图片懒加载 + 资源拆包 | 省 100-300ms | P2 |

---

## 2. 定制 WebView

### 本质

**定制 WebView = 在系统 WebView 之上封装一层统一的容器层，解决原生 WebView 的能力不足、体验不一致、安全不可控问题。**

不是替换 WebView 内核（那是腾讯 X5 / UC U4 做的事），而是在上层做封装：统一 Bridge、统一缓存、统一安全策略、统一监控。

### 解决的问题

| 问题 | 原生 WebView 的不足 | 定制 WebView 的解决方案 |
|------|-------------------|----------------------|
| **性能差** | 每次冷启动 WebView 耗时 300-500ms | WebView 池化 + 预创建 |
| **无离线能力** | 纯网络加载，弱网体验差 | 离线包管理 + 本地资源拦截 |
| **Bridge 不统一** | 各业务自己实现 Bridge | 统一 JS Bridge SDK |
| **安全风险** | 任何页面都能调用注入的 API | 域名白名单 + 方法权限控制 + 签名校验 |
| **缓存不可控** | 系统缓存策略不灵活 | 自研缓存层（离线包优先 + 协商缓存） |
| **监控缺失** | 无法统一监控 H5 性能和错误 | 统一性能埋点 + 错误上报 |
| **登录态丢失** | WKWebView Cookie 管理复杂 | 统一 Cookie/Session 管理 |
| **跨平台不一致** | Android/iOS 行为差异大 | 统一容器层抹平差异 |

### 业界最佳实践

#### 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│ 业务层                                                         │
│  H5 页面 / 小程序 / 内嵌 Web                                  │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│ 定制 WebView 容器层                                            │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ JS Bridge  │ │ 离线包管理  │ │ 安全管控   │ │ 性能监控  │ │
│  │ 统一协议   │ │ 资源拦截   │ │ 白名单     │ │ 埋点上报  │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ WebView 池 │ │ Cookie管理 │ │ 预加载引擎 │ │ 错误兜底  │ │
│  │ 预创建复用 │ │ 统一登录态 │ │ DNS+数据   │ │ 降级方案  │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│ 系统 WebView                                                   │
│  Android: WebView (Chromium)  │  iOS: WKWebView (WebKit)      │
└──────────────────────────────────────────────────────────────┘
```

#### 业界方案对比

| 公司/方案 | 核心能力 | 特点 |
|----------|---------|------|
| **微信 JS-SDK** | 统一 Bridge + 权限管控 | 最成熟的 H5 容器方案 |
| **支付宝 Nebula** | 离线包 + 预渲染 + 安全沙箱 | 高性能，支持小程序 |
| **美团 Mach** | WebView 池 + 离线包 + 性能监控 | 秒开率优化典范 |
| **字节 Lynx/Hybrid** | WebView 池 + 预取 + SSR | 多容器统一管理 |
| **腾讯 X5** | 自研内核（替换系统 WebView） | 解决碎片化，但体积大 |

#### 核心模块设计

**1. 统一 JS Bridge**

```kotlin
// 统一协议：所有业务用同一套 Bridge
class UnifiedBridge {
    // 模块注册
    private val modules = mutableMapOf<String, BridgeModule>()
    
    // 权限控制
    private val permissions = PermissionManager()
    
    fun handleCall(request: BridgeRequest): BridgeResponse {
        // 1. 安全检查（域名白名单 + 方法权限）
        if (!permissions.check(request.origin, request.module, request.method)) {
            return BridgeResponse.denied()
        }
        
        // 2. 调用模块
        val module = modules[request.module] ?: return BridgeResponse.notFound()
        return module.invoke(request.method, request.params)
    }
}
```

**2. 离线包管理**

```
离线包生命周期：
  构建 → 发布到 CDN → App 启动时检查更新 → 下载差量包 → 本地解压
  → WebView 加载时拦截请求 → 优先返回本地资源

版本管理：
  全量包（首次安装）+ 差量包（增量更新）
  MD5 校验 + 签名验证（防篡改）
```

**3. 性能监控**

```javascript
// H5 侧自动注入的性能采集脚本
const timing = performance.timing;
const metrics = {
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    tcp: timing.connectEnd - timing.connectStart,
    ttfb: timing.responseStart - timing.requestStart,
    domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
    load: timing.loadEventEnd - timing.navigationStart,
    firstPaint: performance.getEntriesByType('paint')[0]?.startTime
};

// 通过 Bridge 上报
jsBridge.callNative('monitor', 'reportPerf', metrics);
```

**4. 错误兜底**

```kotlin
// WebView 加载失败 → 降级方案
webView.webViewClient = object : WebViewClient() {
    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) {
            // 主文档加载失败 → 显示错误页 + 重试按钮
            showErrorPage(error.errorCode)
            
            // 上报错误
            monitor.reportError("webview_load_fail", error.errorCode, request.url)
        }
    }
    
    // 白屏检测
    override fun onPageFinished(view: WebView, url: String) {
        // 延迟 3s 检测是否白屏（截图检测 / JS 埋点）
        handler.postDelayed({
            checkBlankScreen(view)
        }, 3000)
    }
}
```

---

### 总结

**定制 WebView 的核心价值**：

1. **性能**：池化 + 离线包 + 预加载 → 秒开
2. **安全**：统一权限管控 → 防止恶意页面调用敏感 API
3. **体验**：统一 Bridge + Cookie 管理 + 错误兜底 → 一致性
4. **可观测**：统一监控 → 发现问题、量化优化效果
5. **效率**：业务方不需要关心底层细节，直接用统一容器


---

## 3. 定制 WebView 与 RN 的关系

### 本质

**定制 WebView 不暴露为 RN 组件，而是作为独立的 Native 页面存在。RN 通过 Native 路由模块跳转过去。**

### 为什么不用 RN 的 WebView 组件

| | RN WebView 组件 (`react-native-webview`) | 原生定制 WebView（独立 Activity/VC） |
|--|----------------|-----------------|
| Bridge 注入 | 受限（只能 `injectedJavaScript` / `postMessage`） | 完全控制（直接 `addJavascriptInterface`） |
| 池化/预创建 | 做不了（生命周期跟 RN 页面走） | 独立管理（App 启动就预创建） |
| 离线包拦截 | 很难（`shouldInterceptRequest` 不暴露） | 完全控制 |
| 性能 | 嵌在 RN View 层级中，多一层开销 | 独立页面，全屏渲染无额外层级 |
| 导航 | RN 导航 + WebView 内导航混在一起 | 独立页面，导航清晰 |
| 内存 | WebView 被 RN 组件持有，回收不灵活 | 用完即回收到池中 |

### 正确架构

```
✅ 正确：独立 Native 页面 + 路由跳转
  RN 页面点击 → NativeRouter.open('myapp://web/activity/123')
  → Native 路由打开 WebViewActivity → 加载 H5

❌ 不推荐：RN 组件内嵌入
  RN 页面中 <WebView url="..." /> → H5 跑在 RN 组件树内
```

### RN 侧只需一个路由 TurboModule API

```typescript
// RN 侧调用
NativeRouter.open('myapp://web/activity/123');  // 跳到 H5 页面
NativeRouter.open('myapp://rn/profile');        // 跳到 RN 页面
NativeRouter.open('myapp://native/settings');   // 跳到 Native 页面
```

```kotlin
// Native 路由模块
class RouterModule : NativeRouterSpec(reactContext) {
  override fun open(url: String) {
    when {
      url.startsWith("myapp://web/") -> {
        val intent = Intent(context, WebViewActivity::class.java)
        intent.putExtra("url", extractWebUrl(url))
        context.startActivity(intent)
      }
      url.startsWith("myapp://rn/") -> { /* 加载 RN Bundle */ }
      url.startsWith("myapp://native/") -> { /* 跳 Native 页面 */ }
    }
  }
}
```

### 例外场景

RN 组件内嵌 WebView 适合**轻量、非独立页面**的场景：
- 展示一段富文本/协议页（不需要 Bridge）
- 嵌入一个小的广告 Banner
- 不需要池化/离线包/Bridge 等能力

**重度 H5 业务（游戏化互动、活动页、需要完整 Bridge）→ 必须走独立原生定制 WebView。**


---

## 4. WebView 在 Android 和 iOS 中是什么

### Android：WebView 是一个 View 组件

**`android.webkit.WebView` 继承自 `android.view.View`**，和 `TextView`、`Button` 一样是一个 UI 组件，可以放在任何布局中。

```kotlin
// 1. XML 布局中声明
<WebView
    android:id="@+id/webview"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />

// 2. 代码中使用
val webView = findViewById<WebView>(R.id.webview)
webView.settings.javaScriptEnabled = true
webView.addJavascriptInterface(JsBridge(), "nativeBridge")  // 注入 Bridge
webView.loadUrl("https://example.com")

// 3. 通常放在一个独立 Activity 中（定制 WebView 容器）
class WebViewActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        setContentView(webView)
        webView.loadUrl(intent.getStringExtra("url")!!)
    }
}
```

**本质**：一个内嵌了 Chromium 渲染引擎的 View。底层是独立的渲染进程（Android 8.0+ 多进程模式）。

---

### iOS：WKWebView 是一个 UIView 组件

**`WKWebView` 继承自 `UIView`**，和 `UILabel`、`UIButton` 一样是 UI 组件。

```swift
// 1. 代码创建
let config = WKWebViewConfiguration()
config.userContentController.add(self, name: "bridge")  // 注入 Bridge

let webView = WKWebView(frame: view.bounds, configuration: config)
view.addSubview(webView)

webView.load(URLRequest(url: URL(string: "https://example.com")!))

// 2. 通常放在独立 ViewController 中
class WebViewController: UIViewController {
    var webView: WKWebView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        webView = WKWebView(frame: view.bounds)
        view.addSubview(webView)
        webView.load(URLRequest(url: url))
    }
}
```

**关键区别**：WKWebView 的 JS 运行在**独立进程**（WebContent Process），和 App 主进程隔离。这就是为什么 iOS Bridge 只能异步（跨进程通信）。

---

### 双端对比

| | Android WebView | iOS WKWebView |
|--|----------------|---------------|
| 继承自 | `android.view.View` | `UIView` |
| 内核 | Chromium（系统 WebView 可更新） | WebKit（系统内置，不可更换） |
| JS 进程 | Android 8.0+ 独立进程 | 始终独立进程 |
| JS 引擎 | V8 | JavaScriptCore |
| Bridge 注入 | `addJavascriptInterface` | `WKScriptMessageHandler` |
| 同步调用 | ✅ 支持 | ❌ 不支持（跨进程） |
| 回调 JS | `evaluateJavascript()` | `evaluateJavaScript()` |
| 资源拦截 | `shouldInterceptRequest` | `WKURLSchemeHandler`（iOS 11+） |


---

## 5. Native 到 JS 回调机制：两类方式

### 底层原理（决定一切的根因）

**能不能直接持有 JS 引擎实例，决定了回调机制的设计。**

```
能持有 JS 引擎（J2V8 / JSI）：
  → 可以直接拿到 JS 函数引用
  → Native 直接 call 这个引用
  → 不需要 callback ID

不能持有 JS 引擎（WebView）：
  → 引擎被 WebView 封装，不暴露
  → 不能传函数引用，只能传字符串
  → 必须用 callback ID + Map 映射(bridge:js侧)
```

### 两类回调方式

#### 类型 A：直接调用 JS 函数引用（无 callback ID）

**适用**：JSI（RN）、J2V8（快应用）——直接持有引擎。

```cpp
// JSI：C++ 直接持有 JS 函数引用，直接 call
void getLocation(jsi::Runtime& rt, jsi::Function callback) {
  // callback 就是 JS 传过来的那个函数本身
  // 异步完成后直接调：
  callback.call(rt, result);  // ← 不需要 ID，引用本身就是"谁"
}
```

```java
// J2V8：Java 直接持有 V8 函数引用 → 详见 [注释：V8Array args](#注释v8array-args)
V8Function callback = (V8Function) args.get(1);
callback.call(v8, new V8Array(v8).push(result));
```

**为什么不需要 ID**：每次调用传过来的 callback 函数引用本身就是独立的对象，Native 持有哪个就调哪个。

#### 类型 B：执行 JS 代码字符串 + callback ID 映射（WebView）

**适用**：WebView H5——引擎不暴露，无法持有 JS 函数引用。

```kotlin
// Native 侧：拼一段 JS 代码字符串让 WebView 执行
webView.evaluateJavascript(
  "window.jsBridge.invokeCallback('cb_123', ${JSON.stringify(result)})",
  null
)
```

```javascript
// JS 侧：通过 callback ID 从 Map 中找到对应函数
invokeCallback(callbackId, result) {
  const callback = this.callbackMap.get(callbackId);  // ID 查 Map
  callback(result);
  this.callbackMap.delete(callbackId);
}
```

**为什么需要 ID**：Native 无法持有 JS 函数引用（跨进程/引擎不暴露），只能传一个字符串 ID 过去，JS 侧自己用 ID 查 Map 找到函数。

### 对比总结

| | 类型 A（直接调引用） | 类型 B（字符串 + ID） |
|--|-------------------|---------------------|
| **前提** | 直接持有 JS 引擎 | 引擎被封装，不暴露 |
| **适用** | JSI、J2V8 | WebView |
| **回调方式** | `callback.call(result)` | `evaluateJavascript("code")` |
| **需要 callback ID** | ❌ 不需要 | ✅ 必须 |
| **需要 JS 侧 Map** | ❌ 不需要 | ✅ 必须 |
| **序列化** | 无（直接传 jsi::Value / V8Value） | 有（结果拼成 JSON 字符串） |
| **性能** | 高 | 中等 |

### 结论：H5 必须走 WebView + callback ID

**H5 必须走 WebView 定制，必须走 callback ID 映射，原因是底层限制**：

1. **WebView 不暴露 JS 引擎**：你拿不到 V8/JSC 实例，无法直接持有 JS 函数引用
2. **只能通过 `evaluateJavascript` 执行字符串**：这是 WebView 暴露的唯一"Native→JS"通道
3. **`@JavascriptInterface` 是 JS→Native 方向**：它让 JS 能调 Native，但 Native 回调 JS 只能走 `evaluateJavascript`
4. **iOS WKWebView 更严格**：JS 跑在独立进程，连 `@JavascriptInterface` 的同步能力都没有

**所以 H5 Bridge 的设计约束**：
```
JS→Native：@JavascriptInterface（Android 可同步）/ messageHandlers（iOS 异步）
Native→JS：evaluateJavascript + callback ID + Map（双端都是这样）
```

这不是"设计选择"，是"底层约束"——WebView 就不给你引擎访问权，只能这么做。


---

## 注释：核心概念

### 注释：V8Array args

**`args` = JS 调用时传过来的参数列表（V8Array 类型）。**

```javascript
// JS 侧调用
system.device.getLocation({timeout: 5000}, function(result) { ... });
```

```java
// Java 侧注册方法时收到的 args：
module.registerJavaMethod((receiver, args) -> {
  // args = V8Array，对应 JS 传的所有参数
  // args.get(0) → V8Object {timeout: 5000}（业务参数）
  // args.get(1) → V8Function（JS 回调函数引用）
  
  V8Function callback = (V8Function) args.get(1);
  // callback 就是 JS 传过来的那个 function 本身
  // 异步完成后直接 call：
  callback.call(v8, new V8Array(v8).push(resultJson));
}, "getLocation");
```

**关键**：JS 函数作为参数传给 Native 时，J2V8 不是传了一个 ID 或字符串，而是直接传了 V8 堆上的函数对象引用（`V8Function` 类型）。所以 Native 可以直接 `.call()` 调用它，不需要 callback ID。
