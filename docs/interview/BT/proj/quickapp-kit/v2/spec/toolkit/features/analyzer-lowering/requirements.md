# Analyzer and Lowering Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 需求](#2-需求)
- [3. 验收](#3-验收)

## 1. 结论

**Analyzer 计算跨模块、Binding、Block、Handler 和 Feature 依赖；Lowerer 把已分析事实转换为 Runtime 可消费的静态 IR。**

## 2. 需求

### R1 依赖图

**WHEN** Normalized IR 被分析
**THE SYSTEM SHALL** 生成稳定的模块依赖图、页面依赖图和 Feature 依赖图。

### R2 语义引用

**WHEN** Binding、Block 或 Handler 引用模板节点或状态路径
**THE SYSTEM SHALL** 验证引用存在且作用域合法。

### R3 静态 Lower

**WHEN** 分析结果通过校验
**THE SYSTEM SHALL** 生成 Template、Binding、Block、Handler 和 Style IR。

### R4 动态边界

**WHEN** 表达式需要 JS 运行时语义
**THE SYSTEM SHALL** 生成 JS evaluator 引用，不把表达式错误地编译为 C++ 或平台逻辑。

### R5 平台隔离

**WHEN** Lowering 输出 IR
**THE SYSTEM SHALL** 不包含 NativeHandle、平台控件类型、线程指针或平台布局对象。

## 3. 验收

Case 001 的 `{{ text }}`、事件和样式均有完整引用；不存在的 Binding target、Handler 或 Block 引用必须失败；同一输入依赖图和 IR 稳定。
