# 手势动画性能

> 问题：手势拖拽/动画不跟手、掉帧
>
> 本质：动画计算在 JS 线程，和业务逻辑抢 16ms 帧预算
>
> 方案：Gesture Handler + Reanimated，全程绕过 JS 线程
>
> 详细文档：[gesture-animation.md](../../RN/gesture-animation.md)

---

## 目录

- [如何分析](#如何分析)
- [如何优化](#如何优化)
  - [RN/JS 层](#rnjs-层)
  - [Native 层](#native-层)
  - [C++ 层](#c-层)

---

## 如何分析

| 工具 | 看什么 |
|------|--------|
| Performance Monitor | 拖拽时 JS 帧率是否掉（掉了 = 动画在 JS 线程） |
| Perfetto | UI Thread 是否有长帧（动画计算耗时） |

---

## 如何优化

### RN/JS 层

| 手段 | 做什么 |
|------|--------|
| **Reanimated worklet** | 动画计算在 UI 线程执行（`'worklet'` 标记） |
| **Gesture Handler** | 手势识别在 Native 层（不过 JS） |
| **useAnimatedStyle** | 动画值直接驱动 View style |
| **withSpring / withDecay** | 松手后物理动画（也在 UI 线程） |

### Native 层

| 手段 | 做什么 |
|------|--------|
| Reanimated Native 运行时 | UI 线程上的独立 JS 引擎执行 worklet |
| Gesture Handler Native 识别器 | Android MotionEvent / iOS UIGestureRecognizer |

### C++ 层

0.85 新动画后端：Reanimated 核心合入 RN，动画更新和 Fabric 渲染管线深度集成。

```
优化前：触摸 → JS 识别手势 → JS 算动画 → 跨线程 → UI 更新（每帧两次跨线程）
优化后：触摸 → Native 识别手势 → worklet 算动画 → 直接更新 View（全程 UI Thread）
```

→ 详见 [gesture-animation.md](../../RN/gesture-animation.md)
