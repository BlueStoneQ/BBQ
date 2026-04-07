# LoadTerminator 架构与核心实现梳理

## 目录

- [全栈分层架构图](#全栈分层架构图)
- [一、项目目录与模块划分](#一项目目录与模块划分)
- [二、架构模块](#二架构模块)
  - [2.1 路由设计](#21-路由设计)
  - [2.2 通信层](#22-通信层)
  - [2.3 认证与权限](#23-认证与权限)
  - [2.4 配置管理](#24-配置管理)
  - [2.5 状态管理](#25-状态管理)
  - [2.6 组件分层策略](#26-组件分层策略)
  - [2.7 BFF 层 (Nuxt Server)](#27-bff-层-nuxt-server)
  - [2.8 存储层](#28-存储层)
  - [2.9 Java 后端分层设计](#29-java-后端分层设计)
  - [2.10 Python Consumer 异步处理架构](#210-python-consumer-异步处理架构)
- [三、功能模块设计](#三功能模块设计)
- [四、核心实现](#四核心实现)
  - [4.1 simpleperf 与 Perfetto — 两个工具的关系](#41-simpleperf-与-perfetto--两个工具的关系)
  - [4.2 C++ Native Addon — simpleperf 解析桥接](#42-c-native-addon--simpleperf-解析桥接)
  - [4.3 PM2 Cluster + Redis 分布式协调](#43-pm2-cluster--redis-分布式协调)
  - [4.4 流式上传与背压控制](#44-流式上传与背压控制)
  - [4.5 大文件分片上传 (MPU)](#45-大文件分片上传-mpu)
  - [4.6 IndexedDB 跨页面大数据传递](#46-indexeddb-跨页面大数据传递)
  - [4.7 Perfetto iframe 通信](#47-perfetto-iframe-通信)
  - [4.8 火焰图实现方案](#48-火焰图实现方案)
- [五、全栈开发全链路](#五全栈开发全链路)
  - [5.1 技术栈纵览](#51-技术栈纵览)
  - [5.2 数据流全链路](#52-数据流全链路)
  - [5.3 Python Consumer 异步数据处理](#53-python-consumer-异步数据处理)
  - [5.4 Docker 与容器化部署](#54-docker-与容器化部署)

---

## 全栈分层架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户浏览器                                 │
│  Vue 3 SPA · ECharts · D3 FlameGraph · Ant Design Vue · Perfetto UI   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─ 前端应用层 (Nuxt 4 + TypeScript) ──────────────────────────────┐  │
│   │                                                                   │  │
│   │  pages/          路由页面 (memory / fluency / power / flamegraph) │  │
│   │  components/     基础组件 → 公共业务组件 → 业务组件 (三层)        │  │
│   │  composables/    可复用逻辑 (provide/inject, hooks)               │  │
│   │  services/       API 通信层 ($fetch → /api/* 或 /dfp-api/*)      │  │
│   │  stores/         Pinia 全局状态 + persistedstate                  │  │
│   │  plugins/        Ant Design Vue / ECharts 注册                    │  │
│   │                                                                   │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                          │ $fetch              │ $fetch                  │
│                          ▼                     ▼                        │
│   ┌─ BFF 层 (Nuxt Nitro · PM2 Cluster × 4) ─────────────────────────┐  │
│   │                                                                   │  │
│   │  middleware/     auth (RSA 签名验签) → gzip → role                │  │
│   │  /api/upload     流式接收 ZIP + 背压控制 + 解压                   │  │
│   │  /api/simpleperf C++ Native Addon 解析 perf.data                  │  │
│   │  /api/download   本地文件服务 (./data/)                           │  │
│   │  /api/preload    FDS 远程文件预加载                               │  │
│   │                                                                   │  │
│   │  ┌─ simpleperf_wrapper (C++ N-API) ┐  ┌─ Redis ───────────────┐  │  │
│   │  │ libsimpleperf_report.so 桥接    │  │ 分布式锁 (SET NX)     │  │  │
│   │  │ Worker 子进程 (8GB/进程)        │  │ Pub/Sub 任务通知      │  │  │
│   │  │ 磁盘缓存 (.raw.db/.msgpack.gz) │  │ 任务状态协调          │  │  │
│   │  └─────────────────────────────────┘  └────────────────────────┘  │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
├─────────────────────── nginx / devProxy ─────────────────────────────────┤
│                          │ /dfp-api/*                                    │
│                          ▼                                               │
│   ┌─ Java 后端 (Spring Boot 2.7) ───────────────────────────────────┐   │
│   │                                                                   │   │
│   │  Controller      19 个内存 API + 文件预览/下载                    │   │
│   │  Service          业务聚合 + VO 转换                              │   │
│   │  DorisService     JdbcTemplate + 动态 SQL 拼接                    │   │
│   │  Config           Aegis SSO · HikariCP 连接池 · CORS              │   │
│   │                                                                   │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                          │ JDBC                  │ FileInputStream        │
│                          ▼                       ▼                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─ 数据处理层 (Python Consumer) ───────────────────────────────────┐  │
│   │                                                                   │  │
│   │  Talos MQ 消费 → 解压 → 多格式解析                               │  │
│   │  showmap → RSS/PSS 分类统计                                       │  │
│   │  ebpf → perfetto trace 转换                                       │  │
│   │  simpleperf → 火焰图 HTML 生成                                    │  │
│   │  Parquet → Doris Stream Load 批量写入                             │  │
│   │                                                                   │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                          │                       │                       │
│                          ▼                       ▼                       │
│   ┌─ 存储层 ─────────────────────────────────────────────────────────┐  │
│   │                                                                   │  │
│   │  Apache Doris (OLAP)     列式分析数据库 · 9+ 张内存表             │  │
│   │  FDS 对象存储             原始 trace / showmap / perf.data        │  │
│   │  trace-fs 挂载            容器内 /home/work/trace-fs              │  │
│   │  Redis                    缓存 · 分布式锁 · Pub/Sub              │  │
│   │  IndexedDB (浏览器)       火焰图 Diff 跨页面数据传递              │  │
│   │                                                                   │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─ 基础设施层 ─────────────────────────────────────────────────────┐  │
│   │                                                                   │  │
│   │  Docker + 自定义 base 镜像 (pnpm + cmake + python3 + NDK)        │  │
│   │  GitLab CI + Kaniko 构建 → micr 镜像仓库 → 容器平台部署          │  │
│   │  PM2 Cluster (4 实例 · 8GB/实例) + Redis sidecar                 │  │
│   │  多环境: dev (devProxy) → staging → production                    │  │
│   │                                                                   │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 一、项目目录与模块划分

```
load-terminator-fullstack/
├── load-terminator/                    # 前端 + BFF (Nuxt 4)
│   ├── app/
│   │   ├── pages/                      # 路由页面 (文件系统路由)
│   │   ├── components/                 # 组件 (公共 + 业务)
│   │   ├── composables/                # 可复用逻辑 (provide/inject, hooks)
│   │   ├── services/                   # API 通信层
│   │   ├── stores/                     # Pinia 全局状态
│   │   ├── utils/                      # 工具函数
│   │   ├── plugins/                    # 插件注册 (Ant Design Vue 等)
│   │   ├── config/                     # 菜单/路由/业务配置
│   │   └── axios/                      # HTTP 客户端封装
│   ├── server/                         # BFF 层 (Nuxt Nitro)
│   │   ├── api/                        # 服务端 API 路由
│   │   ├── services/                   # 服务端业务逻辑
│   │   └── middleware/                 # 认证/压缩/权限中间件
│   ├── simpleperf_wrapper/             # C++ Native Addon
│   ├── Dockerfile                      # 容器构建
│   └── ecosystem.config.cjs            # PM2 部署配置
│
├── load-terminator-backend/
│   ├── dfp_server/                     # Java 后端 (Spring Boot)
│   │   ├── dfp-server-web/             #   Controller + Config
│   │   └── dfp-server-service/         #   Service + DAO + Model
│   └── dfp-consumer-python/            # Python 异步消费者
│       └── src/dfp/
│           ├── consumer/               #   MQ 消费入口
│           ├── services/               #   数据处理 + DB 写入
│           └── memparse/               #   二进制解析工具集
└── docs/
```

## 二、架构模块

### 2.1 路由设计

采用 Nuxt 文件系统路由，按业务域划分目录，动态路由 `[project]` 承载项目维度：

```
pages/
├── memory/[project]/          # 内存分析 (常规 + aging)
│   ├── index.vue              #   常规内存
│   └── aging.vue              #   aging 内存
├── fluency/[project]/         # 流畅性分析
├── powerconsumption/[project]/ # 功耗分析
├── coldstart/[project]/       # 冷启动分析
├── flamegraph/                # 火焰图 (独立入口，不依赖 project)
│   ├── index.vue              #   在线解析
│   └── demo.vue               #   Diff 对比 (从 IndexedDB 读数据)
├── perfetto/                  # Perfetto trace 查看器
└── admin/                     # 后台管理
```

菜单路由通过配置映射，根据后端返回的 `category + test_type` 动态决定跳转目标：

```typescript
// config/menuconfig.ts
export const menuPath: Record<string, string> = {
  '性能-CPU':  '/coldstart/${project}/average',
  '性能-内存': '/coldstart_memory/${project}/multi_memory_peak',
  '性能-滑动': '/fluency/${project}/average',
  '功耗-CPU':  '/powerconsumption/${project}',
  '内存-boot': '/memory/${project}',
  '内存-aging': '/memory/${project}/aging',
};
```

SPA 模式 + hashMode，部署时不需要服务端路由配置：
```typescript
// nuxt.config.ts
router: { options: { hashMode: true } }
```

### 2.2 通信层

项目有两套通信路径，分别对应两个后端：

```
前端 ──→ /api/*       ──→ Nuxt BFF (同进程，文件操作/simpleperf 解析)
前端 ──→ /dfp-api/*   ──→ Java 后端 (数据库查询/文件服务)
```

**Nuxt BFF 通信**: 前端直接调用 `$fetch('/api/...')`，Nuxt 内部路由，无跨域。

**Java 后端通信**: 封装为 Service 对象，环境感知的 BASE_URL：

```typescript
// services/memory-api.ts
const BASE_URL =
  import.meta.env.VITE_MEMORY_API_MODE === 'local'
    ? 'http://localhost:8090/dfp-api/memory'  // 本地联调直连
    : '/dfp-api/memory';                       // 线上走代理

export const memoryApi = {
  async getItersPeakRss(project: string) {
    return await $fetch<ApiResponse<Data[]>>(`${BASE_URL}/iters-peak-rss`, {
      params: { project },
    });
  },
  // ... 19 个接口
};
```

开发环境通过 Nuxt devProxy 转发，线上由 nginx 转发：
```typescript
// nuxt.config.ts → nitro.devProxy
'/dfp-api': {
  target: 'https://test.loadterminator.mioffice.cn/dfp-api',
  changeOrigin: true,
},
```

**HTTP 客户端**: axios 封装统一错误处理，拦截器自动弹出错误提示：
```typescript
// axios/index.ts
axiosInstance.interceptors.response.use(undefined, (error) => {
  AntdMessage.error(`请求错误: ${getErrorMessage(response)}，状态码: ${response.status}`);
  return Promise.reject(error);
});
```

### 2.3 认证与权限

两层认证体系：

**BFF 层 — 小米 Aegis SSO**：Nuxt middleware 拦截所有请求，从 `x-proxy-userdetail` header 解析用户信息（RSA-SHA256 签名验证）：

```typescript
// server/middleware/auth.ts
export default defineEventHandler(async event => {
  const oriUserInfo = headers['x-proxy-userdetail'];
  const userInfo = verifySign(oriUserInfo, publicKey); // RSA-SHA256 验签
  event.context.userInfo = {
    ...JSON.parse(userInfo),
    permissions: await adminService.getRoleById(username),
  };
});
```

多环境公钥配置（prod/test/各域名独立公钥），开发环境用硬编码 mock 数据绕过。

**Java 后端 — Aegis Filter**：Spring Boot Filter 拦截，配置 IGNORE_URL 白名单：
```java
registrationBean.addInitParameter("IGNORE_URL", "/dfp-api/pmc/callback/*");
```

**权限模型**: RBAC，角色存储在 lowdb（JSON 文件数据库），支持 ADMIN / UPDATE / READ 三级。

### 2.4 配置管理

| 配置类型 | 位置 | 说明 |
|---------|------|------|
| 环境变量 | `.env` / 容器 env | `VITE_MEMORY_API_MODE`, `REDIS_HOST`, `CAS_COOKIE` |
| 菜单路由映射 | `config/menuconfig.ts` | `category+test_type` → 页面路径 |
| devProxy | `nuxt.config.ts` | 开发环境 API 代理 |
| PM2 部署 | `ecosystem.config.cjs` | 集群实例数、内存限制、日志路径 |
| 认证公钥 | `middleware/auth.ts` | 按域名/环境区分的 RSA 公钥 |

运行时配置通过 Nuxt `runtimeConfig` 注入：
```typescript
runtimeConfig: { public: { casCookie: process.env.CAS_COOKIE } }
```

### 2.5 状态管理

三层状态策略：

| 层级 | 方案 | 场景 |
|------|------|------|
| 全局 | Pinia + persistedstate | 项目列表、用户信息、侧边栏状态 |
| 跨组件 | provide / inject | RSS/PSS 指标切换（页面级共享） |
| 组件内 | ref / reactive | 表格数据、加载状态 |

provide/inject 示例 — 页面顶部切换 RSS/PSS，所有子组件自动响应：
```typescript
// 父组件 provide
const memoryMetric = provideMemoryMetric(); // ref('rss')
// 任意子组件 inject
const metric = useMemoryMetric(); // 拿到同一个 ref
```

### 2.6 组件分层策略

```
components/
├── proComponent/        # 基础层: ProTable (封装 Ant Table + 搜索/分页/列选择)
├── Echart/              # 基础层: ECharts 封装
├── diff/                # 公共业务层: DiffTable, Trace (跨模块复用)
├── flamegraph/          # 公共业务层: D3 FlameGraph
├── downloadFile/        # 公共业务层: 文件下载 + 进度条
├── memory/              # 业务层: 内存分析专用组件
├── fluency/             # 业务层: 流畅性专用组件
└── power/               # 业务层: 功耗专用组件
```

三层原则：
- **基础层**: 不含业务逻辑，纯 UI 封装，任何项目可复用
- **公共业务层**: 含本项目通用业务逻辑（多设备对比、火焰图），跨模块复用
- **业务层**: 绑定特定分析模块，只在对应 pages 下使用

### 2.7 BFF 层 (Nuxt Server)

Nuxt Nitro 作为 BFF，承担前端无法直接做的事：

| API | 职责 | 为什么放 BFF |
|-----|------|-------------|
| `/api/upload` | 流式接收 ZIP + 解压 | 需要文件系统操作 |
| `/api/simpleperf` | C++ Addon 解析 perf.data | 需要 Native 模块 |
| `/api/download` | 本地文件下载 | 直接读 `./data/` 目录 |
| `/api/preload` | 从 FDS 预加载数据 | 需要服务端网络访问 |
| `/api/userinfo` | 用户信息代理 | 需要 SSO cookie 转发 |

中间件链：`auth → gzip → role → handler`

gzip 中间件对二进制流（`application/octet-stream`）跳过压缩，避免重复压缩：
```typescript
compression({
  threshold: 1024 * 100,  // 100KB 以上才压缩
  filter: (req, res) => {
    if (String(res.getHeader('Content-Type')).includes('application/octet-stream'))
      return false;  // 二进制文件不压缩
    return compression.filter(req, res);
  },
})
```

### 2.8 存储层

| 存储 | 技术 | 用途 |
|------|------|------|
| 结构化数据 | Apache Doris (OLAP) | 内存/功耗/流畅性分析数据，列式存储，适合聚合查询 |
| 原始文件 | FDS 对象存储 + trace-fs 挂载 | trace/showmap/perf.data 等大文件 |
| 缓存 | Redis | 分布式锁、Pub/Sub、simpleperf 解析任务协调 |
| 本地缓存 | 磁盘文件 | simpleperf 解析结果缓存 (.raw.db / .msgpack.gz) |
| 前端持久化 | IndexedDB | 火焰图 Diff 数据跨页面传递 |
| 配置存储 | lowdb (JSON 文件) | 用户角色权限 |

Doris 选型理由：兼容 MySQL 协议（降低学习成本），MPP 架构适合多维度聚合分析，Stream Load 支持 Parquet 批量写入。

### 2.9 Java 后端分层设计

三层架构，职责清晰：

```
Controller (dfp-server-web)
    │  接收 HTTP 请求，参数校验，统一异常处理
    │  GET → 简单查询 (project 维度)
    │  POST + RequestBody → 多设备过滤查询 (devices 维度)
    ▼
Service (dfp-server-service)
    │  业务聚合: PO 分组 → 分类数据聚合 → VO 转换
    │  例: queryAllDeviceRoundRss 返回扁平行 → 按 (iter,device,round) 分组
    │       → 聚合 categories/pssCategories/categoryCounts → AllDeviceRoundRssVO
    ▼
DorisService (infra/doris)
    │  数据访问: JdbcTemplate + 动态 SQL 拼接
    │  多设备过滤: AND (device=? AND iter=? [AND round=?]) OR ...
    │  RowMapper: ResultSet → PO 对象
    ▼
Apache Doris (OLAP)
    9+ 张内存分析表, 列式存储
```

**API 设计决策**：

19 个内存分析接口，按查询复杂度分两类：
- GET 接口（接口 1-6）：只需 `project` 参数，返回全量数据，前端做过滤。适合数据量小、需要全局视图的场景（如峰值趋势图）。
- POST 接口（接口 7-19）：需要 `project + devices[]` 参数，后端做多设备过滤。适合数据量大、需要精确查询的场景（如对象级 diff）。

```java
// GET — 简单查询，前端过滤
@GetMapping("/iters-peak-rss")
public ApiResponse<List<ItersPeakRssVO>> getItersPeakRss(@RequestParam("project") String project)

// POST — 多设备过滤，后端过滤
@PostMapping("/round-object-diff")
public ApiResponse<List<ObjectDiffVO>> getRoundObjectDiff(@RequestBody ColdstartMemoryReq req)
// req = { project, devices: [{ device, iter, round }] }
```

**Service 层的核心模式 — 分组聚合**：

Doris 返回的是扁平行（一行一个 category），Service 层按业务维度分组聚合为嵌套结构：

```java
// 输入: [{iter:1, device:"o1", category:"线程栈", rss:100}, {iter:1, device:"o1", category:"匿名页", rss:200}]
// 分组键: iter + "_" + device + "_" + round
Map<String, List<MemoryRoundRss>> grouped = poList.stream()
    .collect(Collectors.groupingBy(po -> po.getIter() + "_" + po.getDevice() + "_" + po.getRound()));

// 输出: { iter:1, device:"o1", categories: {"线程栈":100, "匿名页":200}, totalCount: 300 }
```

这样前端拿到的是结构化的嵌套 JSON，不需要再做分组。

**文件服务设计**：

trace-fs 挂载到容器 `/home/work/trace-fs`，Java 后端提供两个文件接口：
- `/file/preview` — 流式输出，Content-Type 按扩展名推断（JSON/HTML/文本），带 Cache-Control
- `/file/download` — 流式输出，Content-Disposition 强制下载

安全措施：路径穿越检查（`path.contains("..")`），只允许访问 trace-fs 下的文件。

### 2.10 Python Consumer 异步处理架构

消息驱动的异步数据处理管道：

```
Talos MQ (小米内部消息队列)
    │
    ▼
TalosMessageProcessor
    │  消费消息 → JSON 反序列化 → DfpMessage
    ▼
DfpMessageHandler (路由层)
    │  按 message.type 路由到不同 Handler:
    │  ├── UPLOAD  → ReleaseUploadHandler (新项目上传)
    │  ├── CLIP    → ReleaseClipDfpHandler (数据裁剪)
    │  └── DELETE  → ProjectCleanHandler (项目清理)
    ▼
ReleaseUploadHandler
    │  解压 → 识别数据类型 → 分发到具体处理器
    ▼
MemDataProcessService (内存数据处理)
    ├── showmap_rss_main()     → showmap 文本解析 → RSS/PSS 分类统计
    ├── aging_memory_main()    → ebpf 数据 → perfetto trace 转换
    │                          → native heap 解析 → 火焰图 HTML 生成
    └── doris_load_service     → CSV/Parquet → Doris Stream Load 批量写入
```

**为什么用消息队列而不是同步处理？**

一个项目的数据解析可能要 10-30 分钟（GB 级 trace 文件），同步处理会阻塞上传接口。MQ 解耦后：
- 上传接口秒级返回，前端轮询解析状态
- Consumer 可以独立扩缩容
- 失败可重试，不影响上传链路

**Doris Stream Load 的设计考量**：

```python
# 为什么用 Parquet 而不是 CSV？
# 1. Doris 是列式存储，Parquet 也是列式格式，写入效率最高
# 2. Parquet 自带类型信息，不需要 Doris 做类型推断
# 3. 压缩率高，网络传输量小

# 为什么要手动处理重定向？
# Doris Stream Load 的流程: Client → FE (路由) → 307 → BE (实际写入)
# Python requests 默认跟随重定向时不会带上 auth header，需要手动处理
response = requests.put(fe_url, data=f, allow_redirects=False)
if response.status_code in (301, 302, 307):
    requests.put(response.headers['Location'], data=f, auth=auth)  # 重新带上认证
```

## 三、功能模块设计

| 模块 | 页面路由 | 核心能力 | 数据来源 |
|------|---------|---------|---------|
| 内存分析 | `/memory/[project]` | 多轮峰值趋势、分类对比、对象/堆分析、Trace 跳转 | Doris 9 张表 + trace-fs |
| 流畅性 | `/fluency/[project]` | CPU 热点分析、函数/库级聚合、火焰图 | C++ Addon 解析 perf.data |
| 功耗 | `/powerconsumption/[project]` | 电流曲线、指令吞吐、多设备对比 | Doris battery/instrs 表 |
| 冷启动 | `/coldstart/[project]` | 启动耗时、Perfetto trace 分析 | Doris + Nuxt BFF 本地文件 |
| 火焰图 | `/flamegraph` | 在线解析、时间过滤、Diff 对比 | C++ Addon + IndexedDB |
| Perfetto | `/perfetto` | iframe 嵌入 Perfetto UI | Java 文件服务 / Nuxt BFF |

## 四、核心实现

### 4.1 simpleperf 与 Perfetto — 两个工具的关系

项目涉及两个 Android 性能分析工具，经常被混淆，但它们解决完全不同的问题：

| | simpleperf | Perfetto |
|---|---|---|
| 做什么 | CPU 采样（每隔一段时间记录 CPU 在执行哪个函数） | 系统 trace（记录时间轴上的系统事件） |
| 产出文件 | `perf.data`（二进制） | `.perfetto-trace`（二进制） |
| 分析方式 | 按函数聚合采样次数 → 火焰图 | 时间轴可视化 → 拖拽查看事件 |
| 回答的问题 | **"CPU 时间花在哪了"** | **"这段时间系统在干什么"** |
| 典型发现 | 某个函数占了 30% CPU | 某个时间段被其他进程抢占了 CPU |

在项目中的位置：

```
一次测试产出:
├── perf.data          → simpleperf 采集 → C++ Addon 解析 → 火焰图
├── .perfetto-trace    → Perfetto 采集   → iframe 嵌入 Perfetto UI 查看
└── showmap.txt        → 内存快照        → Python 解析 → 内存分析表格
```

互补关系：用户先看火焰图定位热点函数（simpleperf），再用 Perfetto 看那个时间段的系统上下文（为什么慢——被抢占？等 Binder？GPU 卡了？）。

### 4.2 C++ Native Addon — simpleperf 解析桥接

Android simpleperf 的 `perf.data` 是二进制格式，官方只提供 C 库 `libsimpleperf_report.so`。用 C++ N-API 桥接到 Node.js：

```cpp
// wrapper.cc — 核心: 遍历采样点，提取 symbol + callchain
ReportLibHandle handle = CreateReportLib();
SetRecordFile(handle, recordFile.c_str());
while ((sample = GetNextSample(handle)) != nullptr) {
  SampleStruct *s = static_cast<SampleStruct *>(sample);
  SymbolStruct *sym = GetSymbolOfCurrentSample(handle);   // 函数名、库名
  CallChainStructure *chain = GetCallChainOfCurrentSample(handle); // 调用栈
}
```

大文件用 Worker 子进程解析，不阻塞主线程：
```typescript
const worker = fork(workerPath, [], {
  execArgv: ['--max-old-space-size=8192'],
});
```

### 4.3 PM2 Cluster + Redis 分布式协调

4 个 Node.js 进程共享同一个 Redis，用 `SET NX` 原子锁避免重复计算：

```typescript
// 获取锁: NX=不存在才设置, EX=600秒过期防死锁
const result = await redis.set(`simpleperf:task:${key}`, data, 'EX', 600, 'NX');
// 完成后 Pub/Sub 通知等待的进程
await redis.publish(`simpleperf:complete:${key}`, 'done');
```

进程 A 获取锁执行 → 进程 B 获取锁失败 → SUBSCRIBE 等待 → 收到通知读缓存。

### 4.4 流式上传与背压控制

GB 级 ZIP 不能一次性读入内存，用 Node.js Stream 背压：

```typescript
event.node.req.on('data', (chunk) => {
  if (!writeStream.write(chunk)) {
    event.node.req.pause();           // 写缓冲区满 → 暂停读
    writeStream.once('drain', () => event.node.req.resume()); // 排空 → 恢复
  }
});
```

### 4.5 大文件分片上传 (MPU)

**问题**: 用户上传 11GB 的测试数据 ZIP 包，FDS 单次 PUT 限制 5GB，返回 413 Request Entity Too Large。

**排查过程**:
1. 浏览器 Console 先报 CORS 错误 → 误导方向
2. 仔细看 Network 面板发现底层是 `413 (Request Entity Too Large)` → FDS 拒绝了
3. 413 响应没带 CORS 头，所以浏览器又报了 CORS → 根因是 413，不是 CORS

**方案选择**:

项目里有两套对象存储：FDS（线上主链路）和 S3/JuiceFS（dev 分支新链路）。

S3 版本（dev 分支已有实现）：
```
一次后端请求返回所有 URL（init + presign + completeUrl + abortUrl）
前端并发 6 个 PUT → 前端直接 POST completeUrl 合并（XML body）
优点: 并发上传快，complete 不走后端
```

FDS 版本（线上需要）：
```
后端 3 个接口: init → batchPresign → complete
前端串行 PUT（FDS 要求按 partNumber 顺序上传，不支持乱序）
complete 走后端（FDS SDK 需要 UploadPartResultList 对象，不能用预签名 URL）
后端 complete 内部直接通知 Talos，不需要前端再调 callback
```

**FDS vs S3 的关键差异（踩坑总结）**:

| | FDS | S3 |
|---|---|---|
| 分片顺序 | 必须按 partNumber 顺序上传 | 支持乱序并发 |
| complete 方式 | 必须走后端 SDK 调用 | 可以用预签名 URL + XML body |
| 预签名签名 | 包含 Content-Type，请求必须匹配 | 更宽松 |
| 并发上传 | 不支持（400 Bad Request） | 支持（6 并发） |

**实现**:

后端（Java）— 3 个接口：
```java
// 1. init: 获取 uploadId
@PostMapping("/multipart/init")
InitMultipartUploadResult result = fdsClient.initMultipartUpload(bucket, fileName);

// 2. presign: 批量生成分片预签名 URL
@PostMapping("/multipart/presign")
for (int i = 1; i <= partCount; i++) {
    List<String> subResources = Arrays.asList("uploadId=" + uploadId, "partNumber=" + i);
    URI uri = fdsClient.generatePresignedUri(bucket, fileName, subResources, expiration, HttpMethod.PUT);
}

// 3. complete: 合并分片 + 通知 Talos（复用 callback 逻辑）
@PostMapping("/multipart/complete")
fdsClient.completeMultipartUpload(bucket, fileName, uploadId, null, partList);
// 创建 DfpFileRecord → talosService.sendMessage() → 返回 projectId
```

前端 — 入口函数按文件大小分流：
```typescript
const MULTIPART_THRESHOLD = 4 * 1024 * 1024 * 1024; // 4GB

if (file.size > MULTIPART_THRESHOLD) {
  await multipartUpload(file, controller);  // FDS MPU 串行
} else {
  await singleUpload(file, controller);     // 原有单次 PUT
}
```

分片上传核心（串行，64MB/片）：
```typescript
const PART_SIZE = 64 * 1024 * 1024; // 64MB，2 的幂次对齐

// 1. init → uploadId
// 2. presign → URL list
// 3. 串行上传（FDS 要求按顺序）
for (let i = 0; i < partCount; i++) {
  const blob = file.slice(i * PART_SIZE, Math.min((i + 1) * PART_SIZE, file.size));
  const res = await fetch(presignedUrls[i], { method: 'PUT', body: blob });
  parts.push({ partNumber: i + 1, etag: res.headers.get('ETag'), partSize: ... });
}
// 4. complete → 后端合并 + 通知 Talos
```

**设计决策**:
- 64MB 切片：2 的幂次对齐，网络传输和存储系统底层按 2 的幂次分块，避免跨边界开销
- 串行而非并发：FDS 限制，不是设计选择。如果迁移到 S3 可以改回并发 6
- complete 合并 callback：减少一次前端请求，后端原子操作（合并 + 记录 + 通知）
- 向后兼容：< 4GB 走原有单次 PUT，不影响现有功能

### 4.6 IndexedDB 跨页面大数据传递

火焰图 Diff 需要传递两份几十 MB 的 JSON，localStorage 放不下：

```typescript
await savePerfDataToDemo(demoId, baselineData, comparisonData); // 存 IndexedDB
window.open(`/#/flamegraph/demo?id=${demoId}`, '_blank');        // 新页面按 ID 读取
```

### 4.7 Perfetto iframe 通信

iframe 嵌入 Perfetto UI，通过 `postMessage` 传递 trace 数据。关键: Perfetto 需要 `ArrayBuffer`，不是 `Blob`：

```typescript
const buffer = await res.arrayBuffer();
iframe.contentWindow.postMessage({ perfetto: { buffer, title: file } }, '*');
```

通过 URL 参数 `fullPath` 兼容两种文件来源（Nuxt BFF 本地 vs Java 后端 trace-fs），向后兼容。

### 4.8 火焰图实现方案

火焰图是项目中技术复杂度最高的模块，涉及 C++ 解析 → 服务端缓存 → 前端渲染 → Diff 对比的完整链路。

**为什么不直接用 Perfetto 看火焰图？**

Perfetto 是 trace 分析工具，擅长时序分析，但不擅长 CPU 采样数据的聚合对比。我们需要的是：按函数/库聚合采样计数 → 多设备 diff → 交互式搜索。这是 simpleperf 火焰图的场景，Perfetto 做不了。

**整体链路：**

```
perf.data (二进制)
    │
    ▼  C++ N-API Addon (wrapper.cc)
    │  遍历采样点 → 提取 symbol + callchain
    │  Worker 子进程 (8GB 内存隔离)
    ▼
原始采样数据 (.raw.db 磁盘缓存)
    │
    ▼  TypeScript 聚合层 (RecordData.ts)
    │  按 进程 → 线程 → 库 → 函数 聚合
    │  生成调用树 (CallNode) + 函数映射表
    ▼
ParseResult JSON (msgpack 压缩传输)
    │
    ▼  前端渲染层
    │
    ├── 单设备模式 (flamegraph/index.vue)
    │   CallNode → useFlameGraphData 转换 → D3 Flame Graph 渲染
    │
    └── Diff 对比模式 (flamegraph/demo.vue)
        两份 ParseResult → IndexedDB 存储 → 按函数名聚合对比
        → 叶子/非叶子函数分类 → 差值表格 + 跳转单设备火焰图
```

**D3 Flame Graph 渲染层** (`FlameGraph.vue`)：

不是简单的 `d3-flame-graph` 调用，做了大量定制：

```typescript
// 1. 自定义颜色映射 — 按库名着色，一眼区分系统库/应用库/ART
chart.setColorMapper((d) => {
  if (d.highlight) return HIGHLIGHT_COLOR;
  return getColorByLibrary(d.data.data.library); // 按 .so 库名映射颜色
});

// 2. SVG 缩放 — d3.zoom 包裹 flamegraph，支持拖拽平移 + 键盘缩放
const zoom = d3.zoom()
  .scaleExtent([0.5, 10])
  .filter(event => event.type !== 'wheel')  // 禁用滚轮缩放
  .on('zoom', event => {
    zoomGroup.attr('transform', constrainTransform(event.transform, bounds));
  });

// 3. 滚轮改为上下平移（火焰图很高，需要纵向滚动）
svgElement.addEventListener('wheel', (event) => {
  const newTransform = d3.zoomIdentity
    .translate(currentTransform.x, currentTransform.y - event.deltaY * 1.5)
    .scale(currentTransform.k);
  svg.call(zoom.transform, constrainTransform(newTransform, bounds));
});

// 4. 导航历史 — 点击节点 zoom in 后可以 ← → 回退前进
chart.onClick(d => addToNavigationHistory(d));
```

**为什么用 D3 Flame Graph 而不是 ECharts？**

ECharts 没有原生火焰图支持。d3-flame-graph 是 Netflix 开源的专业火焰图库，支持 zoom、search、tooltip、delta diff 等特性。但它的交互能力有限（没有缩放平移），所以我们在外层包了一层 d3.zoom。

**Diff 对比的设计** (`demo.vue`)：

两份 ParseResult 数据量各几十 MB（几万个函数），不能全部渲染到 DOM。

```
方案: IndexedDB 当数据库用
  1. 分析时: 两份数据按 libName|functionName 聚合 → 计算 diff → 写入 IndexedDB
  2. 渲染时: 从 IndexedDB 分页查询 (offset + limit) + 排序 + 搜索过滤
  3. 跳转时: 点击函数名 → 带 demoId + dataType 跳转到单设备火焰图页面
```

```typescript
// 聚合逻辑: 遍历两份数据的 sampleInfo，按 libName|functionName 聚合
processDeviceData(baselineData, 'baseline', resMap);
processDeviceData(comparisonData, 'comparison', resMap);

// 计算 diff
resMap.forEach((value) => {
  const diffTotal = (value.total.comparison || 0) - (value.total.baseline || 0);
  const diffPercent = baselineTotal !== 0 ? (diffTotal / baselineTotal) * 100 : 0;
  // 区分叶子函数 (self == total) 和非叶子函数
});

// 写入 IndexedDB，分页查询时按 diffTotal 排序
const data = await queryFunctions(dataId, { isLeaf: true }, 'diffTotal', 'desc', offset, pageSize);
```

**为什么用 IndexedDB 而不是内存？** 几万条函数数据 + 多维度索引，放内存会导致页面卡顿。IndexedDB 支持索引查询和游标遍历，分页加载保证 UI 流畅。

**数据传输优化**: BFF → 前端用 msgpack 压缩（比 JSON 小 30-50%），`decode(new Uint8Array(buffer))` 解码。

## 五、全栈开发全链路

### 5.1 技术栈纵览

| 层 | 技术 | 职责 |
|----|------|------|
| 前端 | Nuxt 4 + Vue 3 + TypeScript | SPA, ECharts, D3 FlameGraph, Ant Design Vue |
| BFF | Nuxt Nitro + PM2 Cluster × 4 | 文件上传/解压, simpleperf 解析, Redis 协调 |
| Native | C++ N-API Addon | 桥接 libsimpleperf_report.so |
| 后端 | Spring Boot 2.7 + Java 8 | REST API, 文件服务, Aegis SSO |
| 数据处理 | Python + Talos MQ | showmap/ebpf/simpleperf 解析, Doris 写入 |
| 存储 | Apache Doris (OLAP) | 列式分析数据库, Stream Load |
| 文件 | FDS + trace-fs | 原始 trace/showmap 文件 |
| 缓存 | Redis | 分布式锁, Pub/Sub |
| CI/CD | GitLab CI + Kaniko + Docker | 镜像构建 → micr → 容器平台 |

### 5.2 数据流全链路

```
用户上传 ZIP
    │
    ▼
Nuxt BFF 流式接收 (背压控制) → 解压 → 回调通知
    │                                    │
    ├── 同步: perf.data → C++ Addon     └── 异步: Talos MQ
    │   → 火焰图 JSON → 磁盘缓存              │
    │                                    Python Consumer
    │                                    ├── showmap → RSS/PSS CSV
    │                                    ├── ebpf → perfetto trace
    │                                    └── simpleperf → 火焰图 HTML
    │                                         │
    │                                    Parquet → Doris Stream Load
    │                                    文件 → FDS 对象存储
    │                                         │
    └─────────────────┬──────────────────────┘
                      ▼
              Java 后端 API (19 个查询接口)
                      │
                      ▼
              前端可视化 (ECharts / DiffTable / FlameGraph / Perfetto)
```

### 5.3 Python Consumer 异步数据处理

Talos MQ 消费上传事件，多阶段解析后写入 Doris：

```python
class MemDataProcessService:
    def process(self, project_id, metas):
        showmap_rss_main(device_dir, project_id)     # showmap → 分类统计
        aging_memory_main(device_dir, project_id)     # ebpf/native heap 解析
        doris_service.load_parquet_file(path, table)  # Parquet → Doris
```

Doris Stream Load 处理 FE → BE 重定向：
```python
response = requests.put(fe_url, data=f, headers={"format": "parquet"})
if response.status_code in (301, 302, 307):
    requests.put(response.headers['Location'], data=f, auth=auth)
```

### 5.4 Docker 与容器化部署

#### Docker 核心概念

Docker 解决的根本问题是**"在我机器上能跑"**——把应用和它的整个运行环境打包成一个标准化的交付单元（镜像），在任何地方都能一致地运行。

| 概念 | 类比 | 说明 |
|------|------|------|
| 镜像 (Image) | 安装光盘 | 只读模板，包含 OS + 依赖 + 应用代码 + 配置，可以分发和复用 |
| 容器 (Container) | 运行中的虚拟机（但更轻量） | 镜像的运行实例，有自己的文件系统、网络、进程空间，但共享宿主机内核 |
| Dockerfile | 安装脚本 | 描述如何一步步构建镜像的指令文件 |
| 镜像仓库 (Registry) | 应用商店 | 存储和分发镜像的服务（Docker Hub / 公司内部仓库） |
| 数据卷 (Volume) | 外接硬盘 | 容器销毁后数据不丢失，用于持久化存储 |

Docker vs 虚拟机：虚拟机虚拟整个硬件 + OS（GB 级，分钟级启动），Docker 共享宿主机内核，只隔离进程空间（MB 级，秒级启动）。

#### 本项目为什么需要 Docker

这个项目的运行环境极其复杂：

```
Node.js 22 + pnpm                    # 前端构建和运行
cmake + NDK + libsimpleperf_report.so # C++ Native Addon 编译
Python3                               # 数据解析脚本
Redis                                 # 多进程协调
```

不可能让运维手动在服务器上装这些东西，版本稍有差异 C++ addon 就编译不过。Docker 把整个环境封装成镜像，开发机上能跑的，线上一定能跑。

#### 镜像分层策略

```
┌─────────────────────────────────────────┐
│ 应用镜像 (每次 git push 重新构建)        │  ← 变化频繁
│ COPY 源码 → pnpm install → build        │
├─────────────────────────────────────────┤
│ base 镜像 (load-terminator-base:beta)   │  ← 很少变化
│ pnpm + cmake + python3 + NDK + .so 库   │
├─────────────────────────────────────────┤
│ 操作系统层 (Ubuntu/Debian)               │  ← 几乎不变
└─────────────────────────────────────────┘
```

base 镜像预装了编译工具链，几个月才更新一次。应用镜像基于 base 构建，只需要 `install + build`，CI 构建时间从 20 分钟降到 5 分钟。

#### Dockerfile 解读

```dockerfile
# 1. 基于自定义 base 镜像（已包含 pnpm/cmake/python3/NDK）
FROM micr.cloud.mioffice.cn/load-terminator-base/load-terminator-base:beta

# 2. 安装 Redis（容器内 sidecar 模式）
RUN apt-get update && apt-get install -y redis-server

# 3. 复制源码，安装依赖
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile    # --frozen-lockfile 保证和 lock 文件一致

# 4. 编译 C++ Native Addon（调用 cmake + NDK）
RUN pnpm run build:native

# 5. 构建 Nuxt 应用（产出 .output/ 目录）
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm run build

# 6. 生成启动脚本（先启动 Redis，再启动应用）
RUN echo '#!/bin/bash\n\
redis-server --daemonize yes --maxmemory 512mb --maxmemory-policy allkeys-lru\n\
until redis-cli ping > /dev/null 2>&1; do sleep 1; done\n\
exec pnpm run server\n\
' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 80
CMD ["/app/start.sh"]
```

关键点：
- `--frozen-lockfile`：保证 CI 环境和开发环境依赖完全一致
- `--maxmemory 512mb --maxmemory-policy allkeys-lru`：Redis 内存上限 + LRU 淘汰策略，防止 OOM
- `exec pnpm run server`：`exec` 让 PM2 成为 PID 1 进程，正确接收容器的 SIGTERM 信号实现优雅关闭

#### 容器内多服务编排

```
容器启动
    │
    ▼
start.sh
    ├── 1. redis-server --daemonize yes     # 后台启动 Redis
    ├── 2. until redis-cli ping; do sleep 1  # 等待 Redis 就绪
    └── 3. exec pnpm run server              # PM2 Cluster × 4 实例
                                              # 每实例 8GB 内存
                                              # 监听 80 端口
```

为什么 Redis 放容器内而不是用云 Redis？这个项目的 Redis 只用于同容器内 4 个 PM2 进程之间的协调（分布式锁 + Pub/Sub），数据不需要持久化，也不需要跨容器共享。sidecar 模式最简单，零网络延迟。如果后续多容器扩展，只需改环境变量 `REDIS_HOST` 即可迁移到云 Redis。

#### CI/CD 流水线

```
开发者 git push
    │
    ▼
GitLab CI 触发（.gitlab-ci.yml）
    │
    ▼
Kaniko 构建 Docker 镜像
    │  （Kaniko = 无 Docker daemon 的镜像构建工具，专为 CI 容器环境设计）
    │  （CI 环境本身是容器，不能在容器里跑 Docker daemon，所以不能用 docker build）
    ▼
推送到 micr（小米内部镜像仓库）
    │  镜像 tag: staging-{commit_hash}
    ▼
容器平台拉取镜像，启动容器
    │  平台负责: 调度、健康检查、自动重启、日志收集、域名绑定
    ▼
用户访问 https://test.loadterminator.mioffice.cn
```

开发者不碰服务器，运维不碰代码，Docker 镜像是两者之间的契约。

#### Docker 在不同场景下的价值

| 场景 | 没有 Docker | 有 Docker |
|------|------------|----------|
| 新人入职 | 装 Node/cmake/NDK/Redis 半天 | `docker build` 一条命令 |
| 线上部署 | SSH 到服务器手动操作 | CI 自动构建推送，平台自动部署 |
| 环境不一致 | "我本地能跑啊" | 镜像保证环境完全一致 |
| 回滚 | 找上个版本的代码重新部署 | 拉取上个版本的镜像，秒级回滚 |
| 扩容 | 新机器重新装环境 | 拉取镜像启动新容器 |
| 多环境 | dev/staging/prod 各装一套 | 同一镜像 + 不同环境变量 |

