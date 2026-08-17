# LV-S02 设计

## 目录

- [1. 结论](#1-结论)
- [2. 架构与边界](#2-架构与边界)
- [3. Composition Root](#3-composition-root)
- [4. Runtime Host](#4-runtime-host)
- [5. PackageSource](#5-packagesource)
- [6. Core 与 JS 装配](#6-core-与-js-装配)
- [7. Backend 组合](#7-backend-组合)
- [8. 生命周期控制](#8-生命周期控制)
- [9. 启动与销毁](#9-启动与销毁)
- [10. 线程、背压与降级](#10-线程背压与降级)
- [11. Observation 与错误](#11-observation-与错误)
- [12. 裁剪与后续边界](#12-裁剪与后续边界)

## 1. 结论

LV-S02 采用：**静态 Composition Root + 单次 Runtime Session + owner-thread pump + 可替换 BackendSet。**

第一性边界：

```text
Build Profile 决定二进制里有什么
Runtime Launch Profile 决定这次运行什么
Core 决定 Runtime 发生了什么
Backend 只决定平台工作如何被执行
```

## 2. 架构与边界

```text
LvglProductCompositionRoot
  -> immutable RuntimeCompositionManifest
  -> SharedCoreRuntimeFactory
  -> SharedJsRuntimeFactory
       -> exactly one JsEngineProvider(QuickJS)
  -> one TraceSink
  -> PackageSourceFactory
  -> BackendSet
       -> OwnerTaskQueue + BackendClock + WakeupPort
       -> DisplayBackend + InputBackend
  -> LvglRuntimeHost
       -> one RuntimeSession
       -> start / lifecycle / destroy / pump / describe
```

| 对象 | 唯一责任 | 不拥有 |
|---|---|---|
| Composition Root | 验证 build inventory，构造冻结依赖 | Runtime 状态 |
| Runtime Host | 严格启动、控制请求、owner pump、结果收口 | Page/Surface/Navigation 状态 |
| Runtime Session | 聚合一次运行的资源所有权 | 第二套 Core AppRuntime |
| PackageSource | 随机读取 immutable package bytes | ZIP/IR/Bundle 语义 |
| BackendSet | 调度、时钟、唤醒、显示、raw input | Surface/Mount/Event 语义 |
| TraceSink Selector | 选择唯一 Sink | Collector、存储、分析 |

## 3. Composition Root

### 3.1 构建期与运行期分离

Composition Root 消费编译期 `LvglBuildProfile` 与 build inventory，生成公共 Manifest；它不读取 `RuntimeLaunchProfile` 来选择模块。

```text
LvglBuildProfile
  profileId / schema target / buildMode / conformance / observationLevel
  engine module
  linked module registrations
  component registrations
  capability registrations
  Backend selection
```

最终 Profile 固定为：

| 字段 | `lvgl-simulator-dev` | `lvgl-embedded-min` |
|---|---|---|
| Manifest target | `lvgl-simulator` | `lvgl-embedded` |
| buildMode | `debug` | `release` |
| conformance | `v1` | `v1` |
| observationLevel | `diagnostic` | `baseline` |
| Engine | QuickJS Provider | QuickJS Provider |
| owner loop | libuv | builtin cooperative |
| display/raw input | SDL | device callback adapter |
| PackageSource | file | immutable memory |
| TraceSink | LVGL Trace Adapter | LVGL Trace Adapter |

两个 Profile 的公共 `components` 固定包含 `View/Text/Button`，`capabilities` 固定包含 `system.router/prompt/device`。这些实现分别由后续分 Spec 注册；在它们尚未真实链接时，Composition Root 必须拒绝生成最终 `conformance=v1` 产品 Manifest。

V1 limits 同样属于构建 Profile，不从 Launch Profile 或环境变量读取：

| Limit | `lvgl-simulator-dev` | `lvgl-embedded-min` |
|---|---:|---:|
| owner task capacity | 512 | 64 |
| raw input capacity | 128 | 16 |
| max tasks per pump | 64 | 16 |
| max raw samples per pump | 32 | 8 |
| max timer callbacks per pump | 32 | 8 |
| max display submissions per pump | 1 | 1 |
| max in-flight package reads | 16 | 4 |
| admission retry attempts per source per turn | 1 | 1 |
| owner task stop policy | `drain` | `drain` |

这些值只限制 S02 所有的基础资源；Core/JS 自有队列使用各自冻结 limits。后续测量若要求改变 embedded-min 数值，必须修改 Profile 定义并重新提交裁剪、内存和背压证据，不能运行时放大。

### 3.2 S02 所有的模块 identity

以下 identity 由 LV-S02 冻结；后续模块 identity 由各自分 Spec注册，不在本文件猜测：

| moduleId | category | Profile |
|---|---|---|
| `platform.lvgl.host` | `platform` | 两者 |
| `backend.lvgl.libuv.loop` | `backend` | simulator only |
| `backend.lvgl.sdl.display` | `backend` | simulator only |
| `backend.lvgl.sdl.input` | `backend` | simulator only |
| `backend.lvgl.package.file` | `backend` | simulator only |
| `backend.lvgl.builtin.loop` | `backend` | embedded only |
| `backend.lvgl.embedded.display` | `backend` | embedded only |
| `backend.lvgl.embedded.input` | `backend` | embedded only |
| `backend.lvgl.package.memory` | `backend` | embedded only |
| `platform.lvgl.trace` | `platform` | 两者 |

`linkedModules` 还必须包含公共固定六个 Kernel、一次 `runtime.js-framework` 和 Provider descriptor 指向的 Engine module。module identity 重复、Provider descriptor 不匹配、Profile 交叉模块或 `binaryBytes` 无效均使构建失败。

### 3.3 Manifest 事实边界

```text
selected Build Profile
  + registered module/component/capability inventory
  + selected Engine descriptor
  + build-provided final binaryBytes
  -> validate public Schema and cross-field invariants
  -> immutable RuntimeCompositionManifest
```

`describeComposition()` 返回同一 immutable 对象，不在运行时扫描符号或改写能力。LV-S02 Fake inventory 只验证上述算法；LV-S09 用最终 link map、symbol inventory 和 binary bytes 证明实际产物一致。

## 4. Runtime Host

以下是 LVGL 项目内部接口投影，不新增公共协议：

```text
LvglRuntimeHost.start(RuntimeLaunchProfile, completion)
LvglRuntimeHost.admitHostSignal(resume | suspend | shutdown)
LvglRuntimeHost.control(RuntimeLifecycleControl, completion)
LvglRuntimeHost.pumpOnce(PumpBudget) -> HostPumpResult
LvglRuntimeHost.destroy(completion)
LvglRuntimeHost.describeComposition() -> immutable manifest view
```

Host 状态只表示资源编排：

```text
new -> composing -> starting -> running -> destroying -> destroyed
          |            |
          +-> failed <-+
```

- `starting` 不接受第二次 start。
- root `presented` 前 Session 不对外发布为 running。
- foreground/background 不进入 Host 状态；只采用 Core typed Result。
- `destroying` 后拒绝新 start/control/raw input admission，但继续 owner pump 以完成已接受 teardown。
- `failed/destroyed` 不复用；新运行创建新 Host。

LV-S02 测试使用 Fake Core 返回 root result；真实 Surface/Present 链路由 LV-S03/S04/S08 接入，S02 不伪造成功。

## 5. PackageSource

### 5.1 统一 Port 语义

```text
size() -> uint64
readAt(offset, length, completion) -> immutable bytes | PackageReadError
close()
```

规则：

1. Source 构造成功时固定 size 与资源 identity。
2. `offset + length` 先做无溢出校验；越界、短读、底层失败和 close 后读取统一为 `PACKAGE_IO_ERROR`。
3. 合法 `length=0` 异步完成为空 bytes。
4. 每个 read 有一次性 operation token，completion 恰好一次且只投递 Core queue。
5. close 先拒绝新 read；已接受 read 可以完成 bytes 或 error，但不能捕获裸 Host。
6. completion 转移或共享只读 storage；Source close 不使 Core 已持有 bytes 失效。

### 5.2 两种实现

| 实现 | 所有权与读取 |
|---|---|
| File PackageSource | open 时独占同一个只读文件 handle，固定 size；异步 positional read，不按 path 重开；rename/replace 不改变资源 identity。 |
| Memory PackageSource | 构造时持有 immutable storage 或做一次冻结复制；range read 共享只读 slice 或复制；无文件系统依赖。 |

Simulator launcher 用 Profile 的 resolved artifact path 创建 File Source。Embedded launcher 在 Host 外将同一 artifact identity 解析到固件内建 immutable package registry，再创建 Memory Source；Core 始终只看到 PackageSource。

## 6. Core 与 JS 装配

`RuntimeSession` 只聚合所有权：

| 资源 | 创建者 | 实际 owner/执行域 | 释放边界 |
|---|---|---|---|
| Composition Manifest | build/Composition Root | Session 共享只读 | 最后释放 |
| PackageSource | PackageSourceFactory | Session；I/O completion 到 Core queue | Core destroy 收口后 close |
| JsEngineProvider | Composition Root | 只读 factory | JS Runtime 全部销毁后 |
| JS Runtime Service/Engine instance | Shared JS factory | JS Executor | Core AppRuntime teardown 内关闭 |
| Core AppRuntime handle | Shared Core factory | Core Runtime Thread | destroy result 收口 |
| BackendSet/OwnerTaskQueue | Composition Root | LVGL owner thread | Core teardown 后反向关闭 |
| TraceSink/Clock | Composition Root | 覆盖全部生产者 | 最后释放 |

Host 只把 Provider 交给共享 JS factory，不调用 Engine primitive；只把 PackageSource/Manifest/JS Port/Platform Ports/Clock/Sink 交给 Core factory，不解释 Package 或 Runtime ABI。一个 Host 对应一个 AppRuntime Session；一个 Session 只创建一个 AppRuntime-scoped JS Engine Service。

## 7. Backend 组合

### 7.1 共同 pump

两个 Profile 使用同一 owner turn：

```text
read monotonic now
  -> pump at most maxTasksPerPump
  -> service due platform timers within budget
  -> drain at most maxRawInputPerPump
  -> service display within budget
  -> compute next deadline
  -> backend wait/yield or return to external caller
```

Backend 只能触发 generic wakeup 或产生 raw sample；不得直接调用 Core、JS Hook、Surface 或 Event Handler。

### 7.2 `lvgl-simulator-dev`

- owner thread 同时执行 libuv loop turn、SDL event pump 和后续 `lv_*` 工作。
- libuv 只实现 timer/wakeup/I/O 驱动；业务任务仍在 LV-S01 `OwnerTaskQueue`。
- SDL DisplayBackend 只消费 `DisplayFrameView`；SDL InputBackend 只产出 `RawInputSample`。
- SDL window 创建成功和 test frame present 只证明 Backend，不证明 Runtime root 成功。
- LV-S08 才把 Surface/Mount/Input Adapter 接入并完成交互式 run target。

### 7.3 `lvgl-embedded-min`

- 调用者线程首次绑定为 owner，外部主循环周期调用 `pumpOnce`。
- builtin loop 只计算 deadline、执行 budget 和协作式 yield；没有 wait 能力时返回，不忙等。
- Display/Input 是固定函数表或静态对象适配器，设备 context 只留在具体 Backend；共享 Port 不出现 RTOS/BSP/LVGL 类型。
- Memory PackageSource、固定容量 storage 和 baseline Trace endpoint 不要求文件系统。
- 无输入设备时 Input open 可以 `unsupported`；是否允许具体产品 headless 由其 Build Profile 决定，两个冻结 V1 Profile 不以 headless 代替 Case 闭环。

### 7.4 Backend 生命周期

owner thread 的 open 顺序固定为：

```text
initialize selected loop/clock
  -> bind OwnerTaskQueue
  -> initialize selected WakeupPort
  -> open DisplayBackend
  -> open InputBackend
  -> running
```

失败和停止按 `Input -> Display -> Wakeup -> loop -> OwnerTaskQueue.finishStop` 反向关闭。`beginStop(drain)` 先封闭 task admission；已接受 teardown task 在每轮预算内完成。任何 close 失败都被记录并继续关闭剩余资源，不能阻止资源收敛。

## 8. 生命周期控制

```text
raw host signal
  -> pre-admission duplicate filter
  -> allocate RequestId
  -> RuntimeLifecycleControl(action)
  -> enqueue Core Runtime Thread
  -> Core ordered transition and Hook dispatch
  -> RuntimeLifecycleControlResult(same requestId/action)
  -> complete Host caller once
```

| raw signal | action |
|---|---|
| resume/interactive | `enterForeground` |
| suspend/not-visible | `enterBackground` |
| final shutdown | `destroyAppRuntime` |

只有尚未生成 RequestId 的重复 raw signal可以被过滤。accepted control 不合并、不替换、不伪造成功；Core 的 `LIFECYCLE_BUSY` 原样返回。Backend 只报告 raw signal，不调用 Hook 或修改可见状态。

raw signal 可以来自设备/launcher producer context，但只能封装为 immutable Host task 并投递 owner queue；Host admission 状态、RequestId 分配和 Core control 投递均在 owner thread 串行完成。`post=busy/full/stopping` 时不允许 producer 直接进入 Host 或 Core。

## 9. 启动与销毁

启动：

```text
strict decode RuntimeLaunchProfile(target=lvgl)
  -> validate embedded Manifest and selected Provider/Backend identities
  -> create BackendSet and bind owner
  -> create TraceSink and PackageSource
  -> create unpublished RuntimeSession
  -> inject dependencies into shared Core/JS
  -> Core verifies package/composition before JS execution
  -> Core creates AppRuntime and root
  -> wait root CreateSurfaceResult
       presented -> publish running -> success
       failed    -> cleanup -> typed failure
```

销毁：

```text
close Host admission and raw input acceptance
  -> enqueue destroyAppRuntime
  -> continue bounded owner pump for accepted teardown work
  -> receive typed destroy result after Core forced release
  -> detach Core/JS endpoints
  -> close PackageSource
  -> beginStop OwnerTaskQueue using frozen policy
  -> close Input, Display, Wakeup and loop Backend on owner
  -> release Engine Provider, Clock and TraceSink
  -> destroyed
```

Core destroy 返回 failure 时 Host 仍执行本地最终释放并返回原 failure。没有 timeout 猜测成功；进程级强杀不属于 Runtime 正常销毁合同。

## 10. 线程、背压与降级

| 动作 | 归属 |
|---|---|
| Host state/admission/pump、SDL/libuv/设备 Backend | LVGL owner thread |
| Core 逻辑状态 | Core Runtime Thread |
| JS Engine/Framework | JS Executor Thread |
| File read | libuv I/O/worker；completion 投递 Core queue |
| Memory read | 不共享可变 storage；completion 仍投递 Core queue |
| Trace emit | 当前 producer thread，Sink nonblocking/noexcept/no-reentry |

物理线程可以合并，但逻辑 owner 与消息顺序不变。Core 不同步等待 owner thread，owner thread不等待 JS/Core。

`busy` 表示本次竞争未接受，task 所有权仍在上游；上游最多在后续 turn 按冻结次数重试，不能在当前调用栈循环。`full` 表示容量耗尽，立即返回对应 typed failure并产生公共队列事实；Host 不建立第二个无界 retry queue。每轮 pump 的 task/input/timer/display 数量均受 Profile limits 约束。

无 OS 线程、阻塞唤醒、文件系统或动态分配时，embedded-min 分别使用 caller-owned pump、cooperative return、Memory PackageSource 和 caller-provided fixed storage；这些降级不改变 FIFO、typed result 或销毁顺序。

## 11. Observation 与错误

Composition Root 每次只注入一个 Sink：

- 两个冻结 V1 Profile：`platform.lvgl.trace` Adapter，分别为 diagnostic/baseline。
- `custom/off` 测试 Profile：`NoopTraceSink`。
- S02 Adapter 只转发 immutable `TraceEvent` 到有界 endpoint；Collector、存储和导出属于 LV-S09。

`RuntimeLaunchProfile.traceOutput` 只作为外围 Collector/exporter 配置转交；S02 不打开该路径。`disabled` 不关闭 V1 baseline marker，输出失败也不改变 Runtime 启动或生命周期结果。

Sink 丢样、关闭或输出失败不改变 Runtime result。Host 不自造 marker；Package、Engine、Surface、Lifecycle marker 由公共合同指定 owner 产生。

| 失败 | 结果 |
|---|---|
| Profile/schema/target 非法 | `ABI_INVALID_ARGUMENT` 或 `ABI_UNSUPPORTED_VERSION` |
| inventory/Profile 不一致 | 构建失败；运行时检测为 `RUNTIME_PROFILE_INCOMPATIBLE` |
| Engine descriptor/ABI 不兼容 | `MODULE_ABI_UNSUPPORTED` |
| package 不存在/不可读 | `PACKAGE_NOT_FOUND` / `PACKAGE_IO_ERROR` |
| Core package/初始化/root 失败 | 原样返回对应公共 `RuntimeError` |
| accepted lifecycle 冲突 | `LIFECYCLE_BUSY` |
| owner queue 满 | 对应 `QUEUE_OVERFLOW`，不得静默丢弃 |
| Backend open/execute/close 失败 | 转换为稳定 Platform/Runtime failure，并执行逆序清理 |

## 12. 裁剪与后续边界

依赖方向固定：

```text
LVGL Product Composition Root
  -> selected concrete Backend/Provider
  -> LV-S01 Foundation + shared public Ports
  -> shared Core/JS

shared Core/JS -X-> LVGL/SDL/libuv/BSP concrete module
```

条件构建只选择 module target；不得在 Core/JS 热路径用 `#ifdef SDL/libuv`。embedded-min 的 link map、symbols 和 dependencies 必须没有 simulator-only 模块。

后续责任：

- LV-S03：Surface Host 与 Present/Visibility/Close/Destroy。
- LV-S04：Mount 与 Host Components。
- LV-S05：RawInputSample 到标准 `PlatformInputMessage`。
- LV-S06/S07：Measure 与 Capability/Page Control。
- LV-S08：将上述能力接成完整 SDL Runtime。
- LV-S09：Collector 与双 Profile 最终裁剪/体积/内存证据。
