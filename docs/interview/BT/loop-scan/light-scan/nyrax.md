## 目录

1. [设计点收益(vs hap / 收益 / 代价 / 取舍)](#设计点收益)
2. [Map 作为载体的 runtime tree 遍历复杂度](#1-map作为载体的runtime-tree整个遍历的复杂度是多少-和-tree型的遍历复杂度呢)
3. [page.js 加载和执行](#pagejs加载和执行)
4. [block：动态节点 for/if](#block动态节点forif)
5. [组件定义注册表：$app_define$](#组件定义注册表app_define)
6. [对比 hap](#对比hap)
7. [注册表和 id 层归属](#注册表和id层归属)
8. [首帧渲染 first paint](#首帧渲染first-paint)
9. [update](#update)
10. [事件系统](#事件系统)
11. [flush](#flush)
12. [标脏](#标脏)
13. [bindingId](#bingdingid)
14. [lifeCycle](#lifecycle)

---

### 设计点收益
逐条按 **vs hap 不同 / 收益 / 代价 / 取舍** 分析。每条一个表格,不展开废话。

**1. 微内核 + 外围可扩展(contract 驱动)**

| | |
|---|---|
| vs hap | hap 是单体 framework,能力耦在一起;nyrax 稳定微内核 + 外围按 contract 插拔 |
| 收益 | 可裁剪(嵌入式砍到最小)、开闭、边界清晰、feature/组件粒度扩展 |
| 代价 | 定 contract 的设计成本;抽象层多一层;小项目显得过度设计 |
| 取舍 | 要多平台(尤其嵌入式要裁剪)才值;单平台单体更省事 |

**2. 平台无关 C++ Core + Adapter 多端**

| | |
|---|---|
| vs hap | hap 绑 Android(V8+Java);nyrax Core 零平台泄漏,Platform 接口接多端 |
| 收益 | 一套 Core 跑三端(Android/iOS/LVGL),核心逻辑只写一遍 |
| 代价 | 抽象 Platform 接口的成本;C++ 跨端编译/调试复杂;每新端要写 Adapter |
| 取舍 | 多端才摊得平成本;单端时 C++ Core 比直接用平台原生更重 |

**3. 边界协议驱动(消息,非直调)**

| | |
|---|---|
| vs hap | 本质同类(hap JS↔Native 也走消息);nyrax 把它贯彻到 Core↔平台也统一协议 |
| 收益 | 解耦、可预测、可组合、易扩展;两侧独立演进 |
| 代价 | 协议设计 + 序列化/打包开销;调试要跨协议追;比直调多一层 |
| 取舍 | 跨语言/跨进程边界必须这样;同进程纯 C++ 内部不必 |

**4. 单一权威 Runtime Tree(Core 独占,NodeID 驱动)**

| | |
|---|---|
| vs hap | hap 树在 JS(JS 对象);nyrax 树下沉 Core,map+NodeID |
| 收益 | JS 不持树省内存/GC;按 NodeID O(1) 定点更新,与树规模无关 |
| 代价 | **你自己标了 TODO:布局仍全量 O(N),增量布局未做**;树在 Core,JS 要调试树不直观 |
| 取舍 | 嵌入式内存敏感值得下沉;布局增量是已知欠债,要补 |

**5. 免 JSON 序列化 Bridge(External Func/Obj 直调)**

| | |
|---|---|
| vs hap | hap 老 bridge 走 JSON 序列化;nyrax external func 直调,传 JSValue 句柄 |
| 收益 | 省编解码 CPU + 临时对象/GC;可同步直调 |
| 代价 | 绑死具体引擎 API(QuickJS/V8 各写);引擎细节要框架封装;跨进程场景用不了(仅同进程) |
| 取舍 | 同进程嵌引擎时净赚;但牺牲了引擎可移植性(换引擎要重写桥) |

**6. 核心部件可替换(依赖倒置)**

| | |
|---|---|
| vs hap | hap 部件写死(V8、特定布局);nyrax JS引擎/布局/eventloop/Agent 依赖抽象接口 |
| 收益 | 换引擎/布局不动上层(嵌入式换 QuickJS、换轻量布局);可测试(mock) |
| 代价 | 每个抽象接口是成本;接口要设计得稳(定错了反而拖累);间接调用轻微开销 |
| 取舍 | 确实要换部件(多端不同引擎)才值;永远只用一套则是空抽象 |

**7. 运行时压力前置编译期(Page IR)**

| | |
|---|---|
| vs hap | hap 运行时 compile 建树 + 运行时收集依赖;nyrax 编译期固化结构+ID+依赖出 IR |
| 收益 | 运行时不建树/不全树 diff/不收集依赖,纯 ID 寻址增量更新,启动快、运行时轻 |
| 代价 | 编译期复杂度上移(toolkit 重);动态性受限(纯运行时动态结构不如 JS 灵活);IR 格式要维护 |
| 取舍 | 结构静态可分析时净赚(快应用模板正好静态);高度动态 UI 不适用 |

**8. 配套工具链(DSL → Page IR → RPK)**

| | |
|---|---|
| vs hap | hap 也有 toolkit;nyrax 把"运行时的活前置到编译"这件事落在 toolkit |
| 收益 | 编译期把结构/ID/依赖算死,运行时只消费;产物可校验 |
| 代价 | toolkit 成为关键路径,它的复杂度和正确性门槛高;编译慢一点 |
| 取舍 | 用编译期一次性成本,换运行时持续收益——运行次数远多于编译,划算 |

**贯穿全局的一句取舍总纲:**

nyrax 这套的共同模式是 **"用编译期/架构的前期成本,换运行时的性能和多端复用"**——

- **换来的**(收益):运行时轻(内存/CPU/GC)、多端一套 Core、可裁剪可替换、边界清晰。
- **付出的**(代价):编译期/抽象/contract 的设计复杂度、绑引擎的桥不可移植、动态性受限、布局增量等欠债。
- **什么时候值**:**多平台(尤其嵌入式弱设备)+ 结构静态可分析(快应用模板)** 这两个前提都成立时,净赚。反之(单平台、高度动态 UI、小项目),就是过度设计。

**和 hap 最本质的一句区别**:hap 是"**运行时解决一切**"(JS 建树/收依赖/diff,绑单平台);nyrax 是"**能前置到编译期的前置、能下沉到 C++ 的下沉、能抽象的抽象**",把运行时压到最薄——代价是复杂度前移和灵活性收窄,收益是弱设备上也能跑、且一套跑多端。

这里有一处要诚实点出:**第 4 条的布局全量 O(N) 是你自己标的 TODO,是真实欠债**——叙述时主动提它反而显成熟(知道边界在哪),别藏。

### 1. Map作为载体的runtime tree整个遍历的复杂度是多少 和 tree型的遍历复杂度呢

空间复杂度
时间复杂度
对比

- :全树遍历两者都是 O(N) 时间、O(N) 空间,一样。真正的差别在"按 id 随机定位单个节点"——map 是 O(1),纯 tree 是 O(N)。
- :按 id 定位单个节点
    - Map 完胜:直接哈希定位。纯 tree 没有 id→节点的索引,只能从根遍历找,最坏 O(N)。
    - 代价(map 多付的空间):
        - map 型比纯嵌套 tree 多一张哈希表(id→节点指针),多 O(N) 的索引开销(但常数,量级不变,还是 O(N))。用一点额外空间,换按 id 定位从 O(N) 降到 O(1)。 对"高频单点更新"的场景,这个交换极划算。

### pagejs加载和执行

### block：动态节点：for/if
- 具有局部diff
- id的运行时生成

### 组件定义注册表：$app_define$
- 和APP一个生命周期

### 对比hap
- hap 的 vdom tree 以 JS 对象形式活在 JS 侧——这正是 hap 和 nyrax 的核心分野。

### 跨层id系统：ID层归属
- nyrax 的 id → 实体映射表(谁建、何时建、查来干啥)

| id | 建在哪侧 / 何时 | 查来干啥 |
|---|---|---|
| bindingId → {deps, evaluate} | JS,实例化 | 求值 |
| stateKey → bindingId | JS(编译期算),实例化 | 标脏 |
| handlerId → 函数 | JS,实例化 | 执行 handler |
| callbackId → 回调 | JS,调用时 | 异步回传 |
| templateNodeId → NodeId | Core,首帧建树 | binding 定位节点 |
| NodeId → handlerId | Core,首帧建树 | 事件找 handler |
| NodeId → RuntimeNode | Core,首帧建树 | 改节点 |

> 本质:每个 id 对应一张"两侧各持一半、靠 id 对话"的表。
> JS 侧持"逻辑半"(求值/回调/handler 函数),Core 侧持"结构半"(节点/树)。
> 首帧 = 建这些表;update = 查这些表。


### 主链路：应用冷启动

理解,就按"技术动作本质"叙述——谁从哪读了什么到内存、交给谁执行、产出什么。

**一、应用加载(冷启动到首屏)**

```
1. 平台启动容器(Android Activity / iOS VC / 嵌入式 main),创建 Core
2. Core 初始化:建 JS 引擎(JS_NewRuntime+Context)、注册 external func、建 eventloop
3. 从磁盘读 rpk(zip)→ 解包到内存:拿到 manifest、app.js、各 page 的 page.js + Page IR
4. 读 manifest → 知道路由表(path→page)、入口页
5. 执行 app.js(JS_Eval)→ $app_define$ 注册 app 定义到注册表
6. 走"打开入口页"流程(就是下面的路由跳转)→ 首屏可见
```

**二、路由跳转(打开某个 path)**

```
1. 触发跳转(入口页 / router.push / 用户点击)→ 得到目标 path
2. 路由表查 path → 对应哪个 page(page.js + 它的 Page IR)
3. Core 从内存(rpk 已解包)取该 page 的 page.js → JS_Eval 执行
   → $app_define$ 把该页定义注册进注册表(若已注册则跳过)
4. 实例化 page VM:建 Proxy state、bindingMap、handlerId→函数 等表(JS 侧)
5. 首帧:JS 初始求值 + collectBlocks → 打包首帧事务 → external func 发给 Core
6. Core 按该页 Page IR 建 runtime tree、分配 NodeId、建各映射表
7. Yoga 布局 → Mount 下发平台 → 平台建真实 View → 新页可见
8. 页面栈 push 这个页(退栈时销毁其 VM + runtime tree)
```

**你那句话的精确版:**

磁盘读的是整个 **rpk**(一次解包到内存),不是每次跳转单独读一个 page.js 文件。跳转时是**从已解包的内存里取**该 page 的 page.js 字符串 → `JS_Eval`。首次冷启动才真正碰磁盘(读 rpk);后续路由跳转通常是内存里取(除非按需分包)。

**两条线的本质动作对比:**

| | 应用加载 | 路由跳转 |
|---|---|---|
| 读什么 | 磁盘读整个 rpk 解包进内存 | 内存里取目标 page 的 page.js + IR |
| 执行什么 | app.js(注册 app) | page.js(注册+实例化该页) |
| 产出 | 路由表就位 + 打开入口页 | 新页 runtime tree + View,push 栈 |

**一句话:** 应用加载 = 平台起容器建 Core → 磁盘读 rpk 解包进内存 → 执行 app.js 注册 → 打开入口页;路由跳转 = 路由表按 path 定位到 page → 从内存取该 page.js 让引擎 eval → 实例化 page VM → 首帧事务发 Core → Core 按该页 IR 建树布局下发 → 新页上屏并 push 栈。你的叙述对,精度补一点:磁盘只在冷启动读一次整包,跳转是从内存取 page.js。

- 首帧是同步直出,不走 microtask+flush。


### 主链路：路由页面跳转


### 首帧渲染（first paint）
- 首帧是同步直出,不走 microtask+flush。
- 区别在于:
首帧:实例化 page VM 时直接全量求值 + collectBlocks,当场打包首帧事务发 Core。要尽快上屏,没必要等 microtask。
```md
1. 取页面定义
2. 实例化 page VM:
   - 建 Proxy state
   - 建 bindingMap(bindingId → {deps, evaluate})          ← 建表
   - 建 stateKey→bindingId 映射(标脏用)                    ← 建表
   - 建 handlerId → 函数 映射                               ← 建表(漏了)
   - 建 callbackId2FuncMap(异步回调用)                     ← 建表(漏了)
3. 初始求值 + collectBlocks 算初始 block 实例
   - 每个 block 实例生成 blockInstanceId、其内 handler 生成 handlerId  ← 建 id
4. 打包首帧事务(含各 binding 初值、block 实例、每节点的 handlerId 绑定)
5. Core 按 IR 建 runtime tree、分配 NodeId
   - 建 templateNodeId → NodeId 映射                        ← 建表(漏了)
   - 建 NodeId → handlerId 绑定(节点上记它的事件)          ← 建表(漏了)
   - 建 bindingId → NodeId 定位能力(经 IR)
6. Yoga 布局 → Mount 下发 → 平台建 View
```
两问:

**1. 谁触发首帧?——Core 发起,JS 配合,不是 JS 自己知道。**

Core 是驱动方(它管路由/页面栈)。流程:**Core 决定要打开某页 → 让 JS 实例化该页 VM → Core 向 JS 拉取首帧数据(读 `__qak_initial_blocks__` 那个 getter,触发 JS 全量求值+collectBlocks)→ JS 把首帧事务同步返回给 Core。** 所以是 Core 拉、JS 给,JS 不需要"自觉我是首帧",是 Core 在首帧这个时机主动来取。

**2. IR 生成 runtime tree 在什么时候?——Core 拿到首帧数据后,在 Core 侧建。**

时机:**Core 收到 JS 的首帧事务(含各 binding 初值 + block 实例)时**,以 Page IR 为蓝图,实例化节点、分配 NodeId、建 `Map<NodeId,RuntimeNode>`——这就是 runtime tree 的诞生。IR 是蓝图(静态),runtime tree 是按蓝图+首帧数据建出的实例(运行时)。

顺序钉死:

```
Core 决定打开页
→ 让 JS 实例化 page VM(JS 侧建 state/bindingMap 等)
→ Core 拉首帧:读 __qak_initial_blocks__ → JS 全量求值 → 同步返回首帧事务
→ Core 收到 → 按 Page IR 建 runtime tree(分配 NodeId)   ← runtime tree 此刻生成
→ Yoga 布局 → Mount 下发 → 平台建 View → 首屏
```

一句话:**首帧由 Core 发起(Core 管路由,主动让 JS 实例化并拉取首帧数据,JS 不自判首帧);runtime tree 在 Core 收到 JS 首帧事务后、以 Page IR 为蓝图当场建出(分配 NodeId),IR 是静态蓝图、runtime tree 是按蓝图+首帧值建的运行时实例。**

### Page IR
- 页面静态骨架
- json
源码:

```html
<div>
  <text>{{count}}</text>
  <text onclick="add">+1</text>
</div>
```

Page IR(JSON,五脏俱全:nodes/bindings/blocks/handlers 都有):

```json
{
  "templateId": "page:/home",
  "rootTemplateNodeId": 1,
  "nodes": [
    { "templateNodeId": 1, "type": "div",  "children": [2, 3] },
    { "templateNodeId": 2, "type": "text", "children": [] },
    { "templateNodeId": 3, "type": "text", "props": { "text": "+1" }, "children": [] }
  ],
  "bindings": [
    { "templateBindingId": 1, "targetTemplateNodeId": 2, "prop": "text" }
  ],
  "handlers": [
    { "templateHandlerId": 1, "templateNodeId": 3, "eventType": "click" }
  ],
  "blocks": []
}
```

逐块对应(这就是"五脏"):

- **nodes**:静态结构树。节点 1 是 div,子节点 [2,3];父子用 **templateNodeId 引用**,不嵌套。
- **bindings**:binding 1 绑在节点 2 的 text 属性上(`{{count}}` 落点)。注意**只有落点,没有 evaluate/deps**——那俩是代码,在 page.js 里。
- **handlers**:handler 1 绑在节点 3 的 click 事件(`onclick="add"`)。
- **blocks**:空,因为这页没 if/for。有的话这里放 `{templateBlockId, kind, parentTemplateNodeId}`。

配套 page.js(IR 里没有的"逻辑半",在这):

```js
$app_define$("page:/home", {
  data: { count: 0 },
  methods: { add() { this.count++ } },        // handler 1 → 这个函数
  bindings: {
    1: { deps: ["count"], evaluate() { return this.count } }  // binding 1 的求值
  }
});
```

**两半对上:**

| | Page IR(JSON,结构) | page.js(代码,逻辑) |
|---|---|---|
| binding 1 | 落在节点2.text | deps=[count]、evaluate |
| handler 1 | 节点3.click | add() 函数 |

Core 读 IR 建 runtime tree(节点1/2/3 分配 NodeId),JS 执行 page.js 建 state/求值/方法。binding 1 带着值、handler 1 带着事件,靠 id 两侧对上。

一句话:IR 是 JSON,装 nodes(结构)+bindings(落点)+handlers(事件落点)+blocks(动态节点),全是静态结构;求值函数和方法在 page.js。两者靠 templateBindingId/templateHandlerId 对上——这就是五脏俱全的最小 IR。

### block：动态渲染节点



### 路由管理
- 首次跳转这个页面的时候，才会加载对应的pagejs + IR
- 退栈销毁的是实例(pageVM + runtime tree),定义还在 map 里

### update
```md
1. 平台事件 → Core:命中哪个 NodeId
2. Core 查 NodeId → handlerId                               ← 查表(漏了)
3. Core 反调 JS 带 handlerId
4. JS 查 handlerId → 函数 → 执行 handler                    ← 查表(漏了)
5. handler 改 state → Proxy set:
   查 stateKey → bindingId → 标脏                           ← 查表
6. flush:bindingId 查 bindingMap → evaluate 求值;block reconcile
7. 发事务 → Core:bindingId 查 IR → templateNodeId → 查映射 → NodeId  ← 多次查表
8. 改 runtime tree props → Yoga → Mount 下发 → 平台更新
```

### js引擎
```cpp
JSRuntime* rt = JS_NewRuntime();          // 1. 建引擎
JSContext* ctx = JS_NewContext(rt);       // 2. 建上下文

// 3. 注册 external func:JS 调 $submit$ 直接进 C++(免序列化)
JSValue g = JS_GetGlobalObject(ctx);
JS_SetPropertyStr(ctx, g, "$submit$",
    JS_NewCFunction(ctx, submit, "$submit$", 1));

// 4. 跑 JS:改 state → 调 external func 把事务发给 Core
JS_Eval(ctx, "$submit$('updateBinding:1=2')", 25, "page.js", JS_EVAL_TYPE_GLOBAL);

```
- 依赖倒置：port定义：
    - 总结：这 top5 恰好对应引擎的五大职能:建上下文、执行代码、桥接 native、值与句柄互转、内存调度。
```md
1. 生命周期:  createContext / destroyContext
   —— 建/销毁 JS 执行上下文

2. 执行 JS:   evaluate(跑代码) / call(调 JS 函数)
   —— 引擎最核心:执行页面逻辑、反调 handler

3. external func 绑定:  bindNativeFunction / unbindNativeFunction
   —— 把 C++ 函数注册成 JS 可调(免序列化桥的根);NativeFunctionSpec 描述

4. 值互转/句柄管理:  fromRuntimeValue / toRuntimeValue / retain
   —— C++ 值 ↔ JSValue 句柄互转,retain 管引用计数(防 GC)

5. 内存/GC:  requestGarbageCollection / snapshotMemory / drainMicrotasks
   —— 主动 GC、内存快照(可观测)、冲刷 microtask
```
- 接口的载体：
```cpp
class JsEnginePort {
public:
  virtual ~JsEnginePort() = default;                      // 虚析构(关键)
  virtual EngineResult<JsContextRef> createContext() noexcept = 0;  // = 0 纯虚
  virtual EngineResult<JsValueRef> evaluate(...) noexcept = 0;
  // ...全是 = 0
};

// —— 实现 B:V8(换引擎只加一个实现,Core 不改) ——
class V8Port final : public JsEnginePort {
public:
  void createContext() override { puts("[V8] 建 context"); }
  std::string evaluate(const std::string& code) override {
    return "[V8] 执行: " + code;
  }
};
```
- 用的是纯虚函数(abstract class)。C++ 没有 interface 关键字,"接口"就是用纯虚函数的抽象类模拟的——两者在 C++ 里是一回事。


### 事件系统
handlerId:产生 + 映射维护在哪

- 产生:编译期分配 templateHandlerId(静态,IR 的 handlers 表里)。运行时实例化时,拼成实例级 handlerId(前面源码坐实:"hdl:" + surfaceId + "-" + templateHandlerId + "-" + blockInstanceId)——因为 for 里同一个 handler 会有多份实例,得带实例身份。
- 映射维护:两侧各一张(又是 id 对话):
    - JS 侧:handlerId → 实际 handler 函数(或 → page VM 上的方法名)。JS 持有真正的函数。
    - Core 侧:NodeId → 该节点的 handlerId(节点绑了哪个事件处理)。Core 知道哪个节点对应哪个 handlerId,但不知道函数本身。
- 闭环:事件发生 → Core 按命中 NodeId 查到 handlerId → 反调 JS 带 handlerId → JS 查 handlerId→函数 执行。
- 事件表两侧:JS Map<handlerId, handler函数>、Core Map<NodeId, handlerId>4325

### flush
```js
// dirtyBindingIdSet: Set<BindingId>   —— 脏集合
// bindingMap:        Map<BindingId, Binding>  —— binding 表
// operationQueue:    Operation[]      —— 待发操作队列

function flush() {
  scheduled = false;  // 允许下一轮tick注册flush到microTask
  const operationQueue = [];
  for (const bindingId of dirtyBindingIdSet) {
    const binding = bindingMap.get(bindingId);
    operationQueue.push({
      kind: "updateBinding",
      bindingId,
      value: binding.evaluate(state),   // 求值
    });
  }
  dirtyBindingIdSet.clear();

  submitRenderTransaction(operationQueue);  // 一批发给 Core
}
```
- flush是在proxy的set中注册的
```js
set(...) {
  ...标脏(往 dirtyBindingIdSet 加)...
  if (!scheduled) {        // ← 关键守卫,避免注册多个flush
    scheduled = true; // flush已经注册进微任务了，该tick内只需要更新dirtySet即可
    Promise.resolve().then(flush);   // 只有这里注册
  }
}

```
- flush 固定来消费 dirtySet 吗?——是,flush 是唯一的消费者。 职责固定:遍历 dirtySet → 逐个 evaluate 求值 → 打包成事务 → 发 Core → dirty.clear() 清空。消费完就清空,dirtySet 回到空。
- 多次标脏、一次消费:一轮同步代码里改 N 次 state,往 dirtySet 加 N 批 bindingId(自动去重,Set),但 flush 只在 microtask 跑一次,一次性消费整个 dirtySet。
clear 是关键:flush 消费完 dirty.clear(),dirtySet 空了;scheduled=false 复位。


### 标脏
- 标脏的本质:dirtySet 里只加 bindingId,

### js侧的任务队列：microTask queue
- JS 侧没有"渲染任务队列"这种实体,就是 microtask queue。
 
### bingdingId 
- bindingId 背后没有单一实体——它是一个"绑定关系"的编号,两侧各拿它查一张表,查出的东西不同。JS 侧查"怎么算值",C++ 侧查"改哪个节点的哪个属性"。它是缝合两侧的钥匙,不是某个对象。

- 一个 bindingId,两侧各查各的:
    - JS 侧(page.js 的 bindings map)
    - bindingId → { deps, evaluate }
    - 数据结构:JS 侧的 bindings 对象/map。
    - 查什么:这个 binding 依赖哪些 state(deps)、怎么求值(evaluate)。
    - 用途:state 变标脏后,拿 bindingId 查出 evaluate,跑出新值。

- C++ 侧(IR → runtime tree 两跳)
    - bindingId → (查 IR) templateNodeId + propName → (查映射) 真实 NodeId

```
          bindingId(同一个编号,两侧共用)
         /                              \
JS 侧半截                          C++ 侧半截
{deps, evaluate}                  {templateNodeId, prop}
"值怎么算"                          "改哪里"
```
JS 只有"值怎么算"那半截(有逻辑、不知道节点)。
C++ 只有"改哪里"那半截(有结构、不知道怎么算)。
bindingId 是把两半对上的编号——JS 算完值,带着 bindingId 发事务;C++ 拿同一个 bindingId 查到落点,把值写进去。

- 注释1: evaluate 是一个函数
// 模板 {{count}} 编译成:
evaluate: function() { return this.count }
// 模板 {{count + " - " + name}} 编译成:
evaluate: function() { return this.count + " - " + this.name }


### lifeCycle
**page.js 执行时把 onInit/onShow 等钩子函数挂在 page VM 实例上(JS 侧,按钩子名索引,本质就是一张 map);Core 管生命周期时机,到点经 external func 反调 JS,按钩子名取出函数执行。** 注册在 JS 侧、时机由 Core 定、靠钩子名对上。
