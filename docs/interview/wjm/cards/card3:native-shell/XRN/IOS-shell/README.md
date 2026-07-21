# XRN iOS Shell

→ [XRN 总览](../README.md)

> 对照 [Android Shell](../android-shell/README.md)，iOS 侧类比迁移。

## 目录

- [依赖安装](#依赖安装)
- [核心组件 + 生命周期](#核心组件--生命周期)
- [多 ViewController + 多 Instance](#多-viewcontroller--多-instance)
- [多 Bundle 启动主流程](#多-bundle-启动主流程)
- [HMR 主流程](#hmr-主流程)
- [CrashGuard](#crashguard)

---

## 依赖安装

| Android | iOS |
|---------|-----|
| `implementation("com.facebook.react:react-android")` in Gradle | `pod 'React-Core'` + `pod 'hermes-engine'` in Podfile |

`pod install` 后自动拉取。

---

## 核心组件 + 生命周期

| Android 概念 | iOS 对应 | 说明 |
|-------------|---------|------|
| Application.onCreate | AppDelegate.didFinishLaunching | 初始化 RCTHost / RCTBridge |
| ReactInstanceManager | RCTHost（新架构）/ RCTBridge（旧架构） | 引擎管理者 |
| ReactRootView | RCTRootView | RN 内容根 View |
| Activity | UIViewController | 页面容器 |
| startReactApplication() | RCTRootView(bridge:, moduleName:, initialProperties:) | 启动渲染 |
| onDestroy | viewDidDisappear + invalidate | 释放资源 |

---

## 多 ViewController + 多 Instance

和 Android 一样：一个通用 `RNContainerViewController`，每次 push 新建实例。

```swift
let vc = RNContainerViewController()
vc.moduleName = "home/index"
vc.bundlePath = "/hot/home/v1.2.2/home.hbc"
navigationController?.pushViewController(vc, animated: true)
```

实例池：和 Android 相同逻辑，预创建 N 个 RCTBridge（已加载 common），用时取出追加 business bundle。

---

## 多 Bundle 启动主流程

和 Android 完全一致：

```
1. Splash 显示（LaunchScreen.storyboard）
2. AppDelegate 中读本地 manifest → 确定 bundle 路径
3. 预热 Instance（后台线程）+ 预请求（网络线程）
4. 用户进入页面 → 取 Instance → loadScript(business) → RCTRootView 渲染
5. 首屏完成后，后台静默检查更新 → 下次启动生效
```

---

## HMR 主流程

和 Android 相同（JS 层 @x-rn/updater 跨平台）。iOS 差异：
- bundle 存储路径：`NSDocumentDirectory` 下的 `xrn/hot/`
- bspatch：链接 C 库（.a 静态库）

---

## CrashGuard

和 Android 逻辑一致（崩溃计数器 + 回退 builtin）。iOS 差异：
- 计数器存 UserDefaults（对应 Android SharedPreferences）
- 系统 Watchdog kill 无法捕获——靠 Sentry App Hang 检测兜底
