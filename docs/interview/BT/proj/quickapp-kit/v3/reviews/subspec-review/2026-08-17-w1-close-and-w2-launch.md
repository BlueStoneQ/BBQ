# W1 关闭与 W2 启动

> 历史快照：W2 跨模块校审重新发现 JS-S02 immutable bytes 合同问题；当前状态和指令以 [W2 分 Spec 总架构校审](./2026-08-17-w2-design-review.md) 为准。

## 目录

- [1. 结论](#1-结论)
- [2. 独立复核](#2-独立复核)
- [3. 当前进度](#3-当前进度)
- [4. W2 边界](#4-w2-边界)
- [5. Agent 指令](#5-agent-指令)

## 1. 结论

**`Product V1 / M1 / W1` 已全部验证；现在进入 `W2` 分 Spec 设计，不开放 W2 产品编码。**

W2 的本质是把已经成立的包、ABI、权威树和平台 Host 基础连接成“模块与 VM -> App/Surface 生命周期 -> 平台 Surface/Measure”控制骨架。

## 2. 独立复核

| 检查项 | 结论 | 证据 |
|---|---|---|
| JS-S02 消息模型 | `PASS` | 13 outbound、16 inbound 均为具名 C++ struct 与 closed variant；decoder 后无通用字段表 |
| 动态值边界 | `PASS` | `RuntimeValue` 只保留在合同明确开放的 `params` 与事件 `payload` 叶子 |
| 直接消费 | `PASS` | Core ingress、callback slot 和测试均读取具名成员 |
| 源码完整性 | `PASS` | `source-manifest.sha256` 全部匹配 |
| Debug / Release | `PASS` | 各 5/5 |
| ASan + UBSan / TSan | `PASS` | 各 5/5；macOS ASan 使用 `detect_leaks=0` |
| API-only / 边界扫描 | `PASS` | 无 QuickJS Provider 强依赖；JS-S01/JS-S02 扫描通过 |

结论：JS-S02 从 `IMPLEMENTATION_CHANGES_REQUIRED` 更新为 `VERIFIED`，W1 六个分 Spec 全部关闭。

## 3. 当前进度

| 范围 | 已完成 | 总数 | 当前状态 |
|---|---:|---:|---|
| Product V1 | 14 | 69 | `IN_PROGRESS` |
| M1 | 11 | 41 | `W2 DESIGN` |
| W1 | 6 | 6 | `VERIFIED` |
| W2 | 0 | 7 | `DESIGN_ALLOWED` |

这仍未代表 Case 001 已运行；W1 只完成了端到端骨架的基础段。

## 4. W2 边界

| 项目 | 本轮设计 | 依赖规则 | 禁止事项 |
|---|---|---|---|
| Toolkit | TK-S04 Canonical Lowering | 消费 TK-S02/TK-S03 | 不编码；不启动 TK-S05/TK-S06 |
| JS Runtime | JS-S03 Module ABI/Loader；JS-S04 App/Page VM/Lifecycle | 先 S03 后 S04 | 不编码；不启动 JS-S05 |
| Runtime Core | CORE-S03 AppRuntime/Lifecycle；CORE-S04 Surface/Navigation | 先 S03 后 S04 | 不编码；不启动 CORE-S06 |
| LVGL Runtime | LV-S03 Surface Host；LV-S06 Font Measure | 二者可并行设计 | 不编码；不启动 LV-S04/LV-S07 |

每项固定输出 `README.md`、`requirements.md`、`design.md`、`tasks.md`、`acceptance.md`。项目 Agent 完成自检并写 `READY_FOR_REVIEW` 后停止；只有总架构给出 `PASS + CODE_ALLOWED` 才能编码。

## 5. Agent 指令

### 5.1 Toolkit Agent

```text
继续当前 Toolkit 长期对话。W1 已 VERIFIED；现在只设计 TK-S04 Canonical Lowering，不写产品代码。

读取 v3/AGENT-WORK-BOARD.md、V1-EXECUTION-PLAN.md、公共 Artifact/Page IR/ID 合同、Toolkit 总 Spec 与 TK-S02/TK-S03 已验证分 Spec。

在 projects/quickapp-toolkit/spec/subspecs/tk-s04-canonical-lowering/ 编写 README.md、requirements.md、design.md、tasks.md、acceptance.md。

必须冻结：ResolvedAppModel + ParsedSourceModel 的输入不变量；Host Component/Style/Binding/Block/Event 的唯一语义 Lowering；稳定 TemplateNodeId/TemplateBindingId/TemplateBlockId/TemplateHandlerId 的分配与确定性；源码位置诊断；取消、预算、深不可变和资源边界；供 TK-S05/TK-S06 共同消费的唯一 Lowered Model。

不得修改公共合同，不得编码，不得启动 TK-S05/TK-S06。发现公共缺口只在 AGENT-HANDOFF.md 记录 [待决策]。完成后追加 READY_FOR_REVIEW 并停止。
```

### 5.2 JS Runtime Agent

```text
继续当前 JS Runtime 长期对话。JS-S01/JS-S02 已 VERIFIED；现在按依赖设计 JS-S03 和 JS-S04，不写产品代码。

先完成 projects/quickapp-runtime-js/spec/subspecs/js-s03-module-abi-loader/，再完成 js-s04-app-page-vm-lifecycle/；每项都写 README.md、requirements.md、design.md、tasks.md、acceptance.md。

JS-S03 必须冻结：VerifiedModulePort 输入；$app_define$/$app_bootstrap$/$app_require$ 语义；App/Shared/Page cache key、状态机和所有权；expected export/bootstrap 校验；循环依赖、失败缓存、销毁与资源上限。

JS-S04 必须冻结：AppContext/SurfaceContext；App/Page VM 唯一所有权；VmInitialization 与 Lifecycle typed request/result；Hook 顺序、异常、重复/迟到消息、Surface/App teardown；所有执行仍串行化到 JS Executor。

不得新增第二条 Bridge、读取 RPK/源码、维护 Core Surface 栈、编码或启动 JS-S05。公共缺口只写 [待决策]。两项分别自检并在 AGENT-HANDOFF.md 标记 READY_FOR_REVIEW 后停止。
```

### 5.3 Runtime Core Agent

```text
继续当前 Runtime Core 长期对话。CORE-S01/S02/S05 与 S02->S05 窄联调已 VERIFIED；现在按依赖设计 CORE-S03 和 CORE-S04，不写产品代码。

先完成 projects/quickapp-runtime-core/spec/subspecs/core-s03-app-runtime-lifecycle/，再完成 core-s04-surface-navigation/；每项都写 README.md、requirements.md、design.md、tasks.md、acceptance.md。

CORE-S03 必须冻结：AppRuntime 的唯一状态机和所有权；AppContext；Verified Module 交付与 VM 初始化顺序；Host lifecycle control 到 typed dispatch/result；RequestId、超时、失败和 teardown。

CORE-S04 必须冻结：Surface 生命周期/健康/Revision/单在途；Root/Push/Close；Core 唯一路由栈；Platform Surface command/result；close/reveal 原子提交；失败恢复和资源释放。不得建立第二棵权威树。

不得编码，不得启动 CORE-S06，不得把 JNI/LVGL/UIKit 语义放入 Core。公共缺口只写 [待决策]。两项分别自检并在 AGENT-HANDOFF.md 标记 READY_FOR_REVIEW 后停止。
```

### 5.4 LVGL Runtime Agent

```text
继续当前 LVGL Runtime 长期对话。LV-S01/LV-S02 已 VERIFIED；现在并行设计 LV-S03 和 LV-S06，不写产品代码。

分别在 projects/quickapp-runtime-lvgl/spec/subspecs/lv-s03-surface-host/ 与 lv-s06-font-measure/ 编写 README.md、requirements.md、design.md、tasks.md、acceptance.md。

LV-S03 必须冻结：Core Surface command 到 LVGL page root 的映射；hidden/present/push/close/visibility/destroy；owner thread；结果恰好一次；失败、幂等、销毁和资源上限。Platform 不复制 Core 路由栈和 Surface 权威状态。

LV-S06 必须冻结：MeasureRequest/MeasureResult；字体选择与 generation；缓存失效信号；owner thread；测量失败、资源上限和 simulator/embedded 一致性。Platform 只测量，不拥有 Core Layout 语义。

不得编码，不得启动 LV-S04/LV-S07，不得修改公共 Surface/Measure 合同。公共缺口只写 [待决策]。两项分别自检并在 AGENT-HANDOFF.md 标记 READY_FOR_REVIEW 后停止。
```

### 5.5 Android Agent

```text
AND-S01 已 VERIFIED。当前保持停止，不修改代码或 Spec，不启动 AND-S02；等待 M1 完成后由总架构发布 M2。
```

### 5.6 iOS Agent

```text
IOS-S01 已 VERIFIED。当前保持停止，不修改代码或 Spec，不启动 IOS-S02；等待 M2 完成后由总架构发布 M3。
```

### 5.7 Benchmark Agent

```text
BM-S02 已 VERIFIED。当前保持停止，不启动 BM-S03；等待 M4。
```

### 5.8 Examples Agent

```text
EX-S01 已 VERIFIED，EX-S02 为 PASS + CODE_HOLD_POST_M1。当前保持停止，不创建新 Fixture，不启动 EX-S03。
```
