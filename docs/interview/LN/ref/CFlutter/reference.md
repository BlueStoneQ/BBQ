# 携程 Flutter 方案

## 背景

携程跨端技术栈的特殊性：**CRN（基于 RN 定制）是历史主力**，Flutter 是 2021 年后逐步引入的第二跨端方案，两套方案共存。

---

## 携程 Flutter 做了什么

### 1. 三方混合栈管理
- **为什么**：App 内同时存在 Native 页面、CRN 页面、Flutter 页面，三方需要无缝跳转
- **做了什么**：
  - 统一 URL Scheme 路由分发（和 XRN Router 同构思路）
  - Native Router 层判断目标技术栈 → 分发到对应容器
  - Flutter ↔ CRN 跳转走 Native 中转（不直接通信）
  - 引擎复用：Flutter 容器池管理，避免多实例内存膨胀

### 2. Native 能力层复用（Platform Channel Plugin）
- **为什么**：网络库、图片库、埋点 SDK、登录态、支付等 Native SDK 已有成熟实现，不需要在 Flutter/CRN 各实现一遍
- **做了什么**：
  - 抽象统一 Native 能力层，暴露为 Platform Channel Plugin
  - Flutter 和 CRN 共享同一套 Native SDK（网络/图片/埋点/推送）
  - 图片缓存复用：Flutter 端 Image 请求走 Native 图片库缓存（SDWebImage/Glide），避免双份缓存

### 3. 产物化集成 + 工程化
- **为什么**：非 Flutter 开发的同事不应该被迫安装 Flutter 环境
- **做了什么**：
  - Flutter module → CI 编译为 AAR(Android) / Framework(iOS) → Native 主工程依赖产物
  - 独立版本管理：Flutter 产物有自己的版本号，和 Native 主版本解耦
  - 开发期：源码集成（flutter attach 热重载）
  - CI/CD：产物集成（编译产物推到私有 Maven/CocoaPods）

### 4. 性能优化
- **做了什么**：
  - 引擎预热：App 启动时预创建 FlutterEngine
  - 首帧优化：预加载数据 + 占位骨架屏
  - 包体优化：按业务拆分 Flutter module，按需打入主包
  - Shader 预编译：收集线上 Shader → 打入 App 包内，消除首次动画 Jank

### 5. 国际化（Trip.com）
- Trip.com 国际版部分页面用 Flutter
- 支持多语言、RTL 布局
- 和 CRN 共享国际化资源文件

---

## 和 MTFlutter 的对比

| 维度 | 美团 MTFlutter | 携程 CFlutter |
|------|---------------|--------------|
| 定位 | 逐步替代部分 Native | 与 CRN 互补共存 |
| 动态化 | Flap（自研 DSL 动态下发） | 不强调（CRN 本身就热更新） |
| 混合栈 | Flutter ↔ Native 双向 | Flutter ↔ CRN ↔ Native 三方 |
| 落地规模 | 打车/优选低频业务 | 酒店/机票部分模块 + Trip.com |
| 工程化 | 产物集成 + 独立 CI | 产物集成 + 和 CRN 共享 Native 层 |
| 特殊难点 | 引擎复用 + Flap 动态化 | 三方栈共存 + Native SDK 双端复用 |

---

## 和你能力的映射

| 携程 Flutter 能力 | 你的对应经验 |
|------------------|-------------|
| 三方混合栈 | XRN Router（Native Router + RN Navigation 双段路由） |
| Platform Channel 封装 | TurboModule（Native 能力暴露给 JS/Dart） |
| 产物化集成 | XRN 分 bundle + CI/CD 产物发布 |
| 引擎预热 + 数据预加载 | PreFetch TurboModule |
| BFF GraphQL | XC 机酒 BFF 层 |
| 国际化 | XC 国际化 App 开发 |

---

## 面试叙事角度

> 在携程机酒终端组，参与了 Flutter 在机票频道的落地。核心工作：
> 1. 和无线基建团队协作，完成 Flutter 混合栈接入（三方路由：Native/CRN/Flutter）
> 2. 封装 Platform Channel Plugin 复用 Native 网络库和图片缓存
> 3. 业务开发：机票搜索结果页 Flutter 化，支持国际化 + RTL
> 4. 性能：引擎预热 + 数据预加载，首屏渲染 < 300ms
