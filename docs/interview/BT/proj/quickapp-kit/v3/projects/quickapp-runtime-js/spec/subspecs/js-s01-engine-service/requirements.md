# JS-S01 JS Engine Service：需求

## 目录

- [1. 结论](#1-结论)
- [2. 问题本质](#2-问题本质)
- [3. 输入与输出](#3-输入与输出)
- [4. 功能需求](#4-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 需求映射](#6-需求映射)
- [7. 非目标](#7-非目标)

## 1. 结论

JS Engine Service 必须把“执行 JavaScript”压缩为一个稳定的引擎无关能力：**上层提交串行操作，Port 返回结构化结果；具体引擎对象、线程和异常永远不越过 Provider 边界。**

V1 成功标准不是仅能执行一段 JS，而是 Fake Engine 与 QuickJS Provider 能被同一 Framework 合同替换，且在创建、调用、microtask、异常、背压和销毁上行为一致。

## 2. 问题本质

JS Framework 需要调用 JS，但不应知道 QuickJS；平台需要选择引擎，但不应产生另一条业务 Bridge。因此 JS-S01 只解决三个问题：

1. 用什么最小 Port 表达 JS 执行能力。
2. 谁拥有 Engine、Context、Value、线程和销毁顺序。
3. 如何把 QuickJS External Function、异常和观测转换为平台无关合同。

## 3. 输入与输出

### 3.1 输入

| 输入 | 约束 |
|---|---|
| `JsEngineProvider` | Build Profile 必须且只能选择一个；Engine ABI 必须为 `quickapp-kit-js-engine-v1` |
| `JsEngineConfig` | immutable；必须含有界队列和资源限制；不含 Platform 类型 |
| Engine operation | immutable；只能投递到 JS Executor；不得携带 Core/Platform 可变对象 |
| `NativeFunctionBinding` | 引擎无关；只表达函数绑定，不定义 Runtime ABI 业务方法 |
| Observation dependencies | `MonotonicClock + TraceSink + runId + clockDomain`；Sink 可为 Noop，且注入前必须满足 `emit noexcept + nonblocking + no reentry` |

### 3.2 输出

| 输出 | 约束 |
|---|---|
| `JsEngineService` | 每个 `AppRuntime` 一个；拥有 Executor、Engine、主 Context |
| `EngineResult<T>` | 成功或一个结构化异常；不存在跨 C++ 边界抛出的 JS 异常 |
| `JsContextRef/JsValueRef` | 不暴露引擎 handle；只能在所属 Executor 使用 |
| 队列结果 | 明确 accepted、overflow、stopping/cancelled；不静默丢任务 |
| Observation | 只发公共 marker；合法 Sink 的容量满、拒绝保留、丢样或关闭不得改变业务结果 |

## 4. 功能需求

| ID | 需求 |
|---|---|
| JS-S01-R01 | 必须定义稳定的 `JsEngineProvider/JsEnginePort`；Framework 头文件不得包含 QuickJS 或平台类型。 |
| JS-S01-R02 | Composition Root 必须且只能选择一个 Engine Provider；Provider identity 必须与 Runtime Composition Manifest 的 `jsEngine` 一致，ABI 不匹配时在执行 JS 前返回 `MODULE_ABI_UNSUPPORTED`。 |
| JS-S01-R03 | 每个 `AppRuntime` 必须拥有一个 JS Executor、一个 Engine instance 和一个主 Context；Engine、Context 与全部 Value 只能在该 Executor Thread 创建、访问和销毁。 |
| JS-S01-R04 | `JsEnginePort` 必须提供 Context 创建/销毁、source 求值、函数调用、属性读取/写入与可调用性检查；这些能力只表达 Engine primitive，不解释 Module、VM 或 Runtime ABI 语义。 |
| JS-S01-R05 | `JsValueRef` 必须是 context-bound 的拥有型引用；复制、移动、释放和失效均不得暴露引擎 handle。Context 销毁前必须释放其全部 Value；跨 Context、跨 Executor 或销毁后访问必须确定失败。 |
| JS-S01-R06 | Port 必须提供 `RuntimeValue <-> JsValueRef` 严格转换；拒绝 undefined、函数、Symbol、BigInt、NaN、Infinity、循环引用、超限深度/节点数和非 JavaScript safe integer。 |
| JS-S01-R07 | Port 必须提供引擎无关 `NativeFunctionBinding`；QuickJS Provider 必须用 External Function Adapter 实现它。External Function、`JSValue`、`JSContext*` 和 provider trampoline 不得进入公共层。 |
| JS-S01-R08 | Native Function 只能在所属 JS Executor 同步进入；其参数只在调用期有效，需保留时必须转换或 retain 为 `JsValueRef`；回调不得同步等待 Core 或 Platform。 |
| JS-S01-R09 | Port 必须提供显式 microtask drain；一次 drain 使用有界 job budget，未清空时只向同一 Executor 排入一个 continuation，不在调用栈内无限循环。JS-S01 不决定 reactive flush 时机。 |
| JS-S01-R10 | JS Executor 必须使用有界 FIFO 任务队列；接受顺序由单调 task sequence 确定。达到上限时拒绝当前任务并返回 `QUEUE_OVERFLOW`，不得丢弃已接受任务。 |
| JS-S01-R11 | Executor 必须实现 `new -> running -> quiescing -> stopped`；进入 quiescing 后拒绝新普通任务、取消尚未执行的普通任务、运行唯一 teardown barrier，并在同一线程按 Value -> Context -> Engine 顺序销毁。 |
| JS-S01-R12 | 所有 Engine operation 必须返回 `EngineResult<T>`；QuickJS pending exception 必须立即提取、清除并转换为 `EngineException`。普通 JS 异常映射 `JS_EXCEPTION`，必要分配失败映射 `OUT_OF_MEMORY`。 |
| JS-S01-R13 | 单个 JS operation 异常不得使 Executor 崩溃或污染下一次独立 operation；Provider 进入不可恢复状态时必须停止接受新任务并完成确定销毁。 |
| JS-S01-R14 | V1 QuickJS Provider identity 固定为 `engineId=quickjs`、`moduleId=engine.quickjs`、`engineAbi=quickapp-kit-js-engine-v1`；`engineVersion` 必须取真实构建依赖版本。 |
| JS-S01-R15 | V1 必须提供可编程 Fake Engine；Fake 与 QuickJS 必须运行同一 Engine Contract Suite，覆盖 Port 形状、线程、Value、Native Binding、异常、microtask 和销毁。 |
| JS-S01-R16 | JS-S01 必须接入本地 `ObservationEmitter`。Emitter 复用公共 Sink 和单调时钟，不经过 Runtime ABI；队列深度采样、队列溢出和 OOM 使用公共 marker，其他阶段 marker 由对应后续分 Spec 产生。 |
| JS-S01-R17 | Composition Root 只允许注入满足 `emit noexcept + nonblocking + no reentry` 前置合同的 Sink。Noop、正常 Recording，以及 Recording 容量满、拒绝保留、丢样和关闭时，对同一 operation 序列必须产生相同返回值、异常分类、task sequence、Engine 状态和销毁结果。真实 throw、真实阻塞或真实重入属于非法 Sink 实现，由静态约束、受控替身和集成检查拒绝；Runtime 不承诺隔离或恢复。 |
| JS-S01-R18 | JS-S01 必须提供显式 GC 请求和引擎内存快照能力，用于测试和外围采样；不得在热路径强制 GC，也不得自定义公共 GC marker。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 平台无关 | 公共目标不引用 JNI、Android、UIKit、LVGL、SDL、libuv 或平台线程 API。 |
| 引擎隔离 | QuickJS 类型只存在于 Provider 私有文件；Fake 与 QuickJS 都只能经 Port 接入。 |
| 顺序 | 一个 Executor 串行执行；并发生产者的任务按 acceptance sequence FIFO 消费。 |
| 背压 | 业务队列有界；overflow 可观测且只拒绝当前任务。Observation 缓冲溢出不影响业务队列。 |
| 内存 | 所有 Value 都能追溯到 Context；AppRuntime 销毁后 Engine/Context/Value/queued task 计数归零。 |
| 异常隔离 | 无 JS 异常、QuickJS pending exception 或 native callback 异常穿透 Port。 |
| 确定性 | Fake 可脚本化重放；相同 operation 和配置产生相同结果、序列与错误分类。 |
| 可观测 | 只使用公共 marker、整数纳秒和结构化字段；注入 Sink 必须 `noexcept/nonblocking/no-reentry`，热路径无文本格式化、文件 I/O 或 Collector 等待。 |
| 可裁剪 | 一个生产产物只链接一个 Engine Provider；Fake/test support 不得进入生产链接清单。 |
| 可测试 | 所有 Port 方法必须有成功、非法输入、错误注入、销毁后访问和线程误用测试。 |

## 6. 需求映射

| 本分 Spec | 上级需求 |
|---|---|
| JS-S01-R01..R15 | JS-R01、JS-R16、JS-R18、JS-R19；QK-R05、QK-R20 |
| JS-S01-R16..R18 | JS-R20；QK-R21 |
| 全部质量需求 | JS Runtime 总 Spec 质量需求；平台总 Spec 架构完整性与可裁剪性要求 |

## 7. 非目标

- 不定义 `$app_define$/$app_bootstrap$/$app_require$`。
- 不读取 Bundle、PackageSource、Page IR 或 Runtime Metadata。
- 不定义任何 `instantiateTemplate/submitRenderTransaction/registerHandler` 业务入口。
- 不维护 App/Page VM、state、Binding、Block、Handler 或 pending Promise。
- 不建立 Core/Platform 通道，不直接调用 JNI、UIKit 或 LVGL。
- 不支持多 Engine 并存、运行时热切换、失败后自动换 Engine或并行 Page JS Thread。
- 不引入独立 EventLoop；JS Executor 只提供本 Runtime 所需任务队列和 microtask 驱动。
- 不实现 Collector、日志存储、报告、可视化或私有观测 marker。
