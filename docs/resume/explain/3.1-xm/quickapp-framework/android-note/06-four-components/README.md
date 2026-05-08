# 06. 四大组件、Fragment 与通知

> Android 应用的核心构建块。

## 目录

- [一、四大组件概览](#一四大组件概览)
- [二、Activity](#二activity)
- [三、Service](#三service)
- [四、BroadcastReceiver](#四broadcastreceiver)
- [五、ContentProvider](#五contentprovider)
- [六、Fragment](#六fragment)
- [七、Notification](#七notification)
- [八、在快应用框架中的应用](#八在快应用框架中的应用)

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

## 二、Activity

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

---

## 三、Service

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

## 四、BroadcastReceiver

### 本质

全局事件监听器。系统或 App 发出广播，注册了对应 IntentFilter 的 Receiver 会被触发。

```java
// 注册监听网络变化
IntentFilter filter = new IntentFilter(ConnectivityManager.CONNECTIVITY_ACTION);
registerReceiver(networkReceiver, filter);

// 接收广播
public class NetworkReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // 网络状态变了
    }
}
```

类比前端：`window.addEventListener('online', handler)` 的系统级版本。

### 常见系统广播

- `BOOT_COMPLETED`：开机完成
- `BATTERY_LOW`：电量低
- `CONNECTIVITY_CHANGE`：网络变化
- `SCREEN_ON/OFF`：屏幕亮灭
- `PACKAGE_ADDED/REMOVED`：App 安装/卸载

---

## 五、ContentProvider

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

---

## 六、Fragment

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

## 七、Notification

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

## 八、在快应用框架中的应用

| 组件 | 在框架中的角色 |
|------|-------------|
| Activity | 快应用页面的容器（每个快应用页面可能是一个 Activity 或 Fragment） |
| Service | 后台任务（推送、预加载、数据同步） |
| BroadcastReceiver | 监听系统事件（网络变化、屏幕亮灭）通知 JS 层 |
| ContentProvider | 暴露快应用数据给其他系统组件 |
| Fragment | 页面内的子视图管理（Tab 页、弹窗） |
| Notification | 快应用推送、前台服务通知 |
