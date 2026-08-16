# Analyzer and Lowering Design

## 目录

- [1. 结论](#1-结论)
- [2. 两阶段边界](#2-两阶段边界)
- [3. 引用校验](#3-引用校验)
- [4. 输出](#4-输出)

## 1. 结论

```text
Normalized IR -> Analyzer -> Validated Facts -> Lowerer -> Runtime IR
```

## 2. 两阶段边界

| 阶段 | 只负责 | 不负责 |
|---|---|---|
| Analyzer | 依赖、作用域、引用、Feature 分析 | 生成运行时指令 |
| Lowerer | 静态 ID、IR 文件和 evaluator 引用 | 执行 JS、创建 Runtime Tree |

## 3. 引用校验

所有引用都使用编译作用域内的静态 ID：`TemplateNodeId`、`TemplateBindingId`、`TemplateBlockId`。运行时 `NodeId` 由 C++ Core 创建，不能出现在 Lowering 输入输出。

## 4. 输出

```text
templates/*.json
bindings/*.json
blocks/*.json
handlers/*.json
styles/*.json
runtime-meta.json
```

JS evaluator 只保存模块路径和导出名；运行时由 Page Bundle 注册实际函数。
