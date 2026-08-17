# JS-S02 Runtime ABI Client：验收

## 目录

- [1. 结论](#1-结论)
- [2. 验收环境](#2-验收环境)
- [3. 版本与绑定](#3-版本与绑定)
- [4. 字段与编码](#4-字段与编码)
- [5. 准入与关联](#5-准入与关联)
- [6. Callback](#6-callback)
- [7. 销毁与资源](#7-销毁与资源)
- [8. 边界与观测](#8-边界与观测)
- [9. 需求覆盖](#9-需求覆盖)
- [10. 证据](#10-证据)
- [11. 通过条件](#11-通过条件)

## 1. 结论

JS-S02 的验收本质是证明：**任何跨层调用都只能以一个合法 typed message 被接受一次，并以一个匹配 typed Result 完成一次；销毁后两端都无法触达旧对象。**

只验证 happy path、依赖 QuickJS raw API、用 JSON envelope 或让 late Result 调用旧 consumer，均不得通过。

## 2. 验收环境

至少运行：

| 配置 | 用途 |
|---|---|
| Fake Engine + ManualPump + Fake Core | 确定性版本、codec、pending、乱序和销毁测试 |
| Fake Engine + OwnedThread + Fake Core | 并发 callback admission、queue overflow、close race |
| QuickJS + OwnedThread + Fake Core | 真实 Native Function Binding 与 JS 返回对象 |
| Noop/Recording Sink | Observation 行为等价 |
| ASan/UBSan/TSan | 生命周期、内存和数据竞争 |

测试不加载 Bundle、不创建 VM、不生成 Render/Handler。

## 3. 版本与绑定

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S02-A01 | compatible identity | `quickapp-kit-runtime-v1` 注册完整 14 个入口且各一次 |
| JS-S02-A02 | incompatible identity | `ABI_UNSUPPORTED_VERSION`；0 binding、0 Port call、0 bridge correlation |
| JS-S02-A03 | message version != 1 | 当前消息 `ABI_UNSUPPORTED_VERSION`；Service 继续处理后续合法消息 |
| JS-S02-A04 | duplicate binding | 启动失败并反向 unbind；无 partial catalog |
| JS-S02-A05 | partial bind failure | 已绑定 token 全部反向释放；Service 最终 stopped |
| JS-S02-A06 | catalog shape | 13 个消息入口 `argc=1`；supports 查询 `argc=2` 且只读 immutable snapshot、0 Core post/correlation/Provider create；每个入口只有固定 typed decoder/result，不存在 generic call/invoke/fallback |
| JS-S02-A07 | Engine neutrality | Fake/QuickJS 运行同一 suite；S02 public/source 不含 QuickJS 或 External Function adapter |

## 4. 字段与编码

### 4.1 正例

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S02-A08 | 每个 outbound type 最小合法消息 | decode 为正确 concrete union 分支；字段无损，post 一次 |
| JS-S02-A09 | RuntimeValue | null/bool/finite number/string/array/plain object 在 limits 内无语义变化 |
| JS-S02-A10 | EnqueueResult accepted | JS 精确得到 `{ok:true}`，不包含业务成功字段 |
| JS-S02-A11 | EnqueueResult rejected | JS 精确得到 `{ok:false,error}`，error code/retryable/关联 ID 保留 |
| JS-S02-A12 | optional field | 缺失与显式 null 按公共 Schema 区分，不互相填充 |

### 4.2 负例

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S02-A13 | required missing/unknown field | `ABI_INVALID_ARGUMENT`；0 Port call、0 bridge correlation |
| JS-S02-A14 | wrong kind/type/enum/ID prefix | `ABI_INVALID_ARGUMENT`；下一条合法消息成功 |
| JS-S02-A15 | cross-field violation | scope/Surface/owner/status 关系非法时整体拒绝 |
| JS-S02-A16 | forbidden JS value | undefined/function/Symbol/BigInt/NaN/Infinity/cycle/unsafe integer/超限拒绝，无副作用 |
| JS-S02-A17 | getter/Proxy | 不执行 getter/Proxy trap；稳定拒绝 |
| JS-S02-A18 | unknown RuntimeError field/code | 拒绝 callback/result，不把错误交给 consumer |
| JS-S02-A19 | native C++ exception | JS-S01 转 `JS_EXCEPTION`，异常不穿透 C++ 边界，Service 可继续 |

## 5. 准入与关联

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S02-A20 | Core accepted | immutable message 所有权转移一次；只含 key/expected kind/owner-generation 的 provisional correlation 变 active |
| JS-S02-A21 | Core queue overflow | 返回 `QUEUE_OVERFLOW`；消息/correlation 由 S02 释放；已接受消息不受影响 |
| JS-S02-A22 | Core closed before post | 返回 Port 的 typed terminal error；无 correlation 残留 |
| JS-S02-A23 | correlation capacity full | 新请求 `QUEUE_OVERFLOW`；不调用 Core，不扩容 |
| JS-S02-A24 | AppRuntime allocator 与 RequestId partition | JS Framework bootstrap 为一个 AppRuntime 只创建一个本地 `JsRequestIdAllocator`；请求模块 A、B、A 在 JS Executor 上交错共享取号，依次得到 `req:j-1`、`req:j-2`、`req:j-3` 且无碰撞，并各自在取号后把完整 typed message 交给 S02。S02 接受正确分区，拒绝 JS-origin `req:`/`req:p-`/`req:j-0`/`req:j-01`；S02 不拥有 allocator，不存在 ID Native Function、C++ allocator 调用或 ID 回传 |
| JS-S02-A25 | request Result match | kind + RequestId + Surface + generation 全匹配；S02 先删除 correlation，再把完整 typed Result 投递固定 slot 恰好一次 |
| JS-S02-A26 | transaction Result match | TransactionId + Surface + generation 全匹配；S02 先删除 correlation，再把完整 typed Result 投递固定 slot，恰好一次 |
| JS-S02-A27 | duplicate/unknown Result | 丢弃并记录；0 consumer、0 correlation 重建 |
| JS-S02-A28 | mismatched kind/Surface/generation | 不消费合法 correlation，不调用错误 consumer |
| JS-S02-A29 | out-of-order independent Results | 各自只消费对应 correlation，不要求全局 Result 顺序 |
| JS-S02-A30 | Core-origin completion | 原 `req:<positive-decimal>` 不变地回显，post accepted/rejected 正确；不分配 JS-origin ID、不创建新的 correlation |

## 6. Callback

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S02-A31 | callback accepted | Core thread只完成 typed admission/post；consumer 仅在 JS Executor 执行 |
| JS-S02-A32 | callback FIFO | 同一 producer 的 accepted 顺序保持；每条最多分发一次 |
| JS-S02-A33 | callback queue full | 当前 callback 返回 `QUEUE_OVERFLOW`；既有 callback 不丢失 |
| JS-S02-A34 | consumer token unregister | 注销后排队 callback 不调用旧对象，只释放消息 |
| JS-S02-A35 | callback field/version invalid | 入队前拒绝；Engine/consumer 未触达 |
| JS-S02-A36 | callback during close race | accepted-before-close 消息由 generation 决定消费或丢弃；无 UAF/重入 |
| JS-S02-A37 | physical single-thread mode | 仍经过 Port/queue，不直接调用 consumer 或 Core handler |

## 7. 销毁与资源

### 7.1 Surface

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S02-A38 | close active Surface | 先关闭 admission，再清 Surface bridge correlation；不触碰业务模块 pending，AppRuntime callback slot 保持；后续请求 `SURFACE_NOT_FOUND` |
| JS-S02-A39 | late Result/Event after close | 丢弃并记录；不调用旧 consumer、不复活 Surface |
| JS-S02-A40 | duplicate Surface close | 幂等；不重复完成或重复释放 token |

### 7.2 AppRuntime

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S02-A41 | normal stop | quiescing 后不再接受；14 个 binding 反向解绑；Port 关闭；最终 stopped |
| JS-S02-A42 | stop with correlation/callback queued | bridge correlation 清除一次；queued task 只释放；S02 不完成业务 pending，consumer 不在销毁后调用 |
| JS-S02-A43 | stop before/while start | partial token rollback；不创建第二套 catalog；stop 幂等 |
| JS-S02-A44 | teardown order | S02 Native entry/correlation/consumer registration/Port 先归零，随后 JS-S01 Context/Engine 才销毁 |
| JS-S02-A45 | resource counters | destroyed 后 liveNativeEntry/liveBridgeCorrelation/liveConsumerRegistration/openSurfaceScope/queuedAbiCallback 全为 0 |

循环多轮 start/open/request/result/close/stop；sanitizer 不得报告 leak、UAF、double free 或越界，TSan 不得报告 race。

## 8. 边界与观测

| ID | 检查 | 通过条件 |
|---|---|---|
| JS-S02-A46 | dependency scan | S02 无 QuickJS、Platform、Module Loader、VM、Binding、Render、Handler 实现依赖 |
| JS-S02-A47 | second Bridge/authority scan | 无 JSON RPC、generic kind/payload、module/method/args、同步 ID Bridge、S02-owned allocator、completionToken 或 S02-owned Promise/callback/Render snapshot |
| JS-S02-A48 | Observation Schema | request/result/overflow/teardown 只使用公共 marker 与结构化 ID |
| JS-S02-A49 | Noop/Recording equivalence | EnqueueResult、Port call、bridge correlation、callback 顺序、错误和资源计数完全相同 |
| JS-S02-A50 | bounded storage | codec limits、bridge correlation 和 callback queue 都由固定配置限制；PendingRecord 字段精确为 key/expected kind/owner-generation，无隐式增长 |

## 9. 需求覆盖

| 需求 | 验收出口 |
|---|---|
| JS-S02-R01 | A01-A05 |
| JS-S02-R02 | A03、A08、A12-A18、A35 |
| JS-S02-R03 | A06、A46-A47 |
| JS-S02-R04 | A01、A04-A07、A46 |
| JS-S02-R05 | A08-A09、A12-A17 |
| JS-S02-R06 | A10-A11、A20-A23、A30 |
| JS-S02-R07 | A10-A11、A18-A19 |
| JS-S02-R08 | A24 |
| JS-S02-R09 | A20-A23、A25-A30、A50 |
| JS-S02-R10 | A25-A29 |
| JS-S02-R11 | A27-A29、A39 |
| JS-S02-R12 | A31-A37 |
| JS-S02-R13 | A31-A36、A42、A45 |
| JS-S02-R14 | A21、A23、A33、A50 |
| JS-S02-R15 | A38-A40 |
| JS-S02-R16 | A41-A45 |
| JS-S02-R17 | A08、A25-A37、A46 |
| JS-S02-R18 | A27、A39、A48-A49 |

## 10. 证据

实现阶段必须提交：

1. Runtime ABI identity、14-entry Catalog 和 partial bind rollback 报告。
2. 每个 public message 的 Schema fixture 与 C++ codec 正负例映射。
3. Fake/QuickJS 共用 Native Binding + codec suite。
4. AppRuntime 唯一 allocator、多请求模块交错取号、Fake Core accepted/overflow/closed/OOM、RequestId 分区、bridge correlation 和 callback 投递报告。
5. Surface/AppRuntime teardown sequence 与资源计数。
6. Debug、ASan/UBSan、TSan、API-only 构建结果。
7. public/source dependency scan 与 second-Bridge scan。
8. Noop/Recording Observation 差异报告。

每份证据必须记录代码版本、构建配置、运行环境并回链测试 ID。

## 11. 通过条件

JS-S02 只有同时满足以下条件才可通过：

1. `JS-S02-A01..A50` 全部通过，或明确记录不适用且获得总架构确认。
2. 版本、字段、admission、typed Result 和销毁边界无未定义分支。
3. S02 不含 QuickJS/External Function Adapter，不含第二条 Bridge。
4. 无 Module Loader、VM、Binding、Render、Handler 或平台代码。
5. 无泄漏、无界存储、异常穿透、同步跨线程等待或 late callback UAF。
