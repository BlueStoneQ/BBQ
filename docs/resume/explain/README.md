# Resume Explain（冰山下的说明书）

> resume 是菜单，explain 是说明书。结构与 resume-draft-v2 一致，方便按结构查阅。
> 大专题拆到同级子目录，这里做索引和链接。

---

## 目录

- [一、专业技能](#一专业技能)
- [二、开源项目](#二开源项目)
- [三、项目经历](#三项目经历)
  - [3.1 XM·IoT 研发部·前端框架部](#31-xmiot-研发部前端框架部)
  - [3.2 XC·机票事业部](#32-xc机票事业部)
  - [3.3 XT·技术部·金融产品](#33-xt技术部金融产品)
  - [3.4 MT·优选·终端研发组](#34-mt优选终端研发组)
  - [3.5 MT·打车·终端研发组](#35-mt打车终端研发组)
  - [3.6 DFGX·技术一部](#36-dfgx技术一部)

---

## 一、专业技能

（待补充：各技能点的深度解释、trade-off、适用场景）

---

## 二、开源项目

（待补充：条件编译工具套件的设计原理、AST 操作、Babel/PostCSS 插件机制）

---

## 三、项目经历

### 3.1 XM·IoT 研发部·前端框架部

#### ① 负载性能分析平台

> 📂 大专题拆分：[./3.1-xm/performance-platform/](./3.1-xm/performance-platform/)

- [大文件上传优化（MPU）](./3.1-xm/performance-platform/mpu-upload.md)
- [ECharts 大数据渲染优化](./3.1-xm/performance-platform/echarts-optimization.md)
- [BFF 架构设计](./3.1-xm/performance-platform/bff-architecture.md)
- [CI/CD 与部署](./3.1-xm/performance-platform/cicd-deployment.md)

#### ② 快应用框架

> 📂 大专题拆分：[./3.1-xm/quickapp-framework/](./3.1-xm/quickapp-framework/)

- [三线程模型](./3.1-xm/quickapp-framework/thread-model.md)
- [J2V8 同步 Bridge（类 JSI）](./3.1-xm/quickapp-framework/j2v8-bridge.md)
- [包体优化方案](./3.1-xm/quickapp-framework/bundle-size-optimization.md)
- [内存优化（PSS）](./3.1-xm/quickapp-framework/memory-optimization.md)
- [模块裁剪与降级](./3.1-xm/quickapp-framework/module-trimming.md)
- [consumerProguardFiles 排查](./3.1-xm/quickapp-framework/consumer-proguard-issue.md)
- [条件编译 vs 插件化 vs 动态加载](./3.1-xm/quickapp-framework/conditional-compile-vs-plugin.md)
- [自动化测试](./3.1-xm/quickapp-framework/automation-testing.md)
- [CI/CD + ROM 出包 + 刷机](./3.1-xm/quickapp-framework/cicd-rom.md)

#### ③ 快应用 IDE

> 📂 大专题拆分：[./3.1-xm/quickapp-ide/](./3.1-xm/quickapp-ide/)

- [为什么二开 VS Code](./3.1-xm/quickapp-ide/why-fork-vscode.md)
- [Electron 架构](./3.1-xm/quickapp-ide/electron-architecture.md)
- [依赖分析引擎](./3.1-xm/quickapp-ide/dependency-analysis.md)

---

### 3.2 XC·机票事业部

#### ① XC App 机酒频道（React Native）

- [CRN 是什么？和标准 RN 的区别](./3.2-xc/crn-vs-rn.md)
- [BFF + GraphQL 聚合裁剪](./3.2-xc/bff-graphql.md)
- [分 bundle / 热更新 / 版本管理](./3.2-xc/bundle-hotupdate.md)

---

### 3.3 XT·技术部·金融产品

#### ① XT App（React Native）

- [弹窗治理系统（四层架构）](./3.3-xt/popup-management.md)
- [一键注册 RN 混合原生](./3.3-xt/one-click-register.md)
- [反射 vs 注解处理器 trade-off](./3.3-xt/reflection-vs-annotation.md)

#### ② 全链路代码质量治理

- [全链路卡控方案](./3.3-xt/quality-pipeline.md)

---

### 3.4 MT·优选·终端研发组

#### ① 页面搭建系统（低代码）

- [项目背景与口述话术](./3.4-mt/low-code-background.md)
- [物料端脚手架 CLI](./3.4-mt/cli-scaffold.md)
- [物料本地可视化调试中心](./3.4-mt/debug-center.md)
- [CI/CD 流程建设](./3.4-mt/cicd.md)

#### ② 秒开率探针 SDK

- [探针 SDK 设计（有限状态机 + AOP）](./3.4-mt/perf-probe-sdk.md)

#### ③ 数据预加载方案

- [预加载架构（发布-订阅 + 并发）](./3.4-mt/prefetcher.md)

#### ④ 满减凑单页性能优化

- [秒开率 10% → 78% 的优化手段](./3.4-mt/page-performance.md)

---

### 3.5 MT·打车·终端研发组

- [微前端方案](./3.5-mt/micro-frontend.md)
- [mock-book 工具](./3.5-mt/mock-book.md)

---

### 3.6 DFGX·技术一部

（内容较少，暂不拆分）

---

## 通用专题

- [CI/CD 流水线全链路卡控](./common/cicd-pipeline.md)
- [R8 混淆与内存优化](./common/r8-memory.md)
- [设计稿还原自动化链路](./common/design-to-code.md)
