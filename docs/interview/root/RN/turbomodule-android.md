# TurboModule Android 侧实现

> 问题：怎么写一个 Android 侧的 TurboModule？从 JS Spec 到 Native 实现的完整链路。
> 本质：JS 定义接口（Spec）→ Codegen 生成 C++ 胶水 → Android 侧用 Kotlin/Java 实现具体逻辑

---

## 目录

- [一、全链路概览](#一全链路概览)
- [二、JS 侧：定义 Spec](#二js-侧定义-spec)
- [三、Codegen：自动生成](#三codegen自动生成)
- [四、Android 侧：实现 Module](#四android-侧实现-module)
- [五、注册 Module](#五注册-module)
- [六、JS 侧：调用](#六js-侧调用)
- [七、BLE Module 完整示例](#七ble-module-完整示例)
- [八、同步方法 vs 异步方法](#八同步方法-vs-异步方法)
- [九、事件回传（Native → JS）](#九事件回传native--js)

---

## 一、全链路概览

```
1. JS 侧写 Spec（TypeScript 接口定义）
   ↓
2. Codegen 根据 Spec 自动生成 C++ 接口 + Java/ObjC 抽象类
   ↓
3. Android 侧继承抽象类，实现具体逻辑（Kotlin/Java）
   ↓
4. 注册到 ReactPackage
   ↓
5. JS 侧直接调用（JSI 直调，无序列化）
```

**和旧架构 NativeModule 的区别**：

| | 旧 NativeModule | TurboModule |
|---|---|---|
| 通信 | Bridge（JSON 序列化） | JSI（C++ 直调） |
| 加载 | App 启动时全量注册 | 懒加载（用到才加载） |
| 类型安全 | 无（运行时才发现错误） | Codegen 编译时检查 |
| 同步方法 | 不支持 | 支持 |

---

## 二、JS 侧：定义 Spec

```typescript
// src/native/NativeBLEModule.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Spec 接口：定义 Native 模块暴露给 JS 的所有方法
export interface Spec extends TurboModule {
  // 异步方法（返回 Promise）
  connect(deviceId: string): Promise<boolean>;
  disconnect(deviceId: string): Promise<void>;
  sendCommand(deviceId: string, cmd: string): Promise<void>;
  
  // 同步方法（JSI 支持，直接返回值）
  isConnected(deviceId: string): boolean;
  getConnectionState(): string;
  
  // 事件相关
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

// 获取模块实例（懒加载：第一次调用时才初始化 Native 侧）
export default TurboModuleRegistry.getEnforcing<Spec>('BLEModule');
```

**关键点**：
- 文件名必须以 `Native` 开头（Codegen 约定）
- 接口必须叫 `Spec` 且 extends `TurboModule`
- 方法签名决定了 Native 侧的接口

---

## 三、Codegen：自动生成

```bash
# 构建时自动执行（或手动触发）
cd android && ./gradlew generateCodegenArtifactsFromSchema
```

Codegen 根据 Spec 生成：
- C++ 头文件（JSI 绑定）
- Java/Kotlin 抽象类（你要继承的）

```
生成的文件（android/app/build/generated/）：
├── NativeBLEModuleSpec.java    ← 你要继承这个
└── jni/                        ← C++ JSI 绑定（不用管）
```

---

## 四、Android 侧：实现 Module

```kotlin
// android/app/src/main/java/com/myapp/modules/BLEModule.kt
package com.myapp.modules

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
import com.myapp.NativeBLEModuleSpec  // Codegen 生成的抽象类

class BLEModule(reactContext: ReactApplicationContext) : NativeBLEModuleSpec(reactContext) {

    override fun getName() = "BLEModule"  // 必须和 JS 侧 TurboModuleRegistry.getEnforcing 的名字一致

    // 异步方法：返回 Promise
    override fun connect(deviceId: String, promise: Promise) {
        try {
            // 调用 Android BLE API
            val device = bluetoothAdapter.getRemoteDevice(deviceId)
            val gatt = device.connectGatt(reactApplicationContext, false, gattCallback)
            // 连接成功后 resolve
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BLE_ERROR", e.message)
        }
    }

    override fun disconnect(deviceId: String, promise: Promise) {
        gatt?.disconnect()
        promise.resolve(null)
    }

    override fun sendCommand(deviceId: String, cmd: String, promise: Promise) {
        // 写入 BLE Characteristic
        val characteristic = gatt?.getService(SERVICE_UUID)?.getCharacteristic(CHAR_UUID)
        characteristic?.value = cmd.toByteArray()
        gatt?.writeCharacteristic(characteristic)
        promise.resolve(null)
    }

    // 同步方法：直接返回值（JSI 支持）
    override fun isConnected(deviceId: String): Boolean {
        return connectionState == BluetoothGatt.STATE_CONNECTED
    }

    override fun getConnectionState(): String {
        return when (connectionState) {
            BluetoothGatt.STATE_CONNECTED -> "connected"
            BluetoothGatt.STATE_CONNECTING -> "connecting"
            else -> "disconnected"
        }
    }

    // 事件相关（Native → JS）
    override fun addListener(eventName: String) { /* 注册监听 */ }
    override fun removeListeners(count: Double) { /* 移除监听 */ }
}
```

---

## 五、注册 Module

```kotlin
// android/app/src/main/java/com/myapp/modules/BLEPackage.kt
package com.myapp.modules

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.module.model.ReactModuleInfo

class BLEPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            "BLEModule" -> BLEModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            "BLEModule" to ReactModuleInfo(
                "BLEModule",
                "BLEModule",
                false,  // canOverrideExistingModule
                false,  // needsEagerInit（false = 懒加载）
                true,   // isTurboModule
                false   // hasConstants
            )
        )
    }
}
```

```kotlin
// MainApplication.kt 中注册
override fun getPackages() = listOf(
    MainReactPackage(),
    BLEPackage(),  // ← 注册你的 TurboModule
)
```

---

## 六、JS 侧：调用

```typescript
// 业务代码中使用
import BLEModule from '../native/NativeBLEModule';

// 异步调用
const connected = await BLEModule.connect('AA:BB:CC:DD:EE:FF');

// 同步调用（JSI 直接返回，不需要 await）
const isConn = BLEModule.isConnected('AA:BB:CC:DD:EE:FF');
const state = BLEModule.getConnectionState();
```

---

## 七、BLE Module 完整示例

```
文件结构：
src/
├── native/
│   └── NativeBLEModule.ts          ← JS Spec（接口定义）
android/app/src/main/java/com/myapp/
├── modules/
│   ├── BLEModule.kt                ← Native 实现
│   └── BLEPackage.kt               ← 注册
├── MainApplication.kt              ← 注册 Package
```

---

## 八、同步方法 vs 异步方法

| | 同步 | 异步 |
|---|---|---|
| JS 侧 | `const val = Module.method()` | `const val = await Module.method()` |
| Native 侧 | 直接 return 值 | 通过 Promise resolve/reject |
| 适用 | 读取状态（isConnected/getState） | 耗时操作（connect/sendCommand） |
| 线程 | 在 JS Thread 执行（阻塞） | 在 Background Thread 执行 |
| 注意 | 不能做耗时操作（会卡 JS） | 不阻塞 JS |

---

## 九、事件回传（Native → JS）

BLE 数据是设备主动推送的，不是 JS 主动请求的 → 需要 Native 主动通知 JS。

```kotlin
// Native 侧：发送事件给 JS
private fun sendEvent(eventName: String, params: WritableMap) {
    reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
}

// BLE 数据回调中使用
private val gattCallback = object : BluetoothGattCallback() {
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        val data = characteristic.value
        val params = Arguments.createMap().apply {
            putString("deviceId", gatt.device.address)
            putString("data", Base64.encodeToString(data, Base64.DEFAULT))
        }
        sendEvent("BLE_DATA", params)
    }
}
```

```typescript
// JS 侧：监听事件
import { NativeEventEmitter, NativeModules } from 'react-native';

const emitter = new NativeEventEmitter(NativeModules.BLEModule);
const subscription = emitter.addListener('BLE_DATA', (event) => {
    console.log(event.deviceId, event.data);
});

// 清理
subscription.remove();
```

---

## 概念速查

| 概念 | 一句话 |
|------|--------|
| Spec | JS 侧的接口定义，Codegen 的输入 |
| Codegen | 根据 Spec 自动生成 C++/Java 接口代码 |
| TurboReactPackage | 注册 TurboModule 的容器 |
| Promise | 异步方法的返回机制（resolve/reject） |
| NativeEventEmitter | Native → JS 的事件通道 |
| getName() | Module 名字，必须和 JS 侧一致 |
| needsEagerInit=false | 懒加载：用到才初始化 |
