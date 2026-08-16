# Block IR Contract

## 1. 结论

**Block IR 描述动态结构如何创建、删除、移动和复用；运行时实例由 JS 管理，Runtime 节点由 C++ 创建。**

## 2. 条件 Block

```json
{
  "templateBlockId": 1,
  "kind": "if",
  "conditionTemplateBindingId": 2,
  "templateRoot": 3
}
```

状态变化产生：

```text
false -> true : InsertSubtree
true -> false : RemoveSubtree
```

## 3. 列表 Block

```json
{
  "templateBlockId": 2,
  "kind": "for",
  "sourceTemplateBindingId": 3,
  "keyExpression": "item.id",
  "templateRoot": 4
}
```

V1 只在所属 Block 内按 Key 协调：

```text
Insert / Remove / Move / Reuse
```

不得遍历完整页面树。

## 4. 字段合同

```ts
type BlockIR = {
  schemaVersion: 1
  templateBlockId: number
  kind: 'if' | 'for'
  conditionTemplateBindingId?: number
  sourceTemplateBindingId?: number
  keyExpression?: JsExpressionRef
  templateRoot: number
  loc?: SourceLocation
}

type JsExpressionRef = {
  moduleId: string
  exportName: string
}
```

规则：`if` 必须有 `conditionTemplateBindingId`；`for` 必须有 `sourceTemplateBindingId` 和稳定 Key 策略。没有 Key 时 V1 必须报诊断，不得隐式使用数组位置作为长期身份。
