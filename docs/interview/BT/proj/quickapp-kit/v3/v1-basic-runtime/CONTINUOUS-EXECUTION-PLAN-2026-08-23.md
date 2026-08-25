# V1 主流基础兼容连续执行计划

> 历史连续执行说明。当前 LVGL 实施以 [`LVGL-IMPLEMENTATION-ROADMAP.md`](./LVGL-IMPLEMENTATION-ROADMAP.md) 为唯一事实源。

## 目录

- [1. 结论](#1-结论)
- [2. 距离判断](#2-距离判断)
- [3. 能力阶梯](#3-能力阶梯)
- [4. 自动续跑规则](#4-自动续跑规则)
- [5. Agent 提示词](#5-agent-提示词)

## 1. 结论

QuickApp Kit 当前已经有**运行时骨架和最小主链**，但距离“大部分基础主流快应用可运行”还有多个 P0 能力的跨平台闭环，不能用已完成 Spec 数量代替兼容度。

正确安排是：启动一个长期 Code Agent，按能力阶梯连续编码；每个阶梯内部自测通过后自动进入下一个阶梯，只在真实架构冲突或环境不可用时记录阻塞，不等待架构师确认。

## 2. 距离判断

### 已具备

- 真实 RPK 加载和 JS 执行。
- C++ Core 唯一 Runtime Tree、事务和路由主链。
- LVGL/SDL 的首屏、点击、状态增量、条件节点、keyed Block 生命周期基础。
- Android/iOS 的基础 Surface、View/Text/Button Mount 和 click/Navigation 基础。
- Toolkit 对联盟 DSL 的基础编译和 RPK 输出。

### 还缺的 P0 闭环

- 同一多页、`if`、keyed `for`、状态 Fixture 三端复用。
- Image、Input 真实组件和事件。
- back/close/reveal、完整页面生命周期和失败恢复。
- 基础样式/布局矩阵的三端一致性。
- `system.router`、`system.prompt`、`system.device` 的三端结果语义。
- 资源失败、Mount 失败、unsupported、teardown 的稳定处理。

### 兼容范围

完成上述能力后，可以覆盖**基础内容、表单、列表、设置页、详情页、轻交互业务**等主流快应用子集；不等于联盟全量兼容。

网络、存储、权限、媒体、复杂手势、动画、复杂输入法和完整组件库属于后续能力，不应阻塞当前 V1 基础兼容闭环。

## 3. 能力阶梯

Agent 必须按以下顺序执行，完成一阶后立即进入下一阶。

| 阶梯 | 目标 | 通过标准 |
|---|---|---|
| L0 | 三端共享基线 | 同一 RPK 在 LVGL/SDL、Android、iOS 显示 Home/Detail，完成 Router、state、if、keyed for、click |
| L1 | 基础组件 | Image 包内资源、Input value/input/change/focus；旧组件不回归 |
| L2 | 页面和交互 | push/back/close/reveal、生命周期、基础失败恢复；三端语义一致 |
| L3 | 业务样式 | flex、尺寸、margin/padding、颜色、字号、圆角、文本测量和基础滚动容器 |
| L4 | 核心 Feature | router、prompt/toast、device 的 typed success/unsupported/failed/cleanup |
| L5 | 质量底线 | RPK 失败、组件缺失、Mount 失败、队列失败、teardown 资源归零；最小 Trace 和计数器 |
| L6 | 兼容扩展 | fetch、storage、更多组件、权限和媒体；进入 V1 后续或 V2 |

明早最低目标是 `L0`。如果 L0 提前通过，Agent 不停，继续 `L1 -> L2 -> L3 -> L4 -> L5`。

## 4. 自动续跑规则

### Agent 不得停止的情况

- 某个平台缺少现成入口：补齐最小入口或 Host Adapter。
- 某个组件缺少平台实现：按已有 Port 和 Mount 语义补齐。
- 测试或证据缺少：先用运行输出、退出码和截图完成最小验证。
- 需要选择两个等价实现：选择最小、可裁剪、与现有代码最一致的方案并继续。
- 单个平台暂时不可启动：完成 Host/Probe 构建和共享 Core 验证，继续其他平台，不等待人工确认。

### Agent 必须停止并记录的情况

- 需要改变唯一 Runtime Tree、Core Router、Bridge ABI 或线程所有权。
- 发现已有 RPK 语义与当前 Contract 不兼容且无法向后兼容。
- 需要引入第二套路由、第二棵树或平台旁路状态。
- 真实环境缺失导致无法执行任何代码验证。

### 每阶梯交付格式

只追加到 `INTEGRATION-HANDOFF.md`：

```text
阶梯与状态
修改项目
真实构建/运行命令
同一 RPK SHA-256
三端结果
下一阶梯已自动开始或真实阻塞
```

不新增专项 Spec，不新增大规模证据系统，不等待总架构逐阶审批。

## 5. Agent 提示词

```text
你现在是 QuickApp Kit V1 Basic Runtime 的长期连续 Code Agent。

总目标：让 QuickApp Kit 覆盖大部分基础主流快应用，而不是只完成几个演示 Case。

当前执行必须从 L0 开始，完成后自动继续 L1、L2、L3、L4、L5，不等待用户或架构师确认。完整规则在：

v3/v1-basic-runtime/CONTINUOUS-EXECUTION-PLAN-2026-08-23.md

L0 明早硬目标：
1. 用联盟 DSL 创建一个真实多页 Fixture：/pages/Home、/pages/Detail；
2. Home 包含 state、if、keyed for 列表、View/Text/Button 和 click；
3. click -> Core Event Router -> JS Handler -> state/router；
4. Home -> Detail 由 Core Router 完成；
5. Toolkit 生成一个唯一 RPK；
6. 同一 RPK 在 LVGL/SDL、Android、iOS 运行；
7. 三端页面、列表顺序、条件状态和路由结果一致。

L0 通过后，立即继续：
- L1：Image 包内资源、Input value/input/change/focus；
- L2：back/close/reveal、页面生命周期和失败恢复；
- L3：基础样式/布局矩阵和基础滚动容器；
- L4：router、prompt/toast、device typed Feature；
- L5：加载/Mount/队列失败、资源释放和最小观测。

执行约束：
- 不写新的 Spec，不等待校审，不停在 Contract ready 或 evidence ready；
- 不修改唯一 Runtime Tree、Core Router、Bridge ABI、线程所有权；
- 不创建平台私有状态管理、第二套路由或第二棵树；
- 三端优先复用同一 RPK、同一 Core、同一 JS Framework；
- 只做向后兼容的最小 Contract 扩展；
- Image/Input 不能阻塞 L0，但 L0 完成后必须继续 L1；
- 遇到普通实现缺口自行选择最小方案并继续；
- 只有真实架构冲突、不可兼容的公共合同冲突或环境完全不可用时才记录 BLOCKED。

验证方式：
- Toolkit 真实生成 RPK，禁止手写 Page IR/RenderTransaction/MountTransaction；
- 每阶梯运行旧 Case 001、CASE-002、BLOCK-001 回归；
- 每阶梯追加最小运行输出、RPK SHA-256、三端结果到 v3/v1-basic-runtime/INTEGRATION-HANDOFF.md；
- 有截图就保存截图，没有截图就保存可复现命令和退出码；
- 不为补证据而停止编码。

最终交付：能力阶梯状态表、真实 RPK、构建命令、三端运行结果、剩余真实阻塞。完成 L5 后再停，不继续扩展无关外围。
```
