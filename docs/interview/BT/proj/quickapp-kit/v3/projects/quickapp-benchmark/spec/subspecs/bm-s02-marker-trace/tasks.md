# BM-S02 Marker 与 Trace：任务

## 目录

- [1. 结论](#1-结论)
- [2. 实施原则](#2-实施原则)
- [3. 编码任务](#3-编码任务)
- [4. 依赖顺序](#4-依赖顺序)
- [5. 完成定义](#5-完成定义)

## 1. 结论

BM-S02 后续编码应先实现纯数据验证，再实现内存 Collector 测试件，最后完成等价与开销证据。不得先建设 CLI、数据库或报告界面。

当前只允许完成 P0-OBS-002 定向返修；BM-S03 继续阻塞。

## 2. 实施原则

1. 复用公共 Schema，不复制可独立演进的 marker 枚举和字段定义。
2. 验证核心使用平台无关纯逻辑，可对内存输入执行。
3. 原始 Trace 不可变；所有诊断写入独立结果对象。
4. Collector 有固定容量和显式丢样计数。
5. 测试先覆盖负例与故障注入，再接入真实平台数据。

## 3. 编码任务

### BM-S02-T01：建立模块骨架与公共合同加载

- 在 `quickapp-benchmark` 工程中建立 `marker-trace` 模块及测试目标。
- 以公共 `observation.schema.json` 和 `runtime-composition.schema.json` 为只读输入。
- 固定 Validator/Collector 内部模型版本和公共合同 revision 记录方式。
- 禁止改动 Runtime 或公共合同文件。

完成定义：模块可在无平台 SDK 环境中构建；能加载并识别当前公共 Schema 版本。

### BM-S02-T02：实现单事件 Schema 校验

- 校验 required、enum、pattern、conditional required 和 `additionalProperties=false`。
- 直接消费公共 Schema 的 JSON wire 整数上限，覆盖最大安全整数正例和最大值加一负例。
- 输出稳定内部问题码、事件键和影响范围。
- 保留非法原始事件，不进行容错改写。

完成定义：公共 Schema 正例全部通过；最大安全整数合法；最大值加一、未知 marker/字段、非法 ID、失败缺 errorCode 等负例稳定失败。

### BM-S02-T03：实现流顺序与批次校验

- 按 `(runId, producer, clockDomain)` 建立流索引。
- 检测重复事件键、sequence 非递增、timestamp 逆序和 runId 混入。
- 验证 `timestampNs` 为 run-relative wire 时间；同一 `(runId, clockDomain)` 使用共享原点的语义由公共合同提供，Validator 不推造隐藏原点。
- 校验 Manifest 的 `conformance/observationLevel/profile/engine` 身份。
- 实现 valid/invalid/unsupported 与 affected scope。

完成定义：顺序、时钟和 Manifest 正负例全部可自动执行。

### BM-S02-T04：实现边界、终态与关联验证

- 只从公共 Observation Contract 建立指标边界规则。
- 实现 start -> success/failure 单终态检查。
- 校验 Bridge request、Surface、Render/Mount、Navigation、Capability、full rebuild 的已有关联字段。
- Event 按输入 `requestId` 匹配，Handler 区间再按 `handlerId` 区分，同步更新继续携带该 request 并由 `transactionId` 闭合 Render；覆盖连续输入、目标/冒泡与异步不继承。
- 缺失边界或无法校准时不得产生成功 duration。

完成定义：每个公共 V1 指标至少有成功、失败、缺边界、终态冲突和跨域不可合成用例；Event 另有缺/错 RequestId、连续输入串线、冒泡换 ID 和异步误继承负例。

### BM-S02-T05：实现覆盖与单位验证

- 建立按场景触发能力声明的覆盖检查，不要求未触发故障 marker。
- 覆盖全部 V1 生产域。
- 校验 Bridge、OOM、Runtime queue overflow、full rebuild 和四类 Runtime counter。
- 校验 logical/transport bytes、memory bytes、object count 与 counter value 不混用。

完成定义：覆盖矩阵可输出缺口；Collector 丢样不会被误判为 `queue.overflow`。

### BM-S02-T06：实现有界 In-Memory Collector 测试件

- 实现 `created/accepting/sealing/failed/sealed` 状态机。
- 配置固定 event capacity；记录 received/dropped/ordinal/seal reason。
- 保证封口后不可追加，Collector 失败不回调 Runtime。
- 事件保留使用 Collector 自有存储，不借用 producer 生命周期。

完成定义：并发接收、满载、停止、失败和封口测试通过；内存上界可由配置计算。

### BM-S02-T07：实现 Noop/Recording 等价 Harness

- 提供固定输入、Fake Clock 以外的确定性业务依赖和稳定业务投影。
- 运行 Noop、正常 Recording、满载 Recording、拒绝 Recording、Collector stopped 五种模式。
- 比较 typed result、状态、Revision、Platform command/JS dispatch 顺序及资源终态。
- 排除 Trace 时间和 Collector 元数据。

完成定义：等价正例通过；注入一个 Trace 引发业务分支的错误实现时测试必须失败。

### BM-S02-T08：实现单调时钟合同测试

- 对 Fake Clock 验证整数纳秒、相同时间戳和逆序检测。
- 使用大于 JSON 安全整数的内部 `uint64` 绝对时钟样本，减去共享原点后验证所得相对时间合法且不倒退。
- 验证最大安全整数合法、最大值加一失败；越界只能轮换 run，不得截断、回绕、浮点近似或文本化。
- 对目标 Runtime Clock 进行多线程/长循环采样，证明非负且每线程观察不倒退。
- 不以 wall clock 校正生产者时间。

完成定义：Fake 与目标 Clock 证据保存；任何倒退使对应流无效。

### BM-S02-T09：实现热路径结构探针

- 使用替身或平台可用探针检测 emit 路径文件/网络 I/O、阻塞等待和堆分配。
- 对 OOM marker 路径执行受控分配失败注入。
- 检查满载路径不扩容、不递归重试。

完成定义：结构违规可被测试捕获；正常路径满足全部硬门禁。

### BM-S02-T10：实现定量开销实验

- 实现 control/noop/record/full 四组固定负载。
- 固定预热、事件形状、线程、构建模式和迭代配置。
- 输出每轮原始 elapsed ns、调用数、分配、缓冲占用和 dropped count。
- 不在本任务中实现 percentile 平台或跨设备统一阈值。

完成定义：同一命令可复测并生成完整原始证据；结果包含环境与代码版本。

### BM-S02-T11：建立合同覆盖清单与变更升级

- 将所有需求和验收项映射到自动化测试。
- 若实现证明公共合同无法表达必需事实，只追加 Benchmark Handoff `[待决策]`。
- 未冻结前跳过且明确标记受影响测试，不私建字段或 marker。

完成定义：需求无遗漏；所有待决策项有明确阻塞范围。

## 4. 依赖顺序

```text
T01 -> T02 -> T03
            -> T04 -> T05
T01 -> T06 -> T07
T01 -> T08
T06 -> T09 -> T10
T02..T10 -> T11
```

T04/T05、T07、T08 和 T09/T10 可在各自前置完成后并行。

## 5. 完成定义

- BM-S02-R01..R18 均映射到实现与测试。
- 公共 Schema 未被复制或修改。
- 正例、负例、丢样、故障注入、等价和开销测试全部通过。
- 原始事件与原始开销轮次可回链，Validator 不修改输入。
- 没有产品代码越界到 Runtime、平台项目、完整统计或报告系统。
- 对应证据满足 [验收](./acceptance.md)，可提交实现校验。
- P0-OBS-002 的 wire 上界、run-relative 单调性和公共 Schema/Validator 双重拒绝均有自动化证据；BM-S03 未启动。
