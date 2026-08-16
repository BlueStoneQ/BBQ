# v3 总体 Spec

## 目录

- [1. 结论](#1-结论)
- [2. 标准总 Spec](#2-标准总-spec)
- [3. 总体架构](#3-总体架构)
- [4. 公共合同](#4-公共合同)
- [5. 项目 Spec 分层](#5-项目-spec-分层)

## 1. 结论

QuickApp Kit 的本质是：Toolkit 将联盟 DSL 编译为 Runtime 输入；JS Framework 执行动态语义；C++ Core 维护唯一 Runtime Tree；Platform Adapter 执行本地 Host 操作。

平台级标准总 Spec 由 `requirements.md`、`design.md`、`tasks.md`、`acceptance.md` 组成；详细架构、Case 和公共 Schema 只作为其支撑合同，不替代标准入口。

## 2. 标准总 Spec

按顺序阅读：

1. [Requirements](./requirements.md)：产品目标、V1 需求、约束和项目映射。
2. [Design](./design.md)：总体分层、三大系统、树/ID、线程和平台边界。
3. [Tasks](./tasks.md)：八项目工作包、依赖、启动批次和闭环顺序。
4. [Acceptance](./acceptance.md)：架构、Case、三平台、失败、资源和证据门禁。

发生冲突时，优先级为：标准总 Spec -> 详细公共合同 -> 项目总 Spec -> 项目分 Spec -> 聊天上下文。Schema 是对应公共消息的机器合同，不得被文字描述绕过。

## 3. 总体架构

```text
QuickApp Kit Runtime RPK
  -> Manifest / Runtime Metadata / Page IR
  -> JS Executor / JS Framework
  -> C++ Core Contract
  -> Platform Adapter
  -> Android / LVGL / iOS Host
```

核心数据流：

```text
InstantiateTemplate
  -> C++ 创建 Runtime Tree
状态变化
  -> JS Binding 求值
  -> RenderTransaction
  -> C++ 更新 Runtime Tree
  -> MountTransaction
  -> Platform Host
平台输入
  -> PlatformInputMessage
  -> C++ Event Router
  -> JsEventDispatch
  -> JS Handler
```

## 4. 公共合同

公共合同必须明确数据结构、所有权、线程、生命周期、复制/共享、错误和降级：

```text
Surface Control / InstantiateTemplate / RenderTransaction
Runtime Artifact / Platform Surface Adapter / Measure Adapter
Runtime Launch Profile
Runtime Composition Manifest
Verified Module Load / AppContext / Lifecycle Dispatch / Runtime Host Control
PlatformInputMessage / JsEventDispatch
NavigationPush / NavigationClose / CloseSurfaceHost / Capability Module / ShowToast / DeviceGetInfo / SetTitleBar / SetMeta
App/Page Lifecycle
LogicalNodeRef / OwnerInstanceId / Runtime NodeId / TemplateBindingId / TemplateHandlerId / HandlerId
Observation Marker / Metric Boundary / Trace Correlation
```

## 5. 项目 Spec 分层

每个项目的总 Spec 位于 `../projects/<project>/spec/`，只定义项目需求、总体架构、分 Spec 清单和整体验收。项目分 Spec 位于 `../projects/<project>/spec/subspecs/<name>/`，只定义一个可独立实现和验收的模块。

第五次定向复核 `PASS`，P0/P1/P2 均为 0。第一批分 Spec 总检查已完成，具体 `PASS/CHANGES_REQUIRED` 与编码门禁以 `../AGENT-WORK-BOARD.md` 第 5 节为准。本目录只维护跨项目合同，不重复维护项目或平台细节。

详细设计与公共合同：

- [总架构](./architecture.md)
- [V1 Scope And Acceptance](./v1-scope-and-acceptance.md)
- [Render Contract](./contracts/render-contract.md)
- [Event Contract](./contracts/event-contract.md)
- [Runtime ABI](./contracts/runtime-abi.md)
- [ID Contract](./contracts/id-contract.md)
- [Feature Contract](./contracts/feature-contract.md)
- [Capability Module Contract](./contracts/capability-module-contract.md)
- [App And Page Lifecycle](./contracts/application-lifecycle-contract.md)
- [Measure Adapter Contract](./contracts/measure-adapter-contract.md)
- [Navigation Contract](./contracts/navigation-contract.md)
- [Error Contract](./contracts/error-contract.md)
- [Observation Contract](./contracts/observation-contract.md)
- [Lifecycle And Threading](./contracts/lifecycle-and-threading.md)
- [Block Lifecycle](./contracts/block-lifecycle.md)
- [公共协议 Schema](./contracts/schemas/README.md)
- [Surface Control](./contracts/surface-control.md)
- [Host Component Contract](./contracts/host-component-contract.md)
- [Runtime Value](./contracts/runtime-value.md)
- [Runtime Artifact Contract](./contracts/artifact-contract.md)
- [Runtime Launch Profile Contract](./contracts/runtime-launch-profile.md)
- [Runtime Composition Contract](./contracts/runtime-composition-contract.md)
- [Platform Surface Adapter Contract](./contracts/platform-surface-contract.md)
