# 01. 依赖管理

> 依赖形式、集成方式、版本管理、冲突解决。

## 目录

- [一、依赖形式](#一依赖形式)
- [二、依赖声明与集成](#二依赖声明与集成)
- [三、依赖传递与冲突](#三依赖传递与冲突)
- [四、版本管理策略](#四版本管理策略)
- [五、快应用框架的依赖实践](#五快应用框架的依赖实践)

---

## 一、依赖形式

| 形式 | 说明 | 类比前端 |
|------|------|---------|
| **远程 AAR** | Maven 仓库托管的 Android 库（含代码+资源+so） | npm 包 |
| **远程 JAR** | Maven 仓库托管的纯 Java 库 | 纯 JS 的 npm 包 |
| **本地 AAR** | 放在 libs/ 目录的 .aar 文件 | 本地 tgz 包 |
| **本地 JAR** | 放在 libs/ 目录的 .jar 文件 | 本地 JS 文件 |
| **Module 依赖** | 同项目内的子模块 | monorepo workspace 包 |
| **so 库** | C/C++ 编译的动态链接库 | Node.js native addon |

---

## 二、依赖声明与集成

### Gradle 依赖声明

```groovy
dependencies {
    // 远程依赖（从 Maven 仓库下载）
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    
    // 本地 AAR
    implementation files('libs/some-library.aar')
    
    // Module 依赖（同项目子模块）
    implementation project(':module-core')
    
    // 只在测试时用
    testImplementation 'junit:junit:4.13.2'
    
    // 只在编译时用，不打进 APK（注解处理器）
    compileOnly 'com.google.auto.service:auto-service-annotations:1.0'
    annotationProcessor 'com.google.auto.service:auto-service:1.0'
}
```

### 依赖配置类型

| 配置 | 说明 | 是否打进 APK | 是否传递给依赖者 |
|------|------|-------------|---------------|
| `implementation` | 标准依赖 | ✅ | ❌（不传递） |
| `api` | 传递依赖 | ✅ | ✅（传递给依赖本模块的模块） |
| `compileOnly` | 只编译时可见 | ❌ | ❌ |
| `runtimeOnly` | 只运行时可见 | ✅ | ❌ |
| `testImplementation` | 只测试时 | ❌ | ❌ |

### implementation vs api

```
module-a 依赖 okhttp（implementation）
module-b 依赖 module-a
  → module-b 看不到 okhttp（编译时报错）
  → 好处：module-a 换掉 okhttp 不影响 module-b

module-a 依赖 okhttp（api）
module-b 依赖 module-a
  → module-b 能直接用 okhttp
  → 坏处：module-a 换掉 okhttp，module-b 也要改
```

类比前端：`implementation` 类似 npm 的 dependencies（不会被 hoist 到使用者），`api` 类似 peerDependencies（使用者也能直接用）。

---

## 三、依赖传递与冲突

### 传递依赖

```
你的 App 依赖 library-A
library-A 依赖 okhttp:4.10.0
  → 你的 App 自动获得 okhttp:4.10.0（传递依赖）

你的 App 也直接依赖 okhttp:4.12.0
  → 冲突：4.10.0 vs 4.12.0
  → Gradle 默认选最高版本：4.12.0
```

### 冲突解决策略

| 策略 | 做法 |
|------|------|
| 默认（最高版本） | Gradle 自动选最高版本 |
| 强制指定 | `force = true` 或 `strictly` |
| 排除传递 | `exclude group: 'com.example', module: 'conflict-lib'` |
| BOM（版本清单） | 统一管理一组库的版本（如 Firebase BOM） |

```groovy
// 排除传递依赖
implementation('com.example:library-a:1.0') {
    exclude group: 'com.squareup.okhttp3', module: 'okhttp'
}

// 强制版本
configurations.all {
    resolutionStrategy {
        force 'com.squareup.okhttp3:okhttp:4.12.0'
    }
}
```

### 查看依赖树

```bash
./gradlew :app:dependencies --configuration releaseRuntimeClasspath
```

类比前端的 `npm ls` 或 `pnpm why`。

---

## 四、版本管理策略

### 统一版本管理（Version Catalog）

Gradle 7.0+ 推荐用 `libs.versions.toml`：

```toml
# gradle/libs.versions.toml
[versions]
okhttp = "4.12.0"
kotlin = "1.9.22"

[libraries]
okhttp = { module = "com.squareup.okhttp3:okhttp", version.ref = "okhttp" }

[plugins]
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
```

```groovy
// build.gradle 里引用
dependencies {
    implementation libs.okhttp
}
```

类比前端：类似 monorepo 里的 `pnpm-workspace.yaml` + `catalog:` 统一版本。

---

## 五、快应用框架的依赖实践

### 多模块依赖结构

```
quickapp-framework/
├── app/                    ← 主模块（assembleRelease 入口）
│   └── build.gradle        implementation project(':core')
│                           implementation project(':bridge')
│                           implementation project(':features:camera')
├── core/                   ← 核心模块（V8 引擎、Bridge 基础）
├── bridge/                 ← Bridge 层
├── features/               ← Feature 模块（可插拔）
│   ├── camera/
│   ├── network/
│   └── storage/
├── third-party/            ← 第三方模块（凡泰/百度）
│   ├── finclip/
│   └── baidu/
└── settings.gradle         ← 声明所有模块
```

### buildForRom 的依赖裁剪

```groovy
// app/build.gradle
if (!buildForRom) {
    implementation project(':third-party:finclip')
    implementation project(':third-party:baidu')
}
```

buildForRom=true 时，finclip 和 baidu 模块不参与编译 → 不打进 APK → 包体减小。

### consumerProguardFiles 的依赖传递

```
third-party:finclip 的 build.gradle:
  consumerProguardFiles 'proguard-rules.pro'
    → 这个 proguard 规则会传递给 app 模块
    → 如果规则太宽泛 → 阻止 R8 裁剪
```

这就是你排查的那个问题的依赖传递机制。
