# 复杂手势动画

> 面试核心问题：RN 动画为什么容易卡？怎么做到 60fps 不掉帧？

---

## 目录

- [一、手势动画是什么](#一手势动画是什么)
- [二、卡顿的根因](#二卡顿的根因)
- [三、如何解决：完整实操流程](#三如何解决完整实操流程)
  - [Step 1：依赖安装](#step-1依赖安装)
  - [Step 2：构建端配置](#step-2构建端配置)
  - [Step 3：App 入口配置](#step-3app-入口配置)
  - [Step 4：JS 侧编写（完整例子）](#step-4js-侧编写完整例子)
- [四、解决方案原理](#四解决方案原理)
- [五、手势 API 速查](#五手势-api-速查)
- [六、IoT App 典型场景](#六iot-app-典型场景)
- [七、手势冲突解决](#七手势冲突解决)
- [八、最佳实践](#八最佳实践)
- [九、Lottie vs Reanimated](#九lottie-vs-reanimated)

---

## 一、手势动画是什么

两步：
1. **监听手势**（Pan/Pinch/Rotate）→ 拿到坐标值（x/y/距离/角度）
2. **把这些值实时映射到 View 的 style 属性** → 产生"跟手"的视觉效果

```
手指拖拽卡片的例子：
  手指移了 150px → translationX = 150
  → 赋给 View 的 transform: [{ translateX: 150 }]
  → View 跟着手指移了 150px

  松手 → withSpring(0) 弹簧动画回到 0
  → View 弹性回弹到原位
```

**动画作用于哪些 style 属性？**

| 属性 | 对应手势 | 效果 | 性能 |
|------|---------|------|------|
| `transform: translateX/Y` | Pan（拖拽） | 移动 | ✅ GPU 合成层，不触发布局 |
| `transform: scale` | Pinch（捏合） | 缩放 | ✅ 同上 |
| `transform: rotate` | Rotate（旋转） | 旋转 | ✅ 同上 |
| `opacity` | 任意 | 透明度 | ✅ 同上 |
| `width/height` | Pan（拖边缘） | 尺寸变化 | ⚠️ 触发重新布局，慎用 |

**一句话**：手势给值，值驱动 transform/opacity → 视觉跟手。用 transform 不用 width/height，和 Web 里 CSS 动画同理。

---

## 二、卡顿的根因

**根因：动画计算跑在 JS 线程，和业务逻辑抢 16ms 帧预算。**

```
RN 默认的动画链路（PanResponder + Animated）：

  触摸事件 → Native UI 线程
    → 跨线程传递 → JS 线程（计算新位置）
    → 跨线程传递 → Native UI 线程（更新 View）

  一帧只有 16ms（60fps），JS 线程如果在忙别的事（渲染/接口回调/状态更新）：
    → 这一帧来不及算 → 掉帧 → 用户看到动画卡顿
```

**本质**：动画是 每帧都要算 的高频操作，放在同时处理业务逻辑的 JS 线程 = 必然竞争 → 掉帧。

**对比 Native App**：iOS/Android 原生动画全部在 UI 线程/渲染线程直接执行，没有跨线程开销，所以流畅。

---

## 三、如何解决：完整实操流程

**方案**：`react-native-gesture-handler` + `react-native-reanimated`

这两个库把手势识别和动画计算**都搬到 UI 线程**，完全绕过 JS 线程。

---

### Step 1：依赖安装

```bash
# 一个 npm 包 = JS API + Android Native + iOS Native（三合一）
yarn add react-native-gesture-handler react-native-reanimated

# iOS：触发 CocoaPods 编译 Native 代码
cd ios && pod install && cd ..

# Android：autolinking 自动处理，不需要额外操作
```

**这两个包是什么类型？**

RN 生态里的 npm 包分两类：

| 类型 | 含 Native 代码？ | 例子 |
|------|-----------------|------|
| 纯 JS 库 | ❌ | zustand、axios、lodash |
| **Native Module** | ✅ JS + Android + iOS | gesture-handler、reanimated、mmkv |

gesture-handler 和 reanimated 都是 **Native Module**（社区口语也叫**RN 插件**）。一个 npm 包里同时包含：

```
node_modules/react-native-reanimated/
├── src/              ← JS/TS 层 API（你 import 的东西）
├── android/          ← Android 原生代码（自动 link 进 Gradle）
├── ios/              ← iOS 原生代码（自动 link 进 Xcode/CocoaPods）
├── plugin/           ← Babel 插件（构建时提取 worklet）
└── *.podspec         ← iOS CocoaPods 配置
```

安装后 autolinking 机制自动把 Native 代码接入各平台构建系统。**使用时你只写 JS/TS，不需要写任何 Java/Kotlin/ObjC/Swift。**

---

### Step 2：构建端配置

Reanimated 需要 Babel 插件，**构建时**把 `'worklet'` 标记的函数提取出来，编译成可在 UI 线程执行的代码。

```javascript
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // ⚠️ 必须放在 plugins 数组最后一个
    'react-native-reanimated/plugin',
  ],
};
```

**为什么需要 Babel 插件？**
- 正常 JS 代码只能跑在 JS 线程
- Reanimated 的 Babel 插件在编译时把 `'worklet'` 函数**序列化**，运行时传给 UI 线程的独立 JS 运行时执行
- 没有这个插件 → worklet 不生效 → 动画还是跑 JS 线程 → 照样卡

---

### Step 3：App 入口配置

Gesture Handler 需要一个 Native 层的手势拦截根节点：

```tsx
// App.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 你的整个 App */}
    </GestureHandlerRootView>
  );
}
```

**为什么要包这一层？** 给 Native 层的手势识别器一个根 View，所有子 View 的触摸事件才能被 Native 拦截和识别。没有它 → 手势监听不生效。

---

### Step 4：JS 侧编写（完整例子）

**场景**：IoT App 设备亮度滑块 — 手指拖拽控制亮度，松手弹性归位。

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

function BrightnessSlider({ onBrightnessChange }) {
  // 1️⃣ 声明共享值（JS 线程和 UI 线程都能访问）
  const offsetX = useSharedValue(0);

  // 2️⃣ 声明手势：监听 Pan（拖拽）
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet'; // ← 标记：这段代码在 UI 线程执行
      // e.translationX = 手指相对起点的偏移（每帧给你最新值）
      // clamp 限制在 0~200 范围内
      offsetX.value = Math.max(0, Math.min(200, e.translationX));
    })
    .onEnd(() => {
      'worklet';
      // 松手后：把最终值回传给 JS 线程处理业务逻辑
      runOnJS(onBrightnessChange)(offsetX.value / 200); // 0~1 的比例
      // 可选：弹回原位
      // offsetX.value = withSpring(0);
    });

  // 3️⃣ 把共享值映射到 View style（也在 UI 线程执行）
  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }],
  }));

  // 4️⃣ 绑定：GestureDetector 包裹目标 View
  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.thumb, sliderStyle]} />
    </GestureDetector>
  );
}
```

**数据流**：

```
手指拖动
  → Native 层识别 Pan 手势（Gesture Handler）
  → 每帧回调 onUpdate（在 UI 线程执行，因为 'worklet'）
  → 更新 sharedValue（offsetX.value = ...）
  → useAnimatedStyle 响应变化，更新 View 的 transform（UI 线程直接操作）
  → View 跟手移动 ✅ 60fps

松手
  → onEnd 触发（UI 线程）
  → runOnJS 把结果回传 JS 线程
  → JS 线程发 BLE 指令给设备调亮度（业务逻辑）
```

**全程 JS 线程不参与动画计算 → 即使 JS 在处理接口回调/状态更新，动画也不掉帧。**

---

## 四、解决方案原理

### 为什么能绕过 JS 线程？

```
┌─────────────────────────────────────────────────────┐
│  UI Thread（Native 主线程）                          │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────────┐   │
│  │ Gesture Handler  │    │ Reanimated Runtime   │   │
│  │ Native 手势识别   │───→│ 轻量 JS 引擎         │   │
│  │ (MotionEvent /   │    │ (执行 worklet 函数)  │   │
│  │  UIGestureRec.)  │    │ (直接操作 View 属性) │   │
│  └──────────────────┘    └──────────────────────┘   │
│                                                      │
│  ← 全程在 UI Thread，不跨线程 →                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  JS Thread（业务线程）                                │
│  做自己的事：React 渲染、接口请求、状态更新…           │
│  完全不被动画打扰，动画也不被它阻塞                    │
└─────────────────────────────────────────────────────┘
```

### 各层职责

| 层 | 组件 | 做什么 |
|---|---|---|
| **构建时** | Reanimated Babel Plugin | 提取 `'worklet'` 函数，序列化为可跨线程传递的代码 |
| **Native 层** | Gesture Handler | 用平台原生 API 识别手势（Android MotionEvent / iOS UIGestureRecognizer） |
| **Native 层** | Reanimated Runtime | UI 线程上的轻量 JS 引擎，执行 worklet 函数 |
| **JS 层** | useSharedValue / useAnimatedStyle | 声明式 API，定义"值变了 → style 怎么变" |
| **JS 层** | runOnJS | worklet 里需要回到 JS 线程时的桥梁（处理业务逻辑） |

### Reanimated 在 Native 侧做了什么？

1. 在 UI 线程创建**独立的轻量 JS 运行时**（不是 App 主 Hermes 引擎，是另一个小的）
2. 接收 Babel 插件编译好的 worklet 代码，注入到这个运行时
3. worklet 执行结果直接操作 Native View 属性（setNativeProps），不走 JS 线程

### Reanimated 的 JS 引擎是自己带的吗？

**不是自己带的，是复用 App 已有的 Hermes 引擎，但创建了一个新的 Runtime 实例。**

```
App 里只有一个 JS 引擎二进制（Hermes .so / .framework）
但可以创建多个 Runtime 实例（类比：一个 V8 引擎可以创建多个 Isolate）

  Hermes 引擎（一个二进制）
    ├── Runtime 1：App JS 线程用（跑业务代码 + React）
    └── Runtime 2：UI 线程用（Reanimated 创建的，跑 worklet）
```

**具体过程**：
- Reanimated Native 模块启动时，调用 Hermes API 创建一个新的 `HermesRuntime` 实例
- 这个 Runtime 运行在 UI 线程（和 Runtime 1 在不同线程，互不阻塞）
- Runtime 2 非常轻量：不加载 React、不加载业务代码，只注入 worklet 需要的最小环境（sharedValue 访问器等）
- 内存开销很小（几百 KB），因为引擎二进制是共享的，只多了一份运行时状态

**为什么不自己带引擎？**
- 没必要：Hermes 本身支持多 Runtime 实例，API 现成
- 体积：如果额外带一个 JS 引擎（比如 QuickJS），包体会大几百 KB
- 兼容性：用同一个引擎，worklet 里的 JS 语法/行为和业务代码一致

### Worklet 运行时仍然是 JS，不是 Native 代码

**常见误解**：以为 worklet 被"编译成 Native 代码"了。实际不是。

```
❌ 错误理解：JS → 编译成 Kotlin/Swift 指令 → UI 线程执行 Native 代码
✅ 实际情况：JS → 序列化成字符串 → UI 线程的第二个 Hermes Runtime 解释执行 JS
```

**那为什么还能流畅 60fps？**

关键不在"是不是 JS"，而在**线程隔离 + 计算量极小**：

| | App JS 线程（Runtime 1） | UI 线程 Reanimated Runtime（Runtime 2） |
|---|---|---|
| 负载 | 重：React 渲染 + 网络回调 + 状态更新 + 业务逻辑 | 极轻：worklet 只做 `value = e.translationX` |
| 耗时 | 可能 > 16ms（掉帧） | 几微秒（远低于 16ms 帧预算） |
| 阻塞 | 业务忙了 → 动画帧丢 | worklet 瞬间完成 → 不可能掉帧 |

**一句话**：worklet 仍然是 JS 解释执行，但在独立线程的独立 Runtime 里跑，计算量微小（就几行加减法），所以等效于 Native 动画的流畅度。

### 和 iOS Core Animation / Android Animator 的对比

| | Native 动画 | Reanimated worklet |
|---|---|---|
| 执行形式 | 编译后的机器码 | JS 解释执行 |
| 线程 | UI 线程 / Render 线程 | UI 线程 |
| 性能 | 极致（纳秒级） | 极快（微秒级） |
| 实际体感 | 60fps | 60fps（worklet 计算量太小，差距不可感知） |

只有当 worklet 里做大量计算（循环/递归）时才会暴露 JS 解释执行的性能劣势。但正确用法下 worklet 只做简单赋值/插值，不构成瓶颈。

### Worklet 编译 + 注册 + 执行全流程

```
【构建时】Babel 插件
  源码：.onUpdate((e) => { 'worklet'; offsetX.value = e.translationX; })
  编译后：函数体序列化成字符串，挂在 __initData.code 上
  产物位置：就在同一个 JS bundle 里（不是单独文件）

【App 启动 - JS 线程加载 bundle】
  JS 线程执行到 worklet 工厂函数
  → 拿到 { hash, code字符串, closure引用 }
  → 通过 TurboModule 调用 Native：registerWorklet(hash, code)
  → 传给 UI 线程的 Reanimated Runtime

【Native 侧 - 注册阶段】
  UI 线程的 Hermes Runtime 2 收到代码字符串
  → 编译成可执行函数（类似 eval）
  → 存入注册表：{ hash → compiled_function }

【运行时 - 手势触发】
  Gesture Handler 识别到 Pan → 在 UI 线程查注册表
  → 用 hash 找到 compiled_function
  → 执行，传入事件参数 (e)
  → offsetX.value = ... → 直接写入 sharedValue（共享内存）
  → useAnimatedStyle 监听到变化 → 直接更新 Native View 属性
  → 全程不跨线程
```

### SharedValue 怎么跨线程共享？

`useSharedValue(0)` 底层是一块 **Native 共享内存**：

```
useSharedValue(0) 创建了：
  - JS 侧：一个 Proxy 对象（读写 .value 走 Native binding）
  - Native 侧：一块内存（UI 线程和 JS 线程都可直接读写）

worklet 里 offsetX.value = 150：
  → UI 线程直接写入共享内存（无锁，因为动画写入是单线程的）

JS 侧 console.log(offsetX.value)：
  → 从共享内存读取（如果需要的话）
```

不需要跨线程消息传递，就像两个线程读写同一个全局变量。

**一句话**：UI 线程有个专门跑动画的小 JS 引擎，和你的业务 JS 引擎互不干扰。

### 代码对比：优化前后

```typescript
// ❌ 优化前：PanResponder + Animated（JS 线程，会卡）
const pan = useRef(new Animated.ValueXY()).current;
const panResponder = PanResponder.create({
  onMoveShouldSetPanResponder: () => true,
  onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }]),
  // ↑ 每帧都在 JS 线程处理触摸事件 → JS 忙了就掉帧
  onPanResponderRelease: () => pan.flattenOffset(),
});
<Animated.View {...panResponder.panHandlers} style={pan.getLayout()} />
```

```typescript
// ✅ 优化后：Gesture Handler + Reanimated（UI 线程，流畅）
const offset = useSharedValue({ x: 0, y: 0 });
const gesture = Gesture.Pan().onUpdate((e) => {
  'worklet'; // ← 在 UI 线程执行
  offset.value = { x: e.translationX, y: e.translationY };
});
const style = useAnimatedStyle(() => ({
  transform: [{ translateX: offset.value.x }, { translateY: offset.value.y }],
}));
<GestureDetector gesture={gesture}>
  <Animated.View style={style} />
</GestureDetector>
```

---

## 五、手势 API 速查

### 手势类型

| 手势 | API | 回调参数 | 日常例子 |
|------|-----|---------|---------|
| 拖拽 | `Gesture.Pan()` | translationX/Y, velocityX/Y | 拖卡片/滑块 |
| 捏合 | `Gesture.Pinch()` | scale, focalX/Y | 缩放图片 |
| 旋转 | `Gesture.Rotation()` | rotation（弧度） | 旋转图片 |
| 点击 | `Gesture.Tap()` | x/y | 按钮 |
| 长按 | `Gesture.LongPress()` | x/y, duration | 长按弹菜单 |

### 手势生命周期

```typescript
Gesture.Pan()
  .onBegin((e) => {})     // 手指触碰（还没移动）
  .onStart((e) => {})     // 手势被识别（开始移动）
  .onUpdate((e) => {})    // 每帧更新（最高频，动画写这里）
  .onEnd((e) => {})       // 手指松开（业务逻辑写这里）
  .onFinalize((e) => {})  // 结束（无论成功/失败）
```

### Pressable vs Gesture Handler

| | Pressable（RN 内置） | Gesture Handler |
|---|---|---|
| 用途 | 按钮点击反馈 | 复杂手势（拖拽/缩放/旋转） |
| 线程 | JS 线程 | Native 层 → UI Thread |
| 适合 | 简单点击/按下态 | 需要 60fps 跟手的交互 |

---

## 六、IoT App 典型场景

| 场景 | 手势 | 难点 |
|------|------|------|
| 设备亮度/温度滑块 | Pan | 实时 UI + 松手弹性归位 + BLE 指令 |
| 设备列表拖拽排序 | LongPress + Pan | ScrollView 内嵌拖拽，手势冲突 |
| 色盘选色（智能灯） | Pan 在圆形区域 | 极坐标计算 + 实时颜色预览 |
| 卡片侧滑删除 | Pan 水平 | 根据滑动距离决定弹回/滑出 |
| 设备控制旋钮 | Rotation | 角度 → 数值映射 |

**手势动画 vs 预制动画**：
- 手势动画：每帧由手指位置实时驱动（交互式，Reanimated）
- 预制动画：设计师做好的，播放即可（Lottie）

---

## 七、手势冲突解决

最常见：ScrollView 里嵌套可拖拽元素。

```
问题：手指滑动 → 是"滚动列表"还是"拖拽卡片"？

声明式解决（Gesture Handler 的方式）：
```

| 策略 | API | 场景 |
|------|-----|------|
| 同时响应 | `Gesture.Simultaneous(gestureA, gestureB)` | 缩放+旋转同时 |
| 等待失败 | `gestureA.requireExternalPointFailure(gestureB)` | 长按后才能拖 |
| 方向区分 | `.activeOffsetX([-10, 10])` | 水平=拖拽，垂直=滚动 |
| 组合 | `Gesture.Race(gestureA, gestureB)` | 先识别的赢 |

不用命令式 if/else，声明式配置更清晰可维护。

---

## 八、最佳实践

1. **手势识别用 Gesture Handler，不用 PanResponder**（PanResponder 跑 JS 线程，会卡）
2. **动画计算放 worklet，不放 JS**（worklet 里只做简单数学：插值/坐标/边界）
3. **业务逻辑在手势结束后回 JS 线程**（`runOnJS` → 发 BLE 指令、更新状态）
4. **手势冲突用声明式**（Simultaneous / Race / requireExternalPointFailure）
5. **松手后动画用弹簧/衰减**（`withSpring()` 弹性回弹 / `withDecay()` 惯性衰减，也在 UI 线程）
6. **只动 transform + opacity**（GPU 合成层属性，不触发 Yoga 布局重算）

---

## 九、Lottie vs Reanimated

| | Lottie | Reanimated |
|---|--------|-----------|
| 用途 | 播放预制动画（设计师做好的） | 编程驱动的交互动画 |
| 输入 | AE 导出的 JSON | 代码逻辑（worklet） |
| 交互性 | 弱（播放/暂停） | 强（手势实时驱动） |
| 场景 | 加载动画、引导页、配网成功 | 滑块、拖拽、弹性、转场 |

IoT App 两个都用：Lottie 做配网成功动画，Reanimated 做设备控制交互。

---

## 面试话术

> "RN 动画卡的根因是动画计算跑在 JS 线程，和业务逻辑抢帧预算。解决方案是 Gesture Handler + Reanimated：手势识别下沉到 Native 层，动画计算通过 worklet 在 UI 线程的独立 JS 运行时执行，全程不经过 JS 线程。我在 IoT App 里用这套方案做设备控制滑块和拖拽排序，稳定 60fps。"

> 追问"worklet 怎么做到在 UI 线程跑的？"
> "Reanimated 的 Babel 插件在构建时把 worklet 函数序列化提取出来，运行时 Native 侧在 UI 线程有一个独立的轻量 JS 引擎（不是 App 的 Hermes），专门执行这些 worklet。执行结果直接操作 Native View 属性，不需要回 JS 线程。"
