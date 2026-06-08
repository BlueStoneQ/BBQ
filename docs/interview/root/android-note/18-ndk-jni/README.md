# 18. NDK 与 JNI

> Java/Kotlin ↔ C/C++ 的双向通信桥梁。Android 中跨语言调用的核心机制。

## 目录

- [一、JNI 是什么](#一jni-是什么)
- [二、JNI 是双向的](#二jni-是双向的)
- [三、NDK 是什么](#三ndk-是什么)
- [四、最小示例](#四最小示例)
- [五、跨端通信对比](#五跨端通信对比)
- [六、Rust 参与 NDK 开发](#六rust-参与-ndk-开发)
- [七、使用场景](#七使用场景)
- [八、在快应用框架中的应用](#八在快应用框架中的应用)

---

## 一、JNI 是什么

```
JNI = Java Native Interface

本质：JVM 提供的标准接口规范，让 Java/Kotlin 代码和 C/C++ 代码互相调用。

关键理解：
  JNI 不是 Android 独有的——任何 JVM 都支持 JNI
  Android 的 Dalvik/ART 虚拟机也实现了 JNI 规范
  JNI 是规范/接口，NDK 是工具链
```

---

## 二、JNI 是双向的

**不只是 Java 调 C++，C++ 也能主动调 Java。**

```
方向 1：Java/Kotlin → C++（最常用）
  Java 声明 native 方法 → C++ 实现
  用途：高性能计算、调用系统底层 API、复用 C/C++ 库

方向 2：C++ → Java/Kotlin（回调/事件推送）
  C++ 通过 JNIEnv 反向调用 Java 方法
  用途：C++ 层完成任务后通知 Java 层、异步回调

本质模型：
  ┌─────────────────────────────────────────────────┐
  │  Java/Kotlin 层（ART 虚拟机）                     │
  │    ↕ JNI（双向桥）                               │
  │  C/C++ 层（Native 代码，直接跑在 CPU 上）          │
  └─────────────────────────────────────────────────┘

类比：
  JNI 之于 Android = JSI 之于 RN = Node addon 之于 Node.js
  都是"高级语言运行时 ↔ Native 代码"的桥接机制
```

---

## 三、NDK 是什么

```
NDK = Native Development Kit

NDK 是工具链，JNI 是接口规范：
  NDK 提供：C/C++ 编译器（交叉编译到 ARM/x86）+ 头文件 + 构建系统（CMake/ndk-build）
  JNI 提供：Java 和 C++ 互调的 API 规范

类比：
  JNI = 协议（怎么调）
  NDK = 工具箱（怎么编译 + 打包）
```

---

## 四、最小示例

```kotlin
// ===== Java/Kotlin 侧：声明 native 方法 =====
class NativeLib {
    companion object {
        init {
            System.loadLibrary("mylib")  // 加载 libmylib.so
        }
    }

    // 方向 1：Java → C++（声明 native，C++ 实现）
    external fun add(a: Int, b: Int): Int
    external fun processImage(pixels: ByteArray): ByteArray

    // 方向 2：C++ → Java（Java 提供回调方法，C++ 主动调用）
    fun onNativeResult(result: String) {
        // C++ 完成任务后回调这里
        Log.d("JNI", "Native returned: $result")
    }
}
```

```cpp
// ===== C++ 侧：实现 native 方法 =====
#include <jni.h>

// 方向 1：Java 调 C++
extern "C" JNIEXPORT jint JNICALL
Java_com_example_NativeLib_add(JNIEnv *env, jobject thiz, jint a, jint b) {
    return a + b;
}

// 方向 2：C++ 主动调 Java
void notifyJava(JNIEnv *env, jobject thiz) {
    jclass clazz = env->GetObjectClass(thiz);
    jmethodID method = env->GetMethodID(clazz, "onNativeResult", "(Ljava/lang/String;)V");
    //                                          ↑ Java 方法名      ↑ JNI 签名（参数类型+返回类型）
    jstring result = env->NewStringUTF("done");
    env->CallVoidMethod(thiz, method, result);  // C++ 调 Java 方法
}
```

```cmake
# ===== CMakeLists.txt（NDK 构建配置）=====
cmake_minimum_required(VERSION 3.10)
project("mylib")
add_library(mylib SHARED native-lib.cpp)
find_library(log-lib log)
target_link_libraries(mylib ${log-lib})
```

---

## 五、跨端通信对比

| 平台 | 桥接机制 | 方向 | 同进程？ | 序列化？ |
|------|---------|------|:---:|:---:|
| Android JNI | JNI（JVM 规范） | 双向 | ✅ | ❌（共享内存） |
| RN JSI | JSI（C++ 共享对象） | 双向 | ✅ | ❌（零拷贝） |
| RN Bridge（旧） | JSON Bridge | 双向 | ✅ | ✅（JSON 序列化） |
| Node.js addon | N-API / node-addon-api | 双向 | ✅ | ❌ |
| Electron IPC | Mojo（跨进程） | 双向 | ❌ | ✅（Structured Clone） |

**JNI 的性能优势**：同进程 + 无序列化 = 接近原生函数调用速度。但 JNI 调用仍有一定开销（虚拟机需要做边界检查、线程状态切换），频繁调用时会成为瓶颈。

---

## 六、Rust 参与 NDK 开发

### 原理

Rust 编译出 `.so`（动态链接库），和 C++ 产物完全一样。Java/Kotlin 通过 `System.loadLibrary()` 加载，不知道也不关心底层是 C++ 还是 Rust。

```
接入方式：

方式 1：Rust 直接暴露 JNI 接口（用 jni-rs crate）
  Rust 代码里直接写 JNI 函数签名 → 编译出 .so → Java 直接调
  适合：新项目、Rust 为主的场景

方式 2：Rust 暴露 C ABI（extern "C"），C++ 薄封装层做 JNI 胶水
  Rust 写纯逻辑，暴露 C 接口 → C++ 实现 JNI 函数内部调 Rust
  适合：已有 JNI 层、只想替换底层实现
```

### 最小示例（方式 1：Rust 直接 JNI）

```rust
// src/lib.rs
use jni::JNIEnv;
use jni::objects::{JClass, JString};
use jni::sys::jstring;

#[no_mangle]
pub extern "system" fn Java_com_example_NativeLib_greet(
    env: JNIEnv,
    _class: JClass,
    name: JString,
) -> jstring {
    let name: String = env.get_string(name).unwrap().into();
    let greeting = format!("Hello from Rust, {}!", name);
    env.new_string(greeting).unwrap().into_raw()
}
```

```toml
# Cargo.toml
[lib]
crate-type = ["cdylib"]  # 编译为动态链接库（.so）

[dependencies]
jni = "0.21"
```

```bash
# 交叉编译到 Android ARM64
rustup target add aarch64-linux-android
cargo ndk -t arm64-v8a build --release
# 产物：target/aarch64-linux-android/release/libmylib.so
# → 放到 app/src/main/jniLibs/arm64-v8a/
```

```kotlin
// Kotlin 侧调用（和调 C++ 写的 .so 完全一样）
class NativeLib {
    companion object {
        init { System.loadLibrary("mylib") }
    }
    external fun greet(name: String): String
}

// 使用
val result = NativeLib().greet("World")  // "Hello from Rust, World!"
```

### Rust vs C++ 的 trade-off

| | Rust | C++ |
|---|---|---|
| 内存安全 | 编译期保证（无 segfault / UAF） | 手动管理（易出 bug） |
| 生态 | jni-rs / uniffi（自动生成绑定） | 成熟，NDK 官方原生支持 |
| 编译配置 | 需要 cargo-ndk + 交叉编译目标 | NDK 原生支持 CMake/ndk-build |
| 学习成本 | 所有权/生命周期/借用检查 | 指针/RAII/模板 |
| 跨平台复用 | 同一份代码编译到 Android/iOS/Wasm/Desktop | 同理但配置更复杂 |
| 实际应用 | Tauri / Mozilla / Signal | V8 / FFmpeg / 存量代码 |

> **Tauri 就是这个模式的极致**：Rust 编译出 Native 后端 + 系统 WebView 渲染前端，完全替代 Electron 的 Node.js + Chromium 组合。

---

## 七、使用场景

| 场景 | 为什么用 NDK/JNI | 举例 |
|------|-----------------|------|
| 高性能计算 | C++/Rust 无 GC、更贴近硬件 | 图像处理、音视频编解码、加密 |
| 复用现有 C/C++ 库 | 不想用 Java 重写 | OpenCV、FFmpeg、SQLite |
| 系统底层 API | 部分能力只有 C 层接口 | 直接操作硬件、内核 |
| 代码保护 | .so 比 .dex 更难反编译 | 核心算法 |
| 跨平台共享 | 同一份 C++/Rust 代码编译到 Android/iOS/Desktop | 业务逻辑引擎 |

---

## 八、在快应用框架中的应用

```
快应用框架 = Java 容器 + V8 引擎（C++）+ JS 业务代码

通信链路：
  JS 业务代码
    ↕ V8 C++ API（JS ↔ C++）
  V8 引擎（C++ 层）
    ↕ JNI（C++ ↔ Java）
  Java 宿主（Activity、系统 API、UI 渲染）

JNI 在其中的角色：
  - J2V8 就是 JNI 的封装：Java 通过 JNI 调 V8 的 C++ API
  - V8 执行 JS 后需要操作 Android UI → 通过 JNI 回调 Java 层
  - 性能敏感路径（如布局计算）在 C++ 层完成，通过 JNI 把结果传给 Java 渲染
```
