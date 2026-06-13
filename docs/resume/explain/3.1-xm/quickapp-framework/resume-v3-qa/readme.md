# 快应用框架 Resume V3 逐条 QA

> 对应 resume-draft-v3.md ② 快应用框架段落，逐个弹点拆解追问。

---

## 目录

- [总体描述 QA](#总体描述-qa)
- [弹点 1：包体优化](#弹点-1包体优化)
- [弹点 2：模块裁剪与降级方案](#弹点-2模块裁剪与降级方案)
- [弹点 3：启动内存优化 DEX 布局](#弹点-3启动内存优化-dex-布局)
- [弹点 4：自动化测试](#弹点-4自动化测试)

---

## 总体描述 QA

### Q：一句话解释这个项目是什么？

**A：** 系统级快应用运行时 = Android 系统预装的跨端应用引擎。前端代码（类 Vue DSL）经编译后，JS 驱动 Native View 渲染（非 WebView），通信层用 V8 + J2V8 同步 Bridge（类 JSI，直接对象传递，零 JSON 序列化）。

### Q：和 RN 的核心架构差异？

**A：**

| 维度 | React Native | 快应用 |
|------|-------------|--------|
| 宿主 | App 内嵌 | 系统预装（/product/app/） |
| JS 引擎 | Hermes / JSC | V8 / QuickJS |
| Bridge | C++ JSI（纯 C++↔JS） | J2V8（Java binding of V8）多一层 JNI |
| DSL | React（JSX） | 类 Vue（.ux 单文件组件） |
| 分发 | App Store | 系统入口（桌面/负一屏/搜索） |
| 包格式 | JS Bundle（Metro） | .rpk（zip: JS Bundle + manifest + 签名） |

本质都是 **JS 逻辑层 → Bridge → Native 渲染层** 三层架构，关键区别在"系统级"带来的预装合规约束（包体/内存有硬性阈值）。

### Q：J2V8 和 JSI 具体区别是什么？为什么说"类 JSI"？

**A：** 

- **相同点**：都是通过 JNI 直接函数调用建立 JS↔Native 通道，不走 URL Schema，不需要异步消息队列
- **不同点**：JSI 是纯 C++ 层面 JS↔Native 直调；J2V8 多一层 JNI（Java↔C++），调用路径是 JS → V8(C++) → JNI → Java
- **"类 JSI"的含义**：强调核心思路一致——同步 Bridge、直接函数调用，比 RN 老架构的异步 JSON Bridge 延迟更低

**注意：J2V8 并非完全零序列化**，实际上分两条通道：

| 通道 | 传输方式 | 是否有序列化 |
|------|---------|:----------:|
| 渲染通道（callNative） | JS 端将 DOM 操作拼成 **JSON 字符串** → J2V8 传 String → Native 端 JSON 解析 | ✅ 有 JSON 序列化 |
| Feature 调用（invoke） | JS 端传 **V8Object** → Java 端通过 `V8ObjectHelper.toMap()` 直接遍历 V8 对象属性转 Map | ❌ 无 JSON，但有对象遍历转换 |

所以更准确的说法是：**Feature 调用通道不走 JSON 序列化（直接对象映射），渲染通道仍然是 JSON 字符串传递**。相比 RN 老架构（所有通信都走 JSON 队列），快应用的 Feature 调用确实更高效，但渲染管线仍依赖 JSON。

---

## 弹点 1：包体优化

> Resume 原文：预装包 **153MB → ~60MB**，dex **44.4MB → 27MB（-39%）**

### Q：为什么预装包体积是 153MB 这么大？里面装了什么？

**A：** 快应用框架承载了多个子引擎和第三方 SDK（历史包袱），主要构成：

| 模块 | 体积 | 说明 |
|------|------|------|
| Unity 游戏引擎资源 | 61MB | 快游戏运行时 |
| 声网 Agora RTC | 24MB | 实时音视频（凡泰依赖） |
| Cocos 游戏引擎资源 | 16.4MB | 快游戏运行时 |
| 百度地图 SDK | 13.8MB | `<map>` 组件依赖 |
| ijkplayer | 7MB | 视频播放（凡泰依赖） |
| 凡泰 FinClip | 3.7MB | 凡泰小程序容器 |
| DEX（Java 代码） | 44.4MB | 框架 + 所有模块的 Java 代码 |
| 其他（资源/so/百度小程序等） | ~15MB | |

合规线要求 ≤ 62MB，超标 2.5 倍。

### Q：具体怎么优化到 60MB 的？分几步？

**A：** 三轮递进：

| 轮次 | 手段 | 收益 | 结果 |
|------|------|------|------|
| 第一轮 | `buildForRom=true` 条件编译排除 | -90.1MB | 152.5 → 62.4MB |
| 第二轮 | resConfigs 精简语言 + shrinkResources | -1.7MB | 62.4 → 60.7MB |
| 第三轮 | R8 全局混淆 + DEX Layout Optimization | dex -39% | 60.7 → ~58MB |

### Q：buildForRom 条件编译具体排除了什么？怎么实现的？

**A：** Gradle 构建时传入 `-PbuildForRom=true`，在各模块的 `build.gradle` 中通过条件判断排除依赖：

```groovy
if (!project.hasProperty('buildForRom') || !buildForRom.toBoolean()) {
    implementation project(':finclip')
    implementation project(':game-engine')
    // ...
}
```

排除的模块：Unity 资源（61MB）、声网（24MB）、Cocos（16.4MB）、ijk（7MB）、凡泰（3.7MB）、百度小程序（1.3MB）。这些模块预装版不包含，用户自升级后恢复。

### Q：dex 从 44.4MB 降到 27MB 是怎么做到的？为什么原来这么大？

**A：** 原来大是因为 **R8 混淆没有真正生效**。

排查发现 R8 的 seeds.txt 有 56 万+ keep 条目——几乎所有类都被保留了。根因是 3 个新增模块的 `proguard-rules.pro` 中写了宽泛 keep 规则（`-keep class **`），通过 `consumerProguardFiles` 机制传递给 app 模块，让全局 R8 分析失效。

修复方式：
1. 清理 3 个模块的宽泛 keep 规则
2. 只在 app 模块开启 minifyEnabled（library 模块关闭），让 app 做全局 R8 tree-shaking
3. 效果：dex 从 6 个文件/44.4MB 降到 4 个文件/27.05MB（-39%）

### Q：resConfigs 精简语言是什么意思？影响用户体验吗？

**A：** Android APK 的 `resources.arsc` 默认包含所有依赖库带入的语言资源索引表（可能有 100+ 种语言）。通过 `resConfigs` 只保留 16 种小米主流市场语言（中/英/德/西/法/葡/阿/泰/韩/日/藏/维等），其余 fallback 英文。

影响范围仅限**框架自身 UI 文案**（系统弹窗、权限提示），不影响开发者快应用内容的多语言。收益：resources.arsc 从 5.14MB 降到 3.40MB。

### Q：面试追问——如果不排除任何模块，纯技术手段能做到 62MB 吗？

**A：** 不行。纯技术手段（R8 + 资源精简）最多砍 20-25MB，从 153MB 只能到 ~130MB。大头在三方 SDK 的 native so 和资源文件（Unity 61MB、声网 24MB），这些是预编译二进制，R8 无法处理。必须走**模块裁剪 + 动态加载/自升级恢复**的架构方案。


### apk一般降包体的方法有哪些, 按优先级, 如果是rn apk呢

**A：**

##### 通用 Android APK 降包体方案（按优先级）

| 优先级 | 方案 | 作用于 | 原理 | 典型收益 |
|:------:|------|--------|------|---------|
| 1 | **R8/ProGuard 混淆 + tree-shaking** | dex | 删除未引用代码 + 缩短标识符 + 内联简单方法 | dex -30~60% |
| 2 | **shrinkResources** | res/ | R8 之后分析资源引用，未被代码引用的资源替换为空文件 | res -10~30% |
| 3 | **resConfigs 精简语言** | resources.arsc | 只保留目标市场语言的字符串索引 | arsc -30~70% |
| 4 | **so ABI 筛选** | lib/ | 只打 arm64-v8a（现代设备均支持），去掉 armeabi-v7a/x86 | so -50~66% |
| 5 | **图片压缩 + WebP/AVIF** | res/drawable | PNG → WebP（无损 -26%，有损 -60~80%）；大图用 VectorDrawable | res -20~50% |
| 6 | **模块裁剪 / 条件编译** | 全局 | 按 Flavor/buildForRom 排除非必要模块（游戏引擎/三方 SDK） | 视模块大小 |
| 7 | **so 动态下载** | lib/ | 首包不含大体积 so，首次使用时从 CDN 下载 + `System.load(path)` | so -80~100% |
| 8 | **Android App Bundle (AAB)** | 全局 | Google Play 按设备裁剪（语言/密度/ABI），用户只下载需要的部分 | 包体 -30~50% |
| 9 | **资源混淆（AndResGuard）** | res/ | 资源路径缩短（`res/drawable-xxhdpi-v4/icon.png` → `r/a/a.png`） | res -5~10% |
| 10 | **Dex 分包优化** | dex | 合理控制 multidex 数量，减少跨 dex 引用冗余 | dex -5~10% |
| 11 | **assets 动态下载** | assets/ | 非首屏必需的 assets（字体/动画/配置）改为按需下载 | 视内容大小 |

**优先级逻辑**：R8 是零成本高收益的第一步；资源类（shrink/resConfigs/WebP）简单配置即收效；so 和模块裁剪收益最大但需要架构改动和降级兜底。

##### APK 体积构成拆解

```
APK = classes.dex（Java/Kotlin 代码）          ~30~50%
    + lib/（.so 原生库）                        ~20~40%
    + res/（布局/图片/动画）                     ~10~20%
    + resources.arsc（资源索引表）               ~2~5%
    + assets/（原始文件：字体/JS Bundle/配置）    ~5~20%
    + META-INF/（签名）                         ~1%
```

##### RN APK 的特殊性

RN App 在通用基础上多了三个大头：**JS Bundle**、**Hermes 字节码**、**RN 核心 so**。

| 优先级 | RN 专属方案 | 作用于 | 原理 | 典型收益 |
|:------:|-----------|--------|------|---------|
| 1 | **Hermes 字节码编译** | assets/ | JS → .hbc 字节码，比原始 JS 小 + 启动快（免解析） | Bundle -30~50% |
| 2 | **Bundle 拆分 + 按需加载** | assets/ | Metro 配置多入口，首包只含入口 Bundle，业务模块懒加载 | 首包 Bundle -50~80% |
| 3 | **Tree-shaking JS 依赖** | assets/ | Metro 的 serializer + babel 插件移除未使用导出 | Bundle -10~30% |
| 4 | **console/devtools 移除** | assets/ | production 构建移除 console.log / React DevTools hook / source-map | Bundle -5~15% |
| 5 | **RN so 精简** | lib/ | 只保留 libc++_shared.so + libhermes.so + libjsi.so，去掉 debug so | so -10~20MB |
| 6 | **图片不打入 Bundle** | assets/res | 图片走 CDN + 缓存，Bundle 中只引用 URL | assets -大量 |
| 7 | **原生侧同通用方案** | dex/res/lib | R8 + shrinkResources + ABI 筛选（同上） | 同上 |

##### RN APK 体积构成差异

```
RN APK = 通用原生部分（dex + res + arsc）
       + lib/arm64-v8a/
       │   ├── libhermes.so         (~4MB)   ← Hermes 引擎
       │   ├── libjsi.so            (~1MB)   ← JSI 通信层
       │   ├── libc++_shared.so     (~1MB)   ← C++ 标准库
       │   ├── libreactnativejni.so (~3MB)   ← RN 核心
       │   └── libXXX.so            (?)      ← 三方 Native Module
       + assets/
       │   └── index.android.bundle (~2~10MB) ← JS 业务代码（或 .hbc）
       + res/（原生资源）
```

##### 面试表达建议

> "APK 降包体优先级：先开 R8（零成本砍 dex 30-60%），再压资源（WebP + resConfigs + shrink），最后看架构级方案（so 动态下载/模块裁剪/AAB）。RN 项目多了 JS Bundle 这个维度，Hermes 编译 + Bundle 拆包是最高效的手段，原生侧方案同步做。"

---

## 弹点 2：模块裁剪与降级方案

> Resume 原文：**反射解耦编译依赖** + metadata 入口控制 + 自升级兜底

### Q：为什么需要"反射解耦编译依赖"？直接删代码不行吗？

**A：** 不行。快应用框架是 monorepo 多模块结构，核心模块（hybrid-core）对凡泰、百度等子模块有编译期硬依赖（import 引用）。如果直接排除子模块依赖，编译直接报错。

反射解耦的作用：**把编译期强依赖变成运行时弱依赖**。核心模块不直接 import 子模块的类，而是通过接口 + 反射动态加载实现类：

```java
// 编译期：只依赖接口
public interface FinClipProvider {
    void init(Context context);
    void openMiniProgram(String appId);
}

// 运行时：反射加载实现
private FinClipProvider getProvider() {
    try {
        Class<?> clazz = Class.forName("com.miui.hybrid.finclip.FinClipProviderImpl");
        return (FinClipProvider) clazz.newInstance();
    } catch (ClassNotFoundException e) {
        return new DefaultFinClipProvider(); // 空实现，降级
    }
}
```

这样 buildForRom 排除凡泰模块时，编译不报错，运行时走降级逻辑。

### Q：metadata 入口控制是什么意思？

**A：** Android 系统通过 `AndroidManifest.xml` 中的 `<meta-data>` 声明来发现和加载模块入口。metadata 入口控制 = 在 buildForRom 时**不注册被裁剪模块的入口信息**，让系统不会尝试拉起不存在的模块。

具体场景：快应用通过 ContentProvider 对外暴露数据给系统其他组件。被裁剪模块对应的 Provider 如果仍在 manifest 中注册，系统查询时会触发类加载失败 crash。

### Q：自升级兜底怎么恢复功能？

**A：** 预装版本（ROM 刷入）功能精简，用户连网后通过应用商店的静默更新机制下载全量版本（包含所有模块）。更新后所有功能恢复。

恢复链路：
1. 预装版缺失模块 → 降级空实现 → 用户无感（该功能不可用）
2. 用户连网 → 应用商店检测到有新版本 → 静默下载全量 APK → 安装
3. 安装后反射加载到真实实现类 → 功能恢复

### Q：面试追问——反射方案的缺点？有更好的方式吗？

**A：**

缺点：
- 反射绕过编译检查，重构时容易遗漏
- 性能比直接调用差（但这里是初始化阶段，不在热路径上，可接受）
- ProGuard/R8 可能混淆掉反射目标类名，需 keep 规则

更好的方式（如果从头设计）：
- **ServiceLoader / SPI 机制**：编译时通过注解生成 META-INF/services 文件，运行时自动发现实现类
- **Hilt / Dagger DI**：依赖注入框架，编译时生成绑定代码，模块不存在时注入空实现
- 但当前项目是遗留代码改造，反射方案改动最小、风险最低，是务实选择

---

## 弹点 3：启动内存优化 DEX 布局

> Resume 原文：DEX 布局优化，热代码前置减少 page fault（PSS MAX **41MB → 35.8MB**）

### Q：什么是 DEX Layout Optimization？为什么能减少内存？

**A：** 

**问题本质**：Android DEX 文件通过 mmap 映射到进程地址空间，按 4KB 页按需加载。冷启动时如果需要调用的方法分散在 DEX 文件的各个位置，就会触发大量 page fault，导致很多页面被加载进内存，PSS 飙升。

**DEX Layout Optimization 原理**：
1. 通过 Baseline Profile 标记启动阶段实际执行的"热方法"
2. 编译时（dex2oat）将热方法物理重排到 DEX 文件的前面几页
3. 冷启动时只需加载前面的少数页面，减少 page fault，降低 PSS

**类比**：就像把一本工具书常用的章节集中放在前 20 页，翻书时只需看前 20 页就够了，不用翻遍全书。

### Q：Baseline Profile 是什么？怎么采集的？

**A：** Baseline Profile 是 Android 提供的一种记录"运行时热方法"的机制。ART 在运行时记录哪些方法被执行过，导出为 .prof 文件。

采集方式：
1. 在设备上运行完整的启动流程（冷启动 → 首页加载 → 关键路径执行）
2. 通过 `adb shell cmd package dump-profiles com.miui.hybrid` 或 `profman` 工具导出 Profile
3. 将 Profile 放入项目 `src/main/baseline-prof.txt`（或 binary profile）
4. 构建时 AGP（Android Gradle Plugin）将 Profile 写入 APK，安装时 ART 据此做 DEX 重排

**实际数据**：原 Profile 只有 5088 条方法，覆盖率严重不足。重新采集后得到 32189 条方法（覆盖 Fresco/Glide/render/widgets 等热路径），DEX Layout 效果才真正体现。

### Q：PSS MAX 41MB → 35.8MB 的具体排查过程？

**A：** 

1. **定位瓶颈**：通过 `dumpsys meminfo` 发现 dex mmap 占 PSS 的 50%（约 19-25MB）
2. **分析 smaps**：通过 `/proc/[pid]/smaps` 确认是 DEX 文件的页面加载量过大
3. **验证 Profile 覆盖率**：发现原 Baseline Profile 只标记 5088 个方法（总共 73000+ 方法），覆盖率 < 7%
4. **重新采集 Profile**：通过运行时采集 + 手动补充关键路径，得到 32189 条方法
5. **构建验证**：更新 Profile → 重新构建 → ROM 刷机 → 老化内存测试

最终 R8 混淆（dex 27MB）+ DEX Layout Optimization 组合效果：
- PSS Max 从 41MB 降到 34-37MB 区间
- 达到合规阈值 37.3MB

### Q：合规阈值 37.3MB 是怎么来的？

**A：** 厂商内部的系统预装应用合规标准。计算方式是对标竞品（荣耀快应用引擎 com.hihonor.quickengine），我们的 PSS 不能超过竞品基线（~2.5MB）+ 38210KB = 37.3MB。

这是硬性门槛——不达标不能上 ROM。

### Q：面试追问——冷启动峰值超标怎么解决？

**A：** 测试中发现系统服务通过 ContentProvider 拉起 hybrid 进程时，Application 初始化 + DEX 加载导致瞬时峰值 41MB，之后降到 22-24MB。

解决思路：
1. **延迟初始化**：Application.onCreate 中非必要模块延迟到首次使用时初始化
2. **DEX Layout**：让启动热方法集中在前几页，减少初始化时的 page fault
3. **进程保活避免冷启动**：但这与系统省电策略冲突，不是好方案
4. **实际处理**：测试环境问题（桌面 Widget 拉起导致），不是代码问题。确保测试前清理环境即可

#### q 一般apk降内存的方案有哪些, 按照优先级, 如果是RN apk呢

**A：**

##### 通用 Android APK 降内存方案（按优先级）

| 优先级 | 方案 | 原理 | 预期收益 | 成本 |
|:------:|------|------|---------|------|
| 1 | **R8/ProGuard 全局混淆** | 删除未使用代码 + 缩短类名方法名 → dex 体积缩小 → mmap 页面减少 | dex -30~50%，PSS -5~15MB | 低（配置 keep 规则） |
| 2 | **DEX Layout Optimization** | Baseline Profile 标记热方法 → dex2oat 重排热代码到前几页 → 冷启动 page fault 减少 | 启动 PSS -2~5MB | 低（采集 Profile） |
| 3 | **延迟初始化 / 懒加载** | Application.onCreate 中非必要组件延迟到首次使用 → 初始化峰值降低 | 峰值 -5~20MB | 中（需理清依赖链） |
| 4 | **图片内存优化** | Bitmap 降采样 / inBitmap 复用 / RGB_565 替代 ARGB_8888 / 及时 recycle | Java Heap -10~50MB | 中 |
| 5 | **Native 内存治理** | so 按需加载 / malloc_trim / jemalloc tuning / 关闭不需要的 native 缓存 | Native Heap -5~20MB | 高 |
| 6 | **进程拆分 / 组件化** | 重功能放独立进程，主进程保持轻量（如 `:push`、`:webview` 子进程） | 主进程 PSS -10~30MB | 高（架构改动） |
| 7 | **资源精简** | resConfigs 限语言 / shrinkResources / WebP 替 PNG / 删未用资源 | resources -1~5MB | 低 |
| 8 | **so 体积优化** | strip debug info / LTO / 排除非必要 ABI / 按需动态下载 so | so mmap -5~20MB | 中 |

**优先级逻辑**：先做收益大且成本低的（R8、DEX Layout），再做需要架构改动的（进程拆分、懒加载）。

##### Android 内存构成拆解

```
TOTAL PSS = Java Heap（对象）
          + Native Heap（C/C++ malloc）
          + Code（.dex mmap + .so mmap + .oat）
          + Stack（线程栈）
          + Graphics（GPU 缓冲）
          + System（共享库分摊）
```

不同类型 App 的主要瓶颈不同：
- **代码密集型**（如快应用框架）：Code(.dex mmap) 占大头 → R8 + DEX Layout 优先
- **图片密集型**（如电商/社交）：Java Heap 占大头 → 图片优化优先
- **游戏/视频类**：Native Heap + Graphics 占大头 → Native 治理 + GPU 缓冲优化

##### RN APK 的特殊性

RN App 内存构成与纯原生不同，有三个额外维度：

```
RN 进程内存 = 原生部分（同上）
            + JS 引擎堆（Hermes/JSC 的 JS 对象）
            + JS Bundle 加载（mmap 或 RAM）
            + Bridge 缓冲（序列化数据暂存）
```

| 优先级 | RN 专属方案 | 原理 | 预期收益 |
|:------:|-----------|------|---------|
| 1 | **Hermes 引擎** | 预编译字节码（.hbc）→ 不需要 JIT → 启动内存更低；支持懒编译 | JS Heap -30~50% vs JSC |
| 2 | **Bundle 拆分 + 懒加载** | 按页面拆 Bundle → 首屏只加载入口 Bundle → 减少初始 JS 堆内存 | 首屏 JS 内存 -40~60% |
| 3 | **减少 Bridge 数据量** | 新架构 JSI 替代 JSON Bridge → 零拷贝 → Bridge 缓冲消失 | Bridge 内存 → 0 |
| 4 | **Image 组件优化** | react-native-fast-image + 内存缓存上限 + 离屏回收 | Java/Native Heap -10~30MB |
| 5 | **FlatList 虚拟化调优** | windowSize / maxToRenderPerBatch / removeClippedSubviews | 列表场景 -20~50MB |
| 6 | **JS 侧内存泄漏排查** | 闭包/订阅/Timer 未清理 → Hermes heap snapshot 分析 | 视场景 |
| 7 | **TurboModule 按需加载** | Native Module 不在启动时全量注册，用到才初始化 | 启动 Native -5~15MB |
| 8 | **原生侧同通用方案** | R8 + DEX Layout + so 精简（同上） | 同上 |

##### 面试表达建议

> "Android 降内存本质就三件事：**减少代码段加载量**（R8 + DEX Layout）、**降低运行时对象存活量**（懒加载 + 图片回收 + 缓存上限）、**拆分进程减少单进程负担**。RN 多了一层 JS 引擎堆，Hermes 字节码预编译 + Bundle 拆包是最高优先级。"

---

## 弹点 4：自动化测试

> Resume 原文：Python + pytest + uiautomator2 驱动设备自动化，覆盖启动/滑动/点击等场景，支持 Android / HarmonyOS / iOS 三端

### Q：自动化测试的整体架构是什么？

**A：** 

```
pytest（用例编排 + 断言框架）
  └── case/
       ├── start_scene/    （启动场景）
       ├── swipe_scene/    （滑动场景）
       ├── click_scene/    （点击场景）
       ├── video_scene/    （视频场景）
       ├── composite_scene/（复合场景）
       └── dynamic_scene/  （动态模型场景）
  └── controllers/
       ├── ui_action_lib/  （UI 操作封装层）
       ├── app_controller/ （应用生命周期管理）
       ├── perfetto/       （性能 trace 采集）
       └── relay/          （辅助设备控制）
  └── utils/
       ├── cmd/            （adb 命令封装）
       ├── logcat_util/    （日志采集分析）
       └── simpleperf_util/（性能分析）
  └── view/
       ├── android/        （Android 端 UI 元素定义）
       ├── harmonyos/      （HarmonyOS 端）
       └── ios/            （iOS 端）
```

核心设计：**Page Object 模式 + 多端适配层**。用例逻辑和 UI 操作分离，通过 view 层适配不同平台的元素定位方式。

### Q：uiautomator2 是什么？和 Appium 什么关系？

**A：** 

- **uiautomator2**：Google 出品的 Android UI 自动化框架，运行在设备端，通过 AccessibilityService 获取 View 树并执行操作（点击/滑动/输入等）
- **python-uiautomator2（u2）**：Python 封装库，通过 adb + HTTP 接口与设备端 uiautomator2 server 通信
- **vs Appium**：Appium 是通用跨端框架（多一层 Server），u2 是 Android 专用、更轻量直接、延迟更低

选 u2 的原因：项目是系统级应用测试，需要直接 adb 控制设备（dumpsys/perfetto/logcat），u2 更贴合这类底层操作场景。

### Q：手机端跑的是什么？怎么安装的？各平台分别是什么？

**A：**

三端使用不同的设备端 agent，但都是**自动安装/推送**的，不需要手动操作：

| 平台 | 设备端 Agent | 安装方式 | 通信协议 |
|------|-------------|---------|---------|
| **Android** | atx-agent + uiautomator2 server（APK） | `u2.connect(serial)` 首次调用时自动通过 adb push 安装到设备 | adb USB/WiFi → HTTP（设备端起 HTTP Server 监听 7912 端口） |
| **HarmonyOS** | 华为 DevEco Testing Kit（hypium） | hdc（鸿蒙版 adb）内置支持，无需额外安装 | hdc USB → uitest 服务 |
| **iOS** | WebDriverAgent（WDA） | 通过 tidevice / Xcode 预装到设备（需开发者证书签名） | USB → usbmuxd → WDA HTTP Server |

#### Android 端详解

```
PC 端                              手机端
┌──────────────┐                  ┌───────────────────────────┐
│ Python 脚本   │                  │  atx-agent（Go 二进制）     │
│  u2.connect() │─── adb USB ───→ │    ↓ 启动                  │
│  d.click(x,y) │─── HTTP :7912 → │  uiautomator2 server.apk  │
│  d.swipe(...) │                  │    ↓ 调用                  │
│               │                  │  AccessibilityService      │
│               │                  │    ↓ 操作                  │
│               │                  │  Android View Tree         │
└──────────────┘                  └───────────────────────────┘
```

- **atx-agent**：一个 Go 编译的二进制，push 到设备 `/data/local/tmp/` 下运行，负责管理生命周期
- **uiautomator2 server**：APK 形式安装到设备，包含两个 APK（`app-uiautomator.apk` + `app-uiautomator-test.apk`）
- **安装时机**：`u2.connect(serial)` 首次调用时自动检测并安装，后续复用
- **不需要 root**：普通 adb 连接即可，但本项目用 `adb root`（系统测试需要 dumpsys 权限）

#### HarmonyOS 端详解

```
PC 端                              手机端
┌──────────────┐                  ┌───────────────────────────┐
│ Python 脚本   │                  │  uitest 服务（系统内置）     │
│  hypium      │─── hdc USB ───→ │    ↓                       │
│  driver.touch│                  │  Accessibility 框架        │
│              │                  │    ↓                       │
│              │                  │  ArkUI View Tree           │
└──────────────┘                  └───────────────────────────┘
```

- **hypium**：华为提供的 Python 自动化库（类似 u2），基于 DevEco Testing Framework
- **hdc**：HarmonyOS 的设备通信工具（鸿蒙版 adb）
- **uitest**：系统内置的 UI 自动化服务，`hdc shell uitest uiInput click x y` 直接可用
- **无需额外安装 APK**：鸿蒙系统原生支持

#### iOS 端详解

```
PC 端                              手机端
┌──────────────┐                  ┌───────────────────────────┐
│ Python 脚本   │                  │  WebDriverAgent.app        │
│  wda_client  │─── USB/usbmuxd → │    ↓ 调用                  │
│  .tap(x,y)   │─── HTTP :8100 ─→ │  XCUITest 框架             │
│              │                  │    ↓ 操作                  │
│              │                  │  UIKit View Tree           │
└──────────────┘                  └───────────────────────────┘
```

- **WebDriverAgent（WDA）**：Facebook 开源的 iOS 自动化 agent，基于 Apple XCUITest 框架
- **安装方式**：需要 Xcode 编译 + 开发者证书签名，通过 `tidevice` 工具部署到设备
- **tidevice**：阿里开源的 iOS 设备通信工具，无需 Mac（可在 Linux 上通过 USB 连接 iOS 设备）
- **TDK（test-develop-kit）**：内部封装库，`IOSDevice` 类统一管理 WDA 生命周期

#### 项目中的统一抽象层

```python
# topo_init() 中根据 DeviceType 选择不同实现
if DeviceType == PhoneDeviceType.android:
    self.phone_device = AndroidUiController(serial, adb)  # 底层: u2.connect()
elif DeviceType == PhoneDeviceType.harmonyos:
    self.phone_device = HarmonyosUiController(serial)      # 底层: hypium + hdc
elif DeviceType == PhoneDeviceType.ios:
    self.phone_device = IOSUiController(ios_device)         # 底层: WDA + tidevice
```

用例层统一调用 `self.phone_device.click(x, y)` / `self.phone_device.swipe(...)` / `self.phone_device.find_app(...)`，不感知底层差异。

### Q：整个测试框架的搭建流程是什么？

**A：**

#### 环境搭建

```bash
# 1. Python 环境（>= 3.11）+ uv 包管理器
# uv 是 Rust 实现的 Python 包管理工具，比 pip 快 10-100 倍
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. 安装框架依赖（项目根目录有 pyproject.toml + uv.lock）
cd memory-test/performance_full_test
uv sync  # 读 pyproject.toml，自动创建 .venv 并安装所有依赖

# 3. 核心依赖栈
#    pytest              — 用例编排 + 发现 + fixtures
#    uiautomator2        — Android 设备 UI 自动化
#    test-develop-kit    — 内部 TDK（设备管理/截图/OCR 基础封装）
#    tdk_locator         — 元素定位器扩展
#    allure-pytest       — 测试报告生成
#    perfetto            — 系统级 trace 采集解析
#    opencv + OCR        — 图像识别辅助定位

# 4. 设备连接
adb devices  # 确认设备在线
# u2 首次使用会自动 push atx-agent 到设备
```

#### 关键配置文件

| 文件 | 作用 |
|------|------|
| `config/run_test_config.yml` | 本地运行入口，指定测试模型（进程老化/动态模型/冷启动等）对应的飞书配置表 |
| `testbeds/testconfig.yml` | 设备拓扑：序列号、制造商、机型代号 |
| `case/conftest.py` | pytest 全局 fixtures（session/class/function 级别的 setup/teardown） |
| `case/pytest.ini` | pytest 标记注册（case_id、case_name、cycle） |

#### 运行方式

```bash
# 本地运行（读 run_test_config.yml 配置）
cd src/performance_full_test
python main.py

# 远程运行（CI/MiATP 平台下发参数）
python main.py '{"jobId": 123, "url": "飞书表格链接", ...}'

# 直接 pytest（调试单个用例）
pytest case/start_scene/wechat/ --arg='{"round":1}' --case_name="微信_首页_启动"
```

#### 框架分层架构

```
main.py（入口）
  → Framework（参数解析 + pytest 动态组装 args）
  → pytest.main(args, plugins=[allure, repeat])

conftest.py（生命周期管理）
  ├── session fixture: Service.before_test_session() — 连设备/推数据/初始化采集
  ├── class fixture: model.before_test_round() — 单轮准备（如启动 perfetto）
  └── function fixture: model.before_test_function() — 单条用例前置

case/（用例层 — 业务逻辑）
  └── TestWechatLaunch
       └── test_start_wechat() — 编排步骤（stop → home → find → launch → trace）

view/（UI 元素层 — Page Object）
  └── android/xiaomi/nezha/wechat.py — 特定机型的元素定位坐标/resourceId

controllers/（能力层）
  ├── ui_action_lib/ — 点击/滑动/长按等原子操作
  ├── app_controller/ — App 生命周期（start/stop/find）
  └── perfetto/ — trace 采集控制

utils/（工具层）
  ├── cmd/adb_util.py — adb 命令封装（shell/pull/push/dumpsys）
  ├── logcat_util/ — logcat 实时抓取 + 过滤
  └── simpleperf_util/ — CPU profiling
```

#### 多端适配机制

```
view/
  ├── android/
  │    ├── base/         — Android 通用元素定义（resourceId 方式）
  │    ├── xiaomi/
  │    │    ├── base/    — 小米通用
  │    │    ├── nezha/   — Xiaomi 17 Ultra 专属（坐标/布局差异）
  │    │    └── erhu/    — Xiaomi 15 专属
  │    ├── samsung/      — 三星设备
  │    └── oppo/         — OPPO 设备
  ├── harmonyos/         — 鸿蒙设备（hdc 命令 + uitest）
  └── ios/               — iOS 设备（XCUITest / tidevice）
```

用例层通过 `PerformanceTopo` 拓扑对象自动路由到对应设备的 view 实现，同一套 `test_start_wechat()` 逻辑跑不同平台。

#### 内存老化测试完整流程

```bash
# 1. 刷机（ROM 包含待测 APK）
fastboot flash system system.img && fastboot reboot

# 2. 环境准备
adb root
adb shell settings put global window_animation_scale 1.0  # 保留动画（真实场景）
# 预置 48 个 App（微信/抖音/微博/淘宝/京东...）+ 登录 + 数据填充

# 3. 确认测试环境
adb shell am force-stop com.miui.hybrid  # 杀目标进程
# 确认桌面无快应用 Widget

# 4. 启动测试（~6 小时）
python main.py
# 框架自动：
#   - 循环执行 220+ 用例（启动/滑动/播放/退出各 App）
#   - 后台每 15s 采集 dumpsys meminfo_all → 存为 meminfo_*.txt
#   - perfetto trace 采集（可选）

# 5. 数据分析
python analyze_pss.py  # 解析 meminfo 文件，输出 PSS Max/P95/Avg/分布
```

#### 关键技术选型理由

| 选型 | 理由 |
|------|------|
| pytest（非 unittest） | fixture 机制灵活、参数化强、插件生态丰富（allure/repeat/rerun） |
| uiautomator2（非 Appium） | 无 Server 开销、延迟低、直接 adb 集成方便采集 meminfo/logcat |
| allure 报告 | 可视化分步骤执行结果，CI 集成友好 |
| perfetto（非 systrace） | 支持长时间采集、SQL 查询 trace 数据、内存/CPU/GPU 全量信息 |
| OpenCV + OCR | 部分场景无 resourceId（如游戏/视频），用图像识别辅助定位 |
| 飞书表格驱动 | 用例配置/执行顺序/cycle 轮次通过在线表格管理，非开发人员也可修改 |

### Q：这套测试解决什么问题？

**A：** 

1. **内存合规验证**：6 小时进程老化测试（1000+ 用例），模拟用户真实使用场景，每 15s 采集 meminfo，验证 PSS Max < 37.3MB
2. **性能回归**：启动耗时、帧率、滑动流畅度等指标自动采集对比
3. **功能兼容**：预装包裁剪模块后，验证剩余功能正常（降级逻辑不 crash）
4. **多端覆盖**：同一套用例逻辑，通过 view 层适配跑在 Android / HarmonyOS / iOS 三端

### Q：进程老化测试模型是什么？

**A：** 模拟用户一天的使用行为——循环打开/关闭各种主流 App（微信/抖音/微博/淘宝等 48 个），制造内存压力，观察目标进程在系统内存回收/重建过程中的 PSS 表现。

测试流程：
1. 预置 48 个 App + 数据填充（模拟真实手机状态）
2. 自动化脚本驱动各 App 执行典型操作（启动/滑动/播放/退出）
3. 后台每 15s 通过 `adb shell dumpsys meminfo_all` 采集所有进程内存
4. 测试结束后分析目标进程的 PSS 时序数据（Max/P95/Avg/超标点）

### Q：面试追问——测试中遇到的坑？

**A：** 

1. **ROM 构建产物未生效**：前两轮测试发现 R8 混淆没带上，设备上 APK 还是 6 个 dex/42MB。原因是 ROM 构建时 manifest 指向了默认未混淆产物。教训：测试前必须验证设备上 APK 的 dex 结构。

2. **桌面 Widget 异常拉起**：调试器安装后自动在桌面创建快应用集合小部件，定时更新时拉起快应用到前台，导致内存飙升到 100MB。非代码问题，但浪费了 2 轮测试。教训：测试环境 checklist 必须包含"桌面无快应用 Widget"。

3. **测试工具包名 bug**：部分用例中 App 包名多了 `app` 后缀（如 `com.tencent.mmapp`），导致 204/220 用例失败。虽然不影响内存采集，但降低了整机压力的真实性。

---

## 速查：关键数据一览

| 指标 | 优化前 | 优化后 | 合规线 |
|------|--------|--------|--------|
| 预装包体积 | 153MB | ~58MB | ≤ 62MB |
| DEX 大小 | 44.4MB（6 个） | 27MB（4 个） | — |
| PSS Max（老化） | 41-55MB | 34-37MB | ≤ 37.3MB |
| PSS Avg | 29-31MB | 22-23MB | — |
| 超标采样点 | 80 个 | 0 | 0 |
