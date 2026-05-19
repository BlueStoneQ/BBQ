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

### 从 React 组件到屏幕像素

```
JS Thread:
  React 组件 state/props 变化
    → React Reconciler 计算 diff（哪些节点变了）
    → 生成渲染指令（create/update/delete）
        ↓ 通过 Fabric（C++ 层）

C++ 层（Fabric + Yoga）:
  接收渲染指令
    → 更新 Shadow Tree
    → Yoga 计算 Flexbox 布局（measure/layout）
    → 生成 Native View 操作队列
        ↓

UI Thread:
  执行 Native View 操作
    → 创建/更新/删除 Android View
    → Android 系统 measure → layout → draw
    → 像素上屏
```

### 关键认知

- JS Thread 不直接操作 View（只产生指令）
- 布局计算在 C++ 层（Yoga，不在 JS 也不在 Java）
- 最终的 View 操作在 UI Thread（Android 主线程）
- 新架构（Fabric）支持同步渲染（某些场景不需要等下一帧）

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
