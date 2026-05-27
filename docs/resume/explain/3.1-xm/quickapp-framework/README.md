# 快应用框架知识体系

> 系统级快应用运行时，JS 驱动 Native View 渲染。

---

## 索引

### 架构与渲染

- [quickapp-layout-and-architecture.md](./quickapp-layout-and-architecture.md) — 框架整体架构 + Yoga 布局 + 渲染流 + 通信机制 + RPK 加载
- [thread-model.md](./thread-model.md) — 三线程模型

### J2V8 / Bridge

- [j2v8-deep.md](./j2v8-deep.md) — V8/J2V8 核心概念 + 注册方法 + 回调 + 线程 + 内存管理 + 三层穿透
- [j2v8-bridge.md](./j2v8-bridge.md) — Bridge 设计

### 性能优化

- [memory-optimization.md](./memory-optimization.md) — 启动内存优化（DEX 布局/PSS）
- [module-trimming.md](./module-trimming.md) — 模块裁剪方案
- [framework-metrics.md](./framework-metrics.md) — 框架指标体系 + 治理方案
- [additional-contributions.md](./additional-contributions.md) — 补充大活（自动化测试体系 + 渲染性能优化）

### Android 相关

- [android-fundamentals.md](./android-fundamentals.md) — Android 基础
- [android-advanced.md](./android-advanced.md) — Android 进阶
- [android-note/](./android-note/) — Android 笔记
- [consumer-proguard-issue.md](./consumer-proguard-issue.md) — consumerProguardFiles 排查
- [conditional-compile-vs-plugin.md](./conditional-compile-vs-plugin.md) — 条件编译 vs 插件化 vs 动态加载

### 深度追问

- [traps.md](./traps.md) — 深度追问清单（角色/J2V8/DEX/反射/为什么不用RN）
- [cross-platform-comparison.md](./cross-platform-comparison.md) — 跨端框架对比（快应用 vs RN vs 小程序 vs Flutter）
