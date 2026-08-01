# QuickApp Kit — 草稿笔记

## 目录

- [定位与能力模型](#定位与能力模型)
- [项目全景](#项目全景)
- [核心产物与验收](#核心产物与验收)
- [三端 Runtime 对照表](#三端-runtime-对照表)
- [Runtime Contract 协议层级](#runtime-contract-协议层级)
- [RPK 产物协议（编译后）](#rpk-产物协议编译后)
- [Runtime ABI 与执行语义](#runtime-abi-与执行语义)
- [第一阶段支持范围](#第一阶段支持范围)
- [实施分层与优先级](#实施分层与优先级)
- [Step 文档方式](#step-文档方式)
- [时间分配建议](#时间分配建议)
- [不做的事项](#不做的事项)
- [3-1 能力映射](#3-1-能力映射)
- [Clean Room 原则](#clean-room-原则)
- [三层 Runtime 架构（确认版）](#三层-runtime-架构确认版)
- [JS Framework 设计](#js-framework-设计)
- [开发顺序修正：Android NDK 先行](#开发顺序修正android-ndk-先行)
- [项目目录结构（修正版）](#项目目录结构修正版)
- [iOS 引擎选型：统一用 QuickJS](#ios-引擎选型统一用-quickjs)
- [引擎抽象层设计](#引擎抽象层设计)
- [Lynx / RN 参考策略](#lynx--rn-参考策略)
- [C++ 学习协作模式](#c-学习协作模式)
- [LVGL + ESP32 开发环境](#lvgl--esp32-开发环境)

---

## 定位与能力模型

交付给字节的价值主张（三层）：

1. **双端三层大前端技术底座** — 从标准到运行时的全栈平台视角
2. **核心部件（开源、可运行、可演示）** — 三套不同平台的快应用 Runtime + 构建编译工具 CLI
3. **体系化解决方案** — 标准设计 → 工具链 → 容器 → 生态，完整闭环

目标职级：**3-1**，不给不去。

---

## 项目全景

```text
quickapp-kit/
├── quickapp-examples/          ← 联盟标准快应用示例（输入）
│   └── quickapp-code-test1/
│       ├── src/                ← .ux + manifest + system API
│       └── dist/               ← 联盟工具链编译产物 RPK
│           └── com.example.case1.debug.1.0.0.rpk
│
├── quickapp-kit-android/       ← Android Runtime（消费 RPK）
├── quickapp-kit-cpp/           ← C++ / LVGL Runtime（消费 RPK）
├── quickapp-kit-ios/           ← iOS Runtime（消费 RPK）
├── quickapp-toolkit/           ← 自研 CLI 编译打包（后期）
└── docs/                       ← 设计文档
```

数据流向：

```text
.ux 源码 → 联盟工具链（现有 hap build）→ RPK
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                             ▼
     Android Runtime              C++ / LVGL Runtime              iOS Runtime
     (Kotlin/Java)                    (C++)                     (Swift/ObjC)
     Android View                  LVGL Object                    UIKit
```

后期自研 CLI 替换"联盟工具链"部分：

```text
.ux 源码 → quickapp-toolkit（自研 CLI）→ RPK → 三端 Runtime
```

---

## 核心产物与验收

三个 Runtime 使用同一输入：

```
quickapp-examples/quickapp-code-test1/dist/com.example.case1.debug.1.0.0.rpk
```

统一验收流程：

1. 加载并解压 RPK
2. 解析 `manifest.json`
3. 找到入口 `pages/Demo`
4. 执行 `app.js`（应用级 JS）
5. 执行页面 `pages/Demo/index.js`
6. 渲染 `div`、`text`、`input`
7. 显示动态绑定的 `title`
8. 处理 Flex 布局和基本样式
9. 点击按钮触发 JS `onDetailBtnClick`
10. 通过 `system.router.push` 进入详情页
11. 通过 `system.prompt.showToast` 调用原生 Toast
12. 正确执行基础页面生命周期

同一个 RPK 在三端运行并录制对比视频 = 最终演示结果。

---

## 三端 Runtime 对照表

| 层 | Android | C++ / LVGL | iOS |
|---|---|---|---|
| 语言 | Kotlin / Java | C++ | Swift / Objective-C |
| JS Engine | QuickJS（统一）| QuickJS | QuickJS（统一）|
| View | Android View | LVGL Object | UIKit |
| Layout | Yoga | Yoga → LVGL 坐标 | Yoga |
| Router | Activity 或自建页面栈 | 自建页面栈 | UIViewController / 自建页面栈 |
| System API | Android Service / API | C++ Platform Adapter | iOS Framework |
| 资源访问 | AssetManager / FileIO | POSIX FileIO | Bundle / FileManager |

三端共享的是协议、行为、测试输入和验收标准。

---

## Runtime Contract 协议层级

三个 Runtime 必须共享一份协议定义：

```text
Runtime Contract
├── RPK Package Contract        ← ZIP 结构、META-INF、manifest 位置
├── Manifest Model              ← 字段定义、router、display、features
├── Module Naming Convention    ← @app-module/system.* → 对应的实现
├── Application Lifecycle       ← onCreate / onDestroy
├── Page Lifecycle              ← onInit / onReady / onShow / onHide / onDestroy
├── Component Model             ← $app_define$ / $app_bootstrap$ / $app_require$
├── Template Node Model         ← type / attr / children / classList / events
├── Style Model                 ← 选择器规则 / _meta / ruleDef
├── Event Model                 ← 原生事件 → JS 回调
├── System Module Contract      ← router / prompt / fetch / shortcut
├── Error Model                 ← 异常边界与降级
└── Compatibility Matrix        ← 支持范围声明
```

---

## RPK 产物协议（编译后）

Runtime 直接读取的内容：

```text
RPK (ZIP)
├── META-INF/
│   ├── CERT           ← 签名（可选校验）
│   └── build.txt      ← 构建元信息
├── manifest.json      ← 应用描述、路由、display、features
├── sitemap.json       ← SEO（Runtime 可忽略）
├── app.js             ← 应用级 bundle
├── pages/
│   ├── Demo/index.js        ← 页面 bundle
│   └── DemoDetail/index.js  ← 页面 bundle
├── CardDemo/index.js        ← Widget（第一阶段可忽略）
└── assets/
    └── images/logo.png
```

详细结构见 [rpk.md](./rpk.md)。

---

## Runtime ABI 与执行语义

运行时真正需要实现的宿主 API：

| API | 职责 |
|---|---|
| `$app_define$(name, deps, factory)` | 注册应用/页面/组件 |
| `$app_bootstrap$(name, options)` | 启动已注册的组件 |
| `$app_require$(module)` | 加载系统模块（`@app-module/system.*`） |
| `global.manifest` | app.js 写入的全局 manifest 引用 |
| `this.$page.setTitleBar(opts)` | 设置当前页面标题栏 |
| `this.$page.setMeta(opts)` | 设置页面 SEO 元信息 |
| `system.router.push({uri})` | 页面路由跳转 |
| `system.prompt.showToast({message})` | 原生 Toast |

---

## 第一阶段支持范围

| 类型 | 支持内容 |
|---|---|
| Component | `div`、`text`、`input` |
| Layout | Flex direction、justify、align、width、height、margin、padding |
| Style | color、backgroundColor、fontSize、borderRadius、textAlign |
| Binding | 文本插值、属性读取（function 绑定） |
| Event | click |
| Lifecycle | `onCreate`、`onInit`、`onShow`、`onDestroy` |
| System API | `system.router`（push）、`system.prompt`（showToast） |
| Page API | `$page.setTitleBar`、`$page.setMeta`（stub） |
| Resource | RPK 内图片和文件寻址 |

---

## 实施分层与优先级

| 优先级 | 项目 | 深度要求 |
|---|---|---|
| P0 | C++ Core + Android Runtime | 完整纵向链路，首发开发平台 |
| P0 | LVGL Runtime | 完整核心链路，证明嵌入式能力 |
| P1 | iOS Runtime | 验证架构可移植性，最小闭环即可 |
| P2 | CLI / Toolkit | 三端稳定后再做 |
| P3 | IDE | 最后考虑 |

Phase 划分：

```text
Phase 1：C++ Core 基础 + Android 首发
  01 C++ Core 工程骨架（QuickJS + RPK Loader + Manifest）
  02 JS Framework（framework.js）
  03 PlatformBridge 接口定义
  04 Android NDK 工程骨架
  05 JNI Bridge
  06 Kotlin View 渲染层
  07 页面启动和渲染
  08 Router + Prompt

Phase 2：LVGL Runtime
  09 LVGL SDL 模拟器工程
  10 LVGL Renderer（实现 PlatformBridge）
  11 样式和布局
  12 事件和交互
  13 ESP32 移植（可选）

Phase 3：iOS Runtime
  14 iOS 工程 + QuickJS 编译
  15 ObjC++ Bridge + Swift UIKit Renderer
  16 完整 Demo

Phase 4：工程化
  17 三端兼容性矩阵
  18 性能指标与稳定性
  19 文档、演示视频
```

---

## Step 文档方式

继续采用 LiteCard Flutter 的协作模式：

1. Kiro 一次只出一个 Step 文档
2. 文档包含：背景、目标、原理、架构决策、操作顺序
3. 代码中用 `@add`、`@update` 标记变化
4. 用户手动实现代码
5. 完成后告知 Kiro，再出下一个 Step
6. 不直接修改源码，除非明确要求

文档目录规划：

```text
BBQ/docs/interview/BT/proj/quickapp-kit/
├── drft-note.md              ← 本文件（草稿笔记）
├── rpk.md                    ← RPK 产物分析
├── requirements.md           ← 需求文档（待创建）
├── tech-design.md            ← 技术设计（待创建）
├── tasks.md                  ← 任务分解（待创建）
└── steps/
    └── step-index.md         ← 实施索引（待创建）
```

代码目录规划：

```text
/Users/qiaoyang/code/my-github/quickapp-kit/
├── core/                     ← C++ Core（三端共享）
├── quickapp-kit-android/     ← Android Runtime
├── quickapp-kit-lvgl/        ← LVGL Runtime
├── quickapp-kit-ios/         ← iOS Runtime
├── quickapp-examples/        ← 已有
└── quickapp-toolkit/         ← 自研 CLI（后期）
```

---

## 时间分配建议

| 周 | 重点 |
|---|---|
| 第 1 周 | C++ Core 基础 + Android 纵向闭环（RPK → 渲染 → 交互） |
| 第 2～3 周 | LVGL Runtime 完整核心链路（最大投入） |
| 第 4 周 | iOS 最小闭环 + 三端对比视频 + 文档整理 |

---

## 不做的事项

第一阶段明确排除：

- 自研 `.ux` 编译器（后期做）
- 自研 RPK 打包与签名（后期做）
- 完整 IDE
- 全部联盟组件（只做 div/text/input）
- 完整 CSS 选择器
- 全部 system API（只做 router/prompt）
- Widget/Card 运行模型
- 完整权限与安全沙箱
- 热更新和调试协议
- 联盟规范 100% 兼容

但不能针对 Demo 硬编码，应实现通用但范围有限的子集。

---

## 3-1 能力映射

这个项目体现 3-1 能力的维度：

| 3-1 能力要求 | 项目中的体现 |
|---|---|
| 独立定义应用平台边界 | Runtime Contract、系统边界设计 |
| 从编译产物反推 Runtime 契约 | RPK 分析 → ABI 定义 |
| 设计跨端统一模型 | 三端共享协议，各自实现 |
| 在 Android 和嵌入式 C++ 两类系统落地 | 双端完整跑通 |
| 处理架构取舍、兼容性与演进 | 兼容范围声明、版本策略 |
| 可运行结果与测试矩阵 | 同一 RPK 三端运行视频 |
| 把系统能力抽象成稳定的开放接口 | System Module 设计 |
| 生态建设视角 | 标准 → 工具链 → 容器 → 生态 全链路规划 |
| 跨团队推动 | 协议先行、契约驱动、兼容矩阵 |

---

## Clean Room 原则

公开实现时必须坚持：

- 只依据公开的快应用联盟规范
- 只依据公开工具链行为和自己的实验产物
- 不复制任何公司内部源码、私有文档或未公开接口
- 项目可安全公开在 GitHub
- 体现独立架构能力而非逆向工程

---

## 三层 Runtime 架构（确认版）

```text
┌──────────────────────────────────────────────┐
│  JS Runtime 层（三端共用 .js 文件）            │
│  core/js/framework.js                         │
│  - $app_define$ / $app_bootstrap$ 实现        │
│  - VM 模型（data 初始化、method 绑定）         │
│  - 生命周期调度                               │
│  - 模板表达式求值                             │
│  - JS ↔ Native 桥接协议                      │
│                                              │
│  运行在 QuickJS 引擎内，在 app.js 之前加载     │
└──────────────────┬───────────────────────────┘
                   │ QuickJS C API
┌──────────────────┴───────────────────────────┐
│  C++ Native Runtime 层（三端共用 .cpp）        │
│  - QuickJS 引擎管理                           │
│  - 向 JS 注入全局函数和 Native Module          │
│  - RPK ZIP 加载与资源寻址                     │
│  - Manifest 解析                             │
│  - VNode Tree 管理                           │
│  - Yoga 布局计算                             │
│  - 样式解析与匹配                            │
│  - 事件路由（平台事件 → JS 回调）             │
│  - Router / System API 分发                  │
│  - 渲染指令生成（通过 PlatformBridge 回调）    │
└──────────────────┬───────────────────────────┘
                   │ PlatformBridge 回调接口
┌──────────┬───────┴───────┬───────────────────┐
│ Android  │    LVGL       │      iOS          │
│ JNI +    │    C++        │  ObjC++ Bridge +  │
│ Kotlin   │  LVGL Object  │    Swift          │
│ View渲染 │   Renderer    │  UIKit Renderer   │
│ Native   │  Platform     │    Native         │
│ API 实现 │  API 实现     │    API 实现       │
└──────────┴───────────────┴───────────────────┘
```

### 三部分共享关系

| 层 | 语言 | 三端共享 | 职责 |
|---|---|---|---|
| JS Runtime | JavaScript | ✅ 完全共享 | VM 模型、组件注册、生命周期、表达式求值 |
| C++ Native Runtime | C++ | ✅ 完全共享 | 引擎管理、RPK、布局、样式、事件路由 |
| Platform Layer | Kotlin/C++/Swift | ❌ 各端独立 | View 渲染、Native API、事件采集 |

---

## JS Framework 设计

**推荐：单独一个 JS 文件，不碎片化。**

```text
core/js/framework.js  ← 单个文件，~300-500 行
```

包含：
- `$app_define$` / `$app_bootstrap$` / `$app_require$` 的 JS 侧实现
- VM 模型（data 初始化、method 绑定）
- 生命周期调度
- 模板表达式求值辅助

**不推荐 C++ 直接注入大量 JS 代码片段**，原因：
1. 代码分散在 C++ 字符串里，难以维护和调试
2. 无法在 JS 引擎里单独测试
3. 换引擎时 C++ 代码全要改

**推荐做法：**
1. `framework.js` 作为独立文件，放在 `core/js/` 目录
2. C++ 初始化引擎时，`eval` 这个文件
3. 之后 app.js / page index.js 执行时，`$app_define$` 等函数已经存在

边界清晰：
- **JS 负责的**：VM 模型、组件注册逻辑、生命周期调度
- **C++ 负责的**：引擎管理、桥接注入、布局计算、渲染指令

---

## 开发顺序修正：Android NDK 先行

不在命令行环境裸写 C++，而是直接在 Android NDK 环境里开发 C++ Core：

```text
Phase 1: Android 作为 C++ Core 的首发开发宿主
  - Android Studio + NDK + CMake
  - C++ Core 在 NDK 环境编译和调试
  - JNI 薄桥传递渲染指令
  - Kotlin 层只做 View 创建和 Native API
  → Android 模拟器/真机直接看到效果

Phase 2: LVGL 验证嵌入式
  - 同一份 core/ 代码
  - 新增 LVGL Renderer 实现 PlatformBridge
  - SDL 模拟器 或开发板
  → 证明嵌入式能力

Phase 3: iOS 验证可移植
  - 同一份 core/ 编译为 .a / .framework
  - ObjC++ Bridge + Swift UIKit Renderer
  → iOS 模拟器看效果
```

### 为什么 Android 先行更好

1. **可视反馈快** — 写完核心逻辑马上在模拟器上看到渲染
2. **工具链成熟** — Android Studio + NDK 调试比裸 GDB 友好得多
3. **倒逼接口设计** — 从第一天就定义 PlatformBridge
4. **演示价值** — 手机截图/视频比命令行输出有说服力

---

## 项目目录结构（修正版）

```text
quickapp-kit/
├── core/                       ← C++ Core（三端共享，核心代码都在这里）
│   ├── CMakeLists.txt
│   ├── include/
│   │   ├── engine.h
│   │   ├── rpk_loader.h
│   │   ├── manifest.h
│   │   ├── js_runtime.h
│   │   ├── vm_model.h
│   │   ├── vnode.h
│   │   ├── style_resolver.h
│   │   ├── layout.h
│   │   ├── event.h
│   │   ├── router.h
│   │   ├── platform_bridge.h   ← 平台回调接口定义
│   │   └── js_engine.h         ← 引擎抽象接口
│   ├── src/
│   │   └── ...实现文件
│   ├── js/
│   │   └── framework.js        ← JS Runtime（三端共用）
│   └── third_party/
│       ├── quickjs/
│       └── yoga/
│
├── quickapp-kit-android/       ← Android 宿主（首发开发平台）
│   ├── app/
│   │   ├── src/main/cpp/       ← JNI bridge（引用 ../../core）
│   │   └── src/main/kotlin/    ← Kotlin View 渲染 + Platform API
│   └── CMakeLists.txt
│
├── quickapp-kit-lvgl/          ← LVGL 宿主
│   ├── src/
│   │   ├── main.cpp            ← SDL 入口
│   │   └── lvgl_renderer.cpp   ← 实现 PlatformBridge
│   └── CMakeLists.txt
│
├── quickapp-kit-ios/           ← iOS 宿主
│   ├── QuickAppKit/
│   │   ├── Bridge.mm           ← ObjC++ 桥
│   │   └── Renderer.swift      ← UIKit 渲染
│   └── QuickAppKit.xcodeproj
│
├── quickapp-examples/          ← 联盟标准示例（已有）
└── quickapp-toolkit/           ← 自研 CLI（后期）
```

---

## iOS 引擎选型：统一用 QuickJS

| 选项 | 做法 | 结论 |
|---|---|---|
| JavaScriptCore | iOS 系统自带，Swift 可直接调 | ❌ 不选 — Core 的 JS Bridge 基于 QuickJS C API，换引擎要重写 |
| QuickJS（跟 Core 一起编译） | 和 Android/LVGL 完全一致 | ✅ 选这个 — 三端引擎行为完全一致，C++ Core 无需条件编译 |

三端统一用 QuickJS：
- 一份 JS Runtime，一份 C++ Core，三端行为保证一致
- QuickJS 是纯 C，Xcode 可以直接编译，不违反 Apple 审核规则
- 面试叙事更强："一个引擎驱动三端"

---

## 引擎抽象层设计

**架构决策：统一 QuickJS，但预留抽象接口。**

### 接口定义

```cpp
// core/include/js_engine.h

class JSEngine {
public:
    virtual ~JSEngine() = default;
    
    // 生命周期
    virtual bool initialize() = 0;
    virtual void destroy() = 0;
    
    // 脚本执行
    virtual JSValue eval(const char* script, const char* filename = nullptr) = 0;
    virtual JSValue evalFile(const char* path) = 0;
    
    // 全局对象操作
    virtual void setGlobal(const char* name, JSValue value) = 0;
    virtual JSValue getGlobal(const char* name) = 0;
    
    // 函数调用
    virtual JSValue call(JSValue func, JSValue thisObj, JSValue* args, int argc) = 0;
    
    // Native 函数注入
    virtual void registerFunction(const char* name, JSNativeFn fn, void* userdata = nullptr) = 0;
    
    // 模块注册
    virtual void registerModule(const char* name, JSModuleDef* module) = 0;
    
    // 错误处理
    virtual bool hasError() const = 0;
    virtual std::string getLastError() const = 0;
    virtual void clearError() = 0;
};

// QuickJS 实现
class QuickJSEngine : public JSEngine {
    JSRuntime* rt_;
    JSContext* ctx_;
    std::string lastError_;
    
public:
    bool initialize() override;
    void destroy() override;
    // ... 其他方法实现
};
```

### 编译时选择引擎

```cmake
# core/CMakeLists.txt

option(USE_QUICKJS "Use QuickJS engine" ON)
option(USE_V8 "Use V8 engine" OFF)

if(USE_QUICKJS)
    add_definitions(-DJS_ENGINE_QUICKJS)
    add_subdirectory(third_party/quickjs)
    set(JS_ENGINE_LIB quickjs)
elseif(USE_V8)
    add_definitions(-DJS_ENGINE_V8)
    # add_subdirectory(third_party/v8)
    # set(JS_ENGINE_LIB v8)
endif()

# 条件编译工厂
# src/js_engine_factory.cpp
# std::unique_ptr<JSEngine> createJSEngine() {
#     #ifdef JS_ENGINE_QUICKJS
#         return std::make_unique<QuickJSEngine>();
#     #elif defined(JS_ENGINE_V8)
#         return std::make_unique<V8Engine>();
#     #endif
# }
```

### 面试叙事

> "我设计了 JSEngine 抽象接口。第一阶段三端统一 QuickJS，保证行为一致和代码共享。架构上支持切换引擎，生产环境中 Android 可以换 V8 获得 JIT 性能，嵌入式保持 QuickJS 控制内存。引擎切换只需实现接口，不影响上层 VM、布局和渲染逻辑。"

---

## Lynx / RN 参考策略

### RN 新架构（重点参考）

| 模块 | RN 做法 | 我们借鉴什么 |
|---|---|---|
| JS → Native 通信 | JSI（C++ 直调） | QuickJS C API 直调，同思路 |
| Shadow Tree | Fabric C++ 层维护 | 我们的 VNode Tree 在 C++ 层 |
| 布局 | Yoga（C++ 直接调用） | 我们也直接在 C++ 调 Yoga |
| Native Module | TurboModules（C++ 接口定义） | 我们的 System API 通过 PlatformBridge |
| 平台渲染 | ComponentDescriptor → View | 我们的 PlatformBridge → View |

### Lynx（辅助参考）

| 参考内容 | 深度 | 原因 |
|---|---|---|
| PlatformBridge / RenderObjectImpl 接口 | 详细看 | 和我们需求最接近 |
| 线程模型（UI/JS/Layout 分离） | 了解思路 | 第一阶段单线程，知道演进方向 |
| Element Tree 设计 | 了解结构 | 对应我们的 VNode |
| JS Binding 代码生成 | 知道有这个 | 后续自动化 |

### 参考原则

- 借鉴设计思路，不复制代码
- 面试时说"研究了 RN Fabric 和 Lynx 的架构，从中借鉴了 XX"
- 不说"模仿"或"参考实现"
- 我们的差异点：**不是通用渲染引擎，而是完整的应用 Runtime**（包含应用模型、生命周期、权限、路由、系统能力）

---

## C++ 学习协作模式

针对 C++ 部分，协作方式调整为：

1. Step 文档中直接给出完整可编译的 C++ 代码
2. 编写 + 理解 + 编译运行
3. 遇到编译错误、段错误、调试问题随时问我
4. 我在代码中标注 C++ 关键概念（指针、智能指针、内存、模板等）
5. 每个 Step 都能编译运行并看到明确输出

与 LiteCard Flutter 的区别：
- Flutter/Dart 你已经熟悉，Step 更偏"做什么"
- C++ 你在学习中，Step 会更偏"为什么这么写"和"常见错误预防"

---

## LVGL + ESP32 开发环境

### LVGL SDL 模拟器

LVGL 提供完整交互能力的 SDL 模拟器：

- 不是静态截图，是完整的事件循环程序
- 支持鼠标点击、拖拽、滚动（映射为触摸事件）
- macOS 上 `brew install sdl2` 即可编译运行
- 开发体验：改代码 → 编译 → 运行 → SDL 窗口看到效果

### ESP32-S3 真硬件

推荐购买：**ESP32-S3 + 2.4寸 TFT 触摸屏**（~50元）

要求：
- **带 PSRAM**（至少 8MB）— QuickJS 内存需求
- **带触摸**— 能演示点击交互
- **屏幕 240×320 以上**

开发流程：

```text
Week 1-3: macOS SDL 模拟器开发（快速迭代）
  ↓ 代码跑通、功能验证
Week 4: 移植到 ESP32-S3
  ↓ 只改显示驱动和触摸驱动
  ↓ 通过 ESP-IDF 编译烧录
  ↓ 录制真机演示视频
```

ESP32 自带 FreeRTOS — 不需要额外寻找 RTOS。
