# Android WebView 容器定制

> 解决什么问题：系统 WebView 直接用太慢（冷启动 500ms+、无离线能力、通信走序列化）。定制 WebView 容器 = 在 Native 侧给 H5 "开挂"。
>
> 本质：WebView 容器 = 系统 WebView + 预创建/复用 + 离线包 + 接口预请求 + JSBridge 注入 + 安全管控。
>
> 场景：App 内 H5 页面（活动页/落地页/运营页）的秒开优化、跨端通信底座。

---

## 目录

- [系统 WebView 的问题](#系统-webview-的问题)
- [容器架构](#容器架构)
- [预创建与复用池](#预创建与复用池)
- [离线包方案](#离线包方案)
- [接口预请求](#接口预请求)
- [JSBridge 注入与协议设计](#jsbridge-注入与协议设计)
- [请求拦截（shouldInterceptRequest）](#请求拦截shouldinterceptrequest)
- [安全管控](#安全管控)
- [Q&A](#qa)

---

## 系统 WebView 的问题

```
直接用 Android WebView 的痛点：

  1. 冷启动慢：首次创建 WebView 实例需要初始化内核（300-500ms）
  2. 白屏等待：HTML/JS/CSS 全走网络（弱网下 2-3s 白屏）
  3. 通信原始：只有 addJavascriptInterface / evaluateJavascript（序列化、异步）
  4. 无版本管理：H5 更新全靠 HTTP 缓存，不可控
  5. 安全风险：JS 可以调 Native 注入的所有方法，无权限管控
```

---

## 容器架构

```
自研 WebView 容器的分层：

  ┌────────────────────────────────────┐
  │         H5 页面（JS/CSS/HTML）      │
  ├────────────────────────────────────┤
  │         JSBridge 通信层             │  ← 协议 + 鉴权 + 分发
  ├────────────────────────────────────┤
  │         容器服务层                   │  ← 离线包 / 预请求 / 安全
  ├────────────────────────────────────┤
  │         WebView 管理层              │  ← 预创建 / 复用池 / 生命周期
  ├────────────────────────────────────┤
  │         系统 WebView（Chromium）     │  ← 底层渲染
  └────────────────────────────────────┘
```

---

## 预创建与复用池

```
问题：每次打开 H5 → new WebView() → 初始化内核 → 300-500ms 白屏

解法：App 启动时预创建 WebView 实例放进池子

伪代码（Kotlin）：
  object WebViewPool {
    private val pool = ArrayDeque<WebView>()
    
    // App 启动时预热
    fun preload(context: Context, count: Int = 2) {
      repeat(count) {
        val webView = WebView(context.applicationContext)
        webView.settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
        }
        // 预加载通用的 JSBridge 和基础样式
        webView.loadUrl("file:///android_asset/bridge.html")
        pool.add(webView)
      }
    }
    
    // 获取：从池子里取一个已经初始化好的
    fun obtain(): WebView = pool.removeFirstOrNull() ?: createNew()
    
    // 归还：页面关闭后清理内容放回池子（复用）
    fun recycle(webView: WebView) {
      webView.loadUrl("about:blank")  // 清空内容
      webView.clearHistory()
      pool.add(webView)
    }
  }

效果：
  无预创建：打开 H5 → 等 300-500ms（内核初始化）→ 才开始加载
  有预创建：打开 H5 → 直接用已初始化的 WebView → 省去冷启动
```

---

## 离线包方案

```
问题：H5 资源全走网络 → 弱网白屏

解法：H5 的 HTML/JS/CSS 提前下载到本地，WebView 从本地加载

流程：
  1. 打包阶段：H5 构建产物打成 zip 包 → 上传到 CDN → 记录版本号
  2. 下载阶段：App 启动/后台时检查版本 → 增量下载新包 → 解压到本地目录
  3. 加载阶段：WebView 拦截请求 → 本地有则返回本地文件 → 没有才走网络

关键 API：
  WebViewClient.shouldInterceptRequest(view, request)
  → 拦截 WebView 的每一个资源请求
  → 如果本地离线包有这个文件 → 返回本地 InputStream
  → 没有 → 返回 null（走网络）

伪代码：
  override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
    val path = request.url.path ?: return null
    val localFile = offlinePackage.getFile(path)
    
    if (localFile != null && localFile.exists()) {
      return WebResourceResponse(
        getMimeType(path),
        "UTF-8",
        FileInputStream(localFile)
      )
    }
    return null  // 走网络
  }

更新策略：
  - 全量包：首次安装时内置
  - 增量更新：后续只下载 diff（bsdiff 算法）
  - 强制更新：紧急 hotfix 推送
```

---

## 接口预请求

```
问题：WebView 加载 HTML → 解析 → 执行 JS → 才发数据请求 → 串行等待

解法：Native 在 WebView 加载 HTML 的同时，并行发起数据请求

流程：
  用户点击入口
  → Native 同时做两件事：
     ① 从池子取 WebView → 加载 H5 页面
     ② 根据 URL 规则 → 提前发起对应的数据接口请求 → 缓存结果
  → H5 JS 执行后请求数据 → 容器拦截 → 发现已有预请求结果 → 直接返回
  → 省去了"等 JS 执行完才发请求"的时间

效果：
  页面加载时间 = max(HTML加载, 接口请求)  而非 HTML加载 + 接口请求（串行变并行）
```

---

## JSBridge 注入与协议设计

```
Native 侧 JSBridge 的实现：

方式 1：addJavascriptInterface（简单但有安全风险 < Android 4.2）
  webView.addJavascriptInterface(BridgeObject(), "NativeBridge")
  → H5：window.NativeBridge.call(method, params)
  → 序列化传参，Native 侧反射调用

方式 2：shouldOverrideUrlLoading 拦截（URL Scheme）
  H5：location.href = 'jsbridge://camera/open?callback=cb_123'
  Native：
    override fun shouldOverrideUrlLoading(view, request): Boolean {
      val url = request.url
      if (url.scheme == "jsbridge") {
        val module = url.host        // "camera"
        val method = url.pathSegments[0]  // "open"
        val params = url.queryParameters  // callback=cb_123
        bridgeRouter.dispatch(module, method, params)
        return true  // 拦截，不实际跳转
      }
      return false
    }

方式 3：evaluateJavascript（Native → H5）
  webView.evaluateJavascript("window.bridgeCallback('cb_123', ${jsonData})") { result ->
    // result = JS 返回值
  }

协议设计（标准化）：
  请求格式：{ module: "camera", method: "open", params: {...}, callbackId: "cb_123" }
  响应格式：{ callbackId: "cb_123", code: 0, data: {...} }
  → 类似 HTTP 请求/响应模型，支持异步回调
```

---

## 请求拦截（shouldInterceptRequest）

```
这个 API 是 WebView 容器定制的核心——可以拦截 WebView 内所有资源请求：

能做的事：
  1. 离线包加载（上面讲了）
  2. 资源 CDN 切换（主 CDN 挂了切备份）
  3. 请求统计（资源加载耗时、失败率）
  4. 安全管控（禁止加载非白名单域名的资源）
  5. Mock 数据（开发调试时拦截接口返回 mock）

本质：给了 Native 侧对 WebView 网络层的完全控制权。
```

---

## 安全管控

```
H5 能调哪些 Native 能力？需要管控：

  1. 白名单域名：只有指定域名的 H5 才能调用 JSBridge
  2. 方法级权限：不同页面/不同来源可调用的方法不同
  3. 参数校验：Native 侧校验入参合法性
  4. 调用频率限制：防止恶意高频调用

实现：
  fun dispatch(module: String, method: String, params: Map, origin: String) {
    // 1. 白名单检查
    if (!isAllowedOrigin(origin)) throw SecurityException("Blocked")
    // 2. 方法权限检查
    if (!hasPermission(origin, module, method)) throw SecurityException("No permission")
    // 3. 参数校验
    validateParams(module, method, params)
    // 4. 执行
    bridgeModules[module]?.invoke(method, params)
  }
```

---

## Q&A

**Q：WebView 预创建会增加多少内存？**

A：一个空 WebView 约 30-50MB。预创建 2 个 = 多占 60-100MB。对现代手机（8GB+）可接受。可以配合低内存监听，内存紧张时释放池子。

**Q：离线包和 Service Worker 的区别？**

A：离线包在 Native 层拦截（shouldInterceptRequest），Service Worker 在 JS 层拦截（fetch event）。离线包更早生效（不需要等 SW 注册），且 Native 侧有更强的下载/版本管理能力。两者可以共存（Native 离线包优先 + SW 兜底）。

**Q：怎么保证离线包和线上版本一致？**

A：版本号机制。H5 每次发布生成新版本号 → App 检查版本 → 不一致则下载新包。加兜底策略：离线包加载失败 → fallback 到在线 URL。

**Q：JSBridge 的性能瓶颈在哪？**

A：序列化。大数据量（如图片 base64、长列表数据）来回 JSON 序列化/反序列化是主要开销。解法：大数据走文件传递（Native 写入本地文件 → 传路径给 H5），不走 Bridge 通道。
