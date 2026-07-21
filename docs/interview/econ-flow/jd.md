# 正浩 EcoFlow — 跨端容器/大前端专家

---

## 职位描述

1. 负责 RN（React Native）跨端容器的架构设计、技术选型与核心模块开发，保障容器的稳定性、性能及扩展性
2. 深入研究 RN 跨端容器的底层原理，解决容器在适配不同平台（iOS、Android）、与原生交互等过程中出现的复杂技术问题
3. 主导 RN 跨端容器相关的性能优化工作，包括启动速度、内存占用、页面渲染效率等，提升用户体验
4. 制定 RN 跨端容器的开发规范、技术文档及最佳实践，指导团队成员进行开发工作，提升团队整体技术水平
5. 跟踪 RN 及跨端容器领域的技术发展趋势，引入先进的技术和方案，推动团队技术创新
6. 与产品、设计及其他技术团队紧密协作，参与需求分析和技术方案评审，确保产品功能的顺利实现

## 职位要求

1. 本科及以上学历，计算机相关专业，6 年以上 RN 跨端容器开发及相关工作经验
2. 熟悉 React Native 源码，精通 RN 框架及原理，深入理解 RN 与原生（iOS/Android）交互机制，有丰富的 RN 跨端容器与原生集成开发经验
3. 熟悉至少一种原生开发技术（如 iOS 的 Objective-C/Swift，Android 的 Java/Kotlin），能够独立完成原生模块的开发与调试
4. 精通 RN 包动态加载原理与 RN 桥接层原生功能封装，可实现 RN 与原生功能的高效、稳定交互
5. 精通 RN 插件编写经验，能扩展 RN 跨端容器功能以满足多样化业务需求
6. 良好的架构设计能力和问题分析解决能力，有大型 RN 跨端应用或容器开发经验者优先
7. 良好的团队协作精神和沟通能力，自驱力强，有较强的责任心

---

## JD 拆解 & 匹配

| # | JD 关键词 | 你的对应经验 | 匹配 |
|---|-----------|-------------|:---:|
| 1 | RN 容器架构设计 + 核心模块 | XRN 架构（Native Router + RN Navigation 双段路由 + 容器管理） | ✅✅ |
| 2 | RN 底层原理 + iOS/Android 适配 | TurboModule（Android JNI / iOS OC++）+ 快应用 V8/J2V8 Bridge | ✅✅ |
| 3 | 性能优化（启动/内存/渲染） | 白屏优化、PreFetch TurboModule、引擎预热、内存优化(PSS) | ✅✅ |
| 4 | 开发规范 + 技术文档 + 带团队 | 工程化全链路卡控 + CI/CD + 新人导师 | ✅ |
| 5 | RN 包动态加载 + 桥接层封装 | 分 bundle + 热更新 + TurboModule/NativeModule 封装 | ✅✅ |
| 6 | RN 插件编写 | TurboModule = RN 插件（PreFetch/Router/DeviceInfo） | ✅✅ |
| 7 | 原生开发（iOS OC/Swift 或 Android Java/Kotlin） | Android NDK/JNI 深度 + iOS Bridging Header/XCFramework | ✅ |

**匹配度：95%+** — 这个 JD 就是为你的 XRN 经验量身定制的。

---

## TOP3 Card（面试主打牌）

### Card 1：XRN 容器架构（命中 JD#1 #2 #6）

- 统一路由：所有路由收口 Native Router 层（URI Scheme 注册表），JS 侧不持有路由决策权
- 容器生命周期管理：预创建/复用/销毁
- TurboModule 体系：PreFetch / Router / DeviceInfo
- RN 与 Native 通信：JSI 同步调用 vs Bridge 异步

### Card 2：性能优化（命中 JD#3）

- 白屏优化：引擎预热 + Bundle 预加载 + 数据 PreFetch 并行
- 启动速度：Native 侧并行（加载 Bundle ∥ 发请求），白屏 800ms → 300ms
- 内存：PSS 监控 + DEX 布局优化 + 页面级内存回收
- 渲染：首帧优化 + Hermes 引擎 + Fabric 新架构

### Card 3：包动态加载 + 工程化（命中 JD#4 #5）

- 分 Bundle：业务 bundle 按频道拆分，独立版本管理
- 热更新：CodePush / 自建方案，灰度 + 回滚
- CI/CD：构建 → 产物发布 → 版本管理 → 监控告警
- 开发规范：ESLint + Git Hooks + Code Review 机制
