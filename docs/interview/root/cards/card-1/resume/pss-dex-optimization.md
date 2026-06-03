# PSS 内存优化 — DEX 布局优化（41MB → 35.8MB）

## 一句话

通过 Baseline Profile 重排 DEX 中类的物理位置，让启动时用到的热代码集中在前几页，减少 page fault，PSS 从 41MB 降到 35.8MB。

---

## 目录

- [问题背景](#问题背景)
- [原理](#原理)
- [全链路操作步骤](#全链路操作步骤)
- [成果](#成果)

---

## 问题背景

快应用框架预装到 ROM，启动内存是厂商关注的核心指标。PSS MAX 41MB 偏高，需要优化。

---

## 原理

### 分页（Page）— 操作系统内存管理的最小单位

操作系统不是按字节管理内存的，而是按**页（Page）**为最小粒度：
- 传统 Android：4KB 一页
- Android 15+：支持 16KB 一页（提升 TLB 缓存命中率）

不管你要读 1 字节还是 3000 字节，OS 都会加载整个页到物理内存。这是 CPU 硬件（MMU 内存管理单元）决定的——虚拟地址到物理地址的映射粒度就是页。

> 页大小不是"CPU 最大寻址范围"（那是 64 位地址空间 = 16EB）。页大小是 OS 和硬件约定的"每次搬运数据的最小块"。

### DEX 布局优化的原理

操作系统通过 mmap 按页加载 DEX 文件到内存。不是一次性加载整个 DEX，而是访问到哪一页才加载哪一页（触发 page fault）。

**DEX 布局优化 = 把启动时用到的类排在 DEX 文件前面**，热代码集中在前几页 → 启动时只需加载少量页 → page fault 减少 → PSS 降低。

```
优化前：
  DEX 文件：[冷类A][热类B][冷类C][热类D][冷类E][热类F]...
  启动时需要 B、D、F → 加载 page 1~6（6 次 page fault）

优化后：
  DEX 文件：[热类B][热类D][热类F][冷类A][冷类C][冷类E]...
  启动时需要 B、D、F → 加载 page 1~2（2 次 page fault）
```

冷代码在后面的页里，启动时没被访问 → 不触发 page fault → 不加载 → 不占内存。

---

## 全链路操作步骤

```
① 采集 Baseline Profile（记录启动时哪些类/方法被调用）
② 生成 baseline-prof.txt 放入项目
③ 构建时 AGP 根据 profile 重排 DEX
④ 验证效果（对比 PSS + page fault）
```

### Step 1：采集 Baseline Profile

```bash
# 清除已有 profile
adb shell cmd package compile --reset com.myapp

# 启动 App，操作首屏流程
adb shell am start com.myapp/.MainActivity

# 等待 ART 采集（约 30s）
# 导出 profile
adb shell cmd package dump-profiles com.myapp
adb pull /data/misc/profiles/cur/0/com.myapp/primary.prof ./baseline-prof.txt
```

### Step 2：放入项目

```
app/src/main/baseline-prof.txt
```

**baseline-prof.txt 记录了什么**：启动期间被执行到的类和方法列表——一份"热代码清单"。

```
# 文件内容示例：
Lcom/myapp/MainActivity;                          ← 启动时用到的类
Lcom/facebook/react/ReactActivity;
Lcom/facebook/hermes/HermesRuntime;
HSPLcom/myapp/MainActivity;->onCreate(...)V       ← H=Hot, S=Startup, P=Post-startup
```

**怎么导致优化（两层收益）**：
1. **构建时**：AGP 读到这份清单 → 把这些类在 DEX 文件中物理排到前面 → 启动时 page fault 减少 → PSS 降低
2. **安装时**：ART 根据随 APK 分发的 .dm 文件（profile 元数据）对热方法做 AOT 编译 → 运行时直接跑机器码不解释执行 → 启动更快

一句话：baseline-prof.txt = 热代码名单 → AGP 排到 DEX 前面 → 少加载页 → 内存低 + 启动快。

### Step 3：构建时自动重排

AGP 7.0+ 检测到 `baseline-prof.txt` 后自动重排 DEX 中类的物理位置。

### Step 4：验证

```bash
# 对比 PSS
adb shell dumpsys meminfo com.myapp | grep "PSS"

# 对比 page fault
adb shell cat /proc/$(pidof com.myapp)/stat | awk '{print $10}'
```

---

## 成果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| PSS MAX | 41MB | 35.8MB |
| 启动 page fault | ~1200 | ~800 |
| 冷启动时间 | — | -100~200ms |
