# LV-S04 Acceptance

## 目录

- [1. 功能验收](#1-功能验收)
- [2. 线程与资源验收](#2-线程与资源验收)
- [3. 边界验收](#3-边界验收)
- [4. 需求追踪](#4-需求追踪)

## 1. 功能验收

| ID | 场景 | 通过条件 |
|---|---|---|
| S04-A01 | 真实 S03 root + full View/Text/Button | 真实 LVGL object 创建，Mount Result=`mounted`，Node 映射为 3，Button 私有 label 可计数。 |
| S04-A02 | full 操作顺序 | 只接受 Create/Set/Insert；首个 root 建立在 page root；子节点最终父子顺序正确。 |
| S04-A03 | 属性与布局 | text/enabled/color/backgroundColor/borderRadius/textAlign 和非负 logical-px 生效；未知/越界值失败。 |
| S04-A04 | incremental Move | 既有 object 和后代映射保持不变，只改变 parent/index；环被拒绝。 |
| S04-A05 | incremental Remove | 根和整棵 Host 子树递归删除；后代 NodeId 不可再次寻址。 |
| S04-A06 | Present/visible | Mount 成功后 root 仍 hidden；S03 Present 成功后 root visible，Mount 不自行 present。 |
| S04-A07 | 事务失败 | 非法 root、顺序、属性、容量或 LVGL 创建失败均返回一个 failed Result。 |
| S04-A08 | close | close 后拒绝新 post；完成 pending 后 finishClose 释放全部 object/mapping/slot。 |

## 2. 线程与资源验收

| ID | 场景 | 通过条件 |
|---|---|---|
| S04-N01 | 非 owner service/finishClose | 返回 wrong-thread，不调用 LVGL。 |
| S04-N02 | producer 和队列满 | 只出现 accepted 或明确失败；无阻塞、无 spin、无扩容。 |
| S04-N03 | 双 Profile | simulator 16/512/64，embedded 4/64/16；超限可预测失败。 |
| S04-N04 | 失败恢复 | 每个 accepted transaction 恰好一个终态 Result；失败后本地计数收敛。 |
| S04-N05 | sanitizer | Debug、Release、ASan/UBSan、TSan 通过，边界扫描通过。 |
| S04-N06 | 资源归零 | close/finishClose 后 live objects、pending transactions、Node 映射和 owner task 均为零。 |

## 3. 边界验收

1. 公共 mount header 不包含 `lvgl.h`、SDL、libuv、Runtime Tree、Revision 或 route/navigation authority。
2. S04 不实现 Input/Event、Measure、Capability、完整 Runtime Host 或 RPK Loader。
3. Platform 不维护 Core route stack、Runtime Tree、Revision 或 Layout authority。
4. Case 001 S1 的 S04 证据使用真实 LVGL/SDL Host，不能用 fake object 冒充可见性。
5. RPK -> JS -> Core -> Mount 的完整装配不由 S04 单独宣称完成，等待上游 Loader/Core 集成。

## 4. 需求追踪

| 需求 | 任务 | 验收 |
|---|---|---|
| R01-R04 | T02-T03 | A01-A03、边界 1 |
| R05-R06 | T04-T05 | A02、A04-A05、A07 |
| R07-R08 | T05、T08 | N01-N03、边界 3 |
| R09-R10 | T06 | A07-A08、N04、N06 |
| R11-R12 | T07-T09 | A01、A06、N03-N06、边界 4-5 |

