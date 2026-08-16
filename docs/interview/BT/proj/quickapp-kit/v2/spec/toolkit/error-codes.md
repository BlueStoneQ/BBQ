# Toolkit Error Codes

## 1. 结论

**错误码按阶段和责任分类，Agent、CLI、IDE 和测试都依赖稳定错误码而不是错误文本。**

## 2. V1 错误码

| 错误码 | 阶段 | 含义 |
|---|---|---|
| `TK_CONFIG_INVALID` | discover | 配置无效 |
| `TK_MANIFEST_INVALID` | parse | Manifest 无法解析或字段错误 |
| `TK_SOURCE_PARSE_FAILED` | parse | 源码语法错误 |
| `TK_FRONTEND_UNSUPPORTED` | normalize | 联盟语义未支持 |
| `TK_IR_INVALID` | lower | IR 字段或引用错误 |
| `TK_ID_COLLISION` | link | 静态 ID 冲突 |
| `TK_BINDING_TARGET_NOT_FOUND` | lower | Binding 目标不存在 |
| `TK_BLOCK_KEY_MISSING` | lower | keyed Block 缺少 Key |
| `TK_MODULE_NOT_FOUND` | analyze | 模块无法解析 |
| `TK_MODULE_CYCLE_INVALID` | link | 非法模块循环 |
| `TK_PACKAGE_PATH_INVALID` | package | 包内路径非法 |
| `TK_PACKAGE_INCOMPLETE` | package | 产物缺少必要文件 |
| `TK_SCHEMA_INCOMPATIBLE` | validate | Schema 版本不兼容 |
| `TK_RUNTIME_ABI_INCOMPATIBLE` | validate | Runtime ABI 不兼容 |
| `TK_SIGNATURE_FAILED` | sign | 签名失败 |
| `TK_OUTPUT_WRITE_FAILED` | package | 输出写入失败 |

## 3. 错误对象

```ts
type Diagnostic = {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  phase: string
  file?: string
  line?: number
  column?: number
  relatedIds?: string[]
  hint?: string
}
```

