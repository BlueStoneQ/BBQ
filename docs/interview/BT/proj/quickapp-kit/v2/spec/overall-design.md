# QuickApp Kit v2 总体设计

## 目录

- [1. 结论](#1-结论)
- [2. 项目拓扑](#2-项目拓扑)
- [3. 依赖关系](#3-依赖关系)
- [4. 主链路](#4-主链路)
- [5. 共享合同](#5-共享合同)
- [6. 验收闭环](#6-验收闭环)

## 1. 结论

QuickApp Kit v2 是一个 org 级项目矩阵。项目可以独立开发，但必须通过共享合同集成。

它的目标不是只交付 `runtime + toolkit`，而是通过 runtime、toolkit、contracts、governance、capability、benchmark 共同形成一套轻应用平台解决方案。

## 2. 项目拓扑

```text
quickapp-toolkit
  -> quickapp-examples
  -> quickapp-runtime-android
     -> quickapp-runtime-core
        -> quickapp-runtime-lvgl
        -> quickapp-runtime-ios
  -> quickapp-benchmark
```

并行项目：

```text
quickapp-runtime-js
quickapp-toolkit
quickapp-examples
```

## 3. 依赖关系

| 项目 | 依赖 |
|---|---|
| quickapp-runtime-android | runtime-js, examples, Runtime Contract |
| quickapp-runtime-core | 从 Android 验证链路抽离，遵循 Runtime Contract |
| quickapp-runtime-lvgl | runtime-core, Render Backend Contract |
| quickapp-runtime-ios | runtime-core, Render Backend Contract |
| quickapp-toolkit | RPK Contract, examples |
| quickapp-benchmark | examples, Android/LVGL/iOS runtime |

## 4. 主链路

```text
quickapp-toolkit build
  -> RPK
  -> Android Runtime
  -> JS Framework
  -> DOM Transaction
  -> Runtime Core
  -> MountTransaction
  -> Android Render Backend
  -> Native UI
```

Core 抽取后：

```text
Runtime Core
  -> Android Render Backend
  -> LVGL Render Backend + SDL Simulator
  -> iOS Render Backend
```

## 5. 共享合同

| 合同 | 状态 |
|---|---|
| Runtime Contract | 已完成第一版 |
| Render Backend Contract | 待写 |
| Capability Module Contract | 待写 |
| RPK Contract | 待写 |
| Permission Contract | 待写 |
| Compatibility Contract | 待写 |
| Ecosystem Governance Contract | 待写 |
| Context Service Contract | 待写 |
| Benchmark Protocol | 待写 |

## 6. 验收闭环

第一阶段验收闭环：

```text
同一 RPK
  -> Android 可运行
  -> Core 可抽取
  -> LVGL SDL Simulator 可运行
  -> iOS 可接入
  -> Benchmark 可观测
```
