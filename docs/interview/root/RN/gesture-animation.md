# 复杂手势动画

> 问题：RN 动画为什么容易卡？怎么做到 60fps 不掉帧？
> 方案：Gesture Handler + Reanimated 3，全程绕过 JS 线程

---

## 目录

- [一、本质问题](#一本质问题)
- [二、解决方案：Gesture Handler + Reanimated 3](#二解决方案gesture-handler--reanimated-3)
- [三、IoT App 典型场景](#三iot-app-典型场景)
- [四、手势冲突解决](#四手势冲突解决)
- [五、最佳实践原则](#五最佳实践原则)
- [六、Lottie vs Reanimated](#六lottie-vs-reanimated)

---

## 一、本质问题

RN 动画卡的根因：**动画计算跑在 JS 线程，和业务逻辑抢 16ms 帧预算。**

```
普通 RN 动画：
  手势事件 → JS 线程计算新位置 → 跨线程通信 → UI 线程更新 View
  JS 线程忙了 → 这一帧丢了 → 掉帧

Reanimated worklet：
  手势事件 → UI 线程直接执行 worklet 计算 → 直接更新 View
  JS 线程忙不忙都不影响 → 稳定 60fps
```

---

## 二、解决方案：Gesture Handler + Reanimated 3

```
Gesture Handler：识别手势（Native 层，不过 JS）
Reanimated 3：驱动动画（worklet 在 UI 线程，不过 JS）
配合：手势事件直接驱动 worklet → 全程不经过 JS 线程
```

### Reanimated 3 是什么

第三方动画库（Software Mansion），替代 RN 自带 Animated API。核心能力：**worklet**——一段函数被编译后直接在 UI 线程执行。

本质是一个编译器 + 运行时：构建时提取 worklet 函数，运行时在 UI 线程独立执行。

### Gesture Handler 是什么

第三方手势库，把手势识别从 JS 线程移到 Native 层。支持声明式手势冲突解决。

---

## 三、IoT App 典型场景

| 场景 | 手势 | 难点 |
|------|------|------|
| 设备亮度/温度滑块 | Pan（拖拽） | 实时更新 UI + 松手弹性归位 |
| 设备列表拖拽排序 | LongPress + Pan | ScrollView 内嵌拖拽，手势冲突 |
| 下拉刷新 | Pan + 弹性回弹 | 和列表滚动冲突 |
| 色盘选色（智能灯） | Pan 在圆形区域 | 极坐标计算 + 实时颜色预览 |
| 卡片侧滑删除 | Pan 水平 | 根据滑动距离决定弹回/滑出 |

**手势动画 vs 预制动画**：
- 手势动画：每一帧由手指位置实时决定（交互驱动）
- 预制动画（Lottie）：设计师做好的，播放即可（无交互）

---

## 四、手势冲突解决

最常见：ScrollView 里嵌套可拖拽元素

```
问题：手指滑动，是"滚动列表"还是"拖拽卡片"？

声明式解决（Gesture Handler）：
- simultaneousHandlers：两个手势可以同时响应
- waitFor：A 手势要等 B 失败后才激活
- 方向区分：垂直 = 列表滚动，水平 = 拖拽卡片
- 激活条件：LongPress 后才允许 Pan（长按才能拖拽）
```

不用命令式 if/else，声明式配置更清晰可维护。

---

## 五、最佳实践原则

1. **手势识别用 Gesture Handler，不用 PanResponder**（PanResponder 跑 JS 线程，会卡）
2. **动画计算放 worklet，不放 JS**（worklet 里只做简单数学：插值/坐标/边界）
3. **业务逻辑在手势结束后回 JS 线程**（发 BLE 指令、更新状态等重操作）
4. **手势冲突用声明式**（simultaneousHandlers / waitFor）
5. **松手后动画用弹簧/衰减**（`withSpring()` 弹性回弹 / `withDecay()` 惯性衰减，也在 UI 线程）

**一句话**：手势识别和动画计算全部绕过 JS 线程，JS 只在手势结束后处理业务逻辑。

---

## 六、Lottie vs Reanimated

| | Lottie | Reanimated |
|---|--------|-----------|
| 用途 | 播放预制动画（设计师做好的） | 编程驱动的交互动画 |
| 输入 | AE 导出的 JSON | 代码逻辑（worklet） |
| 交互性 | 弱（播放/暂停） | 强（手势实时驱动） |
| 场景 | 加载动画、引导页、图标 | 滑块、拖拽、弹性、转场 |

IoT App 两个都用：Lottie 做配网成功动画，Reanimated 做设备控制交互。

---

## 七、和已有经验的关联

弹窗治理（多弹窗时机冲突 → 优先级队列调度）和手势冲突本质是同一个问题：**多个行为竞争同一个输入，需要调度策略**。弹窗是时间维度冲突，手势是空间维度冲突。
