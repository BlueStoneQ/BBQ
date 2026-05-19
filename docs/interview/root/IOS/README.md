# iOS 侧核心概念（大前端视角）

> 不是 iOS 开发者手册，是"大前端架构师需要知道的 iOS 核心概念"。
> 目标：能和 iOS 同学对话、能设计跨端方案、能理解 iOS 侧的约束。

---

## 目录

- [一、iOS vs Android vs 前端：核心概念对照](#一ios-vs-android-vs-前端核心概念对照)
- [二、iOS 项目结构本质](#二ios-项目结构本质)
- [三、RN 在 iOS 侧怎么跑](#三rn-在-ios-侧怎么跑)
- [四、多 Bundle 在 iOS 侧的处理](#四多-bundle-在-ios-侧的处理)
- [五、iOS 特有的约束](#五ios-特有的约束)

---

## 一、iOS vs Android vs 前端：核心概念对照

| 概念 | 前端（Web） | Android | iOS |
|------|-----------|---------|-----|
| 入口 | index.html / main.js | MainActivity + Application | AppDelegate + SceneDelegate |
| UI 基本单元 | DOM Element | View (android.view.View) | UIView |
| 页面 | Route / Page | Activity / Fragment | UIViewController |
| 布局 | CSS Flexbox/Grid | XML Layout / ConstraintLayout | Auto Layout / SwiftUI |
| 包管理 | npm / pnpm | Gradle (Maven) | CocoaPods / SPM (Swift Package Manager) |
| 构建产物 | Bundle.js | APK / AAB | IPA |
| 构建工具 | Webpack / Vite / Metro | Gradle | Xcode (xcodebuild) |
| 语言 | JS/TS | Java / Kotlin | Swift / Objective-C |
| 线程模型 | 单线程 + Web Worker | 主线程 + 子线程 | 主线程(Main) + GCD 队列 |
| 存储 | localStorage / IndexedDB | SharedPreferences / SQLite | UserDefaults / Core Data |
| 网络 | fetch / Axios | OkHttp / Retrofit | URLSession / Alamofire |
| 推送 | — | FCM | APNs (Apple Push Notification) |
| 发布 | CDN 部署 | Google Play / 国内市场 | App Store（审核严格） |
| 热更新 | 天然支持 | JS Bundle 可以 / DEX 不行 | JS Bundle 可以 / 原生代码不行 |

---

## 二、iOS 项目结构本质

```
MyApp.xcodeproj（或 .xcworkspace）
├── MyApp/
│   ├── AppDelegate.swift      ← 应用入口（生命周期管理）
│   ├── SceneDelegate.swift    ← 场景管理（iOS 13+）
│   ├── Info.plist             ← 应用配置（类似 AndroidManifest）
│   ├── Assets.xcassets        ← 图片/图标资源
│   └── ViewController.swift   ← 页面
├── Podfile                    ← CocoaPods 依赖（类似 build.gradle）
└── Pods/                      ← 第三方库（类似 node_modules）
```

**和 Android 的对应关系**：

| Android | iOS | 作用 |
|---------|-----|------|
| AndroidManifest.xml | Info.plist | 应用配置/权限声明 |
| build.gradle | Podfile + .xcodeproj 配置 | 依赖管理/构建配置 |
| MainActivity | AppDelegate | 应用入口 |
| Activity/Fragment | UIViewController | 页面 |
| View | UIView | UI 基本单元 |
| Gradle | xcodebuild | 构建系统 |
| AAR | Framework / XCFramework | 库的打包格式 |

---

## 三、RN 在 iOS 侧怎么跑

**本质和 Android 一样**：Native 壳 + RN 作为渲染引擎嵌入。

```
iOS 壳工程
├── AppDelegate 初始化 RCTBridge（RN 运行时）
├── 创建 RCTRootView（RN 渲染的容器 View）
├── 指定加载哪个 Bundle（从 assets 或本地路径）
└── RCTRootView 嵌入到 UIViewController 中显示
```

**关键 API**（iOS 侧）：

| API | 作用 | 对应 Android |
|-----|------|-------------|
| `RCTBridge` | RN 运行时实例（加载 Bundle + 管理模块） | `ReactInstanceManager` |
| `RCTRootView` | RN 渲染的容器 View | `ReactRootView` |
| `RCTBundleURLProvider` | 指定 Bundle 加载路径 | `setBundleAssetName` |

---

## 四、多 Bundle 在 iOS 侧的处理

### 和 Android 的区别

| 维度 | Android | iOS |
|------|---------|-----|
| Bundle 存放位置 | assets/ 目录 或 本地存储 | main bundle 或 Documents 目录 |
| 加载方式 | `setBundleAssetName("device.hbc")` | `bundleURL = URL(fileURLWithPath: path)` |
| 热更新存储 | 内部存储 `/data/data/包名/` | Documents 或 Library 目录 |
| 权限 | 无特殊限制 | 沙盒机制，只能访问自己的目录 |

### 多 Bundle 加载流程（iOS）

```
1. App 启动 → 加载 common bundle（内置在 main bundle 中）
2. 路由跳转 → 判断目标 bundle 是否已下载
3. 已下载 → 从 Documents 目录加载
4. 未下载 → 显示 loading → 下载到 Documents → 加载
5. 创建新的 RCTBridge 实例，指定 bundleURL 为目标 bundle 路径
6. 创建 RCTRootView → 嵌入当前 UIViewController
```

### 和 Android 的统一抽象

XRN 的 updater SDK 需要抽象一层，屏蔽平台差异：

```
// 统一接口（JS 层）
XRNUpdater.loadBundle("device")

// Android 实现：从内部存储加载 .hbc，创建 ReactInstanceManager
// iOS 实现：从 Documents 加载 bundle，创建 RCTBridge
```

业务层不需要知道底层是 Android 还是 iOS，SDK 内部处理差异。

---

## 五、iOS 特有的约束

| 约束 | 说明 | 对架构的影响 |
|------|------|-------------|
| App Store 审核严格 | 审核 1-7 天，拒审常见 | 热更新价值更大（绕过审核修 bug） |
| 沙盒机制 | App 只能访问自己的目录 | Bundle 存储路径受限 |
| 后台限制严格 | 后台执行时间有限（~30s） | BLE 后台保活需要特殊配置（Background Modes） |
| 无动态代码加载 | 不能 dlopen / 不能加载外部 DEX | 只能热更新 JS Bundle，不能更新原生代码 |
| CocoaPods / SPM | 依赖管理和 Gradle 不同 | Autolinking 在 iOS 侧通过 `pod install` 实现 |
| 签名机制 | 开发/发布证书 + Provisioning Profile | CI/CD 需要处理证书管理 |

### BLE 后台保活（iOS 特有）

iOS 默认 App 进后台就暂停。IoT App 需要后台持续接收 BLE 数据：

```
Info.plist 配置：
  UIBackgroundModes: ["bluetooth-central"]  // 允许后台 BLE 扫描/连接
```

Android 不需要这个配置（后台 Service 天然支持）。

---

## 六、关键认知

1. **iOS 和 Android 的 RN 集成思路完全一样**：Native 壳 + RN 嵌入 + 指定 Bundle 路径
2. **多 Bundle 方案跨平台统一**：JS 层接口一致，SDK 内部处理 Android/iOS 差异
3. **iOS 的约束更严格**：沙盒、后台限制、审核——但这些恰好是热更新的价值所在
4. **不需要精通 iOS 开发**：知道核心概念对应关系 + 知道约束在哪 + 能和 iOS 同学对话就够

---

## 七、多 Bundle 实现的语言选型

| 平台 | 推荐 | 原因 |
|------|------|------|
| Android | **Kotlin** | RN 0.76+ 官方推荐，Codegen 支持，空安全/协程/简洁。旧代码 Java 不急迁移（互操作） |
| iOS | **Objective-C** | RN iOS 底层全是 OC，TurboModule Codegen 生成 OC++ 胶水，和 RN 内部交互最顺畅 |

**iOS 为什么不用 Swift**：
- RN 内部 API（RCTBridge/RCTRootView）是 OC
- 用 Swift 需要写 OC 桥接头文件（多一层）
- 纯业务逻辑可以用 Swift，但和 RN 交互的部分用 OC 更直接

---

## 八、iOS 构建环境

**硬性限制**：iOS 应用只能在 macOS 上构建（Xcode 工具链绑定 macOS）。

| 方案 | 本质 |
|------|------|
| 自建 Mac Mini 集群 | 大厂做法 |
| GitHub Actions macOS runner | 开源/中小团队 |
| EAS Build / Codemagic / Bitrise | 第三方云构建（底层也是 Mac） |
| AWS EC2 Mac | 按小时计费的 Mac 实例 |

**和 Android 对比**：

| | Android | iOS |
|---|---------|-----|
| 构建环境 | Linux/macOS/Windows 都行 | 只能 macOS |
| CI 成本 | 低（Linux 便宜） | 高（Mac 贵） |
| 签名 | keystore 文件 | 证书 + Provisioning Profile（复杂） |

**JS Bundle 构建不受限**：Metro 在 Linux/macOS/Windows 都能跑。只有最终打 IPA 才需要 Mac。
