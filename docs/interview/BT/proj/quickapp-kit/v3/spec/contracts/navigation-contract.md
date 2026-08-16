# Navigation Contract

## 目录

- [1. 结论](#1-结论)
- [2. V1 Push](#2-v1-push)
- [3. V1 Close](#3-v1-close)
- [4. 所有权](#4-所有权)
- [5. 生命周期](#5-生命周期)

## 1. 结论

Navigation 是 C++ Core 的 Surface 控制协议；`router.push` 的本质是“解析 route，创建目标 Surface，并在首屏成功后原子提交页面栈”。

## 2. V1 Push

```text
NavigationPush(
  requestId,
  sourceSurfaceId,
  uri,
  params
)

NavigationPushResult:
  presented(targetSurfaceId)
  | failed(RuntimeError)
```

`uri` 使用以 `/` 开头的规范 route；`params` 是受 [Runtime Value](./runtime-value.md) 约束的对象。路由不存在返回 `ROUTE_NOT_FOUND`。

## 3. V1 Close

```text
NavigationClose(requestId, sourceSurfaceId)

NavigationCloseResult:
  closed(revealedSurfaceId)
  | failed(RuntimeError)
```

`sourceSurfaceId` 必须是当前 visible 非 Root 栈顶，`revealedSurfaceId` 只能是它的直接前驱。Root 关闭由 Runtime Host 的 `destroyAppRuntime` 负责；V1 不提供任意层级 remove、页面缓存或历史跳转。

## 4. 所有权

| 部件 | 层 | 职责 |
|---|---|---|
| JS Router API / Runtime Host Back | JS Framework / Platform Host | 生成同一 NavigationClose typed request；Host 不直接修改页面容器栈 |
| Navigation Controller | C++ Core | route 解析、Surface 创建、逻辑页面栈和事务协调 |
| Runtime Host | Platform | 展示目标 Surface，执行平台页面容器操作 |

Platform 不自行解析联盟 route；JS 不自行创建 SurfaceId。

`NavigationPush` 只来自 JS Router API；`NavigationClose` 可以来自 `system.router.back` 或 Runtime Host 的系统返回动作，但进入 Core 后使用同一请求、并发门禁、状态机和 Result。Platform Host 不得绕过 Core 直接关闭页面容器。

## 5. 生命周期

```text
NavigationPush
  -> Core 校验 source Surface 和 route
  -> Core 创建未提交的 target Surface
  -> Platform CreateSurfaceHost(target hidden)
  -> Core 向 JS 交付包含 params 的 SurfaceContext
  -> JS InstantiateTemplate
  -> full Mount 成功
  -> Platform PresentSurfaceHost(push, source, target)
  -> PresentSurfaceHostResult(presented)
  -> Core 原子提交 source hidden、target visible 和页面栈
  -> Core 向 JS 排队 source onHide、target onShow
  -> InstantiateTemplateResult(status=presented)
  -> NavigationPushResult(status=presented)
```

Present 成功时 Platform 原子隐藏 source 并展示 target。任一步失败都向 target JS 返回 Instantiate failure，销毁未提交的 target Surface/Host，原页面栈和 source 的 visible 状态保持不变，并返回 `NavigationPushResult(status=failed)`。V1 不允许同一 source Surface 并发两个 Navigation 请求。

Close 顺序固定为：

```text
NavigationClose(source=top)
  -> Core 校验 top、predecessor 和 NAVIGATION_BUSY
  -> source 进入 closing，拒绝新 Event/Render/Capability/Navigation
  -> Platform CloseSurfaceHost(source, reveal=predecessor)
  -> CloseSurfaceHostResult(completed)
  -> Core 原子 pop source，提交 predecessor visible
  -> source onHide / onDestroy；predecessor onShow
  -> release source Handler/Page VM/Runtime Tree
  -> NavigationCloseResult(closed, revealedSurfaceId)
```

Platform Close 是“删除 source Host + 展示 predecessor”的原子视觉操作。失败时两者视觉状态不变，Core 不提交栈、不发送 Hook，并恢复 source 接收输入。成功后 Hook 异常不回滚页面栈；`onDestroy` 失败仍强制释放。

Platform 细节遵循 [Platform Surface Adapter Contract](./platform-surface-contract.md)。

机器合同：[navigation.schema.json](./schemas/navigation.schema.json)。
