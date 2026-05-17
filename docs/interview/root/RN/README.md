# RN 知识体系

> 场景驱动 + 问题驱动。以"IoT App 通过 BLE 连接智能硬件"为主线串联。

---

## 目录

- [rn-native-communication.md](./rn-native-communication.md) — RN ↔ Native 通信（JSI/TurboModule/事件回传/BLE 场景）
- [build-system.md](./build-system.md) — 工程构建（Metro/Hermes/.hbc/多 Bundle 组装 APK/热更新能力）
- [performance.md](./performance.md) — 大前端性能优化（启动/渲染/内存/方法论）
- [architecture-engineering.md](./architecture-engineering.md) — 架构和工程化治理（DDD/Monorepo/分 Bundle/热更新推送）

---

## 核心场景

**App 架构**：RN App → TurboModule（BLE 插件）→ Android BLE API → 智能硬件

**围绕这个场景的关键问题**：

1. RN 和 Native 怎么通信？→ rn-native-communication.md
2. JS 源码怎么变成设备上能跑的东西？→ build-system.md
3. 性能怎么测、怎么优化？→ performance.md
4. 怎么支撑多团队并行、独立发版？→ architecture-engineering.md
