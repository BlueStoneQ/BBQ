# RN 工程构建（Metro + Hermes）

> 问题：JS/TS 源码怎么变成设备上能跑的东西？

---

## 目录

- [Metro](#metro)
- [.hbc（Hermes Bytecode）](#hbchermes-bytecode)
- [两者关系](#两者关系)
- [多 Bundle 组装成 APK（Android 侧）](#多-bundle-组装成-apkandroid-侧)
- [热更新能力对比](#热更新能力对比)

---

## Metro

**本质**：RN 专用的 JS 打包器。把散落的 JS/TS 模块打成 Bundle 文件 + 提取静态资源。

**产出两样东西**：
1. **Bundle 文件**（.js 或 .hbc）— 所有 JS 代码
2. **assets 目录**（图片/字体）— `require('./icon.png')` 引用的资源被 copy 出来

Bundle 里只有 JS 代码 + 资源 ID 引用，静态文件不在 Bundle 里。

```
npx react-native bundle --platform android \
  --bundle-output dist/index.android.bundle \   ← JS Bundle
  --assets-dest dist/assets/                     ← 静态文件
```

打 APK 时：Bundle → `assets/`，图片 → `res/drawable-xxx/`（按分辨率分目录）。

**为什么不用 Webpack**：Metro 针对 RN 特化——增量构建极快（文件级缓存）、支持平台后缀解析（`.android.ts` / `.ios.ts`）、内置 HMR、输出格式适配 Hermes。

**三阶段**：

```
1. Resolution（解析）：从入口递归解析 import/require，构建依赖图
2. Transformation（转换）：每个文件过 Babel（TS→JS、JSX→JS）
3. Serialization（序列化）：依赖图打成 Bundle 文件
```

类比 Webpack：Resolution = resolve，Transformation = loader，Serialization = output。

**分 Bundle 在哪做**：Serialization 阶段。配置多 entry point → 输出多个 Bundle（Common + Business）。

---

## .hbc（Hermes Bytecode）

**本质**：JS 源码的预编译产物。Hermes 引擎的字节码格式。

**类比**：`.java` → javac → `.class` → JVM 执行。`.js` → hermes compiler → `.hbc` → Hermes 执行。

**为什么要预编译**：

普通引擎运行时：加载源码 → Parse → AST → 编译字节码 → 执行（设备上做，慢）

Hermes 预编译：构建时就编译好 → 运行时直接执行字节码（跳过 Parse/AST/编译，快）

**收益**：启动快 + 内存低（不存 AST 和编译中间产物）

---

## 两者关系

```
Metro 打包                         Hermes 编译
─────────                         ──────────
JS/TS 源码                         Metro 输出的 Bundle.js
    │                                    │
    ▼                                    ▼
[Resolution → Transform → Serialize]  → [hermes compiler] → .hbc
```

- **Debug**：Metro → Bundle.js → Hermes 解释执行（支持 HMR）
- **Release**：Metro → Bundle.js → hermes compiler → .hbc → 打入 APK → 设备直接执行字节码
- **热更新**：服务端编译好 .hbc → 下发到设备 → 替换旧 .hbc → 下次启动生效

**一句话**：Metro 管打包，Hermes 编译器管编译成字节码。两个工具串联。

---

## 多 Bundle 组装成 APK（Android 侧）

### APK 内部结构

```
app.apk
├── classes.dex          ← Java/Kotlin（RN 框架 + TurboModule）
├── lib/arm64-v8a/*.so   ← C++（Hermes 引擎、JSI）
├── assets/
│   ├── common.hbc       ← JS Common Bundle
│   ├── home.hbc         ← JS Business Bundle
│   └── device.hbc       ← JS Business Bundle
├── res/                 ← Android 资源
└── AndroidManifest.xml
```

JS Bundle 对 Android 来说就是 `assets/` 下的静态资源文件。

### 两种组装模式

1. **全部预装**：所有 .hbc 打入 APK assets/。离线可用，但 APK 大。
2. **Common 预装 + Business 动态下发**：APK 只带 common.hbc，业务 Bundle 通过热更新下发到本地存储，按路由动态加载。

### AAR 的角色

AAR 是 Native 层的库，和 JS Bundle 是不同维度：
- JS Bundle（.hbc）→ 业务逻辑 + UI
- AAR → Native 能力（TurboModule 实现）
- 两者通过 TurboModule Spec 契约关联
- 构建时各自独立，Gradle 最终组装进同一个 APK

---

## 多 Bundle 组装成 IPA（iOS 侧）

### IPA 内部结构

```
MyApp.app/（IPA 解压后）
├── MyApp（可执行二进制）       ← Swift/ObjC + RN 框架 + TurboModule
├── Frameworks/
│   ├── hermes.framework       ← Hermes 引擎
│   └── React.framework        ← RN 框架
├── main.jsbundle              ← JS Bundle（或 .hbc，内置在 main bundle）
├── assets/                    ← 图片/字体等静态资源
└── Info.plist                 ← 应用配置
```

### 和 Android 的对比

| | Android（APK） | iOS（IPA） |
|---|---------------|-----------|
| Bundle 存放 | `assets/` 目录 | main bundle（App 包内）或 Documents 目录 |
| Native 代码 | classes.dex + .so | 可执行二进制 + .framework |
| 热更新 Bundle 存放 | 内部存储 `/data/data/包名/` | Documents 或 Library 目录（沙盒内） |
| 构建工具 | Gradle | Xcode (xcodebuild) |
| 构建环境 | Linux/macOS/Windows | 只能 macOS |

### 多 Bundle 在 iOS 的处理

和 Android 思路一样：
- Common Bundle 内置在 App 包内（main bundle）
- Business Bundle 通过热更新下发到 Documents 目录
- 运行时根据路由从对应路径加载

区别：iOS 沙盒机制限制只能访问自己的目录，热更新 Bundle 只能存在 Documents/Library 下。

### DDD + Monorepo 映射

```
monorepo (pnpm workspace)
├── packages/common/       → common.hbc
├── packages/module-home/  → home.hbc
├── packages/module-device/→ device.hbc
├── packages/module-ble/   → BLE TurboModule AAR
└── apps/android/          → Gradle 组装所有 Bundle + AAR → APK
```

每个业务域 = 一个 package = 独立 Bundle + 可能有对应 Native AAR。

---

## 热更新能力对比

| 产物 | 能否热更新 | 原因 |
|------|-----------|------|
| JS Bundle (.hbc) | ✅ 可以 | 只是文件替换，Hermes 下次启动加载新文件即可 |
| .so（C++ 库） | ⚠️ 技术上可以（dlopen 动态加载），但实践中很少做 | 有安全风险，Google Play 政策限制，兼容性问题 |
| AAR → DEX | ❌ 不行（常规方式） | DEX 在安装时被 ART 编译成机器码（AOT），运行时替换 DEX 需要类加载器 hack，Google Play 禁止 |

### 为什么 JS Bundle 天然适合热更新？

- 它只是一个文件（.hbc），不参与 Android 的安装/编译流程
- Hermes 每次启动时从指定路径加载，换个路径指向新文件就行
- 不涉及系统级的类加载、签名验证等机制
- Google Play / App Store 政策允许（JS 层更新不算"代码分发"）

### 为什么 DEX 不能热更新？

- Android 安装 APK 时，ART 会把 DEX 编译成 OAT（机器码）
- 运行时加载的是 OAT，不是 DEX 本身
- 要替换 DEX 需要自定义 ClassLoader（插件化方案），但：
  - Google Play 明确禁止动态代码加载
  - Android 高版本限制越来越严
  - 稳定性风险大

### .so 的情况

- 技术上可以 `dlopen` 动态加载新的 .so
- 但实践中几乎不做：安全风险 + 平台政策 + ABI 兼容性
- 如果需要更新 Native 逻辑，走发版（App Store 更新）

**一句话**：JS Bundle 是"文件级替换"所以能热更新，DEX 是"系统级编译"所以不能随便换。这就是 RN 动态化的根本优势——业务逻辑在 JS 层，天然可热更新。

---

## RN 第三方库安装与 Link 机制

### 一个 RN npm 包的结构

```
react-native-xxx/
├── src/              ← JS 层（API 封装、类型定义）
├── android/          ← Android Native（Java/Kotlin + build.gradle）
├── ios/              ← iOS Native（ObjC/Swift + Podspec）
├── package.json      ← npm 配置 + RN 自动链接配置
└── react-native.config.js ← 告诉 RN CLI 怎么链接
```

三层：JS 接口 + Android 实现 + iOS 实现。纯 JS 库没有 android/ios 目录。

### 安装时发生了什么

| 步骤 | 发生了什么 |
|------|-----------|
| `npm install xxx` | 下载 JS + Native 代码到 node_modules |
| `pod install`（iOS） | 扫描 node_modules，自动链接 iOS Native 代码 |
| `./gradlew build`（Android） | 扫描 node_modules，自动链接 Android Native 代码 |
| 运行时 | JS 通过 TurboModule 调用 Native 代码 |

### Link 的本质

**把 node_modules 里的 Native 代码注册到原生工程的构建系统里。**

旧版（<0.60）手动 `react-native link` 做的事：
- 修改 `settings.gradle`（include 模块）
- 修改 `app/build.gradle`（添加依赖）
- 修改 `MainApplication.java`（注册 Package）

新版（0.60+ Autolinking）：
- 构建时自动扫描 node_modules 里所有带 Native 代码的包
- 读取 package.json / react-native.config.js
- 自动生成链接代码（注册 + 依赖）
- 不需要手动 link

### 所以装 Firebase 只需要

```
npm install @react-native-firebase/crashlytics
→ AAR 依赖在包的 android/build.gradle 里声明，Gradle 自动拉取
→ 手动放 google-services.json（配置文件）
→ JS 侧直接调 API
```

底层 AAR 的事对开发者透明。

### Autolinking 具体机制

不是 Gradle 原生能力，是 **RN CLI 提供的 Gradle 脚本**，在构建时被调用：

```
android/settings.gradle 里：
  apply from: "../node_modules/@react-native-community/cli-platform-android/native_modules.gradle"

这个脚本做的事：
  1. 扫描 node_modules 下所有包的 package.json / react-native.config.js
  2. 找到有 android Native 代码的包
  3. 自动生成 include 和 dependency 配置（相当于自动写 settings.gradle + build.gradle）
  4. 自动生成 PackageList.java（注册所有 Native Module 到 MainApplication）
```

**链路**：
```
Gradle 构建启动 → 执行 native_modules.gradle → 扫描 node_modules → 动态生成配置 → 编译时包含所有 Native 代码
```

**本质**：构建时动态扫描 + 自动注册。和快应用框架的模块自动发现机制思路一样——不手动维护配置，构建时自动收集。
