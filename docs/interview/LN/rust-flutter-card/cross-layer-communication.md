# 跨层通信机制详解

## 目录

- [一、问题：三层之间怎么通信？](#一问题三层之间怎么通信)
- [二、物理架构：壳子是谁？](#二物理架构壳子是谁)
- [三、通信协议总览](#三通信协议总览)
- [四、Layer 1 → Layer 2：Flutter/Android ↔ Rust 引擎](#四layer-1--layer-2flutterandroid--rust-引擎)
  - [4.1 Dart FFI（Flutter 路径）](#41-dart-ffiflutter-路径)
  - [4.2 JNI（Android 路径）](#42-jniandroid-路径)
  - [4.3 为什么不用 Platform Channel](#43-为什么不用-platform-channel)
- [五、Layer 2 → Layer 3：Rust 引擎 ↔ 渲染后端](#五layer-2--layer-3rust-引擎--渲染后端)
  - [5.1 下行：FrameUpdate 增量协议](#51-下行frameupdate-增量协议)
  - [5.2 上行：事件 + NativeCommand](#52-上行事件--nativecommand)
  - [5.3 同步回调：文本测量](#53-同步回调文本测量)
- [六、Layer 内部：JS 线程 ↔ 主线程](#六layer-内部js-线程--主线程)
- [七、Vsync 驱动循环](#七vsync-驱动循环)
- [八、完整时序图](#八完整时序图)
- [九、对比表：各通信方式](#九对比表各通信方式)

---

## 一、问题：三层之间怎么通信？

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Layer 1        │     │  Layer 2        │     │  Layer 3        │
│  平台壳子       │ ←→ │  Rust 引擎      │ ←→ │  渲染展示       │
│  (Android/iOS)  │     │  (core + runtime)│     │  (Flutter Widget)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

核心问题：这三层用什么协议、什么机制通信？延迟如何？线程模型如何？

---

## 二、物理架构：壳子是谁？

你理解的对 —— **壳子就是 Android/iOS App 本身**。

实际运行时的物理部署：

```
┌── Android/iOS App 进程 ──────────────────────────────────┐
│                                                          │
│  ┌─── Flutter Engine (Dart VM) ───────────────────────┐  │
│  │                                                    │  │
│  │  Flutter Widget 树 (渲染层)                        │  │
│  │    ↕ Dart FFI (dart:ffi, 零拷贝, 同进程)           │  │
│  │  Rust .so (引擎层: core_container + quickapp)      │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Android 侧: Activity / Fragment (壳子)                  │
│    - 负责生命周期管理                                     │
│    - 负责系统能力桥接 (权限/存储/网络)                    │
│    - 提供 FlutterView 嵌入                               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

关键点：
- **Rust .so 被加载到 Flutter Engine 同一进程空间**，所以 Dart FFI 是函数级调用，没有 IPC 开销
- Flutter Engine 本身嵌在 Android Activity / iOS ViewController 里
- "壳子"只负责生命周期 + 系统 API 桥接，不参与渲染逻辑

---

## 三、通信协议总览

| 方向 | 通信路径 | 协议/机制 | 延迟 | 线程 |
|------|---------|----------|------|------|
| 下行（加载） | Dart → Rust | **Dart FFI** (C ABI 函数调用) | ~0 (同进程) | 主线程 |
| 下行（数据推送） | Dart → Rust | **Dart FFI** (ptr+len) | ~0 | 主线程 |
| 上行（布局更新） | Rust → Dart | **SharedUpdateBuffer** (Arc<Mutex<>>) | 每帧 poll | 跨线程安全 |
| 上行（通知） | Rust → Dart | **NativePort + C callback** | 微秒级 | callback 线程 → Isolate |
| 上行（事件） | Flutter touch → Rust | **Dart FFI** (enqueue_event) | ~0 | 主线程 |
| 同步回调 | Rust → Dart → Rust | **C 函数指针回调** (MeasureText) | 同步 | 主线程 |
| 内部（JS 卡片） | JS Thread → Main Thread | **mpsc channel** (DomOp) | 微秒级 | 跨线程 |

---

## 四、Layer 1 → Layer 2：Flutter/Android ↔ Rust 引擎

### 4.1 Dart FFI（Flutter 路径）

Flutter 通过 `dart:ffi` **直接调用 Rust .so 的 C 函数**，零开销：

```dart
// Dart 侧加载 .so
final lib = DynamicLibrary.open('libquickapp_runtime.so');

// 解析函数符号
final openCard = lib.lookupFunction<QuickAppOpenCardNative, QuickAppOpenCardDart>(
  'quickapp_open_card',
);

// 调用：直接传指针 + 长度（零拷贝）
final result = openCard(
  handle,
  manifestPtr, manifestLen,
  templatePtr, templateLen,
  cssPtr, cssLen,
  uiDataPtr, uiDataLen,
);
```

```rust
// Rust 侧导出 C ABI
#[no_mangle]
pub unsafe extern "C" fn quickapp_open_card(
    handle: *mut QuickAppRuntime,
    manifest_ptr: *const u8, manifest_len: usize,
    ...
) -> FfiResult { ... }
```

**通信方式**：同进程 C 函数调用
**数据格式**：raw bytes (ptr + len)，通常是 UTF-8 JSON 字符串
**线程**：在 Dart 主 Isolate 执行，同步阻塞直到 Rust 返回
**性能**：纳秒级调用开销，数据零拷贝

### 4.2 JNI（Android 路径）

Android 原生路径通过 JNI 调用 Rust：

```
Kotlin/Java  ──JNI──→  C wrapper  ──→  Rust .so
```

`android_backend/` 中通过 JNI bridge 调用相同的 C ABI 函数。

### 4.3 为什么不用 Platform Channel

| 方式 | 机制 | 开销 | 适用 |
|------|------|------|------|
| Platform Channel | 消息队列 + 异步 codec | 每次 ~100μs + 序列化 | 低频调用 (权限/存储) |
| Dart FFI | 直接 C 函数调用 | ~10ns | 高频调用 (每帧 tick/布局) |

动态渲染框架每帧需要调用 `tick()` + `take_update()` + 处理 FrameUpdate，**一帧内可能有几十次 FFI 调用**。Platform Channel 的序列化开销完全不可接受。

---

## 五、Layer 2 → Layer 3：Rust 引擎 ↔ 渲染后端

### 5.1 下行：FrameUpdate 增量协议

Rust 引擎每帧产出 `FrameUpdate`，Flutter 侧消费：

```
Rust Container.tick()
  → push_layout_updates()
    → 写入 SharedUpdateBuffer (Arc<Mutex<FrameUpdate>>)
      → Flutter 侧 container_take_update() 取走
        → 反序列化 → 应用到 Widget 树
```

具体机制：

```rust
// Rust 侧写入
pub struct SharedUpdateBuffer {
    inner: Mutex<FrameUpdate>,  // 线程安全
}

// FFI 导出：Dart 调用此函数取走帧更新
#[no_mangle]
pub extern "C" fn container_take_update(
    buffer_ptr: *const SharedUpdateBuffer,
    out_ptr: *mut *const u8,
    out_len: *mut usize,
) -> FfiResult { ... }
```

```dart
// Dart 侧每帧消费
void _onTick(double timestampMs) {
  // 1. 驱动 Rust 推进一帧
  _bindings.tick(handle, timestampMs);
  
  // 2. 取走帧更新
  final updateBytes = _bindings.takeUpdate(updateBuffer);
  
  // 3. 反序列化
  final frameUpdate = FrameUpdateDeserializer.deserialize(updateBytes);
  
  // 4. 应用到 Widget 树
  _pipeline.processFrame(frameUpdate);
  
  // 5. 触发重绘
  setState(() {});
}
```

**数据格式**：自定义二进制序列化（NodePatch bitmap 编码，极紧凑）
**频率**：每帧一次（16ms / 60fps）
**线程安全**：`Arc<Mutex<>>` 保证读写不冲突

### 5.2 上行：事件 + NativeCommand

用户触摸事件从 Flutter → Rust：

```dart
// Flutter 侧：手势识别后调 FFI
void _onTapDown(int nodeId) {
  _bindings.enqueueEventMessage(
    handle, 
    'click',     // event_type
    nodeId,      // target_node_id
    '{}',        // props JSON
  );
  // 立即执行事件处理（不等下一帧）
  _bindings.tickEventsOnly(handle, timestamp);
}
```

Rust 产出的 NativeCommand（如路由跳转）通过 FFI 回传 Flutter：

```dart
// Flutter 侧每帧 drain
final commands = _bindings.drainNativeCommands(handle);
for (final cmd in commands) {
  if (cmd.domain == 'router') {
    Navigator.push(...);  // Flutter 路由跳转
  }
}
```

### 5.3 同步回调：文本测量

Rust 布局时需要测量文本尺寸（不同字体/字号的实际像素宽高），但 Rust 没有字体引擎。解决方案：**同步 C 回调**。

```
Rust layout 计算中
  → 遇到文本节点需要测量
    → 调用 measure_text_callback (C 函数指针)
      → 回到 Dart 侧：用 Flutter TextPainter 测量
        → 结果通过 out 指针写回
          → Rust 继续布局计算
```

```rust
// Rust 侧注册回调
pub type MeasureTextCallback = extern "C" fn(
    user_data: *mut c_void,
    text_ptr: *const u8, text_len: usize,
    font_size: f32, font_weight: u16,
    max_width: f32,
    out_width: *mut f32, out_height: *mut f32,
);
```

```dart
// Dart 侧实现（注册为 C callback）
void _measureTextCallback(..., Pointer<Float> outWidth, Pointer<Float> outHeight) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: TextStyle(fontSize: fontSize)),
    textDirection: TextDirection.ltr,
  )..layout(maxWidth: maxWidth);
  
  outWidth.value = painter.width;
  outHeight.value = painter.height;
}
```

**这是同步调用**：Rust 阻塞等 Dart 测量完毕再继续。整个过程在同一线程内完成。

---

## 六、Layer 内部：JS 线程 ↔ 主线程

JS 卡片模式下，QuickJS 引擎在独立线程运行：

```
┌── JS Thread ──────────────┐      mpsc channel      ┌── Main Thread ────────────┐
│                           │                         │                           │
│  QuickJS Runtime          │  ── DomOp[] ────────→  │  ChannelBridgeReceiver    │
│  ViewModel (data/methods) │                         │  → apply to DomTree       │
│  Timer callbacks          │  ← timer_fired ──────  │  Container.tick()          │
│  Event handlers           │  ← event dispatch ──   │  LayoutSystem              │
│                           │                         │  FrameUpdate generation    │
└───────────────────────────┘                         └───────────────────────────┘
```

通信机制：
- **下行 (DOM 操作)**：`std::sync::mpsc::channel<DomOp>`，JS 线程 flush 时批量发送
- **上行 (定时器/事件)**：JS Thread Handle 的方法调用（内部也是 channel）
- **为什么要分线程**：rquickjs::Runtime 是 `!Send`，且长时间 JS 执行会阻塞渲染

---

## 七、Vsync 驱动循环

Flutter 的 vsync 信号驱动整个渲染管线：

```
Flutter Vsync (16ms 一帧)
  │
  ├─ VsyncDriver.onVsync(timestampMs)
  │    │
  │    └─ FFI: container_tick(handle, timestamp)
  │         │
  │         ├─ Rust: 处理消息队列 (events/timers)
  │         ├─ Rust: 推进动画/过渡
  │         ├─ Rust: 如果 layout_dirty → Taffy 重新计算
  │         └─ Rust: push_layout_updates → SharedUpdateBuffer
  │
  ├─ FFI: container_take_update(buffer) → FrameUpdate bytes
  │
  ├─ Dart: 反序列化 FrameUpdate
  │    ├─ TreeMutation → 增删 Widget
  │    └─ NodePatch → 更新 Widget 属性
  │
  └─ setState() → Flutter rebuild → Skia 绘制
```

关键时序：
- Rust `tick()` 和 Flutter `setState()` 在**同一帧**内完成
- 如果没有动画/数据变更，VsyncDriver 停止注册帧回调，**CPU 完全空闲**

---

## 八、完整时序图

一个完整的"用户点击 → 数据更新 → UI 刷新"时序：

```
时间 →

Flutter UI          Dart FFI层           Rust 引擎              Rust QuickApp Runtime
    │                   │                    │                         │
    │ touch event       │                    │                         │
    ├──────────────────→│                    │                         │
    │                   │ enqueue_event_msg  │                         │
    │                   ├───────────────────→│                         │
    │                   │ tick_events_only   │                         │
    │                   ├───────────────────→│ dispatch event          │
    │                   │                    ├────────────────────────→│
    │                   │                    │  handle_event → action  │
    │                   │                    │←────────────────────────│
    │                   │                    │ NativeCommand queued    │
    │                   │                    │                         │
    │ ... vsync arrives │                    │                         │
    │                   │ tick(timestamp)    │                         │
    │                   ├───────────────────→│ layout + push_updates  │
    │                   │                    │                         │
    │                   │ take_update()      │                         │
    │                   ├───────────────────→│ return FrameUpdate     │
    │                   │←───────────────────│                         │
    │ apply patches     │                    │                         │
    │←──────────────────│                    │                         │
    │ setState→rebuild  │                    │                         │
    │                   │                    │                         │
    │                   │ drain_commands()   │                         │
    │                   ├───────────────────→│ return [RouterPush]    │
    │                   │←───────────────────│                         │
    │ Navigator.push()  │                    │                         │
    │←──────────────────│                    │                         │
```

---

## 九、对比表：各通信方式

| 通信方式 | 场景 | 数据方向 | 开销 | 同步/异步 | 线程 |
|---------|------|---------|------|----------|------|
| Dart FFI 函数调用 | 加载/tick/事件 | Dart → Rust | ~10ns | 同步 | 主 |
| SharedUpdateBuffer.take() | 帧更新 | Rust → Dart | ~100ns (lock) | 同步 poll | 主 |
| C 函数指针回调 | 文本测量 | Rust → Dart → Rust | ~1μs | 同步 | 主 |
| NativePort + ReceivePort | 通知信号 | Rust → Dart Isolate | ~10μs | 异步 | 跨 |
| mpsc::channel | JS 线程 DOM 操作 | JS Thread → Main | ~1μs per op | 异步 | 跨 |
| Platform Channel | 系统能力 (权限/存储) | Dart ↔ Android | ~100μs | 异步 | 跨 |

### 设计原则

1. **高频路径用 FFI**：每帧调用（tick/take_update）绝不走 Platform Channel
2. **数据零拷贝**：ptr+len 传递，不做 JSON 序列化（除初始加载外）
3. **同步优先**：能同步就不异步，减少帧延迟
4. **批量提交**：DomOp 积攒后 flush，FrameUpdate 一帧一取，减少 lock 次数
5. **空闲时零开销**：无动画/无事件时，VsyncDriver 停止，CPU 完全空闲
