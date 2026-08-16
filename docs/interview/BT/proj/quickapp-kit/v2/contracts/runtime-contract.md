# QuickApp Kit v2 Runtime Contract

## 目录

- [1. 结论](#1-结论)
- [2. 背景与问题](#2-背景与问题)
- [3. 本质分析](#3-本质分析)
- [4. 运行时边界](#4-运行时边界)
- [5. 应用模型](#5-应用模型)
- [6. 页面与 Surface 模型](#6-页面与-surface-模型)
- [7. 生命周期合同](#7-生命周期合同)
- [8. 树模型合同](#8-树模型合同)
- [9. DOM Transaction 合同](#9-dom-transaction-合同)
- [10. Event Loop 与 TaskRunner 合同](#10-event-loop-与-taskrunner-合同)
- [11. Router 与 Page Stack 合同](#11-router-与-page-stack-合同)
- [12. JS Host API 合同](#12-js-host-api-合同)
- [13. 关键决策索引](#13-关键决策索引)
- [14. 重点吸收点](#14-重点吸收点)
- [15. 边界与不做事项](#15-边界与不做事项)
- [16. 验收标准](#16-验收标准)
- [17. 后续演进](#17-后续演进)

## 1. 结论

Runtime Contract 是 QuickApp Kit v2 的核心合同。它定义 QuickApp 应用在 Runtime Core 内部的运行语义，不定义 Android View、UIKit、LVGL widget 等平台控件实现。

第一阶段结论：

```text
RPK
  -> AppRuntime
  -> PageStack
  -> JS Framework
  -> Logical DOM Mutation
  -> C++ Shadow Tree
  -> Layout / Commit
  -> MountTransaction
  -> Render Backend
```

Runtime Contract 的核心边界：

```text
JS Framework owns Logical DOM.
Runtime Core owns App/Page/Surface/Shadow Tree/Transaction/Lifecycle/Router.
Render Backend owns Host Tree.
Capability Module owns platform service access.
```

## 2. 背景与问题

QuickApp Kit v2 采用多项目矩阵：

```text
quickapp-runtime-js
quickapp-runtime-core
quickapp-runtime-android
quickapp-runtime-ios
quickapp-runtime-lvgl
```

如果没有统一 Runtime Contract，各端容易各自解释页面、生命周期、路由、事件和渲染更新，最终变成多套相似 demo，而不是一套跨端平台。

Runtime Contract 要解决：

1. QuickApp 应用如何进入 Runtime。
2. App、Page、Surface 的关系是什么。
3. JS Framework 和 C++ Core 如何交接 UI 更新。
4. Core 如何维护跨端一致的 Shadow Tree。
5. 生命周期、路由和事件如何跨平台一致。

## 3. 本质分析

QuickApp Runtime 的本质不是执行 JS，而是维护一套跨端一致的应用状态机：

```text
Package State
App State
Page Stack State
Surface State
Shadow Tree Revision
Lifecycle State
Event State
Capability State
```

平台差异不能进入这套状态机。平台只能作为输入和输出：

- 输入：宿主启动、暂停、恢复、返回键、点击、输入、能力回调。
- 输出：MountTransaction、Toast、路由结果、生命周期回调。

## 4. 运行时边界

### 4.1 Runtime Core 负责

- RPK 加载入口与资源访问抽象
- Manifest Model
- AppRuntime
- PageStack
- SurfaceRegistry
- RuntimeHost
- JS Engine Adapter 边界
- Shadow Tree
- Style/Layout/Commit
- DOM Transaction 校验
- MountTransaction 生成
- Lifecycle Dispatcher
- Event Dispatcher
- TaskRunner 抽象
- Router 状态机
- Capability Bridge 接入点

### 4.2 Runtime Core 不负责

- `.ux` 编译
- Android View / UIKit / LVGL widget 创建
- 平台 UI 线程创建
- 平台服务具体实现
- 网络请求具体实现
- IDE 交互
- Benchmark 报告展示

## 5. 应用模型

### 5.1 AppRuntime

`AppRuntime` 是一个 QuickApp 应用实例。

职责：

- 持有 manifest。
- 持有 JS runtime。
- 持有 PageStack。
- 持有 SurfaceRegistry。
- 派发 app lifecycle。
- 管理应用级资源和错误边界。

### 5.2 Manifest

第一阶段必须读取：

| 字段 | 用途 |
|---|---|
| `package` | 应用唯一标识 |
| `name` | 应用名 |
| `versionName` | 版本名 |
| `versionCode` | 版本号 |
| `router.entry` | 入口页面 |
| `router.pages` | 页面路径表 |
| `display` | 标题栏和页面显示配置 |
| `features` | 能力声明 |
| `permissions` | 权限声明 |

### 5.3 ResourceProvider

Core 不直接依赖文件系统。Host 提供 `ResourceProvider`：

```cpp
class ResourceProvider {
 public:
  virtual Result<Buffer> ReadBytes(ResourceUri uri) = 0;
  virtual Result<std::string> ReadText(ResourceUri uri) = 0;
  virtual bool Exists(ResourceUri uri) const = 0;
};
```

## 6. 页面与 Surface 模型

### 6.1 Page

`Page` 是 QuickApp 的逻辑页面。

职责：

- 页面路径和 query。
- 页面 VM。
- 页面生命周期。
- 页面级 display 配置。
- 页面对应的 Surface。

### 6.2 Surface

`Surface` 是一棵可挂载 UI 树。

一个 Page 默认对应一个 Surface。后续卡片、弹层、分屏可以扩展为多个 Surface。

```text
AppRuntime
  -> PageStack
     -> Page
        -> Surface
           -> Shadow Tree Revision
           -> Host Tree in Backend
```

### 6.3 Page 不等于平台容器

关键原则：

```text
Page is QuickApp logic.
Activity / ViewController / LVGL screen is platform container.
```

一个 Android Activity 或 iOS ViewController 可以承载多个 QuickApp Page 的切换。

## 7. 生命周期合同

### 7.1 App Lifecycle

第一阶段支持：

| 生命周期 | 触发时机 |
|---|---|
| `onCreate` | AppRuntime 初始化完成后 |
| `onShow` | 应用进入前台或首次显示 |
| `onHide` | 应用进入后台 |
| `onDestroy` | AppRuntime 销毁 |
| `onError` | 未捕获错误进入应用错误边界 |

后续扩展：

- `onRequest`
- `onIntentExecute`
- `onPageNotFound`

### 7.2 Page Lifecycle

第一阶段支持：

| 生命周期 | 触发时机 |
|---|---|
| `onInit` | 页面 VM 创建并绑定初始数据后 |
| `onReady` | 首次 Surface commit/mount 完成后 |
| `onShow` | 页面成为前台可见页 |
| `onHide` | 页面离开前台 |
| `onDestroy` | 页面从 PageStack 移除 |

后续扩展：

- `onBackPress`
- `onMenuPress`
- `onRefresh`
- `onConfigurationChanged`
- `onReachTop`
- `onReachBottom`
- `onPageScroll`

### 7.3 onReady 语义

`onReady` 不能简单等同于 JS template build 完成。

正确语义：

```text
Page VM created
  -> initial Logical DOM mutation submitted
  -> Shadow Tree committed
  -> first MountTransaction applied by Render Backend
  -> onReady
```

## 8. 树模型合同

QuickApp Kit v2 使用三棵树模型：

| 树 | 所属 | 职责 |
|---|---|---|
| Logical DOM | JS Framework | DSL 结构、组件 VM、响应式依赖、事件绑定 |
| Shadow Tree | Runtime Core | 规范化节点、样式、布局、revision、commit |
| Host Tree | Render Backend | Android View、UIKit View、LVGL Object |

术语规则：

```text
不要泛用 VNode。
如需使用 VNode，必须明确它等价于 JS Framework 的 Logical DOM node。
```

## 9. DOM Transaction 合同

### 9.1 第一阶段入口

第一阶段采用增量 DOM Transaction：

```cpp
Result<void> ApplyDomTransaction(
    SurfaceId surfaceId,
    Revision baseRevision,
    Span<DomMutation> mutations);
```

### 9.2 DomMutation 类型

第一阶段支持：

```text
CreateNode
DeleteNode
InsertChild
RemoveChild
UpdateProps
UpdateStyle
UpdateEventMask
SetText
```

后续扩展：

```text
MoveNode
InvokeCommand
SubmitTreeSnapshot
```

### 9.3 Revision 规则

每个 Surface 持有单调递增 revision：

```text
base_revision
  -> apply mutations
  -> validate
  -> layout
  -> commit target_revision
```

规则：

1. `baseRevision` 必须等于当前 committed revision，或进入可恢复冲突处理。
2. validation 失败不得更新 committed tree。
3. commit 成功后生成 `MountTransaction`。
4. Backend 不直接修改 Shadow Tree。

### 9.4 MountTransaction

Core 输出给 Render Backend：

```text
MountTransaction {
  surface_id
  base_revision
  target_revision
  mutations[]
}
```

MountMutation 第一阶段支持：

```text
CreateHostNode
DeleteHostNode
InsertHostNode
RemoveHostNode
UpdateProps
UpdateLayout
UpdateEventMask
SetText
```

## 10. Event Loop 与 TaskRunner 合同

### 10.1 TaskRunner

Core 不绑定 libuv、Android Looper、iOS dispatch 或 FreeRTOS task。

Core 只依赖最小 `TaskRunner`：

```cpp
class TaskRunner {
 public:
  virtual void Post(Task task) = 0;
  virtual void PostDelayed(Task task, Duration delay) = 0;
  virtual bool RunsTasksOnCurrentThread() const = 0;
};
```

### 10.2 线程角色

第一阶段线程模型：

```text
Platform UI Thread
  -> input, vsync, mount host widgets

Runtime Thread
  -> JS, lifecycle, Logical DOM mutation, Core commit

I/O Workers
  -> file, network, decode, platform service
```

### 10.3 平台映射

| 平台 | UI Thread | Runtime Thread | Timer/Task |
|---|---|---|---|
| Android | Main Thread | HandlerThread / executor | Handler / Looper |
| iOS | Main Thread | dispatch queue / NSThread | dispatch / run loop |
| LVGL | LVGL owner task | Runtime task | timer / queue |
| Desktop SDL Simulator | SDL main loop | Runtime thread | SDL/LVGL timer |

## 11. Router 与 Page Stack 合同

Router 属于 Core，不属于平台容器。

第一阶段支持：

```text
router.push(uri)
router.back()
```

PageStack 规则：

1. `push` 创建新 Page，触发旧页 `onHide`，新页 `onInit/onShow`。
2. `back` 销毁当前页，恢复上一页并触发 `onShow`。
3. 页面路径必须来自 manifest `router.pages`。
4. 未注册页面进入 `onPageNotFound` 或错误边界。

后续扩展：

- replace
- clearTask
- singleTask
- onRefresh(query)

## 12. JS Host API 合同

JS Framework 依赖 Runtime Host 注入以下 API。

### 12.1 模块注册

```text
$app_define$(name, deps, factory)
$app_bootstrap$(name, options)
$app_require$(moduleName)
```

### 12.2 Native Host Functions

Core/Host 向 JS 暴露：

```text
__qa_apply_dom_transaction__(surfaceId, baseRevision, mutations)
__qa_invoke_capability__(moduleName, methodName, args, callbackId)
__qa_log__(level, tag, message)
```

第一阶段允许 JSON 参数过桥，但进入 Core 前必须规范化为 typed `DomMutation` 或 typed capability call。

### 12.3 JS Bridge 原则

```text
JS Bridge is for JS <-> Runtime.
Render Backend Contract is for Core -> Backend.
Capability Module Contract is for JS -> Platform Service.
```

不要把三类通道混成一个万能 Bridge。

## 13. 关键决策索引

### KD-RC-001：Runtime Contract 定义语义，不定义控件

结论：Runtime Contract 只规定 QuickApp 应用语义和 Core 数据流。

原因：控件实现属于 Render Backend Contract。

### KD-RC-002：三棵树模型

结论：Logical DOM 在 JS，Shadow Tree 在 Core，Host Tree 在 Backend。

原因：兼容 QuickApp 编译产物，同时获得跨端 C++ 渲染内核。

### KD-RC-003：第一阶段使用增量 DOM Transaction

结论：V1 采用增量 DOM Transaction，不做完整 snapshot reconciler。

原因：兼容现有 RPK 语义，缩小首个 Android 闭环范围。

### KD-RC-004：onReady 绑定首次 mount 完成

结论：`onReady` 必须在首个 MountTransaction 应用完成后触发。

原因：生命周期要对应用户可观察的页面就绪，而不是仅 JS 构建完成。

### KD-RC-005：Router 下沉到 Core

结论：页面栈和路由状态机属于 Runtime Core。

原因：Page 不等于 Activity/ViewController，跨端行为必须一致。

### KD-RC-006：TaskRunner 抽象优先于固定 libuv

结论：Core 定义最小 TaskRunner，不强制所有平台使用 libuv。

原因：Android/iOS/LVGL/FreeRTOS 的事件循环和 UI 线程约束不同。

## 14. 重点吸收点

1. **运行时本质是状态机**
   不是简单执行 JS，而是维护 App/Page/Surface/ShadowTree/Lifecycle 的一致状态。

2. **Page 与平台容器解耦**
   QuickApp Page 是逻辑概念，不等于 Activity、ViewController 或 LVGL screen。

3. **三棵树是跨端 Runtime 的核心抽象**
   Logical DOM、Shadow Tree、Host Tree 分属不同层，才能兼容 DSL 又保持 Core 通用。

4. **Transaction 是跨边界的正确单位**
   单条命令太碎，整棵树太重；transaction 是兼容、性能和原子性的平衡点。

5. **TaskRunner 是跨系统调度的最小公约数**
   不要过早把 libuv、Looper、dispatch、LVGL timer 绑定为唯一模型。

## 15. 边界与不做事项

第一阶段不做：

1. 完整 QuickApp 生命周期全集。
2. 完整 snapshot reconciler。
3. 完整 launchMode。
4. 跨页面缓存策略。
5. 多 JS runtime 策略。
6. 动态插件包。

## 16. 验收标准

Runtime Contract 第一阶段验收：

1. 可以从 manifest 找到入口 Page。
2. 可以创建 AppRuntime / Page / Surface。
3. 可以执行 `$app_define$` 和 `$app_bootstrap$`。
4. JS Framework 可以提交 DOM Transaction。
5. Core 可以生成 Shadow Tree revision。
6. Core 可以输出 MountTransaction。
7. Backend mount 完成后触发 `onReady`。
8. `router.push` 可以创建新 Page 并更新 PageStack。
9. 点击事件可以从 Backend 回到 JS handler。

## 17. 后续演进

后续文档落点：

1. [render-backend-contract.md](./render-backend-contract.md)
2. [capability-module-contract.md](./capability-module-contract.md)
3. `lifecycle-state-machine.md`
4. `router-contract.md`
5. `taskrunner-contract.md`
