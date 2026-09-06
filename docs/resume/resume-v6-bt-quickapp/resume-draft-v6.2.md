# Resume Draft v4

> 目标岗位：大前端架构 / AI Agent 开发
> 设计理念：菜单，不是说明书。留钩子，让面试官想问。
> 脱敏规则：公司名用代号（XM/XC/XT/MT/DFGX），个人信息省略
> 注：2023 年的两段短期经历（XC/XT）未写入工作经历时间线，相关技术成果已融入项目经历中
> 不是被动问答机器，不是完全迎合JD，而是充分展示自己的价值，让对方评判

> - 视角: 从双端三层((RN/H5)-(android/ios)-c++)+全链路(编译构建-运行时-CDN)角度去看待问题

---

## 目录

- [定位](#定位)
- [一、专业技能](#一专业技能)
- [二、开源项目](#二开源项目)
- [三、项目经历](#三项目经历)
  - [3.1 XM·IoT 研发部](#31-xmiot-研发部前端框架部20244--至今)
  - [3.2 XC·机票事业部](#32-xc机票事业部机酒终端组-资深工程师20235--20239)
  - [3.3 XT·技术部](#33-xt技术部金融产品-前端架构师202212--20233)
  - [3.4 MT·优选](#34-mt优选终端研发组202010--20225)
  - [3.5 MT·打车](#35-mt打车终端研发组201910--20209)
  - [3.6 DFGX·技术一部](#36-dfgx技术一部前端开发组20179--20198)

---

## 定位

10 年前端经验，大前端架构师 + AI Agent 工程。五端实战覆盖（Web / RN App / 小程序 / 桌面端 / 跨端框架层），具备从 0 到 1 的全栈平台建设能力。AI 方向：从零实现 AI Coding Agent 框架（Mako），基于 MCP 打通研发全链路自动化。

10 年大前端 / 跨端经验，专注应用平台架构与跨端 Runtime 设计。在 XM IoT 参与快应用框架建设，覆盖联盟 Android 快应用（hapjs）Runtime、嵌入式快应用（Vela）的 feature/bridge 机制与调试后端（CDP）、以及配套 IDE 工具链，同时横跨三层：js层/CPP层/platform层（Android/IOS）。具备应用模型、运行时、能力开放、插件机制、多端适配、工具链的全链路架构能力。同时独立主导设计并落地开源跨端快应用引擎 QuickApp Kit——平台无关 C++ Core，Android / iOS / 嵌入式 LVGL 三端接入同一 Core 并跑通快应用。

---

## 一、专业技能

### 1. 全栈全链路交付

- 前端：React / Vue3 / Nuxt、TypeScript、Vite、ECharts
- 后端：Node.js、Koa / Express、GraphQL
- 数据与运维：MySQL 表结构设计、CI/CD、Docker、灰度发布、监控告警、日志排查

### 2. 跨端开发与应用框架设计

- 跨端：React Native（CRN）、快应用框架（JS → Native View）、Flutter动态渲染框架、小程序
- RN 多 Bundle 容器：多实例管理 + 统一路由 + 热更新灰度
- 桌面端：Electron（VS Code 二次开发 / 插件）
- Android 原生：Kotlin / C++、Gradle、NDK、V8 / J2V8、JNI、R8
- iOS：Swift / Objective-C、RN Native Shell（RCTHost + TurboModule）、Flutter 渲染端
- Hybrid 架构：高性能 JS Bridge、定制 WebView、动态渲染引擎、包体优化、跨端技术选型
- 设计实践：设计模式、函数式、AOP、DDD、TDD

### 3. 大前端工程化体系建设

- 构建：Webpack、Vite、Babel、Rollup、Gradle
- 工程化：脚手架 CLI、CI/CD 流水线、发布体系、插件机制、依赖分析引擎（遍历者+访问者模式）
- 质量：ESLint、Git Hooks、CI/CD 全链路卡控、自动化测试
- 性能：性能探针 SDK、包体优化（R8 / 条件编译）、秒开率优化
- 可观测体系：监控上报全链路、性能/内存/稳定性监控、CrashGuard/ANR/WatchDog、白屏治理、实时告警与自动回滚

### 4. AI Agent 开发与 AI 融入开发实践
- AI Agent 系统设计与开发：微内核架构、ReAct 循环、Tool Use、MCP 协议、Skill 系统
- 基于 MCP 打通研发全链路自动化：飞书MCP（需求）→ Figma MCP（设计）→ Kiro（编码）→ DevTools MCP（验证）→ Gerrit MCP（Review）→ Jira MCP（Bug）
- 工作模式：架构师 + 产品经理综合视角 + AI 高效执行，一人 Team 级规格全栈全链路交付

---

## 二、开源项目

### QuickApp Kit (Nyrax) — 跨端快应用全链路引擎

多平台全链路快应用框架平台解决方案: runtime: js runtime + 平台无关 C++ Core + 三端渲染后端（Android / iOS / 嵌入式 LVGL）+ Benchmark + 核心工具链Toolkit，三端接入同一Core且跑通 RPK。
- org仓库地址: https://github.com/quickapp-kit, 嵌入式平台ESP32-S3-N16R8已跑通验证通过, IOS/Android均真机可运行
- 微内核+外围扩展: 稳定微内核（bridge/渲染管线/事件/生命周期/Tree/事务）,外围基于contract可扩展可裁剪(可到feature/组件粒度), 分层边界clean平整，开闭，边界无泄漏
- 平台无关C++ Core：核心能力下沉收敛到core, 零平台泄漏, Platform接口 和 Adapter机制可接入多平台(已接入LVGL/Android/IOS作为渲染后端)
- 边界协议驱动：各边界（JS↔Core / Core↔平台）统一走消息协议，非直接函数调用，解耦、易扩展,可预测, 可组合
```
边界协议驱动：Core 各边界（Platform / JS）统一为协议驱动的 typed 消息 → EnqueueResult，clean、可预测、可组合
```
- 唯一权威 Runtime Tree：Core 独占树与Layout(Yoga)，NodeID驱动, 无新旧双树全量diff, 局部更新复杂度与树规模无关
- 免JSON序列化bridge: 基于external function直调, 平台侧 Android=JNI/iOS=ObjC++ 桥接/LVGL=同进程直调; 渲染管线: nodeID寻址 + 事务驱动
- 核心部件可替换：关键部件(JS引擎/布局引擎/Eventloop调度器/Agent引擎)依赖抽象接口(依赖倒置)
```
  - me: Core 不直接依赖 QuickJS/Yoga 等具体实现，而是定义 JsEnginePort 这类抽象接口，Core 只依赖接口、具体实现反过来实现接口——依赖方向从"Core→实现"倒转成"实现→接口←Core"。
  - 让"稳定的核心"不依赖"易变的细节"，两者都依赖"不变的抽象"——依赖箭头指向抽象，而非指向具体
  - 依赖注入（DI）的本质（第一性，一句话）
  - 一个对象不自己创建它依赖的东西，而是由外部把依赖"递"进来——把"用什么"和"谁来给"分开。
  - 目前只有JS引擎实现, 其他的时间原因,还没有调整, 但我一般设计,都会对核心部件采用这种依赖倒置的设计
  - 依赖注入：那"到底用哪个实现"谁决定？不由 Core 决定，由外部（Provider/组合根）在启动时注入进来。
  - 结果：换 JS 引擎 = 换一个 Provider，Core 一行不改。"
  - 可拆卸"和"可裁剪"是两个不同层面，方案不同
1. 可拆卸（运行期/组装期解耦）——通常用抽象接口
"拆卸"= 模块之间不硬依赖，能装能不装。C++ 常见方案：

纯虚接口（抽象基类）+ 依赖注入：调试模块实现一个 DebuggerPort 接口，框架只依赖接口。不装调试就注入一个空实现（Null Object）或干脆不注入。这是"可拆卸"的主力方案——你说的虚函数就是这个。
Provider/工厂在组合根决定装不装：组合期（Composition Root）决定要不要把调试模块 new 出来注入进去。
所以"可拆卸"= 抽象接口（虚函数）+ 组合期注入 —— 你的直觉对。

2. 可裁剪（编译期，不进产物）——通常用编译期手段
"裁剪"= 不需要的代码根本不编译进二进制（嵌入式省 flash/RAM）。C++ 常见方案：

条件编译（#ifdef QUICKAPP_ENABLE_DEBUG）：最直接，你说的对。不开这个宏，调试代码不进产物。
CMake 层面不链接：更干净的做法——调试做成独立 lib/target，CMake option 决定要不要 target_link。未选的模块编译单元根本不参与链接。这比 #ifdef 满地撒更 clean（符合你的风格）。
编译期 Composition Root：把"选哪些模块"集中在一处编译期开关，而不是代码里到处 #ifdef。
所以"协议级裁剪"= 条件编译 / CMake target 选择 / 编译期组合根 —— 条件编译是其中一种，但CMake target 级裁剪更 clean。
```
- 核心工具链Toolkit：DSL → Page IR → RPK 编译 / inspect / run + 内置Benchmark可观测体系
- 编译期静态依赖 + 轻运行时：依赖编译期静态算好，运行时只匹配触发，非 Vue 式运行时收集
```
这套 framework 的设计——共享 runtime + 编译期生成数据 + 编译期静态依赖——其实是Svelte 式的"编译期做重活、运行时轻量"思路，比 Vue/React 的运行时方案更适合嵌入式。这是个很能体现架构判断的点：你不是照抄 Vue 的运行时响应式，而是为嵌入式选了"编译期静态依赖 + 轻运行时"的路线。面试讲这个，直接体现"为场景做架构选择"的判断力。
```


### Mako  — AI Coding Agent 框架

模型无关的 AI Coding Agent 框架。微内核 + 插件架构，内置 Trace 可观测性和 Benchmark 评测。
- https://github.com/BlueStoneQ/mako

### XRN — React Native 企业级工程化方案

多 Bundle + 热更新 + 灰度发布解决方案。Android + iOS 双端 Native 容器+ CLI 脚手架 + 构建引擎 + 热更新服务端 + 客户端 SDK。
- https://github.com/BlueStoneQ/XRN

### 条件编译工具套件
面向 xml / css / js 的 AOT 条件编译，注释指令按目标平台裁剪源码，用于包体优化与跨端复用，均已发布 npm。
- https://github.com/bsq-labs

---

## 三、项目经历

### 3.1 XM·IoT 研发部·前端框架部（2024.4 ~ 至今）

#### 嵌入式快应用框架（Vela(RTOS) · JS↔C++ 双端）

vela系统快应用框架层（IoT / 穿戴），QuickJS + LVGL + (LibUV)Eventloop。

- 框架核心下沉：核心能力（Runtime Tree/布局/渲染管线/事件/生命周期 / 路由）下沉 C++ Core，JS 侧轻运行时 + 事务驱动
- 调试全链路: 前后端分离架构, 调试后端(框架侧)+调试前端(IDE侧插件)+协议驱动(实现调试协议CDP40+组), 模拟器 / 真机（MQTT）调试; 结构可拆卸、协议可裁剪
```
  - me注解: 1 调试全链路：实现 CDP 协议 40+ 组；调试后端(框架侧)+调试前端(IDE 插件)
  - me注解: 重构：clean化 和实现解耦？用到了什么手法
```
- JS Framework（JS 侧运行时）：响应式（Proxy 状态劫持）+ 依赖标脏批量调度（Microtask Flush）+ 动态节点协调（if/for）+ 增量事务生成
```
- JS Framework（JS 侧运行时）：响应式（Proxy 状态劫持）+ Binding 批量调度 + 增量事务生成
```
- feature / bridge 机制(platform侧能力接入体系, 系统能力向应用层开放): 横跨cpp和js两侧,基于quickjs external obj/func机制,无json序列化跨边界通信,feature注册和管理 
```
  - me注解: 叙事: 团队就是只有我往多端js cpp去做
  - me注解: feature/bridge系统：横跨cpp和js两侧,基于quickjs external obj/func机制,无json序列化跨边界通信,feature注册和管理 
```

####  移动端快应用框架（类 RN 跨端框架· Android 原生）

系统级快应用运行时，JS 驱动 Native View 渲染（非 WebView），V8 + J2V8 同步 Bridge（类 JSI）。

- 包体优化：预装包 153MB → ~60MB，DEX 44.4MB → 27MB（-39%）
- 模块裁剪与降级方案：反射解耦编译依赖 + metadata 入口控制 + 自升级兜底
- 启动内存优化：DEX 布局优化，热代码前置减少 page fault（PSS MAX 41MB → 35.8MB）
- 自动化测试：Python + pytest + uiautomator2 驱动设备自动化，覆盖启动 / 滑动 / 点击等场景

####  快应用 IDE 与工具链（Toolkit · IDE · 调试 · 应用分析）

为快应用开发者提供覆盖**开发全链路**的集成开发环境。

- 基于 VS Code（Electron）二次开发，支持 macOS / Linux / Windows
- 覆盖项目创建 → 语法高亮 → 调试预览 → 构建编译 → 打包发布全链路
- Toolkit（编译构建）：DSL 源码 → 编译打包 → RPK 产物
- 快应用**检测评分**框架: 基于自研**依赖分析引擎**(可扩展, 基于依赖图谱遍历器+访问器),包含静态扫描和动态监测
- 调试插件: 模拟器调试 / 真机调试（CDP 协议）

####  负载性能分析平台（全栈 · 从 0 到 1 独立交付）

对设备/芯片/OS的负载、功耗、性能、流畅度进行可视化分析。

- 架构：探测上报端 → 后台分析平台 → 持久化层 → 前端可视化
- 全链路独立交付：技术选型 · 数据库建模 · 后端 API · 前端可视化 · CI/CD · 监控告警 · 线上问题排查
- 性能瓶颈优化：大文件上传（**S3 MPU 分片并发**，4.4G 文件从 121s 降至 42s，**提速近 3 倍**）、ECharts 大数据渲染（Web Worker + 降采样）


**B. ~~Flutter 动态卡片渲染框架**（跨平台 · C++ 引擎层）~~[不要]

将快应用卡片能力从仅 Android 扩展到全平台（Android / iOS / IoT / 车机），C++ 统一引擎层 + Dart FFI 桥接。

- **渲染链路**：JSON 协议驱动 → DOM 树 → Flexbox 布局 → Flutter Widget 渲染，天然覆盖 iOS
- **引擎核心**：C++ 实现平台无关的 W3C DOM 子集 + CSS 层叠 + 布局计算，通过 Dart FFI 输出 FrameUpdate 给 Flutter 渲染
- **卡片交互**：事件系统（捕获/冒泡）+ 手势识别
- **增量更新**：TreeMutation + NodePatch 增量同步机制，避免全量重建 Widget 树

---

### 3.2 XC·机票事业部·机酒终端组: 资深工程师（2023.5 ~ 2023.9）

#### ① XC App 机酒频道 + 国际化 App（React Native + IOS + Android）

- CRN 框架（RN 企业级定制）工程化实践
- 业务分频道、**多 Bundle、分版本热更新**上线
- BFF 层 GraphQL 聚合裁剪接口
- 国际化开发

---

### 3.3 XT·技术部·金融产品: 前端架构师（2022.12 ~ 2023.3）

#### ① XT App（React Native + Android + IOS） — 团队阻塞点与难点爆破

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
- 技术栈：React、MobX / Redux、Ant Design、ECharts、jQuery、Bootstrap, js-bridge开发
- **带领 5 人团队**完成景区多个信息平台的前后端开发与交付
