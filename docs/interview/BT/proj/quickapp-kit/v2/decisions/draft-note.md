# QuickApp Kit v2 决策草稿

## 目录

- [1. 三类跨层消息](#1-三类跨层消息)

## 1. 三类跨层消息

**结论：渲染、能力调用、事件回传是三种不同语义的跨层消息，不合并成一种通用 Bridge 消息。**

| 消息 | 方向 | 本质 | 核心字段 |
|---|---|---|---|
| `RenderRequest` | JS Framework -> C++ Core | JS 提交界面变化意图 | `surfaceId`、`componentId`、节点变化、`revision` |
| `FeatureRequest` | JS Framework -> C++ Capability | JS 请求系统或平台能力 | `module`、`method`、`args`、`callId`、上下文 |
| `EventMessage` | Platform -> C++ Core -> JS Framework | Platform 报告某节点发生了什么 | `nodeId`、`eventType`、`payload`、`timestamp` |

### 消息流

```text
JS --RenderRequest--> C++ Core --MountTransaction--> Platform
JS --FeatureRequest--> C++ Capability System --> Platform Provider
Platform --EventMessage--> C++ Event Router --> JS Handler
```

### 边界

- `RenderRequest` 不携带 Platform 对象，只表达渲染意图。
- `FeatureRequest` 不进入渲染管线，由能力系统独立处理。
- `EventMessage` 不持有 JS 函数；C++ 根据 `nodeId + eventType` 路由，JS Framework 持有并执行 Handler。
- 三类消息可以共享序列化、生命周期、错误码和上下文机制，但保持独立的数据模型。
