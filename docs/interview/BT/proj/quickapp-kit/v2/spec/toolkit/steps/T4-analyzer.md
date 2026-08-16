# T4 Analyzer and IDs

## 职责

构建模块图、StatePath 到 Binding 图、Template/Block/Handler 引用图，并报告循环和未解析引用。

## 验收

- `StatePath -> Binding[]` 完整。
- `TemplateNodeId`、`TemplateBindingId`、`TemplateBlockId` 无冲突。
- 页面入口依赖闭包完整。
- 动态访问不会被错误裁剪。

