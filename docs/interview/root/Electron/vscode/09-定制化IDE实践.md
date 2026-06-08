# 09 - 定制化 IDE 实践

> 核心问题: 基于 VSCode 做二次开发 (定制 IDE) 的架构决策与实践路径

## 目录

- [第一性原理](#第一性原理)
- [从源码看定制 IDE 的改造](#从源码看定制-ide-的改造)
  - [product.json — 品牌与配置中枢](#productjson--品牌与配置中枢)
  - [vs/custom/ — 自定义模块目录](#vscustom--自定义模块目录)
- [定制化架构决策树](#定制化架构决策树)
- [上游同步策略](#上游同步策略)
- [扩展市场方案](#扩展市场方案)
- [自动更新](#自动更新)
- [实际定制案例分析](#实际定制案例分析)
- [技术债务与取舍](#技术债务与取舍)
- [成为 IDE 架构师的路径](#成为-ide-架构师的路径)
- [小结](#小结)

---

## 第一性原理

**定制 IDE 的两种路径**：

| 路径 | 方式 | 成本 | 深度 |
|------|------|------|------|
| 插件模式 | 开发 VSCode Extension | 低 | 受限于 API 边界 |
| Fork 模式 | Fork VSCode 源码二次开发 | 高 | 无限制 |

**选择 Fork 的条件** (定制 IDE 就是这条路)：
- 需要改变品牌标识
- 需要修改 UI 布局 / 去掉不需要的功能
- 需要深度集成不暴露 API 的能力
- 需要控制自动更新/扩展市场

## 从源码看定制 IDE 的改造

### product.json — 品牌与配置中枢

```json
{
  "nameShort": "My Custom IDE",
  "nameLong": "My Custom IDE",
  "applicationName": "my-ide",
  "dataFolderName": ".my-ide",         // 用户数据目录
  "quality": "stable",
  "updateUrl": "https://your-cdn.com/ide/update",  // 自有更新服务
  "extensionsGallery": {
    "serviceUrl": "https://marketplace.visualstudio.com/_apis/public/gallery"
  },
  "reportIssueUrl": "https://github.com/your-org/your-repo/issues"
}
```

定制点：
- 产品名称/图标
- 数据存储路径
- 更新服务器地址
- 扩展市场地址
- Bug 报告地址
- 内置扩展列表

### package.json — 构建配置

```json
{
  "name": "my-custom-ide",
  "version": "1.103.0",           // 基于 VSCode 1.103.0
  "author": { "name": "Your Organization" },
  "scripts": {
    "build:deb": "yarn gulp vscode-linux-x64 && yarn gulp vscode-linux-x64-build-deb",
    "build:exe": "yarn run gulp vscode-win32-x64 && ...",
    "build:mac": "yarn run gulp vscode-darwin-x64 && ...",
    "build:mac_arm": "yarn run gulp vscode-darwin-arm64 && ..."
  }
}
```

### vs/custom/ — 自定义模块目录

```
src/vs/custom/   ← 自有业务逻辑独立目录
```

**设计原则**：自定义代码放在独立目录，减少与上游的冲突，方便 rebase。

## 定制化架构决策树

```
你想做什么？
│
├─ 换皮肤/品牌 → product.json + 资源文件
│
├─ 加内置插件 → extensions/ 目录 + product.json.builtInExtensions
│
├─ 改 UI 布局 → vs/workbench/browser/ 修改 Layout
│
├─ 加原生能力 → vs/platform/xxx/ 新增服务
│                 ├── common/ (接口)
│                 ├── node/ (实现)
│                 └── electron-main/ (主进程暴露)
│
├─ 私有扩展市场 → product.json.extensionsGallery 改地址
│                  或搭建 Open VSX 服务
│
├─ 去掉功能 → workbench.desktop.main.ts 删除对应 contrib import
│
└─ 深度定制 → Fork + 长期维护分支
```

## 上游同步策略

Fork 模式最大的挑战：**如何跟上 VSCode 月更节奏？**

### 策略 1: Rebase 模式

```
main (上游 VSCode) ← 定期 pull upstream
  │
  └── feature/custom ← 你的定制 commits
       │
       └── rebase onto main (每月)
```

适用：改动小、冲突少

### 策略 2: Merge 模式

```
main ← 你的主分支 (含定制)
  │
  └── merge upstream/release/1.104 (每月)
```

适用：改动多、团队大

### 策略 3: 最小侵入 (推荐)

原则：
1. 自定义代码放在**独立目录** (如 `vs/custom/`)
2. 对上游代码只做**最小化修改** (通常是注入点)
3. 用条件编译或配置驱动差异
4. 能用插件解决的就不改源码

## 扩展市场方案

| 方案 | 特点 | 适用 |
|------|------|------|
| 官方 Marketplace | 微软托管，最完整 | 不改市场 |
| Open VSX | 开源替代市场 | Eclipse 基金会 |
| 私有 Marketplace | 自建，控制发布 | 企业内部 |
| 离线内置 | 预装 vsix 到 extensions/ | 网络隔离环境 |

定制 IDE 常见方案：使用微软官方 Marketplace + 自有更新服务器。

## 自动更新

```json
// product.json
{
  "updateUrl": "https://your-cdn.com/ide/update"
}
```

更新服务需要实现的接口：
```
GET /api/update/{platform}/{quality}/{commit}
Response: { url, version, productVersion, hash, sha256hash }
```

VSCode 的更新机制：
1. 定期检查 `updateUrl`
2. 下载增量/全量更新包
3. 验证 hash
4. 替换文件 + 重启

## 实际定制案例分析

### 案例: 内置调试器

```
方式: 将自研调试器作为内置插件
```

路径：
1. 开发 VSCode Extension (custom-devtools)
2. 编译为 .vsix
3. 放入 `extensions/` 目录
4. 在 product.json 的 `builtInExtensions` 中声明

### 案例: 卡片模板开发

```
源码: dev-docs/卡片模板开发接入指南.md
方式: 插件 + Webview
```

通过 Webview Panel 提供自定义 UI，运行在插件定义的 HTML 页面中。

## 技术债务与取舍

| 取舍 | 利 | 弊 |
|------|---|---|
| Fork 源码 | 无限定制能力 | 上游同步成本高 |
| 内置插件 | 开箱即用 | 包体积增加 |
| 改 product.json | 最小改动 | 只能改配置级别 |
| 独立目录 | 冲突少 | 需要在入口注入 |
| 用官方市场 | 插件丰富 | 依赖外部服务 |

## 成为 IDE 架构师的路径

```
Level 1: 插件开发者
  - 掌握 Extension API
  - 理解 activationEvents / contributes
  - 能写 Language Server

Level 2: 定制化开发者
  - 理解进程模型和 IPC
  - 能修改 product.json 定制品牌
  - 能管理内置插件和构建流程

Level 3: IDE 架构师
  - 理解 DI 容器和服务层设计
  - 能设计新的 Platform Service
  - 能优化启动性能和内存
  - 能设计跨进程通信协议
  - 能做上游同步策略决策

Level 4: 平台架构师
  - 能设计插件 API 和扩展点
  - 能设计多端运行架构 (Desktop/Web/Remote)
  - 能做 Electron 版本升级策略
  - 能设计构建/发布/更新全链路
```

## 小结

| 设计决策 | 第一性原理 |
|---------|-----------|
| product.json 驱动品牌 | 配置优于硬编码 — 一个文件切换产品 |
| 独立目录放定制代码 | 关注点分离 — 减少上游合并冲突 |
| 插件能解决就不改源码 | 最小侵入 — 保持可升级性 |
| 自有更新服务 | 自主可控 — 不依赖微软基础设施 |
| 跟进上游节奏 | 安全 + 功能 — 不做孤岛 |
