# RN JS 线程阻塞

> JS 单线程是 RN 性能/稳定性问题的最大根因。

## 目录

- [1. 为什么 JS 阻塞是根因](#1-为什么-js-阻塞是根因)
- [2. JS 阻塞和白屏的关系](#2-js-阻塞和白屏的关系)
- [3. 解决手段](#3-解决手段)
- [QA](#qa)

---

## 1. 为什么 JS 阻塞是根因

RN 的 JS Thread 是单线程，所有逻辑（React 渲染、事件处理、网络回调、动画计算）都在这一条线上排队。一旦阻塞：

| 表现 | 机制 |
|------|------|
| 掉帧/卡顿 | JS 线程忙 → 这一帧的 React diff 做不完 → UI 更新指令发不出去 |
| 手势不跟手 | 触摸事件排队等着 JS 处理 |
| 白屏 | 组件 render 排队等着 → 首屏内容迟迟出不来 |
| ANR（Android） | JS 线程卡死导致 Bridge 消息堆积 → Native UI 线程也被拖住 |

---

## 2. JS 阻塞和白屏的关系

JS 阻塞是白屏的**原因之一**（[根因表第④条](./perf-whitescreen-rn.md#3-根因与优化)），但不是唯一原因。

```
JS 线程被长任务占满
  → React render() 排不上队
  → 首屏组件迟迟不 mount
  → 用户看到白屏
  → Native 侧 5s 检测：childCount == 0，但没有 JS Error
```

**区分特征**：其他白屏原因（JS Error、Bundle 加载失败）有明确错误信号；JS 阻塞型白屏的特征是"没有报错但就是白"——Native 检测到白屏，ErrorBoundary 没触发，Sentry 没有异常堆栈。

---

## 3. 解决手段

三条路：**移出去**（Native/UI 线程）、**少做**（memo/虚拟化/懒加载）、**分着做**（分片/延迟）。

| 思路 | 手段 | 原理 | 是否手动 |
|------|------|------|---------|
| **把活移出 JS 线程(native用别的线程处理)** | TurboModule / JSI 调 Native | 重计算（加密/图片处理/排序）交给 Native 线程做 | 手动 |
| | Reanimated worklet | 动画逻辑跑在 UI 线程，JS 阻塞不影响动画 | 手动 |
| **减少 JS 工作量(React使用层面优化,避免重复渲染)** | useMemo / useCallback / React.memo | 避免无意义重渲染 | 手动 |
| | 列表虚拟化（FlashList） | 只渲染可见区域，减少组件数量 | 手动 |
| | 懒加载（lazy + Suspense） | 首屏不需要的模块延迟加载，减少初始 JS 执行量 | 手动 |
| **分时让出线程(js长任务分片)** | 任务分片（setTimeout / rAF） | 大任务拆成小块，每帧做一块，中间让渲染 | 手动 |
| | [InteractionManager.runAfterInteractions](#注释interactionmanager) | 转场动画结束后再跑重任务 | 手动 |
| **架构层面** | Hermes 预编译字节码 | 减少 JS 解析时间，减轻启动阶段占用 | 默认开启 |
| | 新架构 Fabric 并发渲染 | React 18 可中断渲染——长任务可被高优先级更新打断 | 默认开启 |

---

## QA

---

# 注释

<a id="注释interactionmanager"></a>
### InteractionManager.runAfterInteractions

本质是往 JS 事件循环注册一个宏任务，但触发时机不是"下一帧"——而是等 Native 动画结束后才 resolve。

```
用户点击跳转 → 转场动画开始（Native 标记为 interaction）
  → 动画结束 → Native 通知 JS → Promise resolve
  → 你注册的回调在下一个宏任务中执行
```

和 React 渲染周期无关——它等的是"Native 动画结束"这个信号，不是"React commit 完成"。

底层实现：Promise 队列 + `setImmediate` 调度。

> React 并发渲染（Fiber）的时间切片也类似：把一次大渲染拆成多个小宏任务（每 5ms yield）, 每个注册到宏任务队列去执行，中间让(其实不是主动让, 而是渲染分片在每一个宏任务, 不会以长任务的形式长时间阻塞主线程)出线程给 UI/事件处理。
