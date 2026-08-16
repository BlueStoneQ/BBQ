# Capability Module Contract

## 目录

- [1. 结论](#1-结论)
- [2. 架构](#2-架构)
- [3. V1 模块](#3-v1-模块)
- [4. 注册、发现与懒加载](#4-注册发现与懒加载)
- [5. 调用合同](#5-调用合同)
- [6. 生命周期与降级](#6-生命周期与降级)
- [7. 所有权](#7-所有权)
- [8. 演进位置](#8-演进位置)

## 1. 结论

Capability Module 的本质是：**用稳定的 typed API，把 JS 能力调用路由到可替换的 CoreProvider 或 PlatformProvider。**

V1 冻结手动注册、按 AppRuntime 懒加载和 unsupported fallback；不做动态库发现、插件包安装或无类型 `module + method + args` JSON Bridge。

## 2. 架构

```text
$app_require$("@app-module/system.xxx")
  -> JS typed Module Facade
  -> Runtime ABI typed entry
  -> C++ CapabilityInvoker
  -> ModuleRegistry
  -> CoreProvider | PlatformProvider
  -> typed Result
```

`ModuleRegistry` 只负责“模块/方法由谁实现”；每个方法的参数、结果和错误仍由独立强类型合同决定。Registry 不解释任意对象，也不允许字符串反射调用平台方法。

## 3. V1 模块

| Module | V1 Method | typed contract | Provider |
|---|---|---|---|
| `system.router` | `push` | `NavigationPush -> NavigationPushResult` | CoreProvider |
| `system.router` | `back` | `NavigationClose -> NavigationCloseResult` | CoreProvider |
| `system.prompt` | `showToast` | `ShowToast -> ShowToastResult` | PlatformProvider |
| `system.device` | `getInfo` | `DeviceGetInfo -> DeviceGetInfoResult` | PlatformProvider |
| `system.fetch` | `fetch` | V1 deferred facade；调用直接拒绝 | 无，不进入 Core |

`system.fetch` 只为冻结 Case 001 的标准模块加载合同提供“可解析、不可调用”语义：JS Framework 返回包含固定 `fetch` 方法的 frozen facade；调用立即以 rejected Promise 返回 `CAPABILITY_UNSUPPORTED`，不生成 Runtime ABI request，不注册 Provider，不实现网络。它不是通用 unknown-module stub，其他未进入静态 Facade Catalog 的 import 仍以 `MODULE_ABI_UNSUPPORTED` 失败。

`system.device.getInfo` 的 V1 结果包含：

```text
required:
  osType
  platformVersionName
  platformVersionCode
  screenDensity
  screenWidth
  screenHeight
  windowWidth
  windowHeight
  deviceType
optional:
  brand
  manufacturer
  model
  product
  osVersionName
  osVersionCode
```

尺寸使用物理像素，`screenDensity` 用于与 `logical-px` 换算。Provider 不得返回设备唯一标识；标识、广告、网络等能力不属于 V1。

`SetTitleBar`、`SetMeta` 是绑定当前 Surface 的 Page Host Control，不属于 Capability Module。它们继续使用 [Page Host Control Contract](./feature-contract.md)。

## 4. 注册、发现与懒加载

Runtime Host 在执行 `app.js` 前显式注册 Provider Factory：

```text
register(moduleName, methodSet, providerKind, factory)
```

冻结规则：

1. V1 只允许静态代码手动注册；同一 AppRuntime 内重复 `moduleName` 启动失败。
2. Manifest `features` 是应用请求集合，Registry descriptor 是宿主提供集合；二者交集是可调用集合。
3. `$app_require$` 只解析静态 Facade，不创建 Provider；第一次真实方法调用才懒加载 Provider，同一 AppRuntime 后续复用同一实例。
4. Provider 构造失败被缓存为 unavailable，不得在每次调用时反复构造。
5. JS 可通过 Framework 内部 `supports(moduleName, methodName)` 查询能力；结果固定为 Manifest 已声明 AND Registry descriptor 已提供该方法，查询不触发 Provider 创建。`system.fetch.fetch` 在 V1 固定为 false。
6. Module Facade 由 JS Framework 固定提供，不从平台动态注入 JS 源码。

V1 不实现独立权限 Guard。`CapabilityInvoker` 只执行 Manifest declaration 与 Registry descriptor 的静态交集校验；账号、系统授权、弹窗和 deny policy 在第二期通过 Core 扩展点加入，平台权限对象仍不得进入公共合同。

## 5. 调用合同

公共边界固定为 `JsEnginePort` Native Function Binding + 封闭 typed union。QuickJS Provider 可以用 External Function 实现该绑定；其他 Provider 以自己的 native binding 机制映射到同一封闭集合：

```text
CapabilityRequest = NavigationPush | NavigationClose | ShowToast | DeviceGetInfo
CapabilityResult  = NavigationPushResult | NavigationCloseResult | ShowToastResult | DeviceGetInfoResult
```

禁止把 `moduleName/methodName/JSON args` 作为跨层业务合同。Module name 只在 Facade 解析和 Registry 选择 Provider 时使用。

每次调用携带 `requestId`；页面发起的调用同时携带 `surfaceId`。消息入 Core 队列时复制或转移为 immutable value，结果以相同 `requestId` 异步返回 JS Executor。联盟 API 的 Promise/callback 形式由 JS Facade 适配，不进入 C++ Core。

## 6. 生命周期与降级

| 情况 | 行为 |
|---|---|
| Manifest 未声明模块 | 调用失败：`CAPABILITY_NOT_DECLARED` |
| Host 未注册模块或方法 | Facade 保持可解析，调用失败：`CAPABILITY_UNSUPPORTED` |
| Provider 构造或执行失败 | 调用失败：`CAPABILITY_FAILED`，不得伪造成功 |
| Surface 在执行前销毁 | 返回 `SURFACE_NOT_FOUND` |
| AppRuntime 销毁 | 先取消在途调用，再逆注册顺序销毁已创建 Provider |

unsupported fallback 的语义是“静态 Facade Catalog 中的应用模块仍可加载、调用可观察地失败”，不是给任意 module/method 返回动态空对象。JS 业务可以用 `supports` 或捕获 typed error 实现降级。

## 7. 所有权

| 层 | 负责 | 不负责 |
|---|---|---|
| Toolkit | 校验 Manifest capability 名称；保留 `$app_require$`；生成模块引用 | 选择平台 Provider |
| JS Framework | typed Facade、Promise/callback 适配、`supports` | 保存平台对象、通用反射调用 |
| C++ Core | ModuleRegistry、CapabilityInvoker、CoreProvider、请求关联和错误 | JNI/UIKit/LVGL 实现 |
| Platform Runtime | 手动注册 PlatformProvider Factory，实现 prompt/device | 路由状态、解析 JS 对象 |

Router 的页面栈和 Surface 事务始终由 Core 管理；把它暴露为 Module 只是在 JS API 层兼容联盟 DSL，不改变所有权。

机器消息：`ShowToast/DeviceGetInfo` 见 [feature.schema.json](./schemas/feature.schema.json)，`NavigationPush/NavigationClose` 见 [navigation.schema.json](./schemas/navigation.schema.json)。

## 8. 演进位置

命名空间固定为：

| Namespace | V1 |
|---|---|
| `system.*` | 可注册；V1 可调用 router/prompt/device，fetch 仅 deferred facade |
| `service.*` | 保留，不创建 ServiceContext，不允许应用注册 |
| `agent.tool.*` | 保留，不创建 Agent Provider，不允许应用注册 |

V2 可以在不改变 `ModuleRegistry -> CapabilityInvoker -> Provider -> typed Result` 主链路的前提下，在 Invoker 与 Provider 之间加入 CapabilityGuard，并扩展 ServiceContext、权限策略、版本协商和 IDL/Codegen。
