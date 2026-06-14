# 跨层通信方案对比 — 从本质理解 FFI / JSI / Bridge / Channel

## 目录

- [一、核心问题](#一核心问题)
- [二、本质模型：跨层调用的三个问题](#二本质模型跨层调用的三个问题)
- [三、为什么需要拷贝？GC 是罪魁祸首](#三为什么需要拷贝gc-是罪魁祸首)
- [四、跨层的关键：能不能访问对方的内存](#四跨层的关键能不能访问对方的内存)
- [五、六种方案逐个拆解](#五六种方案逐个拆解)
  - [5.1 Dart FFI](#51-dart-ffi)
  - [5.2 JSI](#52-jsi)
  - [5.3 RN 旧 Bridge](#53-rn-旧-bridge)
  - [5.4 Platform Channel](#54-platform-channel)
  - [5.5 JNI](#55-jni)
  - [5.6 WebAssembly](#56-webassembly)
- [六、总对比表](#六总对比表)
- [七、底层原理：句柄 + 函数指针 = 双向通信](#七底层原理句柄--函数指针--双向通信)
  - [句柄 = 正向引用对方的对象](#句柄--正向引用对方的对象)
  - [函数指针 = 反向调用对方的代码](#函数指针--反向调用对方的代码)
  - [四要素整合](#四要素整合)
- [八、结论：怎么选](#八结论怎么选)

---

## 一、核心问题

> 两个用不同语言/运行时写的模块，怎么互相调函数、传数据、拿结果？

这是所有跨平台框架的底层问题。不管 Flutter、RN、Electron、Tauri，本质都在解决这三件事。

---

## 二、本质模型：跨层调用的三个问题

任何跨层通信方案，都必须回答：

| # | 问题 | 本质 |
|---|------|------|
| 1 | **函数怎么找到？** | 我怎么知道对方"那个函数"在内存哪个地址？ |
| 2 | **参数怎么传过去？** | 数据放哪里，对方怎么读到？格式怎么约定？ |
| 3 | **结果怎么拿回来？** | 对方执行完了，结果放哪里，我怎么取？ |

不同方案的差异，就是对这三个问题的不同解法。

---

## 三、为什么需要拷贝？GC 是罪魁祸首

**核心矛盾：GC 会移动内存中的对象。**

```
GC 语言的内存（Java / JS / Dart）：
┌────────────────────────────────────┐
│  [obj_A] [obj_B] [...] [obj_C]     │  ← GC 随时可能整理内存
│     ↓ GC 整理后                     │     把 obj_B 移到别处
│  [obj_A] [obj_C] [    ] [obj_B']   │  ← obj_B 地址变了！
└────────────────────────────────────┘
```

如果 Native 层持有一个指向 `obj_B` 的裸指针，GC 一整理，指针就野了（悬垂指针）。

**所以规则是：**

| 情况 | 能零拷贝吗 | 原因 |
|------|-----------|------|
| 读 Native 内存（无 GC） | ✅ 能 | Native 分配的不会被移动 |
| 读 GC 堆内存 | ❌ 不能，必须拷贝出来 | GC 随时移动，指针不可信 |
| Native → Native | ✅ 能 | 都没 GC |
| GC 堆 → GC 堆（同 VM） | ✅ 能 | 同一个 GC 管理，引用有效 |

---

## 四、跨层的关键：能不能访问对方的内存

> **零拷贝的前提 = 你能安全地拿到对方内存的地址，并且这个地址在你使用期间不会失效。**

各方案的本质差异：

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  能直接访问对方内存 → 传指针（零拷贝）→ FFI / WASM 共享内存 │
│                                                             │
│  不能访问对方内存 → 必须序列化/拷贝 → Bridge / Channel       │
│                                                             │
│  能访问但对方有 GC → 拷贝出来再用 → JSI / JNI              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

分三档：

| 档位 | 条件 | 代表 |
|------|------|------|
| **零拷贝** | 同进程 + 对方无 GC（或有固定地址） | Dart FFI 读 Rust 内存 |
| **一次拷贝** | 同进程 + 对方有 GC（拷贝出来就安全） | JSI 读 JS String、JNI 读 Java 数组 |
| **双重拷贝**（序列化） | 跨进程/跨线程消息队列 | RN Bridge、Platform Channel |

---

## 五、六种方案逐个拆解

### 5.1 Dart FFI

**Flutter ↔ Rust**

**场景**：Flutter App 调用 Rust .so

#### 函数怎么找到？

```dart
final lib = DynamicLibrary.open("libquickapp.so");
final func = lib.lookupFunction<NativeSignature, DartSignature>("quickapp_open_card");
// → dlsym() 在 .so 的符号表里查到函数地址
```

机制：**动态链接符号查找**（dlsym），编译时确定函数名，运行时查地址。

#### 参数怎么传递？

```dart
// Dart 把 String 拷贝到 native 堆，拿到指针
final ptr = calloc<Uint8>(bytes.length);
ptr.asTypedList(bytes.length).setAll(0, bytes);  // ← 一次拷贝（Dart GC 堆 → native 堆）

// 传指针 + 长度给 Rust
func(handle, ptr, bytes.length);
```

机制：**C ABI 调用约定**。前 6 个参数放 CPU 寄存器（x64: RDI/RSI/RDX/RCX/R8/R9），多余的放栈。

#### 结果怎么拿回来？

```dart
// 简单类型：直接返回值（寄存器 RAX）
int result = func(...);  // 0=ok, 1=error

// 复杂数据：出参指针（Rust 往里写地址+长度）
final outPtr = calloc<Pointer<Uint8>>();
final outLen = calloc<IntPtr>();
bindings.takeUpdate(buffer, outPtr, outLen);
final data = outPtr.value.asTypedList(outLen.value);  // ← 零拷贝！直接看 Rust 内存
```

**零拷贝方向**：Rust → Dart（Dart 直接看 Rust 分配的内存，不拷贝）
**有拷贝方向**：Dart → Rust（Dart String 在 GC 堆，必须拷贝到 native 堆再传指针）

---

### 5.2 JSI

**React Native ↔ C++**

**场景**：RN JS 引擎调用 Native C++ 模块

#### 函数怎么找到？

```cpp
// C++ 侧注册 HostFunction 到 JS Runtime
runtime.global().setProperty(runtime, "nativeFunc",
    jsi::Function::createFromHostFunction(runtime, ..., hostFunc));
```

机制：**JS 引擎注册表**。C++ 把函数注册到 JS 全局对象上，JS 通过属性名访问。

#### 参数怎么传递？

```cpp
jsi::Value hostFunc(jsi::Runtime& rt, const jsi::Value& thisVal,
                    const jsi::Value* args, size_t count) {
    // JS String → C++ std::string（一次拷贝）
    std::string name = args[0].asString(rt).utf8(rt);  // ← 必须拷贝！
    // 因为 JS GC 随时可能移动 JS 堆中的 String 对象
}
```

机制：**jsi::Value 包装** + utf8() 拷贝。不能直接拿 JS 堆的指针（GC 会移动）。

#### 结果怎么拿回来？

```cpp
// C++ 返回 jsi::Value（在 JS 堆上分配新对象）
return jsi::String::createFromUtf8(rt, resultStr);  // ← 又一次拷贝（C++ → JS 堆）
```

**两个方向都有拷贝**：JS → C++（拷贝出 GC 堆），C++ → JS（拷贝进 GC 堆）。

---

### 5.3 RN 旧 Bridge

**React Native ↔ Java/ObjC**

**场景**：RN 0.68 之前，JS 调用 Native 模块

#### 函数怎么找到？

```javascript
// JS 侧通过模块名 + 方法名查找
NativeModules.MyModule.doSomething(param);
// → BatchedBridge 把调用信息序列化为 JSON 放入队列
```

机制：**异步消息队列 + 模块注册表**。不是直接调函数，是发消息。

#### 参数怎么传递？

```
JS 侧:
  { module: "MyModule", method: "doSomething", args: ["hello", 42] }
  → JSON.stringify()  // ← 第一次拷贝：序列化
  → 放入消息队列
  → Native 线程取出
  → JSON.parse()      // ← 第二次拷贝：反序列化
  → 分发到 Java/ObjC 方法
```

机制：**JSON 序列化 + 跨线程消息队列**。两次序列化 = 两次拷贝。

#### 结果怎么拿回来？

```
Native 侧:
  结果 → JSON.stringify() → 放入回调队列 → JS 线程取出 → JSON.parse() → callback(result)
```

**双重拷贝 × 2**（去程 + 回程各两次），加上跨线程切换延迟。这就是为什么旧 RN Bridge 慢。

---

### 5.4 Platform Channel

**Flutter ↔ Android/iOS**

**场景**：Flutter Dart 调用 Android Activity / iOS ViewController 的方法

#### 函数怎么找到？

```dart
// Dart 侧通过 channel 名 + method 名
final channel = MethodChannel('com.example/battery');
final result = await channel.invokeMethod('getBatteryLevel');
```

机制：**命名通道 + 方法名字符串匹配**。Flutter Engine 内部路由。

#### 参数怎么传递？

```
Dart 对象 → StandardMessageCodec 编码（二进制序列化）
→ 跨 Isolate 传递
→ 平台侧 Codec 解码 → Java/ObjC 对象
```

机制：**自定义二进制 Codec**（比 JSON 快，但仍然是序列化）。一次序列化 + 一次反序列化。

#### 结果怎么拿回来？

```
Java/ObjC 返回值 → Codec 编码 → 跨 Isolate → Dart Codec 解码
```

**每次调用：序列化 × 2（去+回）**。适合低频调用（获取电量/打开相机），不适合每帧调。

---

### 5.5 JNI

**Java ↔ C/Rust**

**场景**：Android Java 调用 native .so

#### 函数怎么找到？

```java
// Java 侧声明 native 方法
public native int openCard(byte[] manifest, byte[] template);

// JVM 按命名规则（Java_包名_类名_方法名）在 .so 中查找
// 或 RegisterNatives() 动态注册
```

机制：**JNI 命名约定 + dlsym**，和 Dart FFI 类似但多了 JNI 包装层。

#### 参数怎么传递？

```c
JNIEXPORT jint JNICALL Java_com_example_openCard(
    JNIEnv *env, jobject thiz, jbyteArray manifest) {

    // Java byte[] 在 GC 堆中，必须"锁定"或"拷贝"才能用
    jbyte* ptr = (*env)->GetByteArrayElements(env, manifest, NULL);  // ← 可能拷贝
    int len = (*env)->GetArrayLength(env, manifest);

    // 用完必须释放
    (*env)->ReleaseByteArrayElements(env, manifest, ptr, 0);
}
```

机制：**JNI 函数获取 GC 堆数据**。`GetByteArrayElements` 可能零拷贝（pin）也可能拷贝，取决于 GC 实现。

#### 结果怎么拿回来？

```c
// 简单类型：直接 return
return (jint)result;

// 复杂类型：创建 Java 对象
jbyteArray output = (*env)->NewByteArray(env, len);  // ← 在 Java 堆分配
(*env)->SetByteArrayRegion(env, output, 0, len, data);  // ← 拷贝进去
return output;
```

**JNI 的特殊性**：`GetByteArrayElements` 可能不拷贝（如果 GC 支持 pinning），但不保证。写代码时必须假设有拷贝。

---

### 5.6 WebAssembly

**Browser ↔ WASM**

**场景**：浏览器 JS 调用 Rust 编译的 WASM 模块

#### 函数怎么找到？

```javascript
const wasm = await WebAssembly.instantiate(buffer, imports);
const openCard = wasm.instance.exports.open_card;  // 直接从 exports 表取
```

机制：**WASM 导出表**。编译时确定导出函数，运行时直接访问。

#### 参数怎么传递？

```javascript
// WASM 有独立的线性内存（ArrayBuffer）
const memory = wasm.instance.exports.memory;

// 把 JS String 写入 WASM 内存
const encoder = new TextEncoder();
const bytes = encoder.encode(jsonStr);
const ptr = wasm.instance.exports.alloc(bytes.length);  // WASM 侧分配
new Uint8Array(memory.buffer, ptr, bytes.length).set(bytes);  // ← 拷贝进 WASM 内存

// 传指针 + 长度
openCard(ptr, bytes.length);
```

机制：**共享线性内存（ArrayBuffer）**。JS 和 WASM 能读写同一块 ArrayBuffer，但 JS String 必须先编码写入。

#### 结果怎么拿回来？

```javascript
// WASM 返回指针 + 长度（指向 WASM 线性内存）
const [resultPtr, resultLen] = getResult();
// JS 直接从 WASM 内存中读（零拷贝视图）
const resultBytes = new Uint8Array(memory.buffer, resultPtr, resultLen);
const resultStr = new TextDecoder().decode(resultBytes);
```

**和 Dart FFI 类似的模式**：WASM → JS 方向可以零拷贝（JS 直接看 WASM 内存）；JS → WASM 方向有拷贝（JS String 编码后写入 WASM 内存）。

---

## 六、总对比表

| 方案 | 函数查找 | 参数传递 | 结果返回 | 总拷贝次数 | 延迟 | 同步/异步 |
|------|---------|---------|---------|-----------|------|----------|
| **Dart FFI** | dlsym 符号查找 | ptr+len (C ABI 寄存器) | 返回值 / 出参指针 | Dart→Rust: 1次; Rust→Dart: **0次** | ~10ns | 同步 |
| **JSI** | JS Runtime 注册 | jsi::Value unbox | jsi::Value 构造 | 去: 1次; 回: 1次 | ~100ns | 同步 |
| **RN Bridge** | 模块注册表 + JSON | JSON.stringify | JSON 回调队列 | 去: 2次; 回: 2次 | ~1ms | 异步 |
| **Platform Channel** | 命名通道 + method | Codec 序列化 | Codec 序列化 | 去: 1次; 回: 1次 | ~100μs | 异步 |
| **JNI** | 命名规则/RegisterNatives | Get*Elements (可能 pin) | New*Array + Set | 去: 0-1次; 回: 1次 | ~50ns | 同步 |
| **WASM** | exports 表 | 写入线性内存 | 读线性内存 | JS→WASM: 1次; WASM→JS: **0次** | ~20ns | 同步 |

---

## 七、底层原理：句柄 + 函数指针 = 双向通信

跨层通信的全部底层机制，归结为 4 个原语：

### 句柄 = 正向引用对方的对象

句柄（Handle）本质是一个 **不透明的 ID/地址**，让一方能引用另一方管理的对象，但不需要直接碰对方的内存布局。

```
Dart 侧:                         Rust 侧:

  handle = 0x7f3a2000            ┌─────────────────────┐
  (只知道是个地址，               │  QuickAppRuntime {  │
   不知道里面是啥)                │    container: ...   │
                                 │    card: ...        │
  openCard(handle, ...)  ────→   │    widget_info: ... │
                                 │  }                  │
                                 └─────────────────────┘
```

**为什么不直接传对象本身？** 因为 Dart 不认识 Rust 的 struct 内存布局。句柄让 Dart 只持有一个"遥控器"（地址），所有操作都通过函数调用让 Rust 自己处理内部状态。

句柄的两种形式：

| 形式 | 例子 | 优劣 |
|------|------|------|
| 裸指针 | `*mut QuickAppRuntime` = 堆上对象的内存地址 | 快（直接解引用），但有野指针风险 |
| 整数 ID | `handle = 42`，对方维护 Map<42, Object> | 安全（可校验），但多一次查表 |

### 函数指针 = 反向调用对方的代码

函数指针解决 **反向调用** 问题 —— Rust 引擎需要调回 Dart（如文本测量、通知）：

```
正向（Dart → Rust）：dlsym 查到函数地址 → 直接调用（天然支持）

反向（Rust → Dart）：Rust 不知道 Dart 函数在哪
  解法：Dart 先把自己的 static 函数地址"注册"给 Rust
```

注册过程：
```dart
// Dart 侧：把函数地址 + 上下文传给 Rust
final callbackPtr = Pointer.fromFunction<MeasureTextNative>(_measureText);
bindings.setMeasureTextCallback(handle, callbackPtr, userData);
```

使用时：
```rust
// Rust 侧：需要时直接调用存储的函数指针
pub type MeasureTextCallback = extern "C" fn(user_data: *mut c_void, ...);

fn layout_text(&self) {
    (self.measure_text_callback)(self.user_data, text_ptr, text_len, ...);
}
```

### 四要素整合

跨层通信的全部底层原语：

```
┌── 调用方 (Dart) ─────────────────────── 被调方 (Rust) ──┐
│                                                          │
│  正向调用（Dart → Rust）：                                │
│    句柄(handle) + 函数地址(dlsym) + 参数(ptr+len)        │
│                                                          │
│  反向调用（Rust → Dart）：                                │
│    函数指针(callback) + 上下文(user_data)                 │
│                                                          │
│  数据共享：                                               │
│    堆内存 — 双方通过指针看同一块 native 堆                │
│                                                          │
│  参数通道：                                               │
│    栈 + 寄存器 — C ABI 约定的参数传递位置                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

总结成公式：

```
FFI 通信 = 句柄（引用对方状态）
         + 函数指针（反向调用）
         + 堆内存（数据共享载体）
         + 栈/寄存器（参数传递通道）
```

其中：
- **句柄** 解决"我怎么找到你的东西"
- **函数指针** 解决"你怎么调我的代码"
- **堆** 解决"大块数据放哪里"
- **栈** 解决"小参数怎么快速传"

所有跨层通信方案（FFI / JSI / JNI / WASM）本质都是这四个要素的组合，只是抽象层厚薄不同。

---

## 八、结论：怎么选

### 决策树

```
需要每帧调用（tick/布局/渲染）？
  ├── 是 → 必须 FFI / JNI / WASM（同步 + 低延迟）
  │        ├── Flutter → Dart FFI
  │        ├── Android Native → JNI
  │        └── Web → WASM
  │
  └── 否（低频：权限/存储/相机）
       ├── Flutter → Platform Channel
       ├── RN → JSI（新）/ Bridge（旧）
       └── Electron → Node.js API
```

### 性能排序

```
零拷贝同步:  Dart FFI (Rust→Dart)  ≈  WASM (WASM→JS)
一次拷贝同步: Dart FFI (Dart→Rust) ≈ JSI ≈ JNI ≈ WASM (JS→WASM)
序列化异步:  Platform Channel < RN Bridge（最慢）
```

### 核心洞察

> **能不能零拷贝，取决于"你要读的数据在不在 GC 管辖范围内"。**
>
> - 在 GC 堆里 → 必须拷贝出来（GC 随时移动）
> - 在 Native 堆里 → 直接传指针（不会被移动）
>
> 所以最优架构是：**核心数据放 Native 侧（Rust 分配），上层（Dart/JS）只通过指针/视图读取。**

这正是 rust_w3c 框架的设计：
- FrameUpdate 在 Rust 侧分配和填充
- Dart 通过 FFI 拿到指针直接读取（零拷贝）
- 只有初始 JSON 加载时 Dart → Rust 有一次拷贝（不影响帧率）
