# RN iOS 侧核心概念

## 目录

- [iOS vs Android 概念映射](#ios-vs-android-概念映射)
- [开发构建流程](#开发构建流程)
- [ObjC Bridge（类似 JNI）](#objc-bridge类似-jni)
- [TurboModule iOS 侧开发](#turbomodule-ios-侧开发)
- [性能优化对比 Android](#性能优化对比-android)
- [常见问题](#常见问题)

---

## iOS vs Android 概念映射

| Android | iOS | 说明 |
|---------|-----|------|
| Java/Kotlin | ObjC/Swift | 原生语言 |
| JNI | ObjC Runtime / C 函数调用 | C++ 调用原生的方式 |
| Gradle | Xcode Build System + CocoaPods | 构建 + 依赖管理 |
| APK | IPA | 安装包格式 |
| Activity | UIViewController | 页面容器 |
| View | UIView | UI 基础组件 |
| AndroidManifest.xml | Info.plist | 应用配置 |
| ProGuard/R8 | Bitcode + Strip（已废弃 Bitcode） | 代码优化/混淆 |
| ABI (arm64-v8a) | Architecture (arm64) | CPU 架构 |
| SharedPreferences | NSUserDefaults | 轻量持久化 |
| Intent | URL Scheme / Universal Links | 跨应用通信 |
| DEX | Mach-O | 可执行文件格式 |

---

## 开发构建流程

### RN iOS 项目结构

```
ios/
├── MyApp/
│   ├── AppDelegate.mm        ← 应用入口（初始化 RN 引擎）
│   ├── Info.plist             ← 应用配置（权限、URL Scheme）
│   └── LaunchScreen.storyboard
├── MyApp.xcworkspace          ← Xcode 工作空间（用这个打开）
├── Podfile                    ← CocoaPods 依赖声明（类似 build.gradle）
└── Podfile.lock
```

### 构建流程

```
pnpm install
  → npx pod-install（安装 iOS 原生依赖 + 触发 Codegen 生成 TurboModule/Fabric 胶水代码）
  → Xcode Build：
      1. 编译 Codegen 产物 + ObjC/Swift → .o 文件
      2. 编译 C++（JSI/Fabric/Hermes）→ .o 文件
      3. Link → Mach-O 可执行文件
      4. 打包资源 + JS Bundle → .app
      5. 签名 → .ipa
```

### 依赖管理：CocoaPods（类似 Gradle）

```ruby
# Podfile（类似 build.gradle 的 dependencies）
platform :ios, '15.0'

target 'MyApp' do
  use_frameworks! :linkage => :static
  config = use_native_modules!  # 自动链接 RN 原生模块

  pod 'React-Core', :path => '../node_modules/react-native'
  pod 'hermes-engine', :path => '../node_modules/react-native/sdks/hermes-engine'
  # ... RN 自动生成的依赖
end
```

```bash
cd ios && pod install  # 安装依赖（生成 .xcworkspace）
```

---

## ObjC Bridge（类似 JNI）

### Android JNI vs iOS

| | Android (JNI) | iOS |
|--|---|---|
| C++ 调用原生 | `env->CallObjectMethod(...)` | ObjC Runtime `objc_msgSend` 或直接 C 函数 |
| 类型转换 | jstring ↔ std::string | NSString ↔ std::string |
| 注册方式 | JNI_OnLoad + RegisterNatives | ObjC 类方法直接暴露 |
| 复杂度 | 高（手动管理 JNI 引用） | 低（ObjC 对象自动 ARC 管理） |

### 为什么 iOS 侧更简单

ObjC 本身就是 C 的超集，ObjC 对象可以直接在 C++ 代码中使用（`.mm` 文件 = ObjC++）。不需要像 JNI 那样通过 `env->` 间接调用。

```objc++
// .mm 文件中可以直接混用 C++ 和 ObjC
#include <string>
#import <Foundation/Foundation.h>

std::string convertToStd(NSString *nsStr) {
  return std::string([nsStr UTF8String]);  // 直接调用 ObjC 方法
}
```

---

## TurboModule iOS 侧开发

### 和 Android 侧的对比

| 步骤 | Android | iOS |
|------|---------|-----|
| 1. 写 Spec | 相同（NativeXxx.ts） | 相同 |
| 2. Codegen 生成 | Java 抽象基类 + C++ 胶水 | ObjC Protocol + C++ 胶水 |
| 3. 实现 | 继承 Java 基类 | 遵循 ObjC Protocol |
| 4. 注册 | TurboReactPackage | RCTAppDelegate 自动注册 |

### iOS 侧实现示例

```objc
// BLEModule.mm
#import <NativeBLEModuleSpec.h>  // Codegen 生成的 Protocol

@interface BLEModule : NSObject <NativeBLEModuleSpec>
@end

@implementation BLEModule

RCT_EXPORT_MODULE()  // 注册模块（宏，自动处理）

- (NSNumber *)connect:(NSString *)deviceId {
  // 调用 CoreBluetooth API
  CBPeripheral *peripheral = [self findPeripheral:deviceId];
  [self.centralManager connectPeripheral:peripheral options:nil];
  return @(YES);
}

- (NSNumber *)isConnected {
  return @(self.peripheral.state == CBPeripheralStateConnected);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeBLEModuleSpecJSI>(params);
}

@end
```

### 关键区别

| | Android | iOS |
|--|---------|-----|
| 语言 | Kotlin/Java | ObjC（.mm 文件，支持 C++） |
| 注册 | 手动写 Package + Application 注册 | `RCT_EXPORT_MODULE()` 宏自动注册 |
| C++ 集成 | 需要 JNI 中间层 | 直接混编（ObjC++ = ObjC + C++） |
| 内存管理 | 手动管理 JNI 引用 | ARC 自动管理 |
| 复杂度 | 较高 | 较低 |

---

## 性能优化对比 Android

| 优化方向 | Android | iOS |
|---------|---------|-----|
| **启动** | DEX 布局优化、MultiDex | dyld 优化（减少动态库数量） |
| **包体** | R8/ProGuard、SO strip | Bitcode（已废弃）、Asset Catalog 优化 |
| **内存** | PSS 监控、GC 调优 | Instruments Allocations、ARC 优化 |
| **渲染** | Choreographer 监控帧率 | CADisplayLink 监控帧率 |
| **Crash** | Breakpad（Native）、Java 异常 | PLCrashReporter、NSException |
| **构建速度** | Gradle 增量编译 | Xcode 增量编译 + 预编译头（PCH） |
| **热更新** | CodePush / 自建 | CodePush / 自建（同） |

### iOS 特有的性能关注点

| 问题 | 说明 | 解决 |
|------|------|------|
| **App Launch Time** | Apple 要求冷启动 < 400ms（到 main） | 减少 +load 方法、延迟初始化 |
| **内存压力（Jetsam）** | iOS 没有 swap，内存超限直接被系统杀 | 监控内存水位、主动释放 |
| **后台限制** | iOS 后台执行时间有限（~30s） | Background Task API |
| **审核限制** | 不能用 dlopen 动态加载代码 | 热更新只能更新 JS Bundle |

---

## 常见问题

### Q: iOS 开发需要会 Swift 吗？

> RN 原生模块目前主流还是 ObjC（.mm 文件，方便和 C++ 混编）。Swift 可以用但需要 Bridging Header，增加复杂度。新项目趋势是 Swift，但 RN 生态大部分库还是 ObjC。

### Q: CocoaPods vs SPM（Swift Package Manager）？

> RN 生态目前依赖 CocoaPods。SPM 是 Apple 官方方案，未来趋势，但 RN 还没完全迁移。当前用 CocoaPods。

### Q: iOS 签名/证书怎么回事？

> 开发证书（Development）→ 真机调试
> 发布证书（Distribution）→ 上架 App Store
> Provisioning Profile = 证书 + App ID + 设备列表
> 这些 Xcode 可以自动管理（Automatically manage signing）
