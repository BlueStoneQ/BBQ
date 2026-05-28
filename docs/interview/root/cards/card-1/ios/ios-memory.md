# iOS 内存优化

## Android → iOS 概念映射

| Android | iOS | 说明 |
|---------|-----|------|
| PSS（Proportional Set Size） | Footprint（物理内存占用） | 内存指标 |
| OOM（OutOfMemoryError） | Jetsam（系统直接杀进程） | 内存超限后果 |
| GC（垃圾回收） | ARC（自动引用计数） | 内存回收机制 |
| LeakCanary | Instruments Allocations / Leaks | 泄漏检测工具 |
| `adb shell dumpsys meminfo` | Xcode Memory Gauge / Instruments | 内存监控 |
| onTrimMemory | didReceiveMemoryWarning | 系统内存压力回调 |
| DEX 布局优化（减少 page fault） | dyld 优化（减少动态库加载） | 启动内存优化 |
| Bitmap 回收 | UIImage 释放 | 大图内存管理 |

---

## iOS 内存的特殊性

**iOS 没有 swap（交换分区）**，内存超限 → 系统直接杀进程（Jetsam），没有 OOM 异常可捕获。

```
Android：内存不够 → swap 到磁盘 → 变慢但不死
iOS：   内存不够 → Jetsam 直接杀进程 → 用户看到闪退
```

所以 iOS 内存管理比 Android 更严格，必须主动控制。

---

## 内存限制

| 设备 | 可用内存（约） | 超过就被杀 |
|------|--------------|-----------|
| iPhone 15 Pro（8GB） | ~2.5GB | 应用级 |
| iPhone 13（4GB） | ~1.5GB | 应用级 |
| iPhone SE 3（4GB） | ~1.5GB | 应用级 |
| 老设备（3GB） | ~1GB | 应用级 |

---

## 优化手段

| 手段 | Android 对应 | iOS 做法 |
|------|-------------|---------|
| **内存泄漏检测** | LeakCanary | Instruments → Leaks / Allocations |
| **大图释放** | Bitmap.recycle() | `imageView.image = nil`（ARC 自动释放） |
| **页面不可见时释放** | onStop 释放缓存 | `viewDidDisappear` 释放大资源 |
| **系统内存压力响应** | onTrimMemory → 清缓存 | `didReceiveMemoryWarning` → 清缓存 |
| **图片降采样** | BitmapFactory.Options.inSampleSize | `UIGraphicsImageRenderer` 按目标尺寸渲染 |
| **V8/Hermes 堆控制** | 同 | 同（两端共用 Hermes，堆大小配置一样） |
| **实例池 LRU** | 同 | 同（RN 实例池方案两端通用） |

---

## 监控

```objc
// 响应系统内存压力
- (void)didReceiveMemoryWarning {
  [super didReceiveMemoryWarning];
  // 清除图片缓存
  [[SDImageCache sharedImageCache] clearMemory];
  // 释放非当前页面的 RN 实例
  [[ReactInstancePool shared] trimToSize:1];
}
```

| 工具 | 用途 |
|------|------|
| Xcode Memory Gauge | 实时查看内存占用 |
| Instruments → Allocations | 追踪每个对象的分配和释放 |
| Instruments → Leaks | 检测循环引用导致的泄漏 |
| MetricKit | 线上采集内存峰值（iOS 13+） |
| `os_proc_available_memory()` | 代码中获取剩余可用内存 |
