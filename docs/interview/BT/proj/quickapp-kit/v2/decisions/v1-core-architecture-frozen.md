# QuickApp Kit V1 核心架构冻结

> 状态：已冻结  
> 日期：2026-08-14  
> 范围：Bridge、渲染管线、事件系统及三层边界  
> 设计来源：`my-design.md` 由设计者持续维护；本文只固化已经确认的 V1 决策。  
> 决策关系：本文聚焦核心机制；完整 V1 范围仍以 `decision-v1.md` 为准。

## 目录

- [1. 冻结结论](#1-冻结结论)
- [2. 分层与所有权](#2-分层与所有权)
- [2.1 ID 与身份映射](#21-id-与身份映射)
- [2.2 Template IR 最小例子](#22-template-ir-最小例子)
- [3. Bridge](#3-bridge)
- [4. 渲染管线](#4-渲染管线)
- [5. 事件系统](#5-事件系统)
- [6. 跨层通信与内存](#6-跨层通信与内存)
- [7. V1 不采用的方案](#7-v1-不采用的方案)
- [8. 尚未冻结的实现参数](#8-尚未冻结的实现参数)
- [9. 架构验收条件](#9-架构验收条件)

## 1. 冻结结论

**一句话本质：JS 计算动态表达式的变化结果，C++ Core 维护唯一 Runtime Tree 并计算最终渲染结果，Platform 只执行 Host 操作并回传输入。**

V1 主链冻结为：

```text
联盟 DSL
  -> QuickApp Toolkit 编译静态 IR 与 JS Bundle
  -> JS Framework 执行 State / Binding / Block / Handler
  -> typed RenderTransaction
  -> C++ Runtime Core 应用变化、Style、Yoga、Commit
  -> typed MountTransaction
  -> LVGL / Android / iOS Platform Backend
```

V1 的性能原则不是“尽可能下沉”，而是：

> 计算在其数据所有者所在层完成，跨层只传变化；更新成本与实际变化规模相关，而不是与页面树总规模相关。

## 2. 分层与所有权

| 层 | 独占状态 | 核心职责 |
|---|---|---|
| JS Framework | ComponentInstance、state/props、Binding、Block、Handler、生命周期 | 响应状态变化、求值 Dirty Binding、产生 Render Intent |
| C++ Runtime Core | Surface、Runtime Tree、NodeArena、Style/Layout 状态、Revision | 应用 Intent、局部计算、生成 MountTransaction、路由事件 |
| Platform Backend | `NodeId -> NativeHandle`、Host Tree、平台输入对象 | 执行 MountTransaction、绘制、采集并回传事件 |

状态所有权冻结为：

```text
JS 不持有完整 VNode Tree。
C++ 持有唯一权威 Runtime Tree。
Platform 持有由真实控件形成的 Host Tree。
三层不共享可变树对象。
```

### 2.1 ID 与身份映射

**本质：编译期 ID 定位静态定义，运行时 ID 定位对象实例，协议序号只保证消息顺序与关联。**

V1 当前冻结 6 种对象身份 ID：

| ID | 标识对象 | 产生位置 |
|---|---|---|
| `SurfaceId` | 一棵独立提交、显示和销毁的页面根树 | C++ Core |
| `TemplateNodeId` | Template IR 中的静态模板节点 | Toolkit |
| `ComponentInstanceId` | 一次 JS 组件实例 | JS Framework |
| `BlockInstanceId` | 一次 `if/for` 动态块实例 | JS Framework |
| `NodeId` | C++ Runtime Tree 中的真实运行时节点 | C++ Core |
| `HandlerId` | JS Framework 注册的一次事件处理函数身份 | JS Framework |

三个核心身份映射：

```text
OwnerInstanceId + TemplateNodeId
  -> NodeId

NodeId + EventType
  -> HandlerId
  -> JS Function

NodeId
  -> NativeHandle
```

`OwnerInstanceId` 是映射概念，不新增一种对象 ID；它根据节点归属表示 `ComponentInstanceId` 或 `BlockInstanceId`。

#### 跨层节点引用决策

**已冻结：JS 不持有、不接收 `NodeId`。**

JS 使用逻辑节点引用：

```text
LogicalNodeRef
  = OwnerInstanceId + TemplateNodeId
```

C++ Core 负责解析：

```text
LogicalNodeRef
  -> NodeId
  -> RuntimeNode
```

Platform 不创建第三套节点 ID，而是复用 C++ 分配的 `NodeId`：

```text
NodeId
  -> NativeHandle
```

三层身份语义：

| 层 | 使用的身份 | 本质 |
|---|---|---|
| Toolkit | `TemplateNodeId` | 静态模板节点定义 |
| JS Framework | `OwnerInstanceId + TemplateNodeId` | 某次实例中的逻辑节点目标 |
| C++ Core / Platform | `NodeId` | 实际 RuntimeNode 及其 Host Object 身份 |

这样实例化模板后无需把 `TemplateNodeId -> NodeId` 映射返回 JS；映射只由 C++ Core 持有。

以下字段属于协议序号，不计入 6 种对象 ID：

| 字段 | 作用 |
|---|---|
| `Revision` | 保证单个 Surface 的 Render/Mount 提交顺序 |
| `TransactionId` | 追踪一次 RenderTransaction 或 MountTransaction |
| `RequestId` | 关联 FeatureRequest 与 FeatureResult |

`TemplateBindingId`、`TemplateBlockId` 是 Toolkit IR 的编译期定义 ID，不计入上述 6 种运行时对象身份 ID；其字段合同由 Toolkit Spec 冻结。

### 2.2 Template IR 最小例子

`Template IR` 是 Toolkit 将静态模板编译成的、供 C++ 构建 Runtime Tree 的结构。

源码：

```html
<div>
  <text>{{ title }}</text>
</div>
```

Template IR：

```json
{
  "nodes": [
    {
      "templateNodeId": 1,
      "type": "div",
      "children": [2]
    },
    {
      "templateNodeId": 2,
      "type": "text",
      "props": {
        "value": {
          "bindingId": 1
        }
      }
    }
  ]
}
```

Binding 定义：

```json
{
  "bindingId": 1,
  "statePath": "title",
  "target": {
    "templateNodeId": 2,
    "prop": "value"
  }
}
```

运行时：

```text
title 变化
  -> Binding 1 求值
  -> UpdateProp(NodeId, "value", 新值)
  -> C++ 更新 Runtime Tree
```

## 3. Bridge

### 3.1 JS 与 C++

**本质：External Function 是 JS 进入 C++ 的技术入口，typed protocol 才是 Bridge 合同。**

```text
JS Framework
  -> QuickJS External Function / External Object Method
  -> C++ Bridge Dispatcher
  -> Render / Feature 子系统
```

V1 保持三类独立语义：

| 消息 | 方向 | 语义 |
|---|---|---|
| `RenderTransaction` | JS -> C++ | 一轮 Binding/Block 更新产生的渲染意图 |
| `FeatureRequest/Result` | JS <-> C++ | 系统或平台能力调用及结果 |
| `EventMessage` | C++ -> JS | 平台输入事件 |

不把三类消息压成无语义的通用 JSON Bridge。

### 3.2 C++ 与 Platform

**本质：Core 只依赖 Platform Contract，各平台负责把 Contract 映射到本地 API。**

```text
C++ Core
  -> Platform Adapter Interface
  -> Platform Backend
```

| 平台 | 边界实现 |
|---|---|
| Android | Android Backend 内通过 JNI 连接 Java/Kotlin View 系统 |
| iOS | iOS Backend 内通过 Objective-C++ 连接 UIKit |
| LVGL | LVGL Backend 直接调用 LVGL C API |

JNI、UIKit 和 LVGL 类型均不得进入 C++ Core。

## 4. 渲染管线

### 4.1 首次渲染

**已冻结：采用方案 B。JS 发送模板实例化意图，C++ 根据静态 IR 创建 Runtime Tree；JS 不逐节点发送完整创建树。**

```text
Toolkit
  -> Template / Binding / Block / Handler / Style IR

JS Framework
  -> 创建 ComponentInstance
  -> 初始化 State / Binding / Block
  -> 求值首屏动态 Binding
  -> 生成 InstantiateTemplate(templateId, componentInstanceId, initialBindings)

C++ Core
  -> 读取静态 IR
  -> 分配 NodeId
  -> 构建唯一 Runtime Tree 子树
  -> 应用 initialBindings
  -> Style Resolve / Yoga Layout
  -> 生成 MountTransaction

Platform
  -> 执行 MountTransaction
  -> 构建 Host Tree
  -> 首屏绘制
```

动态 Block 使用同一模型：

```text
InstantiateBlock(templateBlockId, blockInstanceId)
  -> C++ 根据 Block IR 创建 Runtime Tree 子树

RemoveBlock(blockInstanceId)
  -> C++ 删除对应 Runtime Tree 子树
```

### 4.2 状态更新

```text
this.xxx = value
  -> Reactive Setter 写入状态
  -> 找到依赖 StatePath(xxx) 的 Binding
  -> 标记 Binding Dirty
  -> Microtask 合并并求值 Dirty Binding
  -> 比较 Binding 新旧结果
  -> 只为结果变化生成 Render Intent
  -> 合批为 RenderTransaction
```

C++ 收到事务后：

```text
Validate
  -> Coalesce Intent
  -> 按 NodeId 原地修改唯一 Runtime Tree
  -> Dirty Propagation
  -> Style Resolve
  -> Yoga 局部 Layout
  -> 生成 MountTransaction
```

Platform 收到事务后：

```text
顺序执行 Mount Mutation
  -> Create / Insert / Update / Move / Remove Host Object
  -> 提交 Revision
  -> 等待平台绘制
```

### 4.3 两类事务

| 事务 | 回答的问题 | 不包含什么 |
|---|---|---|
| `RenderTransaction` | 逻辑页面需要改变什么 | Android View、UIKit、LVGL 对象 |
| `MountTransaction` | Platform 必须执行什么 Host 操作 | 业务状态、Binding、JS Handler |

### 4.4 Diff 决策

V1 不执行：

```text
构建完整新 VNode Tree
  -> 比较完整新旧 VNode Tree
  -> 生成差异
```

V1 保留必要的局部比较：

- Binding 新旧结果比较；
- keyed ListBlock 的局部 Key 协调；
- Render Intent 合并和 RuntimeNode 属性比较；
- Style/Layout 结果比较；
- Mount Mutation 生成。

因此准确表述是：

> V1 无完整 VNode Tree Diff，但保留目标明确的局部 Incremental Reconcile。

## 5. 事件系统

### 5.1 Handler 所有权

| 内容 | 所在层 |
|---|---|
| 业务 Event Handler 函数 | JS Framework |
| `HandlerId -> JS Function` | JS Framework |
| `NodeId + EventType -> HandlerId` | C++ Core EventBinding |
| 平台监听器与 NativeHandle | Platform Backend |

C++ 不持有 JS Function，Platform 不解释业务 Handler。

### 5.2 注册

```text
Toolkit 生成 Handler Metadata
  -> JS Framework 注册 HandlerId
  -> RenderTransaction 携带 EventBinding
  -> C++ RuntimeNode 保存 NodeId/EventType/HandlerId
  -> MountTransaction 要求 Platform 注册监听器
```

### 5.3 触发

```text
Android View / UIKit / LVGL 产生输入
  -> Platform 构造 EventMessage(NodeId, EventType, Payload)
  -> C++ Event Router 校验 Surface、NodeId、Generation 和 EventBinding
  -> 投递 JS Event Queue
  -> JS Framework 按 HandlerId 找到并执行业务函数
  -> 状态变化重新进入渲染管线
```

`NodeId` 是 Runtime Tree 与 Host Object 的跨层身份，`HandlerId` 是事件逻辑的 JS 身份，两者语义不能混合。

## 6. 跨层通信与内存

总原则冻结为：

> 跨线程传拥有所有权的不可变消息；跨语言边界不共享长期可变业务对象。

| 边界 | V1 数据策略 |
|---|---|
| JS -> C++ | External Function 调用期间读取 JS Typed Object，并转换为 C++ 自有 typed transaction |
| C++ -> Platform | 移动或传递不可变 MountTransaction，由接收方消费 |
| Platform -> C++ -> JS | 复制并规范化 EventMessage，投递到 JS Event Queue |
| 大块二进制 | 仅在所有权和生命周期可证明时使用 ArrayBuffer 转移或共享 |

V1 不以 Zero Copy 为目标。优先级为：

```text
所有权正确
  -> 批处理减少边界次数
  -> 测量复制成本
  -> 只对已证明的热点优化
```

## 7. V1 不采用的方案

1. JS 维护完整新旧 VNode Tree并执行全量 Tree Diff。
2. JS 每次向 C++ 发送完整页面树。
3. C++ 为每次更新构建第二棵新 Runtime Tree再做全树 Diff。
4. Platform Backend 解释业务状态或重复 Diff。
5. 把 JNI、UIKit 或 LVGL 类型放进 Core。
6. 把 C++ Binding VM 作为 V1 前置条件。
7. 用无类型 JSON 消息统一 Render、Feature 和 Event。

## 8. 尚未冻结的实现参数

以下属于后续 Contract、Spec 或 Benchmark 决策，不得从本文推断：

1. JS、Render、Platform 三个逻辑执行域映射为几个物理线程。
2. Microtask flush 的时间预算、Intent 数量上限和降级阈值。
3. RenderTransaction 与 MountTransaction 的最终字段编码。
4. V1 JSON IR 稳定后是否采用 FlatBuffers 或其他二进制格式。
5. ArrayBuffer 使用阈值及共享、转移策略。
6. C++ Binding VM 是否值得实现及可编译表达式范围。

## 9. 架构验收条件

V1 骨架成立必须证明：

1. 状态更新只求值受影响 Binding，不构建完整 VNode Tree。
2. Binding 结果未变化时不产生无效 Render Intent。
3. C++ 按 NodeId 局部更新唯一 Runtime Tree。
4. Platform 只消费 MountTransaction，不执行 Diff。
5. 点击事件能按 NodeId/EventBinding 回到正确 JS Handler。
6. 连续状态写入可合并为一个 flush 批次。
7. Core 不依赖任何具体平台类型。
8. Trace 能关联 State、Binding、RenderTransaction、Revision、MountTransaction、Event 和 Frame。
9. Benchmark 能输出启动、更新、事务大小、节点数、内存和帧时间。
