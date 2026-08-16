# 快应用、小程序、RN、Lynx、Flutter 渲染与事件管线对比

> 状态：架构研究稿  
> 口径：RN 指 Fabric；Lynx 指 ReactLynx；快应用指联盟语义及公开 Android 参考实现；小程序以微信小程序公开模型为代表。  
> 目标：从首次渲染、状态更新、事件系统三个维度，识别各框架底层原理的本质差异。

## 目录

- [1. 结论先行](#1-结论先行)
- [2. 统一口径与示例](#2-统一口径与示例)
- [3. 快应用框架](#3-快应用框架)
- [4. 小程序框架](#4-小程序框架)
- [5. React Native Fabric](#5-react-native-fabric)
- [6. ReactLynx](#6-reactlynx)
- [7. Flutter](#7-flutter)
- [8. 本质对比](#8-本质对比)
- [9. 对 QuickApp Kit v2 的启示](#9-对-quickapp-kit-v2-的启示)
- [10. 参考资料](#10-参考资料)

## 1. 结论先行

五套框架的本质差异，不是“是否有 Diff”，而是**谁持有权威运行时树、状态变化以什么形式进入渲染内核、最终由谁产生平台变化**。

| 框架 | 状态到 UI 的核心模型 | 主要结构变化计算 | 平台输出 |
|---|---|---|---|
| 快应用 | JS MVVM/Watcher 生成增量 DOM Action | `JS层.JS线程.Logical DOM` | 原生 View 操作 |
| 小程序 | `setData` 发送数据 Patch，视图层重算受影响绑定 | `视图层.View Runtime`，内部实现不公开 | WebView DOM/原生组件更新 |
| RN Fabric | React Reconcile，同时创建不可变 C++ Shadow Tree | `JS层.React Reconciler` + `C++层.Fabric Differentiator` | Host View Mutations |
| ReactLynx | 后台组件 Diff，Engine 线程 Patch Element Tree | `JS层.后台线程.ReactLynx` | Resolve/Layout 后的 UI Operations |
| Flutter | 重建 Widget，复用持久 Element，更新 RenderObject | `Dart层.UI线程.Element` | Scene/Layer，最终光栅化为像素 |

关键认识：

1. **快应用和小程序偏“数据/绑定 Patch”**：避免每次提交完整声明树。
2. **RN 偏“不可变 Shadow Revision + C++ Mount Diff”**：适合共享跨平台原生控件内核。
3. **Lynx 偏“后台 Reconcile + 主线程轻量 Patch”**：重点是首帧和线程解耦。
4. **Flutter 偏“持久对象树 + Dirty Pipeline + 自绘”**：没有原生 Host View Tree Diff。
5. **事件系统最终都形成闭环**：平台命中节点 → Runtime 定位回调 → 状态变化 → 调度下一轮渲染。

## 2. 统一口径与示例

### 2.1 层与线程标记

本文统一使用：

```text
层.线程.部件
```

例如：

```text
JS层.JS线程.React Reconciler
C++层.UI线程.Fabric Mounting
Platform层.UI线程.Android View
Dart层.UI线程.Element Tree
```

`UI线程` 表示拥有 UI/帧管线的线程。它在 Android/iOS 通常对应系统主线程；在 Flutter、LVGL 等架构中，更准确地表示各自的 UI Task Runner 或 UI Owner。

### 2.2 贯穿示例

所有框架都使用同一个行为：

```text
初始界面：按钮“加一” + 文本“0”
用户点击按钮
事件回调执行 count = count + 1
文本更新为“1”
```

需要追踪的三类数据：

| 数据 | 示例 | 作用 |
|---|---|---|
| 声明/模板 | `text = count`、`onClick = increment` | 描述 UI 和事件关系 |
| 运行状态 | `count: 0 -> 1` | 驱动更新 |
| 渲染变化 | `SetText(node, "1")` | 改变最终画面 |

## 3. 快应用框架

### 3.1 首次渲染

快应用采用 `.ux` 模板、样式和脚本，经 Toolkit 编译后打入 RPK。运行时消费编译后的 JS 模块和模板描述，不直接解析开发态 `.ux`。

```text
Platform层.UI线程.Runtime Host
加载RPK、manifest、页面入口
        ↓ 输入：bundle/resource
JS层.JS线程.JS Engine
执行framework.js、app.js、page.js
        ↓ 输入：页面模块；输出：Page ViewModel
JS层.JS线程.MVVM/Template Runtime
创建ViewModel，建立Observer/Watcher，执行模板
        ↓ 输出：createBody/createElement/addElement/addEvent actions
Bridge层.JS→Native.RenderAction Channel
批量传输DOM Action
        ↓ 输出：序列化Action Batch
Platform层.RenderAction线程.Native Document
解析Action，建立VDocument/VElement
        ↓ 输出：待挂载节点操作
Platform层.UI线程.Native Renderer
创建并挂载Android View，完成首屏
```

示例中的关键数据：

```text
JS ViewModel: count = 0
JS Logical Node: text.content依赖count
Action: addElement(text), updateAttrs(value="0"), addEvent(click)
Platform View: TextView("0") + clickable View
```

本质：**JS 层先建立 ViewModel 与 Logical DOM，再发送细粒度增量 Action；平台侧维护原生文档并挂载 View。**

### 3.2 状态变化驱动更新

```text
JS层.JS线程.Event Handler
执行 count = count + 1
        ↓ 输入：旧值0；输出：新值1
JS层.JS线程.Observer/Watcher
发现依赖count的文本绑定变脏
        ↓ 输出：绑定更新
JS层.JS线程.Logical DOM Listener
生成updateAttrs/updateStyle/add/remove/move等Action
        ↓ 输出：Update Action Batch
Platform层.RenderAction线程.Native Document
将Action应用到VElement
        ↓ 输出：Native View更新任务
Platform层.UI线程.Native Renderer
TextView.setText("1")
```

普通业务代码执行结束后，框架批量刷新 DOM 操作；`$forceUpdate()` 是强制立即推进更新的特殊入口。

本质：**Dirty/依赖发现和主要增量变化生成在 JS 层；平台侧消费已经明确的节点 Action。**

### 3.3 事件注册与触发

注册：

```html
<text @click="increment">{{ count }}</text>
```

```text
Toolkit层.编译期.Template Compiler
将@click编译为事件描述
        ↓ 输出：eventType=click, handler=increment
JS层.JS线程.Template Runtime
在Logical Node登记handler，生成addEvent action
        ↓
Platform层.UI线程.Native Renderer
为对应Native View安装Click Listener
```

触发：

```text
Platform层.UI线程.Input/View
命中Native View并产生click
        ↓ 输出：nodeRef + eventType + eventPayload
Bridge层.Native→JS.Event Channel
将事件投递到JS线程
        ↓
JS层.JS线程.Event Dispatcher
根据nodeRef/eventType定位increment
        ↓
JS层.JS线程.Page ViewModel
执行increment(evt)，修改count
        ↓
进入3.2的状态更新链路
```

## 4. 小程序框架

> 小程序厂商没有完整公开内部实现语言和线程细节。以下只描述公开可确认的“逻辑层、视图层、Native Bridge”模型；不同平台的 JS 引擎和 WebView 线程实现可能不同。

### 4.1 首次渲染

```text
Platform层.UI线程.MiniApp Container
加载包、页面配置、WXML/WXSS和JS
        ↓
JS层.逻辑线程.AppService/Page
创建Page实例，形成初始data={count:0}
        ↓ 输出：初始Page Data
Bridge层.逻辑→视图.Data Channel
传输初始数据
        ↓
View层.视图线程.WXML Runtime
执行模板绑定，建立视图节点
        ↓ 输出：View Node更新
Platform层.UI线程.WebView/Native Component
显示按钮和文本“0”
```

本质：**逻辑层不直接操作视图节点；WXML 模板和 Page Data 在视图层结合。**

### 4.2 状态变化驱动更新

```js
this.setData({ count: this.data.count + 1 })
```

```text
JS层.逻辑线程.Page
计算count: 0 -> 1
        ↓
JS层.逻辑线程.setData
更新逻辑层data，形成路径级Patch {count:1}
        ↓
Bridge层.逻辑→视图.Data Channel
序列化并发送Data Patch
        ↓
View层.视图线程.WXML Runtime
重算依赖count的绑定
        ↓ 输出：文本节点Patch
Platform层.UI线程.WebView/Native Component
将文本更新为“1”
```

本质：**小程序跨层传输的核心是 Data Patch，而不是完整 VDOM，也不是平台 View Mutation。视图层根据模板依赖把数据变化翻译为节点变化。**

### 4.3 事件注册与触发

注册：

```xml
<view bindtap="increment">加一</view>
```

```text
Toolkit层.编译期.WXML Compiler
将bindtap与handler名称编入模板元数据
        ↓
View层.视图线程.WXML Runtime
在视图节点登记tap事件和handler标识
```

触发：

```text
Platform层.UI线程.Touch/Input
命中WebView节点或原生组件
        ↓
View层.视图线程.Event Dispatcher
执行捕获/冒泡，组装target/currentTarget/dataset/detail
        ↓ 输出：handlerName + eventPayload
Bridge层.视图→逻辑.Event Channel
将事件发送到逻辑线程
        ↓
JS层.逻辑线程.Page
查找并执行increment(event)
        ↓
调用setData，进入4.2更新链路
```

## 5. React Native Fabric

### 5.1 首次渲染

```text
JS层.JS线程.React
执行组件函数，创建临时React Element Tree
        ↓ 输入：state={count:0}
JS层.JS线程.React Reconciler
将复合组件归约为View/Text等Host Component
        ↓ 通过JSI同步调用
C++层.JS线程.Fabric Renderer
为Host Component创建不可变ShadowNode，组装Shadow Tree
        ↓ 输出：Next Shadow Revision
C++层.JS线程或调度线程.Yoga/Layout
计算节点尺寸和位置
        ↓
C++层.UI线程.Fabric Differentiator
空Rendered Tree vs Next Shadow Tree，生成Create/Insert/Update Mutations
        ↓
Platform层.UI线程.MountingManager
创建Android View/UIView并挂载
```

首次渲染中：

- React Element 是 JS 的临时声明结果。
- Shadow Tree 是 C++ 的不可变持久 Revision。
- Host View Tree 由平台 MountingManager 拥有。

### 5.2 状态变化驱动更新

```text
JS层.JS线程.React Handler
setCount(count + 1)
        ↓
JS层.JS线程.React Scheduler/Reconciler
按优先级调度，重算受影响Fiber/Element
        ↓
C++层.执行Render的线程.Fabric Renderer
克隆受影响ShadowNode及祖先，形成Next Shadow Revision
        ↓
C++层.执行Commit的线程.Yoga/Layout
计算新布局
        ↓
C++层.UI线程.Fabric Differentiator
Rendered Shadow Tree vs Next Shadow Tree
        ↓ 输出：UpdateMutation(text="1")
Platform层.UI线程.MountingManager
更新TextView/UIView
```

RN 有两种不同的比较：

1. `JS层.React Reconciler` 比较组件/Fiber语义。
2. `C++层.Fabric Differentiator` 比较已渲染和待挂载 Shadow Revision，生成 Host Mutations。

本质：**JS 决定组件结果，C++ 统一 Shadow Tree、Layout、Flatten 和 Mount Diff。**

### 5.3 事件注册与触发

注册：

```jsx
<Pressable onPress={increment}><Text>{count}</Text></Pressable>
```

```text
JS层.JS线程.React Reconciler
将onPress/触摸相关Props写入Host Component配置
        ↓
C++层.JS线程.ShadowNode/EventEmitter
保存节点事件能力与JS回调关联
        ↓
Platform层.UI线程.MountingManager
配置Host View触摸处理
```

触发：

```text
Platform层.UI线程.Input/Host View
接收触摸并命中React Tag/Shadow节点
        ↓
Platform/C++层.UI线程.Event Dispatcher/EventEmitter
规范化事件并按优先级投递
        ↓
JS层.JS线程.React Event Loop/Pressability
识别press语义并执行onPress
        ↓
setCount，进入5.2更新链路
```

高优先级离散事件可以影响调度优先级；Fabric 的渲染器是线程安全的，但常规业务回调仍在 JS 执行环境中运行。

## 6. ReactLynx

### 6.1 首次渲染

ReactLynx 的首帧不是简单的“后台 JS 构树后交主线程”，而是双 Runtime 协作：主线程脚本优先构建首屏，后台线程同时建立完整组件运行状态。

```text
Platform层.UI线程.LynxView
加载并解析Bundle
        ↓
JS/Engine层.Engine线程.MTS Runtime
执行可用于首帧的Main Thread Script
        ↓
Engine层.Engine线程.Element PAPI/Element Tree
创建Element，Resolve样式，建立Layout Node Tree
        ↓
Engine层.Engine线程.Layout
计算位置，生成Paint/Layout UI OP
        ↓
Platform层.UI线程.Platform UI
执行UI OP并完成首屏

并行：
JS层.后台线程.BTS/ReactLynx
执行完整React组件、生命周期准备并建立后台组件树
        ↓
与主线程首帧树同步/校准，为后续更新提供状态
```

本质：**主线程承担像素关键路径以压缩首屏，后台线程承担完整 React 状态和后续 Reconcile。**

### 6.2 状态变化驱动更新

```text
JS层.后台线程.Event Handler
setCount(count + 1)
        ↓
JS层.后台线程.ReactLynx Reconciler
执行Component/VDOM Diff
        ↓ 输出：Element Changes
JS层.后台线程.Change Packer
序列化并发送Diff结果
        ↓
Engine层.Engine线程.Element Runtime
Parse Changes并Patch主线程Element Tree
        ↓
Engine层.Engine线程.Resolve/Layout
生成Paint/Layout UI OP
        ↓
Platform层.UI线程.Platform UI
执行UI OP，文本变为“1”
```

本质：**组件 Diff 在后台线程；Engine 线程不重新执行 React 组件，而是应用变更、Resolve、Layout 并产生 UI OP。**

### 6.3 事件注册与触发

注册：

```jsx
<view bindtap={increment}><text>{count}</text></view>
```

```text
Toolkit层.编译期.ReactLynx Compiler
拆分主线程代码与background-only代码
        ↓
Engine层.Engine线程.Element Tree
在Element登记bind/catch/capture事件描述
        ↓
JS层.后台线程.ReactLynx
保留默认事件Handler
```

默认触发：

```text
Platform层.UI线程.Input/LynxView
命中平台UI与对应Element
        ↓
Engine层.Engine线程.Event Dispatcher
构造事件响应链，执行capture/bubble/catch语义
        ↓
JS层.后台线程.ReactLynx Handler
执行increment(event)
        ↓
setCount，进入6.2更新链路
```

主线程脚本是特殊快路径：

```jsx
<view main-thread:bindtap={handleTap} />
```

此时 Handler 在 `JS/Engine层.Engine线程.MTS Runtime` 直接执行，适合手势和动画；普通副作用、状态和生命周期仍以后台线程为主。

## 7. Flutter

### 7.1 首次渲染

```text
Dart层.UI线程.runApp/WidgetsBinding
挂载Root Widget并请求一帧
        ↓
Dart层.UI线程.Widget Build
执行build()，产生不可变Widget Tree
        ↓
Dart层.UI线程.Element
inflate Widget，建立持久Element Tree
        ↓
Dart层.UI线程.RenderObject
创建RenderObject Tree
        ↓
Dart层.UI线程.PipelineOwner
Layout → Paint → Compositing，生成Layer/Scene
        ↓
C++层.Raster线程.Flutter Engine/Impeller
将Scene光栅化
        ↓
Platform层.Compositor线程.Surface
显示像素
```

Flutter 通常不创建 Android View/UIView 与每个 Widget 对应；其 Host 输出是 Scene/Layer，而不是原生控件树。

### 7.2 状态变化驱动更新

```text
Dart层.UI线程.Gesture Handler
setState(() => count++)
        ↓
Dart层.UI线程.StatefulElement
markNeedsBuild，将Element加入Dirty List并请求下一帧
        ↓
Dart层.UI线程.BuildOwner
重建Dirty Element对应的Widget子树
        ↓
Dart层.UI线程.Element.updateChild/updateChildren
按runtimeType + key匹配新Widget与旧Element
        ↓
Dart层.UI线程.RenderObject
更新持久对象，标记NeedsLayout/NeedsPaint
        ↓
Dart层.UI线程.PipelineOwner
只处理Dirty Layout/Paint节点，生成新Scene
        ↓
C++层.Raster线程.Flutter Engine
光栅化新Scene
```

本质：**Widget 可以频繁重建；Element 和 RenderObject 持久存在。更新优化依赖 Element Reconcile 与 Dirty Layout/Paint，而不是 C++ Shadow Tree Diff。**

### 7.3 事件注册与触发

注册：

```dart
GestureDetector(onTap: increment, child: Text('$count'))
```

```text
Dart层.UI线程.Widget Build
将onTap回调传给GestureDetector
        ↓
Dart层.UI线程.Element/RenderObject
建立命中测试对象和TapGestureRecognizer
```

触发：

```text
Platform层.Platform线程.Input
产生原始触摸数据
        ↓
C++层.Platform→UI Task Runner.Flutter Engine
将PointerData投递到Dart UI线程
        ↓
Dart层.UI线程.GestureBinding
转换PointerEvent并执行RenderObject Hit Test
        ↓
Dart层.UI线程.PointerRouter/Gesture Arena
分发Pointer流，TapGestureRecognizer胜出
        ↓
Dart层.UI线程.GestureDetector Handler
执行increment，调用setState
        ↓
进入7.2更新链路
```

Flutter 的原始 Pointer 沿 HitTest Path 分发；更高层的 tap/drag/scale 由 Gesture Arena 仲裁。

## 8. 本质对比

### 8.1 首次渲染

| 框架 | 上层输入 | 权威运行时结构 | 首屏输出 | 首屏核心思想 |
|---|---|---|---|---|
| 快应用 | 编译UX + 初始VM Data | JS Logical DOM + Native Document | Native View | MVVM生成增量节点Action |
| 小程序 | WXML + 初始Page Data | View层模板实例 | WebView/Native Component | 逻辑与视图隔离 |
| RN Fabric | React Element | C++ Immutable Shadow Tree | Native View | JS声明，C++统一Commit/Mount |
| ReactLynx | 双线程编译Bundle | Engine Element Tree + 后台组件树 | Native UI | 主线程首帧、后台完整Runtime |
| Flutter | Widget | Element + RenderObject | Scene/Pixels | 持久对象树、自绘管线 |

### 8.2 状态更新

| 框架 | 状态入口 | 跨层更新数据 | Diff/增量核心 |
|---|---|---|---|
| 快应用 | 响应式字段修改 | DOM Action Batch | JS Watcher定位绑定并生成Action |
| 小程序 | `setData` | Data Patch | 视图层重算受影响WXML绑定 |
| RN Fabric | React setState/Hook | JSI调用和Next Shadow Revision | JS Reconcile + C++ Mount Diff |
| ReactLynx | Hook/setState | Packed Element Changes | 后台Component Diff，Engine Patch |
| Flutter | `State.setState` | 无JS/Native跨层Patch | Dart Element Reconcile + Dirty Pipeline |

### 8.3 事件系统

| 框架 | 命中发生处 | 默认业务回调线程 | 事件定位依据 | 特殊机制 |
|---|---|---|---|---|
| 快应用 | Platform Native View | JS线程 | Native节点引用 + 事件类型 | 组件事件可冒泡/广播 |
| 小程序 | View层节点/原生组件 | 逻辑线程 | handlerName + Event Payload | 事件跨逻辑/视图Bridge |
| RN Fabric | Host View | JS线程 | React Tag/EventEmitter | 事件优先级影响并发调度 |
| ReactLynx | Platform UI/Element | 后台线程 | Element响应链 | MTS Handler可在主线程执行 |
| Flutter | RenderObject Hit Test | Dart UI线程 | HitTestResult + GestureRecognizer | Gesture Arena仲裁手势 |

## 9. 对 QuickApp Kit v2 的启示

### 9.1 推荐原则

QuickApp Kit 不应机械复制任一框架，而应组合其底层优势：

```text
Toolkit层.编译期
Template IR + BindingId + BlockId + Event Metadata
        ↓
JS层.Runtime线程
业务状态 + Component Instance + Dirty Binding + Handler Registry
        ↓ Binding/Structure Transaction
C++层.Runtime/Render线程
唯一权威Runtime Tree + NodeId + Dynamic Block Reconcile
Style + Layout + Revision + MountTransaction
        ↓
Platform层.UI线程
Backend-owned Host Tree
```

### 9.2 吸收与放弃

| 来源 | 吸收 | 不照搬 |
|---|---|---|
| 快应用 | UX/RPK语义、MVVM依赖、增量更新 | JSON Action、Android专用Document |
| 小程序 | 编译模板、Data/Binding Patch、逻辑视图隔离 | 厚重序列化和不透明视图运行时 |
| RN Fabric | C++跨端Core、Revision、Layout、MountTransaction | React/Fiber绑定、每次构造完整声明树 |
| ReactLynx | 后台业务Runtime、主线程轻提交、MTS快路径思想 | 双JS Runtime首期复杂度 |
| Flutter | 持久树、Dirty Build/Layout/Paint、帧管线 | 自绘引擎和平台控件绕行 |

### 9.3 核心决策建议

**KD-RP-001：C++ Runtime Tree 是唯一权威动态渲染树。** JS 不维护第二棵完整渲染树，只维护状态、组件实例、依赖和事件回调。

**KD-RP-002：默认提交 Binding/Structure Transaction，不提交全量树。** 静态模板通过 Template IR 实例化；只有 `if/for/slot` 等动态结构在 C++ 做局部 Reconcile。

**KD-RP-003：NodeId 属于 C++ Core。** JS 常规更新使用 `ComponentInstanceId + BindingId/BlockId`；只有测量、焦点、滚动等命令式操作使用带 generation 的受控 NodeHandle。

**KD-RP-004：Host Tree 归 Platform Backend。** Runtime 只产生 MountTransaction，并跟踪 submitted/mounted revision；不保存 `View*`、`UIView*`、`lv_obj_t*`。

**KD-RP-005：事件闭环使用稳定映射。** `Platform NodeId → C++ Event Metadata → JS HandlerId`，事件回调结束后批量提交状态变化。

最值得吸收的原则：

> 编译期消除静态工作，JS 层保留业务语义，C++ 层统一动态渲染状态，平台层只拥有真实 UI；每一层只处理自己理解的数据。

## 10. 参考资料

- [快应用：框架概述与 MVVM](https://doc.quickapp.cn/)
- [快应用：事件绑定](https://doc.quickapp.cn/tutorial/framework/event-on.html)
- [快应用：脚本与更新机制](https://doc.quickapp.cn/framework/script.html)
- [快应用：生命周期](https://doc.quickapp.cn/tutorial/framework/lifecycle.html)
- [微信小程序：运行时框架](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [微信小程序：WXML 事件](https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html)
- [微信小程序：Page.setData](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#setData-Object-data-Function-callback)
- [React Native：Render、Commit、Mount](https://reactnative.dev/architecture/render-pipeline)
- [React Native：线程模型](https://reactnative.dev/architecture/threading-model)
- [React Native：Fabric](https://reactnative.dev/architecture/fabric-renderer)
- [Lynx：ReactLynx 渲染管线](https://lynxjs.org/3.5/guide/performance/analysis-performance/reactlynx-render-process)
- [Lynx：ReactLynx 生命周期与双线程渲染](https://lynxjs.org/3.8/react/lifecycle.html)
- [Lynx：事件传播](https://lynxjs.org/guide/interaction/event-handling/event-propagation)
- [Flutter：架构总览](https://docs.flutter.dev/resources/architectural-overview)
- [Flutter：手势系统](https://docs.flutter.dev/ui/interactivity/gestures)
- [Flutter：Inside Flutter](https://docs.flutter.dev/resources/inside-flutter)
