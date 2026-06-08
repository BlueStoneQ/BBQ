# 06. 四大组件、Fragment 与通知

> Android 应用的核心构建块。

## 目录

- [一、四大组件概览](#一四大组件概览)
- [二、AndroidManifest.xml](#二androidmanifestxml)
- [三、Activity](#三activity)
- [四、Service](#四service)
- [五、BroadcastReceiver](#五broadcastreceiver)
- [六、ContentProvider](#六contentprovider)
- [七、Fragment](#七fragment)
- [八、Notification](#八notification)
- [九、在快应用框架中的应用](#九在快应用框架中的应用)

---

## 一、四大组件概览

| 组件 | 职责 | 类比前端 | 生命周期由谁管 |
|------|------|---------|-------------|
| Activity | 一个屏幕/页面 | 一个 Route/Page | 系统（AMS） |
| Service | 后台任务（无 UI） | Web Worker / Service Worker | 系统 |
| BroadcastReceiver | 事件监听（系统/应用广播） | EventListener（全局事件） | 系统 |
| ContentProvider | 跨进程数据共享 | REST API（给其他 App 暴露数据） | 系统 |

**核心特征**：四大组件都必须在 AndroidManifest.xml 里声明，由系统管理生命周期。这是和普通 Java 类的根本区别——你不能 `new Activity()`，只能让系统帮你创建。

---

## 二、AndroidManifest.xml

### 本质

App 的**身份证 + 注册表**。告诉操作系统"这个 App 有什么、需要什么、能做什么"。

安装时系统扫描这个文件，建立"这个 App 能做什么"的索引。运行时系统根据这个索引决定 Intent 匹配、权限检查、组件调度。

### 核心职责

| 职责 | 说明 | 示例 |
|------|------|------|
| 声明所有组件 | 四大组件必须注册，否则系统不认 | `<activity>` / `<service>` / `<receiver>` / `<provider>` |
| 声明权限 | 不声明就用不了对应能力 | `<uses-permission android:name="android.permission.CAMERA" />` |
| 声明应用元信息 | 包名、版本号、SDK 版本、图标、名称、主题 | `<application android:icon="..." android:label="...">` |
| 声明入口 | 哪个 Activity 是启动页 | intent-filter: `action=MAIN` + `category=LAUNCHER` |
| 声明 intent-filter | Deep Link、隐式 Intent 匹配 | `<data android:scheme="myapp" android:host="settings" />` |
| 声明硬件/特性需求 | Google Play 根据这个过滤不兼容设备 | `<uses-feature android:name="android.hardware.camera" />` |

### 类比

| Android | Web/前端 | Electron |
|---------|---------|----------|
| AndroidManifest.xml | package.json + index.html + 权限声明 | package.json + electron-builder.yml + entitlements.plist |

### 快应用框架中的 Manifest

快应用的 `manifest.json` 就是对标 Android 的 `AndroidManifest.xml`——声明页面（路由）、权限、入口、元信息。本质相同，只是格式从 XML 变成了 JSON。

---

## 三、Activity

### 本质

一个 Activity = 一个窗口 + 一个 View 树。用户看到的每个"页面"通常是一个 Activity。

### 生命周期

```
onCreate → onStart → onResume → [用户可交互]
                                    ↓ 被遮挡
                               onPause → onStop → [后台]
                                                    ↓ 被杀/返回
                                               onDestroy
```

类比前端路由：
- `onCreate` ≈ 组件 mounted
- `onResume` ≈ 页面 visible + 可交互
- `onPause` ≈ 页面失去焦点
- `onDestroy` ≈ 组件 unmounted

### 四种状态

| 状态 | 可见 | 可交互 | 在栈中 | 说明 |
|------|------|--------|--------|------|
| **Active (Resumed)** | ✅ | ✅ | ✅ 栈顶 | 用户正在操作的页面 |
| **Paused** | ✅ 部分 | ❌ | ✅ | 被透明/半透明 Activity 遮挡（如弹窗） |
| **Stopped** | ❌ | ❌ | ✅ | 完全不可见，但实例还在内存中 |
| **Destroyed** | ❌ | ❌ | ❌ | 实例销毁，从栈中移除 |

### Activity 栈（Back Stack）

```
栈结构（后进先出）：

  ┌─────────────────┐
  │ SettingsActivity │ ← 栈顶（Active，用户看到的）
  ├─────────────────┤
  │ DeviceActivity   │ ← Stopped（不可见，但还在内存中）
  ├─────────────────┤
  │ HomeActivity     │ ← Stopped
  └─────────────────┘

用户按返回键：
  → SettingsActivity.onDestroy()（出栈销毁）
  → DeviceActivity 回到栈顶 → onRestart → onStart → onResume（变为 Active）
```

**栈顶** = 当前用户看到的 Activity。系统只保证栈顶 Activity 不被回收，栈中其他 Activity 在内存紧张时可能被系统杀掉（会调 onSaveInstanceState 保存状态，恢复时通过 savedInstanceState 还原）。

### 和 RN 多 Bundle 的关系

```
每个 Bundle 对应一个 RNContainerActivity：

栈：[HomeActivity(home.bundle)] → [DeviceActivity(device.bundle)]
                                        ↑ 栈顶，用户看到的

- 栈顶 Activity = Active，RN 实例正在渲染
- 栈中 Activity = Stopped，RN 实例在池中保活（不销毁引擎）
- 按返回键 = 栈顶出栈销毁，下面的回到栈顶（引擎实例仍在池中）
```

### 启动模式（LaunchMode）

| 模式 | 行为 | 场景 |
|------|------|------|
| standard | 每次都创建新实例 | 默认 |
| singleTop | 栈顶复用（不重新创建） | 通知点击打开已有页面 |
| singleTask | 栈内复用（清除上面的） | 主页面 |
| singleInstance | 独占一个任务栈 | 来电界面 |

### Intent（页面间通信）

```java
// 启动另一个 Activity（类比 router.push）
Intent intent = new Intent(this, SecondActivity.class);
intent.putExtra("key", "value");  // 传参
startActivity(intent);
```

类比前端：`router.push({ path: '/second', query: { key: 'value' } })`

**Intent 的能力范围**：Intent 不只是页面跳转，是 Android 的"统一消息信封"：

| 场景 | 用法 | 是否跨应用 |
|------|------|:---:|
| 应用内跳 Activity | 显式 Intent（指定目标类名） | ❌ |
| 启动 Service | `startService(intent)` | ❌ |
| 发送 Broadcast | `sendBroadcast(intent)` | ✅ |
| 分享内容到其他 App | 隐式 Intent（ACTION_SEND） | ✅ |
| **Deep Link（通过 URL 打开指定页面）** | 隐式 Intent（ACTION_VIEW + Uri） | ✅ |

### Intent vs Deep Link

```
关系：
  Intent = 底层通信机制（Android 四大组件都通过它通信）
  Deep Link = Intent 的一种应用场景（通过 URL 唤起 App 指定页面）

  Deep Link 是通过 Intent 实现的，不是并列的两套东西。
```

**Deep Link 实现**：

```xml
<!-- App B 的 AndroidManifest.xml：声明能处理 myapp://settings/* -->
<activity android:name=".SettingsActivity">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="myapp" android:host="settings" />
  </intent-filter>
</activity>
```

```kotlin
// App A 打开 App B 的设置页面
val intent = Intent(Intent.ACTION_VIEW, Uri.parse("myapp://settings/account?tab=privacy"))
startActivity(intent)
// → 系统匹配 intent-filter → 启动 App B 的 SettingsActivity

// App B 的 SettingsActivity 里解析路径
val uri = intent.data  // myapp://settings/account?tab=privacy
val path = uri?.path   // /account
val tab = uri?.getQueryParameter("tab")  // privacy
// → 根据 path 决定跳到哪个子页面
```

**跨平台 Deep Link 对比**：

| 平台 | 机制 | 注册方式 |
|------|------|---------|
| Android | Intent + intent-filter | Manifest 声明 |
| iOS | URL Scheme / Universal Links | Info.plist / apple-app-site-association |
| Electron | Custom Protocol | `app.setAsDefaultProtocolClient('myapp')` |
| Web → App | 同上，`<a href="myapp://...">` 触发 | 同上 |

**共同本质**：都是 URL Scheme 路由——通过 `scheme://host/path?query` 标识目标页面，OS 负责匹配和分发。

---

## 四、Service

### 本质

没有 UI 的后台执行单元。用于需要长时间运行的任务（音乐播放、文件下载、位置追踪）。

### 类型

| 类型 | 说明 | 生命周期 |
|------|------|---------|
| Started Service | 启动后独立运行，完成后自己停止 | startService → onStartCommand → stopSelf |
| Bound Service | 绑定到组件，组件销毁时停止 | bindService → onBind → unbindService |
| Foreground Service | 前台服务（必须显示通知） | 不会被系统轻易杀死 |

### Android 8.0+ 后台限制

系统限制后台 Service 执行时间（防止耗电）。替代方案：
- WorkManager：系统调度的后台任务
- JobScheduler：定时/条件触发的任务
- Foreground Service：必须显示通知，用户可见

---

## 五、BroadcastReceiver

### 本质

全局事件监听器。系统或 App 发出广播，注册了对应 IntentFilter 的 Receiver 会被触发。

**广播是系统级的发布/订阅模式**，天然支持跨应用、跨进程。由 AMS（ActivityManagerService）中转分发。

### 约定机制

发送方和接收方通过 **action 字符串** 匹配（类似事件名/key）：

```kotlin
// ===== App A：发送广播 =====
val intent = Intent("com.example.ACTION_DATA_UPDATED")  // action = 约定的 key
intent.putExtra("count", 42)
sendBroadcast(intent)

// ===== App B：接收广播（需要注册相同的 action）=====
val filter = IntentFilter("com.example.ACTION_DATA_UPDATED")
registerReceiver(myReceiver, filter)

class MyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val count = intent.getIntExtra("count", 0)  // 拿到数据
    }
}
```

> 两个应用要通信：约定同一个 action 字符串即可。类比前端的 `window.addEventListener('my-event')` + `window.dispatchEvent(new CustomEvent('my-event'))`。

### 广播的作用域

| 场景 | 能否收到 | 说明 |
|------|:---:|------|
| 同进程同线程 | ✅ | 最简单 |
| 同进程不同线程 | ✅ | onReceive 回到主线程执行 |
| 同应用不同进程 | ✅ | 走系统 AMS |
| 不同应用 | ✅ | 但 Android 8.0+ 隐式广播受限 |
| 系统广播（电量/网络） | ✅ | 系统发出，所有注册的 App 收到 |

### 注册方式：动态 vs 静态

| 注册方式 | 是否需要 Manifest | App 未启动时能收到 | Android 8.0+ 限制 |
|---------|:---:|:---:|:---:|
| 动态注册 `registerReceiver()` | ❌ 不需要 | ❌ | 无限制 |
| 静态注册 `<receiver>` | ✅ 需要 | ✅（系统唤醒 App） | 隐式广播被禁 |

```kotlin
// 动态注册（代码中，App 运行时生效，App 被杀就收不到）
val filter = IntentFilter("com.example.ACTION_DATA_UPDATED")
registerReceiver(myReceiver, filter)
// → 不需要 Manifest 声明，现在主流用法

// 静态注册（Manifest 中，App 没启动也能被唤醒接收）
// <receiver android:name=".MyReceiver" android:exported="true">
//     <intent-filter>
//         <action android:name="com.example.ACTION_DATA_UPDATED" />
//     </intent-filter>
// </receiver>
// → Android 8.0+ 大部分隐式广播禁止静态注册（省电策略）
```

> 现在基本都用动态注册。静态注册的场景只剩少数系统广播（如 `BOOT_COMPLETED`）。

### Android 8.0+ 限制

隐式广播不能在 Manifest 静态注册了（省电）。跨应用广播需要：
- 动态注册（`registerReceiver`）
- 或指定目标包名（显式广播）

应用内广播替代方案：EventBus / Kotlin Flow / LiveData（不走系统 AMS，性能更好）。

### 常见系统广播

- `BOOT_COMPLETED`：开机完成
- `BATTERY_LOW`：电量低
- `CONNECTIVITY_CHANGE`：网络变化
- `SCREEN_ON/OFF`：屏幕亮灭
- `PACKAGE_ADDED/REMOVED`：App 安装/卸载

---

## 六、ContentProvider

### 本质

跨进程的数据访问接口。一个 App 通过 ContentProvider 把自己的数据暴露给其他 App。

```
App A（数据提供者）
  ContentProvider（暴露数据）
      ↕ Binder IPC
App B（数据消费者）
  ContentResolver（查询数据）
```

类比：App A 提供了一个 REST API，App B 通过 HTTP 调用。ContentProvider 就是 Android 的"进程间 REST API"。

### URI 寻址

```
content://com.example.provider/users/123
  ↑ scheme    ↑ authority          ↑ path
```

类比 URL：`https://api.example.com/users/123`

### 最小示例

```kotlin
// ===== App A（数据提供者）：定义 ContentProvider =====
// ContentProvider 是抽象基类（abstract class），以下 6 个方法必须全部实现（标准 CRUD 接口）
class UserProvider : ContentProvider() {
    override fun query(uri: Uri, ...): Cursor {
        // 根据 URI 查询数据，返回 Cursor
        val id = uri.lastPathSegment  // "123"
        return db.query("users", selection = "id = ?", selectionArgs = arrayOf(id))
    }
    override fun insert(uri: Uri, values: ContentValues?): Uri { ... }
    override fun update(...): Int { ... }
    override fun delete(...): Int { ... }
    override fun getType(uri: Uri): String = "vnd.android.cursor.item/user"
    override fun onCreate(): Boolean = true
}

// Manifest 中注册（必须）
// <provider android:name=".UserProvider"
//           android:authorities="com.example.provider"
//           android:exported="true" />


// ===== App B（数据消费者）：通过 ContentResolver 查询 =====
val uri = Uri.parse("content://com.example.provider/users/123")
val cursor = contentResolver.query(uri, null, null, null, null)
cursor?.use {
    if (it.moveToFirst()) {  // Cursor 移动到第一行（有数据则返回 true）
        val name = it.getString(it.getColumnIndex("name"))  // 按列名取值
    }
}
```

本质就是 CRUD 接口——Provider 提供增删改查，Resolver 通过 URI 调用。底层走 Binder IPC 跨进程。

---

## 七、Fragment

### 本质

Activity 内的"子页面"。一个 Activity 可以包含多个 Fragment，Fragment 有自己的生命周期和 View。

类比前端：Fragment ≈ 一个有独立生命周期的组件（类似 Vue 的 `<keep-alive>` 组件）。

### 为什么需要 Fragment

- 平板适配：大屏幕一个 Activity 里放两个 Fragment（列表 + 详情）
- 页面内导航：ViewPager + Fragment（Tab 切换）
- 代码复用：同一个 Fragment 可以放在不同 Activity 里

### 生命周期

Fragment 的生命周期嵌套在 Activity 里：

```
Activity.onCreate
  → Fragment.onAttach → onCreate → onCreateView → onViewCreated
Activity.onStart
  → Fragment.onStart
Activity.onResume
  → Fragment.onResume
```

### Fragment 通信

| 方式 | 说明 |
|------|------|
| ViewModel 共享 | 同一个 Activity 下的 Fragment 共享 ViewModel |
| Fragment Result API | Fragment 之间传递结果 |
| Interface 回调 | Fragment 定义接口，Activity 实现 |
| Navigation Component | Jetpack 导航组件 |

---

## 八、Notification

### 本质

系统级的消息通知，显示在通知栏。App 通过 NotificationManager 发送。

### 核心概念

| 概念 | 说明 |
|------|------|
| NotificationChannel | 通知分类（Android 8.0+必须），用户可以按 Channel 关闭通知 |
| PendingIntent | 点击通知后的动作（打开 Activity / 发送广播） |
| Notification.Builder | 构建通知内容（标题/内容/图标/动作按钮） |
| Foreground Service | 前台服务必须绑定一个通知 |

### 快应用框架的通知场景

- 快应用推送通知
- 前台服务通知（如果框架有后台保活需求）
- 下载进度通知

---

## 九、在快应用框架中的应用

| 组件 | 在框架中的角色 |
|------|-------------|
| Activity | 快应用页面的容器（每个快应用页面可能是一个 Activity 或 Fragment） |
| Service | 后台任务（推送、预加载、数据同步） |
| BroadcastReceiver | 监听系统事件（网络变化、屏幕亮灭）通知 JS 层 |
| ContentProvider | 暴露快应用数据给其他系统组件 |
| Fragment | 页面内的子视图管理（Tab 页、弹窗） |
| Notification | 快应用推送、前台服务通知 |
