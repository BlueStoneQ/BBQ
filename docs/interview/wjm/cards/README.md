# WJM 牌组

> 三张大牌 + 一张小牌。大牌 = 核心竞争力，聚焦不分散。

---

## 牌组总览

| 牌 | 名称 | 核心 | 紧急度 |
|----|------|------|--------|
| **🃏 1** | [可观测体系](./card1:observer/README.md) | 指标→探针→上报→看板→治理（四层覆盖） | 🔴 |
| **�� 2** | [工程化全链路](./card2:engineering/README.md) | CI/CD + 热更新 + 灰度 + 卡控 | 🔴 |
| **🃏 3** | [Native 容器(Shell) : 三层双端融合定制](./card3:native-shell/README.md) | ((RN/H5)/Native(Android/IOS)/C++), WebView+Bridge / TurboModule / XRN:多 Bundle native shell | 🟡 |
| **🃁** | AI 工程化（小牌）`TODO` | 混合应用 AI coding 全链路，挂 card2 下 | 🟡 |

---

## 🃏 牌 1：可观测体系

> 命中 JD 第3条（性能瓶颈）+ 海外上线刚需

**子集**：[root: card-1 性能优化](../../root/cards/card-1/README.md)

**本次覆盖**：H5 / RN / Android / iOS 四层完整可观测链路

```
指标定义 → 探针采集 → 上报通道 → 后端存储 → 看板展示 → 治理闭环
```

| 层 | 指标 | 探针 | 上报 |
|---|------|------|------|
| H5 | FCP/LCP/CLS/白屏 | Performance API + 自定义埋点 | Bridge → Native 通道 |
| RN | 启动/FPS/内存/Crash | Choreographer/CADisplayLink + Sentry | Sentry SDK |
| Android | ANR/Native Crash/OOM | UncaughtExceptionHandler + Breakpad | Sentry/自建 |
| iOS | Watchdog/Jetsam/Crash | MetricKit + PLCrashReporter | Sentry/自建 |

**后端 + 看板**：Sentry（错误）+ Firebase Performance（性能）+ 自建埋点（业务）

**治理**：灰度阶段观测 → 异常自动回滚 → 版本对比 → 防退化基线

→ [root: card-1](../../root/cards/card-1/README.md)

---

## 🃏 牌 2：工程化全链路

> 命中 JD 第3条（CI/CD + 工程化基建）

```
开发全链路：
  CLI 脚手架 → 调试 → 构建 → 发布 → 监控（→ 牌1）

质量卡控：
  ESLint + TypeScript → Git Hooks → CI 门禁 → Code Review

CD 三条线：
  H5 → CDN 灰度发布
  RN Bundle → 热更新灰度发布
  Native 包 → 商店审核发布

热更新体系：
  自建服务（Node.js）→ 灰度 → 全量 → 异常回滚
```

→ [全链路工程化详解](./card2:engineering/engineering-fullchain.md)
→ [prep: 工程化 & CI/CD](./card2:engineering/prep-engineering.md)

---

## 🃏 牌 3：Native Shell 多层融合定制

> 命中 JD 第2条（多端架构）+ 第5条（跨端容器 + Hybrid + JSBridge）

**三个子方向，统一在"Native Shell"这个大主题下**：

### ① WebView + H5 + Bridge

- 定制 WebView 容器（池化 + 离线包 + 安全管控）
- 三种 Bridge 设计对比：
  - H5 WebView Bridge（@JavascriptInterface / messageHandlers）
  - RN JSI Bridge（HostFunction / HostObject）
  - 快应用 J2V8 Bridge（直接持有引擎）

→ [JS Bridge 三段式设计](../prep/js-bridge-2.md)
→ [WebView 容器优化](../prep/qa-webview.md)

### ② RN TurboModule

- JS Spec → Codegen → C++ JSI → JNI/ObjC++ → Native 实现
- 自定义 Native 模块（BLE/支付/音视频）
- iOS / Android / C++ 三层全覆盖

→ [root: card-2 跨层通信架构](../../root/cards/card-2/README.md)

### ③ XRN：RN 多 Bundle 容器

- Expo → Bare → 自建 Shell 演进路径
- 多 Bundle 加载运行机制 + 实例管理
- 统一路由底座（URL 路由 → RN/H5/Native 三类页面）
- 容器预创建 + 实例池
- C++ 层性能逻辑下沉

→ [XRN 文档目录](../../root/XRN/README.md)
→ [Bundle 加载运行](../../root/XRN/bundle-runtime.md)
→ [Native Shell](../../root/XRN/native-shell.md)
→ [路由设计](../../root/XRN/route.md)

---

## 🃁 小牌：AI 工程化

> 命中 JD 第2条（AI 驱动架构 + Agent 为核心生产力）
> 非核心，体现差异化。挂在 card2（工程化）下。

- [ ] AI 友好的代码库结构设计
- [ ] 混合应用（H5 + RN + Android + iOS）的 AI Coding 全链路
- [ ] Mako Agent + MCP Server + Steering/SDD
- [ ] 专题文档

→ TODO：待补充，暂挂 [card2:engineering](./card2:engineering/README.md)
