# T2 Alliance Frontend Adapter

## 职责

隔离联盟 `.ux`、JS、Less 前端解析能力，输出 Normalized IR 所需的前端事实。

## 约束

- 不让联盟 AST 类型穿过 Adapter。
- 保留源码位置。
- 未支持语义必须诊断。
- 用 Case 001 覆盖 App、Page、Feature import、Style 和事件。

