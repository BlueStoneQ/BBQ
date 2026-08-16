# T7 Validate and Runtime Metadata

## 职责

生成 Runtime Metadata，校验 ABI、Schema、路径、路由、IR 引用和 Chunk 闭包。

## 验收

- Runtime 能从 Metadata 定位 App、Page、Chunk 和 IR。
- 不兼容 ABI 在 Bundle 执行前失败。
- 所有错误有稳定错误码和源码位置。

