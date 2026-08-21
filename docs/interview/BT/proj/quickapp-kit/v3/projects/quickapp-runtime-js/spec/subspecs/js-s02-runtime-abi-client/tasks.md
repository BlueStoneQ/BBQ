# JS-S02 Runtime ABI Client：任务

## 目录

- [1. 结论](#1-结论)
- [2. 前置门禁](#2-前置门禁)
- [3. 实现任务](#3-实现任务)
- [4. 依赖顺序](#4-依赖顺序)
- [5. 完成定义](#5-完成定义)
- [6. 禁止工作](#6-禁止工作)

## 1. 结论

编码放行后，JS-S02 按“类型 -> codec -> outbound -> inbound -> correlation -> teardown -> 证据”实现。每一步都先证明 typed 边界，再接入下一步；不得夹带 JS-S03 业务。

## 2. 前置门禁

开始编码前必须同时满足：

1. 本分 Spec 独立校审为 PASS。
2. 工作看板明确标记 JS-S02 `CODE_ALLOWED`。
3. JS-S01 继续保持 VERIFIED，公共 Native Function Binding 合同未改变。
4. 公共 Runtime ABI/Schema 无未关闭冲突。

当前状态为 `CODE_BLOCKED`，以下任务只是编码指令，不是本轮执行授权。

## 3. 实现任务

### JS-S02-T01：建立 ABI 类型目标

**目标**：定义 Runtime ABI identity、closed inbound/outbound unions、typed EnqueueResult 和 correlation key。

**工作**：

1. 定义 `quickapp-kit-runtime-v1` 与 `schemaVersion=1` 常量。
2. 为公共消息建立 C++ typed representation 或消费公共生成类型。
3. 定义 `CoreInboundMessage`、`JsInboundMessage` closed variant。
4. 定义 `RequestId/TransactionId` 强类型 correlation key，禁止隐式混用。
5. 建立 public header dependency scan。

**完成定义**：编译期 visitor 覆盖所有 variant 分支；公共头无 QuickJS/Platform/JSON RPC 类型。

### JS-S02-T02：实现无副作用 typed codec

**目标**：把一个 JS plain object 严格转换为一个指定公共消息。

**工作**：

1. 复用 JS-S01 RuntimeValue conversion 与固定 depth/node limits。
2. 实现 required/optional/unknown/type/enum/ID/safe integer/cross-field 校验。
3. 对每个 entry 固定 kind，不接受调用者动态改 kind。
4. 实现 `RuntimeError` 与 `{ok:true|false}` 的 Engine-neutral encode。
5. 禁止 JSON stringify/parse、getter/Proxy 副作用和借用 Value 泄漏。

**完成定义**：每个字段规则有正负 fixture；任何失败都不调用 Port、不创建 bridge correlation。

### JS-S02-T03：实现 NativeEntryCatalog

**目标**：通过 JS-S01 Native Function Binding 注册固定 typed 入口。

**工作**：

1. 实现 design.md 冻结的 14 个 binding name；13 个消息入口 `argc=1`，`supportsCapability argc=2`。
2. 每个 binding 只关联一个 decoder 和一个 typed message type。
3. 任一 bind 失败时反向 unbind 已成功 token。
4. 保证 Catalog 不出现 generic call/invoke 或 unknown fallback。
5. Fake/QuickJS 复用同一 S02 codec/client suite。

**完成定义**：绑定集合、名字、参数数、重复注册、partial bind rollback 和 unbind 测试通过；S02 源码无 External Function/QuickJS。

### JS-S02-T04：实现 RuntimeAbiClient admission

**目标**：完成 JS -> Core 的同步接受语义。

**工作**：

1. 检查 service/scope state、字段、bridge correlation capacity。
2. 建立 provisional bridge correlation，调用 CoreIngressPort.post。
3. accepted 后 commit correlation；rejected 后原子撤销并编码 typed error。
4. completion 消息 echo Core RequestId，不错误创建 correlation。
5. 覆盖 Core accepted/overflow/closed/OOM 和消息所有权。

**完成定义**：`ok:true` 只对应一次成功所有权转移；每个失败分支 correlation/Port call/resource 均符合设计。

### JS-S02-T05：校验 RequestId 分区并实现 Bridge Correlation Registry

**目标**：消费请求模块从 AppRuntime 唯一 allocator 取得的 JS-origin identity，并只维护跨层 Result 关联。

**工作**：

1. 以合同 fixture 验证 JS Framework bootstrap 为每个 AppRuntime 只创建一个本地 `JsRequestIdAllocator`，它只在 JS Executor 上运行并由所有请求模块共享；allocator 实现不属于 S02。
2. 验证请求模块先从 allocator 取得 `req:j-<positive-decimal>`，再把完整 typed message 交给 S02；禁止 S02 分配 ID、持有 allocator 或增加同步 ID Native Function。
3. Core-origin completion 只校验并原样回显原 `req:<positive-decimal>`，不重新分配。
4. 实现 RequestId/TransactionId discriminated key。
5. PendingRecord 只保存 key、expected result kind、owner/generation；删除 completionToken。
6. 实现容量限制、duplicate key、匹配删除和 late/mismatch drop。
7. 不实现 timeout，不保存 raw JS Value、Promise/callback、Render snapshot 或业务 completion。

**完成定义**：两个以上请求模块交错共享取号得到 `req:j-1`、`req:j-2`、`req:j-3` 且无碰撞；JS/Core 来源分区、0 ID Bridge、满载、乱序、重复、错误 kind/surface/generation 和关联消费一次测试通过；S02 无 allocator 或业务 pending 权威。

### JS-S02-T06：实现 RuntimeAbiCallbacks

**目标**：让 Core callback 只通过异步 typed 路径进入 JS Executor。

**工作**：

1. producer thread 只做纯字段/version/scope admission。
2. 使用 JS-S01 有界 Executor move immutable callback；`ModuleBundle.bytes` 使用共享不可变 byte storage，进程内不得保留 `bytesBase64`。
3. 在 JS Executor 重查 generation；Result 先匹配并删除 bridge correlation record，再把完整 typed Result 投递给固定 slot。
4. 实现编译期固定 CallbackSlots 和 move-only registration token。
5. 覆盖 callback queue overflow、close race、late task、consumer 注销，以及 Module bytes 在 rejected、terminal delivery、Surface/App teardown 的释放。

**完成定义**：Core thread 从不进入 Engine/consumer；accepted callback 按 FIFO 最多分发一次；拒绝时所有权明确。

### JS-S02-T07：实现 Surface 与 AppRuntime teardown

**目标**：关闭后不存在旧 callback、bridge correlation 或 native token。

**工作**：

1. 实现 Surface `open -> closing -> closed` 与 generation invalidation。
2. 删除 Surface bridge correlation、拒绝新 admission；不触碰 JS-S07/JS-S09 业务 pending，不误删 AppRuntime 模块级 callback slot。
3. 实现 Service `new/starting/running/quiescing/failed/stopped`。
4. 反向解绑 Native Function，清空全部 bridge correlation、注销 consumer registration，关闭/release Ports。
5. 接入 JS-S01 upperLayerTeardown，保证 S02 早于 Context 销毁。

**完成定义**：重复 close/stop、排队 callback、在途 Result、partial start failure 后所有 S02 计数归零。

### JS-S02-T08：接入最小 Observation

**目标**：记录 ABI admission/result/overflow/teardown，不改变业务行为。

**工作**：

1. 只使用公共已定义 marker 与字段。
2. 关联 RequestId/TransactionId/SurfaceId。
3. 使用 JS-S01 ObservationEmitter；不新增 Sink、队列或 I/O。
4. 比较 Noop 与 Recording 的返回、顺序、bridge correlation 和清理。

**完成定义**：Schema 校验通过；关闭、拒绝或丢样不改变 ABI 行为。

### JS-S02-T09：建立合同测试与证据

**目标**：无业务模块条件下证明 ABI 边界完整。

**工作**：

1. Framework bootstrap fixture 覆盖每个 AppRuntime 唯一 allocator，以及至少两个请求模块交错取号无碰撞；Fake Core Port 覆盖 accepted/overflow/closed/late/duplicate/mismatch 和 JS/Core RequestId wire 分区。
2. Fake typed consumers 覆盖 callback FIFO、注销和销毁。
3. Fake/QuickJS 跑同一 Native Binding + codec suite。
4. 运行 Debug、ASan/UBSan、TSan 和 API-only build。
5. 保存 ABI version、Schema 版本、build/env、资源计数与边界扫描证据。

**完成定义**：满足 acceptance.md 全项，且源码扫描确认无 JS-S03..S09 业务实现。

## 4. 依赖顺序

```text
T01 -> T02 -> T03 -> T04 -> T05
                    |       |
                    +-> T06-+
                          -> T07 -> T08 -> T09
```

T05 与 T06 可在 T04 接口稳定后并行；T07 必须等待双向 admission 和 correlation 完成。

## 5. 完成定义

JS-S02 实现只有同时满足以下条件才完成：

1. Runtime identity、message version、字段和 closed union 均有机器测试。
2. 14 个 Native Function 均通过 JsEnginePort 注册，S02 无 QuickJS/External Function。
3. EnqueueResult、bridge correlation、typed callback 和销毁在所有成功/失败路径语义唯一，S02 不持有业务 completion。
4. queue/bridge correlation 有界，无同步跨线程等待、通用 Bridge 或 mutable shared state。
5. Surface/AppRuntime 销毁后 Native entry、correlation、consumer registration、callback task 全部归零。
6. Fake/QuickJS suite、sanitizer、线程和边界证据全部通过。

## 6. 禁止工作

即使实现方便也不得加入：Module Loader、Module globals、VM、Lifecycle Hook、Proxy、Binding、Block、Render builder、Handler、Capability Facade、Platform Host、Core 业务状态机或 JS-S03 占位实现。
