# 快应用框架技术文档索引

> 目标：深度吸收快应用跨端渲染框架的设计，为自建动态渲染框架提供参考。

## 开源仓库

框架核心代码是开源的（Apache-2.0 / MIT），离线后仍可获取：

| 仓库 | 地址 | 对应本地目录 |
|------|------|------------|
| hapjs-platform 组织 | [github.com/hapjs-platform](https://github.com/hapjs-platform/) |- 框架: https://github.com/hapjs-platform/hapjs - 构建工具: https://github.com/hapjs-platform/hap-toolkit|
| hapjs-platform 主框架 | [github.com/nicetea/nicetea](https://github.com/nicetea) / [gitee.com/nicetea/nicetea](https://gitee.com/nicetea/nicetea) | `packages/quickapp/` |
| hap-toolkit 编译工具链 | [github.com/nicetea/nicetea-hap-toolkit](https://github.com/nicetea/nicetea-hap-toolkit) | `extra/hap-toolkit/` |
| Gitee 镜像 | [gitee.com/mirrors/hapjs](https://gitee.com/mirrors/hapjs) | — |

> 本地代码是小米内部 fork（加了 vendor 定制模块），核心 runtime/framework/toolkit 与开源版一致。

---

## 全景架构

| 文档 | 说明 |
|------|------|
| [architecture-overview.md](./architecture-overview.md) | 架构总览：三层分层、各层职责、线程模型、主流框架对比 |

---

## 编译阶段（开发者代码 → 可执行产物）

| 文档 | 说明 |
|------|------|
| [compiler-toolchain.md](./compiler-toolchain.md) | .ux → .rpk 全链路：parse5 解析、webpack loader 流水线、签名打包、库选型建议 |

---

## 加载阶段（rpk 包 → JS 引擎就绪）

| 文档 | 说明 |
|------|------|
| [rpk-loading-and-execution.md](./rpk-loading-and-execution.md) | RPK 包内结构、$注入函数全表、invokeScript 闭包沙箱注入原理、App/Page 创建流程 |

---

## 运行阶段（6 大核心机制）

### 核心 1 — Bridge 通信（性能天花板）

| 文档 | 说明 |
|------|------|
| [bridge-communication-deep-dive.md](./bridge-communication-deep-dive.md) | 三问框架（寻址/序列化/回传）、内存隔离模型、J2V8 实现 |
| [memory-model-and-function-calling.md](./memory-model-and-function-calling.md) | 底层真相：函数存储、External Function、参数传递三种模式 |
| [js-bridge-design.md](./js-bridge-design.md) | Bridge 设计：快应用具体实现、双通道设计、业界演进对比、最佳实践 |

### 核心 2 — 渲染管线（JS → Native View）

| 文档 | 说明 |
|------|------|
| [runtime-rendering-and-communication.md](./runtime-rendering-and-communication.md) | 首次渲染：initInfras → createPage → Listener → Streamer → callNative → View 树 |
| [runtime-interaction-phase.md](./runtime-interaction-phase.md) | 交互更新：事件响应 → 数据变更 → 增量渲染 → Feature API 调用 → 回调 |

### 核心 3 — 响应式系统（数据驱动更新）

| 文档 | 说明 |
|------|------|
| [reactive-system.md](./reactive-system.md) | Observer/XLinker(Dep)/Watcher 三角关系、依赖收集、批量更新 |

### 核心 4 — 布局引擎（CSS → 像素坐标）

| 文档 | 说明 |
|------|------|
| [layout-engine-yoga.md](./layout-engine-yoga.md) | Yoga Flexbox 原理、YogaNode 使用、支持的 CSS 子集、方案对比 |

### 核心 5 — 组件注册表（tagName → Native View）

| 文档 | 说明 |
|------|------|
| [widget-component-registry.md](./widget-component-registry.md) | ComponentFactory 查表创建、Widget 注册、组件生命周期、扩展机制 |

---

## 选型与落地

| 文档 | 说明 |
|------|------|
| [js-engine-capabilities.md](./js-engine-capabilities.md) | JS 引擎能力全景：V8/Hermes 能做什么、6 大能力如何组合出跨端框架 |
| [dynamic-framework-tech-selection-2026.md](./dynamic-framework-tech-selection-2026.md) | 2026 年自建动态渲染框架的技术选型：6 个决策点、3 套方案、工作量估算 |

---

## 阅读顺序建议

```
1. architecture-overview        ← 先有全局观
2. compiler-toolchain           ← 理解输入产物
3. rpk-loading-and-execution    ← 理解加载和注入
4. bridge-communication-deep-dive ← 核心中的核心
5. runtime-rendering-and-communication ← 首次渲染
6. runtime-interaction-phase    ← 交互更新
7. reactive-system              ← 数据驱动细节
8. layout-engine-yoga           ← 布局细节
9. widget-component-registry    ← 组件细节
```

---

## 如果要自建动态渲染框架，需要做的决策

| 决策点 | 快应用的选择 | 可替代方案 |
|--------|------------|-----------|
| JS 引擎 | V8 (J2V8) | QuickJS / Hermes / JavaScriptCore |
| Bridge 方式 | JNI 同步 + JSON | JSI (C++ 零序列化) / Platform Channel |
| 渲染目标 | Android Native View | Flutter Widget / 自绘 Skia / WebView |
| 布局引擎 | Yoga (Flexbox only) | Taffy (Rust) / ConstraintLayout / 自研 |
| 响应式模型 | defineProperty (Vue2 风格) | Proxy (Vue3) / setState (React) / Signal |
| DSL 语法 | 类 Vue SFC (.ux) | JSX / SwiftUI 风格 / 纯 JSON |
| 编译工具 | webpack + parse5 + css | Vite + htmlparser2 + postcss / esbuild |
| 包格式 | rpk (zip + 签名) | 自定义 bundle / WASM |
