# Handler Metadata Contract

## 1. 结论

**Handler Metadata 把模板事件声明连接到 JS Handler；C++ 只保存路由身份，不保存 JS 函数。**

## 2. 结构

```json
{
  "templateNodeId": 2,
  "eventType": "click",
  "handlerExport": "onClick"
}
```

运行时关系：

```text
NodeId + EventType -> HandlerId -> JS Function
```

## 3. 规则

1. Handler 函数只在 JS Executor 执行。
2. Platform 只注册监听器并产生 EventMessage。
3. `NodeId` 失效后，旧事件不得命中新实例。
4. 捕获、冒泡和默认行为由 Event Contract 单独定义。

