# iOS 包体优化

## Android → iOS 概念映射

| Android | iOS | 说明 |
|---------|-----|------|
| APK | IPA | 安装包格式 |
| ABI Split（arm64/armv7） | App Thinning（自动） | 按设备架构裁剪 |
| SO 库（.so） | 动态库（.dylib/.framework） | Native 共享库 |
| DEX（Java 字节码） | Mach-O（编译后二进制） | 可执行代码 |
| R8/ProGuard（混淆+缩减） | Dead Code Stripping + LTO | 代码优化 |
| resources（res/） | Asset Catalog（xcassets） | 资源管理 |
| AAB（Google Play 裁剪） | App Thinning（App Store 裁剪） | 按设备下发 |
| `./gradlew bundleRelease` | `xcodebuild archive` | 构建命令 |

> iOS 不用 .so，用 .framework（Apple 的库格式）。本质一样——编译后的 Native 二进制，文件格式不同（Linux ELF/.so，Apple Mach-O/.framework）。

---

## iOS 包体组成

```
IPA 解压后：
├── Frameworks/          ← 动态库（RN 框架、Hermes、三方 SDK）
├── MyApp（Mach-O）      ← 主二进制（ObjC/Swift 编译产物）
├── main.jsbundle        ← JS Bundle（Hermes .hbc）
├── Assets.car           ← Asset Catalog 编译产物（图片）
├── *.lproj/             ← 国际化资源
└── _CodeSignature/      ← 签名
```

---

## 优化手段

| 手段 | Android 对应 | iOS 做法 | 效果 |
|------|-------------|---------|------|
| **App Thinning** | ABI Split | App Store 自动按设备下发（@2x/@3x 图片、arm64 架构） | 用户下载 -30~50% |
| **Bitcode**（已废弃） | — | Xcode 14 后移除，不用管 | — |
| **Dead Code Stripping** | R8 代码缩减 | Build Settings → `DEAD_CODE_STRIPPING = YES`（默认开启） | 移除未调用函数 |
| **LTO（Link-Time Optimization）** | R8 方法内联 | Build Settings → `LTO = YES` | 跨模块优化 -5~10% |
| **Strip Swift Symbols** | ProGuard 混淆 | Build Settings → `STRIP_SWIFT_SYMBOLS = YES` | -5~10% |
| **动态库 → 静态库** | — | Podfile: `use_frameworks! :linkage => :static` | 减少 dylib 数量 + 启动加速 |
| **Asset Catalog** | WebP + 资源压缩 | 图片放 xcassets（系统自动优化格式+按设备裁剪） | 资源 -30% |
| **Hermes .hbc** | 同 | 同（两端共用 Hermes 预编译） | Bundle -30% |
| **分 Bundle** | 同 | 同（两端共用方案） | 首屏 Bundle -50% |

---

## App Thinning 详解

Apple 的 App Thinning 包含三个机制（**你不需要额外配置，App Store 自动做**）：

| 机制 | 做什么 |
|------|--------|
| **Slicing** | 按设备架构 + 屏幕分辨率裁剪（只下发 arm64 + @3x） |
| **On-Demand Resources** | 标记为"按需"的资源不打进初始包，用到时再下载 |
| **Bitcode**（已废弃） | — |

---

## 测量

```bash
# 查看 IPA 各部分大小
xcrun --sdk iphoneos size MyApp.app/MyApp  # Mach-O 大小

# App Store Connect 查看各设备的实际下载大小
# 上传后在 "App Size" 报告中查看
```

| 工具 | 用途 |
|------|------|
| Xcode → Build Report | 查看编译产物各部分大小 |
| `bloaty`（Google 开源） | 分析 Mach-O 各 section 大小 |
| App Store Connect | 查看用户实际下载大小（按设备） |
