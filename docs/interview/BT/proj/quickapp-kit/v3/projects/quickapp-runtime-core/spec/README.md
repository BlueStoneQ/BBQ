# Runtime Core Spec

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec](#2-总-spec)
- [3. 状态](#3-状态)

## 1. 结论

Core 从第一天就是跨平台共享实现的唯一归属，不再从 Android 工程事后抽取。总架构已通过，Core 与 JS Runtime 的项目总 Spec 立即并行设计；对应总 Spec 通过后设计分 Spec，对应分 Spec 通过后才实现。LVGL/SDL 是首个可运行宿主，Android 随后验证同一 Core 的平台无关性。

覆盖：PackageSource、RPK/Manifest/Runtime Metadata/Page IR Loader、App/Page Lifecycle Controller、Surface/Navigation Controller、Runtime Tree、NodeId、Style/Yoga、Measure cache、InstantiateTemplate、RenderTransaction、PlatformInputMessage/JsEventDispatch、ModuleRegistry/CapabilityInvoker、Page Control 路由、线程、所有权和错误降级。

PackageOpenPolicy 与签名属于后续 Release profile，不阻塞 V1。

## 2. 总 Spec

- [需求](./requirements.md)
- [总体架构](./architecture.md)
- [分 Spec 索引](./subspec-index.md)
- [验收](./acceptance.md)

## 3. 状态

第五次定向复核 `PASS`；当前 `DESIGN_ALLOWED + CODE_BLOCKED`，允许设计 CORE-S01。
