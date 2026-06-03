# 启动性能与 Splash 优化

> 问题：用户点击图标到看到可交互首屏，这段时间怎么缩短 + 怎么让用户感知不到等待？
> 
> 本质：真的快（减少启动耗时）+ 感知快（Splash 遮挡等待 + 骨架屏过渡）

---

## 最佳实践（结论）

```
首屏优化 = 减少耗时 + 感知优化

减少耗时（真的快）：
  1. Native 层：自定义控制 Splash 阶段，多线程并行（预请求 + BLE 初始化 + Bundle 加载同时进行）
  2. 构建层：DDD 拆分首屏 Bundle，最小化原则（加载的代码量越少 → 越快）
  3. 构建层：Hermes AOT 预编译（跳过运行时解析）
  4. Native 层：TurboModule 懒加载（不全量注册）

感知优化（觉得快）：
  5. Splash 遮挡等待（数据就绪后才消失）
  6. 骨架屏过渡（RN 层做，Splash 消失后数据还没来时）
  7. 收敛多个 loading（统一初始化管理器）
  8. Native 预请求拦截层（JS 正常请求 → Native 拦截返回缓存，零侵入）
```

---

## 目录

- [最佳实践（结论）](#最佳实践结论)
- [一、启动全链路](#一启动全链路)
  - [Splash 阶段加载的是什么 Bundle？](#splash-阶段加载的是什么-bundle)
- [二、Splash 是什么](#二splash-是什么)
  - [windowBackground 配置在哪？](#windowbackground-配置在哪)
  - [react-native-splash-screen 做什么？](#react-native-splash-screen-做什么)
- [三、Splash 期间做什么（并行化）](#三splash-期间做什么并行化)
- [四、Splash 消失时机](#四splash-消失时机)
- [五、启动速度优化手段](#五启动速度优化手段)
- [六、体验优化（感知快）](#六体验优化感知快)
- [七、Splash 代码实现（RN + Native）](#七splash-代码实现rn--native)
- [概念速查](#概念速查)
- [八、首屏优化最佳实践](#八首屏优化最佳实践)
  - [总结](#总结)
  - [按阶段的最佳实践](#按阶段的最佳实践)
  - [注释：概念澄清](#注释概念澄清)
- [九、XRN 方案：Native 层自定义 Splash 阶段](#九xrn-方案native-层自定义-splash-阶段)
  - [和默认 RN 的区别](#和默认-rn-的区别)
  - [Splash 期间能做的事](#splash-期间能做的事)
  - [关键优化：Native 预请求](#关键优化native-预请求)
  - [实现方式：Native 拦截层（零侵入）](#实现方式native-拦截层零侵入)

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

### Splash 阶段加载的是什么 Bundle？

**默认（单 Bundle）**：RN 运行时 JS + 业务代码打在同一个文件里，Splash 阶段加载这一个文件。

```
index.bundle（一个文件）：
  ├── React 源码
  ├── React Native 运行时 JS
  ├── 第三方库 JS（Navigation/Zustand/Reanimated）
  └── 业务代码（screens/components/hooks）
```

Metro 从入口文件（`index.js`）递归解析所有 import → 全部打成一个文件，不区分框架和业务。

**多 Bundle（CRN/XRN）**：拆开后 Splash 阶段只加载 common + 首屏：

```
common.bundle：React + RN 运行时 + 框架库
home.bundle：首页业务代码
→ Splash 阶段加载这两个，其他 Bundle 按需加载
```

**度量**：

```bash
adb shell am start -W com.myapp/.MainActivity

# 输出示例
LaunchState: COLD          # COLD=冷启动 / WARM=温启动 / HOT=热启动
TotalTime: 1523            # Native Activity 首帧绘制完成（ms）
```

**TotalTime vs FCP vs TTI（三个不同的指标）**：

| 指标 | end 点 | 含义 | 怎么测 |
|------|--------|------|--------|
| **TotalTime** | Activity 首帧绘制完 | Native 壳准备好了（但 RN 内容可能还没出来） | `adb shell am start -W` |
| **FCP** | 首屏第一个有意义的内容出现 | 用户看到真实内容了 | 自定义打点（首个组件 onLayout） |
| **TTI** | 首屏渲染完 + 可响应交互 | 用户可以点击/滑动了 | 自定义打点（JS 标记"就绪"） |

```
时间线：TotalTime < FCP < TTI

TotalTime：Native Activity 画出第一帧（可能只是空的 ReactRootView）
FCP：RN 首屏组件渲染出来了（用户看到内容）
TTI：所有事件绑定完，用户可以交互

对 RN App：TotalTime 测的是"Native 壳好了"，不是"RN 内容出来了"。
真正有意义的是 TTI（目标 < 2s），需要 JS 侧自定义打点。
```

---

## 二、Splash 是什么

**Splash = 启动屏**，用户点击图标后立刻看到的品牌画面（Logo + 背景色）。

- **Native 层控制**（不是 RN 渲染的），在 JS Bundle 加载之前就显示
- Android：`windowBackground` 主题 / Android 12+ SplashScreen API
- iOS：`LaunchScreen.storyboard`
- RN 库：`react-native-splash-screen`

**为什么需要 Splash？** 没有 Splash → 用户点击后看到白屏 1-2 秒 → 感觉"卡了"。有 Splash → 用户看到品牌画面 → 感觉"在启动"。

### windowBackground 配置在哪？

```xml
<!-- android/app/src/main/res/values/styles.xml -->
<style name="SplashTheme" parent="Theme.AppCompat.NoActionBar">
    <item name="android:windowBackground">@drawable/splash_screen</item>
</style>

<!-- AndroidManifest.xml 中指定主题 -->
<activity android:name=".MainActivity" android:theme="@style/SplashTheme" />

<!-- android/app/src/main/res/drawable/splash_screen.xml -->
<layer-list>
    <item android:drawable="@color/white" />
    <item><bitmap android:src="@mipmap/splash_logo" android:gravity="center" /></item>
</layer-list>
```

**本质**：Activity 创建的瞬间，系统用 `windowBackground` 作为窗口背景 → 用户立刻看到 Logo（比任何代码都快，系统级）。

### react-native-splash-screen 做什么？

**让你在 JS 层控制 Splash 什么时候消失。**

没有这个库：系统在 Activity 创建后自动移除 windowBackground → 可能 JS 还没就绪 → 白屏。
有这个库：Native 侧 `SplashScreen.show(this)` 强制保持 → JS 侧 `SplashScreen.hide()` 你决定何时消失。

---

## 三、Splash 期间做什么（并行化:三线程）

**核心思想**：Splash 停留的时间不是浪费，是并行做前置任务的窗口。

### 时机：在 Application.onCreate() 中启动三线程

`Application.onCreate()` 是 App 进程启动后第一个执行自定义代码的入口（早于 Activity）。三线程并行在这里启动：

```kotlin
class MyApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    // 三线程并行，不互相等待，越早启动越好
    thread { loadBundle() }          // 线程1：加载 JS Bundle
    thread { prefetchData() }        // 线程2：预请求首屏数据（OkHttp，Native 层发）
    thread { warmReactInstance() }   // 线程3：预热 RN 实例池（创建 ReactInstance）
  }
}
```

> 三者没有数据依赖关系，可以完全并行。首屏渲染需要三者都完成——哪个最慢就是瓶颈。

### Android App 启动生命周期

```
进程创建
  → Application.onCreate()     ← 最早的自定义代码入口（三线程在这里启动）
  → Activity.onCreate()        ← 第一个 Activity 创建
  → Activity.onStart()
  → Activity.onResume()        ← 用户可见
  → 首帧绘制                    ← Splash 显示
  → RN Bundle 加载完成 + JS 就绪
  → 首屏数据回来 + 渲染完成
  → SplashScreen.hide()        ← Splash 消失，首屏展示
```

**"数据请求"= JS 就绪后立刻发起的预请求**（用户信息/设备列表/配置），不等 Splash 消失。最终消费数据的是 JS 层（存到 Zustand → React 渲染）。Splash 遮挡着这个过程，用户看不到"请求中"。

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

> Splash 消失由 **JS 侧控制**——因为只有 JS 层知道"数据回来了 + UI 渲染完成了"。Native 侧只负责启动时显示 Splash，然后等 JS 调 hide()。

```typescript
// JS 侧控制消失时机
import SplashScreen from 'react-native-splash-screen';

function App() {
  const { data, isLoading } = useQuery(['devices'], fetchDevices);

  useEffect(() => {
    if (!isLoading && data) {
      SplashScreen.hide();  // ← JS 决定何时隐藏（数据就绪 + 渲染完成）
    }
  }, [isLoading, data]);

  return <DeviceList data={data} />;
}
```

```
分工：
  Native（Activity.onCreate）：显示 Splash（被动等）
  JS（useEffect）：数据就绪 + 渲染完成 → SplashScreen.hide()（主动控制）
```

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

> "启动本身需要优化"= 减少从点击图标到 JS 就绪的时间（这段时间用户只能看 Splash）。

| 手段 | 优化什么阶段 | 效果 |
|------|-------------|------|
| **Hermes AOT** | Bundle 加载（跳过 JS 解析） | 启动快 30-50% |
| **TurboModule 懒加载** | Native 初始化（不全量注册） | 减少 Application.onCreate 耗时 |
| **首屏最小化** | JS 执行（减少顶层 import） | 只执行首屏需要的代码 |
| **SDK 延迟初始化** | Native 初始化 | 非必要 SDK 延迟到首屏后 |
| **Splash 期间并行** | 数据请求 | 利用等待时间预加载数据 |
| **容器预热** | RN 实例创建 | 提前创建 ReactInstanceManager |

**如果这些都优化好了**：JS 就绪 + 数据请求在 1-2 秒内完成 → Splash 消失后首屏直接展示内容。
**如果优化不了**（Bundle 就是大/请求就是慢）：Splash 先消失 → 骨架屏过渡 → 数据来了替换。

---

## 六、体验优化（感知快）

> 骨架屏在 **RN 层**做（React 组件），不在 Native 层。因为：写一次两端生效 + 和真实组件在同一个代码库容易保持布局一致。
>
> Splash（Native 层）消失后 → 骨架屏（RN 层）接管 → 数据来了替换为真实内容。

| 问题 | 方案 | 效果 |
|------|------|------|
| Splash 消失后还有 loading | 统一初始化管理器，Splash 期间完成数据加载 | 首屏无 loading |
| Splash 消失后布局跳动 | Splash → 骨架屏 → 内容（三段式） | 无跳动 |
| Splash 和首屏割裂感 | Splash 背景色 = 首屏背景色 | 视觉连续 |
| 多个 loading 闪烁 | 任务管理器统一编排 | 一次性就绪 |

---

## 七、Splash 代码实现（RN + Native）

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


---

## 八、首屏优化最佳实践

### 总结

```
首屏优化 = 减少耗时 + 感知优化

减少耗时（真的快）：
  - Hermes AOT（Bundle 加载快）
  - TurboModule 懒加载（Native 初始化快）
  - 首屏 Bundle 最小化（DDD 拆分）
  - JS 就绪后立刻请求数据

感知优化（觉得快）：
  - Splash 遮挡等待（数据就绪后才消失）
  - 骨架屏过渡（Splash 消失后数据还没来时）
  - 收敛多个 loading（统一初始化管理器）
  - 预请求（跳转前就发起下一页数据请求）
```

### 按阶段的最佳实践

| 阶段 | 做什么 | 为什么 |
|------|--------|--------|
| **Native 初始化** | TurboModule 懒加载 + SDK 延迟初始化 | 减少 Application.onCreate 耗时 |
| **Bundle 加载** | Hermes AOT（.hbc 字节码） | 跳过运行时 JS 解析，加载快 30-50% |
| **Bundle 体积** | DDD 拆分首屏 Bundle（只含首屏代码） | Bundle 越小加载越快 |
| **JS 执行** | 首屏最小化（减少顶层 import） | 只执行首屏需要的模块 |
| **数据请求** | JS 就绪后立刻 Promise.all 发请求 | 利用 Splash 时间窗口 |
| **Splash 消失** | 数据就绪后才 hide（+ 超时兜底 3s） | 消失后首屏直接展示内容 |
| **Splash 消失后** | 骨架屏过渡（如果数据还没来） | 不白屏不 loading |
| **多个异步任务** | 统一初始化管理器收敛 | 不出现多个 loading 闪烁 |
| **页面跳转** | 预请求（onPressIn 时 prefetch 下一页数据） | 进入新页面时数据已就绪 |

多loading 我感觉可以用局部loadig 好比说按钮/状态栏的loading 不要用全局loading

> **原则：能局部就不全局**。局部 loading（按钮 spinner / 骨架屏 / 区块 shimmer）让页面其他部分可交互，体验远好于全局遮罩。

---

### 注释：概念澄清

**useAppInit 里的请求 ≠ 预请求**：
- useAppInit 发生在 JS 执行阶段（Bundle 已加载完），只是利用 Splash 时间窗口发请求
- 真正的预请求 = 在跳转前就发起下一个页面的数据请求（onPressIn 时 prefetch）

**Splash 阶段的"并行"**：
- Native 初始化和 Bundle 加载本身就是并行的（RN 框架内部做的），我们控制不了
- 我们能做的：减少每段耗时 + JS 就绪后立刻请求 + 控制 Splash 消失时机


---

## 九、XRN 方案：Native 层自定义 Splash 阶段

> 终极方案：XRN 控制 Native Shell 后，Splash 期间的动作完全由我们自定义。

### 和默认 RN 的区别

```
默认 RN：Native 层是"黑盒"，你只能控制 Splash 消失时机
XRN：Native Shell 是你的代码，Splash 期间可以主动做更多事
```

### Splash 期间能做的事

| 动作 | 做什么 | 效果 |
|------|--------|------|
| **Native 层数据预请求** | Native 侧直接发 HTTP（OkHttp/URLSession），不等 JS 就绪 | 数据请求和 Bundle 加载真正并行 |
| **BLE 预连接** | Native 侧开始 BLE 扫描/连接 | JS 就绪时设备可能已连上 |
| **缓存读取** | 从 MMKV 读上次数据 | JS 就绪后直接用缓存渲染，不等网络 |
| **多 Bundle 并行加载** | common + home 同时加载 | 减少串行等待 |

> 注：容器预热（提前创建 ReactInstanceManager）是多实例/多 Bundle 场景下对**后续页面跳转**的优化，不是首屏启动优化。

### 关键优化：Native 预请求

```
默认 RN：
  Splash → Native 初始化 → Bundle 加载 → JS 执行 → JS 发请求 → 等响应 → hide
  数据请求是最晚的一步（要等 JS 就绪）

XRN（Native 预请求）：
  Splash → [Native 初始化 + Native 发请求 + Bundle 加载]（全并行）
         → JS 执行 → 直接从 Native 拿已回来的数据 → 渲染 → hide
  数据请求和 Bundle 加载真正并行（不等 JS 就绪）
```

### 实现方式：Native 拦截层（零侵入）

JS 侧正常发请求（fetch/axios），Native 网络层透明拦截——命中预请求缓存就直接返回，没命中就正常走网络。**业务代码完全不用改。**

```kotlin
// Native 侧：Splash 期间发预请求，结果存缓存
class PreloadManager {
    val cache = ConcurrentHashMap<String, Response>()

    fun preload() {
        thread { cache["/api/user"] = httpClient.get("/api/user") }
        thread { cache["/api/devices"] = httpClient.get("/api/devices") }
    }
}

// OkHttp Interceptor：拦截 JS 的请求，命中缓存直接返回
class PreloadInterceptor(private val cache: Map<String, Response>) : Interceptor {
    override fun intercept(chain: Chain): Response {
        val url = chain.request().url.toString()
        cache[url]?.let { return it }  // 命中 → 直接返回，不走网络
        return chain.proceed(chain.request())  // 没命中 → 正常请求
    }
}
```

```typescript
// JS 侧：完全不用改，照常请求
const user = await api.getUser();       // Native 拦截 → 直接返回缓存
const devices = await api.getDevices(); // 同上
// 业务代码零侵入，感知不到预请求的存在
```

**本质**：和 MT 优选的"数据预加载方案"思路一致——请求拦截 + 缓存命中。只不过拦截层从 JS 移到了 Native 网络模块（OkHttp Interceptor）。

**一句话**：XRN 让数据请求和 Bundle 加载真正并行（Native 层发请求不等 JS），JS 启动后同步取已回来的数据 → 首屏最快。
