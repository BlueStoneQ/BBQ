# Requirements Document

## 目录

- [Introduction](#introduction)
- [Glossary](#glossary)
- [现状基线](#现状基线)
- [Requirements](#requirements)
  - [需求 1：组件注册](#需求-1组件注册)
  - [需求 2：应用启动](#需求-2应用启动)
  - [需求 3：页面启动与 VM 创建](#需求-3页面启动与-vm-创建)
  - [需求 4：数据绑定求值](#需求-4数据绑定求值)
  - [需求 5：页面生命周期](#需求-5页面生命周期)
  - [需求 6：事件分发](#需求-6事件分发)
  - [需求 7：系统模块访问](#需求-7系统模块访问)
  - [需求 8：页面栈与路由协作](#需求-8页面栈与路由协作)
  - [需求 9：页面接口对象](#需求-9页面接口对象)
  - [需求 10：错误处理与日志](#需求-10错误处理与日志)

---

## Introduction

QuickApp Runtime JS — 运行在 QuickJS 内的 JavaScript 框架层，即 `framework.js`。

它是 RPK 产物与 C++ Core 之间的适配层：

```text
RPK bundle（toolkit 产出）
    ↓ 调用 $app_define$ / $app_bootstrap$
framework.js          ← 本项目
    ↓ 调用 __native_render__ / 响应 C++ 的事件回调
C++ Core
```

职责边界：

| 负责 | 不负责 |
|---|---|
| 实现 `$app_define$` / `$app_bootstrap$` | 注入这两个函数到全局（C++ 做） |
| 组件注册表与 VM 创建 | JS 引擎生命周期（C++ 做） |
| 模板树遍历与函数属性求值 | VNode 构建、布局计算（C++ 做） |
| 生命周期钩子调度 | 渲染、View 创建（平台层做） |
| 事件名到 VM 方法的映射 | 事件的平台采集与投递（平台层做） |
| 页面栈的 JS 侧状态 | 页面栈的权威状态（C++ Router 持有） |

运行环境约束：

```text
引擎     QuickJS，支持 ES2020
无 Node API      没有 require、module、process、Buffer
无 DOM API       没有 document、window、fetch（window 检测除外）
可用的全局       $app_require$、__native_render__、console（C++ 注入）
```

产物形态：单个 `framework.js` 文件，由 C++ 在执行任何 RPK bundle 之前 `eval`。不打包、不压缩、不做模块化——它是被 `eval` 的脚本，不是模块。

## Glossary

- **framework.js：** 本项目的唯一产物，运行在 QuickJS 内的框架层脚本
- **Component_Registry：** `$app_define$` 注册的组件表，key 是组件名，value 是组件定义对象
- **Component_Definition：** bundle 中 `$app_define$` 的 factory 执行后得到的对象，含 `private`、`template`、`style` 和方法
- **VM：** 页面的视图模型实例，由 Component_Definition 派生，持有数据字段和绑定了 `this` 的方法
- **Template_Tree：** bundle 中 `exports.template` 的 JSON 树，节点含 `type`、`attr`、`classList`、`events`、`children`
- **Resolved_Tree：** Template_Tree 经过函数属性求值后的树，`attr` 中的函数已替换为求值结果
- **Function_Attribute：** Template_Tree 节点 `attr` 中值为函数的属性，由数据绑定 `{{}}` 编译而来，需以 VM 为 `this` 求值
- **Page_Instance：** 一个页面的运行时状态，含 VM、Component_Definition 引用、页面 ID 和生命周期状态
- **Page_Interface：** VM 上的 `$page` 对象，页面调用它操作标题栏等页面级能力
- **App_Interface：** VM 上的 `$app` 对象，页面通过它访问应用级数据
- **Native_Render：** C++ 注入的 `__native_render__(resolvedTree, styleSheet)`，framework.js 调用它触发渲染
- **Native_Module：** 通过 `$app_require$('@app-module/system.xxx')` 获得的系统能力对象

---

## 现状基线

Android 侧当前已有一份 framework.js（`app/src/main/assets/framework.js`，约 110 行），实现了最小链路：

**已实现：**

```text
$app_define$        组件注册，含 __esModule 分支
$app_bootstrap$     区分应用级与页面级，页面级创建 VM 并渲染
createVM            合并 private 数据和方法，挂载最简 $page
resolveTemplate     递归遍历模板树，函数属性用 .call(vm) 求值
```

**未实现：**

```text
事件分发            C++ 的 dispatchClick 无对应入口，点击无法进入 VM 方法
页面栈              router.push 后无法管理多个 Page_Instance
生命周期            只有 onInit / onShow，缺 onReady / onHide / onDestroy
$page 的实际能力     setTitleBar 只打日志，未调用 C++
$app 接口           完全没有，页面无法访问应用级数据
数据更新            无响应式，VM 数据变化不触发重渲染
错误处理            无统一的异常捕获，JS 错误直接冒泡到 C++
```

本项目的需求覆盖上述全部内容。现有实现作为需求 1-5 的部分基线，其余从零设计。

**基线的一个重要事实：** `factory` 在 `$app_define$` 时立即执行，不是延迟到 `$app_bootstrap$`。这决定了 script 顶层副作用的发生时机，也是 toolkit 侧单测 mock 的依据。

---

## Requirements

### 需求 1：组件注册

**用户故事：** 作为 RPK bundle，我需要通过 `$app_define$` 注册组件定义，以便后续启动时能按名取用。

#### 验收标准

1. WHEN bundle 调用 `$app_define$(name, deps, factory)` 时，THE framework SHALL 立即执行 factory，传入 `$app_require$`、`exports` 和 `module` 三个参数
2. WHEN factory 执行完成且 `exports.__esModule` 为真值且 `exports.default` 存在时，THE framework SHALL 把 `module.exports` 替换为 `exports.default`
3. WHEN factory 执行完成后，THE Component_Registry SHALL 以 name 为 key 存储 `module.exports`
4. WHEN 同一个 name 被重复注册时，THE framework SHALL 用新的定义覆盖旧的，并记录 warning 级别日志
5. IF factory 执行抛出异常，THEN THE framework SHALL 捕获该异常、记录含组件名和堆栈的错误日志，且不把该组件加入 Component_Registry
6. THE framework SHALL 在 `$app_define$` 返回前完成注册，使紧随其后的 `$app_bootstrap$` 能取到该组件

---

### 需求 2：应用启动

**用户故事：** 作为 Runtime，我需要在页面加载前初始化应用级状态，以便页面能访问应用级数据。

#### 验收标准

1. WHEN `$app_bootstrap$` 收到的 name 以 `@app-application` 开头时，THE framework SHALL 按应用级路径处理，不创建 VM 也不渲染
2. WHEN 应用组件定义中存在 `onCreate` 方法时，THE framework SHALL 以应用组件定义为 `this` 调用它
3. WHEN 应用组件定义中存在 `globalData` 字段时，THE framework SHALL 保存它，供页面通过 App_Interface 访问
4. WHEN 应用启动完成后，THE framework SHALL 记录应用已初始化的状态
5. IF 页面启动时应用尚未初始化，THEN THE framework SHALL 记录 warning 但继续启动页面（应用级数据为空对象）
6. IF `onCreate` 抛出异常，THEN THE framework SHALL 捕获并记录错误，且不阻止后续页面启动

---

### 需求 3：页面启动与 VM 创建

**用户故事：** 作为页面 bundle，我需要框架把我的定义转为可运行的 VM 实例，以便数据和方法能协同工作。

#### 验收标准

1. WHEN `$app_bootstrap$` 收到的 name 不以 `@app-application` 开头时，THE framework SHALL 按页面级路径处理
2. IF Component_Registry 中不存在该 name，THEN THE framework SHALL 记录错误日志并终止本次启动，不抛出异常到 C++
3. WHEN 创建 VM 时，THE framework SHALL 把 Component_Definition 的 `private` 字段的每个属性复制到 VM 上
4. WHEN `private` 是函数时，THE framework SHALL 调用它并使用返回值作为数据源
5. WHEN 创建 VM 时，THE framework SHALL 把 Component_Definition 上所有函数类型的属性复制到 VM 上
6. WHEN 创建 VM 时，THE framework SHALL 在 VM 上挂载 Page_Interface（`$page`）和 App_Interface（`$app`）
7. WHEN VM 创建完成后，THE framework SHALL 创建 Page_Instance 记录该页面的 VM、定义引用和页面 ID
8. IF `private` 中的属性名与 Component_Definition 的方法名冲突，THEN THE framework SHALL 让方法覆盖数据，并记录 warning

---

### 需求 4：数据绑定求值

**用户故事：** 作为页面开发者，我希望模板中的 `{{expression}}` 能读到 VM 上的数据，以便界面显示动态内容。

#### 验收标准

1. WHEN 遍历 Template_Tree 时，THE framework SHALL 对每个节点的 `attr` 中值为函数的属性，以该页面 VM 为 `this` 调用该函数
2. WHEN Function_Attribute 求值成功时，THE framework SHALL 用返回值替换 Resolved_Tree 中对应属性的值
3. WHEN `attr` 中的属性值不是函数时，THE framework SHALL 原样复制到 Resolved_Tree
4. WHEN 节点有 `children` 时，THE framework SHALL 递归处理每个子节点，保持顺序
5. WHEN 节点有 `events` 时，THE framework SHALL 原样复制到 Resolved_Tree，不做求值
6. WHEN 节点有 `classList` 时，THE framework SHALL 原样复制到 Resolved_Tree
7. IF Function_Attribute 求值抛出异常，THEN THE framework SHALL 捕获异常、记录含节点类型和属性名的错误、并把该属性值设为空字符串
8. WHEN Resolved_Tree 构建完成后，THE framework SHALL 调用 `__native_render__(resolvedTree, styleSheet)`，styleSheet 取自 Component_Definition 的 `style` 字段
9. IF Component_Definition 没有 `template` 字段，THEN THE framework SHALL 记录错误并跳过渲染
10. IF `__native_render__` 未被 C++ 注入，THEN THE framework SHALL 记录错误并跳过渲染，不抛出异常

---

### 需求 5：页面生命周期

**用户故事：** 作为页面开发者，我希望在页面的关键时点执行初始化和清理逻辑。

#### 验收标准

1. WHEN VM 创建完成且数据初始化后，THE framework SHALL 以 VM 为 `this` 调用 `onInit`（若已定义）
2. WHEN 渲染指令已发出后，THE framework SHALL 以 VM 为 `this` 调用 `onReady`（若已定义）
3. WHEN 页面对用户可见时，THE framework SHALL 以 VM 为 `this` 调用 `onShow`（若已定义）
4. WHEN 页面被新页面覆盖时，THE framework SHALL 对被覆盖页面调用 `onHide`（若已定义）
5. WHEN 页面从栈中弹出时，THE framework SHALL 依次调用该页面的 `onHide` 和 `onDestroy`（若已定义）
6. WHEN 页面因返回而重新可见时，THE framework SHALL 对该页面调用 `onShow`（若已定义）
7. THE framework SHALL 保证同一页面的生命周期调用顺序为：onInit → onReady → onShow → [onHide → onShow]* → onHide → onDestroy
8. IF 页面未定义某个生命周期钩子，THEN THE framework SHALL 跳过调用且不产生错误
9. IF 生命周期钩子抛出异常，THEN THE framework SHALL 捕获、记录含页面 ID 和钩子名的错误，并继续执行后续流程
10. WHEN 页面已进入 destroyed 状态后，THE framework SHALL 拒绝对它调用任何生命周期钩子并记录 warning

---

### 需求 6：事件分发

**用户故事：** 作为 C++ Core，我需要把平台采集到的点击事件转给对应的 VM 方法，以便用户交互能触发页面逻辑。

#### 验收标准

1. THE framework SHALL 提供全局函数 `__dispatch_event__(pageId, methodName, payload)` 供 C++ 调用
2. WHEN `__dispatch_event__` 被调用时，THE framework SHALL 根据 pageId 找到对应的 Page_Instance
3. WHEN 找到 Page_Instance 后，THE framework SHALL 在该页面 VM 上按 methodName 查找方法
4. WHEN 方法存在时，THE framework SHALL 以 VM 为 `this` 调用它
5. WHEN payload 非空时，THE framework SHALL 把它作为第一个参数传给 VM 方法
6. IF pageId 找不到对应的 Page_Instance，THEN THE framework SHALL 记录 warning 并返回，不抛出异常
7. IF VM 上不存在该方法名，THEN THE framework SHALL 记录错误，包含方法名和页面 ID
8. IF VM 方法抛出异常，THEN THE framework SHALL 捕获、记录含方法名的错误，不让异常传回 C++
9. WHEN 目标 Page_Instance 已进入 destroyed 状态时，THE framework SHALL 丢弃该事件并记录 debug 日志

**接口传方法名而非 nodeId 的理由：** C++ 侧在构建 VNode 时已经读取了 `events` 配置，并通过 `PlatformBridge.setEvent(id, eventType, methodName)` 把方法名传给平台层——方法名已经在 C++ 手里。事件回传时带上它，framework.js 就不需要维护「nodeId → 模板节点」的映射。

这个决定的完整论证见 design.md 的「nodeId 映射问题」。它的代价是 framework.js 无法知道事件来自哪个节点——当前需求不需要这个信息，将来若要实现 `$event.target` 则需要改回按 nodeId 分发。

---

### 需求 7：系统模块访问

**用户故事：** 作为页面开发者，我希望通过 `import` 使用系统能力，以便调用路由、提示等原生功能。

#### 验收标准

1. THE framework SHALL 不实现 `$app_require$`，它由 C++ 注入
2. WHEN factory 执行时，THE framework SHALL 把 `$app_require$` 作为第一个参数传入
3. WHEN bundle 中的 `$app_require$('@app-module/system.router')` 返回对象后，THE framework SHALL 不对该对象做任何包装或修改
4. IF `$app_require$` 未被注入，THEN THE framework SHALL 在执行 factory 前记录错误并跳过该组件的注册

**这个需求的验收标准数量少，因为 framework.js 在这条链路上几乎不做事。** 它的职责只是把 C++ 注入的 `$app_require$` 透传给 factory。模块对象的形状由 C++ 侧的 `native_app_require` 决定，framework.js 不介入——这也意味着 toolkit 的 Babel interop 问题（Step 11 风险 1）无法在 framework.js 侧解决。

---

### 需求 8：页面栈与路由协作

**用户故事：** 作为 Runtime，我需要在页面切换时正确管理多个页面的 VM 和生命周期。

#### 验收标准

1. THE framework SHALL 维护页面栈，记录每个 Page_Instance 及其 pageId
2. WHEN C++ 调用 `__page_create__(pageId, componentName)` 时，THE framework SHALL 创建对应页面的 VM 并执行启动序列
3. WHEN 新页面创建时，THE framework SHALL 对当前栈顶页面调用 `onHide`，再把新页面压入栈
4. WHEN C++ 调用 `__page_destroy__(pageId)` 时，THE framework SHALL 对该页面调用 `onHide` 和 `onDestroy`，然后从栈中移除
5. WHEN 页面被销毁后栈顶变为另一个页面时，THE framework SHALL 对新栈顶调用 `onShow`
6. THE framework SHALL 以 C++ Router 的页面栈为权威，自身的栈只是 VM 状态的镜像
7. IF `__page_create__` 收到的 componentName 不在 Component_Registry 中，THEN THE framework SHALL 记录错误并不创建页面
8. IF `__page_destroy__` 收到的 pageId 不存在，THEN THE framework SHALL 记录 warning 并返回
9. WHEN 页面被销毁时，THE framework SHALL 清理该 Page_Instance 的 nodeId 映射，避免内存持续增长

**权威性的边界：** C++ Router 持有页面栈的权威状态（`Page_Stack`），它决定何时创建和销毁页面。framework.js 的栈只用于查找 VM 和判断栈顶——两者不一致时以 C++ 为准。这个设计避免了双向同步的复杂度。

---

### 需求 9：页面接口对象

**用户故事：** 作为页面开发者，我希望通过 `this.$page` 和 `this.$app` 访问页面级和应用级能力。

#### 验收标准

1. WHEN 创建 VM 时，THE framework SHALL 在 VM 上挂载 `$page` 对象
2. THE `$page` SHALL 提供 `setTitleBar(options)` 方法，options 含 `text` 字段
3. WHEN `$page.setTitleBar` 被调用时，THE framework SHALL 调用 C++ 注入的 `__set_title_bar__(pageId, text)`
4. THE `$page` SHALL 提供只读的 `id` 字段，值为该页面的 pageId
5. WHEN 创建 VM 时，THE framework SHALL 在 VM 上挂载 `$app` 对象
6. THE `$app` SHALL 提供对应用级 `globalData` 的访问
7. IF `__set_title_bar__` 未被注入，THEN THE framework SHALL 记录 warning 并跳过调用
8. IF 应用未初始化，THEN THE `$app` 的数据访问 SHALL 返回空对象而非抛出异常

---

### 需求 10：错误处理与日志

**用户故事：** 作为开发者，我希望页面代码的错误被捕获并记录足够的定位信息，而不是让整个 Runtime 崩溃。

#### 验收标准

1. THE framework SHALL 捕获所有从页面代码（factory、生命周期钩子、事件处理方法、Function_Attribute）抛出的异常
2. WHEN 捕获异常时，THE framework SHALL 记录错误消息、异常堆栈（若有）、以及发生位置的上下文（组件名、页面 ID、钩子名或方法名）
3. THE framework SHALL 不让页面代码的异常传回 C++
4. THE framework SHALL 通过 C++ 注入的 `console` 输出日志
5. WHEN 应用 manifest 的 `config.debug` 为 false 时，THE framework SHALL 只输出 error 级别日志
6. WHEN `config.debug` 为 true 时，THE framework SHALL 输出全部级别日志
7. THE framework SHALL 在日志前缀中标明来源，格式为 `[framework]` 或 `[framework:pageId]`
8. IF `console` 未被注入，THEN THE framework SHALL 静默降级，不因日志失败而中断流程

**debug 标志的获取方式：** framework.js 无法直接读 manifest。C++ 需要注入一个全局标志（如 `__debug__`）或在应用启动时通过 `globalData` 传入。这是需要与 C++ 侧约定的接口，见 design.md。

---

## 需求与 C++ 侧接口的对应

framework.js 依赖 C++ 注入的全局函数，也提供全局函数供 C++ 调用。双向清单：

**C++ → framework.js（framework.js 提供）：**

| 全局函数 | 需求 | 用途 |
|---|---|---|
| `$app_define$(name, deps, factory)` | 1 | bundle 注册组件 |
| `$app_bootstrap$(name, options)` | 2、3 | bundle 启动组件 |
| `__dispatch_event__(pageId, methodName, payload)` | 6 | 事件分发 |
| `__page_create__(pageId, componentName)` | 8 | 创建页面 |
| `__page_destroy__(pageId)` | 8 | 销毁页面 |

**framework.js → C++（C++ 注入）：**

| 全局函数 | 需求 | 用途 |
|---|---|---|
| `$app_require$(moduleName)` | 7 | 加载系统模块 |
| `__native_render__(resolvedTree, styleSheet)` | 4 | 触发渲染 |
| `__set_title_bar__(pageId, text)` | 9 | 设置标题栏 |
| `console.log/warn/error` | 10 | 日志输出 |
| `__debug__`（变量而非函数） | 10 | 日志级别控制 |

其中 `$app_require$`、`__native_render__`、`console` 在 C++ 侧已实现（`js_bridge.cpp`）。`__set_title_bar__` 和 `__debug__` 需要新增——这是本项目对 C++ 侧提出的接口需求。

`__dispatch_event__`、`__page_create__`、`__page_destroy__` 是 framework.js 新提供的，C++ 侧需要在对应时机调用它们。
