# JD（脱敏）

> 投的是 JD1（大前端架构师），JD2 作为补充参考。
> 母婴 IoT 智能硬件，出海北美，RN App 通过 BLE 连接设备。

---

## JD1：大前端架构师 / RN 技术负责人

1. **技术架构与规划**：负责公司移动端及大前端的技术发展规划、系统架构设计，并主导实现。评估和引入前沿技术，为产品中长期发展进行技术储备
2. **基础架构与工程化**：设计和推动 RN 基础架构升级与组件体系优化，搭建前端框架、制定通用组件方案，并推动前端工程化、自动化与工具化建设
3. **性能与质量保障**：持续改进移动应用的性能、安全性、稳定性和可扩展性。主导启动速度、渲染效率、内存管理等关键性能指标的优化
4. **复杂问题攻关**：主导解决底层技术难题，如复杂手势动画、原生混合开发深度适配、动态化方案等。能够独立分析、解决和归纳复杂技术问题
5. **规范与协作**：制定前端开发规范，主导技术方案评审，并指导和提升团队整体技术水平

### JD1 复习索引

#### 1. 技术架构与规划

> 负责公司移动端及大前端的技术发展规划、系统架构设计，并主导实现。评估和引入前沿技术，为产品中长期发展进行技术储备

| JD 子主题 | 文档（主题） |
|-----------|-------------|
| 技术发展规划 | [rn-2026-stack](./RN/rn-2026-stack.md)（2026 技术选型 + 目录结构 + 状态管理） |
| 系统架构设计 | [card-2 README](./cards/card-2/README.md)（JSI/TurboModule 架构 + 调用链 + 内存模型） |
| 主导实现 | [turbomodule-dev-guide](./RN/turbomodule-dev-guide.md)（TurboModule 全流程：Spec → Codegen → Android → iOS → Pure C++） |
| 评估和引入前沿技术 | [cross-platform-comparison](../../resume/explain/3.1-xm/quickapp-framework/cross-platform-comparison.md)（RN vs Flutter vs 小程序 vs 快应用对比） |
| 技术储备 | [rn-full-picture](./RN/rn-full-picture.md)（RN 全景：构建 → 启动 → 渲染 → 通信） |

#### 2. 基础架构与工程化

> 设计和推动 RN 基础架构升级与组件体系优化，搭建前端框架、制定通用组件方案，并推动前端工程化、自动化与工具化建设

| JD 子主题 | 文档（主题） |
|-----------|-------------|
| RN 基础架构升级 | [rn-engineering-deep](./cards/card-3/rn-engineering-deep.md)（多 Bundle 容器 + 实例池 + 原生路由 + 热更新） |
| 组件体系优化 | [architecture-engineering](./RN/architecture-engineering.md)（DDD 目录 + 组件分层 + Design System） |
| 搭建前端框架 | [code-splitting](./RN/code-splitting.md)（分 Bundle 构建拆分 + 运行时加载 + 路由配合） |
| 通用组件方案 | [theme-i18n](./RN/theme-i18n.md)（Theme 系统 + Design Token + 国际化） |
| 前端工程化 | [ci-quality-gate](./cards/card-3/ci-quality-gate.md)（GitLab CI 五层卡点 + Pipeline） |
| 自动化 | [docker-k8s](./cards/card-3/docker-k8s.md)（Docker 构建 + K8s 部署 + CI 集成） |
| 工具化建设 | [card-3 README](./cards/card-3/README.md)（CLI 脚手架 + 物料调试中心 + 依赖分析引擎） |

#### 3. 性能与质量保障

> 持续改进移动应用的性能、安全性、稳定性和可扩展性。主导启动速度、渲染效率、内存管理等关键性能指标的优化

| JD 子主题 | 文档（主题） |
|-----------|-------------|
| 性能 | [performance](./RN/performance.md)（启动/渲染/内存/列表/下沉策略）、[performance-layers](./RN/performance-layers.md)（分层优化体系） |
| 安全性 | [ci-quality-gate](./cards/card-3/ci-quality-gate.md)（依赖漏洞扫描 + 签名校验 + Secret 检测） |
| 稳定性 | [app-metrics](./RN/app-metrics.md)（Crash/ANR/JS Error/白屏检测 + 回滚机制） |
| 可扩展性 | [rn-engineering-deep](./cards/card-3/rn-engineering-deep.md)（多 Bundle 模块化 + DDD + 实例池） |
| 启动速度 | [native-prefetch](./RN/native-prefetch.md)（Native 预请求 + 引擎预热 + Hermes 预编译） |
| 渲染效率 | [performance](./RN/performance.md)（FPS/列表优化/memo/动画下沉 Native）、[gesture-animation](./RN/gesture-animation.md)（Reanimated 3） |
| 内存管理 | [performance-layers](./RN/performance-layers.md)（PSS 监控/泄漏检测/LRU 实例池） |
| 关键性能指标 | [app-metrics](./RN/app-metrics.md)（指标定义 + 目标值 + 测量方式 + 监控架构） |
| 包体 | [bundle-size](./cards/card-1/bundle-size.md)（ABI Split + Hermes .hbc + 分 Bundle + 资源优化） |
| 性能分析工具 | [performance-profiling](./RN/performance-profiling.md)（Profiler/Systrace/Flipper/排查 SOP） |

#### 4. 复杂问题攻关

> 主导解决底层技术难题，如复杂手势动画、原生混合开发深度适配、动态化方案等。能够独立分析、解决和归纳复杂技术问题

| JD 子主题 | 文档（主题） |
|-----------|-------------|
| 复杂手势动画 | [gesture-animation](./RN/gesture-animation.md)（Reanimated 3 + Gesture Handler + 动画下沉 Native） |
| 原生混合开发深度适配 | [card-2 README](./cards/card-2/README.md)（JSI + JNI + ObjC Bridge 全链路）、[ios-for-rn](./RN/ios-for-rn.md)（iOS 侧开发 + 构建 + 性能） |
| 动态化方案 | [rn-engineering-deep](./cards/card-3/rn-engineering-deep.md)（热更新 Native 端方案 + 版本管理 + 回滚） |
| 底层技术难题 | [turbomodule-dev-guide](./RN/turbomodule-dev-guide.md)（TurboModule Android + iOS + Pure C++ 完整开发） |
| IoT 设备通信 | [iot-ble-performance](./RN/iot-ble-performance.md)（BLE+WiFi 共存 + 流畅度 + ArrayBuffer 零拷贝） |
| 快应用底层经验 | [j2v8-deep](../../resume/explain/3.1-xm/quickapp-framework/j2v8-deep.md)（V8 + J2V8 同步 Bridge） |

#### 5. 规范与协作

> 制定前端开发规范，主导技术方案评审，并指导和提升团队整体技术水平

| JD 子主题 | 文档（主题） |
|-----------|-------------|
| 前端开发规范 | [ci-quality-gate](./cards/card-3/ci-quality-gate.md)（Lint → Hooks → CI 全链路卡控） |
| 技术方案评审 | [card-3 README](./cards/card-3/README.md)（工程化体系全景 + 规划路径） |
| 指导和提升团队技术水平 | [React 知识体系](./React/README.md)（Hooks/Fiber/Diff/性能/状态管理）、[debugging-issues](./RN/debugging-issues.md)（调试与问题归因） |
| Theme + 国际化规范 | [theme-i18n](./RN/theme-i18n.md)（Zustand + Appearance + i18n + RTL） |

---

## JD2（补充参考）：RN 开发工程师（IoT）

**岗位职责**

1. 负责现有 App（IoT 类）业务模块开发，涉及智能设备通信交互等
2. 与产品经理配合、深度参与需求讨论，提供可行性方案
3. 参与模块编码和单元测试，并编写相关文档
4. 负责修复功能缺陷、优化性能

**任职资格**

1. 全日制本科或以上学历，毕业 5 周年以上，理工科专业（需提供学信网学历查询结果）
2. 至少 3 年及以上 React Native 开发经验；有 Android/iOS 原生开发经验更佳
3. 技能要求：
   - 必备：React Native、RN 与原生对接
   - 熟悉前端开发技术（HTML5/CSS3/JS/React/Vue/Node.js/ES6）
   - 熟悉 RN 框架及生命周期，熟悉 React Hooks 和函数组件
   - 熟练使用 RN 常用三方库（MobX/React Navigation/Redux/Axios/react-intl）
   - 熟悉 RN 绘制机制，熟悉代码调试和性能优化方法
   - 了解 iOS 和 Android 平台差异，能针对不同平台优化适配
   - 熟悉应用发布流程
   - IoT 领域相关项目开发经验优先

**可能被考察的细节点（从 JD2 提取）**：

| JD2 关键词 | 可能的追问 |
|-----------|-----------|
| RN 与原生对接 | TurboModule 怎么写？事件怎么回传？ |
| RN 生命周期 | useEffect/useState/useRef 的执行时机？ |
| React Hooks | 自定义 Hook 怎么设计？闭包陷阱？ |
| MobX/Redux | 状态管理选型 trade-off？为什么选 Zustand？ |
| React Navigation | native-stack vs JS stack？Deep Linking？ |
| RN 绘制机制 | Fabric 渲染流程？Virtual DOM → Native View？ |
| 代码调试 | DevTools/Profiler/systrace 怎么用？ |
| 性能优化 | 启动/渲染/内存/列表？ |
| iOS/Android 差异 | 权限/推送/后台/键盘/状态栏？→ [平台差异详解](./RN/rn-ios-android-diff.md) |
| 应用发布流程 | 打包/签名/上架/热更新？→ [双端发布流程](./RN/app-release-flow.md) |
| IoT 设备通信 | BLE 连接流程？数据传输？ |

---

## JD2 原始文本（保留）

> 岗位职责
> 1. 负责现有 APP（IoT 类）业务模块开发，涉及智能设备通信交互等
> 2. 与产品经理配合、深度参与需求讨论，提供可行性方案
> 3. 参与模块编码和单元测试，并编写相关文档
> 4. 负责修复功能缺陷、优化性能
>
> 任职资格
> 1. 学历/专业：全日制本科或以上学历，毕业 5 周年以上，理工科专业（需提供学信网学历查询结果）
> 2. 工作经验：至少有 3 年及以上的 React Native 开发经验；有 Android/iOS 原生开发经验更佳
> 3. 技能要求：
>    - 3.1 必备技能：React Native、RN 与原生对接
>    - 3.2 通用技能：
>      - (1) 本科及以上学历
>      - (2) 3 年及以上 React Native 跨平台开发经验，能独立完成程序设计和编码、开发高性能应用
>      - (3) 熟悉前端开发技术（HTML5、CSS3、JS、React、Vue、Node.js、ES6 等）
>      - (4) 熟悉 React Native 框架及其生命周期，熟悉 React Hooks 和函数组件的使用
>      - (5) 熟练使用 RN 常用三方库（MobX/React Navigation/Redux/Axios/react-intl 等），熟悉 RN 的绘制机制，熟悉代码调试和性能优化方法
>      - (6) 了解 iOS 和 Android 平台的差异和特性，能够针对不同平台进行优化和适配
>      - (7) 热爱跨平台技术，有强烈的好奇心和求知欲，有良好的编码规范；熟悉应用发布流程
>      - (8) 具备强烈的责任心、良好的沟通能力和团队精神，较强的自学能力
>      - (9) 有 IoT 领域相关项目开发经验优先
> 4. 工作素质：
>    - (1) 可以单独对已有的系统进行开发和维护，有良好的自学能力，独立思考能力
>    - (2) 积极热情、沟通能力强，有强烈的责任心，具有良好的团队合作精神
>    - (3) 能够承受一定工作压力，能在规定的时间内高效完成任务


---

## JD3：RN 性能优化与稳定性工程师

### 岗位职责（结构化）

| # | 职责 | 关键词 |
|---|------|--------|
| 1 | RN 性能优化（加载慢/Bridge 阻塞/内存泄漏/渲染卡顿/闪退/白屏），对齐原生体验 | 性能全链路 |
| 2 | 基础架构与工程化（性能监控/崩溃监控/打包/bundle/热更新） | 工程化 |
| 3 | 基础组件与工具库（高性能组件/原生桥接/跨端兼容） | 组件 + 桥接 |
| 4 | RN 底层原理（JS 引擎/Bridge/渲染/Fabric/TurboModules） | 底层穿透 |
| 5 | 配合原生团队（原生集成/联调/验收标准/规范沉淀） | 跨团队协作 |
| 6 | 线上故障响应与排查 | 稳定性 |

### 任职要求（结构化）

| # | 要求 | 你的匹配 |
|---|------|---------|
| 1 | 2 年+ RN 开发，有性能优化专项经验 | ✅ CRN + XT + 多项目数据 |
| 2 | 精通 JS/TS，熟悉 React/RN 核心原理、生命周期、桥接机制 | ✅ |
| 3 | RN 性能优化实战（bundle 慢/卡顿/泄漏/白屏/启动/包体） | ✅ card-1 全覆盖 |
| 4 | 至少一端原生开发，能独立联调/开发原生模块 | ✅ 快应用 Android 原生 |
| 5 | Metro 打包/bundle 拆分/热更新/APM 监控 | ✅ CRN + XRN |
| 6 | RN 新架构（Fabric/TurboModules），有迁移经验优先 | ✅ 系统化学习 + J2V8 类似经验 |

### JD3 匹配度：⭐⭐⭐⭐⭐（95%）

**这个 JD 几乎是为你的三张牌量身定做的**：
- 职责 1 = 牌 1（性能体验优化）全覆盖
- 职责 2 = 牌 3（工程化体系）
- 职责 3+4 = 牌 2（跨层通信架构）
- 职责 5 = 你的 Android 原生能力
- 职责 6 = 牌 1 的排查 SOP

**和 JD1 的区别**：JD1 偏"大前端架构师"（管理/规划），JD3 偏"RN 性能专家"（技术深度）。JD3 更聚焦性能，和你的 card-1 几乎 1:1 对应。

---

### JD3 原始文本（保留）

> **岗位职责**
> 1. 负责 RN 端产品的性能优化与稳定性保障工作，聚焦解决 RN 页面加载慢、JS 桥通信阻塞、内存泄漏、渲染卡顿、闪退、白屏等核心问题，优化首屏加载速度、交互流畅度，降低线上异常率，对齐原生端体验标准
> 2. 负责 RN 端基础架构与工程化建设，搭建 RN 专属性能监控、崩溃监控体系，优化打包构建流程、bundle 体积、热更新机制，提升打包效率与包体加载速度
> 3. 负责 RN 端基础组件与工具库建设，封装高性能通用业务组件、原生模块桥接层，优化 JS 与 Native 通信机制，解决跨端兼容性问题，提升跨端开发效率
> 4. 深入研究 RN 底层原理，包括 JS 引擎、桥通信机制、渲染流程、生命周期管理，定位并解决疑难跨端兼容性问题与性能瓶颈，落地前沿 RN 优化方案（如 Fabric、TurboModules、新架构适配）
> 5. 配合 iOS、Android 原生团队，完成原生模块集成、性能联调与问题修复，建立 RN 端性能与稳定性验收标准，沉淀优化方案与开发规范
> 6. 参与线上 RN 端故障快速响应与排查，推动问题根因解决，持续优化跨端产品的整体稳定性与性能表现
>
> **任职要求**
> 1. 本科及以上学历，计算机相关专业，2 年及以上 React Native 开发经验，有 RN 性能优化、稳定性专项工作或大型 RN 项目开发经验者优先
> 2. 精通 JavaScript/TypeScript 语言，熟练掌握 React、RN 框架核心原理，熟悉 RN 生命周期、状态管理、样式布局、原生模块封装与桥接机制
> 3. 具备扎实的 RN 性能优化实战经验，能独立解决 bundle 加载慢、渲染卡顿、内存泄漏、闪退、白屏等问题，熟悉 RN 包体积优化、启动优化、缓存优化技术
> 4. 熟悉至少一端原生开发（iOS/Android），能独立进行 RN 与原生联调、原生模块开发，了解原生端性能监控与调试工具优先
> 5. 熟悉 RN 工程化优化技术，包括 Metro 打包配置、bundle 拆分、热更新、混淆优化，了解 APM 监控平台在 RN 端的适配与落地优先
> 6. 了解 RN 新架构（Fabric、TurboModules）原理，有新架构迁移或优化经验者优先