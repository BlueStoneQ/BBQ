# RN 工程化深度方案

## 目录

- [DDD → Monorepo 目录设计](#ddd--monorepo-目录设计)
  - [目录结构](#核心思路)
  - [模块依赖规则](#模块依赖规则)
  - [构建产物](#构建产物)
- [容器侧：多 Bundle 加载容器（Android）](#容器侧多-bundle-加载容器android)
  - [整体架构](#整体架构)
  - [ReactInstancePool — 实例池](#reactinstancepool--实例池)
  - [NativeRouter — 原生路由管理](#nativerouter--原生路由管理)
  - [两层路由设计](#两层路由设计一个-bundle-多个页面)
  - [BundleLoader — Bundle 加载器](#bundleloader--bundle-加载器)
  - [PrefetchManager — 预加载 & 预请求](#prefetchmanager--预加载--预请求)
  - [容器加载流程](#容器加载流程)
- [CI/CD：Bundle 版本管理与热更新](#cicdbundle-版本管理与热更新)
  - [Bundle 版本管理](#bundle-版本管理)
  - [独立发布流程](#独立发布流程)
  - [热更新 Native 端方案](#热更新-native-端方案)
  - [CI/CD Pipeline](#cicd-pipelinegitlab-ci)
  - [版本兼容性保障](#版本兼容性保障)

---

## DDD → Monorepo 目录设计

### 核心思路

按业务域（Domain）划分模块边界，每个域独立开发/构建/发布，通过 monorepo 统一管理。

```
packages/
├── common/                  ← 公共 Bundle（RN 框架 + 基础组件 + 工具库）
│   ├── src/
│   │   ├── components/      # 通用 UI 组件（Button、Modal、Toast）
│   │   ├── hooks/           # 通用 Hooks（useAuth、useNetwork）
│   │   ├── utils/           # 工具函数
│   │   └── navigation/      # 路由注册表
│   └── package.json
├── features/
│   ├── home/                ← 首页业务域 Bundle
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/    # 该域的 API 层
│   │   └── package.json
│   ├── device/              ← 设备管理域 Bundle（BLE 连接、控制）
│   └── settings/            ← 设置域 Bundle
├── native-modules/          ← TurboModule 原生模块
│   ├── ble-sdk/
│   └── ota-sdk/
└── app/                     ← 壳工程（组装所有 Bundle + Native 容器）
    ├── android/
    ├── ios/
    └── src/index.ts         # 入口：注册路由 + 加载 common bundle
```

### 模块依赖规则

```
app → 依赖所有 features + common + native-modules
features/* → 只能依赖 common（不能互相依赖）
common → 不依赖任何 feature
native-modules → 不依赖 JS 层
```

### 构建产物

```
Metro 分 Bundle 构建：
  common.bundle     ← 公共代码（RN 框架 + 基础库），所有页面共享
  home.bundle       ← 首页业务代码（只含该域的增量代码）
  device.bundle     ← 设备管理业务代码
  settings.bundle   ← 设置业务代码
```

---

## 容器侧：多 Bundle 加载容器（Android）

### 整体架构

```
┌─────────────────────────────────────────────────────┐
│  RN Container Manager（容器管理器，单例）              │
│  职责：实例池管理、Bundle 加载调度、路由分发            │
├─────────────────────────────────────────────────────┤
│  ReactInstancePool（实例池）                          │
│  ├── CommonInstance（预加载，常驻内存）                │
│  ├── FeatureInstance[home]（按需创建/复用）           │
│  └── FeatureInstance[device]（按需创建/复用）         │
├─────────────────────────────────────────────────────┤
│  NativeRouter（原生路由管理）                         │
│  职责：拦截 JS 路由请求 → 决定用哪个容器/Bundle       │
├─────────────────────────────────────────────────────┤
│  BundleLoader（Bundle 加载器）                       │
│  职责：从本地/远端加载 Bundle → 校验 → 注入实例       │
├─────────────────────────────────────────────────────┤
│  PrefetchManager（预加载/预请求）                     │
│  职责：提前初始化引擎 + 提前发网络请求                 │
└─────────────────────────────────────────────────────┘
```

### 关键对象

#### ReactInstancePool — 实例池

```kotlin
/**
 * RN 实例池：管理多个 ReactInstanceManager 的生命周期
 * 
 * 来源：自研（RN 框架只提供单实例，多 Bundle 需要自己管理多实例）
 * 作用：复用已初始化的 RN 引擎实例，避免重复创建（创建一次 ~500ms）
 * 
 * 设计：
 *   - commonInstance：常驻内存，App 启动时预热，加载 common.bundle
 *   - featurePool：LRU 缓存，最多保留 N 个 feature 实例
 *   - 超出 LRU 上限时销毁最久未使用的实例（释放内存）
 */
class ReactInstancePool(private val application: Application) {

    // 公共实例（常驻，加载 common.bundle）
    private var commonInstance: ReactInstanceManager? = null

    // Feature 实例池（LRU，key = bundleName）
    // LruCache = Android SDK 提供的 LinkedHashMap + 容量上限
    //   - 底层是 Map（K-V 存取，O(1) 查找）
    //   - 按访问顺序排序（最近用的排前面）
    //   - 超过 maxSize 时自动淘汰最久未访问的条目（调用 entryRemoved 回调）
    private val featurePool = object : LruCache<String, ReactInstanceManager>(MAX_POOL_SIZE) {
        // 被淘汰时的回调：销毁 RN 实例，释放内存
        override fun entryRemoved(
            evicted: Boolean,
            key: String,
            oldValue: ReactInstanceManager,
            newValue: ReactInstanceManager?
        ) {
            if (evicted) {
                oldValue.destroy()  // 销毁 V8/Hermes 引擎 + 释放 Native 资源
            }
        }
    }

    /**
     * 实例池设计说明：
     *
     * 【什么时候销毁实例】
     *   1. LRU 淘汰：池满（MAX_POOL_SIZE=3）时新增实例 → 最久未用的自动销毁
     *   2. 系统内存不足：收到 onTrimMemory(TRIM_MEMORY_RUNNING_LOW) → 主动清空池
     *   3. 热更新后：Bundle 版本变了 → 旧实例失效，移除并销毁
     *   4. App 退到后台超时：超过 5 分钟 → 清空非 common 实例
     *
     * 【池中没有可用实例时怎么办】
     *   → 创建新实例（createFeatureInstance）
     *   → 加载对应 Bundle
     *   → 放入池中（如果池满，LRU 自动淘汰最旧的）
     *   → 耗时 ~300-500ms（所以才需要预热和复用）
     *
     * 【为什么用 LRU 而不是无限缓存】
     *   - 每个 RN 实例占 ~30-50MB 内存（Hermes 引擎 + JS 堆 + Native View 树）
     *   - 3 个实例 = ~150MB，低端机（2GB RAM）承受不了更多
     *   - LRU 保证高频页面常驻，低频页面自动释放
     *
     * 【池大小和创建时机】
     *   MAX_POOL_SIZE = 3（feature 实例）+ 1 个 common（常驻，不算在池内）
     *   依据：用户同时活跃页面栈一般不超过 3 层；3×40MB≈120MB 中端机可接受
     *   低端机可降为 2，通过设备等级动态配置
     *
     *   创建时机：
     *     - common：App 启动时预热（Application.onCreate 延迟 2~3s）
     *     - 首屏 feature：App 启动后空闲时预创建（用户最可能进入的页面）
     *     - 其他 feature：用户首次进入时按需创建（懒加载，创建后放入池复用）
     *
     *   时序：
     *     App 启动 → 立即预热 common
     *     → 空闲 3~5s 后 → 预创建 home（首屏高概率）
     *     → 用户点击"设备" → 按需创建 device → 放入池
     *     → 用户点击"设置" → 按需创建 settings → 池满 → LRU 淘汰最旧的
     *
     * 【池和 Activity 的关系】
     *   池管理的是 ReactInstanceManager（引擎实例），不是 Activity。
     *   实例创建后一直在池中，不会因为路由切换而"释放回池"——它本来就在池里。
     *
     *   路由切换时：
     *     home → device：
     *       - home Activity 进入后台栈（onStop），实例不销毁，留在池中
     *       - device Activity 到前台，从池中 get("device") 复用引擎
     *     用户按返回键回到 home：
     *       - device Activity 销毁（onDestroy），但引擎实例仍在池中（下次进入秒开）
     *       - home Activity 回到前台，引擎实例还在池里，直接用
     *
     *   只有 LRU 淘汰 / 系统内存不足 / 热更新版本变更时，实例才真正销毁。
     *   Activity 可以反复创建/销毁，引擎实例保持存活 → 下次进入同 Bundle 不用重新加载。
     */

    /**
     * 获取或创建 Feature 实例
     * 1. 池中有 → 直接返回（复用，0ms）
     * 2. 池中没有 → 基于 commonInstance 创建新实例 + 加载 feature bundle
     */
    fun getOrCreate(bundleName: String): ReactInstanceManager {
        featurePool.get(bundleName)?.let { return it }

        val instance = createFeatureInstance(bundleName)
        featurePool.put(bundleName, instance)
        return instance
    }

    /**
     * App 启动时预热公共实例（在 Application.onCreate 中调用）
     * 效果：用户进入 RN 页面时引擎已就绪，省去 ~500ms 初始化
     */
    fun warmUp() {
        commonInstance = ReactInstanceManager.builder()
            .setApplication(application)
            .setBundleAssetName("common.bundle")  // 加载公共 Bundle
            .setJSMainModulePath("packages/common/src/index")
            .addPackages(getCommonPackages())      // 注册公共 TurboModule
            .setUseDeveloperSupport(BuildConfig.DEBUG)
            .build()
        commonInstance?.createReactContextInBackground()  // 后台初始化
    }

    private fun createFeatureInstance(bundleName: String): ReactInstanceManager {
        return ReactInstanceManager.builder()
            .setApplication(application)
            .setJSBundleFile(BundleLoader.getBundlePath(bundleName))  // feature bundle 路径
            .addPackages(getFeaturePackages(bundleName))
            .setUseDeveloperSupport(BuildConfig.DEBUG)
            .build()
    }
}
```

#### NativeRouter — 原生路由管理

```kotlin
/**
 * 原生路由管理器
 * 
 * 来源：自研（RN 默认的 React Navigation 只管 JS 内路由，跨 Bundle 需要 Native 层调度）
 * 作用：
 *   - 拦截 JS 侧的路由跳转请求
 *   - 根据路由表判断目标页面属于哪个 Bundle
 *   - 决定是复用当前容器还是创建新容器
 *   - 管理 Activity/Fragment 栈
 *
 * 【为什么自研而不用现成库】
 *   - React Navigation（@react-navigation/native-stack）：只管单 Bundle 内路由，不知道 Bundle 的存在
 *   - react-native-navigation（Wix）：每页一个原生容器，但不支持多 Bundle 加载调度
 *   - 多 Bundle + 混合栈场景必须自研 Native 层调度（核心代码 ~200 行，很薄）
 *
 * 【和 React Navigation 的配合】
 *   - Bundle 内页面导航：用 @react-navigation/native-stack（原生动画，体验好）
 *   - 跨 Bundle 跳转：自研 NativeRouter 调度（创建新 Activity）
 *   - 两者不冲突，各管各的层级
 *
 * 【跨 Bundle 跳转动画】
 *   跨 Bundle = startActivity → 原生 Activity 切换动画天然生效
 *   可自定义：overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
 *
 * 【多 Activity vs 单 Activity 切换 Bundle】
 *   方案一：多 Activity（每个 Bundle 一个 Activity）← 我们的选择
 *     优点：天然隔离（crash 不互相影响）、原生返回栈、原生切换动画、实现简单
 *     缺点：内存占用高（多个引擎实例）→ 用实例池 LRU 控制
 *   方案二：单 Activity + 切换 Bundle
 *     优点：内存省（复用同一个容器）
 *     缺点：状态管理复杂、没有原生返回栈、需手动清理旧 View
 *   
 *   业界主流选多 Activity（携程 CRN、美团）：隔离性好 + 返回栈系统管理 + 配合实例池内存可控
 */
class NativeRouter private constructor() {

    // 路由表：路由路径 → Bundle 名（启动时从配置加载）
    // 例："/device/control" → "device", "/home" → "home"
    private val routeTable = mutableMapOf<String, String>()

    /**
     * JS 侧调用 navigation.navigate('/device/control') 时触发
     * 通过 TurboModule 暴露给 JS
     */
    fun navigate(route: String, params: Bundle?) {
        val bundleName = routeTable[route]?.bundleName ?: throw RouteNotFoundException(route)
        val currentBundle = getCurrentBundleName()

        if (bundleName == currentBundle) {
            // 同 Bundle 内跳转 → 走 JS 侧 React Navigation（不创建新容器）
            // 一个 Bundle 可以包含多个页面，内部路由由 JS 层管理
            sendEventToJS("navigate", route, params)
        } else {
            // 跨 Bundle 跳转 → 创建新 Activity 加载目标 Bundle
            // initialRoute 告诉 JS 侧进入 Bundle 后显示哪个页面
            val intent = Intent(context, RNContainerActivity::class.java).apply {
                putExtra("bundleName", bundleName)
                putExtra("initialRoute", route)  // ← Bundle 内的具体页面路径
                putExtra("params", params)
            }
            context.startActivity(intent)
        }
    }
}
```

### 两层路由设计（一个 Bundle 多个页面）

**核心**：Native Router 管 Bundle 级跳转，JS Router（React Navigation）管 Bundle 内页面跳转。

```
路由表结构：
  路由路径 → { bundleName, isEntry }

  "/device/list"     → { bundle: "device", isEntry: true }   ← Bundle 入口页
  "/device/control"  → { bundle: "device", isEntry: false }  ← Bundle 内部页
  "/device/settings" → { bundle: "device", isEntry: false }  ← Bundle 内部页
  "/home"            → { bundle: "home",   isEntry: true }
```

```
跳转决策流程：

NativeRouter.navigate("/device/control")
  │
  ▼ 查路由表 → bundleName = "device"
  │
  ▼ 当前已在 device Bundle 内？
  │
  ├─ 是 → 发事件给 JS 侧 React Navigation
  │        JS 内部 navigation.navigate("DeviceControl", params)
  │        （Bundle 内跳转，不创建新容器，不重新加载 Bundle）
  │
  └─ 否 → 创建/复用 device 容器（Activity）
           → 加载 device.bundle
           → 传入 initialRoute = "/device/control"
           → JS 侧 React Navigation 根据 initialRoute 渲染对应页面
```

**JS 侧 Bundle 入口**（每个 feature bundle 的 index.ts）：

```tsx
// packages/features/device/src/index.ts
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

// initialRoute 从 Native 传入（通过 initialProperties）
export default function DeviceApp({ initialRoute = '/device/list' }) {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={routeToScreen(initialRoute)}>
        <Stack.Screen name="DeviceList" component={DeviceListScreen} />
        <Stack.Screen name="DeviceControl" component={DeviceControlScreen} />
        <Stack.Screen name="DeviceSettings" component={DeviceSettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**总结**：
- Native 层只关心"用哪个 Bundle"（粗粒度）
- JS 层管 Bundle 内部的页面栈（细粒度）
- `initialRoute` 是两层路由的桥梁——Native 告诉 JS "进来后显示哪个页面"
```

#### BundleLoader — Bundle 加载器

```kotlin
/**
 * Bundle 加载器
 * 
 * 来源：自研（RN 默认只支持单 Bundle 加载，多 Bundle 需要自己管理路径和版本）
 * 作用：
 *   - 管理 Bundle 文件的存储路径（内置 assets / 热更新下载目录）
 *   - 加载优先级：热更新版本 > 内置版本
 *   - 完整性校验（MD5/SHA256）
 *   - 加载失败回退到内置版本
 */
class BundleLoader(private val context: Context) {

    companion object {
        // 内置 Bundle 目录（APK assets 中）
        private const val ASSETS_PREFIX = "assets://"
        // 热更新 Bundle 下载目录
        private val HOT_UPDATE_DIR = "${context.filesDir}/bundles/"
    }

    /**
     * 获取 Bundle 文件路径（优先热更新版本）
     * 
     * 查找顺序：
     * 1. 热更新目录有该 Bundle 且校验通过 → 用热更新版本
     * 2. 否则 → 用 APK 内置版本（assets://xxx.bundle）
     */
    fun getBundlePath(bundleName: String): String {
        val hotUpdatePath = "${HOT_UPDATE_DIR}${bundleName}.bundle"
        val hotUpdateFile = File(hotUpdatePath)

        if (hotUpdateFile.exists() && verifyChecksum(hotUpdateFile, bundleName)) {
            return hotUpdatePath  // 热更新版本
        }

        return "${ASSETS_PREFIX}${bundleName}.bundle"  // 内置版本
    }

    /**
     * 校验 Bundle 完整性（防篡改 + 防损坏）
     */
    private fun verifyChecksum(file: File, bundleName: String): Boolean {
        val expectedHash = VersionManager.getExpectedHash(bundleName)
        val actualHash = file.sha256()
        return expectedHash == actualHash
    }
}
```

#### PrefetchManager — 预加载 & 预请求

```kotlin
/**
 * 预加载管理器
 * 
 * 来源：自研（参考 MT 优选数据预加载方案，下沉到 Native 层）
 * 作用：
 *   - 引擎预热：App 启动时后台初始化 RN 引擎
 *   - 数据预请求：路由跳转前 Native 层提前发网络请求
 *   - Bundle 预下载：空闲时预下载可能用到的 feature bundle
 * 
 * 效果：用户进入 RN 页面时，引擎已就绪 + 数据已缓存 → 首屏 -500ms+
 */
class PrefetchManager(private val context: Context) {

    private val dataCache = ConcurrentHashMap<String, PrefetchResult>()

    /**
     * 数据预请求（在路由跳转前调用）
     * Native 层用 OkHttp 直接发请求，不等 JS 加载完
     */
    fun prefetchData(route: String, params: Map<String, Any>) {
        val requestId = generateId(route, params)
        val apiUrl = RouteApiMapping.getApiUrl(route)  // 路由 → API 映射表

        OkHttpClient().newCall(Request.Builder().url(apiUrl).build())
            .enqueue(object : Callback {
                override fun onResponse(call: Call, response: Response) {
                    dataCache[requestId] = PrefetchResult(data = response.body?.string())
                }
                override fun onFailure(call: Call, e: IOException) {
                    // 预请求失败不影响正常流程，JS 侧会兜底请求
                }
            })
    }

    /**
     * JS 侧通过 TurboModule 读取预请求数据
     * 命中 → 直接用缓存；未命中 → JS 正常发请求
     */
    fun getResult(requestId: String): String? {
        return dataCache.remove(requestId)?.data
    }
}
```

### 容器加载流程

```
用户点击跳转 → NativeRouter.navigate("/device/control")
  │
  ├─ PrefetchManager.prefetchData("/device/control")  ← 立即发预请求
  │
  ▼ 判断：跨 Bundle？
  │
  ▼ 是 → 启动 RNContainerActivity
  │
  ▼ ReactInstancePool.getOrCreate("device")
  │  ├─ 池中有 → 直接复用（0ms）
  │  └─ 池中没有 → 创建实例 + BundleLoader.getBundlePath("device")
  │                 ├─ 热更新版本存在且校验通过 → 加载热更新 bundle
  │                 └─ 否则 → 加载 assets 内置 bundle
  │
  ▼ 实例加载 Bundle → JS 执行 → 读取预请求数据 → 渲染首屏
```

---

## CI/CD：Bundle 版本管理与热更新

### Bundle 版本管理

```
每个 Bundle 独立版本号：
  common.bundle  → v2.1.0（改了公共组件）
  home.bundle    → v1.3.2（改了首页逻辑）
  device.bundle  → v1.0.5（修了 BLE bug）

版本清单文件（manifest.json）：
{
  "appVersion": "3.0.0",
  "minNativeVersion": "2.8.0",
  "bundles": {
    "common": { "version": "2.1.0", "hash": "abc123", "size": 1024000 },
    "home":   { "version": "1.3.2", "hash": "def456", "size": 256000 },
    "device": { "version": "1.0.5", "hash": "ghi789", "size": 128000 }
  }
}
```

### 独立发布流程

```
开发者改了 device 模块代码
  │
  ▼ CI 检测到 features/device/ 有变更
  │
  ▼ 只构建 device.bundle（不重新构建 common/home）
  │
  ▼ 计算 hash + 更新 manifest.json
  │
  ▼ 上传到 CDN / 热更新服务器
  │
  ▼ App 端检查更新：对比本地 manifest vs 远端 manifest
  │  只有 device 版本变了 → 只下载 device.bundle（128KB）
  │
  ▼ 下载 → 校验 hash → 存入热更新目录
  │
  ▼ 下次进入 device 页面 → BundleLoader 加载新版本
```

### 热更新 Native 端方案

```kotlin
/**
 * 热更新管理器
 * 
 * 流程：检查更新 → 差量下载 → 校验 → 存储 → 下次启动生效
 * 
 * 策略：
 *   - 静默更新：后台下载，下次冷启动生效（用户无感知）
 *   - 强制更新：下载完成后提示用户重启（紧急 bug 修复）
 *   - 灰度发布：服务端按用户 ID / 比例下发（1% → 10% → 100%）
 */
class HotUpdateManager(private val context: Context) {

    /**
     * 检查更新
     * 
     * 检测时机（都在后台，不阻塞用户）：
     *   - App 冷启动后：首屏渲染完成后，后台线程检查（不阻塞启动）
     *   - App 从后台切回前台：onResume 时检查（用户可能离开很久）
     *   - 定时轮询：每 30min~1h 检查一次（App 在前台期间）
     *   - 推送触发：服务端有紧急更新时，通过 Push 通知 App 立即检查
     * 
     * 生效时机：下载完成后下次冷启动生效（静默更新，不中断当前使用）
     */
    fun checkUpdate() {
        val localManifest = ManifestStore.getLocal()
        val remoteManifest = fetchRemoteManifest()  // GET /api/manifest?appVersion=3.0.0

        // 兼容性检查：Native 版本是否满足 Bundle 要求
        if (remoteManifest.minNativeVersion > BuildConfig.VERSION_NAME) {
            // Native 版本太低，需要用户去商店更新 App
            promptAppStoreUpdate()
            return
        }

        // 对比每个 Bundle 的版本
        val updates = remoteManifest.bundles.filter { (name, remote) ->
            val local = localManifest.bundles[name]
            local == null || local.version != remote.version
        }

        if (updates.isNotEmpty()) {
            downloadBundles(updates)
        }
    }

    /**
     * 下载更新的 Bundle（支持差量）
     */
    private fun downloadBundles(updates: Map<String, BundleInfo>) {
        updates.forEach { (name, info) ->
            val url = "${CDN_BASE}/${name}/${info.version}/${name}.bundle"
            val targetPath = "${context.filesDir}/bundles/${name}.bundle"

            // 下载
            downloadFile(url, targetPath)

            // 校验完整性
            if (File(targetPath).sha256() != info.hash) {
                File(targetPath).delete()  // 校验失败，删除损坏文件
                reportError("Bundle $name hash mismatch")
                return@forEach
            }

            // 更新本地 manifest
            ManifestStore.updateBundle(name, info)
        }
    }

    /**
     * 回滚机制：如果新 Bundle 导致 crash，自动回退到内置版本
     */
    fun onCrashDetected(bundleName: String) {
        val hotUpdatePath = "${context.filesDir}/bundles/${bundleName}.bundle"
        File(hotUpdatePath).delete()  // 删除热更新版本
        ManifestStore.removeBundle(bundleName)  // 清除版本记录
        // 下次加载时 BundleLoader 会 fallback 到 assets 内置版本
    }
}
```

### CI/CD Pipeline（GitLab CI）

```yaml
# .gitlab-ci.yml
stages:
  - detect    # 检测哪些 Bundle 有变更
  - build     # 只构建变更的 Bundle
  - verify    # 校验 + 测试
  - publish   # 上传到 CDN + 更新 manifest

detect-changes:
  stage: detect
  script:
    - node scripts/detect-changed-bundles.js  # 对比 git diff，输出变更列表
  artifacts:
    paths:
      - changed-bundles.json

build-bundles:
  stage: build
  script:
    - |
      for bundle in $(cat changed-bundles.json | jq -r '.[]'); do
        npx react-native bundle \
          --entry-file packages/features/${bundle}/src/index.ts \
          --bundle-output dist/${bundle}.bundle \
          --platform android \
          --dev false
        # 计算 hash
        sha256sum dist/${bundle}.bundle > dist/${bundle}.hash
      done
  artifacts:
    paths:
      - dist/

publish-bundles:
  stage: publish
  script:
    - node scripts/upload-to-cdn.js          # 上传 Bundle 到 CDN
    - node scripts/update-manifest.js        # 更新远端 manifest.json
  rules:
    - if: $CI_COMMIT_BRANCH == "release"     # 只在 release 分支发布
```

### 版本兼容性保障

| 场景 | 处理 |
|------|------|
| Bundle 依赖新 Native API | manifest 中 `minNativeVersion` 卡住，低版本 App 不下载 |
| common 更新了 | 所有 feature bundle 需要重新构建（依赖变了） |
| 热更新 Bundle crash | 自动回滚到内置版本（onCrashDetected） |
| 网络下载失败 | 不影响当前版本，下次重试 |
| 用户长期不更新 App | 服务端保留历史版本 manifest，按 appVersion 下发对应 Bundle |
