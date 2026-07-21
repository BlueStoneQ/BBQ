1.  源码目录结构, 构建结果是怎样的, 几部分组成的
2. 开发全链路: 创建 - 运行 - 调试 - 打包 - 发布上架
3.  核心部件: 好比说类似于Android的四大组件
4.  多线程等部件 
5. 运行时: 是怎么运行的
6. 核心指标: 可观测体系是怎样的
7.  优化: 性能 流畅度 包体 内存  稳定性:例如watch Dog等
8. 核心语言(swift/OC++): 语法迁移, 从TS 
9. 类似NDK: 和C++混编吗
10. RN 相关的IOS开发
11. 其他需要关注的: 提下主题

> 完整体系索引：[iOS 知识体系 README](../README.md)

## 目录

- [1. 源码目录结构 & 构建产物](#1-源码目录结构--构建产物)
- [2. 开发全链路](#2-开发全链路)
- [3. 核心部件（类比 Android 四大组件）](#3-核心部件类比-android-四大组件)
- [4. 多线程与并发](#4-多线程与并发)
- [5. 运行时机制](#5-运行时机制)
- [6. 核心指标与可观测体系](#6-核心指标与可观测体系)
- [7. 性能优化](#7-性能优化)
- [8. 核心语言：Swift / Objective-C / C++](#8-核心语言swift--objective-c--c)
- [9. C++ 混编（类似 Android NDK）](#9-c-混编-android-ndk)
- [10. RN 相关的 iOS 开发](#10-rn-相关的-ios-开发)
- [11. 其他需要关注的主题](#11-其他需要关注的主题)


---

# iOS 大前端工程师速查手册

---

## 1. 源码目录结构 & 构建产物

### 标准目录结构

```
MyApp/
├── MyApp.xcodeproj/           # 项目配置文件（旧版）
├── MyApp.xcworkspace/         # 工作空间（CocoaPods/SPM 后生成）
├── MyApp/
│   ├── AppDelegate.swift      # 应用生命周期代理
│   ├── SceneDelegate.swift    # 场景生命周期（iOS 13+ 多窗口）
│   ├── ViewController.swift   # 视图控制器
│   ├── Main.storyboard        # 可视化界面布局
│   ├── LaunchScreen.storyboard
│   ├── Assets.xcassets/       # 图片/颜色资源（≈ Android res/drawable）
│   ├── Info.plist             # 应用配置清单（≈ AndroidManifest.xml）
│   └── Preview Content/       # SwiftUI 预览
├── MyAppTests/                # 单元测试
├── MyAppUITests/              # UI 测试
├── Pods/                      # CocoaPods 依赖
└── Package.resolved           # SPM 依赖锁定
```

### 构建产物

| 产物 | 说明 | ≈ Android |
|------|------|-----------|
| `.app` | 应用包（实际是目录）| `.apk` |
| `.ipa` | 发布包（zip 重命名）| `.aab` |
| `.dSYM` | 调试符号文件（崩溃分析必需）| `mapping.txt` |
| `.framework` | 动态/静态库 | `.aar` |
| `.xcarchive` | 归档包（用于分发）| — |

### 构建系统

- **CocoaPods**：Ruby 写的依赖管理（≈ Gradle + Maven）
- **Swift Package Manager (SPM)**：苹果官方，现代项目首选
- **Carthage**：已逐渐被淘汰

---

## 2. 开发全链路

```
创建项目 → Xcode → New Project → iOS App → 选 UIKit / SwiftUI
    ↓
编写代码（Swift / Objective-C）
    ↓
运行（Cmd+R）
    ├── Simulator（iOS 模拟器）
    └── 真机（需 Apple ID / 开发者账号签名）
    ↓
调试（Cmd+Shift+Y）
    ├── Breakpoints（断点）
    ├── LLDB（调试器命令）
    ├── View Hierarchy Debugger
    └── Memory Graph Debugger
    ↓
打包（Product → Archive）
    ├── Development（开发签名）
    ├── Ad Hoc（内测分发，100台/年）
    ├── Enterprise（企业证书）
    └── App Store（上架）
    ↓
发布
    ├── App Store Connect
    ├── TestFlight（内测）
    └── App Store（审核通常 1-3 天）
```

> ⚠️ iOS 签名比 Android 复杂得多：证书 + App ID + Profile 三者绑定。

---

## 3. 核心部件（类比 Android 四大组件）

| Android | iOS 对应 | 说明 |
|---------|---------|------|
| **Activity** | **UIViewController** | 界面控制器，管理视图生命周期 |
| **Service** | **无直接对应** | 后台能力受限，用 Background Tasks / URLSession |
| **BroadcastReceiver** | **NotificationCenter** | 本地通知 + 系统广播 |
| **ContentProvider** | **无直接对应** | 用 App Groups + Shared Container |
| **Application** | **UIApplication** | 单例，应用级别生命周期 |

### UIViewController 生命周期（≈ Activity）

```swift
class MyViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        // 首次创建，≈ onCreate()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // 即将显示，≈ onStart()
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // 已显示，≈ onResume()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // 即将消失，≈ onPause()
    }
    
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        // 已消失，≈ onStop()
    }
    
    deinit {
        // 销毁，≈ onDestroy()
    }
}
```

### 界面体系

| 技术 | 说明 | 现状 |
|------|------|------|
| **UIKit** | 传统命令式 UI，Storyboard + XIB | 存量大，企业项目主流 |
| **SwiftUI** | 声明式 UI，类似 Flutter/React | 苹果主推，新项目首选 |
| **Core Animation** | 底层动画框架 | 性能敏感场景 |

---

## 4. 多线程与并发

| 方案 | 使用场景 | ≈ Android |
|------|---------|-----------|
| **GCD** | 简单异步任务、队列管理 | `Executors` + `HandlerThread` |
| **NSOperationQueue** | 复杂依赖、取消、优先级 | `ThreadPoolExecutor` + `Future` |
| **NSThread** | 极少数精细控制场景 | `Thread` |

### GCD 核心用法（最常用）

```swift
// 异步执行 + 回主线程
DispatchQueue.global(qos: .userInitiated).async {
    let result = heavyComputation()
    DispatchQueue.main.async {
        self.label.text = result
    }
}

// 串行队列（线程安全）
let serialQueue = DispatchQueue(label: "com.myapp.serial")

// 并发队列 + Barrier（读写锁）
let concurrentQueue = DispatchQueue(label: "com.myapp.concurrent", attributes: .concurrent)
concurrentQueue.async(flags: .barrier) {
    // 写操作，阻塞其他读写
}
```

### async/await（Swift 5.5+，现代写法）

```swift
func fetchData() async throws -> Data {
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}

Task {
    let data = try await fetchData()
}
```

### 线程安全

```swift
// @MainActor 保证主线程
@MainActor
class MyViewModel {
    func updateUI() { }
}

// 闭包中 [weak self] 必须养成习惯
networkRequest { [weak self] result in
    guard let self = self else { return }
    self.handle(result)
}
```

---

## 5. 运行时机制

### Objective-C Runtime（经典）

```
[object method] → objc_msgSend(object, @selector(method))
    ↓
1. 通过 isa 指针找到类对象
2. 在方法缓存（cache）中查找
3. 未命中则在方法列表中查找
4. 沿继承链向上（superclass）
5. 最终未找到进入消息转发
    ├── 动态方法解析：+resolveInstanceMethod:
    ├── 快速转发：-forwardingTargetForSelector:
    └── 慢速转发：-methodSignatureForSelector: + -forwardInvocation:
```

### Swift Runtime（现代）

| 特性 | Objective-C | Swift |
|------|-------------|-------|
| 方法派发 | 动态派发（objc_msgSend） | 静态派发为主，V-Table 为辅 |
| 动态性 | 极强（方法交换、动态添加属性） | 有限（@objc 标记才暴露给 OC） |
| 性能 | 消息发送有开销 | 静态派发可内联优化 |

---

## 6. 核心指标与可观测体系

### 关键性能指标

| 指标 | 工具 | 健康阈值 |
|------|------|---------|
| **FPS** | Instruments (Core Animation) | ≥ 55fps |
| **CPU** | Time Profiler | 主线程 < 80% |
| **内存** | Allocations / Leaks | 无持续增长 |
| **启动时间** | App Launch | 冷启动 < 3s |

### 可观测工具链

| 工具 | 用途 |
|------|------|
| **Instruments** | CPU、内存、渲染、网络、电量 |
| **Memory Graph Debugger** | 内存泄漏、循环引用可视化 |
| **View Debugger** | UI 层级、约束冲突 |
| **MetricKit** | 线上性能指标（苹果官方） |

### 系统日志关键字

```
watchdog: main-thread blocked        # 主线程卡死（ANR）
jetsam_event: high memory pressure   # 内存压力被杀
EXC_BAD_ACCESS                       # 野指针
0x8badf00d                           # Watchdog 杀死
```

---

## 7. 性能优化

### 渲染与流畅度

```swift
// ❌ 离屏渲染（cornerRadius + masksToBounds 组合）
view.layer.cornerRadius = 10
view.layer.masksToBounds = true

// ✅ 解决方案：CAShapeLayer / Core Graphics 预渲染 / iOS 13+ maskedCorners
```

### 内存优化

```swift
// 图片内存 = width × height × 4 bytes (RGBA)
// 1000×1000 图片 ≈ 4MB（不是文件大小！）

// NSCache 自带淘汰策略
let cache = NSCache<NSString, UIImage>()

// 大循环中手动 Autorelease Pool
for i in 0..<100000 {
    autoreleasepool {
        // 临时对象在此释放
    }
}
```

### 稳定性：Watchdog

- 主线程阻塞超过 5-10 秒 → 系统强制杀死
- 表现：闪退，日志中 `0x8badf00d`
- 预防：所有耗时操作放后台线程，启动阶段精简

---

## 8. 核心语言：Swift / Objective-C / C++

### Swift vs TypeScript 语法迁移

| TypeScript | Swift |
|-----------|-------|
| `const x = 1` | `let x = 1` |
| `let x = 1` | `var x = 1` |
| `function foo()` | `func foo()` |
| `interface` | `protocol` |
| `type` | `typealias` |
| `Promise<T>` | `async throws -> T` |
| `null` | `nil` / `Optional` (`T?`) |

### Swift 关键特性

```swift
// Optional
var name: String? = nil
let unwrapped = name ?? "default"

// Guard 提前返回
guard let name = name else { return }

// 结构体（值类型）vs 类（引用类型）
struct Point { var x, y: Int }      // 值类型
class Person { var name: String }  // 引用类型

// 闭包
let double = { (x: Int) -> Int in x * 2 }
```

### Objective-C 快速识别

```objc
// 方法调用（消息发送）
[object methodWithParam:param1 andParam:param2];

// 属性
@property (nonatomic, strong) NSString *name;   // strong ≈ 强引用
@property (nonatomic, weak) id delegate;          // weak ≈ 弱引用

// Block ≈ 闭包
void (^completion)(BOOL) = ^(BOOL success) { };
```

---

## 9. C++ 混编（≈ Android NDK）

| 方式 | 文件后缀 | 场景 |
|------|---------|------|
| **Objective-C++** | `.mm` | OC 调用 C++，最常用 |
| **C Bridging Header** | `.h` | Swift 调用 C |
| **C++ Interoperability** | `.swift` | Swift 5.9+ 直接调用 C++ |

### Objective-C++ 示例

```objc
// MyWrapper.mm
#import "MyWrapper.h"
#include "my_cpp_library.hpp"

@implementation MyWrapper
- (NSString *)processData:(NSString *)input {
    std::string cppInput = [input UTF8String];
    std::string cppOutput = MyCppLib::process(cppInput);
    return [NSString stringWithUTF8String:cppOutput.c_str()];
}
@end
```

### 与 Android NDK 对比

| 维度 | Android NDK | iOS C++ |
|------|-------------|---------|
| 构建系统 | CMake / ndk-build | Xcode Build + CMake |
| 调用方式 | JNI | Objective-C++ / Swift C++ Interop |
| ABI | 多 ABI（arm64-v8a, armeabi-v7a） | 统一 arm64（iOS 11+ 仅 arm64） |
| STL | libc++ | libc++（相同） |

---

## 10. RN 相关的 iOS 开发

### 架构演进（2026 现状）

```
旧架构（Bridge）                    新架构（New Architecture）
    ↓                                    ↓
JS Thread ←→ Bridge ←→ Native        JS Thread ←→ JSI ←→ Native
（异步 JSON 序列化）                    （同步直接调用）
    ↓                                    ↓
NativeModules                        TurboModules
UIManager                            Fabric
```

### 2026 关键变化

- **Bridge 已死**：RN 0.82+ 彻底移除旧架构
- **Hermes 必需**：新架构依赖 Hermes
- **Fabric 默认**：新渲染器
- **Codegen**：TS 类型自动生成 Native 绑定

### Native Module（新架构 TurboModule）

```objc
// RNCalculator.mm
#import "RNCalculator.h"

@implementation RNCalculator
RCT_EXPORT_MODULE(NativeCalculator);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeCalculatorSpecJSI>(params);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(add:(double)a b:(double)b) {
    return @(a + b);  // 同步调用
}
@end
```

### RN iOS 开发要点

| 主题 | 要点 |
|------|------|
| **Podfile** | 管理 Native 依赖，≈ `build.gradle` |
| **Autolinking** | RN 0.60+ 自动链接 |
| **AppDelegate** | 需配置 RCTBridge / RCTFabricSurface |
| **Swift 模块** | 需要 Bridging Header 暴露给 RN |

---

## 11. 其他需要关注的主题

| 主题 | 重要性 | 说明 |
|------|--------|------|
| **Auto Layout** | ⭐⭐⭐ | 约束布局系统，≈ ConstraintLayout |
| **Size Classes** | ⭐⭐⭐ | 适配不同屏幕尺寸 |
| **Dark Mode** | ⭐⭐⭐ | `traitCollection.userInterfaceStyle` |
| **Safe Area** | ⭐⭐⭐ | 刘海屏适配 |
| **Push Notification** | ⭐⭐⭐ | APNs |
| **Keychain** | ⭐⭐⭐ | 安全存储，≈ Android Keystore |
| **Core Data / SwiftData** | ⭐⭐ | ORM 框架，≈ Room |
| **Combine / RxSwift** | ⭐⭐ | 响应式编程，≈ RxJS |
| **SwiftUI** | ⭐⭐⭐ | 声明式 UI，未来趋势 |
| **Widget** | ⭐⭐ | iOS 14+ 桌面小组件 |
| **Swift Concurrency** | ⭐⭐⭐ | async/await + Actor |

### 面试高频

1. **ARC 原理**：自动引用计数，编译器插入 retain/release，非 GC
2. **RunLoop**：事件循环机制，NSTimer、触摸事件、GCD 都依赖它
3. **Responder Chain**：事件响应链，≈ Android 事件分发
4. **KVO/KVC**：键值观察/编码，OC 特有动态特性
5. **Category vs Extension**：运行时添加方法 vs 编译期扩展
6. **Swift 值类型 vs 引用类型**：struct vs class

### 路径

```
第1周：Swift 语法 + Xcode 基础
第2周：UIKit / SwiftUI + Auto Layout
第3周：生命周期 + 导航 + 数据传递
第4周：网络请求 + 数据持久化 + 多线程
第5周：性能优化 + Instruments
第6周：RN Native Module + 混编实战
```

---

> 适用版本：iOS 18 / Xcode 16 / Swift 6