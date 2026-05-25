# 白屏检测与治理

> 问题：页面跳转后/列表滚动时出现白屏（空白区域）
>
> 本质：内容还没渲染出来，用户看到空白
>
> 目标：任何场景下用户都不会看到纯白屏

---

## 目录

- [白屏分类](#白屏分类)
- [如何分析](#如何分析)
- [如何优化](#如何优化)
  - [启动白屏](#启动白屏)
  - [页面跳转白屏](#页面跳转白屏)
  - [列表滚动白屏](#列表滚动白屏)
  - [JS Crash 白屏](#js-crash-白屏)
  - [数据加载白屏](#数据加载白屏)
- [白屏检测方案](#白屏检测方案)
- [Performance Monitor（RN 内置工具）](#performance-monitorrn-内置工具)
- [JS 执行阻塞与白屏](#js-执行阻塞与白屏)
  - [本质](#本质)
  - [为什么会阻塞？](#为什么会阻塞)
  - [解决方案](#解决方案)
- [白屏检测 SDK 设计](#白屏检测-sdk-设计)
  - [本质](#本质)
  - [架构](#架构)
  - [实现](#实现)
  - [上报数据](#上报数据)

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

## 如何分析

| 工具 | 看什么 |
|------|--------|
| 肉眼 + 录屏 | 白屏出现的时机和持续时间 |
| Performance Monitor | 白屏时 JS/UI 帧率 |
| React DevTools | 组件树是否为空 / ErrorBoundary 是否触发 |
| Sentry | 是否有 JS 异常导致白屏 |

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
| **分片处理（chunking）** | 大任务拆成小块，每帧只做一块 | 不连续占用 JS 线程 |

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
