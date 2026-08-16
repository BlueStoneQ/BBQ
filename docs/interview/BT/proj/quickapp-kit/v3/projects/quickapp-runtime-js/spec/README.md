# JS Runtime Spec

## 目录

- [1. 目标](#1-目标)
- [2. 总 Spec](#2-总-spec)
- [3. 状态](#3-状态)

## 1. 目标

定义 JS Executor 与 JS Framework 的边界：公共 `$app_define$/$app_bootstrap$/$app_require$` Module ABI、App/Shared/Page 加载、App/Page Hook、typed Module Facade、VM/evaluator/handler export 校验、Binding flush 和 Runtime ABI。JS 不创建平台对象、不持有运行时 NodeId。

## 2. 总 Spec

- [需求](./requirements.md)
- [总体架构](./architecture.md)
- [分 Spec 索引](./subspec-index.md)
- [验收](./acceptance.md)

## 3. 状态

第五次定向复核 `PASS`；当前 `DESIGN_ALLOWED + CODE_BLOCKED`，允许设计 JS-S01。
