# QuickApp Framework — Architecture Overview

> 一个 Android 系统级的轻量跨端渲染引擎。前端代码（类 Vue DSL）经编译后，运行时直接渲染为 Native View，无 WebView。

---

## 1. 一句话本质

**JS 逻辑驱动 + Native 渲染**：开发者写 `.ux` 单文件组件，编译成 JS Bundle（rpk 包），运行时在 V8/QuickJS 引擎中执行，通过 Bridge 向 Android 发送渲染指令，由原生 Widget 体系完成屏幕绘制。

---

## 2. 分层架构

```
┌──────────────────────────────────────────────────┐
│              编译工具链 (hap-toolkit)              │
│  .ux → parse5 解析 → template/style/script 分离  │
│  → webpack 打包 → .rpk (zip + 签名)              │
└──────────────────────┬───────────────────────────┘
                       │ 产物: JS Bundle
┌──────────────────────▼───────────────────────────┐
│           JS Framework (V8/QuickJS 线程)          │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Platform │  │ Runtime  │  │     Dock       │  │
│  │ 模块注册 │  │ VDom层   │  │ App/Page 管理  │  │
│  │ 资源加载 │  │ Listener │  │ 生命周期分发   │  │
│  │ Feature  │  │ Streamer │  │ 事件/回调路由  │  │
│  └─────────┘  └──────────┘  └────────────────┘  │
│                       │                           │
│  ┌────────────────────▼──────────────────────┐   │
│  │           DSL Layer (xvm)                 │   │
│  │  MVVM / Observer / Watcher / Compiler     │   │
│  │  模板 → VDom → DOM 操作 → Listener        │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────┘
                       │ callNative (JNI)
                       │ Action[] = [{module:"dom", method:"addElement", args:[...]}]
┌──────────────────────▼───────────────────────────┐
│           Android Native 渲染层                   │
│                                                   │
│  RenderActionManager → IO线程 JSON 解析           │
│  → VDomActionApplier → ComponentFactory           │
│  → Widget 注册表 (tagName → Java Widget class)    │
│  → Android ViewGroup.addView()                    │
│  → Yoga Flexbox 布局计算                          │
│  → 屏幕渲染                                      │
└──────────────────────────────────────────────────┘
```

---

## 3. 各层职责

### 3.1 Platform 层 (`src/infras/platform/`)

| 职责 | 说明 |
|------|------|
| 模块注册 | `registerModules()` 将 Native Feature 注册到 JS 可调用表 |
| 资源加载 | `loadResource(uri)` 通过 `global.readResource` 调用 Native 读取 assets |
| Bundle 管理 | `defineBundle / requireBundle` 延迟加载 parser、canvas、animation 等模块 |
| Native 函数暴露 | `exposeToNative(methodMap)` 将 JS 函数挂到 global 供 Native 直接调用 |

### 3.2 Runtime 层 (`src/infras/runtime/`)

| 职责 | 说明 |
|------|------|
| DOM 抽象 | 轻量级 VDom 实现（Node/Element/TextNode/Event），不依赖浏览器 |
| Listener | 监听 DOM 操作（addNode/removeNode/setProp/setStyle），生成 Action 指令 |
| Streamer | 批量缓冲 Action（阈值 50 条），减少 Bridge 调用次数 |
| 组件注册 | `registerComponents()` 注册可用的 Native 组件类型 |

### 3.3 Dock 层 (`src/infras/dock/`)

| 职责 | 说明 |
|------|------|
| App/Page 生命周期 | createApplication / createPage / destroyPage / changeVisiblePage |
| 事件分发 | processCallbacks 接收 Native 事件（DOM事件 action=1，Feature回调 action=2） |
| Bootstrap | 将框架 API 注册为全局函数，供 Native 端调用 |
| Pubsub 总线 | config 对象作为事件总线，dock 与 DSL 层通过 subscribe/publish 解耦 |

### 3.4 DSL 层 (`src/dsls/xvm/`)

| 职责 | 说明 |
|------|------|
| MVVM | Observer（响应式劫持）→ Watcher（依赖收集）→ 自动更新 |
| 模板编译 | compiler.js 将模板 JSON 编译为 VDom 创建指令 |
| 指令系统 | v-if / v-for / v-show 等指令的运行时处理 |
| 组件体系 | 自定义组件注册、slot 分发、父子通信 |

### 3.5 Android Native 层

| 模块 | 说明 |
|------|------|
| runtime/ | JsBridge、RenderAction 解析、View 树管理 |
| widgets/ | 50+ 原生组件（Text/Image/List/Tabs/Video/Canvas...） |
| features/ | 系统能力封装（网络/存储/设备信息/地理位置/...） |
| Yoga | Facebook 的 Flexbox 布局引擎（C++ → JNI） |

---

## 4. 线程模型

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  JS Thread  │     │  UI Thread   │     │  IO Thread   │
│             │     │              │     │  Pool        │
│ V8 执行所有  │────→│ View 创建    │     │              │
│ JS 代码     │     │ 布局计算     │←────│ JSON 解析    │
│             │     │ 屏幕渲染     │     │ Feature 执行 │
└─────────────┘     └──────────────┘     └──────────────┘
      │                    ▲
      │  callNative        │ Handler.post
      └────────────────────┘
```

- **JS → Native**：同步 JNI 调用（callNative）
- **Native → JS**：通过 Handler 投递到 JS 线程执行（execJSBatch / processCallbacks）

---

## 5. 关键设计决策

| 决策 | 理由 |
|------|------|
| 自建 VDom 而非用浏览器 DOM | 极轻量，只保留渲染所需的最小 API |
| Action 批量发送（Streamer） | 减少 JNI 跨线程调用开销，类似 React 的 batch update |
| Pubsub 解耦 dock 和 DSL | DSL 可替换（xvm/vue），dock 层不依赖具体 DSL 实现 |
| 回调 ID 映射而非函数传递 | JS 函数引用不跨 V8 边界，只传数字 ID + JSON 数据 |
| componentFactory 注册表 | tagName → Widget 类，运行时动态创建，支持插件扩展 |

---

## 6. 代码入口索引

| 你想理解... | 从这里开始读 |
|------------|-------------|
| 框架初始化全流程 | `src/infras/entry/main/index.js` → `initInfras()` |
| App/Page 创建 | `src/infras/dock/interface.js` → `createApplication / createPage` |
| Native 调用路由 | `src/infras/dock/bootstrap.js` → `_registerAppFunc / _registerPageFunc` |
| 渲染指令生成 | `src/infras/runtime/listener.js` → `Listener` 类 |
| 批量消息发送 | `src/infras/runtime/streamer.js` → `Streamer` 类 |
| DSL 如何对接 | `src/dsls/xvm/interface.js` → `init()` 订阅事件 |
| MVVM 响应式 | `src/dsls/xvm/vm/observer.js` + `watcher.js` |
| Feature 模块调用 | `src/infras/platform/module/interface.js` |

---

## 7. 与主流框架的对比定位

| 维度 | QuickApp | React Native | Flutter | 微信小程序 |
|------|----------|-------------|---------|-----------|
| 渲染方式 | JS → Native View | JS → Native View | Dart → Skia 自绘 | WebView + 部分 Native |
| JS 引擎 | V8 / QuickJS | Hermes / JSC | 无（Dart VM） | V8 (Android) |
| 通信机制 | JNI 直调 | JSI (C++) | 无 Bridge | setData + Native |
| DSL | 类 Vue | React JSX | Dart Widget | WXML |
| 布局 | Yoga (Flexbox) | Yoga | 自研 RenderObject | WebView CSS |
| 宿主依赖 | 系统内置 | 需要宿主 App | 需要宿主 App | 微信 App |
