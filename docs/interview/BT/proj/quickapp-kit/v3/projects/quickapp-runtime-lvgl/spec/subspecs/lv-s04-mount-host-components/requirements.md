# LV-S04 Requirements

## 目录

- [1. 需求](#1-需求)
- [2. 非目标](#2-非目标)
- [3. 约束](#3-约束)

## 1. 需求

| ID | 需求 | 结果 |
|---|---|---|
| LV-S04-R01 | Adapter 必须消费 v3 公共 `MountTransaction` 语义，不重新定义操作名称、顺序或结果含义。 | 代码使用 `CreateHost`、`SetHostProp`、`SetHostLayout`、`InsertHostChild`、`MoveHost`、`RemoveHost`。 |
| LV-S04-R02 | 每个 Surface 的 Mount 目标必须解析到 S03 已创建的 page root。 | 缺失或无效 root 整笔失败且无 LVGL 副作用。 |
| LV-S04-R03 | V1 M1-Alpha 只支持 View、Text、Button。 | 其余类型在上游应被拒绝；本 Adapter 不伪造兼容对象。 |
| LV-S04-R04 | `NodeId` 必须映射到本地 LVGL object，Button 的内部 label 只能是平台私有资源。 | 不向 Core 或公共 Port 暴露 LVGL 指针。 |
| LV-S04-R05 | full Mount 只允许 Create/Set/Insert；必须先清空该 Surface 的本地 Host object 和映射。 | full 失败时不得返回 mounted。 |
| LV-S04-R06 | incremental Mount 必须支持已有节点的 property/layout/move/remove；Remove 必须递归清理 Host 子树。 | 映射和 LVGL 对象数量一致。 |
| LV-S04-R07 | 所有 LVGL object 操作、映射读写和结果完成都必须在绑定 owner thread 执行。 | 非 owner 的 service/close 完成返回线程错误。 |
| LV-S04-R08 | post 必须有界、可失败、producer-safe；owner 通过 task queue 按预算执行。 | 队列或事务槽耗尽返回 `QUEUE_OVERFLOW`，不阻塞、不扩容。 |
| LV-S04-R09 | 一笔事务必须具有预检和提交边界；任一操作失败必须清理本地对象并返回一个失败 Result。 | 不跳过坏操作继续返回 mounted。 |
| LV-S04-R10 | close 必须拒绝新事务，显式等待已接受任务完成后销毁所有对象和本地映射。 | finishClose 后 pending/live 为零。 |
| LV-S04-R11 | 双 Profile 必须使用固定上限，且共享同一事务算法。 | simulator 16 transactions/512 objects/64 ops；embedded 4/64/16。 |
| LV-S04-R12 | Mount commit、Present、可见性和资源释放必须可通过 typed Result、Surface state 和计数器观察。 | Case 001 S1 提供 mount/present/visible/resource 证据。 |

## 2. 非目标

本轮不实现 RPK Loader、JS Framework、Core Runtime Tree、Core Revision 校验、Core Layout、Input/Event、Measure、Capability、完整导航或完整 Runtime Host。真实 RPK 到 Core MountTransaction 的装配属于上游 Core/Case Integration；S04 只执行已经通过公共合同的 MountTransaction。

## 3. 约束

1. 公共头文件不得包含 `lvgl.h`、SDL、libuv 或任何具体 Host 类型。
2. Platform 不复制 Runtime Tree、Route stack、Revision 或 Core Layout authority。
3. Native object 只能由 owner thread 创建、修改、移动和销毁。
4. V1 不承诺跨平台 Host 回滚；失败采用本地清理并把恢复决定交给 Core 的既有 full rebuild 流程。

