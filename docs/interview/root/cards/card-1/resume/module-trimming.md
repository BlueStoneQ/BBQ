# 模块裁剪方案（包体 153MB → 60MB）

## 一句话

通过条件编译（Gradle 构建变量），按目标场景裁剪掉不需要的 AAR 依赖 + SO 库 + Java 代码，预装包从 153MB 降到 60MB。裁剪后用反射解耦解决被裁模块的引用编译问题。

---

## 目录

- [问题背景](#问题背景)
- [裁剪策略（核心）](#裁剪策略核心)
  - [三层裁剪总览](#三层裁剪总览)
  - [AAR 依赖裁剪（Gradle 条件依赖）](#gradle-条件依赖)
  - [SO 库裁剪](#so-库裁剪)
  - [Java/资源裁剪（source set + R8 + shrinkResources）](#条件编译排除-source-set)
- [解耦方案（解决引用问题）](#解耦方案解决引用问题)
- [降级兜底](#降级兜底)
- [成果](#成果)

---

## 问题背景

快应用框架预装到 ROM 中，但不同 OEM/场景需要的功能不同：
- 完整版：所有模块（凡泰小程序、地图、支付、推送...）= 153MB
- 预装版：只需要核心运行时 = 目标 < 70MB

**核心矛盾**：模块间有编译依赖，直接去掉 AAR 会编译失败。

---

## 裁剪策略（核心）

### 三层裁剪

```
裁剪层次：
├── AAR 依赖裁剪（Gradle 条件依赖）
│   → 构建时按 buildForRom 变量决定是否引入某些 AAR
│   → 效果最大：一个 AAR 可能带几十 MB
│
├── SO 库裁剪
│   → ABI 过滤（只保留 arm64-v8a）
│   → 移除不需要的 Native 模块对应的 .so
│
└── Java/资源裁剪
    → 条件编译排除整个 source set
    → R8 shrink 移除未引用代码
    → shrinkResources 移除未引用资源
```

### Gradle 条件依赖

> `buildForRom` 变量通过命令行 `-PbuildForRom=true` 传入，在 Gradle 脚本中可用于：
> 1. 条件引入依赖（`if (!buildForRom) { implementation ... }`）
> 2. 通过 BuildConfig 传给 Java/Kotlin 代码（`BuildConfig.BUILD_FOR_ROM`）
> 3. 控制 source set 包含/排除哪些源码

> `buildForRom` 变量来源：构建命令行的 `-P` 参数（`./gradlew -PbuildForRom=true`）。
> Gradle 通过 `project.hasProperty('buildForRom')` 读取。不传则为 false（完整版）。
> 这是 Gradle 的"项目属性"机制——`-P key=value` 注入到 project.properties，脚本里随时能读。
> CI/CD 流水线里配不同构建命令来产出不同变体。

```groovy
// build.gradle 开头
def buildForRom = project.hasProperty('buildForRom')  // ← 从命令行 -P 参数读取

// ① 条件依赖：构建时决定是否引入某些 AAR
dependencies {
  // 核心依赖（始终引入）
  implementation project(':quickapp-core')
  implementation project(':quickapp-bridge')

  // 可选模块（条件引入）
  if (!buildForRom) {
    implementation project(':module-finclip')    // 凡泰小程序引擎（~30MB）
    implementation project(':module-map')        // 地图模块（~15MB）
    implementation project(':module-push')       // 推送模块（~8MB）
    implementation project(':module-payment')    // 支付模块（~5MB）
  }
}

// ② BuildConfig：让 Java/Kotlin 代码也能获取到这个变量
android {
  buildTypes {
    release {
      buildConfigField "boolean", "BUILD_FOR_ROM", "${buildForRom}"
      // Java/Kotlin 中用 BuildConfig.BUILD_FOR_ROM 判断
      // R8 会把 if(false) 的分支直接删掉（dead code elimination），进一步减包
    }
  }
}
```

```bash
# 构建预装版（裁剪后）— buildForRom 来自命令行 -P 参数（Gradle 项目属性机制）
./gradlew assembleRelease -PbuildForRom=true

# 构建完整版（不传参数，默认 false）
./gradlew assembleRelease
```

### SO 库裁剪（ABI Filter）

> 小米设备基本都是 64 位（arm64-v8a），所以预装场景只保留 arm64 即可。

**为什么 SO 会有两套？**

同一份 C/C++ 源码会编译两次——一次编译成 64 位机器码（arm64-v8a），一次编译成 32 位机器码（armeabi-v7a）。两套 SO 功能完全一样，只是 CPU 指令集不同。APK 里的结构：

```
lib/
├── arm64-v8a/          ← 64 位版本（8MB+5MB+... = ~25MB）
│   ├── libhermes.so
│   ├── libreactnative.so
│   └── libfinclip.so
└── armeabi-v7a/        ← 32 位版本，同样的 SO 再来一遍（~25MB）
    ├── libhermes.so
    ├── libreactnative.so
    └── libfinclip.so
```

不裁剪 = 两套都打进去 = SO 体积翻倍。

**ABI Filter 做什么？**

在 `build.gradle` 里配置 `abiFilters`，构建 APK 时 Gradle 只打包指定架构的 SO 目录，另一套直接不打入：

```groovy
android {
  defaultConfig {
    ndk {
      abiFilters "arm64-v8a"  // 只保留 64 位，构建时 armeabi-v7a 目录不打入 APK
    }
  }
}
```

**这不是"输入 CPU 指令集作为构建参数"**——`abiFilters` 是写死在 `build.gradle` 里的配置（或通过 flavor/buildType 区分）。Gradle 打包阶段读这个配置，决定 `lib/` 下保留哪些目录。

**完整逻辑链路**：

```
1. C/C++ 源码通过 NDK 编译 → 产出多架构 SO（arm64 + armv7）
2. AAR 依赖里也自带多架构 SO（三方库预编译好的）
3. Gradle 打包 APK 时：
   - 收集所有 SO（自己编译的 + AAR 里带的）
   - 按 abiFilters 过滤 → 只保留 arm64-v8a 目录
   - armeabi-v7a 目录整个丢弃
4. 最终 APK 里 lib/ 只有一个 arm64-v8a/ 目录

效果：SO 体积减半（~50MB → ~25MB）
代价：32 位设备跑不了（2026 年基本没有了）
```

> 不同 OEM 预装走不同配置——小米全 arm64，某些低端设备可能还需要 armv7。CI 流水线里按目标设备配不同 abiFilters 出不同包。

### 条件编译排除 source set

> Source Set = Gradle Android 项目的源码组织单元。`main` 是默认的（所有构建都包含），还有 `debug`/`release` 等变体。
> `java.exclude` 的意思是：从源码目录中排除匹配的文件，编译时当它们不存在。

```groovy
android {
  sourceSets {
    main {
      if (buildForRom) {
        // 排除不需要的 Java 源码目录
        java.exclude '**/finclip/**'
        java.exclude '**/map/**'
      }
    }
  }
}
```

### R8 + shrinkResources（二次精简）

> 条件编译裁掉了大块模块后，剩余代码里还有未引用的类/方法/资源。R8 + shrinkResources 做二次清理。

```groovy
android {
  buildTypes {
    release {
      minifyEnabled true        // R8：移除未引用代码 + 混淆 + 优化（DEX -20~40%）
      shrinkResources true      // 移除未引用的资源文件（图片/布局等，-10~30%）
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}
```

R8 做三件事：
| 功能 | 效果 |
|------|------|
| Shrinking | 移除未引用的类/方法/字段（DEX -10~30%） |
| Obfuscation | 类名/方法名缩短（`com.myapp.UserManager` → `a.b.c`，DEX -5~10%） |
| Optimization | 方法内联、常量折叠、死代码消除（DEX -5~10%） |

**keep 规则**（`proguard-rules.pro`）：
```
# 反射用到的类不能混淆
-keep class com.myapp.ble.** { *; }

# JNI 调用的方法不能混淆（C++ 通过名字找）
-keepclassmembers class * { native <methods>; }

# TurboModule 类名不能混淆（RN 通过类名注册）
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
```

> keep 越多 → 收益越小。精细化 keep 规则是提升 R8 收益的关键。

---

## 解耦方案（解决引用问题）

### 问题

裁剪掉 `module-finclip` 后，核心代码中 `new FinClipProviderImpl()` 编译失败（类找不到）。

### 方案：反射解耦编译依赖

```java
// 之前（硬依赖，裁剪后编译失败）：
IFinClipProvider provider = new FinClipProviderImpl();

// 之后（反射，编译时不需要该类存在）：
IFinClipProvider provider = null;
try {
  Class<?> clazz = Class.forName("com.quickapp.finclip.FinClipProviderImpl");
  provider = (IFinClipProvider) clazz.newInstance();
} catch (ClassNotFoundException e) {
  // 模块被裁剪了，provider = null，走降级逻辑
}
```

### 本质

- 编译时：不依赖具体实现类（只依赖接口 `IFinClipProvider`）
- 运行时：通过反射尝试加载，找不到就降级
- 接口留在核心模块，实现类在可裁剪模块里

### metadata 入口控制

```xml
<!-- AndroidManifest.xml -->
<meta-data
  android:name="quickapp.module.finclip.enabled"
  android:value="${finclipEnabled}" />
```

```groovy
// build.gradle
manifestPlaceholders = [
  finclipEnabled: buildForRom ? "false" : "true"
]
```

运行时读 metadata 判断模块是否可用，不用反射试错。

---

## 降级兜底

被裁掉的模块如果用户后续需要：

1. **自升级**：核心运行时检测到模块缺失 → 提示用户更新 → 从服务端下载完整版覆盖安装
2. **功能降级**：模块不可用时显示友好提示（"请更新到最新版本使用此功能"）
3. **不 crash**：所有模块入口都有 null check / try-catch 兜底

---

## 成果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 预装包总大小 | 153MB | ~60MB |
| DEX | 44.4MB | 27MB（-39%） |
| SO | ~50MB | ~20MB（ABI 只保留 arm64 + 裁掉不需要的模块 SO） |

> SO 库收益说明：快应用完整版 SO 约 50MB（凡泰引擎 so + 地图 so + 其他），裁掉可选模块的 SO + ABI 只保留 arm64，减约 30MB。一般 RN App 的 SO 占 5-15MB，ABI Split 能减一半。
| 可选模块 | 全部打入 | 按需条件编译 |

**三层配合**：
- Gradle 条件依赖 → AAR 级裁剪（效果最大）
- ABI 过滤 + SO 裁剪 → Native 层瘦身
- R8 + shrinkResources → 剩余代码/资源二次精简
