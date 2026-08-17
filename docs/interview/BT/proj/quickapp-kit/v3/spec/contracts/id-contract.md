# ID Contract

## 目录

- [1. 结论](#1-结论)
- [2. 编译期与运行时 ID](#2-编译期与运行时-id)
- [3. LogicalNodeRef](#3-logicalnoderef)
- [4. HandlerId](#4-handlerid)
- [5. 协议编码](#5-协议编码)
- [6. Producer、作用域与释放](#6-producer作用域与释放)

## 1. 结论

编译期 ID 定位静态定义，运行时 ID 定位实例对象，协议字段只负责顺序和关联。

## 2. 编译期与运行时 ID

| ID | 产生层 | 作用 |
|---|---|---|
| `AppRuntimeId` | C++ | 一次 AppRuntime 实例 |
| `TemplateNodeId` | Toolkit | 静态模板节点 |
| `TemplateBindingId` | Toolkit | 静态 Binding 定义 |
| `TemplateBlockId` | Toolkit | 静态 Block 定义 |
| `TemplateHandlerId` | Toolkit | 静态事件定义 |
| `ComponentInstanceId` | JS | 组件实例 |
| `BlockInstanceId` | JS | 动态 Block 实例 |
| `HandlerId` | JS | 一次运行时 EventBinding 注册 |
| `SurfaceId` | C++ | 页面根树 |
| `NodeId` | C++ | Runtime Tree 节点 |

## 3. LogicalNodeRef

`OwnerInstanceId` 是联合身份：普通模板节点使用 `ComponentInstanceId`，动态 Block 内节点使用所在 `BlockInstanceId`。因此同一 `for` 模板的多个实例不会发生引用碰撞。

```text
Component node:
  LogicalNodeRef(ComponentInstanceId, TemplateNodeId)

Block-local node:
  LogicalNodeRef(BlockInstanceId, block-local TemplateNodeId)

LogicalNodeRef -> NodeId -> NativeHandle
```

嵌套 Block 中，最近一层 `BlockInstanceId` 成为块内节点和子 Block 的 Owner。`BlockInstanceId` 在同一 Surface 生命周期内唯一且不复用。

JS 不持有或接收 `NodeId`；Platform 不生成逻辑节点 ID。

JS 更新 Binding 或注册 Handler 时不构造目标 `LogicalNodeRef`，而是提交 `OwnerInstanceId + TemplateBindingId/TemplateHandlerId`；Core 使用 Page IR 解析目标。Core 发给 JS 的事件仍使用 `LogicalNodeRef` 表达 `target/currentTarget`。

## 4. HandlerId

`HandlerId` 是绑定级身份，不是 JS 函数身份。它在一个 Surface 生命周期内唯一且不复用；同一个 JS 函数绑定到两个节点或两个事件时必须生成两个 HandlerId。JS 可以让多个 HandlerId 指向同一函数对象，但 Core 中每个 HandlerId 只对应一个 `(NodeId, EventType)` EventBinding。

`UnregisterHandler(surfaceId, handlerId)` 只删除这一条 EventBinding。Block/Surface 递归销毁可以批量删除其拥有的多个 HandlerId，但不改变单个 HandlerId 的语义。

## 5. 协议编码

协议编码统一为：Toolkit 的 `Template*Id` 使用正整数；跨语言运行时 ID 使用带命名空间前缀的 opaque string，避免 JS 整数精度、类型碰撞和平台指针语义泄漏。

```text
app:   AppRuntimeId
srf:   SurfaceId
cmp:   ComponentInstanceId
blk:   BlockInstanceId
hdl:   HandlerId
node:  NodeId
txn:   TransactionId
mnt:   MountAttemptId
req:   RequestId
```

`OwnerInstanceId` 必须匹配 `^(cmp|blk):`，因此 Component 与 Block 即使由不同分配器产生也不会碰撞。

## 6. Producer、作用域与释放

| ID | 唯一 producer | 唯一作用域 | 复用规则 |
|---|---|---|---|
| AppRuntimeId | Core AppRuntimeFactory | 一个 Runtime Host 实例 | Runtime Host 生命周期内不复用 |
| RequestId | 发起请求或输入的一侧 | 一个 AppRuntime | AppRuntime 生命周期内全局唯一且不复用 |
| TransactionId | JS Render Client | 一个 Surface | Surface 生命周期内不复用 |
| MountAttemptId | Core MountCoordinator | 一个 Surface | Surface 生命周期内不复用；每次 rebuild 新建 |
| SurfaceId | Core SurfaceController | 一个 AppRuntime | AppRuntime 生命周期内不复用 |
| Component/Block/HandlerId | JS Framework | 一个 Surface | Surface 生命周期内不复用 |
| NodeId | Core RuntimeTreeStore | 一个 Surface | Surface 生命周期内不复用 |

各 producer 使用单调序列或等价不复用分配器。`AppRuntimeId` allocator 由 Core AppRuntimeFactory 持有，并晚于其创建的全部 AppRuntime 销毁；Runtime Host 只调用 Factory，不生成或传入 AppRuntime 身份。同一 AppRuntime 内的多个 RequestId producer 必须使用共享分配器或互斥命名分区，不能各自从相同局部序列直接生成 `req:` 值。opaque string 不允许编码平台指针。pending correlation 在唯一 Result 到达后删除；之后收到同 ID Result/Event 一律视为 late message 丢弃并记录，不重新创建状态。Surface 销毁后 Core 保留 SurfaceId tombstone 到 AppRuntime 销毁；AppRuntime teardown 必须先停止 Port 和清空队列，再释放 allocator/tombstone，因此不需要按时间猜测保留窗口。

V1 固定使用互斥 wire 命名分区，避免为分配 ID 增加一次同步跨语言调用：

| Producer | RequestId wire |
|---|---|
| C++ Core | `req:<positive-decimal>` |
| JS Framework | `req:j-<positive-decimal>` |
| Platform / Runtime Host | `req:p-<positive-decimal>` |

每个 producer 的序列随 AppRuntime 创建并只单调前进；接收方必须校验消息来源与命名分区一致。跨语言层不共享可变 allocator，Core 内部多个 producer 仍必须共享同一个 allocator。

JS Framework 的 `req:j-*` 分区在每个 AppRuntime 中只能有一个本地 allocator。它在 Framework bootstrap 时创建，只在 JS Executor 上运行，由 Navigation、Capability、Handler 等请求发起模块共享；它不是 C++ 服务，不通过 Native Function 暴露，也不归 Runtime ABI Client 所有。请求模块先从该 allocator 取得 ID，再把完整 typed message 交给 Runtime ABI Client。

Platform 输入是 `RequestId` 的事件用法：捕获输入的 Platform Adapter 生成一次，Core 路由和 JS Handler 原样消费；一次输入产生的目标与冒泡 Dispatch 共享该 ID。它只表示因果关联，不要求产生请求/结果终态。
