# Sentry

## Sentry 是什么？

开源的应用监控平台（SaaS 或自部署），覆盖错误追踪 + 性能监控 + 告警，一套 SDK 支持 RN / Android / iOS / H5。

## 套件组成

| 层 | 组件 | 说明 |
|---|------|------|
| **SDK（客户端采集）** | H5: `@sentry/browser` / RN: `@sentry/react-native` / Android: `sentry-android` / iOS: `sentry-cocoa` / Node.js: `@sentry/node` | 按平台选对应 SDK |
| **后端（存储+分析）** | Sentry Server | SaaS（sentry.io）或 Docker 自部署（`docker compose up`） |
| **看板（展示+告警）** | Sentry Dashboard | 自带 Web 看板：Issue 列表 / Performance / Alerts / Releases 对比 |

## 对照可观测体系：覆盖了什么？

| 观测指标 | Sentry 能覆盖？ | 怎么做 |
|---------|---------------|--------|
| Crash 率 | ✅ | SDK 自动捕获（JS / Native / Hermes） |
| ANR / Watchdog | ✅ | Android: `sentry-android` SDK 内置 ANR 检测，自动上报。iOS: SDK 间接推断 Watchdog kill（上次异常退出但无 Crash 日志 → 标记为 abnormal termination），精确卡顿堆栈需自己加主线程 Watchdog 上报 |
| JS Error 率 | ✅ | 自动捕获 + ErrorBoundary 集成 |
| 白屏率 | ⚠️ 需自定义 | 自己检测白屏后调 `Sentry.captureMessage` 上报 |
| 启动耗时 | ✅ | App Start span（SDK 自动） |
| 页面加载耗时 | ✅ | 自定义 Transaction |
| FPS / 流畅度 | ⚠️ 需自定义 | 自己采集后作为 Measurement 附加到 Transaction |
| HTTP 请求耗时 | ✅ | 自动 Instrumentation |
| 内存 / PSS | ❌ | Sentry 不采集内存指标 |
| 包体大小 | ❌ | CI 层监控，不走 Sentry |

## 不够的地方

| 缺什么 | 补什么 |
|--------|--------|
| 用户行为埋点（漏斗/留存） | Firebase Analytics / Amplitude |
| 包体 / 构建产物监控 | CI 脚本 + bundlesize |
| 内存 / PSS 监控 | Android Profiler / 自建采集 |
| 自定义业务看板 | Grafana（规模大了再做） |

## sentry 自部署?

和 GitLab 一样思路——Docker Compose 一键部署。后端是 Python（Django）+ Kafka + PostgreSQL + Redis + ClickHouse。

```bash
git clone https://github.com/getsentry/self-hosted.git
cd self-hosted
./install.sh  # 拉镜像 + 初始化
docker compose up -d
# 访问 http://localhost:9000
```

| 组件 | 技术栈 | 作用 |
|------|--------|------|
| Web + API | Python (Django) | 接收上报 + Web 看板 |
| 消息队列 | Kafka | 缓冲高并发上报 |
| 存储 | PostgreSQL + ClickHouse | 元数据 + 事件数据 |
| 缓存 | Redis | 会话/限流 |

> 30 人团队用 SaaS（sentry.io 免费版 5K events/月）更省心。自部署适合数据不能出公司网络。

## 业界实践

| 团队规模 | 常见做法 |
|---------|---------|
| 小团队（< 50 人） | Sentry SaaS / Firebase Crashlytics（免费够用，零运维） |
| 中型（50-200） | Sentry 自部署在云上 / 阿里云 ARMS / AWS CloudWatch RUM |
| 大厂 | 自建全链路（字节 Slardar / 美团 CAT / 阿里 ARMS） |

> Sentry.io 是海外服务。可以自己在阿里云/AWS 上买 ECS 跑 Docker Compose 自部署，数据不出境。
> 30 人海外产品 → Sentry SaaS 最合适。国内产品 → 阿里云 ARMS 或 Sentry 自部署。
