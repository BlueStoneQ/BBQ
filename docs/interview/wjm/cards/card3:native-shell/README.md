# 🃏 牌 3：Native Shell — 动态化容器

> 命中 JD 第2条（多端架构）+ 第5条（跨端容器 + Hybrid + JSBridge）
>
> 三种动态化容器，统一在"Native Shell"主题下。

→ [cards 总览](../README.md)

---

## 索引

- [TurboModule](./turbo-module/README.md)
- [XRN](./XRN/README.md)
- 容器与 Bridge
  - [H5: WebView + JS Bridge](./container/h5-container/README.md)
  - [RN: 容器](./container/rn-container/README.md)
  - [快应用: J2V8/V8](./container/quickapp-container/README.md)
- [Resume](./resume/quick-app.md)

---

## 1. 三种动态化容器

### me:总结
1. 整体的bridge设计, 都是三段式: JS 侧 - C++ 引擎侧 - Native侧(Android/IOS)
2. 分两个流派:
- RN/快应用 bridge 设计:  js 调用  Native: 都是依赖于 js 引擎 向 js注入 external function来注入native API
- 传统H5 + webview: 这里受限于无法直接拿到webview的js引擎, 所以 不能直接向 Js 注入 external function
- 核心设计: 本质上是序列化的消息传递(“{apiName, params}”), 
  - bridge:js侧, 使用消息队列保证调用(调用消息的发送)的顺序性, Native 用callback ID + result 发送给bridge:js侧
  - bridge:js侧去查Map<callbackid, callback>找到对应的callback, 执行callback(result)

- 补充下: 
  - H5 WebView 流派里，Android 的 @JavascriptInterface 严格来说也是 external function 注入——只不过它注入的是一个对象（上面挂多个方法），不是逐个函数。所以 Android 端其实可以直接调 nativeBridge.getToken() 同步拿结果，本质上还是 external function。
  - 但实际工程中仍然走"统一 callNative 入口 + 消息分发"的模式，原因是：
    1. iOS 做不到同步注入（只有 postMessage），双端需要统一方案
    2. 统一入口方便做权限管控/日志/限流
    3. 动态性：不需要每加一个 API 就改 Native 代码
- 所以最佳实践是这样：即使 Android 技术上能逐个注入，也选择统一入口 + 协议分发，为了跨平台一致性和工程可维护性。

### ① H5 容器：定制 WebView + 高性能 JS Bridge

| 主题 | 文档 |
|------|------|
| H5 WebView JS Bridge 设计 | [h5-js-bridge.md](./container/h5-container/h5-js-bridge.md) |
| WebView 容器定制（池化 + 离线包 + 安全） | [webview.md](./container/h5-container/webview.md) |
| H5 性能优化全景 | [h5-performance.md](./container/h5-container/old/h5-performance.md) |
| 闲时加载原理（idle preload） | [idle-preload.md](./container/h5-container/old/idle-preload.md) |

### ② RN 容器：XRN Shell + TurboModule + JSI + JNI

| 主题 | 文档 |
|------|------|
| XRN 文档目录 | [root: XRN](../../../root/XRN/README.md) |
| Bundle 加载运行 | [bundle-runtime.md](../../../root/XRN/bundle-runtime.md) |
| Native Shell 设计 | [native-shell.md](../../../root/XRN/native-shell.md) |
| 路由设计 | [route.md](../../../root/XRN/route.md) |
| TurboModule / JSI 跨层通信 | [root: card-2](../../../root/cards/card-2/README.md) |

### ③ 快应用容器：J2V8 Bridge

| 主题 | 文档 |
|------|------|
| J2V8 三层穿透设计 | [js-bridge-2.md §3](./container/rn-container/js-bridge-2.md#3-快应用-j2v8-bridge-设计) |
| 快应用平台（完整文档） | [LN/quickapp-platform](../../../LN/quickapp-platform/README.md) |
| 快应用框架（项目经验） | [quickapp-framework](../../../../resume/explain/3.1-xm/quickapp-framework/README.md) |

---

## 横向对比

| 维度 | H5 容器 | RN 容器 | 快应用容器 |
|------|---------|---------|-----------|
| Bridge 方案 | 消息序列化 + callbackId | JSI HostFunction（零序列化） | J2V8 直操作 V8（零序列化） |
| 同步能力 | Android ✅ / iOS ❌ | ✅ | ✅ |
| 性能 | 中等 | 高 | 高 |
| 热更新 | CDN 灰度 | Bundle 热更新 | 包内预装 |
| 适用场景 | 活动页 / 运营页 / 频繁迭代内容 | 核心业务（主流程/付费/社交） | 系统级轻应用 |

---

## 其他资料

- [JS Bridge 三段式设计（三种方案全览）](./container/rn-container/js-bridge-2.md)
- [JS Bridge QA 补充](./container/h5-container/old/qa-js-bridge.md)
- [跨端容器与 Hybrid 架构（场景应答）](./prep-hybrid.md)

---

## Resume 实践

- [快应用框架项目经验](./resume/quick-app.md)
