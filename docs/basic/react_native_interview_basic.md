# React Native 面试知识梳理

> 基于 BBQ 项目中的 React Native 学习笔记整理，从面试角度系统梳理 RN 核心知识点

## 目录

- [一、RN 基础概念与架构](#一rn-基础概念与架构)
- [二、RN 通信机制](#二rn-通信机制)
- [三、RN 性能优化](#三rn-性能优化)
- [四、RN 热更新](#四rn-热更新)
- [五、RN 原生集成](#五rn-原生集成)
- [六、RN vs Flutter](#六rn-vs-flutter)
- [七、跨端方案中的 RN](#七跨端方案中的-rn)
- [八、高频面试题](#八高频面试题)
- [九、实战技巧](#九实战技巧)
- [十、参考资料](#十参考资料)

---

## 一、RN 基础概念与架构 ⭐⭐⭐

### 1.1 什么是 React Native？🔥

**考点**：RN 的定位和特点

- 使用 React 语法开发原生移动应用的框架
- 核心理念："Learn Once, Write Anywhere"
- 使用 JavaScript 编写，渲染真正的原生组件
- 支持热更新，无需重新发布应用

**与 Web 开发的区别**：
- 不是 WebView，渲染的是真正的原生组件
- 使用 `<View>`、`<Text>` 等组件，而非 HTML 标签
- 样式使用 StyleSheet，类似 CSS 但有差异

### 1.2 RN 架构原理 ⭐⭐⭐ 🔥🔥

**考点**：RN 的三层架构

```
┌─────────────────────────────────────┐
│   JavaScript Layer (业务逻辑)        │
│   - React 组件                       │
│   - 业务代码                         │
└──────────────┬──────────────────────┘
               │ Bridge (异步通信)
┌──────────────┴──────────────────────┐
│   C++ Layer (Bridge 层)              │
│   - 消息队列                         │
│   - 序列化/反序列化                  │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│   Native Layer (原生层)              │
│   - iOS (Objective-C/Swift)         │
│   - Android (Java/Kotlin)           │
└─────────────────────────────────────┘
```

**核心组件**：
- **JSCore**：JavaScript 运行环境
- **Bridge**：JS 和 Native 之间的通信桥梁
- **Native Modules**：原生功能模块

### 1.3 JSBundle 打包机制 ⭐⭐ 🔥

**考点**：RN 应用的打包产物

- 所有 JavaScript 代码（框架代码、第三方库、业务代码）打包成一个 JSBundle 文件
- 包含图片等静态资源
- 通过 Metro 打包工具进行构建



---

## 二、RN 通信机制 ⭐⭐⭐ 🔥🔥🔥

### 2.1 Bridge 通信原理 ⭐⭐⭐ 🔥🔥

**考点**：JS 和 Native 如何通信

**传统 Bridge 方式**：
- **异步通信**：所有跨端调用都是异步的
- **序列化传输**：数据需要 JSON 序列化后传输
- **消息队列**：使用消息队列批量处理通信

**通信流程**：
```javascript
// JS 调用 Native
JS Layer → 序列化数据 → Bridge 消息队列 → Native Layer

// Native 回调 JS
Native Layer → 序列化数据 → Bridge 消息队列 → JS Layer
```

**Bridge 的性能问题**：
- 频繁的序列化/反序列化开销
- 异步通信导致的延迟
- 大量数据传输时性能瓶颈明显

**监控 Bridge 通信**：
```javascript
// index.js
import MessageQueue from 'react-native/Libraries/BatchedBridge/MessageQueue'
MessageQueue.spy(true); // 开启监视，查看 Bridge 上的通信
```

### 2.2 JSI 新架构 ⭐⭐⭐ 🔥🔥🔥

**考点**：RN 新架构的核心改进

**JSI (JavaScript Interface)** 是 RN 新架构的核心：

**核心特性**：
1. **同步调用**：JS 可以直接调用 Native 方法，无需异步等待
2. **直接引用**：JS 可以持有 C++ 对象的引用（Host Objects）
3. **无需序列化**：直接操作对象，省去序列化开销
4. **引擎无关**：可以替换不同的 JS 引擎（不限于 JSCore）

**实现原理**：
```
┌─────────────────────────────────────┐
│   JavaScript Layer                  │
└──────────────┬──────────────────────┘
               │ JSI (直接调用)
┌──────────────┴──────────────────────┐
│   C++ Layer (JSI)                   │
│   - 持有 C++ 对象引用                │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│   Native Layer                      │
│   - iOS: OC 可直接调用 C/C++        │
│   - Android: 通过 JNI 调用          │
└─────────────────────────────────────┘
```

**为什么 JSI 可以和 Native 通信**：
- **iOS**：Objective-C 本身是 C 语言的扩展，可以直接调用 C/C++ 方法
- **Android**：通过 JNI (Java Native Interface) 调用 C++ 代码

**JSI 的优势**：
- 性能大幅提升（同步调用 + 无序列化）
- 支持更换 JS 引擎（如 Hermes）
- 为 Fabric、TurboModules 等新特性奠定基础



---

## 三、RN 性能优化 ⭐⭐⭐ 🔥🔥🔥

### 3.1 JSBundle 体积优化 ⭐⭐⭐ 🔥🔥

**考点**：如何减小 JSBundle 体积

#### 1. 使用 Bundle 分析工具
```bash
# 安装分析工具
npm install react-native-bundle-visualizer

# 分析 bundle 体积
npx react-native-bundle-visualizer
```

#### 2. 按需引入优化

**问题**：全量引入导致体积过大
```javascript
// ❌ 不好的做法
import _ from 'lodash'
import moment from 'moment'
```

**解决方案 1：babel-plugin-lodash**
```javascript
// babel.config.js
module.exports = {
  plugins: ['lodash'],
  presets: ['module:metro-react-native-babel-preset'],
};

// 自动转换
import { join, chunk } from 'lodash'
// ⬇️ 编译后
import join from 'lodash/join'
import chunk from 'lodash/chunk'
```

**解决方案 2：babel-plugin-import（通用方案）**
```javascript
// babel.config.js
module.exports = {
  plugins: [
    [
      'import',
      {
        libraryName: 'ahooks',
        camel2DashComponentName: false,
        camel2UnderlineComponentName: false,
      },
    ],
  ],
  presets: ['module:metro-react-native-babel-preset'],
};

// 自动转换
import { useInterval } from 'ahooks'
// ⬇️ 编译后
import useInterval from 'ahooks/lib/useInterval'
```

#### 3. 替换大体积库
- `moment.js` → `day.js`（体积减少 90%+）
- 评估第三方库的必要性

#### 4. 使用 Inline Require
- 延迟加载模块，减少启动时间
- 避免使用 `export default`（影响 tree-shaking）



### 3.2 JSBundle 分包加载 ⭐⭐⭐ 🔥🔥🔥

**考点**：大型应用的分包策略

**为什么需要分包**：
- 单个 Bundle 过大，加载慢
- 首屏不需要的代码也被加载
- 影响启动性能

**分包策略**：
```
common.bundle (公共代码)
  ├── React Native 框架代码
  ├── 第三方公共库
  └── 公共业务组件

business.bundle (业务代码)
  ├── 页面 A
  ├── 页面 B
  └── 页面 C
```

**Metro 分包实现要点**：

1. **自定义 Module ID**
```javascript
// metro.config.js
module.exports = {
  serializer: {
    createModuleIdFactory: function() {
      // 自定义模块 ID 生成逻辑
      // 确保公共模块 ID 在不同 bundle 中一致
    },
  },
};
```

2. **过滤公共模块**
```javascript
// metro.config.js
module.exports = {
  serializer: {
    processModuleFilter: function(module) {
      // 过滤出公共模块
      // 返回 false 表示该模块不打入当前 bundle
    },
  },
};
```

3. **加载顺序**
- 先加载 `common.bundle`
- 再加载 `business.bundle`
- 需要 Native 侧配合实现加载逻辑

**参考方案**：
- [react-native-multibundler](https://github.com/smallnew/react-native-multibundler)

**注意事项**：
- RN 不像浏览器可以动态插入 `<script>` 标签
- 需要结合具体的 RN 容器实现
- 需要 iOS 和 Android 原生侧支持

### 3.3 Native 侧优化 ⭐⭐⭐ 🔥🔥

**考点**：原生层面的性能优化

#### RN 容器池（预初始化）

**原理**：类似 WebView 容器池
```
App 启动
  ↓
提前初始化 RN 容器（空闲时）
  ↓
用户打开 RN 页面
  ↓
从容器池获取已初始化的容器（秒开）
```

**实现**：
- 容器池本质是一个 Map
- Key: componentName (AppRegistry 注册的名称)
- Value: 已实例化的 RCTRootView/ReactRootView

**优势**：
- 大幅减少初始化耗时
- 实现 RN 页面秒开
- 类似 H5 的 WebView 预加载



---

## 四、RN 热更新 ⭐⭐⭐ 🔥🔥

### 4.1 热更新原理 ⭐⭐⭐ 🔥🔥

**考点**：RN 如何实现热更新

**核心特性**：
- 无需重新发布 App，即可更新功能
- 支持增量热更新（只下发变更部分）
- 服务器下发新的 JSBundle，App 重新加载即可

**热更新流程**：
```
1. 服务器生成新的 JSBundle
   ↓
2. 客户端检测到新版本
   ↓
3. 下载新的 JSBundle（或增量包）
   ↓
4. 合并 JSBundle（增量更新）
   ↓
5. 重新加载 JSBundle
   ↓
6. 功能更新完成
```

**增量更新**：
- 服务器只下发新增/修改的代码和资源
- RN 框架自动合并 JSBundle
- 大幅减少下载体积

### 4.2 CodePush 热更新方案 ⭐⭐⭐ 🔥🔥

**考点**：业界成熟的热更新方案

**为什么选择 CodePush**：
- 自己实现热更新复杂度高（版本管理、增量对比、回滚等）
- 热更新模块不稳定可能导致 App 完全无法打开
- CodePush 是微软提供的成熟、稳定的解决方案

**CodePush 特性**：
- 服务端代码增量比较
- 版本管理
- 更新失败后的版本回滚
- 灰度发布支持

**集成方式**：
```bash
# 自动集成（推荐）
react-native link react-native-code-push
```

**使用示例**：
```javascript
import codePush from 'react-native-code-push';

// 配置更新策略
const codePushOptions = {
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME,
  installMode: codePush.InstallMode.IMMEDIATE,
};

class App extends Component {
  // ...
}

export default codePush(codePushOptions)(App);
```

### 4.3 增量更新实现 ⭐⭐ 🔥🔥🔥

**考点**：如何实现增量更新

**使用 diff_match_patch 算法**：

**生成补丁**：
```javascript
const diffMatchPatch = require('diff-match-patch');
const dmp = new diffMatchPatch();

const pre = "线上运行的资源包";
const next = "新资源包";

const diff = dmp.diff_main(pre, next);
const patches = dmp.patch_make(diff);
// patches 压缩后只有几 KB
```

**客户端应用补丁**：
```javascript
const dmp = new diffMatchPatch();

const pre = "线上运行的资源包";
const patches = "下发的补丁文件";

const result = dmp.patch_apply(patches, pre);
// result 就是最新的资源包
```

**优势**：
- 大幅减小下发包体积
- 节省用户流量
- 加快更新速度



---

## 五、RN 原生集成 ⭐⭐⭐ 🔥🔥

### 5.1 集成到现有 App ⭐⭐⭐ 🔥🔥

**考点**：如何将 RN 集成到现有原生应用

**集成步骤**：

#### Android 集成

1. **添加依赖配置**
```gradle
// android/app/build.gradle
dependencies {
    implementation "com.facebook.react:react-native:+"
}
```

2. **启动 AutoLink**
```bash
npx react-native link
```

3. **权限配置**
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
```

4. **代码集成**
```java
public class MyReactActivity extends Activity 
    implements DefaultHardwareBackBtnHandler {
    
    private ReactRootView mReactRootView;
    private ReactInstanceManager mReactInstanceManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 创建 ReactRootView
        mReactRootView = new ReactRootView(this);
        
        // 获取 RN 包列表
        List<ReactPackage> packages = 
            new PackageList(getApplication()).getPackages();

        // 创建 ReactInstanceManager
        mReactInstanceManager = ReactInstanceManager.builder()
            .setApplication(getApplication())
            .setCurrentActivity(this)
            .setBundleAssetName("index.android.bundle")
            .setJSMainModulePath("index")
            .addPackages(packages)
            .setUseDeveloperSupport(BuildConfig.DEBUG)
            .setInitialLifecycleState(LifecycleState.RESUMED)
            .build();

        // 启动 RN 应用
        mReactRootView.startReactApplication(
            mReactInstanceManager,
            "MyApp",
            null
        );

        setContentView(mReactRootView);
    }

    // 生命周期回调传递给 ReactInstanceManager
    @Override
    protected void onPause() {
        super.onPause();
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostPause(this);
        }
    }

    // 处理后退按钮
    @Override
    public void onBackPressed() {
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onBackPressed();
        } else {
            super.onBackPressed();
        }
    }
}
```

**最佳实践**：
- 构建一个继承 `ReactRootView` 的基类（类似 BaseActivity）
- 统一管理生命周期回调
- 统一处理返回键事件

### 5.2 原生模块开发 ⭐⭐⭐ 🔥🔥🔥

**考点**：如何开发 RN 原生插件

**使用脚手架创建插件**：
```bash
# 安装脚手架
npm install -g react-native-create-library

# 创建插件项目
react-native-create-library --platform ios,android quicklogin-plugin-rn
```

**插件结构**：
```javascript
// index.js
import { NativeModules, Platform } from 'react-native';

const { QuickLoginModule } = NativeModules;

export default {
  login: () => {
    return QuickLoginModule.login();
  },
  
  isSupported: () => {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },
};
```

**Android 原生模块**：
```java
public class QuickLoginModule extends ReactContextBaseJavaModule {
    @Override
    public String getName() {
        return "QuickLoginModule";
    }

    @ReactMethod
    public void login(Promise promise) {
        // 调用原生 SDK
        // ...
        promise.resolve(result);
    }
}
```

**iOS 原生模块**：
```objc
@interface QuickLoginModule : NSObject <RCTBridgeModule>
@end

@implementation QuickLoginModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(login:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    // 调用原生 SDK
    // ...
    resolve(result);
}

@end
```



---

## 六、RN vs Flutter ⭐⭐⭐ 🔥🔥

### 6.1 架构对比 ⭐⭐⭐ 🔥🔥

**考点**：RN 和 Flutter 的核心差异

| 对比维度 | React Native | Flutter |
|---------|-------------|---------|
| **渲染方式** | 调用原生组件渲染 | 自绘引擎（Skia）直接渲染 |
| **开发语言** | JavaScript/TypeScript | Dart |
| **UI 组件** | 依赖平台原生组件 | 自带 Widget 库 |
| **性能** | 通过 Bridge 通信，有性能损耗 | 直接与 GPU 交互，性能更优 |
| **包体积** | Android 大（需内置 JSCore）<br>iOS 小（系统自带 JSCore） | iOS 大（需内置 Skia）<br>Android 小（系统自带 Skia） |
| **热更新** | ✅ 天然支持 | ❌ 不支持（需要特殊方案） |
| **生态** | Web 生态，库丰富 | 生态较新，但增长快 |
| **原生控件接入** | ✅ 稳定 | ⚠️ 相对不稳定 |
| **插件体验** | 良好 | 略优于 RN |

### 6.2 性能对比 ⭐⭐⭐ 🔥🔥

**理论性能**：
- **Flutter 性能更优**：直接与 CPU/GPU 交互，无 Bridge 开销
- **RN 性能瓶颈**：Bridge 通信、序列化开销

**实际表现**：
- 简单页面：差异不明显
- 复杂交互、动画：Flutter 优势明显
- 列表滚动：Flutter 更流畅

### 6.3 包体积对比 ⭐⭐ 🔥

**Android**：
- **RN 更大**：需要内置 JSCore 和各种动态库（.so 文件）
- **Flutter 更小**：Android 系统自带 Skia

**iOS**：
- **RN 更小**：iOS 系统自带 JSCore
- **Flutter 更大**：需要内置 Skia 引擎

### 6.4 选型建议 ⭐⭐⭐ 🔥

**选择 React Native**：
- 团队熟悉 React/JavaScript
- 需要热更新能力
- 需要复用 Web 生态的库
- 对性能要求不是极致

**选择 Flutter**：
- 对性能要求高（复杂动画、游戏等）
- 追求一致的 UI 体验
- 不需要热更新
- 团队愿意学习 Dart

**RN 的局限性**：
- 平台依赖性强，版本升级痛点多
- 性能瓶颈在 Bridge 通信
- 需要频繁处理平台差异

**Flutter 的优势**：
- 直接越过系统，和 GPU 硬件打交道
- 性能更稳定可控
- UI 一致性更好



---

## 七、跨端方案中的 RN ⭐⭐ 🔥🔥

### 7.1 Taro + RN ⭐⭐ 🔥🔥

**考点**：Taro 如何支持 RN

**Taro 多端支持**：
- H5
- 小程序（微信、支付宝、字节等）
- React Native
- 快应用

**Taro RN 实现原理**：
- 编译时：根据构建目标注入不同的运行时
- 运行时：提供 RN 平台的 DOM/BOM API 实现
- 组件库：使用 RN 原生组件实现小程序规范的组件

**网络请求统一**：
```javascript
// 通过 @tarojs/plugin-http 插件
// 在 RN 环境注入 XMLHttpRequest 实现
// 可以在 H5、小程序、RN 中统一使用 axios
import axios from 'axios';

// 在所有平台都能正常工作
axios.get('/api/data').then(res => {
  console.log(res.data);
});
```

### 7.2 快应用 vs RN ⭐⭐ 🔥

**考点**：快应用和 RN 的区别

| 对比维度 | React Native | 快应用 |
|---------|-------------|--------|
| **渲染引擎** | 打包到 App 中 | 集成到 ROM 中 |
| **包体积** | 较大 | 很小 |
| **开发语言** | JavaScript + React | JavaScript（类小程序语法） |
| **分发方式** | 需要安装 | 快速分发（类似小程序） |
| **性能** | 原生组件渲染 | 原生组件渲染 |

**快应用的优势**：
- 渲染引擎在 ROM 中，应用体积极小
- 快速分发，无需安装
- 性能接近原生

**快应用的劣势**：
- 不支持 React/Vue 语法
- 生态不如 RN 丰富
- 依赖厂商 ROM 支持

### 7.3 JSBridge 通信 ⭐⭐⭐ 🔥🔥

**考点**：Hybrid 应用中的 JSBridge

**大数据传输问题**：
- URL 参数有长度限制
- 大数据直接传输会导致 URL 过长

**解决方案：LocalStorage 中转**：

**接收数据**：
```javascript
// Native 端：接收到 URL 后转发到 JS 端
// JS 端
const { params } = await JSBridge.getParams();

JSBridge.getParams = () => {
  const { host, params } = url.parse(url);
  
  return new Promise(async (resolve, reject) => {
    if (params.__localStorageKey) {
      // 从 LocalStorage 读取大数据
      const { params } = JSBridge.getLocalStorage(
        params.__localStorageKey
      );
      resolve({ params });
    } else {
      resolve({ params });
    }
  });
};
```

**发送数据**：
```javascript
// JS 侧的 openUrl 内部判断参数大小
// 如果超过阈值，先存储到 LocalStorage
const key = JSBridge.setLocalStorage(JSON.stringify(params));

// 将 key 拼接到 URL
const url = `scheme://host?__localStorageKey=${key}`;

// 发送到 Native 端
JSBridge.openUrl(url);
```

**优势**：
- 突破 URL 长度限制
- 支持大数据传输
- 性能更好（避免 URL 解析大字符串）



---

## 八、高频面试题 ⭐⭐⭐

### Q1: React Native 的工作原理是什么？🔥🔥🔥

**答**：
RN 采用三层架构：
1. **JavaScript 层**：运行在 JSCore 中，执行业务逻辑和 React 代码
2. **Bridge 层**：负责 JS 和 Native 之间的异步通信，通过消息队列传递序列化的数据
3. **Native 层**：iOS/Android 原生代码，负责渲染真正的原生组件

新架构引入了 JSI，实现了 JS 和 Native 的同步调用，省去了序列化开销，性能大幅提升。

### Q2: RN 的性能瓶颈在哪里？如何优化？🔥🔥🔥

**答**：
**性能瓶颈**：
- Bridge 通信的序列化/反序列化开销
- 频繁的跨端调用导致的延迟
- JSBundle 体积过大影响启动速度

**优化方案**：
1. **JSBundle 优化**：按需引入、替换大体积库、分包加载
2. **Native 优化**：容器池预初始化、减少跨端调用
3. **代码优化**：使用 Inline Require、避免不必要的渲染
4. **新架构**：使用 JSI、Fabric、TurboModules

### Q3: RN 如何实现热更新？🔥🔥

**答**：
RN 天然支持热更新：
1. 所有代码打包成 JSBundle 文件
2. 服务器下发新的 JSBundle（或增量包）
3. App 下载并合并 JSBundle
4. 重新加载 JSBundle 即可完成更新

推荐使用 CodePush 方案，提供了完整的版本管理、增量更新、回滚等功能。

### Q4: RN 和 Flutter 如何选型？🔥🔥

**答**：
**选 RN**：
- 团队熟悉 React/JS，学习成本低
- 需要热更新能力
- 需要复用 Web 生态
- 对性能要求不极致

**选 Flutter**：
- 对性能要求高（复杂动画、游戏）
- 追求 UI 一致性
- 不需要热更新
- 团队愿意学习 Dart

### Q5: JSI 相比 Bridge 有什么优势？🔥🔥🔥

**答**：
1. **同步调用**：JS 可以直接调用 Native 方法，无需异步等待
2. **无需序列化**：直接持有 C++ 对象引用，省去序列化开销
3. **性能提升**：减少通信延迟，提高执行效率
4. **引擎无关**：可以替换不同的 JS 引擎（如 Hermes）

### Q6: 如何将 RN 集成到现有 App？🔥🔥

**答**：
1. 添加 RN 依赖到项目
2. 创建 ReactRootView/RCTRootView
3. 创建 ReactInstanceManager
4. 加载 JSBundle 并启动 RN 应用
5. 处理生命周期回调和返回键事件

建议封装一个 BaseActivity/BaseViewController 统一管理。

### Q7: RN 的包体积为什么在 Android 上更大？🔥

**答**：
- **Android**：需要内置 JSCore 引擎和各种动态库（.so 文件）
- **iOS**：系统自带 JSCore，无需打包

Flutter 则相反：
- **Android**：系统自带 Skia，包体积小
- **iOS**：需要内置 Skia，包体积大

### Q8: RN 如何实现分包加载？🔥🔥🔥

**答**：
1. 使用 Metro 的 `createModuleIdFactory` 自定义模块 ID
2. 使用 `processModuleFilter` 过滤公共模块
3. 生成 common.bundle 和 business.bundle
4. Native 侧先加载 common.bundle，再加载 business.bundle
5. 需要 iOS/Android 原生侧配合实现加载逻辑

### Q9: 如何监控 RN 的 Bridge 通信？🔥

**答**：
```javascript
import MessageQueue from 'react-native/Libraries/BatchedBridge/MessageQueue'
MessageQueue.spy(true);
```
开启后可以在控制台看到所有 Bridge 上的通信消息。

### Q10: RN 的增量更新如何实现？🔥🔥

**答**：
使用 diff_match_patch 算法：
1. 服务端对比新旧 JSBundle，生成补丁文件
2. 客户端下载补丁文件（只有几 KB）
3. 客户端将补丁应用到旧 JSBundle，得到新 JSBundle
4. 重新加载新 JSBundle

优势是大幅减小下发包体积，节省流量。

---

## 九、实战技巧 ⭐⭐

### 9.1 调试技巧

**开启调试菜单**：
- iOS：`Cmd + D`
- Android：`Cmd + M` 或摇一摇设备

**常用调试工具**：
- Chrome DevTools：调试 JS 代码
- React DevTools：查看组件树
- Flipper：全能调试工具（网络、布局、日志等）

### 9.2 性能监控

**FPS 监控**：
```javascript
import { PerformanceObserver } from 'react-native';

const observer = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    console.log('FPS:', entry.duration);
  });
});

observer.observe({ entryTypes: ['measure'] });
```

**Bundle 分析**：
```bash
npx react-native-bundle-visualizer
```

### 9.3 常见问题

**问题 1：Android 包体积过大**
- 使用 ProGuard 混淆
- 启用 Hermes 引擎
- 分包加载

**问题 2：启动速度慢**
- 容器池预初始化
- 减小 JSBundle 体积
- 使用 Inline Require

**问题 3：列表滚动卡顿**
- 使用 FlatList 替代 ScrollView
- 启用 `removeClippedSubviews`
- 优化 `getItemLayout`

---

## 十、参考资料

- [React Native 官方文档](https://reactnative.dev/)
- [React Native 中文网](https://reactnative.cn/)
- 《React Native 精解与实战》
- [RN 原理解析](https://www.jianshu.com/p/a54c0bffc4e5)
- [React Native 跨端通信机制](https://zhuanlan.zhihu.com/p/473710695)
- [RN 性能优化实践](https://supercodepower.com/react-native-performance-js)
- [RN 性能优化-原生侧](https://zhuanlan.zhihu.com/p/530381812)

---

**文档说明**：
- ⭐⭐⭐ 高频考点，必须掌握
- ⭐⭐ 中频考点，建议掌握
- ⭐ 低频考点，了解即可
- 🔥🔥🔥  高难度，需要深入理解
- 🔥🔥 中等难度，需要理解原理
- 🔥 基础难度，理解概念即可
