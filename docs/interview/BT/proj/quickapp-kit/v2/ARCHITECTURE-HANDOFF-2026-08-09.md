# QuickApp Kit v2 架构讨论交接（2026-08-09）

> 用途：供其他开发环境中的 agent 快速恢复项目上下文。  
> 状态：阶段性共识；未标记为“关键决策”的内容仍需继续设计或 PoC 验证。

## 目录

- [1. 结论](#1-结论)
- [2. 项目主旨](#2-项目主旨)
- [3. 联盟实现的代码事实](#3-联盟实现的代码事实)
- [4. 目标分层架构](#4-目标分层架构)
- [5. 树模型与渲染管线](#5-树模型与渲染管线)
- [6. 线程与事件循环](#6-线程与事件循环)
- [7. JS 与 C++ 边界](#7-js-与-c-边界)
- [8. 样式、布局与文本](#8-样式布局与文本)
- [9. 第一阶段范围](#9-第一阶段范围)
- [10. 第二阶段方向](#10-第二阶段方向)
- [11. 已确定与待决策事项](#11-已确定与待决策事项)
- [12. 文档和开发顺序](#12-文档和开发顺序)
- [13. 代码与资料位置](#13-代码与资料位置)

## 1. 结论

QuickApp Kit v2 第一阶段不是建设完整的联盟兼容运行平台，而是用先进、清晰、可演进的架构，首先跑通仓库内指定的真实 RPK 示例，形成一个“麻雀虽小、五脏俱全”的端到端轻应用 Runtime。

目标主链路是：

```text
RPK
  -> QuickJS 系引擎
  -> JS Framework（VM、响应式、Logical DOM）
  -> JSI-like Direct Binding
  -> C++ Runtime Core（Shadow Tree、Style、Yoga、Commit）
  -> typed MountTransaction
  -> Android View Backend
```

第一阶段可以缺少大量组件、系统 API、签名校验和完整兼容性，但核心分层、线程边界、树模型和跨层合同必须从一开始设计正确。

## 2. 项目主旨

项目核心主张保持不变：

```text
One Runtime Core
+ Multiple Render Backends
+ TurboModule-like Capability System
+ Observable Benchmark
```

当前优先级需要明确为：

1. 先证明架构和最小闭环成立。
2. 第一阶段跑通 `quickapp-kit-ai/quickapp-examples` 中的指定 RPK。
3. 联盟标准是语义参考和后续兼容方向，不是第一阶段完整验收目标。
4. 功能可以小，架构边界不能临时拼接。

**关键决策 KD-01：第一阶段以指定示例 RPK 的端到端运行作为唯一硬目标，不以完整联盟兼容作为硬目标。**

## 3. 联盟实现的代码事实

本轮已经直接检查本地 `hap-toolkit` 与 `hapjs`，不是仅依据 README 推测。

联盟现有实现的核心链路：

```text
.ux
  -> hap-toolkit 编译 template/style/script
  -> $app_define$ / $app_bootstrap$
  -> V8/J2V8 执行 JS Framework
  -> VM / Observer / Watcher
  -> JS Logical DOM
  -> JSON RenderAction
  -> Android RenderActionDocument
  -> Yoga / Android View
```

已经确认的事实：

- JS 侧不做 React 式整棵 VNode Tree diff。
- 数据属性通过响应式 getter/setter 通知依赖它的 Watcher。
- Watcher 通过 Promise microtask 去重和批量刷新。
- Watcher callback 同步修改局部 Logical DOM，并产生增量 RenderAction。
- JS 使用 `callNative(instId, JSON actions)` 将 action 批量发往 Android。
- Android 现有实现包含 JS HandlerThread、RenderAction HandlerThread 和 Main/UI Thread。
- 页面由逻辑 `PageManager` 管理，不是一页对应一个 Activity。

联盟实现值得保留的是 DSL/RPK、VM/Watcher、生命周期和路由语义；JSON、J2V8 和 Android 专用 VDocument 不是 v2 的目标边界。

## 4. 目标分层架构

```text
Application / RPK
  manifest, JS bundle, assets

JS Framework
  App/Page/Component VM
  Observer/Watcher/Computed
  Logical DOM
  Lifecycle/Router facade

JS Binding
  JsEngineAdapter
  Render Host Functions
  Capability Host Object
  Native Event Dispatcher

C++ Runtime Core
  AppRuntime
  PageStack / SurfaceRegistry
  Shadow Tree
  StyleResolver
  YogaLayoutEngine
  CommitCoordinator
  CapabilityRegistry
  libuv Runtime Loop

Render Backend
  MountTransaction Applier
  ComponentRegistry
  Text/Widget Measure
  Platform Event Adapter

Platform UI
  Android View / UIKit / LVGL / SDL
```

**关键决策 KD-02：JS Framework、C++ Core 和 Render Backend 是三个独立所有权层。Core 掌握跨端语义，Backend 只掌握平台 UI。**

## 5. 树模型与渲染管线

### 5.1 三棵树

| 树 | 所属 | 职责 |
|---|---|---|
| Logical DOM | JS Framework | DSL 结构、动态绑定、组件和事件 |
| Shadow Tree | C++ Runtime Core | 规范化节点、样式、布局、revision 和 commit |
| Host Tree | Render Backend | Android View、UIView、LVGL object 等平台对象 |

“VNode”容易产生歧义。后续文档优先使用 `Logical DOM`、`Shadow Tree`、`Host Tree`。

### 5.2 首次渲染

```text
加载 RPK 和 Page bundle
  -> 创建 Page VM 和响应式数据
  -> onInit
  -> 遍历已编译 template object
  -> 创建 Logical DOM 和 Watcher
  -> 生成 Create/Insert/Update Mutation
  -> seal DomTransaction
  -> C++ 创建 Shadow Tree
  -> Style Resolve
  -> Yoga Layout
  -> Commit Shadow revision
  -> 生成 MountTransaction
  -> UI Thread 创建 Android View
```

### 5.3 数据更新

```text
this.title = value
  -> reactiveSetter
  -> notify dependent Watchers
  -> Promise microtask flush
  -> 局部表达式重新求值
  -> 局部 Logical DOM Mutation
  -> 一个 DomTransaction
  -> Shadow Tree 局部更新、布局和 commit
  -> MountTransaction
```

不存在 JS 整树 diff。表达式可能比较新旧值；`if/for` 等结构绑定会产生局部 Create/Remove/Move，但仍不是整页 diff。

**关键决策 KD-03：第一主路径使用增量 DomTransaction，不实现 React 式 JS 整树 diff。未来可以在 Core 增加 TreeSnapshot/Reconciler 输入，但不能影响 RenderBackend 合同。**

## 6. 线程与事件循环

第一阶段线程模型：

```text
Platform Main/UI Thread
  input
  Choreographer/CADisplayLink/LVGL refresh
  apply MountTransaction
  platform UI tree

C++ Runtime Thread
  libuv uv_loop_t
  QuickJS runtime
  Promise job draining
  Watcher flush
  DomTransaction builder
  Shadow Tree / Style / Yoga / Commit

I/O Workers / Platform Async Threads
  network, file, resource decode, device capability
```

QuickJS 本身提供 Promise Job Queue，但不提供完整 Event Loop。Runtime Host 必须在执行 JS task 后主动 drain Promise jobs，并设置单轮任务数和时间预算，防止无限 Promise 链饿死 Runtime Loop。

JS 和 Core 第一阶段位于同一 Runtime Thread。因此 JS 调用 C++ Host Function 是跨语言边界，但不跨线程；MountTransaction 才从 Runtime Thread 跨到 UI Thread。

libuv 负责 Runtime task、timer、async I/O 和 worker 协同，不负责平台 vsync，也不替代平台 UI Loop。

**关键决策 KD-04：C++ Runtime Thread 使用 libuv Event Loop；移动端 UI 使用系统主线程，LVGL 使用唯一 UI owner task。**

ESP32-S3/FreeRTOS 是直接移植 libuv，还是通过 `EventLoopBackend` 提供 FreeRTOS 实现，尚需 PoC。

## 7. JS 与 C++ 边界

建议采用 RN JSI-like 的 direct host binding 思路，但不复制 RN JSI API。

QuickJS 中注册 external host object/function：

```text
globalThis.__quickappRuntime.render.*
globalThis.__quickappRuntime.capability.*
```

底层使用 QuickJS C API 的 host function、opaque pointer 和 external object。调用期间只写入 `DomTransactionBuilder`，`commit()` 才把完整事务交给 RenderCoordinator。

需要区分三条边界：

| 边界 | 数据 |
|---|---|
| JS Framework -> C++ Core | Render Binding / DomTransaction |
| JS `@system.*` -> Capability | Capability Bridge / Request-Response |
| Platform Event -> JS | Event Binding / EventTransaction |

C++ Core 到 RenderBackend 不走 JS Bridge，而是纯 C++ typed `MountTransaction`。因此渲染管线只有入口经过 JS Binding，进入 Core 后不再依赖 JS 引擎。

第一阶段不使用 JSON 作为 Core 与 Backend 的内部协议。后续可将多次 Host Function 调用优化为 binary command buffer，但不改变 Core transaction 类型。

**关键决策 KD-05：采用 JSI-like Direct Binding；Render、Capability、Event 三条边界分开；Core 到 Backend 使用 typed C++ transaction。**

## 8. 样式、布局与文本

Yoga 只负责几何布局，不负责：

- selector、优先级、继承和 computed style；
- 字体 fallback、shaping、换行和 glyph 排版；
- 绘制。

目标分工：

```text
C++ StyleResolver
  -> YogaLayoutEngine
  -> MeasureService interface
       -> AndroidTextMeasurer
       -> IOSTextMeasurer
       -> LVGLTextMeasurer
       -> SDLTextMeasurer
  -> MountTransaction
```

RN 可借鉴 C++ Shadow Tree、Yoga 和平台 TextLayoutManager；Lynx 可借鉴 Style Resolve、Layout Tree、Measure 与 UI Operations 分层。

第一阶段只实现示例 RPK 需要的最小 StyleResolver 和组件测量，不建设完整 CSS 引擎。

**待决策 DD-01：Text/Native Measure 是同步测量、缓存测量，还是允许异步二次 layout。该决策会直接影响 RenderBackend contract。**

## 9. 第一阶段范围

### 9.1 必须形成的完整闭环

- 指定 RPK 的解包和资源加载；
- manifest、app bundle、page bundle；
- QuickJS 系引擎和 JS Framework；
- VM、响应式更新和 Logical DOM；
- JSI-like Render Binding；
- C++ Shadow Tree、StyleResolver、Yoga 和 Commit；
- typed MountTransaction；
- Android View RenderBackend；
- click/input/back 等最小事件回流；
- 最小 App、Page、Surface、Router 和生命周期；
- 示例需要的最小组件和 Capability API。

### 9.2 第一阶段明确不做

- RPK 签名校验；
- 完整权限和安全体系；
- 完整联盟组件/API/兼容性；
- 远程加载与分发合规；
- QuickJS bytecode；
- 多 JS 引擎；
- Lynx 式双 JS Runtime；
- 完整 iOS/LVGL backend；
- 完整可观测产品。

可观测能力第一阶段只预留稳定 trace hook，保证后续能测量，不扩展成独立产品范围。

## 10. 第二阶段方向

第二阶段重点是 Core Extraction 和多后端验证：

```text
Android 孵化出的 C++ Core
  -> SDL Simulator
  -> LVGL / ESP32-S3
  -> source JS + QuickJS bytecode
  -> transaction 合并与背压
  -> benchmark SDK
```

只有 benchmark 证明 Style/Layout 明显阻塞 JS 时，才增加独立 Render Worker：

```text
Runtime Thread：libuv + QuickJS + Watcher
Render Worker：Shadow / Style / Yoga / Commit
UI Thread：Mount
```

这个演进发生在 Core 内部，不改变 JS Framework 与 RenderBackend 的合同。

## 11. 已确定与待决策事项

### 11.1 已确定

1. 第一阶段跑通指定示例 RPK，不追求完整联盟兼容。
2. C++ 是第一版共享 Runtime Core 语言，不引入 Rust。
3. JS Logical DOM、C++ Shadow Tree、平台 Host Tree 三层分离。
4. JS 不做整树 diff，采用响应式 Watcher + 增量 DomTransaction。
5. C++ Runtime Thread 使用 libuv；UI Loop 保持平台所有权。
6. 采用 QuickJS external object/function 的 JSI-like direct binding。
7. Core 到 RenderBackend 使用 typed MountTransaction，不经过 JS Bridge。
8. Yoga 只负责布局，StyleResolver 在 Core，文本测量由 Backend 提供。
9. 生命周期最终遵循联盟语义，但第一阶段只实现示例闭环所需子集。

### 11.2 尚待决策

1. **QuickJS 原版或 QuickJS-ng。** 当前倾向 QuickJS-ng，但需用 Android/iOS/ESP32-S3 build、footprint 和真实 RPK PoC 定案。
2. **版本锁定方式。** 建议 vendor 精确 tag/commit，记录 checksum、编译参数和有序 patch 集，不跟随浮动 branch。
3. **Measure 协议。** 同步、缓存和异步二次 layout 的边界。
4. **Shadow Tree 更新模型。** transaction 内 mutable、commit 后 immutable，或从第一版使用完整 COW immutable tree。
5. **Render Binding 编码。** 第一版逐个 Host Function 写 TransactionBuilder，还是直接使用 binary command buffer。
6. **Mount 调度。** 立即 post UI 与下一帧合并策略。
7. **事务背压。** UI 落后时 revision 合并、不可见页面抑制和结构操作顺序。
8. **隐藏页面 Surface。** retain、detach 或销毁重建策略。
9. **ESP32-S3 Event Loop。** libuv port 或 FreeRTOS backend。

## 12. 文档和开发顺序

继续遵循设计先行：

```text
REQUIREMENTS
  -> ARCHITECTURE
  -> product DESIGN
  -> TECH-DESIGN
  -> contracts/spec overview
  -> concrete specs
  -> agent implementation
```

下一位 agent 不应直接开始大规模编码。应先把本交接中的最新范围同步到 `README.md`、`REQUIREMENTS.md` 和 `ARCHITECTURE.md`，特别是修正“第一阶段完整联盟兼容”的错误预期，然后逐项确认待决策事项。

讨论应一次聚焦一个核心问题，避免同时展开过多实现细节。建议下一个问题先确定 `StyleResolver + Yoga + MeasureService` 的边界。

## 13. 代码与资料位置

文档：

```text
/Users/qiaoyang/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v2
```

代码 workspace：

```text
/Users/qiaoyang/code/my-github/quickapp-kit-ai
```

联盟参考实现：

```text
/Users/qiaoyang/code/my-github/hap-toolkit
/Users/qiaoyang/code/my-github/hapjs
```

第一阶段示例输入位于：

```text
/Users/qiaoyang/code/my-github/quickapp-kit-ai/quickapp-examples
```

已存在的真实 RPK 示例包括：

```text
quickapp-code-test1/dist/com.example.case1.debug.1.0.0.rpk
quickapp-code-test1/dist/com.example.case1.release.development.1.0.0.rpk
```
