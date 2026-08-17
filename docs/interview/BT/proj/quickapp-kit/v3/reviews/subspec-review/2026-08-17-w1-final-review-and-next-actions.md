# W1 复核、进度与下一步

> 本文记录上一门禁状态；当前结论以 [`2026-08-17-w1-close-and-w2-launch.md`](./2026-08-17-w1-close-and-w2-launch.md) 为准。

## 目录

- [1. 结论](#1-结论)
- [2. 复核结果](#2-复核结果)
- [3. 当前进度](#3-当前进度)
- [4. 下一步](#4-下一步)
- [5. Agent 指令](#5-agent-指令)

## 1. 结论

W1 六项中五项已经 `VERIFIED`，Core 窄联调也已验证。JS-S02 设计现已 `PASS + CODE_ALLOWED`；其实现通过后直接关闭 W1 并并行启动 W2。

## 2. 复核结果

| 项目 | 结论 | 核心证据 |
|---|---|---|
| TK-S02/TK-S03 | `VERIFIED` | 17 个源码摘要匹配；typecheck/lint/build、65/65、CLI 17/17 通过 |
| CORE-S02/CORE-S05 | `VERIFIED` | 单项源码摘要匹配；Release、ASan/UBSan、TSan 各 6/6 通过 |
| CORE-S02 -> CORE-S05 联调 | `VERIFIED` | 真实 `PageIrHandle` 链路；Release、ASan/UBSan、TSan 各 8/8 通过 |
| LV-S02 | `VERIFIED` | 已完成双 Backend、裁剪、资源归零和证据收口 |
| JS-S02 | `PASS + CODE_ALLOWED` | AppRuntime 唯一 allocator 与 S02 非所有权已闭环 |

当前唯一未完成项是 JS-S02 产品实现与证据。

## 3. 当前进度

| 范围 | 已完成 | 总数 | 状态 |
|---|---:|---:|---|
| Product V1 | 13 | 69 | `IN_PROGRESS` |
| M1 | 10 | 41 | `W1 IN_PROGRESS` |
| W1 | 5 | 6 | `5_OF_6 VERIFIED` |

当前还没有跑通 Case 001；W1 只是把 Toolkit 前端、ABI、包加载、权威树和 LVGL Host Backend 这段骨架建好。


## 4. 下一步

1. JS Agent 严格按已通过的五份分 Spec 实现 JS-S02。
2. 总架构复核源码、验收映射和多配置测试。
3. JS-S02 通过后关闭 W1，统一发布 W2：TK-S04；JS-S03/S04；CORE-S03/S04；LV-S03/S06。

## 5. Agent 指令

### JS Runtime Agent

```text
继续当前 JS Runtime 对话。JS-S02 已 PASS + CODE_ALLOWED。

只实现 JS-S02 的 T01-T09，并满足 A01-A50；不得启动 JS-S03。

固定边界：
1. 实现唯一 Runtime ABI Client、closed typed unions、严格 codec、14 个 Native Function、EnqueueResult、bounded bridge correlation、typed callback admission 和确定性 teardown。
2. S02 只消费已带 req:j-* 的 typed message；不得在 RuntimeAbiService/S02 中实现或持有 JsRequestIdAllocator，不得增加 ID Native Function。
3. allocator 生产实现属于后续 JS Framework bootstrap；本轮只允许 test-only fixture 验证模块 A/B/A 共享取号得到 req:j-1/2/3。
4. PendingRecord 只能保存 key、expected result kind、owner 和 generation；不得保存 Promise/callback、completionToken、Render snapshot 或 JS Value。
5. 不实现 Module Loader、VM、Binding、Block、Render、Handler、typed API 或平台代码；不修改公共合同和 Schema。

完成要求：
1. Fake Engine 与 QuickJS 运行相同 ABI 合同。
2. 覆盖 accepted/overflow/OOM/closed/late/duplicate/mismatch、Surface/AppRuntime teardown 和资源归零。
3. 重跑 Debug、Release、ASan/UBSan、TSan、API-only 与边界扫描。
4. 提交逐项验收映射、可复现命令和 source-manifest.sha256。
5. 在 AGENT-HANDOFF.md 追加 READY_FOR_REVIEW 后停止。
```

### Runtime Core Agent

```text
CORE-S02、CORE-S05 与真实 PageIrHandle -> RuntimeTreeStore 窄联调均已 VERIFIED。停止修改，等待 W2；不得启动 CORE-S03 或 CORE-S04。
```

### Toolkit、LVGL、Android、iOS、Benchmark、Examples Agent

```text
当前任务已结束。停止修改，保持现状，等待总架构发布 W2 或后续里程碑；不得自行启动下一分 Spec。
```
