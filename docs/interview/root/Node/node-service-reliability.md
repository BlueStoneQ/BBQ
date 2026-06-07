# Node 服务稳定性与可用性

> 解决什么问题：前端写的 BFF/中间层上线后，怎么保证它像后端服务一样稳定——不挂、不慢、扛得住并发。
>
> 本质：Node 服务 = 一个 HTTP 服务进程。它的稳定性建设和后端本质一样，但有 Node 单线程特有的关注点。
>
> 场景：DD BFF 层、SSR 服务、任何 Node 线上服务。

---

## 目录

- [Node 服务的特殊性](#node-服务的特殊性)
- [可用性建设](#可用性建设)
- [并发与性能](#并发与性能)
- [稳定性保障](#稳定性保障)
- [监控体系](#监控体系)
- [Q&A](#qa)

---

## Node 服务的特殊性

```
Node 和 Java/Go 后端的关键区别：

  1. 单线程事件循环
     - CPU 密集操作会阻塞所有请求（Java 线程池不会）
     - 一个未捕获异常可能搞挂整个进程

  2. 内存管理
     - V8 堆内存有上限（默认 ~1.5GB）
     - 内存泄漏比 Java 更敏感（无 GC 分代优化那么成熟）

  3. 不适合做什么
     - CPU 密集计算（图片处理、加密、大数据聚合）→ 放到 Worker Thread 或下游服务
     - 长事务（数据库事务、分布式锁）→ 留给后端

  4. 适合做什么
     - I/O 密集（代理请求、接口聚合、SSR 渲染）→ 事件循环天然高效
     - 高并发短连接（BFF 转发）→ 单进程就能扛几千 QPS
```

---

## 可用性建设

### 多进程 + 自动恢复

```
基础：cluster + PM2（详见 process-deploy.md）

  pm2 start app.js -i max
  → N 个 worker 进程
  → 一个挂了自动拉新的
  → 单个 worker 内存超限自动重启（max_memory_restart）

K8s 场景：
  多 Pod 副本 + 健康检查（liveness/readiness probe）
  → Pod 挂了 K8s 自动重调度
  → 滚动更新零停机
```

### 健康检查

```typescript
// 提供 /health 端点，让 K8s/负载均衡器探测
@Get('health')
healthCheck() {
  return {
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
  };
}

// 深度健康检查（检测下游依赖是否可达）
@Get('health/deep')
async deepHealthCheck() {
  const dbOk = await this.db.ping().catch(() => false);
  const redisOk = await this.redis.ping().catch(() => false);
  
  if (!dbOk || !redisOk) throw new ServiceUnavailableException();
  return { status: 'ok', dependencies: { db: dbOk, redis: redisOk } };
}
```

---

## 并发与性能

### Node 能扛多少并发？

```
关键认知：Node 单进程的并发能力取决于"每个请求占用事件循环多久"

  纯代理转发（I/O 密集）：单进程轻松 5000+ QPS
  有数据处理（JSON 解析/聚合）：1000-3000 QPS
  有 CPU 计算（模板渲染/加密）：几十到几百 QPS

= 不是"Node 并发低"，是"别在事件循环里做 CPU 密集操作"
```

### 不阻塞事件循环的原则

| 场景 | 错误做法 | 正确做法 |
|------|---------|---------|
| JSON 大数据解析 | 同步 JSON.parse 10MB 数据 | 流式解析（stream-json） |
| 加密/压缩 | 同步 crypto/zlib | 异步 API 或 Worker Thread |
| 大量计算 | for 循环 100 万次 | 放到 Worker Thread |
| 图片处理 | 主线程 sharp 处理 | Worker Thread 或独立服务 |

### 限流与背压

```typescript
// 限流：防止突发流量打垮服务
import rateLimit from 'express-rate-limit';

app.use(rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 1000,            // 每个 IP 最多 1000 次
  message: 'Too many requests',
}));

// 背压：下游慢时不要无限堆积请求
// BFF 调下游设置超时，避免连接池耗尽
const response = await axios.get(url, { timeout: 3000 });
```

---

## 稳定性保障

### 未捕获异常处理

```typescript
// 全局兜底：防止进程因未捕获异常退出
process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught Exception', err);
  // 上报错误
  reportError(err);
  // 给正在处理的请求时间完成，然后退出让 PM2 拉起新进程
  setTimeout(() => process.exit(1), 5000);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', reason);
  reportError(reason);
});
```

### 下游调用的容错

```typescript
// 超时：不等太久
// 重试：幂等请求可重试
// 熔断：下游持续失败时快速失败，不继续请求
// 降级：核心功能挂了用缓存/默认值兜底

async function callWithResilience(fn: () => Promise<any>, options: {
  timeout: number;
  retries: number;
  fallback: any;
}) {
  for (let i = 0; i <= options.retries; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), options.timeout)),
      ]);
    } catch (e) {
      if (i === options.retries) return options.fallback;  // 最终降级
    }
  }
}
```

### 内存泄漏防护

```
常见泄漏场景：
  - 全局变量无限增长（缓存没有过期策略）
  - 事件监听器未移除
  - 闭包引用大对象
  - 流未正确关闭

防护：
  - PM2 max_memory_restart（超限重启，治标）
  - 定期 heapdump 对比（Chrome DevTools 分析）
  - 本地缓存加 TTL + 上限（用 lru-cache）
```

---

## 监控体系

| 监控维度 | 指标 | 工具 |
|---------|------|------|
| 进程状态 | CPU / 内存 / 事件循环延迟 | PM2 monit / Prometheus |
| 请求指标 | QPS / RT P50/P90/P99 / 错误率 | Prometheus + Grafana |
| 下游调用 | 每个下游的 RT / 成功率 / 超时率 | 自研中间件埋点 |
| 业务指标 | 接口成功率 / 业务错误码分布 | 日志 + 看板 |
| 告警 | 错误率 > 1% / RT P99 > 3s / 内存 > 80% | Alertmanager |

```typescript
// NestJS 中间件：记录每个请求的 RT 和状态
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      metrics.httpRequestDuration.observe(
        { method: req.method, path: req.route?.path, status: res.statusCode },
        duration
      );
    });
    next();
  }
}
```

---

## Q&A

**Q：Node BFF 能扛多少 QPS？**

A：取决于处理逻辑复杂度。纯代理转发 5000+ QPS/进程，有聚合逻辑 1000-3000。多进程（PM2 cluster）× 单进程 QPS = 总吞吐。4 核机器纯转发约 2 万 QPS。

**Q：Node 服务 CPU 100% 了怎么排查？**

A：`--prof` 生成 CPU profile → Chrome DevTools 分析火焰图 → 找到热点函数。常见原因：同步 JSON.parse 大数据、正则回溯、crypto 同步调用。

**Q：和 Java/Go 后端比，Node 做服务端的劣势？**

A：CPU 密集场景差（单线程）、内存上限（V8 堆 ~1.5GB）、生态不如 Java 成熟（缺少 Spring 级别的分布式组件）。但 I/O 密集场景（BFF/代理/SSR）Node 效率不输 Java，且前端团队维护成本低。

**Q：怎么做到 Node 服务零停机部署？**

A：PM2 reload（或 K8s 滚动更新）：先启动新进程/Pod → 就绪后切流量 → 旧进程处理完当前请求后退出。应用层监听 SIGTERM 做优雅关闭。
