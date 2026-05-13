# JS-Native 通信机制

> JS 和 Native 之间的"翻译官"是怎么工作的？

## 目录

- [一、核心问题](#一核心问题)
- [二、为什么需要 Bridge](#二为什么需要-bridge)
- [三、通信方案演进](#三通信方案演进)
- [四、快应用的 JSI 实现](#四快应用的-jsi-实现)
- [五、线程模型](#五线程模型)
- [六、性能瓶颈与优化](#六性能瓶颈与优化)
- [七、Android 知识映射](#七android-知识映射)

---

## 一、核心问题

| 问题 | 本质 |
|------|------|
| JS 怎么调用 Native 方法？ | 两个类型系统之间的映射 |
| 为什么不能直接传函数？ | 闭包无法跨语言序列化 |
| 同步还是异步？ | 取决于是否阻塞 JS 线程 |
| 性能瓶颈在哪？ | 序列化开销 + 线程切换 |

## 二、为什么需要 Bridge

**第一性原理**：JS 和 Java 是两个完全独立的运行时，它们的类型系统不兼容。

```
JS 世界（V8 引擎内）          Java 世界（JVM 内）
─────────────────            ─────────────────
Object → 原型链继承           Object → 类继承
function → 一等公民/闭包      Method → 反射调用
undefined/null               null
Number（64位浮点）            int/long/float/double
String（UTF-16）             String（UTF-16，但内存布局不同）
```

Bridge 的本质工作：**类型转换 + 调用路由 + 生命周期管理**。

## 三、通信方案演进

| 代际 | 方案 | 原理 | 性能 |
|------|------|------|------|
| 第一代 | URL Schema | JS 发 iframe 请求，Native 拦截 | 差（URL 编解码、异步） |
| 第二代 | JavascriptInterface | WebView 注入 Java 对象 | 中（依赖 WebView） |
| 第三代 | JSI/J2V8 | 引擎 API 直接注册函数 | 好（同步、零拷贝可能） |

**快应用用第三代**：通过 J2V8 库，将 Java 方法直接注册为 V8 全局函数。JS 调用时不经过任何中间层，直接触发 Java 代码执行。

## 四、快应用的 JSI 实现

### 双通道设计

```
通道 1：Feature 调用（系统 API）
  JS: global.JsBridge.invoke("system.device", "getInfo", params, cbId)
  → Java: ExtensionManager.invoke()

通道 2：渲染操作（DOM 变更）
  JS: global.callNative(pageId, actionsJson)
  → Java: RenderActionManager.callNative()
```

**为什么分两个通道？**
- Feature 调用需要返回值（同步模式）或回调（异步模式）
- 渲染操作是单向的（JS → Native），不需要返回值
- 分开后可以独立优化（渲染通道可以批量处理）

### 回调 ID 机制

```
JS 侧：
  _callbacks[42] = function(result) { ... }
  JsBridge.invoke("device", "getInfo", "{}", "42")

Native 侧：
  // 执行完成后
  response = { callback: "42", data: { brand: "Xiaomi" } }
  jsThread.postExecuteFunction("execInvokeCallback", response)

JS 侧：
  execInvokeCallback({ callback: "42", data: {...} })
  → _callbacks["42"](data)  // 找到并执行回调
```

## 五、线程模型

```
┌─────────────────────────────────┐
│  JS 线程（HandlerThread）        │
│  - V8 引擎（单线程）             │
│  - JS→Native：同步调用           │
│  - Native→JS：Handler 消息投递   │
└────────────┬────────────────────┘
             │ 同步 ↓ / 异步 ↑
┌────────────┴────────────────────┐
│  UI 线程                         │
│  - View 创建/更新                │
│  - 事件采集 → postFireEvent      │
└────────────┬────────────────────┘
             │
┌────────────┴────────────────────┐
│  IO 线程池                       │
│  - 异步 Feature 执行             │
│  - RenderWorker（JSON 解析）     │
│  - 完成后 → postExecuteFunction  │
└─────────────────────────────────┘
```

**关键约束**：V8 是单线程的。所有 JS 执行必须在 JS 线程上。Native→JS 的回调必须通过 Handler 投递到 JS 线程。

## 六、性能瓶颈与优化

| 瓶颈 | 原因 | 优化手段 |
|------|------|---------|
| JSON 序列化 | 渲染 Action 需要 stringify/parse | 批量发送（50 条阈值） |
| 线程切换 | Native→JS 需要 Handler 投递 | 同步模式（SYNC Feature） |
| V8 启动慢 | 引擎初始化 + infras.js 解析 | V8 Snapshot（预编译字节码） |
| 大数据传输 | 图片/文件等二进制数据 | SharedMemory / 文件路径传递 |

## 七、Android 知识映射

| 框架概念 | Android 知识点 |
|----------|---------------|
| J2V8 绑定 | JNI（Java Native Interface） |
| JS 线程 | HandlerThread + Looper + MessageQueue |
| 异步回调 | Handler.post() / Executors 线程池 |
| 同步调用 | 直接方法调用（同一线程内） |
| V8 Snapshot | 类比 Android 的 AOT 编译（dex2oat） |

---

## 待深入（后续填充）

- [ ] J2V8 的 JNI 层实现细节
- [ ] V8 Snapshot 的生成和加载流程
- [ ] 与 React Native JSI / Hermes 的详细对比
- [ ] Bridge 性能 benchmark（序列化耗时、调用频率）
