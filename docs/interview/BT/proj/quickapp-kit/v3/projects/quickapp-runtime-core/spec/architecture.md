# Runtime Core 总 Spec：总体架构

## 目录

- [1. 结论](#1-结论)
- [2. 组件架构](#2-组件架构)
- [3. 权威状态与所有权](#3-权威状态与所有权)
- [4. 关键主流程](#4-关键主流程)
- [5. 线程与通信](#5-线程与通信)
- [6. 失败与恢复](#6-失败与恢复)
- [7. 跨项目边界](#7-跨项目边界)

## 1. 结论

Core 采用**单写者状态机 + typed message + 可替换 Adapter**架构。Core Runtime Thread 是逻辑状态唯一写者；JS 和 Platform 只能通过消息提交意图或结果。

## 2. 组件架构

```text
RuntimeHostPort
  -> PackageLoader
  -> AppRuntimeController
      -> LifecycleController
      -> SurfaceController
      -> NavigationController
      -> CapabilitySubsystem
      -> PageControlRouter

SurfaceController
  -> RuntimeTreeStore
  -> RenderTransactionProcessor
  -> StyleLayoutEngine(Yoga + MeasureCache)
  -> MountCoordinator
  -> EventRouter

Ports
  -> JsRuntimePort
  -> PlatformSurfacePort
  -> PlatformMountPort
  -> PlatformCapabilityPort
  -> PlatformMeasureAdapter
  -> MonotonicClock
  -> TraceSink
```

| 组件 | 权威状态 |
|---|---|
| PackageLoader | Package index、已验证 Artifact、Page IR cache |
| AppRuntimeController | AppContext、App 状态、Provider 生命周期 |
| LifecycleController | Hook sequence 与 App/Page 状态转换 |
| SurfaceController | Surface 状态、Revision、在途请求 |
| RuntimeTreeStore | Runtime Node、Page IR definition/Owner 解析、LogicalNodeRef 映射、Block ownership |
| NavigationController | 权威页面栈与未提交 target |
| EventRouter | EventBinding 与冒泡路径 |
| CapabilitySubsystem | Registry、Invoker、Provider、requestId 关联；Guard 为第二期扩展点 |
| MountCoordinator | Runtime Tree/Revision 唯一提交点、Mount attempt、degraded/full rebuild 状态 |
| RuntimeObservability | Clock、结构化 Trace 发射、Node/Handler/Surface/Queue 轻量计数；不存储、不分析 |

## 3. 权威状态与所有权

```text
Page IR              immutable static definition
Runtime Tree         Core 唯一权威运行时树
Platform Host Tree   Platform 执行副本
```

Render 暂存区只保存操作日志或 copy-on-write 变更集，用于原子校验和 Layout；它不是第二棵长期权威树。

Core 只长期保存：

- `LogicalNodeRef <-> NodeId`
- Runtime parent/children、component、props、style、layout
- Block ownership 与 EventBinding
- Surface Revision、状态和 Mount 恢复信息

## 4. 关键主流程

### 4.1 加载与首屏

```text
open PackageSource
  -> index and verify package
  -> create AppRuntime / dispatch AppContext
  -> VerifiedModulePort transfers immutable app Bundle bytes/bootstrap/dependencies to JS
  -> loaded Result -> VmInitializationDispatch(app) -> completed
  -> create hidden Platform Surface
  -> emit SurfaceContext
  -> transfer verified page Bundle/expected IDs -> loaded Result
  -> VmInitializationDispatch(page) -> completed
  -> receive InstantiateTemplate
  -> stage Runtime Tree + handlers + blocks
  -> Style/Yoga/Measure
  -> commit revision 0
  -> full Mount hidden
  -> Present
  -> commit visible/navigation state
  -> lifecycle onShow + presented results
```

### 4.2 更新

```text
RenderTransaction(revision=n+1)
  -> SurfaceController validates lifecycle/revision/single in-flight
  -> RenderTransactionProcessor validates targets and creates staged change set
  -> resolve Owner + TemplateBindingId through Page IR
  -> stage ordered operations without mutating committed Runtime Tree
  -> StyleLayoutEngine resolves style/layout/measure on staged candidate
  -> MountCoordinator atomically commits Runtime Tree and revision
  -> MountCoordinator generates incremental Mount
  -> Platform mounted
  -> RenderTransactionResult(presented)
```

### 4.3 事件

```text
PlatformInputMessage(RequestId, NodeId)
  -> validate live Surface/Node
  -> derive Runtime Tree bubble path
  -> resolve EventBinding
  -> emit ordered JsEventDispatch(RequestId, LogicalNodeRef, HandlerId)
```

### 4.4 导航

Navigation target 作为未提交 Surface 构建。只有 target full Mount 和 push Present 全部成功后，Core 才原子更新页面栈；失败只销毁 target，source 保持 visible。Close 只作用于非 Root 栈顶：Platform 原子关闭 target/恢复前驱成功后，Core 才 pop 栈并完成 Hook/资源释放。

可回滚 Block 删除期间，Core 在 Runtime Tree commit 前保留旧 EventBinding；JS Handler 同期处于 retiring。`rejected/cancelled` 不提交删除，JS 恢复 live；`presented/presentationFailed` 表示删除已提交，JS 才永久释放。

## 5. 线程与通信

V1 逻辑执行归属：

| 归属 | 规则 |
|---|---|
| Core Runtime Thread | 唯一修改 Core 状态；顺序处理同一 Surface 消息 |
| JS Executor Thread | 通过 `JsRuntimePort` 异步收发 immutable value |
| Platform UI/Event Thread | 通过 Platform Port 异步执行 Surface/Mount/Input |
| Measure | Core Runtime Thread 内通过 Core Foundation 定义的 PlatformMeasurePort 同步调用只读 Adapter，不等待 UI Thread |
| Trace | 生产者线程调用非阻塞 `TraceSink.emit`；Sink 不得回调 Runtime，跨线程保留由外围复制到有界缓冲区 |

具体平台允许把归属映射到同一线程，但 Port、所有权和结果顺序保持不变。跨边界数据复制或转移所有权，不共享可变容器和对象指针。

## 6. 失败与恢复

| 失败点 | Core 行为 |
|---|---|
| Package/IR/Module Load | 执行 JS 前终止 AppRuntime 创建；不向 JS 暴露未校验路径或 bytes |
| VM Initialization | App failed 终止 AppRuntime；Page failed 销毁未提交 Surface；不等待超时，不接受后续 Instantiate |
| Instantiate 校验/Layout | 丢弃暂存区，销毁失败 Surface |
| Render 校验/Layout | 丢弃暂存区，保持上一 committed Revision |
| Incremental Mount | Surface degraded，依据权威树执行一次 full rebuild |
| Full rebuild | 再失败转 failed，拒绝新消息并销毁 Host |
| Present/Navigation | 不提交 visible/页面栈，销毁 target |
| Measure | 返回 failed 或非法 metrics 时丢弃暂存区，Revision 不前进 |
| Hook/Handler/Provider | typed error + Trace，按公共合同继续、回滚或终止 |
| TraceSink 关闭/失败 | Runtime 行为不变；只使观测样本缺失或无效 |

## 7. 跨项目边界

| 项目 | Core 依赖/交付 |
|---|---|
| Toolkit | Core 只消费冻结 Artifact，不解释源码 DSL |
| JS Runtime | Runtime ABI 是唯一边界；Core 不保存 JS 函数 |
| Android/LVGL/iOS | 平台实现 Ports 与 TraceSink/Collector Adapter；Core 不引用平台类型 |
| Benchmark | 只消费关联 Trace、计数、耗时和内存观测，不向 Core 注入分析逻辑 |
