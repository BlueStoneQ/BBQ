# TurboModule 开发指南（Android + iOS）

## 目录

- [全流程概览](#全流程概览)
- [Step 1: JS Spec 定义](#step-1-js-spec-定义)
- [Step 2: Codegen 配置](#step-2-codegen-配置)
- [Step 3: Android 侧实现](#step-3-android-侧实现)
- [Step 4: iOS 侧实现](#step-4-ios-侧实现)
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

class BLEPackage : TurboReactPackage() {

  override fun getModule(name: String, ctx: ReactApplicationContext): NativeModule? {
    return if (name == BLEModule.NAME) BLEModule(ctx) else null
  }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      BLEModule.NAME to ReactModuleInfo(
        BLEModule.NAME,
        BLEModule::class.java.name,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // isCxxModule
        true   // isTurboModule ← 标记为 TurboModule
      )
    )
  }
}
```

### 3.3 Application 中注册

```kotlin
// MainApplication.kt
override fun getPackages(): List<ReactPackage> {
  val packages = PackageList(this).packages.toMutableList()
  packages.add(BLEPackage())  // ← 注册
  return packages
}
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

## 关键规则速查

| 规则 | 说明 |
|------|------|
| 文件名 `Native` 前缀 | 不加 → Codegen 忽略 |
| 接口名必须叫 `Spec` | 不叫 → Codegen 找不到 |
| `extends TurboModule` | 不继承 → 不是 TurboModule |
| JS 注册名 = Native NAME | 不一致 → 运行时找不到模块 |
| Android: `isTurboModule = true` | 不标记 → 走旧 Bridge |
| iOS: `getTurboModule:` | 不实现 → 编译报错 |
| iOS: `.mm` 后缀 | 用 `.m` → 不能写 C++ 代码 → 编译失败 |
