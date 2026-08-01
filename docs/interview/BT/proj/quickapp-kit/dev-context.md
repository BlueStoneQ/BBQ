# QuickApp Kit 项目上下文

## 目录

- [这是什么](#这是什么)
- [输入](#输入)
- [架构](#架构)
- [C++ 基座核心组件](#c-基座核心组件)
- [平台项目](#平台项目)
- [核心数据流](#核心数据流)
- [兼容目标](#兼容目标)
- [开发策略](#开发策略)
- [各项目 Agent 职责边界](#各项目-agent-职责边界)
- [关键设计决策](#关键设计决策)

---

## 这是什么

一套多平台快应用运行时框架。兼容现有快应用 DSL 和核心 API，以 C++ 作为跨平台基座，对接不同平台的渲染端。

## 输入

标准快应用 RPK 包（ZIP 格式），由现有工具链从 `.ux` DSL 编译产出：

```text
quickapp-kit/quickapp-examples/quickapp-code-test1/dist/
├── com.example.case1.debug.1.0.0.rpk
└── com.example.case1.release.development.1.0.0.rpk
```

RPK 内部结构：

```text
RPK (ZIP)
├── manifest.json        ← 路由、display、features、permissions
├── app.js               ← 应用级 JS bundle
├── pages/
│   ├── Demo/index.js    ← 页面 bundle（template + style + VM 已编译为 JS 对象）
│   └── DemoDetail/index.js
└── assets/              ← 静态资源
```

Runtime 不需要编译器，只消费已编译产物。

## 架构

```text
┌─────────────────────────────────────────────────┐
│               应用层 (Application)               │
│          QuickApp RPK (.ux → 编译 → RPK)        │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│             JS 引擎层 (JS Engine)                │
│       QuickJS / framework.js / page bundles     │
└────────────────────────┬────────────────────────┘
                         │ JS Bridge（零序列化）
┌────────────────────────▼────────────────────────┐
│            C++ Runtime Core（跨平台共享）         │
│  Router · VNode · StyleResolver · Yoga · EventLoop │
│              Render Pipeline                     │
└────────────────────────┬────────────────────────┘
                         │ PlatformBridge
┌────────────────────────▼────────────────────────┐
│              平台层 (Platform)                    │
│   Android View │ iOS/UIKit │ C++/LVGL（嵌入式）  │
└─────────────────────────────────────────────────┘
```

## C++ 基座核心组件

| 组件 | 职责 |
|---|---|
| QuickJS | JS 执行引擎 |
| JS Bridge | JS ↔ C++ 零序列化直调 |
| RuntimeEventLoop (libuv) | 任务调度、Timer、异步完成 |
| Router | C++ Page Stack，页面切换 |
| VNode + StyleResolver | 模板树 → 样式合并 |
| Yoga | Flexbox 布局计算 |
| RPKLoader | ZIP 解压、Manifest 解析 |
| PlatformBridge | C++ → 平台渲染/能力通道 |

## 平台项目

```text
quickapp-kit/
├── quickapp-runtime-core/       ← C++ 跨平台核心库（从 Android 验证后抽取）
├── quickapp-runtime-android/    ← Android 平台：JNI + Kotlin + Android View
├── quickapp-runtime-ios/        ← iOS 平台：Objective-C++ + UIKit
├── quickapp-runtime-cpp/        ← 嵌入式平台：纯 C++ + LVGL 渲染
├── quickapp-runtime-js/         ← JS Framework（framework.js）
├── quickapp-toolkit/            ← CLI 工具链：DSL → 编译 → RPK 打包
└── quickapp-examples/           ← 示例快应用（DSL 源码 + 编译产物）
```

## 核心数据流

```text
RPK → RPKLoader → manifest + app.js + page bundles
    → QuickJS eval(app.js) → eval(page bundle)
    → $app_define$ + $app_bootstrap$
    → framework.js 创建 VM → onInit / onShow
    → __native_render__(template, style)
    → C++ VNode → StyleResolver → Yoga
    → RenderCommand → PlatformBridge
    → 平台 ViewRenderer → 原生 UI
```

## 兼容目标

- 标准快应用 DSL（.ux + manifest.json）
- 现有 system.router / system.prompt / 生命周期 / 事件语义
- Debug 和 Release RPK 均可运行
- V1 兼容现有 API；V2 增加 Promise/EventEmitter/能力发现

## 开发策略

1. **Android NDK 优先** — 先在 Android 上跑通完整链路
2. **Core 抽取** — 验证后将跨平台 C++ 代码独立为 quickapp-runtime-core
3. **多端复用** — iOS/LVGL 各自实现 PlatformBridge，复用同一套 Core
4. **Toolkit 独立** — CLI 工具链独立项目，负责 DSL → RPK 编译打包

## 各项目 Agent 职责边界

| 项目 | 语言 | Agent 负责范围 |
|---|---|---|
| quickapp-runtime-android | C++ / Kotlin | NDK + JNI + Android View + 首个完整链路验证 |
| quickapp-runtime-core | C++ | 跨平台核心库抽取（Phase 4 后） |
| quickapp-runtime-ios | C++ / ObjC / Swift | iOS PlatformBridge + UIKit ViewRenderer |
| quickapp-runtime-cpp | C++ | LVGL PlatformBridge + LVGL Widget Renderer |
| quickapp-runtime-js | JavaScript | framework.js / VM 模型 / 页面启动逻辑 |
| quickapp-toolkit | Node.js / TypeScript | DSL 编译、RPK 打包、CLI 命令 |

## 关键设计决策

1. **PlatformBridge 是跨平台通信通道** — Core 通过函数指针发送渲染指令，各平台各自实现
2. **JS Bridge 和 PlatformBridge 独立** — JS ↔ C++ 和 C++ → Platform 是两条不同通道
3. **Android → C++ 事件走独立通道** — 不和渲染指令混用
4. **Runtime 不包含编译器** — 只消费 RPK 产物，不解析 .ux / CSS / webpack
5. **单线程 Runtime + UI Dispatcher** — QuickJS 和 Core 在 Runtime Thread，View 操作投递到 UI Thread
