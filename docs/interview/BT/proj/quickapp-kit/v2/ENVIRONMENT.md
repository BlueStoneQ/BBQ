# QuickApp Kit v2 开发环境设计

## 目录

- [1. 结论](#1-结论)
- [2. 本机环境现状](#2-本机环境现状)
- [3. 全链路环境需求](#3-全链路环境需求)
- [4. 当前缺口](#4-当前缺口)
- [5. 推荐补齐方案](#5-推荐补齐方案)
- [6. 关键决策](#6-关键决策)
- [7. 验收标准](#7-验收标准)

## 1. 结论

当前机器已经具备 QuickApp Kit v2 的大部分基础环境：

- macOS / Apple Silicon
- Xcode
- Android Studio JBR Java
- Android SDK / NDK / CMake / platform-tools
- Node.js / npm / yarn / pnpm fallback
- Homebrew
- CMake / clang / Python / Git

当前结论：

1. Android / iOS / LVGL 三个平台调试环境已经具备。
2. Android SDK/NDK、Android Emulator、AVD、Xcode Simulator、CMake/Ninja、SDL2、Gradle、CocoaPods 均已验证。
3. `bun` 未安装，但 QuickApp Kit v2 以 Node.js/npm/pnpm/yarn 为 JS 工具链基础，Bun 不是三平台调试硬依赖。

## 2. 本机环境现状

| 项 | 状态 |
|---|---|
| macOS | 26.5.1, arm64 |
| Xcode | 26.6 |
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| Java | OpenJDK 21, Android Studio JBR |
| CMake | 4.4.2, Homebrew |
| Android SDK | 已安装，路径 `/Users/qy/Library/Android/sdk` |
| Android NDK | 已安装，`28.2.13676358`、`30.0.15729638` |
| Android platform-tools | 已安装，但未进 PATH |
| Android cmdline-tools | 已安装，但未进 PATH |
| Homebrew | 已安装 |
| Gradle | 9.7.0 |
| Ninja | 1.13.2 Homebrew；Android SDK 另有 1.12.1 |
| pkg-config | 已安装 |
| SDL2 | 2.32.70 |
| CocoaPods | 1.17.0 |
| Android Emulator | 36.6.11.0 |
| Android AVD | `Pixel_10_Pro` |
| iOS Simulator Runtime | iOS 26.5 |

## 3. 全链路环境需求

| 产品 | 必需环境 | 说明 |
|---|---|---|
| quickapp-toolkit | Node.js, npm/pnpm/yarn | CLI 内核、RPK 构建、校验、inspect |
| quickapp-runtime-js | Node.js | JS framework 开发、单测、bundle 输出 |
| quickapp-runtime-core | CMake, clang, ninja, Python | C++ Core、QuickJS、Yoga、测试与 benchmark |
| quickapp-runtime-android | Android SDK, NDK, Java, Gradle Wrapper, adb | Android NDK 首发宿主 |
| quickapp-runtime-lvgl | CMake, clang, ninja, SDL2, pkg-config | LVGL 后端和 SDL 模拟器 |
| quickapp-runtime-ios | Xcode, clang, CocoaPods 可选 | iOS/UIKit 后端 |
| quickapp-benchmark | Node.js, Python, platform tools | 指标采集、结果聚合、对比报告 |

## 4. 当前缺口

### 4.1 PATH 缺口

已安装但当前 shell 找不到：

- `adb`
- `sdkmanager`
- `ndk-build`

原因是 Android SDK 目录没有进入 PATH。

### 4.2 C++/LVGL 缺口

当前已具备：

- `ninja`
- `pkg-config`
- `sdl2`

这些用于桌面 C++ 构建、依赖发现和 LVGL SDL 模拟器。

### 4.3 iOS 缺口

当前已具备：

- `pod`
- Xcode Simulator runtime
- 可用 iPhone / iPad 模拟器设备

## 5. 推荐补齐方案

### 5.1 项目级环境脚本

优先在代码 workspace 内提供项目级环境脚本，不直接修改全局 shell 配置。

建议脚本：

```text
/Users/qy/code/my-github/quickapp-kit-ai/tools/env/quickapp-env.sh
```

用途：

```sh
source tools/env/quickapp-env.sh
```

### 5.2 Homebrew 安装项

已安装：

```sh
brew install ninja pkg-config sdl2 gradle cocoapods
```

不安装：

```sh
bun
```

原因：Node.js/npm/pnpm/yarn 已满足 toolkit 和 runtime-js 开发；Bun 是可选工具，不是三平台调试硬依赖。

### 5.3 Gradle 策略

Android 工程优先提交 Gradle Wrapper：

```text
./gradlew
```

不强依赖全局 `gradle`。

## 6. 关键决策

### KD-ENV-001：项目级环境脚本优先

结论：先提供项目级 env script，不直接写入 `~/.zshrc`。

原因：项目环境可复现，不污染用户全局环境。

### KD-ENV-002：Android 使用已安装 SDK/NDK

结论：复用 `/Users/qy/Library/Android/sdk`，优先选择稳定 NDK 版本。

原因：本机已经具备 Android SDK/NDK，当前主要是 PATH 和变量问题。

### KD-ENV-003：Android 工程使用 Gradle Wrapper

结论：不把全局 `gradle` 作为硬要求。

原因：Wrapper 能锁定版本，更适合多 agent 协作和可复现构建。

### KD-ENV-004：LVGL 通过 SDL 模拟器先验证

结论：LVGL 端优先用桌面 SDL 模拟器验证，再接真实嵌入式设备。

原因：SDL 模拟器反馈快，适合验证 Core 到 LVGL 后端的可移植性。

## 7. 验收标准

环境补齐后的基础验收：

```sh
node -v
npm -v
java -version
cmake --version
ninja --version
adb version
sdkmanager --version
ndk-build --version
xcodebuild -version
pkg-config --modversion sdl2
```

当前验收结果：

| 命令 | 状态 |
|---|---|
| `adb version` | 通过 |
| `emulator -version` | 非沙箱通过 |
| `avdmanager list avd` | 非沙箱通过，存在 `Pixel_10_Pro` |
| `ndk-build --version` | 通过 |
| `cmake --version` | 通过 |
| `ninja --version` | 通过 |
| `sdl2-config --version` | 通过，2.32.70 |
| `pkg-config --modversion sdl2` | 通过，2.32.70 |
| `gradle --version` | 非沙箱通过，9.7.0 |
| `pod --version` | 通过，1.17.0 |
| `xcodebuild -version` | 通过，26.6 |
| `xcrun simctl list runtimes` | 非沙箱通过，iOS 26.5 |

项目级验收：

1. toolkit 能运行 CLI 单测。
2. runtime-js 能运行 JS framework 单测。
3. runtime-core 能通过 CMake + Ninja 编译空骨架。
4. runtime-android 能识别 SDK/NDK 并执行 Gradle 配置阶段。
5. runtime-lvgl 能找到 SDL2 并编译模拟器骨架。
