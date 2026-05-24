# 牌 1：性能体验优化

> 命中：JD1-3（性能与质量保障）+ JD2（性能优化方法）
> 定位：不是修一个 bug，是建一套"测量→定位→优化→验证→监控→防退化"的体系

---

## 我的数据

| 项目 | 优化项 | 结果 |
|------|--------|------|
| 快应用框架 | 包体优化 | 153MB → ~60MB |
| 快应用框架 | DEX 优化 | 44.4MB → 27MB（-39%） |
| 快应用框架 | 启动内存 | PSS MAX 41MB → 35.8MB |
| MT 优选 | 秒开率 | 10% → 78% |
| XM 平台 | 大文件上传 | 121s → 42s（提速 3 倍） |

---

## 优化维度全景

```
性能体验优化
├── 速度/体验
│   ├── 启动速度（冷启动 < 2s）
│   ├── 页面切换/跳转（native-stack + 骨架屏）
│   └── WebView 加载（进度条/预加载/内容内置）
├── 流畅度
│   ├── 列表流畅度（FlashList / memo / 60fps）
│   └── 动画/手势动画（Reanimated worklet / Gesture Handler）
├── 包体（APK < 50MB）
│   ├── abiFilters / R8 / 模块裁剪
│   ├── 图片压缩 / WebP / 字体子集化
│   └── 分 Bundle / Tree Shaking
└── 内存（< 200MB / 不增长）
    ├── useEffect cleanup / 导航栈控制
    ├── FastImage 缓存策略
    └── BLE 连接生命周期管理
```

---

## 方法论

```
1. 测量（用工具量化，不靠感觉）
2. 分层定位（React / RN 框架 / Native / 工程化）
3. 针对性优化（一次只改一个变量）
4. 数据验证（优化前后对比）
5. 持续监控（上线后不退化）
6. 自动化（Python + uiautomator2 持续跑性能测试）
```

---

## 自动化性能测试（差异化能力）

不是手动测一次就完了，是**自动化持续跑**：

```python
# Python + uiautomator2 + adb：自动化操作 App + 采集性能数据
import uiautomator2 as u2
import subprocess

d = u2.connect()
d.app_start('com.hubble.app')

# 操作场景：启动 → 滑动列表 → 切换 Tab → 连接设备
d.swipe(500, 1500, 500, 500)

# 采集内存
result = subprocess.run(['adb', 'shell', 'dumpsys', 'meminfo', 'com.hubble.app'], capture_output=True, text=True)

# 采集帧率
result = subprocess.run(['adb', 'shell', 'dumpsys', 'gfxinfo', 'com.hubble.app'], capture_output=True, text=True)
```

**体系**：自动化脚本 → 定时跑（CI）→ 数据上报 → 趋势监控 → 退化告警

---

## 深入文档（按体验路径）

### 一、启动性能

用户点击图标 → 看到首屏可交互，这段时间的优化。

- [启动性能与 Splash 优化](../RN/perf-splash.md) — Splash 方案/并行化/三段式过渡

### 二、页面切换与视觉稳定

首屏之后，页面跳转/Tab 切换的流畅度和稳定性。布局不跳、不闪、不抖（CLS = 0）。

- [体验升级治理专项](../RN/ux-engineering.md) — 骨架屏/按下态/防抖动方案/从设计源头规范
- [IoT App 性能方案 · 观察 2&3](../RN/iot-ble-performance.md) — 启动后抖动 + Tab 切换抖动的根因与方案

### 三、列表流畅度

长列表滚动 60fps，不掉帧不白屏。

- [性能优化分层体系](../RN/performance-layers.md) — FlashList/memo/useCallback/场景题

### 四、动画与手势

手势跟手 + 动画不掉帧，全程绕过 JS 线程。

- [手势动画](../RN/gesture-animation.md) — Reanimated worklet/Gesture Handler/代码对比

### 五、包体与内存

APK 瘦身 + 内存不泄漏。

- [分 Bundle 方案](../RN/code-splitting.md) — 拆分策略（推荐多 Bundle）
- [性能分析工具与排查](../RN/performance-profiling.md) — 工具选型/排查 SOP/指标阈值

### 六、体验基础设施

Dark Mode + 国际化 + 图片优化。

- [Theme + 国际化](../RN/theme-i18n.md) — useColorScheme/i18next/RTL
