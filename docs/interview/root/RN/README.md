# RN 知识体系

> 从骨架理解 RN：构建 → 加载 → 运行 → 优化 → 工程化
> 场景：IoT App，BLE 连接智能硬件

---

## 目录（按认知顺序）

### 骨架：RN 怎么跑起来的

1. [rn-full-picture.md](./rn-full-picture.md) — 全景（目录结构 → 构建 → 启动 → 渲染 → JS 调 Native）
2. [build-system.md](./build-system.md) — 构建过程（Metro + Hermes + APK 组装 + Link 机制）
3. [rn-runtime.md](./rn-runtime.md) — 加载与运行时（Bundle 加载 → 容器初始化 → 渲染 → 逻辑执行）

### 支干：核心能力

3. [rn-native-communication.md](./rn-native-communication.md) — RN ↔ Native 通信（JSI / TurboModule / BLE 场景）
4. [performance.md](./performance.md) — 性能优化（启动/渲染/内存/列表/下沉策略）
5. [performance-layers.md](./performance-layers.md) — 性能优化分层体系（React/RN框架/Native/工程化 + 场景）
6. [performance-profiling.md](./performance-profiling.md) — 性能分析工具与排查方法（工具盘点/场景选型/排查 SOP）
5. [gesture-animation.md](./gesture-animation.md) — 手势动画（Reanimated 3 / Gesture Handler）
6. [conditional-compile.md](./conditional-compile.md) — 条件编译与包体裁剪

### 场景专题

11. [iot-ble-performance.md](./iot-ble-performance.md) — IoT App 性能方案（BLE+WiFi共存/流畅度/优化方案）
12. [ux-engineering.md](./ux-engineering.md) — 性能体验升级治理专项（感知速度/交互反馈/视觉稳定/组件体系）
13. [theme-i18n.md](./theme-i18n.md) — Theme 适配 + 国际化（Dark Mode/i18n/RTL/Design Token）

### 血肉：工程化与选型

7. [architecture-engineering.md](./architecture-engineering.md) — 架构和工程化治理（DDD/分 Bundle/热更新/CLI/实例池）
8. [rn-2026-stack.md](./rn-2026-stack.md) — 2026 选型 + 目录结构 + 状态管理
9. [firebase-ops.md](./firebase-ops.md) — 运维监控（Firebase/Sentry/选型）
10. [debugging-issues.md](./debugging-issues.md) — 调试与常见问题归因
