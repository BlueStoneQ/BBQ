# 三层通信的底层真相 — 内存模型、函数调用、参数传递

> 本文回答三个根本问题：函数在内存里是什么？调用是怎么发生的？参数和结果怎么传？聚焦快应用三层（Java / C++ / V8）各自的实现。

> 关键词: **External Function**

---

## 目录

- [1. 函数在内存里是什么](#1-函数在内存里是什么)
  - [1.3 V8 函数的两种"函数体"— External Function 是跨端的关键](#13-v8-函数的两种函数体-external-function-是跨端的关键)
- [2. 函数调用是怎么回事](#2-函数调用是怎么回事)
  - [2.2 快应用三层的调用链](#22-快应用三层的调用链)
- [3. 参数传递的几种方式](#3-参数传递的几种方式)
- [4. 结果传递的几种方式](#4-结果传递的几种方式)
- [5. 内存管理模型](#5-内存管理模型)
- [6. 三层通信的内存视角](#6-三层通信的内存视角)

---

## 1. 函数在内存里是什么

### 1.1 三层各自的"函数"本质

| 层 | 函数是什么 | 存在哪 | 调用靠什么 |
|----|-----------|--------|-----------|
| **C++ (V8 引擎)** | 一段机器指令的起始地址 | 代码段（.text，只读） | 函数指针（64位地址） |
| **Java (Feature/Widget)** | Method 对象（字节码 + 元数据） | 方法区（Metaspace） | 虚方法表（vtable）查找 / invokeInterface |
| **JS (V8 Heap)** | JSFunction 对象（包含字节码/JIT 代码 + 闭包上下文） | V8 Heap（堆） | V8 内部 dispatch（隐藏类 + inline cache） |

### 1.2 详细拆解

**C++ 层的函数**：
```
内存布局：
┌─────────────────────────────────────┐
│ .text 段（只读，进程启动时加载）       │
│                                      │
│ 0x7f001000: push rbp                │ ← 函数 callNative 的第一条指令
│ 0x7f001001: mov rbp, rsp            │
│ 0x7f001004: sub rsp, 0x20           │
│ ...                                  │
│ 0x7f001080: ret                     │ ← 函数结束
│                                      │
└─────────────────────────────────────┘

函数指针 = 0x7f001000（就是一个地址数字）
调用 = CPU 的 CALL 指令跳转到这个地址执行
```

**Java 层的函数**：
```
内存布局：
┌─────────────────────────────────────────┐
│ Metaspace（方法区）                       │
│                                          │
│ JsBridge.class:                          │
│   vtable[0] → register() 的 Method 对象  │
│   vtable[1] → readResource() 的 Method   │
│                                          │
│ Method 对象:                             │
│   - bytecode: [字节码指令数组]            │
│   - accessFlags: public                  │
│   - parameterTypes: [V8Object, V8Array]  │
│   - compiledCode: 0x7f002000 (JIT 编译后) │
│                                          │
└─────────────────────────────────────────┘

调用 = JVM 查 vtable → 找到 Method → 解释执行字节码 或 跳转到 JIT 编译后的机器码
```

**JS 层的函数（V8 Heap 里）**：
```
内存布局：
┌─────────────────────────────────────────┐
│ V8 Heap                                  │
│                                          │
│ JSFunction 对象 (地址: 0x1234abcd):       │
│   - map: HiddenClass 指针（描述对象形状） │
│   - code: SharedFunctionInfo 指针         │
│       → bytecode: [V8 字节码]            │
│       → 或 JIT 机器码地址                │
│   - context: 闭包上下文指针              │
│       → 捕获的外部变量（$app_define$ 等） │
│   - prototype: 原型链指针                │
│                                          │
└─────────────────────────────────────────┘

调用 = V8 内部：
  1. 检查 JSFunction 对象的 code 字段
  2. 如果是字节码 → 进入 Ignition 解释器执行
  3. 如果是 JIT 机器码 → 直接 CALL 到那个地址
  4. 闭包变量通过 context 指针链查找
```

### 1.3 V8 函数的两种"函数体"— External Function 是跨端的关键

> **核心认知转换**：做跨端框架，不能从 JS 视角看 JS，要从 V8（引擎）视角看 JS。JS 开发者看到的是"函数调用"，V8 看到的是"这个 JSFunction 对象的 code 字段指向哪里"。

从 JS 代码视角看，所有函数调用方式完全一样：

```javascript
handleClick()       // 开发者写的函数
global.callNative() // 框架注册的函数
console.log()       // 引擎内置函数
// 三者对 JS 来说没有任何区别，typeof 都是 "function"
```

但从 V8 引擎视角看，这些函数本质完全不同：

| 类型 | V8 内部标识 | code 字段是什么 | 执行路径 | 例子 |
|------|-----------|---------------|---------|------|
| **JS Function** | `JSFunction` + bytecode | V8 字节码 / JIT 机器码（从 JS 源码编译来的） | Ignition 解释器 或 TurboFan JIT | 开发者的 `handleClick()` |
| **External Function** | `JSFunction` + C++ callback | 一个 C++ 函数指针（通过 V8 API 注册进来的） | 直接 CALL 到 C++ 地址，不走解释器 | `callNative`、`readResource`、`console.log` |

**当 V8 执行 `global.callNative(...)` 时**：

1. 查 global 对象的属性 "callNative" → 拿到一个 JSFunction 对象
2. 检查这个 JSFunction 的 code 字段 → 发现不是字节码，而是一个 **C++ 函数指针**
3. 不走 Ignition 解释器，直接 CALL 到那个 C++ 函数地址
4. C++ 函数拿到 `V8Array parameters` 参数，执行 Java 逻辑

对 JS 来说完全透明——`typeof callNative === 'function'`，`callNative.toString()` 会返回 `"function callNative() { [native code] }"`。就像浏览器里的 `console.log`、`setTimeout`，它们也是 "native code"——底层是 C++ 实现的，但对 JS 暴露为普通函数。

**External Function 是跨端框架的全部秘密**：

```
没有 External Function → JS 无法调用 V8 外部的任何东西
                        → 就是一个纯计算沙箱，和真实世界隔绝

有了 External Function → JS 调 global.callNative() = 调 C++ 代码 = 调 Native 能力
                        → 浏览器的 DOM API、Node.js 的 fs、快应用的 Bridge
                           全部都是通过 External Function 实现的
```

换句话说：
- `document.createElement()` — 浏览器注册的 External Function
- `require('fs').readFile()` — Node.js 注册的 External Function
- `global.callNative()` — 快应用注册的 External Function

**本质相同，只是宿主不同**。

```
┌─────────────────────────────────────────────────────────────┐
│ JSFunction 对象                                              │
│                                                              │
│ code 字段的两种形态:                                          │
│                                                              │
│ 形态 A: JS 字节码（从 JS 源码编译来的）                       │
│   → V8 Ignition 解释器逐条执行                               │
│   → 热函数会被 TurboFan JIT 编译为机器码                     │
│   例: 开发者写的 handleClick()                               │
│                                                              │
│ 形态 B: C++ 函数指针 — 即 External Function                  │
│   → V8 不走解释器，直接 CALL 到 C++ 地址                     │
│   → toString() 返回 "function callNative() { [native code] }"│
│   → 这就是跨端的入口：JS 世界通往 Native 世界的唯一出口      │
│   例: callNative, readResource, processCallbacks             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**注册过程**（快应用启动时做一次）：

```java
// Java 侧: JsBridge.java
v8.registerJavaMethod(new JavaVoidCallback() {
    @Override
    public void invoke(V8Object receiver, V8Array parameters) {
        // 这个 Java lambda 会被包装为 C++ 函数指针
        mNative.callNative(pageId, argsString);
    }
}, "callNative");  // ← 注册到 global 上，名字叫 "callNative"
```

V8 内部做的事：
1. 在 global 对象上创建一个属性 "callNative"
2. 属性值是一个 JSFunction 对象
3. 这个 JSFunction 的 code **不是字节码**，而是一个 C++ 回调指针
4. JS 调用时，V8 检查 code 类型 → 发现是 native callback → 直接跳转执行

**从 V8 视角理解快应用的全部 External Function**：

| External Function 名 | 注册者 | 功能 | 调用方向 |
|--------------------|--------|------|---------|
| `readResource` | JsBridge.java | 读取 rpk 内文件 | JS → Native |
| `callNative` | JsBridge.java | 发送渲染指令（DOM Action） | JS → Native |
| `getPageElementViewId` | JsBridge.java | 获取 Native View ID | JS → Native |
| `JsBridge.invoke` | ExtensionManager.java | 调用 Feature（设备/网络/存储） | JS → Native |
| `compileAndRunScript` | V8 引擎自带 | 编译并执行 JS 代码字符串 | JS → V8 内部 |

这些就是 JS 通往外部世界的**全部出口**。快应用 JS Framework 的所有能力（渲染、Feature 调用、资源加载）最终都通过这几个 External Function 实现。

**对 JS 完全透明**——开发者（和框架 JS 代码）不需要知道 `callNative` 是 C++ 实现的，当普通函数用就行。这就是为什么编译产物里直接写 `$app_define$(...)` 就能跑——因为在执行之前，框架已经把这些 C++ 回调注册好了。

### 1.4 一句话

> **函数的本体 = 一段指令(底层都是函数这段内存的起始地址) + 执行上下文。**
>
>**调用 = 找到指令地址 + 跳转执行。** 三层的区别只是"找地址"的方式不同（C++ 直接指针 / Java 查 vtable / V8 查 HiddenClass + inline cache）。

---

## 2. 函数调用是怎么回事

### 2.1 最底层：CPU 做了什么

不管是什么语言，最终 CPU 执行的动作是相同的：

```
1. 把参数放到约定位置（寄存器 或 栈）
2. 把返回地址压栈（CALL 指令自动做）
3. 跳转到目标函数的第一条指令（修改 PC 寄存器）
4. 函数执行完，把返回值放到约定位置（通常是 rax 寄存器）
5. RET 指令：弹出返回地址，跳回调用者
```

### 2.2 快应用三层的调用链

```
JS 调 global.callNative(pageId, json):

  V8 内部:
    1. 查找 global 属性 "callNative" → 拿到 JSFunction 对象
       → 检查 code 字段：不是 JS 字节码，而是 C++ 回调指针
       → 类似浏览器的 console.log —— JS 看是普通函数，底层是 C++ 实现
    2. 准备 C++ 调用约定的参数（V8Array 对象）
    3. 直接 CALL 到 C++ 函数地址（不走 V8 解释器）

  C++ 层 (J2V8 绑定):
    4. JavaVoidCallback.invoke() 被调用
    5. 通过 JNI 调用 Java:
       - 查找 Java Method ID（JNI 的 GetMethodID）
       - CallVoidMethod(javaObject, methodId, args)
       - 这会触发 JVM 的方法调度

  Java 层:
    6. JVM 查 vtable / 或 JIT 直接跳转
    7. mNative.callNative(pageId, argsString) 执行
```

### 2.3 函数指针在这里的角色

| 层 | 是否用函数指针 | 具体形式 |
|----|-------------|---------|
| C++ | 是 | `JavaVoidCallback*` 指向回调函数地址 |
| JNI | 是 | `jmethodID` 本质是方法元数据指针 |
| Java | 间接 | vtable 索引 → 查到 Method → 再拿到代码地址 |
| V8 | 间接 | JSFunction.code 字段 → SharedFunctionInfo → 字节码/JIT 地址 |

**直接指针**（C++）调用最快——一次 CALL 指令。
**间接查找**（Java vtable / V8 dispatch）有额外开销，但支持多态和动态分发。

---

## 3. 参数传递的几种方式

### 3.1 参数传递的三种模式

| 模式 | 本质 | 开销 | 快应用用在哪 | JSI 用在哪 |
|------|------|------|------------|-----------|
| **值拷贝** | 直接把数据复制一份给对方 | 小数据快，大数据慢 | int/boolean 等基本类型通过 JNI 传递 | 基本类型（number/boolean）直接传 |
| **指针/引用（共享内存）** | 传地址，双方操作同一块内存 | 极快（只传 4/8 字节） | Java 对象之间传引用；C++ 内部传 V8Array* | **JSI 的核心**：Handle 共享 JS Heap 对象 |
| **序列化拷贝** | 转字节流 → 传 → 反序列化重建 | 最慢（CPU + 内存双重开销） | **快应用跨层的主要方式**：JSON | 几乎不用 |

```
                 开销从低到高
                 ─────────────────→

值拷贝（基本类型）  <  指针共享（同域内）  <  序列化拷贝（跨域）
   int/double            Handle/引用            JSON/Protobuf
   4-8字节               4-8字节指针            N字节数据×2
   ↑                     ↑                      ↑
   JSI 基本类型           JSI 对象              快应用所有跨层通信
   快应用基本类型         Java 内部 / C++ 内部
```

**关键结论**：
- **同一个 GC 域内** → 用指针/引用（零拷贝，Java 对象之间、V8 对象之间）
- **跨 GC 域（JS ↔ Java）** → 只能序列化拷贝（快应用的 JSON 方案）
- 快应用的性能瓶颈就在序列化：每次跨层都要 stringify + parse

### 3.2 快应用跨层参数传递的真实路径（源码级）

以渲染指令（JS → Native）为例，展示参数从 JS 到 Java 的完整数据变换：

**JS 侧（发送前）**：

```javascript
// 渲染消息汇总器 — 积攒满阈值后发送
class MessageStreamer {
  flush(pageId, actionList) {
    // actionList 是 JS 对象数组，如:
    // [{module:"dom", method:"addElement", args:[parentRef, nodeJSON, index]}]

    // ★ 关键步骤：JS 侧做 JSON 序列化
    global.sendRenderActions(pageId, JSON.stringify(actionList))
    //                                 ↑ 这里就是序列化发生的地方
  }
}
```

**Native 侧（接收）**：

```java
// Bridge 注册 — Android 启动时执行一次
v8Engine.registerJavaMethod(new JavaVoidCallback() {
    @Override
    public void invoke(V8Object receiver, V8Array params) {
        // ★ params.getString(1) — J2V8 从 V8 Heap 拷贝字符串到 Java Heap
        int pageId = Integer.parseInt(params.get(0).toString());
        String actionsJsonString = params.getString(1);  // ← 拿到的已经是 JSON 字符串

        // ★ Java 侧反序列化
        nativeRenderer.dispatchActions(pageId, actionsJsonString);
        // 内部: new JSONArray(actionsJsonString) → 遍历分发给各 Widget
    }
}, "sendRenderActions");
```

**完整链路**：

```
JS 对象数组 [{method:"addElement",...}, ...]     ← V8 Heap 里的 JS 对象
     │
     │ ① JSON.stringify()                        ← JS 侧序列化（V8 内部执行）
     ▼
V8 String "[{\"method\":\"addElement\",...}]"    ← V8 Heap 里的字符串
     │
     │ ② J2V8: params.getString(1)              ← V8 Heap → Java Heap（内存拷贝）
     ▼
Java String "[{\"method\":\"addElement\",...}]"  ← Java Heap 里的字符串
     │
     │ ③ new JSONArray(string)                   ← Java 侧反序列化
     ▼
Java JSONArray [{method:"addElement",...}]        ← Java Heap 里可操作的对象
```

**为什么不用 J2V8 直接逐字段读 V8 对象？**

J2V8 确实支持 `params.getObject(1).getString("method")` 这种逐字段读取，理论上可以跳过 JSON。但快应用选了 JSON 方案，原因是：

| 方案 | 逐字段读（J2V8 API） | 一次性 JSON |
|------|-------------------|------------|
| 50 条 Action | 50 × N 次 JNI 调用（每读一个字段一次 JNI） | 1 次 stringify + 1 次 JNI + 1 次 parse |
| JNI 调用次数 | 几百次 | 1 次 |
| 总耗时 | JNI 调用次数 × 单次开销 = 慢 | stringify 较快 + 单次 JNI = 快 |

**结论：JSON 一次性序列化比逐字段跨 JNI 读取更快**（因为 JNI 每次调用本身有固定开销，调用次数少比单次数据量小更重要）。

### 3.3 快应用三层各用了什么

**C++ ↔ V8（同一层，V8 引擎内部）**：
```
方式：堆指针
V8Array* parameters → C++ 拿到的是 V8 堆里对象的 Handle
读参数：parameters->GetString(0) → 返回的是 V8 内部字符串的 C++ 表示
→ 零拷贝（因为 C++ 和 V8 是同进程同地址空间）
```

**C++ ↔ Java（通过 JNI）**：
```
方式：JNI 类型转换 + 拷贝
C++ 拿到 V8 字符串 → 调用 v8::String::Utf8Value 取出 char*（拷贝一次：V8 Heap → 栈/Native Heap）
→ JNI NewStringUTF(char*) → 创建 Java String（拷贝一次：Native Heap → Java Heap）
→ 总共 2 次拷贝
```

**Java 内部（Feature 方法之间）**：
```
方式：引用传递（Java 对象都是堆上的，变量存的是引用/指针）
JSONObject params → 传的是 params 的引用（4/8 字节指针）
→ 零拷贝（同一个 Java Heap 内）
```

### 3.3 总结

```
同一个内存管理域内 → 传指针/引用（零拷贝）
跨 GC 域 → 必须序列化 + 拷贝（因为指针在对面无意义）
```

---

## 4. 结果传递的几种方式

| 方式 | 原理 | 快应用用在哪 |
|------|------|------------|
| **寄存器返回** | 结果放 rax，CALL 完直接取 | C++ 函数的 return value |
| **同步 return** | 函数直接返回值 | 同步 Feature（如 router.getState()） |
| **回调 ID** | 存函数到表里，传 ID，对面拿 ID 回调 | 异步 Feature（如 device.getInfo()） |
| **全局函数调用** | 对面直接调你的全局函数传参 | Native → JS 事件（processCallbacks） |

快应用的两种模式：

```
同步结果:
  JS 调 JsBridge.invoke() → Java 执行 → Java return String
  → JNI 把 Java String 转为 V8 String → JS 直接拿到返回值
  全程同步，一个调用栈完成

异步结果:
  JS 调 invokeNative() → 存 callbacks[42] = fn → 传 "42" 给 Native
  → Native 异步执行（可能在别的线程）
  → 执行完：Native 回到 JS 线程 → 调 executeVoidFunction("execInvokeCallback", {cb:42, data:...})
  → JS 查表 callbacks[42](data) → 执行完删除 delete callbacks[42]
  需要两次跨层调用
```

---

## 5. 内存管理模型

### 5.1 堆和栈的本质区别

| | 栈（Stack） | 堆（Heap） |
|--|---|---|
| 管理方式 | 自动（函数进入 push，退出 pop） | 手动或 GC |
| 分配速度 | 极快（移动栈指针） | 较慢（查找空闲块） |
| 生命周期 | 函数结束就没了 | 存活到手动释放或 GC 回收 |
| 存什么 | 局部变量、参数、返回地址 | 对象、字符串、闭包、长生命周期数据 |
| 大小 | 固定（通常 1-8MB） | 动态增长（可达 GB 级） |

### 5.2 三层各自的内存管理

**C++ Native Heap**：
```
管理方式：malloc/free（手动）或 智能指针（RAII）
指针：裸指针，直接是内存地址
增删改查：
  - 增：malloc(size) 或 new Object()
  - 删：free(ptr) 或 delete ptr
  - 改：直接通过指针写 *ptr = newValue
  - 查：直接通过指针读 value = *ptr
风险：野指针、内存泄漏、double free
```

**Java Heap**：
```
管理方式：GC（标记-清除 / 分代回收）
引用：不是裸指针，是对象引用（JVM 抽象，GC 可以移动对象）
增删改查：
  - 增：new Object()（GC 在新生代分配）
  - 删：不需要手动删，GC 自动回收不可达对象
  - 改：obj.field = newValue（通过引用操作）
  - 查：value = obj.field（通过引用操作）
特点：安全（无野指针），但有 GC 停顿
```

**V8 Heap**：
```
管理方式：V8 自己的 GC（分代：新生代 Scavenge + 老生代 Mark-Compact）
Handle：不是裸指针，是 Handle（间接引用，GC 移动对象时更新 Handle）
增删改查：
  - 增：v8::Object::New()（在 V8 Heap 分配）
  - 删：不手动删，V8 GC 回收
  - 改：object->Set(key, value)（通过 V8 API）
  - 查：object->Get(key)（通过 V8 API）
特点：和 Java 类似的 GC 模型，但 API 是 C++ 风格
```

### 5.3 为什么指针在跨层时失效

```
Java 引用:     0x0000000012345678 → Java Heap 中 JsBridge 对象
                                     ↑ GC 可能移动到 0x0000000087654321
                                     引用自动更新，但对 V8 来说这个地址无意义

V8 Handle:     Handle<Object> → V8 Heap 中某个 JS 对象
                                 ↑ V8 GC 可能移动
                                 Handle 自动更新，但对 Java 来说无意义

结论：
  Java 引用只在 Java 世界有效
  V8 Handle 只在 V8 世界有效
  跨世界 → 必须把数据"翻译"成通用格式（字符串/字节流）复制过去
```

---

## 6. 三层通信的内存视角

把所有知识串起来：

```
JS 开发者写: device.getInfo({success(data) { this.brand = data.brand }})

内存动作分解:

① JS 侧准备（V8 Heap 内）:
   - success 函数 → JSFunction 对象（堆上，有闭包 context）
   - uniqueCallbackId() → 数字 42
   - callbacks[42] = success（Map 存引用）
   - JSON.stringify({}) → V8 String 对象（堆上）

② 跨界（V8 → C++ → Java）:
   - V8 String → v8::String::Utf8Value → char*（V8 Heap → 栈上的 char 数组，拷贝1）
   - JNI NewStringUTF(char*) → java.lang.String（栈 → Java Heap，拷贝2）
   - JNI CallObjectMethod() → 进入 Java 方法栈帧

③ Java 侧执行（Java Heap + 栈）:
   - new JSONObject(string) → Java Heap 分配对象
   - Device.getInfo() → 读 Build.BRAND → Java String "Xiaomi"
   - 结果：{code: 0, content: {brand: "Xiaomi"}}

④ 回传（Java → C++ → V8）:
   - Java String → JNI GetStringUTFChars → char*（Java Heap → Native 栈，拷贝3）
   - V8 String::NewFromUtf8(char*) → V8 String（Native → V8 Heap，拷贝4）
   - V8 executeVoidFunction("execInvokeCallback", [event])

⑤ JS 侧回调（V8 Heap 内）:
   - JSON.parse(string) → V8 Object {brand: "Xiaomi"}
   - callbacks[42]({brand: "Xiaomi"}) → 执行 success 函数
   - this.brand = "Xiaomi" → Observer setter → Watcher → 渲染更新
   - delete callbacks[42] → 释放引用 → success 函数可被 V8 GC 回收
```

### 开销清单

| 步骤 | 开销类型 | 次数 |
|------|---------|------|
| JSON.stringify / JSON.parse | CPU（递归遍历 + 字符串拼接） | 2 次 |
| 内存拷贝 | memcpy | 4 次（来回各 2 次） |
| 堆分配 | 临时对象 | ~6 个（V8 String, char[], Java String, JSONObject, 回传各一套） |
| GC 压力 | 这些临时对象最终都要被回收 | 两侧 GC 各处理自己的 |
| JNI 调用 | 上下文切换 | 2 次（去1回1） |

### 本质

> **跨层通信 = 跨 GC 域的数据搬运。** 三块堆内存各有各的指针体系和垃圾回收器，互相看不懂对方的指针。所以只能把数据"拆成字节"搬过去，对面再"组装回来"。这就是序列化存在的根本原因——不是设计选择，而是物理约束。
