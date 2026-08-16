# Platform Surface Adapter Contract

## 目录

- [1. 结论](#1-结论)
- [2. V1 命令](#2-v1-命令)
- [3. 状态机](#3-状态机)
- [4. Mount 顺序](#4-mount-顺序)
- [5. Root 首次展示](#5-root-首次展示)
- [6. Navigation 顺序](#6-navigation-顺序)
- [7. 失败与销毁](#7-失败与销毁)
- [8. 线程与数据](#8-线程与数据)

## 1. 结论

Platform Surface Adapter 只管理页面容器的创建、可见性和销毁；C++ Core 管理权威 Surface 状态与 Navigation 栈，Mount Adapter 管理容器内部的 Host Tree。

## 2. V1 命令

| Core -> Platform | Result | 语义 |
|---|---|---|
| `CreateSurfaceHost` | `created | failed` | 创建隐藏的空页面容器和 `SurfaceId -> HostContainer` 映射 |
| `PresentSurfaceHost` | `presented | failed` | 原子展示 root 或 push target；成功前 source 视觉状态不变 |
| `SetSurfaceVisibility` | `completed | failed` | 用于 Host 前后台切换，不改变 Core Navigation 栈 |
| `CloseSurfaceHost` | `completed | failed` | 原子删除当前栈顶 Host 并展示指定前驱 Host |
| `DestroySurfaceHost` | `destroyed | failed` | 递归销毁 Host Tree、容器和全部 NativeHandle 映射 |

每个命令携带 `requestId + surfaceId`，结果使用相同 `kind` 的 success/failure 判别联合。push present 还必须携带 `sourceSurfaceId`；Platform 不自行选择 source。

## 3. 状态机

```text
absent
  -> CreateSurfaceHost
hidden-empty
  -> full Mount
hidden-mounted
  -> PresentSurfaceHost(root|push target)
visible -> SetSurfaceVisibility(hidden) -> hidden
hidden  -> SetSurfaceVisibility(visible) -> visible
visible(top) + hidden(predecessor)
  -> CloseSurfaceHost(top, predecessor)
absent(top) + visible(predecessor)
visible | hidden | hidden-mounted | hidden-empty
  -> DestroySurfaceHost
absent
```

Create 只创建容器，不创建 Runtime/Host 节点。Platform 拒绝重复 SurfaceId；Core 拒绝不存在或状态越级的结果。

## 4. Mount 顺序

1. `CreateSurfaceHostResult(created)` 之前不得提交该 Surface 的 MountTransaction。
2. 首次 full Mount 只写入隐藏容器，不自动展示页面。
3. `MountTransactionResult(mounted)` 只表示 Host Tree 已完整落地，不表示页面已显示。
4. incremental Mount 只允许 lifecycleState 为 `visible/hidden` 且 healthState 为 `normal` 的 Surface；degraded/failed Surface 遵循 Render Contract。
5. Destroy 开始后拒绝新 Mount；Platform 必须先取消或完成当前 UI 队列，再销毁容器。

## 5. Root 首次展示

```text
CreateSurfaceHost(root hidden-empty)
  -> full Mount(root hidden-mounted)
  -> PresentSurfaceHost(mode=root)
  -> PresentSurfaceHostResult(presented)
  -> Core 提交 root lifecycleState=visible、healthState=normal 和 Root Navigation 栈
  -> InstantiateTemplateResult(presented)
  -> CreateSurfaceResult(presented)
```

Root Present 失败时 Host 保持 hidden-mounted；Core 将逻辑 Surface 置为 failed，交付失败结果并立即 Destroy Host。Platform 不得自动显示 full Mount 完成的 Root。

## 6. Navigation 顺序

```text
Core 创建未提交 target Surface
  -> CreateSurfaceHost(target)
  -> onSurfaceContext
  -> InstantiateTemplate + full Mount(target hidden)
  -> PresentSurfaceHost(mode=push, source, target)
  -> PresentSurfaceHostResult(presented)
  -> Core 原子提交逻辑 Navigation 栈
  -> NavigationPushResult(presented)
```

Platform 对 push 的展示必须是原子视觉操作：成功时 source 从 visible 变为 hidden，target 从 hidden-mounted 变为 visible；失败时 source 保持 visible，target 保持 hidden-mounted。`PresentSurfaceHostResult(presented)` 之后 Core 原子提交 source hidden、target visible 和逻辑栈；该提交是不再失败的内存操作，因此不会出现 Platform 已展示而 Core 未提交的分叉。

root Surface 使用 `mode=root` 且不携带 source。Platform 不解析 route，不分配 SurfaceId，不维护权威页面栈。

Navigation Close 使用 `CloseSurfaceHost(surfaceId, revealSurfaceId)`。成功必须同时递归销毁 closing Host Tree/NativeHandle 并把 reveal Host 从 hidden 切为 visible；失败必须保持两者原状。Platform 不自行选择 reveal Surface，也不发送 JS Hook。

## 7. 失败与销毁

Present 失败：Core 请求 Destroy target Host，释放 target Runtime/JS Context，原栈不变，返回 `NAVIGATION_FAILED` 或 `SURFACE_PRESENTATION_FAILED`。

Destroy 失败：Core 仍将逻辑 Surface 置为 destroyed/tombstone，不再接受消息，并向 Runtime Host 报告失败；Platform Host 必须执行容器级 reset，禁止用同一 SurfaceId 恢复残留对象。

## 8. 线程与数据

Core Runtime Thread 只提交 immutable command；Platform Adapter 将命令投递到 UI Thread，完成后把 immutable result 投递回 Core 队列。同一 Surface 同时最多一个 Surface control command；禁止 Core 同步等待 UI Thread，禁止跨边界传递 NativeHandle。

机器合同：[platform-surface.schema.json](./schemas/platform-surface.schema.json)。
