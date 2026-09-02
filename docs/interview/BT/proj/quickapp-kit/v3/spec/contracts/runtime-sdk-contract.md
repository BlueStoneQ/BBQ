# QuickApp Kit Runtime SDK Contract

## 目录

- [1. 结论](#1-结论)
- [2. 本质与边界](#2-本质与边界)
- [3. 交付形态](#3-交付形态)
- [4. 统一生命周期 API](#4-统一生命周期-api)
- [5. 线程与所有权](#5-线程与所有权)
- [6. 平台映射](#6-平台映射)
- [7. 安全合同](#7-安全合同)
- [8. 验收](#8-验收)
- [9. 平台 Agent 任务](#9-平台-agent-任务)
- [10. 不做什么](#10-不做什么)

## 1. 结论

QuickApp Kit Runtime 是一个可嵌入的 SDK，不是一个固定 APK 或独立应用。

三个平台共享同一组运行语义：

```text
Host
  -> Platform SDK Facade
  -> JS Runtime + C++ Core
  -> Platform Adapter
  -> Native Host
```

Android、iOS、嵌入式的公开 API 语义必须一致；调用语法可以分别符合 Java/Kotlin、Swift/Objective-C 和 C 的习惯。

`quickapp-store` 只是本地 RPK 选择、列表和展示宿主，不是 Runtime 的组成部分，也不是商业应用商店。

## 2. 本质与边界

### 2.1 SDK 负责什么

- 创建和销毁一个 Runtime 实例。
- 校验、加载和关闭 RPK。
- 管理 JS Runtime、C++ Core、唯一 Runtime Tree、Navigation 和 Lifecycle。
- 将 Core 的渲染意图提交给 Platform Adapter。
- 将平台输入送入 Core Event Router。
- 注册和调用 typed Feature Provider。
- 在销毁后拒绝晚到任务、事件和回调。

### 2.2 Host 负责什么

- 提供显示容器或显示设备。
- 选择本地 RPK 或受控 RPK 数据源。
- 转发宿主生命周期和原始输入。
- 展示 SDK 状态、错误和调试信息。
- 在结束时调用 Runtime 销毁。

Host 不得维护页面栈、业务状态、Runtime Tree、NodeId、Bridge 旁路或平台私有路由。

### 2.3 内部边界

```text
公共 SDK Facade
  -> Platform Gateway
  -> Runtime Composition Root
  -> JS Runtime / C++ Core
  -> Platform Adapter
```

- Core 不依赖 Android、UIKit、LVGL、JNI 或 libuv。
- JS 不直接调用平台对象，只通过 typed ABI 和 Feature Registry。
- Platform Adapter 不创建第二棵 Runtime Tree、第二套路由或第二套 Bridge。
- RPK 不携带或执行外部原生代码。

### 2.4 JS Framework 与 C++ JS Runtime Service

两者是不同的架构部件：

| 部件 | 本质 | 负责什么 | 不负责什么 |
| --- | --- | --- | --- |
| JS Framework Bundle | 随 RPK 或 Runtime Profile 提供的 JS 运行时程序 | Proxy/Watcher、组件语义、生命周期 Hook、事件注册、Handler、RenderIntent 和 microtask flush | 创建 JS 引擎、管理 C++ 线程、直接访问平台对象 |
| C++ JS Runtime Service | `quickapp-runtime-js` 中的 C++ 承载服务 | 创建/销毁 JS Engine、加载 Bundle 和应用 JS、驱动 EventLoop、执行任务与 microtask、提供 Native Binding | 业务状态、组件布局、Runtime Tree、Platform View |

最终决策：

1. JS Framework 作为独立可版本化的 Bundle 管理，但当前不拆成独立代码仓库；代码目录仍沿用现有 `quickapp-runtime-js` 项目边界。
2. C++ JS Runtime Service 保留为独立承载层，并作为 Runtime 必选服务；它不属于 C++ Kernel，也不等同于 JS Framework。
3. 加载顺序固定为：创建 JS Runtime Service -> 加载并校验 JS Framework Bundle -> 加载 App/Shared/Page 应用模块 -> 执行 Bootstrap。
4. Framework Bundle 只依赖 `JsEnginePort`、Runtime ABI 和已冻结的 JS Framework 合同；不得依赖 QuickJS 类型、Platform 类型或具体 EventLoop Backend。
5. C++ Service 只提供 Engine、Executor、Module Loader、Native Binding 和生命周期驱动；不向 Framework 注入业务页面逻辑。
6. Bundle 兼容性由现有 Artifact、JS Bootstrap、Runtime ABI 和 Engine Port 合同共同约束；本决策不新增私有字段或第二套 ABI。
7. 本阶段只冻结命名、职责和加载顺序，不做目录迁移、代码拆分或主链重构。

```text
Framework Bundle
  -> JsEnginePort / Runtime ABI
  -> C++ JS Runtime Service
  -> C++ Core
```

因此，三个平台 SDK 只需选择同一套 Framework Bundle 和 JS Service 组合；Android/iOS/LVGL 不得各自维护一份 Framework 语义。

## 3. 交付形态

| 平台 | 核心交付物 | 公共入口 | 宿主形态 |
| --- | --- | --- | --- |
| Android | `quickapp-runtime-android.aar`，内含 JNI `.so` | Java/Kotlin | 最小 Host APK |
| iOS | `QuickAppKit.xcframework` | Swift，兼容 Objective-C | 最小 Host App |
| 嵌入式/LVGL | `libquickapp_runtime.a`；Linux 等支持动态链接时可选 `.so` | 稳定 C ABI | 固件、设备应用或 Simulator |

LVGL/嵌入式的主交付物应是静态库 `.a`：ESP32-S3 等设备通常没有动态链接器，编译期链接最可靠、可裁剪性最好。`.so` 仅作为具备动态加载能力的嵌入式 Linux 或桌面环境的可选交付，不改变 C ABI。

三个 SDK 都不内置正式业务 RPK。RPK 属于调用方或 Host 的输入资源。

## 4. 统一生命周期 API

以下是跨平台语义合同，不要求三个平台使用完全相同的函数签名。

```text
create(configuration) -> RuntimeHandle | typed error
loadRpk(source, callback) -> accepted | typed error
attachSurface(surface, callback) -> accepted | typed error
dispatchInput(input) -> accepted | typed error
updateLifecycle(signal) -> accepted | typed error
destroy() -> completed | typed error
```

### 4.1 API 语义

| 操作 | 语义 |
| --- | --- |
| `create` | 创建句柄和内部 Runtime，不加载 RPK，不创建页面 |
| `loadRpk` | 校验并加载一个 RPK；失败不得留下部分 Runtime 资源 |
| `attachSurface` | 绑定一个 Host Surface；重复绑定必须返回 typed failure |
| `dispatchInput` | 接受坐标、触摸、点击、文本等 typed 输入，不能传递内部 NodeId |
| `updateLifecycle` | 转发宿主前后台、显示、隐藏等信号，不操作应用页面栈 |
| `destroy` | 幂等关闭；停止新任务、清理 JS/Core/Platform 资源并拒绝晚到消息 |

### 4.2 回调合同

每个异步操作至少携带：

```text
requestId
status = accepted | completed | failed | unsupported | cancelled
errorCode?
message?
```

回调只暴露公共 typed 数据，不暴露 C++ 指针、Runtime Tree、NativeHandle 或内部队列对象。

### 4.3 状态约束

```text
created -> loading -> loaded -> attached -> running
running -> background -> running
running/background -> destroying -> destroyed
```

非法状态转换返回 typed error；`destroy` 后所有公开操作都必须拒绝，不得复活 Runtime。

## 5. 线程与所有权

| 层 | 规则 |
| --- | --- |
| Host/UI | Android 和 iOS 的原生 View 操作必须在各自 UI 主线程；嵌入式由设备 Host 规定 owner thread |
| JS Runtime | 单一 JS owner thread；JS 执行、Job Queue 和 Microtask Drain 不跨线程直接调用 |
| C++ Core | 由 Core owner thread 串行处理状态、树、路由和事务 |
| Platform Adapter | 只在平台 owner thread 创建、更新和销毁 Native Host |
| SDK Facade | 负责线程切换、排队、回调派发和销毁屏障 |

- Host 只能持有不透明 Runtime 句柄。
- SDK 内部负责 C++ 对象的唯一 RAII 所有权。
- 跨边界默认复制 bytes、字符串、数组和 typed 对象；不得共享可变 Host 内存。
- 零拷贝只允许在明确声明生命周期的只读 buffer 上使用，并且不得让 Host 生命周期超过请求。
- `destroy` 建立 barrier：停止输入和新任务，等待 owner queue 排空或取消，再清理 Platform、Core 和 JS。
- 回调如果晚于 barrier 到达，必须丢弃或返回 `RUNTIME_DESTROYED`，不得访问已释放对象。

## 6. 平台映射

### 6.1 Android

- AAR 对外提供 Java/Kotlin Facade。
- JNI 只负责 typed 数据转换、线程切换和 C++ Runtime 句柄生命周期。
- Android View、VideoView、WebView、系统浏览器等只存在于 Android Platform Adapter/Provider。
- Host APK 只负责本地 RPK 列表、文件选择、Surface 容器、生命周期和展示错误。

### 6.2 iOS

- XCFramework 对外提供 Swift Facade，并提供 Objective-C 可桥接表面。
- UIKit 操作全部回到主线程。
- Objective-C++ Gateway 负责 C++ Runtime 所有权和 typed callback 转换。
- UIView、AVPlayer、WKWebView、系统浏览器等只存在于 iOS Platform Adapter/Provider。
- Host App 只负责本地 RPK 选择、Surface 容器、生命周期和展示错误。

### 6.3 嵌入式/LVGL

- 对外提供稳定 C ABI，内部可以使用 C++ 实现。
- 公开 API 只使用不透明句柄、固定宽度整数、枚举、长度明确的 buffer 和 typed result。
- LVGL 对象创建、刷新、输入和销毁必须在 LVGL owner thread 执行。
- Yoga/Layout、LVGL Mount、设备输入和显示刷新属于嵌入式 Platform Runtime。
- SDL 只作为桌面窗口和输入后端，不进入 SDK 公共合同。
- EventLoop Backend 可以选择当前轻量调度器、libuv 或设备原生调度器；SDK Facade 不暴露后端类型。

建议的 C ABI 语义：

```c
typedef struct qak_runtime qak_runtime_t;

qak_result_t qak_runtime_create(const qak_config_t*, qak_runtime_t**);
qak_result_t qak_runtime_load_rpk(qak_runtime_t*, const qak_rpk_source_t*, qak_callback_t);
qak_result_t qak_runtime_attach_surface(qak_runtime_t*, const qak_surface_t*);
qak_result_t qak_runtime_dispatch_input(qak_runtime_t*, const qak_input_t*);
qak_result_t qak_runtime_update_lifecycle(qak_runtime_t*, qak_lifecycle_signal_t);
qak_result_t qak_runtime_destroy(qak_runtime_t*);
```

具体结构体字段由嵌入式 SDK Spec 冻结；不得把 LVGL `lv_obj_t*`、Core 指针或 JS 对象放进公共 ABI。

## 7. 安全合同

- RPK 在执行前校验格式、总大小、成员路径、资源大小和 checksum。
- 资源路径限制在 RPK 内容和 Runtime 受控缓存目录内，拒绝路径穿越和任意文件访问。
- SDK 不从 RPK 加载动态库、脚本原生扩展或任意机器码。
- Host 传入的路径、URL、bytes 和配置必须做长度、编码、枚举和状态校验。
- Feature Provider 缺失返回 `unsupported`，非法输入返回 `failed`，不得静默成功。
- 资源、回调、线程和 NativeHandle 必须在 teardown 后归零或失效。
- Release 构建不得在热路径输出详细文本日志或执行非必要文件 I/O。

## 8. 验收

三个 SDK 使用真实 RPK 验收，不使用 Host 自己重建页面：

1. 干净 Host 只依赖对应 SDK 产物即可构建。
2. 加载真实 RPK，首屏正确挂载 `Text/Image/Button/List/Scroll/Tabs`。
3. 验证 `if`、状态更新、Tab 切换、点击事件和增量渲染。
4. 验证 Detail `push/back`，页面栈始终由 Core 管理。
5. 验证平台输入经过 Adapter -> Core Event Router -> JS Handler -> RenderTransaction。
6. 验证重复加载、Surface 关闭、重新加载和 Runtime destroy。
7. 验证非法 RPK、缺失资源、未注册 Feature 和晚到回调的 typed failure/unsupported。
8. Android 产出 AAR，iOS 产出 XCFramework，嵌入式产出 `.a`，并提供最小 Host/固件集成样例。
9. 证明 SDK 不携带正式业务 RPK，Host 不依赖 Runtime 内部类型。

## 9. 平台 Agent 任务

### Android Agent

在 `quickapp-runtime-android` 内完成 AAR Facade、JNI Gateway、Android Platform Adapter、构建产物和最小 Host 集成。严格复用现有 Core、JS、Toolkit、RPK、Bridge、Render、Event、Navigation 和 Feature Contract；不得在 Android 侧重定义协议或把业务逻辑放入 Host。

### iOS Agent

在 `quickapp-runtime-ios` 内完成 XCFramework Facade、Swift/Objective-C++ Gateway、UIKit Platform Adapter、构建产物和最小 Host 集成。遵守 UIKit 主线程、句柄所有权、回调取消和 teardown barrier；不得在 iOS 侧重定义协议、路由或状态。

### LVGL Agent

在 `quickapp-runtime-lvgl` 内完成嵌入式 C ABI、静态库 `.a` 交付和可选 `.so` 交付配置，并提供最小设备/Simulator Host 集成样例。保持当前 Core 单树、Platform Mount、输入和资源生命周期；不得把 LVGL 类型泄露到公共 ABI，不得把 SDL 作为必需运行时依赖。

三个 Agent 可以并行工作，但只能修改各自平台仓库和平台证据；公共合同、Core、JS、Toolkit 和真实 RPK 由公共负责人统一变更。

## 10. 不做什么

- 不建设应用商店、下载、账号、推荐或业务管理系统。
- 不把 Store/Host 做成第二个 Runtime。
- 不为三个平台分别实现不同的页面栈、状态系统、Tree、Bridge 或事件语义。
- 不因为 SDK 封装而扩展新的组件或 Feature；能力扩展另行进入对应 Contract。
- 不以 `.so` 作为 ESP32 等设备的强制交付形式。
