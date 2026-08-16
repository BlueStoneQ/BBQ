# Toolkit Diagnostics Contract

## 1. 结论

**诊断的本质是把编译失败定位到源码语义和 IR 引用，而不是只报告“构建失败”。**

## 2. 结构

```json
{
  "code": "TK_BINDING_TARGET_NOT_FOUND",
  "severity": "error",
  "message": "Binding target does not exist",
  "file": "pages/Demo/index.ux",
  "line": 4,
  "column": 12,
  "phase": "lower.binding",
  "relatedIds": ["templateNodeId:2", "templateBindingId:1"]
}
```

## 3. 规则

- 所有错误包含 phase 和 source location。
- Warning 不得改变产物语义，除非显式开启降级模式。
- JSON 输出供 CLI、IDE 和 Agent 消费；文本输出供人阅读。
- 构建失败不得留下看似可运行的半成品 RPK。
- 诊断码在 V1 后保持向后兼容。

