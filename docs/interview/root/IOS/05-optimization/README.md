# iOS 性能优化

> 本质：和 Android 的优化思路一样——启动/内存/帧率/包体，只是工具和 API 名字不同。
> 结论：iOS 性能优化 = 启动优化（pre-main + post-main）+ 内存（ARC 泄漏 + 峰值）+ 渲染（离屏/帧率）+ 包体（Bitcode/Asset Catalog）。

---

## 目录

- [iOS vs Android 性能优化对照](#ios-vs-android-性能优化对照)
- [启动优化](#启动优化)
  - [pre-main 阶段](#pre-main-阶段)
  - [post-main 阶段](#post-main-阶段)
- [内存优化](#内存优化)
- [渲染与帧率](#渲染与帧率)
- [包体优化](#包体优化)
- [工具对照](#工具对照)
- [Q&A](#qa)

---

## iOS vs Android 性能优化对照

| 维度 | Android | iOS |
|------|---------|-----|
| 启动阶段 | Zygote fork → Application → Activity | dyld 加载 → +load → main → AppDelegate → 首屏 |
| 启动瓶颈 | DEX 加载 / multidex / 初始化 | dylib 加载 / ObjC +load / Storyboard 解析 |
| 内存管理 | GC（Java 堆） | ARC（引用计数） |
| 内存泄漏检测 | LeakCanary | Instruments Leaks / Memory Graph |
| 帧率工具 | `dumpsys gfxinfo` / Perfetto | Instruments Core Animation / CADisplayLink |
| 离屏渲染 | `overdraw` 检测 | `Color Off-screen Rendered`（Instruments） |
| 包体 | ABI Split / R8 / 资源压缩 | App Thinning / Bitcode / Asset Catalog |
| Profiler | AS Profiler | Xcode Instruments |

---

## 启动优化

iOS 冷启动分两个阶段：

```
┌─── pre-main（你控制不了太多，系统在做事）───┐
│                                              │
│  dyld 加载 → rebase/bind → ObjC setup       │
│  → +load 方法 → C++ 静态构造                 │
│                                              │
├─── main() 被调用 ────────────────────────────┤
│                                              │
│  AppDelegate → 初始化 → 首屏 ViewController  │
│  → viewDidLoad → 网络请求 → 首屏渲染完成      │
│                                              │
└──────────────────────────────────────────────┘
```

### pre-main 阶段

| 步骤 | 做什么 | 优化手段 |
|------|--------|---------|
| **dyld 加载** | 加载所有动态库（.dylib / .framework） | 减少动态库数量（合并或改为静态库） |
| **Rebase/Bind** | 修正 ASLR 地址偏移 + 绑定外部符号 | 减少 ObjC 类/方法数量 |
| **ObjC setup** | 注册所有 ObjC 类和分类到运行时 | 减少类数量（Swift struct 替代 ObjC class） |
| **+load 方法** | 所有类的 `+load` 被调用 | ❌ 不要用 +load（改用 +initialize，懒加载） |
| **C++ 静态构造** | `__attribute__((constructor))` 执行 | 延迟到首次使用 |

**类比 Android**：pre-main ≈ Android 的 Zygote fork + ClassLoader 加载 DEX + Application.attachBaseContext。

**dyld 是什么**：Dynamic Linker，iOS 的动态链接器（类比 Android 的 `linker` / Linux 的 `ld.so`）。负责加载 App 依赖的所有动态库。

**+load 是什么**：ObjC 类方法，App 启动时**所有类的 +load 都会被调用**（无论你用没用到这个类）。类比 Android 的 ContentProvider.onCreate（也是启动时全部执行）。

### post-main 阶段

| 步骤 | 做什么 | 优化手段 |
|------|--------|---------|
| AppDelegate 初始化 | 注册服务、三方 SDK | 按需懒加载，非必要的延迟到首屏后 |
| 首屏 ViewController | 创建 View 层级 | 减少层级 / 用 LazyVStack |
| 网络请求 | 拉首屏数据 | Native 预请求（和 RN 一样的思路） |
| 首屏渲染 | Auto Layout 计算 + 绘制 | 预计算布局 / 避免复杂约束 |

**优化策略（和 Android/RN 通用的思路）**：
1. 首屏依赖的初始化优先，其余延迟
2. 网络请求尽早发（和 UI 初始化并行）
3. 首屏数据用缓存兜底（先展示缓存，再更新）

---

## 内存优化

### iOS 内存组成

```
iOS 内存 = Clean Memory + Dirty Memory + Compressed Memory

Clean：可被系统回收的（mmap 只读页、代码段）
Dirty：App 修改过的内存页（JS 堆、对象实例、图片解码后的 bitmap）
Compressed：被 iOS 压缩的不活跃 Dirty 页（减少物理内存占用）
```

**类比 Android**：
- Clean ≈ Android 的 Shared Clean（共享只读页）
- Dirty ≈ Android 的 Private Dirty（PSS 中占大头的部分）
- iOS 没有 Swap（Android 有 zRAM），但有 Compressed Memory（作用类似）

### 常见内存问题

| 问题 | 原因 | 检测 | 解法 |
|------|------|------|------|
| 循环引用泄漏 | delegate/闭包/Timer 强引用 | Instruments Leaks / Memory Graph | weak/unowned |
| 图片内存过大 | 未做降采样（4000x3000 图片 = 48MB bitmap） | Instruments Allocations | `UIImage` 降采样到显示尺寸 |
| ViewController 泄漏 | dismiss 后 deinit 不调用 | 在 deinit 打 log 验证 | 查引用链 |
| 大数组/缓存无上限 | 缓存没有 LRU / 没有上限 | 内存曲线只升不降 | NSCache（自动清理）替代 Dictionary |

### iOS 内存警告

```swift
// 类比 Android 的 onTrimMemory(level)
// iOS 系统内存不足时会发通知：
override func didReceiveMemoryWarning() {
    super.didReceiveMemoryWarning()
    // 清除缓存、释放非必要资源
    imageCache.removeAllObjects()
}
```

如果不响应内存警告 → 系统直接杀 App（被杀后没有 crash log，只有 Jetsam 日志）。

---

## 渲染与帧率

### iOS 渲染流水线

```
类比 Android 的渲染流水线（Choreographer → measure → layout → draw → GPU 合成）

iOS：
  CADisplayLink 触发（每 16.67ms，60fps）
  → layoutSubviews（布局计算，类比 Android onMeasure/onLayout）
  → drawRect（绘制，类比 Android onDraw）
  → Core Animation 提交到 Render Server
  → GPU 合成（类比 Android SurfaceFlinger + HWC）
```

### 掉帧原因

| 原因 | 说明 | 检测 |
|------|------|------|
| **离屏渲染** | 圆角 + 阴影 + mask 组合触发（GPU 需要额外 buffer） | Instruments → Color Off-screen Rendered（黄色 = 离屏） |
| **布局复杂** | Auto Layout 约束太多（O(n²) 求解） | Instruments → Time Profiler |
| **主线程阻塞** | 同步网络/大计算/文件 IO 在主线程 | Instruments → System Trace |
| **图片解码** | 大图在主线程解码 | 改为后台 queue 预解码 |

**离屏渲染详解**（iOS 特有高频考点）：

```
正常渲染：GPU 直接画到 Frame Buffer → 显示
离屏渲染：GPU 先画到一个离屏 Buffer → 再合成到 Frame Buffer → 显示
         多了一次 Buffer 切换 → 性能开销大

触发离屏渲染的操作：
  ❌ cornerRadius + clipsToBounds（圆角裁剪）
  ❌ shadow（阴影，无 shadowPath 时）
  ❌ mask（遮罩）
  ❌ group opacity

优化：
  ✅ shadow 加 shadowPath（告诉 GPU 阴影范围，不需要离屏计算）
  ✅ 圆角用贝塞尔 Path 画，不用 clipsToBounds
  ✅ 预渲染成图片（以空间换时间）
```

**类比 Android**：Android 的 `overdraw`（过度绘制）是类似的问题，但 iOS 的离屏渲染开销更大（因为需要 Buffer 切换）。

---

## 包体优化

| 手段 | 说明 | 类比 Android |
|------|------|-------------|
| **App Thinning** | App Store 自动分发设备对应的切片（只含该设备的架构/资源） | ABI Split |
| **Bitcode**（已废弃 Xcode 14+） | 中间码，Apple 服务器重新编译优化 | — |
| **Asset Catalog** | 图片按设备分辨率分发（@1x/@2x/@3x） | drawable-hdpi/xhdpi/xxhdpi |
| **Strip Symbols** | Release 去掉调试符号 | ProGuard / R8 |
| **动态库 → 静态库** | 减少 dylib 数量 + 减少 LINKEDIT 段 | — |
| **Link Time Optimization (LTO)** | 链接时跨模块优化 | 和 Android R8 全程序优化类似 |
| **Dead Code Stripping** | 去除未调用的代码 | Tree-shaking / ProGuard |

---

## 工具对照

| 目的 | iOS 工具 | Android 工具 |
|------|---------|-------------|
| CPU / 方法耗时 | Instruments → Time Profiler | AS Profiler → CPU |
| 内存泄漏 | Instruments → Leaks | LeakCanary |
| 内存分配 | Instruments → Allocations | AS Profiler → Memory |
| 帧率 | Instruments → Core Animation / CADisplayLink | dumpsys gfxinfo / Perfetto |
| 离屏渲染 | Instruments → Color Off-screen Rendered | GPU Overdraw |
| 启动时间 | Instruments → App Launch / `DYLD_PRINT_STATISTICS` | `adb shell am start -W` |
| 包体分析 | Xcode → Generate Size Report | APK Analyzer |
| 系统级 trace | Instruments → System Trace | Perfetto |
| 网络 | Instruments → Network / Charles | AS Profiler → Network |

**启动时间测量**：

```bash
# 类比 Android 的 adb shell am start -W
# iOS 在 Xcode Scheme 里加环境变量：
DYLD_PRINT_STATISTICS = 1
# 启动时控制台输出 pre-main 耗时：
# Total pre-main time: 320ms
#   dylib loading: 180ms
#   rebase/binding: 60ms
#   ObjC setup: 40ms
#   initializer: 40ms
```

---

## Q&A

### iOS 的 watchdog 是什么？

系统守护进程，监控 App 主线程是否响应。如果主线程阻塞超过阈值（启动时 20s，前台 ~10s），直接杀 App。

类比 Android ANR：效果一样（App 被杀/弹窗），但 iOS 不弹窗直接杀，用户看到的是闪退。

### iOS 为什么没有 ANR 弹窗？

设计哲学不同：
- Android：弹窗让用户选"等待"还是"关闭"
- iOS：直接杀掉，用户体验更"干净"但对开发者更残酷（没有容错机会）

### Jetsam 是什么？

iOS 的内存管理守护进程。系统内存不足时按优先级杀 App（后台 App 先杀，前台 App 最后杀）。

类比 Android 的 LMK（Low Memory Killer）：一样的机制，内存紧张时按 OOM adj 优先级杀进程。

### iOS 的 Instruments 怎么用？

```
Xcode → Product → Profile（⌘I）→ 选择模板：
  - Time Profiler：CPU 热点分析（类似 AS Profiler CPU）
  - Allocations：内存分配追踪
  - Leaks：泄漏检测
  - Core Animation：帧率 + 离屏渲染
  - App Launch：启动时间分析
  - System Trace：系统级线程调度
```

和 AS Profiler 的区别：Instruments 是**录制制**（先录制一段，再分析），AS Profiler 是**实时制**（attach 后实时看）。
