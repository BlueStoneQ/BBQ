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

### RPK 里有什么？
不压缩 zip，7 类：runtime.json（装载清单+契约版本+各文件 sha256 校验）、manifest.json（身份/路由/能力声明）、app.js（应用入口）、pages/*.js（各页 JS 逻辑）、*.ir.json（Page IR 静态模板树）、assets/（资源）、source-maps（调试）。核心分工：JS bundle 喂 QuickJS，Page IR 喂 Core 建树。同页拆两份产物：index.js（逻辑）+ index.ir.json（结构）。

### 公共依赖怎么处理？
toolkit 构建模块依赖图，ModuleNode.kind = app/page/shared，共享模块登记进 runtime.json 的 sharedModules（带 sha256）。非 vendor.js 单包，而是按模块粒度、依赖驱动按需加载（$app_require$）、加载一次共享——为嵌入式省首屏内存。

### Page IR 只在初次建树时用吗？ID 记在哪？
不是，全程驻留、update 时反复查。IR 记模板级静态 ID（templateNodeId / templateBindingId / templateHandlerId）+ 动态锚点（if/for/block）；Runtime Tree 记运行时实例 ID（NodeId / OwnerInstanceId）。update：JS 只报 {OwnerInstanceId + templateBindingId} → Core 查 IR 翻译成 Runtime Tree 的 NodeId → 改节点。IR = 逻辑 ID→物理节点 的字典。

### 模块系统本质？
一切皆模块、按 ID 声明依赖、require 触发按需解析加载——一套统一模块图把「页面代码 / 共享代码 / 系统能力(feature)」归一成同构可寻址单元。require("@app-module/system.router") 即按 ID 触发 feature 加载。

### 多页面依赖同一模块会重复加载吗？
不会。shared 模块 cacheScope=kAppRuntime（应用级缓存），加载一次全应用共享，PackageLoader 用 in_flight 去重，命中缓存不重复加载/执行。

### 为什么公共依赖不用 vendor.js 单包？
嵌入式内存紧张，一次性提前加载全部公共代码=首屏内存峰值高。按模块粒度 + 依赖驱动按需加载 + 加载一次共享，更省内存、更契合可裁剪理念。针对嵌入式的取舍。

### IR 是文件，运行时频繁读硬盘吗？
不。IR 只读一次硬盘：parse_page_ir 把 JSON 解析成内存对象 VerifiedPageIr（map<id, 定义>）；运行时 find_binding/find_node 是内存 O(log n) 查表，不碰硬盘。PageIrCache 带 budget + pin(钉当前页) + LRU 淘汰管理内存。IR=磁盘序列化态，读一次驻留内存反复查。

### Page IR 和 page VM 的关系？
Page IR = C++ Core 持有的四张 map（静态模板定义，nodes/blocks/bindings/handlers）。page VM = JS 引擎内的执行作用域（页面 data、handler）。一个页面 = 一个 page VM + 一个 Page IR。

### Runtime NodeId 如何生成？JS 侧知道吗？
Runtime NodeId 由 C++ Core 的 NodeIdAllocator 生成（递增 uint64）。JS 侧不知道具体 Runtime NodeId，只操作编译期定的 templateNodeId/templateBindingId/ownerInstanceId。

### Runtime Tree 的结构例子？
```
// map<NodeId, RuntimeNode>
{
  1001: {id:1001, type:"div", parent:null, children:[1002,1003]},
  1002: {id:1002, type:"text", parent:1001, children:[], text:"hello"},
  1003: {id:1003, type:"view", parent:1001, children:[1004], style:{...}},
  1004: {id:1004, type:"image", parent:1003, children:[], src:"..."}
}
```

### 关键设计点：ID 映射机制？
templateNodeId (IR) → RuntimeNodeId（运行时）
templateBindingId → Runtime NodeId + property（通过 IR 反解）

### 关键设计点：block 实例化？
if block：条件满足时 instantiate，否则跳过
for block：循环数据 instantiate N 次（ownerInstanceId + index 组合标识）

### 动态节点根源 ID 是什么？
block instantiation 时，Core 给每个实例分配 ownerInstanceId + index 组合标识，作为该实例子树内节点的"家族 ID"前缀。

### binding 本质？
编译期在「模板节点的某属性」上钉的稳定 ID 锚点，解耦连接「JS 动态值」与「树上某节点某属性」。JS 只报 bindingId+新值 → Core 靠 IR 反解到具体节点属性改树 → JS 不碰树、Core 不跑 JS。TemplateBindingDefinition={id, target_node_id, property}。

### 依赖共享方案本质？
自定义 require feature，运行时执行到 require，Core 按需加载对应的细粒度依赖 JS。

### 多页面依赖同一模块会重复加载吗？
不会。模块缓存用 map（moduleId 为 key）记录，命中缓存不重复加载/执行；连确定性失败也缓存，避免反复重试坏模块。

### Runtime Tree 和 Page IR 是一个东西吗？
不是。Page IR = 编译期静态模板定义（只读）；Runtime Tree = 运行时实例化的活树（可变）。一个页面一棵 Runtime Tree（一个 surface 一棵）。

### binding 本质？
记映射关系，核心结构 map，本质是 state → 某 node 的某个 property。
（编译期 toolkit 给每个 {{...}} 分配 templateBindingId，记它绑到哪个 target_node_id 的哪个 property，存进 IR；运行时 JS 只喊"binding 3 = 6"，Core 用 binding 3 查 IR 反解到 node X 的 text 属性改树。JS 不碰树、Core 不跑 JS。）

### IR 内存态的数据结构？会内存爆炸吗？
公式：IR 内存态 = 四张 std::map（nodes/blocks/bindings/handlers），key=模板ID(uint64)，value=定义。
- nodes：静态节点定义（type/props/style/children），页面模板骨架。
- blocks：动态结构锚点（if 条件 / for 列表），表达"可能出现/重复/消失"的子树。
- bindings：动态数据锚点（state→某 node 某 property 的映射）。
- handlers：事件锚点（某 node 的某事件→哪个 JS handler）。
不会爆炸：IR 是编译期定死的静态模板，运行时只读不增长，元素数恒定（几十~几百），查找 O(log n)。

### 一页一个 JS 引擎实例吗？pageVM 是什么？
不是。引擎只有一个（QuickJS runtime/context 共享），页面各自是引擎内的 VM：app 一个 VM + 每页一个 page VM，入栈不销毁引擎。
pageVM 本质 = QuickJS 引擎里承载单个页面状态与逻辑的 JS 执行作用域。核心能力：①持页面状态 data ②执行事件 handler ③求值 binding ④承载页面生命周期钩子。

### 页面入栈后上一页还在内存吗？
在。push 进栈时上一页 surface 未 close，其 page VM + Runtime Tree 都保留在内存（返回可秒回、状态还在）；只有弹栈 close 才 closeSurface 释放。标准页面栈保活。

### 远程 list 渲染，IR 不是要增长吗？
不增长的是 IR，增长的是 Runtime Tree。for 列表编译成一个 block（模板），IR 里只存"列表项长什么样"的模板一份、恒定；运行时来 N 条数据，Core 用该 block 模板实例化出 N 个节点挂到 Runtime Tree。IR=模具（一份不变），Runtime Tree=冲出来的 N 个实例（随数据增长，受 RuntimeTreeLimits 上限管控）。

### pageVM 究竟是 JS 还是 C++？
pageVM 本身是"JS 侧的东西"，但它是被 C++ 创建和持有的 JS 对象。
- 实体是 JS：pageVM 就是 QuickJS 引擎里的一个 JS 对象（页面的 {data, onCreate, handlers...}），里面跑页面的 JS 代码。
- 持有它的是 C++：VmLifecycleService（C++）负责创建、保管、销毁它——代码里 appVm_ 和 pages_ 存的是 JsValueRef（C++ 拿着的指向 JS 对象的句柄）。
一句话：pageVM 是 JS 对象，句柄攥在 C++ 手里。C++ 管生命周期，JS 引擎管内部代码执行。这正是 Nyrax 的分工——C++ 管控制流和生命周期，JS 管业务逻辑。

### JS 侧够薄吗？（核心设计要求：尽量下沉到 C++）
结论：JS 侧非常薄，"下沉 C++"的设计要求达到了。
底层原理：其实就是require这些都是由cpp在core实现的feature，js中只是引擎注入的external
func，js中不做定义

证据：
1. quickapp-runtime-js 整个仓库是 C++（16 个 .cpp），几乎没有独立的 JS runtime 代码。它不是"一坨 JS framework"，而是 JS 引擎的 C++ 集成层——VM 生命周期、module loader、ABI、binding stage、handler registry，全是 C++ 在管。
2. static_facade_catalog 这个名字说明关键问题：JS 侧用到的 framework 能力（如 $app_define$/$app_require$、system.*）是 C++ 提供的 facade，不是用一大坨 JS 实现的。JS 只是调用 C++ 暴露的原语。

那"跑在引擎里的 JS"到底剩什么？只剩两块，都很薄：
- 应用自己的代码（app.js / page.js，用户写的业务逻辑）——本来就该在 JS。
- 极少量胶水（module define/require 的包装、binding evaluator 函数）。

对比业界，薄在哪：
- RN：有一个庞大的 JS framework 层（React reconciler + 大量 JS 运行时逻辑跑在引擎里）。
- 小程序：逻辑层有完整 JS 框架运行时。
- Nyrax：framework 逻辑基本下沉到 C++，JS 侧只留"业务代码 + 薄胶水"。响应式（Proxy 状态劫持）、事务打包、binding 求值调度这些，是 C++ 主导。

诚实边界：有一块必然留在 JS、下沉不了——用户业务逻辑的求值（handler 里的 this.count++、binding 表达式的计算）。因为那是用户写的 JS，只能在 JS 引擎跑。能下沉的是框架机制，不能下沉的是用户逻辑。

### IR 加载：是 Page IR 不是 page VM
澄清：四张 map 在 Page IR 里，不在 page VM 里。

Page IR：编译期模板定义（nodes/blocks/bindings/handlers），一个页面一份，C++ Core 持有
page VM：JS 执行作用域，持有页面 data、执行 handler
所以：一个页面 = 一个 page VM（JS 侧）+ 一个 Page IR（C++ 侧）