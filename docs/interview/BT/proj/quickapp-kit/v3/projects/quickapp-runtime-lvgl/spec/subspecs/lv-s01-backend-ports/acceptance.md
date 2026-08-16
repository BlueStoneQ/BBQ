# LV-S01 验收

## 目录
- [1. 结论](#1-结论)
- [2. 正例](#2-正例)
- [3. 负例与故障注入](#3-负例与故障注入)
- [4. 资源与线程](#4-资源与线程)
- [5. 需求追踪](#5-需求追踪)
- [6. 证据与通过条件](#6-证据与通过条件)

## 1. 结论

LV-S01 的通过标准是：**同一套合同测试能确定性验证桌面型和受约束型配置，而不加载 SDL、libuv、LVGL、Core 或 Runtime Host 实现。**

## 2. 正例

| Case | 输入 | 预期 |
|---|---|---|
| A01 owner binding | 当前线程首次 bind | 成功；后续同线程 pump 成功。 |
| A02 bounded FIFO | 容量 4，post 4 个 task | 全部只执行一次且顺序一致。 |
| A03 fair pump | 5 个 task，budget=2 | 三轮 2/2/1，每轮可进入 input/display 阶段。 |
| A04 wakeup | 空队列等待后 producer post | notify 打断等待，task 仍只由 owner 执行。 |
| A05 frame | 合法 frame 和 dirty region | Fake Display 记录一致摘要，返回后无借用。 |
| A06 input | down/move/move/up | 有容量时完整；受压时仅连续 move 可合并。 |
| A07 drain stop | 3 个已接收 task 后 drain | 拒绝新 task，执行 3 个，清空输入并 close。 |
| A08 cancel stop | 3 个已接收 task 后 cancel | task 不执行但各销毁一次，资源归零。 |
| A09 cooperative | Wakeup unsupported | 外部 pump 得到相同 FIFO/deadline 语义。 |
| A10 static storage | 调用者提供固定存储 | open 到 close 无扩容和隐藏堆分配。 |

## 3. 负例与故障注入

| Case | 注入 | 必须结果 |
|---|---|---|
| N01 wrong thread | 非 owner 调用 owner-only API | `wrong_thread`，状态不变。 |
| N02 task overflow | 容量满后继续 post | `full`；已接受 task 不丢失、不覆盖。 |
| N03 input overflow | 缓冲满后输入 edge | edge 明确拒绝并计数，不伪造 click。 |
| N04 invalid frame | stride/length/region 越界 | `invalid_argument`，不读取像素。 |
| N05 present failure | Fake 第 K 帧失败 | `backend_failed`，无重试和悬挂借用。 |
| N06 wake failure | wait/notify 失败 | 错误可见；协作式 pump 不冒充 task 完成。 |
| N07 clock regression | Fake Clock 倒退 | 设置被拒绝，后续时间不倒退。 |
| N08 open failure | Display/Input open 失败 | 反向关闭已打开资源，最终 closed。 |
| N09 post after stop | stopping/closed 后 post | stopping/invalid，所有权不转移。 |
| N10 close twice | 重复 close | 幂等，无二次释放或平台调用。 |
| N11 contention | critical section 已被占用 | 立即返回 `busy`；task/sample 所有权不转移，释放后重试成功。 |
| N12 lifecycle violation | 析构前未 closed 或 depth 非零 | 断言暴露违约；析构本身不取锁、不销毁 task。 |

## 4. 资源与线程

必须证明：

1. task 只有“执行一次”或“销毁一次”两种终态。
2. accepted task 的 capture destructor 记录的上下文必须是 owner；拒绝任务仍由调用方负责。
3. frame 借用在 present 返回时结束。
4. raw sample 被 drain、合法合并或明确计入 drop/overflow。
5. stop 后 task depth、input depth、借出 frame、Backend live count 均为零。
6. 只有 owner 调用 owner-only API；producer 只调用 post/notify 或采样入口。
7. 重复 10,000 轮 open/pump/stop/close 无持续内存增长。

## 5. 需求追踪

| 需求 | 任务 | 验收 |
|---|---|---|
| R01-R02 | T03 | A01-A04、N01 |
| R03-R04 | T03 | A02-A03、N02 |
| R05 | T04 | N07、资源检查 5 |
| R06-R07 | T04 | A04、A09、N06 |
| R08-R09 | T05 | A05、N04-N05、资源检查 2 |
| R10-R11 | T06 | A06、N03、资源检查 3 |
| R12-R14 | T07 | A07-A08、N08-N12、资源检查 1/2/5 |
| R15 | T08 | A01-A10、N01-N10 |
| R16 | T01、T09 | A09-A10、依赖与符号证据 |

## 6. 证据与通过条件

证据：Fake 合同测试；task 序列、最大队列深度与 overflow；Clock/Wakeup 脚本；frame 摘要与 input 序列；stop 前后 live object/bytes；依赖/符号扫描；支持环境下的 sanitizer 报告。

同时满足以下条件才通过：

- 全部正例、负例、故障注入和资源检查通过。
- Release、ASan/UBSan、TSan 与无界 spin 静态扫描通过。
- Fake 与 caller-owned cooperative 配置通过同一合同套件。
- 无公共合同重定义，无 SDL/libuv/LVGL/Core 类型泄漏。
- 每项需求至少映射到任务和验收 Case。
- 独立校审 PASS；该结论不自动授权编码。
