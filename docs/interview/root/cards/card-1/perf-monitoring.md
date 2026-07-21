# 性能监控体系（APM — Application Performance Monitoring）

> 问题：优化做了但不知道线上效果，退化了也发现不了
>
> 本质：没有度量就没有管理——需要持续采集 + 告警 + 防退化
>
> 目标：关键指标可视化 + 退化自动告警 + CI 卡点

---

## 速查表

### 线上（生产环境，被动采集）

→ [详细](#线上监控)

### 本地开发（调试定位）

→ [详细工具表格](#本地开发)

---

## 目录

- [监控什么](#监控什么)
- [用什么工具](#用什么工具)
  - [线上监控](#线上监控)
  - [本地开发](#本地开发)
  - [各工具定位区分](#各工具定位区分)
  - [LeakCanary 使用](#leakcanary-使用)
  - [Perfetto 使用](#perfetto-使用)
  - [AS Profiler vs Perfetto](#as-profiler-vs-perfetto)
- [怎么建](#怎么建)
  - [线上监控（被动采集）](#线上监控被动采集)
  - [自动化测试（主动采集）](#自动化测试主动采集)
  - [CI 卡点（防退化）](#ci-卡点防退化)
- [体系闭环](#体系闭环)

---

## 监控什么

| 指标 | 全称 | 目标值 | 采集方式 |
|------|------|--------|---------|
| 冷启动时间 | Cold Start Time | < 2s | 自定义打点（分段） |
| 首屏时间 | FCP（First Contentful Paint） | < 1.5s | 自定义打点 |
| JS 帧率 | JS FPS（Frames Per Second） | > 55fps | Performance Monitor / 自定义采集 |
| UI 帧率 | UI FPS | > 55fps | `dumpsys gfxinfo` |
| 内存 | PSS（Proportional Set Size） | < 200MB | `dumpsys meminfo` |
| 崩溃率 | Crash-free rate | > 99.5% | Sentry |
| 无响应率 | ANR（Application Not Responding）rate | < 0.5% | Firebase / Play Console |
| Bundle 大小 | JS Bundle Size | < 2MB（业务 Bundle） | CI 构建产物检查 |
| APK 大小 | APK Size | < 50MB | CI 构建产物检查 |
| BLE 连接耗时 | BLE Connection Time | < 3s | 自定义打点 |

---

## 用什么工具

### 线上监控

| 工具 | 说明 |
|------|------|
| **Sentry** | 核心。JS Error / Crash / ANR / 启动时间 / 自定义埋点 / 帧率卡顿（内置 slow/frozen frame 检测）|
| **Firebase Performance**（海外补充） | 帧率趋势 + 网络延迟 |

> 帧率卡顿：Sentry SDK 内置 slow frame（>16ms）/ frozen frame（>700ms）检测，不需要自己实现。线上只上报超阈值的卡顿事件，不持续采集，开销极低。[→ 卡顿检测原理](#注释卡顿检测原理)

### 本地开发

| 工具 | 平台 | 需要什么 | 能看什么 | 侵入性 |
|------|------|---------|---------|--------|
| **RN Perf Monitor**（手机端） | RN 跨端 | Dev Menu 开启 | JS FPS / UI FPS 实时浮层 | 零 |
| **React Native DevTools**（桌面端） | RN 跨端 | `npx react-native start` 自带 | Profiler / Network / Console（替代已废弃的 Flipper） | 零 |
| **LeakCanary** | Android | 加一行依赖即可 | 内存泄漏自动检测（Activity/Fragment/对象） | 极低 |
| **AS Profiler** | Android | Android Studio 自带 | CPU 火焰图 / 内存对象级分析 / 网络 / 能耗 | 零（attach 即可） |
| **Perfetto** | Android | 不需要 SDK，系统自带 | 系统级：进程/线程调度、帧渲染流水线、CPU、内存 | 零 |
| **Xcode Instruments** | iOS | Xcode 自带 | CPU / 内存 / Leaks / 帧率 / 磁盘 I/O | 零 |
| **Python + uiautomator2** | Android | pip install | 自动化跑场景 + adb 采集性能数据 | 低（外部驱动） |

### 各工具定位区分

```
"帧为什么掉了？"
  → Perfetto（系统级线程调度，看 JS Thread / UI Thread 被谁抢了）

"哪个函数慢？"
  → AS Profiler CPU Tab（方法级火焰图）

"哪个对象泄漏了？"
  → LeakCanary（自动检测）+ AS Profiler Memory Tab（dump heap 看引用链）

"JS 线程是不是太忙了？"
  → RN Perf Monitor（看 JS FPS）→ React Native DevTools Profiler（看每帧 JS 耗时）

"iOS 内存泄漏？"
  → Xcode Instruments → Leaks template
```

### LeakCanary 使用

```groovy
// app/build.gradle — 一行搞定，不需要写任何代码
debugImplementation 'com.squareup.leakcanary:leakcanary-android:2.14'
```

装上后 debug 包自动检测泄漏：Activity/Fragment 销毁后未被 GC → 自动 dump heap → 分析引用链 → 弹通知。release 包自动移除。

### Perfetto 使用

```bash
# 不需要 SDK，Android 系统自带 trace 能力
# 方式 1：命令行
adb shell perfetto -o /data/misc/perfetto-traces/trace.pb -t 5s \
  sched freq idle am wm gfx view

# 方式 2：浏览器 https://ui.perfetto.dev → 连接设备 → 录制

# RN 场景：看 mqt_js 线程（JS Thread）和 UI Thread 的繁忙程度
```

### AS Profiler vs Perfetto

| | Perfetto | AS Profiler |
|---|---------|-------------|
| 粒度 | 系统级（所有进程、内核调度） | App 级（只看你的 App） |
| 适合 | "全局 why"：帧掉了是线程被抢还是 JS 忙 | "App 内 where"：哪个函数慢、哪个对象漏 |
| 内存 | 趋势（PSS） | 精细（对象级 + 引用链） |
| CPU | 线程调度级（微秒） | 方法级（采样或 instrument） |

---

## 怎么建

### 线上监控（被动采集）

```typescript
// Firebase Performance：自动采集启动时间 + 帧率
import perf from '@react-native-firebase/perf';

// 自定义 Trace：采集业务指标
const trace = await perf().newTrace('ble_connect');
trace.start();
await bleService.connect(deviceId);
trace.stop();  // 自动上报耗时
```

### 自动化测试（主动采集）

```python
# CI 定时跑：操作 App + 采集性能数据
import uiautomator2 as u2
import subprocess

d = u2.connect()
d.app_start('com.app')

# 采集启动时间
result = subprocess.run(['adb', 'shell', 'am', 'start', '-W', 'com.app/.MainActivity'], capture_output=True, text=True)

# 采集内存
result = subprocess.run(['adb', 'shell', 'dumpsys', 'meminfo', 'com.app'], capture_output=True, text=True)

# 采集帧率
result = subprocess.run(['adb', 'shell', 'dumpsys', 'gfxinfo', 'com.app', 'reset'], capture_output=True, text=True)
d.swipe(500, 1500, 500, 500)  # 操作
result = subprocess.run(['adb', 'shell', 'dumpsys', 'gfxinfo', 'com.app'], capture_output=True, text=True)
```

### CI 卡点（防退化）

```
CI 流水线加检查：
  - Bundle 大小 > 阈值 → 构建失败
  - APK 大小 > 阈值 → 构建失败
  - 性能基准测试退化 > 10% → 告警
```

---

## 体系闭环

```
采集（线上 + 自动化）→ 可视化（Dashboard）→ 告警（退化通知）→ 定位（排查 SOP）→ 修复 → 验证 → 持续监控
```

---

# 注释

<a id="注释卡顿检测原理"></a>
### 卡顿检测原理

不是"帧率低于 X 就是卡顿"——是**有渲染请求但超时没完成**。

- Android：`Choreographer.FrameCallback`，系统每帧回调一次（16ms），两次回调间隔 > 16ms = 掉帧
- iOS：`CADisplayLink`，同理，屏幕刷新时回调，间隔超时 = 掉帧

页面静止不动时系统不触发帧回调（没有 View invalidate / 没有动画 → 不渲染），所以不会误判为卡顿。只有 UI 正在变更时才检测。
