# RPK 加载与运行流程 — 从包到屏幕像素

> 本质：rpk 就是一个带签名的 zip 包，里面是 JS Bundle + CSS JSON + 静态资源 + manifest。Android 引擎解压后，按需读取 JS/CSS 文本交给 V8 执行，V8 执行后产出渲染指令，最终创建 Native View。

---

## 目录

- [1. RPK 包里面到底是什么](#1-rpk-包里面到底是什么)
- [2. 从用户点击到 JS 引擎就绪](#2-从用户点击到-js-引擎就绪)
- [3. App 创建阶段](#3-app-创建阶段)
- [4. Page 创建阶段](#4-page-创建阶段)
- [5. 资源读取机制](#5-资源读取机制)
- [6. 完整时序图](#6-完整时序图)
- [7. 关键 Java 类索引](#7-关键-java-类索引)
- [8. 对自建动态渲染框架的落地启示](#8-对自建动态渲染框架的落地启示)

---

## 1. RPK 包里面到底是什么

一个编译后的 rpk 解压后的真实文件结构：

```
sample.debug.rpk (zip 解压后)
├── manifest.json                  ← 应用清单（路由表、权限、Feature声明、图标）
├── app.js                         ← 应用入口（$app_define$ 注册 app 组件）
├── app.css.json                   ← 应用级公共样式（JSON 格式）
├── home/
│   ├── index.js                   ← 首页 JS（$app_define$ + $app_bootstrap$）
│   └── index.css.json             ← 首页样式（JSON 格式）
├── component/basic/text/
│   ├── index.js                   ← 组件页面 JS
│   └── index.css.json             ← 组件页面样式
├── common/
│   └── logo.png                   ← 静态资源
├── app-chunks.json                ← 公共 JS chunk 映射（splitChunks 模式）
├── page-chunks.json               ← 页面级 chunk 映射
└── META-INF/
    ├── CERT.SF                    ← 签名摘要
    └── CERT.RSA                   ← 签名证书
```

**每个页面的 JS 文件内容长什么样**（编译产物）：

```javascript
// home/index.js（简化）

// ─────────────────────────────────────────────────────────────────
// $app_script$: 编译器生成的包装函数，包裹开发者写的 <script> 代码
// 作用：将开发者的组件定义（data/methods/lifecycle）挂到 $app_module$.exports 上
// 来源：hap-dsl-xvm/src/loaders/ux-loader.js 的 assemble() 函数生成
// ─────────────────────────────────────────────────────────────────
var $app_script$ = function($app_module$, $app_exports$, $app_require$) {
  $app_module$.exports = {
    data: { name: 'QuickApp' },
    handleClick: function() { this.name = 'World' }
  }
}

// ─────────────────────────────────────────────────────────────────
// $app_define$(componentName, deps, factory):
//   【运行时全局函数】由 JS Framework (dsls/xvm) 在 initInfras 时注册到 global 上
//   作用：注册一个组件定义。类似 AMD 的 define()
//   参数：
//     - componentName: 组件标识（如 '@app-component/home'）
//     - deps: 依赖列表（通常为空数组）
//     - factory: 工厂函数，执行后将 template/style/script 挂到 module.exports
// ─────────────────────────────────────────────────────────────────
$app_define$('@app-component/home', [], function($app_require$, $app_exports$, $app_module$) {

  // 执行开发者脚本，将组件定义挂到 module.exports
  $app_script$($app_module$, $app_exports$, $app_require$)
  if ($app_exports$.__esModule && $app_exports$.default) {
    $app_module$.exports = $app_exports$.default
  }

  // template: 编译器将 <template> HTML 转为 JSON 树，运行时直接遍历创建 VDom
  $app_module$.exports.template = {
    "type": "div",
    "classList": ["container"],
    "children": [
      {"type": "text", "attr": {"value": "Hello {{name}}"}},
      {"type": "input", "attr": {"type": "button", "value": "Click"}, "events": {"click": "handleClick"}}
    ]
  }

  // style: 编译器将 <style> CSS 转为 JSON 对象（选择器→属性映射）
  $app_module$.exports.style = {".container": {"flexDirection": "column", "padding": "20px"}}
})

// ─────────────────────────────────────────────────────────────────
// $app_bootstrap$(componentName, options):
//   【运行时全局函数】由 JS Framework (dsls/xvm) 注册
//   作用：告诉框架"这个组件是页面入口，开始实例化并渲染"
//   只有页面级组件才会调用 $app_bootstrap$，子组件只有 $app_define$
//   调用后触发：new VM() → 编译 template JSON → 创建 VDom → Listener → Native 渲染
// ─────────────────────────────────────────────────────────────────
$app_bootstrap$('@app-component/home', {packagerVersion: "2.0.6"})
```

**这些 `$` 开头函数的总结**：

| 函数 | 定义在哪 | 谁调用 | 做什么 |
|------|---------|--------|--------|
| `$app_define$` | JS Framework 运行时（`dsls/xvm/app/bundle.js`） | 编译产物自动调用 | 注册组件定义（template + style + script） |
| `$app_bootstrap$` | JS Framework 运行时（`dsls/xvm/page/bundle.js`） | 编译产物自动调用（仅页面入口） | 实例化组件并启动渲染 |
| `$app_script$` | 编译器生成（`ux-loader.js`） | `$app_define$` 的 factory 内部调用 | 包裹开发者的 script 代码 |
| `$app_require$` | JS Framework 运行时 | 开发者代码中 require 其他模块 | 加载依赖组件/模块 |
| `$app_module$` | JS Framework 运行时 | factory 函数参数 | 类似 CommonJS 的 module 对象 |
| `$app_exports$` | JS Framework 运行时 | factory 函数参数 | 类似 CommonJS 的 exports 对象 |

本质上就是一套**类 AMD/CommonJS 的模块协议**——编译器负责按这个格式生成代码，运行时负责提供这些全局函数来执行它。

**关键认知**：运行时拿到的不是原始 .ux 文件，而是已经编译好的 JS 代码。模板和样式已经是 JSON 数据了，嵌在 JS 里面。

---

### 1.1 框架核心 `$` 注入函数全表

这些 `$` 开头的函数构成了**编译器和运行时之间的契约协议**。编译器按这个格式生成代码，运行时提供这些函数来消费它。

| 函数 | 定义位置（运行时） | 谁调用 | 做什么 |
|------|-------------------|--------|--------|
| `$app_define$(name, deps, factory)` | `dsls/xvm/{app,page}/bundle.js` → `$define` | 编译产物 | 注册组件定义。执行 factory 得到 module.exports（含 template/style/script） |
| `$app_bootstrap$(name, config)` | `dsls/xvm/{app,page}/bundle.js` → `$bootstrap` | 编译产物（仅入口组件） | 启动渲染。App 层：触发 onCreate；Page 层：`new XVm()` → 编译模板 → 创建 VDom → 渲染 |
| `$app_require$(name)` | 绑定到 `platform.requireModule()` | 编译产物 / 开发者代码 | 加载 Native Feature 模块（如 `@system.device`、`@system.router`） |
| `$app_define_wrap$(name, fn)` | `dsls/xvm/app/bundle.js` → `$defineWrap` | 编译产物（懒加载组件） | 注册懒加载组件的包装函数，组件首次使用时才执行 |
| `$app_evaluate$(path)` | `dock/interface.js` → `makeEvaluateBuildScript()` | 编译产物（splitChunks 模式） | 加载并执行独立 JS 文件（按需加载公共 chunk） |
| `$app_data$(module, require)` | 卡片运行时 | 编译产物（卡片专用） | 处理卡片 `<data>` 标签的数据绑定 |

**最核心的三个**（做任何动态渲染框架都需要）：

```
$app_define$   → 注册（告诉框架"有这么一个组件，它的定义是什么"）
$app_bootstrap$ → 启动（告诉框架"开始渲染这个组件"）
$app_require$  → 依赖（告诉框架"我需要某个模块的能力"）
```

**注入方式**：

```javascript
// 运行时在执行编译产物 JS 代码之前，将这些函数作为 global 变量注入
// 方式一（Native 渲染）：通过 invokeScript 的 globalObjects 参数注入
invokeScript({
  $app_define$: instDefine,
  $app_bootstrap$: instBootstrap,
  $app_require$: instRequireModule,
  $app_define_wrap$: instDefineWrap,
  $app_evaluate$: instEvaluate
}, pageJsCode, 'home/index.js')

// 方式二（H5 渲染）：直接挂到 global 上
global.$app_define$ = instDefine
global.$app_bootstrap$ = instBootstrap
```

**设计本质**：这就是一套类 AMD/CommonJS 的模块协议，用 `$app_` 前缀避免和开发者代码冲突。如果你自建框架，也需要定义类似的"编译器 ↔ 运行时"契约——一个注册函数 + 一个启动函数 + 一个依赖加载函数，其他都是扩展。

### 1.2 注入原理 — 为什么编译产物里的 `$app_define$` 能被调用

核心问题：编译产物（home/index.js）只是一段 JS 字符串，里面调用了 `$app_define$`，但这个函数不是它自己定义的。**是谁、在什么时候、通过什么机制把这些函数"塞"进去的？**

答案：**函数参数注入（闭包沙箱）**。

#### 机制拆解

```javascript
// src/shared/function.js → invokeScript()

function invokeScript(globalObjects, body, bundleUrl) {
  // globalObjects = { $app_define$: fn, $app_bootstrap$: fn, ... }
  // body = 编译产物的 JS 代码字符串

  if (typeof global.compileAndRunScript === 'function') {
    return callFunctionNative(globalObjects, body, bundleUrl)
  }
  return callFunction(globalObjects, body)
}
```

有两种实现方式，取决于 JS 引擎：

#### 方式一：V8 原生 `compileAndRunScript`（生产环境）

```javascript
function callFunctionNative(globalObjects, body, bundleUrl) {
  // 1. 将 globalObjects 的 key 拼成函数参数列表
  const keys = Object.keys(globalObjects)
  // keys = ['$app_define$', '$app_bootstrap$', '$app_require$', ...]

  // 2. 将编译产物包裹为一个闭包函数
  let script = `(function ($app_define$, $app_bootstrap$, $app_require$, ...) {
    ${body}   // ← 编译产物代码在这里执行
  })`

  // 3. V8 编译+执行这段 script，得到一个函数引用
  let fn = global.compileAndRunScript(script, bundleUrl)
  //  ↑ 这是 Native 通过 JNI 注入到 V8 global 上的 C++ 函数

  // 4. 用 globalObjects 的 value（真正的函数实现）作为参数调用
  fn(...Object.values(globalObjects))
  //  → fn(instDefine, instBootstrap, instRequireModule, ...)
}
```

**本质**：把编译产物包在一个 IIFE 里，通过函数参数传入框架函数。编译产物内部看起来像在调用"全局变量"，实际是闭包里的参数。

#### 方式二：`new Function()` 构造（Fallback / 测试环境）

```javascript
function callFunction(globalObjects, body) {
  const keys = Object.keys(globalObjects)   // ['$app_define$', '$app_bootstrap$', ...]
  const values = Object.values(globalObjects) // [fn, fn, ...]

  keys.push(body)  // 最后一个参数是函数体

  // 等价于: new Function('$app_define$', '$app_bootstrap$', ..., '编译产物代码')
  const fn = new Function(...keys)

  // 执行时传入真正的实现
  fn(...values)
}
```

**和 `new Function` 的类比**：

```javascript
// 这两种写法效果相同：
// 写法1（new Function）
const fn = new Function('$app_define$', '$app_bootstrap$', 'return $app_define$("home")')
fn(myDefine, myBootstrap)

// 写法2（等价的手写版本）
(function($app_define$, $app_bootstrap$) {
  return $app_define$("home")
})(myDefine, myBootstrap)
```

#### 为什么能调用 Native（Android 侧）

`$app_require$` 最终调用的是 `JsBridge.invoke()`，那 `JsBridge` 是怎么来的？

```
Android 端启动 V8 引擎时：
  → JNI 将 Java 对象注册为 V8 的 global 属性
  → global.JsBridge = V8Object（Java JsBridge 实例的 V8 代理）
  → global.readResource = nativeFunction（读取 rpk 内文件）
  → global.compileAndRunScript = nativeFunction（V8 编译执行）
  → global.callNative = nativeFunction（发送渲染指令）

JS Framework (infras.js) 执行时：
  → 读取 global.JsBridge，封装为 invokeNative() 函数
  → 将 invokeNative 包装为 $app_require$ 返回的模块方法

编译产物执行时：
  → device.getInfo() → invokeNative() → JsBridge.invoke() → JNI → Java
```

#### 完整注入链路图

```
┌─ Android (Java) ─────────────────────────────────────────────────────┐
│                                                                       │
│  1. 创建 V8 引擎                                                      │
│  2. 通过 JNI 注入 global 对象:                                        │
│     global.JsBridge = JavaObject (J2V8 绑定)                          │
│     global.readResource = NativeFunction                              │
│     global.compileAndRunScript = NativeFunction                       │
│     global.callNative = NativeFunction                                │
│                                                                       │
│  3. 加载并执行 infras.js (JS Framework)                               │
│     → initInfras() 完成后，global 上又多了:                            │
│        global.createApplication = fn                                   │
│        global.createPage = fn                                          │
│        global.registerModules = fn                                     │
│        global.processCallbacks = fn                                    │
│        ...                                                             │
│                                                                       │
│  4. 调用 createApplication(appId, appJsCode, css, meta)               │
│     → JS 侧 dock.createApplication()                                  │
│     → initApp(inst, appJsCode)                                         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ JS Framework (infras.js 内部) ──────────────────────────────────────┐
│                                                                       │
│  5. initApp(inst, appJsCode):                                         │
│     // 准备注入对象                                                    │
│     const globalObjects = {                                            │
│       $app_define$: (...args) => $define(inst, ...args),               │
│       $app_bootstrap$: (name, config) => $bootstrap(inst, name, cfg), │
│       $app_require$: (name) => platform.requireModule(inst, name),     │
│       $app_evaluate$: makeEvaluateBuildScript(globals),                │
│     }                                                                  │
│                                                                       │
│  6. invokeScript(globalObjects, appJsCode, 'app.js')                  │
│     → callFunctionNative():                                            │
│       script = "(function($app_define$,$app_bootstrap$,...) { 编译产物 })"│
│       fn = compileAndRunScript(script)  // V8 编译                     │
│       fn(instDefine, instBootstrap, ...) // 传入真正实现               │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ 编译产物 (app.js / page.js) ────────────────────────────────────────┐
│                                                                       │
│  7. 在闭包内执行:                                                      │
│     $app_define$('@app-component/home', [], factory)                   │
│       → 实际调用的是 instDefine → $define(page, name, factory)         │
│       → factory 内部: $app_module$.exports.template = {...}            │
│                                                                       │
│     $app_bootstrap$('@app-component/home', config)                    │
│       → 实际调用的是 instBootstrap → new XVm() → 渲染启动             │
│                                                                       │
│     $app_require$('@system.device')                                   │
│       → 实际调用的是 instRequireModule                                 │
│       → platform.requireModule(inst, 'system.device')                 │
│       → 返回 { getInfo: fn, ... }                                     │
│       → getInfo() → invokeNative() → JsBridge.invoke() → JNI → Java │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

#### 一句话总结

**编译产物不在真正的 global 作用域执行**，而是被包裹在一个闭包函数里。框架通过函数参数把 `$app_define$` 等实现"传进去"。这些实现内部调用了 V8 的 global 对象（`JsBridge`/`callNative`），而这些 global 对象是 Android 通过 JNI 注入到 V8 引擎的。

**调用链**：`编译产物 → 闭包参数($app_xxx$) → JS Framework 函数 → global.JsBridge → JNI → Java`

---

## 2. 从用户点击到 JS 引擎就绪

```
用户点击快应用入口（桌面图标/搜索结果/负一屏卡片/Push 通知）
  │
  ├─ 1. CacheStorage 检查本地是否有该包的缓存
  │     ├─ 有 → 直接使用解压后的文件
  │     └─ 无 → 下载 rpk → 签名校验（RSA）→ zip 解压到私有目录
  │
  ├─ 2. 解析 manifest.json → 得到 AppInfo（路由表、入口页、Feature 列表）
  │
  ├─ 3. 启动 Activity → 创建 RootView
  │
  ├─ 4. 创建 JS 线程（JsThread）→ 创建 V8 引擎实例
  │
  ├─ 5. 加载 infras.js（JS Framework）
  │     ├─ 优先使用 snapshot（预编译的字节码，跳过解析）
  │     └─ fallback: 从 assets/js/infras.js 读取源码执行
  │
  ├─ 6. 调用 global.initInfras()
  │     → Platform 层初始化（console/timer/router）
  │     → Runtime 层初始化（DOM 冻结）
  │     → Dock 层初始化（注册全局函数）
  │
  └─ 7. JS Framework 就绪，等待 Native 发号施令
```

---

## 3. App 创建阶段

Native 端 `JsEngineImpl.createApplication()` 的调用序列：

```java
// 1. 注册 manifest 信息到 JS 层
mV8.executeVoidFunction("registerManifest", [metaInfo]);

// 2. 加载 DSL（从 assets 读取 dsl-xvm.js 并执行）
mV8.executeVoidFunction("locateDsl", null);

// 3. 创建应用（传入 app.js 代码 + 公共 CSS）
mV8.executeVoidFunction("createApplication", [appId, appJs, appCss]);
```

**JS 侧发生了什么**：

```
registerManifest(metaInfo)
  → 存储 manifest 信息，供后续 getManifestField() 查询

locateDsl()
  → 从 manifest 读取 dsl.name（默认 "xvm"）
  → loadResource("assets:///js/dsls/dsl-xvm.js")
  → 执行 DSL 代码 → installDsl() → DSL 订阅事件

createApplication(appId, appJs, appCss)
  → bootstrap 路由 → dock.createApplication()
  → new XApp(id)
  → initInterface(app)（注册 Feature 模块到 app 上下文）
  → publish(initApp, [app, code])
  → DSL 层执行 app.js（$app_define$ 注册 app 组件定义）
```

---

## 4. Page 创建阶段

当用户导航到某个页面时，Native 调用：

```java
// Native 读取页面 JS 和 CSS
String pageJs = AppResourcesLoader.getPageJs(context, pkg, page);   // 从 rpk 缓存读取
String pageCss = AppResourcesLoader.getPageCss(context, pkg, page); // 从 rpk 缓存读取
String chunks = AppResourcesLoader.getJsChunks(pkg, chunksPath);    // 公共 chunk 映射

// 注册 chunks（如果有 splitChunks）
mV8.executeVoidFunction("registerBundleChunks", [chunks]);

// 创建页面
mV8.executeVoidFunction("createPage", [pageId, appId, pageJs, params, intent, meta, pageCss]);
```

**JS 侧发生了什么**：

```
registerBundleChunks(chunksJson)
  → 将 {filePath: jsCode} 映射存入缓存 Map
  → 后续 $app_require$ 可以从中加载依赖模块

createPage(pageId, appId, pageJs, params, intent, meta)
  → bootstrap 路由 → dock.createPage()
  → new XPage(id, app, intent, meta, query)
  → publish(initPage, [page, code, query, globals])
  → DSL 层接管：
      ├─ 执行页面 JS（$app_define$ 注册组件）
      ├─ $app_bootstrap$ 触发实例化根组件 VM
      ├─ VM 的 template（JSON树）被 compiler 遍历
      ├─ 创建 VDom 节点，触发 Listener
      ├─ Listener 生成 Action（addElement/updateAttrs...）
      ├─ Streamer 批量发送 → callNative
      └─ Listener.createFinish() → 告诉 Native "首次渲染完毕"
```

---

## 5. 资源读取机制

### 5.1 RpkSource — 从解压后的 rpk 读文件

```java
// 核心读取类
class RpkSource implements Source {
    // 通过 CacheStorage 定位到 rpk 解压目录
    // 读取指定路径的文件内容为 String
}

// 使用方式
String pageJs = JavascriptReader.get().read(new RpkSource(context, pkg, "home/index.js"));
String pageCss = TextReader.get().read(new RpkSource(context, pkg, "home/index.css.json"));
```

### 5.2 预加载机制

为了加快页面渲染，Native 在 IO 线程提前读取资源：

```java
AppResourcesLoader.preload(context, request)
  ├─ IO线程: loadAppJs()      → 预读 app.js
  ├─ IO线程: loadAppCss()     → 预读 app.css.json
  ├─ IO线程: loadJsChunks()   → 预读 app-chunks.json
  └─ IO线程: loadPageJs()     → 预读首页 JS
             loadPageCss()    → 预读首页 CSS
```

当 JsThread 需要时，直接从内存缓存取，避免二次 IO。

### 5.3 JS 侧资源读取

JS 侧通过 `global.readResource(uri)` 读取 rpk 内的文件：

```javascript
// 读取 DSL 文件
loadResource("assets:///js/dsls/dsl-xvm.js")

// 读取 Bundle（parser、canvas、animation）
readResource("assets:///js/bundles/parser.js")

// 这些调用最终通过 JNI → Java 的 ResourceManager → 从 rpk 解压目录读文件
```

---

## 6. 完整时序图

```
┌──────────┐        ┌──────────┐       ┌──────────┐      ┌──────────┐
│  Native  │        │ JsThread │       │  V8/QJS  │      │ JS Fwk   │
│  (UI)    │        │  (Java)  │       │ (Engine) │      │ (infras) │
└────┬─────┘        └────┬─────┘       └────┬─────┘      └────┬─────┘
     │                    │                   │                  │
     │ 1.启动Activity     │                   │                  │
     │───────────────────→│                   │                  │
     │                    │ 2.创建V8引擎       │                  │
     │                    │──────────────────→│                  │
     │                    │                   │                  │
     │                    │ 3.执行infras.js    │                  │
     │                    │──────────────────→│──────────────────→│
     │                    │                   │  initInfras()     │
     │                    │                   │←─────────────────│
     │                    │                   │  (注册全局函数)    │
     │                    │                   │                  │
     │                    │ 4.registerManifest │                  │
     │                    │──────────────────→│──────────────────→│
     │                    │                   │                  │
     │                    │ 5.locateDsl       │                  │
     │                    │──────────────────→│──────────────────→│
     │                    │                   │  (加载dsl-xvm.js) │
     │                    │                   │                  │
     │                    │ 6.createApp(appJs) │                  │
     │                    │──────────────────→│──────────────────→│
     │                    │                   │  (执行app.js)     │
     │                    │                   │                  │
     │                    │ 7.registerChunks   │                  │
     │                    │──────────────────→│──────────────────→│
     │                    │                   │                  │
     │                    │ 8.createPage(js)  │                  │
     │                    │──────────────────→│──────────────────→│
     │                    │                   │  (执行页面js)     │
     │                    │                   │  (编译模板JSON)   │
     │                    │                   │  (创建VDom)       │
     │                    │                   │                  │
     │                    │   callNative(actions[])               │
     │                    │←─────────────────│←─────────────────│
     │                    │                   │                  │
     │  9.创建NativeView  │                   │                  │
     │←──────────────────│                   │                  │
     │  addView/layout    │                   │                  │
     │                    │                   │                  │
     │ 10.屏幕渲染 ✓      │                   │                  │
     │                    │                   │                  │
```

---

## 7. 关键 Java 类索引

| 你想理解... | Java 类 | 路径 |
|------------|---------|------|
| rpk 下载/缓存/解压 | `CacheStorage` | card/platform/android/ |
| 从 rpk 读 JS/CSS | `AppResourcesLoader` | runtime/src/main/java/.../render/ |
| rpk 文件源 | `RpkSource` | runtime/src/main/java/.../render/ |
| JS 线程管理 | `JsThread` / `AppJsThread` | runtime/src/main/java/.../jsruntime/ |
| V8 引擎封装 | `JsEngineImpl` | runtime/src/main/java/.../jsruntime/ |
| JS↔Native 桥 | `JsBridge` | runtime/src/main/java/.../bridge/ |
| Feature 模块管理 | `ExtensionManager` | runtime/src/main/java/.../bridge/ |
| 渲染指令处理 | `RenderActionManager` | runtime/src/main/java/.../render/ |
| View 创建 | `ComponentFactory` | runtime/src/main/java/.../component/ |
| 沙箱进程通信 | `SandboxChannelReceiver` | runtime/src/main/java/.../sandbox/ |

---

## 8. 对自建动态渲染框架的落地启示

### 8.1 包格式设计

快应用的 rpk = zip + 签名，你自建框架的包格式也可以类似：

```
你的 bundle 包 (.bundle / .pkg / .rpk)
├── manifest.json     ← 路由、版本、权限声明
├── app.js            ← 应用入口
├── pages/            ← 各页面编译产物
├── assets/           ← 静态资源
└── signature         ← 签名（可选）
```

**关键设计决策**：
- 用 zip 还是自定义二进制格式？→ zip 通用、工具支持好、可流式解压
- 要不要签名？→ 如果走下发渠道（CDN/服务端），必须签名防篡改
- 文件排序？→ 让 manifest 和入口 JS 排在 zip 最前面，支持流式加载

### 8.2 资源加载策略

```
1. 预加载（preload）  → IO 线程提前读取 app.js + 首页 JS + CSS
2. 缓存（cache）      → 读过的资源存内存 Map，避免重复 IO
3. 按需加载（lazy）   → 子页面 JS 在导航时才读取
4. Chunk 映射         → splitChunks 的公共模块通过 JSON 映射按需加载
```

### 8.3 启动链路优化点

从源码可以看到快应用做了这些优化：
1. **infras.js snapshot**：预编译为字节码（.jsc），跳过 V8 解析阶段
2. **IO 预加载**：Activity 启动的同时在 IO 线程预读 JS/CSS
3. **注册和创建分离**：registerManifest/locateDsl 在 createApp 之前，减少首帧阻塞
4. **Action 批量发送**：首次渲染的几百条 DOM 操作合并为几批传输

### 8.4 如果你做的是服务端驱动 UI（Server-Driven UI）

快应用的链路是：**编译期生成 JS Bundle → 打包为 rpk → 下载到本地 → V8 执行 JS → 产出渲染指令**

如果你要做 SDUI，可以更简化：

```
服务端直接下发 JSON 模板（跳过 JS 执行环节）
  → Native/Flutter 直接解析 JSON → 创建 Widget/View

或者：
服务端下发 JS Bundle（保留逻辑能力）
  → 轻量 JS 引擎执行 → 产出 JSON 渲染树 → Native 渲染
```

核心取舍：
- **有 JS 引擎**：支持动态逻辑（条件渲染、事件处理、网络请求），但启动慢
- **纯 JSON 驱动**：启动快、简单，但表达能力有限（需要预定义 action 协议）
- **混合方案**：JSON 描述结构 + 简单表达式引擎处理动态绑定（参考 Tangram、DiDi Chameleon）
