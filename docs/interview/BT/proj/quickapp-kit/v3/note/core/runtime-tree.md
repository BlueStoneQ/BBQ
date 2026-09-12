# Runtime Tree 底层数据结构

## 目录
- [C++ Core 中的真实结构](#c-core-中的真实结构)
- [ID 种类与作用](#id-种类与作用)
- [Runtime Tree 是 JS 对象吗？](#runtime-tree-是-js-对象吗)
- [与 JS 的通信机制](#与-js-的通信机制)
- [数据结构本质](#数据结构本质)

## C++ Core 中的真实结构

### 1. **核心存储结构**
```cpp
// 基础存储：std::map<NodeId, RuntimeNode>
class RuntimeTree {
    std::map<NodeId, RuntimeNode> nodes_;  // 红黑树，有序，O(log n)
    
    // 其他辅助索引
    std::unordered_map<OwnerInstanceId, std::vector<NodeId>> block_instances_;
};
```

### 2. **RuntimeNode 内部结构**
```cpp
struct RuntimeNode {
    NodeId id;                 // uint64
    NodeId parent_id;          // uint64，0 表示无父节点
    std::vector<NodeId> child_ids; // 子节点 ID 列表
    
    // 节点内容
    std::string type;          // "div", "text", "image"
    std::map<std::string, Value> props;  // 属性
    Style style;              // 样式计算结果
    Layout layout;            // 布局结果
    
    // 状态标志
    uint32_t flags;           // 脏标记、可见性等
};
```

### 3. **关键特点**
- **扁平存储**：所有节点平铺在 `std::map` 中
- **ID 引用**：父子关系通过 `parent_id` 和 `child_ids` 引用实现
- **不嵌套**：节点本身不包含子节点对象，只包含 ID
- **稳定 ID**：删除节点不影响其他节点的 ID 引用

### 4. **为什么用 std::map 不用 unordered_map？**
- 需要有序遍历（深度优先/广度优先）
- 红黑树更稳定（哈希表可能rehash导致迭代器失效）
- 嵌入式环境下更可预测的内存使用

### 5. **示例：查找节点路径**
```cpp
// 从叶节点到根的查找
std::vector<NodeId> getPathToRoot(NodeId node_id) {
    std::vector<NodeId> path;
    while (node_id != 0) {
        path.push_back(node_id);
        auto it = nodes_.find(node_id);
        if (it == nodes_.end()) break;
        node_id = it->second.parent_id;
    }
    std::reverse(path.begin(), path.end());
    return path;
}
```

### 6. **增删节点示例**
```cpp
// 添加节点
void addNode(NodeId id, const RuntimeNode& node) {
    nodes_[id] = node;
    // 更新父节点 child_ids
    if (node.parent_id != 0) {
        nodes_[node.parent_id].child_ids.push_back(id);
    }
}

// 删除节点（ID 引用自然失效）
void removeNode(NodeId id) {
    auto it = nodes_.find(id);
    if (it != nodes_.end()) {
        // 从父节点移除引用
        NodeId parent_id = it->second.parent_id;
        if (parent_id != 0) {
            auto& siblings = nodes_[parent_id].child_ids;
            siblings.erase(std::remove(siblings.begin(), siblings.end(), id));
        }
        nodes_.erase(it);
    }
}
```

## 数据结构本质
Runtime Tree = 扁平 map + ID 引用形成的逻辑树。节点平铺存储，通过 parent_id/child_ids 建立父子关系。

## ID 种类与作用

### 1. **编译期 ID（静态）**
- `templateNodeId`：IR 中的模板节点标识
- `templateBindingId`：绑定点标识
- `templateHandlerId`：事件处理器标识
- `blockId`：if/for 块标识

### 2. **运行期 ID（动态）**
- `RuntimeNodeId`：运行时节点唯一标识（由 NodeIdAllocator 生成）
- `OwnerInstanceId`：块实例标识（for 循环中每个实例的家族 ID）
- `RequestId`：事务请求标识（贯穿整个渲染管线）

### 3. **ID 映射关系**
```
templateNodeId → RuntimeNodeId（实例化时映射）
templateBindingId → (RuntimeNodeId + property)（通过 IR 反解）
blockId → (OwnerInstanceId + index)（实例化时分配）
```

## Runtime Tree 是 JS 对象吗？
**不是**。Runtime Tree 是 C++ Core 中的数据结构（`std::map<NodeId, RuntimeNode>`）。JS 侧只能通过 ID 引用节点，不能直接访问 Runtime Tree 对象。

## 与 JS 的通信机制
JS 侧操作：`{templateBindingId: 1, value: "hello"}`
C++ 侧处理：查 IR → 找到对应 RuntimeNodeId → 修改对应节点属性

## QA

### std::map 内存会不会爆炸？
不会。三个核心原因：
1. **节点数完全可控**：RuntimeTreeLimits 硬性上限，内存可预测
2. **嵌入式场景节点数有限**：典型页面<500节点，可适配硬件内存
3. **红黑树内存稳定**：无哈希表 rehash，内存增长线性可预测

### 对比业界的双树设计如何？
**更省内存**：
- 单权威树：无信息重复，无新旧树双份存储
- 对比虚拟DOM：省去旧树+diff中间结果的内存开销
- 扁平存储：比嵌套结构内存更紧凑（无指针链内存开销）

### 复杂应用怎么办？
1. **调大 limits**：复杂应用配置更大节点上限
2. **虚拟化**：只渲染可视区，收敛运行时节点数
3. **分页/懒加载**：按需加载，不一次性撑满内存
4. **嵌入式本质**：嵌入式应用节点数天然有限，复杂度可控

### 为什么选择 std::map 而不是其他结构？
- **查找性能**：O(log n)，1000节点时<10次比较
- **内存稳定**：红黑树无哈希表 rehash 的内存突变
- **有序遍历**：深度/广度优先遍历需要顺序
- **嵌入式友好**：内存可预测，无意外内存增长

### Runtime Tree 内存占用计算
```
单节点 ≈ 128-256 bytes
1000节点 ≈ 128-256 KB
（可适配 128MB-256MB 嵌入式设备）
```

### 与 hap/vela 的区别？
QuickApp Kit 更**激进下沉 C++**：
- hap：更多逻辑在 JS 侧
- QuickApp Kit：Runtime Tree 完全在 C++，JS 只操作 ID
- 内存控制：QuickApp Kit 有显式 RuntimeTreeLimits，更嵌入式友好

## 复杂度对比

### 业界双树diff（React虚拟DOM）
- **时间复杂度**：O(n³)理论上，实际优化到O(n)
- **空间复杂度**：O(n)（完整新旧树+diff结果）
- **内存开销**：双份树存储 + diff中间结果
- **流程**：全树遍历对比 → 生成patch集

### QuickApp Kit 方案
- **时间复杂度**：O(k)（k=dirty nodes数，通常k≪n）
- **空间复杂度**：O(1)（无额外存储，原地更新）
- **内存开销**：单权威树，无diff结果
- **流程**：JS标记dirty → Core通过ID直接定位 → 修改单节点

## 复杂度优势
```
n=1000节点，dirty=10节点时：
虚拟DOM：~1000次比较
QuickApp Kit：~10次O(log n)查找
```

## 嵌入式优势
- **增量更新**：只改变化的部分
- **无全树扫描**：避免CPU密集型diff
- **ID寻址**：O(log n)查找直达节点
- **CPU/内存双优**：适用于低功耗嵌入式设备

## IR概念和本质
- IR 是 Intermediate Representation，中文叫中间表示
- 可以叙述为静态模版树
- Page IR 本质是页面结构及其动态规则的只读说明书。就是页面结构描述的静态模版树
    - 只有初次tpl编译映射到内存一次，后续应该是不会编辑这棵树了
    - 但是需要常驻内存，从 Runtime 的使用角度，Page IR 本质上就是一组只读查找表
        - BindingId -> 节点属性 定位
        - if/for 动态节点实例化
        - 事件声明定位
        - 页面重建与失败恢复
    - 生命周期和页面一样
- 总结：静态模版树，两个职能：
    - 页面结构描述
    - id查表：core在运行时主要是按照id来查这张表
- Page IR = 静态页面模板数据库：用树描述结构，用 ID 索引支持运行期定点查询。

## runtime id域范围：
SurfaceId
└─ ComponentInstanceId
   ├─ NodeId
   └─ BlockInstanceId
      └─ NodeId

| ID 域 | 覆盖范围 | 映射关系 |
|---|---|---|
| `SurfaceId` | 一次页面显示实例 | 一个 Surface 对应一棵 Runtime Tree |
| `ComponentInstanceId` | 页面/组件实例 | 一个组件实例拥有一组节点 |
| `BlockInstanceId` | 一次 `if/for` 动态实例 | 一个 Block 对应一棵动态子树 |
| `NodeId` | 一个真实运行节点 | 与 `RuntimeNode` 一一对应 |
| `TemplateNodeId` | IR 中一个模板位置 | 一个模板节点可产生多个 RuntimeNode |
| `TemplateHandlerId` | IR 中一个事件声明点 | 描述节点上的静态事件位置 |
| `HandlerId` | 一个 JS 回调实例 | 与当前注册的 JS Function 一一对应 |

## 找到一个state更新后应该影响的node和property 一共几步

State 更新
-> JS 根据依赖表找到 BindingId
-> JS 重新计算该绑定表达式，得到新 Value
-> JS 提交 BindingUpdate(OwnerInstanceId, BindingId, Value)
-> Core 查询 Page IR，得到 TemplateNodeId + Property
-> Core 用 (OwnerInstanceId, TemplateNodeId) 找到 NodeId
-> 更新 RuntimeNode.Property
-> 生成 MountTransaction
-> Platform 更新真实控件

## id驱动查询对比tree path查询呢
- 通常更快，而且性能更稳定
- 总结：三次索引查询：
State -> BindingId
BindingId -> TemplateNodeId + Property
(OwnerInstanceId, TemplateNodeId) -> NodeId

单次通常为 O(1) 哈希查询或 O(log n) 有序表查询

- tree-path：
从根开始
-> 逐层查 children
-> 解析每一段路径
-> 处理插入、删除导致的路径变化

复杂度取决于树深，且路径是字符串/数组时还有解析、复制和比较成本。
ID 方案多了固定次数查询，但避免遍历、Diff 和路径重算。其优势不是“零开销”，而是把开销变成与树规模基本无关的固定定点寻址成本。

## 点击后 找到点击来哪个元素 应该触发哪个事件的handle 一共几步 


## temp
- 我来梳理下初始化主流程，你来check 并 整理总结：
- ux - toolkit -》rpk 
- load rpk - 根据其中的page.ir.json 映射到 内存page ir作为静态模版树和id查表
- 根据page ir 映射成runtime tree（map）， 一些动态节点在runtime tree中就有了吧
- Yoga 临时计算 LayoutRect，并写回 RuntimeNode
- 初次首帧渲染， 应该是全量的mount transaction给到platform
- core 调用平台实现的虚函数来挂载

UX 源码
-> Toolkit 编译
-> RPK：JS Bundle + Page IR + Manifest + Assets
-> Loader 校验并解析 Page IR
-> C++ 只读内存 Page IR
-> JS 执行页面，提供初始 Binding、Handler、if/for 实例
-> Core 实例化唯一 Runtime Tree
-> Yoga 临时计算 LayoutRect，并写回 RuntimeNode
-> Core 生成全量 typed MountTransaction
-> 调用 Platform Mount Port
    - 本质就是 Core 定义 C++ 抽象接口，Platform 提供具体实现，好比说：platform实现createNode，core来调用
-> Platform 创建并显示真实控件

## 渲染节奏：就是eventloop tcik microTask
- 就是state更新这些都是注册为微任务，js eventloop直接执行flush这些微任务，然后就是产生并提交一批 渲染任务
- 也就是说 这个节奏在js侧 不在cpp core侧
- 单一eventloop原则
- 调度权必须唯一，可以接入libuv等来管理eventloop

## layout
- yoga创建临时布局树，然后写入到runtimeTree上
- 但是不会整棵树都计算一遍： 
    - 样式/尺寸变化
    -> 标记节点及祖先布局脏
    -> 找到最近布局边界
    -> 构建该子树的临时 Yoga Tree
    -> 计算布局
    -> 只回写变化的 LayoutRect
    -> 生成布局相关渲染指令

## nodeId
- NodeId 起源于 C++ Core，由 Core 的 NodeIdAllocator 在 Runtime Tree 实例化节点时生成。
- 记录在runtime tree
- 销毁： 页面销毁时，Core 使 NodeId 失效，Platform 同步释放对应 Host。
- NodeId 跨两层共享：
    - Core：作为 Runtime Tree 的节点身份和寻址键。
    - Platform：作为平台控件句柄的关联键，例如 NodeId -> lv_obj_t* 或 NodeId -> Android View。

## 