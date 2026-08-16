# AND-S01 需求

## 目录
- [1. 结论](#1-结论)
- [2. 功能需求](#2-功能需求)
- [3. 质量需求](#3-质量需求)
- [4. 非目标与映射](#4-非目标与映射)

## 1. 结论
AND-S01 必须证明 Android 可以仅通过公共 Host/Core Port 装配并启动共享 Runtime，而且 Package bytes、生命周期和观测均不形成 Android 私有协议。

## 2. 功能需求
| ID | 需求 |
|---|---|
| AND-S01-R01 | Composition Root 必须选择且只选择一个 JS Engine Provider；V1 默认 QuickJS。 |
| AND-S01-R02 | S01 必须严格消费 immutable `RuntimeCompositionManifest` 和 build inventory，并拒绝 Schema、模块集合或 `binaryBytes` 不一致；最终 Manifest 生成与真实产物一致性由 AND-S08/AND-S09 验证。 |
| AND-S01-R03 | S01 隔离测试只证明 Composition Root 能拒绝错误清单，不把 Fake inventory 当作真实链接证据；APK/native link map 中 `runtime.js-framework` 恰好一次、Engine 恰好一个、未选外围未链接由 AND-S08/AND-S09 闭环。 |
| AND-S01-R04 | 注入 Noop 或 Android `TraceSink` Adapter；Sink 失败、关闭或丢样不得改变 Runtime 结果。 |
| AND-S01-R05 | 严格消费 `RuntimeLaunchProfile`，拒绝未知字段、非 Android target、非法 viewport/params/artifact。 |
| AND-S01-R06 | 将 Manifest、PackageSource、JS Runtime Service、TraceSink 和平台 Port 作为显式依赖装配进 Shared Core，不使用全局服务定位。 |
| AND-S01-R07 | 文件、Asset、内存来源统一实现公共 `size/readAt/close`；File Source 在 open 时固定持有一个只读文件资源，后续 read/close 不按 path 切换资源身份。 |
| AND-S01-R08 | `readAt` 异步完成到 Core 队列；每次读取恰好完成一次，返回 immutable bytes 或 `PACKAGE_IO_ERROR`。 |
| AND-S01-R09 | Root 只能由 Core 创建；仅 Root `presented` 才报告启动成功。 |
| AND-S01-R10 | 解码、组成、包、初始化、Mount 或 Present 失败必须返回稳定 `RuntimeError`，不得以 Activity/Window 成功替代。 |
| AND-S01-R11 | Android 前后台和销毁信号只能转换为公共 `RuntimeLifecycleControl`，并等待同 requestId/action 的结果。 |
| AND-S01-R12 | Host 不得直接调用 App/Page Hook，不维护第二套 AppRuntime、Page、Surface 或 Navigation 权威状态。 |
| AND-S01-R13 | 销毁先拒绝新请求，再请求 `destroyAppRuntime`；结果收口后关闭 PackageSource 并释放 Host 依赖。 |
| AND-S01-R14 | 重复或并发控制保留 Core 的 `LIFECYCLE_BUSY` 语义，Host 不合并为成功。 |
| AND-S01-R15 | 使用 Fake Core、Fake Package backend、Noop/Recording Sink 即可完成验收，不依赖 JNI/View。 |

## 3. 质量需求
| 维度 | 要求 |
|---|---|
| 分层 | Android 依赖 Shared Core/JS Port；Core/JS 不依赖 Android 类型。 |
| 所有权 | Package backend、Source、AppRuntime handle、Sink、Engine 均有唯一持有者和销毁点。 |
| 线程 | Host 回调不直接进入 Core；Package completion 与 lifecycle request 投递 Core queue。 |
| 资源 | 所有路径最终 close 同一已打开资源；路径替换不改变 File Source 身份；晚到 completion 不访问已销毁 Host。 |
| 可测试 | 组成错误、短读、越界、close race、Root 失败、busy 和 Sink 失败可注入。 |

## 4. 非目标与映射
不实现 JNI、Surface/View/Host Tree、Mount/Input/Measure/Provider、Core Loader、JS Framework、Collector、Trace 存储与 Release 签名。

| 项目总需求 | 本分 Spec |
|---|---|
| `AND-R01` | R06、R09、R11-R13 |
| `AND-R02` | R07、R08、R13 |
| `AND-R13` | R11、R12、R14 |
| `AND-R14` | R05、R09、R10 |
| `AND-R17` | R01-R03、R06 |
| `AND-R18` | R04、R15 |
