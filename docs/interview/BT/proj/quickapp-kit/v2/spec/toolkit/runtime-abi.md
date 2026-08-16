# Runtime ABI Contract

## 1. 结论

**Toolkit 只负责生成 ABI 可消费的入口、静态 IR 和 evaluator 引用；ABI 的执行语义由 JS Framework 与 C++ Core 定义。**

## 2. JS 注入接口

V1 Bundle 运行时至少可获得：

```ts
type OwnerInstanceId = string

type LogicalNodeRef = {
  ownerInstanceId: OwnerInstanceId
  templateNodeId: number
}

type InstantiateTemplateIntent = {
  kind: 'instantiateTemplate'
  templateId: string
  ownerInstanceId: OwnerInstanceId
  initialBindings: Record<number, unknown>
}

type RenderOperation =
  | { kind: 'updateProp'; target: LogicalNodeRef; name: string; value: unknown }
  | { kind: 'instantiateBlock'; templateBlockId: number; blockInstanceId: string }
  | { kind: 'removeBlock'; blockInstanceId: string }

type RenderTransaction = {
  ownerInstanceId: OwnerInstanceId
  operations: RenderOperation[]
}

type RuntimeGlobals = {
  $app_define$: (id: string, deps: string[], factory: Function) => void
  $app_bootstrap$: (id: string, metadata: Record<string, unknown>) => void
  $app_require$: (id: string) => unknown
  __quickapp_instantiateTemplate: (intent: InstantiateTemplateIntent) => void
  __quickapp_submitRender: (transaction: RenderTransaction) => void
  __quickapp_invokeFeature: (request: FeatureRequest) => Promise<FeatureResponse>
}
```

`FeatureRequest/FeatureResponse` 由独立 Feature Protocol 定义；V1 主路径不提交 `StateTransaction`。

实际注入名称可以由 Runtime Contract 调整，但 Toolkit 不得直接依赖平台全局对象。

## 3. evaluator ABI

```ts
type BindingEvaluator = (
  componentState: unknown,
  componentInstance: unknown,
  helpers: unknown
) => unknown
```

evaluator 只能产生值或受控 Binding 结果，不能直接创建 Host Object、调用 LVGL 或修改 C++ Tree。

## 4. 兼容原则

1. ABI 版本写入 Runtime Metadata。
2. Bundle 不得调用未声明的 Runtime Global。
3. ABI 不兼容必须在加载前报告。
4. Runtime ABI 与 RPK 外层格式版本独立管理。
