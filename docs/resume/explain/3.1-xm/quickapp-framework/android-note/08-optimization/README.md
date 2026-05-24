# 08. 性能优化

> 启动速度、内存、包体、渲染、ANR 的优化方案。

## 目录

- [一、性能优化的五个维度](#一性能优化的五个维度)
- [二、启动速度优化](#二启动速度优化)
- [三、内存优化](#三内存优化)
- [四、包体优化](#四包体优化)
- [五、渲染优化](#五渲染优化)
- [六、ANR 治理](#六anr-治理)
- [七、快应用框架的优化实践](#七快应用框架的优化实践)

---

## 一、性能优化的五个维度

| 维度 | 指标 | 用户感知 | 度量工具 |
|------|------|---------|---------|
| 启动速度 | 冷启动时间（ms） | 点击图标到首屏可交互 | Perfetto |
| 内存 | PSS / RSS（MB） | 后台被杀频率、系统流畅度 | dumpsys meminfo |
| 包体 | APK 大小（MB） | 下载时间、存储占用 | APK Analyzer |
| 渲染 | 帧率 / 丢帧率 | 滑动卡顿 | GPU Profiler / Perfetto |
| 稳定性 | ANR 率 / Crash 率 | 无响应、闪退 | Logcat / Tombstone |

---

## 二、启动速度优化

### 冷启动流程

```
用户点击图标
  ↓ Zygote fork 新进程
  ↓ 创建 Application（attachBaseContext → onCreate）
  ↓ 创建 Activity（onCreate → onResume）
  ↓ 首帧绘制（View measure → layout → draw）
  ↓ 用户可交互
```

### 优化手段

| 阶段 | 手段 | 原理 |
|------|------|------|
| 进程创建 | 减少 MultiDex（R8 裁剪后 dex 数量减少） | 少加载 dex = 少 IO |
| Application | 延迟初始化（懒加载非必要 SDK） | 不在主线程阻塞 |
| Application | 异步初始化（子线程初始化非 UI 依赖） | 并行利用多核 |
| Activity | 减少 onCreate 工作量 | 只做首屏必要的事 |
| 首帧 | 减少布局层级 / 使用 ViewStub 延迟加载 | 减少 measure/layout 时间 |
| 首帧 | 预加载数据（在 Application 阶段就开始请求） | 数据和 UI 并行 |
| DEX | DEX Layout Optimization（热代码前置） | 减少 page fault |
| 资源 | 资源预加载 / 资源压缩 | 减少 IO |

### 快应用框架的启动优化

```
普通 App 启动：Application → Activity → 首帧
快应用框架启动：Application → Activity → 加载 V8 → 加载 JS Bundle → 执行 JS → 渲染首帧

额外开销：V8 初始化（~50ms）+ JS Bundle 编译（~100-500ms）+ JS 执行 + Bridge 渲染
```

优化点：
- V8 Snapshot：预编译 JS 字节码，跳过编译阶段
- V8 预加载：App 启动时就初始化 V8，不等到页面打开
- JS Bundle 拆分：首屏代码和非首屏代码分离
- DEX Layout：热代码前置，减少启动时 page fault

### 分 Bundle vs 多 Bundle（概念区分）

```
分 Bundle（Code Splitting）：
  一个 Bundle 拆成多个文件，按需加载到同一个 JS 引擎
  目的：启动优化（首屏只加载首屏代码）
  类比：Webpack 的 dynamic import / lazy load
  不需要通信（同一个引擎，共享内存）

多 Bundle（Multi-Bundle）：
  多个独立的 Bundle，每个是一个完整的业务模块
  可以独立开发/独立构建/独立发布/独立热更新
  目的：业务解耦 + 独立发版 + 团队并行开发
  CRN/XRN 的方案

本质区别：
  分 Bundle = 构建优化（一个产物拆小，按需加载）
  多 Bundle = 架构方案（多个独立产物协同，独立生命周期）
```

### JS 引擎启动优化手段对比

| 手段 | 本质 | 跳过什么 | 引擎 |
|------|------|---------|------|
| **V8 Snapshot** | 把 V8 初始化后的堆内存序列化为二进制文件，启动时直接加载 | 跳过内置对象创建/内置函数编译 | V8 |
| **V8 预加载** | App 启动时就创建 V8 Isolate，不等到页面打开 | 把 V8 初始化时间藏在 Splash 期间 | V8 |
| **Hermes AOT** | 构建时把 JS 编译为 .hbc 字节码 | 跳过运行时 JS 解析+编译 | Hermes |
| **Hermes V1 JIT** | 运行时把热代码编译为机器码 | 热路径不再解释执行 | Hermes V1 |

**V8 Snapshot vs Hermes AOT 的区别**：

```
V8 Snapshot = 冻结内存状态（"拍照"）
  → 把 V8 初始化完的堆（内置对象/框架代码）序列化为二进制
  → 启动时加载这块内存 → 跳过初始化（~100ms → ~10ms）
  → 不是编译代码，是恢复内存

Hermes AOT = 编译代码（"翻译"）
  → 构建时把 JS 源码编译为字节码（.hbc）
  → 运行时直接执行字节码 → 跳过解析阶段
  → 是真正的代码编译

快应用框架用 V8 Snapshot（因为用 V8 引擎）
RN 用 Hermes AOT（因为用 Hermes 引擎）
两者解决的问题相同：减少启动时的 JS 处理开销
```

**V8 支持 AOT 吗？** V8 没有构建时 AOT（不像 Hermes 那样预编译字节码）。V8 的策略是：解释执行 → 发现热代码 → JIT 编译为机器码。Snapshot 是它的启动优化手段，不是 AOT。

---

## 三、内存优化

### Android 内存模型

```
App 进程内存
├── Java Heap（ART 管理，有 GC）
│   ├── 对象实例
│   └── 数组
├── Native Heap（malloc/free，无 GC）
│   ├── V8 Heap（V8 自己的 GC 管理）
│   ├── Bitmap 像素数据（Android 8.0+ 在 Native）
│   └── so 库的动态分配
├── Code（mmap）
│   ├── .dex（代码段）
│   ├── .so（Native 库）
│   └── .oat（AOT 编译产物）
└── Stack（线程栈）
```

### 内存优化手段

| 手段 | 原理 | 适用场景 |
|------|------|---------|
| R8 裁剪 | 减少 dex 大小 → 减少 mmap 常驻页 | dex 占比大时 |
| DEX Layout | 冷代码不加载到物理内存 | 启动内存优化 |
| 图片降采样 | 按 View 大小加载，不加载原图 | 图片多的页面 |
| 对象池 | 复用对象，减少 GC 压力 | 高频创建/销毁的对象 |
| LeakCanary | 检测内存泄漏 | 开发阶段 |
| 弱引用 | 允许 GC 回收 | 缓存场景 |
| onTrimMemory | 系统内存紧张时主动释放 | 后台缓存 |

### PSS 优化（快应用框架实践）

你的优化：PSS MAX 41MB → 35.8MB

```
根因：dex 42MB → mmap 常驻内存高
手段：R8 裁剪（dex 42MB → 27MB）+ DEX Layout（冷代码不加载）
结果：.dex mmap 25.6MB → 17.8MB，TOTAL PSS 43.1MB → 33.4MB
```

---

## 四、包体优化

### APK 组成与优化手段

| 组成 | 占比（快应用框架） | 优化手段 |
|------|-----------------|---------|
| dex（代码） | ~30% | R8 裁剪/混淆、模块裁剪、条件编译 |
| res（资源） | ~20% | shrinkResources、WebP、resConfigs |
| lib（so 库） | ~35% | 只保留目标 ABI、so 压缩 |
| assets | ~15% | 按需下载、压缩 |

### 优化优先级（收益从大到小）

```
1. 模块裁剪（整个模块不要）→ 收益最大（几十 MB 级）
2. so 库裁剪（只保留 arm64-v8a）→ 收益大（减半）
3. R8 裁剪（删除未使用代码）→ 收益中（dex -30~50%）
4. 资源裁剪（shrinkResources）→ 收益中
5. 图片压缩（PNG→WebP）→ 收益小
6. resConfigs（只保留中英文）→ 收益小
```

### 快应用框架的包体优化实践

```
原始：153MB
  ↓ 模块裁剪（凡泰/百度移除）：-50MB+
  ↓ R8 裁剪/混淆：dex 44MB → 27MB（-17MB）
  ↓ shrinkResources + resConfigs：-几 MB
最终：~60MB
```

### 度量工具

- **APK Analyzer**（Android Studio 内置）：可视化查看 APK 各部分大小
- **bundletool**：分析 AAB 的各 split 大小
- **diffuse**：对比两个 APK 的大小差异（哪个类/资源变大了）

---

## 五、渲染优化

### 16ms 法则

60fps = 每帧 16.6ms。如果一帧的 measure + layout + draw 超过 16ms → 丢帧 → 用户感知卡顿。

### 常见渲染性能问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 过度绘制 | 多层背景重叠绘制 | 移除不必要的背景色 |
| 布局层级深 | 嵌套过多 LinearLayout | 用 ConstraintLayout 扁平化 |
| 主线程阻塞 | 在 UI Thread 做 IO/计算 | 移到子线程 |
| 频繁 requestLayout | 逐个修改属性触发多次布局 | 批量修改 |
| 大图片 | 加载原图到内存 | 按需降采样 |

### 快应用框架的渲染优化

- 批量渲染指令：JS 侧攒一批 diff 结果，一次 Bridge 调用传给 Native
- RecyclerView 复用：长列表用 RecyclerView，不创建所有 View
- 异步布局：非首屏 View 延迟创建
- 图片缓存：LRU 缓存 + 磁盘缓存

---

## 六、ANR 治理

### 什么是 ANR

Application Not Responding。主线程被阻塞超过阈值：
- 输入事件：5 秒无响应
- BroadcastReceiver：前台 10 秒 / 后台 60 秒
- Service：前台 20 秒 / 后台 200 秒

### 常见原因

| 原因 | 场景 |
|------|------|
| 主线程 IO | 在 UI Thread 读文件/数据库 |
| 主线程网络 | 在 UI Thread 做网络请求（Android 4.0+ 直接 crash） |
| 死锁 | 主线程等待子线程的锁 |
| Binder 阻塞 | 调用系统服务超时 |
| 过度计算 | 在 UI Thread 做大量计算 |

### 排查工具

- `/data/anr/traces.txt`：ANR 发生时的线程堆栈
- Perfetto：可视化分析主线程阻塞点
- StrictMode：开发阶段检测主线程违规操作

### 快应用框架的 ANR 风险

- J2V8 同步 Bridge：如果 Java 侧 Feature 实现阻塞了 → JS Thread 卡住 → 无法处理事件 → 用户感知无响应
- 解决：耗时 Feature 必须走 IO Thread Pool 异步执行，不能在 Bridge 回调里阻塞

---

## 七、快应用框架的优化实践总结

| 维度 | 做了什么 | 数据 |
|------|---------|------|
| 包体 | R8 + 模块裁剪 + shrinkResources + resConfigs | 153MB → 60MB |
| 内存 | R8 裁剪 dex + DEX Layout Optimization | PSS 41MB → 35.8MB |
| 启动 | DEX Layout（热代码前置）| 减少 page fault |
| 渲染 | 批量渲染指令 | 减少 Bridge 调用次数 |
| 稳定性 | 异步 Feature + 降级方案 | 避免 ANR |
