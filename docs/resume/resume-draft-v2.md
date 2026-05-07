# Resume Draft v2

> 目标岗位：前端开发 / 大前端架构
> 设计理念：菜单，不是说明书。留钩子，让面试官想问。
> 脱敏规则：公司名用代号（XM/XC/XT/MT/DFGX），个人信息省略

---

## 定位

10 年前端经验，具备跨端开发与框架设计经验的大前端架构师。五端实战覆盖（Web / RN App / 小程序 / 桌面端 / 跨端框架层），具备从 0 到 1 的全栈平台建设能力。

---

## 一、专业技能

### 1. 全栈全链路交付

- 前端：React / Vue3 / Nuxt、TypeScript、Vite、ECharts
- 后端：Node.js、Koa / Express、GraphQL
- 数据与运维：MySQL 建模、CI/CD、Docker、灰度发布、监控告警、日志排查

### 2. 跨端开发与框架设计

- 跨端：React Native（CRN）、快应用框架（JS → Native View）、小程序
- 桌面端：Electron（VS Code 二次开发 / 插件）
- Android 原生：Java / C++、Gradle、NDK、V8 / J2V8、JNI、R8
- 核心：JS Bridge 设计、渲染引擎设计、包体优化、跨端技术选型

### 3. 前端工程化体系建设

- 构建：Webpack、Vite、Babel、Rollup、Gradle
- 工程化：脚手架 CLI、CI/CD 流水线、发布体系、插件机制
- 质量：ESLint、Git Hooks、全链路卡控（编码 → CI → 发布）
- 性能：性能探针 SDK、包体优化（R8 / 条件编译）、秒开率优化

### 4. 设计与研发实践

- 设计实践：设计模式、函数式、AOP、DDD
- AI 辅助研发：Prompt Engineering、MCP 工具链集成，融入研发全流程提效

---

## 二、开源项目

### 条件编译工具套件

面向 xml / css / js 的 AOT 条件编译，基于特殊注释指令对源码按目标平台精确裁剪，用于包体优化与跨端复用。

- babel-plugin-conditional-compile-with-comment [git](https://github.com/BlueStoneQ/babel-plugin-conditional-compile.git) · [npm](https://www.npmjs.com/package/babel-plugin-conditional-compile-with-comment)
- postcss-plugin-conditional-compile [git](https://github.com/BlueStoneQ/postcss-plugin-conditional-compile.git) · [npm](https://www.npmjs.com/package/postcss-plugin-conditional-compile)
- xml-conditional-compile [git](https://github.com/BlueStoneQ/xml-conditional-compile.git) · [npm](https://www.npmjs.com/package/xml-conditional-compile)

---

## 三、项目经历

### 3.1 XM·IoT 研发部·前端框架部（2024.4 ~ 至今）

#### ① 负载性能分析平台（全栈 · 从 0 到 1 独立交付）

对设备/芯片的负载、功耗、性能、流畅度进行可视化分析。

- 架构：探测上报端 → 后台分析平台 → 持久化层 → 前端可视化
- 全链路独立交付：技术选型 · 数据库建模 · 后端 API · 前端可视化 · CI/CD · 监控告警 · 线上问题排查
- 性能瓶颈优化：大文件上传（**S3 MPU 分片并发**，4.4G 文件从 121s 降至 42s，**提速近 3 倍**）、ECharts 大数据渲染（Web Worker + 降采样）

#### ② 快应用框架（类RN跨端框架 · Android 原生）

系统级快应用运行时，**JS 驱动 Native View 渲染（非 WebView）**，V8 + J2V8 同步 Bridge（类 JSI）。

- 包体优化：预装包 **153MB → ~60MB**，dex **44.4MB → 27MB（-39%）**
- 排查 **consumerProguardFiles 传递阻塞 R8** 的根因，修复混淆未生效
- 模块裁剪与降级方案：**反射解耦编译依赖** + metadata 入口控制 + 自升级兜底
- DEX Layout Optimization 启动内存优化

#### ③ 快应用 IDE（桌面端 Electron 应用）

为快应用开发者提供覆盖**开发全链路**的集成开发环境。

- 基于 VS Code（Electron）二次开发，支持 macOS / Linux / Windows
- 覆盖项目创建 → 语法高亮 → 调试预览 → 构建编译 → 打包发布
- 基于依赖分析引擎的应用静态检测评分工具
- 模拟器调试 / 真机调试（CDP 协议）

---

### 3.2 XC·机票事业部·机酒终端组: 资深工程师（2023.5 ~ 2023.9）

#### ① XC App 机酒频道 + 国际化 App（React Native）

- CRN 框架（RN 企业级定制）工程化实践
- 业务分频道、**分 bundle、分版本热更新**上线
- BFF 层 GraphQL 聚合裁剪接口
- 国际化开发

---

### 3.3 XT·技术部·金融产品: 前端架构师（2022.12 ~ 2023.3）

#### ① XT App（React Native） — 团队阻塞点与难点爆破

- **一键注册**：RN 混合原生开发，一键获取用户手机号
- **弹窗治理**（弹出时机冲突 & 顺序混乱）
  - UI 层：props 驱动型 + Redux dispatch 驱动型 + Android 动态权限
  - 拦截层：HOC + Redux middleware + **AOP** 拦截器
  - 调度层：**策略模式 + 优先级异步任务队列**
  - 配置层：线上配置中心 + API + 持久化

#### ② 全链路代码质量治理

- 代码规范设计，推动**全链路（编码时 Lint → Git Hooks → CI/CD）卡控方案**落地
- Review 机制的设计与推动

---

### 3.4 MT·优选·终端研发组（2020.10 ~ 2022.5）

#### ① 页面搭建系统（低代码）：工程化建设 + 人效工具（主 R，服务多个业务方向）

- **物料端脚手架 CLI**：项目模板、初始化、发布、local-server、**plugin 扩展机制**
- **CI/CD 流程建设**：发布脚本、流水线、KeyPerson 审批插件
- **物料本地可视化调试中心**：调试链路 **5 环节/1min47s → 2 环节/10s**
- **营销活动快捷创建工具**：活动数据生成 **0.5pd → 15s**

#### ② 秒开率探针 SDK（主 R）

- 测速：**有限状态机 + AOP**，拦截小程序页面生命周期与组件 setData 注入测速
- 上报：基于指标监控平台的统一性能探针

#### ③ 数据预加载方案（主 R）

通用型页面启动优化，业务请求前置到路由跳转前；**发布-订阅（事件驱动）+ 请求并发**。

#### ④ 满减凑单页性能优化

秒开率 **10% → 78%**（请求预加载 + 合并 setData + 非渲染数据迁移）。

#### ⑤ 新人导师

担任新人导师，制定成长计划、技术辅导、定期 1on1，所带新人均顺利转正。

---

### 3.5 MT·打车·终端研发组（2019.10 ~ 2020.9）

- 商运后台管理系统（Vue + ElementUI + 微前端）
- mock 工具 **mock-book**：基于 Thrift IDL 生成 mock 数据，提供可视化编辑

---

### 3.6 DFGX·技术一部·前端开发组（2017.9 ~ 2019.8）

- 政企 toB 领域，覆盖 PC 端（门户 / 管理平台）、移动端（H5 / HybridApp / 小程序）、大屏、直播监控
- 技术栈：React、MobX / Redux、Ant Design、ECharts、jQuery、Bootstrap
- **带领 5 人团队**完成景区多个信息平台的前后端开发与交付
