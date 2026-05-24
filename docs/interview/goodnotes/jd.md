# JD（脱敏）— GoodNotes

> 笔记/手写 App，全球数千万用户，Apple 年度 App。中国区创始团队。
> 上海·徐汇漕河泾

---

## JD1：资深前端工程师（React / React Native）

**定位**：中国技术团队核心前端，用 RN/React + TypeScript 覆盖 iOS/Android/Web 三端。连接 Web 的高效 + Native 的真正原生体验。

**核心职责**

1. **应用架构建设**：设计导航/状态管理/模块划分/组件化，为上层业务提供稳定的开发基座
2. **原生桥接层设计**：实现 Native Module / TurboModule 桥接层，连接 TS 业务逻辑与平台能力
3. **性能优化**：聚焦启动速度/渲染帧率/内存占用/包体积，用数据驱动每一次优化迭代
4. **平台差异处理**：判断哪些在 JS 层抹平、哪些走 Native 运配，确保跨平台原生实现
5. **工程化建设**：推进 monorepo 构建体系和 CI 流程，确保多端构建的稳定性和开发效率
6. **跨团队协作**：和渲染引擎团队/工程运维团队协作，确保数据层和渲染层在各平台稳定运行

**基础要求**

- 计算机基础/数据流逻辑与系统设计能力
- 3 年+ React 经验，其中至少 1 年 React Native
- 以 React 为基础的大厂内部跨端框架经验（如字节 Lynx）
- 习惯 monorepo 工作方式，有组件化经验
- 对 RN New Architecture（Fabric, TurboModules）有实践经验
- 能读原生代码，能主动解决 native crash 问题

**AI 能力（重要）**

- 关注 AI 工具发展，有把 AI 融入工程方式的深度实践（不只是用用）
- 对 Agentic Coding 有强烈认同，具备深度认知或个人实践
- 每月每人 Agentic Coding Token 预算一万元人民币起，不设上限
- 提供 Claude Code、Codex、Cursor 等一级工具

**加分项**

- 精通 React
- 大厂跨平台框架团队成员
- 大型跨平台应用核心贡献者
- 有 Electron 开发经验（做过打包发布）

---

## JD2（补充参考）：资深 Android 开发工程师 / Android 核心架构师

**定位**：连接"上层业务（RN/Kotlin）"与"底层引擎（Swift/C++）"的桥梁。主导 Android 端高性能宿主环境搭建。

**核心职责**

1. App 架构与基础设施（组件化/模块化 + RN 混合架构落地）
2. 系统级功能攻坚（SurfaceView/TextureView/Z-Order/手势冲突/折叠屏适配）
3. 核心业务研发（文件系统 SAF/PDF 处理/云同步）
4. 性能与稳定性治理（Perfetto/Systrace/Native Crash/ANR/监控体系）

**要求**

- 5 年+ Android，精通 Kotlin + Java
- MVVM/MVI，Clean Architecture，模块化重构
- SurfaceView/TextureView/Choreographer/View 绘制流程
- JNI，Java ↔ Native（C++/Rust/Swift）通信优化
- Native Crash/ANR/内存踩踏调试（LLDB/Perfetto/Systrace）

**加分**：笔迹应用、图形学（Vulkan/OpenGL/Skia）、Swift 跨平台、编译工具链

---

## 拆解

### JD1 匹配度：⭐⭐⭐⭐⭐（95%）— 几乎完美

| JD1 要求 | 对应经验 |
|---------|----------|
| RN + Native 桥接（TurboModule） | 快应用框架（J2V8 Bridge）+ CRN 实践 |
| RN New Architecture（Fabric/TurboModules） | 理解原理 + 类比快应用框架 JSI |
| 应用架构（组件化/模块化） | 低代码物料体系 + 快应用模块裁剪 |
| 性能优化 | PSS/包体/秒开率，多个有数据案例 |
| monorepo + 工程化 | CLI/CI/CD/分 Bundle/热更新 |
| 跨平台差异处理 | 快应用框架支持 Android/HarmonyOS/iOS 三端 |
| AI 融入工程实践 | MCP 全链路 + Mako Agent 框架 |
| 大厂跨端框架经验 | CRN（携程）+ 快应用框架（类 RN 自研） |
| 能读原生代码/解决 native crash | Android 原生深度（Java/C++/JNI/NDK） |

### JD2 匹配度：⭐⭐⭐⭐（70%）

强在 RN 混合 + JNI + 性能优化，弱在渲染引擎（SurfaceView/Vulkan/Skia）和 Swift 跨平台。

### 建议

**投 JD1**。这个岗位和你的能力模型高度重合，而且明确重视 AI 能力（Agentic Coding）——这是你的独特优势。

jd3

---

## JD3 拆解：跨平台架构工程师（中国技术团队）

### 团队画像

- **产品**：全球千万用户手写笔记工具，多次 Apple 年度 App
- **团队**：中国技术团队，从零构建下一代跨平台版本
- **技术栈**：React Native + React + TypeScript + Electron
- **覆盖**：iOS + Android + Web（三端）
- **核心挑战**：实时渲染画布 + 多端同步 + 离线优先 + 跨平台一致性
- **文化**：AI Native 团队，Agentic Coding，每人每月 1 万+ Token 预算无上限

### 具体工作（结构化）

| # | 职责 | 关键词 |
|---|------|--------|
| 1 | RN 应用架构（导航/状态/模块拆分/组件化） | 架构设计 |
| 2 | TurboModule 桥接层（TS ↔ Native） | 跨层通信 |
| 3 | 性能优化（启动/帧率/内存/包体，数据驱动） | 性能 |
| 4 | 平台差异处理（JS 抹平 / Native 适配 / 原生实现） | 跨平台决策 |
| 5 | monorepo 构建体系 + CI | 工程化 |
| 6 | 与渲染/文档工程师协作 | 协作 |

### 匹配度分析

| JD 要求 | 你的匹配 | 匹配度 |
|---------|---------|--------|
| React 3 年+ / RN 1 年+ | CRN + XT（RN）+ 快应用（类 RN） | ✅ 强 |
| 大厂内部跨端框架（如 Lynx） | 快应用框架（JS→Native View，同级别） | ✅ 强 |
| RN New Architecture（Fabric/TurboModule） | 系统化学习 + J2V8 类似经验 | ✅ 中强 |
| 能读原生代码/解决 native crash | 快应用 Android 原生开发 | ✅ 强 |
| monorepo + 组件化 | CRN 分 Bundle + MT CLI | ✅ 强 |
| AI 工具链深度实践 | Mako Agent 框架 + MCP 全链路 | ✅ 极强 |
| Agentic Coding 深度实践 | 自己造 Agent，不是"用过 Copilot" | ✅ 极强 |
| Electron | 快应用 IDE（VS Code 二次开发） | ✅ 强 |
| 性能优化（数据驱动） | 多个项目有数据（153MB→60MB 等） | ✅ 强 |
| 算法基础与系统设计 | 需要准备 | ⚠️ 中 |
| 实时渲染画布 | 没做过（Canvas/WebGL/Skia） | ⚠️ 弱 |
| 多端同步/离线优先 | 没直接经验（CRDT/OT） | ⚠️ 弱 |

### JD3 匹配度：⭐⭐⭐⭐⭐（85%）

**极强匹配点**：AI Native + 跨端框架 + TurboModule + 性能优化 + Electron + monorepo
**短板**：实时渲染 + 同步引擎（但 JD 说"与渲染工程师协作"，不是要你自己写渲染引擎）

### 你的独特优势（vs 其他候选人）

1. **AI Native 极强**：自己造 Agent 框架（Mako）+ MCP 全链路自动化，不是"用过 Cursor"的水平
2. **跨端框架团队成员**：快应用框架 = 大厂内部跨端框架，和字节 Lynx 同级别
3. **Electron 实战**：快应用 IDE，VS Code 二次开发 + 打包发布
4. **Native 穿透能力**：能读/写 Android 原生代码，J2V8/JNI 实战

### 需要补的

| 短板 | 怎么补 | 优先级 |
|------|--------|--------|
| 实时渲染概念 | 了解 Canvas/Skia/react-native-skia 概念 | P2（不是你的职责） |
| 多端同步 | 了解 CRDT 概念 + 离线优先架构 | P2 |
| 算法题 | LeetCode 中等难度 | P1（如果有笔试） |

### 建议

**强烈推荐投 JD3**。这个岗位几乎是为你量身定做的：
- 职责 1-5 完全匹配你的三张牌（性能 + 跨层 + 工程化）
- AI Native 文化 = 你的 Mako + MCP 实践是极大加分
- 渲染/同步是"协作"不是"你写"——你负责架构层，渲染工程师负责画布
- 技术挑战大 = 成长空间大

---

## JD3 原始文本（保留）

> **关于团队**
> 1. 我们是 Goodnotes 的中国技术团队，负责从零构建下一代跨平台笔记体验。
> 2. Goodnotes 是全球数千万用户信赖的手写笔记工具，曾多次获得 Apple 年度 App。我们负责用 React Native/React + TypeScript 重构整个客户端，覆盖 iOS、Android 和 Web —— 追求 Web 的高效和 Native 真正的原生体验，我们的业务包括实时渲染画布，同步引擎，以及支持整个 app 的架构工作。
>
> **技术挑战**
> 1. 实时渲染
> 2. 多端同步
> 3. 离线优先
> 4. 跨平台一致性
>
> **团队风格**
> 1. 我们是 AI Native 团队，每个人都是 AI 时代的 builder。这意味着：没有人觉得"这不是我的领域"——不懂的东西，和 AI 一起学；复杂的系统，和 AI 一起拆。我们鼓励每个人构建自己的 AI 工作流，分享经验技巧和自动化方案。团队的竞争力不在于谁记住了更多 API，而在于谁能更快地把想法变成可运行的代码。
> 2. 团队所有成员每人每月 Agentic Coding 所需 Token 预算一万人民币起且不设上限，提供 Claude Code、Codex、Cursor 等一线工具。
>
> **具体工作**
> 1. 建设 React Native 应用架构：导航、状态管理、模块拆分，组件化，为上层业务提供稳定的开发框架。
> 2. 设计和实现 Native Module / TurboModule 桥接层，连接 TS 侧业务逻辑与平台原生能力。
> 3. 性能优化：启动速度、渲染帧率、内存占用、包体积，用数据驱动每一次优化决策。
> 4. 处理平台差异：判断哪些该在 JS 层抹平、哪些该走 Native 适配、哪些该交给平台原生实现。
> 5. 维护 monorepo 构建体系和 CI 流程，确保多端构建的稳定性和开发效率。
> 6. 与文档工程师和渲染工程师协作，确保数据层和渲染层能在各平台上稳定运行。
>
> **职位要求：我们想找什么样的人**
> 1. 有扎实的计算机算法基础与系统设计能力。
> 2. 前端和 React 经验 3 年以上，其中至少 1 年写 React Native，或 React 为基础的大厂内部跨端框架（如字节 Lynx），习惯 monorepo 工作方式，有组件化经验。
> 3. 对 RN New Architecture（Fabric、TurboModules）有实践经验。
> 4. 能读原生代码，能主动解决 native crash 问题。
> 5. 关注 AI 工具链的发展，有把 AI 融入自己的工程方式的深度实践而不只是聊聊。
> 6. 对 Agentic Coding 有强烈认同，具备深度实践或个人探索。
>
> **如果你还有这些经验就更好**
> 1. 精通 React。
> 2. 头部大厂跨平台框架团队的团队成员。
> 3. 是大型跨平台应用的核心贡献者。
> 4. 有 Electron 开发经验，做过打包发布。
>
> **技术栈**：React, React Native, Electron, TypeScript。
