# 能力模型
## 全栈全链路交付
- 前端：React / Vue3 / Nuxt、TypeScript、Vite、ECharts
- 后端：Node.js、Koa / Express、GraphQL
- 数据与运维：MySQL 表结构设计、CI/CD、Docker、灰度发布、监控告警、日志排查
## 跨端开发与应用框架设计
- 跨端：React Native（CRN）、快应用框架（JS → Native View）、小程序
- 桌面端：Electron（VS Code 二次开发/插件）
- Android 原生：Java / C++、Gradle、NDK、V8 / J2V8、JNI、R8
- iOS：Swift / Objective-C、RN Native Shell（RCTHost + TurboModule）
- Hybrid架构：高性能 JS Bridge、定制 WebView、渲染管线、包体优化、跨端技术选型
- 设计实践：设计模式、函数式、AOP、DDD、TDD
## 大前端工程化体系建设
- 构建：Webpack、Vite、Babel、Rollup、Gradle
- 工程化：脚手架 CLI、CI/CD 流水线、发布体系、插件机制
- 跨端工程化：分 bundle、版本管理、热更新、多端构建发布
- 质量：ESLint、Git Hooks、CI/CD 全链路卡控、自动化测试
- 性能：性能探针 SDK、包体优化（R8 / 条件编译）、秒开率优化
- 可观测体系：监控上报全链路、性能/内存/稳定性监控、CrashGuard/ANR/WatchDog、白屏治理、实时告警与自动回滚
## AI Agent 开发与 AI 融入开发实践
- AI Agent 系统设计与开发：微内核架构、ReAct 循环、Tool Use、MCP 协议、Skill 系统
- 基于 MCP 打通AI研发全链路自动化：
飞书MCP（需求）→ Figma MCP（设计）→ Kiro（编码）→ DevTools MCP（验证）→ Gerrit MCP（Review）→ Jira MCP（Bug）
- 工作模式：架构师 + 产品经理综合视角 + AI 高效执行，一人 Team 级规格全栈全链路交付
# 开源项目
## QuickApp Kit (Nyrax) — 全链路多平台快应用框架解决方案
运行时: 平台无关 C++ Core基座+三端可插拔渲染后端(Android /iOS/嵌入式LVGL), 外围: 核心工具链Toolkit+统一DSL+AI引擎+生态服务平台, 现状: 嵌入式平台ESP32-S3-N16R8已跑通, IOS/Android均真机可运行rpk
- org: https://github.com/quickapp-kit
- 稳定微内核+外围扩展+可裁剪: 稳定微内核（bridge/渲染管线/事件/生命周期/Tree/事务）,外围基于contract(合约)可扩展可裁剪(可到feature/组件粒度), 分层边界clean平整，整体开闭，边界无泄漏
- 平台无关C++ Core: 核心能力下沉收敛到core, 零平台泄漏, Platform接口和Adapter机制可接入多平台(已接入LVGL/Android/IOS作为渲染后端)
- 边界协议驱动：各边界（JS↔Core / Core↔平台）统一走消息协议，非直接函数调用，解耦、易扩展,可预测, 可组合
- 单一权威Runtime Tree: Core 独占树与Layout(Yoga)，NodeID驱动, 无新旧双树全量diff, 局部更新复杂度与树规模无关
- 免JSON序列化Bridge: 基于External Func/Obj直调, 平台侧Android=JNI/iOS=ObjC++桥接/LVGL=同进程直调; 渲染管线: nodeID寻址 + 事务驱动
- 核心部件可替换:关键部件(JS引擎/布局引擎/Eventloop调度器/Agent引擎)依赖抽象接口(依赖倒置)
- 运行时压力前置编译期: 模板结构与稳定ID体系编译期固化产出(Page IR)运行时纯ID寻址增量更新,不建新树/不做全树diff
- 配套工具链(核心Toolkit)：DSL → Page IR(静态模版树静态表示) → RPK
## Mako - AI coding Agent
开源的、模型无关的 AI Coding Agent 框架。微内核 + 插件架构，内置 Agent 可观测性（Trace）和评测框架（Benchmark）。
- org: https://github.com/mako-kit
- 核心：ReAct 循环 + Tool Use + 多轮对话/上下文管理 + LLM 适配（GPT/Claude/MiMo/DeepSeek）
- 差异化：内置执行 Trace 分析 + 多模型 Coding Benchmark 对比
## XRN - React Native 企业级工程化方案
多 Bundle + 热更新+灰度发布解决方案. Android+iOS端Native容器+ CLI脚手架+构建引擎+热更新服务端+客户端 SDK
- org: https://github.com/xrn-kit
## 条件编译工具套件
面向前端主流源码类型（xml, css, js），基于AOT以特殊注释作为编译指令进行条件编译，以达到对源码内容根据不同目标平台进行精确裁剪，减少打包体积，减轻运行时压力，可用于内存或性能优化，多端复用/跨端/跨平台方案的编译端方案等。
- org: https://github.com/bsq-labs
# 项目经历
## MI 手机部·软件部·vela研发部·前端框架部（2024-4~至今）
### 1.Vela嵌入式快应用框架(js/cpp双端)
vela系统快应用框架层(IoT/穿戴), QuickJS + LVGL + LibUV(Eventloop)
- 框架核心下沉：核心能力(vNode Tree/diff/布局/渲染管线/事件/生命周期/路由)下沉C++ Core, JS 侧轻运行时+事务驱动
- 调试全链路: 前后端分离架构, 调试后端(框架侧)+调试前端(IDE侧插件)+协议驱动(实现调试协议CDP40+组), 模拟器/真机（MQTT）调试; 结构可拆卸、协议可裁剪
- JS Framework（JS 侧运行时）：响应式（Proxy状态劫持）+ 依赖标脏批量调度（Microtask Flush）+ 动态节点协调（if/for）+ 增量事务生成
- Feature/Bridge机制(platform侧能力接入体系, 系统能力向应用层开放): 横跨cpp和js两侧,基于Quickjs External obj/func机制,无json序列化跨边界通信,Feature注册和管理
### 2.移动端快应用框架（类RN跨端框架 · Android 原生）
系统级快应用运行时，JS驱动 Native View 渲染（非 WebView），V8 + J2V8 同步 Bridge（类 JSI）
- 包体优化：预装包153MB → ~60MB，dex 44.4MB → 27MB（-39%）
- 模块裁剪与降级方案：反射解耦编译依赖 + metadata 入口控制 + 自升级兜底
- 启动内存优化：DEX 布局优化，热代码前置减少 page fault（PSS MAX 41MB → 35.8MB）
- 自动化测试：Python + pytest + uiautomator2 驱动设备自动化测试
### 3.快应用 IDE（桌面端Electron应用）
为快应用开发者提供覆盖开发全链路的集成开发环境
- 基于VS Code（Electron）二次开发, 支持 macOS / Linux / Windows
- 覆盖项目创建 → 语法高亮 → 调试预览 → 构建编译(toolkit) → 打包发布
- 快应用检测评分框架: 基于自研依赖分析引擎(可扩展, 基于依赖图谱遍历器+访问器),包含静态扫描和动态监测
- 模拟器调试 / 真机调试（CDP 协议）
### 4.负载分析平台（全栈 · 从0到1独立交付）
对系统OS的负载、功耗、性能、内存、流畅度进行可视化分析的前后端到运维的全栈平台
- 分层架构：探测上报端 → 后台分析平台 → 持久化层 → 前端可视化
- 全链路独立交付：技术选型/数据库建模/后端 API/前端可视化/CI/CD/监控告警/线上问题排查
- 性能瓶颈优化：大文件上传（S3 MPU分片并发，4.4G 文件从 121s 降至 42s，提速近 3 倍）ECharts 大数据渲染（Web Worker + 降采样）
## Trip·机票事业部·机酒终端组：资深工程师（2023-5~2023-9）
携程 App-机酒频道 + 携程国际化app：trip-机酒频道（React Native + Android + IOS）
主要负责多酒店模块的开发和维护，基于CRN框架，进行业务分频道、分bundle、分版本热更新上线, 调试开发和运维监控，CICD配置和优化，BDD单测补充，BFF层graphQL聚合裁剪接口以及国际化开发相关工作。
## XT·技术部·金融产品：前端架构师（2022-12~2023-3）
### 1.XTApp（React Native + Android + IOS）
负责团队阻塞点和难点的爆破：
(1)一键注册（一键获取用户手机号,RN混合原生开发需求）	
(2)弹窗治理（弹出时机冲突和顺序混乱问题的解决，使用分层架构设计）	
UI层： props驱动型弹窗组件 + redux dispatch驱动型弹窗组件 + android动态权限申请弹窗
拦截层：HOC拦截器 + Redux middleware拦截器 + AOP拦截器
调度层：采用策略模式和优先级异步任务队列配合实现	
配置层：包括线上配置中心 + api层 + 持久化层	
### 2.工程化建设和架构工作
针对整个工程质量的治理，包括代码规范的设计，推动全链路(编码时-githooks-CICD)的卡控方案的完善，以及review机制的设计和推动落地。
## MT ·优选·终端研发组（2020-10~2022-5）
### 1.优选客户端：自提点和地址切换相关页面（220-9~2021-5） + 退款售后相关页面（2021-6~2021-10）
  主R, 需求的对接和开发，技术文档的设计，评审，提测和bugfix, 跟版上线，以及上线后异常监控和性能关注。
### 2.页面搭建系统（低代码）：工程化建设+人效工具设计开发（2021-10~2022-5）
主R, 除了开发外，还包括调研和收集问题，设计解决方案，负责的具体项目包括：
(1)物料端脚手架cli工具
背景：为了使优选多个业务方向的同学能够快速一致地接入物料开发，减少非业务的重复性建设，并规范化版本等要素，设计并提供了一个命令行脚手架工具。
行动：项目模板、物料工程和组件的初始化、物料发布、local-server, 另外该脚手架还提供了基于plugin的扩展机制，以供部分自定义需求的开发。
(1)CICD流程建设
主要是公司CICD系统的接入，发布脚本的开发(Nodejs)，发布流水线的搭建和部分发布插件定制开发（KeyPerson
审批插件：云函数），发布流程的宣讲。
(1)物料本地可视化调试中心
背景：主要是为了解决物料开发调试链路长，操作零散，自动化程度低, 以及各种工具、文档入口分散的问题。整个的人效和CICD围绕着可视化调试中心打造，配合IDE（其实是物料端cli工具中的local-server）做到一站式的调试，所见即所写，整个过程高度自动化，发布入口和相关工具均集成到调试中心。另外，调试中心和搭建端复用同一套代码，兼顾了代码安全和同步以及轻量化的设计理念。
结果：
- 本地调试用页面数据的获取，链路从5个环节缩短至2个，耗时从最快操作（熟练人员）1min30s+缩短至 10s以内
- 对于组件的config信息的修改达到了可视化，所见即所写
- 聚合了多个物料开发需要的工具、相关平台入口、资料和客服人员信息，降低了寻找各个零散工具和人员的学习成本，尤其对新开发物料的同学比较友好，天然引导，无需过度文档说明，也减轻了物料项目技术客服人员的压力
### 3.营销活动快捷创建工具
背景：在开发和测试人员对搭建的页面进行自测的时候，页面所需要的活动和展位、商品等数据的创建存在操作链路长、操作耗时、失败率高、操作点分散（涉及多个页面）的问题。
故提出并设计使用技术手段代替人工在管理页的一系列操作, 来生成测试用数据。
结果：减少开发中生成活动数据的耗时，由之前的0.5pd(实际情况)左右降低到15s以内
### 4.秒开率相关基建建设（探针sdk开发）（2021-3~2021-6）
背景：主R, 在优选小程序前期指标不完善的情况下缺乏衡量和上报手段，故需要开发属于我们自己的秒开率探针SDK。
设计实践： 
a.测速模块：利用有限状态机配合AOP的手法，对小程序的页面生命周期和组件setData进行拦截并注入测速逻辑
b.上报模块：基于指标监控平台的统一性能探针实现上报模块
### 1.数据预加载解决方案-设计开发（2022-12）
  通用型页面启动优化，业务请求前置到路由跳转前；**发布-订阅（事件驱动）+ 请求并发**。
### 1.满减凑单页：页面性能优化（2022-1）
秒开率 **10% → 78%**（请求预加载 + 合并 setData + 非渲染数据迁移）。
### 1.担任新人导师（2021-7~2022-5）
担r4w任新人导师，制定成长计划、技术辅导、定期 1on1，所带新人均顺利转正。
## MT · 美团·打车·终端研发组（2019-10~2020-9）
### 1.打车营销H5页面开发
### 2.商运后台管理系统（Vue + ElementUI + 微前端）
### 3.mock 工具 **mock-book**：基于 Thrift IDL 生成 mock 数据，提供可视化编辑
## DFIC · 东方国信·技术一部·前端开发组（2017-9~2019-8）
### 1.政企 toB 领域，覆盖 PC 端（门户 / 管理平台）、移动端（H5 / HybridApp / 小程序）、大屏、直播监控
### 2.技术栈：React、MobX / Redux、Ant Design、ECharts、jQuery、Bootstrap
### 3.带领 5 人团队完成景区多个信息平台的前后端开发与交付