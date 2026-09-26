## runtime tree
- runtime tree 就是一张 NodeId → 节点 的 map,节点里存 props/父子/布局

## nodeId
- Core 建树时给每个节点发个自增 NodeId 当门牌，全链路(tree/事务/平台)都拿这个门牌找节点。 动态、自增、Core 发。

## templateNodeId
- templateNodeId = 模板里第几个节点（哪种，编译期定）；NodeId = 运行时实例节点的门牌（哪个，运行时发）。一个是"类"，一个是"实例"。

- 举例：
    - 用 for 循环最好懂：模板里写一个列表项 <item>，templateNodeId 就一个（比如 5）。运行时 for 展开成 3 项 → 建 3 个真实节点 → 发 3 个 NodeId（node:1/2/3），它们的 templateNodeId 都是 5（都是同一种模板节点），但 NodeId 各不同（三个不同实例）。

    - 所以关系：一个 templateNodeId 可对应多个 NodeId（一个模板节点，实例化出多份）。

    - templateNodeId：编译期、静态、共享——"你是哪种节点"。
    - NodeId：运行时、动态、每实例一个——"你是这一屏的哪个具体节点"。

## runtime-node
runtime_tree.h

```cpp
struct RuntimeNode {
  // ── 身份 ──
  NodeId node_id;                     // 运行时门牌号（自增，全链路寻址主键，平台按它找 View）
  LogicalNodeRef logical_ref;         // 逻辑身份 = owner + '#' + templateNodeId
                                      //   （"这是哪个实例的哪种模板节点"，增量时靠它认亲复用）

  // ── 是什么 ──
  HostComponentType component;        // 组件类型：View / Text / Button / Image / Input…

  // ── 长什么样（可变状态）──
  HostValueMap props;                 // 属性表：如 text="hi"、src=...（业务属性）
  HostValueMap style;                 // 样式表：颜色/字号/flex/margin…（视觉+布局输入）

  // ── 结构（父子，用 NodeId 表达，不嵌套）──
  optional<NodeId> parent;            // 父节点的 NodeId（root 无父 → nullopt）
  std::vector<NodeId> children;       // 子节点的 NodeId 列表（有序，决定渲染/插入顺序）

  // ── 归属（动态块）──
  optional<BlockInstanceId> owning_block;  // 若这节点属于某个 if/for 展开的块实例，记它属于哪个块
                                           //   （静态节点为 nullopt；块内节点指向 blockInstanceId）

  // ── 布局结果 ──
  optional<LayoutRect> layout;        // Yoga 算出的最终坐标 {x,y,w,h}
                                      //   （布局前为 nullopt；算完填上，mount 时发 SetHostLayout）
};
```

按"信息种类"归一下，一个节点其实就存 5 类东西：

1. **身份**：`node_id`（门牌/寻址）+ `logical_ref`（逻辑认亲）
2. **是什么**：`component`（组件类型）
3. **长什么样**：`props` + `style`（可变状态，绑定更新改的就是这里）
4. **结构**：`parent` + `children`（用 NodeId 表达父子）
5. **布局/归属**：`layout`（Yoga 坐标）+ `owning_block`（属于哪个动态块）

一句话：**一个 RuntimeNode 存 5 类信息——身份(node_id 寻址 + logical_ref 认亲)、类型(component)、可变状态(props/style)、结构(parent/children 用 NodeId 表达)、布局与归属(layout 坐标 + owning_block 属于哪个 if/for 块)。它就是"当前这屏某个节点此刻的全部真相",绑定更新改 props/style、布局填 layout、结构靠 NodeId 连成树。**

## 动态节点block
就 for 和 if 两种动态节点。block 的处理我们在 create-reactive-page-vm.js 里吃透过（reconcileBlocks 那套），结合刚看的 RuntimeBlock 结构，一次讲清。

- for动态节点：
    - 要走diff，因为是纯动态节点
    - 是"key 级的列表 diff"，不是 vdom 那种"整棵新旧树逐节点比"。
    ```md
    对，for 的列表增删移是走 diff——**但要说准：是"key 级的列表 diff"，不是 vdom 那种"整棵新旧树逐节点比"。**

    区分清楚（这是关键，别混成 React 那种）：

    - **for 列表**：走 diff。reconcileBlocks 里拿"这次算出的实例集"和"上次的实例集"按 **key（slot = templateBlockId + key）** 比对 → 复用 key 相同的、删消失的、加新增的、位置变的发 move。**这是列表项级的 key diff（像 Vue/React 列表的 keyed diff）。**
    - **if**：谈不上 diff。就是"真→假删掉、假→真建出来"，一个开关，没有集合比对。
    - **block 内节点的属性变**：不走 diff，走 **binding 定点更新**（updateBinding，按 bindingId 直接改）。

    所以精确说 block 里的变化分两层，diff 只在其中一层：
    - **结构层（for 的项增删移）**：走 **key diff**（比对实例集）。
    - **内容层（节点属性变）**：走 **id 定点更新**，不 diff。

    而且这个 diff 范围**极小**——只在"一个 for 块的实例集合"内比，不是全树。全局仍是"无全树 diff"。**只有 for 这一个局部,为了列表复用,做 key 级集合比对。**

    一句收束：**for 的项增删移走 diff——但是"key 级列表 diff"(按 slot=templateBlockId+key 比对实例集,复用/删/加/move),范围只在单个 for 块内,不是 vdom 全树逐节点比。if 是开关不算 diff,节点属性变走 binding 定点更新不 diff。所以"走 diff"仅限 for 的列表结构那一小块,全局仍无全树 diff。**
    ```

**先说本质：block = "结构会变的那部分"的抽象。** 静态节点编译期就定死在 IR 里、恒在；block 是 if/for 这种**运行时才知道有几个、在不在**的动态部分，所以单独抽出来管。

**两种，就这两种：**
- **if**：0 或 1 个实例（条件真才有）。
- **for**：0~N 个实例（列表几项就几个）。

**处理链路（谁在哪做什么）：**

**JS 侧（reconcileBlocks，算增量）**：
- state 变（如 `items` 变）→ 按 deps 命中依赖它的 block → 重跑 block 的 evaluate（if 算真假、for 算列表）→ 得到"这次应该有哪些实例"。
- 和上次的实例集对比（靠 slot = templateBlockId + key）→ 产出最小操作：**instantiateBlock（新增）/ moveBlock（位置变）/ removeBlock（消失）**。
- for 的 `key` 决定实例复用——key 没变的复用同一实例，不重建。

**Core 侧（RuntimeBlock，落到 tree）**：
```cpp
struct RuntimeBlock {
  BlockInstanceId block_id;        // 这个块实例的动态 id
  TemplateBlockId template_block_id; // 哪种块（编译期 id）
  NodeId parent_node_id;           // 挂在哪个父节点下
  BlockKey key;                    // for 的每项 key（if 固定）
  NodeId root_node_id;             // 这个块实例展开出的子树根节点
};
```
Core 收到 instantiateBlock → 按模板建出块的子树节点（发 NodeId）、挂到 parent 下的正确位置；removeBlock → 删掉该块子树；moveBlock → 改位置。

**关键点（block 和普通节点的关系）：**
- block 不是"一个节点",是**"一段可增删的子树"的管理单位**。一个 for 项展开可能是好几个节点(一个子树),block 管的是"这整段的生死和位置"。
- 节点身上的 `owning_block` 字段就是记"我属于哪个块实例"——块被删时，连带删掉 owning_block 指向它的所有节点。
- **位置计算**：block 实例插在父节点的 children 里，要算 index（前面 collectBlocks 的 dynamicOffset——静态兄弟 + 动态块实例混排时算正确插入位）。

**为什么单独抽 block，不混进普通节点**（本质）：因为**静态节点是"编译期定死、恒在、纯增量改属性"，block 是"运行时增删、结构会变"**——两种生命周期完全不同。静态节点走"改 props"，block 走"整段增删移"。分开管，才能让"绝大多数静态结构编译期固化、只有 if/for 这一小撮动态部分运行时 reconcile"——**把动态性收敛到最小范围**，这正是"运行时压力前置编译期"的体现：能静态的都静态，动态的圈进 block。

一句收束：**动态节点就 for/if 两种,统一抽象成 block。JS 侧 reconcileBlocks:state 变→重算 block 的 evaluate→和上次实例集按 slot(templateBlockId+key) 对比→产出 instantiate/move/remove 最小操作(for 靠 key 复用)。Core 侧用 RuntimeBlock 管"一段子树的生死位置",节点靠 owning_block 记归属,块删则连带删其子树。抽 block 的本质:静态节点编译期固化只改属性、动态部分(if/for)才运行时增删——把动态性收敛到最小范围,是编译期前置的一环。**