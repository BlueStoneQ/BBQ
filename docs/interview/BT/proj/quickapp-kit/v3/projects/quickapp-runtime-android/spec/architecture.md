# Android Runtime 总 Spec：总体架构

## 目录

- [1. 结论](#1-结论)
- [2. 组件架构](#2-组件架构)
- [3. JNI 边界](#3-jni-边界)
- [4. 关键主流程](#4-关键主流程)
- [5. 线程与所有权](#5-线程与所有权)
- [6. 失败与资源回收](#6-失败与资源回收)
- [7. 跨项目边界](#7-跨项目边界)

## 1. 结论

Android Runtime 采用**薄 Runtime Host + typed JNI Gateway + Android Platform Adapter**架构。所有跨平台语义留在共享 Core，Android 层只执行公共 Platform command 并返回结果。

## 2. 组件架构

```text
AndroidRuntimeHost
  -> AndroidPackageSource
  -> Shared Core / Shared JS Runtime
  <-> TypedJniGateway
        -> AndroidSurfaceHostAdapter
        -> AndroidMountAdapter
        -> AndroidComponentRegistry
        -> AndroidInputAdapter
        -> AndroidMeasureAdapter
        -> AndroidCapabilityProviders
        -> AndroidPageControlAdapter
```

| 组件 | 责任 |
|---|---|
| Runtime Host | AppRuntime 生命周期、依赖装配、Root 启动、Host 前后台 |
| PackageSource | 随机读取 immutable package bytes |
| JNI Gateway | typed encode/decode、线程投递、结果关联 |
| Surface Host | 页面容器创建、展示、可见性、原子 close/reveal、销毁 |
| Mount Adapter | Host Tree 与 `NodeId -> NativeHandle` |
| Component Registry | View/Text/Button 与受控 prop 映射 |
| Input Adapter | Listener 与 PlatformInputMessage |
| Measure Adapter | UI Thread 外可用的只读字体 metrics |
| Providers | prompt/device 与 Page Host Control |

## 3. JNI 边界

```text
Core immutable command
  -> JNI Gateway encode/copy
  -> Android UI/Provider task
  -> typed Android result
  -> JNI Gateway encode/copy
  -> Core queue
```

冻结规则：

1. JNI 方法定义和实现都归 Android 项目。
2. JNI 不暴露 `moduleName + methodName + JSON` 通用入口。
3. `NodeId` 是 opaque string，不转换为指针或 Java 对象身份。
4. NativeHandle 只存于 Android Adapter 映射，不跨回 Core。
5. 每个异步结果必须回传原 request/mount/source ID。

## 4. 关键主流程

### 4.1 Root 首屏

```text
Host open Runtime RPK
  -> Core create Surface
  -> Android create hidden container
  -> Core/JS build and full Mount
  -> Android create Host Tree in hidden container
  -> Core request Present(root)
  -> Android show container
  -> result presented
```

### 4.2 更新与事件

Mount operations 始终按事务顺序在 UI Thread 执行。Button Listener 只捕获 `surfaceId/nodeId/click/timestamp/payload`，随后异步投递 Core；它不知道 HandlerId 和 JS 方法。

### 4.3 Navigation

push target 使用独立隐藏容器。Present 成功时 Android 原子隐藏 source、展示 target；失败保持 source 视觉状态并返回 failed。

close 由 Core 发出一个 `CloseSurfaceHost(source,reveal)` command。Android 在一个主线程任务中关闭 source 并恢复 reveal；任一步失败返回 failed，Core 不提前 pop 权威页面栈。

## 5. 线程与所有权

| 执行归属 | Android 映射 |
|---|---|
| JS Executor | 共享 JS Runtime 线程 |
| Core Runtime | 共享 Core 线程 |
| Platform UI/Event | Android 主线程 |
| Package I/O | Host I/O 执行器，completion 回 Core 队列 |
| Measure | Core Runtime Thread 同步调用线程安全字体服务 |

JNI Gateway 只负责跨边界投递，不允许 Core Runtime Thread 同步等待 Android 主线程。

## 6. 失败与资源回收

- Host operation 异常转换为公共错误，不跨 JNI 抛出。
- Mount 任一步失败停止本次事务，保持可诊断残留并等待 Core full rebuild。
- full Mount 先清空该 Surface 的全部 Host mapping。
- Destroy 即使部分平台调用失败，也清除 Adapter 映射和 Listener，并向 Core 报告 failed。
- Surface tombstone 后丢弃晚到 UI callback，不复活旧对象。

## 7. 跨项目边界

Android 可以提出公共合同不可实现的问题，但只能记录 `[待决策]`。Android 复用链路用于验证联盟语义与平台无关性，不得直接修改 Core/JS 或在 JNI 中增加私有旁路。
