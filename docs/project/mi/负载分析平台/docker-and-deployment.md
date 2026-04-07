# Docker 容器化与部署梳理

## 目录

- [一、Docker 核心概念](#一docker-核心概念)
  - [1.1 Docker 解决什么问题](#11-docker-解决什么问题)
  - [1.2 核心概念](#12-核心概念)
  - [1.3 镜像的本质](#13-镜像的本质)
  - [1.4 Docker vs 虚拟机](#14-docker-vs-虚拟机)
  - [1.5 Docker 的平台限制](#15-docker-的平台限制)
- [二、Docker 在本项目中的使用](#二docker-在本项目中的使用)
  - [2.1 为什么需要 Docker](#21-为什么需要-docker)
  - [2.2 镜像分层策略](#22-镜像分层策略)
  - [2.3 Dockerfile 逐行解读](#23-dockerfile-逐行解读)
  - [2.4 容器内多服务编排](#24-容器内多服务编排)
- [三、CI/CD 流水线](#三cicd-流水线)
  - [3.1 完整流程](#31-完整流程)
  - [3.2 Kaniko — 为什么不用 docker build](#32-kaniko--为什么不用-docker-build)
  - [3.3 多环境管理](#33-多环境管理)
- [四、容器平台与 K8s](#四容器平台与-k8s)
  - [4.1 K8s 核心概念](#41-k8s-核心概念)
  - [4.2 本项目的容器编排](#42-本项目的容器编排)
  - [4.3 实际解决的运维问题](#43-实际解决的运维问题)
- [五、实际踩过的坑](#五实际踩过的坑)

---

## 一、Docker 核心概念

### 1.1 Docker 解决什么问题

一句话：**消除"在我机器上能跑"的问题**。

传统部署方式：开发者写完代码 → 告诉运维"装 Node 22、cmake、Redis、NDK" → 运维手动装 → 版本不对 → 来回沟通 → 终于跑起来 → 下次部署又来一遍。

Docker 方式：开发者写 Dockerfile → CI 自动构建镜像 → 镜像推送到仓库 → 任何机器拉取镜像就能跑。环境和代码打包在一起，不存在"环境不一致"。

### 1.2 核心概念

| 概念 | 类比 | 说明 |
|------|------|------|
| **镜像 (Image)** | 安装光盘 | 只读模板，包含 OS 用户空间 + 依赖 + 应用代码 + 配置 |
| **容器 (Container)** | 运行中的程序 | 镜像的运行实例，有独立的文件系统和进程空间 |
| **Dockerfile** | 安装脚本 | 描述如何一步步构建镜像的指令文件 |
| **镜像仓库 (Registry)** | 应用商店 | 存储和分发镜像（Docker Hub / 公司内部仓库） |
| **数据卷 (Volume)** | 外接硬盘 | 容器销毁后数据不丢失，用于持久化 |
| **层 (Layer)** | git commit | Dockerfile 每条指令生成一层，层可以被多个镜像共享 |

### 1.3 镜像的本质

镜像**不是一个完整的操作系统**，而是一个**分层的只读文件系统快照**。

```
一个完整的 OS:
┌─────────────────────┐
│  用户空间 (userland)  │  ← 镜像只包含这部分
│  /bin /lib /usr /etc │  ← 命令、库、配置文件
│  apt-get, bash, libc │
├─────────────────────┤
│  内核 (kernel)        │  ← 镜像不包含，用宿主机的
│  进程调度、内存管理    │
│  文件系统、网络协议栈  │
└─────────────────────┘
```

Dockerfile 每条指令生成一个层：

```
Layer 4: RUN pnpm run build          → 新增 .output/ 目录
Layer 3: RUN pnpm install            → 新增 node_modules/
Layer 2: COPY . .                    → 新增应用源码
Layer 1: RUN apt-get install redis   → 新增 redis-server 二进制
Layer 0: FROM ubuntu:22.04           → Ubuntu 的 /bin /lib /usr /etc
```

`docker run` 时：所有层叠加（UnionFS/OverlayFS）→ 顶部加一个可写层 → 用 Linux namespace 隔离进程 → 用 cgroup 限制资源 → 共享宿主机内核。

### 1.4 Docker vs 虚拟机

```
虚拟机:                          Docker 容器:
┌─────────┐ ┌─────────┐         ┌─────────┐ ┌─────────┐
│  App A  │ │  App B  │         │  App A  │ │  App B  │
├─────────┤ ├─────────┤         ├─────────┤ ├─────────┤
│ Guest OS│ │ Guest OS│         │ 用户空间 │ │ 用户空间 │
├─────────┤ ├─────────┤         └────┬────┘ └────┬────┘
│ 虚拟硬件 │ │ 虚拟硬件 │              │           │
├─────────┴─┴─────────┤         ┌────┴───────────┴────┐
│    Hypervisor       │         │    Docker Engine     │
├─────────────────────┤         ├─────────────────────┤
│    宿主机 OS + 内核  │         │    宿主机 OS + 内核  │
└─────────────────────┘         └─────────────────────┘

GB 级，分钟级启动                 MB 级，秒级启动
完全隔离（有自己的内核）           进程级隔离（共享内核）
```

### 1.5 Docker 的平台限制

Docker 容器**不是跨平台的**，有两个维度的限制：

| 维度 | 限制 | 原因 |
|------|------|------|
| **内核** | Linux 镜像只能跑在 Linux 内核上 | 容器共享宿主机内核，不能用 Linux 内核执行 Windows 系统调用 |
| **CPU 架构** | x86 镜像只能跑在 x86 机器上 | 镜像里的二进制是编译好的机器码，x86 的码 ARM 执行不了 |

macOS/Windows 上的 Docker Desktop 实际是先启动了一个 Linux 虚拟机，容器跑在虚拟机里。

Docker 的"跨平台"价值是：**同内核同架构下，不管目标机器装了什么软件、什么版本的 glibc，镜像都能一致运行**。解决的是环境差异问题，不是跨 OS 问题。

## 二、Docker 在本项目中的使用

### 2.1 为什么需要 Docker

这个项目的运行环境极其复杂，跨 4 种语言的工具链：

```
Node.js 22 + pnpm                     # 前端构建和运行
cmake + NDK + libsimpleperf_report.so  # C++ Native Addon 编译
Python3                                # 数据解析脚本（Consumer 侧）
Redis                                  # 多进程协调
```

没有 Docker 的话，新人入职装环境要半天，线上部署要 SSH 手动操作，版本稍有差异 C++ addon 就编译不过。Docker 把整个环境封装成镜像，一条命令搞定。

### 2.2 镜像分层策略

```
┌─────────────────────────────────────────┐
│ 应用镜像 (每次 git push 重新构建)        │  ← 变化频繁，5 分钟
│ COPY 源码 → pnpm install → build        │
├─────────────────────────────────────────┤
│ base 镜像 (load-terminator-base:beta)   │  ← 很少变化，几个月一次
│ pnpm + cmake + python3 + NDK + .so 库   │
├─────────────────────────────────────────┤
│ 操作系统层 (Ubuntu/Debian)               │  ← 几乎不变
└─────────────────────────────────────────┘
```

**为什么要分层？** base 镜像包含编译工具链（cmake + NDK 就好几 GB），如果每次 CI 都从头装，构建要 20+ 分钟。分层后应用镜像只做 `install + build`，5 分钟搞定。Docker 的层缓存机制保证未变化的层不会重新构建。

### 2.3 Dockerfile 逐行解读

```dockerfile
# 1. 基于自定义 base 镜像（已包含 pnpm/cmake/python3/NDK）
FROM micr.cloud.mioffice.cn/load-terminator-base/load-terminator-base:beta

# 2. 安装 Redis（容器内 sidecar 模式，不用云 Redis）
RUN apt-get update && apt-get install -y redis-server

# 3. 复制源码，安装依赖
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
#   --frozen-lockfile: 严格按 lock 文件安装，保证 CI 和本地一致

# 4. 编译 C++ Native Addon（cmake → 链接 libsimpleperf_report.so）
RUN pnpm run build:native

# 5. 构建 Nuxt 应用（产出 .output/ 目录）
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm run build

# 6. 生成启动脚本（先 Redis，再应用）
RUN echo '#!/bin/bash\n\
redis-server --daemonize yes --maxmemory 512mb --maxmemory-policy allkeys-lru\n\
until redis-cli ping > /dev/null 2>&1; do sleep 1; done\n\
exec pnpm run server\n\
' > /app/start.sh && chmod +x /app/start.sh
#   exec: 让 PM2 成为 PID 1，正确接收 SIGTERM 实现优雅关闭
#   --maxmemory 512mb + allkeys-lru: 防止 Redis OOM

EXPOSE 80
CMD ["/app/start.sh"]
```

### 2.4 容器内多服务编排

```
容器启动 → start.sh
    │
    ├── 1. redis-server --daemonize yes    # 后台启动 Redis
    ├── 2. until redis-cli ping; do sleep 1 # 等待 Redis 就绪
    └── 3. exec pnpm run server             # PM2 Cluster × 4 实例
                                             # 每实例 8GB 内存
                                             # 监听 80 端口
```

**为什么 Redis 放容器内？**
- 只用于同容器 4 个 PM2 进程间的协调（分布式锁 + Pub/Sub）
- 数据不需要持久化，不需要跨容器共享
- sidecar 模式零网络延迟，最简单
- 后续扩展只需改 `REDIS_HOST` 环境变量即可迁移到云 Redis

## 三、CI/CD 流水线

### 3.1 完整流程

```
开发者 git push
    │
    ▼
GitLab CI 触发 (.gitlab-ci.yml)
    │
    ▼
Kaniko 构建 Docker 镜像
    │  context = 项目源码
    │  dockerfile = ./Dockerfile
    │  destination = micr.cloud.mioffice.cn/ide-pages/load-terminator:staging-{commit}
    ▼
推送到 micr（小米内部镜像仓库）
    │
    ▼
容器平台拉取新镜像
    │  滚动更新: 先启动新容器 → 健康检查通过 → 停止旧容器
    ▼
用户访问 https://test.loadterminator.mioffice.cn
```

整个过程开发者只需要 `git push`，不需要 SSH、不需要手动操作服务器。

### 3.2 Kaniko — 为什么不用 docker build

CI 环境本身运行在容器里（GitLab Runner 是容器化的）。在容器里跑 `docker build` 需要 Docker-in-Docker（DinD），这有安全风险（需要 privileged 模式）且性能差。

Kaniko 是 Google 开源的镜像构建工具，**不需要 Docker daemon**，直接在用户空间解析 Dockerfile 并构建镜像。专为 CI 容器环境设计。

```
传统方式: CI 容器 → 启动 Docker daemon → docker build → push
Kaniko:   CI 容器 → kaniko executor → 直接构建 + push（无 daemon）
```

### 3.3 多环境管理

同一份 Dockerfile，通过环境变量区分环境：

| 环境 | 镜像 tag | 域名 | 环境变量 |
|------|---------|------|---------|
| dev | 本地 docker build | localhost:3000 | `NODE_ENV=development` |
| staging | staging-{commit} | test.loadterminator.mioffice.cn | `PROJECT_ENV=test` |
| production | prod-{commit} | mi.loadterminator.mioffice.cn | `PROJECT_ENV=prod` |

开发环境不用 Docker，直接 `pnpm dev`，通过 Nuxt devProxy 代理到 staging 后端。staging 和 production 用同一个 Dockerfile 构建，只是环境变量不同（认证公钥、数据库地址等）。

## 四、容器平台与 K8s

### 4.1 K8s 核心概念

小米内部容器平台基于 Kubernetes（K8s），理解几个核心概念：

| 概念 | 说明 | 本项目对应 |
|------|------|-----------|
| **Pod** | K8s 最小调度单元，包含一个或多个容器 | 我们的容器（Nuxt + Redis）是一个 Pod |
| **Deployment** | 管理 Pod 的副本数、滚动更新策略 | 定义了跑几个 Pod、怎么更新 |
| **Service** | Pod 的网络入口，负载均衡 | 把流量分发到 Pod 的 80 端口 |
| **Ingress** | 外部流量入口，域名 → Service 的映射 | test.loadterminator.mioffice.cn → Service |
| **ConfigMap / Secret** | 配置和密钥管理 | 环境变量、认证公钥 |
| **Volume / PVC** | 持久化存储 | trace-fs 挂载到容器 /home/work/trace-fs |
| **HPA** | 自动水平扩缩容 | 根据 CPU/内存自动增减 Pod 数量 |

### 4.2 本项目的容器编排

```
                    Ingress (域名绑定)
                        │
                        ▼
                    Service (负载均衡)
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
           Pod 1     Pod 2     Pod 3        ← Deployment 管理
           ┌────┐    ┌────┐    ┌────┐
           │Nuxt│    │Nuxt│    │Nuxt│       ← 每个 Pod 内:
           │PM2 │    │PM2 │    │PM2 │          PM2 × 4 进程
           │×4  │    │×4  │    │×4  │          + Redis sidecar
           │Redis│   │Redis│   │Redis│
           └────┘    └────┘    └────┘
              │         │         │
              └─────────┼─────────┘
                        │
                   Volume (PVC)
                   trace-fs 挂载
                   /home/work/trace-fs
```

**当前部署**: 单 Pod（够用了，内部工具用户量不大）。但架构上已经支持水平扩展——如果需要多 Pod，只需把 Redis 从 sidecar 迁移到独立 Service（或云 Redis），其他不用改。

### 4.3 实际解决的运维问题

| 问题 | 没有容器化 | 有容器化 + K8s |
|------|-----------|---------------|
| **部署** | SSH 到服务器，手动 git pull + build | git push 自动触发，5 分钟上线 |
| **回滚** | 找上个版本代码重新 build | 容器平台一键回滚到上个镜像 |
| **扩容** | 新机器装环境 + 部署 | Deployment replicas 改个数字 |
| **故障恢复** | 人工发现 + 手动重启 | K8s 健康检查自动重启 |
| **日志** | SSH 到服务器看文件 | 容器平台统一日志收集 |
| **资源隔离** | 多个应用共享一台机器互相影响 | 每个 Pod 有独立的 CPU/内存限制 |
| **环境一致** | dev/staging/prod 各装一套 | 同一镜像 + 不同环境变量 |
| **存储** | 数据在服务器本地，机器挂了就丢 | PVC 持久化卷，Pod 重建数据不丢 |

## 五、实际踩过的坑

### 5.1 C++ Addon 编译环境

`libsimpleperf_report.so` 是 Android NDK 编译的，依赖特定版本的 glibc。如果 base 镜像的 Ubuntu 版本不对，运行时会报 `GLIBC_2.xx not found`。解决方案：base 镜像固定 Ubuntu 版本 + NDK 版本，不随意升级。

### 5.2 Docker 构建内存不足

Nuxt build 时 V8 默认内存限制 1.7GB，项目大了会 OOM。Dockerfile 里加了 `ENV NODE_OPTIONS="--max-old-space-size=4096"` 提升到 4GB。

### 5.3 Redis 启动顺序

容器启动时 PM2 比 Redis 先就绪，Node.js 进程连接 Redis 失败。解决方案：启动脚本里 `until redis-cli ping` 轮询等待 Redis 就绪后再启动应用。

### 5.4 镜像仓库权限

CI 构建时 Kaniko 拉取 base 镜像报 `UNAUTHORIZED`。原因是 base 镜像在另一个 namespace 下，CI 的 token 没有 pull 权限。解决方案：把 base 镜像迁移到同一个 namespace，或者配置跨 namespace 的 pull secret。

### 5.5 容器内文件系统

容器的可写层是临时的，Pod 重建后数据丢失。trace-fs 的大文件（GB 级 trace）必须挂载 PVC，不能放在容器内。`./data/` 目录（用户上传的 ZIP）也需要持久化卷。
