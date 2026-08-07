# quickapp-toolkit

Developer toolkit and RPK toolchain.

## 目录

- [1. 结论](#1-结论)
- [2. 定位](#2-定位)
- [3. Scope](#3-scope)
- [4. 演进](#4-演进)

## 1. 结论

quickapp-toolkit 第一阶段采用 CLI 形态，CLI 是工具链内核；后续 VSCode 插件基于 CLI 封装，不重新实现工具链能力。

## 2. 定位

toolkit 负责开发者侧的构建、校验、调试和本地运行工作流。它不参与 Runtime 内部执行语义，只通过 RPK Contract、Runtime Contract、Benchmark Protocol 与其他项目协作。

Scope:

- CLI
- QuickApp source validation
- RPK packaging
- Manifest validation
- Contract compatibility check
- Local run and debug workflow

## 3. Scope

第一阶段 CLI 能力：

- `init`：创建示例工程
- `build`：构建 RPK
- `validate`：校验 manifest、RPK contract、能力声明
- `inspect`：分析 RPK 结构
- `run`：调用目标 runtime 运行示例
- `bench`：触发 benchmark 输入构建

## 4. 演进

```text
CLI Core
  -> VSCode Extension
  -> Developer Console
```

VSCode 插件只负责交互入口：

- 命令面板
- 项目创建
- 构建按钮
- RPK 结构查看
- 本地运行
- 日志与 benchmark 结果展示

底层仍复用 CLI，避免工具链逻辑分叉。
