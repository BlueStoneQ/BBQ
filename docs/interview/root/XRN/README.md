# XRN — RN 大前端工程化体系

> 开源 React Native 企业级工程化方案：分 Bundle + 热更新 + 灰度 + CLI + 内置可观测体系（开箱即用）。
>
> 代码仓库：https://github.com/BlueStoneQ/XRN

---

## 文档索引

### 核心

- [Q&A（深度问题：分 Bundle / 热更新 / Native / 性能）](./qa.md)
- [热更新子系统](./hot-update.md)
- [RN + APK 可观测体系](./observability.md)
- [RN 工程化深度方案（多 Bundle 容器 + 热更新 + CI/CD）](./rn-engineering-deep.md)
- [XRN Release Platform（自建移动端发布平台）](./xrn-release-platform.md)
- [导航与路由](./navigation-and-routing.md)

### XRN 项目文档（代码仓库内）

- [XRN Architecture](/home/mi/disk/qiaoyang/code/my-github/XRN/docs/architecture.md)
- [XRN PRD](/home/mi/disk/qiaoyang/code/my-github/XRN/me-docs/PRD.md)
- [XRN Tech Decisions](/home/mi/disk/qiaoyang/code/my-github/XRN/docs/tech-decisions.md)
- [XRN Native Shell Design](/home/mi/disk/qiaoyang/code/my-github/XRN/docs/native-shell-design.md)

### RN 通用知识（深度文档）

- [RN 总入口](../RN/README.md)
- [分 Bundle 方案](../RN/code-splitting.md)
- [构建系统（Metro + Hermes）](../RN/build-system.md)
- [架构和工程化治理](../RN/architecture-engineering.md)
- [2026 技术栈 + 目录结构](../RN/rn-2026-stack.md)
- [TurboModule Android](../RN/turbomodule-android.md)
- [iOS for RN](../RN/ios-for-rn.md)
- [性能优化分层体系](../RN/performance-layers.md)

---

## 系统全景

```
┌─────────────────────────────────────────────────────────────┐
│                      Developer Tools                         │
│  @x-rn/cli: create / build / publish / dev / status         │
└────────────────────────────┬────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
┌────────────────┐   ┌────────────┐   ┌────────────────┐
│ @x-rn/bundler  │   │   CI/CD    │   │ @x-rn/publisher│
│ Metro 多 entry │   │            │   │ 上传 + 差量    │
│ Hermes 编译    │   │            │   │ 版本管理       │
└────────────────┘   └────────────┘   └───────┬────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  @x-rn/server（热更新服务端）                  │
│  版本管理 │ 灰度策略 │ 差量计算 │ 回滚 │ 监控                │
└────────────────────────────┬────────────────────────────────┘
                             │ CDN
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  @x-rn/updater（客户端 SDK）                   │
│  检查更新 / 版本状态管理 / Bundle 加载决策 / crash 回退       │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Native Shell（Android / iOS）                    │
│  多 Bundle 加载器 │ 实例池 │ CrashGuard │ 文件管理           │
├─────────────────────────────────────────────────────────────┤
│              @x-rn/monitor（性能与异常监控）                   │
└─────────────────────────────────────────────────────────────┘
```

---
