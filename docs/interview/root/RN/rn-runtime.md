# RN 加载与运行时

> 问题：Bundle 打好了，APK 装好了，用户点开 App 后发生了什么？

---

## 目录

- [一、全景：从点击图标到看到页面](#一全景从点击图标到看到页面)
  - [渲染指令的传递方式](#渲染指令的传递方式)
- [二、Bundle 加载过程](#二bundle-加载过程)
  - [多 Bundle 场景](#多-bundle-场景)
- [三、RN 容器初始化后做了什么](#三rn-容器初始化后做了什么)
- [四、渲染过程](#四渲染过程)
- [五、逻辑执行过程](#五逻辑执行过程)
  - [线程模型总结](#线程模型总结)
- [六、图片等静态资源怎么处理](#六图片等静态资源怎么处理)
- [七、和加载普通 JS 的区别](#七和加载普通-js-的区别)
- [线程模型对比（RN vs 快应用 vs 小程序）](#线程模型对比rn-vs-快应用-vs-小程序)
- **[Fabric 渲染模型深度解析（独立文档）](./fabric-rendering.md)**

---

## 一、全景：从点击图标到看到页面

```
用户点击 App 图标
  → Android 启动进程 → Application.onCreate()
  → 创建 ReactNativeHost（配置 Bundle 路径、注册模块）
  → 启动 MainActivity → 创建 ReactRootView
  → 加载 Bundle（.hbc 字节码）
  → Hermes 执行 Bundle → 执行 AppRegistry.registerComponent
  → React 组件树渲染 → Virtual DOM diff（纯 JS 线程中完成）
  → 渲染指令通过 Fabric（基于 JSI）传到 Native
  → Android 创建真实 View → 测量/布局/绘制
  → 用户看到页面
```

### 渲染指令的传递方式

**旧架构（Bridge）**：批量 JSON 指令，异步传递。
**新架构（Fabric + JSI）**：JS 通过 JSI 同步操作 C++ Shadow Tree，Fabric diff 后一次性 commit。

> 详细渲染模型、两次 diff 的原因、各阶段数据结构详解 → [Fabric 渲染模型深度解析](./fabric-rendering.md)

---

## 二、Bundle 加载过程

### 加载的是什么

不是 JS 源码文本，是 **Hermes 字节码（.hbc）**。已经在构建时编译好了，运行时跳过解析/编译，直接执行。

### 从哪加载

| 场景 | 路径 |
|------|------|
| 内置 Bundle | `assets/index.android.bundle`（APK 内） |
| 热更新 Bundle | 本地存储 `/data/data/包名/files/bundle/xxx.hbc` |
| 开发模式 | Metro Dev Server（`http://localhost:8081/index.bundle`） |

### 加载动作

```
ReactInstanceManager.createReactContextInBackground()
  → 确定 Bundle 路径（内置 or 热更新 or Dev Server）
  → 读取 .hbc 文件到内存
  → 创建 Hermes Runtime
  → Hermes 执行字节码（从入口函数开始）
```

### 多 Bundle 场景

```
App 启动 → 加载 common.hbc（公共依赖，必须先加载）
  → 用户跳转到某页面 → 加载对应 business.hbc
  → 创建新的 JS 执行上下文 或 在同一上下文中追加执行
```

---

## 三、RN 容器初始化后做了什么

"RN 容器" = ReactInstanceManager + Hermes Runtime + 模块注册。初始化后：

```
1. 创建 JS 线程（Hermes 运行在这个线程）
2. 注册 Native Modules / TurboModules（懒加载模式下只注册入口，不实例化）
3. 执行 Bundle 入口代码
4. 入口代码调用 AppRegistry.registerComponent('App', () => App)
5. RN 框架调用hbc中的APP 组件的 render()
6. React Reconciler 生成 Virtual DOM → diff → 产生渲染指令
7. 渲染指令通过 JSI 传给 C++ Fabric → Yoga 算布局（精确坐标/尺寸）
8. Fabric 通过 JNI 调 Java ViewManager → UI Thread 创建 Native View → 显示
```

---

## 四、渲染过程

### 本质

**React 组件树 → Virtual DOM → diff → 渲染指令 → Native View 操作**

和 React Web 的区别：Web 最终操作 DOM，RN 最终操作 Native View（Android View / iOS UIView）。

### 流程

```
JS 线程：
  组件 state/props 变化
  → React reconciler 计算 diff（哪些节点变了）
  → 生成渲染指令（createElement / updateProps / removeChild）

Fabric（C++ 层）：
  接收渲染指令
  → 更新 Shadow Tree（布局计算，Yoga Flexbox）
  → 生成 Native 操作队列

UI 线程：
  执行 Native 操作
  → 创建/更新/删除 Android View
  → 触发 measure → layout → draw
  → 像素上屏
```

### 关键认知

- **JS 线程不直接操作 View**：只产生"指令"，由 Fabric 转交 UI 线程执行
- **布局计算在 C++ 层**：Yoga 引擎（Flexbox），不在 JS 也不在 Java
- **新架构（Fabric）可以同步渲染**：某些场景不需要等下一帧

---

## 五、逻辑执行过程

### JS 业务逻辑在哪跑

全部在 **JS 线程**（Hermes）。包括：
- 组件生命周期（useEffect/useState）
- 事件处理（onPress/onChange）
- 网络请求（fetch/axios）
- 状态管理（Zustand/Redux）

### 和 Native 的交互

- JS 调 Native：TurboModule 方法调用（通过 JSI → JNI → Java）
- Native 回 JS：EventEmitter 事件（Native 直接调 JS 函数引用）

### 线程模型总结

| 线程 | 跑什么 |
|------|--------|
| JS Thread（Hermes） | 业务逻辑、React 渲染计算、事件处理 |
| UI Thread（Main） | Native View 操作、手势事件分发、动画（worklet） |
| Background Thread | 网络请求、文件 IO、TurboModule 异步操作 |

### Android 线程底层实现

**RN 的 JS 线程本质是一个 `HandlerThread`**（带 Looper 消息循环的常驻线程）：

```java
// 创建常驻线程（RN 内部实现）
HandlerThread jsThread = new HandlerThread("mqt_js");
jsThread.start();  // Looper.loop() 死循环 → 线程永远不退出

// 往 JS 线程投递任务
Handler jsHandler = new Handler(jsThread.getLooper());
jsHandler.post(() -> hermesRuntime.evaluateScript(bundle));
jsHandler.post(() -> hermesRuntime.callFunction("onPress", args));
```

**为什么线程能常驻？**

```java
// HandlerThread.run() 源码本质：
public void run() {
    Looper.prepare();
    Looper.loop();  // 死循环：不断从 MessageQueue 取消息执行，没消息就阻塞等待
    // 永远不会到这里，除非调用 quit()
}
```

**销毁：**

```java
// ReactInstance 销毁时
jsThread.quitSafely();  // Looper 退出循环 → run() 返回 → 线程死亡
```

**跨线程拿返回值：**

Handler.post() 本身没有返回值机制，RN 中用这几种方式：

```java
// 方式 1：回调 — 执行完后 post 回调用方线程（RN 最常用）
jsHandler.post(() -> {
    String result = doWork();
    mainHandler.post(() -> updateUI(result));  // 结果 post 回主线程
});

// 方式 2：JSI 同步调用 — 新架构直接返回（不跨线程，同一调用栈）
// JS → JSI → C++ 方法直接 return → JS 立刻拿到值

// 方式 3：Future — 阻塞等待（别在主线程用）
Future<String> future = pool.submit(() -> doWork());
String result = future.get();  // 阻塞直到完成
```

| 方式 | 创建 | 常驻 | 销毁 | RN 中使用 |
|---|---|---|---|---|
| `new Thread()` | `thread.start()` | ❌ run 完就死 | 自动 | 不用 |
| `HandlerThread` | `ht.start()` | ✅ Looper 循环 | `quit()` / `quitSafely()` | JS 线程、NativeModules 线程 |
| 线程池 | `Executors.newXxx()` | ✅ 核心线程常驻 | `shutdown()` | 网络、图片加载 |

---

## 六、图片等静态资源怎么处理

### 本地图片（打入 APK）

```jsx
<Image source={require('./icon.png')} />
```

- Metro 构建时：图片文件 copy 到 `android/app/src/main/res/drawable-xxx/`（按分辨率）
- 运行时：RN 通过资源 ID 加载（和原生加载图片一样）
- 不走 Bundle，走 Android 资源系统

### 网络图片

```jsx
<Image source={{ uri: 'https://xxx.com/photo.jpg' }} />
```

- 运行时下载 → 缓存 → 渲染
- 推荐用 FastImage（原生缓存，避免重复下载和闪烁）

### 字体

- 放在 `assets/fonts/` 目录
- `react-native.config.js` 配置 assets 路径
- 构建时 copy 到原生资源目录

### 和 JS Bundle 的关系

**图片不在 Bundle 里**。Bundle 只包含 JS 代码。图片走原生资源系统（Android res/ 或 assets/）。`require('./icon.png')` 在 Bundle 里只是一个资源 ID 引用。

---

## 七、和加载普通 JS 的区别

| 维度 | 浏览器加载 JS | RN 加载 Bundle |
|------|-------------|---------------|
| 加载的是什么 | JS 源码文本 | Hermes 字节码（.hbc） |
| 解析 | 浏览器 V8 解析 + 编译 | 跳过（已预编译） |
| 执行环境 | 浏览器全局（window/document） | Hermes Runtime（无 DOM/BOM） |
| 渲染目标 | DOM | Native View |
| 模块系统 | ESM / script 标签 | Metro 打包的 CommonJS（单文件） |
| 多文件 | 多个 script / 动态 import | 单 Bundle 或多 Bundle（手动加载） |

**本质区别**：浏览器加载 JS 后操作 DOM 渲染像素；RN 加载 Bundle 后通过 Fabric 操作 Native View 渲染像素。中间多了一层"JS → Native View"的映射。


---

## 线程模型对比（RN vs 快应用 vs 小程序）

### RN 线程模型

```
JS Thread（Hermes，一个）：
  - 业务逻辑 / React 渲染（Virtual DOM diff）/ 事件处理 / 状态管理
  - 产出渲染指令

UI Thread（Main Thread，一个）：
  - 执行渲染指令（创建/更新 Native View）
  - 布局计算（Yoga）/ 绘制 / 手势识别 / 动画（worklet）

Native Module 执行：
  - 旧架构：NativeModules Thread（一个固定线程，排队执行）
  - 新架构：由 TurboModule 自己决定线程（线程池/协程）

通信：JS → JSI（C++）→ Fabric → UI Thread
```

### 快应用线程模型

```
JS Thread（V8，一个）：
  - 业务逻辑 / 虚拟 DOM diff / 产出渲染指令

IO Thread Pool（多个）：
  - 解析渲染指令 JSON / 异步 Feature 执行（网络/文件）/ 图片解码

UI Thread（主线程，一个）：
  - 创建/更新 Android View / 事件采集 / 动画执行

通信：JS → J2V8 同步调用 → IO Thread 解析 → Handler post → UI Thread 渲染
```

### 小程序线程模型（微信）

```
逻辑层（JS Thread）：
  - 业务逻辑 / setData / 事件处理
  - 运行在独立的 JSCore/V8 中

渲染层（WebView Thread，每个页面一个）：
  - WXML 模板渲染 / WXSS 样式 / DOM 操作
  - 运行在 WebView 中

通信：逻辑层 → setData（JSON 序列化）→ Native 中转 → 渲染层
```

### 对比

| 维度 | RN | 快应用 | 小程序 |
|------|-----|--------|--------|
| JS 线程 | 1 个（Hermes） | 1 个（V8） | 1 个（JSCore/V8） |
| 渲染 | Native View（UI Thread） | Native View（UI Thread） | WebView（每页一个） |
| 中间层 | JSI（C++ 直调） | J2V8（同步 Bridge） | Native 中转（JSON 序列化） |
| 通信开销 | μs 级（JSI） | 低（同步调用） | 高（序列化 + 跨进程） |
| 渲染性能 | 原生级 | 原生级 | WebView 级（较弱） |
| 动画 | worklet 在 UI Thread | UI Thread 执行 | CSS 动画（渲染层） |

### 共同本质

三者都是**双线程/多线程模型**：JS 逻辑和 UI 渲染分离。

```
为什么要分离？
  → JS 执行不阻塞 UI 渲染（JS 卡了界面不冻结）
  → UI 渲染不阻塞 JS 执行（动画播放时 JS 可以继续算）

代价：
  → 需要跨线程通信（有开销）
  → 通信方案决定了性能上限（Bridge < J2V8 < JSI）
```
