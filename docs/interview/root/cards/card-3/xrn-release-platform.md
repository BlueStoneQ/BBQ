# XRN Release Platform（自建移动端发布平台）

> 定位：移动端的 GitLab CI —— 自部署、有 UI、基于 Fastlane、专为移动端 CD 设计。

---

## 目录

- [解决什么问题](#解决什么问题)
- [产品定位](#产品定位)
- [架构设计](#架构设计)
- [核心功能](#核心功能)
- [用户使用流程](#用户使用流程)
- [与 XRN 生态的关系](#与-xrn-生态的关系)
- [优先级](#优先级)
- [竞品对比](#竞品对比)
- [技术选型](#技术选型)

---

## 解决什么问题

现有方案的痛点：
- Bitrise — SaaS 不能自部署，贵
- Fastlane — 纯 CLI 无界面，非技术人员用不了
- Jenkins — 通用 CI，移动端配置复杂
- GitLab CI — 需要学习成本，macOS runner 贵

**XRN Release Platform** = 专为移动端、自部署、开箱即用、有 UI、Docker 一键部署。

---

## 产品定位

```
GitLab = 代码托管 + CI/CD（自部署）
XRN Release Platform = 移动端发布平台 + CD（自部署、Docker 部署）

用户：10 人以内的移动端团队
场景：产品/测试也能点按钮发版，不用找开发
```

---

## 架构设计

```
Docker Container (XRN Release Platform)
├── Frontend: React + Vite（操作 UI）
├── Backend: Node.js + Fastify
├── DB: SQLite (小) / PostgreSQL (大)
├── Queue: BullMQ (Redis) — 构建任务调度
├── WebSocket: 实时日志推送
├── Storage: 构建产物 (.ipa/.apk/.aab)
└── Agent 管理: 注册/心跳/任务分发

Agent（类似 GitLab Runner，注册到平台）
├── Mac Agent: iOS + Android 打包（Xcode + Fastlane）
└── Linux Agent: Android 打包（Gradle + Fastlane）
```

**关键限制**：iOS 打包无法 Docker 化（Apple 限制 macOS 只能跑在 Apple 硬件上），必须用 Agent 机制。

---

## 核心功能

| 功能 | 说明 |
|---|---|
| Web UI | 发版按钮、选分支/版本号/平台、实时构建日志 |
| Build Agent | Mac/Linux Agent 注册机制（一行命令注册） |
| iOS 打包 | 调 Fastlane，跑在 Mac Agent 上 |
| Android 打包 | 调 Fastlane，可在 Docker 内或 Agent 上 |
| 证书管理 | 界面化管理 iOS 证书 / Android keystore |
| 构建历史 | 构建记录、产物下载（.ipa/.apk）、日志回溯 |
| 通知 | Slack / 飞书 / 邮件 webhook |
| 热更新集成 | XRN 增量包一键推送 |
| 权限管理 | 开发/测试/产品不同角色权限 |
| 灰度发布 | 配置灰度比例，配合商店 API |

---

## 用户使用流程

```bash
# 1. 部署平台（任意 Linux 服务器）
docker-compose up -d

# 2. 浏览器打开
http://your-server:3000

# 3. 注册 Mac Agent（在 Mac Mini 上执行一行命令）
xrn-agent register --server http://your-server:3000 --token xxx

# 4. Web UI 上：关联 Git 仓库 → 配置打包参数 → 点击发版
```

---

## 与 XRN 生态的关系

```
XRN 完整生态：
  xrn-cli          → 开发/打包工具
  xrn-runtime      → 运行时框架
  xrn-bundle-mgr   → Bundle 管理平台（已有）
  xrn-release      → 发布平台（本方案）← NEW
  xrn-monitor      → 监控平台（v3 规划）
```

---

## 优先级

放在 version 0.0.8 ~ 0.0.9 阶段，和 bundle-manage-platform 一起做：
- bundle-manage-platform 管 bundle 的注册/版本/增量
- xrn-release 管 App 的打包/签名/上架

两者可以合并为一个平台的不同模块。

---

## 竞品对比

| | XRN Release | Bitrise | Fastlane | Jenkins |
|---|---|---|---|---|
| 自部署 | ✅ Docker | ❌ SaaS | ✅（纯 CLI） | ✅ |
| 移动端专用 | ✅ | ✅ | ✅ | ❌ 通用 |
| Web UI | ✅ | ✅ | ❌ 无 | ✅（丑） |
| 开箱即用 | ✅ | ✅ | ❌ 需配置 | ❌ 配置复杂 |
| 代码隐私 | ✅ 本地 | ❌ 上传云端 | ✅ | ✅ |
| 成本 | 免费 | $36+/月 | 免费 | 免费 |

---

## 技术选型

```
Platform (Docker):
  React + Vite（前端）
  Node.js + Fastify（后端）
  BullMQ + Redis（任务队列）
  SQLite / PostgreSQL（存储）
  WebSocket（实时日志）
  pm2（进程守护）

Agent (Mac Mini / Linux):
  xrn-agent CLI（注册到平台，接收任务）
  Fastlane（执行 build lane）
  Xcode / Android SDK（打包工具链）
```
