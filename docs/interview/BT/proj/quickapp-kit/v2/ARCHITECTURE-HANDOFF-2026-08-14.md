# QuickApp Kit v2 架构阶段交接（2026-08-14）

> 状态：阶段性架构基线，供后续总设计、Contract、Spec 与纵向闭环实施使用。  
> 替代关系：与 `ARCHITECTURE-HANDOFF-2026-08-09.md` 冲突时，以本文为准。

## 目录

- [1. 结论](#1-结论)
- [2. 项目定位](#2-项目定位)
- [3. 联盟标准与 RPK 边界](#3-联盟标准与-rpk-边界)
- [4. V1 总体架构](#4-v1-总体架构)
- [5. JS Framework 权责](#5-js-framework-权责)
- [6. C++ Core 权责](#6-c-core-权责)
- [7. 更新与渲染管线](#7-更新与渲染管线)
- [8. 树、Diff 与局部遍历](#8-树diff-与局部遍历)
- [9. ID 与节点定位](#9-id-与节点定位)
- [10. Toolkit 方案](#10-toolkit-方案)
- [11. 跨层数据与内存](#11-跨层数据与内存)
- [12. 已确定与后续优化](#12-已确定与后续优化)
- [13. 最小纵向闭环](#13-最小纵向闭环)
- [14. 下一步](#14-下一步)

## 1. 结论

QuickApp Kit v2 采用以下主线：

```text
联盟 DSL
  -> QuickApp Toolkit
  -> 联盟结构兼容、Runtime ABI 自有的 RPK
  -> QuickApp JS Framework
  -> typed RenderTransaction
  -> 平台无关 C++ Runtime Core
  -> typed MountTransaction
  -> Android / iOS / LVGL Backend
```

V1 的核心架构基线：

1. 遵循联盟 DSL、组件、生命周期和 Feature API 语义。
2. 联盟应用源码必须经 QuickApp Toolkit 重新构建。
3. RPK 外层结构保持联盟兼容，页面 JS ABI 与编译 IR 面向 QuickApp Kit Runtime。
4. JS 保留完整表达式语义和响应式 Binding 求值。
5. JS 不构建新旧完整 VNode Tree，不执行全量 VNode Tree Diff。
6. C++ Core 持有唯一权威 Runtime Tree，执行增量 Reconcile、Style、Yoga Layout 和事件路由。
7. Platform 只消费 MountTransaction，维护 Host 对象并回传事件。
8. V1 首先以 LVGL + SDL Simulator 跑通状态、渲染和点击闭环。

架构亮点的准确表述是：

> 取消运行时全量 VNode Tree Diff，采用编译辅助的细粒度响应式更新，并由平台无关 C++ Core 统一持有渲染事实和生成 MountTransaction。

## 2. 项目定位

项目的核心价值不是分别实现多个平台，而是：

```text
联盟标准兼容
+ C++ 共享 Runtime Core
+ 嵌入式优先
+ Android / iOS / LVGL 多 Backend
+ Toolkit / Runtime / Benchmark 全链路
```

没有共享 Core，项目会演变为三套平台 Runtime；有共享 Core，应用运行语义、布局、事件和提交模型才能跨平台复用。

## 3. 联盟标准与 RPK 边界

### 3.1 兼容边界

| 项目 | V1 决策 |
|---|---|
| DSL | 采用联盟标准，不重新定义 |
| 组件、生命周期、Feature API | 遵循联盟语义 |
| RPK 目录、manifest、资源和签名结构 | 保持联盟兼容 |
| 页面 JS 编译产物 | 使用 QuickApp Kit Runtime ABI |
| Template/Binding/Block/Handler/Style IR | 由 QuickApp Toolkit 生成 |
| 联盟已构建 RPK | V1 不保证直接运行 |
| 联盟应用源码 | 使用 QuickApp Toolkit 重新构建后运行 |

本质是：

```text
源码兼容 + 容器兼容 + Runtime ABI 自有
```

### 3.2 包内概念结构

```text
app.rpk
├── manifest.json
├── app.js
├── pages/**/logic.js
├── resources/**
└── quickapp-kit/
    ├── runtime-meta.json
    ├── template.ir
    ├── bindings.ir
    ├── blocks.ir
    ├── handlers.ir
    └── styles.ir
```

V1 先使用 JSON IR，闭环稳定并完成 Benchmark 后再评估 FlatBuffers。QuickJS Bytecode 是另一条独立的启动优化，不与 IR 二进制化混为一谈。

## 4. V1 总体架构

```text
QuickApp Toolkit
  Parse / Analyze / Lower IR / Bundle / Package

QuickApp JS Framework
  ComponentInstance / State / Observer / Watcher
  Binding / Block / Handler / Lifecycle

JS-C++ Direct Binding
  RenderTransaction / FeatureRequest / EventMessage

C++ Runtime Core
  Surface / Runtime Tree / NodeArena
  Incremental Reconcile / Style / Yoga / Event Router
  Revision / Commit / MountTransaction

Platform Backend
  Android View / UIKit / LVGL
  NativeHandle / Input Adapter / Mount Applier
```

最短职责链：

```text
Toolkit 产生静态事实
JS Framework 产生动态意图
C++ Core 产生确定渲染结果
Platform Backend 产生像素并回传输入
```

## 5. JS Framework 权责

### 5.1 联盟状态语义

联盟应用使用直接赋值：

```js
this.xxx = value
```

现有 Hap Framework 使用 `Object.defineProperty + Observer + Watcher`，不是 React 风格 `setState`。V1 保持这一公开语义。

### 5.2 JS 持有的数据

```text
ComponentInstance
├── ComponentInstanceId
├── state / props
├── lifecycle
├── Binding Table / Cache
├── Dirty Binding Set
├── Block Instance State
└── Handler Table
```

JS 不持有：

- 完整新旧 VNode Tree；
- Yoga Layout Tree；
- C++ RuntimeNode 指针；
- Platform Host 对象。

### 5.3 Binding

Binding 是一个动态表达式及其渲染目标，不等于一个组件级 Watcher：

```text
一个 ComponentInstance -> 多个 Binding
一个 State 字段 -> 可影响多个 Binding
一个 Binding -> 表达式 + Node/Block Target
```

正常更新：

```text
this.xxx = value
  -> reactive setter
  -> notify dependent Watchers
  -> Promise microtask 去重刷新
  -> 重新求值受影响 Binding
  -> 变化合并
  -> RenderTransaction
```

复杂合法 JS 表达式必须完整支持。C++ Binding IR 只能作为未来透明快路径，不能限制联盟应用写法。

## 6. C++ Core 权责

C++ Core 持有唯一权威 Runtime Tree：

```text
Surface
└── Runtime Tree
    └── RuntimeNode
        ├── NodeId
        ├── type
        ├── parent / children
        ├── props / style
        ├── layout
        └── EventBinding
```

C++ Core 负责：

- 校验和应用 RenderTransaction；
- 变化合并、属性新旧值比较和 Dirty 传播；
- Style Resolve 与 Yoga Layout；
- Revision 与原子 Commit；
- 生成 MountTransaction；
- EventBinding 与事件路由；
- 平台无关 Capability 调度边界。

C++ Core 不负责业务函数、完整 JS State 和 JS Handler 执行。

## 7. 更新与渲染管线

### 7.1 普通属性更新

```text
this.title = "new"
  -> JS Binding 精确定位 Node Target
  -> UpdateProp Render Intent
  -> RenderTransaction
  -> C++ O(1) 定位 RuntimeNode
  -> 更新属性和受影响布局
  -> MountTransaction
  -> Platform
```

### 7.2 条件和列表

```text
if   -> 对应 BlockInstance 的 InsertSubtree / RemoveSubtree
for  -> 对应 ListBlock 内按 Key 做局部 Reconcile
```

列表只比较该 Block 的旧 Key 序列和新 Key 序列，不遍历完整页面树。

### 7.3 两类事务

| 事务 | 方向 | 本质 |
|---|---|---|
| `RenderTransaction` | JS -> C++ | 同一轮 JS 更新产生的结构化渲染意图 |
| `MountTransaction` | C++ -> Platform | Platform 必须执行的最终 Host 操作 |

## 8. 树、Diff 与局部遍历

### 8.1 树模型

```text
JS：Component / Binding / Block 状态，无完整 VNode Tree
C++：一棵权威 Runtime Tree
Platform：Host Tree，由平台对象形成
```

### 8.2 Diff 边界

V1 不做：

```text
执行 Render
 -> 构建完整新 VNode Tree
 -> 遍历旧树和新树
 -> 全量 Tree Diff
```

V1 仍做：

- JS Binding 新旧结果比较；
- ListBlock Key 局部 Reconcile；
- C++ Render Intent 合并与属性比较；
- Style/Layout 结果比较；
- Mount Mutation 生成。

准确术语是 `Incremental Reconcile`，不是“完全没有任何比较”。

### 8.3 何时遍历 Runtime Tree

| 场景 | 遍历范围 |
|---|---|
| 普通属性更新 | 不遍历，NodeId O(1) 定位 |
| 新建节点 | 新 Template IR 子树 |
| 删除节点 | 被删除子树 |
| 继承样式变化 | 受影响后代 |
| 布局变化 | Yoga Dirty 子树 |
| Surface 销毁 | 整体释放 Arena 或整棵树 |

## 9. ID 与节点定位

### 9.1 ID 类型

| ID | 本质 |
|---|---|
| `SurfaceId` | 一棵独立提交和销毁的根 UI 树 |
| `TemplateNodeId` | Toolkit 编译期的模板节点身份 |
| `BlockInstanceId` | JS 运行期的一次动态块实例 |
| `NodeId` | C++ Runtime Tree 中的真实节点身份 |
| `ComponentInstanceId` | JS 组件实例身份 |
| `HandlerId` | JS Handler 身份 |

动态节点映射：

```text
(BlockInstanceId, TemplateNodeId) -> NodeId
```

### 9.2 NodeId 存储

正式 Core 建议使用：

```text
NodeId = SlotIndex + Generation
```

- `SlotIndex`：O(1) 定位连续 Slot Table；
- `Generation`：防止 Slot 复用后旧事件命中新节点。

移动端 PoC 可先用 Map；嵌入式正式实现采用 `NodeArena + Slot Table + FreeList`，避免 `unordered_map` 的 bucket、独立分配和内存碎片。

## 10. Toolkit 方案

### 10.1 选型

| 部件 | V1 方案 |
|---|---|
| CLI 与编译管线 | Node.js + TypeScript |
| 联盟 `.ux` 前端 | 适配/提取 `hap-compiler`，不从零手写 |
| JS AST | Babel Parser / Traverse / Generator |
| JS Bundle | esbuild |
| CSS AST | PostCSS + 联盟样式规则 |
| IR | Normalized IR -> V1 JSON |
| RPK | 联盟结构兼容的 ZIP、资源和签名管线 |
| 测试 | Golden Test + Runtime Contract Test + 差分验证 |

### 10.2 编译管线

```text
Project Scan
 -> UX Parse
 -> Semantic Analyze
 -> Normalized IR
 -> Template/Binding/Block/Handler/Style IR
 -> JS ABI Transform
 -> esbuild Bundle
 -> RPK Package
```

联盟 Compiler 只通过 `AllianceFrontendAdapter` 接入，QuickApp Kit 的 Normalized IR、Runtime ABI 和输出协议必须自己掌握。

### 10.3 Rust 边界

V1 不用 Rust 重写整个 Toolkit。正确性和联盟语义兼容优先于编译速度。Benchmark 证明存在热点后，可将 Template Lowering、依赖图或增量构建抽成 Rust + Node N-API 的纯计算模块。

## 11. 跨层数据与内存

### 11.1 Hap 代码事实

Hap 当前渲染通道是：

```text
JS Action List
 -> JSON.stringify
 -> J2V8 External Function callNative
 -> Java String
 -> JSON Parse
 -> Java VDocument / Android View
```

J2V8 的 External Function 解决 JS 调 Java，不等于共享对象内存。该通道本质是序列化和复制。

### 11.2 QuickApp Kit V1

```text
JS Typed Object
 -> QuickJS External Function
 -> C++ 同步转换为自有 RenderTransaction
```

避免 JSON 字符串，但跨线程前仍由 C++ 独立持有数据。

### 11.3 大块数据

`ArrayBuffer` 可以让 JS 与 C++ 引用同一块字节内存，但必须约束生命周期和并发修改。图片、字体、模型、音视频优先传 `ResourceId / URI / NativeHandle`，不放入 RenderTransaction。

## 12. 已确定与后续优化

### 12.1 V1 已确定

- 联盟 DSL 与公开状态语义；
- 自有 Toolkit、页面 JS ABI 和 IR；
- JS Binding 求值作为完整语义基线；
- 无完整 JS VNode Tree 和无全量 VNode Tree Diff；
- C++ 唯一 Runtime Tree；
- RenderTransaction / MountTransaction 分层；
- LVGL + SDL 首个可观测闭环；
- JSON IR 先行。

### 12.2 不进入 V1 主线

- C++ Binding VM；
- 所有 Binding 强制编译成 C++ IR；
- 双 JS Runtime；
- FlatBuffers 强制格式；
- QuickJS Bytecode 强制分发；
- 全组件和全 Feature API 覆盖；
- 联盟已构建 RPK 的 Legacy ABI 兼容。

### 12.3 保留的性能方向

```text
JS Binding 基线
 -> Benchmark
 -> 简单高频 Binding 透明下沉 C++ IR
 -> 不支持时自动回退 JS
```

任何 C++ Binding 快路径都不能改变联盟应用表达能力和行为。

## 13. 最小纵向闭环

首个样例只验证：

```html
<div>
  <text>{{ count }}</text>
  <input type="button" value="增加" onclick="increment"/>
</div>
```

```js
increment() {
  this.count++
}
```

必须跑通：

```text
.ux
 -> Toolkit
 -> Template JSON IR + JS Bundle + RPK
 -> QuickJS
 -> this.count++
 -> Watcher / Binding
 -> RenderTransaction
 -> C++ Runtime Tree
 -> Yoga
 -> MountTransaction
 -> LVGL
 -> click EventMessage
 -> C++ Event Router
 -> JS Handler
```

验收同时记录：启动时间、单次更新耗时、事务大小、节点数、峰值内存和帧时间。

## 14. 下一步

按以下顺序继续：

1. 将本文阶段共识拆成正式 Architecture Decisions。
2. 定义 Package Contract、JS Framework Contract、RenderTransaction Contract、MountTransaction Contract 和 Event Contract。
3. 完成总 Spec，再完成 Toolkit、JS Framework、C++ Core、LVGL 四个分 Spec。
4. 实施最小纵向闭环，不横向扩展组件和 Feature。
5. 通过真实联盟样例和 Benchmark 验证后，再决定 FlatBuffers、QuickJS Bytecode 与 C++ Binding IR。

当前最重要的设计原则：

> 兼容语义优先，Core 边界稳定优先；优化必须透明、可回退、可测量。
