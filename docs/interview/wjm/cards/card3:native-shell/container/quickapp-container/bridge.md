# 快应用 Bridge 设计（J2V8）

## 目录

- [本质先行](#本质先行)
- [JS call Native](#js-call-native)
  - [Android](#android)
  - [iOS（待补充）](#ios待补充先不看)
  - [JS](#js)
- [Native call JS(event)](#native-call-jsevent)
  - [Android](#android-1)
  - [iOS（待补充）](#ios待补充先不看-1)
  - [JS](#js-1)
- [QA](#qa)
  - [Q1: J2V8 + V8 如何使用？引入、安装、核心能力](#q1)

---

## 本质先行

类 RN 框架：直接持有 JS 引擎（V8），向 JS 注入 external function，零序列化同步调用。

---

## JS call Native

> 快应用因为直接持有引擎，技术上可以逐个注入每个 Native API 为 external function。实际采用混合模式：
- 协议分发模式(webview): 顶层统一入口 `callNative`（处理异步回调 + 协议分发）
- RN模式: 直接注入external obj/function:
    - 模块对象逐个注入到 global（`system.device` / `system.router`），方便 JS 侧直接调

### Android

核心三步：Java 直接持有 V8 引擎，直接注入函数，JS 调用时直接执行 Java 代码。

> V8 类来自 J2V8 库，详见 → [Q1: J2V8 如何使用](#q1)

```java
// ─── Android (Java) ───

// 1. 创建 V8 运行时（= 一个 JS 引擎实例）
V8 v8 = V8.createV8Runtime();

// 2. 注册 Java 方法到 JS 全局（= 注入 external function）
v8.registerJavaMethod((receiver, args) -> {
    // args = JS 传过来的参数（V8Array 类型，直接取值，零序列化）
    String module = args.getString(0);
    String method = args.getString(1);
    // 分发给对应 Native 模块处理...
    return result;
}, "callNative");
// 效果：JS 全局出现 callNative() 函数

// 3. 执行 JS Bundle
v8.executeScript(bundleCode);
// JS 代码中可以直接调 callNative("device", "getToken", ...)
```

> 和 H5 WebView 的区别：没有中间人。Java 直接持有 V8 实例，直接往引擎里注册函数，JS 调用时直接执行 Java 代码，零序列化、可同步返回。
>
> 和 RN JSI 本质相同：都是直接持有引擎 + 注入 external function。区别只是快应用走 Java→J2V8→V8，RN 走 C++→JSI→Hermes。

### iOS（待补充，先不看）

### JS

```javascript
// JS 侧直接调用 Native 注入的external function（同步返回）
const token = callNative('device', 'getToken');
// 或直接调模块对象
const info = system.device.getInfo();
```

---

## Native call JS(event)

### Android

```java
// ─── Android (Java) ───
// Java 直接执行 JS 代码（因为持有引擎实例）
v8.executeVoidScript("onNetworkChange({type:'wifi'})");
```

### iOS（待补充，先不看）

### JS

```javascript
// JS 侧注册事件监听
function onNetworkChange(data) {
  console.log('网络变化:', data.type);
}
```

### JS

---

## QA

<a id="q1"></a>
### Q1: J2V8 + V8 如何使用？引入、安装、核心能力

1. 本质就是: j2v8 就是 对于V8 的 JNI 封装吧

**引入**：
```groovy
// build.gradle
implementation 'com.eclipsesource.j2v8:j2v8:6.2.1@aar'
```

**最小例子**：

```java
import com.eclipsesource.v8.V8;  // 来自 J2V8 库（V8 引擎的 JNI 封装）

V8 v8 = V8.createV8Runtime();
v8.registerJavaMethod((receiver, args) -> "hello " + args.getString(0), "greet");
String result = v8.executeStringScript("greet('world')");  // → "hello world"
v8.release();
```

**核心能力**：

| 能力 | API |
|------|-----|
| 创建引擎 | `V8.createV8Runtime()` |
| 执行 JS | `v8.executeScript(code)` |
| 注入函数 | `v8.registerJavaMethod(callback, name)` |
| 注入对象 | `new V8Object(v8)` + `registerJavaMethod` |
| 释放 | `v8.release()` |

