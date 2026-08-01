# Step 8：页面 Bundle 加载与启动

## 目录

- [目标](#目标)
- [Step 8.1：Runtime 启动完整序列](#step-81runtime-启动完整序列)
- [Step 8.2：app.js 执行](#step-82appjs-执行)
- [Step 8.3：页面 Bundle 加载与 eval](#step-83页面-bundle-加载与-eval)
- [Step 8.4：验证](#step-84验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**按 Manifest 入口加载并执行真实 RPK 中的 JS bundle，完成首页启动。**

| 层 | 职责 | 文件 |
|---|---|---|
| Runtime Bootstrap | 串联完整启动序列 | `core/src/runtime_bootstrap.cpp` |
| PageLoader | 路径映射 + eval bundle | 同上 |

**验收标准：**
- `com.example.case1.debug.1.0.0.rpk` 中的 app.js eval 成功
- `pages/Demo/index.js` eval 成功
- `$app_define$` + `$app_bootstrap$` 被调用
- framework.js 创建 VM，onInit 执行
- `__native_render__` 被调用，传入 resolved template + style

**本步不包含：**
- C++ VNode 树构建（Step 9）
- Yoga 布局（Step 10）
- 完整 View 渲染（Step 11）

---

## Step 8.1：Runtime 启动完整序列

@add `app/src/main/cpp/core/src/runtime_bootstrap.cpp`（新建文件）

```cpp
#include "js_engine.h"
#include "js_bridge.h"
#include "rpk_loader.h"
#include "manifest_parser.h"
#include "module_registry.h"
#include <android/log.h>
#include <string>

#define LOG_TAG "quickapp-boot"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace quickapp {

// 前置声明
std::unique_ptr<NativeModule> createRouterModule();
std::unique_ptr<NativeModule> createPromptModule();

/**
 * Runtime 完整启动序列。
 *
 * 调用方：RuntimeThread 的初始化任务。
 * 前提：RPKLoader 已 open，Manifest 已解析。
 *
 * 执行顺序：
 * 1. 注册 NativeModule（类 TurboModule）
 * 2. 安装 JS Bridge（注入全局函数）
 * 3. eval framework.js
 * 4. eval app.js
 * 5. eval 入口页面 bundle
 */
bool bootstrapRuntime(JSEngine* engine, RPKLoader* loader, const Manifest& manifest) {
    // 1. 注册所有 NativeModule
    ModuleRegistry registry;
    registry.registerModule(createRouterModule());
    registry.registerModule(createPromptModule());
    // 后续模块在这里注册：createBluetoothModule()、createFetchModule() 等

    // 2. 安装 JS Bridge
    // 需要获取 JSContext —— QuickJSEngine 暴露了 getContext()
    // 这里的类型转换在正式代码中应通过接口方法获取
    installJSBridge(/* engine->getContext() */, &registry);
    LOGI("JS Bridge installed");

    // 3. eval framework.js
    // framework.js 可以放在 RPK 中或作为 Runtime 内置资源
    // 优先从 RPK 中读取（兼容自定义 framework），fallback 到内置
    std::string frameworkJs; // 由调用方提供
    // engine->eval(frameworkJs.c_str(), "framework.js");
    LOGI("framework.js executed");

    // 4. eval app.js
    std::string appJs = loader->readText("app.js");
    if (appJs.empty()) {
        LOGE("app.js not found in RPK");
        return false;
    }
    if (!engine->eval(appJs.c_str(), "app.js")) {
        LOGE("app.js execution failed: %s", engine->getLastError().c_str());
        return false;
    }
    LOGI("app.js executed");

    // 5. eval 入口页面 bundle
    std::string pagePath = manifest.entry + "/index.js";
    std::string pageJs = loader->readText(pagePath.c_str());
    if (pageJs.empty()) {
        LOGE("Page bundle not found: %s", pagePath.c_str());
        return false;
    }
    if (!engine->eval(pageJs.c_str(), pagePath.c_str())) {
        LOGE("Page bundle execution failed: %s", engine->getLastError().c_str());
        return false;
    }
    LOGI("Page bundle executed: %s", pagePath.c_str());

    // 此时 framework.js 的 $app_bootstrap$ 已经：
    // - 创建了 VM
    // - 调用了 onInit
    // - 解析了 template
    // - 调用了 __native_render__
    // C++ 的 native_render 收到了 template + style

    return true;
}

} // namespace quickapp
```

---

## Step 8.2：app.js 执行

app.js 的结构（见 rpk.md）：

```text
eval(app.js)
    → $app_define$("@app-application/app", ...) 注册应用
    → $app_bootstrap$("@app-application/app", ...) 启动应用
    → 应用 onCreate 执行
    → global.manifest 被写入
```

framework.js 中 `$app_bootstrap$` 对 `@app-application` 前缀的组件特殊处理：只调 onCreate，不走 VM 创建和渲染。

---

## Step 8.3：页面 Bundle 加载与 eval

```text
eval(pages/Demo/index.js)
    → webpack bootstrap 执行
    → $app_define$("@app-component/index", ...) 注册组件
    → $app_bootstrap$("@app-component/index", ...) 启动组件
    → framework.js 的 $app_bootstrap$ 流程：
        1. createVM(comp) → 合并 private + methods
        2. onInit.call(vm) → "this.$page.setTitleBar(...)"
        3. resolveTemplate(template, vm) → 函数属性求值
        4. __native_render__(resolvedTemplate, style) → C++ 收到
```

---

## Step 8.4：验证

**Logcat 预期（完整启动链路）：**

```text
I/quickapp-boot: JS Bridge installed
I/quickapp-js: [console] [framework] framework.js loaded
I/quickapp-boot: framework.js executed
I/quickapp-boot: app.js executed
I/quickapp-js: [console] [framework] $app_define$: @app-application/app
I/quickapp-js: [console] [framework] $app_bootstrap$: @app-application/app
I/quickapp-boot: Page bundle executed: pages/Demo/index.js
I/quickapp-js: [console] [framework] $app_define$: @app-component/index
I/quickapp-js: [console] [framework] $app_bootstrap$: @app-component/index
I/quickapp-js: [console] onInit called, title=欢迎体验快应用开发
I/quickapp-js: [console] [framework] setTitleBar: 欢迎体验快应用开发
I/quickapp-bridge: __native_render__ called
```

---

## 技术决策

### 1. 启动顺序严格：Bridge → framework → app → page

任何一步失败都终止。app.js 依赖 framework.js 注入的全局函数，page bundle 依赖 app.js 初始化的全局状态。

### 2. Debug/Release bundle 统一处理

Runtime 对两种 bundle 的处理完全相同：eval 整个文件，等 `$app_define$` + `$app_bootstrap$` 被调用。不依赖变量名、webpack 路径或 source map。

### 3. 错误传播

每次 eval 后检查 `engine->hasError()`。JS 异常不能静默吞掉——必须 log 完整错误信息和堆栈（debug 模式下）。

---

## QA

### 1. page bundle 中的 $app_require$ 是哪个？

bundle 中 `var _system = $app_require$("@app-module/system.router")` 调用的是 C++ 注入的 `native_app_require`。它从 ModuleRegistry 查找模块并返回 JS 对象。

### 2. framework.js 从哪里来？

两种方式：
1. 内置在 Runtime 中（编译为 C++ 字符串或放在 assets/）
2. 从 RPK 中读取（如果 RPK 包含自定义 framework）

V1 用方式 1（内置），保证 Runtime 和 framework 版本一致。

---

## 下一步

Step 8 完成后得到：真实 RPK 的 JS 执行链路跑通。`__native_render__` 收到了 resolved template 和 style。下一步 Step 9 在 C++ 中解析这个 template 构建 VNode 树。
