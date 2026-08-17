# LV-S03 任务

## 目录

- [1. 结论](#1-结论)
- [2. 编码前门禁](#2-编码前门禁)
- [3. 实现任务](#3-实现任务)
- [4. 验证任务](#4-验证任务)
- [5. 完成条件](#5-完成条件)

## 1. 结论

LV-S03 的后续实现顺序固定为：**先建立 bounded command/result 骨架，再建立 page-root 状态机，最后实现原子 push/close 与销毁。** 当前文件不授权编码。

## 2. 编码前门禁

- 本分 Spec 经总架构校审 `PASS`，工作看板明确 `CODE_ALLOWED`。
- LV-S01/LV-S02 保持 `VERIFIED`。
- 对齐 CORE-S01 `PlatformSurfacePort/CoreIngressPort/EnqueueResult` 的真实 C++ 名称，只允许机械适配。
- 公共 Surface Schema 如有语义缺口，写 Handoff `[待决策]`，不得私加字段。
- 不因 LV-S04 尚未实现而写假的生产 Mount/Host Tree；只用 Fake content hook 验证 S03。

## 3. 实现任务

| ID | 任务 | 依赖 | 完成定义 |
|---|---|---|---|
| LV-S03-T01 | 建立 Surface Host target、typed command gateway 和固定 operation slots | S01/S02 | accepted 所有权、queue full/closed、单 result slot 和 close 线性化成立。 |
| LV-S03-T02 | 实现 owner-thread SurfaceHostTable 与 Build Profile limits | T01 | 固定容量、单写、duplicate/missing/busy 校验；无 route/Navigation 数据。 |
| LV-S03-T03 | 实现隐藏 page-root factory 与 create | T02 | root 独立、layout disabled、发布前 hidden；失败无半映射。 |
| LV-S03-T04 | 实现 page-root lease、mount-readiness 与 Fake content lifecycle hook | T02-T03 | lease 不逃逸 owner 栈；full Mount success/failure 阶段明确。 |
| LV-S03-T05 | 实现 root present、visibility 与幂等 no-op | T03-T04 | public Result 精确回显；状态越级失败且不改变 root。 |
| LV-S03-T06 | 实现 push preflight/commit | T05 | source/target 同时 reservation；一个 owner task、flush 前原子切换；失败零修改。 |
| LV-S03-T07 | 实现 close preflight/commit 与 recursive destroy/reset | T04-T06 | close destroy+reveal 原子；destroy 阻止 Mount/命令；失败 reset 不复活。 |
| LV-S03-T08 | 实现 Result 回流、bounded retry、RequestId replay guard 与 Trace/counters | T01-T07 | accepted 恰好一个 terminal Result；无 spin、重复 side effect 或无界 backlog。 |
| LV-S03-T09 | 实现显式 close/stop 协调 | T08 | admission 关闭、accepted 收口、roots/slots/results 归零；析构只断言。 |

## 4. 验证任务

| ID | 任务 | 必须输出 |
|---|---|---|
| LV-S03-V01 | 公共 Schema/typed union 合同测试 | 五类 command/result 正反例和字段精确回显。 |
| LV-S03-V02 | create/state/visibility 测试 | hidden publication、mount readiness、no-op、duplicate/missing/state-skip。 |
| LV-S03-V03 | root/push/close 原子性测试 | preflight 注入失败零修改；success 在 display flush 前只观察整体状态。 |
| LV-S03-V04 | destroy/reset/teardown 测试 | content/root/mapping/listener 释放顺序，destroy failure reset，late result tombstone。 |
| LV-S03-V05 | admission/replay/背压测试 | 单 Surface in-flight、双 Surface reservation、queue full/closed、same RequestId 无重复副作用。 |
| LV-S03-V06 | 线程与压力测试 | 非 owner 调用断言、多 producer post、10,000 轮 create/present/hide/show/destroy。 |
| LV-S03-V07 | 双 Profile 与依赖扫描 | 16/4 边界，shared Core/JS 无 LVGL/SDL/libuv，Adapter 语义两 Profile 同源。 |
| LV-S03-V08 | sanitizer 与资源证据 | Debug/Release、ASan/UBSan/TSan；roots/operations/results/mappings 归零。 |
| LV-S03-V09 | 生成 S03 verification evidence | Case 到测试/扫描逐项映射、源码摘要和可复现命令。 |

## 5. 完成条件

1. T01-T09 与 V01-V09 全部完成。
2. [验收](./acceptance.md) 全部通过。
3. 没有 route 栈、Mount/Host Component、Event/Input/Measure 实现。
4. 没有修改公共 Surface 合同；公共缺口已标记 `[待决策]`。
5. Handoff 标记实现 `READY_FOR_REVIEW`；不得自行启动 LV-S04。
