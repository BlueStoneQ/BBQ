# iOS Runtime 总 Spec：总体架构

## 目录

- [1. 结论](#1-结论)
- [2. 组件架构](#2-组件架构)
- [3. 跨语言边界](#3-跨语言边界)
- [4. 关键主流程](#4-关键主流程)
- [5. 线程与生命周期](#5-线程与生命周期)
- [6. 失败与资源回收](#6-失败与资源回收)
- [7. 跨项目边界](#7-跨项目边界)

## 1. 结论

iOS Runtime 采用**薄 Scene/Runtime Host + typed Objective-C++ Gateway + UIKit Platform Adapter**架构。Gateway 只桥接语言和线程，不创建第二套业务 Bridge。

## 2. 组件架构

```text
IosRuntimeHost
  -> IosPackageSource
  -> Shared Core / Shared JS Runtime
  <-> TypedPlatformGateway
        -> IosSurfaceHostAdapter
        -> IosMountAdapter
        -> IosComponentRegistry
        -> IosInputAdapter
        -> IosMeasureAdapter
        -> IosCapabilityProviders
        -> IosPageControlAdapter
```

| 组件 | 责任 |
|---|---|
| Runtime Host | 依赖装配、AppRuntime、Scene 信号和 Root 请求 |
| Platform Gateway | typed encode/decode、主线程投递、结果回 Core |
| Surface Host | 页面容器、原子 present 与 close/reveal 切换 |
| Mount Adapter | UIKit Host Tree 与 NodeId mapping |
| Component Registry | UIView/UILabel/UIButton 受控映射 |
| Input Adapter | target/action 到 PlatformInputMessage |
| Measure Adapter | 线程安全字体 metrics |
| Providers | prompt/device/title/meta |

## 3. 跨语言边界

```text
Core immutable command
  -> C++/Objective-C++ typed conversion
  -> main-thread UIKit task
  -> typed result
  -> Core queue
```

Gateway 不把 JS 对象、C++ 可变容器、UIView 指针或 block callback 当作公共协议。异步 block 只存在 Adapter 内部，并以 requestId/surfaceId 检查目标仍存活。

## 4. 关键主流程

### 4.1 Surface 与 Mount

Surface create 只建立隐藏容器；full Mount 在隐藏容器中建立 Host Tree；Present 成功后才显示 Root 或原子切换 push target。

close 由 Core 发出一个 `CloseSurfaceHost(source,reveal)` command；iOS 主线程在一个任务中关闭 source 并恢复 reveal，完成后返回 typed Result。Core 在成功结果前不 pop 权威栈。

### 4.2 Host Components

| 规范组件 | UIKit 映射原则 |
|---|---|
| View | 普通容器 View，frame 由 SetHostLayout 唯一决定 |
| Text | Label，文本与 visual prop 受控，不使用 intrinsic frame |
| Button | Button 根对象，事件 target/action 与 NodeId 绑定 |

### 4.3 输入与能力

UIKit event 只产生标准输入；prompt/device/title/meta 通过固定 Provider/Control Port 执行。业务状态变化必须回到 JS 后再产生 RenderTransaction。

## 5. 线程与生命周期

| 归属 | iOS 映射 |
|---|---|
| JS Executor | 共享 JS Runtime 线程 |
| Core Runtime | 共享 Core 线程 |
| Platform UI/Event | iOS 主线程 |
| Package I/O | Host I/O 执行器，completion 回 Core |
| Measure | Core Runtime Thread 调用线程安全字体服务 |

Scene active/background 先进入 Runtime Host，再由 Core 决定 App/Page LifecycleDispatch。Platform Adapter 不直接调用 JS Hook。

## 6. 失败与资源回收

- Objective-C 异常或平台失败必须在 Adapter 边界转换为公共错误。
- Mount 失败停止事务，等待 Core full rebuild；full 模式先清空 Host mapping。
- Destroy 先停止输入和新 UI task，再解除 target/action、移除 View、清理 mapping。
- 晚到主线程 block 检查 Surface tombstone 后直接取消，不触碰已释放 C++ owner。

## 7. 跨项目边界

iOS 使用冻结公共合同和共享实现。若 UIKit 无法实现某项合同，项目记录 `[待决策]` 和最小复现，由总架构决定合同是否调整；不得在 Gateway 中静默分叉。
