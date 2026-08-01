# Step 1：抽取策略与边界划分

## 目录

- [目标](#目标)
- [Step 1.1：盘点 Android 工程当前文件](#step-11盘点-android-工程当前文件)
- [Step 1.2：划分抽取边界](#step-12划分抽取边界)
- [Step 1.3：识别平台依赖](#step-13识别平台依赖)
- [Step 1.4：设计目标目录结构](#step-14设计目标目录结构)
- [Step 1.5：制定抽取顺序](#step-15制定抽取顺序)
- [Step 1.6：验证清单完整性](#step-16验证清单完整性)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**确定从 Android 工程抽取 C++ Core 的完整边界，输出可执行的文件清单。**

这一步不写任何代码，只做决策和清单。后续 Step 02-10 按此清单逐个迁移。

| 决策项 | 输出 |
|---|---|
| 哪些文件进 Core | 抽取清单表 |
| 哪些文件留平台层 | 保留清单表 |
| 平台依赖在哪里 | 依赖识别表 + 剥离方案 |
| Core 目录怎么组织 | 目标目录结构 |
| 按什么顺序迁移 | 抽取顺序（对应 Step 02-10） |

**验收标准：**
- Android 工程 `app/src/main/cpp/` 下每个文件都被明确归类（进 Core / 留平台 / 拆分）
- 每个平台依赖点都有对应的剥离方案
- 清单与 Android 工程实际文件一一对应，无遗漏

**本步不包含：**
- 实际的文件移动操作
- CMakeLists.txt 编写
- 任何代码修改

---

## Step 1.1：盘点 Android 工程当前文件

抽取前先确认源头有什么。Android 工程 `app/src/main/cpp/` 的完整结构：

```text
app/src/main/cpp/
├── CMakeLists.txt
│
├── core/include/                    ← 13 个头文件
│   ├── js_engine.h
│   ├── js_bridge.h
│   ├── native_module.h
│   ├── module_registry.h
│   ├── platform_bridge.h
│   ├── runtime_event_loop.h
│   ├── runtime_thread.h
│   ├── rpk_loader.h
│   ├── manifest_parser.h
│   ├── vnode.h
│   ├── style_resolver.h
│   ├── layout_engine.h
│   └── runtime_bootstrap.h
│
├── core/src/                        ← 13 个源文件
│   ├── platform_bridge.cpp
│   ├── quickjs_engine.cpp
│   ├── runtime_thread.cpp
│   ├── module_registry.cpp
│   ├── js_bridge.cpp
│   ├── router_module.cpp
│   ├── prompt_module.cpp
│   ├── rpk_loader.cpp
│   ├── manifest_parser.cpp
│   ├── vnode.cpp
│   ├── style_resolver.cpp
│   ├── layout_engine.cpp
│   └── runtime_bootstrap.cpp
│
├── platform/common/                 ← 跨平台但非 Core 逻辑
│   ├── posix_event_loop.h
│   └── posix_event_loop.cpp
│
├── platform/android/                ← Android 专有
│   ├── jni_bridge.cpp
│   ├── asset_reader.h
│   └── asset_reader.cpp
│
└── third_party/quickjs/             ← QuickJS 2024-01-13（17 个文件）
    ├── quickjs.c / quickjs.h
    ├── libregexp.c / libregexp.h
    ├── libunicode.c / libunicode.h
    ├── cutils.c / cutils.h
    ├── libbf.c / libbf.h
    └── ...
```

Kotlin 侧（不参与抽取，但需要知道边界在哪）：

```text
app/src/main/java/com/quickappkit/runtime/
├── MainActivity.kt          Demo 外壳
├── QuickAppRuntime.kt       JNI 入口 + native 方法声明
├── ViewRenderer.kt          渲染命令 → Android View
└── TitleBarView.kt          标题栏

app/src/main/assets/
└── framework.js             JS 框架层
```

**盘点结论：**

```text
core/include/     13 个头文件  → 全部进 Core
core/src/         13 个源文件  → 全部进 Core
platform/common/   2 个文件    → 进 Core（是默认实现，不是平台专有）
platform/android/  3 个文件    → 留 Android
third_party/       17 个文件   → 进 Core
Kotlin 4 个文件               → 留 Android
framework.js                  → 进 Core（js/ 目录）
```

---

## Step 1.2：划分抽取边界

判断一个文件该不该进 Core，只看一个标准：

```text
这个文件的逻辑在 iOS 和 LVGL 上是否完全一样？
    是 → 进 Core
    否 → 留平台层
```

### 1.2.1：进 Core 的文件（28 个 + QuickJS）

| 文件 | 为什么进 Core | 需要改动 |
|---|---|---|
| `js_engine.h` | 引擎抽象接口，三端相同 | 无 |
| `quickjs_engine.cpp` | QuickJS 封装，三端相同 | 替换日志宏 |
| `runtime_event_loop.h` | 调度抽象接口，三端相同 | 无 |
| `runtime_thread.h/.cpp` | 线程管理，用 std::thread，三端相同 | 替换日志宏 |
| `posix_event_loop.h/.cpp` | 用 std::mutex + condvar，三端相同 | 替换日志宏 |
| `platform_bridge.h/.cpp` | 定义接口 + 全局注册，三端相同 | 无 |
| `native_module.h` | 模块基类，三端相同 | 无 |
| `module_registry.h/.cpp` | 注册表，三端相同 | 替换日志宏 |
| `js_bridge.h/.cpp` | QuickJS 全局注入，三端相同 | 替换日志宏 |
| `router_module.cpp` | 页面栈逻辑，三端相同 | 替换日志宏 |
| `prompt_module.cpp` | 转发到 PlatformBridge.showToast | 替换日志宏 |
| `rpk_loader.h/.cpp` | ZIP 解析，输入是 bytes，三端相同 | 替换日志宏 |
| `manifest_parser.h/.cpp` | JSON 解析，三端相同 | 替换日志宏 |
| `vnode.h/.cpp` | 数据结构，三端相同 | 无 |
| `style_resolver.h/.cpp` | 字符串匹配，三端相同 | 无 |
| `layout_engine.h/.cpp` | 纯数学计算，三端相同 | 无 |
| `runtime_bootstrap.h/.cpp` | 启动编排，三端相同 | 替换日志宏 |
| `third_party/quickjs/*` | JS 引擎源码 | 无 |
| `framework.js` | JS 框架层，三端相同 | 无 |

### 1.2.2：留平台层的文件（3 个 + Kotlin）

| 文件 | 为什么留下 | Core 侧对应物 |
|---|---|---|
| `jni_bridge.cpp` | 包含 `<jni.h>`，实现 PlatformBridge 的 Android 版本 | `platform_bridge.h` 的接口定义 |
| `asset_reader.h/.cpp` | 用 Android AssetManager 读 RPK | Core 只接收 `uint8_t*` |
| `QuickAppRuntime.kt` | Kotlin 类，JNI 对端 | 无 |
| `ViewRenderer.kt` | 创建 Android View | 无 |
| `TitleBarView.kt` | Android View 子类 | 无 |
| `MainActivity.kt` | Android Activity | 无 |

### 1.2.3：新增的文件（Core 独有，Android 工程原本没有）

| 文件 | 为什么新增 |
|---|---|
| `qa_log.h` | 日志抽象，替代散落各处的 `__android_log_print` |
| `platform_event_sink.h/.cpp` | Android 版本的事件通道原本混在 jni_bridge.cpp 里，抽取时独立出来 |
| `runtime_host.h/.cpp` | Android 版本的启动逻辑原本在 jni_bridge.cpp 里，抽取时提升为对外 API |
| `CMakeLists.txt`（Core 版） | 独立编译 |

**边界总结：**

```text
Core 的输入边界：
    - PlatformBridge 函数指针（平台注册进来）
    - RPK 字节数组（平台读文件后传进来）
    - PlatformEvent（平台事件投递进来）

Core 的输出边界：
    - 调用 PlatformBridge 函数指针发渲染命令
    - 通过 QA_LOG* 宏输出日志

Core 不做的事：
    - 不读文件（不 fopen / 不 AssetManager）
    - 不创建 UI（不 TextView / 不 UILabel / 不 lv_label）
    - 不管 UI 线程调度（平台自己 post 到主线程）
```

---

## Step 1.3：识别平台依赖

抽取的核心难点不是移动文件，而是剥离藏在 Core 代码里的 Android 依赖。

### 1.3.1：扫描平台依赖

在 Android 工程根目录执行：

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android

# 找 Android 日志调用
grep -rn "__android_log_print" app/src/main/cpp/core/

# 找 Android 头文件
grep -rn "#include <android/" app/src/main/cpp/core/
grep -rn "#include <jni.h>" app/src/main/cpp/core/

# 找 AssetManager 使用
grep -rn "AAssetManager\|AAsset" app/src/main/cpp/core/
```

预期结果：

```text
__android_log_print   → 出现在 core/src/ 的多个 .cpp 中（通过 LOGI/LOGE 宏）
#include <android/log.h> → 出现在 core/src/ 的多个 .cpp 中
#include <jni.h>       → 只出现在 platform/android/，core/ 中应为 0
AAssetManager          → 只出现在 platform/android/asset_reader.cpp
```

如果 `core/` 中出现了 `<jni.h>`，说明当前代码有跨层污染，抽取前必须先修掉。

### 1.3.2：依赖分类与剥离方案

| 依赖 | 出现位置 | 剥离方案 | 对应 Step |
|---|---|---|---|
| `__android_log_print` | `core/src/*.cpp` 中的 LOGI/LOGE 宏定义 | 统一替换为 `QA_LOGI`/`QA_LOGE`，实现在 `qa_log.h` 中按平台条件编译 | Step 03 |
| `#include <android/log.h>` | 同上 | 移除，改为 `#include "qa_log.h"` | Step 03 |
| Android AssetManager | `platform/android/asset_reader.cpp` | 不进 Core。Core 的 `RPKLoader::open(const uint8_t*, size_t)` 只接收内存数据 | Step 08 |
| `#include <jni.h>` | `platform/android/jni_bridge.cpp` | 不进 Core。JNI 是 PlatformBridge 的 Android 实现 | Step 11 |
| Android UI 线程调度 | `jni_bridge.cpp` 中的 runOnUiThread 逻辑 | 不进 Core。平台实现 PlatformBridge 时自行处理 | Step 11 |

### 1.3.3：当前 Android 代码中的日志宏（抽取前）

Android 工程的 `core/src/*.cpp` 文件顶部普遍是这个模式：

```cpp
// 当前状态：每个 .cpp 各自定义一份，且直接依赖 Android
#include <android/log.h>

#define LOG_TAG "quickapp-core"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
```

问题有三个：

```text
1. 每个 .cpp 重复定义一遍 → 维护成本
2. 直接依赖 <android/log.h> → 桌面和 iOS 编译不过
3. 宏名 LOGI/LOGE 太通用 → 容易和平台 SDK 的同名宏冲突
```

抽取后的目标状态：

```cpp
// 目标状态：统一 include，平台无关
#include "qa_log.h"

// 使用带项目前缀的宏名，避免符号冲突
QA_LOGI("engine initialized");
QA_LOGE("eval failed: %s", error.c_str());
```

`qa_log.h` 内部按平台条件编译，具体实现见 Step 03。

### 1.3.4：剥离后的验证方法

Core 编译完成后，用符号表验证平台依赖是否真的干净：

```bash
# 编译 Core（桌面）
cd quickapp-runtime-core
cmake -B build && cmake --build build

# 检查 Android 符号（应该无输出）
nm build/libquickapp-core.a | grep __android_log_print

# 检查 JNI 符号（应该无输出）
nm build/libquickapp-core.a | grep -i "JNI_\|jni"

# 检查 Objective-C 符号（应该无输出）
nm build/libquickapp-core.a | grep objc_msgSend
```

三条命令都无输出，说明 Core 真正做到了平台无关。

---

## Step 1.4：设计目标目录结构

### 1.4.1：Core 独立后的目录

```text
/Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core/
├── CMakeLists.txt                    顶层构建脚本
├── README.md                         集成说明
│
├── include/                          公开头文件（平台层可 include）
│   ├── qa_log.h                      【新增】日志抽象
│   ├── js_engine.h                   ← core/include/js_engine.h
│   ├── runtime_event_loop.h          ← core/include/runtime_event_loop.h
│   ├── runtime_thread.h              ← core/include/runtime_thread.h
│   ├── platform_bridge.h             ← core/include/platform_bridge.h
│   ├── platform_event_sink.h         【新增】事件通道
│   ├── native_module.h               ← core/include/native_module.h
│   ├── module_registry.h             ← core/include/module_registry.h
│   ├── js_bridge.h                   ← core/include/js_bridge.h
│   ├── rpk_loader.h                  ← core/include/rpk_loader.h
│   ├── manifest_parser.h             ← core/include/manifest_parser.h
│   ├── vnode.h                       ← core/include/vnode.h
│   ├── style_resolver.h              ← core/include/style_resolver.h
│   ├── layout_engine.h               ← core/include/layout_engine.h
│   ├── runtime_bootstrap.h           ← core/include/runtime_bootstrap.h
│   └── runtime_host.h                【新增】对外顶层 API
│
├── src/                              实现文件（平台层不直接 include）
│   ├── quickjs_engine.cpp            ← core/src/quickjs_engine.cpp
│   ├── runtime_thread.cpp            ← core/src/runtime_thread.cpp
│   ├── platform_bridge.cpp           ← core/src/platform_bridge.cpp
│   ├── platform_event_sink.cpp       【新增】
│   ├── module_registry.cpp           ← core/src/module_registry.cpp
│   ├── js_bridge.cpp                 ← core/src/js_bridge.cpp
│   ├── router_module.cpp             ← core/src/router_module.cpp
│   ├── prompt_module.cpp             ← core/src/prompt_module.cpp
│   ├── rpk_loader.cpp                ← core/src/rpk_loader.cpp
│   ├── manifest_parser.cpp           ← core/src/manifest_parser.cpp
│   ├── vnode.cpp                     ← core/src/vnode.cpp
│   ├── style_resolver.cpp            ← core/src/style_resolver.cpp
│   ├── layout_engine.cpp             ← core/src/layout_engine.cpp
│   ├── runtime_bootstrap.cpp         ← core/src/runtime_bootstrap.cpp
│   └── runtime_host.cpp              【新增】
│
├── platform/common/                  跨平台默认实现
│   ├── posix_event_loop.h            ← platform/common/posix_event_loop.h
│   └── posix_event_loop.cpp          ← platform/common/posix_event_loop.cpp
│
├── js/
│   └── framework.js                  ← app/src/main/assets/framework.js
│
├── third_party/
│   └── quickjs/                      ← third_party/quickjs/（17 个文件）
│
└── tests/                            【新增】桌面单元测试
    ├── CMakeLists.txt
    ├── test_event_loop.cpp
    ├── test_js_engine.cpp
    ├── test_rpk_loader.cpp
    ├── test_layout.cpp
    └── test_bootstrap.cpp
```

### 1.4.2：include/ 和 src/ 分离的原因

```text
include/  → 公开 API，平台层需要 include 的头文件
src/      → 内部实现，平台层不应该 include
```

这样 CMake 可以只把 `include/` 暴露给依赖方：

```cmake
target_include_directories(quickapp-core
    PUBLIC  ${CMAKE_CURRENT_SOURCE_DIR}/include      # 平台层可见
    PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src          # 仅 Core 内部可见
    PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/third_party/quickjs  # QuickJS 不外泄
)
```

QuickJS 头文件放 PRIVATE 是关键决策：平台层不应该知道 Core 用的是 QuickJS 还是别的引擎。

### 1.4.3：Android 工程抽取后的样子

```text
app/src/main/cpp/
├── CMakeLists.txt              【改】用 add_subdirectory 引入 Core
│
├── core/                       【删除】整个目录移到 Core 项目
├── third_party/                【删除】移到 Core 项目
├── platform/common/            【删除】移到 Core 项目
│
└── platform/android/           【保留】
    ├── jni_bridge.cpp          【改】include Core 的头文件
    ├── asset_reader.h
    └── asset_reader.cpp
```

Android 工程从 45+ 个 C++ 文件缩减到 3 个，剩下的全是真正的 Android 适配代码。

---

## Step 1.5：制定抽取顺序

抽取顺序必须遵循依赖方向：**先抽被依赖的，后抽依赖别人的。**

### 1.5.1：依赖关系分析

```text
qa_log.h                     ← 无依赖（最底层）
    ↑
js_engine.h                  ← 依赖 qa_log
runtime_event_loop.h         ← 依赖 qa_log
platform_bridge.h            ← 无依赖（纯接口）
    ↑
runtime_thread.h             ← 依赖 js_engine + runtime_event_loop
platform_event_sink.h        ← 依赖 runtime_event_loop
    ↑
native_module.h              ← 依赖 quickjs（JSCFunction 签名）
module_registry.h            ← 依赖 native_module
js_bridge.h                  ← 依赖 module_registry + js_engine
    ↑
rpk_loader.h                 ← 依赖 qa_log
manifest_parser.h            ← 依赖 js_engine（用 JS_ParseJSON）
    ↑
vnode.h                      ← 无依赖（纯数据）
style_resolver.h             ← 依赖 vnode
layout_engine.h              ← 依赖 vnode
    ↑
runtime_bootstrap.h          ← 依赖上面全部
    ↑
runtime_host.h               ← 依赖 runtime_bootstrap + runtime_thread
```

### 1.5.2：抽取顺序表（对应后续 Step）

| 顺序 | 内容 | 对应 Step | 可独立验证 |
|---|---|---|---|
| 1 | CMake 骨架 + QuickJS 编译 | Step 02 | ✓ 生成 .a |
| 2 | qa_log.h 日志抽象 | Step 03 | ✓ 符号表检查 |
| 3 | js_engine.h + quickjs_engine.cpp | Step 04 | ✓ eval 测试 |
| 4 | runtime_event_loop + posix_event_loop + runtime_thread | Step 05 | ✓ post/timer 测试 |
| 5 | platform_bridge + platform_event_sink | Step 06 | ✓ mock bridge 测试 |
| 6 | native_module + module_registry + js_bridge + router/prompt | Step 07 | ✓ $app_require$ 测试 |
| 7 | rpk_loader + manifest_parser | Step 08 | ✓ 解析测试 RPK |
| 8 | vnode + style_resolver + layout_engine | Step 09 | ✓ 布局计算测试 |
| 9 | runtime_bootstrap + runtime_host + framework.js | Step 10 | ✓ 完整启动链路 |
| 10 | 三端集成替换 | Step 11 | ✓ Android build 通过 |

每一步抽取完都能在桌面独立编译验证，不需要等到全部抽完才知道对不对。这是抽取过程可控的关键。

---

## Step 1.6：验证清单完整性

抽取清单做完后，必须验证没有遗漏。

### 1.6.1：文件计数核对

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android

# 统计 core 目录文件数
find app/src/main/cpp/core -type f \( -name "*.h" -o -name "*.cpp" \) | wc -l
# 预期：26（13 个 .h + 13 个 .cpp）

# 统计 platform/common
find app/src/main/cpp/platform/common -type f | wc -l
# 预期：2

# 统计 platform/android
find app/src/main/cpp/platform/android -type f | wc -l
# 预期：3

# 统计 third_party
find app/src/main/cpp/third_party -type f | wc -l
# 预期：17
```

核对表：

| 目录 | 文件数 | 归属 |
|---|---|---|
| `core/include/` | 13 | → Core `include/` |
| `core/src/` | 13 | → Core `src/` |
| `platform/common/` | 2 | → Core `platform/common/` |
| `platform/android/` | 3 | 留在 Android |
| `third_party/quickjs/` | 17 | → Core `third_party/` |
| **总计** | **48** | **45 进 Core，3 留 Android** |

加上新增的 6 个文件（`qa_log.h`、`platform_event_sink.h/.cpp`、`runtime_host.h/.cpp`、Core 的 `CMakeLists.txt`），Core 最终有 51 个文件。

### 1.6.2：交叉引用检查

确认每个进 Core 的文件，其 `#include` 的所有头文件也都在 Core 里：

```bash
# 列出 core/ 中所有 include 的项目内头文件
grep -rho '#include "[^"]*"' app/src/main/cpp/core/ | sort -u
```

预期输出的每一项都应该在抽取清单中。如果出现 `#include "asset_reader.h"` 这样引用平台层的情况，说明有跨层污染，必须先修复。

### 1.6.3：Kotlin 侧接口盘点

Core 抽取不影响 Kotlin，但需要确认 JNI 边界上的方法签名不变：

```bash
grep -n "external fun" app/src/main/java/com/quickappkit/runtime/QuickAppRuntime.kt
```

预期：

```kotlin
private external fun nativeInitialize()
private external fun nativeLaunch(rpkBytes: ByteArray)
private external fun nativeDispatchClick(nodeId: Int)
private external fun nativeRelease()
```

这些签名在 Step 11 集成后必须完全不变，否则 Kotlin 侧要跟着改。

### 1.6.4：抽取前的基线快照

抽取前先记录当前状态，作为回归对比基准：

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android

# 1. 确认当前能编译通过
./gradlew clean :app:assembleDebug
# 预期：BUILD SUCCESSFUL

# 2. 记录 .so 大小（抽取后应该接近）
ls -lh app/build/intermediates/merged_native_libs/debug/out/lib/arm64-v8a/

# 3. 记录运行时日志基线
adb logcat -c && adb shell am start -n com.quickappkit.runtime/.MainActivity
adb logcat -d | grep quickapp-core > /tmp/baseline-log.txt
```

Step 11 集成完成后，用同样命令对比：编译要通过、`.so` 大小接近、日志输出一致。

---

## 技术决策

### 1. Core 的输入边界用字节数组，不用文件路径

```text
不这样：RPKLoader::open(const char* path)   ← 需要文件系统 API
而是：  RPKLoader::open(const uint8_t* data, size_t size)
```

原因：Android 从 AssetManager 读，iOS 从 NSBundle 读，LVGL 可能从 SPI Flash 读。三端文件访问方式完全不同，但都能提供一段内存。把文件读取留给平台层，Core 只处理内存数据。

### 2. posix_event_loop 放 platform/common/ 而不是 src/

```text
src/               ← Core 逻辑，三端行为完全一致
platform/common/   ← 默认实现，平台可以替换
```

`PosixEventLoop` 依赖 POSIX 线程语义。Android/iOS/Linux 都支持，但某些 RTOS 嵌入式环境不支持，需要换成 FreeRTOS 的实现。放在 `platform/common/` 表明这是"通常可用的默认实现"，不是"必须如此"。

### 3. QuickJS 头文件设为 PRIVATE

平台层不应该知道 Core 用什么 JS 引擎。如果 QuickJS 头文件是 PUBLIC，平台代码就可能直接调 `JS_NewObject`，破坏 JSEngine 抽象，未来换引擎时要改所有平台代码。

例外：`native_module.h` 需要 `JSCFunction` 签名，所以它必须 include quickjs.h。这是 V1 的已知妥协，V2 可以用自定义函数签名包一层来彻底解耦。

### 4. 新增 runtime_host.h 作为唯一对外入口

Android 版本的启动逻辑散落在 `jni_bridge.cpp` 里。抽取时提升为 `RuntimeHost`，让三端的集成代码长得一样：

```cpp
// 三端都是这四步，只有 bridge 实现不同
RuntimeHost host;
host.create({bridge, rpkData, rpkSize});
host.start();
// ... 运行中 ...
host.destroy();
```

### 5. 日志宏加 QA_ 前缀

`LOGI`/`LOGE` 是极其常见的宏名。Android NDK 示例、LVGL、很多第三方库都用。不加前缀会在集成时产生宏重定义警告或行为错乱。`QA_LOGI` 保证唯一性。

---

## QA

### 1. 为什么不直接把整个 cpp 目录复制成 Core

因为 `platform/android/` 里的 `jni_bridge.cpp` 包含 `<jni.h>`，iOS 和 LVGL 编译不过。抽取的本质是识别并切断这类平台耦合，不是简单复制。

### 2. 抽取后 Android 工程会变慢吗

不会。CMake 的 `add_subdirectory` 是编译期集成，最终还是链接进同一个 `.so`。区别只是源码位置从工程内变成工程外，产物结构不变。

### 3. framework.js 为什么进 Core 而不是留在 assets

`framework.js` 实现 `$app_define$`/`$app_bootstrap$` 的 JS 侧逻辑，三端完全一致。放 Core 保证三端行为一致，避免各平台 assets 目录里的副本版本漂移。

具体加载方式有两种，Step 10 决定：
```text
方式 A：编译期转为 C++ 字符串常量（xxd -i 或 CMake 脚本生成）
方式 B：平台层读文件后传入（和 RPK 一样走字节数组）
```

### 4. tests/ 目录为什么是新增的

Android 工程的验证方式是"装到设备上看屏幕"，无法做细粒度单元测试。Core 独立后能在桌面编译，才有了跑单元测试的可能。这是抽取带来的额外收益，不只是为了跨平台。

### 5. 抽取过程中 Android 工程会不可用吗

不会。抽取按 Step 02-10 逐步进行，期间 Android 工程保持原样不动。直到 Step 11 才做替换。这样任何一步出问题都能立刻回退，Android 始终有可运行的版本作为对照。

### 6. 为什么 native_module.h 允许依赖 quickjs.h

理想设计是 Core 完全不暴露 QuickJS 类型。但 `MethodDef` 需要存函数指针，而函数签名就是 QuickJS 的 `JSCFunction`：

```cpp
typedef JSValue (*JSCFunction)(JSContext*, JSValueConst, int, JSValueConst*);
```

要彻底解耦需要定义中间层类型 + 参数转换适配器，V1 阶段收益不明显。这是有意识的妥协，记录在这里，V2 换引擎时再处理。

### 7. Step 01 完成后得到了什么

一份可执行的抽取计划：

```text
✓ 48 个现有文件全部归类（45 进 Core / 3 留 Android）
✓ 6 个新增文件明确职责
✓ 5 类平台依赖有对应剥离方案
✓ 抽取顺序与依赖方向一致，每步可独立验证
✓ 基线快照建立，Step 11 有回归对比依据
```

后续 Step 02-10 只需按清单执行，不需要再做架构判断。

---

## 下一步

按 `tasks.md` 进入 Step 02：建立独立 CMake 项目，编译 QuickJS，生成第一个 `libquickapp-core.a`。
