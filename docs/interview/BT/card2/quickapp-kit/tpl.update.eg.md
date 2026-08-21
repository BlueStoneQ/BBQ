# update
**结论**

模板树里的静态节点可以被重复实例化，所以必须使用：

```text
TemplateId 定位定义
OwnerInstanceId 区分实例
NodeId 定位 C++ 中的真实运行节点
```

## 1. 模板

```html
<div>
  <text>{{ title }}</text>

  <div for="{{ items }}">
    <text>{{ $item.name }}</text>
    <button onclick="select">选择</button>
  </div>
</div>
```

Toolkit 编译成静态模板定义：

```text
TemplateNodeId=1  View(root)
├── TemplateNodeId=2  Text
└── TemplateBlockId=1  For(items)
    └── TemplateNodeId=3  View(item)
        ├── TemplateNodeId=4  Text
        └── TemplateNodeId=5  Button
```

相关定义 ID：

```text
TemplateBindingId=1
  -> Node=2, property=text, expression=title

TemplateBindingId=2
  -> Block=1, Node=4, property=text, expression=$item.name

TemplateHandlerId=1
  -> Block=1, Node=5, event=click, method=select
```

这些 ID 只描述一份静态模板。

## 2. 页面实例化

页面组件创建：

```text
ComponentInstanceId = cmp:1
```

Core 创建静态部分：

```text
LogicalNodeRef(cmp:1, TemplateNodeId=1) -> node:1
LogicalNodeRef(cmp:1, TemplateNodeId=2) -> node:2
```

此时 Runtime Tree：

```text
node:1 View
└── node:2 Text("商品列表")
```

`title` 更新使用：

```text
cmp:1 + TemplateBindingId=1
-> Page IR 得到 TemplateNodeId=2
-> LogicalNodeRef(cmp:1, 2)
-> node:2
```

## 3. `for` 实例化

数据：

```js
items = [
  { id: 'a', name: '苹果' },
  { id: 'b', name: '香蕉' }
]
```

同一个 `TemplateBlockId=1` 产生两个运行时 Block：

```text
BlockInstanceId = blk:1  // key=a
BlockInstanceId = blk:2  // key=b
```

第一个条目：

```text
LogicalNodeRef(blk:1, Node=3) -> node:3
LogicalNodeRef(blk:1, Node=4) -> node:4
LogicalNodeRef(blk:1, Node=5) -> node:5
HandlerId=hdl:1 -> (node:5, click)
```

第二个条目：

```text
LogicalNodeRef(blk:2, Node=3) -> node:6
LogicalNodeRef(blk:2, Node=4) -> node:7
LogicalNodeRef(blk:2, Node=5) -> node:8
HandlerId=hdl:2 -> (node:8, click)
```

最终 C++ Runtime Tree：

```text
node:1 View
├── node:2 Text("商品列表")
├── node:3 View                  blk:1
│   ├── node:4 Text("苹果")
│   └── node:5 Button("选择")    hdl:1
└── node:6 View                  blk:2
    ├── node:7 Text("香蕉")
    └── node:8 Button("选择")    hdl:2
```

## 4. 更新一个条目

将香蕉改为葡萄：

```js
items[1].name = '葡萄'
```

JS 发送：

```text
UpdateBinding {
  ownerInstanceId: blk:2,
  templateBindingId: 2,
  value: "葡萄"
}
```

Core 寻址：

```text
TemplateBindingId=2
-> TemplateNodeId=4, property=text

LogicalNodeRef(blk:2, 4)
-> node:7

node:7.text = "葡萄"
```

最终只产生：

```text
SetHostProp(node:7, text, "葡萄")
```

不遍历整棵树，也不会更新苹果对应的 `node:4`。

## 5. 点击事件

用户点击香蕉条目的按钮：

```text
Platform:
NativeHandle -> node:8

Core:
(node:8, click) -> hdl:2

JS:
hdl:2 -> select 函数
```

JS 收到的事件目标可以表示为：

```text
LogicalNodeRef(blk:2, TemplateNodeId=5)
```

它明确表示“第二个 Block 实例中的 Button 定义”。

## 6. 删除条目

删除 key=`a`：

```text
TemplateBlockId=1 + parent=cmp:1 + key=a
-> 找到 blk:1
```

销毁链路：

```text
blk:1
-> 删除 hdl:1
-> 删除 node:3 子树
-> Platform 删除 node:3 对应 Host 子树
-> 释放 blk:1
```

`blk:2` 不变：

```text
blk:2 仍然存在
node:6/7/8 保持不变
hdl:2 保持不变
```

因此列表重排时，稳定 `key` 可以保留原来的 `BlockInstanceId`、`NodeId` 和 `NativeHandle`。

一句话：

> **模板 ID 描述“列表项长什么样”，BlockInstanceId 描述“这是哪一个列表项”，NodeId 描述“它在 C++ Runtime Tree 中是哪一个真实节点”。**

# ID寻址

**结论**

Core 不是遍历整棵树寻找节点，而是通过：

```text
OwnerInstanceId + TemplateBindingId
-> Page IR 索引
-> LogicalNodeRef
-> NodeId 索引
-> RuntimeNode
```

注释 1

## 例子

JS 提交：

```text
owner = blk:2
binding = binding:2
value = "葡萄"
```

### 第一步：找到 Binding 定义

Core 查询 Page IR：

```text
(binding:2)
-> owner scope: Block
-> target: TemplateNodeId=4
-> property: text
```

### 第二步：找到运行时实例

Core 查询实例表：

```text
blk:2
-> BlockInstanceRecord
-> templateBlockId=1
-> runtime owner context
```

组合得到：

```text
LogicalNodeRef(blk:2, TemplateNodeId=4)
```

### 第三步：找到 NodeId

Core 使用 Runtime Tree 的逻辑索引：

```text
(blk:2, TemplateNodeId=4)
-> node:7
```

### 第四步：找到 RuntimeNode

```text
node:7
-> RuntimeNode {
     type: Text,
     text: "香蕉"
   }
```

更新：

```text
node:7.text = "葡萄"
```

然后生成：

```text
MountTransaction {
  SetHostProp {
    nodeId: node:7,
    property: text,
    value: "葡萄"
  }
}
```

## Core 内部需要的索引

```cpp
BindingIndex:
  (OwnerInstanceId, TemplateBindingId)
    -> BindingRecord

BindingRecord:
  -> TemplateNodeId
  -> property
  -> current value

RuntimeNodeIndex:
  (OwnerInstanceId, TemplateNodeId)
    -> NodeId

NodeStore:
  NodeId
    -> RuntimeNode
```

简化为：

```text
Map<BindingKey, BindingRecord>
Map<LogicalNodeRef, NodeId>
Map<NodeId, RuntimeNode>
```

## 为什么不会找错

因为列表两个实例的 Owner 不同：

```text
(blk:1, TemplateNodeId=4) -> node:4
(blk:2, TemplateNodeId=4) -> node:7
```

虽然模板节点都是 `TemplateNodeId=4`，但组合后的 `LogicalNodeRef` 不同。

## 时间复杂度

正常情况下是几次哈希表查询：

```text
Binding 查询       O(1)
Block 实例查询     O(1)
LogicalNode 查询   O(1)
Node 查询          O(1)
```

所以更新一个 Binding 不需要遍历整个 Runtime Tree，复杂度接近：

```text
O(1)
```

结构变化，例如新增或删除 `for` Block，需要按 Block 子树规模创建或销毁：

```text
O(k)
```

其中 `k` 是该 Block 的节点数量，而不是整棵页面树的节点数量。

一句话：

> **Core 用“实例 Owner + 静态 Template ID”定位逻辑节点，再用索引映射到 NodeId，最后用 NodeId 取得真实 RuntimeNode。**