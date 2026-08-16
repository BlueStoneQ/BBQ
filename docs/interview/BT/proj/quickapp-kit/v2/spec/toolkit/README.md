# QuickApp Toolkit Spec

## 目录

- [1. 结论](#1-结论)
- [2. 文档结构](#2-文档结构)
- [3. 输入输出](#3-输入输出)
- [4. 依赖关系](#4-依赖关系)
- [5. V1 验收](#5-v1-验收)

上游实施指导：[SPEC-GUIDE.md](./SPEC-GUIDE.md)。它描述完整实施顺序；本目录中的各 Contract 文档负责冻结具体接口。

## 1. 结论

**Toolkit 的本质是编译器和打包器：把联盟 QuickApp DSL 编译成 QuickApp Kit Runtime 可消费的静态事实与 JS Bundle。**

```text
联盟 DSL
  -> Parse
  -> Normalize
  -> Analyze
  -> Lower IR
  -> Emit JS / IR
  -> Package RPK
```

Toolkit 不负责：

- 执行 JS；
- 维护 Runtime Tree；
- 计算 Yoga Layout；
- 创建 Android、iOS 或 LVGL 控件；
- 在构建期决定平台 NativeHandle。

## 2. 文档结构

| 文档 | 内容 |
|---|---|
| `requirements.md` | V1 支持范围、输入、输出和验收 |
| `arch-design.md` | 编译管线、模块边界和错误处理 |
| `compilation-pipeline.md` | 编译阶段输入输出和阶段规则 |
| `normalized-ir.md` | 前端归一化边界 |
| `ir-contract.md` | IR 总览示例 |
| `template-ir.md` | Template IR |
| `binding-metadata.md` | Binding Metadata |
| `block-ir.md` | Block IR |
| `handler-metadata.md` | Handler Metadata |
| `style-ir.md` | Style IR |
| `js-bundle-contract.md` | App/Page/Shared JS Bundle |
| `module-chunk-contract.md` | 模块 Chunk 与缓存 |
| `package-contract.md` | RPK、Manifest、Runtime Metadata |
| `runtime-abi.md` | JS Bundle 与 Runtime 注入接口 |
| `rpk-loader-contract.md` | RPK Loader 状态机和读取合同 |
| `cache-determinism.md` | 构建缓存与确定性 |
| `cli-contract.md` | CLI 命令和退出码 |
| `diagnostics.md` | 错误诊断结构 |
| `error-codes.md` | V1 错误码 |
| `testing-benchmark.md` | 测试层级和构建指标 |
| `tasks.md` | 实现任务与验证顺序 |

JSON Schema 位于 `schemas/`；可分派实施步骤位于 `steps/`。

按 Spec 模式管理的功能三件套位于 `features/`，每个功能固定包含：

```text
requirements.md -> design.md -> tasks.md
```

当前功能：`features/frontend-adapter/`。

已建立的其他 Feature Spec：

- `features/normalized-ir/`
- `features/js-bundle/`
- `features/rpk-package/`
- `features/cli-validation/`
- `features/analyzer-lowering/`
- `features/rpk-loader/`

执行入口：

1. 先读 `SPEC-GUIDE.md` 了解完整上下文。
2. 再按 `README.md`、各 Contract、`schemas/` 顺序实现。
3. 最后按 `steps/T0-T10` 交付并验收。

## 3. 输入输出

```text
输入：.ux / JS / Less / Manifest / Assets

输出：
  app.js
  shared chunks
  pages/<route>/index.js
  quickapp-kit/*.ir
  manifest.json
  resources
  RPK
```

V1 采用：

```text
联盟源码语义兼容
+ RPK 外层结构兼容
+ QuickApp Kit 自有页面 JS ABI 和 IR
```

## 4. 依赖关系

```text
Toolkit
  -> Package Contract
  -> JS Framework Contract
  -> RenderTransaction Contract
  -> Runtime Tree / NodeId Contract
```

Toolkit 只生产合同允许的产物，不依赖具体 Android、iOS、LVGL 实现。

## 5. V1 验收

1. Case 001 源码可以构建为目标 RPK。
2. RPK Loader 可以定位 `app.js`、页面入口和 IR。
3. 页面 IR 能表达静态节点、动态 Binding、`if`、基础 keyed `for`、事件和样式。
4. JS Framework 能根据 Bundle 和 IR 发出首屏 `InstantiateTemplate` 意图。
5. C++ Core 能根据 IR 创建唯一 Runtime Tree。
6. 构建结果可输出 Source Map、诊断错误和可复现构建信息。
