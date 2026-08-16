# JS Bundle Contract

## 1. 结论

**JS Bundle 只承载必须依赖 JS 语义的动态逻辑；它通过 QuickApp Kit Runtime ABI 产生状态更新和页面事件。**

## 2. Bundle 类型

| Bundle | 内容 | 生命周期 |
|---|---|---|
| App | App VM、应用生命周期、应用级模块 | App Runtime |
| Shared | 多页面共享模块 | App Runtime，单例缓存 |
| Page | 页面 VM、Handler、页面私有模块、Binding evaluator | Page Instance |

## 3. 入口合同

每个入口必须注册并启动一个逻辑模块：

```text
$app_define$(moduleId, dependencies, factory)
$app_bootstrap$(moduleId, metadata)
```

QuickApp Kit 可以沿用符号语义，但内部模块 ABI 由 Runtime Contract 定义。

## 4. 运行约束

1. 同一 App Runtime 内 Shared Module 只执行一次。
2. Page Bundle 可多次创建页面实例，但不得共享页面 State。
3. JS Bundle 不包含完整 VNode Tree。
4. Binding evaluator 通过稳定的 `TemplateBindingId` 可定位。
5. Bundle 不直接调用平台 API，只经过 Feature Bridge。

