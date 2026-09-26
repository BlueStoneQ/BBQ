## ID驱动
- **静态 id**（编译期，toolkit 产生，恒定）：模板身份，所有屏共享。
- **动态 id**（运行时产生，每屏/每实例一个）：由 surfaceId 拼出来的实例身份。

- ID获取映射信息的方式：
    - 从id自身解析信息
    - 从map中查找信息

- id周转：
    什么时候用哪种（这是本质）：
    - 信息是结构化坐标（哪屏+哪模板+哪实例）→ 拼进 id、解析取。省表。
    信息是一个实体/值（页面对象、节点、方法名、闭包）→ 放 map、查表取。因为实体塞不进字符串。
    所以整套 id 驱动就靠这两招周转：能编码进 id 的就解析、编码不进的就查表。前者省内存省查找，后者是不得不存的映射。id 是贯穿始终的"钥匙",要么钥匙自己刻着信息(解析),要么拿钥匙去开对应的柜子(查表)。
    - 一句收束：对——id 驱动获取信息就两种:从 id 自身解析(信息编码在 id 里,如 handlerId 拆出 surfaceId,省表)、拿 id 查 map(信息是实体/值,如 NodeId→节点、handlerId→方法名)。判断用哪种:结构化坐标能拼进 id 就解析,实体/值塞不进就查表。整套 id 驱动就靠这两招周转。

参考： `commom/id-driven.md`：

**1. 几类 id、定位什么、怎么产生、根源：**

| id | 静/动 | 定位什么 | 怎么产生 / 根源 |
|---|---|---|---|
| **templateNodeId** | 静态 | 模板里第几个节点 | toolkit 编译期分配（Page IR）|
| **templateBindingId** | 静态 | 第几个 `{{}}` 绑定点 | 编译期分配 |
| **templateBlockId** | 静态 | 第几个 if/for | 编译期分配 |
| **templateHandlerId** | 静态 | 第几个事件点 | 编译期分配 |
| **surfaceId** | 动态 | 哪一屏（实例根）| 运行时 Core 打开 surface 时分配（`srf:1`）|
| **NodeId** | 动态 | runtime tree 里哪个实例节点 | Core 建树时分配；身份 = owner + '#' + templateNodeId |
| **blockInstanceId** | 动态 | if/for 展开的哪个实例 | JS 运行时拼：surfaceId + templateBlockId + key |
| **handlerId** | 动态 | 哪个实例的哪个事件 | JS 运行时拼：surfaceId + templateHandlerId + 实例 |

**根源一句**：静态 id 全出自 **toolkit 编译期**（模板身份）；动态 id 全**派生自 surfaceId**（运行时实例身份 = surfaceId + 静态 id 拼出来）。**所以根源是两个:编译期的 template\* + 运行时的 surfaceId,后者拼前者得到实例 id。**

**2. 你的命名（静态/动态）完全对**，而且点出了本质：
- **静态 id = "哪一种"**（哪种节点/绑定/块，模板层，编译定死）。
- **动态 id = "哪一个"**（这一屏、这个实例，运行时定）。
- **动态 id 几乎都是 "surfaceId + 静态 id (+ key)" 拼的**——即"在哪一屏 + 模板里的哪个 = 具体哪个实例"。

**3. 用户点按钮→数字变→寻址全链路（用什么 id、在什么层找什么）：**

```
① 平台层：用户点 Button 的真实 View
   → 该 View 持有 handlerId（动态，建 mount 时带下来的）
   → 事件回传 Core，带 handlerId + surfaceId

② Core 层：拿 handlerId 找到"该调 JS 哪个 handler"
   → 经 bridge 通知 JS：surfaceId + handlerId

③ JS 层：按 handlerId 找到 page VM 上的处理方法（如 onAdd）
   → 执行 onAdd：this.count += 1   ← 改了 state

④ JS 层：Proxy 拦截 count 写
   → 按编译期 deps 反查：哪些 bindingId 依赖 "count"
   → 命中 templateBindingId=2（静态 id）→ 标脏
   → microtask flush：跑 binding 2 的 evaluate 得新值 "1"
   → 打成 updateBinding 操作：{ ownerInstanceId(动态), templateBindingId:2(静态), value:"1" }
   → submitRenderTransaction 给 Core

⑤ Core 层：按 ownerInstanceId + templateBindingId 定位 runtime tree 里的目标节点属性
   → 生成 SetHostProp{ NodeId(动态), ... }

⑥ 平台层：按 NodeId 找到真实 View → 更新文字为 "1"
```

**这条链用了哪些 id、在哪层找什么，收束：**
- **上行（事件）**：`handlerId`（动态）—— 平台 View → Core → JS 找 handler。
- **改状态后定位绑定**：`templateBindingId`（静态）—— JS 侧靠编译期 deps 反查命中，标脏、求值。
- **下行（更新）**：`NodeId`（动态）—— Core 按 ownerInstanceId+templateBindingId 定位到 runtime tree 节点 → 发 SetHostProp(NodeId) → 平台按 NodeId 找 View 改。

**一个关键洞察**：整条链**没有一次遍历树**——上行 handlerId 查表、JS 侧 deps 反查(小表)、下行 NodeId 直接定位 runtime tree 节点(map)、平台 NodeId 找 View(map)。**全是 id → 直接定位,O(1) 级,不 DFS 树**。这就是"ID 驱动、局部更新、与树规模无关"在这条链上的体现。

一句收束：**id 分静态(编译期 template\*:node/binding/block/handler,定位"哪种")和动态(运行时:surfaceId 及其派生的 NodeId/blockInstanceId/handlerId,定位"哪个实例")。根源两个:toolkit 编译期 + 运行时 surfaceId,动态 id = surfaceId 拼静态 id。点按钮→数字变的链路:handlerId(动态)上行找 handler → 改 state → templateBindingId(静态)经 deps 反查标脏求值 → NodeId(动态)下行定位 runtime tree 节点发 SetHostProp → 平台按 NodeId 改 View。全程 id 直接定位、无树遍历。**


---

## 对比Hap之类的：编译前置收益 🔥
- 省依赖收集是**一半**，不是全部。编译期前置这一步，省掉的是**两样运行时的活**：

- **1. 依赖收集（你说的这半）**
    - hap 运行时靠 Watcher 跑 getter 现场收集依赖（读到哪个字段就订阅哪个）。编译期前置后，"谁依赖谁"编译期就静态算死写进 Page IR 的 deps——运行时不收集，直接查表。**这半对。**

- **2. 建树 / compile（另一半，而且更重）**
    - hap 运行时还要递归 compile 那棵模板 JSON、逐节点建真实节点、给每个动态点 new Watcher。编译期前置后，**结构和稳定 ID 编译期就固化成 Page IR**，运行时不 compile 建新树、不 new 一堆 Watcher 对象，只按 ID 寻址增量更新。

- 所以准确说：**编译期前置省掉的 = 运行时的"建树 + 依赖收集"两件事**。依赖收集是其中较轻的一半，建树（连带 Watcher 对象的常驻）是更重的一半。

- 换个角度看它俩的关系：hap 运行时那趟"compile 建树 + 建 Watcher"本来是**捆在一起**的——建节点的同时给它挂 Watcher、Watcher 首次求值时收集依赖。编译期前置把这**整趟**都提前了：结构→Page IR、依赖→deps 表、ID→稳定分配。运行时只剩"拿 ID 找节点、按 deps 查脏、发增量事务"。

- 一句收束：**编译期前置省的不止依赖收集，是"运行时建树 + 依赖收集"整趟——依赖收集是轻的一半（deps 静态化），建树+Watcher 常驻是重的一半（结构/ID 固化成 Page IR）。运行时从"边建树边收集依赖"退化成"纯 ID 寻址增量",这才是它最核心的价值。**


## 可观测benchMark：编译前置收益：指标
下面是基于机制的量级推算，不是实测。 这种事在呈现时要标清"这是分析估算"，别当实测报数——瞎报数字是最容易被戳穿的。但估算的方法和衡量指标是实的,我给你。

- **收益该用什么指标衡量（4 个，从直接到间接）：**

1. **首帧时间（TTFF / 首屏耗时）** —— 最直接。省掉"运行时 compile 建树 + 建 Watcher"这趟，首帧应快。这是最该拿去测、也最有说服力的指标。
2. **内存（常驻对象数 / 峰值内存 PSS）** —— hap 每个动态绑定一个常驻 Watcher 对象 + Dep 订阅；nyrax 无 per-binding 常驻对象。**节点/绑定越多，差距越大。**
3. **单次更新延迟** —— 一次状态变更到产出指令的耗时。hap 要 Watcher 求值 + 可能触发局部重排；nyrax 查 deps + 求值。
4. **包体 / 启动 CPU** —— 编译期把活干了，运行时代码路径更短。

- **量级推算（讲清楚怎么算的，别只给数字）：**

    - 关键变量是**页面节点数 N + 动态绑定数 M**。

- **首帧**：hap 是 O(N) 建树 + O(M) 建 Watcher（每个 Watcher 首次求值还触发一次依赖收集）。nyrax 首帧也要建 runtime tree（O(N)），但**省掉 M 个 Watcher 对象的创建和首次收集**。所以首帧收益 ≈ 省掉的那部分，**M 越大越明显**。一个中等页面 M 几十到上百，收益量级大概在**首帧的 10%~30%** 这个带（强依赖页面复杂度，纯估算）。
- **内存**：这个最能拉开。一个 Watcher 对象（闭包 + dep 数组 + 旧值 + 回调 + 订阅关系）粗估几十到上百字节，M 个绑定就是 M×那个量。**在嵌入式（几百 KB RAM）这是致命指标**——手机上 M 个 Watcher 无所谓，ESP32 上可能直接决定"这页装不装得下"。所以内存收益在嵌入式上**不是百分比，是"能不能跑"的问题**。

- **所以我的建议（比报数字更重要）：**

- **不同场景分开讲收益**：手机上，收益是"首帧快一点、内存省一点"（锦上添花，10%~30% 量级）；**嵌入式上，收益是质变——省掉 M 个常驻 Watcher，是"能不能在几百 KB 上跑起来"的门槛问题**。后者才是这个设计真正的价值高地。
- **给可测的指标，不硬报数字**：呈现时说"这套设计的收益可用首帧时间、常驻内存、单次更新延迟衡量;在嵌入式内存受限场景收益最大——因为省掉了每个绑定一个常驻 Watcher 的开销"。**给指标 + 给量级依据 + 标清是估算**,比拍一个"快 3 倍"更可信、更抗深挖。

- 一句收束：**收益用首帧时间/常驻内存/更新延迟衡量,量级取决于节点数 N 和绑定数 M。手机上是 10%~30% 量级的锦上添花(估算);嵌入式上是质变——省掉 M 个常驻 Watcher,直接决定几百 KB 内存能不能跑得下。呈现时给指标和量级依据、标清估算,别硬报实测数字。**

把这个"衡量指标 + 分场景收益 + 嵌入式才是价值高地"整理成一小段

## benchMark度量方案
对，这正是 benchmark 该出的数据，而且**这个点用 benchmark 出数据的价值极高**——因为它把"我讲的架构优势"从**主张**变成**实证**。

为什么特别值得用 benchmark 兜底这块：

1. **它正好回答了刚才的痛点**——你问"收益多高、怎么衡量"，我只能给估算。benchmark 就是把估算变实测的那一步。有了它，你讲"编译期前置省掉运行时建树+依赖收集"时，后面能跟一句"实测 benchmark 显示 X"，**这是判断力 + 工程闭环的双重证明**。
2. **你本来就有 benchmark 基建**（大纲里 quickapp-benchmark、可观测/Benchmark 那栏）——不是要新造轮子，是让现成的 benchmark 覆盖到这个点。
3. **它能自证而非自夸**——架构呈现最忌"我觉得我快"。有 benchmark，就是"数据说它快"。

benchmark 该测的对照维度（对着刚才那几个指标）：

- **对照组**：编译期前置(nyrax) vs 运行时建树+Watcher(hap 那套) —— 同一个页面两种跑法比。
- **测**：首帧时间、常驻内存（尤其 Watcher 对象那块）、单次更新延迟。
- **扫参数**：按节点数 N / 绑定数 M 递增着测 —— **这样能画出"随规模增长，两条线怎么分开"的曲线**，比单点数字有力得多。
- **分平台**：手机 vs 嵌入式(ESP32) —— 手机看百分比，嵌入式看"内存墙"（M 大到某个点 hap 那套装不下，nyrax 还能跑）。**嵌入式那条曲线是杀手锏。**

但一个诚实提醒：**benchmark 出数据 ≠ 现在就有数据。** 现在讲的时候要分清——"我设计了 benchmark 来量化这块，指标是首帧/内存/更新延迟，按 N/M 扫描、分手机和嵌入式对照"是**你现在就能讲的（体现你有度量意识、有工程闭环）**；具体数字得真跑出来才有。**别把"计划测"说成"已测出 X"**。即使只有计划，"我用 benchmark 把架构收益量化"本身就是加分项——很多人只会讲设计,不会想到去度量它。

一句收束：**对,这块正是 benchmark 该出数据的地方,而且是把"架构主张"变"实测实证"的关键一步——测首帧/内存/更新延迟,按 N/M 扫描、分手机与嵌入式对照,嵌入式的"内存墙"曲线是杀手锏。现在能讲的是"我设计了度量方案"(体现工程闭环),数字要真跑才有,别把计划当已测。**