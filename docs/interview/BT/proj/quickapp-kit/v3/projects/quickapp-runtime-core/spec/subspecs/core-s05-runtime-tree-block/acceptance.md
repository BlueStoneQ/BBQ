# CORE-S05 验收

## 目录

- [1. 结论](#1-结论)
- [2. 结构验收](#2-结构验收)
- [3. Block 与 Handler 验收](#3-block-与-handler-验收)
- [4. Staging 与原子性](#4-staging-与原子性)
- [5. 线程与资源](#5-线程与资源)
- [6. 边界扫描](#6-边界扫描)
- [7. 证据](#7-证据)

## 1. 结论

验收通过的含义是：一个 Surface 的全部动态结构只有一个 committed Store；任何增量变更要么完整生效，要么 Store 完全不变。

## 2. 结构验收

| ID | 场景 | 预期 |
|---|---|---|
| S05-A01 | 最小静态 Page IR | 一个 root Store；NodeId、LogicalRef 和父子索引互相一致 |
| S05-A02 | 静态兄弟和多层后代 | 遍历与 Page IR 声明顺序一致，无额外对象树 |
| S05-A03 | 初始 binding/handler target | 均解析到同一 Runtime Node；不持有 callback |
| S05-A04 | 缺失 template/owner 或 scope 错误 | 对应 typed error，Store 不发布或不变 |
| S05-A05 | NodeId 分配后 mutation rollback | ID 不复用，live node counter 不增加 |
| S05-A06 | 达到 nodes/children/ops 上限 | `OUT_OF_MEMORY`，无部分 apply |

## 3. Block 与 Handler 验收

| ID | 场景 | 预期 |
|---|---|---|
| S05-B01 | 创建含静态后代和 Handler 的 Block | owner 为 BlockInstanceId；映射和 handler add delta 正确 |
| S05-B02 | 相同 slot/key keyed reuse | 保留 BlockInstanceId、NodeId、HandlerId，不重复创建 |
| S05-B03 | 新 key 替换 | 新实例获得新 ID；旧 ID tombstoned |
| S05-B04 | 删除含嵌套 Block 的父 Block | 后代 ownership/index 原子清除；handler remove delta 先于根删除语义 |
| S05-B05 | 删除后再次用旧 BlockInstanceId 执行 InstantiateBlock | `ABI_INVALID_ARGUMENT`，不能复活 |
| S05-B06 | 同 parent reorder | final-index 顺序正确，内部 ID 不变 |
| S05-B07 | 合法/非法 cross-parent move | 仅同 Surface 且 Page IR slot 合法者成功 |
| S05-B08 | Handler ownership 与 Fake EventBinding participant | S05 只输出 delta；唯一可分发状态位于 participant |
| S05-B09 | 重复或已释放 HandlerId 再注册 | `HANDLER_ALREADY_EXISTS`，Tree 与两侧 Handler 状态不变 |
| S05-B10 | RemoveBlock/MoveBlock 引用不存在或已删除 BlockInstanceId | `BLOCK_NOT_FOUND`，Tree 与 ownership 不变 |

## 4. Staging 与原子性

1. 构造大 Store，只改一个叶节点，mutation 占用与变更量相关而非与全树线性相关。
2. stage 中途在每个分配点注入 OOM，committed nodes/index/blocks/handlers/counters 逐字节语义不变。
3. base generation 改变后旧 mutation apply 被拒绝，不做自动 rebase。
4. apply 前容量已预留；apply 不调用外部 Port、Loader、JS 或 Host。
5. initial tree、instantiate/remove/move 都通过同一 mutation/apply 原子路径。
6. discard 后 active mutation 和临时 arena 为零，已消费 ID 不回退。
7. EventBinding prepare 失败时树不变；prepare 后 Layout 失败执行 abort；联合 commit 后 Tree、ownership 和 dispatch index 同时呈现新状态。

## 5. 线程与资源

- 非 Core Runtime Thread 直接写 Store 必须被 API 结构禁止或 debug 断言捕获。
- stage/discard/apply 与 Surface stop 的合法顺序重复验证，无 UAF、死锁和残留 pin。
- teardown 后 `liveNodes=0`、`liveBlocks=0`、`ownedHandlers=0`、`tombstones=0`、`activeMutations=0`。
- `runtimeNodeLive` 与 committed Store 节点数一致；S05 不重复修改 `handlerLive`。
- Release、ASan/UBSan 和 TSan 全部通过。

## 6. 边界扫描

- 生产代码只接受 `PageIrHandle` 或 Fake 等价接口，不包含 ZIP、JSON、Bundle、PackageSource/parser 依赖。
- 不存在 `newTree/oldTree/shadowTree/hostTree` 等第二权威树实现。
- 不包含 Layout、MountTransaction、Revision allocator、event callback/dispatch 实现。
- 公共和 Core 头文件不出现具体平台或执行引擎类型。
- RuntimeNode 不保存原生 view、指针编码 ID 或 JS function。

## 7. 证据

实现复核必须提交：

- requirement/test 对照表和静态/Block 结构快照。
- keyed reuse、tombstone、remove/move 和 Handler delta 证据。
- OOM 全分配点、stale generation、rollback 原子性证据。
- mutation 内存与变更量关系证据。
- Release、ASan/UBSan、TSan、依赖扫描与资源归零结果。
