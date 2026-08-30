## tree定义
Page IR 静态模板tree = 有根有序语义树的归一化表
Runtime Tree          = C++ Core 唯一可变权威运行时树
Host Tree             = Platform 平台对象映射

## update渲染管线
State 修改
-> JS 标记 Dirty Binding/Block
-> Microtask 批量求值
-> RenderTransaction
-> Core 解析 Page IR 定位 Runtime Node
-> staged change + Layout/Measure
-> 原子提交 Runtime Tree
-> MountTransaction
-> Platform 更新 Host Tree

## 首次渲染管线
加载 RPK、Page IR 和 JS Bundle
-> 创建 App/Page VM
-> JS 求值初始 Binding/Block/Handler
-> InstantiateTemplate
-> Core 根据 Page IR 创建 Runtime Tree
-> Style/Layout/Measure
-> full MountTransaction
-> Platform 在隐藏 Surface 创建 Host Tree
-> Present Surface

## 框架
runtime 核心
├─ 状态中枢：Runtime Tree（唯一权威可变树，单一事实源，ID 寻址驱动）
├─ 通信底座：bridge（typed ABI + Transaction，贯穿所有子系统）
└─ 三条核心链路（都围绕 Tree、都走 bridge）：
   ├─ 渲染管线：怎么改这棵树（Render→Tree/Layout/Measure→Mount）
   ├─ 事件系统：外部输入怎么进来、怎么寻址到树上的节点、怎么回调 JS
   └─ 生命周期/导航：树/页面的创建、切换、销毁

## QA

## QA

### Runtime Tree 是什么数据结构？
一张 `std::map<NodeId, RuntimeNode>`，节点间用 NodeId 记父子关系形成树（ID 互指，非指针）。

### 用 ID 表会哈希碰撞吗？
不会，用的是 std::map（红黑树、有序、O(log n)），根本没用哈希。

### 节点表会内存爆炸吗？
不会，`RuntimeTreeLimits` 对节点数/子节点数/mutation 数设了上界，超限即返回 error，内存上界确定且可观测。

### 上限写死了，复杂应用怎么办？
上限是 `create()` 构造期可配参数（默认值非硬编码），复杂应用传大 limits 即可，且每页独立设置。

### 复杂应用节点太多撑不住？
工业级复杂页靠虚拟化（只渲染可视区）把节点数收敛为有界，虚拟化 + 显式上限是绝配，不冲突。

### 为什么用 ID 而不用指针串树？
ID 稳定、可跨边界传（JS/平台只认 ID）、增删不悬空——这是单一权威树和跨端寻址的根本前提。


### 增删为什么不悬空？
外部只持 ID 不持指针，删节点后 ID 变成"查不到"（find 返回 nullptr）而非悬空，引用即"现查不缓存"。

### Runtime Tree 是嵌套 JSON 那样的树吗？
**本质**：不是嵌套树，是扁平分散存储——所有节点平铺在一张 `map<NodeId, RuntimeNode>` 里，父子靠 ID 引用，逻辑成树、物理并列。

**例子**：
```
n1 → { parent:null, children:[n2,n3] }
n2 → { parent:n1,   children:[] }
n3 → { parent:n1,   children:[n4] }
```
（树的形状由 parent/children 字段拼出，节点本身互不嵌套）

**为什么 / 收益**：改任意节点 O(log n) 直达无需从根遍历；删/移动只改 ID 引用不搬内存；ID 稳定可跨边界传且不悬空。嵌套 JSON 适合传输序列化，扁平 map 适合频繁局部修改的运行时状态。

### Page IR 是什么？
页面静态模板的中间表示（`pages/*.ir.json`），Toolkit 编译 .ux 时把模板结构（节点树、样式、绑定点 TemplateBindingId、事件、if/for 块）归一化成一张 JSON 表，随 RPK 分发。只存编译期能定的静态骨架，不含运行时动态数据。

### Page IR 和 Runtime Tree 什么关系？
Page IR 是静态模板蓝图（编译期定、双方共享），Runtime Tree 是运行时按蓝图实例化出的权威树。类比 class 定义 之于 object 实例。

### Page IR 为什么关键？
它是「ID 寻址 + 免冗余传输」的基石：JS 提交渲染意图只发 OwnerInstanceId + TemplateBindingId（小 ID），不传完整节点；Core 用 Page IR 反解出节点类型/样式/结构再在 Runtime Tree 上实例化。通信量极小，对嵌入式带宽/内存尤其关键。

### Page IR 和虚拟 DOM 区别？
vdom 是运行时内存里构建的完整树、每次 diff 新旧树；Page IR 是编译期产物、静态、只描述模板骨架，运行时不 diff 整树，靠 ID 定位增量更新，更省、更适合嵌入式。
