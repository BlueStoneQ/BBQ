# RN + APK 可观测体系

> 第一性原理：移动端不可观测 = 用户反馈驱动（被动）。建可观测体系 = 问题自动浮现（主动）。
>
> 本质：在 Native + JS 双层采集数据 → 聚合分析 → 告警 → 治理闭环。
>
> 对应 XRN 中的 `@x-rn/monitor` 模块。

---

## 目录

- [核心指标（只记 5 个）](#核心指标只记-5-个)
- [采集架构](#采集架构)
- [Native 侧采集（Android / iOS）](#native-侧采集android--ios)
- [JS 侧采集](#js-侧采集)
- [RN 特有指标](#rn-特有指标)
- [上报架构](#上报架构)
- [告警策略](#告警策略)
- [发版后观测 SOP](#发版后观测-sop)

---

## 核心指标（只记 5 个）

| 指标 | 一句话 | 我们的数据 | 正常 | 差（告警） |
|------|--------|-----------|------|-----------|
| **Crash 率** | App 崩没崩 | 0.1% | < 0.3% | > 1% |
| **ANR 率** | 主线程卡没卡死 | 0.05% | < 0.1% | > 0.5% |
| **冷启动时间** | 用户等多久 | 1.2s | < 2s | > 3s |
| **FPS（帧率）** | 滑动流不流畅 | 57fps | > 55fps | < 45fps |
| **JS Error 率** | RN 层有没有 Bug | 0.08% | < 0.1% | > 0.5% |

---

## 采集架构

```
┌─────────────────────────────────────────────────────────────┐
│                     RN App 运行时                             │
│                                                             │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │   JS 层采集      │     │      Native 层采集           │   │
│  │                 │     │                             │   │
│  │ • JS Error      │     │ • Crash（Java/OC + Native）  │   │
│  │ • 首屏时间       │     │ • ANR（主线程 Watchdog）     │   │
│  │ • Bundle 加载    │     │ • FPS（Choreographer/CADisplay）│ │
│  │ • 接口成功率     │     │ • 内存（PSS/Heap）           │   │
│  │ • 面包屑         │     │ • 启动时间                   │   │
│  └────────┬────────┘     └──────────────┬──────────────┘   │
│           │                              │                  │
│           └──────────────┬───────────────┘                  │
│                          ▼                                  │
│              ┌──────────────────────┐                       │
│              │  @x-rn/monitor SDK   │                       │
│              │  统一上报队列         │                       │
│              │  批量 + 压缩 + 重试   │                       │
│              └───────────┬──────────┘                       │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端（Sentry / 自建）                      │
│  聚合 → Dashboard → 告警 → 归因                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Native 侧采集（Android / iOS）

### Android

| 指标 | 采集方式 | 原理 |
|------|---------|------|
| **Crash（Java）** | `Thread.setUncaughtExceptionHandler` | 捕获未处理异常 |
| **Crash（Native/C++）** | Signal Handler（SIGSEGV/SIGABRT） | 捕获 Native 崩溃信号 |
| **ANR** | 主线程 Watchdog：post 延迟消息到主线程，超时未执行 = ANR | 5s 超时 |
| **FPS** | `Choreographer.FrameCallback`：每帧回调，统计 16ms 内完成率 | 掉帧 = 未在 16ms 内完成 |
| **内存** | `Debug.getMemoryInfo()`：PSS / Java Heap / Native Heap | 定时采样（30s 一次） |
| **启动时间** | `ContentProvider.onCreate()` → 首帧 `reportFullyDrawn()` | 系统 API |

### iOS

| 指标 | 采集方式 | 原理 |
|------|---------|------|
| **Crash** | PLCrashReporter / `NSSetUncaughtExceptionHandler` | 信号捕获 + Mach Exception |
| **卡顿/ANR** | RunLoop Observer：主线程 RunLoop 状态超时检测 | kCFRunLoopBeforeSources → kCFRunLoopAfterWaiting 间隔 > 阈值 |
| **FPS** | `CADisplayLink`：每帧回调，统计间隔 | 和 Android Choreographer 同理 |
| **内存** | `task_info(MACH_TASK_BASIC_INFO)`：resident size | 系统 API |
| **启动时间** | `main()` → `viewDidAppear` 时间差 | 手动打点 |

---

## JS 侧采集

| 指标 | 采集方式 | 说明 |
|------|---------|------|
| **JS Error** | `global.ErrorUtils.setGlobalHandler` | RN 全局错误捕获 |
| **未处理 Promise** | `global.onunhandledrejection` | 异步错误 |
| **首屏渲染时间** | 首个页面组件 `useEffect` 触发时间 - 页面创建时间 | 业务埋点 |
| **接口成功率** | fetch 拦截器统计 status / 超时 | 网络层 hook |
| **面包屑（Breadcrumbs）** | 用户操作轨迹（点击/导航/状态变更） | 还原崩溃前的操作路径 |

---

## RN 特有指标

| 指标 | 采集方式 | 为什么重要 |
|------|---------|-----------|
| **Bundle 加载时间** | `loadScriptFromFile` 前后打点 | 分 Bundle 场景：加载慢 = 白屏 |
| **Bridge 通信耗时** | MessageQueue spy（旧架构）/ JSI 调用计时 | 通信瓶颈定位 |
| **首帧渲染（TTI）** | Native 侧 `ReactMarker.CONTENT_APPEARED` | RN 官方埋点事件 |
| **热更新成功率** | Updater SDK 上报：下载成功 / 合并成功 / 加载成功 | 热更新可靠性 |
| **热更新后 Crash 率** | 新版本加载后 5min 内 Crash | 用于自动回滚判断 |

---

## 上报架构

```
采集层（JS + Native）
    ↓ 统一写入本地队列
上报队列（@x-rn/monitor SDK）
    ├── 批量聚合（每 30s 或队列满 20 条）
    ├── 数据压缩（gzip）
    ├── 失败重试（指数退避，最多 3 次）
    └── 离线缓存（无网时存本地，恢复后补传）
    ↓ HTTPS POST
后端（两种方案）
    ├── Sentry（开箱即用）：错误聚合 + Stack Trace + Source Map 还原
    └── 自建（Firebase / Grafana）：自定义 Dashboard + 灵活告警
```

**XRN 选型**：Sentry SDK 封装 + Source Map 自动上传（CI 集成）。

```
为什么封装 Sentry 而不是直接用：
  1. 统一 API：JS 和 Native 用同一个 report() 接口
  2. 扩展自定义指标：Bundle 加载时间、热更新成功率等 Sentry 没有
  3. 面包屑增强：自动记录 RN 导航、Native 模块调用
  4. 可替换：底层换成 Bugly / 自建时业务代码不改
```

---

## 告警策略

| 指标 | 正常 | P1 | P0 | 处理 |
|------|------|-----|-----|------|
| **Crash 率** | < 0.3% | > 0.5% | > 2% | P1: 查 stack trace; P0: 回滚版本 |
| **ANR 率** | < 0.1% | > 0.3% | > 1% | P1: 查主线程阻塞; P0: hotfix |
| **冷启动** | < 2s | > 3s | > 5s | P1: 查 Bundle 加载/初始化; P0: 紧急优化 |
| **FPS** | > 55 | < 45 | < 30 | P1: 查重渲染/大列表; P0: 降级动画 |
| **JS Error** | < 0.1% | > 0.5% | > 2% | P1: 查 sourcemap; P0: 热更新修复 |
| **热更新成功率** | > 99% | < 95% | < 90% | P1: 查 diff/网络; P0: 停止灰度 |

---

## 发版后观测 SOP

| 阶段 | 时间窗口 | 关注指标 | 异常反应 |
|------|---------|---------|---------|
| **灰度 5%** | 0-2h | Crash 率 + ANR 率 | 任一飙升 → 停止灰度 |
| **灰度 30%** | 2-12h | FPS + 启动时间 + JS Error | 退化明显 → 暂停 |
| **全量** | 12h-3d | 全指标 WoW 对比 | 无退化 → 发版完成 |
| **热更新** | 推送后 30min | 热更新成功率 + 新版本 Crash 率 | Crash > 阈值 → 自动回滚 |

**热更新特殊性**：
```
热更新不经过应用商店审核，风险更高。
所以热更新后的观测窗口更短（30min）、阈值更严（Crash > 0.5% 就回滚）。
客户端 CrashGuard 机制：连续 2 次 Crash → 自动回退旧版本 → 上报 Server。
```

---
