# 15. 权限系统

> 运行时权限模型、权限分组、动态申请流程。

## 目录

- [一、权限模型](#一权限模型)
- [二、运行时权限（Android 6.0+）](#二运行时权限android-60)
- [三、权限分组](#三权限分组)
- [四、特殊权限](#四特殊权限)
- [五、快应用框架的权限处理](#五快应用框架的权限处理)

---

## 一、权限模型

### 权限分类

| 类型 | 说明 | 授予方式 | 示例 |
|------|------|---------|------|
| 普通权限 | 不涉及用户隐私 | 安装时自动授予 | INTERNET、VIBRATE |
| 危险权限 | 涉及用户隐私 | 运行时动态申请 | CAMERA、LOCATION、CONTACTS |
| 签名权限 | 只有相同签名的 App 能获取 | 系统自动授予 | BIND_NOTIFICATION_LISTENER |
| 特殊权限 | 需要用户在设置里手动开启 | 引导用户到设置页 | SYSTEM_ALERT_WINDOW、WRITE_SETTINGS |

---

## 二、运行时权限（Android 6.0+）

### 申请流程

```
检查权限 → 已授予？→ 直接使用
              ↓ 未授予
         是否需要解释？→ 显示解释对话框
              ↓
         requestPermissions()
              ↓
         系统弹出权限对话框
              ↓
         用户选择（允许 / 拒绝 / 不再询问）
              ↓
         onRequestPermissionsResult() 回调
```

### 代码示例

```kotlin
// 检查权限
if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
    != PackageManager.PERMISSION_GRANTED) {
    
    // 是否需要解释（用户之前拒绝过）
    if (shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)) {
        showRationaleDialog()
    }
    
    // 申请权限
    requestPermissions(arrayOf(Manifest.permission.CAMERA), REQUEST_CODE)
}

// 结果回调
override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
    if (grantResults[0] == PackageManager.PERMISSION_GRANTED) {
        // 授予了，开始使用相机
    } else {
        // 拒绝了，降级处理
    }
}
```

### "不再询问"的处理

用户勾选"不再询问"后，`requestPermissions()` 不会再弹系统对话框，直接返回拒绝。此时只能引导用户去系统设置里手动开启。

---

## 三、权限分组

| 权限组 | 包含的权限 |
|--------|-----------|
| CALENDAR | READ_CALENDAR, WRITE_CALENDAR |
| CAMERA | CAMERA |
| CONTACTS | READ_CONTACTS, WRITE_CONTACTS, GET_ACCOUNTS |
| LOCATION | ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION |
| MICROPHONE | RECORD_AUDIO |
| PHONE | READ_PHONE_STATE, CALL_PHONE, READ_CALL_LOG |
| SENSORS | BODY_SENSORS |
| SMS | SEND_SMS, RECEIVE_SMS, READ_SMS |
| STORAGE | READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE |

**注意**：Android 11+ 权限更细化，不再按组授予。每个权限独立申请。

---

## 四、特殊权限

| 权限 | 用途 | 申请方式 |
|------|------|---------|
| SYSTEM_ALERT_WINDOW | 悬浮窗 | 引导到设置页 |
| WRITE_SETTINGS | 修改系统设置 | 引导到设置页 |
| REQUEST_INSTALL_PACKAGES | 安装 APK | 引导到设置页 |
| MANAGE_EXTERNAL_STORAGE | 完全文件访问（Android 11+） | 引导到设置页 |

系统预装应用（快应用框架）可以直接拥有这些权限，不需要用户手动开启。

---

## 五、快应用框架的权限处理

### 框架层面

快应用框架作为系统预装应用，拥有系统级权限。但开发者的快应用需要的权限，框架需要代为申请：

```
开发者声明需要相机权限
  ↓ 快应用 manifest 声明
框架运行时检查权限
  ↓ 未授予
框架代为弹出权限申请对话框
  ↓ 用户授予
框架调用相机 Feature
  ↓ 返回结果给 JS
```

### 权限和 Feature 的关系

每个 Feature（相机/位置/通讯录等）对应一组权限。框架在调用 Feature 前自动检查和申请权限，开发者不需要手动处理。

类比前端：浏览器的 `navigator.mediaDevices.getUserMedia()` 会自动弹出权限请求，开发者不需要手动调用权限 API。
