# Flutter 核心概念

## 本质

**Flutter = Dart 语言 + Skia 自绘引擎 + 跨平台编译**

一句话：不用平台原生 View，自己画所有像素。UI 一致性最好，性能最接近原生。

```
类比：
  RN：JS 驱动 Native View（用平台的 UIButton/TextView）
  Flutter：Dart 驱动 Skia 引擎自己画（不用平台 View，像游戏引擎一样）
```

---

## 核心架构

```
┌─────────────────────────────────────┐
│  Framework 层（Dart）               │
│  Widget → Element → RenderObject    │
│  Material / Cupertino 组件库        │
├─────────────────────────────────────┤
│  Engine 层（C++）                   │
│  Skia 渲染引擎 + Dart VM + 平台通道 │
├─────────────────────────────────────┤
│  Embedder 层（平台适配）            │
│  Android: SurfaceView               │
│  iOS: Metal/OpenGL                   │
│  Web: Canvas/WebGL                   │
└─────────────────────────────────────┘
```

---

## 和 RN 的核心区别

| | RN | Flutter |
|--|-----|---------|
| **渲染** | JS 驱动 Native View | Dart 驱动 Skia 自绘（不用 Native View） |
| **Bridge** | JSI（JS ↔ Native） | 无 Bridge（Dart AOT 编译为 Native Code） |
| **语言** | JavaScript/TypeScript | Dart |
| **热更新** | ✅（只更新 JS Bundle） | ❌（AOT 编译，需发版） |
| **UI 一致性** | 两端可能有差异（用的是各自 Native View） | 像素级一致（自己画的） |
| **性能** | 好（新架构接近原生） | 最好（无 Bridge，AOT 编译） |
| **包体** | 10~50MB | 10~30MB |
| **生态** | npm 最大 | pub.dev（小于 npm） |
| **学习成本** | 低（JS/TS 开发者直接上手） | 中（需要学 Dart） |

---

## 渲染原理

```
Widget（声明式 UI 描述，类似 React 组件）
  ↓ 
Element（Widget 的实例，管理生命周期，类似 Fiber 节点）
  ↓
RenderObject（布局 + 绘制，类似 Native View 的 measure/layout/draw）
  ↓
Skia（C++ 渲染引擎，直接操作 GPU 画像素）
  ↓
屏幕
```

**为什么快？** 没有 Bridge，没有 Native View 创建开销。Dart 代码 AOT 编译为机器码，直接调 Skia 画像素。

---

## Platform Channel（和 Native 通信）

Flutter 需要调用平台 API（相机/蓝牙/文件系统）时，通过 Platform Channel：

```
Dart 侧                    Native 侧
  │                           │
  │  MethodChannel            │
  │  ('com.myapp/ble')        │
  │  ──── 消息 ────→          │  Android: Kotlin 实现
  │  ←── 结果 ────            │  iOS: Swift 实现
```

```dart
// Dart 侧
final channel = MethodChannel('com.myapp/ble');
final result = await channel.invokeMethod('connect', {'deviceId': '123'});
```

```kotlin
// Android 侧
MethodChannel(flutterEngine.dartExecutor, "com.myapp/ble").setMethodCallHandler { call, result ->
  if (call.method == "connect") {
    val deviceId = call.argument<String>("deviceId")
    // 调用 BLE API...
    result.success(true)
  }
}
```

**类比 RN TurboModule**：Platform Channel ≈ 旧 Bridge（异步消息传递），但 Flutter 也有 FFI（直接调 C 函数，类似 JSI）。

---

## 为什么 PD 可能用 Flutter

| 优势（对机器人 App） | 说明 |
|---------------------|------|
| UI 一致性 | 控制面板在 Android/iOS 完全一样 |
| 自绘性能 | 实时数据仪表盘渲染流畅（Skia 直接画） |
| 桌面端支持 | Flutter 支持 macOS/Windows/Linux |
| 无热更新需求 | 机器人 App 不需要频繁热更新 |

---

## 你的应对策略

如果被问"为什么不用 Flutter"：

> "Flutter 的 UI 一致性和渲染性能确实最好，但我选 RN 的原因是：
> 1. 热更新能力（IoT 设备固件配合 App 迭代快，需要不发版修 bug）
> 2. JS/TS 生态更大（三方库多，开发效率高）
> 3. 团队技术栈是 JS/TS（迁移成本低）
> 4. 和 Web 端共享代码的可能性（React + React Native）
>
> 如果项目不需要热更新、且重 UI 一致性，Flutter 是更好的选择。"
