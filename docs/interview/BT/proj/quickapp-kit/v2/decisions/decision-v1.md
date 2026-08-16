# QuickApp Kit v2 V1 架构决策

> 状态：已确定  
> 日期：2026-08-14  
> 约束范围：V1 总 Spec、分项目 Spec、Contract 与首个纵向闭环  
> 替代关系：与本文冲突时，本文替代旧交接文档及 `rn-fabric-lynx-rendering-model.md` 中关于完整 JS 渲染树、C++ 全树 Diff 和首发平台的 V1 描述。

## 目录

- [1. 决策结论](#1-决策结论)
- [2. 第一性目标](#2-第一性目标)
- [3. 标准与 RPK](#3-标准与-rpk)
- [4. 分层与权责](#4-分层与权责)
- [5. 响应式与渲染更新](#5-响应式与渲染更新)
- [6. 树与 Diff](#6-树与-diff)
- [7. 事务与跨层通道](#7-事务与跨层通道)
- [8. ID 与节点定位](#8-id-与节点定位)
- [9. Toolkit 选型](#9-toolkit-选型)
- [10. V1 范围](#10-v1-范围)
- [11. 延后事项](#11-延后事项)
- [12. 风险与约束](#12-风险与约束)
- [13. 验证标准](#13-验证标准)
- [14. 后续文档](#14-后续文档)

## 1. 决策结论

QuickApp Kit v2 V1 采用：

```text
联盟 DSL
  -> QuickApp Toolkit
  -> 联盟结构兼容、Runtime ABI 自有的 RPK
  -> QuickApp JS Framework
  -> typed RenderTransaction
  -> 平台无关 C++ Runtime Core
  -> typed MountTransaction
  -> LVGL / Android / iOS Backend
```

核心决策：

1. 联盟标准定义应用语义，QuickApp Toolkit 定义面向本 Runtime 的编译产物。
2. JS Framework 保留完整 JS 表达能力，负责组件、状态、Watcher、Binding、Block、Handler 和生命周期。
3. JS 不构建新旧完整 VNode Tree，不执行全量 VNode Tree Diff。
4. C++ Core 持有唯一权威 Runtime Tree，负责增量 Reconcile、Style、Yoga、Revision、事件路由和 MountTransaction。
5. Platform Backend 不做 Diff，只执行 MountTransaction 并回传输入事件。
6. V1 以 LVGL + SDL Simulator 跑通可观测纵向闭环。

准确架构主张：

> QuickApp Kit 取消运行时全量 VNode Tree Diff，采用编译辅助的细粒度响应式更新，并由平台无关 C++ Core 统一维护渲染事实。

## 2. 第一性目标

V1 必须同时满足：

1. 合法联盟应用写法不因内部优化受到限制。
2. JS 只处理必须依赖 JS 语义的工作。
3. 渲染树、样式、布局、提交和事件路由跨平台只实现一次。
4. Platform 只实现组件、测量、输入和 Mount，不重复 Runtime 逻辑。
5. 更新成本主要由受影响 Binding 和节点数量决定，而不是页面树规模。
6. 所有性能主张均可通过真实设备与 Benchmark 验证。

## 3. 标准与 RPK

### 3.1 决策

| 项目 | V1 决策 |
|---|---|
| DSL | 采用联盟标准，不重新定义 |
| 组件、生命周期、Feature API | 遵循联盟语义 |
| RPK 外层结构 | 保持联盟目录、manifest、资源和签名结构兼容 |
| 页面 JS | 编译为 QuickApp Kit Runtime ABI |
| Template/Binding/Block/Handler/Style | 编译为 QuickApp Kit IR |
| 联盟应用源码 | 必须经 QuickApp Toolkit 重新构建 |
| 联盟已构建 RPK | V1 不保证直接运行 |

本质边界：

```text
源码兼容 + 容器兼容 + Runtime ABI 自有
```

### 3.2 原因

直接沿用联盟页面 JS ABI，会把 JS Framework 继续绑定到 Hap 的 JS DOM Action、JSON、J2V8 和 Android Java VDocument。自有页面 ABI 和 IR 是共享 C++ Core 能成立的前提。

## 4. 分层与权责

### 4.1 Toolkit

负责把联盟源码变成 Runtime 可直接消费的静态事实：

```text
Template IR
Binding Metadata
Block Metadata
Handler Metadata
Style IR
JS Bundle
Runtime Metadata
```

### 4.2 JS Framework

负责：

- `ComponentInstance`、state、props 和生命周期；
- 联盟公开状态写法 `this.xxx = value`；
- Observer、Watcher、Binding 求值和 microtask 批处理；
- `if/for` 的 Block 实例和列表 Key 局部协调；
- Handler 函数持有与执行；
- 生成 RenderTransaction；
- Feature API 的 JS 门面。

JS Framework 不负责完整 VNode Tree、Style Resolve、Yoga、Host Tree 和 Platform 控件。

### 4.3 C++ Runtime Core

负责：

- Surface、Runtime Tree、NodeArena 和节点生命周期；
- RenderTransaction 校验、合并与应用；
- 属性比较、Dirty 传播和局部 Reconcile；
- Style Resolve、Yoga Layout、Revision 和 Commit；
- MountTransaction 生成；
- EventBinding 与事件路由；
- 平台无关 Capability 注册和调度边界。

C++ Core 不持有完整业务状态，不执行 JS Handler，不依赖 Android、UIKit 或 LVGL 类型。

### 4.4 Platform Backend

负责：

- `NodeId -> NativeHandle`；
- MountTransaction 应用；
- 平台组件创建、更新、测量和销毁；
- 输入命中与 EventMessage 回传。

Backend 不重新 Diff，不解释业务状态。

## 5. 响应式与渲染更新

### 5.1 状态语义

V1 保持联盟写法：

```js
this.xxx = value
```

内部基线采用与 Hap 行为一致的：

```text
Object.defineProperty
 -> Observer / Dependency
 -> Watcher
 -> Promise microtask flush
```

Proxy 可以作为后续内部替换，但不能改变公开语义。

### 5.2 普通 Binding

```text
this.xxx = value
  -> reactive setter
  -> 依赖 xxx 的 Watcher 进入队列
  -> microtask 批量求值
  -> 比较 Binding 新旧结果
  -> 生成目标明确的 Render Intent
  -> RenderTransaction
```

Binding 是“动态表达式 + 更新目标”，不是一个组件只有一个 Watcher：

```text
一个 ComponentInstance -> 多个 Binding
一个 State 字段 -> 可影响多个 Binding
```

### 5.3 条件与列表

```text
if  -> 对应 BlockInstance 的 InsertSubtree / RemoveSubtree
for -> 对应 ListBlock 内按 Key 做局部 Reconcile
```

列表只比较所属 Block 的实例 Key，不遍历完整页面树。

## 6. 树与 Diff

### 6.1 V1 树模型

```text
JS：Component / Binding / Block 状态，无完整 VNode Tree
C++：一棵唯一权威 Runtime Tree
Platform：Host Tree，由平台对象形成
```

### 6.2 不做的过程

```text
State Change
 -> 构建完整新 VNode Tree
 -> 遍历旧树和新树
 -> 全量 Tree Diff
```

### 6.3 保留的比较

- Binding 结果新旧值比较；
- ListBlock Key 局部协调；
- Render Intent 合并和 RuntimeNode 属性比较；
- Style/Layout 结果比较；
- Mount Mutation 生成。

因此准确术语是：

```text
无全量 VNode Tree Diff
+ Incremental Reconcile
```

### 6.4 Runtime Tree 遍历边界

| 场景 | 遍历范围 |
|---|---|
| 普通属性更新 | 不遍历，按 NodeId O(1) 定位 |
| 创建节点 | 新 Template IR 子树 |
| 删除节点 | 被删除子树 |
| 继承样式变化 | 受影响后代 |
| 布局变化 | Yoga Dirty 子树 |
| Surface 销毁 | 整体释放 Arena 或整棵树 |

## 7. 事务与跨层通道

### 7.1 消息模型

| 消息 | 方向 | 本质 |
|---|---|---|
| `RenderTransaction` | JS -> C++ | 同一轮 Binding/Block 更新产生的渲染意图 |
| `FeatureRequest` | JS -> C++ Capability | 系统或平台能力请求 |
| `EventMessage` | Platform -> C++ -> JS | 某节点发生的输入事件 |
| `MountTransaction` | C++ -> Platform | Platform 必须执行的最终 Host 操作 |

Render、Feature、Event 保持独立语义，不合并为通用 Bridge 消息。

### 7.2 数据通道

V1：

```text
JS Typed Object
 -> QuickJS External Function
 -> C++ 同步转换为自有 typed transaction
```

不走 Hap 的：

```text
JSON.stringify -> String copy -> JSON parse
```

普通 JS 对象不与 Core 跨线程共享。`ArrayBuffer` 只用于适合共享或转移所有权的大块字节数据，不承载长期可变 Runtime Tree。

## 8. ID 与节点定位

### 8.1 ID 语义

| ID | 标识对象 |
|---|---|
| `SurfaceId` | 一棵独立提交和销毁的根 UI 树 |
| `TemplateNodeId` | Toolkit 编译期模板节点 |
| `BlockInstanceId` | JS 运行期动态块实例 |
| `NodeId` | C++ Runtime Tree 中的真实节点 |
| `ComponentInstanceId` | JS 组件实例 |
| `HandlerId` | JS Handler |

动态节点逻辑映射：

```text
(BlockInstanceId, TemplateNodeId) -> NodeId
```

RenderTarget 的最终字段和映射生命周期由 RenderTransaction Contract 固定。

### 8.2 NodeArena

正式共享 Core 采用：

```text
NodeId = SlotIndex + Generation
```

- SlotIndex 负责连续表 O(1) 定位；
- Generation 防止 Slot 复用后旧事件误命中新节点。

V1 PoC 可先使用 Map 验证合同，但正式嵌入式实现以 `NodeArena + Slot Table + FreeList` 为目标。

## 9. Toolkit 选型

| 部件 | V1 决策 |
|---|---|
| 编译管线与 CLI | Node.js + TypeScript |
| 联盟 `.ux` 前端 | 通过 Adapter 复用/提取 `hap-compiler` |
| JS AST | Babel Parser / Traverse / Generator |
| JS Bundle | esbuild |
| CSS AST | PostCSS + 联盟样式规则 |
| 中间表示 | 自有 Normalized IR |
| 运行时 IR | V1 JSON |
| 打包 | 联盟结构兼容 RPK |
| 验证 | Golden、Contract、差分和 Benchmark 测试 |

不直接修改联盟 Toolkit，也不从零手写 `.ux` 解析器。联盟实现通过 `AllianceFrontendAdapter` 隔离；Normalized IR、Runtime ABI 和 Package Contract 由 QuickApp Kit 自己掌握。

Rust 不作为 V1 整体 Toolkit 语言。Benchmark 证明存在纯计算热点后，再通过 Node N-API 下沉 Template Lowering、依赖图或增量构建。

## 10. V1 范围

V1 先完成：

```text
静态 Template IR
普通 Binding
事件 Handler
if
基础 keyed for
JS 完整 Binding 求值
C++ Runtime Tree
Style / Yoga
MountTransaction
LVGL + SDL Simulator
Trace / Benchmark
```

首个闭环：

```text
.ux
 -> Toolkit
 -> JSON IR + JS Bundle + RPK
 -> QuickJS
 -> this.count++
 -> Watcher / Binding
 -> RenderTransaction
 -> C++ Runtime Tree
 -> Yoga
 -> MountTransaction
 -> LVGL
 -> click EventMessage
 -> JS Handler
```

## 11. 延后事项

V1 主线不包含：

- C++ Binding VM；
- 强制把所有 Binding 编译为 C++ IR；
- 双 JS Runtime；
- 全量 VNode Tree Diff；
- FlatBuffers 强制格式；
- QuickJS Bytecode 强制分发；
- 联盟已构建 RPK Legacy ABI 兼容；
- 全组件和全 Feature API 覆盖；
- Toolkit 全量 Rust 重写。

C++ Binding IR 仅作为未来透明快路径：必须完整回退 JS，不得限制联盟合法表达式。

## 12. 风险与约束

| 风险 | 约束 |
|---|---|
| 编译器遗漏 Binding/Block 语义 | 复用联盟前端并建立 Golden 与差分测试 |
| `for + key + lifecycle + slot` 复杂 | 按独立 Block Contract 和测试矩阵实施 |
| JS 与 Core 节点身份不一致 | ID 生命周期和 RenderTarget 在 Contract 中固定 |
| 事务顺序错误 | Render/Mount Transaction 分别定义合法状态机 |
| 性能优化破坏语义 | 所有优化透明、可回退、由 Benchmark 驱动 |
| 文档仍存在旧架构描述 | 本文具有 V1 冲突覆盖权，后续同步修订旧文档 |

## 13. 验证标准

V1 架构成立必须证明：

1. 联盟示例源码可经 QuickApp Toolkit 构建为目标 RPK。
2. 静态页面可由 Template IR 创建 Runtime Tree 和 LVGL Host Tree。
3. `this.count++` 只更新受影响 Binding，不构建和遍历完整 VNode Tree。
4. 点击事件通过 Node/Event Binding 回到正确 JS Handler。
5. 连续状态写入在一个 microtask 批次合并。
6. keyed list 的插入、删除、移动和复用行为正确。
7. C++ Core 不依赖 LVGL 类型，Backend 不执行 Diff。
8. Trace 能关联 State、Binding、RenderTransaction、Revision、MountTransaction 和 Frame。
9. Benchmark 输出启动时间、更新耗时、事务大小、节点数、峰值内存和帧时间。

## 14. 后续文档

本文之后按顺序完成：

1. Package Contract；
2. JS Framework Contract；
3. RenderTransaction Contract；
4. Runtime Tree / NodeId Contract；
5. MountTransaction Contract；
6. Event Contract；
7. 总 Spec；
8. Toolkit、JS Framework、C++ Core、LVGL 分 Spec。

实施原则：

> 兼容语义优先，Core 边界稳定优先；优化必须透明、可回退、可测量。
