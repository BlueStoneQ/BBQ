# 牌 1：性能体验优化

> 命中：JD1-3（性能与质量保障）+ JD2（性能优化方法）
> 定位：不是修一个 bug，是建一套"测量→定位→优化→验证→监控→防退化"的体系
> 核心理念：不仅仅快，还要感知好（Google Core Web Vitals 理念）

---

## 结构化场景

每个场景的分析框架：
1. **如何分析**：用什么工具、看什么指标、怎么定位
2. **如何优化**：从三层角度（RN/JS 层 → Android/iOS Native 层 → C++/Rust 底层）

---

### 一、启动

| 子场景 | 文档 | 状态 |
|--------|------|------|
| RN App 启动（冷启动全链路） | [perf-splash.md](./card-1/perf-splash.md) | ✅ |
| 首页加载（数据就绪 + 首屏渲染） | [perf-splash.md](./card-1/perf-splash.md) | ✅ |
| CLS 抖动（布局跳动） | [perf-cls.md](./card-1/perf-cls.md) | ✅ |
| 页面路由切换 | [perf-navigation.md](./card-1/perf-navigation.md) | ✅ |
| WebView 加载 | [perf-webview.md](./card-1/perf-webview.md) | ✅ |
| 白屏检测与治理 | [perf-whitescreen.md](./card-1/perf-whitescreen.md) | ✅ |

### 二、流畅度

| 子场景 | 文档 | 状态 |
|--------|------|------|
| 列表滑动流畅度（60fps） | [perf-list.md](./card-1/perf-list.md) | ✅ |
| 手势动画（跟手 + 不掉帧） | [perf-animation.md](./card-1/perf-animation.md) | ✅ |
| JS Bridge 通信阻塞 | [perf-bridge.md](./card-1/perf-bridge.md) | ✅ |

### 三、包体

| 子场景 | 文档 | 状态 |
|--------|------|------|
| Bundle 体积优化 | [perf-bundle.md](./card-1/perf-bundle.md) | ✅ |
| 打包流程优化 | [perf-build.md](./card-1/perf-build.md) | ✅ |
| 多 Bundle 方案 | → 详见 [architecture-engineering.md](../RN/architecture-engineering.md) / XRN | ✅ |

### 四、内存与稳定性

| 子场景 | 文档 | 状态 |
|--------|------|------|
| 内存泄漏 + 内存优化 | [perf-memory.md](./card-1/perf-memory.md) | ✅ |
| 闪退（Crash）治理 | [perf-crash.md](./card-1/perf-crash.md) | ✅ |

### 五、交互体验反馈

| 子场景 | 文档 | 状态 |
|--------|------|------|
| 加载态（骨架屏/Shimmer） | [ux-loading.md](./card-1/ux-loading.md) | ✅ |
| 按钮状态机 + Pressable 反馈 + 乐观更新 | [ux-feedback.md](./card-1/ux-feedback.md) | ✅ |

### 六、性能监控体系

| 子场景 | 文档 | 状态 |
|--------|------|------|
| 监控指标 + 工具 + CI 卡点 + 自动化测试 | [perf-monitoring.md](./card-1/perf-monitoring.md) | ✅ |

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

详见 [性能分析工具与排查](../RN/performance-profiling.md)

---

## 我的数据

| 项目 | 优化项 | 结果 |
|------|--------|------|
| 快应用框架 | 包体优化 | 153MB → ~60MB |
| 快应用框架 | DEX 优化 | 44.4MB → 27MB（-39%） |
| 快应用框架 | 启动内存 | PSS MAX 41MB → 35.8MB |
| MT 优选 | 秒开率 | 10% → 78% |
| XM 平台 | 大文件上传 | 121s → 42s（提速 3 倍） |
