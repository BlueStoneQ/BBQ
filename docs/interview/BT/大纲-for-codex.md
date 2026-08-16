> 嵌入式应用平台架构师-移动OS  
- 
1. 负责下一代嵌入式应用生态的整体架构设计与落地，构建可扩展的应用平台与生态体系，包括多端场景（覆盖穿戴等设备形态）的生态架构设计与演进；
2. 负责应用运行机制、能力接入体系、应用模型、插件机制、服务协同机制等核心架构设计，以及平台基础能力设计（含应用容器、系统能力开放、账号权限、数据与上下文协同、调试与开发工具链等）；
3. 负责应用接入标准、生态规则、兼容性策略和演进机制设计，支撑生态持续建设；
4. 协同产品、业务、系统和端侧团队推进平台能力落地，解决重点架构问题，支撑业务发展，跟踪轻应用、小程序、跨端应用、Agent、插件化等方向的技术演进，推动下一代嵌入式应用架构升级。

- 
2. 嵌入式应用平台架构
3. 有应用生态建设经验，参与过生态从0到1或从1到N的建设，包括应用接入、能力开放、开发者体系、生态治理或分发机制；
4. 具备较强的系统架构能力，能够从平台视角设计模型、系统边界、扩展机制和演进路径；
5. 熟悉跨端应用架构、应用运行时、容器化、插件化、组件化、服务化等关键技术方向，熟悉嵌入式系统、移动端或IoT设备的软件架构特点，能够处理不同设备形态下的能力差异与适配问题；
6. 对下一代嵌入式应用形态有较好理解，理解应用、Agent、工具、服务之间的协同关系，具备良好的跨团队协作和推动能力，能够推动复杂架构方案落地。

- 
1. 有轻应用、小程序、开放平台、插件平台、开发者平台等相关建设经验
2. 有应用分发、能力开放、生态治理、工具链建设等相关经验；
3. 有手机、IoT、车载、穿戴、大屏等多端平台架构经验；
4. 有较强的平台型思维，能独立推动架构演进

## QuickApp Kit 能力建设版本规划

> 当前实施以 QuickApp Kit v3 为唯一基线：Core 从第一天独立，产品闭环顺序固定为 LVGL/SDL -> Android -> iOS。

| 大纲能力 | QuickApp Kit 架构体现 | V1 | V2 | V3 |
|---|---|---|---|---|
| 应用运行机制 | Runtime RPK 加载、JS Framework、App/Page/Surface、生命周期、路由、渲染管线 | 联盟 DSL 构建为 Runtime RPK；LVGL/SDL 首闭环，Android/iOS 复用同一 Runtime | 完整生命周期矩阵、异常边界、页面缓存策略 | 多应用/多实例、复杂调度与资源治理 |
| 应用模型 | RPK Contract、Manifest Model、AppRuntime、Page、Surface、Component | 解析 manifest、入口页、页面 bundle、基础组件 | 完整组件模型、卡片/多 Surface | 多形态应用模型与动态组件 |
| 跨端 Runtime Core | 独立 C++ Core、唯一 Runtime Tree、Layout、MountTransaction、typed Platform Port | 从第一天独立实现，LVGL/Android/iOS 复用且禁止平台类型泄漏 | Core API 稳定化与设备 profile | 多设备 runtime capability negotiation |
| 多端渲染后端 | LVGL/SDL、Android View、iOS UIKit | LVGL/SDL 首闭环，Android 第二、iOS 第三；三端使用同一 Artifact/Core/JS | 真实嵌入式设备优化与更多 Host 能力 | 穿戴、车载、大屏等更多后端 |
| 能力接入体系 | Capability Module、ModuleRegistry、Provider、Invoker | 最小 `system.router`、`system.prompt`、`system.device` | ModuleSpec、Promise、版本发现 | Codegen、动态插件、服务市场 |
| 插件机制 | TurboModule-like Capability Module | 手动注册、懒加载、unsupported fallback | Schema/IDL、权限 hook、版本协商 | 动态插件包、隔离与治理 |
| 系统能力开放 | `system.*` 能力模块 | 最小能力跑通主链路 | fetch/storage/device/account 等扩展 | 端侧系统能力标准化开放 |
| 账号权限 | Manifest permissions、PermissionChecker hook | 只留 hook，不做完整权限体系 | 权限声明校验、调用前检查 | 账号、授权、审计、策略治理 |
| 数据与上下文协同 | AppContext、PageContext、ServiceContext | App/Page context 最小结构 | Context Store、跨页面上下文 | Agent/服务/应用上下文协同 |
| 服务协同机制 | `service.*`、`agent.tool` 能力命名空间 | 只留架构位置 | 本地服务 provider、Agent tool provider | 服务编排、工具生态 |
| 调试与开发工具链 | CLI-first Toolkit、inspect、run、bench、VSCode 插件后续封装 | CLI build/inspect/run、基础 benchmark | validate/debug/trace、VSCode 插件 | 开发者控制台、可视化调试 |
| 应用接入标准 | RPK Contract、Manifest validation、Compatibility Matrix | RPK 结构校验、manifest 基础校验 | API/能力兼容矩阵 | 接入认证、生态规范 |
| 生态规则与治理 | 包校验、能力声明、权限声明、分发前检查 | 不做完整治理，只保留校验入口 | 规则引擎、兼容等级 | 分发、审核、灰度、治理体系 |
| 兼容性策略 | RuntimeVersion、FeatureDiscovery、fallback | unsupported fallback、基础 feature check | 版本协商、降级策略 | 多版本 Runtime 与生态演进 |
| Benchmark 与可观测 | Trace、Metrics、Benchmark Protocol | 启动、首屏、JS、layout、mount、bridge、内存基础指标 | 对比 RN/Lynx/Flutter/快应用类框架 | 持续性能平台与质量门禁 |
