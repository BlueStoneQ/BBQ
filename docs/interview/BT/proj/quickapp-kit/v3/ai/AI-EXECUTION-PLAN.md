# QuickApp Kit AI 专题实施计划

## 结论

AI 是可裁剪外围能力，不进入 Core 固定内核。执行目标是先跑通：

```text
Chat 组件
-> system.ai
-> Mock Stream / Fetch Provider
-> 增量消息
-> JS 状态更新
-> List 增量渲染
```

WebSocket 和 Rust Agent Engine 都通过 Provider 接入，不改变 Bridge、Render Pipeline、Event Router、Navigation 或 Runtime Tree。

## 执行顺序

```text
A1 system.websocket 最小能力
-> A2 system.ai Contract + Mock Stream
-> A3 Chat 组合组件
-> A4 Android/iOS/LVGL Provider 验收
-> A5 Rust Agent Engine
-> A6 AI Showcase
```

每个任务完成后写入：

```text
v3/ai/AGENT-HANDOFF.md
```

记录修改文件、测试、RPK、SHA-256、剩余问题；完成后停止，不等待架构师确认。

## A1：system.websocket

范围：连接、发送、接收、关闭、错误、取消；先支持文本消息和 Mock/WebSocket Provider。

提示词：

```text
你负责 QuickApp Kit A1：system.websocket 最小公共能力。

只修改 quickapp-runtime-core、quickapp-runtime-js、quickapp-toolkit 及测试。
定义 typed Contract：connect、sendText、message、close、error、cancel。
接入 Core ModuleRegistry/Invoker、JS Facade、Toolkit capability lowering 和 websocket-001.rpk。
支持 Provider 不存在、连接失败、主动关闭、取消和 teardown；不使用通用 JSON Bridge。
Core 只管理请求生命周期和事件语义，具体网络实现留给 Platform Provider。
不得修改 Android、iOS、LVGL、已有 RPK、Bridge 主架构、Render Pipeline、Event Router 或 Navigation。
完成 Core/JS/Toolkit 定向测试，生成真实 websocket-001.rpk，并追加 v3/ai/AGENT-HANDOFF.md，然后停止。
```

## A2：system.ai + Mock Stream

范围：文本请求、增量 delta、完成、失败、取消；先使用确定性 Mock Provider，不依赖真实 AI 服务。

提示词：

```text
你负责 QuickApp Kit A2：system.ai 最小公共能力。

前置：A1 已完成；先读取 v3/ai/AGENT-HANDOFF.md。
定义 typed AI Contract：request、stream delta、completed、failed、cancelled。
实现 JS Facade、Core Registry/Invoker、Mock Stream Provider、Toolkit capability lowering 和 ai-001.rpk。
要求请求、流式事件、取消、超时、失败和 teardown 都有明确状态；delta 必须保持顺序。
AI 不直接依赖具体 Fetch/WebSocket 实现，Provider 可替换；不把 AI 逻辑写入 Core 固定内核。
不得修改 Android、iOS、LVGL 或现有公共主架构。
补充 Core/JS/Toolkit 测试，生成真实 ai-001.rpk，追加 handoff 后停止。
```

## A3：Chat 组合组件

范围：消息列表、输入、发送、流式追加、加载、失败重试；使用既有 List/Input/Button 组合，不新增原生 Host Component。

提示词：

```text
你负责 QuickApp Kit A3：Chat 组合组件和 chat-001.rpk。

前置：A2 已完成。
使用现有 List、Input、Button、Text 和 Image 组合实现 Chat，不新增 Core 原生组件。
实现消息列表、用户输入、发送、Mock Stream 增量追加、完成、失败、取消和重试。
消息状态必须由 JS/Core 唯一维护，Chat 不创建第二棵 Tree、第二套路由或私有 Bridge。
验证长消息增量更新、列表滚动、发送按钮、失败状态、返回和 teardown。
只修改 quickapp-toolkit、quickapp-examples 及必要的 JS 示例源码；不修改平台 Runtime。
生成真实 chat-001.rpk，运行 Toolkit 测试，追加 v3/ai/AGENT-HANDOFF.md 后停止。
```

## A4：三端 Provider 验收

Android、iOS、LVGL 可并行；只实现各自 Provider 和真实 RPK 验收。

提示词：

```text
你负责 QuickApp Kit A4 AI Provider 平台验收。

使用真实 chat-001.rpk，复用 Core AI Contract、JS Facade、Runtime Tree、Event Router 和 Lifecycle。
只修改自己的平台目录；实现 Mock Stream 或本地 deterministic Provider，验证请求、delta、完成、失败、取消和 teardown。
不得修改 Core、JS、Toolkit、公共 Contract、Examples Composition Root 或其他平台。
不得创建平台私有状态树、旁路 Bridge 或第二套路由。
记录首屏、发送、流式追加、滚动、失败、取消、资源归零和构建结果，追加 v3/ai/AGENT-HANDOFF.md 后停止。
```

## A5：Rust Agent Engine

范围：先定义协议和最小本地 Engine；不接入 Chat 主链，避免阻塞 AI 基础能力。

提示词：

```text
你负责 QuickApp Kit A5：Rust Agent Engine 最小设计与实现。

先读取现有 system.ai Contract，不修改 Core、JS、Toolkit 或平台 Runtime。
定义独立 Agent Protocol：request、tool call、stream delta、completed、failed、cancelled。
实现最小 Rust Engine：任务生命周期、上下文、工具调用、取消和流式输出；先使用 Mock Tool。
Engine 通过 system.ai Provider 接入，不能直接操作 Runtime Tree、Platform View 或内部 Bridge。
补充协议测试、取消测试、失败测试和内存释放测试；完成后追加 handoff 并停止。
```

## A6：AI Showcase

由 Example Agent 使用已通过的 `chat-001.rpk` 和 AI Provider 制作最终展示案例；不反向修改公共协议。

验收目标：移动端展示文本 Chat 和流式回复，嵌入式展示小屏 Chat 状态卡片；均支持输入、发送、增量消息、失败和返回。

## 放行条件

```text
公共 Contract/ABI 通过
-> chat-001.rpk 可加载
-> 三端 Provider 真实运行
-> delta/取消/失败/teardown 通过
-> AI Showcase 完成
```

完整 WebSocket、语音、摄像头、本地大模型和复杂 Agent 编排不属于第一轮 AI 主链，不得阻塞 A1-A6。
