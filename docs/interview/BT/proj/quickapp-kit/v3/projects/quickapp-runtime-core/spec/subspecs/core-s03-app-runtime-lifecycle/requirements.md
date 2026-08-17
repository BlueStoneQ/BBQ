# CORE-S03 需求

## 目录

- [1. 结论](#1-结论)
- [2. 功能需求](#2-功能需求)
- [3. 状态与所有权](#3-状态与所有权)
- [4. 异步与失败](#4-异步与失败)
- [5. 质量需求](#5-质量需求)
- [6. 非目标](#6-非目标)
- [7. 需求追踪](#7-需求追踪)

## 1. 结论

AppRuntime 生命周期必须只有一个 Core owner、一个串行状态机和一条 typed 完成链；模块加载、VM 初始化、Hook 或 Platform 结果未到达时，Core 只能保持在途或 teardown，不能假定完成。

## 2. 功能需求

| ID | 需求 |
|---|---|
| S03-R01 | `AppRuntimeFactory` 为每个新 `AppRuntimeId` 创建且只创建一个 `AppRuntimeController`；Host 不传入或覆盖 ID。 |
| S03-R02 | AppRuntime 唯一状态机固定为 `creating -> ready -> foreground/background -> destroying -> destroyed`，非法转换返回 typed error 且状态不变。 |
| S03-R03 | 从 verified Manifest/Metadata 构造一个 immutable `AppContext`，并在交付 app Module 前先成功投递给 JS。 |
| S03-R04 | app 启动顺序固定为 AppContext -> verified app Module -> loaded Result -> App VM initialization -> completed；`onCreate` 每个 AppRuntime 最多一次。 |
| S03-R05 | shared Module 按 verified dependency 顺序按需加载，绑定 AppRuntime cache；它不 bootstrap、不创建第二个 App VM。 |
| S03-R06 | 为 S04 提供 page Module -> loaded Result -> Page VM initialization 的调度服务；Page 资源按 `SurfaceId` 隔离。 |
| S03-R07 | Host 只能通过 `RuntimeLifecycleControl` 请求 foreground、background 或 destroy；Core 返回同一个 Host `RequestId` 的 typed Result。 |
| S03-R08 | foreground/background 每个 AppRuntime 最多一个在途控制；并发或重入返回 `LIFECYCLE_BUSY`。 |
| S03-R09 | foreground -> background 顺序固定为 top Host hidden -> Core 状态提交 -> Page `onHide` -> App `onHide` -> Host Result；ready -> background 只提交初始后台状态，不发送未配对的 `onHide`。 |
| S03-R10 | foreground 顺序固定为 top Host visible -> Core 状态提交 -> App `onShow` -> Page `onShow` -> Host Result。 |
| S03-R11 | 无 Surface 时跳过 Platform 和 Page Hook，但保持 App 状态、App Hook 和 Host Result 顺序。 |
| S03-R12 | destroy 固定先停止新工作，再经 S04 自顶向下销毁全部 Surface，执行 App `onDestroy`，最后释放 JS、Package、队列、correlation、allocator 与 AppRuntime。 |
| S03-R13 | 所有 module/init/hook/platform 子操作使用 Core `RequestId`；上层 Host RequestId 原样返回，内部表保存 child -> parent 因果关系。 |
| S03-R14 | 每个 accepted async request 恰好一个终态；重复、未知、来源不符和 teardown 后结果按 late/stale 规则丢弃并记录。 |
| S03-R15 | V1 不设置改变业务语义的墙钟超时；操作只由 typed Result 或 teardown cancellation 结束，不以超时猜测成功/失败。 |
| S03-R16 | App module/init 失败终止 AppRuntime；Page module/init 失败只通知 S04 清理未提交 Surface。 |
| S03-R17 | 可见性已提交后的 Hook 失败记录 `JS_EXCEPTION` 但不回滚状态；Host Result 等待该次全部 Hook Result 后返回 completed。 |
| S03-R18 | AppRuntime 创建、控制和销毁发出结构化 lifecycle/bridge/error Trace，观测关闭不改变状态或结果。 |

## 3. 状态与所有权

| 对象 | 唯一 owner | 生命周期 |
|---|---|---|
| `AppRuntimeController` | `AppRuntimeFactory` | Factory create 到最终 teardown |
| `AppContext` | `AppRuntimeController` | creating 到 destroyed，immutable |
| verified Package pin | `AppRuntimeController` | creating 到全部 Surface 释放后 |
| App VM operation state | `AppRuntimeController` | app Module load 到 App VM destroy |
| Lifecycle control slot | `AppRuntimeController` | 单次 Host control accepted 到 Result queued |
| Module/init/hook correlations | `AppRuntimeController` | dispatch 到唯一 Result 或 teardown cancellation |
| Core RequestId allocator | AppRuntime identity | AppRuntime 生命周期内不复用 |

S04 拥有 Surface/PageContext/Navigation 状态；S03 只维护调度所需 correlation，不复制 Surface lifecycle。

## 4. 异步与失败

- Core Runtime Thread 是 AppRuntime 状态唯一写者；Port 回调只把 immutable Result 入队。
- Enqueue success 只表示已接收，不表示 Module、VM、Hook 或 Host 操作成功。
- JS/Platform Result 必须匹配 kind、RequestId、scope、SurfaceId、hook、sequence 和当前 operation epoch。
- Queue overflow/OOM 在接收前返回 `QUEUE_OVERFLOW`/`OUT_OF_MEMORY`；不得留下半个在途 operation。
- 非法状态转换返回 `ABI_INVALID_ARGUMENT`；control 并发返回 `LIFECYCLE_BUSY`；Module/VM/Platform typed error 原样进入对应失败 Result。
- destroy accepted 后拒绝新的 lifecycle/navigation/event/render/capability 工作；晚到结果不得复活资源。
- 清理失败不阻止逻辑 destroyed；错误被聚合进 Trace/内部 teardown report，不改 Host destroy 的 `completed(destroyed)` 语义。

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 确定性 | 相同输入与 Result 顺序产生相同状态、Hook sequence 和 Result。 |
| 内存 | Context/Module bytes 只读共享或转移；无跨线程可变共享；全部表有上限。 |
| 线程 | 不在 Core Runtime Thread 同步进入 JS 或等待 Platform；所有状态提交在单写者线程。 |
| 可测试 | Fake JS、Fake Surface lifecycle collaborator、Fake Host result sink 可驱动每个阶段和故障点。 |
| 可移植 | Core 文档和接口只使用公共消息、Port 与强类型 ID，不出现平台对象。 |
| 可观测 | 每个 accepted request 可由 AppRuntimeId/RequestId/SurfaceId/sequence 关联，热路径无文本 I/O。 |

## 6. 非目标

- 不定义 Surface lifecycle、Navigation 栈、Revision 或健康状态。
- 不创建 Runtime Tree，不做 Render/Layout/Mount/Event。
- 不实现 JS Engine、模块求值器、Hook 函数或 Platform 容器。
- 不实现 Provider/Capability 生命周期。
- 不增加通用 Bridge、私有 lifecycle message 或墙钟 watchdog。

## 7. 需求追踪

| 上级合同 | 本分 Spec |
|---|---|
| Application Lifecycle / Lifecycle Schema | R02-R12、R16-R17 |
| Artifact / Verified Module | R03-R06、R13-R16 |
| Runtime ABI / ID Contract | R07、R13-R15 |
| Error / Threading / Observation | R14-R18 |
| CORE-S01 / CORE-S02 | R01、R03-R06、R13、R18 |
