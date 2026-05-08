# 快应用框架的三线程模型

三线程是整个框架的线程模型，不只是渲染管线：

| 线程 | 职责 |
|------|------|
| JS Thread | 执行所有 JS（业务逻辑 + 虚拟 DOM diff + Feature 调用） |
| IO Thread Pool | 解析渲染 JSON + 异步 Feature 执行 |
| UI Thread | 创建/更新 Android View + 事件采集 |

渲染管线是其中一条链路：JS Thread（生成 Action）→ IO Thread（解析 JSON）→ UI Thread（应用 View 变更）。

Feature 调用也走这些线程：JS 同步调用 → IO 线程池异步执行 → 回调回 JS 线程。
