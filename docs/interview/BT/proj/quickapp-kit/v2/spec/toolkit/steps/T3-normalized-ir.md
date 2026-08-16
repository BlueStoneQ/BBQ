# T3 Normalized IR

## 职责

把 Frontend AST 转换为稳定、可序列化、可单测的 Normalized IR。

## 验收

- Schema 校验通过。
- 所有实体有 SourceLocation。
- Template、Binding、Block、Handler、Style 引用完整。
- 同一输入生成稳定 ID。

