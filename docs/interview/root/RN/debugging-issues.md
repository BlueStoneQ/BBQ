# RN 调试与性能问题定位

> 问题驱动：现象 → 工具定位 → 分层归因 → 解决

---

## 目录

- [一、调试工具链](#一调试工具链)
- [二、分层定位思路](#二分层定位思路)
- [三、常见问题归因](#三常见问题归因)
- [四、经典场景](#四经典场景)

---

## 一、调试工具链

| 工具 | 定位什么 | 怎么用 |
|------|---------|--------|
| Performance Monitor（内置） | JS/UI 帧率 | 看哪个线程掉帧 |
| React DevTools | 重渲染 | Highlight updates 看哪些组件在不必要重渲染 |
| Hermes Profiler | JS 函数耗时 | 找到 JS 层最慢的函数 |
| Android Studio Profiler | CPU/内存/线程 | Native 层瓶颈、内存泄漏 |
| systrace / Perfetto | 各线程时间线 | 跨线程瓶颈、帧耗时分析 |
| LeakCanary | Java 内存泄漏 | 自动检测 Activity/Fragment 泄漏 |
| Sentry / Crashlytics | 线上 Crash | 堆栈 + Source Map 还原 |

---

## 二、分层定位思路

```
现象：卡了/慢了/崩了
  ↓
第一步：Performance Monitor → JS 帧率低还是 UI 帧率低？
  ├── JS 低 → JS 线程忙 → Hermes Profiler 看哪个函数慢
  ├── UI 低 → Native 层忙 → systrace 看 UI Thread
  └── 都低 → Bridge 瓶颈 或 整体过载
```

**关键**：先分层（JS/Native/通信），再定位具体原因。不要上来就猜。

---

## 三、常见问题归因

| 现象 | 归因 | 定位方式 | 解决 |
|------|------|---------|------|
| 列表滚动卡 | renderItem 重渲染 | React DevTools 看 re-render | memo + FlashList |
| 页面切换动画卡 | 切换时 JS 在做重计算 | Performance Monitor（切换瞬间 JS 帧率掉） | InteractionManager 延迟 |
| 手势不跟手 | 动画走 JS 线程 | 拖拽时 JS 帧率掉 | Reanimated worklet |
| 启动慢 | Bundle 大 / 全量注册 | 分段打点 | 分 Bundle + 懒加载 |
| 内存持续增长 | 订阅未清理 / 图片未释放 | Android Profiler 看堆增长 | cleanup + FastImage |
| BLE 数据延迟 | Bridge 阻塞（旧架构） | systrace 看 Bridge 线程 | TurboModule + 事件节流 |
| 白屏闪烁 | 列表滚动快来不及渲染 | 肉眼可见 | FlashList + 增大 windowSize |
| Crash（JS） | 未捕获异常 | Sentry 堆栈 | ErrorBoundary |
| Crash（Native） | OOM / ANR | Profiler + tombstone | 内存优化 / 主线程不做重活 |

---

## 四、经典场景

### 场景 1：白屏

**现象**：页面跳转后白屏 1-2 秒；列表快速滚动时 item 白屏。

**定位**：页面白屏 = Bundle 加载 + 首屏渲染耗时；列表白屏 = FlatList 来不及渲染。

**解决**：
- 页面白屏 → 骨架屏 + Bundle 预加载 + 容器预热
- 列表白屏 → FlashList（View 复用）+ estimatedItemSize

### 场景 2：启动慢

**现象**：冷启动 3-5 秒。

**定位**：分段打点（Native init → Bundle load → JS exec → 首屏渲染），找最慢的段。

**解决**：TurboModule 懒加载 + 分 Bundle + Hermes AOT + 首屏最小化

### 场景 3：内存泄漏

**现象**：用一段时间后越来越卡，最终被杀。

**定位**：Android Profiler 看内存趋势 + LeakCanary 检测。

**解决**：useEffect cleanup + FastImage + 导航栈控制 + BLE 连接生命周期管理

### 场景 4：ANR

**现象**：Android 弹"应用无响应"。

**定位**：主线程被阻塞超 5 秒。systrace 看 UI Thread 在做什么。

**解决**：IO/网络移到子线程 + 重计算用 Worker + BLE 操作确保异步

### 场景 5：BLE 连接不稳定

**现象**：频繁断连、连接超时、数据丢失。

**定位**：区分信号弱/超时/系统错误（分类上报）。

**解决**：重连策略（指数退避）+ 心跳检测 + 连接参数调优 + 错误分类处理
