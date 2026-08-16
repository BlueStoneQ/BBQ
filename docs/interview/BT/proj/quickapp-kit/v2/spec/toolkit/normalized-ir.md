# Normalized IR Contract

## 1. 结论

**Normalized IR 是联盟前端与 QuickApp Kit 后端的唯一隔离边界。**

它表达源码语义，不表达 Runtime 实例和平台对象。

## 2. 最小结构

```json
{
  "schemaVersion": 1,
  "source": { "file": "pages/Demo/index.ux" },
  "kind": "page",
  "template": {},
  "script": {},
  "style": {},
  "imports": [],
  "sourceMap": []
}
```

## 3. 必须表达

- 静态节点类型和父子关系；
- 静态属性与动态 Binding；
- `if`、keyed `for` 和组件边界；
- 事件类型与 Handler 引用；
- Style 规则、顺序和来源；
- JS 模块依赖和 Feature import；
- 每个语义节点的源文件位置。

## 4. 禁止表达

```text
NativeHandle
Android View / UIKit View / lv_obj_t
运行时 NodeId
平台线程指针
```

## 5. TypeScript 语义接口

```ts
type SourceLocation = {
  file: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
}

type NormalizedProject = {
  schemaVersion: 1
  projectRoot: string
  manifest: NormalizedManifest
  entries: NormalizedEntry[]
  modules: NormalizedModule[]
  assets: NormalizedAsset[]
  diagnostics: Diagnostic[]
}

type NormalizedEntry = {
  kind: 'app' | 'page' | 'component' | 'card'
  id: string
  route?: string
  source: string
  template: NormalizedTemplate
  script: NormalizedScript
  style: NormalizedStyle
  loc: SourceLocation
}
```

## 6. 合同规则

1. `schemaVersion` 是整数，发生不兼容字段变化时必须递增。
2. 所有跨文件引用使用规范化逻辑 ID，不使用绝对路径。
3. `source` 路径相对于 project root，统一使用 `/`。
4. Normalized IR 不允许静默丢弃无法支持的语义；必须产生错误或显式降级诊断。
5. Normalized IR 可以包含原始 JS AST 引用，但不能把联盟前端私有 AST 类型暴露给后续阶段。
