# 第二批检查后 Agent 话术

## 目录

- [Benchmark](#benchmark)
- [Toolkit](#toolkit)
- [JS Runtime](#js-runtime)
- [Runtime Core](#runtime-core)
- [LVGL Runtime](#lvgl-runtime)
- [Android Runtime](#android-runtime)
- [iOS Runtime](#ios-runtime)
- [Examples](#examples)

## Benchmark

```text
你继续负责 quickapp-benchmark。

先读取：
1. v3/AGENT-WORK-BOARD.md
2. v3/V1-EXECUTION-PLAN.md
3. v3/reviews/subspec-review/2026-08-16-second-batch-review.md
4. v3/spec/contracts/observation-contract.md
5. v3/spec/contracts/schemas/observation.schema.json
6. 本项目 spec/AGENT-HANDOFF.md
7. BM-S02 五份分 Spec 与当前实现、测试、证据

当前状态：BM-S02 为 IMPLEMENTATION_CHANGES_REQUIRED，只允许定向返修；BM-S03 不得启动。

任务：
1. 消费已冻结 P0-OBS-002：Runtime 内部时钟仍为 uint64 ns；JSON Observation 整数范围为 0..9007199254740991；timestampNs 为同一 run 的单调相对时间；同一 `(runId, clockDomain)` 共享一个原点，溢出前轮换 run。
2. 同步 BM-S02 requirements/design/tasks/acceptance/README，不复制或修改公共合同。
3. 补测试：最大安全整数合法、最大值加一被公共 Schema/Validator 拒绝、相对时间不倒退。
4. 重跑 npm test、evidence:test、evidence:overhead，更新真实证据。
5. 在 AGENT-HANDOFF.md 追加完成记录并标记 READY_FOR_REVIEW。

禁止修改其他项目和 v3 公共合同；不得启动 BM-S03。
```

## Toolkit

```text
你继续负责 quickapp-toolkit。

先读取：
1. v3/AGENT-WORK-BOARD.md
2. v3/V1-EXECUTION-PLAN.md
3. v3/reviews/subspec-review/2026-08-16-second-batch-review.md
4. 本项目 spec/AGENT-HANDOFF.md
5. TK-S01 五份分 Spec
6. src/application/contracts.ts、src/cli/types.ts、src/cli/main.ts 及相关测试

当前状态：TK-S01 为 IMPLEMENTATION_CHANGES_REQUIRED，只允许定向返修；TK-S02 不得启动。

本质约束：Application Service 只返回 operation=build|inspect|run 的 ToolkitResult；未知命令等分派前失败尚不存在 operation，不能伪造 operation=cli。

任务：
1. 在 TK-S01 Spec 明确定义 CLI Adapter 私有、版本化的 CliDiagnosticResult，固定 kind=cliDiagnostic，不携带 operation。
2. JSON renderer 的输出联合为 ToolkitResult | CliDiagnosticResult，二者必须可机器区分并分别校验。
3. 保证 CliDiagnosticResult 永不进入 Application Service、UseCase Port 或未来 MCP 调用面。
4. 修改实现，删除 operation=cli；增加独立 validator/type guard。
5. 补未知命令、非法公共参数、JSON 单文档、Application Service 隔离和错误 envelope 校验测试。
6. 重跑 typecheck、lint、build、npm test、test:cli，更新证据与 Handoff，标记 READY_FOR_REVIEW。

只修改 Toolkit Spec、Toolkit 代码和本项目 Handoff；不得启动 TK-S02。
```

## JS Runtime

```text
你继续负责 quickapp-runtime-js。

先读取：
1. v3/AGENT-WORK-BOARD.md
2. v3/V1-EXECUTION-PLAN.md
3. v3/reviews/subspec-review/2026-08-16-second-batch-review.md
4. v3/spec/contracts/observation-contract.md，重点读取 P0-OBS-002 对 wire 整数和 run-relative timestampNs 的要求
5. 本项目 spec/AGENT-HANDOFF.md
6. 已通过的 JS-S01 五份分 Spec

当前授权：JS-S01 已 PASS + CODE_ALLOWED，可以实现；JS-S02 不得提前实现。

严格按 JS-S01 tasks 执行：JsEnginePort、一个 AppRuntime 一个串行 JsEngineService、有界 Executor、Value/Context/Engine 所有权、Native Function Binding、Fake Engine、QuickJS V1 Provider、microtask budget、最小 Observation 和确定销毁。

实现必须消费最新公共 Observation 合同：内部 clock 可用 uint64，wire timestampNs 使用 run-relative safe integer；Sink 注入前满足 noexcept/nonblocking/no-reentry。不得实现 VNode Tree、业务 Runtime ABI、Binding flush 或平台 Host。

完成全部合同测试、QuickJS/Fake common suite、sanitizer、依赖与单 Engine 链接证据后，在 AGENT-HANDOFF.md 追加实现记录并标记 READY_FOR_REVIEW。只写 quickapp-runtime-js。
```

## Runtime Core

```text
你继续负责 quickapp-runtime-core。

先读取：
1. v3/AGENT-WORK-BOARD.md
2. v3/V1-EXECUTION-PLAN.md
3. v3/reviews/subspec-review/2026-08-16-second-batch-review.md
4. v3/spec/contracts/id-contract.md 与 observation-contract.md
5. 本项目 spec/AGENT-HANDOFF.md
6. 已通过的 CORE-S01 五份分 Spec

当前授权：CORE-S01 已 PASS + CODE_ALLOWED，可以实现；CORE-S02 不得提前实现。

严格按 CORE-S01 tasks 实现 typed value/error、强类型 ID、AppRuntimeFactory/AppRuntimeIdAllocator Foundation、有界 MPSC ingress、基础 Port、线程/所有权、停止、MonotonicClock、TraceSink/NoopTraceSink、RuntimeCounters、Fake 与故障注入。

必须满足：AppRuntimeId 仅由 Core Factory 生成，Host scope 内不复用；RequestId 多 producer 全局唯一；内部 clock 为 uint64，Observation wire timestampNs 为 run-relative safe integer；不得出现 QuickJS、JNI、UIKit、LVGL 或第二棵 Runtime Tree。

完成并发、TSan/ASan、OOM/overflow、Noop/Recording 等价、资源归零和依赖扫描后，在 AGENT-HANDOFF.md 追加实现记录并标记 READY_FOR_REVIEW。只写 quickapp-runtime-core。
```

## LVGL Runtime

```text
你继续负责 quickapp-runtime-lvgl。

先读取：
1. v3/AGENT-WORK-BOARD.md
2. v3/V1-EXECUTION-PLAN.md
3. v3/reviews/subspec-review/2026-08-16-second-batch-review.md
4. 本项目 spec/AGENT-HANDOFF.md
5. LV-S01 五份分 Spec
6. OwnerTask、OwnerTaskQueue、生命周期协调器及当前测试

当前状态：LV-S01 为 IMPLEMENTATION_CHANGES_REQUIRED，只允许定向返修；LV-S02 不得启动。

任务：
1. 删除 OwnerTaskQueue 析构中的 cancelPending；析构不得执行 task、启动 stop 或隐藏等待。正常调用必须显式 stop/close，并以断言和测试暴露违约。
2. 删除无界 while(test_and_set) 自旋。采用有界、可失败的竞争策略；允许新增项目内部 busy 状态并由 Host 后续 pump 重试。
3. 保持固定容量、producer-safe post、单 owner 执行/销毁、FIFO、pump budget 和 drain/cancel 语义。
4. 明确 V1 不承诺 ISR-safe 或 lock-free，但禁止无界 spin、无界阻塞和动态扩容。
5. 补 task destructor owner 归属、竞争失败、停止收敛、多 producer、10,000 轮与 TSan/ASan 测试；静态扫描禁止无界 spin。
6. 更新 LV-S01 Spec 中必要的项目内部状态与验收，不修改公共合同；更新证据和 Handoff，标记 READY_FOR_REVIEW。

只修改 LVGL 项目；不得启动 LV-S02。
```

## Android Runtime

```text
你继续负责 quickapp-runtime-android。

先读取：
1. v3/AGENT-WORK-BOARD.md
2. v3/V1-EXECUTION-PLAN.md
3. v3/reviews/subspec-review/2026-08-16-second-batch-review.md
4. 本项目 spec/AGENT-HANDOFF.md
5. AND-S01 五份分 Spec
6. package_source.h/.cpp、合同测试与 evidence/and-s01-implementation.md

当前状态：AND-S01 为 IMPLEMENTATION_CHANGES_REQUIRED，只允许定向返修；AND-S02 不得启动。

任务：
1. FilePackageBackend 在 open 时持有固定的只读文件资源/句柄；后续 read 不得按 path 重新打开另一份文件。
2. close 释放同一资源；保留 immutable bytes、随机读、越界/短读、close race 和 Core queue 单次 completion 语义。
3. 增加 open 后路径被替换的测试：Source 必须继续读取原资源，或以稳定 typed error 失败，绝不能静默读取新文件。
4. 校正组成证据：当前只能写 isolated implementation verified；真实 APK/native link map 的一次 JS Framework、一个 Engine 和未选模块不入链接保持 integration evidence pending，由 AND-S08/AND-S09 闭环，不得伪造。
5. 重跑 normal 与 sanitizer；补充可执行的 read/close 竞争证据；更新 Spec 中 S01 隔离证据和最终集成证据的分工。
6. 在 AGENT-HANDOFF.md 追加完成记录并标记 READY_FOR_REVIEW。

只修改 Android 项目；不得启动 AND-S02。
```

## iOS Runtime

```text
你继续负责 quickapp-runtime-ios。

先读取：
1. v3/AGENT-WORK-BOARD.md
2. v3/V1-EXECUTION-PLAN.md
3. v3/reviews/subspec-review/2026-08-16-second-batch-review.md
4. 本项目 spec/AGENT-HANDOFF.md
5. 已通过的 IOS-S01 五份分 Spec

当前授权：IOS-S01 已 PASS + CODE_ALLOWED，可以实现；IOS-S02 不得提前实现。

严格按 IOS-S01 tasks 实现 Composition Root、Runtime Host、PackageSource、Profile/Manifest 预检、单 Engine 选择、TraceSink 选择、Root presented 成功边界、RuntimeLifecycleControl 和确定销毁。

必须保持：raw Scene signal 只可在生成 RequestId 前去重；accepted control 逐条进入 Core，same RequestId/action 唯一完成，LIFECYCLE_BUSY 原样透传；v1 baseline/diagnostic 与 custom off/baseline/diagnostic 矩阵不变。不得实现 UIKit Surface/Mount/Input 等 IOS-S02 以后职责。

完成 Fake Core、PackageSource、Scene/control、Noop/Recording、线程、sanitizer 和资源归零证据后，在 AGENT-HANDOFF.md 追加实现记录并标记 READY_FOR_REVIEW。只写 quickapp-runtime-ios。
```

## Examples

```text
你继续负责 quickapp-examples。

先读取：
1. v3/AGENT-WORK-BOARD.md
2. v3/V1-EXECUTION-PLAN.md
3. v3/spec/contracts/render-contract.md 与 render-transaction.schema.json
4. 本项目 spec/AGENT-HANDOFF.md
5. EX-S02 五份分 Spec

当前状态：EX-S01 T01-T05 已 VERIFIED；EX-S02 已 READY_FOR_REVIEW，产品代码仍 CODE_BLOCKED。总架构已用 P0-EVENT-003 关闭 EX-S02-REQ-001。

任务：
1. 将 EX-S02 中所有 `[待决策] EX-S02-REQ-001` 同步为已冻结合同：`RenderTransaction.requestId` 可选；Handler 返回前的同步状态 flush 必须携带输入 RequestId；普通非事件更新和异步 continuation 必须省略。
2. 更新 requirements、design、acceptance 的字段级断言和待验证清单，不扩展 Fixture 范围。
3. 在 AGENT-HANDOFF.md 追加 `[已冻结] P0-EVENT-003` 接收记录并保持 READY_FOR_REVIEW。
4. 不修改 Fixture 源码、不生成产品产物、不启动 EX-S03。

同步完成后交由总架构校审 EX-S02。
```
