# 牌 2：跨层通信架构（TurboModule / JSI）

> 命中：JD1-4（复杂问题攻关）+ JD2（RN 与原生对接，必备技能）
>
> 定位：不是只会 JS 的前端，能穿透 JS → C++ → Java/Swift 解决底层问题

---

## 目录

- [索引文件](#索引文件)
- [一句话本质](#一句话本质)
- [TurboModule 开发全流程](#turbomodule-开发全流程)
  - [JS 侧 Spec 定义](#js-侧-spec-定义)
  - [Android 侧实现](#android-侧实现)
  - [iOS 侧实现](#ios-侧实现)
  - [Codegen 机制](#codegen-机制)
  - [注册与串联](#注册与串联)
- [原理解析](#原理解析)
  - [完整调用链](#完整调用链)
  - [JSI 的本质](#jsi-的本质)
  - [HostObject 机制](#hostobject-机制)
  - [参数传递与返回值](#参数传递与返回值)
  - [为什么 JSI 比旧 Bridge 快](#为什么-jsi-比旧-bridge-快)
  - [JSI 参数内存模型](#jsi-参数内存模型)
  - [Native to JS 事件推送](#native-to-js-事件推送)
  - [Pure C++ TurboModule](#pure-c-turbomodule)
- [我的经验支撑](#我的经验支撑)
- [Q&A](#qa)
  - [TurboModule 和旧 NativeModule 能共存吗](#turbomodule-和旧-nativemodule-能共存吗)
  - [为什么 Spec 里能定义同步方法](#为什么-spec-里能定义同步方法旧架构为什么不行)
  - [Codegen 生成的代码要提交 Git 吗](#codegen-生成的代码要提交-git-吗)
  - [iOS 和 Android 的实现能共用吗](#ios-和-android-的实现能共用吗)
  - [BLE 场景下 TurboModule 比旧架构好在哪](#ble-场景下-turbomodule-比旧架构好在哪)
  - [用一个例子理解 JSI 的本质](#用一个例子理解-jsi-的本质)

---

## 索引文件

| 主题 | 文档 |
|------|------|
| TurboModule 开发全流程指南 | [turbomodule-dev-guide.md](../../RN/turbomodule-dev-guide.md) |
| RN↔Native 通信机制 | [rn-native-communication.md](../../RN/rn-native-communication.md) |
| TurboModule Android 侧实现 | [turbomodule-android.md](../../RN/turbomodule-android.md) |
| iOS for RN | [ios-for-rn.md](../../RN/ios-for-rn.md) |
| J2V8 深入（快应用 Bridge） | [j2v8-deep.md](../../../resume/explain/3.1-xm/quickapp-framework/j2v8-deep.md) |
| 快应用框架追问清单 | [traps.md](../../../resume/explain/3.1-xm/quickapp-framework/traps.md) |
| IoT BLE 性能方案 | [iot-ble-performance.md](../../RN/iot-ble-performance.md) |
| RN 全景（启动链路） | [rn-full-picture.md](../../RN/rn-full-picture.md) |
| Android 线程模型 | [02-process-thread](../../android-note/02-process-thread/README.md) |
| iOS/Android 平台差异 | [rn-ios-android-diff.md](../../RN/rn-ios-android-diff.md) |

---

## 一句话本质

**TurboModule 的本质：Codegen 根据 Spec 自动生成一个 C++ 中间层，左手通过 JSI 连接 JS，右手通过 JNI 连接 Kotlin。你只需要写两头（Spec + Kotlin/ObjC 实现），中间的 C++ 胶水全自动生成。本质是一个自动生成的双向适配器。**

```
你写的：        Spec (TS)  ←→  Kotlin/ObjC 实现
Codegen 生成的：      C++ 胶水（JSI 绑定 + JNI/ObjC 调用）
```

```
旧架构：JS → JSON序列化 → Bridge异步队列 → JSON反序列化 → Native（慢，异步）
新架构：JS → JSI(C++直调) → JNI/ObjC → Native（快，可同步）
```

> 注：iOS 侧 ObjC 是 C 超集，可直接和 C++ 混编（ObjC++ .mm 文件），不需要额外 bridge。Android 侧 C++ 不能直接调 Java，必须通过 JNI 桥接。所以准确说：iOS 是 C++ 直调 ObjC++，Android 是 C++ → JNI → Java。

核心层次：
```
JS/TS（业务层）
  ↓ JSI（C++ 函数指针直调，无序列化）
C++（通信层，Codegen 自动生成）
  ↓ JNI（Android）/ ObjC Bridge（iOS）
Java/Kotlin | ObjC/Swift（原生实现层）
```

---

## TurboModule 开发全流程

### JS 侧 Spec 定义

**Spec = 给 Codegen 看的接口合同**。Codegen 根据它自动生成双端胶水代码。

```typescript
// NativeBLEModule.ts
import { TurboModule, TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native';

export interface Spec extends TurboModule {
  // 三种通信模式：
  isConnected(): boolean;                        // ① 同步方法（JSI 独有能力，旧架构做不到）
  connect(deviceId: string): Promise<boolean>;   // ② 异步方法（耗时操作，返回 Promise）
  readonly onStatusChange: EventEmitter<{        // ③ 事件（Native 主动推给 JS）
    status: string; deviceId: string;
  }>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BLEModule');
```

```json
// package.json 中配置 Codegen 扫描路径
{
  "codegenConfig": {
    "name": "MyAppSpecs",
    "type": "modules",
    "jsSrcsDir": "src/specs"
  }
}
```

---

### Codegen 执行（JS Spec → 双端胶水代码）

**触发时机**：构建时自动跑，不需要手动执行
- iOS：`pod install` 时触发（Codegen 脚本注册在 CocoaPods 的 post_install hook 中）
- Android：`./gradlew build` 或 AS 点 Run 时触发（RN Gradle 插件插入 `generateCodegenArtifactsFromSchema` 任务）。注意：AS 的 Sync 只解析配置不触发 Codegen

> **为什么时机不同？** 两个平台的依赖管理工具设计差异：
> - iOS 的 `pod install` 不只是"下载依赖"——CocoaPods 会执行 post_install 脚本，RN 把 Codegen 挂在这里，所以"装依赖"和"生成代码"合并在一步
> - Android 的 Gradle 把"解析配置"（sync）和"执行构建"（build）分两步，Codegen 是构建任务只在 build 跑
>
> **实际开发体验**：
> - iOS：改了 Spec → `pod install`（重新生成）→ Xcode build → 跑起来
> - Android：改了 Spec → 直接 Run（build 时自动重新 Codegen）→ 跑起来
>
> Android 反而更无感——改了直接跑。iOS 需要多跑一次 `pod install`。

**生成产物**：

```
Android:
android/app/build/generated/source/codegen/
├── java/com/facebook/fbreact/specs/
│   └── NativeBLEModuleSpec.java        ← Java 抽象基类（你继承它）
└── jni/
    ├── NativeBLEModuleCxxSpecJSI.h     ← C++ JSI 绑定
    └── NativeBLEModuleCxxSpecJSI.cpp   ← C++ JNI 胶水（自动调你的 Java）

iOS:
ios/build/generated/
├── NativeBLEModuleSpecJSI.h            ← C++ JSI 绑定
├── NativeBLEModuleSpecJSI.cpp
└── NativeBLEModuleSpec.h               ← ObjC 协议（你实现它）
```

> 都在 `build/` 目录下，不提交 git，每次构建自动重新生成。

---

### Android 侧实现

**你只需要：继承 Codegen 生成的抽象基类，实现业务方法。不需要写任何 JNI 代码。**

```kotlin
// ① 继承 Codegen 生成的 NativeBLEModuleSpec（抽象基类）
class BLEModule(reactContext: ReactApplicationContext)
  : NativeBLEModuleSpec(reactContext) {

  override fun getName() = NAME

  // ② 同步方法：直接返回值
  override fun isConnected(): Boolean {
    return connectionState == BluetoothGatt.STATE_CONNECTED
  }

  // ② 异步方法：通过 Promise resolve/reject
  // Promise 来自 com.facebook.react.bridge.Promise（RN 框架提供的 Java 接口，不是 Kotlin 原生的）
  // Codegen 看到 Spec 里返回 Promise<T> → 自动在 Java 签名末尾加一个 Promise 参数
  // 运行时：JS 调 await connect() → RN 框架创建 Promise 对象传给你 → 你调 resolve/reject → 框架通过 JSI 传回 JS
  //
  // 本质：Java 侧的 Promise 是 JS 堆上真实 Promise 的代理/句柄（通过 JSI 持有引用）
  //   JS 堆：Promise { resolve, reject }  ← JS 侧 await 等着它
  //              ↑ JSI 引用
  //   Java 侧：promise.resolve(true) → 通过 JSI 直接调用 JS 堆上的 resolve(true) → await 返回
  override fun connect(deviceId: String, promise: Promise) {
    val device = bluetoothAdapter.getRemoteDevice(deviceId)
    val gatt = device.connectGatt(context, false, object : BluetoothGattCallback() {
      override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        if (newState == BluetoothGatt.STATE_CONNECTED) {
          // @在这里通过resolve传值
          promise.resolve(true)
          // ③ 事件：通过 Codegen 生成的 emit 方法推送给 JS
          emitOnStatusChange(WritableNativeMap().apply {
            putString("status", "connected")
            putString("deviceId", deviceId)
          })
        } else {
          promise.reject("BLE_ERROR", "Connection failed")
        }
      }
    })
  }

  companion object { const val NAME = "BLEModule" }
}
```

```kotlin
// ② 创建 Package 注册模块
class BLEPackage : TurboReactPackage() {
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

```kotlin
// ③ Application 中注册
override fun getPackages(): List<ReactPackage> {
  val packages = PackageList(this).packages.toMutableList()
  packages.add(BLEPackage())
  return packages
}
```

---

### iOS 侧实现

```objc
// @interface = 类声明（类似 Java 的 class 声明行）
// NSObject = 基类（所有 ObjC 对象的根类，类似 Java 的 Object）
// <NativeBLEModuleSpec> = 实现 Protocol（类似 Java 的 implements Interface）
// ① 实现 Codegen 生成的 Protocol（ObjC 中 Protocol ≈ Java 的 Interface/抽象基类）
@interface BLEModule : NSObject <NativeBLEModuleSpec>
@end

// @implementation = 类实现（Java 不区分声明和实现，ObjC 分开写）
@implementation BLEModule

// RCT_EXPORT_MODULE = RN 宏，注册模块名（类似 Android 的 getName()）
RCT_EXPORT_MODULE(BLEModule)

// ObjC 方法语法：- (返回类型)方法名:(参数类型)参数名 第二标签:(参数类型)参数名
// 等价 Java：void connect(String deviceId, Promise resolve, Reject reject)
// ② 异步方法
- (void)connect:(NSString *)deviceId
        resolve:(RCTPromiseResolveBlock)resolve   // ← RN 提供的 resolve 回调
         reject:(RCTPromiseRejectBlock)reject {    // ← RN 提供的 reject 回调
  // [obj method:arg] = ObjC 的方法调用语法（类似 obj.method(arg)）
  CBPeripheral *peripheral = [self findPeripheral:deviceId];
  [self.centralManager connectPeripheral:peripheral options:nil];
  resolve(@(YES));  // @(YES) = 把 BOOL 包装成 NSNumber 对象
}

// ① 同步方法：直接返回值（ObjC 基本类型要包装成 NSNumber）
- (NSNumber *)isConnected {
  return @(self.peripheral.state == CBPeripheralStateConnected);
}

- (void)disconnect {
  [self.centralManager cancelPeripheralConnection:self.peripheral];
}

// ③ 事件推送：Codegen 在基类中生成 emitOnStatusChange 方法
// 在 BLE 回调中调用：[self emitOnStatusChange:@{@"status": @"connected", @"deviceId": deviceId}];

// 必须实现的模板方法：把 ObjC 模块桥接到 C++ JSI 层
// NativeBLEModuleSpecJSI = Codegen 生成的 C++ 类，负责 JSI ↔ ObjC 自动桥接
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeBLEModuleSpecJSI>(params);
}

@end  // 类实现结束
```
// 这里是不是应该加上在js侧是怎么引入和使用turbo modudle呢 

### JS 侧使用（闭环）

```typescript
// 引入：直接 import Spec 文件的 default export
import NativeBLEModule from './specs/NativeBLEModule';

// 使用：就像调普通 JS 函数
function BLEScreen() {
  // ① 同步方法：直接调用，同步返回
  const connected = NativeBLEModule.isConnected();

  // ② 异步方法：await
  const handleConnect = async (deviceId: string) => {
    const success = await NativeBLEModule.connect(deviceId);
    console.log('连接结果:', success);
  };

  // ③ 事件监听：addListener
  useEffect(() => {
    const sub = NativeBLEModule.onStatusChange.addListener((event) => {
      console.log(event.status, event.deviceId);
    });
    return () => sub.remove();  // 卸载时取消监听
  }, []);

  return <Button onPress={() => handleConnect('device-123')} />;
}
```

> JS 侧完全不需要知道底层是 JSI/JNI/ObjC——调用体验和普通 TS 函数一样。类型安全来自 Spec 定义，运行时桥接由 Codegen 生成的胶水代码自动完成。

---

### Codegen 机制

**何时执行**：构建时自动跑，不需要手动执行
- iOS：`pod install` 时触发
- Android：`./gradlew build` 时触发

**生成什么**：

| 生成物 | 语言 | 作用 | 你需要碰吗 |
|--------|------|------|-----------|
| C++ JSI 绑定 | C++ | HostObject 注册 + jsi::Value 类型转换 | ❌ |
| Android 胶水 | Java + C++ | 抽象基类 + JNI 调用 | ❌ 只需继承基类 |
| iOS 胶水 | ObjC++ | C++ → ObjC 桥接 | ❌ 只需实现协议 |

**文件发现规则**：
- 文件名必须 `Native<ModuleName>.ts`
- 接口名必须 `Spec extends TurboModule`
- Codegen 只扫描 `codegenConfig.jsSrcsDir` 指定目录

---

### 注册与串联

```
App 启动
  → 注册 BLEPackage（Application.getPackages）
  → TurboModuleManager 扫描所有 Package
  → JS 首次调用 TurboModuleRegistry.get('BLEModule')（懒加载）
  → Package.getModule() 创建 BLEModule 实例
  → Codegen 生成的 C++ 把 Java/ObjC 实例包装为 JSI HostObject
  → JS 拿到代理对象
  → 后续调方法：JS → C++(JSI) → C++(JNI/ObjC) → 你的 Native 实现
```

名字对上就自动串联：JS 侧 `'BLEModule'` = Native 侧 `NAME`。

---

## 原理解析

### 完整调用链

```
JS: BLEModule.connect('device-123')
  │
  ▼ Hermes VM 通过 JSI 找到 HostObject 上的方法
JSI 层（C++）— 直接函数调用，无 JSON 序列化
  │ jsi::Value → C++ 类型
  ▼
Codegen 生成的 C++ 胶水代码
  │ C++ → JNI 类型（jstring, jint）
  ▼
JNI: env->CallObjectMethod(javaModule, methodId, ...)
  │
  ▼
你写的 Java 实现: BLEModule.connect("device-123")
  │
  ▼
Android 系统 API（BluetoothGatt）
```

其实这样看: js调用链路就是: js - jsi:c++ - JNI - kotlin 这样 

那么 native调用js呢 链路 

---

### JSI 的本质

**JSI = JavaScript Interface**。不是协议、不是消息队列，是 **C++ 层的一组接口**，让 JS 引擎和 Native 代码(c++)在同一进程内通过函数指针直接互调。

核心能力：
- JS 可以直接调用 C++ 函数（通过 HostObject/HostFunction）
- C++ 可以直接操作 JS 对象（通过 jsi::Runtime）
- 可同步返回（不像旧 Bridge 只能异步）
- 引擎无关（Hermes/V8/JSC 都可以）

**双向通信链路**：
```
JS → Native：JS 调方法 → JSI(C++) → JNI → Kotlin/Java
Native → JS：Kotlin → JNI → JSI(C++) → 调 JS 堆上的函数（如 EventEmitter.emit）
```
都经过同一个 C++ JSI 层，双向通信。JSI 持有 JS 函数的引用，Native 想通知 JS 时，通过 JSI 直接调用那个 JS 函数。

---

### HostObject 机制

HostObject 不是"内存映射"，是**在 JS 堆上注册一个代理对象**。JS 访问属性/方法时触发 C++ 回调：

```cpp
class BLEModule : public jsi::HostObject {
  jsi::Value get(jsi::Runtime& rt, const jsi::PropNameID& name) override {
    if (name == "connect") {
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

---

### 参数传递与返回值

**传递方式取决于类型**：

| 类型 | 传递方式 |
|------|---------|
| number/boolean | 值拷贝（8字节 jsi::Value 直接存值） |
| string | 拷贝一次（JS 堆 → C++ std::string → JNI jstring） |
| Object/Array | **不拷贝**——C++ 拿到 JS 堆对象的句柄，按需读取字段时才转换 |
| ArrayBuffer | **零拷贝**——C++ 直接拿指针，和 JS 共享同一块内存 |

> 核心优势：旧 Bridge 不管你用不用，全部 JSON.stringify（全量拷贝）。JSI 是你用多少转多少。

**参数**：类型转换，不是内存映射

```
JS: connect('device-123')
  → JSI: args[0].asString(rt).utf8(rt) → std::string（类型转换）
  → JNI: env->NewStringUTF(str.c_str()) → jstring
  → Java: 拿到 String "device-123"
```

**同步返回**（isConnected）：
```
Java: return true → JNI: jboolean → C++: bool → JSI: jsi::Value(true) → JS: true
（同一调用栈，直接返回）
```

**异步返回**（connect → Promise）：
```
Java: promise.resolve(result)
  → C++ 调用 JS Promise 的 resolve 回调
  → JS Promise resolve，进入微任务队列
```

---

### 为什么 JSI 比旧 Bridge 快

**快在三个地方（不只是"没有序列化"）**：

1. **无 JSON 序列化/反序列化**：旧 Bridge 把所有参数 JSON.stringify → 传输 → JSON.parse（3 次全量操作）。JSI 直接类型转换，用多少转多少
2. **无异步队列等待**：旧 Bridge 是跨线程消息队列（入队 → 线程切换 → 出队），JSI 是同线程函数直调（一个函数调用的开销）
3. **编译时绑定**：旧 Bridge 每次用字符串名 HashMap 查方法，JSI 用 Codegen 编译时绑定函数指针（零运行时查找）

**JNI 层确实还有拷贝**——但相比旧 Bridge 还是快：

| 层 | 旧 Bridge 开销 | JSI + JNI 开销 |
|----|--------------|---------------|
| JS → 中间层 | JSON.stringify **全量**序列化 | 按需类型转换（用多少转多少） |
| 中间层 → Java | JSON.parse **全量**反序列化 | JNI 逐字段构建 Java 对象 |
| 额外开销 | 异步队列 + 线程切换 + 字符串查方法 | 无（同步直调） |
| 总拷贝次数 | 3 次（原对象 + JSON 字符串 + Java 对象） | 1 次（按需构建 Java 对象） |

**JNI 传 Array/Object 的方式**：

| 类型 | JNI 做法 | 有拷贝吗 |
|------|---------|---------|
| int/double/bool | 直接传值（jint/jdouble） | 值拷贝，零开销 |
| String | `NewStringUTF(str.c_str())` | 拷贝一次（C++ → Java 堆） |
| Array | `NewIntArray` + `SetIntArrayRegion` | 拷贝（C++ 数组 → Java 数组） |
| Object | 构建 WritableNativeMap 逐字段 put | 拷贝（逐字段） |
| byte[] | `NewDirectByteBuffer(ptr, size)` | **可零拷贝**（DirectByteBuffer 直接指向 C++ 内存） |

> JNI 拷贝避免不了（Java 有独立堆 + GC，不能直接用 C++ 内存）。但 JSI 的惰性按需转换保证了：只有 Native 真正用到的字段才会经过 JNI 拷贝，没用到的不传。

**旧 Bridge 一次调用 6 步（4 步是纯开销）**：
```
① JSON 序列化 → ② 入队（线程锁）→ ③ 线程切换 → ④ JSON 反序列化 → ⑤ 字符串查方法 → ⑥ 执行
```

**JSI 一次调用 2 步**：
```
① C++ 函数指针直调 + 类型转换 → ② 执行
```

三个根本原因：
| 原因 | 旧 Bridge | JSI |
|------|----------|-----|
| 同进程直调 vs 跨线程消息 | 线程隔离，消息队列 | 同线程函数指针直调 |
| 类型转换 vs 序列化 | 全部变字符串再解析 | `.asString()` 一步到位 |
| 编译时绑定 vs 运行时查找 | 字符串 HashMap 查方法 | Codegen 编译时绑定函数指针 |

---

### JSI 参数内存模型

**基本类型：值拷贝，零分配**
```
JS number/boolean → jsi::Value（8字节存值）→ C++ double/bool
```

**引用类型（Object/Array）：惰性按需转换**

C++ 拿到的是 JS 堆对象的句柄（`jsi::Object`），只有调 `getProperty()` 时才转换该字段：
```cpp
// JS 传入: { name: 'device', rssi: -45, history: [...1000 items] }
void handle(jsi::Runtime& rt, const jsi::Object& obj) {
  auto name = obj.getProperty(rt, "name").asString(rt).utf8(rt);
  // history 1000 个元素你没读 → 零开销
  // 旧 Bridge 会把 history 也 JSON.stringify → 巨大浪费
}
```

**ArrayBuffer：真正的零拷贝共享内存**
```cpp
void handleBuffer(jsi::Runtime& rt, const jsi::ArrayBuffer& buf) {
  uint8_t* data = buf.data(rt);  // 直接拿指针，和 JS 共享同一块内存
  size_t size = buf.size(rt);    // Native 读写，JS 立即可见
}
```

| 类型 | JSI | 旧 Bridge |
|------|-----|----------|
| number/boolean | 零分配 | JSON 字符串化 |
| Object（10 字段用 2 个） | 只转换 2 个 | 全部 10 字段序列化 |
| Array（1000 元素用 3 个） | 只转换 3 个 | 全部序列化 |
| ArrayBuffer（1MB） | 零拷贝共享内存 | Base64 膨胀 33% |

---

### Pure C++ TurboModule

适用：逻辑不依赖平台 API（加密、协议解析），一份 C++ 两端共用。

调用链最短：`JS → JSI(C++) → 你的 C++`（无 JNI/ObjC）。

```cpp
class CryptoModule : public NativeCryptoModuleCxxSpec<CryptoModule> {
  jsi::String sha256(jsi::Runtime& rt, jsi::String input) {
    std::string hash = computeSha256(input.utf8(rt));
    return jsi::String::createFromUtf8(rt, hash);
  }
};
```

---

## 我的经验支撑

| 经验 | 做了什么 | 和 TurboModule 的关联 |
|------|---------|---------------------|
| 快应用框架（J2V8 Bridge） | V8 + J2V8 实现 JS↔Java 同步通信 | 本质和 JSI 相同：JS 直调 Native |
| CRN 工程化 | 理解 RN Bridge → JSI 迁移路径 | 通信架构升级 |
| 模块裁剪（反射解耦） | 反射解耦编译依赖 | Native 层架构设计 |
| DEX 布局优化 | 热代码前置减少 page fault | Native 层性能优化 |

**J2V8 vs JSI 对比**：
```
J2V8（快应用）：JS(V8) → J2V8 API（Java 直操作 V8）→ Java
JSI（RN）：    JS(Hermes) → JSI（C++ 中间层）→ JNI → Java

本质相同：JS 直调 Native，无序列化，可同步
区别：J2V8 是 Java↔V8 直连；JSI 多了 C++ 中间层（更通用，跨引擎）
```

---

## Q&A

### TurboModule 和旧 NativeModule 能共存吗

可以。RN 0.68+ 支持 interop layer，旧模块不改也能跑。新模块建议都用 TurboModule。

### 为什么 Spec 里能定义同步方法，旧架构为什么不行

旧架构 JS 和 Native 在不同线程，通信靠消息队列，天然异步。JSI 让它们在同一线程内函数直调，所以能同步返回。

### Codegen 生成的代码要提交 Git 吗

不需要。在 `build/generated/` 下，每次构建自动重新生成。

### iOS 和 Android 的实现能共用吗

如果逻辑不依赖平台 API，可以用 Pure C++ TurboModule，一份代码两端共用。否则各写各的。

### BLE 场景下 TurboModule 比旧架构好在哪

1. 同步方法：`isConnected()` 不需要 await，UI 直接读状态
2. ArrayBuffer 零拷贝：传感器数据直接传给 JS，不经过 Base64
3. 懒加载：BLE 模块在首次使用时才初始化，不拖慢启动

### 用一个例子理解 JSI 的本质

> JSI 的核心就是 `jsi::Runtime` 这个 C++ 对象。它代表一个 JS 引擎实例，你通过它可以做任何事：

```cpp
// jsi::Runtime 核心接口（简化）
class Runtime {
  // 1. 执行 JS 代码
  Value evaluateJavaScript(const std::string& script);

  // 2. 读写 JS 全局对象
  Object global();  // 拿到 globalThis

  // 3. 创建 JS 值
  String createStringFromUtf8(const char* str);
  Object createObject();
  Function createFunctionFromHostFunction(...);  // C++ 函数变成 JS 函数

  // 4. 注册 HostObject（把 C++ 对象暴露给 JS）
  // global() = JS 的 globalThis（RN 里是 global，浏览器里是 window）
  // JSI 不只能访问全局空间——拿到 Runtime 能做任何事（执行代码、读写对象）
  // 挂到 global 只是注册入口的惯例，实际 TurboModule 通过 TurboModuleRegistry 管理（懒加载）
  // global().setProperty(rt, "BLEModule", Object::createFromHostObject(rt, myHostObj));
};
```

> **一个完整例子——把 C++ 的 add 函数暴露给 JS**：

```cpp
void installJSIBindings(jsi::Runtime& rt) {
  // 创建一个 C++ 函数，包装成 JS 可调用的函数
  auto add = jsi::Function::createFromHostFunction(
    rt,
    jsi::PropNameID::forAscii(rt, "nativeAdd"),  // JS 侧看到的函数名
    2,  // 参数个数
    [](jsi::Runtime& rt,           // 运行时引用
       const jsi::Value& thisVal,  // this 上下文
       const jsi::Value* args,     // 参数数组
       size_t count                // 参数个数
    ) -> jsi::Value {
      double a = args[0].asNumber();  // JS number → C++ double
      double b = args[1].asNumber();
      return jsi::Value(a + b);       // C++ double → JS number
    }
  );

  // 挂到全局对象上：JS 侧就能调 global.nativeAdd(1, 2)
  rt.global().setProperty(rt, "nativeAdd", std::move(add));
}
```

> **JS 侧直接用**：
```javascript
const result = global.nativeAdd(1, 2); // → 3（同步，C++ 直接返回）
```

> **核心能力总结**：
> | 接口 | 能力 |
> |------|------|
> | `Runtime.global()` | 访问 JS 全局对象 |
> | `Function::createFromHostFunction` | 把 C++ 函数暴露给 JS 调用 |
> | `Object::createFromHostObject` | 把 C++ 对象暴露给 JS（属性访问触发 C++ 回调） |
> | `Value.asNumber() / asString()` | JS 值 → C++ 类型 |
> | `Value(double) / String::createFromUtf8` | C++ 值 → JS 值 |
>
> **一句话**：`jsi::Runtime` 给了 C++ 完全操作 JS 引擎的能力——执行代码、读写变量、注册函数、创建对象。TurboModule 就是在此基础上封装的"规范化 Native Module 注册机制"。
