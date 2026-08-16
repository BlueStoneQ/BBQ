# QuickApp Kit V3 架构收敛建议

## 目录

1. 建议结论
2. 产品与平台定位
3. 核心渲染模型
4. Page IR 定位
5. ID 与所有权
6. 首次渲染
7. 扩展性与屏蔽原则
8. V1 复杂度控制
9. 建议架构 Agent 处理事项

## 1. 建议结论

建议保留并强化当前架构内核：

> Toolkit 定义，JS 求值，Core 决策，Platform 执行。

QuickApp Kit 应定位为多平台统一 Runtime 架构，而不是 LVGL 专用架构。LVGL/嵌入式是当前权重最高、最先完成真实闭环的平台；Android 和 iOS 仍是正式目标平台，并复用相同的 JS Runtime、C++ Core 和公共合同。

当前核心方向正确：编译期 Page IR、JS 细粒度动态求值、Core 唯一权威 Runtime Tree、NodeId 增量 Mount 协议和薄 Platform Adapter。需要控制的是 V1 外围能力和交付面的复杂度，而不是削弱平台无关 Core。

本文是独立 Reviewer 提供给架构 Agent 的建议输入，不自动修改或覆盖当前冻结架构与公共合同。涉及基线变化的内容，应由架构 Agent 完成正式决策和文档对齐。

## 2. 产品与平台定位

建议采用以下定位：

```text
                         Android Adapter -> Android Host
                        /
Toolkit -> JS -> C++ Core -> LVGL Adapter -> LVGL/SDL Host
                        \
                         iOS Adapter -> iOS Host
```

需要同时成立：

- C++ Core 从第一天就是平台无关共享工程。
- LVGL 是首个完整实现、性能验证和真实设备验收平台。
- SDL 只替换 LVGL Backend，不形成第二套 Runtime 或 Platform Adapter。
- Android 是随后进行的跨平台复用证明，不是 Core 的架构来源。
- iOS 复用相同 Core、JS Runtime 和 Mount/Event 合同。
- Core 不得包含 LVGL、JNI、Android View、UIKit 等平台类型或平台分支。

“LVGL-first”只改变实现和验收顺序，不改变多平台总体架构。

## 3. 核心渲染模型

建议将当前模型准确命名为：

> 基于编译期模板定义和运行期 NodeId 映射的、Core 权威、无完整树 Diff 的增量原生渲染架构。

“无 Diff”不应被解释为系统完全不存在任何差异计算。准确语义是：

- 不维护 JS VNode Tree。
- 不为更新创建一棵完整新 Runtime Tree。
- 不比较完整新旧 Runtime Tree。
- JS 根据 Binding 依赖只计算 Dirty Binding。
- JS 根据 Block 状态执行局部 `if` 和 keyed `for` reconciliation。
- Core 将增量意图应用到唯一权威 Runtime Tree。
- Core 向 Platform 发送以 NodeId 寻址的 Mount Operations，而不是发送树。

推荐对外使用“无完整树 Diff”或“编译器驱动的细粒度增量更新”，避免使用容易被误解的绝对“无 Diff”。

## 4. Page IR 定位

Page IR 应坚持：

> 以有根、有序静态模板树为语义本体，以 Template ID 索引为访问方式。

树和 ID 不冲突：

- 树表达模板父子关系、顺序、Block slot 和静态结构。
- ID 用于定义寻址、Binding/Handler target 解析和高效索引。
- Artifact 可以使用 `nodes[]/blocks[]` 等规范化平铺表编码，不要求使用递归嵌套 JSON。
- Core Loader 加载后建立只读 `TemplateNodeId/TemplateBlockId/TemplateBindingId/TemplateHandlerId` 索引。

建议使用以下准确表述：

```text
语义模型：有根、有序静态模板树
Artifact 编码：ID-addressed normalized tables
运行时访问：immutable ID index
```

Page IR 不得包含 Runtime NodeId、HandlerId、NativeHandle、JS 函数或平台类型。

对于动态 Block，同一 Page IR 定义的是确定的模板结构和实例化规则，不应表述为“无论动态输入如何都只能产生同一棵 Runtime Tree”。更准确的语义是：相同 Page IR 与相同 Block 实例计划必须确定性地产生相同 Runtime Tree 结构。

## 5. ID 与所有权

每层只创建并拥有本层身份：

| 身份 | 产生者 | 用途 |
|---|---|---|
| TemplateNodeId | Toolkit | 静态模板节点 |
| TemplateBindingId | Toolkit | 静态 Binding 定义 |
| TemplateBlockId | Toolkit | 静态 Block 定义 |
| TemplateHandlerId | Toolkit | 静态 Handler 定义 |
| ComponentInstanceId | JS Framework | Page/Component 运行实例 |
| BlockInstanceId | JS Framework | 动态 Block 实例 |
| HandlerId | JS Framework | 运行时 Handler 注册 |
| NodeId | C++ Core | Runtime 节点实例 |
| NativeHandle | Platform Adapter | 平台实体对象 |

节点寻址链路为：

```text
Template definition
  -> LogicalNodeRef(OwnerInstanceId, TemplateNodeId)
  -> NodeId
  -> NativeHandle
```

必须守住三条隔离线：

```text
JS 不持有 NodeId
Core 不持有 NativeHandle
Platform 不解释 TemplateBindingId/TemplateHandlerId
```

NodeId 解决跨 Core/Platform 的运行实例寻址；Runtime Tree 解决父子关系、布局、事件冒泡、Block 子树和递归销毁。不得为了强调 NodeId 驱动而删除 Page IR 或 Runtime Tree 的结构关系。

## 6. 首次渲染

首次渲染时 JS 不需要创建节点树。建议保持以下流程：

```text
Toolkit:
  DSL -> Page IR + JS Bundle

JS:
  创建 ComponentInstanceId
  执行 Page VM/lifecycle
  求值 initial Binding/Block/Handler
  -> InstantiateTemplate

Core:
  加载并遍历 Page IR 静态模板树
  分配 NodeId
  建立 LogicalNodeRef -> NodeId 映射
  创建 Runtime Tree/EventBinding
  计算 Style/Layout
  -> full MountTransaction

Platform:
  NodeId -> NativeHandle
  创建 Host Tree
  -> Present
```

JS 首屏只提交动态输入：Owner、初始 Binding 值、Block 实例计划和 Handler 注册。它不提交模板节点、父子关系、NodeId 或 Binding/Handler target descriptor。

## 7. 扩展性与屏蔽原则

建议把以下规则作为架构门禁：

### 7.1 一个语义只有一个 Owner

```text
业务 state/Binding/Handler function -> JS
Runtime Tree/NodeId/Layout/Event route -> Core
Native object/Host Tree/Input capture -> Platform
```

### 7.2 跨层只传 immutable value 和 ID

禁止跨层共享 JS Object、RuntimeNode 指针、NativeHandle 或平台对象。逻辑分层不必强制对应独立重量级线程；嵌入式部署可以在保持相同合同的前提下合并执行线程或采用低复制调用。

### 7.3 扩展应停留在正确层

- 新平台原则上只新增 Platform Adapter、Host Component、Measure 和 Capability Provider。
- 新 DSL 语法如果可 Lowering 到现有语义，原则上只修改 Toolkit。
- 新组件新增 typed props/events、Core descriptor 和平台 Host 实现，不修改 Transaction 主流程。
- 新 JS Engine 通过 Executor Adapter 接入，不重写 Binding/Block/Handler Runtime。

### 7.4 平台不得反向定义 Core

LVGL 是最先落地的平台，但 Core 的数据结构、状态机和线程合同不得依赖 LVGL 特性。Android/iOS 也不得通过专有行为侵入公共 Core。

## 8. V1 复杂度控制

建议区分“必要的架构复杂度”和“可后置的产品复杂度”。

V1 必须保留：

- Page IR 静态模板树和 ID 索引。
- JS Binding/Block/Handler 细粒度求值。
- Core 唯一权威 Runtime Tree。
- NodeId Mount Operations。
- Transaction 原子校验和单在途约束。
- EventBinding 与 Block/Surface 销毁一致性。
- Style/Layout/Measure 最小闭环。
- LVGL/SDL 同一 Adapter 和真实嵌入式设备验证。
- 平台无关的 Android/iOS Adapter 边界。

应重新评估是否进入 V1 主链：

- 自动 degraded/full rebuild 恢复。
- 完整通用 Capability Provider/Registry。
- 多 Surface 和复杂 Navigation 场景。
- Android/iOS 的实现级完整设计和交付。
- 超出首条纵向链路的大量内部 Schema。
- 与首个平台闭环无关的复杂 Benchmark 发布体系。

高扩展性不等于提前为未知需求建立通用系统。优先保证核心合同稳定、扩展点窄且所有权唯一。

## 9. 建议架构 Agent 处理事项

建议架构 Agent 对以下事项作出正式决定并对齐事实源：

1. 将总体定位明确为“多平台统一 Runtime，LVGL 为首个完整实现和验收平台”。
2. 检查并修正仍以 Android 为首个集成宿主的冻结描述和项目依赖顺序。
3. 将 Page IR 明确定义为“有根、有序静态模板树的 ID-addressed 编码”。
4. 统一使用“无完整树 Diff”，避免绝对“无 Diff”造成语义误读。
5. 明确首次渲染 NodeId 由 Core 遍历 Page IR 时分配，JS 不建立节点树。
6. 保持 Toolkit/JS/Core/Platform 的 ID 产生权和禁止穿透规则。
7. 确认逻辑边界与物理线程解耦，给嵌入式保留低线程、低复制部署方式。
8. 重新裁剪 V1 外围能力，先闭环标准快应用 DSL -> 自有 RPK -> JS/Core -> LVGL/SDL -> 真实设备。
9. Android 随后验证相同 Core 和公共合同确实可复用，iOS 后续接入，不另建运行语义。

建议在上述定位完成正式对齐后，再据此调整项目总 Spec 和分 Spec 放行门禁。
