# Resume Draft v5 - Flutter 大前端

## 目录

- [基本信息](#基本信息)
- [工作经历](#工作经历)
- [能力模型](#能力模型)
- [开源项目](#开源项目)
- [项目经历](#项目经历)
- [获奖经历](#获奖经历)
- [自我评价](#自我评价)

---

- [LN JD](../../interview/LN/jd.md) 
- [LN README](../../interview/LN/README.md)
- AI 打底, 最终要人去改, 改出真人感, 避免过于强的AI感,容易觉得不真实
```md
这个提醒很重要。AI根据项目整理的简历有几个典型痕迹需要你手动改掉：

过于工整的并列结构 — 每一条都是"动词 + 结果 + 数据"，真人不会每条都这么标准
术语堆砌太密 — 一句话里塞 4-5 个技术名词，读起来像关键词 SEO
所有项目都有量化数据 — 真实情况是有的项目你记得数据，有的不记得
语气过于统一 — 真人写简历会有些地方写得详细、有些地方随意点
最终你过一遍的时候注意：

有些条目可以不加数据，留白反而真实
语句长短参差一些
个别地方用口语化表达（"主要做了xxx"而不是每条都"负责xxx的设计与落地"）
这个 markdown 版本先把内容对齐
```

---

## 基本信息

- 姓名：xxx
- 应聘岗位：前端开发/大前端架构
- 工作经验：10 年
- 毕业院校：xxx大学
- 毕业时间：2016
- 籍贯：xxx
- 联系电话：135xxxxxxxx
- 邮箱：xxxxxxx@qq.com
- GitHub：https://github.com/xxxx
- Blog：https://juejin.cn/user/xxxx/posts

---

## 工作经历

- MI科技有限公司 · 高级软件工程师（大前端方向）（2024-4~至今）
- XC旅行网 · 资深前端工程师（2022-12~2023-9）[组织架构调整,换leader,离职了]
- 北京三快科技有限公司（MT）· 大前端开发/新人导师（2019-10~2022-5）
- DFGX科技股份有限公司 · 前端开发（2017-9~2019-8）
- RTDL科技有限公司 · 前端开发（2016-7~2017-5）

---

## 能力模型

### 跨端开发与框架设计
- Flutter：Dart/Widget、Skia渲染管线、Riverpod、Platform Channel/FFI、混合栈、引擎预热
- Android 原生：Kotlin/Java、Gradle、NDK/JNI、Native Shell容器设计
- iOS 原生：Swift/OC、CocoaPods、XCFramework、混编桥接、容器生命周期管理
- C++：跨平台渲染框架、Yoga布局引擎、QuickJS/V8嵌入、跨层Bridge设计（FFI/JNI/J2V8）、SO/dylib编译、LVGL渲染
- 桌面端：Flutter Desktop / Electron, 快应用配套IDE设计开发
- 动态渲染框架(Server-Driven UI): JSON/XML协议驱动动态渲染、diff增量渲染、事件交互

### 大前端工程化体系建设
- 可观测体系与治理: 稳定性(白屏/crash率/ANR)、性能体验(秒开/流畅度)、内存、包体、人效/质量
- 构建：Gradle、Xcodebuild、CMake、Vite / Webpack
- 工程化：脚手架 CLI、CI/CD 流水线、发布体系、插件机制、组件设计
- 质量：ESLint、Git Hooks、CI/CD 全链路卡控、自动化测试
- 性能：性能探针 SDK、包体优化（R8 / 条件编译）、秒开率优化

### web全栈全链路交付
- 前端：React / Vue3 / Nuxt(SSR)、TypeScript、Vite、ECharts
- 后端：NodeJs、Koa / Express、GraphQL、BFF
- 数据与运维：MySQL 表结构设计、CI/CD、Docker、灰度发布、监控告警、日志排查

### AI Agent 开发与 AI 融入开发实践
- AI Agent 系统设计与开发：微内核架构、ReAct 循环、Tool Use、MCP 协议、Skill 系统
- 基于 MCP 打通 AI 研发全链路自动化：飞书MCP（需求）→ Figma MCP（设计）→ Kiro（编码）→ DevTools MCP（验证）→ Gerrit MCP（Review）→ Jira MCP（Bug）
- 工作模式：架构师 + 产品经理综合视角 + AI 高效执行，一人 Team 级规格全栈全链路交付

---

## 开源项目

### Mako — AI Coding Agent
开源的、模型无关的 AI Coding Agent 框架。微内核 + 插件架构
- GitHub: https://github.com/xxxx/mako
- 核心：ReAct 循环 + Tool Use + 多轮对话/上下文管理(五层管道) + LLM 适配（GPT/Claude/MiMo/DeepSeek）
- 差异化：内置 Agent 可观测性（Trace）和多模型评测框架（Benchmark）

### 条件编译工具套件
面向前端主流源码类型（xml, css, js），基于 AOT 以特殊注释作为编译指令进行条件编译，对源码内容根据不同目标平台进行精确裁剪。[TODO: 后续建一个单独仓库,这里合并成一个链接,一个小项目,占据的行数太多]
1. 面向 js：https://www.npmjs.com/package/babel-plugin-conditional-compile-with-comment
2. 面向 css：https://www.npmjs.com/package/postcss-plugin-conditional-compile
3. 面向 xml：https://www.npmjs.com/package/xml-conditional-compile

---

## 项目经历

### MI·手机部·软件部·vela 研发部·前端框架部（2024-4~至今）

#### ① 动态渲染卡片框架（C++ · Flutter）
```
带队, 3人(Android*1+C++*1+前端*1)+2外包(Android*1+前端*1), 主R+架构)
```

跨平台动态渲染引擎，JSON/XML 协议驱动 Server-Driven UI，渲染端采用flutter。

- 分层架构: — 应用层(卡片 DSL) → 运行时层(模板解析 + 响应式) → 引擎核心层(C++ DOM + CSS + Yoga Layout) → 渲染后端层(Flutter/Android)
- 渲染管线：DOM Diff → Layout → RenderTree → 渲染后端（Flutter/LVGL/Android）
- 跨层通信：Dart FFI 直调 C++ .so / Platform Channel 桥接 Native / JNI·OC++ 调用引擎层
- 三种卡片模式：**JS 卡**（QuickJS 运行时）+ **轻卡**（XML/JSON 数据驱动）+ **IoT设备卡**（手表等智能硬件受限环境，纯 C++ + LVGL 渲染）
- 落地场景：手机桌面卡片、**小爱同学AI动态渲染**、负一屏信息流card
- 可观测体系: 框架内置观测指标采集（启动耗时/渲染流畅度/内存水位）

#### ② 快应用框架（类 RN 跨端框架 · Android 原生）
系统级快应用运行时，类Vue DSL(JS)驱动 Native View 渲染（非 WebView），V8 + J2V8 同步 Bridge（类 JSI）。     
- 包体优化：预装包 153MB → ~60MB，dex 44.4MB → 27MB（-39%）
- 模块裁剪与降级方案：反射解耦编译依赖 + metadata 入口控制 + 自升级兜底
- 启动内存优化：DEX 布局优化，热代码前置减少 page fault（PSS MAX 41MB → 35.8MB）
- 自动化测试：Python + pytest + uiautomator2 驱动设备自动化测试

#### ③ 快应用 IDE（桌面端 Electron 应用）
快应用配套工具链, 覆盖开发全链路的集成开发环境。
- 基于 vsCode（Electron）二次开发，支持 MacOS / Linux / Windows
- 覆盖项目创建 → 调试预览 → 构建编译 → 打包发布
- 基于依赖分析引擎的应用静态检测评分工具
- 模拟器调试 / 真机调试（CDP 协议）

#### ① 负载分析平台（web全栈 · 从 0 到 1 独立交付）
对系统 OS 的负载、功耗、性能、流畅度进行可视化分析的前后端到运维的全栈平台。
- 架构：探测上报端 → 后台分析平台 → 持久化层 → 前端可视化
- 全链路独立交付：技术选型 · 数据库建模 · 后端 API · 前端可视化 · CI/CD · 监控告警(可观测) · 线上问题排查
- 性能瓶颈优化：大文件上传（S3 MPU 分片并发，4.4G 文件从 121s 降至 42s，提速近 3 倍）、ECharts 大数据渲染（Web Worker + 降采样）

---

### XC·机票事业部·机酒终端组：资深工程师（2022-12~2023-9）
```
不要只说 Flutter：大厂都是混合架构，你要理解为什么在不同场景选不同技术
```

#### ① Trip国际化 App（Flutter + Android + iOS）
基于XC Flutter混合框架，负责机酒模块业务开发
- 业务分模块、Flutter产物化独立集成（AAR/Framework）、跟版发布上线
- 封装业务级(用户信息获取) Platform Channel Plugin（Dart + Android/iOS 双端实现）
- BFF 层 GraphQL 聚合裁剪接口
- 国际化开发（多语言 + RTL 适配）

---

### MT·优选·终端研发组（2020-10~2022-5）

#### ① 优选独立App（Flutter + Android + iOS）
主R, 门店/售后等业务模块全链路（需求→开发→联调→上线→监控优化），混合栈路由管理

#### ② 秒开率探针SDK（Flutter + Android + iOS）
```
秒开率本身就是全链路指标的一种 — "秒开率"是一个业务结果指标（1 秒内完成页面可交互的比例），而要测它，必须采集全链路各节点的耗时。

所以两者不矛盾：

核心指标：秒开率（TTI < 1s 的占比）
实现方式：全链路各节点打点（Native 启动 → Engine attach → 首帧 → 数据返回 → 可交互）
产出：既能算秒开率，也能看到每个环节的耗时分布（定位瓶颈）
标题叫"秒开率探针"就行 — 面试追问时你再展开说"其实采集的是全链路各节点，秒开率只是最终聚合出来的一个数"。
```
- 测速：traceID串联全链路采集: Native启动 → Engine attach → 首帧 → TTI
- 上报：通过Platform Channel透传至Native层，统一埋点SDK上报

#### ④ 启动与页面秒开优化方案（Flutter + Android + iOS）[这个也是flutter环境]
应用启动和页面加载速率优化:
- ① 预请求: Native 层多线程预请求前置到 Splash 阶段，Flutter 页面就绪后直接消费缓存数据 
- ② 预加载: Flutter容器池化预热 + SO预加载前置，减少首页渲染等待

#### ⑥ 新人导师[保留, 因为他们还有个leader岗, 我希望体现出专家+leader]
制定成长计划、技术辅导、定期 1on1，所带新人均顺利转正

---

### MT·打车·终端研发组（2019-10~2020-9）[del: 部分页面flutter + Android + IOS]
- 参与集团 MTFlutter试点接入，负责司机端部分低频业务页面Flutter化
- 代码规范设计，推动全链路（编码时 Lint → Git Hooks → CI/CD）卡控方案落地
- Flutter 产物化集成：CD打包为 AAR/Framework集成构建

---

### DFGX·技术一部·前端开发组（2017-9~2019-8）(主要是做hybrid APP+ shell层建设: 高性能js-bridge + wenbview定制)
- Hybrid App：参与JS-Bridge（Android/iOS 双端）+ WebView 容器定制
- 带领 5 人团队，主导 Hybrid App（Android/iOS）+ H5开发与交付

---

## 获奖经历
- 西安邮电大学校三等奖学金（2013）
- 第十一届西安高新"挑战杯"大学生科技作品竞赛校赛二等奖（2015.03）

---

## 自我评价
- 重视项目全链路可观测体系建设, 重视从容器层和开发链路多角度治理性能和效率质量问题
- 关注项目复杂度治理, 推崇并遵循 less is more 或者奥卡姆剃刀原则，重视代码解耦及扩展性
- 编写代码重视防御/鲁棒和可读性、可维护性、可扩展性，有一定的代码洁癖
- 对技术有热情，爱读书，持续学习
- 知识体系较为系统，持续走向全栈、AI Agent 和大前端架构之路，致力于多端开发和提高人效的 AI 工具/平台/系统
- 有一定的产品 sense 和设计能力，喜欢挖掘和解决问题
- 大前端推崇Add-To-App架构
