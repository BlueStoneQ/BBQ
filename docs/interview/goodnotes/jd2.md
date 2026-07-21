# GoodNotes — 跨平台前端工程师（RN 方向）

## 目录

- [拆解](#拆解)
- [原文](#原文)

---

# 拆解

## 匹配度

| JD 要求 | 匹配 | 对应经验 |
|---------|------|---------|
| RN 架构（导航/状态/模块化） | ✅✅ | XRN 多 Bundle + 统一路由 + DDD 目录 |
| TurboModule 桥接层 | ✅✅ | turbomodule-dev-guide（Android/iOS/C++） |
| 性能优化（启动/帧率/内存/包体） | ✅✅ | card-1 全覆盖 + 有数据 |
| 平台差异处理 | ✅✅ | XRN 双端 Shell + 条件编译 |
| monorepo + CI | ✅✅ | build-metro + gitlab-cicd |
| 新架构（Fabric/TurboModule） | ✅ | 系统学习 + 实践 |
| 原生 crash 排查 | ✅ | Sentry + Native 联调 |
| AI / Agentic Coding | ✅✅ | Mako Agent + 5 层上下文管理 + MCP |
| 大厂跨平台框架团队 | ✅✅ | 小米快应用框架团队 |
| Electron | ⚠️ | 有基础但非核心经验 |

## 核心叙事

这个 JD 的亮点是**AI Native + 技术深度兼备**。你的定位完美命中：
- 大前端架构深度（XRN / TurboModule / 性能）
- AI 实践深度（Mako Agent / Agentic Coding）
- 大厂跨平台框架经验（快应用 = Lynx 同类）

## 注意点

- 他们强调**算法基础**——可能会考算法题
- **Agentic Coding 实践**是硬要求——准备好讲 Mako 的具体工作流
- **实时渲染 + 同步引擎**是他们的核心业务——面试可能问 CRDT / OT 等协同算法，了解即可不用深入

## 技术挑战拆解

| 挑战 | 含义 | 技术方案 | 你的角色 |
|------|------|---------|---------|
| 实时渲染 | 手写笔画 0 延迟显示 | Canvas/Skia，走 Native 或 C++ 层 | 协作（非直接负责） |
| 多端同步 | 同一份笔记三端实时同步 | CRDT / OT + WebSocket | 协作 |
| 离线优先 | 无网正常编辑，恢复后自动合并 | 本地数据库 + 冲突解决 | 协作 |
| 跨平台一致性 | 三端渲染/交互一致 | 共享 TS 逻辑 + 各端原生渲染 | **你的核心**（架构层抹平差异） |

---

# 原文

## 关于团队

- GoodNotes 中国技术团队，负责从零构建下一代跨平台笔记体验
- GoodNotes 全球数千万用户，多次获 Apple 年度 App
- 用 React Native/React + TypeScript 重构整个客户端（iOS / Android / Web）
- 追求 Web 高效 + Native 原生体验
- 业务：实时渲染画布、同步引擎、App 架构

## 技术挑战

1. 实时渲染
2. 多端同步
3. 离线优先
4. 跨平台一致性

## 团队风格

- AI Native 团队，每个人都是 builder
- 鼓励构建个人 AI 工作流 + 分享自动化方案
- 每人每月 Agentic Coding Token 预算 ≥ 1 万 RMB，不设上限
- 提供 Claude Code / Codex / Cursor 等一线工具

## 具体工作

1. 建设 RN 应用架构：导航、状态管理、模块拆分、组件化
2. 设计和实现 Native Module / TurboModule 桥接层
3. 性能优化：启动速度、渲染帧率、内存占用、包体积（数据驱动）
4. 处理平台差异：判断 JS 层抹平 / Native 适配 / 平台原生实现
5. 维护 monorepo 构建体系和 CI 流程
6. 与文档工程师和渲染工程师协作

## 职位要求

1. 扎实的算法基础与系统设计能力
2. 前端 + React 3 年+，RN 至少 1 年（或大厂内部跨端框架如 Lynx），monorepo + 组件化经验
3. RN New Architecture（Fabric / TurboModules）实践经验
4. 能读原生代码，能主动解决 native crash
5. 关注 AI 工具链，有把 AI 融入工程的深度实践
6. 对 Agentic Coding 有强烈认同 + 深度实践

## 加分项

1. 精通 React
2. 头部大厂跨平台框架团队成员
3. 大型跨平台应用核心贡献者
4. Electron 开发 + 打包发布经验

## 技术栈

React, React Native, Electron, TypeScript