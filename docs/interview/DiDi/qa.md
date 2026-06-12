# DD Q&A

> 实际被问到的问题 + 准备记录。按方向分组，每个方向 top5 精选问题。
>
> 一定要有指标体系, 监控运维

---

## 目录

- [1. 可观测体系: 优化/指标/稳定性](#1-可观测体系-优化指标稳定性)
  - [1.1 总览（全端速查 + 告警策略）](#11-总览全端速查--告警策略)
  - [1.2 Node.js + Nuxt](#12-nodejs--nuxt)
    - [1.2.1 Node.js 完整监控运维方案](#121-nodejs完整监控运维方案)
  - [1.3 Web 前端](#13-web-前端)
  - [1.4 RN / APK](#14-rn--apk)
  - [1.5 低代码搭建页面](#15-低代码搭建页面)
- [2. Node.js + BFF](#2-nodejs--bff)
  - [2.1 Node.js 服务指标体系](#21-nodejs-服务指标体系)
  - [2.2 BFF 中间层](#22-bff-中间层)
  - [2.3 Node 进程管理与部署](#23-node-进程管理与部署)
  - [2.4 Node 服务稳定性](#24-node-服务稳定性)
  - [2.5 Nuxt 部署方式](#25-nuxt-部署方式)
  - [2.6 Node 探针原理](#26-node-探针原理)
- [3. 微前端](#3-微前端)
- [4. 前端工程化: Vite / Webpack + 开发全链路](#4-前端工程化-vite--webpack--开发全链路--自动化测试)
  - [4.1 ESM 的本质](#41-esm-的本质)
  - [4.2 打包工具选型](#42-打包工具选型2026)
- [5. 自动化测试 + TDD](#5-自动化测试--tdd)
  - [5.1 前端测试体系速查](#51-前端测试体系速查)
  - [5.2 AI + 自动化测试](#52-ai--自动化测试dd-重点)
- [6. LowCode](#6-lowcode)
  - [6.1 布局方案对比选型](#61-布局方案对比选型)
  - [6.2 性能/可用性下限保障](#62-性能可用性下限保障)
- [7. AI: SDD + Harness 工程 + spec模式 + TDD](#7-ai-sdd--harness-工程--spec模式--tdd)
  - [7.1 ReAct Loop 危险命令确认机制](#71-react-loop-危险命令确认机制)
  - [7.2 SDD（Spec-Driven Development）](#72-sddspec-driven-development)
  - [7.3 Harness 质量保障体系](#73-harness-质量保障体系)
- [8. React + TS](#8-react--ts)

---

## 1. 可观测体系: 优化/指标/稳定性

> 高阶视角：任何系统上线都必须回答"它跑得好不好"。没有指标 = 盲人开车。
>
> → **详见 [Node.js 可观测体系](../root/Node/observability.md)**（完整指标 + 探针原理 + 选型 + 落地方案）
>
> → 详见 [性能优化](./engineering/performance.md) / [稳定性](./engineering/stability.md) / [白屏检测](./engineering/blank-screen-detection.md)

### 1.1 总览（全端速查 + 告警策略）

#### 跨端共同的告警策略

| 级别 | 触发条件 | 动作 |
|------|---------|------|
| P0 | 服务不可用 / Crash 率 > 1% / 白屏率 > 5% | 电话 + 自动回滚 |
| P1 | P99 > 3s / 错误率 > 0.5% / 内存持续上涨 | 飞书告警 + 值班处理 |
| P2 | FCP > 2s / CLS > 0.25 / Event Loop Lag > 100ms | 工单 + 排期优化 |

### 1.2 Node.js + Nuxt

**指标**：

| 维度 | 指标 | 含义 | 采集方式 |
|------|------|------|---------|
| **可用性** | Uptime %、5xx 错误率 | 服务是否活着 | 健康检查 + Prometheus |
| **性能** | P50/P95/P99 响应时间、QPS | 快不快 | APM 探针 / perf_hooks |
| **稳定性** | Event Loop Lag、GC 频率 | 主线程阻塞 | `monitorEventLoopDelay()` |
| **资源** | CPU 使用率、内存（Heap/RSS） | 资源健康 | `process.memoryUsage()` / `cpuUsage()` |
| **连接** | Active Handles、DB 连接池使用率 | 泄漏检测 | `process._getActiveHandles()` |
| **异常** | 未捕获异常数、进程重启次数 | 容错情况 | PM2 / K8s restart count |
| **业务** | SSR 渲染成功率、接口超时率 | 业务健康 | 自定义埋点 |

**Node 特有关键指标**：

| 指标 | 含义 | 阈值 |
|------|------|------|
| Event Loop Lag | 主线程阻塞程度 | > 100ms 告警 |
| Active Handles / Requests | 未释放的连接/定时器 | 趋势上涨 = 内存泄漏前兆 |
| Heap Used / Heap Total | 堆内存使用 | 持续上涨不回落 = 内存泄漏 |

**探针原理**：monkey patch 关键模块（计时上报）+ Node 原生 API（`perf_hooks` / `async_hooks` / `diagnostics_channel`）→ 详见 [2.7 Node 探针原理](#27-node-探针原理)

**完整监控架构**：采集（OpenTelemetry SDK）→ 存储（Prometheus）→ 展示（Grafana）→ 告警（AlertManager）→ 详见 [2.1b 完整监控方案](#21b-完整监控运维方案)

指标有些多
每个方面的核心指标有哪些呢

**Node.js 核心指标（只记 3 个）**：

| 指标 | 一句话 | 阈值 |
|------|--------|------|
| **P95 响应时间** | 服务快不快 | < 200ms 优秀，> 1s 告警 |
| **5xx 错误率** | 服务稳不稳 | < 0.1% 正常，> 0.5% 告警 |
| **Event Loop Lag** | 主线程有没有被阻塞 | < 50ms 正常，> 100ms 告警 |

能说出这三个 + 知道怎么采集（APM 探针 / `perf_hooks`）就够了。

// 1. 方面呢 我觉得上面表格的结构挺好的 

### 1.2.1 nodejs完整监控运维方案

**Q：是不是还得有后端 + 可视化前端？完整方案是怎样的？**

```
应用层（你的 Node 服务）
  └── 探针/SDK（采集数据）
        ↓ 上报
存储层（时序数据库）
  └── Prometheus / InfluxDB / 自建
        ↓ 查询
展示层（可视化）
  └── Grafana / 自建 Dashboard
        ↓ 规则
告警层
  └── AlertManager → 飞书/钉钉/短信/电话
```

**工业级标准方案**：

| 层 | 组件 | 作用 |
|----|------|------|
| 采集 | OpenTelemetry SDK（探针） | 自动 hook，产出 Metrics / Traces / Logs |
| 传输 | OTel Collector | 接收、处理、转发数据 |
| 存储 | Prometheus（指标）+ Jaeger（链路）+ ES（日志） | 持久化 |
| 展示 | Grafana | Dashboard 可视化 |
| 告警 | AlertManager / PagerDuty | 阈值触发通知 |

**大厂实际**：自研采集 SDK + 自研存储 + 自研 Dashboard（但架构和上面一样）。你用开源方案讲即可。

### 1.3 Web 前端

| 维度 | 指标 | 含义 | 采集方式 |
|------|------|------|---------|
| **加载性能** | FCP / LCP / TTFB | 首次绘制 / 最大内容 / 首字节 | Performance API / PerformanceObserver |
| **交互性能** | INP / FID | 交互延迟 | PerformanceObserver |
| **视觉稳定** | CLS | 布局偏移 | PerformanceObserver |
| **资源** | JS/CSS 体积、请求数 | 加载量 | Resource Timing |
| **错误** | JS Error 数、白屏率 | 可用性 | window.onerror + 白屏检测 |
| **业务** | PV/UV、转化率、跳出率 | 业务健康 | 埋点 |

### 1.4 RN / APK

| 维度 | 指标 | 含义 | 采集方式 |
|------|------|------|---------|
| **启动** | 冷启动/热启动时间 | 等待感知 | Native 打点 |
| **渲染** | FPS、卡顿率 | 流畅度 | Choreographer / rAF |
| **内存** | PSS、Java Heap、Native Heap | 内存健康 | `Debug.getMemoryInfo()` |
| **包体** | APK/IPA 大小、JS Bundle 大小 | 下载体验 | 构建产物统计 |
| **稳定性** | Crash 率、ANR 率 | 可用性 | Bugly / Crashlytics |
| **网络** | 请求成功率、P95 耗时 | 网络质量 | 请求拦截器 |
| **业务** | 秒开率、页面加载成功率 | 用户体验 | 自定义探针 SDK |

### 1.5 低代码搭建页面

**保障性能下限的手段**：

| 问题 | 解法 |
|------|------|
| 无限嵌套 | schema 保存时递归校验深度上限（如 5 层） |
| 组件过多 | 单页组件数上限（如 50 个） |
| 大图/大资源 | 上传自动压缩 + 大小限制 |
| 死循环/卡顿 | 渲染超时检测 + ErrorBoundary |
| 白屏兜底 | 全局 ErrorBoundary + 兜底 UI + 上报 |
| 发布门禁 | 保存/发布前跑性能预检（类似 CI 门禁） |

| 维度 | 指标 | 怎么采集 |
|------|------|---------|
| **可用性** | 服务存活率（uptime %）、错误率（5xx / total） | 健康检查 endpoint + Prometheus |
| **性能** | P50/P95/P99 响应时间、QPS、TTFB | APM 探针 / `perf_hooks` |
| **稳定性** | 内存/CPU 使用率、Event Loop Lag、GC 频率 | `process.memoryUsage()` + `perf_hooks.monitorEventLoopDelay()` |
| **异常** | 未捕获异常数、进程重启次数、OOM 次数 | PM2 监控 / K8s Pod restart count |
| **业务** | SSR 渲染成功率、Hydration 错误率、首屏时间 | 自定义埋点 |


---

## 2. Node.js + BFF

### 2.2 BFF 中间层

→ 详见 [BFF 与中间层](../root/Node/bff.md)

### 2.3 Node 进程管理与部署

→ 详见 [进程管理与部署](../root/Node/process-deploy.md)

### 2.4 Node 服务稳定性

→ 详见 [Node 服务稳定性与可用性](../root/Node/node-service-reliability.md)

### 2.5 Nuxt 部署方式

**Q：Nuxt 这种前后端一体的怎么部署？**

`nuxt build` 产物是一个 Node HTTP 服务（不是静态文件），前端 SSR + API 路由跑在同一个进程里。

```bash
nuxt build                          # 产物在 .output/
node .output/server/index.mjs       # 启动 Node HTTP 服务
```

| 部署方式 | 怎么做 |
|---------|--------|
| PM2 | `pm2 start .output/server/index.mjs` |
| Docker | `CMD ["node", ".output/server/index.mjs"]` |
| K8s | Docker → Pod → Service → Ingress |
| Serverless | Vercel / Netlify / Cloudflare Workers（Nuxt 原生支持） |

本质 = 部署一个 Node 服务，和 Express/Koa 没区别。

### 2.6 Node 探针原理

**Q：Node 中的探针原理是什么？Node 提供了什么接口？**

**核心手段：Monkey Patching** — 在应用启动前 hook 原生模块，给关键方法包一层计时：

```js
const originalRequest = require('http').request

// 替换成带计时的版本
http.request = function(...args) {
  const start = Date.now()
  const req = originalRequest.apply(this, args)
  req.on('response', () => {
    report({ url: args[0], duration: Date.now() - start })  // 上报耗时
  })
  return req
}
// 同理 hook pg.query / redis.get / fetch 等
```

**Node 原生提供的 API**：

| API | 作用 |
|-----|------|
| `perf_hooks.monitorEventLoopDelay()` | 检测 Event Loop 延迟 |
| `process.memoryUsage()` | 堆内存 / RSS 使用量 |
| `process.cpuUsage()` | CPU 时间 |
| `async_hooks` | 追踪异步操作生命周期（用于链路追踪：还原"一个请求经过了哪些异步步骤"） |
| `diagnostics_channel` (Node 16+) | 内置诊断事件通道（官方推荐的替代 monkey patch 方案） |

**总结**：探针 = monkey patch 关键模块（计时上报）+ Node 原生 API（内存/CPU/Event Loop）+ async_hooks（链路追踪）。

---

## 3. 微前端

→ 详见 [微前端 README](../root/Vue/micro-fe/README.md) / [qiankun 详解](../root/Vue/micro-fe/qiankun.md) / [MF](../root/Vue/micro-fe/module-federation.md) / [Wujie](../root/Vue/micro-fe/wujie.md)

---

## 4. 前端工程化: Vite / Webpack + 开发全链路 + 自动化测试

→ 详见 [Vite 深度](./engineering/vite.md) / [构建流水线](./engineering/build-pipeline.md)

### 4.1 ESM 的本质

**Q：ESM 的本质是什么？和传统 script 标签有什么区别？**

**本质**：浏览器原生支持的模块系统 — `import` 时浏览器自动发请求加载对应的 JS 文件（按需、独立加载），而不是打成一个大 bundle 一次性下载。

```html
<!-- 传统：一个大 bundle，全量下载 -->
<script src="bundle.js"></script>

<!-- ESM：按 import 依赖图逐个请求 -->
<script type="module" src="main.js"></script>
<!-- main.js 里 import './utils.js' → 浏览器再发请求加载 utils.js -->
<!-- utils.js 里 import './math.js' → 浏览器再发请求加载 math.js -->
```

**和 Vite 的关系**：Vite 开发模式利用浏览器原生 ESM — 不打 bundle，每个文件是独立模块，浏览器按 import 依赖图逐个请求。所以启动快（不等打包）、热更新快（只更新改了的那个文件）。

**生产为什么还要打包**：ESM 按需加载 = 几百个模块 = 几百个 HTTP 请求 → 瀑布流延迟太高。所以生产用 Rollup 打成少量 bundle（兼顾模块化 + 加载性能）。


### 4.2 打包工具选型（2026）

**Q：现在打包如何选型？**

| 场景 | 选什么 | 为什么 |
|------|--------|--------|
| 新项目（中小） | **Vite** | ESM 秒启动，生态成熟，社区主流 |
| 新项目（大型/微前端） | Vite + MF 插件 | Vite 构建 + MF 跨应用共享 |
| 老项目（已有 Webpack） | 继续 **Webpack 5** | 迁移成本高，性能够用 |
| 库/组件库 | **Rollup** / tsup / unbuild | Tree Shaking 好，产物干净 |
| 极致性能 | **Rspack**（字节）/ Turbopack（Vercel） | Rust 实现，快 10x |
| SSR 框架 | 框架内置 | Nuxt = Vite，Next = Turbopack |

**一句话**：新项目无脑 Vite。老项目不迁移。库用 Rollup。追求极致速度看 Rspack。

--- 

## 5. 自动化测试 + TDD

### 5.1 前端测试体系速查

**测试金字塔**：

```
        E2E（少量）        ← 验证用户流程（Playwright / Cypress）
      集成测试（适量）      ← 验证组件交互（Testing Library）
    单元测试（大量）        ← 验证函数/工具逻辑（Vitest / Jest）
```

**工具选型（2026）**：

| 层 | 工具 | 跑在哪 | 特点 |
|----|------|--------|------|
| **单元测试** | Vitest（推荐）/ Jest | Node | 和 Vite 配置复用，极快 |
| **组件测试** | @testing-library/react | jsdom / Node | 测组件行为不测实现细节 |
| **E2E** | Playwright（推荐）/ Cypress | 真浏览器 | 模拟用户操作全流程 |
| **视觉回归** | Chromatic / Percy | CI | 截图对比，防 UI 回归 |
| **API 测试** | Supertest / MSW | Node | Mock 网络层 |

**覆盖率指标**：

| 指标 | 含义 | 业界目标 |
|------|------|---------|
| **行覆盖率（Line）** | 多少行代码被测试执行过 | > 80% |
| **分支覆盖率（Branch）** | if/else 的每个分支都走过 | > 70% |
| **函数覆盖率（Function）** | 多少函数被调用过 | > 80% |
| **语句覆盖率（Statement）** | 多少语句被执行过 | > 80% |

**覆盖率不等于质量** — 100% 覆盖率的垃圾测试不如 50% 覆盖率的精准测试。核心是测**关键路径和边界条件**。

### 5.2 AI + 自动化测试（DD 重点）

DD JD 提的是"AI 辅助自动化测试"，不是传统 TDD。

**AI 怎么参与测试**：

| 阶段 | AI 做什么 |
|------|-----------|
| **生成单测** | 根据函数签名 + JSDoc 自动生成测试用例（含边界） |
| **生成 E2E** | 根据 Spec/PRD 自动生成用户操作流程脚本 |
| **Review 补测** | PR 提交时 AI 检查缺失的测试覆盖 → 建议补充 |
| **变异测试** | AI 修改源码（制造 Bug）→ 验证测试是否能捕获 |

**你的实践**：
- pytest + uiautomator2（设备自动化）— 实际跑在真机上的 E2E
- Mako Agent 的 Harness 层 = AI 执行后自动验证结果（本质是 AI 驱动的自动化测试）

---

## 6. LowCode

### 6.1 布局方案对比选型

**Q：lowcode 的布局方案有哪些？对比选型？能实现 flex 布局吗？**

**本质**：低代码布局 = "如何用可视化操作描述组件的空间关系"。核心是 **编辑态操作方式** 和 **运行态 CSS** 之间的映射。

| 方案 | 编辑态操作 | 运行态 CSS | 适用场景 | Flex 支持 |
|------|-----------|-----------|---------|----------|
| **自由布局** | 拖拽到任意位置（x/y） | `position: absolute` | 海报、H5 活动页 | ❌ |
| **流式布局** | 从上到下排列、拖拽排序 | 正常文档流 block | 表单、文章 | ❌ |
| **栅格布局** | 拖入 N 列网格 | `display: grid` / 12 列 | 后台 Dashboard | 部分 |
| **Flex 容器** | 选方向 + 对齐 + 子项 flex 属性 | `display: flex` | 通用复杂布局 | ✅ |
| **嵌套容器** | 容器套容器，每个容器独立布局 | 嵌套 flex/grid | 最灵活 | ✅ |

**选型本质 — 用户群决定方案**：
- 运营用（H5 活动页）→ 自由布局（像 PPT，所见即所得）
- 开发者用（后台/Dashboard）→ 栅格 + Flex 容器（结构化、响应式）
- 通用搭建平台 → 嵌套容器（最灵活但最复杂）

**能实现 Flex 吗**：能。把 Flex 容器作为一个组件（方向/对齐/间距可配），子组件的 flex-grow/shrink/basis 暴露为属性面板。本质 = 把 CSS Flex 属性映射为 UI 控件。

### 6.2 性能/可用性下限保障

**Q：如何保证低代码页面的可用性和性能下限？兜底页？如何避免无限嵌套？**

**本质**：低代码 = 把写代码的自由度给非开发者。自由度越大出问题概率越大。保障下限 = **限制自由度的边界 + 前置拦截**。

| 问题 | 解法 | 原理 |
|------|------|------|
| 无限嵌套 | 嵌套层级上限（如 5 层） | schema 保存时递归计算深度，超过拒绝保存 |
| 组件过多 | 单页组件数上限（如 50 个） | count 校验，超过提示优化 |
| 大图/大资源 | 上传自动压缩 + 大小限制 | 上传中间件拦截 |
| 死循环/卡顿 | 渲染超时检测 + 错误边界 | ErrorBoundary 包裹每个组件 |
| 白屏兜底 | 全局 ErrorBoundary + 兜底页 | 整页渲染失败 → 兜底 UI + 上报 |
| 发布门禁 | 保存/发布前跑性能预检 | 类似 CI 门禁，不达标不让发布 |

**避免无限嵌套**：

```ts
function validateDepth(schema, maxDepth = 5, current = 0) {
  if (current > maxDepth) throw new Error('嵌套超过限制')
  for (const child of schema.children || []) {
    validateDepth(child, maxDepth, current + 1)
  }
}
```

**核心思路**：前置拦截（schema 校验 + 发布门禁）> 运行时兜底。兜底页是最后防线，不是主要手段。

---



## 7. AI: SDD + Harness 工程 + spec模式 + TDD

- AI测评 推荐: **spec**模式(规划需求 - deign 技术方案 - 拆解tasks) + **TDD**

### 7.1 ReAct Loop 危险命令确认机制

**Q：ReAct Loop 遇到危险命令（rm -rf / git push / 数据库写入），怎么停下来让用户确认？**

**机制**：Harness 层的 Confirmation Gate（确认门）。

```
Agent ReAct 循环：
  Think → 决定执行危险操作
    ↓
  Harness 拦截器：这个 Tool Call 在"需确认"清单里吗？
    ├── 不在 → 直接执行，循环继续
    └── 在 → 暂停循环 → yield 给 UI → 展示确认弹窗
                            ↓
                   用户确认 → 继续执行
                   用户拒绝 → Agent 收到 rejection → 重新规划或停止
```

**实现本质**：ReAct Loop 是异步状态机，每一步 Tool Call 都是一个 await 点。在 await 点插入确认逻辑 = 暂停循环等待外部输入。

```ts
while (!done) {
  const action = await llm.think(context)

  if (needsConfirmation(action)) {
    const approved = await requestUserConfirmation(action)  // ← while 停在这里等用户
    if (!approved) {
      context.push({ role: 'system', content: 'User rejected this action' })
      continue  // 不执行，让 LLM 重新规划
    }
  }

  const result = await executeTool(action)
  context.push(result)
}
```

**分级策略**：

| 级别 | 操作类型 | 处理 |
|------|---------|------|
| 读操作 | 读文件、搜索、查询 | 自动执行 |
| 低风险写 | 创建文件、修改代码 | 自动执行 |
| 高风险写 | 删除文件、git push、数据库写入 | 确认门暂停 |
| 系统级 | rm -rf、格式化、env 修改 | 直接拒绝 |

### 7.2 SDD（Spec-Driven Development）

→ 详见 [Mako 深度](../../project/AI/mako/mako-project-deep-dive.md)

### 7.3 Harness 质量保障体系

→ 详见 [DD prep § AI 研发体系](./prep.md#1-ai-研发体系最重要)

---

## 8. React + TS

- [TS 类型模式](../root/TS/type-patterns.md) 
- [TS 目录](../root/TS/README.md)
- [React 基础](../../basic/react_interview_basic.md)

（待补充 top5 问题）

---
