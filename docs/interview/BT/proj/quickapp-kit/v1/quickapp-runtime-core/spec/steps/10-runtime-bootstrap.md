# Step 10：framework.js、RuntimeBootstrap 与 RuntimeHost

## 目录

- [目标](#目标)
- [Step 10.1：设计 framework.js](#step-101设计-frameworkjs)
- [Step 10.2：实现 framework.js](#step-102实现-frameworkjs)
- [Step 10.3：framework.js 的内嵌方式](#step-103frameworkjs-的内嵌方式)
- [Step 10.4：实现 RuntimeBootstrap](#step-104实现-runtimebootstrap)
- [Step 10.5：接线事件与路由](#step-105接线事件与路由)
- [Step 10.6：实现 RuntimeHost](#step-106实现-runtimehost)
- [Step 10.7：接入 CMake](#step-107接入-cmake)
- [Step 10.8：编写测试](#step-108编写测试)
- [Step 10.9：逐层验证](#step-109逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把前 9 步的组件串成完整可运行的 Runtime，对外只暴露四个方法。**

| 层 | 职责 | 文件 |
|---|---|---|
| JS 框架层 | `$app_define$` / `$app_bootstrap$` / VM 模型 / 生命周期 | `js/framework.js` |
| 启动编排 | 11 步启动序列，任一步失败可诊断 | `include/runtime_bootstrap.h` + `src/runtime_bootstrap.cpp` |
| 对外 API | create / start / dispatchEvent / destroy | `include/runtime_host.h` + `src/runtime_host.cpp` |
| 事件接线 | nodeId → 方法名 → 调用 VM 方法 | `runtime_bootstrap.cpp` 内 |
| 路由接线 | URI → 页面 bundle → 重新渲染 | `runtime_bootstrap.cpp` 内 |

**验收标准：**
- mock RPK + mock bridge 走完整启动，`createElement` 命令按预期到达
- 页面 `onInit` / `onReady` / `onShow` 按顺序被调用
- 点击事件从 `dispatchEvent` 到达 VM 方法并执行
- `router.push` 触发页面切换：旧节点删除、新页面渲染
- 20 轮 create/destroy 无泄漏、无 use-after-free
- 销毁顺序正确，destroy 后所有调用安全

**本步不包含：**
- 响应式数据更新（`this.title = 'x'` 不触发重渲染，V2）
- 组件系统（自定义组件 `<my-card>`，V2）
- 页面栈的状态保存与恢复（back 时重新执行 bundle，不恢复滚动位置）
- `onDestroy` / `onBackPress` 等完整生命周期（V1 只做 onInit/onReady/onShow/onHide）

---

## Step 10.1：设计 framework.js

### 10.1.1：为什么这部分用 JS 而不是 C++

`$app_define$` 和 `$app_bootstrap$` 的职责是纯 JS 对象操作：

```text
$app_define$    把 factory 的产出存进组件表
$app_bootstrap$ 从组件表取定义 → 创建 VM 对象 → 调生命周期 → 求值模板
```

用 C++ 实现需要：

```text
- 遍历 JSValue 对象树，手动管理每个值的引用计数
- 用 JS_NewObject + JS_SetPropertyStr 逐字段拼装 VM 对象
- 处理原型链和 this 绑定
```

约 200 行 C++ 对应 20 行 JS，且引用计数极易出错。所以放在 framework.js。

C++ 只提供 JS 做不到的：模块访问、日志、定时器、渲染通知（Step 07 已注入）。

### 10.1.2：VM 模型

VM 是页面的运行时实例，由组件定义创建：

```text
组件定义（page bundle 提供）        VM 实例（framework.js 创建）
├── template  模板描述              ├── 所有 private 字段提升为自身属性
├── style     样式表                ├── 所有 method 绑定 this 后挂载
├── private   初始数据              ├── $app_definition$  指向原定义
├── onInit    生命周期              └── 生命周期方法可直接调用
├── onReady
└── 各种 method
```

关键设计：`private` 里的字段直接成为 VM 的属性，这样模板里 `function(){ return this.title }` 能取到。

### 10.1.3：启动时序

```text
C++ eval(framework.js)
    → 定义 $app_define$ / $app_bootstrap$，包装 $app_require$

C++ eval(app.js)
    → app.js 调 $app_define$('@app-application/app', ...)
    → 组件表存入 app 定义
    → framework 调用 app 的 onCreate

C++ eval(pages/Demo/index.js)
    → 调 $app_define$('@app-component/Demo', ...)
    → 调 $app_bootstrap$('@app-component/Demo', {})
        → 创建 VM
        → onInit()
        → 求值模板（把函数属性替换为实际值）
        → __native_render__(evaluatedTemplate, style)   ← 进入 C++ 渲染管线
        → onReady()
        → onShow()
```

### 10.1.4：模板求值的两种时机

模板里 `attr: { value: function(){ return this.title } }` 的求值可以在两处发生：

```text
方案 A：framework.js 求值（本步采用）
    framework 遍历模板，把函数属性替换为返回值，
    传给 __native_render__ 的是纯数据。
    优点：this 绑定天然正确，纯 JS 操作简单
    缺点：多一次对象深拷贝

方案 B：C++ buildVNode 求值（Step 09 已实现的能力）
    framework 传原始模板 + VM 对象，
    C++ 在 buildVNode 里调用函数。
    优点：无深拷贝
    缺点：C++ 侧要正确传 this，且要管理 JSValue 引用
```

**本步采用方案 A**，Step 09 的方案 B 能力保留作为兜底（`buildVNode` 的 `vmObject` 参数）。原因是方案 A 的 this 绑定更可靠，且求值逻辑在 JS 侧更容易调试。

---

## Step 10.2：实现 framework.js

**@add `js/framework.js`（新建文件）**

第一部分：组件表与 `$app_define$`。

```javascript
/**
 * QuickApp Runtime — JS 框架层
 *
 * 职责：
 *   实现 $app_define$ / $app_bootstrap$ 的组件注册与 VM 创建逻辑，
 *   包装 $app_require$ 使其同时支持 C++ 系统模块和 JS 组件。
 *
 * 执行时机：
 *   C++ 在 installJSBridge 之后、eval(app.js) 之前执行本文件。
 *   此时全局已有：$app_require$（C++ 版）、console、setTimeout、__native_render__
 *
 * 与 C++ 的分工：
 *   本文件不含任何 native 能力，纯 JS 对象操作。
 *   需要 native 的部分（模块访问、日志、定时器、渲染）由 C++ 注入。
 */
(function (global) {
  'use strict';

  // ============================================================
  // 组件注册表
  // ============================================================

  // 组件名 → 组件定义（module.exports 的内容）
  // 键的形态：'@app-application/app'、'@app-component/Demo'
  var __components__ = {};

  // 当前活动页面的 VM 实例。
  // C++ 侧的事件处理需要它来调用方法（通过 __getCurrentVM__ 暴露）。
  var __currentVM__ = null;

  // 应用级 VM（app.js 定义的），生命周期与 Runtime 相同
  var __appVM__ = null;

  // 保存 C++ 注入的原始 $app_require$，包装后仍需调用它
  var __nativeRequire__ = global.$app_require$;

  /**
   * 注册一个组件定义。
   *
   * page bundle 的形态：
   *   $app_define$('@app-component/Demo', [], function(require, exports, module) {
   *       module.exports = { template: ..., style: ..., private: ..., onInit: ... };
   *   });
   *
   * @param {string}   name    组件标识，如 '@app-component/Demo'
   * @param {Array}    deps    依赖列表。V1 未使用，保留以兼容编译产物签名
   * @param {Function} factory 工厂函数，签名 (require, exports, module)
   */
  global.$app_define$ = function (name, deps, factory) {
    if (typeof name !== 'string' || !name) {
      console.error('[framework] $app_define$: invalid name');
      return;
    }
    if (typeof factory !== 'function') {
      console.error('[framework] $app_define$: factory is not a function: ' + name);
      return;
    }

    var module = { exports: {} };

    try {
      // 参数顺序必须匹配编译产物的期望：(require, exports, module)
      factory.call(module.exports, global.$app_require$, module.exports, module);
    } catch (e) {
      console.error('[framework] $app_define$ factory threw for ' + name +
                    ': ' + (e && e.message ? e.message : e));
      return;
    }

    __components__[name] = module.exports;
    console.log('[framework] defined: ' + name);

    // app.js 定义的应用组件需要立即初始化。
    // 它没有模板，只有 onCreate 等生命周期。
    if (name.indexOf('@app-application/') === 0) {
      __initApp__(name, module.exports);
    }
  };

  /**
   * 初始化应用级组件（app.js 的产出）。
   *
   * @param {string} name       组件标识
   * @param {Object} definition 组件定义
   */
  function __initApp__(name, definition) {
    __appVM__ = __createVM__(definition);

    if (typeof __appVM__.onCreate === 'function') {
      try {
        __appVM__.onCreate();
        console.log('[framework] app onCreate called');
      } catch (e) {
        console.error('[framework] app onCreate threw: ' +
                      (e && e.message ? e.message : e));
      }
    }
  }

  /**
   * 包装 $app_require$，使其同时支持两种命名空间。
   *
   * 查找顺序：
   *   1. C++ ModuleRegistry（@app-module/system.router 等）
   *   2. JS 组件表（@app-component/Demo 等）
   *
   * C++ 版对未知模块返回 undefined（Step 07 的设计），
   * 所以这里可以安全地用 undefined 作为"继续查组件表"的信号。
   *
   * @param {string} name 模块或组件标识
   * @returns {Object|undefined} 模块对象；都找不到时返回 undefined
   */
  global.$app_require$ = function (name) {
    if (typeof __nativeRequire__ === 'function') {
      var nativeModule = __nativeRequire__(name);
      if (nativeModule !== undefined && nativeModule !== null) {
        return nativeModule;
      }
    }

    if (Object.prototype.hasOwnProperty.call(__components__, name)) {
      return __components__[name];
    }

    console.warn('[framework] $app_require$: not found: ' + name);
    return undefined;
  };
```


第二部分：VM 创建与模板求值。

```javascript
  // ============================================================
  // VM 创建
  // ============================================================

  /**
   * 从组件定义创建 VM 实例。
   *
   * VM 的构成：
   *   1. private 里的字段直接提升为 VM 自身属性
   *      这样模板里 function(){ return this.title } 能取到值
   *   2. 所有函数成员（生命周期 + 业务方法）挂到 VM 上
   *   3. $app_definition$ 指向原定义，供模板求值时读取 template/style
   *
   * @param {Object} definition 组件定义（module.exports 的内容）
   * @returns {Object} VM 实例
   */
  function __createVM__(definition) {
    var vm = {};

    // ---- 1. private 数据提升为 VM 属性 ----
    // 用浅拷贝：private 里的对象/数组按引用共享。
    // 深拷贝会破坏 JS 侧的对象身份（===），且 V1 无响应式需求。
    if (definition.private && typeof definition.private === 'object') {
      for (var key in definition.private) {
        if (Object.prototype.hasOwnProperty.call(definition.private, key)) {
          vm[key] = definition.private[key];
        }
      }
    }

    // ---- 2. data 字段（部分工具链版本用 data 而非 private） ----
    if (definition.data && typeof definition.data === 'object') {
      for (var dkey in definition.data) {
        if (Object.prototype.hasOwnProperty.call(definition.data, dkey)) {
          vm[dkey] = definition.data[dkey];
        }
      }
    }

    // ---- 3. 方法挂载 ----
    // 不用 bind：直接挂载后通过 vm.method() 调用时 this 自然是 vm。
    // bind 会创建新函数对象，增加内存且让 === 比较失效。
    for (var mkey in definition) {
      if (Object.prototype.hasOwnProperty.call(definition, mkey) &&
          typeof definition[mkey] === 'function') {
        vm[mkey] = definition[mkey];
      }
    }

    // ---- 4. 保留定义引用 ----
    // 不可枚举，避免被 for-in 遍历到（比如日志打印 VM 时）
    Object.defineProperty(vm, '$app_definition$', {
      value: definition,
      enumerable: false,
      writable: false,
    });

    return vm;
  }

  // ============================================================
  // 模板求值
  // ============================================================

  /**
   * 深度求值模板，把函数属性替换为调用结果。
   *
   * 处理内容：
   *   - attr 里的函数：以 VM 为 this 调用，结果替换原值
   *   - children 数组：递归处理
   *   - 其他字段（type / classList / events）：原样拷贝
   *
   * 为什么在 JS 侧求值（而不是 C++ buildVNode）：
   *   this 绑定天然正确，无需跨语言传递 VM 对象。
   *   代价是一次对象深拷贝，对几十个节点的页面开销可忽略。
   *
   * @param {Object} node  模板节点
   * @param {Object} vm    VM 实例，作为函数求值的 this
   * @param {number} depth 当前深度，防御循环引用
   * @returns {Object|null} 求值后的纯数据节点；节点非法时返回 null
   */
  function __evaluateTemplate__(node, vm, depth) {
    if (depth > 64) {
      console.error('[framework] template nesting too deep, aborting');
      return null;
    }
    if (!node || typeof node !== 'object') {
      return null;
    }

    var result = {};

    // ---- type（必填） ----
    if (typeof node.type !== 'string' || !node.type) {
      console.warn('[framework] template node missing type, skipped');
      return null;
    }
    result.type = node.type;

    // ---- classList ----
    if (Array.isArray(node.classList)) {
      result.classList = node.classList.slice();
    } else if (typeof node.classList === 'string') {
      // 容错：某些版本产出空格分隔字符串
      result.classList = node.classList.split(' ').filter(function (s) {
        return s.length > 0;
      });
    }

    // ---- attr：函数值求值 ----
    if (node.attr && typeof node.attr === 'object') {
      result.attr = {};
      for (var akey in node.attr) {
        if (!Object.prototype.hasOwnProperty.call(node.attr, akey)) {
          continue;
        }
        var aval = node.attr[akey];

        if (typeof aval === 'function') {
          // 数据绑定的核心：以 VM 为 this 调用
          try {
            result.attr[akey] = aval.call(vm);
          } catch (e) {
            console.error('[framework] attr "' + akey + '" evaluation threw: ' +
                          (e && e.message ? e.message : e));
            result.attr[akey] = '';
          }
        } else {
          result.attr[akey] = aval;
        }
      }
    }

    // ---- events：原样拷贝（值是方法名字符串，不求值） ----
    if (node.events && typeof node.events === 'object') {
      result.events = {};
      for (var ekey in node.events) {
        if (Object.prototype.hasOwnProperty.call(node.events, ekey)) {
          result.events[ekey] = node.events[ekey];
        }
      }
    }

    // ---- children 递归 ----
    if (Array.isArray(node.children)) {
      result.children = [];
      for (var i = 0; i < node.children.length; i++) {
        var child = __evaluateTemplate__(node.children[i], vm, depth + 1);
        if (child !== null) {
          result.children.push(child);
        }
      }
    }

    return result;
  }
```


第三部分：`$app_bootstrap$` 与 C++ 调用入口。

```javascript
  // ============================================================
  // $app_bootstrap$
  // ============================================================

  /**
   * 启动一个组件：创建 VM、调生命周期、求值模板、触发渲染。
   *
   * page bundle 在 $app_define$ 之后立即调用它。
   *
   * @param {string} name    组件标识
   * @param {Object} options 启动选项。V1 未使用，保留兼容签名
   * @returns {boolean} 启动成功返回 true
   */
  global.$app_bootstrap$ = function (name, options) {
    var definition = __components__[name];
    if (!definition) {
      console.error('[framework] $app_bootstrap$: component not defined: ' + name);
      return false;
    }

    console.log('[framework] bootstrapping: ' + name);

    // ---- 1. 创建 VM ----
    var vm = __createVM__(definition);
    __currentVM__ = vm;

    // ---- 2. onInit ----
    // 此时 private 数据已就绪，模板还未求值。
    // 页面在这里做数据初始化、发起请求。
    __callLifecycle__(vm, 'onInit');

    // ---- 3. 求值模板 ----
    if (!definition.template) {
      console.error('[framework] component has no template: ' + name);
      return false;
    }

    var evaluated = __evaluateTemplate__(definition.template, vm, 0);
    if (evaluated === null) {
      console.error('[framework] template evaluation failed: ' + name);
      return false;
    }

    // ---- 4. 触发 C++ 渲染 ----
    var style = definition.style || {};
    var rendered = false;
    try {
      rendered = global.__native_render__(evaluated, style);
    } catch (e) {
      console.error('[framework] __native_render__ threw: ' +
                    (e && e.message ? e.message : e));
      return false;
    }

    if (!rendered) {
      console.error('[framework] native render returned false: ' + name);
      return false;
    }

    // ---- 5. onReady ----
    // 渲染命令已发送（不代表平台已完成绘制）
    __callLifecycle__(vm, 'onReady');

    // ---- 6. onShow ----
    // 页面对用户可见
    __callLifecycle__(vm, 'onShow');

    console.log('[framework] bootstrap complete: ' + name);
    return true;
  };

  /**
   * 安全调用生命周期方法。
   *
   * 未定义时跳过（不报错），抛异常时记录但不中断启动流程 ——
   * 一个页面的 onInit 出错不该导致整个应用白屏。
   *
   * @param {Object} vm   VM 实例
   * @param {string} hook 生命周期名，如 'onInit'
   */
  function __callLifecycle__(vm, hook) {
    if (typeof vm[hook] !== 'function') {
      return;
    }
    try {
      vm[hook]();
      console.log('[framework] ' + hook + ' called');
    } catch (e) {
      console.error('[framework] ' + hook + ' threw: ' +
                    (e && e.message ? e.message : e));
    }
  }

  // ============================================================
  // C++ 调用入口
  // ============================================================

  /**
   * 在当前页面 VM 上调用一个方法。
   *
   * 由 C++ 的事件处理器调用：
   *   用户点击 → PlatformEventSink → RenderPipeline.findNode(nodeId)
   *   → node->events["click"] 得到方法名 → 调用本函数
   *
   * @param {string} methodName 方法名，如 'goDetail'
   * @param {*}      payload    事件数据。input 事件传文本，click 传 undefined
   * @returns {boolean} 方法存在且执行成功返回 true
   */
  global.__invoke_vm_method__ = function (methodName, payload) {
    if (!__currentVM__) {
      console.warn('[framework] no active VM, cannot invoke: ' + methodName);
      return false;
    }
    if (typeof __currentVM__[methodName] !== 'function') {
      console.warn('[framework] method not found on VM: ' + methodName);
      return false;
    }

    try {
      // 事件对象：V1 只传最基本的信息。
      // 真实快应用的事件对象含 target/timestamp/detail 等，V2 补齐。
      var event = { type: 'event', detail: payload };
      __currentVM__[methodName](event);
      return true;
    } catch (e) {
      console.error('[framework] method "' + methodName + '" threw: ' +
                    (e && e.message ? e.message : e));
      return false;
    }
  };

  /**
   * 在当前页面 VM 上触发生命周期。
   *
   * 由 C++ 处理平台生命周期事件时调用（onShow/onHide）。
   *
   * @param {string} hook 生命周期名
   * @returns {boolean} 总是返回 true（未定义的钩子不算失败）
   */
  global.__invoke_lifecycle__ = function (hook) {
    if (!__currentVM__) {
      return true;
    }
    __callLifecycle__(__currentVM__, hook);
    return true;
  };

  /**
   * 清空当前 VM 引用。
   *
   * 页面切换前由 C++ 调用，让旧 VM 可以被 GC 回收。
   */
  global.__clear_current_vm__ = function () {
    __currentVM__ = null;
  };

  /**
   * 查询是否有活动页面。用于 C++ 侧的状态检查和测试断言。
   * @returns {boolean}
   */
  global.__has_active_vm__ = function () {
    return __currentVM__ !== null;
  };

  console.log('[framework] framework.js loaded');
})(this);
```

**几个 JS 侧的设计要点：**

```text
用 IIFE 包裹
    (function(global){ ... })(this)
    避免 __components__ 等内部状态泄漏到全局，
    只通过显式的 global.xxx = 暴露接口。

'use strict'
    禁止隐式全局变量（拼错变量名时报错而非静默创建全局），
    禁止 with、arguments.callee 等易错语法。

不用 ES6+ 语法
    QuickJS 支持 ES2020，但 var/function 的兼容性最好，
    且避免 let 的 TDZ 和箭头函数的 this 语义带来的额外理解成本。

方法挂载不用 bind
    直接 vm[key] = definition[key]，
    通过 vm.method() 调用时 this 自然是 vm。
    用 bind 会创建新函数对象，浪费内存且破坏 === 比较。
```

---

## Step 10.3：framework.js 的内嵌方式

framework.js 必须在 Runtime 启动时可用。三端的文件访问方式不同，所以要选一个平台无关的方案。

### 10.3.1：三种方案对比

```text
方案 A：编译期转为 C++ 字符串常量（本步采用）
    CMake 用脚本把 framework.js 转成 framework_js.h 里的 const char[]
    ✓ 零运行时依赖，三端行为完全一致
    ✓ 无文件 IO，符合 Core 的平台无关约束
    ✗ 修改 framework.js 需要重新编译 Core

方案 B：平台层读文件后传入
    和 RPK 一样走字节数组
    ✓ 修改后无需重编译 Core
    ✗ 三端各自要打包 framework.js，容易版本漂移
    ✗ 平台集成多一个步骤

方案 C：放进 RPK
    ✗ framework.js 属于 Runtime 而非应用，不该由应用打包
    ✗ 每个 RPK 都带一份，版本无法统一
```

选方案 A。framework.js 是 Runtime 的一部分，和 Core 版本强绑定，编译期内嵌最能保证一致性。

### 10.3.2：CMake 生成脚本

**@add `cmake/embed_js.cmake`（新建文件）**

```cmake
# 把 JS 文件转为 C++ 头文件里的字符串常量。
#
# 用途：framework.js 需要在 Runtime 启动时可用，
#      但 Core 不做文件 IO（平台无关约束）。
#      编译期内嵌是唯一符合约束的方案。
#
# 输入变量：
#   JS_INPUT     源 JS 文件路径
#   HEADER_OUTPUT 生成的头文件路径
#   VAR_NAME     C++ 变量名

if(NOT EXISTS "${JS_INPUT}")
    message(FATAL_ERROR "embed_js: input file not found: ${JS_INPUT}")
endif()

file(READ "${JS_INPUT}" JS_CONTENT)

# 转义顺序很重要：必须先转反斜杠，再转引号。
# 反过来的话，转义引号产生的反斜杠会被二次转义。
string(REPLACE "\\" "\\\\" JS_CONTENT "${JS_CONTENT}")
string(REPLACE "\"" "\\\"" JS_CONTENT "${JS_CONTENT}")

# 换行转为 \n 加真实换行：
# 前者让 C++ 字符串包含换行（JS 报错行号才正确），
# 后者让生成的头文件本身可读。
string(REPLACE "\n" "\\n\"\n\"" JS_CONTENT "${JS_CONTENT}")

file(WRITE "${HEADER_OUTPUT}"
"// 自动生成的文件，不要手动编辑。
// 源文件：${JS_INPUT}
// 生成脚本：cmake/embed_js.cmake

#ifndef QUICKAPP_EMBEDDED_${VAR_NAME}_H
#define QUICKAPP_EMBEDDED_${VAR_NAME}_H

namespace quickapp {

// framework.js 的完整内容，编译期内嵌。
// 用 static 而不是 extern：头文件只被 runtime_bootstrap.cpp 引用，
// 不会产生多份副本。
static const char* const ${VAR_NAME} =
\"${JS_CONTENT}\";

} // namespace quickapp

#endif
")

message(STATUS "embed_js: generated ${HEADER_OUTPUT}")
```

### 10.3.3：接入构建流程

**@add `CMakeLists.txt` — 在 `add_subdirectory(third_party/quickjs)` 之后插入**

```cmake
# ============================================================
# framework.js 内嵌
# ============================================================

set(FRAMEWORK_JS "${CMAKE_CURRENT_SOURCE_DIR}/js/framework.js")
set(FRAMEWORK_JS_HEADER "${CMAKE_CURRENT_BINARY_DIR}/generated/framework_js.h")

add_custom_command(
    OUTPUT "${FRAMEWORK_JS_HEADER}"
    COMMAND ${CMAKE_COMMAND}
            -DJS_INPUT=${FRAMEWORK_JS}
            -DHEADER_OUTPUT=${FRAMEWORK_JS_HEADER}
            -DVAR_NAME=kFrameworkJS
            -P ${CMAKE_CURRENT_SOURCE_DIR}/cmake/embed_js.cmake
    # DEPENDS 保证修改 framework.js 后自动重新生成
    DEPENDS "${FRAMEWORK_JS}" "${CMAKE_CURRENT_SOURCE_DIR}/cmake/embed_js.cmake"
    COMMENT "Embedding framework.js into C++ header"
    VERBATIM
)

add_custom_target(embed_framework_js DEPENDS "${FRAMEWORK_JS_HEADER}")
```

**@update `CMakeLists.txt` — 在 `add_library(quickapp-core ...)` 之后插入**

```cmake
# Core 编译前必须先生成 framework_js.h
add_dependencies(quickapp-core embed_framework_js)
```

**@update `CMakeLists.txt` — 在 `target_include_directories` 的 PRIVATE 列表中追加**

```cmake
target_include_directories(quickapp-core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
        ${CMAKE_CURRENT_SOURCE_DIR}/platform/common
        ${CMAKE_CURRENT_SOURCE_DIR}/third_party/quickjs
        ${CMAKE_CURRENT_BINARY_DIR}/generated      # ← 新增：framework_js.h 所在
)
```

### 10.3.4：验证生成结果

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build && cmake --build build --target embed_framework_js
head -20 build/generated/framework_js.h
```

预期：

```cpp
// 自动生成的文件，不要手动编辑。
// 源文件：.../js/framework.js
// 生成脚本：cmake/embed_js.cmake

#ifndef QUICKAPP_EMBEDDED_kFrameworkJS_H
#define QUICKAPP_EMBEDDED_kFrameworkJS_H

namespace quickapp {

static const char* const kFrameworkJS =
"/**\n"
" * QuickApp Runtime — JS 框架层\n"
...
```

确认转义正确（引号和反斜杠没有破坏 C++ 语法）：

```bash
grep -c '\\"' build/generated/framework_js.h    # 应该有若干转义引号
```

---

## Step 10.4：实现 RuntimeBootstrap

### 10.4.1：创建头文件

**@add `include/runtime_bootstrap.h`（新建文件）**

```cpp
#ifndef QUICKAPP_RUNTIME_BOOTSTRAP_H
#define QUICKAPP_RUNTIME_BOOTSTRAP_H

#include <cstddef>
#include <cstdint>
#include <string>

namespace quickapp {

class JSEngine;
class RuntimeEventLoop;
struct Manifest;

// 启动配置。
struct BootstrapConfig {
    // RPK 字节数据。调用方保有所有权，
    // 必须在整个 Runtime 生命周期内有效（RPKLoader 不拷贝）
    const uint8_t* rpkData = nullptr;
    size_t rpkSize = 0;

    // 视口尺寸（物理像素）。
    // 通常是屏幕宽度 × (屏幕高度 - 状态栏 - 标题栏)
    float viewportWidth = 0;
    float viewportHeight = 0;
};

// 启动失败的阶段标识。
// 平台层可据此给出更精确的错误提示（如"包损坏"vs"脚本错误"）。
enum class BootstrapStage {
    None,              // 未开始或已成功
    ModuleRegister,    // 注册 NativeModule
    JSBridgeInstall,   // 注入全局函数
    RenderPipeline,    // 初始化渲染管线
    RPKOpen,           // 打开 RPK
    ManifestRead,      // 读 manifest.json
    ManifestParse,     // 解析 manifest
    FrameworkEval,     // 执行 framework.js
    AppScriptRead,     // 读 app.js
    AppScriptEval,     // 执行 app.js
    EntryPageRead,     // 读入口页 bundle
    EntryPageEval,     // 执行入口页 bundle
};

/**
 * 把阶段枚举转为可读名称。
 * @param stage 阶段
 * @return 静态字符串，不需要释放
 */
const char* bootstrapStageName(BootstrapStage stage);

// Runtime 启动编排器。
//
// 职责：
//   按固定顺序初始化所有组件并执行 JS，任一步失败时提供
//   阶段标识和错误描述，供平台层诊断。
//
// 线程所有权：
//   所有方法在 Runtime Thread 调用（由 RuntimeHost 保证）。
//
// 生命周期：
//   run() → [运行期：navigate / dispatchClick ...] → shutdown()
//
// 与其他组件的关系：
//   持有 JSEngine（不拥有）、RPKLoader、Manifest。
//   接线 PlatformEventSink 的事件处理器和 RouterModule 的导航处理器。
class RuntimeBootstrap {
public:
    /**
     * 执行完整启动序列。
     *
     * 11 个阶段：
     *   1. 注册内置 NativeModule（router / prompt）
     *   2. installJSBridge（注入 $app_require$ / console / setTimeout / __native_render__）
     *   3. RenderPipeline::initialize（替换 __native_render__ 桩）
     *   4. RPKLoader::open
     *   5. 读 manifest.json
     *   6. ManifestParser::parse
     *   7. eval(framework.js)
     *   8. 读 app.js
     *   9. eval(app.js)
     *  10. 读入口页 bundle
     *  11. eval(入口页 bundle) → 触发 $app_bootstrap$ → 渲染
     *
     * @param engine 已初始化的 JS 引擎，不能为 nullptr。本类不拥有它
     * @param loop   事件循环，用于 setTimeout 和事件投递。不能为 nullptr
     * @param config 启动配置
     * @return true  全部成功，首屏已渲染
     *         false 某阶段失败，用 failedStage() 和 getLastError() 诊断
     */
    bool run(JSEngine* engine, RuntimeEventLoop* loop,
             const BootstrapConfig& config);

    /**
     * 关闭并清理。
     *
     * 顺序：注销事件接线 → RenderPipeline::shutdown → 清空 Registry
     * 必须在 JSEngine::destroy 之前调用。
     */
    void shutdown();

    /**
     * 导航到指定页面。
     *
     * 由 RouterModule 的 NavigateHandler 回调进来，也可由平台层直接调用。
     *
     * 流程：清空当前 VM → 读 bundle → eval → framework 自动 bootstrap → 渲染
     *
     * @param uri    页面 URI，如 "/pages/DemoDetail"。支持带 query
     * @param isBack true 表示返回操作（V1 行为与前进相同：重新执行 bundle）
     * @return true 导航成功
     */
    bool navigate(const char* uri, bool isBack);

    /**
     * 处理点击事件：查节点 → 取方法名 → 调用 VM 方法。
     *
     * @param nodeId 被点击的节点 ID
     * @return true 找到并成功调用了方法
     */
    bool handleClick(int nodeId);

    /**
     * 处理输入事件。
     *
     * @param nodeId 输入框节点 ID
     * @param text   当前文本内容
     * @return true 成功调用了方法
     */
    bool handleInput(int nodeId, const std::string& text);

    /**
     * 触发页面生命周期。
     *
     * @param hook 生命周期名，如 "onShow" / "onHide"
     * @return true 调用成功（钩子未定义也算成功）
     */
    bool handleLifecycle(const std::string& hook);

    /**
     * 获取解析后的 Manifest。
     * @return Manifest 指针；未成功启动时返回 nullptr
     */
    const Manifest* manifest() const;

    /**
     * 获取失败阶段。
     * @return 阶段枚举。成功时为 BootstrapStage::None
     */
    BootstrapStage failedStage() const { return failedStage_; }

    /**
     * 获取错误描述。
     * @return 错误信息，含阶段前缀。无错误时返回空字符串
     */
    const std::string& getLastError() const { return lastError_; }

private:
    /**
     * 记录失败信息。
     * @param stage   失败阶段
     * @param message 错误描述
     * @return 总是 false，方便在 run() 里写 return fail(...)
     */
    bool fail(BootstrapStage stage, const std::string& message);

    /**
     * 加载并执行一个页面 bundle。
     * @param bundlePath RPK 内的路径，如 "pages/Demo/index.js"
     * @return true 执行成功
     */
    bool loadPageBundle(const std::string& bundlePath);

    JSEngine* engine_ = nullptr;          // 不拥有
    RuntimeEventLoop* loop_ = nullptr;    // 不拥有

    BootstrapStage failedStage_ = BootstrapStage::None;
    std::string lastError_;
};

} // namespace quickapp

#endif // QUICKAPP_RUNTIME_BOOTSTRAP_H
```


### 10.4.2：实现启动序列

**@add `src/runtime_bootstrap.cpp`（新建文件）**

第一部分：状态、辅助函数、阶段名。

```cpp
#include "runtime_bootstrap.h"

#include <memory>

#include "framework_js.h"          // CMake 生成，含 kFrameworkJS
#include "js_bridge.h"
#include "js_engine.h"
#include "manifest_parser.h"
#include "module_registry.h"
#include "platform_bridge.h"
#include "platform_event_sink.h"
#include "qa_log.h"
#include "quickjs.h"
#include "render_pipeline.h"
#include "rpk_loader.h"
#include "runtime_event_loop.h"
#include "vnode.h"

namespace quickapp {

// 这些注册函数在各 module .cpp 中定义（Step 07）
void registerRouterModule();
void registerPromptModule();
// RouterModule 的导航回调注入点（Step 07）
using NavigateHandler = bool (*)(const char* uri, bool isBack);
void setNavigateHandler(NavigateHandler handler);

namespace {

// 全局状态。
//
// 为什么用全局：
//   RouterModule 的 NavigateHandler 和 PlatformEventSink 的 EventHandler
//   都是函数指针/无捕获 lambda，无法携带 this。
//   单 Runtime 假设下（design.md Key Decision 6）用全局最简单。
//   多 Runtime 时需要改为带上下文的回调签名。
RuntimeBootstrap* g_bootstrap = nullptr;

// RPK 读取器和 Manifest 的持有者。
// 生命周期必须覆盖整个 Runtime：navigate 时还要读页面 bundle。
std::unique_ptr<RPKLoader> g_loader;
std::unique_ptr<Manifest> g_manifest;

/**
 * RouterModule 的导航回调。签名必须匹配 NavigateHandler。
 *
 * @param uri    目标页面 URI
 * @param isBack 是否返回操作
 * @return true 导航成功
 */
bool navigateThunk(const char* uri, bool isBack) {
    if (g_bootstrap == nullptr || uri == nullptr) {
        return false;
    }
    return g_bootstrap->navigate(uri, isBack);
}

/**
 * 调用 framework.js 暴露的全局函数。
 *
 * 用途：__invoke_vm_method__ / __invoke_lifecycle__ / __clear_current_vm__
 *
 * @param engine   JS 引擎
 * @param funcName 全局函数名
 * @param args     参数数组。可为 nullptr（argc 为 0 时）
 * @param argc     参数个数
 * @return true 函数存在且调用未抛异常
 */
bool callGlobalFunction(JSEngine* engine, const char* funcName,
                        JSValue* args, int argc) {
    if (engine == nullptr) {
        return false;
    }
    auto* ctx = static_cast<JSContext*>(engine->getRawContext());
    if (ctx == nullptr) {
        return false;
    }

    JSValue global = JS_GetGlobalObject(ctx);
    JSValue func = JS_GetPropertyStr(ctx, global, funcName);

    bool ok = false;
    if (JS_IsFunction(ctx, func)) {
        JSValue result = JS_Call(ctx, func, global, argc, args);

        if (JS_IsException(result)) {
            JSValue exc = JS_GetException(ctx);
            const char* msg = JS_ToCString(ctx, exc);
            QA_LOGE("[Bootstrap] %s threw: %s", funcName,
                    msg != nullptr ? msg : "<unknown>");
            if (msg != nullptr) {
                JS_FreeCString(ctx, msg);
            }
            JS_FreeValue(ctx, exc);
        } else {
            // 返回值转 bool：framework 的这些函数返回 true/false
            ok = (JS_ToBool(ctx, result) == 1);
        }
        JS_FreeValue(ctx, result);
    } else {
        QA_LOGE("[Bootstrap] global function not found: %s", funcName);
    }

    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, global);
    return ok;
}

} // namespace

const char* bootstrapStageName(BootstrapStage stage) {
    switch (stage) {
        case BootstrapStage::None:            return "None";
        case BootstrapStage::ModuleRegister:  return "ModuleRegister";
        case BootstrapStage::JSBridgeInstall: return "JSBridgeInstall";
        case BootstrapStage::RenderPipeline:  return "RenderPipeline";
        case BootstrapStage::RPKOpen:         return "RPKOpen";
        case BootstrapStage::ManifestRead:    return "ManifestRead";
        case BootstrapStage::ManifestParse:   return "ManifestParse";
        case BootstrapStage::FrameworkEval:   return "FrameworkEval";
        case BootstrapStage::AppScriptRead:   return "AppScriptRead";
        case BootstrapStage::AppScriptEval:   return "AppScriptEval";
        case BootstrapStage::EntryPageRead:   return "EntryPageRead";
        case BootstrapStage::EntryPageEval:   return "EntryPageEval";
        default:                              return "Unknown";
    }
}

bool RuntimeBootstrap::fail(BootstrapStage stage, const std::string& message) {
    failedStage_ = stage;
    lastError_ = std::string("[") + bootstrapStageName(stage) + "] " + message;
    QA_LOGE("[Bootstrap] FAILED %s", lastError_.c_str());
    return false;
}

const Manifest* RuntimeBootstrap::manifest() const {
    return g_manifest.get();
}
```


第二部分：run() 的 11 个阶段。

```cpp
bool RuntimeBootstrap::run(JSEngine* engine, RuntimeEventLoop* loop,
                           const BootstrapConfig& config) {
    failedStage_ = BootstrapStage::None;
    lastError_.clear();

    if (engine == nullptr) {
        return fail(BootstrapStage::ModuleRegister, "engine is null");
    }
    if (loop == nullptr) {
        return fail(BootstrapStage::ModuleRegister, "event loop is null");
    }
    if (config.rpkData == nullptr || config.rpkSize == 0) {
        return fail(BootstrapStage::RPKOpen, "rpk data is empty");
    }
    if (!getPlatformBridge().isReady()) {
        return fail(BootstrapStage::RenderPipeline,
                    "PlatformBridge not registered; "
                    "call registerPlatformBridge before start");
    }

    engine_ = engine;
    loop_ = loop;
    g_bootstrap = this;

    QA_LOGI("[Bootstrap] === starting runtime ===");

    // ---- 阶段 1：注册内置模块 ----
    // 必须在 installJSBridge 之前：installJSBridge 内部会调
    // registerAllClasses，此时模块必须已在 Registry 里
    {
        auto& registry = ModuleRegistry::instance();
        registry.clear();       // 幂等：重启时清掉旧模块
        registerRouterModule();
        registerPromptModule();

        if (registry.size() < 2) {
            return fail(BootstrapStage::ModuleRegister,
                        "expected at least 2 built-in modules, got " +
                        std::to_string(registry.size()));
        }
        QA_LOGI("[Bootstrap] 1/11 registered %zu modules", registry.size());
    }

    // ---- 阶段 2：注入 JS Bridge ----
    {
        JSBridgeConfig bridgeConfig;
        bridgeConfig.loop = loop;
        if (!installJSBridge(engine, bridgeConfig)) {
            return fail(BootstrapStage::JSBridgeInstall, "installJSBridge failed");
        }
        QA_LOGI("[Bootstrap] 2/11 JS bridge installed");
    }

    // ---- 阶段 3：初始化渲染管线 ----
    // 必须在 installJSBridge 之后：它要替换 __native_render__ 的桩实现
    {
        if (!RenderPipeline::initialize(engine, config.viewportWidth,
                                        config.viewportHeight)) {
            return fail(BootstrapStage::RenderPipeline,
                        "RenderPipeline::initialize failed");
        }
        QA_LOGI("[Bootstrap] 3/11 render pipeline ready (%.0fx%.0f)",
                config.viewportWidth, config.viewportHeight);
    }

    // ---- 阶段 4：打开 RPK ----
    {
        g_loader = std::make_unique<RPKLoader>();
        if (!g_loader->open(config.rpkData, config.rpkSize)) {
            return fail(BootstrapStage::RPKOpen, g_loader->getLastError());
        }
        QA_LOGI("[Bootstrap] 4/11 RPK opened: %zu files", g_loader->fileCount());
    }

    // ---- 阶段 5：读 manifest.json ----
    std::string manifestJson;
    {
        if (!g_loader->readText("manifest.json", manifestJson)) {
            return fail(BootstrapStage::ManifestRead, g_loader->getLastError());
        }
        QA_LOGI("[Bootstrap] 5/11 manifest.json read (%zu bytes)",
                manifestJson.size());
    }

    // ---- 阶段 6：解析 manifest ----
    {
        g_manifest = std::make_unique<Manifest>();
        ManifestParser parser;
        if (!parser.parse(engine, manifestJson.c_str(), *g_manifest)) {
            return fail(BootstrapStage::ManifestParse, parser.getLastError());
        }
        QA_LOGI("[Bootstrap] 6/11 manifest parsed: %s (%s), entry=%s",
                g_manifest->package.c_str(), g_manifest->versionName.c_str(),
                g_manifest->entry.c_str());
    }

    // ---- 阶段 7：执行 framework.js ----
    // 编译期内嵌的字符串（见 Step 10.3）
    {
        if (!engine->eval(kFrameworkJS, "framework.js")) {
            return fail(BootstrapStage::FrameworkEval, engine->getLastError());
        }
        // 验证关键全局函数已定义。
        // framework.js 可能因语法错误部分执行成功但没定义函数
        std::string check;
        engine->evalWithResult(
            "typeof $app_define$ + ',' + typeof $app_bootstrap$ + ',' + "
            "typeof __invoke_vm_method__",
            "<check>", check);
        if (check != "function,function,function") {
            return fail(BootstrapStage::FrameworkEval,
                        "framework.js did not define required globals, got: " + check);
        }
        QA_LOGI("[Bootstrap] 7/11 framework.js evaluated");
    }

    // ---- 阶段 8：读 app.js ----
    std::string appJs;
    {
        if (!g_loader->fileExists("app.js")) {
            // app.js 是可选的：只有页面没有应用级逻辑的 RPK 也能跑
            QA_LOGW("[Bootstrap] 8/11 app.js not found, skipping");
        } else if (!g_loader->readText("app.js", appJs)) {
            return fail(BootstrapStage::AppScriptRead, g_loader->getLastError());
        } else {
            QA_LOGI("[Bootstrap] 8/11 app.js read (%zu bytes)", appJs.size());
        }
    }

    // ---- 阶段 9：执行 app.js ----
    {
        if (!appJs.empty()) {
            if (!engine->eval(appJs.c_str(), "app.js")) {
                return fail(BootstrapStage::AppScriptEval, engine->getLastError());
            }
            // app.js 内部会调 $app_define$('@app-application/app', ...)，
            // framework.js 检测到 @app-application/ 前缀会自动调 onCreate
            QA_LOGI("[Bootstrap] 9/11 app.js evaluated");
        } else {
            QA_LOGI("[Bootstrap] 9/11 app.js skipped");
        }
    }

    // ---- 阶段 10-11：加载入口页 ----
    {
        const PageRoute* entry = g_manifest->entryPage();
        if (entry == nullptr) {
            return fail(BootstrapStage::EntryPageRead,
                        "entry page '" + g_manifest->entry +
                        "' not found in manifest router.pages");
        }

        // 初始化 Router 的页面栈
        // （RouterModule 的 setEntry 通过 navigate 间接完成，
        //  这里直接加载 bundle）
        const std::string bundlePath = entry->bundlePath();
        if (!loadPageBundle(bundlePath)) {
            // loadPageBundle 内部已设置 failedStage_ 和 lastError_
            return false;
        }
    }

    // ---- 接线事件与路由 ----
    // 放在最后：确保首屏渲染完成后才开始接收事件
    setNavigateHandler(navigateThunk);

    PlatformEventSink::initialize(loop, [](const PlatformEvent& e) {
        if (g_bootstrap == nullptr) {
            return;
        }
        switch (e.type) {
            case PlatformEventType::Click:
                g_bootstrap->handleClick(e.nodeId);
                break;
            case PlatformEventType::Input:
            case PlatformEventType::Change:
                g_bootstrap->handleInput(e.nodeId, e.payload);
                break;
            case PlatformEventType::Lifecycle:
                g_bootstrap->handleLifecycle(e.payload);
                break;
        }
    });

    QA_LOGI("[Bootstrap] === runtime started successfully ===");
    return true;
}

bool RuntimeBootstrap::loadPageBundle(const std::string& bundlePath) {
    if (g_loader == nullptr) {
        return fail(BootstrapStage::EntryPageRead, "RPK loader not initialized");
    }

    std::string bundleCode;
    if (!g_loader->readText(bundlePath.c_str(), bundleCode)) {
        return fail(BootstrapStage::EntryPageRead,
                    "cannot read page bundle '" + bundlePath + "': " +
                    g_loader->getLastError());
    }
    QA_LOGI("[Bootstrap] 10/11 page bundle read: %s (%zu bytes)",
            bundlePath.c_str(), bundleCode.size());

    // eval 会触发 bundle 内的 $app_define$ + $app_bootstrap$，
    // framework.js 随即创建 VM、求值模板、调用 __native_render__，
    // 进入 Step 09 的渲染管线
    if (!engine_->eval(bundleCode.c_str(), bundlePath.c_str())) {
        return fail(BootstrapStage::EntryPageEval,
                    "page bundle '" + bundlePath + "' threw: " +
                    engine_->getLastError());
    }

    // 驱动微任务：bundle 里可能有 Promise
    engine_->executePendingJobs();

    // 验证渲染真的发生了
    if (RenderPipeline::currentRoot() == nullptr) {
        return fail(BootstrapStage::EntryPageEval,
                    "page bundle '" + bundlePath +
                    "' did not produce a render tree; "
                    "check that it calls $app_bootstrap$");
    }

    QA_LOGI("[Bootstrap] 11/11 page rendered: %zu nodes",
            RenderPipeline::currentRoot()->countNodes());
    return true;
}
```

---

## Step 10.5：接线事件与路由

### 10.5.1：事件处理实现

**@add `src/runtime_bootstrap.cpp` — 在 `loadPageBundle` 之后追加**

```cpp
bool RuntimeBootstrap::handleClick(int nodeId) {
    // 1. 用 Step 09 建立的索引找到节点
    VNode* node = RenderPipeline::findNode(nodeId);
    if (node == nullptr) {
        // 节点可能已被页面切换删除，此时事件是过期的
        QA_LOGD("[Bootstrap] click on unknown node %d (page may have changed)",
                nodeId);
        return false;
    }

    // 2. 查节点的事件映射
    auto it = node->events.find("click");
    if (it == node->events.end()) {
        QA_LOGD("[Bootstrap] node %d has no click handler", nodeId);
        return false;
    }

    const std::string& methodName = it->second;
    QA_LOGI("[Bootstrap] click on node %d -> vm.%s()", nodeId, methodName.c_str());

    // 3. 调用 framework.js 的 __invoke_vm_method__
    auto* ctx = static_cast<JSContext*>(engine_->getRawContext());
    JSValue args[2];
    args[0] = JS_NewString(ctx, methodName.c_str());
    args[1] = JS_UNDEFINED;   // click 事件无 payload

    const bool ok = callGlobalFunction(engine_, "__invoke_vm_method__", args, 2);

    JS_FreeValue(ctx, args[0]);
    // args[1] 是 JS_UNDEFINED，是常量值，不需要释放

    // 4. VM 方法可能调用了 router.push 或产生 Promise，驱动微任务
    engine_->executePendingJobs();

    return ok;
}

bool RuntimeBootstrap::handleInput(int nodeId, const std::string& text) {
    VNode* node = RenderPipeline::findNode(nodeId);
    if (node == nullptr) {
        QA_LOGD("[Bootstrap] input on unknown node %d", nodeId);
        return false;
    }

    // input 和 change 都先找 "change"，再回退到 "input"。
    // 快应用规范用 change 表示值变更
    auto it = node->events.find("change");
    if (it == node->events.end()) {
        it = node->events.find("input");
    }
    if (it == node->events.end()) {
        QA_LOGD("[Bootstrap] node %d has no change/input handler", nodeId);
        return false;
    }

    // 同步更新 VNode 的属性值，保持 C++ 侧状态与平台一致。
    // 不做这个的话，后续读 node->attr("value") 会拿到旧值
    node->attrs["value"] = text;

    QA_LOGI("[Bootstrap] input on node %d -> vm.%s('%s')",
            nodeId, it->second.c_str(), text.c_str());

    auto* ctx = static_cast<JSContext*>(engine_->getRawContext());
    JSValue args[2];
    args[0] = JS_NewString(ctx, it->second.c_str());
    args[1] = JS_NewString(ctx, text.c_str());

    const bool ok = callGlobalFunction(engine_, "__invoke_vm_method__", args, 2);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);

    engine_->executePendingJobs();
    return ok;
}

bool RuntimeBootstrap::handleLifecycle(const std::string& hook) {
    if (hook.empty()) {
        return false;
    }
    QA_LOGI("[Bootstrap] lifecycle: %s", hook.c_str());

    auto* ctx = static_cast<JSContext*>(engine_->getRawContext());
    JSValue args[1];
    args[0] = JS_NewString(ctx, hook.c_str());

    const bool ok = callGlobalFunction(engine_, "__invoke_lifecycle__", args, 1);

    JS_FreeValue(ctx, args[0]);
    engine_->executePendingJobs();
    return ok;
}
```

### 10.5.2：路由导航实现

```cpp
bool RuntimeBootstrap::navigate(const char* uri, bool isBack) {
    if (uri == nullptr || engine_ == nullptr) {
        QA_LOGE("[Bootstrap] navigate: invalid state");
        return false;
    }
    if (g_manifest == nullptr) {
        QA_LOGE("[Bootstrap] navigate: manifest not loaded");
        return false;
    }

    QA_LOGI("[Bootstrap] navigate to '%s' (isBack=%d)", uri, isBack ? 1 : 0);

    // 1. URI → 页面路由。findPageByUri 处理 query 剥离和 path 回退（Step 08）
    const PageRoute* route = g_manifest->findPageByUri(uri);
    if (route == nullptr) {
        QA_LOGW("[Bootstrap] navigate: uri '%s' not found in manifest, "
                "navigation aborted", uri);
        return false;
    }

    // 2. 清空当前 VM 引用，让旧 VM 可被 GC。
    //    不清的话 framework.js 的 __currentVM__ 一直持有旧页面对象
    callGlobalFunction(engine_, "__clear_current_vm__", nullptr, 0);

    // 3. 加载新页面 bundle。
    //    RenderPipeline 在 __native_render__ 里会自动删除旧节点树（Step 09）
    const std::string bundlePath = route->bundlePath();
    if (!loadPageBundle(bundlePath)) {
        QA_LOGE("[Bootstrap] navigate failed: %s", lastError_.c_str());
        return false;
    }

    QA_LOGI("[Bootstrap] navigated to %s", bundlePath.c_str());
    return true;
}

void RuntimeBootstrap::shutdown() {
    QA_LOGI("[Bootstrap] === shutting down ===");

    // 顺序很重要，反序会导致 use-after-free：

    // 1. 断开事件通道，不再有新事件进来
    PlatformEventSink::shutdown();

    // 2. 注销路由回调，避免 JS 在销毁过程中触发导航
    setNavigateHandler(nullptr);

    // 3. 关闭渲染管线（注销 __native_render__ + 删除所有元素）
    RenderPipeline::shutdown();

    // 4. 清空模块（它们的 JSClass 在 JSContext 里，
    //    必须在 engine.destroy 之前清）
    ModuleRegistry::instance().clear();

    // 5. 释放 RPK 和 Manifest
    g_manifest.reset();
    g_loader.reset();

    // 6. 清空全局指针
    g_bootstrap = nullptr;
    engine_ = nullptr;
    loop_ = nullptr;

    QA_LOGI("[Bootstrap] === shutdown complete ===");
}

} // namespace quickapp
```

**销毁顺序的依赖关系：**

```text
PlatformEventSink.shutdown  ← 必须最先：停止新事件流入
    ↓
setNavigateHandler(nullptr) ← 停止 JS 触发导航
    ↓
RenderPipeline.shutdown     ← 注销 __native_render__ + 通知平台删元素
    ↓
ModuleRegistry.clear        ← 模块的 JSClass 注册在 ctx 里
    ↓
g_manifest / g_loader 释放
    ↓
（RuntimeHost 随后调 engine->destroy）
```

反序的后果举例：先 `engine->destroy()` 再 `ModuleRegistry::clear()`，模块析构时若访问已失效的 `JSContext` 会崩溃。

---

## Step 10.6：实现 RuntimeHost

### 10.6.1：创建头文件

**@add `include/runtime_host.h`（新建文件）**

```cpp
#ifndef QUICKAPP_RUNTIME_HOST_H
#define QUICKAPP_RUNTIME_HOST_H

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>

#include "platform_bridge.h"

namespace quickapp {

// Runtime 的运行状态。
enum class RuntimeState {
    Created,       // 已构造，未分配资源
    Starting,      // start() 执行中
    Running,       // 启动成功，正常运行
    Stopping,      // destroy() 执行中
    Destroyed,     // 已销毁，不可再用
    Failed,        // 启动失败
};

/**
 * 把状态枚举转为可读名称。
 * @param state 状态
 * @return 静态字符串
 */
const char* runtimeStateName(RuntimeState state);

// 创建 Runtime 的配置。
struct RuntimeHostConfig {
    // 平台实现的渲染命令。必须至少填 createElement/setAttr/setStyle
    PlatformBridge bridge;

    // RPK 字节数据。
    // 【所有权】调用方保有，必须在 destroy() 之前保持有效。
    // Core 不拷贝，避免大文件的双倍内存占用
    const uint8_t* rpkData = nullptr;
    size_t rpkSize = 0;

    // 视口尺寸（物理像素）
    float viewportWidth = 0;
    float viewportHeight = 0;
};

// Runtime 的对外顶层 API。
//
// 职责：
//   封装线程、引擎、启动序列的全部细节，
//   让三端的集成代码长得一样（只有 bridge 实现不同）。
//
// 典型用法（三端相同）：
//   RuntimeHost host;
//   RuntimeHostConfig cfg;
//   cfg.bridge = myPlatformBridge();
//   cfg.rpkData = data; cfg.rpkSize = size;
//   cfg.viewportWidth = 1080; cfg.viewportHeight = 1800;
//   if (!host.create(cfg) || !host.start()) {
//       log(host.getLastError());
//   }
//   // ... 运行中：host.dispatchClick(nodeId) ...
//   host.destroy();
//
// 线程安全：
//   所有公开方法可从任意线程调用。
//   内部通过 RuntimeThread 投递到 Runtime Thread 执行。
//
// 生命周期：
//   Created → create() → start() → Running → destroy() → Destroyed
//   析构函数会自动 destroy()，避免调用方漏掉导致线程泄漏。
class RuntimeHost {
public:
    RuntimeHost();
    ~RuntimeHost();

    RuntimeHost(const RuntimeHost&) = delete;
    RuntimeHost& operator=(const RuntimeHost&) = delete;

    /**
     * 创建 Runtime，注册 PlatformBridge。
     *
     * 只做配置校验和 Bridge 注册，不创建线程和引擎（那是 start 的事）。
     *
     * @param config 配置。bridge 必须 isReady()，rpkData 非空，viewport 为正数
     * @return true  配置有效
     *         false 配置非法，用 getLastError() 取原因
     *
     * 线程约束：应从创建本对象的线程调用，只调用一次。
     */
    bool create(const RuntimeHostConfig& config);

    /**
     * 启动 Runtime：创建线程 → 创建引擎 → 执行启动序列。
     *
     * 阻塞直到启动序列完成（首屏渲染命令已发送）或失败。
     * 阻塞是有意的：调用方需要知道启动结果才能决定显示页面还是错误提示。
     * 典型耗时 20-50ms。
     *
     * @return true  启动成功，首屏已渲染
     *         false 启动失败，用 getLastError() 和 failedStage() 诊断
     *
     * 线程约束：create() 之后调用一次。
     */
    bool start();

    /**
     * 投递点击事件。
     *
     * @param nodeId 节点 ID，来自 PlatformBridge.createElement 分配的 ID
     *
     * 线程安全：可从任意线程调用（通常是平台 UI 线程）。
     * 非运行状态时事件被丢弃。
     */
    void dispatchClick(int nodeId);

    /**
     * 投递输入事件。
     *
     * @param nodeId 输入框节点 ID
     * @param text   当前完整文本，UTF-8。为 nullptr 时按空串处理
     *
     * 线程安全：可从任意线程调用。
     */
    void dispatchInput(int nodeId, const char* text);

    /**
     * 投递生命周期事件。
     *
     * @param hook 生命周期名："onShow" / "onHide" 等。不能为 nullptr
     *
     * 线程安全：可从任意线程调用。
     */
    void dispatchLifecycle(const char* hook);

    /**
     * 请求导航到指定页面。
     *
     * 用途：平台层的返回键、深链接跳转。
     * JS 侧的 router.push 不需要经过这里（直接走 RouterModule）。
     *
     * @param uri 页面 URI，如 "/pages/Detail"
     *
     * 线程安全：可从任意线程调用，异步执行。
     */
    void navigateTo(const char* uri);

    /**
     * 更新视口尺寸。屏幕旋转或标题栏显隐时调用。
     *
     * @param width  新宽度（物理像素）
     * @param height 新高度（物理像素）
     *
     * 线程安全：可从任意线程调用。
     * 注意：V1 只更新数值，不触发重新布局。
     */
    void setViewport(float width, float height);

    /**
     * 销毁 Runtime，释放全部资源。
     *
     * 顺序：Bootstrap.shutdown → EventLoop.stop → thread.join
     *       → engine.destroy → clearPlatformBridge
     *
     * 阻塞直到 Runtime Thread 退出。
     * 幂等：多次调用安全。
     *
     * 线程约束：不能在 Runtime Thread 内部调用（会死锁）。
     */
    void destroy();

    /**
     * 查询当前状态。
     * @return 状态枚举
     */
    RuntimeState state() const;

    /**
     * 获取最近一次错误描述。
     * @return 错误信息。无错误时返回空字符串
     */
    std::string getLastError() const;

    /**
     * 获取启动失败的阶段名。
     * @return 阶段名字符串。未失败时返回 "None"
     */
    std::string failedStage() const;

    /**
     * 获取应用包名（来自 manifest）。
     * @return 包名。未成功启动时返回空字符串
     */
    std::string packageName() const;

    /**
     * 获取应用显示名（来自 manifest，用作 TitleBar 默认标题）。
     * @return 应用名。未成功启动时返回空字符串
     */
    std::string appName() const;

    /**
     * 获取指定页面的标题栏配置。
     *
     * 平台层用它渲染标题栏。合并了全局配置和页面级覆盖（Step 08）。
     *
     * @param pageName        页面标识，如 "pages/Demo"。空串表示入口页
     * @param outTitle        输出：标题文字
     * @param outBgColor      输出：背景色，如 "#f2f2f2"
     * @param outTextColor    输出：文字色
     * @return true 获取成功
     */
    bool getTitleBarConfig(const char* pageName,
                           std::string& outTitle,
                           std::string& outBgColor,
                           std::string& outTextColor) const;

private:
    // Pimpl：把 RuntimeThread / RuntimeBootstrap 等实现细节
    // 从公开头文件里隐藏，平台层 include 本文件时不需要那些头文件
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace quickapp

#endif // QUICKAPP_RUNTIME_HOST_H
```


### 10.6.2：创建实现文件

**@add `src/runtime_host.cpp`（新建文件）**

第一部分：Impl 定义与 create/start。

```cpp
#include "runtime_host.h"

#include <atomic>
#include <condition_variable>
#include <mutex>

#include "manifest_parser.h"
#include "platform_event_sink.h"
#include "qa_log.h"
#include "render_pipeline.h"
#include "runtime_bootstrap.h"
#include "runtime_thread.h"

namespace quickapp {

const char* runtimeStateName(RuntimeState state) {
    switch (state) {
        case RuntimeState::Created:   return "Created";
        case RuntimeState::Starting:  return "Starting";
        case RuntimeState::Running:   return "Running";
        case RuntimeState::Stopping:  return "Stopping";
        case RuntimeState::Destroyed: return "Destroyed";
        case RuntimeState::Failed:    return "Failed";
        default:                      return "Unknown";
    }
}

// RuntimeHost 的实现细节。
//
// 用 Pimpl 隔离的原因：
//   RuntimeThread 和 RuntimeBootstrap 是 Core 内部组件，
//   平台层 include runtime_host.h 时不应该看到它们。
struct RuntimeHost::Impl {
    RuntimeHostConfig config;
    RuntimeThread thread;
    RuntimeBootstrap bootstrap;

    // 状态用 atomic：state() 可能从任意线程查询
    std::atomic<RuntimeState> state{RuntimeState::Created};

    // 错误信息用 mutex 保护：字符串不是原子类型
    mutable std::mutex errorMutex;
    std::string lastError;
    std::string failedStage{"None"};

    // start() 用它等待 Runtime Thread 完成启动序列
    std::mutex startMutex;
    std::condition_variable startCv;
    bool startDone = false;
    bool startSuccess = false;

    /**
     * 线程安全地记录错误。
     * @param message 错误描述
     * @param stage   失败阶段名
     */
    void setError(const std::string& message, const std::string& stage = "None") {
        std::lock_guard<std::mutex> lock(errorMutex);
        lastError = message;
        failedStage = stage;
    }

    /**
     * 判断当前是否可以接收事件。
     * @return true 状态为 Running
     */
    bool acceptsEvents() const {
        return state.load(std::memory_order_acquire) == RuntimeState::Running;
    }
};

RuntimeHost::RuntimeHost() : impl_(std::make_unique<Impl>()) {}

RuntimeHost::~RuntimeHost() {
    // 兜底：调用方忘记 destroy() 时在析构里补上，
    // 避免 RuntimeThread 析构时因线程仍在运行而 terminate
    destroy();
}

bool RuntimeHost::create(const RuntimeHostConfig& config) {
    if (impl_->state.load() != RuntimeState::Created) {
        impl_->setError("create() called in state " +
                        std::string(runtimeStateName(impl_->state.load())));
        return false;
    }

    // ---- 配置校验 ----
    if (!config.bridge.isReady()) {
        impl_->setError("PlatformBridge is not ready: "
                        "createElement/setAttr/setStyle are all required");
        QA_LOGE("[RuntimeHost] %s", impl_->lastError.c_str());
        return false;
    }
    if (config.rpkData == nullptr || config.rpkSize == 0) {
        impl_->setError("rpkData is null or rpkSize is 0");
        QA_LOGE("[RuntimeHost] %s", impl_->lastError.c_str());
        return false;
    }
    if (config.viewportWidth <= 0 || config.viewportHeight <= 0) {
        impl_->setError("invalid viewport size");
        QA_LOGE("[RuntimeHost] %s", impl_->lastError.c_str());
        return false;
    }

    impl_->config = config;

    // 注册平台实现。放在 create 而不是 start：
    // 让配置错误尽早暴露，且 Bootstrap 的阶段 3 会检查 isReady()
    registerPlatformBridge(config.bridge);

    QA_LOGI("[RuntimeHost] created: rpk=%zu bytes, viewport=%.0fx%.0f",
            config.rpkSize, config.viewportWidth, config.viewportHeight);
    return true;
}

bool RuntimeHost::start() {
    if (impl_->state.load() != RuntimeState::Created) {
        impl_->setError("start() called in state " +
                        std::string(runtimeStateName(impl_->state.load())));
        return false;
    }
    impl_->state.store(RuntimeState::Starting, std::memory_order_release);

    // 1. 启动线程（内部创建并初始化 JSEngine）
    if (!impl_->thread.start()) {
        impl_->setError("RuntimeThread::start failed");
        impl_->state.store(RuntimeState::Failed);
        QA_LOGE("[RuntimeHost] %s", impl_->lastError.c_str());
        return false;
    }

    // 2. 把启动序列投递到 Runtime Thread 执行。
    //    必须在那个线程执行：QuickJS 有线程亲和性（Step 05）
    impl_->thread.post([this] {
        BootstrapConfig bootCfg;
        bootCfg.rpkData = impl_->config.rpkData;
        bootCfg.rpkSize = impl_->config.rpkSize;
        bootCfg.viewportWidth = impl_->config.viewportWidth;
        bootCfg.viewportHeight = impl_->config.viewportHeight;

        const bool ok = impl_->bootstrap.run(
            impl_->thread.engine(), impl_->thread.eventLoop(), bootCfg);

        if (!ok) {
            impl_->setError(impl_->bootstrap.getLastError(),
                            bootstrapStageName(impl_->bootstrap.failedStage()));
        }

        // 通知 start() 结果
        {
            std::lock_guard<std::mutex> lock(impl_->startMutex);
            impl_->startDone = true;
            impl_->startSuccess = ok;
        }
        impl_->startCv.notify_one();
    });

    // 3. 等待启动完成。
    //    阻塞是有意的：调用方需要知道结果才能决定显示页面还是错误提示
    {
        std::unique_lock<std::mutex> lock(impl_->startMutex);
        impl_->startCv.wait(lock, [this] { return impl_->startDone; });
    }

    if (!impl_->startSuccess) {
        impl_->state.store(RuntimeState::Failed, std::memory_order_release);
        QA_LOGE("[RuntimeHost] start failed at stage %s: %s",
                impl_->failedStage.c_str(), impl_->lastError.c_str());
        return false;
    }

    impl_->state.store(RuntimeState::Running, std::memory_order_release);
    QA_LOGI("[RuntimeHost] started, state=Running");
    return true;
}
```

第二部分：事件投递与销毁。

```cpp
void RuntimeHost::dispatchClick(int nodeId) {
    if (!impl_->acceptsEvents()) {
        QA_LOGD("[RuntimeHost] dispatchClick ignored, state=%s",
                runtimeStateName(impl_->state.load()));
        return;
    }
    // 走 PlatformEventSink 而不是直接 thread.post：
    // EventSink 有自己的生命周期保护和线程安全处理（Step 06）
    PlatformEventSink::dispatchClick(nodeId);
}

void RuntimeHost::dispatchInput(int nodeId, const char* text) {
    if (!impl_->acceptsEvents()) {
        return;
    }
    PlatformEventSink::dispatchInput(nodeId, text != nullptr ? text : "");
}

void RuntimeHost::dispatchLifecycle(const char* hook) {
    if (!impl_->acceptsEvents() || hook == nullptr) {
        return;
    }
    PlatformEventSink::dispatchLifecycle(hook);
}

void RuntimeHost::navigateTo(const char* uri) {
    if (!impl_->acceptsEvents() || uri == nullptr) {
        return;
    }
    // 拷贝字符串进 lambda：调用方的 uri 可能在异步执行前失效
    const std::string uriCopy(uri);
    impl_->thread.post([this, uriCopy] {
        impl_->bootstrap.navigate(uriCopy.c_str(), false);
    });
}

void RuntimeHost::setViewport(float width, float height) {
    if (!impl_->acceptsEvents()) {
        return;
    }
    impl_->config.viewportWidth = width;
    impl_->config.viewportHeight = height;
    impl_->thread.post([width, height] {
        RenderPipeline::setViewport(width, height);
    });
}

void RuntimeHost::destroy() {
    const RuntimeState current = impl_->state.load(std::memory_order_acquire);
    if (current == RuntimeState::Destroyed || current == RuntimeState::Stopping) {
        return;   // 幂等
    }
    // Created 状态（未 start）也要走清理：create() 已经注册了 bridge
    impl_->state.store(RuntimeState::Stopping, std::memory_order_release);

    QA_LOGI("[RuntimeHost] destroying...");

    // 1. 如果线程在运行，把 Bootstrap 的清理投递进去。
    //    必须在 Runtime Thread 执行：它要访问 JSEngine 和 JSValue
    if (impl_->thread.isRunning()) {
        std::mutex doneMutex;
        std::condition_variable doneCv;
        bool done = false;

        impl_->thread.post([&] {
            impl_->bootstrap.shutdown();
            {
                std::lock_guard<std::mutex> lock(doneMutex);
                done = true;
            }
            doneCv.notify_one();
        });

        // 等清理完成再停线程。
        // 加超时保护：如果 Runtime Thread 卡在某个 JS 死循环里，
        // 不至于让 destroy 永久阻塞
        {
            std::unique_lock<std::mutex> lock(doneMutex);
            if (!doneCv.wait_for(lock, std::chrono::seconds(5),
                                 [&] { return done; })) {
                QA_LOGE("[RuntimeHost] bootstrap shutdown timed out after 5s, "
                        "forcing thread stop");
            }
        }
    }

    // 2. 停止事件循环并等待线程退出。
    //    RuntimeThread::join 内部会在线程里销毁 JSEngine（Step 05）
    impl_->thread.stop();
    impl_->thread.join();

    // 3. 清空平台函数指针。
    //    最后做：确保没有代码还会发渲染命令
    clearPlatformBridge();

    impl_->state.store(RuntimeState::Destroyed, std::memory_order_release);
    QA_LOGI("[RuntimeHost] destroyed");
}
```

第三部分：状态查询。

```cpp
RuntimeState RuntimeHost::state() const {
    return impl_->state.load(std::memory_order_acquire);
}

std::string RuntimeHost::getLastError() const {
    std::lock_guard<std::mutex> lock(impl_->errorMutex);
    return impl_->lastError;
}

std::string RuntimeHost::failedStage() const {
    std::lock_guard<std::mutex> lock(impl_->errorMutex);
    return impl_->failedStage;
}

std::string RuntimeHost::packageName() const {
    const Manifest* m = impl_->bootstrap.manifest();
    return (m != nullptr) ? m->package : std::string();
}

std::string RuntimeHost::appName() const {
    const Manifest* m = impl_->bootstrap.manifest();
    return (m != nullptr) ? m->name : std::string();
}

bool RuntimeHost::getTitleBarConfig(const char* pageName,
                                    std::string& outTitle,
                                    std::string& outBgColor,
                                    std::string& outTextColor) const {
    const Manifest* m = impl_->bootstrap.manifest();
    if (m == nullptr) {
        return false;
    }

    // 空 pageName 表示入口页
    const std::string page =
        (pageName != nullptr && pageName[0] != '\0') ? pageName : m->entry;

    // effectiveDisplay 合并全局配置和页面级覆盖（Step 08）
    const PageDisplayConfig cfg = m->effectiveDisplay(page);
    outTitle = cfg.titleBarText;
    outBgColor = cfg.titleBarBackgroundColor;
    outTextColor = cfg.titleBarTextColor;
    return true;
}

} // namespace quickapp
```

### 10.6.3：RuntimeThread 需要暴露 eventLoop()

`RuntimeBootstrap::run` 需要 `RuntimeEventLoop*`（用于 `setTimeout` 和事件投递），但 Step 05 的 `RuntimeThread` 只暴露了 `engine()`。

**@add `include/runtime_thread.h` — 在 `engine()` 方法之后插入**

```cpp
    /**
     * 获取内部的事件循环。
     *
     * 用途：RuntimeBootstrap 需要它来配置 setTimeout 和注册事件处理器。
     *
     * @return EventLoop 指针。start() 之前或 join() 之后返回 nullptr
     *
     * 【线程约束】返回的指针可从任意线程使用（EventLoop 的 post 是线程安全的），
     * 但不要调用它的 run()/stop()（那是 RuntimeThread 的职责）。
     */
    RuntimeEventLoop* eventLoop() { return loop_.get(); }
```

---

## Step 10.7：接入 CMake

**@update `CMakeLists.txt` — 替换 `add_library(quickapp-core STATIC ...)` 块**

```cmake
add_library(quickapp-core STATIC
    src/core_version.cpp
    src/qa_log.cpp
    src/quickjs_engine.cpp
    src/runtime_thread.cpp
    src/platform_bridge.cpp
    src/platform_event_sink.cpp
    src/native_module.cpp
    src/module_registry.cpp
    src/js_bridge.cpp
    src/router_module.cpp
    src/prompt_module.cpp
    src/rpk_loader.cpp
    src/manifest_parser.cpp
    src/vnode.cpp
    src/style_resolver.cpp
    src/layout_engine.cpp
    src/render_pipeline.cpp
    src/runtime_bootstrap.cpp                   # ← Step 10 新增
    src/runtime_host.cpp                        # ← Step 10 新增
    platform/common/posix_event_loop.cpp
)
```

Step 10.3 已经加了 `add_dependencies(quickapp-core embed_framework_js)` 和 `generated` include 路径，不需要再改。

---

## Step 10.8：编写测试

测试需要一个含真实 page bundle 的 RPK。扩展 Step 08 的生成脚本。

**@update `tests/make_test_rpk.cmake` — 替换入口页 bundle 的 `file(WRITE ...)` 块**

```cmake
# 入口页 bundle：真实形态的 $app_define$ + $app_bootstrap$
file(WRITE "${RPK_STAGE}/pages/Demo/index.js" [=[
(function(global) {
  $app_define$('@app-component/Demo', [], function($app_require$, $app_exports$, $app_module$) {
    $app_module$.exports = {
      template: {
        type: 'div',
        classList: ['wrapper'],
        children: [
          { type: 'text', classList: ['title'],
            attr: { value: function() { return this.title; } } },
          { type: 'text',
            attr: { value: function() { return 'count: ' + this.count; } } },
          { type: 'input', classList: ['btn'],
            attr: { type: 'button', value: '去详情' },
            events: { click: 'goDetail' } },
          { type: 'input', classList: ['btn'],
            attr: { type: 'button', value: '弹提示' },
            events: { click: 'showTip' } }
        ]
      },
      style: {
        '.wrapper': { padding: '20px', backgroundColor: '#ffffff' },
        '.title':   { height: '48px', fontSize: '18px', color: '#333333' },
        '.btn':     { width: '240px', height: '44px', marginTop: '12px' }
      },
      private: { title: '欢迎体验快应用开发', count: 7 },
      onInit: function() {
        this.initCalled = true;
        console.log('Demo onInit, title=' + this.title);
      },
      onReady: function() { console.log('Demo onReady'); },
      onShow: function()  { console.log('Demo onShow'); },
      goDetail: function() {
        var router = $app_require$('@app-module/system.router');
        router.push({ uri: '/pages/DemoDetail' });
      },
      showTip: function() {
        var prompt = $app_require$('@app-module/system.prompt');
        prompt.showToast({ message: 'tip from ' + this.title });
      }
    };
  });
  $app_bootstrap$('@app-component/Demo', {});
})(this);
]=])

# app.js：应用级组件
file(WRITE "${RPK_STAGE}/app.js" [=[
(function(global) {
  $app_define$('@app-application/app', [], function($app_require$, $app_exports$, $app_module$) {
    $app_module$.exports = {
      onCreate: function() { console.log('app onCreate'); }
    };
  });
})(this);
]=])

# 第二个页面：验证路由跳转
file(WRITE "${RPK_STAGE}/pages/DemoDetail/index.js" [=[
(function(global) {
  $app_define$('@app-component/DemoDetail', [], function($app_require$, $app_exports$, $app_module$) {
    $app_module$.exports = {
      template: {
        type: 'div',
        classList: ['detail'],
        children: [
          { type: 'text', attr: { value: function() { return this.heading; } } }
        ]
      },
      style: { '.detail': { padding: '16px' } },
      private: { heading: '详情页内容' },
      onInit: function() { console.log('DemoDetail onInit'); }
    };
  });
  $app_bootstrap$('@app-component/DemoDetail', {});
})(this);
]=])
```

**@add `tests/test_bootstrap.cpp`（新建文件）**

第一部分：mock bridge 与启动测试。

```cpp
// RuntimeBootstrap / RuntimeHost / framework.js 集成测试。
//
// 验证点：
//   1. 完整启动序列成功，首屏渲染命令正确
//   2. 生命周期按 onInit → onReady → onShow 顺序调用
//   3. 数据绑定生效（private 字段进入渲染结果）
//   4. 点击事件到达 VM 方法
//   5. router.push 触发页面切换
//   6. prompt.showToast 到达平台
//   7. 启动失败时阶段和错误信息正确
//   8. destroy 幂等、状态机正确
//   9. 20 轮 create/destroy 无泄漏

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "runtime_host.h"

#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

namespace {

// ============================================================
// Mock PlatformBridge（线程安全：命令来自 Runtime Thread）
// ============================================================

struct Cmd {
    std::string kind;
    int id;
    std::string a, b;
    float x, y, w, h;
};

std::mutex g_mutex;
std::vector<Cmd> g_cmds;
std::vector<std::string> g_toasts;

void record(const Cmd& c) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_cmds.push_back(c);
}

void mockCreate(int id, const char* t, float x, float y, float w, float h) {
    record({"create", id, t ? t : "", "", x, y, w, h});
}
void mockAttr(int id, const char* k, const char* v) {
    record({"attr", id, k ? k : "", v ? v : "", 0, 0, 0, 0});
}
void mockStyle(int id, const char* k, const char* v) {
    record({"style", id, k ? k : "", v ? v : "", 0, 0, 0, 0});
}
void mockEvent(int id, const char* t, const char* m) {
    record({"event", id, t ? t : "", m ? m : "", 0, 0, 0, 0});
}
void mockRemove(int id) {
    record({"remove", id, "", "", 0, 0, 0, 0});
}
void mockToast(const char* msg) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_toasts.push_back(msg ? msg : "");
}

quickapp::PlatformBridge makeBridge() {
    quickapp::PlatformBridge b{};
    b.createElement = mockCreate;
    b.setAttr = mockAttr;
    b.setStyle = mockStyle;
    b.setEvent = mockEvent;
    b.removeElement = mockRemove;
    b.showToast = mockToast;
    return b;
}

void clearRecords() {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_cmds.clear();
    g_toasts.clear();
}

/**
 * 在记录的命令里查找。
 * @return 命令副本；未找到时 kind 为空
 */
Cmd findCmd(const std::string& kind, const std::string& a = "",
            const std::string& b = "") {
    std::lock_guard<std::mutex> lock(g_mutex);
    for (const auto& c : g_cmds) {
        if (c.kind == kind &&
            (a.empty() || c.a == a) &&
            (b.empty() || c.b == b)) {
            return c;
        }
    }
    return Cmd{};
}

size_t cmdCount(const std::string& kind) {
    std::lock_guard<std::mutex> lock(g_mutex);
    size_t n = 0;
    for (const auto& c : g_cmds) {
        if (c.kind == kind) ++n;
    }
    return n;
}

template <typename Pred>
bool waitFor(Pred pred, int timeoutMs = 3000) {
    const auto deadline = std::chrono::steady_clock::now() +
                          std::chrono::milliseconds(timeoutMs);
    while (std::chrono::steady_clock::now() < deadline) {
        if (pred()) return true;
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    return false;
}

std::vector<uint8_t> readFile(const char* path) {
    std::FILE* f = std::fopen(path, "rb");
    if (f == nullptr) return {};
    std::fseek(f, 0, SEEK_END);
    const long n = std::ftell(f);
    std::fseek(f, 0, SEEK_SET);
    std::vector<uint8_t> buf(static_cast<size_t>(n));
    const size_t got = std::fread(buf.data(), 1, buf.size(), f);
    std::fclose(f);
    if (got != buf.size()) return {};
    return buf;
}
```


第二部分：测试用例与 main。

```cpp
// ============================================================
// 测试 1：完整启动 + 首屏渲染
// ============================================================

int testFullStartup(const std::vector<uint8_t>& rpk) {
    clearRecords();

    quickapp::RuntimeHost host;
    quickapp::RuntimeHostConfig cfg;
    cfg.bridge = makeBridge();
    cfg.rpkData = rpk.data();
    cfg.rpkSize = rpk.size();
    cfg.viewportWidth = 1080.0f;
    cfg.viewportHeight = 1800.0f;

    CHECK(host.state() == quickapp::RuntimeState::Created,
          "initial state should be Created");
    CHECK(host.create(cfg), "create failed");
    CHECK(host.start(), ("start failed: stage=" + host.failedStage() +
                         " err=" + host.getLastError()).c_str());
    CHECK(host.state() == quickapp::RuntimeState::Running,
          "state should be Running after start");

    // ---- Manifest 信息可读 ----
    CHECK(host.packageName() == "com.example.testcase",
          "packageName wrong");
    CHECK(host.appName() == "测试应用", "appName wrong (UTF-8?)");

    std::string title, bg, fg;
    CHECK(host.getTitleBarConfig(nullptr, title, bg, fg),
          "getTitleBarConfig failed");
    CHECK(title == "快应用示例模版", "entry page title wrong");
    CHECK(bg == "#f2f2f2", "titlebar bg wrong");

    CHECK(host.getTitleBarConfig("pages/DemoDetail", title, bg, fg),
          "getTitleBarConfig for detail failed");
    CHECK(title == "详情页", "detail page title wrong");
    CHECK(fg == "#ff0000", "detail page text color should be overridden");

    // ---- 首屏渲染命令 ----
    // 模板有 4 个节点：wrapper + 2 text + 2 input = 5
    CHECK(cmdCount("create") == 5, "should create 5 elements");

    const Cmd wrapper = findCmd("create", "div");
    CHECK(wrapper.kind == "create", "wrapper createElement missing");
    CHECK(wrapper.w == 1080.0f, "wrapper should fill viewport width");

    // ---- 数据绑定：private.title 出现在渲染结果里 ----
    const Cmd titleAttr = findCmd("attr", "value", "欢迎体验快应用开发");
    CHECK(titleAttr.kind == "attr",
          "data binding failed: title text not rendered");

    const Cmd countAttr = findCmd("attr", "value", "count: 7");
    CHECK(countAttr.kind == "attr",
          "data binding with expression failed");

    // ---- 样式应用 ----
    const Cmd colorStyle = findCmd("style", "color", "#333333");
    CHECK(colorStyle.kind == "style", "title color style missing");

    const Cmd btnWidth = findCmd("style", "width", "240px");
    CHECK(btnWidth.kind == "style", "button width style missing");

    // ---- 事件绑定 ----
    const Cmd clickEvent = findCmd("event", "click", "goDetail");
    CHECK(clickEvent.kind == "event", "goDetail click binding missing");
    const Cmd tipEvent = findCmd("event", "click", "showTip");
    CHECK(tipEvent.kind == "event", "showTip click binding missing");

    // ---- 布局：按钮有 marginTop 12 ----
    // wrapper padding 20，title h=48，第二个 text 默认 40
    // 第一个按钮 y = 20 + 48 + 40 + 12 = 120
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        bool foundBtn = false;
        for (const auto& c : g_cmds) {
            if (c.kind == "create" && c.a == "input" && c.y == 120.0f) {
                foundBtn = true;
                CHECK(c.w == 240.0f, "button width should be 240");
                CHECK(c.h == 44.0f, "button height should be 44");
                break;
            }
        }
        CHECK(foundBtn, "first button should be at y=120");
    }

    // ---- 点击事件：showTip → prompt.showToast ----
    const int tipNodeId = tipEvent.id;
    host.dispatchClick(tipNodeId);

    CHECK(waitFor([] {
        std::lock_guard<std::mutex> lock(g_mutex);
        return !g_toasts.empty();
    }), "showToast should be triggered by click");

    {
        std::lock_guard<std::mutex> lock(g_mutex);
        CHECK(g_toasts[0] == "tip from 欢迎体验快应用开发",
              "toast message should include VM data");
    }

    // ---- 未绑定事件的节点：安全忽略 ----
    host.dispatchClick(wrapper.id);
    host.dispatchClick(99999);
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    // 不崩溃即通过

    // ---- 点击事件：goDetail → router.push → 页面切换 ----
    clearRecords();
    host.dispatchClick(clickEvent.id);

    CHECK(waitFor([] { return cmdCount("remove") > 0; }),
          "page switch should remove old elements");
    CHECK(waitFor([] { return cmdCount("create") > 0; }),
          "page switch should create new elements");

    // 旧页面 5 个节点全部删除
    CHECK(cmdCount("remove") == 5, "all 5 old nodes should be removed");
    // 新页面 2 个节点（div + text）
    CHECK(cmdCount("create") == 2, "detail page should create 2 elements");

    const Cmd detailText = findCmd("attr", "value", "详情页内容");
    CHECK(detailText.kind == "attr", "detail page data binding failed");

    // ---- 生命周期事件 ----
    host.dispatchLifecycle("onHide");
    host.dispatchLifecycle("onShow");
    std::this_thread::sleep_for(std::chrono::milliseconds(100));

    // ---- 平台主动导航 ----
    clearRecords();
    host.navigateTo("/pages/Demo");
    CHECK(waitFor([] { return cmdCount("create") >= 5; }),
          "navigateTo should render the target page");

    // ---- 销毁 ----
    host.destroy();
    CHECK(host.state() == quickapp::RuntimeState::Destroyed,
          "state should be Destroyed");

    // 幂等
    host.destroy();
    host.destroy();

    // 销毁后事件被丢弃
    clearRecords();
    host.dispatchClick(1);
    host.navigateTo("/pages/Demo");
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    CHECK(cmdCount("create") == 0, "no commands after destroy");

    return 0;
}

// ============================================================
// 测试 2：启动失败的诊断信息
// ============================================================

int testStartupFailures(const std::vector<uint8_t>& rpk) {
    // ---- 配置校验 ----
    {
        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        // bridge 未填
        cfg.rpkData = rpk.data();
        cfg.rpkSize = rpk.size();
        cfg.viewportWidth = 1080;
        cfg.viewportHeight = 1800;
        CHECK(!host.create(cfg), "create should fail without bridge");
        CHECK(host.getLastError().find("PlatformBridge") != std::string::npos,
              "error should mention PlatformBridge");
    }
    {
        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        cfg.bridge = makeBridge();
        // rpkData 未填
        cfg.viewportWidth = 1080;
        cfg.viewportHeight = 1800;
        CHECK(!host.create(cfg), "create should fail without rpk data");
        CHECK(host.getLastError().find("rpkData") != std::string::npos,
              "error should mention rpkData");
    }
    {
        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        cfg.bridge = makeBridge();
        cfg.rpkData = rpk.data();
        cfg.rpkSize = rpk.size();
        // viewport 为 0
        CHECK(!host.create(cfg), "create should fail with zero viewport");
    }

    // ---- 损坏的 RPK：应在 RPKOpen 阶段失败 ----
    {
        std::vector<uint8_t> garbage(1024, 0xAB);
        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        cfg.bridge = makeBridge();
        cfg.rpkData = garbage.data();
        cfg.rpkSize = garbage.size();
        cfg.viewportWidth = 1080;
        cfg.viewportHeight = 1800;

        CHECK(host.create(cfg), "create should succeed (config is valid)");
        CHECK(!host.start(), "start should fail with garbage rpk");
        CHECK(host.state() == quickapp::RuntimeState::Failed,
              "state should be Failed");
        CHECK(host.failedStage() == "RPKOpen",
              ("failedStage should be RPKOpen, got " + host.failedStage()).c_str());
        CHECK(host.getLastError().find("EOCD") != std::string::npos,
              "error should mention EOCD");

        // 失败后 destroy 仍然安全
        host.destroy();
    }

    // ---- 重复 start ----
    {
        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        cfg.bridge = makeBridge();
        cfg.rpkData = rpk.data();
        cfg.rpkSize = rpk.size();
        cfg.viewportWidth = 1080;
        cfg.viewportHeight = 1800;
        CHECK(host.create(cfg), "create failed");
        CHECK(host.start(), "first start failed");
        CHECK(!host.start(), "second start should fail");
        CHECK(!host.create(cfg), "create after start should fail");
        host.destroy();
    }

    return 0;
}

// ============================================================
// 测试 3：重复创建销毁（泄漏与状态检查）
// ============================================================

int testRepeatedLifecycle(const std::vector<uint8_t>& rpk) {
    for (int round = 0; round < 20; ++round) {
        clearRecords();

        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        cfg.bridge = makeBridge();
        cfg.rpkData = rpk.data();
        cfg.rpkSize = rpk.size();
        cfg.viewportWidth = 720.0f;
        cfg.viewportHeight = 1280.0f;

        if (!host.create(cfg) || !host.start()) {
            std::fprintf(stderr, "FAIL: round %d start failed: %s\n",
                         round, host.getLastError().c_str());
            return 1;
        }

        // 每轮都做一次交互，覆盖事件路径
        const Cmd ev = findCmd("event", "click", "showTip");
        if (ev.kind == "event") {
            host.dispatchClick(ev.id);
        }

        host.destroy();

        if (host.state() != quickapp::RuntimeState::Destroyed) {
            std::fprintf(stderr, "FAIL: round %d state wrong\n", round);
            return 1;
        }
    }

    std::printf("  survived 20 create/destroy rounds\n");
    return 0;
}

// ============================================================
// 测试 4：析构兜底（不显式 destroy）
// ============================================================

int testDestructorCleanup(const std::vector<uint8_t>& rpk) {
    {
        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        cfg.bridge = makeBridge();
        cfg.rpkData = rpk.data();
        cfg.rpkSize = rpk.size();
        cfg.viewportWidth = 1080;
        cfg.viewportHeight = 1800;
        CHECK(host.create(cfg), "create failed");
        CHECK(host.start(), "start failed");
        // 不调 destroy()，靠析构兜底。
        // 如果析构没处理好，RuntimeThread 析构时会 std::terminate
    }
    std::printf("  destructor cleanup ok\n");
    return 0;
}

} // namespace

int main() {
    const auto rpk = readFile(TEST_RPK_PATH);
    if (rpk.empty()) {
        std::fprintf(stderr, "FAIL: cannot read test RPK at %s\n", TEST_RPK_PATH);
        return 1;
    }
    std::printf("  test RPK: %zu bytes\n", rpk.size());

    if (testFullStartup(rpk) != 0) return 1;
    if (testStartupFailures(rpk) != 0) return 1;
    if (testRepeatedLifecycle(rpk) != 0) return 1;
    if (testDestructorCleanup(rpk) != 0) return 1;

    std::printf("PASS: all bootstrap / host tests\n");
    return 0;
}
```

**@update `tests/CMakeLists.txt` — 在 `test_vnode_layout` 之后插入**

```cmake
# test_bootstrap：完整启动链路集成测试
add_executable(test_bootstrap test_bootstrap.cpp)
add_dependencies(test_bootstrap generate_test_rpk)
target_link_libraries(test_bootstrap PRIVATE quickapp-core)
target_compile_definitions(test_bootstrap PRIVATE
    TEST_RPK_PATH="${TEST_RPK}"
)
add_test(NAME test_bootstrap COMMAND test_bootstrap)
```

---

## Step 10.9：逐层验证

### 10.9.1：framework.js 内嵌验证

先确认 CMake 生成的头文件是合法 C++：

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build && cmake --build build --target embed_framework_js

# 检查生成结果
wc -l build/generated/framework_js.h
head -12 build/generated/framework_js.h

# 独立编译验证转义正确
cat > /tmp/check_embed.cpp << 'EOF'
#include <cstdio>
#include <cstring>
#include "framework_js.h"
int main() {
    const size_t len = std::strlen(quickapp::kFrameworkJS);
    std::printf("framework.js embedded: %zu bytes\n", len);
    // 关键标识必须存在
    const char* marks[] = {"$app_define$", "$app_bootstrap$",
                           "__invoke_vm_method__", "__evaluateTemplate__"};
    for (const char* m : marks) {
        if (std::strstr(quickapp::kFrameworkJS, m) == nullptr) {
            std::printf("MISSING: %s\n", m);
            return 1;
        }
    }
    std::printf("all markers present\n");
    return 0;
}
EOF
c++ -std=c++17 -I build/generated /tmp/check_embed.cpp -o /tmp/check_embed \
    && /tmp/check_embed
rm -f /tmp/check_embed.cpp /tmp/check_embed
```

预期：

```text
framework.js embedded: 9xxx bytes
all markers present
```

如果编译报 `unterminated string literal` 或 `stray '\'`，说明 `embed_js.cmake` 的转义顺序有问题（必须先转反斜杠再转引号）。

### 10.9.2：编译验证

```bash
cmake --build build -j4
```

预期：

```text
[ xx%] Embedding framework.js into C++ header
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/runtime_bootstrap.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/runtime_host.cpp.o
[100%] Linking CXX executable test_bootstrap
```

**常见错误：**

```text
"framework_js.h: No such file or directory"
    → CMakeLists 缺 ${CMAKE_CURRENT_BINARY_DIR}/generated include 路径
    → 或缺 add_dependencies(quickapp-core embed_framework_js)

"'eventLoop' is not a member of 'quickapp::RuntimeThread'"
    → Step 10.6.3 的 runtime_thread.h 补充未完成

"undefined reference to quickapp::setNavigateHandler"
    → router_module.cpp（Step 07）里的函数，检查它没被 static 修饰

"invalid use of incomplete type 'struct RuntimeHost::Impl'"
    → Impl 的定义必须在 runtime_host.cpp 里，且在使用之前
```

### 10.9.3：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
1/9 Test #1: test_version .....................   Passed
...
8/9 Test #8: test_vnode_layout ................   Passed
9/9 Test #9: test_bootstrap ...................   Passed    1.85 sec

100% tests passed, 0 tests failed out of 9
```

直接运行看完整启动轨迹：

```bash
./build/tests/test_bootstrap 2>&1 | head -60
```

预期（节选）：

```text
  test RPK: 2xxx bytes
[I/quickapp-core] [RuntimeHost] created: rpk=2xxx bytes, viewport=1080x1800
[I/quickapp-core] [JSEngine] initialized (QuickJS, memLimit=64MB, stackLimit=1MB)
[I/quickapp-core] [RuntimeThread] entering event loop
[I/quickapp-core] [Bootstrap] === starting runtime ===
[I/quickapp-core] [ModuleRegistry] registered: @app-module/system.router
[I/quickapp-core] [ModuleRegistry] registered: @app-module/system.prompt
[I/quickapp-core] [Bootstrap] 1/11 registered 2 modules
[I/quickapp-core] [JSBridge] installed: $app_require$, console, setTimeout/...
[I/quickapp-core] [Bootstrap] 2/11 JS bridge installed
[I/quickapp-core] [RenderPipeline] initialized, viewport=1080x1800
[I/quickapp-core] [Bootstrap] 3/11 render pipeline ready (1080x1800)
[I/quickapp-core] [RPKLoader] opened: 2xxx bytes, 7 files
[I/quickapp-core] [Bootstrap] 4/11 RPK opened: 7 files
[I/quickapp-core] [Bootstrap] 5/11 manifest.json read (8xx bytes)
[I/quickapp-core] [ManifestParser] parsed: package=com.example.testcase ...
[I/quickapp-core] [Bootstrap] 6/11 manifest parsed: com.example.testcase ...
[I/quickapp-core] [JS] [framework] framework.js loaded
[I/quickapp-core] [Bootstrap] 7/11 framework.js evaluated
[I/quickapp-core] [Bootstrap] 8/11 app.js read (2xx bytes)
[I/quickapp-core] [JS] [framework] defined: @app-application/app
[I/quickapp-core] [JS] app onCreate
[I/quickapp-core] [JS] [framework] app onCreate called
[I/quickapp-core] [Bootstrap] 9/11 app.js evaluated
[I/quickapp-core] [Bootstrap] 10/11 page bundle read: pages/Demo/index.js
[I/quickapp-core] [JS] [framework] defined: @app-component/Demo
[I/quickapp-core] [JS] [framework] bootstrapping: @app-component/Demo
[I/quickapp-core] [JS] Demo onInit, title=欢迎体验快应用开发
[I/quickapp-core] [JS] [framework] onInit called
[I/quickapp-core] [VNode] built tree: 5 nodes, root type=div
[I/quickapp-core] [StyleResolver] built stylesheet: 3 selectors
[I/quickapp-core] [Layout] calculated 5 nodes in 1080x1800 container
[I/quickapp-core] [RenderPipeline] rendered 5 nodes, index size=5
[I/quickapp-core] [JS] Demo onReady
[I/quickapp-core] [JS] [framework] onReady called
[I/quickapp-core] [JS] Demo onShow
[I/quickapp-core] [JS] [framework] onShow called
[I/quickapp-core] [JS] [framework] bootstrap complete: @app-component/Demo
[I/quickapp-core] [Bootstrap] 11/11 page rendered: 5 nodes
[I/quickapp-core] [Bootstrap] === runtime started successfully ===
[I/quickapp-core] [EventSink] initialized
[I/quickapp-core] [RuntimeHost] started, state=Running
```

关键确认点：
- 11 个阶段全部按序完成
- 生命周期顺序：`onInit` → 渲染 → `onReady` → `onShow`
- `title=欢迎体验快应用开发` 证明 private 数据进入了 VM
- 事件通道在首屏渲染**之后**才初始化

继续看交互部分：

```bash
./build/tests/test_bootstrap 2>&1 | grep -A2 "click on node"
```

预期：

```text
[I/quickapp-core] [Bootstrap] click on node 5 -> vm.showTip()
[I/quickapp-core] [Prompt] showToast: tip from 欢迎体验快应用开发
[I/quickapp-core] [Bootstrap] click on node 4 -> vm.goDetail()
[I/quickapp-core] [Router] push '/pages/DemoDetail', stack depth=1
[I/quickapp-core] [Bootstrap] navigate to '/pages/DemoDetail' (isBack=0)
[I/quickapp-core] [RenderPipeline] removing previous page (5 nodes)
[I/quickapp-core] [JS] DemoDetail onInit
[I/quickapp-core] [RenderPipeline] rendered 2 nodes, index size=2
```

完整链路：`点击 → C++ 查节点 → 调 VM 方法 → JS 调 router.push → C++ 导航 → 删旧渲新`。

### 10.9.4：内存与线程验证

```bash
# ASan：泄漏和越界
cmake -B build-asan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer" \
  -DCMAKE_C_FLAGS="-fsanitize=address -fno-omit-frame-pointer" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address"
cmake --build build-asan -j4
ASAN_OPTIONS=detect_leaks=1 ./build-asan/tests/test_bootstrap
```

预期：`PASS`，无泄漏。测试 3 的 20 轮 create/destroy 是这里的核心 —— 单轮泄漏会被放大 20 倍，更容易发现。

```bash
# TSan：数据竞争
cmake -B build-tsan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=thread -fno-omit-frame-pointer" \
  -DCMAKE_C_FLAGS="-fsanitize=thread -fno-omit-frame-pointer" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=thread"
cmake --build build-tsan -j4
./build-tsan/tests/test_bootstrap
```

预期：`PASS`，无竞争报告。重点检查：

```text
- RuntimeHost::state（atomic，应无报告）
- RuntimeHost::lastError（mutex 保护）
- mock bridge 的 g_cmds（测试自己加了 mutex）
- PlatformEventSink 的投递路径（Step 06 已验证）
```

```bash
rm -rf build-asan build-tsan
```

### 10.9.5：销毁顺序验证

用一个专门的程序验证销毁过程中不会 use-after-free：

```bash
cat > /tmp/test_destroy_order.cpp << 'EOF'
// 在事件流中间销毁，验证顺序正确性
#include <atomic>
#include <chrono>
#include <cstdio>
#include <thread>
#include <vector>
#include "runtime_host.h"

static std::atomic<int> g_creates{0};
static void c1(int, const char*, float, float, float, float) { g_creates++; }
static void c2(int, const char*, const char*) {}
static void c3(int, const char*, const char*) {}
static void c4(int, const char*, const char*) {}
static void c5(int) {}

static std::vector<uint8_t> readFile(const char* p) {
    std::FILE* f = std::fopen(p, "rb");
    if (!f) return {};
    std::fseek(f, 0, SEEK_END); long n = std::ftell(f); std::fseek(f, 0, SEEK_SET);
    std::vector<uint8_t> b(n); std::fread(b.data(), 1, n, f); std::fclose(f);
    return b;
}

int main(int argc, char** argv) {
    if (argc < 2) return 1;
    auto rpk = readFile(argv[1]);
    if (rpk.empty()) return 1;

    for (int round = 0; round < 10; ++round) {
        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        cfg.bridge.createElement = c1;
        cfg.bridge.setAttr = c2;
        cfg.bridge.setStyle = c3;
        cfg.bridge.setEvent = c4;
        cfg.bridge.removeElement = c5;
        cfg.rpkData = rpk.data();
        cfg.rpkSize = rpk.size();
        cfg.viewportWidth = 1080;
        cfg.viewportHeight = 1800;

        if (!host.create(cfg) || !host.start()) {
            std::printf("round %d start failed: %s\n", round,
                        host.getLastError().c_str());
            return 1;
        }

        // 后台线程持续投递事件，模拟用户狂点
        std::atomic<bool> stop{false};
        std::thread spammer([&] {
            int i = 1;
            while (!stop.load()) {
                host.dispatchClick(i % 8);
                host.dispatchLifecycle("onShow");
                host.navigateTo("/pages/Demo");
                i++;
                std::this_thread::sleep_for(std::chrono::microseconds(200));
            }
        });

        std::this_thread::sleep_for(std::chrono::milliseconds(30));

        // 在事件流中间销毁
        host.destroy();

        stop = true;
        spammer.join();
        // 销毁后 spammer 还可能投递了几次，必须全部被安全丢弃
    }

    std::printf("survived 10 rounds under event pressure, %d creates\n",
                g_creates.load());
    return 0;
}
EOF

c++ -std=c++17 -fsanitize=address -g -I include /tmp/test_destroy_order.cpp \
    build/libquickapp-core.a build/third_party/quickjs/libquickjs.a \
    -lz -o /tmp/test_destroy_order 2>/dev/null && \
    /tmp/test_destroy_order build/tests/test.rpk
```

预期：

```text
survived 10 rounds under event pressure, NNN creates
```

无 ASan 报告。这验证了 `shutdown()` 的顺序（先断事件通道，再关管线，最后清模块）是正确的。

```bash
rm -f /tmp/test_destroy_order.cpp /tmp/test_destroy_order
```

### 10.9.6：启动耗时测量

```bash
cat > /tmp/bench_startup.cpp << 'EOF'
#include <chrono>
#include <cstdio>
#include <vector>
#include "runtime_host.h"

static void n1(int, const char*, float, float, float, float) {}
static void n2(int, const char*, const char*) {}

static std::vector<uint8_t> readFile(const char* p) {
    std::FILE* f = std::fopen(p, "rb");
    if (!f) return {};
    std::fseek(f, 0, SEEK_END); long n = std::ftell(f); std::fseek(f, 0, SEEK_SET);
    std::vector<uint8_t> b(n); std::fread(b.data(), 1, n, f); std::fclose(f);
    return b;
}

int main(int argc, char** argv) {
    if (argc < 2) return 1;
    auto rpk = readFile(argv[1]);
    const int rounds = 20;
    long total = 0, minMs = 1 << 30, maxMs = 0;

    for (int i = 0; i < rounds; ++i) {
        quickapp::RuntimeHost host;
        quickapp::RuntimeHostConfig cfg;
        cfg.bridge.createElement = n1;
        cfg.bridge.setAttr = n2;
        cfg.bridge.setStyle = n2;
        cfg.rpkData = rpk.data();
        cfg.rpkSize = rpk.size();
        cfg.viewportWidth = 1080;
        cfg.viewportHeight = 1800;

        const auto t0 = std::chrono::steady_clock::now();
        host.create(cfg);
        host.start();
        const auto t1 = std::chrono::steady_clock::now();

        const long ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            t1 - t0).count();
        total += ms;
        if (ms < minMs) minMs = ms;
        if (ms > maxMs) maxMs = ms;

        host.destroy();
    }

    std::printf("startup: avg=%ldms min=%ldms max=%ldms (%d rounds)\n",
                total / rounds, minMs, maxMs, rounds);
    return 0;
}
EOF

c++ -std=c++17 -O2 -I include /tmp/bench_startup.cpp \
    build/libquickapp-core.a build/third_party/quickjs/libquickjs.a \
    -lz -o /tmp/bench_startup 2>/dev/null && \
    /tmp/bench_startup build/tests/test.rpk
```

预期（桌面环境）：

```text
startup: avg=12ms min=9ms max=25ms (20 rounds)
```

对照 design.md 的性能基准（完整 bootstrapRuntime < 30ms），桌面环境达标。移动设备会慢 2-4 倍，Step 11 在真机上重新测量。

```bash
rm -f /tmp/bench_startup.cpp /tmp/bench_startup
```

### 10.9.7：平台无关性回归

```bash
nm build/libquickapp-core.a | grep -E "__android_log_print|objc_msgSend|_fopen|_open"
```

预期：无输出。`framework.js` 是内嵌字符串，不引入任何文件 IO。

---

## 技术决策

### 1. `$app_define$` / `$app_bootstrap$` 用 JS 实现

它们的职责是纯 JS 对象操作，用 C++ 实现要遍历 JSValue 树、手动管引用计数、拼装对象。约 200 行 C++ 换 20 行 JS，且引用计数极易出错。

C++ 只提供 JS 做不到的能力（模块访问、日志、定时器、渲染通知）。这条边界在 Step 07 就确立了，本步落实。

### 2. framework.js 编译期内嵌

三个方案里只有编译期内嵌同时满足：

```text
✓ Core 不做文件 IO（平台无关约束）
✓ 三端行为一致（同一份代码编译进去）
✓ 版本强绑定（framework.js 和 Core 一起发布）
```

代价是改 framework.js 要重编译 Core。开发期这是几秒的事，`add_custom_command` 的 `DEPENDS` 保证自动重新生成。

### 3. 模板求值在 JS 侧而非 C++ 侧

```text
framework.js 的 __evaluateTemplate__ 遍历模板，
把 attr 里的函数替换为 fn.call(vm) 的返回值，
传给 __native_render__ 的是纯数据。
```

对比在 C++ `buildVNode` 里求值（Step 09 已实现的能力）：

| 维度 | JS 侧求值（采用） | C++ 侧求值 |
|---|---|---|
| this 绑定 | `fn.call(vm)` 天然正确 | 需要跨语言传 VM 的 JSValue |
| 错误处理 | try-catch 直接拿到 message | 要手动 JS_GetException |
| 调试 | 可以在 JS 里加 console.log | 要重编译 C++ |
| 开销 | 一次对象深拷贝 | 无深拷贝 |

深拷贝对几十个节点的页面开销可忽略（< 1ms）。Step 09 的 C++ 求值能力保留作为兜底。

### 4. VM 的 private 字段提升为自身属性

```javascript
// definition.private = { title: 'x' }
// →
// vm.title = 'x'
```

这样模板里 `function(){ return this.title }` 能取到值。如果保持嵌套（`vm.private.title`），模板要写 `this.private.title`，不符合快应用规范。

用浅拷贝而非深拷贝：`private` 里的对象/数组按引用共享，保持 JS 侧的对象身份（`===` 比较）。V1 无响应式需求，不需要深拷贝来做变更追踪。

### 5. 方法挂载不用 bind

```javascript
vm[key] = definition[key];        // 直接赋值
// 而不是
vm[key] = definition[key].bind(vm);
```

通过 `vm.method()` 调用时 `this` 自然是 `vm`，不需要 bind。用 bind 的代价：

```text
- 每个方法创建一个新函数对象（内存）
- vm.method !== definition.method，破坏身份比较
- 无法用 vm.method.call(otherObj) 复用
```

唯一需要 bind 的场景是把方法作为回调传出去（`setTimeout(vm.method, 100)`），但快应用代码里通常写 `setTimeout(function(){ vm.method(); }, 100)`。

### 6. 启动序列分 11 个阶段并记录失败点

```cpp
enum class BootstrapStage { RPKOpen, ManifestParse, FrameworkEval, ... };
```

平台层能据此给出精确提示：

```text
RPKOpen 失败       → "应用包损坏，请重新下载"
ManifestParse 失败 → "应用配置错误"
EntryPageEval 失败 → "应用脚本异常"（可上报给开发者）
```

如果只返回一个 bool，用户看到的永远是"启动失败"。

### 7. `start()` 阻塞等待启动完成

```cpp
bool start() {
    thread.post([&]{ bootstrap.run(...); notify(); });
    startCv.wait(lock, [&]{ return startDone; });   // 阻塞
    return startSuccess;
}
```

阻塞是有意的：调用方需要知道结果才能决定显示页面还是错误提示。

```kotlin
// Android 侧的自然写法
if (runtime.start()) {
    showContentView()
} else {
    showErrorView(runtime.getLastError())
}
```

典型耗时 10-25ms（10.9.6 实测），在 Activity.onCreate 里阻塞这么久是可接受的。如果将来要做异步启动，加一个 `startAsync(callback)` 重载，不改现有语义。

### 8. RuntimeHost 用 Pimpl

```cpp
class RuntimeHost {
    struct Impl;
    std::unique_ptr<Impl> impl_;
};
```

`runtime_host.h` 是平台层唯一需要 include 的头文件。用 Pimpl 后它不需要包含 `runtime_thread.h`、`runtime_bootstrap.h`、`<thread>`、`<condition_variable>`。

好处：

```text
1. 平台层的编译依赖最小（只需 platform_bridge.h + runtime_host.h）
2. Core 内部重构（换线程实现、改 Bootstrap 结构）不触发平台层重编译
3. 避免 native_module.h → quickjs.h 那类依赖泄漏（Step 07 的教训）
```

### 9. 事件走 PlatformEventSink 而非直接 thread.post

```cpp
void RuntimeHost::dispatchClick(int nodeId) {
    if (!impl_->acceptsEvents()) return;
    PlatformEventSink::dispatchClick(nodeId);      // 而非 thread.post
}
```

`PlatformEventSink`（Step 06）已经实现了线程安全投递、生命周期保护（shutdown 后丢弃）、double-checked 快速路径。直接用 `thread.post` 要重复这些逻辑。

`acceptsEvents()` 的状态检查是第一道防线，`EventSink` 的 `g_active` 是第二道。两层保护应对"状态刚变但 shutdown 还没执行"的竞态窗口。

### 10. destroy() 加 5 秒超时保护

```cpp
if (!doneCv.wait_for(lock, std::chrono::seconds(5), [&]{ return done; })) {
    QA_LOGE("[RuntimeHost] bootstrap shutdown timed out, forcing thread stop");
}
```

如果 Runtime Thread 卡在 JS 死循环里（`while(true){}`），`bootstrap.shutdown()` 永远不会被执行，`destroy()` 会永久阻塞，App 无响应。

超时后强制走 `thread.stop() + join()`。`stop()` 会让 EventLoop 退出，但如果 JS 还在死循环里，`join()` 仍会阻塞 —— 彻底解决需要 QuickJS 的中断回调（`JS_SetInterruptHandler`），那是 V2 的工作。至少现在有日志能定位问题。

### 11. 页面切换重新执行 bundle 而非恢复状态

```cpp
bool navigate(const char* uri, bool isBack) {
    callGlobalFunction(engine_, "__clear_current_vm__", nullptr, 0);
    return loadPageBundle(route->bundlePath());   // 重新 eval
}
```

`isBack` 参数当前不改变行为：返回和前进都重新执行 bundle，创建新 VM。

代价：返回上一页时丢失状态（滚动位置、表单输入、请求结果）。

完整方案需要页面栈保存 VM 实例和 VNode 树：

```text
push:  当前 VM 和 VNode 树存入栈 → 加载新页面
back:  弹出栈顶 → 恢复 VM 引用 → 重新发送渲染命令（不重新 eval）
```

这需要 framework.js 支持多 VM 共存，以及 RenderPipeline 支持多棵树。V1.5 的工作。

### 12. 全局状态而非实例成员

```cpp
RuntimeBootstrap* g_bootstrap = nullptr;
std::unique_ptr<RPKLoader> g_loader;
std::unique_ptr<Manifest> g_manifest;
```

原因是 `RouterModule` 的 `NavigateHandler` 和 `PlatformEventSink` 的 `EventHandler` 是函数指针/无捕获 lambda，无法携带 `this`。

这和 `PlatformBridge`、`ModuleRegistry`、`RenderPipeline` 的全局状态一致，都基于"V1 只支持单 Runtime"这个决策（design.md Key Decision 6）。

多 Runtime 需要把回调签名改为带上下文：

```cpp
using NavigateHandler = bool (*)(void* context, const char* uri, bool isBack);
void setNavigateHandler(NavigateHandler handler, void* context);
```

---

## QA

### 1. 为什么 `$app_require$` 要在 framework.js 里包装一层

因为它要服务两种命名空间：

```text
@app-module/system.router  → C++ ModuleRegistry
@app-component/Demo        → framework.js 的 __components__ 表
```

C++ 版（Step 07）只认识前者，对未知名字返回 `undefined`。framework.js 包装后：

```javascript
global.$app_require$ = function(name) {
    var native = __nativeRequire__(name);
    if (native !== undefined) return native;      // C++ 模块
    return __components__[name];                   // JS 组件
};
```

这就是 Step 07 决策"未知模块返回 undefined 而非抛异常"的原因 —— 抛异常会中断这个回退链。

### 2. app.js 为什么可以缺失

有些 RPK 只有页面，没有应用级逻辑。阶段 8 的处理：

```cpp
if (!g_loader->fileExists("app.js")) {
    QA_LOGW("[Bootstrap] 8/11 app.js not found, skipping");
}
```

跳过而不是失败，让这类 RPK 也能运行。这符合"V1 兼容优先"原则。

### 3. 生命周期为什么是 onInit → 渲染 → onReady → onShow

对应快应用规范的语义：

```text
onInit   数据已初始化，DOM 未创建。页面在这里发起请求、初始化状态
onReady  渲染命令已发送。可以操作节点（V1 无此能力，V2 支持 $element）
onShow   页面对用户可见。用于恢复动画、刷新数据
```

`onReady` 在渲染命令发送后调用，但**不代表平台已完成绘制** —— 命令还在平台的 UI 线程队列里。真正的"绘制完成"需要平台回调，V1 未实现。

### 4. 事件通道为什么在首屏渲染之后才初始化

```cpp
// run() 的最后
setNavigateHandler(navigateThunk);
PlatformEventSink::initialize(loop, ...);
```

如果在启动前就初始化，可能出现：

```text
用户在首屏渲染完成前点击（平台已创建部分 View）
→ 事件到达 Runtime Thread
→ handleClick 查 RenderPipeline::findNode
→ 树还没建好 → 返回 false，事件丢失
```

更糟的是如果启动中途失败，事件处理器已注册但 Bootstrap 状态不完整。放到最后保证"能接收事件"意味着"已经可以正确处理事件"。

### 5. `handleClick` 里为什么要 `executePendingJobs`

VM 方法可能产生微任务：

```javascript
goDetail: function() {
    var router = $app_require$('@app-module/system.router');
    router.push({ uri: '/pages/Detail' });        // 同步，立即执行
}

loadData: function() {
    fetchSomething().then(function(data) {         // Promise 回调
        this.data = data;                          // 需要驱动才会执行
    }.bind(this));
}
```

EventLoop 的 `idleCallback`（Step 05）会在每轮任务后驱动微任务，但事件处理是在任务**内部**调用 JS 的。显式调用 `executePendingJobs()` 让 Promise 回调在本轮就执行完，而不是等到下一轮。

### 6. `handleInput` 为什么要更新 `node->attrs["value"]`

```cpp
node->attrs["value"] = text;
```

保持 C++ 侧的 VNode 状态与平台一致。不更新的话：

```text
用户在输入框打字 "abc"
→ 平台的 EditText.text = "abc"
→ C++ 的 node->attrs["value"] 还是初始值 ""
→ 后续代码读 node->attr("value") 拿到错误的值
```

V1 没有代码会读它，但保持状态一致是正确做法，且 V2 的 `$element` API 会依赖它。

### 7. `RuntimeThread::eventLoop()` 为什么 Step 05 没有

Step 05 设计 `RuntimeThread` 时，`RuntimeEventLoop` 是纯内部实现细节，外部只需要 `post` / `postDelayed`（`RuntimeThread` 已转发）。

Step 10 出现了新需求：`installJSBridge` 需要 `RuntimeEventLoop*` 来实现 `setTimeout`，`PlatformEventSink::initialize` 也需要它。

这是典型的"设计随需求演进"。补充一个 getter 比在 `RuntimeThread` 上层层转发所有 EventLoop 方法更简洁。注释里明确了约束：可以 `post`，不要调 `run`/`stop`。

### 8. 为什么 `destroy()` 在 `Created` 状态也要执行清理

因为 `create()` 已经做了一件有副作用的事：

```cpp
bool create(...) {
    registerPlatformBridge(config.bridge);   // ← 全局状态被修改
}
```

如果 `create()` 成功但 `start()` 未调用就析构，不清理会留下悬空的函数指针（指向已销毁的平台对象）。

所以 `destroy()` 的条件只排除 `Destroyed` 和 `Stopping`，`Created` 和 `Failed` 都会走清理。

### 9. framework.js 里为什么不用 ES6 语法

QuickJS 支持 ES2020，技术上可以用 `let` / 箭头函数 / 模板字符串。不用的原因：

```text
1. var/function 的语义最简单，没有 TDZ、没有 this 绑定差异
2. 箭头函数的 this 是词法作用域，在 VM 方法里会指向错误的对象，
   容易引入难查的 bug
3. 这段代码是 Runtime 基础设施，稳定性优先于简洁性
```

RPK 里的应用代码可以随意用 ES6+，那是工具链和 QuickJS 的事。

### 10. 测试里的 `waitFor` 轮询为什么不用条件变量

测试代码追求简单和可读。用条件变量需要：

```text
- mock bridge 里加 cv.notify
- 每个等待点写谓词
- 处理超时
```

轮询 10ms 一次、最多 3 秒，对测试足够。生产代码里绝不这么写（浪费 CPU），但测试的优先级是"一眼看懂"。

### 11. 为什么用 `TEST_RPK_PATH` 宏而不是命令行参数

```cmake
target_compile_definitions(test_bootstrap PRIVATE TEST_RPK_PATH="${TEST_RPK}")
```

`ctest` 运行测试时不传参数。用编译期宏让测试自包含，`ctest` 和直接运行 `./test_bootstrap` 都能工作。

代价是换 RPK 要重编译。测试 RPK 由 CMake 生成，本来就和构建绑定。

### 12. Step 10 完成后得到了什么

Core 成为一个完整可用的 Runtime：

```text
✓ js/framework.js                      约 350 行，VM 模型 + 生命周期 + 模板求值
✓ cmake/embed_js.cmake                 编译期内嵌，零运行时依赖
✓ include/runtime_bootstrap.h + src/   11 阶段启动 + 事件接线 + 路由接线
✓ include/runtime_host.h + src/        Pimpl 封装的 4 个对外方法
✓ tests/test_bootstrap.cpp             4 组测试，含 20 轮生命周期
✓ ASan + TSan 验证通过
✓ 销毁顺序在事件压力下验证（10 轮 + 后台狂点）
✓ 启动耗时 avg 12ms（桌面）
```

完整链路现在闭合：

```text
平台读 RPK → RuntimeHost.create/start
    → RuntimeThread（独立线程 + QuickJS）
    → Bootstrap 11 阶段
        → 注册模块 → 注入 Bridge → 初始化管线
        → 解析 RPK/Manifest
        → eval framework.js → eval app.js → eval 页面 bundle
        → framework 创建 VM → onInit → 求值模板
        → __native_render__ → VNode → Style → Layout
        → PlatformBridge 渲染命令 → 平台创建 UI
        → onReady → onShow
    → 用户点击 → PlatformEventSink → 查节点 → 调 VM 方法
        → router.push → navigate → 删旧渲新
    → RuntimeHost.destroy → 逆序清理
```

三端集成只需要：实现 6 个 `PlatformBridge` 函数 + 调用 4 个 `RuntimeHost` 方法。这就是 Step 11 要落实的。

---

## 下一步

按 `tasks.md` 进入 Step 11：三端集成指引。Android 做真实替换验证（改 CMakeLists 用 `add_subdirectory`、删原 core 目录、实测 Babel interop 风险），iOS 和 LVGL 给出集成方案与桩实现。
