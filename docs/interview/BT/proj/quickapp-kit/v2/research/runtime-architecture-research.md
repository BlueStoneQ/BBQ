# QuickApp Kit v2 运行时架构研究报告

> 状态：架构研究稿  
> 目标：为 `requirements -> architecture -> design -> tech-design -> contracts/spec` 提供可追溯的技术依据  
> 范围：联盟快应用兼容、运行时树模型、渲染事务、线程与事件循环、页面模型、JS 引擎和 Bridge Value Model

> **继续工作提示：** 本文保留完整研究过程，部分结论尚未按最新第一阶段范围收敛。第一阶段以跑通仓库内指定示例 RPK 为硬目标，不要求完整联盟兼容、签名校验或完整组件/API；与 [架构讨论交接](../ARCHITECTURE-HANDOFF-2026-08-09.md) 冲突时，以交接文档为准。后续 agent 应在总设计阶段继续修订本文，而不是将全部建议直接视为已确定 spec。

## 目录

- [1. 结论先行](#1-结论先行)
- [2. 研究对象与证据边界](#2-研究对象与证据边界)
- [3. 联盟快应用现有实现](#3-联盟快应用现有实现)
- [4. QuickApp Kit v2 总体模型](#4-quickapp-kit-v2-总体模型)
- [5. RN 是否把能力全部下沉到 C++](#5-rn-是否把能力全部下沉到-c)
- [6. VNode 与三棵树的归属](#6-vnode-与三棵树的归属)
- [7. 全量树、增量更新与渐进演进](#7-全量树增量更新与渐进演进)
- [8. 渲染事务与行业方案对比](#8-渲染事务与行业方案对比)
- [9. 线程、Event Loop 与渲染 Tick](#9-线程event-loop-与渲染-tick)
- [10. 生命周期、Host、Surface 与路由](#10-生命周期hostsurface-与路由)
- [11. JS 引擎与版本锁定](#11-js-引擎与版本锁定)
- [12. Bridge Value Model](#12-bridge-value-model)
- [13. 技术决策清单](#13-技术决策清单)
- [14. 后续文档落点](#14-后续文档落点)
- [15. 参考资料](#15-参考资料)

## 1. 结论先行

QuickApp Kit v2 不应照搬 RN，也不应复制联盟 Android 实现，而应保留联盟语义、升级跨端内核边界：

```text
UX/RPK
  -> JS Framework（VM、响应式依赖、Logical DOM/VNode）
  -> typed DomMutation Transaction
  -> C++ Runtime Core（Shadow Tree、样式、布局、提交、页面栈）
  -> typed MountMutation Transaction
  -> Render Backend（Android / iOS / LVGL / Simulator）
  -> Platform UI Tree
```

**关键决策 KD-01：联盟标准是产品契约。** 生命周期、路由、启动模式、组件和系统接口应以联盟规范及兼容测试为准，不能以某个 Android 实现的偶然行为替代标准。

**关键决策 KD-02：VNode/Logical DOM 在 JS Framework，Shadow Tree 在 C++ Core，Host Tree 在 Render Backend。** 这是兼容现有 RPK 与获得跨端 C++ 渲染内核的平衡点。

**关键决策 KD-03：第一主路径采用增量 DOM 事务，不采用每次全量树提交。** Core 同时预留 `SubmitTreeSnapshot` 扩展入口；两种入口最终归一到同一个 Shadow Tree commit 和 MountMutation 协议，因此后续可渐进增加 Core Reconciler，不影响平台后端。

**关键决策 KD-04：移动端 UI 线程是系统主线程，不由 Runtime 新建。** JS Runtime 使用独立线程；Core 的 reconcile/layout 第一阶段运行在 Runtime 线程；Mount 只能调度到平台 UI owner。后续可增加 Render Worker，但不改变 RenderBackend 合同。

**关键决策 KD-05：不排斥 libuv，但不把 libuv 规定为所有平台唯一 Event Loop。** Core 定义 `TaskRunner/EventLoop` 接口；Vela/NuttX/Desktop 可提供 libuv backend，Android/iOS 使用系统 Looper/dispatch，FreeRTOS 可使用 task/queue/timer backend。Promise job queue、I/O event loop 与 frame tick 是三个不同概念。

**关键决策 KD-06：路由和 Page Stack 属于 Core；Page 不等于 Activity/ViewController。** 一个宿主容器可承载多个逻辑页面和 Surface，保证 Android、iOS、LVGL 行为一致。

**关键决策 KD-07：QuickJS 原版与 QuickJS-ng 暂不凭偏好拍板。** 先锁候选版本完成 Android/iOS/ESP32-S3 PoC，再依据体积、峰值内存、标准兼容、可中断性、维护活跃度和移植成本决策。无论选择哪一支，都锁定精确 tag/commit 和补丁集。

**重点吸收点：** RN 的价值在 C++ Shadow Tree、immutable commit、Yoga 和 Mounting Layer；Lynx 的价值在后台构树、主线程 Element Tree 与 UI Ops；联盟实现的价值在 DSL 兼容语义、增量 action 和页面生命周期，而不是其 JSON/J2V8/Android 专用边界。

## 2. 研究对象与证据边界

本报告使用三类证据：

1. 联盟开源实现：`hap-toolkit` 与 `hapjs` 当前 workspace 源码。
2. 联盟官方文档：DSL、生命周期、路由和页面启动模式。
3. RN、Lynx 官方架构文档。

需要区分“规范”与“实现”：

- 官方文档定义对应用开发者可观察的行为，是兼容目标。
- `hapjs` 是有价值的参考实现，但其 V8/J2V8、Java 对象和 Android HandlerThread 不是跨端规范。
- RN/Lynx 是架构借鉴对象，不是 QuickApp DSL 和生命周期的事实来源。

## 3. 联盟快应用现有实现

### 3.1 DSL 与编译产物

联盟应用以 `manifest.json + .ux` 组织。`.ux` 包含 template、style、script，`hap-toolkit` 将模板编译为 JS 对象，将样式编译为对象，将脚本包装为页面/组件模块，最终打入 RPK。

运行时消费的是编译产物，不是运行时解析原始 `.ux`。现有 RPK 使用 `$app_define$`、`$app_bootstrap$`、`$app_require$` 完成模块注册、启动和系统模块加载。

### 3.2 树与更新链路

本地源码显示：

- `hapjs/core/framework/src/dsls/xvm/vm/index.js` 在 JS 中实现 VM、Observer、Watcher 和模板 build。
- `hapjs/core/framework/src/infras/runtime/helper.js` 在 JS 中创建 `DomDocument`，将 action list JSON 序列化后调用全局 `callNative`。
- `listener.js` 产生 `createBody/addElement/removeElement/moveElement/updateAttrs/updateStyle/addEvent` 等细粒度 action。
- `streamer.js` 对 action 批量发送，默认阈值为 50，并用 `createFinish/updateFinish` 标记一轮结束。
- Android 侧 `RenderActionManager/RenderActionDocument` 解析 action 并维护原生侧 VDocument/VElement，再挂载 Android View。

因此联盟实现不是“JS 每轮交一棵完整 VNode 树”，而是：

```text
JS VM + JS DOM
  -> JSON incremental actions
  -> Android RenderAction document
  -> Android native views
```

### 3.3 线程模型

`JsThread` 是 Android `HandlerThread`，内部创建 J2V8 runtime；`RenderActionThread` 是另一条 `HandlerThread`；最终 View 变更进入 Android main thread。

```text
JS HandlerThread
  -> RenderAction HandlerThread
  -> Android Main/UI Thread
```

这证明“JS 与 UI 分线程”已经是联盟实现的基础能力。v2 要升级的是跨端抽象、类型化事务、原子提交和可替换引擎，而不是退回 JS/UI 同线程。

### 3.4 联盟实现应保留与应替换的部分

| 类别 | v2 处理 |
|---|---|
| UX/RPK 模块和生命周期语义 | 保留并建立兼容测试 |
| JS 响应式 VM 与增量更新模型 | 保留语义，可重构实现 |
| 页面栈与 launchMode | 下沉为 Core 合同 |
| JSON RenderAction | 替换为 Core 内 typed transaction；JS 边界可阶段性 JSON |
| J2V8/V8 强绑定 | 替换为 JS Engine Adapter |
| Java/Android VDocument | 替换为 C++ Shadow Tree |
| Android HandlerThread | 抽象为 TaskRunner |

**重点吸收点：** 兼容联盟 RPK 的最低风险路线是承接其增量 DOM 语义，而不是要求旧 bundle 变成 React 风格的全量 render function。

## 4. QuickApp Kit v2 总体模型

```text
Host / Embedder
  ├─ PackageLoader / ResourceProvider
  ├─ TaskRunners
  ├─ LifecycleSource
  ├─ RenderBackend
  └─ CapabilityProviders
            │
            ▼
Runtime Core
  ├─ AppRuntime / PageStack / SurfaceRegistry
  ├─ JsEngineAdapter / JsRuntime
  ├─ Bridge / CapabilityRegistry
  ├─ ShadowTree / Style / Layout
  └─ CommitCoordinator / MountScheduler
            │
            ▼
Platform Render Backend
  └─ Platform UI Tree
```

Core 应拥有跨平台一致的语义；Backend 只拥有平台 widget、文本测量、资源解码、输入事件接入和实际 mount。

## 5. RN 是否把能力全部下沉到 C++

答案是“渲染器关键部分下沉到 C++，不是所有东西都下沉”。RN New Architecture 的分工是：

| 层 | 位置 |
|---|---|
| React product logic 与 React Element Tree | JavaScript |
| React Shadow Tree、Yoga layout、commit 基础设施 | C++ |
| Host View Tree | Android/iOS 原生 |
| TurboModule 基础设施与类型绑定 | C++/codegen + platform implementation |

RN 的 render 阶段由 JS 产生 React Element，C++ Renderer 创建 Shadow Node；commit 提升一棵完整且 immutable 的新 Shadow Tree；mounting layer 计算并执行 Host View mutation。

旧 Shadow Tree 不会永久保留。提交期间旧 committed tree 与 next tree 同时存在，用于比较和原子切换；新树 promotion 后，旧树在无引用时释放。它不是页面缓存，也不能替代 QuickApp Page Stack。

**重点吸收点：** v2 应借鉴“跨端语义和 commit 在 C++，平台控件留在原生”，而不是把 JS Framework、所有业务逻辑或平台 UI 都改写成 C++。

## 6. VNode 与三棵树的归属

术语必须明确，否则“VNode”会同时指三种东西：

| 树 | 所属 | 职责 |
|---|---|---|
| Logical DOM / VNode Tree | JS Framework | DSL 结构、指令、组件 VM、事件绑定、响应式依赖 |
| Shadow Tree | C++ Core | 规范化节点、computed style、layout、revision、commit |
| Host Tree | Render Backend | Android View、UIView/CALayer、LVGL object |

**关键决策 KD-08：v2 文档统一使用 `Logical DOM`、`Shadow Tree`、`Host Tree`，不单独使用含混的 `VNode`。** 如果必须出现 VNode，明确它等价于 JS Framework 的 Logical DOM node。

为什么 Logical DOM 不直接放 C++：

- 联盟编译产物和 XVM 的 watcher/directive/component 语义天然在 JS。
- 把这一层迁到 C++ 会迫使 DSL 编译器和 JS Framework 大改，兼容风险高。
- C++ 真正需要的是稳定、可验证的渲染输入和平台无关 Shadow state，不需要知道 watcher 如何触发。

## 7. 全量树、增量更新与渐进演进

### 7.1 推荐方案

Core 对上暴露两个可归一的入口，但第一阶段只交付增量入口：

```cpp
ApplyDomTransaction(SurfaceId, Revision base, Span<DomMutation> mutations);
SubmitTreeSnapshot(SurfaceId, Revision base, TreeSnapshot snapshot); // 后续
```

内部都进入：

```text
validate -> build next Shadow revision -> style/layout -> compute mount mutations -> commit -> mount
```

### 7.2 渐进性与平台影响

这是可渐进的。未来增加 snapshot reconciler，只改变 Core 的输入适配和 reconcile 阶段；Android/iOS/LVGL Backend 继续消费同一种 `MountTransaction`，无需知道输入来自增量 DOM 还是全量 snapshot。

一步到位同时实现两套入口，主要增加：keyed diff、节点 identity、两种路径一致性测试和更大的首期范围。它不是平台渲染难题，主要是 Core 难题，但会拖慢首个 Android 闭环。

**关键决策 KD-09：合同一步到位，算法分期实现。** 现在定义 transaction、revision、node identity 和未来 snapshot 扩展点；第一期只实现联盟兼容的增量路径。这样保留先进架构，不用为未验证需求支付双倍实现和测试成本。

### 7.3 Core 是否还需要 diff

增量路径不应再对整棵 Logical DOM 做重复 diff。JS watcher 已经告诉 Core 哪些语义发生变化。Core 仍需：

- 将 mutation 应用到 immutable/COW Shadow revision；
- 比较 layout 前后结果，生成必要的 `UpdateLayout`；
- 合并冗余属性更新；
- 处理节点重排、平台可挂载节点折叠和事务校验；
- snapshot 模式启用后执行 keyed tree diff。

## 8. 渲染事务与行业方案对比

“指令”更准确的名称是 `Mutation`，有序集合是 `Transaction`：

```text
MountTransaction {
  surface_id
  base_revision
  target_revision
  mutations[]
}

Mutation = CreateNode | DeleteNode | InsertChild | RemoveChild |
           UpdateProps | UpdateEventMask | UpdateLayout | InvokeCommand
```

| 方案 | 更新表达 | 主线程之前的工作 | 主线程工作 |
|---|---|---|---|
| RN Fabric | next C++ Shadow Tree，再生成 mount mutations | render/commit/layout | mount Host Views |
| Lynx | background diff 和打包 changes/UI ops | 构树、diff、pack、部分 layout | parse/patch Element Tree、UI ops/paint |
| 小程序通用模式 | `setData` 数据 patch | 逻辑层计算、序列化 | 视图层绑定更新 |
| 联盟 hapjs | JSON DOM RenderActions | JS DOM 生成 action、RenderAction 解析 | Android View apply |
| v2 建议 | typed DOM transaction -> typed MountTransaction | Core validate/shadow/layout | Backend atomic ordered mount |

“原子提交”不代表原生 UI 支持任意回滚。正确语义是：

1. mount 前完整校验 transaction、revision 和 node reference；
2. 只有完整 Shadow revision 可成为 committed tree；
3. Backend 按顺序在一次 UI task/frame budget 中应用，不向事件系统暴露半棵逻辑树；
4. Backend 失败时 surface 进入明确错误状态，禁止静默部分成功。

**关键决策 KD-10：Core 内部和 Backend 合同使用 C++ typed structs，不用 JSON。** JS Adapter 初期允许解析联盟 JSON action 以降低兼容成本，但进入 Core 前必须规范化为 typed mutation。

## 9. 线程、Event Loop 与渲染 Tick

### 9.1 推荐线程模型

```text
Platform Main/UI Thread
  └─ input, vsync callback, MountTransaction, native widget

Runtime/JS Thread
  └─ JS execution, Promise jobs, lifecycle, Logical DOM mutation,
     V1 Core Shadow/Style/Layout/Commit

Optional Render Worker（后续）
  └─ expensive reconcile/layout for eligible transactions

I/O Workers / platform async services
  └─ network, file, decode, capability implementation
```

UI 线程在逻辑上独立于 JS，但 Android/iOS 上它就是系统 main thread，不能由 Runtime 自建。LVGL 可指定一个独占 owner task，只有该 task 调用 LVGL API。

后台页面不应导致整个 app JS runtime 冻结。建议一个 AppRuntime 共享一个 JS runtime；隐藏页面收到 `onHide`，其 VM 可保留，非可见 surface 的 render transaction 可合并或暂停 mount。定时器和异步回调的精确行为必须通过联盟兼容测试决定，不能用“页面隐藏”等同于“JS 停止”。

### 9.2 为什么不是直接统一 libuv

libuv 能解决成熟的 task queue、timer、async I/O、poll 和 worker pool，但不能替代：

- QuickJS Promise job queue；
- Android Choreographer / iOS CADisplayLink / LVGL tick 的 frame scheduling；
- 平台 UI thread affinity；
- FreeRTOS 上的设备 SDK 和驱动事件模型。

强行全平台使用 libuv 会增加二进制体积、FreeRTOS 移植、平台 loop 协同和退出顺序复杂度。完全不支持 libuv 也不合理，尤其 Vela/NuttX 已有成熟集成时。

**关键决策 KD-11：Core 定义能力最小的 `TaskRunner`，扩展定义 `EventLoopBackend`。**

```cpp
class TaskRunner {
 public:
  virtual void Post(Task) = 0;
  virtual void PostDelayed(Task, Duration) = 0;
  virtual bool RunsTasksOnCurrentThread() const = 0;
};
```

候选 backend：

- Android：Looper/Handler 或 ALooper adapter；
- iOS：dispatch queue + main run loop adapter；
- Vela/NuttX/Desktop：libuv adapter；
- ESP32-S3/FreeRTOS：task + queue + software timer adapter。

是否让 Android/iOS 的非 UI runtime loop 也使用 libuv，应通过体积、idle CPU、timer 精度、shutdown 和调试 PoC 决定，不进入首期硬合同。

### 9.3 渲染 tick

不要用固定 16.67ms timer 模拟 vsync。Android 使用 Choreographer，iOS 使用 CADisplayLink，LVGL 使用其 timer/refresh 驱动。JS mutation 可随时提交，MountScheduler 在下一帧预算内合并和应用；交互同步需求可定义高优先级立即提交，但必须限制使用。

## 10. 生命周期、Host、Surface 与路由

### 10.1 生命周期是标准合同

联盟页面生命周期至少包含：`onInit`、`onReady`、`onShow`、`onHide`、`onDestroy`、`onBackPress`、`onMenuPress`、`onRefresh`、`onConfigurationChanged`、`onReachTop`、`onReachBottom`、`onPageScroll`。

应用生命周期至少包含：`onCreate`、`onRequest`、`onIntentExecute`、`onShow`、`onHide`、`onDestroy`、`onError`、`onPageNotFound`。

`onReady` 必须绑定首个 surface commit/mount 完成语义，而不是简单绑定 JS template build 完成。`singleTask`、`clearTask` 和 `onRefresh(query)` 必须由 Router/PageStack 状态机统一实现。

**关键决策 KD-12：建立 lifecycle conformance matrix 和状态机测试。** 平台生命周期只能作为输入事件，不能直接等同于 QuickApp 生命周期。

### 10.2 Host 是什么

Host/Embedder 是把 Runtime 嵌入操作系统或设备应用的外壳，提供：

- 包、资源与缓存；
- UI/runtime/I/O TaskRunner；
- RenderBackend；
- Capability Provider；
- 前后台、窗口、配置和内存压力事件。

Android Host 可以是 Activity + Root container，但 Host 不是 Activity 的同义词。

### 10.3 Surface 是什么

Surface 是一个可独立挂载的 UI root，拥有 `SurfaceId`、viewport constraints、Shadow root、committed revision 和 backend root。它是 Runtime 与平台渲染的边界，不等于物理屏幕。

建议一个可见 QuickApp Page 对应一个 page surface；页面隐藏后 surface 可按策略 retain、suspend 或 evict，但 Page 实例和 Router 状态由 Core 决定。

“LVGL 单屏”应改称“单 physical display/root container 场景”。LVGL 仍然可以有多个逻辑页面、页面栈和 surface，只是通常同一时刻只挂载一个可见 page root。手机在这个意义上同样通常只有一个前台 viewport。

### 10.4 RN 与 v2 的路由差异

RN Core 不规定应用路由；常见 React Navigation 的 native-stack 可映射到 `UINavigationController` 或 Android Fragment，并不是一页一个 Activity。

QuickApp 的 Router 是标准 API，因此 v2 必须内建逻辑 Page Stack。Android 第一版建议一个 Runtime Activity + 一个 Root container；iOS 使用一个 container UIViewController。平台转场可以作为 Backend/Host 策略，但不能改变标准 page stack 语义。

## 11. JS 引擎与版本锁定

### 11.1 原版 QuickJS 与 QuickJS-ng

两者共享相近来源和 C API，但维护节奏、构建系统、修复集合和行为可能分叉。选择分支会影响：

- Android/iOS/ESP32-S3 target 的可构建性；
- footprint、峰值内存和 GC 行为；
- interrupt handler、memory limit、Promise jobs；
- ES 兼容与联盟 bundle 行为；
- 安全修复响应和后续升级成本；
- bytecode 格式和缓存失效策略。

“版本锁定”是指：

```text
engine = quickjs or quickjs-ng
upstream = exact tag + commit SHA
patches = ordered local patch set
build flags = recorded per target
source checksum = recorded
compat suite result = recorded
```

不能依赖浮动 branch 或系统环境里碰巧安装的版本。

### 11.2 决策门槛

**待决策 DD-01：** 原版 QuickJS 与 QuickJS-ng 各锁一个候选版本，完成同一套 PoC：

1. 加载真实联盟 RPK 的 app/page JS；
2. 运行 Framework 和 Promise/timer；
3. Android arm64、iOS arm64/simulator、ESP32-S3 至少完成 build；
4. 测冷启动、常驻内存、1000 节点更新、异常中断和 OOM；
5. 跑 Test262 子集与 QuickApp compatibility suite。

在数据出来前，不建议宣称 V8 更适合 Android、JSC 更适合 iOS。多引擎会显著扩大行为矩阵；第一阶段应以同一 QuickJS 系引擎覆盖 Android/iOS/LVGL，先证明 One Runtime Core。

### 11.3 Bytecode

QuickJS bytecode 类似“引擎私有的预编译中间产物”，概念上可类比 Hermes bytecode，但格式、ABI 和版本稳定性不能类推。二期可以支持 source JS 与 engine bytecode 双输入，但 bytecode 必须带 engine id、engine version、build fingerprint 和 source hash；不匹配时回退 source。它是启动优化和缓存能力，不是首期 RPK 兼容前提。

## 12. Bridge Value Model

### 12.1 为什么必须先定义

JS Engine Adapter、Capability Module、事件回流和未来多引擎都依赖同一个值语义。如果直接暴露 `JSValue`、JSC value 或平台对象，所谓可替换引擎只剩头文件接口，行为仍然被某个引擎锁死。

### 12.2 V1 值集合

```text
Value = Undefined
      | Null
      | Bool
      | Number(double)
      | String(UTF-8)
      | Array<Value>
      | Object<ordered string, Value>
      | Binary
      | CallbackHandle
      | OpaqueHandle (Core internal only)
```

具体规则：

- `undefined` 与 `null` 必须区分；
- JS `Number` 按 double，不私自把普通 number 改成 int64；
- BigInt V1 明确 unsupported 或采用显式扩展类型，禁止静默精度丢失；
- 循环对象拒绝并返回结构化错误；
- 限制最大深度、元素数、字符串和总 payload 大小；
- `NaN/Infinity/-0` 的编码规则必须写入 contract；
- JS engine handle 和平台 widget pointer 不得跨公共合同；
- Binary V1 可复制，零拷贝作为后续优化。

### 12.3 Capability 调用信封

```text
CapabilityRequest {
  protocol_version,
  runtime_id,
  page_id,
  module,
  method,
  call_id,
  args,
  flags
}

CapabilityResponse = Resolve(call_id, value)
                   | Reject(call_id, error)
                   | Emit(subscription_id, event)
```

`CallbackHandle` 必须包含 runtime generation 和作用域，区分 one-shot 与 persistent，页面销毁或 runtime 重启时统一失效并释放。

### 12.4 Render Bridge 不复用通用 Value 热路径

Capability 参数和 event payload 使用 Value Model；高频 RenderMutation 使用固定 typed struct。否则通用 map/object 的分配、字符串 key 和运行时类型判断会损害性能，也让 Backend 合同不清晰。

**关键决策 KD-13：JS Bridge、Capability Bridge、Render Bridge 是三条边界，共享生命周期与错误模型，但不共享一套低效消息格式。**

## 13. 技术决策清单

### P0：进入 contracts 前必须确定

| ID | 决策 | 当前建议 |
|---|---|---|
| KD-01 | 标准与实现的优先关系 | 联盟规范为合同，hapjs 为参考实现 |
| KD-02/KD-08 | 三棵树归属与术语 | Logical DOM in JS；Shadow Tree in Core；Host Tree in Backend |
| KD-03/KD-09 | 更新输入 | 增量 transaction 首发；snapshot 合同预留、实现后置 |
| KD-10 | 渲染协议 | revisioned typed transactions，Core 内禁用 JSON |
| KD-04 | 线程所有权 | JS 独立线程；平台主线程 mount；Render Worker 可演进 |
| KD-11 | Event Loop | TaskRunner 抽象；libuv 是可选 backend |
| KD-06/KD-12 | Page/Surface/生命周期 | Core Page Stack + conformance state machine |
| KD-13 | Bridge Value Model | 固定值语义、错误、callback 和资源限制 |

### P1：Android incubation 前以 PoC 定案

| ID | 决策 | 验证方式 |
|---|---|---|
| DD-01 | QuickJS 原版或 QuickJS-ng | 三端 build + compatibility + footprint benchmark |
| DD-02 | Yoga 版本与封装边界 | 联盟布局 golden cases + Android/LVGL 测量回调 |
| DD-03 | Android runtime loop 是否用 libuv | 与 Looper adapter 比体积、idle CPU、shutdown |
| DD-04 | Shadow Tree 持久化结构 | immutable/COW 与 mutable transaction benchmark |
| DD-05 | mount ACK 与 `onReady` 时点 | 首帧生命周期 conformance test |

### P2：Core extraction 后决策

| ID | 决策 | 原因 |
|---|---|---|
| DD-06 | 独立 Render Worker | 先用 benchmark 确认 layout/reconcile 是否阻塞 JS |
| DD-07 | snapshot reconciler | 不阻塞联盟增量兼容主路径 |
| DD-08 | QuickJS bytecode | source 主路径稳定后再做缓存优化 |
| DD-09 | hidden surface retain/suspend/evict | 需要移动端与 ESP32 内存数据 |

## 14. 后续文档落点

本报告中的稳定结论应按以下顺序沉淀：

1. `REQUIREMENTS.md`：补充联盟兼容性、生命周期一致性、跨平台线程和资源约束。
2. `ARCHITECTURE.md`：固化 Host、Core、JS Framework、Surface、三棵树和 transaction 总图。
3. `design/runtime-design.md`：AppRuntime、PageStack、SurfaceRegistry、CommitCoordinator 的职责与状态机。
4. `tech-design/threading-and-scheduling.md`：TaskRunner、EventLoopBackend、frame tick 和线程亲和性。
5. `contracts/runtime-contract.md`：Runtime/App/Page/Surface 生命周期合同。
6. `contracts/render-backend-contract.md`：MountTransaction、测量、事件、commit/ACK。
7. `contracts/capability-module-contract.md`：Value Model、request/response、callback、错误和版本。
8. `specs/js-engine-adapter-spec.md`：QuickJS adapter 与引擎锁定清单。

在上述合同完成前，不应把 Android View、iOS UIKit 或 LVGL 的具体组件实现分派给开发 agent。

## 15. 参考资料

### 15.1 联盟规范

- [快应用框架简介](https://doc.quickapp.cn/framework/)
- [生命周期](https://doc.quickapp.cn/tutorial/framework/lifecycle.html)
- [script 脚本与生命周期](https://doc.quickapp.cn/framework/script.html)
- [页面路由 router](https://doc.quickapp.cn/features/system/router.html)
- [页面启动模式](https://doc.quickapp.cn/framework/launch-mode.html)
- [manifest 文件](https://doc.quickapp.cn/framework/manifest.html)

### 15.2 本地联盟实现

- `hap-toolkit/packages/hap-dsl-xvm`：UX 编译与模板、样式、脚本转换。
- `hapjs/core/framework/src/dsls/xvm`：VM、Observer、Watcher、template build 和生命周期。
- `hapjs/core/framework/src/infras/runtime`：JS DOM、Listener、Streamer 和 `callNative`。
- `hapjs/core/runtime/android/runtime/src/main/java/org/hapjs/render`：PageManager、RenderAction 与 Android mount。
- `hapjs/core/runtime/android/runtime/src/main/java/org/hapjs/render/jsruntime/JsThread.java`：J2V8 和 JS HandlerThread。

### 15.3 行业架构

- [React Native Render, Commit, and Mount](https://reactnative.dev/architecture/render-pipeline)
- [React Native RootTag and multiple root views](https://reactnative.dev/docs/0.82/roottag)
- [React Native Navigation](https://reactnative.dev/docs/navigation)
- [Lynx Rendering Process and Lifecycle](https://lynxjs.org/4.0/react/lifecycle.html)
- [Lynx Render Process Analysis](https://lynxjs.org/next/guide/performance/analysis-performance/analysis-render-process.html)
- [QuickJS 原版](https://bellard.org/quickjs/)
- [QuickJS-ng](https://github.com/quickjs-ng/quickjs)
