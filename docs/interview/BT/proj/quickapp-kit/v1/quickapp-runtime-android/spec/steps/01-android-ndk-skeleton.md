# Step 1: 用 Android Studio 创建 NDK 项目

## 目录

- [Step 1.1：用 AS 创建项目](#step-11用-as-创建项目)
- [Step 1.2：创建 C++ 文件](#step-12创建-c-文件)
- [Step 1.3：验收](#step-13验收)
- [技术决策](#技术决策)
  - [1. Android NDK 作为第一阶段真实宿主](#技术决策1-android-ndk-作为第一阶段真实宿主)
  - [2. Core 与平台层分离](#技术决策2-core-与平台层分离)
  - [3. 使用动态库和 arm64-v8a](#技术决策3-使用动态库和-arm64-v8a)
  - [4. APK 先行，AAR 后置](#技术决策4-apk-先行aar-后置)
- [QA](#qa)
  - [1. 编译时报错 - Could not resolve com.android.tools:repository](#qa1-gradle-repository)
  - [2. compileSdk 版本和依赖库要求不匹配](#qa2-compilesdk-version)
  - [3. Gradle plugins 和 alias 的作用](#qa3-gradle-plugins-alias)
  - [4. 什么是 Include Guard（防重包含）](#qa4-include-guard)
  - [5. #include 中尖括号 <> 和引号 "" 的区别](#qa5-include-syntax)
  - [6. 为什么是 Java 11？谁定的？需要本地对齐吗？](#qa6-java-version)
  - [7. Lint 是什么？为什么有问题？](#qa7-lint-tool)
  - [8. Android NDK 编译链：为什么有这么多中间文件？](#qa8-ndk-build-chain)
  - [9. build/ 目录里都有什么？不只是 C++？](#qa9-build-directory)

---

## Step 1.1：用 AS 创建项目

1. 打开 Android Studio
2. File → New → New Project
3. 选择 **Empty Activity**
4. Project name: `QuickAppRuntimeAndroid`
5. Package name: `com.quickappkit.runtime`
6. Minimum SDK: **24**
7. Language: **Kotlin**
8. Build configuration language: **Kotlin DSL**
9. Finish

创建完后，Android Studio 会自动生成项目结构和 build.gradle.kts 文件。

### 验证和运行

1. **Build → Make Project**（编译）
2. 等待编译完成（看 Build 窗口显示 `BUILD SUCCESSFUL`）
3. **Run → Run 'app'**（或点击绿色播放按钮）
4. 选择模拟器或真机

应该看到空白的 Android 应用启动。

---

## Step 1.2：创建 C++ 文件

**在开始前：** 确保 Aliyun 镜像已配置（见下面 [QA 部分](#qa1-gradle-repository)）。如果你在 Step 1.1 后编译失败，先应用 [QA 中的镜像配置](#qa1-gradle-repository)，然后 `Build → Clean Project` → `Build → Make Project`。

### 1.2.1：添加 C++ 支持

在项目窗口中，按这个路径创建文件夹结构：

1. 右键点击 `app` → `New → Folder`
2. 输入路径：`src/main/cpp/core/include`（AS 会自动创建嵌套）
3. 再创建一个：`src/main/cpp/core/src`
4. 再创建一个：`src/main/cpp/platform/android`

**最终结构：**
```
app/src/main/cpp/
├── core/
│   ├── include/        # C++ 头文件（接口）
│   └── src/            # C++ 实现
└── platform/
    └── android/        # Android 平台特定代码（JNI）
```

### 1.2.2：创建 3 个文件

**文件 1：** `app/src/main/cpp/CMakeLists.txt`

```cmake
# CMake 的最低版本要求。这是 Android NDK 官方推荐的版本
cmake_minimum_required(VERSION 3.22)

# 定义项目名称。这个名字会作为默认的库名（如果没有显式指定）
project(quickapp-runtime-core)

# 指定 C++ 编译标准为 C++17
# 原因：需要用到 std::optional、std::variant 等 C++17 特性
set(CMAKE_CXX_STANDARD 17)

# 声明编译一个动态库（SHARED）叫 quickapp-runtime-core
# 源文件暂时只有 jni_bridge.cpp
# 后续会添加更多 core/src/ 下的文件
add_library(quickapp-runtime-core SHARED
    platform/android/jni_bridge.cpp
)

# 配置编译器搜索头文件的路径
# ${CMAKE_CURRENT_SOURCE_DIR} 就是 CMakeLists.txt 所在目录（app/src/main/cpp/）
# PRIVATE 表示这个头文件搜索路径仅对 quickapp-runtime-core 库有效，不传给依赖它的其他库
target_include_directories(quickapp-runtime-core PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/core/include
)

# 链接 Android 的 log 库
# 原因：jni_bridge.cpp 中使用 __android_log_print() 需要这个库
# Android 是动态库，Gradle 会自动提供
target_link_libraries(quickapp-runtime-core log)
```

**文件 2：** `app/src/main/cpp/core/include/platform_bridge.h`

```cpp
// 防止头文件被重复包含（Include Guard）
// 问题：如果多个 .cpp 文件 #include "platform_bridge.h"，
//      或同一个文件间接包含了它多次，会导致 struct 重复定义，编译失败
// 解决：用宏作为"已处理标记"，第一次包含时定义，之后的包含会被跳过
#ifndef QUICKAPP_PLATFORM_BRIDGE_H // 检查：这个宏有没有被定义过？
#define QUICKAPP_PLATFORM_BRIDGE_H // 第一次包含时，定义这个宏

// 定义一个命名空间，避免符号冲突
namespace quickapp {

// PlatformBridge 是一个结构体，用来定义 C++ 与平台层（Android JNI）的通信接口
// 现在是占位符，暂时为空
// 后续会添加平台渲染命令处理函数：
// - void (*createElement)(int id, const char* type, ...)
// - void (*setAttr)(int id, const char* key, const char* value)
// - void (*setStyle)(int id, const char* key, const char* value)
// 这些函数会由 Android JNI 适配为 Kotlin ViewRenderer 的命令调用。
struct PlatformBridge {
    // 暂时为空，等 Step 2 时实现
};

} // 关闭 quickapp 命名空间

// #endif 结束防重包含条件块
// 作用：标记 #ifndef 条件编译的结束位置
#endif
```

**文件 3：** `app/src/main/cpp/platform/android/jni_bridge.cpp`

```cpp
// 引入 JNI 头文件
// <jni.h> 用尖括号表示这是系统库（Android NDK 内置提供）
// 编译器会在系统库路径（$NDK_HOME/toolchains/.../include）中搜索
#include <jni.h>

// 引入 Android 日志库头文件（__android_log_print 需要）
// <android/log.h> 同样是系统库，由 Android NDK 提供
#include <android/log.h>

// 定义日志标签，作为日志输出的标识符
#define LOG_TAG "quickapp-core"

// 定义一个宏，简化日志输出
// ... 表示可变参数（任意数量、任意类型的参数）
// __VA_ARGS__ 是预处理器内置的宏，代表所有可变参数的内容
// 
// 用法示例：
//   LOGI("NDK loaded");              → __VA_ARGS__ = "NDK loaded"
//   LOGI("Value: %d", 42);           → __VA_ARGS__ = "Value: %d", 42
//   LOGI("x=%d, y=%s", 10, "hello"); → __VA_ARGS__ = "x=%d, y=%s", 10, "hello"
//
// ANDROID_LOG_INFO 表示信息级别日志
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

// extern "C" 表示下面的代码使用 C 语言的名字修饰规则（不使用 C++ 的）
// 原因：JNI 虚拟机期望找到 C 风格的函数名，不能是 C++ 的 mangled 名称
extern "C" {

// JNI_OnLoad 是 JNI 的特殊生命周期函数
// 当 Java 代码通过 System.loadLibrary("quickapp-runtime-core") 加载这个 .so 时，
// JVM 会自动调用这个函数（如果存在）
// 
// 参数：
//   JavaVM* vm      - Java 虚拟机指针，用来与 Java 交互
//   void* reserved  - 保留参数，通常不使用
//
// 返回值：
//   JNI_VERSION_1_6 - 表示我们支持的 JNI 版本（1.6 是最低版本）
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
    // 打印日志，表示 NDK 库已成功加载
    LOGI("NDK loaded");
    
    // 返回 JNI 版本
    return JNI_VERSION_1_6;
}


// 关闭 extern "C" 块
} // extern "C"
```

### 1.2.3：修改 build.gradle.kts

在 `app/build.gradle.kts` 中的 `android {}` 块中添加 NDK 编译配置：

```kotlin
android {
    // 编译 SDK 版本（已在前面改为 36）
    compileSdk = 36

    defaultConfig {
        applicationId = "com.quickappkit.runtime"
        minSdk = 24
        // 目标 SDK 版本（运行时行为的优化目标）
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        // NDK 配置：指定要编译的 CPU 架构
        ndk {
            // arm64-v8a 是 64 位 ARM 架构（2023 年后新手机主流）
            // 其他选项：armeabi-v7a（32 位），x86_64（模拟器），x86（模拟器）
            abiFilters.add("arm64-v8a")
        }
    }

    // 配置 CMake 作为 C++ 的编译系统
    externalNativeBuild {
        cmake {
            // CMakeLists.txt 的路径（相对于 app 模块）
            path = file("src/main/cpp/CMakeLists.txt")
            // CMake 的版本
            version = "3.22.1"
        }
    }

    // Java 编译选项
    compileOptions {
        // sourceCompatibility：生成的 .class 文件兼容的最低 Java 版本
        // 设为 11 表示"代码要能跑在 Java 11+ 的虚拟机上"
        // 这个值由 Gradle 插件和 Android 官方建议决定
        sourceCompatibility = JavaVersion.VERSION_11
        
        // targetCompatibility：同上（通常和 sourceCompatibility 一致）
        targetCompatibility = JavaVersion.VERSION_11
    }

    // Kotlin 编译选项
    kotlinOptions {
        // jvmTarget：编译后的 Kotlin 字节码面向的 JVM 版本
        // 同样是 11（要和 sourceCompatibility 对应）
        // 注意：你本地的 JDK 版本可以更新（如 17 或 21），
        //      因为新版 JDK 可以编译旧版本的目标代码
        jvmTarget = "11"
    }
}

### 项目依赖

当前工程使用 Android Studio 生成的 Compose 模板，因此保留现有 `androidx.activity`、Compose 和 Material 依赖即可。

**不要为了 Step 1 额外添加 AppCompat 或 ConstraintLayout。** Step 1 只验证 Android 宿主、CMake、NDK 和 `.so` 打包；Step 2 使用 `AndroidView` 挂载 Runtime 容器，仍不需要新增这两个依赖。
```

---

## Step 1.3：验收

**本 Step 的验收边界：**

```text
本 Step：CMake 编译成功 → libquickapp-runtime-core.so 生成 → .so 打包进 APK
Step 2：System.loadLibrary → JNI_OnLoad → Kotlin 调用 native 方法 → View 显示
```

当前工程对账结果是：构建和 APK 打包已完成；运行时加载、JNI 方法调用和屏幕显示尚未完成，属于 Step 2。

### 构建验收

1. Android Studio → Build → assemble app run (新版 AS 的名称)
2. 或者命令行：`./gradlew clean build`

看到 `BUILD SUCCESSFUL`，只能说明 Gradle、CMake 和 NDK 编译链路通过；还不能说明 App 运行时已经加载 `.so`。

### 检查 .so 文件

最重要的验收步骤。.so 文件会出现在多个位置，检查以下路径：

**方法 1：命令行检查**

```bash
find app/build -name "libquickapp-runtime-core.so"
```

应该有多个输出，表示编译成功。关键位置：

```
app/build/intermediates/cxx/Debug/xxx/obj/arm64-v8a/libquickapp-runtime-core.so
                       ↑ 调试版本编译目录

app/build/intermediates/cxx/Release/xxx/obj/arm64-v8a/libquickapp-runtime-core.so
                       ↑ 发布版本编译目录

app/build/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib/arm64-v8a/libquickapp-runtime-core.so
                       ↑ 最终打包到 APK 的位置
```

**方法 2：AS 中检查**

1. Build → Rebuild Project（清理后重新编译）
2. 打开 Build 窗口，看最后输出
3. 如果有 `libquickapp-runtime-core.so` 相关的编译消息，说明成功了

**文件检查清单**

- ✅ `app/build/intermediates/cxx/Debug/.../obj/arm64-v8a/libquickapp-runtime-core.so` - 存在 = 调试版本 C++ 编译成功
- ✅ `app/build/intermediates/cxx/Release/.../obj/arm64-v8a/libquickapp-runtime-core.so` - 存在 = 发布版本 C++ 编译成功
- ✅ `app/build/intermediates/merged_native_libs/debug/.../lib/arm64-v8a/libquickapp-runtime-core.so` - 存在 = `.so` 已准备好打包进 Debug APK
- ✅ `app/build/intermediates/merged_native_libs/release/.../lib/arm64-v8a/libquickapp-runtime-core.so` - 存在 = `.so` 已准备好打包进 Release APK

**Step 1 构建验收结论：** 上述文件存在即可证明 NDK 编译产物已生成并进入 APK 打包流程；不要把它等同于运行时 `System.loadLibrary` 成功。

**为什么有这么多地方？**

- `cxx/.../obj/` - CMake 编译的中间产物（原始的 .o 目标文件和 .so）
- `merged_native_libs/` - Gradle 合并 native 库的阶段
- `stripped_native_libs/` - 移除调试符号的版本（发布时用）
- `released/` - 最终打包的 .so

这些都是 Android NDK 编译链的正常过程。只要 `merged_native_libs` 里有 .so，说明会被打进 APK。

---

## 技术决策

这一节只记录本 Step 已经做出的工程决策，详细架构背景放在设计文档中。

### 技术决策 1：Android NDK 作为第一阶段真实宿主

- [总体三层架构](../design.md#整体架构)：Android 是第一阶段的真实运行宿主，不先维护脱离最终环境的纯 C++ Demo。
- [开发阶段目录与产品目录](../design.md#directory-structure)：`core/` 先放在 Android 工程内，验证完成后再抽取为独立 Core 仓库。
- [Task 1.1 任务定义](../tasks.md#task-11android-宿主与-ndk-构建骨架)：本 Step 的验收目标是 NDK 编译成功并将 `.so` 打包进 APK；运行时加载属于 Step 2。

### 技术决策 2：Core 与平台层分离

- [C++ Core 模块](../design.md#c-core-模块)：Core 负责未来的 JS 引擎、RPK、VNode、布局和路由。
- [Android Platform Layer](../design.md#android-platform-layer)：Android 只负责 JNI、ViewRenderer 和系统能力适配。
- [跨平台 Core 设计](../design.md#cross-platform-core-design)：Core 后续由 Android、iOS、LVGL 共同消费。

### 技术决策 3：使用动态库和 arm64-v8a

- [跨平台 Core 产物](../design.md#cross-platform-core-design)：Android 使用 `.so` 动态库，运行时通过 `System.loadLibrary` 加载。
- 当前先编译 `arm64-v8a`，因为它是现代 Android 设备的主要 ABI；其他 ABI 在需要模拟器或兼容旧设备时再加入。
- 动态库让 Core 可以独立编译、替换和最终抽取为 AAR 内的 native 产物。

### 技术决策 4：APK 先行，AAR 后置

- [关键决策](../design.md#key-decisions)：第一阶段先用单 APK 验证完整链路，避免一开始同时处理库发布、宿主接入和运行时调试问题。
- 后续完成 Android Runtime 验证后，再抽取为 `quickapp-runtime.aar`；这属于产品化阶段，不影响当前 NDK 骨架。

---

## QA

<a id="qa1-gradle-repository"></a>
### 1. 编译时报错 - Could not resolve com.android.tools:repository

**症状：**

```
Caused by: org.gradle.internal.resolve.ModuleVersionResolveException: Could not resolve com.android.tools:repository:31.7.2
Caused by: javax.net.ssl.SSLHandshakeException: Remote host terminated the handshake
```

**原因：** 网络问题或 VPN 导致 Google Maven 仓库连接失败

**解决：** 在 `settings.gradle.kts` 中配置国内阿里云镜像源

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/central") }
        mavenCentral()
    }
}
```

然后 `Build → Clean Project`，再 `Build → Make Project`

---

<a id="qa2-compilesdk-version"></a>
### 2. compileSdk 版本和依赖库要求不匹配

**症状：**

```
Task :app:checkDebugAarMetadata FAILED

A failure occurred while executing com.android.build.gradle.internal.tasks.CheckAarMetadataWorkAction
> 2 issues were found when checking AAR metadata:
    1. Dependency 'androidx.core:core:1.16.0' requires libraries and applications that
       depend on it to compile against version 35 or later of the Android APIs.
       :app is currently compiled against android-34.
```

**原因：** AS 默认生成的模板用 API 34，但最新的 androidx 依赖库要求 API 35+

**解决：** 在 `app/build.gradle.kts` 中改为最新的 API 版本

```kotlin
android {
    compileSdk = 36  // 改成最新的 API 36
    
    defaultConfig {
        targetSdk = 36  // 保持一致
    }
}
```

**关键概念：**

- **compileSdk** - 用哪个 Android API 版本的 SDK 编译代码。新版本 SDK 才能编译新 API 的代码
- **targetSdk** - 告诉 Android 系统这个 app 针对哪个 API 版本优化。一般和 compileSdk 一致
- **minSdk** - app 支持的最低 API 版本（决定能运行在哪些手机上）

选择 compileSdk 的规则：`max(minSdk 最低版本, 依赖库要求的最小版本)`

---

<a id="qa3-gradle-plugins-alias"></a>
### 3. Gradle plugins 和 alias 的作用

**plugins 块的含义：**

```kotlin
plugins {
    alias(libs.plugins.android.application)  // Android App 编译插件
    alias(libs.plugins.kotlin.android)       // Kotlin 语言支持
    alias(libs.plugins.kotlin.compose)       // Compose UI 框架支持
}
```

每个 plugin 都是一个编译工具，在编译时介入编译过程：

- `android.application` - 告诉 Gradle 这是 Android App 项目，提供编译 APK 的能力
- `kotlin.android` - 支持用 Kotlin 语言写代码
- `kotlin.compose` - 支持 Jetpack Compose UI 框架，提供 Compose 编译优化

**alias 的作用：**

`alias()` 是别名机制。真实的 plugin ID 很长（如 `org.jetbrains.kotlin.plugin.compose`），版本号也要管理。

Gradle 在 `gradle/libs.versions.toml` 中集中定义：

```toml
[plugins]
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }

[versions]
kotlin = "2.0.0"
```

这样 `build.gradle.kts` 中只需写 `alias(libs.plugins.kotlin.compose)`，好处是：
- 版本号集中管理，改一个地方所有模块都更新
- 避免手写长的 plugin ID 导致拼写错误

**buildFeatures 的作用：**

```kotlin
buildFeatures {
    compose = true  // 启用 Compose UI 框架编译支持
}
```

Gradle 有很多可选特性，通过 `buildFeatures` 启用或关闭。启用后才会用对应的编译器插件和优化


---

<a id="qa4-include-guard"></a>
### 4. 什么是 Include Guard（防重包含）

**问题场景：**

如果多个 C++ 文件都 `#include "platform_bridge.h"`，或同一个文件间接包含了它多次，会发生什么？

```cpp
// main.cpp
#include "platform_bridge.h"
#include "other.h"

// other.h
#include "platform_bridge.h"   // 间接导致 platform_bridge.h 被包含 2 次

// 结果：struct PlatformBridge 被定义了 2 次
// 编译错误：error: redefinition of 'struct PlatformBridge'
```

**Include Guard 的工作原理：**

```cpp
#ifndef QUICKAPP_PLATFORM_BRIDGE_H    // 第 1 次包含：条件为真，执行下面的代码
#define QUICKAPP_PLATFORM_BRIDGE_H    // 定义宏作为"已处理标记"

namespace quickapp {
    struct PlatformBridge { ... };
}

#endif
```

**第二次包含时：**

```cpp
#ifndef QUICKAPP_PLATFORM_BRIDGE_H    // 第 2 次包含：QUICKAPP_PLATFORM_BRIDGE_H 已定义，条件为假
                                      // 编译器跳过 #ifndef 到 #endif 之间的所有代码
#define QUICKAPP_PLATFORM_BRIDGE_H
...
#endif
```

**本质：**

Include Guard 是一个 **条件编译** 技巧，用宏作为"开关"来记录"这个头文件已经被处理过"。这样即使被包含多次，定义也只执行一次。

**现代替代方案：**

许多编译器（包括 Android NDK）支持 `#pragma once`，功能相同但更简洁：

```cpp
#pragma once

namespace quickapp {
    struct PlatformBridge { ... };
}
```

但为了最大兼容性，推荐用传统的 `#ifndef` 方式。


---

<a id="qa5-include-syntax"></a>
### 5. #include 中尖括号 <> 和引号 "" 的区别

**问题：** 为什么有时用 `#include <jni.h>`，有时用 `#include "platform_bridge.h"`？

**答案：** 编译器搜索头文件的位置不同。

| 写法 | 搜索位置 | 来源 | 举例 |
|-----|--------|------|------|
| `#include <...>` | 系统库路径 | Android NDK、操作系统标准库 | `<jni.h>`, `<android/log.h>`, `<stdio.h>` |
| `#include "..."` | 项目内路径 + 系统库路径 | 你自己写的代码文件 | `"platform_bridge.h"`, `"core/include/router.h"` |

**搜索过程：**

```
#include <jni.h>
  ↓
编译器只在系统库路径搜索：
  $NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/jni.h
  
#include "platform_bridge.h"
  ↓
编译器先在项目内搜索：
  1. app/src/main/cpp/platform/android/  (当前目录)
  2. 其他 CMakeLists.txt 配置的搜索路径
  3. 最后才在系统库路径搜索
```

**规则：**

- **系统库、第三方库**：用 `<>`
- **项目内的文件**：用 `""`

**为什么这样设计：**

- 用 `<>` 能让编译器快速找到系统库（不用在项目里搜索）
- 用 `""` 优先在项目里找，避免项目文件被系统库覆盖
- 这个设计保证了项目代码的优先级高于系统库

---

<a id="qa6-java-version"></a>
### 6. 为什么是 Java 11？谁定的？需要本地对齐吗？

**问题背景：**

```kotlin
compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}

kotlinOptions {
    jvmTarget = "11"
}
```

为什么这里是 11？这是谁定的？我的 JDK 版本可以不同吗？

**答案：Java 版本有两个不同的概念**

| 概念 | 含义 | 在代码里的表现 | 能否不同 |
|-----|-----|-------------|--------|
| **编译目标版本** (sourceCompatibility / jvmTarget) | 编译后的 .class 字节码**兼容**的最低 JVM 版本 | 写在 build.gradle.kts，决定生成什么版本的字节码 | ❌ 由依赖库要求决定 |
| **本地 JDK 版本** (开发机上的 JDK) | 你本地用来编译代码的 JDK 版本 | 你电脑上装的 Java 版本 | ✅ 可以更新，只要 >= 编译目标版本 |

**为什么设为 11？**

Java 11 是 **LTS 版本**（长期支持，2018 年发布，支持到 2026 年）。

Android Studio 官方建议：
- 最少用 Java 11（为了支持旧手机）
- 但你本地可以装 Java 17、21 等新版本

选择 11 的原因：
1. **向后兼容** - Android 生态中还有大量 API 只支持到 Java 11
2. **稳定性** - 11 已经非常成熟，很少有坑
3. **官方推荐** - Google 在 AS 创建新项目时默认用 11

**你本地的 JDK 版本需要对齐吗？**

❌ **不需要完全相同**，但要满足：**本地 JDK 版本 >= 编译目标版本**

举例：
- ✅ 本地 JDK 17，编译目标 11 → OK（新 JDK 能编译旧版本字节码）
- ✅ 本地 JDK 21，编译目标 11 → OK（21 完全兼容）
- ❌ 本地 JDK 8，编译目标 11 → 失败（旧 JDK 不能编译新版本的特性）

**总结：**

- **设为 11** 是 Android 官方的稳定选择，别改
- **你本地的 JDK** 可以更新到最新版（17、21 都可以），Gradle 会自动用它来编译成 11 版本的字节码
- **本质** - Gradle 把你写的 Kotlin/Java 代码用本地 JDK 编译成向后兼容 Java 11 的字节码

---

<a id="qa8-ndk-build-chain"></a>
### 8. Android NDK 编译链：为什么有这么多中间文件？

**问题：** 为什么 `build/` 目录下有这么多地方都有 `.so` 文件？最终 APK 里只需要一个 .so，为什么不直接生成？

**答案：** Android 的编译链是 **多阶段流水线**，每个阶段产生中间产物供下一阶段使用。

**编译链的 5 个关键阶段：**

```
阶段 1: CMake 编译
  C++ 源代码 (jni_bridge.cpp) 
       ↓
     clang++ 编译器（NDK 提供）
       ↓
  生成中间文件: .o（目标文件）
       ↓
  链接成动态库
       ↓
  输出位置: app/build/intermediates/cxx/Debug/xxx/obj/arm64-v8a/libquickapp-runtime-core.so
           这是 CMake 的最终输出，"原始的" .so


阶段 2: Gradle 合并 Native 库
  多个 .so 文件（可能来自不同模块或依赖）
       ↓
  Gradle 的 mergeNativeLibs 任务合并它们
       ↓
  输出位置: app/build/intermediates/merged_native_libs/debug/.../lib/arm64-v8a/libquickapp-runtime-core.so
           这是合并后的 .so，"整理过的" .so


阶段 3: 移除调试符号（仅发布版本）
  合并后的 .so
       ↓
  strip 工具移除调试符号（减小文件大小）
       ↓
  输出位置: app/build/intermediates/stripped_native_libs/release/.../lib/arm64-v8a/libquickapp-runtime-core.so
           这是 "去肥版" .so，可以用 Release APK


阶段 4: 打包进 APK
  最终的 .so
       ↓
  Gradle 的 packageXxx 任务
       ↓
  输出位置: APK 内部的 lib/arm64-v8a/libquickapp-runtime-core.so
           （可以用 unzip 查看 APK 的内容）


阶段 5: 安装到手机
  APK
       ↓
  adb install
       ↓
  手机系统解包 APK，提取 .so 到应用私有目录
       ↓
  /data/app/com.quickappkit.runtime/lib/arm64-v8a/libquickapp-runtime-core.so
```

**为什么要这样设计？**

1. **模块化** - 项目可能有多个 native 库（比如引入第三方 SDK 也有 .so），Gradle 需要把它们统一放在一起
2. **多配置** - Debug 和 Release 版本的 .so 不同（Release 要去掉调试符号）
3. **多架构** - 同时编译 arm64-v8a、armeabi-v7a、x86_64 等多个架构，要分别管理
4. **增量编译** - 如果你只改了 Java 代码，C++ 的 .so 可以复用，不用重新编译
5. **可复现性** - 每个阶段都有明确的输入输出，便于调试和优化

**最终 APK 里只有一份 .so**

当你执行 `./gradlew assembleDebug` 时：
- Debug APK 包含：`lib/arm64-v8a/libquickapp-runtime-core.so`（没有移除符号）
- Release APK 包含：`lib/arm64-v8a/libquickapp-runtime-core.so`（移除了符号，更小）

验证方法：
```bash
unzip -l app/build/outputs/apk/debug/app-debug.apk | grep libquickapp
# 输出：
#   lib/arm64-v8a/libquickapp-runtime-core.so
```

**总结：**

`build/` 里的多个 .so 文件不是"重复"，而是编译流水线的 **中间产物**。只有 `merged_native_libs` 里的 .so 会被打进 APK，其他的都是过程中的临时文件。下次清理编译时（`clean`）这些都会删除。

---

<a id="qa9-build-directory"></a>
### 9. build/ 目录里都有什么？不只是 C++？

**问题：** build/ 是不是只有 .so 文件？还有 Java/Kotlin 的产物吗？

**答案：** build/ 里的内容 **远远超过 C++**。它包含 **整个 Android App 的编译产物**。

**build/ 目录的主要内容（按编译流水线顺序）：**

```
app/build/intermediates/
│
├── 📄 Java/Kotlin 产物
│   ├── compile_app_classes_jar/           # Java/Kotlin 编译后的 .class 文件集合
│   ├── classes/ (debug/release)           # 各个 .class 文件
│   ├── project_dex_archive/               # DEX 文件（Java 字节码转成 Android 格式）
│   │   ├── debug/dexBuilder.../out/*.dex  # 每个 Kotlin 类转成一个 DEX
│   │   └── release/dexBuilder.../out/*.dex
│   └── dex/ (debug/release)               # 最终合并的 DEX 文件
│       └── classes.dex                    # 最终的主 DEX（会被打进 APK）
│
├── 🔧 C++ 产物
│   ├── cxx/                               # CMake 编译目录
│   │   ├── Debug/.../obj/arm64-v8a/       # 调试版本的 .so
│   │   └── Release/.../obj/arm64-v8a/     # 发布版本的 .so
│   ├── merged_native_libs/                # 合并后的 native 库
│   │   ├── debug/.../lib/arm64-v8a/       # 打进 Debug APK
│   │   └── release/.../lib/arm64-v8a/     # 打进 Release APK
│   └── stripped_native_libs/              # 去掉调试符号的版本
│       └── release/.../lib/arm64-v8a/     # 发布版本用
│
├── 📦 资源产物
│   ├── resources/                         # Java 资源文件（strings.xml 等）
│   ├── assets/                            # App Assets（图片、数据文件等）
│   └── merged_manifests/                  # 合并后的 AndroidManifest.xml
│
├── 📱 APK 产物
│   ├── apk/                               # 最终的 APK 文件
│   │   ├── debug/app-debug.apk            # 调试版本 APK
│   │   └── release/app-release.apk        # 发布版本 APK
│   └── bundle/                            # Google Play Bundle 格式（可选）
│
└── 🔍 分析产物
    ├── lint_model/                        # Lint 检查的模型
    ├── lint_partial_results/              # Lint 检查结果
    ├── manifest_merge_report/             # Manifest 合并报告
    └── proguard_mapping/                  # 混淆映射表（Release 时生成）
```

**最终 APK 的结构（可以用 unzip 查看）：**

```bash
unzip -l app/build/outputs/apk/debug/app-debug.apk
```

输出：
```
Archive:  app-debug.apk
  Length      Date    Time    Name
---------  ---------- -----   ----
     1024  2026-07-27 15:20   AndroidManifest.xml          ← Manifest
    12345  2026-07-27 15:20   classes.dex                  ← Java 字节码
    56789  2026-07-27 15:20   resources.arsc                ← 资源
    98765  2026-07-27 15:20   lib/arm64-v8a/libquickapp-runtime-core.so  ← C++ .so
    54321  2026-07-27 15:20   assets/...                   ← 资源文件
```

**build/ 和最终 APK 的关系：**

| 文件/文件夹 | 位置 | 来自 build/ 的什么位置 | 用途 |
|----------|------|-------------------|------|
| classes.dex | APK 内根目录 | `project_dex_archive/debug/.../classes.dex` | Java/Kotlin 代码执行 |
| libquickapp-runtime-core.so | APK/lib/arm64-v8a/ | `merged_native_libs/debug/.../lib/arm64-v8a/` | C++ 代码执行 |
| resources.arsc | APK 内根目录 | `compiled_resources/.../` | 字符串、颜色、尺寸等资源 |
| AndroidManifest.xml | APK 内根目录 | `merged_manifests/.../` | App 配置（权限、Activity 等） |

**build/ 的大小对比：**

```bash
du -sh app/build/                    # 整个 build 目录（可能 GB 级）
du -sh app/build/outputs/apk/debug/  # 最终的 APK（通常 MB 级）
```

build/ 很大是正常的，因为它保存了中间产物用于增量编译。每次 `clean` 都会删除它。

**总结：**

`build/` 是 **整个 Gradle 编译流水线的产物仓库**，包括：
- ✅ Java/Kotlin 代码 → .class → .dex
- ✅ C++ 代码 → .o → .so
- ✅ 资源文件、Manifest、配置
- ✅ 最终的 APK 文件

这些中间文件存在是为了 **增量编译**（只重新编译改动的部分）和 **并行构建**（多个任务同时运行）。

---

<a id="qa7-lint-tool"></a>
### 7. Lint 是什么？为什么有问题？

**Lint 是什么？**

Lint 是 Android 提供的 **代码静态检查工具**。它在编译时扫描你的代码，寻找：
- 可能的 bug（如空指针、类型错误）
- 代码风格问题（如未使用的变量）
- API 使用不当（如调用已废弃的方法）
- 内存泄漏风险
- 权限相关问题

**运作流程：**

```
编译过程：
  Gradle 编译 Java/Kotlin 代码 → Lint 扫描 → 生成警告/错误 → 打包 APK
  
你写代码 → javac/kotlinc 编译 → Lint 检查 → 如果有问题停止编译
```

**和 NDK C++ 的关系：**

Lint 主要检查 Java/Kotlin 代码，不检查 C++。但它会扫描所有源文件，包括 MainActivity.kt。

---

**为什么这次有问题？**

你遇到的错误：

```
Found class org.jetbrains.kotlin.analysis.api.resolution.KaCallableMemberCall, 
but interface was expected

IncompatibleClassChangeError: NonNullableMutableLiveDataDetector
```

**根本原因：** Lint 内部的一个检查器（`NonNullableMutableLiveDataDetector`）有 bug

- `NonNullableMutableLiveDataDetector` 是 AndroidX Lifecycle 库提供的 Lint 插件
- 它用来检查 LiveData 的空安全问题
- 但这个检查器和你项目的 Kotlin 版本/Lifecycle 版本不兼容
- 导致在 Lint 扫描时崩溃

**不是你的代码问题** - 你的 C++ 代码完全没错，是 Lint 工具链本身的版本冲突。

---

**解决方法：禁用这个有问题的检查器**

在 `app/build.gradle.kts` 的 `android {}` 块中添加：

```kotlin
android {
    // 其他配置...
    
    lint {
        // 禁用有问题的 LiveData 空安全检查
        disable("NullSafeMutableLiveData")
    }
}
```

**原理：**
- Lint 有很多检查器，每个都有一个 ID
- `NullSafeMutableLiveData` 是那个有 bug 的检查器的 ID
- 禁用它后，编译时 Lint 就跳过这个检查器，只运行其他正常的检查器

**影响：**
- ✅ 编译能继续进行
- ✅ 其他 Lint 检查仍然有效
- ⚠️ 你可能会错过一些 LiveData 相关的真实问题
- 但对于这个项目（暂时只有空 Activity）完全无所谓

**更新版本时可能修复：**
- Google 通常会在后续版本修复这个不兼容问题
- 到时候可以删除这行 disable 配置
- 但现在暂时禁用是最快的解决方案
