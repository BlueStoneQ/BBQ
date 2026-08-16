# RPK Loader Design

## 目录

- [1. 结论](#1-结论)
- [2. 状态机](#2-状态机)
- [3. 数据边界](#3-数据边界)
- [4. 内存策略](#4-内存策略)

## 1. 结论

```text
PackageSource -> Open -> Verify -> Index -> ArtifactDescriptor -> Runtime
```

## 2. 状态机

```text
Closed -> Opened -> Verified -> Indexed -> AppLoaded -> PageLoaded
                                      \-> Failed
```

状态机由 Loader 独占；Runtime 只能调用状态合法的接口。

## 3. 数据边界

Loader 输出已验证的逻辑路径、字节范围、摘要和版本信息。Template 解释、JS 执行、Binding 求值和 Platform Adapter 不属于 Loader。

## 4. 内存策略

包索引常驻 App Runtime；App Bundle 和 Shared Chunk 按 App 缓存；Page Bundle 和 Page IR 按页面加载，页面销毁后可释放。读取接口支持复制或只读映射，但所有权必须由 `ArtifactDescriptor` 明确。
