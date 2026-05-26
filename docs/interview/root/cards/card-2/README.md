# 牌 2：跨层通信架构（TurboModule / JSI）

> 命中：JD1-4（复杂问题攻关）+ JD2（RN 与原生对接，必备技能）
> 定位：不是只会 JS 的前端，能穿透 JS → C++ → Java/Swift 解决底层问题

---

## 目录

- [核心能力](#核心能力)
- [我的经验支撑](#我的经验支撑)
- [TurboModule 全链路](#turbomodule-全链路)
- [和 J2V8 的关联（快应用经验）](#和-j2v8-的关联快应用经验)
- [BLE 通信全链路优化](#ble-通信全链路优化)
- [TurboModule 调用全链路（JS → Android）](#turbomodule-调用全链路js--android)
  - [Codegen 机制](#codegen-机制)
  - [完整调用链](#完整调用链)
- [JSI 参数传递与返回值机制](#jsi-参数传递与返回值机制)
  - [HostObject 的真实作用](#hostobject-的真实作用)
  - [参数传递：类型转换，不是内存映射](#参数传递类型转换不是内存映射)
  - [返回值：同步 vs 异步](#返回值同步-vs-异步)
- [为什么 JSI 比 JSON Bridge 快](#为什么-jsi-比-json-bridge-快)
- [JSI 参数内存模型](#jsi-参数内存模型)
  - [基本类型：值拷贝](#基本类型值拷贝)
  - [引用类型（Object/Array）：逐字段惰性转换](#引用类型objectarray逐字段惰性转换)
  - [ArrayBuffer：真正的零拷贝共享内存](#arraybuffer真正的零拷贝共享内存)
- [Codegen 产物与 Native 侧接入](#codegen-产物与-native-侧接入)
  - [Codegen 生成什么](#codegen-生成什么)
  - [Native 侧接入三步](#native-侧接入三步)
- [Native → JS 事件推送](#native--js-事件推送)
- [Pure C++ TurboModule](#pure-c-turbomodule)
- [详细文档链接](#详细文档链接)

---

## 核心能力

```
JS/TS（业务层）
  ↓ JSI（C++ 直调）
C++（Fabric / Hermes / 通信层）
  ↓ JNI / ObjC Bridge
Java/Kotlin（Android）  |  ObjC/Swift（iOS）
```

**我能做的**：设计 JS Spec → 理解 JSI 通信机制 → 实现 Android 侧 TurboModule → 优化通信性能

---

## 我的经验支撑

| 经验 | 做了什么 | 本质 |
|------|---------|------|
| **快应用框架（J2V8 同步 Bridge）** | V8 + J2V8 实现 JS↔Java 同步通信 | 和 JSI 本质相同：JS 直调 Native |
| **CRN 工程化** | 理解 RN Bridge → JSI 迁移路径 | 通信架构升级 |
| **模块裁剪（反射解耦）** | 用反射解耦编译依赖 | Native 层架构设计 |
| **DEX 布局优化** | 热代码前置减少 page fault | Native 层性能优化 |

---

## TurboModule 全链路

### JS 侧（Spec 定义）

```typescript
// NativeBLEModule.ts — JS 侧接口定义（Codegen 输入）
import { TurboModule, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  connect(deviceId: string): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;  // 同步方法（JSI 支持）
  sendCommand(cmd: string, data: ArrayBuffer): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BLEModule');
```

### C++ 层（JSI 通信）

```
Codegen 根据 Spec 自动生成 C++ 接口
  → JS 调用 BLEModule.connect('xxx')
  → JSI 直接调用 C++ 函数（无 JSON 序列化）
  → C++ 通过 JNI 调用 Java 的 BluetoothGatt
```

### Android 侧（Java/Kotlin 实现）

```kotlin
class BLEModule(reactContext: ReactApplicationContext) : NativeBLEModuleSpec(reactContext) {
  
  override fun connect(deviceId: String): Promise<Boolean> {
    // 调用 Android BLE API
    val gatt = device.connectGatt(context, false, gattCallback)
    // ...
  }

  override fun isConnected(): Boolean {
    return connectionState == BluetoothGatt.STATE_CONNECTED  // 同步返回
  }
}
```

---

## 和 J2V8 的关联（快应用经验）

```
J2V8（快应用）：
  JS（V8）→ J2V8 API（同步调用）→ Java Feature

TurboModule（RN）：
  JS（Hermes）→ JSI（C++ 直调）→ JNI → Java Module

本质相同：JS 直接调用 Native 函数，无序列化，可同步返回
区别：J2V8 是 Java 直接操作 V8，JSI 是 C++ 中间层（更通用，跨引擎）
```

---

## BLE 通信全链路优化

```
现状：BLE 数据 → NativeModule → Bridge（序列化）→ JS
改造：BLE 数据 → TurboModule → JSI（直调）→ JS

+ Native 层事件聚合（100ms 批量）
+ 状态机下沉 Native（连接/重连不占 JS）
+ Zustand selector 精准更新（只有变化的字段触发重渲染）
```

---

## TurboModule 调用全链路（JS → Android）

### Codegen 机制

**文件发现规则：**
- 文件必须命名为 `Native<ModuleName>.ts`（如 `NativeBLEModule.ts`）
- Codegen 只扫描以 `Native` 前缀开头的文件，其他忽略
- 接口名约定为 `Spec extends TurboModule`（Codegen 模板按此名查找，事实上强制）
- 搜索路径在 `package.json` 的 `codegenConfig.jsSrcsDir` 中配置

**一次生成三层代码：**

| 生成物 | 语言 | 作用 |
|--------|------|------|
| C++ 接口 | C++ header/impl | JSI 绑定层，定义 HostObject 方法 |
| iOS 胶水 | ObjC++ | C++ → ObjC 桥接 |
| Android 胶水 | Java/Kotlin | C++ → JNI → Java 桥接 |

### 完整调用链

```
JS 调用: BLEModule.connect('device-123')
  │
  ▼
Hermes VM（JS 引擎）
  │  通过 JSI 找到 C++ HostObject 上注册的方法
  ▼
JSI 层（C++）— 直接函数调用，无 JSON 序列化
  │  jsi::Value → C++ 类型
  ▼
Codegen 生成的 C++ 胶水代码
  │  C++ 参数 → JNI 类型（jstring, jint 等）
  ▼
JNI 层: env->CallObjectMethod(javaModule, methodId, ...)
  │
  ▼
你写的 Java/Kotlin 实现: BLEModule.connect("device-123")
  │
  ▼
Android 系统 API（BluetoothGatt 等）
```

### 新旧架构对比

```
旧：JS → JSON 序列化 → Bridge（异步队列）→ JSON 反序列化 → Java
新：JS → JSI（C++ 直调）→ JNI → Java

区别：无序列化、可同步返回、无队列等待
```

---

## JSI 参数传递与返回值机制

### 本质：同进程 C++ 函数调用，不是共享内存

JSI 的核心不是"内存映射"，而是 **JS 引擎和 Native 代码在同一进程内，通过 C++ 函数指针直接互调**。

### HostObject 的真实作用

HostObject 不是"内存映射"，而是**在 JS 堆上注册一个代理对象**。JS 访问属性/方法时，触发 C++ 回调：

```cpp
class BLEModule : public jsi::HostObject {
  jsi::Value get(jsi::Runtime& rt, const jsi::PropNameID& name) override {
    if (name == "connect") {
      // 返回一个 C++ 函数包装成的 JS 函数
      return jsi::Function::createFromHostFunction(rt, name, 1,
        [](jsi::Runtime& rt, const jsi::Value& thisVal,
           const jsi::Value* args, size_t count) -> jsi::Value {
          std::string deviceId = args[0].asString(rt).utf8(rt);
          // 调用 Native 逻辑...
          return jsi::Value(true);
        });
    }
  }
};
```

### 参数传递：类型转换，不是内存映射

```
JS: connect('device-123')
  │  JS String
  ▼
JSI: args[0].asString(rt).utf8(rt) → std::string
  │  值拷贝/引用，不是共享内存
  ▼
JNI: env->NewStringUTF(stdString.c_str()) → jstring
  │
  ▼
Java: 拿到普通 Java String "device-123"
```

### 返回值：同步 vs 异步

**同步返回（isConnected）：**
```
Java: return true
  → JNI: jboolean → C++ bool
  → JSI: jsi::Value(true)
  → JS: 直接拿到 true（同一调用栈，同步）
```

**异步返回（connect → Promise）：**
```
Java: promise.resolve(result)
  → C++ 拿到结果，调用 JS Promise 的 resolve 回调
  → JS Promise 被 resolve，进入微任务队列
  → 下一个 tick JS 拿到结果
```

### 对比总结

| | 旧 Bridge | JSI |
|--|----------|-----|
| 通信方式 | 跨线程异步消息队列 | 同进程 C++ 函数调用 |
| 参数传递 | JSON 序列化/反序列化 | jsi::Value 类型转换（无序列化） |
| 同步能力 | ❌ 只能异步 | ✅ 可同步可异步 |
| 开销 | 序列化 + 队列调度 | 一次函数调用 |

---

## 为什么 JSI 比 JSON Bridge 快

### 旧 Bridge 一次调用的 6 步

```
JS: NativeModule.connect('device-123')
  ① 序列化：JS 对象 → JSON 字符串（遍历+拼接+内存分配）
  ② 入队：JSON 放入消息队列（队列锁、线程同步）
  ③ 线程切换：JS 线程 → Native 线程（上下文切换）
  ④ 反序列化：JSON → Native 对象（解析+类型判断+对象创建）
  ⑤ 方法查找：字符串名 → HashMap 查找方法
  ⑥ 执行
```

6 步中 4 步（①②③④）是纯开销，和业务无关。

### JSI 一次调用的 2 步

```
JS: BLEModule.connect('device-123')
  ① C++ 函数指针直调（编译时已绑定），参数类型转换
  ② 执行
```

### 三个根本原因

| 原因 | 旧 Bridge | JSI |
|------|----------|-----|
| 同进程直调 vs 跨线程消息 | JS/Native 线程隔离，必须消息队列 | 同一线程内函数指针直调 |
| 类型转换 vs 序列化 | 所有参数变字符串再解析回来 | `jsi::Value` 直接 `.asString()` 一步到位 |
| 编译时绑定 vs 运行时查找 | 每次通过字符串名 HashMap 查方法 | Codegen 编译时绑定函数指针，零查找 |

---

## JSI 参数内存模型

### 基本类型：值拷贝

```
JS number/boolean → jsi::Value（8 字节直接存值）→ C++ double/bool
零额外内存分配
```

### 引用类型（Object/Array）：逐字段惰性转换

JSI 传递 Object/Array 时，**不会一次性拷贝整个对象**。C++ 侧拿到的是一个 `jsi::Object` 引用（指向 JS 堆上的原对象），只有当你调用 `getProperty()` 读取某个字段时，才会对该字段做类型转换：

```cpp
// JS 传入: { name: 'device', rssi: -45, history: [...1000 items] }
void handleDevice(jsi::Runtime& rt, const jsi::Object& obj) {
  // 只读 name → 只转换 name 这一个字段
  auto name = obj.getProperty(rt, "name").asString(rt).utf8(rt);
  
  // history 有 1000 个元素，但你没读它 → 零开销
  // 旧 Bridge 会把 history 也一起 JSON.stringify → 巨大浪费
}
```

**"按需"的意思**：`jsi::Object` 是 JS 堆对象的 C++ 句柄，字段不读就不转换。对比旧 Bridge 必须 `JSON.stringify` 整个对象（包括你根本不用的字段）。

### Array 同理

```cpp
// JS 传入: [1, 2, 3, ..., 1000]
void handleArray(jsi::Runtime& rt, const jsi::Array& arr) {
  // 只读前 3 个 → 只转换 3 次
  auto v0 = arr.getValueAtIndex(rt, 0).asNumber();  // double 1
  auto v1 = arr.getValueAtIndex(rt, 1).asNumber();  // double 2
  auto v2 = arr.getValueAtIndex(rt, 2).asNumber();  // double 3
  // 剩余 997 个元素零开销
}
```

### ArrayBuffer：真正的零拷贝共享内存

这是唯一"共享内存"的场景，适合传感器数据、视频帧等大块二进制：

```cpp
// JS: new ArrayBuffer(1024)
void handleBuffer(jsi::Runtime& rt, const jsi::ArrayBuffer& buf) {
  uint8_t* data = buf.data(rt);  // 直接拿到指针，指向 JS 堆同一块内存
  size_t size = buf.size(rt);
  // Native 直接读写，JS 侧立即可见，零拷贝
}
```

### 内存开销对比

| 类型 | JSI | 旧 Bridge |
|------|-----|----------|
| number/boolean | 零分配（8字节 jsi::Value） | JSON 字符串化 "123" |
| string | 一次 utf8 拷贝 | JSON 转义 + 拷贝 |
| Object（10 字段用 2 个） | 只转换 2 个字段 | 全部 10 字段序列化 |
| Array（1000 元素用 3 个） | 只转换 3 个元素 | 全部 1000 元素序列化 |
| ArrayBuffer（1MB 二进制） | **零拷贝，共享内存** | Base64 编码 → 字符串膨胀 33% |

```
旧 Bridge 传 { name: 'x', data: [1,2,...1000] }：
  内存 = 原对象 + JSON 字符串 + 反序列化新对象 = 3 份

JSI 传同样的对象：
  内存 = 原对象（JS 堆）+ 按需转换的字段 ≈ 1 份
```

---

## Codegen 产物与 Native 侧接入

### Codegen 生成什么

以 `NativeBLEModule.ts` 为例，构建时生成：

```
android/app/build/generated/source/codegen/
├── java/com/facebook/fbreact/specs/
│   └── NativeBLEModuleSpec.java        ← Java 抽象基类（你要继承的）
├── jni/
│   ├── NativeBLEModuleCxxSpecJSI.h     ← C++ JSI 绑定 + JNI 胶水
│   └── NativeBLEModuleCxxSpecJSI.cpp
└── schema.json                          ← 中间产物（类型描述）
```

- 在 `build/` 目录下，构建时自动生成，不提交 git
- 每次 `./gradlew build` 时 Codegen 脚本自动执行

| 生成物 | 内容 | 你需要碰吗 |
|--------|------|-----------|
| Java 抽象基类 | 方法签名 + 方法映射表 | ❌ 只需继承 |
| C++ JSI 绑定 | HostObject 注册 + jsi::Value 类型转换 | ❌ 完全不碰 |
| C++ JNI 胶水 | `env->CallObjectMethod` 调用你的 Java | ❌ 完全不碰 |

**你不需要写任何 JNI 代码。** Codegen 生成的 C++ 已经封装了全部 JNI 调用（找方法、转参数、调用、转返回值）。RN 框架 + Codegen 把 JSI→JNI→Java 这条链路完全自动化了。

### Native 侧接入三步

**① 继承生成的抽象基类，实现方法**

```kotlin
class BLEModule(reactContext: ReactApplicationContext)
  : NativeBLEModuleSpec(reactContext) {  // ← 继承 Codegen 产物

  override fun getName() = NAME
  override fun connect(deviceId: String): Boolean { /* 业务逻辑 */ }
  override fun disconnect() { /* ... */ }
  override fun isConnected(): Boolean { /* ... */ }

  companion object { const val NAME = "BLEModule" }
}
```

**② 创建 Package 注册模块**

```kotlin
class BLEPackage : TurboReactPackage() {  // ← RN 框架提供的基类
  override fun getModule(name: String, ctx: ReactApplicationContext): NativeModule? {
    return if (name == BLEModule.NAME) BLEModule(ctx) else null
  }
  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(BLEModule.NAME to ReactModuleInfo(
      BLEModule.NAME, BLEModule::class.java.name, isTurboModule = true
    ))
  }
}
```

`TurboReactPackage` 来自 `com.facebook.react.TurboReactPackage`（RN 框架），比旧的 `ReactPackage` 多了模块元信息，支持**懒加载**（JS 首次调用时才实例化）。

**③ Application 中注册 Package**

```kotlin
override fun getPackages(): List<ReactPackage> {
  val packages = PackageList(this).packages.toMutableList()
  packages.add(BLEPackage())
  return packages
}
```

### 串联流程

```
App 启动 → 注册 BLEPackage
  → TurboModuleManager 扫描所有 Package
  → JS 首次调用 TurboModuleRegistry.get('BLEModule')
  → Package.getModule() 创建 BLEModule 实例
  → Codegen 生成的 C++ 把 Java 实例包装为 JSI HostObject
  → JS 拿到代理对象，调方法 → C++(JSI) → C++(JNI) → 你的 Java 实现
```

名字对上（JS 侧 `'BLEModule'` = Java 侧 `NAME`）就自动串联。

---

## Native → JS 事件推送

### Spec 中声明 EventEmitter

```typescript
// NativeBLEModule.ts
import { TurboModule, TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native';  // ← 关键导入

export type BLEStatusEvent = {
  status: string;
  deviceId: string;
};

export interface Spec extends TurboModule {
  connect(deviceId: string): Promise<boolean>;
  disconnect(): void;

  // 用 EventEmitter<T> 声明事件，Codegen 会生成 Native 侧的 emit 方法
  readonly onStatusChange: EventEmitter<BLEStatusEvent>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BLEModule');
```

### Android 侧发送事件

```kotlin
class BLEModule(reactContext: ReactApplicationContext)
  : NativeBLEModuleSpec(reactContext) {

  override fun getName() = NAME

  override fun connect(deviceId: String) {
    bluetoothAdapter.getRemoteDevice(deviceId)
      .connectGatt(reactContext, false, object : BluetoothGattCallback() {

        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
          // 状态变化时 emit 事件给 JS
          val eventData = WritableNativeMap().apply {
            putString("status", if (newState == STATE_CONNECTED) "connected" else "disconnected")
            putString("deviceId", deviceId)
          }
          emitOnStatusChange(eventData)
          // ↑ Codegen 生成在基类 NativeBLEModuleSpec 中的方法
          //   命名规则：emit + Spec 中的事件属性名（首字母大写）
        }
      })
  }

  companion object { const val NAME = "BLEModule" }
}
```

### JS 侧监听

```typescript
import NativeBLEModule from './NativeBLEModule';
import { useEffect } from 'react';

function useBLEStatus() {
  useEffect(() => {
    const subscription = NativeBLEModule.onStatusChange.addListener((event) => {
      // event 类型安全：{ status: string, deviceId: string }
      console.log(event.status, event.deviceId);
    });
    return () => subscription.remove();
  }, []);
}
```

### 事件推送链路

```
Android BLE 回调触发（Native 线程）
  ▼ 调用 emitOnStatusChange(data)（Codegen 生成的基类方法）
  ▼ 基类内部通过 JSI 调用 JS 侧 EventEmitter.emit()
  ▼ JS 侧 addListener 注册的回调被触发
  ▼ React 组件更新 UI
```

---

## Pure C++ TurboModule

适用场景：逻辑不依赖平台 API（加密、协议解析、数学计算），一份 C++ 两端共用。

### 开发步骤

**① Spec（和普通 TurboModule 一样）**

```typescript
// NativeCryptoModule.ts
import { TurboModule, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  sha256(input: string): string;
  encrypt(data: string, key: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('CryptoModule');
```

**② C++ 实现（不写 Java/ObjC）**

```cpp
// CryptoModule.h
#pragma once
#include <NativeCryptoModuleCxxSpec.h>  // Codegen 生成的 C++ 抽象接口

class CryptoModule : public NativeCryptoModuleCxxSpec<CryptoModule> {
public:
  CryptoModule(std::shared_ptr<CallInvoker> jsInvoker);

  jsi::String sha256(jsi::Runtime& rt, jsi::String input) {
    std::string data = input.utf8(rt);
    std::string hash = computeSha256(data);  // 你的 C++ 逻辑
    return jsi::String::createFromUtf8(rt, hash);
  }
};
```

**③ 注册**

```cpp
// 在 RN 提供的注册入口中
std::shared_ptr<TurboModule> CryptoModuleProvider(
    const std::string& name,
    const std::shared_ptr<CallInvoker>& jsInvoker) {
  if (name == "CryptoModule") {
    return std::make_shared<CryptoModule>(jsInvoker);
  }
  return nullptr;
}
```

**④ CMakeLists.txt**

```cmake
add_library(crypto_module SHARED CryptoModule.cpp)
target_link_libraries(crypto_module react_nativemodule_core)
```

### 和普通 TurboModule 对比

| | 普通 TurboModule | Pure C++ Module |
|--|---|---|
| 实现语言 | Java/Kotlin + ObjC/Swift（两端各写） | C++（一份共用） |
| 调用链 | JS → JSI(C++) → JNI → Java | JS → JSI(C++) → 你的 C++（最短） |
| 需要 JNI | Codegen 生成 | ❌ 不需要 |
| 适用 | 需要平台 API（BLE、相机） | 纯计算（加密、解析、数学） |

---

## 详细文档链接

- [RN↔Native 通信](../../RN/rn-native-communication.md)
- [TurboModule Android 侧实现](../../RN/turbomodule-android.md)
- [J2V8 深入](../../../resume/explain/3.1-xm/quickapp-framework/j2v8-deep.md)
- [快应用框架追问清单](../../../resume/explain/3.1-xm/quickapp-framework/traps.md)
- [IoT BLE 性能方案](../../RN/iot-ble-performance.md)
- [RN 全景（Android 启动链路）](../../RN/rn-full-picture.md)
- [Android 线程模型](../../../resume/explain/3.1-xm/quickapp-framework/android-note/02-process-thread/README.md)