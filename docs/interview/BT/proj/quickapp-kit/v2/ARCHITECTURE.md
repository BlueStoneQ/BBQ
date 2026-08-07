# QuickApp Kit v2 总架构设计

## 目录

- [1. 结论](#1-结论)
- [2. 背景与问题](#2-背景与问题)
- [3. 本质分析](#3-本质分析)
- [4. 总体架构](#4-总体架构)
- [5. 核心原理](#5-核心原理)
- [6. 三条核心通道](#6-三条核心通道)
- [7. 产品矩阵与职责边界](#7-产品矩阵与职责边界)
- [8. Android NDK 先行策略](#8-android-ndk-先行策略)
- [9. 业内借鉴](#9-业内借鉴)
- [10. 关键决策索引](#10-关键决策索引)
- [11. 重点吸收点](#11-重点吸收点)
- [12. 边界与不做事项](#12-边界与不做事项)
- [13. 验收标准](#13-验收标准)
- [14. 后续演进](#14-后续演进)

## 1. 结论

QuickApp Kit v2 的总架构结论：

```text
QuickApp Kit v2
  = QuickApp Package Contract
  + JS Framework Runtime
  + Shared Runtime Core
  + Multiple Render Backends
  + TurboModule-like Capability System
  + CLI-first Toolkit
  + Observable Benchmark
```

一句话定义：

```text
QuickApp Kit v2 是一套面向移动 OS 与嵌入式设备的轻应用运行平台。
它用一套 Runtime Core 承载应用语义，用多个 Render Backend 适配不同设备，
用 Capability Module 体系开放平台能力，用 Benchmark 验证架构质量。
```

核心架构主张：

```text
One Runtime Core
Multiple Render Backends
Capability Module as First-class Architecture
Contract First, Android Incubation, Core Extraction
```

## 2. 背景与问题

QuickApp Kit v1 的主线偏向“先做 Android Runtime，再逐步补 Core 和其他端”。这个路径能快速验证单端链路，但容易出现三个问题：

1. Android 细节污染 Core，导致跨端复用困难。
2. 多端 runtime 各自演进，应用语义无法保持一致。
3. 系统能力开放停留在 hardcode API，无法形成可扩展的平台能力体系。

v2 要解决的问题不是“再写一个 runtime”，而是回答：

```text
如何建设一套可跨 Android / iOS / LVGL / 嵌入式设备复用的轻应用平台架构？
```

## 3. 本质分析

QuickApp、React Native、Lynx、小程序类框架，本质上都在解决同一个问题：

```text
用前端声明式模型描述应用，
由运行时解释应用语义，
再由宿主平台完成渲染和能力调用。
```

拆到底层，平台需要解决四类本质问题：

1. **应用产物问题**：应用如何被描述、打包、分发、加载。
2. **运行语义问题**：页面、组件、生命周期、路由、事件如何执行。
3. **渲染适配问题**：同一套 UI 语义如何落到不同平台控件。
4. **能力开放问题**：JS 如何调用系统、设备、服务和插件能力。

因此 v2 的架构不能围绕某一个端设计，而要围绕这四个本质问题设计。

## 4. 总体架构

```text
┌────────────────────────────────────────────────────────────┐
│                    QuickApp Source / RPK                    │
│       .ux / manifest / assets / app.js / page bundles       │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│                  Package & Runtime Contract                 │
│        RPK Contract / Manifest Model / Compatibility        │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│                    JS Framework Runtime                     │
│     $app_define$ / $app_bootstrap$ / $app_require$ / VM     │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│                    Shared Runtime Core                      │
│ Router / Lifecycle / VNode / Shadow Tree / Diff / Layout    │
│ Render Mutation / Event Dispatch / Capability Bridge        │
└───────────────┬──────────────────────────────┬─────────────┘
                │                              │
                │ Render Channel              │ Capability Channel
                │                              │
┌───────────────▼────────────────┐  ┌──────────▼──────────────────┐
│        Render Backend           │  │     Capability Provider      │
│ Android / iOS / LVGL / Future   │  │ system.* / device / service  │
└───────────────┬────────────────┘  └──────────┬──────────────────┘
                │                              │
┌───────────────▼──────────────────────────────▼──────────────────┐
│              Device Runtime / OS / Embedded Platform             │
│          Android View / UIKit / LVGL / Platform Services         │
└──────────────────────────────────────────────────────────────────┘
```

核心分层：

| 层级 | 职责 |
|---|---|
| Package & Contract | 定义 RPK、manifest、页面、能力声明、兼容性 |
| JS Framework Runtime | 承接 QuickApp JS 执行模型与系统模块代理 |
| Shared Runtime Core | 承载跨端共享的应用运行语义 |
| Render Backend | 把 Core 的渲染指令映射到平台控件 |
| Capability Provider | 把能力调用映射到平台服务 |
| Toolkit | 构建、校验、运行、调试、benchmark 入口 |
| Benchmark | 观测启动、首屏、JS、layout、render、bridge、内存 |

## 5. 核心原理

### 5.1 Core owns semantics

Runtime Core 负责应用语义，而不是平台控件。

Core 应包含：

- RPK Loader
- Manifest Model
- Runtime Host
- Router
- Lifecycle Dispatcher
- VNode / Shadow Tree
- Reconciler / Diff
- Style Resolver
- Layout Engine
- Render Mutation Pipeline
- Event Dispatcher
- Capability Bridge

Core 不应包含：

- Android View
- UIKit
- LVGL Object
- 平台线程实现细节
- 平台系统 API 具体实现

### 5.2 Backends own widgets

Render Backend 负责平台控件映射。

同一条 Core 输出：

```text
create text node
set style color
set layout rect
bind click event
commit mutation batch
```

在不同平台落地为：

| 后端 | 控件 |
|---|---|
| Android | View / ViewGroup / TextView / EditText |
| iOS | UIView / UILabel / UITextField |
| LVGL | lv_obj / lv_label / lv_textarea |

### 5.3 Contract owns compatibility

跨项目独立开发的前提是契约集中。

必须集中定义：

- RPK Contract
- Runtime Contract
- Render Backend Contract
- Capability Module Contract
- Event Contract
- Benchmark Protocol
- Compatibility Matrix

### 5.4 Capability Module owns platform extensibility

系统能力不应该散落在 JS Framework、Core 和平台后端中。

能力调用应统一进入 Capability Module：

```text
$app_require$("@app-module/system.device")
  -> JS Module Proxy
  -> Capability Registry
  -> Method Invoker
  -> Platform Capability Provider
```

这样后续添加 `system.fetch`、`system.storage`、`system.account`、`agent.tool` 时，不需要改 Runtime 地基。

## 6. 三条核心通道

### 6.1 Render Channel

Render Channel 解决“应用怎么显示”。

```text
Template / Style
  -> VNode / Shadow Tree
  -> Diff / Reconcile
  -> Layout
  -> Render Mutation
  -> Render Backend
  -> Native Widgets
```

关键点：

- Core 生成平台无关的 mutation。
- Backend 消费 mutation 并更新平台控件。
- commit 应支持批量提交，避免频繁跨边界调用。

### 6.2 Event Channel

Event Channel 解决“平台事件怎么回到 JS”。

```text
Native Event
  -> Backend Event Source
  -> Event Dispatcher
  -> Runtime Event Loop
  -> JS Handler
```

关键点：

- 平台事件不要和渲染命令混用。
- 事件需要回到 Runtime 调度上下文。
- 事件分发要保留 nodeId、eventType、payload。

### 6.3 Capability Channel

Capability Channel 解决“应用怎么使用平台能力”。

```text
JS system module call
  -> Module Proxy
  -> Capability Registry
  -> Capability Provider
  -> Platform Service
```

关键点：

- 能力模块按名称注册。
- 支持能力发现和 unsupported 降级。
- V1 手动注册，V2 引入 ModuleSpec / IDL / Codegen。

## 7. 产品矩阵与职责边界

| 产品 | 职责 |
|---|---|
| quickapp-runtime-core | 通用 C++ Core，负责应用运行语义 |
| quickapp-runtime-js | JS Framework，负责 QuickApp JS 执行模型 |
| quickapp-runtime-android | Android 后端与 NDK 首发宿主 |
| quickapp-runtime-ios | iOS 后端与 UIKit 宿主 |
| quickapp-runtime-lvgl | LVGL 嵌入式后端 |
| quickapp-toolkit | CLI 内核，负责构建、校验、运行、调试 |
| quickapp-examples | 示例应用与验收输入 |
| quickapp-benchmark | 可观测 benchmark 与框架对比 |

边界原则：

```text
JS Runtime does not own native widgets.
Core does not own platform services.
Backend does not own app semantics.
Toolkit does not own runtime behavior.
Benchmark does not change product behavior.
```

## 8. Android NDK 先行策略

结论：

```text
先设计 Core 契约，再用 Android NDK 孵化首条端到端链路，最后抽取 Core。
```

原因：

1. Android NDK 能快速验证 QuickJS、C++、JNI、View 渲染、事件回流、系统能力调用。
2. Android 的调试和观测能力更成熟，适合作为首发验证宿主。
3. JNI 边界会逼出真实的 Core / Backend / Capability 接口。
4. 先闭门写 Core 容易空转，缺少真实平台压力。

风险：

1. Android 细节污染 Core。
2. JNI 设计被误当成通用接口。
3. 平台线程模型提前侵入 Core。

控制方式：

1. Phase 0 先写 Core Contract。
2. Android 只作为 incubation host。
3. Core 只抽取平台无关语义。
4. LVGL 作为第二端验证 Core 是否真正可复用。

## 9. 业内借鉴

QuickApp Kit v2 借鉴业内优点，但不照搬工程形态。

| 框架 | 借鉴点 | 不照搬点 |
|---|---|---|
| React Native Fabric | Shadow Tree、reconcile、commit/mount、Native 渲染管线 | 不绑定 React，不照搬 RN 组件体系 |
| React Native TurboModule | 模块注册、懒加载、强契约、跨语言调用 | 不照搬 RN Codegen 和 JSI HostObject 形态 |
| Lynx | 高性能跨端 Runtime、批量更新、多端渲染后端 | 不照搬 Lynx DSL 和完整引擎结构 |
| Flutter | Framework/Engine/Embedder 分层、可观测管线 | 不采用 Flutter 自绘路线作为 V1 主线 |
| QuickApp/小程序体系 | 包协议、manifest、system.* 能力开放、轻应用生态 | 不停留在单端厂商 runtime 形态 |

吸收原则：

```text
先看本质问题，再吸收适配本项目的架构思想。
```

## 10. 关键决策索引

### KD-001：一套 Runtime Core，多种 Render Backend

结论：Core 承载应用语义，Backend 承载平台控件。

原因：跨端一致性来自共享语义，不来自各端重复实现。

### KD-002：Capability Module 是一等架构模块

结论：系统能力、设备能力、服务能力统一进入 Capability Module。

原因：能力开放是平台的核心，不是附属 API。

### KD-003：Android NDK 先孵化，Core 后抽取

结论：先用 Android 跑通真实链路，再抽取平台无关 Core。

原因：真实平台压力能逼出正确边界。

### KD-004：Toolkit 先做 CLI 内核

结论：toolkit 第一阶段采用 CLI，后续 VSCode 插件复用 CLI。

原因：CLI 是可复用工具链内核，IDE 只是产品交互层。

### KD-005：Benchmark 是架构验收，不是附属展示

结论：benchmark 从 v2 开始就是独立产品。

原因：平台架构质量需要可观测指标证明。

## 11. 重点吸收点

这些内容是本项目需要重点吸收和复盘的核心能力点：

1. **Runtime Core 边界设计**
   Core 应该抽象应用语义，而不是抽象平台控件。

2. **Fabric-like 渲染管线**
   VNode/Shadow Tree、diff、layout、mutation、commit/mount 是跨端 UI Runtime 的核心骨架。

3. **TurboModule-like 能力插件体系**
   能力开放需要 registry、module spec、invoker、provider、permission、version，而不是 hardcode API。

4. **Android NDK 孵化策略**
   Android 是真实链路验证宿主，用来打磨边界，不是架构中心。

5. **LVGL 的战略价值**
   LVGL 不是普通第三端，而是验证嵌入式设备适配能力的关键后端。

6. **Benchmark 可观测体系**
   启动、首屏、JS、layout、render、bridge、内存等指标要成为平台能力的一部分。

## 12. 边界与不做事项

V2 第一阶段不做：

1. 不做完整 QuickApp API 覆盖。
2. 不做完整 TurboModule Codegen。
3. 不做动态插件包加载。
4. 不做 Flutter 式自绘引擎。
5. 不做完整 IDE，VSCode 插件作为后续封装。
6. 不做所有设备形态，先以 Android 和 LVGL 验证主线。

## 13. 验收标准

架构验收：

1. 文档能清楚解释 Core、JS、Backend、Capability、Toolkit、Benchmark 的边界。
2. Render / Event / Capability 三条通道都有明确契约。
3. Android 首发链路能反向验证 Core Contract。
4. LVGL 能复用 Core，证明嵌入式适配成立。
5. Capability Module 能添加新能力而不改 Runtime 地基。
6. Benchmark 能输出可观测指标。

端到端验收：

```text
RPK
  -> JS Framework
  -> Runtime Core
  -> Render Backend
  -> Native UI
  -> Event Back to JS
  -> Capability Call to Platform
```

## 14. 后续演进

后续演进方向：

1. Runtime Contract 细化。
2. Render Backend Contract 细化。
3. Capability Module Contract 细化。
4. Android NDK 首发实现。
5. Core 抽取和独立发布。
6. LVGL + SDL 模拟器验证。
7. iOS UIKit 后端验证。
8. Benchmark 对比 RN / Lynx / Flutter / QuickApp 类框架。
