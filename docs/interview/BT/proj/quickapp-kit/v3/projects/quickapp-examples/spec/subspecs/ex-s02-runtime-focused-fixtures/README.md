# EX-S02 Runtime Focused Fixtures

## 目录

- [1. 结论](#1-结论)
- [2. Fixture 清单](#2-fixture-清单)
- [3. 范围](#3-范围)
- [4. 事实状态](#4-事实状态)
- [5. 依赖与交付](#5-依赖与交付)
- [6. 状态](#6-状态)

## 1. 结论

EX-S02 用四个互不冒充的最小输入证明 Runtime 增量渲染、Block 生命周期、device typed Capability 和输入因果关联。Examples 只冻结源码输入、来源、操作与结果；Toolkit、JS、Core、Platform 和 Benchmark 分别证明自己的实现。

## 2. Fixture 清单

| ID | 唯一职责 |
|---|---|
| `CASE-002` | 一次点击完成 text update、conditional Block remove、keyed reorder/move/reuse |
| `BLOCK-001` | keyed add/remove/re-add 与 Block/Handler/Node/NativeHandle 清理和 ID 不复用 |
| `CAP-DEVICE-001` | `system.device.getInfo` success/failure/in-flight cleanup |
| `EVENT-REQUEST-001` | 连续输入 RequestId 唯一、目标/冒泡共享 ID、同步更新继承、异步任务不自动继承 |

## 3. 范围

包含：

- 四个 Fixture 的稳定 identity、最小 DSL 语义和 provenance 规则。
- 初始状态、确定操作、可见结果、跨层 operation/ID/Trace 和销毁断言。
- LVGL/SDL、Android、iOS 使用同一 Fixture Artifact 的一致性规则。

不包含：

- 修改或创建 Fixture 源码、生成 Bundle/IR/RPK/Golden。
- 实现 Diff、Binding、Block、Event Router、Provider 或平台驱动。
- Case 001 的 device 改造。
- 编译/加载负例与 Profile 缺失，后者属于 EX-S03。

## 4. 事实状态

- `[已验证事实]`：`quickapp-code-test2` 已存在；一次 `onUpdate` 同步写入 `count`、`visible`、`items`。
- `[待验证]`：`BLOCK-001`、`CAP-DEVICE-001`、`EVENT-REQUEST-001` 的源码与 identity 尚未创建，必须等待 EX-S02 `CODE_ALLOWED`。
- `[待验证]`：四个 Fixture 的 Toolkit Artifact 和三平台运行结果。

上述 `[待验证]` 内容不是实现事实；本分 Spec 只冻结未来输入必须表达的语义。

## 5. 依赖与交付

依赖公共 Render、Block Lifecycle、Event、Capability Module、Feature 和 Observation 合同。固定交付：

- [requirements.md](./requirements.md)
- [design.md](./design.md)
- [tasks.md](./tasks.md)
- [acceptance.md](./acceptance.md)

## 6. 状态

`READY_FOR_REVIEW + CODE_BLOCKED`。独立校审和工作看板放行前，不得修改 Fixture 源码或生成产品产物。
