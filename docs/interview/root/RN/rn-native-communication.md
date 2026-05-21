# RN ↔ Native 通信

> 场景：IoT App，Android 同学写 BLE 底层，我负责 RN ↔ Android 桥接层设计
> 核心问题：JS 和 Native 是两个运行时，怎么互相调用？

---

## 目录

- [一、通道演进](#一通道演进)
- [二、JSI 关键特性](#二jsi-关键特性)
- [三、Host Object 是什么](#三host-object-是什么)
- [四、桥接层怎么做](#四桥接层怎么做)
- [五、通信方向设计决策](#五通信方向设计决策)
- [六、BLE 高频数据流，新架构收益](#六ble-高频数据流新架构收益)
- [七、BLE 关键节点（5 步）](#七ble-关键节点5-步)
- [八、降维优势](#八降维优势)
- [九、TurboModule vs 旧 Native Module：本质关系](#九turbomodule-vs-旧-native-module本质关系)

---

## 一、通道演进

| 方案 | 本质 | 性能 |
|------|------|------|
| 旧 Bridge | 异步消息队列 + JSON 序列化 | 慢（序列化+排队+单通道阻塞） |
| 新 JSI | JS 直接持有 Native 对象引用（Host Object） | 快（无序列化、同步可选） |
| J2V8（我做的） | Java 直接绑定 V8 引擎 | 快（同思路，Java 层实现） |

**JSI 核心思想**：去掉"翻译官"，让 JS 直接调 Native。

---

## 二、JSI 关键特性

- **引擎无关**：定义抽象接口 `jsi::Runtime`，Hermes/V8/JSC 都能接入
- **同步调用**：不再强制异步
- **无序列化**：直接传引用（可传 ArrayBuffer 二进制）
- **双工**：JS→Native 直调方法，Native→JS 直调 JS 函数引用
- **RN 0.76+ 默认开启**

---

## 三、TurboModule 本质

不是新的"模块格式"，是新的"通信通道 + 加载策略 + 类型约束"。

| 维度 | 旧 Native Module | TurboModule |
|------|-----------------|-------------|
| 通信 | Bridge（异步JSON） | JSI（同步直调） |
| 加载 | 启动全量注册 | 懒加载 |
| 类型 | 无约束 | TS Spec + Codegen |
| 同步方法 | 不支持 | 支持 |

---

## 四、桥接层怎么做

场景：Android 同学给了 `BLEManager` 类（Java），有 scan/connect/write 等方法。我要让 JS 能调到它。

### Step 1：定义接口契约（TS Spec）

用 `TurboModule` 接口声明"JS 侧能调什么"。这个文件是给 Codegen 看的，它会据此生成 C++/JNI 胶水 + Kotlin 抽象类。

**约定**：
- 文件名必须 `Native` 开头（如 `NativeBLE.ts`）
- 接口名必须叫 `Spec`（Codegen 按这个名字识别）
- 放在 `package.json` 的 `codegenConfig.jsSrcsDir` 指定的目录下
- 一般放 `src/native-modules/`

```
interface Spec extends TurboModule {
  connect(deviceId): Promise<void>   // 异步，等连接结果
  disconnect(deviceId): void          // 同步，立即断开
  write(deviceId, data): Promise<void>
}
```

**作用**：这是两个世界的契约。JS 侧按这个调，Android 侧按这个实现，Codegen 保证两边类型一致。

### Step 2：跑 Codegen

`./gradlew generateCodegenArtifactsFromSchema`

**作用**：读取 Step1 的 Spec，自动生成：
- 一个 Kotlin 抽象类 `NativeBLESpec`（你要继承它）
- C++ 胶水代码（JSI 绑定 + JNI 调用，你不用管）

### Step 3：实现 TurboModule（Kotlin）

继承 Codegen 生成的 `NativeBLESpec`，实现每个方法。内部就是调 Android 同学的 `BLEManager`：

```
class BLEModule : NativeBLESpec(reactContext) {
  
  override fun connect(deviceId, promise) {
    // 调 Android 同学的 API
    bleManager.connect(deviceId, onSuccess = {
      promise.resolve(null)   // 告诉 JS "成功了"
    }, onError = { err ->
      promise.reject("BLE_ERROR", err.message)  // 告诉 JS "失败了"
    })
  }
}
```

**关键**：`promise.resolve()` / `promise.reject()` 是你和 JS 侧通信的出口。

### Step 4：被动事件怎么发给 JS

设备主动上报数据时，不是 JS 调你，是你主动推给 JS：

```
// Native 侧，收到设备数据时
reactContext.emitter.emit("BLE_DATA", { deviceId, data })
```

**作用**：JS 侧通过 `NativeEventEmitter.addListener("BLE_DATA", callback)` 收到。

### Step 5：JS 侧封装 Hook 给业务用

```
function useBLE() {
  // 主动操作：直接调 TurboModule 方法
  const connect = (id) => NativeBLE.connect(id)
  
  // 被动监听：订阅 Native 事件
  useEffect(() => {
    const sub = emitter.addListener("BLE_DATA", handleData)
    return () => sub.remove()
  }, [])
}
```

**作用**：业务组件只需要 `useBLE()`，不需要知道底层是 TurboModule 还是 EventEmitter。

---

## 五、通信方向设计决策

| 方向 | 方式 | 场景 |
|------|------|------|
| JS → Native | TurboModule 方法（Promise） | 主动操作：scan/connect/write/read |
| Native → JS | EventEmitter 事件 | 被动通知：设备发现/状态变化/数据接收 |
| 纯 Native | 不经过 JS | 重连策略/心跳（后台也要工作） |

**为什么被动用事件不用 Promise？** BLE 是持续状态流（多次触发、时机不确定），不是一次性请求。

### 事件通信的实现本质

事件不经过 Codegen，走的是 JSI 直调（新架构下）：

```
初始化时：
  JS: emitter.addListener("BLE_DATA", callback)
    → callback 函数引用被传到 C++ 层保存

事件发生时：
  Java: emit("BLE_DATA", data)
    → JNI → C++ 层
    → C++ 拿到之前保存的 JS callback 引用
    → 在 JS Thread 上直接调用这个引用
    → JS callback 执行
```

**本质**：C++ 层是中间人——被 Java 通过 JNI 调用，同时持有 JS 函数引用能直接调 JS。不需要序列化队列。

**和 TurboModule 的区别**：
- TurboModule 方法（JS→Native）：Codegen 生成胶水，类型安全
- EventEmitter 事件（Native→JS）：无 Codegen，字符串约定，C++ 直调 JS 函数引用

---

## 六、BLE 高频数据流，新架构收益

场景：10 设备 × 10 次/秒 = 100 次/秒 Native→JS

| 维度 | 旧架构 | 新架构 |
|------|--------|--------|
| 每次通信 | JSON 序列化 + 队列 | 直接调 JS 函数引用 |
| 延迟 | ~10ms | <1ms |
| 大数据 | Base64 编码 | 直传 ArrayBuffer |
| 副作用 | Bridge 阻塞影响全局（动画卡） | 不影响其他模块 |

---

## 七、BLE 关键节点（5 步）

```
1. 扫描 → 事件流（持续发现设备）
2. 连接 → Promise（一次性）+ 事件（后续状态变化）
3. 写入 → Promise（一次性操作）
4. 接收数据 → 事件流（高频，JSI 收益最大）
5. 断连重连 → Native 侧自动处理（指数退避），通过事件通知 JS
```

---

## 八、我的降维优势

- 快应用框架的 J2V8 同步 Bridge = JSI 同思路，我做过"从零设计通信层"
- 不只是"会用 TurboModule"，而是理解"为什么这样设计"
- 能定义 Android 同学和 JS 同学的协作接口，两边都能打

---

## 九、TurboModule vs 旧 Native Module：本质关系

### 不是"替代模块"，是"替代通信方式"

- 旧 Native Module = 平台代码（Java/Swift）+ 旧通信（Bridge）
- TurboModule = 平台代码（Java/Swift）+ 新通信（JSI）

平台代码永远要写（调蓝牙、调相机必须走系统 API），变的只是"怎么和 JS 连通"。

### TurboModule 三种形态

1. **有平台代码**（最常见）：内部调 Android/iOS API（BLE/相机/文件）
2. **纯 C++ TurboModule**：纯计算逻辑（加密/解析），一份代码双平台复用
3. **混合**：核心逻辑 C++ 跨平台，部分功能调平台 API

### 旧模块在新架构下的行为

| 写法 | 通信路径 | 在 0.76+ 新架构下 |
|------|---------|-------------------|
| 旧 `@ReactMethod` | Bridge（异步JSON） | 仍走旧路径（兼容层），不会自动升级 |
| 新 TurboModule | JSI（同步直调） | 走新路径，享受全部收益 |

**不改代码就不升级**。旧模块一直走旧 Bridge，只有重写成 TurboModule 才走 JSI。

### 迁移策略（架构师规划）

- 高频调用模块优先迁移（BLE 数据流、动画驱动）→ 收益最大
- 低频模块暂时不动（设置页、关于页）→ 兼容层跑着没问题
- 新模块一律用 TurboModule → 不欠新的技术债
- 每个模块迁移后做性能对比验证（通信延迟、启动时间）

### TurboModule 收益总结

1. **启动快**：懒加载（首次调用才加载），旧模块启动时全量注册
2. **通信快**：JSI 直调（<1ms），旧模块 Bridge 异步（~10ms）
3. **类型安全**：TS Spec + Codegen 编译时检查，旧模块运行时才崩
4. **同步方法**：支持同步返回，旧模块强制异步

---

## 十、JS 引擎对 JS 世界的操作能力

从 C++ 侧（JSI/J2V8）能对 JS 世界做什么：

| 操作 | 做什么 | 类比 JS 代码 |
|------|--------|-------------|
| 执行代码 | 执行一段 JS 字符串/字节码 | `eval("...")` |
| 读全局变量 | 获取 JS 全局对象上的值 | `globalThis.xxx` |
| 写全局变量 | 往 JS 全局挂东西 | `globalThis.NativeBLE = {...}` |
| 创建对象 | 在 JS 堆上创建对象/数组 | `{}` / `[]` |
| 读写属性 | 获取/设置对象的属性 | `obj.key` / `obj.key = value` |
| 调用函数 | 调用一个 JS 函数 | `callback(args)` |
| 注册 Host 函数 | 注册"假 JS 函数"（实际执行 C++/Java） | JS 做不到 |
| 获取函数引用 | 拿到 JS 函数引用，后续可调用 | 保存 callback |

**一句话**：C++ 侧对 JS 世界有"上帝视角"——能创建/读/写/调用任何东西，还能注入 JS 里不存在的能力。这就是 JSI 双向通信的基础。

### V8 / J2V8 核心 API 对照

| 操作 | V8 C++ API | J2V8 Java API | 干什么 |
|------|-----------|---------------|--------|
| 创建运行环境 | `v8::Isolate::New()` + `v8::Context::New()` | `V8.createV8Runtime()` | 创建一个完整的 JS 执行环境 |
| 执行 JS 代码 | `v8::Script::Compile()` + `Run()` | `runtime.executeScript(code)` | 跑一段 JS |
| 往全局挂对象 | `context->Global()->Set(key, obj)` | `runtime.add("NativeBLE", bridge)` | 让 JS 能访问到这个对象 |
| 创建 JS 对象 | `v8::Object::New(isolate)` | `new V8Object(runtime)` | 在 JS 堆上创建对象 |
| 设置属性 | `obj->Set(context, key, value)` | `v8Obj.add(key, value)` | 给对象加属性 |
| 注册 Host 函数 | `v8::FunctionTemplate::New(isolate, cppCallback)` | `v8Obj.registerJavaMethod(instance, method, jsName, types)` | 让 JS 调用时执行 C++/Java 代码 |
| 调用 JS 函数 | `jsFunc->Call(context, receiver, argc, argv)` | `v8Function.call(receiver, args)` | 从 Native 侧主动调 JS 函数 |
| 读属性 | `obj->Get(context, key)` | `v8Obj.get(key)` | 读 JS 对象的属性值 |
| 释放引用 | Handle scope 自动管理 | `v8Obj.close()` | 告诉 GC 这个引用不用了 |
| 销毁环境 | `isolate->Dispose()` | `runtime.release()` | 销毁整个 JS 运行环境 |
