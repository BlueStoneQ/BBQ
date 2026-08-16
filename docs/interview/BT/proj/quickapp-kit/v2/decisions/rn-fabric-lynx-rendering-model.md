# 渲染模型决策：Fabric 树与事务 + Lynx 非 UI 线程准备

## 目录

- [1. 决策结论](#1-决策结论)
- [2. 第一性目标](#2-第一性目标)
- [3. 两类问题与两类借鉴](#3-两类问题与两类借鉴)
- [4. QuickApp Kit 渲染模型](#4-quickapp-kit-渲染模型)
- [5. 树、版本与事务](#5-树版本与事务)
- [6. Mutation 与 MountTransaction](#6-mutation-与-mounttransaction)
- [7. 非 UI 线程执行模型](#7-非-ui-线程执行模型)
- [8. 跨层通道原则](#8-跨层通道原则)
- [9. 兼容输入与目标架构](#9-兼容输入与目标架构)
- [10. 方案收益](#10-方案收益)
- [11. 代价与风险](#11-代价与风险)
- [12. V1 范围](#12-v1-范围)
- [13. 验证标准](#13-验证标准)
- [14. 重点吸收点](#14-重点吸收点)

## 1. 决策结论

QuickApp Kit v2 采用：

> Fabric 的 Shadow Tree、revision、commit 和 MountTransaction 模型，结合 Lynx 的非 UI 线程渲染准备思想。

这不是复制某个框架的完整实现，而是分别吸收两种本质能力：

```text
Fabric 思想：如何表示、计算并原子提交 UI 状态变化
Lynx 思想：这些计算应该在哪条执行序列完成
```

最终职责：

```text
JS 层决定应用想展示什么
C++ Core 决定新旧渲染状态如何变化
Platform Backend 决定如何更新真实控件
```

热路径跨层遵循：

> 非必要不序列化；优先使用类型化结构和直接值访问。JSON 只用于兼容入口、调试、日志、持久化或进程边界，不作为 Core 内部与 Render Backend 的正式协议。

## 2. 第一性目标

跨平台声明式渲染需要同时满足五个基本目标：

1. 平台无关的渲染决策只计算一次。
2. Android、iOS、LVGL 消费相同语义的提交结果。
3. UI 线程只执行必须操作真实控件的工作。
4. 一次渲染必须具有完整版本和事务边界。
5. 中间计算状态不能作为已提交 UI 暴露给用户和事件系统。

由此推导：Runtime 必须拥有平台无关的 Shadow 状态、版本提交和有序 Mount 协议；计算应尽量在非 UI 执行序列完成。

## 3. 两类问题与两类借鉴

| 借鉴方向 | 解决的本质问题 | QuickApp Kit 吸收内容 | 不照搬内容 |
|---|---|---|---|
| RN Fabric | 渲染状态如何建模、比较和提交 | C++ Shadow Tree、revision、commit、mount mutations | React 组件模型和完整 RN 工程形态 |
| Lynx | 如何减少 UI 线程上的渲染准备工作 | 非 UI 线程构树、差异计算、布局和 UI ops 打包 | 首期即引入完整多线程调度复杂度 |

两者不是竞争方案：Fabric 主要提供状态和事务模型，Lynx 主要提供执行位置和主线程预算思想。

## 4. QuickApp Kit 渲染模型

```text
JS层.Framework / Runtime Thread
State -> Dirty -> RenderElement Tree
                    |
                    v
C++层.Runtime Core / Runtime Thread，后续可迁移 Render Worker
Reconcile -> Next Shadow Tree -> Style/Layout -> Commit
                    |
                    v
MountTransaction(surface, baseRevision, targetRevision, mutations[])
                    |
                    v
Platform层.Render Backend / UI Thread
Host Tree: Android View / UIView / LVGL Object
```

三类树的权威所有者：

| 树 | 所属层 | 表达的事实 |
|---|---|---|
| Logical DOM / RenderElement | JS Framework | 应用期望展示什么 |
| Shadow Tree | C++ Runtime Core | Runtime 已计算并提交什么 |
| Host Tree | Platform Render Backend | 平台当前实际展示什么 |

每类状态只有一个权威所有者，避免 JS、Core 和各平台重复实现节点复用、布局或提交规则。

## 5. 树、版本与事务

### 5.1 Current 与 Next

一次更新期间，Core 至少要区分：

```text
Current Shadow Tree：上一次成功提交的 revision
Next Shadow Tree：根据本次渲染输入计算出的候选 revision
```

Next 在 Commit 前不是平台事实，可以被取消或因校验失败而丢弃。Commit 成功后，Next 才成为新的 Current。

### 5.2 Revision

每次提交必须携带：

```text
SurfaceId
BaseRevision
TargetRevision
```

Revision 用于：

- 拒绝过期提交；
- 识别页面销毁后的延迟事务；
- 关联事件与对应的渲染状态；
- 记录每次 Render、Commit、Mount 的性能指标；
- 支持后续 Render Worker 的取消和抢占策略。

### 5.3 Commit

Commit 的本质是：

> Core 完成全部校验、Reconcile、样式和布局计算后，接受一个完整 Shadow revision，并生成从旧 Host 状态推进到新状态所需的事务。

平台 UI 不支持数据库式任意回滚，因此这里的原子性是逻辑原子性：完整校验后按一次 UI task/frame 中的确定顺序应用，不向 Runtime 事件系统暴露半完成逻辑状态。

## 6. Mutation 与 MountTransaction

Mutation 是一次最小、确定的平台无关变化：

```text
CreateNode
DeleteNode
InsertChild
RemoveChild
MoveChild
UpdateProps
UpdateLayout
UpdateEventMask
InvokeCommand
```

有序 Mutation 集合组成 MountTransaction：

```cpp
struct MountTransaction {
  SurfaceId surface_id;
  Revision base_revision;
  Revision target_revision;
  std::vector<MountMutation> mutations;
};
```

顺序必须由 Core 保证：

```text
创建：Create -> Props/Layout/Event -> Insert
更新：Props/Layout/Event/Move
删除：Remove -> Delete
```

Backend 不负责重新 Diff。否则每个平台都会产生一套不同的节点匹配和更新语义。

## 7. 非 UI 线程执行模型

“后台”不是架构层，而是相对于 Platform UI Thread 的非 UI 执行序列。

V1：

| 执行序列 | 层.部件 | 职责 |
|---|---|---|
| Runtime Thread | `JS层.QuickJS/Framework` | JS、状态、Dirty、RenderElement |
| Runtime Thread | `C++层.Runtime Core` | Reconcile、Shadow、Layout、Commit |
| Platform UI Thread | `Platform层.Render Backend` | MountTransaction、Host Tree |
| Capability Workers | `Platform层.Capability Backend` | 网络、文件、解码等阻塞任务 |

后续只有在 Benchmark 证明 Runtime Thread 上 JS 与渲染计算互相阻塞时，才拆出 C++ Render Worker：

```text
JS Runtime Thread -> Render Worker -> Platform UI Thread
```

Core 定义 `TaskRunner` 和执行序列约束；Android、iOS、LVGL Host 分别提供具体线程或队列实现。

## 8. 跨层通道原则

### 8.1 结论

**关键决策 ADR-RENDER-01：热路径非必要不序列化。**

跨层调用有三种不同边界：

| 边界 | 推荐数据通道 |
|---|---|
| JS -> C++ Core | QuickJS Host Function/C API 直接读取并规范化结构化值；后续可用紧凑 Buffer 或 Host Object |
| C++ Core 内部 | 强类型 C++ value structs、不可变快照或受控所有权对象 |
| C++ Core -> Platform Backend | typed `MountTransaction`，平台 Adapter 映射为本地控件操作 |

禁止 Core 热路径长期依赖：

```text
JSON.stringify -> UTF-8 copy -> JSON parse -> 临时对象树
```

原因不是“JSON 永远不能用”，而是同进程、已知 schema 的高频调用没有必要反复丢失类型再恢复类型。

### 8.2 序列化允许出现的位置

- 兼容旧 RPK/旧 action 输入；
- DevTools 和 tree dump；
- Trace、日志和失败快照；
- RPK 文件与持久化数据；
- 网络或真正的进程边界；
- Benchmark 对照路径。

兼容 JSON 必须在 Adapter 边界终止：

```text
Legacy JSON Action
    -> Compatibility Adapter
    -> Typed RenderInput / DomMutation
    -> C++ Core
```

JSON 不得穿透 Core 并成为 RenderBackend 合同。

### 8.3 代价

直接值访问和 typed structs 会增加：

- JS Engine Adapter 的绑定代码；
- 类型校验与错误模型；
- 字符串、数组和对象的生命周期管理；
- ABI/API 版本演进要求。

因此需要 schema、明确所有权和测试，而不是用裸指针换取表面上的“零拷贝”。非必要不序列化也不等于所有路径都必须零拷贝；安全、稳定的受控复制可以接受。

## 9. 兼容输入与目标架构

现有 QuickApp 产物可能已经在 JS Framework 中生成增量 DOM action。目标架构与兼容路径需要分开：

```text
目标路径：RenderElement/Tree Snapshot -> C++ Reconciler
兼容路径：Legacy Incremental Actions -> Compatibility Adapter
```

两者进入 Core 后必须归一到同一种 Shadow revision、Layout、Commit 和 MountTransaction。

**关键决策 ADR-RENDER-02：兼容输入不能决定 Core 与 Backend 的长期合同。**

V1 可以先实现受控范围内的增量 Adapter 以跑通指定 RPK，但 Core 的 NodeId、revision、Shadow Tree 和 MountTransaction 必须从第一版保持统一；完整 Tree Snapshot Reconciler 按独立 Spec 实施。

## 10. 方案收益

| 收益 | 架构价值 |
|---|---|
| 单一渲染权威 | NodeId、Shadow、Layout、revision 由 Core 统一管理 |
| 多平台一致 | Android、iOS、LVGL 消费同一种事务语义 |
| UI 线程负担小 | 构树、比较、布局和事务生成不占用 UI 主线程 |
| JS 引擎可替换 | QuickJS 通过 Adapter 接入，不拥有 Core 渲染语义 |
| DSL 可演进 | 不同前端输入可归一到相同 Core 模型 |
| 可观测 | Render、Reconcile、Layout、Commit、Mount 可分别计时 |
| 可测试 | C++ Core 可脱离真实平台验证树和事务 |

## 11. 代价与风险

1. C++ Reconciler 必须定义 `type + key + position` 的节点匹配规则。
2. JS 到 C++ 的 typed value 通道需要清晰的类型、所有权和异常协议。
3. Current/Next Shadow revision 会增加内存和生命周期管理成本。
4. 后续 Render Worker 会引入过期 revision、页面销毁和任务取消问题。
5. Platform Backend 不能静默部分成功，失败必须使 Surface 进入明确错误状态。
6. 目标 Tree 输入与旧增量 action 并存期间，必须有一致性测试证明结果等价。

AI Coding 可以降低代码实现和测试生成成本，但不能替代节点身份、事务语义、所有权和并发规则这些架构决策。

## 12. V1 范围

V1 采用长期正确的模块边界，同时控制并发和兼容范围：

- 一条 Runtime Thread 顺序执行 JS Framework 与 C++ Core 渲染准备；
- Platform UI Thread 只执行 MountTransaction；
- Core 定义 Shadow Tree、NodeId、revision、typed Mutation 和 MountTransaction；
- JS -> C++ 优先直接读取结构化值，不以 JSON 作为新协议；
- 旧 action 仅通过 Compatibility Adapter 接入；
- 首期不增加独立 Render Worker；
- 首期不承诺完整 keyed snapshot diff，另行通过 Core Reconciler Spec 定义。

## 13. 验证标准

1. 同一 Core 测试输入在 Android 和 LVGL 生成一致的 Mutation 序列。
2. Core 与 Backend 合同中不存在 JSON 字符串字段或平台对象类型。
3. UI 线程 Trace 中不出现 JS 执行、树比较和跨平台布局。
4. 每个事务包含 Surface、base revision、target revision 和有序 mutations。
5. 过期事务、缺失 NodeId 和非法操作顺序在 Mount 前被拒绝。
6. Tree dump、transaction trace 和阶段耗时可以通过调试通道输出。
7. Benchmark 分别记录 Render、Reconcile、Layout、Commit、Queue Wait 和 Mount。

## 14. 重点吸收点

> Fabric 解决“渲染变化如何被建模和提交”，Lynx 解决“渲染准备在哪里执行”。二者组合后，Core 在非 UI 执行序列完成树、差异、布局和事务，Platform UI Thread 只更新真实控件。

> 非必要不序列化的本质不是追求口号式零拷贝，而是在同进程、已知 schema、高频路径中保留类型，减少重复编码、解析、复制和临时对象。

> 合同先稳定，算法可分期：Shadow、revision、typed transaction 和 Backend 边界从 V1 固定；完整 snapshot reconciler 和独立 Render Worker 依据 Spec 与 Benchmark 渐进实现。
