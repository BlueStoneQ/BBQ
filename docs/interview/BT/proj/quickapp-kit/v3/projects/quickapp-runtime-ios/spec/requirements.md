# iOS Runtime 总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 项目使命](#2-项目使命)
- [3. 输入与输出](#3-输入与输出)
- [4. V1 功能需求](#4-v1-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 边界与后置项](#6-边界与后置项)

## 1. 结论

iOS Runtime 是共享 Core/JS Runtime 的 UIKit 宿主：**它只把 iOS 容器、View、输入、字体和系统能力适配为公共 typed contract，不建立 iOS 私有运行语义。**

iOS 总 Spec 与其他项目并行；产品集成验收排在 Android/LVGL V1 闭环之后。

## 2. 项目使命

```text
iOS App/Scene Host
  -> PackageSource + Runtime Host
  -> shared C++ Core + shared JS Runtime
  -> Objective-C++/C++ Platform Gateway
  -> UIKit Surface/Host/Input/Measure/Capability
```

UIKit 生命周期只提供 Host 信号，App/Page Hook 顺序仍由 Core/JS 公共状态机决定。

## 3. 输入与输出

### 3.1 输入

- 公共 `RuntimeLaunchProfile`，包含 Runtime RPK、Root route、params、viewport、Trace 输出和 target；以及 Host 前后台信号。
- Core 发出的 Surface create/present/visibility/close/destroy、Mount、Capability、Page Control typed command。
- Core Runtime Thread 发出的同步 `MeasureRequest`。
- UIKit 用户事件和平台执行结果。

### 3.2 输出

- iOS PackageSource 和 `RuntimeLifecycleControl`。
- Surface/Mount/Capability/Page Control、`MeasureResult(measured|failed)` 与字体 generation 通知。
- `PlatformInputMessage`。
- iOS 主线程、内存、布局、事件和生命周期 Trace。

## 4. V1 功能需求

| ID | 需求 |
|---|---|
| IOS-R01 | 提供 iOS Runtime Host，组合共享 Core/JS，管理 AppRuntime、Scene 前后台和 Root Surface。 |
| IOS-R02 | 从文件、Bundle 或 immutable data 实现 PackageSource，不向 Core 暴露 iOS 对象。 |
| IOS-R03 | 在本项目实现 Objective-C++/C++ Gateway，只传递公共 typed value、bytes 和 opaque ID。 |
| IOS-R04 | 实现 Surface Host 容器的 hidden create、root/push present、visibility、原子 close/reveal 和 destroy。 |
| IOS-R05 | 实现 `NodeId -> UIKit NativeHandle` 私有映射和 `View/Text/Button` Host Component。 |
| IOS-R06 | 严格消费 Core 最终 Layout Rect，不使用 Auto Layout 或控件 intrinsic size 覆盖结果。 |
| IOS-R07 | 实现 full/incremental Mount、Move、Remove 和递归 Host mapping 清理。 |
| IOS-R08 | 将 UIButton interaction 转换为标准 click PlatformInputMessage，不直接调用 JS。 |
| IOS-R09 | 提供 Core Runtime Thread 可同步调用的线程安全字体 metrics，不访问 UIView Tree；精确返回 measured/failed，字体变化投递严格递增 generation。 |
| IOS-R10 | 实现 prompt/device PlatformProvider 与 title/meta Page Host Control。 |
| IOS-R11 | 所有 UIKit 变更在主线程执行，结果异步投递 Core；禁止 Core 同步等待主线程。 |
| IOS-R12 | Scene/App 生命周期只映射为 `RuntimeLifecycleControl` 并等待 typed Result，不直接触发 Page Hook。 |
| IOS-R13 | Runtime Host 消费公共 `RuntimeLaunchProfile`；只在 root presented 后报告成功，失败返回稳定错误和非零退出，正常关闭返回零。 |
| IOS-R14 | 支持同一 Runtime RPK 的 Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001`，并输出与 Android/LVGL 可对照 Trace。 |
| IOS-R15 | Surface 销毁后清理 View、target/action、mapping、平台请求和跨语言引用。 |
| IOS-R16 | iOS Composition Root 必须选择且只选择一个 JS Engine Provider，只链接 iOS 所需 Platform/Provider/Component 模块并生成公共 Runtime Composition Manifest；共享 Core/JS 不包含 iOS feature flag 或 UIKit 条件分支。 |
| IOS-R17 | iOS Composition Root 注入 Noop 或 iOS `TraceSink` Adapter；平台 Collector 负责有界缓冲、平台指标和导出，不得让日志、文件 I/O 或分析逻辑进入 Core。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 边界 | UIKit、Foundation 对象不进入共享 Core/JS 公共头文件。 |
| 可组合 | 产品依赖选择集中在 iOS Composition Root；未选外围模块不得进入 App/native library 的链接清单。 |
| 线程 | UIKit 仅主线程；Measure 使用线程安全字体服务；跨层全异步。 |
| 语义 | Core Navigation 栈是权威，系统容器只执行 Present command。 |
| 资源 | 使用确定 ownership，避免跨语言引用环和 late callback use-after-free。 |
| 一致性 | Host Component、错误、输入、Surface 与 Android/LVGL 语义一致。 |
| 可观测 | Gateway、主线程任务和 Core 结果通过公共 ID 关联。 |

## 6. 边界与后置项

V1 不做：

- 用 UIKit Controller 生命周期替代公共 App/Page Hook 状态机。
- 用 UINavigationController 页面栈替代 Core Navigation Controller。
- 在 iOS 工程复制 Core、JS Framework、Artifact Loader。
- SwiftUI、完整系统组件、复杂文本、动画和手势。
- Release 签名、商店分发和完整平台权限产品化。
