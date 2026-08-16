## js-bridge（js - c++ - platform）
- 走external func 不走序列化？yes
## 渲染管线
- 3棵树丛本质和第一性角度给出名称？或者参考下 rn flutter[5min]
- 数据传递方式？每一层传递的数据格式或者数据结构，内存共享还是序列化？依赖于js-bridge吗
    - 具体分析：
- 全流程：三个阶段，每层一个阶段，每个阶段负责什么
- 可以吸收 Flutter 一个非常好的设计：C++ Shadow Tree 不要每次全树 Diff；让节点持久化，变化沿 needsReconcile → needsLayout → needsMount 精确传播。
- diff结果
    Diff 的结果本质是一组变化指令，不是一棵树
## 事件系统
- 事件注册和触发执行 销毁流程
- 事件挂载的数据结构
## 构建编译
- input output
- 编译工具链：需要用到的开源的东西
- 是否准备支持AOT JSC 提供编译成字节码模式
## js-framework设计
- 是不是必须存在？js runtime提前加载？


## Q
### JS 到 C++ 传完整 VNode Tree，还是传结构化 Render Intent
```
理念：
JS 不反复提交完整 VNode Tree；
JS 提交最小、确定、可批处理的结构化变化意图，
C++ Runtime Tree 是唯一权威渲染树。
```
首次渲染：CreateSurface + 完整初始子树
新增节点：InsertSubtree，携带完整的新子树
属性变化：UpdateProps(NodeId, changedProps)
结构变化：MoveNode / RemoveNode
事件变化：UpdateEventBinding
批次结束：Commit(revision)
### C++ 是否持有唯一 Shadow Tree
- yes
- 那么 js侧需要一个json-tree吗
### RenderTransaction 的提交边界和批处理策略
- 首次是：tree 

### Platform Event 如何通过 NodeId 回到 JS Handler


## 决策draft
- 函数入口可以直接调用，但树数据不能直接共享；V1 应避免 JSON 序列化，通过 External Function 同步复制成 C++ 强类型事务。
- 跨层传递的是子树描述，不共享 JS 子树对象；V1 直接从 JS Object 转换成 C++ 自有结构，避免 JSON，后续再升级为二进制事务。
- NodeId 应在节点第一次被创建时由 JS Framework 生成，之后作为同一节点的稳定身份贯穿 JS、C++ 和 Platform。三层共享的是数值 ID，不共享节点对象
- C++ 直接引用 JS ArrayBuffer 的底层内存。C++ 使用期间，ArrayBuffer 不能被 GC 回收。最干净的语义是所有权转移
- rpk结构不变，但是核心的那些页面js 需要改变和我们的runtime配套，联盟的应用需要重新用我们的toolkit构建才能使用
    - 联盟源码必须经 QuickApp Toolkit 重新编译；生成的 RPK 保持联盟容器结构，但页面 JS 和 IR 面向 QuickApp Kit Runtime ABI。