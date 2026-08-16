# QuickApp Kit v3 平台总 Spec：设计

## 目录

- [1. 结论](#1-结论)
- [2. 总体分层](#2-总体分层)
- [3. Artifact 与加载边界](#3-artifact-与加载边界)
- [4. 三大系统](#4-三大系统)
- [5. 树与 ID](#5-树与-id)
- [6. 线程与通信](#6-线程与通信)
- [7. 页面控制与能力](#7-页面控制与能力)
- [8. 平台后端](#8-平台后端)
  - [8.1 固定内核与可裁剪组成](#81-固定内核与可裁剪组成)
- [9. 失败与降级](#9-失败与降级)
- [10. 可观测设计](#10-可观测设计)
- [11. 项目边界](#11-项目边界)
- [12. 详细合同索引](#12-详细合同索引)

## 1. 结论

平台采用：**Toolkit 定义静态事实，JS 执行动态语义，C++ Core 决定权威状态，Platform 执行 Host 操作。**

该分层只保留一棵可变权威 Runtime Tree，并用 typed message 屏蔽 JS 引擎、平台 UI、线程和设备差异。跨平台的性能基础不是减少分层，而是保持消息增量、边界稳定、状态唯一和平台批量执行。

## 2. 总体分层

```text
Alliance DSL Source
  -> Toolkit Compiler
       -> JS Bundle                动态语义
       -> Page IR                  静态模板事实
       -> Runtime Metadata         执行索引
       -> Runtime RPK              运行容器
  -> Shared JS Runtime
  <-> Shared C++ Runtime Core
  <-> Platform Adapter
       -> LVGL/SDL
       -> Android/JNI
       -> iOS/Objective-C++
```

| 层 | 权威所有物 | 不得拥有 |
|---|---|---|
| Toolkit | DSL 解析、Lowered Model、稳定 Template ID、Artifact | Runtime 状态、平台对象 |
| JS Runtime | VM、state、Binding/Block dependency、HandlerId | Runtime NodeId、Host Tree、Navigation 栈 |
| C++ Core | App/Page/Surface、Runtime Tree、NodeId、Revision、Layout、路由 | JS 函数、NativeHandle、平台类型 |
| Platform | NativeHandle、Host Tree、UI owner thread、Provider 实现 | 业务 state、Binding、逻辑 Diff、权威页面栈 |

详细冻结架构见 [总架构合同](./architecture.md)。

## 3. Artifact 与加载边界

```text
Toolkit build
  -> manifest.json
  -> app/page JS Bundle
  -> quickapp-kit/runtime.json
  -> per-page Page IR
  -> assets + descriptors + SHA-256
  -> Runtime RPK

Runtime Host
  -> PackageSource
Core Loader
  -> path/version/structure/hash/relationship verification
  -> VerifiedModuleLoad(immutable bytes)
JS Runtime
  -> $app_define$ / $app_bootstrap$ / $app_require$
```

Core 在任一 JS Bundle 执行前完成 V1 完整性校验。JS Runtime 只接收 verified immutable bytes，不读取 PackageSource、文件路径或 Page IR。平台 Host 只提供 PackageSource 和 launch profile，不解释 DSL。

Page IR 的语义是一棵有根有序静态模板树，Artifact 采用 `nodes/blocks/bindings/handlers` 的 ID 归一化表编码。Core 可建立不可变 ID 索引，但不得复制为第二棵长期可变树。

## 4. 三大系统

### 4.1 Bridge 系统

Bridge 的本质是：**在不同执行域之间传递有语义的意图和结果，而不是暴露任意远程调用。**

```text
JS -> C++ Core
  JsEnginePort Native Function Binding
  -> QuickJS V1: External Function
  -> typed Runtime ABI decode
  -> immutable request enqueue

C++ Core -> Platform
  platform-independent Port
  -> platform queue/gateway
  -> typed Result back to Core queue
```

边界规则：

1. JS -> Core 使用 Engine 无关 Native Function Binding，函数只承载固定 typed message；QuickJS V1 Provider 具体实现为 External Function。
2. Core -> Android 的 JNI 定义和实现全部位于 Android 项目。
3. Core -> iOS 的 Objective-C++ Gateway 全部位于 iOS 项目。
4. LVGL/SDL 通过 C++ Platform Port 组合，不把 EventLoop Backend 注入 Core。
5. NativeHandle、平台对象和可变平台 buffer 不跨入 Core。
6. Bundle bytes 可用不可变共享所有权或一次所有权转移；控制消息采用小型值复制或不可变消息所有权转移。

### 4.2 渲染系统

渲染的本质是：**状态变化只产生受影响定义的增量意图，Core 原子更新唯一 Runtime Tree，Platform 批量执行 Host 操作。**

首屏：

```text
Page IR + Page VM
  -> initial Binding/Block/Handler evaluation
  -> InstantiateTemplate
  -> Core instantiate Runtime Tree
  -> Style/Yoga/Measure
  -> full MountTransaction(hidden)
  -> Platform Present
  -> Core commit visible
```

更新：

```text
state write
  -> JS dependency marks Binding/Block Dirty
  -> microtask checkpoint batches evaluation
  -> RenderTransaction(Owner + Template IDs + values/ops)
  -> Core validate and stage candidate
  -> Style/Yoga/Measure
  -> Core commit Runtime Tree + Revision
  -> MountTransaction
  -> Platform Host Tree
```

“无完整树 Diff”表示不构造两棵完整新旧运行树进行同构比较。JS 仍执行依赖命中、Dirty 合并和 Block 计划；Core 仍执行目标解析、局部合法性校验、staging 和原子提交。

### 4.3 事件系统

事件的本质是：**平台只报告发生在 NodeId 上的标准输入，Core 决定逻辑路由，JS 执行已注册 Handler。**

```text
Platform click
  -> PlatformInputMessage(requestId,surfaceId,nodeId,eventType,payload)
  -> Core Event Router
  -> Runtime Tree resolve EventBinding
  -> JsEventDispatch(requestId,handlerId,target/currentTarget,payload)
  -> JS Handler
  -> state update / navigation / capability
```

Handler 方法和 HandlerId 位于 JS；`NodeId -> EventBinding` 位于 Core；Listener 和 NativeHandle 位于 Platform。Handler 删除使用 `live -> retiring -> released`，以 Core Runtime Tree commit 为最终分界。

## 5. 树与 ID

### 5.1 三类结构

| 结构 | 层 | 性质 |
|---|---|---|
| Page IR 静态模板定义 | Artifact/Core 只读 | 有根有序语义树的归一化表，不是运行时树 |
| Runtime Tree | C++ Core | 唯一可变权威运行时树 |
| Host Tree | Platform | 平台对象映射，不拥有逻辑状态 |

### 5.2 ID 链路

```text
Toolkit: TemplateNodeId / TemplateBindingId / TemplateBlockId / TemplateHandlerId
JS:      OwnerInstanceId / BlockInstanceId / HandlerId
Core:    SurfaceId / NodeId / Revision / TransactionId
Platform: NodeId -> NativeHandle private mapping
```

Binding 和 Handler 跨层寻址固定为 Owner + Template ID。JS 不复制 Page IR target；Core 从 Page IR 解析 `LogicalNodeRef` 并映射到 Runtime NodeId。

## 6. 线程与通信

V1 先冻结逻辑执行域，不把物理线程数量写死进公共协议：

| 逻辑执行域 | 责任 |
|---|---|
| JS Executor | QuickJS、VM、microtask、Binding/Handler |
| Core Runtime | Loader 状态机、Runtime Tree、事务、路由、布局 |
| Platform UI/Event | Host Tree、输入和平台 UI API |
| Host I/O | PackageSource 和平台异步 I/O，可按平台实现 |

V1 推荐独立 JS Executor 与单 Core Runtime 调度线程；Platform 使用各自 owner thread。跨域通信通过队列和 typed message，禁止 Core 同步等待 Platform UI，也禁止 Platform UI 同步进入 JS。

Measure 是受控例外：Core Runtime Thread 可同步调用只读、线程安全的字体 metrics service；该 service 不访问可变 Host Tree 或 UI Thread。

## 7. 页面控制与能力

Core 拥有 Navigation 栈和 Surface 状态。Platform 的页面容器只执行 create/present/visibility/close/destroy command；Present 或 Close 失败时 Core 不提前提交页面栈。

Capability 分为：

```text
CoreProvider:     system.router 等平台无关实现
PlatformProvider: prompt/device 等平台实现
Page Host Control: title/meta 等 Surface 相关能力
```

V1 使用静态 ModuleRegistry + typed Invoker + Provider Factory。Manifest 声明和 Provider availability 必须同时满足；完整权限策略和动态插件治理后置。

## 8. 平台后端

| 平台 | V1 角色 | 特有边界 |
|---|---|---|
| LVGL/SDL | 首个完整产品闭环与嵌入式证明 | LVGL owner thread；SDL 是完整 Runtime simulator；libuv 是可替换 Backend 之一 |
| Android | 第二个平台复用与联盟语义证明 | JNI、View、Activity/Window 全部留在 Android Adapter |
| iOS | 第三平台复用证明 | Objective-C++、UIKit、Scene 生命周期全部留在 iOS Adapter |

三个平台实现同一 Surface、Mount、Input、Measure、Capability 和 Launch Port。平台可以拒绝不支持能力，但不得静默改变公共语义。

### 8.1 固定内核与可裁剪组成

```text
Product Composition Root
  -> Build Profile
  -> fixed C++ Kernel + JS Framework
  -> exactly one JS Engine Provider
  -> selected Platform/Provider/Component/Backend modules
  -> RuntimeCompositionManifest
```

固定 C++ Kernel 包含三大系统的 Core-side 部件及 Lifecycle、Runtime Tree、Transaction、ID、Error 和 Queue。JS Runtime Service 是必选的外围服务：JS Framework 依赖稳定 `JsEnginePort`，QuickJS 只是 V1 Engine Provider，不得把 QuickJS 类型写入 Framework 或 Core。

外围模块通过公共 Port 向内注册；Kernel 不依赖任何外围具体类型。条件构建只允许出现在 Composition Root、模块 target 和依赖选择处，未选择模块的源文件、对象文件与依赖不得进入最终链接产物。

V1 合规 Profile 始终包含 `View/Text/Button`、`system.router/prompt/device` 和 baseline Observation。LVGL 必须至少提供 `lvgl-simulator-dev` 与 `lvgl-embedded-min`，用实际链接清单、二进制体积和运行内存证明 SDL/诊断外围可被干净移除。

Core Loader 在执行 JS 前，以 Manifest.features 和 Page IR Host Component 推导 Artifact 需求，并与 Runtime Composition Manifest 比较；缺失时返回 `RUNTIME_PROFILE_INCOMPATIBLE`。详细规则见 [Runtime Composition Contract](./contracts/runtime-composition-contract.md)。

## 9. 失败与降级

1. 构建和 Loader 错误在 JS 执行前失败。
2. JS 异常转换为 typed error，不穿透 C++。
3. Render 校验失败不得部分提交 Runtime Tree。
4. Mount 失败停止本事务并返回 failed；V1 允许 Core 发起一次 full rebuild。
5. Present/Close 失败不得提前改变 Core Navigation 和可见状态。
6. Surface tombstone 后丢弃晚到结果，不复活对象。
7. 队列必须有背压和观测；具体上限由对应分 Spec 基于平台能力冻结。

## 10. 可观测设计

Toolkit、JS、Core 和 Platform 按公共 [Observation Contract](./contracts/observation-contract.md) 输出 marker。总架构维护合同与 Schema；Benchmark 的 `BM-S02` 负责验证覆盖性、测量可行性和观测开销，并通过 Handoff 提议合同变更，不建立第二套观测协议。所有主链路记录至少可由以下键关联：

C++ Kernel 的最小实现固定为 `MonotonicClock + TraceSink + RuntimeCounters`。Platform Composition Root 注入 Noop 或平台 Sink；Kernel 不格式化文本、不执行文件 I/O、不等待 Collector。关闭 Sink 只能改变证据是否存在，不能改变状态机、事务和错误结果。Android、LVGL、iOS Collector、日志导出、Benchmark 统计和可视化全部位于外围。

```text
artifactSha256 / appRuntimeId / surfaceId
requestId / transactionId / revision
nodeId / handlerId / capability requestId
timestampNs / logicalPayloadBytes / actualTransportBytes(if available)
counterName / counterValue
```

Benchmark 只消费公开观测，不改变 Runtime 状态机。V1 输出基础 Trace、事务大小、内存 bytes、Host object count 和三端报告；复杂统计和外部排名后置。

## 11. 项目边界

```text
quickapp-toolkit         Artifact producer
quickapp-runtime-js      dynamic semantics
quickapp-runtime-core    shared authoritative runtime
quickapp-runtime-lvgl    first Platform Runtime
quickapp-runtime-android alliance-compatible Platform Runtime
quickapp-runtime-ios     iOS Platform Runtime
quickapp-examples        conformance cases
quickapp-benchmark       observation and reports
```

项目之间只通过公共 Artifact、ABI、Port、Case 和 Observation Contract 协作。任何项目发现公共合同不可实现，只能通过 Handoff 提交 `[待决策]`，不得自行修改其他项目或建立私有旁路。

## 12. 详细合同索引

- [总架构合同](./architecture.md)
- [V1 范围与 Case](./v1-scope-and-acceptance.md)
- [Artifact](./contracts/artifact-contract.md)
- [Runtime ABI](./contracts/runtime-abi.md)
- [Render](./contracts/render-contract.md)
- [Event](./contracts/event-contract.md)
- [Lifecycle And Threading](./contracts/lifecycle-and-threading.md)
- [Navigation](./contracts/navigation-contract.md)
- [Platform Surface](./contracts/platform-surface-contract.md)
- [Measure Adapter](./contracts/measure-adapter-contract.md)
- [Capability Module](./contracts/capability-module-contract.md)
- [ID](./contracts/id-contract.md)
- [Error](./contracts/error-contract.md)
- [Observation](./contracts/observation-contract.md)
- [Runtime Composition](./contracts/runtime-composition-contract.md)
- [Schema](./contracts/schemas/README.md)
