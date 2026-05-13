# Session Note

> 对话中的重要知识点和考点，问题驱动。定期整理到 explain/ 后清空。

---

## 2026-05-13

### Android 进程优先级（OOM adj）

**Q: 前台/后台运行的概念是什么？**

Android 系统对进程按优先级分类：
- **Foreground**：正在与用户交互（Activity 可见且获得焦点）
- **Visible**：可见但不在前台（如被对话框遮挡）
- **Perceptible**：用户能感知的后台操作（播放音乐、导航）
- **Previous**：用户刚离开的进程，保留以便快速切回
- **Cached**：完全不活跃，系统随时可杀
- **Heavy Weight**：重量级进程

优先级影响：
- 系统内存不足时按优先级从低到高杀进程
- OOM adj 值越小优先级越高（Foreground=0, Cached=900+）
- 进程状态变化会改变内存占用（Foreground 时 JS 引擎、View 树都在内存中）

### Widget 机制与进程拉起

**Q: 桌面小部件（AppWidget）是怎么触发进程启动的？**

链路：
1. 系统定时发送 `APPWIDGET_UPDATE` 广播
2. `AppWidgetProvider.onReceive()` 被触发（运行在 widgetProvider 进程）
3. `onUpdate()` → `AppWidgetService.enqueueWork()` 加载数据、更新 RemoteViews
4. Widget 上的点击通过 `PendingIntent.getBroadcast()` 设置
5. 用户点击 → 发送广播 → `appWidgetItemClick()` → `startActivity()`

关键点：
- Widget 运行在独立进程（`:widgetProvider`）
- `RemoteViews` 是跨进程的 View 描述，不是真正的 View 对象
- `PendingIntent` 允许其他进程代替你执行操作
- Widget 更新可以触发进程从 idle → background → foreground

### Service 绑定与进程保活

**Q: 应用市场是怎么拉起快应用框架的？**

通过 Bound Service（AIDL）：
1. 应用市场调用 `bindService()` 绑定 `HostService`
2. `HostService.onBind()` 返回 `IHostRequest.Stub` 实例
3. 应用市场通过 AIDL 接口调用 `startMina()`/`startHybridApp()` 等方法
4. 只要 ServiceConnection 存在，hybrid 进程就不会被杀

关键点：
- Bound Service 的生命周期跟随绑定者
- AIDL 实现跨进程方法调用（底层是 Binder IPC）
- `Binder.getCallingUid()` 可以获取调用方身份做权限校验

### 多进程架构设计

**Q: 为什么快应用框架要用多进程（Launcher0~4）？**

原因：
1. **内存隔离**：每个快应用运行在独立进程，一个崩溃不影响其他
2. **并发运行**：最多 5 个快应用同时运行
3. **资源回收**：系统可以独立回收单个快应用的进程
4. **V8 引擎限制**：V8 是单线程的，多进程才能并行执行多个 JS 应用

进程分配算法（`Launcher.select()`）：
- 通过 ContentProvider 查询数据库（LauncherTable）
- 为每个快应用包名分配一个 Launcher 槽位（0~4）
- 优先复用已有槽位，避免频繁创建进程

### 跨端框架通信本质

**Q: JS 和 Native 之间是怎么通信的？**

快应用用的是 **V8 引擎直接绑定**（JSI 方案）：
- 不走 WebView，直接嵌入 V8 引擎
- 通过 J2V8 库将 Java 方法注册到 V8 全局环境
- JS 调用时直接跨语言调用，不需要 URL 编解码

三种跨端通信方案对比：
| 方案 | 代表 | 优点 | 缺点 |
|------|------|------|------|
| URL Schema 拦截 | 早期 Hybrid | 简单 | URL 长度限制、单向、需编解码 |
| @JavascriptInterface | WebView | 双向 | 安全风险、依赖 WebView |
| V8/JSC 直接绑定 | 快应用/RN JSI | 高性能、同步调用 | 实现复杂 |

### 渲染流水线

**Q: JS 的虚拟 DOM 是怎么变成屏幕上的 Native View 的？**

三级管线：
1. **编译时**：.ux 模板 → JSON 模板树（$app_template$）→ RPK 包
2. **运行时 JS 层**：infras.js 构建虚拟 DOM → Listener 封装 Action → Streamer 批量发送 → `callNative()`
3. **运行时 Native 层**：RenderActionManager（IO 线程解析 JSON）→ VDomActionApplier（主线程应用 View 变更）→ ComponentFactory 创建 Android View

关键设计：
- Action 批量发送（50 条阈值），减少 Bridge 调用次数
- JSON 解析在 IO 线程，不阻塞 UI
- 组件注册表通过 `@WidgetAnnotation` 注解 + APT 生成

### Feature 调用机制

**Q: `system.device.getInfo()` 从 JS 到 Native 的完整链路？**

核心是**回调 ID 映射机制**：
1. JS 侧：`invokeNative()` 分离回调函数，存入 `_callbacks[cbId]`，只传 cbId 给 Native
2. Bridge：`JsBridge.invoke()` → V8 直接调用 Java 的 `ExtensionManager.invoke()`
3. Native：`ExtensionManager` 查找 Feature → 权限检查 → 调用 `Device.getInfo()`
4. 回调：`request.getCallback().callback(response)` → `JsInvocation` 序列化 → `postExecuteFunction("execInvokeCallback")` → JS 侧根据 cbId 找到回调执行

三种调用模式：SYNC（同步返回）、ASYNC（异步+回调）、CALLBACK（异步+Promise）
