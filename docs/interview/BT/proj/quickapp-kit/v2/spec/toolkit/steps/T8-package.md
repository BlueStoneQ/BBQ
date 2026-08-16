# T8 Package and Sign

## 职责

把已校验产物写入 RPK，生成 debug/release 包和构建报告。

## 验收

- ZIP/RPK 成员路径安全。
- Manifest、Runtime Metadata、Bundle、IR、资源完整。
- debug/release 签名策略明确。
- `inspect` 可以读取包结构和统计信息。

