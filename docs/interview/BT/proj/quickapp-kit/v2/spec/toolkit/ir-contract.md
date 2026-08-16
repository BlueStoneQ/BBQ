# Toolkit IR Contract

## 目录

- [1. 结论](#1-结论)
- [2. ID 规则](#2-id-规则)
- [3. Template IR](#3-template-ir)
- [4. Binding IR](#4-binding-ir)
- [5. Block IR](#5-block-ir)
- [6. Handler 与 Style IR](#6-handler-与-style-ir)
- [7. 最小例子](#7-最小例子)

## 1. 结论

**IR 只描述静态事实；JS Framework 执行业务表达式，C++ Core 将 IR 实例化为唯一 Runtime Tree。**

## 2. ID 规则

```text
TemplateNodeId：模板中的静态节点
TemplateBindingId：模板中的静态 Binding 定义
TemplateBlockId：模板中的静态 if/for 定义
TemplateHandlerId：模板中的静态事件定义
LogicalNodeRef：JS 指向逻辑节点的引用，由 OwnerInstanceId + TemplateNodeId 组成
HandlerId：运行时 JS Handler 身份
```

Toolkit 生成的静态 ID 在同一编译产物内稳定。运行时 `NodeId` 由 C++ Core 根据实例化关系生成，不由 Toolkit 预先分配。

## 3. Template IR

```json
{
  "schemaVersion": 1,
  "templateId": "pages/Demo/index",
  "root": 1,
  "nodes": [
    {
      "templateNodeId": 1,
      "type": "div",
      "children": [2]
    },
    {
      "templateNodeId": 2,
      "type": "text",
      "props": {
        "value": { "templateBindingId": 1 }
      }
    }
  ]
}
```

Template IR 不包含 `NativeHandle`、平台对象指针或运行时 `NodeId`。

## 4. Binding IR

```json
{
  "templateBindingId": 1,
  "statePaths": ["title"],
  "target": {
    "templateNodeId": 2,
    "property": "value"
  },
  "evaluator": {
    "kind": "js",
    "export": "binding_1"
  }
}
```

V1 的 `evaluator.kind` 为 `js`。未来 C++ Binding IR 只能作为透明快路径，并且必须支持 JS 回退。

## 5. Block IR

```json
{
  "templateBlockId": 1,
  "kind": "if",
  "conditionTemplateBindingId": 2,
  "templateRoot": 3
}
```

基础列表：

```json
{
  "templateBlockId": 2,
  "kind": "for",
  "sourceTemplateBindingId": 3,
  "key": "item.id",
  "templateRoot": 4
}
```

## 6. Handler 与 Style IR

Handler：

```json
{
  "schemaVersion": 1,
  "templateHandlerId": 1,
  "templateNodeId": 2,
  "eventType": "click",
  "moduleId": "pages/Demo/index",
  "exportName": "onClick"
}
```

Style：

```json
{
  "templateNodeId": 1,
  "rules": {
    "flexDirection": "column",
    "padding": "8px"
  }
}
```

Style IR 只表达平台无关样式语义；平台 Backend 不重新解析源 Less。

## 7. 最小例子

源码：

```html
<div>
  <text>{{ title }}</text>
</div>
```

运行时：

```text
title 变化
  -> Binding 1 求值
  -> UpdateProp(LogicalNodeRef, "value", 新值)
  -> C++ 更新 Runtime Tree
```
