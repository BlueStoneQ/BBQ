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
