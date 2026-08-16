# RPK Loader Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 需求](#2-需求)
- [3. 验收](#3-验收)

## 1. 结论

**Loader 的本质是受版本和索引约束的惰性读取器，不解释业务、不执行 JS、不创建平台对象。**

## 2. 需求

### R1 状态机

**WHEN** Loader 打开 RPK
**THE SYSTEM SHALL** 按 `Opened -> Verified -> Indexed -> AppLoaded/PageLoaded` 顺序推进，任一失败进入 `Failed`。

### R2 版本门禁

**WHEN** 包版本、Runtime ABI、IR Schema 或最低平台版本不兼容
**THE SYSTEM SHALL** 在 Bundle 执行前失败。

### R3 按需读取

**WHEN** Runtime 请求一个页面
**THE SYSTEM SHALL** 只读取该页面所需 Bundle、IR 和 Shared Chunk。

### R4 路径安全

**WHEN** 请求路径未被索引声明或包含路径穿越
**THE SYSTEM SHALL** 拒绝读取。

### R5 资源释放

**WHEN** 页面销毁
**THE SYSTEM SHALL** 允许释放页面级 IR 和 Bundle 缓存，但不得破坏 App 级 Shared Module。

## 3. 验收

Case 001 debug/release RPK 均能打开、校验、加载 App 和页面；非法版本、未索引路径、路径穿越和状态越级均有明确失败结果。
