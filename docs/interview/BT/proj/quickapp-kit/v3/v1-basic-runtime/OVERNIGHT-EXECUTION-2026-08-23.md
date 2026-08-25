# V1 Basic Runtime Overnight Execution

> 历史夜间执行说明。当前 LVGL 实施以 [`LVGL-IMPLEMENTATION-ROADMAP.md`](./LVGL-IMPLEMENTATION-ROADMAP.md) 为唯一事实源。

## 目录

- [1. 结论](#1-结论)
- [2. 明早目标](#2-明早目标)
- [3. 实施顺序](#3-实施顺序)
- [4. 验收合同](#4-验收合同)
- [5. 明确不做](#5-明确不做)
- [6. Agent 指令](#6-agent-指令)

## 1. 结论

今晚只做一条三端垂直链路：**同一份联盟 DSL 生成的同一个 RPK，在 LVGL/SDL、Android、iOS 上运行同一个多页快应用。**

不新增架构，不继续拆 Spec，不等待 Image/Input，不做完整 Benchmark。

## 2. 明早目标

共享 Fixture 至少包含：

- `/pages/Home` 和 `/pages/Detail` 两个页面。
- `Home -> Detail` 的 Core Router 跳转。
- Home 页面状态更新。
- 条件节点 `if` 的显示和移除。
- keyed `for` 列表，至少包含 `[A, B] -> [B, A]` 或增删更新。
- `View`、`Text`、`Button` 三个基础组件。
- Button click 经过 Platform -> Core Event Router -> JS Handler。
- 同一个 RPK 在三端使用同一 SHA-256。

这是真实可运行的 V1 主链验收，不是三端各自拼一个演示页面。

## 3. 实施顺序

### S0. 共享 Fixture 和 RPK

在 `quickapp-examples` 新建一个夜间基线 Fixture，使用联盟 DSL；由 Toolkit 生成唯一 RPK。禁止手写 Page IR、RenderTransaction 或 MountTransaction。

建议页面：

- `Home`：状态文本、条件文本、keyed 列表、更新按钮、详情按钮。
- `Detail`：详情文本、返回或再次导航按钮。

### S1. LVGL/SDL 参考链路

先让 LVGL/SDL 加载该唯一 RPK，并完成：首屏、列表更新、条件切换、点击跳转、详情页显示。LVGL 作为共享 Core/JS 链路的第一验证端。

### S2. Android 复用同一 RPK

Android 只补平台装载和已有 `View/Text/Button` Mount/Event 适配；不得在 Java/Kotlin 创建第二套路由或第二套状态逻辑。

### S3. iOS 复用同一 RPK

iOS 只补 UIKit `View/Text/Button` Mount/Event 适配和 RPK 装载；Core 继续拥有 Navigation、Runtime Tree、Lifecycle。

### S4. 三端回归

三端使用同一 Fixture、同一 RPK、同一操作序列。平台允许字体、颜色和坐标存在差异，但页面、路由、列表顺序、条件状态和事件结果必须一致。

## 4. 验收合同

### LVGL/SDL

```text
启动 -> Home 可见
点击更新 -> if 状态改变，keyed 列表更新
点击详情 -> Detail 可见
关闭 -> Runtime/Platform/JS 资源归零
```

### Android / iOS

```text
启动 -> Home 可见
点击更新 -> if 状态改变，keyed 列表更新
点击详情 -> Detail 可见
退出或 teardown -> 资源释放
```

必须保留已有 Case 001、CASE-002、BLOCK-001 回归；新 Fixture 的 Toolkit、Core、平台构建和运行结果必须有最小命令输出或截图。

## 5. 明确不做

- 不实现 Image/Input；B3 Image/Input 继续排队，不阻塞本目标。
- 不扩展公共 Bridge、Runtime Tree、Router、Event ABI。
- 不新增平台专用状态管理、路由或旁路渲染树。
- 不做 Android/iOS/进程级完整 Benchmark。
- 不新增大规模 Trace、故障注入或证据采集系统。
- 不为了“全量 Spec”阻塞这条可运行主链。

## 6. Agent 指令

```text
你现在进入 V1 Basic Runtime 的 Overnight Execution，不再写 Spec，不再等待架构校审。

目标：明早前让同一个联盟 DSL 生成的同一个 RPK，在 LVGL/SDL、Android、iOS 三端运行一个多页快应用。

唯一验收 Fixture 必须包含：
1. /pages/Home 和 /pages/Detail；
2. Home -> Detail 的 Core Router 跳转；
3. 状态更新；
4. if 条件节点切换；
5. keyed for 列表更新；
6. View/Text/Button；
7. Platform click -> Core Event Router -> JS Handler；
8. 三端使用同一 RPK 和同一 SHA-256。

执行顺序：
1. 在 quickapp-examples 创建夜间基线 Fixture；
2. 用 quickapp-toolkit 生成真实 RPK，禁止手写 IR/Transaction；
3. 先在 LVGL/SDL 跑通并保留可见交互；
4. 再让 Android 和 iOS 装载同一个 RPK，复用现有 Core/JS/Router；
5. 最后执行三端同一操作序列回归。

严格边界：
- 不实现 Image/Input；
- 不修改唯一 Runtime Tree、Core Router、Bridge 或 Event ABI；
- 不在平台层创建第二套路由、第二棵树或旁路状态；
- 只支持已有 View/Text/Button 和 click 合同；
- 共享 Core 只有遇到真实编译或运行阻塞才修改，并说明原因；
- 不停在“设计完成”“Contract ready”或新增文档，必须推进到可运行结果。

交付只需要：
- Fixture 路径；
- RPK 路径和 SHA-256；
- 三端构建命令；
- 三端运行/截图/日志；
- 未完成项和真实阻塞原因。

完成后停止，不继续扩展 Image/Input、Benchmark 或其他外围能力。
```
