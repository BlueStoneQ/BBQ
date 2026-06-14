# aria-render — 技术设计文档

## 目录

- [一、架构总览](#一架构总览)
- [二、分层设计](#二分层设计)
  - [2.1 协议层 (Protocol)](#21-协议层-protocol)
  - [2.2 引擎层 (Engine)](#22-引擎层-engine)
  - [2.3 渲染层 (Renderer)](#23-渲染层-renderer)
- [三、核心数据流](#三核心数据流)
  - [3.1 首次渲染流程](#31-首次渲染流程)
  - [3.2 增量更新流程](#32-增量更新流程)
  - [3.3 事件上行流程](#33-事件上行流程)
- [四、关键数据结构](#四关键数据结构)
  - [4.1 DSL JSON 协议](#41-dsl-json-协议)
  - [4.2 节点树 (NodeTree)](#42-节点树-nodetree)
  - [4.3 FrameUpdate 增量协议](#43-frameupdate-增量协议)
- [五、响应式系统设计](#五响应式系统设计)
- [六、FFI 边界设计](#六ffi-边界设计)
- [七、技术选型与 Trade-off](#七技术选型与-trade-off)
- [八、目录结构](#八目录结构)

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────┐
│  协议层：JSON DSL（卡片描述 + 样式 + 数据绑定）            │
└──────────────────────────┬──────────────────────────────┘
                           │ JSON string
┌──────────────────────────▼──────────────────────────────┐
│  引擎层 (Rust)                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Parser  │→│  Layout  │→│ Reactive │→│ Diff/Patch│  │
│  │(JSON→Tree)│ │(Taffy)   │ │(Watcher) │ │(FrameUpd) │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ FrameUpdate (FFI / C ABI)
┌──────────────────────────▼──────────────────────────────┐
│  渲染层 (Flutter/Dart)                                    │
│  FFI Binding → Widget Builder → 增量 setState            │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  平台层：Android / Linux Desktop / (future: embedded)     │
└─────────────────────────────────────────────────────────┘
```

设计原则：
- **引擎层完全平台无关**，纯 Rust，无 std::fs / std::net 依赖
- **渲染层可替换**，通过 FrameUpdate 协议解耦
- **协议层是契约**，引擎和渲染层通过它通信

---

## 二、分层设计

### 2.1 协议层 (Protocol)

定义 JSON DSL 格式，描述：
- 节点结构（嵌套布局）
- 样式（inline style）
- 数据绑定表达式（`{{variable}}`）
- 指令（`$if` / `$for` / `$show`）

不负责解析和执行，只是契约定义。

### 2.2 引擎层 (Engine)

Rust 实现，职责分 4 个模块：

| 模块 | 职责 | 输入 → 输出 |
|------|------|------------|
| Parser | JSON → NodeTree | JSON string → Vec<Node> |
| Layout | Flexbox 计算 | NodeTree → 每个节点的 x/y/w/h |
| Reactive | 数据绑定 + diff | old_data + new_data → dirty_nodes |
| Patch | 生成增量更新 | dirty_nodes → FrameUpdate |

**不直接操作任何 UI**，只产出 FrameUpdate 数据。

### 2.3 渲染层 (Renderer)

Flutter/Dart 实现，职责：
- 通过 Dart FFI 加载 Rust .so
- 调用引擎 API（init / render / push_data）
- 消费 FrameUpdate → 构建/更新 Widget 树
- 事件收集 → 回传引擎

---

## 三、核心数据流

### 3.1 首次渲染流程

```
App 启动
  → Dart 调用 FFI: engine_init()
  → Dart 调用 FFI: engine_load_card(json_str)
    → Rust: Parser 解析 JSON → NodeTree
    → Rust: Layout 计算 Flexbox → 每个节点 x/y/w/h
    → Rust: 生成初始 FrameUpdate（全量 NodeAdded）
  → Dart 读取 FrameUpdate
  → Dart: 构建 Widget 树 → 渲染首帧
```

### 3.2 增量更新流程

```
新数据到达（网络/本地）
  → Dart 调用 FFI: engine_push_data(new_json)
    → Rust: json_diff(old, new) → changed_fields
    → Rust: 查询 dep_map → dirty_watchers
    → Rust: 执行 watchers → 更新节点属性
    → Rust: 重新布局（仅 dirty 子树）
    → Rust: 生成 FrameUpdate（仅 NodePatch）
  → Dart 读取 FrameUpdate
  → Dart: 增量更新对应 Widget → setState
```

### 3.3 事件上行流程

```
用户点击
  → Flutter GestureDetector 捕获
  → Dart 调用 FFI: engine_dispatch_event(node_id, "tap")
    → Rust: EventRouter 查找 handler
    → Rust: 执行 action（修改数据 / 产出命令）
    → Rust: 触发响应式更新（同 3.2）
  → Dart 读取 FrameUpdate → 更新 UI
```

---

## 四、关键数据结构

### 4.1 DSL JSON 协议

```json
{
  "version": "1.0",
  "data": {
    "title": "天气卡片",
    "temp": "26°C",
    "items": [
      { "city": "北京", "weather": "晴" },
      { "city": "上海", "weather": "多云" }
    ]
  },
  "template": {
    "type": "column",
    "style": { "padding": "16px", "background": "#ffffff" },
    "children": [
      {
        "type": "text",
        "props": { "content": "{{title}}" },
        "style": { "fontSize": "24px", "color": "#333333" }
      },
      {
        "type": "text",
        "props": { "content": "{{temp}}" },
        "style": { "fontSize": "48px", "fontWeight": "bold" }
      },
      {
        "type": "column",
        "$for": { "source": "items", "item": "item" },
        "children": [
          {
            "type": "row",
            "style": { "justifyContent": "space-between" },
            "children": [
              { "type": "text", "props": { "content": "{{item.city}}" } },
              { "type": "text", "props": { "content": "{{item.weather}}" } }
            ]
          }
        ]
      }
    ]
  }
}
```

### 4.2 节点树 (NodeTree)

```rust
pub struct RenderNode {
    pub id: u32,
    pub node_type: NodeType,       // Column / Row / Text / Image
    pub style: StyleProps,          // Flexbox + 视觉属性
    pub props: HashMap<String, PropValue>,  // 静态值或表达式
    pub children: Vec<u32>,         // 子节点 ID 列表
    pub layout: ComputedLayout,     // Taffy 计算结果
}

pub enum PropValue {
    Static(String),                 // 静态值
    Expression(String),             // {{expr}} 动态绑定
}

pub struct ComputedLayout {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}
```

### 4.3 FrameUpdate 增量协议

```rust
pub struct FrameUpdate {
    pub mutations: Vec<Mutation>,
    pub patches: Vec<NodePatch>,
}

pub enum Mutation {
    NodeAdded { parent_id: u32, node_id: u32, index: u32, snapshot: NodeSnapshot },
    NodeRemoved { parent_id: u32, node_id: u32 },
}

pub struct NodePatch {
    pub node_id: u32,
    pub changed: u32,           // bitmap: 哪些字段变了
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub background_color: u32,  // ARGB
    pub text_content: String,
    // ... 其他可变字段
}
```

Flutter 侧消费 FrameUpdate 的逻辑：
```dart
void applyUpdate(FrameUpdate update) {
  for (var mutation in update.mutations) {
    if (mutation is NodeAdded) {
      _nodeMap[mutation.nodeId] = buildWidget(mutation.snapshot);
    } else if (mutation is NodeRemoved) {
      _nodeMap.remove(mutation.nodeId);
    }
  }
  for (var patch in update.patches) {
    _nodeMap[patch.nodeId]?.applyPatch(patch);
  }
  setState(() {});
}
```

---

## 五、响应式系统设计

精简版响应式，只做数据 → DOM 的单向绑定：

```
                    注册阶段（首次渲染）
                    ┌─────────────────────┐
                    │  表达式 "{{title}}"   │
                    │  依赖路径: ["title"]  │
                    │  目标: node#3.text    │
                    └──────────┬──────────┘
                               │ 注册到 dep_map
                               ▼
┌───────────────────────────────────────────────────┐
│  dep_map: HashMap<path, Vec<WatcherId>>           │
│  "title" → [Watcher#1]                           │
│  "items" → [Watcher#2 (ForWatcher)]              │
└───────────────────────────────────────────────────┘

                    更新阶段（push_data）
                    ┌─────────────────────┐
                    │ json_diff → ["title"]│
                    └──────────┬──────────┘
                               │ 查询 dep_map
                               ▼
                    ┌─────────────────────┐
                    │ Watcher#1 触发       │
                    │ 重新求值 → "新标题"   │
                    │ patch node#3.text    │
                    └─────────────────────┘
```

**不做的事情：**
- 不做双向绑定
- 不做 computed / watch 链式依赖
- 不做 Virtual DOM diff（直接 Watcher → patch）

---

## 六、FFI 边界设计

Dart ↔ Rust 通过 C ABI 通信，接口极简：

```rust
// Rust 侧导出
#[no_mangle]
pub extern "C" fn aria_init() -> *mut AriaEngine;

#[no_mangle]
pub extern "C" fn aria_load_card(
    engine: *mut AriaEngine,
    json_ptr: *const u8, json_len: usize
) -> i32;  // 0=success, <0=error

#[no_mangle]
pub extern "C" fn aria_push_data(
    engine: *mut AriaEngine,
    json_ptr: *const u8, json_len: usize
) -> i32;

#[no_mangle]
pub extern "C" fn aria_get_frame_update(
    engine: *mut AriaEngine,
    out_ptr: *mut *const u8, out_len: *mut usize
) -> i32;

#[no_mangle]
pub extern "C" fn aria_dispatch_event(
    engine: *mut AriaEngine,
    node_id: u32,
    event_type_ptr: *const u8, event_type_len: usize
) -> i32;

#[no_mangle]
pub extern "C" fn aria_destroy(engine: *mut AriaEngine);
```

FrameUpdate 通过序列化（JSON 或自定义二进制）跨 FFI 传递。MVP 用 JSON 序列化，后续优化为 flatbuffer。

---

## 七、技术选型与 Trade-off

| 决策点 | 选择 | 备选 | 为什么 |
|--------|------|------|--------|
| 引擎语言 | Rust | C++ / Go | 零 GC + 内存安全 + FFI 友好 + 跨平台编译 |
| 布局引擎 | Taffy 0.7 | Yoga / 手写 | 纯 Rust、无 C++ 依赖、Flexbox 完整 |
| 渲染层 | Flutter | SwiftUI / Compose | 跨平台（Android + Desktop + 未来 embedded） |
| FFI 方式 | Dart FFI (dart:ffi) | Platform Channel | 零拷贝、低延迟、适合频繁调用 |
| 协议格式 | JSON | Protobuf / FlatBuffer | MVP 阶段可读性优先；后续可换 |
| 响应式 | 单向 Watcher | Virtual DOM diff | 更轻量，无中间层开销，适合受限设备 |

### 对比 Server-Driven UI 方案

| 方案 | 优势 | 劣势 | 适用 |
|------|------|------|------|
| aria-render (本方案) | Rust 高性能、跨平台、协议灵活 | 生态小、需自建 | 受限设备、自定义协议场景 |
| Flutter ServerPod | 社区方案 | 性能一般、不适合嵌入式 | 标准 App |
| Airbnb Epoxy / Server-Driven | 成熟 | 仅 Android/iOS，重 | 大厂 App |
| React Native + Hermes | JS 生态大 | 有 GC、包体大 | 通用场景 |

---

## 八、目录结构

```
aria-render/
├── protocol/                    # 协议定义
│   ├── schema.json              # JSON Schema
│   └── examples/                # 示例卡片
│       ├── weather-card.json
│       ├── music-player.json
│       └── notification.json
│
├── engine/                      # Rust 引擎
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs               # FFI 导出 + crate 入口
│       ├── parser.rs            # JSON → NodeTree
│       ├── style.rs             # 样式解析 (CSS-like props)
│       ├── layout.rs            # Taffy Flexbox 封装
│       ├── reactive.rs          # dep_map + Watcher + diff
│       ├── update.rs            # FrameUpdate 生成 + 序列化
│       ├── event.rs             # 事件路由
│       └── types.rs             # 公共类型定义
│
├── flutter_app/                 # Flutter Demo App
│   ├── pubspec.yaml
│   ├── native/                  # .so 放置 + build 脚本
│   └── lib/
│       ├── main.dart
│       ├── ffi/                 # Dart FFI 绑定
│       │   └── aria_bindings.dart
│       ├── renderer/            # FrameUpdate → Widget
│       │   ├── aria_renderer.dart
│       │   └── node_widget.dart
│       └── pages/               # Demo 页面
│           ├── card_gallery.dart
│           └── hot_reload_demo.dart
│
├── docs/
│   ├── architecture.md          # 架构文档（对外展示）
│   ├── protocol-spec.md         # 协议规范
│   └── design-decisions.md      # 设计决策
│
├── README.md
└── LICENSE (MIT)
```
