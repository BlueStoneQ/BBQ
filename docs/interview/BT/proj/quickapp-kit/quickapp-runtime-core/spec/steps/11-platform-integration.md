# Step 11：三端集成指引

## 目录

- [目标](#目标)
- [Step 11.1：集成契约](#step-111集成契约)
- [Step 11.2：Android 替换实施](#step-112android-替换实施)
- [Step 11.3：实测 Babel interop 风险](#step-113实测-babel-interop-风险)
- [Step 11.4：Android 回归验证](#step-114android-回归验证)
- [Step 11.5：iOS 集成方案](#step-115ios-集成方案)
- [Step 11.6：LVGL 集成方案](#step-116lvgl-集成方案)
- [Step 11.7：三端对照与验证清单](#step-117三端对照与验证清单)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把 Core 真正接入三端，并用 Android 做端到端回归验证。**

| 平台 | 工作内容 | 验证程度 |
|---|---|---|
| Android | 删除内嵌 core 目录，改用 `add_subdirectory` 引入，实现 6 个 Bridge 函数 | **真实验证**（有可运行工程） |
| iOS | Xcode 集成方案 + ObjC++ Bridge 实现 | 方案 + 桩代码 |
| LVGL | CMake 子项目 + LVGL Widget Bridge 实现 | 方案 + 桩代码 |

**验收标准：**
- Android `./gradlew clean :app:assembleDebug` → BUILD SUCCESSFUL
- Android 运行后屏幕显示与抽取前完全一致
- Kotlin 侧 `external fun` 签名保持不变
- Android 工程的 C++ 文件从 48 个降到 3 个
- Babel interop 风险实测有明确结论
- iOS / LVGL 的 Bridge 实现代码可直接使用

**本步不包含：**
- iOS / LVGL 的真机运行验证（无对应工程）
- AAR / framework 打包发布（产品化阶段）
- 多架构交叉编译矩阵（armeabi-v7a / x86_64 等）

---

## Step 11.1：集成契约

三端要做的事完全相同，只有实现方式不同。

### 11.1.1：平台层必须提供的东西

```text
1. RPK 字节数据
   Android  AssetManager.open().readBytes()
   iOS      NSData dataWithContentsOfFile
   LVGL     从 Flash/SD 读入内存，或编译期烧进数组

2. PlatformBridge 的 6 个函数
   createElement / setAttr / setStyle / setEvent / removeElement / showToast
   前三个必填（isReady 检查），后三个可选

3. UI 线程调度
   在 Bridge 实现内部完成，Core 不参与

4. 事件回传
   调 PlatformEventSink::dispatchClick / dispatchInput / dispatchLifecycle

5. 日志后端（可选）
   quickapp::setLogHandler(myHandler)

6. 视口尺寸
   屏幕宽 × (屏幕高 - 状态栏 - 标题栏)
```

### 11.1.2：平台层只需 include 两个头文件

```cpp
#include "platform_bridge.h"     // PlatformBridge 结构体
#include "runtime_host.h"        // RuntimeHost API
```

可选：

```cpp
#include "qa_log.h"              // 想接管日志时
#include "platform_event_sink.h" // 事件回传（也可通过 RuntimeHost 的 dispatch*）
```

**不要 include** 这些（Core 内部实现，PRIVATE include 路径不可见）：

```text
js_engine.h / runtime_thread.h / runtime_bootstrap.h
vnode.h / render_pipeline.h / rpk_loader.h
native_module.h        ← 它依赖 quickjs.h，平台层编译会失败（Step 07 已知妥协）
```

### 11.1.3：调用序列（三端一致）

```cpp
// 1. 可选：接管日志
quickapp::setLogHandler(myLogHandler);

// 2. 填 Bridge
quickapp::PlatformBridge bridge{};
bridge.createElement = myCreateElement;
bridge.setAttr = mySetAttr;
bridge.setStyle = mySetStyle;
bridge.setEvent = mySetEvent;
bridge.removeElement = myRemoveElement;
bridge.showToast = myShowToast;

// 3. 配置
quickapp::RuntimeHostConfig cfg;
cfg.bridge = bridge;
cfg.rpkData = rpkBytes;      // 平台读的，必须保持有效到 destroy
cfg.rpkSize = rpkSize;
cfg.viewportWidth = screenWidth;
cfg.viewportHeight = screenHeight - statusBarH - titleBarH;

// 4. 启动
quickapp::RuntimeHost host;
if (!host.create(cfg) || !host.start()) {
    showError(host.failedStage(), host.getLastError());
    return;
}

// 5. 运行期
host.dispatchClick(nodeId);
host.dispatchLifecycle("onShow");

// 6. 销毁
host.destroy();
```

---

## Step 11.2：Android 替换实施

### 11.2.1：记录基线（替换前必做）

替换前先固化当前状态，作为回归对比依据。

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android

# 1. 确认当前能编译
./gradlew clean :app:assembleDebug
# 预期：BUILD SUCCESSFUL

# 2. 记录 .so 大小
find app/build -name "libquickapp-runtime-core.so" -exec ls -lh {} \;
# 记下数值，替换后应接近

# 3. 记录运行日志
adb logcat -c
adb shell am start -n com.quickappkit.runtime/.MainActivity
sleep 3
adb logcat -d | grep -E "quickapp-core|QuickAppRuntime" > /tmp/baseline-log.txt
wc -l /tmp/baseline-log.txt

# 4. 截图
adb exec-out screencap -p > /tmp/baseline-screen.png

# 5. 记录 Kotlin 的 native 方法签名（替换后不能变）
grep -n "external fun" app/src/main/java/com/quickappkit/runtime/QuickAppRuntime.kt
```

### 11.2.2：删除内嵌的 Core 代码

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android/app/src/main/cpp

# 先确认要删的内容和 Step 01 的清单一致
find core third_party platform/common -type f | wc -l
# 预期 45（26 + 17 + 2）

# 备份（保险起见，验证通过后再删）
tar czf /tmp/android-cpp-backup.tar.gz core third_party platform/common

# 删除
rm -rf core third_party platform/common

# 确认剩余
find . -type f | sort
```

预期剩余 4 个文件：

```text
./CMakeLists.txt
./platform/android/asset_reader.cpp
./platform/android/asset_reader.h
./platform/android/jni_bridge.cpp
```

从 48 个 C++ 文件降到 3 个（不含 CMakeLists）。

### 11.2.3：改写 CMakeLists.txt

**@update `app/src/main/cpp/CMakeLists.txt`（整个替换）**

```cmake
cmake_minimum_required(VERSION 3.22)

project(quickapp-runtime-android)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================
# 引入 quickapp-runtime-core
# ============================================================

# Core 项目的位置。
# 用相对路径而不是绝对路径，方便其他开发者 clone 后直接编译。
# 目录结构假设：
#   quickapp-kit/
#   ├── quickapp-runtime-core/
#   └── quickapp-runtime-android/app/src/main/cpp/   ← 当前位置
set(QUICKAPP_CORE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../quickapp-runtime-core"
    CACHE PATH "Path to quickapp-runtime-core")

# 提前检查，给出清晰的错误信息。
# 不检查的话 add_subdirectory 会报 "does not contain a CMakeLists.txt"，
# 对不熟悉项目结构的人不够明确。
if(NOT EXISTS "${QUICKAPP_CORE_DIR}/CMakeLists.txt")
    message(FATAL_ERROR
        "quickapp-runtime-core not found at:\n"
        "  ${QUICKAPP_CORE_DIR}\n"
        "Expected directory layout:\n"
        "  quickapp-kit/quickapp-runtime-core/\n"
        "  quickapp-kit/quickapp-runtime-android/\n"
        "Override with -DQUICKAPP_CORE_DIR=<path> if your layout differs.")
endif()

# 集成时的编译选项：
#   不编译 Core 的单元测试（Android 上跑不了 ctest）
#   日志走 CALLBACK 后端（我们注册 androidLogHandler 接管）
set(QUICKAPP_CORE_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(QUICKAPP_LOG_BACKEND "CALLBACK" CACHE STRING "" FORCE)

# 第二个参数是二进制输出目录。
# 必须指定，因为 Core 在源码树之外，CMake 无法自动推导。
add_subdirectory(${QUICKAPP_CORE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/quickapp-core)

# ============================================================
# Android 平台层
# ============================================================

# 只剩三个文件：JNI 桥接 + Asset 读取
add_library(quickapp-runtime-core SHARED
    platform/android/jni_bridge.cpp
    platform/android/asset_reader.cpp
)

target_include_directories(quickapp-runtime-core PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/platform/android
)

# 链接 Core。
# Core 的 PUBLIC include（include/ 目录）会自动传递过来，
# 所以 jni_bridge.cpp 可以直接 #include "runtime_host.h"。
# Core 的 PRIVATE 依赖（quickjs、zlib）不会传递，平台层看不到。
target_link_libraries(quickapp-runtime-core
    PRIVATE
        quickapp-core
        # Android NDK 系统库
        log        # __android_log_print
        android    # AAssetManager
)

target_compile_options(quickapp-runtime-core PRIVATE
    -Wall
    -Wextra
    -Wno-unused-parameter    # JNI 函数的 reserved 参数
)

message(STATUS "quickapp-runtime-android:")
message(STATUS "  Core dir:  ${QUICKAPP_CORE_DIR}")
message(STATUS "  ABI:       ${ANDROID_ABI}")
message(STATUS "  Platform:  ${ANDROID_PLATFORM}")
```

**保留 `.so` 名称 `quickapp-runtime-core` 的原因：** Kotlin 侧的 `System.loadLibrary("quickapp-runtime-core")` 不变，避免改动 Kotlin 代码。名字虽然和 Core 库重名（`libquickapp-core.a`），但一个是 SHARED 一个是 STATIC，CMake target 名不同（`quickapp-runtime-core` vs `quickapp-core`），不冲突。


### 11.2.4：改写 jni_bridge.cpp

这是 Android 集成的核心文件。原来它包含启动逻辑、渲染转发、事件回传，现在只剩适配层。

**@update `app/src/main/cpp/platform/android/jni_bridge.cpp`（整个替换）**

第一部分：全局状态与 JNI 工具。

```cpp
// Android 平台适配层。
//
// 职责：
//   1. 实现 PlatformBridge 的 6 个函数，把渲染命令转为 Kotlin 方法调用
//   2. 把 Kotlin 的事件调用转为 PlatformEventSink 投递
//   3. 提供 Android 日志后端
//   4. 管理 RuntimeHost 的生命周期
//
// 线程模型：
//   Core 在 Runtime Thread 调用 PlatformBridge 函数，
//   本文件负责把操作投递到 Android UI Thread（通过 Kotlin 的 Handler）。
//
//   Kotlin 的事件调用发生在 UI Thread，
//   PlatformEventSink 内部投递到 Runtime Thread。

#include <jni.h>
#include <android/log.h>

#include <memory>
#include <string>
#include <vector>

#include "asset_reader.h"

// Core 的公开头文件。只需要这三个。
#include "platform_bridge.h"
#include "qa_log.h"
#include "runtime_host.h"

#define LOG_TAG "quickapp-android"
#define ALOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define ALOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

// 进程级 JVM 指针，JNI_OnLoad 时保存。
// JavaVM 是进程级的可以保存；JNIEnv 是线程级的不能跨线程保存。
JavaVM* g_vm = nullptr;

// Kotlin QuickAppRuntime 对象的 Global Reference。
// 必须用 Global 而非 Local：Local 引用在 JNI 调用返回后失效，
// 而我们需要在 Runtime Thread 里（不同的 JNI 调用栈）使用它。
jobject g_runtimeObj = nullptr;
jclass g_runtimeClass = nullptr;

// 缓存的 jmethodID。
// 每次调用都 GetMethodID 会有反射开销（字符串比较查方法表），
// 首屏渲染有几百次调用，缓存后能省下可观时间。
// jmethodID 在类未被卸载前一直有效，可以安全缓存。
struct KotlinMethods {
    jmethodID createElement = nullptr;
    jmethodID setAttr = nullptr;
    jmethodID setStyle = nullptr;
    jmethodID setEvent = nullptr;
    jmethodID removeElement = nullptr;
    jmethodID showToast = nullptr;
};
KotlinMethods g_methods;

// Runtime 实例和它持有的 RPK 数据。
//
// rpkData 必须在这里保存：RuntimeHostConfig 只存指针不拷贝（Step 10 的约定），
// 数据的生命周期必须覆盖整个 Runtime。
std::unique_ptr<quickapp::RuntimeHost> g_host;
std::vector<uint8_t> g_rpkData;

/**
 * 获取当前线程的 JNIEnv，必要时 Attach。
 *
 * Core 的 Runtime Thread 是用 std::thread 创建的，JVM 不认识它。
 * 第一次从这个线程调 JNI 前必须 AttachCurrentThread。
 *
 * @param outNeedDetach 输出参数：true 表示本次调用做了 Attach，
 *                      调用方在用完后应该 Detach（或选择保持 attached）
 * @return JNIEnv 指针；失败返回 nullptr
 */
JNIEnv* getEnv(bool* outNeedDetach) {
    *outNeedDetach = false;
    if (g_vm == nullptr) {
        ALOGE("JavaVM is null, JNI_OnLoad not called?");
        return nullptr;
    }

    JNIEnv* env = nullptr;
    const jint result = g_vm->GetEnv(reinterpret_cast<void**>(&env),
                                     JNI_VERSION_1_6);

    if (result == JNI_OK) {
        return env;
    }
    if (result == JNI_EDETACHED) {
        // Runtime Thread 首次调 JNI。
        // 注意：Attach 后不立即 Detach —— 渲染是高频操作，
        // 每次 Attach/Detach 有明显开销（约 10μs）。
        // 线程退出时由 nativeRelease 统一 Detach。
        if (g_vm->AttachCurrentThread(&env, nullptr) == JNI_OK) {
            ALOGI("Runtime thread attached to JVM");
            return env;
        }
        ALOGE("AttachCurrentThread failed");
        return nullptr;
    }

    ALOGE("GetEnv failed with %d", result);
    return nullptr;
}

/**
 * 缓存 Kotlin 方法的 jmethodID。
 *
 * 在 nativeInitialize 时调用一次。签名必须和 Kotlin 侧完全匹配，
 * 不匹配时 GetMethodID 返回 nullptr（并抛 NoSuchMethodError）。
 *
 * @param env JNIEnv
 * @return true 全部必需方法都找到了
 */
bool cacheKotlinMethods(JNIEnv* env) {
    if (g_runtimeClass == nullptr) {
        return false;
    }

    // JNI 签名速查：
    //   I = int, F = float, V = void, Ljava/lang/String; = String
    //   (参数...)返回值
    g_methods.createElement = env->GetMethodID(
        g_runtimeClass, "createElement", "(ILjava/lang/String;FFFF)V");
    g_methods.setAttr = env->GetMethodID(
        g_runtimeClass, "setAttr", "(ILjava/lang/String;Ljava/lang/String;)V");
    g_methods.setStyle = env->GetMethodID(
        g_runtimeClass, "setStyle", "(ILjava/lang/String;Ljava/lang/String;)V");
    g_methods.setEvent = env->GetMethodID(
        g_runtimeClass, "setEvent", "(ILjava/lang/String;Ljava/lang/String;)V");
    g_methods.removeElement = env->GetMethodID(
        g_runtimeClass, "removeElement", "(I)V");
    g_methods.showToast = env->GetMethodID(
        g_runtimeClass, "showToast", "(Ljava/lang/String;)V");

    // GetMethodID 失败会留下 pending exception，必须清除，
    // 否则后续任何 JNI 调用都会失败
    if (env->ExceptionCheck()) {
        env->ExceptionDescribe();   // 打印到 logcat，便于排查
        env->ExceptionClear();
    }

    const bool ok = g_methods.createElement != nullptr &&
                    g_methods.setAttr != nullptr &&
                    g_methods.setStyle != nullptr;
    if (!ok) {
        ALOGE("required Kotlin methods not found; check method signatures");
    }
    return ok;
}
```

第二部分：PlatformBridge 实现。

```cpp
// ============================================================
// PlatformBridge 的 6 个实现
// ============================================================
//
// 这些函数在 Core 的 Runtime Thread 被调用。
// Kotlin 侧的方法内部会用 Handler.post 切到 UI Thread
// （见 11.2.5 的 Kotlin 代码）。
//
// 为什么线程切换放在 Kotlin 而不是 C++：
//   Kotlin 侧有现成的 Handler(Looper.getMainLooper())，
//   在 C++ 里做需要额外的 JNI 调用来投递，反而更绕。

void jniCreateElement(int id, const char* type,
                      float x, float y, float width, float height) {
    bool needDetach = false;
    JNIEnv* env = getEnv(&needDetach);
    if (env == nullptr || g_runtimeObj == nullptr ||
        g_methods.createElement == nullptr) {
        return;
    }

    jstring jType = env->NewStringUTF(type != nullptr ? type : "");

    env->CallVoidMethod(g_runtimeObj, g_methods.createElement,
                        static_cast<jint>(id), jType,
                        static_cast<jfloat>(x), static_cast<jfloat>(y),
                        static_cast<jfloat>(width), static_cast<jfloat>(height));

    // 必须释放 Local Reference。
    // JNI 的 local reference 表默认只有 512 个槽位，
    // 首屏渲染有几百次调用，不释放会耗尽并崩溃。
    env->DeleteLocalRef(jType);
}

void jniSetAttr(int id, const char* key, const char* value) {
    bool needDetach = false;
    JNIEnv* env = getEnv(&needDetach);
    if (env == nullptr || g_runtimeObj == nullptr ||
        g_methods.setAttr == nullptr) {
        return;
    }

    jstring jKey = env->NewStringUTF(key != nullptr ? key : "");
    jstring jValue = env->NewStringUTF(value != nullptr ? value : "");

    env->CallVoidMethod(g_runtimeObj, g_methods.setAttr,
                        static_cast<jint>(id), jKey, jValue);

    env->DeleteLocalRef(jKey);
    env->DeleteLocalRef(jValue);
}

void jniSetStyle(int id, const char* key, const char* value) {
    bool needDetach = false;
    JNIEnv* env = getEnv(&needDetach);
    if (env == nullptr || g_runtimeObj == nullptr ||
        g_methods.setStyle == nullptr) {
        return;
    }

    jstring jKey = env->NewStringUTF(key != nullptr ? key : "");
    jstring jValue = env->NewStringUTF(value != nullptr ? value : "");

    env->CallVoidMethod(g_runtimeObj, g_methods.setStyle,
                        static_cast<jint>(id), jKey, jValue);

    env->DeleteLocalRef(jKey);
    env->DeleteLocalRef(jValue);
}

void jniSetEvent(int id, const char* eventType, const char* methodName) {
    bool needDetach = false;
    JNIEnv* env = getEnv(&needDetach);
    if (env == nullptr || g_runtimeObj == nullptr ||
        g_methods.setEvent == nullptr) {
        return;
    }

    jstring jType = env->NewStringUTF(eventType != nullptr ? eventType : "");
    jstring jMethod = env->NewStringUTF(methodName != nullptr ? methodName : "");

    env->CallVoidMethod(g_runtimeObj, g_methods.setEvent,
                        static_cast<jint>(id), jType, jMethod);

    env->DeleteLocalRef(jType);
    env->DeleteLocalRef(jMethod);
}

void jniRemoveElement(int id) {
    bool needDetach = false;
    JNIEnv* env = getEnv(&needDetach);
    if (env == nullptr || g_runtimeObj == nullptr ||
        g_methods.removeElement == nullptr) {
        return;
    }
    env->CallVoidMethod(g_runtimeObj, g_methods.removeElement,
                        static_cast<jint>(id));
}

void jniShowToast(const char* message) {
    bool needDetach = false;
    JNIEnv* env = getEnv(&needDetach);
    if (env == nullptr || g_runtimeObj == nullptr ||
        g_methods.showToast == nullptr) {
        return;
    }

    jstring jMsg = env->NewStringUTF(message != nullptr ? message : "");
    env->CallVoidMethod(g_runtimeObj, g_methods.showToast, jMsg);
    env->DeleteLocalRef(jMsg);
}

/**
 * Core 日志 → Android logcat 的桥接。
 *
 * 通过 quickapp::setLogHandler 注册（Step 03 的机制）。
 * 这是 Core 里唯一的 __android_log_print 出现位置 —— 在平台层，不在 Core。
 *
 * @param level   Core 的日志级别
 * @param tag     固定为 "quickapp-core"
 * @param message 已格式化的日志文本
 */
void androidLogHandler(quickapp::LogLevel level, const char* tag,
                       const char* message) {
    int priority;
    switch (level) {
        case quickapp::LogLevel::Verbose: priority = ANDROID_LOG_VERBOSE; break;
        case quickapp::LogLevel::Debug:   priority = ANDROID_LOG_DEBUG;   break;
        case quickapp::LogLevel::Info:    priority = ANDROID_LOG_INFO;    break;
        case quickapp::LogLevel::Warn:    priority = ANDROID_LOG_WARN;    break;
        case quickapp::LogLevel::Error:   priority = ANDROID_LOG_ERROR;   break;
        default:                          priority = ANDROID_LOG_INFO;    break;
    }
    // 用 "%s" 而不是直接传 message：
    // message 里可能含 % 字符（如 "width: 50%"），
    // 直接传会被当作格式串导致未定义行为
    __android_log_print(priority, tag != nullptr ? tag : LOG_TAG, "%s", message);
}

} // namespace
```


第三部分：JNI 导出函数。

```cpp
extern "C" {

/**
 * .so 加载时 JVM 自动调用。
 */
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* /*reserved*/) {
    g_vm = vm;
    // 尽早注册日志后端，让后续所有 Core 日志都进 logcat
    quickapp::setLogHandler(androidLogHandler);
    ALOGI("JNI_OnLoad: log handler registered");
    return JNI_VERSION_1_6;
}

/**
 * Kotlin: private external fun nativeInitialize()
 *
 * 保存 Kotlin 对象引用并缓存方法 ID。
 * 不启动 Runtime —— 那是 nativeLaunch 的事。
 */
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeInitialize(
        JNIEnv* env, jobject thiz) {
    // 重复初始化时先清理旧引用
    if (g_runtimeObj != nullptr) {
        env->DeleteGlobalRef(g_runtimeObj);
        g_runtimeObj = nullptr;
    }
    if (g_runtimeClass != nullptr) {
        env->DeleteGlobalRef(g_runtimeClass);
        g_runtimeClass = nullptr;
    }

    g_runtimeObj = env->NewGlobalRef(thiz);

    jclass localClass = env->GetObjectClass(thiz);
    g_runtimeClass = static_cast<jclass>(env->NewGlobalRef(localClass));
    env->DeleteLocalRef(localClass);

    if (!cacheKotlinMethods(env)) {
        ALOGE("nativeInitialize failed: method cache incomplete");
        return;
    }

    ALOGI("nativeInitialize done");
}

/**
 * Kotlin: private external fun nativeLaunch(
 *             rpkBytes: ByteArray, viewportWidth: Float, viewportHeight: Float): Boolean
 *
 * 启动 Runtime。阻塞直到首屏渲染完成或失败。
 *
 * @return true 启动成功
 */
JNIEXPORT jboolean JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeLaunch(
        JNIEnv* env, jobject /*thiz*/,
        jbyteArray rpkBytes, jfloat viewportWidth, jfloat viewportHeight) {

    if (rpkBytes == nullptr) {
        ALOGE("nativeLaunch: rpkBytes is null");
        return JNI_FALSE;
    }

    // ---- 1. 拷贝 RPK 到 C++ 侧 ----
    // 必须拷贝：Java 的 byte[] 由 GC 管理，
    // GetByteArrayElements 返回的指针在 Release 后失效，
    // 而 Core 需要它在整个 Runtime 生命周期内有效。
    const jsize len = env->GetArrayLength(rpkBytes);
    if (len <= 0) {
        ALOGE("nativeLaunch: empty rpk");
        return JNI_FALSE;
    }

    g_rpkData.resize(static_cast<size_t>(len));
    env->GetByteArrayRegion(rpkBytes, 0, len,
                            reinterpret_cast<jbyte*>(g_rpkData.data()));
    ALOGI("nativeLaunch: rpk copied, %d bytes", len);

    // ---- 2. 填 PlatformBridge ----
    quickapp::PlatformBridge bridge{};
    bridge.createElement = jniCreateElement;
    bridge.setAttr = jniSetAttr;
    bridge.setStyle = jniSetStyle;
    bridge.setEvent = jniSetEvent;
    bridge.removeElement = jniRemoveElement;
    bridge.showToast = jniShowToast;

    // ---- 3. 配置并启动 ----
    quickapp::RuntimeHostConfig cfg;
    cfg.bridge = bridge;
    cfg.rpkData = g_rpkData.data();
    cfg.rpkSize = g_rpkData.size();
    cfg.viewportWidth = static_cast<float>(viewportWidth);
    cfg.viewportHeight = static_cast<float>(viewportHeight);

    g_host = std::make_unique<quickapp::RuntimeHost>();

    if (!g_host->create(cfg)) {
        ALOGE("RuntimeHost::create failed: %s", g_host->getLastError().c_str());
        g_host.reset();
        return JNI_FALSE;
    }

    if (!g_host->start()) {
        ALOGE("RuntimeHost::start failed at stage [%s]: %s",
              g_host->failedStage().c_str(), g_host->getLastError().c_str());
        // 不 reset：让 Kotlin 侧还能调 nativeGetLastError 读错误信息
        return JNI_FALSE;
    }

    ALOGI("Runtime started: package=%s name=%s",
          g_host->packageName().c_str(), g_host->appName().c_str());
    return JNI_TRUE;
}

/**
 * Kotlin: private external fun nativeDispatchClick(nodeId: Int)
 *
 * 在 UI Thread 被调用，内部投递到 Runtime Thread。
 */
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeDispatchClick(
        JNIEnv* /*env*/, jobject /*thiz*/, jint nodeId) {
    if (g_host != nullptr) {
        g_host->dispatchClick(static_cast<int>(nodeId));
    }
}

/**
 * Kotlin: private external fun nativeDispatchInput(nodeId: Int, text: String)
 */
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeDispatchInput(
        JNIEnv* env, jobject /*thiz*/, jint nodeId, jstring text) {
    if (g_host == nullptr) {
        return;
    }
    const char* utf = (text != nullptr) ? env->GetStringUTFChars(text, nullptr)
                                        : nullptr;
    g_host->dispatchInput(static_cast<int>(nodeId), utf != nullptr ? utf : "");
    if (utf != nullptr) {
        env->ReleaseStringUTFChars(text, utf);
    }
}

/**
 * Kotlin: private external fun nativeDispatchLifecycle(hook: String)
 */
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeDispatchLifecycle(
        JNIEnv* env, jobject /*thiz*/, jstring hook) {
    if (g_host == nullptr || hook == nullptr) {
        return;
    }
    const char* utf = env->GetStringUTFChars(hook, nullptr);
    if (utf != nullptr) {
        g_host->dispatchLifecycle(utf);
        env->ReleaseStringUTFChars(hook, utf);
    }
}

/**
 * Kotlin: private external fun nativeGetTitleBarText(pageName: String): String
 *
 * 供 TitleBarView 渲染标题。
 */
JNIEXPORT jstring JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeGetTitleBarText(
        JNIEnv* env, jobject /*thiz*/, jstring pageName) {
    if (g_host == nullptr) {
        return env->NewStringUTF("");
    }

    const char* page = (pageName != nullptr)
                           ? env->GetStringUTFChars(pageName, nullptr) : nullptr;

    std::string title, bg, fg;
    g_host->getTitleBarConfig(page, title, bg, fg);

    if (page != nullptr) {
        env->ReleaseStringUTFChars(pageName, page);
    }
    return env->NewStringUTF(title.c_str());
}

/**
 * Kotlin: private external fun nativeGetLastError(): String
 *
 * 启动失败时给用户/开发者看的诊断信息。
 */
JNIEXPORT jstring JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeGetLastError(
        JNIEnv* env, jobject /*thiz*/) {
    if (g_host == nullptr) {
        return env->NewStringUTF("runtime not created");
    }
    const std::string msg = "[" + g_host->failedStage() + "] " +
                            g_host->getLastError();
    return env->NewStringUTF(msg.c_str());
}

/**
 * Kotlin: private external fun nativeRelease()
 *
 * Activity 销毁时调用。
 */
JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeRelease(
        JNIEnv* env, jobject /*thiz*/) {
    ALOGI("nativeRelease: destroying runtime");

    // 顺序很重要：
    // 1. 先销毁 Runtime（它会停线程、清 Bridge）
    if (g_host != nullptr) {
        g_host->destroy();
        g_host.reset();
    }

    // 2. 再释放 RPK 数据（Runtime 已停，没人会再读它）
    g_rpkData.clear();
    g_rpkData.shrink_to_fit();

    // 3. 最后释放 JNI Global Reference
    if (g_runtimeObj != nullptr) {
        env->DeleteGlobalRef(g_runtimeObj);
        g_runtimeObj = nullptr;
    }
    if (g_runtimeClass != nullptr) {
        env->DeleteGlobalRef(g_runtimeClass);
        g_runtimeClass = nullptr;
    }
    g_methods = KotlinMethods{};

    ALOGI("nativeRelease done");
}

} // extern "C"
```

### 11.2.5：Kotlin 侧的线程切换

`PlatformBridge` 的实现直接调用 Kotlin 方法，那些方法在 Runtime Thread 执行。Android View 只能在 UI Thread 操作，所以切换放在 Kotlin。

**@update `app/src/main/java/com/quickappkit/runtime/QuickAppRuntime.kt` — 替换渲染命令方法**

```kotlin
package com.quickappkit.runtime

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.FrameLayout
import android.widget.Toast

/**
 * Runtime 的 Android 端实现。
 *
 * 职责：加载 native 库、接收 C++ 渲染指令并投递到 UI 线程、回传事件。
 *
 * 线程模型：
 *   createElement 等方法被 C++ 从 Runtime Thread 调用，
 *   内部用 uiHandler.post 切到 UI Thread 再操作 View。
 */
class QuickAppRuntime(
    private val context: Context,
    private val container: FrameLayout,
) {
    private val renderer = ViewRenderer(context, container)

    // UI 线程的 Handler。渲染命令通过它投递。
    // Handler.post 保证 FIFO 顺序，这是 PlatformBridge 要求的
    // "同一批命令按提交顺序执行"（Step 06 的约定）。
    private val uiHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "QuickAppRuntime"
        init { System.loadLibrary("quickapp-runtime-core") }
    }

    // ---- 对外 API ----

    fun initialize() = nativeInitialize()

    /**
     * 启动快应用。
     *
     * @param rpkBytes RPK 完整字节内容
     * @return true 启动成功；false 时用 getLastError() 取原因
     */
    fun launch(rpkBytes: ByteArray): Boolean {
        // 视口 = 容器实际尺寸。
        // 容器已经在标题栏下方，所以不需要额外减去标题栏高度。
        val w = container.width.takeIf { it > 0 } ?: context.resources.displayMetrics.widthPixels
        val h = container.height.takeIf { it > 0 } ?: context.resources.displayMetrics.heightPixels
        Log.i(TAG, "launch: rpk=${rpkBytes.size} bytes, viewport=${w}x${h}")
        return nativeLaunch(rpkBytes, w.toFloat(), h.toFloat())
    }

    fun getLastError(): String = nativeGetLastError()
    fun getTitleBarText(pageName: String = ""): String = nativeGetTitleBarText(pageName)

    fun onShow() = nativeDispatchLifecycle("onShow")
    fun onHide() = nativeDispatchLifecycle("onHide")

    fun release() = nativeRelease()

    // ---- native 方法声明（签名与抽取前保持一致） ----

    private external fun nativeInitialize()
    private external fun nativeLaunch(
        rpkBytes: ByteArray, viewportWidth: Float, viewportHeight: Float): Boolean
    private external fun nativeDispatchClick(nodeId: Int)
    private external fun nativeDispatchInput(nodeId: Int, text: String)
    private external fun nativeDispatchLifecycle(hook: String)
    private external fun nativeGetTitleBarText(pageName: String): String
    private external fun nativeGetLastError(): String
    private external fun nativeRelease()

    // ============================================================
    // C++ → Kotlin：渲染命令（由 Runtime Thread 调用）
    // ============================================================

    /**
     * 创建元素。由 C++ PlatformBridge.createElement 调用。
     *
     * 【线程】本方法在 Runtime Thread 执行，所以必须 post 到 UI Thread。
     */
    fun createElement(id: Int, type: String, x: Float, y: Float,
                      width: Float, height: Float) {
        uiHandler.post { renderer.createElement(id, type, x, y, width, height) }
    }

    /** 设置属性。线程约束同 createElement。 */
    fun setAttr(id: Int, key: String, value: String) {
        uiHandler.post { renderer.setAttr(id, key, value) }
    }

    /** 设置样式。线程约束同 createElement。 */
    fun setStyle(id: Int, key: String, value: String) {
        uiHandler.post { renderer.setStyle(id, key, value) }
    }

    /**
     * 绑定事件。
     *
     * 监听器里调 nativeDispatchClick 把事件送回 C++。
     * methodName 只用于日志，C++ 侧自己有 nodeId → 方法名的映射。
     */
    fun setEvent(id: Int, eventType: String, methodName: String) {
        uiHandler.post {
            renderer.setEvent(id, eventType) { nodeId ->
                Log.d(TAG, "event $eventType on node $nodeId -> $methodName")
                nativeDispatchClick(nodeId)
            }
        }
    }

    /** 删除元素。 */
    fun removeElement(id: Int) {
        uiHandler.post { renderer.removeElement(id) }
    }

    /** 显示 Toast。 */
    fun showToast(message: String) {
        uiHandler.post {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }
}
```

**`ViewRenderer` 不需要改动** —— 它的接口（`createElement` / `setAttr` / `setStyle` / `setEvent` / `removeElement`）和抽取前一致，只是现在由 `uiHandler.post` 包裹调用。

---

## Step 11.3：实测 Babel interop 风险

这是交接文档记录的风险 1，必须在真实 RPK 上验证。

### 11.3.1：问题回顾

core 原 `tasks.md` 的验收标准写的是：

```javascript
$app_require$("@app-module/system.router").default.push({uri:"/test"})
```

带 `.default`。而 Step 07 实现的 `native_app_require` 直接返回模块对象，Step 07/10 的测试写的是 `router.push(...)`，不带 `.default`。

如果工具链用 Babel 转换 ES Module，`import router from '@system.router'` 会被编译为：

```javascript
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
}
var _router = _interopRequireDefault($app_require$('@app-module/system.router'));
_router.default.push({ uri: '/x' });     // ← 多了一层 .default
```

Core 返回的对象没有 `__esModule` 标记，Babel 会包一层，实际访问路径变成 `_router.default.push`。这本身能工作（`default` 指向原对象）。但如果 Core 又提供了 `default` 字段，就会变成 `_router.default.default.push`。

### 11.3.2：实测步骤

```bash
RPK=/Users/qiaoyang/code/my-github/quickapp-kit/quickapp-examples/quickapp-code-test1/dist/com.example.case1.debug.1.0.0.rpk

# 1. 解出真实 bundle
mkdir -p /tmp/rpk-inspect && cd /tmp/rpk-inspect
unzip -o "$RPK" > /dev/null

# 2. 看 $app_require$ 的调用形态
grep -n "app_require" pages/Demo/index.js | head -20

# 3. 检查是否有 Babel interop 辅助函数
grep -n "_interopRequireDefault\|__esModule\|_interopRequireWildcard" \
     pages/Demo/index.js app.js

# 4. 看模块方法的实际调用路径
grep -nE "\.push\(|\.showToast\(|\.default\." pages/Demo/index.js | head -20
```

### 11.3.3：三种可能的结果与对应处理

**结果 A：无 Babel interop（直接调用）**

```javascript
var router = $app_require$('@app-module/system.router');
router.push({ uri: '/pages/DemoDetail' });
```

→ Step 07 的实现正确，**无需改动**。这是编译产物没走 Babel ES Module 转换的情况（工具链直接产出 CommonJS 风格）。

**结果 B：有 interop 且访问 `.default`**

```javascript
var _systemRouter = _interopRequireDefault($app_require$('@app-module/system.router'));
_systemRouter.default.push({ uri: '/x' });
```

→ 也能工作：`_interopRequireDefault` 发现没有 `__esModule`，返回 `{ default: 原对象 }`，`.default.push` 正确解析。**无需改动**，但要在文档里注明这个依赖。

**结果 C：有 interop 且直接访问（无 `.default`）**

```javascript
var _systemRouter = _interopRequireDefault($app_require$('@app-module/system.router'));
_systemRouter.push({ uri: '/x' });      // ← 直接访问，不带 .default
```

→ **会失败**：`_systemRouter` 是 `{ default: 原对象 }`，没有 `push` 方法。

修复方案：给模块对象加 `__esModule` 标记，让 Babel 跳过包装。

**@update `src/native_module.cpp` — 在 `createJSObject` 的 `JS_SetOpaque` 之后插入（仅在结果 C 时应用）**

```cpp
JSValue NativeModule::createJSObject(JSContext* ctx) {
    // ... 前略 ...
    JS_SetOpaque(obj, this);

    // Babel interop 兼容。
    //
    // 背景：工具链用 Babel 转换 ES Module 时会生成
    //   _interopRequireDefault(obj) { return obj.__esModule ? obj : {default: obj}; }
    // 如果模块对象没有 __esModule 标记，Babel 会包一层 { default: ... }，
    // 导致方法访问路径变成 _m.default.push 而非 _m.push。
    //
    // 加上这个标记让 Babel 认为它已经是 ES Module，直接返回原对象。
    JS_SetPropertyStr(ctx, obj, "__esModule", JS_TRUE);

    // 同时提供 default 自引用，兼容显式写 .default 的代码。
    //
    // 循环引用说明：obj.default === obj 形成自引用。
    // QuickJS 的 GC 是标记-清除（不是纯引用计数），能正确回收循环引用，
    // 所以这样做是安全的。
    JSValue self = JS_DupValue(ctx, obj);
    JS_SetPropertyStr(ctx, obj, "default", self);

    return obj;
}
```

加上这两行后，三种访问路径都能工作：

```javascript
mod.push(...)              // ✓ 原对象的方法
mod.default.push(...)      // ✓ default 自引用
_interop(mod).push(...)    // ✓ __esModule 让 interop 直接返回 mod
```

### 11.3.4：用测试固化结论

无论实测结果如何，都要加一个测试锁定行为。

**@add `tests/test_js_bridge.cpp` — 在 `testJSBridge` 的场景 3 之后插入**

```cpp
    // ---- 场景 3.5：Babel interop 兼容性 ----
    // 模拟 Babel 生成的 _interopRequireDefault，验证三种访问路径
    CHECK(engine->eval(
              "function _interopRequireDefault(obj) {"
              "  return obj && obj.__esModule ? obj : { default: obj };"
              "}",
              "<interop>"),
          "interop helper setup failed");

    // 路径 1：直接访问
    g_echoCallCount = 0;
    CHECK(engine->evalWithResult(
              "$app_require$('@app-module/test.echo').say('direct')",
              "<t>", result),
          "direct access failed");
    CHECK(result == "direct", "direct access result wrong");

    // 路径 2：经过 interop 后直接访问
    g_echoCallCount = 0;
    CHECK(engine->evalWithResult(
              "_interopRequireDefault($app_require$('@app-module/test.echo'))"
              ".say('via-interop')",
              "<t>", result),
          "access after interop failed — module may need __esModule marker");
    CHECK(result == "via-interop", "interop access result wrong");

    // 路径 3：显式 .default
    g_echoCallCount = 0;
    CHECK(engine->evalWithResult(
              "var _m = _interopRequireDefault("
              "  $app_require$('@app-module/test.echo'));"
              "(_m.default || _m).say('via-default')",
              "<t>", result),
          "default access failed");
    CHECK(result == "via-default", "default access result wrong");
```

这个测试在三种实现下的行为：

```text
不加 __esModule 和 default：
    路径 1 ✓  路径 2 ✗（interop 包了一层）  路径 3 ✓

只加 __esModule：
    路径 1 ✓  路径 2 ✓  路径 3 ✓（_m.default 是 undefined，走 || _m 分支）

加 __esModule + default：
    路径 1 ✓  路径 2 ✓  路径 3 ✓
```

所以推荐**两个都加**：覆盖全部形态，代价是两行代码和一个自引用。

### 11.3.5：Android 上的端到端验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android
./gradlew installDebug

adb logcat -c
adb shell am start -n com.quickappkit.runtime/.MainActivity
sleep 3

# 点击"跳转"按钮后看是否有 Router 日志
adb shell input tap 540 400    # 坐标按实际布局调整
sleep 1

adb logcat -d | grep -E "Router|app_require|TypeError|not a function"
```

预期（正常情况）：

```text
I/quickapp-core: [Bootstrap] click on node 4 -> vm.goDetail()
I/quickapp-core: [Router] push '/pages/DemoDetail', stack depth=1
I/quickapp-core: [Bootstrap] navigate to '/pages/DemoDetail' (isBack=0)
```

如果出现：

```text
E/quickapp-core: [JS] TypeError: _systemRouter.push is not a function
```

说明是结果 C，需要应用 11.3.3 的修复。

**把实测结论回写到交接文档的风险清单里**，标记为已解决并注明采用的方案。

---

## Step 11.4：Android 回归验证

### 11.4.1：编译验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android
./gradlew clean :app:assembleDebug
```

预期输出包含：

```text
> Task :app:configureCMakeDebug[arm64-v8a]
-- quickapp-core configuration:
--   Version:      1.0.0
--   C++ standard: 17
--   Log backend:  CALLBACK
--   Tests:        OFF
-- quickapp-runtime-android:
--   Core dir:  .../quickapp-runtime-core
--   ABI:       arm64-v8a
--   Platform:  android-24

> Task :app:buildCMakeDebug[arm64-v8a]
[  x%] Embedding framework.js into C++ header
[ xx%] Built target quickjs
[ xx%] Built target quickapp-core
[100%] Built target quickapp-runtime-core

BUILD SUCCESSFUL in 2m 14s
```

三个关键确认点：
- `Log backend: CALLBACK` — CMakeLists 的 `set(... FORCE)` 生效
- `Tests: OFF` — Core 的测试没被编译（`CMAKE_SOURCE_DIR` 判断生效）
- `Built target quickapp-core` — Core 作为静态库编译成功

**常见错误：**

```text
"quickapp-runtime-core not found at: ..."
    → QUICKAPP_CORE_DIR 路径错误。检查相对路径层级：
      cpp/ → main/ → src/ → app/ → android/ → quickapp-kit/
      共 5 层 ../

"CMake Error: The source directory ... does not contain a CMakeLists.txt"
    → 同上，或 Core 项目还没创建

"undefined reference to quickapp::RuntimeHost::RuntimeHost()"
    → target_link_libraries 缺 quickapp-core

"runtime_host.h: No such file or directory"
    → Core 的 PUBLIC include 没传递过来。
      检查 Core 的 target_include_directories 是否用了 PUBLIC

"error: 'quickjs.h' file not found"（编译 jni_bridge.cpp 时）
    → jni_bridge.cpp 误 include 了 native_module.h 或其他内部头文件。
      平台层只能用 platform_bridge.h / runtime_host.h / qa_log.h

"ninja: error: ... framework_js.h missing and no known rule to make it"
    → Core 的 add_dependencies(quickapp-core embed_framework_js) 丢了
```

### 11.4.2：产物对比

```bash
# 新的 .so 大小
find app/build -name "libquickapp-runtime-core.so" -exec ls -lh {} \;
```

和基线（11.2.1 记录的）对比。预期**接近**，差异来源：

```text
可能略大：新增了 framework.js 内嵌字符串（约 10KB）
          新增了 runtime_host.cpp / runtime_bootstrap.cpp 的代码
可能略小：Core 编译时开了 -Wall -Wextra 但优化级别相同，
          且删除了原来重复的日志宏定义
```

差异超过 20% 需要排查（可能是优化级别或 strip 设置变了）。

确认符号完整性：

```bash
SO=$(find app/build -name "libquickapp-runtime-core.so" | head -1)

# JNI 导出函数必须存在
nm -D "$SO" | grep "Java_com_quickappkit" | sort
```

预期 8 个：

```text
Java_com_quickappkit_runtime_QuickAppRuntime_nativeDispatchClick
Java_com_quickappkit_runtime_QuickAppRuntime_nativeDispatchInput
Java_com_quickappkit_runtime_QuickAppRuntime_nativeDispatchLifecycle
Java_com_quickappkit_runtime_QuickAppRuntime_nativeGetLastError
Java_com_quickappkit_runtime_QuickAppRuntime_nativeGetTitleBarText
Java_com_quickappkit_runtime_QuickAppRuntime_nativeInitialize
Java_com_quickappkit_runtime_QuickAppRuntime_nativeLaunch
Java_com_quickappkit_runtime_QuickAppRuntime_nativeRelease
```

Core 的符号应该被隐藏（静态库链接后不导出）：

```bash
nm -D "$SO" | grep -c "quickapp::RuntimeHost"
# 预期 0：Core 符号是内部的，不需要导出给外部
```

### 11.4.3：运行验证

```bash
./gradlew installDebug

adb logcat -c
adb shell am start -n com.quickappkit.runtime/.MainActivity
sleep 4
adb logcat -d | grep -E "quickapp-core|quickapp-android|QuickAppRuntime" \
    > /tmp/after-log.txt

wc -l /tmp/baseline-log.txt /tmp/after-log.txt
```

预期日志包含完整的 11 阶段启动：

```text
I/quickapp-android: JNI_OnLoad: log handler registered
I/quickapp-android: nativeInitialize done
I/quickapp-android: nativeLaunch: rpk copied, NNNNN bytes
I/quickapp-core: [RuntimeHost] created: rpk=NNNNN bytes, viewport=1080x1800
I/quickapp-core: [JSEngine] initialized (QuickJS, memLimit=64MB, stackLimit=1MB)
I/quickapp-core: [Bootstrap] === starting runtime ===
I/quickapp-core: [Bootstrap] 1/11 registered 2 modules
...
I/quickapp-core: [Bootstrap] 11/11 page rendered: N nodes
I/quickapp-core: [Bootstrap] === runtime started successfully ===
I/quickapp-android: Runtime started: package=com.example.case1 name=快应用示例
I/QuickAppRuntime: Created text view, id=2
```

日志前缀说明：
- `quickapp-android` — 平台层的 `ALOGI`
- `quickapp-core` — Core 通过 `androidLogHandler` 输出的
- `QuickAppRuntime` — Kotlin 侧的 `Log.i`

三个前缀都出现，说明日志抽象层（Step 03）在真实环境工作正常。

### 11.4.4：截图对比

```bash
adb exec-out screencap -p > /tmp/after-screen.png

# 有 ImageMagick 时做像素级对比
if command -v compare > /dev/null; then
    compare -metric AE /tmp/baseline-screen.png /tmp/after-screen.png \
            /tmp/diff.png 2>&1 || true
    echo "（AE = 不同像素数，0 表示完全一致）"
else
    echo "手动对比 /tmp/baseline-screen.png 和 /tmp/after-screen.png"
fi
```

预期：视觉上完全一致。少量像素差异可能来自状态栏时间、电量图标，不是问题。

如果布局明显不同，排查方向：

```text
文字位置偏移   → viewportWidth/Height 传入值不对
元素全部缺失   → PlatformBridge 未注册成功，看 isReady 的日志
颜色不对       → setStyle 的键名或值格式变了
标题栏空白     → nativeGetTitleBarText 返回空，检查 manifest 解析
```

### 11.4.5：交互验证

```bash
adb logcat -c

# 点击按钮（坐标按实际布局调整）
adb shell input tap 540 400
sleep 1
adb logcat -d | grep -E "click on node|Router|Prompt|showToast"
```

预期：

```text
D/QuickAppRuntime: event click on node 4 -> goDetail
I/quickapp-core: [Bootstrap] click on node 4 -> vm.goDetail()
I/quickapp-core: [Router] push '/pages/DemoDetail', stack depth=1
I/quickapp-core: [RenderPipeline] removing previous page (N nodes)
I/quickapp-core: [RenderPipeline] rendered M nodes, index size=M
```

完整链路在真机上打通：

```text
Android 触摸 → Kotlin OnClickListener → nativeDispatchClick
    → PlatformEventSink（跨线程）→ Runtime Thread
    → RenderPipeline.findNode → node->events["click"]
    → framework.js __invoke_vm_method__ → vm.goDetail()
    → JS router.push → C++ RouterModule → navigate
    → 读新 bundle → eval → 渲染 → PlatformBridge
    → uiHandler.post → ViewRenderer → Android View
```

### 11.4.6：生命周期与销毁验证

```bash
adb logcat -c

# 后台/前台切换
adb shell input keyevent KEYCODE_HOME
sleep 1
adb shell am start -n com.quickappkit.runtime/.MainActivity
sleep 1

# 返回键退出（触发 onDestroy → nativeRelease）
adb shell input keyevent KEYCODE_BACK
sleep 2

adb logcat -d | grep -E "onHide|onShow|nativeRelease|destroyed|shutdown"
```

预期：

```text
I/quickapp-core: [Bootstrap] lifecycle: onHide
I/quickapp-core: [Bootstrap] lifecycle: onShow
I/quickapp-android: nativeRelease: destroying runtime
I/quickapp-core: [Bootstrap] === shutting down ===
I/quickapp-core: [EventSink] shutdown
I/quickapp-core: [RenderPipeline] shutdown
I/quickapp-core: [ModuleRegistry] cleared 2 modules
I/quickapp-core: [Bootstrap] === shutdown complete ===
I/quickapp-core: [RuntimeThread] joined
I/quickapp-core: [RuntimeHost] destroyed
I/quickapp-android: nativeRelease done
```

销毁顺序和 Step 10 设计的一致。确认没有崩溃：

```bash
adb logcat -d | grep -E "FATAL|SIGSEGV|SIGABRT|Fatal signal"
# 预期无输出
```

### 11.4.7：反复启动验证

```bash
for i in 1 2 3 4 5; do
    adb shell am force-stop com.quickappkit.runtime
    sleep 1
    adb shell am start -n com.quickappkit.runtime/.MainActivity
    sleep 2
done

adb logcat -d | grep -cE "runtime started successfully"
# 预期 >= 5

adb logcat -d | grep -E "FATAL|SIGSEGV"
# 预期无输出
```

### 11.4.8：验证通过后清理备份

```bash
# 确认全部验证通过后再删
rm -f /tmp/android-cpp-backup.tar.gz
rm -f /tmp/baseline-log.txt /tmp/after-log.txt
rm -f /tmp/baseline-screen.png /tmp/after-screen.png /tmp/diff.png
rm -rf /tmp/rpk-inspect
```

---

## Step 11.5：iOS 集成方案

无 iOS 工程可验证，本节给出可直接使用的方案和代码。

### 11.5.1：Core 的编译方式

iOS 有两种引入 Core 的方式：

```text
方案 A：CMake 生成 Xcode 项目（推荐）
    cmake -B build-ios -G Xcode \
      -DCMAKE_SYSTEM_NAME=iOS \
      -DCMAKE_OSX_ARCHITECTURES="arm64" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
      -DQUICKAPP_CORE_BUILD_TESTS=OFF \
      -DQUICKAPP_LOG_BACKEND=CALLBACK
    cmake --build build-ios --config Release
    → 产出 libquickapp-core.a + libquickjs.a，拖进 Xcode 项目

方案 B：源码直接加入 Xcode 项目
    把 Core 的 src/ 和 third_party/quickjs/ 加入 Compile Sources，
    include/ 加入 Header Search Paths
    → 缺点：framework.js 的内嵌需要手动跑 embed_js.cmake，
      且 QuickJS 的编译选项要手动配（C99 + 关警告）
```

选方案 A。iOS 的架构组合：

```bash
# 真机 arm64
cmake -B build-ios-device -G Xcode \
  -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
  -DQUICKAPP_CORE_BUILD_TESTS=OFF -DQUICKAPP_LOG_BACKEND=CALLBACK

# 模拟器（Apple Silicon 是 arm64，Intel 是 x86_64）
cmake -B build-ios-sim -G Xcode \
  -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_SYSROOT=iphonesimulator \
  -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
  -DQUICKAPP_CORE_BUILD_TESTS=OFF -DQUICKAPP_LOG_BACKEND=CALLBACK

# 合并为 XCFramework（可选，便于分发）
xcodebuild -create-xcframework \
  -library build-ios-device/Release-iphoneos/libquickapp-core.a \
  -library build-ios-sim/Release-iphonesimulator/libquickapp-core.a \
  -output QuickAppCore.xcframework
```

**注意：** `CMAKE_POSITION_INDEPENDENT_CODE ON`（Step 02 设置的）对 iOS 是必需的，否则链接进 app binary 时报重定位错误。

### 11.5.2：ObjC++ 平台层

文件必须用 `.mm` 扩展名（ObjC++ 混编），不能是 `.m` 或 `.cpp`。

**@add `ios/QuickAppBridge.mm`（新建文件）**

第一部分：全局状态与渲染器接口。

```objc
//
//  QuickAppBridge.mm
//  iOS 平台适配层
//
//  职责：
//    1. 实现 PlatformBridge 的 6 个函数，转为 UIKit 操作
//    2. 把 UIControl 事件回传给 Core
//    3. 提供 os_log 日志后端
//    4. 管理 RuntimeHost 生命周期
//
//  线程模型：
//    Core 在 Runtime Thread 调用 PlatformBridge 函数，
//    本文件用 dispatch_async(dispatch_get_main_queue()) 切到主线程。
//
//  文件必须是 .mm：需要同时编译 Objective-C 和 C++。
//

#import <UIKit/UIKit.h>
#import <os/log.h>

#include <memory>
#include <string>
#include <vector>

// Core 的公开头文件
#include "platform_bridge.h"
#include "qa_log.h"
#include "runtime_host.h"

// ============================================================
// ViewRenderer：nodeId → UIView 的映射与操作
// ============================================================

/**
 * iOS 端的视图渲染器。
 *
 * 职责：维护 nodeId → UIView 映射，把渲染命令转为 UIKit 调用。
 *
 * 线程约束：所有方法必须在主线程调用（UIKit 要求）。
 *          调用方（PlatformBridge 实现）负责 dispatch 到主线程。
 */
@interface QuickAppViewRenderer : NSObject

/** 根容器，所有创建的视图都加到它下面 */
@property (nonatomic, strong) UIView *containerView;

/**
 * 创建元素。
 * @param nodeId 节点 ID
 * @param type   "div" / "text" / "input"
 * @param frame  布局计算出的位置和尺寸（物理像素需转为 point）
 */
- (void)createElement:(int)nodeId type:(NSString *)type frame:(CGRect)frame;

/** 设置属性 */
- (void)setAttr:(int)nodeId key:(NSString *)key value:(NSString *)value;

/** 设置样式 */
- (void)setStyle:(int)nodeId key:(NSString *)key value:(NSString *)value;

/**
 * 绑定事件。
 * @param handler 事件触发时调用，参数是 nodeId
 */
- (void)setEvent:(int)nodeId
       eventType:(NSString *)eventType
         handler:(void (^)(int))handler;

/** 删除元素 */
- (void)removeElement:(int)nodeId;

/** 清空所有元素 */
- (void)removeAll;

@end

@implementation QuickAppViewRenderer {
    // nodeId → UIView
    NSMutableDictionary<NSNumber *, UIView *> *_viewMap;
    // nodeId → 事件回调（UIButton 的 target-action 无法直接带 block）
    NSMutableDictionary<NSNumber *, void (^)(int)> *_handlerMap;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _viewMap = [NSMutableDictionary dictionary];
        _handlerMap = [NSMutableDictionary dictionary];
    }
    return self;
}

- (void)createElement:(int)nodeId type:(NSString *)type frame:(CGRect)frame {
    UIView *view = nil;

    if ([type isEqualToString:@"div"]) {
        view = [[UIView alloc] initWithFrame:frame];

    } else if ([type isEqualToString:@"text"]) {
        UILabel *label = [[UILabel alloc] initWithFrame:frame];
        label.numberOfLines = 0;              // 允许多行
        label.textColor = UIColor.blackColor;
        label.font = [UIFont systemFontOfSize:16];
        view = label;

    } else if ([type isEqualToString:@"input"]) {
        // V1 只处理 button 类型（attr.type 在 setAttr 时到达，
        // 这里先按 button 创建，是 V1 的简化）
        UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
        button.frame = frame;
        button.tag = nodeId;                  // 事件回传时用它取 nodeId
        view = button;

    } else {
        os_log_error(OS_LOG_DEFAULT, "unknown element type: %{public}@", type);
        return;
    }

    _viewMap[@(nodeId)] = view;
    [self.containerView addSubview:view];
}

- (void)setAttr:(int)nodeId key:(NSString *)key value:(NSString *)value {
    UIView *view = _viewMap[@(nodeId)];
    if (view == nil) {
        return;
    }

    // text 和 input 的内容都在 "value" 属性里（快应用规范）
    if ([key isEqualToString:@"value"]) {
        if ([view isKindOfClass:UILabel.class]) {
            ((UILabel *)view).text = value;
        } else if ([view isKindOfClass:UIButton.class]) {
            [((UIButton *)view) setTitle:value forState:UIControlStateNormal];
        }
    }
    // 其他属性（type / placeholder）V1 暂不处理
}

- (void)setStyle:(int)nodeId key:(NSString *)key value:(NSString *)value {
    UIView *view = _viewMap[@(nodeId)];
    if (view == nil) {
        return;
    }

    if ([key isEqualToString:@"backgroundColor"]) {
        view.backgroundColor = [self colorFromHexString:value];

    } else if ([key isEqualToString:@"color"]) {
        UIColor *color = [self colorFromHexString:value];
        if ([view isKindOfClass:UILabel.class]) {
            ((UILabel *)view).textColor = color;
        } else if ([view isKindOfClass:UIButton.class]) {
            [((UIButton *)view) setTitleColor:color forState:UIControlStateNormal];
        }

    } else if ([key isEqualToString:@"fontSize"]) {
        const CGFloat size = [self parsePixels:value];
        if ([view isKindOfClass:UILabel.class]) {
            ((UILabel *)view).font = [UIFont systemFontOfSize:size];
        } else if ([view isKindOfClass:UIButton.class]) {
            ((UIButton *)view).titleLabel.font = [UIFont systemFontOfSize:size];
        }

    } else if ([key isEqualToString:@"textAlign"]) {
        if ([view isKindOfClass:UILabel.class]) {
            UILabel *label = (UILabel *)view;
            if ([value isEqualToString:@"center"]) {
                label.textAlignment = NSTextAlignmentCenter;
            } else if ([value isEqualToString:@"right"]) {
                label.textAlignment = NSTextAlignmentRight;
            } else {
                label.textAlignment = NSTextAlignmentLeft;
            }
        }

    } else if ([key isEqualToString:@"borderRadius"]) {
        view.layer.cornerRadius = [self parsePixels:value];
        view.clipsToBounds = YES;
    }
    // width/height/margin/padding 已由 Core 的 LayoutEngine 算进 frame，
    // 这里不需要处理
}

- (void)setEvent:(int)nodeId
       eventType:(NSString *)eventType
         handler:(void (^)(int))handler {
    UIView *view = _viewMap[@(nodeId)];
    if (view == nil || handler == nil) {
        return;
    }

    if ([eventType isEqualToString:@"click"]) {
        _handlerMap[@(nodeId)] = handler;

        if ([view isKindOfClass:UIButton.class]) {
            [((UIButton *)view) addTarget:self
                                   action:@selector(onControlTapped:)
                         forControlEvents:UIControlEventTouchUpInside];
        } else {
            // 非按钮元素用手势识别
            UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc]
                initWithTarget:self action:@selector(onViewTapped:)];
            view.userInteractionEnabled = YES;
            [view addGestureRecognizer:tap];
            view.tag = nodeId;
        }
    }
}

/** UIButton 的 target-action 回调 */
- (void)onControlTapped:(UIButton *)sender {
    void (^handler)(int) = _handlerMap[@(sender.tag)];
    if (handler != nil) {
        handler((int)sender.tag);
    }
}

/** 手势识别回调 */
- (void)onViewTapped:(UITapGestureRecognizer *)gesture {
    const int nodeId = (int)gesture.view.tag;
    void (^handler)(int) = _handlerMap[@(nodeId)];
    if (handler != nil) {
        handler(nodeId);
    }
}

- (void)removeElement:(int)nodeId {
    UIView *view = _viewMap[@(nodeId)];
    if (view != nil) {
        [view removeFromSuperview];
        [_viewMap removeObjectForKey:@(nodeId)];
        [_handlerMap removeObjectForKey:@(nodeId)];
    }
}

- (void)removeAll {
    for (UIView *view in _viewMap.allValues) {
        [view removeFromSuperview];
    }
    [_viewMap removeAllObjects];
    [_handlerMap removeAllObjects];
}

/**
 * 解析 CSS 颜色字符串。
 * @param hex "#RRGGBB" 或 "#AARRGGBB"
 * @return UIColor；解析失败返回 clearColor
 */
- (UIColor *)colorFromHexString:(NSString *)hex {
    if (hex.length < 7 || ![hex hasPrefix:@"#"]) {
        return UIColor.clearColor;
    }
    unsigned int value = 0;
    NSScanner *scanner = [NSScanner scannerWithString:[hex substringFromIndex:1]];
    if (![scanner scanHexInt:&value]) {
        return UIColor.clearColor;
    }

    if (hex.length == 9) {
        // #AARRGGBB
        return [UIColor colorWithRed:((value >> 16) & 0xFF) / 255.0
                              green:((value >> 8) & 0xFF) / 255.0
                               blue:(value & 0xFF) / 255.0
                              alpha:((value >> 24) & 0xFF) / 255.0];
    }
    // #RRGGBB
    return [UIColor colorWithRed:((value >> 16) & 0xFF) / 255.0
                          green:((value >> 8) & 0xFF) / 255.0
                           blue:(value & 0xFF) / 255.0
                          alpha:1.0];
}

/**
 * 解析 CSS 长度为 CGFloat。
 * @param value "16px" 或 "16"
 * @return 数值；解析失败返回 0
 */
- (CGFloat)parsePixels:(NSString *)value {
    return (CGFloat)[value floatValue];   // floatValue 自动忽略 "px" 后缀
}

@end
```


第二部分：PlatformBridge 实现与 RuntimeHost 封装。

```objc
// ============================================================
// 全局状态
// ============================================================

namespace {

// 渲染器实例。
// 用 __strong 修饰的全局 ObjC 对象指针，ARC 会保持它存活。
QuickAppViewRenderer* __strong g_renderer = nil;

// Runtime 与 RPK 数据
std::unique_ptr<quickapp::RuntimeHost> g_host;
std::vector<uint8_t> g_rpkData;

// iOS 的 scale factor。
// Core 的布局用物理像素，UIKit 用 point（1 point = scale 物理像素）。
// 必须转换，否则 Retina 屏上所有元素会大一倍。
CGFloat g_scale = 1.0;

/**
 * 把 Core 的物理像素转为 UIKit 的 point。
 * @param px 物理像素值
 * @return point 值
 */
inline CGFloat pxToPt(float px) {
    return static_cast<CGFloat>(px) / g_scale;
}

// ============================================================
// PlatformBridge 的 6 个实现
// ============================================================
//
// 这些函数在 Core 的 Runtime Thread 被调用。
// UIKit 必须在主线程操作，所以每个都 dispatch_async 到 main queue。
//
// 用 async 而非 sync：
//   sync 会阻塞 Runtime Thread 等待主线程，
//   如果主线程正在等 Runtime Thread（如 start() 阻塞期间）就死锁。
//   async 保证 FIFO 顺序，满足 PlatformBridge 的顺序要求（Step 06）。

void iosCreateElement(int id, const char* type,
                      float x, float y, float width, float height) {
    // 字符串必须在这里拷贝：
    // const char* 的生命周期只到函数返回（Step 06 的约定），
    // 而 block 是异步执行的
    NSString* typeStr = [NSString stringWithUTF8String:(type ? type : "")];
    const CGRect frame = CGRectMake(pxToPt(x), pxToPt(y),
                                    pxToPt(width), pxToPt(height));

    dispatch_async(dispatch_get_main_queue(), ^{
        [g_renderer createElement:id type:typeStr frame:frame];
    });
}

void iosSetAttr(int id, const char* key, const char* value) {
    NSString* k = [NSString stringWithUTF8String:(key ? key : "")];
    NSString* v = [NSString stringWithUTF8String:(value ? value : "")];
    dispatch_async(dispatch_get_main_queue(), ^{
        [g_renderer setAttr:id key:k value:v];
    });
}

void iosSetStyle(int id, const char* key, const char* value) {
    NSString* k = [NSString stringWithUTF8String:(key ? key : "")];
    NSString* v = [NSString stringWithUTF8String:(value ? value : "")];
    dispatch_async(dispatch_get_main_queue(), ^{
        [g_renderer setStyle:id key:k value:v];
    });
}

void iosSetEvent(int id, const char* eventType, const char* methodName) {
    NSString* type = [NSString stringWithUTF8String:(eventType ? eventType : "")];
    NSString* method = [NSString stringWithUTF8String:(methodName ? methodName : "")];

    dispatch_async(dispatch_get_main_queue(), ^{
        [g_renderer setEvent:id eventType:type handler:^(int nodeId) {
            // 事件回传。
            // 这个 block 在主线程执行（UIKit 事件），
            // dispatchClick 内部会投递到 Runtime Thread（Step 06 的 EventSink）
            os_log_debug(OS_LOG_DEFAULT,
                         "event %{public}@ on node %d -> %{public}@",
                         type, nodeId, method);
            if (g_host != nullptr) {
                g_host->dispatchClick(nodeId);
            }
        }];
    });
}

void iosRemoveElement(int id) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [g_renderer removeElement:id];
    });
}

void iosShowToast(const char* message) {
    NSString* msg = [NSString stringWithUTF8String:(message ? message : "")];

    dispatch_async(dispatch_get_main_queue(), ^{
        // iOS 没有原生 Toast。这里用最简实现：
        // 一个半透明的 UILabel，2 秒后淡出。
        // 生产环境建议用成熟的第三方库或自定义组件。
        UIWindow* window = UIApplication.sharedApplication.windows.firstObject;
        if (window == nil) {
            return;
        }

        UILabel* toast = [[UILabel alloc] init];
        toast.text = msg;
        toast.textColor = UIColor.whiteColor;
        toast.backgroundColor = [UIColor colorWithWhite:0 alpha:0.75];
        toast.textAlignment = NSTextAlignmentCenter;
        toast.font = [UIFont systemFontOfSize:14];
        toast.numberOfLines = 0;
        toast.layer.cornerRadius = 8;
        toast.clipsToBounds = YES;

        const CGSize maxSize = CGSizeMake(window.bounds.size.width - 80, 200);
        CGSize fit = [toast sizeThatFits:maxSize];
        fit.width += 32;
        fit.height += 20;

        toast.frame = CGRectMake((window.bounds.size.width - fit.width) / 2,
                                 window.bounds.size.height - fit.height - 100,
                                 fit.width, fit.height);
        [window addSubview:toast];

        [UIView animateWithDuration:0.3 delay:1.7 options:0 animations:^{
            toast.alpha = 0;
        } completion:^(BOOL finished) {
            [toast removeFromSuperview];
        }];
    });
}

/**
 * Core 日志 → os_log 的桥接。
 *
 * 通过 quickapp::setLogHandler 注册（Step 03 的机制）。
 *
 * @param level   Core 的日志级别
 * @param tag     固定为 "quickapp-core"
 * @param message 已格式化的日志文本
 */
void iosLogHandler(quickapp::LogLevel level, const char* tag,
                   const char* message) {
    // os_log 的类型必须是编译期常量，所以用 switch 而不是变量
    switch (level) {
        case quickapp::LogLevel::Verbose:
        case quickapp::LogLevel::Debug:
            os_log_debug(OS_LOG_DEFAULT, "[%{public}s] %{public}s", tag, message);
            break;
        case quickapp::LogLevel::Warn:
            os_log(OS_LOG_DEFAULT, "[%{public}s] WARN %{public}s", tag, message);
            break;
        case quickapp::LogLevel::Error:
            os_log_error(OS_LOG_DEFAULT, "[%{public}s] %{public}s", tag, message);
            break;
        default:
            os_log_info(OS_LOG_DEFAULT, "[%{public}s] %{public}s", tag, message);
            break;
    }
}

} // namespace

// ============================================================
// 对外的 Objective-C 接口
// ============================================================

/**
 * iOS 侧的 Runtime 封装。
 *
 * 用法（在 UIViewController 里）：
 *   self.runtime = [[QuickAppRuntime alloc] initWithContainer:self.view];
 *   NSData *rpk = [NSData dataWithContentsOfFile:rpkPath];
 *   if (![self.runtime launchWithRPK:rpk]) {
 *       NSLog(@"launch failed: %@", self.runtime.lastError);
 *   }
 *   // dealloc 或 viewDidDisappear 时：
 *   [self.runtime release];
 */
@interface QuickAppRuntime : NSObject

/**
 * 创建 Runtime。
 * @param container 承载渲染结果的容器视图
 */
- (instancetype)initWithContainer:(UIView *)container;

/**
 * 启动快应用。阻塞直到首屏渲染完成或失败（约 30-80ms）。
 * @param rpkData RPK 完整字节内容
 * @return YES 启动成功
 */
- (BOOL)launchWithRPK:(NSData *)rpkData;

/** 最近一次错误描述 */
@property (nonatomic, readonly) NSString *lastError;

/** 应用显示名（来自 manifest），可用作导航栏标题 */
@property (nonatomic, readonly) NSString *appName;

/**
 * 获取页面标题栏文字。
 * @param pageName 页面标识，传 nil 表示入口页
 */
- (NSString *)titleBarTextForPage:(nullable NSString *)pageName;

/** 通知 Runtime 页面显示 */
- (void)notifyShow;

/** 通知 Runtime 页面隐藏 */
- (void)notifyHide;

/** 更新视口（旋转时调用） */
- (void)updateViewport:(CGSize)size;

/** 销毁 Runtime。dealloc 会自动调用 */
- (void)shutdown;

@end

@implementation QuickAppRuntime {
    UIView *_container;
}

- (instancetype)initWithContainer:(UIView *)container {
    self = [super init];
    if (self) {
        _container = container;
        g_scale = UIScreen.mainScreen.scale;

        g_renderer = [[QuickAppViewRenderer alloc] init];
        g_renderer.containerView = container;

        // 尽早注册日志后端
        quickapp::setLogHandler(iosLogHandler);
    }
    return self;
}

- (void)dealloc {
    [self shutdown];
}

- (BOOL)launchWithRPK:(NSData *)rpkData {
    if (rpkData.length == 0) {
        os_log_error(OS_LOG_DEFAULT, "launchWithRPK: empty data");
        return NO;
    }

    // 拷贝 RPK 到 C++ 侧。
    // 必须拷贝：NSData 由 ARC 管理，Core 需要指针在整个生命周期有效
    g_rpkData.resize(rpkData.length);
    memcpy(g_rpkData.data(), rpkData.bytes, rpkData.length);

    // 填 Bridge
    quickapp::PlatformBridge bridge{};
    bridge.createElement = iosCreateElement;
    bridge.setAttr = iosSetAttr;
    bridge.setStyle = iosSetStyle;
    bridge.setEvent = iosSetEvent;
    bridge.removeElement = iosRemoveElement;
    bridge.showToast = iosShowToast;

    // 视口：point 转物理像素（Core 用物理像素）
    const CGSize size = _container.bounds.size;

    quickapp::RuntimeHostConfig cfg;
    cfg.bridge = bridge;
    cfg.rpkData = g_rpkData.data();
    cfg.rpkSize = g_rpkData.size();
    cfg.viewportWidth = static_cast<float>(size.width * g_scale);
    cfg.viewportHeight = static_cast<float>(size.height * g_scale);

    g_host = std::make_unique<quickapp::RuntimeHost>();

    if (!g_host->create(cfg)) {
        os_log_error(OS_LOG_DEFAULT, "create failed: %{public}s",
                     g_host->getLastError().c_str());
        return NO;
    }
    if (!g_host->start()) {
        os_log_error(OS_LOG_DEFAULT, "start failed at [%{public}s]: %{public}s",
                     g_host->failedStage().c_str(),
                     g_host->getLastError().c_str());
        return NO;
    }

    os_log(OS_LOG_DEFAULT, "runtime started: %{public}s",
           g_host->packageName().c_str());
    return YES;
}

- (NSString *)lastError {
    if (g_host == nullptr) {
        return @"runtime not created";
    }
    const std::string msg = "[" + g_host->failedStage() + "] " +
                            g_host->getLastError();
    return [NSString stringWithUTF8String:msg.c_str()];
}

- (NSString *)appName {
    if (g_host == nullptr) {
        return @"";
    }
    return [NSString stringWithUTF8String:g_host->appName().c_str()];
}

- (NSString *)titleBarTextForPage:(NSString *)pageName {
    if (g_host == nullptr) {
        return @"";
    }
    std::string title, bg, fg;
    g_host->getTitleBarConfig(pageName != nil ? pageName.UTF8String : nullptr,
                              title, bg, fg);
    return [NSString stringWithUTF8String:title.c_str()];
}

- (void)notifyShow {
    if (g_host != nullptr) {
        g_host->dispatchLifecycle("onShow");
    }
}

- (void)notifyHide {
    if (g_host != nullptr) {
        g_host->dispatchLifecycle("onHide");
    }
}

- (void)updateViewport:(CGSize)size {
    if (g_host != nullptr) {
        g_host->setViewport(static_cast<float>(size.width * g_scale),
                            static_cast<float>(size.height * g_scale));
    }
}

- (void)shutdown {
    if (g_host != nullptr) {
        g_host->destroy();
        g_host.reset();
    }
    g_rpkData.clear();
    g_rpkData.shrink_to_fit();

    // 清理视图。此时 Runtime 已停，不会再有渲染命令
    dispatch_async(dispatch_get_main_queue(), ^{
        [g_renderer removeAll];
    });
    g_renderer = nil;
}

@end
```

### 11.5.3：iOS 侧的注意事项

```text
1. 物理像素 vs point
   Core 的布局全部用物理像素（Android 的习惯）。
   iOS 的 UIKit 用 point。必须除以 UIScreen.mainScreen.scale。
   忘记转换的表现：Retina 屏上所有元素大 2-3 倍，超出屏幕。

2. dispatch_async 而非 sync
   sync 会在 start() 阻塞期间造成死锁：
     主线程调 start() → 阻塞等 Runtime Thread
     Runtime Thread 调 createElement → dispatch_sync 等主线程
     → 互相等待
   async 无此问题，且 main queue 是 serial queue，保证 FIFO 顺序。

3. 字符串必须在 block 外拷贝
   const char* 的生命周期只到 PlatformBridge 函数返回（Step 06 约定），
   block 是异步执行的。在 block 内用 stringWithUTF8String 会读到野指针。

4. Bitcode
   Xcode 14+ 已废弃 Bitcode。如果目标是旧版本，
   Core 编译时需加 -fembed-bitcode。

5. 文件扩展名必须是 .mm
   .m 是纯 ObjC，无法编译 C++（include "runtime_host.h" 会报错）。
```

---

## Step 11.6：LVGL 集成方案

嵌入式端的约束和移动端差异最大：内存小、可能单线程、无文件系统。

### 11.6.1：构建配置

**@add `cpp/CMakeLists.txt`（新建文件）**

```cmake
cmake_minimum_required(VERSION 3.22)

project(quickapp-runtime-cpp CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================
# 引入 Core（嵌入式配置）
# ============================================================

set(QUICKAPP_CORE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../quickapp-runtime-core"
    CACHE PATH "Path to quickapp-runtime-core")

if(NOT EXISTS "${QUICKAPP_CORE_DIR}/CMakeLists.txt")
    message(FATAL_ERROR "quickapp-runtime-core not found at ${QUICKAPP_CORE_DIR}")
endif()

# 嵌入式的关键配置差异：
#   TESTS OFF        目标板上跑不了 ctest
#   LOG_BACKEND      CALLBACK：不链接 stdio，日志走串口回调
#   LOG_MIN_LEVEL 3  只保留 WARN/ERROR，省 Flash（每条日志字符串都占空间）
set(QUICKAPP_CORE_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(QUICKAPP_LOG_BACKEND "CALLBACK" CACHE STRING "" FORCE)
set(QUICKAPP_LOG_MIN_LEVEL "3" CACHE STRING "" FORCE)

add_subdirectory(${QUICKAPP_CORE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/quickapp-core)

# ============================================================
# LVGL
# ============================================================

# LVGL 源码位置。可以是 submodule 或外部路径
set(LVGL_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/lvgl"
    CACHE PATH "Path to LVGL")

if(EXISTS "${LVGL_DIR}/CMakeLists.txt")
    add_subdirectory(${LVGL_DIR})
else()
    message(FATAL_ERROR
        "LVGL not found at ${LVGL_DIR}\n"
        "Get it with: git clone --depth 1 -b release/v8.3 "
        "https://github.com/lvgl/lvgl third_party/lvgl")
endif()

# ============================================================
# 平台层
# ============================================================

add_library(quickapp-lvgl STATIC
    src/lvgl_bridge.cpp
    src/lvgl_renderer.cpp
)

target_include_directories(quickapp-lvgl PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(quickapp-lvgl PUBLIC quickapp-core lvgl)

# ============================================================
# 模拟器可执行文件（桌面开发用 SDL 后端）
# ============================================================

option(QUICKAPP_LVGL_SIMULATOR "Build SDL simulator" ON)

if(QUICKAPP_LVGL_SIMULATOR)
    find_package(SDL2 QUIET)
    if(SDL2_FOUND)
        add_executable(quickapp-sim sim/main.cpp sim/sdl_driver.cpp)
        target_link_libraries(quickapp-sim PRIVATE quickapp-lvgl ${SDL2_LIBRARIES})
        target_include_directories(quickapp-sim PRIVATE ${SDL2_INCLUDE_DIRS})
        message(STATUS "  SDL simulator: enabled")
    else()
        message(STATUS "  SDL simulator: disabled (SDL2 not found)")
    endif()
endif()

message(STATUS "quickapp-runtime-cpp:")
message(STATUS "  Core:      ${QUICKAPP_CORE_DIR}")
message(STATUS "  LVGL:      ${LVGL_DIR}")
message(STATUS "  Log level: ${QUICKAPP_LOG_MIN_LEVEL} (WARN+)")
```

### 11.6.2：内存约束调整

嵌入式设备的 RAM 通常 512KB - 8MB，Core 的默认配置（QuickJS 64MB heap）跑不起来。

**@add `cpp/include/quickapp_lvgl_config.h`（新建文件）**

```cpp
#ifndef QUICKAPP_LVGL_CONFIG_H
#define QUICKAPP_LVGL_CONFIG_H

// 嵌入式平台的资源配置。
//
// 这些值需要根据目标硬件调整。给出的是 ESP32-S3（8MB PSRAM）的参考值。
//
// 如何确定合适的值：
//   1. 从保守值开始（JS heap 4MB）
//   2. 跑目标 RPK，观察 QuickJS 的 "out of memory" 日志
//   3. 逐步上调直到稳定，再留 30% 余量

namespace quickapp {
namespace lvgl {

// QuickJS 的堆上限。
// Core 默认 64MB（Step 04），嵌入式必须调小。
// 8MB PSRAM 的设备建议 4MB：LVGL 的显存缓冲也要占用。
constexpr size_t kJSHeapLimit = 4 * 1024 * 1024;

// QuickJS 的栈上限。
// 默认 1MB。嵌入式的线程栈通常只有 8-32KB，
// 但 QuickJS 的栈检查是基于它自己的计数，可以设大于实际线程栈。
// 设 256KB 兼顾递归深度和安全性。
constexpr size_t kJSStackLimit = 256 * 1024;

// 视口尺寸。按实际屏幕填。
constexpr float kScreenWidth = 480.0f;
constexpr float kScreenHeight = 320.0f;

// 标题栏高度（物理像素）。0 表示不显示标题栏
constexpr float kTitleBarHeight = 32.0f;

} // namespace lvgl
} // namespace quickapp

#endif
```

**注意：** `kJSHeapLimit` 目前无法通过 Core 的公开 API 配置 —— `QuickJSEngine::initialize` 里硬编码了 64MB（Step 04）。需要给 Core 加一个配置入口：

**@update Core 的 `include/js_engine.h` — 在 `createJSEngine()` 之前插入**

```cpp
// JS 引擎的资源限制配置。
//
// 默认值适用于移动设备。嵌入式平台需要调小，
// 否则 QuickJS 初始化时就会耗尽内存。
struct JSEngineLimits {
    // 堆上限（字节）。0 表示不限制（不推荐：不可信 JS 可能耗尽系统内存）
    size_t heapLimit = 64 * 1024 * 1024;

    // 栈上限（字节）。防止 JS 无限递归打爆原生栈
    size_t stackLimit = 1024 * 1024;
};

/**
 * 创建 JS 引擎，指定资源限制。
 *
 * @param limits 资源限制。默认值适用于移动设备
 * @return 引擎实例
 */
std::unique_ptr<JSEngine> createJSEngine(const JSEngineLimits& limits);
```

对应地 `RuntimeHostConfig` 也要加字段（否则平台层没法传进去）：

**@update Core 的 `include/runtime_host.h` — 在 `RuntimeHostConfig` 中追加**

```cpp
    // JS 引擎资源限制。嵌入式平台应调小。
    // 默认值（64MB heap / 1MB stack）适用于移动设备
    JSEngineLimits jsLimits;
```

这是 Step 11 发现的接口缺口，属于集成阶段的正常发现。改动很小（3 处），且对已有调用方向后兼容（默认值不变）。


### 11.6.3：LVGL Widget 渲染器

**@add `cpp/src/lvgl_renderer.cpp`（新建文件）**

```cpp
// LVGL 渲染器：nodeId → lv_obj_t 的映射与操作。
//
// 线程约束：
//   LVGL 不是线程安全的。所有 lv_* 调用必须在同一个线程
//   （通常是主循环所在线程）。
//   本文件的函数由 PlatformBridge 实现调用，
//   线程切换策略见 lvgl_bridge.cpp 的说明。

#include "lvgl_renderer.h"

#include <cstdlib>
#include <cstring>
#include <unordered_map>

#include "lvgl.h"
#include "qa_log.h"

namespace quickapp {
namespace lvgl {
namespace {

// nodeId → LVGL 对象
std::unordered_map<int, lv_obj_t*> g_objMap;

// nodeId → 事件回调
using ClickCallback = void (*)(int nodeId);
ClickCallback g_clickCallback = nullptr;

// 根容器
lv_obj_t* g_rootContainer = nullptr;

/**
 * 解析 CSS 颜色为 LVGL 颜色。
 *
 * @param hex "#RRGGBB" 或 "#AARRGGBB"（alpha 被忽略，LVGL 用独立的 opa）
 * @param out 输出参数，接收颜色
 * @return true 解析成功
 */
bool parseColor(const char* hex, lv_color_t& out) {
    if (hex == nullptr || hex[0] != '#') {
        return false;
    }
    const size_t len = std::strlen(hex);
    if (len != 7 && len != 9) {
        return false;
    }

    // 跳过 # 和可能的 alpha（前 2 位）
    const char* rgb = (len == 9) ? hex + 3 : hex + 1;

    char buf[7] = {0};
    std::memcpy(buf, rgb, 6);
    const long value = std::strtol(buf, nullptr, 16);

    out = lv_color_make(static_cast<uint8_t>((value >> 16) & 0xFF),
                        static_cast<uint8_t>((value >> 8) & 0xFF),
                        static_cast<uint8_t>(value & 0xFF));
    return true;
}

/**
 * 解析 CSS 长度为像素数。
 * @param value "16px" 或 "16"
 * @return 像素数；解析失败返回 0
 */
int32_t parseLength(const char* value) {
    if (value == nullptr) {
        return 0;
    }
    return static_cast<int32_t>(std::strtol(value, nullptr, 10));
}

/**
 * LVGL 事件回调。所有绑定了 click 的对象共用这一个。
 *
 * @param e LVGL 事件对象。用户数据里存了 nodeId
 */
void onLvglClicked(lv_event_t* e) {
    if (g_clickCallback == nullptr) {
        return;
    }
    // lv_event_get_user_data 返回注册时传入的指针。
    // 我们把 nodeId 直接编码进指针值（不分配内存），
    // 因为 nodeId 是小整数，指针宽度足够容纳。
    const int nodeId = static_cast<int>(
        reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    g_clickCallback(nodeId);
}

} // namespace

void initRenderer(lv_obj_t* rootContainer, ClickCallback callback) {
    g_rootContainer = rootContainer;
    g_clickCallback = callback;
    g_objMap.clear();
    QA_LOGI("[LVGL] renderer initialized");
}

void createElement(int nodeId, const char* type,
                   float x, float y, float width, float height) {
    if (g_rootContainer == nullptr || type == nullptr) {
        return;
    }

    lv_obj_t* obj = nullptr;

    if (std::strcmp(type, "div") == 0) {
        obj = lv_obj_create(g_rootContainer);
        // LVGL 的 lv_obj 默认有边框和圆角，清掉以匹配 div 的语义
        lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN);
        lv_obj_set_style_radius(obj, 0, LV_PART_MAIN);
        lv_obj_set_style_pad_all(obj, 0, LV_PART_MAIN);
        // 关掉滚动条：Core 已经算好了布局，不需要 LVGL 再处理溢出
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);

    } else if (std::strcmp(type, "text") == 0) {
        obj = lv_label_create(g_rootContainer);
        lv_label_set_long_mode(obj, LV_LABEL_LONG_WRAP);

    } else if (std::strcmp(type, "input") == 0) {
        // V1 只处理 button
        obj = lv_btn_create(g_rootContainer);
        // 按钮内部需要一个 label 来显示文字
        lv_obj_t* label = lv_label_create(obj);
        lv_obj_center(label);

    } else {
        QA_LOGW("[LVGL] unknown element type: %s", type);
        return;
    }

    // Core 已经算好绝对坐标，直接设置。
    // 用 lv_obj_set_pos 而不是 lv_obj_align：
    // Core 的坐标是相对根容器的绝对值，align 会引入额外的对齐计算。
    lv_obj_set_pos(obj, static_cast<lv_coord_t>(x), static_cast<lv_coord_t>(y));
    lv_obj_set_size(obj, static_cast<lv_coord_t>(width),
                    static_cast<lv_coord_t>(height));

    g_objMap[nodeId] = obj;
}

void setAttr(int nodeId, const char* key, const char* value) {
    auto it = g_objMap.find(nodeId);
    if (it == g_objMap.end() || key == nullptr || value == nullptr) {
        return;
    }
    lv_obj_t* obj = it->second;

    // text 和 button 的内容都在 "value"（快应用规范）
    if (std::strcmp(key, "value") == 0) {
        if (lv_obj_check_type(obj, &lv_label_class)) {
            lv_label_set_text(obj, value);
        } else if (lv_obj_check_type(obj, &lv_btn_class)) {
            // 按钮的文字在它的第一个子 label 上
            lv_obj_t* label = lv_obj_get_child(obj, 0);
            if (label != nullptr && lv_obj_check_type(label, &lv_label_class)) {
                lv_label_set_text(label, value);
            }
        }
    }
}

void setStyle(int nodeId, const char* key, const char* value) {
    auto it = g_objMap.find(nodeId);
    if (it == g_objMap.end() || key == nullptr || value == nullptr) {
        return;
    }
    lv_obj_t* obj = it->second;

    if (std::strcmp(key, "backgroundColor") == 0) {
        lv_color_t color;
        if (parseColor(value, color)) {
            lv_obj_set_style_bg_color(obj, color, LV_PART_MAIN);
            lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, LV_PART_MAIN);
        }

    } else if (std::strcmp(key, "color") == 0) {
        lv_color_t color;
        if (parseColor(value, color)) {
            if (lv_obj_check_type(obj, &lv_btn_class)) {
                lv_obj_t* label = lv_obj_get_child(obj, 0);
                if (label != nullptr) {
                    lv_obj_set_style_text_color(label, color, LV_PART_MAIN);
                }
            } else {
                lv_obj_set_style_text_color(obj, color, LV_PART_MAIN);
            }
        }

    } else if (std::strcmp(key, "fontSize") == 0) {
        // LVGL 的字体是编译期静态的，无法运行时任意缩放。
        // 只能在预置的几档里选最接近的。
        // 这是嵌入式的固有限制，需要在 lv_conf.h 里启用需要的字号。
        const int32_t size = parseLength(value);
        const lv_font_t* font = &lv_font_montserrat_14;
        if (size >= 24) {
            font = &lv_font_montserrat_24;
        } else if (size >= 18) {
            font = &lv_font_montserrat_18;
        } else if (size >= 16) {
            font = &lv_font_montserrat_16;
        }
        lv_obj_t* target = lv_obj_check_type(obj, &lv_btn_class)
                               ? lv_obj_get_child(obj, 0) : obj;
        if (target != nullptr) {
            lv_obj_set_style_text_font(target, font, LV_PART_MAIN);
        }

    } else if (std::strcmp(key, "textAlign") == 0) {
        lv_text_align_t align = LV_TEXT_ALIGN_LEFT;
        if (std::strcmp(value, "center") == 0) {
            align = LV_TEXT_ALIGN_CENTER;
        } else if (std::strcmp(value, "right") == 0) {
            align = LV_TEXT_ALIGN_RIGHT;
        }
        lv_obj_set_style_text_align(obj, align, LV_PART_MAIN);

    } else if (std::strcmp(key, "borderRadius") == 0) {
        lv_obj_set_style_radius(obj, static_cast<lv_coord_t>(parseLength(value)),
                                LV_PART_MAIN);
    }
    // width/height/margin/padding 已由 Core 算进坐标，忽略
}

void setEvent(int nodeId, const char* eventType, const char* methodName) {
    auto it = g_objMap.find(nodeId);
    if (it == g_objMap.end() || eventType == nullptr) {
        return;
    }

    if (std::strcmp(eventType, "click") == 0) {
        // 把 nodeId 编码进 user_data 指针。
        // 不分配内存：nodeId 是小整数，intptr_t 足够容纳，
        // 嵌入式环境要尽量避免动态分配。
        void* userData = reinterpret_cast<void*>(
            static_cast<intptr_t>(nodeId));

        lv_obj_add_event_cb(it->second, onLvglClicked, LV_EVENT_CLICKED, userData);
        lv_obj_add_flag(it->second, LV_OBJ_FLAG_CLICKABLE);

        QA_LOGD("[LVGL] node %d bound click -> %s", nodeId,
                methodName != nullptr ? methodName : "?");
    }
}

void removeElement(int nodeId) {
    auto it = g_objMap.find(nodeId);
    if (it == g_objMap.end()) {
        return;
    }
    // lv_obj_del 会递归删除子对象。
    // Core 是后序删除（子先父后，Step 09），所以子对象可能已被删过 ——
    // 但我们从 map 里移除了，不会重复调用 lv_obj_del
    lv_obj_del(it->second);
    g_objMap.erase(it);
}

void removeAll() {
    for (auto& [id, obj] : g_objMap) {
        lv_obj_del(obj);
    }
    g_objMap.clear();
}

void showToast(const char* message) {
    if (message == nullptr || g_rootContainer == nullptr) {
        return;
    }
    // LVGL 的 msgbox 需要手动关闭，不适合做 Toast。
    // 这里用一个带定时器自动删除的 label。
    lv_obj_t* toast = lv_label_create(lv_layer_top());
    lv_label_set_text(toast, message);
    lv_obj_set_style_bg_color(toast, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(toast, LV_OPA_70, LV_PART_MAIN);
    lv_obj_set_style_text_color(toast, lv_color_white(), LV_PART_MAIN);
    lv_obj_set_style_pad_all(toast, 8, LV_PART_MAIN);
    lv_obj_set_style_radius(toast, 6, LV_PART_MAIN);
    lv_obj_align(toast, LV_ALIGN_BOTTOM_MID, 0, -40);

    // 2 秒后自动删除。
    // lv_obj_del_delayed 是 LVGL 提供的便利函数，内部用 timer 实现
    lv_obj_del_delayed(toast, 2000);
}

} // namespace lvgl
} // namespace quickapp
```

### 11.6.4：lvgl_bridge.cpp 与线程模型

11.6.3 的 `lvgl_renderer.cpp` 只做"nodeId → lv_obj_t"的映射，它假设调用方
已经在正确的线程上。本小节解决两件事：

```text
1. 补齐 lvgl_renderer.h（11.6.3 的 .cpp include 了它，但还没写）
2. 决定 Core 的 Runtime Thread 和 LVGL 主循环的关系，
   并实现 PlatformBridge 的 6 个函数
```

#### 先补渲染器头文件

`ClickCallback` 这个类型别名在 11.6.3 里被写进了匿名 namespace，
而 `initRenderer` 是对外函数、参数用了这个类型 —— 匿名 namespace 的类型
在其他编译单元不可见，`lvgl_bridge.cpp` 调 `initRenderer` 会编译失败。
别名必须提到头文件里。

**@add `cpp/include/lvgl_renderer.h`（新建文件）**

```cpp
#ifndef QUICKAPP_LVGL_RENDERER_H
#define QUICKAPP_LVGL_RENDERER_H

#include "lvgl.h"

namespace quickapp {
namespace lvgl {

// 点击事件的回调类型。
//
// 由 lvgl_bridge.cpp 提供实现，在 LVGL 主循环线程被调用。
// 实现内部通过 PlatformEventSink 把事件投递回 Runtime Thread ——
// 这是 Platform → C++ 的独立通道，与本文件的渲染命令方向相反。
//
// @param nodeId 被点击节点的 ID
using ClickCallback = void (*)(int nodeId);

/**
 * 初始化渲染器。
 *
 * @param rootContainer 承载所有渲染结果的 LVGL 容器。
 *                      调用方负责创建，必须在 removeAll() 之后才可删除
 * @param callback      点击事件回调。传 nullptr 表示不接收点击
 *
 * 线程约束：必须在 LVGL 主循环线程调用，且在任何渲染命令之前。
 */
void initRenderer(lv_obj_t* rootContainer, ClickCallback callback);

/**
 * 创建元素。参数语义与 PlatformBridge::CreateElementFn 完全一致（Step 06）。
 *
 * @param nodeId 节点 ID
 * @param type   "div" / "text" / "input"，其他类型记警告并跳过
 * @param x      左上角 X（物理像素）
 * @param y      左上角 Y（物理像素）
 * @param width  宽度（物理像素）
 * @param height 高度（物理像素）
 */
void createElement(int nodeId, const char* type,
                   float x, float y, float width, float height);

/**
 * 设置属性。
 * @param nodeId 节点 ID，不存在时静默忽略
 * @param key    属性名，V1 只处理 "value"
 * @param value  属性值，UTF-8
 */
void setAttr(int nodeId, const char* key, const char* value);

/**
 * 设置样式。
 * @param nodeId 节点 ID，不存在时静默忽略
 * @param key    样式名，支持 backgroundColor / color / fontSize /
 *               textAlign / borderRadius
 * @param value  样式值，CSS 格式
 */
void setStyle(int nodeId, const char* key, const char* value);

/**
 * 绑定事件。
 * @param nodeId     节点 ID
 * @param eventType  事件类型，V1 只处理 "click"
 * @param methodName VM 方法名，仅用于日志（Core 侧自己有映射表，见 Step 06）
 */
void setEvent(int nodeId, const char* eventType, const char* methodName);

/**
 * 删除元素及其子对象。
 * @param nodeId 节点 ID，不存在时静默忽略
 */
void removeElement(int nodeId);

/** 删除所有元素并清空映射表。Runtime 销毁后调用 */
void removeAll();

/**
 * 显示轻量提示，2 秒后自动消失。
 * @param message 提示文本，UTF-8
 */
void showToast(const char* message);

} // namespace lvgl
} // namespace quickapp

#endif // QUICKAPP_LVGL_RENDERER_H
```

对应地删掉 .cpp 里重复的别名声明：

**@update `cpp/src/lvgl_renderer.cpp` — 替换匿名 namespace 里的回调声明**

```cpp
// nodeId → 事件回调
// （ClickCallback 的定义已移到 lvgl_renderer.h，这里只留变量）
ClickCallback g_clickCallback = nullptr;
```

---

#### 线程模型：两种方案

LVGL 的所有 `lv_*` 函数都不是线程安全的，必须在同一个线程调用。
Core 的 `RuntimeHost::start()` 内部会创建 Runtime Thread（Step 05/10），
JS 执行和渲染命令的发出都在那个线程。两者必须对接。

```text
方案 A：Runtime Thread 独立，渲染命令投递到 LVGL 主循环

    ┌─ Runtime Thread ─────────────┐   ┌─ LVGL 主循环线程 ──────────┐
    │ QuickJS 执行 JS              │   │ while (!quit) {           │
    │ VNode / Layout / 渲染命令     │   │   lv_timer_handler();     │
    │      ↓ PlatformBridge        │   │     └ pumpTimer 回调:      │
    │   push 进命令队列 ───────────────→ │        取出命令 → lv_*    │
    │                              │   │   SDL/LCD flush           │
    │ ← PlatformEventSink ─────────────  │   点击 → dispatchClick    │
    └──────────────────────────────┘   └───────────────────────────┘

方案 B：不用 Runtime Thread，在 LVGL 主循环里手动 pump EventLoop

    ┌─ 单线程 ────────────────────────────────────────┐
    │ while (!quit) {                                │
    │     eventLoop->runOnce(0);   // 跑 JS 任务      │
    │     lv_timer_handler();      // 跑 LVGL         │
    │ }                                              │
    │ PlatformBridge 直调 lv_*，无队列、无锁            │
    └────────────────────────────────────────────────┘
```

对比：

| 维度 | 方案 A（独立线程 + 命令队列） | 方案 B（单线程手动 pump） |
|---|---|---|
| 与 Android/iOS 的架构一致性 | 一致（都是"平台层负责投递"） | 分叉，LVGL 端独有 |
| 需要改 Core | 不需要 | 需要（见下文 3 处） |
| 额外内存 | 线程栈 64–256KB + 队列约 57KB | 0 |
| 长 JS 任务的影响 | 不卡帧，UI 仍然响应 | 直接卡帧，JS 跑多久界面就冻多久 |
| `RuntimeHost::start()` 语义 | 保持阻塞式，返回即首屏就绪 | 无法阻塞，得改成分步驱动 |
| 需要 RTOS/pthread | 需要 | 不需要（裸机可用） |
| 调试难度 | 有跨线程，需要注意队列时序 | 单线程，栈可完整回溯 |

**选方案 A。** 三个理由：

```text
1. Core 一行不用改
   方案 B 要给 RuntimeEventLoop 加 runOnce()，
   给 RuntimeHostConfig 加线程模式开关，
   还要把 RuntimeHost 内部的 RuntimeThread 变成可选 ——
   这是接口层面的改动，会影响已经验证过的 Android 路径。

2. 三端集成代码的形状一致
   Android 用 uiHandler.post，iOS 用 dispatch_async，LVGL 用命令队列 + lv_timer。
   三者都是"平台层把操作搬到自己的 UI 执行上下文"，
   Step 11.7 的对照表能保持一列对一列。

3. 卡帧是可感知的缺陷
   一次页面切换的 JS 执行（eval bundle + 建 VNode）在 MCU 上可能 100-300ms。
   方案 B 下这段时间界面完全不刷新，触摸也没有反馈。
```

方案 B 保留为**极限裁剪**场景的备选：目标是无操作系统的裸机，
或 RAM 小到放不下第二个线程栈。选它需要的 Core 改动记录在本小节末尾。

---

#### 命令队列的容量与截断

命令要跨线程传递，`const char*` 参数在 PlatformBridge 函数返回后就失效（Step 06 约定），
所以必须拷贝。嵌入式环境要避免动态分配，用定长字符数组 + 固定大小 ring buffer。

**@update `cpp/include/quickapp_lvgl_config.h` — 在 `kTitleBarHeight` 之后追加**

```cpp
// ============================================================
// 渲染命令队列的尺寸
// ============================================================
//
// 队列是静态分配的，总占用 = kCommandQueueCapacity * sizeof(RenderCommand)。
// sizeof(RenderCommand) = 4(kind+pad) + 4(nodeId) + 16(x/y/w/h)
//                       + kMaxKeyLength + kMaxValueLength
//                       = 24 + 24 + 64 = 112 字节
// 512 * 112 ≈ 57KB

// 属性名/样式名的长度上限。
// 实际用到的最长是 "backgroundColor"（15 字符），24 足够。
constexpr size_t kMaxKeyLength = 24;

// 属性值/样式值的长度上限。
// 超长的文本内容会被截断并记 WARN 日志。
// 63 个字节的 UTF-8 中文约 21 字，够一般的标签和按钮文字；
// 如果应用有长文本段落，需要上调（代价是队列总内存线性增长）。
constexpr size_t kMaxValueLength = 64;

// 队列容量（条命令）。
//
// 怎么估：首屏一次性发出的命令数 ≈ 节点数 × (1 create + attrs + styles + events)
//        经验值是每节点 6-8 条。
//        512 条约等于 64-85 个节点的整屏，覆盖典型的嵌入式页面。
//
// 为什么必须够大：RuntimeHost::start() 会阻塞调用线程（LVGL 主循环所在线程）
//        直到首屏渲染命令全部发出。这期间没人消费队列，
//        队列必须能装下整个首屏，否则 Runtime Thread 会在队列满时等待
//        （见 lvgl_bridge.cpp 的超时保护）。
constexpr size_t kCommandQueueCapacity = 512;

// 队列满时生产者（Runtime Thread）的最长等待时间（毫秒）。
// 超时后丢弃该条命令并记 ERROR，保证不会永久卡住 Runtime Thread。
constexpr uint32_t kQueuePushTimeoutMs = 200;

// pump 定时器周期（毫秒）。
// 5ms 对应 200Hz 的命令消费频率，远高于 LVGL 默认的 30ms 刷新周期，
// 不会成为瓶颈。设太小会增加空转开销。
constexpr uint32_t kPumpIntervalMs = 5;
```

`quickapp_lvgl_config.h` 需要补 `#include <cstddef>` 和 `#include <cstdint>`
（原文件只用了 `size_t` 和 `float`，现在多了 `uint32_t`）。

#### 平台层的对外接口

**@add `cpp/include/lvgl_bridge.h`（新建文件）**

```cpp
#ifndef QUICKAPP_LVGL_BRIDGE_H
#define QUICKAPP_LVGL_BRIDGE_H

#include <cstddef>
#include <cstdint>

#include "lvgl.h"
#include "runtime_host.h"

namespace quickapp {
namespace lvgl {

/**
 * 启动快应用。
 *
 * 内部完成：注册日志后端 → 初始化渲染器 → 创建 pump 定时器
 *          → 填 PlatformBridge → RuntimeHost::create/start。
 *
 * 阻塞直到首屏渲染命令全部发出（不等于已经画到屏幕上 ——
 * 命令还在队列里，要等下一次 lv_timer_handler 才应用）。
 *
 * @param rootContainer  承载渲染结果的 LVGL 容器，调用方创建。
 *                       必须在 shutdown() 之后才可删除
 * @param rpkData        RPK 字节数据。调用方保有所有权，
 *                       必须在 shutdown() 之前保持有效（Core 不拷贝）
 * @param rpkSize        RPK 字节数
 * @param viewportWidth  视口宽度（物理像素）
 * @param viewportHeight 视口高度（物理像素），已扣除标题栏
 * @return true 启动成功；false 失败，原因已记入 ERROR 日志
 *
 * 线程约束：必须在 LVGL 主循环线程调用。
 */
bool launch(lv_obj_t* rootContainer,
            const uint8_t* rpkData,
            size_t rpkSize,
            float viewportWidth,
            float viewportHeight);

/**
 * 停止快应用并释放平台层资源。
 *
 * 顺序：RuntimeHost::destroy（等 Runtime Thread 退出）
 *      → 删 pump 定时器 → 丢弃队列残留命令 → 清空所有 LVGL 对象。
 *
 * 幂等：多次调用安全。
 *
 * 线程约束：必须在 LVGL 主循环线程调用，且不能在 pump 定时器回调内部调用。
 */
void shutdown();

/**
 * 取 RuntimeHost 指针，用于投递生命周期事件、读标题栏配置。
 *
 * @return launch() 成功后返回有效指针；未启动或已 shutdown 返回 nullptr
 *
 * 线程约束：返回的指针上的方法可从任意线程调用（RuntimeHost 自身线程安全）。
 */
RuntimeHost* host();

} // namespace lvgl
} // namespace quickapp

#endif // QUICKAPP_LVGL_BRIDGE_H
```

---

#### PlatformBridge 实现

**@add `cpp/src/lvgl_bridge.cpp`（新建文件）**

第一部分：命令结构与队列。

```cpp
// LVGL 平台层：PlatformBridge 实现 + 跨线程命令队列。
//
// 三条通道在本文件里的分工（不要混淆）：
//
//   PlatformBridge      C++ Core → LVGL
//                       lvglCreateElement 等 6 个函数，
//                       在 Runtime Thread 被调用，只往队列里塞命令，
//                       一行 lv_* 都不碰。
//
//   PlatformEventSink   LVGL → C++ Core
//                       onLvglClick 在 LVGL 主循环线程被调用，
//                       通过 RuntimeHost::dispatchClick 投递回 Runtime Thread。
//                       这条通道不经过命令队列，是独立的反向通道。
//
//   JS Bridge           JS ↔ C++，全部在 Core 内部，本文件不涉及。
//
// 线程模型（方案 A）：
//   Runtime Thread     Core 创建，跑 QuickJS + 布局 + 发命令
//   LVGL 主循环线程     应用方创建（sim/main.cpp 或 RTOS 任务），
//                      跑 lv_timer_handler，pump 定时器在这里消费队列

#include "lvgl_bridge.h"

#include <chrono>
#include <condition_variable>
#include <cstdio>
#include <cstring>
#include <mutex>

#include "lvgl_renderer.h"
#include "platform_bridge.h"
#include "qa_log.h"
#include "quickapp_lvgl_config.h"

namespace quickapp {
namespace lvgl {
namespace {

// ============================================================
// 渲染命令
// ============================================================

// 一条渲染命令。
//
// 为什么用定长数组而不是 std::string：
//   队列是静态分配的（kCommandQueueCapacity 条），
//   std::string 会让每条命令在 push 时做一次堆分配。
//   嵌入式的堆碎片是长时间运行的主要故障源，能避开就避开。
//
// 代价：value 超过 kMaxValueLength-1 字节会被截断。
struct RenderCommand {
    enum class Kind : uint8_t {
        CreateElement,
        SetAttr,
        SetStyle,
        SetEvent,
        RemoveElement,
        ShowToast,
    };

    // 命令种类，决定哪些字段有效
    Kind kind = Kind::RemoveElement;

    // 目标节点 ID。ShowToast 不使用此字段
    int nodeId = -1;

    // 布局结果，仅 CreateElement 使用（物理像素）
    float x = 0.0f;
    float y = 0.0f;
    float width = 0.0f;
    float height = 0.0f;

    // 第一个字符串参数，语义按 kind：
    //   CreateElement  节点类型（"div" / "text" / "input"）
    //   SetAttr        属性名
    //   SetStyle       样式名
    //   SetEvent       事件类型（"click"）
    //   RemoveElement  未使用
    //   ShowToast      未使用
    char key[kMaxKeyLength] = {0};

    // 第二个字符串参数，语义按 kind：
    //   SetAttr / SetStyle  属性值 / 样式值
    //   SetEvent            VM 方法名（只用于日志）
    //   ShowToast           提示文本
    //   其他                未使用
    char value[kMaxValueLength] = {0};
};

/**
 * 拷贝字符串到定长缓冲，超长截断。
 *
 * @param dst      目标缓冲
 * @param dstSize  目标缓冲字节数（含结尾 '\0' 的位置）
 * @param src      源字符串，可以为 nullptr（此时 dst 变空串）
 * @param fieldName 字段名，仅用于截断时的日志
 */
void copyBounded(char* dst, size_t dstSize, const char* src,
                 const char* fieldName) {
    if (src == nullptr) {
        dst[0] = '\0';
        return;
    }
    const size_t len = std::strlen(src);
    if (len >= dstSize) {
        // 截断是可观察的缺陷（文本显示不全），必须留下痕迹。
        // 用 WARN 而不是静默：静默截断的 bug 极难定位。
        QA_LOGW("[LVGL] %s truncated: %zu -> %zu bytes",
                fieldName, len, dstSize - 1);
        std::memcpy(dst, src, dstSize - 1);
        dst[dstSize - 1] = '\0';
        return;
    }
    std::memcpy(dst, src, len + 1);
}

// ============================================================
// 命令队列
// ============================================================

/**
 * 单生产者单消费者的定长命令队列。
 *
 * 职责：
 *   把 Runtime Thread 发出的渲染命令搬到 LVGL 主循环线程，
 *   保持 FIFO 顺序（PlatformBridge 的顺序要求，见 Step 06）。
 *
 * 线程所有权：
 *   push()  只由 Runtime Thread 调用（生产者）
 *   pop()   只由 LVGL 主循环线程调用（消费者）
 *   close() 由 LVGL 主循环线程在 shutdown 时调用
 *   三者共用一把 mutex，内部状态无锁外访问。
 *
 * 生命周期：
 *   静态实例，与进程同寿。close() 只是把它置为拒绝写入的状态，
 *   不释放内存（内存是静态数组，本来也不需要释放）。
 *   reopen() 用于第二次 launch。
 *
 * 与其他组件的关系：
 *   生产端 = 本文件的 6 个 PlatformBridge 实现
 *   消费端 = pumpTimerCb → lvgl_renderer 的同名函数
 */
class RenderCommandQueue {
public:
    /**
     * 写入一条命令。队列满时阻塞等待，最多 kQueuePushTimeoutMs 毫秒。
     *
     * 为什么满了要等而不是直接丢：
     *   渲染命令是有状态依赖的序列（create 之后才能 setAttr）。
     *   丢一条 create，后续所有针对该节点的命令都会落空，
     *   LVGL 的视图树和 Core 的 VNode 树就永久不一致了。
     *   等待是让生产者降速，是正确的背压方式。
     *
     * 为什么等待要有超时：
     *   如果消费者线程死了（LVGL 主循环退出但没 close），
     *   无限等待会让 Runtime Thread 永久挂住，destroy() 也 join 不上。
     *   超时后丢弃并记 ERROR，保证系统还能被关掉。
     *
     * @param cmd 要写入的命令，按值拷贝进队列
     * @return true 已入队；false 队列已 close 或等待超时（命令被丢弃）
     *
     * 线程安全：可从任意线程调用。
     */
    bool push(const RenderCommand& cmd) {
        std::unique_lock<std::mutex> lock(mutex_);

        if (closed_) {
            return false;
        }

        if (count_ == kCommandQueueCapacity) {
            // wait_for 会释放锁并等待，被 notify 或超时后重新加锁。
            // 谓词形式可以正确处理虚假唤醒（spurious wakeup）。
            const bool ok = notFull_.wait_for(
                lock,
                std::chrono::milliseconds(kQueuePushTimeoutMs),
                [this] { return count_ < kCommandQueueCapacity || closed_; });

            if (!ok || closed_ || count_ == kCommandQueueCapacity) {
                QA_LOGE("[LVGL] command queue full for %ums, command dropped "
                        "(kind=%d node=%d) — enlarge kCommandQueueCapacity",
                        kQueuePushTimeoutMs,
                        static_cast<int>(cmd.kind), cmd.nodeId);
                return false;
            }
        }

        buffer_[tail_] = cmd;
        tail_ = (tail_ + 1) % kCommandQueueCapacity;
        ++count_;
        return true;
    }

    /**
     * 取出一条命令。
     *
     * 不阻塞：队列空时立即返回 false。消费者是定时器回调，
     * 不能在里面等待（会卡住整个 LVGL 主循环）。
     *
     * @param out 输出参数，接收取出的命令。仅返回 true 时有效
     * @return true 取到了命令；false 队列为空
     *
     * 线程安全：可从任意线程调用。
     */
    bool pop(RenderCommand& out) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (count_ == 0) {
            return false;
        }
        out = buffer_[head_];
        head_ = (head_ + 1) % kCommandQueueCapacity;
        --count_;

        // 通知可能正在等待空位的生产者。
        // 在锁内 notify 是安全的，代价是被唤醒的线程要多等一次锁；
        // 命令消费频率不高（每 5ms 一批），这点开销可以忽略。
        notFull_.notify_one();
        return true;
    }

    /**
     * 关闭队列：拒绝新的 push，唤醒所有等待者，丢弃残留命令。
     *
     * 幂等：多次调用安全。
     */
    void close() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            closed_ = true;
            if (count_ > 0) {
                QA_LOGW("[LVGL] queue closed with %zu pending commands dropped",
                        count_);
            }
            head_ = tail_ = count_ = 0;
        }
        // 必须在锁外 notify_all，让阻塞在 push 里的 Runtime Thread
        // 能立刻拿到锁并返回 false
        notFull_.notify_all();
    }

    /** 重新打开队列，供第二次 launch 使用 */
    void reopen() {
        std::lock_guard<std::mutex> lock(mutex_);
        closed_ = false;
        head_ = tail_ = count_ = 0;
    }

private:
    std::mutex mutex_;
    std::condition_variable notFull_;

    // 静态分配的环形缓冲。不用 std::vector：避免堆分配和运行期扩容
    RenderCommand buffer_[kCommandQueueCapacity];

    size_t head_ = 0;    // 下一个要读的位置
    size_t tail_ = 0;    // 下一个要写的位置
    size_t count_ = 0;   // 当前元素数（head/tail 相等时用它区分空和满）
    bool closed_ = false;
};

} // namespace
```


第二部分：全局状态与 PlatformBridge 的 6 个实现。

**@add `cpp/src/lvgl_bridge.cpp` — 接第一部分末尾的 `} // namespace` 之后继续**

下面重新打开了一次匿名 namespace。匿名 namespace 在同一个编译单元里可以反复
开合，两次打开指向的是同一个命名空间，第一部分定义的 `RenderCommand`、
`copyBounded`、`RenderCommandQueue` 在这里都直接可见。分段只是为了阅读方便。

```cpp
namespace {

// ============================================================
// 全局状态
// ============================================================
//
// 单 Runtime 假设（design.md 的架构决策 6）：整个进程只有一个快应用实例，
// 所以平台层的状态用文件级变量而不是实例成员。
// 多实例是 V2 的工作，届时这些变量要收进一个上下文结构体。

// 渲染命令队列。
//
// 为什么是静态实例而不是 new 出来：
//   队列内部是 kCommandQueueCapacity 条命令的定长数组（约 57KB）。
//   放在 .bss 段里，链接期就能看到占用，超了直接链接失败；
//   放在堆上则是运行期才失败，而嵌入式的堆可能只剩几十 KB，
//   一次 57KB 的分配失败会让启动路径在很晚的位置崩掉。
RenderCommandQueue g_queue;

// Runtime 实例。launch() 创建，shutdown() 销毁。
// 非空即代表"已启动"，其他地方用它做状态判断，不再额外维护 bool 标志。
std::unique_ptr<quickapp::RuntimeHost> g_host;

// pump 定时器。
// 内存归 LVGL 所有（lv_timer_create 内部分配），我们只持有指针用于 lv_timer_del。
lv_timer_t* g_pumpTimer = nullptr;

// 渲染根容器。launch() 传入，所有权归调用方，本文件不删除它。
lv_obj_t* g_root = nullptr;

// RPK 数据的非拥有指针。
//
// RuntimeHostConfig 只存指针不拷贝（Step 10 的约定），数据归调用方所有。
// 这里留一份是为了两件事：
//   1. 诊断日志里能打出大小
//   2. 第二次 launch 时能发现"传进来的还是同一块已被释放的内存"这类问题
// 绝不通过这个指针去释放内存。
const uint8_t* g_rpkData = nullptr;
size_t g_rpkSize = 0;

// ============================================================
// PlatformBridge 实现（C++ Core → LVGL 方向）
// ============================================================
//
// 这 6 个函数的共同约束：
//   线程    Runtime Thread。Core 的 RenderPipeline 在遍历 VNode 树时调用。
//   动作    只把参数拷进队列，一行 lv_* 都不碰。
//           LVGL 的全部 API 都不是线程安全的，跨线程调用的表现是
//           对象树被写坏后在若干帧之后崩溃，现场和起因完全对不上。
//   参数    所有 const char* 只在函数返回前有效（Step 06 的约定），
//           要留到下一帧用就必须拷贝，这是 copyBounded 存在的原因。
//   返回值  void。队列写入失败时没有可做的恢复动作，
//           失败已在 RenderCommandQueue::push 内部记 ERROR。
//
// 这些函数定义在匿名 namespace 里（内部链接），但地址会被取出来填进
// PlatformBridge 结构体。这是合法的：取地址发生在同一个编译单元（launch()），
// 内部链接只影响其他编译单元能否按名字引用它。

/**
 * PlatformBridge::createElement 的 LVGL 实现。
 *
 * @param id     节点 ID，Core 生成，后续 setAttr/setStyle/removeElement 用它定位
 * @param type   节点类型："div" / "text" / "input"
 * @param x      左上角 X（物理像素，相对根容器）
 * @param y      左上角 Y（物理像素，相对根容器）
 * @param width  宽度（物理像素）
 * @param height 高度（物理像素）
 */
void lvglCreateElement(int id, const char* type,
                       float x, float y, float width, float height) {
    RenderCommand cmd;
    cmd.kind = RenderCommand::Kind::CreateElement;
    cmd.nodeId = id;
    cmd.x = x;
    cmd.y = y;
    cmd.width = width;
    cmd.height = height;
    copyBounded(cmd.key, kMaxKeyLength, type, "createElement.type");
    g_queue.push(cmd);
}

/**
 * PlatformBridge::setAttr 的 LVGL 实现。
 *
 * @param id    节点 ID
 * @param key   属性名，最长 kMaxKeyLength-1 字节，超长截断
 * @param value 属性值（UTF-8），最长 kMaxValueLength-1 字节，超长截断。
 *              文本内容走的就是这条路，长段落会显示不全并记 WARN
 */
void lvglSetAttr(int id, const char* key, const char* value) {
    RenderCommand cmd;
    cmd.kind = RenderCommand::Kind::SetAttr;
    cmd.nodeId = id;
    copyBounded(cmd.key, kMaxKeyLength, key, "setAttr.key");
    copyBounded(cmd.value, kMaxValueLength, value, "setAttr.value");
    g_queue.push(cmd);
}

/**
 * PlatformBridge::setStyle 的 LVGL 实现。
 *
 * @param id    节点 ID
 * @param key   样式名，如 "backgroundColor"（15 字节，在 24 的上限内）
 * @param value 样式值，CSS 格式，如 "#FF0000" / "16px" / "center"。
 *              样式值都很短，实践中不会触发截断
 */
void lvglSetStyle(int id, const char* key, const char* value) {
    RenderCommand cmd;
    cmd.kind = RenderCommand::Kind::SetStyle;
    cmd.nodeId = id;
    copyBounded(cmd.key, kMaxKeyLength, key, "setStyle.key");
    copyBounded(cmd.value, kMaxValueLength, value, "setStyle.value");
    g_queue.push(cmd);
}

/**
 * PlatformBridge::setEvent 的 LVGL 实现。
 *
 * 注意这里传的 methodName 只会进日志。真正的"节点 → VM 方法"映射在 Core 侧
 * （RenderPipeline 的 VNode::events，Step 09），平台层回传事件时只需要给
 * nodeId，不需要也不应该自己保存方法名。
 *
 * @param id         节点 ID
 * @param eventType  事件类型，V1 只有 "click"
 * @param methodName VM 方法名，仅用于日志
 */
void lvglSetEvent(int id, const char* eventType, const char* methodName) {
    RenderCommand cmd;
    cmd.kind = RenderCommand::Kind::SetEvent;
    cmd.nodeId = id;
    copyBounded(cmd.key, kMaxKeyLength, eventType, "setEvent.type");
    copyBounded(cmd.value, kMaxValueLength, methodName, "setEvent.method");
    g_queue.push(cmd);
}

/**
 * PlatformBridge::removeElement 的 LVGL 实现。
 *
 * @param id 节点 ID。不校验存在性 —— 消费端 lvgl_renderer::removeElement
 *           对未知 ID 是静默忽略的，这里再查一次要访问 g_objMap，
 *           而那张表只归 LVGL 主循环线程读写
 */
void lvglRemoveElement(int id) {
    RenderCommand cmd;
    cmd.kind = RenderCommand::Kind::RemoveElement;
    cmd.nodeId = id;
    g_queue.push(cmd);
}

/**
 * PlatformBridge::showToast 的 LVGL 实现。
 *
 * @param message 提示文本（UTF-8）。超过 kMaxValueLength-1 字节会被截断，
 *                约 21 个汉字。Toast 本来就该短，这个上限是合理的
 */
void lvglShowToast(const char* message) {
    RenderCommand cmd;
    cmd.kind = RenderCommand::Kind::ShowToast;
    copyBounded(cmd.value, kMaxValueLength, message, "showToast.message");
    g_queue.push(cmd);
}
```

第三部分：消费端（pump 定时器）、事件回传、日志后端。

**@add `cpp/src/lvgl_bridge.cpp` — 接第二部分的 `lvglShowToast` 之后，仍在匿名 namespace 内**

```cpp
// ============================================================
// 消费端：pump 定时器
// ============================================================

/**
 * 把队列里的渲染命令应用到 LVGL 对象树。
 *
 * 线程：LVGL 主循环线程。lv_timer_handler() 内部调用本函数，
 *       所以这里调 lv_*（经由 lvgl_renderer 的函数）是安全的。
 *       本文件里只有三个地方运行在这个线程：本函数、launch()、shutdown()。
 *
 * @param timer 定时器句柄，未使用。LVGL 的回调签名要求这个参数
 *
 * 单个 tick 的消费上限是 kCommandQueueCapacity 条。
 * 为什么要有上限：
 *   如果 Runtime Thread 持续高速产命令（例如 JS 在一个循环里反复改样式），
 *   没有上限的 while 会让本函数永远不返回 —— 队列刚被清空，
 *   生产者立刻又填满。后果是 lv_timer_handler 里排在 pump 之后的
 *   重绘和输入处理被饿死，界面表现为完全冻结、触摸无反应。
 *   有上限时最坏情况只是队列积压、画面延迟几帧，但刷新和输入仍在进行。
 *
 * 上限取队列容量而不是更小的值：一次首屏（约 500 条）应该在一个 tick 里
 * 全部落地，否则首屏会分几帧出现，看起来是元素一个个"长出来"。
 */
void pumpTimerCb(lv_timer_t* /*timer*/) {
    RenderCommand cmd;
    size_t processed = 0;

    while (processed < kCommandQueueCapacity && g_queue.pop(cmd)) {
        ++processed;

        // 分发到 lvgl_renderer 的同名函数（lvgl_renderer.h）。
        // 这里不做任何参数校验和业务判断 —— 校验在渲染器里，
        // pump 只负责"从队列里取出来，按 kind 转成函数调用"。
        switch (cmd.kind) {
            case RenderCommand::Kind::CreateElement:
                createElement(cmd.nodeId, cmd.key,
                              cmd.x, cmd.y, cmd.width, cmd.height);
                break;

            case RenderCommand::Kind::SetAttr:
                setAttr(cmd.nodeId, cmd.key, cmd.value);
                break;

            case RenderCommand::Kind::SetStyle:
                setStyle(cmd.nodeId, cmd.key, cmd.value);
                break;

            case RenderCommand::Kind::SetEvent:
                setEvent(cmd.nodeId, cmd.key, cmd.value);
                break;

            case RenderCommand::Kind::RemoveElement:
                removeElement(cmd.nodeId);
                break;

            case RenderCommand::Kind::ShowToast:
                showToast(cmd.value);
                break;
        }
    }

    if (processed == kCommandQueueCapacity) {
        // 撞上限说明生产速度超过了消费速度，画面会落后。
        // 不是错误，但持续出现意味着需要调大 kPumpIntervalMs 的频率
        // 或者检查 JS 是否在做无意义的重复渲染
        QA_LOGW("[LVGL] pump hit per-tick limit (%zu), backlog remains",
                processed);
    }
}

// ============================================================
// 事件回传：LVGL → C++ Core（PlatformEventSink 通道）
// ============================================================

/**
 * 点击事件回调。由 lvgl_renderer 的 LVGL 事件处理器调用。
 *
 * 这条路径走的是 PlatformEventSink 通道，与上面的渲染命令方向相反，
 * **不经过命令队列**。原因：
 *
 *   1. 命令队列是"Core → 平台"方向的缓冲。反向的事件塞进去是逻辑错误，
 *      消费者（pump）跑在 LVGL 线程上，事件会被投递回它自己的线程，
 *      永远到不了 Runtime Thread。
 *
 *   2. 跨线程投递已经有人做了。RuntimeHost::dispatchClick 内部走
 *      PlatformEventSink → RuntimeEventLoop::post（Step 06 / Step 10），
 *      事件处理器最终在 Runtime Thread 执行。平台层再加一层队列是重复工作。
 *
 * 线程：LVGL 主循环线程。dispatchClick 声明为可从任意线程调用。
 *
 * @param nodeId 被点击节点的 ID。lvgl_renderer 从 LVGL 的 user_data 里解出来
 */
void onLvglClick(int nodeId) {
    if (!g_host) {
        // shutdown() 之后 LVGL 可能还有已排队但未处理的输入事件。
        // 静默返回：这不是错误，是正常的关闭竞态。
        // Core 侧 PlatformEventSink::shutdown 之后也会丢弃事件，
        // 这里提前拦掉只是少一次无意义的调用
        return;
    }

    // QUICKAPP_LOG_MIN_LEVEL=3 时这行在编译期就被去掉了（Step 03），
    // 目标板上不占 Flash。调试期把级别放开就能看到
    QA_LOGD("[LVGL] click node=%d -> PlatformEventSink", nodeId);

    g_host->dispatchClick(nodeId);
}

// ============================================================
// 日志后端
// ============================================================

/**
 * Core 日志 → 标准输出 / 串口。
 *
 * QUICKAPP_LOG_BACKEND=CALLBACK 时 Core 自己不做任何输出（不链接 stdio），
 * 全部依赖这个 handler（Step 03 的机制）。
 * 移到真实目标板时，把 printf 换成 HAL 的串口写函数即可，
 * 本文件之外不需要任何改动。
 *
 * @param level   日志级别
 * @param tag     Core 传入固定字符串（"quickapp-core"），可能为 nullptr
 * @param message 已格式化好的日志文本，不含换行
 */
void lvglLogHandler(quickapp::LogLevel level, const char* tag,
                    const char* message) {
    char levelChar;
    switch (level) {
        case quickapp::LogLevel::Verbose: levelChar = 'V'; break;
        case quickapp::LogLevel::Debug:   levelChar = 'D'; break;
        case quickapp::LogLevel::Info:    levelChar = 'I'; break;
        case quickapp::LogLevel::Warn:    levelChar = 'W'; break;
        case quickapp::LogLevel::Error:   levelChar = 'E'; break;
        default:                          levelChar = '?'; break;
    }

    // Verbose/Debug 两个分支在 LOG_MIN_LEVEL=3 的构建里永远走不到
    // （宏在调用点就被消掉了）。保留它们是为了在开发板上临时放开级别时
    // 不需要改这个文件。

    // 用 "%s" 而不是把 message 直接当格式串：
    // message 里可能含 % 字符（例如样式值 "width: 50%"），
    // 直接传会让 printf 去读不存在的可变参数，是未定义行为
    std::printf("[%c][%s] %s\n", levelChar,
                tag != nullptr ? tag : "quickapp", message);

    // 桌面 stdout 重定向到文件时是全缓冲的，崩溃前的日志会丢。
    // 目标板换成串口写之后这行可以去掉（串口写是同步的）
    std::fflush(stdout);
}

} // namespace
```

第一部分的 include 块要补一行（用到了 `std::unique_ptr`）：

**@update `cpp/src/lvgl_bridge.cpp` — 在 `#include <cstring>` 之后插入**

```cpp
#include <memory>
```

第四部分：对外的 launch / shutdown / host。

**@add `cpp/src/lvgl_bridge.cpp` — 接第三部分的 `} // namespace` 之后继续**

```cpp
namespace {

/**
 * 回滚 launch() 已经做完的平台侧准备工作。
 *
 * 供两处调用：launch() 的失败路径、shutdown()。
 * 两处的清理动作完全相同，抽出来避免顺序写歪。
 *
 * 不动 g_host —— 调用方自己决定是先 destroy 还是直接 reset。
 *
 * 线程：LVGL 主循环线程。内部有 lv_timer_del 和 removeAll（都是 lv_*）。
 */
void unwindPlatformState() {
    if (g_pumpTimer != nullptr) {
        // 先删定时器，之后不会再有人调 pop，
        // 队列里的残留命令交给 close() 丢弃
        lv_timer_del(g_pumpTimer);
        g_pumpTimer = nullptr;
    }

    g_queue.close();

    // 清空 LVGL 对象和 nodeId 映射表。
    // 必须在定时器删掉之后 —— 否则 pump 可能在 removeAll 之后
    // 又处理一条 setAttr，去访问已经删掉的 lv_obj_t
    removeAll();

    g_root = nullptr;
    g_rpkData = nullptr;
    g_rpkSize = 0;
}

} // namespace

bool launch(lv_obj_t* rootContainer,
            const uint8_t* rpkData,
            size_t rpkSize,
            float viewportWidth,
            float viewportHeight) {
    // ---- 0. 先接管日志 ----
    // 放在最前面：后面每一步的失败信息都要能看得见。
    // 在参数校验之前注册，是为了让"参数不合法"这条 ERROR 也有出口
    quickapp::setLogHandler(lvglLogHandler);

    if (g_host) {
        QA_LOGE("[LVGL] launch called while already running; "
                "call shutdown() first");
        return false;
    }
    if (rootContainer == nullptr || rpkData == nullptr || rpkSize == 0) {
        QA_LOGE("[LVGL] launch: invalid arguments "
                "(root=%p rpk=%p size=%zu)",
                static_cast<void*>(rootContainer),
                static_cast<const void*>(rpkData), rpkSize);
        return false;
    }
    if (viewportWidth <= 0.0f || viewportHeight <= 0.0f) {
        QA_LOGE("[LVGL] launch: invalid viewport %.1fx%.1f",
                viewportWidth, viewportHeight);
        return false;
    }

    // ---- 1. 队列复位 ----
    // 支持 shutdown 之后再 launch：close() 把队列置成拒绝写入状态，
    // reopen() 把它恢复并清空计数
    g_queue.reopen();

    // ---- 2. 初始化渲染器 ----
    // 第二个参数是 PlatformEventSink 方向的回调，
    // 与本函数后面注册的 PlatformBridge 是两条独立通道
    g_root = rootContainer;
    initRenderer(rootContainer, onLvglClick);

    // ---- 3. 创建 pump 定时器 ----
    //
    // 建在 start() 之前还是之后都不影响首屏：
    // 定时器回调和本函数跑在同一个线程，start() 阻塞期间
    // lv_timer_handler 根本没机会执行。首屏的所有命令都会堆在队列里，
    // 等本函数返回、调用方进入主循环后才被消费。
    // 这就是 kCommandQueueCapacity 必须装下整个首屏的原因。
    g_pumpTimer = lv_timer_create(pumpTimerCb, kPumpIntervalMs, nullptr);
    if (g_pumpTimer == nullptr) {
        // LVGL 的定时器也是从 lv_mem 池里分配的，内存紧张时会失败
        QA_LOGE("[LVGL] lv_timer_create failed (LV_MEM_SIZE too small?)");
        unwindPlatformState();
        return false;
    }

    // ---- 4. 填 PlatformBridge ----
    quickapp::PlatformBridge bridge{};
    bridge.createElement = lvglCreateElement;
    bridge.setAttr = lvglSetAttr;
    bridge.setStyle = lvglSetStyle;
    bridge.setEvent = lvglSetEvent;
    bridge.removeElement = lvglRemoveElement;
    bridge.showToast = lvglShowToast;

    // ---- 5. 配置 ----
    quickapp::RuntimeHostConfig cfg;
    cfg.bridge = bridge;
    cfg.rpkData = rpkData;      // 只存指针，Core 不拷贝（Step 10 约定）
    cfg.rpkSize = rpkSize;
    cfg.viewportWidth = viewportWidth;
    cfg.viewportHeight = viewportHeight;

    // 嵌入式必须调小 JS 引擎的资源上限，否则 QuickJS 初始化就耗尽内存。
    // 这两个字段是 Step 11.6.2 给 Core 补的配置入口
    cfg.jsLimits.heapLimit = kJSHeapLimit;
    cfg.jsLimits.stackLimit = kJSStackLimit;

    g_rpkData = rpkData;
    g_rpkSize = rpkSize;

    // ---- 6. 启动 ----
    g_host = std::make_unique<quickapp::RuntimeHost>();

    if (!g_host->create(cfg)) {
        QA_LOGE("[LVGL] RuntimeHost::create failed: %s",
                g_host->getLastError().c_str());
        g_host.reset();
        unwindPlatformState();
        return false;
    }

    if (!g_host->start()) {
        // 和 Android 侧的处理不同：那边保留 g_host 让 Kotlin 能读错误信息，
        // 这里没有第二个语言层，日志就是唯一出口，
        // 所以把错误打全之后直接清干净
        QA_LOGE("[LVGL] RuntimeHost::start failed at stage [%s]: %s",
                g_host->failedStage().c_str(),
                g_host->getLastError().c_str());
        g_host->destroy();
        g_host.reset();
        unwindPlatformState();
        return false;
    }

    QA_LOGI("[LVGL] launched: package=%s name=%s rpk=%zuB viewport=%.0fx%.0f",
            g_host->packageName().c_str(), g_host->appName().c_str(),
            g_rpkSize, viewportWidth, viewportHeight);
    return true;
}

void shutdown() {
    if (!g_host && g_pumpTimer == nullptr && g_root == nullptr) {
        // 幂等：已经关干净了，直接返回
        return;
    }

    // ---- 1. 先停生产者 ----
    //
    // destroy() 内部按逆序清理并 join Runtime Thread（Step 10）。
    // 返回之后不会再有任何 PlatformBridge 调用，队列进入只读状态。
    //
    // 关于耗时：本函数跑在 LVGL 主循环线程，destroy() 阻塞期间 pump 不执行。
    // 如果 Runtime Thread 正好在发命令且队列已满，它会在 push 里等，
    // 每条命令最多等 kQueuePushTimeoutMs（200ms）后放弃。
    // 这是 push 带超时的直接价值：没有超时的话 destroy() 会永久 join 不上。
    //
    // 为什么不先 close() 队列来消掉这段等待：
    //   会出现"队列已关但生产者还在跑"的中间状态，
    //   Core 侧看到的是一串静默失败的渲染命令。
    //   保持"停生产者 → 停消费者 → 清资源"的单向顺序更容易推理，
    //   代价是最坏情况多等一个超时周期。
    if (g_host) {
        g_host->destroy();
        g_host.reset();
    }

    // ---- 2. 停消费者 + 清资源 ----
    unwindPlatformState();

    QA_LOGI("[LVGL] shutdown complete");
}

RuntimeHost* host() {
    return g_host.get();
}

} // namespace lvgl
} // namespace quickapp
```
