**从静态架构设计看，QuickApp Kit 是先进且干净的。**

核心原因不是用了 C++、事务或很多 ID，而是它把三个问题分开了：

```text
JS Framework：表达业务状态和增量意图
C++ Core：维护唯一权威 Runtime Tree，完成运行时决策
Platform：执行 Host 操作并采集输入
```

其中几个设计点很有价值：

- **单一权威 Runtime Tree**：不维护两棵可变树，也不做完整 Tree Diff。
- **事务化边界**：JS-C++ 使用 `RenderTransaction`，Core-Platform 使用 `MountTransaction`。
- **Typed Port**：不用通用 JSON Bridge，也不跨层传递平台对象或 JS 函数句柄。
- **稳定身份系统**：各层通过类型化 ID 寻址，避免对象直接互相持有。
- **Core 权威状态**：渲染、事件、Surface、路由都不会被具体平台反向控制。
- **薄 Platform Adapter**：Android、LVGL、iOS只实现同一组平台合同。
- **异步值通信**：使用 `RequestId + Result`，Promise 只留在 JS。
- **嵌入式友好**：外围可裁剪，JS 引擎可替换，内存与线程模型可控制。

与 HAP 相比，它把原本集中在 JS Framework 和 Android Runtime 中的责任重新分层；与旧 RN Bridge 相比，它避免细粒度序列化调用；与 Flutter 相比，它保留动态 JS 业务能力，同时把跨平台运行时语义收敛到 C++ Core。