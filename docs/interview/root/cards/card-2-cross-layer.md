# 牌 2：跨层通信架构（TurboModule / JSI）

> 命中：JD1-4（复杂问题攻关）+ JD2（RN 与原生对接，必备技能）
> 定位：不是只会 JS 的前端，能穿透 JS → C++ → Java/Swift 解决底层问题

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

## 详细文档链接

- [RN↔Native 通信](../RN/rn-native-communication.md)
- [TurboModule Android 侧实现](../RN/turbomodule-android.md)
- [J2V8 深入](../../resume/explain/3.1-xm/quickapp-framework/j2v8-deep.md)
- [快应用框架追问清单](../../resume/explain/3.1-xm/quickapp-framework/traps.md)
- [IoT BLE 性能方案](../RN/iot-ble-performance.md)
- [RN 全景（Android 启动链路）](../RN/rn-full-picture.md)
- [Android 线程模型](../../resume/explain/3.1-xm/quickapp-framework/android-note/02-process-thread/README.md)
