# 04. JS 引擎集成

> V8/J2V8 在 Android 中的集成、核心 API、在快应用框架中的角色。

## 目录

- [一、为什么 Android 里要嵌入 JS 引擎](#一为什么-android-里要嵌入-js-引擎)
- [二、可选方案对比](#二可选方案对比)
- [三、V8 嵌入架构](#三v8-嵌入架构)
- [四、J2V8 核心 API](#四j2v8-核心-api)
- [五、在快应用框架中的角色](#五在快应用框架中的角色)
- [六、同步 Bridge 的实现细节](#六同步-bridge-的实现细节)
- [七、内存管理与生命周期](#七内存管理与生命周期)
- [八、性能考量](#八性能考量)
- [九、和 RN JSI 的对比](#九和-rn-jsi-的对比)

---

## 一、为什么 Android 里要嵌入 JS 引擎

快应用框架的设计目标：**开发者用 JS 写业务逻辑，但 UI 用原生 View 渲染**。

这就需要在 Android 进程里跑一个 JS 引擎来执行开发者的代码，同时通过 Bridge 让 JS 能调用 Native 能力（UI 渲染、设备 API 等）。

本质上和浏览器一样——浏览器也是在原生进程里嵌入了 V8 来执行 JS。区别是浏览器的渲染层是 Blink（HTML/CSS），快应用框架的渲染层是 Android View。

---

## 二、可选方案对比

| 引擎 | 语言 | 大小 | 性能 | 特点 | 谁在用 |
|------|------|------|------|------|--------|
| V8 | C++ | ~7MB so | 最快（JIT） | Chrome 同款，生态最大 | 快应用框架、Node.js |
| JavaScriptCore (JSC) | C++ | ~3MB so | 快 | Safari 同款 | RN（旧版 iOS） |
| Hermes | C++ | ~3MB so | 启动快（AOT） | Facebook 专为 RN 优化 | RN（新版） |
| QuickJS | C | ~600KB | 中等（解释执行） | 极小，嵌入式友好 | 轻量场景 |
| Duktape | C | ~300KB | 慢 | 最小 | IoT 设备 |

### 快应用框架为什么选 V8

1. **性能最好**：V8 有 JIT（TurboFan），热代码编译成机器码，执行速度接近原生
2. **ES 标准支持最全**：开发者可以用最新 JS 语法
3. **J2V8 绑定成熟**：有现成的 Java 绑定库，不需要自己写 JNI
4. **包体可接受**：~7MB so，对于系统预装应用可以接受（但需要优化）

### 为什么不选 Hermes

Hermes 启动更快（AOT 预编译字节码，不需要 JIT 预热），但：
- 不支持完整的 ES 标准（部分 Proxy/Reflect 不支持）
- 和 V8 的 API 不兼容，迁移成本高
- 快应用框架已经基于 V8/J2V8 构建了整套 Bridge

---

## 三、V8 嵌入架构

```
Android App 进程
│
├── Java 层
│   ├── QuickAppEngine（框架入口）
│   ├── JsBridge（Java 侧 Bridge 管理）
│   └── Feature 实现（相机/网络/存储等 Native 能力）
│
├── JNI 层（J2V8 库）
│   ├── V8Runtime.cpp（V8 实例管理）
│   ├── V8Object.cpp（JS 对象操作）
│   └── V8Function.cpp（JS 函数调用）
│
└── Native 层
    ├── libv8.so（V8 引擎）
    ├── libj2v8.so（J2V8 绑定）
    └── libicudata.so（国际化数据）
```

### V8 核心概念

| 概念 | 说明 | 生命周期 |
|------|------|---------|
| **Isolate** | V8 的独立实例，有自己的堆和 GC | App 生命周期（或页面生命周期） |
| **Context** | 执行上下文，包含全局对象 | 页面生命周期 |
| **HandleScope** | 局部引用的作用域，防止泄漏 | 函数调用期间 |
| **Persistent** | 跨 HandleScope 的持久引用 | 手动管理 |
| **Template** | 对象/函数的模板（用于注册 Native 方法） | Isolate 生命周期 |

---

## 四、J2V8 核心 API

### 创建和销毁

```java
// 创建 V8 运行时（一个 Isolate + 一个 Context）
V8 runtime = V8.createV8Runtime();

// 销毁（必须手动调用，否则内存泄漏）
runtime.release();
```

### 执行 JS 代码

```java
// 执行脚本，返回结果
int result = runtime.executeIntegerScript("1 + 2"); // 3
String str = runtime.executeStringScript("'hello' + ' world'");
V8Object obj = runtime.executeObjectScript("({name: 'test'})");

// 执行无返回值
runtime.executeVoidScript("console.log('hi')");
```

### 注册 Java 方法给 JS 调用（核心：同步 Bridge）

```java
// 注册一个 Java 方法，JS 可以直接调用
runtime.registerJavaMethod(new JavaVoidCallback() {
    @Override
    public void invoke(V8Object receiver, V8Array parameters) {
        String msg = parameters.getString(0);
        Log.d("Bridge", "JS called: " + msg);
    }
}, "nativeLog");

// JS 里直接调用：
// nativeLog("hello from JS");
```

### 带返回值的注册

```java
runtime.registerJavaMethod(new JavaCallback() {
    @Override
    public Object invoke(V8Object receiver, V8Array parameters) {
        // 返回值会传回 JS
        return "response from Java";
    }
}, "getData");

// JS 里：
// var data = getData(); // "response from Java"
```

### 操作 JS 对象

```java
// 创建 JS 对象
V8Object jsObj = new V8Object(runtime);
jsObj.add("name", "test");
jsObj.add("age", 25);

// 注入到全局
runtime.add("myObj", jsObj);

// JS 里可以访问：
// console.log(myObj.name); // "test"

// 用完必须 release
jsObj.release();
```

### 调用 JS 函数

```java
// 从 JS 获取函数引用
V8Function jsFunc = (V8Function) runtime.executeScript("(function(x) { return x * 2; })");

// 从 Java 调用 JS 函数
V8Array args = new V8Array(runtime).push(21);
Object result = jsFunc.call(runtime, args); // 42
args.release();
jsFunc.release();
```

---

## 五、在快应用框架中的角色

```
开发者写的 JS 代码（页面逻辑 + 模板 + 样式）
    ↓ 编译打包成 JS Bundle
    ↓ 运行时加载到 V8
    ↓ V8 执行 JS → 生成虚拟 DOM
    ↓ Diff → 产出渲染指令（JSON）
    ↓ 通过 J2V8 Bridge 传给 Java 层
    ↓ Java 层解析指令 → 创建/更新 Android View
```

### V8 在框架中承担的具体职责

| 职责 | 说明 |
|------|------|
| 执行业务逻辑 | 开发者的 JS 代码在 V8 里跑 |
| 虚拟 DOM 管理 | JS 侧维护 VDOM 树，diff 算法在 JS 里执行 |
| 事件处理 | 用户点击/滑动 → Native 通过 Bridge 通知 JS → JS 处理 → 可能触发重渲染 |
| Feature 调用 | JS 调用 `system.fetch()` → Bridge → Java 层执行网络请求 → 回调回 JS |
| 生命周期管理 | 页面 onCreate/onShow/onHide/onDestroy 映射到 JS 的生命周期函数 |

### 数据流向

```
用户操作（点击按钮）
    ↓ UI Thread 采集事件
    ↓ 通过 Handler 发送到 JS Thread
    ↓ V8 执行事件处理函数
    ↓ 可能修改状态 → 触发 VDOM diff
    ↓ 产出渲染指令（JSON）
    ↓ 发送到 IO Thread 解析
    ↓ 发送到 UI Thread 更新 View
```

---

## 六、同步 Bridge 的实现细节

### 为什么叫"同步"

```
异步 Bridge（旧版 RN）：
  JS 调用 Native → 放入消息队列 → Native 线程取出执行 → 回调放入 JS 队列 → JS 取出处理
  延迟：毫秒级（队列等待 + 线程切换 + JSON 序列化）

同步 Bridge（J2V8/JSI）：
  JS 调用 Native → V8 直接通过 JNI 调用 Java 方法 → 同线程返回
  延迟：微秒级（一次函数调用）
```

### 调用栈是连续的

```
JS Thread 调用栈：
  ┌─ JS: button.onClick()
  │  ┌─ JS: this.fetchData()
  │  │  ┌─ JS: system.fetch(url)        ← JS 调用注册的 Native 方法
  │  │  │  ┌─ JNI: JavaCallback.invoke() ← V8 通过 JNI 调用 Java
  │  │  │  │  ┌─ Java: HttpFeature.fetch() ← Java 方法执行
  │  │  │  │  │  → 如果是同步操作，直接返回结果
  │  │  │  │  │  → 如果是异步操作，提交到 IO Thread，返回 Promise
  │  │  │  │  └─ return result
  │  │  │  └─ JNI return
  │  │  └─ JS 拿到返回值，继续执行
  │  └─
  └─
```

### 异步 Feature 的处理

不是所有 Native 调用都能同步返回（比如网络请求、文件读写）。异步 Feature 的处理：

```java
// Java 侧
runtime.registerJavaMethod((receiver, args) -> {
    String url = args.getString(0);
    int callbackId = args.getInt(1);
    
    // 提交到 IO 线程池异步执行
    ioExecutor.execute(() -> {
        String result = httpClient.get(url);
        
        // 执行完毕，回到 JS 线程回调
        jsThreadHandler.post(() -> {
            V8Array callbackArgs = new V8Array(runtime).push(result);
            runtime.executeVoidScript("__callback(" + callbackId + ", " + result + ")");
            callbackArgs.release();
        });
    });
    
    return V8.getUndefined(); // 同步返回 undefined，结果通过回调给
}, "nativeFetch");
```

---

## 七、内存管理与生命周期

### 双 GC 问题

V8 有自己的 GC（Orinoco），Java 有自己的 GC（ART GC）。两者互不感知：

| 问题 | 场景 | 解决方案 |
|------|------|---------|
| Java 对象被 V8 引用但 Java GC 不知道 | Java 对象传给 JS 后，Java 侧没有引用了 | J2V8 内部持有 Java 引用（prevent GC） |
| V8 对象被 Java 引用但 V8 GC 不知道 | V8Object 传给 Java 后，JS 侧没有引用了 | 必须手动 release()，否则 V8 不会回收 |
| 循环引用 | Java 引用 V8Object，V8Object 里引用 Java 对象 | 弱引用 + release 规范 |

### release() 规范

```java
// 错误：忘记 release → 内存泄漏
V8Object obj = runtime.executeObjectScript("({})");
// ... 用完了但没 release

// 正确：try-finally 保证 release
V8Object obj = runtime.executeObjectScript("({})");
try {
    // 使用 obj
} finally {
    obj.release();
}
```

### 页面生命周期与 V8 Context

```
页面创建 → 创建 V8 Context → 加载 JS Bundle → 执行
页面销毁 → 释放所有 V8Object → 销毁 Context → 释放内存
```

多页面场景：每个页面一个 Context，共享同一个 Isolate。页面销毁时只销毁 Context，不销毁 Isolate。

---

## 八、性能考量

### V8 启动开销

| 阶段 | 耗时 | 优化手段 |
|------|------|---------|
| 加载 libv8.so | ~50ms | 预加载（App 启动时就加载） |
| 创建 Isolate | ~20ms | 复用（不要每个页面都创建） |
| 创建 Context | ~5ms | 轻量，可以每页面一个 |
| 编译 JS | ~100-500ms | Snapshot（预编译快照）/ Code Cache |
| 执行 JS | 取决于代码量 | 减少首屏 JS 量 |

### V8 Snapshot

V8 支持把编译后的字节码序列化成 Snapshot，下次启动直接反序列化，跳过编译阶段：

```
首次：JS 源码 → V8 编译 → 字节码 → 执行 → 同时序列化 Snapshot
后续：加载 Snapshot → 反序列化 → 直接执行（跳过编译）
```

类似前端的 Service Worker Cache：首次编译，后续从缓存加载。

### Bridge 调用频率优化

高频 Bridge 调用（比如滚动时每帧都要同步位置）会成为瓶颈：

| 策略 | 说明 |
|------|------|
| 批量传输 | 攒一批渲染指令一次传，不要每个 View 变更都跨一次 Bridge |
| 减少序列化 | 用 TypedArray / ArrayBuffer 传数据，避免 JSON |
| 异步化非关键调用 | 日志/埋点等不影响渲染的调用走异步 |
| 缓存 MethodID | JNI 的 FindClass/GetMethodID 很慢，缓存复用 |

---

## 九、和 RN JSI 的对比

| | J2V8（快应用框架） | JSI（RN 新架构） |
|---|---|---|
| 引擎 | V8 | Hermes（默认）/ V8 / JSC |
| 绑定方式 | Java ←→ JNI ←→ V8 | C++ ←→ JSI 接口 ←→ 引擎 |
| 引擎可替换 | 不可（绑定 V8） | 可（JSI 是抽象层） |
| 同步调用 | ✅ | ✅ |
| 类型安全 | 运行时检查 | 编译时（C++ 类型） |
| 内存管理 | 手动 release() | shared_ptr / weak_ptr |
| 性能 | 有 JNI 开销（Java→C++→V8） | 纯 C++ 调用，无 JNI 开销 |

### JSI 比 J2V8 好在哪

JSI 是纯 C++ 层的抽象，JS 引擎和 Native 代码都在 C++ 层直接交互，不需要经过 JNI（Java↔C++ 的桥）。少了一层桥 = 少了一层开销。

但快应用框架选 J2V8 的原因：框架的 Feature 实现（相机/网络/存储等）都是 Java 写的，用 J2V8 可以直接从 JS 调到 Java，不需要再包一层 C++。如果用 JSI，每个 Feature 都要写 C++ wrapper → JNI → Java，多了一层。

**trade-off**：J2V8 多了 JNI 开销，但省了 C++ wrapper 的开发成本。对于 Feature 数量多（几十个）的框架，开发效率优先。
