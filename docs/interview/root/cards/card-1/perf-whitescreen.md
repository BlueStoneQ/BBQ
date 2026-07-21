# 白屏检测与治理

> 问题：页面跳转后/列表滚动时出现白屏（空白区域）
>
> 本质：内容还没渲染出来，用户看到空白
>
> 目标：任何场景下用户都不会看到纯白屏

---

## 目录

- [1. 白屏定义, 和FP FMP的关系?](#1-白屏定义-和fp-fmp的关系)
- [白屏分类](#白屏分类)
- 根因与优化
  - 总览表格
  - [JS 执行阻塞与白屏](#js-执行阻塞与白屏)
- [白屏检测 SDK 设计](#白屏检测-sdk-设计)
  - SDK:JS侧
  - SDK:Native侧
    - Android侧
    - IOS侧
- [白屏检测方案](#白屏检测方案)
- [Performance Monitor（RN 内置工具）](#performance-monitorrn-内置工具)
- QA
  - [Q1: 白屏定义, 和FP FMP的关系?](#1-白屏定义-和fp-fmp的关系)
  - [Q2: RN 白屏检测业界怎么做？能从 Native 容器层检测吗？](#q-rn-白屏检测业界怎么做能从-native-容器层检测吗)
- 附录:
  - [场景分类](#如何优化)
    - [启动白屏](#启动白屏)
    - [页面跳转白屏](#页面跳转白屏)
    - [列表滚动白屏](#列表滚动白屏)
    - [JS Crash 白屏](#js-crash-白屏)
    - [数据加载白屏](#数据加载白屏)


---

## 白屏分类

| 类型 | 原因 | 现象 |
|------|------|------|
| **启动白屏** | Bundle 加载 + JS 执行期间没有 UI | 点击图标后白屏 1-2s |
| **页面跳转白屏** | 新页面组件还没渲染完 | 跳转后短暂白屏 |
| **列表滚动白屏** | FlatList 来不及渲染新 item | 快速滚动时 item 区域空白 |
| **JS Crash 白屏** | JS 异常导致组件树崩溃 | 整个页面变白 |
| **数据加载白屏** | 数据没来，条件渲染为空 | `{data && <View/>}` → 空 |

---

## 如何优化

### 启动白屏

| 手段 | 做什么 |
|------|--------|
| Splash Screen | Native 层立刻显示品牌画面（不让用户看到白屏） |
| 骨架屏 | Splash 消失后立刻显示骨架（不是空白） |

→ 详见 [perf-splash.md](./perf-splash.md)

### 页面跳转白屏

| 手段 | 做什么 |
|------|--------|
| native-stack | 原生转场动画，切换瞬间有过渡 |
| 骨架屏 | 新页面先显示骨架 |
| 容器预热 | 提前创建页面实例 |
| InteractionManager | 转场动画结束后再做重计算 |

### 列表滚动白屏

→ 详见 [perf-list.md](./perf-list.md)（列表最佳实践：FlashList + memo + useCallback + FastImage + estimatedItemSize）

### JS Crash 白屏

| 手段 | 做什么 |
|------|--------|
| **ErrorBoundary** | 捕获渲染错误 → 显示兜底 UI（不是白屏） |
| 页面级 ErrorBoundary | 每个页面包一层，一个页面崩了不影响其他 |
| 全局兜底 | App 根组件包 ErrorBoundary → 最坏情况显示"重试"按钮 |

```typescript
// 每个页面都有 ErrorBoundary → 崩了显示兜底，不白屏
function DeviceDetailScreen() {
  return (
    <ErrorBoundary fallback={<ErrorState message="页面加载失败" onRetry={reload} />}>
      <DeviceDetail />
    </ErrorBoundary>
  );
}
```

### 数据加载白屏

| 手段 | 做什么 |
|------|--------|
| 骨架屏 | 数据没来时显示骨架（不是空白） |
| 避免 `{data && <View/>}` | 用三态组件（loading/content/error） |

---

## 白屏检测方案

**JS 侧检测**（主力，能拿到具体错误信息）：

```typescript
// 自动检测白屏：页面渲染后检查是否有内容
function useWhiteScreenDetection(screenName: string) {
  useEffect(() => {
    const timer = setTimeout(() => {
      // 如果 3 秒后页面仍然没有内容 → 上报白屏事件
      if (!hasVisibleContent()) {
        reportWhiteScreen(screenName);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);
}
```


---

## Performance Monitor（RN 内置工具）

RN 内置的实时帧率监控。打开方式：Dev Menu → Show Perf Monitor（或摇一摇手机）。

显示：JS 帧率 + UI 帧率。用来快速判断"卡在 JS 还是 Native"。

---

## JS 执行阻塞与白屏

### 本质

RN 的 JS Thread 是单线程的。一段 JS 代码在执行时，其他所有 JS 任务（渲染/事件处理/动画回调）都在排队等着。

```
JS Thread 在做重计算（排序/JSON 解析/大量 setState）
  → 这一帧的 React 渲染被阻塞
  → UI 更新指令发不出去
  → 用户看到：掉帧/卡顿/手势不跟手/白屏
```

### 为什么会阻塞？

JS 是单线程 + 同步执行：一个函数没执行完 → 后面的代码全部等着。没有"中断当前任务去做更重要的事"的能力（除非用 async/setTimeout 主动让出）。

### 解决方案

| 手段 | 做什么 | 本质 |
|------|--------|------|
| **InteractionManager.runAfterInteractions** | 重任务延迟到动画/转场结束后 | 让出帧预算给动画 |
| **setTimeout(fn, 0)** | 把任务推到下一个事件循环 | 让当前帧先渲染完 |
| **useMemo / useCallback** | 避免每帧重复计算 | 减少 JS 工作量 |
| **Reanimated worklet** | 动画计算移到 UI 线程 | JS 阻塞不影响动画 |
| **分片处理（chunking）** | 大任务拆成小块，每帧只做一块 | 不连续占用 JS 线程 [→注释](#注释分片用宏任务不是微任务) | |

```typescript
// ❌ 阻塞：一次性处理大量数据 → 这一帧卡死
const sorted = hugeArray.sort((a, b) => a.name.localeCompare(b.name));

// ✅ 分片：每帧只处理一部分
function processInChunks(array, chunkSize = 100) {
  let index = 0;
  function nextChunk() {
    const chunk = array.slice(index, index + chunkSize);
    // 处理这一块...
    index += chunkSize;
    if (index < array.length) {
      requestAnimationFrame(nextChunk);  // 下一帧继续
    }
  }
  nextChunk();
}

// ✅ InteractionManager：转场动画结束后再做重活
InteractionManager.runAfterInteractions(() => {
  processLargeData();  // 不影响转场动画
});
```

**一句话**：JS 单线程 → 重任务阻塞渲染 → 掉帧/白屏。解决 = 减少 JS 工作量 + 延迟非关键任务 + 把性能敏感逻辑移出 JS 线程。


---

## 白屏检测 SDK 设计

### 总览表格

→ 详见 [Q2: RN 白屏检测业界怎么做？](#q-rn-白屏检测业界怎么做能从-native-容器层检测吗)

| 检测层 | 方式 | 优点 | 缺点 |
|--------|------|------|------|
| **JS 层** | ErrorBoundary 捕获 + 超时检查子节点 | 简单，能拿到具体错误信息 | JS 崩了就检测不到 |
| **Native 容器层** | View 树 childCount 检查 / 截图像素采样 | JS 崩了也能兜底 | 不知道具体崩的原因 |

### 本质

在启动链路关键节点打时间戳，计算各阶段耗时，超时判定白屏。

```
T0: Native Activity 创建（Native 层打点）
T1: Bundle 加载完成（Native 层打点）
T2: JS 就绪（Native loadScript 回调）
T3: 首屏首个组件 onLayout（JS 层打点 → 上浮 Native）
T4: 首屏数据渲染完成（JS 层打点 → 上浮 Native）

各阶段耗时：
  Native 初始化 = T1 - T0
  Bundle 加载+执行 = T2 - T1
  首屏渲染 = T3 - T2
  数据等待 = T4 - T3
  总 TTI = T4 - T0

白屏判定：T4 超过阈值（3s）未到达 → 白屏

> **类比理解**：可以理解为 FMP > 3s 判定白屏。但 RN 里没有浏览器的标准 FMP——用自定义打点（首屏组件 onLayout 回调）标记 T4。T4 超时未到达 = 用户看了 3 秒还是白的。
>
> **上报机制**：不需要自己用 TurboModule 开线程上报。Sentry/Firebase 这些 SDK 内部已经在 Native 线程做了批量上报——JS 层调 `Sentry.captureException()` 只是把数据丢给 Native SDK，SDK 自己管线程、本地缓存、批量发送。只有自建埋点系统时才需要考虑 TurboModule → Native 子线程 → 批量上传。
```

### 架构

```
JS 层打点（T3/T4）→ TurboModule 上浮到 Native
Native 层打点（T0/T1/T2）→ 直接存
                ↓
Native 上报线程（独立线程，不占 JS/UI）
  → 线上：上报到监控平台
  → 开发阶段：输出到本地日志/console（方便调试）
```

**为什么 JS 层打点不能省？** Native 只知道"Bundle 加载完了"，不知道"React 首屏渲染完了"/"数据回来了"。这两个时间点只有 JS 层知道。

### 实现

```kotlin
// Native 层：打点 + 收集 + 独立线程上报
object PerfCollector {
    private val timestamps = ConcurrentHashMap<String, Long>()
    private val reportThread = HandlerThread("perf-report").apply { start() }
    private val handler = Handler(reportThread.looper)

    fun mark(key: String) { timestamps[key] = System.currentTimeMillis() }

    // JS 层通过 TurboModule 调用，上浮打点数据
    fun markFromJS(key: String, timestamp: Long) { timestamps[key] = timestamp }

    fun report() {
        handler.post {  // 独立线程上报，不占 UI/JS
            val metrics = buildMetrics(timestamps)
            if (isDebug) Log.d("Perf", metrics.toString())  // 开发阶段本地输出
            else analytics.report("perf_startup", metrics)   // 线上上报
        }
    }
}
```

```typescript
// JS 层：打点后上浮到 Native
function markFirstLayout() {
  PerfModule.markFromJS('t3_firstLayout', Date.now());
}

function markContentReady() {
  PerfModule.markFromJS('t4_contentReady', Date.now());
  PerfModule.report();  // 触发 Native 上报
}

// 超时检测
useEffect(() => {
  const timer = setTimeout(() => {
    PerfModule.markFromJS('whitescreen', Date.now());
    PerfModule.report();
  }, 3000);
  return () => clearTimeout(timer);
}, []);
```

### 上报数据

```json
{
  "nativeInit": 120,
  "bundleLoad": 450,
  "firstRender": 80,
  "dataWait": 800,
  "total": 1450,
  "isWhiteScreen": false,
  "device": "Pixel 7",
  "version": "1.2.0"
}
```

**和 MT 秒开率探针 SDK 本质一样**：有限状态机 + 生命周期打点 + 上报。RN 里分 Native 层和 JS 层两部分打点，数据统一上浮到 Native 独立线程上报。

# QA
## 1. 白屏定义, 和FP FMP的关系?

**白屏 = 超过阈值时间后（通常 3-5s），页面仍然没有有意义内容（FMP 未达成）**

| 指标 | 含义 | 算白屏消失？ |
|------|------|------------|
| FP（First Paint） | 第一个像素绘制（可能只是背景色） | ❌ 画了个白背景不算 |
| FCP（First Contentful Paint） | 第一个文本/图片出现 | ⚠️ 骨架屏也算 FCP，但用户觉得还是"白" |
| **FMP（First Meaningful Paint）** | 主要内容可见（列表/文章/核心 UI） | ✅ 这才算白屏消失 |

检测逻辑：页面加载 N 秒后，检查是否有有意义的 DOM/View 内容 → 没有 = 白屏。

> 骨架屏让判断更复杂——FCP 有了但业务数据没出来。严格的白屏检测应基于 FMP 或自定义业务打点（"首屏数据渲染完成"）。

---

## Q: RN 白屏检测业界怎么做？能从 Native 容器层检测吗？

**业界方案**：

| 方案 | 原理 | 层级 |
|------|------|------|
| JS侧: ErrorBoundary | JS 层捕获渲染异常 → 显示降级 UI + 上报 | JS 层 |
| JS侧: 超时检测 | 页面挂载后 N 秒检查是否有有效子节点 | JS 层 |
| Native View 树检查 | 页面加载 N 秒后检查根 View 的 childCount | Native 层 |
| Native 截图检测 | 对根 View 截图 → 取样像素是否全白/全单色 | Native 层 |

**Native 容器层能检测吗？能。**

- **View 树检查**：拿到 RN 根 View（`ReactRootView` 本身就是一个 Android ViewGroup，Native Shell 创建它时就持有引用），N 秒后检查 `rootView.childCount == 0` → 白屏
- **截图检测**：对根 View 截图，采样几个点颜色一致 → 白屏

> Native 层检测的好处：即使 JS 完全崩了（ErrorBoundary 都没触发），Native 层还是能兜底检测到。

**Q: Native 侧拿不到崩的原因，SDK 设计必须双层（JS + Native）吗？**

对。JS 层负责"知道为什么崩"（ErrorBoundary 有具体错误堆栈），Native 层负责"JS 崩了也能兜底检测到"。业界也是这样——两层配合，JS 是主力，Native 是兜底。

| | JS 层 | Native 层 |
|--|------|-----------|
| 检测什么 | ErrorBoundary 捕获 + 超时检查组件树有无内容 | 超时检查 rootView.childCount 或截图像素 |
| 能拿到什么 | 具体错误堆栈 + 哪个组件崩了 | 只知道"白屏了"，不知道为什么 |
| 什么时候失效 | JS 线程完全卡死/崩溃 | 不会失效（独立于 JS） |

JS 是主力因为：绝大多数白屏是 JS 层问题（组件报错/数据为空/接口失败），ErrorBoundary 能精确定位。Native 只用来覆盖 JS 完全崩了的极端场景。

**Q: 白屏检测到后，是不是像热更新一样本地回滚？**

对。Native Shell 检测到白屏 → 标记当前 Bundle 版本为 failed → 下次启动加载上一个稳定版本。和 HMR 客户端自动回滚同一个机制。当次可以直接 reload 上一版本或显示兜底 UI。

**Q: 上报统一走 Native 层专门线程？**

对。JS 层检测到白屏后通过 Bridge 交给 Native 的 Sentry SDK 上报。好处：离线缓存（Sentry SDK 内置磁盘队列，无网时自动缓存，恢复后自动重发，不需要手动处理）+ 专门上报线程（不阻塞 UI/JS）+ 统一通道。

---

# 注释

<a id="注释分片用宏任务不是微任务"></a>
## 1. 分片用宏任务，不是微任务

分片的目的是**让出线程给渲染**，所以必须用宏任务。微任务在当前帧同步代码之后立即执行，不让出线程，还是阻塞渲染。

```
微任务：同步代码 → 微任务全部执行 → 渲染  ← 不让出，还是阻塞
宏任务：同步代码 → 微任务 → 渲染 → 下一帧宏任务  ← 每帧之间有渲染机会
```

RN 中用 `InteractionManager.runAfterInteractions()`，H5 中用 `setTimeout` / `requestAnimationFrame`。

---

## Q: 白屏的归因和治理？

### 归因（为什么白屏）

| 原因 | 层级 | 怎么确认 |
|------|------|---------|
| JS Error 导致组件崩溃 | JS | ErrorBoundary 捕获 + Sentry 堆栈 |
| Bundle 加载失败 | Native Shell | Bundle 加载回调 status != success [→注释](#注释bundle-加载状态回调) |
| 接口超时/失败 → 无数据渲染 | JS | 网络监控 + 空数据兜底缺失 |
| 热更新包不兼容 | Native Shell | 版本号 vs minNativeVersion 不匹配 |
| JS 线程卡死（死循环/长任务） | JS | Native 侧超时检测到白屏但无 JS Error |

### 治理（白屏了怎么办）

| 阶段 | 手段 |
|------|------|
| **预防** | ErrorBoundary 每个路由页包一层 + 接口数据空值兜底 + 热更新 minNativeVersion 卡控 |
| **检测** | JS 层超时检查 + Native 层 View 树/截图兜底 |
| **恢复** | 当次：reload 页面 / 显示降级 UI（重试按钮）；下次启动：回滚到上一稳定 Bundle |
| **上报** | 通过 Bridge → Sentry 上报（白屏类型 + 版本 + 堆栈） |
| **防退化** | CI 门禁跑 E2E 检测核心页面白屏 + 灰度阶段监控白屏率 |

---

<a id="注释bundle-加载状态回调"></a>
## 注释：Bundle 加载状态回调

RN 框架暴露了 Bundle 加载的生命周期事件，Native Shell 监听即可：

```kotlin
// ─── Android ───
// ReactInstanceManager 加载成功回调
reactInstanceManager.addReactInstanceEventListener { context ->
    // Bundle 加载成功，JS 引擎就绪
}
// 失败通过 DevSupportManager 错误回调
```

```swift
// ─── iOS ───
NotificationCenter.default.addObserver(forName: .RCTJavaScriptDidLoad, ...)       // 成功
NotificationCenter.default.addObserver(forName: .RCTJavaScriptDidFailToLoad, ...) // 失败
```

→ 详见 [XRN Bundle 加载运行](../../XRN/bundle-runtime.md)
