# Node.js 可观测体系

> 解决什么问题：Node 服务上线后，如何知道它"跑得好不好"？
>
> 本质：可观测 = Metrics（数值指标） + Logs（日志） + Traces（链路追踪）。
>
> 第一性原理：不可观测的系统 = 盲人开车。每一个上线的服务，都必须回答"快不快、稳不稳、有没有问题"。

---

## 目录

- [核心指标速记（3 个就够）](#核心指标速记)
- [全量指标详解](#全量指标详解)
  - [可用性](#可用性)
  - [性能](#性能)
  - [稳定性](#稳定性)
  - [资源](#资源)
  - [异常](#异常)
  - [业务](#业务)
- [探测方案与选型](#探测方案与选型)
- [探测原理](#探测原理)
- [后端与分析平台](#后端与分析平台)

---

## 核心指标速记

> 说出这 3 个 + 知道怎么采集

| 指标 | 一句话 | 优秀 | 正常 | 差（告警） |
|------|--------|------|------|-----------|
| **P95 响应时间** | 服务快不快 | < 100ms | < 500ms | > 1s |
| **5xx 错误率** | 服务稳不稳 | < 0.01% | < 0.1% | > 0.5% |
| **Event Loop Lag** | 主线程有没有被阻塞 | < 10ms | < 50ms | > 100ms |

---

## 全量指标详解

### 可用性

| 指标 | 含义 | 优秀 | 正常 | 差 | 采集方式 |
|------|------|------|------|-----|---------|
| Uptime % | 服务存活率 | 99.99% | 99.9% | < 99% | 健康检查 endpoint（K8s liveness probe / 外部拨测） |
| 5xx 错误率 | 服务端错误占比 | < 0.01% | < 0.1% | > 0.5% | Nginx access log / APM |

**健康检查怎么做**：暴露 `GET /health` 接口，返回 200 + 依赖状态（DB/Redis 是否连通）。K8s 每 10s 打一次，连续 3 次失败 → 重启 Pod。

**Q：什么是服务存活率？探针是内置的还是外部监测？**

服务存活率 = "一段时间内服务能正常响应的时间占比"。99.9% = 一年最多 8.76 小时不可用。

**检测不是内置探针，是外部拨测（三层）**：

| 检测方式 | 谁做 | 检测什么级别 |
|---------|------|-------------|
| **PM2 / K8s** | 进程管理器 | 进程活着吗（进程级）— 进程活着但死循环了它不知道 |
| **Health Check** | K8s liveness probe / 内部拨测 | 应用能正常响应吗（应用级）— `/health` 里可以检查 DB/Redis |
| **外部拨测** | UptimeRobot / 自建 | 用户能访问到吗（用户级）— 包含 DNS/CDN/网络 |

**最佳实践**：三层都要。PM2/K8s 保进程活着 → Health Check 保应用正常 → 外部拨测保用户可达。

**`/health` 接口怎么写**：

```js
app.get('/health', async (ctx) => {
  const dbOk = await db.ping().catch(() => false)
  const redisOk = await redis.ping().catch(() => false)

  if (dbOk && redisOk) {
    ctx.status = 200
    ctx.body = { status: 'ok', db: 'ok', redis: 'ok' }
  } else {
    ctx.status = 503  // K8s 收到 503 → 判定不健康 → 重启
    ctx.body = { status: 'degraded', db: dbOk, redis: redisOk }
  }
})
```

1. k8s PM2: 

### 性能

| 指标 | 含义 | 优秀 | 正常 | 差 | 采集方式 |
|------|------|------|------|-----|---------|
| P50 响应时间 | 中位数（大部分用户的体感） | < 50ms | < 200ms | > 500ms | APM 探针 |
| P95 响应时间 | 95% 用户的上限 | < 100ms | < 500ms | > 1s | APM 探针 |
| P99 响应时间 | 长尾（最慢 1%） | < 500ms | < 2s | > 5s | APM 探针 |
| QPS | 每秒请求量（容量） | — | — | 接近上限告警 | Prometheus counter |
| TTFB | 首字节时间（SSR 场景） | < 200ms | < 500ms | > 1s | Navigation Timing |

1. p95 什么意思 ? APM探针 一般用什么? 大厂自建吗 

**Q：P95 什么意思？**

把所有请求响应时间从小到大排序，第 95% 位置的值。"95% 的请求都在这个时间内完成了"。看 P95 不看平均值，因为平均值会被极端值拉平看不出长尾。

**Q：APM 探针一般用什么？大厂自建吗？**

| 场景 | 方案 | 接入 |
|------|------|------|
| 开源标准 | OpenTelemetry `@opentelemetry/sdk-node` | `new NodeSDK().start()` |
| 商业 SaaS | Datadog `dd-trace` | `require('dd-trace').init()` |
| 大厂 | 基于 OTel 协议自建 SDK | 同 OTel 接入，上报到自建后端 |

大厂确实自建（DD/KS/BT），但底层协议向 OpenTelemetry 靠拢。讲的时候说"OTel 采集 + Prometheus 存储 + Grafana 展示"。

**Q：Node.js 需要几套探针？**

**一套就够**。OTel 一个 SDK 同时产出 Metrics + Traces + Logs：

```
@opentelemetry/sdk-node
  ├── Metrics → Prometheus
  ├── Traces → Jaeger
  └── Logs → Elasticsearch
```

实际生产 = OTel（全能） + Sentry（专注错误追踪，堆栈/面包屑更好用）。

### 稳定性

| 指标 | 含义 | 优秀 | 正常 | 差 | 采集方式 |
|------|------|------|------|-----|---------|
| Event Loop Lag | 主线程被阻塞的程度 | < 10ms | < 50ms | > 100ms | `perf_hooks.monitorEventLoopDelay()` |
| GC 频率/耗时 | 垃圾回收压力 | < 5% CPU 占用 | < 10% | > 20% | `--expose-gc` + `perf_hooks` |

**Event Loop Lag 高说明什么**：有 CPU 密集任务占着主线程（如大 JSON 序列化、正则回溯、同步文件 IO）。解法：放到 Worker Thread 或 拆成多次 `setImmediate`。

### 资源

| 指标 | 含义 | 优秀 | 正常 | 差 | 采集方式 |
|------|------|------|------|-----|---------|
| CPU 使用率 | 计算压力 | < 30% | < 60% | > 80% | `process.cpuUsage()` / cAdvisor |
| Heap Used | 堆内存使用 | 稳定 | 波动但回落 | 持续上涨不回落 = 泄漏 | `process.memoryUsage().heapUsed` |
| RSS | 总内存（含 Native） | < 500MB | < 1GB | > 1.5GB 或持续涨 | `process.memoryUsage().rss` |
| Active Handles | 未释放的连接/定时器 | 稳定 | — | 持续增长 = 泄漏 | `process._getActiveHandles().length` |

### 异常

| 指标 | 含义 | 优秀 | 正常 | 差 | 采集方式 |
|------|------|------|------|-----|---------|
| 未捕获异常数 | 代码 Bug 暴露 | 0 | < 5/min | > 10/min | `process.on('uncaughtException')` + Sentry |
| 进程重启次数 | 容错恢复频率 | 0 | < 1/天 | > 3/小时 | PM2 / K8s restart count |
| OOM 次数 | 内存溢出 | 0 | 0 | > 0 立即排查 | K8s OOMKilled event |

### 业务

| 指标 | 含义 | 采集方式 |
|------|------|---------|
| SSR 渲染成功率 | Nuxt 页面渲染是否正常 | try-catch 包裹 renderToString，失败计数 |
| 接口超时率 | 上游依赖是否慢 | 请求拦截器统计 > 3s 的比例 |
| 缓存命中率 | Redis/内存缓存是否生效 | hit / (hit + miss) |

---

## 探测方案与选型

| 方案 | 类型 | 适用 | 特点 |
|------|------|------|------|
| **OpenTelemetry** | 开源标准 | 所有规模 | 供应商中立，业界标准，一套 SDK 出 Metrics + Traces + Logs |
| **Datadog** (`dd-trace`) | 商业 SaaS | 中小团队 | 一行代码接入，全家桶（APM + 日志 + 告警） |
| **Prometheus** + `prom-client` | 开源自建 | 有运维能力的团队 | 只做 Metrics，需自己暴露 `/metrics` 端点 |
| **Sentry** | 开源+SaaS | 错误监控 | 偏 Error Tracking，也有基础性能追踪 |
| **大厂自建** | 内部 | DD/KS/BT | 基于 OTel 协议自研采集 + 存储 + 展示 |

**最佳选型**：OpenTelemetry（采集标准） + Prometheus（指标存储） + Grafana（展示） + Jaeger（链路追踪）。

**云上最佳实践**：

```
你的 Node 服务
  └── OTel SDK（你只管接入这一个）
        ↓ 上报（OTLP 协议）
云厂商提供的后端（你不用自己搭）
  ├── 阿里云：ARMS + SLS + Grafana 托管
  ├── AWS：CloudWatch + X-Ray
  └── Datadog / New Relic（第三方 SaaS，不绑云厂商）
```

| 你做的 | 云做的 |
|--------|--------|
| 接入 OTel SDK（几行代码） | 存储、计算、展示、告警全套 |
| 配置上报地址 | Dashboard / 告警规则 / 链路分析 |
| 自定义业务指标 | 基础设施指标自动采集 |

| 规模 | 方案 |
|------|------|
| 小团队 | Datadog 或云厂商 APM（全托管） |
| 中型 | 云上 Prometheus + Grafana 托管 |
| 大厂 | 自建全套（协议兼容 OTel） |

**一句话**：SDK 永远选 OTel（标准不绑定），后端看预算和运维能力。

### 落地方案（可行性 — 直接用这套）

**完整组合 = OTel + Sentry + Prometheus + Grafana**：

```
你的 Node 服务
  ├── @opentelemetry/sdk-node     → Metrics + Traces
  ├── @sentry/node                → 错误追踪（堆栈/面包屑/用户上下文）
  └── pino / winston              → 结构化日志（关联 trace-id）
        ↓
  OTel Collector（或直接上报）
        ↓
  ┌─────────────────────────────────┐
  │ Prometheus（指标）              │
  │ Jaeger / Tempo（链路）          │  ← 云托管或 Docker Compose 自建
  │ Grafana（统一 Dashboard）       │
  │ Sentry Cloud（错误）            │  ← SaaS，免运维
  │ AlertManager（告警 → 飞书）     │
  └─────────────────────────────────┘
```

**落地步骤（1 周搞定）**：

| 天 | 做什么 | 产出 |
|----|--------|------|
| Day 1 | 接入 OTel SDK + Sentry SDK | 数据开始采集 |
| Day 2 | 部署 Prometheus + Grafana（Docker Compose 或云托管） | 能看 Dashboard |
| Day 3 | 配置核心告警规则（P95 > 1s / 5xx > 0.5% / EL Lag > 100ms） | 异常有人知道 |
| Day 4 | 接入 Jaeger（链路追踪） | 能排查慢请求链路 |
| Day 5 | 自定义业务指标（SSR 成功率/缓存命中率） | 业务健康可观测 |

**这套方案的优势**：
- OTel = 标准协议，不绑定任何厂商，未来换后端零成本
- Sentry 专注错误（比 OTel 的错误功能好 10 倍：堆栈还原、面包屑、用户回放）
- Grafana 统一展示（Prometheus + Jaeger + 日志 一个入口看完）
- 全部开源 / 有免费云托管版，小团队零成本启动

---

## OpenTelemetry（OTel）详解

### 是什么

CNCF 孵化的开源可观测标准。本质 = **一套统一的 API + SDK + 协议**，让你一次接入就能产出 Metrics / Traces / Logs 三种数据，上报到任何后端（Prometheus / Jaeger / Datadog / 自建）。

**类比**：OTel 之于可观测，就像 USB 之于外设 — 统一接口，不绑定厂商。

### 使用（Node.js 接入）

```ts
// 入口文件最顶部（必须在业务代码之前）
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  // Metrics → 暴露 /metrics 给 Prometheus 抓取
  metricReader: new PrometheusExporter({ port: 9464 }),
  // Traces → 上报到 Jaeger/Tempo
  traceExporter: new OTLPTraceExporter({ url: 'http://jaeger:4318/v1/traces' }),
  // 自动 hook 所有常见模块（http/express/pg/redis/...）
  instrumentations: [getNodeAutoInstrumentations()]
})

sdk.start()  // 之后所有 http/db/redis 调用自动被追踪
```

**就这么多**。业务代码不用改一行，OTel 自动 hook 了 http / express / koa / pg / redis / mongodb 等模块。

### 探测原理

OTel 的 `auto-instrumentations` 内部就是 monkey patching：

```
sdk.start()
  → getNodeAutoInstrumentations()
    → @opentelemetry/instrumentation-http: patch(http.request)
    → @opentelemetry/instrumentation-express: patch(express.Router)
    → @opentelemetry/instrumentation-pg: patch(pg.Client.query)
    → ...每个模块一个 instrumentation 包
```

每个 instrumentation 包做的事：
1. `require` 时拦截目标模块
2. 用 Proxy/包装函数替换关键方法
3. 在方法前后计时 + 创建 Span（链路节点）
4. 自动上报

### 覆盖的指标

| 类型 | 自动采集的 | 需要手动的 |
|------|-----------|-----------|
| **Metrics** | HTTP 请求数/耗时/错误率、DB 查询耗时 | 业务指标（下单量/缓存命中率） |
| **Traces** | 完整请求链路（HTTP → Express → DB → Redis） | 自定义 Span（业务逻辑关键步骤） |
| **Logs** | — | 需配合 pino/winston 输出结构化日志（自动关联 trace-id） |
| **Runtime** | — | Event Loop Lag / 内存 / GC 需额外加 `@opentelemetry/instrumentation-runtime-node` |

**一句话**：接入 OTel SDK → HTTP/DB/Redis 的性能指标和链路追踪自动有了。业务指标和 Runtime 指标需要额外几行代码。

---

## 探测原理

### Monkey Patching（核心手段）

在应用启动前 hook 原生模块，给关键方法包一层计时：

```js
const originalRequest = require('http').request

http.request = function(...args) {
  const start = Date.now()
  const req = originalRequest.apply(this, args)
  req.on('response', () => {
    report({ url: args[0], duration: Date.now() - start })
  })
  return req
}
// 同理 hook pg.query / redis.get / fetch 等
```

### Node 原生 API

| API | 作用 |
|-----|------|
| `perf_hooks.monitorEventLoopDelay()` | 检测 Event Loop 延迟 |
| `process.memoryUsage()` | 堆内存 / RSS |
| `process.cpuUsage()` | CPU 时间 |
| `async_hooks` | 追踪异步操作生命周期（链路追踪） |
| `diagnostics_channel` (Node 16+) | 内置诊断通道（官方替代 monkey patch 的方向） |

### 总结

探针 = monkey patch（计时上报）+ Node 原生 API（内存/CPU/Event Loop）+ async_hooks（链路追踪）。

---

## 后端与分析平台

```
应用层（Node 服务）
  └── 探针 SDK（OpenTelemetry / dd-trace）
        ↓ 上报（OTLP 协议 / HTTP）
采集层
  └── OTel Collector（接收、处理、转发）
        ↓
存储层
  ├── Prometheus（Metrics 时序数据）
  ├── Jaeger / Tempo（Traces 链路数据）
  └── Elasticsearch（Logs 日志）
        ↓
展示层
  └── Grafana（Dashboard 统一可视化）
        ↓
告警层
  └── AlertManager → 飞书/钉钉/短信/电话
```

**大厂实际**：架构一样，只是每一层用自研替代开源。你用开源方案讲即可。

---
