# 10. 分层架构

> Android 系统分层 + App 分层 + 快应用框架分层。

## 目录

- [一、Android 系统分层（宏观）](#一android-系统分层宏观)
- [二、Android App 典型分层](#二android-app-典型分层)
- [三、快应用框架的分层架构](#三快应用框架的分层架构)
- [四、各层职责与通信协议](#四各层职责与通信协议)
- [五、和 RN 架构的对比](#五和-rn-架构的对比)
- [六、分层设计的 trade-off](#六分层设计的-trade-off)

---

## 一、Android 系统分层（宏观）

```
┌─────────────────────────────────────────────┐
│            应用层 (Applications)              │
│  系统应用 + 第三方应用 + 快应用框架            │
├─────────────────────────────────────────────┤
│         应用框架层 (Framework)                │
│  ActivityManager / WindowManager /           │
│  PackageManager / NotificationManager /      │
│  ContentProvider / View System               │
├─────────────────────────────────────────────┤
│         运行时层 (ART + 核心库)               │
│  ART 虚拟机 / DEX 执行 / GC /               │
│  Java 核心库 (java.* / android.*)            │
├─────────────────────────────────────────────┤
│         Native 库层 (C/C++)                  │
│  libc / libm / OpenGL ES / Vulkan /         │
│  Media Framework / SQLite / WebKit / V8      │
├─────────────────────────────────────────────┤
│         HAL 层 (Hardware Abstraction)        │
│  Camera HAL / Audio HAL / Sensor HAL /       │
│  Display HAL / Bluetooth HAL                 │
├─────────────────────────────────────────────┤
│         Linux Kernel                         │
│  进程管理 / 内存管理 / 驱动 / Binder IPC     │
└─────────────────────────────────────────────┘
```

### 快应用框架在系统中的位置

快应用框架是**应用层**的一个系统应用，但它向下穿透了多层：
- 应用层：框架本身是一个 APK
- 框架层：使用 ActivityManager、View System、WindowManager
- Native 库层：嵌入 V8 引擎（.so）
- 运行时层：Java 代码跑在 ART 上

### Binder IPC（进程间通信）

Android 的核心 IPC 机制。App 调用系统服务（ActivityManager 等）都走 Binder：

```
App 进程 ←→ Binder Driver（内核）←→ System Server 进程
```

类比前端：类似 postMessage，但是内核级的、高性能的、有权限控制的。

快应用框架涉及 Binder 的场景：
- 启动 Activity（通过 ActivityManager）
- 注册/发送广播
- 访问 ContentProvider
- 和其他进程通信（如果框架有多进程设计）

---

## 二、Android App 典型分层

### 传统 App 分层

```
┌─────────────────────────────────────┐
│          UI 层 (Presentation)        │
│  Activity / Fragment / View /        │
│  Adapter / ViewModel                 │
├─────────────────────────────────────┤
│          业务层 (Domain)             │
│  UseCase / Repository 接口 /         │
│  业务模型 / 业务规则                  │
├─────────────────────────────────────┤
│          数据层 (Data)               │
│  Repository 实现 / Network /         │
│  Database / SharedPreferences        │
├─────────────────────────────────────┤
│          基础设施层 (Infrastructure)  │
│  网络框架 / 数据库框架 / 日志 /       │
│  崩溃收集 / 性能监控                  │
└─────────────────────────────────────┘
```

### 类比前端

| Android | 前端 |
|---------|------|
| Activity/Fragment | Page/Route |
| ViewModel | Store (Pinia/Redux) |
| Repository | Service/API 层 |
| Room/SQLite | IndexedDB/localStorage |
| Retrofit/OkHttp | Axios/fetch |
| Dagger/Hilt (DI) | provide/inject |

---

## 三、快应用框架的分层架构

快应用框架不是普通 App，它是一个**运行时框架**——承载别人写的代码运行。分层更复杂：

```
┌─────────────────────────────────────────────────────────┐
│                   开发者 JS 代码                          │
│  页面逻辑 / 组件 / 样式 / 数据绑定                        │
├─────────────────────────────────────────────────────────┤
│                   JS 框架层                              │
│  虚拟 DOM / Diff 算法 / 组件系统 /                       │
│  生命周期管理 / 数据响应式 / 路由                         │
├─────────────────────────────────────────────────────────┤
│                   Bridge 层                              │
│  J2V8 同步调用 / 渲染指令序列化 /                        │
│  事件回调 / Feature 调用协议                             │
├─────────────────────────────────────────────────────────┤
│                   Native 框架层                          │
│  ┌───────────────┬───────────────┬──────────────────┐  │
│  │  渲染引擎      │  Feature 系统  │  生命周期管理     │  │
│  │  View 创建/更新│  相机/网络/存储│  页面栈/路由      │  │
│  │  布局计算      │  传感器/蓝牙  │  前后台切换       │  │
│  └───────────────┴───────────────┴──────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   引擎层                                 │
│  V8 引擎（libv8.so）/ J2V8 绑定 / JNI                   │
├─────────────────────────────────────────────────────────┤
│                   平台适配层                              │
│  Android View System / Activity 容器 /                   │
│  权限管理 / 系统服务调用                                  │
├─────────────────────────────────────────────────────────┤
│                   Android 系统                           │
└─────────────────────────────────────────────────────────┘
```

### 各层的设计原则

| 层 | 原则 | 原因 |
|---|------|------|
| JS 框架层 | 平台无关 | 同一套 JS 框架代码可以跑在不同平台（Android/鸿蒙） |
| Bridge 层 | 协议标准化 | 渲染指令和 Feature 调用用统一的 JSON 协议，方便扩展 |
| Native 框架层 | 可插拔 | Feature 按需注册，不用的不加载，减少包体 |
| 引擎层 | 可替换 | 理论上可以换成 Hermes/QuickJS（虽然实际绑定了 V8） |
| 平台适配层 | 隔离平台差异 | 上层不直接调 Android API，通过适配层间接调用 |

---

## 四、各层职责与通信协议

### JS → Native 通信（下行）

```
场景1：渲染
  JS diff → 渲染指令 JSON → J2V8 Bridge → IO Thread 解析 → UI Thread 执行

场景2：Feature 调用
  JS: system.fetch(url) → J2V8 同步调用 → Java Feature 实现
    → 同步返回（简单操作）
    → 异步回调（网络/IO 操作）

场景3：路由
  JS: router.push('/page2') → Bridge → Native 页面栈管理 → 创建新 Activity/Fragment
```

### Native → JS 通信（上行）

```
场景1：用户事件
  用户点击 View → UI Thread 采集事件 → Handler 发到 JS Thread → V8 执行事件处理函数

场景2：生命周期
  Activity.onResume() → 通知 JS Thread → V8 执行 onShow() 回调

场景3：系统事件
  网络状态变化 → BroadcastReceiver → 通知 JS Thread → V8 执行回调
```

### 渲染指令协议（核心）

```json
// 创建 View
{ "action": "create", "id": 1, "type": "div", "parentId": 0, "props": {...} }

// 更新属性
{ "action": "update", "id": 1, "props": { "style": { "color": "#333" } } }

// 删除 View
{ "action": "remove", "id": 1 }

// 移动 View（重排序）
{ "action": "move", "id": 1, "parentId": 2, "index": 3 }

// 批量操作（性能优化：一次 Bridge 调用传多条指令）
{ "actions": [ {...}, {...}, {...} ] }
```

### Feature 调用协议

```json
// JS → Native
{
  "module": "system.fetch",
  "method": "fetch",
  "args": { "url": "https://api.example.com", "method": "GET" },
  "callbackId": 42
}

// Native → JS（异步回调）
{
  "callbackId": 42,
  "data": { "status": 200, "body": "..." },
  "error": null
}
```

---

## 五、和 RN 架构的对比

### RN 旧架构（Bridge）

```
JS Thread ←→ Bridge（消息队列 + JSON 序列化）←→ Native Thread
```

问题：
- 所有通信走消息队列，异步延迟
- JSON 序列化/反序列化开销大
- 无法同步获取 Native 数据（比如获取 View 尺寸要等回调）

### RN 新架构（Fabric + JSI + TurboModules）

```
JS Thread ←→ JSI（C++ 同步调用）←→ Native
                                    ├── Fabric（渲染）
                                    └── TurboModules（Feature）
```

改进：
- JSI 同步调用，无序列化
- Fabric 渲染可以在任意线程
- TurboModules 按需加载（类似快应用的 Feature 可插拔）

### 快应用框架的架构

```
JS Thread ←→ J2V8（同步调用）←→ Native
                                 ├── 渲染引擎（IO Thread 解析 + UI Thread 执行）
                                 └── Feature 系统（同步/异步混合）
```

**和 RN 新架构的相似度很高**：
- 都是同步 Bridge（J2V8 ≈ JSI）
- 都是原生渲染（Android View）
- 都有 Feature/Module 的可插拔设计
- 都是三线程模型

**差异**：
- RN 的 JSI 是纯 C++ 层，快应用的 J2V8 多了一层 JNI（Java↔C++）
- RN 的 Fabric 支持并发渲染（多线程），快应用的渲染严格走 UI Thread
- RN 有 Yoga 布局引擎，快应用直接用 Android 原生布局

---

## 六、分层设计的 trade-off

### 层数多 vs 层数少

| | 层数多（快应用框架 6 层） | 层数少（WebView 方案 2 层） |
|---|---|---|
| 优点 | 各层职责清晰、可替换、可测试 | 简单、开发快 |
| 缺点 | 通信开销、复杂度高、调试难 | 耦合重、难扩展、性能差 |

### 同步 Bridge vs 异步 Bridge

| | 同步（J2V8/JSI） | 异步（消息队列） |
|---|---|---|
| 延迟 | 微秒级 | 毫秒级 |
| 吞吐 | 低（阻塞调用线程） | 高（队列缓冲） |
| 适合 | 频繁小调用（事件、属性读取） | 大批量数据传输 |
| 风险 | Native 阻塞会卡 JS | 队列堆积会延迟 |

快应用框架的选择：**同步为主，异步为辅**。
- 渲染指令、事件回调：同步（低延迟）
- 网络请求、文件 IO：异步（不阻塞 JS）

### 平台适配层的价值

```
没有适配层：
  JS 框架层直接调 Android API → 换平台（鸿蒙）要改框架层代码

有适配层：
  JS 框架层 → 标准接口 → 适配层（Android 实现 / 鸿蒙实现）
  换平台只需要新增一个适配层实现，框架层不动
```

这就是为什么快应用框架能同时支持 Android 和鸿蒙——上层 JS 框架和 Bridge 协议不变，只换底层平台适配层。

### 快应用框架分层的核心设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| JS 引擎 | V8 + J2V8 | 性能最好，ES 标准支持全 |
| Bridge 方式 | 同步为主 | 低延迟，适合 UI 交互场景 |
| 渲染方式 | 原生 View | 性能好，系统一致性 |
| 布局方式 | Android 原生布局 | 无额外引擎开销 |
| Feature 设计 | 可插拔注册 | 按需加载，减少包体 |
| 线程模型 | 三线程分离 | JS 不阻塞 UI，IO 不阻塞 JS |
| 平台适配 | 抽象层隔离 | 支持多平台扩展 |
