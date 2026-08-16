# Template IR Contract

## 1. 结论

**Template IR 是不可变模板蓝图；C++ 用它创建 Runtime Tree 实例。**

## 2. 结构

```json
{
  "schemaVersion": 1,
  "templateId": "pages/Demo/index",
  "root": 1,
  "nodes": [
    { "templateNodeId": 1, "type": "div", "children": [2] },
    {
      "templateNodeId": 2,
      "type": "text",
      "props": { "value": { "templateBindingId": 1 } }
    }
  ]
}
```

## 3. 规则

1. `templateNodeId` 在一个 Template IR 内稳定且唯一。
2. 静态节点定义可被多个运行时实例共享。
3. 动态节点通过 Block IR 实例化，不预分配运行时 `NodeId`。
4. 节点类型必须来自 Runtime Component Contract。
5. 静态属性与 Binding 引用必须互斥或有明确覆盖顺序。

## 4. 字段合同

```ts
type TemplateIR = {
  schemaVersion: 1
  templateId: string
  root: TemplateNodeId
  nodes: TemplateNode[]
}

type TemplateNode = {
  templateNodeId: number
  type: string
  staticProps?: Record<string, ScalarValue>
  staticAttrs?: Record<string, ScalarValue>
  staticStyles?: Record<string, ScalarValue>
  bindings?: number[]
  events?: TemplateEvent[]
  children?: number[]
  templateBlockId?: number
  loc?: SourceLocation
}

type TemplateEvent = {
  eventType: string
  templateHandlerId: number
}
```

`TemplateNodeId` 在 `templateId` 作用域内唯一；数组顺序是稳定的序列化顺序，不代表运行时节点顺序。
