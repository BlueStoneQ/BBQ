# docs-2026 — 动态渲染框架知识库

## 开源参考资源

| 项目 | 出品 | 技术栈 | 定位 |
|------|------|--------|------|
| [DivKit](https://github.com/divkit/divkit) | Yandex | Android + iOS + Flutter + Web | 最成熟的生产级 SDUI 框架，JSON 协议驱动，Yandex 全家桶在用 |
| [Stac](https://github.com/StacDev/stac) | 社区 | Flutter (Dart) | 纯 Flutter SDUI，JSON → Widget 映射，轻量易用 |
| [serve_dynamic_ui](https://github.com/Arunshaik2001/serve_dynamic_ui) | 社区 | Flutter (Dart) | 轻量 SDUI 库，适合快速原型 |
| [flutter_duit](https://github.com/Duit-Foundation/flutter_duit) | 社区 | Flutter (Dart) | 服务端驱动 UI toolkit |
| [json_dynamic_widget](https://pub.dev/packages/json_dynamic_widget) | 社区 | Flutter (Dart) | JSON → Flutter Widget，支持大部分内置组件 |

DivKit 最值得研究 — 协议设计成熟（JSON Schema）、多平台覆盖、有增量更新 + 表达式引擎。但它每个平台独立实现，没有统一引擎层。

---

## 文档索引

### 架构与渲染

| 文档 | 内容 |
|------|------|
| [architecture-overview.md](./architecture-overview.md) | 框架分层架构、模块职责、技术选型、对比 |
| [input-to-render-pipeline.md](./input-to-render-pipeline.md) | Input 形式（4 份 JSON）→ Rust 引擎处理 → Output（FrameUpdate）→ Flutter 渲染，完整主流程 |
| [runtime-rendering-flow.md](./runtime-rendering-flow.md) | 从 rpk 到像素的完整渲染链路、通信协议、双线程模型 |
| [cross-layer-communication.md](./cross-layer-communication.md) | 三层物理架构、Dart FFI / SharedUpdateBuffer / 事件上行 |
| [cross-layer-ipc-comparison.md](./cross-layer-ipc-comparison.md) | FFI / JSI / Bridge / Channel / JNI / WASM 六种方案对比 + 底层原理 |

### 岗位分析

| 文档 | 内容 |
|------|------|
| [jd-match-analysis.md](./jd-match-analysis.md) | LN 岗位匹配度分析、稀缺性分析、叙事翻译、风险应对 |

### aria-render 开源项目规划

| 文档 | 内容 |
|------|------|
| [aria-render/requirements.md](./aria-render/requirements.md) | 需求文档（问题定义、功能需求、验收标准） |
| [aria-render/tech-design.md](./aria-render/tech-design.md) | 技术设计（架构、数据流、数据结构、FFI、选型） |
| [aria-render/tasks.md](./aria-render/tasks.md) | 任务拆解（3 周 MVP，Phase 1/2/3 + 依赖关系） |
