# iOS 渲染/流畅度优化

## Android → iOS 概念映射

| Android | iOS | 说明 |
|---------|-----|------|
| Choreographer（帧回调） | CADisplayLink | 监控帧率 |
| SurfaceView / TextureView | CALayer / Metal | 渲染层 |
| RecyclerView | UICollectionView | 原生列表复用 |
| Systrace | Instruments → Time Profiler | 性能分析 |
| GPU Profiler | Instruments → Core Animation | GPU 渲染分析 |
| 主线程阻塞 → ANR | 主线程阻塞 → watchdog 杀进程 | 卡顿后果 |
| 60fps = 16.6ms/帧 | 同 | 帧预算 |

---

## iOS 渲染流水线

```
JS 线程（Hermes）
  → 计算 Virtual DOM Diff
  → 生成布局指令（Yoga）

UI 线程（主线程）
  → 创建/更新 UIView
  → Core Animation 提交 CALayer 树
  → GPU 合成 + 绘制
  → 屏幕刷新（60fps / 120fps ProMotion）
```

---

## 优化手段

| 手段 | Android 对应 | iOS 做法 |
|------|-------------|---------|
| **帧率监控** | Choreographer 回调计算丢帧 | CADisplayLink 回调计算丢帧 |
| **列表优化** | FlashList（RecyclerListView） | 同（FlashList 两端通用） |
| **动画下沉 Native** | Reanimated 3（UI 线程） | 同（Reanimated 两端通用） |
| **离屏渲染检测** | GPU Overdraw | Instruments → Core Animation → Color Offscreen-Rendered |
| **图片异步解码** | 子线程 BitmapFactory | `SDWebImage` 异步解码 / `UIImage(contentsOfFile:)` |
| **减少透明图层** | 减少 alpha + 背景色 | `layer.shouldRasterize = YES`（缓存复杂图层） |
| **避免离屏渲染** | 避免 clipChildren | 避免 `cornerRadius + masksToBounds`（用 bezierPath 代替） |

---

## iOS 特有的渲染问题

| 问题 | 原因 | 解决 |
|------|------|------|
| **圆角卡顿** | `cornerRadius + masksToBounds` 触发离屏渲染 | 用 `UIBezierPath` 画圆角，或预渲染圆角图片 |
| **阴影卡顿** | `layer.shadow*` 每帧重新计算 | 设置 `shadowPath`（告诉系统阴影形状，不用每帧计算） |
| **120fps ProMotion** | iPhone 13 Pro+ 支持 120Hz，帧预算只有 8.3ms | 动画更流畅但对性能要求更高 |
| **大图解码阻塞** | UIImage 默认在主线程解码 | 用 `SDWebImage` / `Kingfisher` 异步解码 |

---

## 监控

```swift
// CADisplayLink 监控帧率
let displayLink = CADisplayLink(target: self, selector: #selector(tick))
displayLink.add(to: .main, forMode: .common)

@objc func tick(link: CADisplayLink) {
  // link.duration = 实际帧间隔
  let fps = 1.0 / link.duration
  if fps < 55 { reportJank(fps: fps) }
}
```

| 工具 | 用途 |
|------|------|
| Instruments → Core Animation | 帧率 + 离屏渲染 + GPU 占用 |
| Instruments → Time Profiler | 主线程耗时函数定位 |
| Xcode → Debug → View Debugging | 查看图层层级 |
| React DevTools Profiler | JS 侧渲染耗时（两端通用） |
