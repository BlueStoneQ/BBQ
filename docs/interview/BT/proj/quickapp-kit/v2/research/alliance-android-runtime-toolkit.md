# 联盟 QuickApp Android Runtime 与 Toolkit 工作机制

## 目录

- [1. 结论](#1-结论)
- [2. 研究范围与证据](#2-研究范围与证据)
- [3. 全链路本质](#3-全链路本质)
- [4. Toolkit 构建系统](#4-toolkit-构建系统)
- [5. Runtime 加载与启动](#5-runtime-加载与启动)
- [6. Bridge 系统](#6-bridge-系统)
- [7. 渲染管线](#7-渲染管线)
- [8. 事件系统](#8-事件系统)
- [9. 线程与数据归属](#9-线程与数据归属)
- [10. 联盟 Runtime 最小合同](#10-联盟-runtime-最小合同)
- [11. 已验证事实、合理推断与待验证项](#11-已验证事实合理推断与待验证项)
- [12. 对后续设计的输入](#12-对后续设计的输入)
- [13. 重点吸收点](#13-重点吸收点)

## 1. 结论

**一句话本质：联盟 QuickApp 是一套 Android 原生渲染系统，Toolkit 把受约束 DSL 编译成可执行页面描述，Runtime 让 JS 状态、Android View 和用户事件通过增量协议形成闭环。**

闭环只有四段：

```text
源码
  --Toolkit 编译/签名--> RPK
  --Runtime 加载------> JS VM + Template + Style
  --DOM Action--------> Android VDocument + View
  --Event(ref)--------> JS 监听器 -> 状态变化 -> 新 DOM Action
```

三个 Runtime 核心系统的本质：

| 系统 | 一句话本质 |
|---|---|
| Bridge | 在 JS 执行域与 Android 执行域之间传递有类型的调用，而不是共享对象。 |
| 渲染管线 | JS 把声明式页面变化转成增量 DOM Action，Android 把 Action 落成原生 View 变化。 |
| 事件系统 | Android 用 `pageId + ref + eventName` 把用户输入送回对应 JS 节点监听器。 |

构建系统的本质：

> Toolkit 消除 Runtime 不需要承担的源码复杂度，把 `.ux` 的 script、template、style 编译进标准 JS 模块，再与 Manifest、资源一起封装和签名为 RPK。

当前阶段只研究联盟 Android 基线。**联盟没有提供平台无关 Core，它提供的是一套 Android QuickApp Runtime。**

三个对象必须分开：

| 对象 | 定位 | 当前作用 |
|---|---|---|
| 联盟 Runtime | Android QuickApp Runtime | 研究标准 RPK 在 Android 上如何加载、渲染和交互 |
| Vela Runtime | 面向嵌入式 RTOS 的 QuickApp Runtime | 后续研究嵌入式约束下的运行机制 |
| QuickApp Kit Core | 我们拟设计的平台无关 Core | 比较两个实现后独立决策，不假定由联盟代码抽取而来 |

平台无关 Core 与 LVGL 方案必须以 Android 和 RTOS 两类事实为输入，下一阶段再讨论。

## 2. 研究范围与证据

### 2.1 研究对象

| 对象 | 本地位置 | 用途 |
|---|---|---|
| 联盟 Runtime / JS Framework | `quickapp-kit-ai/source/upstream/hapjs` | 验证加载、Bridge、渲染、事件和线程 |
| 联盟 Toolkit | `quickapp-kit-ai/source/upstream/hap-toolkit` | 验证 DSL 编译与打包过程 |
| Case 001 | `quickapp-examples/quickapp-code-test1` | 验证源码、build、debug/release RPK/RPKS 的实际形态 |
| Case 001 产物研究 | `research/alliance-toolkit-rpk-pipeline.md` | 保存逐项产物证据 |

### 2.2 证据等级

| 等级 | 含义 |
|---|---|
| 已验证事实 | 可由本地源码或 Case 001 产物直接证明 |
| 合理推断 | 因果链成立，但尚未完成动态 Trace |
| 待验证项 | 当前证据不足，不能写入实现合同 |

### 2.3 研究纪律

1. 先描述联盟实际做法，再评价设计。
2. 严格区分 JS 层、Android Runtime 层和 Android UI 层。
3. 不预设 `artifact.json`、`templates.bin`、`BindingId`、`BlockId`。
4. 不把联盟 Android Runtime 描述为平台无关 Core。
5. 不在本文提前设计我们的平台无关 Core 或 LVGL 后端。

## 3. 全链路本质

QuickApp Runtime 不是“执行一段 JS”，而是维持三个状态之间的一致性：

```text
业务状态（JS VM）
    -> 页面逻辑状态（JS DOM）
    -> 渲染状态（Android VDocument / View）
```

用户输入形成反向链路：

```text
Android View Event
    -> pageId/ref/eventName/data
    -> JS DOM listener
    -> VM 状态变化
    -> DOM Action
    -> Android View 更新
```

因此，联盟实现的最小核心不是某棵树，而是以下闭环：

```text
load -> execute -> describe -> mutate -> present -> input -> execute
```

## 4. Toolkit 构建系统

### 4.1 输入与输出

```text
输入：Manifest + .ux + JS + 样式 + 资源
输出：app.js + 页面 index.js + manifest.json + 资源 -> 签名 RPK/RPKS
```

Case 001 已验证页面 `index.js` 同时承载：

- 业务 VM：页面数据、方法和生命周期。
- Template Descriptor：组件类型、属性、事件、子节点和绑定函数。
- Style Object：编译后的规则与声明。

### 4.2 编译因果链

```text
.ux
  -> ux-loader 拆分 script/template/style
  -> template-loader 调用 parseTemplate
  -> style-loader 调用 parseStyle
  -> JS bundling
  -> $app_define$ 注册应用或页面模块
  -> $app_bootstrap$ 声明启动入口
  -> packager 收集 Manifest/JS/资源
  -> 签名并封装 RPK；按配置生成 RPKS
```

### 4.3 三个 `$app_*` 的职责

| 符号 | 本质职责 |
|---|---|
| `$app_define$` | 把编译后的应用或组件注册为 Runtime 可定位的模块。 |
| `$app_require$` | 在模块工厂执行期间解析依赖，包括 `@app-module/system.*` 能力模块。 |
| `$app_bootstrap$` | 指定要实例化和启动的应用或页面入口。 |

它们不是业务 API，而是 **Toolkit 与 JS Framework 之间的模块装载 ABI**。

### 4.4 构建系统不做什么

联盟 Case 001 没有证明 Toolkit 输出独立模板二进制，也没有证明存在 BindingId 或 BlockId。当前标准输入应是实际 RPK，不应先发明另一套产物再要求联盟应用适配。

详细文件级证据见 [Case 001 研究](./alliance-toolkit-rpk-pipeline.md)。

## 5. Runtime 加载与启动

### 5.1 本质

> 加载不是解压全部文件，而是依据 Manifest 找到应用和页面入口，在已注入 `$app_*` 与平台能力对象的 JS 环境中执行 bundle。

### 5.2 最小启动链

```text
Android Host 打开 RPK
  -> 读取 manifest.json
  -> 创建 RootView、JsThread、JS Engine 与 Bridge
  -> 加载 JS Framework
  -> 执行 app.js
  -> $app_define$ 注册 App；$app_bootstrap$ 创建 App
  -> 根据路由读取页面 index.js
  -> $app_define$ 注册页面；$app_bootstrap$ 创建页面
  -> JS Framework 实例化 VM、Template、Style 与 JS Document
  -> 发送首批 DOM Action
```

这里 JS 引擎只负责执行语言；`$app_*`、VM、模板解释、DOM 和响应式更新属于 JS Framework。

## 6. Bridge 系统

### 6.1 本质

> Bridge 不是一个函数，而是一组跨执行域协议；每条协议必须定义方向、操作名、参数、结果、线程与生命周期。

联盟实现至少存在三类路径：

| 路径 | 方向 | 载荷 | 语义 |
|---|---|---|---|
| 渲染 Bridge | JS -> Android | `pageId + DOM Action[]` | 异步提交页面变化，无直接返回值 |
| 能力 Bridge | JS -> Android | `module + method + args + callbackId/instanceId` | 同步返回或异步回调 |
| 事件回传 | Android -> JS | `pageId + ref + eventName + params + attributes` | 在 JS 线程分发节点事件 |

所以“是否走 external object/function”的第一性答案是：

> JS 引擎确实把宿主对象或函数注入全局环境，但 external function 只是入口，真正的架构边界是入口背后的协议。

### 6.2 渲染 Bridge

JS Framework 的 `sendActions` 将 Action 列表 JSON 序列化后调用：

```text
global.callNative(pageId, actionListJson)
```

Android `JsBridge` 将 `callNative` 注册为 V8 Java 方法，再交给 `RenderActionManager.callNative`。该路径是异步命令流，不返回渲染结果。

### 6.3 能力 Bridge

`@system.*` 在构建产物中变成 `$app_require$("@app-module/system.*")`。JS Framework 根据模块定义把调用路由到：

```text
feature -> global.JsBridge.invoke(...)
module  -> global.ModuleManager.invoke(...)
```

JS Framework 负责参数规范化、callbackId 映射、同步/异步模式和结果转换；Android 负责真正执行能力。

**结论：渲染与系统能力遵循相同的跨域原则，但不是同一载荷协议。**

## 7. 渲染管线

### 7.1 本质

> 联盟渲染管线传递的是增量操作，不是每次把整棵页面树跨 Bridge 发送。

### 7.2 首次渲染

```text
Template Descriptor + VM
  -> JS Framework 创建 JS DOM 节点并分配 ref
  -> Listener 生成 createBody/addElement/addEvent/... Action
  -> Streamer 批量发送
  -> createFinish 标记首次提交结束
  -> Android 解析 Action 并建立 RenderActionDocument
  -> 生成 VDomChangeAction / ComponentAction
  -> RootView 在 Android UI 层创建和挂接 View
```

### 7.3 增量更新

```text
VM 数据变化
  -> JS Framework 更新受影响的模板/DOM 属性
  -> Listener 生成 updateAttrs/updateStyle/addElement/removeElement/... Action
  -> Streamer 合批
  -> updateFinish 标记本批更新结束
  -> Android 后台解析、样式计算和打包 RenderActionPackage
  -> RootView/UI 线程应用到 View
```

### 7.4 联盟实现中的“diff”

联盟源码直接证明 JS Framework 的 DOM 变更会生成增量 Action；Android 的 `RenderActionDocument` 继续负责渲染侧节点、CSS 匹配和操作转换。

因此不能用一句“diff 在 JS”或“diff 在 Android”覆盖全部工作：

| 层 | 实际职责 |
|---|---|
| JS Framework | 响应数据变化，只生成必要的 DOM mutation Action |
| Android RenderAction 层 | 解析 Action，维护渲染文档，计算样式并生成平台渲染操作 |
| Android UI 层 | 对真实 View 执行创建、更新、移动和删除 |

## 8. 事件系统

### 8.1 本质

> 事件系统用稳定节点标识 `ref`，把平台输入重新定位到 JS 中注册监听器的逻辑节点。

### 8.2 注册链

```text
Template 中声明事件
  -> JS Framework 在 JS DOM 注册 listener
  -> 发送 addEvent(ref, eventName)
  -> Android Component/View 安装对应平台监听器
```

### 8.3 触发链

```text
用户操作 Android View
  -> Component 触发 RenderEventCallback
  -> RootView 构造 pageId/ref/eventName/params/attributes
  -> JsThread.postFireEvent
  -> JS 线程调用 execJSBatch
  -> JS Framework 按 ref 找到元素并 dispatchEvent
  -> VM handler 执行
  -> 状态变化进入增量渲染管线
```

事件的节点身份不是 Android View 指针，也不是 JS 对象引用，而是跨域稳定整数 `ref`。

### 8.4 双向数据

普通事件携带 `params`；输入类组件还可携带 `attributes`，使 JS 侧节点状态与 Android 输入状态同步。事件与渲染因此不是两个孤立系统，而是同一个反馈环的反向和正向路径。

## 9. 线程与数据归属

### 9.1 已验证线程模型

| 执行域 | 主要数据/工作 |
|---|---|
| JS `HandlerThread` | JS Engine、App/Page VM、JS DOM、事件 handler、能力回调 |
| RenderAction 后台执行域 | 解析 Action、维护 `RenderActionDocument`、CSS 计算、生成 `RenderActionPackage` |
| Android Main/UI Thread | `RootView`、Component 和真实 Android View 的创建与修改 |

`RenderActionManager.callNative` 当前源码通过 `Executors.io().execute(RenderWorker)` 解析渲染批次，同时保留 `RenderActionThread` 处理要求串行归属的任务。故不能简单描述为“所有 diff 都在一个固定 RenderThread”。

### 9.2 线程原则

> JS 状态只在 JS 执行域修改，View 只在 UI 线程修改，跨域只传不可歧义的消息。

`mLastWorker` 等机制表明并发执行仍需保持页面 Action 的因果顺序；线程数量不是核心，状态所有权和提交顺序才是核心。

## 10. 联盟 Runtime 最小合同

要运行 Case 001，兼容 Runtime 至少要满足：

| 合同 | 最小要求 |
|---|---|
| Package | 读取标准 RPK、Manifest、应用/页面 JS 和资源 |
| Module ABI | 提供 `$app_define$`、`$app_require$`、`$app_bootstrap$` |
| JS Framework | 解释 VM、Template Descriptor、Style Object，维护页面实例和 JS DOM |
| Render Protocol | 接收带 pageId 的有序 DOM Action 批次及 create/update finish 边界 |
| Node Identity | 保持 `ref` 在 JS DOM、渲染文档和平台组件之间可定位 |
| Event Protocol | 将 `pageId/ref/type/data` 送回 JS 事件分发器 |
| Capability Protocol | 解析 `@app-module/system.*`，支持参数、结果、回调与实例生命周期 |
| Lifecycle | 支持 App/Page 创建、显示、隐藏、销毁及资源释放 |
| Threading | 保证 JS 状态串行、Action 有序、View 仅在 UI 线程修改 |

该合同描述的是可观察行为，不要求复刻联盟内部类结构。

## 11. 已验证事实、合理推断与待验证项

### 11.1 已验证事实

1. 联盟仓库中的主 Runtime 是 Android 实现，并使用原生 View 渲染。
2. Case 001 的模板、样式和 VM 被编译进页面 JS。
3. `$app_define$`、`$app_require$`、`$app_bootstrap$` 构成产物与 JS Framework 的装载协议。
4. JS Framework 通过 `global.callNative(pageId, JSON actions)` 异步提交渲染 Action。
5. Android 维护 `RenderActionDocument`，解析 Action 后向 `RootView` 提交渲染包。
6. Android 事件通过 `pageId + ref + eventName + data` 回到 JS 线程的 `execJSBatch`。
7. 系统能力调用与渲染调用具有不同参数、返回值和回调语义。

### 11.2 合理推断

1. `createFinish`、`updateFinish` 是提交边界，但其全部调度语义仍需动态 Trace 确认。
2. `ref` 是三侧关联键；不同页面是否允许重复及复用规则需继续核对生成器和销毁逻辑。
3. `RenderWorker` 链保证批次有序；具体并行度和阻塞行为需运行测量。

### 11.3 待验证项

1. app.js、页面 JS、JS Framework 的完整加载时序及缓存策略。
2. `$app_*` 在 Android JS 环境中的精确定义、错误语义和模块缓存规则。
3. 首次渲染与一次点击更新的完整动态 Trace。
4. 同步能力调用是否阻塞 JS 线程，以及超时和异常传播规则。
5. RPK/RPKS 的安装、验签、分包加载和升级流程。
6. 卡片、Worker、多页面缓存等扩展场景是否改变最小合同。

## 12. 对后续设计的输入

本文只冻结三个输入：

1. 标准输入基线是联盟 RPK，首个 Golden Case 是 Case 001。
2. Runtime 主线是 Bridge、渲染、事件构成的闭环，工具链负责生成这个闭环可消费的产物。
3. 联盟 Android 基线完成后，还要独立研究 Vela 的 RTOS Runtime；两套实现共同作为我们设计平台无关 Core 的事实输入。

下一步应先完成 Case 001 的 Android 动态 Trace，再研究 Vela 的嵌入式实现，最后进入平台无关 Core 与 LVGL 架构决策；否则容易把某个平台的实现偶然性误写成通用原则。

## 13. 重点吸收点

> **关键原理：跨平台 Runtime 的本质不是统一所有内部对象，而是统一构建产物、节点身份、增量渲染、事件回传和生命周期合同。**

> **关键架构点：Bridge 应按渲染、能力、事件划分有类型协议，不能退化成无约束 JSON 通道。**

> **关键性能点：性能首先取决于跨域数据量、批处理、线程所有权和提交顺序，不取决于是否把全部代码放进同一个模块。**

> **关键阶段决策：联盟 Android Runtime 与 Vela RTOS Runtime 是两套研究样本；我们的平台无关 Core 是比较后重新设计的第三套架构。**
