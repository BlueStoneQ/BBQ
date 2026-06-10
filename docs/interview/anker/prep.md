# Anker Prep — IoT + Flutter + Editor

> JD2: eufyMake 移动端（IoT 打印机 App），Flutter + iOS/Android 原生 + 编辑器 + BLE
>
> 此文档同时覆盖 DJI / LN / DD 大前端方向的共同增量。

---

## JD 拆解

### 核心技术矩阵

| 方向 | JD 关键词 | 优先级 | 现有基础 |
|------|----------|--------|---------|
| **Flutter** | Flutter + iOS/Android 原生 | 🔴 必须 | Rust + Flutter 新一代快应用框架（架构参与） |
| **BLE / IoT 通讯** | 蓝牙通讯 / MQTT / P2P / 通讯协议 | 🔴 必须 | 概念了解，无深度实战 |
| **iOS 原生** | iOS 开发经验 | 🟡 中 | Android 深度，iOS 类比迁移 |
| **编辑器** | Fabric / Three.js / 图片处理 | 🟡 中 | 3D Editor 项目 + Canvas 2D |
| **性能优化** | 启动优化 / AI 应用体验优化 | ✅ 已有 | card-1 全覆盖 |
| **架构设计** | App 架构重构 / 业务解耦 | ✅ 已有 | 多个架构重构案例 |
| **AI 工作流** | AI 融入开发流程 | ✅ 已有 | Mako Agent + MCP |

### 匹配度分析

| JD 要求 | 对应经验 | 匹配 |
|---------|----------|------|
| 5 年 iOS/Android | 10 年大前端，Android 深度，iOS 需补 | ⚠️ |
| 1 年 Flutter | 当前 Rust+Flutter 框架建设中 | ⚠️ |
| 网络通讯/多线程 | Node.js 多进程 + RN Native Bridge + IPC | ✅ |
| 独立设计架构 | 快应用框架/IDE/Mako 全部独立设计 | ✅✅ |
| AI 融入开发工作流 | Mako Agent 核心差异化 | ✅✅ |
| App 性能优化 | PSS/包体/秒开率 有数据 | ✅✅ |
| IoT 蓝牙/MQTT | 需要补 | ❌ |
| 图片处理/编辑 | 3D Editor + Canvas 2D | ✅ |
| 3D 渲染 | Three.js 基础 | ✅ |

---

## 需要补的增量（统筹 Anker + DJI + LN + DD）

### 🔴 Flutter（必须）

**本质**：和 RN 同一类东西（跨端框架），但自绘引擎（Skia），不依赖 Native View。

**RN → Flutter 核心差异**：

| 维度 | RN | Flutter |
|------|-----|---------|
| 语言 | JS/TS | Dart |
| 渲染 | 桥接 Native View（UIView/Android View） | 自绘引擎（Skia Canvas），不用 Native View |
| 线程模型 | JS Thread + Main Thread + Shadow Thread | UI Thread + Raster Thread + Platform Thread |
| 状态管理 | Redux / Zustand / Context | Provider / Riverpod / Bloc |
| 热更新 | CodePush / 自建方案 | 官方不支持（Dart AOT 编译，无法动态下发） |
| Bridge | JSI / TurboModule | Platform Channel（MethodChannel / EventChannel） |
| 布局 | Yoga (Flexbox) | 自带 Widget 布局（Row/Column/Stack/Flex） |
| 性能上限 | 受 Bridge 和 Native View 限制 | 接近原生（自绘无 Bridge） |

**Flutter 核心概念速记**：

| 概念 | 一句话 |
|------|--------|
| Widget | 不可变的 UI 描述（类似 React 的 JSX） |
| Element | Widget 的实例化对象（类似 React Fiber 节点） |
| RenderObject | 实际负责布局和绘制的对象 |
| StatelessWidget | 无状态组件（纯 UI） |
| StatefulWidget | 有状态组件（State 对象持有可变状态） |
| BuildContext | 当前 Widget 在树中的位置引用（类似 React Context） |
| InheritedWidget | 祖先→后代数据传递（Provider 的底层原理） |
| Platform Channel | Flutter ↔ Native 通信通道 |

**和 RN 的 Bridge 对比**：

```
RN:      JS Thread ──JSI/TurboModule──→ Native Module (Java/ObjC)
Flutter:  Dart      ──Platform Channel──→ Native Code (Kotlin/Swift)
                    ──Dart FFI──────────→ C/Rust（直接调用，无序列化）
```

**学习路径**（RN 背景，最快路径）：
1. Dart 语法 2h（和 TS 极其相似，多了 `final`/`late`/`required`）
2. Widget 树 + 状态管理 2h（对标 React Component + Hooks）
3. Platform Channel 1h（对标 TurboModule）
4. 布局系统 1h（Row/Column/Stack = Flexbox 的另一种写法）

---

### 🔴 BLE（蓝牙低功耗）— IoT 核心

**本质**：手机和硬件设备之间的近场无线通信协议。IoT App 的"血管"。

**GATT 模型（BLE 的数据结构）**：

```
BLE 设备
└── GATT Server
    └── Service（服务，按功能分组）     ← 类似一个 API 模块
        └── Characteristic（特征值）    ← 类似一个 API 接口
            ├── Value（值）             ← 接口的数据
            ├── Properties（权限）      ← Read / Write / Notify
            └── Descriptor（描述）      ← 元信息
```

**类比理解**：
- Service = RESTful API 的 `/users` 模块
- Characteristic = `/users/:id` 接口
- Read = GET、Write = POST、Notify = WebSocket 推送

**连接流程（前端视角）**：

```
1. Scan（扫描）     → 发现附近 BLE 设备（广播包含设备名/UUID）
2. Connect（连接）  → 建立 GATT 连接
3. Discover（发现） → 获取设备的 Service + Characteristic 列表
4. Read/Write（读写）→ 向 Characteristic 读数据 / 写指令
5. Notify（订阅）   → 监听设备主动推送的数据变化
6. Disconnect       → 断开连接
```

**Flutter BLE 代码模式**（flutter_blue_plus）：

```dart
// 1. 扫描
FlutterBluePlus.startScan(timeout: Duration(seconds: 4));
FlutterBluePlus.scanResults.listen((results) {
  // results 里有 device.name, device.id, rssi
});

// 2. 连接
await device.connect();

// 3. 发现服务
List<BluetoothService> services = await device.discoverServices();

// 4. 读写
await characteristic.read();
await characteristic.write([0x01, 0x02]);  // 发送指令（字节数组）

// 5. 订阅通知
await characteristic.setNotifyValue(true);
characteristic.value.listen((value) {
  // 设备主动推送的数据
});
```

**IoT App 的典型 BLE 场景**：

| 场景 | BLE 做什么 |
|------|-----------|
| 设备绑定 | 扫描 → 配对 → 写入 Wi-Fi 配置 → 设备联网 |
| 设备控制 | Write 指令（开关/调参） |
| 状态同步 | Subscribe Notify（设备主动推送状态变化） |
| OTA 升级 | 分包 Write 固件数据（MTU 限制每包 ~20-512 bytes） |
| 离线模式 | 无网时仍可通过 BLE 直连控制 |

**常见坑**：

| 问题 | 原因 | 解法 |
|------|------|------|
| 连接不稳定 | BLE 信号弱 / 距离远 | 断线重连 + 指数退避 |
| 数据丢包 | MTU 限制 / 写入太快 | 分包 + ACK 确认 + 流控 |
| Android/iOS 行为不一致 | 系统 BLE 栈实现差异 | 抽象层统一 + 平台特判 |
| 后台扫描被杀 | iOS 后台限制 | Core Bluetooth 后台模式 |
| 配对弹窗 | 系统级行为 | 文档引导用户 |

---

### 🟡 iOS 深度建设（有基础，需强化）

已有 iOS 开发基础，不如 Android 熟。需要建设的深度点：

| 维度 | Android | iOS |
|------|---------|-----|
| 语言 | Kotlin / Java | Swift / ObjC |
| UI 框架 | Jetpack Compose / XML | SwiftUI / UIKit |
| 构建工具 | Gradle | Xcode + Swift Package Manager |
| 包格式 | APK / AAB | IPA |
| 分发 | Google Play / 各商店 | App Store（唯一正规渠道） |
| 生命周期 | Activity/Fragment lifecycle | UIViewController lifecycle / SceneDelegate |
| Native Bridge | TurboModule (Java/Kotlin) | TurboModule (ObjC/Swift) |
| Flutter Bridge | MethodChannel (Kotlin) | MethodChannel (Swift) |
| 权限 | AndroidManifest + 运行时请求 | Info.plist + 运行时请求 |
| 后台限制 | 相对宽松 | 非常严格（后台只有几分钟） |
| 推送 | FCM | APNs |

**最小学习目标**：
- Swift 基础语法（和 Kotlin 非常像）
- Xcode 工程结构（Target / Scheme / Info.plist）
- Platform Channel 的 iOS 侧怎么写
- iOS 审核常见坑（热更新被拒、后台限制、隐私弹窗）

---

### 🟡 MQTT（IoT 长连接）

**本质**：轻量级发布/订阅消息协议。IoT 设备和云端的"心跳线"。

**和 HTTP / WebSocket 对比**：

| 维度 | HTTP | WebSocket | MQTT |
|------|------|-----------|------|
| 模式 | 请求-响应 | 全双工 | 发布/订阅 |
| 连接 | 短连接 | 长连接 | 长连接 |
| 开销 | 大（header 重） | 中 | 极小（最小 2 字节） |
| 适用 | Web API | 实时通信（Chat） | IoT 设备（低带宽/低功耗） |
| 断线恢复 | 无 | 需自建 | QoS + 遗嘱消息 |

**核心概念**：

| 概念 | 说明 |
|------|------|
| Broker | 消息中间件（类似 MQ Server） |
| Topic | 消息主题（如 `device/12345/status`） |
| Publish | 发布消息到 Topic |
| Subscribe | 订阅 Topic，收到所有发到这里的消息 |
| QoS 0/1/2 | 消息可靠性等级（0=最多一次，1=至少一次，2=恰好一次） |
| 遗嘱消息 | 设备异常断连时，Broker 自动发布预设消息（通知"设备离线"） |
| Retained Message | 新订阅者立即收到 Topic 的最后一条消息（获取设备最新状态） |

**在 IoT App 中的角色**：

```
手机 App ←── MQTT ──→ Broker（云端）←── MQTT ──→ IoT 设备
                         ↑
                    后端服务也订阅
```

BLE 管近场（手机直连设备），MQTT 管远程（设备通过 Wi-Fi 连云端，App 通过云端控制设备）。

---

## 统筹准备（Anker + DJI + LN + DD）

### 共同增量

| 知识点 | Anker | DJI | LN | DD |
|--------|-------|-----|----|----|
| Flutter | ✅ 核心 | ✅ 跨端选型 | ✅ 核心 | — |
| iOS | ✅ 核心 | ✅ 多端 | ✅ 多端 | — |
| BLE / MQTT | ✅ 核心 | — | ⚠️ 加分 | — |
| Server-Driven UI | — | — | ✅ 核心 | — |
| 编辑器 / Canvas | ✅ 核心 | — | ⚠️ 流程编辑 | — |
| 大前端架构 | ⚠️ 中 | ✅ 核心 | — | ✅ |
| AI Agent / MCP | ⚠️ 加分 | — | ✅ 加分 | ✅ 核心 |

### 建设优先级

1. **Flutter**（覆盖 Anker + DJI + LN）— 从 RN 类比，2-3 天建立专家级认知
2. **BLE 协议**（覆盖 Anker，LN 加分）— 1 天建立 GATT 模型 + 流程 + 常见坑
3. **iOS 基础**（覆盖 Anker + DJI + LN）— 和 Android 对比，1 天
4. **MQTT**（覆盖 Anker）— 半天，概念清晰即可
5. **Server-Driven UI**（覆盖 LN）— 你快应用框架就是这个，整理话术即可

---
