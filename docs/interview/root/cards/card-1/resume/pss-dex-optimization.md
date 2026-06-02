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

操作系统通过 mmap 按**页（4KB）**加载 DEX 文件到内存。不是一次性加载整个 DEX，而是访问到哪一页才加载哪一页（触发 page fault）。

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
