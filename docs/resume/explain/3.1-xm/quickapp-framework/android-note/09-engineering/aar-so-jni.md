# AAR / SO / JNI 构建指南

## 目录

- [AAR](#aar)
- [SO（Native 共享库）](#sonative-共享库)
- [JNI](#jni)

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
