# iOS vs Android 平台差异（RN 开发者视角）

> RN 架构师需要知道的关键差异——不是要成为 iOS 开发者，而是能做跨端技术判断。

---

## 目录

- [核心差异总览](#核心差异总览)
- [1. 权限模型](#1-权限模型)
- [2. 后台执行](#2-后台执行)
- [3. 推送通知](#3-推送通知)
- [4. 蓝牙（BLE）差异](#4-蓝牙ble差异)
- [5. 导航与手势](#5-导航与手势)
- [6. 渲染与布局差异](#6-渲染与布局差异)
- [7. 存储](#7-存储)
- [8. 构建与签名](#8-构建与签名)
- [9. 热更新差异](#9-热更新差异)
- [10. 性能差异](#10-性能差异)
- [RN 开发中的双端适配实践](#rn-开发中的双端适配实践)

---

## 核心差异总览

| 维度 | iOS | Android |
|------|-----|---------|
| **权限** | 首次请求弹窗，用户拒绝后只能去设置手动开 | 可以多次请求，有"不再询问"选项 |
| **后台执行** | 严格限制（挂起后几秒内被杀） | 相对宽松（Service/前台服务可长期跑） |
| **推送** | APNs（Apple Push Notification service） | FCM（Firebase Cloud Messaging） |
| **蓝牙** | CoreBluetooth，后台扫描需声明 | Android BLE API，权限更复杂（位置权限） |
| **手势** | 系统级左滑返回（必须保留） | 物理/虚拟返回键 |
| **状态栏** | 动态岛/刘海/安全区 | 各厂商异形屏 |
| **构建** | Xcode + CocoaPods/SPM | Gradle + AAR/Maven |
| **签名** | 证书 + Provisioning Profile + Entitlements | KeyStore 签名 |
| **发布** | App Store（审核严格 1-7 天） | Google Play（审核快，通常几小时） |
| **热更新** | 允许 JS Bundle 更新（不能更新原生代码） | 同 iOS（CodePush/自建） |
| **JS 引擎** | Hermes（RN 0.70+ 默认） | Hermes（同） |

---

## 1. 权限模型

### iOS

```
特点：一次机会原则
- 首次请求弹窗（系统级，不能自定义 UI）
- 用户拒绝 → 再也不会弹（只能引导去"设置"手动开）
- 必须在 Info.plist 声明用途说明（NSBluetoothAlwaysUsageDescription 等）
- 审核时如果没写清楚用途 → 拒审

RN 中的处理：
- 先调 check() 看当前状态
- 状态是 "not-determined" 才调 request()
- 状态是 "denied" 就显示引导 UI → Linking.openSettings()
```

### Android

```
特点：分级权限
- 普通权限：安装时自动授予（INTERNET 等）
- 危险权限：运行时弹窗请求（相机/位置/蓝牙）
- Android 12+ BLE 需要 BLUETOOTH_SCAN + BLUETOOTH_CONNECT（不再需要位置权限）
- 用户可以选"仅本次"/"始终允许"/"拒绝"/"不再询问"

RN 中的处理：
- react-native-permissions 统一 API
- Android 需要在 AndroidManifest.xml 声明
```

### 关键差异对 RN 架构的影响

BLE IoT 场景下：
- iOS 只需要蓝牙权限
- Android 12 以下还需要位置权限（因为 BLE 扫描能定位）
- 权限请求逻辑要**按平台分支处理**

---

## 2. 后台执行

### iOS（严格）

```
App 进入后台 → 约 5-10 秒后被挂起（suspended）
挂起后不执行任何代码

例外（需声明 Background Modes）：
- 蓝牙通信（bluetooth-central）← IoT 必需！
- 后台音频
- 定位更新
- 远程推送
- Background Fetch（系统决定何时唤醒，不可控）

即使声明了 bluetooth-central：
- 可以在后台继续收发 BLE 数据
- 但扫描行为受限（不能指定 UUID 外的广播）
- 内存压力大时系统仍可能杀进程
```

### Android（宽松）

```
- Service 可以长期后台运行
- 前台服务（ForegroundService）+ 通知 → 几乎不被杀
- WorkManager 可以调度后台任务
- Android 12+ 限制了后台启动前台服务的场景

IoT 场景：
- 用 ForegroundService 保持 BLE 连接
- 配合持久通知（"设备已连接"）
```

### 对 RN 架构的影响

IoT App 必须处理的问题：
- iOS 后台保活：声明 bluetooth-central + 监听系统唤醒事件
- Android 后台保活：ForegroundService + 电池优化白名单
- **RN JS 层在后台可能不执行**→ 关键逻辑（BLE 心跳/重连）要放在 Native 层

---

## 3. 推送通知

| | iOS（APNs） | Android（FCM） |
|--|------------|---------------|
| 注册 | deviceToken 从 APNs 获取 | registrationToken 从 FCM 获取 |
| 服务端 | 发给 APNs 服务器 | 发给 FCM 服务器 |
| 库 | @react-native-firebase/messaging | 同 |
| 权限 | 需要显式请求通知权限 | Android 13+ 才需要请求 |
| 静默推送 | content-available: 1 | data message（无 notification 字段） |

---

## 4. 蓝牙（BLE）差异

> IoT 岗位核心考点。

| 维度 | iOS（CoreBluetooth） | Android（android.bluetooth） |
|------|---------------------|----------------------------|
| 权限 | 只需蓝牙权限 | Android 12 以下还需位置权限 |
| 后台扫描 | 声明 bluetooth-central 后可以，但受限 | ForegroundService 保活 |
| MTU 协商 | 系统自动协商（默认 185） | 需手动调 requestMtu()（默认 23→协商到 512） |
| 连接数 | 系统限制约 7-8 个 | 厂商差异大（4-15 个） |
| 配对 | 系统弹窗（不能自定义） | 可以自定义配对 UI |
| 重连 | retrievePeripherals() 恢复已知设备 | 需自己维护设备列表 |
| 扫描过滤 | 按 serviceUUID 过滤 | 按 serviceUUID / name / address 过滤 |

### RN 中的 BLE 库

- `react-native-ble-plx`：最流行，API 统一
- `react-native-bluetooth-le`：较新
- 自写 TurboModule：性能最好，控制最精细

---

## 5. 导航与手势

| | iOS | Android |
|--|-----|---------|
| 返回 | 左滑手势返回（系统级，必须保留） | 物理/虚拟返回键 |
| 导航转场 | iOS 风格（从右滑入） | Material 风格（从底部弹出） |
| 底部 Tab | 放底部（iOS 规范） | 可底部可顶部 |
| 安全区 | SafeAreaView 处理刘海/动态岛 | 状态栏 + 导航栏 + 异形屏 |

RN 中：`react-navigation` 自动处理大部分差异，但需要注意 `gestureEnabled` 和平台特定动画。

---

## 6. 渲染与布局差异

| | iOS | Android |
|--|-----|---------|
| 字体 | San Francisco（系统默认） | Roboto（系统默认） |
| 阴影 | `shadowColor/shadowOffset/shadowRadius` | `elevation`（Android 特有） |
| 涟漪效果 | 无（用 opacity 反馈） | TouchableNativeFeedback + ripple |
| 刘海/圆角 | SafeAreaView + 动态岛 | WindowInsets + 各厂商适配 |
| 渲染引擎 | Core Animation | SurfaceView/TextureView |

---

## 7. 存储

| 方案 | iOS | Android |
|------|-----|---------|
| KV 存储 | UserDefaults / Keychain | SharedPreferences / EncryptedSharedPreferences |
| 数据库 | SQLite / Core Data | SQLite / Room |
| 文件 | Documents / Library | Internal / External Storage |
| 安全存储 | Keychain（硬件加密） | Android Keystore + EncryptedFile |
| RN 统一 | react-native-mmkv（推荐） | 同 |

---

## 8. 构建与签名

### iOS

```
工具链：Xcode + CocoaPods (or SPM)
签名体系：
  - 开发证书 + 发布证书
  - Provisioning Profile（绑定 App ID + 设备 + 证书）
  - Entitlements（声明能力：BLE/Push/Background 等）
构建产物：.ipa 文件
CI：xcodebuild + fastlane
```

### Android

```
工具链：Android Studio + Gradle
签名体系：
  - KeyStore 文件（.jks/.keystore）
  - 签名配置在 build.gradle
构建产物：.apk / .aab（App Bundle，Google Play 推荐）
CI：./gradlew assembleRelease
```

---

## 9. 热更新差异

| | iOS | Android |
|--|-----|---------|
| 规则 | Apple 允许更新 JS Bundle（不能改原生代码）| 同 |
| 审核风险 | 如果热更新改变了 App 核心功能 → 可能被拒审 | Google Play 限制较松 |
| 方案 | CodePush / 自建（下载 bundle → 替换 → 重启） | 同 |
| 全量更新 | App Store 审核 1-7 天 | Google Play 几小时 |

---

## 10. 性能差异

| 维度 | iOS | Android |
|------|-----|---------|
| JS 引擎 | Hermes（统一） | Hermes（统一） |
| 启动 | 通常更快（硬件统一、系统优化好） | 碎片化严重，低端机启动慢 |
| 内存 | 系统更积极杀后台 App（内存管理严格） | OOM Killer，但阈值更高 |
| 动画 | Core Animation 硬件加速好 | 需要 `useNativeDriver: true` |
| 列表 | UITableView/UICollectionView 优化成熟 | RecyclerView，FlashList 映射到这里 |
| 包体 | App Thinning 自动按设备裁剪 | ABI Split / App Bundle |

---

## RN 开发中的双端适配实践

```typescript
import { Platform } from 'react-native';

// 1. 平台判断
if (Platform.OS === 'ios') { ... }
if (Platform.OS === 'android') { ... }

// 2. 平台特定文件
// Component.ios.tsx / Component.android.tsx
// RN 自动按平台选择

// 3. 平台特定样式
const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
    android: { elevation: 4 },
  }),
});

// 4. 平台特定权限请求
async function requestBLEPermission() {
  if (Platform.OS === 'ios') {
    return request(PERMISSIONS.IOS.BLUETOOTH);
  }
  if (Platform.Version >= 31) { // Android 12+
    return requestMultiple([
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
    ]);
  }
  return request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION); // Android 11-
}
```

### 架构建议

- **UI 差异**：用 Platform.select 或平台文件分离，保持逻辑统一
- **原生模块**：TurboModule 两端都要实现（Android Java + iOS ObjC/Swift）
- **权限**：封装统一的 Permission Manager，内部按平台分支
- **后台**：BLE 保活逻辑放 Native 层，JS 层只做 UI 和业务
