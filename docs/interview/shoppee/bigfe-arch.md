# Shopee · 金融业务全栈工程师（前端架构方向）
> https://www.zhipin.com/job_detail/5b211000b30a90f70nN60965FlBV.html?securityId=kcdCMrBkHXU3L-C12X3gNXB-bWDxxVckWU6OT35fm-QpQJNZaJ6B3NClO3TtV4RiXVfzno5H-_1KY06F2NnBtcKTQKqSKNe3517N82SH_qiIxl_F6eNy&ka=personal_interest_job_5b211000b30a90f70nN60965FlBV
## 基本信息

| 项 | 内容 |
|---|---|
| 岗位 | 金融业务全栈工程师（前端架构方向） |
| 城市 | 深圳 |
| 薪资 | 60–90K |
| 经验 | 5–10 年 |
| 学历 | 本科 |
| 福利 | 五险一金 · 补充医疗 |

---

## JD 原文

### 岗位职责
- 负责核心产品的端到端研发，参与需求分析、技术设计、开发、测试、上线与持续优化。
- 负责前端架构、性能优化、工程体系和复杂交互的设计与落地。
- 与后端、产品、设计协作，推动高质量、可维护的产品交付。
- 使用 AI coding 工具提升开发、测试、调试和技术探索效率，并对代码质量、安全性和可维护性负责。
- 持续完善开发规范、工具链和自动化流程，提升团队研发效率。

### 任职要求
- 思路清晰、逻辑严谨，善于快速理解复杂问题、抓住本质并形成有效解决方案。
- 熟悉 React Native 应用的性能优化，熟悉 Android/iOS 系统及底层原理，在前端架构、性能优化、工程化、组件体系或复杂应用开发方面有突出经验。
- 熟练掌握 React Native、Flutter 或 uniapp 等至少一种跨端方案，并对其底层通信机制与原生性能调优有深刻理解。
- 具备扎实的计算机基础和工程素养，理解数据结构、算法、操作系统、网络、数据库等基本原理。
- 具备全栈开发能力，能够独立完成从前端到 API、数据库及部署的完整功能闭环；后端技术栈不限。
- 重视代码质量、测试、可观测性、稳定性与安全性，具备良好的技术判断力。
- 善于使用 AI coding 工具进行需求拆解、代码生成、调试、测试和重构，并能够独立评审和改进 AI 生成的结果。
- 学习能力强，对技术有好奇心，愿意持续拓展全栈能力和 AI 工程能力。

---

## 需求拆解（关键词 → 我的对应）

### 1. 跨端方案 + 底层通信机制 + 原生性能调优（★ 核心命中）
JD 明确要 RN/Flutter/uniapp 至少一种，且要「底层通信机制 + 原生性能调优」的深刻理解。
- **我的强命中**：QuickApp Kit —— JS↔C++ Core 边界协议驱动、免 JSON 序列化 Bridge（External Func/Obj 直调）、Android=JNI / iOS=ObjC++ 桥接、单一权威 Runtime Tree + NodeID 增量更新（无双树 diff）。这正是「底层通信机制」+「原生性能调优」的教科书级素材。
- **RN 直接经验**：xrn-kit（RN 方向）可作为 RN 侧论据。
- 面试应答重点：把「Bridge 通信机制」讲透 —— 传统 RN Bridge 的 JSON 序列化开销 → 我的方案怎么绕过（直调 / typed message）。

### 2. React Native 性能优化 + Android/iOS 底层原理
- QuickApp Kit 三端渲染后端（Android/iOS/LVGL）已真机跑通，天然覆盖 Android/iOS 系统原理。
- 性能优化叙事：运行时压力下沉编译期（Page IR、稳定 ID 体系）、增量事务、局部更新复杂度与树规模无关。

### 3. 前端架构 / 工程化 / 组件体系
- 架构：微内核 + 插件化（开闭原则）、平台无关 C++ Core、依赖倒置可替换核心部件。
- 工程化：分 Bundle / 热更新 / CLI 脚手架 / CI/CD / 自动化测试（个人主页大前端工程化那条）。
- 条件编译套件（bsq-labs）：AOT 源码裁剪，跨端/跨平台编译端方案。

### 4. 全栈能力（前端 → API → DB → 部署，后端不限）
- 负载分析平台, 可观测体系, XRN全工程链路解决方案

### 5. AI coding 工具 + 独立评审改进 AI 产出（★ 差异化）
- **强命中**：Mako（mako-kit）—— 模型无关 AI Coding Agent 框架，ReAct + Tool Use + Trace 可观测 + 多模型 Coding Benchmark。这条直接对上「用 AI 提效 + 评审改进 AI 产出 + AI 工程能力」。
- 这是这个 JD 相比字节岗最独特的加分项，简历要把 Mako 往前放。

### 6. 计算机基础（数据结构/算法/OS/网络/DB）
- 常规八股 + 手写

### 7. 可观测性 / 稳定性 / 测试 / 安全
- Mako 的 Trace 可观测性、Benchmark 评测框架直接对上「可观测性 + 测试」。
- QuickApp Kit 的调试全链路（CDP 协议）也是可观测性论据。
- 负载平台就是可观测体系的载体

---

## 匹配度小结

| JD 要求 | 命中强度 | 主要论据 |
|---|---|---|
| 跨端底层通信 / 原生性能调优 | ★★★ | QuickApp Kit（Bridge / Core / NodeID） |
| RN 性能优化 | ★★ | xrn-kit + QuickApp Kit Android/iOS 后端 |
| 前端架构 / 工程化 / 组件体系 | ★★★ | 微内核架构 + 大前端工程化 |
| AI coding / 评审 AI 产出 | ★★★ | Mako（Agent 框架 + Benchmark + Trace） |
| 全栈闭环（API/DB/部署） | ★ | 需补强：服务端 + 部署论据 |
| 计算机基础 | ★★ | BBQ 沉淀 |
| 可观测性 / 测试 / 稳定性 | ★★ | Mako Trace + CDP 调试 |

**结论**：这个岗是「前端架构 + 跨端底层 + AI 工程」三重命中，匹配度高。相比字节嵌入式岗，这里多了「AI coding（Mako）」和「全栈闭环」两个维度 —— Mako 是强加分, 全栈闭环载体是负载分析工具。

---
