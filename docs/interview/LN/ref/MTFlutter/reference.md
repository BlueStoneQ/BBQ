# MTFlutter 资料

## MTFlutter 主要做了什么

### 1. 混合栈管理（Flutter Boost 类方案）
- **为什么**：美团是巨型 App，不可能全部 Flutter 重写，必须 Flutter 页面和 Native 页面共存
- **做了什么**：统一路由栈管理，Native → Flutter / Flutter → Native 无缝跳转，引擎复用（单引擎多页面，避免内存膨胀）
- 类似闲鱼 FlutterBoost，但美团自研了一套适配自己业务复杂度的方案

### 2. 引擎复用 & 预热
- **为什么**：Flutter Engine 冷启动耗时 ~300-500ms，从 Native 跳 Flutter 页面会白屏
- **做了什么**：
  - 引擎预热（App 启动时提前初始化 Engine）
  - 引擎复用（多个 Flutter 页面共享一个 Engine 实例）
  - 页面数据预加载（路由跳转前并行发请求）

### 3. 动态化（Flap）
- **为什么**：Flutter 原生不支持热更新（AOT 编译），但业务需要快速修 bug 和 AB 实验
- **做了什么**：Flap 动态化方案 — 将 Dart 编译为中间产物，通过下发 DSL/中间代码实现动态渲染
- 2019 年开始研究，2020 年开始落地

### 4. 工程化体系
- **为什么**：百人级团队协作，Flutter module 需要和 Native 主工程解耦
- **做了什么**：
  - Flutter module → 编译为 AAR(Android) / Framework(iOS)，Native 开发无需装 Flutter 环境
  - CI/CD 流水线：Flutter 独立构建 → 产物发布 → Native 依赖管理
  - 分模块开发 + 版本管理
  - 和 Native 主工程的集成方式：源码集成（开发期）+ 产物集成（CI/CD）

### 5. 性能监控 & 优化
- **为什么**：Flutter 的性能黑盒问题（Dart VM GC、Raster 线程卡顿、Shader 编译 Jank）
- **做了什么**：
  - 帧率采集、卡顿检测（Raster 线程监控）
  - 内存监控（Dart Heap + Native 内存）
  - 包体优化（Tree Shaking、资源压缩、引擎裁剪）
  - 首帧渲染优化（引擎预热 + 数据预加载）
  - Shader 预编译（解决首次动画 Jank）

---

## Flutter 在美团的使用情况

| 时间 | 阶段 | 落地场景 |
|------|------|---------|
| 2019 | 探索期 | 基建团队开始 MTFlutter 框架建设，选部分低频业务试点 |
| 2020 | 推广期 | 打车司机端、优选部分页面接入 Flutter；Flap 动态化开始落地 |
| 2021-2022 | 规模化 | 更多业务线接入，Flutter 页面占比逐步提升 |
| 2024-2025 | 鸿蒙适配 | MTFlutter 适配 HarmonyOS NEXT，三端（Android/iOS/鸿蒙）统一 |

**落地业务**：
- 打车司机端（中后台业务页面）
- 优选部分低频页面
- 部分营销活动页面
- 商家端部分模块

**美团的选择逻辑**：核心主流程仍保持 Native，Flutter 用于中低频业务 + 新业务试点 + 快速迭代场景

---

## Flutter 在携程的使用情况

| 维度 | 情况 |
|------|------|
| 框架 | CRN（基于 RN 定制）为主力，Flutter 为第二跨端方案 |
| 落地 | 酒店、机票部分模块用 Flutter；主 App 仍以 CRN 为主 |
| 工程化 | Flutter module 产物化集成，和 CRN 共存于同一 App |
| 混合栈 | 自研混合栈管理（Flutter ↔ Native ↔ CRN 三方跳转） |
| 趋势 | 2023-2024 Flutter 占比逐步提升，新业务优先 Flutter |

**携程的选择逻辑**：历史包袱是 CRN，新增业务逐步转 Flutter，两套跨端方案并存过渡期

---

## 和你能力的映射

| MTFlutter 能力 | 你的对应经验 |
|---------------|-------------|
| 混合栈管理 | XRN Router 设计（Native Router + RN Navigation 双段路由） |
| 引擎预热 + 数据预加载 | PreFetch TurboModule（Native 并行发请求） |
| 性能监控 | card-1 可观测体系（帧率/内存/ANR/白屏） |
| 工程化 | card-2 CI/CD + 分 bundle + 热更新 |
| 动态化（Flap） | 快应用框架（JSON DSL → Native 渲染，Server-Driven UI） |
