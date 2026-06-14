# 动态渲染框架技术选型（2026.06）

> 前提：你是大前端架构师，目标是从零构建一个动态渲染框架。本文基于对快应用框架的深度分析，结合 2026 年的技术现状，给出选型建议。

---

## 目录

- [1. 先回答"做什么"](#1-先回答做什么)
- [2. 六个核心决策点](#2-六个核心决策点)
- [3. 决策一：渲染目标（你的 View 是什么）](#3-决策一渲染目标)
- [4. 决策二：是否需要 JS 引擎](#4-决策二是否需要-js-引擎)
- [5. 决策三：Bridge 方案（如果选了 JS 引擎）](#5-决策三bridge-方案)
- [6. 决策四：布局引擎](#6-决策四布局引擎)
- [7. 决策五：响应式 / 状态管理](#7-决策五响应式--状态管理)
- [8. 决策六：编译工具链](#8-决策六编译工具链)
- [9. 三套推荐方案](#9-三套推荐方案)
- [10. 不推荐的选择](#10-不推荐的选择)

---

## 1. 先回答"做什么"

"动态渲染框架"至少有三种形态，技术选型完全不同：

| 形态 | 特征 | 典型代表 |
|------|------|---------|
| A. 完整跨端应用框架 | 有 DSL、有编译工具链、有完整组件体系 | 快应用、RN、Taro |
| B. 服务端驱动 UI (SDUI) | 服务端下发模板 JSON，客户端解析渲染 | DoorDash SDUI、Tangram、Epoxy |
| C. 动态逻辑 + 动态 UI | 下发可执行逻辑（JS/WASM）+ 动态模板 | 小程序、MiniApp |

**后面的选型按形态 C（动态逻辑 + 动态 UI）来展开**——因为这是你想做的"能下发、能动态更新、能跑逻辑"的场景。

---

## 2. 六个核心决策点

```
开发者写代码
  → [决策6: 编译工具链] → 产物（JS Bundle / JSON 模板）
  → 下发到客户端
  → [决策4: 是否需要 JS 引擎] → 执行逻辑
  → [决策5: 响应式/状态管理] → 数据变更检测
  → [决策3: Bridge 方案] → 跨层通信
  → [决策1: 渲染目标] → 创建 View
  → [决策4: 布局引擎] → 计算坐标
  → 屏幕像素
```

---

## 3. 决策一：渲染目标

你最终创建的"View"是什么？

| 方案 | 优势 | 劣势 | 适用 |
|------|------|------|------|
| **Android Native View** | 系统原生体验、无缝接入系统能力 | 只能 Android、50+ Widget 要实现 | Android 单平台产品 |
| **Flutter Widget** | 跨平台、渲染一致、组件丰富 | 包体大（+5-10MB）、和原生交互多一层 | 已有 Flutter 技术栈的团队 |
| **Compose** | Kotlin 原生、声明式、Google 主推 | 只能 Android、和 JS 引擎结合不成熟 | 纯 Android + 不需要 JS |
| **自绘 (Skia/Impeller)** | 完全可控、跨平台 | 工程量巨大、无系统组件复用 | 特殊渲染需求（游戏/编辑器） |

**2026 年推荐**：
- 如果 Android only → **Native View**（复用系统 Widget，成本最低）
- 如果跨平台 → **Flutter Widget**（生态成熟，渲染层不用操心）

---

## 4. 决策二：是否需要 JS 引擎

| 方案 | 何时选 | 代表 |
|------|--------|------|
| **有 JS 引擎** | 需要动态下发逻辑（条件判断、网络请求、事件处理） | 快应用、RN、小程序 |
| **无 JS 引擎（纯 JSON SDUI）** | 只需要动态布局，逻辑固定在客户端 | Tangram、Epoxy、Server-Driven UI |
| **轻量表达式引擎** | 需要简单动态绑定（`{{count > 0 ? "有" : "无"}}`）但不需要完整 JS | 卡片引擎、低代码平台 |

**2026 年推荐**：如果你的场景需要"下发可执行逻辑"，JS 引擎必选。

### JS 引擎对比（2026 年现状）

| 引擎 | 包体 | 启动速度 | 峰值性能 | 维护方 | 协议 | 适合 |
|------|------|---------|---------|--------|------|------|
| **QuickJS** | <1MB | ~30ms | 中等（纯解释） | Bellard/社区 | MIT | 轻量场景、嵌入式 |
| **QuickJS-ng** | <1MB | ~30ms | 中等+（优化版） | 社区 fork | MIT | QuickJS 的活跃替代 |
| **Hermes** | ~3MB | ~50ms（字节码快） | 中高 | Meta | MIT | RN 生态、有 JSI |
| **V8** | ~8MB | ~100ms | 最高（JIT） | Google | BSD | 需要极致 JS 性能 |
| **JavaScriptCore** | 系统自带(iOS) | 快 | 高 | Apple | LGPL | iOS only |

**2026 年推荐**：
- **首选 QuickJS-ng**：包体极小、启动极快、MIT 协议、社区活跃、纯 C 方便 JNI/FFI
- 如果需要 JSI 能力 → **Hermes**
- 如果需要极致 JS 性能（复杂计算）→ **V8**（但包体大、启动慢）

---

## 5. 决策三：Bridge 方案

如果选了 JS 引擎，JS 和 Native 怎么通信？

| 方案 | 性能 | 开发复杂度 | 语言要求 | 适合 |
|------|------|-----------|---------|------|
| **JNI + JSON**（快应用模式） | 中（有序列化开销） | 低（Java 直接写） | Java/Kotlin | 快速验证、团队 Java 为主 |
| **C FFI + JSON**（QuickJS 直绑） | 中（有序列化但少一层 JNI） | 中 | C + Java | 比 J2V8 轻量 |
| **JSI 模式**（Hermes/V8 C++ API） | 极高（零序列化） | 高（全 C++） | C++ | 追求极致性能 |
| **Flutter FFI + Dart**（如果渲染用 Flutter） | 无 Bridge（同进程 Dart） | 低 | Dart | Flutter 宿主 |

**2026 年推荐**：

```
如果渲染目标是 Flutter Widget:
  → 不需要传统 Bridge
  → JS 引擎通过 Dart FFI 集成（dart:ffi 调 QuickJS C API）
  → 或者用 flutter_js / webf 这类现成方案

如果渲染目标是 Android Native View:
  → 团队 Java 为主 → QuickJS + JNI + JSON（2-3 周出原型）
  → 追求性能 → Hermes + C++ 直调（2-3 月）
```

---

## 6. 决策四：布局引擎

| 方案 | 支持 | 实现 | 包体 | 推荐度 |
|------|------|------|------|--------|
| **Yoga** | Flexbox | C++ (JNI) | ~200KB | ⭐⭐⭐⭐ 成熟稳定 |
| **Taffy** | Flexbox + Grid | Rust (JNI via uniffi) | ~150KB | ⭐⭐⭐ 新生代，支持 Grid |
| **自研** | 自定义 | Java/Kotlin | 0 | ⭐⭐ 可控但工作量大 |
| **Flutter 内置** | 完整 | Dart | 0（Flutter 自带） | ⭐⭐⭐⭐⭐ 如果用 Flutter |

**2026 年推荐**：
- Flutter 渲染 → 不需要额外布局引擎
- Native View 渲染 → **Yoga**（零风险）或 **Taffy**（如果需要 Grid 支持）

---

## 7. 决策五：响应式 / 状态管理

| 方案 | 特点 | 适合 |
|------|------|------|
| **Proxy（Vue3 风格）** | 自动追踪依赖、细粒度更新 | JS 引擎支持 ES6 Proxy 的场景 |
| **Signal（Solid/Preact 风格）** | 极细粒度、无 VDom diff、性能最优 | 追求极致渲染性能 |
| **setState（React 风格）** | 显式声明变更、可预测 | 团队熟悉 React 模型 |
| **无响应式（SDUI）** | 服务端推新 JSON → 全量替换 | 纯 SDUI 场景 |

**2026 年推荐**：
- 如果有 JS 引擎且支持 Proxy → **Signal 或 Proxy**（细粒度更新 = 更少的 Bridge 调用）
- QuickJS-ng 已支持 Proxy，可以用

---

## 8. 决策六：编译工具链

| 环节 | 推荐方案 | 理由 |
|------|---------|------|
| SFC 解析 | **htmlparser2** 或 **parse5** | 轻量、成熟 |
| CSS 处理 | **PostCSS** + 自定义 plugin | 生态好、可扩展 |
| JS 转译 | **SWC**（Rust） | 比 Babel 快 20x+、2026 年已完全成熟 |
| 打包 | **esbuild** 或 **Rollup** | 比 webpack 快 100x、配置简单 |
| 产物格式 | JSON 模板 + JS Bundle | 和快应用一致的思路 |
| 签名/压缩 | **node:crypto** + **fflate** | 内置 + 轻量 |

**2026 年不推荐 webpack**：太重、配置复杂、速度慢。esbuild/Rollup 在自定义文件格式场景已经完全能胜任（通过 plugin）。

---

## 9. 三套推荐方案

### 方案 A：轻量极速（2-3 周出原型）

```
场景：Android only，快速验证，团队 Java/Kotlin 为主
JS 引擎：QuickJS-ng（<1MB，启动 30ms）
Bridge：JNI + JSON（简单直接）
渲染：Android Native View
布局：Yoga
响应式：Proxy（QuickJS-ng 支持）
编译：esbuild + htmlparser2 + postcss
产物：JS Bundle（zip 打包）
```

工作量：~3 周出 MVP，~2 月产品可用

### 方案 B：Flutter 宿主（跨平台优先）

```
场景：iOS + Android 跨平台，团队有 Flutter/Dart 经验
JS 引擎：QuickJS-ng via dart:ffi
Bridge：无传统 Bridge（同进程 Dart FFI）
渲染：Flutter Widget
布局：Flutter 自带 RenderObject
响应式：JS 侧 Proxy + Dart 侧 setState
编译：esbuild + 自定义 DSL plugin
产物：JS Bundle
```

工作量：~1 月出 MVP（Flutter 渲染层现成）

### 方案 C：极致性能（类 RN New Architecture）

```
场景：高频交互（如动态表单/编辑器），需要极致通信性能
JS 引擎：Hermes
Bridge：JSI（C++ Host Objects，零序列化）
渲染：Android Native View / iOS UIKit（跨平台）
布局：Yoga
响应式：Signal（最少 Bridge 调用）
编译：SWC + Rollup + Codegen（生成 C++ 绑定）
产物：Hermes 字节码（.hbc）
```

工作量：~3 月出 MVP，需要 C++ 能力

---

## 10. 不推荐的选择（2026 年）

| 不推荐 | 原因 |
|--------|------|
| J2V8 | 已停止维护，V8 版本落后，有安全风险 |
| webpack 作为编译核心 | 太慢太重，esbuild/Rollup 全面替代 |
| 自己写 Parser | 工程量巨大，parse5/htmlparser2/postcss 足够 |
| WebView 混合方案 | 2026 年了没有理由还走 WebView 渲染 |
| defineProperty 响应式 | Proxy 全面普及，defineProperty 有已知缺陷（检测不到新增属性） |
| 自己写 JS 引擎 | 除非你是引擎团队，否则不要碰 |
| RN 全家桶 | 如果目标是"自建框架"，依赖 RN 就失去了自主权 |

---

## 11. 决策总结表

| 决策点 | 推荐 | 备选 |
|--------|------|------|
| JS 引擎 | **QuickJS-ng** | Hermes（需要 JSI）|
| Bridge | **JNI + JSON**（起步） | JSI（极致性能） |
| 渲染 | **Android Native View** 或 **Flutter Widget** | — |
| 布局 | **Yoga** | Taffy（需要 Grid）|
| 响应式 | **Proxy + Signal** | — |
| 编译 | **esbuild + htmlparser2 + postcss + SWC** | — |
| 包格式 | **zip (JS Bundle + JSON + 资源 + 签名)** | — |
