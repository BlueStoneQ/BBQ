# QuickApp Examples v3 Spec

## 目录

- [结论](#结论)
- [总 Spec](#总-spec)
- [状态](#状态)

## 结论

Examples 是跨 Toolkit/Runtime/Benchmark 的共享验收输入，不承载框架实现。

| Case | 作用 |
|---|---|
| Case 001 | 联盟真实样例：App/Page 生命周期、首屏、click、router、prompt、页面销毁 |
| Case 002 | 合同补充样例：state update、RenderTransaction、if、keyed for move |

代码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/`

Case 001 不新增行为；Case 002 只补齐 state update、`if` 和 keyed `for`。精确断言以总 [V1 Scope And Acceptance](../../../spec/v1-scope-and-acceptance.md) 为准。

## 总 Spec

- [需求](./requirements.md)
- [总体架构](./architecture.md)
- [分 Spec 索引](./subspec-index.md)
- [验收](./acceptance.md)

## 状态

第五次定向复核 `PASS`；当前 `DESIGN_ALLOWED + CODE_BLOCKED`，允许设计 EX-S01。
