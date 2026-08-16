# QuickApp Kit v2 总 Spec Requirements

## 目录

- [1. 结论](#1-结论)
- [2. Phase 0 目标](#2-phase-0-目标)
- [3. Phase 1 输入](#3-phase-1-输入)
- [4. 总交付范围](#4-总交付范围)
- [5. 不做事项](#5-不做事项)
- [6. 验收标准](#6-验收标准)

## 1. 结论

总 Spec Requirements 定义 QuickApp Kit v2 从架构方案进入分项目设计与开发的准入条件。

Phase 0 要产出：

```text
清晰总架构
核心技术选型
关键决策
共享合同
子 Spec 拆分
分项目开发入口
```

## 2. Phase 0 目标

Phase 0 是架构与核心决策设计阶段。

目标：

1. 定义 QuickApp Kit v2 的平台定位。
2. 定义 One Runtime Core + Multiple Render Backends 的总体架构。
3. 定义 Android 先行、Core 抽取、LVGL 验证、iOS 补全的实施路线。
4. 定义 JS Framework、Runtime Core、Render Backend、Capability Module、Toolkit、Benchmark 的边界。
5. 定义核心 contracts。
6. 定义每个子项目 Spec 的输入、输出和验收口径。

## 3. Phase 1 输入

Phase 1 开始分项目开发前，至少需要：

1. 总 Spec 第一版。
2. Runtime Contract 第一版。
3. Render Backend Contract 第一版。
4. Capability Module Contract 第一版。
5. Android Runtime 子 Spec 第一版。
6. Runtime JS 子 Spec 第一版。
7. Toolkit 子 Spec 第一版。
8. Examples 验收输入定义。

## 4. 总交付范围

第一阶段总交付：

```text
Android first vertical chain
  -> Core extraction boundary
  -> LVGL SDL Simulator validation
  -> iOS integration plan
  -> CLI-first toolkit
  -> observable benchmark protocol
```

## 5. 不做事项

第一阶段不做：

1. 完整 QuickApp API 覆盖。
2. 完整 IDE。
3. 完整 TurboModule Codegen。
4. 动态插件包加载。
5. Flutter 式自绘引擎。
6. 全量设备形态覆盖。

## 6. 验收标准

1. 能解释每个项目为什么存在。
2. 能解释每个项目和其他项目的合同边界。
3. 能把工作拆给 agent 独立执行。
4. 能通过 Android 首发链路验证 Runtime Contract。
5. 能通过 LVGL SDL Simulator 验证 Core 跨端性。
6. 能通过 Benchmark Protocol 证明架构质量。
