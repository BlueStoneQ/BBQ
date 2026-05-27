# RN Android 层预请求 & 预加载

## 目录

- [解决什么问题](#解决什么问题)
- [整体方案](#整体方案)
- [预请求（Native 层发起网络请求）](#预请求native-层发起网络请求)
- [预加载（RN 引擎预热）](#预加载rn-引擎预热)
- [数据传递：Native → JS](#数据传递native--js)
- [效果](#效果)
- [和纯 JS 侧预加载的区别](#和纯-js-侧预加载的区别)

---

## 解决什么问题

RN 页面冷启动链路中，**网络请求是最大的串行瓶颈**：

```
正常流程（串行）：
  Native 初始化 → RN 引擎初始化 → JS Bundle 加载 → JS 执行 → 发起请求 → 等待响应 → 渲染
  |←————— ~1500ms ————————→|←— 请求 500ms —→|
  
  用户等待 = 引擎初始化 + JS 加载 + 网络请求 ≈ 2000ms
```

**核心矛盾**：JS 还没加载完，网络请求就不能发。但网络请求不依赖 JS 逻辑，完全可以提前。

---

## 整体方案

```
优化后（并行）：
  Native 初始化 ──→ RN 引擎初始化 → JS Bundle 加载 → JS 执行 → 读取缓存数据 → 渲染
       │
       └──→ Native 层同时发起预请求 ──→ 数据缓存到内存
  
  用户等待 = max(引擎初始化 + JS 加载, 网络请求) ≈ 1500ms
  节省 ≈ 500ms（请求耗时被并行掉了）
```

**思路**：在 Native 层（Java/Kotlin）提前发起网络请求，数据缓存在内存中，JS 侧加载完后直接读取，不用再等网络。

---

## 预请求（Native 层发起网络请求）

### 触发时机

```kotlin
// 在用户即将进入 RN 页面时触发（比如点击了跳转按钮）
// 不等 RN 引擎初始化完成，Native 层直接发请求

class PrefetchManager {
    private val cache = ConcurrentHashMap<String, PrefetchResult>()

    // 在路由跳转时调用（Activity.onCreate 或更早）
    fun prefetch(url: String, params: Map<String, Any>) {
        val requestId = generateId(url, params)
        
        // Native 层直接用 OkHttp 发请求
        OkHttpClient().newCall(buildRequest(url, params)).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                cache[requestId] = PrefetchResult(
                    data = response.body?.string(),
                    timestamp = System.currentTimeMillis()
                )
            }
            override fun onFailure(call: Call, e: IOException) {
                cache[requestId] = PrefetchResult(error = e.message)
            }
        })
    }

    // JS 侧通过 TurboModule 读取
    fun getResult(requestId: String): PrefetchResult? {
        return cache.remove(requestId)  // 读取后移除，避免内存泄漏
    }
}
```

### 触发位置

```kotlin
// 方式一：在前一个页面点击跳转时
class HomeActivity : Activity() {
    fun onItemClick(itemId: String) {
        // 先发预请求
        PrefetchManager.prefetch("/api/detail", mapOf("id" to itemId))
        // 再跳转 RN 页面
        startActivity(Intent(this, RNActivity::class.java))
    }
}

// 方式二：在 RN Activity 的 onCreate 中（比 JS 加载早 ~1000ms）
class RNActivity : ReactActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        PrefetchManager.prefetch("/api/page-data", extractParams(intent))
        super.onCreate(savedInstanceState)  // 这里才开始初始化 RN 引擎
    }
}
```

---

## 预加载（RN 引擎预热）

除了预请求，还可以**预热 RN 引擎**（在用户还没进入 RN 页面时就初始化好）：

```kotlin
// Application 启动时或首页空闲时预热
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // 主线程空闲时预热 RN 引擎
        Handler(Looper.getMainLooper()).postDelayed({
            ReactInstanceManager.builder()
                .setApplication(this)
                .setBundleAssetName("index.android.bundle")
                .setJSMainModulePath("index")
                .build()
                .createReactContextInBackground()  // 后台初始化
        }, 3000)  // 延迟 3s，不影响首页启动
    }
}
```

**效果**：用户进入 RN 页面时，引擎已经初始化好了，省去 ~500ms。

---

## 数据传递：Native → JS

JS 侧通过 TurboModule 读取 Native 缓存的预请求数据：

```typescript
// NativePrefetchModule.ts（Spec）
import { TurboModule, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getResult(requestId: string): string | null;  // 同步读取（JSI 支持）
  hasResult(requestId: string): boolean;
}

export default TurboModuleRegistry.getEnforcing<Spec>('PrefetchModule');
```

```typescript
// JS 侧使用
function usePageData(pageId: string) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // 先尝试读取 Native 预请求的数据
    const cached = NativePrefetchModule.getResult(`page_${pageId}`);
    
    if (cached) {
      setData(JSON.parse(cached));  // 命中预请求，直接用
    } else {
      fetchPageData(pageId).then(setData);  // 未命中，正常请求
    }
  }, [pageId]);

  return data;
}
```

---

## 效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 首屏数据就绪时间 | ~2000ms | ~1500ms | -25% |
| 用户感知白屏时间 | ~1800ms | ~1200ms | -33% |
| 网络请求等待（被并行掉） | 500ms 串行 | 0ms（已缓存） | -100% |

---

## 和纯 JS 侧预加载的区别

| | JS 侧预加载（MT 优选小程序） | Native 层预请求（RN） |
|--|---|---|
| 触发时机 | 路由跳转前（JS 已加载） | Activity.onCreate（JS 还没加载） |
| 能提前多少 | 只能提前"请求等待时间" | 能提前"引擎初始化 + JS 加载 + 请求"全部 |
| 实现层 | 纯 JS（发布-订阅 + 并发请求） | Native（OkHttp）+ TurboModule 传递 |
| 适用场景 | 小程序/SPA（JS 已在运行） | RN 冷启动（JS 还没加载） |
| 复杂度 | 低（纯 JS） | 中（需要 Native + JS 协作） |

### 话术

> "在 MT 优选我做过 JS 侧的数据预加载（发布-订阅 + 请求并发），但那是在 JS 已经运行的前提下。到了 RN 场景，瓶颈在于 JS 还没加载完就不能发请求。所以我把预请求下沉到 Native 层——在 Activity.onCreate 时用 OkHttp 直接发请求，数据缓存在内存中，JS 加载完后通过 TurboModule 同步读取。这样网络请求和引擎初始化完全并行，首屏快了 500ms+。"
