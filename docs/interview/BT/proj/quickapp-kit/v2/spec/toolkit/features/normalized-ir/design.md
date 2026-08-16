# Normalized IR Design

## 目录

- [1. 结论](#1-结论)
- [2. 数据模型](#2-数据模型)
- [3. ID 与引用](#3-id-与引用)
- [4. 生命周期](#4-生命周期)

## 1. 结论

Normalized IR 由 `FrontendFacts` 一次性构建，构建后不可变、可序列化、可独立校验。

## 2. 数据模型

```text
NormalizedProject
  -> NormalizedEntry(app/page/component)
    -> TemplateIR
    -> ScriptFacts
    -> StyleIR
    -> BindingMetadata / BlockIR / HandlerMetadata
```

IR 中的静态 ID 只在编译产物作用域内有效；运行时实例 ID 由 C++ Core 生成。

## 3. ID 与引用

```text
TemplateNodeId      静态模板节点
TemplateBindingId   静态绑定定义
TemplateBlockId     静态 if/for 定义
TemplateHandlerId   静态事件定义
NodeId              禁止由 Toolkit 生成
```

## 4. 生命周期

```text
FrontendFacts -> Normalize -> Schema Validate -> Analyze/Lower
```

IR 可以写入 RPK；Runtime 按页面加载 IR，实例化后释放解析中间对象。Toolkit 不保留运行时树。
