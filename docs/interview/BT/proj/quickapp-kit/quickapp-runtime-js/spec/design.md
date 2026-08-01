# Design Document

## 目录

- [Overview](#overview)
- [双向接口清单](#双向接口清单)
- [启动序列](#启动序列)
- [Components and Interfaces](#components-and-interfaces)
- [Data Models](#data-models)
- [nodeId 映射问题](#nodeid-映射问题)
- [Correctness Properties](#correctness-properties)
- [Error Handling](#error-handling)
- [Testing Strategy](#testing-strategy)
- [Module Design](#module-design)
- [Directory Structure](#directory-structure)
- [Key Decisions](#key-decisions)

---

## Overview

framework.js 是 RPK 产物与 C++ Core 之间的适配层。它的全部输入输出都是全局函数——没有模块系统，没有文件 IO，没有网络。

核心特征：
- 单文件、被 `eval`、不打包
- 无外部依赖，只用 ES2020 语法和 C++ 注入的全局函数
- 无状态外泄：全部状态在一个 IIFE 闭包内
- 所有页面代码的异常都被捕获，不传回 C++

它不做的事：
- 不实现 `$app_require$`（C++ 做）
- 不构建 VNode、不算布局、不渲染（C++ 和平台层做）
- 不持有页面栈的权威状态（C++ Router 做）
- 不做响应式数据更新（V1 范围外）

---

## 双向接口清单

这是本项目最关键的契约。两侧各自实现一半，任何一侧的缺失都会让链路断掉。

### framework.js 提供（C++ 调用）

```text
$app_define$(name, deps, factory)              bundle 注册组件
$app_bootstrap$(name, options)                 bundle 启动组件
__dispatch_event__(pageId, nodeId, type, data) 事件分发
__page_create__(pageId, componentName)         创建页面
__page_destroy__(pageId)                       销毁页面
```

前两个由 bundle 调用而非 C++ 直接调用，但它们是 framework.js 暴露给外部的入口，归在同一类。

### framework.js 依赖（C++ 注入）

| 全局 | C++ 侧状态 | 说明 |
|---|---|---|
| `$app_require$(name)` | 已实现 | `js_bridge.cpp` 的 `native_app_require` |
| `__native_render__(tree, style)` | 已实现 | `js_bridge.cpp` 的 `native_render` |
| `console.log/warn/error` | 已实现 | `js_bridge.cpp` 的 `native_console_log` |
| `__set_title_bar__(pageId, text)` | **待实现** | 本项目对 C++ 提出的需求 |
| `__debug__` | **待实现** | 布尔变量，来自 manifest 的 `config.debug` |

**注入顺序的约束：** `$app_require$` 必须在 `eval(framework.js)` 之前注入吗？不必——framework.js 只在 factory 执行时才用它，而 factory 执行发生在 bundle 被 eval 时。但 C++ 侧当前的顺序（`installJSBridge` → `eval(framework.js)` → `eval(bundle)`）已经满足要求，不需要改。

**注入检测：** framework.js 对每个依赖的全局做存在性检查，缺失时降级并记录错误，而不是直接调用导致 `TypeError`。理由见 Key Decisions。

---

## 启动序列

完整的冷启动链路，标注每一步的责任方：

```text
[C++]  installJSBridge()
         注入 $app_require$ / __native_render__ / console / __set_title_bar__ / __debug__
           ↓
[C++]  eval(framework.js)
         framework.js 的 IIFE 执行，定义 5 个全局函数，初始化空的 Component_Registry
           ↓
[C++]  eval(app.js)
         ↓
[JS]     bundle 调用 $app_define$('@app-application/app', [], factory)
           framework 立即执行 factory，得到应用定义，存入 Registry
         bundle 调用 $app_bootstrap$('@app-application/app', opts)
           framework 识别为应用级：调用 onCreate，保存 globalData，标记应用已初始化
           ↓
[C++]  Router 决定入口页面，分配 pageId，调用 __page_create__(pageId, '@app-component/index')
         ↓
[JS]     framework 从 Registry 取组件定义
         创建 VM（合并 private 数据 + 方法 + $page + $app）
         创建 Page_Instance，压入页面栈
         调用 onInit
         遍历 Template_Tree，求值 Function_Attribute，得到 Resolved_Tree
         调用 __native_render__(resolvedTree, styleSheet)
           ↓
[C++]      构建 VNode（分配 nodeId）→ StyleResolver → Layout → PlatformBridge
             ↓
[平台]       创建 View，注册事件监听器
           ↓
[JS]     调用 onReady
         调用 onShow
           ↓
       首屏完成
```

**注意 `eval(bundle)` 里 define 和 bootstrap 是连续同步执行的**——bundle 的结构就是 `$app_define$(...)` 紧跟 `$app_bootstrap$(...)`（toolkit 的 design.md 约束 3）。所以页面 bundle 被 eval 时会立即触发一次 bootstrap。

这带来一个问题：**页面 bundle 的 `$app_bootstrap$` 与 C++ 的 `__page_create__` 会重复启动页面吗？**

会。解决方式见 Key Decisions 的「bootstrap 与 page_create 的职责划分」。

### 事件链路

```text
[平台]  用户点击 View
          ↓
[平台]  事件监听器回调，带 nodeId
          ↓
[C++]   PlatformEventSink 收到事件，投递到 Runtime Thread
          ↓
[C++]   在 Runtime Thread 上调用 __dispatch_event__(pageId, nodeId, 'click', null)
          ↓
[JS]    framework 按 pageId 找 Page_Instance
        按 nodeId 找 Template_Tree 节点的 events 配置
        取出 events.click 的方法名
        在 VM 上按名查找方法，以 VM 为 this 调用
          ↓
[JS]    VM 方法执行，可能调用 router.push
          ↓
[C++]   Router 处理 push，销毁旧页面、创建新页面
          ↓
[JS]    __page_destroy__ / __page_create__
```

### 路由链路

```text
[JS]  VM 方法调用 router.push({ uri: '/pages/About' })
        ↓
[C++] native_router_push 收到调用
      Router 解析 uri，从 manifest 找到组件名
      分配新 pageId
      读取并 eval 目标页面的 bundle    <- 注意这一步
        ↓
[JS]    目标 bundle 调用 $app_define$ + $app_bootstrap$
        ↓
[C++] 调用 __page_create__(newPageId, componentName)
        ↓
[JS]  framework 创建新页面的 VM 并渲染
      对旧栈顶调用 onHide
```

`eval` 目标 bundle 这一步会再次触发 `$app_define$`（同名组件重复注册，需求 1.4 要求覆盖并 warning）和 `$app_bootstrap$`。这是 bootstrap 与 page_create 职责重叠的根源。

---

## Components and Interfaces

| 组件 | 职责 | 状态 |
|---|---|---|
| `ComponentRegistry` | 组件名 → 组件定义的映射 | 全局单例，闭包内 |
| `AppState` | 应用级状态：globalData、是否已初始化 | 全局单例 |
| `PageStack` | Page_Instance 的栈，按 pageId 索引 | 全局单例 |
| `VMFactory` | 从组件定义创建 VM 实例 | 无状态函数 |
| `TemplateResolver` | 遍历 Template_Tree，求值 Function_Attribute | 无状态函数 |
| `LifecycleRunner` | 按顺序调用生命周期钩子，捕获异常 | 无状态函数 |
| `EventDispatcher` | 事件到 VM 方法的路由 | 无状态函数 |
| `Logger` | 分级日志，debug 标志控制 | 全局单例 |
| `Guard` | 全局函数的存在性检查与安全调用 | 无状态函数 |

### 关键接口边界

```text
Registry 只存定义，不存实例      —— 实例在 PageStack 里
PageStack 只镜像 C++ 的栈        —— 不主动决定创建销毁
TemplateResolver 不修改原树      —— 产出新的 Resolved_Tree
Guard 包裹所有对 C++ 全局的调用   —— 缺失时降级而非崩溃
```

---

## Data Models

### ComponentDefinition

bundle 的 factory 执行后得到的对象。framework.js 不构造它，只消费。

```javascript
/**
 * 组件定义，来自 bundle 的 exports.default。
 *
 * 字段的存在性由 toolkit 的产物格式契约保证（见 toolkit 的
 * design.md「Bundle 产物格式」）：
 *   template  页面必有，应用无
 *   style     页面必有（可能是空对象），应用无
 *   private   可选，无则 VM 无初始数据
 *   其他函数   生命周期钩子和事件处理方法
 */
{
  private: { title: '...' } | function,   // 数据源
  template: { type, attr, classList, events, children },
  style: { '.cls': { prop: value } },
  onInit, onReady, onShow, onHide, onDestroy,  // 生命周期（可选）
  onXxx,                                        // 事件处理方法（任意名）
  globalData: {},                               // 仅应用级
  onCreate,                                     // 仅应用级
}
```

### PageInstance

```javascript
/**
 * 一个页面的运行时状态。
 *
 * pageId 由 C++ 分配，framework.js 只使用不生成 —— 这保证两侧
 * 对页面的标识一致。
 */
{
  pageId: 1,                    // C++ 分配的页面 ID
  componentName: '@app-component/index',
  vm: {},                       // VM 实例
  definition: {},               // ComponentDefinition 引用
  state: 'created' | 'ready' | 'visible' | 'hidden' | 'destroyed',
}
```

`state` 的作用是拒绝非法的生命周期调用（需求 5.10）。状态转换：

```text
created --onReady--> ready --onShow--> visible
                                          ↕ onHide / onShow
                                       hidden
                                          |
                                     onDestroy
                                          ↓
                                      destroyed
```

`destroyed` 是终态，任何后续操作都被拒绝。

### ResolvedNode

`TemplateResolver` 的输出，传给 `__native_render__`。

```javascript
/**
 * 求值后的节点。与 Template_Tree 的差异：
 *   attr 中的函数已替换为求值结果
 *   结构和其他字段保持不变
 *
 * 字段的存在性要与 C++ 侧 VNode 构建的读取方式对齐：
 * C++ 读 node.type / node.attr / node.classList / node.events / node.children
 */
{
  type: 'text',
  attr: { value: '求值后的字符串' },
  classList: ['title'],
  events: { click: 'onTap' },     // 仅当原树有
  children: [],                    // 仅当原树有
}
```

**一个待确认点：** 当前 Android 的 framework.js 在 `resolveTemplate` 里无条件产出 `children: []` 和 `events: {}`，即使原树没有这两个字段。而 toolkit 的产物里这两个字段是可选的（叶子节点无 `children`，无事件节点无 `events`）。

C++ 侧读取时用 `JS_GetPropertyStr` 取不存在的属性会得到 `undefined`，遍历前应有判断。空数组和 undefined 在 C++ 侧的处理路径不同，需要确认哪种更安全——见 Key Decisions。

---

## nodeId 映射问题

这是本项目最需要设计的部分，因为 **nodeId 由 C++ 生成，而事件分发需要在 JS 侧按 nodeId 找到模板节点。**

### 问题的产生

C++ 在构建 VNode 时分配 nodeId（`vnode.cpp` 的 `generateNodeId`），平台层的事件回传带的是这个 ID。但 framework.js 传给 C++ 的 Resolved_Tree 里没有 ID——它不知道 C++ 会怎么编号。

事件到达时，framework.js 拿到 `nodeId`，需要找到对应节点的 `events` 配置才能知道调用哪个 VM 方法。

### 三种方案

**方案 A：JS 侧生成 ID，随树传给 C++**

framework.js 在 `resolveTemplate` 时为每个节点分配 ID，写入 Resolved_Tree 的 `nodeId` 字段。C++ 使用这个 ID 而不是自己生成。

```text
优点  JS 侧天然持有映射，无需额外通信
缺点  要改 C++ 的 VNode 构建逻辑（当前是自己 generateNodeId）
      两侧的 ID 生成职责需要重新划分
```

**方案 B：C++ 回传 ID 映射**

C++ 构建完 VNode 后，把「遍历序号 → nodeId」的映射回传给 JS。JS 按相同的遍历顺序建立映射。

```text
优点  不改 C++ 的 ID 生成
缺点  依赖两侧遍历顺序完全一致 —— 脆弱，且任何一侧的遍历变更都会静默错位
      需要新增一个回传通道
```

**方案 C：事件配置随树下传，C++ 侧持有并回传方法名**

framework.js 不维护映射。`events` 已经在 Resolved_Tree 里传给 C++，C++ 在构建 VNode 时把 `events.click` 的方法名存在 VNode 上。事件发生时，C++ 直接回传方法名而非 nodeId。

```javascript
// 接口变为
__dispatch_event__(pageId, methodName, payload)
```

```text
优点  JS 侧无需任何映射，实现最简
      C++ 侧本来就要读 events 传给 PlatformBridge 的 setEvent
缺点  JS 侧无法知道是哪个节点触发的（如果将来需要）
```

### 选择方案 C

**理由：** 它消除了整个映射问题，而不是解决它。

C++ 侧本来就需要读取 `events` 并通过 `PlatformBridge.setEvent(id, eventType, methodName)` 传给平台层——方法名已经在 C++ 手里了。事件回传时带上它，比让 JS 侧维护一份 nodeId 映射简单得多。

对照 Android 的 `platform_bridge.h`，`setEvent` 的签名正是 `(int id, const char* eventType, const char* methodName)`——方法名已经流到平台层了。平台层回传时带上它是自然的。

**代价：** framework.js 无法知道事件来自哪个节点。当前需求不需要这个信息（事件处理方法不接收节点信息）。如果将来需要（比如实现 `$event.target`），要回到方案 A。

**需求 6 的调整：** requirements.md 的需求 6 按 nodeId 描述，采用方案 C 后接口变为 `__dispatch_event__(pageId, methodName, payload)`，需求 6.3 和 6.7（按 nodeId 查找节点）不再适用。NodeIndex 组件也不需要了。

这是设计阶段推翻需求假设的例子——需求写的时候假设了 nodeId 方案，设计时发现有更简单的路径。requirements.md 应同步更新。

---

## Correctness Properties

### Property 1：函数属性以 VM 为 this 求值

Template_Tree 中 `attr` 的每个函数值，求值时 `this` 必须是该页面的 VM 实例。

**Validates: 需求 4.1, 4.2**

这是整条链路最容易失效的一环。toolkit 侧保证产出 `function` 表达式而非箭头函数（否则 `.call(vm)` 无效），framework.js 侧保证用 `.call(vm)` 调用。两侧都对才成立。

### Property 2：生命周期顺序不变

同一页面的生命周期调用顺序恒为：

```text
onInit → onReady → onShow → [onHide → onShow]* → onHide → onDestroy
```

**Validates: 需求 5.7**

### Property 3：destroyed 是终态

页面进入 destroyed 后，任何生命周期钩子调用、事件分发、渲染请求都被拒绝。

**Validates: 需求 5.10, 6.9**

### Property 4：页面代码异常不传回 C++

factory、生命周期钩子、事件处理方法、Function_Attribute 抛出的异常必须在 framework.js 内被捕获。

**Validates: 需求 10.1, 10.3**

C++ 侧调用 `__dispatch_event__` 时若收到 JS 异常，`JS_Call` 返回异常值，需要额外的错误处理路径。在 JS 侧捕获让 C++ 侧的调用点更简单。

### Property 5：Resolved_Tree 与 Template_Tree 结构同构

节点层次、兄弟顺序、`type`/`classList`/`events` 完全一致，只有 `attr` 中的函数值被替换。

**Validates: 需求 4.3, 4.4, 4.5, 4.6**

### Property 6：pageId 由 C++ 唯一分配

framework.js 不生成 pageId，只使用 C++ 传入的值。两侧对页面的标识始终一致。

**Validates: 需求 8.2, 8.6**

### Property 7：C++ 全局缺失时降级而非崩溃

任何 C++ 注入的全局函数缺失时，framework.js 记录错误并跳过该操作，不抛出 `TypeError`。

**Validates: 需求 4.10, 9.7, 10.8**

### Property 8：应用未初始化不阻塞页面

应用级 bootstrap 失败或未执行时，页面仍能启动，`$app` 的数据访问返回空对象。

**Validates: 需求 2.5, 9.8**

---

## Error Handling

错误按来源分类。framework.js 的原则是：**页面代码的错误记录后继续，框架自身的错误也记录后降级。**

| 来源 | 示例 | 处理 |
|---|---|---|
| factory 执行 | bundle 里的顶层语法或运行时错误 | 捕获，不注册该组件，记录组件名 |
| 组件未注册 | bootstrap 一个未 define 的名字 | 记录错误，终止本次启动 |
| private 求值 | `private` 是函数且抛异常 | 捕获，VM 无初始数据，记录组件名 |
| Function_Attribute | `{{this.a.b}}` 而 `a` 是 undefined | 捕获，该属性设为空字符串，记录节点类型和属性名 |
| 生命周期钩子 | `onInit` 里访问未定义的变量 | 捕获，记录钩子名和 pageId，继续后续流程 |
| 事件处理方法 | 点击回调里抛异常 | 捕获，记录方法名和 pageId |
| VM 方法不存在 | events 指向的方法名拼错 | 记录错误，含方法名和 pageId |
| C++ 全局缺失 | `__native_render__` 未注入 | 记录错误，跳过渲染 |
| 状态非法 | 对 destroyed 页面调用钩子 | 记录 warning，拒绝执行 |

### 日志格式

```text
[framework] 消息                    框架级事件
[framework:3] 消息                  页面级事件，3 是 pageId
```

级别由 `__debug__` 控制：为 false 时只输出 error。

**为什么不用异常传播：** framework.js 的调用方是 C++。`JS_Call` 返回异常时，C++ 需要 `JS_GetException` 取出、转字符串、记录、清除——每个调用点都要写这套。在 JS 侧捕获让 C++ 侧只需检查返回值。

代价是页面代码的错误不会中断执行流，可能导致后续操作在错误状态上继续。缓解方式是日志足够详细，且状态机（`PageInstance.state`）阻止在错误状态下的非法操作。

---

## Testing Strategy

framework.js 运行在 QuickJS 里，但测试可以在 Node 上跑——它只用 ES2020 语法和注入的全局函数，两个引擎都支持。

### 单元测试

在 Node 中 `eval` framework.js，注入 mock 的全局函数，然后调用它暴露的全局函数并断言。

```javascript
// 测试骨架
const injected = {
  $app_require$: mockRequire,
  __native_render__: (tree, style) => { renderCalls.push({ tree, style }); },
  __set_title_bar__: (id, text) => { titleCalls.push({ id, text }); },
  __debug__: true,
  console: mockConsole,
};

const fn = new Function(...Object.keys(injected), frameworkSource + '; return { $app_define$, $app_bootstrap$, __dispatch_event__, __page_create__, __page_destroy__ };');
const api = fn(...Object.values(injected));
```

**注意 framework.js 用 `globalThis.$app_define$ = ...` 定义全局。** 在 `new Function` 里 `globalThis` 是真实的全局对象，会污染测试进程。测试时需要处理这一点——见 Testing 的设计细节。

覆盖点：

```text
组件注册      正常注册、__esModule 分支、重复注册、factory 抛异常
应用启动      onCreate 调用、globalData 保存、onCreate 抛异常
VM 创建       private 复制、private 为函数、方法复制、数据与方法冲突
模板求值      函数属性求值、静态属性、嵌套、events/classList 保持、求值抛异常
生命周期      顺序、缺失钩子、钩子抛异常、destroyed 拒绝
事件分发      正常分发、payload 传递、方法不存在、pageId 不存在、方法抛异常
页面栈        create/destroy、onHide/onShow 联动、栈顶变化
接口对象      $page.setTitleBar 调用 C++、$app 数据访问、应用未初始化
降级          各个 C++ 全局缺失时的行为
```

### 集成测试

用 toolkit 编译一个真实项目，取出 bundle，在 Node 中按 C++ 的顺序 eval，断言 `__native_render__` 收到的 Resolved_Tree 正确。

```text
eval(framework.js) → eval(app.js) → __page_create__ → 断言 render 调用
→ __dispatch_event__ → 断言 VM 方法执行 → 断言 router.push 被调用
```

这个测试跨越 toolkit 和 runtime-js 两个项目，是它们的契约测试。

### 与 C++ 的联合验收

在 Android 真机上跑通完整链路。这是 toolkit 的 Step 11 契约验收的另一半——那一步验证 toolkit 的产物，这一步验证 framework.js 的实现。

两者共用同一份验收清单。
