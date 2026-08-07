# Step 2：实现 PlatformBridge 与 JNI 最小闭环

## 目录

- [目标](#目标)
- [Step 2.1：扩展 PlatformBridge Core 接口](#step-21扩展-platformbridge-core-接口)
  - [2.1.1：创建 platform_bridge.h](#211创建-platform_bridgeh)
  - [2.1.2：创建 platform_bridge.cpp](#212创建-platform_bridgecpp)
  - [2.1.3：把 Core 文件加入 CMake](#213把-core-文件加入-cmake)
- [Step 2.2：实现 Android JNI Bridge](#step-22实现-android-jni-bridge)
  - [2.2.1：替换 jni_bridge.cpp](#221替换-jni_bridgecpp)
  - [2.2.2：理解 JNI 初始化链路](#222理解-jni-初始化链路)
- [Step 2.3：创建 Kotlin Runtime 容器](#step-23创建-kotlin-runtime-容器)
  - [2.3.1：创建 QuickAppRuntime.kt](#231创建-quickappruntimekt)
  - [2.3.2：实现 ViewRenderer 命令处理方法](#232实现-viewrenderer-命令处理方法)
- [Step 2.4：在 MainActivity 中运行测试](#step-24在-mainactivity-中运行测试)
  - [2.4.1：替换 MainActivity.kt](#241替换-mainactivitykt)
  - [2.4.2：理解 Compose 和 Android View 的关系](#242理解-compose-和-android-view-的关系)
- [Step 2.5：逐层验证](#step-25逐层验证)
  - [2.5.1：编译验证](#251编译验证)
  - [2.5.2：安装和运行验证](#252安装和运行验证)
  - [2.5.3：Logcat 验证](#253-logcat-验证)
- [技术决策](#技术决策)
- [核心原理解读](#核心原理解读)
  - [step2.2.1 JNI 初始化代码的第一性原理分析](#step221-jni-初始化代码的第一性原理分析)
- [QA](#qa)

---

## 目标

**建立 C++ → 平台层的跨语言渲染命令链路。**

| 层 | 职责 | 文件 |
|---|---|---|
| C++ Core | 定义平台无关的渲染命令接口 | `platform_bridge.h/cpp` |
| JNI Bridge | 适配命令为 Kotlin 方法调用 | `jni_bridge.cpp` |
| Kotlin Runtime | 接收命令并创建 Android View | `QuickAppRuntime.kt` |
| Activity | 容器和测试触发点 | `MainActivity.kt` |

**验收标准：**
- App 启动后屏幕显示 `Hello QuickApp!`
- Logcat 显示完整的 JNI → Kotlin → View 调用链

**本步不包含：**
- QuickJS 和 JS 执行
- RPK 加载和 Manifest 解析
- VNode 生成和 Yoga 布局计算
- Router 和页面切换
- Android → C++ 的事件回传
- 异步 Promise 和 EventLoop

---


## Step 2.1：扩展 PlatformBridge Core 接口

这一小节只修改 `core/`，不写 Android 代码。先把平台无关的接口定义好，再让 Android 去实现它。

### 2.1.1：创建 platform_bridge.h

**文件：**

```text
app/src/main/cpp/core/include/platform_bridge.h
```

把 Step 1 中的占位结构体完整替换为：

```cpp
#ifndef QUICKAPP_PLATFORM_BRIDGE_H
#define QUICKAPP_PLATFORM_BRIDGE_H

namespace quickapp {

// PlatformBridge 是 C++ Core 与平台层之间的跨层通信通道。
//
// Core 通过这个接口发送渲染指令，不直接依赖 Android View、Kotlin 或 JNI。
// 这样同一套 Core 可以在 Android、iOS、LVGL 等平台上复用。
struct PlatformBridge {
    /**
     * 创建一个平台元素。
     * @param id     节点 ID，Core 生成，后续用来更新/删除
     * @param type   节点类型："text"、"div" 等
     * @param x      Yoga 计算出的 X 偏移（像素）
     * @param y      Yoga 计算出的 Y 偏移（像素）
     * @param width  Yoga 计算出的宽度（像素）
     * @param height Yoga 计算出的高度（像素）
     */
    using CreateElementFn = void (*)(
        int id,
        const char* type,
        float x,
        float y,
        float width,
        float height);

    /**
     * 设置元素属性。
     * @param id    目标节点 ID
     * @param key   属性名：text、placeholder、value 等
     * @param value 属性值
     */
    using SetAttrFn = void (*)(
        int id,
        const char* key,
        const char* value);

    /**
     * 设置元素样式。
     * @param id    目标节点 ID
     * @param key   样式名：color、backgroundColor 等
     * @param value 样式值：#000000、16px 等
     */
    using SetStyleFn = void (*)(
        int id,
        const char* key,
        const char* value);

    // 初始化为 nullptr，表示平台还没有注册实现。
    // 如果不显式初始化，函数指针可能包含随机地址，误调用会直接崩溃
    CreateElementFn createElement = nullptr;
    SetAttrFn setAttr = nullptr;
    SetStyleFn setStyle = nullptr;

    // 判断最小渲染接口是否已注册
    bool isReady() const noexcept {
        return createElement != nullptr && setAttr != nullptr;
    }
};

// 注册当前平台的实现
void registerPlatformBridge(PlatformBridge bridge);

// Core 通过这个函数取得当前平台实现
const PlatformBridge& getPlatformBridge();

// Runtime 销毁时清空函数指针，避免继续调用已失效的平台对象
void clearPlatformBridge();

} // namespace quickapp

#endif // QUICKAPP_PLATFORM_BRIDGE_H
```

**解释：**

```text
接口定义"需要什么"
实现完成"怎么做"
```

Core 只要求：

```cpp
bridge.createElement(1, "text", 0, 0, 400, 120);
```

Android 把它实现为 TextView，iOS 实现为 UILabel，LVGL 实现为对应 Widget。Core 不需要知道这些差异。

### 2.1.2：创建 platform_bridge.cpp

头文件只放接口声明。全局 Bridge 的真正定义放到 `.cpp` 中，避免多个编译单元各自定义一份全局变量。

**新建文件：**

```text
app/src/main/cpp/core/src/platform_bridge.cpp
```

写入：

```cpp
#include "platform_bridge.h"

namespace quickapp { // 第一层：项目命名空间（公开的归属标识）, 这一层外部因为有platform可以用platform.xxx访问
namespace { // 第二层：匿名命名空间（文件内私有）, 没有名字, 外部拿什么访问内部的

// 当前进程使用的平台实现
// 现在只有一个 Runtime，所以用全局实例
// 后续多 Runtime 时移到 Runtime 对象内部
PlatformBridge g_platformBridge{};

} // namespace

void registerPlatformBridge(PlatformBridge bridge) {
    g_platformBridge = bridge;
}

const PlatformBridge& getPlatformBridge() {
    return g_platformBridge;
}

void clearPlatformBridge() {
    g_platformBridge = {};
}

} // namespace quickapp
```

**解释：**

```text
头文件：告诉所有人有哪些函数
.cpp 文件：只创建一份真正的状态
```

如果把 `g_platformBridge` 直接定义在头文件中，每个 include 它的 `.cpp` 都会生成一份变量，链接时出现重复定义。

### 2.1.3：把 Core 文件加入 CMake

新建了 `platform_bridge.cpp` 后，CMake 必须把它加入最终动态库，否则源码不会参与编译和链接。

**文件：**

```text
app/src/main/cpp/CMakeLists.txt
```

将文件完整替换为：

```cmake
cmake_minimum_required(VERSION 3.22)

project(quickapp-runtime-core)

# C++17，后续用到 optional、variant 等特性。
set(CMAKE_CXX_STANDARD 17)
# 编译器不支持 C++17 → CMake 直接报错终止，告诉你"编译器不满足要求", 不会静默降级到编译器支持的版本
set(CMAKE_CXX_STANDARD_REQUIRED ON) 

# Core 实现 + Android JNI 适配 → 同一个 .so
add_library(quickapp-runtime-core SHARED
    core/src/platform_bridge.cpp
    platform/android/jni_bridge.cpp
)

# 头文件搜索路径
target_include_directories(quickapp-runtime-core PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/core/include
)

# __android_log_print 在 NDK 的 log 库中
target_link_libraries(quickapp-runtime-core
    log
)
```

**验证这一小节：**

```bash
./gradlew :app:assembleDebug
```

成功说明：`platform_bridge.cpp` 被 CMake 找到、include 路径正确、`.so` 正常生成。

---

## Step 2.2：实现 Android JNI Bridge

这一小节把 PlatformBridge 的函数指针对接到 Android JNI 调用。

### 2.2.1：替换 jni_bridge.cpp

**文件：**

```text
app/src/main/cpp/platform/android/jni_bridge.cpp
```

将 Step 1 中只有 `JNI_OnLoad` 的代码完整替换为：

```cpp
#include <jni.h>
#include <android/log.h>

#include "platform_bridge.h"

#define LOG_TAG "quickapp-core"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

static JavaVM* g_vm = nullptr;           // 进程级：JVM 入口，JNI_OnLoad 时保存
static jobject g_runtimeObject = nullptr; // Kotlin QuickAppRuntime 的 Global Reference
static jclass g_runtimeClass = nullptr;   // QuickAppRuntime 的 Class 引用，用于反射找方法

// 获取当前线程的 JNIEnv。
// JNIEnv 是线程局部的，每个线程有自己的一份，不能跨线程保存。
static JNIEnv* getJNIEnv() {
    // 1. 前置检查：JNI_OnLoad 是否已执行
    if (g_vm == nullptr) {
        LOGE("JavaVM is not initialized");
        return nullptr;
    }
    // 2. 向 JVM 请求当前线程的 JNIEnv
    //    如果当前线程没有 Attach 到 JVM，返回 JNI_EDETACHED
    JNIEnv* env = nullptr;
    if (g_vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
        LOGE("Current thread is not attached to JVM");
        return nullptr;
    }
    // 3. 返回可用的 JNIEnv，调用方用它来调 JNI 函数
    return env;
}

// CreateElementFn 的 Android JNI 实现（签名和参数说明见 platform_bridge.h）。
// 不在头文件中声明——通过 bridge.createElement = jniCreateElement 间接调用。
static void jniCreateElement(
        int id, const char* type,
        float x, float y, float width, float height) {
    // 1. 防御: 获取当前线程 JNIEnv + 检查 Kotlin 对象是否就绪
    JNIEnv* env = getJNIEnv();
    if (!env || !g_runtimeObject || !g_runtimeClass) return;

    // 2. [c++->java类型转换] C++ const char* → JNI jstring（Local Reference）
    jstring jType = env->NewStringUTF(type);

    // 3. 通过反射找到 Kotlin 的 createElement(Int, String, Float×4) 方法
    //    签名 "(ILjava/lang/String;FFFF)V" = int + String + float×4 → void
    jmethodID methodID = env->GetMethodID(
        g_runtimeClass, "createElement", "(ILjava/lang/String;FFFF)V");
 
    if (methodID == nullptr) {
        LOGE("createElement method not found");
        env->DeleteLocalRef(jType);
        return;
    }

    // 4. 调用 Kotlin 对象的 createElement 方法
    env->CallVoidMethod(g_runtimeObject, methodID,
        static_cast<jint>(id), jType,
        static_cast<jfloat>(x), static_cast<jfloat>(y),
        static_cast<jfloat>(width), static_cast<jfloat>(height));

    // 5. 释放 Local Reference，防止高频调用耗尽引用表
    env->DeleteLocalRef(jType);
}

static void jniSetAttr(int id, const char* key, const char* value) {
    JNIEnv* env = getJNIEnv();
    if (!env || !g_runtimeObject || !g_runtimeClass) return;

    // [c++->java类型转换] const char* → jstring（Local Reference，用完必须释放）
    jstring jKey = env->NewStringUTF(key);
    jstring jValue = env->NewStringUTF(value);

    // 通过 JNI 反射找到 Kotlin 的 setAttr(Int, String, String)
    // 签名 "(ILjava/lang/String;Ljava/lang/String;)V" = int, String, String → void
    jmethodID methodID = env->GetMethodID(
        g_runtimeClass, "setAttr", "(ILjava/lang/String;Ljava/lang/String;)V");

    if (methodID) {
        env->CallVoidMethod(g_runtimeObject, methodID,
            static_cast<jint>(id), jKey, jValue);
    }

    // 释放 Local Reference，防止高频调用时耗尽 JNI 引用表（默认上限 512个引用槽位）
    env->DeleteLocalRef(jKey);
    env->DeleteLocalRef(jValue);
}

static void jniSetStyle(int id, const char* key, const char* value) {
    JNIEnv* env = getJNIEnv();
    if (!env || !g_runtimeObject || !g_runtimeClass) return;
    // 在 JNI 中，通过 NewStringUTF、NewObject 等方法创建的对象是局部引用（Local Reference）
    jstring jKey = env->NewStringUTF(key);
    jstring jValue = env->NewStringUTF(value);
    jmethodID methodID = env->GetMethodID(
        g_runtimeClass, "setStyle", "(ILjava/lang/String;Ljava/lang/String;)V");

    if (methodID) {
        env->CallVoidMethod(g_runtimeObject, methodID,
            static_cast<jint>(id), jKey, jValue);
    }
    // JNI局部引用需要手动释放
    env->DeleteLocalRef(jKey);
    env->DeleteLocalRef(jValue);
}

} // namespace

extern "C" {

// .so 加载时 JVM 自动调用，保存 JavaVM 指针。
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
    g_vm = vm;
    LOGI("JNI_OnLoad called");
    return JNI_VERSION_1_6;
}

/** Kotlin 调用 nativeInitialize() 时进入这里。
在nativeInitialize()中完成，通过函数指针将JNI实现注册到C++ Core
// 保存 Kotlin 对象的 Global Reference，注册 PlatformBridge。
// JNI命名：Java_ + [包名] + _ + [类名] + _ + [方法名]
// 对应kotlin：
// Java 侧声明
package com.quickappkit.runtime;

public class QuickAppRuntime {
    // 本地方法声明
    public native void nativeInitialize();

    // 或者在 Kotlin 中
    // external fun nativeInitialize()
}

@params JNIEnv* env：JNI 环境指针，提供访问 Java 对象的方法
@params jobject thiz：调用此方法的 Java 对象实例（相当于 this）
*/
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeInitialize(
        JNIEnv* env, jobject thiz) {
    LOGI("nativeInitialize called");

    // 重复初始化时先释放旧引用 - 防止内存泄漏
    // 如果之前已经初始化过，需要先清理旧的全局引用
    if (g_runtimeObject) { 
        env->DeleteGlobalRef(g_runtimeObject);  // 删除旧的全局引用
        g_runtimeObject = nullptr;              // 置空指针，避免野指针
    }
    if (g_runtimeClass) { 
        env->DeleteGlobalRef(g_runtimeClass);   // 删除旧的类引用
        g_runtimeClass = nullptr;              // 置空指针
    }

    // 创建新的全局引用 - 将Java对象的局部引用提升为全局引用
    // thiz 是 JNI 传入的 Java 对象（QuickAppRuntime 实例）
    // NewGlobalRef 会创建一个全局引用，Java GC 不会回收它
    g_runtimeObject = env->NewGlobalRef(thiz);

    // 获取对象的 Class 信息
    jclass localClass = env->GetObjectClass(thiz);  // 获取局部类引用
    g_runtimeClass = static_cast<jclass>(env->NewGlobalRef(localClass));  // 提升为全局引用
    env->DeleteLocalRef(localClass);  // 删除局部引用，避免 JNI 引用表泄漏

    // 注册到 Core - 建立 C++ 和 Java 之间的桥梁
    quickapp::PlatformBridge bridge{};  // 创建平台桥接对象
    bridge.createElement = jniCreateElement;  // 注册创建元素的回调
    bridge.setAttr = jniSetAttr;              // 注册设置属性的回调
    bridge.setStyle = jniSetStyle;           // 注册设置样式的回调
    quickapp::registerPlatformBridge(bridge); // 注册到全局，让 C++ 端可以调用

    LOGI("PlatformBridge registered");
}

// 最小测试入口：不依赖 JS/RPK，直接模拟一条渲染指令。
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeTestRender(
        JNIEnv* env, jobject thiz) {
    const auto& bridge = quickapp::getPlatformBridge();
    if (!bridge.isReady()) { LOGE("PlatformBridge is not ready"); return; }

    bridge.createElement(1, "text", 0, 0, 600, 120);
    bridge.setAttr(1, "text", "Hello QuickApp!");
    bridge.setStyle(1, "color", "#000000");
    LOGI("nativeTestRender completed");
}

// NIEXPORT 是一个宏定义，用于指定函数的导出属性。它的作用是让动态链接库（.so 文件）中的函数对 JVM 可见
// 生命周期hooks: Activity 销毁时执行: 释放 JNI Global Reference。
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeRelease(
        JNIEnv* env, jobject thiz) {
    quickapp::clearPlatformBridge();
    if (g_runtimeObject) { env->DeleteGlobalRef(g_runtimeObject); g_runtimeObject = nullptr; }
    if (g_runtimeClass) { env->DeleteGlobalRef(g_runtimeClass); g_runtimeClass = nullptr; }
    LOGI("JNI runtime released");
}

} // extern "C"
```

### 2.2.2：理解 JNI 初始化链路
- 这些步骤其实就是C++为了拿到kotlin方法的函数指针和核心饮用，并保证不被GC，让C++侧可以一直调用
/**
1. 获取函数指针或方法引用 - 让 C++ 知道如何调用具体的 Kotlin 方法
2. 创建 Global Reference - 防止 Java/Kotlin 对象被 GC 回收
3.建立持久化的调用通道 - 使得 C++ 可以在任何时候调用 Kotlin 方法
*/

```text
1. Kotlin 加载 libquickapp-runtime-core.so
2. JVM 自动调用 JNI_OnLoad → 保存 JavaVM
3. MainActivity 创建 QuickAppRuntime
4. Kotlin 调用 nativeInitialize()
5. C++ 保存 Kotlin 对象的 Global Reference
6. C++ 注册函数指针到 PlatformBridge
7. Kotlin 调用 nativeTestRender()
8. C++ 通过函数指针调用 jniCreateElement
9. JNI 调用 Kotlin createElement()
10. Kotlin 创建 TextView
```

Step 2 只验证 `C++ → Android`；`JS → C++` 留给后续 JS Bridge 任务。

---

## Step 2.3：创建 Kotlin Runtime 容器

### 2.3.1：创建 QuickAppRuntime.kt

> Step 2 把 `createElement`、`setAttr`、`setStyle` 暂时放在 `QuickAppRuntime.kt`。完成基础链路后，Task 3.3 再拆出独立的 `ViewRenderer.kt`。

**新建文件：**

```text
app/src/main/java/com/quickappkit/runtime/QuickAppRuntime.kt
```

写入：

```kotlin
package com.quickappkit.runtime

import android.content.Context
import android.graphics.Color
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView

/**
 * Runtime 的 Android 端实现。
 *
 * 职责：加载 native 库、接收 C++ 渲染指令、创建 Android View。
 */
class QuickAppRuntime(
    private val context: Context,
    private val container: FrameLayout,
) {
    // nodeId → Android View 的映射
    private val viewMap = mutableMapOf<Int, View>()

    companion object {
        private const val TAG = "QuickAppRuntime"
        init { System.loadLibrary("quickapp-runtime-core") }
    }

    fun initialize() { nativeInitialize() }
    fun testRender() { nativeTestRender() }
    fun release() { nativeRelease() }

    private external fun nativeInitialize()
    private external fun nativeTestRender()
    private external fun nativeRelease()

    /** C++ → JNI → Kotlin：创建元素 */
    fun createElement(id: Int, type: String, x: Float, y: Float, width: Float, height: Float) {
        val view = when (type) {
            "div" -> FrameLayout(context)
            "text" -> TextView(context).apply { setTextColor(Color.BLACK); textSize = 16f }
            else -> { Log.e(TAG, "Unknown element type: $type"); return }
        }

        view.layoutParams = FrameLayout.LayoutParams(width.toInt(), height.toInt(),
            Gravity.TOP or Gravity.START).apply {
            leftMargin = x.toInt()
            topMargin = y.toInt()
        }

        container.addView(view)
        viewMap[id] = view
        Log.i(TAG, "Created $type view, id=$id")
    }

    /** C++ → JNI → Kotlin：设置属性 */
    fun setAttr(id: Int, key: String, value: String) {
        val view = viewMap[id] ?: return
        when {
            key == "text" && view is TextView -> view.text = value
            else -> Log.d(TAG, "Ignored attr: id=$id, key=$key")
        }
    }

    /** C++ → JNI → Kotlin：设置样式 */
    fun setStyle(id: Int, key: String, value: String) {
        val view = viewMap[id] ?: return
        try {
            when {
                key == "color" && view is TextView -> view.setTextColor(Color.parseColor(value))
                key == "backgroundColor" -> view.setBackgroundColor(Color.parseColor(value))
            }
        } catch (e: IllegalArgumentException) {
            Log.e(TAG, "Invalid color: $value", e)
        }
    }
}
```

### 2.3.2：实现 ViewRenderer 命令处理方法

Kotlin 方法和 C++ JNI 签名必须一一对应：

| Kotlin 方法 | JNI 签名 | 作用 |
|---|---|---|
| `createElement` | `(ILjava/lang/String;FFFF)V` | 创建 View |
| `setAttr` | `(ILjava/lang/String;Ljava/lang/String;)V` | 设置属性 |
| `setStyle` | `(ILjava/lang/String;Ljava/lang/String;)V` | 设置样式 |

`viewMap` 维护的是 `nodeId → Android View` 的映射，后续 C++ 更新/删除节点时通过 id 找到对应 View。

---

## Step 2.4：在 MainActivity 中运行测试

### 2.4.1：替换 MainActivity.kt

用 `AndroidView` 把 FrameLayout 嵌入 Compose，不删除 Compose 模板。

**文件：**

```text
app/src/main/java/com/quickappkit/runtime/MainActivity.kt
```

完整替换为：

```kotlin
package com.quickappkit.runtime

import android.os.Bundle
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.quickappkit.runtime.ui.theme.QuickappRuntimeAndroidTheme

class MainActivity : ComponentActivity() {
    private var runtime: QuickAppRuntime? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            QuickappRuntimeAndroidTheme {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { context ->
                        FrameLayout(context).also { container ->
                            runtime = QuickAppRuntime(context, container).also {
                                it.initialize()
                                it.testRender()
                            }
                        }
                    },
                )
            }
        }
    }

    override fun onDestroy() {
        runtime?.release()
        runtime = null
        super.onDestroy()
    }
}
```

### 2.4.2：理解 Compose 和 Android View 的关系

```text
Compose UI
    └── AndroidView
        └── FrameLayout
            └── TextView（由 C++ 指令创建）
```

`AndroidView` 只是提供一个容器，让我们验证 ViewRenderer 的 View 创建逻辑。Compose 是 Demo 外壳，Runtime 渲染走 Android View System。

---

## Step 2.5：逐层验证

### 2.5.1：编译验证

```bash
./gradlew :app:assembleDebug
```

预期：`BUILD SUCCESSFUL`

如果 `undefined reference` → 检查 CMakeLists.txt 是否加了 `core/src/platform_bridge.cpp`
如果 `platform_bridge.h not found` → 检查 `target_include_directories` 路径

### 2.5.2：安装和运行验证

```bash
./gradlew installDebug
```

启动后屏幕显示 `Hello QuickApp!`。

这段文字经过了完整链路：

```text
nativeTestRender() → PlatformBridge.createElement() → jniCreateElement()
    → Kotlin createElement() → PlatformBridge.setAttr() → jniSetAttr()
    → Kotlin setAttr() → TextView.text
```

### 2.5.3：Logcat 验证

```bash
adb logcat -c
adb logcat | grep -E "quickapp-core|QuickAppRuntime"
```

预期输出：

```text
I/quickapp-core: JNI_OnLoad called
I/quickapp-core: nativeInitialize called
I/quickapp-core: PlatformBridge registered
I/quickapp-core: nativeTestRender completed
I/QuickAppRuntime: Created text view, id=1
```

---

## 技术决策

### 1. PlatformBridge 是跨平台通信通道

- Core 只依赖 PlatformBridge 接口，不直接依赖 JNI 或 Android View。
- PlatformBridge 负责 C++ → Platform 渲染指令；JS Bridge 负责 JS ↔ C++；两者独立。
- Android → C++ 的事件（click/input/lifecycle）走独立事件通道，不混入渲染指令。

### 2. Android Runtime 使用 View System

QuickApp 页面是运行时动态加载的，不是编译期 XML 布局。所以用代码动态创建 View：

```kotlin
when (type) {
    "div" -> FrameLayout(context)
    "text" -> TextView(context)
}
```

Jetpack Compose 只作为 Demo 外壳，不作为 Runtime 渲染内核。原因：Compose 的输入模型是 State → Recomposition，而 Runtime 的输入是 C++ 渲染指令 → 直接操作 View 树。如果用 Compose，需要额外处理 State 映射、Applier、重组范围等问题，不是 V1 要验证的核心。

### 3. V1 兼容现有快应用，V2 演进

- V1 保持 `system.router`、`system.prompt`、生命周期和事件的现有语义。
- V2 在兼容层上增加同步 Native API、Promise、EventEmitter。
- 不为了架构形式改变 V1 应用的调用方式。

### 4. JNI 调用逐步演进为调度层

- Step 2 使用直接函数指针 + 单线程，先验证跨语言边界。
- 后续如果 JS/Core 线程与 UI 线程分离，在 PlatformBridge 实现内部增加 UI Dispatcher 和命令队列。
- Core 的 `createElement`、`setAttr` 接口不变，平台实现可替换。

---

## 核心原理解读

### step2.2.1 JNI 初始化代码的第一性原理分析

基于 `nativeInitialize` 函数中的关键代码段：

```cpp
// 创建新的全局引用 - 将Java对象的局部引用提升为全局引用
// thiz 是 JNI 传入的 Java 对象（QuickAppRuntime 实例）
// NewGlobalRef 会创建一个全局引用，Java GC 不会回收它
g_runtimeObject = env->NewGlobalRef(thiz);

// 获取对象的 Class 信息
jclass localClass = env->GetObjectClass(thiz);  // 获取局部类引用
g_runtimeClass = static_cast<jclass>(env->NewGlobalRef(localClass));  // 提升为全局引用
env->DeleteLocalRef(localClass);  // 删除局部引用，避免 JNI 引用表泄漏

// 注册到 Core - 建立 C++ 和 Java 之间的桥梁
quickapp::PlatformBridge bridge{};  // 创建平台桥接对象
bridge.createElement = jniCreateElement;  // 注册创建元素的回调
bridge.setAttr = jniSetAttr;              // 注册设置属性的回调
bridge.setStyle = jniSetStyle;           // 注册设置样式的回调
quickapp::registerPlatformBridge(bridge); // 注册到全局，让 C++ 端可以调用
```

#### 第一性原则分解

这段代码的根本目的是**建立跨语言调用通道**，具体解决三个核心问题：

**1. 跨语言内存管理的不对称性**
- **问题**：Java 有自动垃圾回收（GC），C++ 需要手动管理内存
- **解决方案**：使用 `NewGlobalRef()` 将 Java 对象引用从局部提升为全局
- **为什么**：局部引用在 JNI 函数返回后会被自动释放，全局引用保证 C++ 代码长期持有 Java 对象时不会被 GC 回收

**2. 跨平台渲染接口标准化**
- **问题**：C++ Core 需要与不同平台（Android/iOS/Web）通信
- **解决方案**：定义 `PlatformBridge` 抽象接口
- **为什么**：
  - **解耦**：C++ Core 只依赖抽象接口，不直接耦合 JNI 或平台 API
  - **可扩展性**：同一套接口可在不同平台上实现
  - **可测试性**：可以模拟平台实现进行单元测试

**3. 性能与架构的平衡**
- **问题**：每次调用都需要 JNI 查找和参数转换，性能开销大
- **解决方案**：一次性注册函数指针 + 缓存类引用
- **为什么**：
  - 避免重复调用 `GetObjectClass` 的性能开销
  - 类引用比对象引用更稳定（对象的类不会变）
  - 函数指针调用比动态 JNI 方法查找更快

#### 从 QuickApp Runtime 架构视角

这是 **跨层桥接模式** 的具体实现：

```
C++ Core (JS 执行 + Yoga 布局计算) 
    ↓ 调用标准化接口
PlatformBridge (抽象层)
    ↓ 函数指针调用  
JNI Bridge (C++ → Java 适配器)
    ↓ JNI 方法调用
Kotlin Runtime (Android View 渲染)
```

**设计哲学**：
1. **向下依赖**：C++ Core 向下依赖平台实现，符合依赖倒置原则
2. **一次定义，多处实现**：同一套渲染接口可适配不同平台
3. **最小接口**：只定义必需的渲染操作，保持接口稳定

#### 技术决策的深层次考量

1. **为什么不是直接 JNI 调用？**
   - 直接 JNI 调用会导致 C++ Core 与 Android 平台强耦合
   - 增加新平台需要修改 Core 代码，违反开闭原则
   - 无法进行平台无关的单元测试

2. **为什么用函数指针而不是虚函数？**
   - 函数指针更轻量，无需虚表开销
   - 纯 C 接口，兼容性更好
   - 易于与 C 语言库（如 QuickJS）集成

3. **为什么缓存类引用？**
   - 性能优化：减少 JNI 查找开销
   - 内存安全：全局引用确保类信息长期有效
   - 代码清晰：明确区分对象引用和类引用

#### 总结：第一性原理的架构价值

这段代码不仅是技术实现，更是构建**可维护、可扩展跨平台渲染引擎**的基础设施：

1. **解决本质问题**：跨语言内存管理 + 平台抽象
2. **建立可持续架构**：为支持 iOS、Web、桌面等多平台奠定基础  
3. **实现工程最佳实践**：解耦、性能优化、可测试性

如果没有这个设计，每次 C++ 需要调用渲染方法时都需要重复进行 JNI 查找、参数转换等操作，导致代码重复、性能低下且难以维护。这体现了从**本质需求**出发，通过**分层抽象**解决复杂系统问题的架构思维。

---

## QA

### 1. PlatformBridge 为什么是函数指针

函数指针把接口和实现分开：

```text
Core：定义函数签名
Android：实现为 JNI 调用
iOS：实现为 Objective-C/Swift 调用
LVGL：实现为 LVGL Widget 调用
```

V1 先用函数指针建立清晰的跨平台边界；后续高频渲染时可以在内部接入命令队列，不改变 Core 的调用接口。

### 2. JNI_OnLoad 为什么需要 JavaVM

```text
System.loadLibrary() → JVM 加载 .so → JNI_OnLoad(JavaVM*) → native 保存 JavaVM
```

`JavaVM*` 是进程级的，可以保存。`JNIEnv*` 是线程级的，不能跨线程使用。

### 3. extern "C" 为什么不能删除

C++ 编译器会 Name Mangling。JNI 按固定 C 风格名称查找函数：

```text
Java_com_quickappkit_runtime_QuickAppRuntime_nativeInitialize
```

删除 `extern "C"` 后 JVM 找不到函数，报 `UnsatisfiedLinkError`。

### 4. JNI 的 Local Reference 和 Global Reference

```text
Local Reference：当前 JNI 调用期间有效
Global Reference：跨调用长期保存，必须手动释放
```

临时字符串用 Local，保存 Kotlin 对象用 Global。Activity 销毁时释放 Global。

### 5. JNIEnv 为什么不能跨线程保存

```text
JavaVM：进程级
JNIEnv：线程级
```

后续 JS Runtime 用独立线程时需要 `AttachCurrentThread` 获取当前线程的 JNIEnv。

### 6. JNI 函数名和 Kotlin 方法为什么必须匹配

JNI 静态注册规则：`Java_` + 包名 + 类名 + 方法名。参数签名也必须匹配，如 `(ILjava/lang/String;FFFF)V` 表示 `int, String, float×4 → void`。

### 7. 为什么 V1 不直接照搬 TurboModule

V1 目标是兼容现有快应用（RPK、system.router、生命周期事件）。TurboModule-like 的同步 API、Promise、EventEmitter 是 V2 演进方向，不应为了架构形式改变 V1 的调用方式。

### 8. Step 2 完成后得到了什么

后续所有功能的底座：

```text
C++ Core → PlatformBridge → Android JNI → Kotlin → Android View
```

JS Bridge、VNode、Yoga、Router 都复用这条链路，Core 不直接依赖 Android。

### 9. JS Bridge、渲染管线与 PlatformBridge 的关系

三者各司其职：

```text
JS Bridge        → JS ↔ C++ Runtime（跨语言调用）
Render Pipeline  → C++ 内部数据 → 渲染指令（VNode/Style/Yoga → RenderCommand）
PlatformBridge   → C++ → Platform（跨平台通信通道）
```

完整链路：

```text
JavaScript → JS Bridge → C++ Runtime → Render Pipeline → PlatformBridge → JNI → Kotlin → Android View
```

| 层 | 解决的问题 | Step 2 实现 |
|---|---|---|
| JS Bridge | JS 如何调用 C++？ | 暂无 |
| Render Pipeline | VNode 如何变成指令？ | 硬编码测试指令模拟 |
| PlatformBridge | C++ 如何跨平台调用？ | ✓ createElement/setAttr/setStyle |
| JNI | C++ 如何调用 Kotlin？ | ✓ 作为 PlatformBridge 的 Android 适配层 |

PlatformBridge 结构：

```text
PlatformBridge
├── RenderPort   // C++ → Platform：createElement、setAttr、setStyle
└── EventPort    // Platform → C++：click、input、lifecycle（独立事件通道）
```

各平台各自实现同一组接口：

```text
Android  → JNI → Kotlin → View
iOS      → Objective-C++ → UIKit
LVGL     → LVGL C API
```

**Step 2 验证范围：**
- ✓ C++ → PlatformBridge → JNI → Kotlin → View
- ✗ QuickJS / JS Bridge
- ✗ VNode / Yoga 布局
- ✗ Android → C++ 事件
- ✗ RPK / Router / Promise / EventLoop

---

## 下一步

待 Step 2 验收通过后，按 `design.md` / `tasks.md` 编写 Step 3：JSEngine。

---

## QA

基于 `nativeInitialize` 函数中的关键代码段：

```cpp
// 创建新的全局引用 - 将Java对象的局部引用提升为全局引用
// thiz 是 JNI 传入的 Java 对象（QuickAppRuntime 实例）
// NewGlobalRef 会创建一个全局引用，Java GC 不会回收它
g_runtimeObject = env->NewGlobalRef(thiz);

// 获取对象的 Class 信息
jclass localClass = env->GetObjectClass(thiz);  // 获取局部类引用
g_runtimeClass = static_cast<jclass>(env->NewGlobalRef(localClass));  // 提升为全局引用
env->DeleteLocalRef(localClass);  // 删除局部引用，避免 JNI 引用表泄漏

// 注册到 Core - 建立 C++ 和 Java 之间的桥梁
quickapp::PlatformBridge bridge{};  // 创建平台桥接对象
bridge.createElement = jniCreateElement;  // 注册创建元素的回调
bridge.setAttr = jniSetAttr;              // 注册设置属性的回调
bridge.setStyle = jniSetStyle;           // 注册设置样式的回调
quickapp::registerPlatformBridge(bridge); // 注册到全局，让 C++ 端可以调用
```

#### 第一性原则分解

这段代码的根本目的是**建立跨语言调用通道**，具体解决三个核心问题：

**1. 跨语言内存管理的不对称性**
- **问题**：Java 有自动垃圾回收（GC），C++ 需要手动管理内存
- **解决方案**：使用 `NewGlobalRef()` 将 Java 对象引用从局部提升为全局
- **为什么**：局部引用在 JNI 函数返回后会被自动释放，全局引用保证 C++ 代码长期持有 Java 对象时不会被 GC 回收

**2. 跨平台渲染接口标准化**
- **问题**：C++ Core 需要与不同平台（Android/iOS/Web）通信
- **解决方案**：定义 `PlatformBridge` 抽象接口
- **为什么**：
  - **解耦**：C++ Core 只依赖抽象接口，不直接耦合 JNI 或平台 API
  - **可扩展性**：同一套接口可在不同平台上实现
  - **可测试性**：可以模拟平台实现进行单元测试

**3. 性能与架构的平衡**
- **问题**：每次调用都需要 JNI 查找和参数转换，性能开销大
- **解决方案**：一次性注册函数指针 + 缓存类引用
- **为什么**：
  - 避免重复调用 `GetObjectClass` 的性能开销
  - 类引用比对象引用更稳定（对象的类不会变）
  - 函数指针调用比动态 JNI 方法查找更快

#### 从 QuickApp Runtime 架构视角

这是 **跨层桥接模式** 的具体实现：

```
C++ Core (JS 执行 + Yoga 布局计算) 
    ↓ 调用标准化接口
PlatformBridge (抽象层)
    ↓ 函数指针调用  
JNI Bridge (C++ → Java 适配器)
    ↓ JNI 方法调用
Kotlin Runtime (Android View 渲染)
```

**设计哲学**：
1. **向下依赖**：C++ Core 向下依赖平台实现，符合依赖倒置原则
2. **一次定义，多处实现**：同一套渲染接口可适配不同平台
3. **最小接口**：只定义必需的渲染操作，保持接口稳定

#### 技术决策的深层次考量

1. **为什么不是直接 JNI 调用？**
   - 直接 JNI 调用会导致 C++ Core 与 Android 平台强耦合
   - 增加新平台需要修改 Core 代码，违反开闭原则
   - 无法进行平台无关的单元测试

2. **为什么用函数指针而不是虚函数？**
   - 函数指针更轻量，无需虚表开销
   - 纯 C 接口，兼容性更好
   - 易于与 C 语言库（如 QuickJS）集成

3. **为什么缓存类引用？**
   - 性能优化：减少 JNI 查找开销
   - 内存安全：全局引用确保类信息长期有效
   - 代码清晰：明确区分对象引用和类引用

#### 总结：第一性原理的架构价值

这段代码不仅是技术实现，更是构建**可维护、可扩展跨平台渲染引擎**的基础设施：

1. **解决本质问题**：跨语言内存管理 + 平台抽象
2. **建立可持续架构**：为支持 iOS、Web、桌面等多平台奠定基础  
3. **实现工程最佳实践**：解耦、性能优化、可测试性

如果没有这个设计，每次 C++ 需要调用渲染方法时都需要重复进行 JNI 查找、参数转换等操作，导致代码重复、性能低下且难以维护。这体现了从**本质需求**出发，通过**分层抽象**解决复杂系统问题的架构思维。
