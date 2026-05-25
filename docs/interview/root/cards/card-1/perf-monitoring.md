# 性能监控体系

> 问题：优化做了但不知道线上效果，退化了也发现不了
>
> 本质：没有度量就没有管理——需要持续采集 + 告警 + 防退化
>
> 目标：关键指标可视化 + 退化自动告警 + CI 卡点

---

## 目录

- [监控什么](#监控什么)
- [用什么工具](#用什么工具)
- [怎么建](#怎么建)
  - [线上监控（被动采集）](#线上监控被动采集)
  - [自动化测试（主动采集）](#自动化测试主动采集)
  - [CI 卡点（防退化）](#ci-卡点防退化)
- [体系闭环](#体系闭环)

---

## 监控什么

| 指标 | 目标值 | 采集方式 |
|------|--------|---------|
| 冷启动时间 | < 2s | 自定义打点（分段） |
| 首屏时间（FCP） | < 1.5s | 自定义打点 |
| JS 帧率 | > 55fps | Performance Monitor / 自定义采集 |
| UI 帧率 | > 55fps | `dumpsys gfxinfo` |
| 内存（PSS） | < 200MB | `dumpsys meminfo` |
| Crash-free rate | > 99.5% | Sentry |
| ANR rate | < 0.5% | Firebase / Play Console |
| Bundle 大小 | < 2MB（业务 Bundle） | CI 构建产物检查 |
| APK 大小 | < 50MB | CI 构建产物检查 |
| BLE 连接耗时 | < 3s | 自定义打点 |

---

## 用什么工具

| 工具 | 监控什么 | 阶段 |
|------|---------|------|
| **Firebase Performance** | 启动时间 / 帧率 / 网络延迟 | 线上 |
| **Sentry** | JS Crash / Native Crash / ANR | 线上 |
| **自定义埋点** | 业务指标（首屏/BLE 连接/页面 TTI） | 线上 |
| **Python + uiautomator2** | 自动化跑场景 + adb 采集数据 | CI / 定时任务 |
| **CI 卡点** | 构建产物大小 / 性能基准对比 | 发布前 |

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
