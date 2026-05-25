# 内存优化

> 问题：App 用一段时间后越来越卡，最终被系统杀掉
> 本质：内存持续增长不回落 = 泄漏；峰值过高 = OOM
> 目标：内存稳定 < 200MB，长时间使用不增长

---

## 如何分析

| 工具 | 看什么 | 平台 |
|------|--------|------|
| Android Profiler Memory | 堆内存趋势（持续增长 = 泄漏） | Android |
| `adb shell dumpsys meminfo <pkg>` | PSS/RSS 详情 | Android |
| LeakCanary | 自动检测 Activity/Fragment 泄漏 + 引用链 | Android |
| Xcode Instruments Allocations | 对象分配 + 生命周期 | iOS |
| Xcode Memory Graph | 可视化引用关系 | iOS |
| Hermes 内存统计 | JS 堆大小 | 跨平台 |

**排查 SOP**：
```
1. Android Profiler → 观察内存趋势（操作 5 分钟）
2. 持续增长不回落 → 有泄漏
3. 触发 GC → 如果仍不降 → 确认泄漏
4. Dump Heap → 按 Retained Size 排序 → 找异常大的对象
5. LeakCanary → 自动给出引用链（谁持有了它）
```

---

## 如何优化

### RN/JS 层

| 手段 | 做什么 | 场景 |
|------|--------|------|
| **useEffect return cleanup** | 组件卸载时取消订阅/清除定时器 | 最常见的 JS 泄漏原因 |
| **导航栈控制** | `unmountOnBlur` / `navigation.reset` | 页面栈无限堆积 |
| **大对象及时释放** | 不再需要的数据 set null | 闭包持有大数组/大对象 |
| **事件监听清理** | `subscription.remove()` | BLE 事件/AppState 监听 |
| **图片缓存策略** | FastImage 设置缓存上限 | 大量图片占内存 |

```typescript
// ✅ useEffect cleanup：组件卸载时清理
useEffect(() => {
  const sub = bleEmitter.addListener('BLE_DATA', handleData);
  const timer = setInterval(heartbeat, 5000);
  
  return () => {
    sub.remove();        // 取消 BLE 监听
    clearInterval(timer); // 清除定时器
  };
}, []);
```

### Native 层（Android）

| 手段 | 做什么 | 场景 |
|------|--------|------|
| **LeakCanary** | 自动检测 Java 对象泄漏 | Activity/Fragment 未释放 |
| **BLE 连接生命周期** | 页面销毁时断开 BLE 连接 | BLE Gatt 对象未释放 |
| **Bitmap 回收** | 大图用完及时 recycle | 图片占 Native 内存 |
| **WeakReference** | 回调持有 Activity 用弱引用 | 避免回调阻止 GC |

### Native 层（iOS）

| 手段 | 做什么 | 场景 |
|------|--------|------|
| Instruments Leaks | 检测循环引用 | delegate/closure 循环引用 |
| `[weak self]` | 闭包里用弱引用 | 避免 self 循环引用 |

### 常见泄漏模式

| 模式 | 原因 | 解决 |
|------|------|------|
| useEffect 没 cleanup | 订阅/定时器组件卸载后仍在跑 | return 里清理 |
| 导航栈堆积 | push 不 pop，页面越来越多 | reset / unmountOnBlur |
| BLE 连接未断开 | 离开页面后 Gatt 对象仍持有 | 生命周期管理 |
| 闭包持有大对象 | 回调函数引用了大数组 | 及时置 null |
| 图片缓存无上限 | FastImage 默认不限制缓存大小 | 设置 maxCacheSize |
