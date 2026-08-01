# Requirements Document

## 目录

- [Introduction](#introduction)
- [Glossary](#glossary)
- [Requirements](#requirements)
  - [需求 1：项目初始化](#需求-1项目初始化)
  - [需求 2：SFC 解析](#需求-2sfc-解析)
  - [需求 3：模板编译](#需求-3模板编译)
  - [需求 4：样式编译](#需求-4样式编译)
  - [需求 5：脚本编译与模块打包](#需求-5脚本编译与模块打包)
  - [需求 6：Manifest 处理](#需求-6manifest-处理)
  - [需求 7：RPK 打包](#需求-7rpk-打包)
  - [需求 8：CLI 命令接口](#需求-8cli-命令接口)
  - [需求 9：Watch 模式与增量编译](#需求-9watch-模式与增量编译)

---

## Introduction

QuickApp Toolkit — 快应用 CLI 工具链，负责将 `.ux` DSL 源码编译打包为标准 RPK 产物。

职责边界：
- **输入：** 快应用项目源码（`.ux` 单文件组件 + `manifest.json` + 静态资源）
- **输出：** 标准 RPK 包（ZIP 格式），可被 quickapp-runtime-android/ios/cpp 直接加载执行
- **不负责：** 运行时执行、渲染、JS 引擎管理

工具链在开发流程中的位置：

```text
开发者编写 .ux 源码
    ↓
quickapp-toolkit build
    ↓
RPK 产物（manifest.json + app.js + pages/*.js + assets/）
    ↓
quickapp-runtime-* 加载执行
```

技术栈：Node.js / TypeScript，CLI 框架，webpack 或自研打包。

范围约束（V1）：
- 组件：仅 `<template>` + `<style>` + `<script>` 三段式 SFC
- 模板：支持 div、text、input 标签，支持 `{{}}` 插值、事件绑定、classList
- 样式：支持 class 选择器、基本 Flex 属性、px 单位
- 脚本：ES5/ES6 Module 语法、`require` 系统模块
- 打包：单页面单 bundle，webpack 模块化
- 不含：TypeScript 编译、CSS 预处理器、多语言、热更新协议

## Glossary

- **SFC（Single File Component）：** `.ux` 单文件组件，包含 template/style/script 三个区块
- **Template Compiler：** 将 `<template>` 中的 XML 结构编译为 JSON 模板树对象
- **Style Compiler：** 将 `<style>` 中的 CSS 编译为 JS 样式对象（键为选择器，值为属性集合）
- **Script Compiler：** 处理 `<script>` 中的 JS，生成符合 `$app_define$` 协议的模块代码
- **Bundle：** 编译打包后的单个 JS 文件，包含 template + style + script 的 webpack 模块
- **RPK（Quick App Package）：** 最终产物 ZIP 包，包含 manifest + bundles + assets
- **Manifest：** `manifest.json`，描述应用元数据、路由、display、features
- **hap-toolkit：** 官方快应用工具链的参考名称，本项目的功能对标


## Requirements

### 需求 1：项目初始化

**用户故事：** 作为开发者，我希望通过 CLI 命令创建一个标准快应用项目骨架，以便快速开始开发。

#### 验收标准

1. WHEN 用户执行 `quickapp init <project-name>` 时，THE CLI SHALL 创建包含 `src/`、`manifest.json`、`package.json` 的项目目录
2. WHEN 项目创建完成后，THE CLI SHALL 在 `src/` 下生成入口页面模板 `pages/Demo/index.ux`
3. WHEN 项目创建完成后，THE CLI SHALL 生成包含 router.entry 和 pages 配置的 `manifest.json`
4. IF 目标目录已存在，THEN THE CLI SHALL 提示冲突并要求用户确认覆盖

---

### 需求 2：SFC 解析

**用户故事：** 作为工具链，我需要将 `.ux` 文件解析为 template/style/script 三个独立区块，以便分别进入各自的编译管线。

#### 验收标准

1. WHEN 读取一个 `.ux` 文件时，THE SFC Parser SHALL 识别 `<template>`、`<style>`、`<script>` 三个顶级标签并提取其内容
2. WHEN `<style>` 标签带有 `lang="less"` 属性时，THE SFC Parser SHALL 在输出中标记样式语言类型（V1 仅支持纯 CSS）
3. IF `.ux` 文件缺少 `<template>` 区块，THEN THE SFC Parser SHALL 报告包含文件名和行号的描述性错误
4. IF `.ux` 文件缺少 `<script>` 区块，THEN THE SFC Parser SHALL 生成空导出模块（允许纯展示组件）

---

### 需求 3：模板编译

**用户故事：** 作为工具链，我需要将 `<template>` 中的 XML 结构编译为 JSON 模板树，以便 Runtime 可以直接遍历生成 VNode。

#### 验收标准

1. WHEN 编译 `<template>` 中的 XML 时，THE Template Compiler SHALL 为每个元素生成包含 `type`、`attr`、`classList`、`children`、`events` 字段的 JSON 节点
2. WHEN 元素属性包含 `{{expression}}` 插值时，THE Template Compiler SHALL 将其编译为 `function() { return this.expression }` 形式的函数属性
3. WHEN 元素绑定事件（如 `@click="methodName"` 或 `onclick="methodName"`）时，THE Template Compiler SHALL 在节点的 `events` 字段中记录 `{ "click": "methodName" }`
4. WHEN 元素带有 `class="cls1 cls2"` 时，THE Template Compiler SHALL 生成 `classList: ["cls1", "cls2"]`
5. IF 模板包含未闭合标签或非法 XML，THEN THE Template Compiler SHALL 报告包含行号和标签名的错误

---

### 需求 4：样式编译

**用户故事：** 作为工具链，我需要将 `<style>` 中的 CSS 编译为 JS 对象，以便 Runtime 可以通过 classList 匹配样式。

#### 验收标准

1. WHEN 编译 `<style>` 中的 CSS 时，THE Style Compiler SHALL 生成以选择器为 key、属性集合为 value 的 JS 对象
2. WHEN CSS 属性名为 kebab-case（如 `font-size`）时，THE Style Compiler SHALL 转换为 camelCase（如 `fontSize`）
3. WHEN 选择器为 `.wrapper .title`（后代选择器）时，THE Style Compiler SHALL 保持完整选择器字符串作为 key
4. WHEN 属性值包含单位（如 `40px`）时，THE Style Compiler SHALL 保留原始字符串值（如 `"40px"`）
5. IF CSS 包含语法错误，THEN THE Style Compiler SHALL 报告包含行号和属性名的错误并跳过该规则

---

### 需求 5：脚本编译与模块打包

**用户故事：** 作为工具链，我需要将 `<script>` 编译为符合 Runtime 协议的 webpack bundle，以便 Runtime eval 后能触发 `$app_define$` 和 `$app_bootstrap$`。

#### 验收标准

1. WHEN 编译页面 bundle 时，THE Script Compiler SHALL 生成调用 `$app_define$('@app-component/index', [], factory)` 和 `$app_bootstrap$('@app-component/index', opts)` 的代码
2. WHEN factory 函数执行时，THE Bundle SHALL 将 template（JSON 树）、style（JS 对象）和 script exports 赋值到 `$app_module$.exports`
3. WHEN script 中使用 `require('@app-module/system.router')` 时，THE Script Compiler SHALL 将其编译为 `$app_require$('@app-module/system.router')`
4. WHEN 编译 app.js 时，THE Script Compiler SHALL 生成调用 `$app_define$('@app-application/app', [], factory)` 和 `$app_bootstrap$` 的应用级 bundle
5. WHEN 打包完成后，THE Bundle SHALL 为自执行函数（IIFE），不污染全局作用域
6. IF script 中存在 ES6+ 语法（如箭头函数），THEN THE Script Compiler SHALL 保留原样（QuickJS 支持 ES2020）

---

### 需求 6：Manifest 处理

**用户故事：** 作为工具链，我需要验证并处理 manifest.json，确保路由配置和页面路径与实际源码目录一致。

#### 验收标准

1. WHEN 编译开始时，THE Manifest Processor SHALL 读取并验证 manifest.json 的必填字段（package、name、router.entry、router.pages）
2. WHEN manifest.router.pages 中声明了页面路径时，THE Manifest Processor SHALL 验证对应的 `.ux` 文件存在于 src/ 目录
3. WHEN 构建模式为 debug 时，THE Manifest Processor SHALL 设置 `config.debug = true` 和 `config.logLevel = "debug"`
4. WHEN 构建模式为 release 时，THE Manifest Processor SHALL 设置 `config.debug = false` 并移除调试相关字段
5. IF manifest.json 缺少必填字段，THEN THE Manifest Processor SHALL 报告具体缺失字段名和位置

---

### 需求 7：RPK 打包

**用户故事：** 作为工具链，我需要将编译产物打包为标准 RPK（ZIP）文件，以便 Runtime 可以直接加载。

#### 验收标准

1. WHEN 所有页面编译完成后，THE RPK Packager SHALL 创建包含以下结构的 ZIP 文件：manifest.json、app.js、pages/*/index.js、assets/*
2. WHEN 打包时，THE RPK Packager SHALL 使用 DEFLATE 压缩 JS 和 JSON 文件，STORE（不压缩）二进制资源
3. WHEN 打包完成后，THE RPK Packager SHALL 将产物输出到 `dist/<package>.<mode>.<version>.rpk`
4. WHEN 构建模式为 release 时，THE RPK Packager SHALL 对 JS bundle 执行 UglifyJS/Terser 压缩
5. WHEN 打包完成后，THE RPK Packager SHALL 生成 `META-INF/build.txt`，记录构建环境和各文件 hash
6. IF 任何页面编译失败，THEN THE RPK Packager SHALL 中止打包并报告失败页面列表

---

### 需求 8：CLI 命令接口

**用户故事：** 作为开发者，我希望通过简洁的 CLI 命令执行初始化、编译、打包操作。

#### 验收标准

1. WHEN 用户执行 `quickapp build` 时，THE CLI SHALL 依次执行 SFC 解析、模板编译、样式编译、脚本打包、Manifest 处理和 RPK 打包
2. WHEN 用户执行 `quickapp build --mode=release` 时，THE CLI SHALL 启用 JS 压缩和 debug 字段移除
3. WHEN 用户执行 `quickapp build --mode=debug` 时，THE CLI SHALL 保留完整变量名和 sourcemap 信息
4. WHEN 编译成功时，THE CLI SHALL 输出产物路径和文件大小
5. IF 编译过程中出现错误，THEN THE CLI SHALL 输出包含文件名、行号和错误原因的诊断信息并以非零退出码退出

---

### 需求 9：Watch 模式与增量编译

**用户故事：** 作为开发者，我希望在开发过程中文件保存后自动重新编译变更的文件，以便获得快速反馈。

#### 验收标准

1. WHEN 用户执行 `quickapp watch` 时，THE CLI SHALL 监听 `src/` 目录下 `.ux`、`.json` 和资源文件的变更
2. WHEN 单个 `.ux` 文件变更时，THE CLI SHALL 仅重新编译该页面 bundle，不重新编译其他页面
3. WHEN `manifest.json` 变更时，THE CLI SHALL 重新验证 manifest 并触发完整重新打包
4. WHEN 增量编译完成后，THE CLI SHALL 输出变更文件名和耗时
5. IF 增量编译出现错误，THEN THE CLI SHALL 输出错误信息但不退出 watch 进程
