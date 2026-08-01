# 交接文档：quickapp-runtime-js

本文档自包含，用于新会话编写 `quickapp-runtime-js` 的 spec 文档。**不需要读 quickapp-toolkit 的任何文档。**

## 目录

- [这个项目是什么](#这个项目是什么)
- [当前进度](#当前进度)
- [必读文件](#必读文件)
- [输入契约：bundle 的形状](#输入契约bundle-的形状)
- [双向接口清单](#双向接口清单)
- [已确定的设计决策](#已确定的设计决策)
- [现有实现基线](#现有实现基线)
- [剩余工作](#剩余工作)
- [文档规范](#文档规范)
- [新会话启动指令](#新会话启动指令)

---

## 这个项目是什么

`framework.js` —— 运行在 QuickJS 内的 JavaScript 框架层。

它是编译产物与 C++ Core 之间的适配层：

```text
RPK bundle（由工具链编译产出）
    ↓ 调用 $app_define$ / $app_bootstrap$
framework.js          ← 本项目
    ↓ 调用 __native_render__ / 响应 C++ 的事件回调
C++ Core（VNode 构建、布局、渲染命令）
    ↓
平台层（Android View / iOS UIKit / LVGL）
```

**运行环境约束：**

```text
引擎         QuickJS，支持 ES2020
无 Node API  没有 require、module、process、Buffer
无 DOM API   没有 document、fetch（typeof window 检测除外）
可用全局     C++ 注入的 $app_require$、__native_render__、console 等
```

**产物形态：** 单个 `framework.js` 文件，由 C++ 在执行任何 bundle 之前 `eval`。不打包、不压缩、不做模块化——它是被 eval 的脚本，不是 npm 模块。

**职责边界：**

| 负责 | 不负责 |
|---|---|
| 实现 `$app_define$` / `$app_bootstrap$` | 注入这两个函数到全局（C++ 做） |
| 组件注册表与 VM 创建 | JS 引擎生命周期（C++ 做） |
| 模板树遍历与函数属性求值 | VNode 构建、布局计算（C++ 做） |
| 生命周期钩子调度 | 渲染、View 创建（平台层做） |
| 方法名到 VM 方法的映射 | 事件的平台采集与投递（平台层做） |
| 页面栈的 JS 侧镜像 | 页面栈的权威状态（C++ Router 持有） |

---

## 当前进度

```text
quickapp-runtime-js/spec/
├── requirements.md   ✅ 312 行，10 个需求
├── design.md         ⚠️  478 行，写到 Testing Strategy
└── steps/            🔲 空
```

**design.md 已完成的章节：**

```text
Overview / 双向接口清单 / 启动序列 / Components and Interfaces
Data Models / nodeId 映射问题 / Correctness Properties（8 条）
Error Handling / Testing Strategy
```

**design.md 待写的章节：**

```text
Module Design        各组件的具体实现设计
Directory Structure  项目目录结构
Key Decisions        关键决策（其中两条已在正文中论证，需汇总）
```

`Key Decisions` 至少要包含这两条（正文里已有论证，需要汇总成决策条目）：

```text
1. bootstrap 与 page_create 的职责划分
   问题：bundle 被 eval 时会同步调用 $app_bootstrap$，而 C++ 也会调
   __page_create__，两者都想启动页面 —— 会重复。design.md 的「启动序列」
   章节提出了这个问题但标注「见 Key Decisions」，那一节还没写。
   
2. Resolved_Tree 的可选字段处理
   问题：现有实现无条件产出 children: [] 和 events: {}，而 bundle 产物里
   这两个字段是可选的（叶子节点无 children，无事件节点无 events）。
   C++ 侧读 undefined 和读空数组的处理路径不同，需要定哪种更安全。
```

---

## 必读文件

按顺序，**只读这些**：

1. `BBQ/docs/interview/BT/proj/quickapp-kit/HANDOFF-runtime-js.md` — 本文档
2. `BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-js/spec/requirements.md` — 已完成的需求
3. `BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-js/spec/design.md` — 已完成的设计部分
4. `quickapp-kit/quickapp-runtime-android/app/src/main/assets/framework.js` — 现有实现基线，约 110 行
5. `quickapp-kit/quickapp-runtime-android/app/src/main/cpp/core/src/js_bridge.cpp` — C++ 侧的注入实现

需要密度基准时，读一个已完成的 step 作为参考：

```text
BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-toolkit/spec/steps/09-rpk-packager.md
```

**只读它的结构和详细程度，不需要理解 toolkit 的内容。** 每个 step 的标准结构见本文档的「文档规范」。

---

## 输入契约：bundle 的形状

framework.js 的输入是编译好的 bundle。**这里给出完整契约，不需要去读工具链文档。**

### bundle 执行时会做什么

bundle 是一个 IIFE，被 `eval` 后同步做两件事：

```javascript
$app_define$('@app-component/index', [], function ($app_require$, $app_exports$, $app_module$) {
  // 执行页面的 script 代码，把结果挂到 $app_exports$
  // 然后挂载 template 和 style
  $app_module$.exports.template = /* JSON 树 */;
  $app_module$.exports.style = /* 样式对象 */;
});

$app_bootstrap$('@app-component/index', { packagerVersion: "1.0.0" });
```

### 组件名固定

```text
页面    @app-component/index
应用    @app-application/app
```

framework.js 按 name 前缀区分应用级和页面级：以 `@app-application` 开头的是应用。

### factory 的三个参数

顺序是 `($app_require$, $app_exports$, $app_module$)`。framework.js 调用 factory 时必须按这个顺序传。

### exports 的形状

factory 执行后，`$app_module$.exports` 上有：

```javascript
{
  private: { title: '...' },      // 数据源；可能是函数；可能不存在
  template: {                      // 页面必有，应用无
    type: 'div',
    attr: {},                      // 始终存在，可能为空对象
    classList: ['wrapper'],        // 始终存在，可能为空数组
    events: { click: 'onTap' },    // 仅当有事件绑定时存在
    children: [ /* 递归 */ ],      // 仅当有子节点时存在
  },
  style: {                         // 页面必有，可能为空对象
    '.wrapper': { flexDirection: 'column' },
    '.title': { fontSize: '40px', color: '#333333' },
  },
  onInit, onReady, onShow, onHide, onDestroy,   // 生命周期，都可选
  onTap, goAbout, /* ... */                      // 事件处理方法，任意名
  globalData: {}, onCreate,                      // 仅应用级
}
```

**四个关键点：**

**`attr` 和 `classList` 始终存在，`events` 和 `children` 可选。** 这个不一致来自官方工具链的实际产物形态，两侧都对齐它。遍历时 `events` 和 `children` 要判空。

**`attr` 中的值可能是函数。** 数据绑定 `{{title}}` 被编译为 `function () { return this.title }`。**是 function 表达式不是箭头函数**——所以 `.call(vm)` 能绑定 `this`。framework.js 必须用 `.call(vm)` 求值。

**`style` 的 key 是原始 CSS 选择器字符串**，属性名已转为 camelCase，属性值保留原始字符串（`'40px'` 不是数字 `40`）。framework.js 不解析样式，原样传给 C++。

**`exports.__esModule` 存在时要取 `exports.default`。** 编译产物是 ES module 转 CommonJS 的结果，真正的组件定义在 `exports.default` 上。判断逻辑：

```javascript
if (exports.__esModule && exports.default) {
  module.exports = exports.default;
}
```

### 一个真实的页面 bundle 片段

```javascript
'./index.script.js': function (module, exports, $app_require$) {
  Object.defineProperty(exports, '__esModule', { value: true });
  var _system = $app_require$('@app-module/system.router');
  exports.default = {
    private: { title: '欢迎体验快应用开发' },
    onInit() { this.count = 1; },
    onDetailBtnClick() {
      _system.default.push({ uri: '/pages/DemoDetail' });
    }
  };
}
```

注意 `_system.default.push` —— 系统模块的方法在 `.default` 下。这是 `$app_require$` 返回值形状决定的，framework.js 不介入。

---

## 双向接口清单

这是本项目最关键的契约。两侧各实现一半。

### framework.js 提供（C++ 调用）

```text
$app_define$(name, deps, factory)                bundle 注册组件
$app_bootstrap$(name, options)                   bundle 启动组件
__dispatch_event__(pageId, methodName, payload)   事件分发
__page_create__(pageId, componentName)            创建页面
__page_destroy__(pageId)                          销毁页面
```

前两个由 bundle 调用，后三个由 C++ 调用。**后三个是新增的，C++ 侧需要在对应时机调用它们。**

### framework.js 依赖（C++ 注入）

| 全局 | C++ 侧状态 | 位置 |
|---|---|---|
| `$app_require$(name)` | 已实现 | `js_bridge.cpp` 的 `native_app_require` |
| `__native_render__(tree, style)` | 已实现 | `js_bridge.cpp` 的 `native_render` |
| `console.log/warn/error` | 已实现 | `js_bridge.cpp` 的 `native_console_log` |
| `__set_title_bar__(pageId, text)` | **待实现** | 本项目对 C++ 提出的需求 |
| `__debug__` | **待实现** | 布尔变量，来自 manifest 的 `config.debug` |

后两项是本项目要向 C++ 侧提的接口需求，写文档时要明确标注。

### 降级要求

framework.js 对每个依赖的全局做存在性检查，缺失时记录错误并跳过该操作，**不能直接调用导致 `TypeError`**。理由是 C++ 侧的注入是分阶段实现的（Android 的 Task 1.5 才完成 JS Bridge），framework.js 要能在部分注入的环境下跑起来。

---

## 已确定的设计决策

这两条是写 requirements 和 design 过程中确定的，后续 steps 必须与之一致。

### 决策 1：事件分发传方法名，不传 nodeId

**接口：** `__dispatch_event__(pageId, methodName, payload)`

**问题背景：** nodeId 由 C++ 生成（`vnode.cpp` 的 `generateNodeId`），而事件回传时带的是 nodeId。如果按 nodeId 分发，framework.js 需要维护「nodeId → 模板节点」的映射，才能找到 `events` 配置里的方法名。

**为什么改成传方法名：** C++ 侧在构建 VNode 时已经读取了 `events`，并通过 `PlatformBridge.setEvent(id, eventType, methodName)` 把方法名传给平台层——方法名已经在 C++ 手里。事件回传时带上它，映射问题直接消失。

对照 `platform_bridge.h` 的签名可以确认这一点：

```cpp
void (*setEvent)(int id, const char* eventType, const char* methodName);
```

**代价：** framework.js 无法知道事件来自哪个节点。当前需求不需要（事件处理方法不接收节点信息）。将来若要实现 `$event.target`，需要改回按 nodeId 分发并维护映射。

**已同步：** requirements.md 的需求 6 和 design.md 的「nodeId 映射问题」章节都已按这个方案写。`NodeIndex` 组件已从设计中删除。

### 决策 2：页面栈以 C++ 为权威

C++ Router 持有页面栈的权威状态（`Page_Stack`），决定何时创建和销毁页面。framework.js 的栈只是 VM 状态的镜像，用于按 pageId 查找 VM 和判断栈顶。

**为什么：** 避免双向同步。两侧各持有一份可变状态且互相通知，会产生不一致窗口和竞态。单向权威让 framework.js 的栈操作只是「响应 C++ 的通知」。

**代价：** framework.js 不能主动发起页面切换。页面里的 `router.push` 走的是 `$app_require$` 拿到的 Router 对象，那是 C++ 的实现——framework.js 不参与。

### 决策 3：pageId 由 C++ 分配

framework.js 不生成 pageId，只使用 `__page_create__` 传入的值。

**为什么：** 两侧对页面的标识必须一致。C++ 侧的 Router、渲染命令、事件回传都用这个 ID，如果 JS 侧另生成一套，需要维护两套 ID 的映射。

### 决策 4：页面代码的异常不传回 C++

factory、生命周期钩子、事件处理方法、函数属性求值抛出的异常，全部在 framework.js 内捕获并记录。

**为什么：** C++ 调用 `__dispatch_event__` 时若收到 JS 异常，需要 `JS_GetException` 取出、转字符串、记录、清除——每个调用点都要写这套。在 JS 侧捕获让 C++ 侧只需检查返回值。

**代价：** 页面代码的错误不会中断执行流，可能在错误状态上继续。缓解方式是日志足够详细，且 `PageInstance.state` 状态机阻止在错误状态下的非法操作。

---

## 现有实现基线

Android 侧已有一份 framework.js（`app/src/main/assets/framework.js`，约 110 行），实现了最小链路。**新会话必须读它**——它是需求 1-5 的部分基线，也是唯一的现成参考。

**已实现：**

```text
$app_define$        组件注册，含 __esModule 分支
$app_bootstrap$     区分应用级与页面级，页面级创建 VM 并渲染
createVM            合并 private 数据和方法，挂载最简 $page
resolveTemplate     递归遍历模板树，函数属性用 .call(vm) 求值
```

**未实现：**

```text
事件分发        C++ 的事件回传无对应入口，点击无法进入 VM 方法
页面栈          router.push 后无法管理多个页面实例
生命周期        只有 onInit / onShow，缺 onReady / onHide / onDestroy
$page 的能力    setTitleBar 只打日志，未调用 C++
$app 接口       完全没有，页面无法访问应用级数据
数据更新        无响应式，VM 数据变化不触发重渲染（V1 范围外）
错误处理        无统一捕获，JS 错误直接冒泡到 C++
状态机          无 PageInstance.state，无法拒绝非法调用
```

**一个已确认的事实：** `factory` 在 `$app_define$` 时立即执行，不是延迟到 `$app_bootstrap$`。这决定了 bundle 里 script 顶层副作用的发生时机。现有代码：

```javascript
globalThis.$app_define$ = function(name, deps, factory) {
    var exports = {};
    var module = { exports: exports };
    factory($app_require$, exports, module);      // 立即执行
    if (exports.__esModule && exports.default) {
        module.exports = exports.default;
    }
    __components__[name] = module.exports;
};
```

**现有实现的两个可疑点，写文档时要给出结论：**

一是 `resolveTemplate` 无条件产出 `children: []` 和 `events: {}`，而输入契约里这两个字段是可选的。C++ 侧读空数组和读 undefined 的处理路径不同，需要确认哪种更安全。

二是 `$app_bootstrap$` 里页面级路径直接创建 VM 并渲染。但 C++ 也会调 `__page_create__`——两者都想启动页面，会重复。职责划分要在 design.md 的 Key Decisions 里定。

---

## 剩余工作

### 第一步：补完 design.md

三个章节：

```text
Module Design        各组件的实现设计
                     组件清单已在「Components and Interfaces」章节列出：
                     ComponentRegistry / AppState / PageStack / VMFactory /
                     TemplateResolver / LifecycleRunner / EventDispatcher /
                     Logger / Guard

Directory Structure  项目目录结构
                     注意：产物是单个 framework.js，但源码可以拆多文件后拼接，
                     也可以直接单文件。这个选择本身是个决策，要论证。

Key Decisions        汇总决策，至少包含：
                     - 本文档「已确定的设计决策」的 4 条
                     - bootstrap 与 page_create 的职责划分（待定）
                     - Resolved_Tree 的可选字段处理（待定）
                     - 单文件 vs 多文件拼接
                     - 为什么不做响应式数据更新（V1 范围）
```

### 第二步：写 tasks.md

按 requirements.md 的 10 个需求分解为 Phase 和 Task，标注需求覆盖矩阵。

建议的 Phase 划分（按依赖顺序）：

```text
Phase 1  框架骨架与注册         需求 1、2、10
Phase 2  VM 与模板求值          需求 3、4、9
Phase 3  生命周期与事件          需求 5、6
Phase 4  页面栈与联合验收        需求 7、8、全需求验收
```

### 第三步：写 steps

建议 12 个 step（可按实际调整）：

```text
01-framework-skeleton.md    IIFE 骨架、Guard、Logger、全局函数占位
02-component-registry.md    $app_define$ 实现、__esModule 分支、重复注册
03-app-bootstrap.md         应用级启动、onCreate、globalData、AppState
04-vm-factory.md            VM 创建、private 复制、方法绑定、数据方法冲突
05-template-resolver.md     模板树遍历、函数属性 .call(vm) 求值、可选字段
06-page-bootstrap.md        页面级启动序列、__native_render__ 调用
07-lifecycle.md             五个钩子、顺序保证、PageInstance 状态机
08-event-dispatch.md        __dispatch_event__、方法查找、异常捕获
09-page-stack.md            __page_create__ / __page_destroy__、onHide/onShow 联动
10-page-app-interface.md    $page.setTitleBar、$app 数据访问
11-error-logging.md         统一异常捕获、日志分级、__debug__
12-integration-verify.md    与 Android Runtime 的联合验收
```

Step 12 与工具链的 Step 11 契约验收是同一件事的两半——那一步验证编译产物，这一步验证 framework.js 的实现。可以共用验收清单。

---

## 文档规范

### 每个 step 的结构

```text
1. 目录（锚点链接）
2. 目标：一句话结论 + 职责表格 + 验收标准 + 本步不包含
3. 分小节实操步骤（Step N.1、N.2...）
4. 完整可粘贴代码块，带 @add / @update 标注
5. 单元测试（完整测试文件）
6. 逐层验证（命令 + 预期输出 + 常见错误排查表）
7. 技术决策（每条说明「为什么」和「代价是什么」）
8. QA（预判读者疑问，回答要有实质内容）
9. 下一步
```

单个 step 约 800-1800 行。

### 代码变更标注

```text
@add <路径>（新建文件）
@add <路径> — 在 <位置描述> 后插入
@update <路径> — 替换 <位置描述>
@update <路径>（整个替换）
```

### 注释要求

- 函数必须有 `@param`（含义、单位、取值范围）和 `@return`（成功/失败语义）
- 注释说明「为什么」，不重复「是什么」
- 关键决策点注释解释权衡

### 术语规范

**禁用词：** 「宿主」「能力合同」「第一性」

替代：容器 > 宿主；接口/注入的全局函数 > 能力；说明/解释 > 第一性解释

**三条通道严格区分，不能混写：**

```text
JS Bridge          JS ↔ C++，QuickJS C API 直调
PlatformBridge     C++ → Platform，渲染命令
PlatformEventSink  Platform → C++，事件
```

framework.js 只在 JS Bridge 这一层，不直接接触另两条。

### 测试约定

用 Node 内置 `node:test` + `node:assert`，不用 Jest。

framework.js 的测试方式：在 Node 中 `eval` 它，注入 mock 的全局函数，调用它暴露的全局函数并断言。**注意 framework.js 用 `globalThis.$app_define$ = ...` 定义全局，在测试里会污染进程全局**——design.md 的 Testing Strategy 章节提出了这个问题，但解决方案还没写，是 Step 01 要处理的事。

### 语言

全部用中文。风格平实直接，不用感叹号，不堆形容词。

---

## 新会话启动指令

```text
读取以下文件，然后继续编写 quickapp-runtime-js 的文档：

1. #File BBQ/docs/interview/BT/proj/quickapp-kit/HANDOFF-runtime-js.md
2. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-js/spec/requirements.md
3. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-js/spec/design.md
4. #File quickapp-kit/quickapp-runtime-android/app/src/main/assets/framework.js
5. #File quickapp-kit/quickapp-runtime-android/app/src/main/cpp/core/src/js_bridge.cpp

任务：按 HANDOFF 的「剩余工作」推进。先补完 design.md 的三个章节，
再写 tasks.md，然后逐个写 steps。

写入策略：新建文件时先写小开头（目录 + 目标，约 50 行），再用 fs_append
分批追加，每批 80-150 行。一次写大文件会导致生成被截断。

一个 step 写完后停下来等确认，不要连续写多个。
```

### 为什么限制读取范围

`quickapp-toolkit` 的文档有 20000 行，本项目不需要它——「输入契约：bundle 的形状」章节已经把 framework.js 需要知道的全部契约摘出来了。

读 toolkit 文档只会挤占上下文，且它的内部实现细节（编译器、打包器）与 framework.js 无关。

需要密度基准时读一个 step（推荐 `quickapp-toolkit/spec/steps/09-rpk-packager.md`），只看结构和详细程度。

### 一致性检查清单

```text
[ ] 术语：不用「宿主」「能力合同」「第一性」
[ ] 三条通道不混写
[ ] @add / @update 标注格式
[ ] 函数注释有 @param / @return
[ ] 技术决策说明「为什么」和「代价」
[ ] 组件名：@app-component/index 和 @app-application/app
[ ] 事件分发接口：__dispatch_event__(pageId, methodName, payload)
[ ] 函数属性用 .call(vm) 求值，不用箭头函数
[ ] pageId 由 C++ 分配，framework.js 不生成
[ ] 对 C++ 全局做存在性检查，缺失时降级
[ ] Step 之间的「下一步」指向正确
```

---

## 本次会话已完成的工作

### 1. C++ 侧空壳注入已删除

**文件：** `quickapp-kit/quickapp-runtime-android/app/src/main/cpp/core/src/js_bridge.cpp`

已删除 `native_app_define` 和 `native_app_bootstrap` 函数体，以及 `installJSBridge` 中对应的两行注入。加了注释说明这些由 framework.js 定义。

**删除前 installJSBridge 注入了：**

```text
$app_define$      ← 空壳，只打日志，被 framework.js 覆盖
$app_bootstrap$   ← 空壳，只打日志，被 framework.js 覆盖
$app_require$     ← 有实际逻辑（模块查找），保留
__native_render__ ← 有实际逻辑（VNode 构建），保留
console           ← 有实际逻辑（Android Log），保留
```

**删除后 installJSBridge 只注入：**

```text
$app_require$
__native_render__
console
```

**确认无残留：** 全项目 `*.cpp` / `*.h` 中搜索 `native_app_define` / `native_app_bootstrap` 均无结果。

### 2. Android spec step 文档已同步

**文件：** `BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-android/spec/steps/05-js-bridge.md`

同步删除了文档中 `native_app_define` / `native_app_bootstrap` 的代码段和注入行，改为注释说明由 framework.js 定义。

**Core 侧无需改动：** `quickapp-runtime-core/spec/steps/07-module-jsbridge.md` 本来就没注入这两个，它的 `installJSBridge` 只注入 `$app_require$`、`console`、`setTimeout`、`__native_render__`——已经符合方案。

### 3. framework.js 侧的改进方案（待实现）

现有 framework.js（约 110 行）有以下问题需要在新 session 中处理：

#### 问题清单

| # | 问题 | 影响 |
|---|---|---|
| 1 | 无依赖降级检测 | `$app_define$` 里直接用 `$app_require$`，如果 C++ 未注入会 TypeError 崩溃 |
| 2 | 无异常捕获 | factory / 生命周期 / 事件方法抛异常直接冒泡到 C++ |
| 3 | 无页面栈 | 只能跑单页，`comp.__vm__` 挂在定义上而非独立的 PageInstance |
| 4 | 无事件分发入口 | 缺 `__dispatch_event__` / `__page_create__` / `__page_destroy__` |
| 5 | resolveTemplate 可选字段处理 | 无条件产出 `children: []` / `events: {}`，原树没有时也产出 |
| 6 | $app_bootstrap$ 与 __page_create__ 职责重叠 | 页面 bundle eval 时 bootstrap 会创建 VM 并渲染，C++ 又会调 __page_create__ |
| 7 | 无日志分级 | 全部用 console.log，无 debug 标志控制 |
| 8 | $page.setTitleBar 只打日志 | 未调用 `__set_title_bar__` |
| 9 | 无 $app 接口 | 页面无法访问应用级 globalData |

#### 改进方案要点

```text
1. Guard 模式：对所有 C++ 全局做 typeof 检测后再调用
   if (typeof $app_require$ !== 'function') { log error; return; }

2. 统一异常捕获：每个外部入口（$app_define$、$app_bootstrap$、
   __dispatch_event__、__page_create__、__page_destroy__）用 try/catch 包裹

3. 页面栈：用数组存 PageInstance，__page_create__ 压栈，__page_destroy__ 弹栈

4. bootstrap 与 page_create 的职责划分（Key Decision 待定）：
   方案 A — bootstrap 只注册，不启动页面；启动统一走 __page_create__
   方案 B — bootstrap 启动首页（兼容现有行为），__page_create__ 处理后续页面
   倾向方案 A：bundle eval 时 $app_bootstrap$ 对页面级组件只标记"已注册可启动"，
   真正的 VM 创建和渲染等 C++ 调 __page_create__ 时再做。
   理由：职责清晰，C++ 侧控制时序。

5. resolveTemplate 的可选字段：遵循"原树有才产出"原则
   if (template.children) { resolved.children = [...]; }
   if (template.events) { resolved.events = template.events; }
   不产出空数组/空对象，C++ 侧读 undefined 时应跳过遍历。
```

---

## 新 session 的衔接指令

```text
读取以下文件：

1. #File BBQ/docs/interview/BT/proj/quickapp-kit/HANDOFF-runtime-js.md
2. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-js/spec/requirements.md
3. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-js/spec/design.md
4. #File quickapp-kit/quickapp-runtime-android/app/src/main/assets/framework.js
5. #File quickapp-kit/quickapp-runtime-android/app/src/main/cpp/core/src/js_bridge.cpp

任务：
1. 先改写 framework.js —— 按「本次会话已完成的工作」第 3 节的方案实现：
   - 加 Guard（依赖降级检测）
   - 加统一异常捕获
   - 加 Logger（分级日志 + __debug__ 控制）
   - 加页面栈（PageInstance + __page_create__ / __page_destroy__）
   - 加事件分发（__dispatch_event__）
   - 修正 resolveTemplate 的可选字段
   - 修正 bootstrap 的职责（页面级只注册不启动）
   - 加 $page（调 __set_title_bar__）和 $app 接口

2. 改完后继续推进 design.md 的三个空章节（Module Design / Directory Structure / Key Decisions）

写入策略：framework.js 直接整文件覆盖（约 200-300 行，在限制内）。
design.md 分批 fs_append，每批 80-150 行。
```
