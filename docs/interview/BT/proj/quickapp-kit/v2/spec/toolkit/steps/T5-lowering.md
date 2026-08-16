# T5 Runtime IR Lowering

## 职责

生成 Template、Binding、Block、Handler、Style IR，并写入 JSON Schema 约束的产物。

## 验收

- 静态模板可以被 C++ 创建 Runtime Tree。
- 普通 Binding 可以在 JS 找到 evaluator。
- `if` 和 keyed `for` 能表达结构变化。
- 事件能从 `TemplateHandlerId` 映射到模块 `exportName`。
