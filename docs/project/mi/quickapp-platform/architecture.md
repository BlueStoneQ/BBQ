# 快应用框架架构解析

> 从第一性原理理解：快应用框架解决了什么问题，如何解决的，本质是什么。

## 目录

- [一、第一性原理：为什么需要快应用框架](#一第一性原理为什么需要快应用框架)
- [二、本质：它到底是什么](#二本质它到底是什么)
- [三、架构全景](#三架构全景)
- [四、三条核心链路](#四三条核心链路)
  - [4.1 渲染流：从模板到像素](#41-渲染流从模板到像素)
  - [4.2 数据流：JS 调用系统能力](#42-数据流js-调用系统能力)
  - [4.3 生命周期流：应用的生与死](#43-生命周期流应用的生与死)
- [五、关键设计决策与 Trade-off](#五关键设计决策与-trade-off)
- [六、与同类方案的本质对比](#六与同类方案的本质对比)
- [七、框架能做到什么](#七框架能做到什么)

---

## 一、第一性原理：为什么需要快应用框架

### 问题的本质

手机上有两种应用形态：

| | 原生应用（APK） | Web 应用（H5） |
|---|---|---|
| 安装 | 需要下载安装 | 无需安装 |
| 体验 | 流畅，系统能力完整 | 卡顿，能力受限 |
| 分发 | 应用商店，用户决策成本高 | URL 即达，零成本 |
| 更新 | 重新下载 | 实时更新 |

**核心矛盾：用户想要"不安装就能用"的便捷性，又想要"原生级"的体验。**

这不是小米独有的问题。微信小程序、支付宝小程序、百度智能小程序都在解决同一个问题。区别在于：

- 微信小程序：运行在微信 App 内，依赖微信生态
- 快应用：运行在**操作系统层面**，不依赖任何第三方 App，是系统级能力

### 快应用的定位

**一句话：让轻量级应用以接近原生的性能运行在手机系统上，无需安装，即点即用。**

它解决的是"应用分发效率"和"用户体验"之间的矛盾——用 Web 技术栈（HTML/CSS/JS）开发，用原生渲染引擎执行。

---

## 二、本质：它到底是什么

### 类比理解

如果把手机比作一台电脑：

- **APK** = 安装在硬盘上的桌面软件（Word、Photoshop）
- **H5** = 浏览器里打开的网页
- **快应用** = 一个**内置在操作系统里的专用浏览器**，但它不渲染 HTML DOM，而是渲染原生 View

### 技术本质

快应用框架的本质是一个 **JS → Native View 的翻译引擎**：

```
开发者写的 JS/HTML/CSS
       ↓ 编译
    rpk 包（JS Bundle + 资源）
       ↓ 运行时加载
    V8 引擎执行 JS → 生成虚拟 DOM
       ↓ Bridge
    Android 原生 View 树渲染到屏幕
```

它不是 WebView（不走浏览器渲染），也不是完全的原生开发（不写 Java/Kotlin）。它是一个**中间层翻译器**，把 Web 开发范式翻译成原生渲染指令。

### 与浏览器的对比

| | 浏览器 | 快应用框架 |
|---|---|---|
| 输入 | HTML/CSS/JS | .ux 模板（类 Vue 语法） |
| JS 引擎 | V8/JSC | V8（J2V8） |
| 渲染引擎 | Blink（DOM → 像素） | 自研（VDom → Android View） |
| 布局 | CSS Box Model | Flexbox（Yoga 引擎） |
| 组件 | HTML 标签 | 原生 Widget（text/image/list...） |
| 系统能力 | 受限（沙箱） | 完整（系统级权限） |

**本质区别：浏览器的渲染层是自绘（Skia/GPU），快应用的渲染层是 Android 原生 View。** 这意味着快应用的 UI 组件就是 Android 的 TextView、ImageView、RecyclerView，天然具备原生性能和系统一致性。

---

## 三、架构全景

### 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     应用层（rpk 包）                          │
│  开发者用 .ux 文件（template + style + script）编写           │
│  编译后是 JS Bundle + CSS 对象 + 资源文件                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   JS Framework 层                            │
│                  （V8 引擎内执行）                             │
│                                                             │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   DSL 层       │  │  Runtime 层   │  │  Platform 层     │  │
│  │               │  │              │  │                 │  │
│  │  Vue / XVM    │  │  Document    │  │  Module 注册     │  │
│  │  模板解析      │  │  Listener    │  │  Feature 代理    │  │
│  │  响应式数据    │  │  Streamer    │  │  回调 ID 映射    │  │
│  │  虚拟 DOM     │  │  Action 生成  │  │  invokeNative   │  │
│  └───────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│          │                 │                    │            │
├──────────┴─────────────────┴────────────────────┴────────────┤
│                                                             │
│                    JS Bridge 层                              │
│            V8 J2V8 直接绑定（非 WebView）                     │
│                                                             │
│  JS→Native：JsBridge.invoke() / callNative()  [同步]        │
│  Native→JS：postExecuteFunction()             [异步]        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                  Android Native 层                           │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │  渲染引擎   │  │  Feature   │  │  Widget 组件库      │    │
│  │            │  │  系统 API   │  │                    │    │
│  │ VDomAction │  │            │  │  text / image      │    │
│  │ Applier    │  │  Device    │  │  list / web        │    │
│  │            │  │  Network   │  │  video / canvas    │    │
│  │ Component  │  │  Storage   │  │  input / map       │    │
│  │ Factory    │  │  Camera    │  │  ...60+ 组件       │    │
│  │            │  │  ...       │  │                    │    │
│  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  扩展层：小米定制(overlay) + 插件(plugins)           │     │
│  │  账号/支付/推送/广告/凡泰/百度/游戏引擎              │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                  App Shell（com.miui.hybrid）                │
│              系统预装 APK，product 分区                       │
└─────────────────────────────────────────────────────────────┘
```

### 每层解决什么问题

| 层 | 解决的问题 | 本质 |
|---|---|---|
| DSL 层 | 让前端开发者用熟悉的方式写 UI | 模板 → 虚拟 DOM 的编译器 |
| Runtime 层 | 高效地将 DOM 变更传递给 Native | 批量序列化 + 异步管线 |
| Platform 层 | 让 JS 能调用系统能力 | 回调 ID 映射 + 代理模式 |
| Bridge 层 | 跨语言通信 | V8 引擎 API 直接绑定 |
| 渲染引擎 | 把抽象描述变成屏幕像素 | JSON Action → Android View |
| Feature 层 | 暴露系统能力给 JS | 注解注册 + 反射分发 |
| Widget 层 | 提供原生 UI 组件 | 标签名 → Android View 的映射 |

---

## 四、三条核心链路

### 4.1 渲染流：从模板到像素

**问题：开发者写了 `<text>Hello</text>`，屏幕上怎么出现文字？**

```
编译时                    运行时 JS                    运行时 Native
─────────                ──────────                  ──────────────

.ux 模板                  V8 加载 JS Bundle            
    │                         │                      
    ▼                         ▼                      
parse5 解析 HTML          DSL 解析模板                 
    │                    构建虚拟 DOM                  
    ▼                         │                      
JSON 模板树                    ▼                      
{type:"text",             Listener 监听 DOM 变更       
 attr:{value:"Hello"}}    生成 Action 对象             
    │                         │                      
    ▼                         ▼                      
webpack 打包              Streamer 批量缓冲            
    │                    （50 条/批）                  
    ▼                         │                      
rpk 包                        ▼                      
                          callNative(JSON)            
                              │                      
                              ▼                      
                         ─── V8 边界 ───              
                              │                      
                              ▼                      
                         RenderActionManager          
                         （IO 线程解析 JSON）           
                              │                      
                              ▼                      
                         VDomActionApplier            
                         （主线程应用变更）              
                              │                      
                              ▼                      
                         ComponentFactory             
                         查 Widget 注册表              
                         "text" → Text.java           
                              │                      
                              ▼                      
                         new TextLayoutView()         
                         setText("Hello")             
                              │                      
                              ▼                      
                         Android 渲染管线              
                         屏幕显示 "Hello"              
```

**关键设计决策：**

1. **批量发送（Streamer）**：不是每次 DOM 变更都跨 Bridge，而是攒够 50 条一起发。减少 V8↔Java 调用次数。
2. **异步渲染管线**：JSON 解析在 IO 线程，View 操作在主线程。不阻塞 UI。
3. **组件注册表**：`@WidgetAnnotation` 编译时生成映射，运行时 O(1) 查找。

### 4.2 数据流：JS 调用系统能力

**问题：开发者调用 `device.getInfo({success})`，怎么拿到手机信息？**

```
JS 侧                              Native 侧
──────                              ──────────

device.getInfo({success})           
    │                               
    ▼                               
invokeNative()                      
├─ 分离回调函数 → 存入 _callbacks[42]  
├─ 序列化业务参数 → JSON             
└─ JsBridge.invoke(                 
     "system.device",               
     "getInfo",                     
     params,                        
     "42"  ← 只传 ID，不传函数       
   )                                
    │                               
    ▼                               
─── V8 边界 ───                     
    │                               
    ▼                               
                                    ExtensionManager.invoke()
                                        │
                                        ▼
                                    查找 Feature: "system.device" → Device.java
                                        │
                                        ▼
                                    Device.getInfo()
                                    ├─ Build.BRAND → "Xiaomi"
                                    ├─ Build.MODEL → "Mi 14"
                                    ├─ screenWidth → 1080
                                    └─ 构建 JSONObject
                                        │
                                        ▼
                                    callback(response)
                                        │
                                        ▼
                                    JsThread.postExecuteFunction(
                                      "execInvokeCallback",
                                      {callback:"42", data:{brand:"Xiaomi",...}}
                                    )
    │                               
    ▼                               
─── V8 边界 ───                     
    │                               
    ▼                               
execInvokeCallback()                
├─ 根据 ID "42" 找到 _callbacks[42] 
├─ code=0 → 调用 success            
└─ success({brand:"Xiaomi",...})    
```

**核心设计：回调 ID 映射**

为什么不直接把 JS 函数传给 Native？因为**函数引用无法跨越 V8 引擎边界**。V8 内部的函数对象是 C++ 堆上的指针，Java 无法持有。

解决方案：JS 侧维护一个 `Map<number, Function>`，只把数字 ID 传给 Native。Native 完成后带着 ID 回来，JS 根据 ID 找到函数执行。

**这和前端的 JSONP、postMessage 回调是同一个思路。**

### 4.3 生命周期流：应用的生与死

```
用户点击快应用入口
    │
    ▼
系统启动 HybridPlatform 进程
    │
    ▼
创建 V8 引擎实例（加载 infras.js 快照加速）
    │
    ▼
解压 rpk → 加载 app.js → 执行 $app_define$
    │
    ▼
路由到首页 → 加载页面 JS → 创建 Document + Listener + Streamer
    │
    ▼
DSL 解析模板 → 构建虚拟 DOM → 批量 Action → Native 渲染
    │
    ▼
页面可见（onShow）
    │
    ├── 用户交互 → Native 事件 → postFireEvent → JS 回调
    ├── 数据变更 → 响应式更新 → Listener 生成 updateAttrs/updateStyle Action
    ├── Feature 调用 → invokeNative → Bridge → Native 执行 → 回调
    │
    ▼
用户离开（onHide / onDestroy）
    │
    ▼
释放 V8 实例 + 回收 Native View
```

---

## 五、关键设计决策与 Trade-off

### 决策 1：V8 直接绑定 vs WebView

| | V8 直接绑定（快应用选择） | WebView |
|---|---|---|
| 性能 | 高，无 DOM 渲染开销 | 低，完整浏览器渲染管线 |
| 包体积 | 大，需内嵌 V8（libjsenv.so 13MB） | 小，复用系统 WebView |
| 渲染 | 原生 View，系统一致性好 | HTML DOM，可能和系统风格不一致 |
| 能力 | 完整系统权限 | 沙箱限制 |
| 开发成本 | 高，需自建渲染引擎 | 低，浏览器已有 |

**为什么这样选：** 快应用定位是"系统级轻应用"，性能和体验是核心竞争力。如果用 WebView，和 H5 没有本质区别，没有存在的意义。

### 决策 2：原生 View 渲染 vs 自绘引擎（Skia）

| | 原生 View（快应用选择） | 自绘（Flutter 方案） |
|---|---|---|
| 一致性 | 天然和系统 UI 一致 | 需要自己实现系统风格 |
| 性能上限 | 受限于 Android View 体系 | 更高（直接 GPU 绘制） |
| 组件复用 | 可直接用 Android 生态组件 | 需要全部重写 |
| 开发成本 | 中等 | 极高 |
| 包体积 | 小（复用系统 View） | 大（需内嵌 Skia） |

**为什么这样选：** 快应用是手机厂商的系统能力，天然需要和系统 UI 保持一致。用原生 View 可以直接复用 Android 的无障碍、主题、动画等基础设施。

### 决策 3：双通道设计（渲染 vs Feature）

```
渲染通道：callNative(pageId, actionsJSON)     → 批量、异步、IO线程解析
Feature通道：JsBridge.invoke(feature, action)  → 单次、同步/异步、直接分发
```

**为什么分开：** 渲染操作是高频批量的（一次页面渲染可能几百个 Action），需要批量优化。Feature 调用是低频单次的（用户点一下按钮调一次），需要即时响应。混在一起会互相干扰。

### 决策 4：编译时模板 vs 运行时解析

快应用在**编译时**就把 .ux 模板转成 JSON 模板树，运行时不需要解析 HTML。

**好处：**
- 运行时零解析开销
- 编译时可以做静态检查（标签合法性、属性类型）
- 模板结构固定，可以做 AOT 优化

**代价：**
- 不支持运行时动态生成模板（innerHTML）
- 开发灵活性低于浏览器

---

## 六、与同类方案的本质对比

### 本质分类

所有跨端方案都在解决同一个问题：**用一种语言写，在多个平台跑**。区别在于"翻译"发生在哪一层：

```
                    开发者代码
                        │
          ┌─────────────┼─────────────┐
          │             │             │
     编译时翻译      运行时翻译     运行时自绘
          │             │             │
    原生代码产物    Bridge 通信     Skia/GPU
          │             │             │
     ┌────┴────┐   ┌───┴───┐    ┌───┴───┐
     │ Kotlin  │   │ 快应用  │    │Flutter│
     │Multiplatform│   │ RN    │    │       │
     │ Compose │   │ 小程序  │    │       │
     └─────────┘   └───────┘    └───────┘
```

### 详细对比

| 维度 | 快应用 | React Native | Flutter | 微信小程序 |
|------|--------|-------------|---------|-----------|
| **渲染方式** | JS → 原生 View | JS → 原生 View | Dart → Skia 自绘 | JS → WebView + 原生组件 |
| **JS 引擎** | V8（J2V8） | Hermes/JSC | 无（Dart VM） | V8/JSCore |
| **通信机制** | J2V8 直接绑定 | JSI（C++ 绑定） | FFI（Dart↔C++） | evaluateJavascript |
| **布局引擎** | Yoga (Flexbox) | Yoga (Flexbox) | 自研 (Flexbox) | WebView CSS |
| **热更新** | rpk 包替换 | JS Bundle 替换 | 不支持（AOT） | 包下载 |
| **系统权限** | 完整（系统应用） | 受限（三方应用） | 受限 | 受限（微信沙箱） |
| **分发方式** | 系统级（无需安装） | 应用商店 | 应用商店 | 微信内 |
| **包体积** | rpk 几百KB | APK 几十MB | APK 几十MB | 包 2MB 限制 |

### 快应用的独特优势

1. **系统级权限**：预装在 ROM 中，拥有 platform 签名，可以做到三方应用做不到的事（静默安装、系统通知、桌面快捷方式）
2. **即点即用**：不需要下载安装，URL 即达
3. **极小包体**：rpk 包通常几百 KB，秒下载
4. **系统一致性**：原生 View 渲染，和系统 UI 风格天然一致

### 快应用的劣势

1. **生态封闭**：只在支持快应用的手机上运行（小米、华为、OPPO、vivo 等国产手机）
2. **能力受限**：组件和 API 由框架定义，不如原生灵活
3. **性能天花板**：Bridge 通信有开销，复杂动画不如原生/Flutter

---

## 七、框架能做到什么

### 对开发者（CP）

| 能力 | 说明 |
|------|------|
| Web 技术栈开发 | HTML/CSS/JS，Vue 语法，前端开发者零学习成本 |
| 60+ 原生组件 | text/image/list/video/canvas/map/web... |
| 丰富系统 API | 设备信息、网络、存储、相机、蓝牙、NFC、传感器、支付... |
| 多页面路由 | 类似浏览器的页面栈管理 |
| 卡片能力 | 桌面小组件（Widget） |
| 游戏引擎 | Cocos/Unity 集成 |

### 对用户

| 能力 | 说明 |
|------|------|
| 即点即用 | 无需下载安装，点击即打开 |
| 原生体验 | 流畅度接近原生应用 |
| 系统集成 | 桌面快捷方式、系统搜索、负一屏卡片 |
| 轻量 | 不占用用户存储空间 |

### 对手机厂商（小米）

| 能力 | 说明 |
|------|------|
| 应用分发 | 绕过应用商店，系统级分发能力 |
| 生态控制 | 自定义 API、审核机制、流量入口 |
| 差异化 | 系统级轻应用能力，竞争壁垒 |
| 商业化 | 广告、推送、支付等商业能力 |

### 框架的边界（做不到什么）

| 限制 | 原因 |
|------|------|
| 复杂动画/游戏 | Bridge 通信延迟，不适合 60fps 逐帧控制 |
| 深度系统定制 | 组件和 API 由框架定义，无法直接操作系统底层 |
| 跨平台 | 只能在支持快应用的 Android 设备上运行 |
| 大型应用 | 设计目标是"轻应用"，不适合重型应用 |
| 后台常驻 | 系统会回收资源，不适合后台服务型应用 |
