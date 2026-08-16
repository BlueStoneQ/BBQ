# CLI Validation Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 需求](#2-需求)
- [3. 验收](#3-验收)

## 1. 结论

**CLI 是 Toolkit 的唯一人机入口和未来 IDE 插件内核；命令只编排阶段，不重复实现编译逻辑。**

## 2. 需求

### R1 Build

**WHEN** 用户执行 `quickapp build <project>`
**THE SYSTEM SHALL** 按固定阶段完成发现、解析、归一化、分析、Lower、Bundle、校验和打包。

### R2 Validate

**WHEN** 用户执行 `quickapp validate <input>`
**THE SYSTEM SHALL** 只读取并校验输入，不修改源码和已有包。

### R3 Inspect

**WHEN** 用户执行 `quickapp inspect <input>`
**THE SYSTEM SHALL** 输出 Manifest、入口、依赖、IR、Bundle 和大小摘要。

### R4 机器输出

**WHEN** 用户传入 `--json`
**THE SYSTEM SHALL** 输出稳定 JSON，并将诊断写入结构化字段。

### R5 退出码

**WHEN** 命令失败
**THE SYSTEM SHALL** 用稳定退出码区分参数、源码、合同、构建和签名错误。

## 3. 验收

Case 001 对 build/validate/inspect 的文本和 JSON 输出均可测试；错误输入不生成部分包；相同输入输出摘要一致。
