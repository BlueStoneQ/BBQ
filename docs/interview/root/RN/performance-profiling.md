# 性能分析工具与排查方法

> 问题：App 卡了/慢了/崩了，用什么工具、看什么指标、怎么定位到根因？
> 本质：先分层（JS / Native / 通信），再用对应工具量化，最后针对性优化。

---

## 目录

- [一、工具全景图](#一工具全景图)
- [二、按性能场景选工具](#二按性能场景选工具)
- [三、每个工具详解](#三每个工具详解)
- [四、排查流程（SOP）](#四排查流程sop)
- [五、关键指标与阈值](#五关键指标与阈值)

---

## 一、工具全景图

```
┌─────────────────────────────────────────────────────────────┐
│  开发阶段                                                    │
│                                                              │
│  JS 层：                                                     │
│    Performance Monitor（内置）→ JS/UI 帧率实时看              │
│    React DevTools → 重渲染检测                               │
│    Hermes Profiler → JS 函数级耗时                           │
│                                                              │
│  Native 层：                                                 │
│    Android Studio Profiler → CPU/内存/线程/网络              │
│    Xcode Instruments → Time Profiler/Allocations/Leaks      │
│    Perfetto → 跨线程时间线（帧级分析）                       │
│    LeakCanary → Java 内存泄漏自动检测                        │
│                                                              │
│  跨层：                                                      │
│    React Native DevTools（0.83+）→ 统一调试面板              │
│    自定义打点 → 分段计时（启动/渲染/接口）                   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  线上阶段                                                    │
│                                                              │
│    Sentry → Crash + ANR + 性能事务                           │
│    Firebase Performance → 启动/帧率/网络延迟                 │
│    自建埋点 → 业务级指标（首屏时间/BLE 连接耗时）            │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、按性能场景选工具

| 性能场景 | 首选工具 | 看什么 | 定位到什么 |
|---------|---------|--------|-----------|
| **启动慢** | 自定义分段打点 + Perfetto | 各阶段耗时（Native init / Bundle load / JS exec / 首屏渲染） | 哪个阶段最慢 |
| **列表卡顿** | Performance Monitor + React DevTools | JS 帧率 + 哪些 item 在重渲染 | JS 计算过重 or View 层级深 |
| **动画掉帧** | Performance Monitor + Perfetto | UI 帧率 + UI Thread 耗时 | 动画是否在 JS 线程跑 |
| **手势不跟手** | Performance Monitor | 拖拽时 JS 帧率是否掉 | 手势事件是否走了 JS 线程 |
| **内存泄漏** | Android Profiler / Xcode Allocations + LeakCanary | 内存趋势（持续增长 = 泄漏） | 哪个对象没释放 |
| **ANR/卡死** | Perfetto | UI Thread 被什么阻塞 | 主线程做了什么耗时操作 |
| **包体大** | source-map-explorer + APK Analyzer | 各模块占比 | 哪个库/资源最大 |
| **BLE 延迟** | 自定义打点 + Perfetto | 端到端延迟分段 | 延迟在硬件/通信/JS 哪一层 |
| **Crash** | Sentry + Crashlytics | 堆栈 + Source Map | 崩在 JS 还是 Native |
| **首屏慢** | 自定义打点 | FCP / TTI | 首屏组件树是否太大 |

---

## 三、每个工具详解

### 3.1 Performance Monitor（内置，开发时）

**打开方式**：Dev Menu → Show Perf Monitor（或摇一摇）

**看什么**：
- **JS 帧率**：JS 线程每秒能处理多少帧（目标 60）
- **UI 帧率**：UI 线程每秒能渲染多少帧（目标 60）
- **RAM**：当前内存占用

**怎么用**：
```
操作 App → 观察帧率变化：
- JS 掉帧，UI 不掉 → JS 线程忙（重渲染/重计算）
- UI 掉帧，JS 不掉 → Native 层忙（View 层级深/图片大）
- 都掉 → 通信瓶颈 或 整体过载
```

**一句话**：最快的分层判断工具，10 秒内知道问题在 JS 还是 Native。

---

### 3.2 React DevTools（重渲染检测）

**打开方式**：React Native DevTools（0.83+ 内置）或独立 react-devtools

**核心功能**：
- **Highlight Updates**：组件重渲染时闪烁高亮 → 一眼看出哪些组件在不必要重渲染
- **Profiler**：录制一段操作 → 看每个组件渲染耗时 + 渲染次数
- **Components 树**：查看 props/state 变化

**怎么用**：
```
1. 开启 Highlight Updates
2. 操作 App（滚动列表/切换 Tab）
3. 看哪些组件在闪 → 这些就是不必要重渲染的
4. 用 Profiler 录制 → 看 render 耗时排名
```

**定位到**：哪个组件重渲染了 + 为什么（props 变了？state 变了？）

---

### 3.3 Hermes Profiler（JS 函数级耗时）

**打开方式**：Dev Menu → Start/Stop Profiling → 导出 .cpuprofile → Chrome DevTools 打开

**看什么**：
- 火焰图：哪个 JS 函数占用时间最多
- 调用栈：慢函数是被谁调用的
- 自上而下/自下而上排序

**怎么用**：
```
1. 开始录制
2. 复现卡顿操作（滚动列表/页面切换）
3. 停止录制 → 导出
4. Chrome DevTools → Performance → Load profile
5. 找到最宽的色块 = 最耗时的函数
```

**定位到**：具体哪个 JS 函数慢（排序算法？JSON 解析？大量 setState？）

---

### 3.4 Android Studio Profiler（Native 层）

**打开方式**：Android Studio → Profiler → 选择进程

**四个面板**：

| 面板 | 看什么 | 场景 |
|------|--------|------|
| CPU | 各线程 CPU 占用 + 方法耗时 | ANR / Native 函数慢 |
| Memory | 堆内存趋势 + 对象分配 | 内存泄漏 / OOM |
| Network | 请求时间线 + 大小 | 接口慢 / 重复请求 |
| Energy | 电量消耗 | BLE 持续连接耗电 |

**内存泄漏排查**：
```
1. Memory 面板 → 观察堆内存趋势
2. 持续增长不回落 = 泄漏
3. Dump Heap → 看哪个类的实例数异常多
4. 配合 LeakCanary 自动检测引用链
```

---

### 3.5 Perfetto（帧级跨线程分析）

**本质**：把所有线程的执行时间线画在一张图上，精确到每一帧。

**打开方式**：
```bash
# Perfetto（Google 推荐）
# 直接在 https://ui.perfetto.dev 打开 trace 文件
```

**看什么**：
- UI Thread 每帧耗时（超 16ms = 掉帧）
- JS Thread 和 UI Thread 的时间对齐
- 哪个线程在等哪个线程

**场景**：动画掉帧时，看 UI Thread 那一帧在做什么（布局计算？图片解码？等 JS 返回？）

---

### 3.6 Xcode Instruments（iOS）

| 工具 | 看什么 | 场景 |
|------|--------|------|
| Time Profiler | 函数级 CPU 耗时 | 启动慢 / 卡顿 |
| Allocations | 内存分配 + 对象生命周期 | 内存泄漏 |
| Leaks | 自动检测循环引用 | iOS 内存泄漏 |
| Core Animation | 帧率 + 离屏渲染 | 动画卡顿 |
| Network | 请求时间线 | 接口性能 |

---

### 3.7 LeakCanary（Android 内存泄漏自动检测）

**本质**：监控 Activity/Fragment 销毁后是否被 GC 回收，没回收 = 泄漏。

**使用**：
```gradle
// build.gradle
debugImplementation 'com.squareup.leakcanary:leakcanary-android:2.x'
// 无需写代码，自动检测，泄漏时弹通知 + 显示引用链
```

**输出**：泄漏对象 → 引用链（谁持有了它 → 导致 GC 回收不了）

---

### 3.8 source-map-explorer / APK Analyzer（包体分析）

**JS Bundle 分析**：
```bash
npx source-map-explorer bundle.js bundle.js.map
# 输出：每个模块占 Bundle 多少 KB → 找到最大的依赖
```

**APK 分析**：Android Studio → Build → Analyze APK
- classes.dex 大小
- lib/ 下各架构 .so 大小
- assets/ 资源大小
- 对比两个 APK 的差异

---

### 3.9 线上监控（Sentry + Firebase）

| 工具 | 监控什么 | 关键指标 |
|------|---------|---------|
| Sentry | JS Crash + Native Crash + ANR | Crash-free rate / 堆栈 |
| Firebase Performance | 启动时间 / 帧率 / 网络 | App start time / Slow frames % |
| 自建埋点 | 业务指标 | 首屏时间 / BLE 连接成功率 / 页面 TTI |

---

## 四、排查流程（SOP）

### 通用排查 SOP

```
1. 复现 → 稳定复现路径
2. 分层 → Performance Monitor 判断 JS 还是 Native
3. 量化 → 对应工具录制数据
4. 定位 → 找到具体函数/组件/对象
5. 修复 → 一次只改一个变量
6. 验证 → 优化前后数据对比
7. 监控 → 上线后持续观察不退化
```

### 启动慢排查 SOP

```
1. adb shell am start -W → 拿到 TotalTime
2. 分段打点：
   - T0: Application.onCreate 开始
   - T1: RN 容器创建完成
   - T2: Bundle 加载完成（loadScript 结束）
   - T3: JS 执行完成（AppRegistry.runApplication）
   - T4: 首屏渲染完成（onLayout 回调）
3. 找最慢的段 → 针对性优化：
   - T0→T1 慢：SDK 延迟初始化 / TurboModule 懒加载
   - T1→T2 慢：分 Bundle / Hermes AOT
   - T2→T3 慢：减少顶层 import / 延迟非首屏模块
   - T3→T4 慢：简化首屏 UI / 骨架屏
```

### 内存泄漏排查 SOP

```
1. Android Profiler → 观察内存趋势（操作 App 5 分钟）
2. 持续增长不回落 → 有泄漏
3. 触发 GC → 如果 GC 后仍不降 → 确认泄漏
4. Dump Heap → 按 Retained Size 排序 → 找异常大的对象
5. LeakCanary → 自动给出引用链
6. 常见原因：
   - useEffect 没 return cleanup（订阅/定时器）
   - 导航栈无限堆积（页面没销毁）
   - BLE 连接没断开
   - 闭包持有大对象
```

### 列表卡顿排查 SOP

```
1. Performance Monitor → 滚动时看 JS/UI 帧率
2. JS 帧率低：
   - React DevTools → Highlight Updates → 看哪些 item 在重渲染
   - Hermes Profiler → 看 renderItem 里哪个函数慢
   - 解决：memo + useCallback + FlashList
3. UI 帧率低：
   - Perfetto → 看 UI Thread 每帧在做什么
   - 可能：View 层级深 / 图片大 / 阴影/圆角触发离屏渲染
   - 解决：简化 item 布局 + FastImage + 避免复杂样式
```

---

## 五、关键指标与阈值

| 指标 | 目标值 | 工具 |
|------|--------|------|
| 冷启动时间 | < 2s（首屏可交互） | 分段打点 |
| JS 帧率 | 稳定 60fps（不低于 50） | Performance Monitor |
| UI 帧率 | 稳定 60fps | Performance Monitor |
| 内存（正常使用） | < 200MB | Android Profiler |
| 内存增长（10 分钟） | < 10MB（无泄漏） | Android Profiler |
| Crash-free rate | > 99.5% | Sentry |
| ANR rate | < 0.5% | Firebase / Play Console |
| 列表 FPS（快速滚动） | > 55fps | Performance Monitor |
| BLE 连接耗时 | < 3s | 自定义打点 |
| 接口 P95 延迟 | < 500ms | Firebase Performance |
| Bundle 大小（业务 Bundle） | < 2MB | source-map-explorer |
| APK 大小 | < 50MB | APK Analyzer |

---

## 概念速查

| 概念 | 一句话 |
|------|--------|
| Performance Monitor | RN 内置帧率监控，最快判断问题在 JS 还是 Native |
| Hermes Profiler | JS 函数级火焰图，找到最慢的 JS 函数 |
| Perfetto | 跨线程时间线，精确到每一帧每个线程在做什么 |
| LeakCanary | Android 内存泄漏自动检测，给出引用链 |
| React DevTools Profiler | 组件级渲染耗时 + 重渲染检测 |
| source-map-explorer | JS Bundle 各模块体积可视化 |
| APK Analyzer | APK 内部各部分体积分析 |
| Sentry | 线上 Crash/ANR 监控 + Source Map 堆栈还原 |
| Firebase Performance | 线上性能指标（启动/帧率/网络） |
| adb | Android 调试桥，所有 Android 工具的底层连接通道 |

---

## 六、平台专属工具对照

### Android 工具链

| 工具 | 类型 | 用途 | 关键命令/操作 |
|------|------|------|--------------|
| **adb** | 命令行桥梁 | 所有 Android 调试的基础 | 见下方常用命令 |
| Android Studio Profiler | GUI | CPU/内存/网络/能耗 | AS → Profiler → 选进程 |
| Perfetto | 帧级分析 | 跨线程时间线 | Perfetto UI (ui.perfetto.dev) |
| LeakCanary | 自动检测 | Java 内存泄漏 | 添加依赖即可，自动弹通知 |
| APK Analyzer | 包体分析 | APK 各部分体积 | AS → Build → Analyze APK |
| Logcat | 日志 | 实时日志流 | `adb logcat` 或 AS Logcat 面板 |

**adb 常用性能命令**：

| 命令 | 做什么 | 场景 |
|------|--------|------|
| `adb shell am start -W <pkg>/<activity>` | 测量启动时间（输出 TotalTime） | 启动优化基准 |
| `adb shell dumpsys meminfo <pkg>` | 内存详情（Java Heap/Native/Graphics） | 内存分析 |
| `adb shell dumpsys gfxinfo <pkg>` | 帧渲染耗时统计（掉帧数/慢帧数） | 卡顿量化 |
| `adb shell dumpsys activity <pkg>` | Activity 栈信息 | 导航栈泄漏排查 |
| `adb logcat -s ReactNativeJS` | 只看 RN JS 层日志 | JS 错误定位 |
| `adb shell top -m 10` | CPU 占用 Top 10 进程 | 找 CPU 热点 |
| `adb bugreport > bug.zip` | 导出完整系统报告（含 ANR traces） | ANR 分析 |
| `adb reverse tcp:8081 tcp:8081` | 端口转发（Metro 连接设备） | 开发调试 |

**本质**：adb 是电脑和 Android 设备之间的命令行桥梁，所有 Android 调试工具底层都依赖 adb 连接。

---

### iOS 工具链

| 工具 | 类型 | 用途 | 打开方式 |
|------|------|------|---------|
| **Xcode Instruments** | GUI 套件 | 性能分析全家桶 | Xcode → Product → Profile |
| - Time Profiler | CPU | 函数级耗时 | 找最慢的 Native/JS 函数 |
| - Allocations | 内存 | 对象分配 + 生命周期 | 内存泄漏定位 |
| - Leaks | 内存 | 循环引用自动检测 | iOS 特有的 ARC 泄漏 |
| - Core Animation | 帧率 | FPS + 离屏渲染检测 | 动画卡顿 |
| - Network | 网络 | 请求时间线 + 大小 | 接口性能 |
| - Energy Log | 能耗 | 电量消耗分析 | BLE 持续连接耗电 |
| **Console.app** | 日志 | 设备实时日志 | 类似 adb logcat |
| **Xcode Memory Graph** | 内存 | 可视化对象引用关系 | Debug → Memory Graph |

**iOS 没有 adb**，对应的是：
- 连接设备：Xcode 自动识别（USB/WiFi）
- 安装 App：`xcodebuild` 或 Xcode 直接 Run
- 查看日志：Console.app 或 Xcode Debug Console
- 性能分析：全部在 Instruments 里

---

### 跨平台对照表

| 场景 | Android | iOS |
|------|---------|-----|
| 启动时间 | `adb shell am start -W` | Instruments → Time Profiler |
| 内存分析 | Android Profiler + `dumpsys meminfo` | Instruments → Allocations |
| 内存泄漏 | LeakCanary（自动） | Instruments → Leaks / Memory Graph |
| 帧率/卡顿 | `dumpsys gfxinfo` + Perfetto | Instruments → Core Animation |
| CPU 热点 | Android Profiler CPU | Instruments → Time Profiler |
| 日志 | `adb logcat` | Console.app / Xcode Console |
| 包体分析 | APK Analyzer | Xcode → App Thinning Size Report |
| 网络 | Android Profiler Network | Instruments → Network |
