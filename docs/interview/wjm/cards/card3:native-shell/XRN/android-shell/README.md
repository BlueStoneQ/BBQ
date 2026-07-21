# XRN Android Shell

→ [XRN 总览](../README.md)

## 目录

- [QA](#qa)
  - [Q1: Android Native 应用如何集成 RN？](#q1-android-native-应用如何集成-rn)
  - [Q2: 跨模块跳转栈过深 / 环路怎么处理？](#q2-跨模块跳转栈过深--环路怎么处理)
- [统一路由设计](#统一路由设计)
- [跨模块通信](#跨模块通信)
- [多 Activity 设计](#多-activity-设计)
- [CrashGuard: 崩溃回退](#crashguard-崩溃回退)
- [预加载策略](#预加载策略)
- [热更新接口](#热更新接口)
- [Bundle 文件管理](#bundle-文件管理)

---

## QA

### Q1: Android Native 应用如何集成 RN？

**本质：Gradle 引入 RN 的 AAR 依赖 + 代码中创建 ReactRootView 承载 JS 渲染。**

**① 配置（build.gradle）**

```groovy
dependencies {
    // react-android: RN 框架核心（ReactHost / ReactRootView / TurboModule / Fabric 渲染器 / Bridge）
    implementation("com.facebook.react:react-android")
    // hermes-android: Hermes JS 引擎（执行 .hbc 字节码，替代 JSC）
    implementation("com.facebook.react:hermes-android")
}
```

**② 代码（Kotlin）— 单 Bundle 最简集成**

> 多 Bundle 容器（XRN/CRN）需要额外的实例池 + loadScriptFromFile 追加 bundle，详见 [bundle-runtime](../../../../../root/XRN/bundle-runtime.md)

1. 核心部件: [ReactHost](#注释reacthost) / [ReactRootView](#注释reactrootview) / [ReactInstanceManager](#注释reactinstancemanager)

```kotlin
// ─── Application.onCreate ───
// 职责：创建 ReactHost（全局单例，整个 App 生命周期只创建一次）
// 此时只声明引擎配置，还没有创建 ReactInstance（懒创建，第一次 start 时才初始化）
class MyApp : Application(), ReactApplication {
    override val reactHost: ReactHost by lazy {
        ReactHostBuilder(this)
            .setJSEngineResolutionAlgorithm(JSEngineResolutionAlgorithm.HERMES)
            .build()
    }
}

// ─── Activity ─── 
class RNActivity : ComponentActivity() {
    private lateinit var rootView: ReactRootView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        rootView = ReactRootView(this)
        rootView.startReactApplication(
            (application as MyApp).reactHost.reactInstanceManager,
            "AppName",       // 对应 JS 侧 AppRegistry.registerComponent("AppName", ...)
            null             // initialProps
        )
        setContentView(rootView)
    }

    override fun onDestroy() {
        rootView.unmountReactApplication()
        super.onDestroy()
    }
}
```

就这些。核心就两件事：Application 里初始化引擎，Activity 里创建 ReactRootView 挂上去。

3. XRN 多bundle容器:
> 设计: XRN 和 CRN 都是这个模式：多 Activity + 多 ReactInstance（通过实例池管理）+ 统一 Native 路由
- "多 ReactInstance"不是"多 ReactInstanceManager"——ReactInstanceManager 通常也是全局一个（或一个池管理类），它负责创建/管理多个 ReactInstance

- [内存控制方案](#注释内存控制方案)
- [实例数根据内存动态设计](#注释实例池autoscale)
- [线程控制: RN InstanceManager会做分线程加载, 我们不用管](#注释线程控制)

```kotlin
// 与单 Bundle 的区别：用 ReactInstanceManager 而不是 ReactHost
// 三步：创建实例 → 追加 business bundle → 挂 ReactRootView

// Step 1: 从实例池取出（已预加载 common.hbc）
val instance = instancePool.acquire()

// Step 2: 追加业务 bundle
instance.currentReactContext?.catalystInstance?.loadScriptFromFile(
    bundlePath,    // "/data/.../home.hbc"
    "home",        // sourceURL
    false          // async
)

// Step 3: 创建 RootView 启动渲染
val rootView = ReactRootView(this)
rootView.startReactApplication(instance, "home/index", props)
setContentView(rootView)
```

> [ReactInstanceManagerBuilder](#注释reactinstancemanagerbuilder)

```kotlin
// ─── 实例池最小实现 ───
// 池里每个元素是一个 ReactInstanceManager（1 manager = 1 ReactInstance = 1 HermesRuntime）
// 打开页面时：从池中取一个 manager → 用它的 catalystInstance.loadScriptFromFile() 追加 business bundle

object InstancePool {
    private val pool = ArrayDeque<ReactInstanceManager>()

    fun warmUp(count: Int = 2) {
        repeat(count) {
            val mgr = ReactInstanceManagerBuilder()
                .setApplication(app)
                .setBundleAssetName("common.hbc")  // 创建时自动加载 common
                .build()
            mgr.createReactContextInBackground()   // 异步创建 ReactInstance
            pool.add(mgr)
        }
    }

    fun acquire(): ReactInstanceManager = pool.removeFirst()

    fun release(mgr: ReactInstanceManager) {
        pool.add(mgr)
    }
}
```

## 统一路由设计

→ [route.md（双端统一，单独文档）](../../../../../root/XRN/route.md)

## 跨模块通信

→ [native-shell.md §八、跨模块通信](../../../../../root/XRN/native-shell.md#八跨模块通信)

两种方案：
1. **Native EventBus**（基于 TurboModule + JSI）：JS 层调 TurboModule.emit() → Native 层广播给所有注册了该事件的 Instance
2. **MMKV 共享存储**：多实例共享同一个 MMKV 文件，一方写入、另一方读取（适合状态同步，不适合实时事件）
3. **URL params**

**典型场景**：

| 场景 | 方案 |
|------|------|
| Theme（跟随系统暗黑模式） | 各 Instance 独立监听 `Appearance.addChangeListener`，不需要跨 Instance 通信 |
| I18n 切换语言 | 写 MMKV + 重启 App（低频操作，最稳定） |

## 多bundle加载

## 多 Activity 设计

注册一个通用 `RNContainerActivity`，所有 RN 页面复用这个类，通过 Intent extras 区分加载哪个 bundle/page。[→ 详细方案](#注释多activity设计)

## CrashGuard: 崩溃回退

热更新后 crash → 自动回退到上一稳定 bundle。[→ 详细设计](../../../../../root/XRN/native-shell.md#四稳定性保障crashguard)

核心机制：启动时崩溃计数器 +1，稳定运行 5s 清零，连续 2 次未清零 → 清空 hot/ → 回退 builtin 版本。

## 预加载策略

→ [native-shell.md §七、预加载策略](../../../../../root/XRN/native-shell.md#七预加载策略)

四种时机：preload（common 加载完立即）/ idle（主线程空闲）/ on-demand（用户打开时）/ conditional（用户行为触发）。

## 热更新接口

→ [native-shell.md §五、热更新接口](../../../../../root/XRN/native-shell.md#五热更新接口)

- [为什么暴露给 JS + 不影响首屏速度](#注释热更新接口设计)

## Bundle 文件管理

```
/data/data/com.myapp/files/xrn/
├── builtin/          ← 随 APK 安装，只读
│   ├── common.hbc
│   ├── home.hbc
│   └── order.hbc
├── hot/              ← 热更新下载，可写
│   ├── home/
│   │   ├── v1.2.1/home.hbc
│   │   └── v1.2.2/home.hbc   ← 最新
│   └── order/
│       └── v2.0.1/order.hbc
└── manifest.json     ← 记录每个 bundle 的当前激活版本 + 来源
```

策略：
- 路径解析优先级：**hot > builtin**（有热更新版本就用热更新的）
- [**AssetResolver hook**](#注释assetresolver-hook)：Native Shell 重写 RN 的资源解析逻辑，`require('./icon.webp')` 时先查 `hot/` 目录，找不到再 fallback 到 APK 内置 `assets/`（APK 是只读的，不能写入）
- 版本清理：保留最近 N 个版本（默认 2），自动删旧版本
- CrashGuard 回退时：清空 hot/ → 回退到 builtin

---

### Q2: 跨模块跳转栈过深 / 环路怎么处理？

**问题**：A→B→C→D→E... 或 A→B→C→A→B→C 循环跳转，Instance 无限堆积 → OOM。

**方案**：

| 手段 | 说明 |
|------|------|
| 模块内共享 Instance | 同模块页面用 React Navigation，不新建 Instance |
| 环路检测（Router 层） | 目标模块已在栈中 → `popTo` 已有的 Activity（类似 `FLAG_ACTIVITY_CLEAR_TOP`），不新建 |
| 完成类页面清栈 | 支付成功/提交完成后 `popToTop` 回首页，清掉中间栈 |
| 监控告警 | 跨模块深度超阈值（如 4 层）→ 上报，定期 review 链路设计 |
| maxInstances 兜底 | 超限时拒绝新建或 finish 最底部 Activity |

**环路处理**（A→B→C→A）：

```
Router 检测到目标模块 A 已在栈中
  → finish B、C 的 Activity（释放 Instance）
  → 回到栈中已有的 A（复用 Instance）
  → 栈变为 [A]，不会 A→B→C→A→B→C 无限循环
```

**实际情况**：现代手机 6-8GB 内存，3-4 个同时活跃的 Instance（100-150MB）完全没压力。框架做好环路检测 + 清栈规范就够，不需要复杂的快照恢复机制。

---


# 注释

<a id="注释reacthost"></a>
### ReactHost

RN 引擎的全局管理者（新架构）。**一个应用一个实例**（全局单例），在 Application 中创建。职责：创建/持有/销毁 ReactInstance。多个 Activity 共用同一个 ReactHost，但 ReactHost 下面可以管理多个 ReactInstance（实例池）。

<a id="注释reactrootview"></a>
### ReactRootView

RN 内容的根容器 View（extends ViewGroup）。每个 RN 页面对应一个 ReactRootView。调用 `startReactApplication()` 后，Fabric 会把 React 组件树挂到这个 View 上渲染。

<a id="注释reactinstancemanager"></a>
### ReactInstanceManager

ReactInstance 的管理者。旧架构的核心 API，新架构（0.76+）被 ReactHost 封装，标记 deprecated 但仍可用。

**多 Bundle 容器必须用它吗？** 不是"必须"，但实际上是。原因：

- `ReactHost` 设计为"一个 App 一个 ReactInstance"的简单模式，不暴露 `loadScriptFromFile()`（追加 bundle）和多实例创建的接口
- 多 Bundle 容器需要：① 手动创建多个 ReactInstance ② 控制每个实例加载哪些 bundle ③ 实例池管理（预热/回收）
- 这些能力只有 `ReactInstanceManager`（或直接操作更底层的 `CatalystInstance`）才有

所以 CRN/XRN 这类多 Bundle 容器用的是 ReactInstanceManager（或其底层 API），不是 ReactHost。

<a id="注释实例池设计"></a>
### 实例池设计

池里每个元素是一个 ReactInstanceManager（1 manager : 1 ReactInstance : 1 HermesRuntime）。

```
App 启动 → InstancePool.warmUp(2)
  → 创建 2 个 manager，每个 manager 内部创建一个 ReactInstance 并加载 common.hbc
  → 池中有 2 个"已就绪"的 manager

用户打开 RN 页面：
  → pool.acquire() 取一个 manager
  → manager.currentReactContext.catalystInstance.loadScriptFromFile("home.hbc")
  → ReactRootView.startReactApplication(manager, "home/index", props)

用户关闭页面：
  → rootView.unmountReactApplication()
  → pool.release(manager)  // 回池复用
```

为什么池的粒度是 manager 而不是 instance？因为 RN API 设计中 manager 是 instance 的唯一入口——你不能脱离 manager 单独操作 instance。1:1 绑定。

<a id="注释reactinstancemanagerbuilder"></a>
### ReactInstanceManagerBuilder

ReactInstanceManager 的构造器（Builder Pattern）。因为 manager 的配置参数多（Application / bundle 路径 / JS 引擎选择 / NativeModule 包等），用链式 Builder 设置后 `.build()` 产出 ReactInstanceManager。和 `OkHttpClient.Builder().build()` 一个模式。

<a id="注释内存控制方案"></a>
### 内存控制方案

多 ReactInstance 架构下，每个实例 ≈ 30-50MB。不控制的话 5-6 个页面就 200-300MB，低端设备直接 OOM。

| 机制 | 目的 |
|------|------|
| 实例池上限（maxInstances 按设备内存分档） | 不让实例无限创建 |
| onTrimMemory → shrink() 释放 IDLE 实例 | 系统内存紧张时主动让出 |
| 页面关闭 → 实例回池复用（不新建） | 控制总实例数 |
| 泄漏检测（IN_USE > 10min → 强制回收） | 兜底 |
| 路由栈深度限制 + 模块内用 React Navigation | 减少新建 Activity + Instance 的次数 |

---

<a id="注释实例池autoscale"></a>
### 实例池 autoScale

根据设备总内存（`ActivityManager.getMemoryInfo().totalMem`）启动时一次性判断分档：

| 设备总内存 | 预热池大小 | 最大实例数 |
|-----------|-----------|-----------|
| ≥ 6GB | 3 | 5 |
| 4-6GB | 2 | 4 |
| 2-4GB | 1 | 3 |
| < 2GB | 0（不预热，按需创建） | 2 |

运行时动态收缩：系统回调 `onTrimMemory(TRIM_MEMORY_RUNNING_LOW)` 时释放所有 IDLE 实例，只保留当前正在用的。内存压力恢复后重新预热。

<a id="注释线程控制"></a>
### 线程控制

Native Shell 层不需要自己开线程做加载/渲染。RN 内部已有三线程模型：

| 线程 | 职责 |
|------|------|
| JS Thread | 执行 JS / React render |
| UI Thread（主线程） | Native View 操作 |
| Shadow/Background Thread | 布局计算（Yoga） |

具体 API 的线程行为：

- `createReactContextInBackground()` — 内部自己在后台线程创建 Instance + 加载 common
- `loadScriptFromFile(path, url, false)` — 内部 post 到 JS Thread 执行，第三个参数 `false` = 异步不阻塞
- `startReactApplication()` — 必须在主线程调（操作 View），但 RN 内部的 JS 执行和布局计算自动分线程

结论：你在主线程调这些 API 就行，RN 内部管线程调度。

<a id="注释热更新接口设计"></a>
### 热更新接口设计

**Q: 为什么暴露给 JS？**

更新策略（检查时机/灰度规则/版本对比）变化频繁，写在 JS 里可以跟着 bundle 一起热更新——不需要发版就能改策略。但"安装文件到本地 + reload"只有 Native 能做，所以通过 TurboModule 暴露。

**Q: 写在 common 里不会影响首屏速度吗？**

不会。热更新是**本次启动不等待**的模式：

```
本次启动：
  Native 直接加载本地已有的 bundle → 渲染首页（不等更新）
  ↓ 同时（首页渲染后，后台异步）
  @x-rn/updater 检查服务端 → 有新版本 → 静默下载 → installBundle

下次启动：
  Native 读 manifest → 发现 hot/ 有新版本 → 加载新版本
```

updater 逻辑在首页渲染**之后**才异步跑，不阻塞首屏。

<a id="注释多activity设计"></a>
### 多 Activity 设计

**问题**：Activity 必须在 AndroidManifest.xml 预注册，不能动态创建。如何支持无限多的 RN 页面？

**方案**：只注册一个通用容器 Activity（`launchMode="standard"`），每次 startActivity 都新建一个实例，通过 Intent extras 传 bundleId + pageName。

```xml
<!-- AndroidManifest.xml 只需注册一个 -->
<activity android:name=".RNContainerActivity" android:launchMode="standard" />
```

- 跳转: 这部分是封装在统一route中, route 必须 我们自己通过turbo module来封装给js
```kotlin
val intent = Intent(context, RNContainerActivity::class.java).apply {
    putExtra("bundleId", "order")
    putExtra("pageName", "order/detail")
    putExtra("params", """{"orderId":"123"}""")
}
startActivity(intent)

// RNContainerActivity.onCreate 中根据 extras 决定加载哪个 bundle
val bundleId = intent.getStringExtra("bundleId")
val pageName = intent.getStringExtra("pageName")
// → 从实例池取 manager → loadScriptFromFile(bundleId) → startReactApplication(pageName)
```

**Native 路由和转场动画正常工作**：对系统来说就是标准的 startActivity()，系统转场动画、back stack、返回键全部开箱即用。和 Native 页面混排无缝：

```
[NativeHomeActivity] → [RNContainerActivity(order)] → [NativePayActivity] → [RNContainerActivity(result)]
```

<a id="注释assetresolver-hook"></a>
### AssetResolver hook

**默认流程**：`require('./icon.webp')` → Metro 编译为数字 ID → Native 通过 AssetRegistry 查 ID 对应的文件名 → AssetManager 从 APK assets/ 读。

**热更新场景**：用 `setJSBundleFile(磁盘路径)` 创建 Instance，RN 框架自动从 .hbc 同目录的 assets/ 找图片，不需要额外 hook。[→ 具体实现](#注释crn-asset-hook)

<a id="注释crn-asset-hook"></a>
### 热更新时图片怎么找到

用 `setJSBundleFile(磁盘路径)` 加载 bundle 时，RN 框架自动从 .hbc 同目录的 `assets/` 下找图片。不需要额外 hook。

```kotlin
// 设置为磁盘路径（不是 APK assets 路径）
val mgr = ReactInstanceManagerBuilder()
    .setJSBundleFile("/data/.../hot/home/v1.2.2/home.hbc")
    .build()

// RN 加载图片时自动推算：
// home.hbc 的父目录 = /data/.../hot/home/v1.2.2/
// 图片路径 = /data/.../hot/home/v1.2.2/assets/icon.webp
```

关键：`setJSBundleFile`（磁盘文件）vs `setBundleAssetName`（APK 内置）——前者让 RN 从磁盘找资源，后者从 APK 找。每个 Instance 设置自己的路径，多 Instance 互不干扰。
