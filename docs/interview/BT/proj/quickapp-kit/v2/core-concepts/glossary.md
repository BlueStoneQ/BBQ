# QuickApp Kit v2 统一概念表

## 目录

- [1. 结论](#1-结论)
- [2. 使用规则](#2-使用规则)
- [3. 标准与产物](#3-标准与产物)
- [4. 状态与变化](#4-状态与变化)
- [5. 树与节点身份](#5-树与节点身份)
- [6. 提交与渲染](#6-提交与渲染)
- [7. 跨层与执行](#7-跨层与执行)
- [8. 事件系统](#8-事件系统)
- [9. 待决策术语](#9-待决策术语)

## 1. 结论

本文是 QuickApp Kit v2 的术语唯一入口：每个概念先用一句话说明本质，再说明边界；其他文档不得为同一术语赋予不同含义。

## 2. 使用规则

1. 首次出现术语时使用本文定义。
2. `Dirty`、`Diff`、`Patch`、`Mutation`、`Transaction`、`Commit`、`Mount` 不得混用。
3. 联盟标准概念与 QuickApp Kit 内部实现概念必须明确区分。
4. 尚未确定的实现名称标记为“候选”，不得写成既定合同。
5. 推翻已确定概念时，必须先更新决策文档和本文。

状态含义：

| 状态 | 含义 |
|---|---|
| 标准 | 来自联盟对外规范或真实产物 |
| 已确定 | QuickApp Kit 已确认的内部概念 |
| 候选 | 仍需根据源码、PoC 或 Benchmark 决策 |

## 3. 标准与产物

| 概念 | 一句话本质 | 边界 | 状态 |
|---|---|---|---|
| 联盟 DSL | 开发者描述快应用结构、样式和逻辑的标准语言 | QuickApp Kit 不另定义 DSL | 标准 |
| 组件体系 | 联盟规定的 UI 标签、属性、样式和行为语义 | Platform Backend 只实现其平台映射 | 标准 |
| Feature API | 联盟应用访问系统能力的标准接口 | 内部由 Capability System 承载 | 标准 |
| RPK | 联盟 Toolkit 构建并交给 Runtime 加载的应用包 | 是外部运行输入，不是内部 Runtime Tree | 标准 |
| `$app_define$` | RPK 向 JS Framework 注册应用或组件模块的入口 | 属于联盟产物与 Framework 的边界 | 标准 |
| `$app_bootstrap$` | RPK 请求 Framework 启动已注册模块的入口 | 属于联盟产物与 Framework 的边界 | 标准 |
| `$app_require$` | RPK 获取 Feature 模块或应用模块的入口 | 属于联盟产物与 Framework 的边界 | 标准 |
| Template Descriptor | 联盟 Toolkit 编译进页面 JS 的模板对象 | 已验证包含 `type/attr/children/events` 和动态函数 | 标准 |
| Template IR | 对模板静态信息的内部优化表示 | 是否引入及格式尚未定案 | 候选 |

## 4. 状态与变化

| 概念 | 一句话本质 | 与相邻概念的区别 | 状态 |
|---|---|---|---|
| State | 决定应用当前行为和 UI 的业务数据 | State 不是渲染树 | 已确定 |
| Data Binding | 数据变化驱动模板动态值更新的关系 | 是联盟语义；具体依赖表是实现细节 | 标准 |
| Dirty | 标记哪里可能需要重新计算 | Dirty 不是实际变化 | 已确定 |
| Reconcile | 决定新描述如何复用或替换现有节点 | 重点是身份与结构匹配 | 已确定 |
| Diff | 比较新旧状态并计算真实差异 | Diff 是过程，输出变化描述 | 已确定 |
| Patch | 对局部变化或局部新状态的描述 | 必须写全层次，禁止单独使用裸 `Patch` | 候选 |
| Mutation | 一个可执行的具体树或控件变化 | 例如 Create、Update、Remove、Move | 已确定 |
| Change Coalescing / 变化合并 | 同一批次中消除可覆盖的中间状态，只保留有效最终变化 | 只适用于可合并的声明式变化 | 已确定 |

基本关系：

```text
Dirty 找候选
-> Reconcile/Diff 算变化
-> Change Coalescing 消除中间噪音
-> Transaction 批量提交
```

## 5. 树与节点身份

| 概念 | 一句话本质 | 所有者 | 状态 |
|---|---|---|---|
| Runtime Tree | Runtime 对当前平台无关 UI 状态的权威表示 | C++ Core | 已确定 |
| Host Tree | 平台当前实际存在的 UI 对象及其层级 | Platform Backend | 已确定 |
| JS Render Tree | JS 侧完整动态渲染树 | 是否保留尚需结合 hapjs/Vela 实现定案 | 候选 |
| NodeId | 一个 Runtime 节点在其生命周期中的稳定身份 | C++ Core 产生，Platform 使用 | 已确定 |
| Node Position | 节点当前的父节点与兄弟顺序 | Runtime Tree 维护；位置不是身份 | 已确定 |
| Key | 动态兄弟节点之间用于复用匹配的业务身份提示 | 只服务局部 Reconcile，不替代 NodeId | 已确定 |
| Generation | 区分同一存储槽位不同历史对象的版本号 | 用于拒绝悬空 NodeId | 已确定 |
| Arena | 集中管理大量对象存储和生命周期的内存区域 | Arena 管存储，Tree 管关系，NodeId 管身份 | 已确定 |
| NativeHandle | Platform Backend 对真实平台对象的内部引用 | 不得进入 Core 公共合同 | 已确定 |

## 6. 提交与渲染

| 概念 | 一句话本质 | 边界 | 状态 |
|---|---|---|---|
| Render Intent | 上层表达“期望展示什么”的声明式输入 | 具体数据形态尚需结合联盟产物定案 | 候选 |
| RenderTransaction | 一批经过变化合并、具有顺序和提交边界的渲染变化 | JS/Framework 到 Core 的具体合同待定 | 候选 |
| Revision | Runtime Tree 一次已确定状态的版本号 | 用于区分 current、pending、mounted | 已确定 |
| Commit | 将计算结果正式确认为新的 Runtime Revision | Commit 不等于平台已显示 | 已确定 |
| MountMutation | Platform Backend 可执行的一个 Host UI 变化 | 由 Core 产生 | 已确定 |
| MountTransaction | 同一 Revision 的有序 MountMutation 批次 | Core 到 Platform 的正式批量边界 | 已确定 |
| Mount | Platform Backend 将 MountTransaction 应用到 Host Tree | 只在 UI owner 线程执行 | 已确定 |

基本关系：

```text
Render Intent
-> Runtime Tree Reconcile/Diff
-> Commit Revision
-> MountTransaction
-> Host Tree Mount
```

## 7. 跨层与执行

| 概念 | 一句话本质 | 边界 | 状态 |
|---|---|---|---|
| JS Framework | 实现联盟应用运行语义并连接 RPK 与 Native Runtime 的 JS 基础层 | 必须实现 `$app_*` 入口 | 已确定 |
| Host Function / External Function | JS 同进程直接调用 Native 函数的引擎机制 | 调用直接，但跨线程前必须转换为 C++ Owned Data | 已确定 |
| JS Bridge | JS Runtime 与 C++ Runtime 的调用和值转换边界 | 不等于 Core 到 Platform | 已确定 |
| Render Backend Contract | Core 向平台提交 Host UI 变化的接口 | 使用类型化批量事务 | 已确定 |
| JNI | Android JVM 与 C/C++ 双向调用的同进程机制 | 只属于 Android Backend | 已确定 |
| Task | 一次有开始和结束的 Runtime 工作单元 | 普通更新可在 Task 结束后批量 Flush | 已确定 |
| Runtime Thread | 执行 JS、Framework 与 Runtime 任务的所有者线程 | 不直接操作平台 UI | 已确定 |
| UI Owner Thread | 唯一允许操作 Host UI 的平台执行序列 | Android/iOS 主线程或 LVGL owner loop | 已确定 |
| EventLoop Backend | 等待并调度 Timer、I/O 和 Runtime Task 的实现 | libuv 是候选实现之一，不属于 Core 硬依赖 | 已确定 |

## 8. 事件系统

事件系统的本质：

> 平台产生事件，通过节点身份找到绑定关系，再回到 JS 执行对应函数。

```text
Platform Event -> NodeId -> Event Binding -> JS Handler
```

| 概念 | 一句话本质 | 所有者 | 状态 |
|---|---|---|---|
| Event Handler | JS 引擎堆中的可调用函数对象 | JS Runtime / Component Instance | 已确定 |
| Event Binding | 某节点的某类事件应调用哪个组件方法的关系 | Runtime Tree | 已确定 |
| Platform Event | 平台命中系统产生的原始输入事件 | Platform Backend | 已确定 |
| Event Dispatch | 按 Runtime Tree 关系定位并调度 Handler 的过程 | C++ Core + JS Framework | 已确定 |
| Event Propagation | 事件沿逻辑节点关系执行 capture/target/bubble 的规则 | 由 Runtime Tree 统一语义 | 候选，规则待合同化 |

## 9. 待决策术语

以下名称不得提前进入稳定公共合同：

| 候选名称 | 待确认问题 |
|---|---|
| BindingId / DynamicSlotId | 联盟产物与 Vela 实现是否已有更合适的定位机制 |
| BindingPatch / StructurePatch | JS 到 C++ 的真实输入是数据变化、DOM Action 还是其他结构 |
| Logical DOM / Render Intent Tree | JS Framework 是否维护完整动态树 |
| Shadow Tree / Runtime Tree | 最终统一名称及是否存在多个 revision 快照 |
| `__quickapp_*` Host Functions | 私有接口数量、参数和批处理边界 |
| Render Worker | 何时从 Runtime Thread 中拆出独立渲染线程 |

这些问题以联盟规范、真实 RPK、hap-toolkit、hapjs、Vela 工程实践和 PoC 数据为决策依据。
