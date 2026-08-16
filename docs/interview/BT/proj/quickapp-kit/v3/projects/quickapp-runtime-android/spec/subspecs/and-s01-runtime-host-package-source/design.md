# AND-S01 设计

## 目录
- [1. 结论](#1-结论)
- [2. 组件与接口投影](#2-组件与接口投影)
- [3. Host 状态与启动](#3-host-状态与启动)
- [4. PackageSource](#4-packagesource)
- [5. 生命周期控制](#5-生命周期控制)
- [6. 线程与所有权](#6-线程与所有权)
- [7. 失败、销毁与观测](#7-失败销毁与观测)
- [8. 禁止项](#8-禁止项)

## 1. 结论
Android Runtime Host 是**一次性装配器 + 公共控制面的异步代理**，不是第二个 Runtime：它冻结依赖、提供包 bytes、转发启动/生命周期请求并收口结果；所有业务状态与成功判定归 Shared Core。

## 2. 组件与接口投影
```text
Android launcher/embedding host
  -> RuntimeLaunchProfileDecoder
  -> AndroidRuntimeCompositionRoot
       -> immutable RuntimeCompositionManifest
       -> exactly one JsEngineProvider
       -> Shared JsRuntimeService
       -> NoopTraceSink | AndroidTraceSinkAdapter
       -> AndroidPackageSource
       -> SharedCoreRuntimeFactory
  -> AndroidRuntimeHost
       -> startRoot / controlLifecycle / destroy / describeComposition
```

| 组件 | 唯一责任 | 不拥有 |
|---|---|---|
| Profile Decoder | 严格解码公共 Profile | 默认值策略、DSL、包校验 |
| Composition Root | 构造并冻结依赖图 | Runtime 状态机 |
| Manifest Provider | 暴露只读构建事实 | 运行时探测后改写 |
| Runtime Host | 调用 Core 控制面并收口结果 | Page/Surface/Navigation 状态 |
| AndroidPackageSource | 随机读取 immutable bytes | ZIP、Manifest、IR 解释 |
| TraceSink Selector | 选择 Noop 或 Android Adapter | Collector、存储、分析 |

以下是实现侧接口投影，不新增公共协议：

```text
CompositionRoot.create(profile, embeddedManifest, factories, platformPorts)
  -> AndroidRuntimeHost | RuntimeError

AndroidRuntimeHost.startRoot()
  -> async CreateSurfaceResult(presented | failed)

AndroidRuntimeHost.controlLifecycle(RuntimeLifecycleControl)
  -> async RuntimeLifecycleControlResult(completed | failed)

AndroidRuntimeHost.destroy(requestId)
  -> async RuntimeLifecycleControlResult(completed(destroyed) | failed)

AndroidRuntimeHost.describeComposition()
  -> immutable RuntimeCompositionManifest
```

`describeComposition` 只返回嵌入的构建事实，不建立 Runtime Bridge。后续 AND-S02..S07 只通过 Composition Root 的显式注册点提供公共 Port。

S01 的 Composition Root 同时消费 Manifest 与 build inventory，并精确比较 module identity 集合和 `binaryBytes`；不一致返回 `RUNTIME_PROFILE_INCOMPATIBLE`。该机制的 Fake inventory 测试是隔离合同证据，不是 APK/native 已实际链接 Core/JS/QuickJS 的证明；真实 link map、唯一 JS Framework、唯一 Engine 和未选模块不入链接由 AND-S08/AND-S09 提交。

## 3. Host 状态与启动
Host 只维护资源编排状态，不复制 Core AppRuntime 状态：

```text
new -> composing -> starting -> running -> destroying -> destroyed
          |           |
          +-> failed <-+
```

| 状态 | 允许操作 |
|---|---|
| `new` | 接受一次 compose/start |
| `composing` | 创建并验证 immutable 依赖，不接受第二次启动 |
| `starting` | 等待 Root 结果；destroy 可进入取消与清理 |
| `running` | 转发 lifecycle control，拒绝第二次 start |
| `destroying` | 拒绝新 start/control，等待 Core destroy 收口 |
| `destroyed` | 不再转发请求 |
| `failed` | 不复用半初始化对象，只允许最终清理 |

`foreground/background` 不属于 Host 状态；权威值只来自 Core Result。

启动顺序固定为：

```text
strict decode RuntimeLaunchProfile
  -> require target=android
  -> validate embedded RuntimeCompositionManifest
  -> choose Sink and exactly one Engine Provider
  -> create AndroidPackageSource
  -> create Shared AppRuntime with immutable dependencies
  -> Core opens/verifies package and composition compatibility
  -> Core initializes App/Page and requests Root
  -> wait Root CreateSurfaceResult
       presented -> running -> success
       failed    -> failed -> cleanup -> typed error
```

Composition Root 校验 Manifest 与构建选择；Shared Core 在执行 JS 前校验 Artifact 需求。Engine ABI 不兼容为 `MODULE_ABI_UNSUPPORTED`，能力集合不兼容为 `RUNTIME_PROFILE_INCOMPATIBLE`。Activity、Window、容器或 native library 加载都不是成功边界。

## 4. PackageSource
### 4.1 后端与所有权
| 后端 | bytes 所有权 |
|---|---|
| 文件 | `open` 时独占一个只读 fd；`fstat` 固定 size；每次 `pread` 同一 fd 并产生独立 immutable storage |
| Asset | Source 独占 Asset 句柄或共享持有只读 Asset storage |
| 内存 | Source 共享持有移交后的 immutable storage，不保留可变数组引用 |

### 4.2 读取语义
```text
size() -> uint64
readAt(offset, length, completion)
close()
```

1. 创建时固定 size；运行中不观察长度变化。
2. `offset + length` 做无溢出检查；越界、短读、关闭和后端异常返回 `PACKAGE_IO_ERROR`。
3. `length=0` 成功返回空 immutable bytes。
4. completion 异步投递 Core queue，以 per-read guard 保证恰好一次。
5. 阻塞 I/O 只在 Host I/O executor，不在 Android UI Thread。
6. close 先禁止新读取，再关闭后端；in-flight read 可完成 bytes 或 error，但不能触达已销毁 Host。
7. completion 只捕获独立 request state 和 Core queue endpoint，不捕获裸 Host/Activity。
8. File backend 不保存 path 供 read 重开；路径在 open 后被 rename/replace 不改变 fd 指向的资源。
9. 原文件身份被截断而无法满足固定 size 的读取时返回 `PACKAGE_IO_ERROR`，绝不读取替换路径补足。

PackageSource 从 Core 开包前保持到 `destroyAppRuntime` 收口或启动失败清理。Core 不接收路径、fd、AssetManager、InputStream 或可变 ByteBuffer。

## 5. 生命周期控制
```text
Android Host signal
  -> allocate RequestId
  -> RuntimeLifecycleControl(action)
  -> enqueue Core Runtime Thread
  -> Core performs ordered transition
  -> RuntimeLifecycleControlResult(same requestId/action)
  -> Host completes caller
```

| Host 意图 | action |
|---|---|
| 进入可交互前台 | `enterForeground` |
| 不再可见/可交互 | `enterBackground` |
| 最终释放 Runtime | `destroyAppRuntime` |

Activity/Process 回调只表达 Host 意图，不能调用 Hook。重复信号不得在 Android 层吞并为成功；Core 的合法性与 `LIFECYCLE_BUSY` 必须保留。

## 6. 线程与所有权
| 对象/动作 | Owner | 执行域 | 跨域 |
|---|---|---|---|
| Profile、Manifest | Host immutable storage | Launcher/Host | 创建时复制或共享只读 |
| AppRuntime handle | AndroidRuntimeHost | Host 控制面 | 只调用 Core Port |
| Runtime 状态 | Shared Core | Core Runtime Thread | immutable request/result |
| Engine Provider | JS Runtime Service | JS Executor Thread | Host 不直接调用 Engine |
| Package backend | AndroidPackageSource | Host I/O executor | immutable bytes 到 Core queue |
| TraceSink | Runtime lifetime | producer thread | emit 非阻塞、noexcept |

Host 不同步等待 Core；Core 不同步等待 Android UI Thread。外层 launcher 可以等待最终异步结果，但等待逻辑不进入 Runtime。

## 7. 失败、销毁与观测
| 阶段 | 公共错误 |
|---|---|
| Profile 非法 | `ABI_INVALID_ARGUMENT` / `ABI_UNSUPPORTED_VERSION` |
| artifact 不存在/不可读 | `PACKAGE_NOT_FOUND` / `PACKAGE_IO_ERROR` |
| 包格式/完整性 | 对应 `PACKAGE_*` |
| Engine ABI | `MODULE_ABI_UNSUPPORTED` |
| 组成不兼容 | `RUNTIME_PROFILE_INCOMPATIBLE` |
| 并发生命周期 | `LIFECYCLE_BUSY` |

异常不得跨边界穿透或依赖字符串匹配。销毁顺序：

```text
stop accepting start/control
  -> invalidate Host callbacks except destroy completion
  -> enqueue destroyAppRuntime
  -> receive Core typed result after forced release
  -> detach Core endpoint
  -> close PackageSource
  -> release Sink / JS Runtime / Engine / AppRuntime handle
  -> destroyed
```

Core destroy 即使 failed，Host 仍完成本地最终释放并返回 failure；晚到结果不得复活 Host。

观测仅做选择：`off` 只允许 custom Profile 并用 Noop；`conformance=v1` 使用 baseline/diagnostic Adapter。AND-S01 不格式化、存储或导出 Trace。Noop 与 Recording 运行结果除观测证据外必须相同。

## 8. 禁止项
1. 禁止 Service Locator、全局 Engine 单例、失败后 fallback 第二 Engine。
2. 禁止 Android 私有 launch/lifecycle/composition/package 协议。
3. 禁止 Host 修改 Core 页面状态或直接调用 Hook。
4. 禁止 PackageSource 返回平台流、可变共享 buffer 或同步 completion。
5. 禁止 Collector、文件 I/O、文本格式化进入 Runtime 热路径。
6. 禁止提前实现 AND-S02..S07。
