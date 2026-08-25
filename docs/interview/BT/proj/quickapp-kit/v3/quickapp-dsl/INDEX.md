# QuickApp DSL

## 结论

本目录用于沉淀联盟 QuickApp DSL 的事实资料，以及 QuickApp Kit 对组件、框架语义和 Feature 的吸收边界。

核心区分只有两类：

```text
组件：进入 Runtime Tree，经过 Core Layout/Render，再由平台 Host 渲染
Feature：通过 JS API，经 Bridge/Feature Registry，交给平台 Provider 执行
```

当前资料分为：官方 DSL 参考、能力清单、QuickApp Kit 执行计划。

## 目录

### 1. 本目录文档

| 文档 | 用途 |
| --- | --- |
| [dsl-feature.md](./dsl-feature.md) | 联盟组件、框架 DSL、系统接口和 QuickApp Kit 采用顺序 |
| [CAPABILITY-EXECUTION-PLAN-2026-08-25.md](./CAPABILITY-EXECUTION-PLAN-2026-08-25.md) | 能力批次、边界、验收和 Agent 执行计划 |

### 2. 官方参考入口

| 分类 | 官方文档 |
| --- | --- |
| 总览 | [快应用官方文档](https://doc.quickapp.cn/) |
| 框架 | [框架参考](https://doc.quickapp.cn/framework/) |
| UX 文件 | [UX 文件](https://doc.quickapp.cn/framework/source-file.html) |
| Template | [Template 模板](https://doc.quickapp.cn/framework/template.html) |
| Style | [Style 样式](https://doc.quickapp.cn/framework/style-sheet.html) |
| 组件 | [组件参考](https://doc.quickapp.cn/widgets/) |
| Feature/API | [接口参考](https://doc.quickapp.cn/features/) |

### 3. DSL 核心语义

| 语义 | 官方参考 |
| --- | --- |
| 数据绑定 | [Template 数据绑定](https://doc.quickapp.cn/framework/template.html) |
| 条件渲染 | [Template 条件渲染](https://doc.quickapp.cn/framework/template.html) |
| 列表渲染与 `tid` | [Template 列表渲染](https://doc.quickapp.cn/framework/template.html) |
| 事件绑定 | [Template 事件绑定](https://doc.quickapp.cn/framework/template.html) |
| 页面与组件脚本 | [Script 脚本](https://doc.quickapp.cn/framework/script.html) |
| 路由 | [system.router](https://doc.quickapp.cn/features/system/router.html) |

### 4. 组件范围

#### 第一批

```text
View / Text / Button / Image / Input / List / Scroll
```

#### 后续批次

```text
Switch / Slider / Picker / Swiper
Video / Audio / Canvas / WebView
```

组件的架构归属：

```text
Toolkit DSL
-> Page IR
-> C++ Core Runtime Tree
-> Yoga Layout
-> RenderTransaction
-> Platform Host Component
```

### 5. Feature 范围

#### 第一批

```text
system.router
system.prompt
system.fetch
system.storage
```

#### 后续批次

```text
system.media
camera
recorder
album
file/request
share
webview
AI
```

Feature 的架构归属：

```text
JS Facade
-> Typed Bridge
-> C++ Core Feature Registry
-> Platform Feature Provider
```

Feature Provider 缺失时返回 typed `unsupported`；平台调用失败返回 typed `failed`；不得通过异常或旁路状态破坏 Runtime 主链。

### 6. QuickApp Kit 吸收原则

1. 联盟 DSL 是输入兼容基线，不代表所有联盟组件和 API 在第一阶段全部实现。
2. 组件优先保证 Runtime Tree、Layout、Render、Event 和 Lifecycle 闭环。
3. Feature 优先保证 Bridge、Registry、Provider 和失败语义闭环。
4. Core 保持平台无关；平台差异只进入 Host Renderer、Input Adapter 和 Feature Provider。
5. 嵌入式 Profile 以可裁剪和资源上限为约束，不支持的组件/Feature 必须显式拒绝。
6. 每个能力必须通过真实 Toolkit RPK 验收，不使用手写 Page IR 或旁路渲染。

### 7. 执行入口

当前能力实现顺序、所有权、批次验收和 Agent 交接规则，以 [CAPABILITY-EXECUTION-PLAN-2026-08-25.md](./CAPABILITY-EXECUTION-PLAN-2026-08-25.md) 为准。

