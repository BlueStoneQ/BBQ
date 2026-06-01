# XZ — App Tech Lead（RN + Unity）准备清单

> 核心策略：**RN 架构深度是主场，Unity 混合架构用类比讲，AI 工具是加分亮点。**

---

## ⚡ RN 复杂客户端问题速查

| 类别 | 典型问题 | 你的经验对应 |
|------|---------|-------------|
| **性能** | 列表卡顿、启动慢、内存泄漏、动画掉帧 | 秒开率 10%→78% / PSS 41→35.8MB |
| **稳定性** | Crash、ANR、白屏、JS 异常未捕获 | 探针 SDK / 全链路质量治理 |
| **跨端通信** | RN↔Native 数据丢失、类型不匹配、异步时序 | J2V8 Bridge / JSI / TurboModule |
| **状态管理** | 状态不一致、竞态条件、多页面同步 | Zustand / 弹窗治理（优先级队列） |
| **热更新** | 更新失败回滚、版本兼容、灰度策略 | XRN 热更新方案 |
| **多 Bundle** | 包拆分策略、按需加载、Bundle 间通信 | XRN 多 Bundle 架构 |
| **网络** | 弱网处理、请求重试、离线缓存、超时 | 数据预加载（发布-订阅） |
| **导航** | 深层嵌套、转场动画卡顿、状态保持 | XRN 导航路由设计 |
| **原生模块** | SDK 集成冲突、权限适配、系统版本兼容 | 快应用模块裁剪 / 一键注册 |
| **构建** | 打包慢、产物体积大、多环境配置 | 条件编译工具 / CI/CD 流程 |

> 面试挑 2-3 个有数据支撑的深入讲即可。

---

## 目录

- [核心考点速查](#核心考点速查)
- [1. 状态管理选型（Zustand vs RTK）](#1-状态管理选型zustand-vs-rtk)
- [2. 聊天系统设计](#2-聊天系统设计)
- [3. 移动端性能优化（用数据说话）](#3-移动端性能优化用数据说话)
- [4. RN + Unity 双层架构](#4-rn--unity-双层架构)
- [5. 团队管理 & Tech Lead](#5-团队管理--tech-lead)
- [📎 关联文档](#-关联文档)

---

## 核心考点速查

| JD 要求 | 你的答案来源 | 文档链接 |
|---------|------------|---------|
| RN 架构设计 | XRN 多 Bundle + DDD 模块边界 | [RN 总入口](../root/RN/README.md) |
| 状态管理 Zustand/RTK | 见下方选型分析 | [RN 2026 选型](../root/RN/rn-2026-stack.md) |
| 性能优化 + 数据 | 秒开率 10%→78% / PSS 41→35.8MB / 包体 153→60MB | [性能优化](../root/RN/performance.md) · [性能分层](../root/RN/performance-layers.md) · [秒开率优化](../../resume/explain/3.4-mt/page-performance.md) |
| 聊天系统 | 见下方设计 | — |
| RN + Unity 混合 | 类比快应用（JS 驱动 Native View） | [快应用框架](../../resume/explain/3.1-xm/quickapp-framework/quickapp-project-deep-dive.md) |
| 接口契约 | BFF GraphQL + TurboModule Spec | [BFF GraphQL](../../resume/explain/3.2-xc/bff-graphql.md) |
| Fintech | XT 金融产品（弹窗治理 + 一键注册） | [弹窗治理](../../resume/explain/3.3-xt/popup-management.md) |
| AI 工具 | Mako Agent + MCP 全链路 | [Mako 速查](../../project/AI/mako/mako-cheatsheet.md) |
| 团队管理 | 带 5 人 + 新人导师 + 质量治理 | [质量治理](../../resume/explain/3.3-xt/quality-pipeline.md) |

---

## 1. 状态管理选型（Zustand vs RTK）

**结论**：2026 年新项目选 Zustand，除非团队已有 Redux 基础设施。

| 维度 | Zustand | Redux Toolkit |
|------|---------|--------------|
| 心智模型 | 简单——一个 store 就是一个 hook | 重——slice/reducer/action/middleware |
| 样板代码 | 极少（10 行一个 store） | 多 |
| 包体积 | ~1KB | ~13KB |
| RN 性能 | 细粒度订阅，不会整棵树 re-render | 需要 selector 优化 |
| 异步 | 直接 async/await | RTK Query / createAsyncThunk |
| 适合 | 中小团队、新项目、快速迭代 | 大团队、已有 Redux 生态 |

**话术**：
> "选 Zustand。1）RN 性能更好——天然细粒度订阅；2）样板少，小团队迭代快；3）1KB 包体。如果已有 Redux 基础设施则继续用 RTK，迁移成本不值得。"

📎 [RN 2026 选型 + 状态管理](../root/RN/rn-2026-stack.md)

---

## 2. 聊天系统设计

### 架构

```
RN 客户端                          后端
├── 连接层：WebSocket 长连接        ├── 消息服务（存储+分发）
├── 消息列表：FlashList 虚拟列表    ├── 推送服务（FCM/APNs）
├── 本地缓存：SQLite/MMKV          └── 已读状态同步
├── 状态管理：Zustand store
└── 推送：FCM + 本地通知
```

### 核心设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 实时通信 | WebSocket | 聊天需要实时性，HTTP 轮询太慢 |
| 历史消息 | HTTP 分页拉取 | WebSocket 不适合大量历史数据 |
| 离线支持 | SQLite 本地持久化 | 断网时能看历史，恢复后批量发送 |
| 列表渲染 | FlashList 倒序 | 聊天记录可能很长，必须虚拟化 |
| 发送体验 | 乐观更新 | 立即显示（状态=发送中），服务端确认后更新 |
| 断线重连 | 指数退避 + 心跳保活 | 移动网络不稳定 |

### 话术

> "聊天核心是 WebSocket 长连接 + 本地持久化 + 乐观更新。连接层做断线重连和心跳；消息列表用 FlashList 虚拟化；本地 SQLite 缓存支持离线；发送时乐观更新 UI，服务端确认后同步状态。"

---

## 3. 移动端性能优化（用数据说话）

### 你有的数据

| 项目 | 指标 | 优化前 → 优化后 | 手段 |
|------|------|----------------|------|
| MT 优选 | 秒开率 | 10% → 78% | 数据预加载 + 合并 setData + 非渲染数据迁移 |
| XM 快应用 | 内存 PSS | 41MB → 35.8MB | DEX 布局优化，热代码前置减少 page fault |
| XM 快应用 | 包体 | 153MB → 60MB | 模块裁剪 + 条件编译 + 反射解耦 |
| XM 负载平台 | 上传耗时 | 121s → 42s（4.4G） | S3 MPU 分片并发 |

### RN 场景迁移

| 优化方向 | RN 手段 | 你的经验类比 |
|---------|---------|-------------|
| 启动优化 | Hermes 预编译 + 分 Bundle + 延迟初始化 | 快应用包体优化 153→60MB |
| 列表流畅度 | FlashList + memo + useCallback | 秒开率优化（合并 setData 减少渲染） |
| 内存优化 | 图片缓存策略 + 大列表回收 | PSS 优化 41→35.8MB |
| 包体优化 | Tree-shaking + 条件编译 + 按需加载 | 条件编译工具套件（开源） |
| 网络优化 | 接口聚合 + 缓存 + 预加载 | 数据预加载方案（发布-订阅） |

### 话术

> "在 MT 优选做过秒开率优化 10%→78%——数据预加载 + 合并渲染 + Worker 迁移。快应用框架做过内存优化 PSS 41→35.8MB——DEX 布局优化减少 page fault。迁移到 RN 方法论一样：启动 = 减 Bundle + 延迟初始化，流畅度 = 减 re-render + 虚拟列表，内存 = 图片回收 + 避免泄漏。"

📎 [RN 性能优化](../root/RN/performance.md) · [性能分层体系](../root/RN/performance-layers.md) · [性能分析工具](../root/RN/performance-profiling.md) · [秒开率优化](../../resume/explain/3.4-mt/page-performance.md) · [探针 SDK](../../resume/explain/3.4-mt/perf-probe-sdk.md)

---

## 4. RN + Unity 双层架构

### 集成方式

```
Unity 导出为 Gradle Module（unityLibrary）
  ├── jniLibs/libunity.so + libil2cpp.so  ← 引擎 + 游戏逻辑（C++ 编译产物）
  ├── libs/unity-classes.jar              ← Java 胶水层
  └── assets/bin/Data/                    ← 资源文件

RN 通过 Native Module 包装 UnityView 组件
  → Unity 渲染到这个 View 里
```

### 通信

```
RN (JS) ←→ Native Module (JSI/Bridge) ←→ Unity (C#)
                                            ↑
                              UnitySendMessage() / AndroidJavaClass
                              （Unity 原生支持，不需要第三方库）
```

### 类比你的经验

| XZ 的 RN + Unity | 你做过的 |
|-----------------|---------|
| RN 驱动业务，Unity 只负责渲染 | 快应用：JS 驱动业务，Native View 只负责渲染 |
| RN ↔ Unity 通信 | JS ↔ J2V8 Bridge ↔ Native（同步通信） |
| Unity 作为 RN 的一个 View | Native 组件作为 RN 的 View（requireNativeComponent） |
| 转场体验管理 | 多 Bundle 间路由跳转 + 过渡动画 |

### 话术

> "没有直接用过 Unity，但'RN + Unity 双层架构'本质和我做过的'JS + Native View'是同一类问题——业务逻辑在 JS 层，渲染在 Native/Unity 层，中间通过消息通道通信。快应用框架就是这个模式。核心挑战一样：通信效率、状态同步、转场体验。"

📎 [快应用框架 Deep Dive](../../resume/explain/3.1-xm/quickapp-framework/quickapp-project-deep-dive.md) · [J2V8 Bridge](../../resume/explain/3.1-xm/quickapp-framework/j2v8-deep.md) · [RN 通信](../root/RN/rn-native-communication.md)

---

## 5. 团队管理 & Tech Lead

### 工程标准包括哪些？

| 类别 | 具体标准 | 你做过的 |
|------|---------|---------|
| **代码规范** | ESLint 规则集、Prettier 格式化、命名约定、目录结构 | XT 代码规范设计 |
| **提交规范** | Commit message 格式（Conventional Commits）、分支策略 | XT Git Hooks 卡控 |
| **Review 机制** | CR 必须 1+ approve、checklist、KeyPerson 审批 | XT Review 机制 / MT KeyPerson 插件 |
| **CI/CD 流程** | 自动 lint → 测试 → 构建 → 灰度 → 全量 | MT CI/CD 流程建设 |
| **测试标准** | 单测覆盖率、E2E 关键路径、自动化回归 | XM 自动化测试（pytest + uiautomator2） |
| **发布规范** | 版本号规则、changelog、灰度比例、回滚 SOP | MT 发布脚本 / XRN 热更新灰度 |
| **文档标准** | README 模板、API 文档、架构决策记录（ADR） | Mako docs / 物料端文档沉淀 |
| **性能基线** | 启动 < 2s、帧率 > 55fps、包体 < 50MB、Crash-free > 99.5% | 快应用性能指标 / RN 指标体系 |

### 你的经验

| 经验 | 具体做了什么 |
|------|------------|
| 带 5 人团队 | DFGX 技术一部，带领完成多个平台交付 |
| 新人导师 | MT 优选，制定成长计划、1on1、全部转正 |
| 质量治理 | XT，推动全链路卡控（Lint → Git Hooks → CI/CD） |
| 代码审核 | XT，设计并推动 Review 机制 |
| 工程标准 | MT，CLI 脚手架 + CI/CD 流程 + 发布规范 |

### 话术

> "在 XT 做过前端架构师，推动了全链路代码质量治理——从编码时 Lint 到 Git Hooks 到 CI/CD 卡控。在 MT 带过新人，制定成长计划和 1on1 机制。在 DFGX 带 5 人团队完成多个项目交付。Tech Lead 的核心是定标准 + 做决策 + 带方向，不只是写代码。"

📎 [质量治理](../../resume/explain/3.3-xt/quality-pipeline.md) · [CLI 脚手架](../../resume/explain/3.4-mt/cli-scaffold.md)

---

## 📎 关联文档

| 主题 | 文档 |
|------|------|
| RN 知识体系 | [RN 总入口](../root/RN/README.md) |
| RN 性能优化 | [performance.md](../root/RN/performance.md) |
| RN 性能分层 | [performance-layers.md](../root/RN/performance-layers.md) |
| RN 性能工具 | [performance-profiling.md](../root/RN/performance-profiling.md) |
| RN 通信 | [rn-native-communication.md](../root/RN/rn-native-communication.md) |
| RN 2026 选型 | [rn-2026-stack.md](../root/RN/rn-2026-stack.md) |
| 快应用框架 | [quickapp-project-deep-dive.md](../../resume/explain/3.1-xm/quickapp-framework/quickapp-project-deep-dive.md) |
| 秒开率优化 | [page-performance.md](../../resume/explain/3.4-mt/page-performance.md) |
| 弹窗治理 | [popup-management.md](../../resume/explain/3.3-xt/popup-management.md) |
| Mako Agent | [mako-cheatsheet.md](../../project/AI/mako/mako-cheatsheet.md) |
