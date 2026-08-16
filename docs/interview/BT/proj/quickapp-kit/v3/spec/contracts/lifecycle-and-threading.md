# Lifecycle And Threading Contract

## 目录

- [结论](#结论)
- [消息和所有权](#消息和所有权)
- [生命周期](#生命周期)

## 结论

V1 采用三类执行归属和消息队列；跨层传递 immutable typed message，不共享可变树或平台对象。

| 执行归属 | 所有者 | 主要工作 |
|---|---|---|
| JS Executor Thread | JS Framework | JS、state、Binding、Handler、Bundle |
| Core Runtime Thread | C++ Core | Runtime Tree、Transaction、Style/Layout、Event Router |
| Platform UI/Event Thread | Platform Adapter | Host Tree、原生 API、输入采集 |

具体平台可以把多个归属映射到同一线程，但不能改变所有权和调用顺序。V1 允许单线程实现，只要保持同样的消息边界。

Platform Measure Service 不是第四条执行线程；它是 Platform 提供、在 Core Runtime Thread 内同步调用的只读字体服务，不访问 UI Thread 或 Host Tree。

## 消息和所有权

```text
JS -> Core: immutable Render/Navigation/Capability/Page Control/LifecycleResult message，入队时复制或转移所有权
Core -> Platform: immutable MountTransaction、Surface Host command、Capability 或 Page Control request
Platform -> Core: immutable PlatformInputMessage、Mount/Surface/Capability/Page Control result
Core -> JS: immutable LoadVerifiedModule、AppContext、SurfaceContext、LifecycleDispatch、JsEventDispatch 或 typed result
Core Loader -> JS Module Loader: verified immutable Bundle bytes，转移或共享只读所有权
Runtime Host -> Core: immutable RuntimeLifecycleControl
```

不跨边界传递 JS 对象指针、C++ 可变容器引用、JNI/UIKit/LVGL 对象指针。

## 生命周期

```text
Runtime Host -> create Surface
  -> Core 分配 SurfaceId
  -> Platform 创建 hidden-empty Surface Host
  -> JS 接收 SurfaceContext
  -> load JS/page
  -> instantiate Runtime Tree
  -> full Mount(hidden)
  -> Platform Present
  -> Core commit lifecycleState=visible, healthState=normal
  -> JS Page onShow
  -> upper result(presented)
destroy Surface
  -> stop accepting new messages
  -> Page onHide(if visible) / onDestroy
  -> drain or cancel queued messages and release Page VM
  -> unregister handlers
  -> destroy Host Tree
  -> release Runtime Tree / Core PageContext
```

Surface 销毁后所有关联消息必须返回 `SURFACE_NOT_FOUND`，不得复活已销毁 Surface。请求结果携带 `surfaceId + requestId`，渲染结果携带 `surfaceId + transactionId`，Mount 结果携带 `surfaceId + mountAttemptId + sourceId`；SurfaceContext/状态消息只以 `surfaceId` 关联。

Surface 生命周期与健康度正交：`visible/hidden/destroying/destroyed` 属于 lifecycleState，`normal/degraded/failed` 属于 healthState。禁止重新引入同时表示“已展示”和“健康”的 `ready`。

首次 full Mount 成功只表示 Host Tree 已落地，不得触发上层成功；首次 Platform Present 成功并由 Core 提交可见状态后，才允许返回 `InstantiateTemplateResult`、Root `CreateSurfaceResult` 或 `NavigationPushResult` 的成功分支。

App/Page Hook 的完整顺序遵循 [App And Page Lifecycle Contract](./application-lifecycle-contract.md)。PlatformMeasureAdapter 的同步调用是 Core Layout 内部的只读服务调用，不属于 Core 对 UI Thread 的同步等待，具体约束见 [Measure Adapter Contract](./measure-adapter-contract.md)。
