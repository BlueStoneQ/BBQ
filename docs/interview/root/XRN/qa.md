# XRN Q&A

> Root 二面准备。对方可能很懂 Android/iOS，会追问 Native 层细节。
>
> 策略：问点答面答体系。每个问题都是展示"我能建完整大前端工程化体系"的入口。

---

## 目录

- [开发全链路：构建到发布](#开发全链路构建到发布)
  - [分 Bundle 构建原理](#分-bundle-构建原理)
  - [热更新全流程](#热更新全流程)
  - [差量更新原理（bsdiff）](#差量更新原理bsdiff)
  - [灰度 + 回滚机制](#灰度--回滚机制)
  - [和 CodePush 的区别](#和-codepush-的区别)
- [架构与原理](#架构与原理)
  - [核心大件 + 全链路覆盖](#核心大件--全链路覆盖)
  - [分 Bundle 加载时序](#分-bundle-加载时序)
  - [Native 壳多 Bundle 文件管理](#native-壳多-bundle-文件管理)
  - [性能监控（Native 侧）](#性能监控native-侧)
- [稳定性保障](#稳定性保障)
  - [白屏检测](#白屏检测)
  - [热更新后 crash/白屏处理（CrashGuard）](#热更新后-crash白屏处理crashguard)
  - [稳定性保障全景](#稳定性保障全景)
- [选型与生态](#选型与生态)
  - [为什么不选 Expo](#为什么不选-expo)
  - [Expo 对 XRN 的启发](#expo-对-xrn-的启发)
  - [Push Server 部署方案](#push-server-部署方案)
  - [可观测体系是必须的](#可观测体系是必须的)

---

# 开发全链路：构建到发布

---

## 分 Bundle 构建原理

**本质**：构建时排除，运行时共享。`processModuleFilter` 是核心 — 让 business bundle 只含业务代码，公共依赖引用指向 common。

### Common Bundle 包含什么

```
common.hbc = React + RN + Navigation + 团队公共组件/工具
= 所有 business bundle 的运行时基座
= App 启动时同步加载一次
```

### 为什么 business bundle 不会重复打入 React

```
代码里正常写 import React from 'react'
Metro 构建 business bundle 时：
  → 解析到 react → 得到 moduleId
  → processModuleFilter 检查：该 ID 在 commonModuleIds 里？
  → 在 → return false → react 源码不写入 bundle
  → 但 __r(moduleId) 引用保留在 bundle 里

运行时：
  → common.hbc 先加载 → react 注册到全局模块表 __d(moduleId, factory)
  → business.hbc 执行 __r(moduleId) → 从全局表找到 → 用 common 的

= 类似 C 的 extern：声明存在但定义在别处
```

### processModuleFilter 配置

```js
// metro.config.js（构建 business bundle 时）
// commonModuleIds.json = 构建 common 时自动产出的副产物（记录所有已打入的模块 ID）
const commonModuleIds = new Set(require('./commonModuleIds.json'))

module.exports = {
  serializer: {
    createModuleIdFactory: () => (path) => hashPath(path), // 跨 bundle 一致的 ID
    processModuleFilter: (module) => {
      // common 已有 → 排除；自己的 → 打入
      return !commonModuleIds.has(module.id)
    }
  }
}

// commonModuleIds.json 怎么来的：构建 common 时记录所有打入的模块 ID
```

### 开发阶段怎么跑

```
开发时 = 普通 Monorepo，不分 Bundle：
  → 根目录 npx react-native start → Metro 全量加载
  → 和正常 RN 开发一样（HMR/调试全正常）
  → 分 Bundle 只在 xrn build 时生效，开发者无感知

依赖管理：
  公共依赖 → 根 package.json，pnpm hoist 到根 node_modules
  业务独有依赖 → 各 package 自己的 package.json
  版本统一靠 pnpm-lock.yaml
```

---

## 热更新全流程

→ 详见 [hot-update.md](./hot-update.md#全流程)

---

## 差量更新原理（bsdiff）

→ 详见 [hot-update.md](./hot-update.md#差量更新bsdiff)

---

## 灰度 + 回滚机制

→ 详见 [hot-update.md — 灰度](./hot-update.md#灰度策略) / [回滚](./hot-update.md#回滚机制)

---

## 和 CodePush 的区别

→ 详见 [hot-update.md](./hot-update.md#vs-codepush)

---

# 架构与原理

---

## 核心大件 + 开发全链路覆盖

**Q：XRN 的架构有哪些核心部件？覆盖了开发到运维的哪些环节？**

| 阶段 | 部件 | 做什么 |
|------|------|--------|
| 开发 | @x-rn/cli | create / dev / build / publish 一键命令 |
| 构建 | @x-rn/bundler | Metro 多 entry 分 Bundle + Hermes AOT |
| 发布 | @x-rn/publisher | 上传 OSS + 通知 Server + 触发 diff |
| 分发 | @x-rn/server | 版本管理 + 灰度策略 + 差量计算 + 回滚 |
| 更新 | @x-rn/updater | 客户端：检查更新 / 下载 / bspatch / 生效 |
| 监控 | @x-rn/monitor | JS+Native 采集 → Sentry → 联动回滚 |
| 运行 | Native Shell | 多 Bundle 加载器 + 实例池 + CrashGuard |

= 7 个核心部件，覆盖开发→构建→发布→分发→更新→监控完整闭环。

---

## 分 Bundle 加载时序

**Q：Native 壳启动时，Common 和 Business Bundle 的加载时序？**

```
1. Native 壳启动（Application.onCreate）
2. 创建 ReactHost（RN 引擎）
3. 同步加载 Common Bundle（common.hbc）— 必须先加载
4. Common 就绪 → RN Runtime 可用
5. 按策略加载 Business Bundle：
   → preload：立即异步（首页/搜索）
   → idle：主线程空闲时
   → onDemand：用户触发时
6. Business Bundle 加载 = 注册 RN 组件到 AppRegistry
7. Native 路由跳转 → AppRegistry 找到组件 → ReactRootView 渲染
```

```kotlin
// Android 实现（简化）
class XRNApplication : Application() {
  override fun onCreate() {
    reactHost = ReactHost.create(this, config)
    reactHost.loadBundle("common.hbc", synchronous = true)
    // 延迟预热实例池
    Handler().postDelayed({ instancePool.warmUp() }, 3000)
  }
}
```

---

## Native 壳多 Bundle 文件管理

**Q：本地多版本 Bundle 怎么管理？启动时加载哪个？**

```
/data/data/com.app/files/xrn/
├── common/v1.0.0/common.hbc
├── home/v2.3.0/home.hbc
├── home/v2.3.1/home.hbc     ← pending
└── manifest.json

manifest.json:
  { "home": { "current": "v2.3.0", "pending": "v2.3.1", "fallback": "builtin" } }

加载决策：
  1. 有 pending → 尝试加载
  2. 成功 → pending 变 current
  3. 失败/crash → 回退 fallback
  4. fallback 也挂 → 加载 APK 内置 builtin
```

---

## 性能监控（Native 侧）

**Q：RN App 性能监控，Native 侧怎么采集？**

| 平台 | 指标 | 采集方式 |
|------|------|---------|
| **Android** | FPS | Choreographer.FrameCallback |
| | ANR | 主线程 Watchdog（超时检测） |
| | Crash | UncaughtExceptionHandler + Signal Handler |
| | 内存 | Debug.getMemoryInfo() |
| | 启动 | ContentProvider.onCreate → reportFullyDrawn |
| **iOS** | FPS | CADisplayLink |
| | 卡顿 | RunLoop Observer |
| | Crash | PLCrashReporter |
| | 内存 | task_info(MACH_TASK_BASIC_INFO) |
| | 启动 | main() → viewDidAppear |
| **RN 特有** | JS Error | ErrorUtils.setGlobalHandler |
| | Bundle 加载时间 | loadScriptFromFile 前后打点 |
| | 首屏渲染 | ReactMarker(CONTENT_APPEARED) |

---

# 稳定性保障

> RN App 稳定性 = 发布前防 + 发布中控 + 发布后治。用户永远能看到一个可用版本。

---

## 白屏检测

**Q：如何检测到 RN 白屏？**

```
方案 A（主方案）：超时检测
  → ReactRootView 创建后启动 5s 定时器
  → 监听 ReactMarker.CONTENT_APPEARED
  → 5s 未收到 = 白屏 → 降级页 + 上报

方案 B（兜底）：View 树检测
  → childCount == 0 超过阈值 = 白屏

方案 C（离线分析）：像素采样
  → 截图 → > 95% 同色 = 白屏
```

---

## 热更新后 crash/白屏处理（CrashGuard）

**Q：热更新后出现 crash/白屏，XRN 怎么处理？**

```
三层防线：

Layer 1：客户端 CrashGuard
  → 启动递增 crash 计数器
  → 正常运行 5s → 清零
  → 连续 crash 2 次 → 回退 fallback → 上报

Layer 2：白屏降级
  → 5s 超时 → Native 降级页 + 上报

Layer 3：服务端停灰度
  → crash 率 > 0.5% → 自动停止推送
  → 已下载用户靠 CrashGuard 回退
```

**CRN vs XRN**：

| | CRN | XRN |
|--|-----|-----|
| crash 阈值 | 3 次 | 2 次（更激进） |
| 白屏检测 | ReactMarker 超时 | ReactMarker + childCount 双重 |
| 版本保留 | 最近 3 个 | current + fallback + builtin |

---

## 稳定性保障全景

```
发布前（Prevention）：
  - ErrorBoundary 包裹每个页面
  - TypeScript 类型约束
  - CI 门禁（Lint + Test + hash 校验）

发布中（Control）：
  - 灰度 5% → 30% → 100%
  - crash > 0.5% → 自动停灰度
  - 热更新：hash 校验 → silent load → 才生效

发布后（Recovery）：
  | 指标      | 正常    | P1     | P0     |
  |-----------|---------|--------|--------|
  | Crash 率  | < 0.3% | > 0.5% | > 2%   |
  | ANR 率    | < 0.1% | > 0.3% | > 1%   |
  | 白屏率    | < 0.5% | > 2%   | > 5%   |
  | JS Error  | < 0.1% | > 0.5% | > 2%   |

  自动：CrashGuard 回退 + Server 停灰度
  人工：P0 回滚 / P1 hotfix / 5 Why 复盘
```

**一句话**：三阶段分层防御，用户永远有兜底版本。

---

# 选型与生态

---

## 为什么不选 Expo

| 原因 | 详细 |
|------|------|
| 不支持分 Bundle | 单 Bundle 架构，无法模块独立热更新 |
| Native 层不可控 | 无法自定义加载器/实例池/CrashGuard |
| 热更新粒度粗 | EAS Update 整包更新，不支持模块级灰度 |
| 构建依赖云端 | EAS Build 付费 + 排队 |

```
Expo = "帮你管 Native，你别碰"
XRN = "Native 层是核心能力，必须自己控制"
```

---

## Expo 对 XRN 的启发

| Expo 优点 | XRN 吸收 |
|-----------|----------|
| CLI 极简 | `xrn create/publish` 一行搞定 |
| OTA 内置 | @x-rn/updater 接入 3 行代码 |
| Config Plugin | `xrn.config.ts` 统一声明，不改 Native |
| 云端构建 | CI 模板：push 即构建即发布 |
| 文档驱动 | 先写 PRD/Architecture，代码跟文档走 |

---

## Push Server 部署方案

**结论：自建代码 + 云上部署 = 最优解。**

```
为什么自建（而非 CodePush/EAS）：
  - 分 Bundle 粒度第三方不支持
  - 灰度策略是业务强相关
  - 自动回滚需和 CrashGuard 上报联动
  - 数据可控不出境

为什么云上（而非自建机房）：
  - CDN 天然需要云（Bundle 分发就是 CDN 场景）
  - OSS 弹性存储 + 运维少
  - 成本低（¥500/月）

技术栈：Fastify + PostgreSQL + S3/OSS
推荐：代码自建（@x-rn/server）+ 云部署（ECS + OSS + CDN + RDS）
核心 API 3 天，生产级全套 2-3 周。
```

---

## 可观测体系是必须的

**结论：可观测不是锦上添花，是热更新体系的必要组件。**

```
为什么"必须"：
  - 热更新 = 高风险发布（不经应用商店审核）
  - CrashGuard 自动回滚依赖上报数据
  - 灰度"阈值停灰度"依赖 crash 率统计
  - 没有监控的热更新 = 盲人开车

@x-rn/monitor 的定位：
  不是替代 Sentry，而是：
  1. 封装 Sentry SDK（统一 API + 扩展 Bundle 特有指标）
  2. 和热更新联动（新版本 crash → 触发回滚）
  3. 和 Server 联动（上报 → Server 判断停灰度）

= 可观测是热更新闭环的一环，不是独立的东西
```

→ 详细设计方案见 [observability.md — @x-rn/monitor 设计方案](./observability.md#x-rnmonitor-设计方案)

---
