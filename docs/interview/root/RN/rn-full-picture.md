# RN 全景：从目录结构到运行时

> 一条线理解 RN：项目结构 → Android 壳 → 构建产物 → 启动入口 → 运行时渲染 → JS 调 Native

---

## 目录

- [一、RN 项目目录结构](#一rn-项目目录结构)
- [二、Android 壳的目录结构](#二android-壳的目录结构)
- [三、构建结果](#三构建结果)
- [四、Android 启动入口与核心代码](#四android-启动入口与核心代码)
- [五、运行时：渲染过程](#五运行时渲染过程)
- [六、运行时：JS 调 Native（BLE 示例）](#六运行时js-调-nativeble-示例)

---

## 一、RN 项目目录结构

```
my-app/
├── android/          ← Android 壳工程（见下一节）
├── ios/              ← iOS 壳工程
├── src/              ← JS/TS 业务代码
│   ├── screens/      ← 页面
│   ├── components/   ← 通用组件
│   ├── navigation/   ← 路由
│   ├── services/     ← 网络/API
│   ├── stores/       ← 状态管理
│   ├── hooks/        ← 自定义 Hooks
│   └── native-modules/ ← TurboModule Spec 定义
├── index.js          ← 入口（AppRegistry.registerComponent）
├── metro.config.js   ← Metro 打包器配置
├── babel.config.js   ← Babel 转换配置
├── tsconfig.json     ← TypeScript 配置
└── package.json      ← 依赖 + RN 配置
```

**模块划分本质**：
- `src/` = 纯 JS/TS，跨平台业务逻辑 + UI
- `android/` `ios/` = 平台壳，提供 Native 能力 + 启动入口
- `native-modules/` = 两个世界的接口契约（TS Spec）

---

## 二、Android 壳的目录结构

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/myapp/
│   │   │   ├── MainApplication.kt    ← App 入口：初始化 RN 运行时
│   │   │   ├── MainActivity.kt       ← 主 Activity：承载 RN 页面
│   │   │   └── modules/              ← TurboModule 实现（BLE 等）
│   │   │       └── BLEModule.kt
│   │   ├── res/                       ← Android 资源（图标/启动屏）
│   │   ├── assets/                    ← JS Bundle 存放位置（Release）
│   │   │   └── index.android.bundle   ← 或 .hbc
│   │   └── AndroidManifest.xml        ← 权限/组件声明
│   └── build.gradle                   ← App 级构建配置（依赖/签名/R8）
├── build.gradle                       ← 项目级配置
├── settings.gradle                    ← 模块声明 + Autolinking 脚本
└── gradle.properties                  ← RN 新架构开关等
```

**每个文件的职责**：

| 文件 | 干什么 |
|------|--------|
| `MainApplication.kt` | 初始化 ReactNativeHost（配置 Bundle 路径、注册模块、开启新架构） |
| `MainActivity.kt` | 继承 ReactActivity，是 RN 页面的容器 |
| `BLEModule.kt` | TurboModule 实现，桥接 JS 和 Android BLE API |
| `assets/index.android.bundle` | JS Bundle（Release 时打入 APK） |
| `settings.gradle` | 包含 Autolinking 脚本（自动扫描 node_modules 注册 Native 模块） |
| `gradle.properties` | `newArchEnabled=true`（新架构开关） |

---

## 三、构建结果

```
app-release.apk 内部：
├── classes.dex           ← Java/Kotlin 编译产物（MainApplication + TurboModule + RN 框架）
├── lib/arm64-v8a/
│   ├── libhermes.so      ← Hermes JS 引擎
│   ├── libjsi.so         ← JSI 层
│   ├── libreactnative.so ← RN 框架 Native 部分
│   └── libturbomodule.so ← TurboModule 基础设施
├── assets/
│   └── index.android.bundle  ← JS Bundle（.hbc 字节码）
├── res/                  ← 资源（图片/布局/字符串）
├── AndroidManifest.xml
└── META-INF/             ← 签名
```

**本质**：APK = Android 壳（DEX + .so）+ JS Bundle（assets）+ 资源。两个世界打包在一起。

---

## 四、Android 启动入口与核心代码

### 启动流程

```
用户点击图标
  → Android 创建进程
  → MainApplication.onCreate()
      → 初始化 ReactNativeHost（配置 Bundle 路径、JS 引擎、模块列表）
  → MainActivity.onCreate()
      → 创建 ReactRootView（RN 渲染的容器 View）
      → 调用 startReactApplication(instanceManager, "AppName")
          → 创建 JS Thread
          → 加载 Bundle（从 assets/ 读取 .hbc）
          → Hermes 执行 Bundle
          → 执行 AppRegistry.registerComponent("AppName", () => App)
          → React 渲染 → Virtual DOM → Fabric → Native View
  → 用户看到页面
```

### MainApplication 核心动作

**本质**：Android `Application` 子类，整个 App 进程的入口，比任何 Activity 都先执行。

**承载的事情**：

| 职责 | 说明 |
|------|------|
| 配置 ReactNativeHost | 告诉 RN 用什么引擎/加载哪个 Bundle/注册哪些模块 |
| 第三方 SDK 初始化 | Firebase/Sentry/MMKV 等 |
| 全局状态持有 | Application 实例贯穿 App 生命周期 |
| 容器预热（可选） | 提前创建 ReactInstanceManager 加速首屏 |

**生命周期**：Application 是进程级的（只有一个），Activity 是页面级的（可以有多个）。

```
进程创建 → Application.onCreate()（最先执行）
  → Activity 启动 → Activity.onCreate()
  → App 被杀 → Application.onTerminate()
```

```kotlin
// 伪代码，展示核心动作
class MainApplication : Application(), ReactApplication {

    override val reactNativeHost = object : DefaultReactNativeHost(this) {
        
        // 1. 指定 Bundle 路径
        override fun getJSMainModuleName() = "index"
        override fun getBundleAssetName() = "index.android.bundle"
        
        // 2. 注册 Native 模块（Autolinking 自动生成 PackageList）
        override fun getPackages() = PackageList(this).packages
        
        // 3. 开启新架构
        override val isNewArchEnabled = true
        override val isHermesEnabled = true
    }
}
```

### MainActivity 核心动作

```kotlin
// 极简，只需要继承 ReactActivity
class MainActivity : ReactActivity() {
    override fun getMainComponentName() = "AppName"  // 对应 JS 侧 registerComponent 的名字
}
```

**本质**：MainApplication 配置"怎么启动 RN"，MainActivity 提供"RN 渲染到哪个 View 上"。

---

## 五、运行时：渲染过程

### .hbc 是什么

不是渲染指令。是 **JS 逻辑的字节码**——和 JS 源码表达同一个东西（变量/函数/条件/循环），只是换了更紧凑、更快执行的编码格式。

.hbc = "产生渲染指令的程序"，不是指令本身。

### 从 JSX 到屏幕像素的完整链路

```
你写的 JSX：
  <View style={{flex: 1}}>
    <Text>Hello</Text>
  </View>

    ↓ Hermes 执行 .hbc（跑 JS 逻辑）

JS 线程：
  React render() → 生成 React Element 树（Virtual DOM）
  Reconciler diff → "需要创建 View + Text"
  生成渲染指令：CREATE View {flex:1} / CREATE Text "Hello"

    ↓ 指令传给 Fabric（C++ 层）

C++ 层（Fabric + Yoga）：
  构建 Shadow Tree（C++ 对象树）
  Yoga 计算 Flexbox 布局（每个节点的 x/y/width/height）
  生成 Native 操作队列（带坐标和尺寸）

    ↓ 操作队列提交到 UI Thread

UI Thread（Android 主线程）：
  new FrameLayout → setLayoutParams
  new TextView → setText("Hello")
  addView → Android 系统 measure → layout → draw
  GPU 绘制 → 像素上屏
```

### 每层职责

| 层 | 做什么 | 产出 |
|---|--------|------|
| JS 线程 | 跑 React，算 diff | 渲染指令（创建/更新/删除哪些节点） |
| C++ 层（Fabric） | 管 Shadow Tree + 算布局 | Native 操作队列（带坐标尺寸） |
| UI 线程 | 执行 Native View 操作 | 真实 Android View 树 |
| Android 系统 | measure/layout/draw | 像素 |

### 关键认知

- JS Thread 不直接操作 View（只产生指令）
- 布局计算在 C++ 层（Yoga，不在 JS 也不在 Java）
- 最终 View 操作在 UI Thread
- JSI 不是传渲染指令的，是 JS 调 Native 方法的（TurboModule）
- Fabric 才是处理渲染指令的

---

## 六、运行时：JS 调 Native（BLE 示例）

### 调用链

```
JS: NativeBLE.connect(deviceId)
  → JSI: 找到 "BLEModule" 的 Host Object，调用 connect 方法
    → C++ 胶水（Codegen 生成）: 把参数从 JS 类型转成 JNI 类型
      → JNI: 调用 Java/Kotlin 的 BLEModule.connect()
        → Kotlin: 调用 Android BLE API（BluetoothGatt.connectGatt）
          → 硬件: BLE 射频连接
        ← 连接成功: promise.resolve()
      ← JNI 返回
    ← C++ 返回
  ← JSI: Promise resolve
← JS: await 完成
```

### 事件回传（Native → JS）

```
硬件: 设备发数据
  → Kotlin: onCharacteristicChanged 回调
    → emit("BLE_DATA", {deviceId, data})
      → JSI/EventEmitter: 调用 JS 函数引用
        → JS: listener 触发 → setState → UI 更新
```

### 设计决策

| 方向 | 方式 | 原因 |
|------|------|------|
| JS → Native（主动） | TurboModule 方法 → Promise | 一次性操作，有明确结果 |
| Native → JS（被动） | EventEmitter 事件 | 持续触发、时机不确定 |
| 纯 Native（后台） | 不经过 JS | 重连/心跳，后台也要工作 |

---

## 七、渲染链路的跨语言调用细节

### 完整调用链

```
JS → (JSI，无序列化) → C++ Fabric → (JNI，无序列化) → Android Java/Kotlin
```

两次跨语言，都是函数直调，不走序列化。

### Fabric 是什么

RN 新架构的**渲染系统**（C++ 实现）。职责：
- 管理 Shadow Tree（UI 树的 C++ 镜像）
- 接收 JS 渲染指令
- 调 Yoga 算布局
- 把最终 View 操作提交给 UI Thread

### JS → C++（JSI）

JS 通过 JSI 直接调 Fabric 的 C++ 方法（Host Object），传的是 C++ 对象引用。不是 JSON。

旧架构是 JSON 序列化 → 消息队列 → 反序列化（慢）。新架构去掉了这层。

### C++ → Java（JNI）

Fabric 算好布局后，通过 JNI 调 Java 层的 ViewManager，在 UI Thread 执行 View 操作。

不是每个指令一次 JNI，而是**批量提交**（一帧内的变化攒起来一次性提交）。

### C++ 层的价值

把 JS 的"抽象指令"（创建 flex:1 的 View）变成"精确指令"（在 0,0 创建 375x812 的 FrameLayout）。JS 不需要知道屏幕尺寸/像素密度，Yoga 算好。

而且 C++ 层跨平台——同一份 Fabric + Yoga 在 Android 和 iOS 都跑，只是最后一步不同：
- Android：JNI → Java ViewManager
- iOS：ObjC Bridge → UIKit

这就是 RN 跨平台的本质——布局计算写一次（C++），各平台只实现"最终 View 操作"。

---

## 八、快应用框架 vs RN 的渲染链路对比

| | RN（新架构） | 快应用框架 |
|---|------------|-----------|
| diff | JS 线程（React Reconciler） | JS 线程（infras.js 虚拟 DOM） |
| 布局计算 | C++ 层（Yoga 最新版） | Java 层（Yoga 1.5.0，YogaNode API） |
| 指令传递 | JSI → C++ Fabric（无序列化） | callNative 传 JSON Action（批量 50 条阈值） |
| 提交到 UI Thread | JNI 批量提交 | RenderWorker IO 线程解析 JSON → UI Thread 应用 |
| 中间层 | C++ Fabric（重，跨平台） | 无 C++ 中间层（JS → JSON → Java） |
| 默认 Flex 方向 | column（纵向） | row（横向） |

快应用的渲染链路：编译时 .ux → JSON 模板树 → JS 虚拟 DOM → Action 批量发送（callNative）→ Native 解析 JSON → 创建 Android View。

关键优化：Action 批量发送（50 条阈值减少 Bridge 调用）+ 异步 JSON 解析（IO 线程池不阻塞 UI）。
