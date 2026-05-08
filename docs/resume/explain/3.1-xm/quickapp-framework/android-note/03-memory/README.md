# 03. 内存管理

> Android 内存模型、GC 机制、度量指标、泄漏检测。

## 目录

- [一、Android 内存模型](#一android-内存模型)
- [二、ART GC 机制](#二art-gc-机制)
- [三、内存度量指标](#三内存度量指标)
- [四、内存泄漏](#四内存泄漏)
- [五、V8 内存与 Java 内存的关系](#五v8-内存与-java-内存的关系)
- [六、系统内存管理（LMK）](#六系统内存管理lmk)

---

## 一、Android 内存模型

```
App 进程虚拟地址空间
├── Java Heap（ART 管理）
│   ├── Young Generation（新生代，Minor GC 频繁）
│   └── Old Generation（老年代，Major GC 偶尔）
├── Native Heap（malloc/free）
│   ├── V8 Heap（V8 GC 管理）
│   ├── Bitmap 像素（Android 8.0+）
│   ├── so 库动态分配
│   └── JNI 分配
├── mmap 区域
│   ├── .dex 文件映射（代码）
│   ├── .so 文件映射（Native 库）
│   ├── .oat 文件映射（AOT 编译产物）
│   └── 资源文件映射
├── Stack（每个线程一个栈，默认 1MB）
└── 其他（Ashmem 共享内存等）
```

### Java Heap vs Native Heap

| | Java Heap | Native Heap |
|---|---|---|
| 管理方式 | ART GC 自动回收 | 手动 malloc/free（或 V8 GC） |
| 大小限制 | 有上限（dalvik.vm.heapsize，通常 256-512MB） | 受系统物理内存限制 |
| OOM | 超过 heapsize → OutOfMemoryError | 超过系统限制 → 被 LMK 杀 |
| 监控 | dumpsys meminfo 的 Java Heap 部分 | Native Heap 部分 |

---

## 二、ART GC 机制

### GC 类型

| GC 类型 | 触发条件 | 暂停时间 | 说明 |
|---------|---------|---------|------|
| Young GC | 新生代满 | ~1-5ms | 只回收新生代，频繁但快 |
| Full GC | 老年代满 / 显式调用 | ~10-50ms | 回收整个堆，慢 |
| Concurrent GC | 后台并发 | ~0ms（几乎不暂停） | ART 默认，大部分工作并发完成 |

### ART vs Dalvik

| | Dalvik（Android 4.4-） | ART（Android 5.0+） |
|---|---|---|
| 执行方式 | JIT（运行时编译） | AOT + JIT 混合 |
| GC | Stop-the-world 为主 | 并发 GC 为主（暂停极短） |
| 内存效率 | 较低 | 较高（Compact GC 减少碎片） |

### 对 App 的影响

GC 暂停 → 主线程被暂停 → 丢帧。ART 的并发 GC 已经把暂停时间降到 1-5ms，通常不会造成可感知的卡顿。但如果频繁分配大量临时对象 → 频繁触发 GC → 累积暂停时间 → 卡顿。

优化：减少临时对象分配（对象池、避免在循环里创建对象）。

---

## 三、内存度量指标

| 指标 | 全称 | 含义 | 特点 |
|------|------|------|------|
| **VSS** | Virtual Set Size | 虚拟内存（含未分配的） | 最大，参考价值低 |
| **RSS** | Resident Set Size | 常驻物理内存（含共享库） | 偏大（共享库重复计入） |
| **PSS** | Proportional Set Size | 按比例分摊共享内存 | **最常用**，公平反映真实占用 |
| **USS** | Unique Set Size | 独占内存（不含共享） | 最小，进程被杀后释放的量 |

### PSS 的计算

```
一个 so 库被 3 个进程共享，大小 9MB
每个进程的 PSS 贡献 = 9MB / 3 = 3MB

如果只有 1 个进程用这个 so
PSS 贡献 = 9MB / 1 = 9MB
```

### 查看内存

```bash
# 查看某个进程的内存详情
adb shell dumpsys meminfo <package_name>

# 输出示例
App Summary
                       Pss(KB)
Java Heap:              12,345
Native Heap:            23,456
Code:                   34,567  ← dex + so 的 mmap
Stack:                     512
Graphics:                5,678
...
TOTAL:                  85,000
```

---

## 四、内存泄漏

### 常见泄漏场景

| 场景 | 原因 | 解决 |
|------|------|------|
| Activity 泄漏 | 静态变量/单例持有 Activity 引用 | 用 WeakReference |
| Handler 泄漏 | 匿名内部类持有外部 Activity | 用静态内部类 + WeakReference |
| 注册未注销 | registerReceiver 后没 unregister | 在 onDestroy 注销 |
| 集合累积 | 往 static List 里加对象不清理 | 及时 remove / 用 WeakHashMap |
| Bitmap 未回收 | 大图加载后没 recycle | 用 Glide/Picasso 自动管理 |

### 检测工具

| 工具 | 用途 |
|------|------|
| LeakCanary | 自动检测 Activity/Fragment 泄漏（开发阶段） |
| Android Studio Profiler | 实时查看内存分配和 GC |
| MAT (Memory Analyzer Tool) | 分析 hprof 堆转储文件 |
| dumpsys meminfo | 命令行查看内存概况 |

---

## 五、V8 内存与 Java 内存的关系

快应用框架里有两个独立的内存管理系统：

```
App 进程
├── Java Heap（ART GC 管理）
│   └── J2V8 的 Java 对象（V8Object 的 Java 壳）
└── Native Heap
    └── V8 Heap（V8 Orinoco GC 管理）
        └── JS 对象、字符串、闭包等
```

### 双 GC 的挑战

| 问题 | 说明 | 解决 |
|------|------|------|
| V8 对象泄漏 | Java 侧 V8Object 没 release() → V8 不知道可以回收 | 严格 release() 规范 |
| Java 对象被误回收 | Java 对象传给 V8 后，Java 侧没引用了 → Java GC 回收 | J2V8 内部持有强引用 |
| 内存统计不准 | dumpsys meminfo 的 Native Heap 包含 V8 Heap，但看不到细分 | 需要 V8 的 heap statistics API |

### V8 内存限制

V8 默认堆大小有限制（通常 1.5GB），可以通过启动参数调整：

```java
// 创建 V8 时设置最大堆
V8 runtime = V8.createV8Runtime("global", tempDir, 
    "--max-old-space-size=512"); // 限制 512MB
```

快应用框架通常不需要这么大，但如果 JS 侧处理大数据（比如大列表的虚拟 DOM）可能需要关注。

---

## 六、系统内存管理（LMK）

### Low Memory Killer

Android 内核的 LMK（Low Memory Killer）在系统内存不足时按优先级杀进程：

```
系统可用内存下降
  → 触发 LMK
  → 按 oom_adj 值从高到低杀（值越高越容易被杀）
  → 空进程（oom_adj=15）最先被杀
  → 前台进程（oom_adj=0）最后被杀
```

### 对快应用框架的影响

- 框架进程被杀 → 用户再打开快应用需要重新启动框架 → 冷启动
- 优化内存（PSS 降低）→ 被杀概率降低 → 用户体验更好
- 这就是为什么合规审查有 PSS 上限——PSS 太高的应用会影响系统整体内存，导致其他应用被杀

### onTrimMemory 回调

系统内存紧张时会通知 App，App 可以主动释放缓存：

```java
@Override
public void onTrimMemory(int level) {
    if (level >= TRIM_MEMORY_MODERATE) {
        // 系统内存紧张，释放非必要缓存
        imageCache.clear();
        v8SnapshotCache.clear();
    }
}
```
