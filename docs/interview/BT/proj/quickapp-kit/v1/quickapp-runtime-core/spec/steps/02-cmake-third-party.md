# Step 2：独立 CMake 项目与 QuickJS 编译

## 目录

- [目标](#目标)
- [Step 2.1：创建 Core 项目骨架](#step-21创建-core-项目骨架)
- [Step 2.2：迁移 QuickJS 源码](#step-22迁移-quickjs-源码)
- [Step 2.3：编写 QuickJS 子项目 CMake](#step-23编写-quickjs-子项目-cmake)
- [Step 2.4：编写 Core 顶层 CMake](#step-24编写-core-顶层-cmake)
- [Step 2.5：创建占位源文件](#step-25创建占位源文件)
- [Step 2.6：逐层验证](#step-26逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**建立可独立编译的 Core 项目，产出第一个 `libquickapp-core.a`。**

| 层 | 职责 | 文件 |
|---|---|---|
| 顶层 CMake | 定义 Core 静态库、include 路径、编译选项 | `CMakeLists.txt` |
| QuickJS CMake | 把 QuickJS C 源码编译为独立静态库 | `third_party/quickjs/CMakeLists.txt` |
| 占位源文件 | 让链接器有东西可链，验证构建链路 | `src/core_version.cpp` |

**验收标准：**
- `cmake -B build && cmake --build build` 在 macOS/Linux 成功
- 产出 `build/libquickapp-core.a` 和 `build/third_party/quickjs/libquickjs.a`
- 测试程序能链接 Core 并调用其中函数

**本步不包含：**
- 任何业务逻辑代码（JSEngine、EventLoop 等留给 Step 04+）
- 日志抽象（Step 03）
- Android/iOS 交叉编译配置（Step 11）

---

## Step 2.1：创建 Core 项目骨架

Core 是独立仓库目录，和 Android 工程平级。

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit

# 创建目录结构
mkdir -p quickapp-runtime-core/{include,src,platform/common,js,third_party,tests}

cd quickapp-runtime-core
```

确认结构：

```bash
find . -type d | sort
```

预期输出：

```text
.
./include
./js
./platform
./platform/common
./src
./tests
./third_party
```

---

## Step 2.2：迁移 QuickJS 源码

QuickJS 源码从 Android 工程原样复制，不做任何修改。

```bash
# 从 Android 工程复制 QuickJS
cp -r /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-android/app/src/main/cpp/third_party/quickjs \
      third_party/

# 确认文件数
ls third_party/quickjs/ | wc -l
```

预期 17 个文件：

```text
cutils.c        cutils.h
libbf.c         libbf.h
libregexp.c     libregexp.h
libregexp-opcode.h
libunicode.c    libunicode.h
libunicode-table.h
list.h
quickjs.c       quickjs.h
quickjs-atom.h
quickjs-opcode.h
quickjs-libc.c  quickjs-libc.h
```

**版本确认：**

```bash
grep "define VERSION" third_party/quickjs/quickjs.h
```

预期：

```c
#define VERSION "2024-01-13"
```

这个版本号后面要写进 CMake，作为 QuickJS 编译时的 `CONFIG_VERSION` 宏。

---

## Step 2.3：编写 QuickJS 子项目 CMake

QuickJS 是纯 C 项目，作者只提供 Makefile。我们给它写一份 CMake 包装，编译为独立静态库。

**@add `third_party/quickjs/CMakeLists.txt`（新建文件）**

```cmake
# QuickJS 静态库
#
# QuickJS 官方只提供 Makefile。这里用 CMake 包装，目的是：
#   1. 让 Core 能通过 target_link_libraries 直接依赖
#   2. 三端（Android NDK / iOS / 桌面）用同一份构建脚本
#   3. 编译选项集中管理，不散落在各平台工程里

cmake_minimum_required(VERSION 3.22)

project(quickjs C)

# QuickJS 是 C99 项目，不是 C++。
# 如果用 C++ 编译器编译会报大量类型转换错误。
set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

# QuickJS 需要的编译期宏
#   CONFIG_VERSION：版本字符串，QuickJS 内部用于 JS_GetVersion()
#   _GNU_SOURCE：启用 GNU 扩展（QuickJS 用到 asprintf 等）
add_definitions(
    -DCONFIG_VERSION="2024-01-13"
    -D_GNU_SOURCE
)

# 关闭 QuickJS 源码中的已知警告。
# QuickJS 大量使用 computed goto、类型双关等技巧，
# 开启严格警告会产生上百条噪音，掩盖我们自己代码的真实问题。
add_compile_options(
    -Wno-unused-variable
    -Wno-unused-but-set-variable
    -Wno-array-bounds
    -Wno-format-truncation
    -Wno-implicit-fallthrough
)

# QuickJS 核心源文件。
# 注意不包含 quickjs-libc.c：
#   它提供 std/os 模块（文件 IO、进程），依赖完整 POSIX 环境。
#   Runtime 场景下 JS 不应该直接访问文件系统，能力应通过 NativeModule 受控开放。
add_library(quickjs STATIC
    quickjs.c        # 引擎核心：解析、字节码、GC
    libregexp.c      # 正则引擎
    libunicode.c     # Unicode 支持
    cutils.c         # 工具函数：动态数组、字符串
    libbf.c          # 大数运算（BigInt）
)

# 头文件路径对依赖方公开。
# Core 的 quickjs_engine.cpp 需要 #include "quickjs.h"
target_include_directories(quickjs PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# QuickJS 依赖数学库（pow、fmod 等）。
# Linux 必须显式链接 libm；macOS 的 libSystem 已内置，链接 m 是空操作但无害。
find_library(MATH_LIBRARY m)
if(MATH_LIBRARY)
    target_link_libraries(quickjs PUBLIC ${MATH_LIBRARY})
endif()

# 线程支持：QuickJS 的 JS_NewRuntime 在多线程环境下需要
find_package(Threads REQUIRED)
target_link_libraries(quickjs PUBLIC Threads::Threads)
```

**解释几个关键点：**

```text
为什么排除 quickjs-libc.c
    它把 std.open / os.exec 等能力直接暴露给 JS。
    Runtime 里 JS 是不可信代码（来自 RPK），不能有裸文件系统访问。
    需要文件能力时通过 NativeModule 受控开放。

为什么必须 C99 而不是 C11/C17
    QuickJS 用了 GCC 的 computed goto 扩展（&&label）。
    C99 + GNU 扩展是官方验证的组合，换标准可能触发未知编译问题。

为什么关警告
    QuickJS 是高度优化的解释器实现，代码风格激进。
    开启 -Wall 会有 100+ 警告，全是作者有意为之的写法。
    关掉它们，我们自己代码的警告才可见。
```

---

## Step 2.4：编写 Core 顶层 CMake

**@add `CMakeLists.txt`（新建文件）**

```cmake
# quickapp-runtime-core
#
# 跨平台快应用运行时核心库。
# 产出 libquickapp-core.a，供 Android / iOS / LVGL 三端链接。
#
# 设计约束：
#   - 不依赖任何平台 API（无 jni.h / UIKit / lvgl.h）
#   - 不做文件 IO（RPK 数据由平台层读取后传入）
#   - 不创建 UI（通过 PlatformBridge 函数指针发命令）

cmake_minimum_required(VERSION 3.22)

project(quickapp-runtime-core
    VERSION 1.0.0
    LANGUAGES C CXX
)

# ============================================================
# 编译标准
# ============================================================

# C++17：用到 std::optional、std::variant、结构化绑定、if constexpr
set(CMAKE_CXX_STANDARD 17)
# ON 表示编译器不支持 C++17 时直接报错终止，
# 而不是静默降级到 C++14 然后在编译源码时报一堆语法错误
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# 关闭编译器扩展，保证三端行为一致（GNU 扩展在 MSVC 上不可用）
set(CMAKE_CXX_EXTENSIONS OFF)

# 静态库必须开 PIC。
# Android 的 .so 和 iOS 的 framework 都是动态库，
# 链接进去的静态库如果没有位置无关代码，链接期会报
# "relocation R_X86_64_32 against .rodata can not be used when making a shared object"
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# ============================================================
# 第三方依赖
# ============================================================

add_subdirectory(third_party/quickjs)

# zlib：RPK 解压需要 inflate。
# 优先用系统库，找不到时报错提示用户安装（不自动下载，避免网络依赖）
find_package(ZLIB QUIET)
if(NOT ZLIB_FOUND)
    message(FATAL_ERROR
        "zlib not found. Install it first:\n"
        "  macOS:  brew install zlib\n"
        "  Ubuntu: sudo apt install zlib1g-dev\n"
        "  Android NDK / iOS SDK: already bundled, no action needed")
endif()

# ============================================================
# Core 静态库
# ============================================================

# Step 02 只有占位文件。后续 Step 逐个加入真实源文件：
#   Step 04 → src/quickjs_engine.cpp
#   Step 05 → src/runtime_thread.cpp, platform/common/posix_event_loop.cpp
#   Step 06 → src/platform_bridge.cpp, src/platform_event_sink.cpp
#   Step 07 → src/module_registry.cpp, src/js_bridge.cpp,
#             src/router_module.cpp, src/prompt_module.cpp
#   Step 08 → src/rpk_loader.cpp, src/manifest_parser.cpp
#   Step 09 → src/vnode.cpp, src/style_resolver.cpp, src/layout_engine.cpp
#   Step 10 → src/runtime_bootstrap.cpp, src/runtime_host.cpp
add_library(quickapp-core STATIC
    src/core_version.cpp
)

# ============================================================
# 头文件路径
# ============================================================

target_include_directories(quickapp-core
    # PUBLIC：平台层 include Core 头文件时需要这个路径
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    # PRIVATE：仅 Core 内部编译时可见。
    # QuickJS 设为 PRIVATE 是有意的：平台层不应该知道用的是哪个 JS 引擎，
    # 否则平台代码可能直接调 JS_NewObject，绕过 JSEngine 抽象。
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
        ${CMAKE_CURRENT_SOURCE_DIR}/platform/common
)

# ============================================================
# 链接依赖
# ============================================================

target_link_libraries(quickapp-core
    # PRIVATE：QuickJS 和 zlib 的符号不传递给平台层。
    # 平台层链接 quickapp-core 时不会看到 JS_NewRuntime 等符号，
    # 保证抽象边界。
    PRIVATE
        quickjs
        ZLIB::ZLIB
)

# std::thread 需要 pthread
find_package(Threads REQUIRED)
target_link_libraries(quickapp-core PUBLIC Threads::Threads)

# ============================================================
# 编译选项
# ============================================================

target_compile_options(quickapp-core PRIVATE
    -Wall
    -Wextra
    # 未使用参数在虚函数实现和回调里很常见（如 JNI 的 reserved 参数），
    # 不是真实问题，关掉减少噪音
    -Wno-unused-parameter
)

# ============================================================
# 测试（可选，桌面开发时开启）
# ============================================================

# 默认开启，但作为子项目被引入时自动关闭：
# Android/iOS 集成 Core 时不需要编译测试代码
option(QUICKAPP_CORE_BUILD_TESTS "Build core unit tests" ON)

if(QUICKAPP_CORE_BUILD_TESTS AND CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
    enable_testing()
    add_subdirectory(tests)
endif()

# ============================================================
# 构建信息输出
# ============================================================

message(STATUS "quickapp-core configuration:")
message(STATUS "  Version:      ${PROJECT_VERSION}")
message(STATUS "  C++ standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Build type:   ${CMAKE_BUILD_TYPE}")
message(STATUS "  System:       ${CMAKE_SYSTEM_NAME}")
message(STATUS "  Tests:        ${QUICKAPP_CORE_BUILD_TESTS}")
```

**`CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR` 的作用：**

```text
独立编译 Core 时：
    CMAKE_SOURCE_DIR         = /path/to/quickapp-runtime-core
    CMAKE_CURRENT_SOURCE_DIR = /path/to/quickapp-runtime-core
    相等 → 编译测试

Android 工程 add_subdirectory 引入时：
    CMAKE_SOURCE_DIR         = /path/to/android/app/src/main/cpp
    CMAKE_CURRENT_SOURCE_DIR = /path/to/quickapp-runtime-core
    不相等 → 跳过测试
```

这样一份 CMake 同时满足"独立开发时能跑测试"和"被集成时不拖累平台构建"。

---

## Step 2.5：创建占位源文件

静态库必须至少有一个源文件，否则 CMake 报错。这个占位文件同时承担版本信息的职责，后续不会删除。

**@add `include/core_version.h`（新建文件）**

```cpp
#ifndef QUICKAPP_CORE_VERSION_H
#define QUICKAPP_CORE_VERSION_H

namespace quickapp {

/**
 * 返回 Core 库版本号。
 * @return 语义化版本字符串，如 "1.0.0"。指向静态存储，调用方不需要释放。
 */
const char* getCoreVersion();

/**
 * 返回 Core 编译时使用的 JS 引擎标识。
 * 用途：平台层日志上报、问题排查时确认引擎版本。
 * @return 引擎名称+版本，如 "QuickJS 2024-01-13"。指向静态存储，不需要释放。
 */
const char* getJSEngineVersion();

} // namespace quickapp

#endif // QUICKAPP_CORE_VERSION_H
```

**@add `src/core_version.cpp`（新建文件）**

```cpp
#include "core_version.h"

namespace quickapp {

// 版本号硬编码在这里，和 CMakeLists.txt 的 project(VERSION) 保持手动同步。
// 后续可以改为 CMake configure_file 自动生成，V1 阶段手动维护成本更低。
const char* getCoreVersion() {
    return "1.0.0";
}

const char* getJSEngineVersion() {
    // 和 third_party/quickjs/CMakeLists.txt 中的 CONFIG_VERSION 保持一致
    return "QuickJS 2024-01-13";
}

} // namespace quickapp
```

**@add `tests/CMakeLists.txt`（新建文件）**

```cmake
# Core 单元测试
#
# 不引入 GoogleTest 等测试框架：
#   - 当前网络环境无法访问 GitHub，无法 FetchContent 下载
#   - Core 的测试点是行为验证（返回值、调用次数），断言 + 退出码够用
#   - 减少依赖，保证任何环境都能跑测试

# test_version：验证构建链路本身是否正确
add_executable(test_version test_version.cpp)
target_link_libraries(test_version PRIVATE quickapp-core)
add_test(NAME test_version COMMAND test_version)

# 后续 Step 逐个加入：
#   Step 04 → test_js_engine
#   Step 05 → test_event_loop
#   Step 06 → test_platform_bridge
#   Step 07 → test_js_bridge
#   Step 08 → test_rpk_loader
#   Step 09 → test_layout
#   Step 10 → test_bootstrap
```

**@add `tests/test_version.cpp`（新建文件）**

```cpp
// 构建链路验证测试。
//
// 这个测试不验证业务逻辑，只验证：
//   1. Core 静态库能被成功链接
//   2. include/ 路径配置正确
//   3. namespace 和符号导出正常
//
// 如果这个测试过不了，说明 CMake 配置有问题，
// 后续所有 Step 都无法进行。

#include <cstdio>
#include <cstring>

#include "core_version.h"

// 简易断言宏。
// 不用 assert()：NDEBUG 下 assert 会被编译器移除，导致测试静默通过。
#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

int main() {
    const char* coreVer = quickapp::getCoreVersion();
    CHECK(coreVer != nullptr, "getCoreVersion returned nullptr");
    CHECK(std::strlen(coreVer) > 0, "getCoreVersion returned empty string");

    const char* engineVer = quickapp::getJSEngineVersion();
    CHECK(engineVer != nullptr, "getJSEngineVersion returned nullptr");
    CHECK(std::strstr(engineVer, "QuickJS") != nullptr,
          "getJSEngineVersion does not mention QuickJS");

    std::printf("PASS: core=%s, engine=%s\n", coreVer, engineVer);
    return 0;
}
```

---

## Step 2.6：逐层验证

### 2.6.1：CMake 配置验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug
```

预期输出结尾：

```text
-- quickapp-core configuration:
--   Version:      1.0.0
--   C++ standard: 17
--   Build type:   Debug
--   System:       Darwin
--   Tests:        ON
-- Configuring done
-- Generating done
-- Build files have been written to: .../quickapp-runtime-core/build
```

**常见错误：**

```text
"zlib not found"
    → macOS: brew install zlib
    → 如果已装但找不到：cmake -B build -DZLIB_ROOT=$(brew --prefix zlib)

"CMake 3.22 or higher is required"
    → cmake --version 检查；macOS: brew upgrade cmake

"No CMAKE_CXX_COMPILER could be found"
    → macOS: xcode-select --install
```

### 2.6.2：编译验证

```bash
cmake --build build -j4
```

预期输出（节选）：

```text
[  8%] Building C object third_party/quickjs/CMakeFiles/quickjs.dir/quickjs.c.o
[ 16%] Building C object third_party/quickjs/CMakeFiles/quickjs.dir/libregexp.c.o
[ 25%] Building C object third_party/quickjs/CMakeFiles/quickjs.dir/libunicode.c.o
[ 33%] Building C object third_party/quickjs/CMakeFiles/quickjs.dir/cutils.c.o
[ 41%] Building C object third_party/quickjs/CMakeFiles/quickjs.dir/libbf.c.o
[ 50%] Linking C static library libquickjs.a
[ 50%] Built target quickjs
[ 58%] Building CXX object CMakeFiles/quickapp-core.dir/src/core_version.cpp.o
[ 66%] Linking CXX static library libquickapp-core.a
[ 66%] Built target quickapp-core
[ 83%] Building CXX object tests/CMakeFiles/test_version.dir/test_version.cpp.o
[100%] Linking CXX executable test_version
[100%] Built target test_version
```

QuickJS 编译约 30-60 秒（`quickjs.c` 单文件 5 万行）。

**常见错误：**

```text
"quickjs.c:xxxx: error: 'CONFIG_VERSION' undeclared"
    → third_party/quickjs/CMakeLists.txt 中 add_definitions 少了 -DCONFIG_VERSION

"undefined reference to 'pow'"
    → find_library(MATH_LIBRARY m) 没生效，Linux 上手动加 target_link_libraries(quickjs PUBLIC m)

"core_version.h: No such file or directory"
    → target_include_directories 的 PUBLIC include 路径写错
```

### 2.6.3：产物验证

```bash
ls -lh build/libquickapp-core.a build/third_party/quickjs/libquickjs.a
```

预期：

```text
build/libquickapp-core.a                 ~10 KB   (只有 core_version.cpp)
build/third_party/quickjs/libquickjs.a   ~2-3 MB  (完整 JS 引擎)
```

确认符号存在：

```bash
nm build/libquickapp-core.a | grep getCoreVersion
```

预期（macOS 输出带下划线前缀）：

```text
0000000000000000 T __ZN8quickapp14getCoreVersionEv
```

`_ZN8quickapp14getCoreVersionEv` 是 C++ name mangling 后的符号名：`quickapp` namespace 下的 `getCoreVersion()`。

### 2.6.4：平台无关性验证

这是 Core 最关键的验证。三条命令都应该无输出：

```bash
# 无 Android 依赖
nm build/libquickapp-core.a | grep __android_log_print

# 无 JNI 依赖
nm build/libquickapp-core.a | grep -i "JNI_OnLoad\|JavaVM"

# 无 Objective-C 依赖
nm build/libquickapp-core.a | grep objc_msgSend
```

任何一条有输出，说明平台耦合没剥离干净，必须回到 Step 01 重新检查边界。

### 2.6.5：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
Test project .../quickapp-runtime-core/build
    Start 1: test_version
1/1 Test #1: test_version .....................   Passed    0.01 sec

100% tests passed, 0 tests failed out of 1
```

也可以直接运行看输出：

```bash
./build/tests/test_version
```

预期：

```text
PASS: core=1.0.0, engine=QuickJS 2024-01-13
```

### 2.6.6：Clean build 验证

确认没有依赖构建缓存的隐藏问题：

```bash
rm -rf build
cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build -j4 && (cd build && ctest)
```

从零编译到测试通过，整个流程应该在 2 分钟内完成。

---

## 技术决策

### 1. Core 编译为静态库而不是动态库

```text
静态库 .a  → 链接期合并进平台产物
动态库 .so → 运行期加载，需要单独部署
```

选静态库的原因：

| 维度 | 静态库 | 动态库 |
|---|---|---|
| Android | 链接进 app 的 `.so`，只有一个 native 库 | 需要打包两个 `.so`，还要处理加载顺序 |
| iOS | 直接链进 app binary，符合 App Store 审核 | 动态库需要签名和 embed，流程复杂 |
| LVGL 嵌入式 | 单一 firmware 镜像 | 很多 RTOS 不支持动态加载 |
| 符号可见性 | 可以用 PRIVATE 隐藏 QuickJS | 符号表容易泄漏 |

嵌入式场景基本排除了动态库的可能，三端统一用静态库最简单。

### 2. QuickJS 独立成子项目而不是直接加入 Core 源文件列表

```cmake
# 不这样做
add_library(quickapp-core STATIC
    third_party/quickjs/quickjs.c    # 混在一起
    src/core_version.cpp
)

# 而是
add_subdirectory(third_party/quickjs)  # 独立 target
target_link_libraries(quickapp-core PRIVATE quickjs)
```

原因有三个：

```text
1. 语言不同
   QuickJS 是 C99，Core 是 C++17。混在一个 target 里
   CMake 会用同一套编译选项，容易出问题。

2. 警告隔离
   QuickJS 需要关掉一堆警告，Core 需要开 -Wall -Wextra。
   独立 target 才能分别设置。

3. 增量编译
   QuickJS 源码不会改，编译一次后永久缓存。
   混在一起时 Core 的 CMake 改动可能触发 QuickJS 重编译（1 分钟）。
```

### 3. zlib 用系统库而不是内置源码

Android NDK、iOS SDK、macOS、主流 Linux 发行版都自带 zlib。内置源码会带来：

```text
- 多 30+ 个源文件
- 和系统 zlib 符号冲突的风险
- 需要自己跟进安全补丁
```

代价是桌面开发时需要一次 `brew install zlib` / `apt install zlib1g-dev`。这个代价可以接受，CMake 里已经给出了明确的错误提示。

如果将来遇到不带 zlib 的嵌入式环境，再加 `QUICKAPP_CORE_BUNDLED_ZLIB` 选项条件编译内置版本。

### 4. QuickJS include 路径设为 PRIVATE

这是维护抽象边界的关键决策：

```cmake
target_include_directories(quickapp-core
    PUBLIC  include                    # 平台层可见
    PRIVATE src third_party/quickjs    # 仅 Core 内部
)
```

如果设成 PUBLIC，平台层代码可以写：

```cpp
#include "quickjs.h"   // 能编译过
JSValue v = JS_NewInt32(ctx, 42);   // 绕过了 JSEngine 抽象
```

一旦有平台代码这么写，未来换 JS 引擎就要改所有平台工程。设为 PRIVATE 从编译层面禁止这种写法。

### 5. 排除 quickjs-libc.c

`quickjs-libc.c` 提供 `std` 和 `os` 两个 JS 模块：

```javascript
import * as std from "std";
std.open("/etc/passwd", "r");   // 直接文件访问

import * as os from "os";
os.exec(["/bin/sh", "-c", "rm -rf /"]);   // 执行任意命令
```

RPK 里的 JS 是不可信代码。Runtime 必须控制它能访问什么。所有系统能力应该通过 NativeModule 显式开放，并接受 Manifest 权限声明的约束（Step 07 实现）。

排除这个文件的副作用：`console.log` 需要自己实现（Step 07 的 JS Bridge 注入）。

### 6. 不引入 GoogleTest

原因是当前网络环境无法访问 GitHub（`Failed to connect to github.com port 443`），`FetchContent_Declare` 会失败。

用简单的 `CHECK` 宏 + 退出码代替：

```cpp
#define CHECK(cond, msg) \
    do { if (!(cond)) { fprintf(stderr, "FAIL: %s\n", msg); return 1; } } while (0)
```

配合 `add_test` 和 `ctest`，功能上够用：能跑测试、能报失败、能集成 CI。缺少的是参数化测试、mock 框架、更漂亮的输出。网络恢复后可以平滑升级到 GoogleTest，测试用例逻辑不用改。

### 7. 不用 assert() 做测试断言

```cpp
assert(cond);   // NDEBUG 下被编译器完全移除
```

Release 构建定义了 `NDEBUG`，`assert` 变成空语句，测试会静默"通过"。用自定义 `CHECK` 宏保证任何构建类型下都真实检查。

---

## QA

### 1. 为什么 Step 02 不直接迁移 JSEngine 代码

因为要分离两类问题：

```text
Step 02 解决：构建系统能不能工作
Step 04 解决：JSEngine 代码能不能工作
```

如果一次性把 CMake 和 15 个源文件都加进来，编译报错时无法判断是 CMake 配置问题还是代码迁移问题。先用占位文件验证构建链路，之后每个 Step 只加少量文件，错误定位范围就很小。

### 2. `CMAKE_POSITION_INDEPENDENT_CODE ON` 为什么必须

Core 是静态库，但最终会被链接进动态库（Android 的 `.so`）或可执行文件（iOS app）。

```text
不开 PIC：
    静态库里的代码假设自己在固定地址运行
    链接进 .so 时报错：
    relocation R_X86_64_32 against `.rodata' can not be used
    when making a shared object; recompile with -fPIC

开 PIC：
    代码用相对寻址，可以加载到任意地址
```

Android 从 API 21 开始强制要求所有 native 库支持 PIE/PIC，这个选项不是可选的。

### 3. 编译 QuickJS 要多久，能加速吗

单核约 60 秒，`quickjs.c` 是 5 万行的单文件，无法并行拆分。

加速方式：

```bash
# 1. 用 ninja 代替 make（增量构建更快）
cmake -B build -G Ninja

# 2. 开 ccache（第二次编译秒过）
cmake -B build -DCMAKE_C_COMPILER_LAUNCHER=ccache

# 3. Release 构建反而更慢（优化耗时），开发时用 Debug
cmake -B build -DCMAKE_BUILD_TYPE=Debug
```

QuickJS 编译一次后不会改动，增量构建时 CMake 会跳过它。日常开发只编译 Core 自己的文件，几秒完成。

### 4. `libquickapp-core.a` 里为什么没有 QuickJS 的代码

静态库不做链接，只是 `.o` 文件的归档。`target_link_libraries(quickapp-core PRIVATE quickjs)` 记录的是依赖关系，不会把 `libquickjs.a` 的内容合并进 `libquickapp-core.a`。

```text
libquickapp-core.a  = Core 自己的 .o
libquickjs.a        = QuickJS 的 .o
两者在最终链接可执行文件/动态库时才合并
```

所以平台工程链接时两个库都要在链接列表里。CMake 通过 target 依赖自动处理，手写 Makefile 时要注意。

如果确实需要一个合并的库（比如发布给第三方），要用 `libtool -static` 或自定义 CMake 命令合并。

### 5. Android 交叉编译时这份 CMake 能直接用吗

能。Android NDK 的工具链文件会设置好交叉编译环境：

```bash
cmake -B build-android \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a \
  -DANDROID_PLATFORM=android-24 \
  -DQUICKAPP_CORE_BUILD_TESTS=OFF
```

`find_package(ZLIB)` 会找到 NDK 里的 zlib，`find_package(Threads)` 找到 NDK 的 pthread。这就是 Step 11 中 Android 集成的基础。

实际集成时不需要手动跑这个命令，Android 工程通过 `add_subdirectory` 引入，Gradle 会自动传递工具链参数。

### 6. tests/ 目录被平台集成时会不会拖慢构建

不会。这个条件保证了它只在独立编译时生效：

```cmake
if(QUICKAPP_CORE_BUILD_TESTS AND CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
```

Android 工程 `add_subdirectory` 时 `CMAKE_SOURCE_DIR` 指向 Android 的 cpp 目录，条件不成立，`tests/` 整个被跳过。

平台工程也可以显式关闭：`-DQUICKAPP_CORE_BUILD_TESTS=OFF`。

### 7. Step 02 完成后得到了什么

一个能编译、能测试、能验证平台无关性的项目骨架：

```text
✓ cmake -B build && cmake --build build 成功
✓ libquickapp-core.a + libquickjs.a 产出
✓ ctest 通过
✓ nm 检查确认无 Android/JNI/ObjC 符号
✓ QuickJS 抽象边界通过 PRIVATE include 保护
✓ 后续 Step 只需往 add_library 里加源文件
```

从 Step 04 开始，每次迁移代码后都能立刻用 `cmake --build build && ctest` 验证，不需要等到装进手机才知道对不对。

---

## 下一步

按 `tasks.md` 进入 Step 03：实现 `qa_log.h` 日志抽象层，切断 Core 对 `__android_log_print` 的依赖。
