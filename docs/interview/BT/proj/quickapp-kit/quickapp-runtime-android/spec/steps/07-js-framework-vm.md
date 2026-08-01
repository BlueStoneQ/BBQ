# Step 7：JS Framework 与 VM 模型

## 目录

- [目标](#目标)
- [Step 7.1：实现 framework.js](#step-71实现-frameworkjs)
- [Step 7.2：C++ 侧加载 framework.js](#step-72c-侧加载-frameworkjs)
- [Step 7.3：验证](#step-73验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**实现 framework.js，完成组件注册、VM 创建、生命周期调用和渲染通知。**

| 层 | 职责 | 文件 |
|---|---|---|
| framework.js | JS 运行环境：组件注册、VM、生命周期 | `assets/framework.js` |
| C++ 加载 | eval framework.js | 在 RuntimeThread 中执行 |

**验收标准：**
- eval(framework.js) 成功，全局有 $app_define$/$app_bootstrap$/$app_require$
- eval(mock page bundle) 后 $app_define$ 和 $app_bootstrap$ 被正确调用
- VM 的 onInit 生命周期被调用
- `function() { return this.title }` 能求值为实际数据
- `__native_render__` 被调用并传入 template + style

**本步不包含：**
- 真实 RPK bundle 执行（Step 8）
- C++ VNode 树构建（Step 9）
- 数据响应式（V2 特性）

---

## Step 7.1：实现 framework.js

@add `app/src/main/assets/framework.js`（新建文件）

这个文件在 QuickJS 中首先被 eval，为后续的 app.js 和 page bundle 提供运行环境。

```javascript
/**
 * QuickApp Runtime Framework
 *
 * 职责：
 * 1. 管理组件注册表
 * 2. 创建 VM 实例（合并 data + methods）
 * 3. 调用生命周期（onInit、onShow）
 * 4. 解析 template 中的函数属性（数据绑定）
 * 5. 调用 __native_render__ 通知 C++ 渲染
 */

(function() {
    'use strict';

    // ============================================================
    // 组件注册表
    // ============================================================
    const __components__ = {};

    // ============================================================
    // $app_define$(name, deps, factory)
    //
    // 由 page bundle 调用，注册一个组件。
    // factory 接收 ($app_require$, $app_exports$, $app_module$)，
    // 执行后 module.exports 包含 template、style 和 VM 定义。
    // ============================================================
    globalThis.$app_define$ = function(name, deps, factory) {
        const exports = {};
        const module = { exports: exports };

        // 执行 factory，填充 module.exports
        factory($app_require$, exports, module);

        // 如果用了 ES Module 的 default export
        if (exports.__esModule && exports.default) {
            module.exports = exports.default;
        }

        __components__[name] = module.exports;
        console.log('[framework] $app_define$: ' + name);
    };

    // ============================================================
    // $app_bootstrap$(name, options)
    //
    // 由 page bundle 调用，启动已注册的组件。
    // 这里创建 VM 实例、调用生命周期、解析模板、通知渲染。
    // ============================================================
    globalThis.$app_bootstrap$ = function(name, options) {
        const comp = __components__[name];
        if (!comp) {
            console.error('[framework] Component not found: ' + name);
            return;
        }

        console.log('[framework] $app_bootstrap$: ' + name);

        // 如果是应用级组件（@app-application/app），只调 onCreate
        if (name.indexOf('@app-application') === 0) {
            if (comp.onCreate) comp.onCreate();
            return;
        }

        // ---- 页面/组件级 ----

        // 1. 创建 VM：合并 private 数据 + methods
        const vm = createVM(comp);

        // 2. 调用 onInit 生命周期
        if (vm.onInit) {
            vm.onInit.call(vm);
        }

        // 3. 解析 template 中的函数属性（数据绑定求值）
        const resolvedTemplate = resolveTemplate(comp.template, vm);

        // 4. 通知 C++ 开始渲染
        if (typeof __native_render__ === 'function') {
            __native_render__(resolvedTemplate, comp.style || {});
        }

        // 5. 调用 onShow
        if (vm.onShow) {
            vm.onShow.call(vm);
        }

        // 保存 VM 引用（后续事件回调需要找到 VM）
        comp.__vm__ = vm;
    };

    // ============================================================
    // $app_require$(moduleName)
    //
    // 加载系统模块。实际实现在 C++ native_app_require 中。
    // framework.js 中只是透传，不需要额外逻辑。
    // 如果 C++ 侧已经注入了 $app_require$，这里不覆盖。
    // ============================================================
    // $app_require$ 由 C++ installJSBridge 注入，framework.js 不覆盖。

    // ============================================================
    // VM 创建
    // ============================================================
    function createVM(comp) {
        const vm = {};

        // 合并 private 数据
        if (comp.private) {
            const data = typeof comp.private === 'function' ? comp.private() : comp.private;
            Object.assign(vm, data);
        }

        // 合并 public 数据
        if (comp.public) {
            Object.assign(vm, comp.public);
        }

        // 合并方法（onInit、onShow、自定义方法）
        for (const key in comp) {
            if (typeof comp[key] === 'function') {
                vm[key] = comp[key];
            }
        }

        // $page 对象（简化版）
        vm.$page = {
            setTitleBar: function(opts) {
                console.log('[framework] setTitleBar: ' + (opts.text || ''));
            }
        };

        return vm;
    }

    // ============================================================
    // 模板解析：将 function 属性求值为实际值
    // ============================================================
    function resolveTemplate(template, vm) {
        if (!template) return null;

        const resolved = {
            type: template.type,
            attr: {},
            classList: template.classList || [],
            children: [],
            events: template.events || {}
        };

        // 解析 attr：如果值是 function，以 vm 为 this 调用
        if (template.attr) {
            for (const key in template.attr) {
                const val = template.attr[key];
                if (typeof val === 'function') {
                    resolved.attr[key] = val.call(vm);
                } else {
                    resolved.attr[key] = val;
                }
            }
        }

        // 递归处理 children
        if (template.children) {
            for (let i = 0; i < template.children.length; i++) {
                resolved.children.push(resolveTemplate(template.children[i], vm));
            }
        }

        return resolved;
    }

    console.log('[framework] framework.js loaded');
})();
```

---

## Step 7.2：C++ 侧加载 framework.js

在 Runtime 初始化链路中，framework.js 必须在 app.js 和 page bundle 之前 eval。

@update `runtime_thread.cpp` 或新增 `core/src/runtime_bootstrap.cpp` — Runtime 启动序列：

```cpp
// Runtime 启动序列（在 RuntimeThread 中执行）
void bootstrapRuntime(JSEngine* engine, RPKLoader* loader, ModuleRegistry* registry) {
    // 1. 安装 JS Bridge（注入 $app_require$、console 等）
    installJSBridge(engine->getContext(), registry);

    // 2. 加载并执行 framework.js
    //    framework.js 放在 assets/ 中，通过 AssetManager 读取
    //    或者直接内嵌为 C++ 字符串常量
    std::string frameworkJs = loader->readText("framework.js");
    if (frameworkJs.empty()) {
        // fallback：从 assets 单独读取
        LOGE("framework.js not found in RPK, trying assets");
        // 需要从外部传入 framework.js 内容
    }
    engine->eval(frameworkJs.c_str(), "framework.js");

    // 3. 加载 app.js（Step 8）
    // 4. 加载入口页面 bundle（Step 8）
}
```

---

## Step 7.3：验证

用一个 mock bundle 测试完整流程（不依赖 RPK）：

```cpp
// 测试脚本：模拟一个最小页面 bundle
const char* mockBundle = R"(
    $app_define$('@app-component/test', [], function($app_require$, $app_exports$, $app_module$) {
        $app_module$.exports = {
            private: { title: '测试标题' },
            onInit: function() {
                console.log('onInit called, title=' + this.title);
            },
            onButtonClick: function() {
                console.log('Button clicked!');
            },
            template: {
                type: 'div',
                attr: {},
                classList: ['wrapper'],
                children: [
                    { type: 'text', attr: { value: function() { return this.title; } }, classList: ['title'] },
                    { type: 'input', attr: { type: 'button', value: '点击' }, classList: ['btn'], events: { click: 'onButtonClick' } }
                ]
            },
            style: {
                '.wrapper': { flexDirection: 'column' },
                '.title': { fontSize: '40px' }
            }
        };
        $app_module$.exports.template = $app_module$.exports.template;
        $app_module$.exports.style = $app_module$.exports.style;
    });
    $app_bootstrap$('@app-component/test', { packagerVersion: '2.1.0' });
)";

engine->eval(mockBundle, "mock_bundle.js");
```

**Logcat 预期：**

```text
I/quickapp-js: [console] [framework] framework.js loaded
I/quickapp-js: [console] [framework] $app_define$: @app-component/test
I/quickapp-js: [console] [framework] $app_bootstrap$: @app-component/test
I/quickapp-js: [console] onInit called, title=测试标题
I/quickapp-js: [console] [framework] setTitleBar: 
I/quickapp-bridge: __native_render__ called
```

---

## 技术决策

### 1. framework.js 在 C++ 注入之后 eval

顺序：installJSBridge() → eval(framework.js) → eval(app.js) → eval(page bundle)。framework.js 依赖 C++ 注入的 `$app_require$` 和 `__native_render__`。

### 2. VM 是 plain object

V1 不做数据响应式（不实现 Vue-like 的 reactive proxy）。VM 就是一个普通对象，属性直接读写。后续 V2 如果需要数据变更触发重渲染，再加 Proxy/defineProperty。

### 3. 函数属性求值用 .call(vm)

`attr.value = function() { return this.title }` 中的 `this` 必须指向 VM 对象。`val.call(vm)` 确保 this 绑定正确。

### 4. framework.js 放在 assets 而非内嵌

方便调试和热更新。开发时修改 framework.js 不需要重新编译 C++。生产环境可以改为 C++ 内嵌字符串（减少文件 IO）。

---

## QA

### 1. framework.js 和 C++ 的 $app_define$ 是什么关系？

C++ 注入的 `native_app_define` 只做日志记录。真正的组件注册逻辑在 framework.js 的 `$app_define$` 中——它覆盖了 C++ 的版本。或者两者配合：C++ 先注入一个基础版本，framework.js 增强它。

当前设计：framework.js 的 `$app_define$` 是完整实现，C++ 的只是 fallback/日志。

### 2. resolveTemplate 为什么在 JS 侧做？

因为函数属性 `function() { return this.title }` 是 JS 闭包，必须在 JS 上下文中以 VM 为 this 调用。C++ 没法直接执行一个 JS function 对象。

### 3. 如果 VM 数据变更了，怎么更新 UI？

V1 不支持。首次渲染后 UI 不会自动更新。V2 可以加 `vm.$set()` 或 Proxy 监听变更，触发 re-render。

---

## 下一步

Step 7 完成后得到：framework.js 能创建 VM、调用生命周期、解析模板数据绑定并通知 C++ 渲染。下一步 Step 8 用真实 RPK bundle 替代 mock bundle。
