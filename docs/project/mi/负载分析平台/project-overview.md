# LoadTerminator 项目梳理

## 目录

- [一句话介绍](#一句话介绍)
- [项目背景 & 业务价值](#项目背景--业务价值)
- [系统架构](#系统架构)
- [技术栈详解](#技术栈详解)
  - [前端](#前端)
  - [后端 (Java)](#后端-java)
  - [后端 (Python Consumer)](#后端-python-consumer)
  - [运维 & CI/CD](#运维--cicd)
- [核心功能模块](#核心功能模块)
  - [1. 内存分析](#1-内存分析我主要负责的模块)
  - [2. 流畅性分析](#2-流畅性分析)
  - [3. 功耗分析](#3-功耗分析)
  - [4. 冷启动分析](#4-冷启动分析)
- [值得深入展开的技术点](#值得深入展开的技术点)
  - [C++ Native Addon](#1-c-native-addon-simpleperf_wrapper)
  - [Perfetto 集成](#2-perfetto-集成)
  - [DiffTable 通用组件设计](#3-difftable-通用组件设计)
  - [数据处理流水线](#4-数据处理流水线)
  - [全栈部署](#5-全栈部署)
- [项目亮点](#项目亮点)

---

## 一句话介绍

Android 性能分析全栈平台，覆盖内存、功耗、流畅性、冷启动四大维度，支持多设备多轮次对比分析，从数据采集、解析、存储到可视化全链路闭环。

## 项目背景 & 业务价值

小米 AIOT 部门内部工具，服务于 Android 系统性能优化团队。测试工程师在手机上跑自动化测试后，产出大量 trace、showmap、simpleperf 等原始数据文件。之前靠人工用 Excel 对比分析，效率低、易出错。

LoadTerminator 将整个流程自动化：上传压缩包 → 异步解析 → 入库 → 可视化对比，将原本数小时的人工分析缩短到分钟级。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Nuxt 4 + Vue 3)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ 内存分析  │ │ 功耗分析  │ │ 流畅性   │ │ 冷启动     │ │
│  │ ECharts  │ │ ECharts  │ │ DiffTable│ │ Perfetto   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Nuxt Server (BFF): 文件上传/解压/simpleperf解析   │   │
│  │ Redis 缓存 | PM2 Cluster (4实例)                  │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│              Java 后端 (Spring Boot 2.7)                 │
│  Controller → Service → DorisService → JdbcTemplate     │
│  文件服务 (trace-fs 挂载) | Aegis 认证                   │
├─────────────────────────────────────────────────────────┤
│           Python Consumer (异步数据处理)                  │
│  Talos MQ 消费 → 解压 → 解析(showmap/ebpf/simpleperf)  │
│  → 生成火焰图HTML → 写入 Doris + FDS                    │
├─────────────────────────────────────────────────────────┤
│                    基础设施                               │
│  Apache Doris (OLAP) | FDS 对象存储 | Redis              │
│  Docker + Kaniko CI/CD | 小米内部云平台                   │
└─────────────────────────────────────────────────────────┘
```

## 技术栈详解

### 前端
- **框架**: Nuxt 4 (Vue 3 + TypeScript), SPA 模式 (hashMode)
- **UI**: Ant Design Vue 4, ECharts 6 (折线图/饼图), D3 Flame Graph
- **状态管理**: Pinia + persistedstate
- **BFF 层**: Nuxt Server API (文件上传/解压/下载, simpleperf 解析)
- **Native 模块**: C++ N-API addon (simpleperf_wrapper) 解析 Android perf.data 二进制文件
- **Perfetto 集成**: iframe 嵌入 Perfetto UI, 通过 postMessage 传递 ArrayBuffer 加载 trace
- **IndexedDB**: 存储火焰图 diff 对比数据，跨页面传递大体积 JSON

### 后端 (Java)
- **框架**: Spring Boot 2.7, Maven 多模块 (web + service)
- **数据库**: Apache Doris (OLAP), JdbcTemplate 直接 SQL
- **连接池**: HikariCP (50 连接, 泄漏检测)
- **文件服务**: trace-fs 挂载, 支持预览/下载大文件 (流式输出)
- **认证**: 小米 Aegis 米盾 SSO

### 后端 (Python Consumer)
- **消息队列**: Talos (小米内部 MQ) 消费上传事件
- **数据解析**: showmap → RSS/PSS 分类统计, ebpf → perfetto trace 转换, simpleperf → 火焰图 HTML
- **数据写入**: 解析结果写入 Doris, 生成文件上传 FDS
- **工具链**: perfetto SDK, pyelftools (ELF 符号解析), cxxfilt (C++ 符号 demangle)

### 运维 & CI/CD
- **容器化**: Docker 多阶段构建, 自定义 base 镜像 (pnpm + cmake + python3 + NDK)
- **CI/CD**: GitLab CI + Kaniko 构建镜像, 推送到小米内部镜像仓库 (micr)
- **部署**: PM2 Cluster 模式 (4 实例), Redis sidecar, 容器内启动脚本编排
- **存储挂载**: trace-fs 文件系统挂载到容器 /home/work/trace-fs

## 核心功能模块

### 1. 内存分析（我主要负责的模块）
- **多轮峰值折线图**: 多设备多迭代 RSS/PSS 峰值趋势, 支持点选对比
- **单轮峰值图**: 选中迭代后展示各 round 的内存变化
- **DiffTable 对比**: 通用差值对比表组件, 支持文件页/匿名页/对象内存/Native堆等多维度
- **Category 筛选**: 每个表格支持分类下拉过滤
- **RSS 文件预览**: 在线查看 showmap 文本, 等宽字体渲染
- **Trace 跳转 Perfetto**: 从内存页面直接跳转 Perfetto 分析 trace 文件
- **火焰图 Diff**: 两个设备的火焰图 JSON 存入 IndexedDB, 跳转 demo 页面做 diff 对比

### 2. 流畅性分析
- simpleperf 采样数据解析 (C++ Native Addon)
- 函数级/库级 CPU 热点分析
- 火焰图可视化 (D3 Flame Graph)

### 3. 功耗分析
- 电池电流曲线
- 每秒指令数趋势
- 多设备对比

### 4. 冷启动分析
- 应用启动耗时统计
- Perfetto trace 分析

## 值得深入展开的技术点

### 1. C++ Native Addon (simpleperf_wrapper)
- 为什么用 C++: Android simpleperf 的 libsimpleperf_report.so 是 C 库, Node.js 无法直接调用
- N-API 桥接: C++ 解析二进制 perf.data, 通过 N-API 返回 JS 对象
- 性能: 比 Python 解析快 10x+, 支持异步非阻塞

### 2. Perfetto 集成
- iframe 嵌入 + postMessage 通信
- ArrayBuffer vs Blob 的坑 (perfetto 需要 ArrayBuffer)
- 多种文件来源的兼容 (Nuxt BFF 本地文件 vs Java 后端 trace-fs)

### 3. DiffTable 通用组件设计
- 支持任意维度的多设备差值对比
- 动态列生成 (设备作为列, 自动计算 diff)
- 可插拔的筛选/搜索/排序/分页

### 4. 数据处理流水线
- 上传 → Talos MQ → Python Consumer → Doris + FDS
- 异步解耦, 支持大文件 (GB 级 trace)
- 多种格式解析: showmap, ebpf, simpleperf, perfetto trace

### 5. 全栈部署
- Docker 镜像: 前端 + Redis + PM2 打包在一个容器
- CI/CD: GitLab CI → Kaniko 构建 → 推送镜像仓库 → 容器平台部署
- 多环境: dev proxy → staging → production

## 项目亮点

1. **独立完成全栈**: 从前端 Vue 组件到后端 Java API, 从 Python 数据解析到 Docker 部署, 一个人搞定完整链路
2. **跨语言技术栈**: TypeScript + Java + Python + C++, 每层选择最合适的语言
3. **性能优化意识**: C++ Native Addon 替代 Python 解析, PM2 Cluster 多实例, Redis 缓存, Doris OLAP 引擎
4. **工程化完整**: ESLint + Prettier + Husky + CI/CD + Docker, 不是 demo 级别的项目
