# LV-S03 验收

## 目录

- [1. 结论](#1-结论)
- [2. 创建与展示](#2-创建与展示)
- [3. 原子导航视觉操作](#3-原子导航视觉操作)
- [4. 失败、幂等与销毁](#4-失败幂等与销毁)
- [5. 线程、资源与边界](#5-线程资源与边界)
- [6. 需求追踪](#6-需求追踪)
- [7. 通过条件](#7-通过条件)

## 1. 结论

LV-S03 的通过标准是：**Fake Core 驱动五类公共 Surface command 时，LVGL page roots 按合同原子变化，accepted command 恰好完成一次，且 Platform 从未形成第二套路由真相。**

## 2. 创建与展示

| Case | 输入 | 必须结果 |
|---|---|---|
| S03-A01 create | 合法 viewport 与新 SurfaceId | 独立 root 在映射发布前 hidden、layout disabled；Result=created。 |
| S03-A02 duplicate create | 已存在 SurfaceId | failed `SURFACE_HOST_ALREADY_EXISTS`；原 handle/阶段不变。 |
| S03-A03 full mount readiness | Fake content hook success/fail | success 变 hidden-mounted；fail 保持 hidden-empty；均不显示。 |
| S03-A04 root present | hidden-mounted root | 清除 hidden，Result=presented；Core Result 前不伪造启动成功。 |
| S03-A05 visibility | visible->hidden->hidden->visible | success；第二次 hidden 是无副作用 completed no-op。 |
| S03-A06 invalid transition | hidden-empty present 或 absent visibility | public failed；root/table 不变。 |

## 3. 原子导航视觉操作

| Case | 输入 | 必须结果 |
|---|---|---|
| S03-P01 push success | source visible + target hidden-mounted | 同一 owner task 内 target visible、source hidden；display flush 只观察提交后整体。 |
| S03-P02 push preflight failure | target 未 mounted、source missing 或 handle invalid | failed `SURFACE_PRESENTATION_FAILED`；二者 flags/阶段不变。 |
| S03-P03 explicit source | 命令 source 与其他 hidden root 共存 | 只操作命令指定 source；Platform 不自行选栈顶。 |
| S03-P04 close success | closing visible + reveal hidden | content/root/mapping 删除并 reveal visible；Result=completed。 |
| S03-P05 close preflight failure | release hook fail 或任一状态非法 | failed；closing/reveal/content 全部保持原状。 |
| S03-P06 explicit reveal | 多个 hidden roots | 只展示 revealSurfaceId；Platform 不保存前驱关系。 |

## 4. 失败、幂等与销毁

| Case | 注入 | 必须结果 |
|---|---|---|
| S03-N01 capacity | 第 17/5 个 live root | simulator/embedded create 分别 failed `OUT_OF_MEMORY`；无临时 root。 |
| S03-N02 queue full | operation/task capacity 耗尽 | post 未 accepted、`QUEUE_OVERFLOW`；没有 Result 或 side effect。 |
| S03-N03 same request replay | pending/最近完成 RequestId 与相同 payload | 不重复 LVGL mutation；一个逻辑 request 只有一个终态 Result。 |
| S03-N04 request conflict | 相同 RequestId、不同 payload | rejected；原 operation/result 不变。 |
| S03-N05 concurrent control | 同 Surface 第二命令或 push/close 交叉占用 | 第二条未 accepted；第一条顺序和结果不变。 |
| S03-N06 result backpressure | CoreIngress 暂时 full | 原 slot 每 turn 一次重试；不 spin、不复制、不丢失。 |
| S03-N07 destroy success | 任一本地可销毁阶段 | 新命令/Mount 被拒，content/root/mapping 递归释放，Result=destroyed。 |
| S03-N08 destroy failure | invalid root/content preflight failure | failed + container-level reset；映射不可寻址，同 ID 不恢复残留。 |
| S03-N09 close during shutdown | accepted commands + close | accepted 命令得到 Result 或明确 tombstone；所有 roots/slots 清零。 |

## 5. 线程、资源与边界

必须证明：

1. `lv_*`、SurfaceHostTable、local phase 和 content hook 只在绑定 owner thread 访问。
2. Core thread post 不执行 LVGL、不同步等待 owner、不接收 PageRootHandle。
3. push/close 从 preflight 到 commit 结束之间没有 display flush 或其他 owner task。
4. live roots/operations/results 分别不超过 Profile 16/16/16 与 4/4/4；无动态扩容。
5. 10,000 轮及多 producer 压力下，无 accepted 丢失、重复 Result、数据竞争或资源增长。
6. Debug、Release、ASan/UBSan、TSan 全部通过；stop 后全部资源计数为零。
7. 源码/依赖扫描不含 route parser、Navigation stack、JS Hook、Mount op、Host Component、Input/Event/Measure。
8. simulator 与 embedded 使用同一状态机和合同测试，只有 Foundation/Display Backend 选择不同。

## 6. 需求追踪

| 需求 | 任务 | 验收 |
|---|---|---|
| R01-R02 | T01、T08-T09 | N02、N06、N09、资源 5-6 |
| R03-R05 | T02-T05 | A01-A04、A06、N01 |
| R06-R08 | T05-T07 | A05、P01-P06 |
| R09-R10 | T07、T09 | N07-N09 |
| R11-R12 | T01-T02、T06、T08 | N03-N05 |
| R13-R14 | T02、T04 | A03、P03/P06、资源 2/7 |
| R15-R19 | T01-T09 | N02/N05/N06/N09、资源 1-8 |
| R20 | T08 | Trace failure fixture、资源 6 |

## 7. 通过条件

- 全部 Case、线程、资源、sanitizer 与边界扫描通过。
- 公共 Surface command/result 语义和 Schema 未被重定义。
- Platform 仅有资源映射，不包含 route、栈或 Core 生命周期真相。
- 独立校审 `PASS + CODE_ALLOWED` 后才可编码；编码完成后仍不得自行启动 LV-S04。
