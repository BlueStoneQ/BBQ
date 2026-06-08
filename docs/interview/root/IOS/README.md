# iOS 知识体系（大前端视角）

> 不是 iOS 开发者手册，是"大前端架构师需要的 iOS 核心概念"——能设计跨端方案、能理解 iOS 侧约束、能和 iOS 同学对话。

---

## 目录

- [iOS 核心概念总览](./00-overview.md) — 概念对照 / 项目结构 / RN 在 iOS 侧 / 多 Bundle / iOS 特有约束
- [内存管理](./01-memory/) — ARC / 循环引用 / autoreleasepool
- [并发模型](./02-concurrency/) — GCD / OperationQueue / RunLoop / 和前端 Event Loop 的对比
- [性能优化](./05-optimization/) — 启动 / 渲染 / 包体 / 和 Android 的区别
- [WKWebView 容器定制](./webview-container.md) — 预创建 / 离线包 / Cookie 同步 / 白屏回收 / JSBridge
