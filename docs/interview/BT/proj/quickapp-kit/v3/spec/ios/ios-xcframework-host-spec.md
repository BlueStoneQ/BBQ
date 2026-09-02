# QuickApp Kit iOS XCFramework and Host Spec

## 目录

- [1. 结论](#1-结论)
- [2. 目标与范围](#2-目标与范围)
- [3. 产品边界](#3-产品边界)
- [4. 公共 API](#4-公共-api)
- [5. 线程与所有权](#5-线程与所有权)
- [6. RPK 与资源安全](#6-rpk-与资源安全)
- [7. 构建产物](#7-构建产物)
- [8. 验收合同](#8-验收合同)
- [9. 明确不做](#9-明确不做)

## 1. 结论

本 Spec 将现有 iOS Runtime 产品化为不携带 RPK 的 `QuickAppKit.xcframework`；最小宿主命名为 `QuickAppKitHost`。Host 只选择本地 RPK、提供 UIKit 容器并控制生命周期，所有应用路由、状态、事件和渲染语义仍由 XCFramework 内的 Runtime、Core 和 JS 层负责。

本次只增加 iOS 产品封装边界，不修改 Core、JS、Toolkit、RPK 或公共 Runtime Contract。

## 2. 目标与范围

### 2.1 目标

- 生成可被干净 iOS Host App 链接的 `QuickAppKit.xcframework`。
- 封装 C++ Runtime、JS Runtime、UIKit Platform Adapter、Surface、Lifecycle、Event 和 Feature 接口。
- 使用真实 `commerce-001.rpk` 验证首屏、交互、列表、Tabs、条件更新、详情路由和资源清理。

### 2.2 输入与输出

| 项目 | 约束 |
| --- | --- |
| Runtime 输入 | Host 传入的本地 RPK URL 或受控数据源 |
| Runtime 输出 | 挂载到 Host 提供的 UIKit Surface |
| SDK 产物 | `QuickAppKit.xcframework` |
| 示例 Host | `QuickAppKitHost`，仅用于本地选择、运行和销毁 |

## 3. 产品边界

### 3.1 XCFramework 负责

- 创建和销毁一个 Runtime 实例。
- 校验并加载 RPK。
- 管理 Core 唯一 Runtime Tree、Core Router 和 Lifecycle。
- 将 UIKit 输入转换为现有 typed Event Contract。
- 将 Core RenderTransaction 转换为 UIKit Mount 操作。
- 暴露 typed Feature 结果和错误。

### 3.2 Host 负责

- 提供本地 RPK 列表或文件选择器。
- 创建 UIKit 容器并调用 SDK。
- 转发宿主生命周期。
- 展示 SDK 返回的错误或状态。
- 关闭并销毁 Runtime。

Host 不维护页面栈、业务状态、Runtime Tree、NodeId、事件旁路或平台私有业务逻辑。

## 4. 公共 API

对外只暴露稳定的 Swift API；Objective-C API 作为同一接口的桥接表面。Core 类型、C++ 类型、Runtime Tree、NodeId、RPK 内部结构和内部回调不得出现在公开头文件中。

建议 API 语义如下，具体命名可在实现时保持 Swift/Objective-C 兼容：

```swift
public final class QuickAppRuntime {
    public init(configuration: QuickAppRuntimeConfiguration) throws
    public func loadRPK(_ url: URL, completion: @escaping (Result<Void, QuickAppError>) -> Void)
    public func attachSurface(_ surface: UIView) throws
    public func dispatchInput(_ input: QuickAppInput) -> QuickAppResult
    public func updateLifecycle(_ state: QuickAppLifecycleState)
    public func destroy()
}
```

API 合同：

- `init` 只创建 Runtime，不加载 RPK。
- `loadRPK` 只接受本地、受控的 RPK 输入，并异步返回 typed 成功或失败。
- `attachSurface` 只能绑定一个宿主 Surface；重复绑定返回 typed failure。
- `dispatchInput` 只传递 typed 输入，不暴露 NodeId 管理给 Host。
- `updateLifecycle` 只传递生命周期状态，不由 Host 操作页面路由。
- `destroy` 幂等；销毁后所有公开方法拒绝晚到操作并返回 typed failure。
- 回调不得携带 Core 内部对象；回调完成后不保留 Host 对象的强引用。

## 5. 线程与所有权

| 层 | 线程与职责 |
| --- | --- |
| UIKit / Host | 主线程；创建、挂载、更新和销毁 UIKit View |
| iOS Platform Adapter | 主线程执行 UIKit 操作；只负责平台映射 |
| Core / JS Runtime | 使用既定 owner thread 和队列；不被 Swift 直接调用内部对象 |
| 公共回调 | 按 API 合同回到主线程；销毁后丢弃晚到回调 |

- Swift 持有 Runtime 的公开句柄。
- Objective-C++ 持有 C++ Runtime 的唯一 RAII 所有权。
- C++ 回调通过受控 adapter 转换为 typed 公共结果。
- `destroy` 先停止输入和新任务，再销毁 JS/Core 资源，最后移除 UIKit Surface。
- 不允许跨线程直接访问 UIKit，不允许 Host 持有 Core 指针或内部节点引用。

## 6. RPK 与资源安全

- XCFramework 不打包任何 RPK，不依赖 Host 页面或固定应用资源。
- 加载前校验 RPK 格式、总大小、成员路径、资源大小和 checksum。
- 路径必须限制在 RPK 内部及 SDK 受控临时目录，拒绝路径穿越和任意文件访问。
- RPK 资源只通过 Runtime 内部资源服务提供给对应 Platform Adapter，不直接暴露给 Host 业务代码。
- XCFramework 不执行 RPK 外部原生代码。
- RPK 加载失败、资源缺失和能力不支持必须返回 typed failure/unsupported。

## 7. 构建产物

构建必须生成：

- `QuickAppKit.xcframework`；
- 支持的架构列表和构建日志；
- 一个不携带 RPK 的最小 `QuickAppKitHost`；
- 真实 RPK 验收日志和截图。

Host 的 RPK 应作为 Host 自己的输入资源，不得被复制进 XCFramework。

## 8. 验收合同

使用真实 `commerce-001.rpk` 完成：

1. 干净 Host 链接并创建 Runtime。
2. 加载 RPK，显示首屏 Image、Text、Button 和商品列表。
3. 验证 List/Scroll、Tabs、if 和状态刷新。
4. 验证详情页面 `push/back`，路由始终由 Core 管理。
5. 验证 UIKit 输入经过 iOS Adapter、Core Event Router、JS Handler、RenderTransaction 后更新 UIKit。
6. 重复加载、关闭、重新加载和销毁，资源计数归零。
7. 验证非法 RPK、资源缺失和不支持能力返回 typed 结果。
8. 验证 XCFramework 内不含 RPK，Host 不依赖 Runtime 内部类型。

## 9. 明确不做

- 不建设应用商店、下载、账号、推荐、支付或联网应用管理。
- 不修改 Core、JS、Toolkit、公共 Contract 或 RPK。
- 不创建第二棵 Runtime Tree、第二套路由或旁路 Bridge。
- 不把业务状态放入 Swift/UIKit。
- 不在本次引入新的渲染语义、路由语义或 Feature 集合。
