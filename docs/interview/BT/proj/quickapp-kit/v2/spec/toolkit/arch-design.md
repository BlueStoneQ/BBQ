# Toolkit Architecture Design

## 目录

- [1. 结论](#1-结论)
- [2. 编译管线](#2-编译管线)
- [3. 模块边界](#3-模块边界)
- [4. 依赖与页面分包](#4-依赖与页面分包)
- [5. 诊断与确定性](#5-诊断与确定性)

## 1. 结论

**Toolkit 采用“联盟前端 + 自有 Normalized IR + 多目标输出”的架构。**

```text
Alliance Frontend
  -> Normalized IR
  -> JS Bundle Emitter
  -> Runtime IR Emitter
  -> RPK Packager
```

联盟前端负责理解 `.ux` 语法；Normalized IR 是 QuickApp Kit 自己掌握的稳定边界。

## 2. 编译管线

```text
1. Discover：读取 Manifest、路由、入口和资源
2. Parse：解析 .ux、JS、Style
3. Normalize：统一节点、Binding、Block、Handler、Style
4. Analyze：建立依赖图、模块图和诊断信息
5. Lower：生成 Runtime IR 和 RenderTarget
6. Bundle：生成 app/page/shared JS Bundle
7. Validate：Schema、引用、ID、路径和语义检查
8. Package：生成 Manifest、RPK、签名和构建报告
```

每一步都应产生可检查的中间结果，便于单独测试和 Agent 分工实现。

## 3. 模块边界

| 模块 | 输入 | 输出 |
|---|---|---|
| `project-loader` | 项目目录 | Project Graph |
| `alliance-frontend` | `.ux` / JS / Less | Frontend AST |
| `normalizer` | Frontend AST | Normalized IR |
| `analyzer` | Normalized IR | Dependency/Target Graph |
| `ir-emitter` | Normalized IR | Runtime IR |
| `js-emitter` | JS AST / module graph | App/Page/Shared Bundle |
| `packager` | Bundle/IR/assets | RPK |
| `validator` | 全部产物 | Diagnostics/Report |

Toolkit 内核采用 Node.js + TypeScript；前端解析器通过 Adapter 隔离，不能让联盟内部模块类型泄漏到 Runtime Contract。

## 4. 依赖与页面分包

```text
App Bundle
  应用生命周期和应用级模块

Shared Chunk
  多页面共享且达到提取条件的模块

Page Bundle
  页面 VM、Handler 和页面私有模块
```

规则：

1. 页面入口必须可以按路由唯一定位。
2. 同一 App Runtime 内共享模块只初始化一次。
3. 未进入的页面不要求加载其 Bundle/IR。
4. Shared Chunk 不得被拆成大量细碎请求；阈值由 Benchmark 决定。
5. 页面分包和 JS Chunk 分离：前者是资源安装边界，后者是模块加载边界。

## 5. 诊断与确定性

每个诊断至少包含：

```text
code
message
sourceFile
line / column
phase
relatedNodes / relatedBindings
```

相同输入、Toolkit 版本和构建配置必须产生稳定的：

```text
IR 内容
模块顺序
Bundle 内容
Manifest 索引
```

时间戳、绝对路径和机器信息只能进入 Build Report，不能影响运行产物哈希。

