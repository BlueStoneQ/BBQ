# JS Bridge 设计（三段式架构）

## 目录

- [1. 总览：通用架构与核心部件](#1-总览通用架构与核心部件)
- [2. RN JSI Bridge 设计](#2-rn-jsi-bridge-设计)
  - [JS 侧](#js-侧)
  - [C++ 引擎侧（JSI）](#c-层jsi)
  - [Native 侧（Android / iOS）](#native-侧android--ios)
- [3. 快应用 J2V8 Bridge 设计](#3-快应用-j2v8-bridge-设计)
  - [JS 侧](#js-侧-1)
  - [C++ 引擎侧（V8 + J2V8）](#c-层v8--j2v8)
  - [Native 侧（Android）](#native-侧android)
- [4. H5 WebView JS Bridge 设计](#4-h5-webview-js-bridge-设计)
  - [JS 侧](#js-侧-2)
  - [C++ 引擎侧（WebView 容器）](#c-层webview-容器)
  - [Native 侧（Android / iOS）](#native-侧android--ios-1)
- [5. 补充：核心概念深入](#5-补充核心概念深入)
  - [HostObject vs HostFunction](#hostobject-vs-hostfunction)
  - [RN 新架构注入的两套核心入口](#rn-新架构注入的两套核心入口)

---

## 1. 总览：通用架构与核心部件

### 本质

**JS Bridge 的本质 = External Function 注入机制**

JS 侧看到的函数，实际执行的是 Native 代码。通过向 JS 引擎注入 external function，实现 JS ↔ Native 双向通信。

### 三段式通用架构

```
┌─────────────────────────────────────────────────────────────┐
│                    JS 侧                                     │
│  核心数据结构: Map (回调映射表)                              │
│  入口: External Function (Native 注入)                       │
│  API: 业务友好的封装层                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ 函数调用 / 回调
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   C++ / 引擎层                               │
│  核心机制: HostFunction / HostObject                         │
│  通信方式: JSI / J2V8 / WebView 容器                         │
│  类型转换: jsi::Value ↔ C++ ↔ JNI/jstring                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ JNI / ObjC++
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                Native 侧 (Android / iOS)                    │
│  模块注册: {moduleName: implementation}                      │
│  功能实现: 网络 / 存储 / 设备能力                            │
│  回调执行: evaluateJavascript / JSI 反向调用                 │
└─────────────────────────────────────────────────────────────┘
```

### 核心部件（必需）

| 层级 | 核心部件 | 作用 |
|------|---------|------|
| **JS 侧** | Map 映射表 | 管理 callbackId → callbackFunction |
| **JS 侧** | External Function | Native 注入的入口函数 |
| **C++ 层** | HostFunction | C++ 函数包装成 JS 可调用 |
| **C++ 层** | HostObject | C++ 对象包装成 JS 可访问 |
| **Native 层** | 模块注册表 | 管理所有 Native 模块 |
| **Native 层** | 回调管理器 | 管理异步回调 |

### 业界三种实现

| 方案 | 通信机制 | 序列化 | 同步能力 | 适用场景 |
|------|---------|--------|---------|---------|
| **RN JSI** | JSI HostFunction | 零序列化 | ✅ 可同步 | RN 应用 |
| **快应用 J2V8** | Java 直操作 V8 | 零序列化 | ✅ 可同步 | 快应用框架 |
| **H5 WebView** | URL Scheme / 注入 API | JSON 序列化 | Android ✅ / iOS ❌ | Hybrid App |

---

## 2. RN JSI Bridge 设计

### 本质

**JSI = C++ 层的函数指针直调接口，无序列化，可同步返回**

JS 通过 JSI 直接调用 C++ 函数，C++ 通过 JNI 调用 Java/Kotlin，全程零序列化。

### 架构总览

```
JS (TurboModule Spec)
    ↓ JSI HostFunction (C++ 函数指针直调)
C++ (Codegen 生成胶水代码)
    ↓ JNI (Android) / ObjC++ (iOS)
Java/Kotlin | ObjC/Swift (TurboModule 实现)
```

---

### JS 侧

#### 核心数据结构

```javascript
// TurboModuleRegistry 内部实现
class TurboModuleRegistry {
  constructor() {
    this.moduleMap = new Map();  // {moduleName: TurboModuleProxy}
  }
}

// 每个 TurboModule 是一个 Proxy，拦截所有方法调用
const BLEModule = new Proxy({}, {
  get(target, method) {
    return (...args) => {
      // 通过 JSI 调用 Native
      return global.__turboModuleProxy('BLEModule', method, args);
    };
  }
});
```

#### 使用方式

```typescript
// 1. 定义 Spec（接口契约）
// NativeBLEModule.ts
import { TurboModule, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  isConnected(): boolean;                        // 同步方法
  connect(deviceId: string): Promise<boolean>;   // 异步方法
}

export default TurboModuleRegistry.getEnforcing<Spec>('BLEModule');
```

```typescript
// 2. 业务代码使用
import NativeBLEModule from './NativeBLEModule';

// 同步调用
const connected = NativeBLEModule.isConnected(); // ← 直接返回 boolean

// 异步调用
const success = await NativeBLEModule.connect('device-123');
```

#### 关键点

- **入口**：`global.__turboModuleProxy` (Native 注入的 external function)
- **数据结构**：Map 管理模块缓存
- **协议**：Spec 定义接口契约，Codegen 生成胶水代码
- **回调**：Promise / EventEmitter

---

### C++ 层（JSI）

#### 核心机制：HostFunction

```cpp
// jsi::Runtime 核心 API
class Runtime {
  // 创建 JS 可调用的 C++ 函数
  Function createFunctionFromHostFunction(
    const PropNameID& name,
    unsigned int paramCount,
    std::function<Value(Runtime&, const Value&, const Value*, size_t)> func
  );
  
  // 访问 JS 全局对象
  Object global();
};

// 注册一个 HostFunction = 注入 external function
void installJSIBindings(jsi::Runtime& rt) {
  auto nativeAdd = jsi::Function::createFromHostFunction(
    rt,
    jsi::PropNameID::forAscii(rt, "nativeAdd"),
    2,
    [](jsi::Runtime& rt, const jsi::Value& thisVal,
       const jsi::Value* args, size_t count) -> jsi::Value {
      double a = args[0].asNumber();
      double b = args[1].asNumber();
      return jsi::Value(a + b);  // C++ 计算后返回
    }
  );
  
  rt.global().setProperty(rt, "nativeAdd", std::move(nativeAdd));
}
```

#### 参数传递（零序列化）

```cpp
// 基本类型：直接值拷贝
double num = args[0].asNumber();           // JS number → C++ double
bool flag = args[1].getBool();             // JS boolean → C++ bool
std::string str = args[2].asString(rt).utf8(rt); // JS string → C++ string

// Object/Array：惰性按需转换
jsi::Object obj = args[0].asObject(rt);
auto name = obj.getProperty(rt, "name").asString(rt).utf8(rt); // 只转换读取的字段

// ArrayBuffer：零拷贝共享内存
jsi::ArrayBuffer buf = args[0].asArrayBuffer(rt);
uint8_t* data = buf.data(rt);  // 直接拿指针，和 JS 共享内存
```

#### Codegen 生成的胶水代码

```cpp
// Codegen 根据Spec 自动生成
class NativeBLEModuleSpecJSI : public TurboModule {
  jsi::Value get(jsi::Runtime& rt, const jsi::PropNameID& name) override {
    if (name == "connect") {
      return jsi::Function::createFromHostFunction(rt, name, 1,
        [](jsi::Runtime& rt, ...) -> jsi::Value {
          // 1. 从 args 提取参数
          std::string deviceId = args[0].asString(rt).utf8(rt);
          
          // 2. 通过 JNI 调用 Java
          jobject result = callJavaMethod("connect", deviceId);
          
          // 3. 返回 Promise
          return createPromise(rt, result);
        });
    }
  }
};
```

#### 关键点

- **入口**：`jsi::Function::createFromHostFunction`
- **数据结构**：`jsi::Runtime` 管理 JS 引擎状态
- **类型转换**：`jsi::Value` ↔ C++ 类型，零序列化
- **性能**：惰性按需转换，ArrayBuffer 零拷贝

---

### Native 侧（Android / iOS）

#### Android（Kotlin + JNI）

```kotlin
// 1. 继承 Codegen 生成的抽象基类
class BLEModule(reactContext: ReactApplicationContext)
  : NativeBLEModuleSpec(reactContext) {

  override fun getName() = "BLEModule"

  // 同步方法：直接返回
  override fun isConnected(): Boolean {
    return connectionState == BluetoothGatt.STATE_CONNECTED
  }

  // 异步方法：通过 Promise
  override fun connect(deviceId: String, promise: Promise) {
    val gatt = device.connectGatt(context, false, object : BluetoothGattCallback() {
      override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        if (newState == BluetoothGatt.STATE_CONNECTED) {
          promise.resolve(true)  // ← 通过 JSI 回调 JS Promise
        } else {
          promise.reject("BLE_ERROR", "Connection failed")
        }
      }
    })
  }
}
```

```kotlin
// 2. 注册模块
class BLEPackage : TurboReactPackage() {
  override fun getModule(name: String, ctx: ReactApplicationContext): NativeModule? {
    return if (name == BLEModule.NAME) BLEModule(ctx) else null
  }
}

// 3. Application 中注册
override fun getPackages(): List<ReactPackage> {
  return PackageList(this).packages + BLEPackage()
}
```

#### iOS（Objective-C++）

```objc
// 1. 实现 Codegen 生成的 Protocol
@interface BLEModule : NSObject <NativeBLEModuleSpec>
@end

@implementation BLEModule

RCT_EXPORT_MODULE(BLEModule)

// 同步方法
- (NSNumber *)isConnected {
  return @(self.peripheral.state == CBPeripheralStateConnected);
}

// 异步方法
- (void)connect:(NSString *)deviceId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
  [self.centralManager connectPeripheral:peripheral options:nil];
  resolve(@(YES));
}

// 桥接到 C++ JSI
- (std::shared_ptr<TurboModule>)getTurboModule:(const ObjCTurboModule::InitParams &)params {
  return std::make_shared<NativeBLEModuleSpecJSI>(params);
}

@end
```

#### 调用链（Android）

```
JS: BLEModule.connect('device-123')
  ↓ JSI HostFunction 触发
C++: NativeBLEModuleSpecJSI::connect()
  ↓ JNI 调用
JNI: env->CallObjectMethod(javaModule, methodId, deviceId)
  ↓
Java: BLEModule.connect("device-123")
  ↓
Android API: BluetoothGatt.connect()
```

#### 关键点

- **入口**：继承 Codegen 生成的基类/协议
- **数据结构**：模块注册表管理所有 TurboModule
- **回调**：通过 Promise / EventEmitter 传回结果
- **无需手写 JNI**：Codegen 自动生成

---

## 3. 快应用 J2V8 Bridge 设计

### 本质

**J2V8 = Java 直接操作 V8 引擎，无 C++ 中间层，零序列化，可同步返回**

Java 通过 J2V8 API 直接注册方法到 V8，JS 调用时直接执行 Java 代码。

### 架构总览

```
JS (快应用 ViewModel)
    ↓ V8 C++ API (通过 J2V8 封装)
Java (J2V8Bridge + Native Module)
    ↓ 系统调用
Android API
```

---

### JS 侧

#### 核心数据结构

```javascript
// 快应用框架内部实现
class QuickAppBridge {
  constructor() {
    this.callbackMap = new Map();  // {callbackId: callback}
    this.moduleMap = new Map();    // {moduleName: moduleProxy}
  }
  
  // 调用 Native
  callNative(module, method, params, callback) {
    const callbackId = this.generateId();
    this.callbackMap.set(callbackId, callback);
    
    // 通过 J2V8 注入的函数调用 Native
    global.j2v8Bridge.invoke(module, method, JSON.stringify(params), callbackId);
  }
  
  // Native 回调入口（J2V8 注入）
  invokeCallback(callbackId, result) {
    const callback = this.callbackMap.get(callbackId);
    if (callback) {
      callback(JSON.parse(result));
      this.callbackMap.delete(callbackId);
    }
  }
}
```

#### 使用方式

```javascript
// 快应用 ViewModel 中使用
export default {
  data: { deviceList: [] },
  
  onInit() {
    // 同步调用
    const info = system.device.getInfo();  // ← 直接返回
    
    // 异步调用
    system.bluetooth.scan({ timeout: 10000 }, (result) => {
      this.deviceList = result.devices;
    });
  }
}
```

#### 关键点

- **入口**：`global.j2v8Bridge` (J2V8 注入)
- **数据结构**：Map 管理回调映射
- **协议**：JSON 序列化参数（J2V8 内部优化）
- **同步能力**：支持同步返回（区别于 WebView）

---

### C++ 层（V8 + J2V8）

#### 核心机制：J2V8 封装

```
J2V8 架构：
┌──────────────────────────────────────────┐
│  Java 层 (J2V8 API)                       │
│  V8Object.registerJavaMethod()            │
│  V8.executeScript()                       │
└─────────────┬────────────────────────────┘
              │ JNI
┌─────────────▼────────────────────────────┐
│  C++ 层 (V8 引擎)                         │
│  v8::Isolate, v8::Context                 │
│  v8::FunctionTemplate                     │
└──────────────────────────────────────────┘
```

#### J2V8 注册 External Function

> 关于 J2V8 + V8 引擎如何引入和使用 → [附录：J2V8 安装与使用](#附录j2v8--v8-安装与使用)

```java
// ─── Android (Java) ───
// J2V8 核心 API
public class J2V8Bridge {
  private V8 v8;
  
  // 注册 Java 方法到 V8（本质是 external function）
  public void registerModule(String moduleName, Object moduleImpl) {
    V8Object module = new V8Object(v8);
    
    // 反射扫描 moduleImpl 的所有方法
    for (Method method : moduleImpl.getClass().getMethods()) {
      module.registerJavaMethod(moduleImpl, method.getName(), method.getName(), 
                                 method.getParameterTypes());
    }
    
    v8.add(moduleName, module);  // 挂载到 global
  }
  
  // 执行 JS 代码
  public Object executeScript(String script) {
    return v8.executeScript(script);
  }
  
  // 同步调用（无序列化）
  public Object callSync(String module, String method, Object... args) {
    V8Object obj = v8.getObject(module);
    return obj.executeMethod(method, args);  // ← 直接调用，零序列化
  }
}
```

#### V8 内部实现（C++）

```cpp
// ─── C++ 层（V8 引擎内部，J2V8 底层实现）───
// J2V8 底层调用 V8 C++ API
void V8Object::RegisterJavaMethod(...) {
  v8::Isolate* isolate = v8::Isolate::GetCurrent();
  v8::HandleScope scope(isolate);
  
  // 创建 V8 FunctionTemplate，指向 Java 方法
  v8::Local<v8::FunctionTemplate> tpl = v8::FunctionTemplate::New(
    isolate, 
    [](const v8::FunctionCallbackInfo<v8::Value>& args) {
      // JNI 回调 Java 方法
      jobject result = callJavaMethod(...);
      args.GetReturnValue().Set(convertToV8(result));
    }
  );
  
  obj->Set(v8::String::NewFromUtf8(isolate, methodName), tpl->GetFunction());
}
```

#### 关键点

- **入口**：`V8Object.registerJavaMethod()` (Java API)
- **无 C++ 中间层**：Java 直接操作 V8
- **类型转换**：J2V8 自动处理 Java ↔ V8 类型
- **同步能力**：`executeMethod()` 同步返回

---

### Native 侧（Android）

#### 模块实现

```java
// ─── Android (Java) ───
// 快应用 Native 模块实现
public class DeviceModule {
  private Context context;
  
  public DeviceModule(Context context) {
    this.context = context;
  }
  
  // 同步方法：直接返回
  public String getInfo() {
    return "{\"brand\":\"" + Build.BRAND + "\",\"model\":\"" + Build.MODEL + "\"}";
  }
  
  // 异步方法：通过回调
  public void getLocation(String params, String callbackId) {
    LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, new LocationListener() {
      @Override
      public void onLocationChanged(Location location) {
        // 回调到 JS
        String result = "{\"lat\":" + location.getLatitude() + 
                       ",\"lng\":" + location.getLongitude() + "}";
        j2v8Bridge.invokeCallback(callbackId, result);
      }
    });
  }
}
```

#### 模块注册

```java
// 框架初始化时注册模块
public class QuickAppRuntime {
  private J2V8Bridge j2v8Bridge;
  
  public void init() {
    j2v8Bridge = new J2V8Bridge();
    
    // 注册所有 Native 模块
    j2v8Bridge.registerModule("device", new DeviceModule(context));
    j2v8Bridge.registerModule("bluetooth", new BluetoothModule(context));
    j2v8Bridge.registerModule("storage", new StorageModule(context));
  }
}
```

#### 调用链

```
JS: system.device.getInfo()
  ↓ V8 FunctionTemplate 触发
JNI: J2V8 调用 Java 方法
  ↓
Java: DeviceModule.getInfo()
  ↓ 返回字符串
V8: 字符串转 JS string
  ↓
JS: 收到返回值（同步）
```

#### 关键点

- **入口**：`registerModule()` 注册模块
- **数据结构**：模块注册表
- **同步能力**：Java 方法直接返回，V8 同步转 JS
- **无序列化**：J2V8 直接传递 V8 值

---

## 4. H5 WebView JS Bridge 设计

### 本质

**WebView JS Bridge = 消息通道 + JSON 序列化 + 异步回调**

JS 通过消息通道（URL Scheme / 注入 API）发送请求，Native 处理后通过 `evaluateJavascript` 回调结果。

### 架构总览

```
JS (WebView)
    ↓ URL Scheme / @JavascriptInterface / messageHandlers
Native (WebView 容器)
    ↓ 系统调用
Android / iOS API
    ↓ evaluateJavascript
JS (回调执行)
```

---

### JS 侧

#### 核心数据结构

```javascript
class JSBridge {
  constructor() {
    // 核心：回调映射表（必需）
    this.callbackMap = new Map();     // {callbackId: callbackFunction}
    this.moduleMap = new Map();       // {moduleName: moduleProxy}
    
    // 可选：任务队列（性能优化）
    this.taskQueue = [];
    this.maxConcurrent = 3;
    this.currentConcurrent = 0;
  }
  
  // 调用 Native
  callNative(module, method, params, callback) {
    const callbackId = `cb_${Date.now()}_${Math.random()}`;
    this.callbackMap.set(callbackId, callback);
    
    const request = {
      module,
      method,
      params,
      callbackId
    };
    
    // 三种通信方式（按优先级）
    if (window.nativeBridge) {
      // 方式1：注入 API（推荐）
      window.nativeBridge.invoke(JSON.stringify(request));
    } else if (window.webkit?.messageHandlers?.bridge) {
      // 方式2：iOS messageHandlers（异步）
      window.webkit.messageHandlers.bridge.postMessage(request);
    } else {
      // 方式3：URL Scheme（降级）
      this.invokeByURLScheme(request);
    }
  }
  
  // URL Scheme 方式
  invokeByURLScheme(request) {
    const url = `jsbridge://${request.module}/${request.method}` +
                `?params=${encodeURIComponent(JSON.stringify(request.params))}` +
                `&callback=${request.callbackId}`;
    const iframe = document.createElement('iframe');
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 0);
  }
  
  // Native 回调入口（Native 通过 evaluateJavascript 调用）
  invokeCallback(callbackId, result) {
    const callback = this.callbackMap.get(callbackId);
    if (callback) {
      callback(result);
      this.callbackMap.delete(callbackId);
    }
  }
}

// 全局实例
window.jsBridge = new JSBridge();
```

#### 使用方式

```javascript
// 异步调用
jsBridge.callNative('device', 'getLocation', { enableHighAccuracy: true }, (result) => {
  console.log('位置:', result.latitude, result.longitude);
});

// Promise 封装
jsBridge.callNativePromise = function(module, method, params) {
  return new Promise((resolve, reject) => {
    this.callNative(module, method, params, (result) => {
      if (result.code === 0) resolve(result.data);
      else reject(new Error(result.message));
    });
  });
};

// 使用 Promise
const location = await jsBridge.callNativePromise('device', 'getLocation', {});
```

#### 关键点

- **入口**：Native 注入的 `window.nativeBridge` / URL Scheme
- **数据结构**：Map 管理回调映射（核心必需）
- **协议**：JSON 序列化请求/响应
- **同步能力**：Android `@JavascriptInterface` 可同步，iOS 只能异步
- **任务队列**：可选的性能优化层

---

### C++ 层（WebView 容器）

**H5 Bridge 没有 C++ 中间层**，通信由 WebView 容器直接处理。

#### Android WebView 架构

```
WebView (Chromium 内核)
    │ JavaScript 执行环境
    ├── @JavascriptInterface (Java 对象注入)
    ├── shouldOverrideUrlLoading (URL 拦截)
    └── evaluateJavascript (反向调用 JS)
```

#### iOS WKWebView 架构

```
WKWebView (WebKit 内核)
    │ JavaScript 执行环境
    ├── WKScriptMessageHandler (消息通道)
    ├── decidePolicyFor (URL 拦截)
    └── evaluateJavaScript (反向调用 JS)
```

#### 通信机制对比

| 机制 | Android | iOS | 序列化 | 同步 |
|------|---------|-----|--------|------|
| 注入 API | `@JavascriptInterface` | `messageHandlers` | 有 | Android ✅ / iOS ❌ |
| URL Scheme | `shouldOverrideUrlLoading` | `decidePolicyFor` | 有 | ❌ 异步 |
| prompt 拦截 | `onJsPrompt` | - | 有 | ✅ 同步 |

---

### Native 侧（Android / iOS）

#### Android 实现

```java
// 1. 定义 Bridge 类
public class JSBridge {
  private WebView webView;
  private Context context;
  private Map<String, Object> modules = new HashMap<>();
  
  // 注入方法（@JavascriptInterface = external function）
  @JavascriptInterface
  public String invoke(String jsonRequest) {
    try {
      JSONObject request = new JSONObject(jsonRequest);
      String module = request.getString("module");
      String method = request.getString("method");
      String callbackId = request.getString("callbackId");
      JSONObject params = request.getJSONObject("params");
      
      // 调用对应模块
      Object moduleImpl = modules.get(module);
      Method targetMethod = moduleImpl.getClass().getMethod(method, JSONObject.class);
      Object result = targetMethod.invoke(moduleImpl, params);
      
      // 同步返回（Android 特有能力）
      return result.toString();
      
    } catch (Exception e) {
      return "{\"code\":-1,\"message\":\"" + e.getMessage() + "\"}";
    }
  }
  
  // 异步回调到 JS
  public void callback(String callbackId, String result) {
    String js = "window.jsBridge.invokeCallback('" + callbackId + "', " + result + ")";
    webView.evaluateJavascript(js, null);
  }
  
  // 注册模块
  public void registerModule(String name, Object module) {
    modules.put(name, module);
  }
}
```

```java
// 2. 注册到 WebView
WebView webView = findViewById(R.id.webview);
webView.getSettings().setJavaScriptEnabled(true);

JSBridge jsBridge = new JSBridge(webView, this);
jsBridge.registerModule("device", new DeviceModule());
jsBridge.registerModule("storage", new StorageModule());

webView.addJavascriptInterface(jsBridge, "nativeBridge");
```

```java
// 3. 模块实现示例
public class DeviceModule {
  // 同步方法
  public String getInfo(JSONObject params) {
    JSONObject result = new JSONObject();
    result.put("brand", Build.BRAND);
    result.put("model", Build.MODEL);
    return result.toString();
  }
  
  // 异步方法
  public void getLocation(JSONObject params, final JSBridge bridge, final String callbackId) {
    LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, new LocationListener() {
      @Override
      public void onLocationChanged(Location location) {
        JSONObject result = new JSONObject();
        result.put("latitude", location.getLatitude());
        result.put("longitude", location.getLongitude());
        bridge.callback(callbackId, result.toString());
      }
    });
  }
}
```

#### iOS 实现

```swift
// 1. 定义 Bridge 类
class JSBridge: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?
    private var modules: [String: Any] = [:]
    
    // 初始化
    init(webView: WKWebView) {
        self.webView = webView
        super.init()
        
        // 注册消息处理器
        webView.configuration.userContentController.add(self, name: "bridge")
    }
    
    // 接收 JS 消息（异步，无法同步返回）
    func userContentController(_ userContentController: WKUserContentController, 
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        
        let module = body["module"] as? String ?? ""
        let method = body["method"] as? String ?? ""
        let callbackId = body["callbackId"] as? String ?? ""
        let params = body["params"] as? [String: Any] ?? [:]
        
        // 调用对应模块
        if let moduleImpl = modules[module],
           let targetMethod = class_getInstanceMethod(type(of: moduleImpl), Selector(method)) {
            // 反射调用
            // ...
        }
    }
    
    // 回调到 JS
    func callback(callbackId: String, result: Any) {
        guard let webView = webView else { return }
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        let jsonString = String(data: jsonData, encoding: .utf8)!
        
        let js = "window.jsBridge.invokeCallback('\(callbackId)', \(jsonString))"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }
    
    // 注册模块
    func registerModule(name: String, module: Any) {
        modules[name] = module
    }
}
```

```swift
// 2. 使用示例
let webView = WKWebView()
let jsBridge = JSBridge(webView: webView)

jsBridge.registerModule(name: "device", module: DeviceModule())

// 加载 H5 页面
webView.load(URLRequest(url: URL(string: "https://example.com")!))
```

#### 调用链（Android）

```
JS: jsBridge.callNative('device', 'getInfo', {}, callback)
  ↓ @JavascriptInterface 触发
Java: JSBridge.invoke(jsonRequest)
  ↓ 解析并调用
Java: DeviceModule.getInfo(params)
  ↓ 返回结果
V8: 字符串转 JS
  ↓
JS: callback(result)  // 同步返回（Android 特有）
```

#### 调用链（iOS）

```
JS: window.webkit.messageHandlers.bridge.postMessage(request)
  ↓ WKScriptMessageHandler 触发
Swift: JSBridge.userContentController(didReceive:)
  ↓ 解析并调用
Swift: DeviceModule.getInfo(params)
  ↓ 异步回调
Swift: webView.evaluateJavaScript(js)
  ↓
JS: window.jsBridge.invokeCallback(callbackId, result)  // 异步回调
```

#### 关键点

- **入口**：`addJavascriptInterface` / `WKScriptMessageHandler`
- **数据结构**：模块注册表 + 回调映射表
- **序列化**：必需，JSON 字符串传递
- **同步能力**：Android ✅ / iOS ❌
- **回调方式**：`evaluateJavascript` 注入 JS 代码

---

## 对比总结

| 维度 | RN JSI | 快应用 J2V8 | H5 WebView |
|------|--------|------------|------------|
| **C++ 层** | JSI HostFunction | V8 C++ API | 无 |
| **序列化** | 零序列化 | 零序列化 | JSON 序列化 |
| **同步能力** | ✅ 可同步 | ✅ 可同步 | Android ✅ / iOS ❌ |
| **性能** | 高 | 高 | 中等 |
| **实现复杂度** | 高（Codegen） | 中（J2V8封装） | 低（原生 API） |
| **跨平台** | ✅ 双端统一 | Android only | 双端实现不同 |

**统一本质**：都是向 JS 引擎注入 external function，差异在于注入层次和性能开销。


---

## 5. 补充：核心概念深入

### HostObject vs HostFunction

#### 本质

**HostFunction**：注入单个 external function 到 JS
**HostObject**：注入一个代理对象到 JS，所有属性/方法访问都转发到 C++

```
HostFunction = 一个 external function
HostObject   = 一组 external function 的容器（懒加载）
```

#### 为什么需要 HostObject

如果只用 HostFunction，每个方法单独注入：
```cpp
// 没有 HostObject：全局被污染，方法越多越乱
rt.global().setProperty(rt, "bleConnect", hostFunc1);
rt.global().setProperty(rt, "bleDisconnect", hostFunc2);
rt.global().setProperty(rt, "bleIsConnected", hostFunc3);
```

有了 HostObject：
```cpp
// 一个对象包含所有方法，命名空间隔离，懒加载
rt.global().setProperty(rt, "BLEModule", hostObject);

// JS 侧：
BLEModule.connect('xxx');     // 触发 C++ get("connect") → 返回 HostFunction
BLEModule.isConnected;        // 触发 C++ get("isConnected") → 返回值
BLEModule.disconnect();       // 触发 C++ get("disconnect") → 返回 HostFunction
```

#### HostObject 的工作原理

```
JS 堆上：一个代理壳（不存储实际数据）
C++ 堆上：真正的对象实体

JS: BLEModule.connect
  ↓ 引擎发现 BLEModule 是 HostObject
  ↓ 触发 C++ 的 get() 回调
C++: HostObject::get(rt, "connect")
  ↓ 返回一个 HostFunction
JS: 拿到函数，调用它
  ↓
C++: lambda 执行实际逻辑
```

```cpp
// C++ 实现
class BLEModule : public jsi::HostObject {
  jsi::Value get(jsi::Runtime& rt, const jsi::PropNameID& name) override {
    if (name == "connect") {
      return jsi::Function::createFromHostFunction(rt, name, 1,
        [](jsi::Runtime& rt, const jsi::Value& thisVal,
           const jsi::Value* args, size_t count) -> jsi::Value {
          std::string deviceId = args[0].asString(rt).utf8(rt);
          // 实际 Native 逻辑...
          return jsi::Value(true);
        });
    }
    if (name == "isConnected") {
      return jsi::Value(connectionState == CONNECTED);
    }
    return jsi::Value::undefined();
  }
};
```

#### HostObject 的三个核心优势

1. **懒加载**：JS 不访问的方法不会创建 HostFunction，节省内存
2. **命名空间隔离**：模块化组织，不污染全局
3. **动态属性**：`get()` 可以返回实时状态（如连接状态）

#### 各引擎对应概念

| JSI (RN) | V8 | J2V8 | 本质 |
|-----------|-----|------|------|
| **HostFunction** | `v8::FunctionTemplate` | `registerJavaMethod()` | 注入单个函数 |
| **HostObject** | `v8::ObjectTemplate` + `NamedPropertyHandlerConfiguration` | `V8Object`（无拦截器，直接注册） | 注入代理对象 |

**V8 的 HostObject 等价实现**：
```cpp
v8::Local<v8::ObjectTemplate> tpl = v8::ObjectTemplate::New(isolate);

// 设置属性拦截器 = HostObject 的 get/set
tpl->SetHandler(v8::NamedPropertyHandlerConfiguration(
  // getter（等价于 HostObject::get）
  [](v8::Local<v8::Name> property, const v8::PropertyCallbackInfo<v8::Value>& info) {
    std::string name = *v8::String::Utf8Value(info.GetIsolate(), property);
    if (name == "connect") {
      info.GetReturnValue().Set(/* FunctionTemplate */);
    }
  }
));
```

**J2V8 没有真正的 HostObject**——方法在注册时就全部绑定，没有惰性拦截：
```java
V8Object module = new V8Object(v8);
module.registerJavaMethod(impl, "connect", "connect", paramTypes);    // 立即绑定
module.registerJavaMethod(impl, "disconnect", "disconnect", paramTypes); // 立即绑定
v8.add("BLEModule", module);
```

#### 类比理解

```
HostObject ≈ ES6 Proxy（但拦截器跑在 C++ 层）

const obj = new Proxy({}, {
  get(target, prop) {
    if (prop === 'connect') return (...args) => nativeConnect(args);
    if (prop === 'isConnected') return nativeGetState();
  }
});
```

---

### RN 新架构注入的两套核心入口

RN 新架构向 JS 引擎注入**两套核心 HostObject**：

```
1. global.__turboModuleProxy     → 功能通信（调 Native API）
2. global.nativeFabricUIManager  → 渲染通信（UI 指令）
```

| 入口 | 用途 | 类型 |
|------|------|------|
| `__turboModuleProxy` | JS 调用 Native 功能模块 | HostFunction |
| `nativeFabricUIManager` | JS 传递渲染指令到 C++ Shadow Tree | HostObject |

**与旧架构对比**：
```
旧架构（Bridge）：
  - 一个通道：BatchedBridge
  - 功能 + 渲染 走同一个 JSON 消息队列
  - 全部异步，全部序列化，互相阻塞

新架构（JSI）：
  - 两套独立的入口
  - 功能：TurboModule（可同步）
  - 渲染：Fabric UIManager（可同步操作 Shadow Tree）
  - 互不阻塞
```


---

## 附录：J2V8 + V8 安装与使用

### 什么是 J2V8

**J2V8 = V8 引擎的 Java 封装层**。让 Java/Android 代码可以直接操作 V8（Google 的 JS 引擎），不需要自己写 JNI。

```
层次关系：
  Java 代码 → J2V8 API → JNI → V8 C++ API → V8 引擎
```

### 引入方式（Android Gradle）

```groovy
// build.gradle
dependencies {
    // J2V8 包含了预编译的 V8 引擎 SO 库，不需要单独安装 V8
    implementation 'com.eclipsesource.j2v8:j2v8:6.2.1@aar'
}
```

> **注意**：J2V8 的 AAR 已经内置了对应平台的 `libj2v8.so`（包含 V8 引擎），所以引入 J2V8 = 同时引入了 V8。不需要单独编译 V8。

### 基本使用

```java
// ─── Android (Java) ───
import com.eclipsesource.v8.*;

// 1. 创建 V8 运行时（= 创建一个 JS 引擎实例）
V8 v8 = V8.createV8Runtime();

// 2. 执行 JS 代码
int result = v8.executeIntegerScript("1 + 2");  // → 3

// 3. 注册 Java 方法为 JS 全局函数（= external function 注入）
v8.registerJavaMethod((receiver, args) -> {
    String name = args.getString(0);
    return "Hello, " + name;
}, "greet");

// JS 中可以直接调用：greet("World") → "Hello, World"
v8.executeScript("greet('World')");

// 4. 创建 JS 对象并注册方法
V8Object device = new V8Object(v8);
device.registerJavaMethod(new DeviceModule(), "getInfo", "getInfo", new Class[]{});
v8.add("device", device);  // global.device.getInfo() 可调用

// 5. 释放资源（V8 不自动 GC Java 对象）
device.close();
v8.release();
```

### 与快应用框架的关系

```
快应用框架启动流程：
  App 启动
    → 创建 V8 运行时（J2V8）
    → 注册所有 Native Module（device / router / storage ...）
    → 加载并执行快应用 JS Bundle
    → JS 通过注册的方法调用 Native 能力
```

### 为什么快应用用 J2V8 而不是 WebView

| | J2V8（直接持有引擎） | WebView（引擎被封装） |
|--|---------------------|---------------------|
| 控制力 | 完全控制 V8 实例 | 只能通过 WebView API 间接操作 |
| 性能 | 零序列化，同步调用 | JSON 序列化，iOS 异步 |
| UI 渲染 | 自研渲染引擎（非 DOM） | DOM + CSS（浏览器渲染） |
| 包体开销 | V8 SO ~10MB | 系统 WebView（无额外开销） |
| 适用 | 框架级（快应用/小程序引擎） | 业务级（内嵌 H5 页面） |
