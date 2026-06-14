# Bridge 通信机制深度解析 — 跨端框架的核心中的核心

> 本质：跨端框架 = 两个运行时（JS + Native）之间的高效通信。Bridge 的设计决定了整个框架的性能天花板和编程模型。

---

## 目录

- [0. 跨层通信的三个根本问题](#0-跨层通信的三个根本问题)
- [1. 为什么 Bridge 是核心中的核心](#1-为什么-bridge-是核心中的核心)
- [2. 快应用的 Bridge 实现（J2V8）](#2-快应用的-bridge-实现j2v8)
- [3. 业界方案全景对比](#3-业界方案全景对比)
- [4. JSI 为什么是目前最优解](#4-jsi-为什么是目前最优解)
- [5. 如果自建框架怎么选](#5-如果自建框架怎么选)
- [6. 核心设计模式提取](#6-核心设计模式提取)

---

## 0. 跨层通信的三个根本问题

任何跨端框架的通信机制，不管技术实现如何花哨，本质都在回答三个问题：

| # | 问题 | 本质 |
|---|------|------|
| **Q1** | 函数怎么传递的？ | 我怎么**调到**对方的代码（寻址） |
| **Q2** | 参数怎么传递的？ | 入参怎么**跨边界**送过去（序列化） |
| **Q3** | 结果怎么传递的？ | 返回值/回调怎么**拿回来**（回传） |

但在回答这三个问题之前，先要理解一个更根本的事实：

### 0.1 为什么需要"通信"？—— 三块隔离的内存世界

快应用运行在**同一个 Linux 进程**里，但内存被划分为三个互相不认识的区域：

```
┌───────────────────────────────────────────────────────────────────┐
│                    同一个 Android 进程 (com.miui.hybrid)           │
│                                                                    │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐    │
│  │   Java Heap    │   │  Native Heap   │   │    V8 Heap     │    │
│  │   (JVM GC)     │   │  (C++ malloc)  │   │   (V8 GC)     │    │
│  │                │   │                │   │                │    │
│  │ • Widget 实例  │   │ • V8 引擎本体  │   │ • JS 对象      │    │
│  │ • Android View │   │ • YogaNode     │   │ • VDom 节点    │    │
│  │ • Feature 实例 │   │ • JNI 绑定对象 │   │ • 回调函数     │    │
│  │ • JSON 解析结果│   │ • 字符串缓冲区 │   │ • 模块定义     │    │
│  │                │   │                │   │                │    │
│  └───────┬────────┘   └───────┬────────┘   └───────┬────────┘    │
│          │                    │                     │             │
│          │◄────── JNI ───────►│◄──── V8 C++ API ──►│             │
│          │                    │                     │             │
│          │◄──── J2V8（封装了 JNI + V8 API）────────►│             │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

**为什么不能直接互访**：
- Java Heap 的对象地址对 V8 无意义（JVM GC 会移动对象，地址不稳定）
  - gc语言的内存分配都是不稳定的, 可能会被回收,所以跨层传递的时候, 需要拷贝
- V8 Heap 的 JS 对象对 Java 无意义（V8 有自己的内存布局、隐藏类、GC）
- 两边的类型系统完全不同（Java `String` ≠ V8 `v8::String` ≠ JS 的字符串）
- 同一个进程但**内存管理器不同**，就像两个人在同一栋楼但说不同的语言

**所以通信的本质是"内存翻译"**：把一侧堆里的数据，翻译成另一侧堆能理解的格式，拷贝过去。

### 0.2 快应用的具体通信路径

**JS → Native（数据流向）**：

```
V8 Heap 中的 JS 对象
  │
  │ ① JSON.stringify()  —— JS 侧序列化（V8 Heap 内操作）
  ▼
V8 Heap 中的 JS 字符串 "{"module":"dom","method":"addElement",...}"
  │
  │ ② V8 C++ API: v8::String → const char*  —— V8 Heap → Native Heap（第一次拷贝）
  ▼
Native Heap 中的 C++ 字符串
  │
  │ ③ JNI: NewStringUTF(chars) —— Native Heap → Java Heap（第二次拷贝）
  ▼
Java Heap 中的 java.lang.String
  │
  │ ④ new JSONObject(string) —— Java 侧反序列化
  ▼
Java Heap 中的 JSONObject（可操作的结构化数据）
```

**Native → JS（数据流向）**：

```
Java Heap 中的数据（如 {brand: "Xiaomi"}）
  │
  │ ① JSON 序列化 → Java String
  ▼
Java Heap 中的 java.lang.String
  │
  │ ② JNI: GetStringUTFChars → const char*（Java Heap → Native Heap 拷贝）
  ▼
Native Heap 中的 C++ 字符串
  │
  │ ③ V8 API: v8::String::NewFromUtf8(chars)（Native Heap → V8 Heap 拷贝）
  ▼
V8 Heap 中的 JS 字符串
  │
  │ ④ JSON.parse()  —— V8 Heap 内操作
  ▼
V8 Heap 中的 JS 对象（可操作的结构化数据）
```

**每次通信 = 2 次内存拷贝 + 2 次序列化/反序列化**。这就是性能开销的来源。

### 0.3 三问在快应用中的具体回答

#### JS → Native 方向

| 问题 | 快应用的答案 | 源码位置 |
|------|------------|---------|
| **Q1: 函数怎么寻址** | Android 启动时通过 J2V8 将 Java 方法注册为 V8 的全局函数：`v8.registerJavaMethod(callback, "callNative")`。之后 JS 调 `global.callNative()` 就直接触发 Java lambda | `JsBridge.java` → `register()` |
| **Q2: 参数怎么传递** | JS 侧 `JSON.stringify(actions)` 变成字符串 → 经过 V8→C++→JNI 两次拷贝到达 Java → Java `new JSONObject(str)` 反序列化 | `listener.js` → `streamer.js` → `JsBridge.java` |
| **Q3: 结果怎么回传** | 同步方法：Java 方法直接 `return` 值，J2V8 框架把 Java 返回值转为 V8 值返回给 JS。异步方法：JS 存 `callbacks[42] = fn`，Native 执行完后调 `executeVoidFunction("execInvokeCallback", {cb:42, data:...})`，JS 查表执行回调 | `module/misc.js` → `invokeNative()` |

#### Native → JS 方向

| 问题 | 快应用的答案 | 源码位置 |
|------|------------|---------|
| **Q1: 函数怎么寻址** | JS Framework 在 `initInfras()` 时把函数挂到 `global` 上（如 `global.processCallbacks`），Native 通过 `mV8.executeVoidFunction("processCallbacks", args)` 按名字调用 | `entry/main/index.js` + `JsEngineImpl.java` |
| **Q2: 参数怎么传递** | Java 构造 `V8Array`，逐个 push 参数（int/String/V8Object）。基本类型走 JNI 原始类型传递，复杂对象走 JSON 字符串 | `JsEngineImpl.java` → `createPage()` |
| **Q3: 结果怎么回传** | 通常不需要返回值（事件通知是单向的）。少数需要的场景（如 `backPressPage` 返回 boolean），V8 执行后 J2V8 框架把 JS 返回值转为 Java 类型 | `dock/interface.js` → `backPressPage()` |

### 0.4 一句话总结

> 快应用的三层通信 = **三块独立 GC 管理的堆内存** + **JSON 作为"通用语言"做翻译** + **J2V8 封装了 JNI↔V8 API 的桥接细节**。性能瓶颈不在函数调用本身（JNI 调用是微秒级），而在 **JSON 序列化/反序列化 + 两次内存拷贝**。

---

## 1. 为什么 Bridge 是核心中的核心

一个跨端渲染框架做的所有事情，最终都会归结到两种 Bridge 调用：

```
JS → Native:  渲染指令（创建/更新/删除 View）+ 能力调用（网络/存储/设备）
Native → JS:  事件回传（触摸/滚动/手势）+ 异步回调（API 结果）
```

**Bridge 的性能直接决定了**：
- 首屏渲染速度（几百条 DOM 指令的传输效率）
- 交互流畅度（每次触摸 → 数据变更 → 渲染更新的 RTT）
- API 调用延迟（JS 调 Native 能力的响应时间）

**Bridge 的设计模式直接决定了**：
- 编程模型（同步还是异步？Promise 还是 Callback？）
- 线程模型（JS 和 Native 是否同线程？）
- 内存模型（数据共享还是拷贝？）

---

## 2. 快应用的 Bridge 实现（J2V8）

### 2.1 本质：JNI 函数注册

快应用用的是 **J2V8**（`com.eclipsesource.v8`），一个 V8 引擎的 Java 绑定库。

```java
// JsBridge.java — 核心注册逻辑
public void register(final V8 v8) {

    // 把 Java 方法直接注册为 V8 global 上的函数
    v8.registerJavaMethod(new JavaCallback() {
        @Override
        public Object invoke(V8Object receiver, V8Array parameters) {
            return readResource(parameters.getString(0));
        }
    }, "readResource");

    v8.registerJavaMethod(new JavaVoidCallback() {
        @Override
        public void invoke(V8Object v8Object, final V8Array v8Array) {
            int pageId = Integer.parseInt(v8Array.get(0).toString());
            String argsString = v8Array.getString(1);  // ← JSON 字符串
            mNative.callNative(pageId, argsString);
        }
    }, "callNative");
}
```

### 2.2 调用路径

```
JS 代码: global.callNative(pageId, JSON.stringify(actions))
           │
           │  V8 引擎内部查找 "callNative" → 发现是 JavaCallback
           │
           ▼
JNI 层:   V8 通过 JNI 调用 Java 的 JavaVoidCallback.invoke()
           │
           │  同线程，同步调用（不跨线程）
           │
           ▼
Java 层:  mNative.callNative(pageId, argsString)
           │
           │  argsString 是 JSON 字符串，需要解析
           │
           ▼
           RenderActionManager.parseActions(argsString)
           → IO 线程解析 JSON → 创建/更新 View
```

### 2.3 数据传递的真实情况

| 层级 | 数据格式 | 序列化开销 |
|------|---------|-----------|
| JS → V8 内部 | V8 内部对象 | 无 |
| V8 → JNI 参数 | `V8Array` / `V8Object` | 有（V8 对象 → Java 对象转换） |
| JNI → Java 业务层 | `String` (JSON) | 有（`getString()` 拷贝字符串） |
| Java 解析 | `JSONObject` / `JSONArray` | 有（JSON.parse） |

**结论**：J2V8 的优势不是"零序列化"，而是**同步直调 + 省掉了异步消息队列的开销**。数据本身还是走 JSON。

### 2.4 和 WebView Bridge 的本质区别

```
WebView 时代:
  JS → window.prompt("jsbridge://module/method?params=xxx")
     → Android WebChromeClient.onJsPrompt()
     → URL 解码 → 分发

  问题：
  1. URL 编码/解码开销
  2. 异步消息队列（WebView 内部是事件驱动）
  3. 字符串长度限制
  4. 无法同步返回值

J2V8:
  JS → global.callNative(pageId, json)
     → 直接 JNI 调用 Java 方法（微秒级）
     → 可以同步返回值

  优势：
  1. 同步调用，无队列等待
  2. 无 URL 编解码
  3. 无长度限制
  4. 可以同步 return
```

---

## 3. 业界方案全景对比

### 3.1 演进历史

```
2014  RN 初版     JSON Bridge（异步批量，跨线程序列化）
2015  快应用      J2V8（同步 JNI，JSON 参数）
2017  Flutter     Platform Channel（异步二进制消息）
2020  RN JSI      C++ Host Objects（零序列化，同步直持）
2022  RN New Arch Fabric + TurboModules（全面 JSI 化）
```

### 3.2 详细对比

| 维度 | WebView Bridge | J2V8 (快应用) | RN Old Bridge | Flutter Channel | **JSI (RN New)** |
|------|---------------|--------------|---------------|----------------|-----------------|
| 调用方式 | URL scheme / prompt | JNI 同步函数调用 | 异步消息队列 | 异步 BinaryMessenger | C++ 同步函数调用 |
| 数据格式 | URL-encoded string | JSON string | JSON string | 二进制 (MessageCodec) | **C++ 对象直接共享** |
| 序列化 | URL encode + JSON | JSON | JSON × 2（来回） | Standard/Binary Codec | **无** |
| 同步/异步 | 异步 | **同步** | 异步 | 异步 | **同步** |
| 返回值 | 无法直接返回 | 可以 return | 需要 callback | 需要 await | 可以 return |
| 线程 | WebView 主线程 | JS 线程 = JNI 调用线程 | JS/Native 各自线程 | Platform Thread | JS 线程 = C++ 线程 |
| 内存模型 | 完全隔离 | 隔离（JSON 拷贝） | 隔离（JSON 拷贝） | 隔离（编码拷贝） | **共享**（同一指针） |
| 批量优化 | 无 | Streamer 50条批量 | BatchedBridge 5ms 合并 | 无内置 | 不需要（单条已足够快） |
| 典型单次调用延迟 | ~5-10ms | ~0.1-0.5ms | ~1-5ms | ~0.5-2ms | ~0.01-0.05ms |

### 3.3 渲染指令的传递对比

```
快应用:
  Listener 生成 Action JSON → Streamer 批量50条
  → JSON.stringify(actions) → callNative(pageId, jsonStr)
  → Java JSON.parse → 分发到各 Widget

RN Old:
  JS Shadow Tree diff → 生成 operations[]
  → JSON serialize → 通过 BatchedBridge 异步传
  → Java JSON parse → UIManagerModule 处理

RN New (Fabric + JSI):
  JS Shadow Tree diff → C++ ShadowNode 直接操作
  → 共享内存，无序列化
  → C++ 直接调 Java/ObjC 更新 View

Flutter:
  Widget rebuild → Element reconcile → RenderObject layout
  → 全在 Dart VM 内完成，不跨 Bridge
  → 只有调用 Native 能力时才走 Platform Channel
```

---

## 4. JSI 为什么是目前最优解

### 4.1 核心思想：Host Objects

```cpp
// JSI 的核心：JS 对象 = C++ 对象的代理
class NativeModule : public jsi::HostObject {
  jsi::Value get(jsi::Runtime& rt, const jsi::PropNameID& name) override {
    if (name == "getDeviceInfo") {
      return jsi::Function::createFromHostFunction(rt, name, 0,
        [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t) {
          // 直接在这里执行 Native 代码，同步返回
          return jsi::String::createFromUtf8(rt, getDeviceBrand());
        });
    }
  }
};

// JS 侧使用：
// const info = nativeModule.getDeviceInfo()  // 同步，零序列化
```

### 4.2 和 J2V8 的本质区别

```
J2V8 (快应用):
  JS: global.JsBridge.invoke("system.device", "getInfo", '{"key":"brand"}', "42")
       │
       │  参数是 JSON 字符串（已序列化）
       ▼
  JNI: Java invoke(String module, String method, String params, String cbId)
       │
       │  Java 解析 JSON → 执行 → 结果再 JSON 序列化 → 通过 callback 回传
       ▼
  JS: execInvokeCallback({callback: 42, data: '{"brand":"Xiaomi"}'})
       │
       │  JSON.parse 结果
       ▼
  开发者拿到 data.brand

JSI (RN):
  JS: nativeModule.getDeviceInfo()
       │
       │  直接 C++ 函数调用，参数是 jsi::Value（JS 引擎内部类型）
       ▼
  C++: 直接读取设备信息，构造 jsi::Object 返回
       │
       │  无序列化，JS 对象和 C++ 对象共享内存
       ▼
  JS: 直接拿到 {brand: "Xiaomi"}（同步返回）
```

**总结差距**：
- J2V8：`stringify → JNI → parse → 执行 → stringify → JNI → parse`（6 步）
- JSI：`C++ 函数调用 → 执行 → 返回 jsi::Value`（1 步）

### 4.3 JSI 的代价

| 优势 | 代价 |
|------|------|
| 零序列化 | 全部用 C++ 写，开发效率低 |
| 同步调用 | 如果 Native 操作耗时，会卡 JS 线程 |
| 共享内存 | 内存管理复杂（GC + C++ 手动管理交叉） |
| 极致性能 | 需要 Codegen 生成绑定代码 |
| 跨平台 | iOS/Android 都要 C++ 层 |

---

## 5. 如果自建框架怎么选

### 5.1 决策树

```
你的渲染目标是什么？
│
├─ Flutter 宿主（Dart 渲染）
│   → 不需要 JS 引擎
│   → 直接解析 JSON 模板 → Widget Tree
│   → 通信成本为零（全在 Dart 进程内）
│   → 只有调用原生能力才走 Platform Channel
│
├─ Native View 渲染 + JS 逻辑（类快应用/RN）
│   │
│   ├─ 团队 Java/Kotlin 为主 + Android Only
│   │   → QuickJS + JNI 绑定（轻量，启动快）
│   │   → 或 V8 + J2V8（性能更高，内存更大）
│   │   → 参数走 JSON 序列化（够用）
│   │
│   ├─ 追求极致性能 + 有 C++ 能力
│   │   → Hermes + JSI 模式
│   │   → Host Objects 直接暴露 Native 能力
│   │   → 参考 RN TurboModules 的 Codegen
│   │
│   └─ 跨 iOS + Android
│       → JSI 或 QuickJS + C 绑定（两端统一）
│
└─ 纯 Server-Driven UI（无 JS 逻辑）
    → 不需要 Bridge
    → 服务端下发 JSON → 客户端直接渲染
    → 动态逻辑用简单表达式引擎处理
```

### 5.2 各方案的工程量估算

| 方案 | 性能 | 工程量 | 适合团队 |
|------|------|--------|---------|
| QuickJS + JNI + JSON | 中 | 2-3 周 | Java 团队 |
| V8 + J2V8 + JSON | 中高 | 2-3 周 | Java 团队 |
| Hermes + JSI (C++) | 极高 | 2-3 月 | 有 C++ 经验的团队 |
| Flutter + JSON 模板 | N/A（无 Bridge） | 1-2 周（纯 Dart） | Flutter 团队 |

### 5.3 推荐：QuickJS + JNI 作为起步方案

```
理由：
1. QuickJS 包体极小（< 1MB），启动快（< 50ms）
2. 纯 C 实现，JNI 绑定简单直接
3. 支持 ES2020+，够用
4. 后续可以平滑升级到 JSI 模式（只改 Bridge 层）
5. 不依赖 Google 的 V8（无供应链风险）
```

---

## 6. 核心设计模式提取

不管用哪种 Bridge 技术，以下设计模式是通用的：

### 6.1 函数注册表

```
Native 启动时 → 将能力函数注册到 JS 引擎的 global 上
JS 调用时    → 通过函数名查找 → 执行对应的 Native 实现
```

### 6.2 回调 ID 映射

```
函数不能跨引擎传递 → 用数字 ID 替代
JS 侧: callbacks[42] = fn
Native: 执行完后 callJs("execCallback", {id: 42, data: result})
JS 侧: callbacks[42](result); delete callbacks[42]
```

### 6.3 批量传输

```
单条调用开销 × N 条 = 很大
→ 缓冲 N 条合并为一批传输
→ 用"结束标记"（updateFinish）告诉对方"这一轮结束了"
```

### 6.4 闭包沙箱注入

```
编译产物不在 global 执行
→ 包裹在 (function($app_define$, ...) { 产物 })(...实现...)
→ 框架函数通过参数传入，形成闭包
→ 安全隔离 + 可控注入
```

### 6.5 双向通信的线程模型

```
JS → Native: 同步调用（或 postMessage 到 Native 线程）
Native → JS: 必须回到 JS 线程执行（Handler.post / runOnJsThread）
原因：JS 引擎单线程，不能从多线程并发访问
```

---

## 7. 快应用 Bridge 的源码入口

| 你想看... | 文件 |
|-----------|-----|
| JsBridge 注册全局函数 | `runtime/android/.../jsruntime/JsBridge.java` |
| callNative 接收渲染指令 | `JsBridge.register()` → `mNative.callNative()` |
| Feature 调用入口 | `ExtensionManager.java` → `invoke()` |
| JS 侧 invokeNative | `infras/platform/module/misc.js` → `invokeNative()` |
| 闭包注入机制 | `shared/function.js` → `invokeScript()` |
| Streamer 批量缓冲 | `infras/runtime/streamer.js` |
| 回调 ID 映射 | `infras/platform/module/misc.js` → `_callbackSourceMap` |
