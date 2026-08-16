# IOS-S01 设计

## 目录

- [1. 结论](#1-结论)
- [2. 对象与边界](#2-对象与边界)
- [3. Composition Root](#3-composition-root)
- [4. Runtime Host](#4-runtime-host)
- [5. PackageSource](#5-packagesource)
- [6. 线程与所有权](#6-线程与所有权)
- [7. 启动与销毁](#7-启动与销毁)
- [8. Scene 与 Runtime 生命周期](#8-scene-与-runtime-生命周期)
- [9. 观测](#9-观测)
- [10. 错误与降级](#10-错误与降级)
- [11. Fake 验收架构](#11-fake-验收架构)

## 1. 结论

IOS-S01 使用三个单一职责对象：

```text
IosCompositionRoot  --构建期选择--> RuntimeDependencies + CompositionManifest
IosRuntimeHost      --进程期协调-->  AppRuntimeSession
IosPackageSource    --字节入口-->    Core Package Loader
```

Composition Root 不管理运行状态；Host 不解释包与页面；PackageSource 不理解 ZIP。三者通过冻结公共 Port 组合，因此 iOS 产品接入可以后置，而共享 Core/JS 不需要改变。

## 2. 对象与边界

| 对象 | 唯一责任 | 不得负责 |
|---|---|---|
| `IosCompositionRoot` | 构造依赖图、选择单 Engine/Sink、生成 Manifest | Runtime lifecycle、业务状态 |
| `IosRuntimeHost` | Profile 校验、Session 启停、raw Scene admission 与 accepted control 关联 | JS Hook、Navigation、Surface 状态机 |
| `IosPackageSource` | `size/readAt/close` 与 immutable bytes | ZIP、完整性、DSL |
| `AppRuntimeSession` | 聚合一次运行的强所有权与关闭状态 | 成为第二套 Core AppRuntime |
| `SceneSignalAdapter` | 仅在 RequestId 生成前对 raw Scene signal 去重并请求 Host admission | 合并已接受 control、直接进入 JS/Core 内部状态 |

本分 Spec 只约束将来 S02-S07 提供 Port 实现，不定义其接口细节。测试阶段使用 Fake Ports；真实实现由对应分 Spec替换。

## 3. Composition Root

### 3.1 构造输入

```text
IosBuildProfile
  profileId / buildMode / conformance / observationLevel
  selectedEngineModule
  selectedPlatformModules[]
  selectedComponents[]
  selectedCapabilities[]
```

Build Profile 是 iOS 构建系统输入，不进入 Runtime ABI。Composition Root 执行：

1. 链接固定六个 Kernel module 与一次 `runtime.js-framework`。
2. 要求 Engine module 数量等于一，并构造该 Provider。
3. 注册所选 iOS Port/Component/Capability module。
4. 按 `conformance + observationLevel` 验证并构造 Sink：`custom/off -> Noop`；`v1|custom` 的 `baseline/diagnostic -> Recording Adapter`；拒绝 `v1/off`。
5. 生成符合 Schema 的 immutable Manifest。
6. 在发布工件时以 link map/symbol inventory 校验 Manifest 与实际链接一致。

任何缺失、重复或 ABI 不兼容在创建 AppRuntime 前失败；不得回退到第二个 Engine。

### 3.2 输出

```text
RuntimeDependencies
  coreFactory
  jsRuntimeFactory(selectedEngineProvider)
  packageIoExecutor
  coreQueue
  monotonicClock
  traceSink
  platformPorts       # S02-S07 真实实现或测试 Fake
  compositionManifest
```

`RuntimeDependencies` 构造完成后不可变。Manifest 的 describe 返回同一实例的只读投影，不重新推断链接事实。

## 4. Runtime Host

### 4.1 Host 接口语义

```text
start(profile, packageInput, completion)
handleSceneSignal(active | background | disconnected)
destroy(completion)
describeComposition() -> immutable manifest view
```

这些是 iOS 产品内入口，不是新增公共 Runtime 合同。Host 向 Core 只发送公共 Profile 派生输入和 `RuntimeLifecycleControl`。

### 4.2 Host 状态

```text
idle -> starting -> running -> destroying -> destroyed
                 \-> failed -> destroying -> destroyed
```

- `starting` 期间不接受第二次 start。
- 只有 Root `CreateSurfaceResult(status=presented)` 后进入 `running` 并完成成功回调。
- 任一前序失败进入清理流程；对外只完成一次。
- `destroying` 后拒绝新 Scene control、start 和包读取请求。
- `destroyed` 是终态，不允许复活；新运行必须创建新 Host/Session。

## 5. PackageSource

### 5.1 统一语义

本地适配严格实现公共 Port：

```text
size() -> uint64
readAt(offset, length, completion) -> immutable bytes | PackageReadError
close()
```

三种输入只影响内部存储：

| 输入 | 内部 owner | 读取策略 |
|---|---|---|
| 文件 URL | Source 独占只读 file handle | I/O executor 定位读取 |
| Bundle resource | 先解析为只读文件 URL | 与文件实现相同 |
| immutable Data | Source 持有不可变快照 | 范围 slice，共享只读 backing 或复制 |

Core 永远只看到长度和 immutable byte storage，不看到 Foundation 对象、URL、fd 或 stream。

### 5.2 字节所有权

- Source 保证 read completion 返回后 bytes 不可变。
- 文件读取产生由结果对象独占或共享只读所有权的 storage。
- Data 输入在 Source 构造时冻结：调用方后续可变对象不得影响读取结果；必要时复制一次。
- completion 入 Core queue 即转移或共享只读所有权；Core 释放最后引用后 bytes 才销毁。
- `close()` 关闭新读取入口并释放底层 handle，但不使已完成且由 Core 持有的 bytes 失效。

### 5.3 并发与关闭

Source 内部串行化状态：`open -> closing -> closed`。每个 read 分配内部 operation token，完成路径使用一次性门闩保证恰好回调一次。

- close 前已接受的 read：允许完成，但 completion 仍只投递 Core queue。
- close 后新 read：异步返回 `PACKAGE_IO_ERROR`。
- offset/length 溢出、`offset + length > size`、短读和底层错误：`PACKAGE_IO_ERROR`，不返回部分 bytes。
- `length=0` 在合法 offset 范围内返回空 immutable bytes。

## 6. 线程与所有权

| 资源/动作 | owner/executor |
|---|---|
| Host 状态、Scene 去重、Session 指针 | Host serial executor |
| Core AppRuntime 状态 | Core Runtime Thread |
| JS Engine/Framework 状态 | JS Executor Thread |
| 文件读取 | Package I/O executor |
| Package completion | Core queue |
| Scene 来源 | iOS main thread；立即转为 immutable signal 投递 Host executor |
| TraceSink | Composition Root 所有；生命周期覆盖 Session |

`AppRuntimeSession` 强持有 PackageSource、Core Runtime handle、JS Runtime handle、Clock、Sink 和所选 Port；外部 Scene adapter 只持有可失效的 Host token。销毁时先使 token 失效，避免晚到 Scene 信号访问 Session。

禁止：Core 同步等待 main thread、I/O executor 同步回调 Core、Runtime 持有 Scene/UIKit 对象、跨线程共享可变 Data。

## 7. 启动与销毁

### 7.1 启动

```text
validate RuntimeLaunchProfile(target=ios)
  -> validate frozen CompositionManifest
  -> create PackageSource
  -> create unpublished AppRuntimeSession
  -> inject Manifest/Engine/Clock/Sink/Fake-or-real Ports into shared Runtime
  -> Core opens and verifies package
  -> Core creates AppRuntime and Root Surface
  -> wait typed Root result
  -> presented: atomically publish Session + complete success
  -> failed: reverse cleanup + complete typed failure
```

Host 不使用 Scene 已连接、窗口已出现或 Surface 已创建作为成功条件。

### 7.2 销毁

```text
Host state -> destroying; invalidate Scene token
  -> stop accepting new Host controls
  -> submit RuntimeLifecycleControl(destroyAppRuntime)
  -> receive completed/failed exactly once
  -> close PackageSource and cancel Host-owned pending operations
  -> release Core Runtime handle
  -> release JS Runtime/Engine Provider
  -> release platform Ports, Sink and Clock
  -> Host state -> destroyed; complete caller once
```

Core 的 destroy failure 或 Hook failure必须被记录，但 Host 仍执行强制逆序释放。Host 不替 Core 重放 Hook，也不等待无限期猜测结果；V1 测试通过可控 Fake completion 验证闭环，真实超时策略不在本分 Spec 新增。

启动失败使用同一逆序清理，但只对已经创建的阶段执行。未发布 Session 不得接收 Scene control。

## 8. Scene 与 Runtime 生命周期

Scene 只代表宿主可见性，不等于 App/Page lifecycle。入口明确分为两个阶段：

```text
raw Scene signal
  -> Host admission：可去重，尚无 RequestId
  -> accepted Host control：生成唯一 RequestId + immutable RuntimeLifecycleControl
  -> Core：completed | failed(LIFECYCLE_BUSY | other RuntimeError)
  -> Host：按原 RequestId/action 完成一次 typed Result
```

### 8.1 Raw Scene signal

| raw Scene signal | 生成公共 control 时的 action |
|---|---|
| active | `enterForeground` |
| background | `enterBackground` |
| disconnected | `destroyAppRuntime` |

`SceneSignalAdapter` 可以在生成 `RequestId` 前丢弃连续重复 raw signal，或在 Runtime 尚未发布/已经 destroying 时拒绝 admission。被去重或拒绝的 raw signal 没有 RequestId，不是 accepted control，不生成伪造的 `RuntimeLifecycleControlResult`。去重只减少平台通知噪音，不代表 Core 状态转换成功。

### 8.2 Accepted RuntimeLifecycleControl

Host 接受 admission 时立即生成不复用的 `RequestId` 和 immutable `RuntimeLifecycleControl`，登记 `requestId -> action/completion` 后逐条投递 Core。此后该请求不得因后续 Scene signal、相同 action、Host 观察状态或其他在途请求而被合并、替代、取消或本地完成。

Host 允许多个 accepted control 等待 Core 处理；Runtime 状态转换是否可并发由 Core 决定。Core 对重复或并发 control 返回 `LIFECYCLE_BUSY` 时，Host 必须以同一 `requestId/action` 原样完成对应调用，不重试、不改写为成功，也不更新 committed state。每个 accepted control 只接受一个 typed Result；重复或未知 Result 按关联错误处理，不二次完成调用方。

Host 不生成 Page 级消息，不知道 top Surface，不执行 Hook。只有 Core `completed` Result 才更新 Host 的 committed runtime state；任意 failed Result 均保持 committed state 不变并原样向上返回。

## 9. 观测

Composition Root 使用固定矩阵选择 Sink：

| conformance | observationLevel | Sink | 结果 |
|---|---|---|---|
| `v1` | `baseline` | Recording Adapter | 合法 |
| `v1` | `diagnostic` | Recording Adapter | 合法 |
| `v1` | `off` | 无 | 拒绝组成 |
| `custom` | `off` | Noop | 合法 |
| `custom` | `baseline` | Recording Adapter | 合法 |
| `custom` | `diagnostic` | Recording Adapter | 合法 |

- IOS-S01 只保证 Sink 注入和生命周期，不实现缓冲、导出或分析；这些属于 IOS-S09。
- Recording Fake 接收 immutable `TraceEvent`，不得回调 Runtime。
- Sink failure、关闭或丢样不得改变 Host/Core 结果。
- Host 不创造与公共 Catalog 同义的私有 marker；启动事实由 Core/Platform 公共 marker 表达。

## 10. 错误与降级

| 失败 | 结果 |
|---|---|
| Profile 非 iOS 或字段非法 | `ABI_INVALID_ARGUMENT`，不创建 Source/Runtime |
| Composition Schema/链接事实不一致 | 构建失败；运行时检测到则 `RUNTIME_PROFILE_INCOMPATIBLE` |
| Engine ABI 不兼容 | `MODULE_ABI_UNSUPPORTED`，不回退 |
| 文件不存在 | `PACKAGE_NOT_FOUND` |
| read/close/越界/短读 | `PACKAGE_IO_ERROR` |
| 包校验失败 | 透传 Core 对应 Package typed error |
| Root 未 presented | 透传 typed error，启动失败并清理 |
| accepted lifecycle control 重复或并发 | 请求仍逐条进入 Core；`LIFECYCLE_BUSY` 以同 RequestId/action 原样透传且不改 committed state |
| destroy Result failed | 记录错误并强制释放；不得重复 Hook |
| TraceSink 失败 | Runtime 结果不变，仅观测样本无效 |

错误只能使用公共 `RuntimeError`；iOS `NSError/NSException` 不穿透公共边界。

## 11. Fake 验收架构

IOS-S01 在不依赖 UIKit 和真实 Core 实现的条件下设计以下 Test Doubles：

| Fake | 可控行为 | 证明 |
|---|---|---|
| `FakeCoreRuntime` | 记录装配、Root result、Lifecycle result | 启动判据、Scene 分离、销毁顺序 |
| `FakeJsEngineProvider` | identity/ABI/构造销毁计数 | 单 Engine 与 ownership |
| `FakePackageSource` | bytes、短读、延迟、close race | 一次完成和 bytes 生命周期 |
| `RecordingTraceSink` | 记录事件或模拟丢样/失败 | 与 Noop 行为等价 |
| `FakePlatformPorts` | 仅满足依赖，不含 UIKit | S01 不越界设计 S02-S07 |

测试断言面向公共消息、顺序、引用计数和 typed error，不断言私有实现类名。
