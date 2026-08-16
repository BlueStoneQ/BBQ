# EX-S02 任务

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. Examples 任务](#3-examples-任务)
- [4. 消费方任务](#4-消费方任务)
- [5. 依赖关系](#5-依赖关系)
- [6. 需求覆盖](#6-需求覆盖)
- [7. 完成定义](#7-完成定义)

## 1. 结论

先由 Examples 固化四个最小输入及机器可读期望，再由 Toolkit 构建、Runtime 执行、Benchmark 采集；Examples 不越权完成消费方任务。

## 2. 门禁

当前仅允许设计。以下任何源码、baseline 数据或产物任务都必须等待 EX-S02 独立校审 `PASS` 且工作看板显式设置 `CODE_ALLOWED`。

## 3. Examples 任务

| Task | 依赖 | 工作 | 完成证据 |
|---|---|---|---|
| EX-S02-T01 | 无 | 固化 CASE-002 Source inventory/provenance/usage/scenario，验证当前 snapshot | digest 与 Spec 一致；源码不变 |
| EX-S02-T02 | T01 | 创建最小 BLOCK-001：initial `[A,B]`、add C、remove B、re-add B、item Handler | Source identity、操作与身份期望 |
| EX-S02-T03 | T01 | 创建最小 CAP-DEVICE-001：Manifest declaration、getInfo、状态/字段展示 | Source identity、success/failure/cleanup 场景 |
| EX-S02-T04 | T01 | 创建最小 EVENT-REQUEST-001：nested Handler、sync update、deferred Promise | Source identity、连续/冒泡/同步/异步场景 |
| EX-S02-T05 | T02,T03,T04 | 为四个 Fixture 生成机器可读 inventory、provenance、usage/scenario 和只读校验 | 零依赖校验通过，不生成产品产物 |

## 4. 消费方任务

| Task | Owner | 依赖 | 工作 |
|---|---|---|---|
| EX-S02-T06 | Toolkit | T05 + 对应 Toolkit 分 Spec | 构建/inspect 四个 Runtime Artifact，输出 IR/Bundle/Artifact Golden |
| EX-S02-T07 | JS/Core | T06 + 对应 Runtime 分 Spec | 用合同测试证明 Render/Block/Event/Capability 状态与错误 |
| EX-S02-T08 | LVGL/Android/iOS | T06,T07 | 同一 Artifact 执行固定操作并采集可见、ID、清理证据 |
| EX-S02-T09 | Benchmark | T08 | 校验 Trace Schema、RequestId 因果与跨平台结果 |

Examples 不执行 T06-T09，不在自身工程实现编译器、Runtime、平台 Driver 或 Collector。

## 5. 依赖关系

```text
EX-S02 PASS + CODE_ALLOWED
  -> T01
  -> T02 + T03 + T04
  -> T05
  -> Toolkit T06
  -> Runtime T07
  -> Platform T08
  -> Benchmark T09
```

任何公共合同冲突先写 `[待决策]` 并暂停受影响 Fixture；不得在源码中建立私有协议绕过。

## 6. 需求覆盖

| 需求 | Examples 任务 | 最终消费方任务 | 验收入口 |
|---|---|---|---|
| R01-R07 通用 | T01-T05 | T06-T09 | acceptance 2、7、8 |
| R08-R14 CASE-002 | T01,T05 | T06-T09 | acceptance 3 |
| R15-R20 BLOCK-001 | T02,T05 | T06-T09 | acceptance 4 |
| R21-R26 CAP-DEVICE-001 | T03,T05 | T06-T09 | acceptance 5 |
| R27-R32 EVENT-REQUEST-001 | T04,T05 | T06-T09 | acceptance 6 |

## 7. 完成定义

- 四个 Fixture 职责无重叠、identity 稳定且使用同一跨平台源码。
- CASE-002 只证明 update/if/reorder；BLOCK-001 单独证明 add/remove/cleanup。
- CAP-DEVICE-001 覆盖 success/failure/in-flight cleanup，Case 001 保持不变。
- EVENT-REQUEST-001 明确连续输入、target/bubble、同步继承和异步不继承。
- 消费方最终提供同一 Artifact 的三平台结构化证据；没有降低公共合同断言。
