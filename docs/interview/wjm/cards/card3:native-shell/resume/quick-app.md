# 快应用框架项目经验

```
#### ② 快应用框架（类RN跨端框架 · Android 原生）

系统级快应用运行时，**JS 驱动 Native View 渲染（非 WebView）**，V8 + J2V8 同步 Bridge（类 JSI）。

- 包体优化：预装包 **153MB → ~60MB**，dex **44.4MB → 27MB（-39%）**
- 模块裁剪与降级方案：**反射解耦编译依赖** + metadata 入口控制 + 自升级兜底
- 启动内存优化：DEX 布局优化，热代码前置减少 page fault（PSS MAX **41MB → 35.8MB**）
- 自动化测试：Python + pytest + uiautomator2 驱动设备自动化，覆盖启动/滑动/点击等场景，支持 Android / iOS 三端
```

# 相关文档

| 主题 | 文档 |
|------|------|
| 包体优化（模块裁剪 153MB→60MB） | [module-trimming.md](../../../../root/cards/card-1/resume/module-trimming.md) |
| PSS 内存优化（DEX 布局 41MB→35.8MB） | [pss-dex-optimization.md](../../../../root/cards/card-1/resume/pss-dex-optimization.md) |
| Android 优化全景 | [android-note/08-optimization](../../../../root/android-note/08-optimization/README.md) |
| 快应用框架整体 | [quickapp-framework](../../../../../resume/explain/3.1-xm/quickapp-framework/README.md) |

# QA
## 1. APK 组成与优化

**APK 目录结构**：
```
app.apk
├── classes.dex          ← Java/Kotlin 字节码（可能多个 dex）
├── lib/
│   ├── arm64-v8a/       ← SO 库（C++/NDK 编译产物）
│   └── armeabi-v7a/
├── res/                 ← 编译后的资源（layout/drawable/...）
├── assets/              ← 原始资源（JS Bundle/字体/离线包）
├── resources.arsc       ← 资源索引表
├── AndroidManifest.xml  ← 清单
└── META-INF/            ← 签名信息
```

**优化总览（按收益排序）**：

| # | 部分 | 占比 | 优化手段 | 典型收益 |
|---|------|------|---------|---------|
| 1 | **SO 库** | 30-50% | ABI 过滤（只保留 arm64-v8a）+ 裁掉不需要的模块 SO | -50%+ |
| 2 | **DEX** | 20-30% | R8 混淆/裁剪 + 模块条件编译移除 | -30~40% |
| 3 | **assets** | 10-30% | JS Bundle 分包按需下载 + 压缩 | 视业务 |
| 4 | **res** | 10-15% | shrinkResources（删除未引用资源）+ resConfigs（只保留指定语言） | -10~20% |
| 5 | **resources.arsc** | 2-5% | 混淆资源名（AndResGuard） | -2~5% |

1. SO 库一般我们怎么优化? resume中怎么优化的? 收益呢


# 注释
## 1. res VS assets

| | `res/` | `assets/` |
|--|--------|-----------|
| 编译处理 | 被 AAPT 编译，生成 R.id 索引 | 原样打包，不编译 |
| 访问方式 | `R.drawable.xxx` / `getResources()` | `AssetManager.open("path")` 按路径读 |
| 图片 | ✅ 放这里（有密度适配） | 也可以放，但没有自动适配 |
| 典型内容 | 布局 XML、图片、字符串、动画 | JS Bundle、字体、离线包、配置 JSON |
| 本质 | Android 资源系统管理的结构化资源 | 开发者自己管理的原始文件目录 |

- 简单说：res = Android 系统管的（有 R.id 索引），assets = 你自己管的原始文件（按路径读取）。

- 图片一般放 res/drawable（系统自动适配不同屏幕密度）。assets 里也能放图片，但得自己处理适配。

## 2. R8

**本质**：Android 构建工具链中的代码优化器。输入 = 所有 .class 字节码，输出 = 优化后的 .dex。是 ProGuard 的替代品（Google 自研，和 D8 合并为一步）。

**主要处理对象**：DEX（Java/Kotlin 编译产物）

| 能力 | 做了什么 | 效果 |
|------|---------|------|
| **Tree Shaking** | 移除未使用的类/方法/字段 | 减小 DEX 体积 |
| **混淆** | 类名/方法名缩短（`com.example.DeviceModule` → `a.b.c`） | 减小字符串体积 + 增加逆向难度 |
| **优化** | 内联短方法、删除死代码、合并相同逻辑 | 减小 + 提升运行速度 |
| **脱糖** | 把 Java 8+ 语法（lambda/stream）转为低版本兼容字节码 | 兼容旧设备 |

**开启方式**（一行配置）：
```groovy
// build.gradle
android {
    buildTypes {
        release {
            minifyEnabled true  // 开启 R8
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

R8 没有"档位"概念。它的行为完全由 `proguard-rules.pro` 文件中的 keep 规则控制——你 keep 什么，它就不动什么，其余全部裁剪+混淆。

Google 提供两个默认配置文件（选一个作为基础）：

| 文件 | 区别 |
|------|------|
| `proguard-android.txt` | 保守（不做代码优化，只混淆+裁剪） |
| `proguard-android-optimize.txt` | 激进（额外做方法内联、分支消除等优化） |

实际控制"混淆程度"的是你自己写的 keep 规则：
```
-keep class com.example.bridge.** { *; }   # 这个包不动（Bridge 需要反射访问）
-keep class * extends android.app.Activity  # 所有 Activity 不混淆（Manifest 引用）
# 其余全部裁剪 + 混淆
```

**不是选择级别，而是选择"哪些不能动"**。没有 keep 的代码 = 最大程度裁剪混淆。

- R8 的裁剪（Tree Shaking）

R8 从入口点（Activity/Application/Manifest 声明的组件）出发，沿调用链标记所有可达的类/方法/字段，**不可达的直接从 DEX 中删除**。

= 编译器级别的死代码消除。你依赖了一个 100 个类的库但只调了 2 个方法 → R8 把其余 98 个类从 DEX 里删掉。

---

## Q: 快应用项目中 R8 带来多大收益？怎么启用？

**收益**：DEX 44.4MB → 27MB（**-39%，减 17MB**）。

原因：框架依赖了大量第三方库（凡泰/百度/地图等），每个库只用了部分功能，R8 Tree Shaking 把未调用的类全删了。普通 App 通常只减 10-20%，这个项目减 39% 是因为可裁死代码特别多。

**启用**（一行）：

```groovy
// build.gradle
android {
    buildTypes {
        release {
            minifyEnabled true  // ← 这一行启用 R8
            shrinkResources true  // 顺带启用资源裁剪
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

> AGP 3.4+ 默认用 R8 替代 ProGuard，`minifyEnabled true` 就够了。
>
> 两个 proguardFiles 来源：
> - `proguard-android-optimize.txt` → Android SDK 自带默认规则（SDK 目录里，不用你写）
> - `proguard-rules.pro` → 项目根目录下你自己写的 keep 规则（AS 创建项目时自动生成空文件）

`proguard-rules.pro` 最小例子（位于 `app/proguard-rules.pro`）：

```
# Bridge 类不能混淆（JS 通过字符串名调用）
-keep class com.example.bridge.** { *; }

# 反射用到的类不能删
-keep class com.example.model.** { *; }

# 第三方 SDK 要求的（SDK 文档会给）
-keep class com.thirdparty.sdk.** { *; }
```

> 本质就是一个文本文件：告诉 R8"这些别动，其余随便裁随便混淆"。
