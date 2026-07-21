# AAR / SO / JNI 构建指南

## 目录

- [AAR](#aar)
- [SO（Native 共享库）](#sonative-共享库)
- [JNI](#jni)
- [JNI 补充：双向调用与在 TurboModule 中的角色](#jni-补充双向调用与在-turbomodule-中的角色)
- [QA](#qa)
  - [JNI 可以让 Java/Kotlin 和 C++ 互相调用吗](#q-jni-可以让-javakotlin-和-c-互相调用吗)
  - [JNI 在 TurboModule 中的角色](#q-jni-在-turbomodule-中的角色是什么)
  - [为什么需要 JNI](#q-为什么需要-jni直接调不行吗)
  - [iOS 为什么不需要 JNI](#q-ios-为什么不需要-jni)
- [注释：核心概念](#注释核心概念)
  - [JNIEnv](#注释jnienv)

---

## AAR

### 是什么

AAR = Android Archive，Android 库的打包格式。类似 npm 包，给其他 App/模块依赖用。

```
.aar 解压后：
├── classes.jar          ← 编译后的 Java/Kotlin 代码
├── res/                 ← 资源文件（layout/drawable/values）
├── AndroidManifest.xml  ← 库的 manifest（权限、组件声明）
├── R.txt                ← 资源 ID 映射
├── jni/                 ← SO 库（如果有 Native 代码）
│   ├── arm64-v8a/
│   └── armeabi-v7a/
└── proguard.txt         ← 混淆规则（消费者使用）
```

### 如何编写（创建 Library Module）

```
项目结构：
my-app/
├── app/                  ← 主应用模块（com.android.application）
└── ble-sdk/              ← 库模块（com.android.library）
    ├── build.gradle
    └── src/main/
        ├── java/com/myapp/ble/
        │   └── BLEManager.kt
        ├── res/
        └── AndroidManifest.xml
```

```groovy
// ble-sdk/build.gradle
plugins {
    id 'com.android.library'  // ← 注意是 library，不是 application
    id 'kotlin-android'
}

android {
    namespace 'com.myapp.ble'
    compileSdk 34

    defaultConfig {
        minSdk 24
        // 没有 applicationId（库不是独立 App）
    }
}

dependencies {
    implementation 'org.jetbrains.kotlin:kotlin-stdlib:1.9.0'
    // 库的依赖
}
```

```kotlin
// ble-sdk/src/main/java/com/myapp/ble/BLEManager.kt
package com.myapp.ble

class BLEManager(private val context: Context) {
    fun connect(deviceId: String): Boolean { /* ... */ }
    fun disconnect() { /* ... */ }
}
```

### 如何构建

```bash
# 构建 AAR
./gradlew :ble-sdk:assembleRelease
# 产物：ble-sdk/build/outputs/aar/ble-sdk-release.aar
```

### 如何使用

**方式一：本地依赖**

```groovy
// app/build.gradle
dependencies {
    implementation files('libs/ble-sdk-release.aar')
    // 或
    implementation project(':ble-sdk')  // 同项目内的模块依赖
}
```

**方式二：发布到 Maven 仓库**

```groovy
// ble-sdk/build.gradle
plugins {
    id 'maven-publish'
}

publishing {
    publications {
        release(MavenPublication) {
            groupId = 'com.myapp'
            artifactId = 'ble-sdk'
            version = '1.0.0'
            afterEvaluate {
                from components.release
            }
        }
    }
    repositories {
        maven { url = uri("https://maven.company.com/releases") }
    }
}
```

```bash
./gradlew :ble-sdk:publish  # 发布到远程 Maven
```

其他项目使用：
```groovy
dependencies {
    implementation 'com.myapp:ble-sdk:1.0.0'
}
```

---

## SO（Native 共享库）

### 是什么

SO = Shared Object，C/C++ 编译的动态链接库（Linux/Android 的 .dll）。

### 如何构建（CMake + NDK）

```
ble-sdk/
├── src/main/
│   ├── cpp/                    ← C++ 源码
│   │   ├── CMakeLists.txt      ← 构建配置
│   │   ├── native-ble.cpp      ← 实现
│   │   └── native-ble.h
│   └── java/com/myapp/ble/
│       └── NativeBLE.kt        ← Java/Kotlin 侧 JNI 声明
└── build.gradle
```

```cmake
# src/main/cpp/CMakeLists.txt
cmake_minimum_required(VERSION 3.18)
project(native-ble)

add_library(
    native-ble          # 库名 → 生成 libnative-ble.so
    SHARED              # 动态库
    native-ble.cpp      # 源文件
)

# 链接 Android 日志库
find_library(log-lib log)
target_link_libraries(native-ble ${log-lib})
```

```groovy
// build.gradle
android {
    defaultConfig {
        externalNativeBuild {
            cmake {
                cppFlags "-std=c++17"
                arguments "-DANDROID_STL=c++_shared"
            }
        }
        ndk {
            abiFilters "arm64-v8a", "armeabi-v7a"
        }
    }
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
        }
    }
}
```

```bash
./gradlew assembleRelease
# 自动编译 SO，产物在：
# build/intermediates/cmake/release/obj/arm64-v8a/libnative-ble.so
# build/intermediates/cmake/release/obj/armeabi-v7a/libnative-ble.so
# 最终打进 AAR/APK 的 jni/ 目录
```

---

## JNI

### 是什么

JNI = Java Native Interface，Java/Kotlin 调用 C/C++ 代码的标准接口。

### 调用流程

```
Kotlin 声明 external 方法
  → System.loadLibrary("native-ble") 加载 SO
  → 调用 external 方法
  → JVM 通过函数名映射找到 C++ 实现
  → 执行 C++ 代码
  → 返回结果给 Kotlin
```

### Kotlin 侧声明

```kotlin
// NativeBLE.kt
package com.myapp.ble

class NativeBLE {
    companion object {
        init {
            System.loadLibrary("native-ble")  // 加载 libnative-ble.so
        }
    }

    // external = 实现在 C++ 侧
    external fun connect(deviceId: String): Boolean
    external fun getSignalStrength(): Int
    external fun processData(buffer: ByteArray): ByteArray
}
```

### C++ 侧实现

```cpp
// native-ble.cpp
#include <jni.h>
#include <string>

// 函数名规则：Java_包名_类名_方法名（包名的 . 换成 _）
extern "C" JNIEXPORT jboolean JNICALL
Java_com_myapp_ble_NativeBLE_connect(
    JNIEnv *env,          // JNI 环境指针（用于类型转换）
    jobject thiz,         // 调用者对象（this）
    jstring deviceId      // 参数（JNI 类型）
) {
    // jstring → std::string
    const char *id = env->GetStringUTFChars(deviceId, nullptr);
    std::string deviceIdStr(id);
    env->ReleaseStringUTFChars(deviceId, id);  // 必须释放！

    // 你的 C++ 逻辑
    bool result = doConnect(deviceIdStr);
    return static_cast<jboolean>(result);
}

extern "C" JNIEXPORT jint JNICALL
Java_com_myapp_ble_NativeBLE_getSignalStrength(
    JNIEnv *env,
    jobject thiz
) {
    return static_cast<jint>(readRSSI());
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_myapp_ble_NativeBLE_processData(
    JNIEnv *env,
    jobject thiz,
    jbyteArray buffer
) {
    // jbyteArray → C++ 数组
    jsize len = env->GetArrayLength(buffer);
    jbyte *data = env->GetByteArrayElements(buffer, nullptr);

    // 处理数据...
    std::vector<uint8_t> result = process(reinterpret_cast<uint8_t*>(data), len);

    env->ReleaseByteArrayElements(buffer, data, 0);  // 释放

    // C++ 数组 → jbyteArray
    jbyteArray output = env->NewByteArray(result.size());
    env->SetByteArrayRegion(output, 0, result.size(), reinterpret_cast<jbyte*>(result.data()));
    return output;
}
```

### JNI 类型映射

| Java/Kotlin | JNI 类型 | C++ 类型 |
|-------------|---------|---------|
| boolean | jboolean | uint8_t |
| int | jint | int32_t |
| long | jlong | int64_t |
| float | jfloat | float |
| double | jdouble | double |
| String | jstring | const char* (需转换) |
| byte[] | jbyteArray | jbyte* (需转换) |
| Object | jobject | — |

### JNI 注意事项

| 规则 | 说明 |
|------|------|
| **函数名必须匹配** | `Java_包名_类名_方法名`，一个字符错都找不到 |
| **必须释放资源** | `GetStringUTFChars` → `ReleaseStringUTFChars`，否则内存泄漏 |
| **线程安全** | JNIEnv 是线程绑定的，不能跨线程使用 |
| **异常处理** | C++ 异常不会传到 Java，需要手动 `env->ThrowNew()` |
| **extern "C"** | 必须加，否则 C++ name mangling 导致函数名对不上 |

### 和 TurboModule 的关系

```
手写 JNI：你自己写 C++ 函数名映射 + 类型转换 + 资源管理
TurboModule：Codegen 自动生成所有 JNI 代码，你只写 Java 业务逻辑

TurboModule 本质就是帮你自动化了 JNI 这套繁琐的工作。
```


---

## JNI 补充：双向调用与在 TurboModule 中的角色

### C++ → Java 反向调用

JNI 不只是 Java 调 C++，也能 **C++ 主动调 Java**（通过反射）：

```cpp
// C++ 主动调用 Java 方法
void callbackToJava(JNIEnv* env, jobject javaCallback) {
    // 1. 找到类
    jclass clazz = env->GetObjectClass(javaCallback);
    
    // 2. 找到方法（方法签名：参数和返回值类型）
    //    "(Ljava/lang/String;I)V" = 接收 String + int，返回 void
    jmethodID method = env->GetMethodID(clazz, "onResult", "(Ljava/lang/String;I)V");
    
    // 3. 调用
    jstring msg = env->NewStringUTF("connected");
    env->CallVoidMethod(javaCallback, method, msg, 200);
    
    // 4. 清理局部引用
    env->DeleteLocalRef(msg);
    env->DeleteLocalRef(clazz);
}
```

**方法签名规则**：

| Java 类型 | 签名 |
|-----------|------|
| void | V |
| int | I |
| long | J |
| boolean | Z |
| String | Ljava/lang/String; |
| int[] | [I |
| Object | Ljava/lang/Object; |

示例：`void onResult(String msg, int code)` → `"(Ljava/lang/String;I)V"`

### 双向调用总结

```
方向1：Java → C++（声明式，简单）
  Kotlin: external fun connect(deviceId: String): Boolean
  C++: Java_com_myapp_NativeBLE_connect(JNIEnv*, jobject, jstring) → jboolean

方向2：C++ → Java（反射式，复杂）
  C++: env->FindClass → GetMethodID → CallVoidMethod
  需要知道类名 + 方法名 + 参数签名
```

### JNI 在 TurboModule 完整链路中的位置

```
完整链路：
  JS → JSI(C++ HostFunction) → JNI → Java/Kotlin TurboModule 实现

具体角色：
  JSI 层：JS ↔ C++ 通信（零序列化）
  JNI 层：C++ ↔ Java 通信（类型转换 + 反射调用）

两层对比：
  JSI：JS 和 C++ 在同一进程内，函数指针直调
  JNI：C++ 和 Java 在同一进程内，但 Java 有独立堆 + GC，需要显式桥接
```

### 为什么 iOS 不需要 JNI

| | Android | iOS |
|--|---------|-----|
| Native 语言 | Java/Kotlin（JVM 托管） | Objective-C/Swift |
| C++ 调 Native | 必须 JNI（JVM 隔离） | 直接混编（ObjC 是 C 超集） |
| 文件后缀 | `.cpp` + `.kt`（分开） | `.mm`（ObjC++ 混合写） |
| 类型转换 | 手动（jstring ↔ std::string） | 自动（NSString 和 C++ 共存） |
| 复杂度 | 高 | 低 |

```
Android: C++ → JNI(FindClass/GetMethodID/CallMethod) → Java
iOS:     C++ → 直接调 ObjC 方法（同一个 .mm 文件里）
```

这就是为什么 RN TurboModule 在 Android 侧 Codegen 生成 JNI 胶水代码，在 iOS 侧只需要简单的 ObjC++ 桥接。

### 性能注意事项

| 操作 | 开销 | 建议 |
|------|------|------|
| `FindClass` | 中（首次慢，可缓存） | 在 `JNI_OnLoad` 中缓存 jclass |
| `GetMethodID` | 中（首次慢，可缓存） | 缓存为 static 变量 |
| `NewStringUTF` | 低（拷贝一次） | 正常使用 |
| `Get/ReleaseArrayElements` | 中（可能拷贝整个数组） | 大数组用 `GetDirectBufferAddress` |
| `CallVoidMethod` | 低 | 正常使用 |

**最佳实践：缓存 jclass 和 jmethodID**

```cpp
// 在 JNI_OnLoad 中一次性缓存（SO 加载时执行）
static jclass g_callbackClass = nullptr;
static jmethodID g_onResultMethod = nullptr;

JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void* reserved) {
    JNIEnv* env;
    vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6);
    
    // 缓存类引用（必须用 GlobalRef，否则会被 GC）
    jclass localClass = env->FindClass("com/myapp/ble/BLECallback");
    g_callbackClass = (jclass)env->NewGlobalRef(localClass);
    env->DeleteLocalRef(localClass);
    
    // 缓存方法 ID
    g_onResultMethod = env->GetMethodID(g_callbackClass, "onResult", "(Ljava/lang/String;I)V");
    
    return JNI_VERSION_1_6;
}
```


---

## QA

### Q: JNI 可以让 Java/Kotlin 和 C++ 互相调用吗？

**对，双向的。**

```
Java/Kotlin ←→ JNI ←→ C/C++
```

**方向1：Java → C++（native method，声明式）**

> **Q: 其实就是在 Kotlin 声明一个方法，然后在 C++ 侧实现？**
> 
> 对，就这么简单。Kotlin 用 `external` 声明，C++ 用约定的函数名实现。
>
> **Q: 中间需要 JNI 声明文件吗？**
> 
> **不需要额外的声明文件。** 靠的是**函数名约定**：C++ 函数名必须是 `Java_包名_类名_方法名`，JVM 加载 SO 后按这个规则自动匹配。不需要任何中间文件。
>
> 以前有个 `javah` 工具可以根据 Java 类自动生成 `.h` 头文件（方便 IDE 补全），但这只是辅助，不是必需的。现在用 `javac -h` 替代，但大多数人直接手写。
>
> **Q: 底层是统一用 ABI 还是 C 函数？**
> 
> **是 C 函数调用约定（C ABI）。** 这就是为什么必须加 `extern "C"`：
> - C++ 有 name mangling（同名函数重载会改名），JVM 找不到
> - `extern "C"` 告诉编译器用 C 的命名规则（函数名不变），JVM 才能按约定名找到
>
> 本质：JVM 加载 `.so` → `dlsym()` 按函数名查找符号 → 找到 C 函数指针 → 调用。和动态库的标准用法一样。

```kotlin
class NativeLib {
    external fun add(a: Int, b: Int): Int  // 实现在 C++
    companion object { init { System.loadLibrary("mylib") } }
}
```

```cpp
extern "C" JNIEXPORT jint JNICALL
Java_com_example_NativeLib_add(JNIEnv* env, jobject thiz, jint a, jint b) {
    return a + b;
}
```

**方向2：C++ → Java（反射调用，需要找类 + 找方法 + 调用）**
- C++
- 核心是: [JNIEnv](#注释jnienv) 这个JNI 在第一个参数注入的JNI, 用它才能通过反射调用java/kotlin的方法

```cpp
void callJavaFromCpp(JNIEnv* env, jobject javaObject) {
    jclass clazz = env->FindClass("com/example/MyCallback");
    jmethodID method = env->GetMethodID(clazz, "onResult", "(Ljava/lang/String;)V");
    env->CallVoidMethod(javaObject, method, env->NewStringUTF("hello from C++"));
}
```

### Q: JNI 在 TurboModule 中的角色是什么？

```
JS → JSI(C++) → JNI → Java/Kotlin
                 ↑
              这一步就是 JNI
```

JSI 解决 JS ↔ C++ 通信，JNI 解决 C++ ↔ Java 通信。TurboModule 的 Codegen 自动生成了 JNI 胶水代码，所以你不需要手写。

### Q: 为什么需要 JNI？直接调不行吗？

因为 Java 运行在 JVM（有自己的堆 + GC），C++ 直接操作内存。两个世界不能直接互通：
1. **类型不同**：Java `String` 和 C++ `std::string` 内存布局完全不一样
2. **内存管理不同**：Java 有 GC 自动回收，C++ 要手动管理
3. **方法查找不同**：C++ 不知道 Java 的类和方法在哪里

JNI 就是做这三件事的桥梁。

### Q: iOS 为什么不需要 JNI？

| | Android | iOS |
|--|---------|-----|
| C++ 调 Native | 必须 JNI（JVM 隔离） | 直接混编（ObjC 是 C 超集） |
| 文件 | `.cpp` + `.kt`（分开写） | `.mm`（ObjC++ 一个文件混合写） |
| 类型转换 | 手动（`jstring` ↔ `std::string`） | 自动（`NSString` 和 C++ 共存） |

Objective-C 本身就是 C 的超集，天然能和 C++ 代码混合编译。所以 iOS 侧 TurboModule 的 Codegen 只需要简单的 ObjC++ 胶水，不需要 JNI 那套反射机制。


---

## 注释：核心概念

### 注释：JNIEnv

**`JNIEnv*` = C++ 操作 Java 世界的唯一入口句柄。**

JVM 在每次调用 C++ 函数时自动注入为第一个参数。

```cpp
// 通过 env 能做的所有事（核心 API）：
env->FindClass(...)           // 找类
env->GetMethodID(...)         // 找方法
env->CallVoidMethod(...)      // 调用 Java 方法
env->NewStringUTF(...)        // 创建 Java String
env->GetStringUTFChars(...)   // 读取 Java String
env->NewByteArray(...)        // 创建 Java byte[]
env->ThrowNew(...)            // 抛 Java 异常
env->NewGlobalRef(...)        // 创建全局引用（防 GC 回收）
```

**类比：**

```
jsi::Runtime  → C++ 操作 JS 世界的入口
JNIEnv*       → C++ 操作 Java 世界的入口
```

**注意**：线程绑定，不能跨线程传递。另一个线程需要 `JavaVM->AttachCurrentThread()` 获取自己的 `JNIEnv`。
