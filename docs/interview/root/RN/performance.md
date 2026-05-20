# RN 大前端性能优化

> 场景驱动：IoT App，BLE 连接智能硬件，常驻后台
> 核心思路：分段测量 → 定位瓶颈 → 针对性优化 → 数据验证

---

## 目录

- [性能优化本质](#性能优化本质)
- [三个核心场景](#三个核心场景)
  - [1. 启动速度](#1-启动速度)
  - [2. 渲染效率（流畅度）](#2-渲染效率流畅度)
  - [3. 内存管理](#3-内存管理)
- [性能敏感就下沉](#性能敏感就下沉)
- [方法论（通用）](#方法论通用)
- [经验案例映射](#经验案例映射)
- [导航与 Bundle 加载优化](#导航与-bundle-加载优化)
- [列表优化](#列表优化)

---

## 性能优化本质

**所有优化都在回答一个问题：在哪个阶段、把什么工作量、从哪里移到哪里（或直接消除）。**

| 阶段 | 优化什么 | 核心手段 |
|------|---------|---------|
| 构建时 | 减少产物体积 / 减少运行时负担 | 分 Bundle、Tree Shaking、R8、Hermes AOT、图片压缩 |
| 运行时 - 加载 | 启动到可交互的时间 | 懒加载、Bundle 预加载、容器预热、首屏最小化 |
| 运行时 - 渲染 | 保持 60fps | 虚拟列表/View 复用、减少重渲染、动画下沉 UI 线程 |
| 运行时 - 内存 | 不 OOM、后台不被杀 | 图片缓存、页面释放、导航栈控制 |
| 通信 | 减少跨线程开销 | TurboModule（JSI）、批量更新、事件节流 |

**万变不离其宗**：
- AOT：解析/编译从运行时移到构建时
- 虚拟列表：渲染所有 → 只渲染可见的
- worklet：动画计算从 JS 线程移到 UI 线程
- 分 Bundle：加载全部 → 按需加载

---

## 三个核心场景

### 1. 启动速度

**关注**：冷启动到首屏可交互的时间

**怎么测**：
- `adb shell am start -W`（TotalTime）
- RN 侧分段打点：Native 初始化 → Bundle 加载 → JS 执行 → 首屏渲染
- 每段单独计时，找最慢的那段

**怎么优化**：

| 手段 | 作用 | 针对哪段 |
|------|------|---------|
| Hermes 预编译字节码 | 减少 JS 解析时间 | Bundle 加载 + JS 执行 |
| TurboModule 懒加载 | 减少启动注册开销 | Native 初始化 |
| 分 Bundle | 首屏只加载 Common + 当前页 | Bundle 加载 |
| RN 容器预热 | 提前创建 ReactInstance | Native 初始化 |
| 延迟非首屏模块 | 首屏渲染后再初始化其他模块 | JS 执行 |

---

### 2. 渲染效率（流畅度）

**关注**：FPS 掉帧、列表滚动卡顿、动画不跟手

**怎么测**：
- React Native DevTools Performance Monitor（JS/UI 帧率）
- `systrace`（Android）看 JS Thread / UI Thread 各自耗时
- 掉帧时看是 JS 线程忙还是 UI 线程忙 → 决定优化方向

**怎么优化**：

| 手段 | 作用 | 场景 |
|------|------|------|
| `React.memo` / `useMemo` / `useCallback` | 减少不必要重渲染 | 组件频繁 re-render |
| FlashList 替代 FlatList | 列表渲染快 5-10x | 长列表（设备列表） |
| Reanimated 3 worklet | 动画在 UI 线程执行，不过 JS | 手势动画/过渡动画 |
| `removeClippedSubviews` | 移除屏幕外 View | 长列表内存 |
| `InteractionManager.runAfterInteractions` | 延迟重计算到动画结束后 | 页面切换时 |

**关键认知**：掉帧要区分是 JS 线程忙还是 UI 线程忙。JS 忙 → 减少 JS 计算/重渲染。UI 忙 → 减少 View 层级/用原生动画。

---

### 3. 内存管理

**关注**：内存泄漏、OOM crash、后台内存占用（IoT App 常驻后台尤其重要）

**怎么测**：
- Android Studio Profiler（Java 堆 + Native 堆）
- `adb shell dumpsys meminfo <package>`（看 PSS）
- LeakCanary（Java 内存泄漏检测）
- Hermes `HermesInternal.getInstrumentedStats()`（JS 堆）

**怎么优化**：

| 手段 | 作用 | 场景 |
|------|------|------|
| 大图压缩 + FastImage 缓存 | 减少图片内存 | 设备图片/头像 |
| useEffect cleanup | 清理订阅/定时器 | 页面离开时 |
| 导航栈控制 | 释放不可见页面 | `unmountOnBlur` / reset |
| RN 容器释放 | 后台页面释放 RN 实例 | 容器化管理 |
| 对象池复用 | 减少 GC 压力 | 高频创建的对象 |

**IoT 特殊考虑**：App 常驻后台监听设备状态，内存必须控制在系统不杀进程的阈值内。

---

## 方法论（通用）

```
1. 定义指标（启动时间/FPS/PSS）
2. 建立基线（当前值是多少）
3. 分段测量（哪个环节最慢/最大）
4. 定位瓶颈（工具 + 数据）
5. 针对性优化（一次只改一个变量）
6. 数据验证（优化前后对比）
7. 持续监控（上线后不退化）
```

---

## 经验案例映射

| 场景 | 案例 | 数据 | 手段 |
|------|------|------|------|
| 启动/内存 | DEX 布局优化 | PSS 41→35.8MB | 热代码前置减少 page fault |
| 包体/启动 | 模块裁剪 | 153→60MB | 反射解耦 + R8 + 条件编译 |
| 渲染/秒开 | 凑单页优化 | 秒开率 10→78% | 请求预加载 + 合并 setData |
| 上传性能 | S3 MPU | 121s→42s | 分片并发上传 |

方法论可迁移：不管是 RN 还是小程序还是 Android 原生，"分段测量→定位瓶颈→针对优化→数据验证"这套思路不变。

---

## 导航与 Bundle 加载优化

### 导航最佳实践（React Navigation 7）

- 用 `createNativeStackNavigator`（原生栈，动画不走 JS 线程）
- 类型安全路由（TypeScript ParamList）
- Deep Linking（推送/外链直跳某页面）
- 路由守卫（未登录拦截，条件渲染而非命令式跳转）

### 分 Bundle 场景下的路由加载

```
启动时：所有路由静态注册（组件是 lazy 占位符）
  → 用户跳转到某路由
  → 触发加载对应 Bundle（device.hbc）
  → 加载中 → 显示 Loading/骨架屏
  → 加载完成 → 渲染真实组件
```

**不是"加载 Bundle 后注册路由"，而是"路由先注册，跳转时按需加载 Bundle"。**

### 预加载优化

| 策略 | 时机 | 效果 |
|------|------|------|
| 空闲预加载 | App 首屏渲染完后，空闲时预加载高频 Bundle | 用户跳转时秒开 |
| 预测加载 | 根据用户行为预测下一步（进了列表 → 预加载详情） | 减少等待感 |
| 预加载优先级 | 高频页面优先，低频页面不预加载 | 平衡内存和体验 |

---

## 性能敏感就下沉

**核心理念**：性能敏感的逻辑从 JS 层下沉到更底层执行，减少跨线程通信开销。

### 下沉到哪一层？

| 下沉到 | 选择条件 | 例子 |
|--------|---------|------|
| Android/iOS（Java/Swift） | 需要调平台 API | BLE、相机、传感器、UI 渲染 |
| C++ | 纯计算 + 跨平台复用 + 极致性能 | 加解密、音视频编解码、图像处理、协议解析 |

### 决策树

```
需要调平台 API？
  → 是 → Android/iOS 层
  → 否 → 需要跨平台复用？
            → 是 → C++
            → 否 → 性能极端敏感（每帧都要算）？
                      → 是 → C++（无 GC）
                      → 否 → Java/Kotlin 够用
```

### IoT App 实际选择

- BLE 通信 → Android 层（系统 API 绑定）
- BLE 协议解析 → C++ 可选（纯计算、跨平台、高频）
- 动画计算 → Reanimated worklet（UI 线程，够快）
- 图像处理 → C++（OpenCV）

### 这个理念的本质

没错。整个 RN 新架构的演进就是这个理念的体现：
- 旧架构：所有逻辑都过 JS 线程 → 瓶颈
- 新架构：性能敏感的下沉（动画→UI 线程 worklet，模块调用→JSI 直调，渲染→Fabric Native）

Reanimated worklet、TurboModule 同步方法、Fabric 并发渲染，本质都是"把该下沉的下沉"。

---

## 列表优化

### 本质问题

FlatList 虚拟化列表：只渲染可见区域 + 缓冲区，滚出去的回收。卡的原因：
- 滚动时 JS 线程要计算"哪些该渲染/回收" → 超 16ms 就掉帧
- renderItem 重（组件复杂/重渲染多）→ 帧预算爆
- 滚动快时来不及渲染 → 白屏闪烁

### FlashList vs FlatList

| 维度 | FlatList | FlashList |
|------|----------|-----------|
| 回收机制 | 销毁 + 重建 View | 复用 View（类似 RecyclerView） |
| 性能 | 中等 | 快 5-10x |
| 内存 | 高（频繁创建销毁） | 低（复用） |
| 白屏 | 滚动快时明显 | 几乎没有 |

FlashList 本质：把 RecyclerView 的"View 复用"思想带到 RN。滚出去的 View 不销毁，换数据重新绑定。

### 通用优化手段

1. **减少重渲染**：`React.memo` 包 item、稳定 keyExtractor、不在 renderItem 里创建新对象/函数
2. **提供 item 高度**：`getItemLayout` / `estimatedItemSize`，省去测量计算
3. **控制渲染窗口**：`windowSize` 改小（5-7）、`maxToRenderPerBatch` 调整
4. **重 item 拆分**：图片用 FastImage、复杂计算 useMemo、非首屏延迟渲染
5. **移除屏幕外 View**：`removeClippedSubviews={true}`（Android）

### IoT 设备列表体验优化

| 优化 | 做法 |
|------|------|
| 骨架屏 | 加载中显示骨架，不是空白 |
| 设备状态实时更新 | BLE 事件只更新变化的 item（不刷新整个列表） |
| 离线缓存 | MMKV 缓存设备列表，断网也能看 |
| 空状态 | 没设备时引导添加 |
| 搜索/筛选 | 本地过滤，响应快 |

---

## 启动优化完整链路

### 本质问题

用户点击图标到看到可交互页面，中间经过什么？每个环节耗时多少？瓶颈在哪？

### 阶段拆分

```
点击图标
  → [阶段1] 进程创建 + Application.onCreate()     ← Native 初始化（20-30%）
  → [阶段2] 加载 JS Bundle（.hbc）                 ← Bundle 加载（10-20%）
  → [阶段3] Hermes 执行 JS（组件树构建）            ← JS 执行（30-40%）
  → [阶段4] React 渲染 → Fabric → Native View      ← 首屏渲染（20-30%）
  → 用户看到可交互页面
```

### 每个阶段的瓶颈和优化

| 阶段 | 瓶颈 | 优化 |
|------|------|------|
| 1. Native 初始化 | 全量注册模块、SDK 初始化 | TurboModule 懒加载、SDK 延迟初始化、容器预热 |
| 2. Bundle 加载 | 文件大、IO 慢 | 分 Bundle（首屏只加载当前页）、Hermes .hbc |
| 3. JS 执行 | 组件树复杂、import 链长 | 首屏最小化、Tree Shaking、减少顶层 import |
| 4. 首屏渲染 | View 层级深、布局重 | 简化首屏 UI、骨架屏、图片懒加载 |

### 怎么测量

- `adb shell am start -W`：整体 TotalTime
- 分段打点：Native init → Bundle load → JS exec → 首屏完成
- Perfetto/systrace：各线程时间线，精确到 ms

### 经验案例映射

- DEX 布局优化（PSS 41→35.8MB）→ 阶段 1 优化（减少 page fault = 启动更快 + 内存更低）
- 分 Bundle（CRN）→ 阶段 2 优化（首屏只加载需要的 Bundle）
- 秒开率 10→78%（小程序）→ 阶段 3+4 优化（请求预加载 + 合并渲染）

### IoT App 特殊考虑

- 启动后要连 BLE → BLE 初始化不阻塞首屏（放在首屏渲染后异步做）
- 用户先看到设备列表（首屏）→ 后台静默连接上次设备 → 连接成功更新 UI
