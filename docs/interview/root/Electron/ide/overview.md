# 快应用 IDE 项目总览

> 基于 VS Code（Electron）二次开发的集成开发环境，覆盖快应用开发全链路。

---

## 目录

- [一、项目定位](#一项目定位)
- [二、IDE 本体核心改动（4 点）](#二ide-本体核心改动4-点)
  - [1. 元信息定制](#1-元信息定制)
  - [2. 首次启动自动安装内置插件列表](#2-首次启动自动安装内置插件列表)
  - [3. 暴露 VS Code 不支持的 API](#3-暴露-vs-code-不支持的-api)
  - [4. 注册 IDE 自己的命令行](#4-注册-ide-自己的命令行)
- [三、Extension 层（业务功能）](#三extension-层业务功能)
- [四、设计原则](#四设计原则)

---

## 一、项目定位

```
产品：为快应用开发者提供全链路 IDE
底座：VS Code（Electron）二次开发
平台：macOS / Linux / Windows
覆盖：项目创建 → 语法高亮/补全 → 调试预览 → 构建编译 → 打包发布
```

---

## 二、IDE 本体核心改动（4 点）

> IDE 本体 = 改 VS Code 源码本身。改动极少（< 10 个文件），其余全部通过 Extension 实现。

### 1. 元信息定制

product.json 配置：名称、图标、数据目录、协议名、更新源。

```jsonc
{
  "nameShort": "QuickApp IDE",          // 标题栏/关于页显示的名称
  "applicationName": "quickapp-ide",    // 进程名 + CLI 命令名
  "dataFolderName": ".quickapp-ide",    // 用户数据目录（与 VS Code 隔离）
  "urlProtocol": "quickapp-ide",        // 自定义协议（quickapp-ide://open?file=...）
  "updateUrl": "https://internal-cdn.example.com/ide/update"  // 自动更新源
}
```

图标：替换 `resources/` 目录下的平台图标文件：

```
resources/
├── darwin/    → code.icns（macOS 应用图标，1024x1024）
├── win32/     → code.ico（Windows，256x256）
└── linux/     → code.png（Linux，512x512）
```

### 2. 首次启动自动安装内置插件列表
→ 详见 [内置插件自动安装方案](./builtin-extension-install.md)

```
模式：
  功能插件独立发布到扩展商店
  → IDE 首次启动时，根据内置列表自动从商店下载安装
  → 不是打包时内嵌进安装包（安装包保持轻量）

好处：
  插件独立迭代发布（不需要发新版 IDE）
  用户后续也能从商店获取更新
```

### 3. 暴露 VS Code 不支持的 API

> → 详见 [暴露 API 与自定义 WebView 区域](./custom-api-header-webview.md)

目前主要是 **Header WebView 区域**：在 IDE 顶部（TitleBar 下方、Editor 上方）提供一个 WebView 区域，让插件能显示构建状态、公告等。

```
方案：复用 ViewContainer 体系（3 处源码改动）
  ① ViewContainerLocation 枚举加 Header 值
  ② Layout Grid 中 TitleBar 和 Editor 之间插入新容器
  ③ ViewDescriptorService 解析 package.json 时识别 "header" key

插件侧零学习成本：和注册 SideBar WebView 一模一样的用法。
```

### 4. 注册 IDE 自己的命令行

```
用 quickapp-ide 替代 code：
  quickapp-ide .          # 打开当前目录
  quickapp-ide --install-extension xxx   # 安装插件

实现涉及两件事：

1. CLI 命令注册（让终端能识别 quickapp-ide 命令）

   VS Code 已有这套机制（就是 `code` 命令），我们只需要改名字：
   
   改动 1：product.json 中设置 applicationName
     → "applicationName": "quickapp-ide"
     → VS Code 的 CLI 模块（src/vs/code/node/cli.ts）读这个值作为命令名
   
   改动 2：shell 脚本模板中的命令名
     → resources/linux/bin/code → 改文件名为 quickapp-ide + 内部引用改名
     → resources/darwin/bin/code → 同上
   
   安装时是否自动注册到 PATH（分平台）：
     Windows（NSIS）：✅ 安装时自动加入 PATH（NSIS 脚本配置）
     Linux（.deb/.rpm）：✅ 包管理器安装时放到 /usr/bin/
     macOS：❌ 不自动。用户需要在 IDE 内手动触发一次：
       命令面板 → "Install 'quickapp-ide' command in PATH" → 创建符号链接到 /usr/local/bin/
       （macOS 写 /usr/local/bin 需要 sudo，安装器不方便自动做）
   
   本质：不需要我们实现 CLI 逻辑，VS Code 已经有完整的 CLI 系统（解析参数/打开文件/安装插件等）。
   我们只是把 `code` 这个名字换成 `quickapp-ide`。
```

---

## 三、Extension 层（业务功能）

> 所有业务功能做成独立 Extension，发布到商店。

| 插件 | 功能 | 技术实现 |
|------|------|---------|
| 语言支持 | 语法高亮 + 补全 + 诊断 | TextMate Grammar + LSP（独立进程）→ [详见](./lsp.md) |
| 项目管理 | 模板创建向导 | WebviewView 面板 |
| 构建 | 构建/预览/打包命令 | Task Provider + child_process 调编译 CLI → [详见](./build-pipeline.md) |
| 调试 | 真机/模拟器断点调试 | DAP + CDP（adb forward → V8 Inspector） |
| 分析 | 依赖分析 & 评分 | AST → 依赖图 → 图算法 |

---

## 四、设计原则

```
最小侵入：
  IDE 本体只改 4 点（< 10 个文件）
  业务功能全部 Extension 化
  → 上游 VS Code 升级时 merge 冲突极小
  → 插件独立迭代，不用发新版 IDE

能配置不硬编码，能插件不改源码。
```
