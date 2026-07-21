  
 > 完整体系索引：[iOS 知识体系 README](../README.md)

## 目录

- [最小 iOS 项目（SwiftUI 模板）](#最小-ios-项目swiftui-模板xcode-16)
- [核心文件逐个讲](#核心文件逐个讲)
  - [MyApp.swift — 应用入口](#1-myappswift--应用入口)
  - [ContentView.swift — 第一个界面](#2-contentviewswift--第一个界面)
  - [Assets.xcassets — 资源目录](#3-assetsxcassets--资源目录)
  - [Info.plist — 应用配置清单](#4-infoplist--应用配置清单)
  - [MyAppTests.swift — 单元测试](#5-myapptestsswift--单元测试)
- [UIKit 项目（老模板）](#如果是-uikit-项目老模板)
- [一句话总结各文件职责](#一句话总结各文件职责)

---
 
好的，按目录结构讲，从最小例子开始，每个文件都有注释。

---

## 最小 iOS 项目（SwiftUI 模板，Xcode 16）

```
MyApp/
├── MyApp.xcodeproj/              # 项目配置（Xcode 管理，不用手动改）
├── MyApp/
│   ├── MyApp.swift               # ← 应用入口（SwiftUI 的 @main）
│   ├── ContentView.swift         # ← 第一个界面
│   ├── Assets.xcassets/          # ← 图片/颜色资源
│   │   └── AppIcon.appiconset/   #    应用图标
│   └── Preview Content/          # ← SwiftUI 预览专用资源
│       └── Preview Assets.xcassets/
├── MyAppTests/
│   └── MyAppTests.swift          # ← 单元测试
├── MyAppUITests/
│   └── MyAppUITests.swift        # ← UI 自动化测试
└── MyApp.xcworkspace/            # 用了 CocoaPods/SPM 后生成
```

---

## 核心文件逐个讲

### 1. `MyApp.swift` — 应用入口

```swift
import SwiftUI

// @main 标记：这是程序入口，类似 Java 的 public static void main()
// SwiftUI 项目用这个代替旧的 AppDelegate 作为启动点
@main
struct MyApp: App {
    
    // 应用级别的生命周期，连接 SwiftUI 和 UIKit 的桥梁
    // 类似 Android 的 Application 类
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    // body 定义应用的结构：有哪些场景（窗口）
    var body: some Scene {
        // WindowGroup：支持多窗口的场景（iPad 分屏、Mac 多窗口）
        WindowGroup {
            ContentView()  // 根视图，第一个显示的界面
        }
    }
}

// 如果需要传统的 AppDelegate 能力（推送、第三方 SDK 初始化）
class AppDelegate: NSObject, UIApplicationDelegate {
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // 应用启动完成时调用
        // 在这里初始化 Firebase、友盟、Bugly 等第三方 SDK
        print("App 启动完成")
        return true
    }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
        // 应用从后台回到前台
        print("App 进入前台")
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        // 应用进入后台
        print("App 进入后台")
    }
}
```

**关键理解**：
- `@main` 是 Swift 5.3 的入口标记，替代了 C 的 `main()` 函数
- SwiftUI 项目可以没有 `AppDelegate`，但推送/深度链接等仍需它
- `AppDelegate` 通过 `@UIApplicationDelegateAdaptor` 桥接到 SwiftUI

---

### 2. `ContentView.swift` — 第一个界面

```swift
import SwiftUI

// View 协议：SwiftUI 的核心，类似 Flutter 的 Widget 或 React 的 Component
struct ContentView: View {
    
    // @State：状态变量，变化时自动刷新 UI
    // 类似 React 的 useState，但不需要 setState
    @State private var count = 0
    
    // body：描述界面的结构，返回 some View（类型推断）
    // 类似 Flutter 的 build() 方法
    var body: some View {
        // VStack：垂直布局容器，类似 Column
        VStack(spacing: 20) {
            
            // Text：文本组件
            Text("Hello, iOS!")
                .font(.largeTitle)           // 修饰符链式调用
                .foregroundColor(.blue)
            
            // 显示计数
            Text("点击次数: \(count)")
                .font(.title2)
            
            // Button：按钮
            Button(action: {
                // 点击时修改状态，UI 自动刷新
                count += 1
            }) {
                // 按钮内容
                Label("点击我", systemImage: "hand.tap.fill")
                    .font(.headline)
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }
        }
        // 整个 VStack 的修饰符
        .padding()                           // 内边距
        .frame(maxWidth: .infinity, maxHeight: .infinity)  // 撑满全屏
        .background(Color(.systemBackground))               // 适配暗黑模式
    }
}

// Preview：Xcode 右侧实时预览，不编译到正式包
#Preview {
    ContentView()
}
```

**关键理解**：
- `struct` 不是 `class`：SwiftUI 的 View 是值类型，每次状态变化是重建而非更新
- `@State` 修饰的变量，SwiftUI 会自动管理其存储和刷新
- 修饰符顺序很重要：`.padding().background()` 和 `.background().padding()` 效果不同

---

### 3. `Assets.xcassets` — 资源目录

```
Assets.xcassets/
├── AppIcon.appiconset/           # 应用图标（自动适配各种尺寸）
│   ├── Contents.json             # 配置文件，Xcode 自动生成
│   ├── AppIcon~ios-marketing.png # 1024×1024 商店图标
│   ├── AppIcon@2x.png            # 2x 视网膜屏
│   └── AppIcon@3x.png            # 3x 超视网膜屏
├── AccentColor.colorset/         # 主题强调色
│   └── Contents.json             # 支持暗黑模式切换
└── MyImage.imageset/             # 自定义图片
    ├── Contents.json
    ├── MyImage.png               # 1x（基本不用了）
    ├── MyImage@2x.png
    └── MyImage@3x.png
```

**使用方式**：

```swift
Image("MyImage")                    // 加载图片
    .resizable()
    .scaledToFit()

Color("AccentColor")                // 使用定义的颜色，自动适配暗黑模式
```

**关键理解**：
- `.xcassets` 是 Xcode 的特殊目录，编译时会自动优化（压缩、按设备切片）
- `@2x` `@3x` 是像素密度后缀，iOS 根据屏幕自动选择
- `Contents.json` 是 Xcode 生成的配置文件，描述资源变体

---

### 4. `Info.plist` — 应用配置清单

> 2026 年 Xcode 16 中，这个文件默认隐藏，配置在 Target → Info 面板中，但底层仍是 `Info.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- 应用显示名称 -->
    <key>CFBundleDisplayName</key>
    <string>我的应用</string>
    
    <!-- 包标识符，全局唯一，类似 Android 的 applicationId -->
    <key>CFBundleIdentifier</key>
    <string>com.example.MyApp</string>
    
    <!-- 版本号 -->
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    
    <!-- 构建号，每次上传 App Store 必须递增 -->
    <key>CFBundleVersion</key>
    <string>1</string>
    
    <!-- 支持的屏幕方向 -->
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
    </array>
    
    <!-- 隐私权限声明（必须！否则审核被拒） -->
    <key>NSCameraUsageDescription</key>
    <string>需要访问相机来拍照</string>
    <key>NSPhotoLibraryUsageDescription</key>
    <string>需要访问相册来选择图片</string>
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>需要获取位置来推荐附近内容</string>
    
    <!-- URL Scheme，用于其他应用跳转过来 -->
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>com.example.MyApp</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>myapp</string>  <!-- 其他应用通过 myapp:// 打开 -->
            </array>
        </dict>
    </array>
</dict>
</plist>
```

**关键理解**：
- 类似 Android 的 `AndroidManifest.xml`，但权限声明更严格（必须说明用途）
- 隐私权限（`NSxxxUsageDescription`）是审核硬性要求，没有就拒
- URL Scheme 用于应用间跳转、分享回调、第三方登录回调

---

### 5. `MyAppTests.swift` — 单元测试

```swift
import XCTest
@testable import MyApp  // 引入主模块，@testable 允许访问 internal 成员

final class MyAppTests: XCTestCase {
    
    // 每个测试方法前执行，类似 JUnit 的 @Before
    override func setUpWithError() throws {
        try super.setUpWithError()
    }
    
    // 每个测试方法后执行，类似 JUnit 的 @After
    override func tearDownWithError() throws {
        try super.tearDownWithError()
    }
    
    // 测试方法必须以 test 开头
    func testExample() throws {
        // XCTAssert 系列断言
        XCTAssertEqual(2 + 2, 4)
        XCTAssertTrue(true)
        XCTAssertNotNil("hello")
    }
    
    // 异步测试
    func testAsyncOperation() async throws {
        let result = await fetchData()
        XCTAssertEqual(result.status, 200)
    }
    
    // 性能测试
    func testPerformanceExample() throws {
        measure {
            // 这里放需要测量性能的代码
            let _ = heavyComputation()
        }
    }
}
```

---

## 如果是 UIKit 项目（老模板）

目录结构稍有不同：

```
MyApp/
├── AppDelegate.swift              # 应用生命周期（SwiftUI 中弱化了）
├── SceneDelegate.swift            # 场景生命周期（iOS 13+ 多窗口支持）
├── ViewController.swift           # 第一个视图控制器
├── Main.storyboard                # 可视化界面布局文件
├── LaunchScreen.storyboard        # 启动屏
├── Assets.xcassets/
└── Info.plist
```

### `AppDelegate.swift`（UIKit 版本）

```swift
import UIKit

// @main 标记程序入口
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    // iOS 13+ 后 window 移到 SceneDelegate，这里可以删
    // 但老项目或单窗口应用可能还保留
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // 第三方 SDK 初始化
        return true
    }
}
```

### `SceneDelegate.swift`（iOS 13+ 新增）

```swift
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    // 窗口对象，UIKit 的核心，类似 Android 的 Window
    var window: UIWindow?
    
    // 场景连接时调用，这里设置根视图
    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        // 确保是 UIWindowScene
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        // 创建窗口
        window = UIWindow(windowScene: windowScene)
        
        // 设置根视图控制器
        let rootVC = ViewController()
        window?.rootViewController = UINavigationController(rootViewController: rootVC)
        
        // 显示窗口
        window?.makeKeyAndVisible()
    }
    
    func sceneDidDisconnect(_ scene: UIScene) {
        // 场景断开（系统回收资源）
    }
    
    func sceneDidBecomeActive(_ scene: UIScene) {
        // 进入前台
    }
    
    func sceneWillResignActive(_ scene: UIScene) {
        // 即将进入后台
    }
}
```

**关键理解**：
- iOS 13 后苹果把"应用生命周期"拆成"应用级"（AppDelegate）和"场景级"（SceneDelegate）
- 为了支持 iPad 多窗口：同一个 App 可以开多个窗口，每个窗口是一个 Scene
- 单窗口 App 可以不管这个拆分，但模板默认生成

---

## 一句话总结各文件职责

| 文件 | 职责 | 类比 Android |
|------|------|-------------|
| `MyApp.swift` | 应用入口，定义场景结构 | `Application` + `AndroidManifest.xml` 的入口 |
| `ContentView.swift` | 界面定义和交互逻辑 | `Activity` 的 `onCreate` + XML 布局 |
| `Assets.xcassets` | 图片、图标、颜色资源 | `res/drawable` + `res/mipmap` |
| `Info.plist` | 应用配置、权限、URL Scheme | `AndroidManifest.xml` |
| `AppDelegate` | 应用生命周期、SDK 初始化 | `Application` |
| `SceneDelegate` | 窗口管理、多场景支持 | `Activity` 的窗口管理 |
| `*_Tests.swift` | 单元测试 | `test/` 目录下的 JUnit 测试 |