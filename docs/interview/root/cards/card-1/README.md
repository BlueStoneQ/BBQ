# 牌 1：性能体验优化

> - 命中：JD1-3（性能与质量保障）+ JD2（性能优化方法）
> - 定位：不是修一个 bug，是建一套"测量→定位→优化→验证→监控→防退化"的体系
> - 核心理念：不仅仅快，还要感知好（Google Core Web Vitals 理念）

---

## 文档索引

- [包体优化方案（ABI Split / JS Bundle / 资源）](./bundle-size.md)
- [RN App 指标体系（启动/渲染/交互/稳定性/监控/白屏检测）](../../RN/app-metrics.md)
- [性能优化](../../RN/performance.md)
- [性能优化分层体系](../../RN/performance-layers.md)
- [性能分析工具与排查](../../RN/performance-profiling.md)
- [Native 层预请求 & 预加载](../../RN/native-prefetch.md)
- [iOS 性能优化专题](./ios/README.md)

---

## 结构化场景

每个场景的分析框架：
1. **如何分析**：用什么工具、看什么指标、怎么定位
2. **如何优化**：从三层角度（RN/JS 层 → Android/iOS Native 层 → C++/Rust 底层）

---

### 一、启动

| 子场景 | Android 文档 | iOS 文档 |
|--------|-------------|---------|
| RN App 启动（冷启动全链路） | [perf-splash.md](./perf-splash.md) | [ios-launch.md](./ios/ios-launch.md) |
| 首页加载（数据就绪 + 首屏渲染） | [perf-splash.md](./perf-splash.md) | [ios-launch.md](./ios/ios-launch.md) |
| CLS 抖动（布局跳动） | [perf-cls.md](./perf-cls.md) | 同（JS 层，两端通用） |
| 页面路由切换 | [perf-navigation.md](./perf-navigation.md) | 同（React Navigation 两端通用） |
| WebView 加载 | [perf-webview.md](./perf-webview.md) | 同（WKWebView 对应 Android WebView） |
| 白屏检测与治理 | [perf-whitescreen.md](./perf-whitescreen.md) | 同（JS 层检测两端通用） |

### 二、流畅度

| 子场景 | Android 文档 | iOS 文档 |
|--------|-------------|---------|
| 列表滑动流畅度（60fps） | [perf-list.md](./perf-list.md) | [ios-rendering.md](./ios/ios-rendering.md) |
| 手势动画（跟手 + 不掉帧） | [perf-animation.md](./perf-animation.md) | [ios-rendering.md](./ios/ios-rendering.md) |
| JS Bridge 通信阻塞 | [perf-bridge.md](./perf-bridge.md) | 同（JSI 两端通用） |

### 三、包体

| 子场景 | Android 文档 | iOS 文档 |
|--------|-------------|---------|
| Bundle 体积优化 | [perf-bundle.md](./perf-bundle.md) | [ios-bundle-size.md](./ios/ios-bundle-size.md) |
| 打包流程优化 | [perf-build.md](./perf-build.md) | [ios-bundle-size.md](./ios/ios-bundle-size.md) |
| 多 Bundle 方案 | → [architecture-engineering.md](../../RN/architecture-engineering.md) | 同（两端共用方案） |

### 四、内存与稳定性

| 子场景 | Android 文档 | iOS 文档 |
|--------|-------------|---------|
| 内存泄漏 + 内存优化 | [perf-memory.md](./perf-memory.md) | [ios-memory.md](./ios/ios-memory.md) |
| 闪退（Crash）治理 | [perf-crash.md](./perf-crash.md) | [ios-stability.md](./ios/ios-stability.md) |

### 五、交互体验反馈

| 子场景 | Android 文档 | iOS 文档 |
|--------|-------------|---------|
| 加载态（骨架屏/Shimmer） | [ux-loading.md](./ux-loading.md) | 同（JS 层，两端通用） |
| 按钮状态机 + Pressable 反馈 + 乐观更新 | [ux-feedback.md](./ux-feedback.md) | 同（JS 层，两端通用） |

### 六、性能监控体系

| 子场景 | Android 文档 | iOS 文档 |
|--------|-------------|---------|
| 监控指标 + 工具 + CI 卡点 + 自动化测试 | [perf-monitoring.md](./perf-monitoring.md) | [ios-stability.md](./ios/ios-stability.md)（监控部分） |

---

## 方法论

```
任何性能体验问题的排查：
1. 测量（工具量化，不靠感觉）
2. 分层定位（RN/JS → Native → C++/底层）
3. 针对性优化（一次只改一个变量）
4. 数据验证（优化前后对比）
5. 持续监控（上线后不退化）
```

详见 [性能分析工具与排查](../../RN/performance-profiling.md)

---

## 我的数据

| 项目 | 优化项 | 结果 |
|------|--------|------|
| 快应用框架 | 包体优化 | 153MB → ~60MB |
| 快应用框架 | DEX 优化 | 44.4MB → 27MB（-39%） |
| 快应用框架 | 启动内存 | PSS MAX 41MB → 35.8MB |
| MT 优选 | 秒开率 | 10% → 78% |
| XM 平台 | 大文件上传 | 121s → 42s（提速 3 倍） |
