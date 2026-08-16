# Android Runtime 总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 项目使命](#2-项目使命)
- [3. 输入与输出](#3-输入与输出)
- [4. V1 功能需求](#4-v1-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 边界与后置项](#6-边界与后置项)

## 1. 结论

Android Runtime 是共享 Core/JS Runtime 的跨平台复用与联盟兼容证明：**它把 Android 包、页面容器、View、输入、字体和系统能力适配为公共 typed contract，并验证同一 Artifact/Core/JS 不依赖 LVGL。**

Android 不拥有 Runtime Tree、Navigation 栈或 JS Framework，也不是 Core 的孵化代码仓库。

## 2. 项目使命

```text
Android App/Host
  -> PackageSource + Runtime Host
  -> shared C++ Core + shared JS Runtime
  -> JNI Platform Adapter
  -> Android Surface/View/Measure/Capability/Input
```

JNI 只属于 Android Platform Adapter，负责 typed message 和生命周期桥接，不承载业务协议设计。

## 3. 输入与输出

### 3.1 输入

- 公共 `RuntimeLaunchProfile`，包含 Runtime RPK、Root route、params、viewport、Trace 输出和 target。
- Core 发出的 Surface create/present/visibility/close/destroy、Mount、Capability、Page Control typed command。
- Core Runtime 发出的同步 `MeasureRequest`。
- Android 用户输入、Activity/Window 前后台变化和平台执行结果。

### 3.2 输出

- `PackageSource` 和 `RuntimeLifecycleControl`。
- Surface/Mount/Capability/Page Control、`MeasureResult(measured|failed)` 与字体 generation 通知。
- `PlatformInputMessage`。
- Android 平台 Trace、帧/内存/线程观测。

## 4. V1 功能需求

| ID | 需求 |
|---|---|
| AND-R01 | 提供 Android Runtime Host，组合共享 Core 与 JS Runtime，管理 AppRuntime 启停和 Root Surface 请求。 |
| AND-R02 | 从 Android 文件、Asset 或内存来源实现公共 `PackageSource`，不得向 Core 暴露平台流对象。 |
| AND-R03 | 在 Android 工程内实现 JNI Adapter；跨 JNI 只传递公共 typed value、bytes 或 opaque ID。 |
| AND-R04 | 实现 hidden-empty、hidden-mounted、visible、destroyed 的 Surface Host 与 UI 容器映射，并支持原子 `CloseSurfaceHost(source,reveal)`。 |
| AND-R05 | 实现 `NodeId -> Android NativeHandle` 映射和 `View/Text/Button` Host Component。 |
| AND-R06 | 严格按有序 Mount operations 创建、设值、布局、插入、移动和递归删除 Host 节点。 |
| AND-R07 | full Mount 必须清理 Surface Host Tree 后重建；Mount 完成不得自动展示 Surface。 |
| AND-R08 | root/push Present 必须满足原子视觉语义；失败不得改变 source 可见状态。 |
| AND-R09 | 为每次 Android click 生成不复用的 `RequestId`，并转换为 `PlatformInputMessage(requestId,surfaceId,nodeId,eventType,payload)`；不生成 HandlerId。 |
| AND-R10 | 提供线程安全字体 Measure Adapter；可在 Core Runtime Thread 同步调用且不访问 View Tree/UI Thread；精确返回 `measured(width,height)` 或 `failed(RuntimeError)`，字体变化投递递增 generation。 |
| AND-R11 | 实现 `system.prompt.showToast` 与 `system.device.getInfo` PlatformProvider。 |
| AND-R12 | 实现 `SetTitleBar/SetMeta` Page Host Control，并返回 typed Result。 |
| AND-R13 | 将 Host 前后台和销毁转换为 `RuntimeLifecycleControl` 并等待 typed Result；不得直接把 Activity 回调等同于 App/Page Hook。 |
| AND-R14 | 消费公共 `RuntimeLaunchProfile`；只在 Core 返回 root `CreateSurfaceResult(presented)` 后报告启动成功，失败返回稳定错误和非零退出，正常关闭返回零。 |
| AND-R15 | 所有 UI 变更在 Android UI Thread 执行，结果异步投递回 Core，Core 不同步等待 UI Thread。 |
| AND-R16 | 运行 Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001`，输出首屏、更新、事件、导航、能力、销毁和性能 Trace。 |
| AND-R17 | Android Composition Root 必须选择且只选择一个 JS Engine Provider，只链接 Android 所需 Platform/Provider/Component 模块并生成公共 Runtime Composition Manifest；共享 Core/JS 不包含 Android feature flag 或 JNI 条件分支。 |
| AND-R18 | Android Composition Root 注入 Noop 或 Android `TraceSink` Adapter；平台 Collector 负责有界缓冲、平台指标和导出，不得让日志、文件 I/O 或分析逻辑进入 Core。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 边界 | Android 类型仅存在本项目；共享 Core/JS 工程不反向依赖 Android。 |
| 可组合 | 产品依赖选择集中在 Android Composition Root；未选外围模块不得进入 APK/native library 的链接清单。 |
| 语义 | Host Component、logical-px、事件和 Surface 状态遵循公共合同，不用平台默认行为覆盖。 |
| 原子性 | Mount 遇到任一失败停止并返回 failed；不得跳过操作后报告成功。 |
| 线程 | UI 操作只在 UI Thread；Measure 不等待 UI Thread；JNI 调用有明确入队点。 |
| 资源 | Surface 销毁后容器、View、Listener、NativeHandle 和 JNI 引用全部释放。 |
| 可观测 | Android、JNI、Core 之间请求可通过公共 ID 和时间戳关联。 |

## 6. 边界与后置项

V1 不做：

- 在 Android 工程复制或实现 Runtime Tree、RPK Loader、JS Framework。
- 把 Android View、Context、JNI 引用传入公共 Core 合同。
- 全量联盟组件、系统能力、动画、手势和复杂文本。
- Release 签名策略和应用商店分发集成。
- 用 Android 特有页面栈替代 Core Navigation Controller。
