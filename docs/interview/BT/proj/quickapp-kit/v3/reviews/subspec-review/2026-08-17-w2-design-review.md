# W2 分 Spec 总架构校审

## 目录

- [1. 结论](#1-结论)
- [2. 校审结果](#2-校审结果)
- [3. 必须修正](#3-必须修正)
- [4. 当前进度](#4-当前进度)
- [5. 下一步](#5-下一步)
- [6. Agent 指令](#6-agent-指令)

## 1. 结论

**W2 七个分 Spec 已全部提交：四项 `PASS + CODE_ALLOWED`，三项需要窄修正；不推翻总架构。**

可以立即并行实现：`TK-S04`、`CORE-S03`、`LV-S03`、`LV-S06`。JS 先修正 S02 immutable bytes 边界，再同步 S03/S04；CORE-S04 只同步已关闭的 Revision 决策，编码仍等待 CORE-S03 实现验证。

## 2. 校审结果

| 分 Spec | 结论 | 核心判断 |
|---|---|---|
| TK-S04 | `PASS + CODE_ALLOWED` | 唯一 Lowered Model、四类 Template ID、S05/S06 投影边界成立 |
| JS-S03 | `DESIGN_CHANGES_REQUIRED` | 主体成立；需消费 Definition ABI、修正失败缓存，并等待 S02 bytes 返修 |
| JS-S04 | `DESIGN_CHANGES_REQUIRED` | VM/Hook 唯一所有权成立；需消费 Definition ABI，代码依赖 S03 |
| CORE-S03 | `PASS + CODE_ALLOWED` | AppRuntime 状态、生命周期控制和 Page 调度边界成立 |
| CORE-S04 | `DESIGN_CHANGES_REQUIRED` | Surface/路由/原子提交成立；需同步已关闭的 Revision 规则 |
| LV-S03 | `PASS + CODE_ALLOWED` | Platform 只维护本地容器事实，不复制 Core 路由与 Surface 状态 |
| LV-S06 | `PASS + CODE_ALLOWED` | Platform 只提供不可变字体事实和同步度量，不接管 Layout |

35 份 W2 文档的本地链接全部有效，文档均具备标准五件套。

## 3. 必须修正

### 3.1 JS-S02 immutable bytes

当前 C++ `ModuleBundle` 使用 `std::string bytesBase64`，违反既有公共合同：base64 只用于 JSON fixture；进程内 Core -> JS 必须共享或转移 immutable byte storage。

固定修正：

```text
bytesBase64 string
  -> immutable byte storage handle
  -> Core post accepted 后转移/共享只读所有权
  -> S03 terminal completion accepted 或 teardown 后释放
```

不改变 14 个 Native Function、消息 kind、线程、队列、correlation 和状态机。

### 3.2 P0-JS-EXPORT-001 已关闭

公共 Artifact Contract 已冻结最小 Definition ABI：App/Page module export 是不可变 Definition；`createAppVm/createPageVm` 产生独立 VM；Binding evaluator 以 Page VM 为 `this`；Handler export 只保存方法名。Toolkit 生产、JS-S03 校验缓存、JS-S04 实例化，职责不重叠。

### 3.3 JS-S03 失败缓存

只有确定性内容失败可以绑定 bundle identity 并进入 terminal failure cache，例如 integrity、UTF-8、Module ABI、cycle、export shape 和 Bundle/factory JS exception。

`OUT_OF_MEMORY`、`QUEUE_OVERFLOW`、scope closed 与 teardown cancellation 是运行环境失败：必须回滚 staging，不得把 module identity 永久标记为 failed；后续合法 load 可以重试。

### 3.4 CORE-S04-REV-001 已关闭

首棵树提交前不发送 `SurfaceStatusChanged`。Revision `0` 提交后才允许发送，首个可发送状态为 `presenting`；Schema 不改为 nullable，`0` 不承担“尚未提交”双重语义。

## 4. 当前进度

| 范围 | 已完成 | 总数 | 状态 |
|---|---:|---:|---|
| Product V1 | 13 | 69 | `IN_PROGRESS` |
| M1 | 10 | 41 | `W1 CORRECTION + W2 IMPLEMENTATION` |
| W1 | 5 | 6 | JS-S02 窄返修 |
| W2 分 Spec | 4 PASS / 3 待修 | 7 | 四项可编码 |
| W2 实现 | 0 | 7 | 四项已开放 |

进度回退一项是因为 JS-S02 的真实跨模块合同问题被重新发现；这比带错边界进入 Module Loader 更诚实，也更便宜。

## 5. 下一步

第一批并行：

1. Toolkit 实现 TK-S04。
2. Core 实现 CORE-S03，并同步 CORE-S04 Revision 文档。
3. LVGL 分别实现 LV-S03、LV-S06。
4. JS 只返修 JS-S02，并修订 JS-S03/S04 文档；暂不实现 JS-S03/S04。

第二批门禁：JS-S02 返修验证后重新关闭 W1；JS-S03/S04 与 CORE-S04 文档复核通过后，再分别按项目依赖开放实现。

## 6. Agent 指令

### 6.1 Toolkit Agent

```text
继续当前 Toolkit 对话。TK-S04 分 Spec 已 PASS + CODE_ALLOWED。

严格按 tk-s04-canonical-lowering/tasks.md 实现并满足 acceptance.md；只修改 quickapp-toolkit 代码、TK-S04 分 Spec状态、evidence 和 Toolkit AGENT-HANDOFF.md。

必须保持：S02/S03 输入只读；唯一 CanonicalLoweredAppModel；四类 Template ID 独立确定；S05/S06 只能投影同一模型；失败/取消无部分结果；无跨 Build Session mutable cache。

不得实现 TK-S05/TK-S06、Bundle/Page IR emitter 或 Artifact。完成后提交源码摘要、需求验收映射、typecheck/lint/build/test、Case 001/002、确定性、深不可变、预算、取消和资源证据，标记 READY_FOR_REVIEW 后停止。
```

### 6.2 JS Runtime Agent

```text
继续当前 JS Runtime 对话。当前只做 JS-S02 窄返修和 JS-S03/S04 文档修正，不实现 JS-S03/S04。

JS-S02 必须：
1. 将进程内 ModuleBundle.bytesBase64 替换为共享或一次转移的 immutable byte storage；base64 只保留在 JSON fixture/schema 边界。
2. post accepted 后只读所有权明确；rejected、terminal completion、Surface/App teardown 的释放可测。
3. 不改变 14 个 Native Function、typed unions、线程、队列、correlation、状态机和其他已通过行为。
4. 更新 JS-S02 五份文档、测试、evidence/source-manifest；重跑 Debug、Release、ASan/UBSan、TSan、API-only 和边界扫描。

JS-S03/S04 文档必须：
1. 消费公共 Artifact Contract 已冻结的 P0-JS-EXPORT-001，删除待决策/Fake-only 阻塞表述，冻结 createAppVm/createPageVm、binding evaluator this/scope 和 handlerMethods。
2. JS-S03 只缓存确定性内容失败；OUT_OF_MEMORY、QUEUE_OVERFLOW、scope closed、teardown cancellation 回滚后允许重试，不污染 canonical identity。
3. 删除重复描述，补重试、Definition shape、跨 Surface VM 隔离验收。

完成后在 JS AGENT-HANDOFF.md 分别提交 JS-S02 IMPLEMENTATION READY_FOR_REVIEW 与 JS-S03/S04 DESIGN READY_FOR_REVIEW，然后停止。
```

### 6.3 Runtime Core Agent

```text
继续当前 Runtime Core 对话。CORE-S03 已 PASS + CODE_ALLOWED；CORE-S04 只做文档同步，暂不编码。

严格按 core-s03-app-runtime-lifecycle/tasks.md 实现 CORE-S03，保持一个 AppRuntimeController、一个 control slot、typed child correlation、无墙钟猜测和确定 teardown；使用 Fake S04 collaborator，不实现 Surface/Navigation。

同时把 CORE-S04 五份文档中的 CORE-S04-REV-001 更新为已冻结规则：首棵树提交前不发送 SurfaceStatusChanged；revision 0 后才发送，首个可发送状态为 presenting。删除待决策和阻塞表述，重新标记 CORE-S04 DESIGN READY_FOR_REVIEW。

CORE-S03 完成后提交源码摘要、逐项验收、Release/ASan/UBSan/TSan、重复/迟到/OOM/overflow/teardown 和资源归零证据；标记 READY_FOR_REVIEW 后停止。不得编码 CORE-S04/CORE-S06。
```

### 6.4 LVGL Runtime Agent

```text
继续当前 LVGL Runtime 对话。LV-S03 与 LV-S06 均已 PASS + CODE_ALLOWED，可以在同一项目内并行实现并分别提交证据。

LV-S03 严格按 tasks/acceptance 实现 bounded Surface gateway、owner-thread page-root 表、root/push/close 原子视觉事务、恰好一次 Result 和确定销毁；不得复制 Core route/Navigation/Revision，不实现 Mount/Event/Measure。

LV-S06 严格按 tasks/acceptance 实现 immutable font snapshot、Core-thread 同步度量、generation notification、Q26.6 有界算法和双 Profile 一致性；不得实现 Yoga/Core cache/Layout/Host Tree。

两项分别提供源码摘要、需求验收映射、Debug/Release/ASan/UBSan/TSan、边界扫描、压力和资源归零证据；分别标记 READY_FOR_REVIEW。不得启动 LV-S04/LV-S07。
```

### 6.5 其他 Agent

```text
Android、iOS、Benchmark、Examples 当前保持停止，不修改 Spec/代码，不启动下一分 Spec。
```
