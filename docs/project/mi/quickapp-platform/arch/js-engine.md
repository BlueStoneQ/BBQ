# 支干1：JS 引擎层

> 覆盖：渲染体系、线程模型、V8 选型、J2V8、infras.js Runtime

## 目录

- [1. 渲染体系：全 Native View](#1-渲染体系全-native-view)
- [2. 线程模型：三线程 + 同步 Bridge](#2-线程模型三线程--同步-bridge)
- [3. JS 引擎选型：V8 + J2V8](#3-js-引擎选型v8--j2v8)
- [4. V8 在快应用中如何工作](#4-v8-在快应用中如何工作)
- [5. JS Runtime（infras.js）的职能](#5-js-runtimeinfrasjs的职能)
- [6. J2V8 深入：本质、核心 API、同步通信](#6-j2v8-深入本质核心-api同步通信)

---

## 1. 渲染体系：全 Native View

### 问题：快应用有两套渲染体系吗？类似小程序还是类似 RN？

**全部渲染为 Native View，类似 RN，不是小程序的双线程 WebView 模型。**

- `<div>` → `PercentFlexboxLayout`（Android FlexboxLayout）
- `<text>` → `TextLayoutView`（Android TextView 封装）
- `<image>` → 原生 ImageView
- `<list>` → RecyclerView
- `<video>` → 原生播放器
- `<canvas>` → 原生 Canvas/SurfaceView

唯一例外：`<web>` 组件内部是 `NestedWebView`，但这是一个**嵌入式组件**（类似 RN 的 `<WebView>`），不是渲染体系本身。

### 和小程序的本质区别

```
微信小程序（双线程 WebView）：
  逻辑层：JSCore 执行 JS
  渲染层：WebView 渲染 WXML → HTML DOM → 浏览器绘制
  部分原生组件（map/video/canvas）覆盖在 WebView 上层

快应用（多线程 Native View）：
  逻辑层：V8 执行 JS
  渲染层：全部是 Android 原生 View，没有 WebView 参与
```

快应用性能上限比小程序高，因为不走浏览器渲染管线。

---

## 2. 线程模型：三线程 + 同步 Bridge

### 问题：RN 是单线程吗？快应用为什么采用单线程？

RN 不是单线程，快应用也不是。两者都是**多线程架构**。

### RN 的线程模型

```
JS Thread        ← JS 逻辑执行（Hermes/JSC）
Main Thread (UI) ← 原生 View 渲染、用户事件采集
Shadow Thread    ← Yoga 布局计算（旧架构）/ 新架构合并到 JS Thread
```

### 快应用的线程模型

```
JS Thread (JsThread)   ← V8 执行 JS，所有 JS 代码在这里跑
UI Thread (Main)       ← View 创建/渲染、事件采集
IO Thread Pool         ← RenderWorker（JSON 解析）、异步 Feature 执行
```

通信方向：
- JS→Native（`JsBridge.invoke`、`callNative`）：**同步**，直接在 JS 线程执行 Java 代码
- Native→JS（`postExecuteFunction`）：**异步**，通过 Handler 投递到 JS 线程

### 对比

| | 快应用 | RN（旧架构） | RN（新架构 JSI） |
|---|---|---|---|
| JS→Native | 同步（J2V8 直接调用） | 异步（JSON Bridge） | 同步（JSI C++ 绑定） |
| 布局计算 | IO 线程（RenderWorker） | Shadow Thread（Yoga） | JS Thread |
| 渲染指令 | 批量 JSON → IO 线程解析 → 主线程应用 | 异步消息队列 | 同步 Fabric |

### 为什么 JS→Native 是同步的

快应用用 **J2V8**（V8 的 Java 绑定），JS 调用 `JsBridge.invoke()` 时，V8 引擎直接调用注册的 Java 方法，在同一个线程上同步执行，不需要跨线程投递消息。

这和 RN 新架构的 JSI 是同一个思路——把 Native 函数直接注册到 JS 引擎全局环境，调用时零序列化、零异步开销。

RN 旧架构之所以是异步的，是因为走 JSON 序列化 + 消息队列（BatchedBridge），JS 和 Native 在不同线程，中间隔了一层异步消息传递。

### 为什么渲染指令走异步（IO 线程）

虽然 JS→Native 的调用是同步的，但渲染 Action 的**解析和应用**是异步的：

```
JS Thread: callNative(JSON) → 同步交给 RenderActionManager
IO Thread: RenderWorker 解析 JSON（不阻塞 JS 和 UI）
UI Thread: VDomActionApplier 应用 View 变更
```

原因：渲染 JSON 可能很大（一次页面渲染几百个 Action），如果在 JS 线程同步解析会阻塞后续 JS 执行；如果在 UI 线程解析会卡 UI。所以放到 IO 线程池，解析完再投递到主线程。

### 总结

快应用是**三线程 + 同步 Bridge**：
- JS 执行单线程（V8 限制）
- 渲染解析在 IO 线程（不阻塞 JS 和 UI）
- View 操作在 UI 线程（Android 要求）
- JS↔Native 通信是同步的（J2V8 直接绑定，和 RN JSI 同一思路）

---

## 3. JS 引擎选型：V8 + J2V8

### 问题：当前快应用采用的 JS 引擎是什么？为什么如此选型？

**引擎**：Google V8
**绑定方式**：J2V8（`com.eclipsesource.v8`）— V8 的 Java 绑定库
**Native 层封装**：`libjsenv.so`（13.2MB），内部是 V8 + C++ 封装层（`hybrid::JSEnv`）
**Maven 坐标**：`org.hapjs:jsenv:1.3.0`
**启动优化**：V8 Snapshot — 将 infras.js 预编译为二进制快照（`libinfrasjs_snapshot.so`），跳过解析+编译

### 候选引擎对比

| 引擎 | 优势 | 劣势 | 适合场景 |
|------|------|------|---------|
| **V8** | 性能最强（JIT）、生态成熟、调试工具完善（CDP） | 体积大（13MB+）、内存占用高 | 性能优先、有体积预算 |
| **JSC** | iOS 系统自带、体积中等 | Android 需自带、JIT 性能略逊 | iOS 优先的跨端方案 |
| **Hermes** | 体积小、启动快（AOT 字节码）、内存低 | 不支持 JIT（峰值性能低） | RN 移动端、内存敏感 |
| **QuickJS** | 极小（几百 KB）、可嵌入 | 纯解释执行、性能差 | 极度体积敏感的嵌入式 |

### 选 V8 的核心原因

1. **系统预装，体积不敏感** — 13MB 对 ROM 预装应用无感，不像三方 App 对包体积极度敏感
2. **性能优先** — V8 JIT（TurboFan）在复杂 JS 场景下性能远超解释型引擎
3. **调试生态** — V8 原生支持 Chrome DevTools Protocol，调试器直接复用
4. **J2V8 成熟** — 完整的 Java↔V8 绑定，支持同步调用、对象传递、TypedArray
5. **快照加速** — V8 Snapshot 预编译框架 JS，冷启动跳过解析+编译

### 如果是三方 App 会怎么选

选 Hermes（RN 的选择）——牺牲峰值性能换取更小体积和更快启动。

---

## 4. V8 在快应用中如何工作

### 问题：V8 处理的最小粒度是什么？rpk 最后打包成一个 JS 文件吗？有没有 JS Runtime？

#### 执行粒度：不是一个 JS 文件，是多个

rpk 包解压后的结构：
```
rpk (zip)
├── manifest.json       ← 应用配置
├── app.js              ← 应用入口 JS（webpack 打包产物）
├── pages/
│   ├── index/index.js  ← 页面1 JS（独立 webpack bundle）
│   └── detail/detail.js← 页面2 JS（独立 webpack bundle）
└── common/             ← 资源文件
```

**每个页面是一个独立的 JS bundle**（webpack 打包产物），不是整个应用打成一个 JS 文件。

#### JS Runtime（infras.js）：内置在框架中，不在 rpk 里

```
框架 APK 内置：
  libjsenv.so             ← V8 引擎
  libinfrasjs_snapshot.so ← infras.js 的 V8 快照（预编译）
  
rpk 包里：
  app.js                  ← 应用代码
  pages/xxx.js            ← 页面代码
```

**infras.js 是快应用的 JS Runtime**，包含 DSL 引擎、虚拟 DOM、渲染管线、模块系统、全局函数。它**内置在框架 APK 中**，不随 rpk 分发。所有快应用共享同一份 Runtime。

#### 完整执行顺序

```
1. 创建 V8 实例
   └─ V8.createV8Runtime(null, null, loadInfrasJsSnapshot())
      有快照：直接反序列化（毫秒级）
      没快照：加载 infras.js 源码执行（慢）

2. 注册 Native Bridge
   └─ JsBridgeRegisterHelper.registerBridge()
      注册 callNative、JsBridge.invoke、history、timer 等到 V8 全局

3. 注册模块定义
   └─ registerModules() — 告诉 JS 层有哪些 Feature 可用
   └─ registerComponents() — 告诉 JS 层有哪些 Widget 可用

4. 执行 app.js（应用入口）
   └─ registerManifest(manifest)  ← 注册配置
   └─ locateDsl()                 ← 选择 DSL（Vue/XVM）
   └─ createApplication(appId, appJs, appCss)

5. 执行页面 JS（按需加载）
   └─ createPage(pageId, pageJs, pageCss, params...)
      JS 内部：$app_define$ 注册组件 → DSL 解析模板 → 构建虚拟 DOM → 渲染
```

#### 关键认知

| 问题 | 答案 |
|------|------|
| rpk 是打成一个 JS 文件吗？ | 不是。app.js + 每个页面独立一个 JS bundle |
| 有 JS Runtime 吗？ | 有，叫 infras.js，是框架的核心 JS 层 |
| Runtime 在哪里？ | 内置在框架 APK 中（以 V8 快照形式），不在 rpk 里 |
| 执行顺序？ | 先加载 Runtime → 再执行 app.js → 再按需执行页面 JS |
| 类比？ | 浏览器先加载渲染引擎 → 再加载网页 JS |

---

## 5. JS Runtime（infras.js）的职能

### 问题：JS Runtime 主要做了什么？承担了什么职能？

infras.js 是快应用框架的 **JS 侧内核**，类比浏览器：infras.js ≈ 浏览器内核的 JS 部分（DOM API + 事件系统 + 模块加载）。

### 三层架构

```javascript
// infras/entry/main/index.js
function initInfras() {
  // 1. Platform 层 — 基础能力
  platform.init()
  exposeToNative(platform.exposure)

  // 2. Runtime 层 — DOM 能力
  runtime.init()
  exposeToNative(runtime.exposure)

  // 3. Dock 层 — 应用/页面管理
  dock.init(glue)
  exposeToNative(dock.exposure)
}
```

### 各层职能

| 层 | 源码位置 | 暴露给 Native 的全局函数 | 职能 |
|---|---|---|---|
| **Platform** | `infras/platform/` | `registerModules`、`execInvokeCallback`、`registerManifest`、`registerBundleChunks` | Feature 模块注册、回调分发、manifest 解析、资源加载 |
| **Runtime** | `infras/runtime/` | `registerComponents` | 虚拟 DOM（Document/Node/Event）、Listener（DOM→Action）、Streamer（批量发送） |
| **Dock** | `infras/dock/` | `locateDsl`、`createApplication`、`createPage`、`destroyPage`、`changeVisiblePage`、`backPressPage`... | 应用/页面生命周期、DSL 加载、事件分发 |

### 完整职能清单

| 职能 | 说明 | 类比 |
|------|------|------|
| DSL 引擎加载 | 根据 manifest 选择 Vue 或 XVM | 浏览器选择渲染模式 |
| 虚拟 DOM | Document/Node/Event 实现 | 浏览器 DOM API |
| 渲染管线 | Listener → Action → Streamer → callNative | 浏览器渲染队列 |
| 模块系统 | registerModules → requireModule → invokeNative | Web API（fetch/geolocation） |
| 回调映射 | _callbacks[cbId] 存储，execInvokeCallback 分发 | JSONP 回调 |
| 应用生命周期 | createApplication / destroyApplication / onShow / onHide | Activity 生命周期 |
| 页面生命周期 | createPage / destroyPage / changeVisiblePage / backPressPage | Fragment 生命周期 |
| 事件系统 | fireEvent / processCallbacks | 浏览器事件循环 |
| 资源加载 | readResource / requireBundle | script 标签加载 |
| 定时器 | setTimeout / setInterval | 浏览器定时器 |
| 路由 | history.push / history.back | History API |

### 一句话总结

infras.js 就是快应用的"浏览器内核 JS 层"——提供 DOM、事件、模块、生命周期、渲染管线等所有运行时能力，让快应用 JS 代码像写网页一样写 UI，但底层渲染走 Android 原生 View。

---

## 6. J2V8 深入：本质、核心 API、同步通信

### 问题：J2V8 是第三方包吗？本质是什么？能实现 JSI 同步通信吗？

**是第三方开源库**，快应用做了深度定制：

- 原始项目：`com.eclipsesource.v8`
- 快应用封装：`org.hapjs:jsenv:1.3.0`（AAR），内含 `libjsenv.so` + Java 绑定类
- 安装：`implementation 'org.hapjs:jsenv:1.3.0'`（通过 publishToMavenLocal）

### 本质：JNI 封装 V8 的 C++ API 给 Java 使用

```
Java 层                    JNI 层                    C++ 层
─────────                  ──────                    ──────
V8.java          ────►     v8_jni.cpp     ────►      v8::Isolate
V8Object.java                                        v8::Object
V8Array.java                                         v8::Array
JavaCallback.java                                    v8::FunctionTemplate
```

### 同步通信实现

J2V8 的 `registerJavaMethod` 就是同步调用：

```java
v8.registerJavaMethod(new JavaCallback() {
    @Override
    public Object invoke(V8Object receiver, V8Array parameters) {
        // Java 代码，在 JS 线程上同步执行
        return nativeInvoke(parameters);
    }
}, "JsBridge");
```

执行流程（同一线程，零切换）：
```
JS Thread：
  JS 执行 JsBridge.invoke()
    → V8 发现是注册的 Java 方法
    → V8 通过 JNI 调用 Java invoke()（同线程，同步）
    → Java 执行完毕返回
    → V8 拿到返回值，继续执行 JS
```

### 和 RN JSI 的对比

| | J2V8（快应用） | RN JSI |
|---|---|---|
| 绑定层 | Java ↔ V8（经过 JNI） | C++ ↔ JS 引擎（直接） |
| JNI 开销 | 有一层 JNI 调用开销 | 无（纯 C++） |
| 同步调用 | ✅ registerJavaMethod | ✅ HostFunction |
| 对象传递 | V8Object（引用，非拷贝） | JSI HostObject（零拷贝） |

本质思路一样：把 Native 函数注册到 JS 引擎全局环境，JS 调用时同步执行。J2V8 多了一层 JNI。

### 核心 API

```java
// 引擎管理
V8 v8 = V8.createV8Runtime();                     // 创建实例
V8 v8 = V8.createV8Runtime(null, null, snapshot);  // 带快照创建

// 执行 JS
v8.executeScript("var x = 1 + 2");
v8.executeVoidFunction("createPage", args);        // 调用 JS 全局函数

// 注册 Java 方法给 JS 调用（同步 JSI）
v8.registerJavaMethod(JavaCallback cb, String name);      // 有返回值
v8.registerJavaMethod(JavaVoidCallback cb, String name);   // 无返回值

// 对象/数组操作
V8Object obj = new V8Object(v8);
v8.add("globalObj", obj);                          // 挂到全局
V8Array arr = new V8Array(v8);
arr.push("item");

// 类型转换
V8ObjectHelper.toV8Array(v8, javaList);
V8ObjectHelper.toList(v8Array);
```

### 快应用中的实际使用

```java
// JsBridgeRegisterHelper.java
public void registerBridge() {
    // 定时器：setTimeout/setInterval
    JsUtils.registerAllPublicMethodsToRoot(new JsBridgeTimer(jsContext));
    // 路由：history.push/back
    v8.add("history", new JsBridgeHistory(jsContext, native));
    // Feature 调用通道
    JsInterfaceProxy.register(v8, jsInterface, "JsBridge");
    // 渲染通道
    v8.registerJavaMethod(callNativeCallback, "callNative");
    // 资源读取
    v8.registerJavaMethod(readResourceCallback, "readResource");
}
```
