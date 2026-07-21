# DD — 大前端方向准备

- resume: BBQ/docs/resume/resume-draft-v3.md

→ [运营前端方向准备](./prep.md)

## 目录

- [三张牌](#三张牌)
- [QA](#qa)
  - [Q1: 可观测 Top3 指标（Nuxt 后端）](#q1-可观测-top3-指标nuxt-后端)
  - [Q2: Nuxt 天然就启动了 SSR 吗](#q2-nuxt-天然就启动了-ssr-吗)
  - [Q3: 负载前端关注什么指标（稳定性+性能 Top3）](#q3-负载前端关注什么指标稳定性性能-top3)
    - [大文件优化叙事](#大文件优化叙事)
    - [核心接口 TOP3](#核心接口qps-top3)
    - [P0/P1/P2 告警设计](#上面这些指标-p0-p1-p2告警的设计-表格-不要噪音)
  - [Q4: 团队 AI Coding 如何铺设计](#团队的ai-coding开发如何去铺和设计)
  - [Q5: 像素级对比（Flutter 卡片渲染）](#比对像素的py库-好比说我们做那个futter卡片渲染框架-需要比对渲染出图片)
  - [Q6: 微前端选型](#链接下之前说的微前端的文档)
    - [MF 缺陷](#mf有什么问题或者缺陷以致于不适合什么场景)
    - [MF 是否要求框架统一](#mf是否要求框架统一-为什么-实践中为什么要框架统一)
    - [MF 远程 chunk 本质 + 加载过程](#mf中的远程的chunk本质是什么-是什么组成的-远程加载和执行渲染的过程是怎样的)
    - [remoteEntry.js 是什么](#remoteentryjs-是什么怎么约定)
    - [Wujie vs qiankun 选型](#wujie-和-qiankun怎么选)
    - [混用方案](#能不能混用自家-qiankunmf--第三方-wujie)
  - [Q7: H5 优化](#h5优化)
  - [Q8: Nuxt SSR](#nuxtssr)
    - [SSR 本质](#ssr本质nuxt-开箱即用ssr吗不需要额外配置什么吗)
    - [SSR 经典问题 TOP3](#ssr会有什么经典问题吗-一个表格-top3-解决方案-这些问题nuxt天然解决了吗)
    - [部署方式](#1-怎么部署呢-用docker吗-pm2)
    - [SSO 登录流程](#2-好比说负载这个项目-登陆走公司的sso-一般是怎么样的流程呢-接入流程和运作流程-不要噪音)
  - [Q9: 人效和质量可观测指标](#人效和质量的可观测指标)
  - [Q10: resume-v3 爆破](#resume-v3爆破)
    - [R8 能做什么](#r8-能做什么-top3-怎么配置和开启呢-还需要配套什么文件吗)
    - [IDE 语法服务器](#ide中的-语法服务器-是基于vue的语法服务器veture改的-语法服务器的本质是什么-它的客户端是什么-高亮和语法联想补全的底层逻辑流动是怎样的)
  - [Q11: 快应用框架（大前端）](#快应用框架大前端)
    - [构建结果](#快应用的构建结果是什么-最小例子是js吗还是json)
    - [构建过程](#是怎么构建的每个阶段产物)
    - [运行时渲染管线](#运行时框架加载后-怎么运行渲染出来-渲染管线走j2v8注入的sendframe的external-function吗-diff过程发生在native层吗-那么js这边不diff-是怎么渲染的)
    - [tick 概念](#tick概念渲染指令注册到微任务)
    - [diff 下沉 Native？+ J2V8 vs JSI 内存共享](#1-如果diff等下沉到native层会不会性能更好)
- [注释](#注释)

---

## 三张牌

### 专业板块: 大前端 + 前端全栈 + AI agent开发
- 微前端
- H5 + webview + bridge : 可观测+ 性能优化
- RN

### 全链路: 工程化 + 可观测体系 + 开发链路AI化: 人效 质量
- AI的可观测体系加入到可观测体系中
- AI coding加入研发全链路的可观测指标Top3设计

### 管理: 人效质量 + 历史问题解决 + 新业务开辟:运营配置Agent化 + 人才培养
- 🔥运营配置 Agent 化
- 🔥低代码搭建工具 Agent化

---

## QA

### Q1: 可观测 Top3 指标（Nuxt 后端）

→ 详细文档：[Node.js 可观测体系](../root/Node/observability.md)

| # | 指标 | 含义 | 告警阈值 | 你的数据（负载平台） | 采集方式 |
|---|------|------|---------|-------------------|---------|
| 1 | [**P95 响应时间**](#注释p95) | 95% 请求在多少 ms 内完成 | > 1s | 日常 ~200ms，上传接口优化前 120s+ → 优化后 42s | OTel HTTP Span |
| 2 | **5xx 错误率** | 服务端异常占比 | > 0.5% | < 0.1%（2 Pod，千人级内部平台） | OTel + Sentry |
| 3 | **RSS / Heap Used** | 进程内存 | RSS > 1GB 或持续上涨不回落 | 稳定 ~300MB（MPU 后不再飙升） | `process.memoryUsage()` |

**为什么是这 3 个**：P95 = 用户体感，5xx = 可用性，内存 = 稳定性（泄漏/OOM 的前兆）。Event Loop Lag 是第 4 个候选，但千人级平台 CPU 不是瓶颈。

#### 内存: 是谁在上报? 需要探针吗?

不需要自己写探针。两层自动采集：
- **应用层**：小米内部探针 SDK（原理同 OTel，monkey patch + `process.memoryUsage()`），接入即采集
- **容器层**：K8s cAdvisor 自动暴露每个 Pod 的 RSS/CPU → Prometheus 抓取 → Grafana 看板

我做的是配置告警规则 + 看板定制 + 根据指标异常做优化，不是从零写探针。

#### QPS 给多少合适呢? 估计1000人在用?

**日常 ~7 QPS，峰值 ~50-100 QPS。**

推算：1000 人活跃率 ~20%（200 人同时在线）× 2 次请求/分 ÷ 60s ≈ 7 QPS。峰值（上午集中使用 + 批量操作）按 5-10 倍。

2 Pod 部署主要是**高可用**（一个挂了另一个兜底），不是为了扛量。单 Node 进程轻松扛 1000+ QPS。真正瓶颈是大文件上传（长连接占资源），不是并发量。

#### 大文件优化叙事

**叙事**：上线后在小米内部监控平台看到上传接口 P95 响应时间飙到 120s+，同时 Pod 的 RSS 内存接近容器上限触发告警。排查发现：4.4G 的性能采集文件走的是整体 PUT，Node 进程把整个文件 buffer 在内存里再转发 S3 → 内存打满 + 后续请求全排队。

方案：改为 S3 MPU 分片上传（前端 presigned URL 直传，浏览器 6 路并发，每片 64MB，不经过 Node 进程）。优化后上传耗时 121s → 42s（提速近 3 倍），Node 内存稳定不再飙升。

```
发现：小米监控平台 RSS 告警 + P95 飙升
定位：大文件整体 PUT → 进程内存打满
方案：S3 MPU 分片并发直传（绕过 Node buffer）
结果：121s → 42s，内存稳定
```

#### 核心接口QPS TOP3

| 接口 | 为什么核心 | 告警阈值 |
|------|-----------|---------|
| **文件上传** | 4.4G 大文件，最容易出问题 | P95 > 60s |
| **分析报告查询** | 用户主路径，数据量大（ECharts 数据源） | P95 > 2s |
| **登录/鉴权** | 挂了全站不可用 | P95 > 500ms |


#### 告警设计
- 后端指标: 告警设计

---

### Q2: Nuxt 天然就启动了 SSR 吗

**默认是 SSR（Universal Mode）。** `nuxt build` + `nuxt start` 启动一个 Node.js server，每次请求在服务端执行 Vue 组件 → 输出 HTML → 返回给浏览器。不需要额外配置。[→ Hydration 水合](#hydration水合)

可以关掉：`nuxt.config.ts` 中设 `ssr: false` → 变成纯 SPA（只构建静态 HTML + JS，不需要 Node server）。还有第三种：`nuxt generate` → SSG（构建时预渲染所有页面为静态 HTML，部署到 CDN，不需要运行时 server）。

| 模式 | 需要 Node server？ | 首屏 | 适合 |
|------|-------------------|------|------|
| **SSR**（默认） | ✅ | 服务端渲染 HTML，白屏短 | 动态内容 + SEO |
| **SPA** | ❌ | 客户端渲染，白屏长 | 内部工具（不需要 SEO） |
| **SSG** | ❌ | 构建时预渲染，CDN 直出 | 博客/文档/静态页 |

你的负载平台用 SSR = 需要 Node server 常驻 = 需要部署 Pod = 需要可观测。

---

### Q3: 负载前端关注什么指标（稳定性+性能 Top3）

| 维度 | # | 指标 | 含义 | 采集 | 优 | 普通 | 差 |
|------|---|------|------|------|---|------|---|
| **性能** | 1 | LCP | 最大内容绘制 | PerformanceObserver | < 1s | 1-2s | > 3s |
| | 2 | FCP | 首次内容绘制（白屏结束） | PerformanceObserver | < 500ms | 500ms-1s | > 2s |
| | 3 | FMP | 首次有意义绘制（核心内容可见） | 自定义埋点 | < 1.5s | 1.5-3s | > 4s |
| **稳定性** | 1 | JS Error 率 | 未捕获异常数 / PV | `window.onerror` + Sentry | < 0.1% | 0.1-0.5% | > 1% |
| | 2 | 白屏率 | 页面加载后无内容 | 自定义检测（DOM 判空） | 0 | < 0.1% | > 0.5% |
| | 3 | 接口失败率 | fetch 4xx/5xx 占比 | Axios 拦截器上报 | < 0.5% | 0.5-2% | > 5% |

**你的场景补充**：负载平台是内部工具（非 C 端），SEO 不重要，所以 LCP/FCP 的优先级低于"功能可用"。实际最关注的是：接口成功率 + 大文件上传成功率 + ECharts 渲染不卡顿（大数据量）。

### 上面这些指标, P0 P1 P2告警的设计? 表格, 不要噪音

| 级别 | 含义 | 触发条件 | 响应 |
|------|------|---------|------|
| **P0** | 服务不可用 | 5xx > 5% 持续 1min / OOM Killed / [Pod](#注释pod) 全挂 | 立即响应，电话通知，5min 内介入 |
| **P1** | 性能严重劣化 | 全局 P95 > 3s / [RSS](#注释rss) > 1GB / 上传接口 P95 > 120s | 15min 内响应，飞书/钉钉告警 |
| **P2** | 指标异常趋势 | 全局 P95 > 1s / 5xx > 0.5% / RSS 持续上涨不回落 | 工作时间处理，邮件通知 |

**设计原则**：P0 = 用户完全用不了；P1 = 能用但体验很差；P2 = 有隐患但暂不影响使用。内部工具不需要 On-Call 轮班，P0/P1 飞书群通知即可。

## 团队的AI coding开发如何去铺和设计? 
- 用什么指标衡量AI coding的开发效果? 指标Top3: 人效和质量的之前有了
- 链接下质量+人效的那个TOP3指标文件? 
- 如何保证开发的效果和设计稿的一致性呢?

→ 人效+质量指标：[dev-efficiency-quality.md](../wjm/cards/card1:observer/dev-efficiency-quality.md)

**AI Coding 效果 Top3 指标**：

→ [AI Coding 可观测指标](../wjm/cards/card1:observer/ai-coding-metrics.md)

| # | 指标 | 怎么算 | 基准 |
|---|------|--------|------|
| 1 | [**AI 代码采纳率**](#注释ai采纳率统计) | 被 accept 的 AI 生成代码行 / AI 总生成行 | > 60% 算有效 |
| 2 | **需求交付周期缩短比** | (传统周期 - AI 辅助周期) / 传统周期 | 目标 30-50% |
| 3 | **AI 生成代码缺陷率** | AI 生成的代码引入的 bug 数 / AI 生成总 PR 数 | 应 ≤ 人工水平 |

**设计稿一致性怎么保证**：

1. **Figma MCP → 自动提取[设计 token](#注释design-token)**（颜色/间距/字号），AI 生成代码时以 token 为约束
2. **[截图对比（视觉回归）](#注释像素级对比)**：CI 中跑 Playwright 截图 → 和设计稿逐像素 diff → 差异超阈值（如 5%）阻断合并
3. **人工 Review 兜底**：设计师在 PR 中 Review UI 截图（Storybook / 预览环境），不过就不合

本质：token 约束 AI 生成 → 截图 diff 自动验证 → 人工 Review 最终确认。三层保障。

---

## 比对像素的PY库 好比说我们做那个futter卡片渲染框架, 需要比对渲染出图片

**用 `Pillow` + `numpy`**。两张图转数组 → 逐像素差值 → 算差异比例。

| 库 | 作用 |
|---|------|
| **Pillow** | Python 图片处理库，读取/解码图片为像素矩阵 |
| **numpy** | 数值计算库，对像素矩阵做逐元素对比 + 统计差异数量 |

```python
from PIL import Image  # 图片读取/解码
import numpy as np     # 矩阵运算

img1 = np.array(Image.open("expected.png"))  # 基准图 → 像素矩阵 (H, W, RGBA)
img2 = np.array(Image.open("actual.png"))    # 实际渲染图 → 像素矩阵
diff_ratio = np.count_nonzero(img1 != img2) / img1.size  # 不同像素数 / 总像素数
assert diff_ratio < 0.05, f"像素差异 {diff_ratio:.2%} 超过阈值"
```

---

### 链接下之前说的微前端的文档

→ [微前端 README（qiankun/MF/Wujie）](../root/Vue/micro-fe/README.md)

→ [DiDi QA: 微前端部分](./qa.md#3-微前端)

→ [DiDi prep: 微前端经验](./prep.md#4-架构设计微前端--高可用)

- 摘要下2026的微前端方案选型, 一个表格, 不要噪音和无用废弃方案

| 方案 | 原理 | 适合 | 隔离 |
|------|------|------|------|
| **Module Federation 2.0** | 构建时声明 expose/remote，运行时按需加载远程模块 | 新项目 / Vite+Webpack 混用 | JS 沙箱弱，需自己处理 |
| **Wujie** | WebComponent + iframe 沙箱（iframe 做 JS 隔离，Shadow DOM 做样式隔离） | 存量项目接入 / 强隔离需求 | 天然强隔离 |
| **qiankun（single-spa）** | 路由劫持 + JS 沙箱（Proxy）+ 样式前缀隔离 | 存量项目（已在用） | 中等（Proxy 沙箱有边界 case） |

**2026 选型结论**：
- 新项目首选 **Module Federation 2.0**（性能好，无 iframe 开销，Vite/Rspack 都支持）
- 需要强隔离（第三方子应用/不可控代码）→ **Wujie**
- 已有 qiankun 的存量项目 → 不迁移，维持即可

#### MF有什么问题?或者缺陷?以致于不适合什么场景?

| 缺陷 | 说明 | 不适合 |
|------|------|--------|
| **无 JS 隔离** | 共享同一个 window，全局变量/事件互相污染 | 接入不可控的第三方代码 |
| **需要构建配合** | 子应用必须用 Webpack5/Rspack/Vite MF 插件打包 | 无法改造构建的老项目/第三方 |
| **版本耦合风险** | 共享依赖版本不一致时运行时报错 | 子应用版本节奏差异大 |

结论：MF 适合**自家团队、统一构建工具、需要高性能共享模块**的场景。不适合"接入外部不可控应用"。

**MF 优点**：性能最好（无 iframe/沙箱开销，模块按需加载，共享依赖不重复下载）。

**不要求框架统一**（React/Vue 混用可以），但要求**构建工具统一**（都得用支持 MF 的打包器）。本质：MF 是构建层方案——在打包阶段声明模块边界，运行时动态加载远程 chunk。不统一构建工具 = 没法产出 MF 格式的 chunk = 没法互相消费。


#### MF是否要求框架统一? 为什么? 实践中为什么要框架统一?

**技术上不要求**。MF 是构建层协议，只要打包器支持 MF 插件就能产出/消费远程模块，React 和 Vue 混用技术上可行。

**实践中要求**。因为 MF 的核心价值是 `shared`（共享依赖）：`shared: { react: { singleton: true } }` — 宿主和远程模块共享同一个 React 实例。如果一个用 React 一个用 Vue → 没法 shared → 各自加载完整框架 → 体积翻倍 + 全局冲突。

**一句话本质**：MF 不要求框架统一，但不统一就丧失了它最大的优势（共享依赖零冗余）。

---

#### MF中的远程的chunk本质是什么, 是什么组成的? 远程加载和执行渲染的过程是怎样的?

**远程 chunk 本质** = 一个普通的 JS 文件（Webpack/Rspack 打包产物），内部是 `define` + 模块工厂函数。和本地 chunk 结构完全一样，只是部署在另一个 CDN/域名上。

**组成**：`remoteEntry.js`（入口清单，声明"我有哪些模块"）+ 若干按需 chunk（实际代码）。

**加载+渲染过程**：

```
1. 宿主启动 → 加载远程 remoteEntry.js（一个 manifest，注册到全局 scope）
2. 宿主代码 import('remote/Button') → MF runtime 查 scope → 发现是远程模块
3. 动态 fetch 对应 chunk（真正的代码）→ 执行模块工厂函数 → 拿到 export
4. 和本地模块一样用（React.createElement / render）→ 渲染到 DOM

本质 = 把 import() 的加载范围从"本地 chunk"扩展到"任意 URL 的 chunk"
```

#### remoteEntry.js 是什么？怎么约定？

对，就是一个注册到全局的 map。**基于构建时配置约定**（不是运行时协商）。

**remoteEntry.js 内容本质**（简化）：

```js
// 远程应用构建产出的 remoteEntry.js（Webpack 自动生成）
window["componentLib"] = {
  get(moduleName) {
    // "./Button" → 返回对应 chunk 的加载函数
    return import("./src_Button_tsx.chunk.js");
  },
  init(sharedScope) {
    // 接收宿主传来的共享依赖（react/react-dom）
  }
};
```

**宿主配置**（告诉 MF runtime 去哪找远程模块）：

```js
// ─── 宿主 webpack.config.js ───
new ModuleFederationPlugin({
  remotes: {
    // "componentLib" = 全局变量名（和远程 remoteEntry 注册的 key 一致）
    // "https://cdn.xxx/remoteEntry.js" = 远程 entry 地址
    componentLib: "componentLib@https://cdn.xxx/remoteEntry.js"
  }
})

// ─── 远程应用 webpack.config.js ───
new ModuleFederationPlugin({
  name: "componentLib",  // 注册到 window 的 key
  filename: "remoteEntry.js",
  exposes: {
    "./Button": "./src/Button.tsx",  // 声明对外暴露哪些模块
    "./Table": "./src/Table.tsx"
  },
  shared: { react: { singleton: true } }
})
```

**约定关系**：宿主 `remotes` 里的 key 和远程 `name` 必须一致。这是构建配置里写死的，不是运行时发现的。

#### 1. 这是子应用远程部署的?

对。子应用独立构建后部署到自己的 CDN/服务器，`remoteEntry.js` 是部署产物之一。

#### 2. 那么基座应用怎么知道这个文件的存在呢? 什么时机加载呢

基座 `webpack.config.js` 里**硬编码了 URL**：`remotes: { componentLib: "componentLib@https://cdn.subapp.com/remoteEntry.js" }`。

**时机**：页面初始化时 MF runtime 自动插入 `<script src="...remoteEntry.js">`，预加载清单。具体模块代码（chunk）才是用到时按需 fetch。

remoteEntry.js = 预加载的清单（"我有哪些模块"），模块代码 = 按需加载。

#### 加载执行远程模块? 需要用eval吗?

不需要。动态创建 `<script src="remoteEntry.js">` 标签，浏览器原生解析执行（和 `import()` 一样）。不是 eval 字符串。

#### MF的粒度一般是什么? 是一整个网站吗? 还是说一个组件? 微前端中的MF实践是什么? 听你说下来, MF对微前端场景的可用性很一般啊 ? 

**粒度随意**：组件级（共享 Button/Table）/ 页面级（远程加载整个路由页面）/ 模块级（共享 SDK/工具函数）。

**微前端中 MF 实践**：主应用做路由 shell，子应用 expose 根组件，主应用按路由 `import('remote/App')` 渲染。

**对，MF 做微前端确实一般**。它本身不是微前端方案——没有沙箱、没有生命周期管理、没有样式隔离。需要团队规范补齐。MF 的真正价值是"跨应用模块共享"（改一处全局生效），不是"隔离多个独立应用"。

---

#### wujie 和 qiankun怎么选 
- 场景: 好比说有大量的平台需要聚合,有些还是第三方的

| 维度 | qiankun | Wujie | 该场景需要 |
|------|---------|-------|-----------|
| **第三方接入** | 子应用必须改造（暴露生命周期） | **零改造**（给 URL 就行） | ✅ 第三方不会改代码 |
| **JS 隔离** | Proxy 沙箱（有边界 case） | **iframe 天然完全隔离** | ✅ 不可控代码 |
| **样式隔离** | 前缀/Shadow DOM（配置复杂） | **Shadow DOM 天然隔离** | ✅ 不想处理冲突 |
| **接入速度** | 每个子应用需改造 + 调试 | 只需 URL，批量接入快 | ✅ 大量平台快速聚合 |
| **性能** | 好（同 document） | 略差（iframe 开销） | 内部平台可接受 |

**结论**：第三方 + 不可控 + 批量接入 → **Wujie**。全是自家应用 + 能统一改造 → qiankun 或 MF。

#### 能不能混用：自家 qiankun/MF + 第三方 Wujie？

可以，且是合理的架构选择。主应用做统一路由壳：

| 子应用类型 | 方案 | 原因 |
|-----------|------|------|
| 自家应用（可控） | MF 或 qiankun | 性能好 / 可共享依赖 |
| 第三方/不可控 | Wujie | iframe 强隔离，零改造接入 |

技术上完全没问题——主应用路由层根据"这个子应用是自家还是第三方"决定用哪种加载方式。实际大厂（字节/美团）的大型后台平台就是这么做的：核心模块走 MF 共享，外部系统走 iframe/Wujie 隔离。

## H5优化
- 链接下: [前端性能面试基础](../../basic/frontend_performance_interview_basic.md)

## Nuxt:SSR
### SSR本质?NUxt 开箱即用SSR吗?不需要额外配置什么吗? 

**本质**：请求到达 → Node server 执行 Vue 组件 → 输出完整 HTML → 返回浏览器（用户立即看到内容，不等 JS 下载执行）。

**Nuxt 开箱即用**：`ssr: true` 是默认值，不写任何配置就是 SSR。`nuxt build` + `nuxt start` 即可。唯一需要做的是部署一个 Node server（不是静态托管）。

---

### SSR会有什么经典问题吗? 一个表格 TOP3? 解决方案? 这些问题nuxt天然解决了吗? 

| # | 问题 | 原因 | 解决方案 | Nuxt 天然解决？ |
|---|------|------|---------|---------------|
| 1 | **Hydration Mismatch** | 服务端/客户端渲染结果不一致 | `<ClientOnly>` 包裹仅客户端组件 / 避免 `Date.now()` 等不确定值 | ⚠️ 提供 `<ClientOnly>`，但不自动检测，需开发者规避 |
| 2 | **服务端无 window/document** | Node 没有浏览器 API | `onMounted` 里访问 / `import.meta.client` 判断 / `<ClientOnly>` | ✅ Nuxt 提供 `import.meta.client` + 自动拆分 server/client 代码 |
| 3 | **内存泄漏（server 端）** | 组件级闭包/全局状态跨请求串数据 | 不用全局单例 store（用 `useState` composable）/ 每个请求独立上下文 | ✅ Nuxt 的 `useState` 自动 per-request 隔离 |

**一句话**：Nuxt 把 SSR 的基建全做了（路由/数据获取/代码拆分/hydration），你只需要避免写出"两端不一致"的代码。

#### 1. 怎么部署呢? 用docker吗? PM2?

Docker + K8s（不用 PM2）。

```dockerfile
FROM node:20-alpine
COPY .output .output
CMD ["node", ".output/server/index.mjs"]
```

`docker build` → push 镜像 → K8s Deployment（2 Pod 副本）→ Service + Ingress 暴露。K8s 自己管重启/负载均衡/健康检查，不需要 PM2。

#### 2. 好比说负载这个项目, 登陆走公司的SSO, 一般是怎么样的流程呢? 接入流程和运作流程? 不要噪音 

**接入（一次性）**：向 SSO 平台申请 Client ID + Secret → Nuxt 配置 [OAuth2 中间件](#注释nuxt-oauth2配置)。

**运作（每次访问）**：

```
用户访问 → Nuxt middleware 检查 cookie → 无 session
  → 302 到 SSO 登录页（带 redirect_uri）
  → 用户登录
  → SSO 回调 redirect_uri，带 authorization code
  → Nuxt server 用 code + secret 换 access_token（server-to-server）
  → 写 session cookie → 登录完成
```

标准 OAuth2 授权码模式，Nuxt 做 BFF 角色（持有 secret，换 token，管 session）。


### 人效和质量的可观测指标

→ [研发效率 + 质量指标 Top3](../wjm/cards/card1:observer/dev-efficiency-quality.md)

→ [AI Coding 可观测指标](../wjm/cards/card1:observer/ai-coding-metrics.md)


---

## resume-v3爆破
### R8 能做什么? Top3? 怎么配置和开启呢? 还需要配套什么文件吗?

| # | 能力 | 说明 |
|---|------|------|
| 1 | **Shrink（死代码移除）** | 未被引用的类/方法/字段从 DEX 中删除 |
| 2 | **Obfuscate（混淆）** | 类名/方法名缩短（`com.app.utils.Helper` → `a.b.c`） |
| 3 | **Optimize（优化）** | 方法内联、无用分支移除、常量折叠 |

**配置**：`android/app/build.gradle`

```groovy
buildTypes {
    release {
        minifyEnabled true        // 开启 R8
        shrinkResources true      // 移除未引用资源（需配合 minifyEnabled）
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

**配套文件**：`proguard-rules.pro`（白名单，告诉 R8 哪些类不能删/不能混淆——反射调用的、JNI 的、TurboModule 的）。[→ 详解](#注释proguard-rules)

---

### IDE中的 语法服务器, 是基于VUe的语法服务器veture改的? 语法服务器的本质是什么? 它的客户端是什么? 高亮和语法联想补全的底层逻辑流动是怎样的? 

**本质**：Language Server = 一个独立进程，通过 LSP（Language Server Protocol）和编辑器通信。编辑器是客户端，语法服务器是服务端。

**客户端**：IDE/编辑器（VS Code / 你的快应用 IDE）。通过 JSON-RPC over stdio/TCP 通信。

**你的快应用 IDE**：语法服务器是一个独立插件，基于 Vetur（Vue Language Server）改造——复用 Vetur 的 HTML 区域解析能力，扩展快应用 UX 自定义标签和属性的补全/校验规则。

**高亮 vs 补全的逻辑完全不同**：

| 能力 | 谁做的 | 原理 |
|------|--------|------|
| **语法高亮** | 编辑器本地（TextMate Grammar / TreeSitter） | 正则/语法规则匹配 token → 上色。**不经过 Language Server** |
| **补全/跳转/错误检查** | Language Server（远程进程） | 用户输入 → 编辑器发 `textDocument/completion` 请求 → Server 解析 AST → 返回补全列表 |

**流程（补全）**：

```
用户输入 "<di" → 编辑器发 JSON-RPC 请求 { method: "textDocument/completion", position }
  → Language Server 收到 → 解析当前文件 AST → 查找匹配的标签/属性
  → 返回 [{ label: "<div>", kind: "Tag" }, { label: "<dialog>", kind: "Tag" }]
  → 编辑器展示补全列表
```

一句话：**高亮是本地[正则匹配（TextMate Grammar）](#注释textmate-grammar)（快），补全是远程 AST 分析（准）。** LSP 让这两件事解耦——编辑器不需要懂语言语法，Server 不需要懂 UI。


---

## 快应用框架:大前端
### 快应用的构建结果是什么? 最小例子?是JS吗?还是json?

**构建产物 = JS bundle + JSON 模板树 + 资源文件**，打包成一个 `.rpk`（zip 格式）。

```
app.rpk (zip) 内部：
├── app.js           ← 全局逻辑（JS）
├── pages/
│   └── index/
│       ├── index.js       ← [页面逻辑](#注释快应用page-js)（JS，含 data/methods/生命周期）
│       └── index.json     ← 页面模板树（编译时从 .ux 模板编译而来）
├── manifest.json    ← 应用配置（路由/权限/入口声明）
└── assets/          ← 静态资源
```

**本质**：`.ux` 源码（类 Vue SFC）→ 编译器拆成 JS（逻辑）+ JSON（模板结构）+ CSS。不是纯 JS，也不是纯 JSON——两者配合。

---

### 是怎么构建的?每个阶段产物?

```
.ux 源文件
  → ① 编译器解析：拆分 <template> / <script> / <style> 三个区块
  → ② template → JSON 模板树（静态结构 + 数据绑定表达式标记）
  → ③ script → JS bundle（Webpack/Rollup 打包，含 Vue-like 运行时）
  → ④ style → CSS 对象（编译为内联样式规则）
  → ⑤ 打包为 .rpk（zip）
```

---

### 运行时框架加载后, 怎么运行+渲染出来? 渲染管线走J2v8注入的sendFrame的external function吗? diff过程发生在native层吗? 那么JS这边不diff? 是怎么渲染的?

**diff 在 JS 层做（虚拟 DOM diff），Native 只管执行渲染指令。**

```
1. Native 启动 V8 引擎（J2V8）→ 加载 JS bundle
2. JS 执行：创建虚拟 DOM 树 → 首次全量 diff → 产出 Action 列表（CREATE/UPDATE/DELETE）
3. JS 调 callNative（J2V8 注入的 external function）→ 把 Action 批量传给 Java 层
4. Java 层（RenderWorker IO 线程）解析 Action JSON → 创建/更新 Android View
5. 提交到 UI Thread → 上屏

数据变化时：
  JS 侧 setState → 重新 render → 虚拟 DOM diff（JS 层）→ 产出增量 Action
  → callNative 批量发送（阈值 50 条）→ Native 应用增量更新
```

**回答你的问题**：
- `sendFrame` / `callNative` = J2V8 注入的 external function，是 JS → Native 的通道
- **diff 在 JS 层**（infras.js 虚拟 DOM），不在 Native 层
- Native 层只收"渲染指令"并执行，不做 diff
- 和 RN 类比：RN 的 diff 也在 JS 层（React Reconciler），Fabric 层不做 diff


#### tick概念:渲染指令注册到微任务

多次数据变更合并到一个 tick 再统一 diff + sendFrame（= Vue 2 的 `nextTick` 模式）：

```
this.a = 1    // 标记 dirty，不立即 diff
this.b = 2    // 标记 dirty
this.c = 3    // 标记 dirty
// 同步代码执行完 → 微任务触发（Promise.then）：
//   → 一次性 diff 所有 dirty → 产出合并 Action → callNative 一次
```

**为什么放微任务**：同步代码可能连续改多个字段，每次 set 都 diff + Bridge 调用 = 浪费。微任务延迟 = 等同步跑完，合并所有变更，只 diff 一次，只发一次 sendFrame。

本质 = 批量合并（Vue 2 的 `queueWatcher` + `Promise.resolve().then(flushQueue)` 同一个思路）。

#### 1. 如果diff等,下沉到native层会不会性能更好?

理论更好，RN Fabric 就是这么做的。但快应用没这么做——成本高（需要 C++ 实现完整 vDOM + diff），"JS diff + 批量 callNative（50 条阈值）"作为折中够用。

#### 2. 这个时候, JS这边传递什么给native?

Fabric 模式：JS **不传数据**。JS 通过 JSI 直接操作 C++ Shadow Tree 的引用（共享内存），C++ 自己 diff + 布局 + 提交 UI Thread。零序列化。

快应用模式：JS 传 Action JSON 列表（`[{type:'UPDATE', id:3, props:{text:'hi'}}]`），Native 按指令执行。

#### 3.  那完整的虚拟dom tree 就意味着 传递的数据增多了?

不会。Fabric 的核心不是"传完整树给 Native diff"，而是 **JS 和 C++ 共享同一块内存**（Shadow Tree 是 C++ 对象，JS 通过 JSI 直接修改它）。不需要"传"——就像两个函数操作同一个变量。性能优势 = 去掉了序列化，不是"Native diff 比 JS diff 快"。

#### 1. J2v8的external func传递参数还需要序列化吗? 不能做到JSI那种内存共享吗

**J2V8 不需要 JSON 序列化**，但也做不到 JSI 的内存共享。J2V8 传参是 `V8Array` / `V8Object`（V8 的 C++ 对象包装），Java 侧拿到后逐字段 get 取值——比 JSON 快（不需要字符串解析），但比 JSI 慢（JSI 直接操作 C++ 对象引用，零拷贝）。

| 方案 | 传参方式 | 开销 |
|------|---------|------|
| JSON Bridge（旧 RN） | JSON.stringify → 字符串传递 → JSON.parse | 最慢 |
| J2V8 | V8Object 包装 → Java 逐字段 get | 中等（无字符串序列化，但有逐字段拷贝） |
| JSI（Fabric） | C++ 对象引用直传 | 零拷贝，最快 |

#### 2.  JS到C++ 层, 通过V8 是不是可以做到内存共享? 好比说external func调用的时候?

**JS → C++ 可以做到内存共享**（V8 的 External/ArrayBuffer 机制）。但 J2V8 的问题是 **C++ → Java 这一层**做不到——JNI 必须拷贝数据（Java 堆和 Native 堆是隔离的）。

```
JS ←(V8 内部共享内存)→ C++   ✅ 可以零拷贝
C++ ←(JNI 必须拷贝)→ Java    ❌ 做不到内存共享
```

所以快应用的瓶颈不在 JS→C++，而在 C++→Java 的 JNI 层。RN Fabric 的解法：把 diff/布局全留在 C++ 层做完，只把最终 View 操作通过 JNI 批量提交——减少 JNI 调用次数。

---

# 注释

<a id="hydration水合"></a>
### Hydration（水合）

Nuxt/Vue 自动处理，不需要手动调用。流程：
1. 服务端 `renderToString` → 输出 HTML
2. HTML + 序列化状态（`window.__NUXT__`）发给浏览器
3. 浏览器加载 JS → Vue 自动 hydrate（绑定事件到已有 DOM，不重建 DOM）

**你需要关心的唯一场景**：Hydration Mismatch 报错（服务端 HTML ≠ 客户端期望 DOM）。

常见原因 + 解法：
- `Date.now()` / `Math.random()`（两端值不同）→ 用 `useAsyncData` 统一
- `window` / `document`（服务端没有）→ 放 `onMounted` 或 `<ClientOnly>` 包裹
- 第三方库只支持客户端 → `<ClientOnly>` 包裹

<a id="注释p95"></a>
### P95 响应时间

- "全局 P95 = 200ms"的意思是：过去 5 分钟，不管哪个接口，95% 的请求在 200ms 内完成。上传接口那几个 120s 的请求如果占比 < 5%，全局 P95 可能看不出异常——所以要对关键接口单独设告警。

- **本质**：OTel 给每个请求记录耗时到 histogram bucket，Prometheus 用 `histogram_quantile(0.95, ...)` 从 bucket 分布中插值算出 95 分位。全局 = 所有请求不分接口混算；按接口 = 加 `http.route` 标签分组算。关键接口（如上传）要单独设告警阈值，否则占比 < 5% 时全局 P95 看不出异常。

<a id="注释pod"></a>
### Pod

K8s 的最小部署单元（虚拟的，不是物理机）。可以理解为一个 Docker 容器实例。"2 Pod 部署"= 同时跑两个相同的 Docker 容器（各跑一个 Node.js server），负载均衡 + 一个挂了另一个兜底。Pod 挂了 K8s 会自动重启（但重启期间该实例不可用）。

<a id="注释rss"></a>
### RSS（Resident Set Size）

进程实际占用的物理内存总量（包括 JS 堆 + C++ 层 + Node 内部 buffer + 共享库等）。是 K8s 判断 OOM Kill 的依据——容器 memory limit 比的就是 RSS。`process.memoryUsage().rss` 获取。Heap Used 只是 RSS 的子集（JS 堆），RSS 才是"真正占了多少物理内存"。

<a id="注释像素级对比"></a>
### 像素级对比
- python库可以做到

[Playwright](#注释playwright) 内置视觉回归，一行代码搞定：

```typescript
await expect(page).toHaveScreenshot('home.png', { maxDiffPixelRatio: 0.05 });
```

首次运行生成基准截图，后续每次对比。差异 > 5% 自动 fail。底层用 `pixelmatch` 库——两张图转像素矩阵 → 逐像素 RGB 差值 → 算差异像素占比。Python 也能做（Pillow + numpy），但 Playwright 内置最省事。

<a id="注释playwright"></a>
### Playwright

微软开源的浏览器自动化测试框架（2020），替代 Puppeteer/Cypress。支持 Chromium/Firefox/WebKit 三引擎，API 支持 JS/TS/Python/Java/.NET。核心能力：E2E 测试 + 截图对比（视觉回归）+ 网络拦截 + 移动端模拟。CI 中常用来做自动化回归测试和视觉 diff。

<a id="注释ai采纳率统计"></a>
### AI 代码采纳率怎么统计

靠 **AI 工具自身的 telemetry**，不是 git 层面标记：

| 工具 | 数据来源 |
|------|---------|
| Copilot 企业版 | 自带 usage dashboard（展示次数 / accept 次数 / accept 率） |
| Cursor | Settings → Usage 面板 |
| Kiro | Supervised 模式下每个 hunk 有 accept/reject 操作记录；Autopilot 模式通过 git diff（Kiro 产出的 commit）统计代码量 |
| 自建 Agent（Mako） | Agent Trace 系统记录每次 file write 的产出 + 用户后续是否 revert |

**Kiro 具体怎么统计**：
- **Supervised 模式**：Kiro 每次编辑后 yield，用户逐 hunk accept/reject → 直接统计 accept hunk 数 / 总 hunk 数
- **Autopilot 模式**：Kiro 自动完成任务 → 产出 git diff → 用户 review 后 revert 的行数 = 未采纳。或者看"Kiro session 产出的代码最终进入 main 的比例"

本质：不需要在代码里标记"AI 写的"——工具侧有完整的 session → edit → accept/reject 链路数据。

**落地方案（Kiro 等无 telemetry API 的工具）**：通过 git 层面做约定 + CI 脚本统计：
1. 团队约定 AI 产出的 commit 带标记（`[kiro]` prefix 或 `Co-authored-by: Kiro`）
2. CI 在 PR merge 时跑脚本，解析 commit message → 统计带标记的代码行数占比
3. 不依赖工具内部数据，统计口径与工具无关

<a id="注释design-token"></a>
### Design Token（设计 token）

设计师在 Figma 里定义的**设计规范变量**（不是 LLM token）：`$color-primary: #1A73E8` / `$spacing-md: 16px` / `$font-size-body: 14px`。

"token 约束"= Figma MCP 提取 token 列表 → 注入 AI Agent 上下文 → AI 生成代码时引用变量名（`spacing.md`）而不是硬编码值（`15px`）。减少"设计师说 16px 你写了 15px"这种偏差。

<a id="注释nuxt-oauth2配置"></a>
### Nuxt OAuth2 配置

Nuxt 3 用 `nuxt-auth-utils` 模块（官方推荐），配置：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-auth-utils'],
  runtimeConfig: {
    oauth: {
      // 公司 SSO 的 OAuth2 端点
      clientId: process.env.SSO_CLIENT_ID,
      clientSecret: process.env.SSO_CLIENT_SECRET,
      authorizeUrl: 'https://sso.xiaomi.com/oauth2/authorize',
      tokenUrl: 'https://sso.xiaomi.com/oauth2/token',
      redirectUrl: 'https://perf.xiaomi.com/api/auth/callback',
    }
  }
})
```

写一个 server route 处理回调：

```ts
// server/api/auth/callback.ts
export default defineOAuthEventHandler({
  async onSuccess(event, { tokens }) {
    // tokens.access_token → 存 session
    await setUserSession(event, { token: tokens.access_token })
    return sendRedirect(event, '/')
  }
})
```

然后在 `server/middleware/auth.ts` 里检查 session，无 session 就 302 到 SSO。整个流程 Nuxt server 端完成，前端无感。

<a id="注释proguard-rules"></a>
### proguard-rules.pro

**为什么需要**：R8 做静态分析，看不到动态调用的引用关系 → 误删/误混淆 → 运行时 ClassNotFoundException 崩溃。

**哪些场景必须 keep**：

| 场景 | 原因 | 示例 |
|------|------|------|
| 反射调用 | `Class.forName("xxx")` R8 看不到引用 | 快应用模块动态加载 |
| JNI 方法 | C++ 通过固定签名调 Java | NDK Bridge |
| JSON 序列化 | 字段名被混淆后映射失败 | Gson/Moshi 的 data class |
| TurboModule | JSI 通过字符串名查找 Java 类 | RN Native Module |

**最小例子**（`android/app/proguard-rules.pro`）：

```proguard
# 反射加载的模块类 — 不能删、不能改名
-keep class com.xiaomi.quickapp.module.** { *; }

# Gson 序列化的 Model — 字段名不能混淆
-keepclassmembers class com.myapp.model.** {
    <fields>;
}

# JNI 调用的类 — C++ 侧用固定签名调
-keepclasseswithmembernames class * {
    native <methods>;
}
```

**配置位置**：`android/app/proguard-rules.pro`，在 `build.gradle` 的 `proguardFiles` 里引用。不写这个文件也能编译，但运行时可能崩。

<a id="注释textmate-grammar"></a>
### TextMate Grammar（语法高亮正则）

VS Code 的语法高亮靠 `.tmLanguage.json` 文件——你写正则规则，定义"什么文本模式 = 什么 token 类型（scope name）"。编辑器根据 scope name 查主题颜色表上色。

最小例子（`syntaxes/ux.tmLanguage.json`）：

```json
{
  "scopeName": "source.ux",                          // 语言标识
  "patterns": [{ "include": "#tag" }],               // 顶层规则入口
  "repository": {
    "tag": {
      "match": "(</?)(\\w+)",                        // 正则匹配 <div> </div>
      "captures": {
        "1": { "name": "punctuation.definition.tag.ux" },  // < 符号 → scope: 标点
        "2": { "name": "entity.name.tag.ux" }              // div → scope: 标签名
      }
    }
  }
}
```

**高亮底层逻辑流动**：

```
用户输入 "<div>" 
  → 编辑器逐行跑 tmLanguage 正则
  → 匹配到 "(</?)(\\w+)" 
  → 第 1 组 "<" 标记为 scope "punctuation.definition.tag"
  → 第 2 组 "div" 标记为 scope "entity.name.tag"
  → 编辑器查当前主题色表：punctuation → 灰色，entity.name.tag → 蓝色
  → 渲染上色
```

全程本地（编辑器主线程），不走网络，不走 Language Server。所以打字时高亮是即时的。

每条规则 = 正则 + scope name。你不写颜色，只写分类——颜色由用户主题决定。快应用 IDE 复用 HTML 的 tmLanguage 基础规则，扩展自定义标签的匹配规则。

<a id="注释快应用page-js"></a>
### 快应用 page JS 构建产物长什么样

编译后的 `index.js` 本质是一个模块定义（类 Vue Options API），被打包器包裹：

```js
// 编译产出的 index.js（简化）
define("pages/index", function(require, module, exports) {
  module.exports = {
    data: {
      title: "Hello",
      count: 0
    },
    onInit() {
      // 生命周期：页面初始化
    },
    methods: {
      increment() {
        this.count++  // 触发响应式 → diff → callNative 更新 View
      }
    }
  }
})
```

运行时框架（infras.js）加载这个模块 → 创建响应式代理（类 Vue2 的 Object.defineProperty）→ 结合 JSON 模板树生成虚拟 DOM → 首次渲染。数据变化时自动触发 diff + callNative。
