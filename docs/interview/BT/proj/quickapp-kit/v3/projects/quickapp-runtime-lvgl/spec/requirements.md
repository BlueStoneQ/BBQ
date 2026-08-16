# LVGL Runtime 总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 项目使命](#2-项目使命)
- [3. 输入与输出](#3-输入与输出)
- [4. V1 功能需求](#4-v1-功能需求)
- [5. 嵌入式质量需求](#5-嵌入式质量需求)
- [6. 边界与后置项](#6-边界与后置项)

## 1. 结论

LVGL Runtime 是 V1 的首个可运行闭环和嵌入式架构证明：**Runtime RPK、JS Runtime 和 C++ Core 必须先在 LVGL/SDL 上完成完整可见、可点击、可导航的运行闭环，并给出内存和线程证据。**

SDL simulator 不是页面截图工具，而是承载整个 Runtime 的桌面交互宿主。

## 2. 项目使命

```text
Embedded/SDL Runtime Host
  -> PackageSource + EventLoop Backend
  -> shared C++ Core + shared JS Runtime
  -> LVGL Surface/Mount/Input/Measure/Provider Adapter
  -> LVGL display; SDL driver for desktop simulation
```

它验证的是共享 Core 的轻量性和可移植性，不是另写一套 LVGL Runtime 逻辑。

## 3. 输入与输出

### 3.1 输入

- 公共 `RuntimeLaunchProfile`，包含三端共享的 Runtime RPK、route、params、viewport、Trace 输出和 target。
- Core 发出的 Surface create/present/visibility/close/destroy、Mount、Capability、Page Control typed command。
- Core Runtime Thread 发出的同步 `MeasureRequest`。
- LVGL/SDL 输入事件、显示生命周期和平台执行结果。

### 3.2 输出

- 嵌入式/桌面 `PackageSource` 和 `RuntimeLifecycleControl`。
- Surface/Mount/Capability/Page Control、`MeasureResult(measured|failed)` 与字体 generation 通知。
- `PlatformInputMessage`。
- 帧、内存、事务、事件延迟和对象数量 Trace。

## 4. V1 功能需求

| ID | 需求 |
|---|---|
| LV-R01 | 提供 C++ Runtime Host，组合共享 Core/JS，不复制其实现。 |
| LV-R02 | 提供文件和内存型 PackageSource，严格实现公共接口语义。 |
| LV-R03 | SDL simulator 必须运行完整 Runtime RPK，支持真实鼠标/触摸点击、页面更新和导航。 |
| LV-R04 | 实现 Surface Host 容器与 hidden-empty/hidden-mounted/visible/destroyed 状态，并支持原子 `CloseSurfaceHost(source,reveal)`。 |
| LV-R05 | 实现 `NodeId -> lv_obj_t*` 私有映射和 `View/Text/Button` Host Component。 |
| LV-R06 | 消费 Core 最终 Layout Rect，禁止 LVGL 自有 Layout 二次改变节点几何。 |
| LV-R07 | 严格执行 full/incremental Mount、Move、Remove 和递归 NativeHandle 清理。 |
| LV-R08 | 将 LVGL click/press-release 语义规范化为一个 `click` PlatformInputMessage。 |
| LV-R09 | 提供可从 Core Runtime Thread 同步调用的线程安全字体 metrics，不访问可变 Host Tree；精确返回 measured/failed，字体变化投递严格递增 generation。 |
| LV-R10 | 实现 prompt/device PlatformProvider；Simulator 返回明确模拟设备信息。 |
| LV-R11 | V1 必须实现 `setTitleBar`，并在 SurfaceContext 声明；`setMeta` 可实现或返回 `HOST_FEATURE_UNSUPPORTED`，不得静默成功。 |
| LV-R12 | Platform UI/Event 工作只在 LVGL owner thread；Core 与 JS 不直接调用 `lv_*` API。 |
| LV-R13 | EventLoop Backend 可替换；libuv 可作为标准 Backend 之一，但不得成为共享 Core 基础设施。 |
| LV-R14 | 在固定 viewport 下运行 Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001`，行为语义以公共合同和联盟 Android 行为基线为准。 |
| LV-R15 | 输出 steady-state、首屏峰值、页面销毁后内存、LVGL object 和队列深度指标。 |
| LV-R16 | SDL Host 消费公共 `RuntimeLaunchProfile`；只在 Core 返回 root `CreateSurfaceResult(presented)` 后报告启动成功，失败返回稳定错误和非零退出，正常关闭返回零。 |
| LV-R17 | LVGL Composition Root 必须为每个 Profile 选择且只选择一个 JS Engine Provider，提供 `lvgl-simulator-dev` 与 `lvgl-embedded-min` 并生成公共 Runtime Composition Manifest；embedded-min 不得链接 SDL、模拟设备、故障注入和 diagnostic-only 模块。 |
| LV-R18 | LVGL Composition Root 注入 Noop 或 LVGL `TraceSink` Adapter；设备 Collector 使用有界缓冲并输出结构化事实，不得要求文件系统，也不得把存储或分析逻辑带入 Core。 |

## 5. 嵌入式质量需求

| 维度 | 要求 |
|---|---|
| 内存 | 所有 Surface、Node、Handler、LVGL object 有确定销毁点；不得依赖进程退出回收。 |
| 线程 | LVGL API 只有一个 owner thread；跨线程只传 immutable message。 |
| 可移植 | SDL 仅是 display/input driver；业务逻辑和 Adapter 不依赖桌面窗口 API。 |
| 可裁剪 | Backend、Provider 和诊断按模块 target 组合；未选模块及依赖不进入最终链接产物。 |
| 背压 | UI command 和 input queue 有上限、统计与过载策略，不无限增长。 |
| 一致性 | 相同 Artifact 和操作在 LVGL/Android 具有相同逻辑结果、ID 关系和错误分类。 |
| 可观测 | 无操作系统级工具时也能输出结构化时间、内存和对象计数。 |

## 6. 边界与后置项

V1 不做：

- 面向特定 RTOS 的完整 BSP、驱动和发布镜像。
- 在共享 Core 内硬编码 libuv、SDL 或 LVGL。
- 全量 LVGL Widget 对应联盟组件。
- GPU 动画、复杂手势、复杂文本排版和多窗口。
- 用 LVGL object tree 替代 Core Runtime Tree。
