# VS Code 构建工具链

> 解决什么问题：VS Code / 基于 VS Code 的 IDE 怎么从源码构建出可运行的桌面应用——涉及多进程多入口同时编译。
>
> 场景：快应用 IDE 基于 VS Code 二次开发，需要理解构建流程才能做定制。

---

## 目录

- [VS Code 的构建特殊性](#vscode-的构建特殊性)
- [构建链路](#构建链路)
- [关键构建工具](#关键构建工具)
- [二次开发时的定制点](#二次开发时的定制点)

---

## VS Code 的构建特殊性

```
普通 Electron App：
  一份 main.ts + 一份 renderer → electron-vite 编译 → electron-builder 打包
  简单明了

VS Code 级别的 IDE：
  - Main Process 代码
  - Renderer（Workbench）代码
  - Extension Host 代码
  - 内置插件（几十个）
  - Language Server（多个）
  - Node.js 原生模块（需要 rebuild）
  - 各平台产物不同（macOS .app / Windows .exe / Linux .deb）
  
  = 多入口 + 多 target + 多平台 + 原生模块 = 构建复杂度远超普通应用
```

---

## 构建链路

```
VS Code 源码构建流程：

  1. 依赖安装
     npm/yarn install → 安装几千个依赖
     → electron-rebuild：重新编译原生 addon（node-pty 等）给当前 Electron 版本

  2. 编译
     TypeScript 编译（tsc）→ 全量 TS → JS
     LESS/CSS 编译
     多入口分别编译（Main / Renderer / Extension Host 各有独立 tsconfig）

  3. Bundle
     Webpack / esbuild 打包渲染进程代码
     Main 进程代码不 bundle（直接用编译后的 JS + node_modules）

  4. 内置插件构建
     每个内置插件独立构建（有的用 webpack，有的用 esbuild）
     产出放到 extensions/ 目录

  5. 产品化
     替换品牌（logo / 名称 / about）
     注入产品配置（telemetry / marketplace URL）
     生成 package.json 的 main 入口

  6. 平台打包
     electron-builder / VS Code 自研 gulp 任务
     → .dmg / .exe / .deb / .snap
     → 签名 + 公证
```

---

## 关键构建工具

| 工具 | 用途 | VS Code 用法 |
|------|------|-------------|
| **TypeScript** | 编译 TS → JS | 多份 tsconfig（main/renderer/extension-host 各一份） |
| **Webpack** | Bundle 渲染进程 | Workbench（编辑器 UI）的打包 |
| **esbuild** | 快速打包 | 部分内置插件 + 新模块用 esbuild 替代 webpack |
| **electron-rebuild** | 原生模块重编 | node-pty / native-keymap 等需要匹配 Electron 版本 |
| **gulp** | 任务编排 | VS Code 用 gulp 编排整个构建流程（不是 npm scripts） |
| **asar** | 代码归档 | 把源码打成 .asar 文件（保护+加速文件读取） |

---

## 二次开发时的定制点

```
基于 VS Code 做 IDE 二次开发，通常在以下点做定制：

  1. 品牌定制
     - 改 logo / 名称 / 启动页
     - 改 about / telemetry endpoint
     - 配置内置插件列表

  2. 内置插件
     - 添加自定义内置插件（快应用语言支持 / 调试器 / 设备管理）
     - 去掉不需要的内置插件（减体积）

  3. Renderer 定制
     - 自定义 Workbench 布局（添加面板 / 修改侧边栏）
     - 注入自定义 CSS 主题

  4. Main 进程定制
     - 添加 IPC handler（设备通信 / 构建编译）
     - 添加子进程管理（adb / CDP / 文件监听）

  5. 构建流程定制
     - 修改 gulp 任务添加自定义步骤
     - 添加自定义 webpack entry
     - 配置 electron-builder 的产物/签名

你的快应用 IDE 经验对应：
  - 主进程：设备通信（adb/CDP）、依赖分析引擎、构建编译
  - 内置插件：快应用语言支持 + 调试器
  - Renderer：调试面板、设备管理面板
```
