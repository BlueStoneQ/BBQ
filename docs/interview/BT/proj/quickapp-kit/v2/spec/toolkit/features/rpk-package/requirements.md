# RPK Package Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 需求](#2-需求)
- [3. 验收](#3-验收)

## 1. 结论

**RPK 是部署容器；Manifest 和 Runtime Metadata 是索引；Loader 只能消费已验证的逻辑路径。**

## 2. 需求

### R1 完整产物

**WHEN** Toolkit 完成一次 release 构建
**THE SYSTEM SHALL** 输出 Manifest、app Bundle、Page Bundle、Runtime Metadata、IR、资源和签名容器。

### R2 逻辑索引

**WHEN** Runtime 请求 App 或 Page
**THE SYSTEM SHALL** 通过索引定位逻辑入口，不依赖目录猜测或平台文件 API。

### R3 版本门禁

**WHEN** package format、runtimeAbi、IR schemaVersion 或平台最低版本不匹配
**THE SYSTEM SHALL** 在执行 Bundle 前失败。

### R4 安全路径

**WHEN** 包成员不是 Manifest/Runtime Metadata 声明的逻辑路径
**THE SYSTEM SHALL** 拒绝读取。

### R5 可复现

**WHEN** 输入、配置和签名参数一致
**THE SYSTEM SHALL** 生成一致的索引、成员顺序和构建摘要。

## 3. 验收

Case 001 的 debug/release 包均可被 Loader 打开、校验、索引和按页面读取；非法版本、路径穿越和未索引成员均失败。
