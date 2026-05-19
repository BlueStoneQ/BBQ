# 面试笔记（边聊边记）

> 核心优先，确认后记录。过一会儿整理。

---

## 核心定位

- 投的是 JD2（大前端架构师/RN 技术负责人）
- 他们的 App：IoT 类，RN 开发，BLE 连接智能硬件
- 链路：RN App → Native Module（BLE 插件）→ Android/iOS 蓝牙 API → 硬件

## 我的价值主张

1. 帮他们建设 CRN 级别的全套工程化方案（分 Bundle/热更新/灰度/CI/CD/DDD 规划）
2. RN ↔ Native 桥接深度能力（造过类 RN 框架，写 TurboModule 是降维）
3. 体验优于速度：BLE 稳定性和速率是追求（连接成功率、重连、传输效率）

---

## 聊天记录

### 1. RN ↔ Native 通信（第一性原理）

**本质问题**：两个不同运行时（JS 引擎 和 JVM/ART）怎么互相调用？

**通道演进**：

| 方案 | 中间层 | 同步/异步 | 序列化 | 性能 |
|------|--------|----------|--------|------|
| 旧 Bridge | JS → JSON → MessageQueue → JSON → Java | 异步 | JSON | 慢 |
| 新 JSI | JS → C++ Host Object → JNI → Java | 同步可选 | 无 | 快 |
| J2V8（我的框架） | JS → V8 API → Java 直接绑定 | 同步 | 无 | 快 |

**旧 Bridge 慢的三个原因**：
1. 序列化：每次调用 JSON 序列化/反序列化
2. 批量排队：消息攒一批再发，引入延迟
3. 单通道：所有模块共用一个 Bridge，高频调用排队阻塞

**新架构 JSI 核心思想**：让 JS 直接持有 Native 对象的引用（Host Object），调用方法 = 直接调 C++ 函数，无序列化无队列。

**对 BLE 场景的意义**：
- 旧架构通信开销 ~5-15ms（序列化+队列）
- 新架构通信开销 <1ms（直调）
- BLE 高频状态交互（设备发现/连接变化/数据流），开销差异会累积

**关键认知：TurboModule 开发者不需要写 C++**
- 你写：TS Spec + Java/Kotlin 实现
- RN 框架做：Codegen 生成 C++ 胶水代码 + JSI 绑定
- 开发体验：写 TS 定义接口 → Codegen → 写 Java 实现 → JS 直接调用

**我的降维优势**：
- J2V2 同步 Bridge 和 JSI 解决同一个问题（去掉异步中间层）
- 我理解"为什么要这样设计"，因为我自己做过同样的选择
- 区别：J2V8 是 Java 直接绑定 V8，JSI 是 C++ 层 + JNI 到 Java

---

### 2. Host Object / JSI / J2V8 深入

**C++ Host Object 本质**：一个 C++ 对象注册到 JS 引擎全局作用域，JS 像访问普通对象一样访问它。浏览器的 `document`/`window`/`console` 就是 Host Object。所有 JS 引擎都有这个能力。

**V8 有 Host Object 吗**：有。`v8::ObjectTemplate` / `v8::FunctionTemplate`。

**J2V8 本质**：通过 JNI 把 V8 的 Host Object 能力封装给 Java 使用。Java 开发者不用写 C++ 就能向 JS 注册原生对象/方法。

**JSI vs J2V8**：

| 维度 | J2V8 | JSI |
|------|------|-----|
| 依托引擎 | 绑定 V8 | 引擎无关（抽象接口层） |
| 实现语言 | Java（封装 V8 C++ API） | C++ |
| 引擎可替换 | ❌ | ✅（Hermes/V8/JSC 都支持） |
| 跨平台 | Android only | Android + iOS |

**JSI 不只有 Hermes 支持**：
- Hermes ✅（默认）
- V8 ✅（社区 react-native-v8）
- JSC ✅（兼容）

JSI 是抽象接口标准，任何引擎实现 JSI 接口就能接入 RN。

**JSI 设计收益**：
1. 引擎可替换（不绑定某个引擎）
2. 同步调用成为可能（不再强制异步）
3. 无序列化开销（直接传引用）
4. TurboModule 懒加载（不用启动时全量注册）
5. Codegen 类型安全（编译时检查）

**RN 版本支持**：
- RN 0.68：新架构可选开启
- RN 0.73：新架构稳定
- **RN 0.76+：新架构默认开启**（2024.10 发布）
- 升级到 0.76+ 就天然走 JSI 通道，旧 Native Module 通过兼容层仍可运行

---

### 3. JSI 双工通信 + BLE 场景方案

**JSI 支持双工吗？**

支持。两个方向：

- **JS → Native**（主动调用）：JS 调用 Host Object 的方法 → 直接执行 C++/Java 代码
- **Native → JS**（事件/回调）：Native 持有 JS 函数引用（`jsi::Function`），直接调用

**旧架构的双工方案**：

旧架构用的确实是 Bridge（本质是异步消息队列，不是 Web 里的 JSBridge 但思路类似）：
- JS → Native：`NativeModules.XXX.method()` → JSON 序列化 → Bridge 消息队列 → Native 处理
- Native → JS：`RCTDeviceEventEmitter`（事件）或 callback/Promise → Bridge 消息队列 → JS 收到

**新架构（JSI）的双工**：
- JS → Native：直接调 Host Object 方法（同步/异步可选）
- Native → JS：两种方式
  1. **回调/Promise**：TurboModule 方法返回 Promise，Native resolve/reject
  2. **事件流**：`RCTModernEventEmitter`（新）或仍用 `NativeEventEmitter`（兼容），Native 直接调 JS 函数引用

**收益对比**：

| 维度 | 旧 Bridge 双工 | 新 JSI 双工 |
|------|---------------|-------------|
| JS→Native | 异步，有延迟 | 同步可选，<1ms |
| Native→JS | 异步事件，有延迟 | 直接调 JS 函数引用 |
| 序列化 | 双向都要 JSON | 无 |
| 类型安全 | 无 | Codegen 保证 |
| 高频场景 | 容易积压（BLE 数据流） | 无队列瓶颈 |

---

**BLE 场景解决方案：TurboModule 还是 RN Plugin？**

**答案：两者不矛盾，TurboModule 是实现方式，Plugin（库/包）是分发形式。**

概念澄清：
- **TurboModule** = RN 新架构下 Native Module 的实现标准（怎么写）
- **RN Plugin/Library** = 一个 npm 包，里面包含 JS 接口 + Native 实现（怎么分发）
- 一个 RN Plugin 的 Native 部分就是用 TurboModule（新）或 Native Module（旧）实现的

**BLE 场景的完整方案**：

```
npm 包（RN Plugin）: @myapp/react-native-ble
├── src/                    ← JS 层
│   ├── NativeBLE.ts        ← TurboModule Spec（TS 接口定义）
│   ├── useBLE.ts           ← React Hook 封装
│   └── index.ts            ← 导出
├── android/                ← Android Native 实现
│   └── BLEModule.kt        ← TurboModule 实现（调 Android BLE API）
├── ios/                    ← iOS Native 实现
│   └── BLEModule.swift     ← TurboModule 实现（调 CoreBluetooth）
└── package.json            ← codegenConfig 配置
```

**通信流程（BLE 连接设备）**：

```
JS 层                          Native 层（Android）
─────                          ──────────────────
useBLE() Hook
  │
  ├─ connect(deviceId) ──────→ BLEModule.connect()
  │   [TurboModule 同步调用]      → BluetoothGatt.connectGatt()
  │                                → 等待连接...
  │                                → 连接成功
  │  ←── Promise.resolve() ────── 返回结果
  │
  ├─ 监听事件 ←─────────────── onConnectionStateChange 回调
  │   [NativeEventEmitter]        → emit("BLE_STATE_CHANGE", {connected: true})
  │
  └─ 接收数据 ←─────────────── onCharacteristicChanged 回调
      [NativeEventEmitter]        → emit("BLE_DATA", {data: bytes})
```

**关键设计决策**：
- 主动操作（scan/connect/write）→ TurboModule 方法（Promise）
- 被动事件（设备发现/状态变化/数据接收）→ NativeEventEmitter 事件流
- 为什么不全用 Promise？因为 BLE 事件是持续的、多次触发的，不是一次性请求

---

### 4. BLE 高频数据流收益 + TurboModule 本质 + BLE 完整数据流

---

#### 4.1 BLE 高频数据流场景，JSI 收益在哪？

BLE 通信不是"发一个请求等一个响应"，而是**持续的双向数据流**：

- 设备每 100ms 上报一次传感器数据（心率/温度/电量）
- 用户操作设备（开关/调节）需要即时响应
- 设备状态随时可能变化（断连/重连/错误）

**旧架构下的问题**：

```
设备每 100ms 发一次数据：
  Native 收到 BLE 数据
  → JSON.stringify({deviceId, data, timestamp})    // 序列化开销
  → 放入 Bridge 消息队列                            // 排队等待
  → 批量发送（默认 5ms 一批）                       // 额外延迟
  → JS 侧 JSON.parse()                            // 反序列化
  → 触发 setState → 重渲染 UI

问题：
  - 10 个设备 × 每秒 10 次 = 每秒 100 次 Bridge 消息
  - 序列化/反序列化 CPU 开销累积
  - 消息队列积压 → UI 更新延迟 → 用户感知"不跟手"
  - 严重时 Bridge 阻塞 → 其他模块（导航/动画）也卡
```

**新架构（JSI）下**：

```
设备每 100ms 发一次数据：
  Native 收到 BLE 数据
  → 直接调用 JS 函数引用（无序列化、无队列）       // <1ms
  → JS 收到 → 更新状态 → 重渲染 UI

收益：
  - 无序列化开销（直接传 ArrayBuffer 引用）
  - 无队列积压（直接调用，不排队）
  - Bridge 不再是瓶颈（其他模块不受影响）
  - 可以传二进制数据（BLE 原始字节），不用 Base64 编码
```

**量化收益**：
- 单次通信延迟：~10ms → <1ms
- CPU 开销（100 次/秒）：JSON 序列化/反序列化消失
- 内存：不再创建大量临时 JSON 字符串对象
- 最重要的：**Bridge 不再是全局瓶颈**，BLE 高频数据不会影响 UI 动画流畅度

---

#### 4.2 TurboModule 本质是什么？

**你的理解基本对，但更精确地说：**

旧 Native Module：
```
JS → Bridge（JSON 消息队列）→ Java/ObjC 代码
     ↑ 这是一个"邮局"，所有信件都要经过它
```

TurboModule：
```
JS → JSI（C++ Host Object）→ JNI → Java/Kotlin 代码
     ↑ 这是一个"直通电话"，JS 直接持有 Native 对象引用
```

**和 .so 的类比**：

不完全一样。.so 是编译好的二进制库，通过 dlopen 加载。TurboModule 更像是：

- **旧 Native Module** = 一个 Java 类，通过 Bridge "邮局"和 JS 通信
- **TurboModule** = 同样是一个 Java/Kotlin 类，但通过 JSI "直通电话"和 JS 通信

本质区别不在于"模块本身是什么"，而在于**通信通道不同**：

| 维度 | 旧 Native Module | TurboModule |
|------|-----------------|-------------|
| 模块本身 | Java/ObjC 类 | Java/Kotlin 类（一样的） |
| 通信通道 | Bridge（异步JSON队列） | JSI（同步C++直调） |
| 加载时机 | 启动时全量注册 | 首次访问时懒加载 |
| 接口定义 | 无强制规范 | TS Spec + Codegen（类型安全） |
| 同步方法 | 不支持 | 支持 |

**一句话**：TurboModule 不是新的"模块格式"，而是新的"通信方式" + "加载策略" + "类型约束"。模块本身还是 Java/Kotlin 代码。

---

#### 4.3 BLE 连接智能硬件：完整数据流与关键节点

**场景**：用户打开 App → 扫描附近设备 → 连接某个智能灯 → 控制开关/亮度 → 接收设备状态

**完整数据流**：

```
┌─────────────────────────────────────────────────────────────────┐
│                        JS 层（React）                             │
│                                                                   │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐  │
│  │ 设备列表 │    │ 连接管理  │    │ 控制面板  │    │ 状态展示   │  │
│  │ Screen  │    │ Hook     │    │ Screen   │    │ Component │  │
│  └────┬────┘    └────┬─────┘    └────┬─────┘    └─────┬─────┘  │
│       │              │               │                 │         │
│       │    ┌─────────┴───────────────┴─────────────────┘         │
│       │    │                                                      │
│       │    ▼                                                      │
│  ┌────┴────────────────────────────────┐                         │
│  │         useBLE() Hook               │                         │
│  │  - devices: Device[]                │                         │
│  │  - connectedDevice: Device | null   │                         │
│  │  - scan() / connect() / write()     │                         │
│  │  - onData / onStateChange 监听      │                         │
│  └────────────────┬────────────────────┘                         │
│                   │                                               │
└───────────────────┼───────────────────────────────────────────────┘
                    │ TurboModule 调用 + EventEmitter 监听
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Native 层（Android）                              │
│                                                                     │
│  ┌─────────────────────────────────────────┐                       │
│  │         BLETurboModule                   │                       │
│  │                                          │                       │
│  │  JS→Native（TurboModule 方法）：          │                       │
│  │    scan() → Promise<Device[]>            │                       │
│  │    connect(id) → Promise<void>           │                       │
│  │    disconnect(id) → void                 │                       │
│  │    write(id, serviceUUID,                │                       │
│  │          charUUID, data) → Promise<void> │                       │
│  │    read(id, serviceUUID,                 │                       │
│  │         charUUID) → Promise<byte[]>      │                       │
│  │                                          │                       │
│  │  Native→JS（EventEmitter 事件）：         │                       │
│  │    "BLE_DEVICE_FOUND"     → {device}     │                       │
│  │    "BLE_STATE_CHANGE"     → {id, state}  │                       │
│  │    "BLE_DATA_RECEIVED"    → {id, data}   │                       │
│  │    "BLE_ERROR"            → {id, error}  │                       │
│  └──────────────────┬──────────────────────┘                       │
│                     │                                               │
│                     ▼                                               │
│  ┌──────────────────────────────────────────┐                      │
│  │      BLE Manager（Java/Kotlin）           │                      │
│  │                                           │                      │
│  │  - BluetoothAdapter（扫描）               │                      │
│  │  - BluetoothGatt（连接/读写）             │                      │
│  │  - BluetoothGattCallback（回调）          │                      │
│  │  - 重连策略 / 心跳检测 / 超时管理         │                      │
│  └──────────────────┬───────────────────────┘                      │
│                     │                                               │
└─────────────────────┼───────────────────────────────────────────────┘
                      │ Android Bluetooth API
                      ▼
┌───────────────────────────────────────────────────────────────────┐
│                   硬件层                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │ 智能灯泡  │  │ 温度传感器│  │ 智能插座  │                        │
│  └──────────┘  └──────────┘  └──────────┘                        │
└───────────────────────────────────────────────────────────────────┘
```

**关键节点详解**：

**节点 1：扫描（Scan）**
```
用户点击"扫描" 
  → JS: useBLE().scan()
  → TurboModule: BLEModule.scan()
  → Native: BluetoothLeScanner.startScan(callback)
  → 发现设备 → emit("BLE_DEVICE_FOUND", {id, name, rssi})
  → JS 收到事件 → 更新 devices 列表 → UI 渲染设备卡片
```
关键点：扫描是持续的，用事件流（不是 Promise），因为会多次触发。

**节点 2：连接（Connect）**
```
用户点击某设备"连接"
  → JS: useBLE().connect(deviceId)
  → TurboModule: BLEModule.connect(deviceId) → Promise
  → Native: BluetoothDevice.connectGatt(context, false, gattCallback)
  → gattCallback.onConnectionStateChange(STATE_CONNECTED)
  → 发现 Services → 发现 Characteristics
  → Promise.resolve()
  → 同时 emit("BLE_STATE_CHANGE", {id, state: "connected"})
  → JS 更新状态 → UI 跳转到控制面板
```
关键点：
- connect 返回 Promise（一次性结果）
- 同时通过事件通知状态变化（因为后续可能断连）
- 连接后要做 Service Discovery（发现设备支持哪些服务/特征值）

**节点 3：写入控制指令（Write）**
```
用户拖动亮度滑块
  → JS: useBLE().write(deviceId, serviceUUID, charUUID, [0x01, brightness])
  → TurboModule: BLEModule.write(...) → Promise
  → Native: BluetoothGattCharacteristic.setValue(data)
           → BluetoothGatt.writeCharacteristic(char)
  → gattCallback.onCharacteristicWrite(status)
  → Promise.resolve() / reject(error)
```
关键点：
- 写入是一次性操作，用 Promise
- 数据格式是字节数组（BLE 协议层是二进制）
- 新架构可以直接传 ArrayBuffer，不用 Base64 编码

**节点 4：接收设备数据（Notify/Indicate）**
```
设备主动上报温度数据（每秒一次）
  → Native: gattCallback.onCharacteristicChanged(char)
  → 解析字节数据 → emit("BLE_DATA_RECEIVED", {id, service, char, data: [25, 0x80]})
  → JS 收到事件 → 解析协议 → 更新温度显示
```
关键点：
- 这是 Native → JS 方向，必须用事件（持续多次触发）
- 高频场景（100ms 一次），JSI 的无序列化优势在这里体现
- 需要在 Native 侧先 enableNotification（订阅特征值变化）

**节点 5：断连与重连**
```
设备走出范围 / 蓝牙关闭
  → Native: gattCallback.onConnectionStateChange(STATE_DISCONNECTED)
  → emit("BLE_STATE_CHANGE", {id, state: "disconnected", reason})
  → JS 收到 → UI 提示断连
  → 自动重连策略（Native 侧）：
    - 指数退避重试（1s → 2s → 4s → 8s → 放弃）
    - 最大重试次数
    - 重连成功 → emit("BLE_STATE_CHANGE", {id, state: "connected"})
    - 重连失败 → emit("BLE_ERROR", {id, error: "MAX_RETRY_EXCEEDED"})
```
关键点：
- 重连逻辑放 Native 侧（不依赖 JS 线程，App 后台也能重连）
- 指数退避避免频繁重试耗电
- 状态变化通过事件通知 JS

**架构设计决策总结**：

| 操作类型 | 通信方式 | 原因 |
|---------|---------|------|
| scan/connect/disconnect/write/read | TurboModule 方法 → Promise | 一次性操作，有明确的成功/失败 |
| 设备发现/状态变化/数据接收/错误 | NativeEventEmitter 事件 | 持续触发、多次触发、时机不确定 |
| 重连策略/心跳 | 纯 Native 侧 | 不依赖 JS 线程，后台也能工作 |
| 状态管理 | JS 侧状态机 | 断开→连接中→已连接→错误，UI 驱动 |

---

### 补充：iOS 动态加载限制

- iOS **禁止运行时动态加载原生代码**（App Store 政策 + 系统代码签名验证）
- Android 技术上能 dlopen .so（Google Play 不推荐但能做）
- iOS 连技术上都做不到——未签名代码无法执行
- iOS 的 C++ 库必须编译时静态链接进 App（Framework 形式）
- **唯一能动态加载的是 JS**（解释执行，非原生机器码）
- 这就是为什么 RN 热更新只能更新 JS Bundle，不能更新原生层

| | Android | iOS |
|---|---------|-----|
| 原生代码动态加载 | 技术上能（dlopen） | 不能（禁止） |
| JS Bundle 动态加载 | ✅ | ✅ |
| 库格式 | .so | Framework (.framework/.xcframework) |

---

### RN 常用插件 + Expo 选型

**常用插件（2026）**：

| 类别 | 插件 |
|------|------|
| 导航 | @react-navigation/native + native-stack |
| 状态 | zustand |
| 网络 | axios + @tanstack/react-query |
| 列表 | @shopify/flash-list |
| 动画 | reanimated + gesture-handler |
| 存储 | react-native-mmkv |
| 图片 | react-native-fast-image |
| 国际化 | i18next |
| 相机 | react-native-vision-camera |
| BLE | react-native-ble-plx |
| 推送 | @react-native-firebase/messaging |
| Crash | @sentry/react-native |

**Expo 选型**：IoT + BLE 场景不推荐 Expo Managed，用 Bare RN。原因：
- 需要写 BLE TurboModule（Expo 受限）
- 需要控制 Gradle 配置
- 需要分 Bundle + 自建热更新
- Expo Managed 这些都做不了

可以单独用 Expo 的部分工具（expo-modules-core/expo-dev-client），不需要全盘 Expo。

---
