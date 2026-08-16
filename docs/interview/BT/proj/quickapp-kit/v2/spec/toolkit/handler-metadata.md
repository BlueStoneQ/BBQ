# Handler Metadata Contract

## 1. 结论

**Handler Metadata 把模板事件声明连接到 JS Handler；C++ 只保存路由身份，不保存 JS 函数。**

## 2. 结构

```json
{
  "schemaVersion": 1,
  "templateHandlerId": 1,
  "templateNodeId": 2,
  "eventType": "click",
  "moduleId": "pages/Demo/index",
  "exportName": "onClick"
}
```

运行时关系：

```text
TemplateNodeId + EventType -> TemplateHandlerId
  -> JS 注册 HandlerId -> JS Function
  -> C++ EventBinding(NodeId, EventType) -> HandlerId
```

## 3. 规则

1. Handler 函数只在 JS Executor 执行。
2. Platform 只注册监听器并产生 EventMessage。
3. `NodeId` 失效后，旧事件不得命中新实例。
4. 捕获、冒泡和默认行为由 Event Contract 单独定义。

## 4. 字段合同

```ts
type HandlerMetadata = {
  schemaVersion: 1
  templateHandlerId: number
  moduleId: string
  exportName: string
  eventType: string
  templateNodeId: number
  loc?: SourceLocation
}
```

`templateHandlerId` 是编译期静态事件定义的身份，在一个编译产物内唯一；`HandlerId` 是 JS Framework 为页面实例注册函数时生成的运行时身份，二者不能混用。
