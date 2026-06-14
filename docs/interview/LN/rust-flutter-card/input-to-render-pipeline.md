# 从 Input 到渲染：一张卡片的完整生命周期

## 目录

- [一、Input 是什么](#一input-是什么)
  - [1.1 四份 JSON 从哪来](#11-四份-json-从哪来)
  - [1.2 manifest.json](#12-manifestjson)
  - [1.3 template.json](#13-templatejson)
  - [1.4 style.json](#14-stylejson)
  - [1.5 ui_data.json](#15-ui_datajson)
- [二、一次 FFI 调用启动一切](#二一次-ffi-调用启动一切)
- [三、Rust 引擎内部做了什么](#三rust-引擎内部做了什么)
- [四、Output 长什么样](#四output-长什么样)
- [五、Flutter 拿到 Output 后怎么画](#五flutter-拿到-output-后怎么画)
- [六、数据更新时怎么刷新](#六数据更新时怎么刷新)
- [七、完整时间线](#七完整时间线)

---

## 一、Input 是什么

Rust 引擎的 input 就是 **4 份 JSON 字符串**，通过一次 FFI 调用传入：

```
┌─────────────────────────────────────────────┐
│  .rpk 卡片包（zip 格式）                      │
│                                             │
│  ├── manifest.json   → "我是谁、多宽"        │
│  ├── template.json   → "UI 结构"            │
│  ├── style.json      → "怎么画"             │
│  └── index.js        → "逻辑"（JS 卡片才有）  │
│                                             │
└─────────────────────────────────────────────┘
         +
┌─────────────────────────────────────────────┐
│  宿主推送的数据                               │
│  ui_data.json → "当前温度=26°C, 城市=深圳"    │
└─────────────────────────────────────────────┘
```

### 1.1 四份 JSON 从哪来

```
开发者写 .ux 文件（类 Vue 单文件组件）
    │
    │  快应用官方编译工具（hap-toolkit）
    ▼
.rpk 包 = zip { manifest.json + template.json + style.json + index.js }
    │
    │  宿主 App 解压
    ▼
四份 JSON 字符串 → 传给 Rust 引擎
```

### 1.2 manifest.json

"这张卡片的身份证"：

```json
{
  "package": "com.example.weather",
  "config": { "designWidth": 750 },
  "router": {
    "widgets": {
      "cards/weatherCard": {
        "name": "weatherCard",
        "type": "lite"
      }
    }
  }
}
```

引擎从中提取：包名、卡片类型（lite/js）、designWidth（适配基准宽度）。

### 1.3 template.json

"UI 长什么结构"（编译后的 JSON 树，不是 HTML）：

```json
{
  "#entry": {
    "type": "div",
    "attr": { "class": "container" },
    "children": [
      {
        "type": "text",
        "attr": { "value": "{{city}} · {{title}}" }
      },
      {
        "type": "text",
        "attr": { "value": "{{temp}}" },
        "classList": ["big-text"]
      },
      {
        "type": "div",
        "repeat": { "exp": "forecast", "item": "day" },
        "children": [
          { "type": "text", "attr": { "value": "{{day.name}} {{day.weather}}" } }
        ]
      }
    ]
  }
}
```

关键点：
- `{{expr}}` = 数据绑定表达式
- `repeat` = $for 循环指令
- 类型是快应用组件名（div/text/image/stack/list），不是 HTML 标签

### 1.4 style.json

"每个组件怎么画"（CSS 规则的 JSON 格式）：

```json
{
  ".container": {
    "padding": "20px",
    "backgroundColor": "#ffffff",
    "flexDirection": "column"
  },
  ".big-text": {
    "fontSize": "60px",
    "fontWeight": "bold",
    "color": "#FF6600"
  }
}
```

和 CSS 完全对应，只是换成了 JSON key-value 格式。

### 1.5 ui_data.json

"当前的数据快照"（由宿主 App 或 JS ViewModel 提供）：

```json
{
  "city": "深圳",
  "title": "今日天气",
  "temp": "26°C",
  "forecast": [
    { "name": "周一", "weather": "晴" },
    { "name": "周二", "weather": "多云" }
  ]
}
```

---

## 二、一次 FFI 调用启动一切

### 卡片渲染引擎只做三件事

不管是快应用桌面卡片还是 AR 眼镜技能卡片，渲染引擎的全部行为就是：

| # | 核心事件 | 引擎做什么 | 对应 FFI |
|---|---------|-----------|---------|
| 1 | **初次渲染** | JSON → 解析 → 布局 → 画出来 | `quickapp_open_card()` |
| 2 | **数据更新** | 新数据 → diff → Watcher → 局部刷新 | `quickapp_push_ui_data()` |
| 3 | **交互** | 用户操作 → 事件路由 → 产出动作 | `enqueue_event_message()` |

交互支持的事件类型：

| 事件 | 支持 | 典型场景 |
|------|------|---------|
| tap（点击） | ✅ 主力 | 点击卡片 → 跳转 App |
| longpress | ✅ | 长按 → 弹出菜单 |
| swiper 滑动 | ✅ 组件内 | 轮播切换 |
| list 滚动 | ✅ 组件内 | 列表上下滚 |
| input 输入 | ✅ 表单 | 搜索框输入 |
| 拖拽/缩放 | ❌ | 卡片不做复杂手势（避免和系统手势冲突） |

> **设计哲学**：卡片是轻交互 —— 嵌在系统 UI（桌面/负一屏/AR 视野）中，主要展示信息 + 简单点击。复杂交互留给 App 本身。

### 启动渲染

宿主（Flutter/Android）只需要调一个函数：

```rust
// C ABI（Dart/Kotlin 都能调）
quickapp_open_card(
    handle,           // 引擎句柄
    manifest_json,    // 4 份 JSON
    template_json,
    css_json,
    ui_data_json,
)
```

调完这个函数后，引擎内部自动完成：解析 → 渲染 → 布局 → 产出首帧。

---

## 三、Rust 引擎内部做了什么

```
quickapp_open_card() 内部流程：

1. 解析 manifest → WidgetInfo { type=lite, designWidth=750 }

2. 解析 CSS JSON → RegisteredRule[] → 注册到 DomTree.css_rules

3. 解析 template JSON → TemplateNode 树

4. 首次渲染 render_template_with_data():
   遍历 TemplateNode 树：
     ├── create_element("div")  → DomTree 新增节点
     ├── set_style("padding", "20px")
     ├── 求值 "{{city}} · {{title}}" → "深圳 · 今日天气"
     ├── create_text_node("深圳 · 今日天气")
     ├── 注册 Watcher: "city" 变了 → 更新这个 text 节点
     ├── 遍历 repeat: forecast 数组 → 每项创建子节点
     └── 注册事件绑定 → EventRouter

5. Taffy 布局计算：
   DomTree → sync_from_dom → Taffy Style 树
   compute_layout(viewport_w, viewport_h)
   结果写回每个节点的 computed_layout { x, y, w, h }

6. 产出 FrameUpdate（首帧 = 全量 NodeAdded）：
   每个节点 → TreeMutation::NodeAdded {
     node_id, parent_id, x, y, w, h,
     background_color, font_size, text_content, img_src, ...
   }

7. FrameUpdate 写入 SharedUpdateBuffer → 等待渲染后端消费
```

---

## 四、Output 长什么样

Rust 引擎产出的是 `FrameUpdate`，一个描述"这一帧画面变了什么"的数据结构：

### FrameUpdate 数据结构

```rust
/// 一帧的增量更新
pub struct FrameUpdate {
    pub tree_mutations: Vec<TreeMutation>,  // 结构变化（新增/删除/文字变化）
    pub node_patches: Vec<NodePatch>,       // 属性变化（位置/颜色/字号...）
}

/// 结构变化类型
pub enum TreeMutation {
    NodeAdded {
        parent_id: usize,       // 父节点的 Arena 编号（DomTree 里的下标）
        child_id: usize,        // 新节点的 Arena 编号
        index: usize,           // 在父节点的第几个子节点位置
        entry: LayoutSnapshot,  // 该节点的完整快照（见下方）
        tag_name: String,       // "div" / "text" / "img"
        node_type: u8,          // 1=Element, 3=Text
        img_src: String,        // <img> 的 src（其他标签为空）
    },
    NodeRemoved {
        parent_id: usize,       // 从哪个父节点移除
        child_id: usize,        // 被移除节点的编号
    },
    TextChanged {
        node_id: usize,         // 文字变化的节点编号
        text: String,           // 新文字内容
    },
}

/// 属性增量变化（bitmap 标记哪些字段变了）
pub struct NodePatch {
    pub node_id: usize,         // 哪个节点
    pub changed_fields: u32,    // 位图：哪些字段变了
    pub rel_x: f32,             // 相对父节点的 x 偏移
    pub rel_y: f32,             // 相对父节点的 y 偏移
    pub width: f32,             // 节点宽度
    pub height: f32,            // 节点高度
    pub background_color: u32,  // 背景色 ARGB
    pub font_size: f32,         // 字号(px)
    pub color: u32,             // 文字颜色 ARGB
    pub opacity: f32,           // 透明度 0.0-1.0
    pub border_radius: [f32;4], // 四角圆角
    // ... 更多字段（bitmap 为 0 的字段不传）
}
```

### 节点编号说明

所有 parent_id / child_id / node_id 都是 **DomTree Arena 的下标**（从 0 开始递增）：

```
Arena:  [doc#0] [html#1] [body#2] [卡片root#3] [text#4] [text#5] [div#6] [text#7] [text#8]
```

编号是全局唯一的，一旦分配不会变（除非节点被删除后回收）。Flutter 侧用这个编号作为 Widget 的 key，保证增量更新对得上。

### 首帧输出示例

```
FrameUpdate {
  tree_mutations: [
    NodeAdded { parent: 2, child: 3, index: 0, tag: "div",  ... }  // body 下加卡片根
    NodeAdded { parent: 3, child: 4, index: 0, tag: "text", ... }  // 根下第1个: 标题
    NodeAdded { parent: 3, child: 5, index: 1, tag: "text", ... }  // 根下第2个: 温度
    NodeAdded { parent: 3, child: 6, index: 2, tag: "div",  ... }  // 根下第3个: 列表容器
    NodeAdded { parent: 6, child: 7, index: 0, tag: "text", ... }  // 列表第1项: 周一
    NodeAdded { parent: 6, child: 8, index: 1, tag: "text", ... }  // 列表第2项: 周二
  ],
  node_patches: [],  // 首帧没有 patch（全是新增）
}
```

对应的树结构：
```
body#2
  └── div#3 (卡片根)
        ├── text#4 "深圳 · 今日天气"
        ├── text#5 "26°C"
        └── div#6 (forecast 列表容器)
              ├── text#7 "周一 晴"
              └── text#8 "周二 多云"
```

---

## 五、Flutter 拿到 Output 后怎么画

### 5.1 四棵树与两处 diff

整个渲染管线涉及 **4 棵树 + 2 处 diff**：

```
树1: TemplateNode 树（静态模板，打开后不变）
     │ 首次渲染时遍历，$for 创建新节点时再用
     ▼
树2: DomTree（Rust 运行时状态，会增删改）
     │ sync_from_dom（样式 → Taffy Style）
     ▼
树3: Taffy 树（布局引擎内部，算坐标）
     │ FrameUpdate 传给 Flutter
     ▼
树4: Flutter Widget 树（最终屏幕画面）
```

| 树 | 位置 | 生命周期 | 作用 |
|----|------|---------|------|
| TemplateNode | Rust runtime | 常驻不变 | 模板蓝图（渲染 + repeat 时复用） |
| DomTree | Rust core_container | 持续变化 | 当前状态（节点/属性/样式/文字） |
| Taffy 树 | Rust core_container | 每次布局时同步 | 计算 x/y/w/h |
| Widget 树 | Flutter/Dart | 每帧增量更新 | 最终渲染到屏幕 |

两处 diff：

| Diff | 对比什么 | 产出什么 | 目的 |
|------|---------|---------|------|
| 数据 diff | old_data vs new_data (JSON) | changed_paths ["city","temp"] | 精确定位受影响的 Watcher |
| 布局快照 diff | prev_snapshots vs 当前 computed_layout | NodePatch[] | 只告诉 Flutter 变化的节点 |

**没有 Virtual DOM diff** —— 不像 React 对比两棵虚拟树。rust_w3c 用 Watcher 精确定位变更节点，跳过了"逐节点对比"这一步。

#### Watcher 机制详解

Watcher = 一条绑定记录："哪个数据变了 → 更新哪个节点的哪个属性"。

```rust
struct Watcher {
    id: u32,
    expr: Expression,           // 观察的表达式，如 "{{city}} · {{title}}"
    target: WatcherTarget,      // 变了之后改谁（node#4 的 text_content）
    last_value: JsonValue,      // 上次的值（判断是否真的变了）
}
```

**注册时机**：首次渲染，遇到 `{{expr}}` 就自动注册：

```
模板: <text value="{{city}} · {{title}}" />

渲染时：
  1. 求值 "{{city}} · {{title}}" → "深圳 · 今日天气"
  2. bridge.create_text_node("深圳 · 今日天气") → node#4
  3. 注册 Watcher#1:
     - deps: ["city", "title"]
     - target: node#4.text_content
     - last_value: "深圳 · 今日天气"
  4. dep_map 登记:
     "city"  → [Watcher#1]
     "title" → [Watcher#1]
```

**触发时机**：数据变了，dep_map 精确定位：

```
pushData({"city": "北京", "temp": "18°C"})

  1. json_diff → changed_paths: ["city", "temp"]
  2. dep_map 查询:
       "city" → [Watcher#1]
       "temp" → [Watcher#2]
  3. 执行 Watcher#1:
       求值 "{{city}} · {{title}}" → "北京 · 今日天气"
       vs last_value "深圳 · 今日天气" → 变了！
       → bridge.set_attribute(node#4, "value", "北京 · 今日天气")
  4. 执行 Watcher#2:
       求值 "{{temp}}" → "18°C"
       → bridge.set_attribute(node#5, "value", "18°C")
```

**对比 React VDOM diff**：

| | React VDOM | Watcher |
|--|-----------|---------|
| 复杂度 | O(节点总数) 树对比 | O(变更数) 精确定位 |
| 过程 | 重新 render → 新旧 VDOM 逐节点比较 | dep_map 查表 → 直接改对应节点 |
| 代价 | 每次更新都遍历整棵树 | 首次渲染时注册所有 Watcher（一次性） |
| 适合 | 频繁结构变化（增删节点） | 数据驱动的属性变化（大部分卡片场景） |

#### 和 Vue 响应式的类比

Watcher 机制本质就是响应式数据设计，和 Vue 2 的原理几乎一模一样：

```
Vue 2:     data → Object.defineProperty(getter/setter) → Dep → Watcher → DOM 更新
rust_w3c:  data → json_diff(old, new) → dep_map → Watcher → DOM 更新
```

| 概念 | Vue 2 | rust_w3c | 本质 |
|------|-------|----------|------|
| 数据拦截 | getter/setter（自动收集依赖） | json_diff（显式对比变化） | 知道"谁变了" |
| 依赖存储 | Dep（每个 data 属性一个） | dep_map (HashMap<path, Vec\<WatcherId\>>) | 知道"变了影响谁" |
| 观察者 | Watcher（组件级或表达式级） | Watcher（表达式级，一个 `{{}}` 一个） | "谁在看这个数据" |
| 触发更新 | setter → Dep.notify → Watcher.update | diff → dep_map 查询 → execute_watcher | "通知观察者去更新" |
| 更新粒度 | 组件级 re-render + VDOM diff | **节点属性级直接 patch**（更细） | 最终改 DOM |

唯一区别：Vue 用 getter/setter 自动追踪依赖（JS 运行时劫持），rust_w3c 用 json_diff 显式对比（Rust 没有 Proxy/defineProperty 这种动态劫持能力）。但本质模型是同一个东西 —— **发布-订阅模式**（数据是发布者，Watcher 是订阅者，dep_map 是订阅表）。

### 5.2 Lite 卡片不涉及 JS 引擎

上面描述的是 **Lite 卡片** 的流程 —— 纯 Rust 响应式，没有 JS 引擎参与：

```
Lite 卡片（主流）：
  宿主推送 JSON data → Rust diff + Watcher → DOM 更新 → FrameUpdate → Flutter 画

JS 卡片（复杂交互）：
  QuickJS 执行 ViewModel（data/computed/watch/methods）
    → JS 修改数据 → 同样触发 Rust diff + Watcher → DOM 更新 → FrameUpdate → Flutter 画
```

| | Lite 卡片 | JS 卡片 |
|--|----------|---------|
| 数据从哪来 | 宿主直接推 JSON | JS ViewModel 产出 |
| 有没有 JS 引擎 | **没有** | 有（QuickJS，独立线程） |
| 交互能力 | 声明式 Action（navigate/message） | 完整 JS 方法调用 |
| 适用场景 | 天气/步数/通知等展示类 | 音乐播放器/表单等复杂交互 |

大部分卡片（80%+）是 Lite 模式，纯 Rust 处理，不需要 JS 引擎。

### 5.3 Flutter 渲染逻辑

```dart
// Flutter 每帧执行
void onVsync(double timestamp) {
  // 1. 让 Rust 推进一帧
  bindings.tick(handle, timestamp);

  // 2. 取走帧更新
  final update = bindings.takeUpdate(buffer);

  // 3. 应用 tree_mutations
  for (var mutation in update.treeMutations) {
    // NodeAdded → 创建对应 Widget（Positioned + Container + Text/Image）
    // NodeRemoved → 从 Widget 树移除
  }

  // 4. 应用 node_patches
  for (var patch in update.nodePatches) {
    // 更新已有 Widget 的属性（位置/颜色/文字/...）
  }

  // 5. 触发重绘
  setState(() {});
}
```

Flutter 侧用的是 **绝对定位**（Stack + Positioned），因为 Rust 已经算好了每个节点的 x/y/w/h。

> **注意**：虽然开发者在 DSL 中写的是 Flexbox 布局（flex-direction / justify-content / align-items），但 Flex 计算在 Rust 层（Taffy）就已经"消化"掉了。传给 Flutter 的 FrameUpdate 里只有最终的绝对坐标（x/y/w/h），Flutter 不需要知道原来是什么布局模式，统一用绝对定位画就行。

```
开发者写的:  flex-direction: column, gap: 12px
                    ↓
Taffy 计算:  child#1 → (x:0, y:0)  child#2 → (x:0, y:36)  child#3 → (x:0, y:72)
                    ↓
Flutter 画的: Stack [ Positioned(0,0,...), Positioned(0,36,...), Positioned(0,72,...) ]
```

---

## 六、数据更新时怎么刷新

宿主推送新数据：

```rust
quickapp_push_ui_data(handle, r#"{"city":"北京","temp":"18°C","forecast":[...]}"#)
```

引擎内部：

```
1. json_diff(old_data, new_data)
   → changed: ["city", "temp"]

2. dep_map 查询:
   "city" → [Watcher#1 (text node#4)]
   "temp" → [Watcher#2 (text node#5)]

3. 执行 dirty watchers:
   Watcher#1: 重新求值 "{{city}} · {{title}}" → "北京 · 今日天气"
              → bridge.set_attribute(node#4, "value", "北京 · 今日天气")
   Watcher#2: 重新求值 "{{temp}}" → "18°C"
              → bridge.set_attribute(node#5, "value", "18°C")

4. 重新布局（如果尺寸变了）

5. 产出 FrameUpdate:
   node_patches: [
     { node_id: 4, text_content: "北京 · 今日天气" },
     { node_id: 5, text_content: "18°C" },
   ]
```

**只更新了 2 个节点**，其他节点不动。Flutter 侧只重建这 2 个 Widget。

---

## 七、完整时间线

```
时间 →

[宿主 App 启动]
    │
    ├── 解压 .rpk → 得到 4 份 JSON
    ├── FFI: quickapp_open_card(manifest, template, css, data)
    │     └── Rust: 解析 → 渲染 → 布局 → FrameUpdate(全量)
    ├── Flutter: takeUpdate → 创建 Widget 树 → 首帧显示 ✅
    │
    │   ... 用户看到卡片 ...
    │
[数据刷新]
    │
    ├── FFI: quickapp_push_ui_data(new_data)
    │     └── Rust: diff → watchers → patch → FrameUpdate(增量)
    ├── Flutter: takeUpdate → 更新 2 个 Widget → 局部刷新 ✅
    │
    │   ... 卡片内容更新，无闪烁 ...
    │
[用户点击]
    │
    ├── Flutter: 手势 hit test → node_id=5
    ├── FFI: enqueue_event(node_id=5, "click")
    │     └── Rust: EventRouter → Action("navigate", "/detail")
    ├── FFI: drain_native_commands → [RouterPush("/detail")]
    ├── Flutter: Navigator.push("/detail") ✅
```
