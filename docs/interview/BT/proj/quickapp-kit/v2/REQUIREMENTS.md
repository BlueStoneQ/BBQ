# QuickApp Kit v2 总需求设计

## 目录

- [1. 项目定位](#1-项目定位)
- [2. 总体目标](#2-总体目标)
- [3. 产品矩阵](#3-产品矩阵)
- [4. 架构原则](#4-架构原则)
- [5. 三条核心通道](#5-三条核心通道)
- [6. 能力插件体系](#6-能力插件体系)
- [7. 开发路线](#7-开发路线)
- [8. 文档生产流程](#8-文档生产流程)
- [9. 首批设计产出](#9-首批设计产出)
- [10. 成功标准](#10-成功标准)

## 1. 项目定位

QuickApp Kit v2 是一套面向移动 OS 与嵌入式设备的轻应用运行平台解决方案。

核心主张：

```text
One Runtime Core
Multiple Render Backends
TurboModule-like Capability System
Observable Benchmark
```

它不是单端 demo，也不是单一 runtime 工程，而是一套从应用产物、JS 运行框架、通用 Runtime Core、多端渲染后端、平台能力插件体系、开发工具链到可观测 benchmark 的完整平台能力建设项目。

## 2. 总体目标

QuickApp Kit v2 要完成以下目标：

1. 定义 QuickApp 应用从源码/产物到多端运行的全链路架构。
2. 建设一套通用 Runtime Core，承载 VNode/Shadow Tree、diff、layout、render mutation、bridge、event、capability module 等核心能力。
3. 支持 Android、iOS、LVGL 等多种渲染后端，验证跨平台和嵌入式设备适配能力。
4. 建设 TurboModule-like 的能力插件体系，让系统能力、设备能力、服务能力可以通过统一机制接入。
5. 建设 toolkit，使 RPK 构建、校验、调试、运行流程可工程化。
6. 建设 benchmark，输出可观测指标，并与市面典型跨端框架进行架构和性能维度对比。

## 3. 产品矩阵

| 产品 | 定位 | 代码工程 |
|---|---|---|
| quickapp-runtime-core | 通用 C++ Runtime Core | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-core` |
| quickapp-runtime-js | JS Framework 与应用模型 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js` |
| quickapp-runtime-android | Android 后端与 NDK 首发宿主 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android` |
| quickapp-runtime-ios | iOS 后端与 UIKit 宿主 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios` |
| quickapp-runtime-lvgl | LVGL 嵌入式后端 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl` |
| quickapp-toolkit | CLI、RPK 构建、校验、调试工具链 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit` |
| quickapp-examples | 示例应用与验收输入 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples` |
| quickapp-benchmark | 可观测 benchmark 与对比体系 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-benchmark` |

## 4. 架构原则

### 4.1 Core owns semantics

Runtime Core 负责应用运行语义：

- RPK 加载
- Manifest 模型
- 应用生命周期
- 页面路由
- VNode/Shadow Tree
- Diff/Reconcile
- Style Resolve
- Layout
- Render Mutation
- Event Dispatch
- Capability Bridge

### 4.2 Backends own widgets

各端后端只负责平台承载：

- Android View
- iOS UIKit
- LVGL Object
- 后续嵌入式 UI 框架

平台后端不重新实现应用语义，只消费 Core 输出的渲染指令和能力调用。

### 4.3 Projects can be independent, contracts must be shared

各产品可以独立开发、独立构建、独立演进，但以下契约必须集中定义：

- RPK Contract
- Runtime Contract
- Render Backend Contract
- Capability Module Contract
- Event Contract
- Benchmark Protocol
- Compatibility Matrix

## 5. 三条核心通道

### 5.1 Render Channel

```text
QuickApp Template/Style
  -> VNode/Shadow Tree
  -> Diff/Reconcile
  -> Layout
  -> Render Mutation
  -> Render Backend
  -> Android / iOS / LVGL
```

### 5.2 Event Channel

```text
Native Event
  -> Platform Event Source
  -> Runtime Event Dispatcher
  -> JS Handler
```

### 5.3 Capability Channel

```text
$app_require$("@app-module/system.xxx")
  -> JS Module Proxy
  -> Capability Module Registry
  -> Platform Capability Provider
  -> Android / iOS / LVGL / Embedded Service
```

## 6. 能力插件体系

QuickApp Kit v2 需要将能力插件体系作为一等架构模块。

第一阶段实现 QuickApp Capability Module V1：

- 手动注册模块
- 懒加载模块实例
- JSON/Value 参数传递
- 同步返回与 callback 异步预留
- 能力发现
- unsupported / permission denied / invalid args 错误模型
- 示例模块：`system.router`、`system.prompt`、`system.device`

后续演进 QuickApp Capability Module V2：

- ModuleSpec / IDL
- Codegen
- Promise 标准化
- 权限声明检查
- 版本协商
- 动态插件包
- 低拷贝调用与批量调用

## 7. 开发路线

总体路线：

```text
Contract First
Android Incubation
Core Extraction
Embedded Validation
iOS Completion
Observable Benchmark
```

阶段划分：

| 阶段 | 目标 |
|---|---|
| Phase 0 | 总架构设计与核心契约设计 |
| Phase 1 | toolkit 与 runtime-js 并行建设 |
| Phase 2 | Android NDK 首发，跑通端到端主链路 |
| Phase 3 | 从 Android 验证链路中抽取 quickapp-runtime-core |
| Phase 4 | 接入 LVGL 后端，验证嵌入式可移植性 |
| Phase 5 | 接入 iOS 后端，验证移动端跨平台完整性 |
| Phase 6 | 建设 benchmark，输出可观测对比结果 |

## 8. 文档生产流程

v2 采用设计先行、spec 驱动、agent 落地的流程。

所有文档遵循 [DOC-WRITING-RULES.md](./DOC-WRITING-RULES.md)：

- 第一性
- 本质抽象
- 学会借鉴业内优点
- 金字塔原理
- 结论先行
- 每篇文档都有目录

```text
总需求设计
  -> 总架构设计
  -> 分产品设计
  -> 每个产品 spec 纵览
  -> 每个具体 spec 设计文档
  -> agent / 子 agent 开发实现
  -> 验收与 benchmark
```

文档层级建议：

```text
v2/
├── REQUIREMENTS.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── contracts/
├── decisions/
├── research/
├── benchmarks/
└── projects/
    ├── quickapp-runtime-core/
    ├── quickapp-runtime-js/
    ├── quickapp-runtime-android/
    ├── quickapp-runtime-ios/
    ├── quickapp-runtime-lvgl/
    ├── quickapp-toolkit/
    ├── quickapp-examples/
    └── quickapp-benchmark/
```

每个产品目录后续至少包含：

```text
README.md
OVERVIEW.md
SPEC.md
tasks.md
steps/
```

## 9. 首批设计产出

接下来优先产出以下文档：

1. `ARCHITECTURE.md`：QuickApp Kit v2 总架构。
2. `ROADMAP.md`：阶段路线、里程碑、验收口径。
3. `contracts/runtime-contract.md`：应用模型、生命周期、页面、事件、模块语义。
4. `contracts/render-backend-contract.md`：Core 到 Render Backend 的渲染契约。
5. `contracts/capability-module-contract.md`：TurboModule-like 能力插件契约。
6. `benchmarks/BENCHMARK.md`：可观测指标、采集方式、对比维度。

## 10. 成功标准

v2 主体成功标准：

1. 一套清晰可解释的总架构。
2. 一套产品矩阵与职责边界。
3. 一套共享契约体系。
4. Android 跑通首条端到端主链路。
5. Core 能从 Android 链路中抽取并被 LVGL 复用。
6. Capability Module 机制能支撑后续持续添加平台能力。
7. benchmark 能产出启动、首屏、JS、layout、render、bridge、内存等可观测指标。
