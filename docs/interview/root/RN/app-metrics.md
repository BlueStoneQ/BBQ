# RN App 指标体系

> 每个指标的完整闭环：定义 → 正常值 → 检测方案 → 根因 → 优化 → 详细文档

## 目录

- [一、启动指标](#一启动指标)
- [二、渲染指标](#二渲染指标)
- [三、交互指标](#三交互指标)
- [四、稳定性指标](#四稳定性指标)
- [五、包体指标](#五包体指标)
- [六、内存指标](#六内存指标)
- [七、网络指标](#七网络指标)
- [八、监控架构](#八监控架构)

---

## 一、启动指标

### 冷启动时间

| 维度 | 内容 |
|------|------|
| **定义** | 用户点击 App 图标 → 首屏渲染完成可见（≈ FCP，RN 中首屏可见后即可交互） |
| **正常值** | < 2s 好，2~3s 一般，> 3s 差 |
| **检测方案** | Android: `adb shell am start -W`；iOS: Instruments → App Launch；线上: 自埋点（Application.onCreate → 首帧回调） |
| **工具** | 自建埋点 SDK + Firebase Performance（线上）；Systrace/Instruments（线下） |
| **常见根因** | 引擎初始化慢、Bundle 大、首屏接口慢、主线程阻塞 |
| **优化方案** | Hermes 预编译、分 Bundle、容器池预热、Native 预请求、Splash 并行策略 |
| **详细文档** | [perf-splash](../cards/card-1/perf-splash.md)、[native-prefetch](./native-prefetch.md)、[rn-engineering-deep](../cards/card-3/rn-engineering-deep.md) |

### 白屏率

| 维度 | 内容 |
|------|------|
| **定义** | 页面加载后超过 3s 仍未渲染出有效内容的比例 |
| **正常值** | < 1% |
| **检测方案** | ① JS 超时埋点（mount 后 3s 未标记渲染完成 = 白屏）；② Native 截图检测（延迟截图 → 采样像素判断是否全白/全黑） |
| **工具** | 自建（超时埋点 + 截图检测），无成熟三方 SDK |
| **常见根因** | Bundle 加载失败、JS 执行报错、首屏接口超时、组件 return null |
| **优化方案** | 离线包兜底 + hash 校验 + ErrorBoundary + 骨架屏 + 预请求 + 降级 H5 |
| **详细文档** | [perf-whitescreen](../cards/card-1/perf-whitescreen.md) |

---

## 二、渲染指标

### FPS（帧率）

| 维度 | 内容 |
|------|------|
| **定义** | 每秒渲染帧数，反映滑动/动画流畅度 |
| **正常值** | ≥ 55fps 好，50~55 一般，< 50 卡顿 |
| **检测方案** | Android: Choreographer 回调计算丢帧；iOS: CADisplayLink 回调；RN: Performance Monitor（Dev Menu） |
| **工具** | Flipper Performance Plugin（开发）；自建 FPS 采集 SDK（线上） |
| **常见根因** | JS 长任务阻塞、过度重渲染、大图解码、列表未虚拟化、离屏渲染 |
| **优化方案** | memo/useCallback、FlashList、Reanimated 3、InteractionManager、图片降采样 |
| **详细文档** | [perf-list](../cards/card-1/perf-list.md)、[perf-animation](../cards/card-1/perf-animation.md)、[perf-bridge](../cards/card-1/perf-bridge.md) |

### JS 线程占用率

| 维度 | 内容 |
|------|------|
| **定义** | JS 线程繁忙时间 / 总时间 |
| **正常值** | < 60% 好，> 80% 卡顿风险 |
| **检测方案** | RN Performance Monitor（实时显示 JS FPS）；Flipper → Performance |
| **工具** | RN 内置 Dev Menu → Show Perf Monitor |
| **常见根因** | 复杂 Diff 计算、大数组排序/过滤、频繁 setState、未拆分长任务 |
| **优化方案** | useTransition、InteractionManager、memo 减少 Diff、计算下沉 C++ |
| **详细文档** | [perf-bridge](../cards/card-1/perf-bridge.md)（JS 线程阻塞通用方案） |

---

## 三、交互指标

### 点击响应时间

| 维度 | 内容 |
|------|------|
| **定义** | 用户点击 → UI 反馈（按钮变色/loading 出现） |
| **正常值** | < 100ms |
| **检测方案** | 自埋点（onPress 时间戳 → UI 更新时间戳） |
| **常见根因** | JS 线程忙、setState 后重渲染慢 |
| **优化方案** | Pressable 即时反馈（opacity/scale）、状态下沉、避免 onPress 中做重计算 |
| **详细文档** | [ux-feedback](../cards/card-1/ux-feedback.md) |

### 页面切换时间

| 维度 | 内容 |
|------|------|
| **定义** | 点击导航 → 新页面首帧可见 |
| **正常值** | < 300ms |
| **检测方案** | React Navigation 的 `onTransitionEnd` 回调计时 |
| **常见根因** | 新页面组件重、数据未预加载、动画期间 JS 阻塞 |
| **优化方案** | 预加载数据、lazy 加载非首屏组件、InteractionManager 延迟重任务 |
| **详细文档** | [perf-navigation](../cards/card-1/perf-navigation.md) |

---

## 四、稳定性指标

### Crash 率

| 维度 | 内容 |
|------|------|
| **定义** | 崩溃会话 / 总会话 |
| **正常值** | < 0.1% |
| **检测方案** | Firebase Crashlytics / Sentry（自动捕获 + 符号化） |
| **工具** | Crashlytics（免费，Google 生态）；Sentry（JS + Native 统一） |
| **常见根因** | Native 空指针、OOM/Jetsam、JNI 类型错误、未捕获 JS 异常导致 Native 层崩溃 |
| **优化方案** | ErrorBoundary 兜底、内存监控主动释放、热更新回滚机制 |
| **详细文档** | [perf-crash](../cards/card-1/perf-crash.md)、[ios-stability](../cards/card-1/ios/ios-stability.md) |

### JS Error 率

| 维度 | 内容 |
|------|------|
| **定义** | JS 未捕获异常数 / 总 PV |
| **正常值** | < 0.5% |
| **检测方案** | Sentry JS SDK / `ErrorUtils.setGlobalHandler`（RN 全局错误捕获） |
| **工具** | Sentry（推荐，JS + Native 统一看板）；Bugsnag |
| **常见根因** | 接口返回异常数据、undefined 访问、三方库 bug、热更新包不兼容 |
| **优化方案** | TypeScript 类型保护、ErrorBoundary、防御性编程、热更新 hash 校验 |

### ANR 率（Android）/ Watchdog Kill（iOS）

| 维度 | 内容 |
|------|------|
| **定义** | 主线程阻塞超时（Android > 5s 弹 ANR；iOS 直接杀进程） |
| **正常值** | < 0.05% |
| **检测方案** | Android: Google Play Console ANR 报告；iOS: MetricKit hang 报告 |
| **工具** | Firebase Crashlytics（ANR 自动上报）；自建 Watchdog 线程检测 |
| **常见根因** | 主线程 IO、锁竞争、大量 View 创建、同步 Bridge 调用（旧架构） |
| **优化方案** | 异步化 IO、减少主线程工作、迁移 JSI（消除 Bridge 阻塞） |

---

## 五、包体指标

### APK/IPA 大小

| 维度 | 内容 |
|------|------|
| **定义** | 安装包文件大小 |
| **正常值** | APK < 30MB，IPA < 50MB |
| **检测方案** | CI 构建后自动检测（对比基线，超阈值告警） |
| **工具** | 自建 CI 脚本；Android: `bundletool get-size`；iOS: App Store Connect Size Report |
| **常见根因** | 未裁剪 ABI、图片未压缩、未用 Hermes、引入大 SDK |
| **优化方案** | ABI Split/AAB、Hermes .hbc、WebP、分 Bundle、R8、App Thinning |
| **详细文档** | [bundle-size](../cards/card-1/bundle-size.md)、[ios-bundle-size](../cards/card-1/ios/ios-bundle-size.md) |

---

## 六、内存指标

### 内存峰值（PSS / Footprint）

| 维度 | 内容 |
|------|------|
| **定义** | App 运行时物理内存占用峰值 |
| **正常值** | < 300MB（中端机）；低端机 < 200MB |
| **检测方案** | Android: `adb shell dumpsys meminfo`；iOS: Xcode Memory Gauge / Instruments Allocations |
| **工具** | Android Profiler（开发）；MetricKit（iOS 线上）；自建定时采样 SDK |
| **常见根因** | 图片缓存过大、RN 实例过多、内存泄漏、大列表未虚拟化 |
| **优化方案** | 实例池 LRU、图片降采样+释放、DEX 布局优化、onTrimMemory 响应 |
| **详细文档** | [perf-memory](../cards/card-1/perf-memory.md)、[ios-memory](../cards/card-1/ios/ios-memory.md)、[perf-image](../cards/card-1/perf-image.md) |

### 内存泄漏

| 维度 | 内容 |
|------|------|
| **定义** | 对象不再使用但未被 GC/ARC 回收，内存持续增长 |
| **正常值** | 内存趋势平稳，无持续增长 |
| **检测方案** | Android: LeakCanary（自动检测 Activity/Fragment 泄漏）；iOS: Instruments → Leaks；JS: Hermes heap snapshot |
| **工具** | LeakCanary（Android，开发时自动弹通知）；Instruments Leaks（iOS） |
| **常见根因** | 未取消订阅（EventEmitter/定时器）、闭包持有大对象、循环引用（iOS） |
| **优化方案** | useEffect return 清理、弱引用、页面卸载时释放资源 |
| **详细文档** | [perf-memory](../cards/card-1/perf-memory.md) |

---

## 七、网络指标

### API 请求成功率 / 耗时

| 维度 | 内容 |
|------|------|
| **定义** | 成功请求 / 总请求；请求发出 → 响应完成的时间 |
| **正常值** | 成功率 > 99.5%；P95 耗时 < 500ms |
| **检测方案** | 网络拦截器埋点（Axios interceptor / fetch wrapper） |
| **工具** | 自建网络监控 SDK；Charles/Flipper（开发调试） |
| **常见根因** | 服务端慢、DNS 解析慢、弱网环境、未做缓存 |
| **优化方案** | 预请求、接口聚合（BFF/GraphQL）、离线缓存、超时重试 |

---

## 八、监控架构

```
App 端
  ├── 性能 SDK（采集启动/帧率/内存/网络）
  ├── Crash SDK（捕获 Native + JS 异常）
  └── 业务埋点 SDK
        │
        ▼ 上报（批量 + 采样）
  数据平台（Kafka → Flink → ClickHouse）
        │
        ▼
  看板 + 告警
        ├── 实时告警：Crash 率突增 → 飞书/Slack
        ├── 趋势告警：启动时间连续 3 天劣化 → 邮件
        ├── 版本对比：新版本 vs 旧版本各指标
        └── CI 卡点：包体/启动时间超阈值 → 构建失败
```

### 工具选型

| 需求 | 推荐 | 说明 |
|------|------|------|
| Crash + ANR | Firebase Crashlytics | 免费、符号化、趋势、Google 生态 |
| JS Error | Sentry | JS + Native 统一、Source Map 支持 |
| 性能（启动/帧率） | Firebase Performance + 自建 | Firebase 基础指标免费，细粒度需自建 |
| 内存 | 自建采样 SDK | 定时采集 PSS 上报，无成熟三方 |
| 网络 | 自建拦截器 | Axios/fetch 层拦截，上报耗时/状态码 |
| 线下分析 | Flipper + React DevTools + Systrace | 开发调试用 |

### 自建 vs 三方

| | 三方（Firebase/Sentry） | 自建 |
|--|---|---|
| 优点 | 开箱即用、免运维、符号化自动 | 完全可控、细粒度、可定制告警规则 |
| 缺点 | 数据在第三方、定制性有限 | 开发成本高、需要运维 |
| 推荐 | Crash/Error 用三方（成熟度高） | 性能指标/业务指标自建（需要定制） |
