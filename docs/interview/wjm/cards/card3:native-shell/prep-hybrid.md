# 跨端容器与 Hybrid 架构
> JD 第5条："深入理解 App 宿主环境与 Web 运行时的底层通信机制；精通高性能 JSBridge 协议设计与通道优化，能够通过构建高内聚、低延迟的跨端通信底座，抹平 Native 与 Web 的体验与开发差异；具备将 App 端内开发模式向 Web 生态全面对齐的架构落地经验，实现'一端编写、多端无缝复用'的高效动态化研发体系。"

### 拆解：4 个子能力

| 子能力 | JD 关键词 | 实际含义 | 对应经验 | 准备文档 |
|--------|----------|---------|---------|---------|
| ① JSBridge 协议设计 | "高性能 JSBridge 协议设计与通道优化" | WebView 中 H5 ↔ Native 通信协议 | 快应用 J2V8 同步 Bridge + WebView 容器 JSBridge | [JS Bridge 三段式](./js-bridge-2.md) |
| ② 跨端通信底座 | "高内聚、低延迟的跨端通信底座" | 统一的 Bridge SDK，所有 H5 页面用同一套 API 调 Native | XRN Native Shell + 统一 Bridge 设计 | [JS Bridge 三段式](./js-bridge-2.md) |
| ③ 端内 Web 对齐 | "App 端内开发模式向 Web 生态全面对齐" | H5 开发者在 App 内获得接近 Native 的体验（离线包、预加载、Bridge 能力） | WebView 容器定制（池化+离线包+预请求） | [WebView 容器优化](./qa-webview.md) |
| ④ 动态化体系 | "一端编写、多端无缝复用" | RN 热更新 + H5 动态下发 + 配置化 | XRN 多 Bundle 热更新 + 离线包体系 | [XRN 多 Bundle](../../root/XRN/qa.md) |

### 他们可能的技术架构

```
App
├── Native Shell（Android/iOS 壳）
├── RN 页面（核心业务：主流程、付费、社交）
├── H5 WebView 页面（运营活动、游戏化互动、频繁迭代的内容）
└── 统一 Bridge 层
    ├── RN Bridge（JSI / TurboModule）
    └── WebView Bridge（@JavascriptInterface / messageHandlers）
```

### 为什么不全用 RN

- 游戏化互动页更新极频繁 → H5 随时上线，不走发版
- 活动运营页生命周期短 → 不值得写 RN
- 某些动画/互动用 Canvas/WebGL 更合适 → H5 + WebView
- "向 Web 生态对齐" → 说明 H5 占比不小，需要定制 WebView 容器




### QA 补充

#### Q: "高性能 JSBridge 协议设计"具体指什么？

不是黑科技，而是**避免低性能设计**：

| 低性能设计 | 高性能设计 | 为什么 |
|-----------|-----------|--------|
| 每次 JSON.stringify 整个参数 | 精简协议字段 + 只传必要数据 | 减少序列化开销 |
| 每次创建 iframe（URL Scheme） | 注入 API 直调（@JavascriptInterface） | 避免 DOM 操作 |
| 每个回调独立通信 | 批处理（多个调用合并一次） | 减少通信次数 |
| 全异步 | 同步方法直接返回 | 减少回调链 |
| 无缓存 | 高频调用结果缓存 | 减少重复通信 |

**最佳实践 = 注入 API + 精简协议 + 批处理 + 同步优先**

#### Q: ①②本质都是 JS Bridge 建设？

对。区别：
- ① **技术层**：Bridge 通信通道本身怎么设计（协议格式、通信方式、性能）
- ② **工程层**：封装成统一 SDK，所有页面（RN/H5）用同一套 API

```
① = 底层管道怎么修
② = 管道上面建统一的水龙头接口，所有业务接同一个水龙头
```

#### Q: WebView H5 + RN 都在一起，需要统一 Native 路由底座？

**必须。** 路由系统要能统一管理三种页面类型：

```
用户点击跳转 → 路由系统判断目标：
  myapp://rn/home           → RN 页面（加载对应 Bundle）
  myapp://web/activity/123  → WebView H5（打开 WebView 加载 URL）
  myapp://native/settings   → Native 页面（跳转 Activity/VC）
```

本质和 XRN 的两段式 URL 路由设计相同。

#### Q: 他们会引入 Unity 吗？

**大概率不会。**

| 因素 | 分析 |
|------|------|
| 团队规模 | 30 人，养不起 Unity 团队 |
| JD 没提 | 没提 C#/Unity/游戏引擎 |
| "游戏化互动" ≠ "游戏" | 指抽卡/转盘/宝箱/积分任务 → H5 Canvas/Lottie 就够 |
| 包体 | Unity 集成 APK +30MB |

**他们的"游戏化互动"更可能是**：Lottie 动画 + Canvas 2D / PixiJS + CSS 动画，跑在 WebView 中。

#### Q: 快应用那套是最佳实践？H5 WebView 也能注入 external function？

**对，WebView 的 `@JavascriptInterface` 本质就是 external function 注入。**

Android WebView 底层是 Chromium（V8），`addJavascriptInterface` 就是让 V8 把 Java 方法注册为 JS 全局函数。和快应用 J2V8 的 `registerJavaMethod` 本质相同。

**区别在于控制粒度**：

| | 快应用 J2V8（直接持有引擎） | WebView @JavascriptInterface（间接） |
|--|------------|------------------------------|
| 引擎访问 | 你直接持有 V8 实例，完全控制 | 引擎在 WebView 内部，只能通过 WebView API 间接操作 |
| 注入方式 | `registerJavaMethod()`（单个方法） | `addJavascriptInterface(obj, name)`（整个对象） |
| 同步能力 | ✅ 完全同步 | ✅ Android 同步 / ❌ iOS 异步 |
| 性能 | 更高（无中间层） | 稍低（经过 WebView 容器层） |

**同步能力的意思**：JS 调用 Native 方法后，能不能**直接拿到返回值**（而不是等回调）。
```javascript
// 同步：直接返回值，像调普通函数
const token = nativeBridge.getToken();  // ← 立即拿到结果

// 异步：通过回调/Promise 拿结果
nativeBridge.getToken((token) => { /* 等一会才拿到 */ });
```
- Android `@JavascriptInterface`：同步，因为 JS 和 Java 在同一进程，函数调用直接返回
- iOS `messageHandlers.postMessage`：异步，因为 WKWebView 的 JS 跑在独立进程，跨进程通信必须异步

**结论**：快应用 J2V8 是"直接操作引擎"的最佳实践；WebView 场景下用 `@JavascriptInterface` 是能做到的最优解（等价于 external function 注入，只是控制力弱一些）。

#### Q: "统一 Bridge SDK"具体怎么统一？依赖 C++ 层吗？

**统一的意思 = Native 封装一套 API，在 RN 侧和 H5 侧暴露相同的接口。**

```javascript
// RN 侧调用（通过 TurboModule / JSI）
const token = NativeAuth.getToken();

// H5 侧调用（通过 WebView Bridge）
const token = jsBridge.callNative('auth', 'getToken');

// 两边 JS 用法可以不完全一样，但底层调的是同一个 Native 实现
```

**不一定依赖 C++ 层**，取决于架构：

```
方案 A：各自注入，共享 Native 实现（常见，简单）
┌──────────────────────────────────────────────┐
│ Native 层：统一的模块实现（AuthModule.kt）      │
├──────────────────────────────────────────────┤
│ RN 注入路径：JSI → C++ → JNI → AuthModule    │
│ H5 注入路径：@JavascriptInterface → AuthModule │
└──────────────────────────────────────────────┘
两条路径最终调的是同一个 AuthModule，但注入通道不同。
C++ 层只有 RN 那条路需要。

方案 B：统一 C++ 层注入（更极致但复杂度高）
┌──────────────────────────────────────────────┐
│ C++ 统一 Bridge 层                             │
│ → 同时注入到 RN 的 JSI 和 WebView 的 V8      │
└──────────────────────────────────────────────┘
理论可行（WebView 底层也是 V8），但实际没人这么做——
因为 WebView 不开放底层引擎 API，你只能用 addJavascriptInterface。
```

**实际业界做法 = 方案 A**：
- Native 层写一份模块实现
- RN 通过 TurboModule 暴露
- H5 通过 WebView Bridge 暴露
- JS 侧再封装一个统一的 SDK 包，抹平两条路径的 API 差异

```
统一的 JS SDK：
  import { getToken } from '@myapp/bridge';
  // 内部判断运行环境：
  //   if (isRN) → 调 TurboModule
  //   if (isWebView) → 调 jsBridge.callNative
```
