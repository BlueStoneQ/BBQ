# Toolkit CLI Contract

## 1. 结论

**CLI 是 Toolkit 的产品入口和未来 VS Code 插件的内核。**

## 2. V1 命令

```text
quickapp build <project>
quickapp validate <project-or-rpk>
quickapp inspect <project-or-rpk>
quickapp clean <project>
```

## 3. 通用选项

```text
--mode debug|release
--target lvgl|android|ios
--output <path>
--json
--trace
--no-cache
```

## 4. 行为

| 命令 | 行为 |
|---|---|
| `build` | Parse、Analyze、Lower、Bundle、Validate、Package |
| `validate` | 只校验源码或现有产物，不修改输入 |
| `inspect` | 输出 Manifest、入口、Chunk、IR、依赖和体积 |
| `clean` | 只删除 Toolkit 管理的输出和缓存 |

退出码必须稳定区分：参数错误、源码错误、合同错误、构建错误和签名错误。

