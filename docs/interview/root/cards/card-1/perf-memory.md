# 内存优化

> 问题：App 用一段时间后越来越卡，最终被系统杀掉
>
> 本质：内存持续增长不回落 = 泄漏；峰值过高 = OOM
>
> 目标：内存稳定 < 200MB，长时间使用不增长

---

## 目录

- [如何分析](#如何分析)
- [如何优化](#如何优化)
  - [RN/JS 层](#rnjs-层)
  - [Native 层（Android）](#native-层android)
  - [Native 层（iOS）](#native-层ios)
  - [常见泄漏模式](#常见泄漏模式)

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


---

## DEX 布局优化（Baseline Profile）

### 原理

操作系统按**页（4KB）**加载文件到内存。DEX 文件中类的物理位置是随机的，启动时需要的类分散在各处 → 加载很多页 → page fault 多 → 内存峰值高。

**DEX 布局优化 = 把启动时用到的类排在 DEX 文件前面**，让热代码集中在前几页 → 少读磁盘页 → page fault 减少 → PSS 降低。

**底层逻辑**：操作系统通过 mmap 按**页（4KB）**这个粒度加载文件到内存。不是一次性加载整个 DEX，而是访问到哪一页才加载哪一页（触发 page fault → 内核从磁盘读该页到内存）。热代码集中在前几页 = 启动时只需加载少量页 = 内存占用低。冷代码在后面的页里，启动时没被访问 → 不触发 page fault → 不加载 → 不占内存。

```
优化前：
  DEX 文件：[冷类A][热类B][冷类C][热类D][冷类E][热类F]...
  启动时需要 B、D、F → 加载 page 1、2、3、4、5、6（6 次 page fault）

优化后：
  DEX 文件：[热类B][热类D][热类F][冷类A][冷类C][冷类E]...
  启动时需要 B、D、F → 加载 page 1、2（2 次 page fault）
```

### 全链路操作步骤

```
① 采集 Baseline Profile（记录启动时哪些类/方法被调用）

② 生成 baseline-prof.txt 放入项目

③ 构建时 AGP 根据 profile 重排 DEX

④ 验证效果
```

#### Step 1：采集 Baseline Profile

**方式一：Jetpack Macrobenchmark（推荐，自动化）**

```kotlin
// benchmark/src/androidTest/java/BaselineProfileGenerator.kt
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun generateProfile() {
        rule.collect(packageName = "com.myapp") {
            // 模拟用户启动流程
            startActivityAndWait()
            // 等待首屏渲染完成
            device.waitForIdle()
        }
    }
}
```

```bash
# 运行采集（需要连接真机，不能用模拟器）
./gradlew :benchmark:pixel6Api31BenchmarkAndroidTest \
  -P android.testInstrumentationRunnerArguments.class=BaselineProfileGenerator
```

**方式二：手动采集（简单但不精确）**

```bash
# 1. 清除已有 profile
adb shell cmd package compile --reset com.myapp

# 2. 启动 App，操作首屏流程
adb shell am start com.myapp/.MainActivity

# 3. 等待 ART 采集完成（约 30s）
# 4. 导出 profile
adb shell cmd package dump-profiles com.myapp
adb pull /data/misc/profiles/cur/0/com.myapp/primary.prof ./baseline-prof.txt
```

#### Step 2：放入项目

```
app/
└── src/main/
    └── baseline-prof.txt    ← 放这里，AGP 自动识别
```

文件内容示例：
```
# 启动时用到的类和方法
Lcom/myapp/MainActivity;
Lcom/facebook/react/ReactActivity;
Lcom/facebook/hermes/HermesRuntime;
HSPLcom/myapp/MainActivity;->onCreate(Landroid/os/Bundle;)V
```

#### Step 3：构建时自动重排

```groovy
// app/build.gradle（AGP（Android Gradle Plugin，Google 提供的 Android 构建插件）7.0+ 自动支持）
android {
    buildTypes {
        release {
            // AGP 检测到 baseline-prof.txt 后自动：
            // 1. 根据 profile 重排 DEX 中类的物理位置
            // 2. 生成 .dm 文件（profile 元数据，随 APK/AAB 分发）
            // 3. 设备安装时 ART 根据 .dm 做 AOT 编译优化
        }
    }
}

// 如果用 Jetpack Baseline Profile 库（更自动化）：
dependencies {
    implementation "androidx.profileinstaller:profileinstaller:1.3.0"
}
```

#### Step 4：验证效果

```bash
# 对比启动内存
adb shell dumpsys meminfo com.myapp | grep "PSS"

# 对比 page fault
adb shell cat /proc/$(pidof com.myapp)/stat | awk '{print $10}'  # minor faults
```

### 效果（你的数据）

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| PSS MAX | 41MB | 35.8MB |
| 启动 page fault | ~1200 | ~800 |
| 冷启动时间 | — | -100~200ms |
