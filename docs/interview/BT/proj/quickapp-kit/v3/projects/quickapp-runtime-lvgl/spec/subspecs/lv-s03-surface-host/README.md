# LV-S03 Surface Host

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 核心边界](#3-核心边界)
- [4. 依赖与交付](#4-依赖与交付)
- [5. 状态](#5-状态)

## 1. 结论

LV-S03 只做一件事：**把 Core 已决定的 Surface command，在唯一 LVGL owner thread 上转换为 page root 的原子资源操作，并恰好返回一个同 ID 结果。**

Core 拥有路由栈和权威 Surface 状态；LV-S03 只保存执行命令所必需的 `SurfaceId -> page root` 映射与本地资源阶段。

## 2. 范围

包含：

- `CreateSurfaceHost`、`PresentSurfaceHost(root|push)`、`SetSurfaceVisibility`、`CloseSurfaceHost`、`DestroySurfaceHost`。
- 隐藏 page root 的创建、展示、隐藏、原子 push、原子 close/reveal 和递归销毁。
- `PlatformSurfacePort` 的 bounded admission、owner-thread 执行和 `CoreIngressPort` 结果回流。
- 每 Surface 单控制命令、RequestId 幂等副作用、失败收口和固定资源上限。
- 供后续 LV-S04 使用的项目内部 page-root/mount-readiness 边界。

不包含：Host Component、MountTransaction、NodeId 映射、事件、输入、Measure、路由解析、JS Hook、SDL 窗口或设备显示驱动。

## 3. 核心边界

```text
Core Surface command
  -> bounded PlatformSurfacePort
  -> LVGL owner task
  -> SurfaceId -> hidden LVGL page root
  -> atomic visibility/destruction operation
  -> immutable Surface result
  -> CoreIngressPort
```

LV-S03 的本地阶段只用于验证资源能否执行下一条命令，不是 Core Surface 生命周期或 Navigation 栈的副本。

## 4. 依赖与交付

依赖：

- [LV-S01 Backend Ports](../lv-s01-backend-ports/README.md)
- [LV-S02 Runtime Host 与 Backends](../lv-s02-runtime-host-backends/README.md)
- [Platform Surface Adapter Contract](../../../../../spec/contracts/platform-surface-contract.md)
- [Lifecycle And Threading Contract](../../../../../spec/contracts/lifecycle-and-threading.md)
- [Runtime Error Contract](../../../../../spec/contracts/error-contract.md)
- [LVGL Runtime 总体架构](../../architecture.md)

交付：[需求](./requirements.md)、[设计](./design.md)、[任务](./tasks.md)、[验收](./acceptance.md)。

## 5. 状态

分 Spec 已完成，当前 `READY_FOR_REVIEW`。未通过总架构校审前不得编码 LV-S03，也不得启动 LV-S04。
