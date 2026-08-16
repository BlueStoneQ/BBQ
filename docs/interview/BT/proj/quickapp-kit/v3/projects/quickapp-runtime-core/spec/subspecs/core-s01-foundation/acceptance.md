# CORE-S01 验收

## 目录

- [1. 结论](#1-结论)
- [2. 通过条件](#2-通过条件)
- [3. 合同正例](#3-合同正例)
- [4. 负例与故障注入](#4-负例与故障注入)
- [5. 线程、销毁与资源](#5-线程销毁与资源)
- [6. 观测等价性](#6-观测等价性)
- [7. 依赖边界](#7-依赖边界)
- [8. 证据](#8-证据)

## 1. 结论

CORE-S01 的验收本质是：**在没有真实 JS 引擎和 UI 平台时，证明所有基础边界都能确定地接受、拒绝、回流和销毁，并且观测开关不改变任何业务可见结果。**

## 2. 通过条件

- Foundation 五类数据/通信基础都有唯一 C++ 类型和所有权规则。
- 队列、Port、Measure、Trace 和 counters 的失败均可注入。
- 所有线程和关闭竞态均不产生重复消费、悬空回调或 Runtime 复活。
- 公共合同中的 `OUT_OF_MEMORY`、`QUEUE_OVERFLOW` 与 Observation marker 可以关联验证。
- `AppRuntimeFactory`、Host 级 allocator 与 AppRuntime 级 RequestId allocator 的创建和销毁所有权可证明。
- Kernel 反向依赖检查通过。

## 3. 合同正例

| Case | 操作 | 断言 |
|---|---|---|
| FND-VALUE-001 | 构造所有合法 RuntimeValue | 值可 move 入队，出队内容相同且进入队列后不可变 |
| FND-ID-001 | 每类 allocator 连续产生 ID | 前缀正确、强类型不可混用、scope 内严格不复用 |
| FND-ID-002 | 同一 Runtime Host 执行 `create A -> destroy A -> create B -> destroy B -> create C` | ID 均由 Core AppRuntimeFactory 生成且三者不同；销毁 AppRuntime 不重置 Host 级 allocator；Host 未传入 ID |
| FND-ID-003 | 同一 AppRuntime 的至少四个 producer 并发生成 RequestId | 使用共享 allocator 或预先冻结的互斥命名分区；所有 wire ID 全局唯一且 producer 重建后不复用 |
| FND-QUEUE-001 | 多 producer 向未满 mailbox 投递唯一序号消息 | 每个 accepted 消息恰好消费一次，线性化顺序一致 |
| FND-PORT-001 | Fake JS/Surface/Mount 接受命令后异步回流 Result | `post` 只返回 accepted；业务 Result 经 CoreIngress 后到达 |
| FND-MEASURE-001 | Core owner thread 调用 Fake Measure | 同步返回拥有自身数据的 measured/failed，不触碰 UI queue |
| FND-CLOCK-001 | ManualClock 按整数纳秒推进 | 同一 domain 时间非递减、sequence 严格递增 |
| FND-COUNTER-001 | Node/Handler/Surface 和 queue 增减 | 每次 O(1) 更新，snapshot 数值正确且不扫描对象集合 |

## 4. 负例与故障注入

| Case | 注入 | 必须结果 |
|---|---|---|
| FND-VALUE-NEG-001 | NaN、Infinity、越界整数、非法 UTF-8、循环容器 | 构造失败，不产生 RuntimeValue 消息 |
| FND-ID-NEG-001 | 空 payload、错误前缀、裸字符串跨类型使用 | `ABI_INVALID_ARGUMENT` 或编译期拒绝 |
| FND-ID-NEG-002 | Platform Host 尝试传入或覆盖 AppRuntimeId | Factory API 不提供该参数，编译期或边界校验拒绝 |
| FND-ID-NEG-003 | 两个 RequestId producer 使用相同 namespace 与局部序列 | 组成/初始化失败，不允许进入可生成 ID 的运行状态 |
| FND-QUEUE-NEG-001 | 容量为 N 时投递 N+1 条 | 前 N 条保持；新消息返回 `QUEUE_OVERFLOW`，调用方仍拥有它 |
| FND-QUEUE-NEG-002 | close 后继续 post | Mailbox 稳定返回 `closed`，Gateway 映射为请求合同已有的 terminal error；不增加 depth，不调用 consumer |
| FND-OOM-001 | mailbox 构造槽位分配失败 | Runtime 创建返回 `OUT_OF_MEMORY`，无半初始化入口 |
| FND-OOM-002 | 消息深拷贝/封装失败 | 返回 `OUT_OF_MEMORY`，depth 和消息所有权不变 |
| FND-MEASURE-NEG-001 | Fake 抛内部异常或返回 failed | Port 边界转成 `MEASURE_FAILED`，无异常穿透 |
| FND-TRACE-NEG-001 | Recording Sink 容量满 | 仅样本标记丢失；业务 accepted/result/order/counters 不变 |
| FND-CLOCK-NEG-001 | 测试时钟回退 | 观测样本判无效；业务状态和错误不变 |
| FND-COUNTER-NEG-001 | counter 下溢 | 无 unsigned 回绕；debug 可检测，release 保持合法值 |

OOM 路径最多尝试一次预分配/栈上 `runtime.oom`；队列满尝试一次 `queue.overflow`，包含 `counterName=queue.depth`、当前 depth 和 `QUEUE_OVERFLOW`。Trace 尝试失败不能递归重试。

## 5. 线程、销毁与资源

1. 使用至少四个 producer 并发投递，证明单 consumer 下无覆盖、重复、丢失 accepted 消息和数据竞争。
2. 在 post 与 close 竞争时，每次 post 必须线性化为 accepted 或 rejected，不能处于未知所有权状态。
3. close 后让 Fake JS/Platform 发送晚到 Result，证明入口拒绝、外围释放消息且不访问已销毁 Runtime。
4. drain 与 cancel 两种 teardown 策略都保持已接受消息的确定顺序；具体业务取消结果留给后续分 Spec。
5. 析构后 mailbox depth 为零，Fake Port 无 pending command，Recording Sink 不拥有 Runtime 引用。
6. ThreadSanitizer 或等价数据竞争工具覆盖 mailbox、close 和 counters；AddressSanitizer 或等价工具覆盖所有权与 late result。
7. Runtime Host teardown 顺序必须为：Factory 停止创建 -> 全部 AppRuntime 完成 teardown -> Factory/`AppRuntimeIdAllocator` 销毁；最终 `liveAppRuntime=0`、`pendingCreate=0`、全部 mailbox depth=0、pending request=0，且无 allocator/回调悬空引用。
8. 单个 AppRuntime teardown 后，其 RequestId allocator、pending correlation 和 Surface tombstone 归零；Host 级 AppRuntimeId allocator 仍存活且序列不回退，直到最后一个 AppRuntime 销毁后才释放。

## 6. 观测等价性

同一组固定时钟、消息、Fake Result 和故障注入分别运行：

```text
Run A: NoopTraceSink
Run B: RecordingTraceSink
Run C: RecordingTraceSink 固定容量耗尽
```

三次运行必须具有完全相同的：

- EnqueueResult 与异步业务 Result。
- accepted 消息消费顺序。
- RuntimeError、ID 分配、queue depth 与全部 counters snapshot。
- close/cancel/drain 顺序。

只有 Trace 记录集合和样本有效性允许不同。Recording 事件必须通过公共 Observation Schema 等价校验，时间为整数纳秒，失败 marker 含要求的关联字段和 `errorCode`。

## 7. 依赖边界

自动检查公共头文件、link map 或符号清单，必须证明不存在：

- QuickJS 或其他 JS Engine Provider 类型。
- JNI、Android、UIKit、LVGL、SDL 和平台句柄。
- Collector、文件系统日志、Benchmark 或可选 Feature 实现。
- Kernel 到 Platform/Backend/Provider 的反向链接。
- Kernel 业务路径的外围条件编译宏。

## 8. 证据

- 单元测试与属性测试报告。
- 多 producer mailbox 压测及数据竞争检查报告。
- OOM、queue overflow、closed port、late result 故障注入记录。
- 多 AppRuntime 连续创建/销毁 ID 序列、RequestId 多 producer 唯一性与 Factory teardown 资源快照。
- Noop/Recording/Recording-full 三组行为 diff，业务部分必须为空。
- Observation Schema 校验结果。
- forbidden include、依赖图和 link/symbol 检查结果。
- 无真实 JS Engine、Android、LVGL 或 iOS 依赖的 Fake Port 测试运行记录。
