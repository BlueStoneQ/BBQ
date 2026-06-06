# 进程管理与部署

> 解决什么问题：Node 单线程挂了怎么办？怎么利用多核 CPU？怎么做到零停机部署？
> 本质：cluster 多进程 + PM2 守护 + Docker 容器化 + 优雅重启。
> 场景：BFF 服务部署、SSR 服务部署、负载分析平台。

---

## 目录

- [为什么需要多进程](#为什么需要多进程)
- [cluster 模块](#cluster-模块)
- [PM2 进程管理](#pm2-进程管理)
- [优雅重启 / 零停机部署](#优雅重启--零停机部署)
- [Docker 部署](#docker-部署)
- [面试问题](#面试问题)

---

## 为什么需要多进程

```
Node 单进程问题：
  1. 只能用一个 CPU 核（8 核机器浪费 7 核）
  2. 未捕获异常 → 进程退出 → 服务全挂
  3. 内存泄漏 → 只能重启

解决：
  cluster fork 多个工作进程（和 CPU 核数一样多）
  一个挂了自动拉起新的
  多进程共享同一个端口
```

---

## cluster 模块

```ts
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  
  // fork 和 CPU 核数一样多的工作进程
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // 工作进程挂了 → 自动拉新的
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, forking new one`);
    cluster.fork();
  });
} else {
  // 工作进程：跑实际的 HTTP 服务
  app.listen(3000);
}
```

**原理**：master 进程 fork 多个 worker，操作系统内核负责把连接分发到各 worker（round-robin）。各 worker 独立，一个挂了不影响其他。

---

## PM2 进程管理

**PM2 = 生产级进程管理器**，封装了 cluster + 守护 + 日志 + 监控。

```bash
# 启动（自动 cluster，按 CPU 核数 fork）
pm2 start app.js -i max

# 查看状态
pm2 list
pm2 monit

# 零停机重启（graceful reload）
pm2 reload app

# 日志
pm2 logs

# 开机自启
pm2 startup
pm2 save
```

### ecosystem.config.js

```js
module.exports = {
  apps: [{
    name: 'bff-server',
    script: 'dist/main.js',
    instances: 'max',        // 按 CPU 核数
    exec_mode: 'cluster',    // cluster 模式
    max_memory_restart: '500M',  // 内存超限自动重启
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }]
};
```

---

## 优雅重启 / 零停机部署

**问题：部署新版本时，正在处理的请求怎么办？**

```
暴力重启：kill → 启动新进程
  → 正在处理的请求直接断开 → 用户看到错误

优雅重启（Graceful Reload）：
  1. 启动新的 worker 进程（加载新代码）
  2. 新 worker 就绪后，开始接收新请求
  3. 旧 worker 停止接收新请求
  4. 等旧 worker 处理完当前请求（或超时）
  5. 旧 worker 退出
  → 用户无感知
```

```ts
// 应用层配合：监听 SIGTERM 信号做清理
process.on('SIGTERM', async () => {
  // 停止接收新请求
  server.close();
  
  // 等待正在处理的请求完成（或超时）
  await gracefulShutdown();
  
  // 关闭数据库连接等资源
  await db.disconnect();
  
  process.exit(0);
});
```

---

## Docker 部署

### Dockerfile（Node.js 应用）

```dockerfile
# 多阶段构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Docker + PM2？

```
Docker 容器内通常不用 PM2：
  - Docker 本身做进程守护（容器挂了 → restart policy 拉起）
  - K8s 管多副本（HPA 自动扩缩容）
  - 容器内跑一个进程就够了（不需要 cluster）

什么时候在 Docker 内用 PM2：
  - 单台机器部署（没有 K8s）
  - 需要利用多核（容器分配了多核 CPU）
```

### 部署模式对比

| 模式 | 适用 | 进程管理 | 多核利用 |
|------|------|---------|---------|
| PM2 + 裸机 | 小团队/单机 | PM2 | cluster mode |
| Docker + 单进程 | K8s 集群 | Docker/K8s | 多 Pod 副本 |
| Docker + PM2 | 单机 Docker | PM2 in container | cluster mode |

---

## 面试问题

| 问题 | 一句话 |
|------|--------|
| Node 怎么利用多核？ | cluster.fork() 多个工作进程，共享端口 |
| 进程挂了怎么办？ | PM2/cluster 自动 fork 新进程拉起 |
| 怎么做零停机部署？ | pm2 reload（新 worker 就绪后才退旧 worker） |
| Docker 里还需要 PM2 吗？ | K8s 环境不需要（K8s 管副本）；单机 Docker 可以用 |
| Node 内存泄漏怎么处理？ | PM2 max_memory_restart 超限自动重启 + 排查泄漏源 |
