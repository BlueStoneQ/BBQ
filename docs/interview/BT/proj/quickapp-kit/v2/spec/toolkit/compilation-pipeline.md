# Compilation Pipeline Contract

## 1. 结论

**每个阶段只转换一种事实；阶段之间通过可校验的数据结构连接。**

```text
Discover -> Parse -> Normalize -> Analyze -> Lower -> Bundle -> Link -> Validate -> Package
```

## 2. 阶段合同

| 阶段 | 输入 | 输出 |
|---|---|---|
| Discover | project root | ProjectGraph |
| Parse | source files | Frontend AST |
| Normalize | Frontend AST | Normalized IR |
| Analyze | Normalized IR | DependencyGraph / TargetGraph |
| Lower | normalized facts | Runtime IR |
| Bundle | JS modules | App/Shared/Page bundles |
| Link | bundles + IR | Runtime Metadata |
| Validate | all artifacts | Diagnostics |
| Package | validated artifacts | RPK |

## 3. 规则

1. 后一阶段不能重新解析源码。
2. 每一阶段失败都必须保留 source location。
3. Lowering 不得依赖 Android、iOS 或 LVGL 类型。
4. Package 只消费已校验产物，不理解 AST。
5. 相同输入和配置必须产生稳定 ID 与稳定模块顺序。

