# AND-S01 Runtime Host 与 PackageSource

## 目录
- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 输入与输出](#3-输入与输出)
- [4. 依赖与状态](#4-依赖与状态)

## 1. 结论
AND-S01 将 Android 收敛为共享 Runtime 的**组成入口和生命周期控制入口**：Composition Root 校验构建系统提供的组成事实，Runtime Host 消费公共启动合同，PackageSource 固定持有打开时的不可变包资源，Shared Core 决定 AppRuntime、Root Surface 和生命周期结果。

Android Host 不解释 RPK、DSL、Page IR，不复制 Core 状态机，也不拥有 JNI、Surface、Mount、View、Input、Measure 或 Provider 实现。

## 2. 范围
负责：Android Composition Root、唯一 JS Engine Provider、`RuntimeCompositionManifest`、Noop/Android `TraceSink` 选择、`RuntimeLaunchProfile` 消费、Shared Core/JS 装配、Root 启动、文件/Asset/内存 PackageSource、`RuntimeLifecycleControl` 入口和销毁收口。

不负责：`AND-S02..S07` 的 JNI Gateway、Surface/Mount、View、Input、Measure、Provider，以及 `AND-S09` 的 Collector、存储和导出。

## 3. 输入与输出
| 类别 | 内容 |
|---|---|
| 输入 | `RuntimeLaunchProfile`、构建期模块选择、嵌入的 Composition Manifest、Host 信号、包位置或内存 bytes |
| 输出 | `PackageSource`、Core 装配依赖、Root 启动结果、`RuntimeLifecycleControl` 请求和最终结果 |
| 唯一成功边界 | Root `CreateSurfaceResult(status=presented)` |
| 失败 | 公共 `RuntimeError`；进程 launcher 映射为非零退出状态 |

## 4. 依赖与状态
- [Runtime Launch Profile](../../../../../spec/contracts/runtime-launch-profile.md)
- [Runtime Composition](../../../../../spec/contracts/runtime-composition-contract.md)
- [Artifact 与 PackageSource](../../../../../spec/contracts/artifact-contract.md)
- [App/Page 生命周期](../../../../../spec/contracts/application-lifecycle-contract.md)
- [线程合同](../../../../../spec/contracts/lifecycle-and-threading.md)
- [Observation](../../../../../spec/contracts/observation-contract.md)
- [Error](../../../../../spec/contracts/error-contract.md)
- [Android 总 Spec](../../architecture.md)

当前状态：`READY_FOR_REVIEW`；AND-S01 定向返修已完成，AND-S02 仍由工作看板阻塞。S01 只提交隔离实现证据，真实 APK/native 组成证据由 AND-S08/AND-S09 闭环。阅读顺序：[需求](./requirements.md) -> [设计](./design.md) -> [任务](./tasks.md) -> [验收](./acceptance.md)。
