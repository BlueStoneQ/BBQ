# Requirements Document

## 目录

- [Introduction](#introduction)
- [Glossary](#glossary)
- [Requirements](#requirements)
  - [需求 1：RPK 加载与 Manifest 解析](#需求-1rpk-加载与-manifest-解析)
  - [需求 2：JavaScript 引擎初始化](#需求-2javascript-引擎初始化)
  - [需求 3：页面加载与组件渲染](#需求-3页面加载与组件渲染)
  - [需求 4：数据绑定](#需求-4数据绑定)
  - [需求 5：点击事件处理与路由导航](#需求-5点击事件处理与路由导航)
  - [需求 6：ShowToast 系统 API](#需求-6showtoast-系统-api)
  - [需求 7：页面生命周期回调](#需求-7页面生命周期回调)
  - [需求 8：TitleBar 显示](#需求-8titlebar-显示)
  - [需求 9：引擎抽象接口](#需求-9引擎抽象接口)

---

## Introduction

Android 快应用 Runtime — 一个三层架构的运行时系统，能够在 Android 设备上加载并执行标准快应用 RPK 包。

架构分层：
1. **C++ Core**（跨平台共享）：QuickJS 引擎管理、RPK 加载与解压、Manifest 解析、VNode 树构建、Yoga 布局计算、样式解析与匹配、事件路由、Router/System API 分发
2. **JS Framework**（跨平台共享）：framework.js 提供 `$app_define$`/`$app_bootstrap$`/`$app_require$` 全局函数、VM 模型、生命周期管理
3. **Android 平台层**：JNI 桥接、Kotlin View 渲染器、原生 API 实现

目标输入：`quickapp-examples/quickapp-code-test1/dist/com.example.case1.debug.1.0.0.rpk`，包含 manifest.json、app.js、pages/Demo/index.js、pages/DemoDetail/index.js 和 assets 目录。

范围约束：
- 组件：div、text、input（仅 button 类型）
- 布局：Flex direction、justifyContent、alignItems、width、height、margin、padding、borderRadius
- 样式：color、backgroundColor、fontSize、textAlign
- 事件：仅 click
- System API：system.router（push）、system.prompt（showToast）
- 无响应式数据更新（仅初始渲染）
- 无 CSS 选择器引擎
- 无 Widget/Card 支持
- 无签名验证
- 无热更新或调试协议

产物形态：
- **第一阶段**：单 APK 工程（app module 包含 C++ Core + JNI + Kotlin Renderer + RPK assets），快速验证端到端链路
- **产品化阶段**：拆为 AAR 库（quickapp-runtime.aar）+ 演示壳 APK；AAR 对外暴露 `QuickAppRuntime.launch(context, rpkPath)` 接口，宿主 App 一行代码集成
- 核心 Runtime 设计为独立库，APK 仅是承载和演示的壳子

## Glossary

- **Runtime**：完整的快应用运行时系统，包含 C++ Core、JS Framework 和 Android 平台层三部分
- **RPK_Loader**：C++ Core 中负责从 Android assets 读取 RPK 文件、解压 ZIP 并提供内部文件访问的模块
- **Manifest_Parser**：C++ Core 中解析 manifest.json 为结构化 Manifest 模型的模块
- **QuickJS_Engine**：由 C++ Core 管理的 JavaScript 执行引擎（QuickJS），负责执行 framework.js、app.js 和页面 bundle
- **JS_Framework**：在 app.js 之前加载的 framework.js 文件，提供 `$app_define$`、`$app_bootstrap$`、`$app_require$` 全局函数和 VM 模型管理
- **VM_Model**：每个页面对应的 JavaScript 视图模型实例，持有 private 数据字段、方法和生命周期钩子
- **VNode_Tree**：C++ Core 中维护的虚拟节点树，表示由页面模板派生的 UI 层次结构
- **Yoga_Layout**：C++ Core 中基于 Yoga 的布局引擎，为 VNode_Tree 节点计算 Flex 布局位置和尺寸
- **Style_Resolver**：C++ Core 中将 classList 条目匹配到样式对象并合并计算样式到 VNode 节点的模块
- **JS_Bridge**：JS 层与 C++ Core 之间的通信机制，通过 QuickJS C API（`JS_NewCFunction`）直接注入 native 函数到 JS 全局，JS 调用时零序列化直接进入 C++ 函数（类似 RN JSI 思路）
- **Platform_Bridge**：C++ Core 与平台渲染层之间的抽象回调接口，通过函数指针/JNI 向平台层发送渲染指令（createElement、setAttr、setStyle、removeElement）。注意：Platform_Bridge 不是 JS Bridge，它连接的是 C++ ↔ 平台层，而非 JS ↔ C++
- **JNI_Bridge**：Android 平台上 Platform_Bridge 的具体实现载体，连接 C++ Core 与 Kotlin View 渲染器
- **View_Renderer**：根据 Platform_Bridge 的渲染指令创建和管理 Android View（ViewGroup、TextView、Button）的 Kotlin 层
- **Router**：C++ Core 中实现 `system.router.push` 页面导航的系统模块。采用独立路由方案（单 Activity + 自建页面栈），不依赖 Android Activity 栈或任何宿主路由机制，使路由逻辑可跨平台共享
- **Prompt_Module**：实现 `system.prompt.showToast` 的系统模块，通过 Android Toast 显示消息
- **TitleBar**：根据 manifest.json display 配置渲染的原生 Android 标题栏区域
- **Page_Stack**：C++ Core 中维护的页面导航历史栈。push 时保存当前页面状态并加载新页面；back 时弹出栈顶并恢复上一页面。三端共享同一套栈管理逻辑
- **JSEngine_Interface**：预留的 JS 引擎抽象接口，当前唯一实现为 QuickJS，支持未来引擎替换

## Requirements

### 需求 1：RPK 加载与 Manifest 解析

**用户故事：** 作为开发者，我希望 Runtime 从 Android assets 加载 RPK 文件并解析其 manifest，以便应用配置和路由表可供后续执行使用。

#### 验收标准

1. WHEN Runtime 以指定的 RPK 文件名启动时，THE RPK_Loader SHALL 从 Android assets 读取该 RPK 文件并将所有条目解压到内存或临时文件结构中
2. WHEN RPK 解压完成后，THE Manifest_Parser SHALL 将 manifest.json 解析为包含 package（包名）、router（路由配置）、display（显示配置）和 features（能力声明）的 Manifest 模型
3. WHEN manifest.json 包含 router.entry 字段时，THE Manifest_Parser SHALL 从 router.pages 映射中解析出入口页面的完整路径
4. IF RPK 文件无法读取或不是有效的 ZIP 归档，THEN THE RPK_Loader SHALL 向调用方报告包含文件名和失败原因的描述性错误
5. IF manifest.json 缺失或包含无效 JSON，THEN THE Manifest_Parser SHALL 报告包含解析位置的描述性错误

### 需求 2：JavaScript 引擎初始化

**用户故事：** 作为开发者，我希望 Runtime 初始化 QuickJS、加载 framework.js 并执行 app.js，以便在任何页面加载之前应用级 JavaScript 环境已准备就绪。

#### 验收标准

1. WHEN Manifest_Parser 成功解析 manifest 后，THE QuickJS_Engine SHALL 通过 JSEngine_Interface 创建新的 JSRuntime 和 JSContext
2. WHEN JSContext 创建完成后，THE QuickJS_Engine SHALL 执行 framework.js，使 `$app_define$`、`$app_bootstrap$` 和 `$app_require$` 作为全局函数可用
3. WHEN framework.js 执行完成后，THE QuickJS_Engine SHALL 从解压后的 RPK 内容中读取并执行 app.js
4. WHEN app.js 为应用组件调用 `$app_define$` 和 `$app_bootstrap$` 时，THE JS_Framework SHALL 注册该应用并调用其 onCreate 生命周期回调
5. IF framework.js 执行过程中抛出 JavaScript 错误，THEN THE QuickJS_Engine SHALL 记录错误信息并终止初始化流程
6. IF app.js 执行过程中抛出 JavaScript 错误，THEN THE QuickJS_Engine SHALL 记录错误信息并终止初始化流程

### 需求 3：页面加载与组件渲染

**用户故事：** 作为开发者，我希望 Runtime 加载入口页面 bundle、解析其模板树、并以 Flex 布局渲染 div、text 和 input 元素，以便用户在屏幕上看到页面内容。

#### 验收标准

1. WHEN app.js 初始化完成后，THE Runtime SHALL 根据 manifest router.entry 确定的路径执行入口页面 bundle（pages/Demo/index.js）
2. WHEN 页面 bundle 调用 `$app_define$` 和 `$app_bootstrap$` 时，THE JS_Framework SHALL 使用页面的 private 数据和 methods 创建 VM_Model 实例
3. WHEN VM_Model 创建完成后，THE JS_Framework SHALL 在 VM_Model 上调用 onInit 生命周期回调
4. WHEN 从已注册组件获取到模板树后，THE VNode_Tree SHALL 通过递归遍历模板节点进行构建
5. WHEN VNode 具有 classList 属性时，THE Style_Resolver SHALL 从页面的 style 对象中查找匹配的样式条目并合并到该 VNode 上
6. WHEN VNode_Tree 构建完成且样式已合并后，THE Yoga_Layout SHALL 根据 flexDirection、justifyContent、alignItems、width、height、margin、padding 和 borderRadius 属性为每个节点计算 Flex 布局位置（x、y、width、height）
7. WHEN 布局计算完成后，THE Platform_Bridge SHALL 为每个 VNode 向 View_Renderer 发送 createElement 指令，指定节点类型（div、text、input）、计算后的布局边界和解析后的样式
8. WHEN View_Renderer 收到类型为 "div" 的 createElement 指令时，THE View_Renderer SHALL 创建具有指定布局边界和背景样式的 Android ViewGroup
9. WHEN View_Renderer 收到类型为 "text" 的 createElement 指令时，THE View_Renderer SHALL 创建具有指定文本内容、fontSize、color 和 textAlign 的 Android TextView
10. WHEN View_Renderer 收到类型为 "input" 且 attr.type 为 "button" 的 createElement 指令时，THE View_Renderer SHALL 创建以 value 属性作为按钮文本并应用指定样式的 Android Button

### 需求 4：数据绑定

**用户故事：** 作为开发者，我希望模板中以函数形式定义的属性值（如 `function() { return this.title }`）能针对 VM_Model 求值，以便页面数据被动态渲染。

#### 验收标准

1. WHEN VNode 模板属性值为函数类型时，THE JS_Framework SHALL 以 VM_Model 实例作为 `this` 上下文调用该函数
2. WHEN 函数返回一个值时，THE JS_Framework SHALL 将返回值作为该 VNode 的已解析属性值
3. WHEN text 类型 VNode 的 `value` 属性是一个函数且该函数返回 "欢迎体验快应用开发" 时，THE View_Renderer SHALL 在 TextView 中显示 "欢迎体验快应用开发" 作为文本内容

### 需求 5：点击事件处理与路由导航

**用户故事：** 作为开发者，我希望 UI 元素上的点击事件能调用对应的 VM 方法，并且当该方法调用 router.push 时 Runtime 能导航到目标页面，以便基本的用户交互和页面导航正常工作。

#### 验收标准

1. WHEN VNode 具有 events.click 属性且值为方法名字符串时，THE Platform_Bridge SHALL 在对应的原生 View 上注册点击监听器
2. WHEN 用户点击该原生 View 时，THE Platform_Bridge SHALL 将点击事件转发到 C++ Core，由 C++ Core 在 VM_Model 上调用该命名方法
3. WHEN VM 方法调用 `require("@app-module/system.router").push({uri: "/pages/DemoDetail"})` 时，THE Router SHALL 从 manifest router.pages 映射中解析目标页面路径
4. WHEN Router 解析到有效的目标页面时，THE Runtime SHALL 将当前页面压入 Page_Stack，执行目标页面 bundle（pages/DemoDetail/index.js），创建新的 VM_Model，构建 VNode_Tree，计算布局，并渲染新页面
5. IF Router 无法从 manifest 中解析目标页面 URI，THEN THE Router SHALL 记录警告日志且不执行导航操作

### 需求 6：ShowToast 系统 API

**用户故事：** 作为开发者，我希望页面的 VM 方法能调用 showToast 并显示原生 Android Toast 消息，以便演示基本的系统 API 交互能力。

#### 验收标准

1. WHEN VM 方法调用 `require("@app-module/system.prompt").showToast({message: "<文本>"})` 时，THE Prompt_Module SHALL 接收 message 参数
2. WHEN Prompt_Module 收到包含 message 字符串的 showToast 调用时，THE Prompt_Module SHALL 使用 Android Toast 显示指定的消息文本
3. IF showToast 调用缺少 message 参数，THEN THE Prompt_Module SHALL 记录警告日志且不显示 Toast

### 需求 7：页面生命周期回调

**用户故事：** 作为开发者，我希望 Runtime 在正确的时机调用页面生命周期回调（onInit、onShow），以便页面代码能执行初始化和可见性相关逻辑。

#### 验收标准

1. WHEN 页面 VM_Model 创建且 private 数据初始化完成后，THE JS_Framework SHALL 在 VM_Model 上调用 onInit 回调（若已定义）
2. WHEN 页面渲染完成且对用户可见时，THE JS_Framework SHALL 在 VM_Model 上调用 onShow 回调（若已定义）
3. WHILE onInit 回调执行期间，THE JS_Framework SHALL 确保 VM_Model 的 private 数据字段可通过 `this` 访问
4. IF 页面未定义 onInit 或 onShow 回调，THEN THE JS_Framework SHALL 跳过调用且不产生错误

### 需求 8：TitleBar 显示

**用户故事：** 作为开发者，我希望 Runtime 读取 manifest.json 的 display 配置并渲染带有正确文本和颜色的 TitleBar，以便每个页面具有适当的标题外观。

#### 验收标准

1. WHEN 页面渲染时，THE View_Renderer SHALL 在屏幕顶部显示 TitleBar
2. WHEN manifest display 配置中包含页面级 titleBarText（如 display.pages["pages/Demo"].titleBarText 为 "快应用示例模版"）时，THE TitleBar SHALL 显示该文本作为标题
3. WHEN manifest display 配置中包含 titleBarBackgroundColor 时，THE TitleBar SHALL 将该颜色应用为背景色
4. WHEN manifest display 配置中包含 titleBarTextColor 时，THE TitleBar SHALL 将该颜色应用为标题文本颜色
5. IF 页面在 manifest 中没有页面级 titleBarText 配置，THEN THE TitleBar SHALL 显示 manifest.name 字段的值作为默认标题

### 需求 9：引擎抽象接口

**用户故事：** 作为开发者，我希望 C++ Core 通过 JSEngine_Interface 抽象接口访问 JavaScript 引擎，以便未来可以替换引擎实现而不影响上层逻辑。

#### 验收标准

1. THE JSEngine_Interface SHALL 定义 initialize、destroy、eval、callFunction、registerNativeFunction 和 getLastError 方法的纯虚接口
2. THE QuickJS_Engine SHALL 作为 JSEngine_Interface 的唯一实现，封装 JSRuntime 和 JSContext 的创建与销毁
3. WHEN C++ Core 需要执行 JavaScript 时，THE C++ Core SHALL 通过 JSEngine_Interface 指针调用，不直接依赖 QuickJS 特定的 API 类型
