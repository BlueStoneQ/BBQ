# Resume Draft v6 — for BT 嵌入式应用平台架构师

> 目标岗位：嵌入式应用平台架构师（移动 OS）
> 设计理念：突出应用平台架构 + 多端 Runtime + 生态建设经验，开源项目前置
> 脱敏规则：公司名用代号（XM/XC/XT/MT/DFGX），个人信息省略

---

## 定位

10 年前端/跨端经验，专注应用平台架构与跨端 Runtime 设计。在 XM IoT 从 0 到 1 主导快应用框架建设（Android + 嵌入式双端 Runtime + IDE 工具链），具备应用模型、运行时、能力开放、插件机制、多端适配、生态工具链的全链路架构与落地能力。业余独立设计并实现开源跨端快应用引擎 QuickApp Kit（C++ Core + 多平台 Adapter）。

---

## 一、专业技能

### 1. 快应用平台架构（Runtime + 工具链 + 生态）

- 框架架构设计与实现：应用模型（Manifest/RPK）、生命周期、JS→Native 渲染管线、能力接入体系
- 跨端 Runtime：C++ 平台无关 Core（Shadow Tree / Layout / Event Router）+ 多平台 Adapter（Android View / LVGL / iOS UIKit）
- 应用容器：V8 / J2V8 同步 Bridge（类 JSI）、多实例管理、隔离与调度
- 插件化 / 组件化 / 服务化：TurboModule-like 能力模块、ModuleRegistry、动态注册、懒加载
- 多端适配：Android / 嵌入式（NuttX/Vela）/ iOS / 穿戴 / IoT，能力差异抽象与降级
- IDE 工具链：基于 VS Code 二次开发的快应用 IDE，覆盖创建→调试→构建→发布全链路
- CLI 工具：build / inspect / run / benchmark / validate
- 应用接入标准：RPK 结构校验、Manifest 校验、兼容性矩阵
- 开发者体系：模拟器调试、真机调试（CDP）、扩展插件 API、静态检测评分

### 2. 工程化与性能优化

- 构建：Webpack、Vite、Gradle、Rollup、条件编译
- 包体优化：预装包 153MB→60MB、DEX 44.4MB→27MB（-39%）
- 启动优化：DEX 布局优化、热代码前置（PSS MAX 41MB→35.8MB）
- 可观测：性能探针 SDK、Benchmark 协议、启动/首屏/内存/布局全链路指标

### 3. AI Agent 开发

- AI Coding Agent 框架（Mako）：微内核 + 插件架构 + Trace 可观测 + Benchmark
- 基于 MCP 打通研发全链路自动化

---

## 二、开源项目

### QuickApp Kit — 跨端快应用引擎（进行中）

独立设计的跨平台快应用 Runtime，对标行业轻应用/小程序引擎。三层架构：JS Framework（状态 + 增量意图）→ C++ Core（Runtime Tree + Layout + Event）→ Platform Adapter（Android / LVGL / iOS）。

- 三大系统：bridge + 渲染管线 + 事件系统，应用运行系统
- 配套工具链：toolkit -》 IDE
- 可裁剪性：固定骨架 + 可裁剪外围
    - QuickApp Kit 通过单向依赖、模块化外围和编译期 Build Profile，在保持 Bridge、渲染管线、事件系统完整的前提下，移除目标设备不需要的组件、能力和第三方依赖。
- 可观测：
```
    方面	Top 1	Top 2	Top 3
    包体	Runtime 固件体积	应用 RPK 体积	单个 Feature/组件的增量体积
    内存	首屏峰值 RAM	稳态 RAM	页面销毁后的残留及多轮增长
    性能	冷启动到首屏展示	点击到界面更新	Render/Layout/Mount 最坏时延
    稳定性	Crash-free 运行时长/次数	OOM、队列溢出次数	事务失败后的恢复成功率
    功耗	稳态功耗	交互/渲染峰值功耗	空闲唤醒频率
```

- 单树渲染模型：JS 计算增量，C++ 维护唯一权威 Runtime Tree，Platform 执行 Host 操作
- 多端后端：Android View、LVGL（嵌入式/穿戴）、iOS UIKit
- Typed Message 协议：InstantiateTemplate / RenderTransaction / EventMessage / FeatureRequest
- 配套 Toolkit（CLI）：RPK 编译、IR 生成、校验、运行、Benchmark
- Benchmark 体系：对比 RN / Lynx / Flutter / 快应用联盟，覆盖启动、首屏、内存、布局

[GitHub](https://github.com/user/quickapp-kit)

### Mako — AI Coding Agent 框架

模型无关的 AI Coding Agent 框架。微内核 + 插件架构，内置 Trace 可观测性和 Benchmark 评测。[GitHub](https://github.com/BlueStoneQ/mako)

### XRN — React Native 企业级工程化方案

多 Bundle + 热更新 + 灰度发布。Android + iOS 双端 Native 容器 + CLI + 构建引擎 + 热更新服务端 + 客户端 SDK。[GitHub](https://github.com/BlueStoneQ/XRN)

### 条件编译工具套件

面向 xml / css / js 的 AOT 条件编译，按目标平台精确裁剪源码，用于包体优化与跨端复用。
- babel-plugin-conditional-compile-with-comment [npm](https://www.npmjs.com/package/babel-plugin-conditional-compile-with-comment)
- postcss-plugin-conditional-compile [npm](https://www.npmjs.com/package/postcss-plugin-conditional-compile)
- xml-conditional-compile [npm](https://www.npmjs.com/package/xml-conditional-compile)

---

## 三、项目经历

### 3.1 XM·IoT 研发部·前端框架部（2024.4 ~ 至今）

#### ② 快应用框架（嵌入式 · Vela/NuttX · C++ 引擎层）

将快应用能力从 Android 扩展到嵌入式全平台（IoT / 穿戴 / 车机），C++ 统一引擎层。

- **渲染链路**：JSON 协议驱动 → DOM 树 → Flexbox 布局 → 平台 Widget 渲染
- **引擎核心**：C++ 实现平台无关 W3C DOM 子集 + CSS 层叠 + 布局计算
- **多端适配**：通过 Platform Adapter 对接不同渲染后端（LVGL / Flutter / 原生）
- **增量更新**：TreeMutation + NodePatch 增量同步，避免全量重建

#### ① 快应用框架（Android · 系统级跨端 Runtime）

系统级快应用运行时，JS 驱动 Native View 渲染（非 WebView），V8 + J2V8 同步 Bridge（类 JSI）。

- **应用模型**：Manifest 声明 + RPK 包结构 + App/Page/Component 生命周期
- **能力接入体系**：system.* 能力模块、ModuleRegistry、Provider/Invoker、懒加载
- **包体优化**：预装包 **153MB → ~60MB**，DEX **44.4MB → 27MB（-39%）**
- **模块裁剪与降级**：反射解耦编译依赖 + metadata 入口控制 + 自升级兜底
- **启动内存优化**：DEX 布局优化，热代码前置（PSS MAX **41MB → 35.8MB**）
- **自动化测试**：Python + pytest + uiautomator2，覆盖启动/滑动/点击场景

#### ③ 快应用 IDE（桌面端 Electron · 开发者工具链）

为快应用开发者提供覆盖开发全链路的集成开发环境。

- 基于 VS Code（Electron）二次开发，支持 macOS / Linux / Windows
- 覆盖项目创建 → 语法高亮 → 调试预览 → 构建编译 → 打包发布
- 模拟器调试 / 真机调试（CDP 协议）
- 扩展插件 API：新增 TopBar / RightBar UI 贡献点，插件声明式注册自定义面板
- 基于自研依赖分析引擎的应用静态检测评分工具
- 内置插件自动安装：首次启动从商店拉取最新版本静默安装

#### ④ 负载性能分析平台（全栈 · 从 0 到 1）

对设备/芯片的负载、功耗、性能、流畅度进行可视化分析。

- 全链路独立交付：技术选型 · 数据库建模 · 后端 API · 前端可视化 · CI/CD
- 大文件上传优化：S3 MPU 分片并发，4.4G 文件 121s → 42s（提速近 3 倍）

#### ⑤ AI 辅助研发实践

- 基于 MCP 打通研发自动化链路：飞书（需求）→ Figma（设计）→ Gerrit（Review）→ Jira（Bug）

---

### 3.2 XC·机票事业部·机酒终端组: 资深工程师（2023.5 ~ 2023.9）

#### ① XC App 机酒频道 + 国际化 App（React Native + iOS + Android）

- CRN 框架（RN 企业级定制）工程化实践
- 多 Bundle、分版本热更新上线
- BFF 层 GraphQL 聚合裁剪接口

---

### 3.3 XT·技术部·金融产品: 前端架构师（2022.12 ~ 2023.3）

#### ① XT App（React Native + Android + iOS）— 团队阻塞点与难点爆破

- 弹窗治理：策略模式 + 优先级异步任务队列 + AOP 拦截器
- 全链路代码质量治理：Lint → Git Hooks → CI/CD 卡控方案

---

### 3.4 MT·优选·终端研发组（2020.10 ~ 2022.5）

#### ① 页面搭建系统（低代码）：工程化建设（主 R）

- 物料端脚手架 CLI：模板、初始化、发布、plugin 扩展机制
- CI/CD 流程建设 + 物料本地可视化调试中心

#### ② 秒开率探针 SDK（主 R）

- 有限状态机 + AOP，拦截小程序生命周期注入测速

#### ③ 满减凑单页性能优化

- 秒开率 **10% → 78%**

---

### 3.5 MT·打车·终端研发组（2019.10 ~ 2020.9）

- 商运后台管理系统（Vue + 微前端）
- mock 工具 mock-book：基于 Thrift IDL 生成 mock 数据

---

### 3.6 DFGX·技术一部·前端开发组（2017.9 ~ 2019.8）

- 政企 toB 领域，覆盖 PC / 移动端 / 大屏 / 直播监控
- 带领 5 人团队完成多个信息平台交付
