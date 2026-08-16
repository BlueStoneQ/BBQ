# 三类渲染树：Render Intent、Shadow 与 Host

> 状态：核心概念已确定  
> 目的：统一 QuickApp Kit v2 对渲染结构、所属层、执行线程、身份和所有权的定义。

## 目录

- [1. 结论先行](#1-结论先行)
- [2. 第一性定义](#2-第一性定义)
- [3. 三类树正式定义](#3-三类树正式定义)
- [4. Render Intent Tree](#4-render-intent-tree)
- [5. Shadow Tree](#5-shadow-tree)
- [6. Host Tree](#6-host-tree)
- [7. 身份模型](#7-身份模型)
- [8. 三类树的映射关系](#8-三类树的映射关系)
- [9. 首次渲染与更新](#9-首次渲染与更新)
- [10. 线程与所有权约束](#10-线程与所有权约束)
- [11. 与 Template IR 的关系](#11-与-template-ir-的关系)
- [12. 统一术语](#12-统一术语)
- [13. 重点吸收点](#13-重点吸收点)

## 1. 结论先行

QuickApp Kit v2 统一使用三类渲染结构：

| 树 | 所属层.部件/线程 | 特征 | 身份 |
|---|---|---|---|
| Render Intent Tree | `JS层.JS Framework/Runtime Thread` | 声明式、可重建，表达应用期望展示什么 | `key/templateId/componentInstanceId` |
| Shadow Tree | `C++层.Runtime Core/Runtime或Render Thread` | 持久化、版本化、平台无关，表达 Runtime 已计算并提交什么 | `NodeId` |
| Host Tree | `Platform层.Render Backend/UI Thread` | Android View、UIView、LVGL Object 等真实平台对象 | `NodeId -> NativeHandle` |

三者的第一性关系：

```text
Render Intent Tree = 应用意图
Shadow Tree        = 平台无关的已计算渲染状态
Host Tree          = 平台当前实际对象
```

核心边界：

> JS 决定想展示什么，C++ Core 决定渲染状态如何变化，Platform Backend 决定如何更新真实控件。

`Render Intent Tree` 是逻辑输入模型，不强制 JS Framework 永久保存一棵完整对象树。它可以是一次 Render 的临时结果、Dirty Subtree，或由 Template IR 产生的等价声明输入。

## 2. 第一性定义

声明式 UI 的输入是状态，输出是界面：

```text
UI Intent = Render(State)
```

但应用意图不能直接等同于平台事实：

- JS 不知道 Android View、UIKit、LVGL 的对象和线程规则；
- Platform Backend 不应理解组件状态、模板指令和业务语义；
- C++ Core 需要在两者之间维护平台无关、可版本化、可提交的渲染状态。

因此必须区分：

```text
声明意图
→ 计算状态
→ 平台事实
```

三类树不是为了增加层次，而是为了给三类事实确定唯一所有者。

## 3. 三类树正式定义

```text
JS层.Runtime Thread
State / Component / Template
        ↓ Render
Render Intent Tree
        ↓ SubmitTree / SubmitSubtree

C++层.Runtime或Render Thread
Reconcile
        ↓
Next Shadow Tree
        ↓ Style / Layout / Commit
Committed Shadow Revision
        ↓ MountTransaction

Platform层.UI Thread
Render Backend
        ↓
Host Tree
```

每一层只拥有自己理解的数据：

| 层 | 可以理解 | 不应拥有 |
|---|---|---|
| JS Framework | 状态、组件、模板、key、事件函数 | NativeHandle、平台控件、布局提交状态 |
| C++ Runtime Core | NodeId、树结构、Props、Style、Layout、Revision | JS函数对象、Android View、UIView、lv_obj_t |
| Platform Backend | NativeHandle、平台控件、UI线程和输入事件 | 业务状态、组件Reconcile、Shadow revision规则 |

## 4. Render Intent Tree

### 4.1 定义

Render Intent Tree 表达应用在当前状态下期望得到的 UI：

```cpp
struct RenderElement {
  ElementType type;
  ElementKey key;
  TemplateId template_id;
  ComponentInstanceId component_instance_id;
  Props props;
  Style style;
  EventBindings events;
  std::vector<RenderElement> children;
};
```

这是概念结构，不是最终 ABI。JS 到 C++ 的正式协议需要在 Render Input Contract 中定义。

### 4.2 所属层和线程

```text
JS层.JS Framework/Runtime Thread
```

JS Framework 负责：

- 业务状态和组件实例；
- Dirty 标记和 Render 调度；
- 执行模板、`if/for/slot` 和组件语义；
- 生成完整 Render Intent 或 Dirty Subtree；
- 将 JS Handler 转换为稳定 `HandlerId`。

### 4.3 身份

Render Intent 节点使用语义身份：

```text
type + key + templateId + componentInstanceId
```

这些标识用于帮助 C++ Reconciler 判断新旧意图是否代表同一个逻辑实例。它们不是平台节点 ID。

### 4.4 生命周期

Render Intent 可以是临时值：

```text
State更新
→ Render
→ Submit
→ C++规范化
→ JS临时RenderElement可释放
```

因此“JS 层存在 Render Intent Tree”不等于“JS 必须永久维护第二棵持久渲染树”。

## 5. Shadow Tree

### 5.1 定义

Shadow Tree 是 C++ Core 对平台无关渲染状态的权威表示：

```cpp
struct ShadowNode {
  NodeId node_id;
  ElementType type;
  TreeLinks links;
  NormalizedProps props;
  ComputedStyle style;
  LayoutMetrics layout;
  EventMask event_mask;
  DirtyFlags dirty;
};
```

### 5.2 所属层和线程

```text
C++层.Runtime Core/Runtime Thread
```

V1 可在 Runtime Thread 执行；后续只有在 Benchmark 证明必要时，才迁移到独立 Render Thread。

### 5.3 职责

C++ Core 负责：

- Reconcile 和节点复用；
- 分配、复用和销毁 `NodeId`；
- Props 和 Style 规范化；
- Layout；
- Dirty 状态传播；
- Current/Next revision；
- Commit；
- 生成 MountTransaction。

### 5.4 Revision

一次渲染过程中至少区分：

```text
Current Shadow Revision
上一次成功提交的状态

Next Shadow Revision
根据本次Render Intent计算出的候选状态

Mounted Revision
Platform Backend已经执行完成的状态
```

Next 在 Commit 前不是平台事实，可以因过期、页面销毁或校验失败而丢弃。

## 6. Host Tree

### 6.1 定义

Host Tree 是各平台用于显示和交互的真实对象集合：

| 平台 | Host对象 |
|---|---|
| Android | `View`、`ViewGroup`、`TextView` |
| iOS | `UIView`、`UILabel`、`CALayer` |
| LVGL | `lv_obj_t`、`lv_label`、`lv_img` |

### 6.2 所属层和线程

```text
Platform层.Render Backend/UI Thread
```

Android/iOS 的 Host Tree 只能在系统 UI Thread 修改；LVGL Host Tree 只能由 LVGL Owner Thread/Loop 修改。

### 6.3 所有权

Platform Backend 拥有：

- Host对象的创建、销毁和内存；
- `NodeId -> NativeHandle` Registry；
- UI Thread 调度；
- 平台属性和文本的具体应用；
- 原始输入事件接入；
- Mount 成功或失败回执。

C++ Core 产生 Host Tree 的期望变化，但不保存平台指针：

```text
禁止进入Core：
jobject
View*
UIView*
CALayer*
lv_obj_t*
```

## 7. 身份模型

### 7.1 标识分工

| 标识 | 生成者 | 作用域 | 用途 |
|---|---|---|---|
| `TemplateId` | Toolkit | 应用包/模板 | 定位静态模板 |
| `ComponentInstanceId` | Runtime | Surface | 定位组件实例 |
| `Key` | 应用/模板 | 同级动态列表 | Reconcile节点匹配 |
| `HandlerId` | JS Framework | JS Runtime | 定位JS事件函数 |
| `NodeId` | C++ Runtime Core | Surface | Shadow与Host之间的稳定身份 |
| `NativeHandle` | Platform Backend | Backend实例 | 定位真实平台对象 |

### 7.2 NodeId

`NodeId` 由 C++ Reconciler 在 ShadowNode 首次创建时分配，匹配成功时复用：

```text
RenderElement(type=text, key=counter)
        ↓ C++ Reconcile
匹配成功：复用NodeId 42
匹配失败：分配新NodeId 57
```

跨 Surface 的完整身份为：

```cpp
struct NodeKey {
  SurfaceId surface_id;
  NodeId node_id;
};
```

V1 中 NodeId 删除后不复用，避免延迟事件命中新节点。后续若需要复用，必须增加 generation。

### 7.3 NativeHandle

NativeHandle 只在 Backend 内有效：

```text
HostRegistry[SurfaceId, NodeId] -> NativeHandle
```

它不能作为跨层协议，也不能成为 Runtime 节点身份。

## 8. 三类树的映射关系

三类树不是严格一一对应。

### 8.1 无独立 Host Node

以下节点可能存在于 Render Intent/Shadow 层，但不创建独立平台控件：

- Fragment；
- Template；
- 条件和循环控制节点；
- 纯布局节点；
- 被 View Flattening 消除的节点。

```text
Render Intent Fragment
→ Virtual ShadowNode
→ 无Host Node
```

### 8.2 多个 ShadowNode 合并为一个 Host Node

嵌套文本可能合并为一个平台文本控件：

```text
多个Text ShadowNode
→ 一个TextView/UILabel/lv_label
```

### 8.3 一个 ShadowNode 的平台内部展开

复杂平台组件可能在 Backend 内部创建多个辅助对象：

```text
一个ShadowNode
→ NodeId对应主NativeHandle
→ Backend内部拥有多个辅助Handle
```

辅助对象不向 JS 和 Core 暴露。

## 9. 首次渲染与更新

### 9.1 首次渲染

```text
JS层.Runtime Thread
State + Template
→ Full Render Intent Tree
        ↓
C++层.Runtime Thread
空Current Shadow + Render Intent
→ Reconcile
→ 分配NodeId
→ Next Shadow Revision 1
→ Style/Layout/Commit
→ MountTransaction 1
        ↓
Platform层.UI Thread
Create/Props/Layout/Insert
→ Host Tree
→ Mounted Revision 1
```

### 9.2 状态更新

```text
JS层.Runtime Thread
State更新
→ Dirty Component
→ 重新生成Render Intent或Dirty Subtree
        ↓
C++层.Runtime Thread
Render Intent vs Current Shadow
→ Reconcile/Diff
→ Next Shadow Revision
→ Layout/Commit
→ MountTransaction
        ↓
Platform层.UI Thread
只执行确定的Host变化
```

示例：

```text
count: 0 -> 1

JS输出：Text RenderElement(value="1", key="counter")
C++匹配：复用NodeId 42，确认text属性变化
C++输出：UpdateProps(NodeId=42, text="1")
Platform：TextView/UILabel/lv_label更新文本
```

## 10. 线程与所有权约束

| 执行序列 | 允许操作 | 禁止操作 |
|---|---|---|
| JS Runtime Thread | State、Component、Render Intent、Handler Registry | 直接修改Host对象 |
| C++ Runtime/Render Thread | Shadow、Layout、Revision、MountTransaction | 直接修改Android/iOS/LVGL UI对象 |
| Platform UI Thread | NativeHandle、Host Tree、输入命中 | 执行业务JS和组件Reconcile |

线程之间传递的是有所有权和版本边界的数据：

```text
JS -> C++：Render Input
C++ -> Platform：MountTransaction
Platform -> C++/JS：PlatformEvent
```

禁止跨线程传递生命周期不明确的裸 JS 对象或平台指针。

## 11. 与 Template IR 的关系

Template IR 是 Toolkit 生成的静态程序描述：

```text
Template IR
= 静态节点结构
+ Binding描述
+ Dynamic Block描述
+ Event元数据
```

它和 Render Intent Tree 不是同一个概念：

| 结构 | 阶段 | 是否包含当前状态求值结果 |
|---|---|---|
| Template IR | 编译期/加载期 | 否 |
| Render Intent Tree | 运行时Render阶段 | 是 |
| Shadow Tree | C++计算和Commit阶段 | 是，并包含规范化Style/Layout/Revision |

后续可优化为由 C++ Template Runtime 直接实例化 Shadow/Runtime Tree，并由 JS 提交 Binding/Structure Patch。该优化可以减少 JS Render Intent 的物化，但必须保持本概念定义中的职责边界：

```text
JS拥有业务状态和应用意图
C++拥有平台无关渲染状态和NodeId
Backend拥有Host对象
```

因此，Render Intent Tree 是稳定的逻辑模型，是否完整物化为 JS 对象树属于独立实现决策。

## 12. 统一术语

| 术语 | 统一含义 |
|---|---|
| Render Intent Tree | JS层产生的声明式期望UI |
| RenderElement | Render Intent Tree中的节点 |
| Logical DOM | 兼容现有快应用实现时使用的JS运行时逻辑节点结构 |
| VNode | 不单独使用；出现时必须说明指RenderElement还是Logical DOM Node |
| Shadow Tree | C++ Core的平台无关、版本化渲染状态 |
| ShadowNode | Shadow Tree节点，拥有NodeId |
| Host Tree | Backend拥有的真实平台对象结构 |
| Host Node | NodeId映射的主要平台对象 |
| NativeHandle | Backend内部平台对象句柄 |
| Reconcile | 判断新意图和旧Shadow节点是否代表同一实例 |
| Diff | 确认对应节点的具体真实变化 |
| Commit | 接受完整Next Shadow Revision |
| Mount | 将MountTransaction应用到Host Tree |

## 13. 重点吸收点

1. 三类树表达三类不同事实，不能只因节点形状相似就混为一棵树。
2. Render Intent 使用语义身份，Shadow/Host 使用 Core 分配的稳定 NodeId。
3. Host Tree 的对象所有权属于 Backend；Core 只拥有平台无关的变化协议。
4. 三类树不保证一一对应，Flatten、虚拟节点和复合平台控件都是正常情况。
5. Render Intent Tree 是逻辑输入模型，不要求 JS 永久保存完整对象树。

最终记忆：

> Render Intent 是意图，Shadow 是已计算状态，Host 是平台事实；JS、Core、Backend 分别拥有唯一权威。
