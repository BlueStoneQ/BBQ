# Docker & K8s

## 目录

- [Docker 本质](#docker-本质)
- [核心概念](#核心概念)
- [Dockerfile](#dockerfile)
- [常用命令](#常用命令)
- [Docker Compose](#docker-compose)
- [CI 中的 Docker](#ci-中的-docker)
- [K8s 概述](#k8s-概述)
- [K8s 核心概念](#k8s-核心概念)
- [前端工程师需要了解的 K8s](#前端工程师需要了解的-k8s)

---

## Docker 本质

**一句话**：Docker = 把应用 + 环境打包成一个标准化的"集装箱"，在任何机器上都能一致运行。

**解决什么问题**："我本地跑得好好的，线上就挂了"——环境不一致。

**类比**：
```
没有 Docker：你搬家时把东西散装在卡车上，到了新家发现少了螺丝、电压不对
有 Docker：  你把整个房间（家具+电器+水电）装进集装箱，到哪儿打开都一样
```

### 和虚拟机的区别

```
虚拟机：完整 OS + 应用（GB 级，启动分钟级）
Docker：共享宿主 OS 内核 + 应用（MB 级，启动秒级）

┌─────────────┐    ┌─────────────┐
│   App A     │    │   App A     │
├─────────────┤    ├─────────────┤
│  Guest OS   │    │  容器运行时  │  ← 没有完整 OS，共享内核
├─────────────┤    └──────┬──────┘
│ Hypervisor  │           │
├─────────────┤    ┌──────┴──────┐
│  Host OS    │    │   Host OS   │
└─────────────┘    └─────────────┘
   虚拟机                Docker
```

---

## 核心概念

| 概念 | 类比 | 说明 |
|------|------|------|
| **Image（镜像）** | 类/模板 | 只读的应用快照（代码 + 依赖 + 环境配置） |
| **Container（容器）** | 实例 | 镜像的运行态，可以有多个容器跑同一个镜像 |
| **Dockerfile** | 构建脚本 | 描述如何从零构建一个镜像 |
| **Registry（仓库）** | npm registry | 存放镜像的地方（Docker Hub / 公司私有） |
| **Volume（卷）** | 外挂硬盘 | 持久化数据，容器删了数据还在 |
| **Network** | 局域网 | 容器间通信的虚拟网络 |

### Image vs Container

```
Image = 类（静态的，只读的，一份代码+环境的快照）
Container = 实例（动态的，可读写的，Image run 起来就是 Container）

一个 Image 可以 run 出多个 Container（就像一个类可以 new 多个实例）
```

### 基础镜像从哪来？

基础镜像来自 **Docker Hub**（公共社区仓库）或公司私有 Registry。

```
FROM node:20-alpine
```

这个 `node:20-alpine` 是 Node.js 官方团队维护的镜像，里面已经装好了：
- Alpine Linux（极小的 Linux 发行版，~5MB）
- Node.js 20 运行时
- npm/npx

**它是怎么做出来的？** Node 官方的 Dockerfile 大致是：

```dockerfile
FROM alpine:3.18              # 从最小的 Linux 开始
RUN apk add --no-cache ...    # 装编译工具
RUN curl -o node.tar.gz https://nodejs.org/dist/v20.x/...  # 下载 Node
RUN tar -xzf node.tar.gz && mv node /usr/local/  # 安装
```

所以是**层层叠加**：alpine 团队做了 alpine 镜像 → Node 团队基于 alpine 加了 Node → 你基于 node 镜像加了你的代码。

### 端口暴露（EXPOSE + -p）

**本质问题**：容器有自己独立的网络命名空间，和宿主机网络隔离。容器内进程监听的端口，外部看不到。

**本质动作**：`-p` 让 Docker 在宿主机上设置一条网络转发规则（iptables），把宿主机端口的流量转发到容器内端口。

**效果**：外部通过宿主机端口，就能访问到容器内部的服务。

```
没有 -p：
  浏览器 → 宿主机:3000 → ❌ 到不了容器（网络隔离）

有 -p 8080:3000：
  浏览器 → 宿主机:8080 → Docker 转发 → 容器内:3000 → Node 服务响应
```

两个层面：

| | 作用 | 说明 |
|--|------|------|
| `EXPOSE 3000`（Dockerfile 里） | **文档声明**，告诉使用者"容器内部用 3000 端口" | 不写也能跑，只是别人不知道该映射哪个端口 |
| `-p 8080:3000`（docker run 时） | **真正的端口映射**，宿主机 8080 → 容器 3000 | 不写这个，外部真的访问不到 |

**容器是 Docker 内部的隔离环境**，不是宿主机。所以 EXPOSE 的端口是容器内部的端口（Node 服务在容器内监听 3000），`-p` 把它映射到宿主机的端口上。

### WORKDIR / COPY 与构建上下文

**WORKDIR 是容器内部的目录**，不是宿主机的。容器有自己独立的文件系统。

```dockerfile
WORKDIR /app  # 在容器内部创建 /app 并 cd 进去（和宿主机无关）
```

Docker 在宿主机上的存储位置（`/var/lib/docker/`）你不需要关心，那是 Docker 引擎管理的。

**COPY 是把宿主机的文件拷贝到容器内部**：

```dockerfile
COPY package.json ./
#    ↑ 源：宿主机（构建上下文目录，即 docker build . 的那个 .）
#                   ↑ 目标：容器内部（WORKDIR 下，即 /app/package.json）
```

**为什么需要 COPY？** 容器的文件系统是隔离的，它看不到宿主机的文件。代码在宿主机上（CI Runner 拉取的），必须显式 COPY 进容器才能用。

```
构建时的视角：

宿主机（CI Runner）                    容器内部
┌──────────────────┐                ┌──────────────────┐
│ /builds/project/ │                │ /app/            │
│  ├── package.json│ ── COPY ──→   │  ├── package.json│
│  ├── src/        │ ── COPY ──→   │  ├── src/        │
│  └── dist/       │ ── COPY ──→   │  └── dist/       │
└──────────────────┘                └──────────────────┘
```

**为什么分两次 COPY？**（先 package.json，再源码）

```dockerfile
COPY package.json pnpm-lock.yaml ./   # 第一次：只拷依赖描述
RUN pnpm install                       # 安装依赖（这一层会被缓存）
COPY dist/ ./dist/                     # 第二次：拷构建产物
```

Docker 按层缓存：如果 package.json 没变，`pnpm install` 那一层直接用缓存（几秒），不用重新装依赖（几分钟）。如果一次性 COPY 所有文件，任何源码改动都会导致依赖重装。

### 生命周期

```
Dockerfile → docker build → Image → docker run → Container
                              ↓
                        docker push → Registry
                              ↓
                   其他机器 docker pull → Image → Container
```

---

## Dockerfile

### 前端项目示例（Node.js 后端）

```dockerfile
# 1. 基础镜像（从哪个环境开始）
FROM node:20-alpine

# 2. 工作目录
WORKDIR /app

# 3. 先拷贝依赖文件（利用 Docker 缓存层）
COPY package.json pnpm-lock.yaml ./

# 4. 安装依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# 5. 拷贝源码
COPY dist/ ./dist/

# 6. 暴露端口
EXPOSE 3000

# 7. 启动命令
CMD ["node", "dist/server.js"]
```

### 多阶段构建（前端静态资源）

```dockerfile
# Stage 1: 构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: 运行（只保留产物，镜像更小）
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**多阶段构建的意义**：构建阶段有 node_modules（几百 MB），运行阶段只需要 dist（几 MB）。最终镜像只有 nginx + 静态文件，极小。

### 关键指令

| 指令 | 作用 | 注意 |
|------|------|------|
| `FROM` | 基础镜像 | 用 alpine 版本更小 |
| `WORKDIR` | 设置工作目录 | 后续命令都在这个目录下 |
| `COPY` | 拷贝文件到镜像 | 先拷 package.json 再拷源码（利用缓存） |
| `RUN` | 执行命令（构建时） | 每个 RUN 生成一层，合并减少层数 |
| `EXPOSE` | 声明端口 | 只是文档作用，实际映射靠 -p |
| `CMD` | 启动命令（运行时） | 只能有一个，被 docker run 参数覆盖 |
| `ENV` | 环境变量 | `ENV NODE_ENV=production` |

---

## 常用命令

```bash
# 构建镜像
docker build -t my-app:1.0 .

# 运行容器
docker run -d -p 3000:3000 --name my-app my-app:1.0
#  -d: 后台运行
#  -p: 端口映射（宿主:容器）
#  --name: 容器名

# 查看运行中的容器
docker ps

# 查看日志
docker logs my-app

# 进入容器（调试）
docker exec -it my-app sh

# 停止/删除
docker stop my-app
docker rm my-app

# 推送到仓库
docker push registry.company.com/my-app:1.0
```

---

## Docker Compose

**解决什么问题**：一个项目有多个服务（前端 + 后端 + 数据库 + Redis），一个个 docker run 太麻烦。

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - api

  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=db
      - REDIS_HOST=redis
    depends_on:
      - db
      - redis

  db:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=secret
    volumes:
      - db-data:/var/lib/mysql

  redis:
    image: redis:7-alpine

volumes:
  db-data:
```

```bash
# 一键启动所有服务
docker-compose up -d

# 一键停止
docker-compose down
```

---

## CI 中的 Docker

### GitLab CI 用 Docker 的两种方式

**方式一：用 Docker 镜像作为 CI 环境**

```yaml
test:
  image: node:20-alpine  # ← Runner 在这个镜像里执行命令
  script:
    - pnpm test
```

**方式二：在 CI 中构建 Docker 镜像并推送**

```yaml
build-image:
  stage: build
  image: docker:24
  services:
    - docker:24-dind  # Docker in Docker
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

### 典型前端 CI/CD 流程

```
代码 push → GitLab CI 触发
  → lint/test（node 镜像）
  → build（node 镜像，产出 dist/）
  → docker build（把 dist 打进 nginx 镜像）
  → docker push（推到公司 Registry）
  → 部署（K8s 拉取新镜像，滚动更新）
```

---

## K8s 概述

**一句话**：K8s（Kubernetes）= 管理大量 Docker 容器的调度系统。

**解决什么问题**：
- Docker 解决了"单个应用怎么打包运行"
- K8s 解决了"几十上百个容器怎么管理、扩缩容、自愈、负载均衡"

**类比**：
```
Docker = 集装箱（标准化打包）
K8s   = 港口调度系统（决定哪个集装箱放哪条船、坏了自动换、忙了自动加）
```

### 前端工程师需要了解 K8s 吗？

| 场景 | 需要程度 |
|------|---------|
| 纯前端（静态资源 CDN） | ❌ 不需要 |
| BFF / Node.js 后端 | ✅ 需要基础了解 |
| 全栈交付（你的负载分析平台） | ✅ 需要会写部署配置 |
| Leader 岗 | ✅ 需要理解架构，不需要深入运维 |

---

## K8s 核心概念

| 概念 | 类比 | 说明 |
|------|------|------|
| **Cluster** | 整个机房 | 一组机器组成的集群 |
| **Node** | 单台服务器 | 集群中的一台机器 |
| **Pod** | 最小部署单元 | 一个或多个容器的组合（通常 1 Pod = 1 容器） |
| **Deployment** | 部署策略 | 管理 Pod 的副本数、滚动更新、回滚 |
| **Service** | 负载均衡器 | 给一组 Pod 提供稳定的访问入口 |
| **Ingress** | 网关/反向代理 | 外部流量 → 路由到内部 Service |
| **ConfigMap / Secret** | 环境变量/密钥 | 配置和敏感信息管理 |
| **HPA** | 自动扩缩容 | 根据 CPU/内存自动增减 Pod 数量 |

### 架构图

```
外部请求
  │
  ▼
Ingress（路由规则：/api → api-service, / → web-service）
  │
  ├─→ Service: web-service（负载均衡）
  │     ├─→ Pod: web-1 (nginx + dist)
  │     ├─→ Pod: web-2
  │     └─→ Pod: web-3
  │
  └─→ Service: api-service
        ├─→ Pod: api-1 (node server)
        ├─→ Pod: api-2
        └─→ Pod: api-3
```

---

## 前端工程师需要了解的 K8s

### 部署配置（Deployment YAML）

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-frontend
spec:
  replicas: 3              # 跑 3 个副本
  selector:
    matchLabels:
      app: web-frontend
  template:
    metadata:
      labels:
        app: web-frontend
    spec:
      containers:
        - name: web
          image: registry.company.com/web:1.0.0  # Docker 镜像
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
  strategy:
    type: RollingUpdate    # 滚动更新（不停机）
    rollingUpdate:
      maxSurge: 1          # 最多多 1 个 Pod
      maxUnavailable: 0    # 不允许少 Pod（零停机）
```

### 关键能力（面试能讲清楚就行）

| 能力 | 说明 | 你的经验关联 |
|------|------|-------------|
| **滚动更新** | 逐个替换旧 Pod，零停机 | 类似热更新的思路 |
| **自动扩缩容（HPA）** | CPU > 80% 自动加 Pod | 负载分析平台的高并发场景 |
| **自愈** | Pod 挂了自动重启/重建 | 高可用 |
| **回滚** | `kubectl rollout undo` 一键回退 | 灰度发布失败时 |
| **配置管理** | ConfigMap/Secret 和代码分离 | 多环境（dev/staging/prod） |

### 前端部署的典型 K8s 流程

```
GitLab CI:
  pnpm build → docker build → docker push

K8s:
  kubectl set image deployment/web web=registry/web:新版本
    → K8s 自动拉取新镜像
    → 滚动更新（先起新 Pod，健康检查通过后杀旧 Pod）
    → 零停机完成部署
```

---

## Summary

```
Docker：解决"打包和运行"（单个应用）
  → Dockerfile 定义环境
  → Image 是产物
  → Container 是运行态

K8s：解决"编排和管理"（大规模容器）
  → Deployment 管副本和更新策略
  → Service 管负载均衡
  → HPA 管自动扩缩容

前端工程师的定位：
  → 会写 Dockerfile（必须）
  → 会写基础 K8s YAML（全栈/Leader 需要）
  → 理解滚动更新/扩缩容/回滚（架构讨论能聊）
  → 不需要深入运维（网络策略、存储卷、集群管理留给 SRE）
```
