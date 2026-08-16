# v3 总架构合同

> 定位：本文件是 [`design.md`](./design.md) 的冻结核心架构合同；平台级标准设计入口以 `design.md` 为准。

## 目录

- [1. 结论](#1-结论)
- [2. 三层职责](#2-三层职责)
- [3. 单树渲染模型](#3-单树渲染模型)
- [4. 主链路](#4-主链路)
- [5. 组成边界](#5-组成边界)
- [6. 实现规则](#6-实现规则)

## 1. 结论

QuickApp Kit V1 采用：**JS Framework 计算增量意图，C++ Core 维护唯一权威 Runtime Tree，Platform Adapter 执行 Host 操作。**

V1 不维护 JS VNode Tree，不在 C++ 执行完整新旧树 Diff。

V1 的产品证明是联盟 DSL 经 Toolkit 生成 `quickapp-kit-rpk` 后，依次在 LVGL/SDL、Android 和 iOS 跑通生命周期、渲染、事件、能力和观测闭环；联盟 Android 实现是语义参考，不是 Core 的实现来源。范围与唯一验收见 [V1 Scope And Acceptance](./v1-scope-and-acceptance.md)。

## 2. 三层职责

| 层 | 拥有 | 负责 | 不负责 |
|---|---|---|---|
| JS Framework | state、props、Binding、Block、Handler、typed Module Facade | 执行 JS、生命周期 Hook、计算 Dirty、以 Owner + Template 定义 ID 产生增量意图 | Runtime NodeId、平台对象、Host Tree |
| C++ Core | Runtime Tree、NodeId、Style/Layout、App/Page 状态、ModuleRegistry | 应用意图、布局、事件/路由/能力调度、平台提交 | JS 函数、Android/UIKit/LVGL 类型 |
| Platform Adapter | `NodeId -> NativeHandle`、Host Tree、Provider、Measure service | 创建/更新/销毁原生对象、采集输入、字体度量、平台能力 | 业务状态、Binding、逻辑树 Diff、最终 Layout 决策 |

## 3. 单树渲染模型

```text
Template IR                 有根有序静态定义；归一化表编码，不是运行时树
      |
      v
C++ Runtime Tree            唯一权威运行时树
      |
      v
Platform Host Tree          平台对象树，不归 Core 逻辑管理
```

定义与节点定位：

```text
JS Binding: OwnerInstanceId + TemplateBindingId
JS Handler: OwnerInstanceId + TemplateHandlerId
C++: Page IR definition -> LogicalNodeRef -> NodeId -> RuntimeNode
Platform: NodeId -> NativeHandle
```

JS 不复制 Page IR 的 target；Core -> JS 事件消息中的 `LogicalNodeRef` 只描述事件 target/currentTarget，不要求 JS 用它寻址 Binding 或注册 Handler。

“无 Diff”准确含义：不比较两棵完整新旧树；JS 依据 Binding/Block 依赖提交增量操作，C++ 通过 Page IR 解析静态 target，将操作应用到唯一 Runtime Tree，并做局部合法性校验。

Page IR 的“树”是语义结构，不是第二棵可变运行时树：Toolkit 输出 `nodes/blocks/bindings/handlers` 的 ID 归一化表，Core 只建立不可变索引以完成寻址和实例化。

## 4. 主链路

首屏：

```text
Verified QuickApp Kit Runtime RPK
  -> path / version / structure / Artifact SHA-256 verification
  -> Manifest / Runtime Metadata / Page IR
  -> Core AppContext
  -> LoadVerifiedModule(app/shared bytes + bootstrap/dependencies)
  -> JS loaded Result / App onCreate
  -> SurfaceContext + LoadVerifiedModule(page bytes + expected IDs)
  -> JS export verification / loaded Result / onInit / initial Binding / onReady
  -> InstantiateTemplate(templateId, ownerInstanceId, initialBindings/Blocks/Handlers)
  -> C++ 根据 Template IR 创建 Runtime Tree
  -> Style/Layout/Measure
  -> MountTransaction
  -> Platform full Mount(hidden)
  -> Platform PresentSurfaceHost(root|push)
  -> Core commit visible state
  -> Page onShow
  -> upper result(status=presented)
```

返回页面：

```text
NavigationClose(non-root top)
  -> Platform CloseSurfaceHost(source, reveal)
  -> completed
  -> Core pop stack / commit visibility / dispatch hooks / release page resources
```

更新：

```text
state mutation
  -> Dirty Binding / Dirty Block
  -> JS Binding 求值
  -> RenderTransaction
  -> C++ 更新 Runtime Tree
  -> Style/Layout
  -> MountTransaction
  -> Platform Adapter
```

事件：

```text
Platform input
  -> PlatformInputMessage
  -> C++ Event Router
  -> JsEventDispatch / HandlerId
  -> JS Handler
  -> state mutation / typed Capability / Page Host Control
```

## 5. 组成边界

```text
Platform Composition Root
  -> fixed C++ Kernel
  -> required JS Framework + selected JS Engine Provider
  -> selected Platform/Backend/Provider/Component modules
```

Bridge、Render、Event 的 Core-side 部件与 Lifecycle、Runtime Tree、Transaction 构成不可裁剪 C++ Kernel。JS Runtime Service 是架构必选服务，但不属于 Kernel；JS Framework 只依赖 `JsEnginePort`，具体 Engine Provider 由 Composition Root 编译期选择。

外围模块只依赖内核 Port；条件构建只存在于 Composition Root 和模块 target，Kernel 不依赖外围，也不通过散布的条件分支感知外围。

每个最终 Runtime 产物必须生成 Runtime Composition Manifest。Core 在执行 JS 前以 Manifest.features 与 Page IR 推导 Artifact 需求并完成兼容性预检。详细合同见 [Runtime Composition Contract](./contracts/runtime-composition-contract.md)。

## 6. 实现规则

1. 公共协议使用 typed message，不使用无语义的通用 JSON Bridge。
2. JS 不接收 C++ `NodeId`。
3. Platform 不生成独立逻辑节点 ID。
4. JNI、UIKit、LVGL 类型只能存在对应 Platform Adapter。
5. V1 优先单 Runtime 调度线程模型；多线程优化必须保持协议不变。
6. 每个 Transaction 必须可记录 `SurfaceId`、`Revision`、`TransactionId`。
7. 无效目标、过期 Revision、平台执行失败必须有错误码和降级行为。
8. Capability 使用 ModuleRegistry + typed Provider；禁止通用 JSON Bridge。
9. Core 拥有 App/Page 状态，Hook 在 JS Executor 串行执行。
10. Measure Adapter 只提供字体 metrics；Yoga 和最终 Rect 始终属于 Core。
11. 可回滚删除中的 JS Handler 先进入 retiring；Core 未提交删除则恢复，已提交后才永久释放。
12. 未选外围模块的源文件、对象文件和依赖不得进入最终链接产物；运行时布尔开关不构成可裁剪证明。
13. Kernel 只通过 `MonotonicClock`、`TraceSink` 和 `RuntimeCounters` 产生结构化事实；平台 Collector、存储、分析和可视化全部位于外围，关闭 Sink 不改变 Runtime 行为。
