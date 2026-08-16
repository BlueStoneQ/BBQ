# QuickApp Kit v3 平台总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 产品本质](#2-产品本质)
- [3. V1 目标](#3-v1-目标)
- [4. 平台级功能需求](#4-平台级功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 约束与非目标](#6-约束与非目标)
- [7. 项目责任映射](#7-项目责任映射)

## 1. 结论

QuickApp Kit V1 是一套**联盟 DSL 输入、统一 C++ Core、多平台 Host 输出的全链路应用框架**。它不只是 Runtime 或 CLI，而是由编译工具、JS 动态语义、C++ 运行内核、平台适配、标准验收应用和可观测基线共同组成的产品。

V1 成功标准不是“协议和空壳存在”，而是同一份联盟 DSL 源码经 Toolkit 构建后，在 LVGL/SDL、Android 和 iOS 上真实可见、可点击、可导航，并产生可关联的运行证据。

## 2. 产品本质

### 2.1 输入与输出

```text
输入：联盟 Manifest + .ux/template/style/script + assets
  -> QuickApp Kit Toolkit
  -> Runtime RPK：JS Bundle + Page IR + Runtime Metadata + assets
  -> JS Runtime + C++ Core
  -> Platform Adapter
输出：LVGL/SDL、Android、iOS 上语义一致的交互应用
```

联盟现成 RPK/RPKS 是研究、`inspect` 和行为对照输入，不是 V1 Runtime 直接执行合同。V1 Runtime 的正式输入是本 Toolkit 生成的 `quickapp-kit-rpk`。

### 2.2 产品组成

| 组成 | 回答的问题 |
|---|---|
| Toolkit | 联盟 DSL 如何变成 Runtime 可直接消费的静态事实和动态语义 |
| JS Runtime | 状态、Binding、Block、Handler 和生命周期如何执行 |
| C++ Core | 页面状态、唯一 Runtime Tree、布局、事务、事件和路由如何统一 |
| Platform Runtime | 同一语义如何映射为 LVGL、Android 和 iOS Host 对象 |
| Examples | 用什么固定应用证明编译、运行和跨平台行为正确 |
| Benchmark | 如何记录主链路时间、事务大小、内存和对象证据 |

## 3. V1 目标

1. **联盟源码兼容**：以 Case 001 的真实联盟源码为首个兼容基线。
2. **统一运行内核**：三平台复用同一 JS Runtime、C++ Core 和 Runtime ABI。
3. **嵌入式优先证明**：先在 LVGL/SDL 跑出完整交互闭环，再验证真实设备。
4. **跨平台复用证明**：Android 随后运行同一 Artifact/Core/JS，证明 Core 未被 LVGL 反向定义；iOS 最后接入。
5. **可验证而非演示**：Case 001、Case 002、`BLOCK-001` 和 `CAP-DEVICE-001` 提供固定输入、操作、预期和 Trace。
6. **轻量且可扩展**：V1 只保留主链路必需机制，通过 typed Port 和 ModuleRegistry 扩展，不提前建设完整外围平台。

详细 V1 子集和 Case 语义见 [V1 Scope And Acceptance](./v1-scope-and-acceptance.md)。

## 4. 平台级功能需求

| ID | 需求 |
|---|---|
| QK-R01 | Toolkit 必须接收联盟 Manifest、`.ux`、template、style/script 和 assets，支持 Case 001/002 所需语法，并对超出 V1 子集的语义给出稳定诊断。 |
| QK-R02 | Toolkit 必须确定性输出 JS Bundle、不可变 Page IR、Runtime Metadata、Artifact Descriptor 和 Runtime RPK；相同输入和工具版本产生相同逻辑产物与稳定 ID。 |
| QK-R03 | JS Runtime 必须执行 App/Page VM、生命周期、state、Binding、Block 和 Handler；不维护完整 VNode Tree，不接收 Runtime `NodeId`。 |
| QK-R04 | C++ Core 必须拥有唯一权威 Runtime Tree、NodeId、App/Page/Surface 状态、Navigation 栈、Style/Yoga、Measure cache、Event Router 和事务提交。 |
| QK-R05 | JS -> Core 必须通过 `JsEnginePort` 的 Native Function Binding 承载公共 typed message；QuickJS V1 Provider 使用 External Function；禁止 `moduleName + methodName + JSON` 通用 Bridge。 |
| QK-R06 | Core -> Platform 必须通过平台无关 typed Port；JNI 只属于 Android Adapter，Objective-C++ Gateway 只属于 iOS Adapter，LVGL Backend 只属于 LVGL Runtime。 |
| QK-R07 | 渲染必须采用“JS Dirty 增量意图 -> Core 唯一 Runtime Tree -> MountTransaction -> Host Tree”；不得比较两棵完整新旧运行树。 |
| QK-R08 | 事件必须采用“PlatformInputMessage -> Core Event Router -> JsEventDispatch/HandlerId -> JS Handler”；一次输入的 RequestId 必须贯穿路由、Handler 与同步更新，Platform 不生成 HandlerId，JS 不持有 NativeHandle。 |
| QK-R09 | Core 必须统一管理 Root/Push/Close、Surface 可见性、App/Page Hook 顺序和最小 Capability 路由；Platform 只执行 Host command。 |
| QK-R10 | V1 必须提供 `system.router`、`system.prompt`、`system.device` 和 Page title/meta；`system.fetch` 只提供可解析但不可调用的 deferred facade。 |
| QK-R11 | LVGL/SDL、Android、iOS 必须运行同一 Runtime RPK、Core 和 JS Runtime，并对相同 Case 产生相同逻辑结果、ID 关系和错误分类。 |
| QK-R12 | SDL simulator 必须承载完整 Runtime，支持真实鼠标/触摸输入、状态更新和页面导航，不得退化为截图器。 |
| QK-R13 | Toolkit 必须提供 CLI-first 的 `build/inspect/run`；Toolkit Application Service 是唯一能力内核，CLI 是 V1 第一入口，后续编辑器、Skill/MCP 只做薄适配。 |
| QK-R14 | Examples 必须维护不可随意修改的 Case 001 联盟基线、Case 002 增量基线、`BLOCK-001` 动态增删基线和 `CAP-DEVICE-001` device focused fixture。 |
| QK-R15 | Benchmark 必须验证并消费公共 Observation Contract，统一采集主链路 marker、关联 ID、时间单位、事务大小、内存和对象计数，并保存可回链的原始证据。 |
| QK-R16 | Mount 失败必须返回 typed error；V1 至少保留一次 full rebuild 兜底，不要求完整多级恢复系统。 |
| QK-R17 | Capability 必须通过最小静态 ModuleRegistry、typed Invoker 和可插拔 Provider 实现；完整权限与动态插件治理后置。 |
| QK-R18 | 所有公共消息必须定义结构、语义、所有权、线程、生命周期、错误和降级；平台项目不得私建旁路合同。 |
| QK-R19 | Runtime 必须采用固定 Kernel 与编译期可组合外围：三大系统和共同权威机制不可裁剪；外围只依赖内核 Port，未选模块及依赖不得进入最终链接产物；Core 必须在执行 JS 前按 Runtime Composition Manifest 完成 Artifact 兼容性预检。 |
| QK-R20 | JS 执行能力必须作为 Runtime Service 存在，但具体 JS Engine 必须通过稳定 `JsEnginePort` 可替换；Build Profile 必须且只能选择一个 Engine Provider，V1 提供 QuickJS，Core 和 JS Framework 不得依赖 QuickJS 类型。 |
| QK-R21 | Runtime Kernel 必须提供可关闭、可替换的 `TraceSink`、整数纳秒单调时钟和 O(1) 轻量计数器，输出主链路、错误与降级的结构化事实；存储、导出、统计、报告和可视化必须位于外围。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 架构完整性 | Toolkit、JS、Core、Platform 单向分层；每项状态和 ID 只有一个权威所有者。 |
| 平台无关 | Core/JS 公共实现不引用 Android、UIKit、LVGL、SDL、JNI 或平台对象。 |
| 轻量 | V1 不引入完整 VDOM、完整树 Diff、通用反射 Bridge、不可替换 EventLoop 或多套状态树。 |
| 可裁剪 | 条件构建只位于 Composition Root 与模块目标；未选外围模块不进入链接产物，Kernel 不散布外围条件分支。 |
| 引擎可替换 | JS Framework 与 Engine Provider 通过 `JsEnginePort` 解耦；一个产物只链接一个 Engine，禁止运行时热切换。 |
| 确定性 | 相同 Artifact 和输入顺序产生相同逻辑事务、ID 关系和状态结果。 |
| 线程 | JS Executor、Core Runtime、Platform owner 是逻辑执行域；跨域不发生同步环形等待。 |
| 内存 | Surface/Page 销毁后 VM、Runtime Node、Handler、Host object、映射和在途请求有确定释放点。 |
| 可诊断 | 构建、加载、执行、Mount 和平台失败使用稳定错误分类，不静默成功或自动改写语义。 |
| 可观测 | 生命周期、Render、Mount、Event、Navigation、Capability 和资源变化可由公共 ID 关联。 |
| 可测试 | 公共 Schema、语义负例、Fake Port、Case 和三平台证据共同组成验证体系。 |
| 可扩展 | 新平台、Provider 和工具入口通过既有 typed Port 接入，不要求修改应用语义和 Runtime Tree 所有权。 |

## 6. 约束与非目标

### 6.1 冻结约束

1. C++ Core 从第一天属于独立共享工程，不从 Android 工程事后搬迁。
2. Page IR 是有根有序静态模板定义的归一化表，不是第二棵可变 Runtime Tree。
3. Core 的 Runtime Tree 是 JS/Core 逻辑层唯一权威运行时树；Platform Host Tree 只属于平台对象映射。
4. 联盟 Android 实现是语义参考，不是共享 Core 的代码来源。
5. 产品闭环顺序固定为 `LVGL/SDL -> Android -> iOS`，但三个平台分 Spec 可以并行设计。
6. Bridge、Render、Event 及 Lifecycle、Runtime Tree、Transaction 是固定 Kernel；Platform Backend、Provider、扩展组件和诊断能力只可由外围向内组合。

### 6.2 V1 非目标

- 直接执行联盟现成 RPK/RPKS。
- 全量联盟组件、接口、权限、Widget/Card、动画和复杂文本。
- 通用动态插件包、运行时卸载、IDL/Codegen 和完整 Provider 治理。
- Skill/MCP、VS Code 插件、AI Feature、Chat 组件和应用生态产品化。
- Release 信任链、正式分发和完整外部框架性能排名。
- 多级 Surface/进程容灾和所有故障组合。

以上后续能力统一记录在 [TODO](../../TODO.md)，不得进入 V1 阻塞门禁。

## 7. 项目责任映射

`Accountable owner` 对需求闭环唯一负责；Contributor 只实现自己边界内的部分。总架构 Agent 是公共合同治理者，不拥有产品实现。

| 需求 | Accountable owner | Contributors | 平台任务 | 验收证据 |
|---|---|---|---|---|
| QK-R01 | quickapp-toolkit | quickapp-examples | QK-T07 | Artifact 与构建验收、Case source matrix |
| QK-R02 | quickapp-toolkit | quickapp-runtime-core | QK-T07、T09 | 确定性 Golden、Artifact/Loader 合同测试 |
| QK-R03 | quickapp-runtime-js | quickapp-toolkit、quickapp-runtime-core | QK-T08 | JS VM/Binding/Block/Handler 单元与 Trace |
| QK-R04 | quickapp-runtime-core | quickapp-runtime-js、三个 Platform Runtime | QK-T09 | Fake Port、Runtime Tree/Navigation 状态机和资源证据 |
| QK-R05 | quickapp-runtime-js | quickapp-runtime-core | QK-T08、T09 | Runtime ABI 正负例、无通用 Bridge 检查 |
| QK-R06 | quickapp-runtime-core | quickapp-runtime-lvgl、quickapp-runtime-android、quickapp-runtime-ios | QK-T09..T12 | 公共 Platform Port 合同及三端 Adapter 证据 |
| QK-R07 | quickapp-runtime-core | quickapp-runtime-js、三个 Platform Runtime | QK-T08..T12 | Render/Mount 合同、唯一树和三端事务 Trace |
| QK-R08 | quickapp-runtime-core | quickapp-runtime-js、三个 Platform Runtime | QK-T08..T12 | Event 合同、Handler 路由和三端 click Trace |
| QK-R09 | quickapp-runtime-core | quickapp-runtime-js、三个 Platform Runtime | QK-T08..T12 | Lifecycle/Navigation 状态机及 Present/Close 故障注入 |
| QK-R10 | quickapp-runtime-core | quickapp-runtime-js、三个 Platform Runtime、quickapp-examples | QK-T06、T08..T12 | Capability 合同、Case 001 与 CAP-DEVICE-001 |
| QK-R11 | quickapp-runtime-core | quickapp-runtime-lvgl、quickapp-runtime-android、quickapp-runtime-ios、quickapp-examples | QK-T09..T12、T15..T18 | 同 Artifact/Core/JS 的三端 Case 和差异清单 |
| QK-R12 | quickapp-runtime-lvgl | quickapp-runtime-core、quickapp-runtime-js | QK-T10、T15 | SDL 完整交互窗口、输入、导航和 Trace |
| QK-R13 | quickapp-toolkit | 三个 Platform Runtime | QK-T07 | CLI/Application Service 边界、build/inspect/run 证据 |
| QK-R14 | quickapp-examples | quickapp-toolkit、JS/Core/Platform、quickapp-benchmark | QK-T06 | Case provenance、操作、预期和跨项目 identity 检查 |
| QK-R15 | quickapp-benchmark | Toolkit、JS、Core、三个 Platform Runtime | QK-T05A、T19 | Observation Contract 验证、raw data 和基础报告 |
| QK-R16 | quickapp-runtime-core | 三个 Platform Runtime | QK-T09..T12 | Mount 失败注入、一次 full rebuild 和最终状态证据 |
| QK-R17 | quickapp-runtime-core | quickapp-runtime-js、三个 Platform Runtime | QK-T08..T12 | Registry/Invoker/Provider success/unsupported/failure 测试 |
| QK-R18 | 总架构 Agent | 全部项目 | QK-T02、T13 | `spec/contracts/**`、Schema/语义负例和分 Spec 合同一致性校审 |
| QK-R19 | quickapp-runtime-core | Toolkit、JS、三个 Platform Runtime、Benchmark | QK-T02、T07..T12、T20 | Runtime Composition Manifest、依赖检查、双 Profile 链接清单、体积与内存证据 |
| QK-R20 | quickapp-runtime-js | 三个 Platform Runtime、Toolkit、Benchmark | QK-T08、T10..T12、T20 | Fake Engine 合同、QuickJS Provider、单 Engine 链接清单与 Manifest identity |
| QK-R21 | quickapp-runtime-core | 三个 Platform Runtime、quickapp-benchmark、quickapp-runtime-js | QK-T05、T05A、T08..T12 | Noop/Recording TraceSink 合同、单调时钟、计数器、结构化 Marker 与关闭观测等价性测试 |

各项目只在自己的总 Spec 和分 Spec 中细化实现；Contributor 不得重新定义 Accountable owner 拥有的公共状态或 Port。
