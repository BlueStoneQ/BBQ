# 嵌入式应用平台架构大纲解读

> 文档定位：解释能力建设大纲的核心目标、技术边界及其对 QuickApp Kit 的要求。  
> 解读原则：区分“原文明确要求”与“基于原文的架构推导”，不把推导表述成原文。

## 目录

- [1. 结论先行](#1-结论先行)
- [2. 原文明确要求](#2-原文明确要求)
- [3. 大纲的核心不是单一 Runtime](#3-大纲的核心不是单一-runtime)
- [4. “异构”的含义与依据](#4-异构的含义与依据)
- [5. 下一代嵌入式应用平台的核心特征](#5-下一代嵌入式应用平台的核心特征)
- [6. 平台核心领域模型](#6-平台核心领域模型)
- [7. QuickApp Kit 的定位](#7-quickapp-kit-的定位)
- [8. V1 范围与长期边界](#8-v1-范围与长期边界)
- [9. 能力建设重点](#9-能力建设重点)

## 1. 结论先行

大纲的核心目标是：

> 设计并落地一套面向移动 OS 与嵌入式设备的下一代应用平台和生态体系。

它要求的不只是跨端 UI 框架，也不只是 QuickApp Runtime，而是覆盖应用完整生命周期的平台架构：

```text
应用定义
→ 应用接入
→ 容器加载
→ Runtime运行
→ UI渲染
→ 系统能力调用
→ 应用/服务/Agent/工具协同
→ 权限与上下文管理
→ 调试、分发、兼容和治理
```

QuickApp Kit 是这套能力建设的核心落地项目：Runtime 和渲染框架负责建立技术深度，应用模型、能力体系、插件、上下文、工具链、兼容与治理负责形成平台完整性。

## 2. 原文明确要求

大纲明确提出以下能力：

| 原文方向 | 要求本质 |
|---|---|
| 下一代嵌入式应用生态 | 不是单个应用，而是可持续建设的平台和生态 |
| 多端场景和穿戴等设备形态 | 应用架构需要覆盖多种设备 |
| 应用运行机制 | 定义应用如何加载、启动、调度、渲染和退出 |
| 能力接入体系 | 将系统、设备和服务能力标准化开放给应用 |
| 应用模型 | 定义 Application、Page、Service、Surface 等核心对象 |
| 插件机制 | 支持平台能力独立扩展和演进 |
| 服务协同机制 | 支持应用与系统服务、端侧服务协作 |
| 应用容器 | 提供隔离、生命周期、资源和平台承载 |
| 账号权限 | 建立身份、授权、检查和审计边界 |
| 数据与上下文协同 | 支持应用、页面、服务和 Agent 之间受控传递上下文 |
| 调试与开发工具链 | 建设应用接入、构建、调试、分析和验证入口 |
| 应用接入标准和生态规则 | 让平台具备规模化接入和治理能力 |
| 兼容性和演进机制 | 支持 Runtime、API、设备和应用长期升级 |
| 应用、Agent、工具、服务协同 | 支持超越传统 GUI 页面的下一代应用形态 |

大纲还明确列出手机、IoT、车载、穿戴和大屏，并要求处理不同设备形态下的能力差异与适配问题。

## 3. 大纲的核心不是单一 Runtime

Runtime 是平台执行内核，但不是平台全部。

```text
嵌入式应用平台
├── 应用生态层
│   ├── 接入标准
│   ├── 分发
│   ├── 兼容策略
│   └── 生态治理
├── 应用平台层
│   ├── 应用模型
│   ├── Capability体系
│   ├── 插件机制
│   ├── 服务与Agent协同
│   ├── 权限
│   └── Context体系
├── Runtime层
│   ├── Package加载
│   ├── JS Runtime
│   ├── 生命周期
│   ├── 路由
│   └── 调度
├── Render层
│   ├── Runtime Tree
│   ├── Style/Layout
│   ├── MountTransaction
│   └── 多平台Backend
└── 工具与质量层
    ├── Toolkit
    ├── Debug/Trace
    ├── Compatibility Test
    └── Benchmark
```

因此项目定位应是：

```text
Runtime Framework as Core
Application Platform as Goal
Ecosystem Evolution as Outcome
```

## 4. “异构”的含义与依据

### 4.1 原文是否直接使用“异构”

没有。大纲原文没有直接写“异构”二字。

“异构嵌入式设备”是根据以下原文要求做出的架构归纳：

- 多端场景，覆盖穿戴等设备形态；
- 熟悉嵌入式系统、移动端或 IoT 设备的软件架构特点；
- 处理不同设备形态下的能力差异与适配问题；
- 具备手机、IoT、车载、穿戴、大屏等多端平台架构经验。

因此，“异构”是合理推导，不是原文术语。

### 4.2 异构具体指什么

这里的异构不是只指不同 CPU 指令集，而是设备在多个维度上的系统性差异：

| 差异维度 | 示例 | 对平台架构的影响 |
|---|---|---|
| OS与内核 | Android、iOS、NuttX、Linux、RTOS | 线程、进程、文件、网络和生命周期不同 |
| CPU与计算能力 | ARM MCU、ARM64 SoC、DSP/NPU | Runtime体积、执行性能和任务调度不同 |
| 内存与存储 | 数百KB到数GB | Tree结构、缓存、资源加载和应用数量不同 |
| 图形能力 | GPU、自绘、Framebuffer、SPI屏 | 渲染Backend、刷新和动画能力不同 |
| UI系统 | Android View、UIKit、LVGL | Host Node、文本测量和控件能力不同 |
| 屏幕形态 | 手机、圆形手表、车机、大屏 | 布局、密度、多Surface和信息层级不同 |
| 输入方式 | 触摸、旋钮、按键、遥控、语音 | 事件模型和焦点系统不同 |
| 系统能力 | GPS、蓝牙、相机、传感器、账号 | Capability可用性和权限不同 |
| 网络环境 | 常在线、间歇连接、离线 | 包加载、服务调用、缓存和恢复不同 |
| 功耗和实时性 | 手机交互、手表低功耗、车载实时任务 | 调度优先级、后台运行和资源预算不同 |

“异构”的本质是：

> 同一个应用平台必须面对能力、资源、交互和系统机制不一致的设备，而不能假设所有设备只是屏幕尺寸不同。

### 4.3 平台如何处理异构

平台不应通过大量业务条件分支处理设备差异，而应建立统一模型：

```text
Application Requirements
        ↓
Device Profile
        ↓
Capability Negotiation
        ↓
正常运行 / Backend替换 / 能力降级 / 拒绝运行
```

建议的平台对象：

```cpp
struct DeviceProfile {
  DeviceClass device_class;
  DisplayCapabilities display;
  InputCapabilities input;
  ResourceBudget resources;
  RenderCapabilities rendering;
  CapabilitySet capabilities;
};
```

这属于对大纲“设备能力差异与适配”的工程化表达。

## 5. 下一代嵌入式应用平台的核心特征

| 特征 | 相比传统方式的升级 |
|---|---|
| 统一应用模型 | 从每个设备单独开发，升级为一个应用模型覆盖多设备 |
| 平台无关Runtime | 从平台专用运行时，升级为共享语义和可替换Host |
| 声明式设备需求 | 从业务代码判断设备，升级为Manifest声明和能力协商 |
| Capability开放体系 | 从硬编码系统API，升级为可发现、可授权、可版本化能力 |
| 插件化扩展 | 从整体固件升级，升级为模块和Provider独立演进 |
| 多应用形态 | 从单一页面应用，升级为页面、卡片、服务和工具等形态 |
| 服务与Agent协同 | 从用户手动操作页面，升级为应用、服务、Agent、工具协作 |
| Context协同 | 从孤立应用数据，升级为受权限和生命周期管理的上下文 |
| 资源治理 | 从能运行即可，升级为内存、CPU、帧和后台预算治理 |
| 标准与兼容 | 从版本强绑定，升级为Feature Discovery、协商和降级 |
| 工具与可观测 | 从日志调试，升级为构建、校验、Trace、Benchmark和质量门禁 |
| 生态治理 | 从少量内置应用，升级为可接入、可分发、可审核的生态体系 |

“下一代”并不等于单独采用 C++、QuickJS、先进 Diff 或 AI。它的本质是：

> 将多设备差异、系统能力、应用扩展和生态演进收敛到平台，使应用能够通过稳定契约运行、协同和持续升级。

## 6. 平台核心领域模型

### 6.1 Application Model

```text
Application
├── Identity
├── Package/RPK
├── Manifest
├── RuntimeVersion
├── Entry
├── Pages/Surfaces
├── Components
├── DeclaredCapabilities
├── Permissions
├── Services/Tools
├── ContextPolicy
├── ResourceBudget
└── DeviceRequirements
```

Application 应是平台第一核心对象；Node 和 Runtime Tree 是应用执行过程中的内部结构。

### 6.2 Capability Model

```text
Capability
├── Name
├── Version
├── Schema
├── Provider
├── Permission
├── Availability
├── InvocationMode
├── ResourceCost
└── Fallback
```

统一承载：

```text
system.*
device.*
service.*
agent.tool.*
```

### 6.3 Context Model

```text
DeviceContext
→ UserContext
→ AppContext
→ PageContext
→ ServiceContext
→ AgentContext
```

Context 必须定义可见范围、权限、生命周期、传播和清理规则，不能退化成全局 Map。

### 6.4 Evolution Model

平台需要明确：

- 新 Runtime 如何兼容旧应用包；
- 新能力如何被发现；
- 缺失能力如何降级；
- 插件版本如何协商；
- 不同 Device Profile 如何匹配；
- 应用、API 和生态规则如何灰度演进。

## 7. QuickApp Kit 的定位

QuickApp Kit 应建设成面向移动 OS 与嵌入式设备的轻应用平台解决方案：

| 平台能力 | QuickApp Kit 承载 |
|---|---|
| 应用模型 | RPK、Manifest、App/Page/Surface/Component |
| 应用运行机制 | JS Runtime、生命周期、路由、调度 |
| 平台无关内核 | C++ Runtime Core、Runtime Tree、Layout、Revision |
| 多端呈现 | Android、iOS、LVGL Render Backend |
| 能力接入 | Capability Module、Provider、Invoker |
| 插件机制 | ModuleSpec、Registry、Codegen、版本协商 |
| 服务与Agent协同 | `service.*`、`agent.tool.*` |
| 设备差异 | Device Profile、Feature Discovery、Fallback |
| 权限与上下文 | Manifest权限、Permission Hook、Context体系 |
| 开发者入口 | CLI-first Toolkit、后续IDE封装 |
| 接入与治理 | 包校验、兼容矩阵、生态规则 |
| 质量度量 | Trace、Metrics、Benchmark |

Runtime 和渲染管线需要做深，因为它们证明平台具备真实技术内核；但项目不能长期停留在 Node、Diff、Bridge 和 Backend。

## 8. V1 范围与长期边界

平台视角完整，不代表 V1 实现全部能力。V1 应作为平台架构的最小纵向切片：

```text
标准RPK
→ Toolkit构建与校验
→ Container加载
→ JS Runtime执行
→ C++ Core运行
→ Android/LVGL渲染
→ 最小Capability调用
→ Trace和Benchmark验证
```

V1 实现：

- 标准应用包加载和基础 Manifest；
- App/Page/Surface 最小应用模型；
- 首次渲染、事件、状态更新完整闭环；
- Android 和 LVGL 两个后端；
- 最小 `system.router`、`system.prompt`、`system.device`；
- Feature Discovery 和 unsupported fallback；
- 基础启动、渲染、内存和事件指标。

V1 只预留而不完整实现：

- 完整账号与权限体系；
- 动态插件包和插件市场；
- 完整服务编排和 Agent 体系；
- 完整生态分发与审核；
- 多设备 Context 协同；
- 全量系统能力 API。

判断标准：

> V1 可以能力有限，但其核心对象、Contract 和扩展边界不能阻止后续平台能力自然生长。

## 9. 能力建设重点

需要形成三类能力，并通过项目和文档共同证明：

### 9.1 平台视角

- 从 Application 而不是 Node 开始建模；
- 能划分平台、Runtime、Backend 和系统能力边界；
- 能设计接入、扩展、治理和演进机制；
- 能处理多种设备形态的能力差异。

### 9.2 核心技术深度

- JS Runtime、事件循环和线程模型；
- Template IR、Runtime Tree、Dirty、Layout、Commit；
- Render Backend 和 Host Tree 所有权；
- Capability、插件和跨层调用；
- 资源预算、可观测和性能验证。

### 9.3 架构落地

- 总架构形成稳定 Contract；
- 分项目 Spec 能被独立实现和验收；
- Android、LVGL、iOS 复用同一 Core；
- 同一个 RPK 在多端保持一致语义；
- Benchmark 能证明性能、资源和平台差异来源。

最终主线是：

> 应用如何在不同设备形态上被定义、接入、运行、扩展、协同、治理和持续演进；QuickApp Runtime 是这条主线中最需要做深并跑通的执行内核。
