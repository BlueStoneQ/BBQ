# IOS-S01 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 非目标](#5-非目标)
- [6. 需求映射](#6-需求映射)

## 1. 结论

IOS-S01 必须证明：同一个合法启动配置能够被确定地装配为一个 AppRuntime；任一组成、Profile、包读取或启动步骤失败时，不产生半存活 Runtime；Scene 信号不越权触发 JS Hook。

## 2. 输入与输出

### 2.1 输入

- 公共 `RuntimeLaunchProfile`。
- 构建期 iOS Build Profile 和最终链接事实。
- 共享 Core/JS Runtime 工厂及冻结平台 Port。
- 文件 URL、Bundle resource URL 或 immutable Data。
- raw Scene active/background/disconnect signal 与显式 Host destroy 请求。
- 公共 `conformance + observationLevel` 观测配置。

### 2.2 输出

- 一个 immutable `RuntimeCompositionManifest` 及只读 describe 结果。
- 恰好一个被选中的 `JsEnginePort` Provider。
- 一个被选中的 `TraceSink`。
- 一个满足公共合同的 `PackageSource`。
- AppRuntime 启动结果：仅 Root `presented` 后成功，否则 typed `RuntimeError`。
- raw Scene signal 的前置去重结果，以及每个 accepted `RuntimeLifecycleControl` 的唯一 typed Result。
- 确定完成的销毁结果和资源释放证据。

## 3. 功能需求

| ID | 需求 |
|---|---|
| IOS-S01-R01 | Composition Root 必须选择且只选择一个 JS Engine Provider；V1 默认 QuickJS。 |
| IOS-S01-R02 | 必须按公共 Schema 生成 immutable Composition Manifest，并可将其与 link map/symbol inventory 对照。 |
| IOS-S01-R03 | `conformance=v1` 只能选择 `baseline/diagnostic` 并注入 Recording Adapter；`off` 仅允许 `custom` 且注入 Noop；`custom` 的 `baseline/diagnostic` 仍注入 Recording Adapter。 |
| IOS-S01-R04 | Host 必须严格校验 Launch Profile，拒绝非 iOS target、非法 viewport、非法 route/params 和未知字段，不修正公共语义。 |
| IOS-S01-R05 | Host 必须将 PackageSource、Manifest、Engine、Clock、Sink 和平台 Port 一次性装配给共享 Runtime，不复制 Loader 或 JS Framework。 |
| IOS-S01-R06 | 文件、Bundle 和 immutable Data source 均实现 `size/readAt/close`；读取结果为 immutable bytes，completion 回 Core queue。 |
| IOS-S01-R07 | 越界、短读、I/O 失败或 close 后读取统一返回 `PACKAGE_IO_ERROR`，每个 read 恰好完成一次。 |
| IOS-S01-R08 | Root `presented` 是启动成功的唯一判据；前序失败返回稳定错误，且完成逆序清理。 |
| IOS-S01-R09 | raw Scene active/background/disconnect 只映射为 `enterForeground/enterBackground/destroyAppRuntime`；连续重复 raw signal 可在生成 RequestId 前去重，去重不得生成公共请求或结果。 |
| IOS-S01-R10 | Host 一旦接受 control 并生成 `RequestId`，必须将该 immutable `RuntimeLifecycleControl` 原样投递 Core，禁止合并、替代或伪造成功；每个 accepted control 必须返回同 RequestId/action 的唯一 typed Result，Core 的 `LIFECYCLE_BUSY` 原样透传。 |
| IOS-S01-R11 | Runtime 销毁必须先停止接受新 Host 请求，等待 Core destroy 结果，再释放 PackageSource、Engine、Sink 和 Host owner；失败也必须最终释放。 |
| IOS-S01-R12 | Recording/Noop 观测只改变证据，不改变状态、结果、错误和调用顺序。 |

## 4. 质量需求

| 维度 | 要求 |
|---|---|
| 分层 | Foundation/UIKit 类型不得进入共享 Core/JS 公共接口。 |
| 所有权 | Host 独占 Runtime session；PackageSource 共享只读 bytes，不暴露 `Data`、URL、fd 或流对象给 Core。 |
| 线程 | raw Scene admission 在 Host executor；accepted control 逐条投递 Core，由 Core 串行化状态转换；Package I/O 在 I/O executor；completion 只投递 Core queue；不允许 Core 同步等待主线程。 |
| 原子性 | 装配成功后才发布 Runtime session；启动失败不得留下可接收请求的半成品。 |
| 可裁剪 | 未选择的 Engine、Sink、Provider 和平台模块不进入链接产物。 |
| 可测性 | 组成、Profile、包读取、生命周期和销毁必须可用 Fake Core/Engine/Sink 独立验证。 |

## 5. 非目标

- 不定义新的 Runtime/Profile/Composition/Observation 消息。
- 不解释 RPK、Manifest、Page IR 或 Bundle。
- 不直接调用 `onShow/onHide/onDestroy`。
- 不创建 UIKit View、Controller 栈或 Mount 映射。
- 不实现 Objective-C++ 转换、Collector 存储、Trace 导出和分析。
- 不实现后续 Release profile 的签名与信任策略。

## 6. 需求映射

| iOS 总需求 | IOS-S01 覆盖 |
|---|---|
| IOS-R01 | R05、R08-R11 |
| IOS-R02 | R06-R07 |
| IOS-R12 | R09-R10 |
| IOS-R13 | R04、R08、R11 |
| IOS-R16 | R01-R02、R05 |
| IOS-R17 | R03、R12 |
