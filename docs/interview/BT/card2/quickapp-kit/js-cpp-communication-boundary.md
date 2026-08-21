# JS-C++ 通信边界

## 目录

- [1. 结论](#1-结论)
- [2. 通信域](#2-通信域)
- [3. 数据流](#3-数据流)
- [4. 核心接口](#4-核心接口)
- [5. 边界原则](#5-边界原则)

## 1. 结论

JS 与 C++ 不使用无语义的通用 JSON Bridge，而使用 typed message。JS 表达状态变化和业务请求，C++ Core 负责运行时决策、平台调度和结果回传。

## 2. 通信域

| 域 | JS -> C++ | C++ -> JS |
|---|---|---|
| Lifecycle / Module | 初始化、生命周期命令 | Context、Hook 通知 |
| Render | `StateTransaction`、增量意图 | 初始化结果、渲染错误 |
| Event | Handler 执行后的状态提交 | `JsEventDispatch` |
| Navigation | `NavigationRequest` | `NavigationResult`、页面通知 |
| Capability | `FeatureRequest` | `FeatureResult` |
| Diagnostics | JS 错误、调试信息 | Core 错误、Trace、Counter |

## 3. 数据流

状态更新：

```text
JS state mutation
  -> StateTransaction
  -> C++ Binding / Runtime Tree
  -> MountTransaction
  -> Platform
```

事件回传：

```text
Platform input
  -> C++ Event Router
  -> JsEventDispatch
  -> JS Handler
  -> StateTransaction / FeatureRequest / NavigationRequest
```

能力调用：

```text
JS FeatureRequest
  -> C++ Capability Router
  -> Platform Provider
  -> FeatureResult
  -> JS Promise / Callback
```

## 4. 核心接口

```text
JS -> C++
  submitState(StateTransaction)
  requestNavigation(NavigationRequest)
  requestFeature(FeatureRequest)
  notifyLifecycle(LifecycleCommand)

C++ -> JS
  dispatchEvent(JsEventDispatch)
  resolveFeature(FeatureResult)
  resolveNavigation(NavigationResult)
  dispatchLifecycle(LifecycleEvent)
```

每条事务携带必要的 `SurfaceId`、`Revision`、`RequestId` 或 `TransactionId`。

## 5. 边界原则

1. JS 不提交完整 VNode Tree。
2. JS 不直接操作平台节点或 `NativeHandle`。
3. `StateTransaction` 批量进入 Core，不能让每次属性写入都跨边界。
4. Binding、Runtime Tree、Style、Layout 和 `MountTransaction` 留在 C++/Platform 链路内。
5. C++ 不通过高频同步 getter 回读 JS 状态。
