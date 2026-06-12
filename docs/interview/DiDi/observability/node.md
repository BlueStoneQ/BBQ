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
- [OpenTelemetry（OTel）详解](#opentelemetryotel详解)
- [探测原理](#探测原理)
- [后端与分析平台](#后端与分析平台)
- [指标异常分析与处理](#指标异常分析与处理)
- [Q&A](#qa)

---

## 核心指标速记

> 说出这 3 个 + 知道怎么采集

| 指标 | 一句话 | 优秀 | 正常 | 差（告警） |
|------|--------|------|------|-----------|
| **P95 响应时间** | 服务快不快 | < 100ms | < 500ms | > 1s |
| **5xx 错误率** | 服务稳不稳 | < 0.01% | < 0.1% | > 0.5% |
| **Event Loop Lag** | 主线程有没有被阻塞 | < 10ms | < 50ms | > 100ms |

---
### 指标速查总览

| 维度 | 指标 | OTel 自动采集？ | 优秀 | 正常 | 差（告警） |
|------|------|----------------|------|------|-----------|
| **可用性** | 5xx 错误率 | ✅ auto（HTTP instrumentation） | < 0.01% | < 0.1% | > 0.5% |
| **性能** | P95 响应时间 / QPS | ✅ auto（Histogram + Counter） | < 100ms / — | < 500ms / — | > 1s / 接近上限 |
| **稳定性** | Event Loop Lag | 需加 `runtime-node` | < 10ms | < 50ms | > 100ms |
| **资源** | Heap Used / CPU | 需加 `runtime-node` | 稳定 / < 30% | 波动回落 / < 60% | 持续涨 / > 80% |
| **异常** | 未捕获异常数 | ✅ auto（error 事件） | 0 | < 5/min | > 10/min |
| **业务** | SSR 成功率 / 缓存命中率 | ❌ 手动埋点 | > 99.9% / > 90% | > 99% / > 70% | < 98% / < 50% |

> P95 是 OTel HTTP instrumentation 自动记录每个请求耗时（Histogram），Prometheus 存储后用 `histogram_quantile(0.95, ...)` 查询得出。

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
大厂基本全链路自研, 从探针sdk 到 上报展示后端;

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

**Q：云平台是不是都提供了？还需要自建后端吗？探针呢？**

云 = 省了搭后端，但探针你还是要自己装：

| 层 | 云自动提供 | 你需要做的 |
|----|-----------|-----------|
| **基础设施**（CPU/内存/网络） | ✅ 自动有（K8s/CloudWatch） | 不用管 |
| **应用性能**（P95/链路/错误率） | ❌ 没有 | 接入 OTel SDK |
| **业务指标**（下单量/缓存命中率） | ❌ 没有 | 手动埋点 |

**自建后端的开源方案（Grafana 全家桶，一个 docker-compose 搞定）**：

| 层 | 方案 | 作用 |
|----|------|------|
| 采集传输 | OTel Collector | 统一接收转发 |
| 指标存储 | Prometheus | 时序数据 |
| 链路存储 | Tempo / Jaeger | 请求链路 |
| 日志存储 | Loki / Elasticsearch | 日志 |
| 展示 | **Grafana** | 统一 Dashboard |
| 告警 | AlertManager | 规则 → 飞书/钉钉 |

不是 BI（BI 是给产品/运营看业务数据的），这是给开发/运维看系统健康的 Monitoring Platform。

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

### OTel 采集三层覆盖

```ts
// 完整接入（三层全覆盖）
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  metricReader: new PrometheusExporter({ port: 9464 }),
  traceExporter: new OTLPTraceExporter({ url: 'http://jaeger:4318/v1/traces' }),
  instrumentations: [
    getNodeAutoInstrumentations(),       // 第一层：网络层（HTTP/DB/Redis 自动采集）
    new RuntimeNodeInstrumentation(),    // 第二层：系统层（内存/CPU/Event Loop/GC）
  ]
})
sdk.start()

// 第三层：业务层（手动埋点）
import { metrics } from '@opentelemetry/api'
const meter = metrics.getMeter('business')
const orderCounter = meter.createCounter('orders_created')    // 下单量
const cacheHitRate = meter.createHistogram('cache_hit_rate')  // 缓存命中率

// 业务代码里：
orderCounter.add(1, { channel: 'app' })
cacheHitRate.record(hit ? 1 : 0)
```

**三层覆盖汇总**：

| 层 | 安装什么 | 自动/手动 | 覆盖指标 |
|----|---------|----------|---------|
| **网络层** | `auto-instrumentations-node` | 自动 | HTTP 耗时/错误率、DB 查询、Redis 命令、链路追踪 |
| **系统层** | `instrumentation-runtime-node` | 自动 | Heap 内存、RSS、CPU、Event Loop Lag、GC 频率/耗时 |
| **业务层** | `@opentelemetry/api` 手动 | 手动 | 下单量、缓存命中率、SSR 成功率等自定义指标 |

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

---

## 指标异常分析与处理

> 指标红了怎么排查、怎么解决。

| 指标异常 | 最常见原因 | 排查方式 | 处理 |
|---------|-----------|---------|------|
| **P95 飙高** | 慢 SQL / 外部依赖超时 / 大 JSON 序列化 | Jaeger 链路 → 找最慢的 Span | 加索引 / 设超时 / 流式处理 |
| **5xx 飙高** | 代码 Bug / 依赖挂了 / OOM | Sentry 堆栈 + 日志 | 修 Bug / 降级 / 扩容 |
| **Event Loop Lag 高** | CPU 密集任务阻塞主线程 | `clinic flame`（火焰图）找热点函数 | 移到 Worker Thread / 拆成异步 |
| **内存持续上涨** | 内存泄漏（闭包/全局缓存/未关连接） | Heap Snapshot 对比（Chrome DevTools） | 修泄漏点 / 加上限 / 定时重启 |
| **QPS 接近上限** | 流量突增 / 无缓存 | Grafana 看趋势 + 上游流量分析 | 扩容 / 加缓存 / 限流 |
| **Crash 率升高** | 未捕获异常 / Native 模块崩溃 | Sentry + K8s restart 日志 | 加 ErrorBoundary / 修崩溃点 |

### 排查思路（通用）

```
告警触发
  ↓
1. 看 Grafana Dashboard → 确认是哪个指标异常、从什么时间开始
  ↓
2. 关联时间线 → 那个时间点有没有发版/配置变更/流量突增
  ↓
3. 看链路（Jaeger）→ 找到慢请求的具体 Span（哪个服务/哪个 SQL/哪个外部调用）
  ↓
4. 看日志 → 有没有 error / warning / 异常堆栈
  ↓
5. 看 Sentry → 有没有新增的 exception 类型
  ↓
6. 定位根因 → 修复 / 降级 / 扩容 / 回滚
```

### Event Loop Lag 高的典型场景

| 场景 | 为什么阻塞 | 解法 |
|------|-----------|------|
| 大 JSON `JSON.stringify/parse`（> 1MB） | 同步操作，主线程卡住 | 流式序列化 / Worker Thread |
| 正则回溯（catastrophic backtracking） | 指数级回溯 | 重写正则 / 加超时 |
| 同步文件操作 `fs.readFileSync` | 等磁盘 IO | 改用 `fs.promises.readFile` |
| 密集计算（加密/压缩/图像处理） | CPU bound | Worker Thread / 子进程 |
| 大循环（遍历百万级数据） | 占着主线程不释放 | 分批 + `setImmediate` 让出 |

### 内存泄漏排查步骤

```
1. Grafana 确认 Heap Used 趋势上涨（不是波动）
2. 用 --inspect 连 Chrome DevTools
3. 拍第一张 Heap Snapshot
4. 等几分钟（让泄漏累积）
5. 拍第二张 Heap Snapshot
6. Comparison 视图 → 找 Delta 最大的对象类型
7. 看 Retainer 链 → 找到是谁持有了引用没释放
```

常见泄漏点：
- 全局 Map/Array 只 push 不清理
- 闭包引用了大对象（事件监听器没 removeListener）
- 数据库连接池没释放
- `setInterval` 没 clear

---

---

## Q&A

### 核心指标只记 4 个

**Q：Node.js 可观测核心指标有哪些？**

| # | 指标 | 回答 | 阈值 |
|---|------|------|------|
| 1 | **P95 响应时间** | 用户感知的"快不快" | < 500ms 正常，> 1s 告警 |
| 2 | **5xx 错误率** | 服务"稳不稳" | < 0.1% 正常，> 0.5% 告警 |
| 3 | **Event Loop Lag** | Node 特有 — 主线程"卡没卡" | < 50ms 正常，> 100ms 告警 |
| 4 | **未捕获异常数** | 代码"有没有 Bug 在跑" | 0 最好，> 10/min 告警 |

**资源（CPU/内存）不是你核心关注的** — K8s HPA 自动扩缩容处理。但你需要配 HPA 阈值（CPU > 60% 扩）和 `resources.limits`（防单 Pod OOM），以及监控内存趋势（持续上涨 = 泄漏，HPA 解决不了泄漏）。

关于资源和自动扩容：对，K8s HPA 会根据 CPU/内存自动扩缩容，你不用手动处理。但你需要：

配 HPA 的阈值（CPU > 60% 扩容 / < 20% 缩容）— 这是你定的
配资源上限（resources.limits）— 防止单个 Pod 吃光节点内存
关注内存泄漏 — HPA 解决不了泄漏，只是不断扩新 Pod，旧 Pod 还是会 OOM
所以资源指标你不用"处理"但要监控 — 趋势异常说明有泄漏/有热点，HPA 只是兜底不是解决方案。

### 30s 速记总结

- **核心 4 指标**：P95 响应时间 / 5xx 错误率 / Event Loop Lag / 未捕获异常数
- **怎么采集**：OTel SDK 一套搞定（Metrics + Traces），加 `runtime-node` 包采集内存/CPU/EL
- **后端**：小团队用云（Datadog/ARMS），大厂自建。展示 Grafana，告警 AlertManager
- **探针原理**：monkey patch 关键模块 + Node 原生 API（`perf_hooks` / `async_hooks`）
- **异常排查**：Grafana 看哪个红 → Jaeger 看链路 → Sentry 看堆栈 → 修/降级/扩容

### 负载平台

> 千人级内部 Nuxt SSR 平台，2 Pod 部署，日常状态。

**⭐ 核心 4 指标（必记）**：

| 指标 | 我们的数据 | 告警阈值 | 含义 |
|------|-----------|---------|------|
| **P95 响应时间** | 320ms | > 1s | 快不快 |
| **5xx 错误率** | 0.03% | > 0.5% | 稳不稳 |
| **Event Loop Lag** | 8ms | > 100ms | 卡没卡 |
| **未捕获异常** | 0-2/天 | > 10/min | 有没有 Bug |

**全量指标（追问时用）**：

| 指标 | 仿真值 | 说明 |
|------|--------|------|
| **P50 响应时间** | 45ms | 大部分请求很快（SSR 缓存命中） |
| **P95 响应时间** | 320ms | 少数复杂查询/报表生成 |
| **P99 响应时间** | 1.2s | 长尾：大文件处理/复杂聚合 |
| **5xx 错误率** | 0.03% | 偶发上游超时 |
| **QPS（日常）** | 80-150 | SSR + API 调用（非 C 端） |
| **QPS（高峰）** | 300-500 | 集中时段（周一早会/报表导出） |
| **Event Loop Lag** | 8ms | 正常（无 CPU 密集阻塞） |
| **Heap Used** | 280MB（稳定） | 无泄漏，GC 后回落 |
| **RSS** | 450MB | 含 Native + V8 |
| **CPU 使用率** | 15%（日常）/ 45%（高峰） | 2 Pod 够用 |
| **未捕获异常** | 0-2/天 | 偶发上游超时未 catch |
| **SSR 渲染成功率** | 99.7% | 0.3% 组件报错降级 CSR |
| **进程重启** | 0/周 | 稳定 |

**优化前后对比**：

| 指标 | 优化前 | 优化后 | 做了什么 |
|------|--------|--------|---------|
| S3 文件上传 | 121s | 42s | MPU 分片上传 + 并发 |
| P95 响应时间 | 800ms | 320ms | SSR 缓存 + DB 查询优化 |
| 首屏时间 | 2.1s | 0.9s | 流式 SSR + 关键 CSS 内联 |

---
