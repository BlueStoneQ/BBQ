# Examples 总 Spec：分 Spec 索引

## 目录

- [1. 结论](#1-结论)
- [2. 分 Spec 清单](#2-分-spec-清单)
- [3. 依赖关系](#3-依赖关系)
- [4. 启动门禁](#4-启动门禁)

## 1. 结论

Examples 按 Case 和负例分解；每个 Case 分 Spec 冻结来源、操作与期望，但不定义 Toolkit 或 Runtime 实现。

## 2. 分 Spec 清单

| ID | 分 Spec | 责任 | 主要输出 | 依赖 |
|---|---|---|---|---|
| EX-S01 | Case 001 Baseline | 联盟真实源码、参考产物、行为/Trace 期望、provenance | Case 001 基线 | 全局 V1 Scope |
| EX-S02 | Runtime Focused Fixtures | Case 002 update/if/reorder；BLOCK-001 keyed add/remove/cleanup；CAP-DEVICE-001 device contract | Case 002 与 focused fixtures 基线 | Render/Block/Event/Capability 合同 |
| EX-S03 | Negative Fixtures | 编译、加载与 `PROFILE-MISSING-001` 兼容性失败的最小输入及预期错误 | 负例集合 | Toolkit/Artifact/Composition 合同 |
| EX-S04 | Case Change Governance | identity、版本、变更记录和重新验收流程 | 基线治理规则 | EX-S01、EX-S02 |

## 3. 依赖关系

```text
V1 Scope -> EX-S01
Render/Block/Event/Capability Contract -> EX-S02
Artifact/Toolkit Contract -> EX-S03
EX-S01 + EX-S02 -> EX-S04
```

Case 001 与 Runtime Focused Fixtures 可以并行整理；任何源码变更必须经过 EX-S04 规则。

## 4. 启动门禁

总 Spec 通过后才写 Case 分 Spec；分 Spec 校审通过前不得修改 Case 源码、移动参考产物或生成新负例。
