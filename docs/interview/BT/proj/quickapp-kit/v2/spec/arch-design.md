# QuickApp Kit v2 总 Spec 架构设计

## 目录

- [1. 结论](#1-结论)
- [2. 本质问题](#2-本质问题)
- [3. 总体架构](#3-总体架构)
- [4. 核心模块](#4-核心模块)
- [5. 实施路线](#5-实施路线)
- [6. 关键决策](#6-关键决策)
- [7. 重点吸收点](#7-重点吸收点)

## 1. 结论

QuickApp Kit v2 总 Spec 采用：

```text
Contract First
Android Incubation
Core Extraction
LVGL Validation
iOS Completion
CLI-first Toolkit
Observable Benchmark
```

## 2. 本质问题

QuickApp Kit v2 要解决的是轻应用运行平台的四个本质问题：

1. 应用产物如何被加载和校验。
2. 应用语义如何跨端一致执行。
3. UI 语义如何映射到不同平台控件。
4. 系统能力如何通过插件机制开放。

## 3. 总体架构

```text
RPK / Manifest
  -> JS Framework
  -> Runtime Core
  -> Render Backend
  -> Android / iOS / LVGL

JS system.* call
  -> Capability Module
  -> Platform Capability Provider
```

## 4. 核心模块

| 模块 | 职责 |
|---|---|
| RPK Contract | 包结构、manifest、资源、兼容性 |
| JS Framework | QuickApp JS 模型、Logical DOM、系统模块代理 |
| Runtime Core | App/Page/Surface、Shadow Tree、Transaction、Router、Lifecycle |
| Render Backend | Android / iOS / LVGL 控件映射 |
| Capability Module | TurboModule-like 能力接入 |
| Toolkit | CLI 构建、校验、运行、inspect |
| Benchmark | 启动、首屏、JS、layout、render、bridge、内存指标 |

## 5. 实施路线

```text
1. Android 先走通主链路。
2. 从 Android 链路中抽离平台无关 Core。
3. 基于 Core 开发 LVGL 后端和 SDL Simulator。
4. 基于 Core 开发 iOS 后端。
5. Toolkit 并行提供 CLI-first 构建和验证能力。
6. Benchmark 贯穿架构验收。
```

## 6. 关键决策

### KD-SPEC-001：总 Spec 作为执行合同

结论：总 Spec 不只是架构说明，而是分项目开发前的执行合同。

### KD-SPEC-002：Android 是孵化场

结论：Android 用于首发验证真实链路，但不能成为 Core 架构中心。

### KD-SPEC-003：LVGL 是第二端验证

结论：LVGL + SDL Simulator 用于证明 Core 具备嵌入式可移植性。

### KD-SPEC-004：每个项目一个子 Spec

结论：org 级项目矩阵中，每个项目都有独立 Spec，但共享 contracts。

## 7. 重点吸收点

1. 总 Spec 解决“如何把架构变成可执行项目矩阵”。
2. Android 先行是工程策略，不是架构妥协。
3. Core 抽取的判断标准是平台无关，而不是代码语言。
4. LVGL 的价值是验证嵌入式方向。
5. Toolkit 的 CLI 内核是后续 IDE 的地基。
