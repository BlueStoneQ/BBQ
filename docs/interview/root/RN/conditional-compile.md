# 条件编译与包体裁剪

> 本质：构建时决定保留/移除代码，运行时压根不存在被裁掉的部分。

---

## 目录

- [一、本质](#一本质)
- [二、Android 中 DEX 裁剪（Java/Kotlin 代码）](#二android-中-dex-裁剪javakotlin-代码)
- [三、APK 其他部分怎么裁剪](#三apk-其他部分怎么裁剪)
- [四、JS Bundle 层裁剪](#四js-bundle-层裁剪)
- [五、全景：APK 各部分裁剪手段](#五全景apk-各部分裁剪手段)

---

## 一、本质

AOT（构建时）根据目标配置，把不需要的代码/资源直接从产物中移除。不是运行时判断"要不要执行"，而是产物里压根没有。

类比 C/C++ 的 `#ifdef` 预处理。

---

## 二、Android 中 DEX 裁剪（Java/Kotlin 代码）

### Gradle 定义变量

```groovy
// android/app/build.gradle
android {
    buildTypes {
        release {
            buildConfigField "boolean", "ENABLE_MAP", "false"
            buildConfigField "boolean", "ENABLE_PAY", "true"
        }
    }
}
```

构建后自动生成 `BuildConfig.java`：
```java
public final class BuildConfig {
    public static final boolean ENABLE_MAP = false;
    public static final boolean ENABLE_PAY = true;
}
```

### 代码中使用

```java
if (BuildConfig.ENABLE_MAP) {
    MapModule.init();  // 这整块在 ENABLE_MAP=false 时会被 R8 删掉
}
```

### R8 怎么删的

R8 编译时：
1. 常量折叠：`BuildConfig.ENABLE_MAP` → `false`
2. 条件简化：`if (false) { ... }` → 死代码
3. 死代码消除：整个 if 块移除
4. Tree Shaking：`MapModule` 类没有任何引用了 → 整个类移除

**结果**：MapModule 相关的所有代码不进入 DEX。

---

## 三、APK 其他部分怎么裁剪

DEX 只是 APK 的一部分。APK 还有 .so、资源、assets 等：

### .so 裁剪（Native 库）

```groovy
android {
    defaultConfig {
        ndk {
            abiFilters 'arm64-v8a'  // 只保留 64 位，去掉 armeabi-v7a/x86
        }
    }
}
```

效果：只打入目标架构的 .so，其他架构的不进入 APK。

还可以：
- 按模块拆分 .so（不需要的模块的 .so 不打入）
- strip 去除调试符号（减小 .so 体积）

### 资源裁剪（图片/布局/字符串）

```groovy
android {
    buildTypes {
        release {
            shrinkResources true  // 移除未引用的资源
            minifyEnabled true    // 配合 R8 使用
        }
    }
}
```

R8 删掉了 MapModule 代码 → MapModule 引用的图片/布局没有引用者了 → `shrinkResources` 把这些资源也删掉。

### assets 裁剪（JS Bundle / 字体 / 配置文件）

assets 不会被自动裁剪（Gradle 不分析 assets 内容）。需要手动控制：
- 分 Bundle：不需要的业务 Bundle 不打入 assets
- 按 flavor 配置不同的 assets 目录
- 构建脚本中按条件 copy

---

## 四、JS Bundle 层裁剪

你的条件编译工具套件做的事：

```javascript
// #ifdef PLATFORM_ANDROID
androidCode();
// #endif

// #ifdef PLATFORM_IOS
iosCode();  // 打 Android 包时这段被 Babel 插件删掉
// #endif
```

Metro 构建时 Babel 插件扫描注释指令 → 按目标平台保留/移除 → 输出的 Bundle 只有目标平台代码。

---

## 五、全景：APK 各部分裁剪手段

| APK 组成 | 裁剪手段 | 谁做的 |
|---------|---------|--------|
| DEX（Java/Kotlin） | BuildConfig 常量 + R8 死代码消除 + Tree Shaking | Gradle + R8 |
| .so（C++ 库） | abiFilters + 按模块拆分 + strip | Gradle NDK 配置 |
| res/（资源） | shrinkResources（移除未引用资源） | Gradle + R8 联动 |
| assets/（Bundle/字体） | 分 Bundle + 按 flavor 配置 + 构建脚本 | 手动/脚本控制 |
| JS Bundle | 条件编译注释指令（Babel 插件） | Metro + Babel |
| CSS | 条件编译注释指令（PostCSS 插件） | 构建工具 |
| XML | 条件编译注释指令（xml-conditional-compile） | 构建工具 |

**一句话**：每种产物有对应的裁剪手段，本质都是"构建时根据条件移除不需要的部分"。

---

## 六、常量折叠

编译器在编译时把常量表达式直接计算出结果，不留到运行时：

```
源码：    if (BuildConfig.ENABLE_MAP)   // ENABLE_MAP = false
折叠后：  if (false)                     // 编译器直接替换成值
再优化：  整个 if 块删掉                  // 死代码消除
```

是 R8 做的一系列优化中的第一步：常量折叠 → 条件简化 → 死代码消除 → Tree Shaking。

---

## 七、各手段优化幅度参考

基准：原始包 ~150MB

| 手段 | 大概砍多少 | 说明 |
|------|-----------|------|
| abiFilters（只保留 arm64） | -30~40% 的 .so | 去掉 32 位架构，.so 通常是包体大头 |
| R8 Tree Shaking + 混淆 | -20~40% 的 DEX | 移除未使用代码 + 类名缩短 |
| shrinkResources | -5~15% 的资源 | 移除未引用图片/布局 |
| 模块级裁剪（条件编译/不打入） | 取决于裁了多少模块 | 整块模块不参与编译，效果最大 |
| strip .so 调试符号 | -10~20% 的 .so | 去掉 debug info |

**实际案例**：
- 总包 153MB → ~60MB（-60%）
- DEX 44.4MB → 27MB（-39%）

单纯 R8 一般只砍 20-40%。砍 60% 说明是"模块级裁剪 + abiFilters + R8"组合拳，大量模块整体不参与编译。
