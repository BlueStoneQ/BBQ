# LVGL Runtime 总 Spec：总体架构

## 目录

- [1. 结论](#1-结论)
- [2. 组件架构](#2-组件架构)
- [3. LVGL Host 映射](#3-lvgl-host-映射)
- [4. SDL Simulator](#4-sdl-simulator)
- [5. 线程与 EventLoop](#5-线程与-eventloop)
- [6. 内存与失败](#6-内存与失败)
- [7. 跨项目边界](#7-跨项目边界)

## 1. 结论

LVGL Runtime 采用**平台无关 Runtime Host + 单 LVGL owner thread + 可替换 EventLoop/Display/Input Backend**架构。SDL 只替换显示和输入驱动，运行时主链路与设备端一致。

## 2. 组件架构

```text
LvglBackendPorts                 # 无实现依赖的 foundation
  -> LvglRuntimeHost
      -> PackageSource
      -> Shared Core / Shared JS Runtime
      -> LvglPlatformAdapter
      -> SurfaceHostAdapter
      -> MountAdapter
      -> ComponentRegistry
      -> InputAdapter
      -> FontMeasureAdapter
      -> CapabilityProviders
      -> PageControlAdapter
      -> EventLoopBackend
      -> DisplayBackend / InputBackend
          -> SDL simulator | embedded drivers
```

EventLoop、Display 和 Input 是 Host backend，不进入 Core 或 Runtime ABI。

## 3. LVGL Host 映射

| 规范对象 | LVGL 责任 |
|---|---|
| Surface Host | 独立页面根容器，支持隐藏、展示、原子 close/reveal 和销毁 |
| View | 容器对象，只接受 Core 输出的布局和受控 visual props |
| Text | 文本对象，内容和 visual props 由 Mount 设置 |
| Button | 可点击根对象；内部 label 是 Adapter 私有实现，不获得 Runtime NodeId |
| NodeId | 只映射规范 Host 根对象，不等同指针值 |

Core 已完成 Yoga Layout；Mount Adapter 必须关闭或绕开会重排节点的 LVGL Layout 行为，并将 logical-px 按 viewport/density 映射到设备坐标。

## 4. SDL Simulator

```text
Runtime RPK
  -> same Package Loader/Core/JS
  -> same LVGL Platform Adapter
  -> SDL display + mouse/touch input
  -> interactive window
```

Simulator 必须支持：启动 Root、点击 Button、状态更新、push 页面、返回/销毁、截图和结构化 Trace。它不得用 HTML 或独立 Mock UI 替代 LVGL Host Tree。

Navigation close 是一个 Platform command：LVGL owner thread 在同一任务内销毁 source 容器并恢复 reveal 容器，完成后返回 `CloseSurfaceHostResult`。Core 在结果成功前不 pop 权威栈。Simulator 启动成功的唯一判据是上层收到 root `CreateSurfaceResult(presented)`，窗口创建或 first frame 均不能提前冒充成功。

## 5. 线程与 EventLoop

| 归属 | 规则 |
|---|---|
| JS Executor | 共享 JS Runtime 所有权 |
| Core Runtime | 共享 Core 所有权 |
| LVGL owner | 唯一调用 `lv_*`、处理 timer/display/input |
| Measure | Core Thread 调用只读字体数据或线程安全 metrics service |

EventLoop Backend 只提供任务投递、时钟、唤醒和停止。V1 可以提供 libuv Backend 与最小内建 Backend；具体设备可替换，但同一 Surface 的 Platform commands 必须有序。

Backend Port interface 由 foundation 定义，不能依赖 Runtime Host 或 SDL/libuv 实现；Host 和具体 Backend 都单向依赖该 interface。

## 6. 内存与失败

- Adapter 映射以 Surface 为 owner，Destroy 可递归释放全部 LVGL object 和 Listener。
- Button 内部私有对象随规范根对象销毁，不进入 Core 映射。
- Mount 失败停止本事务并报告；full rebuild 先销毁并重建 Surface 内 Host Tree。
- 队列满时返回可观察的 Platform failure，不静默丢失 Mount；可合并的 display invalidation 不改变事务结果。
- 无异常机制的平台边界也必须转为公共 `RuntimeError`，不得 abort 整个设备进程。

## 7. 跨项目边界

LVGL/SDL 必须链接与 Android 相同的 Core/JS 版本并执行相同 Runtime RPK。任何为适配 LVGL 而要求 Core 改变 typed contract 的问题，都记录 `[待决策]` 交由总架构处理。
