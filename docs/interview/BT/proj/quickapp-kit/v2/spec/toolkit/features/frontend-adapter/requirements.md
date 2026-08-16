# Frontend Adapter Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 需求](#3-需求)
- [4. 验收矩阵](#4-验收矩阵)

## 1. 结论

**Frontend Adapter 的唯一职责是把联盟 `.ux`、JS、Less 和 Manifest 转换为不泄漏联盟 AST 类型的前端事实；它不负责生成 Runtime IR、Bundle 或 RPK。**

## 2. 范围

输入是 Case 001 项目根目录、`src/manifest.json`、`src/app.ux`、路由页面 `.ux`、依赖 JS、Less 和静态资源。输出是 `ProjectGraph`、`SourceUnit`、`TemplateFacts`、`ScriptFacts`、`StyleFacts`、`SourceLocation` 和 `Diagnostic`。

输出不得包含平台对象、Runtime `NodeId`、Android View、UIKit View 或 LVGL 对象。

## 3. 需求

### Requirement 1: 项目输入发现

**WHEN** Toolkit 接收一个项目根目录
**THE SYSTEM SHALL** 读取 Manifest、应用入口、路由页面入口、依赖模块和静态资源，并生成稳定排序的 `ProjectGraph`。

### Requirement 2: Manifest 路由

**WHEN** Manifest 声明一个页面路由
**THE SYSTEM SHALL** 将其解析为源码相对路径，并验证对应入口文件存在。

### Requirement 3: UX 分段

**WHEN** Adapter 读取一个 `.ux` 文件
**THE SYSTEM SHALL** 分离 `template`、`script` 和 `style` 区段，并为每个区段保留源文件、起止位置和原始内容。

### Requirement 4: 语义完整性

**WHEN** 输入包含暂不支持的 `.ux` 语义
**THE SYSTEM SHALL** 生成带错误码、阶段和源码位置的 Diagnostic，不得静默丢弃。

### Requirement 5: 确定性

**WHEN** 相同源码和配置被重复加载
**THE SYSTEM SHALL** 生成完全一致的逻辑路径、页面顺序、模块顺序和源码位置。

### Requirement 6: 错误边界

**WHEN** Manifest、页面入口或 `.ux` 区段非法
**THE SYSTEM SHALL** 在 Adapter 阶段失败，并不得生成可被后续阶段误认为有效的部分产物。

## 4. 验收矩阵

| 需求 | Case 001 验收 |
|---|---|
| R1 | 发现 app、2 个 page、JS 依赖和 assets |
| R2 | 两个页面均定位到 `index.ux` |
| R3 | app/page `.ux` 均得到 template/script/style 区段 |
| R4 | 非法区段产生 `TK_SOURCE_PARSE_ERROR` |
| R5 | 两次输出 JSON 字节一致 |
| R6 | 删除页面入口时返回 `TK_MANIFEST_INVALID` |
