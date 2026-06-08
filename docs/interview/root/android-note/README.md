# Android 体系梳理

> 面向前端工程师的 Android 系统性知识建设。
> 第一性原理，理解本质，核心优先。
> 结合快应用框架项目实战理解。

## 目录

| # | 专题 | 核心问题 | 文件 |
|---|------|---------|------|
| 1 | [依赖管理](./01-dependencies/README.md) | 依赖形式有哪些？怎么集成和使用？ | [→](./01-dependencies/README.md) |
| 2 | [进程、线程与通信](./02-process-thread/README.md) | 进程模型？线程通信方案？和前端的区别？ | [→](./02-process-thread/README.md) |
| 3 | [内存管理](./03-memory/README.md) | Android 内存模型？GC 机制？PSS/RSS？优化手段？ | [→](./03-memory/README.md) |
| 4 | [JS 引擎集成](./04-js-engine/README.md) | V8/J2V8 怎么集成？核心 API？在快应用框架中的角色？ | [→](./04-js-engine/README.md) |
| 5 | [布局引擎](./05-layout-engine/README.md) | Android 布局系统？快应用框架的布局方案？ | [→](./05-layout-engine/README.md) |
| 6 | [四大组件、Fragment 与通知](./06-four-components/README.md) | Activity/Service/BroadcastReceiver/ContentProvider/Fragment/Notification 的本质？ | [→](./06-four-components/README.md) |
| 7 | [架构模式](./07-architecture-pattern/README.md) | MVC → MVP → MVVM → MVI 演进？Jetpack（ViewModel/LiveData/Compose）？ | [→](./07-architecture-pattern/README.md) |
| 8 | [性能优化](./08-optimization/README.md) | 启动速度、内存、包体、渲染、ANR 的优化方案？ | [→](./08-optimization/README.md) |
| 9 | [工程化](./09-engineering/README.md) | Gradle 深度、CI/CD、多模块、依赖管理、版本管理？ | [→](./09-engineering/README.md) |
| 10 | [分层架构](./10-layered-architecture/README.md) | 快应用框架的分层设计？各层职责和通信？ | [→](./10-layered-architecture/README.md) |
| 11 | [发布与分发](./11-distribution/README.md) | 商店上架流程？ROM 预装？签名机制？ | [→](./11-distribution/README.md) |
| 12 | [Android 版本与 SDK](./12-versions-sdk/README.md) | 版本演进、API Level 映射、主要特性、兼容性评估？ | [→](./12-versions-sdk/README.md) |
| 13 | [网络](./13-networking/README.md) | Android 网络框架？OkHttp/Retrofit？权限？HTTPS？ | [→](./13-networking/README.md) |
| 14 | [Material Design](./14-material-design/README.md) | 设计规范？组件体系？主题/样式？和前端 Design System 的对比？ | [→](./14-material-design/README.md) |
| 15 | [权限系统](./15-permissions/README.md) | 运行时权限模型？权限分组？危险权限 vs 普通权限？动态申请流程？ | [→](./15-permissions/README.md) |
| 16 | [游戏引擎集成](./16-game-engine/README.md) | Unity/Unreal 在 Android 中的集成方式？目录结构？通信方案？ | [→](./16-game-engine/README.md) |
| 17 | [直播与 IM](./17-live-im/README.md) | 直播推拉流方案？IM 长连接？协议选型？在 Android 中的集成？ | [→](./17-live-im/README.md) |
| 18 | [WebView 容器定制](./webview-container.md) | 预创建/复用池、离线包、接口预请求、JSBridge 设计、请求拦截 | [→](./webview-container.md) |
| 19 | [NDK 与 JNI](./18-ndk-jni/README.md) | JNI 双向通信、NDK 工具链、C++ ↔ Java 桥接、快应用中的角色 | [→](./18-ndk-jni/README.md) |

## 优先级

```
高优先（快应用框架强相关，interview 必问）：
  4. JS 引擎集成
  5. 布局引擎
  10. 分层架构
  8. 性能优化（包体 + 内存）

中优先（Android 通用知识，可能被追问）：
  1. 依赖管理
  2. 进程、线程与通信
  3. 内存管理
  9. 工程化

低优先（了解即可）：
  6. 四大组件、Fragment 与通知
  7. 架构模式
  11. 发布与分发
  12. 版本与 SDK
  13. 网络
  14. Material Design
  15. 权限系统
  16. 游戏引擎集成
```

## 策略

- 有基础，目标快速升级到中级/资深认知水平
- 每个专题直接讲中高级内容，跳过入门
- 重点是"原理 + 场景 + 方案 + trade-off"，能在 interview 中讲清楚决策依据
- 结合快应用框架源码实战理解，不脱离项目
