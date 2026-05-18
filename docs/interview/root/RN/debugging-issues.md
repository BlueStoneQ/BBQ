# RN 调试与常见问题归因

> 问题驱动：现象 → 分层定位 → 归因 → 解决

---

## 目录

- [一、调试工具链](#一调试工具链)
- [二、定位思路（分层排查）](#二定位思路分层排查)
- [三、常见问题归因表](#三常见问题归因表)
- [四、经典优化场景](#四经典优化场景)

---

## 一、调试工具链

| 工具 | 用途 | 定位什么 |
|------|------|---------|
| Performance Monitor（内置） | 实时 JS/UI 帧率 | 掉帧归因（JS 忙还是 UI 忙） |
| React Native DevTools | 组件树/State/重渲染高亮 | 不必要的重渲染 |
| Hermes Profiler | JS 函数级耗时 | JS 层哪个函数慢 |
| Android Studio Profiler | CPU/内存/线程 | Native 层瓶颈、内存泄漏 |
| systrace | 各线程时间线 | 跨线程瓶颈 |
| LeakCanary | Java 内存泄漏 | Native 层泄漏 |
| Sentry / Crashlytics | Crash 堆栈 + Source Map | 线上崩溃定位 |

---

## 二、定位思路（分层排查）

```
现象：卡/慢/崩
  ↓
看 Performance Monitor → JS 帧率低还是 UI 帧率低？
  ├── JS 低 → JS 线程忙 → Hermes Profiler 看哪个函数
  ├── UI 低 → Native 层忙 → systrace / Profiler 看 UI Thread
  └── 都低 → Bridge 瓶颈 或 整体过载
```

---

## 三、常见问题归因表

| 现象 | 归因 | 解决 |
|------|------|------|
| 列表滚动卡 | renderItem 重渲染 / item 复杂 | memo + FlashList + 简化 item |
| 页面切换动画卡 | 切换时 JS 在做重计算 | InteractionManager 延迟计算 |
| 手势不跟手 | 动画走 JS 线程 | Reanimated worklet |
| 启动慢 | Bundle 大 / 全量注册 / 首屏重 | 分 Bundle + 懒加载 + 首屏最小化 |
| 内存持续增长 | 订阅未清理 / 图片未释放 / 栈堆积 | cleanup + FastImage + 栈控制 |
| BLE 数据延迟 | Bridge 阻塞 / 事件积压 | TurboModule + 事件节流 |
| 白屏闪烁 | 列表滚动快来不及渲染 | FlashList + 骨架屏 |
| Crash（JS） | 未捕获异常 | ErrorBoundary + Sentry |
| Crash（Native） | OOM / ANR | 内存优化 + 主线程不做重活 |

---

## 四、经典优化场景

### 场景 1：白屏

**现象**：页面跳转后白屏 1-2 秒才出内容；列表快速滚动时 item 区域白屏闪烁。

**归因**：
- 页面白屏：JS Bundle 加载 + 首屏组件渲染耗时，期间没有任何 UI 展示
- 列表白屏：虚拟列表来不及渲染新 item（FlatList 销毁重建慢）

**解决**：
- 页面白屏 → Splash Screen 延长到首屏渲染完 / 骨架屏占位 / Bundle 预加载
- 列表白屏 → FlashList（View 复用，不销毁重建）/ 增大 windowSize / 提供 estimatedItemSize

---

### 场景 2：启动慢

**现象**：冷启动到首屏可交互 3-5 秒。

**归因**：
- Native 初始化慢（全量注册 Native Module）
- Bundle 加载慢（单 Bundle 太大）
- JS 执行慢（首屏渲染了太多组件）

**解决**：
- TurboModule 懒加载（减少启动注册）
- 分 Bundle（首屏只加载 Common + 当前页）
- Hermes AOT（跳过 JS 解析编译）
- 首屏最小化（非首屏内容延迟渲染）
- RN 容器预热（提前创建 ReactInstance）

---

### 场景 3：内存泄漏 / OOM

**现象**：App 使用一段时间后越来越卡，最终被系统杀掉。

**归因**：
- 页面离开后订阅/定时器未清理（JS 层）
- 大图未压缩直接渲染（图片内存）
- 导航栈无限堆积（页面不释放）
- Native 层对象未释放（BLE 连接未断开）

**解决**：
- useEffect return cleanup（清理订阅/定时器）
- FastImage + resize（图片压缩缓存）
- 导航栈控制（unmountOnBlur / reset）
- Native 层生命周期管理（页面离开断开 BLE）

---

### 场景 4：ANR（Application Not Responding）

**现象**：Android 弹出"应用无响应"对话框。

**归因**：主线程（UI Thread）被阻塞超过 5 秒。常见原因：
- 主线程做了 IO 操作（文件读写/网络）
- 主线程做了重计算
- 死锁

**解决**：
- IO 操作移到子线程
- 重计算用 Web Worker（JS 层）或子线程（Native 层）
- BLE 操作确保异步（不在主线程等待连接结果）

---

### 场景 5：BLE 连接不稳定

**现象**：设备频繁断连、连接超时、数据丢失。

**归因**：
- 信号弱（距离远/干扰）
- 连接参数不合理（连接间隔/超时时间）
- 未做重连策略
- Android 蓝牙栈 bug（不同厂商表现不同）

**解决**：
- 重连策略（指数退避，Native 侧实现）
- 心跳检测（定期发空包确认连接存活）
- 连接参数调优（requestConnectionPriority）
- 多设备连接池管理（限制同时连接数）
- 错误分类上报（区分信号弱/超时/系统错误，针对性处理）
