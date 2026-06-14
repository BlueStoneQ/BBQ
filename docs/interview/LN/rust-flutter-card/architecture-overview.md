# QuickApp 动态渲染框架 - 架构说明

## 目录

- [一、框架定位](#一框架定位)
  - [为什么要用 Rust 重写](#为什么要用-rust-重写)
  - [覆盖范围](#覆盖范围)
- [二、分层架构](#二分层架构)
  - [各层职责](#各层职责)
- [三、核心模块职责](#三核心模块职责)
  - [3.1 core_container（引擎核心）](#31-core_container引擎核心)
  - [3.2 runtime/quickapp（快应用运行时）](#32-runtimequickapp快应用运行时)
  - [3.3 backend/（渲染后端）](#33-backend渲染后端)
- [四、两种卡片模式](#四两种卡片模式)
  - [Lite 卡片（轻卡）](#lite-卡片轻卡)
  - [JS 卡片](#js-卡片)
- [五、关键技术选型](#五关键技术选型)
- [六、与原生快应用 SDK 的对比](#六与原生快应用-sdk-的对比)
- [七、代码仓库结构速览](#七代码仓库结构速览)

---

## 一、框架定位

这是一个用 Rust 实现的 **跨平台动态渲染框架**，核心能力是：将 QuickApp（快应用）卡片的 **模板 + 样式 + 数据** 在运行时动态解析并渲染到多种平台（Android、Flutter、Web）。

它的角色等价于快应用原生 Java SDK 中的前端 Vue-like 框架（dsl-xvm.js），但用 Rust 重写，获得跨平台和高性能优势。

### 为什么要用 Rust 重写

原快应用卡片 SDK（Java + JS 实现）有几个核心痛点：

| 痛点 | 原生 Java SDK 的问题 | Rust 重写怎么解 |
|------|---------------------|----------------|
| **只跑 Android** | 整套代码绑死 Android View 系统，iOS/车机/IoT 想用就得全部重写 | Rust 引擎跨平台，换渲染后端即可 |
| **性能不可控** | Java GC + JS 引擎（V8/QuickJS）双层 GC，卡片场景偶发卡顿 | Rust 零 GC，内存确定性分配 |
| **包体积大** | 一个快应用 SDK 十几 MB（包含 V8/Chromium 组件） | Rust .so < 3MB |
| **维护成本高** | Java 端 + JS 端（dsl-xvm.js）两套代码协同维护 | 一套 Rust 统一实现 |
| **卡片是 IoT 关键场景** | 手表/车机/冰箱屏需要轻量卡片，Java SDK 太重跑不动 | Rust 天然适合资源受限设备 |

**业务背景**：快应用要从"仅 Android 手机"扩展到"全设备生态"（手表/车机/IoT 屏/电视），原 Java SDK 无法跨平台复用，需要一个轻量跨平台的渲染引擎做卡片统一渲染。

### 覆盖范围

rust_w3c 不是完整的快应用 SDK，而是其中 **卡片渲染子系统** 的重新实现：

| 能力 | 原生 SDK | rust_w3c |
|------|---------|----------|
| 卡片渲染引擎（Lite + JS 卡） | ✅ | ✅ |
| CSS/布局/响应式/组件/事件 | ✅ | ✅ |
| 多渲染后端 | ❌（仅 Android） | ✅（Flutter/Android/Web） |
| 完整页面路由 | ✅ | ❌（卡片是单页面） |
| 200+ 系统 API | ✅ | ❌（只有 router/message/timer） |
| 打包工具链 / IDE | ✅ | ❌（直接复用原生 rpk 包） |

---

## 二、分层架构

整体分为 4 层，自上而下职责清晰：

```
┌─────────────────────────────────────────────────────────┐
│  应用层：QuickApp 卡片（.rpk 包 = manifest + template + css + js）│
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  运行时层 (runtime/quickapp)                              │
│  模板解析 · 响应式数据 · 组件系统 · JS引擎 · DOM桥接       │
└──────────────────────────┬──────────────────────────────┘
                           │ DomBridge trait (create_element, set_style...)
┌──────────────────────────▼──────────────────────────────┐
│  引擎核心层 (core_container)                              │
│  DOM 树 · CSS 层叠/继承 · Flexbox 布局(Taffy) · 事件系统   │
└──────────────────────────┬──────────────────────────────┘
                           │ FrameUpdate (TreeMutation + NodePatch)
┌──────────────────────────▼──────────────────────────────┐
│  渲染后端层 (backend/)                                    │
│  flutter_backend · android_backend · web_backend          │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  平台层：Flutter Engine / Android View / Browser DOM       │
└─────────────────────────────────────────────────────────┘
```

### 各层职责

| 层级 | 位置 | 核心职责 |
|------|------|---------|
| 运行时层 | `runtime/quickapp/` | 解析 QuickApp DSL，驱动响应式更新 |
| 引擎核心层 | `core_container/` | 平台无关的 W3C DOM + CSS + Layout 引擎 |
| 渲染后端层 | `backend/` | 将布局结果绘制到具体平台 |

---

## 三、核心模块职责

### 3.1 core_container（引擎核心）

纯 Rust 实现的 W3C 子集容器，**不含任何 FFI 和平台代码**：

| 模块 | 文件 | 职责 |
|------|------|------|
| DOM 树 | `dom/mod.rs` | Arena 分配器存储节点，标准 DOM API（createElement、appendChild 等） |
| CSS 引擎 | `css.rs` | 选择器匹配、层叠规则、样式继承 |
| Flexbox 布局 | `layout.rs` | 基于 Taffy 0.7，计算每个节点的 x/y/w/h |
| 事件系统 | `event.rs` | W3C 事件模型（捕获/冒泡阶段） |
| 容器协调 | `container.rs` | 顶层调度：tick 驱动 → 布局 → 生成 FrameUpdate |
| 增量同步 | `shared_update.rs` | FrameUpdate = TreeMutation + NodePatch，供渲染后端消费 |

**关键数据结构：**

```rust
// DOM 节点 (Arena 存储)
pub struct DomNode {
    pub tag_name: Option<String>,
    pub attributes: HashMap<String, String>,
    pub style: CssStyleDeclaration,   // 内联样式
    pub inherited_style: InheritedStyle, // 继承样式
    pub computed_layout: ComputedLayout, // Taffy 计算结果
    pub parent / first_child / next_sibling...  // 链表结构
}

// 帧更新（Rust → 渲染后端的通信载体）
pub struct FrameUpdate {
    pub tree_mutations: Vec<TreeMutation>,  // 新增/删除节点
    pub node_patches: Vec<NodePatch>,       // 属性变更
}
```

### 3.2 runtime/quickapp（快应用运行时）

核心运行时，职责是将 QuickApp 的 DSL 编译产物（JSON template + JSON css）转化为 DOM 操作：

| 模块 | 目录 | 职责 |
|------|------|------|
| 模板解析 | `template_parser/` | JSON 模板 → TemplateNode 树 |
| 渲染引擎 | `render_engine/` | 遍历模板树，通过 DomBridge 创建 DOM 节点 |
| 响应式数据 | `reactive_data/` | dep_map + Watcher：数据变更 → 精确更新对应 DOM |
| CSS 处理 | `css/` | 解析快应用 CSS JSON，注册到 core_container |
| DOM 桥接 | `dom_bridge/` | trait DomBridge 统一接口，隔离线程/跨线程差异 |
| 组件系统 | `component_system/` | 自定义组件的注册、实例化、Props/Slot |
| JS 引擎 | `js_engine/` + `js_thread/` | QuickJS 集成，JS 卡片专用 |

### 3.3 backend/（渲染后端）

消费 core_container 产出的 `FrameUpdate`，在目标平台上绘制：

| 后端 | 渲染方式 | 适用场景 |
|------|---------|---------|
| flutter_backend | Widget 树 + CustomPainter | 跨平台主力 |
| android_backend | JNI + Android View | 原生 Android 集成 |
| web_backend | DOM 绝对定位 | 浏览器预览/调试 |

---

## 四、两种卡片模式

框架支持两种卡片运行模式：

### Lite 卡片（轻卡）

```
外部推送 JSON 数据 → 模板表达式求值 → DOM 增量更新
```

- **无 JS 引擎**，纯 Rust 响应式
- 数据由宿主（如 Android Activity）通过 FFI 推送
- 适用于天气卡片、信息展示等静态场景

### JS 卡片

```
QuickJS 执行 ViewModel → 数据变更 → 模板表达式求值 → DOM 增量更新
```

- **内置 QuickJS 引擎**，独立 JS 线程
- 支持 `data()` / `onInit()` / `onReady()` 生命周期
- 支持 `$watch` / computed 计算属性
- 适用于交互复杂的卡片

---

## 五、关键技术选型

| 领域 | 选型 | 原因 |
|------|------|------|
| 布局引擎 | Taffy 0.7 | Rust 原生 Flexbox，无外部依赖 |
| JS 引擎 | rquickjs (QuickJS) | 轻量嵌入式，适合卡片场景 |
| 跨线程通信 | mpsc channel | Rust 标准库，零拷贝 |
| FFI | C ABI | 最大兼容性 |
| 序列化 | serde_json | Rust 生态标准 |

---

## 六、与原生快应用 SDK 的对比

| 维度 | 原生 Java SDK | Rust 框架 |
|------|--------------|----------|
| 前端框架 | dsl-xvm.js (Vue-like) | runtime/quickapp (Rust) |
| 渲染引擎 | Android View | core_container + 多后端 |
| 布局引擎 | Yoga (C++) | Taffy (Rust) |
| JS 引擎 | V8 / QuickJS | QuickJS (仅 JS 卡片) |
| 跨平台 | 仅 Android | Android / Flutter / Web |
| 性能 | 受 GC / JNI 影响 | 零 GC，直接内存管理 |

---

## 七、代码仓库结构速览

```
rust_w3c/
├── core_container/          # 引擎核心（DOM + CSS + Layout + Event）
│   └── src/
│       ├── dom/             # DOM 树（Arena 分配）
│       ├── css.rs           # CSS 解析与层叠
│       ├── layout.rs        # Taffy Flexbox 布局
│       ├── container.rs     # 顶层容器协调
│       └── shared_update.rs # 增量帧更新
│
├── runtime/
│   ├── common/              # 共享 trait + FFI 宏
│   └── quickapp/            # 快应用运行时
│       └── src/
│           ├── runtime.rs           # 主入口（LiteCardInstance）
│           ├── template_parser/     # 模板解析
│           ├── render_engine/       # 渲染逻辑
│           ├── reactive_data/       # 响应式系统
│           ├── dom_bridge/          # DOM 操作抽象
│           ├── component_system/    # 组件系统
│           ├── js_engine/           # QuickJS 绑定
│           └── js_thread/           # JS 双线程
│
├── backend/
│   ├── flutter_backend/     # Flutter 渲染
│   ├── android_backend/     # Android 渲染
│   └── web_backend/         # Web 渲染
│
└── test/
    └── quickapp_consistency_test/  # 一致性测试
```

---

*下一篇：[runtime-rendering-flow.md](./runtime-rendering-flow.md) — QuickApp 运行时渲染流程详解*
