# QuickApp 运行时渲染流程详解

## 目录

- [一、总览：一张卡片怎么被渲染出来](#一总览一张卡片怎么被渲染出来)
- [二、详解每个阶段](#二详解每个阶段)
  - [2.1 FFI 入口](#21-ffi-入口)
  - [2.2 模板解析](#22-模板解析)
  - [2.3 首次渲染](#23-首次渲染)
  - [2.4 DomBridge 通信机制](#24-dombridge-通信机制)
  - [2.5 响应式更新（数据推送后）](#25-响应式更新数据推送后)
  - [2.6 布局与渲染同步](#26-布局与渲染同步)
- [三、通信协议总结](#三通信协议总结)
  - [数据流 1：应用 → 引擎（下行）](#数据流-1应用--引擎下行)
  - [数据流 2：引擎 → 渲染后端（下行）](#数据流-2引擎--渲染后端下行)
  - [数据流 3：用户交互 → 应用（上行）](#数据流-3用户交互--应用上行)
- [四、JS 卡片的双线程模型](#四js-卡片的双线程模型)
- [五、designWidth 适配](#五designwidth-适配)

---

## 一、总览：一张卡片怎么被渲染出来

从 `.rpk` 包到屏幕上的像素，完整流程如下：

```
┌─────────────────────────────────────────────────────────────┐
│  1. 宿主调用 FFI: quickapp_open_card(manifest, template, css, data)  │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 解析阶段                                                  │
│     manifest → WidgetInfo (包名/卡片类型/designWidth)          │
│     template JSON → TemplateNode 树                           │
│     css JSON → RegisteredRule[] → 注册到 DomTree.css_rules    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 首次渲染 (render_template_with_data)                      │
│     遍历 TemplateNode 树:                                     │
│       - 每个节点 → bridge.create_element(tag)                 │
│       - 表达式属性 → evaluate → bridge.set_attribute/set_style │
│       - $for 指令 → 创建 RepeatState + 注册 Watcher           │
│       - $if/$show → 条件渲染 + 注册 Watcher                   │
│       - 事件绑定 → EventRouter 注册                           │
│     所有 DOM 操作经过 DomBridge 落地到 core_container DomTree  │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 布局计算                                                  │
│     Container.layout():                                       │
│       DomTree → sync_from_dom → Taffy 节点树                  │
│       Taffy.compute_layout(viewport_w, viewport_h)            │
│       结果写回 DomNode.computed_layout                        │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  5. 生成 FrameUpdate                                          │
│     Container.push_layout_updates():                          │
│       对比 prev_snapshots vs 当前布局                          │
│       新节点 → TreeMutation::NodeAdded                        │
│       属性变化 → NodePatch (bitmap 标记变更字段)               │
│       删除节点 → TreeMutation::NodeRemoved                    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  6. SharedUpdateBuffer → 渲染后端消费                          │
│     Flutter: FrameUpdate → Widget rebuild → Skia 绘制         │
│     Android: FrameUpdate → JNI → View 创建/更新               │
│     Web: FrameUpdate → DOM 绝对定位元素                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、详解每个阶段

### 2.1 FFI 入口

宿主（Flutter/Android）通过 C ABI 调用 `quickapp_open_card`：

```rust
pub unsafe extern "C" fn quickapp_open_card(
    handle: *mut QuickAppRuntime,
    manifest_ptr: *const u8, manifest_len: usize,
    template_ptr: *const u8, template_len: usize,
    css_ptr: *const u8, css_len: usize,
    ui_data_ptr: *const u8, ui_data_len: usize,
) -> FfiResult
```

参数都是 JSON 字符串（从 `.rpk` 包中解压得到）。

### 2.2 模板解析

QuickApp 的模板被编译工具链预编译为 JSON 结构：

```json
{
  "#entry": {
    "type": "div",
    "children": [
      {
        "type": "text",
        "attr": { "value": "{{title}}" }
      },
      {
        "type": "div",
        "repeat": { "exp": "items", "item": "item", "index": "idx" },
        "children": [...]
      }
    ]
  }
}
```

`template_parser` 将其解析为 `TemplateNode` 树结构。

### 2.3 首次渲染

核心函数 `render_template_with_data` 递归遍历 TemplateNode 树：

```
对每个 TemplateNode:
  1. bridge.create_element(tag)     → 创建 DOM 节点
  2. 解析属性:
     - 静态值 → bridge.set_attribute(node, key, value)
     - 动态表达式 {{expr}} →
         a. 求值表达式获取当前值
         b. bridge.set_attribute(node, key, current_value)
         c. 注册 Watcher(expr → target: node.attr)
  3. 解析样式: 同上逻辑
  4. 处理指令:
     - $for → 遍历数组，每项递归渲染，注册 RepeatWatcher
     - $if  → 条件为 false 则跳过
     - $show → 渲染但可能 display:none
  5. bridge.append_child(parent, node)
  6. 递归处理 children
```

### 2.4 DomBridge 通信机制

DomBridge 是运行时层与核心引擎之间的桥梁：

```
               ┌──────────────┐
               │  runtime/    │
               │  quickapp    │
               └──────┬───────┘
                      │ DomBridge trait
          ┌───────────┼───────────┐
          ▼           ▼           ▼
  ContainerBridge  ChannelBridge  MockBridge
  (Lite卡片同步)   (JS卡片跨线程)  (测试用)
          │           │
          ▼           ▼
     ┌────────────────────┐
     │  core_container    │
     │  DomTree (Arena)   │
     └────────────────────┘
```

#### ContainerBridge（Lite 卡片）

直接持有 `Rc<RefCell<DomTree>>` 引用，所有操作同步执行：

```rust
fn create_element(&mut self, tag: &str) -> NodeId {
    let mut dom = self.dom_tree.borrow_mut();
    dom.create_element(tag).unwrap().0 as u32
}
```

#### ChannelBridge（JS 卡片）

JS 线程产生 `DomOp` 枚举，通过 `mpsc::channel` 发送到主线程：

```rust
fn create_element(&mut self, tag: &str) -> NodeId {
    let id = self.next_node_id;
    self.next_node_id += 1;
    self.pending_ops.push(DomOp::CreateElement { node_id: id, tag: tag.to_string() });
    id
}

fn flush(&mut self) {
    // 发送所有待处理操作到主线程
    for op in self.pending_ops.drain(..) {
        self.sender.send(op).ok();
    }
}
```

主线程的 `ChannelBridgeReceiver` 接收并应用到 DomTree。

### 2.5 响应式更新（数据推送后）

当宿主调用 `quickapp_push_ui_data(new_json)` 推送新数据：

```
1. json_diff(old_data, new_data) → changed_fields: ["title", "items[0].name"]

2. dep_map 查询:
   "title" → [Watcher#1, Watcher#3]
   "items" → [Watcher#5 (RepeatWatcher)]

3. 执行 dirty watchers:
   Watcher#1: 重新求值 "{{title}}" → bridge.set_attribute(node3, "value", "新标题")
   Watcher#5: 重新 diff 数组 → 增删 DOM 节点

4. bridge.flush() → core_container DomTree 更新

5. Container.tick() → 重新布局 → 生成 FrameUpdate → 渲染后端消费
```

### 2.6 布局与渲染同步

```
Container.tick(timestamp_ms):
  │
  ├─ 处理定时器/事件消息
  ├─ 推进动画/过渡
  │
  ├─ if layout_dirty:
  │    LayoutSystem.sync_from_dom(dom_tree)  // DOM → Taffy 节点同步
  │    LayoutSystem.compute_layout(w, h)     // Taffy 计算
  │    结果写回 DomNode.computed_layout
  │
  └─ push_layout_updates():
       对比本帧与上帧的 LayoutSnapshotEntry
       产出 FrameUpdate { tree_mutations, node_patches }
       写入 SharedUpdateBuffer (Mutex<FrameUpdate>)
```

渲染后端（如 Flutter）在 vsync 回调中：

```dart
// Flutter 侧
void onVsync() {
  container.tick(timestamp);
  FrameUpdate update = sharedBuffer.take();
  applyMutations(update.tree_mutations);
  applyPatches(update.node_patches);
  setState(() {}); // trigger widget rebuild
}
```

---

## 三、通信协议总结

整个框架的通信可以用 3 条数据流概括：

### 数据流 1：应用 → 引擎（下行）

```
宿主推送 JSON 数据
  → runtime/quickapp 响应式系统求值
    → DomBridge 调用（create_element / set_style / ...）
      → core_container DomTree 更新
```

### 数据流 2：引擎 → 渲染后端（下行）

```
DomTree 变更
  → Container.tick() 重新布局
    → push_layout_updates() 产出 FrameUpdate
      → SharedUpdateBuffer (Arc<Mutex<>>)
        → 渲染后端 take() 消费并绘制
```

### 数据流 3：用户交互 → 应用（上行）

```
用户点击屏幕
  → 渲染后端 hit test 确定 node_id
    → container_enqueue_event_message(node_id, "click")
      → Container.tick() → EventSystem 冒泡
        → CallbackExecutor.execute_event_callback(callback_id)
          → QuickAppRuntime.handle_event(node_id, "click")
            → EventRouter 查找 handler → 执行 Action
              → 产出 NativeCommand (router/message)
```

---

## 四、JS 卡片的双线程模型

JS 卡片使用独立线程执行 JavaScript，避免阻塞渲染：

```
┌─────────────────┐          Channel           ┌─────────────────┐
│   JS Thread     │  ─── DomOp[] ──────────►  │   Main Thread   │
│                 │                            │                 │
│  QuickJS Engine │  ◄── timer_fired ────────  │  Container      │
│  ViewModel      │  ◄── event dispatch ─────  │  LayoutSystem   │
│  data() / onInit│                            │  FrameUpdate    │
└─────────────────┘                            └─────────────────┘
```

- JS 线程：执行 index.js、维护 ViewModel、处理计算属性
- 主线程：持有 DomTree、布局引擎、事件系统
- 通信：ChannelBridge (DomOp channel) + timer/event 回调

---

## 五、designWidth 适配

QuickApp 使用 designWidth 做尺寸适配：

```
css_scale = screen_width_px / design_width
```

所有 CSS 中的 px 值在注册到 core_container 之前，都乘以 `css_scale`：

```rust
// 例如 designWidth=750, screenWidth=1200
// css_scale = 1200 / 750 = 1.6
// "width: 100px" → "width: 160px"
```

通过 `ScalingDomBridge` 装饰器或在 CSS 注册时统一缩放。

---

*这两篇文档提供了框架的全局视角。后续可以深入到：*
- *响应式系统实现细节（dep_map / Watcher / BatchQueue）*
- *组件系统（Props / Slot / 生命周期）*
- *CSS 引擎（选择器匹配 / scope 隔离 / 继承链）*
- *Flutter 渲染后端实现*
