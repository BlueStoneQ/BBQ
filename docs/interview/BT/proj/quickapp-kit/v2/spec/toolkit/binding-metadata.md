# Binding Metadata Contract

## 1. 结论

**Binding Metadata 把 StatePath 连接到 JS evaluator 和渲染目标；V1 evaluator 在 JS 中执行。**

## 2. 结构

```json
{
  "templateBindingId": 1,
  "dependencies": ["title"],
  "target": {
    "templateNodeId": 2,
    "kind": "prop",
    "name": "value"
  },
  "evaluator": {
    "module": "pages/Demo/index.js",
    "export": "binding_1"
  }
}
```

## 3. 规则

```text
StatePath -> Binding[]
Binding -> evaluator + RenderTarget
```

1. 一个 StatePath 可以影响多个 Binding。
2. 一个 Binding 至少有一个明确 RenderTarget。
3. evaluator 结果未变化时不得产生 Render Intent。
4. 复杂 JS 表达式保留 JS 语义。
5. C++ Binding VM 不属于 V1 必选链路。

## 4. 字段合同

```ts
type BindingMetadata = {
  schemaVersion: 1
  templateBindingId: number
  dependencies: StatePath[]
  target: BindingTarget
  evaluator: JsEvaluator
  loc?: SourceLocation
}

type BindingTarget = {
  templateNodeId: number
  kind: 'prop' | 'attr' | 'style' | 'text' | 'block-condition' | 'block-source'
  name?: string
}

type JsEvaluator = {
  moduleId: string
  exportName: string
  arity: number
}

type StatePath = string
```

## 5. 依赖规则

依赖分析必须覆盖：

```text
this.title
this.user.name
this.items[index].label
```

无法静态确定的动态访问必须保留 JS evaluator，并将其依赖范围提升到所属 Component 的安全观察范围；不得错误裁剪更新依赖。
