# Step 7：NativeModule、ModuleRegistry 与 JS Bridge

## 目录

- [目标](#目标)
- [Step 7.1：理解快应用的 JS 调用约定](#step-71理解快应用的-js-调用约定)
- [Step 7.2：设计 NativeModule 基类](#step-72设计-nativemodule-基类)
- [Step 7.3：实现 ModuleRegistry](#step-73实现-moduleregistry)
- [Step 7.4：实现 JS Bridge 注入](#step-74实现-js-bridge-注入)
- [Step 7.5：实现 RouterModule 与 PromptModule](#step-75实现-routermodule-与-promptmodule)
- [Step 7.6：接入 CMake](#step-76接入-cmake)
- [Step 7.7：编写测试](#step-77编写测试)
- [Step 7.8：逐层验证](#step-78逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**让 JS 能调用 C++ 能力，且新增能力不需要修改 Bridge 内核。**

| 层 | 职责 | 文件 |
|---|---|---|
| 模块基类 | 定义模块的名称和方法列表 | `include/native_module.h` |
| 注册表 | 动态注册和按名查找模块 | `include/module_registry.h` + `src/module_registry.cpp` |
| JS Bridge | 注入全局函数，`$app_require$` 分发模块 | `include/js_bridge.h` + `src/js_bridge.cpp` |
| 内置模块 | system.router / system.prompt | `src/router_module.cpp` + `src/prompt_module.cpp` |

**验收标准：**
- `eval` 执行 `$app_require$("@app-module/system.router").push({uri:"/pages/Detail"})` 后 C++ RouterModule 收到调用
- `console.log("x")` 输出到 Core 日志
- 新增一个模块只需写一个类 + 一行注册，不改 `js_bridge.cpp`
- 未注册的模块名返回 `undefined`，不崩溃
- ASan 验证无 JSValue 泄漏

**本步不包含：**
- `$app_define$` / `$app_bootstrap$` 的完整 VM 语义（由 framework.js 实现，Step 10 接线）
- `__native_render__` 的 VNode 构建（Step 09）
- 权限校验（Manifest features 检查，V2）
- Promise 风格的异步 API（V2）

---

## Step 7.1：理解快应用的 JS 调用约定

抽象设计之前必须先看清 RPK 里的 JS 实际长什么样。

### 7.1.1：page bundle 的真实结构

RPK 中 `pages/Demo/index.js` 编译产物的形态：

```javascript
// webpack 打包后的 IIFE，不是 ES Module
(function(global) {
  $app_define$('@app-component/Demo', [], function($app_require$, $app_exports$, $app_module$) {
    // 页面的 VM 定义
    $app_module$.exports = {
      template: {
        type: 'div',
        classList: ['wrapper'],
        children: [
          { type: 'text', attr: { value: function() { return this.title; } } },
          { type: 'input', attr: { type: 'button', value: '跳转' },
            events: { click: 'goDetail' } }
        ]
      },
      style: {
        '.wrapper': { flexDirection: 'column', padding: '20px' }
      },
      private: { title: '欢迎体验快应用开发' },
      onInit() { console.log('page init'); },
      goDetail() {
        // 关键：通过 $app_require$ 拿到系统模块
        var router = $app_require$('@app-module/system.router');
        router.push({ uri: '/pages/DemoDetail' });
      }
    };
  });

  $app_bootstrap$('@app-component/Demo', {});
})(this);
```

### 7.1.2：需要注入的全局函数

从上面的代码可以看出 Runtime 必须提供什么：

| 全局标识 | 调用方 | 职责 | 本步实现 |
|---|---|---|---|
| `$app_define$(name, deps, factory)` | page bundle | 注册组件定义 | framework.js（Step 10） |
| `$app_bootstrap$(name, options)` | page bundle | 启动组件，创建 VM | framework.js（Step 10） |
| `$app_require$(name)` | VM 方法 | 获取系统模块或组件 | **本步（C++）** |
| `console.log/warn/error` | 任意 JS | 日志输出 | **本步（C++）** |
| `__native_render__(template, style)` | framework.js | 通知 C++ 渲染 | 桩函数（Step 09 实现） |
| `setTimeout / clearTimeout` | 任意 JS | 定时器 | **本步（C++，接 EventLoop）** |

`$app_define$` 和 `$app_bootstrap$` 由 framework.js 用纯 JS 实现（它们的逻辑是维护组件表和创建 VM，不需要 native 能力）。C++ 只需要注入真正需要 native 的部分。

### 7.1.3：模块访问的两种命名空间

```text
@app-module/system.router     系统能力，由 C++ NativeModule 提供
@app-component/Demo           页面组件，由 framework.js 的组件表提供
```

`$app_require$` 需要同时处理两者：

```text
以 "@app-module/" 开头 → 查 C++ ModuleRegistry
其他                   → 委托给 framework.js 的组件表
```

V1 的做法是：C++ 的 `$app_require$` 只处理 `@app-module/`，其他情况返回 `undefined`，由 framework.js 内部先查自己的组件表，查不到再调 C++ 版本。具体接线在 Step 10。

---

## Step 7.2：设计 NativeModule 基类

### 7.2.1：目标 — 新增模块零改内核

对比两种设计：

```text
方案 A：if-else 分发（Android 早期版本的做法）
    static JSValue native_app_require(ctx, this_val, argc, argv) {
        const char* name = JS_ToCString(ctx, argv[0]);
        if (strcmp(name, "@app-module/system.router") == 0) { ... }
        else if (strcmp(name, "@app-module/system.prompt") == 0) { ... }
        else if (strcmp(name, "@app-module/system.fetch") == 0) { ... }
        // 每加一个能力就多一个分支
    }
    问题：js_bridge.cpp 随能力数量线性膨胀，成为修改热点

方案 B：Registry 分发（本步实现）
    static JSValue native_app_require(ctx, this_val, argc, argv) {
        NativeModule* mod = ModuleRegistry::instance().find(name);
        if (!mod) return JS_UNDEFINED;
        return mod->createJSObject(ctx);
    }
    新增能力：写一个 NativeModule 子类 + registry.registerModule(...)
    js_bridge.cpp 零改动
```

### 7.2.2：创建 native_module.h

**@add `include/native_module.h`（新建文件）**

```cpp
#ifndef QUICKAPP_NATIVE_MODULE_H
#define QUICKAPP_NATIVE_MODULE_H

#include <vector>

// 【引擎特有依赖】
// MethodDef 需要 QuickJS 的 JSCFunction 签名。
// 这是 V1 有意接受的妥协：为了避免设计一整套中间层函数签名 + 参数转换适配器，
// 直接使用引擎类型。换 JS 引擎时本文件和所有 NativeModule 子类需要适配。
// 记录在 design.md 的 Key Decisions 中。
#include "quickjs.h"

namespace quickapp {

// 模块方法定义。
struct MethodDef {
    // JS 侧的方法名，如 "push"、"showToast"
    const char* name;

    // native 实现。签名固定为 QuickJS 的 JSCFunction：
    //   JSValue (*)(JSContext* ctx, JSValueConst this_val,
    //               int argc, JSValueConst* argv)
    // 实现中通过 JS_GetOpaque(this_val, classId) 取回 C++ 模块实例。
    JSCFunction* func;

    // 方法期望的参数个数。
    // QuickJS 用它设置 Function.length，不做实际校验。
    // 实现内部必须自己检查 argc，JS 可能传任意数量参数。
    int argCount;
};

// 系统能力模块基类。
//
// 职责：
//   描述一个可被 JS 通过 $app_require$ 获取的能力集合。
//   子类提供模块名和方法表，基类负责 JSClass 注册和实例创建。
//
// 设计模式：
//   类似 React Native 的 TurboModule —— 模块自描述，注册表统一分发，
//   新增模块不修改 Bridge 内核。
//
// 线程所有权：
//   实例由 ModuleRegistry 拥有，生命周期与 Runtime 相同。
//   所有方法在 Runtime Thread 被调用。
//
// 生命周期：
//   构造 → registerClass(ctx)（一次）→ createJSObject(ctx)（每次 require）→ 析构
//
// 子类实现要求：
//   1. getName() 返回完整模块名，含 "@app-module/" 前缀
//   2. getMethods() 返回方法表，每次调用应返回相同内容
//   3. native 方法实现中用 JS_GetOpaque(this_val, getClassId()) 取回 this
class NativeModule {
public:
    virtual ~NativeModule() = default;

    /**
     * 返回模块的完整标识。
     *
     * @return 模块名，如 "@app-module/system.router"。
     *         必须与 JS 侧 $app_require$ 的参数完全一致。
     *         指向静态存储，调用方不需要释放。
     */
    virtual const char* getName() const = 0;

    /**
     * 返回模块暴露给 JS 的方法列表。
     *
     * @return 方法定义数组。每次调用应返回相同内容
     *         （registerClass 只在初始化时调用一次，
     *          但测试或调试可能重复调用）。
     */
    virtual std::vector<MethodDef> getMethods() const = 0;

    /**
     * 向 JS 引擎注册本模块对应的 JSClass。
     *
     * 行为：
     *   1. 分配 JSClassID
     *   2. 创建 prototype 对象
     *   3. 把 getMethods() 的每个方法挂到 prototype 上
     *   4. 绑定 prototype 到 JSClassID
     *
     * 只需在 Runtime 初始化时调用一次。方法挂在 prototype 上
     * 而不是每个实例上，多次 $app_require$ 共享同一份函数对象。
     *
     * @param ctx QuickJS 上下文，不能为 nullptr
     * @return true 注册成功；false ctx 为空或 JSClass 创建失败
     */
    bool registerClass(JSContext* ctx);

    /**
     * 创建一个模块的 JS 对象实例，返回给 $app_require$ 的调用方。
     *
     * 返回的对象：
     *   - 原型链上有 getMethods() 注册的所有方法
     *   - 内部 opaque 指针指向本模块实例（this），
     *     native 方法通过 JS_GetOpaque 取回
     *
     * @param ctx QuickJS 上下文
     * @return JS 对象。所有权转移给调用方（JS 引擎的 GC）。
     *         registerClass 未调用时返回 JS_UNDEFINED。
     */
    JSValue createJSObject(JSContext* ctx);

    /**
     * 获取本模块的 JSClassID。
     *
     * native 方法实现中用它取回 C++ 实例：
     *   auto* self = static_cast<RouterModule*>(
     *       JS_GetOpaque(this_val, RouterModule::sClassId));
     *
     * @return JSClassID。registerClass 前返回 0。
     */
    JSClassID getClassId() const { return classId_; }

protected:
    // JSClassID 由 registerClass 分配。
    // 每个模块类型一个，所有实例共享。
    JSClassID classId_ = 0;
};

} // namespace quickapp

#endif // QUICKAPP_NATIVE_MODULE_H
```

### 7.2.3：实现基类的公共逻辑

`registerClass` 和 `createJSObject` 的逻辑对所有模块相同，放在基类实现，子类只需提供名称和方法表。

**@add `src/native_module.cpp`（新建文件）**

```cpp
#include "native_module.h"

#include "qa_log.h"

namespace quickapp {
namespace {

/**
 * JSClass 的 finalizer，JS 对象被 GC 时调用。
 *
 * 本实现故意为空：模块实例由 ModuleRegistry 拥有，
 * 生命周期与 Runtime 相同，不随 JS 对象销毁而释放。
 *
 * 如果这里 delete 了 opaque 指针，第二次 $app_require$
 * 拿到的就是野指针。
 *
 * @param rt  QuickJS 运行时（未使用）
 * @param val 被回收的 JS 对象（未使用）
 */
void moduleFinalizer(JSRuntime* /*rt*/, JSValue /*val*/) {
    // 有意为空
}

} // namespace

bool NativeModule::registerClass(JSContext* ctx) {
    if (ctx == nullptr) {
        QA_LOGE("[NativeModule] registerClass: ctx is null");
        return false;
    }
    if (classId_ != 0) {
        QA_LOGD("[NativeModule] %s already registered", getName());
        return true;   // 幂等
    }

    JSRuntime* rt = JS_GetRuntime(ctx);

    // 1. 分配 ClassID。
    //    JS_NewClassID 需要传入一个初始值为 0 的变量，
    //    它会写入新分配的 ID。
    JS_NewClassID(&classId_);

    // 2. 定义 JSClass。
    //    class_name 出现在 JS 的 Object.prototype.toString 结果里，
    //    如 "[object Router]"，便于调试。
    JSClassDef classDef{};
    classDef.class_name = getName();
    classDef.finalizer = moduleFinalizer;

    if (JS_NewClass(rt, classId_, &classDef) < 0) {
        QA_LOGE("[NativeModule] JS_NewClass failed for %s", getName());
        classId_ = 0;
        return false;
    }

    // 3. 创建 prototype 并挂载方法。
    //    方法挂在 prototype 上而不是实例上：
    //    多次 $app_require$ 返回的对象共享同一份函数对象，节省内存。
    JSValue proto = JS_NewObject(ctx);

    const auto methods = getMethods();
    for (const auto& m : methods) {
        if (m.name == nullptr || m.func == nullptr) {
            QA_LOGW("[NativeModule] %s: skipping invalid method def", getName());
            continue;
        }
        // JS_NewCFunction 创建的函数对象所有权转移给 JS_SetPropertyStr，
        // 不需要手动 JS_FreeValue
        JS_SetPropertyStr(ctx, proto, m.name,
                          JS_NewCFunction(ctx, m.func, m.name, m.argCount));
    }

    // 4. 绑定 prototype 到 ClassID。
    //    JS_SetClassProto 接管 proto 的所有权。
    JS_SetClassProto(ctx, classId_, proto);

    QA_LOGI("[NativeModule] registered %s with %zu methods",
            getName(), methods.size());
    return true;
}

JSValue NativeModule::createJSObject(JSContext* ctx) {
    if (classId_ == 0) {
        QA_LOGE("[NativeModule] createJSObject: %s not registered yet", getName());
        return JS_UNDEFINED;
    }

    // 创建带 class 的对象，它的原型链自动指向 registerClass 设置的 proto
    JSValue obj = JS_NewObjectClass(ctx, static_cast<int>(classId_));
    if (JS_IsException(obj)) {
        QA_LOGE("[NativeModule] JS_NewObjectClass failed for %s", getName());
        return JS_UNDEFINED;
    }

    // 把 C++ 实例指针存进对象的 opaque 槽位。
    // native 方法通过 JS_GetOpaque(this_val, classId) 取回。
    JS_SetOpaque(obj, this);

    return obj;
}

} // namespace quickapp
```

---

## Step 7.3：实现 ModuleRegistry

### 7.3.1：创建头文件

**@add `include/module_registry.h`（新建文件）**

```cpp
#ifndef QUICKAPP_MODULE_REGISTRY_H
#define QUICKAPP_MODULE_REGISTRY_H

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

#include "native_module.h"

namespace quickapp {

// NativeModule 的注册表。
//
// 职责：
//   持有所有已注册模块的所有权，提供按名查找。
//   JS Bridge 的 $app_require$ 通过它分发模块，
//   所以新增模块不需要修改 js_bridge.cpp。
//
// 线程所有权：
//   注册发生在 Runtime 启动阶段（Runtime Thread）。
//   查找发生在 JS 执行期间（同样是 Runtime Thread）。
//   全程单线程，不需要锁。
//
// 生命周期：
//   与 Runtime 相同。clear() 时释放所有模块实例。
//
// 单例说明：
//   V1 用单例，因为只支持单个 Runtime。
//   多 Runtime 时应改为 Runtime 对象的成员。
class ModuleRegistry {
public:
    /**
     * 获取全局唯一实例。
     *
     * @return 单例引用。首次调用时构造（C++11 保证线程安全的局部静态初始化）。
     */
    static ModuleRegistry& instance();

    /**
     * 注册一个模块。
     *
     * 行为：
     *   1. 取模块名
     *   2. 同名模块已存在时覆盖（旧实例被释放）
     *   3. 存入映射表，Registry 接管所有权
     *
     * 注意：注册后还需要调用 registerAllClasses() 才能被 JS 使用。
     *      分成两步是因为注册模块时 JSContext 可能还没创建。
     *
     * @param module 模块实例，所有权转移给 Registry。传 nullptr 是空操作。
     * @return true 注册成功；false module 为空或 getName() 返回空
     */
    bool registerModule(std::unique_ptr<NativeModule> module);

    /**
     * 按名查找模块。
     *
     * @param name 完整模块名，如 "@app-module/system.router"。
     *             为 nullptr 时返回 nullptr。
     * @return 模块指针，未找到返回 nullptr。
     *         返回的指针由 Registry 拥有，调用方不得释放。
     */
    NativeModule* find(const char* name) const;

    /**
     * 为所有已注册模块注册 JSClass。
     *
     * 应在 JSEngine 初始化后、eval 任何脚本之前调用一次。
     *
     * @param ctx QuickJS 上下文
     * @return 成功注册的模块数量。小于 size() 说明有模块注册失败
     */
    size_t registerAllClasses(JSContext* ctx);

    /**
     * 已注册模块数量。
     * @return 模块个数
     */
    size_t size() const { return modules_.size(); }

    /**
     * 列出所有已注册的模块名。用于调试和日志。
     * @return 模块名列表，顺序不保证
     */
    std::vector<std::string> listNames() const;

    /**
     * 清空所有模块，释放实例。
     *
     * 必须在 JSEngine destroy 之前调用：
     * 模块的 JSClass 注册在 JSContext 里，引擎销毁后
     * 模块实例的清理逻辑可能访问已失效的 ctx。
     */
    void clear();

private:
    ModuleRegistry() = default;
    ~ModuleRegistry() = default;

    // 禁止拷贝：单例
    ModuleRegistry(const ModuleRegistry&) = delete;
    ModuleRegistry& operator=(const ModuleRegistry&) = delete;

    // 模块名 → 实例。
    // 用 unordered_map 而不是 map：查找是 O(1)，
    // $app_require$ 在 JS 执行中可能被频繁调用。
    std::unordered_map<std::string, std::unique_ptr<NativeModule>> modules_;
};

} // namespace quickapp

#endif // QUICKAPP_MODULE_REGISTRY_H
```

### 7.3.2：创建实现文件

**@add `src/module_registry.cpp`（新建文件）**

```cpp
#include "module_registry.h"

#include "qa_log.h"

namespace quickapp {

ModuleRegistry& ModuleRegistry::instance() {
    // 函数内静态局部变量。
    // C++11 保证它的初始化是线程安全的（magic static），
    // 且在首次调用时才构造（懒初始化）。
    static ModuleRegistry registry;
    return registry;
}

bool ModuleRegistry::registerModule(std::unique_ptr<NativeModule> module) {
    if (!module) {
        QA_LOGW("[ModuleRegistry] registerModule: null module ignored");
        return false;
    }

    const char* name = module->getName();
    if (name == nullptr || name[0] == '\0') {
        QA_LOGE("[ModuleRegistry] registerModule: module has empty name");
        return false;
    }

    // 同名覆盖。
    // 允许覆盖的用途：测试时用 mock 模块替换真实模块。
    // operator[] + move 会释放旧的 unique_ptr（如果存在）。
    const std::string key(name);
    if (modules_.find(key) != modules_.end()) {
        QA_LOGW("[ModuleRegistry] overwriting existing module: %s", name);
    }

    modules_[key] = std::move(module);
    QA_LOGI("[ModuleRegistry] registered: %s", name);
    return true;
}

NativeModule* ModuleRegistry::find(const char* name) const {
    if (name == nullptr) {
        return nullptr;
    }
    auto it = modules_.find(std::string(name));
    if (it == modules_.end()) {
        return nullptr;
    }
    return it->second.get();
}

size_t ModuleRegistry::registerAllClasses(JSContext* ctx) {
    if (ctx == nullptr) {
        QA_LOGE("[ModuleRegistry] registerAllClasses: ctx is null");
        return 0;
    }

    size_t ok = 0;
    for (auto& [name, module] : modules_) {
        if (module->registerClass(ctx)) {
            ++ok;
        } else {
            QA_LOGE("[ModuleRegistry] failed to register class for %s", name.c_str());
        }
    }

    QA_LOGI("[ModuleRegistry] registered %zu/%zu module classes", ok, modules_.size());
    return ok;
}

std::vector<std::string> ModuleRegistry::listNames() const {
    std::vector<std::string> names;
    names.reserve(modules_.size());
    for (const auto& [name, _] : modules_) {
        names.push_back(name);
    }
    return names;
}

void ModuleRegistry::clear() {
    const size_t count = modules_.size();
    modules_.clear();   // unique_ptr 自动释放所有模块实例
    QA_LOGI("[ModuleRegistry] cleared %zu modules", count);
}

} // namespace quickapp
```

---

## Step 7.4：实现 JS Bridge 注入

### 7.4.1：创建头文件

**@add `include/js_bridge.h`（新建文件）**

```cpp
#ifndef QUICKAPP_JS_BRIDGE_H
#define QUICKAPP_JS_BRIDGE_H

namespace quickapp {

class JSEngine;
class RuntimeEventLoop;

// JS Bridge 的注入配置。
struct JSBridgeConfig {
    // 用于 setTimeout / clearTimeout 的调度器。
    // 为 nullptr 时不注入定时器函数，JS 里 setTimeout 是 undefined。
    RuntimeEventLoop* loop = nullptr;
};

/**
 * 向 JS 全局环境注入 Core 提供的能力。
 *
 * 注入内容：
 *   $app_require$(name)          从 ModuleRegistry 获取系统模块
 *   console.log/warn/error/info  转发到 QA_LOG*
 *   setTimeout(fn, delay)        通过 EventLoop 实现，返回 timerId
 *   clearTimeout(timerId)        取消定时器
 *   __native_render__(tpl, style) 渲染入口（本步为桩，Step 09 实现）
 *
 * 不注入（由 framework.js 用纯 JS 实现）：
 *   $app_define$    维护组件表，不需要 native 能力
 *   $app_bootstrap$ 创建 VM 实例，不需要 native 能力
 *
 * 调用时机：
 *   必须在 JSEngine.initialize() 之后、eval(framework.js) 之前调用。
 *   framework.js 执行时会用到这些全局函数。
 *
 * @param engine 已初始化的 JS 引擎，不能为 nullptr
 * @param config 注入配置
 * @return true 全部注入成功；false engine 为空或未初始化
 */
bool installJSBridge(JSEngine* engine, const JSBridgeConfig& config);

/**
 * 设置 __native_render__ 的实际处理器。
 *
 * Step 09 实现 VNode 构建后，通过这个函数把渲染逻辑接进来。
 * 本步只注入桩函数（记录日志后返回）。
 *
 * @param handler 渲染处理器。参数是 JSContext* 和两个 JSValue
 *                （template 对象和 style 对象），返回是否成功。
 *                传 nullptr 恢复为桩行为。
 */
using NativeRenderHandler = bool (*)(void* ctx, void* templateVal, void* styleVal);
void setNativeRenderHandler(NativeRenderHandler handler);

} // namespace quickapp

#endif // QUICKAPP_JS_BRIDGE_H
```

### 7.4.2：实现 $app_require$ 与 console

**@add `src/js_bridge.cpp`（新建文件）**

第一部分：头部和 `$app_require$`。

```cpp
#include "js_bridge.h"

#include <cstring>
#include <string>

#include "js_engine.h"
#include "module_registry.h"
#include "qa_log.h"
#include "quickjs.h"
#include "runtime_event_loop.h"

namespace quickapp {
namespace {

// setTimeout 需要用到的 EventLoop。
// 在 installJSBridge 时保存，由 native_setTimeout 使用。
RuntimeEventLoop* g_loop = nullptr;

// __native_render__ 的实际处理器，Step 09 通过 setNativeRenderHandler 注入。
NativeRenderHandler g_renderHandler = nullptr;

// ============================================================
// $app_require$(name)
// ============================================================

/**
 * JS: $app_require$("@app-module/system.router")
 *
 * 从 ModuleRegistry 查找模块并返回其 JS 对象。
 *
 * @param ctx  QuickJS 上下文
 * @param argc 参数个数，期望 1
 * @param argv argv[0] 是模块名字符串
 * @return 模块 JS 对象；模块不存在或参数错误时返回 JS_UNDEFINED
 *
 * 设计要点：
 *   这个函数不含任何具体模块的名字。新增模块只需注册到 Registry，
 *   本函数零改动。
 */
JSValue native_app_require(JSContext* ctx, JSValueConst /*thisVal*/,
                           int argc, JSValueConst* argv) {
    if (argc < 1) {
        QA_LOGW("[JSBridge] $app_require$ called without arguments");
        return JS_UNDEFINED;
    }

    const char* name = JS_ToCString(ctx, argv[0]);
    if (name == nullptr) {
        QA_LOGW("[JSBridge] $app_require$: cannot convert argument to string");
        return JS_UNDEFINED;
    }

    NativeModule* module = ModuleRegistry::instance().find(name);

    JSValue result;
    if (module != nullptr) {
        result = module->createJSObject(ctx);
        QA_LOGD("[JSBridge] $app_require$('%s') -> native module", name);
    } else {
        // 不是 C++ 模块。可能是 @app-component/xxx（framework.js 的组件），
        // 由 JS 侧处理，这里返回 undefined 让 framework.js 继续查它自己的表。
        QA_LOGD("[JSBridge] $app_require$('%s') -> not a native module", name);
        result = JS_UNDEFINED;
    }

    JS_FreeCString(ctx, name);
    return result;
}

// ============================================================
// console.log / warn / error / info
// ============================================================

/**
 * console.* 的公共实现。
 *
 * 把所有参数转为字符串并用空格拼接，然后输出到 Core 日志。
 * 行为对齐浏览器的 console.log(a, b, c)。
 *
 * @param ctx   QuickJS 上下文
 * @param argc  参数个数
 * @param argv  参数数组
 * @param level 输出的日志级别
 * @return JS_UNDEFINED（console.* 无返回值）
 */
JSValue consoleImpl(JSContext* ctx, int argc, JSValueConst* argv, LogLevel level) {
    std::string line;
    line.reserve(128);

    for (int i = 0; i < argc; ++i) {
        if (i > 0) {
            line += ' ';
        }
        // JS_ToCString 对任意类型都有效：
        //   对象 → "[object Object]"，数组 → "1,2,3"，undefined → "undefined"
        const char* s = JS_ToCString(ctx, argv[i]);
        if (s != nullptr) {
            line += s;
            JS_FreeCString(ctx, s);
        } else {
            // toString 抛异常的情况（如 Symbol）
            line += "<unconvertible>";
            // 清掉异常，不让它传播到调用 console.log 的 JS 代码
            JS_FreeValue(ctx, JS_GetException(ctx));
        }
    }

    // 加 [JS] 前缀，日志里能区分 JS 输出和 Core 输出
    switch (level) {
        case LogLevel::Warn:  QA_LOGW("[JS] %s", line.c_str()); break;
        case LogLevel::Error: QA_LOGE("[JS] %s", line.c_str()); break;
        default:              QA_LOGI("[JS] %s", line.c_str()); break;
    }

    return JS_UNDEFINED;
}

JSValue native_console_log(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    return consoleImpl(ctx, argc, argv, LogLevel::Info);
}
JSValue native_console_info(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    return consoleImpl(ctx, argc, argv, LogLevel::Info);
}
JSValue native_console_warn(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    return consoleImpl(ctx, argc, argv, LogLevel::Warn);
}
JSValue native_console_error(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    return consoleImpl(ctx, argc, argv, LogLevel::Error);
}
```


第二部分：setTimeout / clearTimeout。

```cpp
// ============================================================
// setTimeout / clearTimeout
// ============================================================

/**
 * JS: setTimeout(fn, delayMs)
 *
 * 实现要点：
 *   需要保存 JS 函数对象直到定时器触发。JSValue 是引用计数的，
 *   必须 JS_DupValue 增加引用，否则函数在 setTimeout 返回后就被 GC 回收，
 *   触发时调用野指针。
 *
 * @param argc 期望 1 或 2（delay 可省略，默认 0）
 * @param argv argv[0] 回调函数，argv[1] 延迟毫秒数
 * @return TimerId（JS 侧的 number），失败时返回 JS_UNDEFINED
 */
JSValue native_setTimeout(JSContext* ctx, JSValueConst /*thisVal*/,
                          int argc, JSValueConst* argv) {
    if (g_loop == nullptr) {
        QA_LOGE("[JSBridge] setTimeout: no EventLoop configured");
        return JS_UNDEFINED;
    }
    if (argc < 1 || !JS_IsFunction(ctx, argv[0])) {
        QA_LOGW("[JSBridge] setTimeout: first argument must be a function");
        return JS_UNDEFINED;
    }

    int32_t delayMs = 0;
    if (argc >= 2) {
        JS_ToInt32(ctx, &delayMs, argv[1]);
        if (delayMs < 0) {
            delayMs = 0;   // 对齐浏览器行为：负数当 0 处理
        }
    }

    // 增加引用计数，防止函数对象被 GC。
    // 这份引用的所有权转移给 lambda，在回调执行后或 Runtime 销毁时释放。
    JSValue callback = JS_DupValue(ctx, argv[0]);

    const TimerId id = g_loop->postDelayed(
        [ctx, callback]() mutable {
            // 调用 JS 函数。
            // this 传 JS_UNDEFINED：setTimeout 回调里的 this 在非严格模式下
            // 应该是全局对象，但快应用的 VM 方法都用箭头函数或 bind，
            // 传 undefined 更安全（避免意外暴露全局对象）。
            JSValue ret = JS_Call(ctx, callback, JS_UNDEFINED, 0, nullptr);

            if (JS_IsException(ret)) {
                JSValue exc = JS_GetException(ctx);
                const char* msg = JS_ToCString(ctx, exc);
                QA_LOGE("[JSBridge] setTimeout callback threw: %s",
                        msg != nullptr ? msg : "<unknown>");
                if (msg != nullptr) {
                    JS_FreeCString(ctx, msg);
                }
                JS_FreeValue(ctx, exc);
            }

            JS_FreeValue(ctx, ret);
            // 释放之前 JS_DupValue 增加的引用
            JS_FreeValue(ctx, callback);
        },
        static_cast<uint64_t>(delayMs));

    if (id == kInvalidTimerId) {
        // EventLoop 已停止，投递失败。必须释放刚才 dup 的引用，否则泄漏。
        JS_FreeValue(ctx, callback);
        QA_LOGW("[JSBridge] setTimeout: loop stopped, timer not scheduled");
        return JS_UNDEFINED;
    }

    QA_LOGD("[JSBridge] setTimeout scheduled: id=%llu delay=%dms",
            static_cast<unsigned long long>(id), delayMs);

    // TimerId 是 uint64_t，JS 的 number 是 double（安全整数上限 2^53）。
    // 实际 Timer 数量远不会超过这个范围，用 int64 转换安全。
    return JS_NewInt64(ctx, static_cast<int64_t>(id));
}

/**
 * JS: clearTimeout(timerId)
 *
 * @param argv argv[0] 是 setTimeout 返回的 id
 * @return JS_UNDEFINED
 *
 * 注意：被取消的 Timer 其回调持有的 JSValue 引用不会在这里释放，
 *      而是等 EventLoop 清理队列时随 lambda 析构一起释放。
 *      PosixEventLoop 的 stop() 会 clear 队列，触发 lambda 析构。
 */
JSValue native_clearTimeout(JSContext* ctx, JSValueConst /*thisVal*/,
                            int argc, JSValueConst* argv) {
    if (g_loop == nullptr || argc < 1) {
        return JS_UNDEFINED;
    }

    int64_t id = 0;
    if (JS_ToInt64(ctx, &id, argv[0]) < 0) {
        QA_LOGW("[JSBridge] clearTimeout: invalid timer id");
        return JS_UNDEFINED;
    }

    g_loop->cancelTimer(static_cast<TimerId>(id));
    QA_LOGD("[JSBridge] clearTimeout: id=%lld", static_cast<long long>(id));
    return JS_UNDEFINED;
}

// ============================================================
// __native_render__(template, style)
// ============================================================

/**
 * JS: __native_render__(templateObj, styleObj)
 *
 * framework.js 创建 VM 并求值模板后调用它，通知 C++ 开始渲染。
 *
 * 本步只做桩实现（记录日志）。Step 09 通过 setNativeRenderHandler
 * 注入真正的 VNode 构建逻辑。
 *
 * @param argv argv[0] template 对象，argv[1] style 对象
 * @return true/false（JS 侧的 boolean），表示渲染是否成功
 */
JSValue native_render(JSContext* ctx, JSValueConst /*thisVal*/,
                      int argc, JSValueConst* argv) {
    if (argc < 2) {
        QA_LOGW("[JSBridge] __native_render__ needs 2 arguments (template, style)");
        return JS_FALSE;
    }

    if (g_renderHandler == nullptr) {
        // 桩行为：Step 09 之前的状态
        QA_LOGI("[JSBridge] __native_render__ called (no handler installed yet)");
        return JS_TRUE;
    }

    // void* 转换是为了让 js_bridge.h 不暴露 QuickJS 类型。
    // Step 09 的 handler 内部会转回 JSContext* / JSValue。
    const bool ok = g_renderHandler(
        static_cast<void*>(ctx),
        // JSValueConst 到 void* 需要去掉 const 并取地址。
        // handler 侧按 JSValue* 解释。
        static_cast<void*>(const_cast<JSValue*>(&argv[0])),
        static_cast<void*>(const_cast<JSValue*>(&argv[1])));

    return ok ? JS_TRUE : JS_FALSE;
}

} // namespace（匿名 namespace 结束）
```

第三部分：注入入口。

```cpp
bool installJSBridge(JSEngine* engine, const JSBridgeConfig& config) {
    if (engine == nullptr) {
        QA_LOGE("[JSBridge] installJSBridge: engine is null");
        return false;
    }

    auto* ctx = static_cast<JSContext*>(engine->getRawContext());
    if (ctx == nullptr) {
        QA_LOGE("[JSBridge] installJSBridge: engine not initialized");
        return false;
    }

    g_loop = config.loop;

    // ---- 1. 为所有已注册模块注册 JSClass ----
    // 必须在注入 $app_require$ 之前完成，
    // 否则第一次 require 时 createJSObject 会因 classId_==0 失败。
    ModuleRegistry::instance().registerAllClasses(ctx);

    JSValue global = JS_GetGlobalObject(ctx);

    // ---- 2. $app_require$ ----
    JS_SetPropertyStr(ctx, global, "$app_require$",
        JS_NewCFunction(ctx, native_app_require, "$app_require$", 1));

    // ---- 3. console 对象 ----
    // 创建一个新对象挂 log/warn/error/info，而不是直接挂全局函数，
    // 因为 JS 代码写的是 console.log(...) 而不是 log(...)
    JSValue console = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, console, "log",
        JS_NewCFunction(ctx, native_console_log, "log", 1));
    JS_SetPropertyStr(ctx, console, "info",
        JS_NewCFunction(ctx, native_console_info, "info", 1));
    JS_SetPropertyStr(ctx, console, "warn",
        JS_NewCFunction(ctx, native_console_warn, "warn", 1));
    JS_SetPropertyStr(ctx, console, "error",
        JS_NewCFunction(ctx, native_console_error, "error", 1));
    // debug 复用 log
    JS_SetPropertyStr(ctx, console, "debug",
        JS_NewCFunction(ctx, native_console_log, "debug", 1));
    JS_SetPropertyStr(ctx, global, "console", console);

    // ---- 4. 定时器 ----
    if (config.loop != nullptr) {
        JS_SetPropertyStr(ctx, global, "setTimeout",
            JS_NewCFunction(ctx, native_setTimeout, "setTimeout", 2));
        JS_SetPropertyStr(ctx, global, "clearTimeout",
            JS_NewCFunction(ctx, native_clearTimeout, "clearTimeout", 1));
        // setInterval 暂不实现：需要额外的重复调度逻辑，
        // 且快应用场景下用 setTimeout 自递归可以替代。
    } else {
        QA_LOGW("[JSBridge] no EventLoop provided, setTimeout not available");
    }

    // ---- 5. 渲染入口 ----
    JS_SetPropertyStr(ctx, global, "__native_render__",
        JS_NewCFunction(ctx, native_render, "__native_render__", 2));

    JS_FreeValue(ctx, global);

    QA_LOGI("[JSBridge] installed: $app_require$, console, %s__native_render__",
            config.loop != nullptr ? "setTimeout/clearTimeout, " : "");
    return true;
}

void setNativeRenderHandler(NativeRenderHandler handler) {
    g_renderHandler = handler;
    QA_LOGI("[JSBridge] native render handler %s",
            handler != nullptr ? "installed" : "cleared");
}

} // namespace quickapp
```

---

## Step 7.5：实现 RouterModule 与 PromptModule

### 7.5.1：RouterModule

Router 的完整页面栈逻辑属于 Step 10，本步先实现接口和状态记录。

**@add `src/router_module.cpp`（新建文件）**

```cpp
// system.router 模块。
//
// V1 职责边界：
//   本步实现 JS 调用的接收和页面栈状态维护。
//   实际的页面加载（eval page bundle → 构建 VNode → 渲染）
//   由 Step 10 的 RuntimeBootstrap 通过回调接入。
//
// 这样划分是因为页面加载需要 RPKLoader、VNode、Layout 等
// 后续 Step 才实现的组件。

#include <string>
#include <vector>

#include "module_registry.h"
#include "native_module.h"
#include "qa_log.h"
#include "quickjs.h"

namespace quickapp {

// 页面导航请求的处理器。
// 由 RuntimeBootstrap（Step 10）设置，内部完成实际的页面加载和渲染。
using NavigateHandler = bool (*)(const char* uri, bool isBack);

namespace {
NavigateHandler g_navigateHandler = nullptr;
}

void setNavigateHandler(NavigateHandler handler) {
    g_navigateHandler = handler;
}

namespace {

// system.router 的实现。
//
// 职责：
//   维护 C++ 侧的页面栈，接收 JS 的导航请求。
//   不依赖平台的 Activity 栈或 UINavigationController，
//   页面栈逻辑三端共享。
//
// 线程所有权：Runtime Thread。
// 生命周期：与 Runtime 相同，由 ModuleRegistry 持有。
class RouterModule final : public NativeModule {
public:
    const char* getName() const override {
        return "@app-module/system.router";
    }

    std::vector<MethodDef> getMethods() const override {
        return {
            {"push",    &RouterModule::jsPush,    1},
            {"replace", &RouterModule::jsReplace, 1},
            {"back",    &RouterModule::jsBack,    0},
            {"clear",   &RouterModule::jsClear,   0},
        };
    }

    // JSClassID 需要静态可见，供 native 方法通过 JS_GetOpaque 取回实例。
    // registerClass 会给基类的 classId_ 赋值，这里同步一份到静态变量。
    static JSClassID sClassId;

    bool registerClassAndCacheId(JSContext* ctx) {
        const bool ok = registerClass(ctx);
        if (ok) {
            sClassId = getClassId();
        }
        return ok;
    }

    /**
     * 压入新页面。
     * @param uri 页面路径，如 "/pages/DemoDetail"
     * @return true 导航成功
     */
    bool push(const std::string& uri) {
        if (uri.empty()) {
            QA_LOGW("[Router] push: empty uri");
            return false;
        }
        pageStack_.push_back(uri);
        QA_LOGI("[Router] push '%s', stack depth=%zu", uri.c_str(), pageStack_.size());

        if (g_navigateHandler != nullptr) {
            return g_navigateHandler(uri.c_str(), false);
        }
        QA_LOGD("[Router] no navigate handler installed (Step 10 will provide it)");
        return true;
    }

    /**
     * 替换当前页面（不增加栈深度）。
     * @param uri 目标页面路径
     * @return true 成功
     */
    bool replace(const std::string& uri) {
        if (uri.empty()) {
            return false;
        }
        if (!pageStack_.empty()) {
            pageStack_.pop_back();
        }
        pageStack_.push_back(uri);
        QA_LOGI("[Router] replace with '%s', stack depth=%zu",
                uri.c_str(), pageStack_.size());

        if (g_navigateHandler != nullptr) {
            return g_navigateHandler(uri.c_str(), false);
        }
        return true;
    }

    /**
     * 返回上一页。
     * @return true 成功返回；false 已在栈底（应由平台层处理退出应用）
     */
    bool back() {
        if (pageStack_.size() <= 1) {
            QA_LOGI("[Router] back: already at root, cannot go back");
            return false;
        }
        pageStack_.pop_back();
        const std::string& target = pageStack_.back();
        QA_LOGI("[Router] back to '%s', stack depth=%zu",
                target.c_str(), pageStack_.size());

        if (g_navigateHandler != nullptr) {
            return g_navigateHandler(target.c_str(), true);
        }
        return true;
    }

    /**
     * 清空页面栈，只保留当前页。
     * 对应 router.clear()，用于登录成功后清除历史。
     */
    void clear() {
        if (pageStack_.size() > 1) {
            const std::string current = pageStack_.back();
            pageStack_.clear();
            pageStack_.push_back(current);
        }
        QA_LOGI("[Router] cleared, stack depth=%zu", pageStack_.size());
    }

    /**
     * 设置入口页，Runtime 启动时调用。
     * @param uri 入口页路径
     */
    void setEntry(const std::string& uri) {
        pageStack_.clear();
        pageStack_.push_back(uri);
    }

    size_t stackDepth() const { return pageStack_.size(); }

private:
    /**
     * 从 JS 参数对象中提取 uri 字段。
     *
     * JS 调用形式：router.push({ uri: '/pages/Detail' })
     *
     * @param ctx QuickJS 上下文
     * @param arg 参数对象
     * @param out 输出参数，接收 uri 字符串
     * @return true 提取成功；false 参数不是对象或没有 uri 字段
     */
    static bool extractUri(JSContext* ctx, JSValueConst arg, std::string& out) {
        if (!JS_IsObject(arg)) {
            QA_LOGW("[Router] argument must be an object like { uri: '/pages/X' }");
            return false;
        }
        JSValue uriVal = JS_GetPropertyStr(ctx, arg, "uri");
        if (JS_IsUndefined(uriVal)) {
            QA_LOGW("[Router] argument object has no 'uri' field");
            JS_FreeValue(ctx, uriVal);
            return false;
        }
        const char* uri = JS_ToCString(ctx, uriVal);
        if (uri == nullptr) {
            JS_FreeValue(ctx, uriVal);
            return false;
        }
        out = uri;
        JS_FreeCString(ctx, uri);
        JS_FreeValue(ctx, uriVal);
        return true;
    }

    /**
     * 从 this_val 取回 C++ 实例。
     * @return 实例指针，失败时返回 nullptr
     */
    static RouterModule* self(JSValueConst thisVal) {
        return static_cast<RouterModule*>(JS_GetOpaque(thisVal, sClassId));
    }

    // ---- JS 方法实现 ----

    static JSValue jsPush(JSContext* ctx, JSValueConst thisVal,
                          int argc, JSValueConst* argv) {
        auto* mod = self(thisVal);
        if (mod == nullptr || argc < 1) {
            return JS_FALSE;
        }
        std::string uri;
        if (!extractUri(ctx, argv[0], uri)) {
            return JS_FALSE;
        }
        return mod->push(uri) ? JS_TRUE : JS_FALSE;
    }

    static JSValue jsReplace(JSContext* ctx, JSValueConst thisVal,
                             int argc, JSValueConst* argv) {
        auto* mod = self(thisVal);
        if (mod == nullptr || argc < 1) {
            return JS_FALSE;
        }
        std::string uri;
        if (!extractUri(ctx, argv[0], uri)) {
            return JS_FALSE;
        }
        return mod->replace(uri) ? JS_TRUE : JS_FALSE;
    }

    static JSValue jsBack(JSContext* /*ctx*/, JSValueConst thisVal,
                          int /*argc*/, JSValueConst* /*argv*/) {
        auto* mod = self(thisVal);
        if (mod == nullptr) {
            return JS_FALSE;
        }
        return mod->back() ? JS_TRUE : JS_FALSE;
    }

    static JSValue jsClear(JSContext* /*ctx*/, JSValueConst thisVal,
                           int /*argc*/, JSValueConst* /*argv*/) {
        auto* mod = self(thisVal);
        if (mod != nullptr) {
            mod->clear();
        }
        return JS_UNDEFINED;
    }

    // C++ 侧的页面栈。三端共享同一套逻辑。
    std::vector<std::string> pageStack_;
};

JSClassID RouterModule::sClassId = 0;

} // namespace

/**
 * 注册 RouterModule 到全局 Registry。
 * 由 RuntimeBootstrap 在启动序列中调用。
 */
void registerRouterModule() {
    ModuleRegistry::instance().registerModule(std::make_unique<RouterModule>());
}

} // namespace quickapp
```


### 7.5.2：PromptModule

**@add `src/prompt_module.cpp`（新建文件）**

```cpp
// system.prompt 模块。
//
// 职责：
//   接收 JS 的提示请求，转发到 PlatformBridge.showToast。
//   Core 不实现具体 UI，由平台决定用 Toast / 浮层 / 消息框。

#include <string>
#include <vector>

#include "module_registry.h"
#include "native_module.h"
#include "platform_bridge.h"
#include "qa_log.h"
#include "quickjs.h"

namespace quickapp {
namespace {

// system.prompt 的实现。
//
// 线程所有权：Runtime Thread。
// 生命周期：与 Runtime 相同，由 ModuleRegistry 持有。
class PromptModule final : public NativeModule {
public:
    const char* getName() const override {
        return "@app-module/system.prompt";
    }

    std::vector<MethodDef> getMethods() const override {
        return {
            {"showToast", &PromptModule::jsShowToast, 1},
        };
    }

    static JSClassID sClassId;

private:
    /**
     * JS: prompt.showToast({ message: 'saved' })
     *
     * @param argv argv[0] 是包含 message 字段的对象
     * @return JS_UNDEFINED（showToast 无返回值）
     */
    static JSValue jsShowToast(JSContext* ctx, JSValueConst /*thisVal*/,
                               int argc, JSValueConst* argv) {
        if (argc < 1 || !JS_IsObject(argv[0])) {
            QA_LOGW("[Prompt] showToast: argument must be { message: '...' }");
            return JS_UNDEFINED;
        }

        JSValue msgVal = JS_GetPropertyStr(ctx, argv[0], "message");
        if (JS_IsUndefined(msgVal)) {
            QA_LOGW("[Prompt] showToast: missing 'message' field");
            JS_FreeValue(ctx, msgVal);
            return JS_UNDEFINED;
        }

        const char* message = JS_ToCString(ctx, msgVal);
        if (message == nullptr) {
            JS_FreeValue(ctx, msgVal);
            return JS_UNDEFINED;
        }

        // 转发到平台。
        // showToast 是可选能力，平台可能没实现，必须检查。
        const auto& bridge = getPlatformBridge();
        if (bridge.showToast != nullptr) {
            bridge.showToast(message);
            QA_LOGI("[Prompt] showToast: %s", message);
        } else {
            QA_LOGW("[Prompt] showToast not supported by platform, "
                    "message dropped: %s", message);
        }

        JS_FreeCString(ctx, message);
        JS_FreeValue(ctx, msgVal);
        return JS_UNDEFINED;
    }
};

JSClassID PromptModule::sClassId = 0;

} // namespace

/**
 * 注册 PromptModule 到全局 Registry。
 * 由 RuntimeBootstrap 在启动序列中调用。
 */
void registerPromptModule() {
    ModuleRegistry::instance().registerModule(std::make_unique<PromptModule>());
}

} // namespace quickapp
```

### 7.5.3：新增模块的完整流程

这是本步最重要的产出 —— 一个可复制的扩展模式。

假设要加 `system.vibrator`：

```text
1. 新建 src/vibrator_module.cpp

2. 写类（约 40 行）
   class VibratorModule final : public NativeModule {
       const char* getName() const override {
           return "@app-module/system.vibrator";
       }
       std::vector<MethodDef> getMethods() const override {
           return {{"vibrate", &VibratorModule::jsVibrate, 1}};
       }
       static JSValue jsVibrate(...) {
           // 提取参数 → 调 PlatformBridge.vibrate
       }
   };

   void registerVibratorModule() {
       ModuleRegistry::instance().registerModule(
           std::make_unique<VibratorModule>());
   }

3. CMakeLists.txt 加一行
   src/vibrator_module.cpp

4. RuntimeBootstrap 加一行（Step 10）
   registerVibratorModule();

5. PlatformBridge 加一个函数指针（如果需要平台能力）
```

**js_bridge.cpp 零改动。** 这是 Registry 模式的核心价值。

---

## Step 7.6：接入 CMake

**@update `CMakeLists.txt` — 替换 `add_library(quickapp-core STATIC ...)` 块**

```cmake
add_library(quickapp-core STATIC
    src/core_version.cpp
    src/qa_log.cpp
    src/quickjs_engine.cpp
    src/runtime_thread.cpp
    src/platform_bridge.cpp
    src/platform_event_sink.cpp
    src/native_module.cpp                       # ← Step 07 新增
    src/module_registry.cpp                     # ← Step 07 新增
    src/js_bridge.cpp                           # ← Step 07 新增
    src/router_module.cpp                       # ← Step 07 新增
    src/prompt_module.cpp                       # ← Step 07 新增
    platform/common/posix_event_loop.cpp
)
```

注意 `native_module.h` 现在 include 了 `quickjs.h`，而它在 `include/` 目录（PUBLIC）。这意味着依赖 Core 的平台工程如果 include `native_module.h` 会找不到 `quickjs.h`。

**处理方式：** 平台层不需要 include `native_module.h`（它们不实现模块）。如果确实需要（比如平台想注册自己的模块），Step 11 会说明如何额外添加 QuickJS 的 include 路径。这是 7.2.2 里记录的 V1 妥协的延续。

---

## Step 7.7：编写测试

**@add `tests/test_js_bridge.cpp`（新建文件）**

```cpp
// JS Bridge、ModuleRegistry 与内置模块测试。
//
// 验证点：
//   1. ModuleRegistry 注册/查找/覆盖/清空
//   2. $app_require$ 返回模块对象，未知模块返回 undefined
//   3. console.log 输出到 Core 日志
//   4. router.push/back/replace 到达 C++
//   5. prompt.showToast 转发到 PlatformBridge
//   6. setTimeout 通过 EventLoop 触发
//   7. 自定义模块无需改 js_bridge 即可接入
//   8. 参数错误不崩溃

#include <atomic>
#include <chrono>
#include <cstdio>
#include <string>
#include <thread>
#include <vector>

#include "js_bridge.h"
#include "js_engine.h"
#include "module_registry.h"
#include "native_module.h"
#include "platform_bridge.h"
#include "quickjs.h"
#include "runtime_event_loop.h"

#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

namespace quickapp {
// 这些注册函数在各 module .cpp 中定义
void registerRouterModule();
void registerPromptModule();
}

namespace {

// ============================================================
// 自定义测试模块：验证扩展性
// ============================================================

int g_echoCallCount = 0;
std::string g_echoLastArg;

class EchoModule final : public quickapp::NativeModule {
public:
    const char* getName() const override { return "@app-module/test.echo"; }

    std::vector<quickapp::MethodDef> getMethods() const override {
        return {
            {"say",   &EchoModule::jsSay,   1},
            {"count", &EchoModule::jsCount, 0},
        };
    }

    static JSClassID sClassId;

private:
    static JSValue jsSay(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
        ++g_echoCallCount;
        if (argc > 0) {
            const char* s = JS_ToCString(ctx, argv[0]);
            if (s != nullptr) {
                g_echoLastArg = s;
                JS_FreeCString(ctx, s);
            }
        }
        // 回显给 JS，验证返回值传递
        return JS_NewString(ctx, g_echoLastArg.c_str());
    }

    static JSValue jsCount(JSContext* ctx, JSValueConst, int, JSValueConst*) {
        return JS_NewInt32(ctx, g_echoCallCount);
    }
};

JSClassID EchoModule::sClassId = 0;

// ============================================================
// Mock PlatformBridge：捕获 showToast
// ============================================================

std::vector<std::string> g_toasts;

void mockCreateElement(int, const char*, float, float, float, float) {}
void mockSetAttr(int, const char*, const char*) {}
void mockSetStyle(int, const char*, const char*) {}
void mockShowToast(const char* msg) { g_toasts.push_back(msg ? msg : ""); }

// ============================================================
// 测试组
// ============================================================

int testModuleRegistry() {
    auto& registry = quickapp::ModuleRegistry::instance();
    registry.clear();
    CHECK(registry.size() == 0, "registry should be empty after clear");
    CHECK(registry.find("@app-module/test.echo") == nullptr,
          "find should return nullptr for unregistered module");
    CHECK(registry.find(nullptr) == nullptr, "find(nullptr) should be safe");

    // 注册
    CHECK(registry.registerModule(std::make_unique<EchoModule>()),
          "registerModule failed");
    CHECK(registry.size() == 1, "registry should have 1 module");

    auto* found = registry.find("@app-module/test.echo");
    CHECK(found != nullptr, "should find registered module");
    CHECK(std::string(found->getName()) == "@app-module/test.echo",
          "found module name mismatch");
    CHECK(found->getMethods().size() == 2, "echo module should have 2 methods");

    // 空指针注册被拒绝
    CHECK(!registry.registerModule(nullptr), "null module should be rejected");
    CHECK(registry.size() == 1, "size should not change");

    // 同名覆盖
    CHECK(registry.registerModule(std::make_unique<EchoModule>()),
          "overwrite should succeed");
    CHECK(registry.size() == 1, "size should stay 1 after overwrite");

    // 列名
    const auto names = registry.listNames();
    CHECK(names.size() == 1 && names[0] == "@app-module/test.echo",
          "listNames wrong");

    registry.clear();
    CHECK(registry.size() == 0, "registry should be empty");
    return 0;
}

int testJSBridge() {
    // ---- 准备：引擎 + EventLoop + 模块 ----
    auto engine = quickapp::createJSEngine();
    CHECK(engine->initialize(), "engine init failed");

    auto loop = quickapp::createEventLoop();

    quickapp::PlatformBridge bridge{};
    bridge.createElement = mockCreateElement;
    bridge.setAttr = mockSetAttr;
    bridge.setStyle = mockSetStyle;
    bridge.showToast = mockShowToast;
    quickapp::registerPlatformBridge(bridge);

    auto& registry = quickapp::ModuleRegistry::instance();
    registry.clear();
    quickapp::registerRouterModule();
    quickapp::registerPromptModule();
    registry.registerModule(std::make_unique<EchoModule>());
    CHECK(registry.size() == 3, "should have 3 modules registered");

    quickapp::JSBridgeConfig config;
    config.loop = loop.get();
    CHECK(quickapp::installJSBridge(engine.get(), config),
          "installJSBridge failed");

    std::string result;

    // ---- 场景 1：console 可用 ----
    CHECK(engine->eval("console.log('hello from js', 42, {a:1});", "<t>"),
          "console.log failed");
    CHECK(engine->eval("console.warn('a warning');", "<t>"), "console.warn failed");
    CHECK(engine->eval("console.error('an error');", "<t>"), "console.error failed");

    // ---- 场景 2：$app_require$ 未知模块返回 undefined ----
    CHECK(engine->evalWithResult(
              "typeof $app_require$('@app-module/system.nonexistent')", "<t>", result),
          "eval failed");
    CHECK(result == "undefined", "unknown module should return undefined");

    // ---- 场景 3：自定义模块可用（未改 js_bridge.cpp） ----
    g_echoCallCount = 0;
    CHECK(engine->evalWithResult(
              "var echo = $app_require$('@app-module/test.echo');"
              "echo.say('ping')",
              "<t>", result),
          "echo.say failed");
    CHECK(result == "ping", "echo should return its argument");
    CHECK(g_echoCallCount == 1, "native say should be called once");
    CHECK(g_echoLastArg == "ping", "native received wrong argument");

    CHECK(engine->evalWithResult("echo.count()", "<t>", result), "echo.count failed");
    CHECK(result == "1", "count should be 1");

    // 方法在 prototype 上共享
    CHECK(engine->evalWithResult(
              "var e1 = $app_require$('@app-module/test.echo');"
              "var e2 = $app_require$('@app-module/test.echo');"
              "e1.say === e2.say",
              "<t>", result),
          "prototype check failed");
    CHECK(result == "true", "methods should be shared via prototype");

    // ---- 场景 4：router ----
    CHECK(engine->eval(
              "var router = $app_require$('@app-module/system.router');"
              "router.push({ uri: '/pages/Detail' });"
              "router.push({ uri: '/pages/Profile' });",
              "<t>"),
          "router.push failed");

    CHECK(engine->evalWithResult("router.back()", "<t>", result), "router.back failed");
    CHECK(result == "true", "back should succeed with depth 2");

    // 参数错误不崩溃
    CHECK(engine->evalWithResult("router.push({})", "<t>", result),
          "router.push({}) should not throw");
    CHECK(result == "false", "push without uri should return false");

    CHECK(engine->evalWithResult("router.push('not an object')", "<t>", result),
          "router.push(string) should not throw");
    CHECK(result == "false", "push with non-object should return false");

    // ---- 场景 5：prompt.showToast → PlatformBridge ----
    g_toasts.clear();
    CHECK(engine->eval(
              "var prompt = $app_require$('@app-module/system.prompt');"
              "prompt.showToast({ message: 'saved successfully' });",
              "<t>"),
          "showToast failed");
    CHECK(g_toasts.size() == 1, "one toast should be recorded");
    CHECK(g_toasts[0] == "saved successfully", "toast message wrong");

    // 缺 message 字段不崩溃
    CHECK(engine->eval("prompt.showToast({});", "<t>"),
          "showToast({}) should not throw");
    CHECK(g_toasts.size() == 1, "no toast should be added for invalid arg");

    // ---- 场景 6：setTimeout ----
    CHECK(engine->eval("var timerFired = false;", "<t>"), "setup failed");
    CHECK(engine->evalWithResult(
              "typeof setTimeout(function(){ timerFired = true; }, 10)",
              "<t>", result),
          "setTimeout failed");
    CHECK(result == "number", "setTimeout should return a number");

    // 驱动 loop 让定时器触发
    loop->postDelayed([&] { loop->stop(); }, 60);
    loop->run();

    CHECK(engine->evalWithResult("timerFired", "<t>", result), "read failed");
    CHECK(result == "true", "setTimeout callback should have fired");

    // ---- 场景 7：clearTimeout ----
    // 用新 loop，因为上面的已经 stop 了
    auto loop2 = quickapp::createEventLoop();
    quickapp::JSBridgeConfig config2;
    config2.loop = loop2.get();
    quickapp::installJSBridge(engine.get(), config2);

    CHECK(engine->eval(
              "var cancelled = false;"
              "var tid = setTimeout(function(){ cancelled = true; }, 10);"
              "clearTimeout(tid);",
              "<t>"),
          "clearTimeout setup failed");

    loop2->postDelayed([&] { loop2->stop(); }, 60);
    loop2->run();

    CHECK(engine->evalWithResult("cancelled", "<t>", result), "read failed");
    CHECK(result == "false", "cleared timer should not fire");

    // ---- 场景 8：__native_render__ 桩可调用 ----
    CHECK(engine->evalWithResult(
              "__native_render__({type:'div'}, {})", "<t>", result),
          "__native_render__ failed");
    CHECK(result == "true", "stub render handler should return true");

    // ---- 清理：顺序很重要 ----
    registry.clear();          // 先清模块（它们的 JSClass 在 ctx 里）
    quickapp::clearPlatformBridge();
    engine->destroy();         // 再销毁引擎
    return 0;
}

int testInstallWithoutLoop() {
    // 不提供 EventLoop 时 setTimeout 应该不存在，但其他功能正常
    auto engine = quickapp::createJSEngine();
    CHECK(engine->initialize(), "engine init failed");

    quickapp::ModuleRegistry::instance().clear();

    quickapp::JSBridgeConfig config;   // loop = nullptr
    CHECK(quickapp::installJSBridge(engine.get(), config),
          "install without loop should succeed");

    std::string result;
    CHECK(engine->evalWithResult("typeof setTimeout", "<t>", result), "eval failed");
    CHECK(result == "undefined", "setTimeout should not exist without loop");

    CHECK(engine->evalWithResult("typeof console.log", "<t>", result), "eval failed");
    CHECK(result == "function", "console should still work");

    CHECK(engine->evalWithResult("typeof $app_require$", "<t>", result), "eval failed");
    CHECK(result == "function", "$app_require$ should still work");

    engine->destroy();
    return 0;
}

int testNullEngine() {
    quickapp::JSBridgeConfig config;
    CHECK(!quickapp::installJSBridge(nullptr, config),
          "install with null engine should fail");

    // 未初始化的引擎
    auto engine = quickapp::createJSEngine();
    CHECK(!quickapp::installJSBridge(engine.get(), config),
          "install with uninitialized engine should fail");
    return 0;
}

} // namespace

int main() {
    if (testModuleRegistry() != 0) return 1;
    if (testJSBridge() != 0) return 1;
    if (testInstallWithoutLoop() != 0) return 1;
    if (testNullEngine() != 0) return 1;

    std::printf("PASS: all JS Bridge / ModuleRegistry tests\n");
    return 0;
}
```

**@update `tests/CMakeLists.txt` — 在 `test_platform_bridge` 之后插入**

```cmake
# test_js_bridge：模块系统与 JS 注入
#
# 需要 quickjs.h 来实现测试模块的 native 方法
add_executable(test_js_bridge test_js_bridge.cpp)
target_link_libraries(test_js_bridge PRIVATE quickapp-core quickjs)
target_include_directories(test_js_bridge PRIVATE
    ${CMAKE_SOURCE_DIR}/third_party/quickjs
)
add_test(NAME test_js_bridge COMMAND test_js_bridge)
```

---

## Step 7.8：逐层验证

### 7.8.1：编译验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build -j4
```

预期：

```text
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/native_module.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/module_registry.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/js_bridge.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/router_module.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/prompt_module.cpp.o
[100%] Linking CXX executable test_js_bridge
```

**常见错误：**

```text
"cannot convert 'JSValue (*)(JSContext*, JSValueConst, int, JSValueConst*)'
 to 'JSCFunction*'"
    → 方法签名写错。必须精确匹配，注意第二个参数是 JSValueConst 不是 JSValue

"'sClassId' was not declared in this scope"
    → 忘了在类外定义静态成员：JSClassID RouterModule::sClassId = 0;

"undefined reference to quickapp::registerRouterModule()"
    → CMakeLists.txt 缺 src/router_module.cpp

"quickjs.h: No such file or directory"（编译测试时）
    → tests/CMakeLists.txt 里 test_js_bridge 缺 QuickJS include 路径
```

### 7.8.2：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
1/6 Test #1: test_version .....................   Passed
2/6 Test #2: test_log .........................   Passed
3/6 Test #3: test_js_engine ...................   Passed
4/6 Test #4: test_event_loop ..................   Passed
5/6 Test #5: test_platform_bridge .............   Passed
6/6 Test #6: test_js_bridge ...................   Passed

100% tests passed, 0 tests failed out of 6
```

直接运行看 JS → C++ 的完整轨迹：

```bash
./build/tests/test_js_bridge
```

预期（节选）：

```text
[I/quickapp-core] [ModuleRegistry] registered: @app-module/system.router
[I/quickapp-core] [ModuleRegistry] registered: @app-module/system.prompt
[I/quickapp-core] [ModuleRegistry] registered: @app-module/test.echo
[I/quickapp-core] [NativeModule] registered @app-module/system.router with 4 methods
[I/quickapp-core] [NativeModule] registered @app-module/system.prompt with 1 methods
[I/quickapp-core] [NativeModule] registered @app-module/test.echo with 2 methods
[I/quickapp-core] [ModuleRegistry] registered 3/3 module classes
[I/quickapp-core] [JSBridge] installed: $app_require$, console,
                  setTimeout/clearTimeout, __native_render__
[I/quickapp-core] [JS] hello from js 42 [object Object]
[W/quickapp-core] [JS] a warning
[E/quickapp-core] [JS] an error
[D/quickapp-core] [JSBridge] $app_require$('@app-module/system.nonexistent')
                  -> not a native module
[D/quickapp-core] [JSBridge] $app_require$('@app-module/test.echo') -> native module
[I/quickapp-core] [Router] push '/pages/Detail', stack depth=1
[I/quickapp-core] [Router] push '/pages/Profile', stack depth=2
[I/quickapp-core] [Router] back to '/pages/Detail', stack depth=1
[W/quickapp-core] [Router] argument object has no 'uri' field
[W/quickapp-core] [Router] argument must be an object like { uri: '/pages/X' }
[I/quickapp-core] [Prompt] showToast: saved successfully
[W/quickapp-core] [Prompt] showToast: missing 'message' field
[D/quickapp-core] [JSBridge] setTimeout scheduled: id=1 delay=10ms
[D/quickapp-core] [JSBridge] clearTimeout: id=1
[I/quickapp-core] [JSBridge] __native_render__ called (no handler installed yet)
[I/quickapp-core] [ModuleRegistry] cleared 3 modules
PASS: all JS Bridge / ModuleRegistry tests
```

日志完整展示了 `JS → $app_require$ → C++ 模块 → PlatformBridge` 的调用链。

### 7.8.3：JSValue 泄漏验证（关键）

本步涉及大量 QuickJS 引用计数操作，必须用 ASan 检查：

```bash
cmake -B build-asan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer" \
  -DCMAKE_C_FLAGS="-fsanitize=address -fno-omit-frame-pointer" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address"
cmake --build build-asan -j4
ASAN_OPTIONS=detect_leaks=1 ./build-asan/tests/test_js_bridge
```

预期：`PASS`，无泄漏报告。

本步最容易泄漏的四处：

```text
1. setTimeout 的 JS_DupValue
   投递失败时必须 JS_FreeValue，否则回调函数永远不释放
   （代码里的 if (id == kInvalidTimerId) 分支）

2. extractUri 里的 JSValue
   JS_GetPropertyStr 返回的 uriVal 在所有分支都要 JS_FreeValue
   （包括 JS_IsUndefined 的早退分支）

3. JS_ToCString 的返回值
   必须 JS_FreeCString，且要注意早退路径

4. JS_GetGlobalObject 的返回值
   installJSBridge 末尾的 JS_FreeValue(ctx, global)
```

如果 ASan 报：

```text
Direct leak of 32 byte(s) in 1 object(s) allocated from:
    #1 js_malloc_rt
    #2 JS_NewObjectFromShape
    #3 quickapp::(anonymous namespace)::extractUri
```

按堆栈定位到具体函数，检查所有 return 路径是否都释放了。

```bash
rm -rf build-asan
```

### 7.8.4：扩展性验证

验证"新增模块不改内核"这个核心目标：

```bash
# js_bridge.cpp 里不应该出现任何具体模块名
grep -E "system\.router|system\.prompt|test\.echo" src/js_bridge.cpp
```

预期：**无输出**。

对比一下反例（如果用 if-else 分发）：

```bash
# 假设的错误实现会匹配到
# if (strcmp(name, "@app-module/system.router") == 0) { ... }
```

无输出证明 `$app_require$` 完全通过 Registry 分发，与具体模块解耦。

再验证模块之间不互相依赖：

```bash
grep "prompt_module\|router_module" src/js_bridge.cpp src/module_registry.cpp
```

预期：无输出。模块只在 `RuntimeBootstrap`（Step 10）里被注册，Bridge 和 Registry 都不知道它们的存在。

### 7.8.5：真实 RPK 调用形态验证

用接近真实 page bundle 的代码验证：

```bash
cat > /tmp/test_real_pattern.cpp << 'EOF'
#include <cstdio>
#include "js_bridge.h"
#include "js_engine.h"
#include "module_registry.h"
#include "platform_bridge.h"
#include "runtime_event_loop.h"

namespace quickapp {
void registerRouterModule();
void registerPromptModule();
}

static void mockCreate(int, const char*, float, float, float, float) {}
static void mockAttr(int, const char*, const char*) {}
static void mockStyle(int, const char*, const char*) {}
static void mockToast(const char* m) { std::printf(">>> TOAST: %s\n", m); }

int main() {
    auto engine = quickapp::createJSEngine();
    engine->initialize();
    auto loop = quickapp::createEventLoop();

    quickapp::PlatformBridge b{};
    b.createElement = mockCreate; b.setAttr = mockAttr;
    b.setStyle = mockStyle; b.showToast = mockToast;
    quickapp::registerPlatformBridge(b);

    quickapp::ModuleRegistry::instance().clear();
    quickapp::registerRouterModule();
    quickapp::registerPromptModule();

    quickapp::JSBridgeConfig cfg;
    cfg.loop = loop.get();
    quickapp::installJSBridge(engine.get(), cfg);

    // 模拟真实 page bundle 的 VM 方法调用形态
    const char* pageCode = R"JS(
        var vm = {
            title: '欢迎体验快应用开发',
            goDetail: function() {
                var router = $app_require$('@app-module/system.router');
                router.push({ uri: '/pages/DemoDetail' });
            },
            save: function() {
                var prompt = $app_require$('@app-module/system.prompt');
                prompt.showToast({ message: '已保存: ' + this.title });
            }
        };
        console.log('vm created, title =', vm.title);
        vm.goDetail();
        vm.save();
    )JS";

    bool ok = engine->eval(pageCode, "pages/Demo/index.js");
    std::printf("eval result: %s\n", ok ? "ok" : "failed");
    if (!ok) std::printf("error: %s\n", engine->getLastError().c_str());

    quickapp::ModuleRegistry::instance().clear();
    quickapp::clearPlatformBridge();
    engine->destroy();
    return ok ? 0 : 1;
}
EOF

c++ -std=c++17 -I include -I platform/common -I third_party/quickjs \
    /tmp/test_real_pattern.cpp \
    build/libquickapp-core.a build/third_party/quickjs/libquickjs.a \
    -o /tmp/test_real_pattern && /tmp/test_real_pattern
```

预期：

```text
[I/quickapp-core] [JS] vm created, title = 欢迎体验快应用开发
[I/quickapp-core] [Router] push '/pages/DemoDetail', stack depth=1
>>> TOAST: 已保存: 欢迎体验快应用开发
[I/quickapp-core] [Prompt] showToast: 已保存: 欢迎体验快应用开发
eval result: ok
```

`>>> TOAST:` 是 mock PlatformBridge 打印的，证明完整链路通了：

```text
JS vm.save() → $app_require$ → PromptModule → PlatformBridge.showToast → mock
```

中文字符串正确传递也验证了 UTF-8 处理无误。

```bash
rm -f /tmp/test_real_pattern.cpp /tmp/test_real_pattern
```

### 7.8.6：平台无关性回归

```bash
nm build/libquickapp-core.a | grep -E "__android_log_print|objc_msgSend"
```

预期：无输出。

---

## 技术决策

### 1. Registry 分发而不是 if-else

核心目标是让 `js_bridge.cpp` 不成为修改热点：

| 维度 | if-else 分发 | Registry 分发 |
|---|---|---|
| 新增模块改动文件 | js_bridge.cpp + 新模块文件 | 只有新模块文件 + 一行注册 |
| 查找复杂度 | O(n) strcmp | O(1) hash |
| 模块间隔离 | 都在一个函数里 | 各自独立文件 |
| 测试时替换模块 | 不可能 | registerModule 同名覆盖 |
| 代码增长 | 线性膨胀 | 常量 |

7.8.4 的 grep 验证保证这个约束不被破坏。

### 2. 方法挂 prototype 而不是实例

```cpp
// 选择：挂 prototype
JSValue proto = JS_NewObject(ctx);
JS_SetPropertyStr(ctx, proto, "push", JS_NewCFunction(...));
JS_SetClassProto(ctx, classId_, proto);

// 未选择：每次 require 创建新函数对象
JSValue obj = JS_NewObject(ctx);
JS_SetPropertyStr(ctx, obj, "push", JS_NewCFunction(...));   // 每次都新建
```

差别：

```text
挂 prototype
    10 次 $app_require$ → 1 份函数对象，10 个空对象
    e1.say === e2.say 为 true（符合 JS 语义直觉）

挂实例
    10 次 $app_require$ → 10 份函数对象
    每份函数对象约 100 字节 + 闭包环境
    e1.say === e2.say 为 false
```

页面切换频繁时（每次都 require 一遍系统模块）差异会累积。测试里的 `e1.say === e2.say` 断言就是在验证这一点。

### 3. JS_SetOpaque 绑定 C++ 实例

```cpp
JSValue obj = JS_NewObjectClass(ctx, classId_);
JS_SetOpaque(obj, this);
// native 方法里：
auto* self = static_cast<RouterModule*>(JS_GetOpaque(thisVal, sClassId));
```

替代方案是用全局单例：

```cpp
static JSValue jsPush(...) {
    RouterModule::instance().push(...);   // 不需要 opaque
}
```

选 opaque 的原因：为多实例场景留出空间。比如将来支持多 Runtime，每个 Runtime 有自己的 Router 实例，用 opaque 天然区分；用全局单例就要引入额外的 Runtime 上下文查找。

代价是每个模块类需要一个 `static JSClassID sClassId`，且要在 `registerClass` 后同步。

### 4. finalizer 故意为空

```cpp
void moduleFinalizer(JSRuntime*, JSValue) {
    // 有意为空
}
```

如果在这里 `delete` opaque 指针：

```text
第一次 $app_require$ → 创建 JS 对象 A，opaque = router 实例
JS 侧不再引用 A → GC 回收 A → finalizer 执行 delete router
第二次 $app_require$ → 创建 JS 对象 B，opaque = 已释放的指针
调用 B.push() → use-after-free
```

模块实例的所有权在 `ModuleRegistry`，生命周期与 Runtime 相同。JS 对象只是一个持有指针的壳，销毁它不应该影响模块本身。

### 5. `$app_require$` 对未知模块返回 undefined 而不是抛异常

```cpp
if (module == nullptr) {
    return JS_UNDEFINED;   // 不是 JS_ThrowReferenceError
}
```

原因是 `$app_require$` 需要同时服务两种命名空间：

```text
@app-module/system.router  → C++ 模块
@app-component/Demo        → framework.js 的组件表
```

C++ 侧只认识前者。返回 `undefined` 让 framework.js 能继续查自己的表：

```javascript
// framework.js 内部（Step 10）
const nativeRequire = globalThis.$app_require$;
globalThis.$app_require$ = function(name) {
    const native = nativeRequire(name);
    if (native !== undefined) return native;
    return __components__[name];   // 回退到组件表
};
```

抛异常会中断这个回退链。

### 6. setTimeout 必须 JS_DupValue

```cpp
JSValue callback = JS_DupValue(ctx, argv[0]);   // 增加引用计数
```

不 dup 的后果：

```text
setTimeout(function() { ... }, 1000)
    argv[0] 是这个匿名函数，引用计数为 1（栈上的临时引用）
    setTimeout 返回 → 临时引用释放 → 引用计数为 0 → GC 回收
    1 秒后 Timer 触发 → JS_Call 调用已释放的函数对象 → 崩溃
```

dup 之后引用计数为 2，栈引用释放后还剩 1（lambda 持有的），函数存活到回调执行。

对应地，三个路径都要释放：

```text
1. 回调正常执行后 → JS_FreeValue(ctx, callback)
2. 投递失败时     → if (id == kInvalidTimerId) JS_FreeValue(...)
3. Timer 被取消/loop 停止 → lambda 析构时随捕获的 JSValue 一起...
```

第 3 点是个已知的不完整处：lambda 析构不会自动调 `JS_FreeValue`（`JSValue` 是 POD 类型）。严格来说被取消的 Timer 的回调函数会泄漏，直到 `JS_FreeRuntime` 统一回收。

完整方案需要 RAII 包装：

```cpp
class ScopedJSValue {
    JSContext* ctx_; JSValue val_;
public:
    ~ScopedJSValue() { JS_FreeValue(ctx_, val_); }
};
```

V1 接受这个泄漏，因为 Runtime 销毁时 `JS_FreeRuntime` 会释放所有对象，不是持续泄漏。记录在这里，V2 补上 RAII 包装。

### 7. `native_module.h` 依赖 quickjs.h 的妥协

`MethodDef` 需要 `JSCFunction` 签名，绕不开引擎类型。彻底解耦需要：

```cpp
// 中间层签名
using NativeMethodFn = bool (*)(NativeCallContext& ctx);
// 加参数转换适配器
class NativeCallContext {
    int argCount() const;
    std::string getString(int index) const;
    void returnString(const std::string& v);
    // ... 十几个方法
};
```

工作量大（约 300 行 + 每个模块方法要改写），收益是换引擎时模块代码不用改。V1 判断换引擎是低概率事件，先接受妥协。

代价体现在 CMake 层面：`include/native_module.h` 是 PUBLIC，但它 include 的 `quickjs.h` 是 PRIVATE。平台层如果 include `native_module.h` 会编译失败。Step 11 会说明处理方式。

### 8. Router 的导航逻辑用回调注入

```cpp
using NavigateHandler = bool (*)(const char* uri, bool isBack);
void setNavigateHandler(NavigateHandler handler);
```

`RouterModule` 只维护页面栈，实际的页面加载（读 RPK → eval bundle → 构建 VNode → 渲染）需要 Step 08/09/10 的组件。

用回调注入而不是让 `RouterModule` 直接依赖它们，好处是：

```text
1. Step 07 可以独立测试（不需要 RPKLoader）
2. RouterModule 不依赖具体的加载实现，
   将来支持预加载、页面缓存时只改 handler
```

### 9. setInterval 不实现

快应用场景下 `setTimeout` 自递归可以替代：

```javascript
function tick() {
    doSomething();
    setTimeout(tick, 1000);
}
```

而 `setInterval` 需要额外处理：

```text
- 重复调度逻辑（EventLoop 的 Timer 是一次性的）
- 回调执行时间超过间隔时的堆积问题
- 页面切换时的自动清理
```

投入产出比不高，V1 跳过。JS 侧可以用 polyfill 补上。

---

## QA

### 1. 为什么 `$app_define$` 和 `$app_bootstrap$` 不用 C++ 实现

看它们的实际职责：

```javascript
// $app_define$ 做的事：把 factory 的产出存到一个 map 里
globalThis.$app_define$ = function(name, deps, factory) {
    const module = { exports: {} };
    factory($app_require$, module.exports, module);
    __components__[name] = module.exports;
};

// $app_bootstrap$ 做的事：从 map 取出定义，创建 VM 对象，调生命周期
globalThis.$app_bootstrap$ = function(name, options) {
    const def = __components__[name];
    const vm = Object.assign({}, def.private, def);
    if (vm.onInit) vm.onInit.call(vm);
    __native_render__(evalTemplate(def.template, vm), def.style);
};
```

全是 JS 对象操作，没有一处需要 native 能力。用 C++ 实现要：

```text
- 遍历 JSValue 对象树
- 手动管理每个 JSValue 的引用计数
- 处理原型链和 this 绑定
```

约 200 行 C++ 换 20 行 JS，且更容易出引用计数错误。所以放在 framework.js 里。

C++ 只提供 JS 做不到的：模块访问（`$app_require$`）、日志（`console`）、定时器（`setTimeout`）、渲染通知（`__native_render__`）。

### 2. 模块名为什么带 `@app-module/` 前缀

这是快应用规范定义的，来自编译产物。`.ux` 源码里写：

```javascript
import router from '@system.router';
```

工具链编译后变成：

```javascript
var router = $app_require$('@app-module/system.router');
```

Runtime 必须匹配编译产物的实际字符串，不能自己简化成 `"router"`，否则现有 RPK 跑不起来。这是"V1 兼容优先"原则的具体体现。

### 3. `JS_GetOpaque` 返回 nullptr 的情况

三种：

```text
1. classId 不匹配
   用 RouterModule::sClassId 去取 PromptModule 对象的 opaque → nullptr
   （QuickJS 会检查对象的 class 是否匹配）

2. registerClass 未调用
   sClassId 还是 0，取任何对象都返回 nullptr

3. this_val 不是模块对象
   JS 里写 router.push.call(null, {...}) → this 是 null → nullptr
```

所以每个 native 方法开头都要检查：

```cpp
auto* mod = self(thisVal);
if (mod == nullptr) return JS_FALSE;
```

### 4. `console.log` 输出中文会乱码吗

不会。QuickJS 内部用 UTF-8 存储字符串，`JS_ToCString` 返回 UTF-8 字节序列，`QA_LOGI` 用 `%s` 原样输出。

7.8.5 的验证里 `已保存: 欢迎体验快应用开发` 正确显示，证明整条链路（JS 字符串 → C++ std::string → 日志 → 终端）UTF-8 处理无误。

Android 侧要注意 logcat 的编码设置，但那是平台层的事（`__android_log_print` 本身支持 UTF-8）。

### 5. 多次调用 `installJSBridge` 会有问题吗

不会，是幂等的（覆盖式）：

```cpp
JS_SetPropertyStr(ctx, global, "$app_require$", JS_NewCFunction(...));
```

`JS_SetPropertyStr` 会替换已存在的属性，旧的函数对象引用计数减一后被 GC。

测试里的场景 7 就利用了这一点：为了换 EventLoop，第二次调用 `installJSBridge` 重新注入 `setTimeout`。

但有个隐患：`registerAllClasses` 会被重复调用。基类的 `registerClass` 有幂等检查（`if (classId_ != 0) return true`），所以不会重复分配 ClassID。

### 6. 模块方法抛异常会怎样

QuickJS 的 native 函数可以通过返回 exception 值来抛 JS 异常：

```cpp
static JSValue jsPush(...) {
    if (badArgs) {
        return JS_ThrowTypeError(ctx, "uri must be a string");
    }
}
```

本步的实现选择返回 `JS_FALSE` 而不是抛异常，原因：

```text
V1 兼容优先。现有快应用代码可能写：
    router.push({ uri: someVariable });   // someVariable 可能是 undefined
如果抛异常，整个 VM 方法中断，后续逻辑不执行。
返回 false 让 JS 代码能继续跑，行为更宽容。
```

V2 可以加严格模式选项，让参数错误抛异常，便于开发期发现问题。

### 7. `clear()` 为什么必须在 `engine->destroy()` 之前

```cpp
registry.clear();      // 先
engine->destroy();     // 后
```

模块的 `JSClass` 注册在 `JSContext` 里。虽然当前的 `moduleFinalizer` 是空的，但如果将来模块的析构函数需要清理 JS 侧资源（比如释放缓存的 JSValue），就必须在 `ctx` 还有效时执行。

反序的话：

```text
engine->destroy() → JS_FreeContext → ctx 失效
registry.clear() → 模块析构 → 尝试用已失效的 ctx → 崩溃
```

这个顺序约束写在了 `ModuleRegistry::clear()` 的注释里，Step 10 的 `RuntimeHost::destroy()` 会遵循。

### 8. 平台层能注册自己的模块吗

技术上可以，但当前有个障碍：`native_module.h` 需要 `quickjs.h`，而后者是 PRIVATE include。

平台层要注册模块需要：

```cmake
# Android 的 CMakeLists.txt 里额外加
target_include_directories(my-app PRIVATE
    ${CORE_DIR}/third_party/quickjs
)
```

这破坏了"平台层不知道 JS 引擎"的边界。Step 11 会讨论这个取舍。

更好的方案是 Core 提供一个不依赖 QuickJS 的注册接口（技术决策 7 提到的中间层），但那是 V2 的工作。

V1 的建议：所有系统能力模块都在 Core 里实现，平台只提供 `PlatformBridge` 函数。需要平台特有能力时，加一个 `PlatformBridge` 函数指针，Core 侧写一个模块转发过去（就像 `PromptModule` → `showToast` 那样）。

### 9. Step 07 完成后得到了什么

JS 和 C++ 之间的完整桥梁：

```text
✓ include/native_module.h + src/native_module.cpp    模块基类 + JSClass 注册
✓ include/module_registry.h + src/module_registry.cpp 注册表（O(1) 查找）
✓ include/js_bridge.h + src/js_bridge.cpp            全局注入
✓ src/router_module.cpp                              system.router（4 个方法 + 页面栈）
✓ src/prompt_module.cpp                              system.prompt（转发 PlatformBridge）
✓ tests/test_js_bridge.cpp                           4 组共 8 类场景全部通过
✓ ASan 验证无 JSValue 泄漏
✓ grep 验证 js_bridge.cpp 不含任何模块名（扩展性达标）
✓ 真实 page bundle 形态验证通过（含中文 UTF-8）
```

已注入的 JS 能力：

```text
$app_require$('@app-module/system.router')   → C++ RouterModule
$app_require$('@app-module/system.prompt')   → C++ PromptModule → PlatformBridge
console.log / warn / error / info / debug    → Core 日志
setTimeout / clearTimeout                    → EventLoop Timer
__native_render__                            → 桩，Step 09 接入
```

到这里 Core 的 JS 侧接口基本齐了。Step 08 让它能读 RPK，Step 09 让 `__native_render__` 真正产出渲染命令。

---

## 下一步

按 `tasks.md` 进入 Step 08：实现 `RPKLoader`（手写 ZIP 解析 + zlib inflate）和 `ManifestParser`（复用 QuickJS 的 JSON 解析），让 Core 能从内存字节数组加载快应用包。
