# LV-S02 Runtime Host 与 Backends

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 两个固定 Profile](#3-两个固定-profile)
- [4. 依赖与交付](#4-依赖与交付)
- [5. 状态](#5-状态)

## 1. 结论

LV-S02 只建立一个平台装配与控制壳：**Composition Root 在构建期静态选择唯一 Core/JS/Engine/Trace/Backend 组合；Runtime Host 在运行期严格消费 Launch Profile，提供 PackageSource，并把生命周期控制转交 Core。**

它不拥有页面、树、渲染或事件语义。SDL、libuv 和内建 Backend 只实现 LV-S01 的基础显示、原始输入、调度和唤醒边界；完整可点击 SDL Runtime 由 LV-S08 集成。

## 2. 范围

包含：

- LVGL Product Composition Root 与 immutable `RuntimeCompositionManifest`。
- 共享 Core、共享 JS Framework、恰好一个 Engine Provider 的显式装配。
- `RuntimeLaunchProfile` 严格消费、Host 状态机和 root `presented` 成功边界。
- 文件型与内存型 `PackageSource`。
- `RuntimeLifecycleControl` 的 admission、关联和结果收口。
- `lvgl-simulator-dev` 的 SDL Display/Raw Input 与 libuv owner-loop Backend。
- `lvgl-embedded-min` 的内建协作式 loop 与设备回调型 Display/Raw Input Backend。
- 单一 `TraceSink` 选择、确定销毁、背压和裁剪边界。

不包含：Surface、Mount、Host Component、标准 Input/Event 映射、Measure、Capability、Collector、截图、完整 Simulator 或 Case 集成。

## 3. 两个固定 Profile

| Profile | 固定选择 | 不得进入产物 |
|---|---|---|
| `lvgl-simulator-dev` | QuickJS、diagnostic Trace Adapter、libuv loop、SDL display/raw input、file PackageSource | 内建设备 driver |
| `lvgl-embedded-min` | QuickJS、baseline Trace Adapter、内建协作式 loop、设备回调 display/raw input、memory PackageSource | SDL、libuv、文件 PackageSource、fault/diagnostic-only 模块 |

两者均为 `conformance=v1`，因此最终产物都必须保留固定 Kernel、一次 JS Framework、`View/Text/Button`、`system.router/prompt/device` 和 baseline Observation。`min` 表示裁掉非 V1 必需外围，不表示裁掉三大系统或 V1 一致性能力。

## 4. 依赖与交付

依赖：

- [LV-S01 Backend Ports](../lv-s01-backend-ports/README.md)
- [Runtime Composition Contract](../../../../../spec/contracts/runtime-composition-contract.md)
- [Runtime Launch Profile Contract](../../../../../spec/contracts/runtime-launch-profile.md)
- [Lifecycle And Threading Contract](../../../../../spec/contracts/lifecycle-and-threading.md)
- [App And Page Lifecycle Contract](../../../../../spec/contracts/application-lifecycle-contract.md)
- [Runtime Artifact Contract](../../../../../spec/contracts/artifact-contract.md)
- [Observation Contract](../../../../../spec/contracts/observation-contract.md)
- [LVGL Runtime 总体架构](../../architecture.md)

交付：[需求](./requirements.md)、[设计](./design.md)、[任务](./tasks.md)、[验收](./acceptance.md)。

## 5. 状态

分 Spec 已完成，当前 `READY_FOR_REVIEW`。未通过总架构校审前不得编码 LV-S02，也不得启动 LV-S03。
