# 跨端框架对比：快应用 vs RN vs 小程序 vs Flutter

## 目录

- [核心对比表](#核心对比表)
- [架构本质](#架构本质)
- [优劣分析](#优劣分析)
- [一句话定位](#一句话定位)

---

## 核心对比表

| 维度 | 快应用 | React Native | 小程序 | Flutter |
|------|--------|-------------|--------|---------|
| **渲染方式** | JS 驱动 Native View | JS 驱动 Native View | WebView + 部分 Native 组件 | 自绘引擎（Skia） |
| **JS 引擎** | V8（J2V8 同步调用） | Hermes（JSI/C++ 直调） | V8/JSCore（双线程） | 无（Dart AOT） |
| **通信机制** | J2V8 同步 Bridge | JSI 同步 / 旧 Bridge 异步 | postMessage 异步（逻辑线程↔渲染线程） | 无 Bridge（Dart 直接编译为 Native） |
| **布局** | Flexbox（Native 实现） | Yoga（C++ Flexbox） | CSS 子集（WebView 渲染） | 自有布局引擎 |
| **开发语言** | 类 Vue（template+script+style） | React（JSX + TS） | WXML + WXSS + JS | Dart |
| **热更新** | ✅（下载新 rpk） | ✅（CodePush / 自建） | ✅（平台自动更新） | ❌（AOT 编译，需发版） |
| **包体** | 极小（1-2MB rpk） | 中等（10-50MB） | 极小（2-4MB，依赖宿主 App） | 较大（10-30MB） |
| **生态** | 厂商联盟（华米OV） | 社区最大 | 微信/支付宝生态 | Google 主导 |
| **平台** | Android only（系统级） | iOS + Android | 依赖宿主 App | iOS + Android + Web + Desktop |

---

## 架构本质

```
快应用：  JS(V8) ──J2V8 同步──→ Java Native View
RN：     JS(Hermes) ──JSI/C++──→ JNI → Java Native View（或 ObjC）
小程序：  JS(逻辑线程) ──postMessage──→ WebView(渲染线程)
Flutter： Dart ──编译──→ Native Code ──Skia──→ 自绘 Canvas
```

**通信效率排序**：Flutter（无 Bridge）> 快应用（J2V8 同步）≈ RN 新架构（JSI 同步）> RN 旧架构（异步 Bridge）> 小程序（双线程 postMessage）

---

## 优劣分析

### 快应用

**优势**：
- 系统级集成（无需安装，桌面直达，负一屏卡片）
- 包体极小（rpk 1-2MB，秒下载）
- J2V8 同步通信（无异步开销）
- 启动快（系统预加载运行时）

**劣势**：
- 只有 Android（无 iOS）
- 生态小（只有国内厂商联盟）
- 组件能力受限（不如 RN/Flutter 丰富）
- 开发者社区小，三方库少

### React Native

**优势**：
- 跨 iOS + Android
- 社区最大，三方库丰富
- 新架构（Fabric/JSI）性能接近原生
- 热更新成熟

**劣势**：
- 包体较大
- 新旧架构迁移成本
- 复杂动画/自定义渲染不如 Flutter

### 小程序

**优势**：
- 无需安装，即用即走
- 依托超级 App 流量（微信 10 亿用户）
- 审核快，迭代快

**劣势**：
- 性能天花板低（WebView 渲染）
- 双线程通信异步（setData 瓶颈）
- 平台锁定（微信/支付宝各一套）
- 能力受限（不能调用系统底层 API）

### Flutter

**优势**：
- 自绘引擎，UI 一致性最好（像素级跨平台）
- 性能最好（Dart AOT，无 Bridge）
- 一套代码覆盖 iOS/Android/Web/Desktop

**劣势**：
- 无热更新（AOT 编译）
- Dart 语言生态小于 JS/TS
- 原生集成复杂（Platform Channel）
- 包体较大

---

## 一句话定位

| 框架 | 定位 | 适用场景 |
|------|------|---------|
| 快应用 | Android 系统级轻应用，极致轻量 + 秒开 | 工具类、内容类、轻交互 |
| RN | 跨端主流方案，生态最大 | 中大型 App、需要热更新 |
| 小程序 | 依托超级 App 的轻量触达方案 | 电商、服务、营销活动 |
| Flutter | 自绘引擎，UI 一致性和性能最好 | 重 UI 应用、品牌一致性要求高 |
