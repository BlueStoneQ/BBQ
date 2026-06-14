# JS 引擎能力全景 — V8/Hermes 能帮你做什么

> 从大前端架构师视角看：嵌入一个 JS 引擎到 Android/iOS 里，你能获得哪些能力？这些能力是怎么实现"JS 和 Native 沟通"的？

---

## 目录

- [1. JS 引擎的本质角色](#1-js-引擎的本质角色)
- [2. 核心能力清单](#2-核心能力清单)
- [3. 能力一：执行 JS 代码](#3-能力一执行-js-代码)
- [4. 能力二：注册 Native 函数给 JS 调用（External Function）](#4-能力二注册-native-函数给-js-调用)
- [5. 能力三：从 Native 调用 JS 函数](#5-能力三从-native-调用-js-函数)
- [6. 能力四：在 Native 侧操作 JS 对象](#6-能力四在-native-侧操作-js-对象)
- [7. 能力五：注册 JS 全局对象/变量](#7-能力五注册-js-全局对象变量)
- [8. 能力六：GC 与内存管理协作](#8-能力六gc-与内存管理协作)
- [9. V8 vs Hermes 能力对比](#9-v8-vs-hermes-能力对比)
- [10. 这些能力怎么组合出一个跨端框架](#10-这些能力怎么组合出一个跨端框架)

---

## 1. JS 引擎的本质角色

JS 引擎不是一个"工具"，它是你嵌入到 App 里的一个**独立的计算世界**：

```
┌─────────────────────────────────────────────┐
│              你的 Android/iOS App             │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │          JS 引擎（V8 / Hermes）         │  │
│  │                                        │  │
│  │  • 有自己的堆内存（Heap）               │  │
│  │  • 有自己的 GC                         │  │
│  │  • 可以执行任意 JS 代码                 │  │
│  │  • 默认和外界完全隔离（沙箱）           │  │
│  │                                        │  │
│  │  唯一的"出口" = 宿主注册的 External Function │
│  └────────────────────────────────────────┘  │
│                                              │
│  宿主通过引擎 API "打洞"：                    │
│  • 注册函数给 JS 调用                        │
│  • 调用 JS 里的函数                          │
│  • 读写 JS 对象的属性                        │
│  • 注入全局变量                              │
└─────────────────────────────────────────────┘
```

**一句话**：JS 引擎 = 一个可编程的沙箱。你通过引擎 API 在沙箱墙上"打洞"，这些洞就是 Native 和 JS 沟通的通道。

---

## 2. 核心能力清单

| # | 能力 | 一句话 | 跨端框架用来做什么 |
|---|------|--------|------------------|
| 1 | 执行 JS 代码 | 传入字符串或字节码，引擎执行 | 加载执行开发者的 JS Bundle |
| 2 | 注册 Native 函数给 JS 调用（External Function） | Native 函数注册为 JS 的 External Function | `callNative`、`readResource` 等 Bridge 入口 |
| 3 | 从 Native 调 JS 函数 | Native 主动触发 JS 代码执行 | 事件回传（触摸、回调）、生命周期通知 |
| 4 | 操作 JS 对象 | Native 读写 JS 对象的属性 | 读取 JS 侧状态、注入配置 |
| 5 | 注册全局变量/对象 | 在 JS 的 global 上挂东西 | console、timer、环境变量、JsBridge 对象 |
| 6 | GC 协作 | Native 持有 JS 对象引用时保证不被 GC | 回调函数的生命周期管理 |

---

## 3. 能力一：执行 JS 代码

**V8 方式**：
```cpp
// C++ 侧
v8::Local<v8::String> source = v8::String::NewFromUtf8(isolate, jsCode);
v8::Local<v8::Script> script = v8::Script::Compile(context, source);
v8::Local<v8::Value> result = script->Run(context);
```

**J2V8 方式（快应用实际用的）**：
```java
// Java 侧 — 执行一段 JS 代码字符串
v8Runtime.executeVoidScript(jsCode, "infras.js", bytecodeCache);
// 或者执行后拿返回值
String result = v8Runtime.executeStringScript("1 + 1");
```

**Hermes 方式**：
```cpp
// C++ 侧
auto buffer = hermes::compileJS(runtime, jsCode);  // 编译为字节码
runtime.evaluateJavaScript(buffer, "app.js");       // 执行
```

**框架用来**：加载 infras.js（框架自身）、加载 app.js（应用代码）、加载 page.js（页面代码）。

---

## 4. 能力二：注册 Native 函数给 JS 调用

> 这就是 External Function 的注册入口。

**V8 方式**：
```cpp
// C++ 侧：把 C++ 函数暴露给 JS
void ReadResource(const v8::FunctionCallbackInfo<v8::Value>& args) {
    v8::String::Utf8Value path(args[0]);
    std::string content = readFileFromRpk(*path);
    args.GetReturnValue().Set(v8::String::NewFromUtf8(isolate, content.c_str()));
}

// 注册到 global
global->Set(v8::String::NewFromUtf8(isolate, "readResource"),
            v8::FunctionTemplate::New(isolate, ReadResource));
```

**J2V8 方式（快应用实际用的）**：
```java
// Java 侧：把 Java 方法暴露给 JS
v8Runtime.registerJavaMethod(new JavaCallback() {
    @Override
    public Object invoke(V8Object receiver, V8Array params) {
        String path = params.getString(0);
        return readFileFromRpk(path);  // 返回值直接变成 JS 的返回值
    }
}, "readResource");  // JS 里叫 global.readResource()
```

**Hermes/JSI 方式**：
```cpp
// C++ 侧：创建 HostFunction
auto readResource = jsi::Function::createFromHostFunction(
    runtime,
    jsi::PropNameID::forAscii(runtime, "readResource"),
    1,  // 参数个数
    [](jsi::Runtime& rt, const jsi::Value& thisVal, const jsi::Value* args, size_t count) {
        std::string path = args[0].getString(rt).utf8(rt);
        std::string content = readFileFromRpk(path);
        return jsi::String::createFromUtf8(rt, content);
    }
);
runtime.global().setProperty(runtime, "readResource", readResource);
```

**框架用来**：注册 callNative、readResource、JsBridge.invoke 等所有"JS → Native"的入口函数。

---

## 5. 能力三：从 Native 调用 JS 函数

**J2V8 方式（快应用实际用的）**：
```java
// Java 侧：调用 JS global 上的函数
V8Array args = new V8Array(v8Runtime);
args.push(pageId);
args.push(eventData);  // 可以 push 各种类型

v8Runtime.executeVoidFunction("processCallbacks", args);  // 调用 global.processCallbacks(args)
args.release();
```

**Hermes/JSI 方式**：
```cpp
// C++ 侧：直接调用 JS 函数
jsi::Function processCallbacks = runtime.global()
    .getPropertyAsFunction(runtime, "processCallbacks");
processCallbacks.call(runtime, pageId, eventData);  // 同步调用
```

**框架用来**：
- 事件回传（`processCallbacks` — 把触摸事件传给 JS）
- 生命周期通知（`createApplication`、`createPage`、`changeVisiblePage`）
- Feature 回调（`execInvokeCallback`）

---

## 6. 能力四：在 Native 侧操作 JS 对象

**J2V8 方式**：
```java
// 创建 JS 对象并设置属性
V8Object env = new V8Object(v8Runtime);
env.add("platform", "android");
env.add("screenWidth", 1080);
env.add("density", 3.0);
v8Runtime.add("Env", env);  // global.Env = {platform:"android", ...}
env.release();
```

**Hermes/JSI 方式**：
```cpp
// 创建 JS 对象并设置属性
jsi::Object env(runtime);
env.setProperty(runtime, "platform", "android");
env.setProperty(runtime, "screenWidth", 1080);
runtime.global().setProperty(runtime, "Env", env);
```

**框架用来**：注入环境变量（`global.Env`）、注册 manifest 数据、传递页面参数。

---

## 7. 能力五：注册 JS 全局对象/变量

除了函数，还可以注册整个对象（带多个方法）：

**J2V8 方式（快应用的 JsBridge 对象）**：
```java
// 注册一个带多个方法的对象
V8Object jsBridge = new V8Object(v8Runtime);
jsBridge.registerJavaMethod(invokeCallback, "invoke");
jsBridge.registerJavaMethod(subscribeCallback, "subscribe");
v8Runtime.add("JsBridge", jsBridge);  // global.JsBridge.invoke() / .subscribe()
jsBridge.release();
```

**框架用来**：
- `global.JsBridge` — Feature 调用的入口对象
- `global.Env` — 环境变量
- `global.profiler` — 性能追踪
- `global.console` — 日志输出（替换默认实现，重定向到 Android Logcat）

---

## 8. 能力六：GC 与内存管理协作

**问题**：Native 持有 JS 对象的引用时，如果 GC 把这个对象回收了怎么办？

**V8 的解法 — Persistent Handle**：
```cpp
// 短期引用（Local Handle）— 当前函数内有效，函数结束自动释放
v8::Local<v8::Object> obj = ...;

// 长期引用（Persistent Handle）— 手动管理，防止 GC 回收
v8::Persistent<v8::Object> persistent(isolate, obj);
// 用完后手动释放
persistent.Reset();
```

**J2V8 的解法**：
```java
// V8Object 是 J2V8 的 Java 包装，内部持有 V8 Persistent Handle
V8Object jsObj = v8Runtime.executeObjectScript("({name: 'test'})");
// 只要 Java 侧持有这个 V8Object 引用 → V8 不会 GC 对应的 JS 对象
// 用完必须 release()，否则 V8 侧内存泄漏
jsObj.release();
```

**Hermes/JSI 的解法**：
```cpp
// jsi::Value 是栈上的短期引用
jsi::Value val = runtime.global().getProperty(runtime, "someObj");

// 如果需要长期持有 → 用 shared_ptr 包裹
auto persistent = std::make_shared<jsi::Object>(val.getObject(runtime));
// persistent 存活期间，JS 对象不会被 GC
// persistent 销毁时（引用计数归零），JS 对象恢复可回收状态
```

**框架用来**：保证回调函数在异步执行完之前不被 GC。快应用用的是 callback ID 映射方案（不直接持有 JS 函数引用），间接规避了这个问题。

---

## 8.5 JNI vs JSI：参数传递时到底拷不拷贝？

**JNI（快应用 J2V8 方案）— 传参数时**：

| 数据类型 | 需要拷贝吗 | 原因 |
|---------|-----------|------|
| int / double / boolean | 值拷贝（极快，几字节） | 基本类型就是按值传，塞进寄存器 |
| String | **必须拷贝** | Java String 在 Java Heap，V8 String 在 V8 Heap，两个 GC 域各自管理 |
| Object / Array | **必须序列化 + 拷贝** | 对象内存布局两侧完全不同，没法共享 |

**JSI（Hermes 方案）— 传参数时**：

| 数据类型 | 需要拷贝吗 | 原因 |
|---------|-----------|------|
| int / double / boolean | 值拷贝（同样极快） | 基本类型在任何方案里都是按值传 |
| String | 短的值拷贝，长的可共享 buffer | C++ 和引擎同地址空间 |
| Object / Array | **不需要拷贝** | C++ 通过 Handle 直接操作 JS Heap 里的对象 |

**核心差异**：

```
JNI:  C++ 说"把那个对象的数据给我复制一份"  → 拷贝 → C++ 拿到副本 → 再传给 Java
JSI:  C++ 说"给我那个对象的 Handle"         → 拿到 Handle → 直接在原地读写
```

JSI 对基本类型（number/bool）还是有值拷贝——但这个开销可忽略（就几个字节）。真正省掉的是**对象和字符串的序列化 + 大块内存拷贝**。

**JSI 的 Handle 怎么防止 GC 回收？**

C++ 不是拿裸指针，而是拿引擎提供的 Handle（受控引用）：

```
C++ 持有 jsi::Value（Handle）
       │
       │  引擎把这个 Handle 登记为 "GC Root"
       ▼
GC 扫描时：从所有 Root 出发遍历 → 发现对象还被 Handle 引用 → 不回收
GC 移动对象时：引擎更新 Handle 里的地址 → C++ 无感知
```

**两种 Handle 生命周期**：

| 类型 | 生命周期 | 用法 |
|------|---------|------|
| 局部 Handle（栈上的 `jsi::Value`） | 函数执行期间，返回后自动释放 | 绝大多数场景（安全） |
| 持久 Handle（`shared_ptr` 包裹） | 手动控制，C++ 释放时对象才可被 GC | 需要跨函数长期持有 JS 对象时（有泄漏风险） |

**快应用为什么没有 Handle 泄漏问题**：用的是 callback ID 方案——不直接持有 JS 函数引用，而是存一个数字 ID，JS 侧用 Map 保存引用。`delete callbacks[id]` 就释放了，两侧 GC 各管各的。

---

## 9. V8 vs Hermes 能力对比

| 能力 | V8 | Hermes | 差异 |
|------|-----|--------|------|
| 执行 JS 代码 | ✅ | ✅ | Hermes 支持预编译字节码（.hbc），启动更快 |
| 注册 Native 函数 | ✅ (FunctionTemplate) | ✅ (HostFunction) | 接口不同，能力相同 |
| 调 JS 函数 | ✅ (Function::Call) | ✅ (Function.call) | 相同 |
| 操作 JS 对象 | ✅ (Object::Set/Get) | ✅ (setProperty/getProperty) | 相同 |
| JIT 编译 | ✅（TurboFan，峰值性能极高） | ❌（纯解释/AOT，无 JIT） | V8 适合长时间运行的计算密集场景 |
| 包体 | ~8MB | ~3MB | Hermes 更小 |
| 启动速度 | ~100ms | ~50ms（字节码模式更快） | Hermes 胜 |
| 内存占用 | 较高 | 较低 | Hermes 优化了移动端内存 |
| 调试协议 | Chrome DevTools (Inspector) | Hermes CDP / Flipper | V8 的调试体验更成熟 |
| iOS 支持 | 需要自行编译（Apple 不允许 JIT） | ✅ 原生支持 interpreter | Hermes 在 iOS 无障碍 |
| JSI 支持 | 需要适配层 | ✅ 原生支持 | Hermes 天然集成 JSI |

**选择建议**：
- Android only + 需要 JIT 性能 → V8
- 跨平台 (Android + iOS) → Hermes（iOS 不允许 JIT，V8 在 iOS 只能解释模式）
- 极致轻量 → QuickJS（包体 <1MB，但无 JIT、性能弱）

---

## 10. 这些能力怎么组合出一个跨端框架

用上面 6 个能力，你可以搭出一个完整的动态渲染框架：

```
启动阶段：
  ① 执行 JS 代码        → 加载框架 + 加载开发者代码
  ⑤ 注册全局变量         → 注入环境信息（屏幕、设备、平台）
  ② 注册 Native 函数    → 建立 Bridge（callNative、readResource）
  ④ 操作 JS 对象        → 注入 manifest 配置

运行阶段：
  ③ 从 Native 调 JS     → 传递事件（触摸、生命周期、回调）
  ② 注册的 Native 函数被 JS 调用 → 执行渲染指令、Feature 能力
  ⑥ GC 协作            → 保证异步回调函数不被提前回收

整个跨端框架 = 这 6 个能力的排列组合
```

**快应用的对应关系**：

| 阶段 | 用了哪些能力 | 具体调用 |
|------|------------|---------|
| 加载 infras.js | 能力1 | `executeVoidScript(infrasCode)` |
| 注册 Bridge | 能力2 | `registerJavaMethod(callback, "callNative")` |
| 注入环境变量 | 能力4+5 | `v8Runtime.add("Env", envObj)` |
| 创建应用 | 能力3 | `executeVoidFunction("createApplication", args)` |
| 渲染指令传递 | 能力2 被调 | JS 调 `global.callNative(actions)` |
| 事件回传 | 能力3 | `executeVoidFunction("processCallbacks", events)` |
| Feature 回调 | 能力3 | `executeVoidFunction("execInvokeCallback", result)` |
