# JS Bundle Design

## 目录

- [1. 结论](#1-结论)
- [2. 分包模型](#2-分包模型)
- [3. 执行边界](#3-执行边界)
- [4. 加载顺序](#4-加载顺序)

## 1. 结论

```text
app.js -> App Runtime ModuleRegistry
shared.js -> App-scoped singleton modules
pages/<route>/index.js -> Page-scoped module and state
```

## 2. 分包模型

| 类型 | 作用域 | 是否共享状态 |
|---|---|---|
| App | App Runtime | 是 |
| Shared | App Runtime | 是，单例 |
| Page | Page Instance | 否 |

每个 Page Bundle 只保留页面业务逻辑、Binding evaluator 和 Handler；静态模板事实进入 IR。

## 3. 执行边界

```text
JS Bundle
  -> Runtime ABI
  -> InstantiateTemplate / RenderTransaction / FeatureRequest
  -> C++ Core
```

Bundle 使用 `LogicalNodeRef(ownerInstanceId, templateNodeId)` 表达更新目标，并以 `TemplateHandlerId` 注册运行时 `HandlerId`。Bundle 不持有 Runtime NodeId，不创建平台对象，不跨越 Platform Adapter。

## 4. 加载顺序

```text
load app.js
  -> register shared modules
  -> resolve route
  -> load shared dependencies
  -> load page bundle
  -> create page instance
```
