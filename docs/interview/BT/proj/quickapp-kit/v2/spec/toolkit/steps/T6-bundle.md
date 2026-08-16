# T6 Bundle and Chunk

## 职责

生成 App、Shared、Page Bundle，建立 ModuleRegistry 和 Chunk 索引。

## 验收

- 页面入口唯一。
- Shared Module 在同一 App Runtime 只执行一次。
- 页面 State 不跨页面共享。
- 缺失 Chunk 在构建期可诊断。

