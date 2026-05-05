# Resume Draft

> 目标岗位：大前端架构师
> 脱敏规则：公司名用代号（XM/XC/XT/MT/DFGX），个人信息省略

## 目录

- [一、专业技能](#一专业技能)
- [二、开源项目](#二开源项目)
- [三、项目经历](#三项目经历)
  - [3.1 XM·IoT 研发部·前端框架部（2024.4 ~ 至今）](#31-xmiot-研发部前端框架部20244--至今)
  - [3.2 XC·机票事业部（2023.5 ~ 2023.9）](#32-xc机票事业部20235--20239)
  - [3.3 XT·技术部·金融产品（2022.12 ~ 2023.3）](#33-xt技术部金融产品202212--20233)
  - [3.4 MT·优选·终端研发组（2020.10 ~ 2022.5）](#34-mt优选终端研发组202010--20225)
  - [3.5 MT·打车·终端研发组（2019.10 ~ 2020.9）](#35-mt打车终端研发组201910--20209)
  - [3.6 DFGX·技术一部（2017.9 ~ 2019.8）](#36-dfgx技术一部20179--20198)
- [待补充](#待补充)

---

## 简历结构规划

```
一、专业技能（四条能力线组织）
二、开源项目
三、项目经历（按公司时间线，每个项目标注能力线）
    3.1 XM·IoT 研发部·前端框架部（2024.4 ~ 至今）
        ① 全链路性能分析平台 → 能力线 1 + 3
        ② 快应用框架 → 能力线 2 + 3
        ③ AIOT-IDE → 能力线 2
    3.2 XC·机票事业部（2023.5 ~ 2023.9）
    3.3 XT·技术部·金融产品（2022.12 ~ 2023.3）
    3.4 MT·优选·终端研发组（2020.10 ~ 2022.5）
    3.5 MT·打车·终端研发组（2019.10 ~ 2020.9）
    3.6 DFGX·技术一部（2017.9 ~ 2019.8）
```

---

## 一、专业技能

### 能力线 1：全栈全链路交付

- 前端：Vue3、TypeScript、Vite、ECharts.js、React.js
- 后端：Node.js、Express/Koa、GraphQL
- 数据库：MySQL，数据库建模与查询优化
- DevOps：CI/CD 流水线搭建、Docker 部署、灰度发布
- 监控运维：错误上报、埋点体系、性能检测、监控告警、日志分析

### 能力线 2：跨端开发与框架设计

- 跨端框架：React Native（CRN）、快应用框架（JS→Native View）、小程序
- 桌面端：Electron（VS Code 二次开发）
- Android 原生：Gradle、NDK、V8/J2V8、JNI、proguard
- 核心能力：JS Bridge 设计、渲染引擎原理、跨端技术选型方法论
- 终端覆盖：Web / RN App / 小程序 / 桌面端（Electron）/ 跨端框架层

### 能力线 3：工程化和质量治理

- 构建工具：Webpack、Vite、Babel、Rollup、Gradle
- 工程化：脚手架 CLI、monorepo、CI/CD 流水线、发布体系、插件机制
- 质量治理：ESLint、Git Hooks、Code Review 机制、全链路卡控（编码→CI→发布）
- 性能治理：性能探针 SDK、包体积优化（proguard/shrinkResources/条件编译）、秒开率优化
- 设计思想：设计模式、函数式编程、AOP、DDD

### 能力线 4：AI Agent 开发与 AI 融入开发实践

- AI Agent 系统设计与开发（MCP Server 开发与注册、Prompt Engineering、工具链集成）
- AI 融入研发全流程：AI Coding + AI Review + AI 辅助架构设计
- 基于 MCP 打通研发全链路自动化：飞书MCP（需求）→ Figma MCP（设计）→ Kiro（生成代码）→ DevTools MCP（验证渲染）→ Gerrit MCP（Code Review）→ Jira MCP（Bug 管理）
- 工作模式实践：架构师 + 产品经理综合视角 + AI 高效执行，一人Team级规格全栈全链路交付

---

## 二、开源项目

### 条件编译工具套件

面向前端主流源码类型（xml, css, js），基于 AOT 以特殊注释作为编译指令进行条件编译，实现对源码内容根据不同目标平台进行精确裁剪，减少打包体积，减轻运行时压力。

- 面向 js：babel-plugin-conditional-compile-with-comment [git](https://github.com/BlueStoneQ/babel-plugin-conditional-compile.git) | [npm](https://www.npmjs.com/package/babel-plugin-conditional-compile-with-comment)
- 面向 css：postcss-plugin-conditional-compile [git](https://github.com/BlueStoneQ/postcss-plugin-conditional-compile.git) | [npm](https://www.npmjs.com/package/postcss-plugin-conditional-compile)
- 面向 xml 模版：xml-conditional-compile [git](https://github.com/BlueStoneQ/xml-conditional-compile.git) | [npm](https://www.npmjs.com/package/xml-conditional-compile)

---

## 三、项目经历

### 3.1 XM·IoT 研发部·前端框架部（2024.4 ~ 至今）

#### ① 全链路性能分析平台（全栈 · 全链路开发）【能力线 1 + 3】

- 背景：对设备/芯片的负载（指令数）、功耗、性能、流畅度（帧率）等进行可视化分析优化
- 技术方案：
  - 系统架构：探测上报端 → 后台分析平台 → 持久化层 → 前端可视化分析平台
  - 前端技术栈：Vue3 + TypeScript + Vite
- 全链路开发能力（从 0 到 1 独立交付）：
  - 技术选型：独立完成前后端技术栈评估与选型
  - 数据库设计：数据库建模、表结构设计、查询优化
  - 后端开发：API 设计、数据分析逻辑、持久化层实现
  - 前端开发：可视化分析平台、图表交互、数据大屏
  - 构建体系：工程化搭建、静态检查、代码规范
  - CI/CD：一键部署、灰度发布、发布流水线搭建
  - 监控运维：错误上报、埋点上报、性能检测、监控告警
  - 线上问题排查：日志分析、异常定位、性能瓶颈排查

#### ② 快应用框架（跨端框架 · Android 原生 · 包体积治理）【能力线 2 + 3】

- 小米系统级快应用运行时框架，类 RN 架构（JS 驱动 Native View 渲染，非 WebView），V8 引擎 + J2V8 同步 Bridge
- 预装包体优化：使用条件编译、resConfigs、shrinkResources、proguard 混淆等手段，预装包 153MB → ~60MB，dex 44.4MB → 27MB（-39%）
- 排查 consumerProguardFiles 传递阻塞 R8 的根因，修复混淆未生效问题
- 凡泰/百度模块裁剪与降级方案：反射解耦编译依赖 + metadata 入口控制 + 自升级兜底
- DEX Layout Optimization 启动内存优化
- CI/CD 构建环境修复 + ROM 出包全流程打通

#### ③ 快应用 IDE（AIOT-IDE / QuickApp Studio，桌面端 Electron 应用）【能力线 2】

- 背景：为快应用开发者提供覆盖开发全链路的集成开发环境，服务于 IoT 生态繁荣
- 覆盖开发全链路：项目创建 → 语法高亮 → 调试预览 → 构建编译 → 打包发布
- 技术方案：
  - 基于 VS Code（Electron）二次开发的桌面端 IDE，支持 macOS / Linux / Windows 三平台
  - UX 语言服务器（基于 Language Server Protocol，提供语法高亮/补全/诊断）
  - 模拟器调试和真机调试（基于 Debug Adapter Protocol）
  - 应用性能与质量检测评分工具（含依赖分析引擎，支持访问者和遍历者模式）
  - 构建打包工具（rpk 编译 + 签名 + 产物输出）

---

### 3.2 XC·机票事业部·机酒终端组: 资深工程师（2023.5 ~ 2023.9）【能力线 2】

#### ① XC App 机酒频道 + 国际化 App（React Native）

- CRN 框架（React Native 的企业级定制）工程化实践
- 业务分频道、分 bundle、分版本热更新上线
- BFF 层 GraphQL 聚合裁剪接口
- CI/CD 配置和优化
- 国际化开发

---

### 3.3 XT·技术部·金融产品:前端架构师（2022.12 ~ 2023.3）【能力线 2 + 3】

#### ① XT App（React Native）

**弹窗治理**（弹出时机冲突和顺序混乱问题）
- UI 层：props 驱动型 + Redux dispatch 驱动型 + Android 动态权限弹窗
- 拦截层：HOC 拦截器 + Redux middleware 拦截器 + AOP 拦截器
- 调度层：策略模式 + 优先级异步任务队列
- 配置层：线上配置中心 + API 层 + 持久化层

#### ② 全链路代码质量治理【能力线 3】

- 代码规范设计
- 推动全链路（编码时Lint → Git Hooks → CI/CD）卡控方案完善
- Review 机制的设计和推动落地

---

### 3.4 MT·优选·终端研发组（2020.10 ~ 2022.5）【能力线 3】

#### ① 页面搭建系统（低代码）：工程化建设 + 人效工具

主 R，负责调研收集问题、设计解决方案：

- 物料端脚手架 CLI 工具（项目模板、初始化、发布、local-server、plugin 扩展机制）
- CI/CD 流程建设（发布脚本、流水线、KeyPerson 审批插件）
- 物料本地可视化调试中心（本地调试链路从 5 环节/1min47s 缩短至 2 环节/10s）
- 营销活动快捷创建工具（活动数据生成从 0.5pd 降低到 15s）

#### ② 秒开率探针 SDK【能力线 3】

- 主 R，开发秒开率探针 SDK
- 测速模块：有限状态机 + AOP，对小程序页面生命周期和组件 setData 进行拦截注入
- 上报模块：基于指标监控平台的统一性能探针实现

#### ③ 数据预加载方案

- 主 R，通用型页面启动优化方案
- 将业务数据请求从生命周期前置到页面跳转之前
- 架构：发布-订阅（事件驱动）+ 请求并发操作

#### ④ 满减凑单页性能优化

- 秒开率从 10% 提升到 78%（请求预加载 + 合并 setData + 非渲染数据迁移）

---

### 3.5 MT·打车·终端研发组（2019.10 ~ 2020.9）

- 商运后台管理系统（Vue + ElementUI + 微前端）
- mock 工具 mock-book（基于 Thrift IDL 生成 mock 数据，提供可视化操作界面）

---

### 3.6 DFGX·技术一部·前端开发组（2017.9 ~ 2019.8）

- 面向政企 toB 领域，独立负责景区多个信息平台系统
- 业务类型：PC 端（门户网站、管理平台）、移动端（H5/HybridApp/微信小程序）、大屏、直播监控
- 技术栈：React、MobX/Redux、Ant Design、ECharts、jQuery、Bootstrap
- 带队开发：带领 5 人团队完成交付

---

## 待补充

- [ ] AI Agent 开发的具体项目描述（能力线 4 的实战支撑）
- [ ] 快应用框架项目的面试话术精炼
- [ ] Target JD 匹配度分析更新
