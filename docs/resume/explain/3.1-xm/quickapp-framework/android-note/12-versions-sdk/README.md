# 12. Android 版本与 SDK

> 版本演进、API Level 映射、主要特性、兼容性评估。

## 目录

- [一、版本与 API Level 映射](#一版本与-api-level-映射)
- [二、关键版本的重大变更](#二关键版本的重大变更)
- [三、SDK 版本配置](#三sdk-版本配置)
- [四、兼容性处理](#四兼容性处理)

---

## 一、版本与 API Level 映射

| Android 版本 | API Level | 代号 | 发布年份 | 市场占有率（2025） |
|-------------|-----------|------|---------|-----------------|
| 5.0-5.1 | 21-22 | Lollipop | 2014 | <1% |
| 6.0 | 23 | Marshmallow | 2015 | ~2% |
| 7.0-7.1 | 24-25 | Nougat | 2016 | ~3% |
| 8.0-8.1 | 26-27 | Oreo | 2017 | ~5% |
| 9.0 | 28 | Pie | 2018 | ~7% |
| 10 | 29 | Q | 2019 | ~10% |
| 11 | 30 | R | 2020 | ~15% |
| 12 | 31-32 | S | 2021 | ~15% |
| 13 | 33 | T | 2022 | ~18% |
| 14 | 34 | U | 2023 | ~15% |
| 15 | 35 | V | 2024 | ~10% |

---

## 二、关键版本的重大变更

| 版本 | 变更 | 对开发者的影响 |
|------|------|-------------|
| **6.0 (API 23)** | 运行时权限 | 不能在安装时一次性获取所有权限，需要运行时动态申请 |
| **7.0 (API 24)** | FileProvider | 不能直接暴露 file:// URI 给其他 App |
| **8.0 (API 26)** | 后台限制 + 通知 Channel | 后台 Service 受限，通知必须指定 Channel |
| **9.0 (API 28)** | 非 SDK 接口限制 | 不能通过反射调用系统隐藏 API |
| **10 (API 29)** | 分区存储 | 不能直接访问外部存储，需要 MediaStore |
| **11 (API 30)** | 包可见性 | 不能查询所有已安装 App，需要声明 `<queries>` |
| **12 (API 31)** | 精确闹钟权限 + 蓝牙权限细化 | 需要新权限 |
| **13 (API 33)** | 通知权限 | 发送通知需要 POST_NOTIFICATIONS 权限 |
| **14 (API 34)** | 前台服务类型必须声明 | foregroundServiceType 必填 |

---

## 三、SDK 版本配置

```groovy
android {
    compileSdk 34      // 编译时用的 SDK（决定能用哪些 API）
    defaultConfig {
        minSdk 21      // 最低支持版本（低于此版本的设备不能安装）
        targetSdk 34   // 目标版本（系统按此版本的行为运行 App）
    }
}
```

### 三个版本的关系

| 配置 | 含义 | 影响 |
|------|------|------|
| `compileSdk` | 编译时能看到哪些 API | 只影响编译，不影响运行 |
| `minSdk` | 最低支持的设备版本 | 低于此版本的设备无法安装 |
| `targetSdk` | 告诉系统"我适配到了哪个版本" | 系统按此版本的行为约束 App |

**targetSdk 的坑**：如果 targetSdk=28，即使运行在 Android 12 上，系统也不会强制执行 Android 12 的新限制（如分区存储）。但 Google Play 要求 targetSdk 必须跟上最新版本。

---

## 四、兼容性处理

### 版本判断

```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    // Android 8.0+ 的代码（通知 Channel）
    createNotificationChannel()
} else {
    // 旧版本的兼容代码
    sendNotificationLegacy()
}
```

### AndroidX / Jetpack 的兼容层

Jetpack 库帮你处理了大部分兼容性问题：
- `NotificationCompat`：自动处理不同版本的通知 API
- `ActivityCompat`：自动处理权限申请
- `FileProvider`：自动处理文件 URI 共享

### 快应用框架的兼容性考量

- `minSdk 21`（Android 5.0）：覆盖 99%+ 设备
- V8 引擎的 so 库需要适配不同 ABI（armeabi-v7a / arm64-v8a）
- 不同 Android 版本的 View 行为可能不同（需要适配测试）
- 权限模型变化影响 Feature 实现（6.0+ 运行时权限）
