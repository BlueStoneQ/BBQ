# Runtime Core 总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 项目使命](#2-项目使命)
- [3. 输入与输出](#3-输入与输出)
- [4. V1 功能需求](#4-v1-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 边界与后置项](#6-边界与后置项)

## 1. 结论

Runtime Core 是三个平台共享的 C++ 运行时内核：**它校验 Runtime Artifact，维护唯一权威 Runtime Tree 和页面状态，把 JS 增量意图确定性转换为 Platform Mount，并统一路由事件、导航和能力。**

Core 从第一天独立实现，绝不从 Android 工程事后抽取。

## 2. 项目使命

```text
Runtime RPK + Runtime Host
  -> Package Loader / AppRuntime / Surface
JS Runtime messages
  -> Runtime Tree / Layout / Event / Navigation / Capability
  -> immutable Platform commands
```

Core 是逻辑状态与跨平台语义的唯一归属；平台类型、JS 函数和 Host 对象均不得进入 Core。

## 3. 输入与输出

### 3.1 输入

- Runtime Host 提供的 `PackageSource`、Root Surface 请求和 `RuntimeLifecycleControl`。
- Toolkit 生成的 Manifest、Runtime Metadata、Page IR、Bundle 索引和 Artifact 哈希。
- JS Runtime 提交的 Instantiate、Render、Handler、Navigation、Capability 和 Page Control typed message。
- Platform 返回的 Surface、Mount、Capability、Page Control 结果与输入事件。
- Platform Measure Adapter 返回的同步 `MeasureResult(measured|failed)` 与异步字体 generation 通知。
- Composition Root 注入的 `MonotonicClock` 与 `TraceSink`；Sink 可以是 Noop 或平台 Recording Adapter。

### 3.2 输出

- 发给 JS Runtime 的 `LoadVerifiedModule`、Context、LifecycleDispatch、Event Dispatch 和 typed Result。
- 发给 Platform 的 Surface create/present/visibility/close/destroy、Mount、Capability 和 Page Control typed command。
- Runtime Tree、Navigation、Revision、错误与 Trace 的可观测状态。
- Runtime Node、Handler、Surface 和队列深度的 immutable `RuntimeCounters` snapshot。

## 4. V1 功能需求

| ID | 需求 |
|---|---|
| CORE-R01 | 实现平台无关 `PackageSource` 消费和 ZIP/Manifest/Metadata/Page IR Loader。 |
| CORE-R02 | 在执行任何 JS 前完成路径、版本、结构、关系和 Artifact SHA-256 校验；verified 后才通过异步 `onLoadVerifiedModule/completeVerifiedModuleLoad` 转移/共享 immutable bytes、bootstrap、依赖及 page expected ID，并接收 loaded/failed Result。 |
| CORE-R03 | 实现一个 AppRuntime 对应一个 App VM、一个 Surface 对应一个 PageContext 的逻辑状态机；用 typed `AppContext/VmInitializationDispatch/Result/LifecycleDispatch/Result/RuntimeLifecycleControl` 闭合 Host、Core、JS，初始化失败立即终止对应 AppRuntime/Surface。 |
| CORE-R04 | 分配并维护 `SurfaceId`、`NodeId`；按 Owner + TemplateBindingId/TemplateHandlerId 从 Page IR 解析 LogicalNodeRef，再解析 NodeId。 |
| CORE-R05 | 根据 Page IR 和 `InstantiateTemplate` 原子建立首屏 Runtime Tree、Block 和 EventBinding。 |
| CORE-R06 | 原子应用 `updateBinding/instantiateBlock/removeBlock/moveBlock`，校验 Owner 与 Page/Block scope，不执行完整新旧树 Diff。 |
| CORE-R07 | 同一 Surface 严格执行 Revision 与单在途渲染周期；拒绝过期、非法目标和非法父子关系。 |
| CORE-R08 | 拥有 Style resolve、Yoga、Measure cache 和最终 Layout Rect；同步消费 Platform `MeasureResult(measured|failed)`，校验 metrics/generation，失败映射为 `MEASURE_FAILED` 且不部分提交。 |
| CORE-R09 | 将已提交 Runtime Tree 变化转换为有序 `MountTransaction`，正确区分 full 与 incremental。 |
| CORE-R10 | Mount 失败后保持权威 Runtime Tree，执行一次 full rebuild；再次失败将 Surface 置为 failed。 |
| CORE-R11 | 实现 Surface create/present/visibility/close/destroy 协调；生命周期与健康度正交，首屏成功必须晚于 Platform Present。 |
| CORE-R12 | 实现 Navigation Controller；push 只有在 target Present 成功后才提交页面栈；close 仅允许非 Root 栈顶，Platform `CloseSurfaceHost` 成功后才 pop、恢复前驱并释放 source。 |
| CORE-R13 | 实现 Event Router：原样保留输入 `RequestId`，并执行 `NodeId -> Runtime Tree bubble path -> LogicalNodeRef/HandlerId -> JsEventDispatch`；同一次输入的目标与冒泡 Dispatch 共享该 ID。 |
| CORE-R14 | 节点/Block/Surface 销毁时原子清理 EventBinding；Render 删除提交前保持旧 Binding，提交后才触发 JS Handler 最终释放，rejected/cancelled 时保持可恢复一致性。 |
| CORE-R15 | 实现 ModuleRegistry、CapabilityInvoker 和 `system.router` CoreProvider；supports 固定为 Manifest declaration AND Registry descriptor，且查询不创建 Provider。 |
| CORE-R16 | 路由 PlatformProvider 的 `system.prompt/system.device`，并统一 not-declared、unsupported、failure 和销毁取消语义；权限 Guard 后置。 |
| CORE-R17 | 路由当前 Surface 的 `SetTitleBar/SetMeta` Page Host Control，不改变 Runtime Tree。 |
| CORE-R18 | 串行执行 Host foreground/background/destroy；按 Platform visibility -> Core commit -> App/Page Hook -> Host Result 的公共顺序调度，Hook 失败不回滚已提交状态，不产生重复 Hook。 |
| CORE-R19 | 对外只暴露 immutable typed message；同步 Enqueue 成功不冒充异步执行成功。 |
| CORE-R20 | 为 Package、Lifecycle、Render、Mount、Event、Navigation、Capability 和 Measure 提供关联 Trace。 |
| CORE-R21 | 固定包含 Bridge/Render/Event 的 Core-side 部件及 Lifecycle/Runtime Tree/Transaction；只依赖公共 Port，不依赖外围具体模块；接收 Runtime Composition Manifest，并在执行 JS 前按 Manifest.features 与 Page IR Host Component 完成 Profile 兼容性预检。 |
| CORE-R22 | Core Foundation 必须提供 `MonotonicClock`、可替换 `TraceSink`、`NoopTraceSink` 和 O(1) `RuntimeCounters`；发出 Bridge、Render、Mount、Event、Lifecycle、OOM、队列溢出和 full rebuild 结构化事件，关闭观测不得改变 Runtime 行为。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 平台无关 | 公共头文件和实现不包含 JNI、Android、UIKit、LVGL、SDL 类型。 |
| 可裁剪边界 | Kernel 不散布外围条件编译；外围只能通过 Port/注册入口向内组合，未选模块由 Platform Composition Root 从链接中移除。 |
| 所有权 | Runtime Tree、App/Page 状态和 Navigation 栈只由 Core Runtime Thread 修改。 |
| 原子性 | 校验、Layout 或 Measure 失败不得部分提交 Runtime Tree；Mount 失败不得伪造 presented。 |
| 内存 | Page IR 可缓存并在最后一个 Surface 销毁后释放；Surface 销毁后无 Handler、Node 或请求残留。 |
| 可移植 | 同一 Core 实现在 LVGL/SDL、Android 和 iOS 完成 Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001`，不允许平台 fork。 |
| 可测试 | 所有平台边界可由 Fake Adapter 驱动，不依赖真实 UI 才能验证状态机。 |
| 可观测 | 所有异步链路能由 ID、Revision 和整数纳秒关联；热路径不格式化文本、不执行文件 I/O、不阻塞或等待 Collector。 |

## 6. 边界与后置项

Core V1 不做：

- JS Engine、JS Module Loader、Binding evaluator 或 JS Handler 函数。
- Android/iOS/LVGL Host 对象和平台 UI 生命周期映射。
- 完整新旧 Runtime Tree Diff。
- 动画、手势、捕获阶段、完整字体排版。
- 动态插件发现、应用注册模块、完整权限系统。
- Release 签名与信任策略实现。
- Trace 存储、导出、统计、报告、可视化和平台 Collector。
