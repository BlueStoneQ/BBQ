# Step 2：集成第三方依赖

## 目录

- [目标](#目标)
- [相对 Step 1 的变化](#相对-step-1-的变化)
- [Step 2.1：放置第三方源码](#step-21放置第三方源码)
- [Step 2.2：为 QuickJS 写 CMakeLists](#step-22为-quickjs-写-cmakelists)
- [Step 2.3：接入 libuv（自带 CMake）](#step-23接入-libuv自带-cmake)
- [Step 2.4：为 Yoga 写 CMakeLists](#step-24为-yoga-写-cmakelists)
- [Step 2.5：为 minizip 和 cJSON 写 CMake 目标](#step-25为-minizip-和-cjson-写-cmake-目标)
- [Step 2.6：修改顶层 CMakeLists.txt](#step-26修改顶层-cmakeliststxt)
- [Step 2.7：验证链接可用性](#step-27验证链接可用性)
- [技术决策](#技术决策)
- [核心概念](#核心概念)
  - [静态库的链接顺序问题](#概念静态库的链接顺序问题)
  - [PUBLIC / PRIVATE / INTERFACE 传递性](#概念publicprivateinterface-传递性)
  - [交叉编译与 CMake Toolchain](#概念交叉编译与-cmake-toolchain)
- [QA](#qa)

---

## 目标

**把 5 个第三方依赖编译成静态库，并让 `libquickapp-core.a` 能成功链接它们。**

| 依赖 | 语言 | 作用 | 引入方式 |
|---|---|---|---|
| QuickJS | C | JS 引擎 | 自写 CMakeLists |
| libuv | C | 事件循环 / Timer / 跨线程唤醒 | 自带 CMakeLists |
| Yoga | C++ | Flexbox 布局计算 | 自写 CMakeLists |
| minizip | C | RPK（ZIP）解压 | 顶层直接 add_library |
| cJSON | C | manifest.json 解析 | 顶层直接 add_library |

**验收标准：**
- `cmake --build build` 全部成功，无编译/链接错误
- 生成 `libquickjs.a`、`libuv_a.a`、`libyogacore.a`、`libminizip.a`、`libcjson.a`
- 一个临时测试程序能调用 `JS_NewRuntime()` 和 `uv_loop_init()` 并成功链接

**本步不包含：**
- 任何 Core 业务代码（JSEngine / EventLoop 封装留到 Step 4、5）
- Android NDK / iOS 交叉编译验证（留到 Phase 4）

---

## 相对 Step 1 的变化

Step 1 的 `CMakeLists.txt` 只有一个 `add_library(quickapp-core STATIC src/quickapp_core.cpp)`。

本步做三件事：

```text
1. third_party/ 目录从空 → 放入 5 份源码
2. 新增 3 个子目录 CMakeLists.txt（quickjs / yoga，libuv 用自带的）
3. 顶层 CMakeLists.txt 新增：
   - add_subdirectory × 3
   - add_library × 2（minizip / cjson）
   - target_link_libraries(quickapp-core PRIVATE ...)
```

`src/quickapp_core.cpp` 和 `include/quickapp_core.h` **本步不改动**。

---

## Step 2.1：放置第三方源码

### 目录结构（本步结束后）

```text
third_party/
├── quickjs/
│   ├── CMakeLists.txt      ← @add 本步新建
│   ├── quickjs.c
│   ├── quickjs.h
│   ├── quickjs-atom.h
│   ├── quickjs-libc.c
│   ├── quickjs-libc.h
│   ├── cutils.c
│   ├── cutils.h
│   ├── libbf.c
│   ├── libbf.h
│   ├── libregexp.c
│   ├── libregexp.h
│   ├── libregexp-opcode.h
│   ├── libunicode.c
│   ├── libunicode.h
│   ├── libunicode-table.h
│   └── list.h
├── libuv/                  ← 完整 release 解压，自带 CMakeLists.txt
├── yoga/
│   ├── CMakeLists.txt      ← @add 本步新建
│   └── yoga/               ← Yoga 源码（*.cpp / *.h）
├── minizip/
│   ├── unzip.c
│   ├── unzip.h
│   ├── ioapi.c
│   ├── ioapi.h
│   ├── ioapi_mem.c         ← 内存 IO：从 buffer 读 ZIP，不落磁盘
│   └── ioapi_mem.h
└── cjson/
    ├── cJSON.c
    └── cJSON.h
```

### 下载来源

```bash
# QuickJS（选一个稳定 release）
curl -O https://bellard.org/quickjs/quickjs-2024-01-13.tar.xz
tar xf quickjs-2024-01-13.tar.xz
# 只保留上面列出的文件，其余（qjs.c、qjsc.c、Makefile、examples/、tests/）删掉

# libuv
curl -L -o libuv.tar.gz https://github.com/libuv/libuv/archive/refs/tags/v1.48.0.tar.gz
tar xf libuv.tar.gz && mv libuv-1.48.0 third_party/libuv

# Yoga（只需要 yoga/ 子目录的源码）
curl -L -o yoga.tar.gz https://github.com/facebook/yoga/archive/refs/tags/v2.0.1.tar.gz
tar xf yoga.tar.gz && mv yoga-2.0.1/yoga third_party/yoga/yoga

# minizip（在 zlib 源码的 contrib/minizip 中）
# ioapi_mem.c 需要单独找（zlib contrib 中有，或用 minizip-ng）

# cJSON
curl -L -o cjson.tar.gz https://github.com/DaveGamble/cJSON/archive/refs/tags/v1.7.17.tar.gz
# 只取 cJSON.c 和 cJSON.h
```

> **为什么删掉 qjs.c / qjsc.c**：那是 QuickJS 的命令行解释器和编译器入口，包含 `main()` 函数。库里不能有 `main()`，否则链接时符号冲突。
