# QuickApp Kit v2 总 Spec

## 目录

- [1. 结论](#1-结论)
- [2. 文档结构](#2-文档结构)
- [3. 子 Spec 划分](#3-子-spec-划分)
- [4. 阅读顺序](#4-阅读顺序)

## 1. 结论

总 Spec 是 QuickApp Kit v2 的总体执行合同。它承接总需求和总架构，定义 Phase 0 到 Phase 1 的整体范围、核心方案、子 Spec 拆分和跨项目依赖。

```text
REQUIREMENTS.md
  -> ARCHITECTURE.md
  -> spec/
  -> contracts/
  -> projects/*/
  -> agent development
```

## 2. 文档结构

```text
spec/
├── README.md
├── requirements.md
├── arch-design.md
├── overall-design.md
├── sub-specs.md
├── capability-alignment.md
├── tasks.md
└── steps/
```

正式 Spec 的唯一目录是本目录 `spec/`。`projects/<project>/` 只保留产品级项目概览、需求摘要和项目管理信息；具体技术设计、合同、步骤和 Agent 交接放在 `spec/<project>/`。

## 3. 子 Spec 划分

QuickApp Kit v2 按 org 级项目矩阵拆分子 Spec：

| 子 Spec | 代码项目 |
|---|---|
| quickapp-runtime-android | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android` |
| quickapp-runtime-core | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-core` |
| quickapp-runtime-lvgl | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl` |
| quickapp-runtime-ios | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios` |
| quickapp-runtime-js | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js` |
| quickapp-toolkit | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit` |
| quickapp-examples | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples` |
| quickapp-benchmark | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-benchmark` |

## 4. 阅读顺序

1. [requirements.md](./requirements.md)
2. [arch-design.md](./arch-design.md)
3. [overall-design.md](./overall-design.md)
4. [sub-specs.md](./sub-specs.md)
5. [capability-alignment.md](./capability-alignment.md)
6. [tasks.md](./tasks.md)
