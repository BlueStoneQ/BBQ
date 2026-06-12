# Web 前端可观测

> 解决什么：Web 页面上线后，用户体验好不好？加载快不快？有没有白屏？

---

## 核心 3 指标（必记）

| 指标 | 含义 | 优秀 | 正常 | 差（告警） | 采集 |
|------|------|------|------|-----------|------|
| **LCP** | 最大内容绘制（用户觉得"加载完了"） | < 1.5s | < 2.5s | > 4s | PerformanceObserver |
| **CLS** | 累计布局偏移（页面跳不跳） | < 0.1 | < 0.25 | > 0.25 | PerformanceObserver |
| **INP** | 交互到下一帧（点击响应快不快） | < 200ms | < 500ms | > 500ms | PerformanceObserver |

---

## 全量指标

| 维度 | 指标 | 含义 | 采集方式 |
|------|------|------|---------|
| **加载** | FCP / LCP / TTFB | 首绘 / 最大内容 / 首字节 | Performance API |
| **交互** | INP / FID | 交互延迟 | PerformanceObserver |
| **稳定** | CLS | 布局偏移 | PerformanceObserver |
| **资源** | JS/CSS 体积、请求数、缓存命中率 | 加载量 | Resource Timing |
| **错误** | JS Error 率、白屏率 | 可用性 | window.onerror + 白屏检测 |
| **业务** | PV/UV、跳出率、转化率 | 业务健康 | 埋点 |

---

## CLS 详解

**CLS（Cumulative Layout Shift）**= 无单位的累积分数。

| 评级 | CLS 值 | 含义 |
|------|--------|------|
| 好 | < 0.1 | 几乎不跳 |
| 需改善 | 0.1 - 0.25 | 有可感知偏移 |
| 差 | > 0.25 | 明显跳动 |

**怎么算**：每次布局偏移 = 偏移面积 × 偏移距离。页面生命周期内所有偏移累加。

**常见原因**：
- 图片没设宽高（加载后撑开）
- 字体闪烁（FOUT）
- 动态插入 banner/广告
- 异步数据回来后 DOM 插入

**修复**：给图片/视频设固定宽高（`aspect-ratio`）、字体 `font-display: optional`、骨架屏占位。

---

## 采集方案

Web 前端可观测一般用**独立 SDK**（不是 OTel，因为浏览器环境和 Node 不同）：

| 方案 | 类型 | 特点 |
|------|------|------|
| **web-vitals**（Google） | 开源库 | 只采集 Core Web Vitals（LCP/CLS/INP），极轻量 |
| **Sentry Browser SDK** | 错误 + 性能 | JS Error 上报 + 基础性能追踪 |
| **自建探针 SDK** | 自建 | 秒开率/白屏检测/自定义埋点（你做过） |

**最佳实践**：`web-vitals`（Core Web Vitals）+ Sentry（错误）+ 自建 SDK（业务埋点/白屏检测）。

---

## 异常排查

| 指标异常 | 常见原因 | 排查 | 处理 |
|---------|---------|------|------|
| LCP 高 | 大图未优化 / 阻塞资源 / SSR 慢 | Lighthouse + Performance 面板 | 图片压缩/懒加载/预加载关键资源 |
| CLS 高 | 图片无宽高 / 字体闪烁 / 动态插入 | Layout Shift 调试 | 设宽高/骨架屏/字体预加载 |
| INP 高 | 长任务阻塞主线程 | Performance 面板找 Long Task | 拆分任务/Web Worker/虚拟列表 |
| JS Error 飙高 | 代码 Bug / 第三方脚本报错 | Sentry 堆栈 | 修 Bug / try-catch / 移除问题脚本 |
| 白屏 | JS 加载失败 / 渲染报错 | 白屏检测 SDK | 降级 CSR / 兜底页 / CDN 回源 |

---
