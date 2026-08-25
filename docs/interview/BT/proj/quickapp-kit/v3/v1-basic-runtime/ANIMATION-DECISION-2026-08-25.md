# Animation Technical Decision

## 目录

- [1. 结论](#1-结论)
- [2. 事实](#2-事实)
- [3. 本质](#3-本质)
- [4. V1 范围](#4-v1-范围)
- [5. 后续范围](#5-后续范围)
- [6. 架构约束](#6-架构约束)
- [7. 验收](#7-验收)

## 1. 结论

联盟快应用通常提供动画能力，但动画不是 Feature，也不是平台旁路能力；它属于渲染管线中的时间变化能力。

QuickApp Kit 采用分阶段方案：

```text
V1 基础产品：跨平台交互反馈
V1.x：opacity / transform 的受控过渡
V2：CSS keyframes 和完整 system.animation
```

当前不因为动画扩展 Core 主架构，不阻塞基础 RPK、三端运行和核心组件验收。

## 2. 事实

本地联盟上游资料包含：

- CSS `transition`；
- CSS `animation` 和 `@keyframes`；
- `transform`；
- `system.animation` JS API。

当前 QuickApp Kit Toolkit 明确将以下能力标记为 `rejectedV1`：

- `animation`；
- `animation-name`；
- `@keyframes`；
- `@media`；
- CSS custom property。

因此当前 RPK 不应假装支持应用声明式动画。

## 3. 本质

动画的本质是：

```text
属性初值 + 属性终值 + 时间函数 + 当前单调时间
-> 当前视觉值
-> RenderTransaction
-> Platform Mount
```

它不应通过 JS 定时器反复修改状态实现，因为这会：

- 放大 JS/Core Bridge 通信量；
- 让动画依赖 JS 调度稳定性；
- 造成不同平台帧率和结果不一致；
- 把视觉时间轴错误地暴露为业务状态。

## 4. V1 范围

当前 V1 只做以下动效：

### 4.1 控件交互反馈

- Button/Input 的 pressed、focused、disabled 视觉状态；
- 统一状态颜色、透明度或轻微缩放反馈；
- 由 Platform Host 根据统一 Runtime 状态呈现；
- 不新增 JS API，不新增 Feature，不改变应用状态。

### 4.2 页面基础反馈

- 页面加载期间使用现有 `if` 状态节点显示 loading；
- Feature 请求期间使用现有状态渲染显示 pending/completed/failed；
- 不做复杂页面转场动画。

### 4.3 当前明确不做

- 应用 CSS `transition`；
- `@keyframes`；
- 任意属性逐帧动画；
- JS `requestAnimationFrame`；
- JS 定时器驱动视觉动画；
- 完整 `system.animation` API；
- 复杂手势和物理动画。

## 5. 后续范围

### V1.x：受控过渡

优先支持：

- `opacity`；
- `transform: translate/scale`；
- duration；
- delay；
- easing；
- cancel 和 teardown。

限制：

- 不驱动 Layout；
- 不改变 Runtime Tree 结构；
- 每帧只更新 RenderTransaction 的可动画属性；
- 受限帧率和节点数，适合嵌入式设备。

### V2：完整动画

再考虑：

- CSS `@keyframes`；
- animation iteration/direction/fill mode；
- `system.animation` 控制 API；
- pause/resume/reverse/finish/cancel；
- 动画事件回调；
- 多动画合成。

## 6. 架构约束

### Core

Core 负责：

- Animation Descriptor；
- 单调时间读取；
- 动画状态机；
- 当前帧值计算；
- 与 RenderTransaction 合并；
- Surface/Node teardown 时取消动画。

Yoga 继续在 Core 中负责布局。V1.x 的 `opacity/transform` 不触发重新布局；布局属性动画必须后置。

### JS Framework

V1 不提供动画业务 API。后续 JS Framework 只提交声明式动画意图，不在 JS 中运行逐帧循环。

### Platform

Platform 只消费 Core 计算的当前帧 RenderTransaction：

- Android Host；
- iOS Host；
- LVGL Host；
- 其他嵌入式 Host。

Platform 可以使用原生合成优化，但不能改变动画的语义、时长、取消和完成结果。

### EventLoop

动画需要时钟和帧唤醒，但不绑定 libuv：

```text
Core Animation Scheduler
-> EventLoop/FrameClock Port
   -> SDL/libuv
   -> Android Choreographer
   -> iOS DisplayLink
   -> RTOS/LVGL tick
```

## 7. 验收

V1 先验收：

- Button pressed/focused/disabled 三端有稳定视觉反馈；
- 反馈不改变 JS 状态和 Runtime Tree；
- 点击、路由、返回和 teardown 不受影响；
- Surface 销毁后无延迟回调和残留任务；
- LVGL、Android、iOS 的基础反馈语义一致。

V1.x 再验收：

- 相同 RPK 在三端的 duration、easing、终值一致；
- 中途 back 或 teardown 后动画立即取消；
- 动画不产生 JS 逐帧消息风暴；
- 动画节点和队列受嵌入式预算限制；
- 关闭动画能力后 Runtime 行为保持正确。
