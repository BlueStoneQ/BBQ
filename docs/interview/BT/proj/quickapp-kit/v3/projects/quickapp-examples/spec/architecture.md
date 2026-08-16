# Examples 总 Spec：总体架构

## 目录

- [1. 结论](#1-结论)
- [2. Case 结构](#2-case-结构)
- [3. 事实与期望分层](#3-事实与期望分层)
- [4. 变更规则](#4-变更规则)
- [5. 跨项目边界](#5-跨项目边界)

## 1. 结论

Examples 采用**源码事实、参考产物、行为期望分离**的基线结构。源码是 Toolkit 输入，参考产物用于研究，行为期望是 Runtime 验收，不把任一层伪装成另一层。

## 2. Case 结构

```text
case-xxx/
  source/ or existing alliance project
  reference/        # alliance build/RPK facts when available
  expectation/      # behavior and trace assertions
  provenance        # source/version/change history
```

实际目录命名由对应分 Spec 冻结；总 Spec 只冻结职责分层，不要求现在迁移或复制现有样例。

## 3. 事实与期望分层

| 层 | 内容 | 消费方 |
|---|---|---|
| Source Fact | Manifest、`.ux`、script/style/assets | Toolkit |
| Reference Fact | 联盟 build JS、debug/release RPK 结构 | Research/inspect |
| Runtime Expectation | lifecycle、screen、event、navigation、update、destroy | Runtime/Benchmark |

Case 001 的 Reference Fact 不自动成为 QuickApp Kit Runtime 输入合同；正式输入仍由本 Toolkit 从 Source Fact 生成。

## 4. 变更规则

```text
propose case change
  -> explain missing contract coverage
  -> confirm not adapting to current implementation
  -> architecture owner approval
  -> update expectation and provenance
  -> regenerate Toolkit/Benchmark evidence
```

Case 001 原始业务行为原则上冻结。需要新机制时优先新增或修改 Case 002，不把多个无关目标塞入 Case 001。

## 5. 跨项目边界

- Toolkit 读取源码并拥有编译 Golden。
- Runtime 读取 Toolkit 产物并拥有执行结果。
- Benchmark 读取 expectation 并拥有驱动和数据。
- Examples 只拥有输入、来源和预期，不修改公共合同。

