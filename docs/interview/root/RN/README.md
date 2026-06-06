# RN 知识体系

> 从骨架理解 RN：构建 → 加载 → 运行 → 优化 → 工程化
> 场景：IoT App，BLE 连接智能硬件

---

## 目录

### 一、骨架：RN 怎么跑起来的

- [全景](./rn-full-picture.md) — 目录结构 → 构建 → 启动 → 渲染 → JS 调 Native
- [构建系统](./build-system.md) — Metro + Hermes + APK 组装 + Link 机制
- [运行时](./rn-runtime.md) — Bundle 加载 → 容器初始化 → 渲染 → 逻辑执行
- [Fabric 渲染模型](./fabric-rendering.md) — Shadow Tree / Yoga 布局 / Mutation List / 两次 diff 原理

### 二、通信与 Native 集成

- [RN ↔ Native 通信](./rn-native-communication.md) — JSI / TurboModule / BLE 场景
- [TurboModule 开发指南](./turbomodule-dev-guide.md) — JS Spec + Codegen + Android + iOS 完整流程
- [iOS for RN](./ios-for-rn.md) — ObjC Bridge / TurboModule / 构建 / 性能
- [Native 层预请求](./native-prefetch.md) — Android 侧启动优化（预请求 + 引擎预热）

### 三、性能优化

- [性能优化](./performance.md) — 启动 / 渲染 / 内存 / 列表 / 下沉策略
- [性能优化分层体系](./performance-layers.md) — React / RN 框架 / Native / 工程化 + 场景
- [性能分析工具](./performance-profiling.md) — 工具盘点 / 场景选型 / 排查 SOP
- [App 指标体系](./app-metrics.md) — 启动 / 渲染 / 交互 / 稳定性 / 监控
- [首屏测速方案（无侵入）](./first-screen-detection.md) — View Tree 监听 / 稳定判定 / 秒开率计算

### 四、UI 与交互

- [手势动画](./gesture-animation.md) — Reanimated 3 / Gesture Handler
- [Theme + 国际化](./theme-i18n.md) — Dark Mode / i18n / RTL / Design Token
- [体验升级治理](./ux-engineering.md) — 感知速度 / 交互反馈 / 视觉稳定 / 组件体系

### 五、工程化

- [架构和工程化治理](./architecture-engineering.md) — DDD / 多 Bundle / 热更新 / CLI / 实例池
- [分 Bundle 方案](./code-splitting.md) — 构建拆分 / 运行时加载 / 路由配合
- [RN 工程化深度方案](../cards/card-3/rn-engineering-deep.md) — 多 Bundle 容器 / 原生路由 / 两层路由设计 / 热更新
- [签名与发布全流程](./signing-and-release.md) — Android keystore + iOS 证书 + CI 自动化 + Fastlane
- [Fastlane + CI/CD 自动化发版](./fastlane-ci-cd.md) — Fastlane 核心能力 / match 证书管理 / GitHub Actions 配合
- [条件编译](./conditional-compile.md) — 包体裁剪
- [2026 选型](./rn-2026-stack.md) — 技术栈 + 目录结构 + 状态管理

### 六、网络层

- [网络层最佳实践](./networking.md) — TanStack Query + axios + 分层封装 + 企业级增强

### 七、场景专题

- [线上稳定性保障](./stability.md) — 白屏检测 / 分级恢复 / 热更新回滚 / Expo 方案
- [IoT BLE 性能](./iot-ble-performance.md) — BLE+WiFi 共存 / 流畅度 / 优化方案
- [调试与问题归因](./debugging-issues.md) — 常见问题排查
- [运维监控](./firebase-ops.md) — Firebase / Sentry / 选型
