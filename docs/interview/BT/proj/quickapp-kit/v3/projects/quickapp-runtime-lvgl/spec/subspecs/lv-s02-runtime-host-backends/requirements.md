# LV-S02 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 非目标](#5-非目标)
- [6. 总需求映射](#6-总需求映射)

## 1. 结论

LV-S02 必须证明：**同一 Host 控制逻辑可以装配桌面和嵌入式两种静态产物，二者只替换外围 Backend，不复制 Core/JS，不引入第二套 Runtime 状态。**

## 2. 输入与输出

### 2.1 输入

- 公共 `RuntimeLaunchProfile(target=lvgl)`。
- 构建期 LVGL Build Profile、实际模块 inventory 与最终 `binaryBytes`。
- 共享 Core factory、共享 JS Runtime factory 和 QuickJS Provider。
- LV-S01 `OwnerTaskQueue/BackendClock/WakeupPort/DisplayBackend/InputBackend`。
- 文件包、immutable memory package 或设备内建 package registry。
- raw resume/suspend/shutdown 信号。

### 2.2 输出

- immutable `RuntimeCompositionManifest` 及同源只读 `describeComposition()`。
- 恰好一个选中的 `JsEngineProvider` 和一个 `TraceSink`。
- 一个 Runtime Session：Core/JS/PackageSource/Backend 的显式所有权集合。
- root 启动 typed result、`RuntimeLifecycleControlResult` 和确定关闭结果。
- SDL/libuv 或 embedded builtin Backend 的独立合同证据。

## 3. 功能需求

| ID | 需求 |
|---|---|
| LV-S02-R01 | Composition Root 必须从一个编译期 Build Profile 构造 immutable 依赖图；不得通过 Service Locator、运行时插件扫描或环境变量替换模块。 |
| LV-S02-R02 | 每个产物必须链接固定六个 Kernel module、恰好一次 `runtime.js-framework` 和恰好一个 Engine module；V1 两个 Profile 均选择 QuickJS，descriptor 必须与 Manifest 的 `jsEngine` 完全一致，失败不得 fallback。 |
| LV-S02-R03 | Manifest 只能由实际 build inventory 生成；module identity 唯一，`components/capabilities/observationLevel/binaryBytes` 必须描述真实产物。缺少后续 V1 模块时构建失败，不得生成声称可运行的部分 Manifest。 |
| LV-S02-R04 | LV-S02 的 Fake inventory 只验证组合算法；真实 link map、symbol inventory、体积和双 Profile 最终证据由 LV-S09 收口，不得用 Fake 冒充产品链接证据。 |
| LV-S02-R05 | Host 严格消费公共 Launch Profile，拒绝未知字段、非 `lvgl` target、非法 viewport/params/route/artifact；Build Profile 由当前二进制冻结，Launch Profile 不选择 Engine 或 Backend。 |
| LV-S02-R06 | Host 必须显式装配 Manifest、PackageSource、Core、JS Runtime、Engine Provider、Clock、TraceSink 与 Platform Port；不得复制 Core Loader、JS Framework 或 Runtime Tree。 |
| LV-S02-R07 | 文件和内存来源统一实现 `size/readAt/close`；bytes immutable，completion 恰好一次并投递 Core queue；越界、溢出、短读、close 后读取返回 `PACKAGE_IO_ERROR`。 |
| LV-S02-R08 | File PackageSource 在 open 时固定持有同一个只读文件资源，后续读取不得按 path 重开；Memory PackageSource 在构造时固定 immutable storage，调用方后续修改不得影响结果。 |
| LV-S02-R09 | Root 只能由 Core 创建；Host 只有收到 root `CreateSurfaceResult(status=presented)` 才报告启动成功。Backend open、SDL window、首帧或 JS Engine 创建均不是成功边界。 |
| LV-S02-R10 | Host 只维护装配状态；AppRuntime、Page、Surface、Navigation、foreground/background 的权威状态只在 Core。 |
| LV-S02-R11 | raw Host 信号只能在 admission 前去重；一旦生成 `RequestId` 并接受，必须逐条投递公共 `RuntimeLifecycleControl`，等待同 requestId/action 的唯一结果，不得合并或直接调用 JS Hook。 |
| LV-S02-R12 | `lvgl-simulator-dev` 固定选择 libuv owner-loop、SDL Display、SDL Raw Input、File PackageSource、QuickJS 和 diagnostic LVGL Trace Adapter。 |
| LV-S02-R13 | `lvgl-embedded-min` 固定选择 caller-owned 内建协作式 loop、设备回调 Display/Raw Input、Memory PackageSource、QuickJS 和 baseline LVGL Trace Adapter；不得要求线程、文件系统、SDL 或 libuv。 |
| LV-S02-R14 | libuv、SDL 和设备 driver 只依赖 LVGL Platform/Foundation Port，不得进入共享 Core、JS Framework、Runtime ABI 或公共消息。 |
| LV-S02-R15 | Host 创建时冻结 task/input 容量、pump budget、stop policy 和 BackendSet；运行期不得扩容或切换 Backend。 |
| LV-S02-R16 | `OwnerTaskQueue.post=busy` 时不得 spin 或阻塞；未转移的 task 由上游保留，并在后续外层 turn 做有界重试。`full` 必须形成明确背压/失败，不得静默丢失。 |
| LV-S02-R17 | 两个 V1 Profile 必须选择 LVGL Trace Adapter；Noop 只用于 `custom/off` 或行为等价测试。Sink 不存储、不做文件 I/O、不回调 Runtime；Collector 属于 LV-S09。 |
| LV-S02-R18 | 关闭必须先停止新 Host admission，再请求 Core `destroyAppRuntime`，保持 owner pump 直至 typed result 收口，然后关闭 PackageSource/Backend 并释放 Provider/Clock/Sink；JS Service/Engine 由 Core AppRuntime teardown 先行释放，晚到 callback 不得复活 Session。 |
| LV-S02-R19 | 任一组成、Profile、Package、Engine、Backend 或 root 失败都返回稳定 typed error，逆序清理已创建资源，不发布半存活 Session。 |
| LV-S02-R20 | 本分 Spec只通过 Fake Core/JS/Engine/Sink 和 standalone Backend 验证 Host；不得实现 Surface、Mount、标准 Input/Event、Measure、Capability 或 Collector。 |

## 4. 质量需求

| 维度 | 要求 |
|---|---|
| 分层 | Core/JS 公共 target 对 SDL、libuv、LVGL 和设备类型的依赖扫描为零。 |
| 可裁剪 | 未选择模块的源文件、对象、符号和依赖不进入最终链接；条件构建只在 Composition Root/模块 target。 |
| 线程 | LVGL/SDL API 只在唯一 owner thread；Core/JS 只通过 immutable typed message 交互。 |
| 内存 | 队列、retry、raw input 和 Trace 保留均有上限；embedded-min 运行期不依赖动态扩容。 |
| 确定性 | 每个异步请求完成一次；Host/Package/Backend/Engine 有唯一 owner 和确定销毁点。 |
| 可移植 | embedded-min 可由外部主循环周期调用 `pumpOnce`，Wakeup 不支持时不忙等。 |
| 可测试 | 组合冲突、读包 race、Backend open/stop、queue busy/full、lifecycle busy、root failed 和 Sink failure 均可注入。 |

## 5. 非目标

- 不定义 Core/JS 新公共 Port 或修改公共 Schema。
- 不解释 ZIP、Manifest、Page IR、Bundle 或联盟 DSL。
- 不创建 LVGL Surface、对象树、组件、Mount op 或 `NodeId` 映射。
- 不把 raw SDL/设备输入转换为 `PlatformInputMessage`。
- 不实现完整 SDL run target、自动交互、截图或 Case 001。
- 不实现 Trace Collector、存储、导出、统计或 Benchmark。
- 不实现 Release 签名、动态插件或运行时 Engine/Backend 切换。

## 6. 总需求映射

| LVGL 总需求 | LV-S02 覆盖 |
|---|---|
| `LV-R01` | R01-R06、R09-R10 |
| `LV-R02` | R07-R08、R18-R19 |
| `LV-R12` | R11、R14-R16 |
| `LV-R13` | R12-R16 |
| `LV-R16` | R05、R09、R19 |
| `LV-R17` | R01-R04、R12-R15 |
| `LV-R18` | R17-R18 |
