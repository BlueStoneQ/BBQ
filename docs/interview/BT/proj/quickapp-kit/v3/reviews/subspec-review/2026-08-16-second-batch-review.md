# 第二批分 Spec 与实现总检查

## 目录

- [1. 结论](#1-结论)
- [2. 本轮实际检查对象](#2-本轮实际检查对象)
- [3. 项目结论](#3-项目结论)
- [4. 必须返修](#4-必须返修)
- [5. 已通过项](#5-已通过项)
- [6. 自动验证](#6-自动验证)
- [7. 下一步门禁](#7-下一步门禁)

## 1. 结论

**总架构主线成立，不需要重开总 Spec。**

本轮不是八份文档的同类复核：JS、Core、iOS 提交的是首轮定向修订；Benchmark、Toolkit、LVGL、Android、Examples 已经进入实现。检查结论如下：

- JS、Core、iOS 的定向问题已关闭，转为 `PASS + CODE_ALLOWED`。
- Examples 的 EX-S01 T01-T05 通过，转为 `VERIFIED`；可以开始 EX-S02 分 Spec 设计。
- Benchmark、Toolkit、LVGL、Android 的实现存在局部合同偏差，只返修对应模块，不推翻架构。
- P0 = 0；未发现第二棵权威树、第二条 Bridge、平台状态反向进入 Core 或外围反向依赖内核。

## 2. 本轮实际检查对象

| 项目 | 本轮交付 | 检查方式 |
|---|---|---|
| Benchmark | BM-S02 实现 | 代码、测试、证据、公共 Observation 合同一致性 |
| Toolkit | TK-S01 实现 | 代码、CLI 合同、Application Service 边界、测试 |
| JS | S1-JS-001 文档修订 | 定向检查 Sink 注入前置合同 |
| Core | S1-CORE-001 文档修订 | 定向检查 AppRuntimeId/RequestId 所有权 |
| LVGL | LV-S01 实现 | 代码、owner/背压/停止/嵌入式时延、sanitizer |
| Android | AND-S01 实现 | 代码、PackageSource、Host 生命周期、组成证据 |
| iOS | S1-IOS-001/S2-IOS-002 文档修订 | 定向检查 Scene/control 与 Observation 矩阵 |
| Examples | EX-S01 T01-T05 实现 | 基线清单、摘要、场景、只读校验器 |

## 3. 项目结论

| 项目 | 结论 | 下一动作 |
|---|---|---|
| BM-S02 | `IMPLEMENTATION_CHANGES_REQUIRED` | 对齐新冻结的 JSON 安全整数合同并补边界测试；BM-S03 暂停 |
| TK-S01 | `IMPLEMENTATION_CHANGES_REQUIRED` | 冻结 CLI 分派前失败 envelope，修订 Spec 与实现；TK-S02 暂停 |
| JS-S01 | `PASS + CODE_ALLOWED` | 按已通过 tasks 实现 JS Engine Service |
| CORE-S01 | `PASS + CODE_ALLOWED` | 按已通过 tasks 实现 Core Foundation |
| LV-S01 | `IMPLEMENTATION_CHANGES_REQUIRED` | 删除非 owner 析构兜底与无界自旋；LV-S02 暂停 |
| AND-S01 | `IMPLEMENTATION_CHANGES_REQUIRED` | 固定 file PackageSource 的资源身份并校正组成证据状态；AND-S02 暂停 |
| IOS-S01 | `PASS + CODE_ALLOWED` | 按已通过 tasks 实现 iOS Host Foundation |
| EX-S01 | `VERIFIED` | 开始 EX-S02 分 Spec 设计；EX-S02 产品代码仍阻塞 |

## 4. 必须返修

### S1-BM-001：Observation wire 整数边界未在公共合同冻结

实现的 `clock.js` 与 `validator.js` 正确拒绝超过 JavaScript safe integer 的值，但原公共 Schema 只写非负整数，公共文档又将内部 `uint64` 与 JSON wire 混为同一语义。

总架构已冻结 `P0-OBS-002`：内部时钟保持 `uint64 ns`；JSON Observation 全部整数必须位于 `0..9007199254740991`；`timestampNs` 是同一 run 的单调相对时间，溢出前轮换 run。公共 Schema、合同和负例已经更新。

Benchmark 返修：同步 BM-S02 五份文档；补“最大安全整数通过、最大值加一失败、相对时间不倒退”的测试和证据。现有 Validator 算法不需要推翻。

### S1-TK-001：CLI 分派前失败不是 ToolkitResult

TK-S01 冻结 `ToolkitResult.operation = build|inspect|run`，实现却在未知命令等分派前失败中输出 `operation=cli`。该对象会被 `assertToolkitResult` 拒绝，说明实现与 Spec 不是同一个合同。

返修方向：Application Service 继续只返回 `ToolkitResult`；CLI 在尚未形成 operation 时返回独立、版本化、带 `kind=cliDiagnostic` 的 `CliDiagnosticResult`，且不携带虚假的 operation。JSON renderer 可以输出 `ToolkitResult | CliDiagnosticResult`，但二者必须可机器区分并分别校验。补充未知命令、非法公共参数和边界隔离测试。

### S1-LV-001：队列析构在非 owner 上下文销毁任务

`OwnerTaskQueue::~OwnerTaskQueue()` 调用 `cancelPending()`。这会在析构线程执行 task capture 的 destructor，违反“task 只由 owner 执行或在 owner stop 中销毁”以及“析构不启动停止流程”的冻结语义。

返修方向：析构不执行 task、不获取可能等待的队列锁；正常路径必须显式 `beginStop + finishStop` 后再析构。以断言/测试暴露调用方违约，不用隐藏清理掩盖生命周期错误。补充 task destructor 所在线程与 closed/depth=0 验收。

### S1-LV-002：OwnerTaskQueue 使用无界自旋

`SpinGuard` 的 `while (test_and_set)` 没有尝试上限。锁持有者被抢占时，producer 或 owner 可以无限占用 CPU；这与嵌入式端的可预测时延和“Port 内不隐藏忙等”冲突。

返修方向：使用有界、可失败的 admission/critical-section 方案；竞争时返回本地 `busy` 或等价 typed 状态并由 Host 后续 pump 重试。V1 不承诺 ISR-safe，也不要求 lock-free，但禁止无界 spin、无界阻塞和动态扩容。TSan、多 producer、竞争失败、停止收敛必须通过。

### S1-AND-001：FilePackageBackend 没有固定打开时的资源身份

Spec 要求 Source 独占只读文件资源，当前实现只保存 path，并在每次 read 时重新打开。打开后若路径被替换，同一个 PackageSource 会读取另一份文件，破坏 immutable package identity，也可能让校验与加载读取不同 bytes。

返修方向：`open()` 时持有同一个只读文件资源/句柄，后续随机读只针对该身份；close 释放该资源。新增“open 后替换路径，Source 仍读取原资源或确定失败”的测试，并保留越界、短读、close race 和 Core queue completion 验收。

### S2-AND-002：AND-S01 证据把未完成的实际链接校验写成 VERIFIED

AND-S01 acceptance 要求实际 link/symbol inventory，当前证据明确说明真实 Core/JS 目标尚不存在，只验证了调用方提供的清单。该局部实现可以成立，但不能把实际组成证据标记为完成。

返修方向：把当前状态写为“isolated implementation verified，integration evidence pending”；AND-S01 只验证 Composition Root 对输入清单的拒绝逻辑，真实 APK/native target 的一次 JS Framework、一个 Engine 和未选模块不入链接由 AND-S08/AND-S09 最终闭环。不得生成伪 link map。

## 5. 已通过项

1. JS-S01 已把 Sink 的 `noexcept + nonblocking + no reentry` 定义为注入前置合同，没有承诺恢复真实 throw/block/reentry。
2. CORE-S01 已冻结 AppRuntimeFactory/allocator 生命周期、A/B/C 不复用和多 producer RequestId 唯一性。
3. IOS-S01 已区分 raw Scene signal 与 accepted control；`LIFECYCLE_BUSY` 和 RequestId/action 原样返回；custom/off 矩阵正确。
4. EX-S01 的 Source、联盟 Reference 和 Runtime Expectation 分层正确；校验器不修改 Case 001。
5. 五个已实现项目都没有越权实现下一分 Spec，也没有改写公共消息或建立私有 Runtime 协议。

## 6. 自动验证

本轮实际执行并通过：

| 项目 | 结果 |
|---|---|
| 公共 Schema | 22 个 Schema、81 个 union branch、21 个补充正例及全部语义负例通过 |
| Benchmark | 29/29；evidence 与 overhead 命令通过 |
| Toolkit | typecheck/lint/build 通过；43/43；CLI 12/12 |
| LVGL | Release、ASan/UBSan、TSan 均 2/2 CTest 通过 |
| Android | normal 与 ASan/UBSan 合同脚本通过 |
| Examples | `node --check` 与 Case 001 基线校验通过 |

测试全绿不覆盖上面的合同偏差，因此四个实现仍需定向返修。

## 7. 下一步门禁

```text
CODE_ALLOWED:
  JS-S01, CORE-S01, IOS-S01

CORRECTION_ALLOWED_ONLY:
  BM-S02, TK-S01, LV-S01, AND-S01

DESIGN_ALLOWED:
  EX-S02

NEXT_SUBSPEC_BLOCKED:
  BM-S03, TK-S02, LV-S02, AND-S02

VERIFIED:
  EX-S01 T01-T05
```

四项实现返修完成后只做定向复核；不再重查已通过的总架构和无关模块。
