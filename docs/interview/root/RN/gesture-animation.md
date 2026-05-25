# 复杂手势动画

> 问题：RN 动画为什么容易卡？怎么做到 60fps 不掉帧？
> 方案：Gesture Handler + Reanimated 3，全程绕过 JS 线程

---

## 目录

- [一、本质问题](#一本质问题)
  - [手势动画到底在做什么？](#手势动画到底在做什么)
  - [为什么 RN 动画容易卡？](#为什么-rn-动画容易卡)
- [二、解决方案：Gesture Handler + Reanimated 3](#二解决方案gesture-handler--reanimated-3)
- [三、IoT App 典型场景](#三iot-app-典型场景)
- [四、手势冲突解决](#四手势冲突解决)
- [五、最佳实践原则](#五最佳实践原则)
- [六、Lottie vs Reanimated](#六lottie-vs-reanimated)

---

## 一、本质问题

### 手势动画到底在做什么？

两步：
1. **监听手势**（Pan/Pinch/Rotate）→ 拿到手势类型 + x/y 坐标（或距离/角度）
2. **把这些值实时映射到 View 的 style 属性** → 产生"跟手"的视觉效果

**动画效果作用于 View 的 style 属性**，核心就这几个：

| 属性 | 对应手势 | 效果 | 为什么性能好 |
|------|---------|------|-------------|
| `transform: translateX/Y` | Pan（拖拽） | 元素跟手移动 | GPU 合成层，不触发布局 |
| `transform: scale` | Pinch（捏合） | 放大缩小 | 同上 |
| `transform: rotate` | Rotate（旋转） | 旋转 | 同上 |
| `opacity` | 任意 | 淡入淡出/按下变暗 | GPU 合成层 |
| `width/height` | Pan（拖拽边缘） | 拉伸/收缩 | ⚠️ 触发重新布局，慎用 |

**一句话本质**：手势给坐标值，动画把坐标值实时映射到 View 的 transform/opacity → 视觉上"跟手"。

**具体例子：手指拖拽一个卡片**

```
拖拽中：手势给你 translationX = 150（手指移了 150px）
       → 你把这个值赋给 View 的 transform: [{ translateX: 150 }]
       → View 就跟着手指移动了 150px

松手后：withSpring(0) — 用弹簧动画把 translateX 从 150 回到 0
       → View 弹性回弹到原位
```

整个过程就是：手势产生数值 → 数值驱动 style 属性 → 视觉跟手。松手后用物理动画（弹簧/衰减）让值回归 → 自然的回弹效果。

**为什么最常用 transform + opacity？** 因为它们是 GPU 合成层属性，不触发重新布局（和 Web 里 CSS transform 一样的道理）。改 width/height 会触发 Yoga 重新算布局 → 性能差。

### 为什么 RN 动画容易卡？

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

第三方手势库（Software Mansion），把手势识别从 JS 线程移到 Native 层。支持声明式手势冲突解决。

**分层**：JS API + Native 运行时的混合库。
- 你写代码的地方：JS/TS 层（`Gesture.Pan().onUpdate(...)` 是 JS 代码）
- 手势识别执行的地方：Native 层（Android `MotionEvent` / iOS `UIGestureRecognizer`）
- worklet 回调执行的地方：UI Thread（Native 层的独立 JS 运行时）

= API 在 JS 写，执行在 Native 跑（和 native-stack 同一个模式）。

### 手势类型

| 手势 | 英文 | 动作 | 日常例子 |
|------|------|------|---------|
| **Pan** | 平移/拖拽 | 手指按住拖动 | 拖拽卡片/滑块 |
| **Pinch** | 捏合 | 两指捏合/张开 | 缩放图片 |
| **Rotate** | 旋转 | 两指旋转 | 旋转图片 |
| **Tap** | 点击 | 手指点一下 | 按钮点击 |
| **LongPress** | 长按 | 手指按住不动 | 长按弹菜单 |

### 手势生命周期事件

```typescript
Gesture.Pan()
  .onBegin((e) => {})     // 手指触碰屏幕（还没移动）
  .onStart((e) => {})     // 手势被识别（开始移动了）
  .onUpdate((e) => {})    // 每帧更新（移动中，最高频）
  .onEnd((e) => {})       // 手指松开
  .onFinalize((e) => {})  // 手势结束（无论成功还是失败）
```

### 每种手势回调传递的信息

| 手势 | 回调参数 | 含义 |
|------|---------|------|
| Pan | `translationX/Y`（偏移）, `velocityX/Y`（速度）, `absoluteX/Y`（绝对坐标） | 移了多远、多快 |
| Pinch | `scale`（缩放比）, `focalX/Y`（捏合中心点） | 放大了多少倍 |
| Rotate | `rotation`（弧度） | 转了多少度 |
| Tap | `x/y`（点击坐标） | 点在哪里 |
| LongPress | `x/y`, `duration`（按了多久） | 按在哪里、按了多久 |

### Pressable vs Gesture Handler

| | Pressable（RN 内置） | Gesture Handler |
|---|---|---|
| 用途 | 按钮/卡片的点击反馈 | 复杂手势（拖拽/缩放/旋转） |
| 事件 | onPressIn / onPress / onPressOut | onBegin / onStart / onUpdate / onEnd |
| 线程 | JS 线程 | Native 层（UI Thread） |
| 适合 | 简单点击/按下态 | 需要 60fps 跟手的交互 |

### 安装：为什么 Native 层必须安装？

这两个库都是 **"JS API + Native 运行时"的混合库**，不是纯 JS 库，所以必须 rebuild Native。

```bash
# 安装（两端通用）
yarn add react-native-reanimated react-native-gesture-handler

# iOS：pod install
cd ios && pod install

# Android：autolinking 自动处理，不需要额外 Native 配置

# babel.config.js 必须加插件（构建时提取 worklet 函数）：
plugins: ['react-native-reanimated/plugin']
```

**为什么不能纯 JS？**

| 库 | Native 层做了什么 | 为什么必须 Native |
|---|---|---|
| Reanimated | 在 UI 线程创建独立的轻量 JS 运行时，执行 worklet | worklet 要在 UI 线程跑，JS 线程做不到 |
| Gesture Handler | 用 Native 手势识别器（Android `MotionEvent` / iOS `UIGestureRecognizer`） | 手势识别必须在 Native UI 层，JS 拿不到原始触摸流 |

**Reanimated Native 侧的三件事**：
1. 创建 UI 线程上的轻量 JS 运行时（执行 worklet 代码）
2. 接收 Babel 插件提取出的 worklet 函数并在 UI 线程执行
3. 直接操作 Native View 属性（不回 JS 线程）

**一句话**：worklet 能在 UI 线程跑，是因为 Native 侧有一个独立的小型 JS 引擎在 UI 线程等着执行它。

### 使用时需要写 Native 代码吗？

**不需要。** 使用时全部在 JS/TS 侧写代码。

```
安装时：库的 Native 代码自动 link 进你的 App（一次性，pod install / autolinking）
使用时：你只写 JS/TS（useSharedValue / useAnimatedStyle / Gesture.Pan() 等）
运行时：库的 Native 运行时自动把你的 worklet 调度到 UI 线程执行
```

Native 侧的代码是**库自带的**，安装时自动集成，你不需要写任何 Java/Kotlin/ObjC/Swift。

唯一需要动 Native 的地方：App 根组件包一层 `GestureHandlerRootView`（一次性模板代码）：

```tsx
// App.tsx 根组件
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 你的 App 内容 */}
    </GestureHandlerRootView>
  );
}
```

本质：给 Gesture Handler 一个 Native 层的手势拦截根节点，所有子 View 的手势才能被 Native 识别器捕获。

**类比**：就像用 `react-native-maps`，pod install 把 Native 地图 SDK 集成进来，但使用时你只写 `<MapView />` 的 JSX。

### 手势监听怎么写？（声明式 API）

```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

// 1. 声明手势：监听什么 + 每帧拿到什么
const offsetX = useSharedValue(0);

const panGesture = Gesture.Pan()
  .onUpdate((e) => {
    'worklet';
    // e.translationX — 手指相对起点的偏移（每帧都给你最新值）
    offsetX.value = e.translationX;
  })
  .onEnd(() => {
    'worklet';
    // 松手后弹回原位
    offsetX.value = withSpring(0);
  });

// 2. 把手势值映射到 View style
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: offsetX.value }],
}));

// 3. 绑定到 View：用 GestureDetector 包裹目标 View
<GestureDetector gesture={panGesture}>
  <Animated.View style={animatedStyle} />
</GestureDetector>
```

**模式**：`Gesture.XXX()` 声明手势类型 → `.onUpdate(callback)` 每帧回调拿坐标 → 赋值给 sharedValue → `useAnimatedStyle` 映射到 style → `GestureDetector` 绑定到 View。

**常用手势类型**：

| API | 监听什么 | 回调给你什么 |
|-----|---------|------------|
| `Gesture.Pan()` | 拖拽 | translationX/Y, velocityX/Y |
| `Gesture.Pinch()` | 捏合 | scale, focalX/Y |
| `Gesture.Rotation()` | 旋转 | rotation（弧度） |
| `Gesture.Tap()` | 点击 | x/y 坐标 |
| `Gesture.LongPress()` | 长按 | x/y 坐标, duration |

**一句话**：声明你要监听什么手势 → 库在 Native 层识别 → 每帧把数值回调给你的 worklet → 你映射到 style → View 跟手。

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

---

## 八、代码对比：优化前后

```typescript
// ❌ 优化前：PanResponder（每帧触摸事件都传到 JS 线程 → 卡）
const pan = useRef(new Animated.ValueXY()).current;
const panResponder = PanResponder.create({
  onMoveShouldSetPanResponder: () => true,
  // 每帧都在 JS 线程算新位置 → JS 忙了就掉帧
  onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }]),
  onPanResponderRelease: () => pan.flattenOffset(),
});
<Animated.View {...panResponder.panHandlers} style={pan.getLayout()} />
```

```typescript
// ✅ 优化后：Gesture Handler + Reanimated（全程 UI 线程 → 流畅）
const offset = useSharedValue({ x: 0, y: 0 });

// 手势识别在 Native 层，不过 JS
const gesture = Gesture.Pan().onUpdate((e) => {
  'worklet'; // 标记：这段代码在 UI 线程执行，不在 JS 线程
  offset.value = { x: e.translationX, y: e.translationY };
});

// 动画值变化直接驱动 View 属性，不过 JS
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: offset.value.x }, { translateY: offset.value.y }],
}));

<GestureDetector gesture={gesture}>
  <Animated.View style={animatedStyle} />
</GestureDetector>
```

**区别**：前者每帧在 JS 线程执行 `onPanResponderMove`；后者 `'worklet'` 标记的函数在 UI 线程执行，JS 线程完全不参与。
