# Normalized IR Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 需求](#2-需求)
- [3. 验收](#3-验收)

## 1. 结论

**Normalized IR 是前端事实到后端编译阶段的唯一边界；它表达源码语义，不表达 Runtime 实例和平台对象。**

## 2. 需求

### R1 结构完整

**WHEN** Frontend Adapter 输出合法前端事实
**THE SYSTEM SHALL** 生成包含 `schemaVersion`、source、template、script、style、imports 和 sourceMap 的 Normalized IR。

### R2 稳定 ID

**WHEN** 相同源码和配置重复编译
**THE SYSTEM SHALL** 生成一致的 TemplateNodeId、TemplateBindingId、TemplateBlockId 和 TemplateHandlerId。

### R3 语义可追踪

**WHEN** IR 中存在节点、Binding、Block、Handler 或 Style
**THE SYSTEM SHALL** 保留其源码位置和跨实体引用。

### R4 平台隔离

**WHEN** IR 被传给 Analyzer 或 Lowerer
**THE SYSTEM SHALL** 拒绝 NativeHandle、平台控件类型、运行时 NodeId 和线程指针。

### R5 序列化确定

**WHEN** IR 被序列化
**THE SYSTEM SHALL** 使用规范字段顺序、稳定数组顺序和规范化逻辑路径。

## 3. 验收

Case 001 的 app 和两个 page 均能生成 Schema 校验通过的 IR；重复构建的 IR 字节一致；非法平台字段被拒绝。
