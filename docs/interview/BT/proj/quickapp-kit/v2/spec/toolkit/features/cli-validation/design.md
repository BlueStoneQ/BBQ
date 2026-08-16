# CLI Validation Design

## 目录

- [1. 结论](#1-结论)
- [2. 命令层](#2-命令层)
- [3. 编排边界](#3-编排边界)
- [4. 可观测性](#4-可观测性)

## 1. 结论

```text
CLI Args -> Command Request -> Toolkit Pipeline -> Result/Diagnostics -> Formatter
```

## 2. 命令层

| 命令 | 读 | 写 |
|---|---|---|
| `build` | project | output package/report |
| `validate` | project or RPK | none |
| `inspect` | project or RPK | stdout/report only |
| `clean` | toolkit output metadata | toolkit-owned cache/output |

## 3. 编排边界

CLI 不解析 `.ux`，不生成 IR，不写包格式；它只构造 Request、调用 Pipeline、格式化 Result 和映射退出码。

## 4. 可观测性

每个阶段可以输出 phase、duration、input count、output bytes 和 diagnostic count。`--trace` 开启阶段追踪，`--json` 保证机器可读。
