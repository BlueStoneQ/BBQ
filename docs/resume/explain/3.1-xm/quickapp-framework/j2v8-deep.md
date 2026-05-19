# V8 与 J2V8 核心概念

> 问题：怎么让 Java 和 JS 互相调用？V8 提供了什么，J2V8 封装了什么？

---

## 目录

- [一、V8 核心概念](#一v8-核心概念)
- [二、J2V8 核心对象与方法](#二j2v8-核心对象与方法)
- [三、注册 Java 方法给 JS 调用](#三注册-java-方法给-js-调用)
- [四、从 Java 回调 JS](#四从-java-回调-js)
- [五、线程模型](#五线程模型)
- [六、内存管理（坑）](#六内存管理坑)
- [七、和 JSI 的实现层面对比](#七和-jsi-的实现层面对比)

---

## 一、V8 核心概念

V8 是 Google 的 JS 引擎（Chrome/Node.js 用的）。核心概念：

| 概念 | 本质 | 类比 |
|------|------|------|
| **Isolate** | 一个独立的 V8 实例（有自己的堆和 GC） | 一个独立的 JS 虚拟机 |
| **Context** | 执行上下文（全局对象/内置函数） | 一个独立的 `window` |
| **Handle** | 指向 V8 堆中对象的引用 | Java 的引用变量 |
| **Host Object** | 宿主（C++/Java）注册到 JS 全局的对象 | `document`/`console` |

**关系**：一个 Isolate 可以有多个 Context，每个 Context 有自己的全局对象。

---

## 二、J2V8 核心对象与方法

J2V8 把 V8 的 C++ API 封装成 Java 类：

### V8（Runtime）

| 方法 | 动作本质 |
|------|---------|
| `V8.createV8Runtime()` | 创建一个 V8 Isolate + Context（一个完整的 JS 运行环境） |
| `runtime.executeScript(jsCode)` | 在这个环境里执行一段 JS 代码 |
| `runtime.add(name, object)` | 把一个 Java 对象挂到 JS 全局（注册 Host Object） |
| `runtime.getObject(name)` | 从 JS 全局取一个对象到 Java 侧 |
| `runtime.release()` | 销毁 V8 实例，释放内存 |

### V8Object

| 方法 | 动作本质 |
|------|---------|
| `new V8Object(runtime)` | 在 V8 堆上创建一个 JS 对象 |
| `obj.add(key, value)` | 给这个 JS 对象设置属性 |
| `obj.registerJavaMethod(instance, javaMethod, jsName, paramTypes)` | 把一个 Java 方法绑定为这个对象的 JS 方法 |
| `obj.get(key)` | 读取 JS 对象的属性值到 Java |
| `obj.close()` | 释放这个对象的 V8 引用（防内存泄漏） |

### V8Array

| 方法 | 动作本质 |
|------|---------|
| `new V8Array(runtime)` | 创建一个 JS 数组 |
| `arr.push(value)` | 往数组里加元素 |
| `arr.get(index)` | 取数组元素 |
| `arr.close()` | 释放引用 |

### V8Function

| 方法 | 动作本质 |
|------|---------|
| `func.call(receiver, args)` | 调用一个 JS 函数（从 Java 侧触发） |
| `func.close()` | 释放引用 |

---

## 三、注册 Java 方法给 JS 调用

**动作**：让 JS 代码能调用 Java 方法。

```
// 步骤：
1. 创建 V8Object（作为 JS 侧的"桥接对象"）
2. registerJavaMethod 把 Java 方法绑定上去
3. 把这个对象挂到 JS 全局

// 效果：
JS: NativeBLE.connect("deviceId")
  → V8 引擎发现 connect 是注册的 Java 方法
  → 通过 JNI 调用 Java 的 connect(String deviceId)
  → 同步返回结果给 JS
```

**registerJavaMethod 参数**：
- `instance`：Java 对象实例（方法属于谁）
- `javaMethod`：Java 方法名（字符串）
- `jsName`：JS 侧看到的方法名
- `paramTypes`：参数类型数组（用于 JNI 反射调用）

---

## 四、从 Java 回调 JS

**动作**：Java 侧主动调用 JS 函数（比如 BLE 数据到达时通知 JS）。

```
// 步骤：
1. JS 侧传一个 callback 函数给 Java（通过方法参数）
2. Java 侧持有这个 V8Function 引用
3. 需要回调时，在 V8 所在线程上调用 func.call(null, args)

// 关键约束：
- 必须在 V8 Runtime 所在线程上调用（不能跨线程）
- 如果在其他线程，需要 post 到 V8 线程再调
```

---

## 五、线程模型

**核心规则：V8 Runtime 绑定创建它的线程，所有操作必须在该线程上执行。**

```
JS Thread（V8 Runtime 所在线程）
  ├── JS 代码执行
  ├── JS 调 Java（registerJavaMethod 的回调在这里执行）
  └── Java 回调 JS（V8Function.call 必须在这里）

UI Thread（Android 主线程）
  └── View 操作必须在这里

如果 Java 方法需要操作 UI：
  JS Thread 上收到调用 → post 到 UI Thread 操作 View → 结果 post 回 JS Thread 回调 JS
```

**不会直接阻塞 UI Thread**：因为 V8 在 JS Thread 上，不在 UI Thread。但如果 Java 方法在 JS Thread 上做了耗时操作 → JS Thread 被阻塞 → JS 无法产生新的渲染指令 → 间接导致 UI 不更新。

---

## 六、内存管理（坑）

**V8 对象有自己的 GC，Java 对象也有 GC，两者独立。J2V8 创建的对象横跨两个 GC 系统。**

**规则**：所有 `V8Object` / `V8Array` / `V8Function` 用完必须手动 `close()`。

```
// ❌ 内存泄漏
V8Object obj = new V8Object(runtime);
obj.add("key", "value");
// 忘了 close → V8 堆上的对象永远不会被回收

// ✅ 正确
V8Object obj = new V8Object(runtime);
try {
    obj.add("key", "value");
    // 使用...
} finally {
    obj.close();  // 释放 V8 引用
}
```

**为什么 Java GC 不能自动回收？** 因为 V8Object 在 Java 堆上只是一个"引用句柄"（几十字节），真正的数据在 V8 堆上。Java GC 回收了句柄，但 V8 堆上的数据不知道该释放了 → 泄漏。

---

## 七、和 JSI 的实现层面对比

| 维度 | J2V8 | JSI |
|------|------|-----|
| 注册方法 | `registerJavaMethod` | 实现 `HostObject::get` 返回函数 |
| 调用路径 | JS → V8 JNI → Java | JS → C++ HostObject → JNI → Java |
| 线程约束 | 绑定单线程 | 绑定单线程 |
| 内存管理 | 手动 close() | C++ 智能指针 / shared_ptr |
| 引擎绑定 | 绑定 V8 | 引擎无关（抽象接口） |
| 性能 | 略慢（Java 层多一次 JNI） | 更快（纯 C++） |
| 开发效率 | 高（Java 生态） | 低（需要写 C++） |

**本质相同**：都是"让 JS 能同步调用宿主方法"。区别在于 J2V8 在 Java 层做，JSI 在 C++ 层做。

---

## 八、J2V8 的物理形态

**J2V8 是一个 AAR，自带 V8 的 .so。Android/iOS 系统不集成 V8。**

```
j2v8.aar 内部：
├── classes.jar         ← Java API（V8/V8Object/V8Function）
└── jni/
    ├── arm64-v8a/libj2v8.so   ← V8 引擎 + JNI 胶水（编译在一起）
    └── armeabi-v7a/libj2v8.so
```

**为什么系统不自带 V8**：
- Android WebView 里有 V8，但不对外暴露 API，App 不能直接用
- iOS 自带 JSC，没有 V8
- 要用 V8 就得自己带（打入 APK），增加 ~7MB 包体

**本质链路**：
```
V8 引擎 → 只暴露 C/C++ API
Java 不能直接调 C++ → 需要 JNI
J2V8 = V8 的 C++ API 通过 JNI 封装成 Java API
```

J2V8 不是新技术，就是一层 JNI 封装。类比：JDBC 之于数据库 = J2V8 之于 V8。
