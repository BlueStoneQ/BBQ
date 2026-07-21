# 🃏 牌 1：可观测体系

> 指标→探针→上报→看板→治理（四层覆盖）
>
> 基准: 之前的测试结果作为基准 

→ [root: card-1 性能优化详细文档](../../../root/cards/card-1/README.md)

→ [Node.js 可观测体系](../../../root/Node/observability.md)

→ 研发质量和效率: [dev-efficiency-quality.md](./dev-efficiency-quality.md)

→ [AI Coding 可观测指标](./ai-coding-metrics.md)

---

## 一、性能优化总览

| 领域 | 核心指标 | 探针方案 | 常见原因 | 治理手段 |
|------|---------|---------|---------|---------|
| **稳定性** | Crash 率 / ANR(Android)+Watchdog(iOS) / JS Error 率 | UncaughtExceptionHandler / Breakpad / PLCrashReporter / Sentry ErrorBoundary | Native 空指针/OOM / 主线程阻塞 / JS 未捕获异常 | ErrorBoundary 兜底 + Sentry 聚合 + 版本对比 + 灰度自动回滚 |
| **性能-启动** | 冷启动时长 / TTI / 首屏渲染时间 | Native 埋点(Application→Activity) / RN Performance API / 自定义 Span | Bundle 加载慢 / 首屏接口慢 / JS 初始化重 | 预加载 + 分 Bundle + Native 预请求 + Hermes 字节码 |
| **性能-流畅度** | FPS / 掉帧率 / 长任务占比 | Choreographer(Android) / CADisplayLink(iOS) / InteractionManager | 主线程长任务 / 过度 re-render / Bridge 阻塞 | useMemo/useCallback + 列表虚拟化 + Native Driver 动画 + JSI |
| **包体** | APK/IPA 总大小 / JS Bundle 大小 / SO 大小 | 构建产物分析 / source-map-explorer / bundlesize CI 卡点 | 未 tree-shake / 重复依赖 / 未压缩资源 / Debug 符号未 strip | ABI Split + R8/ProGuard + 分 Bundle + 图片压缩 + 模块裁剪 |
| **内存** | PSS / Java Heap / Native Heap / JS Heap | Android Profiler / Xcode Instruments / Hermes Sampling Profiler | 图片未释放 / 闭包泄漏 / 未移除监听 / 大数组缓存 | LeakCanary + WeakRef + 页面卸载清理 + 图片降采样 |

---

## 二、可观测体系设计（全链路）

### 总览

```
探针采集 → 上报通道 → 后端存储 → 看板展示 → 分析定位 → 治理闭环
```

### 分平台全链路

| 维度 | Android (APK) | React Native | H5 (WebView) |
|------|--------------|--------------|---------------|
| **探针** | Choreographer(FPS) / UncaughtExceptionHandler(Crash) / Looper Printer(ANR) / ActivityLifecycle(启动) | Hermes Sampling Profiler / Performance API / ErrorBoundary / InteractionManager | Performance API(FCP/LCP/CLS) / PerformanceObserver / window.onerror / 自定义埋点 |
| **上报** | Sentry Native SDK / 自建 SDK(批量+离线缓存) | Sentry RN SDK / Bridge→Native 通道转发 | Bridge→Native 通道 / Beacon API / 自建 SDK |
| **后端** | Sentry(错误+性能) / Firebase Crashlytics / 自建 ClickHouse | Sentry(统一) / 自建埋点服务 | Sentry / Firebase Performance / 自建埋点服务 |
| **看板** | Grafana + Sentry Dashboard / 自建看板 | 统一看板（按 Bundle 维度聚合） | 统一看板（按页面维度聚合） |
| **分析** | 版本对比 / 设备分布 / 堆栈聚合 / ANR Trace 分析 | Source Map 还原 / 组件级归因 / Bridge 调用链追踪 | Source Map 还原 / 资源加载瀑布图 / 慢接口关联 |
| **治理** | 灰度观测→异常回滚 / ProGuard mapping 上传 / 防退化基线 | 热更新灰度→错误率飙升自动回滚 / Bundle 级隔离 | CDN 灰度切换 / 离线包版本回退 / 白屏检测自动刷新 |

---

### 核心设计原则

1. **统一 ID 串联**：traceId 贯穿 H5→Bridge→RN→Native→后端，一次用户操作可全链路追踪
2. **分层采集、统一上报**：各平台探针独立，上报通道统一走 Native SDK（省电、离线缓存、批量压缩）
3. **按版本/Bundle/页面 三维度聚合**：快速定位是哪个版本、哪个 Bundle、哪个页面引入的问题
4. **防退化基线**：CI 中卡点（启动时长/包体/FPS）超过基线自动阻断合并

---

### 治理闭环

```
发现问题（看板告警）
  → 定位根因（堆栈 + 版本对比 + 设备分布）
  → 修复（热更新 / Native 发版）
  → 灰度验证（1%→10%→100%）
  → 基线更新（新版本作为新基准）
  → 防退化（CI 卡点 + 监控告警）
```

---

---

## 三、最佳实践：从 0 到 1 快速搭建

→ [best-practice.md](./best-practice.md)

覆盖：优先级排序（稳定性 > 性能 > 内存 > 包体）、2 周快速走通全链路、工具链统一化、开发流程治理、阶段演进路径。

---

## 四、研发效能 + 研发质量

→ [dev-efficiency-quality.md](./dev-efficiency-quality.md)

---

## TODO

- [ ] 补充探针 SDK 架构设计（采集层 + 缓存层 + 上报层）
- [ ] 补充 Sentry 配置最佳实践
- [ ] 补充 CI 性能卡点具体实现
