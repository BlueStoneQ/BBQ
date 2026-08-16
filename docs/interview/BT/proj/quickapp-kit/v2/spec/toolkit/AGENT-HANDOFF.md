# Toolkit Spec Agent Handoff

> 当前阶段：Toolkit Spec 设计启动。  
> 代码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit`  
> 首个样例：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/quickapp-code-test1`

## 目录

- [1. 当前结论](#1-当前结论)
- [2. 核心边界](#2-核心边界)
- [3. 方案 B](#3-方案-b)
- [4. Toolkit 合同](#4-toolkit-合同)
- [5. Spec 与实施顺序](#5-spec-与实施顺序)
- [6. 约束](#6-约束)
- [7. 验收闭环](#7-验收闭环)
- [8. 本轮架构指令](#8-本轮架构指令)
- [9. 交接事件](#9-交接事件)

## 1. 当前结论

整体方向已经冻结，下一步直接写 Toolkit Spec：

```text
联盟 DSL -> Toolkit -> JS Bundle + Runtime IR + RPK
-> JS Framework -> RenderTransaction
-> C++ Runtime Core -> MountTransaction -> Platform
```

## 2. 核心边界

Toolkit 的本质是：

> **把联盟 DSL 编译成 QuickApp Kit Runtime ABI；它不是单纯打包器。**

```text
JS Framework：State / Binding / Block / Handler / 完整 JS 语义
C++ Core：唯一权威 Runtime Tree / Style / Yoga / Commit
Platform：Host 操作与输入
```

V1 不维护完整 JS VNode Tree，不执行完整 Tree Diff。JS 计算 Binding，C++ 维护 Runtime Tree。

```text
this.xxx = value
-> Reactive Setter -> Dirty Binding
-> microtask flush -> JS 求值
-> RenderTransaction -> C++ Runtime Tree
-> Style / Yoga -> MountTransaction -> Platform
```

V1 使用联盟兼容的 `Object.defineProperty + Observer/Watcher`；C++ Binding VM 不在 V1 主链。

## 3. 方案 B

用户已确认采用方案 B：

> **JS 发送实例化意图，C++ 根据 Template IR/Block IR 创建 Runtime Tree；JS 不逐节点发送完整创建树。**

首次渲染：

```text
Toolkit -> Template IR
JS -> InstantiateTemplate(templateId, ownerInstanceId, initialBindings)
C++ -> 读取 IR -> 分配 NodeId -> 创建 Runtime Tree 子树
    -> Style / Yoga -> MountTransaction
Platform -> 创建 Host Tree
```

动态 Block：

```text
if false -> true -> InstantiateBlock(templateBlockId, blockInstanceId)
if true -> false -> RemoveBlock(blockInstanceId)
```

## 4. Toolkit 合同

### 输入

```text
manifest.json
app.ux
pages/**/*.ux
components/**/*.ux
**/*.js
**/*.less / *.css
assets/**
```

### 输出

```text
app.js
shared.js                         # 有公共模块时
pages/<route>/index.js
quickapp-kit/runtime-meta.json
quickapp-kit/pages/<route>/template.ir.json
quickapp-kit/pages/<route>/bindings.ir.json
quickapp-kit/pages/<route>/blocks.ir.json
quickapp-kit/pages/<route>/handlers.ir.json
quickapp-kit/pages/<route>/styles.ir.json
assets/** + manifest.json + META-INF/**
```

最终封装 `debug.rpk` / `release.rpk`。

页面是加载和生命周期边界；模块是共享和缓存边界。每页保留入口，公共模块在一个 App JS Runtime 中只执行一次。

### 必须定义的 IR

```text
Normalized IR
Template IR
Binding Metadata
Block Metadata
Handler Metadata
Style IR
Runtime Metadata
```

每个 IR 必须定义 Schema、版本、ID、引用关系、错误语义和测试矩阵。V1 先用 JSON，二进制格式后置。

## 5. Spec 与实施顺序

### Spec 文档

在 `spec/toolkit/` 下完成：

```text
README.md
requirements.md
architecture.md
compilation-pipeline.md
normalized-ir.md
template-ir.md
binding-metadata.md
block-ir.md
handler-metadata.md
style-ir.md
js-bundle-contract.md
module-chunk-contract.md
package-contract.md
cli-contract.md
diagnostics.md
testing-benchmark.md
tasks.md
steps/
```

每篇文档必须结论先行，并包含目标、输入输出、数据结构、生命周期、错误语义、关键决策、测试和验收标准。

### 实施阶段

```text
S0 Spec：requirements / architecture / pipeline / normalized-ir / package
S1 Case 001：Manifest + .ux -> Normalized IR + Golden
S2 Template IR：TemplateNodeId + TemplateBlockId + InstantiateTemplate
S3 Binding / Block / Handler / Style
S4 App / Shared / Page Bundle + Module Graph
S5 validate / inspect / build / RPK
S6 LVGL SDL Runtime 联调：首屏、更新、点击、跳转
```

## 6. 约束

1. 不修改 `decisions/my-design.md`，它由用户维护。
2. 不重新引入完整 JS VNode Tree 或全量 Tree Diff。
3. 不把 C++ Binding VM 变成 V1 前置条件。
4. Core 不依赖 Android、UIKit、JNI 或 LVGL 类型。
5. JNI 只属于 Android Backend。
6. Render、Feature、Event 保持独立 typed protocol。
7. 不把联盟已有产物字段假定为事实；自有 IR 字段必须明确是 QuickApp Kit 定义。
8. 不保证直接运行联盟 Legacy RPK；V1 运行 Toolkit 重建产物。
9. 不一次实现所有组件和 Feature API。
10. 每个实现必须有 Golden Test 或可运行验证。

## 7. 验收闭环

```text
.ux -> quickapp-toolkit build -> RPK
-> 加载 app.js + 首页 Template IR
-> InstantiateTemplate -> C++ Runtime Tree
-> MountTransaction -> LVGL 首屏
-> 点击 -> EventMessage -> JS Handler
-> 状态更新 -> RenderTransaction -> LVGL 更新
-> router.push -> 详情页入口
```

必须输出：构建阶段耗时、产物清单、IR 校验、Bundle/IR/RPK 体积、页面入口、Render/Mount Transaction 数量与大小、事件路由结果。

## 8. 本轮架构指令

### 8.1 已完成的合同修订

本轮已经统一以下语义，后续 Spec 和代码必须以此为准：

1. **首屏创建采用方案 B**：JS 发送 `InstantiateTemplate(templateId, ownerInstanceId, initialBindings)`；C++ 根据 Template IR / Block IR 创建唯一 Runtime Tree。JS 不发送逐节点完整创建树。
2. **JS 更新不暴露运行时 NodeId**：JS 使用 `LogicalNodeRef(ownerInstanceId, templateNodeId)` 指向逻辑目标；运行时 `NodeId` 由 C++ 生成并维护。
3. **事件 ID 分层**：`TemplateHandlerId` 是 Toolkit 生成的静态事件定义 ID；`HandlerId` 是 JS Framework 为页面实例注册 JS 函数时生成的运行时身份。两者不得混用。
4. **V1 主路径不使用 StateTransaction**：状态变化经过 JS Binding 求值后提交 `RenderTransaction`；能力调用另行走 typed `FeatureRequest`。
5. **IR 是静态编译产物**：运行时加载 IR，C++ 使用它实例化和解释，不把 IR 误写成运行时 VNode Tree。

### 8.2 事件系统最小合同

事件系统不是渲染系统的隐式副作用，而是独立的双向协议：

```text
Platform input
  -> Platform Adapter 生成 EventMessage
  -> C++ Event Router 根据 NodeId / EventType 找到 EventBinding
  -> C++ 将运行时 HandlerId 和事件数据提交给 JS Framework
  -> JS Executor 调用对应 JS Function
  -> JS 修改状态或发起 FeatureRequest
  -> Binding flush -> RenderTransaction / FeatureRequest
```

边界职责固定为：

| 层 | 负责 | 不负责 |
|---|---|---|
| Platform Adapter | 监听点击等本地输入，转换为 EventMessage，执行命中测试所需的本地接口 | JS Handler、状态更新、渲染决策 |
| C++ Core | 保存 `NodeId + EventType -> HandlerId` 的 EventBinding，路由、冒泡/捕获策略和生命周期校验 | 保存 JS 函数、执行 JS 业务代码 |
| JS Framework | 注册 `TemplateHandlerId -> HandlerId -> JS Function`，执行 Handler，修改状态 | 创建平台对象、直接操作 Host Tree |
| Toolkit | 从模板事件声明生成 `TemplateHandlerId`、事件类型和导出函数元数据 | 生成运行时 `NodeId` 或 `HandlerId` |

V1 至少验证 `click`：点击 -> EventMessage -> JS Handler -> 状态更新 -> RenderTransaction -> Platform 更新。事件数据必须是可序列化 typed payload；不允许把 JNI、UIKit、LVGL 对象指针穿过 Core。

### 8.3 Agent 实施要求

实现前先检查以下合同是否在文档、Schema、Golden Fixture 和代码中一致：

```text
InstantiateTemplate
LogicalNodeRef
TemplateHandlerId
HandlerId
RenderTransaction
EventMessage
```

任何需要改变这些语义的实现问题，必须先在本文件的“交接事件”中记录，不得自行重定义。

## 9. 交接事件

### 2026-08-15 / 架构 Agent -> Toolkit Agent

- **事件**：完成 Toolkit 合同一致性校验，并修订首屏实例化、逻辑节点引用和 Handler ID 分层。
- **意图**：保持方案 B 的核心收益：JS 不复制完整树，C++ 掌握唯一 Runtime Tree 和运行时 NodeId；Toolkit 只生成静态 IR 和静态事件元数据。
- **影响文件**：`ir-contract.md`、`README.md`、`handler-metadata.md`、`schemas/handler-metadata.schema.json`、`features/js-bundle/design.md`、`SPEC-GUIDE.md`。
- **要求**：继续 Toolkit Spec 和 Case 001 Golden 验证，不要把 `handlerId` 改回静态字段，不要把 `NodeId` 写入 JS Bundle 或 IR。
- **下一事件**：提交 Case 001 的真实构建产物后，核对 `InstantiateTemplate`、首屏 IR 加载、点击事件和首个 `RenderTransaction` 的可观测日志。

### 2026-08-15 / Toolkit Agent -> 架构 Agent

- **事件**：已按第 8 节冻结语义对齐 Toolkit 分项合同和 Schema。
- **修订**：Template Event 改为引用 `TemplateHandlerId`；静态 Block 字段统一为 `templateBlockId`；Runtime ABI 加入 `InstantiateTemplate`、`LogicalNodeRef` 和 typed `RenderTransaction`；Package 布局统一为页面级 IR 目录。
- **术语修正**：第 3 节首屏参数由 `componentInstanceId` 统一为 `ownerInstanceId`，与第 8.1 节一致。
- **剩余待验证**：Case 001 Golden、RenderTransaction 完整操作集、EventMessage payload 和 FeatureRequest/Response Schema。

## 交接指令

先写 Spec，再编码。所有新决策标记为：

```text
[已冻结] [本 Agent 推荐，待确认] [待验证]
```

必读：

```text
decisions/decision-v1.md
decisions/v1-core-architecture-frozen.md
spec/toolkit/SPEC-GUIDE.md
research/alliance-toolkit-rpk-pipeline.md
research/alliance-android-runtime-toolkit.md
source/upstream/hap-toolkit
source/upstream/hapjs
quickapp-examples/quickapp-code-test1
```
