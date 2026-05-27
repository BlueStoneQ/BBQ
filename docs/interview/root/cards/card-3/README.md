# 牌 3：工程化体系建设

> 命中：JD1-2（基础架构与工程化）+ JD1-5（规范与协作）
>
> 定位：不是只优化一个页面，是建一套让团队持续受益的体系

---

## 文档索引

- [CI/CD Quality Gate Design](./ci-quality-gate.md)
- [Docker & K8s](./docker-k8s.md)
- [RN 工程化深度方案（多 Bundle 容器 + 热更新 + CI/CD）](./rn-engineering-deep.md)
- [架构和工程化治理](../../RN/architecture-engineering.md)
- [分 Bundle 方案](../../RN/code-splitting.md)
- [2026 技术栈 + 目录结构](../../RN/rn-2026-stack.md)
- [构建系统](../../RN/build-system.md)
- [XRN PRD](/home/mi/disk/qiaoyang/code/my-github/XRN/me-docs/PRD.md)
- [条件编译工具](../../RN/conditional-compile.md)
- [体验升级治理专项](../../RN/ux-engineering.md)
- [Theme + 国际化](../../RN/theme-i18n.md)

---

## 核心能力

```
工程化体系 = 让团队"做正确的事"变得简单

我建过的体系：
  分 Bundle → 业务独立开发/独立发布
  热更新 → 不发版修 bug
  CLI 脚手架 → 新项目 10 秒初始化
  组件体系 → 统一 UI 规范
  CI/CD → 代码质量自动卡控
  性能监控 → 退化自动告警
```

---

## 我的经验支撑

| 项目 | 做了什么 | 效果 |
|------|---------|------|
| **CRN（XC）** | 分 Bundle + 分版本热更新 + 国际化 | 业务独立发布，不互相阻塞 |
| **XRN（开源）** | 分 Bundle + 热更新 + 灰度 + CLI | 完整企业级方案 |
| **MT 优选** | CLI 脚手架 + CI/CD + 物料调试中心 | 调试链路 1min47s → 10s |
| **XT** | 全链路代码质量治理（Lint → Hooks → CI） | 规范落地 |
| **快应用 IDE** | 依赖分析引擎 + 静态检测评分 | 应用质量可度量 |

---

## 工程化体系全景

```
工程化体系
├── 构建体系
│   ├── 分 Bundle（Common + Business 分离）
│   ├── 热更新（差量下发 + 灰度 + 回滚）
│   ├── 条件编译（按平台/环境裁剪代码）
│   └── Hermes AOT（预编译 .hbc）
├── 开发体系
│   ├── CLI 脚手架（项目初始化/模板/插件机制）
│   ├── 组件体系（Design System / 通用组件 / 业务组件）
│   ├── 目录规范（features 按业务切 / DDD）
│   └── 本地开发工具（调试中心/Mock/代理）
├── 质量体系
│   ├── ESLint + Prettier（编码时）
│   ├── Git Hooks（提交时）
│   ├── CI/CD 流水线（合入时）
│   ├── Code Review 机制
│   └── 自动化测试（单元/集成/E2E）
├── 发布体系
│   ├── 多环境（dev/staging/prod）
│   ├── 灰度发布（按比例/按用户群）
│   ├── 回滚机制
│   └── 发布审批流程
└── 监控体系
    ├── 性能监控（启动/帧率/内存）
    ├── 错误监控（Crash/ANR/JS Error）
    ├── 业务监控（BLE 连接成功率/首屏时间）
    └── 退化告警（CI 卡点 + 趋势告警）
```

---

## 对 Root 的方案

### 现状（猜测）

- 单 Bundle，全量发布
- 没有热更新（每次改动都要发版）
- 没有 CLI（手动创建项目/配置）
- 代码规范靠口头约定
- 没有性能监控（出问题靠用户反馈）

### 我的规划

```
第一阶段（1-2 月）：基础设施
├── 分 Bundle 方案（Common + 业务模块分离）
├── 热更新接入（CodePush 或自建）
├── ESLint + Prettier + Husky 落地
└── 性能监控埋点（Firebase Performance + 自定义）

第二阶段（3-4 月）：效率工具
├── CLI 脚手架（新模块/新页面一键生成）
├── 组件库建设（统一 UI + 体验规范）
├── CI/CD 流水线（构建 + 测试 + 发布自动化）
└── Code Review 机制

第三阶段（持续）：体系化
├── 灰度发布体系
├── 自动化性能测试（Python + uiautomator2）
├── 退化告警（性能指标 CI 卡点）
└── 技术文档体系
```

---

## 话术

> "工程化不是一次性的事，是让团队'做正确的事'变得简单。我在 CRN 建过完整的分 Bundle + 热更新 + CLI 体系，在 MT 建过 CI/CD + 质量卡控体系。这些方法论可以直接复用——不是从零开始，是把验证过的方案适配到你们的场景。"

---


