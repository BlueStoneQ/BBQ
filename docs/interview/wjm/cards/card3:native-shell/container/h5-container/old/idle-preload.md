# 闲时加载（Idle Preload）

> 原理：不在启动关键路径中执行重任务，而是等主线程事件循环空闲时再做。

---

## 核心原理：主线程本质就是 Loop

```
Android / iOS 的主线程本质是一个无限循环（事件循环）：

while (true) {
  message = queue.next();   // 取下一个任务
  if (message != null) {
    message.execute();       // 执行任务（UI 渲染、点击事件、动画...）
  } else {
    idle();                  // 没任务了 → 空闲！
  }
}
```

**闲时 = 事件循环取不到新任务的间隙。** 这时候做预加载不会影响用户交互。

---

## 双端 API

| | Android | iOS |
|--|---------|-----|
| **API** | `MessageQueue.IdleHandler` | `CFRunLoopObserver(.beforeWaiting)` |
| **触发时机** | 消息队列空了 | RunLoop 即将进入休眠 |
| **执行线程** | 主线程 | 主线程 |
| **一次性/持续** | 返回 `false` = 一次性；`true` = 每次 idle 都触发 | `repeats` 参数控制 |

---

## Android 实现

```kotlin
// 主线程消息队列空闲时执行
Looper.myQueue().addIdleHandler {
    // 这里做预加载（WebView 预创建 / 数据预取 / 缓存预热）
    WebViewPool.preload(context)
    false // 返回 false = 执行一次后移除
}
```

**原理**：
- `Looper` 不断从 `MessageQueue` 取 `Message` 执行
- 当队列为空（或下一个消息还没到触发时间），触发所有 `IdleHandler`
- 执行完后继续等待新消息

---

## iOS 实现

```swift
// 监听 RunLoop 即将休眠 = idle
let observer = CFRunLoopObserverCreateWithHandler(
    nil,
    CFRunLoopActivity.beforeWaiting.rawValue,  // 即将休眠
    false,  // 不重复（一次性）
    0       // 优先级
) { _, _ in
    WebViewPool.shared.preload()
}
CFRunLoopAddObserver(CFRunLoopGetMain(), observer, .defaultMode)
```

**原理**：
- iOS 主线程跑一个 `CFRunLoop`
- RunLoop 状态：`Entry` → `Timer/Source` → `BeforeWaiting` → `Sleeping` → `Wakeup`
- `beforeWaiting` = 所有当前事件处理完了，准备休眠 = idle

---

## 典型应用场景

| 场景 | 说明 |
|------|------|
| **WebView 预创建** | 启动后闲时创建 WebView 实例放入池中 |
| **RN 实例预热** | 闲时创建 RN ReactContext（XRN 多实例场景） |
| **数据预取** | 闲时发起接口请求，缓存结果 |
| **图片预解码** | 闲时解码下一屏图片 |
| **离线包解压** | 闲时解压下载好的离线包 |

---

## 注意事项

1. **不要在 idle 中做太重的事**：idle 窗口可能很短（几 ms），如果任务太重会阻塞下一次用户交互
2. **拆分任务**：大任务拆成多个小任务，每次 idle 做一个
3. **避免死循环**：`IdleHandler` 返回 `true` 会每次 idle 都触发，确保任务有终止条件
