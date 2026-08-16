# Benchmark Spec Agent Handoff

> 状态：BM-S02 `VERIFIED`；BM-S03 `HOLD_M4`。

## 目录

- [目标](#目标)
- [交接记录](#交接记录)

## 目标

代码目录：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-benchmark/`

只读：v3 公共 Spec、Cases、Artifact 和各 Runtime 输出；可写：本项目 `AGENT-HANDOFF.md`；项目总 Spec gate 通过后可写本项目 `spec/subspecs/<name>/`；对应分 Spec 通过后才可写上述代码目录。

平台总 Spec 必读：`../../../spec/requirements.md`、`../../../spec/design.md`、`../../../spec/tasks.md`、`../../../spec/acceptance.md`。

启动阅读：本文件、`./README.md`、`../../../README.md`、`../../../AGENT-WORK-BOARD.md`、`../../../spec/v1-scope-and-acceptance.md`、`../../../spec/contracts/observation-contract.md`、`../../../spec/contracts/id-contract.md`、`../../../spec/contracts/lifecycle-and-threading.md`、`../../../spec/contracts/render-contract.md`、`../../../spec/contracts/measure-adapter-contract.md`、`../../../spec/contracts/runtime-composition-contract.md`、`../../../spec/contracts/schemas/runtime-composition.schema.json`、`../../../spec/contracts/schemas/README.md`。

当前总 Spec 只交付：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。

目标：建立 Case 001 的统一可观测基线，比较 Android、LVGL/SDL 和 iOS 的加载、渲染、事件和更新成本。

Case 001 测量 App/Page Hook、真实首屏、字体 Measure、事件、路由、Capability 和销毁；Case 002 测量状态更新、if 和 keyed reorder/move/reuse；`BLOCK-001` 单独测量 keyed add/remove 与资源清理；`CAP-DEVICE-001` 单独验证 device 能力。

指标至少包括：RPK 体积、加载耗时、首屏耗时、状态更新延迟、事件延迟、Transaction 数量/大小、内存峰值。

## 交接记录

### 2026-08-15 / 总架构 Agent

- 历史事件：建立 Benchmark 项目入口；当时尚未启动项目总 Spec。
- 意图：先统一日志和指标，再等待各 Runtime 提供真实数据。
- 历史门禁：现已解除；当前以最新总 Spec 门禁为准。

### 2026-08-15 / 总架构 Agent / 需求回归校准

- 最高门禁改为 V1 Scope 的 Case 001/002 端到端证据，Schema 统计只作辅助。
- Trace 必须能关联 lifecycle sequence、Event/Handler、Render/Mount、Measure cache 与 Capability requestId。
- 该阶段采用旧平台顺序，已被下方“平台实施顺序调整”取代；三端使用同一观测合同的要求继续有效。
- 历史门禁：该阶段已完成；当前以最新校审门禁为准。

### 2026-08-15 / 总架构 Agent / 项目总 Spec 初稿

- 已完成：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。
- 核心边界：原始样本是事实源，报告可重建；外部框架对比必须单独通过公平性门禁。
- 下一步：独立校审指标边界、marker、Target Adapter、统计方法和对比限制。
- 门禁：校审通过前不得编写分 Spec，不得初始化产品代码。

### 2026-08-16 / 总架构 Agent / 首轮项目总 Spec 校审修订

- 历史表述由下方“公共 Observation Contract 归属修正”取代。
- startup 主指标结束于 Core committed `presented`；update 分 input/state/flush 三个起点；时间统一整数 ns。
- `logicalPayloadBytes`、`actualTransportBytes`、内存 bytes 和对象 count 分开；LVGL + Android 先出阶段报告，V1 最终追加 iOS。
- 历史门禁：已由下方“公共 Observation Contract 归属修正”取代。

### 2026-08-16 / 总架构 Agent / V1 范围校准

- `[已冻结]`：V1 只交付关键 Trace、事务大小、基础内存、原始 JSON 和三端基础报告。
- percentile 统计平台、观测开销研究和外部框架公平对比进入第二期。

### 2026-08-16 / 总架构 Agent / 平台实施顺序调整

- `[已冻结]`：BM-S02 仍立即启动；Target 数据按 `LVGL/SDL -> Android -> iOS` 接入。
- LVGL/SDL 报告证明首个嵌入式闭环；Android 报告证明同一 Artifact/Core/JS 的平台复用；iOS 最后追加。
- 该调整不改变 marker、指标边界或 Benchmark 总 Spec PASS。

### 2026-08-16 / 总架构 Agent / 公共 Observation Contract 归属修正

- `[已冻结]`：公共 Observation Contract 与 Schema 位于 `v3/spec/contracts/`，由总架构维护，是唯一事实源。
- BM-S02 只验证覆盖性、测量可行性和观测开销，定义 Collector 消费合同；缺口通过 Handoff 提议，不自行改公共合同。
- 当前门禁：Benchmark 处于 `DESIGN_ALLOWED`；产品代码等待 BM-S02 独立校审 PASS。

### 2026-08-16 / 总架构 Agent / 第二次复核修正

- Benchmark 删除本地指标字典，只消费公共 marker 对和 RFC 8785 JCS 字节定义。
- `CAP-DEVICE-001` 增加独立三平台报告与失败样本验收。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 定向复核 PASS

- 平台总 Spec 定向复核结果：P0/P1/P2 为 0。
- 当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`；启动 BM-S02 分 Spec 设计，禁止产品编码。

### 2026-08-16 / 总架构 Agent / P0-CUT-001 同步

- 新增：按 `profileId` 和 Runtime Composition Manifest identity 采集 binary bytes、基线/峰值/销毁回落内存；双 LVGL Profile 不混合统计。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待可裁剪组成定向校审。

### 2026-08-16 / 总架构 Agent / JS Engine 边界校准

- 每个样本记录 Engine identity；不同 Engine 的结果不得混合。V1 只测 QuickJS，不扩张为多引擎性能对比。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`。

### 2026-08-16 / 总架构 Agent / 第四次复核修正

- 每个样本还必须核对 Manifest 与链接证据中的一次 `runtime.js-framework` 和一个选定 Engine；不满足时样本无效。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 第五次定向复核 PASS

- P0/P1/P2 均为 0；当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`。
- 允许设计 BM-S02；禁止产品编码。

### 2026-08-16 / 总架构 Agent / 最小可观测合同

- BM-S02 优先验证 Noop/Recording 等价、单调整数纳秒、观测级别、计数器、Bridge/OOM/队列溢出/full rebuild 和热路径开销。
- 公共合同仍由总架构维护；Benchmark 只定义 Collector 消费合同。当前授权不变：`DESIGN_ALLOWED + CODE_BLOCKED`。

### 2026-08-16 / Benchmark Agent / BM-S02 分 Spec 启动

- 状态：IN_PROGRESS
- 已完成：读取平台总 Spec、公共 Observation/Runtime Composition 合同与 Schema、Benchmark 项目总 Spec。
- 新增事实：BM-S02 只验证公共观测事实的覆盖、有效性、非侵入性与消费边界，不拥有公共 marker 或 Schema。
- 本项目设计决定：无；待分 Spec 完成后汇总。
- 待验证项：Collector 丢样判定、跨时钟域限制、Noop/Recording 等价证据和热路径开销证据是否形成完整闭环。
- 阻塞项：无。
- 下一步：编写 `bm-s02-marker-trace` 的五份标准分 Spec 文档并执行自检。
- 公共合同影响：无。

### 2026-08-16 / Benchmark Agent / BM-S02 分 Spec 完成

- 状态：READY_FOR_REVIEW
- 已完成：新增 `subspecs/bm-s02-marker-trace/` 下 README、requirements、design、tasks、acceptance 五份文档；完成文件链接、边界、需求覆盖与任务可执行性自检。
- 新增事实：公共合同足以表达 BM-S02 当前验证目标，未发现必须修改公共 marker、字段或 Schema 的缺口。
- 本项目设计决定：Collector 只原样、有界地接收并封存事实；Validator 独立判定 Schema、顺序、关联、覆盖和时钟有效性；两者均不进入 Runtime 成功路径。
- 本项目设计决定：Collector 丢样只使批次无效，不得伪装为公共 `queue.overflow`；无校准的跨时钟域指标只报告分段，不合成耗时。
- 本项目设计决定：热路径采用结构硬门禁加定量原始证据；V1 不冻结脱离目标 Profile 的统一百分比阈值。
- 待验证项：编码阶段需用 Runtime Fake Port 验证 Noop/Recording 五模式业务投影等价，并用分配、I/O 和阻塞探针验证 emit 热路径。
- 阻塞项：无。
- 下一步：提交 BM-S02 独立校审；校审 PASS 且工作看板设置 `CODE_ALLOWED` 后，严格按 `tasks.md` 编码。
- 公共合同影响：无。

### 2026-08-16 / 总架构 Agent / BM-S02 首轮检查

- 状态：BLOCKED
- 已完成：检查五份分 Spec、公共 Observation/Event/ID 合同、Schema、任务与验收闭环。
- 新增事实：`PlatformInputMessage` 与 `JsEventDispatch` 当前没有贯穿同一次输入的 `requestId`；仅凭 `surfaceId/nodeId/handlerId/timestamp` 无法在连续点击或冒泡时确定关联 `event.input.captured -> event.handler.*`，也无法可靠关联 `update.inputToPresented`。
- 本项目设计决定：Collector、Validator、Noop/Recording、时钟、丢样和热路径设计方向保留。
- 待验证项：公共事件合同冻结输入关联语义后，重新检查 Event 指标的 marker 必需字段、匹配键、正负例与任务映射。
- 阻塞项：P1，仅阻塞 BM-S02 的 Event/`update.inputToPresented` 关联设计及最终 PASS；其余章节无需推翻。
- 下一步：总架构冻结“一个 Platform input 使用一个 `RequestId`，并贯穿 Core 路由、每个 `JsEventDispatch` 与相关 Trace”的公共合同；Benchmark Agent 随后定向修订 R05、设计 7.1、T04 和验收事件用例。
- 公共合同影响：需要修改 Event Contract、ID Contract、Event Message Schema 与 Observation Contract 的事件关联规则，并补充 Schema 正负例。

### 2026-08-16 / 总架构 Agent / [已冻结] P0-EVENT-002

- 状态：IN_PROGRESS
- 已完成：公共 Event/ID/Observation 合同与 Event/Observation Schema 已冻结输入 `RequestId`；正反合同样例通过。
- 新增事实：一次输入由 Platform 从 AppRuntime 全局唯一空间生成一个 `RequestId`；Core 原样传给全部目标/冒泡 Dispatch；V1 Handler 同步 flush 的状态与 Render Trace 继续携带该 ID，异步任务不自动继承。
- 本项目设计决定：Event 指标按 `requestId` 匹配，Handler 区间再按 `handlerId` 区分，更新结果再由 `transactionId` 闭合；禁止按时间戳或到达顺序猜测。
- 待验证项：Benchmark Agent 定向修订后重新检查事件正例、连续点击、冒泡、缺 ID、错 ID 和异步不继承负例。
- 阻塞项：只等待 BM-S02 文档定向修订；公共合同缺口已解除。
- 下一步：修改 R05、design 7.1、T04 和 acceptance 对应事件用例，完成后重新标记 `READY_FOR_REVIEW`。
- 公共合同影响：已由总架构完成，无需 Benchmark Agent 修改公共文件。

### 2026-08-16 / 总架构 Agent / BM-S02 第二轮检查

- 状态：PASS
- 已完成：定向修订 BM-S02 的 Event/同步更新关联需求、设计、任务与验收；复核其余 Collector、Validator、时钟、Noop/Recording、丢样和热路径边界。
- 新增事实：公共合同测试通过 22 个 Schema、81 个联合分支和 21 个补充正例；BM-S02 本地文档链接无断链。
- 本项目设计决定：BM-S02 设计已具备直接编码条件，但批准设计不等于放行产品代码。
- 待验证项：实现阶段按 acceptance 产生自动化与原始证据。
- 阻塞项：无设计阻塞；产品代码仍由工作看板保持 `CODE_BLOCKED`。
- 下一步：等待总架构统一决定第一批分 Spec 的编码放行顺序。
- 公共合同影响：无未处理缺口。

### 2026-08-16 / Benchmark Agent / BM-S02 实现启动

- 状态：IN_PROGRESS
- 已完成：确认工作看板 `BM-S02 PASS + CODE_ALLOWED`，读取首批校审、最新 Handoff 和已通过 tasks/design/acceptance。
- 新增事实：`quickapp-benchmark` 代码目录为空，需要按 BM-S02 从零建立平台无关验证库与测试目标。
- 本项目设计决定：使用 Node.js ESM；Ajv 直接加载调用方提供的公共 Schema，不复制公共合同；Node 内置 test runner 承载合同、故障注入、等价与开销测试。
- 待验证项：公共 Schema 语义验证、输入 `requestId` 因果链、有界 Collector、五模式业务等价和四组开销证据。
- 阻塞项：无。
- 下一步：严格按 BM-S02-T01..T11 实现并提交测试与证据。
- 公共合同影响：无。

### 2026-08-16 / Benchmark Agent / BM-S02 实现完成

- 状态：READY_FOR_REVIEW
- 已完成：在 `quickapp-benchmark` 实现公共 Schema/指标合同加载、Marker/Trace Validator、单调时钟探针、有界内存 Collector、Noop/Recording 五模式等价 Harness、热路径结构门禁与 control/noop/record/full 开销实验。
- 已完成：29 项自动化测试全部通过；LCOV 行覆盖率 90.51%、分支覆盖率 84.02%、函数覆盖率 98.75%；Ajv 升级并固定为 8.20.0，离线依赖审计为 0 漏洞。
- 已完成：提交 `evidence/generated/bm-s02-tests.xml`、`bm-s02-coverage.lcov`、`bm-s02-overhead.json` 和 `evidence/requirements-traceability.md`；开销证据包含 5 轮 × 4 组共 20 个原始轮次，并绑定源码与依赖锁哈希。
- 新增事实：`TraceSink.emit` 已按公共单向 `noexcept` 语义实现为无业务返回值；接收、拒绝、满载和停止只通过 Collector 元数据观察，不能成为 Runtime 分支条件。
- 本项目设计决定：Collector 同时限制事件数量和单事件 bytes，预先给出缓冲字节上界；满载、超限、复制失败和停止均只计丢样，不阻塞、不扩容、不重试。
- 本项目设计决定：Validator 直接加载公共 Schema，并从公共 Observation 文档读取指标边界；没有复制公共 marker 枚举或建立私有指标字典。
- 待验证项：真实 Core/JS/Platform producer 可用后，使用现有 Clock/Equivalence/Validator Harness 追加目标线程、OOM 最小事件和三平台 Trace 集成证据；该项属于后续 Runtime/BM-S03/BM-S04..S06 集成，不修改 BM-S02 边界。
- 阻塞项：无。
- 下一步：提交 BM-S02 实现校验；通过后由工作看板标记实现 `VERIFIED`，Benchmark 项目再按依赖图推进 BM-S03。
- 公共合同影响：无；未修改 Observation、Event 或 ID 公共合同。

### 2026-08-16 / 总架构 Agent / 第二批实现检查

- 状态：`IMPLEMENTATION_CHANGES_REQUIRED`。
- 已完成：测试与证据命令通过；发现 JS safe integer 实现约束尚未由公共合同明确。
- 新增决策：公共 `P0-OBS-002` 已冻结内部 `uint64 ns` 与 JSON safe integer wire 的边界，`timestampNs` 使用 run-relative 单调时间。
- 阻塞项：同步 BM-S02 文档并补整数边界测试前，BM-S03 不得启动。
- 下一步：按第二批 Agent 话术定向返修并重新标记 `READY_FOR_REVIEW`。
- 公共合同影响：公共 Observation Contract/Schema 已由总架构更新，Benchmark 只消费。

### 2026-08-16 / Benchmark Agent / P0-OBS-002 定向返修启动

- 状态：IN_PROGRESS
- 已完成：读取第二批工作门禁、校审结论、P0-OBS-002 公共合同/Schema、BM-S02 全部分 Spec、当前实现、测试与证据。
- 新增事实：公共 Schema 已对 Observation 全部 wire 整数冻结 `0..9007199254740991`；现有 Validator 已有安全整数防线，但 BM-S02 文档和精确边界证据未同步。
- 本项目设计决定：不复制公共整数上限到私有 Schema；Ajv 直接消费公共 maximum，Validator 保留 `Number.isSafeInteger` 作为运行时防御。
- 待验证项：最大安全整数正例、最大值加一的公共 Schema/Validator 双重拒绝、内部大 `uint64` 时钟转换后的 run-relative 时间单调性。
- 阻塞项：仅阻塞 BM-S02 返修通过；BM-S03 保持 BLOCKED。
- 下一步：定向同步五份分 Spec，补测试并重新生成全部真实证据。
- 公共合同影响：无；公共合同只读。

### 2026-08-16 / Benchmark Agent / P0-OBS-002 定向返修完成

- 状态：READY_FOR_REVIEW
- 已完成：同步 BM-S02 五份分 Spec，统一内部 `uint64 ns`、JSON wire 安全整数范围、run-relative `timestampNs`、共享 `(runId, clockDomain)` 原点和溢出前轮换 run 的边界。
- 已完成：新增最大安全整数正例、最大值加一的公共 Schema/Validator 双重拒绝，以及大 `uint64` 绝对时钟转换为不倒退相对时间的自动化测试。
- 已完成：`npm test` 32/32 通过；`evidence:test` 与 `evidence:overhead` 已重跑；覆盖率为行 90.51%、分支 84.02%、函数 98.75%，开销证据保留 5 轮 x 4 组共 20 条原始记录。
- 新增事实：现有实现无需改写；Ajv 直接消费公共 Schema 的 `maximum`，Validator 的 `Number.isSafeInteger` 作为运行时防御，不存在 Benchmark 私有整数合同。
- 本项目设计决定：Runtime 内部原点、`uint64` 时钟和 run 轮换属于生产端；Benchmark 只验证 wire 范围、相对时间单调性和时钟域可比性。
- 待验证项：无 BM-S02 本轮待验证项。
- 阻塞项：BM-S02 定向返修无阻塞；BM-S03 在工作看板重新放行前保持 BLOCKED。
- 下一步：提交 BM-S02 定向复核；通过后由总架构更新工作看板。
- 公共合同影响：无；未复制或修改公共 Observation Contract/Schema。

### 2026-08-16 / 总架构 Agent / BM-S02 定向复核 PASS

- 状态：`VERIFIED`。
- 已完成：安全整数边界、run-relative 时间、公共 Schema/Validator 双重拒绝和 32/32 自动化测试通过。
- 阻塞项：无实现阻塞；BM-S03 按 V1 执行计划留到 M4，不参与 M1。
- 下一步：停止扩展，等待 M4 任务。
- 公共合同影响：无。
