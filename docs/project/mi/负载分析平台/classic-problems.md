# 经典问题与解决方案

## 目录

- [一、前端经典问题](#一前端经典问题)
  - [1.1 大数据量渲染卡顿](#11-大数据量渲染卡顿)
  - [1.2 ECharts 交互状态丢失](#12-echarts-交互状态丢失)
  - [1.3 跨域文件访问 (CORS)](#13-跨域文件访问-cors)
  - [1.4 iframe 跨域通信](#14-iframe-跨域通信)
  - [1.5 provide/inject 跨组件状态共享](#15-provideinject-跨组件状态共享)
- [二、后端经典问题](#二后端经典问题)
  - [2.1 大文件上传限制](#21-大文件上传限制)
  - [2.2 数据库扁平行 → 嵌套结构转换](#22-数据库扁平行--嵌套结构转换)
  - [2.3 动态 SQL 拼接与 SQL 注入防护](#23-动态-sql-拼接与-sql-注入防护)
  - [2.4 文件服务安全](#24-文件服务安全)
  - [2.5 消息驱动的异步处理](#25-消息驱动的异步处理)
  - [2.6 Doris Stream Load 重定向认证丢失](#26-doris-stream-load-重定向认证丢失)
- [三、全栈 / 架构经典问题](#三全栈--架构经典问题)
  - [3.1 多进程重复计算](#31-多进程重复计算)
  - [3.2 双文件来源的统一访问](#32-双文件来源的统一访问)
  - [3.3 双存储系统并存](#33-双存储系统并存)
  - [3.4 认证体系跨层传递](#34-认证体系跨层传递)
  - [3.5 前后端 API 契约](#35-前后端-api-契约)
- [四、运维 / 部署经典问题](#四运维--部署经典问题)
  - [4.1 复杂环境的一致性](#41-复杂环境的一致性)
  - [4.2 容器内多服务编排](#42-容器内多服务编排)
  - [4.3 CI 环境无法运行 Docker](#43-ci-环境无法运行-docker)
  - [4.4 大文件构建 OOM](#44-大文件构建-oom)
  - [4.5 容器文件系统不持久](#45-容器文件系统不持久)

---

## 一、前端经典问题

### 1.1 大数据量渲染卡顿

**问题**: 火焰图 Diff 页面，两份 ParseResult 各几十 MB，几万个函数，全部渲染到 DOM 页面直接卡死。

**解决方案**: IndexedDB 当客户端数据库用。
- 分析结果写入 IndexedDB（支持索引）
- 表格分页查询（offset + limit），每次只渲染 50 条
- 排序、搜索走 IndexedDB 索引，不在内存里全量排序
- 跨页面传递也走 IndexedDB（localStorage 有 5MB 限制）

**经典模式**: 虚拟化 / 分页 / 客户端数据库

### 1.2 ECharts 交互状态丢失

**问题**: 用户在折线图上 zoom 后点选数据点，Vue 响应式更新 option 会重置 zoom 状态。

**解决方案**: 绕过 Vue 响应式，直接操作 ECharts 实例。
```
// 从 getOption() 获取当前配置（含 zoom 状态），不用 Vue ref
const currentOption = echartRef.getOption();
// setOption 第二参数 false = 合并模式，保留 zoom
echartRef.setOption({ series }, false);
```

**经典模式**: 命令式操作 vs 声明式渲染的冲突处理

### 1.3 跨域文件访问 (CORS)

**问题**: 浏览器直传 FDS 预签名 URL 时，PUT 方法触发 CORS 预检（OPTIONS），FDS 返回的 CORS 头不完整导致失败。

**解决方案**:
- 预签名签名和请求的 Content-Type 必须一致
- PUT 方法无法避免 OPTIONS 预检（不是简单请求）
- FDS 已配置 CORS 允许（OPTIONS 204），实际问题是签名不匹配

**经典模式**: CORS 预检机制、预签名 URL 签名校验

### 1.4 iframe 跨域通信

**问题**: Perfetto UI 嵌入 iframe，需要把 trace 文件数据传给它。

**解决方案**: `postMessage` + `ArrayBuffer`。
- Perfetto 需要 `ArrayBuffer`，不是 `Blob`（踩坑：`fetch().blob()` 返回 Blob，Perfetto 解析失败报 `Failed assertion`）
- 通过 URL 参数 `fullPath` 兼容两种文件来源（BFF 本地 vs Java 后端 trace-fs），向后兼容

**经典模式**: iframe postMessage 通信、二进制数据格式兼容

### 1.5 provide/inject 跨组件状态共享

**问题**: 内存页面顶部切换 RSS/PSS 指标，所有子组件（图表、表格、对比表）都要响应。

**解决方案**: `provide/inject` + `ref`。
```
// 父组件 provide 一个 ref
const metric = provideMemoryMetric(); // ref('rss')
// 任意深度的子组件 inject 同一个 ref
const metric = useMemoryMetric();
```

**经典模式**: 依赖注入、页面级状态共享（比 Pinia 轻量，比 props 层层传递简洁）

## 二、后端经典问题

### 2.1 大文件上传限制

**问题**: FDS 单次 PUT 限制 5GB，11GB 文件返回 413。

**解决方案**: Multipart Upload（分片上传）。
- 后端 3 个接口：init → batchPresign → complete
- 前端 64MB/片串行上传（FDS 要求按顺序，不支持并发）
- complete 内部合并分片 + 通知 Talos，不需要前端再调 callback

**经典模式**: 分片上传、预签名 URL、对象存储 MPU 协议

### 2.2 数据库扁平行 → 嵌套结构转换

**问题**: Doris 返回扁平行（一行一个 category），前端需要嵌套结构（一个设备包含多个 category 的 map）。

**解决方案**: Service 层分组聚合。
```java
// 按 (iter, device, round) 分组
Map<String, List<PO>> grouped = poList.stream()
    .collect(Collectors.groupingBy(po -> po.getIter() + "_" + po.getDevice()));
// 每组聚合为嵌套 VO
vo.setCategories(group → Map<category, rss>);
```

**经典模式**: 行转列、分组聚合、PO → VO 转换

### 2.3 动态 SQL 拼接与 SQL 注入防护

**问题**: 多设备多轮次过滤，设备数量不固定，SQL 条件动态变化。

**解决方案**: `StringBuilder` + 参数化查询。
```java
sql.append(" AND (");
for (DeviceFilter filter : devices) {
    sql.append("(device = ? AND iter = ?)");
    params.add(filter.getDevice());  // 参数化，防注入
    params.add(filter.getIter());
}
sql.append(")");
```

**经典模式**: 动态 SQL、参数化查询防注入

### 2.4 文件服务安全

**问题**: Java 后端提供文件预览/下载接口，用户传入文件路径，可能路径穿越攻击。

**解决方案**:
```java
if (path.contains("..")) {
    response.sendError(403, "非法路径");
    return;
}
File file = new File(TRACE_FS_BASE, path); // 限制在 trace-fs 目录下
```

**经典模式**: 路径穿越防护、文件访问白名单

### 2.5 消息驱动的异步处理

**问题**: 数据解析耗时 10-30 分钟，同步处理会阻塞上传接口。

**解决方案**: Talos MQ 异步解耦。
```
上传接口秒级返回 → MQ 通知 → Consumer 异步解析 → 写入 Doris
前端轮询 DfpFileRecord.status 获取解析进度
```

**经典模式**: 消息队列解耦、异步任务、状态轮询

### 2.6 Doris Stream Load 重定向认证丢失

**问题**: Python 向 Doris FE 发 PUT 请求写数据，FE 返回 307 重定向到 BE，但 `requests` 库跟随重定向时不带 auth header。

**解决方案**: 关闭自动重定向，手动处理。
```python
response = requests.put(fe_url, data=f, allow_redirects=False)
if response.status_code in (301, 302, 307):
    requests.put(response.headers['Location'], data=f, auth=auth)  # 重新带认证
```

**经典模式**: HTTP 重定向认证丢失、手动重定向处理

## 三、全栈 / 架构经典问题

### 3.1 多进程重复计算

**问题**: PM2 Cluster 4 个进程，同一个 simpleperf 解析请求可能被不同进程接收，导致重复计算浪费资源。

**解决方案**: Redis 分布式锁 + Pub/Sub。
```
进程 A: SET NX 获取锁 → 执行解析 → PUBLISH 完成
进程 B: SET NX 失败 → SUBSCRIBE 等待 → 收到通知 → 读缓存
锁带 600 秒 TTL 防死锁
```

**经典模式**: 分布式锁、Pub/Sub 通知、幂等性

### 3.2 双文件来源的统一访问

**问题**: 文件有两个来源——Nuxt BFF 本地 `./data/` 和 Java 后端 `trace-fs` 挂载，不同模块需要访问不同来源。

**解决方案**: URL 参数 `fullPath` 区分。
```
无 fullPath → Nuxt BFF /api/download (本地文件)
有 fullPath → Java /dfp-api/memory/file/preview (trace-fs)
```

**经典模式**: 适配器模式、向后兼容的参数扩展

### 3.3 双存储系统并存

**问题**: FDS（老系统）和 S3/JuiceFS（新系统）并存，上传链路不统一。

**解决方案**: 暂时并存，按场景分流。
- FDS：线上主链路（上传 → Talos → Consumer）
- S3/JuiceFS：dev 分支新链路（上传 → BFF 解压）
- 后续统一迁移到 S3

**经典模式**: 渐进式迁移、双写/双读过渡

### 3.4 认证体系跨层传递

**问题**: 用户认证信息从 Aegis SSO → Nuxt BFF → Java 后端，每层的认证方式不同。

**解决方案**: 分层认证。
- BFF 层：从 `x-proxy-userdetail` header 解析（RSA-SHA256 签名验证）
- Java 后端：Aegis Filter 拦截，IGNORE_URL 白名单
- 开发环境：硬编码 mock 数据绕过

**经典模式**: SSO 集成、分层认证、开发环境 mock

### 3.5 前后端 API 契约

**问题**: 19 个内存分析接口，前后端需要对齐数据格式。

**解决方案**: 统一响应格式 + TypeScript 类型定义。
```typescript
// 前端定义接口类型
interface ApiResponse<T> {
  code: number;
  message: string;
  entity: T;  // 注意：后端用 entity 不是 data
}
```

**经典模式**: API 契约、类型安全、前后端协作规范

## 四、运维 / 部署经典问题

### 4.1 复杂环境的一致性

**问题**: 运行环境需要 Node.js + cmake + NDK + Python + Redis，手动装版本不一致。

**解决方案**: Docker 镜像封装。
- base 镜像预装编译工具链（几个月更新一次）
- 应用镜像基于 base 构建（每次 CI 5 分钟）
- `--frozen-lockfile` 保证依赖一致

**经典模式**: Docker 镜像分层、环境即代码

### 4.2 容器内多服务编排

**问题**: 一个容器需要跑 Nuxt 应用（PM2 × 4）+ Redis。

**解决方案**: 启动脚本编排。
```bash
redis-server --daemonize yes
until redis-cli ping; do sleep 1; done  # 等待就绪
exec pnpm run server                    # exec 让 PM2 成为 PID 1
```

**经典模式**: sidecar 模式、服务启动顺序、PID 1 信号处理

### 4.3 CI 环境无法运行 Docker

**问题**: GitLab CI Runner 本身是容器，不能在容器里跑 `docker build`（Docker-in-Docker 有安全风险）。

**解决方案**: Kaniko — 无 Docker daemon 的镜像构建工具。

**经典模式**: Kaniko、无特权容器构建

### 4.4 大文件构建 OOM

**问题**: Nuxt build 时 V8 默认内存 1.7GB，项目大了 OOM。

**解决方案**: `ENV NODE_OPTIONS="--max-old-space-size=4096"` 提升到 4GB。

**经典模式**: Node.js 内存调优、V8 堆大小配置

### 4.5 容器文件系统不持久

**问题**: 容器重建后可写层数据丢失，trace 大文件不能放容器内。

**解决方案**: PVC 持久化卷挂载到 `/home/work/trace-fs`。

**经典模式**: K8s PVC、有状态服务的存储设计
