# TurboModule 开发指南（Android + iOS）

## 目录

- [全流程概览](#全流程概览)
- [Step 1: JS Spec 定义](#step-1-js-spec-定义)
- [Step 2: Codegen 配置](#step-2-codegen-配置)
- [Step 3: Android 侧实现](#step-3-android-侧实现)
- [Step 4: iOS 侧实现](#step-4-ios-侧实现)
- [Step 5: Pure C++ TurboModule](#step-5-pure-c-turbomodule)
- [关键规则速查](#关键规则速查)

---

## 全流程概览

```
① 写 JS Spec（定义接口）
  → ② 配置 Codegen（告诉构建工具去哪找 Spec）
  → ③ 构建时 Codegen 自动生成胶水代码（C++ / Java 基类 / ObjC Protocol）
  → ④ Android 侧：继承 Java 基类 + 实现方法 + 注册 Package
  → ⑤ iOS 侧：遵循 ObjC Protocol + 实现方法 + RCT_EXPORT_MODULE
```

---

## Step 1: JS Spec 定义

### 文件命名规则（强制）

```
文件名必须以 Native 开头：Native<ModuleName>.ts
例如：NativeBLEModule.ts、NativeStorageModule.ts

❌ BLEModule.ts        → Codegen 会忽略
❌ ble-module.ts       → Codegen 会忽略
✅ NativeBLEModule.ts  → Codegen 识别并处理
```

### 接口命名规则（强制）

```typescript
// 接口必须叫 Spec，必须 extends TurboModule
export interface Spec extends TurboModule { ... }

// 必须用 TurboModuleRegistry 导出
export default TurboModuleRegistry.getEnforcing<Spec>('模块名');
```

### 完整示例

**文件位置**：放在 `codegenConfig.jsSrcsDir` 指定的目录下（通常是 `src/specs/`）

```
my-app/
├── src/
│   └── specs/              ← Codegen 扫描这个目录
│       └── NativeBLEModule.ts
├── package.json            ← 配置 codegenConfig.jsSrcsDir: "src/specs"
└── ...
```

```typescript
// src/specs/NativeBLEModule.ts
import { TurboModule, TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native';

// ─── 复杂类型声明 ───

// Object 类型：用 TS 接口/type 声明（Codegen 映射为 ReadableMap / NSDictionary）
export type DeviceInfo = {
  id: string;
  name: string;
  rssi: number;
  isConnectable: boolean;
};

// 事件 payload 类型
export type BLEStatusEvent = {
  status: string;
  deviceId: string;
};

// ─── Spec 接口 ───

export interface Spec extends TurboModule {
  // ─── 同步方法 ───
  // 特征：直接返回值（非 Promise），JSI 支持同步调用
  isConnected(): boolean;
  getDeviceInfo(): DeviceInfo;                    // 返回 Object
  getConnectedDeviceIds(): string[];              // 返回 Array

  // ─── 异步方法 ───
  // 特征：返回 Promise<T>，Native 侧通过 resolve/reject 回调
  connect(deviceId: string): Promise<boolean>;
  sendCommand(cmd: string, data: ArrayBuffer): Promise<void>;  // ArrayBuffer 传二进制
  scanDevices(timeout: number): Promise<DeviceInfo[]>;          // Promise<Array<Object>>

  // ─── 带复杂参数 ───
  // Object 参数：直接用 type/interface 声明
  updateConfig(config: { interval: number; retryCount: number; autoReconnect: boolean }): void;
  // Array 参数
  connectMultiple(deviceIds: string[]): Promise<boolean[]>;
  // 可选参数
  setFilter(name?: string, rssiThreshold?: number): void;

  // ─── 事件声明（Native → JS 推送）───
  // 特征：readonly + EventEmitter<PayloadType>
  // Codegen 会在 Native 基类中生成 emitOnStatusChange(data) 方法
  readonly onStatusChange: EventEmitter<BLEStatusEvent>;
}

// 导出：'BLEModule' 是注册名，Native 侧 NAME 必须一致
export default TurboModuleRegistry.getEnforcing<Spec>('BLEModule');
```

### 声明特征速查

| 类型 | 声明方式 | Native 侧对应 |
|------|---------|---------------|
| **同步方法** | `methodName(): ReturnType` | 直接 return 值 |
| **异步方法** | `methodName(): Promise<T>` | 通过 resolve/reject 回调 |
| **事件** | `readonly eventName: EventEmitter<T>` | 基类生成 `emitEventName(data)` |
| **Object 参数** | `{ key: type }` 或 `type Xxx = {...}` | Android: ReadableMap / iOS: NSDictionary |
| **Array 参数** | `T[]` 或 `Array<T>` | Android: ReadableArray / iOS: NSArray |
| **可选参数** | `param?: type` | Android: @Nullable / iOS: nullable |
| **ArrayBuffer** | `ArrayBuffer` | 二进制数据（零拷贝共享内存） |
| **回调** | `(result: T) => void` | Android: Callback / iOS: RCTResponseSenderBlock |

### 支持的类型

| TS 类型 | Android (Java) | iOS (ObjC) |
|---------|---------------|------------|
| `string` | String | NSString |
| `number` | double | NSNumber (double) |
| `boolean` | boolean | NSNumber (BOOL) |
| `Object` (字面量) | ReadableMap | NSDictionary |
| `Array<T>` | ReadableArray | NSArray |
| `Promise<T>` | Promise | RCTPromiseResolveBlock + RejectBlock |
| `() => void` (callback) | Callback | RCTResponseSenderBlock |
| `ArrayBuffer` | — | — |

---

## Step 2: Codegen 配置

在模块的 `package.json` 中配置：

```json
{
  "name": "ble-module",
  "codegenConfig": {
    "name": "BLEModuleSpec",
    "type": "modules",
    "jsSrcsDir": "src/specs",
    "android": {
      "javaPackageName": "com.myapp.ble"
    }
  }
}
```

| 字段 | 说明 |
|------|------|
| `name` | 生成代码的命名空间（XxxSpec） |
| `type` | `"modules"`（TurboModule）或 `"components"`（Fabric 组件） |
| `jsSrcsDir` | Codegen 扫描 Spec 文件的目录 |
| `android.javaPackageName` | 生成的 Java 代码包名 |

### 如何执行

**不需要手动执行**，Codegen 和构建流程绑定：

| 平台 | 触发方式 | 时机 |
|------|---------|------|
| Android | `./gradlew build` 或 `npx react-native run-android` | Gradle 构建时自动调用 Codegen 脚本 |
| iOS | `pod install` + Xcode Build | pod install 时生成，Xcode 编译时使用 |

手动触发（调试用）：
```bash
# 只跑 Codegen 不构建
npx react-native codegen
```

### 生成到什么目录

```
Android:
  android/app/build/generated/source/codegen/
  ├── java/com/myapp/ble/
  │   └── NativeBLEModuleSpec.java        ← Java 抽象基类
  ├── jni/
  │   ├── NativeBLEModuleCxxSpecJSI.h     ← C++ JSI 绑定
  │   └── NativeBLEModuleCxxSpecJSI.cpp   ← C++ JNI 胶水
  └── schema.json                          ← 中间产物

iOS:
  ios/build/generated/ios/
  ├── NativeBLEModuleSpec.h               ← ObjC Protocol
  └── NativeBLEModuleSpec-generated.mm    ← C++ 绑定实现
```

**注意**：都在 `build/` 或 `generated/` 下，不提交 git（已在 .gitignore 中）。

### 核心产物内容

**① Java 抽象基类**（Android，你要继承的）

```java
// 自动生成，不要手动修改
public abstract class NativeBLEModuleSpec extends ReactContextBaseJavaModule
    implements TurboModule {

  // 你必须实现的方法（和 Spec 一一对应）
  public abstract boolean connect(String deviceId);
  public abstract boolean isConnected();
  public abstract void disconnect();

  // 事件 emit 方法（你直接调用）
  protected void emitOnStatusChange(WritableMap data) { ... }

  // 内部：方法名 → 方法的映射表（供 JNI 查找）
  @Override
  protected Map<String, Object> getTypedExportedConstants() { ... }
}
```

**② C++ JSI 绑定**（两端共用，你不碰）

```cpp
// 自动生成：把 JS 调用转发到 Native 实现
// 包含：
// - HostObject 注册（JS 侧能访问到这个模块）
// - jsi::Value 参数类型转换
// - Android: JNI 调用 Java 方法
// - iOS: ObjC Runtime 调用 ObjC 方法
```

**③ ObjC Protocol**（iOS，你要遵循的）

```objc
// 自动生成
@protocol NativeBLEModuleSpec <RCTBridgeModule, RCTTurboModule>
- (NSNumber *)connect:(NSString *)deviceId;
- (NSNumber *)isConnected;
- (void)disconnect;
@end
```

### 产物总结

| 产物 | 语言 | 你需要做什么 |
|------|------|------------|
| Java 抽象基类 | Java | 继承它，实现抽象方法 |
| ObjC Protocol | ObjC | 遵循它，实现协议方法 |
| C++ JSI 绑定 | C++ | ❌ 完全不碰 |
| C++ JNI 胶水 | C++ | ❌ 完全不碰 |

---

## Step 3: Android 侧实现

### 整体结构（3 个文件 + 1 行注册）

```
你需要写的：
┌─────────────────────────────────────────────────────────────┐
│  BLEModule.kt          ← 业务实现（继承 Codegen 基类）       │
│  BLEPackage.kt         ← 注册容器（告诉 RN 有这个模块）      │
│  MainApplication.kt    ← 加一行注册 Package                  │
└─────────────────────────────────────────────────────────────┘

Codegen 自动生成的（你不碰）：
┌─────────────────────────────────────────────────────────────┐
│  NativeBLEModuleSpec.java   ← Java 抽象基类（方法签名）       │
│  NativeBLEModuleCxxSpecJSI  ← C++ 胶水（JSI 绑定 + JNI 调用）│
└─────────────────────────────────────────────────────────────┘
```

### 协作关系

```
App 启动
  │
  ▼ MainApplication.getPackages()
  │  返回 [系统Package, 三方Package, BLEPackage, ...]
  │
  ▼ TurboModuleManager 收集所有 Package 的模块元信息
  │  内部 Map: { "BLEModule" → BLEPackage.getModule }
  │
  ▼ JS 首次调用 TurboModuleRegistry.get('BLEModule')
  │
  ▼ TurboModuleManager 在 Map 中查找 → 调用 BLEPackage.getModule("BLEModule")
  │
  ▼ BLEPackage 创建 BLEModule 实例
  │
  ▼ Codegen C++ 胶水把 BLEModule 实例包装为 JSI HostObject
  │  （注册到 JS Runtime，JS 侧拿到代理对象）
  │
  ▼ JS 调用 BLEModule.connect('xxx')
  │  → JSI(C++) → JNI → BLEModule.connect("xxx")（你写的业务代码）
```

### 3.1 继承生成的基类，实现方法

```kotlin
// android/src/main/java/com/myapp/ble/BLEModule.kt
package com.myapp.ble

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableNativeMap
// NativeBLEModuleSpec 是 Codegen 生成的抽象基类
import com.myapp.ble.NativeBLEModuleSpec

class BLEModule(reactContext: ReactApplicationContext)
  : NativeBLEModuleSpec(reactContext) {

  // 模块名：必须和 JS 侧 TurboModuleRegistry.getEnforcing('BLEModule') 一致
  override fun getName(): String = NAME

  // 实现 Spec 中声明的方法
  override fun connect(deviceId: String): Boolean {
    val device = bluetoothAdapter.getRemoteDevice(deviceId)
    return device.connectGatt(reactApplicationContext, false, gattCallback) != null
  }

  override fun isConnected(): Boolean {
    return connectionState == BluetoothGatt.STATE_CONNECTED
  }

  override fun disconnect() {
    gatt?.disconnect()
  }

  // ─── 异步方法实现 ───
  // Spec 中声明 Promise<T> 的方法，Native 侧签名多一个 Promise 参数
  // 通过 promise.resolve() / promise.reject() 返回结果
  //
  // Promise 来源：
  //   JS 调用 await scanDevices() 时，JS 引擎创建一个 JS Promise 对象
  //   → C++ 胶水层拿到该 Promise 的 resolve/reject 回调引用
  //   → 包装成 Java 的 com.facebook.react.bridge.Promise 接口传给你
  //   → 你调 promise.resolve(x) → C++ 触发 JS Promise 的 resolve
  //   本质：Java 侧的 Promise 是 JS Promise 的代理，持有其 resolve/reject 的引用
  override fun scanDevices(timeout: Double, promise: Promise) {
    // 开启扫描（异步操作）
    bluetoothAdapter.startLeScan { device, rssi, _ ->
      foundDevices.add(DeviceInfo(device.address, device.name, rssi))
    }
    // 超时后返回结果
    Handler(Looper.getMainLooper()).postDelayed({
      bluetoothAdapter.stopLeScan(null)
      val result = Arguments.createArray()
      foundDevices.forEach { info ->
        result.pushMap(Arguments.createMap().apply {
          putString("id", info.id)
          putString("name", info.name)
          putInt("rssi", info.rssi)
        })
      }
      promise.resolve(result)  // ← 成功：resolve 返回数据给 JS
    }, timeout.toLong())
  }

  // 异步方法失败时用 reject
  override fun sendCommand(cmd: String, data: ReadableArray, promise: Promise) {
    try {
      val bytes = data.toByteArray()
      gatt?.writeCharacteristic(buildPacket(cmd, bytes))
      promise.resolve(null)  // void 类型 resolve null
    } catch (e: Exception) {
      promise.reject("SEND_FAILED", e.message, e)  // ← 失败：reject
    }
  }

  // 发送事件给 JS（emitOnStatusChange 是 Codegen 生成在基类中的方法）
  private fun onConnectionStateChanged(status: String, deviceId: String) {
    emitOnStatusChange(WritableNativeMap().apply {
      putString("status", status)
      putString("deviceId", deviceId)
    })
  }

  companion object {
    const val NAME = "BLEModule"  // ← 和 JS 侧注册名一致
  }
}
```

### 3.2 创建 Package 注册模块

```kotlin
// android/src/main/java/com/myapp/ble/BLEPackage.kt
package com.myapp.ble

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// TurboReactPackage = RN 框架提供的基类，用于注册 TurboModule
// 作用：告诉 RN "我这里有哪些模块，怎么创建它们"
class BLEPackage : TurboReactPackage() {

  // 核心方法 1：模块工厂
  // 触发时机：JS 首次调用 TurboModuleRegistry.get('BLEModule') 时（懒加载）
  //   - 不是 App 启动时（除非 needsEagerInit = true）
  //   - 只调用一次，创建后 TurboModuleManager 缓存实例（单例）
  //   - 后续 JS 再次 get 同名模块直接返回缓存，不会重复 new
  //   - 实例生命周期 = RN 引擎生命周期（引擎销毁时才释放）
  override fun getModule(name: String, ctx: ReactApplicationContext): NativeModule? {
    return if (name == BLEModule.NAME) BLEModule(ctx) else null
  }

  // 核心方法 2：模块元信息注册表
  // 告诉 TurboModuleManager：有哪些模块、是不是 TurboModule、需不需要提前初始化
  // 这样 RN 启动时不用实例化所有模块，只记录"有这个模块"，用到时再创建
  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      BLEModule.NAME to ReactModuleInfo(
        BLEModule.NAME,                // 模块名（和 JS 侧注册名一致）
        BLEModule::class.java.name,    // 类全名（反射用）
        false, // canOverrideExistingModule — 是否允许覆盖同名模块
        false, // needsEagerInit — false=懒加载（推荐），true=启动时就创建
        false, // isCxxModule — 是否是纯 C++ 模块
        true   // isTurboModule — ← 必须 true，否则走旧 Bridge
      )
    )
  }
}
```

### 3.3 Application 中注册

```kotlin
// MainApplication.kt
import com.facebook.react.PackageList   // RN CLI 自动生成的类
import com.myapp.ble.BLEPackage         // 你自己写的 Package

override fun getPackages(): List<ReactPackage> {
  // PackageList 是 RN CLI 自动生成的类（在 build 时根据 node_modules 中的 RN 库自动收集）
  // 它包含所有通过 react-native.config.js 或 autolinking 注册的三方库 Package
  // 位置：android/app/build/generated/rncli/src/main/java/.../PackageList.java
  val packages = PackageList(this).packages.toMutableList()
  
  // 手动添加你自己的 Package（不在 node_modules 里的本地模块）
  packages.add(BLEPackage())
  
  return packages
}
// 最终 packages 列表 = 自动收集的三方库 + 你手动加的
```

---

## Step 4: iOS 侧实现

### 4.1 实现 Codegen 生成的 Protocol

```objc
// ios/BLEModule.mm（注意 .mm 后缀 = ObjC++，支持 C++ 混编）
#import <NativeBLEModuleSpec.h>  // Codegen 生成的 Protocol
#import <CoreBluetooth/CoreBluetooth.h>

@interface BLEModule : NSObject <NativeBLEModuleSpec, CBCentralManagerDelegate>
@property (nonatomic, strong) CBCentralManager *centralManager;
@property (nonatomic, strong) CBPeripheral *connectedPeripheral;
@end

@implementation BLEModule

// 注册模块（宏，自动处理注册逻辑，不需要手动写 Package）
RCT_EXPORT_MODULE()

- (NSNumber *)connect:(NSString *)deviceId {
  NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:deviceId];
  NSArray *peripherals = [self.centralManager retrievePeripheralsWithIdentifiers:@[uuid]];
  if (peripherals.count > 0) {
    [self.centralManager connectPeripheral:peripherals[0] options:nil];
    return @(YES);
  }
  return @(NO);
}

- (NSNumber *)isConnected {
  return @(self.connectedPeripheral.state == CBPeripheralStateConnected);
}

- (void)disconnect {
  if (self.connectedPeripheral) {
    [self.centralManager cancelPeripheralConnection:self.connectedPeripheral];
  }
}

// 发送事件给 JS（emitOnStatusChange 是 Codegen 生成在基类中的方法）
- (void)centralManager:(CBCentralManager *)central
  didConnectPeripheral:(CBPeripheral *)peripheral {
  [self emitOnStatusChange:@{
    @"status": @"connected",
    @"deviceId": peripheral.identifier.UUIDString
  }];
}

// TurboModule 必须实现的方法（Codegen 要求）
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeBLEModuleSpecJSI>(params);
}

@end
```

### iOS vs Android 关键区别

| | Android | iOS |
|--|---------|-----|
| 文件后缀 | `.kt` / `.java` | `.mm`（ObjC++，支持 C++） |
| 继承/遵循 | `extends NativeBLEModuleSpec`（基类） | `<NativeBLEModuleSpec>`（Protocol） |
| 注册方式 | 手动写 Package + Application 注册 | `RCT_EXPORT_MODULE()` 宏（一行搞定） |
| 额外方法 | 无 | 必须实现 `getTurboModule:`（返回 C++ 实例） |
| 内存管理 | 手动管理（注意 JNI 引用） | ARC 自动管理 |
| C++ 集成 | 需要 JNI 中间层（Codegen 生成） | 直接混编（ObjC++ = ObjC + C++） |

---

## Step 5: Pure C++ TurboModule

### 和普通 TurboModule 的区别

| | 普通 TurboModule | Pure C++ TurboModule |
|--|---|---|
| 实现语言 | Kotlin(Android) + ObjC(iOS)，两端各写一份 | C++ 一份，两端共用 |
| 调用链 | JS → JSI(C++) → JNI → Kotlin / ObjC | JS → JSI(C++) → 你的 C++（最短路径） |
| 注册方式 | Package + Application（Java 层） | Provider 函数（C++ 层） |
| Codegen 产物 | Java 基类 + ObjC Protocol + C++ 胶水（全套） | **只用 C++ 接口**（其他生成了也不用，linker 自动忽略） |
| 适用 | 需要平台 API（BLE、相机、文件系统） | 纯计算（加密、协议解析、数学、数据处理） |

### 开发流程

```
① 写 JS Spec（和普通 TurboModule 完全一样）
② Codegen 生成 C++ 抽象接口（NativeXxxCxxSpec.h）
   - 也会生成 Java 基类/ObjC Protocol，但你不用它们
   - 不需要手动删除，linker 自动忽略未引用的代码
③ 写 C++ 实现类，继承 CxxSpec
④ 写 Provider 函数（告诉 RN 怎么创建这个模块）
⑤ 在两端 C++ 入口注册 Provider
⑥ CMakeLists.txt 配置编译
```

### ③ C++ 实现

```cpp
// src/cpp/CryptoModule.h
#pragma once
#include <NativeCryptoModuleCxxSpec.h>  // Codegen 生成的 C++ 抽象接口

class CryptoModule : public NativeCryptoModuleCxxSpec<CryptoModule> {
public:
  CryptoModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeCryptoModuleCxxSpec(jsInvoker) {}

  // 实现 Spec 中声明的方法（直接操作 jsi::Value）
  jsi::String sha256(jsi::Runtime& rt, jsi::String input) override {
    std::string data = input.utf8(rt);
    std::string hash = computeSha256(data);  // 你的 C++ 逻辑
    return jsi::String::createFromUtf8(rt, hash);
  }

  jsi::Value encrypt(jsi::Runtime& rt, jsi::String data, jsi::String key) override {
    // 异步：创建 JS Promise 并在后台线程 resolve
    // ...
  }
};
```

### ④ Provider 函数

```cpp
// src/cpp/CryptoModuleProvider.cpp
#include "CryptoModule.h"

// Provider = 模块工厂函数（类比 Package.getModule，但在 C++ 层）
std::shared_ptr<TurboModule> CryptoModuleProvider(
    const std::string& name,
    const std::shared_ptr<CallInvoker>& jsInvoker) {
  if (name == "CryptoModule") {
    return std::make_shared<CryptoModule>(jsInvoker);
  }
  return nullptr;  // 不是我的模块，返回 null
}
```

### ⑤ 注册 Provider（两端各加几行代码）

Provider 函数只写一份（上面的 `CryptoModuleProvider.cpp`），两端共用。
但需要在两端的 C++ 入口文件里 include 并调用它（一次性，后续不用再动）。

**Android 侧**：

```cpp
// android/app/src/main/jni/OnLoad.cpp
// 这个文件是 RN 项目创建时自动生成的（npx react-native init 时就有）
// 位置固定，是 Android 侧 C++ 层的入口（JNI_OnLoad 加载时执行）

#include <DefaultTurboModuleManagerDelegate.h>
#include "CryptoModuleProvider.h"  // ← 加这行：引入你的 Provider

std::shared_ptr<TurboModule>
MainApplicationTurboModuleManagerDelegate::getTurboModule(
    const std::string& name,
    const std::shared_ptr<CallInvoker>& jsInvoker) {
  
  // ← 加这段：先查你的 C++ 模块
  auto module = CryptoModuleProvider(name, jsInvoker);
  if (module) return module;

  // 没找到 → 走默认路径（Java TurboModule via JNI）
  return DefaultTurboModuleManagerDelegate::getTurboModule(name, jsInvoker);
}
```

**iOS 侧**：

```objc
// ios/MyApp/AppDelegate.mm
// 这个文件也是 RN 项目创建时自动生成的

#include "CryptoModuleProvider.h"  // ← 加这行

// 在 RCTAppDelegate 的 getTurboModule 方法中加入
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const std::string &)name
                                                      jsInvoker:(std::shared_ptr<facebook::react::CallInvoker>)jsInvoker {
  // ← 加这段：先查你的 C++ 模块
  auto module = CryptoModuleProvider(name, jsInvoker);
  if (module) return module;

  // 没找到 → 走默认路径（ObjC TurboModule）
  return [super getTurboModule:name jsInvoker:jsInvoker];
}
```

**总结**：两端的入口文件（`OnLoad.cpp` / `AppDelegate.mm`）都是 RN 项目初始化时自动生成的，你只需要加 `#include` + 几行查找逻辑。Provider 本身是同一份 C++ 代码。

### ⑥ 构建配置（两端都需要，告诉编译器编译你的 C++ 文件）

**文件位置**：C++ 源码放在共享目录，两端构建系统各自引用同一份：

```
my-app/
├── src/cpp/                         ← 共享 C++ 代码（不在 android/ 也不在 ios/ 里）
│   ├── CryptoModule.h
│   ├── CryptoModule.cpp
│   └── CryptoModuleProvider.h/cpp
├── android/app/src/main/jni/       ← Android 构建入口，CMakeLists 引用 ../../cpp/
│   ├── CMakeLists.txt
│   └── OnLoad.cpp
└── ios/                             ← iOS 构建，Xcode 引用 ../src/cpp/
    └── MyApp/AppDelegate.mm
```

**Android：CMakeLists.txt（手动追加）**

```cmake
# android/app/src/main/jni/CMakeLists.txt（已有文件，末尾追加）

# 编译共享目录的 C++ 源文件
add_library(crypto_module SHARED
  ${CMAKE_SOURCE_DIR}/../../../../src/cpp/CryptoModule.cpp
  ${CMAKE_SOURCE_DIR}/../../../../src/cpp/CryptoModuleProvider.cpp
)

# 链接 RN 核心库
target_link_libraries(crypto_module
  react_nativemodule_core   # TurboModule 核心（jsi::Runtime、CallInvoker）
  react_codegen_rncore      # Codegen 生成的 C++ 接口
)

# 头文件搜索路径
target_include_directories(crypto_module PRIVATE
  ${CMAKE_SOURCE_DIR}/../../../../src/cpp
)
```

**iOS：在 Podspec 或 Xcode 中声明源文件路径**

```ruby
# 如果是独立库（有 .podspec）：
s.source_files = '../src/cpp/**/*.{h,cpp}'

# 如果是 App 内模块：
# Xcode → Build Phases → Compile Sources → 点 + → 添加 src/cpp/*.cpp
# Xcode → Build Settings → Header Search Paths → 添加 $(SRCROOT)/../src/cpp
```

**总结**：C++ 文件只有一份在共享目录，Android 用 CMake 引用，iOS 用 Xcode/Podspec 引用。都是一次性配置。

### 关键点

| 点 | 说明 |
|----|------|
| 不写 Kotlin/ObjC | 没有 Package、没有 Application 注册、没有 RCT_EXPORT_MODULE |
| 不走 JNI/ObjC Bridge | JS → C++ 直达，最短调用链 |
| Codegen 多余产物 | 生成了 Java 基类等也不用管，没人引用 = linker 自动丢弃 |
| 两端共用 | 同一份 C++ 代码，Android 和 iOS 都编译它 |
| 注册在 C++ 层 | 通过 Provider 函数注册，不是 Java Package |

---

## 关键规则速查

### 底层原理：TurboModuleManager 统一调度

**所有 TurboModule 的调度都收敛在 C++ 层**，不论最终实现是 Kotlin、ObjC 还是 C++：

```
JS: TurboModuleRegistry.get('BLEModule')
  │
  ▼ JSI（C++ 层）
  │
  ▼ TurboModuleManager（C++ 实现，统一入口）
  │  职责：模块发现、创建、缓存（单例）、分发
  │
  │  查找逻辑：
  │  1. 先查 C++ Provider（Pure C++ Module）
  │  2. 没找到 → 通过 JNI/ObjC 调 Java/ObjC 的 Package.getModule()
  │
  ├─→ C++ 模块：Provider 直接返回 C++ 实例 → 注册为 JSI HostObject
  │
  └─→ Native 模块：JNI → Package.getModule() → 拿到 Java 实例
                    → C++ 包装为 JSI HostObject → 返回给 JS
```

**关键点**：
- TurboModuleManager 是 C++ 实现的单例，管理所有模块的生命周期
- 不管模块用什么语言实现，JS 侧拿到的都是 JSI HostObject（统一接口）
- 模块实例创建后缓存在 C++ 层的 Map 中（单例，不重复创建）
- 这就是为什么 Pure C++ Module 的 Provider 注册在 `OnLoad.cpp`——直接注册到 C++ Manager，不绕道 Java/ObjC

---

### 规则表

| 规则 | 说明 |
|------|------|
| 文件名 `Native` 前缀 | 不加 → Codegen 忽略 |
| 接口名必须叫 `Spec` | 不叫 → Codegen 找不到 |
| `extends TurboModule` | 不继承 → 不是 TurboModule |
| JS 注册名 = Native NAME | 不一致 → 运行时找不到模块 |
| Android: `isTurboModule = true` | 不标记 → 走旧 Bridge |
| iOS: `getTurboModule:` | 不实现 → 编译报错 |
| iOS: `.mm` 后缀 | 用 `.m` → 不能写 C++ 代码 → 编译失败 |
