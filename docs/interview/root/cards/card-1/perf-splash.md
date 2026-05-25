# 启动性能与 Splash 优化

> 问题：用户点击图标到看到可交互首屏，这段时间怎么缩短 + 怎么让用户感知不到等待？
> 本质：真的快（减少启动耗时）+ 感知快（Splash 遮挡等待 + 骨架屏过渡）

---

## 目录

- [一、启动全链路](#一启动全链路)
- [二、Splash 是什么](#二splash-是什么)
- [三、Splash 期间做什么（并行化）](#三splash-期间做什么并行化)
- [四、Splash 消失时机](#四splash-消失时机)
- [五、启动速度优化手段](#五启动速度优化手段)
- [六、体验优化（感知快）](#六体验优化感知快)
- [七、RN 实现](#七rn-实现)

---

## 一、启动全链路

```
用户点击图标
  → 系统创建进程（~100ms）
  → Native Splash 立刻显示（系统级，零延迟，用户不会看到白屏）
  → Application.onCreate()（Native 初始化）
  → Bundle 加载（Hermes 加载 .hbc）
  → JS 执行（AppRegistry.runApplication）
  → 首屏渲染（React 组件 → Native View）
  → 首屏可交互（TTI）
  → SplashScreen.hide()
```

**度量**：`adb shell am start -W` 输出 TotalTime = 点击到首屏可交互的时间。

---

## 二、Splash 是什么

**Splash = 启动屏**，用户点击图标后立刻看到的品牌画面（Logo + 背景色）。

- **Native 层控制**（不是 RN 渲染的），在 JS Bundle 加载之前就显示
- Android：`windowBackground` 主题 / Android 12+ SplashScreen API
- iOS：`LaunchScreen.storyboard`
- RN 库：`react-native-splash-screen`

**为什么需要 Splash？** 没有 Splash → 用户点击后看到白屏 1-2 秒 → 感觉"卡了"。有 Splash → 用户看到品牌画面 → 感觉"在启动"。

---

## 三、Splash 期间做什么（并行化）

**核心思想**：Splash 停留的时间不是浪费，是并行做前置任务的窗口。

```
优化前（串行）：
  Splash → Native 初始化 → Bundle 加载 → JS 执行 → 请求数据 → 渲染 → Splash 消失
  总时间：3-4 秒

优化后（并行）：
  Splash → Native 初始化 ─┐
         → Bundle 加载 ───┤ 并行
         → JS 就绪 ───────┘
              → 立即并行：请求数据 + BLE 初始化 + 预加载图片
              → 全部完成 → Splash 消失 → 首屏直接展示内容
  总时间：1.5-2 秒
```

| 阶段 | 做什么 | 谁做 |
|------|--------|------|
| Native 初始化时 | SDK 初始化（Firebase/Sentry/MMKV）、BLE 适配器 | Native 层 |
| JS 就绪后 | 请求用户信息、设备列表、BLE 扫描、预加载图片 | JS 层（任务管理器） |
| 全部完成 | `SplashScreen.hide()` → 首屏直接展示 | JS 层 |

---

## 四、Splash 消失时机

**不是"给固定时间"，是"前置任务做完就消失"**：

| 策略 | 做法 | 效果 |
|------|------|------|
| ✅ 数据就绪后消失 | 等 Promise.all 完成再 hide | 首屏无 loading |
| ⚠️ 超时兜底 | 最多等 3 秒，超时强制消失 → 骨架屏 | 不让用户等太久 |
| ❌ 固定时间消失 | setTimeout(2000) 后 hide | 可能数据还没来 → 还有 loading |

```typescript
// 推荐：数据就绪 + 超时兜底
const MAX_SPLASH_TIME = 3000;

function App() {
  const { ready } = useAppInit();
  const [timeout, setTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimeout(true), MAX_SPLASH_TIME);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready || timeout) SplashScreen.hide();
  }, [ready, timeout]);

  if (!ready) return <SkeletonHome />;  // 超时后显示骨架屏
  return <MainNavigator />;
}
```

---

## 五、启动速度优化手段

| 手段 | 优化什么阶段 | 效果 |
|------|-------------|------|
| **Hermes AOT** | Bundle 加载（跳过 JS 解析） | 启动快 30-50% |
| **TurboModule 懒加载** | Native 初始化（不全量注册） | 减少 Application.onCreate 耗时 |
| **首屏最小化** | JS 执行（减少顶层 import） | 只执行首屏需要的代码 |
| **SDK 延迟初始化** | Native 初始化 | 非必要 SDK 延迟到首屏后 |
| **Splash 期间并行** | 数据请求 | 利用等待时间预加载数据 |
| **容器预热** | RN 实例创建 | 提前创建 ReactInstanceManager |

---

## 六、体验优化（感知快）

| 问题 | 方案 | 效果 |
|------|------|------|
| Splash 消失后还有 loading | 统一初始化管理器，Splash 期间完成数据加载 | 首屏无 loading |
| Splash 消失后布局跳动 | Splash → 骨架屏 → 内容（三段式） | 无跳动 |
| Splash 和首屏割裂感 | Splash 背景色 = 首屏背景色 | 视觉连续 |
| 多个 loading 闪烁 | 任务管理器统一编排 | 一次性就绪 |

---

## 七、RN 实现

```typescript
// 1. 安装
// yarn add react-native-splash-screen

// 2. Android 侧：MainActivity.kt
import org.devio.rn.splashscreen.SplashScreen

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreen.show(this)  // 显示 Splash
    super.onCreate(savedInstanceState)
  }
}

// 3. JS 侧：控制消失时机
import SplashScreen from 'react-native-splash-screen';

function App() {
  const { ready } = useAppInit();  // 统一初始化管理器

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;  // Splash 还在显示
  return <MainNavigator />;
}
```

---

## 概念速查

| 概念 | 一句话 |
|------|--------|
| Splash | 启动屏，Native 层控制，JS 加载前就显示 |
| TTI | Time To Interactive，首屏可交互时间 |
| Hermes AOT | 构建时编译 JS 为字节码，跳过运行时解析 |
| TurboModule 懒加载 | 用到才初始化 Native Module，不全量注册 |
| 首屏最小化 | 只 import 首屏需要的模块，其他延迟 |
| 三段式 | Splash → 骨架屏 → 内容，视觉无缝衔接 |
| 任务管理器 | 统一编排多个异步初始化任务，一次性就绪 |
