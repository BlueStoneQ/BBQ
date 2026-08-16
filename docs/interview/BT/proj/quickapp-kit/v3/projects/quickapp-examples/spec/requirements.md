# Examples 总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 项目使命](#2-项目使命)
- [3. Case 定义](#3-case-定义)
- [4. V1 功能需求](#4-v1-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 边界](#6-边界)

## 1. 结论

Examples 的本质是：**为 Toolkit、Runtime 和 Benchmark 提供冻结的联盟 DSL 输入与可观察行为，不承载框架实现，也不为通过测试而改变语义。**

## 2. 项目使命

```text
Frozen DSL Case
  -> Toolkit build
  -> Runtime execute
  -> Benchmark drive
  -> shared expected behavior
```

Case 源码、预期行为和修改历史共同构成验收基线。

## 3. Case 定义

| Case | 定位 | 必须覆盖 |
|---|---|---|
| Case 001 | 联盟真实样例基线 | App/Page、首屏、click、router、prompt、Page Control、destroy |
| Case 002 | Runtime 增量主场景 | state update、if、keyed reorder/move/reuse |
| BLOCK-001 | keyed Block focused fixture | keyed add/remove、Block/Handler 释放 |
| CAP-DEVICE-001 | device focused fixture | Manifest declaration、getInfo required fields、unsupported/failure |

Case 001 固定来自现有真实联盟样例，不为补 Hook 或状态更新而修改业务逻辑。Case 002 保持一个点击完成 update/if/reorder；add/remove 不伪称由该源码覆盖，而由最小 focused fixture `BLOCK-001` 验证。

## 4. V1 功能需求

| ID | 需求 |
|---|---|
| EX-R01 | 保存 Case 001 原始源码、构建目录和联盟 debug/release RPK 基线。 |
| EX-R02 | 明确 Case 001 源码事实、构建产物事实和 Runtime 预期，三者不得混写。 |
| EX-R03 | Case 002 使用联盟 DSL V1 子集，并以一个可重复交互覆盖 update、if 和 keyed move/reuse。 |
| EX-R04 | 每个 Case 声明入口 route、操作步骤、可见结果、Trace 断言和销毁后断言。 |
| EX-R05 | Case 变更必须有原因、影响合同、预期变化和重新生成 Golden 的记录。 |
| EX-R06 | 同一 Case 源码供 Android、LVGL/SDL 和 iOS 使用，不建立平台分叉源码。 |
| EX-R07 | Examples 不包含 Toolkit、Core、JS Runtime 或 Platform Adapter 代码。 |
| EX-R08 | Negative fixtures 只验证明确编译/加载错误，不与正向 Case 混合。 |
| EX-R09 | BLOCK-001 以确定步骤分别验证 keyed add/remove；remove 后对应 BlockInstanceId、Handler、Node 和 Host 映射全部释放。 |
| EX-R10 | CAP-DEVICE-001 必须显式声明并调用 `system.device.getInfo`，验证 required fields 和失败语义；不得修改 Case 001 补 device。 |
| EX-R11 | `PROFILE-MISSING-001` 必须分别提供缺失 Host Component 与缺失 Capability 的最小 Artifact 输入，用于验证 Runtime 在执行 JS 前返回 `RUNTIME_PROFILE_INCOMPATIBLE`。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 真实性 | Case 001 保留联盟来源和原始结构，可追溯。 |
| 最小性 | Case 002 只包含验证增量机制所需语义。 |
| 稳定性 | Case identity、入口和关键操作不随实现重命名。 |
| 跨平台 | 不使用只在某个平台生效的源码分支。 |
| 可观测 | 每个行为能由屏幕结果与结构化 Trace 双重确认。 |

## 6. 边界

Examples 不负责：

- 生成 Bundle、IR、RPK 或 Golden。
- 实现自动化驱动和指标采集。
- 定义公共 Runtime 协议。
- 为展示更多功能扩张 V1 组件和能力范围。
