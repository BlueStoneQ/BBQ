# Card 2: Flutter + Native Shell

> 核心能力：双端三层架构 — Flutter 业务层 + Native Shell 容器层 + C++ 引擎层

---

## 核心叙事

双端三层架构的**实践者**：Flutter 业务层 + Native Shell 容器层 + C++ 引擎层，三层协作经验完整。

---

## 关键技术点

| 维度 | 内容 |
|------|------|
| Flutter 层 | Dart/Widget、Riverpod 状态管理、Skia 渲染管线、混合栈路由 |
| Native Shell | 容器生命周期管理、引擎预热、Platform Channel Plugin 封装 |
| Android 侧 | Kotlin/Java、Gradle、NDK/JNI、AAR 产物化集成 |
| iOS 侧 | Swift/OC、CocoaPods、XCFramework、OC++ 零开销调用 C++ |
| C++ 层 | 渲染引擎核心（Yoga + DOM）、FFI 暴露给 Dart、JNI/OC++ 桥接 Native |
| 跨层通信 | Dart FFI ↔ C++ .so（高频同步）/ Platform Channel ↔ Native（方法调用）/ JNI·OC++ ↔ C++（引擎桥接） |
| 混合栈 | Flutter 与 Native 页面混合管理、路由栈统一 |

---

## 技术对照

| 岗位能力要求 | 切入点 |
|-------------|--------|
| Flutter 跨平台开发 | 携程 Flutter 混合框架实践 + 小米 Flutter 卡片渲染 |
| Android/iOS 原生能力 | Native Shell 设计：引擎预热、Plugin 封装、原生控件调起 |
| 独立处理原生差异 | Platform Channel 复用 Native 网络库/图片缓存、NDK 层 .so 集成 |
| 实际上线项目 | 携程机酒频道 Flutter + Trip.com 国际化 App |

---

## TODO

- [ ] Flutter 引擎预热方案（FlutterEngineGroup）
- [ ] Platform Channel vs Dart FFI 选型场景
- [ ] AAR/Framework 产物化集成流程
- [ ] Flutter 混合栈路由管理（Native Router + Flutter Navigator）
- [ ] Shader 预编译：收集热路径 SkSL → 构建时打入包内消除首帧 jank
- [ ] iOS OC++ 调 C++ 零开销 vs Android JNI 类型转换开销
- [ ] 国际化开发（多语言 + RTL 适配）实践
