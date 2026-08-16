# BM-S02 Marker 与 Trace：验收

## 目录

- [1. 结论](#1-结论)
- [2. 文档验收](#2-文档验收)
- [3. 合同与覆盖验收](#3-合同与覆盖验收)
- [4. Collector 验收](#4-collector-验收)
- [5. 等价验收](#5-等价验收)
- [6. 时钟与开销验收](#6-时钟与开销验收)
- [7. 负例与故障注入](#7-负例与故障注入)
- [8. 证据与通过条件](#8-证据与通过条件)

## 1. 结论

BM-S02 通过的唯一含义是：**公共 Trace 可以被确定地验证和有界地采集，并且开启观测不改变 Runtime 行为。**

它不代表完整 Benchmark、三平台报告或外部性能比较已经完成。

## 2. 文档验收

- 五份标准文档存在、目录完整、结论先行。
- 输入、输出、线程、所有权、状态、错误、丢样和时钟域均有唯一语义。
- 每项任务可直接映射到后续代码和自动化测试。
- 未复制或修改公共 Observation Contract/Schema。
- 未把 BM-S03 之后的存储、统计、报告或平台 Target 纳入本分 Spec。

## 3. 合同与覆盖验收

### 3.1 正例

至少构造以下有效批次：

1. baseline 成功启动与首屏链路。
2. click -> handler -> state -> render -> mount -> presented 更新链路；Event 与同步更新使用同一输入 `requestId`，Render 由 `transactionId` 闭合。
3. Bridge success 与 failed 各一例。
4. Runtime counter 四个公共名称各一例。
5. OOM、Runtime queue overflow、full rebuild success/failed 的故障注入批次。
6. 同域指标可计算，跨域无校准指标明确 unsupported。
7. JSON wire 最大安全整数合法；大 `uint64` 内部绝对时间减去共享原点后得到合法、单调的相对时间。

### 3.2 必须断言

- 所有事件通过公共 Schema。
- 成功区间起止 marker、终态、关联 ID 和时钟域合法。
- 连续输入使用不同 `requestId`；同一次输入的目标/冒泡 Handler 复用该值，并以 `handlerId` 区分区间。
- 失败区间不生成成功 duration。
- `conformance=v1` 只接受 baseline/diagnostic。
- logical bytes、transport bytes、memory bytes、object count、counter value 分开保存。
- 未触发故障时不要求故障 marker；故障注入时必须覆盖。

## 4. Collector 验收

| 场景 | 通过条件 |
|---|---|
| 正常接收 | 原始字段逐项保持，sealed batch 不可追加 |
| 跨线程保留 | 事件已复制到 Collector 自有有界存储，无 producer 悬空引用 |
| 容量耗尽 | 不阻塞、不扩容，`droppedEvents` 增加，batch invalid |
| Collector 停止 | Runtime 结果不变，批次记录封口原因 |
| Collector 失败 | Runtime 不收到回调或错误，原始已收事件仍保留 |
| drain/封口 | 等待只发生在 Benchmark 控制面，不发生在 Runtime emit 路径 |

## 5. 等价验收

对同一确定性 fixture 比较：

```text
Noop
Recording-normal
Recording-full
Recording-reject-all
Recording-stopped
```

以下必须完全一致：typed result、RuntimeError、App/Page/Surface 终态、Runtime Tree 稳定摘要、Revision、Transaction 结果、Platform command/JS dispatch 业务顺序、Node/Handler/Surface 资源终态和 full rebuild 业务结果。

允许不同：TraceEvent、Collector 元数据、实验耗时。任何其他差异使 BM-S02 失败。

## 6. 时钟与开销验收

### 6.1 时钟

- 所有 JSON wire 整数只接受公共 Schema 冻结的 `0..9007199254740991`；最大值合法，最大值加一同时被公共 Schema 与 Validator 拒绝。
- `timestampNs = nowNs - runOriginNs`，原点不进入 wire；同一 `(runId, clockDomain)` 共享原点。
- 同一生产者时钟域的 run-relative 时间不倒退；相同时间戳由 sequence 排序。
- 重复事件键、sequence 非递增和 timestamp 倒退均被稳定拒绝。
- 无校准的跨域边界不得生成合成 duration。
- 任一 wire 整数越界前必须轮换 run，不接受截断、回绕、浮点近似或文本替代。

### 6.2 热路径硬门禁

- emit 路径没有文本格式化。
- emit 路径没有文件或网络 I/O。
- emit 路径不等待 Collector 或获取 Collector 反向持有的锁。
- 缓冲和事件大小有界，不发生无界扩容。
- OOM marker 尝试路径不依赖新的堆分配成功。
- 满载路径不阻塞、不递归重试。

### 6.3 定量证据

control/noop/record/full 四组必须记录：

- 代码版本、编译器、构建模式、目标、CPU/设备和运行配置。
- 事件形状、预热、迭代和重复轮数。
- 每轮 elapsed ns、调用数和每调用摊销 ns。
- 分配次数/bytes、缓冲容量/峰值和 dropped count。

V1 不以跨设备统一百分比作为通过条件；缺少上述原始证据或违反任一硬门禁即失败。

## 7. 负例与故障注入

至少验证：

- 未知 marker、未知字段、非法 ID、失败 marker 缺 `errorCode`。
- runId 混入、重复事件键、sequence 逆序、timestamp 逆序。
- 任一 JSON wire 整数为最大安全整数加一。
- start 缺失、end 缺失、completed 与 failed 双终态。
- Bridge 缺 `requestId`；queue overflow 缺 queue counter；full rebuild 缺 Surface/MountAttempt。
- Event input/Handler 缺或错用 `requestId`、连续输入串线、冒泡更换 ID、同步更新缺输入 ID、异步任务误继承旧输入 ID。
- memory 缺 kind/phase；counter 名称越界；不同单位被错误合并。
- `conformance=v1 + observationLevel=off`。
- Collector 丢样、未封口、封口后追加。
- Recording Sink 故意改变业务分支，等价测试必须捕获。
- emit 中模拟 I/O、等待、扩容和 OOM 再分配，结构探针必须捕获。

所有负例必须保留原始输入并输出稳定问题码。

## 8. 证据与通过条件

### 8.1 证据

- 需求到测试追踪矩阵。
- 公共 Schema 正负例执行结果。
- marker 域与场景触发覆盖矩阵。
- sealed batch、问题码和原始事件样本。
- Noop/Recording 五模式业务投影差异结果。
- 单调时钟测试结果。
- 最大安全整数正例、最大值加一的公共 Schema/Validator 拒绝和 run-relative 不倒退证据。
- 热路径结构探针结果和四组开销原始轮次。
- 若存在，Handoff 中已冻结的公共合同决策。

### 8.2 PASS 条件

只有同时满足以下条件才可 PASS：

1. BM-S02-R01..R18 全部有自动化或可复现证据。
2. 所有正例、负例、故障注入和等价测试符合预期。
3. Collector 丢样和 Runtime queue overflow 未混淆。
4. 不可比较时钟域未合成伪精确指标。
5. 热路径硬门禁全部成立，定量证据完整。
6. 没有修改公共合同、Runtime 行为或其他项目边界。
7. 无未处理的 P0/P1 合同缺口；存在 `[待决策]` 时受影响部分不得标记 PASS。
8. BM-S03 未启动。
