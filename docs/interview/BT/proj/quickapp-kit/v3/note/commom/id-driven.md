# ID 驱动：ID 分域

第一性：整套渲染不靠对象引用协作，靠**稳定 ID**。ID 分两大族——
**编译期的 template\* 族**（模板身份，恒定，随 rpk 分发）和
**运行时的实例族**（每屏一份，由 surfaceId 拼出）。ID 是各层之间唯一的"共享语言"。

## 两大族的分界

- 模板域（编译期）：描述"这个页面长什么样"，一份，恒定。owner = toolkit。
- 实例域（运行时）：描述"当前这一屏的具体实例"，每开一屏一套。owner = Core / JS。
- 关键：一个模板可开多屏 → 模板 ID 恒定，实例 ID 每屏新分配。

## ID 分类表

| ID | 域 | 属于哪层 | owner | 创建者 | 创建时机 | 如何创建 |
|---|---|---|---|---|---|---|
| moduleId (`@quickapp-kit/page/...`) | 模板 | 打包/加载 | toolkit | toolkit | 编译期 | 模块路径规范化而来，写进 rpk |
| templateId (`page:/pages/Home`) | 模板 | Core / IR | toolkit | toolkit | 编译期 | 由页面路由生成，page 与 IR 共享，作为查 IR 的 key |
| templateNodeId (数字) | 模板 | Core / IR | toolkit | toolkit | 编译期 | Page IR 里给每个静态节点分配的稳定序号 |
| templateBindingId (数字) | 模板 | JS ↔ Core | toolkit | toolkit | 编译期 | 每个绑定点分配的稳定序号，bindings 表的 key |
| templateBlockId (数字) | 模板 | JS ↔ Core | toolkit | toolkit | 编译期 | 每个 if/for 动态块分配的稳定序号 |
| templateHandlerId (数字) | 模板 | JS ↔ Core | toolkit | toolkit | 编译期 | 每个事件处理点分配的稳定序号 |
| surfaceId (`srf:1`) | 实例 | Core | Core | Core | 运行时·打开一屏 | 打开 surface 时分配，一屏一个，实例族的根 |
| ownerInstanceId (`cmp:<surfaceId>`) | 实例 | JS ↔ Core | JS(VM) | JS framework | 运行时·建 VM | `"cmp:" + surfaceId`，标识"这批意图属于哪个组件实例" |
| blockInstanceId (`blk:<surfaceId>-<blockId>-<key>`) | 实例 | JS ↔ Core | JS(VM) | JS framework | 运行时·reconcile 动态块 | surfaceId + templateBlockId + 迭代 key 拼成；同 slot 复用，重建靠 generation 递增 |
| handlerId (`hdl:<surfaceId>-<hId>-<instId>`) | 实例 | JS ↔ Core | JS(VM) | JS framework | 运行时·实例化块/组件 | surfaceId + templateHandlerId + 实例 id 拼成 |
| NodeId | 实例 | Core | Core | Core(NodeIdAllocator) | 运行时·建 runtime tree | Core 建树时分配；逻辑身份 = ownerInstanceId + '#' + templateNodeId |
| transactionId (`txn:<surfaceId>-<seq>`) | 事务 | JS → Core | JS(VM) | JS framework | 运行时·flush 提交 | surfaceId + 自增序号，标识一批渲染意图 |
| requestId (`req:...`) | 因果 | 跨层 | Core | Core | 运行时·发起请求 | 用于把一次输入/请求与其引发的事务串成因果链 |

## 一句话记忆

- **template\* 恒定，owner=toolkit，编译期分配** —— 模板身份，所有屏共享。
- **实例族每屏新分配，由 surfaceId 拼出**，owner 在运行时（Core 分 surfaceId/NodeId，JS 拼 cmp/blk/hdl）。
- IR 只按 templateId / templateNodeId 查（模板域）；surfaceId 只在运行时标实例、给事务归属。两者不交叉。

## js侧id
id 编译期静态分配 → JS 传过去 → Core 拿 id 查 runtime tree（本质 map）→ 组合出 mountTransaction。
