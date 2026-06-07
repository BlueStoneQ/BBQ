# 前端工程化体系

> 本质：让开发全链路从"人工手动"走向"工具自动化"再到"AI 自主化"。
>
> 在 DD 运营平台场景下，工程化不是"配 Webpack"，是构建一套支撑多团队、多子应用、快速迭代的技术基础设施。

---

## 三个子方向

| 方向 | 解决什么 | 核心手段 |
|------|---------|---------|
| [构建与研发流程](./build-pipeline.md) | 代码怎么从本地到线上 | Webpack/Vite + CI/CD + 脚手架 + Lint/Hooks |
| [Vite 深入](./vite.md) | 构建工具原理 | ESM + esbuild + Rollup + 插件系统 + Dev/Prod 差异 |
| [性能工程化](./performance.md) | 页面怎么更快 | 指标采集 + 优化手段 + 性能预算 + WebView 优化 |
| [稳定性建设](./stability.md) | 线上怎么不挂 | 监控告警 + 灰度 + 降级 + 应急响应 |
| [白屏检测](./blank-screen-detection.md) | 白屏怎么发现和恢复 | DOM 检测 + 采样点 + 自动刷新 + 上报告警 |

---

## 和我的主线叙事的关系

```
效率治理 → build-pipeline.md（工具让人做得快）
质量建设 → build-pipeline.md 的 Lint/CI/CD 部分 + stability.md 的"防"阶段
稳定性建设 → stability.md（线上出问题快速发现恢复）
性能优化 → performance.md（用户体验的量化治理）
AI Agent 化 → 贯穿三者（AI 跑在这套工具 + 护栏里）
```
