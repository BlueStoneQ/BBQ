# V1 LVGL Runtime 实施路线

## 目录

- [1. 定位](#1-定位)
- [2. Core Track](#2-core-track)
- [3. 后续能力](#3-后续能力)
- [4. 当前状态](#4-当前状态)
- [5. 验收合同](#5-验收合同)
- [6. Code Agent 执行合同](#6-code-agent-执行合同)

## 1. 定位

先完成一套基本可用的 LVGL QuickApp Runtime，再把已经验证的 Core、JS Framework 和 Toolkit 复用到 Android/iOS。

主线只有一条：

```text
联盟 DSL -> Toolkit/RPK -> JS Framework -> C++ Core -> LVGL
```

不改变总架构、唯一 Runtime Tree、Core Router、Bridge ABI 或三大系统边界。

## 2. Core Track

Core Track 只实现“第一个基本可用快应用”所必需的能力。外围能力不得进入本阶段门禁。

### CORE-1：多页和模板主链

- `Home -> Detail` 两个页面。
- 真实联盟 DSL 经 Toolkit 生成 RPK。
- `View`、`Text`、`Button`。
- state 更新。
- `if` 条件渲染。
- keyed `for` 列表。
- 列表移动、增删和复用。

### CORE-2：事件和路由

- `click`。
- Platform/LVGL -> Core Event Router -> JS Handler。
- Core Router push/back。
- 页面 create/show/hide/destroy。
- stale Handler 拒绝。

### CORE-3：基础渲染

- width/height。
- margin/padding。
- Flex：flexDirection、justifyContent、alignItems。
- color/backgroundColor。
- fontSize/textAlign。
- borderRadius。
- 基础文本测量和最终 Layout。

### CORE-4：第一个可用 Runtime 验收

- Home 首屏可见。
- state 更新后 `if` 和列表发生可见变化。
- 点击进入 Detail。
- 返回 Home 并恢复页面状态。
- 同一真实 RPK 完整运行。
- teardown 后 Runtime Node、Handler、NativeHandle、JS 资源归零。
- 旧 Case 001、CASE-002、BLOCK-001 回归通过。

CORE-4 完成后，才宣布“第一个基本可用 LVGL Runtime 已形成”。

## 3. 后续能力

这些能力不阻塞 Core Track。

### P1：基础能力补齐

- Image 包内资源。
- Input、`input/change/focus`。
- RPK、组件、Render、Mount 失败。
- full rebuild 降级。
- 基础滚动容器和长列表。
- Simulator 可稳定加载真实 RPK、持续接收输入并 teardown。

### P1-FEATURE：应用能力

- `system.prompt`、`system.device`、title/meta。

### P2：产品化和工程能力

- Simulator 参数化 RPK 的完整工具化入口。
- `simulator` 与 `embedded-min` Profile。
- SDL、诊断和文件系统裁剪。
- 最小 Trace 和计数器。
- Android/iOS 同 Fixture 复用验收。

### P3：生态扩展

- `fetch`、`storage`。
- checkbox、switch、slider、list 等更多组件。
- 权限、媒体、复杂手势和动画。
- Benchmark 和性能调优。

## 4. 当前状态

| 阶段 | 状态 |
|---|---|
| CORE-1 多页/state/if/keyed for/list | `VERIFIED` |
| CORE-2 click/Handler/Router/lifecycle | `VERIFIED` |
| CORE-3 基础样式和布局 | `VERIFIED` |
| CORE-4 可见应用和资源清理 | `VERIFIED` |
| P1 基础能力补齐 | `VERIFIED` |
| P1-FEATURE 应用能力 | `VERIFIED` |
| P2 产品化和三端复用 | `READY_ANDROID_REUSE` |
| P3 生态扩展 | `HOLD_CORE_TRACK` |

## 5. 验收合同

```text
真实联盟 DSL
-> Toolkit
-> 唯一 RPK
-> LVGL/SDL
-> Home 首屏
-> state 更新
-> if 切换
-> keyed for 列表移动/增删
-> click -> JS Handler
-> Core Router push
-> Detail
-> Router back
-> Home 恢复
-> teardown 资源归零
```

阶段完成必须满足：

1. 禁止手写 Page IR、RenderTransaction、MountTransaction。
2. UI 结果在 LVGL/SDL 中可见，并由真实输入触发。
3. Core 仍是唯一 Runtime Tree、Navigation、Lifecycle 权威。
4. 无平台旁路状态、第二套路由或第二棵树。
5. 旧 Case 001、CASE-002、BLOCK-001 回归通过。
6. teardown 后资源归零。

## 6. Code Agent 执行合同

### 工作入口

Code Agent 只以本文件为 LVGL 实施目标；共享交接只追加运行结果：

`v3/v1-basic-runtime/INTEGRATION-HANDOFF.md`

### 连续执行规则

- 先完成 `CORE-1 -> CORE-2 -> CORE-3 -> CORE-4`。
- 完成一个 Core 阶段后自动进入下一个，不等待用户、架构师或新的 Spec。
- 不修改 Android、iOS、Benchmark，直到 CORE-4 完成。
- 普通编译、链接、Fixture、Mount 和事件问题自行修复。
- 不新增第二棵 Tree、第二套路由、平台旁路状态或新的公共 Bridge。
- 公共 Contract 只允许向后兼容的最小扩展。
- 只有架构边界冲突、不可兼容 Contract 或环境完全不可用才记录 `BLOCKED`。
- 不停在“设计完成”“Contract ready”或“evidence ready”。

### 直接执行提示词

```text
你是 QuickApp Kit 的 LVGL-only Code Agent。

唯一目标：完成第一个基本可用的 LVGL QuickApp Runtime。当前只做 Core Track，不做外围能力，不修改 Android、iOS、Benchmark，不等待架构师确认，不继续写 Spec。

主链：
联盟 DSL -> Toolkit/RPK -> JS Framework -> C++ Core -> LVGL

按顺序连续完成：

CORE-1：
1. 用真实联盟 DSL 创建 Home 和 Detail 两个页面；
2. Home 包含 state、if、keyed for 列表、View/Text/Button；
3. Toolkit 生成唯一真实 RPK；
4. LVGL/SDL 首屏、state、if、列表移动/增删可见。

CORE-2：
1. Button click 进入 Core Event Router 和 JS Handler；
2. 实现 Home -> Detail push；
3. 实现 Detail -> Home back；
4. 完成页面 create/show/hide/destroy 和 stale Handler 拒绝。

CORE-3：
1. 补齐 width/height、margin/padding、Flex、颜色、字号、对齐、圆角；
2. 补齐基础文本测量和最终 Layout；
3. 保持唯一 Runtime Tree 和 Mount 链路。

CORE-4：
1. 真实 RPK 完整运行；
2. Home/Detail、state、if、keyed for、click、push/back 全部可见；
3. 运行旧 Case 001、CASE-002、BLOCK-001 回归；
4. teardown 后 Runtime Node、Handler、NativeHandle、JS 资源归零。

CORE-4 完成后，才继续 P1：Image、Input、prompt/device、失败恢复、滚动容器、Simulator 产品化、裁剪和观测。

严格禁止：
- Image/Input 在 CORE-1 前插入主线；
- fetch、storage、权限、媒体、Benchmark 插入主线；
- 新增第二套路由、第二棵树、平台旁路状态或通用 JSON Bridge；
- 手写 Page IR、RenderTransaction、MountTransaction；
- 为补 Spec、证据或文档停止编码；
- reset、checkout 或删除工作区已有修改。

遇到普通编译、链接、Fixture、Mount 或事件问题，直接选择与现有代码一致的最小实现并继续。只有真实架构冲突、不可兼容 Contract 或环境完全不可用才记录 BLOCKED。

每个阶段执行 Toolkit 测试、CMake 构建、真实 RPK 运行和资源清理检查，并追加到：

v3/v1-basic-runtime/INTEGRATION-HANDOFF.md

交付格式：阶段、状态、Fixture、RPK、SHA-256、构建命令、运行命令、可见结果、Core/事件/路由结果、资源清理、旧 Case 回归、下一阶段。

CORE-4 完成后报告“第一个基本可用 LVGL Runtime 已形成”，再自动继续 P1。
```
