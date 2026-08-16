# Toolkit 总 Spec：分 Spec 索引

## 目录

- [1. 结论](#1-结论)
- [2. 分解原则](#2-分解原则)
- [3. 分 Spec 清单](#3-分-spec-清单)
- [4. 依赖顺序](#4-依赖顺序)
- [5. 启动门禁](#5-启动门禁)

## 1. 结论

Toolkit 按“语义前端、Lowering、Artifact 后端、CLI 产品面”拆分；每个分 Spec 只拥有一种变化原因，并以明确 Artifact 或诊断作为输出。

## 2. 分解原则

1. Parser 不依赖 Runtime Schema。
2. Emitter 不重新解释联盟语法。
3. Package 不修改 Bundle 或 IR。
4. CLI 不包含编译业务规则。
5. 公共合同测试不在项目内复制 Schema。

## 3. 分 Spec 清单

| ID | 分 Spec | 责任 | 主要输出 | 依赖 |
|---|---|---|---|---|
| TK-S01 | CLI 与 Workspace | 命令、配置、工作区、退出码 | CLI 合同、Source Unit | 无 |
| TK-S02 | Manifest 与 Module Graph | route、module、asset、capability 关系 | Resolved App Model | TK-S01 |
| TK-S03 | UX/Script/Style Frontend | 解析、源码位置、Case-derived syntax/style matrix 与诊断 | Parsed Source Model/Feature Matrix | TK-S01 |
| TK-S04 | Canonical Lowering | Host Component、Style、Binding、Block、Event、稳定 ID | Semantic/Lowered Model | TK-S02、TK-S03 |
| TK-S05 | JS Module Emitter | App/Shared/Page Bundle、require.context、ESM/CJS/global、typed module reference、fetch deferred reference 与 bootstrap/export | JS Bundle、Source Map | TK-S04 |
| TK-S06 | Page IR Emitter | 静态模板图、Binding/Block/Handler 定义 | Page IR | TK-S04 |
| TK-S07 | Runtime Artifact | Metadata、Descriptor、关系校验、确定性 RPK | Runtime RPK | TK-S05、TK-S06 |
| TK-S08 | Inspect 与 Run | 包分析、消费 Runtime Composition Manifest、Artifact/Profile 兼容诊断、产生公共 Runtime Launch Profile、Runtime 启动适配 | inspect report、run invocation | TK-S01、TK-S07 |
| TK-S09 | Golden 与诊断 | Case 001/002、BLOCK-001、CAP-DEVICE-001、fetch deferred、负例、确定性和按 Observation Contract 发 marker | Golden、测试证据 | TK-S03 至 TK-S08、公共 Observation Contract |
| TK-S10 | Agent Skill 与 MCP Adapter（第二期） | Agent 知识包、typed tool 映射和结果一致性；不参与 V1 门禁 | Skill、MCP tools、合同测试 | V1 Toolkit 完成后 |

## 4. 依赖顺序

```text
TK-S01
  -> TK-S02 + TK-S03
  -> TK-S04
  -> TK-S05 + TK-S06
  -> TK-S07
  -> TK-S08
  -> TK-S09 持续覆盖

V1 Toolkit 完成 -> TK-S10（第二期）
```

TK-S05 与 TK-S06 可以并行，但必须共享同一 Lowered Model 和 ID 分配结果。

TK-S10 只消费已经冻结的 Toolkit 服务合同，不得反向改变 Compiler、Artifact 或 Runtime 协议。

## 5. 启动门禁

本索引通过总 Spec 校审后，才允许在 `subspecs/<name>/` 编写对应分 Spec。只有某个分 Spec 自身通过校审，才允许初始化其代码和测试。
