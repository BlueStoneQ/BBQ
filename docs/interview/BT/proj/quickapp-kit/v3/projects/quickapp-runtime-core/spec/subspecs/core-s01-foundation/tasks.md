# CORE-S01 实现任务

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. 任务顺序](#3-任务顺序)
- [4. 完成定义](#4-完成定义)

## 1. 结论

实现按“合同类型 -> 队列 -> Port -> 观测 -> Fake -> 依赖验证”推进。每一步先写单元测试，再接入下一层；任何任务都不得实现后续 Core 业务模块。

## 2. 门禁

当前全部任务为设计输出，产品代码 `CODE_BLOCKED`。只有本分 Spec 独立校审通过且工作看板显式设置 `CODE_ALLOWED` 后才能执行。

## 3. 任务顺序

| ID | 任务 | 依赖 | 完成证据 |
|---|---|---|---|
| CORE-S01-T01 | 建立 Foundation 构建目标与公共头文件边界，不引入平台/引擎依赖 | 无 | 构建图和 include 检查 |
| CORE-S01-T02 | 实现 `RuntimeValue`、UTF-8/finite/safe integer 校验和 immutable message value | T01 | 值域正负例、copy/move 与 OOM 测试 |
| CORE-S01-T03 | 实现公共 `RuntimeErrorCode/RuntimeError/Expected` | T01 | 全错误码映射、关联字段和无异常测试 |
| CORE-S01-T04 | 实现全部 ID wrapper、wire parser、Owner 联合、Host 级 `AppRuntimeIdAllocator` 与 AppRuntime 级 `RequestId` 共享 allocator/互斥命名分区基础，并冻结供 CORE-S03 消费的 Factory ownership 接口 | T03 | 前缀、类型隔离、跨 AppRuntime 不复用、多 producer RequestId 唯一性、耗尽和 Factory ownership harness teardown 测试 |
| CORE-S01-T05 | 实现构造期定容 `BoundedMailbox`、close、snapshot 和 Runtime queue depth 计数 | T02-T04 | 满队列、多 producer、顺序、关闭和 OOM 测试 |
| CORE-S01-T06 | 实现 `CoreIngressPort` 与 JS/Surface/Mount 异步 Port 抽象及 accepted/error 语义 | T05 | 只入队不重入、所有权和 late result 测试 |
| CORE-S01-T07 | 实现同步只读 `PlatformMeasurePort` 抽象 | T03-T04 | measured/failed/exception conversion 和线程断言 |
| CORE-S01-T08 | 实现 `MonotonicClock`、typed `TraceEvent`、sequence 和 marker 构造校验 | T03-T04 | 时间、sequence、marker 必需字段测试 |
| CORE-S01-T09 | 实现 `TraceSink`、`NoopTraceSink` 与预分配 OOM/overflow 最小事件路径 | T08 | noexcept、无重入、OOM/overflow 测试 |
| CORE-S01-T10 | 实现 O(1) `RuntimeCounters` 与 immutable snapshot | T05 | 增减、下溢、稳定 snapshot 测试 |
| CORE-S01-T11 | 实现 ManualClock、Recording Sink、Fake Ports、FailingAllocator | T05-T10 | Fake 自身合同测试 |
| CORE-S01-T12 | 建立 Noop/Recording 行为等价测试、完整关闭竞态及 Runtime Host 多 AppRuntime 连续创建/销毁测试 | T11 | 相同接受结果、顺序、错误和 counters；Factory teardown 资源归零 |
| CORE-S01-T13 | 建立 Kernel 反向依赖与 forbidden include/symbol 检查 | T01-T12 | CI 失败负例与通过报告 |
| CORE-S01-T14 | 产出 CORE-S02 至 S11 可消费的 Foundation API 文档和测试夹具入口 | T13 | 下游编译示例仅使用抽象 Port |

## 4. 完成定义

CORE-S01 只有同时满足以下条件才完成：

1. `acceptance.md` 的全部正例、负例、故障注入和资源检查通过。
2. 公共类型与 Schema 没有第二套同义结构。
3. 异步 Port 在调用栈内不执行对端业务，Measure 是唯一同步 Port。
4. 队列容量固定、满时拒绝新消息、关闭后不能复活 Runtime。
5. Noop/Recording 除 Trace 证据外行为一致。
6. Core Foundation 的依赖图不包含平台、引擎、Collector、Benchmark 或可选模块。
7. 没有 Loader、Tree、Render、Layout、Mount、Event、Navigation 或 Capability 占位业务实现。
8. 同一 Runtime Host 内连续创建/销毁多个 AppRuntime 时 `AppRuntimeId` 从不复用，Factory teardown 后关联资源归零。
9. 同一 AppRuntime 的多 producer `RequestId` 在共享 allocator 或互斥命名分区下保持全局唯一且不复用。
