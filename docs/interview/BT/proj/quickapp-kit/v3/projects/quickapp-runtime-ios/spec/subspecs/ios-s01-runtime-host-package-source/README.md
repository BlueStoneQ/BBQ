# IOS-S01 Runtime Host 与 PackageSource

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 依赖](#3-依赖)
- [4. 交付与状态](#4-交付与状态)
- [5. 阅读顺序](#5-阅读顺序)

## 1. 结论

IOS-S01 只建立 iOS Runtime 的**组成、启动和包字节入口**：Composition Root 决定装配什么，Runtime Host 决定何时创建和销毁一个 AppRuntime，PackageSource 向 Core 提供不可变随机读取字节。

它不拥有 Runtime 业务状态机，也不实现 Gateway、UIKit Surface/Mount/Input/Measure/Provider。Scene 生命周期与 Runtime 生命周期必须分离：原始 Scene signal 可在生成 `RequestId` 前去重；一旦 Host 接受并生成公共 `RuntimeLifecycleControl`，必须原样进入 Core 并返回唯一 typed Result。Core 是 App/Page 生命周期的唯一协调者。

## 2. 范围

### 2.1 本分 Spec 负责

- iOS Composition Root 与唯一 JS Engine Provider 选择。
- 生成并暴露公共 `RuntimeCompositionManifest`。
- 按 `(conformance, observationLevel)` 选择 Sink：仅 `custom/off` 使用 `NoopTraceSink`，`baseline/diagnostic` 使用 iOS Recording `TraceSink` Adapter。
- 严格消费 `RuntimeLaunchProfile`。
- 装配共享 Core、共享 JS Runtime 与平台端口。
- Scene/Host control 入口、启动完成和销毁协调。
- 文件、Bundle 资源和 immutable Data 三类 `PackageSource`。

### 2.2 本分 Spec 不负责

- Objective-C++ Gateway：IOS-S02。
- UIKit Surface：IOS-S03。
- Mount 与 Host Components：IOS-S04。
- Input：IOS-S05。
- Measure：IOS-S06。
- Provider 与 Page Control：IOS-S07。
- 完整集成：IOS-S08。
- Collector、Case 和观测证据：IOS-S09。

## 3. 依赖

- [Runtime Launch Profile](../../../../../spec/contracts/runtime-launch-profile.md)
- [Runtime Composition](../../../../../spec/contracts/runtime-composition-contract.md)
- [Observation](../../../../../spec/contracts/observation-contract.md)
- [Artifact 与 PackageSource](../../../../../spec/contracts/artifact-contract.md#8-packagesource-与-loader)
- [App/Page Lifecycle](../../../../../spec/contracts/application-lifecycle-contract.md)
- [Threading](../../../../../spec/contracts/lifecycle-and-threading.md)
- [公共 Schema](../../../../../spec/contracts/schemas/README.md)
- [iOS 项目总 Spec](../../README.md)

## 4. 交付与状态

固定交付：本文件、[需求](./requirements.md)、[设计](./design.md)、[任务](./tasks.md)、[验收](./acceptance.md)。

当前状态：`READY_FOR_REVIEW`；产品代码仍为 `CODE_BLOCKED`。

## 5. 阅读顺序

1. 本文件确认边界。
2. `requirements.md` 确认输入、输出和非目标。
3. `design.md` 冻结对象、状态、线程、所有权和错误。
4. `tasks.md` 指挥后续编码。
5. `acceptance.md` 定义放行证据。
