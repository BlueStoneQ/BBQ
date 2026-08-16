# QuickApp Kit v3 需求对齐检查

日期：2026-08-15  
角色：总架构与产品负责人

## 目录

- [1. 结论](#1-结论)
- [2. 七审有效范围](#2-七审有效范围)
- [3. 需求级阻塞](#3-需求级阻塞)
- [4. 非阻塞但需要校正](#4-非阻塞但需要校正)
- [5. 保留成果](#5-保留成果)
- [6. 收口动作](#6-收口动作)
- [7. 当前门禁](#7-当前门禁)
- [8. 收口结果](#8-收口结果)

## 1. 结论

七审只证明了当时公共合同内部自洽，没有完成“需求 -> 架构 -> V1 验收”的追踪检查。本轮所有者检查已经补齐 Capability 插件机制、应用生命周期、Layout Measure 边界和 V1 纵向验收基线；当前总架构已放行项目 Spec，但七审本身仍不能被解释为需求验收。

本质偏差：检查过程从“以最小纵向闭环证明下一代嵌入式 Runtime”偏向了“在编码前穷尽协议细节”。

## 2. 七审有效范围

七审以下结论有效并保留：

1. JS Framework、C++ Core、Platform Adapter 的 Runtime Tree 所有权清楚。
2. JS 增量意图、C++ 单一 Runtime Tree、Platform Mount 模型成立。
3. Render、Mount、Event、Surface、Navigation 和 Artifact 合同内部一致。
4. 公共 Schema 可以机器校验，各项目不会自行发明同名消息。

七审没有覆盖：大纲能力追踪、V1 主次排序、插件体系完整性、联盟应用生命周期、嵌入式 Layout 测量和最小可运行闭环。

## 3. 需求级阻塞

### 3.1 Capability Module 架构缺失

大纲要求 V1 具备 `Capability Module + ModuleRegistry + Provider + Invoker`，支持手动注册、懒加载和 unsupported fallback。当前只有 `ShowToast/SetTitleBar/SetMeta` 三组硬编码 Host Feature 消息，没有 ModuleRegistry、Provider 生命周期和能力发现，不能证明 TurboModule-like 插件机制。

必须补齐最小结构：

```text
$app_require$(moduleName)
  -> JS Module Facade
  -> C++ ModuleRegistry
  -> typed Module Method
  -> CoreProvider | PlatformProvider
  -> typed Result
```

V1 模块为 `system.router`、`system.prompt`、`system.device`。Router 的状态仍由 Core 管理；模块注册机制不得退化为无类型 `feature + method + args` JSON Bridge。

### 3.2 App/Page 生命周期缺失

当前合同定义的是 Surface/Host 容器生命周期，不是联盟应用生命周期。Case 001 已包含 `app.onCreate` 和页面 `onInit`，但 v3 没有冻结 AppRuntime、PageContext 和最小生命周期顺序。

必须基于联盟事实冻结最小顺序，至少覆盖：App 创建、Page VM 创建、`onInit`、首屏 Binding 求值、Mount/Present、页面显示/隐藏和销毁。未验证的生命周期名称与时机不得凭经验补写。

### 3.3 Core 与 Platform 的 Measure 边界缺失

Core 负责 Style/Yoga，Platform 只接收最终 Layout；但 Text/Button 的固有尺寸依赖平台字体和控件度量。没有 Measure Adapter，Android、LVGL、iOS 会各自改变 Layout 所有权，统一 Core 无法成立。

必须冻结：哪些 Host 节点需要测量、Core 传入的约束、Platform 返回的尺寸、缓存键、线程归属和失败降级。V1 不需要完整字体系统，但必须有唯一跨平台边界。

### 3.4 V1 纵向验收没有成为最高门禁

V1 的核心证明应是：

```text
联盟 DSL
  -> Toolkit
  -> JS Bundle + Page IR + Runtime RPK
  -> QuickJS
  -> App/Page 生命周期
  -> RenderTransaction
  -> C++ Runtime Tree + Layout
  -> MountTransaction
  -> Android 首条主链路
  -> 同一 Core/Artifact 在 LVGL + SDL 运行
  -> click 返回 JS Handler
  -> Trace / Benchmark
```

Case 001 验证真实联盟源码、首屏、生命周期、click、router、prompt 和页面切换；Case 002 验证状态更新、if、keyed for 和事务/内存指标。Schema 通过只能辅助该验收，不能替代运行结果。

## 4. 非阻塞但需要校正

### 4.1 Release 签名优先级过高

自定义 Ed25519 签名合同可以保留为后续安全草案，但不应阻塞 V1 development Runtime。V1 主线只要求结构、版本、路径和 Artifact 完整性校验；正式发行签名应在确认联盟容器/签名兼容边界后再启用。

### 4.2 平台顺序需要统一表述

以当前大纲为准：Android 是首个语义和集成宿主，LVGL + SDL 在同一 V1 验证嵌入式可移植性，iOS 后续完成。Core 从第一天属于独立共享工程；“Android 孵化”表示 Android 首先校准 Core 合同，不表示把 Core 代码写入 Android 后再物理搬迁。

### 4.3 合同测试不等于产品代码

现有 Schema 与合同测试可以保留，但停止继续扩大其 V1 门禁范围。合同验证只证明消息与 Artifact 的静态一致性，不能证明联盟语义、Layout、线程、性能和真实平台行为。

## 5. 保留成果

以下设计不推翻：

- 联盟 DSL 源码兼容、自有 Runtime ABI 与 Page IR。
- JS 不维护完整 VNode Tree，不执行全量 Tree Diff。
- C++ Core 维护唯一 Runtime Tree。
- typed RenderTransaction / MountTransaction / Event message。
- LogicalNodeRef、NodeId、BlockInstanceId、HandlerId 的分层身份。
- Platform Surface、Root/Push Present 和失败状态机。
- Case 001/002、三平台项目边界和公共 Schema 事实源。

## 6. 收口动作

只进行一次需求回归校准，不再开启连续总架构轮审：

1. 新增 V1 Scope 与端到端验收合同。
2. 新增 Capability Module 最小架构合同。
3. 新增 App/Page 最小生命周期合同。
4. 新增 Layout Measure Adapter 合同。
5. 将 Release 签名标记为非阻塞后续能力。
6. 同步 Work Board 和各项目 Handoff 后启动项目 Spec。

## 7. 当前门禁

| 工作 | 状态 |
|---|---|
| 七审合同一致性结论 | 接受 |
| 需求回归校准 | 通过 |
| 各项目总 Spec | 放行，可并行设计 |
| 各项目分 Spec | 暂缓，等待对应总 Spec 校审通过 |
| 产品编码 | 暂缓，等待对应分 Spec 校审通过 |

## 8. 收口结果

四个需求级阻塞已经关闭：

| 阻塞 | 冻结合同 | 结论 |
|---|---|---|
| V1 纵向验收 | [V1 Scope And Acceptance](../../spec/v1-scope-and-acceptance.md) | Case 001/002 真实运行证据成为最高门禁 |
| Capability 插件机制 | [Capability Module Contract](../../spec/contracts/capability-module-contract.md) | ModuleRegistry + Guard + Invoker + typed Provider；手动注册、懒加载、fallback |
| App/Page 生命周期 | [App And Page Lifecycle](../../spec/contracts/application-lifecycle-contract.md) | JS VM、Core PageContext、Platform Host 分层状态与同步点已冻结 |
| Layout Measure 边界 | [Measure Adapter Contract](../../spec/contracts/measure-adapter-contract.md) | Platform 只提供字体 metrics；Core 保持 Yoga 与最终 Rect 所有权 |

需求回归矩阵：

| V1 要求 | 架构落点 | 验收落点 |
|---|---|---|
| 应用运行机制/应用模型 | Artifact、App/Page Lifecycle、Surface、Navigation | Case 001 Load/Hook/页面切换/销毁 |
| 跨端 Runtime/多端后端 | 单一 Runtime Tree、Platform Surface、Measure | Android 首链路 + 同 Artifact 的 LVGL/SDL |
| 能力接入/插件/系统能力 | Capability Module、CapabilityGuard、typed Provider | router/prompt 主链路 + device/deny focused test |
| Context/服务演进位置 | immutable AppContext/PageContext；保留 service/agent namespace | Context 生命周期断言；V1 不实现 ServiceContext |
| 工具链/接入标准 | Toolkit、Runtime Artifact、Manifest/Page IR validation | build/inspect/run、确定性 Artifact、Loader 失败前不执行 JS |
| 兼容与治理入口 | Feature discovery、unsupported fallback、完整性校验 | unsupported/deny/非法 Artifact 负例 |
| 可观测与嵌入式证明 | lifecycle/event/render/mount/measure/capability Trace | Case 001/002 启动、首屏、更新、事件、事务、内存实测 |

Release 签名已降为后续 profile 草案；AI Feature 与 Chat 组件只保留在总 TODO。至此总架构工作达到“足以指挥项目 Spec”的粒度，不继续增加横向协议。

最终校验：`17` 份 Schema、`58` 个联合消息分支、Page IR/Artifact 负例和保留的签名试验全部通过；v3 自有 Markdown 均有目录，全部本地链接可解析。
