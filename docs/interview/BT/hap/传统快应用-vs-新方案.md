# 传统快应用 runtime vs 新方案（基于官方源码）

源码：`quickapp-kit-ai/source/upstream/`（hap-toolkit = 编译器，hapjs = 运行时）。
结论均有代码出处。

## 一个预设先纠正

常见预设："打包成一个立即执行函数，执行一遍树就出来。"
传统方案**不完全是**——它的树不是"跑一个 render 函数得到的 vdom"，而是下面这样。

## 1. 传统 IR（模板编译产物）是什么 —— 一棵 JSON 树，不是 render 函数

`.ux` 的 template 被 hap-compiler 编译成一个纯对象树（`jsonTemplate`）：
`{ type, attr, style, events, children:[...] }`。结构在编译期就固定成 JSON。
动态部分（`{{}}`、if、for）不编译成整体渲染函数，而是**编译成一个个小 getter 函数，挂在 JSON 树对应字段上**。

→ 传统"IR" = 静态 JSON 结构 + 内嵌的动态 getter 函数。
- 出处：`hap-compiler/src/template/index.js`（parse/traverse 产出 jsonTemplate）；`template/exp.js` 把 `{{}}` 编成函数；`template/model.js` 把函数塞进 attr/events。

## 2. 静态模板树怎么来、运行时树怎么出来 —— 运行时递归遍历 JSON，边遍历边建真实 native 节点

入口：Vm 构造时调 `build()` → `compile()` 递归下钻（component/for/if/原生组件），
走到原生组件就 `createElement` 建真实节点、挂到父节点、递归子节点。

→ 树不是"执行一次得到 vdom"，是**运行时把编译好的 JSON 递归实例化成一棵真实节点树**。没有 vdom 这一层。
- 出处：`hapjs/core/framework/src/dsls/xvm/vm/index.js`（build 触发）；`xvm/vm/compiler.js`（compile/compileNativeComponent）；`xvm/vm/dom.js`（createElement）。

## 3. 有没有 diff —— 没有。没有 vdom，没有新旧树 diff/patch

更新靠**细粒度 Watcher**：每个动态绑定挂一个 Watcher（Vue2 式 `Object.defineProperty` 收集依赖），
数据变了只调 `updateNodeProperties` 更新那一个属性，或对 if/for 定点增删节点。不重跑、不 diff。
- 出处：`xvm/vm/directive.js`（bindKey/updateNodeProperties）；`xvm/vm/dom.js`（只有真实节点增删改，无 patch）。
- 唯一带"新旧比较"味道的是 for 列表：`compiler.js` 的 bindFor 用 tid 做 key 复用/移除，属列表节点级复用，不是通用 vdom diff。

## 4. 响应式 —— Object.defineProperty（Vue2 式），不是 Proxy

getter 收依赖、setter notify、Watcher 批处理更新。
- 出处：`xvm/vm/observer.js`（defineReactive）；`xvm/vm/watcher.js`（XWatcher）。

## 5. 传统方案 vs 新方案 对比

| | 传统快应用 | 新方案 |
|---|---|---|
| 编译产物 | JSON 树 + 内嵌 getter 函数 | Page IR（静态树 + 稳定 id）|
| 树在哪建 | 运行时递归 compile JSON → 真实节点树 | 树的 owner 在 Core，JS 侧不建树 |
| 更新方式 | 细粒度 Watcher 定点更新 | 细粒度 id 事务定点更新 |
| 有无 vdom/diff | 无 | 无 |
| 响应式 | defineProperty | Proxy |
| 定位载体 | Watcher 直接持有节点引用 | 稳定 id（跨边界）|

### 本质对比（一句话）

传统和新方案**同源**——都编译期固定结构、都细粒度更新、都不做 vdom diff。真正差别在两点：

1. **建树的位置**：传统运行时还要"递归 compile JSON → 建真实节点树 + 给每个绑定建 Watcher"，这一趟是运行时开销。新方案把树的所有权收到 Core，JS 侧连树都不建，只发 id 事务 → 这趟运行时建树 + 依赖收集的开销被省掉/前置了。
2. **定位载体**：传统同进程，Watcher 直接抓节点引用；新方案跨边界，只能用稳定 id。

### 面试素材

> 传统快应用已经比 Vue/React 激进（编译期固定 JSON、无 vdom diff、细粒度 Watcher）；
> 我在它基础上再进一步——把树的所有权收到 C++ Core，JS 侧不建树、不做依赖收集的运行时对象，只发 id 事务。
> 省掉的正是传统方案运行时那趟 compile 建树 + 建 Watcher 的开销。


## 补正：传统的"几棵树"与 diff（上文"没有 diff"说糙了，这里精确化）

传统快应用确实有多棵树，但不是"新旧两棵拿来 diff"。三棵：

1. **jsonTemplate（编译期模板树）**：编译产物，静态结构 + 内嵌 getter。只读、不变。
2. **Vm 树（组件实例树）**：运行时每个页面/自定义组件是一个 Vm，父子 Vm 成树。管组件层级、作用域、生命周期。
3. **真实 native element 树**：compile 递归遍历 jsonTemplate 时用 createElement 建出的真实节点，最终渲染的那棵。

关键：**这三棵是同一份东西的不同阶段/视角，不是版本快照。** 模板树 → 实例化出 Vm 树和 element 树。更新时没有"再生成一棵新树跟老树比"这一步。

更新走细粒度 Watcher，不是树对比：
- 每个动态绑定在建树时挂一个 Watcher。
- 数据变 → 对应 Watcher 触发 → 只更新那一个属性 / 那一个节点。
- 不重新生成树，自然没有"新旧两棵树"可比。

唯一带"比较"味道的是 **for 列表**：bindFor 用 tid(key) 做列表项级复用/增删/移动（能复用就复用，多的删、少的补）。但这是单个列表节点内的 key 比对，不是通用树 diff/patch。React 那种"整棵新 vdom vs 整棵旧 vdom 逐节点比"，这里没有。

**结论**：传统快应用没有 vdom、没有全树 diff；有多棵树但那是同一份的不同阶段，不是新旧快照。更新靠细粒度 Watcher 定点改，for 列表有 key 级复用比对，仅此一处带"比较"且非通用 diff。

**和新方案一致点**：都靠细粒度定位避开 diff——传统靠 Watcher 直接持有节点引用，新方案靠稳定 id。React 才是"维护新旧两棵 vdom 做 diff"的代表，传统快应用和新方案都不是。


## Watcher vs id-map：内存孰优孰劣

**结论：id-map 更省内存，省的是"每个绑定的常驻对象"这块大头。**

对比各自为"一个动态绑定"常驻什么：

- **Watcher（传统）**：每个绑定点 = 一个常驻 Watcher 对象，装着 getter 闭包、依赖列表(dep)、旧值缓存、回调、节点引用；还被挂进它依赖的每个 dep 的订阅者列表（双向引用）。一页 N 个绑定 = N 个运行时堆对象，内存随绑定数线性膨胀。
- **id-map（新方案）**：绑定关系(id → 目标节点)是 Page IR 里的纯数据，编译期固定，Core 侧一张 map。无 per-binding 运行时对象、无闭包、无 dep 订阅列表。运行时只有一张 id 索引表。

| | Watcher | id-map |
|---|---|---|
| 每绑定常驻 | 一个 Watcher 对象(闭包+dep+旧值+回调+引用) | 无，只是 map 里一个 entry |
| 依赖关系 | 运行时双向订阅(dep↔watcher) | 编译期静态 deps 数组，纯数据 |
| 堆压力 | N 个绑定 = N 个堆对象 | 一张 map |
| 谁持有 | JS 堆 | Core（可预分配、定容）|

**为什么对嵌入式关键**：几百 KB RAM 的设备，N 个 Watcher 常驻堆对象扛不住。id-map 是纯数据 + 定容 map，可预分配、不动态膨胀，正好落在 owner-thread、固定容量那套约束里。Watcher 方案在嵌入式基本没法用，id-map 是被硬件逼出来的更省选择。

**id-map 的代价（不只讲好处）**：
- **粒度靠编译期定死**：Watcher 能运行时动态建立任意依赖；id-map 依赖关系编译期固定，运行时不能新增绑定。换了内存和确定性，牺牲动态性。
- **反查依赖遍历**：改一个 state 字段，要在 bindings 表里按 deps 反查命中哪些 id（虽然通常表小、可接受）。Watcher 是 setter 直接 notify 订阅者，反查这步它不用做。

---

## 补充：Core 收到 render intent 后的链路

一句话：**intent + IR → 建树 → 布局 → 出 mount 事务 → 下发平台**。

展开：收到 render intent → 结合 Page IR 在暂存区建/改 runtime tree（NodeId 寻址）→ 布局(Yoga)算出最终坐标 → build_full/incremental_mount 打成 MountTransaction → 发给平台 MountPort。

### 这里的 IR 是内存 IR，不是 .ir.json 文件

- `.ir.json`（包里的纯数据）在**更早的加载阶段**被 Core 读入、解析成常驻内存结构（VerifiedPageIr：nodes/bindings/blocks/handlers 几张表，建好 id 索引并 pin 住）。
- 收到 intent 时用的是**已在内存、解析好、按 id 建好索引的那份**，不临场读文件/解析 json。
- 一句话：建树用内存 IR（VerifiedPageIr），.ir.json 只是它的磁盘序列化形态，渲染热路径不碰文件。解析在加载期做完，热路径只做 id 寻址——呼应"运行时压力前置编译期"。
