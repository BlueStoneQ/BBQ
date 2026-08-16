# QuickApp Kit v2 子 Spec 设计

## 目录

- [1. 结论](#1-结论)
- [2. 子 Spec 列表](#2-子-spec-列表)
- [3. 子 Spec 标准目录](#3-子-spec-标准目录)
- [4. 开发顺序](#4-开发顺序)
- [5. 交付规则](#5-交付规则)

## 1. 结论

QuickApp Kit v2 每个 org 项目对应一个子 Spec。子 Spec 负责把总架构落到具体项目的需求、架构、技术设计、任务和步骤。

## 2. 子 Spec 列表

| 子 Spec | 优先级 | 说明 |
|---|---:|---|
| quickapp-runtime-android | P0 | 首发孵化宿主 |
| quickapp-runtime-js | P0 | JS Framework |
| quickapp-toolkit | P0 | CLI-first 工具链 |
| quickapp-examples | P0 | 验收输入 |
| quickapp-runtime-core | P0 | Android 后抽取的通用 Core |
| quickapp-runtime-lvgl | P1 | 嵌入式验证后端 |
| quickapp-benchmark | P1 | 可观测验收 |
| quickapp-runtime-ios | P2 | iOS 后端补全 |

## 3. 子 Spec 标准目录

每个子 Spec 目录统一包含：

```text
README.md
requirements.md
arch-design.md
tech-design.md
tasks.md
steps/
```

## 4. 开发顺序

```text
toolkit / runtime-js / examples 并行准备
  -> android 首发链路
  -> core 抽取
  -> lvgl + SDL Simulator
  -> benchmark
  -> ios
```

## 5. 交付规则

1. 子 Spec 必须引用相关 contracts。
2. 子 Spec 必须标记关键决策和重点吸收点。
3. 子 Spec 必须有明确输入、输出、验收标准。
4. steps 文档应能直接交给 agent 执行。
