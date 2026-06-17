# XRN Bundle 运行时机制

## 目录

- [零、多 Activity vs 单 Activity：Trade-off 分析](#零多-activity-vs-单-activitytrade-off-分析)
- [一、实现一个多 Bundle RN 容器需要什么](#一实现一个多-bundle-rn-容器需要什么)
- [二、XRN / CRN 的 Bundle 与 Activity 关系](#二xrn--crn-的-bundle-与-activity-关系)
- [三、CRN（携程）的实际做法](#三crn携程的实际做法)
- [四、关键设计要点](#四关键设计要点)
- [五、总结](#五总结)

---

## 零、多 Activity vs 单 Activity：Trade-off 分析

### 核心结论

- **内存大头是 ReactInstance（30-50MB），不是 Activity（几十KB）**
- **内存隔离取决于 ReactInstance 数量，和 Activity 数量无关**
- **选多/单 Activity 的关键决策因素是：App 是否有 Native 和 RN 页面混排**

### 对比

| 维度 | 多 Activity | 单 Activity |
|------|------------|------------|
| **内存** | 多几十KB（Activity 本身很轻） | 稍省，但差异可忽略 |
| **切换开销** | 经过 AMS（IPC ~50-100ms） | 进程内 View 切换（~5-10ms） |
| **Native 转场动画** | 系统原生，开箱即用 | 需自己实现 |
| **导航栈** | 与 Native 页面天然混排 | 需自己管两套栈 |
| **返回键** | 系统自动处理 | 需拦截自己处理 |
| **隔离性** | 取决于 ReactInstance 数量 | 同左（无差） |
| **实现复杂度** | 低（标准 Android 模式） | 高（自管路由栈+动画） |

### 选型决策

```
你的 App 是什么类型？

├─ 纯 RN App（所有页面都是 RN）
│  → 单 Activity 收益更高
│    切换快、不经过系统 AMS、前端路由统一管理
│
└─ 混合 App（Native + RN 页面交叉）
   → 多 Activity 更合理
     与 Native 导航栈一致、系统动画、无缝混排

   例如：
   [NativeHome] → [RN(order)] → [NativePay] → [RN(result)]
   这种场景如果用单 Activity，需要自己同步两套栈，返回键行为也需要自行拦截
```

**CRN / XRN 选择多 Activity 的原因**：面对的是混合 App 场景（App 中既有 Native 页面也有 RN 页面），多 Activity 让 RN 页面在导航栈层面和 Native 页面完全一致。

---

## 一、实现一个多 Bundle RN 容器需要什么

**问题本质：如果让你从零实现 XRN 的 Native Shell，你需要用哪些 RN/Android 原生 API，在什么时间点做什么？**

---

### 时间轴：三个关键阶段

```
App 进程启动          用户打开 RN 页面        用户关闭页面
      │                     │                    │
      ▼                     ▼                    ▼
 [Application]          [Activity]           [Activity.onDestroy]
  初始化引擎            组装渲染单元            释放资源
```

---

### 阶段一：Application.onCreate — 初始化引擎

**用到的 RN API**：`ReactHost`（新架构）/ `ReactInstanceManager`（旧架构）

```kotlin
class MyApplication : Application(), ReactApplication {

    // ReactHost = RN 引擎的全局管理者
    // 职责：创建 / 持有 / 销毁 ReactInstance
    override val reactHost: ReactHost by lazy {
        ReactHostBuilder(this)
            .setJSEngineResolutionAlgorithm(JSEngineResolutionAlgorithm.HERMES)
            .build()
    }

    override fun onCreate() {
        super.onCreate()
        // 此时 ReactHost 只是创建好了，还没有 ReactInstance
        // ReactInstance 是懒创建的，第一次 start 时才真正初始化
    }
}
```

**为什么在 Application 层？**
- ReactHost 是全局单例，整个 App 生命周期只有一个
- 多个 Activity 共用同一个 ReactHost，但可以有多个 ReactInstance

---

### 阶段二：Activity.onCreate — 组装渲染单元

这是核心，需要 3 步：

**Step 1：拿到（或创建）ReactInstance，加载 common bundle**

```kotlin
// ReactHost.start() 会创建 ReactInstance 并加载 common bundle
// 如果已经有实例（实例池模式），直接复用
reactHost.start()  // 异步，完成后才能使用
```

**Step 2：追加加载 business bundle**

```kotlin
// ReactInstance 暴露了 loadScriptFromFile
// 这是向已有 JS 运行时追加执行一段 JS 的底层 API
val reactInstance = reactHost.currentReactContext?.catalystInstance
reactInstance?.loadScriptFromFile(
    "/data/app/.../home.hbc",   // bundle 文件路径
    "home",                      // sourceURL，用于错误栈追踪
    false                        // loadSynchronously
)
```

**Step 3：创建 ReactRootView，启动渲染**

```kotlin
// ReactRootView = RN 内容的根容器 View
// 本质是一个 ViewGroup，Fabric 把 React 组件树挂到这里
val rootView = ReactRootView(this)

rootView.startReactApplication(
    reactHost.reactInstanceManager,  // 引擎管理者
    "home/index",                    // 组件名，对应 JS 侧 AppRegistry.registerComponent
    bundleOf("userId" to "123")      // initialProps，传给根组件的初始参数
)

setContentView(rootView)  // 挂到 Activity，触发渲染
```

**JS 侧对应代码**：
```javascript
// home bundle 中
AppRegistry.registerComponent('home/index', () => HomeScreen)
//                              ↑ 必须与 startReactApplication 的第二个参数完全一致
```

---

### 阶段三：Activity.onDestroy — 释放资源

```kotlin
override fun onDestroy() {
    super.onDestroy()

    // 1. 先卸载 ReactRootView（停止 JS 事件监听、动画等）
    rootView.unmountReactApplication()

    // 2. 通知 ReactHost 当前 surface 已销毁
    reactHost.destroy(rootView, ...)

    // 3. 如果是实例池模式：归还 ReactInstance（不销毁，留给下一个页面用）
    // 如果不用实例池：ReactInstance 随 Activity 销毁
}
```

---

### 完整关系图

```
Application
└── ReactHost（全局单例）
        │ 创建/管理
        ▼
    ReactInstance（可以有多个，实例池）
        │ 包含
        ├── HermesRuntime（执行 .hbc 字节码）
        ├── TurboModuleRegistry（Native 模块）
        └── FabricUIManager（渲染器）

Activity
└── ReactRootView（extends ViewGroup）
        │ startReactApplication(instance, "home/index", props)
        │ 找到 AppRegistry["home/index"]
        ▼
    React 组件树 → Shadow Tree → Native View 树 → 屏幕
```

---

### 关键 API 一览

| API | 所属 | 时机 | 作用 |
|-----|------|------|------|
| `ReactHostBuilder.build()` | RN | Application.onCreate | 创建全局引擎管理者 |
| `ReactHost.start()` | RN | 预热 / Activity.onCreate | 创建 ReactInstance，加载 common |
| `catalystInstance.loadScriptFromFile()` | RN | Activity.onCreate | 向实例追加执行 business bundle |
| `ReactRootView(context)` | RN | Activity.onCreate | 创建根 View |
| `rootView.startReactApplication()` | RN | Activity.onCreate | 绑定实例 + 组件名，触发渲染 |
| `rootView.unmountReactApplication()` | RN | Activity.onDestroy | 卸载 RN 内容，释放 JS 资源 |
| `AppRegistry.registerComponent()` | RN/JS | bundle 执行时 | 注册组件，供 RootView 查找 |

---

## 二、XRN / CRN 的 Bundle 与 Activity 关系

**结论：不是一个 bundle 对应一个 Activity，而是一个页面（Activity/ViewController）对应一个 ReactInstance，一个 ReactInstance 可以加载多个 business bundle。**

### 架构关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                     XRN / CRN 架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Instance Pool（实例池）                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Instance 1   │ │ Instance 2   │ │ Instance 3   │            │
│  │ common.hbc ✓ │ │ common.hbc ✓ │ │ common.hbc ✓ │  ← 预加载  │
│  │ (空闲)       │ │ (空闲)       │ │ (空闲)       │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│         │                                                       │
│         ▼ 用户打开页面                                           │
│  ┌─────────────────────────────────────────────┐                │
│  │          HomeActivity / ViewController      │                │
│  │  ┌─────────────────────────────────────┐   │                │
│  │  │  Instance 1（从池中取出）            │   │                │
│  │  │  + evaluateJS(home.hbc)             │   │                │
│  │  │  + evaluateJS(cart.hbc) ← 可追加    │   │                │
│  │  │  + ReactSurface("Home") → 渲染      │   │                │
│  │  └─────────────────────────────────────┘   │                │
│  └─────────────────────────────────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、CRN（携程）的实际做法

**CRN 的核心设计**：

| 层级 | 说明 |
|------|------|
| **ReactInstance 层** | 每个实例有独立的 HermesRuntime（JS Context），预加载 common bundle |
| **业务层** | 打开页面时追加执行 business bundle，一个实例可加载多个业务 bundle |
| **Native 层** | Activity/ViewController 持有 ReactSurface，绑定到实例 |

**实例生命周期**：

```
App 启动 → 空闲时预创建实例池(2-3个)
              │
              ▼
    用户打开 RN 页面 → 从池中取实例 → 追加业务 bundle → 渲染
              │
              ▼
    用户关闭页面 → 清理业务状态 → 实例回池 → 可复用
```

---

## 四、关键设计要点

### 1. 实例池策略

| 参数 | 默认值 | 说明 |
|------|--------|------|
| poolSize | 2 | 预创建实例数（低端设备可设为 1） |
| maxPoolSize | 3 | 池最大容量 |
| warmUpDelay | 3s | App 启动后延迟预热 |
| recycleTimeout | 30s | 页面关闭后延迟回收 |

### 2. 隔离性保障

- **JS 引擎级隔离**：每个实例有独立的 HermesRuntime
- **内存隔离**：一个页面 crash 不影响其他页面和主 App
- **无全局污染**：各实例的 globalThis 完全独立

### 3. 跨页面通信

由于实例间 JS Context 隔离，通信需要通过 Native 层中转：

```
Page A (Instance 1)          Native EventBus           Page B (Instance 2)
     │                           │                        │
     │  NativeModule.emit(       │                        │
     │    'cart_updated',        │                        │
     │    {count: 3})            │                        │
     │ ─────────────────────────▶│                        │
     │                           │───────────────────────▶│
```

---

## 五、总结

| 问题 | 答案 |
|------|------|
| **一个 bundle = 一个 activity？** | ❌ 不是 |
| **一个 activity = 一个 ReactInstance？** | ✅ 是（通过实例池管理） |
| **一个 ReactInstance = 一个 business bundle？** | ❌ 可加载多个 |
| **CRN 如何做？** | 多实例 + 实例池，预加载 common，按需追加 business |
| **核心优势** | 页面隔离 + 实例复用 + 性能保障 |

XRN 和 CRN 采用相同的架构模式：**多 ReactInstance + 实例池**，实现了页面级的完全隔离，同时通过池化复用保证了性能。
