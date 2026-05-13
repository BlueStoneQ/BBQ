# Android 体系成长路线

> 基于当前项目经验，补齐 5 年 Android 工程师的知识体系。标注已掌握（✅）和待补（⬜）。

## 目录

- [你的当前位置](#你的当前位置)
- [一、Android 四大组件 & 系统机制](#一android-四大组件--系统机制)
- [二、性能优化（你的强项）](#二性能优化你的强项)
- [三、构建 & 工程化（你的强项）](#三构建--工程化你的强项)
- [四、架构模式（需要补）](#四架构模式需要补)
- [五、现代 Android 技术栈（需要补）](#五现代-android-技术栈需要补)
- [六、Framework 层（加分项）](#六framework-层加分项)
- [七、面试高频 & 实战映射](#七面试高频--实战映射)
- [八、学习优先级建议](#八学习优先级建议)

## 你的当前位置

**优势：** 系统级 Android 开发经验（ROM 集成、预装优化、性能合规），工程化能力强（CI/CD、多仓协同、自动化测试）。

**短板（待补）：** 应用层开发经验（UI/架构模式）、Framework 源码深度、Kotlin 协程/Compose 等现代技术栈。

---

## 一、Android 四大组件 & 系统机制

| 知识点 | 状态 | 项目中的体现 |
|--------|------|------------|
| Activity 生命周期 | ✅ | LauncherActivity、VendorDispatcherActivity |
| Service（Bound/Started） | ✅ | HostService（AIDL Bound Service） |
| BroadcastReceiver | ✅ | QuickAppWidgetProvider |
| ContentProvider | ✅ | HybridProvider、PackageManagerProvider |
| Intent/PendingIntent | ✅ | deeplink 启动、Widget 点击 |
| 多进程架构 | ✅ | Launcher0~4、widgetProvider 进程 |
| AIDL/IPC | ✅ | IHostRequest 接口 |
| OOM adj & 进程优先级 | ✅ | 内存排查时深入分析了 Foreground/Previous/Cached |
| Handler/Looper/MessageQueue | ⬜ | 框架内部大量使用，需要理解原理 |
| Binder 机制原理 | ⬜ | AIDL 底层，面试高频 |

## 二、性能优化（你的强项）

| 知识点 | 状态 | 项目中的体现 |
|--------|------|------------|
| 内存优化（PSS/RSS/堆分析） | ✅ | 老化内存测试、R8 混淆降内存 |
| 包体优化（R8/shrink/resConfigs） | ✅ | 152MB → 58MB 全链路优化 |
| DEX 优化（Layout/multidex） | ✅ | baselineProfile dexLayoutOptimization |
| ProGuard/R8 规则 | ✅ | consumerProguardFiles 排查、keep 规则清理 |
| 16KB 页对齐 | ✅ | NDK 升级、SO 重编译 |
| 启动优化 | ⬜ | 框架有 Splash + 预加载机制，可以深入 |
| ANR 分析 | ⬜ | 系统级开发常见问题 |
| 内存泄漏检测（LeakCanary/MAT） | ⬜ | hprof 分析在测试指南中提到 |
| Systrace/Perfetto | ⬜ | 测试工具有 trace 采集，可以学习分析 |

## 三、构建 & 工程化（你的强项）

| 知识点 | 状态 | 项目中的体现 |
|--------|------|------------|
| Gradle 多模块构建 | ✅ | 60+ 模块的 settings.gradle |
| Build Variants | ✅ | phone/tv/soundbox × debug/release |
| 依赖管理（Maven/aar） | ✅ | publishToMavenLocal、三方 SDK 版本管理 |
| CI/CD 流水线 | ✅ | CDP 构建、Gerrit cherry-pick |
| ROM 集成（预装/manifest） | ✅ | CORGI 平台、product 分区 |
| 签名 & 发布 | ✅ | platform 签名、ROM 打包 |
| NDK 构建 | ✅ | V8 引擎编译、SO 对齐 |
| Gradle Plugin 开发 | ⬜ | 框架有自定义 plugin，可以学习 |

## 四、架构模式（需要补）

| 知识点 | 状态 | 学习建议 |
|--------|------|---------|
| MVP/MVVM/MVI | ⬜ | 看框架中 Presenter 模式（AppWidgetPresenter） |
| 组件化/模块化 | ✅ | 项目本身就是极致的模块化 |
| 依赖注入（Hilt/Dagger） | ⬜ | 框架用 ProviderManager 做服务注册，类似思想 |
| Repository 模式 | ⬜ | 数据层抽象 |
| Clean Architecture | ⬜ | 分层思想在框架中有体现 |

## 五、现代 Android 技术栈（需要补）

| 知识点 | 状态 | 优先级 |
|--------|------|--------|
| Kotlin 协程 | ⬜ | 高（面试必问） |
| Jetpack Compose | ⬜ | 中（趋势，但系统开发用得少） |
| ViewModel + LiveData/Flow | ⬜ | 高（应用层标配） |
| Room 数据库 | ⬜ | 中 |
| Navigation Component | ⬜ | 低 |
| WorkManager | ⬜ | 中（替代 JobService） |

## 六、Framework 层（加分项）

| 知识点 | 状态 | 项目中的体现 |
|--------|------|------------|
| AMS/WMS 基础 | ⬜ | logcat 中看到 ActivityTaskManager、WindowManager |
| PMS（PackageManager） | ⬜ | 框架有 PackageManagerProvider |
| 系统服务调用链 | ⬜ | HostService 被系统调度 |
| SELinux 策略 | ⬜ | logcat 中有 avc denied |
| SystemUI 交互 | ⬜ | 通知、悬浮窗 |

## 七、面试高频 & 实战映射

| 面试题 | 你的实战回答 |
|--------|------------|
| "说说你做过的性能优化" | APK 152→58MB，内存 55→34MB，R8+DEX Layout+16KB 对齐 |
| "多进程通信怎么做的" | AIDL HostService，应用市场通过 Bound Service 调用框架 |
| "说说 Android 内存管理" | OOM adj 机制，PSS/RSS 区别，老化内存测试方法论 |
| "Gradle 构建优化" | 60+ 模块构建，buildForRom 裁剪，CDP 流水线 |
| "遇到过什么疑难问题" | Widget 定时更新触发前台拉起导致内存超标，logcat 全链路排查 |
| "ROM 预装流程" | CI 构建 APK → manifest 上传 → CORGI 出 ROM → 刷机验证 |
| "R8 混淆踩过什么坑" | consumerProguardFiles 宽泛 keep 规则阻止裁剪，dex 没变小 |

## 八、学习优先级建议

### 短期（1-2 周）— 补面试短板
1. **Kotlin 协程**：suspend/async/Flow，对标 Java 线程池
2. **Binder 机制**：AIDL 底层原理，一次拷贝
3. **Handler 机制**：Looper/MessageQueue/同步屏障

### 中期（1-2 月）— 深化系统理解
4. **AMS 启动流程**：Activity 启动全链路（你已经在 logcat 里看到了）
5. **内存管理深入**：LMK/LMKD、cgroup、page cache
6. **Systrace/Perfetto 分析**：结合项目的 trace 数据实操

### 长期（持续）— 拓宽技术面
7. **Jetpack Compose**：声明式 UI
8. **跨端框架对比**：Flutter/RN vs 快应用的架构差异
9. **系统定制开发**：Framework 层修改、系统服务开发
