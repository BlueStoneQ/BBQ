# 当前 Agent 指令

## 目录

- [1. 结论](#1-结论)
- [2. Core Agent](#2-core-agent)
- [3. JS Agent](#3-js-agent)
- [4. Toolkit Agent](#4-toolkit-agent)
- [5. LVGL Agent](#5-lvgl-agent)
- [6. 保持停止](#6-保持停止)

## 1. 结论

**继续使用现有长期 Agent 对话：Core 修复证据后实现 CORE-S04，JS 实现 JS-S03，Toolkit 等待 TK-S05/TK-S06 设计校审，LVGL 设计 LV-S04。不得新建项目内并行 Agent。**

验收依据见 [W2 实现验收](./2026-08-18-w2-implementation-review.md)。当前若执行首屏纵向闭环，以 [`v3/m1-alpha/agent-instructions.md`](../../m1-alpha/agent-instructions.md) 为准；Toolkit TK-S05/TK-S06 校审结果见 [`2026-08-18-toolkit-s05-s06-review.md`](./2026-08-18-toolkit-s05-s06-review.md)；本文档保留为 W2 定向返修记录。

## 2. Core Agent

```text
继续当前 Runtime Core 对话。

第一步：修复 CORE-S03 证据。
- 重新生成完整 evidence/source-manifest.sha256。
- 必须包含 CORE-S03 新增源码、测试、边界扫描和当前 CMakeLists.txt。
- 执行 shasum -a 256 -c evidence/source-manifest.sha256，必须全部通过。
- 不修改 CORE-S03 产品行为和公共合同。

证据通过后，在同一轮开始实现 CORE-S04。
严格按 core-s04-surface-navigation/tasks.md 和 acceptance.md 实现 Surface/Navigation Controller。

保持：
- Core 独占 Surface 生命周期、Navigation 栈和 Revision。
- revision 0 前不发送 SurfaceStatusChanged。
- Platform 只执行显式 Surface command，不拥有路由。
- 不实现 CORE-S06、Render、Layout 或 Mount。

完成后提交测试矩阵、资源归零、源码清单和 Handoff，标记 READY_FOR_REVIEW。
```

## 3. JS Agent

```text
继续当前 JS Runtime 对话。

JS-S03 已 PASS + CODE_ALLOWED，立即按 tasks.md 实现 Module ABI 与 Loader。

必须完成：
- VerifiedModule immutable bytes 消费。
- $app_define$ / $app_bootstrap$ / $app_require$。
- App/Shared/Page Module cache。
- P0-JS-EXPORT-001 Definition 校验。
- 确定性内容失败缓存。
- OOM、queue overflow、scope close、teardown cancellation 可重试。
- Bundle、cache、lease、waiter 和 bytes 确定释放。

不得实现 JS-S04、Binding、Event、Render 或 Capability。

完成后提交 Debug、Release、ASan/UBSan、TSan、边界扫描、资源归零和源码摘要，标记 READY_FOR_REVIEW。
```

## 4. Toolkit Agent

```text
继续当前 Toolkit 对话。

TK-S05/TK-S06 分 Spec已提交 READY_FOR_REVIEW。
当前停止修改，等待总架构设计校审。
不得编码 TK-S05/TK-S06，不得启动 TK-S07。
```

## 5. LVGL Agent

```text
继续当前 LVGL Runtime 对话。

LV-S03/LV-S06 已 VERIFIED。现在只设计 LV-S04 Mount 与 Host Components。

必须冻结：
- MountTransaction 到 View/Text/Button 的映射。
- NodeId 到 LVGL object 的平台本地映射。
- full/create/update/move/remove 操作。
- owner thread、事务原子性、失败恢复、资源上限和销毁。
- Platform 不维护 Runtime Tree、Revision、路由或 Layout 权威状态。

提交 README、requirements、design、tasks、acceptance。
现在不编码，不启动 LV-S05/LV-S07。
```

## 6. 保持停止

Android、iOS、Benchmark、Examples 不启动新分 Spec，不修改当前代码和公共合同。
