# 13. 网络

> Android 网络框架、OkHttp/Retrofit、权限、安全。

## 目录

- [一、Android 网络基础](#一android-网络基础)
- [二、OkHttp](#二okhttp)
- [三、Retrofit](#三retrofit)
- [四、网络安全](#四网络安全)
- [五、快应用框架的网络层](#五快应用框架的网络层)

---

## 一、Android 网络基础

### 权限

```xml
<!-- 基础网络权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<!-- 查询网络状态 -->
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

`INTERNET` 是普通权限（安装时自动授予），不需要运行时申请。

### 主线程不能做网络请求

Android 4.0+ 强制：主线程做网络请求直接抛 `NetworkOnMainThreadException`。必须在子线程/协程里做。

类比前端：前端的 fetch 天然是异步的（Promise），不会阻塞主线程。Android 需要开发者自己保证。

---

## 二、OkHttp

Android 最主流的 HTTP 客户端（Square 出品），类比前端的 axios。

### 核心特性

| 特性 | 说明 | 类比前端 |
|------|------|---------|
| 连接池 | 复用 TCP 连接 | HTTP/2 多路复用 |
| 拦截器 | 请求/响应拦截链 | axios interceptors |
| 缓存 | HTTP 缓存（ETag/Last-Modified） | 浏览器缓存 |
| 重试 | 自动重试失败请求 | axios-retry |
| WebSocket | 支持 WebSocket | 浏览器 WebSocket API |

### 拦截器链（核心设计）

```
Application Interceptors（应用拦截器）
  ↓ 日志 / Token 注入 / 加密
Network Interceptors（网络拦截器）
  ↓ 缓存 / 压缩 / 重定向
实际网络请求
  ↓
响应返回（逆序经过拦截器）
```

类比 Koa 的洋葱模型 / axios 的 interceptors。

### 代码示例

```kotlin
val client = OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .addInterceptor(AuthInterceptor())  // 自动加 Token
    .addInterceptor(LoggingInterceptor()) // 日志
    .build()

val request = Request.Builder()
    .url("https://api.example.com/users")
    .build()

// 异步请求
client.newCall(request).enqueue(object : Callback {
    override fun onResponse(call: Call, response: Response) {
        val body = response.body?.string()
    }
    override fun onFailure(call: Call, e: IOException) { }
})
```

---

## 三、Retrofit

基于 OkHttp 的声明式 HTTP 客户端（类比前端的 OpenAPI 代码生成）。

```kotlin
// 声明接口（类比 TypeScript 的 API 类型定义）
interface UserApi {
    @GET("users/{id}")
    suspend fun getUser(@Path("id") id: String): User
    
    @POST("users")
    suspend fun createUser(@Body user: User): User
    
    @GET("users")
    suspend fun getUsers(@Query("page") page: Int): List<User>
}

// 创建实例
val api = Retrofit.Builder()
    .baseUrl("https://api.example.com/")
    .addConverterFactory(GsonConverterFactory.create()) // JSON 序列化
    .client(okHttpClient)
    .build()
    .create(UserApi::class.java)

// 使用
val user = api.getUser("123") // 直接返回对象，Retrofit 帮你做了序列化
```

---

## 四、网络安全

### HTTPS 证书验证

Android 默认验证 HTTPS 证书。如果用自签名证书（内网），需要配置信任：

```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.example.com</domain>
        <trust-anchors>
            <certificates src="@raw/my_ca" /> <!-- 自签名 CA -->
        </trust-anchors>
    </domain-config>
</network-security-config>
```

### Android 9.0+ 默认禁止明文 HTTP

必须用 HTTPS，或者在 network_security_config 里显式允许明文。

---

## 五、快应用框架的网络层

快应用框架的网络请求不是 App 自己发的，而是开发者通过 JS 调用 `system.fetch()`，框架转发给 Native 执行：

```
JS: system.fetch({ url, method, headers, body })
  ↓ J2V8 Bridge
Java: NetworkFeature.fetch()
  ↓ OkHttp
实际网络请求
  ↓ 响应
Java: 回调结果
  ↓ Bridge
JS: callback({ status, data, headers })
```

框架需要处理的问题：
- 请求取消（页面销毁时取消未完成的请求）
- 超时控制
- Cookie 管理
- 证书校验
- 代理设置
