# Analyzer and Lowering Tasks

## 目录

- [1. 任务](#1-任务)
- [2. 追踪](#2-追踪)

## 1. 任务

- [ ] T4.1 构建模块、页面和 Feature 依赖图（R1）。
- [ ] T4.2 实现 Binding/Block/Handler 作用域校验（R2）。
- [ ] T5.1 实现稳定静态 ID 分配（R3）。
- [ ] T5.2 Lower Template/Binding/Block/Handler/Style IR（R3）。
- [ ] T5.3 生成 JS evaluator 引用（R4）。
- [ ] T5.4 增加平台字段禁入和引用完整性测试（R5）。

## 2. 追踪

| 任务 | 需求 | 验证 |
|---|---|---|
| T4.1 | R1 | Dependency Golden |
| T4.2 | R2 | Reference Contract Test |
| T5.1/T5.2 | R3 | IR Schema Test |
| T5.3 | R4 | JS ABI Test |
| T5.4 | R5 | Forbidden Field Test |
