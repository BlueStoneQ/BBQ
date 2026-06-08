# 01 - VSCode 二开全景与改造清单

> 核心问题: 我要基于 VSCode 做一个自己的 IDE，需要改哪些地方？

## 目录

- [第一性原理](#第一性原理)
- [改造分级: 从轻到重](#改造分级-从轻到重)
  - [Level 1: 换皮 (品牌定制)](#level-1-换皮-品牌定制)
  - [Level 2: 功能增减](#level-2-功能增减)
  - [Level 3: 架构改动](#level-3-架构改动)
- [product.json 完整定制项](#productjson-完整定制项)
- [构建与发布](#构建与发布)
- [上游同步策略](#上游同步策略)
- [常见陷阱](#常见陷阱)
- [小结](#小结)

---

## 第一性原理

**定制 IDE 的本质是**: 在 VSCode 的架构骨架上，替换/增加/删减内容，使其成为面向特定场景的工具。

**核心约束**: 改得越多，与上游同步越难。因此设计原则是 —— **最小侵入，能配置不硬编码，能插件不改源码**。

---

## 改造分级: 从轻到重

### Level 1: 换皮 (品牌定制)

| 改什么 | 文件 | 说明 |
|--------|------|------|
| 产品名称 | `product.json` → nameShort / nameLong | 显示在标题栏、关于页 |
| 应用标识 | `product.json` → applicationName | 影响进程名、协议名 |
| 用户数据目录 | `product.json` → dataFolderName | 如 `.my-ide`，与 VSCode 隔离 |
| 更新服务器 | `product.json` → updateUrl | 指向自有 CDN |
| 扩展市场 | `product.json` → extensionsGallery | 换地址或用 Open VSX |
| 应用图标 | `resources/` 下各平台 icon | .icns / .ico / .png |
| 欢迎页 | `workbench/contrib/welcome/` | 改文案和链接 |
| 默认主题 | `product.json` 或配置 | 预设深色/浅色主题 |

**工作量**: 0.5~1 天。**上游同步风险**: 极低。

### Level 2: 功能增减

| 目标 | 做法 | 位置 |
|------|------|------|
| 去掉功能 | 删除对应 `import` | `workbench.desktop.main.ts` |
| 预装内置插件 | 放 `extensions/` + 声明 | `product.json` → builtInExtensions |
| 添加新 contrib 功能 | 新建 `vs/workbench/contrib/xxx/` | 注册视图/命令/菜单 |
| 改默认配置 | 修改默认值 | `vs/workbench/contrib/preferences/` |
| 加自定义页面 | Webview + 命令 | 在 contrib 中注册 |
| 自有设置同步 | 替换 sync URL | `product.json` → configurationSync |

**工作量**: 1~5 天。**上游同步风险**: 中等。

### Level 3: 架构改动

| 目标 | 做法 | 涉及层 |
|------|------|--------|
| 新增 Platform Service | `vs/platform/xxx/` (common + node + electron-main) | platform |
| 暴露新 Extension API | ExtHost + MainThread + protocol + api.impl | workbench/api |
| 改 Workbench Layout | `vs/workbench/browser/layout.ts` | workbench/browser |
| 加新进程 | 基于 UtilityProcess | platform + electron-main |
| 改主进程行为 | `vs/code/electron-main/app.ts` | code |
| 改编辑器行为 | `vs/editor/contrib/` 或 `vs/editor/browser/` | editor |

**工作量**: 周级。**上游同步风险**: 高 → 必须用独立目录策略。

---

## product.json 完整定制项

```json
{
  // === 基本标识 ===
  "nameShort": "My IDE",
  "nameLong": "My IDE - Professional Edition",
  "applicationName": "my-ide",
  "dataFolderName": ".my-ide",
  "urlProtocol": "my-ide",
  "quality": "stable",

  // === 更新 ===
  "updateUrl": "https://your-cdn.com/ide/update",

  // === 扩展市场 ===
  "extensionsGallery": {
    "serviceUrl": "https://marketplace.visualstudio.com/_apis/public/gallery",
    "itemUrl": "https://marketplace.visualstudio.com/items"
  },

  // === 内置扩展 ===
  "builtInExtensions": [
    { "name": "your-org.your-extension", "version": "1.0.0", "sha256": "..." }
  ],

  // === 链接 ===
  "reportIssueUrl": "https://github.com/your-org/issues",
  "documentationUrl": "https://docs.your-org.com",
  "releaseNotesUrl": "https://your-org.com/releases",

  // === Windows 安装 ===
  "win32x64AppId": "{{YOUR-GUID}",
  "win32DirName": "My IDE",

  // === macOS ===
  "darwinBundleIdentifier": "com.your-org.ide"
}
```

---

## 构建与发布

### 开发

```bash
yarn                    # 安装依赖 (会触发 postinstall 编译原生模块)
yarn watch              # 启动开发监听
./scripts/code.sh       # 启动开发版 IDE
```

### 生产构建

```bash
# Linux
yarn gulp vscode-linux-x64
yarn gulp vscode-linux-x64-build-deb

# Windows
yarn gulp vscode-win32-x64
yarn gulp vscode-win32-x64-user-setup

# macOS
yarn gulp vscode-darwin-arm64
```

### 构建产物

```
.build/
├── linux/x64/VSCode-linux-x64/    → .deb / .rpm / .tar.gz
├── win32-x64/                     → .exe (Inno Setup)
└── darwin-arm64/                  → .app → .dmg
```

---

## 上游同步策略

### 推荐: 最小侵入原则

```
你的代码布局:
src/vs/
├── base/         ← 不改
├── platform/     ← 尽量不改，如需增加放独立目录
├── editor/       ← 不改
├── workbench/
│   ├── contrib/
│   │   └── yourFeature/   ← 自有功能独立目录 ✅
│   └── api/
│       ├── common/extHostYourFeature.ts  ← 新文件 ✅
│       └── browser/mainThreadYourFeature.ts
├── code/         ← 尽量不改
└── custom/       ← 自有业务逻辑总目录 ✅
```

### 同步流程

```bash
# 每月一次
git remote add upstream https://github.com/microsoft/vscode.git
git fetch upstream
git merge upstream/release/1.xxx --no-commit
# 解决冲突 (主要在入口文件的 import 语句)
git commit -m "sync: merge upstream 1.xxx"
```

### 冲突热点

| 文件 | 冲突原因 | 缓解策略 |
|------|---------|---------|
| `workbench.desktop.main.ts` | 添加/删除了 import | 用注释标记自有改动 |
| `product.json` | 都在改这个文件 | 只在自有分支改，never merge upstream 的 |
| `package.json` | 版本号/依赖 | 手动合并 |
| `src/main.ts` | 改了启动逻辑 | 尽量不改，用配置驱动 |

---

## 常见陷阱

| 陷阱 | 后果 | 避免方式 |
|------|------|---------|
| 直接改上游文件 | 每次 merge 冲突 | 独立目录 + 注入点 |
| 不锁 Electron 版本 | 原生模块 ABI 不兼容 | `package.json` 锁版本 |
| 用 BrowserView (已废弃) | 未来升级被迫迁移 | 用 WebContentsView |
| 直接暴露 Node API 给渲染 | 安全风险 | 走 IPC + preload 桥接 |
| 修改 base/platform 层 | 影响面太大 | 向 workbench 层抬代码 |
| 不做 Proposed API | 直接 public → 不可回退 | 先 proposed 再转正 |

---

## 小结

| 原则 | 说明 |
|------|------|
| product.json 优先 | 能配置解决的不写代码 |
| 独立目录 | 自有代码与上游物理隔离 |
| 最小注入点 | 改上游文件只加 1-2 行 import |
| 插件优先 | 能用 Extension 解决就不改源码 |
| 先 Proposed | 新 API 先限定白名单测试 |
| 月度同步 | 不攒太久，小步合并 |
