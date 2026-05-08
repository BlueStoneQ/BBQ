# Android note

> 第一性原理：理解本质，用前端概念类比迁移。
> 骨架 → 支干 → 血肉。核心优先。

## 目录

- [零、本质：Android 和前端的根本区别](#零本质android-和前端的根本区别)
- [一、APK = 你的 dist 产物](#一apk--你的-dist-产物)
- [二、Gradle = Webpack + npm scripts](#二gradle--webpack--npm-scripts)
- [三、Android 线程模型 vs JS 单线程](#三android-线程模型-vs-js-单线程)
- [四、NDK / JNI = Node.js Native Addon](#四ndk--jni--nodejs-native-addon)
- [五、V8 / J2V8 = 在 Android 里跑 JS](#五v8--j2v8--在-android-里跑-js)
- [六、R8 = Tree Shaking + Terser + 混淆](#六r8--tree-shaking--terser--混淆)
- [七、AAR = npm 包](#七aar--npm-包)
- [八、签名 = HTTPS 证书](#八签名--https-证书)
- [九、从源码到用户手里的全流程](#九从源码到用户手里的全流程)
- [十、插件化 = 微前端](#十插件化--微前端)

---

## 零、本质：Android 和前端的根本区别

前端跑在浏览器沙箱里，Android 跑在操作系统上。这一个区别决定了所有差异：

| | 前端 | Android |
|---|---|---|
| 运行环境 | 浏览器（V8/SpiderMonkey） | Android Runtime（ART/Dalvik） |
| 语言 | JavaScript/TypeScript | Java/Kotlin（编译成字节码） |
| 产物 | JS bundle（文本） | APK/AAB（二进制包） |
| 安装 | 不需要，URL 即访问 | 需要安装到设备 |
| 更新 | 刷新即更新 | 需要重新安装或热更新 |
| 权限 | 沙箱，能力有限 | 可以访问硬件（相机/GPS/传感器） |
| 分发 | CDN | 应用商店 / ROM 预装 |

**一句话**：前端是"即用即走"，Android 是"安装常驻"。这决定了 Android 需要关心包体大小、签名安全、版本管理、进程生命周期这些前端不太关心的事。

---

## 一、APK = 你的 dist 产物

APK（Android Package）就是 Android 的"打包产物"，类比前端的 `dist/` 目录。

```
前端 dist/                          Android APK（解压后）
├── index.html                      ├── AndroidManifest.xml  ← 入口配置（类似 index.html）
├── main.js                         ├── classes.dex          ← 代码（类似 main.js）
├── vendor.js                       ├── classes2.dex         ← 代码分包（类似 vendor.js）
├── style.css                       ├── res/                 ← 资源（类似 assets/）
├── assets/                         ├── assets/              ← 原始资源
└── favicon.ico                     ├── lib/                 ← so 库（类似 node_modules 里的 native addon）
                                    └── META-INF/            ← 签名信息
```

### DEX 是什么

DEX = Dalvik Executable。Java/Kotlin 源码编译后的字节码格式，Android 虚拟机（ART）能直接执行。

```
Java 源码 → javac → .class 文件 → D8/R8 → .dex 文件
```

类比：TypeScript → tsc → JavaScript → Webpack → bundle.js

**为什么有多个 dex**：单个 dex 有 65536 个方法数限制（类似 JS 的文件大小限制），超了就分包（multidex），类似前端的 code splitting。

### APK 各部分占比（你的快应用框架为例）

| 部分 | 大小 | 类比 | 优化手段 |
|------|------|------|---------|
| dex | 44MB → 27MB | JS bundle | R8 裁剪/混淆 |
| res | ~30MB | 图片/CSS | shrinkResources、WebP |
| lib (so) | ~50MB | native addon | 只保留目标 ABI |
| assets | ~20MB | 静态资源 | 按需加载 |

---

## 二、Gradle = Webpack + npm scripts

Gradle 是 Android 的构建系统，但它比 Webpack 管的事更多：

| 前端 | Android (Gradle) | 说明 |
|------|-----------------|------|
| package.json | build.gradle | 项目配置 |
| npm install | gradle sync | 下载依赖 |
| webpack.config.js | build.gradle | 构建配置 |
| npm run build | ./gradlew assembleRelease | 构建命令 |
| node_modules/ | ~/.gradle/caches/ | 依赖缓存 |
| npm publish | maven publish | 发布包 |
| devDependencies | testImplementation | 测试依赖 |
| dependencies | implementation | 生产依赖 |

### Gradle 核心概念

```groovy
// build.gradle（类比 webpack.config.js + package.json 合体）

plugins {
    id 'com.android.application'  // 这是一个 App（不是库）
}

android {
    compileSdk 34                  // 编译用的 SDK 版本
    defaultConfig {
        minSdk 21                  // 最低支持 Android 5.0
        targetSdk 34               // 目标版本
        versionCode 1              // 内部版本号（整数，每次发布+1）
        versionName "1.0.0"        // 用户看到的版本号
    }
    buildTypes {
        release {
            minifyEnabled true     // 开启 R8（类似 production 模式开启 terser）
            shrinkResources true   // 删除未使用资源
        }
        debug {
            minifyEnabled false    // debug 不混淆（类似 development 模式）
        }
    }
}

dependencies {
    implementation 'com.example:library:1.0.0'  // 类似 npm install xxx
    implementation project(':module-a')          // 类似 workspace 引用本地包
}
```

### Module = Monorepo 里的 Package

```
前端 monorepo                       Android 多 module 项目
├── packages/                       ├── app/              ← 主应用（入口）
│   ├── core/                       ├── module-core/      ← 核心库
│   ├── ui/                         ├── module-ui/        ← UI 组件库
│   └── utils/                      └── module-utils/     ← 工具库
└── package.json                    └── settings.gradle   ← 声明有哪些 module
```

### buildType 和 productFlavor

```
buildType = 环境（development / production）
productFlavor = 变体（比如免费版 / 付费版，或者 ROM 预装版 / 商店版）

你的 buildForRom 就是一个 flavor：
  buildForRom=true  → 预装版（砍掉凡泰/百度）
  buildForRom=false → 完整版（商店发布）
```

---

## 三、Android 线程模型 vs JS 单线程

| | 前端 | Android |
|---|---|---|
| 主线程 | JS 主线程（UI 渲染 + 逻辑） | UI Thread（只能在这里更新 View） |
| 异步 | Event Loop + Promise + Web Worker | Thread + Handler + Coroutine |
| 规则 | 不要阻塞主线程（长任务用 Worker） | 不要在主线程做耗时操作（ANR 5秒） |

### Android 的 Handler/Looper 机制（类比 Event Loop）

```
前端 Event Loop:
  Call Stack → 执行完 → 从 Task Queue 取下一个 → 执行

Android Looper:
  UI Thread 有一个 Looper（死循环）→ 从 MessageQueue 取 Message → 执行
  其他线程通过 Handler 往 MessageQueue 里发 Message
```

本质一样：都是"消息队列 + 循环取消息执行"。区别是 Android 可以有多个线程各自跑 Looper，前端只有一个主线程 Event Loop。

### 快应用框架的三线程就是这样分的

- JS Thread：跑 V8，执行 JS 逻辑（类比前端主线程）
- IO Thread Pool：异步任务（类比 Web Worker）
- UI Thread：更新 Android View（前端没有对应物，因为浏览器帮你管了）

---

## 四、NDK / JNI = Node.js Native Addon

| 前端 | Android |
|------|---------|
| Node.js N-API | JNI (Java Native Interface) |
| C++ addon (.node) | C++ 编译成 .so 库 |
| node-gyp / cmake-js | NDK + CMakeLists.txt |
| require('addon') | System.loadLibrary("native-lib") |

### 为什么需要 NDK/JNI

和前端一样的原因：某些事 Java 做不了或做不好（性能敏感、调用 C 库、复用已有 C/C++ 代码）。

你的快应用框架里：V8 引擎是 C++ 写的，要在 Java 的 Android 环境里跑 V8，就需要 JNI 做桥接。

```
Java 代码 ←→ JNI 桥 ←→ C++ 代码（V8 引擎）
```

类比你在性能分析平台里做的：
```
Node.js ←→ N-API 桥 ←→ C++ 代码（libsimpleperf_report.so）
```

完全一样的模式，只是语言从 JS/Node 换成了 Java/Android。

---

## 五、V8 / J2V8 = 在 Android 里跑 JS

### 为什么 Android 里要跑 JS

快应用框架的业务逻辑用 JS 写（开发者友好），但 UI 渲染用 Android 原生 View（性能好）。所以需要在 Android 里嵌入一个 JS 引擎来执行业务代码。

### J2V8 是什么

J2V8 = Java 绑定的 V8 引擎。让你在 Java 代码里创建 V8 实例、执行 JS、注册 Java 方法给 JS 调用。

```java
// 创建 V8 运行时
V8 runtime = V8.createV8Runtime();

// 执行 JS
runtime.executeScript("var x = 1 + 2;");

// 注册 Java 方法给 JS 调用（同步 Bridge）
runtime.registerJavaMethod((receiver, args) -> {
    return "hello from Java";
}, "nativeMethod");

// JS 里可以直接调用
// var result = nativeMethod(); // "hello from Java"
```

### 同步 Bridge vs 异步 Bridge

| | 同步 Bridge（J2V8/JSI） | 异步 Bridge（旧版 RN） |
|---|---|---|
| 调用方式 | JS 直接调用 Java 方法，同线程同步返回 | JS 发消息到队列，Java 线程取出执行，回调返回 |
| 延迟 | 微秒级 | 毫秒级（跨线程 + 序列化） |
| 数据传递 | 直接传引用 | JSON 序列化/反序列化 |
| 类比 | 函数调用 | postMessage |

快应用框架选同步 Bridge（J2V8），和 RN 新架构的 JSI 是同一个思路——消除跨线程通信开销。

---

## 六、R8 = Tree Shaking + Terser + 混淆

| 前端 | Android (R8) |
|------|-------------|
| Tree Shaking（删除未使用代码） | Shrinking（删除未使用的类/方法） |
| Terser（压缩变量名） | Obfuscation（混淆类名/方法名） |
| Dead Code Elimination | Optimization（内联/简化） |
| webpack.config.js 配置 | proguard-rules.pro 配置 |
| sideEffects: false | -keep 规则（告诉 R8 哪些不能删） |

### keep 规则 = sideEffects

前端的 `sideEffects: false` 告诉 Webpack "这个包没有副作用，可以 tree shake"。

Android 的 `-keep` 规则反过来：告诉 R8 "这个类有副作用（被反射调用/被序列化），不能删"。

```
# proguard-rules.pro
-keep class com.example.MyClass { *; }  # 保留这个类的所有成员
-keep class * implements Serializable   # 保留所有可序列化的类
```

### consumerProguardFiles = 依赖包自带的 sideEffects 声明

库模块可以通过 `consumerProguardFiles` 把自己的 keep 规则传递给 app。如果库的规则太宽泛（`-keep class * { *; }`），等于告诉 R8 "什么都不能删"，tree shaking 就废了。

这就是你排查的那个问题的本质。

---

## 七、AAR = npm 包

| 前端 | Android |
|------|---------|
| npm 包（.tgz） | AAR（.aar） |
| package.json | pom.xml / build.gradle |
| npm registry | Maven 仓库（Maven Central / 公司私有仓库） |
| npm install | implementation 'group:artifact:version' |
| node_modules/ | ~/.gradle/caches/ |

### AAR vs JAR

| | JAR | AAR |
|---|---|---|
| 包含 | 只有 .class 文件（纯代码） | .class + 资源 + AndroidManifest + so 库 |
| 类比 | 纯 JS 的 npm 包 | 带 CSS/图片/native addon 的 npm 包 |
| 用途 | 纯 Java 库 | Android 库（有 UI/资源/原生代码） |

---

## 八、签名 = HTTPS 证书

Android 签名的本质和 HTTPS 证书一样：**证明"这个 APK 确实是我发布的，没被篡改"**。

| 前端 | Android |
|------|---------|
| HTTPS 证书（证明网站身份） | APK 签名（证明 App 身份） |
| Let's Encrypt / CA 颁发 | 自己生成 keystore（自签名） |
| 浏览器验证证书 | 系统验证签名 |
| 证书过期要续 | keystore 丢了 App 就没法更新了 |

```
签名流程：
源码 → 编译 → 未签名 APK → 用 keystore 签名 → 签名后 APK → 可安装
```

**为什么 ROM 预装不需要商店签名**：预装是直接写入系统分区的，用的是系统签名（platform key），不走商店验证。

---

## 九、从源码到用户手里的全流程

### 商店发布流程（类比前端部署到 CDN）

```
前端：
  源码 → npm install → webpack build → dist/ → 上传 CDN → 用户访问 URL

Android（商店）：
  源码 → gradle sync → assembleRelease → APK/AAB → 签名 → 上传商店 → 审核 → 用户下载安装

Android（ROM 预装，你做的）：
  源码 → gradle sync → assembleRelease → APK → 系统签名 → 集成到 ROM 镜像 → 刷机到设备
```

### ROM 预装 vs 商店发布的区别

| | 商店发布 | ROM 预装 |
|---|---|---|
| 签名 | 开发者自己的 keystore | 系统 platform key |
| 分发 | 用户主动下载 | 出厂自带 |
| 更新 | 商店推送 | OTA 系统更新 / 自升级 |
| 包体要求 | 相对宽松 | 极严格（影响 ROM 大小） |
| 卸载 | 用户可卸载 | 不可卸载（系统应用） |

---

## 十、插件化 = 微前端

| 前端微前端 | Android 插件化 |
|-----------|--------------|
| 主应用加载子应用 | 宿主 App 加载插件 APK |
| iframe / Web Components / Module Federation | Hook ClassLoader / 反射 / 代理 |
| 子应用独立部署 | 插件独立下载安装 |
| 路由分发 | Activity 代理 |
| 沙箱隔离 | 进程隔离 |

### 为什么 Android 插件化比微前端难 100 倍

前端微前端有浏览器支持（iframe 天然隔离），Android 插件化要和系统对抗：
- 系统不允许加载未安装的 APK 里的 Activity
- 需要 Hook 系统 API（ClassLoader、Instrumentation）
- 每个 Android 版本系统内部实现不同，Hook 可能失效
- Google 在逐步封堵这些 Hook 点

**这就是你在快应用框架里选"条件编译"而不是"插件化"的原因**——系统预装应用不应该和系统对抗。

---

## 总结：概念映射速查表

| 前端概念 | Android 对应 | 说明 |
|---------|-------------|------|
| dist/ | APK | 打包产物 |
| bundle.js | classes.dex | 代码产物 |
| Webpack | Gradle | 构建系统 |
| package.json | build.gradle | 项目配置 |
| npm install | gradle sync | 依赖安装 |
| npm 包 | AAR/JAR | 依赖包 |
| node_modules | ~/.gradle/caches | 依赖缓存 |
| Tree Shaking | R8 Shrinking | 删除未使用代码 |
| Terser | R8 Obfuscation | 压缩/混淆 |
| sideEffects | -keep 规则 | 标记不能删的 |
| Code Splitting | MultiDex | 代码分包 |
| Web Worker | Thread / Coroutine | 异步执行 |
| Event Loop | Looper + MessageQueue | 消息循环 |
| N-API (C++ addon) | JNI (C++ so) | 原生代码桥接 |
| CDN 部署 | 商店发布 | 分发方式 |
| 热更新（HMR） | 热修复（Tinker/Sophix） | 不重装更新 |
| 微前端 | 插件化 | 动态加载子模块 |
| HTTPS 证书 | APK 签名 | 身份验证 |
| monorepo | 多 module 项目 | 多包管理 |
| npm scripts | Gradle Task | 构建脚本 |
| .env | buildType + flavor | 环境/变体配置 |
