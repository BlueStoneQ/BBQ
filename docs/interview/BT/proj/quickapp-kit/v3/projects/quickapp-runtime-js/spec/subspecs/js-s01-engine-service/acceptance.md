# JS-S01 JS Engine Service：验收

## 目录

- [1. 结论](#1-结论)
- [2. 验收环境](#2-验收环境)
- [3. Port 合同](#3-port-合同)
- [4. 线程与队列](#4-线程与队列)
- [5. 生命周期与资源](#5-生命周期与资源)
- [6. QuickJS 封装](#6-quickjs-封装)
- [7. 异常与故障注入](#7-异常与故障注入)
- [8. 观测等价性](#8-观测等价性)
- [9. 可裁剪与依赖](#9-可裁剪与依赖)
- [10. 需求覆盖](#10-需求覆盖)
- [11. 证据](#11-证据)
- [12. 通过条件](#12-通过条件)

## 1. 结论

JS-S01 的验收本质是证明：**换掉 Engine Provider，不改变 Framework 可见的 Port、线程、Value、异常和销毁语义。**

Fake 能工作但 QuickJS 泄漏、QuickJS 能执行但公共层依赖 QuickJS、或关闭观测后行为变化，均不得通过。

## 2. 验收环境

至少运行：

| 配置 | 用途 |
|---|---|
| Fake + ManualPumpDriver | 确定性 Port/状态机/故障测试 |
| Fake + OwnedThreadDriver | 并发 admission、线程和停止竞态 |
| QuickJS + OwnedThreadDriver + Noop Sink | 生产路径基线 |
| QuickJS + OwnedThreadDriver + Recording Sink | 观测等价与 Schema |
| QuickJS + sanitizer | UAF、double free、leak、越界检测 |

所有证据记录代码版本、构建模式、QuickJS 真实版本、limits、线程模式和 Observation level。进入 Runtime 的 Noop/Recording Sink 必须预先满足 `emit noexcept + nonblocking + no reentry`；真实 throw/block/reentry 不进入 Runtime 测试矩阵。

## 3. Port 合同

公共 `EngineContractSuite` 必须对 Fake 与 QuickJS 参数化运行。

### 3.1 正例

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S01-A01 | descriptor | `engineAbi=quickapp-kit-js-engine-v1`；QuickJS identity 与 Manifest 一致 |
| JS-S01-A02 | Context create/destroy | 创建一次、销毁一次；重复销毁安全失败 |
| JS-S01-A03 | evaluate/call | 最小 source 求值、函数调用和 this/args 结果一致 |
| JS-S01-A04 | property | global/get/set/isCallable 语义一致 |
| JS-S01-A05 | retain/release | 显式 retain 产生独立拥有引用；释放顺序不影响剩余引用 |
| JS-S01-A06 | RuntimeValue round-trip | null/bool/finite number/string/nested array/plain object 无语义变化 |
| JS-S01-A07 | Native Binding | 参数、this、返回值和 unbind 语义一致；只执行一次 |
| JS-S01-A08 | microtask | FIFO 执行；预算耗尽返回 yielded；只存在一个 continuation |
| JS-S01-A09 | GC/memory | 显式 GC 可调用；snapshot 为非负整数且不改变 JS 结果 |

### 3.2 负例

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S01-A10 | ABI mismatch | 执行 source 前返回 `MODULE_ABI_UNSUPPORTED`；无 Context/Value 创建 |
| JS-S01-A11 | wrong Context/Service | 操作稳定失败；无引擎内存访问 |
| JS-S01-A12 | wrong Executor | 操作稳定失败；debug 可断言，release 不崩溃 |
| JS-S01-A13 | released Value | 操作稳定失败；无 UAF/double free |
| JS-S01-A14 | Context destroy with live Value | debug 报持有者；release 在 Context 前确定释放并记录失败 |
| JS-S01-A15 | non-callable call | 结构化 Runtime exception，不污染下一次 operation |
| JS-S01-A16 | invalid RuntimeValue | undefined/function/Symbol/BigInt/NaN/Infinity/cycle/unsafe integer/超限均拒绝为 `ABI_INVALID_ARGUMENT` |
| JS-S01-A17 | getter/Proxy data decode | 不隐式执行副作用；稳定拒绝 |
| JS-S01-A18 | duplicate/unbound Native Function | 无重复 binding 泄漏；已解绑函数不能再进入 native callback |

## 4. 线程与队列

### 4.1 FIFO 与并发 admission

1. 多个 producer 并发投递至少覆盖队列容量边界。
2. 每个 accepted task 获得唯一递增 acceptance sequence。
3. 消费顺序与 sequence 一致。
4. 所有 Engine/Context/Value operation 的 thread identity 相同。
5. OwnedThread 与 ManualPump 对同一有序输入产生相同 operation sequence。

### 4.2 背压

| ID | 注入 | 通过条件 |
|---|---|---|
| JS-S01-A19 | 填满业务队列再投递 | 仅新任务返回 `QUEUE_OVERFLOW`；已接受任务完整执行 |
| JS-S01-A20 | 合规 Recording Sink 正常、容量满、拒绝保留、丢样和关闭 | 各模式的业务任务结果、顺序和 admission 不变 |
| JS-S01-A21 | microtask 持续产生新 job | 每轮不超过 budget；continuation 去重；普通队列获得执行机会 |

### 4.3 禁止同步环

通过测试 driver 注入 Core-like producer 与 Native Binding：任一 producer 不等待 JS completion；Native callback 不同步等待外部 result。TraceSink 的 no-reentry 是注入前置合同；受控替身只能记录重入意图并由门禁拒绝，不能真的回调 Runtime。线程分析工具不得发现环形等待。

## 5. 生命周期与资源

### 5.1 状态机

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S01-A22 | normal start/stop | `new -> starting -> running -> quiescing -> stopped`；completion 各一次 |
| JS-S01-A23 | provider create failed | 已创建资源反向释放，最终 stopped |
| JS-S01-A24 | Context create failed | Engine 释放，Executor 停止，无 Value |
| JS-S01-A25 | duplicate start/stop | 不创建第二套 Engine；stop completion 不重复 |
| JS-S01-A26 | stop while tasks queued | 关闭 admission；未执行 normal task cancellation 各一次；teardown barrier 各一次 |
| JS-S01-A27 | post after quiescing | rejected(stopping)，不进入 Engine |

### 5.2 释放证据

循环执行不少于资源测试配置规定的多轮 start/evaluate/bind/microtask/stop，destroyed 后必须满足：

```text
liveEngine = 0
liveContext = 0
liveValue = 0
liveNativeBinding = 0
pendingTask = 0
pendingMicrotaskContinuation = 0
```

sanitizer 或平台等价工具不得报告 leak、UAF、double free。进程退出不得被当作正常释放手段。

## 6. QuickJS 封装

### 6.1 静态边界

1. `JSRuntime/JSContext/JSValue`、QuickJS include 和 External Function trampoline 只出现在 `providers/quickjs/**`。
2. engine API、executor 和未来 Framework 的 public symbol/header 中不存在 QuickJS 名称或 raw handle。
3. Provider 不创建线程/EventLoop。
4. `engineVersion` 来自真实依赖构建事实，不是手写常量副本。

### 6.2 External Function

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S01-A28 | success | raw args 被包装为借用视图；返回 Value 正确交还 QuickJS |
| JS-S01-A29 | RuntimeError | JS 侧得到保留稳定 error code 的 Error/rejection |
| JS-S01-A30 | native C++ throw | callback 边界捕获并转 `JS_EXCEPTION`，C++ 栈不泄漏异常 |
| JS-S01-A31 | argument retained | 显式 retain 后可在同 Context 后续使用；未 retain 的 borrowed view 不可保存 |
| JS-S01-A32 | unbind/destroy | provider-owned binding record 在 Context 前释放，无 trampoline 悬空 |

## 7. 异常与故障注入

| ID | 注入 | 预期 |
|---|---|---|
| JS-S01-A33 | syntax error | `EngineException(Syntax)` -> `JS_EXCEPTION`；下一次合法 eval 成功 |
| JS-S01-A34 | runtime throw | `EngineException(Runtime)` -> `JS_EXCEPTION`；pending exception 已清除 |
| JS-S01-A35 | function throw | call 失败一次；下一个独立 call 不受污染 |
| JS-S01-A36 | allocator OOM | `OUT_OF_MEMORY`；尝试发最小 `runtime.oom`；无递归分配/自动换 Engine |
| JS-S01-A37 | unrecoverable provider fault | Service 进入 failed，拒绝新任务并完成确定销毁 |
| JS-S01-A38 | 受控 Sink 替身声明重入意图 | 注入门禁拒绝该替身，不启动 Engine operation；不测试真实重入后的恢复 |

错误判断只依赖 kind/code，不匹配 message 或 stack 文本。

`A38` 是注入合同门禁，不是 Runtime 故障恢复。真实 throw、真实阻塞或真实重入不作为故障注入，因为调用方无法可靠隔离这些 C++ 合同违约。

## 8. 观测等价性

### 8.1 注入前置合同

1. `TraceSink::emit` 的接口签名必须为 `noexcept`。
2. 生产 Sink 必须有静态检查和平台集成证据，证明热路径不等待锁/条件变量、文件 I/O、网络 I/O 或 Collector，并且不持有 Runtime callback/reentry capability。
3. 受控替身只模拟正常 Recording、容量满、拒绝保留、丢样、关闭和重入意图；重入意图在注入门禁被拒绝，不能实际调用 Runtime。
4. Emitter 不实现 catch、调用超时、隔离线程或 watchdog。真实 throw 可能按 C++ `noexcept` 终止进程，真实 block/reentry 无可靠调用方兜底，三者均属于非法实现。

### 8.2 行为等价

对同一 Fake plan 和 QuickJS source sequence，分别运行 Noop 与 Recording：

```text
必须相同：
  EngineResult / RuntimeError
  acceptance sequence / execution order
  microtask count and yielded points
  Context/Value/Binding lifecycle
  final Service state / resource counters

允许不同：
  TraceEvent collection itself
  Observation-only sequence/timestamp
```

合规 Recording 在正常、容量满、拒绝保留、丢样和关闭模式下均必须满足：

1. `producer=js`、`timestampNs` 为非负整数、同 clockDomain sequence 严格递增。
2. 稳定采样产生 `runtime.counter.sampled`，只使用 `counterName=queue.depth` 和当前深度。
3. queue full 产生一个 `queue.overflow`，带 `QUEUE_OVERFLOW/queue.depth/current depth`。
4. OOM 尽力产生 `runtime.oom`，带 `OUT_OF_MEMORY`；无法发出不改变 OOM 结果。
5. 不产生 S01 未拥有事实的 `module/bridge/lifecycle/handler/render` marker。
6. 所有已保留 event 通过公共 Observation Schema；热路径无文本格式化、文件 I/O 和 Collector 等待。

## 9. 可裁剪与依赖

| ID | 检查 | 通过条件 |
|---|---|---|
| JS-S01-A39 | API target dependency | 无 QuickJS、Platform、Backend、可选 Provider 依赖 |
| JS-S01-A40 | QuickJS production target | Manifest、descriptor、link map 均且仅含 `engine.quickjs` |
| JS-S01-A41 | Fake test target | 可运行合同测试，但生产 link map/symbol inventory 不含 Fake |
| JS-S01-A42 | missing/multiple Engine | 构建或启动预检失败，不执行 source |
| JS-S01-A43 | Runtime Composition Schema | `runtime.js-framework` 一次、Engine module 一次、identity 一致 |

## 10. 需求覆盖

| 需求 | 验收出口 |
|---|---|
| JS-S01-R01 | A39、QuickJS 静态边界检查 |
| JS-S01-R02 | A01、A10、A40、A42、A43 |
| JS-S01-R03 | A02、A11、A12、A22..A27、资源回落 |
| JS-S01-R04 | A03、A04、A15 |
| JS-S01-R05 | A05、A11..A14、资源回落 |
| JS-S01-R06 | A06、A16、A17 |
| JS-S01-R07 | A07、A28..A32 |
| JS-S01-R08 | A07、A30、A31、禁止同步环 |
| JS-S01-R09 | A08、A21 |
| JS-S01-R10 | A19、FIFO 与并发 admission |
| JS-S01-R11 | A22..A27、资源回落 |
| JS-S01-R12 | A33..A36 |
| JS-S01-R13 | A33..A38 |
| JS-S01-R14 | A01、A40、版本证据 |
| JS-S01-R15 | A01..A18、Fake/QuickJS common suite |
| JS-S01-R16 | 观测等价性 1..5 |
| JS-S01-R17 | A20、A38、注入前置合同、Noop/Recording 差异比较 |
| JS-S01-R18 | A09、资源与内存证据 |

## 11. 证据

必须提交：

1. Fake/QuickJS 参数化 Engine Contract Suite 报告。
2. RuntimeValue 全值域与负例报告。
3. 并发 FIFO、overflow、microtask budget、quiescing 竞态报告。
4. start/stop 与故障注入状态转换记录。
5. sanitizer 或等价资源报告和 destroyed 计数。
6. TraceSink 静态/集成门禁、受控重入意图拒绝、Noop/Recording 各合法模式差异比较与 Observation Schema 校验结果。
7. public header dependency scan、link map、symbol inventory。
8. Runtime Composition Manifest、QuickJS 真实版本和 descriptor 对照。

每份证据必须可回链到测试 ID 和代码版本；截图不能代替机器可读结果。

## 12. 通过条件

JS-S01 只有在以下条件全部成立时为 PASS：

1. `JS-S01-A01..A43` 全部通过，或明确记录不适用且获得总架构确认。
2. Fake 与 QuickJS common suite 无公共语义差异。
3. 没有 QuickJS/Platform 类型泄漏，没有第二条业务 Bridge。
4. 没有资源泄漏、无界队列、异常穿透或同步环形等待。
5. 只注入满足 `noexcept/nonblocking/no-reentry` 的 Sink；Observation 正常、容量满、拒绝、丢样和关闭不改变任何 Runtime 行为。
6. 未实现 JS-S02..S09 的职责。
